/**
 * Analytics Router — clinic performance metrics
 *
 * Results are cached in-memory for 2 minutes per date-range key to avoid
 * hammering MongoDB with expensive aggregation pipelines on every page visit.
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../trpc/trpc.js';
import { requirePermission } from '../middleware/rbac.js';
import {
  getDashboardSummary,
  getAppointmentStats,
  getPatientStats,
  getRevenueStats,
  getNotificationStats,
} from '../services/analytics.service.js';

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cache = new Map<string, CacheEntry<any>>();

function cacheKey(prefix: string, from: Date, to: Date) {
  return `${prefix}:${from.toISOString()}:${to.toISOString()}`;
}

async function withCache<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.data as T;
  const data = await fn();
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

const rangeInput = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export const analyticsRouter = router({
  dashboard: protectedProcedure
    .use(requirePermission('analytics', 'read'))
    .input(rangeInput)
    .query(({ input }) =>
      withCache(cacheKey('dashboard', input.from, input.to), () => getDashboardSummary(input)),
    ),

  appointments: protectedProcedure
    .use(requirePermission('analytics', 'read'))
    .input(rangeInput)
    .query(({ input }) =>
      withCache(cacheKey('appointments', input.from, input.to), () => getAppointmentStats(input)),
    ),

  patients: protectedProcedure
    .use(requirePermission('analytics', 'read'))
    .input(rangeInput)
    .query(({ input }) =>
      withCache(cacheKey('patients', input.from, input.to), () => getPatientStats(input)),
    ),

  revenue: protectedProcedure
    .use(requirePermission('analytics', 'read'))
    .input(rangeInput)
    .query(({ input }) =>
      withCache(cacheKey('revenue', input.from, input.to), () => getRevenueStats(input)),
    ),

  notifications: protectedProcedure
    .use(requirePermission('analytics', 'read'))
    .input(rangeInput)
    .query(({ input }) =>
      withCache(cacheKey('notifications', input.from, input.to), () => getNotificationStats(input)),
    ),
});
