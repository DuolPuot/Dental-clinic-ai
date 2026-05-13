// @ts-nocheck
import { Schema, model, type Document, type Model } from 'mongoose';

// ─── InvoiceLineItem (embedded sub-document) ─────────────────────────────────

export interface IInvoiceLineItem {
  _id: Schema.Types.ObjectId;
  /** ADA CDT procedure code (e.g. "D0120") */
  cdtCode: string;
  description: string;
  /** Unit price */
  amount: number;
  quantity: number;
}

const invoiceLineItemSchema = new Schema<IInvoiceLineItem>(
  {
    cdtCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
  },
  {
    _id: true,
    versionKey: false,
  },
);

// ─── Invoice ──────────────────────────────────────────────────────────────────

export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'overdue'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export interface IInvoice extends Document {
  _id: Schema.Types.ObjectId;
  patientId: Schema.Types.ObjectId;
  treatmentPlanId?: Schema.Types.ObjectId;
  /**
   * Embedded line items.
   * Property 2: subtotal MUST equal sum(lineItems[i].amount * lineItems[i].quantity)
   */
  lineItems: IInvoiceLineItem[];
  /**
   * Denormalized subtotal — must equal sum of (lineItem.amount * lineItem.quantity).
   * Property 2: Invoice total consistency.
   */
  subtotal: number;
  insuranceCoverage: number;
  /**
   * Property 2: patientResponsibility MUST equal subtotal - insuranceCoverage.
   */
  patientResponsibility: number;
  status: InvoiceStatus;
  dueDate: Date;
  paidAt?: Date;
  paymentMethod?: 'card' | 'cash' | 'insurance';
  amountPaid?: number;
  createdAt: Date;
}

const invoiceSchema = new Schema<IInvoice>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    treatmentPlanId: {
      type: Schema.Types.ObjectId,
      ref: 'TreatmentPlan',
      default: undefined,
    },
    lineItems: {
      type: [invoiceLineItemSchema],
      default: [],
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    insuranceCoverage: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    patientResponsibility: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: INVOICE_STATUSES,
      required: true,
      default: 'draft',
    },
    dueDate: {
      type: Date,
      required: true,
    },
    paidAt: {
      type: Date,
      default: undefined,
    },
    paymentMethod: {
      type: String,
      enum: ['card', 'cash', 'insurance'],
      default: undefined,
    },
    amountPaid: {
      type: Number,
      min: 0,
      default: undefined,
    },
  },
  {
    // Invoice has createdAt but no updatedAt per design spec
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

invoiceSchema.index({ patientId: 1, createdAt: -1 });
invoiceSchema.index({ treatmentPlanId: 1 });
invoiceSchema.index({ status: 1, dueDate: 1 });

export const Invoice: Model<IInvoice> = model<IInvoice>('Invoice', invoiceSchema);
