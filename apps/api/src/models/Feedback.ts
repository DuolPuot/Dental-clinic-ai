import { Schema, model, type Document, type Model } from 'mongoose';

export interface IFeedback extends Document {
  _id: Schema.Types.ObjectId;
  patientId?: Schema.Types.ObjectId;
  appointmentId?: Schema.Types.ObjectId;
  rating: 1 | 2 | 3 | 4 | 5;
  category: 'scheduling' | 'staff' | 'ai_assistant' | 'overall' | 'other';
  comment?: string;
  submittedAt: Date;
}

const feedbackSchema = new Schema<IFeedback>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', default: undefined },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', default: undefined },
    rating: { type: Number, enum: [1, 2, 3, 4, 5], required: true },
    category: {
      type: String,
      enum: ['scheduling', 'staff', 'ai_assistant', 'overall', 'other'],
      required: true,
    },
    comment: { type: String, maxlength: 2000, default: undefined },
    submittedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false, versionKey: false },
);

feedbackSchema.index({ submittedAt: -1 });
feedbackSchema.index({ rating: 1 });
feedbackSchema.index({ category: 1 });

export const Feedback: Model<IFeedback> = model<IFeedback>('Feedback', feedbackSchema);
