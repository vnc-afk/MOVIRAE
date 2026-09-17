import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/features/auth/config";
import { AIProviderError } from "@/lib/ai/provider";
import { aiProvider } from "@/lib/ai/gemini-provider";

export const runtime = "nodejs";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4_000),
}).strict();

const requestSchema = z.object({
  message: z.string().trim().min(1).max(4_000),
  history: z.array(messageSchema).max(20).default([]),
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
    const result = await aiProvider.generateText({
      messages: [...parsed.data.history, { role: "user", content: parsed.data.message }],
    });

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