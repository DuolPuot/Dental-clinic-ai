import { Schema, model, type Document, type Model } from 'mongoose';

export const NOTIFICATION_TYPES = [
  'appointment_reminder',
  'appointment_confirmation',
  'appointment_cancellation',
  'treatment_plan_ready',
  'treatment_plan_approved',
  'invoice_sent',
  'invoice_overdue',
  'post_visit_followup',
  'general',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_CHANNELS = ['email', 'sms', 'whatsapp'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = ['pending', 'sent', 'failed', 'cancelled'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export interface INotification extends Document {
  _id: Schema.Types.ObjectId;
  patientId: Schema.Types.ObjectId;
  type: NotificationType;
  channel: NotificationChannel;
  status: NotificationStatus;
  to?: string;
  templateData?: Record<string, unknown>;
  sentAt?: Date;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    channel: {
      type: String,
      enum: NOTIFICATION_CHANNELS,
      required: true,
    },
    status: {
      type: String,
      enum: NOTIFICATION_STATUSES,
      required: true,
      default: 'pending',
    },
    sentAt: {
      type: Date,
      default: undefined,
    },
    to: {
      type: String,
      default: undefined,
    },
    templateData: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
  },
  {
    // Notification only has createdAt per design spec
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

// Index for per-patient notification log
notificationSchema.index({ patientId: 1, createdAt: -1 });
// Index for deduplication checks (Property 6: Reminder deduplication)
notificationSchema.index({ patientId: 1, type: 1, channel: 1, status: 1 });

export const Notification: Model<INotification> = model<INotification>(
  'Notification',
  notificationSchema,
);
