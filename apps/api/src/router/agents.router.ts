import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, publicProcedure } from '../trpc/trpc.js';
import { requireRole } from '../trpc/trpc.js';
import { orchestrator } from '../services/agents/OrchestratorService.js';
import { AuditLog } from '../models/AuditLog.js';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { Operatory } from '../models/Operatory.js';
import { Types } from 'mongoose';

// ─── Serializer ───────────────────────────────────────────────────────────────

function serializeSession(s: Record<string, unknown> & { _id: { toString(): string } }) {
  return {
    id:                         (s._id as { toString(): string }).toString(),
    patientId:                  (s.patientId as { toString(): string } | undefined)?.toString(),
    initiatedBy:                (s.initiatedBy as { toString(): string } | undefined)?.toString(),
    assignedDoctorId:           (s.assignedDoctorId as { toString(): string } | undefined)?.toString(),
    status:                     s.status as string,
    currentStage:               s.currentStage as string,
    retryCount:                 s.retryCount as number,
    errorDetails:               s.errorDetails as string | undefined,
    patientContactInfo:         s.patientContactInfo,
    intakeData:                 s.intakeData,
    triageLevel:                s.triageLevel as string | undefined,
    triageConfidence:           s.triageConfidence as number | undefined,
    triageRationale:            s.triageRationale as string | undefined,
    requiresImmediateAttention: s.requiresImmediateAttention as boolean | undefined,
    triageFallback:             s.triageFallback as boolean | undefined,
    appointmentDetails:         s.appointmentDetails,
    notificationChannel:        s.notificationChannel as string | undefined,
    appointmentId:              (s.appointmentId as { toString(): string } | undefined)?.toString(),
    noSlotAvailable:            s.noSlotAvailable as boolean | undefined,
    notificationsDispatched:    s.notificationsDispatched,
    consultationSummary:        s.consultationSummary as string | undefined,
    summaryFallback:            s.summaryFallback as boolean | undefined,
    startedAt:                  s.startedAt as Date,
    completedAt:                s.completedAt as Date | undefined,
    stageTimings:               s.stageTimings,
    createdAt:                  s.createdAt as Date,
    updatedAt:                  s.updatedAt as Date,
  };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const agentsRouter = router({

  // ── PUBLIC: Patient submits booking form ─────────────────────────────────

  submitPatientRequest: publicProcedure
    .input(z.object({
      firstName:       z.string().min(1),
      lastName:        z.string().min(1),
      email:           z.string().email().optional(),
      phone:           z.string().min(1),
      symptoms:        z.array(z.string().min(1)).min(1),
      chiefComplaint:  z.string().min(1),
      appointmentType: z.string().min(1),
      disease:         z.string().optional(),
      severity:        z.string().optional(),
      duration:        z.string().optional(),
      description:     z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const session = await orchestrator.submitPatientRequest({
        firstName:       input.firstName,
        lastName:        input.lastName,
        ...(input.email ? { email: input.email } : {}),
        phone:           input.phone,
        symptoms:        input.symptoms,
        chiefComplaint:  input.chiefComplaint,
        appointmentType: input.appointmentType,
        ...(input.disease     ? { disease:     input.disease }     : {}),
        ...(input.severity    ? { severity:    input.severity }    : {}),
        ...(input.duration    ? { duration:    input.duration }    : {}),
        ...(input.description ? { description: input.description } : {}),
      });
      return { sessionId: session._id.toString(), status: session.status };
    }),

  // ── RECEPTIONIST: List all pending/awaiting sessions ─────────────────────

  listIncoming: protectedProcedure
    .use(requireRole('receptionist', 'admin'))
    .query(async () => {
      // Show everything except completed — receptionist needs to see
      // in_progress (agents running), awaiting_human (needs action), and failed
      const { AgentSession } = await import('../models/AgentSession.js');
      const sessions = await AgentSession.find({
        status: { $in: ['in_progress', 'awaiting_human', 'failed'] },
      }).sort({ createdAt: -1 }).limit(100).lean();
      return sessions.map(s => serializeSession(s as unknown as Record<string, unknown> & { _id: { toString(): string } }));
    }),

  // ── RECEPTIONIST: Assign a doctor ────────────────────────────────────────

  assignDoctor: protectedProcedure
    .use(requireRole('receptionist', 'admin'))
    .input(z.object({
      sessionId: z.string().min(1),
      doctorId:  z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const session = await orchestrator.assignDoctor(input.sessionId, input.doctorId, ctx.userId!);
      return serializeSession(session as unknown as Record<string, unknown> & { _id: { toString(): string } });
    }),

  // ── RECEPTIONIST: Send confirmation to patient ───────────────────────────

  sendConfirmation: protectedProcedure
    .use(requireRole('receptionist', 'admin'))
    .input(z.object({
      sessionId: z.string().min(1),
      channel:   z.enum(['email', 'whatsapp', 'sms']),
    }))
    .mutation(async ({ input, ctx }) => {
      const session = await orchestrator.sendConfirmation(input.sessionId, ctx.userId!, input.channel);
      return serializeSession(session as unknown as Record<string, unknown> & { _id: { toString(): string } });
    }),

  // ── DOCTOR: List sessions assigned to me ─────────────────────────────────

  listMyAssigned: protectedProcedure
    .use(requireRole('dentist', 'admin'))
    .query(async ({ ctx }) => {
      const { AgentSession } = await import('../models/AgentSession.js');
      const sessions = await AgentSession.find({
        assignedDoctorId: new Types.ObjectId(ctx.userId!),
        currentStage: 'awaiting_doctor',
      }).sort({ createdAt: -1 }).lean();
      return sessions.map(s => serializeSession(s as unknown as Record<string, unknown> & { _id: { toString(): string } }));
    }),

  // ── DOCTOR: Submit appointment details ───────────────────────────────────

  submitAppointmentDetails: protectedProcedure
    .use(requireRole('dentist', 'admin'))
    .input(z.object({
      sessionId:    z.string().min(1),
      operatoryId:  z.string().min(1),
      date:         z.string().min(1),
      startTime:    z.string().min(1),
      endTime:      z.string().min(1),
      notes:        z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Resolve operatory name
      const op = await Operatory.findById(input.operatoryId).lean();
      const session = await orchestrator.submitAppointmentDetails(
        input.sessionId,
        ctx.userId!,
        {
          operatoryId:   input.operatoryId,
          operatoryName: op?.name ?? input.operatoryId,
          date:          input.date,
          startTime:     input.startTime,
          endTime:       input.endTime,
          ...(input.notes ? { notes: input.notes } : {}),
        },
      );
      return serializeSession(session as unknown as Record<string, unknown> & { _id: { toString(): string } });
    }),

  // ── SHARED: Get single session ────────────────────────────────────────────

  getSession: protectedProcedure
    .use(requireRole('receptionist', 'admin', 'dentist'))
    .input(z.object({ sessionId: z.string().min(1) }))
    .query(async ({ input }) => {
      const session = await orchestrator.getSession(input.sessionId);
      if (!session) throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found.' });
      return serializeSession(session as unknown as Record<string, unknown> & { _id: { toString(): string } });
    }),

  // ── DENTIST/ADMIN: Get consultation summary ───────────────────────────────

  getSummary: protectedProcedure
    .use(requireRole('dentist', 'admin'))
    .input(z.object({ sessionId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const session = await orchestrator.getSession(input.sessionId);
      if (!session) throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found.' });
      if (!session.consultationSummary) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Summary not yet available.' });
      }
      AuditLog.create({
        userId: new Types.ObjectId(ctx.userId!),
        action: 'agent_session.summary_view',
        resourceType: 'agent_session',
        resourceId: session._id,
        ipAddress: 'unknown', userAgent: 'unknown',
        timestamp: new Date(),
        metadata: { sessionId: input.sessionId },
      }).catch(() => {});
      return { consultationSummary: session.consultationSummary, summaryFallback: session.summaryFallback ?? false };
    }),

  // ── ADMIN: List all sessions ──────────────────────────────────────────────

  listSessions: protectedProcedure
    .use(requireRole('admin'))
    .input(z.object({
      status: z.enum(['pending','in_progress','awaiting_human','completed','failed']).optional(),
      from:   z.coerce.date().optional(),
      to:     z.coerce.date().optional(),
      limit:  z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const { sessions, total } = await orchestrator.listSessions(input);
      return {
        sessions: sessions.map(s => serializeSession(s as unknown as Record<string, unknown> & { _id: { toString(): string } })),
        total,
      };
    }),

  // ── HELPERS: Dropdown data ────────────────────────────────────────────────

  getDoctors: protectedProcedure
    .use(requireRole('receptionist', 'admin'))
    .query(async () => {
      const dentistRole = await Role.findOne({ name: 'dentist' }).lean();
      if (!dentistRole) return [];
      const doctors = await User.find({ role: dentistRole._id, isActive: true, deletedAt: { $exists: false } })
        .select('firstName lastName').lean();
      return doctors.map(d => ({ id: d._id.toString(), name: `Dr. ${d.firstName} ${d.lastName}` }));
    }),

  getOperatories: protectedProcedure
    .use(requireRole('dentist', 'admin'))
    .query(async () => {
      const ops = await Operatory.find({ isActive: true }).select('name').lean();
      return ops.map(o => ({ id: o._id.toString(), name: o.name }));
    }),
});
