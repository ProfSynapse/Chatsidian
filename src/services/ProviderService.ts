/**
 * Provider Service
 * 
 * This service manages AI provider adapters and provides a high-level interface
 * for interacting with AI providers. It handles provider creation, caching,
 * and provides methods for sending requests to providers.
 * 
 * It also integrates with the ModelsLoader to provide access to model information.
 */

import { App } from 'obsidian';
import { EventBus } from '../core/EventBus';
import { SettingsService } from './SettingsService';
import { ModelInfo, ProviderChunk, ProviderMessage, ProviderRequest, ProviderResponse } from '../models/Provider';
import { ProviderAdapter } from '../providers/ProviderAdapter';
import { ProviderFactory } from '../providers/ProviderFactory';

/**
 * Service for managing AI provider adapters and model information.
 */
export class ProviderService {
  /**
   * Cache of provider adapters, keyed by provider name.
   */
  private providerCache: Map<string, ProviderAdapter> = new Map();
  
  /**
   * Whether the service has been initialized.
   */
  private initialized = false;

  /**
   * Create a new ProviderService.
   * 
   * @param app The Obsidian app instance
   * @param eventBus The event bus for publishing events
   * @param settingsService The settings service for accessing settings
   */
  constructor(
    private app: App,
    private eventBus: EventBus,
    private settingsService: SettingsService
  ) {}
  
  /**
   * Initialize the ProviderService.
   * This must be called before using any methods that access model information.
   * 
   * @returns A promise that resolves when initialization is complete
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    try {
      // Initialize the ProviderFactory
      await ProviderFactory.initialize(this.app);
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize ProviderService:', error);
      throw error;
    }
  }

  /**
   * Get a provider adapter for the specified provider.
   * 
   * @param provider The name of the provider
   * @param apiKey Optional API key (if not provided, will use the one from settings)
   * @param apiEndpoint Optional custom API endpoint URL
   * @returns A provider adapter instance
   * @throws Error if the provider is not supported or if the API key is missing
   */
  async getProvider(provider: string, apiKey?: string, apiEndpoint?: string): Promise<ProviderAdapter> {
    // Check if we already have a cached provider with the same key
    const cacheKey = `${provider}:${apiKey || 'default'}:${apiEndpoint || 'default'}`;
    
    if (this.providerCache.has(cacheKey)) {
      return this.providerCache.get(cacheKey)!;
    }
    
    // Get API key from settings if not provided
    if (!apiKey) {
      const settingsManager = this.settingsService.getSettingsManager();
      const settings = settingsManager.getSettings();
      const providerName = provider.toLowerCase();
      
      // In the current settings model, we don't have a providers array
      // Instead, we have a single provider setting with an API key
      if (settings.provider.toLowerCase() === providerName) {
        apiKey = settings.apiKey;
        apiEndpoint = settings.apiEndpoint;
      } else {
        throw new Error(`No API key found for provider: ${provider}`);
      }
      
    }
    
    // Create the provider adapter
    // Ensure apiKey is not undefined
    if (!apiKey) {
      throw new Error(`API key is required for provider: ${provider}`);
    }
    
    const providerAdapter = ProviderFactory.createProvider(provider, apiKey, apiEndpoint);
    
    // Cache the provider adapter
    this.providerCache.set(cacheKey, providerAdapter);
    
    return providerAdapter;
  }

  /**
   * Test the connection to a provider.
   * 
   * @param provider The name of the provider
   * @param apiKey Optional API key (if not provided, will use the one from settings)
   * @param apiEndpoint Optional custom API endpoint URL
   * @returns A promise that resolves to true if the connection is successful, false otherwise
   */
  async testConnection(provider: string, apiKey?: string, apiEndpoint?: string): Promise<boolean> {
    try {
      const providerAdapter = await this.getProvider(provider, apiKey, apiEndpoint);
      return await providerAdapter.testConnection();
    } catch (error) {
      console.error(`Error testing connection to ${provider}:`, error);
      return false;
    }
  }

