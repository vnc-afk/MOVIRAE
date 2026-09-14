import { NextResponse } from "next/server";

import { publishSharedListEvent } from "@/app/shared-lists/lib/events";
import { addSharedListMovie, removeSharedListMovie } from "@/services/shared-lists/mutations.server";
import { getOpId, parseRequestJson, requireAuth } from "@/app/shared-lists/lib/api-utils";

export const runtime = "nodejs";

/*
  POST /api/shared-lists/[listId]/movies
  - Adds a movie (by TMDb id) to the shared list. Requires write permission (owner/collaborator).
  - Returns mapped error codes/messages for the client to surface.

  DELETE /api/shared-lists/[listId]/movies
  - Removes a movie from the list. Also requires write permission.
*/
const movieErrorStatus: Record<string, number> = {
  unauthorized: 401,
  "movie-not-found": 404,
  "not-found": 404,
};

const movieErrorMessage: Record<string, string> = {
  unauthorized: "Unauthorized",
  "movie-not-found": "Movie not found.",
  "not-found": "Shared list not found.",
};

export async function POST(request: Request, { params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  const currentUser = await requireAuth(request);
  const body = await parseRequestJson(request);
  const opId = getOpId(request, body);
  const movieId = typeof body?.movieId === "string" ? body.movieId.trim() : "";

  if (!movieId) {
    return NextResponse.json({ error: "Movie ID is required." }, { status: 400 });
  }

  const result = await addSharedListMovie(listId, movieId, currentUser);

  if ("error" in result) {
    // Map service errors to client-friendly messages and HTTP codes.
    return NextResponse.json(
      { error: movieErrorMessage[result.error] ?? "Unable to add movie." },
      { status: movieErrorStatus[result.error] ?? 400 }
    );
  }

  // Notify SSE subscribers that the list changed.
  publishSharedListEvent(listId, "updated", opId, result.value);
  return NextResponse.json({ value: [result.value], opId });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  const currentUser = await requireAuth(request);
  const body = await parseRequestJson(request);
  const opId = getOpId(request, body);
  const movieId = typeof body?.movieId === "string" ? body.movieId.trim() : "";

  if (!movieId) {
    return NextResponse.json({ error: "Movie ID is required." }, { status: 400 });
  }

  const result = await removeSharedListMovie(listId, movieId, currentUser);

  if ("error" in result) {
    return NextResponse.json(
      { error: movieErrorMessage[result.error] ?? "Unable to remove movie." },
      { status: movieErrorStatus[result.error] ?? 400 }
    );
  }

  publishSharedListEvent(listId, "updated", opId, result.value);
  return NextResponse.json({ value: [result.value], opId });
}
