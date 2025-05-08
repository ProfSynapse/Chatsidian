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

  /** Default system prompt used for new conversations */
  defaultSystemPrompt: string;

  // --- UI Settings ---

  /** UI theme preference */
  theme: 'light' | 'dark' | 'system'; // 'system' follows Obsidian's theme

  /** Font size for the chat interface */
  fontSize: number;

  /** Whether to display timestamps next to messages */
  showTimestamps: boolean;

  // --- Advanced Settings ---

  /** Enable verbose logging for debugging purposes */
  debugMode: boolean;

  /** List of Bounded Context Pack (BCP) names to load automatically on startup */
  autoLoadBCPs: string[];

  /** Default temperature parameter for AI requests (controls randomness) */
  defaultTemperature: number;

  /** Default maximum tokens parameter for AI responses (limits response length) */
  defaultMaxTokens: number;
  
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
  defaultSystemPrompt:
    'You are an AI assistant integrated into Obsidian. Use your tools to help the user manage their vault and notes.',
  theme: 'system', // Follow Obsidian's theme by default
  fontSize: 14, // Common default font size
  showTimestamps: true,
  debugMode: false,
  autoLoadBCPs: ['NoteManager', 'FolderManager', 'VaultLibrarian'], // Sensible defaults
  defaultTemperature: 0.7, // Balanced default
  defaultMaxTokens: 4000, // Allow reasonably long responses
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
      defaultSystemPrompt: merged.defaultSystemPrompt !== undefined ? merged.defaultSystemPrompt : DEFAULT_SETTINGS.defaultSystemPrompt,
      theme: this.validateTheme(merged.theme),
      fontSize: Math.max(8, merged.fontSize || DEFAULT_SETTINGS.fontSize), // Ensure at least 8px
      showTimestamps: typeof merged.showTimestamps === 'boolean' ? merged.showTimestamps : DEFAULT_SETTINGS.showTimestamps,
      debugMode: typeof merged.debugMode === 'boolean' ? merged.debugMode : DEFAULT_SETTINGS.debugMode,
      autoLoadBCPs: Array.isArray(merged.autoLoadBCPs) ? merged.autoLoadBCPs : DEFAULT_SETTINGS.autoLoadBCPs,
      defaultTemperature: this.validateTemperature(merged.defaultTemperature),
      defaultMaxTokens: this.validateMaxTokens(merged.defaultMaxTokens),
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
   * Validates the theme setting, defaulting if invalid.
   */
  private static validateTheme(theme?: string): ChatsidianSettings['theme'] {
      const validThemes: Array<ChatsidianSettings['theme']> = ['light', 'dark', 'system'];
      return validThemes.includes(theme as any)
          ? (theme as ChatsidianSettings['theme'])
          : DEFAULT_SETTINGS.theme;
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

  /**
   * Validates the temperature setting, clamping it between 0 and 1.
   */
  private static validateTemperature(temperature?: number): number {
    const temp = temperature ?? DEFAULT_SETTINGS.defaultTemperature;
    return Math.max(0, Math.min(1, temp));
  }

  /**
   * Validates the max tokens setting, ensuring it's a positive integer within a reasonable range.
   */
  private static validateMaxTokens(maxTokens?: number): number {
    const tokens = maxTokens ?? DEFAULT_SETTINGS.defaultMaxTokens;
    // Assuming a practical upper limit, e.g., 32k, adjust as needed
    return Math.max(1, Math.min(32000, Math.floor(tokens)));
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
