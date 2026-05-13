import { Schema, model, type Document, type Model } from 'mongoose';

export interface IAuditLog extends Document {
  _id: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  /**
   * Dot-notation action descriptor, e.g. 'patient.view', 'record.update'
   */
  action: string;
  resourceType: string;
  resourceId: Schema.Types.ObjectId;
  /**
   * @phi - Sensitive: IP address is PII
   */
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    resourceType: {
      type: String,
      required: true,
      trim: true,
    },
    resourceId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    ipAddress: {
      type: String,
      required: true,
      trim: true,
    },
    userAgent: {
      type: String,
      required: true,
      trim: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
  },
  {
    // AuditLog is immutable — no timestamps plugin, timestamp is explicit
    timestamps: false,
    versionKey: false,
  },
);

// Immutability: disable update and delete operations at the schema level
// The application layer must enforce this; the schema signals intent.
auditLogSchema.set('strict', true);

// Indexes for compliance queries (Property 5: Audit log completeness)
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });

export const AuditLog: Model<IAuditLog> = model<IAuditLog>('AuditLog', auditLogSchema);
