import { BaseAgent, type AgentResult } from './BaseAgent.js';
import type { IAgentSession } from '../../models/AgentSession.js';
import { enqueueNotification } from '../notification.service.js';

export class NotificationAgent extends BaseAgent {
  readonly name = 'NotificationAgent' as const;
  readonly timeoutMs = 5_000;

  async execute(session: IAgentSession): Promise<AgentResult> {
    const dispatched: { notificationType: string; enqueuedAt: Date }[] = [];
    const patientId = session.patientId.toString();

    // 1. Appointment confirmation
    if (session.appointmentId) {
      await enqueueNotification({
        type: 'appointment_confirmation_email',
        patientId,
        appointmentId: session.appointmentId.toString(),
        to: '',
        templateData: { appointmentId: session.appointmentId.toString() },
      });
      dispatched.push({ notificationType: 'appointment_confirmation_email', enqueuedAt: new Date() });
    }

    // 2. Urgent-care alert to staff when emergency
    if (session.requiresImmediateAttention) {
      await enqueueNotification({
        type: 'appointment_reminder_email',
        patientId,
        appointmentId: session.appointmentId?.toString(),
        to: '',
        templateData: {
          urgent: true,
          triageLevel: session.triageLevel,
          sessionId: session._id.toString(),
        },
      });
      dispatched.push({ notificationType: 'urgent_care_alert', enqueuedAt: new Date() });
    }

    // 3. No-slot-available notice
    if (session.noSlotAvailable) {
      await enqueueNotification({
        type: 'appointment_reminder_sms',
        patientId,
        to: '',
        templateData: {
          noSlotAvailable: true,
          message: 'No immediate slot is available. Please call the clinic directly.',
        },
      });
      dispatched.push({ notificationType: 'no_slot_available', enqueuedAt: new Date() });
    }

    return {
      success: true,
      update: { notificationsDispatched: dispatched },
    };
  }
}
