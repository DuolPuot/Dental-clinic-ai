import { router } from '../trpc/trpc.js';
import { authRouter } from './auth.router.js';
import { patientsRouter } from './patients.router.js';
import { appointmentsRouter } from './appointments.router.js';
import { aiRouter } from './ai.router.js';
import { treatmentsRouter } from './treatments.router.js';
import { billingRouter } from './billing.router.js';
import { notificationsRouter } from './notifications.router.js';
import { analyticsRouter } from './analytics.router.js';
import { feedbackRouter } from './feedback.router.js';
import { predictionRouter } from './prediction.router.js';
import { agentsRouter } from './agents.router.js';
import { usersRouter } from './users.router.js';

export const appRouter = router({
  auth: authRouter,
  patients: patientsRouter,
  appointments: appointmentsRouter,
  ai: aiRouter,
  treatments: treatmentsRouter,
  billing: billingRouter,
  notifications: notificationsRouter,
  analytics: analyticsRouter,
  feedback: feedbackRouter,
  prediction: predictionRouter,
  agents: agentsRouter,
  users: usersRouter,
});

export type AppRouter = typeof appRouter;
