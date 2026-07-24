import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMovieDetails, getMovieDetailsBatch } from "@/lib/tmdb";
import { getMessageThreadReadState } from "@/lib/message-threads";
import type { Movie, UserProfile } from "@/lib/types";
import { getWatchExperienceStats } from "@/lib/watch-experiences";
import { getHomeActivityFeedSnapshot, refreshHomeActivityFeedSnapshot, refreshUserStatsSnapshot, getUserStatsSnapshot } from "@/lib/aggregations";

export const runtime = "nodejs";

const WEEKDAY_ORDER = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

function makeJsonResponse(body: unknown, cacheControl?: string) {
  const headers: Record<string, string> = {};
  if (cacheControl) headers["Cache-Control"] = cacheControl;
  return NextResponse.json(body, { headers });
}

type UserSession = { user?: { email?: string | null } } | null;

async function getCurrentUser(session: UserSession) {
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

function buildUserProfile(user: any) {
  if (!user) return null;

  const displayName = user.displayName || user.name || user.email?.split("@")[0] || "Movie Lover";
  const username = user.username || displayName.toLowerCase().replace(/\s+/g, "_");

  return {
    id: user.id,
    email: user.email || undefined,
    username,
    displayName,
    avatar: user.avatar || user.image || "",
    bio: user.bio || "",
    followers: 0,
    following: 0,
    reviewCount: 0,
    watchlistCount: 0,
    favoriteMovies: [],
  } satisfies UserProfile;
}

function normalizeDiscussionLikes(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is string => typeof item === "string");
}

function normalizeDiscussionReplies(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((reply) => ({
      id: typeof reply.id === "string" ? reply.id : `reply-${Date.now()}`,
      author: reply.author && typeof reply.author === "object" ? reply.author : null,
      body: typeof reply.body === "string" ? reply.body : "",
      date: typeof reply.date === "string" ? reply.date : new Date().toISOString(),
    }));
}

type SharedListWithRelations = {
  id: string;
  name: string;
  description: string;
  visibility: string;
  owner: Record<string, unknown>;
  collaborators: Array<{ user: Record<string, unknown> }>;
  movies: Array<{ metadata?: unknown; tmdbId?: string }>;
  likes: number;
  comments: number;
  createdAt: Date;
  groupId: string | null;
};

async function getSharedLists() {
  const lists = await prisma.sharedList.findMany({
    include: {
      owner: true,
      collaborators: { include: { user: true } },
      movies: true,
    },
    orderBy: { createdAt: "desc" },
  }) as SharedListWithRelations[];

  return lists.map((list: SharedListWithRelations) => ({
    id: list.id,
    name: list.name,
    description: list.description,
    visibility: list.visibility,
    owner: buildUserProfile(list.owner),
    collaborators: list.collaborators
      .map((collaborator: { user: Record<string, unknown> }) => buildUserProfile(collaborator.user))
      .filter(Boolean),
    movies: list.movies
      .map((movie: { metadata?: unknown; tmdbId?: string }) => movie.metadata ?? { id: movie.tmdbId }),
    likes: list.likes,
    comments: list.comments,
    createdAt: list.createdAt.toISOString(),
    groupId: list.groupId ?? undefined,
  }));
}

