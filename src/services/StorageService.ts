/**
 * Storage service for plugin integration.
 * 
 * This file provides a service class for initializing and managing the storage system,
 * integrating the StorageManager with the Obsidian plugin lifecycle.
 */

import { App, Plugin } from '../utils/obsidian-imports';
import { Conversation, Message } from '../models/Conversation';
import { EventBus } from '../core/EventBus';
import { SettingsManager } from '../core/SettingsManager';
import { StorageManager } from '../core/StorageManager';
import {
  StorageError,
  ConversationNotFoundError,
  MessageNotFoundError,
  FolderOperationError,
  FileOperationError,
  JsonParseError,
  ImportExportError
} from '../core/StorageErrors';

/**
 * Service class for initializing and managing the storage system.
 * Provides a bridge between the plugin and the storage management system.
 */
export class StorageService {
  private app: App;
  private plugin: Plugin;
  private eventBus: EventBus;
  private settings: SettingsManager;
  private storageManager: StorageManager;
  
  /**
   * Create a new StorageService.
   * @param app Obsidian app instance
   * @param plugin Plugin instance
   * @param eventBus Event bus
   * @param settings Settings manager
   */
  constructor(
    app: App,
    plugin: Plugin,
    eventBus: EventBus,
    settings: SettingsManager
  ) {
    this.app = app;
    this.plugin = plugin;
    this.eventBus = eventBus;
    this.settings = settings;
  }
  
  /**
   * Initialize the storage service.
   * @returns Promise that resolves when initialization is complete
   */
  public async initialize(): Promise<void> {
    // Create storage manager
    this.storageManager = new StorageManager(
      this.app,
      this.plugin,
      this.settings,
      this.eventBus
    );
    
    // Initialize storage manager
    await this.storageManager.initialize();
    
    // Register for plugin lifecycle events
    this.registerEventListeners();
    
    // Emit storage initialized event
    this.eventBus.emit('storage:initialized', undefined);
  }
  
  /**
   * Register event listeners for the storage service.
   */
  private registerEventListeners(): void {
    // Listen for plugin unload event
    this.plugin.registerEvent(
      this.eventBus.on('plugin:unloaded', () => {
        // Clean up any resources if needed
        console.log('Storage service shutting down');
      })
    );
  }
  
  /**
   * Get all conversations.
   * @returns Promise that resolves with an array of conversations
   */
  public async getConversations(): Promise<Conversation[]> {
    try {
      return await this.storageManager.getConversations();
    } catch (error) {
      console.error('Error getting conversations:', error);
      this.handleStorageError(error);
      return [];
    }
  }
  
  /**
   * Get a conversation by ID.
   * @param id Conversation ID
   * @returns Promise that resolves with the conversation or null if not found
   */
  public async getConversation(id: string): Promise<Conversation | null> {
    try {
      return await this.storageManager.getConversation(id);
    } catch (error) {
      console.error(`Error getting conversation ${id}:`, error);
      this.handleStorageError(error);
      return null;
    }
  }
  
  /**
   * Create a new conversation.
   * @param title Optional title for the conversation
   * @returns Promise that resolves with the new conversation
   */
  public async createConversation(title?: string): Promise<Conversation> {
    try {
      return await this.storageManager.createConversation(title);
    } catch (error) {
      console.error('Error creating conversation:', error);
      this.handleStorageError(error);
      throw error;
    }
  }
  
  /**
   * Save a conversation.
   * @param conversation Conversation to save
   * @returns Promise that resolves when the conversation is saved
   */
  public async saveConversation(conversation: Conversation): Promise<void> {
    try {
      await this.storageManager.saveConversation(conversation);
    } catch (error) {
      console.error(`Error saving conversation ${conversation.id}:`, error);
      this.handleStorageError(error);
      throw error;
    }
  }
  
  /**
   * Delete a conversation.
   * @param id Conversation ID
   * @returns Promise that resolves when the conversation is deleted
   */
  public async deleteConversation(id: string): Promise<void> {
    try {
      await this.storageManager.deleteConversation(id);
    } catch (error) {
      console.error(`Error deleting conversation ${id}:`, error);
      this.handleStorageError(error);
      throw error;
    }
  }
  
  /**
   * Add a message to a conversation.
   * @param conversationId Conversation ID
   * @param message Message to add
   * @returns Promise that resolves with the updated conversation
   */
  public async addMessage(
    conversationId: string,
    message: Message
  ): Promise<Conversation> {
    try {
      return await this.storageManager.addMessage(conversationId, message);
    } catch (error) {
      console.error(`Error adding message to conversation ${conversationId}:`, error);
      this.handleStorageError(error);
      throw error;
    }
  }
  
