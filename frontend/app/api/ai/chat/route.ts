import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/features/auth/config";
import { AIProviderError } from "@/lib/ai/provider";
import { aiProvider } from "@/lib/ai/gemini-provider";
import { executeTool, toolDefinitions } from "@/lib/ai/tools/registry";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(12_000),
}).strict();

const requestSchema = z.object({
  message: z.string().trim().min(1).max(8_000),
  history: z.array(messageSchema).max(30).default([]),
}).strict();

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const messages = [...parsed.data.history, { role: "user" as const, content: parsed.data.message }];
    const result = await aiProvider.generateText({
      messages,
      tools: toolDefinitions,
    });

    if (result.functionCall) {
      const email = session.user.email;
      if (!email) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

      const toolResult = await executeTool(result.functionCall.name, result.functionCall.args, { userId: user.id });
      const finalResult = await aiProvider.generateText({
        messages: [
          { role: "system", content: "Use the tool result to answer the user directly. Do not request another tool or function. If the tool failed, explain that briefly." },
          ...messages,
        ],
        functionCall: result.functionCall,
        toolResult: { name: result.functionCall.name, response: { ...toolResult } },
      });

      if (finalResult.functionCall) {
        const retryResult = await aiProvider.generateText({
          messages: [
            { role: "system", content: "Answer the user's request directly using the trusted tool result below. Do not call any tools." },
            ...messages,
            { role: "user", content: `Trusted tool result from ${result.functionCall.name}: ${JSON.stringify(toolResult)}` },
          ],
        });

        if (retryResult.functionCall) {
          return NextResponse.json({
            response: toolResult.success ? "I found the requested information, but I could not summarize it right now." : "I could not retrieve that information right now.",
            movies: toolResult.displayMovies ?? [],
          });
        }
        return NextResponse.json({ response: retryResult.text, movies: toolResult.displayMovies ?? [] });
      }
      return NextResponse.json({ response: finalResult.text, movies: toolResult.displayMovies ?? [] });
    }

    return NextResponse.json({ response: result.text });
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

    console.error("/api/ai/chat POST error:", error);
    return NextResponse.json({ error: "Unable to generate an AI response" }, { status: 500 });
  }
}