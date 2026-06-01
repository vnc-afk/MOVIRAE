import { getAppData, setAppData } from "@/lib/app-data";
import { prisma } from "@/lib/prisma";
import type {
  Mood,
  WatchContext,
  WatchExperience,
  WatchExperienceRecord,
  WatchPlatform,
} from "@/lib/types";
import { WATCH_CONTEXTS, WATCH_MOODS, WATCH_PLATFORMS } from "@/lib/watch-options";

type WatchExperienceRow = {
  id: string;
  userId: string;
  tmdbId: string;
  platform: string;
  context: string;
  mood: string;
  watchedAt: Date;
  updatedAt: Date;
};

type WatchExperienceModel = {
  findUnique(args: {
    where: {
      userId_tmdbId: { userId: string; tmdbId: string };
    };
  }): Promise<WatchExperienceRow | null>;
  upsert(args: {
    where: {
      userId_tmdbId: { userId: string; tmdbId: string };
    };
    create: {
      userId: string;
      tmdbId: string;
      platform: string;
      context: string;
      mood: string;
    };
    update: {
      platform: string;
      context: string;
      mood: string;
    };
  }): Promise<WatchExperienceRow>;
  findMany(args: {
    where: { userId: string };
    orderBy: { watchedAt: "desc" | "asc" };
  }): Promise<WatchExperienceRow[]>;
};

type WatchExperienceStatsRow = Pick<WatchExperienceRow, "tmdbId" | "platform" | "context" | "mood" | "watchedAt">;

const watchExperienceModel = (
  prisma as typeof prisma & {
    userWatchExperience: WatchExperienceModel;
  }
).userWatchExperience;

const WEEKDAY_ORDER = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

function getWeekdayLabel(value: Date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(value);
}

function isAllowedValue<T extends string>(value: string, options: readonly T[]): value is T {
  return options.includes(value as T);
}

export function parseWatchExperiencePayload(payload: unknown): WatchExperience | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Record<string, unknown>;
  const platform = typeof candidate.platform === "string" ? candidate.platform.trim() : "";
  const context = typeof candidate.context === "string" ? candidate.context.trim() : "";
  const mood = typeof candidate.mood === "string" ? candidate.mood.trim() : "";

  if (
    !isAllowedValue(platform, WATCH_PLATFORMS) ||
    !isAllowedValue(context, WATCH_CONTEXTS) ||
    !isAllowedValue(mood, WATCH_MOODS)
  ) {
    return null;
  }

  return {
    platform,
    context,
    mood,
  };
}

function serializeWatchExperience(record: WatchExperienceRow): WatchExperienceRecord {
  return {
    id: record.id,
    userId: record.userId,
    tmdbId: record.tmdbId,
    platform: record.platform as WatchPlatform,
    context: record.context as WatchContext,
    mood: record.mood as Mood,
    watchedAt: record.watchedAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function ensureWatchedMovie(userId: string, tmdbId: string) {
  const key = `user-watched-${userId}`;
  const watchedMovieIds = await getAppData<string[]>(key, []);
  const normalized = watchedMovieIds.filter(
    (item): item is string => typeof item === "string" && item.length > 0
  );

  if (normalized.includes(tmdbId)) {
    return normalized;
  }

  const next = Array.from(new Set([...normalized, tmdbId]));
  await setAppData(key, next);
  return next;
}

export async function getUserWatchExperience(
  userId: string,
  tmdbId: string
): Promise<WatchExperienceRecord | null> {
  const record = await watchExperienceModel.findUnique({
    where: {
      userId_tmdbId: { userId, tmdbId },
    },
  });

  return record ? serializeWatchExperience(record) : null;
}

export async function saveUserWatchExperience(userId: string, tmdbId: string, input: WatchExperience) {
  const record = await watchExperienceModel.upsert({
    where: {
      userId_tmdbId: { userId, tmdbId },
    },
    create: {
      userId,
      tmdbId,
      platform: input.platform,
      context: input.context,
      mood: input.mood,
    },
    update: {
      platform: input.platform,
      context: input.context,
      mood: input.mood,
    },
  });

  await ensureWatchedMovie(userId, tmdbId);
  return serializeWatchExperience(record);
}

export async function getWatchExperienceStats(userId: string) {
  const records = await getUserWatchExperienceRows(userId);

  // Use Prisma groupBy for categorical aggregations instead of in-memory processing
  const [platformGroups, contextGroups, moodGroups] = await Promise.all([
    prisma.userWatchExperience.groupBy({
      by: ["platform"],
      where: { userId },
      _count: true,
    }),
    prisma.userWatchExperience.groupBy({
      by: ["context"],
      where: { userId },
      _count: true,
    }),
    prisma.userWatchExperience.groupBy({
      by: ["mood"],
      where: { userId },
      _count: true,
    }),
  ]);

  return {
    records,
    monthlyBreakdown: Object.entries(
      records.reduce<Record<string, number>>((acc, record) => {
        const month = record.watchedAt.toISOString().slice(0, 7);
        acc[month] = (acc[month] ?? 0) + 1;
        return acc;
      }, {})
    )
      .sort(([leftMonth], [rightMonth]) => leftMonth.localeCompare(rightMonth))
      .map(([month, count]) => ({ month, count })),
    weekdayBreakdown: Object.entries(
      records.reduce<Record<string, number>>((acc, record) => {
        const day = getWeekdayLabel(record.watchedAt);
        acc[day] = (acc[day] ?? 0) + 1;
        return acc;
      }, {})
    )
      .sort(([leftDay], [rightDay]) => WEEKDAY_ORDER.indexOf(leftDay as (typeof WEEKDAY_ORDER)[number]) - WEEKDAY_ORDER.indexOf(rightDay as (typeof WEEKDAY_ORDER)[number]))
      .map(([day, count]) => ({ day, count })),
    platformBreakdown: platformGroups
      .map((group) => ({
        platform: group.platform as WatchPlatform,
        count: group._count,
      }))
      .sort((a, b) => b.count - a.count || a.platform.localeCompare(b.platform)),
    contextBreakdown: contextGroups
      .map((group) => ({
        context: group.context as WatchContext,
        count: group._count,
      }))
      .sort((a, b) => b.count - a.count || a.context.localeCompare(b.context)),
    moodBreakdown: moodGroups
      .map((group) => ({
        mood: group.mood as Mood,
        count: group._count,
      }))
      .sort((a, b) => b.count - a.count || a.mood.localeCompare(b.mood)),
  };
}

async function getUserWatchExperienceRows(userId: string) {
  return watchExperienceModel.findMany({
    where: { userId },
    orderBy: { watchedAt: "desc" },
  }) as Promise<WatchExperienceStatsRow[]>;
}
