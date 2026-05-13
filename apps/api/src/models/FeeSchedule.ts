import { Schema, model, type Document, type Model } from 'mongoose';

export interface IFeeSchedule extends Document {
  _id: Schema.Types.ObjectId;
  /** ADA CDT procedure code (e.g. "D0120") */
  cdtCode: string;
  description: string;
  price: number;
  createdAt: Date;
  updatedAt: Date;
}

const feeScheduleSchema = new Schema<IFeeSchedule>(
  {
    cdtCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);



export const FeeSchedule: Model<IFeeSchedule> = model<IFeeSchedule>(
  'FeeSchedule',
  feeScheduleSchema,
);
