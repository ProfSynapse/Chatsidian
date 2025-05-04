/**
 * Provider Adapter Interface
 * 
 * This file defines the common interface that all AI provider adapters must implement.
 * It serves as a contract for the adapter pattern, allowing the application to interact
 * with different AI providers (OpenAI, Anthropic, Google, etc.) through a consistent interface.
 * 
 * Each provider adapter translates between our application's common interface and the
 * provider-specific SDK or API requirements.
 */

import { 
  ModelInfo, 
  ProviderChunk, 
  ProviderMessage, 
  ProviderRequest, 
  ProviderResponse 
} from '../models/Provider';

/**
 * Interface for provider-specific adapters.
 * All AI provider adapters must implement this interface.
 */
export interface ProviderAdapter {
  /**
   * The name of the provider (e.g., 'anthropic', 'openai', 'google')
   */
  readonly provider: string;

  /**
   * Test the connection to the provider API.
   * This should make a lightweight API call to verify credentials.
   * 
   * @returns A promise that resolves to true if the connection is successful, false otherwise
   */
  testConnection(): Promise<boolean>;

  /**
   * Get a list of available models from this provider.
   * 
   * @returns A promise that resolves to an array of ModelInfo objects
   */
  getAvailableModels(): Promise<ModelInfo[]>;

  /**
   * Send a request to the provider API and get a complete response.
   * This is for non-streaming requests.
   * 
   * @param request The request parameters
   * @returns A promise that resolves to a ProviderResponse
   */
  sendRequest(request: ProviderRequest): Promise<ProviderResponse>;

  /**
   * Send a streaming request to the provider API.
   * 
   * @param request The request parameters (should have stream: true)
   * @param onChunk Callback function that will be called for each chunk received
   * @returns A promise that resolves when the stream is complete
   */
  sendStreamingRequest(
    request: ProviderRequest,
    onChunk: (chunk: ProviderChunk) => void
  ): Promise<void>;

  /**
   * Cancel an ongoing streaming request.
   * This should abort any in-progress requests.
   * 
   * @returns A promise that resolves when the request is cancelled
   */
  cancelRequest(): Promise<void>;
}

/**
 * Type for a factory function that creates a provider adapter.
 */
export type ProviderAdapterFactory = (apiKey: string, apiEndpoint?: string) => ProviderAdapter;
