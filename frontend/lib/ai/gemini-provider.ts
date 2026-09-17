import { GoogleGenAI } from "@google/genai";

import {
  AIProviderError,
  type AIMessage,
  type AIProvider,
  type AITextGenerationRequest,
  type AITextGenerationResponse,
} from "./provider";

const DEFAULT_MODEL = "gemini-flash-lite-latest";
const REQUEST_TIMEOUT_MS = 30_000;

function toGeminiContents(messages: AIMessage[]) {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));
}

function getProviderError(error: unknown): AIProviderError {
  const status = typeof error === "object" && error !== null && "status" in error ? (error as { status?: unknown }).status : undefined;
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (status === 429 || message.includes("rate limit") || message.includes("resource exhausted")) {
    return new AIProviderError("RATE_LIMIT", "The AI service is temporarily rate limited.");
  }

  if (status === 404 || message.includes("model") && message.includes("not found")) {
    return new AIProviderError("MODEL_NOT_FOUND", "The configured Gemini model is unavailable.");
  }

  if (message.includes("timeout") || message.includes("timed out")) {
    return new AIProviderError("TIMEOUT", "The AI service took too long to respond.");
  }

  if (typeof status === "number" && status >= 500 || message.includes("fetch failed") || message.includes("unavailable")) {
    return new AIProviderError("UNAVAILABLE", "The AI service is temporarily unavailable.");
  }

  return new AIProviderError("PROVIDER_ERROR", "The AI service could not complete the request.");
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new AIProviderError("TIMEOUT", "The AI service took too long to respond.")), REQUEST_TIMEOUT_MS);
    promise.then(resolve, reject).finally(() => clearTimeout(timeout));
  });
}

export class GeminiProvider implements AIProvider {
  async generateText({ messages }: AITextGenerationRequest): Promise<AITextGenerationResponse> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new AIProviderError("MISSING_API_KEY", "Gemini is not configured.");
    }

    const systemInstruction = messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await withTimeout(ai.models.generateContent({
        model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
        contents: toGeminiContents(messages),
        config: systemInstruction ? { systemInstruction } : undefined,
      }));

      const text = response.text?.trim();
      if (!text) {
        throw new AIProviderError("INVALID_RESPONSE", "Gemini returned an empty response.");
      }

      return { text };
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw getProviderError(error);
    }
  }
}

export const aiProvider: AIProvider = new GeminiProvider();