// @ts-nocheck
import { Schema, model, type Document, type Model } from 'mongoose';

export const APPOINTMENT_TYPES = [
  'checkup',
  'cleaning',
  'filling',
  'extraction',
  'root_canal',
  'crown',
  'bridge',
  'implant',
  'orthodontics',
  'whitening',
  'emergency',
  'consultation',
  'x_ray',
  'other',
] as const;

export type AppointmentType = (typeof APPOINTMENT_TYPES)[number];

export const APPOINTMENT_STATUSES = [
  'scheduled',
  'confirmed',
  'completed',
  'cancelled',
  'no-show',
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export interface IAppointment extends Document {
  _id: Schema.Types.ObjectId;
  patientId: Schema.Types.ObjectId;
  /** Reference to User with role 'dentist' */
  dentistId: Schema.Types.ObjectId;
  operatoryId: Schema.Types.ObjectId;
  appointmentType: AppointmentType;
  startTime: Date;
  endTime: Date;
  status: AppointmentStatus;
  cancellationReason?: string;
  notes?: string;
  reminderSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const appointmentSchema = new Schema<IAppointment>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    dentistId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    operatoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Operatory',
      required: true,
    },
    appointmentType: {
      type: String,
      enum: APPOINTMENT_TYPES,
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: APPOINTMENT_STATUSES,
      required: true,
      default: 'scheduled',
    },
    cancellationReason: {
      type: String,
      trim: true,
      default: undefined,
    },
    notes: {
      type: String,
      trim: true,
      default: undefined,
    },
    reminderSentAt: {
      type: Date,
      default: undefined,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Indexes for conflict detection (Property 1: No double-booking)
appointmentSchema.index({ dentistId: 1, startTime: 1, endTime: 1 });
appointmentSchema.index({ operatoryId: 1, startTime: 1, endTime: 1 });
// Index for patient appointment history
appointmentSchema.index({ patientId: 1, startTime: -1 });
// Index for reminder cron job (query by startTime range + status)
appointmentSchema.index({ startTime: 1, status: 1 });

export const Appointment: Model<IAppointment> = model<IAppointment>(
  'Appointment',
  appointmentSchema,
);
