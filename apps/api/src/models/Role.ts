import { Schema, model, type Document, type Model } from 'mongoose';

// Role names enum
export const ROLE_NAMES = ['admin', 'dentist', 'receptionist', 'billing_staff', 'patient'] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

// Permission map: resource -> action -> allowed
export type PermissionMap = Record<string, Record<string, boolean>>;

export interface IRole extends Document {
  _id: Schema.Types.ObjectId;
  name: RoleName;
  permissions: PermissionMap;
}

const roleSchema = new Schema<IRole>(
  {
    name: {
      type: String,
      enum: ROLE_NAMES,
      required: true,
      unique: true,
    },
    permissions: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
  },
  {
    timestamps: false,
    versionKey: false,
  },
);

export const Role: Model<IRole> = model<IRole>('Role', roleSchema);
