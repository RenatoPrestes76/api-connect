import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as notificationsService from '@/services/notifications.service';

export function useNotifications() {
  return useQuery({
    queryKey: ['fleet-notifications'],
    queryFn: notificationsService.listNotifications,
  });
}

export function useSendTestNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsService.sendTestNotification,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fleet-notifications'] }),
  });
}