async function setSharedLists(payload: unknown, currentUser: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!Array.isArray(payload)) {
    return [];
  }

  await prisma.sharedList.deleteMany();
  // Collect owner IDs from payload and batch-lookup existing users to avoid N+1 queries
  const ownerIdsToCheck = new Set<string>();
  for (const item of payload) {
    if (!item || typeof item !== "object") continue;
    const list = item as any;
    const ownerId = typeof list.owner?.id === "string" ? list.owner.id : undefined;
    if (ownerId) ownerIdsToCheck.add(ownerId);
  }

  // Exclude currentUser.id from the lookup set since we'll treat it as existing
  if (currentUser?.id) ownerIdsToCheck.delete(currentUser.id);

  const ownerIdsArray = Array.from(ownerIdsToCheck);
  let existingOwners = new Set<string>();
  if (ownerIdsArray.length > 0) {
    const owners = await prisma.user.findMany({ where: { id: { in: ownerIdsArray } }, select: { id: true } });
    existingOwners = new Set(owners.map((o: { id: string }) => o.id));
  }

  for (const item of payload) {
    if (!item || typeof item !== "object") continue;
    const list = item as any;
    const rawOwnerId = typeof list.owner?.id === "string" ? list.owner.id : undefined;
    const ownerId = rawOwnerId ?? currentUser?.id;
    if (!ownerId) continue;

    const ownerExists = existingOwners.has(ownerId) || (currentUser && ownerId === currentUser.id);
    if (!ownerExists && !currentUser) continue;

    const movies = Array.isArray(list.movies) ? list.movies : [];
    const collaborators = Array.isArray(list.collaborators) ? list.collaborators : [];

    await prisma.sharedList.create({
      data: {
        ownerId: ownerExists ? ownerId : currentUser!.id,
        name: list.name || "",
        description: list.description || "",
        visibility: list.visibility || "public",
        groupId: typeof list.groupId === "string" ? list.groupId : undefined,
        likes: typeof list.likes === "number" ? list.likes : 0,
        comments: typeof list.comments === "number" ? list.comments : 0,
        movies: {
          create: movies
            .filter((movie: any) => movie && typeof movie === "object" && typeof movie.id === "string")
            .map((movie: any, index: number) => ({
              tmdbId: movie.id,
              position: index,
              metadata: movie,
            })),
        },
        collaborators: {
          create: collaborators
            .filter((collaborator: any) => collaborator && typeof collaborator === "object" && typeof collaborator.id === "string")
            .map((collaborator: any) => ({ userId: collaborator.id })),
        },
      },
    });
  }

  return getSharedLists();
}

async function normalizeGroupMovie(movie: any, index: number): Promise<any> {
  const metadata = movie.metadata && typeof movie.metadata === "object" ? movie.metadata : null;

  if (metadata && typeof metadata.poster === "string" && metadata.poster.trim() !== "") {
    return metadata;
  }

  if (index < 3 && typeof movie.tmdbId === "string") {
    const details = await getMovieDetails(movie.tmdbId);
    if (details) {
      return details;
    }
  }

  return {
    id: typeof movie.tmdbId === "string" ? movie.tmdbId : typeof metadata?.id === "string" ? metadata.id : "unknown",
    title: typeof metadata?.title === "string" ? metadata.title : "Unknown",
    year: typeof metadata?.year === "number" ? metadata.year : 0,
    rating: typeof metadata?.rating === "number" ? metadata.rating : 0,
    genre: typeof metadata?.genre === "string" ? metadata.genre : "Unknown",
    poster: typeof metadata?.poster === "string" ? metadata.poster : "",
    synopsis: typeof metadata?.synopsis === "string" ? metadata.synopsis : "",
    director: typeof metadata?.director === "string" ? metadata.director : "Unknown",
    cast: Array.isArray(metadata?.cast) ? metadata.cast : [],
    reviews: Array.isArray(metadata?.reviews) ? metadata.reviews : [],
    tags: Array.isArray(metadata?.tags) ? metadata.tags : [],
    streamingOn: Array.isArray(metadata?.streamingOn) ? metadata.streamingOn : [],
    runtime: typeof metadata?.runtime === "number" ? metadata.runtime : 0,
    language: typeof metadata?.language === "string" ? metadata.language : "Unknown",
    country: typeof metadata?.country === "string" ? metadata.country : "Unknown",
    moods: Array.isArray(metadata?.moods) ? metadata.moods : [],
  };
}

type GroupWithRelations = {
  id: string;
  name: string;
  avatar: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  creatorId: string;
  members: Array<{ userId: string; user: any }>;
  movies: any[];
  discussions: Array<{
    id: string;
    author: any;
    title: string;
    body: string;
    createdAt: Date;
    likes: number;
    replies: number;
    pinned: boolean;
    movieId: string | null;
  }>;
};

