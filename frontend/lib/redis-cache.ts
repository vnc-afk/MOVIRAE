import Redis from "ioredis";

const REDIS_CACHE_PREFIX = "movirae:cache";

let redisClient: Redis | null = null;
let redisUnavailable = false;
let redisWarningShown = false;

export function getRedisCacheKey(namespace: string, key: string) {
  return `${REDIS_CACHE_PREFIX}:${namespace}:${key}`;
}

function createRedisClient() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl || redisUnavailable) {
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 2_500,
      retryStrategy: () => null,
    });
    redisClient.on("error", (error) => {
      redisUnavailable = true;
      if (!redisWarningShown) {
        redisWarningShown = true;
        console.warn("Redis cache unavailable; continuing without Redis cache:", error.message);
      }
      redisClient?.disconnect();
      redisClient = null;
    });
  }

  return redisClient;
}

export async function getRedisCached<T>(key: string): Promise<T | null> {
  const client = createRedisClient();
  if (!client) return null;

  try {
    const value = await client.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn("Redis cache read failed:", error);
    return null;
  }
}

export async function setRedisCached<T>(key: string, value: T, ttlSeconds: number) {
  const client = createRedisClient();
  if (!client) return;

  try {
    await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (error) {
    console.warn("Redis cache write failed:", error);
  }
}

export async function deleteRedisCached(key: string) {
  const client = createRedisClient();
  if (!client) return;

  try {
    await client.del(key);
  } catch (error) {
    console.warn("Redis cache delete failed:", error);
  }
}

export async function deleteRedisCachedByPrefix(namespace: string, keyPrefix = "") {
  const client = createRedisClient();
  if (!client) return;

  const pattern = `${getRedisCacheKey(namespace, keyPrefix)}*`;

  try {
    const stream = client.scanStream({ match: pattern, count: 100 });
    for await (const keys of stream) {
      if (keys.length > 0) {
        await client.del(...keys);
      }
    }
  } catch (error) {
    console.warn("Redis cache prefix delete failed:", error);
  }
}

export async function withRedisCached<T>(
  namespace: string,
  key: string,
  factory: () => Promise<T> | T,
  ttlSeconds: number
): Promise<T> {
  const cacheKey = getRedisCacheKey(namespace, key);
  const cached = await getRedisCached<T>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const value = await factory();
  if (value !== null && value !== undefined) {
    await setRedisCached(cacheKey, value, ttlSeconds);
  }

  return value;
}

export async function withRedisCachedNullable<T>(
  namespace: string,
  key: string,
  factory: () => Promise<T | null> | T | null,
  ttlSeconds: number,
  nullTtlSeconds: number
): Promise<T | null> {
  const cacheKey = getRedisCacheKey(namespace, key);
  const cached = await getRedisCached<T | { __null: true }>(cacheKey);
  if (cached !== null) {
    return typeof cached === "object" && cached !== null && "__null" in cached
      ? null
      : cached as T;
  }

  const value = await factory();
  await setRedisCached(cacheKey, value === null ? { __null: true } : value, value === null ? nullTtlSeconds : ttlSeconds);
  return value;
}

export function closeRedisCacheClient() {
  if (redisClient) {
    redisClient.disconnect();
    redisClient = null;
  }
  redisUnavailable = false;
  redisWarningShown = false;
}
