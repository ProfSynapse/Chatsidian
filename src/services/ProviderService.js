/**
 * Provider Service
 *
 * This service manages AI provider adapters and provides a high-level interface
 * for interacting with AI providers. It handles provider creation, caching,
 * and provides methods for sending requests to providers.
 *
 * It also integrates with the ModelRegistry to provide access to model information.
 */
import { ProviderFactory } from '../providers/ProviderFactory';
import { modelRegistry } from '../providers/ModelRegistry';
/**
 * Service for managing AI provider adapters and model information.
 */
export class ProviderService {
    /**
     * Create a new ProviderService.
     *
     * @param app The Obsidian app instance
     * @param eventBus The event bus for publishing events
     * @param settingsService The settings service for accessing settings
     */
    constructor(app, eventBus, settingsService) {
        this.app = app;
        this.eventBus = eventBus;
        this.settingsService = settingsService;
        /**
         * Cache of provider adapters, keyed by provider name.
         */
        this.providerCache = new Map();
        /**
         * Whether the service has been initialized.
         */
        this.initialized = false;
    }
    /**
     * Initialize the ProviderService.
     * This must be called before using any methods that access model information.
     *
     * @returns A promise that resolves when initialization is complete
     */
    initialize() {
        if (this.initialized) {
            return;
        }
        try {
            // Initialize the ProviderFactory (synchronous now)
            ProviderFactory.initialize(this.app);
            this.initialized = true;
        }
        catch (error) {
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
    async getProvider(provider, apiKey, apiEndpoint) {
        // Check if we already have a cached provider with the same key
        const cacheKey = `${provider}:${apiKey || 'default'}:${apiEndpoint || 'default'}`;
        if (this.providerCache.has(cacheKey)) {
            return this.providerCache.get(cacheKey);
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
            }
            else {
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
    async testConnection(provider, apiKey, apiEndpoint) {
        try {
            const providerAdapter = await this.getProvider(provider, apiKey, apiEndpoint);
            return await providerAdapter.testConnection();
        }
        catch (error) {
            console.error(`Error testing connection to ${provider}:`, error);
            return false;
        }
    }
    /**
     * Get a list of available models from a provider.
     * Uses the centralized model information from the ModelRegistry.
     *
     * @param provider The name of the provider
     * @returns An array of ModelInfo objects for the provider
     */
    getAvailableModels(provider) {
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
    getAllModels() {
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
    findModelById(modelId) {
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
    async sendRequest(provider, request, apiKey, apiEndpoint) {
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
    async sendStreamingRequest(provider, request, onChunk, apiKey, apiEndpoint) {
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
    async cancelRequest(provider, apiKey, apiEndpoint) {
        try {
            const providerAdapter = await this.getProvider(provider, apiKey, apiEndpoint);
            return await providerAdapter.cancelRequest();
        }
        catch (error) {
            console.error(`Error cancelling request to ${provider}:`, error);
        }
    }
    /**
     * Get a list of supported provider names.
     *
     * @returns An array of supported provider names
     */
    getSupportedProviders() {
        if (!this.initialized) {
            return ProviderFactory.getSupportedProviders();
        }
        // Return the union of providers from the factory and the ModelRegistry
        const factoryProviders = new Set(ProviderFactory.getSupportedProviders());
        const modelRegistryProviders = new Set(modelRegistry.getAllModels().map(model => model.provider));
        return Array.from(new Set([...factoryProviders, ...modelRegistryProviders]));
    }
    /**
     * Check if a provider is supported.
     *
     * @param provider The name of the provider
     * @returns True if the provider is supported, false otherwise
     */
    isProviderSupported(provider) {
        return ProviderFactory.isProviderSupported(provider);
    }
    /**
     * Clear the provider cache.
     * This forces new provider adapters to be created on the next request.
     */
    clearCache() {
        this.providerCache.clear();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUHJvdmlkZXJTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiUHJvdmlkZXJTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7OztHQVFHO0FBT0gsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBRS9EOztHQUVHO0FBQ0gsTUFBTSxPQUFPLGVBQWU7SUFXMUI7Ozs7OztPQU1HO0lBQ0gsWUFDVSxHQUFRLEVBQ1IsUUFBa0IsRUFDbEIsZUFBZ0M7UUFGaEMsUUFBRyxHQUFILEdBQUcsQ0FBSztRQUNSLGFBQVEsR0FBUixRQUFRLENBQVU7UUFDbEIsb0JBQWUsR0FBZixlQUFlLENBQWlCO1FBcEIxQzs7V0FFRztRQUNLLGtCQUFhLEdBQWlDLElBQUksR0FBRyxFQUFFLENBQUM7UUFFaEU7O1dBRUc7UUFDSyxnQkFBVyxHQUFHLEtBQUssQ0FBQztJQWF6QixDQUFDO0lBRUo7Ozs7O09BS0c7SUFDSSxLQUFLLENBQUMsVUFBVTtRQUNyQixJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUNyQixPQUFPO1FBQ1QsQ0FBQztRQUVELElBQUksQ0FBQztZQUNILGlDQUFpQztZQUNqQyxNQUFNLGVBQWUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQzNDLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO1FBQzFCLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyx1Q0FBdUMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUM5RCxNQUFNLEtBQUssQ0FBQztRQUNkLENBQUM7SUFDSCxDQUFDO0lBRUQ7Ozs7Ozs7O09BUUc7SUFDSCxLQUFLLENBQUMsV0FBVyxDQUFDLFFBQWdCLEVBQUUsTUFBZSxFQUFFLFdBQW9CO1FBQ3ZFLCtEQUErRDtRQUMvRCxNQUFNLFFBQVEsR0FBRyxHQUFHLFFBQVEsSUFBSSxNQUFNLElB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QUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUN0QixPQUFPLGVBQWUsQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1FBQ2pELENBQUM7UUFFRCxtRUFBbUU7UUFDbkUsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUMscUJBQXFCLEVBQUUsQ0FBQyxDQUFDO1FBQzFFLE1BQU0sYUFBYSxHQUFHLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUVyRyxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxHQUFHLGdCQUFnQixFQUFFLEdBQUcsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3RFLENBQUM7SUFFRDs7Ozs7T0FLRztJQUNILG1CQUFtQixDQUFDLFFBQWdCO1FBQ2xDLE9BQU8sZUFBZSxDQUFDLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3ZELENBQUM7SUFFRDs7O09BR0c7SUFDSCxVQUFVO1FBQ1IsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUM3QixDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogUHJvdmlkZXIgU2VydmljZVxyXG4gKiBcclxuICogVGhpcyBzZXJ2aWNlIG1hbmFnZXMgQUkgcHJvdmlkZXIgYWRhcHRlcnMgYW5kIHByb3ZpZGVzIGEgaGlnaC1sZXZlbCBpbnRlcmZhY2VcclxuICogZm9yIGludGVyYWN0aW5nIHdpdGggQUkgcHJvdmlkZXJzLiBJdCBoYW5kbGVzIHByb3ZpZGVyIGNyZWF0aW9uLCBjYWNoaW5nLFxyXG4gKiBhbmQgcHJvdmlkZXMgbWV0aG9kcyBmb3Igc2VuZGluZyByZXF1ZXN0cyB0byBwcm92aWRlcnMuXHJcbiAqIFxyXG4gKiBJdCBhbHNvIGludGVncmF0ZXMgd2l0aCB0aGUgTW9kZWxzTG9hZGVyIHRvIHByb3ZpZGUgYWNjZXNzIHRvIG1vZGVsIGluZm9ybWF0aW9uLlxyXG4gKi9cclxuXHJcbmltcG9ydCB7IEFwcCB9IGZyb20gJ29ic2lkaWFuJztcclxuaW1wb3J0IHsgRXZlbnRCdXMgfSBmcm9tICcuLi9jb3JlL0V2ZW50QnVzJztcclxuaW1wb3J0IHsgU2V0dGluZ3NTZXJ2aWNlIH0gZnJvbSAnLi9TZXR0aW5nc1NlcnZpY2UnO1xyXG5pbXBvcnQgeyBNb2RlbEluZm8sIFByb3ZpZGVyQ2h1bmssIFByb3ZpZGVyTWVzc2FnZSwgUHJvdmlkZXJSZXF1ZXN0LCBQcm92aWRlclJlc3BvbnNlIH0gZnJvbSAnLi4vbW9kZWxzL1Byb3ZpZGVyJztcclxuaW1wb3J0IHsgUHJvdmlkZXJBZGFwdGVyIH0gZnJvbSAnLi4vcHJvdmlkZXJzL1Byb3ZpZGVyQWRhcHRlcic7XHJcbmltcG9ydCB7IFByb3ZpZGVyRmFjdG9yeSB9IGZyb20gJy4uL3Byb3ZpZGVycy9Qcm92aWRlckZhY3RvcnknO1xyXG5cclxuLyoqXHJcbiAqIFNlcnZpY2UgZm9yIG1hbmFnaW5nIEFJIHByb3ZpZGVyIGFkYXB0ZXJzIGFuZCBtb2RlbCBpbmZvcm1hdGlvbi5cclxuICovXHJcbmV4cG9ydCBjbGFzcyBQcm92aWRlclNlcnZpY2Uge1xyXG4gIC8qKlxyXG4gICAqIENhY2hlIG9mIHByb3ZpZGVyIGFkYXB0ZXJzLCBrZXllZCBieSBwcm92aWRlciBuYW1lLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgcHJvdmlkZXJDYWNoZTogTWFwPHN0cmluZywgUHJvdmlkZXJBZGFwdGVyPiA9IG5ldyBNYXAoKTtcclxuICBcclxuICAvKipcclxuICAgKiBXaGV0aGVyIHRoZSBzZXJ2aWNlIGhhcyBiZWVuIGluaXRpYWxpemVkLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgaW5pdGlhbGl6ZWQgPSBmYWxzZTtcclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgbmV3IFByb3ZpZGVyU2VydmljZS5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gYXBwIFRoZSBPYnNpZGlhbiBhcHAgaW5zdGFuY2VcclxuICAgKiBAcGFyYW0gZXZlbnRCdXMgVGhlIGV2ZW50IGJ1cyBmb3IgcHVibGlzaGluZyBldmVudHNcclxuICAgKiBAcGFyYW0gc2V0dGluZ3NTZXJ2aWNlIFRoZSBzZXR0aW5ncyBzZXJ2aWNlIGZvciBhY2Nlc3Npbmcgc2V0dGluZ3NcclxuICAgKi9cclxuICBjb25zdHJ1Y3RvcihcclxuICAgIHByaXZhdGUgYXBwOiBBcHAsXHJcbiAgICBwcml2YXRlIGV2ZW50QnVzOiBFdmVudEJ1cyxcclxuICAgIHByaXZhdGUgc2V0dGluZ3NTZXJ2aWNlOiBTZXR0aW5nc1NlcnZpY2VcclxuICApIHt9XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbGl6ZSB0aGUgUHJvdmlkZXJTZXJ2aWNlLlxyXG4gICAqIFRoaXMgbXVzdCBiZSBjYWxsZWQgYmVmb3JlIHVzaW5nIGFueSBtZXRob2RzIHRoYXQgYWNjZXNzIG1vZGVsIGluZm9ybWF0aW9uLlxyXG4gICAqIFxyXG4gICAqIEByZXR1cm5zIEEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdoZW4gaW5pdGlhbGl6YXRpb24gaXMgY29tcGxldGVcclxuICAgKi9cclxuICBwdWJsaWMgYXN5bmMgaW5pdGlhbGl6ZSgpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGlmICh0aGlzLmluaXRpYWxpemVkKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdHJ5IHtcclxuICAgICAgLy8gSW5pdGlhbGl6ZSB0aGUgUHJvdmlkZXJGYWN0b3J5XHJcbiAgICAgIGF3YWl0IFByb3ZpZGVyRmFjdG9yeS5pbml0aWFsaXplKHRoaXMuYXBwKTtcclxuICAgICAgdGhpcy5pbml0aWFsaXplZCA9IHRydWU7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gaW5pdGlhbGl6ZSBQcm92aWRlclNlcnZpY2U6JywgZXJyb3IpO1xyXG4gICAgICB0aHJvdyBlcnJvcjtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIHByb3ZpZGVyIGFkYXB0ZXIgZm9yIHRoZSBzcGVjaWZpZWQgcHJvdmlkZXIuXHJcbiAgICogXHJcbiAgICogQHBhcmFtIHByb3ZpZGVyIFRoZSBuYW1lIG9mIHRoZSBwcm92aWRlclxyXG4gICAqIEBwYXJhbSBhcGlLZXkgT3B0aW9uYWwgQVBJIGtleSAoaWYgbm90IHByb3ZpZGVkLCB3aWxsIHVzZSB0aGUgb25lIGZyb20gc2V0dGluZ3MpXHJcbiAgICogQHBhcmFtIGFwaUVuZHBvaW50IE9wdGlvbmFsIGN1c3RvbSBBUEkgZW5kcG9pbnQgVVJMXHJcbiAgICogQHJldHVybnMgQSBwcm92aWRlciBhZGFwdGVyIGluc3RhbmNlXHJcbiAgICogQHRocm93cyBFcnJvciBpZiB0aGUgcHJvdmlkZXIgaXMgbm90IHN1cHBvcnRlZCBvciBpZiB0aGUgQVBJIGtleSBpcyBtaXNzaW5nXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0UHJvdmlkZXIocHJvdmlkZXI6IHN0cmluZywgYXBpS2V5Pzogc3RyaW5nLCBhcGlFbmRwb2ludD86IHN0cmluZyk6IFByb21pc2U8UHJvdmlkZXJBZGFwdGVyPiB7XHJcbiAgICAvLyBDaGVjayBpZiB3ZSBhbHJlYWR5IGhhdmUgYSBjYWNoZWQgcHJvdmlkZXIgd2l0aCB0aGUgc2FtZSBrZXlcclxuICAgIGNvbnN0IGNhY2hlS2V5ID0gYCR7cHJvdmlkZXJ9OiR7YXBpS2V5IHx8ICdkZWZhdWx0J306JHthcGlFbmRwb2ludCB8fCAnZGVmYXVsdCd9YDtcclxuICAgIFxyXG4gICAgaWYgKHRoaXMucHJvdmlkZXJDYWNoZS5oYXMoY2FjaGVLZXkpKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLnByb3ZpZGVyQ2FjaGUuZ2V0KGNhY2hlS2V5KSE7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIEdldCBBUEkga2V5IGZyb20gc2V0dGluZ3MgaWYgbm90IHByb3ZpZGVkXHJcbiAgICBpZiAoIWFwaUtleSkge1xyXG4gICAgICBjb25zdCBzZXR0aW5nc01hbmFnZXIgPSB0aGlzLnNldHRpbmdzU2VydmljZS5nZXRTZXR0aW5nc01hbmFnZXIoKTtcclxuICAgICAgY29uc3Qgc2V0dGluZ3MgPSBzZXR0aW5nc01hbmFnZXIuZ2V0U2V0dGluZ3MoKTtcclxuICAgICAgY29uc3QgcHJvdmlkZXJOYW1lID0gcHJvdmlkZXIudG9Mb3dlckNhc2UoKTtcclxuICAgICAgXHJcbiAgICAgIC8vIEluIHRoZSBjdXJyZW50IHNldHRpbmdzIG1vZGVsLCB3ZSBkb24ndCBoYXZlIGEgcHJvdmlkZXJzIGFycmF5XHJcbiAgICAgIC8vIEluc3RlYWQsIHdlIGhhdmUgYSBzaW5nbGUgcHJvdmlkZXIgc2V0dGluZyB3aXRoIGFuIEFQSSBrZXlcclxuICAgICAgaWYgKHNldHRpbmdzLnByb3ZpZGVyLnRvTG93ZXJDYXNlKCkgPT09IHByb3ZpZGVyTmFtZSkge1xyXG4gICAgICAgIGFwaUtleSA9IHNldHRpbmdzLmFwaUtleTtcclxuICAgICAgICBhcGlFbmRwb2ludCA9IHNldHRpbmdzLmFwaUVuZHBvaW50O1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgTm8gQVBJIGtleSBmb3VuZCBmb3IgcHJvdmlkZXI6ICR7cHJvdmlkZXJ9YCk7XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIENyZWF0ZSB0aGUgcHJvdmlkZXIgYWRhcHRlclxyXG4gICAgLy8gRW5zdXJlIGFwaUtleSBpcyBub3QgdW5kZWZpbmVkXHJcbiAgICBpZiAoIWFwaUtleSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFQSSBrZXkgaXMgcmVxdWlyZWQgZm9yIHByb3ZpZGVyOiAke3Byb3ZpZGVyfWApO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBjb25zdCBwcm92aWRlckFkYXB0ZXIgPSBQcm92aWRlckZhY3RvcnkuY3JlYXRlUHJvdmlkZXIocHJvdmlkZXIsIGFwaUtleSwgYXBpRW5kcG9pbnQpO1xyXG4gICAgXHJcbiAgICAvLyBDYWNoZSB0aGUgcHJvdmlkZXIgYWRhcHRlclxyXG4gICAgdGhpcy5wcm92aWRlckNhY2hlLnNldChjYWNoZUtleSwgcHJvdmlkZXJBZGFwdGVyKTtcclxuICAgIFxyXG4gICAgcmV0dXJuIHByb3ZpZGVyQWRhcHRlcjtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFRlc3QgdGhlIGNvbm5lY3Rpb24gdG8gYSBwcm92aWRlci5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gcHJvdmlkZXIgVGhlIG5hbWUgb2YgdGhlIHByb3ZpZGVyXHJcbiAgICogQHBhcmFtIGFwaUtleSBPcHRpb25hbCBBUEkga2V5IChpZiBub3QgcHJvdmlkZWQsIHdpbGwgdXNlIHRoZSBvbmUgZnJvbSBzZXR0aW5ncylcclxuICAgKiBAcGFyYW0gYXBpRW5kcG9pbnQgT3B0aW9uYWwgY3VzdG9tIEFQSSBlbmRwb2ludCBVUkxcclxuICAgKiBAcmV0dXJucyBBIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byB0cnVlIGlmIHRoZSBjb25uZWN0aW9uIGlzIHN1Y2Nlc3NmdWwsIGZhbHNlIG90aGVyd2lzZVxyXG4gICAqL1xyXG4gIGFzeW5jIHRlc3RDb25uZWN0aW9uKHByb3ZpZGVyOiBzdHJpbmcsIGFwaUtleT86IHN0cmluZywgYXBpRW5kcG9pbnQ/OiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IHByb3ZpZGVyQWRhcHRlciA9IGF3YWl0IHRoaXMuZ2V0UHJvdmlkZXIocHJvdmlkZXIsIGFwaUtleSwgYXBpRW5kcG9pbnQpO1xyXG4gICAgICByZXR1cm4gYXdhaXQgcHJvdmlkZXJBZGFwdGVyLnRlc3RDb25uZWN0aW9uKCk7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKGBFcnJvciB0ZXN0aW5nIGNvbm5lY3Rpb24gdG8gJHtwcm92aWRlcn06YCwgZXJyb3IpO1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSBsaXN0IG9mIGF2YWlsYWJsZSBtb2RlbHMgZnJvbSBhIHByb3ZpZGVyLlxyXG4gICAqIFVzZXMgdGhlIGNlbnRyYWxpemVkIG1vZGVsIGluZm9ybWF0aW9uIGZyb20gdGhlIFlBTUwgZmlsZS5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gcHJvdmlkZXIgVGhlIG5hbWUgb2YgdGhlIHByb3ZpZGVyXHJcbiAgICogQHJldHVybnMgQW4gYXJyYXkgb2YgTW9kZWxJbmZvIG9iamVjdHMgZm9yIHRoZSBwcm92aWRlclxyXG4gICAqL1xyXG4gIGdldEF2YWlsYWJsZU1vZGVscyhwcm92aWRlcjogc3RyaW5nKTogTW9kZWxJbmZvW10ge1xyXG4gICAgaWYgKCF0aGlzLmluaXRpYWxpemVkKSB7XHJcbiAgICAgIGNvbnNvbGUud2FybignUHJvdmlkZXJTZXJ2aWNlIG5vdCBpbml0aWFsaXplZC4gQ2FsbCBpbml0aWFsaXplKCkgZmlyc3QuJyk7XHJcbiAgICAgIHJldHVybiBbXTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIFByb3ZpZGVyRmFjdG9yeS5nZXRNb2RlbHNGb3JQcm92aWRlcihwcm92aWRlcik7XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIEdldCBhbGwgYXZhaWxhYmxlIG1vZGVscyBhY3Jvc3MgYWxsIHByb3ZpZGVycy5cclxuICAgKiBcclxuICAgKiBAcmV0dXJucyBBbiBhcnJheSBvZiBNb2RlbEluZm8gb2JqZWN0cyBmb3IgYWxsIHByb3ZpZGVyc1xyXG4gICAqL1xyXG4gIGdldEFsbE1vZGVscygpOiBNb2RlbEluZm9bXSB7XHJcbiAgICBpZiAoIXRoaXMuaW5pdGlhbGl6ZWQpIHtcclxuICAgICAgY29uc29sZS53YXJuKCdQcm92aWRlclNlcnZpY2Ugbm90IGluaXRpYWxpemVkLiBDYWxsIGluaXRpYWxpemUoKSBmaXJzdC4nKTtcclxuICAgICAgcmV0dXJuIFtdO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gUHJvdmlkZXJGYWN0b3J5LmdldEFsbE1vZGVscygpO1xyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBGaW5kIGEgbW9kZWwgYnkgaXRzIElEIGFjcm9zcyBhbGwgcHJvdmlkZXJzLlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBtb2RlbElkIFRoZSBtb2RlbCBJRCB0byBmaW5kXHJcbiAgICogQHJldHVybnMgVGhlIE1vZGVsSW5mbyBvYmplY3Qgb3IgdW5kZWZpbmVkIGlmIG5vdCBmb3VuZFxyXG4gICAqL1xyXG4gIGZpbmRNb2RlbEJ5SWQobW9kZWxJZDogc3RyaW5nKTogTW9kZWxJbmZvIHwgdW5kZWZpbmVkIHtcclxuICAgIGlmICghdGhpcy5pbml0aWFsaXplZCkge1xyXG4gICAgICBjb25zb2xlLndhcm4oJ1Byb3ZpZGVyU2VydmljZSBub3QgaW5pdGlhbGl6ZWQuIENhbGwgaW5pdGlhbGl6ZSgpIGZpcnN0LicpO1xyXG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gUHJvdmlkZXJGYWN0b3J5LmZpbmRNb2RlbEJ5SWQobW9kZWxJZCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZW5kIGEgcmVxdWVzdCB0byBhIHByb3ZpZGVyIGFuZCBnZXQgYSBjb21wbGV0ZSByZXNwb25zZS5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gcHJvdmlkZXIgVGhlIG5hbWUgb2YgdGhlIHByb3ZpZGVyXHJcbiAgICogQHBhcmFtIHJlcXVlc3QgVGhlIHJlcXVlc3QgcGFyYW1ldGVyc1xyXG4gICAqIEBwYXJhbSBhcGlLZXkgT3B0aW9uYWwgQVBJIGtleSAoaWYgbm90IHByb3ZpZGVkLCB3aWxsIHVzZSB0aGUgb25lIGZyb20gc2V0dGluZ3MpXHJcbiAgICogQHBhcmFtIGFwaUVuZHBvaW50IE9wdGlvbmFsIGN1c3RvbSBBUEkgZW5kcG9pbnQgVVJMXHJcbiAgICogQHJldHVybnMgQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gYSBQcm92aWRlclJlc3BvbnNlXHJcbiAgICovXHJcbiAgYXN5bmMgc2VuZFJlcXVlc3QoXHJcbiAgICBwcm92aWRlcjogc3RyaW5nLFxyXG4gICAgcmVxdWVzdDogUHJvdmlkZXJSZXF1ZXN0LFxyXG4gICAgYXBpS2V5Pzogc3RyaW5nLFxyXG4gICAgYXBpRW5kcG9pbnQ/OiBzdHJpbmdcclxuICApOiBQcm9taXNlPFByb3ZpZGVyUmVzcG9uc2U+IHtcclxuICAgIGNvbnN0IHByb3ZpZGVyQWRhcHRlciA9IGF3YWl0IHRoaXMuZ2V0UHJvdmlkZXIocHJvdmlkZXIsIGFwaUtleSwgYXBpRW5kcG9pbnQpO1xyXG4gICAgcmV0dXJuIGF3YWl0IHByb3ZpZGVyQWRhcHRlci5zZW5kUmVxdWVzdChyZXF1ZXN0KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNlbmQgYSBzdHJlYW1pbmcgcmVxdWVzdCB0byBhIHByb3ZpZGVyLlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBwcm92aWRlciBUaGUgbmFtZSBvZiB0aGUgcHJvdmlkZXJcclxuICAgKiBAcGFyYW0gcmVxdWVzdCBUaGUgcmVxdWVzdCBwYXJhbWV0ZXJzIChzaG91bGQgaGF2ZSBzdHJlYW06IHRydWUpXHJcbiAgICogQHBhcmFtIG9uQ2h1bmsgQ2FsbGJhY2sgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGNhbGxlZCBmb3IgZWFjaCBjaHVuayByZWNlaXZlZFxyXG4gICAqIEBwYXJhbSBhcGlLZXkgT3B0aW9uYWwgQVBJIGtleSAoaWYgbm90IHByb3ZpZGVkLCB3aWxsIHVzZSB0aGUgb25lIGZyb20gc2V0dGluZ3MpXHJcbiAgICogQHBhcmFtIGFwaUVuZHBvaW50IE9wdGlvbmFsIGN1c3RvbSBBUEkgZW5kcG9pbnQgVVJMXHJcbiAgICogQHJldHVybnMgQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiB0aGUgc3RyZWFtIGlzIGNvbXBsZXRlXHJcbiAgICovXHJcbiAgYXN5bmMgc2VuZFN0cmVhbWluZ1JlcXVlc3QoXHJcbiAgICBwcm92aWRlcjogc3RyaW5nLFxyXG4gICAgcmVxdWVzdDogUHJvdmlkZXJSZXF1ZXN0LFxyXG4gICAgb25DaHVuazogKGNodW5rOiBQcm92aWRlckNodW5rKSA9PiB2b2lkLFxyXG4gICAgYXBpS2V5Pzogc3RyaW5nLFxyXG4gICAgYXBpRW5kcG9pbnQ/OiBzdHJpbmdcclxuICApOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IHByb3ZpZGVyQWRhcHRlciA9IGF3YWl0IHRoaXMuZ2V0UHJvdmlkZXIocHJvdmlkZXIsIGFwaUtleSwgYXBpRW5kcG9pbnQpO1xyXG4gICAgcmV0dXJuIGF3YWl0IHByb3ZpZGVyQWRhcHRlci5zZW5kU3RyZWFtaW5nUmVxdWVzdChyZXF1ZXN0LCBvbkNodW5rKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENhbmNlbCBhbiBvbmdvaW5nIHN0cmVhbWluZyByZXF1ZXN0LlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBwcm92aWRlciBUaGUgbmFtZSBvZiB0aGUgcHJvdmlkZXJcclxuICAgKiBAcGFyYW0gYXBpS2V5IE9wdGlvbmFsIEFQSSBrZXkgKGlmIG5vdCBwcm92aWRlZCwgd2lsbCB1c2UgdGhlIG9uZSBmcm9tIHNldHRpbmdzKVxyXG4gICAqIEBwYXJhbSBhcGlFbmRwb2ludCBPcHRpb25hbCBjdXN0b20gQVBJIGVuZHBvaW50IFVSTFxyXG4gICAqIEByZXR1cm5zIEEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdoZW4gdGhlIHJlcXVlc3QgaXMgY2FuY2VsbGVkXHJcbiAgICovXHJcbiAgYXN5bmMgY2FuY2VsUmVxdWVzdChcclxuICAgIHByb3ZpZGVyOiBzdHJpbmcsXHJcbiAgICBhcGlLZXk/OiBzdHJpbmcsXHJcbiAgICBhcGlFbmRwb2ludD86IHN0cmluZ1xyXG4gICk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgcHJvdmlkZXJBZGFwdGVyID0gYXdhaXQgdGhpcy5nZXRQcm92aWRlcihwcm92aWRlciwgYXBpS2V5LCBhcGlFbmRwb2ludCk7XHJcbiAgICAgIHJldHVybiBhd2FpdCBwcm92aWRlckFkYXB0ZXIuY2FuY2VsUmVxdWVzdCgpO1xyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgY29uc29sZS5lcnJvcihgRXJyb3IgY2FuY2VsbGluZyByZXF1ZXN0IHRvICR7cHJvdmlkZXJ9OmAsIGVycm9yKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIGxpc3Qgb2Ygc3VwcG9ydGVkIHByb3ZpZGVyIG5hbWVzLlxyXG4gICAqIFxyXG4gICAqIEByZXR1cm5zIEFuIGFycmF5IG9mIHN1cHBvcnRlZCBwcm92aWRlciBuYW1lc1xyXG4gICAqL1xyXG4gIGdldFN1cHBvcnRlZFByb3ZpZGVycygpOiBzdHJpbmdbXSB7XHJcbiAgICBpZiAoIXRoaXMuaW5pdGlhbGl6ZWQpIHtcclxuICAgICAgcmV0dXJuIFByb3ZpZGVyRmFjdG9yeS5nZXRTdXBwb3J0ZWRQcm92aWRlcnMoKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8gUmV0dXJuIHRoZSB1bmlvbiBvZiBwcm92aWRlcnMgZnJvbSB0aGUgZmFjdG9yeSBhbmQgdGhlIFlBTUwgZmlsZVxyXG4gICAgY29uc3QgZmFjdG9yeVByb3ZpZGVycyA9IG5ldyBTZXQoUHJvdmlkZXJGYWN0b3J5LmdldFN1cHBvcnRlZFByb3ZpZGVycygpKTtcclxuICAgIGNvbnN0IHlhbWxQcm92aWRlcnMgPSBuZXcgU2V0KFByb3ZpZGVyRmFjdG9yeS5nZXRNb2RlbHNGb3JQcm92aWRlcignJykubWFwKG1vZGVsID0+IG1vZGVsLnByb3ZpZGVyKSk7XHJcbiAgICBcclxuICAgIHJldHVybiBBcnJheS5mcm9tKG5ldyBTZXQoWy4uLmZhY3RvcnlQcm92aWRlcnMsIC4uLnlhbWxQcm92aWRlcnNdKSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVjayBpZiBhIHByb3ZpZGVyIGlzIHN1cHBvcnRlZC5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gcHJvdmlkZXIgVGhlIG5hbWUgb2YgdGhlIHByb3ZpZGVyXHJcbiAgICogQHJldHVybnMgVHJ1ZSBpZiB0aGUgcHJvdmlkZXIgaXMgc3VwcG9ydGVkLCBmYWxzZSBvdGhlcndpc2VcclxuICAgKi9cclxuICBpc1Byb3ZpZGVyU3VwcG9ydGVkKHByb3ZpZGVyOiBzdHJpbmcpOiBib29sZWFuIHtcclxuICAgIHJldHVybiBQcm92aWRlckZhY3RvcnkuaXNQcm92aWRlclN1cHBvcnRlZChwcm92aWRlcik7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDbGVhciB0aGUgcHJvdmlkZXIgY2FjaGUuXHJcbiAgICogVGhpcyBmb3JjZXMgbmV3IHByb3ZpZGVyIGFkYXB0ZXJzIHRvIGJlIGNyZWF0ZWQgb24gdGhlIG5leHQgcmVxdWVzdC5cclxuICAgKi9cclxuICBjbGVhckNhY2hlKCk6IHZvaWQge1xyXG4gICAgdGhpcy5wcm92aWRlckNhY2hlLmNsZWFyKCk7XHJcbiAgfVxyXG59XHJcbiJdfQ==