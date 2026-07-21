'use client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { listCompanies } from '../services/atlas-api';

export function useCompanies(): UseQueryResult<Awaited<ReturnType<typeof listCompanies>>> {
  return useQuery({
    queryKey: ['companies'],
    queryFn: listCompanies,
    staleTime: 30_000,
  });
}
