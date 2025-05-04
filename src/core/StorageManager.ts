/**
 * Storage manager for the Chatsidian plugin.
 * 
 * This file provides the core functionality for data persistence within the Obsidian vault,
 * leveraging Obsidian's built-in APIs for file operations and event handling.
 */

import { App, TFile, TFolder, Notice, Plugin } from '../utils/obsidian-imports';
import { Conversation, Message, MessageRole, ConversationUtils } from '../models/Conversation';
import { EventBus } from './EventBus';
import { SettingsManager } from './SettingsManager';
import { StorageUtils } from './StorageUtils';
import {
  StorageError,
  ConversationNotFoundError,
  MessageNotFoundError,
  FolderOperationError,
  FileOperationError,
  JsonParseError
} from './StorageErrors';

/**
 * StorageManager class for data persistence.
 * Handles saving and loading conversations, managing folders, and leveraging Obsidian's native APIs.
 */
export class StorageManager {
  private app: App;
  private plugin: Plugin;
  private settings: SettingsManager;
  private eventBus: EventBus;
  
  /**
   * Create a new StorageManager.
   * @param app Obsidian app instance
   * @param plugin Plugin instance for lifecycle management
   * @param settings Settings manager
   * @param eventBus Event bus
   */
  constructor(
    app: App,
    plugin: Plugin,
    settings: SettingsManager, 
    eventBus: EventBus
  ) {
    this.app = app;
    this.plugin = plugin;
    this.settings = settings;
    this.eventBus = eventBus;
  }
  
  /**
   * Initialize the storage manager.
   * @returns Promise that resolves when initialization is complete
   */
  public async initialize(): Promise<void> {
    // Ensure conversations folder exists
    await this.ensureConversationsFolder();
    
    // Register for Obsidian's vault events directly
    this.registerVaultEventListeners();
    
    // Register for settings changes
    this.plugin.registerEvent(
      this.eventBus.on('settings:updated', async (event) => {
        // If conversations folder changed, handle the change
        if (event.changedKeys.includes('conversationsFolder')) {
          await this.handleConversationsFolderChanged();
        }
      })
    );
  }
  
  /**
   * Register for Obsidian's native vault events.
   */
  private registerVaultEventListeners(): void {
    // Register for file creation events
    this.plugin.registerEvent(
      this.app.vault.on('create', (file: TFile) => {
        if (this.isConversationFile(file)) {
          // A new conversation file was created
          this.loadConversation(file.basename)
            .then(conversation => {
              if (conversation) {
                this.eventBus.emit('conversation:loaded', conversation);
              }
            })
            .catch(error => {
              console.error(`Error loading conversation after creation: ${error}`);
            });
        }
      })
    );
    
    // Register for file modification events
    this.plugin.registerEvent(
      this.app.vault.on('modify', (file: TFile) => {
        if (this.isConversationFile(file)) {
          // A conversation file was modified
          this.loadConversation(file.basename)
            .then(conversation => {
              if (conversation) {
                this.eventBus.emit('conversation:updated', {
                  previousConversation: conversation, // This isn't accurate but we don't have the previous state
                  currentConversation: conversation
                });
              }
            })
            .catch(error => {
              console.error(`Error loading conversation after modification: ${error}`);
            });
        }
      })
    );
    
    // Register for file deletion events
    this.plugin.registerEvent(
      this.app.vault.on('delete', (file: TFile) => {
        if (this.isConversationFile(file)) {
          // A conversation file was deleted
          this.eventBus.emit('conversation:deleted', file.basename);
        }
      })
    );
    
    // Register for file rename events
    this.plugin.registerEvent(
      this.app.vault.on('rename', (file: TFile, oldPath: string) => {
        if (this.isConversationFile(file)) {
          // A conversation file was renamed
          const oldBasename = oldPath.split('/').pop()?.replace('.json', '');
          if (oldBasename) {
            this.eventBus.emit('conversation:renamed', {
              oldId: oldBasename,
              newId: file.basename
            });
          }
        }
      })
    );
  }
  
  /**
   * Check if a file is a conversation file.
   * @param file File to check
   * @returns True if the file is a conversation file
   */
  private isConversationFile(file: TFile): boolean {
    if (!(file instanceof TFile)) return false;
    if (file.extension !== 'json') return false;
    
    const conversationsPath = this.settings.getConversationsPath();
    return file.path.startsWith(conversationsPath);
  }
  
  /**
   * Handle conversations folder change.
   */
  private async handleConversationsFolderChanged(): Promise<void> {
    // Ensure the new folder exists
    await this.ensureConversationsFolder();
    
    // Notify listeners that storage has been reloaded
    this.eventBus.emit('storage:reloaded', undefined);
  }
  
