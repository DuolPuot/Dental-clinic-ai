import { Schema, model, type Document, type Model } from 'mongoose';

export interface IPatient extends Document {
  _id: Schema.Types.ObjectId;
  /**
   * @phi - Sensitive: first name is PHI and should be encrypted at rest
   */
  firstName: string;
  /**
   * @phi - Sensitive: last name is PHI and should be encrypted at rest
   */
  lastName: string;
  /**
   * @phi - Sensitive: date of birth is PHI and should be encrypted at rest
   */
  dateOfBirth: Date;
  /**
   * @phi - Sensitive: email is PHI and should be encrypted at rest
   */
  email: string;
  /**
   * @phi - Sensitive: phone number is PHI and should be encrypted at rest
   */
  phone: string;
  /**
   * @phi - Sensitive: insurance provider is PHI
   */
  insuranceProvider?: string;
  /**
   * @phi - Sensitive: insurance policy number is PHI and should be encrypted at rest
   */
  insurancePolicyNumber?: string;
  /**
   * @phi - Sensitive: allergies are PHI (clinical data)
   */
  allergies: string[];
  /**
   * @phi - Sensitive: medications are PHI (clinical data)
   */
  medications: string[];
  /**
   * @phi - Sensitive: medical conditions are PHI (clinical data)
   */
  medicalConditions: string[];
  createdAt: Date;
  updatedAt: Date;
  /**
   * Soft-delete timestamp. When set, the patient is considered deleted.
   * Soft-deleted patients must NOT appear in standard search results
   * but MUST remain retrievable by admin queries (Property 8).
   */
  deletedAt?: Date;
}

const patientSchema = new Schema<IPatient>(
  {
    // @phi - encrypted at rest via MongoDB field-level encryption
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    // @phi - encrypted at rest via MongoDB field-level encryption
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    // @phi - encrypted at rest via MongoDB field-level encryption
    dateOfBirth: {
      type: Date,
      required: true,
    },
    // @phi - encrypted at rest via MongoDB field-level encryption
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    // @phi - encrypted at rest via MongoDB field-level encryption
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    // @phi - optional insurance info
    insuranceProvider: {
      type: String,
      trim: true,
      default: undefined,
    },
    // @phi - encrypted at rest via MongoDB field-level encryption
    insurancePolicyNumber: {
      type: String,
      trim: true,
      default: undefined,
    },
    // @phi - clinical PHI
    allergies: {
      type: [String],
      default: [],
    },
    // @phi - clinical PHI
    medications: {
      type: [String],
      default: [],
    },
    // @phi - clinical PHI
    medicalConditions: {
      type: [String],
      default: [],
    },
    deletedAt: {
      type: Date,
      default: undefined,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Index for soft-delete filtering (standard queries exclude deletedAt != null)
patientSchema.index({ deletedAt: 1 });
// Index for search by name
patientSchema.index({ lastName: 1, firstName: 1 });
// Index for search by email
patientSchema.index({ email: 1 });
// Index for search by phone
patientSchema.index({ phone: 1 });

export const Patient: Model<IPatient> = model<IPatient>('Patient', patientSchema);
