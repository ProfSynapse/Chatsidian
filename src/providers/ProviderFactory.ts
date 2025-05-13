/**
 * Provider Factory
 *
 * This file provides a factory for creating provider adapters.
 * It centralizes the creation of provider adapters and makes it easy to add new providers.
 * It also integrates with the ModelRegistry to provide access to model information.
 */

import { App } from 'obsidian';
import { ModelInfo } from '../models/Provider';
import { ProviderAdapter, ProviderAdapterFactory } from './ProviderAdapter';
import { OpenAIAdapter } from './OpenAIAdapter';
import { AnthropicAdapter } from './AnthropicAdapter';
import { GeminiAdapter } from './GeminiAdapter';
import { OpenRouterAdapter } from './OpenRouterAdapter';
import { RequestyAdapter } from './RequestyAdapter';
import { modelRegistry } from './ModelRegistry';
import { ProviderType } from '../ui/models/ProviderType';

/**
 * Map of provider names to their factory functions.
 */
const providerFactories: Record<string, ProviderAdapterFactory> = {
  'openai': (apiKey: string, apiEndpoint?: string) => new OpenAIAdapter(apiKey, apiEndpoint),
  'anthropic': (apiKey: string, apiEndpoint?: string) => new AnthropicAdapter(apiKey, apiEndpoint),
  'google': (apiKey: string, apiEndpoint?: string) => new GeminiAdapter(apiKey, apiEndpoint),
  'openrouter': (apiKey: string, apiEndpoint?: string) => new OpenRouterAdapter(apiKey, apiEndpoint),
  'requesty': (apiKey: string, apiEndpoint?: string) => new RequestyAdapter(apiKey, apiEndpoint)
};

/**
 * Factory for creating provider adapters and accessing model information.
 */
export class ProviderFactory {
  private static initialized = false;

  /**
   * Initialize the ProviderFactory.
   * This must be called before using any methods that access model information.
   * 
   * @param app The Obsidian app instance
   */
  public static initialize(app: App): void {
    if (this.initialized) {
      return;
    }
    
    // ModelRegistry is a singleton that's already initialized
    // so we just need to set our initialized flag
    this.initialized = true;
  }

  /**
   * Create a provider adapter for the specified provider.
   *
   * @param provider The name of the provider
   * @param apiKey The API key for the provider
   * @param apiEndpoint Optional custom API endpoint URL
   * @returns A provider adapter instance
   * @throws Error if the provider is not supported
   */
  static createProvider(provider: string, apiKey: string, apiEndpoint?: string): ProviderAdapter {
    const factory = providerFactories[provider.toLowerCase()];
    
    if (!factory) {
      throw new Error(`Unsupported provider: ${provider}`);
    }
    
    return factory(apiKey, apiEndpoint);
  }

  /**
   * Get a list of supported provider names.
   *
   * @returns An array of supported provider names
   */
  static getSupportedProviders(): string[] {
    return Object.keys(providerFactories);
  }

  /**
   * Check if a provider is supported.
   *
   * @param provider The name of the provider
   * @returns True if the provider is supported, false otherwise
   */
  static isProviderSupported(provider: string): boolean {
    // Check if the provider is in our factory map
    if (providerFactories[provider.toLowerCase()]) {
      return true;
    }
    
    // Check if the provider is in the ModelRegistry
    if (this.initialized) {
      const availableProviders = modelRegistry.getAvailableProviders();
      return availableProviders.includes(provider.toLowerCase() as ProviderType);
    }
    
    return false;
  }

  /**
   * Register a new provider factory.
   * This allows for extending the factory with new providers.
   *
   * @param provider The name of the provider
   * @param factory The factory function for creating the provider adapter
   */
  static registerProvider(provider: string, factory: ProviderAdapterFactory): void {
    providerFactories[provider.toLowerCase()] = factory;
  }

  /**
   * Get all available models for a specific provider.
   *
   * @param provider The name of the provider
   * @returns An array of ModelInfo objects for the provider
   */
  static getModelsForProvider(provider: string): ModelInfo[] {
    if (!this.initialized) {
      console.warn('ProviderFactory not initialized. Call initialize() first.');
      return [];
    }
    
    return modelRegistry.getModelsForProvider(provider.toLowerCase() as ProviderType);
  }

  /**
   * Get all available models across all providers.
   *
   * @returns An array of ModelInfo objects for all providers
   */
  static getAllModels(): ModelInfo[] {
    if (!this.initialized) {
      console.warn('ProviderFactory not initialized. Call initialize() first.');
      return [];
    }
    
    return modelRegistry.getAllModels();
  }

  /**
   * Find a model by its ID across all providers.
   *
   * @param modelId The model ID to find
   * @returns The ModelInfo object or undefined if not found
   */
  static findModelById(modelId: string): ModelInfo | undefined {
    if (!this.initialized) {
      console.warn('ProviderFactory not initialized. Call initialize() first.');
      return undefined;
    }
    
    return modelRegistry.findModelById(modelId);
  }

  /**
   * Get the display name for a provider.
   *
   * @param provider The provider ID
   * @returns The display name of the provider
   */
  static getProviderName(provider: string): string {
    if (!this.initialized) {
      return provider;
    }
    
    // ModelRegistry doesn't have a getProviderName method, so we'll just return the provider name
    return provider;
  }
}