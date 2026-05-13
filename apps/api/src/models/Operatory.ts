// @ts-nocheck
import { Schema, model, type Document, type Model } from 'mongoose';

export interface IOperatory extends Document {
  _id: Schema.Types.ObjectId;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const operatorySchema = new Schema<IOperatory>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

operatorySchema.index({ name: 1 }, { unique: true });
operatorySchema.index({ isActive: 1 });

export const Operatory: Model<IOperatory> = model<IOperatory>('Operatory', operatorySchema);
