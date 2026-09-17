import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/features/auth/config";
import { MOVIRAE_AGENT_INSTRUCTIONS } from "@/lib/ai/instructions";
import { AIProviderError } from "@/lib/ai/provider";
import { aiProvider } from "@/lib/ai/gemini-provider";
import { executeTool, toToolModelResponse, toolDefinitions } from "@/lib/ai/tools/registry";
import { prisma } from "@/lib/prisma";
import { aiRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(12_000),
}).strict();

const requestSchema = z.object({
  message: z.string().trim().min(1).max(8_000),
  history: z.array(messageSchema).max(30).default([]),
}).strict();

const USER_TOOLS = new Set([
  "get_my_watch_history",
  "get_my_ratings",
  "get_my_reviews",
  "get_my_rating",
  "get_my_review",
  "get_my_watchlist",
  "get_my_movie_preferences",
  "add_to_watchlist",
  "remove_from_watchlist",
  "check_watchlist",
]);
const DEFAULT_MAX_TOOL_ITERATIONS = 8;
const MAX_TOOL_CALLS = 12;
const MAX_REQUEST_BYTES = 64 * 1024;
const REQUEST_TIMEOUT_MS = 90_000;
const MAX_TOOL_RESULT_BYTES = 32 * 1024;
const MAX_DISPLAY_MOVIES = 20;
const MAX_TOOL_CONTEXT_BYTES = 96 * 1024;
const TOOL_INTENT_PATTERN = /\b(find|search|show|list|recommend|similar|add|remove|check|discover|watchlist|watched|ratings?|reviews?|preferences?|details|tell me about)\b/i;

function getMaxToolIterations() {
  const configured = Number(process.env.AI_MAX_TOOL_ITERATIONS ?? DEFAULT_MAX_TOOL_ITERATIONS);
  return Number.isInteger(configured) && configured > 0 && configured <= 20 ? configured : DEFAULT_MAX_TOOL_ITERATIONS;
}

function getRequestId(request: Request) {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && /^[A-Za-z0-9._:-]{1,100}$/.test(supplied) ? supplied : crypto.randomUUID();
}

function withRequestTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new AIProviderError("TIMEOUT", "The AI request took too long to complete.")), REQUEST_TIMEOUT_MS);
    promise.then(resolve, reject).finally(() => clearTimeout(timeout));
  });
}

function limitToolResult(result: Record<string, unknown>) {
  const serialized = JSON.stringify(result);
  if (serialized.length <= MAX_TOOL_RESULT_BYTES) return result;
  return { success: false, error: "Tool result exceeded the allowed size" };
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  if (aiRateLimit) {
    const rateLimit = await aiRateLimit.limit(getClientIp(request));
    if (!rateLimit.success) {
      return NextResponse.json({ error: "Too many AI requests. Please try again later." }, { status: 429 });
    }
  }
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Request is too large" }, { status: 413 });
  }
  const rawBody = await request.text().catch(() => "");
  if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Request is too large" }, { status: 413 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody || "null");
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    return await withRequestTimeout(runAgent({ requestId, session, parsed: parsed.data }));
  } catch (error) {
    if (error instanceof AIProviderError) {
      const statusByCode = {
        MISSING_API_KEY: 503,
        MODEL_NOT_FOUND: 503,
        RATE_LIMIT: 429,
        TIMEOUT: 504,
        UNAVAILABLE: 503,
        INVALID_RESPONSE: 502,
        PROVIDER_ERROR: 502,
      } as const;
      return NextResponse.json({ error: error.message }, { status: statusByCode[error.code] });
    }
    console.error("/api/ai/chat failed", { requestId, error: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "Unable to complete the AI request" }, { status: 500 });
  }
}

