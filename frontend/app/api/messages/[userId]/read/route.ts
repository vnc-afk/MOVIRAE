import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getConversationKey } from "@/lib/messaging";
import { markMessageThreadRead } from "@/lib/message-threads";
import { publishMessageEvent } from "@/lib/group-events";

export const runtime = "nodejs";

export async function PATCH(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;

    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({ where: { email } });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { userId: otherUserId } = await params;
    const otherUser = await prisma.user.findUnique({ where: { id: otherUserId } });

    if (!otherUser) {
      return NextResponse.json({ error: "Conversation partner not found" }, { status: 404 });
    }

    const nextState = await markMessageThreadRead(currentUser.id, otherUser.id);

    publishMessageEvent({
      type: "message-read",
      conversationKey: getConversationKey(currentUser.id, otherUser.id),
      readerId: currentUser.id,
      fromId: currentUser.id,
      toId: otherUser.id,
    });

    return NextResponse.json({
      value: {
        conversationKey: getConversationKey(currentUser.id, otherUser.id),
        readAtByUserId: nextState,
      },
    });
  } catch (error) {
    console.error("/api/messages/[userId]/read PATCH error:", error);
    return NextResponse.json({ error: "Failed to mark conversation read" }, { status: 500 });
  }
}
