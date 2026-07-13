'use client';
import { useQuery } from '@tanstack/react-query';
import { listCompanies } from '../services/atlas-api';

export function useCompanies() {
  return useQuery({
    queryKey: ['companies'],
    queryFn: listCompanies,
    staleTime: 30_000,
  });
}