async function getGroups(currentUser: Awaited<ReturnType<typeof getCurrentUser>>) {
  try {
    const groups = await prisma.group.findMany({
      include: {
        members: { include: { user: true } },
        movies: true,
        discussions: { include: { author: true } },
      },
      orderBy: { createdAt: "desc" },
    }) as GroupWithRelations[];

    return await Promise.all(groups.map(async (group: GroupWithRelations) => ({
      id: group.id,
      name: group.name,
      description: group.description || "",
      memberCount: group.members.length,
      avatar: group.avatar || "",
      members: group.members
        .map((member: { user: any }) => buildUserProfile(member.user))
        .filter(Boolean),
      sharedList: await Promise.all(
        group.movies.map((movie: any, index: number) => normalizeGroupMovie(movie, index))
      ),
      discussions: group.discussions.map((discussion: { id: string; author: any; title: string; body: string; createdAt: Date; likes: number; replies: number; pinned: boolean; movieId: string | null }) => ({
        id: discussion.id,
        author: buildUserProfile(discussion.author),
        title: discussion.title,
        body: discussion.body,
        date: discussion.createdAt.toISOString(),
        likes: discussion.likes,
        replies: discussion.replies,
        pinned: discussion.pinned,
        movieId: discussion.movieId ?? undefined,
      })),
      joined: currentUser ? group.members.some((member: { userId: string }) => member.userId === currentUser.id) : false,
    })));
  } catch (err) {
    // If the DB is missing recently added JSON columns (e.g. likedBy, replyItems),
    // the prisma client will throw. Fall back to a safe raw query that only
    // selects Group fields so the front-end can load without a 500 while
    // migrations are applied.
    console.error("getGroups: primary query failed, falling back to raw query:", err);

    const rows: Array<{ id: string; name: string; description: string | null; avatar: string | null; createdAt: Date; updatedAt: Date }>
      = await prisma.$queryRaw`SELECT id, name, description, avatar, "createdAt", "updatedAt" FROM "Group" ORDER BY "createdAt" DESC`;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description || "",
      memberCount: 0,
      avatar: row.avatar || "",
      members: [],
      sharedList: [],
      discussions: [],
      joined: false,
    }));
  }
}

async function setGroups(payload: unknown, currentUser: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!Array.isArray(payload)) {
    return [];
  }

  await prisma.group.deleteMany();

  for (const item of payload) {
    if (!item || typeof item !== "object") continue;
    const group = item as any;
    const creatorId =
      typeof group.creatorId === "string"
        ? group.creatorId
        : typeof group.creator?.id === "string"
          ? group.creator.id
          : currentUser?.id;
    if (!creatorId) continue;

    const creatorExists = await prisma.user.findUnique({ where: { id: creatorId } });
    if (!creatorExists && !currentUser) continue;

    const members = Array.isArray(group.members) ? group.members : [];
    const sharedList = Array.isArray(group.sharedList) ? group.sharedList : [];
    const discussions = Array.isArray(group.discussions) ? group.discussions : [];

    await prisma.group.create({
      data: {
        id: typeof group.id === "string" ? group.id : undefined,
        creatorId: creatorExists ? creatorId : currentUser!.id,
        name: group.name || "",
        description: group.description || "",
        avatar: group.avatar || undefined,
        members: {
          create: members
            .filter((member: any) => member && typeof member === "object" && typeof member.id === "string")
            .map((member: any) => ({ userId: member.id })),
        },
        movies: {
          create: sharedList
            .filter((movie: any) => movie && typeof movie === "object" && typeof movie.id === "string")
            .map((movie: any) => ({ tmdbId: movie.id, metadata: movie })),
        },
        discussions: {
          create: discussions
            .filter((discussion: any) => discussion && typeof discussion === "object")
            .map((discussion: any) => ({
              authorId:
                typeof discussion.author?.id === "string"
                  ? discussion.author.id
                  : currentUser!.id,
              title: discussion.title || "",
              body: discussion.body || "",
              likes: typeof discussion.likes === "number" ? discussion.likes : 0,
              replies: typeof discussion.replies === "number" ? discussion.replies : 0,
              likedByMe: currentUser ? normalizeDiscussionLikes(discussion.likedBy).includes(currentUser.id) : false,
              replyItems: normalizeDiscussionReplies(discussion.replyItems),
              pinned: Boolean(discussion.pinned),
              movieId: typeof discussion.movieId === "string" ? discussion.movieId : undefined,
            })),
        },
      },
    });
  }

  return getGroups(currentUser);
}

