/**
 * Auth Service
 *
 * Handles JWT issuance/verification, refresh token lifecycle in Redis,
 * account lockout tracking, and audit log writes for all auth events.
 *
 * Requirements: 7.1.3, 7.1.4, 7.1.5
 */

import * as jose from 'jose';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { Types } from 'mongoose';
import { getRedisClient } from '../lib/redis.js';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { AuditLog } from '../models/AuditLog.js';
import { env } from '../config/env.js';

// ─── Custom error ─────────────────────────────────────────────────────────────

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_INACTIVE'
  | 'INVALID_TOKEN';

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BCRYPT_COST = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_SECONDS = 15 * 60; // 15 minutes
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

// Redis key helpers
const redisKey = {
  refreshToken: (userId: string, tokenId: string) => `refresh:${userId}:${tokenId}`,
  loginAttempts: (email: string) => `login_attempts:${email}`,
  lockout: (email: string) => `lockout:${email}`,
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AccessTokenPayload {
  sub: string;       // userId
  role: string;      // role name
  email: string;
}

export interface RefreshTokenPayload {
  sub: string;       // userId
  jti: string;       // unique token ID (stored in Redis)
}

export interface AuthContext {
  ipAddress: string;
  userAgent: string;
}

// ─── JWT helpers ──────────────────────────────────────────────────────────────

function getAccessSecret(): Uint8Array {
  return new TextEncoder().encode(env.JWT_ACCESS_SECRET);
}

function getRefreshSecret(): Uint8Array {
  return new TextEncoder().encode(env.JWT_REFRESH_SECRET);
}

/**
 * Issue a short-lived access token (15 min).
 */
export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new jose.SignJWT({ role: payload.role, email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_EXPIRY)
    .sign(getAccessSecret());
}

/**
 * Issue a long-lived refresh token (7 days).
 * The token ID (jti) is stored in Redis so it can be revoked.
 */
export async function signRefreshToken(userId: string, tokenId: string): Promise<string> {
  return new jose.SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setJti(tokenId)
    .setIssuedAt()
    .setExpirationTime(env.JWT_REFRESH_EXPIRY)
    .sign(getRefreshSecret());
}

/**
 * Verify an access token and return its payload.
 * Throws if invalid or expired.
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jose.jwtVerify(token, getAccessSecret());
  return {
    sub: payload.sub as string,
    role: payload['role'] as string,
    email: payload['email'] as string,
  };
}

/**
 * Verify a refresh token and return its payload.
 * Throws if invalid or expired.
 */
export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const { payload } = await jose.jwtVerify(token, getRefreshSecret());
  return {
    sub: payload.sub as string,
    jti: payload.jti as string,
  };
}

// ─── Password helpers ─────────────────────────────────────────────────────────

/**
 * Hash a plain-text password with bcrypt (cost 12).
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

/**
 * Compare a plain-text password against a stored bcrypt hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── Lockout helpers ──────────────────────────────────────────────────────────

/**
 * Returns true if the account for the given email is currently locked out.
 */
export async function isAccountLocked(email: string): Promise<boolean> {
  const redis = getRedisClient();
  const locked = await redis.exists(redisKey.lockout(email));
  return locked === 1;
}

/**
 * Increment the failed login counter for an email.
 * If the counter reaches MAX_FAILED_ATTEMPTS, set the lockout key.
 * Returns the new attempt count.
 */
export async function recordFailedAttempt(email: string): Promise<number> {
  const redis = getRedisClient();
  const attemptsKey = redisKey.loginAttempts(email);

  const attempts = await redis.incr(attemptsKey);

  // Set expiry on the attempts counter so it auto-clears after lockout window
  if (attempts === 1) {
    await redis.expire(attemptsKey, LOCKOUT_DURATION_SECONDS);
  }

  if (attempts >= MAX_FAILED_ATTEMPTS) {
    // Lock the account
    await redis.set(redisKey.lockout(email), '1', 'EX', LOCKOUT_DURATION_SECONDS);
    // Reset the counter so it doesn't keep accumulating
    await redis.del(attemptsKey);
  }

  return attempts;
}

/**
 * Clear failed login attempts and any lockout for an email (called on successful login).
 */
export async function clearFailedAttempts(email: string): Promise<void> {
  const redis = getRedisClient();
  await redis.del(redisKey.loginAttempts(email), redisKey.lockout(email));
}

// ─── Refresh token storage ────────────────────────────────────────────────────

/**
 * Store a refresh token ID in Redis.
 */
async function storeRefreshToken(userId: string, tokenId: string): Promise<void> {
  const redis = getRedisClient();
  await redis.set(redisKey.refreshToken(userId, tokenId), '1', 'EX', REFRESH_TOKEN_TTL_SECONDS);
}

/**
 * Check whether a refresh token ID is still valid (exists in Redis).
 */
async function isRefreshTokenValid(userId: string, tokenId: string): Promise<boolean> {
  const redis = getRedisClient();
  const exists = await redis.exists(redisKey.refreshToken(userId, tokenId));
  return exists === 1;
}

/**
 * Revoke a specific refresh token by deleting it from Redis.
 */
async function revokeRefreshToken(userId: string, tokenId: string): Promise<void> {
  const redis = getRedisClient();
  await redis.del(redisKey.refreshToken(userId, tokenId));
}

// ─── Audit log helper ─────────────────────────────────────────────────────────

