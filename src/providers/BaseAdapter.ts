/**
 * Base Provider Adapter
 * 
 * This file provides a base implementation of the ProviderAdapter interface
 * with common functionality that can be shared across all provider adapters.
 * 
 * Specific provider adapters can extend this class and override methods as needed
 * while inheriting common behavior.
 */

import { 
  ModelInfo, 
  ProviderChunk, 
  ProviderRequest, 
  ProviderResponse 
} from '../models/Provider';
import { ProviderAdapter } from './ProviderAdapter';
import { modelRegistry } from './ModelRegistry';
import { ProviderType, ProviderTypeUtils } from '../ui/models/ProviderType';

/**
 * Abstract base class for provider adapters.
 * Implements common functionality and provides a foundation for specific adapters.
 */
export abstract class BaseAdapter implements ProviderAdapter {
  /**
   * The name of the provider (e.g., 'anthropic', 'openai', 'google')
   */
  abstract readonly provider: string;

  /**
   * The API key for authenticating with the provider
   */
  protected apiKey: string;

  /**
   * Optional custom API endpoint URL
   */
  protected apiEndpoint?: string;

  /**
   * AbortController for cancelling requests
   */
  protected abortController: AbortController | null = null;

  /**
   * Create a new BaseAdapter.
   * 
   * @param apiKey The API key for the provider
   * @param apiEndpoint Optional custom API endpoint URL
   */
  constructor(apiKey: string, apiEndpoint?: string) {
    this.apiKey = apiKey;
    this.apiEndpoint = apiEndpoint;
  }

  /**
   * Test the connection to the provider API.
   * This should be implemented by each specific adapter.
   */
  abstract testConnection(): Promise<boolean>;

  /**
   * Get a list of available models from this provider.
   * Default implementation uses the ModelRegistry to get models.
   * Providers can override this method to fetch models from their API if needed.
   */
  async getAvailableModels(): Promise<ModelInfo[]> {
    try {
      // Get models from the centralized ModelRegistry
      if (ProviderTypeUtils.isValidProviderType(this.provider)) {
        return modelRegistry.getModelsForProvider(this.provider as ProviderType);
      }
      return [];
    } catch (error) {
      this.logError('getAvailableModels', error);
      return [];
    }
  }

  /**
   * Send a request to the provider API and get a complete response.
   * This should be implemented by each specific adapter.
   */
  abstract sendRequest(request: ProviderRequest): Promise<ProviderResponse>;

  /**
   * Send a streaming request to the provider API.
   * This should be implemented by each specific adapter.
   */
  abstract sendStreamingRequest(
    request: ProviderRequest,
    onChunk: (chunk: ProviderChunk) => void
  ): Promise<void>;

  /**
   * Cancel an ongoing streaming request.
   * This provides a common implementation that can be overridden if needed.
   */
  async cancelRequest(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Create a new AbortController for a request.
   * This is used internally to manage request cancellation.
   * 
   * @returns The created AbortController
   */
  protected createAbortController(): AbortController {
    // Cancel any existing request first
    if (this.abortController) {
      this.abortController.abort();
    }
    
    this.abortController = new AbortController();
    return this.abortController;
  }

  /**
   * Log an error with consistent formatting.
   * 
   * @param method The method where the error occurred
   * @param error The error object
   */
  protected logError(method: string, error: any): void {
    console.error(`[${this.provider}Adapter.${method}] Error:`, error);
  }

  /**
   * Validate that the API key is not empty.
   * 
   * @throws Error if the API key is empty
   */
  protected validateApiKey(): void {
    if (!this.apiKey) {
      throw new Error(`API key is required for ${this.provider}`);
    }
  }
}
