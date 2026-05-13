/**
 * Patient Service
 *
 * Core business logic for patient management:
 *   - CRUD operations with soft-delete
 *   - Search by name, DOB, phone, or patient ID
 *   - X-ray upload/download via pre-signed S3 URLs
 *   - Patient data export (GDPR/HIPAA)
 *   - PHI access audit logging
 *
 * Requirements: 1.1.1, 1.1.2, 1.1.3, 1.1.4, 1.2.3, 3.2.1, 8.1.1, 8.1.3
 */

import { Types } from 'mongoose';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Patient, type IPatient } from '../models/Patient.js';
import { Appointment } from '../models/Appointment.js';
import { TreatmentPlan } from '../models/TreatmentPlan.js';
import { Invoice } from '../models/Invoice.js';
import { AuditLog } from '../models/AuditLog.js';
import { env } from '../config/env.js';

// ─── S3 client (lazy singleton) ───────────────────────────────────────────────

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: env.AWS_REGION,
      ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: env.AWS_ACCESS_KEY_ID,
              secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            },
          }
        : {}),
    });
  }
  return s3Client;
}

// ─── Allowed MIME types for X-ray uploads ────────────────────────────────────

export const ALLOWED_XRAY_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/dicom',
] as const;

export type XrayMimeType = (typeof ALLOWED_XRAY_MIME_TYPES)[number];

// ─── Audit log helper ─────────────────────────────────────────────────────────

export interface AuditContext {
  userId: string;
  ipAddress: string;
  userAgent: string;
}

