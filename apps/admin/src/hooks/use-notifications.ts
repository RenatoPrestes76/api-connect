import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import * as notificationsService from '@/services/notifications.service';

export function useNotifications(): UseQueryResult<
  Awaited<ReturnType<typeof notificationsService.listNotifications>>
> {
  return useQuery({
    queryKey: ['fleet-notifications'],
    queryFn: notificationsService.listNotifications,
  });
}

export function useSendTestNotification(): UseMutationResult<
  Awaited<ReturnType<typeof notificationsService.sendTestNotification>>,
  Error,
  Parameters<typeof notificationsService.sendTestNotification>[0]
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsService.sendTestNotification,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fleet-notifications'] }),
  });
}