  /**
   * Update a message in a conversation.
   * @param conversationId Conversation ID
   * @param messageId Message ID
   * @param updatedContent Updated message content
   * @returns Promise that resolves with the updated conversation
   */
  public async updateMessage(
    conversationId: string,
    messageId: string,
    updatedContent: string
  ): Promise<Conversation> {
    try {
      return await this.storageManager.updateMessage(
        conversationId,
        messageId,
        updatedContent
      );
    } catch (error) {
      console.error(`Error updating message ${messageId} in conversation ${conversationId}:`, error);
      this.handleStorageError(error);
      throw error;
    }
  }
  
  /**
   * Rename a conversation.
   * @param conversationId Conversation ID
   * @param newTitle New conversation title
   * @returns Promise that resolves with the updated conversation
   */
  public async renameConversation(
    conversationId: string,
    newTitle: string
  ): Promise<Conversation> {
    try {
      return await this.storageManager.renameConversation(conversationId, newTitle);
    } catch (error) {
      console.error(`Error renaming conversation ${conversationId}:`, error);
      this.handleStorageError(error);
      throw error;
    }
  }
  
  /**
   * Export a conversation to Markdown.
   * @param conversationId Conversation ID
   * @returns Promise that resolves when the export is complete
   */
  public async exportToMarkdown(conversationId: string): Promise<void> {
    try {
      await this.storageManager.exportToMarkdown(conversationId);
    } catch (error) {
      console.error(`Error exporting conversation ${conversationId} to Markdown:`, error);
      this.handleStorageError(error);
      throw error;
    }
  }
  
  /**
   * Export a conversation to JSON.
   * @param conversationId Conversation ID
   * @returns Promise that resolves when the export is complete
   */
  public async exportToJson(conversationId: string): Promise<void> {
    try {
      await this.storageManager.exportToJson(conversationId);
    } catch (error) {
      console.error(`Error exporting conversation ${conversationId} to JSON:`, error);
      this.handleStorageError(error);
      throw error;
    }
  }
  
  /**
   * Import a conversation from JSON.
   * @param json Conversation JSON
   * @returns Promise that resolves with the imported conversation
   */
  public async importConversation(json: string): Promise<Conversation> {
    try {
      return await this.storageManager.importConversation(json);
    } catch (error) {
      console.error('Error importing conversation:', error);
      this.handleStorageError(error);
      throw error;
    }
  }
  
  /**
   * Import a conversation from Markdown.
   * @param markdown Markdown content
   * @returns Promise that resolves with the imported conversation
   */
  public async importFromMarkdown(markdown: string): Promise<Conversation> {
    try {
      return await this.storageManager.importFromMarkdown(markdown);
    } catch (error) {
      console.error('Error importing conversation from Markdown:', error);
      this.handleStorageError(error);
      throw error;
    }
  }
  
  /**
   * Create a backup of a conversation.
   * @param conversationId Conversation ID
   * @returns Promise that resolves with the path to the backup file
   */
  public async backupConversation(conversationId: string): Promise<string> {
    try {
      return await this.storageManager.backupConversation(conversationId);
    } catch (error) {
      console.error(`Error backing up conversation ${conversationId}:`, error);
      this.handleStorageError(error);
      throw error;
    }
  }
  
  /**
   * Handle storage errors.
   * @param error Error to handle
   */
  private handleStorageError(error: any): void {
    // Emit error event
    this.eventBus.emit('storage:error', { error });
    
    // Handle specific error types
    if (error instanceof ConversationNotFoundError) {
      console.error(`Conversation not found: ${error.conversationId}`);
    } else if (error instanceof MessageNotFoundError) {
      console.error(`Message not found: ${error.messageId} in conversation ${error.conversationId}`);
    } else if (error instanceof FolderOperationError) {
      console.error(`Folder operation failed: ${error.path}`);
    } else if (error instanceof FileOperationError) {
      console.error(`File operation failed: ${error.path}`);
    } else if (error instanceof JsonParseError) {
      console.error(`JSON parse error: ${error.message}`);
    } else if (error instanceof ImportExportError) {
      console.error(`Import/export error: ${error.message}`);
    } else if (error instanceof StorageError) {
      console.error(`Storage error: ${error.message}`);
    } else {
      console.error(`Unknown storage error: ${error}`);
    }
  }
}
