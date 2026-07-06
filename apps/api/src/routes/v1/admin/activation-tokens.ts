import type { ServerResponse }          from 'node:http';
import type { RouteContext }             from '../../../http/router.js';
import { json, apiError }                from '../../../http/router.js';
import type { ActivationTokenService }   from '@seltriva/activation';

// ─── POST /admin/activation-tokens ───────────────────────────────────────────

export function createActivationTokenHandler(service: ActivationTokenService) {
  return async (ctx: RouteContext, res: ServerResponse): Promise<void> => {
    const body        = ctx.body as Record<string, unknown> | undefined;
    const companyId   = body?.['companyId']         as string | undefined;
    const environment = body?.['environment']        as string | undefined;
    const expiresIn   = body?.['expiresInMinutes']   as number | undefined;
    const createdBy   = body?.['createdBy']          as string | undefined;

    if (!companyId || !environment) {
      apiError(res, 'companyId and environment are required', 422, 'VALIDATION_ERROR');
      return;
    }

    if (!['production', 'staging', 'development'].includes(environment)) {
      apiError(res, 'environment must be production, staging, or development', 422, 'VALIDATION_ERROR');
      return;
    }

    const token = await service.create({
      companyId,
      environment: environment as 'production' | 'staging' | 'development',
      expiresInMinutes: expiresIn,
      createdBy,
    });

    json(res, { data: tokenToView(token) }, 201);
  };
}

// ─── GET /admin/activation-tokens ────────────────────────────────────────────

export function listActivationTokensHandler(service: ActivationTokenService) {
  return async (ctx: RouteContext, res: ServerResponse): Promise<void> => {
    const companyId = ctx.query.get('companyId') ?? undefined;

    if (!companyId) {
      apiError(res, 'companyId query parameter is required', 422, 'VALIDATION_ERROR');
      return;
    }

    const tokens = await service.listByCompany(companyId);
    json(res, { data: tokens });
  };
}

// ─── DELETE /admin/activation-tokens/:id ─────────────────────────────────────

export function deleteActivationTokenHandler(service: ActivationTokenService) {
  return async (ctx: RouteContext, res: ServerResponse): Promise<void> => {
    const { id } = ctx.params as { id: string };

    try {
      await service.revoke(id);
      res.writeHead(204);
      res.end();
    } catch (err) {
      if ((err as Error).name === 'ActivationTokenError') {
        apiError(res, (err as Error).message, 404, 'NOT_FOUND');
      } else {
        throw err;
      }
    }
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tokenToView(token: { id: string; token: string; companyId: string; environment: string; expiresAt: Date; usedAt: Date | null; createdAt: Date; createdBy: string | null }) {
  return {
    id:          token.id,
    token:       token.token,
    companyId:   token.companyId,
    environment: token.environment,
    expiresAt:   token.expiresAt.toISOString(),
    usedAt:      token.usedAt?.toISOString() ?? null,
    createdAt:   token.createdAt.toISOString(),
    createdBy:   token.createdBy,
  };
}