async function getUserFilterPresets(currentUser: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!currentUser) return [];
  const presets: Awaited<ReturnType<typeof prisma.filterPreset.findMany>> = await prisma.filterPreset.findMany({
    where: { userId: currentUser.id },
    orderBy: { createdAt: "desc" },
  });

  return presets.map((preset: { id: string; name: string; genreId: string | null; minRuntime: number | null; maxRuntime: number | null }) => ({
    id: preset.id,
    name: preset.name,
    filters: {
      genreId: preset.genreId ?? undefined,
      minRuntime: preset.minRuntime ?? undefined,
      maxRuntime: preset.maxRuntime ?? undefined,
    },
  }));
}

async function setUserFilterPresets(payload: unknown, currentUser: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!currentUser || !Array.isArray(payload)) {
    return [];
  }

  await prisma.filterPreset.deleteMany({ where: { userId: currentUser.id } });

  await prisma.filterPreset.createMany({
    data: payload
      .filter((item: any) => item && typeof item === "object")
      .map((item: any) => ({
        id: typeof item.id === "string" ? item.id : undefined,
        userId: currentUser.id,
        name: item.name || "",
        genreId: typeof item.filters?.genreId === "string" ? item.filters.genreId : null,
        minRuntime: typeof item.filters?.minRuntime === "number" ? item.filters.minRuntime : null,
        maxRuntime: typeof item.filters?.maxRuntime === "number" ? item.filters.maxRuntime : null,
      })),
  });

  return getUserFilterPresets(currentUser);
}

