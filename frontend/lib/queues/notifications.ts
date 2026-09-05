import { Job, Queue } from "bullmq";
import type { NotificationType } from "@prisma/client";

import { createBullMqConnection } from "@/lib/queues/redis";

export const NOTIFICATION_QUEUE_NAME = "notifications";
export const BULLMQ_PREFIX = "movirae:bullmq";

export type CreateNotificationJob = {
  recipientId: string;
  actorId?: string;
  type: NotificationType;
  message: string;
  movieId?: string;
  reviewId?: string;
  discussionId?: string;
  eventId?: string;
  sharedListId?: string;
  groupId?: string;
};

let notificationQueue: Queue<CreateNotificationJob> | undefined;

function getNotificationQueue() {
  notificationQueue ??= new Queue<CreateNotificationJob>(NOTIFICATION_QUEUE_NAME, {
    connection: createBullMqConnection(),
    prefix: BULLMQ_PREFIX,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 1_000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  });

  return notificationQueue;
}

export function enqueueNotification(data: CreateNotificationJob) {
  return getNotificationQueue().add("create", data, {
    jobId: `${data.recipientId}:${data.type}:${Date.now()}`,
  });
}

export function isNotificationJob(job: Job<unknown>): boolean {
  return job.name === "create" && typeof job.data === "object" && job.data !== null;
}

export async function closeNotificationQueue() {
  await notificationQueue?.close();
  notificationQueue = undefined;
}
