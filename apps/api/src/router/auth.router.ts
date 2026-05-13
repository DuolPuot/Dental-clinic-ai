/**
 * Auth Router
 *
 * tRPC procedures for authentication:
 *   - auth.login    — validate credentials, issue token pair
 *   - auth.refresh  — exchange refresh token for new access token
 *   - auth.logout   — revoke refresh token
 *
 * Requirements: 7.1.3, 7.1.4, 7.1.5
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from '../trpc/trpc.js';
import {
  login,
  refreshAccessToken,
  logout,
  AuthError,
} from '../services/auth.service.js';

// ─── Input schemas ────────────────────────────────────────────────────────────

const loginInput = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshInput = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const logoutInput = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// ─── Helper: extract request context ─────────────────────────────────────────

function getAuthContext(req: { ip?: string; headers: Record<string, string | string[] | undefined> }) {
  return {
    ipAddress: (req.headers['x-forwarded-for'] as string) ?? req.ip ?? 'unknown',
    userAgent: (req.headers['user-agent'] as string) ?? 'unknown',
  };
}

// ─── Helper: map AuthError to TRPCError ──────────────────────────────────────

function toTRPCError(err: AuthError): TRPCError {
  switch (err.code) {
    case 'INVALID_CREDENTIALS':
      return new TRPCError({ code: 'UNAUTHORIZED', message: err.message });
    case 'ACCOUNT_LOCKED':
      return new TRPCError({ code: 'TOO_MANY_REQUESTS', message: err.message });
    case 'ACCOUNT_INACTIVE':
      return new TRPCError({ code: 'FORBIDDEN', message: err.message });
    case 'INVALID_TOKEN':
      return new TRPCError({ code: 'UNAUTHORIZED', message: err.message });
    default:
      return new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Authentication error.' });
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const authRouter = router({
  /**
   * POST /trpc/auth.login
   *
   * Validates credentials, checks lockout, issues access + refresh token pair.
   * Records audit log entry on success and failure.
   *
   * Requirements: 7.1.3, 7.1.4, 7.1.5
   */
  login: publicProcedure
    .input(loginInput)
    .mutation(async ({ input, ctx }) => {
      const authCtx = getAuthContext(ctx.req);

      try {
        const result = await login(input.email, input.password, authCtx);
        return {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          user: result.user,
        };
      } catch (err) {
        if (err instanceof AuthError) {
          throw toTRPCError(err);
        }
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[auth.login] Unexpected error:', err);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Login failed: ${msg}`,
        });
      }
    }),

  /**
   * POST /trpc/auth.refresh
   *
   * Validates the refresh token (JWT signature + Redis presence),
   * then issues a new access token.
   *
   * Requirements: 7.1.3
   */
  refresh: publicProcedure
    .input(refreshInput)
    .mutation(async ({ input }) => {
      try {
        const accessToken = await refreshAccessToken(input.refreshToken);
        return { accessToken };
      } catch (err) {
        if (err instanceof AuthError) {
          throw toTRPCError(err);
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred during token refresh.',
        });
      }
    }),

  /**
   * POST /trpc/auth.logout
   *
   * Revokes the refresh token from Redis and writes an audit log entry.
   * Requires a valid access token (authenticated session).
   *
   * Requirements: 7.1.3, 7.1.5
   */
  logout: protectedProcedure
    .input(logoutInput)
    .mutation(async ({ input, ctx }) => {
      const authCtx = getAuthContext(ctx.req);

      await logout(input.refreshToken, ctx.userId, authCtx);

      return { success: true };
    }),
});
