import { Schema, model, type Document, type Model } from 'mongoose';

export type AgentName = 'IntakeAgent' | 'TriageAgent' | 'SchedulingAgent' | 'NotificationAgent' | 'SummaryAgent';
export type AgentStage =
  | 'intake' | 'triage'
  | 'awaiting_assignment'   // receptionist assigns doctor
  | 'awaiting_doctor'       // doctor fills appointment details
  | 'awaiting_confirmation' // receptionist sends to patient
  | 'scheduling' | 'notification' | 'summary' | 'completed';
export type SessionStatus = 'pending' | 'in_progress' | 'awaiting_human' | 'completed' | 'failed';
export type TriageLevel = 'emergency' | 'urgent' | 'routine' | 'elective';

export interface IStageTiming {
  agentName: AgentName;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  outcome: 'success' | 'failure' | 'timeout';
}

export interface IAgentSession extends Document {
  _id: Schema.Types.ObjectId;
  patientId?: Schema.Types.ObjectId;
  initiatedBy?: Schema.Types.ObjectId;
  status: SessionStatus;
  currentStage: AgentStage;
  retryCount: number;
  errorDetails?: string;

  patientContactInfo?: { firstName: string; lastName: string; email?: string; phone: string };

  intakeData?: {
    symptoms: string[];
    chiefComplaint: string;
    appointmentType: string;
    disease?: string;
    severity?: string;
    duration?: string;
    description?: string;
    medicalHistory: { allergies: string[]; medications: string[]; medicalConditions: string[] };
    collectedAt: Date;
  };

  triageLevel?: TriageLevel;
  triageConfidence?: number;
  triageRationale?: string;
  requiresImmediateAttention?: boolean;
  triageFallback?: boolean;

  assignedDoctorId?: Schema.Types.ObjectId;
  appointmentDetails?: {
    operatoryId: string;
    operatoryName: string;
    date: string;
    startTime: string;
    endTime: string;
    notes?: string;
    submittedAt: Date;
  };
  notificationChannel?: 'email' | 'whatsapp' | 'sms';

  appointmentId?: Schema.Types.ObjectId;
  noSlotAvailable?: boolean;
  notificationsDispatched?: { notificationType: string; enqueuedAt: Date }[];
  consultationSummary?: string;
  summaryFallback?: boolean;

  startedAt: Date;
  completedAt?: Date;
  stageTimings: IStageTiming[];
  createdAt: Date;
  updatedAt: Date;
}

const agentSessionSchema = new Schema<IAgentSession>(
  {
    patientId:   { type: Schema.Types.ObjectId, ref: 'Patient' },
    initiatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending','in_progress','awaiting_human','completed','failed'], required: true, default: 'pending' },
    currentStage: {
      type: String,
      enum: ['intake','triage','awaiting_assignment','awaiting_doctor','awaiting_confirmation','scheduling','notification','summary','completed'],
      required: true, default: 'intake',
    },
    retryCount: { type: Number, default: 0 },
    errorDetails: String,

    patientContactInfo: { type: new Schema({ firstName: String, lastName: String, email: String, phone: String }, { _id: false }) },

    intakeData: {
      type: new Schema({
        symptoms: [String], chiefComplaint: String, appointmentType: String,
        disease: String, severity: String, duration: String, description: String,
        medicalHistory: { allergies: [String], medications: [String], medicalConditions: [String] },
        collectedAt: Date,
      }, { _id: false }),
    },

    triageLevel: { type: String, enum: ['emergency','urgent','routine','elective'] },
    triageConfidence: { type: Number, min: 0, max: 1 },
    triageRationale: String,
    requiresImmediateAttention: Boolean,
    triageFallback: Boolean,

    assignedDoctorId: { type: Schema.Types.ObjectId, ref: 'User' },
    appointmentDetails: {
      type: new Schema({
        operatoryId: String, operatoryName: String,
        date: String, startTime: String, endTime: String,
        notes: String, submittedAt: Date,
      }, { _id: false }),
    },
    notificationChannel: { type: String, enum: ['email','whatsapp','sms'] },

    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    noSlotAvailable: Boolean,
    notificationsDispatched: [{ notificationType: String, enqueuedAt: Date, _id: false }],
    consultationSummary: String,
    summaryFallback: Boolean,

    startedAt: { type: Date, required: true, default: () => new Date() },
    completedAt: Date,
    stageTimings: {
      type: [new Schema({
        agentName: String, startedAt: Date, completedAt: Date,
        durationMs: Number, outcome: { type: String, enum: ['success','failure','timeout'] },
      }, { _id: false })],
      default: [],
    },
  },
  { timestamps: true, versionKey: false },
);

agentSessionSchema.index({ patientId: 1, createdAt: -1 });
agentSessionSchema.index({ status: 1, createdAt: -1 });
agentSessionSchema.index({ assignedDoctorId: 1, status: 1 });
agentSessionSchema.index({ status: 1, updatedAt: 1 });

export const AgentSession: Model<IAgentSession> = model<IAgentSession>('AgentSession', agentSessionSchema);
