import { fleetGet, fleetPost } from '@/lib/fleet-client';
import type { FleetNotification, NotificationChannel } from '@/types/fleet';

export async function listNotifications(): Promise<FleetNotification[]> {
  const data = await fleetGet<{ notifications: FleetNotification[] }>('/notifications');
  return data.notifications;
}

export async function sendTestNotification(input: {
  channel: NotificationChannel;
  target: string;
  subject?: string;
  body: string;
}): Promise<FleetNotification> {
  return fleetPost<FleetNotification>('/notifications/test', input);
}

export async function requestWsTicket(): Promise<string> {
  const data = await fleetPost<{ ticket: string }>('/notifications/ws-ticket');
  return data.ticket;
}
