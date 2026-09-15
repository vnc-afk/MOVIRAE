import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/features/auth/config";
import { prisma } from "@/lib/prisma";

const eventSchema = z.object({
  tmdbMovieId: z.string().min(1),
  musicbrainzRecordingId: z.string().optional(),
  action: z.enum(["open", "play", "pause", "seek", "complete"]),
  durationMs: z.number().int().nonnegative().optional(),
});

export async function POST(request: Request) {
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid soundtrack event" }, { status: 400 });

  const session = await getServerSession(authOptions);
  const user = session?.user?.email
    ? await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
    : null;
  const soundtrack = await prisma.soundtrack.findUnique({ where: { tmdbMovieId: parsed.data.tmdbMovieId }, select: { id: true } });
  if (!soundtrack) return NextResponse.json({ value: false }, { status: 200 });

  await prisma.soundtrackPlayEvent.create({
    data: {
      soundtrackId: soundtrack.id,
      userId: user?.id,
      musicbrainzRecordingId: parsed.data.musicbrainzRecordingId,
      action: parsed.data.action,
      durationMs: parsed.data.durationMs,
    },
  });
  return NextResponse.json({ value: true }, { status: 201 });
}
