import { getAppData, setAppData } from "@/lib/app-data";

import { getConversationKey } from "@/lib/messaging";

export type MessageThreadReadState = Record<string, string>;

function getThreadStateKey(userAId: string, userBId: string) {
  return `message-thread-${getConversationKey(userAId, userBId)}`;
}

export async function getMessageThreadReadState(userAId: string, userBId: string) {
  return getAppData<MessageThreadReadState>(getThreadStateKey(userAId, userBId), {});
}

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

export function getMessageThreadStateKey(userAId: string, userBId: string) {
  return getThreadStateKey(userAId, userBId);
}
