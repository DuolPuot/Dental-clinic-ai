/**
 * Mongoose model exports.
 *
 * PHI fields are annotated with @phi in their respective schema files.
 * MongoDB field-level encryption should be configured for all @phi fields
 * using the MongoDB CSFLE (Client-Side Field Level Encryption) driver
 * with a KMS-managed data key before deploying to production.
 *
 * Soft-delete: Patient and User have a `deletedAt` field.
 * Standard queries MUST filter `{ deletedAt: { $exists: false } }` or
 * `{ deletedAt: null }` to exclude soft-deleted records.
 * Admin queries may omit this filter to retrieve deleted records.
 */

export { Role, ROLE_NAMES } from './Role.js';
export type { IRole, RoleName, PermissionMap } from './Role.js';

export { User } from './User.js';
export type { IUser } from './User.js';

export { Patient } from './Patient.js';
export type { IPatient } from './Patient.js';

export { Operatory } from './Operatory.js';
export type { IOperatory } from './Operatory.js';

export { Appointment, APPOINTMENT_TYPES, APPOINTMENT_STATUSES } from './Appointment.js';
export type { IAppointment, AppointmentType, AppointmentStatus } from './Appointment.js';

export {
  TreatmentPlan,
  TREATMENT_PLAN_STATUSES,
  TREATMENT_STEP_STATUSES,
} from './TreatmentPlan.js';
export type {
  ITreatmentPlan,
  ITreatmentStep,
  TreatmentPlanStatus,
  TreatmentStepStatus,
} from './TreatmentPlan.js';

export { FeeSchedule } from './FeeSchedule.js';
export type { IFeeSchedule } from './FeeSchedule.js';

export { Invoice, INVOICE_STATUSES } from './Invoice.js';
export type { IInvoice, IInvoiceLineItem, InvoiceStatus } from './Invoice.js';

export { Notification, NOTIFICATION_TYPES, NOTIFICATION_CHANNELS, NOTIFICATION_STATUSES } from './Notification.js';
export type {
  INotification,
  NotificationType,
  NotificationChannel,
  NotificationStatus,
} from './Notification.js';

export { AuditLog } from './AuditLog.js';
export type { IAuditLog } from './AuditLog.js';

export { AgentSession } from './AgentSession.js';
export type { IAgentSession, AgentName, AgentStage, SessionStatus, TriageLevel } from './AgentSession.js';
