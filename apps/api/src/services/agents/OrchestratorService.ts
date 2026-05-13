import { Types } from 'mongoose';
import { AgentSession, type IAgentSession, type AgentName, type AgentStage } from '../../models/AgentSession.js';
import { AuditLog } from '../../models/AuditLog.js';
import { messageBus } from './MessageBus.js';
import { BaseAgent, AgentTimeoutError, withTimeout, type AgentResult } from './BaseAgent.js';
import { IntakeAgent } from './IntakeAgent.js';
import { TriageAgent } from './TriageAgent.js';
import { SchedulingAgent } from './SchedulingAgent.js';
import { NotificationAgent } from './NotificationAgent.js';
import { SummaryAgent } from './SummaryAgent.js';

const AGENT_SEQUENCE: AgentName[] = [
  'IntakeAgent', 'TriageAgent', 'SchedulingAgent', 'NotificationAgent', 'SummaryAgent',
];

const STAGE_MAP: Record<AgentName, AgentStage> = {
  IntakeAgent:      'intake',
  TriageAgent:      'triage',
  SchedulingAgent:  'scheduling',
  NotificationAgent:'notification',
  SummaryAgent:     'summary',
};

const MAX_RETRIES = 3;
const TIMEOUT_WATCHDOG_MS = 5 * 60 * 1000; // 5 minutes

