import { getAppData, setAppData } from "@/lib/app-data";

export const AGGREGATION_CACHE_TTL_MS = 60 * 1000;

type CachedAggregation<T> = {
  generatedAt: string;
  value: T;
};

export async function getCachedAggregation<T>(key: string, builder: () => Promise<T>): Promise<T> {
  const cached = await getAppData<CachedAggregation<T> | null>(key, null);

  if (cached?.generatedAt) {
    const ageMs = Date.now() - new Date(cached.generatedAt).getTime();
    if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs < AGGREGATION_CACHE_TTL_MS) {
      return cached.value;
    }
  }

  const value = await builder();
  await setAppData(key, { generatedAt: new Date().toISOString(), value } satisfies CachedAggregation<T>);
  return value;
}

export async function setCachedAggregation<T>(key: string, value: T): Promise<void> {
  await setAppData(key, { generatedAt: new Date().toISOString(), value } satisfies CachedAggregation<T>);
}
