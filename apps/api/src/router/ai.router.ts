/**
 * AI Router
 *
 * tRPC procedures for AI clinical decision support and X-ray analysis.
 * Every response includes a mandatory disclaimer (Property 7).
 *
 * Requirements: 3.1.1–3.1.5, 3.2.1–3.2.4
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, publicProcedure } from '../trpc/trpc.js';
import { requirePermission } from '../middleware/rbac.js';
import { getDecisionSupport, analyzeXray, chat, patientChat, type ChatMessage } from '../services/ai.service.js';

export const aiRouter = router({
  /**
   * POST /trpc/ai.getDecisionSupport
   * Generate clinical decision support output from symptoms and history.
   * Requirements: 3.1.1–3.1.5
   */
  getDecisionSupport: protectedProcedure
    .use(requirePermission('ai', 'read'))
    .input(
      z.object({
        symptoms: z.string().min(1).max(2000),
        patientHistorySummary: z.string().max(3000).optional(),
        currentMedications: z.array(z.string().max(200)).max(50).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const result = await getDecisionSupport(input);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'AI service unavailable.';
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: msg });
      }
    }),

  /**
   * POST /trpc/ai.analyzeXray
   * Analyze a dental X-ray image via vision model.
   * Accepts a pre-signed S3 URL. Enforces 30-second timeout.
   * Requirements: 3.2.1–3.2.4
   */
  analyzeXray: protectedProcedure
    .use(requirePermission('ai', 'read'))
    .input(
      z.object({
        imageUrl: z.string().url('Must be a valid URL'),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const result = await analyzeXray(input.imageUrl);
        return result;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          throw new TRPCError({
            code: 'TIMEOUT',
            message: 'X-ray analysis timed out after 30 seconds.',
          });
        }
        const msg = err instanceof Error ? err.message : 'X-ray analysis failed.';
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: msg });
      }
    }),

  /**
   * POST /trpc/ai.chat
   * General-purpose dental assistant chatbot (staff, authenticated).
   */
  chat: protectedProcedure
    .input(
      z.object({
        messages: z.array(
          z.object({
            role: z.enum(['user', 'assistant']),
            content: z.string().max(2000),
          }),
        ).max(20),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const reply = await chat(input.messages as ChatMessage[]);
        return { reply };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Chat unavailable.';
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: msg });
      }
    }),

  /**
   * POST /trpc/ai.publicChat
   * Patient-facing chatbot — no authentication required.
   * Answers clinic info questions and guides patients to book.
   */
  publicChat: publicProcedure
    .input(
      z.object({
        messages: z.array(
          z.object({
            role: z.enum(['user', 'assistant']),
            content: z.string().max(1000),
          }),
        ).max(20),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const reply = await patientChat(input.messages as ChatMessage[]);
        return { reply };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Chat unavailable.';
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: msg });
      }
    }),
});
