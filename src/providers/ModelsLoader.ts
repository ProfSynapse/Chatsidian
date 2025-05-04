/**
 * Models Loader
 * 
 * This file provides functionality to load and access model information
 * from the centralized models.yaml file. It serves as a single source of truth
 * for all model information across different providers.
 */

import { App, TFile } from 'obsidian';
import { ModelInfo } from '../models/Provider';
import * as yaml from 'js-yaml';

/**
 * Interface representing the structure of the models.yaml file
 */
export interface ModelsConfig {
  providers: {
    [provider: string]: {
      name: string;
      models: ModelInfo[];
    };
  };
}

/**
 * Class responsible for loading and providing access to model information
 */
export class ModelsLoader {
  private static instance: ModelsLoader;
  private config: ModelsConfig | null = null;
  private app: App | null = null;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {}

  /**
   * Get the singleton instance of ModelsLoader
   * 
   * @returns The ModelsLoader instance
   */
  public static getInstance(): ModelsLoader {
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
  public initialize(app: App): void {
    this.app = app;
  }

  /**
   * Load model information from the models.yaml file
   * 
   * @returns A promise that resolves when the models are loaded
   * @throws Error if the models.yaml file cannot be loaded or parsed
   */
  public async loadModels(): Promise<void> {
    if (!this.app) {
      throw new Error('ModelsLoader not initialized with app instance');
    }

    try {
      // In development mode, we'll load the models.yaml file directly from the src directory
      const adapter = this.app.vault.adapter;
      
      // Try to load from the src directory first (development mode)
      let yamlContent: string;
      try {
        yamlContent = await adapter.read('src/providers/models.yaml');
      } catch (e) {
        // If that fails, try to load from the plugin directory (production mode)
        const pluginDir = this.app.vault.configDir + '/plugins/chatsidian';
        yamlContent = await adapter.read(`${pluginDir}/models.yaml`);
      }
      
      // Parse the YAML content
      this.config = yaml.load(yamlContent) as ModelsConfig;
      
      if (!this.config || !this.config.providers) {
        throw new Error('Invalid models.yaml format');
      }
    } catch (error) {
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
  public getModelsForProvider(provider: string): ModelInfo[] {
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
  public getAllModels(): ModelInfo[] {
    if (!this.config) {
      throw new Error('Models not loaded. Call loadModels() first.');
    }

    const allModels: ModelInfo[] = [];
    
    // Since we've already checked this.config is not null, we can use the non-null assertion
    const providers = this.config!.providers;
    
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
  public getProviderName(provider: string): string {
    if (!this.config) {
      throw new Error('Models not loaded. Call loadModels() first.');
    }

    const providerConfig = this.config.providers[provider.toLowerCase()];
    return providerConfig?.name || provider;
  }

  /**
   * Get a list of all available providers
   * 
   * @returns An array of provider IDs
   */
  public getAvailableProviders(): string[] {
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
  public findModelById(modelId: string): ModelInfo | undefined {
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
