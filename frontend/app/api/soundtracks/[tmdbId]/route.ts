import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/features/auth/config";
import { enqueueSoundtrackRefresh } from "@/lib/queues/soundtracks";
import { createPendingSoundtrack, getCachedSoundtrack, serializeSoundtrack } from "@/services/soundtracks/soundtracks.server";
import { prisma } from "@/lib/prisma";
import { getMovieScoreCredits } from "@/lib/tmdb";

const overrideSchema = z.object({
  musicbrainzReleaseId: z.string().min(1),
  note: z.string().max(500).optional(),
});

export async function GET(request: Request, { params }: { params: Promise<{ tmdbId: string }> }) {
  const { tmdbId } = await params;
  const cached = await getCachedSoundtrack(tmdbId);
  if (cached) {
    return NextResponse.json({ value: serializeSoundtrack(cached) });
  }

  const credits = await getMovieScoreCredits(tmdbId, { signal: request.signal, suppressClientErrors: true });
  if (!credits) {
    return NextResponse.json({ error: "Movie not found" }, { status: 404 });
  }

  return NextResponse.json({
    value: createPendingSoundtrack({
      id: String(credits.id),
      title: credits.title,
      poster: credits.poster,
      composer: credits.composers.join(", "),
      year: credits.year,
    }),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ tmdbId: string }> }) {
  const { tmdbId } = await params;
  const credits = await getMovieScoreCredits(tmdbId, { signal: request.signal, suppressClientErrors: true });

  if (!credits) {
    return NextResponse.json({ error: "Movie not found" }, { status: 404 });
  }

  try {
    await enqueueSoundtrackRefresh({
      id: String(credits.id),
      title: credits.title,
      poster: credits.poster,
      composer: credits.composers.join(", "),
      year: credits.year,
    }, { priority: 1, selected: true });

    return NextResponse.json({ value: true });
  } catch (error) {
    console.error("Failed to enqueue selected soundtrack refresh:", error);
    return NextResponse.json({ error: "Unable to queue soundtrack refresh" }, { status: 503 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ tmdbId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const parsed = overrideSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid MusicBrainz override" }, { status: 400 });
  const { tmdbId } = await params;
  const override = await prisma.soundtrackMatchOverride.upsert({
    where: { tmdbMovieId: tmdbId },
    update: parsed.data,
    create: { tmdbMovieId: tmdbId, ...parsed.data },
  });
  return NextResponse.json({ value: override });
}
