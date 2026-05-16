// Load .env file — runs before env validation so vars are available.
// On Render/production, vars are injected directly; dotenv is a no-op when .env is missing.
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './router/index.js';
import { createContext } from './trpc/context.js';
import { connectDatabase } from './lib/database.js';
import { connectRedis } from './lib/redis.js';
import { env } from './config/env.js';
// Register all Mongoose models before any service uses them
import './models/index.js';
import './models/AgentSession.js';
import {
  getAppointmentsDueForReminder,
  markReminderSent,
} from './services/appointment.service.js';
import {
  enqueueNotification,
  processNextNotification,
} from './services/notification.service.js';

const app = express();

// ─── Security middleware ─────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Rate limiting ───────────────────────────────────────────────────────────
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: env.NODE_ENV === 'production' ? 100 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── tRPC router ─────────────────────────────────────────────────────────────
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Global error handler ────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Reminder cron job (hourly) ───────────────────────────────────────────────
function startReminderCron(): void {
  cron.schedule('0 * * * *', async () => {
    try {
      const appointments = await getAppointmentsDueForReminder();
      for (const appt of appointments) {
        // Enqueue email and SMS reminders
        await enqueueNotification({
          type: 'appointment_reminder_email',
          patientId: appt.patientId.toString(),
          appointmentId: appt._id.toString(),
          to: '', // populated by notification worker from patient record
          templateData: {
            appointmentDate: appt.startTime.toLocaleDateString(),
            appointmentTime: appt.startTime.toLocaleTimeString(),
          },
        });
        await markReminderSent(appt._id.toString());
      }
    } catch (err) {
      console.error('[Cron] Reminder job failed:', err);
    }
  });
}

// ─── Notification worker (polls every 5 seconds) ─────────────────────────────
function startNotificationWorker(): void {
  setInterval(async () => {
    try {
      await processNextNotification();
    } catch (err) {
      console.error('[NotificationWorker] Error:', err);
    }
  }, 5000);
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
async function bootstrap(): Promise<void> {
  try {
    await connectDatabase();
    console.info('Database connected ✓');

    // Redis should not crash entire app if unavailable
    try {
      await connectRedis();
      console.info('Redis connected ✓');
    } catch (redisError) {
      console.error('Redis connection failed:', redisError);
    }

    startReminderCron();
    startNotificationWorker();

    const PORT = Number(process.env.PORT) || env.PORT || 3000;
    const HOST = '0.0.0.0';

    app.listen(PORT, HOST, () => {
      console.info(`\n🦷 DentalAI API ready`);
      console.info(`   Environment: ${env.NODE_ENV}`);
      console.info(`   Port: ${PORT}`);
      console.info(`   Health: /health`);
      console.info(`   tRPC: /trpc\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export { app };
