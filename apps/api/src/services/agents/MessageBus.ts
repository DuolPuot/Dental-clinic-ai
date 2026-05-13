import { EventEmitter } from 'events';
import { getRedisClient } from '../../lib/redis.js';
import type { AgentName } from '../../models/AgentSession.js';

export interface BusEvent {
  sessionId: string;
  agentName: AgentName;
  eventType: 'completed' | 'failed' | 'alert';
  payload: Record<string, unknown>; // no PHI in plaintext
  timestamp: string; // ISO 8601
}

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

export class MessageBus {
  async publish(event: BusEvent): Promise<void> {
    const json = JSON.stringify(event);

    // Persist to Redis list for durability
    try {
      await getRedisClient().rpush(`mas:events:${event.sessionId}`, json);
    } catch (err) {
      console.warn('[MessageBus] MESSAGE_BUS_UNAVAILABLE — Redis write failed, using in-process only:', err);
    }

    // Always emit in-process regardless of Redis result
    emitter.emit(`session:${event.sessionId}`, event);
    emitter.emit('all', event);
  }

  subscribe(sessionId: string, handler: (event: BusEvent) => void): () => void {
    const key = `session:${sessionId}`;
    emitter.on(key, handler);
    return () => emitter.off(key, handler);
  }
}

export const messageBus = new MessageBus();
