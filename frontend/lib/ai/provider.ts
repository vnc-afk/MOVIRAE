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

export interface AIFunctionCall {
  name: string;
  args: Record<string, unknown>;
  thoughtSignature?: string;
}

export interface AIToolResult {
  name: string;
  response: Record<string, unknown>;
}

export interface AIToolExchange {
  call: AIFunctionCall;
  result: AIToolResult;
}

export interface AITextGenerationRequest {
  messages: AIMessage[];
  tools?: AIFunctionTool[];
  toolExchanges?: AIToolExchange[];
  functionCall?: AIFunctionCall;
  toolResult?: AIToolResult;
}

export interface AITextGenerationResponse {
  text: string;
  functionCall?: AIFunctionCall;
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