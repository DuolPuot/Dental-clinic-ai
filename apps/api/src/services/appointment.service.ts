import { Types } from 'mongoose';
import { Appointment, type IAppointment, type AppointmentType } from '../models/Appointment.js';
import { AuditLog } from '../models/AuditLog.js';

interface AuditCtx { userId: string; ipAddress: string; userAgent: string; }

export function writeAuditLog(ctx: AuditCtx, action: string, resourceId: string, metadata?: Record<string, unknown>): void {
  AuditLog.create({ userId: new Types.ObjectId(ctx.userId), action, resourceType: 'appointment', resourceId: new Types.ObjectId(resourceId), ipAddress: ctx.ipAddress, userAgent: ctx.userAgent, timestamp: new Date(), metadata }).catch((e: unknown) => console.error('[AuditLog]', e));
}

async function hasConflict(dentistId: string, operatoryId: string, startTime: Date, endTime: Date, excludeId?: string): Promise<boolean> {
  const f: Record<string, unknown> = { status: { $nin: ['cancelled'] }, $or: [{ dentistId: new Types.ObjectId(dentistId) }, { operatoryId: new Types.ObjectId(operatoryId) }], startTime: { $lt: endTime }, endTime: { $gt: startTime } };
  if (excludeId) f._id = { $ne: new Types.ObjectId(excludeId) };
  return (await Appointment.countDocuments(f)) > 0;
}

export async function getAvailability(input: { dentistId: string; operatoryId?: string; from: Date; to: Date; slotDurationMinutes?: number }): Promise<{ startTime: Date; endTime: Date }[]> {
  const { dentistId, operatoryId, from, to, slotDurationMinutes = 30 } = input;
  const f: Record<string, unknown> = { dentistId: new Types.ObjectId(dentistId), status: { $nin: ['cancelled'] }, startTime: { $lt: to }, endTime: { $gt: from } };
  if (operatoryId) f.operatoryId = new Types.ObjectId(operatoryId);
  const booked = await Appointment.find(f).select('startTime endTime').lean<Pick<IAppointment, 'startTime' | 'endTime'>[]>();
  const slots: { startTime: Date; endTime: Date }[] = [];
  const slotMs = slotDurationMinutes * 60 * 1000;
  let cursor = new Date(from);
  while (cursor.getTime() + slotMs <= to.getTime()) {
    const slotEnd = new Date(cursor.getTime() + slotMs);
    if (!booked.some(b => b.startTime < slotEnd && b.endTime > cursor)) slots.push({ startTime: new Date(cursor), endTime: slotEnd });
    cursor = new Date(cursor.getTime() + slotMs);
  }
  return slots;
}

export async function createAppointment(input: { patientId: string; dentistId: string; operatoryId: string; appointmentType: AppointmentType; startTime: Date; endTime: Date; notes?: string }, ctx: AuditCtx): Promise<IAppointment> {
  if (await hasConflict(input.dentistId, input.operatoryId, input.startTime, input.endTime)) throw new Error('CONFLICT: The requested time slot is not available.');
  const appt = await Appointment.create({ patientId: new Types.ObjectId(input.patientId), dentistId: new Types.ObjectId(input.dentistId), operatoryId: new Types.ObjectId(input.operatoryId), appointmentType: input.appointmentType, startTime: input.startTime, endTime: input.endTime, status: 'scheduled', notes: input.notes });
  writeAuditLog(ctx, 'appointment.create', appt._id.toString(), { patientId: input.patientId });
  return appt;
}

export async function updateAppointment(input: { appointmentId: string; appointmentType?: AppointmentType; startTime?: Date; endTime?: Date; status?: string; notes?: string }, ctx: AuditCtx): Promise<IAppointment | null> {
  if (!Types.ObjectId.isValid(input.appointmentId)) return null;
  const existing = await Appointment.findById(input.appointmentId).lean<IAppointment>();
  if (!existing) return null;
  if (input.startTime || input.endTime) {
    const ns = input.startTime ?? existing.startTime, ne = input.endTime ?? existing.endTime;
    if (await hasConflict(existing.dentistId.toString(), existing.operatoryId.toString(), ns, ne, input.appointmentId)) throw new Error('CONFLICT: The requested time slot is not available.');
  }
  const { appointmentId, ...fields } = input;
  const updated = await Appointment.findByIdAndUpdate(appointmentId, { $set: fields }, { new: true, runValidators: true }).lean<IAppointment>();
  if (updated) writeAuditLog(ctx, 'appointment.update', updated._id.toString(), { appointmentId });
  return updated;
}

export async function cancelAppointment(input: { appointmentId: string; cancellationReason: string }, ctx: AuditCtx): Promise<IAppointment | null> {
  if (!Types.ObjectId.isValid(input.appointmentId)) return null;
  const appt = await Appointment.findOneAndUpdate({ _id: input.appointmentId, status: { $nin: ['cancelled', 'completed'] } }, { $set: { status: 'cancelled', cancellationReason: input.cancellationReason } }, { new: true }).lean<IAppointment>();
  if (appt) writeAuditLog(ctx, 'appointment.cancel', appt._id.toString(), { reason: input.cancellationReason });
  return appt;
}

export async function getAppointment(appointmentId: string, ctx: AuditCtx): Promise<IAppointment | null> {
  if (!Types.ObjectId.isValid(appointmentId)) return null;
  const appt = await Appointment.findById(appointmentId).lean<IAppointment>();
  if (appt) writeAuditLog(ctx, 'appointment.view', appt._id.toString(), { appointmentId });
  return appt;
}

export async function getCalendar(dentistId: string, from: Date, to: Date, ctx: AuditCtx): Promise<IAppointment[]> {
  const appts = await Appointment.find({ dentistId: new Types.ObjectId(dentistId), startTime: { $gte: from }, endTime: { $lte: to } }).sort({ startTime: 1 }).lean<IAppointment[]>();
  writeAuditLog(ctx, 'appointment.calendar', '000000000000000000000000', { dentistId, from, to, count: appts.length });
  return appts;
}

export async function publicBookAppointment(input: { patientId: string; dentistId: string; operatoryId: string; appointmentType: AppointmentType; startTime: Date; endTime: Date }): Promise<IAppointment> {
  if (await hasConflict(input.dentistId, input.operatoryId, input.startTime, input.endTime)) throw new Error('CONFLICT: The requested time slot is not available.');
  return Appointment.create({ patientId: new Types.ObjectId(input.patientId), dentistId: new Types.ObjectId(input.dentistId), operatoryId: new Types.ObjectId(input.operatoryId), appointmentType: input.appointmentType, startTime: input.startTime, endTime: input.endTime, status: 'scheduled' });
}

export async function getAppointmentsDueForReminder(): Promise<IAppointment[]> {
  const now = new Date();
  return Appointment.find({ startTime: { $gte: new Date(now.getTime() + 23 * 3600000), $lte: new Date(now.getTime() + 25 * 3600000) }, status: { $in: ['scheduled', 'confirmed'] }, reminderSentAt: { $exists: false } }).lean<IAppointment[]>();
}

export async function markReminderSent(appointmentId: string): Promise<void> {
  await Appointment.findByIdAndUpdate(appointmentId, { $set: { reminderSentAt: new Date() } });
}

export type { AppointmentType };
