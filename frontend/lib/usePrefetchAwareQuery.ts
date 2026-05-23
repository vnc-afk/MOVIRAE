import { useEffect } from "react";
import { useQuery, type UseQueryOptions, type QueryKey } from "@tanstack/react-query";
import telemetry from "@/lib/prefetchTelemetry";

/**
 * Wraps useQuery and automatically tracks prefetch hits/misses via telemetry.
 * Call markHit when the query succeeds with fresh data (assumes data came from prefetch).
 * Call markMiss when the query runs but no prefetch was available.
 */
export function usePrefetchAwareQuery<TData, TError = Error>(
  options: UseQueryOptions<TData, TError, TData, QueryKey>
) {
  const query = useQuery(options);

  // Mark hit when data becomes available (indicates a successful prefetch + navigation)
  useEffect(() => {
    if (options.queryKey && query.isSuccess && query.data !== undefined) {
      try {
        telemetry.markHit(options.queryKey);
      } catch (e) {
        console.debug("Failed to mark prefetch hit", e);
      }
    }
  }, [query.isSuccess, query.data, options.queryKey]);

  // Mark miss when query fails or runs without data (no prefetch available)
  useEffect(() => {
    if (options.queryKey && query.isLoading && !query.data) {
      try {
        telemetry.markMiss(options.queryKey);
      } catch (e) {
        console.debug("Failed to mark prefetch miss", e);
      }
    }
  }, [query.isLoading, query.data, options.queryKey]);

  return query;
}

export default usePrefetchAwareQuery;
