import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildUserProfile } from "@/lib/user-profiles";
import { getConversationKey } from "@/lib/messaging";
import { publishMessageEvent } from "@/lib/group-events";

export const runtime = "nodejs";

export async function POST(request: Request) {
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

    const payload = await request.json().catch(() => null);
    const toUserId = typeof payload?.toUserId === "string" ? payload.toUserId : null;
    const text = typeof payload?.text === "string" ? payload.text.trim() : "";

    if (!toUserId || !text) {
      return NextResponse.json({ error: "Recipient and message text are required" }, { status: 400 });
    }

    const recipient = await prisma.user.findUnique({ where: { id: toUserId } });

    if (!recipient) {
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }

    // Require mutual friendship (both follow each other) before allowing messages
    const following = await prisma.userFollow.findFirst({ where: { followerId: currentUser.id, followingId: recipient.id } });
    const follower = await prisma.userFollow.findFirst({ where: { followerId: recipient.id, followingId: currentUser.id } });

    if (!following || !follower) {
      return NextResponse.json({ error: "You can only message users who are your friends" }, { status: 403 });
    }

    const message = await prisma.message.create({
      data: {
        fromId: currentUser.id,
        toId: recipient.id,
        text,
      },
      include: {
        from: true,
        to: true,
      },
    });

    publishMessageEvent({
      type: "message-created",
      conversationKey: getConversationKey(currentUser.id, recipient.id),
      messageId: message.id,
      fromId: currentUser.id,
      toId: recipient.id,
    });

    return NextResponse.json({
      value: {
        id: message.id,
        from: buildUserProfile(message.from)!,
        to: buildUserProfile(message.to)!,
        fromId: message.fromId,
        toId: message.toId,
        text: message.text,
        date: message.createdAt.toISOString(),
        isRead: false,
      },
    });
  } catch (error) {
    console.error("/api/messages POST error:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
