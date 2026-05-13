import { BaseAgent, type AgentResult } from './BaseAgent.js';
import type { IAgentSession } from '../../models/AgentSession.js';
import { Patient } from '../../models/Patient.js';
import { Types } from 'mongoose';

export class IntakeAgent extends BaseAgent {
  readonly name = 'IntakeAgent' as const;
  readonly timeoutMs = 10_000;

  async execute(session: IAgentSession): Promise<AgentResult> {
    const symptoms      = session.intakeData?.symptoms ?? [];
    const chiefComplaint = session.intakeData?.chiefComplaint ?? '';

    if (!symptoms.length || !chiefComplaint.trim()) {
      return {
        success: false,
        update: {},
        error: 'Intake incomplete: symptoms and chief complaint are required.',
        nonRetryable: true,
      };
    }

    // For patient-portal submissions there is no patientId — use contact info only
    if (!session.patientId || !Types.ObjectId.isValid(session.patientId.toString())) {
      return {
        success: true,
        update: {
          intakeData: {
            ...session.intakeData!,
            medicalHistory: { allergies: [], medications: [], medicalConditions: [] },
            collectedAt: new Date(),
          },
        },
      };
    }

    // Staff-initiated session — enrich with patient medical history from DB
    const patient = await Patient.findOne({
      _id: session.patientId,
      deletedAt: { $exists: false },
    }).lean();

    if (!patient) {
      return { success: false, update: {}, error: 'PATIENT_NOT_FOUND', nonRetryable: true };
    }

    return {
      success: true,
      update: {
        intakeData: {
          ...session.intakeData!,
          medicalHistory: {
            allergies:         patient.allergies ?? [],
            medications:       patient.medications ?? [],
            medicalConditions: patient.medicalConditions ?? [],
          },
          collectedAt: new Date(),
        },
      },
    };
  }
}
