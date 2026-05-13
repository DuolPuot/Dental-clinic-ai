/**
 * Billing Service
 *
 * Invoice generation, payment recording, PDF claim export, and financial reports.
 * Property 2: subtotal = sum(lineItems), patientResponsibility = subtotal - insuranceCoverage
 *
 * Requirements: 5.1.1–5.1.5, 5.2.1–5.2.3
 */

import { Types } from 'mongoose';
import PDFDocument from 'pdfkit';
import { Invoice, type IInvoice } from '../models/Invoice.js';
import { TreatmentPlan } from '../models/TreatmentPlan.js';
import { AuditLog } from '../models/AuditLog.js';
import type { AuditContext } from './patient.service.js';

// ─── Audit log helper ─────────────────────────────────────────────────────────

async function writeAuditLog(
  ctx: AuditContext,
  action: string,
  resourceId: string | Types.ObjectId,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await AuditLog.create({
      userId: new Types.ObjectId(ctx.userId),
      action,
      resourceType: 'invoice',
      resourceId: new Types.ObjectId(resourceId.toString()),
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      timestamp: new Date(),
      metadata,
    });
  } catch (err) {
    console.error('[AuditLog] Failed to write audit log entry:', err);
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GenerateInvoiceInput {
  patientId?: string;
  treatmentPlanId?: string;
  insuranceCoverage?: number;
  dueDate?: Date;
}

export interface RecordPaymentInput {
  invoiceId?: string;
  paymentMethod?: 'card' | 'cash' | 'insurance';
  amount?: number;
}

export interface ReportInput {
  period?: 'daily' | 'weekly' | 'monthly';
  from?: Date;
  to?: Date;
}

export interface ReportResult {
  totalRevenue: number;
  paidInvoices: number;
  outstandingBalance: number;
  invoiceCount: number;
  period: string;
  from: Date;
  to: Date;
}

// ─── Invoice generation ───────────────────────────────────────────────────────

/**
 * Auto-generate an invoice from completed treatment plan steps.
 * Property 2: subtotal = sum(lineItems), patientResponsibility = subtotal - insuranceCoverage
 *
 * Requirements: 5.1.1, 5.1.2, 5.1.3
 */
export async function generateInvoice(
  input: GenerateInvoiceInput,
  ctx: AuditContext,
): Promise<IInvoice> {
  const plan = await TreatmentPlan.findById(input.treatmentPlanId).lean<{
    _id: Types.ObjectId;
    steps: Array<{ cdtCode: string; description: string; estimatedCost: number; status: string }>;
  }>();

  if (!plan) throw new Error('Treatment plan not found.');

  const completedSteps = plan.steps.filter((s) => s.status === 'completed');
  if (completedSteps.length === 0) {
    throw new Error('No completed steps to invoice.');
  }

  const lineItems = completedSteps.map((s) => ({
    cdtCode: s.cdtCode,
    description: s.description,
    amount: s.estimatedCost,
  }));

  const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);
  const insuranceCoverage = Math.min(input.insuranceCoverage ?? 0, subtotal);
  const patientResponsibility = subtotal - insuranceCoverage; // Property 2

  const invoice = await Invoice.create({
    patientId: new Types.ObjectId(input.patientId),
    treatmentPlanId: new Types.ObjectId(input.treatmentPlanId),
    lineItems,
    subtotal,
    insuranceCoverage,
    patientResponsibility,
    status: 'draft',
    dueDate: input.dueDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  await writeAuditLog(ctx, 'invoice.generate', invoice._id.toString(), {
    invoiceId: invoice._id.toString(),
    patientId: input.patientId,
    subtotal,
  });

  return invoice;
}

// ─── Record payment ───────────────────────────────────────────────────────────

/**
 * Record a payment against an invoice.
 *
 * Requirements: 5.1.4
 */
export async function recordPayment(
  input: RecordPaymentInput,
  ctx: AuditContext,
): Promise<IInvoice | null> {
  if (!Types.ObjectId.isValid(input.invoiceId)) return null;

  const invoice = await Invoice.findByIdAndUpdate(
    input.invoiceId,
    {
      $set: {
        status: 'paid',
        paidAt: new Date(),
        paymentMethod: input.paymentMethod,
        amountPaid: input.amount,
      },
    },
    { new: true },
  ).lean<IInvoice>();

  if (invoice) {
    await writeAuditLog(ctx, 'invoice.payment', invoice._id.toString(), {
      invoiceId: input.invoiceId,
      method: input.paymentMethod,
      amount: input.amount,
    });
  }

  return invoice;
}

// ─── Financial reports ────────────────────────────────────────────────────────

/**
 * Generate revenue summary via MongoDB aggregation pipeline.
 *
 * Requirements: 5.2.1, 5.2.2
 */
export async function getReport(input: ReportInput): Promise<ReportResult> {
  const { from, to } = input;

  const [result] = await Invoice.aggregate([
    { $match: { createdAt: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: null,
        totalRevenue: {
          $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amountPaid', 0] },
        },
        paidInvoices: {
          $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] },
        },
        outstandingBalance: {
          $sum: {
            $cond: [
              { $in: ['$status', ['draft', 'sent', 'overdue']] },
              '$patientResponsibility',
              0,
            ],
          },
        },
        invoiceCount: { $sum: 1 },
      },
    },
  ]);

  return {
    totalRevenue: result?.totalRevenue ?? 0,
    paidInvoices: result?.paidInvoices ?? 0,
    outstandingBalance: result?.outstandingBalance ?? 0,
    invoiceCount: result?.invoiceCount ?? 0,
    period: input.period,
    from,
    to,
  };
}