export interface SessionListFilter {
  status?: IAgentSession['status'] | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export class OrchestratorService {
  private agents: Map<AgentName, BaseAgent>;

  constructor() {
    this.agents = new Map<AgentName, BaseAgent>([
      ['IntakeAgent',       new IntakeAgent()],
      ['TriageAgent',       new TriageAgent()],
      ['SchedulingAgent',   new SchedulingAgent()],
      ['NotificationAgent', new NotificationAgent()],
      ['SummaryAgent',      new SummaryAgent()],
    ]);

    // Session timeout watchdog — runs every 60s
    setInterval(async () => {
      try {
        const cutoff = new Date(Date.now() - TIMEOUT_WATCHDOG_MS);
        const stale = await AgentSession.find({ status: 'in_progress', updatedAt: { $lt: cutoff } });
        for (const session of stale) {
          await this.failSession(session, 'SESSION_TIMEOUT');
        }
      } catch (err) {
        console.error('[Orchestrator] Watchdog error:', err);
      }
    }, 60_000).unref();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  async startSession(
    patientId: string,
    initiatedBy: string,
    intakeInput: { symptoms: string[]; chiefComplaint: string },
  ): Promise<IAgentSession> {
    const session = await AgentSession.create({
      patientId: new Types.ObjectId(patientId),
      initiatedBy: new Types.ObjectId(initiatedBy),
      status: 'in_progress',
      currentStage: 'intake',
      retryCount: 0,
      startedAt: new Date(),
      intakeData: {
        symptoms: intakeInput.symptoms,
        chiefComplaint: intakeInput.chiefComplaint,
        medicalHistory: { allergies: [], medications: [], medicalConditions: [] },
        collectedAt: new Date(),
      },
    });

    await this.auditTransition(session, 'agent_session.create', initiatedBy);
    this.runPipeline(session, initiatedBy).catch(err =>
      console.error('[Orchestrator] Pipeline error:', err),
    );
    return session;
  }

  /** Called from the public patient booking form — no auth required */
  async submitPatientRequest(input: {
    firstName: string;
    lastName: string;
    email?: string;
    phone: string;
    symptoms: string[];
    chiefComplaint: string;
    appointmentType: string;
    disease?: string;
    severity?: string;
    duration?: string;
    description?: string;
  }): Promise<IAgentSession> {
    const session = await AgentSession.create({
      status: 'in_progress',
      currentStage: 'intake',
      retryCount: 0,
      startedAt: new Date(),
      patientContactInfo: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
      },
      intakeData: {
        symptoms: input.symptoms,
        chiefComplaint: input.chiefComplaint,
        appointmentType: input.appointmentType,
        disease: input.disease,
        severity: input.severity,
        duration: input.duration,
        description: input.description,
        medicalHistory: { allergies: [], medications: [], medicalConditions: [] },
        collectedAt: new Date(),
      },
    });

    // Run only Intake + Triage agents — then pause for human assignment
    this.runIntakeAndTriage(session).catch(err =>
      console.error('[Orchestrator] Intake/Triage error:', err),
    );

    return session;
  }

  /** Receptionist assigns a doctor to a triaged session */
  async assignDoctor(sessionId: string, doctorId: string, receptionistId: string): Promise<IAgentSession> {
    const session = await AgentSession.findByIdAndUpdate(
      sessionId,
      { $set: { assignedDoctorId: new Types.ObjectId(doctorId), currentStage: 'awaiting_doctor', status: 'awaiting_human' } },
      { new: true },
    ).lean<IAgentSession>();
    if (!session) throw new Error('Session not found');
    await this.auditTransition(session, 'agent_session.doctor_assigned', receptionistId, { doctorId });
    return session;
  }

  /** Doctor submits appointment details */
  async submitAppointmentDetails(
    sessionId: string,
    doctorId: string,
    details: { operatoryId: string; operatoryName: string; date: string; startTime: string; endTime: string; notes?: string },
  ): Promise<IAgentSession> {
    const session = await AgentSession.findByIdAndUpdate(
      sessionId,
      {
        $set: {
          appointmentDetails: { ...details, submittedAt: new Date() },
          currentStage: 'awaiting_confirmation',
          status: 'awaiting_human',
        },
      },
      { new: true },
    ).lean<IAgentSession>();
    if (!session) throw new Error('Session not found');
    await this.auditTransition(session, 'agent_session.appointment_details_submitted', doctorId);
    return session;
  }

  /** Receptionist sends confirmation to patient and completes the session */
  async sendConfirmation(
    sessionId: string,
    receptionistId: string,
    channel: 'email' | 'whatsapp' | 'sms',
  ): Promise<IAgentSession> {
    const session = await AgentSession.findById(sessionId).lean<IAgentSession>();
    if (!session) throw new Error('Session not found');

    const { enqueueNotification } = await import('../notification.service.js');
    const patientId = session.patientId?.toString() ?? 'unknown';
    const contact = session.patientContactInfo;
    const appt = session.appointmentDetails;

    const templateData = {
      patientName: contact ? `${contact.firstName} ${contact.lastName}` : 'Patient',
      appointmentDate: appt?.date ?? '',
      appointmentTime: appt?.startTime ?? '',
      operatoryName: appt?.operatoryName ?? '',
      notes: appt?.notes ?? '',
    };

    const typeMap = {
      email:    'appointment_confirmation_email',
      whatsapp: 'appointment_confirmation_whatsapp',
      sms:      'appointment_reminder_sms',
    } as const;

    await enqueueNotification({
      type: typeMap[channel],
      patientId,
      to: channel === 'email' ? (contact?.email ?? '') : (contact?.phone ?? ''),
      templateData,
    });

    // Fix: $push must be separate from $set
    await AgentSession.findByIdAndUpdate(sessionId, {
      $push: { notificationsDispatched: { notificationType: `confirmation_${channel}`, enqueuedAt: new Date() } },
    });

    const updated = await AgentSession.findByIdAndUpdate(
      sessionId,
      {
        $set: {
          notificationChannel: channel,
          currentStage: 'completed',
          status: 'completed',
          completedAt: new Date(),
        },
      },
      { new: true },
    ).lean<IAgentSession>() ?? session;

    await this.auditTransition(updated, 'agent_session.complete', receptionistId, { channel });
    return updated;
  }

  async getSession(sessionId: string): Promise<IAgentSession | null> {
    if (!Types.ObjectId.isValid(sessionId)) return null;
    return AgentSession.findById(sessionId).lean<IAgentSession>();
  }

  async getSessionsByPatient(patientId: string): Promise<IAgentSession[]> {
    if (!Types.ObjectId.isValid(patientId)) return [];
    return AgentSession.find({ patientId: new Types.ObjectId(patientId) })
      .sort({ createdAt: -1 })
      .lean<IAgentSession[]>();
  }

  async listSessions(filter: SessionListFilter): Promise<{ sessions: IAgentSession[]; total: number }> {
    const query: Record<string, unknown> = {};
    if (filter.status) query.status = filter.status;
    if (filter.from || filter.to) {
      query.createdAt = {};
      if (filter.from) (query.createdAt as Record<string, unknown>).$gte = filter.from;
      if (filter.to)   (query.createdAt as Record<string, unknown>).$lte = filter.to;
    }
    const limit  = filter.limit  ?? 50;
    const offset = filter.offset ?? 0;
    const [sessions, total] = await Promise.all([
      AgentSession.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit).lean<IAgentSession[]>(),
      AgentSession.countDocuments(query),
    ]);
    return { sessions, total };
  }

  // ── Pipeline ────────────────────────────────────────────────────────────────

  /** Runs only Intake + Triage for patient-submitted requests, then pauses */
  private async runIntakeAndTriage(session: IAgentSession): Promise<void> {
    let current = session;
    const systemUserId = '000000000000000000000000';

    for (const agentName of ['IntakeAgent', 'TriageAgent'] as AgentName[]) {
      const agent = this.agents.get(agentName)!;
      const result = await this.runAgent(agent, current);
      if (!result.success) {
        await this.failSession(current, result.error ?? 'Agent failed');
        return;
      }

      // Manually apply the update without advancing to the next pipeline stage
      current = await AgentSession.findByIdAndUpdate(
        current._id,
        { $set: { ...result.update, retryCount: 0 } },
        { new: true },
      ).lean<IAgentSession>() ?? current;

      await this.appendStageTiming(current, {
        agentName,
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: 0,
        outcome: 'success',
      });
    }

    // Pause here — receptionist must assign a doctor before anything else runs
    await AgentSession.findByIdAndUpdate(current._id, {
      $set: { currentStage: 'awaiting_assignment', status: 'awaiting_human' },
    });
  }

