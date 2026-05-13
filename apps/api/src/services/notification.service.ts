/**
 * Notification Service
 *
 * Queue-based notification system using Redis.
 * Deduplication via Redis SET (TTL 48h) — Property 6.
 * Templates rendered with Handlebars.
 * Sends email (Nodemailer) and SMS (Twilio).
 *
 * Requirements: 6.1.1–6.1.4
 */

import Handlebars from 'handlebars';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { getRedisClient } from '../lib/redis.js';
import { Notification } from '../models/Notification.js';
import { env } from '../config/env.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'appointment_reminder_email'
  | 'appointment_reminder_sms'
  | 'appointment_reminder_whatsapp'
  | 'appointment_confirmation_email'
  | 'appointment_confirmation_whatsapp'
  | 'treatment_plan_ready_email'
  | 'treatment_plan_ready_whatsapp'
  | 'post_visit_followup_email'
  | 'post_visit_followup_whatsapp';

export interface NotificationPayload {
  type: NotificationType;
  patientId: string;
  appointmentId?: string;
  to: string; // email or phone
  templateData: Record<string, unknown>;
}

// ─── Email templates ──────────────────────────────────────────────────────────

const EMAIL_TEMPLATES: Record<string, string> = {
  appointment_reminder_email: `
    <h2>Appointment Reminder</h2>
    <p>Dear {{patientName}},</p>
    <p>This is a reminder that you have an appointment scheduled for <strong>{{appointmentDate}}</strong> at <strong>{{appointmentTime}}</strong>.</p>
    <p>Please contact us if you need to reschedule.</p>
  `,
  appointment_confirmation_email: `
    <h2>Appointment Confirmed</h2>
    <p>Dear {{patientName}},</p>
    <p>Your appointment on <strong>{{appointmentDate}}</strong> at <strong>{{appointmentTime}}</strong> has been confirmed.</p>
  `,
  treatment_plan_ready_email: `
    <h2>Your Treatment Plan is Ready</h2>
    <p>Dear {{patientName}},</p>
    <p>Your treatment plan is ready for review. Please click the link below to view and approve it.</p>
    <p><a href="{{approvalUrl}}">Review Treatment Plan</a></p>
  `,
  post_visit_followup_email: `
    <h2>Thank You for Your Visit</h2>
    <p>Dear {{patientName}},</p>
    <p>Thank you for visiting us on {{visitDate}}. We hope your appointment went well.</p>
    <p>Please don't hesitate to contact us if you have any questions.</p>
  `,
};

const SMS_TEMPLATES: Record<string, string> = {
  appointment_reminder_sms:
    'Reminder: You have a dental appointment on {{appointmentDate}} at {{appointmentTime}}. Reply STOP to opt out.',
};

// ─── Deduplication key ────────────────────────────────────────────────────────

function dedupeKey(type: NotificationType, patientId: string, appointmentId?: string): string {
  return `notif:sent:${type}:${patientId}:${appointmentId ?? 'none'}`;
}

/**
 * Check if a notification has already been sent (Property 6).
 * Returns true if already sent within the 48h window.
 */
async function isAlreadySent(
  type: NotificationType,
  patientId: string,
  appointmentId?: string,
): Promise<boolean> {
  const key = dedupeKey(type, patientId, appointmentId);
  const exists = await getRedisClient().exists(key);
  return exists === 1;
}

/**
 * Mark a notification as sent (TTL 48h).
 */
async function markSent(
  type: NotificationType,
  patientId: string,
  appointmentId?: string,
): Promise<void> {
  const key = dedupeKey(type, patientId, appointmentId);
  await getRedisClient().set(key, '1', 'EX', 48 * 60 * 60);
}

// ─── Queue ────────────────────────────────────────────────────────────────────

const QUEUE_KEY = 'notifications:queue';

/**
 * Push a notification onto the Redis queue.
 */
export async function enqueueNotification(payload: NotificationPayload): Promise<void> {
  await getRedisClient().rpush(QUEUE_KEY, JSON.stringify(payload));
}

/**
 * Process one notification from the queue.
 * Returns true if a notification was processed, false if queue is empty.
 */
export async function processNextNotification(): Promise<boolean> {
  const raw = await getRedisClient().lpop(QUEUE_KEY);
  if (!raw) return false;

  let payload: NotificationPayload;
  try {
    payload = JSON.parse(raw) as NotificationPayload;
  } catch {
    console.error('[Notifications] Failed to parse notification payload:', raw);
    return true;
  }

  await sendNotification(payload);
  return true;
}

// ─── Send ─────────────────────────────────────────────────────────────────────