async function writeAuditLog(
  userId: string | Types.ObjectId,
  action: string,
  ctx: AuthContext,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await AuditLog.create({
      userId: new Types.ObjectId(userId.toString()),
      action,
      resourceType: 'auth',
      resourceId: new Types.ObjectId(userId.toString()),
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      timestamp: new Date(),
      metadata,
    });
  } catch (err) {
    // Audit log failures must not break the auth flow — log and continue
    console.error('Failed to write audit log:', err);
  }
}

// ─── Core auth operations ─────────────────────────────────────────────────────

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

/**
 * Authenticate a user with email + password.
 *
 * - Checks account lockout before attempting password verification
 * - Records failed attempts and triggers lockout after 5 failures
 * - Clears failed attempts on success
 * - Issues access + refresh token pair
 * - Writes audit log entry
 *
 * Requirements: 7.1.3, 7.1.4, 7.1.5
 */
export async function login(
  email: string,
  password: string,
  ctx: AuthContext,
): Promise<LoginResult> {
  const normalizedEmail = email.toLowerCase().trim();

  // Check lockout before doing any DB work
  if (await isAccountLocked(normalizedEmail)) {
    // Still write an audit log for the blocked attempt (no userId yet — use a sentinel)
    // We use a zero ObjectId as a placeholder for unknown user
    const zeroId = new Types.ObjectId('000000000000000000000000');
    await writeAuditLog(zeroId, 'auth.login.blocked', ctx, { email: normalizedEmail });

    throw new AuthError('ACCOUNT_LOCKED', 'Account is temporarily locked due to too many failed login attempts. Please try again in 15 minutes.');
  }

  // Fetch user — include passwordHash (select: false by default)
  const user = await User.findOne({ email: normalizedEmail, deletedAt: { $exists: false } })
    .select('+passwordHash')
    .populate<{ role: { name: string } }>('role', 'name')
    .lean();

  if (!user) {
    // Record failed attempt even for non-existent users (prevents user enumeration timing)
    await recordFailedAttempt(normalizedEmail);
    const zeroId = new Types.ObjectId('000000000000000000000000');
    await writeAuditLog(zeroId, 'auth.login.failed', ctx, { email: normalizedEmail, reason: 'user_not_found' });
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  if (!user.isActive) {
    await recordFailedAttempt(normalizedEmail);
    await writeAuditLog(user._id, 'auth.login.failed', ctx, { reason: 'account_inactive' });
    throw new AuthError('ACCOUNT_INACTIVE', 'Your account has been deactivated. Please contact an administrator.');
  }

  const passwordValid = await verifyPassword(password, user.passwordHash);
  if (!passwordValid) {
    const attempts = await recordFailedAttempt(normalizedEmail);
    await writeAuditLog(user._id, 'auth.login.failed', ctx, {
      reason: 'invalid_password',
      failedAttempts: attempts,
    });
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  // Successful login — clear any previous failed attempts
  await clearFailedAttempts(normalizedEmail);

  const roleName = (user.role as unknown as { name: string }).name;
  const userId = user._id.toString();
  const tokenId = uuidv4();

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken({ sub: userId, role: roleName, email: normalizedEmail }),
    signRefreshToken(userId, tokenId),
  ]);

  await storeRefreshToken(userId, tokenId);

  await writeAuditLog(user._id, 'auth.login.success', ctx, { tokenId });

  return {
    accessToken,
    refreshToken,
    user: {
      id: userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: roleName,
    },
  };
}

/**
 * Refresh an access token using a valid refresh token.
 *
 * - Verifies the JWT signature and expiry
 * - Checks the token ID exists in Redis (not revoked)
 * - Issues a new access token (refresh token is NOT rotated)
 *
 * Requirements: 7.1.3
 */
export async function refreshAccessToken(refreshTokenJwt: string): Promise<string> {
  let payload: RefreshTokenPayload;
  try {
    payload = await verifyRefreshToken(refreshTokenJwt);
  } catch {
    throw new AuthError('INVALID_TOKEN', 'Refresh token is invalid or expired.');
  }

  const valid = await isRefreshTokenValid(payload.sub, payload.jti);
  if (!valid) {
    throw new AuthError('INVALID_TOKEN', 'Refresh token has been revoked.');
  }

  // Fetch user to get current role (role may have changed since token was issued)
  const user = await User.findById(payload.sub)
    .populate<{ role: { name: string } }>('role', 'name')
    .lean();

  if (!user || !user.isActive || user.deletedAt) {
    throw new AuthError('INVALID_TOKEN', 'User account is no longer active.');
  }

  const roleName = (user.role as unknown as { name: string }).name;

  return signAccessToken({
    sub: payload.sub,
    role: roleName,
    email: user.email,
  });
}

/**
 * Logout: revoke the refresh token from Redis and write an audit log entry.
 *
 * Requirements: 7.1.3, 7.1.5
 */
export async function logout(
  refreshTokenJwt: string,
  userId: string,
  ctx: AuthContext,
): Promise<void> {
  let tokenId: string | undefined;

  try {
    const payload = await verifyRefreshToken(refreshTokenJwt);
    tokenId = payload.jti;
    await revokeRefreshToken(userId, tokenId);
  } catch {
    // Even if the token is already expired/invalid, proceed with audit log
  }

  await writeAuditLog(userId, 'auth.logout', ctx, { tokenId });
}
