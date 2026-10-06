import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { ApiError, get, post } from './client';
import { queryKeys } from './queryKeys';
import type {
  CompaniesResponseDto,
  CompanyDetailResponseDto,
  RunDto,
  RunsResponseDto,
} from '../types';

export function useCompanies(): UseQueryResult<CompaniesResponseDto, ApiError> {
  return useQuery({
    queryKey: queryKeys.companies.all(),
    queryFn: () => get<CompaniesResponseDto>('/api/companies'),
  });
}

export function useCompany(slug: string): UseQueryResult<CompanyDetailResponseDto, ApiError> {
  return useQuery({
    queryKey: queryKeys.companies.detail(slug),
    queryFn: () => get<CompanyDetailResponseDto>(`/api/companies/${encodeURIComponent(slug)}`),
  });
}

/** Bounds `GET /api/runs` accepts for `limit` (docs/PLAN.md#http-api). */
export const RUNS_LIMIT_MIN = 1;
export const RUNS_LIMIT_MAX = 50;

/**
 * Lists recent Runs. An out-of-range `limit` is a programming error, so it
 * throws instead of being clamped — clamping would hide the caller's bug.
 */
export function useRuns(limit: number): UseQueryResult<RunsResponseDto, ApiError> {
  if (!Number.isInteger(limit) || limit < RUNS_LIMIT_MIN || limit > RUNS_LIMIT_MAX) {
    throw new RangeError(
      `useRuns: limit must be an integer from ${RUNS_LIMIT_MIN} to ${RUNS_LIMIT_MAX}, got ${limit}`,
    );
  }
  return useQuery({
    queryKey: queryKeys.runs.list(limit),
    queryFn: () => get<RunsResponseDto>(`/api/runs?limit=${limit}`),
  });
}

/**
 * Starts a Run. A 409 means a Run already holds the lock — distinguish it
 * from any other failure with `error instanceof ApiError && error.status === 409`.
 */
export function useStartRun(): UseMutationResult<RunDto, ApiError, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => post<RunDto>('/api/runs'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.runs.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.companies.all() });
    },
  });
}
