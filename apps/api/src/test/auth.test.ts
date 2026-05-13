/**
 * Auth Module Unit Tests
 *
 * Tests for: login, token refresh, logout, account lockout, and RBAC.
 * Requirements: 7.1.1, 7.1.2, 7.1.3, 7.1.4, 7.1.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Types } from 'mongoose';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock Redis
const redisMock: Record<string, string> = {};
const redisExpiry: Record<string, number> = {};

const mockRedis = {
  get: vi.fn(async (key: string) => redisMock[key] ?? null),
  set: vi.fn(async (key: string, value: string, ...args: unknown[]) => {
    redisMock[key] = value;
    // Handle EX option
    const exIdx = (args as string[]).indexOf('EX');
    if (exIdx !== -1) {
      redisExpiry[key] = (args as number[])[exIdx + 1];
    }
    return 'OK';
  }),
  del: vi.fn(async (...keys: string[]) => {
    for (const k of keys) {
      delete redisMock[k];
      delete redisExpiry[k];
    }
    return keys.length;
  }),
  exists: vi.fn(async (key: string) => (redisMock[key] !== undefined ? 1 : 0)),
  incr: vi.fn(async (key: string) => {
    const current = parseInt(redisMock[key] ?? '0', 10);
    const next = current + 1;
    redisMock[key] = String(next);
    return next;
  }),
  expire: vi.fn(async (key: string, seconds: number) => {
    redisExpiry[key] = seconds;
    return 1;
  }),
};

vi.mock('../lib/redis.js', () => ({
  getRedisClient: () => mockRedis,
}));

// Mock Mongoose User model
const mockUserFindOne = vi.fn();
const mockUserFindById = vi.fn();

vi.mock('../models/User.js', () => ({
  User: {
    findOne: (...args: unknown[]) => mockUserFindOne(...args),
    findById: (...args: unknown[]) => mockUserFindById(...args),
  },
}));

// Mock AuditLog model
vi.mock('../models/AuditLog.js', () => ({
  AuditLog: {
    create: vi.fn().mockResolvedValue({}),
  },
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import {
  login,
  refreshAccessToken,
  logout,
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  isAccountLocked,
  recordFailedAttempt,
  clearFailedAttempts,
  AuthError,
} from '../services/auth.service.js';

import { hasPermission, PERMISSION_MATRIX } from '../middleware/rbac.js';

// ─── Test helpers ─────────────────────────────────────────────────────────────

const TEST_CTX = { ipAddress: '127.0.0.1', userAgent: 'vitest' };

function makeUser(overrides: Partial<{
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  deletedAt: Date | undefined;
  role: { name: string };
}> = {}) {
  return {
    _id: new Types.ObjectId(),
    email: 'test@example.com',
    passwordHash: '',
    firstName: 'Test',
    lastName: 'User',
    isActive: true,
    deletedAt: undefined,
    role: { name: 'dentist' },
    ...overrides,
  };
}

/** Build a chainable Mongoose query mock that resolves to `value`. */
function queryMock(value: unknown) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    populate: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(value),
  };
  return chain;
}

// ─── Password hashing ─────────────────────────────────────────────────────────

describe('hashPassword / verifyPassword', () => {
  it('hashes a password and verifies it correctly', async () => {
    const hash = await hashPassword('MySecret123!');
    expect(hash).not.toBe('MySecret123!');
    expect(hash.startsWith('$2b$')).toBe(true);
    await expect(verifyPassword('MySecret123!', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct');
    await expect(verifyPassword('wrong', hash)).resolves.toBe(false);
  });
});

// ─── JWT signing / verification ───────────────────────────────────────────────

describe('JWT access token', () => {
  it('signs and verifies an access token', async () => {
    const userId = new Types.ObjectId().toString();
    const token = await signAccessToken({ sub: userId, role: 'admin', email: 'a@b.com' });
    const payload = await verifyAccessToken(token);
    expect(payload.sub).toBe(userId);
    expect(payload.role).toBe('admin');
    expect(payload.email).toBe('a@b.com');
  });

  it('throws on a tampered access token', async () => {
    const token = await signAccessToken({ sub: 'x', role: 'admin', email: 'x@x.com' });
    await expect(verifyAccessToken(token + 'tampered')).rejects.toThrow();
  });
});

describe('JWT refresh token', () => {
  it('signs and verifies a refresh token', async () => {
    const userId = new Types.ObjectId().toString();
    const tokenId = 'test-jti-123';
    const token = await signRefreshToken(userId, tokenId);
    const payload = await verifyRefreshToken(token);
    expect(payload.sub).toBe(userId);
    expect(payload.jti).toBe(tokenId);
  });
});

// ─── Account lockout ──────────────────────────────────────────────────────────

describe('Account lockout', () => {
  beforeEach(() => {
    // Clear mock Redis state
    for (const k of Object.keys(redisMock)) delete redisMock[k];
    for (const k of Object.keys(redisExpiry)) delete redisExpiry[k];
    vi.clearAllMocks();
  });

  it('is not locked initially', async () => {
    await expect(isAccountLocked('user@test.com')).resolves.toBe(false);
  });

  it('locks after 5 failed attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await recordFailedAttempt('user@test.com');
    }
    await expect(isAccountLocked('user@test.com')).resolves.toBe(true);
  });

  it('clears lockout and attempts on clearFailedAttempts', async () => {
    for (let i = 0; i < 5; i++) {
      await recordFailedAttempt('user@test.com');
    }
    await clearFailedAttempts('user@test.com');
    await expect(isAccountLocked('user@test.com')).resolves.toBe(false);
  });

  it('sets lockout TTL to 15 minutes (900 seconds)', async () => {
    for (let i = 0; i < 5; i++) {
      await recordFailedAttempt('lockout-ttl@test.com');
    }
    const lockoutKey = 'lockout:lockout-ttl@test.com';
    expect(redisExpiry[lockoutKey]).toBe(900);
  });
});

