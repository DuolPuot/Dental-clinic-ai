/**
 * Billing Router
 *
 * tRPC procedures for billing:
 *   - billing.generateInvoice  — auto-create invoice from completed steps
 *   - billing.recordPayment    — record a payment
 *   - billing.getReport        — revenue summary
 *   - billing.exportClaim      — ADA claim PDF (returns base64)
 *   - billing.getInvoice       — get single invoice
 *   - billing.getPatientInvoices — list invoices for a patient
 *
 * Requirements: 5.1.1–5.1.5, 5.2.1–5.2.3
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc/trpc.js';
import { requirePermission } from '../middleware/rbac.js';
import {
  generateInvoice,
  recordPayment,
  getReport,
  exportClaimPdf,
  getInvoice,
  getPatientInvoices,
} from '../services/billing.service.js';
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

export const billingRouter = router({
  generateInvoice: protectedProcedure
    .use(requirePermission('billing', 'write'))
    .input(
      z.object({
        patientId: z.string().min(1),
        treatmentPlanId: z.string().min(1),
        insuranceCoverage: z.number().min(0).optional(),
        dueDate: z.coerce.date().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const auditCtx = getAuditContext(ctx.req, ctx.userId!);
      try {
        const invoice = await generateInvoice(input, auditCtx);
        return serializeInvoice(invoice);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to generate invoice.';
        throw new TRPCError({ code: 'BAD_REQUEST', message: msg });
      }
    }),

  recordPayment: protectedProcedure
    .use(requirePermission('billing', 'write'))
    .input(
      z.object({
        invoiceId: z.string().min(1),
        paymentMethod: z.enum(['card', 'cash', 'insurance']),
        amount: z.number().positive(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const auditCtx = getAuditContext(ctx.req, ctx.userId!);
      const invoice = await recordPayment(input, auditCtx);
      if (!invoice) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found.' });
      return serializeInvoice(invoice);
    }),

  getReport: protectedProcedure
    .use(requirePermission('billing', 'read'))
    .input(
      z.object({
        period: z.enum(['daily', 'weekly', 'monthly']),
        from: z.coerce.date(),
        to: z.coerce.date(),
      }),
    )
    .query(async ({ input }) => {
      return getReport(input);
    }),

  exportClaim: protectedProcedure
    .use(requirePermission('billing', 'read'))
    .input(z.object({ invoiceId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        const pdfBuffer = await exportClaimPdf(input.invoiceId);
        return { pdf: pdfBuffer.toString('base64') };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to export claim.';
        throw new TRPCError({ code: 'BAD_REQUEST', message: msg });
      }
    }),

  getInvoice: protectedProcedure
    .use(requirePermission('billing', 'read'))
    .input(z.object({ invoiceId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const auditCtx = getAuditContext(ctx.req, ctx.userId!);
      const invoice = await getInvoice(input.invoiceId, auditCtx);
      if (!invoice) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found.' });
      return serializeInvoice(invoice);
    }),

  getPatientInvoices: protectedProcedure
    .use(requirePermission('billing', 'read'))
    .input(z.object({ patientId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const auditCtx = getAuditContext(ctx.req, ctx.userId!);
      const invoices = await getPatientInvoices(input.patientId, auditCtx);
      return { invoices: invoices.map(serializeInvoice) };
    }),
});

// ─── Serializer ───────────────────────────────────────────────────────────────

function serializeInvoice(inv: {
  _id: { toString(): string };
  patientId: { toString(): string };
  treatmentPlanId?: { toString(): string };
  lineItems: Array<{ cdtCode: string; description: string; amount: number }>;
  subtotal: number;
  insuranceCoverage: number;
  patientResponsibility: number;
  status: string;
  dueDate: Date;
  paidAt?: Date;
  createdAt: Date;
}) {
  return {
    id: inv._id.toString(),
    patientId: inv.patientId.toString(),
    treatmentPlanId: inv.treatmentPlanId?.toString(),
    lineItems: inv.lineItems,
    subtotal: inv.subtotal,
    insuranceCoverage: inv.insuranceCoverage,
    patientResponsibility: inv.patientResponsibility,
    status: inv.status,
    dueDate: inv.dueDate,
    paidAt: inv.paidAt,
    createdAt: inv.createdAt,
  };
}
