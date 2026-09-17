export type AIMessageRole = "user" | "assistant" | "system";

export interface AIMessage {
  role: AIMessageRole;
  content: string;
}

export interface AIFunctionTool {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface AITextGenerationRequest {
  messages: AIMessage[];
  tools?: AIFunctionTool[];
}

export interface AITextGenerationResponse {
  text: string;
}

export interface AIProvider {
  generateText(request: AITextGenerationRequest): Promise<AITextGenerationResponse>;
}

export class AIProviderError extends Error {
  constructor(
    public readonly code: "MISSING_API_KEY" | "MODEL_NOT_FOUND" | "RATE_LIMIT" | "TIMEOUT" | "UNAVAILABLE" | "INVALID_RESPONSE" | "PROVIDER_ERROR",
    message: string,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}