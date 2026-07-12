import type { NotificationChannel } from './types.js';
import { wsHub } from './websocket-hub.js';

export interface DeliveryResult {
  status: 'SENT' | 'FAILED';
  error?: string;
}

export interface DeliveryInput {
  channel: NotificationChannel;
  target: string;
  subject?: string;
  body: string;
}

/**
 * Channel adapters. This sandbox has no real SMTP/Slack/Teams credentials, so
 * EMAIL/SLACK/TEAMS are simulated (logged, marked SENT) — the same "in-memory
 * when infra unavailable" pattern used everywhere else in this codebase.
 * WEBHOOK performs a real HTTP POST to `target`. WEBSOCKET pushes to any
 * live-connected admin clients via the in-process hub (see websocket-hub.ts).
 */
export async function deliverNotification(input: DeliveryInput): Promise<DeliveryResult> {
  switch (input.channel) {
    case 'WEBSOCKET': {
      wsHub.broadcast({ type: 'notification', subject: input.subject, body: input.body });
      return { status: 'SENT' };
    }
    case 'WEBHOOK': {
      try {
        const res = await fetch(input.target, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject: input.subject, body: input.body }),
        });
        if (!res.ok) return { status: 'FAILED', error: `Webhook responded ${res.status}` };
        return { status: 'SENT' };
      } catch (err) {
        return {
          status: 'FAILED',
          error: err instanceof Error ? err.message : 'Webhook delivery failed',
        };
      }
    }
    case 'EMAIL':
    case 'SLACK':
    case 'TEAMS': {
      // Simulated — no provider credentials configured in this environment.
      console.log(
        `[notification:${input.channel}] to=${input.target} subject=${input.subject ?? ''} body=${input.body}`
      );
      return { status: 'SENT' };
    }
    default:
      return { status: 'FAILED', error: 'Unknown channel' };
  }
}
