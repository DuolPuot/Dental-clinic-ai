/**
 * Users Router — admin user management
 * Create, list, deactivate, and reactivate staff accounts.
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcrypt';
import { router, protectedProcedure } from '../trpc/trpc.js';
import { requireRole } from '../trpc/trpc.js';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';

const ROLE_NAMES = ['dentist', 'receptionist', 'billing_staff', 'admin'] as const;

function serializeUser(u: {
  _id: { toString(): string };
  email: string;
  firstName: string;
  lastName: string;
  role: { name?: string } | { toString(): string };
  isActive: boolean;
  createdAt: Date;
  deletedAt?: Date;
}) {
  return {
    id:        u._id.toString(),
    email:     u.email,
    firstName: u.firstName,
    lastName:  u.lastName,
    role:      typeof u.role === 'object' && 'name' in u.role ? (u.role as { name: string }).name : u.role.toString(),
    isActive:  u.isActive,
    createdAt: u.createdAt,
    deleted:   !!u.deletedAt,
  };
}

export const usersRouter = router({

  /** List all staff users — admin only */
  list: protectedProcedure
    .use(requireRole('admin'))
    .query(async () => {
      const users = await User.find()
        .populate<{ role: { name: string } }>('role', 'name')
        .sort({ createdAt: -1 })
        .lean();
      return users.map(serializeUser);
    }),

  /** Create a new staff user — admin only */
  create: protectedProcedure
    .use(requireRole('admin'))
    .input(z.object({
      firstName: z.string().min(1).max(50),
      lastName:  z.string().min(1).max(50),
      email:     z.string().email(),
      role:      z.enum(ROLE_NAMES),
      password:  z.string().min(8).default('Demo@1234'),
    }))
    .mutation(async ({ input }) => {
      const existing = await User.findOne({ email: input.email.toLowerCase() });
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'A user with this email already exists.' });
      }

      const roleDoc = await Role.findOne({ name: input.role }).lean();
      if (!roleDoc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Role not found.' });

      const passwordHash = await bcrypt.hash(input.password, 12);
      const user = await User.create({
        firstName: input.firstName,
        lastName:  input.lastName,
        email:     input.email.toLowerCase().trim(),
        passwordHash,
        role:      roleDoc._id,
        isActive:  true,
      });

      const populated = await User.findById(user._id)
        .populate<{ role: { name: string } }>('role', 'name')
        .lean();

      return serializeUser(populated!);
    }),

  /** Deactivate a user (soft disable) — admin only */
  deactivate: protectedProcedure
    .use(requireRole('admin'))
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      if (input.userId === ctx.userId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'You cannot deactivate your own account.' });
      }
      const user = await User.findByIdAndUpdate(
        input.userId,
        { $set: { isActive: false, deletedAt: new Date() } },
        { new: true },
      ).populate<{ role: { name: string } }>('role', 'name').lean();
      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });
      return serializeUser(user);
    }),

  /** Reactivate a deactivated user — admin only */
  reactivate: protectedProcedure
    .use(requireRole('admin'))
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const user = await User.findByIdAndUpdate(
        input.userId,
        { $set: { isActive: true }, $unset: { deletedAt: '' } },
        { new: true },
      ).populate<{ role: { name: string } }>('role', 'name').lean();
      if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });
      return serializeUser(user);
    }),
});
