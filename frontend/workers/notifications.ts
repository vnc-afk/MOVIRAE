import { Worker } from "bullmq";

import { prisma } from "@/lib/prisma";
import {
  isNotificationJob,
  BULLMQ_PREFIX,
  NOTIFICATION_QUEUE_NAME,
  type CreateNotificationJob,
} from "@/lib/queues/notifications";
import { createBullMqConnection } from "@/lib/queues/redis";
import { publishNotificationCreated } from "@/lib/features/notifications/events";

const worker = new Worker<CreateNotificationJob>(
  NOTIFICATION_QUEUE_NAME,
  async (job) => {
    if (!isNotificationJob(job)) {
      throw new Error(`Unsupported notification job: ${job.name}`);
    }

    const notification = await prisma.notification.create({ data: job.data });
    await publishNotificationCreated(notification.recipientId);
    return notification;
  },
  {
    connection: createBullMqConnection(),
    prefix: BULLMQ_PREFIX,
    concurrency: Number(process.env.NOTIFICATION_WORKER_CONCURRENCY ?? 5),
  },
);

worker.on("completed", (job) => {
  console.log(`Notification job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`Notification job ${job?.id ?? "unknown"} failed`, error);
});

async function shutdown(signal: string) {
  console.log(`Received ${signal}; shutting down notification worker`);
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

console.log(`Notification worker listening on ${NOTIFICATION_QUEUE_NAME}`);
