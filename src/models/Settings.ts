/**
 * Settings model for the Chatsidian plugin.
 * Defines the structure for user-configurable settings,
 * provides default values, and includes utilities for validation
 * and integration with Obsidian's data persistence.
 */

import { AgentDefinition } from '../agents/AgentTypes';

/**
 * Interface defining the structure of Chatsidian plugin settings.
 */
export interface ChatsidianSettings {
  // --- API Configuration ---

  /** The AI provider service to use (e.g., 'anthropic', 'openai') */
  provider: 'anthropic' | 'openai' | 'openrouter' | 'google' | 'custom' | 'requesty';

  /** API key for the selected provider */
  apiKey: string;

  /** Optional custom API endpoint URL (for custom providers or proxies) */
  apiEndpoint?: string;

  /** The specific model identifier to use with the selected provider */
  model: string;

  // --- Conversation Settings ---

  /** Vault folder path where conversation files are stored */
  conversationsFolder: string;

  /** Maximum number of messages to keep loaded in memory per conversation */
  maxMessages: number; // Consider if this is still needed or handled by storage/view

  // --- Debug Mode ---
  
  /** Enable verbose logging for debugging purposes */
  debugMode: boolean;
  
  // --- Agent Settings ---
  
  /** Default agent ID to use when none is specified */
  defaultAgentId?: string;
  
  /** Custom agent definitions */
  customAgents?: AgentDefinition[];
}

/**
 * Default values for all Chatsidian settings.
 * Used when initializing settings for the first time or when a setting is missing.
 */
export const DEFAULT_SETTINGS: ChatsidianSettings = {
  provider: 'anthropic',
  apiKey: '',
  apiEndpoint: '', // Default to empty string
  model: 'claude-3-opus-20240229', // Default to a known powerful model
  conversationsFolder: '.chatsidian/conversations', // Store in a hidden folder by default
  maxMessages: 100, // Reasonable default for memory management
  debugMode: false,
  defaultAgentId: 'general_assistant', // Default agent
  customAgents: [] // No custom agents by default
};

/**
 * Provides utility functions for validating and handling Chatsidian settings.
 */
export class SettingsUtils {
  /**
   * Validates a partial settings object and merges it with defaults.
   * Ensures that all settings have valid values.
   * @param settings The potentially partial or invalid settings object.
   * @returns A complete and valid ChatsidianSettings object.
   */
  static validate(settings: Partial<ChatsidianSettings>): ChatsidianSettings {
    const merged = { ...DEFAULT_SETTINGS, ...settings };

    return {
      ...merged,
      provider: this.validateProvider(merged.provider),
      apiKey: merged.apiKey || '', // Ensure apiKey is at least an empty string
      apiEndpoint: merged.apiEndpoint || '', // Ensure apiEndpoint is at least an empty string
      conversationsFolder: this.validateFolderPath(merged.conversationsFolder),
      maxMessages: Math.max(10, merged.maxMessages || DEFAULT_SETTINGS.maxMessages), // Ensure at least 10
      debugMode: typeof merged.debugMode === 'boolean' ? merged.debugMode : DEFAULT_SETTINGS.debugMode,
      defaultAgentId: merged.defaultAgentId || DEFAULT_SETTINGS.defaultAgentId,
      customAgents: Array.isArray(merged.customAgents) ? merged.customAgents : DEFAULT_SETTINGS.customAgents,
    };
  }

  /**
   * Validates the provider setting, defaulting if invalid.
   */
  private static validateProvider(provider?: string): ChatsidianSettings['provider'] {
    const validProviders: Array<ChatsidianSettings['provider']> = [
      'anthropic',
      'openai',
      'openrouter',
      'google',
      'custom',
      'requesty',
    ];
    return validProviders.includes(provider as any)
      ? (provider as ChatsidianSettings['provider'])
      : DEFAULT_SETTINGS.provider;
  }


  /**
   * Validates and normalizes a folder path string.
   * Removes leading/trailing slashes and ensures it's not empty.
   */
  private static validateFolderPath(path?: string): string {
    if (!path) return DEFAULT_SETTINGS.conversationsFolder;

    // Remove leading/trailing slashes and backslashes
    path = path.replace(/^[\\/]+|[\\/]+$/g, '');

    // Ensure path is not empty after trimming
    return path || DEFAULT_SETTINGS.conversationsFolder;
  }

}

/**
 * Loads settings from Obsidian's data persistence, validates them, and returns a complete settings object.
 * @param loadedData Data object loaded via Obsidian's `loadData()`.
 * @returns A validated ChatsidianSettings object.
 */
export function loadSettings(loadedData: any): ChatsidianSettings {
  // The loadedData might be null or undefined if it's the first time
  return SettingsUtils.validate(loadedData || {});
}

/**
 * Prepares the settings object for saving via Obsidian's `saveData()`.
 * Currently, it's an identity function but can be used for transformations if needed later.
 * @param settings The settings object to prepare for saving.
 * @returns The settings object ready to be saved.
 */
export function prepareSettingsForSave(settings: ChatsidianSettings): any {
  // Example transformation (if needed): Convert Date objects to timestamps
  // For now, just return the settings as is, assuming they are JSON-serializable
  return { ...settings };
}