function formatDateString(value: Date | string | null | undefined) {
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function normalizeLabel(value: string | null | undefined) {
  if (!value) return "";
  return value.trim();
}

function isKnownValue(value: string | null | undefined) {
  const normalized = normalizeLabel(value);
  return normalized !== "" && normalized.toLowerCase() !== "unknown";
}

function getDayKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function computeLongestStreak(values: Date[]) {
  const uniqueDays = Array.from(new Set(values.map((value) => getDayKey(value)))).sort();
  if (uniqueDays.length === 0) return 0;

  let longest = 1;
  let current = 1;

  for (let i = 1; i < uniqueDays.length; i += 1) {
    const previous = new Date(`${uniqueDays[i - 1]}T00:00:00.000Z`).getTime();
    const currentDay = new Date(`${uniqueDays[i]}T00:00:00.000Z`).getTime();
    const dayDifference = (currentDay - previous) / (1000 * 60 * 60 * 24);

    if (dayDifference === 1) {
      current += 1;
      longest = Math.max(longest, current);
      continue;
    }

    current = 1;
  }

  return longest;
}

async function getUserStats(currentUser: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!currentUser) {
    return {
      totalWatched: 0,
      totalHours: 0,
      avgRating: 0,
      favoriteGenre: "",
      topDirector: "",
      longestStreak: 0,
      countriesExplored: 0,
      monthlyBreakdown: [],
      genreBreakdown: [],
      ratingDistribution: [],
      moodBreakdown: [],
      platformBreakdown: [],
      contextBreakdown: [],
      weekdayBreakdown: [],
    };
  }

  const reviews = await prisma.review.findMany({
    where: { userId: currentUser.id },
    select: {
      rating: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const watchExperienceStats = await getWatchExperienceStats(currentUser.id);
  const watchedMovieIds = await getUserWatched(currentUser.id);
  const watchedMovieIdSet = new Set([
    ...watchedMovieIds,
    ...watchExperienceStats.records.map((entry) => entry.tmdbId),
  ]);
  const totalWatched = watchedMovieIdSet.size;

  const watchedMovies = await getMovieDetailsBatch(Array.from(watchedMovieIdSet));

  const avgRating = reviews.length > 0 ? reviews.reduce((sum: number, review: { rating: number }) => sum + review.rating, 0) / reviews.length : 0;

  const monthlyCounts = watchExperienceStats.monthlyBreakdown.reduce((acc: Record<string, number>, entry: { month: string; count: number }) => {
    acc[entry.month] = entry.count;
    return acc;
  }, {} as Record<string, number>);

  const weekdayCounts = watchExperienceStats.weekdayBreakdown.reduce((acc: Record<string, number>, entry: { day: string; count: number }) => {
    acc[entry.day] = entry.count;
    return acc;
  }, {} as Record<string, number>);

  const platformCounts = watchExperienceStats.platformBreakdown.reduce((acc: Record<string, number>, entry: { platform: string; count: number }) => {
    acc[entry.platform] = entry.count;
    return acc;
  }, {} as Record<string, number>);

  const contextCounts = watchExperienceStats.contextBreakdown.reduce((acc: Record<string, number>, entry: { context: string; count: number }) => {
    acc[entry.context] = entry.count;
    return acc;
  }, {} as Record<string, number>);

  const moodCounts = watchExperienceStats.moodBreakdown.reduce((acc: Record<string, number>, entry: { mood: string; count: number }) => {
    acc[entry.mood] = entry.count;
    return acc;
  }, {} as Record<string, number>);

  const ratingCounts = reviews.reduce((acc: Record<number, number>, review: { rating: number }) => {
    acc[review.rating] = (acc[review.rating] ?? 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const totalRuntimeMinutes = watchedMovies.reduce((sum, movie) => {
    if (!Number.isFinite(movie.runtime) || movie.runtime <= 0) return sum;
    return sum + movie.runtime;
  }, 0);

  const genreCounts = watchedMovies.reduce<Record<string, number>>((acc, movie) => {
    const sources = Array.isArray(movie.tags) && movie.tags.length > 0 ? movie.tags : [movie.genre];

    for (const source of sources) {
      const genre = normalizeLabel(source);
      if (!isKnownValue(genre)) continue;
      acc[genre] = (acc[genre] ?? 0) + 1;
    }

    return acc;
  }, {});

  const genreTotal = Object.values(genreCounts).reduce((sum, count) => sum + count, 0);
  const genreBreakdown = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([genre, count]) => ({
      genre,
      count,
      pct: genreTotal > 0 ? Math.round((count / genreTotal) * 100) : 0,
    }));

  const directorCounts = watchedMovies.reduce<Record<string, number>>((acc, movie) => {
    const director = normalizeLabel(movie.director);
    if (!isKnownValue(director)) return acc;
    acc[director] = (acc[director] ?? 0) + 1;
    return acc;
  }, {});

  const topDirector = Object.entries(directorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  const countriesExplored = new Set(
    watchedMovies
      .map((movie) => normalizeLabel(movie.country))
      .filter((country) => isKnownValue(country))
  ).size;

  const watchDates = watchExperienceStats.records
    .map((record) => (record.watchedAt instanceof Date ? record.watchedAt : new Date(record.watchedAt)))
    .filter((value) => !Number.isNaN(value.getTime()));

  const longestStreak = computeLongestStreak(watchDates);
  const sortedWatchDates = [...watchDates].sort((left, right) => left.getTime() - right.getTime());
  const activityStart = sortedWatchDates[0]?.toISOString() ?? null;
  const activityEnd = sortedWatchDates.at(-1)?.toISOString() ?? null;

  return {
    totalWatched,
    totalHours: Number((totalRuntimeMinutes / 60).toFixed(1)),
    avgRating,
    favoriteGenre: genreBreakdown[0]?.genre ?? "",
    topDirector,
    longestStreak,
    countriesExplored,
    activityStart,
    activityEnd,
    monthlyBreakdown: (Object.entries(monthlyCounts) as [string, number][])
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, count]) => ({ month, count })),
    genreBreakdown,
    ratingDistribution: (Object.entries(ratingCounts) as [string, number][])
      .map(([stars, count]) => ({ stars: Number(stars), count }))
      .sort((a, b) => a.stars - b.stars),
    moodBreakdown: (Object.entries(moodCounts) as [string, number][])
      .map(([mood, count]) => ({ mood, count }))
      .sort((a, b) => b.count - a.count || a.mood.localeCompare(b.mood)),
    platformBreakdown: (Object.entries(platformCounts) as [string, number][])
      .map(([platform, count]) => ({ platform, count }))
      .sort((a, b) => b.count - a.count || a.platform.localeCompare(b.platform)),
    contextBreakdown: (Object.entries(contextCounts) as [string, number][])
      .map(([context, count]) => ({ context, count }))
      .sort((a, b) => b.count - a.count || a.context.localeCompare(b.context)),
    weekdayBreakdown: (Object.entries(weekdayCounts) as [string, number][])
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => WEEKDAY_ORDER.indexOf(a.day as (typeof WEEKDAY_ORDER)[number]) - WEEKDAY_ORDER.indexOf(b.day as (typeof WEEKDAY_ORDER)[number])),
  };
}


async function getUserNotifications(
  currentUser: Awaited<ReturnType<typeof getCurrentUser>>,
  opts?: { limit?: number; offset?: number }
) {
  if (!currentUser) return [];

  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  const notifications = await prisma.notification.findMany({
    where: { recipientId: currentUser.id },
    select: {
      id: true,
      type: true,
      message: true,
      createdAt: true,
      read: true,
      movieId: true,
      reviewId: true,
      discussionId: true,
      eventId: true,
      sharedListId: true,
      groupId: true,
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          username: true,
          displayName: true,
          avatar: true,
          bio: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });

  const missingMovieByReviewIds = Array.from(
    new Set(
      notifications
        .filter((notification: { movieId: string | null; reviewId: string | null }) => !notification.movieId && notification.reviewId)
        .map((notification: { reviewId: string | null }) => notification.reviewId as string)
    )
  );

  const missingGroupByDiscussionIds = Array.from(
    new Set(
      notifications
        .filter((notification: { groupId: string | null; discussionId: string | null }) => !notification.groupId && notification.discussionId)
        .map((notification: { discussionId: string | null }) => notification.discussionId as string)
    )
  );

  const reviews: Array<{ id: string; tmdbId: string }> = missingMovieByReviewIds.length
    ? await prisma.review.findMany({
        where: { id: { in: missingMovieByReviewIds } },
        select: { id: true, tmdbId: true },
      })
    : [];

  const discussions = missingGroupByDiscussionIds.length
    ? await prisma.groupDiscussion.findMany({
        where: { id: { in: missingGroupByDiscussionIds } },
        select: { id: true, groupId: true },
      })
    : [];

  const reviewMovieMap = new Map(reviews.map((review: { id: string; tmdbId: string }) => [review.id, review.tmdbId]));
  const discussionGroupMap = new Map(discussions.map((discussion: { id: string; groupId: string | null }) => [discussion.id, discussion.groupId]));

  const databaseNotifications = notifications.map((notification: {
    id: string;
    type: string;
    message: string;
    createdAt: Date;
    read: boolean;
    movieId: string | null;
    reviewId: string | null;
    discussionId: string | null;
    eventId: string | null;
    sharedListId: string | null;
    groupId: string | null;
    actor: any;
  }) => {
    const movieId = notification.movieId ?? (notification.reviewId ? reviewMovieMap.get(notification.reviewId) : undefined);
    const groupId = notification.groupId ?? (notification.discussionId ? discussionGroupMap.get(notification.discussionId) : undefined);

    return {
      id: notification.id,
      type: notification.type,
      user: buildUserProfile(notification.actor ?? currentUser)!,
      message: notification.message,
      date: notification.createdAt.toISOString(),
      read: notification.read,
      movieId: movieId ?? undefined,
      reviewId: notification.reviewId ?? undefined,
      discussionId: notification.discussionId ?? undefined,
      eventId: notification.eventId ?? undefined,
      sharedListId: notification.sharedListId ?? undefined,
      groupId: groupId ?? undefined,
    };
  });

  return databaseNotifications;
}

async function setUserNotifications(payload: unknown, currentUser: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!currentUser || !Array.isArray(payload)) return [];

  await prisma.notification.deleteMany({ where: { recipientId: currentUser.id } });

  for (const item of payload) {
    if (!item || typeof item !== "object") continue;
    const notification = item as any;
    await prisma.notification.create({
      data: {
        recipientId: currentUser.id,
        actorId: typeof notification.user?.id === "string" ? notification.user.id : currentUser.id,
        type: notification.type,
        message: notification.message || "",
        movieId: typeof notification.movieId === "string" ? notification.movieId : undefined,
        reviewId: typeof notification.reviewId === "string" ? notification.reviewId : undefined,
        discussionId: typeof notification.discussionId === "string" ? notification.discussionId : undefined,
        eventId: typeof notification.eventId === "string" ? notification.eventId : undefined,
        sharedListId: typeof notification.sharedListId === "string" ? notification.sharedListId : undefined,
        groupId: typeof notification.groupId === "string" ? notification.groupId : undefined,
        read: Boolean(notification.read),
      },
    });
  }

  return getUserNotifications(currentUser);
}

async function getUserMessages(
  currentUser: Awaited<ReturnType<typeof getCurrentUser>>,
  opts?: { limit?: number; offset?: number }
) {
  if (!currentUser) return [];

  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

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
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          username: true,
          displayName: true,
          avatar: true,
          bio: true,
        },
      },
      to: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          username: true,
          displayName: true,
          avatar: true,
          bio: true,
        },
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

  const readStateByPartnerId = new Map(
    readStates.map(({ partnerId, state }) => [partnerId, state])
  );

  return messages.map((message) => ({
    id: message.id,
    from: buildUserProfile(message.from)!,
    to: buildUserProfile(message.to)!,
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
  }));
}

