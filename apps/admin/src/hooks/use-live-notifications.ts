'use client';
import { useEffect, useRef, useState } from 'react';
import { ADMIN_API_WS_URL } from '@/lib/admin-api';
import { requestWsTicket } from '@/services/notifications.service';

export interface LiveNotification {
  type: string;
  subject?: string;
  body: string;
  receivedAt: string;
}

/**
 * Connects to the Notification Engine's WEBSOCKET channel. Auth uses a
 * short-lived ticket (minted via the authenticated REST API) as a query
 * param, since a WebSocket handshake can't carry an Authorization header.
 */
export function useLiveNotifications(enabled = true): {
  messages: LiveNotification[];
  connected: boolean;
} {
  const [messages, setMessages] = useState<LiveNotification[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function connect(): Promise<void> {
      try {
        const ticket = await requestWsTicket();
        if (cancelled) return;
        const ws = new WebSocket(`${ADMIN_API_WS_URL}/admin/fleet/ws?ticket=${ticket}`);
        socketRef.current = ws;
        ws.onopen = () => setConnected(true);
        ws.onclose = () => setConnected(false);
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data as string) as {
              type: string;
              subject?: string;
              body: string;
            };
            setMessages((prev) =>
              [{ ...data, receivedAt: new Date().toISOString() }, ...prev].slice(0, 20)
            );
          } catch {
            // ignore malformed frames
          }
        };
      } catch {
        setConnected(false);
      }
    }

    void connect();
    return () => {
      cancelled = true;
      socketRef.current?.close();
    };
  }, [enabled]);

  return { messages, connected };
}
