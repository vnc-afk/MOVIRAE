import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/features/auth/config";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ value: [] });
  }

  const presets = await prisma.filterPreset.findMany({
    where: { userId: currentUser.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    value: presets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      filters: {
        genreId: preset.genreId ?? undefined,
        minRuntime: preset.minRuntime ?? undefined,
        maxRuntime: preset.maxRuntime ?? undefined,
      },
    })),
  });
}

export async function PUT(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!Array.isArray(payload)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
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

  const presets = await prisma.filterPreset.findMany({
    where: { userId: currentUser.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    value: presets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      filters: {
        genreId: preset.genreId ?? undefined,
        minRuntime: preset.minRuntime ?? undefined,
        maxRuntime: preset.maxRuntime ?? undefined,
      },
    })),
  });
}