  /**
   * Get a list of available models from a provider.
   * Uses the centralized model information from the YAML file.
   * 
   * @param provider The name of the provider
   * @returns An array of ModelInfo objects for the provider
   */
  getAvailableModels(provider: string): ModelInfo[] {
    if (!this.initialized) {
      console.warn('ProviderService not initialized. Call initialize() first.');
      return [];
    }
    
    return ProviderFactory.getModelsForProvider(provider);
  }
  
  /**
   * Get all available models across all providers.
   * 
   * @returns An array of ModelInfo objects for all providers
   */
  getAllModels(): ModelInfo[] {
    if (!this.initialized) {
      console.warn('ProviderService not initialized. Call initialize() first.');
      return [];
    }
    
    return ProviderFactory.getAllModels();
  }
  
  /**
   * Find a model by its ID across all providers.
   * 
   * @param modelId The model ID to find
   * @returns The ModelInfo object or undefined if not found
   */
  findModelById(modelId: string): ModelInfo | undefined {
    if (!this.initialized) {
      console.warn('ProviderService not initialized. Call initialize() first.');
      return undefined;
    }
    
    return ProviderFactory.findModelById(modelId);
  }

  /**
   * Send a request to a provider and get a complete response.
   * 
   * @param provider The name of the provider
   * @param request The request parameters
   * @param apiKey Optional API key (if not provided, will use the one from settings)
   * @param apiEndpoint Optional custom API endpoint URL
   * @returns A promise that resolves to a ProviderResponse
   */
  async sendRequest(
    provider: string,
    request: ProviderRequest,
    apiKey?: string,
    apiEndpoint?: string
  ): Promise<ProviderResponse> {
    const providerAdapter = await this.getProvider(provider, apiKey, apiEndpoint);
    return await providerAdapter.sendRequest(request);
  }

  /**
   * Send a streaming request to a provider.
   * 
   * @param provider The name of the provider
   * @param request The request parameters (should have stream: true)
   * @param onChunk Callback function that will be called for each chunk received
   * @param apiKey Optional API key (if not provided, will use the one from settings)
   * @param apiEndpoint Optional custom API endpoint URL
   * @returns A promise that resolves when the stream is complete
   */
  async sendStreamingRequest(
    provider: string,
    request: ProviderRequest,
    onChunk: (chunk: ProviderChunk) => void,
    apiKey?: string,
    apiEndpoint?: string
  ): Promise<void> {
    const providerAdapter = await this.getProvider(provider, apiKey, apiEndpoint);
    return await providerAdapter.sendStreamingRequest(request, onChunk);
  }

  /**
   * Cancel an ongoing streaming request.
   * 
   * @param provider The name of the provider
   * @param apiKey Optional API key (if not provided, will use the one from settings)
   * @param apiEndpoint Optional custom API endpoint URL
   * @returns A promise that resolves when the request is cancelled
   */
  async cancelRequest(
    provider: string,
    apiKey?: string,
    apiEndpoint?: string
  ): Promise<void> {
    try {
      const providerAdapter = await this.getProvider(provider, apiKey, apiEndpoint);
      return await providerAdapter.cancelRequest();
    } catch (error) {
      console.error(`Error cancelling request to ${provider}:`, error);
    }
  }

  /**
   * Get a list of supported provider names.
   * 
   * @returns An array of supported provider names
   */
  getSupportedProviders(): string[] {
    if (!this.initialized) {
      return ProviderFactory.getSupportedProviders();
    }
    
    // Return the union of providers from the factory and the YAML file
    const factoryProviders = new Set(ProviderFactory.getSupportedProviders());
    const yamlProviders = new Set(ProviderFactory.getModelsForProvider('').map(model => model.provider));
    
    return Array.from(new Set([...factoryProviders, ...yamlProviders]));
  }

  /**
   * Check if a provider is supported.
   * 
   * @param provider The name of the provider
   * @returns True if the provider is supported, false otherwise
   */
  isProviderSupported(provider: string): boolean {
    return ProviderFactory.isProviderSupported(provider);
  }

  /**
   * Clear the provider cache.
   * This forces new provider adapters to be created on the next request.
   */
  clearCache(): void {
    this.providerCache.clear();
  }
}
