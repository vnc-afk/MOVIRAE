import type { NotificationItem } from "@/lib/types";

export type NotificationEvent = {
	type: "notification-created";
	notificationId: string;
	recipientId?: string;
	notification?: NotificationItem;
	timestamp: string;
};

type NotificationEventListener = (event: NotificationEvent) => void;

const notificationListeners = new Set<NotificationEventListener>();

export function subscribeToNotifications(listener: NotificationEventListener) {
	notificationListeners.add(listener);
	return () => {
		notificationListeners.delete(listener);
	};
}

export function publishNotificationEvent(notificationId: string): void;
export function publishNotificationEvent(payload: Omit<NotificationEvent, "type" | "timestamp">): void;
export function publishNotificationEvent(payloadOrId: string | Omit<NotificationEvent, "type" | "timestamp">) {
	if (notificationListeners.size === 0) return;

	const event: NotificationEvent =
		typeof payloadOrId === "string"
			? { type: "notification-created", notificationId: payloadOrId, timestamp: new Date().toISOString() }
			: { type: "notification-created", ...payloadOrId, timestamp: new Date().toISOString() };

	for (const listener of notificationListeners) {
		listener(event);
	}
}
