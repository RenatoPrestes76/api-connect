import { z } from 'zod';

export const ApproveBodySchema = z.object({
  organizationId: z.string().min(1),
  modelId: z.string().min(1),
});

export const BuildBodySchema = z.object({
  organizationId: z.string().min(1),
});

export const RollbackBodySchema = z.object({
  organizationId: z.string().min(1),
  targetModelId: z.string().min(1),
});

/**
 * Matches the whitelist GET /canonical-model/:organizationId (get.ts)
 * already enforces — entities.ts/fields.ts previously defaulted ANY
 * non-'latest' value (typos included) straight to 'approved' rather than
 * rejecting it, an inconsistency with their own sibling route rather than a
 * deliberate contract.
 */
export const ModelStatusQuerySchema = z.object({
  organizationId: z.string().min(1),
  status: z.enum(['approved', 'latest']).optional(),
});

export const FieldsQuerySchema = ModelStatusQuerySchema.extend({
  entityId: z.string().min(1).optional(),
});
