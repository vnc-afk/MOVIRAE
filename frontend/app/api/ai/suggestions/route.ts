import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/features/auth/config";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const FALLBACK_SUGGESTIONS = [
  "Sad sci-fi like Interstellar",
  "Feel-good comedy for a rainy day",
  "Mind-bending thriller with plot twists",
  "Visually stunning animated films",
  "90s cult classics I might have missed",
];

type Preference = { value: string; count: number };

function countPreferences(values: string[]): Preference[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Array.from(counts, ([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ suggestions: FALLBACK_SUGGESTIONS });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ suggestions: FALLBACK_SUGGESTIONS });

  const experiences = await prisma.userWatchExperience.findMany({
    where: { userId: user.id },
    select: { platform: true, context: true, mood: true },
  });
  const moods = countPreferences(experiences.map((experience) => experience.mood)).slice(0, 2);
  const contexts = countPreferences(experiences.map((experience) => experience.context)).slice(0, 2);
  const platforms = countPreferences(experiences.map((experience) => experience.platform)).slice(0, 2);
  const suggestions = new Set<string>();

  for (const mood of moods) {
    for (const context of contexts) {
      suggestions.add(`Recommend a ${mood.value.toLowerCase()} movie for ${context.value.toLowerCase()}`);
    }
  }
  for (const platform of platforms) {
    suggestions.add(`Find something great to watch on ${platform.value}`);
  }
  for (const mood of moods) suggestions.add(`Show me more ${mood.value.toLowerCase()} movies`);

  return NextResponse.json({ suggestions: suggestions.size ? Array.from(suggestions).slice(0, 5) : FALLBACK_SUGGESTIONS });
}
