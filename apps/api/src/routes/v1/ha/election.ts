import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { leaderElection } from '../../../modules/ha/leader-election.js';

export function registerHaElectionRoutes(router: { get: Function; post: Function }): void {
  router.get('/api/v1/ha/election/history', (ctx: RouteContext, res: ServerResponse) => {
    const limit = Math.min(parseInt(ctx.query.get('limit') ?? '50', 10), 200);
    json(res, {
      term: leaderElection.getCurrentTerm(),
      history: leaderElection.getHistory().slice(0, limit),
    });
  });

  router.post('/api/v1/ha/election/run', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    const { reason = 'Manual election requested by admin', force = false } = body;

    const result = leaderElection.runElection({
      reason,
      triggeredBy: 'manual',
      force: Boolean(force),
    });
    if (!result) {
      return apiError(
        res,
        'Election did not produce a new leader (quorum not met or no eligible candidate) — see /api/v1/ha/election/history',
        409,
        'ELECTION_NOT_COMPLETED'
      );
    }
    json(res, result);
  });

  router.post('/api/v1/ha/election/simulate-failure', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    const { nodeId } = body;
    if (!nodeId) return apiError(res, '"nodeId" is required', 400, 'MISSING_FIELDS');

    const node = leaderElection.simulateNodeFailure(nodeId);
    if (!node) return apiError(res, 'Node not found', 404, 'NOT_FOUND');
    json(res, node);
  });

  router.post('/api/v1/ha/election/recover', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    const { nodeId } = body;
    if (!nodeId) return apiError(res, '"nodeId" is required', 400, 'MISSING_FIELDS');

    const node = leaderElection.recoverNode(nodeId);
    if (!node) return apiError(res, 'Node not found', 404, 'NOT_FOUND');
    json(res, node);
  });
}
