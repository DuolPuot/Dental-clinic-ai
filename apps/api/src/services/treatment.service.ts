/**
 * Treatment Planning Service
 *
 * Business logic for treatment plans:
 *   - CRUD with embedded steps
 *   - Cost computation from FeeSchedule (Property 3)
 *   - Patient approval flow via signed token
 *
 * Requirements: 4.1.1–4.1.4
 */

import { Types } from 'mongoose';
import crypto from 'crypto';
import { TreatmentPlan, type ITreatmentPlan } from '../models/TreatmentPlan.js';
import { FeeSchedule } from '../models/FeeSchedule.js';
import { AuditLog } from '../models/AuditLog.js';
import type { AuditContext } from './patient.service.js';

// ─── Audit log helper ─────────────────────────────────────────────────────────
// Fire-and-forget on all read paths — never block the response on audit writes.

function writeAuditLog(
  ctx: AuditContext,
  action: string,
  resourceId: string | Types.ObjectId,
  metadata?: Record<string, unknown>,
): void {
  AuditLog.create({
    userId: new Types.ObjectId(ctx.userId),
    action,
    resourceType: 'treatmentPlan',
    resourceId: new Types.ObjectId(resourceId.toString()),
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    timestamp: new Date(),
    metadata,
  }).catch(err => console.error('[AuditLog] Failed to write audit log entry:', err));
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TreatmentStepInput {
  cdtCode: string;
  description: string;
}

export interface CreatePlanInput {
  patientId: string;
  dentistId: string;
  title: string;
  steps: TreatmentStepInput[];
}

export interface UpdatePlanInput {
  planId: string;
  title?: string;
  status?: 'draft' | 'pending_approval' | 'approved' | 'in_progress' | 'completed';
}

export interface UpdateStepInput {
  planId: string;
  stepId: string;
  status: 'planned' | 'in_progress' | 'completed';
}

// ─── Cost computation (Property 3) ───────────────────────────────────────────
// Fetch all CDT codes in a single query instead of one query per step.

async function computeStepCosts(
  steps: { cdtCode: string }[],
): Promise<Map<string, number>> {
  const codes = [...new Set(steps.map(s => s.cdtCode))];
  const fees = await FeeSchedule.find({ cdtCode: { $in: codes } })
    .select('cdtCode price')
    .lean<{ cdtCode: string; price: number }[]>();
  const map = new Map<string, number>();
  for (const f of fees) map.set(f.cdtCode, f.price);
  return map;
}

// ─── Create plan ──────────────────────────────────────────────────────────────

/**
 * Create a treatment plan with cost estimation from FeeSchedule.
 * Property 3: totalEstimatedCost = sum(steps[i].estimatedCost)
 *
 * Requirements: 4.1.1, 4.1.3
 */
export async function createPlan(
  input: CreatePlanInput,
  ctx: AuditContext,
): Promise<ITreatmentPlan> {
  // Single DB round-trip for all CDT codes
  const costMap = await computeStepCosts(input.steps);

  const stepsWithCost = input.steps.map(s => ({
    cdtCode: s.cdtCode,
    description: s.description,
    estimatedCost: costMap.get(s.cdtCode) ?? 0,
    status: 'planned' as const,
  }));

  const totalEstimatedCost = stepsWithCost.reduce((sum, s) => sum + s.estimatedCost, 0);

  const plan = await TreatmentPlan.create({
    patientId: new Types.ObjectId(input.patientId),
    dentistId: new Types.ObjectId(input.dentistId),
    title: input.title,
    status: 'draft',
    steps: stepsWithCost,
    totalEstimatedCost,
  });

  writeAuditLog(ctx, 'treatmentPlan.create', plan._id, {
    planId: plan._id.toString(),
    patientId: input.patientId,
  });

  return plan;
}

// ─── Update plan ──────────────────────────────────────────────────────────────

export async function updatePlan(
  input: UpdatePlanInput,
  ctx: AuditContext,
): Promise<ITreatmentPlan | null> {
  if (!Types.ObjectId.isValid(input.planId)) return null;

  const { planId, ...fields } = input;
  const plan = await TreatmentPlan.findByIdAndUpdate(
    planId,
    { $set: fields },
    { new: true, runValidators: true },
  ).lean<ITreatmentPlan>();

  if (plan) {
    writeAuditLog(ctx, 'treatmentPlan.update', plan._id, { planId });
  }

  return plan;
}

// ─── Update step status ───────────────────────────────────────────────────────

/**
 * Update the status of a single treatment step.
 *
 * Requirements: 4.1.2
 */
export async function updateStep(
  input: UpdateStepInput,
  ctx: AuditContext,
): Promise<ITreatmentPlan | null> {
  if (!Types.ObjectId.isValid(input.planId)) return null;

  const plan = await TreatmentPlan.findOneAndUpdate(
    { _id: input.planId, 'steps._id': new Types.ObjectId(input.stepId) },
    {
      $set: {
        'steps.$.status': input.status,
        ...(input.status === 'completed' ? { 'steps.$.completedAt': new Date() } : {}),
      },
    },
    { new: true },
  ).lean<ITreatmentPlan>();

  if (plan) {
    writeAuditLog(ctx, 'treatmentPlan.updateStep', plan._id, {
      planId: input.planId,
      stepId: input.stepId,
      status: input.status,
    });
  }

  return plan;
}

// ─── Patient approval flow ────────────────────────────────────────────────────

/**
 * Generate a signed approval token for a treatment plan.
 * Token is stored on the plan; patient uses it to approve/decline.
 *
 * Requirements: 4.1.4
 */
export async function generateApprovalToken(
  planId: string,
  ctx: AuditContext,
): Promise<{ token: string; expiresAt: Date }> {
  if (!Types.ObjectId.isValid(planId)) {
    throw new Error('Invalid plan ID.');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await TreatmentPlan.findByIdAndUpdate(planId, {
    $set: {
      approvalToken: token,
      approvalTokenExpiresAt: expiresAt,
      status: 'pending_approval',
    },
  });

  await writeAuditLog(ctx, 'treatmentPlan.approvalTokenGenerated', planId, { planId });

  return { token, expiresAt };
}

/**
 * Process patient approval or decline via token.
 *
 * Requirements: 4.1.4
 */
export async function processApproval(
  token: string,
  decision: 'approve' | 'decline',
): Promise<ITreatmentPlan | null> {
  const plan = await TreatmentPlan.findOne({
    approvalToken: token,
    approvalTokenExpiresAt: { $gt: new Date() },
    status: 'pending_approval',
  });

  if (!plan) return null;

  plan.approvalToken = undefined;
  plan.approvalTokenExpiresAt = undefined;

  if (decision === 'approve') {
    plan.status = 'approved';
    plan.patientApprovedAt = new Date();
  } else {
    plan.status = 'draft';
  }

  await plan.save();
  return plan.toObject() as ITreatmentPlan;
}

// ─── Get plan ─────────────────────────────────────────────────────────────────

export async function getPlan(
  planId: string,
  ctx: AuditContext,
): Promise<ITreatmentPlan | null> {
  if (!Types.ObjectId.isValid(planId)) return null;

  const plan = await TreatmentPlan.findById(planId).lean<ITreatmentPlan>();

  if (plan) {
    writeAuditLog(ctx, 'treatmentPlan.view', plan._id, { planId });
  }

  return plan;
}

export async function getPatientPlans(
  patientId: string,
  ctx: AuditContext,
): Promise<ITreatmentPlan[]> {
  if (!Types.ObjectId.isValid(patientId)) return [];

  const plans = await TreatmentPlan.find({
    patientId: new Types.ObjectId(patientId),
  })
    .sort({ createdAt: -1 })
    .lean<ITreatmentPlan[]>();

  // Fire-and-forget — don't block list response on audit write
  writeAuditLog(
    ctx,
    'treatmentPlan.list',
    new Types.ObjectId('000000000000000000000000'),
    { patientId, count: plans.length },
  );

  return plans;
}
