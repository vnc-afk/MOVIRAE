import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMovieDetails } from "@/lib/tmdb";
import type { UserProfile } from "@/lib/types";

export const runtime = "nodejs";

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

async function getSharedLists() {
  const lists = await prisma.sharedList.findMany({
    include: {
      owner: true,
      collaborators: { include: { user: true } },
      movies: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return lists.map((list) => ({
    id: list.id,
    name: list.name,
    description: list.description,
    visibility: list.visibility,
    owner: buildUserProfile(list.owner),
    collaborators: list.collaborators
      .map((collaborator) => buildUserProfile(collaborator.user))
      .filter(Boolean),
    movies: list.movies
      .map((movie) => movie.metadata ?? { id: movie.tmdbId }),
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

  for (const item of payload) {
    if (!item || typeof item !== "object") continue;
    const list = item as any;
    const ownerId = typeof list.owner?.id === "string" ? list.owner.id : currentUser?.id;
    if (!ownerId) continue;

    const ownerExists = await prisma.user.findUnique({ where: { id: ownerId } });
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

async function getGroups(currentUser: Awaited<ReturnType<typeof getCurrentUser>>) {
  const groups = await prisma.group.findMany({
    include: {
      members: { include: { user: true } },
      movies: true,
      discussions: { include: { author: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    description: group.description || "",
    memberCount: group.members.length,
    avatar: group.avatar || "",
    members: group.members
      .map((member) => buildUserProfile(member.user))
      .filter(Boolean),
    sharedList: group.movies.map((movie) => movie.metadata ?? { id: movie.tmdbId }),
    discussions: group.discussions.map((discussion) => ({
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
    joined: currentUser ? group.members.some((member) => member.userId === currentUser.id) : false,
  }));
}

async function setGroups(payload: unknown, currentUser: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!Array.isArray(payload)) {
    return [];
  }

  await prisma.group.deleteMany();

  for (const item of payload) {
    if (!item || typeof item !== "object") continue;
    const group = item as any;
    const creatorId = typeof group.creator?.id === "string" ? group.creator.id : currentUser?.id;
    if (!creatorId) continue;

    const creatorExists = await prisma.user.findUnique({ where: { id: creatorId } });
    if (!creatorExists && !currentUser) continue;

    const members = Array.isArray(group.members) ? group.members : [];
    const sharedList = Array.isArray(group.sharedList) ? group.sharedList : [];
    const discussions = Array.isArray(group.discussions) ? group.discussions : [];

    await prisma.group.create({
      data: {
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
  const presets = await prisma.filterPreset.findMany({
    where: { userId: currentUser.id },
    orderBy: { createdAt: "desc" },
  });

  return presets.map((preset) => ({
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
    orderBy: { createdAt: "desc" },
  });

  const totalWatched = reviews.length;
  const avgRating = totalWatched > 0 ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalWatched : 0;

  const monthlyCounts = reviews.reduce<Record<string, number>>((acc, review) => {
    const month = review.createdAt.toISOString().slice(0, 7);
    acc[month] = (acc[month] ?? 0) + 1;
    return acc;
  }, {});

  const ratingCounts = reviews.reduce<Record<number, number>>((acc, review) => {
    acc[review.rating] = (acc[review.rating] ?? 0) + 1;
    return acc;
  }, {});

  const weekdayCounts = reviews.reduce<Record<string, number>>((acc, review) => {
    const day = review.createdAt.toLocaleDateString("en-US", { weekday: "long" });
    acc[day] = (acc[day] ?? 0) + 1;
    return acc;
  }, {});

  return {
    totalWatched,
    totalHours: 0,
    avgRating,
    favoriteGenre: "",
    topDirector: "",
    longestStreak: 0,
    countriesExplored: 0,
    monthlyBreakdown: Object.entries(monthlyCounts).map(([month, count]) => ({ month, count })),
    genreBreakdown: [],
    ratingDistribution: Object.entries(ratingCounts).map(([stars, count]) => ({ stars: Number(stars), count })),
    moodBreakdown: [],
    platformBreakdown: [],
    contextBreakdown: [],
    weekdayBreakdown: Object.entries(weekdayCounts).map(([day, count]) => ({ day, count })),
  };
}

async function getActivityFeed() {
  const reviews = await prisma.review.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  const watchlist = await prisma.userWatchlistItem.findMany({
    include: { user: true },
    orderBy: { addedAt: "desc" },
    take: 8,
  });

  const reviewFeedItems = reviews.map((review) => ({
    id: `review-${review.id}` as const,
    action: "reviewed" as const,
    user: buildUserProfile(review.user),
    movieId: review.tmdbId,
    rating: review.rating,
    comment: review.comment ?? undefined,
    date: review.createdAt.toISOString(),
  }));

  const watchlistFeedItems = watchlist.map((watch) => ({
    id: `watch-${watch.id}` as const,
    action: "added_to_watchlist" as const,
    user: buildUserProfile(watch.user),
    movieId: watch.tmdbId,
    date: watch.addedAt.toISOString(),
  }));

  const feedItems = [...reviewFeedItems, ...watchlistFeedItems];

  const uniqueMovieIds = Array.from(new Set(feedItems.map((item) => item.movieId))).slice(0, 10);
  const movies = await Promise.all(uniqueMovieIds.map((id) => getMovieDetails(id)));
  const movieMap = new Map(movies.filter((movie): movie is NonNullable<typeof movie> => movie !== null).map((movie) => [movie.id, movie]));

  return feedItems
    .filter((item) => movieMap.has(item.movieId))
    .map((item) => {
      const base = {
        id: item.id,
        action: item.action,
        user: item.user!,
        movie: movieMap.get(item.movieId)!,
        date: item.date,
      };

      if (item.action === "reviewed") {
        return {
          ...base,
          rating: item.rating,
          comment: item.comment,
        };
      }

      return base;
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

async function getUserNotifications(currentUser: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!currentUser) return [];

  const notifications = await prisma.notification.findMany({
    where: { recipientId: currentUser.id },
    include: { actor: true },
    orderBy: { createdAt: "desc" },
  });

  return notifications.map((notification) => ({
    id: notification.id,
    type: notification.type,
    user: buildUserProfile(notification.actor ?? currentUser)!,
    message: notification.message,
    date: notification.createdAt.toISOString(),
    read: notification.read,
    movieId: notification.movieId ?? undefined,
  }));
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
        read: Boolean(notification.read),
      },
    });
  }

  return getUserNotifications(currentUser);
}

async function getUserMessages(currentUser: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!currentUser) return [];

  const messages = await prisma.message.findMany({
    where: {
      OR: [{ fromId: currentUser.id }, { toId: currentUser.id }],
    },
    include: { from: true },
    orderBy: { createdAt: "asc" },
  });

  return messages.map((message) => ({
    id: message.id,
    from: buildUserProfile(message.from)!,
    text: message.text,
    date: message.createdAt.toISOString(),
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

async function getUserReviews(currentUser: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!currentUser) return [];

  const reviews = await prisma.review.findMany({
    where: { userId: currentUser.id },
    orderBy: { createdAt: "desc" },
  });

  return reviews.map((review) => ({
    movieId: review.tmdbId,
    rating: review.rating,
    comment: review.comment || "",
    date: review.createdAt.toISOString(),
  }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const session = await getServerSession(authOptions);
  const currentUser = await getCurrentUser(session);

  switch (true) {
    case key === "shared-lists":
      return NextResponse.json({ value: await getSharedLists() });
    case key === "groups":
      return NextResponse.json({ value: await getGroups(currentUser) });
    case key === "user-filter-presets":
      return NextResponse.json({ value: await getUserFilterPresets(currentUser) });
    case key === "user-stats":
      return NextResponse.json({ value: await getUserStats(currentUser) });
    case key === "user-wrapped":
      return NextResponse.json({ value: await getUserStats(currentUser) });
    case key === "home-activity-feed":
      return NextResponse.json({ value: await getActivityFeed() });
    case key === "user-notifications":
      return NextResponse.json({ value: await getUserNotifications(currentUser) });
    case key === "user-messages":
      return NextResponse.json({ value: await getUserMessages(currentUser) });
    case key === "user-watchlist-current":
      return NextResponse.json({ value: currentUser ? await getUserWatchlist(currentUser.id) : [] });
    case key.startsWith("user-watchlist-"):
      return NextResponse.json({ value: await getUserWatchlist(key.replace("user-watchlist-", "")) });
    case key === "user-reviews-current":
      return NextResponse.json({ value: await getUserReviews(currentUser) });
    default:
      return NextResponse.json({ error: "Unknown data key" }, { status: 400 });
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
    default:
      return NextResponse.json({ error: "Unknown or read-only data key" }, { status: 400 });
  }
}