async function setUserMessages(payload: unknown, currentUser: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!currentUser || !Array.isArray(payload)) return [];

  await prisma.message.deleteMany({
    where: {
      OR: [{ fromId: currentUser.id }, { toId: currentUser.id }],
    },
  });

  for (const item of payload) {
    if (!item || typeof item !== "object") continue;
    const message = item as any;
    await prisma.message.create({
      data: {
        fromId: typeof message.from?.id === "string" ? message.from.id : currentUser.id,
        toId: currentUser.id,
        text: message.text || "",
      },
    });
  }

  return getUserMessages(currentUser);
}

async function getUserWatchlist(userId: string) {
  const watchlist = await prisma.userWatchlistItem.findMany({
    where: { userId },
    orderBy: { addedAt: "desc" },
  });
  return watchlist.map((item) => item.tmdbId);
}

async function getUserFavorites(userId: string) {
  const favorites = await prisma.userFavoriteMovie.findMany({
    where: { userId },
    orderBy: { addedAt: "desc" },
  });
  return favorites.map((item) => item.tmdbId);
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
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const movieId = typeof (payload as any).movieId === "string" ? (payload as any).movieId : undefined;
  const active = typeof (payload as any).active === "boolean" ? (payload as any).active : undefined;

  if (!movieId || typeof active !== "boolean") {
    return null;
  }

  return { movieId, active };
}

