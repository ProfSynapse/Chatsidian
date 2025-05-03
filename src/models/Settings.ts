/**
 * Settings model for the Chatsidian plugin.
 * Defines the structure of the plugin settings and provides default values.
 */

export interface ChatsidianSettings {
  /**
   * API key for the AI service
   */
  apiKey: string;
  
  /**
   * Selected AI provider (e.g., "anthropic", "openai")
   */
  provider: string;
  
  /**
   * Selected AI model (e.g., "claude-3-opus", "gpt-4")
   */
  model: string;
  
  /**
   * Folder path where conversations will be stored
   */
  conversationsFolder: string;
  
  /**
   * Whether to save conversations to the vault
   */
  saveConversations: boolean;
}

/**
 * Default settings for the Chatsidian plugin
 */
export const DEFAULT_SETTINGS: ChatsidianSettings = {
  apiKey: '',
  provider: 'anthropic',
  model: 'claude-3-opus',
  conversationsFolder: 'Chatsidian',
  saveConversations: true
};
