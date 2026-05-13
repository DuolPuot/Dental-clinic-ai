/**
 * Prediction Service — No-show risk scoring
 *
 * Uses historical appointment data to score the likelihood a patient
 * will not show up for their next appointment.
 *
 * Scoring factors:
 *   - Past no-show rate (heaviest weight)
 *   - Past cancellation rate
 *   - Days until appointment (shorter = lower risk)
 *   - Time of day (early morning = higher risk)
 *   - Appointment type (emergency = lower risk)
 */

import { Types } from 'mongoose';
import { Appointment } from '../models/Appointment.js';

export interface NoShowRiskResult {
  patientId: string;
  appointmentId: string;
  riskScore: number;       // 0–100
  riskLevel: 'low' | 'medium' | 'high';
  factors: string[];
  recommendation: string;
}

const EMERGENCY_TYPES = ['emergency', 'root_canal', 'extraction'];

export async function scoreNoShowRisk(
  patientId: string,
  appointmentId: string,
  appointmentStartTime: Date,
  appointmentType: string,
): Promise<NoShowRiskResult> {
  if (!Types.ObjectId.isValid(patientId)) {
    return buildResult(patientId, appointmentId, 30, []);
  }

  // Fetch patient's last 20 appointments
  const history = await Appointment.find({
    patientId: new Types.ObjectId(patientId),
    _id: { $ne: new Types.ObjectId(appointmentId) },
    startTime: { $lt: new Date() },
  })
    .sort({ startTime: -1 })
    .limit(20)
    .lean<Array<{ status: string; startTime: Date; appointmentType: string }>>();

  let score = 20; // baseline
  const factors: string[] = [];

  if (history.length === 0) {
    factors.push('No appointment history — using baseline risk');
    return buildResult(patientId, appointmentId, score, factors);
  }

  // Factor 1: No-show rate (0–40 points)
  const noShows = history.filter((a) => a.status === 'no-show').length;
  const noShowRate = noShows / history.length;
  const noShowPoints = Math.round(noShowRate * 40);
  score += noShowPoints;
  if (noShowRate > 0) {
    factors.push(`${Math.round(noShowRate * 100)}% historical no-show rate (+${noShowPoints} pts)`);
  }

  // Factor 2: Cancellation rate (0–20 points)
  const cancellations = history.filter((a) => a.status === 'cancelled').length;
  const cancelRate = cancellations / history.length;
  const cancelPoints = Math.round(cancelRate * 20);
  score += cancelPoints;
  if (cancelRate > 0.2) {
    factors.push(`High cancellation rate ${Math.round(cancelRate * 100)}% (+${cancelPoints} pts)`);
  }

  // Factor 3: Days until appointment (negative factor — reduces risk)
  const daysUntil = Math.max(0, (appointmentStartTime.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysUntil <= 1) {
    score -= 10;
    factors.push('Appointment within 24h — lower risk (-10 pts)');
  } else if (daysUntil > 14) {
    score += 10;
    factors.push('Appointment >2 weeks away — higher risk (+10 pts)');
  }

  // Factor 4: Early morning (before 8am = higher risk)
  const hour = appointmentStartTime.getHours();
  if (hour < 8) {
    score += 10;
    factors.push('Early morning slot (before 8am) (+10 pts)');
  }

  // Factor 5: Emergency/urgent types reduce risk
  if (EMERGENCY_TYPES.includes(appointmentType)) {
    score -= 15;
    factors.push(`Urgent appointment type (${appointmentType}) (-15 pts)`);
  }

  // Clamp to 0–100
  score = Math.max(0, Math.min(100, score));

  return buildResult(patientId, appointmentId, score, factors);
}

function buildResult(
  patientId: string,
  appointmentId: string,
  score: number,
  factors: string[],
): NoShowRiskResult {
  const riskLevel: 'low' | 'medium' | 'high' =
    score < 30 ? 'low' : score < 60 ? 'medium' : 'high';

  const recommendations: Record<string, string> = {
    low: 'Standard reminder 24h before appointment.',
    medium: 'Send reminder 48h and 2h before. Consider confirmation call.',
    high: 'Send reminders at 72h, 24h, and 2h. Request confirmation. Consider overbooking slot.',
  };

  return {
    patientId,
    appointmentId,
    riskScore: score,
    riskLevel,
    factors,
    recommendation: recommendations[riskLevel]!,
  };
}

/** Batch score all upcoming appointments in the next 7 days */
export async function scoreUpcomingAppointments(): Promise<NoShowRiskResult[]> {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const upcoming = await Appointment.find({
    startTime: { $gte: now, $lte: in7Days },
    status: { $in: ['scheduled', 'confirmed'] },
  })
    .lean<Array<{ _id: Types.ObjectId; patientId: Types.ObjectId; startTime: Date; appointmentType: string }>>()
    .limit(200);

  return Promise.all(
    upcoming.map((a) =>
      scoreNoShowRisk(
        a.patientId.toString(),
        a._id.toString(),
        a.startTime,
        a.appointmentType,
      ),
    ),
  );
}
