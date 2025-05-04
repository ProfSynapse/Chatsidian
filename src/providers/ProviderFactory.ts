/**
 * Provider Factory
 * 
 * This file provides a factory for creating provider adapters.
 * It centralizes the creation of provider adapters and makes it easy to add new providers.
 * It also integrates with the ModelsLoader to provide access to model information.
 */

import { App } from 'obsidian';
import { ModelInfo } from '../models/Provider';
import { ProviderAdapter, ProviderAdapterFactory } from './ProviderAdapter';
import { OpenAIAdapter } from './OpenAIAdapter';
import { AnthropicAdapter } from './AnthropicAdapter';
import { GeminiAdapter } from './GeminiAdapter';
import { OpenRouterAdapter } from './OpenRouterAdapter';
import { RequestyAdapter } from './RequestyAdapter';
import { ModelsLoader } from './ModelsLoader';

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
  private static modelsLoader: ModelsLoader | null = null;
  private static initialized = false;

  /**
   * Initialize the ProviderFactory with the Obsidian app instance.
   * This must be called before using any methods that access model information.
   * 
   * @param app The Obsidian app instance
   */
  public static async initialize(app: App): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize the ModelsLoader
    this.modelsLoader = ModelsLoader.getInstance();
    this.modelsLoader.initialize(app);
    
    try {
      // Load the models from the YAML file
      await this.modelsLoader.loadModels();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize ProviderFactory:', error);
      throw error;
    }
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
    
    // If we have a ModelsLoader, also check if the provider is in the YAML file
    if (this.modelsLoader && this.initialized) {
      const availableProviders = this.modelsLoader.getAvailableProviders();
      return availableProviders.includes(provider.toLowerCase());
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
    if (!this.modelsLoader || !this.initialized) {
      console.warn('ProviderFactory not initialized. Call initialize() first.');
      return [];
    }
    
    return this.modelsLoader.getModelsForProvider(provider);
  }

  /**
   * Get all available models across all providers.
   * 
   * @returns An array of ModelInfo objects for all providers
   */
  static getAllModels(): ModelInfo[] {
    if (!this.modelsLoader || !this.initialized) {
      console.warn('ProviderFactory not initialized. Call initialize() first.');
      return [];
    }
    
    return this.modelsLoader.getAllModels();
  }

  /**
   * Find a model by its ID across all providers.
   * 
   * @param modelId The model ID to find
   * @returns The ModelInfo object or undefined if not found
   */
  static findModelById(modelId: string): ModelInfo | undefined {
    if (!this.modelsLoader || !this.initialized) {
      console.warn('ProviderFactory not initialized. Call initialize() first.');
      return undefined;
    }
    
    return this.modelsLoader.findModelById(modelId);
  }

  /**
   * Get the display name for a provider.
   * 
   * @param provider The provider ID
   * @returns The display name of the provider
   */
  static getProviderName(provider: string): string {
    if (!this.modelsLoader || !this.initialized) {
      return provider;
    }
    
    return this.modelsLoader.getProviderName(provider);
  }
}
