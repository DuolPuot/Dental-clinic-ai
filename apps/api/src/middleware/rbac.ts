/**
 * Role-Based Access Control (RBAC) Middleware
 *
 * Defines the permission matrix for all roles and provides tRPC middleware
 * helpers that enforce role permissions per procedure.
 *
 * Requirements: 7.1.1, 7.1.2
 * Property 4: Role permission enforcement
 */

import { TRPCError } from '@trpc/server';
import { middleware } from '../trpc/trpc.js';
import type { RoleName } from '../models/Role.js';

// ─── Permission Matrix ────────────────────────────────────────────────────────
//
// Structure: permissions[role][resource][action] = boolean
//
// Resources and actions are dot-notation strings used throughout the API.
// This matrix is the single source of truth for authorization decisions.

export type Action = 'read' | 'write' | 'delete' | 'admin';
export type Resource =
  | 'patients'
  | 'appointments'
  | 'treatments'
  | 'billing'
  | 'ai'
  | 'notifications'
  | 'analytics'
  | 'users'
  | 'roles'
  | 'audit_logs';

export type PermissionMatrix = Record<RoleName, Record<Resource, Record<Action, boolean>>>;

export const PERMISSION_MATRIX: PermissionMatrix = {
  admin: {
    patients:     { read: true,  write: true,  delete: true,  admin: true  },
    appointments: { read: true,  write: true,  delete: true,  admin: true  },
    treatments:   { read: true,  write: true,  delete: true,  admin: true  },
    billing:      { read: true,  write: true,  delete: true,  admin: true  },
    ai:           { read: true,  write: true,  delete: true,  admin: true  },
    notifications:{ read: true,  write: true,  delete: true,  admin: true  },
    analytics:    { read: true,  write: true,  delete: true,  admin: true  },
    users:        { read: true,  write: true,  delete: true,  admin: true  },
    roles:        { read: true,  write: true,  delete: true,  admin: true  },
    audit_logs:   { read: true,  write: false, delete: false, admin: true  },
  },

  dentist: {
    patients:     { read: true,  write: true,  delete: false, admin: false },
    appointments: { read: true,  write: true,  delete: false, admin: false },
    treatments:   { read: true,  write: true,  delete: false, admin: false },
    billing:      { read: true,  write: false, delete: false, admin: false },
    ai:           { read: true,  write: true,  delete: false, admin: false },
    notifications:{ read: true,  write: false, delete: false, admin: false },
    analytics:    { read: true,  write: false, delete: false, admin: false },
    users:        { read: false, write: false, delete: false, admin: false },
    roles:        { read: false, write: false, delete: false, admin: false },
    audit_logs:   { read: false, write: false, delete: false, admin: false },
  },

  receptionist: {
    patients:     { read: true,  write: true,  delete: false, admin: false },
    appointments: { read: true,  write: true,  delete: false, admin: false },
    treatments:   { read: true,  write: false, delete: false, admin: false },
    billing:      { read: true,  write: false, delete: false, admin: false },
    ai:           { read: false, write: false, delete: false, admin: false },
    notifications:{ read: true,  write: true,  delete: false, admin: false },
    analytics:    { read: true,  write: false, delete: false, admin: false },
    users:        { read: false, write: false, delete: false, admin: false },
    roles:        { read: false, write: false, delete: false, admin: false },
    audit_logs:   { read: false, write: false, delete: false, admin: false },
  },

  billing_staff: {
    patients:     { read: true,  write: false, delete: false, admin: false },
    appointments: { read: true,  write: false, delete: false, admin: false },
    treatments:   { read: true,  write: false, delete: false, admin: false },
    billing:      { read: true,  write: true,  delete: false, admin: false },
    ai:           { read: false, write: false, delete: false, admin: false },
    notifications:{ read: true,  write: false, delete: false, admin: false },
    analytics:    { read: true,  write: false, delete: false, admin: false },
    users:        { read: false, write: false, delete: false, admin: false },
    roles:        { read: false, write: false, delete: false, admin: false },
    audit_logs:   { read: false, write: false, delete: false, admin: false },
  },

  patient: {
    patients:     { read: true,  write: false, delete: false, admin: false },
    appointments: { read: true,  write: true,  delete: false, admin: false },
    treatments:   { read: true,  write: false, delete: false, admin: false },
    billing:      { read: true,  write: false, delete: false, admin: false },
    ai:           { read: false, write: false, delete: false, admin: false },
    notifications:{ read: true,  write: false, delete: false, admin: false },
    analytics:    { read: false, write: false, delete: false, admin: false },
    users:        { read: false, write: false, delete: false, admin: false },
    roles:        { read: false, write: false, delete: false, admin: false },
    audit_logs:   { read: false, write: false, delete: false, admin: false },
  },
};

// ─── Permission check helper ──────────────────────────────────────────────────

/**
 * Returns true if the given role has the requested permission.
 * Unknown roles or resources default to false (deny by default).
 */
export function hasPermission(
  role: string,
  resource: Resource,
  action: Action,
): boolean {
  const rolePerms = PERMISSION_MATRIX[role as RoleName];
  if (!rolePerms) return false;
  return rolePerms[resource]?.[action] ?? false;
}

// ─── tRPC middleware factories ────────────────────────────────────────────────

/**
 * Creates a tRPC middleware that:
 * 1. Requires a valid authenticated session (userId + userRole in context)
 * 2. Checks the role against the permission matrix for the given resource + action
 * 3. Throws FORBIDDEN (HTTP 403) if the check fails
 *
 * Usage:
 *   export const adminOnlyProcedure = t.procedure.use(requirePermission('users', 'admin'));
 *
 * Requirements: 7.1.1, 7.1.2
 */
export function requirePermission(resource: Resource, action: Action) {
  return middleware(({ ctx, next }) => {
    if (!ctx.userId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You must be logged in to access this resource.',
      });
    }

    if (!ctx.userRole || !hasPermission(ctx.userRole, resource, action)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `You do not have permission to perform '${action}' on '${resource}'.`,
      });
    }

    return next({ ctx });
  });
}

/**
 * Convenience middleware: requires the caller to have one of the listed roles.
 * Throws FORBIDDEN if the role is not in the allowed list.
 *
 * Usage:
 *   export const adminProcedure = t.procedure.use(requireRole('admin'));
 */
export function requireRole(...allowedRoles: RoleName[]) {
  return middleware(({ ctx, next }) => {
    if (!ctx.userId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You must be logged in to access this resource.',
      });
    }

    if (!ctx.userRole || !allowedRoles.includes(ctx.userRole as RoleName)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to perform this action.',
      });
    }

    return next({ ctx });
  });
}
