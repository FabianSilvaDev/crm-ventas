import { z } from 'zod';

import { emailSchema } from '../identity.js';
import { Permission } from './permissions.js';

/**
 * Schemas de autenticación y autorización (`docs/api.md` §3 y §4).
 *
 * Hoy el MVP es de un solo usuario OWNER; los schemas dejan la puerta abierta a roles futuros
 * sin inventar valores que el documento no tenga.
 */

export const userRoleSchema = z.enum(['OWNER', 'ADMIN', 'MANAGER', 'AGENT']);

export type UserRole = z.infer<typeof userRoleSchema>;

export const userStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'PENDING']);

export type UserStatus = z.infer<typeof userStatusSchema>;

/** Resumen mínimo de la organización en las respuestas de auth. */
export const organizationSummarySchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
});

export type OrganizationSummary = z.infer<typeof organizationSummarySchema>;

/** Usuario tal como se expone en los endpoints autenticados. */
export const authenticatedUserSchema = z.object({
  id: z.uuid(),
  email: emailSchema,
  role: userRoleSchema,
  status: userStatusSchema,
  organizationId: z.uuid(),
  permissions: z.array(z.nativeEnum(Permission)),
});

export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Setup de primera cuenta (MVP: crea el OWNER y la organización por defecto)
// ─────────────────────────────────────────────────────────────────────────────

const passwordSchema = z
  .string()
  .min(12, 'La contraseña debe tener al menos 12 caracteres.')
  .regex(/[A-Z]/, 'Debe incluir al menos una mayúscula.')
  .regex(/[a-z]/, 'Debe incluir al menos una minúscula.')
  .regex(/\d/, 'Debe incluir al menos un número.')
  .regex(/[^A-Za-z0-9]/, 'Debe incluir al menos un símbolo.');

export const setupRequiredResponseSchema = z.strictObject({
  required: z.boolean(),
});

export type SetupRequiredResponse = z.infer<typeof setupRequiredResponseSchema>;

export const setupRequestSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  organizationName: z.string().min(1).max(120).optional(),
});

export type SetupRequest = z.infer<typeof setupRequestSchema>;

export type SetupResponse = z.infer<typeof loginResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Register (MVP: intra-organización, sin verificación de email)
// ─────────────────────────────────────────────────────────────────────────────

export const registerRequestSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  role: z.literal('AGENT'),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export type RegisterResponse = z.infer<typeof meResponseSchema>;

/**
 * Registro de OWNER adicional dentro de la organización.
 *
 * Solo existe como herramienta de desarrollo/control total: el endpoint exige que el usuario
 * autenticado sea OWNER y tenga `MANAGE_AGENTS`. No se expone en la UI normal del CRM.
 */
export const registerOwnerRequestSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
});

export type RegisterOwnerRequest = z.infer<typeof registerOwnerRequestSchema>;

export type RegisterOwnerResponse = z.infer<typeof meResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────────────────────

export const loginRequestSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1),
  rememberDevice: z.boolean().default(false),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const loginResponseSchema = z.object({
  accessToken: z.string().min(1),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().int().min(1),
  user: authenticatedUserSchema,
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Refresh
// ─────────────────────────────────────────────────────────────────────────────

export const refreshResponseSchema = z.object({
  accessToken: z.string().min(1),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().int().min(1),
  user: z.object({
    id: z.uuid(),
    permissions: z.array(z.nativeEnum(Permission)),
  }),
});

export type RefreshResponse = z.infer<typeof refreshResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Me
// ─────────────────────────────────────────────────────────────────────────────

export const meResponseSchema = z.object({
  id: z.uuid(),
  email: emailSchema,
  role: userRoleSchema,
  organization: organizationSummarySchema,
  permissions: z.array(z.nativeEnum(Permission)),
  lastLoginAt: z.iso.datetime().nullable(),
});

export type MeResponse = z.infer<typeof meResponseSchema>;
