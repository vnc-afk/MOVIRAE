import { NextResponse } from "next/server";

import { addSharedListMovie, getCurrentUser, removeSharedListMovie } from "@/lib/shared-lists";
import { publishSharedListEvent } from "@/lib/shared-list-events";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  const currentUser = await getCurrentUser();
  const body = await request.json().catch(() => null);
  const headerOpId = request.headers.get("x-op-id");
  const opId = typeof body?.opId === "string" ? body.opId : headerOpId ?? undefined;
  const movieId = typeof body?.movieId === "string" ? body.movieId.trim() : "";

  if (!movieId) {
    return NextResponse.json({ error: "Movie ID is required." }, { status: 400 });
  }

  const result = await addSharedListMovie(listId, movieId, currentUser);

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error === "unauthorized" ? "Unauthorized" : result.error === "movie-not-found" ? "Movie not found." : "Shared list not found." },
      { status: result.error === "unauthorized" ? 401 : result.error === "movie-not-found" ? 404 : 404 }
    );
  }

  const updatedLists = result.value;
  const updatedList = Array.isArray(updatedLists) ? updatedLists.find((list) => list.id === listId) : undefined;
  publishSharedListEvent(listId, "updated", opId, updatedList);
  return NextResponse.json({ ...result, opId });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  const currentUser = await getCurrentUser();
  const body = await request.json().catch(() => null);
  const headerOpId = request.headers.get("x-op-id");
  const opId = typeof body?.opId === "string" ? body.opId : headerOpId ?? undefined;
  const movieId = typeof body?.movieId === "string" ? body.movieId.trim() : "";

  if (!movieId) {
    return NextResponse.json({ error: "Movie ID is required." }, { status: 400 });
  }

  const result = await removeSharedListMovie(listId, movieId, currentUser);

  if ("error" in result) {
    return NextResponse.json(
      {
        error:
          result.error === "unauthorized"
            ? "Unauthorized"
            : result.error === "movie-not-found"
              ? "Movie not found."
              : "Shared list not found.",
      },
      { status: result.error === "unauthorized" ? 401 : 404 }
    );
  }

  const updatedLists = result.value;
  const updatedList = Array.isArray(updatedLists) ? updatedLists.find((list) => list.id === listId) : undefined;
  publishSharedListEvent(listId, "updated", opId, updatedList);
  return NextResponse.json({ ...result, opId });
}