async function setUserWatchlist(movieId: string, active: boolean, userId: string) {
  if (active) {
    try {
      await prisma.userWatchlistItem.create({
        data: { userId, tmdbId: movieId },
      });
    } catch (error) {
      // Ignore unique constraint errors when item already exists.
    }
  } else {
    await prisma.userWatchlistItem.deleteMany({
      where: { userId, tmdbId: movieId },
    });
  }

  return getUserWatchlist(userId);
}

async function setUserFavorites(movieId: string, active: boolean, userId: string) {
  if (active) {
    try {
      await prisma.userFavoriteMovie.create({
        data: { userId, tmdbId: movieId },
      });
    } catch (error) {
      // Ignore unique constraint errors when item already exists.
    }
  } else {
    await prisma.userFavoriteMovie.deleteMany({
      where: { userId, tmdbId: movieId },
    });
  }

  return getUserFavorites(userId);
}

async function setUserWatched(movieId: string, active: boolean, userId: string) {
  const key = `user-watched-${userId}`;
  const current = await getUserWatched(userId);
  const normalized = new Set(current);

  if (active) {
    normalized.add(movieId);
  } else {
    normalized.delete(movieId);
  }

  const value = Array.from(normalized);
  await prisma.appData.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });

  return value;
}

async function getUserReviews(currentUser: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!currentUser) return [];

  const reviews = await prisma.review.findMany({
    where: { userId: currentUser.id },
    orderBy: { createdAt: "desc" },
  });

  return reviews.map((review) => ({
    id: review.id,
    movieId: review.tmdbId,
    rating: review.rating,
    comment: review.comment || "",
    date: review.createdAt.toISOString(),
    likes: review.likes,
  }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const session = await getServerSession(authOptions);
    const currentUser = await getCurrentUser(session);

    switch (true) {
      case key === "shared-lists":
        // Shared lists are read-heavy and mostly public — cache briefly at CDN edge
        return makeJsonResponse({ value: await getSharedLists() }, "public, s-maxage=30, stale-while-revalidate=60");
      case key === "groups":
        // Groups include per-user 'joined' flags; avoid public caching to prevent stale joins
        return makeJsonResponse({
          value: await getGroups(currentUser),
          currentUser: buildUserProfile(currentUser),
        });
      case key === "user-filter-presets":
        return NextResponse.json({ value: await getUserFilterPresets(currentUser) });
      case key === "user-wrapped":
        return makeJsonResponse({ value: currentUser ? await getUserStatsSnapshot(currentUser.id) : await getUserStats(currentUser) }, "private, no-store");
      case key === "home-activity-feed":
        // Public activity feed: short CDN cache to reduce DB pressure
        return makeJsonResponse({ value: await getHomeActivityFeedSnapshot() }, "public, s-maxage=30, stale-while-revalidate=60");
      case key === "user-notifications": {
        // Support pagination via ?limit=&offset=
        const url = new URL(_request.url);
        const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") ?? 50)));
        const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
        return NextResponse.json({ value: await getUserNotifications(currentUser, { limit, offset }) });
      }
          case key === "user-messages": {
            const url = new URL(_request.url);
            const limit = Math.max(1, Math.min(1000, Number(url.searchParams.get("limit") ?? 50)));
            const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
            return NextResponse.json({ value: await getUserMessages(currentUser, { limit, offset }) });
          }
      case key === "user-watchlist-current":
        return NextResponse.json({ value: currentUser ? await getUserWatchlist(currentUser.id) : [] });
      case key === "user-watched-current":
        return NextResponse.json({ value: currentUser ? await getUserWatched(currentUser.id) : [] });
      case key === "user-favorites-current":
        return NextResponse.json({ value: currentUser ? await getUserFavorites(currentUser.id) : [] });
      case key.startsWith("user-watchlist-"):
        return NextResponse.json({ value: await getUserWatchlist(key.replace("user-watchlist-", "")) });
      case key === "user-reviews-current":
        return NextResponse.json({ value: await getUserReviews(currentUser) });
      default:
        return NextResponse.json({ error: "Unknown data key" }, { status: 400 });
    }
  } catch (err) {
    // Log server-side error and return JSON body so clients can inspect the message.
    // Avoid leaking sensitive details in production — this is intended for debugging.
    // If you want to suppress details, replace err.message with a generic message.
    console.error("/api/data/[key] GET error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const session = await getServerSession(authOptions);
  const currentUser = await getCurrentUser(session);

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key } = await params;
  const payload = await request.json().catch(() => null);

  switch (true) {
    case key === "shared-lists":
      return NextResponse.json({ value: await setSharedLists(payload, currentUser) });
    case key === "groups":
      return NextResponse.json({ value: await setGroups(payload, currentUser) });
    case key === "user-filter-presets":
      return NextResponse.json({ value: await setUserFilterPresets(payload, currentUser) });
    case key === "user-notifications":
      return NextResponse.json({ value: await setUserNotifications(payload, currentUser) });
    case key === "user-messages":
      return NextResponse.json({ value: await setUserMessages(payload, currentUser) });
    case key === "user-watchlist-current": {
      const togglePayload = extractTogglePayload(payload);
      if (!togglePayload) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      const value = await setUserWatchlist(togglePayload.movieId, togglePayload.active, currentUser.id);
      void refreshHomeActivityFeedSnapshot().catch((error) => console.error("refreshHomeActivityFeedSnapshot failed", error));
      return NextResponse.json({ value });
    }
    case key === "user-favorites-current": {
      const togglePayload = extractTogglePayload(payload);
      if (!togglePayload) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      return NextResponse.json({ value: await setUserFavorites(togglePayload.movieId, togglePayload.active, currentUser.id) });
    }
    case key === "user-watched-current": {
      const togglePayload = extractTogglePayload(payload);
      if (!togglePayload) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      const value = await setUserWatched(togglePayload.movieId, togglePayload.active, currentUser.id);
      void refreshUserStatsSnapshot(currentUser.id).catch((error) => console.error("refreshUserStatsSnapshot failed", error));
      return NextResponse.json({ value });
    }
    default:
      return NextResponse.json({ error: "Unknown or read-only data key" }, { status: 400 });
  }
}