/**
 * Send a notification with deduplication.
 * Logs all sent notifications to the Notification collection.
 *
 * Requirements: 6.1.1–6.1.4
 */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const { type, patientId, appointmentId, to, templateData } = payload;

  // Deduplication check (Property 6)
  if (await isAlreadySent(type, patientId, appointmentId)) {
    return;
  }

  try {
    if (type.endsWith('_email')) {
      await sendEmail(type, to, templateData);
    } else if (type.endsWith('_sms')) {
      await sendSms(type, to, templateData);
    } else if (type.endsWith('_whatsapp')) {
      await sendWhatsApp(type, to, templateData);
    }

    await markSent(type, patientId, appointmentId);

    const notification: any = {
      patientId,
      type,
      channel: type.endsWith('_email') ? 'email' : type.endsWith('_whatsapp') ? 'whatsapp' : 'sms',
      to,
      sentAt: new Date(),
      templateData,
    };

    await Notification.create(notification);
  } catch (err) {
    console.error(`[Notifications] Failed to send ${type} to ${to}:`, err);
  }
}

// ─── Email sender ─────────────────────────────────────────────────────────────

async function sendEmail(
  type: NotificationType,
  to: string,
  data: Record<string, unknown>,
): Promise<void> {
  const templateSource = EMAIL_TEMPLATES[type];
  if (!templateSource) {
    console.warn(`[Notifications] No email template for type: ${type}`);
    return;
  }

  const template = Handlebars.compile(templateSource);
  const html = template(data);

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
      : undefined,
  });

  await transporter.sendMail({
    from: env.EMAIL_FROM ?? 'noreply@dentalclinic.com',
    to,
    subject: getEmailSubject(type),
    html,
  });
}

function getEmailSubject(type: NotificationType): string {
  const subjects: Record<string, string> = {
    appointment_reminder_email: 'Appointment Reminder',
    appointment_confirmation_email: 'Appointment Confirmed',
    treatment_plan_ready_email: 'Your Treatment Plan is Ready',
    post_visit_followup_email: 'Thank You for Your Visit',
  };
  return subjects[type] ?? 'Notification from Dental Clinic';
}

// ─── SMS sender ───────────────────────────────────────────────────────────────

async function sendSms(
  type: NotificationType,
  to: string,
  data: Record<string, unknown>,
): Promise<void> {
  const templateSource = SMS_TEMPLATES[type];
  if (!templateSource) {
    console.warn(`[Notifications] No SMS template for type: ${type}`);
    return;
  }

  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM_NUMBER) {
    console.warn('[Notifications] Twilio not configured — skipping SMS.');
    return;
  }

  const template = Handlebars.compile(templateSource);
  const body = template(data);

  const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  await client.messages.create({
    body,
    from: env.TWILIO_FROM_NUMBER,
    to,
  });
}

// ─── WhatsApp sender ──────────────────────────────────────────────────────────

const WHATSAPP_TEMPLATES: Record<string, string> = {
  appointment_reminder_whatsapp:
    '🦷 *Appointment Reminder*\nHi {{patientName}}, your dental appointment is on *{{appointmentDate}}* at *{{appointmentTime}}*. Reply STOP to opt out.',
  appointment_confirmation_whatsapp:
    '✅ *Appointment Confirmed*\nHi {{patientName}}, your appointment on *{{appointmentDate}}* at *{{appointmentTime}}* is confirmed. See you soon!',
  treatment_plan_ready_whatsapp:
    '📋 *Treatment Plan Ready*\nHi {{patientName}}, your treatment plan is ready for review. Visit: {{approvalUrl}}',
  post_visit_followup_whatsapp:
    '💙 *Thank You for Your Visit*\nHi {{patientName}}, thank you for visiting us on {{visitDate}}. Contact us if you have any questions.',
};

async function sendWhatsApp(
  type: NotificationType,
  to: string,
  data: Record<string, unknown>,
): Promise<void> {
  const templateSource = WHATSAPP_TEMPLATES[type];
  if (!templateSource) {
    console.warn(`[Notifications] No WhatsApp template for type: ${type}`);
    return;
  }

  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_WHATSAPP_FROM) {
    console.warn('[Notifications] Twilio WhatsApp not configured — skipping.');
    return;
  }

  const body = Handlebars.compile(templateSource)(data);
  const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

  // WhatsApp numbers must be prefixed with "whatsapp:"
  const toWhatsApp = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

  await client.messages.create({
    body,
    from: env.TWILIO_WHATSAPP_FROM,
    to: toWhatsApp,
  });
}

// ─── Notification log ─────────────────────────────────────────────────────────

export async function getPatientNotifications(patientId: string): Promise<any> {
  return Notification.find({ patientId }).sort({ sentAt: -1 }).lean();
}
