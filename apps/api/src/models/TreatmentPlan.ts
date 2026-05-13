import { Schema, model, type Document, type Model } from 'mongoose';

// ─── TreatmentStep (embedded sub-document) ───────────────────────────────────

export const TREATMENT_STEP_STATUSES = ['planned', 'in_progress', 'completed'] as const;
export type TreatmentStepStatus = (typeof TREATMENT_STEP_STATUSES)[number];

export interface ITreatmentStep {
  _id: Schema.Types.ObjectId;
  /** ADA CDT procedure code (e.g. "D0120") */
  cdtCode: string;
  description: string;
  estimatedCost: number;
  status: TreatmentStepStatus;
  completedAt?: Date;
}

const treatmentStepSchema = new Schema<ITreatmentStep>(
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
    estimatedCost: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: TREATMENT_STEP_STATUSES,
      required: true,
      default: 'planned',
    },
    completedAt: {
      type: Date,
      default: undefined,
    },
  },
  {
    _id: true,
    versionKey: false,
  },
);

// ─── TreatmentPlan ────────────────────────────────────────────────────────────

export const TREATMENT_PLAN_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'in_progress',
  'completed',
] as const;

export type TreatmentPlanStatus = (typeof TREATMENT_PLAN_STATUSES)[number];

export interface ITreatmentPlan extends Document {
  _id: Schema.Types.ObjectId;
  patientId: Schema.Types.ObjectId;
  dentistId: Schema.Types.ObjectId;
  title: string;
  status: TreatmentPlanStatus;
  /**
   * Embedded TreatmentStep documents.
   * Property 3: totalEstimatedCost MUST equal sum(steps[i].estimatedCost)
   */
  steps: ITreatmentStep[];
  /**
   * Denormalized total — must be kept in sync with steps.
   * Property 3: Treatment plan cost consistency.
   */
  totalEstimatedCost: number;
  patientApprovedAt?: Date;
  approvalToken?: string;
  approvalTokenExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const treatmentPlanSchema = new Schema<ITreatmentPlan>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    dentistId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: TREATMENT_PLAN_STATUSES,
      required: true,
      default: 'draft',
    },
    steps: {
      type: [treatmentStepSchema],
      default: [],
    },
    totalEstimatedCost: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    patientApprovedAt: {
      type: Date,
      default: undefined,
    },
    approvalToken: {
      type: String,
      default: undefined,
    },
    approvalTokenExpiresAt: {
      type: Date,
      default: undefined,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

treatmentPlanSchema.index({ patientId: 1, createdAt: -1 });
treatmentPlanSchema.index({ dentistId: 1, status: 1 });

export const TreatmentPlan: Model<ITreatmentPlan> = model<ITreatmentPlan>(
  'TreatmentPlan',
  treatmentPlanSchema,
);