  /**
   * Ensure the conversations folder exists.
   * @returns Promise that resolves when the folder exists
   */
  private async ensureConversationsFolder(): Promise<void> {
    const path = this.settings.getConversationsPath();
    
    try {
      const folder = this.app.vault.getAbstractFileByPath(path);
      
      if (!folder) {
        // Create folder if it doesn't exist
        await this.app.vault.createFolder(path);
      } else if (!(folder instanceof TFolder)) {
        throw new FolderOperationError(path, `${path} exists but is not a folder`);
      }
    } catch (error) {
      console.error(`Failed to create conversations folder: ${error}`);
      throw new FolderOperationError(path, error.message);
    }
  }
  
  /**
   * Get all conversations.
   * @returns Promise that resolves with an array of conversations
   */
  public async getConversations(): Promise<Conversation[]> {
    const path = this.settings.getConversationsPath();
    const folder = this.app.vault.getAbstractFileByPath(path);
    
    if (!(folder instanceof TFolder)) {
      return [];
    }
    
    const conversations: Conversation[] = [];
    
    for (const file of folder.children) {
      if (file instanceof TFile && file.extension === 'json') {
        try {
          const conversation = await this.loadConversation(file.basename);
          if (conversation) {
            conversations.push(conversation);
          }
        } catch (error) {
          console.error(`Error loading conversation ${file.basename}: ${error}`);
          // Continue with other conversations
        }
      }
    }
    
    // Sort by modification date (newest first)
    return conversations.sort((a, b) => b.modifiedAt - a.modifiedAt);
  }
  
  /**
   * Get a conversation by ID.
   * @param id Conversation ID
   * @returns Promise that resolves with the conversation or null if not found
   */
  public async getConversation(id: string): Promise<Conversation | null> {
    return this.loadConversation(id);
  }
  
  /**
   * Load a conversation from disk.
   * @param id Conversation ID
   * @returns Promise that resolves with the conversation or null if not found
   */
  private async loadConversation(id: string): Promise<Conversation | null> {
    try {
      const path = `${this.settings.getConversationsPath()}/${id}.json`;
      const file = this.app.vault.getAbstractFileByPath(path);
      
      if (!(file instanceof TFile)) {
        return null;
      }
      
      const content = await this.app.vault.read(file);
      
      try {
        const conversation = JSON.parse(content) as Conversation;
        
        // Add file reference
        conversation.file = file;
        conversation.path = file.path;
        
        return conversation;
      } catch (error) {
        throw new JsonParseError(error.message);
      }
    } catch (error) {
      if (error instanceof JsonParseError) {
        throw error;
      }
      console.error(`Failed to load conversation ${id}: ${error}`);
      return null;
    }
  }
  
  /**
   * Save a conversation.
   * @param conversation Conversation to save
   * @returns Promise that resolves when the conversation is saved
   */
  public async saveConversation(conversation: Conversation): Promise<void> {
    try {
      // Update modification time
      conversation.modifiedAt = Date.now();
      
      // Path to file
      const path = `${this.settings.getConversationsPath()}/${conversation.id}.json`;
      
      // Create a copy without file reference for serialization
      const conversationToSave = { ...conversation };
      delete conversationToSave.file;
      delete conversationToSave.path;
      
      // Convert to JSON
      const content = JSON.stringify(conversationToSave, null, 2);
      
      // Check if file exists
      const file = this.app.vault.getAbstractFileByPath(path);
      
      if (file instanceof TFile) {
        // Update existing file
        await this.app.vault.modify(file, content);
      } else {
        // Create new file
        await this.app.vault.create(path, content);
      }
      
      // We don't need to emit an event here as the vault events will handle that
    } catch (error) {
      console.error(`Failed to save conversation ${conversation.id}: ${error}`);
      throw new FileOperationError(`${this.settings.getConversationsPath()}/${conversation.id}.json`, error.message);
    }
  }
  
  /**
   * Create a new conversation.
   * @param title Optional title for the conversation
   * @returns Promise that resolves with the new conversation
   */
  public async createConversation(title?: string): Promise<Conversation> {
    const conversation = ConversationUtils.createNew(title);
    
    await this.saveConversation(conversation);
    
    // Vault 'create' event will trigger the 'conversation:created' event
    return conversation;
  }
  
  /**
   * Delete a conversation.
   * @param id Conversation ID
   * @returns Promise that resolves when the conversation is deleted
   */
  public async deleteConversation(id: string): Promise<void> {
    try {
      const path = `${this.settings.getConversationsPath()}/${id}.json`;
      const file = this.app.vault.getAbstractFileByPath(path);
      
      if (file instanceof TFile) {
        await this.app.vault.delete(file);
      } else {
        throw new ConversationNotFoundError(id);
      }
      
      // Vault 'delete' event will trigger the 'conversation:deleted' event
    } catch (error) {
      if (error instanceof ConversationNotFoundError) {
        throw error;
      }
      console.error(`Failed to delete conversation ${id}: ${error}`);
      throw new FileOperationError(`${this.settings.getConversationsPath()}/${id}.json`, error.message);
    }
  }
  
