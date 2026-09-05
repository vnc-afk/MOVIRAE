import IORedis from "ioredis";

export function getRedisUrl() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL is required to use BullMQ");
  }

  return redisUrl;
}

export function createBullMqConnection() {
  return new IORedis(getRedisUrl(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
