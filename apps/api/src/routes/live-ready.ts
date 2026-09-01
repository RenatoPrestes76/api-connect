import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../http/router.js';
import { json } from '../http/router.js';

const START_TIME = Date.now();

/** Liveness — is the process itself running? No dependency checks. */
export async function liveHandler(_ctx: RouteContext, res: ServerResponse): Promise<void> {
  json(res, {
    status: 'alive',
    uptime: Math.floor((Date.now() - START_TIME) / 1000),
    timestamp: new Date().toISOString(),
  });
}

/** Readiness — can this instance actually serve traffic right now? */
export async function readyHandler(_ctx: RouteContext, res: ServerResponse): Promise<void> {
  let database: 'ok' | 'error' = 'error';
  try {
    const { pingDB } = await import('../services/prisma.js');
    await pingDB();
    database = 'ok';
  } catch {
    database = 'error';
  }

  // No cache/queue infrastructure is wired up yet — reported honestly rather
  // than faked as 'ok'.
  const checks = {
    database,
    cache: 'not_configured' as const,
    queues: 'not_configured' as const,
  };

  const ready = database === 'ok';
  json(
    res,
    { status: ready ? 'ready' : 'not_ready', checks, timestamp: new Date().toISOString() },
    ready ? 200 : 503
  );
}
