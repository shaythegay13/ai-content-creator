import type {
  IntelligenceRecord,
  Platform,
  TrendRecord,
} from '../types/domain';
export interface AIProvider {
  readonly name: string;
  complete?(request: AIRequest): Promise<AIResult>;
  generate(prompt: string): Promise<{
    text: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
  }>;
}
export type AIMessageInput = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};
export type ToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};
export type ToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};
export type AIRequest = {
  messages: AIMessageInput[];
  tier?: 'primary' | 'fast';
  tools?: ToolDefinition[];
  json?: boolean;
  maxOutputTokens?: number;
};
export type AIResult = {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  toolCalls?: ToolCall[];
};
export interface TranscriptionProvider {
  transcribe(
    data: Uint8Array,
    mimeType: string,
  ): Promise<{ text: string; mock: boolean }>;
}
export interface MediaUnderstandingProvider {
  analyze(
    data: Uint8Array,
    mimeType: string,
  ): Promise<{ description: string; topics: string[]; mock: boolean }>;
}
export interface MediaStorageProvider {
  put(data: Uint8Array, filename: string): Promise<string>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
}
export interface SocialPublisher {
  publish(input: {
    platform: Platform;
    text: string;
    approved: boolean;
  }): Promise<{ externalId: string; simulated: boolean }>;
}
export interface SocialAnalyticsProvider {
  metrics(
    externalId: string,
  ): Promise<{ impressions: number; likes: number; comments: number }>;
}
export interface TrendSource {
  fetch(): Promise<TrendRecord[]>;
}
export interface IntelligenceSourceProvider {
  fetch(): Promise<IntelligenceRecord[]>;
}
export interface ChatChannel {
  receive(): Promise<string[]>;
  send(text: string): Promise<{ simulated: boolean }>;
}
export interface AuthenticationProvider {
  currentUser(): Promise<{ id: string; name: string; email: string } | null>;
}
