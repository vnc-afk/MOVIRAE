import IORedis, { type Redis } from "ioredis";
import { getRedisUrl } from "@/lib/queues/redis";

const NOTIFICATION_EVENTS_CHANNEL = "movirae:notifications:events";

export type NotificationCreatedEvent = {
  type: "notification-created";
  recipientId: string;
};

export function publishNotificationCreated(recipientId: string) {
  const publisher = new IORedis(getRedisUrl(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  return publisher
    .publish(
      NOTIFICATION_EVENTS_CHANNEL,
      JSON.stringify({ type: "notification-created", recipientId } satisfies NotificationCreatedEvent)
    )
    .finally(() => publisher.quit());
}

export async function subscribeToNotificationEvents(
  listener: (event: NotificationCreatedEvent) => void,
): Promise<Redis> {
  const subscriber = new IORedis(getRedisUrl(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  await subscriber.subscribe(NOTIFICATION_EVENTS_CHANNEL);
  subscriber.on("message", (_channel, message) => {
    try {
      const event = JSON.parse(message) as NotificationCreatedEvent;
      if (event.type === "notification-created" && typeof event.recipientId === "string") {
        listener(event);
      }
    } catch {
      // Ignore malformed pub/sub messages.
    }
  });

  return subscriber;
}