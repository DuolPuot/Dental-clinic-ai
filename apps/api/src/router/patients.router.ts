/**
 * Patients Router
 *
 * tRPC procedures for patient management:
 *   - patients.create       — register a new patient
 *   - patients.get          — retrieve a patient by ID
 *   - patients.update       — update patient fields
 *   - patients.softDelete   — soft-delete a patient (sets deletedAt)
 *   - patients.search       — search by name, DOB, phone, or patient ID
 *   - patients.getUploadUrl — generate a pre-signed S3 upload URL for X-rays
 *   - patients.getXrayUrl   — generate a pre-signed S3 download URL for an X-ray
 *   - patients.exportData   — export all patient data as JSON (admin only)
 *
 * All PHI access is logged to AuditLog.
 *
 * Requirements: 1.1.1, 1.1.2, 1.1.3, 1.1.4, 1.2.3, 3.2.1, 8.1.1, 8.1.3
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc/trpc.js';
import { requirePermission, requireRole } from '../middleware/rbac.js';
import {
  createPatient,
  getPatient,
  updatePatient,
  softDeletePatient,
  searchPatients,
  getUploadUrl,
  getXrayUrl,
  exportPatientData,
  ALLOWED_XRAY_MIME_TYPES,
  type AuditContext,
} from '../services/patient.service.js';

import type { Request } from 'express';

// ─── Helper: extract audit context from tRPC context ─────────────────────────

function getAuditContext(req: Request): Omit<AuditContext, 'userId'> {
  return {
    ipAddress:
      (req.headers['x-forwarded-for'] as string | undefined) ?? req.ip ?? 'unknown',
    userAgent: req.headers['user-agent'] ?? 'unknown',
  };
}

// ─── Input schemas ────────────────────────────────────────────────────────────

const createPatientInput = z.object({
  firstName: z.string().min(1, 'First name is required').max(100).trim(),
  lastName: z.string().min(1, 'Last name is required').max(100).trim(),
  dateOfBirth: z.coerce.date({ required_error: 'Date of birth is required' }),
  email: z.string().email('Invalid email address').max(255),
  phone: z.string().min(7, 'Phone number is required').max(30).trim(),
  insuranceProvider: z.string().max(200).trim().optional(),
  insurancePolicyNumber: z.string().max(100).trim().optional(),
  allergies: z.array(z.string().max(200)).default([]),
  medications: z.array(z.string().max(200)).default([]),
  medicalConditions: z.array(z.string().max(200)).default([]),
});

const getPatientInput = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
  includeDeleted: z.boolean().default(false),
});

const updatePatientInput = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
  firstName: z.string().min(1).max(100).trim().optional(),
  lastName: z.string().min(1).max(100).trim().optional(),
  dateOfBirth: z.coerce.date().optional(),
  email: z.string().email('Invalid email address').max(255).optional(),
  phone: z.string().min(7).max(30).trim().optional(),
  insuranceProvider: z.string().max(200).trim().optional(),
  insurancePolicyNumber: z.string().max(100).trim().optional(),
  allergies: z.array(z.string().max(200)).optional(),
  medications: z.array(z.string().max(200)).optional(),
  medicalConditions: z.array(z.string().max(200)).optional(),
});

const softDeleteInput = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
});

const searchPatientsInput = z.object({
  query: z.string().min(1, 'Search query is required').max(200).trim(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

const getUploadUrlInput = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
  fileName: z.string().min(1, 'File name is required').max(255),
  mimeType: z.enum(ALLOWED_XRAY_MIME_TYPES, {
    errorMap: () => ({
      message: `MIME type must be one of: ${ALLOWED_XRAY_MIME_TYPES.join(', ')}`,
    }),
  }),
});

const getXrayUrlInput = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
  s3Key: z.string().min(1, 'S3 key is required'),
});

const exportDataInput = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const patientsRouter = router({
  /**
   * POST /trpc/patients.create
   *
   * Register a new patient. Requires 'patients.write' permission.
   * Logs PHI access to AuditLog.
   *
   * Requirements: 1.1.1, 1.1.4, 8.1.1
   */
  create: protectedProcedure
    .use(requirePermission('patients', 'write'))
    .input(createPatientInput)
    .mutation(async ({ input, ctx }) => {
      const auditCtx: AuditContext = {
        ...getAuditContext(ctx.req),
        userId: ctx.userId!,
      };

      const patient = await createPatient(input, auditCtx);

      return {
        id: patient._id.toString(),
        firstName: patient.firstName,
        lastName: patient.lastName,
        dateOfBirth: patient.dateOfBirth,
        email: patient.email,
        phone: patient.phone,
        insuranceProvider: patient.insuranceProvider,
        insurancePolicyNumber: patient.insurancePolicyNumber,
        allergies: patient.allergies,
        medications: patient.medications,
        medicalConditions: patient.medicalConditions,
        createdAt: patient.createdAt,
        updatedAt: patient.updatedAt,
      };
    }),

  /**
   * GET /trpc/patients.get
   *
   * Retrieve a patient by ID. Requires 'patients.read' permission.
   * Soft-deleted patients are excluded unless `includeDeleted` is true (admin only).
   * Logs PHI access to AuditLog.
   *
   * Requirements: 1.1.2, 8.1.1
   */
  get: protectedProcedure
    .use(requirePermission('patients', 'read'))
    .input(getPatientInput)
    .query(async ({ input, ctx }) => {
      // Only admins may request soft-deleted records
      if (input.includeDeleted && ctx.userRole !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admins can view deleted patient records.',
        });
      }

      const auditCtx: AuditContext = {
        ...getAuditContext(ctx.req),
        userId: ctx.userId!,
      };

      const patient = await getPatient(input.patientId, auditCtx, input.includeDeleted);

      if (!patient) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Patient not found.',
        });
      }

      return {
        id: patient._id.toString(),
        firstName: patient.firstName,
        lastName: patient.lastName,
        dateOfBirth: patient.dateOfBirth,
        email: patient.email,
        phone: patient.phone,
        insuranceProvider: patient.insuranceProvider,
        insurancePolicyNumber: patient.insurancePolicyNumber,
        allergies: patient.allergies,
        medications: patient.medications,
        medicalConditions: patient.medicalConditions,
        createdAt: patient.createdAt,
        updatedAt: patient.updatedAt,
        deletedAt: patient.deletedAt,
      };
    }),

  /**
   * PATCH /trpc/patients.update
   *
   * Update patient fields. Requires 'patients.write' permission.
   * Logs PHI access to AuditLog.
   *
   * Requirements: 1.1.3, 8.1.1
   */
  update: protectedProcedure
    .use(requirePermission('patients', 'write'))
    .input(updatePatientInput)
    .mutation(async ({ input, ctx }) => {
      const { patientId, ...updateFields } = input;

      const auditCtx: AuditContext = {
        ...getAuditContext(ctx.req),
        userId: ctx.userId!,
      };

      const patient = await updatePatient(patientId, updateFields, auditCtx);

      if (!patient) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Patient not found or has been deleted.',
        });
      }

      return {
        id: patient._id.toString(),
        firstName: patient.firstName,
        lastName: patient.lastName,
        dateOfBirth: patient.dateOfBirth,
        email: patient.email,
        phone: patient.phone,
        insuranceProvider: patient.insuranceProvider,
        insurancePolicyNumber: patient.insurancePolicyNumber,
        allergies: patient.allergies,
        medications: patient.medications,
        medicalConditions: patient.medicalConditions,
        createdAt: patient.createdAt,
        updatedAt: patient.updatedAt,
      };
    }),

  /**
   * DELETE /trpc/patients.softDelete
   *
   * Soft-delete a patient (sets deletedAt). Requires 'patients.delete' permission.
   * The record is retained for compliance (Property 8).
   * Logs PHI access to AuditLog.
   *
   * Requirements: 1.1.3, 8.1.1, 8.1.4
   */
  softDelete: protectedProcedure
    .use(requirePermission('patients', 'delete'))
    .input(softDeleteInput)
    .mutation(async ({ input, ctx }) => {
      const auditCtx: AuditContext = {
        ...getAuditContext(ctx.req),
        userId: ctx.userId!,
      };

      const patient = await softDeletePatient(input.patientId, auditCtx);

      if (!patient) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Patient not found or already deleted.',
        });
      }

      return {
        id: patient._id.toString(),
        deletedAt: patient.deletedAt,
      };
    }),

  /**
   * GET /trpc/patients.search
   *
   * Search patients by name, DOB, phone, or patient ID.
   * Excludes soft-deleted patients (Property 8).
   * Requires 'patients.read' permission.
   * Logs PHI access to AuditLog.
   *
   * Requirements: 1.1.2, 8.1.1
   */
  search: protectedProcedure
    .use(requirePermission('patients', 'read'))
    .input(searchPatientsInput)
    .query(async ({ input, ctx }) => {
      const auditCtx: AuditContext = {
        ...getAuditContext(ctx.req),
        userId: ctx.userId!,
      };

      const result = await searchPatients(input, auditCtx);

      return {
        patients: result.patients.map((p) => ({
          id: p._id.toString(),
          firstName: p.firstName,
          lastName: p.lastName,
          dateOfBirth: p.dateOfBirth,
          email: p.email,
          phone: p.phone,
          insuranceProvider: p.insuranceProvider,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })),
        total: result.total,
        limit: input.limit,
        offset: input.offset,
      };
    }),

  /**
   * POST /trpc/patients.getUploadUrl
   *
   * Generate a pre-signed S3 upload URL for an X-ray file.
   * Validates MIME type (image/jpeg, image/png, application/dicom).
   * Requires 'patients.write' permission.
   * Logs PHI access to AuditLog.
   *
   * Requirements: 1.2.3, 3.2.1
   */
  getUploadUrl: protectedProcedure
    .use(requirePermission('patients', 'write'))
    .input(getUploadUrlInput)
    .mutation(async ({ input, ctx }) => {
      const auditCtx: AuditContext = {
        ...getAuditContext(ctx.req),
        userId: ctx.userId!,
      };

      try {
        const result = await getUploadUrl(input, auditCtx);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate upload URL.';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),

  /**
   * POST /trpc/patients.getXrayUrl
   *
   * Generate a pre-signed S3 download URL for an existing X-ray.
   * Requires 'patients.read' permission.
   * Logs PHI access to AuditLog.
   *
   * Requirements: 1.2.3, 3.2.1
   */
  getXrayUrl: protectedProcedure
    .use(requirePermission('patients', 'read'))
    .input(getXrayUrlInput)
    .mutation(async ({ input, ctx }) => {
      const auditCtx: AuditContext = {
        ...getAuditContext(ctx.req),
        userId: ctx.userId!,
      };

      try {
        const result = await getXrayUrl(input, auditCtx);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate X-ray URL.';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),

  /**
   * GET /trpc/patients.exportData
   *
   * Export all records for a patient as JSON.
   * Includes patient data, appointments, treatment plans, and invoices.
   * Admin-only.
   *
   * Requirements: 8.1.3
   */
  exportData: protectedProcedure
    .use(requireRole('admin'))
    .input(exportDataInput)
    .query(async ({ input, ctx }) => {
      const auditCtx: AuditContext = {
        ...getAuditContext(ctx.req),
        userId: ctx.userId!,
      };

      const result = await exportPatientData(input.patientId, auditCtx);

      if (!result.patient) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Patient not found.',
        });
      }

      return result;
    }),
});
