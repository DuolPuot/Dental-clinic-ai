/**
 * In-memory store replacing Redis.
 * Supports: get, set, del, exists, incr, expire, rpush, lpop
 * Used for refresh tokens, login lockouts, and notification queue.
 */

interface Entry {
  value: string | string[];
  expiresAt: number | null;
}

const store = new Map<string, Entry>();

// Clean up expired keys every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt !== null && entry.expiresAt <= now) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

function isExpired(entry: Entry): boolean {
  return entry.expiresAt !== null && entry.expiresAt <= Date.now();
}

function getRaw(key: string): Entry | null {
  const entry = store.get(key);
  if (!entry || isExpired(entry)) { store.delete(key); return null; }
  return entry;
}

export function getRedisClient() {
  return {
    status: 'ready',

    get: async (key: string): Promise<string | null> => {
      const e = getRaw(key);
      return e && typeof e.value === 'string' ? e.value : null;
    },

    set: async (key: string, value: string, mode?: string, ttl?: number): Promise<string> => {
      const expiresAt = mode === 'EX' && ttl ? Date.now() + ttl * 1000 : null;
      store.set(key, { value, expiresAt });
      return 'OK';
    },

    del: async (...keys: string[]): Promise<number> => {
      let count = 0;
      for (const k of keys) { if (store.delete(k)) count++; }
      return count;
    },

    exists: async (...keys: string[]): Promise<number> => {
      return keys.filter(k => getRaw(k) !== null).length;
    },

    incr: async (key: string): Promise<number> => {
      const e = getRaw(key);
      const current = e && typeof e.value === 'string' ? parseInt(e.value, 10) : 0;
      const next = current + 1;
      store.set(key, { value: String(next), expiresAt: e?.expiresAt ?? null });
      return next;
    },

    expire: async (key: string, ttl: number): Promise<number> => {
      const e = store.get(key);
      if (e) { store.set(key, { ...e, expiresAt: Date.now() + ttl * 1000 }); return 1; }
      return 0;
    },

    // List operations for notification queue
    rpush: async (key: string, ...values: string[]): Promise<number> => {
      const e = getRaw(key);
      const list: string[] = e && Array.isArray(e.value) ? e.value : [];
      list.push(...values);
      store.set(key, { value: list, expiresAt: null });
      return list.length;
    },

    lpop: async (key: string): Promise<string | null> => {
      const e = getRaw(key);
      if (!e || !Array.isArray(e.value) || e.value.length === 0) return null;
      const item = e.value.shift()!;
      store.set(key, { value: e.value, expiresAt: e.expiresAt });
      return item;
    },
  };
}

export async function connectRedis(): Promise<void> {
  // no-op — using in-memory store
}

export async function disconnectRedis(): Promise<void> {
  store.clear();
}

export const redisClient = null;