// ─── Login ────────────────────────────────────────────────────────────────────

describe('login()', () => {
  beforeEach(async () => {
    for (const k of Object.keys(redisMock)) delete redisMock[k];
    for (const k of Object.keys(redisExpiry)) delete redisExpiry[k];
    vi.clearAllMocks();
  });

  it('returns token pair and user info on valid credentials', async () => {
    const hash = await hashPassword('password123');
    const user = makeUser({ passwordHash: hash });
    mockUserFindOne.mockReturnValue(queryMock(user));

    const result = await login('test@example.com', 'password123', TEST_CTX);

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.user.email).toBe('test@example.com');
    expect(result.user.role).toBe('dentist');
  });

  it('throws INVALID_CREDENTIALS for unknown email', async () => {
    mockUserFindOne.mockReturnValue(queryMock(null));

    await expect(login('nobody@example.com', 'pass', TEST_CTX)).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('throws INVALID_CREDENTIALS for wrong password', async () => {
    const hash = await hashPassword('correct');
    const user = makeUser({ passwordHash: hash });
    mockUserFindOne.mockReturnValue(queryMock(user));

    await expect(login('test@example.com', 'wrong', TEST_CTX)).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('throws ACCOUNT_INACTIVE for inactive user', async () => {
    const hash = await hashPassword('pass');
    const user = makeUser({ passwordHash: hash, isActive: false });
    mockUserFindOne.mockReturnValue(queryMock(user));

    await expect(login('test@example.com', 'pass', TEST_CTX)).rejects.toMatchObject({
      code: 'ACCOUNT_INACTIVE',
    });
  });

  it('throws ACCOUNT_LOCKED when account is locked', async () => {
    // Pre-set lockout in mock Redis
    redisMock['lockout:test@example.com'] = '1';

    await expect(login('test@example.com', 'pass', TEST_CTX)).rejects.toMatchObject({
      code: 'ACCOUNT_LOCKED',
    });
  });

  it('increments failed attempts on wrong password', async () => {
    const hash = await hashPassword('correct');
    const user = makeUser({ passwordHash: hash });
    mockUserFindOne.mockReturnValue(queryMock(user));

    await expect(login('test@example.com', 'wrong', TEST_CTX)).rejects.toThrow();

    const attemptsKey = 'login_attempts:test@example.com';
    expect(redisMock[attemptsKey]).toBe('1');
  });

  it('clears failed attempts on successful login', async () => {
    const hash = await hashPassword('correct');
    const user = makeUser({ passwordHash: hash });
    // Pre-set some failed attempts
    redisMock['login_attempts:test@example.com'] = '3';
    mockUserFindOne.mockReturnValue(queryMock(user));

    await login('test@example.com', 'correct', TEST_CTX);

    expect(redisMock['login_attempts:test@example.com']).toBeUndefined();
  });

  it('stores refresh token in Redis after successful login', async () => {
    const hash = await hashPassword('pass');
    const user = makeUser({ passwordHash: hash });
    mockUserFindOne.mockReturnValue(queryMock(user));

    const result = await login('test@example.com', 'pass', TEST_CTX);

    // Verify the refresh token payload to get the tokenId
    const payload = await verifyRefreshToken(result.refreshToken);
    const redisKey = `refresh:${user._id.toString()}:${payload.jti}`;
    expect(redisMock[redisKey]).toBe('1');
  });
});

// ─── Token refresh ────────────────────────────────────────────────────────────

describe('refreshAccessToken()', () => {
  beforeEach(() => {
    for (const k of Object.keys(redisMock)) delete redisMock[k];
    vi.clearAllMocks();
  });

  it('issues a new access token for a valid refresh token', async () => {
    const userId = new Types.ObjectId().toString();
    const tokenId = 'valid-jti';
    const refreshToken = await signRefreshToken(userId, tokenId);

    // Store in mock Redis
    redisMock[`refresh:${userId}:${tokenId}`] = '1';

    // Mock user lookup
    mockUserFindById.mockReturnValue(queryMock({
      _id: new Types.ObjectId(userId),
      email: 'user@test.com',
      isActive: true,
      deletedAt: undefined,
      role: { name: 'receptionist' },
    }));

    const newAccessToken = await refreshAccessToken(refreshToken);
    const payload = await verifyAccessToken(newAccessToken);

    expect(payload.sub).toBe(userId);
    expect(payload.role).toBe('receptionist');
  });

  it('throws INVALID_TOKEN for a revoked refresh token', async () => {
    const userId = new Types.ObjectId().toString();
    const tokenId = 'revoked-jti';
    const refreshToken = await signRefreshToken(userId, tokenId);
    // Do NOT store in Redis — simulates revoked token

    await expect(refreshAccessToken(refreshToken)).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
    });
  });

  it('throws INVALID_TOKEN for a malformed token', async () => {
    await expect(refreshAccessToken('not.a.valid.jwt')).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
    });
  });
});

