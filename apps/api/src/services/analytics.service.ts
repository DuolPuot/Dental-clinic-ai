/**
 * Analytics Service
 *
 * MongoDB aggregation pipelines for clinic performance metrics.
 * Covers appointments, patients, revenue, AI usage, and no-show rates.
 */

import { Appointment } from '../models/Appointment.js';
import { Patient } from '../models/Patient.js';
import { Invoice } from '../models/Invoice.js';
import { Notification } from '../models/Notification.js';

export interface DateRange {
  from?: Date;
  to?: Date;
}

// ─── Appointment analytics ────────────────────────────────────────────────────

export async function getAppointmentStats(range: DateRange) {
  const [totals, byStatus, byType, dailyVolume, noShowRate] = await Promise.all([
    // Total counts by status
    Appointment.aggregate([
      { $match: { createdAt: { $gte: range.from, $lte: range.to } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    // By status (same as totals but shaped differently)
    Appointment.aggregate([
      { $match: { startTime: { $gte: range.from, $lte: range.to } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    // By appointment type
    Appointment.aggregate([
      { $match: { startTime: { $gte: range.from, $lte: range.to } } },
      { $group: { _id: '$appointmentType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    // Daily volume
    Appointment.aggregate([
      { $match: { startTime: { $gte: range.from, $lte: range.to } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // No-show rate
    Appointment.aggregate([
      { $match: { startTime: { $gte: range.from, $lte: range.to } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          noShows: { $sum: { $cond: [{ $eq: ['$status', 'no-show'] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const noShowData = noShowRate[0] as { total: number; noShows: number } | undefined;

  return {
    byStatus: byStatus as Array<{ _id: string; count: number }>,
    byType: byType as Array<{ _id: string; count: number }>,
    dailyVolume: dailyVolume as Array<{ _id: string; count: number }>,
    noShowRate: noShowData
      ? Math.round((noShowData.noShows / Math.max(noShowData.total, 1)) * 100)
      : 0,
    totalAppointments: noShowData?.total ?? 0,
  };
}

// ─── Patient analytics ────────────────────────────────────────────────────────

export async function getPatientStats(range: DateRange) {
  const [newPatients, dailyRegistrations, totalActive] = await Promise.all([
    // New patients in range
    Patient.countDocuments({
      createdAt: { $gte: range.from, $lte: range.to },
      deletedAt: { $exists: false },
    }),

    // Daily new registrations
    Patient.aggregate([
      { $match: { createdAt: { $gte: range.from, $lte: range.to }, deletedAt: { $exists: false } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // Total active patients
    Patient.countDocuments({ deletedAt: { $exists: false } }),
  ]);

  return {
    newPatients,
    totalActive,
    dailyRegistrations: dailyRegistrations as Array<{ _id: string; count: number }>,
  };
}

// ─── Revenue analytics ────────────────────────────────────────────────────────

export async function getRevenueStats(range: DateRange) {
  const [summary, dailyRevenue, byStatus] = await Promise.all([
    // Overall summary
    Invoice.aggregate([
      { $match: { createdAt: { $gte: range.from, $lte: range.to } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amountPaid', 0] } },
          totalOutstanding: {
            $sum: {
              $cond: [{ $in: ['$status', ['draft', 'sent', 'overdue']] }, '$patientResponsibility', 0],
            },
          },
          invoiceCount: { $sum: 1 },
          paidCount: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
        },
      },
    ]),

    // Daily revenue
    Invoice.aggregate([
      { $match: { createdAt: { $gte: range.from, $lte: range.to }, status: 'paid' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt' } },
          revenue: { $sum: '$amountPaid' },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // By status
    Invoice.aggregate([
      { $match: { createdAt: { $gte: range.from, $lte: range.to } } },
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$patientResponsibility' } } },
    ]),
  ]);

  const s = summary[0] as {
    totalRevenue: number; totalOutstanding: number; invoiceCount: number; paidCount: number;
  } | undefined;

  return {
    totalRevenue: s?.totalRevenue ?? 0,
    totalOutstanding: s?.totalOutstanding ?? 0,
    invoiceCount: s?.invoiceCount ?? 0,
    paidCount: s?.paidCount ?? 0,
    collectionRate: s ? Math.round((s.paidCount / Math.max(s.invoiceCount, 1)) * 100) : 0,
    dailyRevenue: dailyRevenue as Array<{ _id: string; revenue: number }>,
    byStatus: byStatus as Array<{ _id: string; count: number; total: number }>,
  };
}

// ─── Notification analytics ───────────────────────────────────────────────────

export async function getNotificationStats(range: DateRange) {
  const byChannel = await Notification.aggregate([
    { $match: { sentAt: { $gte: range.from, $lte: range.to } } },
    { $group: { _id: '$channel', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const total = await Notification.countDocuments({
    sentAt: { $gte: range.from, $lte: range.to },
  });

  return {
    total,
    byChannel: byChannel as Array<{ _id: string; count: number }>,
  };
}

// ─── Combined dashboard ───────────────────────────────────────────────────────

export async function getDashboardSummary(range: DateRange) {
  const [appointments, patients, revenue, notifications] = await Promise.all([
    getAppointmentStats(range),
    getPatientStats(range),
    getRevenueStats(range),
    getNotificationStats(range),
  ]);

  return { appointments, patients, revenue, notifications, range };
}
