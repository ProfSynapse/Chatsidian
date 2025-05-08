/**
 * Models related to AI providers and their APIs.
 * Defines the interfaces for structuring requests and responses
 * when communicating with external AI services via MCP or direct APIs.
 * Also includes common model information.
 */

import { ProviderType } from '../ui/models/ProviderType';

/**
 * Represents a message in the format expected by AI providers.
 * This often differs slightly from the internal `Message` interface.
 */
export interface ProviderMessage {
  /** The role of the message sender (e.g., 'user', 'assistant') */
  role: string;

  /** The content of the message */
  content: string;

  /** Optional tool calls made by this message (provider-specific format) */
  toolCalls?: any[];

  /** Optional tool results from tool calls (provider-specific format) */
  toolResults?: any[];
}

/**
 * Represents a request payload sent to an AI provider's API.
 */
export interface ProviderRequest {
  /** The sequence of messages forming the conversation history */
  messages: ProviderMessage[];

  /** The specific model identifier to use for the request */
  model: string;

  /** Optional parameter controlling randomness (0.0 to 1.0) */
  temperature?: number;

  /** Optional parameter limiting the maximum number of tokens in the response */
  maxTokens?: number;

  /** Optional list of tools available to the model (provider-specific format) */
  tools?: any[];

  /** Whether to request a streaming response from the provider */
  stream?: boolean;
}

/**
 * Represents a complete (non-streamed) response from an AI provider.
 */
export interface ProviderResponse {
  /** Unique identifier for the response, usually provided by the API */
  id: string;

  /** The message returned by the provider */
  message: ProviderMessage;

  /** Optional tool calls made by the model in its response */
  toolCalls?: any[];

  // Add other common response fields like usage statistics if needed
  // usage?: { input_tokens: number; output_tokens: number };
}

/**
 * Represents a single chunk of data in a streamed response from an AI provider.
 */
export interface ProviderChunk {
  /** Unique identifier for the response stream this chunk belongs to */
  id: string;

  /** The incremental update contained in this chunk */
  delta: {
    /** Optional text content delta */
    content?: string;

    /** Optional tool call updates (provider-specific format) */
    toolCalls?: any[];

    // Add other potential delta fields like role changes if applicable
    // role?: string;
  };

  // Add other chunk metadata if needed, e.g., sequence number, finish reason
  // finish_reason?: string;
}

/**
 * Represents an error returned from an AI provider's API.
 */
export interface ProviderError {
  /** Error code provided by the API */
  code: string;

  /** Human-readable error message */
  message: string;

  /** Optional field indicating the parameter that caused the error */
  param?: string;

  /** Type of error (e.g., 'api_error', 'invalid_request_error') */
  type: string;
}

/**
 * Represents metadata about a specific AI model available from a provider.
 */
export interface ModelInfo {
  /** Unique identifier used in API requests (e.g., 'claude-3-opus-20240229') */
  id: string;

  /** User-friendly display name for the model (e.g., 'Claude 3 Opus') */
  name: string;

  /** The provider offering this model (e.g., 'anthropic', 'openai') */
  provider: ProviderType;

  /** Maximum context window size in tokens */
  contextSize: number;

  /** Whether the model supports function/tool calling */
  supportsTools: boolean;

  /** Whether the model is explicitly designed for or supports JSON output mode */
  supportsJson?: boolean;

  /** Maximum number of tokens the model can generate in a single response */
  maxOutputTokens?: number;
}

/**
 * A list of common, known AI models with their relevant information.
 * This can be used for default selections or populating UI elements.
 */
export const COMMON_MODELS: ModelInfo[] = [
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    contextSize: 200000,
    supportsTools: true,
    supportsJson: true,
    maxOutputTokens: 4096,
  },
  {
    id: 'claude-3-sonnet-20240229',
    name: 'Claude 3 Sonnet',
    provider: 'anthropic',
    contextSize: 200000,
    supportsTools: true,
    supportsJson: true,
    maxOutputTokens: 4096,
  },
  {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    contextSize: 200000,
    supportsTools: true,
    supportsJson: true,
    maxOutputTokens: 4096,
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    contextSize: 128000,
    supportsTools: true,
    supportsJson: true,
    maxOutputTokens: 4096,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    contextSize: 128000,
    supportsTools: true,
    supportsJson: true,
    maxOutputTokens: 4096,
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    contextSize: 16385,
    supportsTools: true,
    supportsJson: true,
    maxOutputTokens: 4096,
  },
];
