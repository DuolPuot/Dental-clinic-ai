/**
 * Prediction Router — no-show risk scoring
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../trpc/trpc.js';
import { requirePermission } from '../middleware/rbac.js';
import { scoreNoShowRisk, scoreUpcomingAppointments } from '../services/prediction.service.js';

export const predictionRouter = router({
  /** Score a single appointment */
  noShowRisk: protectedProcedure
    .use(requirePermission('appointments', 'read'))
    .input(
      z.object({
        patientId: z.string().min(1),
        appointmentId: z.string().min(1),
        appointmentStartTime: z.coerce.date(),
        appointmentType: z.string().min(1),
      }),
    )
    .query(({ input }) =>
      scoreNoShowRisk(
        input.patientId,
        input.appointmentId,
        input.appointmentStartTime,
        input.appointmentType,
      ),
    ),

  /** Batch score all upcoming appointments (next 7 days) */
  upcomingRisks: protectedProcedure
    .use(requirePermission('appointments', 'read'))
    .query(() => scoreUpcomingAppointments()),
});
