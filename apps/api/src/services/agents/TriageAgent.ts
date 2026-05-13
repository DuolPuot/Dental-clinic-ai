import { BaseAgent, type AgentResult } from './BaseAgent.js';
import type { IAgentSession, TriageLevel } from '../../models/AgentSession.js';
import { getDecisionSupport, AI_DISCLAIMER } from '../ai.service.js';
import { messageBus } from './MessageBus.js';

export class TriageAgent extends BaseAgent {
  readonly name = 'TriageAgent' as const;
  readonly timeoutMs = 15_000;

  async execute(session: IAgentSession): Promise<AgentResult> {
    const intake = session.intakeData;
    if (!intake) {
      return { success: false, update: {}, error: 'Intake data missing — cannot triage.' };
    }

    let triageLevel: TriageLevel = 'routine';
    let triageConfidence = 0.5;
    let triageRationale = '';
    let triageFallback = false;

    try {
      const result = await getDecisionSupport({
        symptoms: intake.symptoms.join(', '),
        patientHistorySummary: [
          intake.medicalHistory.medicalConditions.join(', '),
          intake.chiefComplaint,
        ].filter(Boolean).join('. '),
        currentMedications: intake.medicalHistory.medications,
      });

      // Map highest-confidence diagnosis to triage level
      const top = result.diagnoses[0];
      if (top) {
        const symptomText = intake.symptoms.join(' ').toLowerCase();
        const isEmergency = /abscess|swollen|knocked.out|severe|unbearable|trauma|bleeding/i.test(symptomText);
        const isUrgent = /pain|infection|broken|cracked|lost.filling/i.test(symptomText);

        if (isEmergency) {
          triageLevel = 'emergency';
          triageConfidence = 0.9;
        } else if (isUrgent) {
          triageLevel = 'urgent';
          triageConfidence = 0.75;
        } else if (/whitening|cleaning|checkup|cosmetic/i.test(symptomText)) {
          triageLevel = 'elective';
          triageConfidence = 0.85;
        } else {
          triageLevel = 'routine';
          triageConfidence = top.confidence === 'high' ? 0.8 : top.confidence === 'medium' ? 0.6 : 0.4;
        }

        triageRationale = `Primary concern: ${top.name}. ${top.evidence} ${AI_DISCLAIMER}`;
      } else {
        triageRationale = `No specific diagnosis identified. Defaulting to routine. ${AI_DISCLAIMER}`;
      }
    } catch {
      // GPT-4o failure — use fallback
      triageFallback = true;
      triageLevel = 'routine';
      triageRationale = `Triage fallback: AI unavailable. Defaulting to routine priority. ${AI_DISCLAIMER}`;
    }

    const requiresImmediateAttention = triageLevel === 'emergency';

    // Publish alert immediately for emergency cases so NotificationAgent can act early
    if (requiresImmediateAttention) {
      await messageBus.publish({
        sessionId: session._id.toString(),
        agentName: 'TriageAgent',
        eventType: 'alert',
        payload: { triageLevel, sessionId: session._id.toString() },
        timestamp: new Date().toISOString(),
      });
    }

    return {
      success: true,
      update: {
        triageLevel,
        triageConfidence,
        triageRationale,
        triageFallback: triageFallback || undefined,
        requiresImmediateAttention: requiresImmediateAttention || undefined,
      },
    };
  }
}
