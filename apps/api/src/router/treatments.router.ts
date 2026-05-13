/**
 * Treatments Router
 *
 * tRPC procedures for treatment planning:
 *   - treatments.createPlan       — create plan with cost estimation
 *   - treatments.updatePlan       — update plan fields/status
 *   - treatments.updateStep       — update step status
 *   - treatments.getPlan          — get single plan
 *   - treatments.getPatientPlans  — list plans for a patient
 *   - treatments.generateApproval — generate patient approval token
 *   - treatments.processApproval  — patient approves/declines via token (public)
 *
 * Requirements: 4.1.1–4.1.4
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, publicProcedure } from '../trpc/trpc.js';
import { requirePermission } from '../middleware/rbac.js';
import {
  createPlan,
  updatePlan,
  updateStep,
  getPlan,
  getPatientPlans,
  generateApprovalToken,
  processApproval,
} from '../services/treatment.service.js';
import type { AuditContext } from '../services/patient.service.js';
import type { Request } from 'express';

function getAuditContext(req: Request, userId: string): AuditContext {
  return {
    userId,
    ipAddress:
      (req.headers['x-forwarded-for'] as string | undefined) ?? req.ip ?? 'unknown',
    userAgent: req.headers['user-agent'] ?? 'unknown',
  };
}

export const treatmentsRouter = router({
  createPlan: protectedProcedure
    .use(requirePermission('treatments', 'write'))
    .input(
      z.object({
        patientId: z.string().min(1),
        dentistId: z.string().min(1),
        title: z.string().min(1).max(200),
        steps: z
          .array(
            z.object({
              cdtCode: z.string().min(1).max(20),
              description: z.string().min(1).max(500),
            }),
          )
          .min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const auditCtx = getAuditContext(ctx.req, ctx.userId!);
      const plan = await createPlan(input, auditCtx);
      return serializePlan(plan);
    }),

  updatePlan: protectedProcedure
    .use(requirePermission('treatments', 'write'))
    .input(
      z.object({
        planId: z.string().min(1),
        title: z.string().min(1).max(200).optional(),
        status: z
          .enum(['draft', 'pending_approval', 'approved', 'in_progress', 'completed'])
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const auditCtx = getAuditContext(ctx.req, ctx.userId!);
      const plan = await updatePlan(input, auditCtx);
      if (!plan) throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found.' });
      return serializePlan(plan);
    }),

  updateStep: protectedProcedure
    .use(requirePermission('treatments', 'write'))
    .input(
      z.object({
        planId: z.string().min(1),
        stepId: z.string().min(1),
        status: z.enum(['planned', 'in_progress', 'completed']),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const auditCtx = getAuditContext(ctx.req, ctx.userId!);
      const plan = await updateStep(input, auditCtx);
      if (!plan) throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan or step not found.' });
      return serializePlan(plan);
    }),

  getPlan: protectedProcedure
    .use(requirePermission('treatments', 'read'))
    .input(z.object({ planId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const auditCtx = getAuditContext(ctx.req, ctx.userId!);
      const plan = await getPlan(input.planId, auditCtx);
      if (!plan) throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found.' });
      return serializePlan(plan);
    }),

  getPatientPlans: protectedProcedure
    .use(requirePermission('treatments', 'read'))
    .input(z.object({ patientId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const auditCtx = getAuditContext(ctx.req, ctx.userId!);
      const plans = await getPatientPlans(input.patientId, auditCtx);
      return { plans: plans.map(serializePlan) };
    }),

  generateApproval: protectedProcedure
    .use(requirePermission('treatments', 'write'))
    .input(z.object({ planId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const auditCtx = getAuditContext(ctx.req, ctx.userId!);
      try {
        return await generateApprovalToken(input.planId, auditCtx);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to generate approval token.';
        throw new TRPCError({ code: 'BAD_REQUEST', message: msg });
      }
    }),

  /** Public — patient approves/declines via signed URL token */
  processApproval: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        decision: z.enum(['approve', 'decline']),
      }),
    )
    .mutation(async ({ input }) => {
      const plan = await processApproval(input.token, input.decision);
      if (!plan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invalid or expired approval token.',
        });
      }
      return { status: plan.status, patientApprovedAt: plan.patientApprovedAt };
    }),
});

// ─── Serializer ───────────────────────────────────────────────────────────────

function serializePlan(p: {
  _id: { toString(): string };
  patientId: { toString(): string };
  dentistId: { toString(): string };
  title: string;
  status: string;
  steps: Array<{
    _id?: { toString(): string };
    cdtCode: string;
    description: string;
    estimatedCost: number;
    status: string;
    completedAt?: Date;
  }>;
  totalEstimatedCost: number;
  patientApprovedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: p._id.toString(),
    patientId: p.patientId.toString(),
    dentistId: p.dentistId.toString(),
    title: p.title,
    status: p.status,
    steps: p.steps.map((s) => ({
      id: s._id?.toString(),
      cdtCode: s.cdtCode,
      description: s.description,
      estimatedCost: s.estimatedCost,
      status: s.status,
      completedAt: s.completedAt,
    })),
    totalEstimatedCost: p.totalEstimatedCost,
    patientApprovedAt: p.patientApprovedAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
