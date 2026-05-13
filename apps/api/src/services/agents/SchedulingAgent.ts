import { BaseAgent, type AgentResult } from './BaseAgent.js';
import type { IAgentSession } from '../../models/AgentSession.js';
import { getAvailability, createAppointment } from '../appointment.service.js';
import { Operatory } from '../../models/Operatory.js';
import { User } from '../../models/User.js';
import { Role } from '../../models/Role.js';
import { Types } from 'mongoose';

// Time windows per triage level
const WINDOW_MS: Record<string, number> = {
  emergency: 2 * 60 * 60 * 1000,       // 2 hours
  urgent:    24 * 60 * 60 * 1000,       // 24 hours
  routine:   7 * 24 * 60 * 60 * 1000,  // 7 days
  elective:  7 * 24 * 60 * 60 * 1000,  // 7 days
};

export class SchedulingAgent extends BaseAgent {
  readonly name = 'SchedulingAgent' as const;
  readonly timeoutMs = 10_000;

  async execute(session: IAgentSession): Promise<AgentResult> {
    const triageLevel = session.triageLevel ?? 'routine';
    const windowMs = WINDOW_MS[triageLevel] ?? WINDOW_MS.routine;
    const now = new Date();
    const to = new Date(now.getTime() + windowMs);

    // Find first available dentist
    const dentistRole = await Role.findOne({ name: 'dentist' }).lean();
    if (!dentistRole) {
      return { success: false, update: {}, error: 'No dentist role found in system.' };
    }

    const dentists = await User.find({ role: dentistRole._id, isActive: true, deletedAt: { $exists: false } }).lean();
    if (!dentists.length) {
      return { success: false, update: { noSlotAvailable: true }, error: 'No active dentists available.' };
    }

    // Find first available operatory
    const operatories = await Operatory.find({ isActive: true }).lean();
    if (!operatories.length) {
      return { success: false, update: { noSlotAvailable: true }, error: 'No active operatories available.' };
    }

    // Try each dentist until a slot is found
    for (const dentist of dentists) {
      for (const operatory of operatories) {
        const slots = await getAvailability({
          dentistId: dentist._id.toString(),
          operatoryId: operatory._id.toString(),
          from: now,
          to,
          slotDurationMinutes: 30,
        });

        if (!slots.length) continue;

        // Try to book the first slot, retry up to 3 times on conflict
        for (let attempt = 0; attempt < 3; attempt++) {
          const slot = slots[attempt];
          if (!slot) break;

          try {
            const appt = await createAppointment(
              {
                patientId: session.patientId.toString(),
                dentistId: dentist._id.toString(),
                operatoryId: operatory._id.toString(),
                appointmentType: 'consultation',
                startTime: slot.startTime,
                endTime: slot.endTime,
              },
              {
                userId: session.initiatedBy.toString(),
                ipAddress: 'agent',
                userAgent: 'SchedulingAgent',
              },
            );

            return {
              success: true,
              update: { appointmentId: appt._id },
            };
          } catch (err) {
            const msg = err instanceof Error ? err.message : '';
            if (!msg.startsWith('CONFLICT:')) throw err;
            // conflict — try next slot
          }
        }
      }
    }

    // No slot found
    return {
      success: true, // session continues so NotificationAgent can send no-slot notice
      update: { noSlotAvailable: true },
    };
  }
}