  /**
   * Add a message to a conversation.
   * @param conversationId Conversation ID
   * @param message Message to add
   * @returns Promise that resolves with the updated conversation
   */
  public async addMessage(conversationId: string, message: Message): Promise<Conversation> {
    // Get conversation
    const conversation = await this.getConversation(conversationId);
    
    if (!conversation) {
      throw new ConversationNotFoundError(conversationId);
    }
    
    // Add message
    const updatedConversation = ConversationUtils.addMessage(conversation, message);
    
    // Save conversation
    await this.saveConversation(updatedConversation);
    
    // Emit a specific message event
    this.eventBus.emit('message:added', {
      conversationId,
      message
    });
    
    return updatedConversation;
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
    // Get conversation
    const conversation = await this.getConversation(conversationId);
    
    if (!conversation) {
      throw new ConversationNotFoundError(conversationId);
    }
    
    // Find message
    const messageIndex = conversation.messages.findIndex(m => m.id === messageId);
    
    if (messageIndex === -1) {
      throw new MessageNotFoundError(conversationId, messageId);
    }
    
    // Store previous content for event
    const previousContent = conversation.messages[messageIndex].content;
    
    // Create a new conversation object with the updated message
    const updatedConversation = {
      ...conversation,
      messages: [...conversation.messages],
      modifiedAt: Date.now()
    };
    
    // Update the message
    updatedConversation.messages[messageIndex] = {
      ...updatedConversation.messages[messageIndex],
      content: updatedContent
    };
    
    // Save conversation
    await this.saveConversation(updatedConversation);
    
    // Emit a specific message event
    this.eventBus.emit('message:updated', {
      conversationId,
      messageId,
      previousContent,
      currentContent: updatedContent
    });
    
    return updatedConversation;
  }
  
  /**
   * Rename a conversation.
   * Uses FileManager to ensure links are updated.
   * @param conversationId Conversation ID
   * @param newTitle New conversation title
   * @returns Promise that resolves with the updated conversation
   */
  public async renameConversation(
    conversationId: string,
    newTitle: string
  ): Promise<Conversation> {
    // Get conversation
    const conversation = await this.getConversation(conversationId);
    
    if (!conversation) {
      throw new ConversationNotFoundError(conversationId);
    }
    
    // Create a new conversation object with the updated title
    const updatedConversation = {
      ...conversation,
      title: newTitle,
      modifiedAt: Date.now()
    };
    
    // Save conversation
    await this.saveConversation(updatedConversation);
    
    return updatedConversation;
  }
  
  /**
   * Export a conversation to Markdown.
   * @param conversationId Conversation ID
   * @returns Promise that resolves when the export is complete
   */
  public async exportToMarkdown(conversationId: string): Promise<void> {
    try {
      const conversation = await this.getConversation(conversationId);
      
      if (!conversation) {
        throw new ConversationNotFoundError(conversationId);
      }
      
      await StorageUtils.exportConversation(this.app, conversation, 'markdown');
    } catch (error) {
      if (error instanceof ConversationNotFoundError) {
        throw error;
      }
      console.error(`Failed to export conversation ${conversationId}: ${error}`);
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
      const conversation = await this.getConversation(conversationId);
      
      if (!conversation) {
        throw new ConversationNotFoundError(conversationId);
      }
      
      await StorageUtils.exportConversation(this.app, conversation, 'json');
    } catch (error) {
      if (error instanceof ConversationNotFoundError) {
        throw error;
      }
      console.error(`Failed to export conversation ${conversationId}: ${error}`);
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
      const importedConversation = StorageUtils.parseJsonToConversation(json);
      
      // Generate a new ID to avoid conflicts
      const originalId = importedConversation.id;
      importedConversation.id = StorageUtils.generateId();
      
      // Update title to indicate it's an import
      if (!importedConversation.title.includes('(Import)')) {
        importedConversation.title = `${importedConversation.title} (Import)`;
      }
      
      // Save the conversation
      await this.saveConversation(importedConversation);
      
      return importedConversation;
    } catch (error) {
      console.error(`Failed to import conversation: ${error}`);
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
      const importedConversation = StorageUtils.parseMarkdownToConversation(markdown);
      
      // Save the conversation
      await this.saveConversation(importedConversation);
      
      return importedConversation;
    } catch (error) {
      console.error(`Failed to import conversation from Markdown: ${error}`);
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
      const conversation = await this.getConversation(conversationId);
      
      if (!conversation) {
        throw new ConversationNotFoundError(conversationId);
      }
      
      const backupFolder = `${this.settings.getConversationsPath()}/backups`;
      
      return await StorageUtils.backupConversation(this.app, conversation, backupFolder);
    } catch (error) {
      if (error instanceof ConversationNotFoundError) {
        throw error;
      }
      console.error(`Failed to backup conversation ${conversationId}: ${error}`);
      throw error;
    }
  }
}
