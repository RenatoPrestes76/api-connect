/**
 * Sprint 46.18 — structural request validation at the HTTP boundary.
 *
 * `RouteContext.body`/`query`/`params` are deliberately untyped at the
 * router level (see the comment on `RouteContext.body` in router.ts) — this
 * module is the "dedicated pass" that comment asked for: a thin, explicit
 * per-handler validation step, not a global middleware, so each route opts
 * in with its own schema right where it already reads its input. Mirrors
 * the existing composable-wrapper idiom used by requirePermission()/
 * requireRuntimeAuth() elsewhere in this codebase, but as a call at the top
 * of the handler rather than a wrapping HOF — body/query/param schemas are
 * per-handler data shapes, not cross-cutting concerns like auth.
 *
 * Deliberately NOT a validation framework: no schema registry, no implicit
 * coercion beyond what a schema author asks for with z.coerce, no request
 * lifecycle hooks. Just "parse this against that schema, or reject with the
 * project's existing { error: { code, message } } shape."
 */
import type { ZodError, ZodTypeAny, z } from 'zod';
import type { ServerResponse } from 'node:http';
import type { RouteContext } from './router.js';
import { apiError } from './router.js';

/** VALIDATION_ERROR/422 is already the dominant existing convention across
 * this codebase's hand-written `if (!field) apiError(...)` checks — reused
 * here rather than inventing a new code, per the project's own established
 * pattern. */
const VALIDATION_ERROR_STATUS = 422;
const VALIDATION_ERROR_CODE = 'VALIDATION_ERROR';

/**
 * A handful of pre-existing handlers already had ad-hoc presence checks with
 * their OWN status/code — some load-bearing on a real, tested, frontend-
 * consumed contract (e.g. admin-identity login's 400/MISSING_FIELDS, which
 * apps/admin's login page maps to a specific Portuguese message). Replacing
 * those with the new generic 422/VALIDATION_ERROR would be a contract
 * break, not a fix — so callers migrating such a handler to a real schema
 * (closing the *type*-safety gap the old check missed, e.g. a non-string
 * email) can supply the exact legacy shape to preserve here instead.
 */
export interface ValidationErrorOverride {
  status: number;
  code: string;
  message: string;
}

/**
 * Zod's default issue messages ("Required", "Expected string, received
 * number") are already client-appropriate — this only adds the field path
 * for context. It intentionally does NOT include issue.code, the Zod
 * version, or anything else that would read as an internal implementation
 * detail rather than a description of what the caller sent wrong.
 */
function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}

/**
 * Validates ctx.body against `schema`. On failure, writes a 422
 * VALIDATION_ERROR response and returns undefined — callers must check for
 * that and return immediately, exactly like the existing
 * `if (!x) return apiError(...)` idiom used throughout routes/v1/**.
 */
export function parseBody<S extends ZodTypeAny>(
  schema: S,
  ctx: RouteContext,
  res: ServerResponse,
  onError?: ValidationErrorOverride
): z.infer<S> | undefined {
  const result = schema.safeParse(ctx.body);
  if (!result.success) {
    if (onError) {
      apiError(res, onError.message, onError.status, onError.code);
    } else {
      apiError(
        res,
        `Invalid request body: ${formatZodError(result.error)}`,
        VALIDATION_ERROR_STATUS,
        VALIDATION_ERROR_CODE
      );
    }
    return undefined;
  }
  return result.data;
}

/**
 * Validates query parameters against `schema`. URLSearchParams is flattened
 * to a plain object first — every value arrives as a string (HTTP has no
 * concept of a numeric/boolean query param), so schemas that need a number
 * or boolean must say so explicitly with z.coerce.number()/z.coerce.boolean()
 * rather than relying on any implicit conversion here.
 */
export function parseQuery<S extends ZodTypeAny>(
  schema: S,
  ctx: RouteContext,
  res: ServerResponse
): z.infer<S> | undefined {
  const raw = Object.fromEntries(ctx.query.entries());
  const result = schema.safeParse(raw);
  if (!result.success) {
    apiError(
      res,
      `Invalid query parameters: ${formatZodError(result.error)}`,
      VALIDATION_ERROR_STATUS,
      VALIDATION_ERROR_CODE
    );
    return undefined;
  }
  return result.data;
}

/** Validates path params (ctx.params) against `schema` — same shape/behavior as parseQuery. */
export function parseParams<S extends ZodTypeAny>(
  schema: S,
  ctx: RouteContext,
  res: ServerResponse
): z.infer<S> | undefined {
  const result = schema.safeParse(ctx.params);
  if (!result.success) {
    apiError(
      res,
      `Invalid path parameters: ${formatZodError(result.error)}`,
      VALIDATION_ERROR_STATUS,
      VALIDATION_ERROR_CODE
    );
    return undefined;
  }
  return result.data;
}
