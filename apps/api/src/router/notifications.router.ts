/**
 * Notifications Router
 *
 * tRPC procedures for notification management:
 *   - notifications.getLog  — get notification history for a patient
 *   - notifications.resend  — re-enqueue a notification
 *
 * Requirements: 6.1.1–6.1.4
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc/trpc.js';
import { requirePermission } from '../middleware/rbac.js';
import {
  getPatientNotifications,
  enqueueNotification,
  type NotificationType,
} from '../services/notification.service.js';

export const notificationsRouter = router({
  getLog: protectedProcedure
    .use(requirePermission('notifications', 'read'))
    .input(z.object({ patientId: z.string().min(1) }))
    .query(async ({ input }) => {
      const notifications = await getPatientNotifications(input.patientId);
      return { notifications };
    }),

  resend: protectedProcedure
    .use(requirePermission('notifications', 'write'))
    .input(
      z.object({
        patientId: z.string().min(1),
        type: z.string().min(1),
        to: z.string().min(1),
        appointmentId: z.string().optional(),
        templateData: z.record(z.unknown()).default({}),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        await enqueueNotification({
          type: input.type as NotificationType,
          patientId: input.patientId,
          appointmentId: input.appointmentId,
          to: input.to,
          templateData: input.templateData,
        });
        return { queued: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to enqueue notification.';
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: msg });
      }
    }),
});