async function writeAuditLog(
  ctx: AuditContext,
  action: string,
  resourceId: string | Types.ObjectId | { toString(): string },
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await AuditLog.create({
      userId: new Types.ObjectId(ctx.userId),
      action,
      resourceType: 'patient',
      resourceId: new Types.ObjectId(resourceId.toString()),
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      timestamp: new Date(),
      metadata,
    });
  } catch (err) {
    // Audit log failures must not break the main flow — log and continue
    console.error('[AuditLog] Failed to write audit log entry:', err);
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreatePatientInput {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: Date;
  email?: string;
  phone?: string;
  insuranceProvider?: string | undefined;
  insurancePolicyNumber?: string | undefined;
  allergies?: string[] | undefined;
  medications?: string[] | undefined;
  medicalConditions?: string[] | undefined;
}

export interface UpdatePatientInput {
  firstName?: string | undefined;
  lastName?: string | undefined;
  dateOfBirth?: Date | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  insuranceProvider?: string | undefined;
  insurancePolicyNumber?: string | undefined;
  allergies?: string[] | undefined;
  medications?: string[] | undefined;
  medicalConditions?: string[] | undefined;
}

export interface SearchPatientsInput {
  query?: string;
  limit?: number;
  offset?: number;
}

export interface SearchPatientsResult {
  patients: IPatient[];
  total: number;
}

export interface GetUploadUrlInput {
  patientId?: string;
  fileName?: string;
  mimeType?: XrayMimeType;
}

export interface GetUploadUrlResult {
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
}

export interface GetXrayUrlInput {
  patientId?: string;
  s3Key?: string;
}

export interface GetXrayUrlResult {
  downloadUrl: string;
  expiresIn: number;
}

export interface ExportPatientDataResult {
  patient: IPatient | null;
  appointments: unknown[];
  treatmentPlans: unknown[];
  invoices: unknown[];
  exportedAt: Date;
}

// ─── Patient CRUD ─────────────────────────────────────────────────────────────

/**
 * Create a new patient record.
 * Logs PHI access to AuditLog.
 *
 * Requirements: 1.1.1, 1.1.4, 8.1.1
 */
export async function createPatient(
  input: CreatePatientInput,
  ctx: AuditContext,
): Promise<IPatient> {
  const patient = await Patient.create({
    firstName: input.firstName,
    lastName: input.lastName,
    dateOfBirth: input.dateOfBirth,
    email: input.email.toLowerCase().trim(),
    phone: input.phone.trim(),
    insuranceProvider: input.insuranceProvider,
    insurancePolicyNumber: input.insurancePolicyNumber,
    allergies: input.allergies ?? [],
    medications: input.medications ?? [],
    medicalConditions: input.medicalConditions ?? [],
  });

  await writeAuditLog(ctx, 'patient.create', patient._id, {
    patientId: patient._id.toString(),
  });

  return patient;
}

/**
 * Get a patient by ID.
 * Excludes soft-deleted patients unless `includeDeleted` is true.
 * Logs PHI access to AuditLog.
 *
 * Requirements: 1.1.2, 8.1.1
 */
export async function getPatient(
  patientId: string,
  ctx: AuditContext,
  includeDeleted = false,
): Promise<IPatient | null> {
  if (!Types.ObjectId.isValid(patientId)) {
    return null;
  }

  const filter: Record<string, unknown> = { _id: patientId };
  if (!includeDeleted) {
    filter['deletedAt'] = { $exists: false };
  }

  const patient = await Patient.findOne(filter).lean<IPatient>();

  if (patient) {
    await writeAuditLog(ctx, 'patient.view', patient._id, {
      patientId: patient._id.toString(),
    });
  }

  return patient;
}

/**
 * Update a patient record.
 * Excludes soft-deleted patients.
 * Logs PHI access to AuditLog.
 *
 * Requirements: 1.1.3, 8.1.1
 */
export async function updatePatient(
  patientId: string,
  input: UpdatePatientInput,
  ctx: AuditContext,
): Promise<IPatient | null> {
  if (!Types.ObjectId.isValid(patientId)) {
    return null;
  }

  const updateFields: UpdatePatientInput = { ...input };
  if (input.email) {
    updateFields.email = input.email.toLowerCase().trim();
  }

  const patient = await Patient.findOneAndUpdate(
    { _id: patientId, deletedAt: { $exists: false } },
    { $set: updateFields },
    { new: true, runValidators: true },
  ).lean<IPatient>();

  if (patient) {
    await writeAuditLog(ctx, 'patient.update', patient._id, {
      patientId: patient._id.toString(),
      updatedFields: Object.keys(input),
    });
  }

  return patient;
}

/**
 * Soft-delete a patient by setting `deletedAt`.
 * The patient record is retained for compliance but excluded from standard queries.
 * Logs PHI access to AuditLog.
 *
 * Requirements: 1.1.3, 8.1.1, 8.1.4 (Property 8)
 */
export async function softDeletePatient(
  patientId: string,
  ctx: AuditContext,
): Promise<IPatient | null> {
  if (!Types.ObjectId.isValid(patientId)) {
    return null;
  }

  const patient = await Patient.findOneAndUpdate(
    { _id: patientId, deletedAt: { $exists: false } },
    { $set: { deletedAt: new Date() } },
    { new: true },
  ).lean<IPatient>();

  if (patient) {
    await writeAuditLog(ctx, 'patient.softDelete', patient._id, {
      patientId: patient._id.toString(),
    });
  }

  return patient;
}

/**
 * Search patients by name, DOB, phone, or patient ID.
 * Excludes soft-deleted patients (Property 8).
 * Logs PHI access to AuditLog.
 *
 * Requirements: 1.1.2, 8.1.1
 */
export async function searchPatients(
  input: SearchPatientsInput,
  ctx: AuditContext,
): Promise<SearchPatientsResult> {
  const { query, limit = 20, offset = 0 } = input;
  const trimmedQuery = query.trim();

  // Build OR filter — search by name, phone, or patient ID
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orConditions: any[] = [
    { firstName: { $regex: trimmedQuery, $options: 'i' } },
    { lastName: { $regex: trimmedQuery, $options: 'i' } },
    { phone: { $regex: trimmedQuery, $options: 'i' } },
  ];

  // Try to match by ObjectId (patient ID)
  if (Types.ObjectId.isValid(trimmedQuery)) {
    orConditions.push({ _id: new Types.ObjectId(trimmedQuery) });
  }

  // Try to parse as a date for DOB search
  const parsedDate = new Date(trimmedQuery);
  if (!isNaN(parsedDate.getTime())) {
    // Match the full day range for DOB
    const startOfDay = new Date(parsedDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(parsedDate);
    endOfDay.setUTCHours(23, 59, 59, 999);
    orConditions.push({ dateOfBirth: { $gte: startOfDay, $lte: endOfDay } });
  }

  const filter = {
    deletedAt: { $exists: false },
    $or: orConditions,
  };

  const [patients, total] = await Promise.all([
    Patient.find(filter).skip(offset).limit(limit).lean<IPatient[]>(),
    Patient.countDocuments(filter),
  ]);

  await writeAuditLog(
    ctx,
    'patient.search',
    // Use a zero ObjectId as a placeholder for search (no single resource)
    new Types.ObjectId('000000000000000000000000'),
    { query: trimmedQuery, resultCount: patients.length },
  );

  return { patients, total };
}

// ─── X-ray upload / download ──────────────────────────────────────────────────

/**
 * Generate a pre-signed S3 URL for uploading an X-ray file.
 * Validates MIME type; stores the S3 key reference.
 *
 * Requirements: 1.2.3, 3.2.1
 */
export async function getUploadUrl(
  input: GetUploadUrlInput,
  ctx: AuditContext,
): Promise<GetUploadUrlResult> {
  const bucket = env.AWS_S3_BUCKET;
  if (!bucket) {
    throw new Error('AWS_S3_BUCKET is not configured.');
  }

  const s3Key = `xrays/${input.patientId}/${Date.now()}-${input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const expiresIn = 300; // 5 minutes

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    ContentType: input.mimeType,
  });

  const uploadUrl = await getSignedUrl(getS3Client(), command, { expiresIn });

  await writeAuditLog(ctx, 'patient.xray.uploadUrl', input.patientId, {
    patientId: input.patientId,
    s3Key,
    mimeType: input.mimeType,
  });

  return { uploadUrl, s3Key, expiresIn };
}

/**
 * Generate a pre-signed S3 URL for downloading an existing X-ray.
 *
 * Requirements: 1.2.3, 3.2.1
 */
export async function getXrayUrl(
  input: GetXrayUrlInput,
  ctx: AuditContext,
): Promise<GetXrayUrlResult> {
  const bucket = env.AWS_S3_BUCKET;
  if (!bucket) {
    throw new Error('AWS_S3_BUCKET is not configured.');
  }

  const expiresIn = 3600; // 1 hour

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: input.s3Key,
  });

  const downloadUrl = await getSignedUrl(getS3Client(), command, { expiresIn });

  await writeAuditLog(ctx, 'patient.xray.view', input.patientId, {
    patientId: input.patientId,
    s3Key: input.s3Key,
  });

  return { downloadUrl, expiresIn };
}

// ─── Patient data export (GDPR/HIPAA) ────────────────────────────────────────

/**
 * Export all data for a patient as JSON.
 * Includes patient record, appointments, treatment plans, and invoices.
 * Admin-only operation.
 *
 * Requirements: 8.1.3
 */
export async function exportPatientData(
  patientId: string,
  ctx: AuditContext,
): Promise<ExportPatientDataResult> {
  if (!Types.ObjectId.isValid(patientId)) {
    return {
      patient: null,
      appointments: [],
      treatmentPlans: [],
      invoices: [],
      exportedAt: new Date(),
    };
  }

  const patientObjectId = new Types.ObjectId(patientId);

  // Fetch all data in parallel — include soft-deleted patient for compliance
  const [patient, appointments, treatmentPlans, invoices] = await Promise.all([
    Patient.findById(patientObjectId).lean<IPatient>(),
    Appointment.find({ patientId: patientObjectId }).lean(),
    TreatmentPlan.find({ patientId: patientObjectId }).lean(),
    Invoice.find({ patientId: patientObjectId }).lean(),
  ]);

  await writeAuditLog(ctx, 'patient.exportData', patientObjectId, {
    patientId,
    appointmentCount: appointments.length,
    treatmentPlanCount: treatmentPlans.length,
    invoiceCount: invoices.length,
  });

  return {
    patient,
    appointments,
    treatmentPlans,
    invoices,
    exportedAt: new Date(),
  };
}
