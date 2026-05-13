/**
 * Feedback Router — patient satisfaction collection
 */

import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc/trpc.js';
import { requirePermission } from '../middleware/rbac.js';
import { Feedback } from '../models/Feedback.js';

export const feedbackRouter = router({
  /** Public — patients submit feedback without auth */
  submit: publicProcedure
    .input(
      z.object({
        patientId: z.string().optional(),
        appointmentId: z.string().optional(),
        rating: z.number().int().min(1).max(5),
        category: z.enum(['scheduling', 'staff', 'ai_assistant', 'overall', 'other']),
        comment: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const fb = await Feedback.create(input);
      return { id: fb._id.toString(), submittedAt: fb.submittedAt };
    }),

  /** Staff — list all feedback with filters */
  list: protectedProcedure
    .use(requirePermission('analytics', 'read'))
    .input(
      z.object({
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
        category: z.enum(['scheduling', 'staff', 'ai_assistant', 'overall', 'other']).optional(),
        minRating: z.number().int().min(1).max(5).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filter: any = {};
      if (input.from || input.to) {
        filter.submittedAt = {};
        if (input.from) filter.submittedAt.$gte = input.from;
        if (input.to) filter.submittedAt.$lte = input.to;
      }
      if (input.category) filter.category = input.category;
      if (input.minRating) filter.rating = { $gte: input.minRating };

      const [items, total] = await Promise.all([
        Feedback.find(filter).sort({ submittedAt: -1 }).skip(input.offset).limit(input.limit).lean(),
        Feedback.countDocuments(filter),
      ]);

      return { items, total };
    }),

  /** Staff — aggregate summary */
  summary: protectedProcedure
    .use(requirePermission('analytics', 'read'))
    .input(z.object({ from: z.coerce.date(), to: z.coerce.date() }))
    .query(async ({ input }) => {
      const [avgRating, byCategory, ratingDist] = await Promise.all([
        Feedback.aggregate([
          { $match: { submittedAt: { $gte: input.from, $lte: input.to } } },
          { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
        ]),
        Feedback.aggregate([
          { $match: { submittedAt: { $gte: input.from, $lte: input.to } } },
          { $group: { _id: '$category', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Feedback.aggregate([
          { $match: { submittedAt: { $gte: input.from, $lte: input.to } } },
          { $group: { _id: '$rating', count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]),
      ]);

      const a = avgRating[0] as { avg: number; count: number } | undefined;
      return {
        averageRating: a ? Math.round(a.avg * 10) / 10 : 0,
        totalResponses: a?.count ?? 0,
        byCategory: byCategory as Array<{ _id: string; avg: number; count: number }>,
        ratingDistribution: ratingDist as Array<{ _id: number; count: number }>,
      };
    }),
});
