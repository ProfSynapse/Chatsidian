/**
 * Models Loader
 *
 * This file provides functionality to load and access model information
 * from the centralized models.yaml file. It serves as a single source of truth
 * for all model information across different providers.
 */
import * as yaml from 'js-yaml';
/**
 * Class responsible for loading and providing access to model information
 */
export class ModelsLoader {
    /**
     * Private constructor to enforce singleton pattern
     */
    constructor() {
        this.config = null;
        this.app = null;
    }
    /**
     * Get the singleton instance of ModelsLoader
     *
     * @returns The ModelsLoader instance
     */
    static getInstance() {
        if (!ModelsLoader.instance) {
            ModelsLoader.instance = new ModelsLoader();
        }
        return ModelsLoader.instance;
    }
    /**
     * Initialize the ModelsLoader with the Obsidian app instance
     *
     * @param app The Obsidian app instance
     */
    initialize(app) {
        this.app = app;
    }
    /**
     * Load model information from the models.yaml file
     *
     * @returns A promise that resolves when the models are loaded
     * @throws Error if the models.yaml file cannot be loaded or parsed
     */
    async loadModels() {
        if (!this.app) {
            throw new Error('ModelsLoader not initialized with app instance');
        }
        try {
            // In development mode, we'll load the models.yaml file directly from the src directory
            const adapter = this.app.vault.adapter;
            // Try to load from the src directory first (development mode)
            let yamlContent;
            try {
                yamlContent = await adapter.read('src/providers/models.yaml');
            }
            catch (e) {
                // If that fails, try to load from the plugin directory (production mode)
                const pluginDir = this.app.vault.configDir + '/plugins/chatsidian';
                yamlContent = await adapter.read(`${pluginDir}/models.yaml`);
            }
            // Parse the YAML content
            this.config = yaml.load(yamlContent);
            if (!this.config || !this.config.providers) {
                throw new Error('Invalid models.yaml format');
            }
        }
        catch (error) {
            console.error('Failed to load models.yaml:', error);
            throw new Error(`Failed to load models configuration: ${error.message}`);
        }
    }
    /**
     * Get models for a specific provider
     *
     * @param provider The provider name
     * @returns An array of ModelInfo objects for the provider
     */
    getModelsForProvider(provider) {
        if (!this.config) {
            throw new Error('Models not loaded. Call loadModels() first.');
        }
        const providerConfig = this.config.providers[provider.toLowerCase()];
        if (!providerConfig || !Array.isArray(providerConfig.models)) {
            return [];
        }
        return providerConfig.models;
    }
    /**
     * Get all available models across all providers
     *
     * @returns An array of ModelInfo objects for all providers
     */
    getAllModels() {
        if (!this.config) {
            throw new Error('Models not loaded. Call loadModels() first.');
        }
        const allModels = [];
        // Since we've already checked this.config is not null, we can use the non-null assertion
        const providers = this.config.providers;
        Object.keys(providers).forEach(provider => {
            const providerConfig = providers[provider];
            if (providerConfig && Array.isArray(providerConfig.models)) {
                allModels.push(...providerConfig.models);
            }
        });
        return allModels;
    }
    /**
     * Get the display name for a provider
     *
     * @param provider The provider ID
     * @returns The display name of the provider
     */
    getProviderName(provider) {
        if (!this.config) {
            throw new Error('Models not loaded. Call loadModels() first.');
        }
        const providerConfig = this.config.providers[provider.toLowerCase()];
        return (providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.name) || provider;
    }
    /**
     * Get a list of all available providers
     *
     * @returns An array of provider IDs
     */
    getAvailableProviders() {
        if (!this.config) {
            throw new Error('Models not loaded. Call loadModels() first.');
        }
        return Object.keys(this.config.providers);
    }
    /**
     * Find a model by its ID across all providers
     *
     * @param modelId The model ID to find
     * @returns The ModelInfo object or undefined if not found
     */
    findModelById(modelId) {
        if (!this.config) {
            throw new Error('Models not loaded. Call loadModels() first.');
        }
        for (const provider of Object.keys(this.config.providers)) {
            const providerConfig = this.config.providers[provider];
            if (providerConfig && Array.isArray(providerConfig.models)) {
                const model = providerConfig.models.find(m => m.id === modelId);
                if (model) {
                    return model;
                }
            }
        }
        return undefined;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTW9kZWxzTG9hZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiTW9kZWxzTG9hZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUlILE9BQU8sS0FBSyxJQUFJLE1BQU0sU0FBUyxDQUFDO0FBY2hDOztHQUVHO0FBQ0gsTUFBTSxPQUFPLFlBQVk7SUFLdkI7O09BRUc7SUFDSDtRQU5RLFdBQU0sR0FBd0IsSUFBSSxDQUFDO1FBQ25DLFFBQUcsR0FBZSxJQUFJLENBQUM7SUFLUixDQUFDO0lBRXhCOzs7O09BSUc7SUFDSSxNQUFNLENBQUMsV0FBVztRQUN2QixJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQzNCLFlBQVksQ0FBQyxRQUFRLEdBQUcsSUFBSSxZQUFZLEVBQUUsQ0FBQztRQUM3QyxDQUFDO1FBQ0QsT0FBTyxZQUFZLENBQUMsUUFBUSxDQUFDO0lBQy9CLENBQUM7SUFFRDs7OztPQUlHO0lBQ0ksVUFBVSxDQUFDLEdBQVE7UUFDeEIsSUFBSSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7SUFDakIsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0ksS0FBSyxDQUFDLFVBQVU7UUFDckIsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUNkLE1BQU0sSUFBSSxLQUFLLENBQUMsZ0RBQWdELENBQUMsQ0FBQztRQUNwRSxDQUFDO1FBRUQsSUFBSSxDQUFDO1lBQ0gsdUZBQXVGO1lBQ3ZGLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQztZQUV2Qyw4REFBOEQ7WUFDOUQsSUFBSSxXQUFtQixDQUFDO1lBQ3hCLElBQUksQ0FBQztnQkFDSCxXQUFXLEdBQUcsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUFDLDJCQUEyQixDQUFDLENBQUM7WUFDaEUsQ0FBQztZQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7Z0JBQ1gseUVBQXlFO2dCQUN6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UUFDakUsQ0FBQztRQUVELE9BQU8sTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFFRDs7Ozs7T0FLRztJQUNJLGFBQWEsQ0FBQyxPQUFlO1FBQ2xDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDakIsTUFBTSxJQUFJLEtBQUssQ0FBQyw2Q0FBNkMsQ0FBQyxDQUFDO1FBQ2pFLENBQUM7UUFFRCxLQUFLLE1BQU0sUUFBUSxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDO1lBQzFELE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3ZELElBQUksY0FBYyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7Z0JBQzNELE1BQU0sS0FBSyxHQUFHLGNBQWMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxPQUFPLENBQUMsQ0FBQztnQkFDaEUsSUFBSSxLQUFLLEVBQUUsQ0FBQztvQkFDVixPQUFPLEtBQUssQ0FBQztnQkFDZixDQUFDO1lBQ0gsQ0FBQztRQUNILENBQUM7UUFFRCxPQUFPLFNBQVMsQ0FBQztJQUNuQixDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogTW9kZWxzIExvYWRlclxyXG4gKiBcclxuICogVGhpcyBmaWxlIHByb3ZpZGVzIGZ1bmN0aW9uYWxpdHkgdG8gbG9hZCBhbmQgYWNjZXNzIG1vZGVsIGluZm9ybWF0aW9uXHJcbiAqIGZyb20gdGhlIGNlbnRyYWxpemVkIG1vZGVscy55YW1sIGZpbGUuIEl0IHNlcnZlcyBhcyBhIHNpbmdsZSBzb3VyY2Ugb2YgdHJ1dGhcclxuICogZm9yIGFsbCBtb2RlbCBpbmZvcm1hdGlvbiBhY3Jvc3MgZGlmZmVyZW50IHByb3ZpZGVycy5cclxuICovXHJcblxyXG5pbXBvcnQgeyBBcHAsIFRGaWxlIH0gZnJvbSAnb2JzaWRpYW4nO1xyXG5pbXBvcnQgeyBNb2RlbEluZm8gfSBmcm9tICcuLi9tb2RlbHMvUHJvdmlkZXInO1xyXG5pbXBvcnQgKiBhcyB5YW1sIGZyb20gJ2pzLXlhbWwnO1xyXG5cclxuLyoqXHJcbiAqIEludGVyZmFjZSByZXByZXNlbnRpbmcgdGhlIHN0cnVjdHVyZSBvZiB0aGUgbW9kZWxzLnlhbWwgZmlsZVxyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBNb2RlbHNDb25maWcge1xyXG4gIHByb3ZpZGVyczoge1xyXG4gICAgW3Byb3ZpZGVyOiBzdHJpbmddOiB7XHJcbiAgICAgIG5hbWU6IHN0cmluZztcclxuICAgICAgbW9kZWxzOiBNb2RlbEluZm9bXTtcclxuICAgIH07XHJcbiAgfTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENsYXNzIHJlc3BvbnNpYmxlIGZvciBsb2FkaW5nIGFuZCBwcm92aWRpbmcgYWNjZXNzIHRvIG1vZGVsIGluZm9ybWF0aW9uXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgTW9kZWxzTG9hZGVyIHtcclxuICBwcml2YXRlIHN0YXRpYyBpbnN0YW5jZTogTW9kZWxzTG9hZGVyO1xyXG4gIHByaXZhdGUgY29uZmlnOiBNb2RlbHNDb25maWcgfCBudWxsID0gbnVsbDtcclxuICBwcml2YXRlIGFwcDogQXBwIHwgbnVsbCA9IG51bGw7XHJcblxyXG4gIC8qKlxyXG4gICAqIFByaXZhdGUgY29uc3RydWN0b3IgdG8gZW5mb3JjZSBzaW5nbGV0b24gcGF0dGVyblxyXG4gICAqL1xyXG4gIHByaXZhdGUgY29uc3RydWN0b3IoKSB7fVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIHNpbmdsZXRvbiBpbnN0YW5jZSBvZiBNb2RlbHNMb2FkZXJcclxuICAgKiBcclxuICAgKiBAcmV0dXJucyBUaGUgTW9kZWxzTG9hZGVyIGluc3RhbmNlXHJcbiAgICovXHJcbiAgcHVibGljIHN0YXRpYyBnZXRJbnN0YW5jZSgpOiBNb2RlbHNMb2FkZXIge1xyXG4gICAgaWYgKCFNb2RlbHNMb2FkZXIuaW5zdGFuY2UpIHtcclxuICAgICAgTW9kZWxzTG9hZGVyLmluc3RhbmNlID0gbmV3IE1vZGVsc0xvYWRlcigpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIE1vZGVsc0xvYWRlci5pbnN0YW5jZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEluaXRpYWxpemUgdGhlIE1vZGVsc0xvYWRlciB3aXRoIHRoZSBPYnNpZGlhbiBhcHAgaW5zdGFuY2VcclxuICAgKiBcclxuICAgKiBAcGFyYW0gYXBwIFRoZSBPYnNpZGlhbiBhcHAgaW5zdGFuY2VcclxuICAgKi9cclxuICBwdWJsaWMgaW5pdGlhbGl6ZShhcHA6IEFwcCk6IHZvaWQge1xyXG4gICAgdGhpcy5hcHAgPSBhcHA7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBMb2FkIG1vZGVsIGluZm9ybWF0aW9uIGZyb20gdGhlIG1vZGVscy55YW1sIGZpbGVcclxuICAgKiBcclxuICAgKiBAcmV0dXJucyBBIHByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIHRoZSBtb2RlbHMgYXJlIGxvYWRlZFxyXG4gICAqIEB0aHJvd3MgRXJyb3IgaWYgdGhlIG1vZGVscy55YW1sIGZpbGUgY2Fubm90IGJlIGxvYWRlZCBvciBwYXJzZWRcclxuICAgKi9cclxuICBwdWJsaWMgYXN5bmMgbG9hZE1vZGVscygpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGlmICghdGhpcy5hcHApIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdNb2RlbHNMb2FkZXIgbm90IGluaXRpYWxpemVkIHdpdGggYXBwIGluc3RhbmNlJyk7XHJcbiAgICB9XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgLy8gSW4gZGV2ZWxvcG1lbnQgbW9kZSwgd2UnbGwgbG9hZCB0aGUgbW9kZWxzLnlhbWwgZmlsZSBkaXJlY3RseSBmcm9tIHRoZSBzcmMgZGlyZWN0b3J5XHJcbiAgICAgIGNvbnN0IGFkYXB0ZXIgPSB0aGlzLmFwcC52YXVsdC5hZGFwdGVyO1xyXG4gICAgICBcclxuICAgICAgLy8gVHJ5IHRvIGxvYWQgZnJvbSB0aGUgc3JjIGRpcmVjdG9yeSBmaXJzdCAoZGV2ZWxvcG1lbnQgbW9kZSlcclxuICAgICAgbGV0IHlhbWxDb250ZW50OiBzdHJpbmc7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgeWFtbENvbnRlbnQgPSBhd2FpdCBhZGFwdGVyLnJlYWQoJ3NyYy9wcm92aWRlcnMvbW9kZWxzLnlhbWwnKTtcclxuICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgIC8vIElmIHRoYXQgZmFpbHMsIHRyeSB0byBsb2FkIGZyb20gdGhlIHBsdWdpbiBkaXJlY3RvcnkgKHByb2R1Y3Rpb24gbW9kZSlcclxuICAgICAgICBjb25zdCBwbHVnaW5EaXIgPSB0aGlzLmFwcC52YXVsdC5jb25maWdEaXIgKyAnL3BsdWdpbnMvY2hhdHNpZGlhbic7XHJcbiAgICAgICAgeWFtbENvbnRlbnQgPSBhd2FpdCBhZGFwdGVyLnJlYWQoYCR7cGx1Z2luRGlyfS9tb2RlbHMueWFtbGApO1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICAvLyBQYXJzZSB0aGUgWUFNTCBjb250ZW50XHJcbiAgICAgIHRoaXMuY29uZmlnID0geWFtbC5sb2FkKHlhbWxDb250ZW50KSBhcyBNb2RlbHNDb25maWc7XHJcbiAgICAgIFxyXG4gICAgICBpZiAoIXRoaXMuY29uZmlnIHx8ICF0aGlzLmNvbmZpZy5wcm92aWRlcnMpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgbW9kZWxzLnlhbWwgZm9ybWF0Jyk7XHJcbiAgICAgIH1cclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBsb2FkIG1vZGVscy55YW1sOicsIGVycm9yKTtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gbG9hZCBtb2RlbHMgY29uZmlndXJhdGlvbjogJHtlcnJvci5tZXNzYWdlfWApO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IG1vZGVscyBmb3IgYSBzcGVjaWZpYyBwcm92aWRlclxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBwcm92aWRlciBUaGUgcHJvdmlkZXIgbmFtZVxyXG4gICAqIEByZXR1cm5zIEFuIGFycmF5IG9mIE1vZGVsSW5mbyBvYmplY3RzIGZvciB0aGUgcHJvdmlkZXJcclxuICAgKi9cclxuICBwdWJsaWMgZ2V0TW9kZWxzRm9yUHJvdmlkZXIocHJvdmlkZXI6IHN0cmluZyk6IE1vZGVsSW5mb1tdIHtcclxuICAgIGlmICghdGhpcy5jb25maWcpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdNb2RlbHMgbm90IGxvYWRlZC4gQ2FsbCBsb2FkTW9kZWxzKCkgZmlyc3QuJyk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgcHJvdmlkZXJDb25maWcgPSB0aGlzLmNvbmZpZy5wcm92aWRlcnNbcHJvdmlkZXIudG9Mb3dlckNhc2UoKV07XHJcbiAgICBpZiAoIXByb3ZpZGVyQ29uZmlnIHx8ICFBcnJheS5pc0FycmF5KHByb3ZpZGVyQ29uZmlnLm1vZGVscykpIHtcclxuICAgICAgcmV0dXJuIFtdO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBwcm92aWRlckNvbmZpZy5tb2RlbHM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYWxsIGF2YWlsYWJsZSBtb2RlbHMgYWNyb3NzIGFsbCBwcm92aWRlcnNcclxuICAgKiBcclxuICAgKiBAcmV0dXJucyBBbiBhcnJheSBvZiBNb2RlbEluZm8gb2JqZWN0cyBmb3IgYWxsIHByb3ZpZGVyc1xyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXRBbGxNb2RlbHMoKTogTW9kZWxJbmZvW10ge1xyXG4gICAgaWYgKCF0aGlzLmNvbmZpZykge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ01vZGVscyBub3QgbG9hZGVkLiBDYWxsIGxvYWRNb2RlbHMoKSBmaXJzdC4nKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBhbGxNb2RlbHM6IE1vZGVsSW5mb1tdID0gW107XHJcbiAgICBcclxuICAgIC8vIFNpbmNlIHdlJ3ZlIGFscmVhZHkgY2hlY2tlZCB0aGlzLmNvbmZpZyBpcyBub3QgbnVsbCwgd2UgY2FuIHVzZSB0aGUgbm9uLW51bGwgYXNzZXJ0aW9uXHJcbiAgICBjb25zdCBwcm92aWRlcnMgPSB0aGlzLmNvbmZpZyEucHJvdmlkZXJzO1xyXG4gICAgXHJcbiAgICBPYmplY3Qua2V5cyhwcm92aWRlcnMpLmZvckVhY2gocHJvdmlkZXIgPT4ge1xyXG4gICAgICBjb25zdCBwcm92aWRlckNvbmZpZyA9IHByb3ZpZGVyc1twcm92aWRlcl07XHJcbiAgICAgIGlmIChwcm92aWRlckNvbmZpZyAmJiBBcnJheS5pc0FycmF5KHByb3ZpZGVyQ29uZmlnLm1vZGVscykpIHtcclxuICAgICAgICBhbGxNb2RlbHMucHVzaCguLi5wcm92aWRlckNvbmZpZy5tb2RlbHMpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4gYWxsTW9kZWxzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBkaXNwbGF5IG5hbWUgZm9yIGEgcHJvdmlkZXJcclxuICAgKiBcclxuICAgKiBAcGFyYW0gcHJvdmlkZXIgVGhlIHByb3ZpZGVyIElEXHJcbiAgICogQHJldHVybnMgVGhlIGRpc3BsYXkgbmFtZSBvZiB0aGUgcHJvdmlkZXJcclxuICAgKi9cclxuICBwdWJsaWMgZ2V0UHJvdmlkZXJOYW1lKHByb3ZpZGVyOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgaWYgKCF0aGlzLmNvbmZpZykge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ01vZGVscyBub3QgbG9hZGVkLiBDYWxsIGxvYWRNb2RlbHMoKSBmaXJzdC4nKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBwcm92aWRlckNvbmZpZyA9IHRoaXMuY29uZmlnLnByb3ZpZGVyc1twcm92aWRlci50b0xvd2VyQ2FzZSgpXTtcclxuICAgIHJldHVybiBwcm92aWRlckNvbmZpZz8ubmFtZSB8fCBwcm92aWRlcjtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIGxpc3Qgb2YgYWxsIGF2YWlsYWJsZSBwcm92aWRlcnNcclxuICAgKiBcclxuICAgKiBAcmV0dXJucyBBbiBhcnJheSBvZiBwcm92aWRlciBJRHNcclxuICAgKi9cclxuICBwdWJsaWMgZ2V0QXZhaWxhYmxlUHJvdmlkZXJzKCk6IHN0cmluZ1tdIHtcclxuICAgIGlmICghdGhpcy5jb25maWcpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdNb2RlbHMgbm90IGxvYWRlZC4gQ2FsbCBsb2FkTW9kZWxzKCkgZmlyc3QuJyk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuY29uZmlnLnByb3ZpZGVycyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBGaW5kIGEgbW9kZWwgYnkgaXRzIElEIGFjcm9zcyBhbGwgcHJvdmlkZXJzXHJcbiAgICogXHJcbiAgICogQHBhcmFtIG1vZGVsSWQgVGhlIG1vZGVsIElEIHRvIGZpbmRcclxuICAgKiBAcmV0dXJucyBUaGUgTW9kZWxJbmZvIG9iamVjdCBvciB1bmRlZmluZWQgaWYgbm90IGZvdW5kXHJcbiAgICovXHJcbiAgcHVibGljIGZpbmRNb2RlbEJ5SWQobW9kZWxJZDogc3RyaW5nKTogTW9kZWxJbmZvIHwgdW5kZWZpbmVkIHtcclxuICAgIGlmICghdGhpcy5jb25maWcpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdNb2RlbHMgbm90IGxvYWRlZC4gQ2FsbCBsb2FkTW9kZWxzKCkgZmlyc3QuJyk7XHJcbiAgICB9XHJcblxyXG4gICAgZm9yIChjb25zdCBwcm92aWRlciBvZiBPYmplY3Qua2V5cyh0aGlzLmNvbmZpZy5wcm92aWRlcnMpKSB7XHJcbiAgICAgIGNvbnN0IHByb3ZpZGVyQ29uZmlnID0gdGhpcy5jb25maWcucHJvdmlkZXJzW3Byb3ZpZGVyXTtcclxuICAgICAgaWYgKHByb3ZpZGVyQ29uZmlnICYmIEFycmF5LmlzQXJyYXkocHJvdmlkZXJDb25maWcubW9kZWxzKSkge1xyXG4gICAgICAgIGNvbnN0IG1vZGVsID0gcHJvdmlkZXJDb25maWcubW9kZWxzLmZpbmQobSA9PiBtLmlkID09PSBtb2RlbElkKTtcclxuICAgICAgICBpZiAobW9kZWwpIHtcclxuICAgICAgICAgIHJldHVybiBtb2RlbDtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gIH1cclxufVxyXG4iXX0=