  private async runPipeline(session: IAgentSession, userId: string): Promise<void> {
    let current = session;

    for (const agentName of AGENT_SEQUENCE) {
      const agent = this.agents.get(agentName)!;
      const result = await this.runAgent(agent, current);

      if (!result.success) {
        await this.failSession(current, result.error ?? 'Agent failed');
        await this.auditTransition(current, 'agent_session.fail', userId);
        return;
      }

      current = await this.advanceSession(current, agentName, result, userId);
    }

    // All agents completed
    current = await AgentSession.findByIdAndUpdate(
      current._id,
      { $set: { status: 'completed', currentStage: 'completed', completedAt: new Date() } },
      { new: true },
    ).lean<IAgentSession>() ?? current;

    await this.auditTransition(current, 'agent_session.complete', userId);

    await messageBus.publish({
      sessionId: current._id.toString(),
      agentName: 'SummaryAgent',
      eventType: 'completed',
      payload: { sessionId: current._id.toString() },
      timestamp: new Date().toISOString(),
    });
  }

  private async runAgent(agent: BaseAgent, session: IAgentSession): Promise<AgentResult> {
    const startedAt = new Date();
    let lastError = '';
    let outcome: 'success' | 'failure' | 'timeout' = 'failure';

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await withTimeout(agent.execute(session), agent.timeoutMs, agent.name);

        if (result.success) {
          outcome = 'success';
          const completedAt = new Date();
          await this.appendStageTiming(session, {
            agentName: agent.name,
            startedAt,
            completedAt,
            durationMs: completedAt.getTime() - startedAt.getTime(),
            outcome,
          });
          return result;
        }

        lastError = result.error ?? 'Unknown error';
        if (result.nonRetryable) break;

      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        outcome = err instanceof AgentTimeoutError ? 'timeout' : 'failure';
        if (err instanceof AgentTimeoutError) break; // timeout counts as one attempt
      }
    }

    const completedAt = new Date();
    await this.appendStageTiming(session, {
      agentName: agent.name,
      startedAt,
      completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
      outcome,
    });

    return { success: false, update: {}, error: lastError };
  }

  private async advanceSession(
    session: IAgentSession,
    agentName: AgentName,
    result: AgentResult,
    userId: string,
  ): Promise<IAgentSession> {
    const agentIndex = AGENT_SEQUENCE.indexOf(agentName);
    const nextAgent = AGENT_SEQUENCE[agentIndex + 1];
    const nextStage = nextAgent ? STAGE_MAP[nextAgent] : 'completed';

    const updated = await AgentSession.findByIdAndUpdate(
      session._id,
      { $set: { ...result.update, currentStage: nextStage, retryCount: 0 } },
      { new: true },
    ).lean<IAgentSession>() ?? session;

    await this.auditTransition(updated, 'agent_session.stage_advance', userId, {
      from: STAGE_MAP[agentName],
      to: nextStage,
    });

    await messageBus.publish({
      sessionId: session._id.toString(),
      agentName,
      eventType: 'completed',
      payload: { stage: STAGE_MAP[agentName] },
      timestamp: new Date().toISOString(),
    });

    return updated;
  }

  private async failSession(session: IAgentSession, error: string): Promise<IAgentSession> {
    const updated = await AgentSession.findByIdAndUpdate(
      session._id,
      { $set: { status: 'failed', errorDetails: error } },
      { new: true },
    ).lean<IAgentSession>() ?? session;

    await messageBus.publish({
      sessionId: session._id.toString(),
      agentName: session.currentStage as AgentName,
      eventType: 'failed',
      payload: { error },
      timestamp: new Date().toISOString(),
    });

    return updated;
  }

  private async appendStageTiming(
    session: IAgentSession,
    timing: IAgentSession['stageTimings'][number],
  ): Promise<void> {
    await AgentSession.findByIdAndUpdate(session._id, { $push: { stageTimings: timing } });
  }

  private async auditTransition(
    session: IAgentSession,
    action: string,
    userId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    // Never log PHI fields
    const safeMeta = { sessionId: session._id.toString(), status: session.status, ...metadata };
    AuditLog.create({
      userId: new Types.ObjectId(userId),
      action,
      resourceType: 'agent_session',
      resourceId: session._id,
      ipAddress: 'orchestrator',
      userAgent: 'OrchestratorService',
      timestamp: new Date(),
      metadata: safeMeta,
    }).catch(err => console.error('[Orchestrator] AuditLog error:', err));
  }
}

// Singleton
export const orchestrator = new OrchestratorService();
