import IORedis from "ioredis";

type BullMqConnectionRole = "queue" | "worker";

let queueWarningShown = false;
let workerWarningShown = false;

export function getRedisUrl() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL is required to use BullMQ");
  }

  return redisUrl;
}

export function describeRedisError(error: unknown) {
  if (!(error instanceof Error)) return String(error);

  const redisError = error as Error & {
    code?: string;
    address?: string;
    port?: number;
    syscall?: string;
  };
  const details = [
    redisError.code && `code=${redisError.code}`,
    redisError.syscall && `syscall=${redisError.syscall}`,
    redisError.address && `address=${redisError.address}`,
    redisError.port && `port=${redisError.port}`,
  ].filter(Boolean);

  return details.length > 0 ? `${redisError.message} (${details.join(", ")})` : redisError.message;
}

export function createBullMqConnection(role: BullMqConnectionRole = "queue") {
  const connection = new IORedis(getRedisUrl(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: 2_500,
    family: 4,
    retryStrategy: (attempts) => {
      if (role === "queue") {
        return attempts <= 1 ? 500 : null;
      }

      return Math.min(attempts * 500, 5_000);
    },
  });

  connection.on("error", (error) => {
    if (role === "queue" && !queueWarningShown) {
      queueWarningShown = true;
      console.warn("BullMQ Redis queue unavailable; soundtrack refresh will stay pending:", error.message);
    }

    if (role === "worker" && !workerWarningShown) {
      workerWarningShown = true;
      console.warn("BullMQ Redis worker unavailable; retrying soundtrack queue connection:", error.message);
    }
  });

  return connection;
}
