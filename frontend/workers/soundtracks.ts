import { Worker } from "bullmq";

import { refreshSoundtrack } from "@/services/soundtracks/soundtracks.server";
import {
  BULLMQ_PREFIX,
  isSoundtrackRefreshJob,
  SOUNDTRACK_QUEUE_NAME,
  type SoundtrackRefreshJob,
} from "@/lib/queues/soundtracks";
import { createBullMqConnection } from "@/lib/queues/redis";
import { prisma } from "@/lib/prisma";

const worker = new Worker<SoundtrackRefreshJob>(
  SOUNDTRACK_QUEUE_NAME,
  async (job) => {
    if (!isSoundtrackRefreshJob(job)) {
      throw new Error(`Unsupported soundtrack job: ${job.name}`);
    }

    return refreshSoundtrack(job.data.movie, undefined, { force: true });
  },
  {
    connection: createBullMqConnection("worker"),
    prefix: BULLMQ_PREFIX,
    concurrency: Number(process.env.SOUNDTRACK_WORKER_CONCURRENCY ?? 2),
  },
);

worker.on("completed", (job) => {
  console.log(`Soundtrack job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`Soundtrack job ${job?.id ?? "unknown"} failed`, error);
});

async function shutdown(signal: string) {
  console.log(`Received ${signal}; shutting down soundtrack worker`);
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

console.log(`Soundtrack worker listening on ${SOUNDTRACK_QUEUE_NAME}`);
