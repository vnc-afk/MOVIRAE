import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getUserWatchExperience,
  parseWatchExperiencePayload,
  saveUserWatchExperience,
} from "@/lib/watch-experiences";

export const runtime = "nodejs";

type UserSession = { user?: { email?: string | null } } | null;

async function getCurrentUser(session: UserSession) {
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tmdbId: string }> }
) {
  try {
    const { tmdbId } = await params;
    const session = await getServerSession(authOptions);
    const currentUser = await getCurrentUser(session);

    if (!currentUser) {
      return NextResponse.json({ value: null });
    }

    const value = await getUserWatchExperience(currentUser.id, tmdbId);
    return NextResponse.json({ value });
  } catch (error) {
    console.error("/api/watch-experiences/[tmdbId] GET error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tmdbId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const currentUser = await getCurrentUser(session);

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tmdbId } = await params;
    const payload = await request.json().catch(() => null);
    const input = parseWatchExperiencePayload(payload);

    if (!input) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const value = await saveUserWatchExperience(currentUser.id, tmdbId, input);
    return NextResponse.json({ value, watched: true });
  } catch (error) {
    console.error("/api/watch-experiences/[tmdbId] PUT error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
