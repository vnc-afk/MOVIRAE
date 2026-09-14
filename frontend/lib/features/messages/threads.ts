import { getAppData, setAppData } from "@/lib/app-data";

import { getConversationKey } from "@/services/messages/messages.client";

export type MessageThreadReadState = Record<string, string>;

/**
 * Builds the unique storage key for thread read state between two users.
 */
function getThreadStateKey(userAId: string, userBId: string) {
  return `message-thread-${getConversationKey(userAId, userBId)}`;
}

/**
 * Retrieves persisted read timestamps for a message thread.
 *
 * Returns an object keyed by userId, where each value is the last read time.
 */
export async function getMessageThreadReadState(userAId: string, userBId: string) {
  return getAppData<MessageThreadReadState>(getThreadStateKey(userAId, userBId), {});
}

/**
 * Marks the current user as having read the thread and persists the new timestamp.
 */
export async function markMessageThreadRead(currentUserId: string, otherUserId: string) {
  const key = getThreadStateKey(currentUserId, otherUserId);
  const currentState = await getAppData<MessageThreadReadState>(key, {});
  const nextState = {
    ...currentState,
    [currentUserId]: new Date().toISOString(),
  };

  await setAppData(key, nextState);
  return nextState;
}

/**
 * Exposes the raw thread state key for callers that need a stable identifier.
 */
export function getMessageThreadStateKey(userAId: string, userBId: string) {
  return getThreadStateKey(userAId, userBId);
}
