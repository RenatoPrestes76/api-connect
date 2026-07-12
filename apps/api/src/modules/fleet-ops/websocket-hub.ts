import { randomBytes } from 'node:crypto';
import type { WebSocket } from 'ws';

const TICKET_TTL_MS = 30_000;

interface Ticket {
  adminUserId: string;
  expiresAt: number;
}

/**
 * Minimal real-time hub for the Notification Engine's WEBSOCKET channel.
 * Browsers can't attach an Authorization header to a WebSocket handshake, so
 * clients first mint a short-lived one-time ticket over the normal
 * (cookie/Bearer-authenticated) REST API, then connect with `?ticket=...`.
 */
class WebSocketHub {
  private clients = new Set<WebSocket>();
  private tickets = new Map<string, Ticket>();

  issueTicket(adminUserId: string): string {
    const ticket = randomBytes(24).toString('hex');
    this.tickets.set(ticket, { adminUserId, expiresAt: Date.now() + TICKET_TTL_MS });
    return ticket;
  }

  consumeTicket(ticket: string): string | null {
    const record = this.tickets.get(ticket);
    this.tickets.delete(ticket);
    if (!record || record.expiresAt < Date.now()) return null;
    return record.adminUserId;
  }

  register(ws: WebSocket): void {
    this.clients.add(ws);
    ws.on('close', () => this.clients.delete(ws));
  }

  broadcast(payload: unknown): void {
    const message = JSON.stringify(payload);
    for (const client of this.clients) {
      if (client.readyState === client.OPEN) client.send(message);
    }
  }

  get connectionCount(): number {
    return this.clients.size;
  }
}

export const wsHub = new WebSocketHub();
