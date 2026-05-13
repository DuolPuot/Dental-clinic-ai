import { Schema, model, type Document, type Model } from 'mongoose';

// @ts-ignore - mongoose Document type compatibility
export interface IUser extends Document {
  _id: Schema.Types.ObjectId;
  email: string;
  /**
   * @phi - Sensitive: password hash (never expose in API responses)
   */
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: Schema.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  /**
   * Soft-delete timestamp. When set, the user is considered deleted.
   */
  deletedAt?: Date;
}

const userSchema = new Schema<IUser>(
  {
    /**
     * @phi - Sensitive: email is PHI and should be encrypted at rest
     */
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    /**
     * @phi - Sensitive: bcrypt hash — never returned in API responses
     * Use Mongoose `select: false` to exclude by default.
     */
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
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

// Index to filter out soft-deleted users efficiently
userSchema.index({ deletedAt: 1 });
// Index for role-based queries
userSchema.index({ role: 1 });

export const User: Model<IUser> = model<IUser>('User', userSchema);
