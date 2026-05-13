import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import type { Request, Response } from 'express';
import { verifyAccessToken } from '../services/auth.service.js';

export interface Context {
  req: Request;
  res: Response;
  userId?: string;
  userRole?: string;
}

export async function createContext({ req, res }: CreateExpressContextOptions): Promise<Context> {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = await verifyAccessToken(token);
      return {
        req,
        res,
        userId: payload.sub,
        userRole: payload.role,
      };
    } catch {
      // Invalid or expired token — context will have no userId
    }
  }

  return { req, res };
}
