import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  return prisma.user.findUnique({ where: { email: session.user.email } });
}

async function getUserWatched(userId: string) {
  const key = `user-watched-${userId}`;
  const data = await prisma.appData.findUnique({ where: { key } });

  if (!data?.value || !Array.isArray(data.value)) {
    return [];
  }

  return data.value.filter((item: unknown) => typeof item === "string").map(String);
}

function extractTogglePayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;

  const movieId = typeof (payload as any).movieId === "string" ? (payload as any).movieId : undefined;
  const active = typeof (payload as any).active === "boolean" ? (payload as any).active : undefined;

  if (!movieId || typeof active !== "boolean") return null;

  return { movieId, active };
}

async function setUserWatched(movieId: string, active: boolean, userId: string) {
  const key = `user-watched-${userId}`;
  const current = await getUserWatched(userId);
  const normalized = new Set(current);

  if (active) normalized.add(movieId);
  else normalized.delete(movieId);

  const value = Array.from(normalized);
  await prisma.appData.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });

  return value;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const currentUser = session?.user?.email ? await prisma.user.findUnique({ where: { email: session.user.email } }) : null;
  const url = new URL(request.url);
  const requestedUserId = url.searchParams.get("userId");
  const targetUserId = requestedUserId || currentUser?.id;

  if (!targetUserId) {
    return NextResponse.json({ value: [] });
  }

  return NextResponse.json({ value: await getUserWatched(targetUserId) });
}

export async function PUT(request: Request) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const togglePayload = extractTogglePayload(payload);

  if (!togglePayload) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const value = await setUserWatched(togglePayload.movieId, togglePayload.active, currentUser.id);
  return NextResponse.json({ value });
}