async function runAgent({ requestId, session, parsed }: { requestId: string; session: Session; parsed: z.infer<typeof requestSchema> }) {
  const messages = [{ role: "system" as const, content: MOVIRAE_AGENT_INSTRUCTIONS }, ...parsed.history, { role: "user" as const, content: parsed.message }];
  const toolsForRequest = TOOL_INTENT_PATTERN.test(parsed.message) ? toolDefinitions : undefined;
    const toolExchanges = [] as Array<NonNullable<Parameters<typeof aiProvider.generateText>[0]["toolExchanges"]>[number]>;
    const displayMovies = [] as NonNullable<Awaited<ReturnType<typeof executeTool>>["displayMovies"]>;
    const callCounts = new Map<string, number>();
    let userId: string | null = null;
    const maxIterations = getMaxToolIterations();

    const getTrustedUserId = async () => {
      if (userId) return userId;
      const email = session.user.email;
      if (!email) return null;
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      userId = user?.id ?? null;
      return userId;
    };

    for (let iteration = 0; iteration < maxIterations && toolExchanges.length < MAX_TOOL_CALLS; iteration += 1) {
      const result = await aiProvider.generateText({ messages, tools: toolsForRequest, toolExchanges });
      if (!result.functionCall) {
        console.info("[ai] completed", { requestId, iterations: iteration, toolCalls: toolExchanges.length });
        return NextResponse.json({ response: result.text, movies: displayMovies });
      }

      if (
        typeof result.functionCall.name !== "string" ||
        !result.functionCall.name ||
        !result.functionCall.args ||
        typeof result.functionCall.args !== "object" ||
        Array.isArray(result.functionCall.args)
      ) {
        console.warn("[ai] malformed function call", { requestId, iteration });
        return NextResponse.json({ error: "The assistant returned an invalid tool request" }, { status: 502 });
      }

      const callKey = `${result.functionCall.name}:${JSON.stringify(result.functionCall.args)}`;
      const callCount = (callCounts.get(callKey) ?? 0) + 1;
      callCounts.set(callKey, callCount);
      if (callCount > 2) {
        console.warn("[ai] repeated tool call stopped", { requestId, iteration, tool: result.functionCall.name });
        break;
      }

      const trustedUserId = USER_TOOLS.has(result.functionCall.name) ? await getTrustedUserId() : userId ?? "system";
      if (!trustedUserId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

      const startedAt = Date.now();
      const toolResult = await executeTool(result.functionCall.name, result.functionCall.args, { userId: trustedUserId });
      console.info("[ai] tool", {
        requestId,
        iteration,
        tool: result.functionCall.name,
        durationMs: Date.now() - startedAt,
        success: toolResult.success,
      });
      if (toolResult.displayMovies?.length) {
        const uniqueMovies = new Map(displayMovies.map((movie) => [movie.id, movie]));
        for (const movie of toolResult.displayMovies) uniqueMovies.set(movie.id, movie);
        displayMovies.splice(0, displayMovies.length, ...Array.from(uniqueMovies.values()).slice(0, MAX_DISPLAY_MOVIES));
      }
      const nextExchange = {
        call: result.functionCall,
        result: { name: result.functionCall.name, response: limitToolResult(toToolModelResponse(toolResult)) },
      };
      const nextContextBytes = new TextEncoder().encode(JSON.stringify([...toolExchanges, nextExchange])).byteLength;
      if (nextContextBytes > MAX_TOOL_CONTEXT_BYTES) {
        console.warn("[ai] tool context limit reached", { requestId, iteration, tool: result.functionCall.name });
        break;
      }
      toolExchanges.push(nextExchange);
    }

    console.warn("[ai] agent limit reached", { requestId, maxIterations, maxToolCalls: MAX_TOOL_CALLS, toolCalls: toolExchanges.length });
    const stoppedResult = await aiProvider.generateText({
      messages: [
        { role: "system", content: "Provide the best concise answer using the gathered tool results. Do not request another tool." },
        ...messages,
      ],
      toolExchanges,
    });
    return NextResponse.json({
      response: stoppedResult.functionCall ? "I could not complete that request within the allowed steps." : stoppedResult.text,
      movies: displayMovies,
    });
}