// ─── PDF claim export ─────────────────────────────────────────────────────────

/**
 * Generate an ADA Dental Claim Form PDF for an invoice.
 *
 * Requirements: 5.1.5
 */
export async function exportClaimPdf(invoiceId: string): Promise<Buffer> {
  if (!Types.ObjectId.isValid(invoiceId)) {
    throw new Error('Invalid invoice ID.');
  }

  const invoice = await Invoice.findById(invoiceId).lean<IInvoice>();
  if (!invoice) throw new Error('Invoice not found.');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(18).text('ADA Dental Claim Form', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Invoice ID: ${invoice._id.toString()}`);
    doc.text(`Patient ID: ${invoice.patientId.toString()}`);
    doc.text(`Date: ${invoice.createdAt.toISOString().split('T')[0]}`);
    doc.text(`Due Date: ${invoice.dueDate.toISOString().split('T')[0]}`);
    doc.moveDown();

    // Line items
    doc.fontSize(14).text('Services Rendered', { underline: true });
    doc.moveDown(0.5);
    invoice.lineItems.forEach((li) => {
      doc
        .fontSize(11)
        .text(`${li.cdtCode} — ${li.description}`, { continued: true })
        .text(`  $${li.amount.toFixed(2)}`, { align: 'right' });
    });

    doc.moveDown();
    doc.fontSize(12).text(`Subtotal: $${invoice.subtotal.toFixed(2)}`);
    doc.text(`Insurance Coverage: $${invoice.insuranceCoverage.toFixed(2)}`);
    doc.text(`Patient Responsibility: $${invoice.patientResponsibility.toFixed(2)}`);
    doc.text(`Status: ${invoice.status.toUpperCase()}`);

    doc.end();
  });
}

// ─── Get invoice ──────────────────────────────────────────────────────────────

export async function getInvoice(
  invoiceId: string,
  ctx: AuditContext,
): Promise<IInvoice | null> {
  if (!Types.ObjectId.isValid(invoiceId)) return null;

  const invoice = await Invoice.findById(invoiceId).lean<IInvoice>();

  if (invoice) {
    await writeAuditLog(ctx, 'invoice.view', invoice._id.toString(), { invoiceId });
  }

  return invoice;
}

export async function getPatientInvoices(
  patientId: string,
  ctx: AuditContext,
): Promise<IInvoice[]> {
  if (!Types.ObjectId.isValid(patientId)) return [];

  const invoices = await Invoice.find({ patientId: new Types.ObjectId(patientId) })
    .sort({ createdAt: -1 })
    .lean<IInvoice[]>();

  await writeAuditLog(
    ctx,
    'invoice.list',
    new Types.ObjectId('000000000000000000000000'),
    { patientId, count: invoices.length },
  );

  return invoices;
}
