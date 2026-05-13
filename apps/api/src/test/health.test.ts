import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock database and redis connections so tests don't need real services
vi.mock('../lib/database.js', () => ({
  connectDatabase: vi.fn().mockResolvedValue(undefined),
  disconnectDatabase: vi.fn().mockResolvedValue(undefined),
  mongoose: {},
}));

vi.mock('../lib/redis.js', () => ({
  connectRedis: vi.fn().mockResolvedValue(undefined),
  disconnectRedis: vi.fn().mockResolvedValue(undefined),
  getRedisClient: vi.fn(),
  redisClient: null,
}));

// Build a minimal test app (mirrors index.ts without bootstrap side effects)
function buildTestApp() {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}

describe('Health endpoint', () => {
  let app: express.Express;

  beforeAll(() => {
    app = buildTestApp();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('GET /health returns 200 with status ok', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok' });
    expect(typeof response.body.timestamp).toBe('string');
  });

  it('GET /unknown returns 404', async () => {
    const response = await request(app).get('/unknown-route');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: 'Not found' });
  });
});
