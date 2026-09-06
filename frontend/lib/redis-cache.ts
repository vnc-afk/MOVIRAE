import "server-only";
import Redis from "ioredis";

const REDIS_CACHE_PREFIX = "movirae:cache";

let redisClient: Redis | null = null;

export function getRedisCacheKey(namespace: string, key: string) {
  return `${REDIS_CACHE_PREFIX}:${namespace}:${key}`;
}

function createRedisClient() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
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

export function closeRedisCacheClient() {
  if (redisClient) {
    redisClient.disconnect();
    redisClient = null;
  }
}