// ─── Logout ───────────────────────────────────────────────────────────────────

describe('logout()', () => {
  beforeEach(() => {
    for (const k of Object.keys(redisMock)) delete redisMock[k];
    vi.clearAllMocks();
  });

  it('revokes the refresh token from Redis', async () => {
    const userId = new Types.ObjectId().toString();
    const tokenId = 'logout-jti';
    const refreshToken = await signRefreshToken(userId, tokenId);
    redisMock[`refresh:${userId}:${tokenId}`] = '1';

    await logout(refreshToken, userId, TEST_CTX);

    expect(redisMock[`refresh:${userId}:${tokenId}`]).toBeUndefined();
  });

  it('completes without error even if token is already expired/invalid', async () => {
    const userId = new Types.ObjectId().toString();
    await expect(logout('invalid.token.here', userId, TEST_CTX)).resolves.not.toThrow();
  });
});

// ─── RBAC permission matrix ───────────────────────────────────────────────────

describe('RBAC permission matrix', () => {
  it('admin has full access to all resources', () => {
    const resources = Object.keys(PERMISSION_MATRIX.admin) as Array<keyof typeof PERMISSION_MATRIX.admin>;
    for (const resource of resources) {
      expect(hasPermission('admin', resource, 'read')).toBe(true);
      expect(hasPermission('admin', resource, 'write')).toBe(
        resource === 'audit_logs' ? false : true,
      );
    }
  });

  it('patient cannot access AI resource', () => {
    expect(hasPermission('patient', 'ai', 'read')).toBe(false);
    expect(hasPermission('patient', 'ai', 'write')).toBe(false);
  });

  it('billing_staff can read/write billing but not users', () => {
    expect(hasPermission('billing_staff', 'billing', 'read')).toBe(true);
    expect(hasPermission('billing_staff', 'billing', 'write')).toBe(true);
    expect(hasPermission('billing_staff', 'users', 'read')).toBe(false);
  });

  it('receptionist cannot access AI', () => {
    expect(hasPermission('receptionist', 'ai', 'read')).toBe(false);
  });

  it('dentist can read and write treatments', () => {
    expect(hasPermission('dentist', 'treatments', 'read')).toBe(true);
    expect(hasPermission('dentist', 'treatments', 'write')).toBe(true);
  });

  it('dentist cannot manage users', () => {
    expect(hasPermission('dentist', 'users', 'read')).toBe(false);
    expect(hasPermission('dentist', 'users', 'write')).toBe(false);
  });

  it('unknown role is denied by default', () => {
    expect(hasPermission('unknown_role', 'patients', 'read')).toBe(false);
  });

  it('audit_logs are read-only even for admin', () => {
    expect(hasPermission('admin', 'audit_logs', 'read')).toBe(true);
    expect(hasPermission('admin', 'audit_logs', 'write')).toBe(false);
    expect(hasPermission('admin', 'audit_logs', 'delete')).toBe(false);
  });
});
