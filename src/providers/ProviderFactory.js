/**
 * Provider Factory
 *
 * This file provides a factory for creating provider adapters.
 * It centralizes the creation of provider adapters and makes it easy to add new providers.
 * It integrates with the ModelRegistry to provide access to model information.
 */
import { OpenAIAdapter } from './OpenAIAdapter';
import { AnthropicAdapter } from './AnthropicAdapter';
import { GeminiAdapter } from './GeminiAdapter';
import { OpenRouterAdapter } from './OpenRouterAdapter';
import { RequestyAdapter } from './RequestyAdapter';
import { modelRegistry } from './ModelRegistry';
import { ProviderTypeUtils } from '../ui/models/ProviderType';

/**
 * Map of provider names to their factory functions.
 */
const providerFactories = {
    'openai': (apiKey, apiEndpoint) => new OpenAIAdapter(apiKey, apiEndpoint),
    'anthropic': (apiKey, apiEndpoint) => new AnthropicAdapter(apiKey, apiEndpoint),
    'google': (apiKey, apiEndpoint) => new GeminiAdapter(apiKey, apiEndpoint),
    'openrouter': (apiKey, apiEndpoint) => new OpenRouterAdapter(apiKey, apiEndpoint),
    'requesty': (apiKey, apiEndpoint) => new RequestyAdapter(apiKey, apiEndpoint)
};

/**
 * Factory for creating provider adapters and accessing model information.
 */
export class ProviderFactory {
    /**
     * Initialize the ProviderFactory.
     * This must be called before using any methods that access model information.
     *
     * @param app The Obsidian app instance (kept for backward compatibility)
     */
    static initialize(app) {
        if (this.initialized) {
            return;
        }
        
        // ModelRegistry doesn't need initialization like ModelsLoader did
        // since it's initialized when first accessed
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
    static createProvider(provider, apiKey, apiEndpoint) {
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
    static getSupportedProviders() {
        return Object.keys(providerFactories);
    }
    
    /**
     * Check if a provider is supported.
     *
     * @param provider The name of the provider
     * @returns True if the provider is supported, false otherwise
     */
    static isProviderSupported(provider) {
        // Check if the provider is in our factory map
        if (providerFactories[provider.toLowerCase()]) {
            return true;
        }
        
        // Check if the provider is in ModelRegistry
        if (this.initialized) {
            const availableProviders = modelRegistry.getAvailableProviders();
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
    static registerProvider(provider, factory) {
        providerFactories[provider.toLowerCase()] = factory;
    }
    
    /**
     * Get all available models for a specific provider.
     *
     * @param provider The name of the provider
     * @returns An array of ModelInfo objects for the provider
     */
    static getModelsForProvider(provider) {
        if (!this.initialized) {
            console.warn('ProviderFactory not initialized. Call initialize() first.');
            return [];
        }
        
        // Convert the provider string to a ProviderType, if possible
        if (ProviderTypeUtils.isValidProviderType(provider)) {
            return modelRegistry.getModelsForProvider(provider);
        }
        
        return [];
    }
    
    /**
     * Get all available models across all providers.
     *
     * @returns An array of ModelInfo objects for all providers
     */
    static getAllModels() {
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
    static findModelById(modelId) {
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
    static getProviderName(provider) {
        if (!this.initialized) {
            return provider;
        }
        
        return ProviderTypeUtils.getDisplayName(provider);
    }
}

ProviderFactory.initialized = false;