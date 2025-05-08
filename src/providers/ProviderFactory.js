/**
 * Provider Factory
 *
 * This file provides a factory for creating provider adapters.
 * It centralizes the creation of provider adapters and makes it easy to add new providers.
 * It also integrates with the ModelsLoader to provide access to model information.
 */
import { OpenAIAdapter } from './OpenAIAdapter';
import { AnthropicAdapter } from './AnthropicAdapter';
import { GeminiAdapter } from './GeminiAdapter';
import { OpenRouterAdapter } from './OpenRouterAdapter';
import { RequestyAdapter } from './RequestyAdapter';
import { ModelsLoader } from './ModelsLoader';
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
     * Initialize the ProviderFactory with the Obsidian app instance.
     * This must be called before using any methods that access model information.
     *
     * @param app The Obsidian app instance
     */
    static async initialize(app) {
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
        }
        catch (error) {
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
    static getAllModels() {
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
    static findModelById(modelId) {
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
    static getProviderName(provider) {
        if (!this.modelsLoader || !this.initialized) {
            return provider;
        }
        return this.modelsLoader.getProviderName(provider);
    }
}
ProviderFactory.modelsLoader = null;
ProviderFactory.initialized = false;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUHJvdmlkZXJGYWN0b3J5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiUHJvdmlkZXJGYWN0b3J5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUtILE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUNoRCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUN0RCxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDaEQsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDeEQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQ3BELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUU5Qzs7R0FFRztBQUNILE1BQU0saUJBQWlCLEdBQTJDO0lBQ2hFLFFBQVEsRUFBRSxDQUFDLE1BQWMsRUFBRSxXQUFvQixFQUFFLEVBQUUsQ0FBQyxJQUFJLGFBQWEsQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDO0lBQzFGLFdBQVcsRUFBRSxDQUFDLE1BQWMsRUFBRSxXQUFvQixFQUFFLEVBQUUsQ0FBQyxJQUFJLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxXQUFXLENBQUM7SUFDaEcsUUFBUSxFQUFFLENBQUMsTUFBYyxFQUFFLFdBQW9CLEVBQUUsRUFBRSxDQUFDLElBQUksYUFBYSxDQUFDLE1BQU0sRUFBRSxXQUFXLENBQUM7SUFDMUYsWUFBWSxFQUFFLENBQUMsTUFBYyxFQUFFLFdBQW9CLEVBQUUsRUFBRSxDQUFDLElBQUksaUJBQWlCLENBQUMsTUFBTSxFQUFFLFdBQVcsQ0FBQztJQUNsRyxVQUFVLEVBQUUsQ0FBQyxNQUFjLEVBQUUsV0FBb0IsRUFBRSxFQUFFLENBQUMsSUFBSSxlQUFlLENBQUMsTUFBTSxFQUFFLFdBQVcsQ0FBQztDQUMvRixDQUFDO0FBRUY7O0dBRUc7QUFDSCxNQUFNLE9BQU8s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QUMsWUFBWSxDQUFDLFlBQVksRUFBRSxDQUFDO0lBQzFDLENBQUM7SUFFRDs7Ozs7T0FLRztJQUNILE1BQU0sQ0FBQyxhQUFhLENBQUMsT0FBZTtRQUNsQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUM1QyxPQUFPLENBQUMsSUFBSSxDQUFDLDJEQUEyRCxDQUFDLENBQUM7WUFDMUUsT0FBTyxTQUFTLENBQUM7UUFDbkIsQ0FBQztRQUVELE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDbEQsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0gsTUFBTSxDQUFDLGVBQWUsQ0FBQyxRQUFnQjtRQUNyQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUM1QyxPQUFPLFFBQVEsQ0FBQztRQUNsQixDQUFDO1FBRUQsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUNyRCxDQUFDOztBQS9JYyw0QkFBWSxHQUF3QixJQUFJLENBQUM7QUFDekMsMkJBQVcsR0FBRyxLQUFLLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogUHJvdmlkZXIgRmFjdG9yeVxyXG4gKiBcclxuICogVGhpcyBmaWxlIHByb3ZpZGVzIGEgZmFjdG9yeSBmb3IgY3JlYXRpbmcgcHJvdmlkZXIgYWRhcHRlcnMuXHJcbiAqIEl0IGNlbnRyYWxpemVzIHRoZSBjcmVhdGlvbiBvZiBwcm92aWRlciBhZGFwdGVycyBhbmQgbWFrZXMgaXQgZWFzeSB0byBhZGQgbmV3IHByb3ZpZGVycy5cclxuICogSXQgYWxzbyBpbnRlZ3JhdGVzIHdpdGggdGhlIE1vZGVsc0xvYWRlciB0byBwcm92aWRlIGFjY2VzcyB0byBtb2RlbCBpbmZvcm1hdGlvbi5cclxuICovXHJcblxyXG5pbXBvcnQgeyBBcHAgfSBmcm9tICdvYnNpZGlhbic7XHJcbmltcG9ydCB7IE1vZGVsSW5mbyB9IGZyb20gJy4uL21vZGVscy9Qcm92aWRlcic7XHJcbmltcG9ydCB7IFByb3ZpZGVyQWRhcHRlciwgUHJvdmlkZXJBZGFwdGVyRmFjdG9yeSB9IGZyb20gJy4vUHJvdmlkZXJBZGFwdGVyJztcclxuaW1wb3J0IHsgT3BlbkFJQWRhcHRlciB9IGZyb20gJy4vT3BlbkFJQWRhcHRlcic7XHJcbmltcG9ydCB7IEFudGhyb3BpY0FkYXB0ZXIgfSBmcm9tICcuL0FudGhyb3BpY0FkYXB0ZXInO1xyXG5pbXBvcnQgeyBHZW1pbmlBZGFwdGVyIH0gZnJvbSAnLi9HZW1pbmlBZGFwdGVyJztcclxuaW1wb3J0IHsgT3BlblJvdXRlckFkYXB0ZXIgfSBmcm9tICcuL09wZW5Sb3V0ZXJBZGFwdGVyJztcclxuaW1wb3J0IHsgUmVxdWVzdHlBZGFwdGVyIH0gZnJvbSAnLi9SZXF1ZXN0eUFkYXB0ZXInO1xyXG5pbXBvcnQgeyBNb2RlbHNMb2FkZXIgfSBmcm9tICcuL01vZGVsc0xvYWRlcic7XHJcblxyXG4vKipcclxuICogTWFwIG9mIHByb3ZpZGVyIG5hbWVzIHRvIHRoZWlyIGZhY3RvcnkgZnVuY3Rpb25zLlxyXG4gKi9cclxuY29uc3QgcHJvdmlkZXJGYWN0b3JpZXM6IFJlY29yZDxzdHJpbmcsIFByb3ZpZGVyQWRhcHRlckZhY3Rvcnk+ID0ge1xyXG4gICdvcGVuYWknOiAoYXBpS2V5OiBzdHJpbmcsIGFwaUVuZHBvaW50Pzogc3RyaW5nKSA9PiBuZXcgT3BlbkFJQWRhcHRlcihhcGlLZXksIGFwaUVuZHBvaW50KSxcclxuICAnYW50aHJvcGljJzogKGFwaUtleTogc3RyaW5nLCBhcGlFbmRwb2ludD86IHN0cmluZykgPT4gbmV3IEFudGhyb3BpY0FkYXB0ZXIoYXBpS2V5LCBhcGlFbmRwb2ludCksXHJcbiAgJ2dvb2dsZSc6IChhcGlLZXk6IHN0cmluZywgYXBpRW5kcG9pbnQ/OiBzdHJpbmcpID0+IG5ldyBHZW1pbmlBZGFwdGVyKGFwaUtleSwgYXBpRW5kcG9pbnQpLFxyXG4gICdvcGVucm91dGVyJzogKGFwaUtleTogc3RyaW5nLCBhcGlFbmRwb2ludD86IHN0cmluZykgPT4gbmV3IE9wZW5Sb3V0ZXJBZGFwdGVyKGFwaUtleSwgYXBpRW5kcG9pbnQpLFxyXG4gICdyZXF1ZXN0eSc6IChhcGlLZXk6IHN0cmluZywgYXBpRW5kcG9pbnQ/OiBzdHJpbmcpID0+IG5ldyBSZXF1ZXN0eUFkYXB0ZXIoYXBpS2V5LCBhcGlFbmRwb2ludClcclxufTtcclxuXHJcbi8qKlxyXG4gKiBGYWN0b3J5IGZvciBjcmVhdGluZyBwcm92aWRlciBhZGFwdGVycyBhbmQgYWNjZXNzaW5nIG1vZGVsIGluZm9ybWF0aW9uLlxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFByb3ZpZGVyRmFjdG9yeSB7XHJcbiAgcHJpdmF0ZSBzdGF0aWMgbW9kZWxzTG9hZGVyOiBNb2RlbHNMb2FkZXIgfCBudWxsID0gbnVsbDtcclxuICBwcml2YXRlIHN0YXRpYyBpbml0aWFsaXplZCA9IGZhbHNlO1xyXG5cclxuICAvKipcclxuICAgKiBJbml0aWFsaXplIHRoZSBQcm92aWRlckZhY3Rvcnkgd2l0aCB0aGUgT2JzaWRpYW4gYXBwIGluc3RhbmNlLlxyXG4gICAqIFRoaXMgbXVzdCBiZSBjYWxsZWQgYmVmb3JlIHVzaW5nIGFueSBtZXRob2RzIHRoYXQgYWNjZXNzIG1vZGVsIGluZm9ybWF0aW9uLlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBhcHAgVGhlIE9ic2lkaWFuIGFwcCBpbnN0YW5jZVxyXG4gICAqL1xyXG4gIHB1YmxpYyBzdGF0aWMgYXN5bmMgaW5pdGlhbGl6ZShhcHA6IEFwcCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgaWYgKHRoaXMuaW5pdGlhbGl6ZWQpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEluaXRpYWxpemUgdGhlIE1vZGVsc0xvYWRlclxyXG4gICAgdGhpcy5tb2RlbHNMb2FkZXIgPSBNb2RlbHNMb2FkZXIuZ2V0SW5zdGFuY2UoKTtcclxuICAgIHRoaXMubW9kZWxzTG9hZGVyLmluaXRpYWxpemUoYXBwKTtcclxuICAgIFxyXG4gICAgdHJ5IHtcclxuICAgICAgLy8gTG9hZCB0aGUgbW9kZWxzIGZyb20gdGhlIFlBTUwgZmlsZVxyXG4gICAgICBhd2FpdCB0aGlzLm1vZGVsc0xvYWRlci5sb2FkTW9kZWxzKCk7XHJcbiAgICAgIHRoaXMuaW5pdGlhbGl6ZWQgPSB0cnVlO1xyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIGluaXRpYWxpemUgUHJvdmlkZXJGYWN0b3J5OicsIGVycm9yKTtcclxuICAgICAgdGhyb3cgZXJyb3I7XHJcbiAgICB9XHJcbiAgfVxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIHByb3ZpZGVyIGFkYXB0ZXIgZm9yIHRoZSBzcGVjaWZpZWQgcHJvdmlkZXIuXHJcbiAgICogXHJcbiAgICogQHBhcmFtIHByb3ZpZGVyIFRoZSBuYW1lIG9mIHRoZSBwcm92aWRlclxyXG4gICAqIEBwYXJhbSBhcGlLZXkgVGhlIEFQSSBrZXkgZm9yIHRoZSBwcm92aWRlclxyXG4gICAqIEBwYXJhbSBhcGlFbmRwb2ludCBPcHRpb25hbCBjdXN0b20gQVBJIGVuZHBvaW50IFVSTFxyXG4gICAqIEByZXR1cm5zIEEgcHJvdmlkZXIgYWRhcHRlciBpbnN0YW5jZVxyXG4gICAqIEB0aHJvd3MgRXJyb3IgaWYgdGhlIHByb3ZpZGVyIGlzIG5vdCBzdXBwb3J0ZWRcclxuICAgKi9cclxuICBzdGF0aWMgY3JlYXRlUHJvdmlkZXIocHJvdmlkZXI6IHN0cmluZywgYXBpS2V5OiBzdHJpbmcsIGFwaUVuZHBvaW50Pzogc3RyaW5nKTogUHJvdmlkZXJBZGFwdGVyIHtcclxuICAgIGNvbnN0IGZhY3RvcnkgPSBwcm92aWRlckZhY3Rvcmllc1twcm92aWRlci50b0xvd2VyQ2FzZSgpXTtcclxuICAgIFxyXG4gICAgaWYgKCFmYWN0b3J5KSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgcHJvdmlkZXI6ICR7cHJvdmlkZXJ9YCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiBmYWN0b3J5KGFwaUtleSwgYXBpRW5kcG9pbnQpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgbGlzdCBvZiBzdXBwb3J0ZWQgcHJvdmlkZXIgbmFtZXMuXHJcbiAgICogXHJcbiAgICogQHJldHVybnMgQW4gYXJyYXkgb2Ygc3VwcG9ydGVkIHByb3ZpZGVyIG5hbWVzXHJcbiAgICovXHJcbiAgc3RhdGljIGdldFN1cHBvcnRlZFByb3ZpZGVycygpOiBzdHJpbmdbXSB7XHJcbiAgICByZXR1cm4gT2JqZWN0LmtleXMocHJvdmlkZXJGYWN0b3JpZXMpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgaWYgYSBwcm92aWRlciBpcyBzdXBwb3J0ZWQuXHJcbiAgICogXHJcbiAgICogQHBhcmFtIHByb3ZpZGVyIFRoZSBuYW1lIG9mIHRoZSBwcm92aWRlclxyXG4gICAqIEByZXR1cm5zIFRydWUgaWYgdGhlIHByb3ZpZGVyIGlzIHN1cHBvcnRlZCwgZmFsc2Ugb3RoZXJ3aXNlXHJcbiAgICovXHJcbiAgc3RhdGljIGlzUHJvdmlkZXJTdXBwb3J0ZWQocHJvdmlkZXI6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gICAgLy8gQ2hlY2sgaWYgdGhlIHByb3ZpZGVyIGlzIGluIG91ciBmYWN0b3J5IG1hcFxyXG4gICAgaWYgKHByb3ZpZGVyRmFjdG9yaWVzW3Byb3ZpZGVyLnRvTG93ZXJDYXNlKCldKSB7XHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBJZiB3ZSBoYXZlIGEgTW9kZWxzTG9hZGVyLCBhbHNvIGNoZWNrIGlmIHRoZSBwcm92aWRlciBpcyBpbiB0aGUgWUFNTCBmaWxlXHJcbiAgICBpZiAodGhpcy5tb2RlbHNMb2FkZXIgJiYgdGhpcy5pbml0aWFsaXplZCkge1xyXG4gICAgICBjb25zdCBhdmFpbGFibGVQcm92aWRlcnMgPSB0aGlzLm1vZGVsc0xvYWRlci5nZXRBdmFpbGFibGVQcm92aWRlcnMoKTtcclxuICAgICAgcmV0dXJuIGF2YWlsYWJsZVByb3ZpZGVycy5pbmNsdWRlcyhwcm92aWRlci50b0xvd2VyQ2FzZSgpKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVnaXN0ZXIgYSBuZXcgcHJvdmlkZXIgZmFjdG9yeS5cclxuICAgKiBUaGlzIGFsbG93cyBmb3IgZXh0ZW5kaW5nIHRoZSBmYWN0b3J5IHdpdGggbmV3IHByb3ZpZGVycy5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gcHJvdmlkZXIgVGhlIG5hbWUgb2YgdGhlIHByb3ZpZGVyXHJcbiAgICogQHBhcmFtIGZhY3RvcnkgVGhlIGZhY3RvcnkgZnVuY3Rpb24gZm9yIGNyZWF0aW5nIHRoZSBwcm92aWRlciBhZGFwdGVyXHJcbiAgICovXHJcbiAgc3RhdGljIHJlZ2lzdGVyUHJvdmlkZXIocHJvdmlkZXI6IHN0cmluZywgZmFjdG9yeTogUHJvdmlkZXJBZGFwdGVyRmFjdG9yeSk6IHZvaWQge1xyXG4gICAgcHJvdmlkZXJGYWN0b3JpZXNbcHJvdmlkZXIudG9Mb3dlckNhc2UoKV0gPSBmYWN0b3J5O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGFsbCBhdmFpbGFibGUgbW9kZWxzIGZvciBhIHNwZWNpZmljIHByb3ZpZGVyLlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBwcm92aWRlciBUaGUgbmFtZSBvZiB0aGUgcHJvdmlkZXJcclxuICAgKiBAcmV0dXJucyBBbiBhcnJheSBvZiBNb2RlbEluZm8gb2JqZWN0cyBmb3IgdGhlIHByb3ZpZGVyXHJcbiAgICovXHJcbiAgc3RhdGljIGdldE1vZGVsc0ZvclByb3ZpZGVyKHByb3ZpZGVyOiBzdHJpbmcpOiBNb2RlbEluZm9bXSB7XHJcbiAgICBpZiAoIXRoaXMubW9kZWxzTG9hZGVyIHx8ICF0aGlzLmluaXRpYWxpemVkKSB7XHJcbiAgICAgIGNvbnNvbGUud2FybignUHJvdmlkZXJGYWN0b3J5IG5vdCBpbml0aWFsaXplZC4gQ2FsbCBpbml0aWFsaXplKCkgZmlyc3QuJyk7XHJcbiAgICAgIHJldHVybiBbXTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIHRoaXMubW9kZWxzTG9hZGVyLmdldE1vZGVsc0ZvclByb3ZpZGVyKHByb3ZpZGVyKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhbGwgYXZhaWxhYmxlIG1vZGVscyBhY3Jvc3MgYWxsIHByb3ZpZGVycy5cclxuICAgKiBcclxuICAgKiBAcmV0dXJucyBBbiBhcnJheSBvZiBNb2RlbEluZm8gb2JqZWN0cyBmb3IgYWxsIHByb3ZpZGVyc1xyXG4gICAqL1xyXG4gIHN0YXRpYyBnZXRBbGxNb2RlbHMoKTogTW9kZWxJbmZvW10ge1xyXG4gICAgaWYgKCF0aGlzLm1vZGVsc0xvYWRlciB8fCAhdGhpcy5pbml0aWFsaXplZCkge1xyXG4gICAgICBjb25zb2xlLndhcm4oJ1Byb3ZpZGVyRmFjdG9yeSBub3QgaW5pdGlhbGl6ZWQuIENhbGwgaW5pdGlhbGl6ZSgpIGZpcnN0LicpO1xyXG4gICAgICByZXR1cm4gW107XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiB0aGlzLm1vZGVsc0xvYWRlci5nZXRBbGxNb2RlbHMoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEZpbmQgYSBtb2RlbCBieSBpdHMgSUQgYWNyb3NzIGFsbCBwcm92aWRlcnMuXHJcbiAgICogXHJcbiAgICogQHBhcmFtIG1vZGVsSWQgVGhlIG1vZGVsIElEIHRvIGZpbmRcclxuICAgKiBAcmV0dXJucyBUaGUgTW9kZWxJbmZvIG9iamVjdCBvciB1bmRlZmluZWQgaWYgbm90IGZvdW5kXHJcbiAgICovXHJcbiAgc3RhdGljIGZpbmRNb2RlbEJ5SWQobW9kZWxJZDogc3RyaW5nKTogTW9kZWxJbmZvIHwgdW5kZWZpbmVkIHtcclxuICAgIGlmICghdGhpcy5tb2RlbHNMb2FkZXIgfHwgIXRoaXMuaW5pdGlhbGl6ZWQpIHtcclxuICAgICAgY29uc29sZS53YXJuKCdQcm92aWRlckZhY3Rvcnkgbm90IGluaXRpYWxpemVkLiBDYWxsIGluaXRpYWxpemUoKSBmaXJzdC4nKTtcclxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIHRoaXMubW9kZWxzTG9hZGVyLmZpbmRNb2RlbEJ5SWQobW9kZWxJZCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIGRpc3BsYXkgbmFtZSBmb3IgYSBwcm92aWRlci5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gcHJvdmlkZXIgVGhlIHByb3ZpZGVyIElEXHJcbiAgICogQHJldHVybnMgVGhlIGRpc3BsYXkgbmFtZSBvZiB0aGUgcHJvdmlkZXJcclxuICAgKi9cclxuICBzdGF0aWMgZ2V0UHJvdmlkZXJOYW1lKHByb3ZpZGVyOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgaWYgKCF0aGlzLm1vZGVsc0xvYWRlciB8fCAhdGhpcy5pbml0aWFsaXplZCkge1xyXG4gICAgICByZXR1cm4gcHJvdmlkZXI7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiB0aGlzLm1vZGVsc0xvYWRlci5nZXRQcm92aWRlck5hbWUocHJvdmlkZXIpO1xyXG4gIH1cclxufVxyXG4iXX0=