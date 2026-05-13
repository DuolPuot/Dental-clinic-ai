import type { IAgentSession, AgentName } from '../../models/AgentSession.js';

export interface AgentResult {
  success: boolean;
  update: Partial<IAgentSession>;
  error?: string;
  nonRetryable?: boolean; // if true, orchestrator fails immediately without retrying
}

export abstract class BaseAgent {
  abstract readonly name: AgentName;
  abstract readonly timeoutMs: number;

  abstract execute(session: IAgentSession): Promise<AgentResult>;
}

export class AgentTimeoutError extends Error {
  constructor(agentName: string, timeoutMs: number) {
    super(`${agentName} timed out after ${timeoutMs}ms`);
    this.name = 'AgentTimeoutError';
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, agentName: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new AgentTimeoutError(agentName, ms)), ms),
    ),
  ]);
}
