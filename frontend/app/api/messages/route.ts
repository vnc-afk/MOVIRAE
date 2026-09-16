import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/features/auth/config";
import { prisma } from "@/lib/prisma";
import { buildUserProfile } from "@/services/profiles/profiles";
import { getConversationKey } from "@/services/messages/messages.client";
import { publishMessageEvent } from "@/lib/features/messages/events";
import { getGifById } from "@/lib/features/messages/giphy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;

    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        displayName: true,
        avatar: true,
        image: true,
        bio: true,
      },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const payload = await request.json().catch(() => null);
    const toUserId = typeof payload?.toUserId === "string" ? payload.toUserId : null;
    const text = typeof payload?.text === "string" ? payload.text.trim() : "";
    const gifId = typeof payload?.gifId === "string" ? payload.gifId.trim() : "";

    if (!toUserId || (!text && !gifId) || (text && gifId)) {
      return NextResponse.json({ error: "Recipient and either message text or a GIF are required" }, { status: 400 });
    }

    const recipient = await prisma.user.findUnique({
      where: { id: toUserId },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        displayName: true,
        avatar: true,
        image: true,
        bio: true,
      },
    });

    if (!recipient) {
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }

    // Require mutual friendship (both follow each other) before allowing messages
    const following = await prisma.userFollow.findFirst({ where: { followerId: currentUser.id, followingId: recipient.id } });
    const follower = await prisma.userFollow.findFirst({ where: { followerId: recipient.id, followingId: currentUser.id } });

    if (!following || !follower) {
      return NextResponse.json({ error: "You can only message users who are your friends" }, { status: 403 });
    }

    let gif = null;
    if (gifId) {
      try {
        gif = await getGifById(gifId);
      } catch (error) {
        console.error("Failed to resolve GIF:", error);
        return NextResponse.json({ error: "That GIF is no longer available" }, { status: 400 });
      }
      if (!gif) return NextResponse.json({ error: "That GIF is no longer available" }, { status: 400 });
    }

    const message = await prisma.message.create({
      data: {
        fromId: currentUser.id,
        toId: recipient.id,
        text: text || "",
        type: gif ? "GIF" : "TEXT",
        gifId: gif?.id,
        gifUrl: gif?.url,
        gifPreviewUrl: gif?.previewUrl,
        gifTitle: gif?.title,
        gifWidth: gif?.width,
        gifHeight: gif?.height,
      },
      select: {
        id: true,
        fromId: true,
        toId: true,
        text: true,
        type: true,
        gifId: true,
        gifUrl: true,
        gifPreviewUrl: true,
        gifTitle: true,
        gifWidth: true,
        gifHeight: true,
        createdAt: true,
        from: {
          select: {
            id: true,
            email: true,
            name: true,
            username: true,
            displayName: true,
            avatar: true,
            image: true,
            bio: true,
          },
        },
        to: {
          select: {
            id: true,
            email: true,
            name: true,
            username: true,
            displayName: true,
            avatar: true,
            image: true,
            bio: true,
          },
        },
      },
    });

    publishMessageEvent({
      type: "message-created",
      conversationKey: getConversationKey(currentUser.id, recipient.id),
      messageId: message.id,
      fromId: currentUser.id,
      toId: recipient.id,
      message: {
        id: message.id,
        from: buildUserProfile(message.from)!,
        to: buildUserProfile(message.to)!,
        fromId: message.fromId,
        toId: message.toId,
        text: message.text,
        type: message.type,
        gifId: message.gifId,
        gifUrl: message.gifUrl,
        gifPreviewUrl: message.gifPreviewUrl,
        gifTitle: message.gifTitle,
        gifWidth: message.gifWidth,
        gifHeight: message.gifHeight,
        date: message.createdAt.toISOString(),
        isRead: false,
      },
    });

    return NextResponse.json({
      value: {
        id: message.id,
        from: buildUserProfile(message.from)!,
        to: buildUserProfile(message.to)!,
        fromId: message.fromId,
        toId: message.toId,
        text: message.text,
        type: message.type,
        gifId: message.gifId,
        gifUrl: message.gifUrl,
        gifPreviewUrl: message.gifPreviewUrl,
        gifTitle: message.gifTitle,
        gifWidth: message.gifWidth,
        gifHeight: message.gifHeight,
        date: message.createdAt.toISOString(),
        isRead: false,
      },
    });
  } catch (error) {
    console.error("/api/messages POST error:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
