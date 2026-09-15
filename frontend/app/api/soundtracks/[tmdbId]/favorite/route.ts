import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/features/auth/config";
import { prisma } from "@/lib/prisma";

async function getUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  return user?.id ?? null;
}

export async function POST(request: Request, { params }: { params: Promise<{ tmdbId: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { tmdbId } = await params;
  const soundtrack = await prisma.soundtrack.findUnique({ where: { tmdbMovieId: tmdbId }, select: { id: true } });
  if (!soundtrack) return NextResponse.json({ error: "Soundtrack not found" }, { status: 404 });
  await prisma.userSoundtrackFavorite.upsert({
    where: { userId_soundtrackId: { userId, soundtrackId: soundtrack.id } },
    update: {},
    create: { userId, soundtrackId: soundtrack.id },
  });
  return NextResponse.json({ value: true, opId: request.headers.get("x-op-id") ?? undefined });
}

export async function GET(_request: Request, { params }: { params: Promise<{ tmdbId: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ value: false });
  const { tmdbId } = await params;
  const favorite = await prisma.userSoundtrackFavorite.findFirst({
    where: { userId, soundtrack: { tmdbMovieId: tmdbId } },
    select: { id: true },
  });
  return NextResponse.json({ value: Boolean(favorite) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ tmdbId: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { tmdbId } = await params;
  const soundtrack = await prisma.soundtrack.findUnique({ where: { tmdbMovieId: tmdbId }, select: { id: true } });
  if (soundtrack) {
    await prisma.userSoundtrackFavorite.deleteMany({ where: { userId, soundtrackId: soundtrack.id } });
  }
  return NextResponse.json({ value: false, opId: request.headers.get("x-op-id") ?? undefined });
}
