import { z } from 'zod';

export const LoginBodySchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

export const RefreshTokenBodySchema = z.object({
  refreshToken: z.string().min(1),
});

export const ChangePasswordBodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});

export const AuditLogQuerySchema = z.object({
  limit: z.coerce.number().int().positive().optional(),
});
