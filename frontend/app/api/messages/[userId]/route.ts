import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/features/auth/config";
import { prisma } from "@/lib/prisma";
import { buildUserProfile } from "@/lib/features/profiles/service";
import { getMessageThreadReadState } from "@/lib/features/messages/threads";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
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
      },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { userId: otherUserId } = await params;
    const otherUser = await prisma.user.findUnique({
      where: { id: otherUserId },
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

    if (!otherUser) {
      return NextResponse.json({ error: "Conversation partner not found" }, { status: 404 });
    }

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { fromId: currentUser.id, toId: otherUser.id },
          { fromId: otherUser.id, toId: currentUser.id },
        ],
      },
      select: {
        id: true,
        fromId: true,
        toId: true,
        text: true,
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
      orderBy: { createdAt: "asc" },
    });

    const readState = await getMessageThreadReadState(currentUser.id, otherUser.id);
    const currentUserReadAt = readState[currentUser.id] ?? null;
    const otherUserReadAt = readState[otherUser.id] ?? null;

    return NextResponse.json({
      value: {
        partner: buildUserProfile(otherUser),
        sessionEmail: currentUser.email ?? null,
        messages: messages.map((message) => ({
          id: message.id,
          from: buildUserProfile(message.from)!,
          to: buildUserProfile(message.to)!,
          fromId: message.fromId,
          toId: message.toId,
          text: message.text,
          date: message.createdAt.toISOString(),
          isRead:
            message.fromId === currentUser.id
              ? Boolean(otherUserReadAt && new Date(otherUserReadAt).getTime() >= message.createdAt.getTime())
              : Boolean(currentUserReadAt && new Date(currentUserReadAt).getTime() >= message.createdAt.getTime()),
        })),
      },
    });
  } catch (error) {
    console.error("/api/messages/[userId] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch conversation" }, { status: 500 });
  }
}
