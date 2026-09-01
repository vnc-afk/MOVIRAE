import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/features/auth/config";
import { prisma } from "@/lib/prisma";
import { getMessageThreadReadState } from "@/lib/features/messages/threads";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json({ value: [] });
  }

  const currentUser = await prisma.user.findUnique({ where: { email } });
  if (!currentUser) {
    return NextResponse.json({ value: [] });
  }

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(1000, Number(url.searchParams.get("limit") ?? 50)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));

  const messages = await prisma.message.findMany({
    where: {
      OR: [{ fromId: currentUser.id }, { toId: currentUser.id }],
    },
    select: {
      id: true,
      fromId: true,
      toId: true,
      text: true,
      createdAt: true,
      from: {
        select: { id: true, name: true, email: true, image: true, username: true, displayName: true, avatar: true, bio: true },
      },
      to: {
        select: { id: true, name: true, email: true, image: true, username: true, displayName: true, avatar: true, bio: true },
      },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    skip: offset,
  });

  const conversationPartnerIds = Array.from(
    new Set(
      messages
        .map((message) => (message.fromId === currentUser.id ? message.toId : message.fromId))
        .filter((partnerId): partnerId is string => typeof partnerId === "string" && partnerId.length > 0)
    )
  );

  const readStates = await Promise.all(
    conversationPartnerIds.map(async (partnerId) => ({
      partnerId,
      state: await getMessageThreadReadState(currentUser.id, partnerId),
    }))
  );

  const readStateByPartnerId = new Map(readStates.map(({ partnerId, state }) => [partnerId, state]));

  return NextResponse.json({
    value: messages.map((message) => ({
      id: message.id,
      from: {
        id: message.from.id,
        email: message.from.email ?? undefined,
        username: message.from.username ?? message.from.email?.split("@")[0] ?? "unknown",
        displayName: message.from.displayName ?? message.from.name ?? message.from.email?.split("@")[0] ?? "Unknown",
        avatar: message.from.avatar ?? message.from.image ?? "",
        bio: message.from.bio ?? "",
        followers: 0,
        following: 0,
        reviewCount: 0,
        watchlistCount: 0,
        favoriteMovies: [],
      },
      to: {
        id: message.to.id,
        email: message.to.email ?? undefined,
        username: message.to.username ?? message.to.email?.split("@")[0] ?? "unknown",
        displayName: message.to.displayName ?? message.to.name ?? message.to.email?.split("@")[0] ?? "Unknown",
        avatar: message.to.avatar ?? message.to.image ?? "",
        bio: message.to.bio ?? "",
        followers: 0,
        following: 0,
        reviewCount: 0,
        watchlistCount: 0,
        favoriteMovies: [],
      },
      fromId: message.fromId,
      toId: message.toId,
      text: message.text,
      date: message.createdAt.toISOString(),
      isRead:
        message.fromId === currentUser.id
          ? Boolean(
              readStateByPartnerId.get(message.toId)?.[message.toId] &&
                new Date(readStateByPartnerId.get(message.toId)?.[message.toId] ?? 0).getTime() >= message.createdAt.getTime()
            )
          : Boolean(
              readStateByPartnerId.get(message.fromId)?.[currentUser.id] &&
                new Date(readStateByPartnerId.get(message.fromId)?.[currentUser.id] ?? 0).getTime() >= message.createdAt.getTime()
            ),
    })),
  });
}
