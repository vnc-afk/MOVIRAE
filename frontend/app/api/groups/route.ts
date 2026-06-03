import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildUserProfile,
  getCurrentUser,
  requireAuth,
  buildLogContext,
} from "@/app/groups/lib/api-utils";
import {
  apiValidationError,
  apiUnauthorized,
  apiInternalError,
} from "@/app/groups/lib/api-response";
import {
  createGroupSchema,
  groupsListQuerySchema,
} from "@/app/groups/lib/api-schemas";

export const runtime = "nodejs";

/**
 * GET /api/groups
 *
 * Fetch groups with pagination and current user membership state
 */
export async function GET(request: Request) {
  const logCtx = buildLogContext(request);

  try {
    const currentUser = await getCurrentUser();
    const { searchParams } = new URL(request.url);

    const queryResult = groupsListQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!queryResult.success) {
      return apiValidationError("Invalid query parameters", {
        fields: queryResult.error.flatten().fieldErrors,
      });
    }

    const { page, limit, search, order } = queryResult.data;
    const skip = (page - 1) * limit;

    const where: Prisma.GroupWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as Prisma.QueryMode } },
            { description: { contains: search, mode: "insensitive" as Prisma.QueryMode } },
          ],
        }
      : {};

    const [groups, total, membership] = await prisma.$transaction([
      prisma.group.findMany({
        where,
        include: {
          creator: true,
          members: { include: { user: true } },
          sharedLists: true,
        },
        orderBy: { createdAt: order },
        skip,
        take: limit,
      }),
      prisma.group.count({ where }),
      prisma.groupMember.findMany({
        where: { userId: currentUser?.id ?? "" },
        select: { groupId: true },
      }),
    ]);

    const currentGroupIds = new Set(membership.map((member) => member.groupId));

    const groupRecords = groups.map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description || "",
      avatar: group.avatar || "",
      creatorId: group.creatorId,
      creator: buildUserProfile(group.creator),
      members: group.members.map((member) => buildUserProfile(member.user)),
      memberCount: group.members.length,
      sharedList: group.sharedLists || [],
      joined: currentGroupIds.has(group.id),
      createdAt: group.createdAt.toISOString(),
    }));

    return new Response(
      JSON.stringify({
        value: groupRecords,
        currentUser: currentUser ? buildUserProfile(currentUser) : null,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: skip + limit < total,
          hasPrevious: page > 1,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("/api/groups GET error:", err);
    return apiInternalError();
  }
}

/**
 * POST /api/groups
 *
 * Create a new group
 */
export async function POST(request: Request) {
  const logCtx = buildLogContext(request);

  try {
    const currentUser = await requireAuth(request);
    logCtx.userId = currentUser.id;

    const body = await request.json().catch(() => ({}));
    const parseResult = createGroupSchema.safeParse(body);

    if (!parseResult.success) {
      return apiValidationError("Invalid request body", {
        fields: parseResult.error.flatten().fieldErrors,
      });
    }

    const { name, description } = parseResult.data;

    const group = await prisma.group.create({
      data: {
        name,
        description,
        creatorId: currentUser.id,
        members: {
          create: {
            userId: currentUser.id,
          },
        },
      },
      include: {
        creator: true,
        members: { include: { user: true } },
        sharedLists: true,
      },
    });

    await prisma.groupAdmin.upsert({
      where: {
        groupId_userId: { groupId: group.id, userId: currentUser.id },
      },
      update: {},
      create: { groupId: group.id, userId: currentUser.id },
    });

    const response = {
      id: group.id,
      name: group.name,
      description: group.description || "",
      avatar: group.avatar || "",
      creatorId: group.creatorId,
      creator: buildUserProfile(group.creator),
      members: group.members.map((member) => buildUserProfile(member.user)),
      memberCount: group.members.length,
      sharedList: group.sharedLists || [],
      joined: true,
      createdAt: group.createdAt.toISOString(),
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "ApiError") {
      return apiUnauthorized();
    }

    console.error("/api/groups POST error:", err);
    return apiInternalError();
  }
}
