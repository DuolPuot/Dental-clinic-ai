/**
 * Appointments Router
 *
 * tRPC procedures for appointment scheduling:
 *   - appointments.getAvailability   — free slots for a dentist/operatory
 *   - appointments.create            — book an appointment (staff)
 *   - appointments.update            — reschedule or update status
 *   - appointments.cancel            — cancel with reason
 *   - appointments.get               — get single appointment
 *   - appointments.getCalendar       — dentist calendar view
 *   - appointments.getPublicAvailability — public slot query (no auth)
 *   - appointments.bookPublic        — patient portal booking (no auth)
 *
 * Requirements: 2.1.1–2.1.5, 2.2.1–2.2.3
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, publicProcedure } from '../trpc/trpc.js';
import { requirePermission } from '../middleware/rbac.js';
import {
  getAvailability,
  createAppointment,
  updateAppointment,
  cancelAppointment,
  getAppointment,
  getCalendar,
  publicBookAppointment,
  type AppointmentType,
} from '../services/appointment.service.js';
import type { AuditContext } from '../services/patient.service.js';
import type { Request } from 'express';

// ─── Helper ───────────────────────────────────────────────────────────────────

function getAuditContext(req: Request, userId: string): AuditContext {
  return {
    userId,
    ipAddress:
      (req.headers['x-forwarded-for'] as string | undefined) ?? req.ip ?? 'unknown',
    userAgent: req.headers['user-agent'] ?? 'unknown',
  };
}

// ─── Shared schemas ───────────────────────────────────────────────────────────

const appointmentTypeEnum = z.enum([
  'cleaning',
  'checkup',
  'filling',
  'extraction',
  'root_canal',
  'crown',
  'whitening',
  'consultation',
  'emergency',
  'other',
]);

const appointmentStatusEnum = z.enum([
  'scheduled',
  'confirmed',
  'completed',
  'cancelled',
  'no-show',
]);

// ─── Router ───────────────────────────────────────────────────────────────────

export const appointmentsRouter = router({
  /**
   * GET /trpc/appointments.getAvailability
   * Returns free time slots for a dentist within a time window.
   * Requirements: 2.1.1
   */
  getAvailability: protectedProcedure
    .use(requirePermission('appointments', 'read'))
    .input(
      z.object({
        dentistId: z.string().min(1),
        operatoryId: z.string().optional(),
        from: z.coerce.date(),
        to: z.coerce.date(),
        slotDurationMinutes: z.number().int().min(15).max(240).default(30),
      }),
    )
    .query(async ({ input }) => {
      const slots = await getAvailability(input);
      return { slots };
    }),

  /**
   * POST /trpc/appointments.create
   * Book an appointment with conflict detection.
   * Requirements: 2.1.2, 2.1.3
   */
  create: protectedProcedure
    .use(requirePermission('appointments', 'write'))
    .input(
      z.object({
        patientId: z.string().min(1),
        dentistId: z.string().min(1),
        operatoryId: z.string().min(1),
        appointmentType: appointmentTypeEnum,
        startTime: z.coerce.date(),
        endTime: z.coerce.date(),
        notes: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const auditCtx = getAuditContext(ctx.req, ctx.userId!);
      try {
        const appointment = await createAppointment(input, auditCtx);
        return serializeAppointment(appointment);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create appointment.';
        if (msg.startsWith('CONFLICT:')) {
          throw new TRPCError({ code: 'CONFLICT', message: msg });
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: msg });
      }
    }),

  /**
   * PATCH /trpc/appointments.update
   * Update appointment fields; re-checks conflicts on reschedule.
   * Requirements: 2.1.3
   */
  update: protectedProcedure
    .use(requirePermission('appointments', 'write'))
    .input(
      z.object({
        appointmentId: z.string().min(1),
        appointmentType: appointmentTypeEnum.optional(),
        startTime: z.coerce.date().optional(),
        endTime: z.coerce.date().optional(),
        status: appointmentStatusEnum.optional(),
        notes: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const auditCtx = getAuditContext(ctx.req, ctx.userId!);
      try {
        const appointment = await updateAppointment(input, auditCtx);
        if (!appointment) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Appointment not found.' });
        }
        return serializeAppointment(appointment);
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : 'Failed to update appointment.';
        if (msg.startsWith('CONFLICT:')) {
          throw new TRPCError({ code: 'CONFLICT', message: msg });
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: msg });
      }
    }),

  /**
   * POST /trpc/appointments.cancel
   * Cancel an appointment atomically.
   * Requirements: 2.1.5
   */
  cancel: protectedProcedure
    .use(requirePermission('appointments', 'write'))
    .input(
      z.object({
        appointmentId: z.string().min(1),
        cancellationReason: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const auditCtx = getAuditContext(ctx.req, ctx.userId!);
      const appointment = await cancelAppointment(input, auditCtx);
      if (!appointment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Appointment not found or already cancelled/completed.',
        });
      }
      return serializeAppointment(appointment);
    }),

  /**
   * GET /trpc/appointments.get
   * Retrieve a single appointment by ID.
   */
  get: protectedProcedure
    .use(requirePermission('appointments', 'read'))
    .input(z.object({ appointmentId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const auditCtx = getAuditContext(ctx.req, ctx.userId!);
      const appointment = await getAppointment(input.appointmentId, auditCtx);
      if (!appointment) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Appointment not found.' });
      }
      return serializeAppointment(appointment);
    }),

  /**
   * GET /trpc/appointments.getCalendar
   * Dentist calendar view for a date range.
   */
  getCalendar: protectedProcedure
    .use(requirePermission('appointments', 'read'))
    .input(
      z.object({
        dentistId: z.string().min(1),
        from: z.coerce.date(),
        to: z.coerce.date(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const auditCtx = getAuditContext(ctx.req, ctx.userId!);
      const appointments = await getCalendar(input.dentistId, input.from, input.to, auditCtx);
      return { appointments: appointments.map(serializeAppointment) };
    }),

  /**
   * GET /trpc/appointments.getPublicAvailability
   * Public slot query — no authentication required.
   * Requirements: 2.2.1
   */
  getPublicAvailability: publicProcedure
    .input(
      z.object({
        dentistId: z.string().min(1),
        operatoryId: z.string().optional(),
        from: z.coerce.date(),
        to: z.coerce.date(),
        slotDurationMinutes: z.number().int().min(15).max(240).default(30),
      }),
    )
    .query(async ({ input }) => {
      const slots = await getAvailability(input);
      return { slots };
    }),

  /**
   * GET /trpc/appointments.getPublicDentists
   * Returns list of active dentists for the patient booking form.
   */
  getPublicDentists: publicProcedure.query(async () => {
    const { User } = await import('../models/User.js');
    const { Role } = await import('../models/Role.js');
    const dentistRole = await Role.findOne({ name: 'dentist' }).lean();
    if (!dentistRole) return { dentists: [] };
    const dentists = await User.find({ role: dentistRole._id, isActive: true, deletedAt: { $exists: false } })
      .select('firstName lastName')
      .lean();
    return {
      dentists: dentists.map(d => ({
        id: d._id.toString(),
        name: `Dr. ${d.firstName} ${d.lastName}`,
      })),
    };
  }),

  /**
   * GET /trpc/appointments.getPublicOperatories
   * Returns list of active operatories for the patient booking form.
   */
  getPublicOperatories: publicProcedure.query(async () => {
    const { Operatory } = await import('../models/Operatory.js');
    const ops = await Operatory.find({ isActive: true }).select('name').lean();
    return {
      operatories: ops.map(o => ({ id: o._id.toString(), name: o.name })),
    };
  }),

  /**
   * POST /trpc/appointments.bookPublic
   * Patient portal booking — no authentication required.
   * Requirements: 2.2.2, 2.2.3
   */
  bookPublic: publicProcedure
    .input(
      z.object({
        patientId: z.string().min(1),
        dentistId: z.string().min(1),
        operatoryId: z.string().min(1),
        appointmentType: appointmentTypeEnum,
        startTime: z.coerce.date(),
        endTime: z.coerce.date(),
        patientEmail: z.string().email(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const appointment = await publicBookAppointment(input);
        return serializeAppointment(appointment);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to book appointment.';
        if (msg.startsWith('CONFLICT:')) {
          throw new TRPCError({ code: 'CONFLICT', message: msg });
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: msg });
      }
    }),
});

// ─── Serializer ───────────────────────────────────────────────────────────────

function serializeAppointment(a: {
  _id: { toString(): string };
  patientId: { toString(): string };
  dentistId: { toString(): string };
  operatoryId: { toString(): string };
  appointmentType: AppointmentType;
  startTime: Date;
  endTime: Date;
  status: string;
  cancellationReason?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: a._id.toString(),
    patientId: a.patientId.toString(),
    dentistId: a.dentistId.toString(),
    operatoryId: a.operatoryId.toString(),
    appointmentType: a.appointmentType,
    startTime: a.startTime,
    endTime: a.endTime,
    status: a.status,
    cancellationReason: a.cancellationReason,
    notes: a.notes,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}
