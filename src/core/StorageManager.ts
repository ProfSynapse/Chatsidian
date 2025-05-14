/**
 * Storage manager for the Chatsidian plugin.
 * 
 * This file provides the core functionality for data persistence within the Obsidian vault,
 * leveraging Obsidian's built-in APIs for file operations and event handling.
 */

import { App, TFile, TFolder, Notice, Plugin } from '../utils/obsidian-imports';
import { 
  Conversation, 
  Message, 
  MessageRole, 
  ConversationUtils, 
  ConversationFolder,
  ChatsidianData,
  ConversationMetadata
} from '../models/Conversation';
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
  private folderOperationInProgress: boolean = false;
  // In-memory cache of the plugin data
  private pluginData: ChatsidianData | null = null;
  
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
    
    // Load plugin data
    await this.loadPluginData();
    
    // Scan for existing conversations and add to index if needed
    await this.syncConversationIndex();
    
    // Remove any stale metadata entries
    await this.cleanupStaleMetadata();
    
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
    
    // Schedule the initial cleanup right away
    this.cleanupStaleMetadata().catch(err => {
      console.error('Error during initial metadata cleanup:', err);
    });
    
    // Create our own cleanup handler using the event bus
    const CLEANUP_EVENT = 'storage:cleanup-stale-metadata';
    
    // Set up the event listener that performs cleanup
    this.eventBus.on(CLEANUP_EVENT, async () => {
      try {
        await this.cleanupStaleMetadata();
      } catch (err) {
        console.error('Error during scheduled metadata cleanup:', err);
      }
    });
    
    // Set up an interval to trigger the event
    const intervalId = window.setInterval(() => {
      this.eventBus.emit(CLEANUP_EVENT, null);
    }, 30000); // Run every 30 seconds
    
    // Create a simple window event listener for cleanup
    const handleUnload = () => {
      window.clearInterval(intervalId);
    };
    
    // Add the standard window event listener which will be cleaned up by the browser
    window.addEventListener('beforeunload', handleUnload);
  }
  
  /**
   * Cleanup stale metadata entries that don't have corresponding files
   * This prevents errors with trying to operate on non-existent conversations
   */
  private async cleanupStaleMetadata(): Promise<void> {
    if (!this.pluginData) {
      return;
    }
    
    const path = this.settings.getConversationsPath();
    let hasChanges = false;
    const updatedIndex = { ...this.pluginData.conversationIndex };
    
    // Check each conversation in the index
    for (const id in updatedIndex) {
      // Use adapter.exists which is more reliable for detecting files
      const filePath = `${path}/${id}.json`;
      const fileExists = await this.app.vault.adapter.exists(filePath);
      
      // Only remove from index if the file doesn't exist according to adapter
      if (!fileExists) {
        // Remove from index
        console.warn(`Removing stale metadata for conversation ${id} (file not found)`);
        delete updatedIndex[id];
        hasChanges = true;
      }
    }
    
    // Only save updated index if changes were made
    if (hasChanges) {
      const updatedData = {
        ...this.pluginData,
        conversationIndex: updatedIndex,
        lastUpdated: Date.now()
      };
      
      await this.savePluginData(updatedData);
      
      // Only emit the event if we actually removed items (not on initial check)
      console.log(`Cleaned up ${Object.keys(this.pluginData.conversationIndex).length - Object.keys(updatedIndex).length} stale conversations`);
      this.eventBus.emit('conversations:metadata-cleaned', {
        removedCount: Object.keys(this.pluginData.conversationIndex).length - Object.keys(updatedIndex).length
      });
    }
  }
  
  /**
   * Scan for conversation files and update the index
   * This ensures any conversations created before the new storage system
   * are properly indexed
   */
  private async syncConversationIndex(): Promise<void> {
    const path = this.settings.getConversationsPath();
    const folder = this.app.vault.getAbstractFileByPath(path);
    
    if (!(folder instanceof TFolder)) {
      return;
    }
    
    // Make sure we have plugin data
    if (!this.pluginData) {
      this.pluginData = ConversationUtils.createDefaultPluginData();
    }
    
    let indexUpdated = false;
    
    // Get all existing conversation files
    for (const file of folder.children) {
      if (file instanceof TFile && file.extension === 'json' && file.basename !== 'folders') {
        const conversationId = file.basename;
        
        // Check if this conversation is already indexed
        if (this.pluginData.conversationIndex[conversationId]) {
          continue;
        }
        
        try {
          // Read the conversation file
          const content = await this.app.vault.read(file);
          const conversation = JSON.parse(content) as Conversation;
          
          // Extract metadata and add to index
          this.pluginData.conversationIndex[conversationId] = ConversationUtils.extractMetadata(conversation);
          indexUpdated = true;
        } catch (error) {
          console.warn(`Failed to index conversation ${conversationId}: ${error}`);
          // Continue with other conversations
        }
      }
    }
    
    // Save updated plugin data if any changes were made
    if (indexUpdated && this.pluginData) {
      await this.savePluginData(this.pluginData);
    }
  }
  
  /**
   * Loads plugin data from the plugin's data.json file
   * @returns Promise that resolves with the loaded data
   */
  private async loadPluginData(): Promise<ChatsidianData> {
    try {
      // Use Obsidian plugin's loadData method to get the current data
      const rawData = await this.plugin.loadData();
      
      // Create a properly typed data object
      const data = this.createCompleteData(rawData || {});
      
      // Store in memory cache
      this.pluginData = data;
      
      return data;
    } catch (error) {
      console.error("Failed to load plugin data:", error);
      // Create default structure if load fails
      const defaultData = ConversationUtils.createDefaultPluginData();
      this.pluginData = defaultData;
      return defaultData;
    }
  }
  
  /**
   * Creates a complete ChatsidianData object with all required fields
   * @param data Partial plugin data
   * @returns Complete ChatsidianData object
   */
  private createCompleteData(data: Partial<ChatsidianData>): ChatsidianData {
    return {
      folders: Array.isArray(data.folders) ? data.folders : [],
      conversationIndex: data.conversationIndex || {},
      lastUpdated: data.lastUpdated || Date.now()
    };
  }

  /**
   * Saves plugin data to the plugin's data.json file
   * @param data The data to save
   * @returns Promise that resolves when the data is saved
   */
  private async savePluginData(data: Partial<ChatsidianData>): Promise<void> {
    try {
      // Ensure all required fields exist
      const completeData = this.createCompleteData(data);
      
      // Use Obsidian plugin's saveData method to store the data
      await this.plugin.saveData(completeData);
      
      // Update in-memory cache
      this.pluginData = completeData;
    } catch (error) {
      console.error("Failed to save plugin data:", error);
      throw new StorageError("Failed to save plugin data: " + error.message);
    }
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
    
    // Re-sync the conversation index with the new folder
    await this.syncConversationIndex();
    
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
        try {
          await this.app.vault.createFolder(path);
        } catch (createError) {
          // Check if the error is just that the folder already exists
          if (createError.message && createError.message.includes("already exists")) {
            // Folder was created between our check and create attempt - this is fine
            return;
          }
          // Otherwise, rethrow the error
          throw createError;
        }
      } else if (!(folder instanceof TFolder)) {
        throw new FolderOperationError(path, `${path} exists but is not a folder`);
      }
    } catch (error) {
      if (error instanceof FolderOperationError) {
        throw error;
      }
      
      console.error(`Failed to create conversations folder: ${error}`);
      throw new FolderOperationError(path, error.message);
    }
  }
  
  /**
   * Get all conversations.
   * @returns Promise that resolves with an array of conversations
   */
  public async getConversations(): Promise<Conversation[]> {
    // Get data from memory cache or load if not available
    if (!this.pluginData) {
      this.pluginData = await this.loadPluginData();
    }
    
    if (!this.pluginData || !this.pluginData.conversationIndex) {
      return [];
    }
    
    // Get conversation IDs from index
    const conversationIds = Object.keys(this.pluginData.conversationIndex);
    
    // No conversations yet
    if (conversationIds.length === 0) {
      return [];
    }
    
    const conversations: Conversation[] = [];
    
    // Load each conversation
    for (const id of conversationIds) {
      try {
        const conversation = await this.getConversation(id);
        if (conversation) {
          conversations.push(conversation);
        }
      } catch (error) {
        console.error(`Error loading conversation ${id}: ${error}`);
        // Continue with other conversations
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
        
        // Make sure this conversation is indexed
        this.ensureConversationInIndex(conversation);
        
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
   * Ensure a conversation is included in the index
   * @param conversation Conversation to check/add to index
   */
  private async ensureConversationInIndex(conversation: Conversation): Promise<void> {
    // Get data from memory cache or load if not available
    if (!this.pluginData) {
      this.pluginData = await this.loadPluginData();
    }
    
    if (!this.pluginData) {
      // If still null, create default data
      this.pluginData = ConversationUtils.createDefaultPluginData();
    }
    
    // Check if the conversation is already in the index
    if (!this.pluginData.conversationIndex[conversation.id]) {
      // Add to index
      this.pluginData.conversationIndex[conversation.id] = ConversationUtils.extractMetadata(conversation);
      
      // Save plugin data
      await this.savePluginData(this.pluginData);
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
      
      // First check if the file exists using adapter.exists which is more reliable
      // than getAbstractFileByPath when files are being created
      const fileExists = await this.app.vault.adapter.exists(path);
      
      if (fileExists) {
        // Try to get the TFile reference
        const file = this.app.vault.getAbstractFileByPath(path);
        
        if (file instanceof TFile) {
          // Use modify if we have a valid TFile
          await this.app.vault.modify(file, content);
        } else {
          // If file exists but we can't get a TFile reference (rare race condition),
          // use the adapter to write directly
          await this.app.vault.adapter.write(path, content);
        }
      } else {
        // Create new file 
        await this.app.vault.create(path, content);
      }
      
      // We don't need to emit an event here as the vault events will handle that
    } catch (error) {
      // Handle the specific "File already exists" error that can happen in race conditions
      if (error.message && error.message.includes("File already exists")) {
        console.warn(`File already exists for ${conversation.id}, will retry with adapter.write`);
        
        try {
          // Path to file
          const path = `${this.settings.getConversationsPath()}/${conversation.id}.json`;
          
          // Create a copy without file reference for serialization
          const conversationToSave = { ...conversation };
          delete conversationToSave.file;
          delete conversationToSave.path;
          
          // Convert to JSON
          const content = JSON.stringify(conversationToSave, null, 2);
          
          // Use adapter.write as a fallback which should work even if the file exists
          await this.app.vault.adapter.write(path, content);
        } catch (retryError) {
          console.error(`Failed to save conversation on retry: ${retryError}`);
          throw new FileOperationError(`${this.settings.getConversationsPath()}/${conversation.id}.json`, 
            `Failed on retry: ${retryError.message}`);
        }
      } else {
        console.error(`Failed to save conversation ${conversation.id}: ${error}`);
        throw new FileOperationError(`${this.settings.getConversationsPath()}/${conversation.id}.json`, error.message);
      }
    }
  }
  
  /**
   * Create a new conversation.
   * @param title Optional title for the conversation
   * @returns Promise that resolves with the new conversation
   */
  public async createConversation(title?: string): Promise<Conversation> {
    // Create a new conversation object with empty messages array
    const conversation = ConversationUtils.createNew(title);
    
    try {
      // Get data from memory cache or load if not available
      if (!this.pluginData) {
        await this.loadPluginData();
      }
      
      // First update the in-memory index
      // We'll use an optimistic approach - add to index first, then create file
      const metadata = ConversationUtils.extractMetadata(conversation);
      
      const updatedData = {
        ...this.pluginData!,
        conversationIndex: {
          ...this.pluginData!.conversationIndex,
          [conversation.id]: metadata
        },
        lastUpdated: Date.now()
      };
      
      // Save plugin data
      await this.savePluginData(updatedData);
      
      // Then save the conversation to a file
      // Path to file
      const path = `${this.settings.getConversationsPath()}/${conversation.id}.json`;
      
      // Create a copy without file reference for serialization
      const conversationToSave = { ...conversation };
      delete conversationToSave.file;
      delete conversationToSave.path;
      
      // Convert to JSON
      const content = JSON.stringify(conversationToSave, null, 2);
      
      // Simple create file operation
      await this.app.vault.create(path, content);
      
      // No need to verify or get TFile reference - we'll use the conversation as-is
      // The UI only needs the conversation object without file reference
      
      // Emit creation event
      this.eventBus.emit('conversation:created', conversation);
      
      // Return the conversation object for UI to use
      return conversation;
    } catch (error) {
      // If an error occurs, clean up index entry to maintain consistency
      console.error(`Error creating conversation:`, error);
      
      try {
        // Remove from index if it was added
        if (this.pluginData && this.pluginData.conversationIndex && 
            this.pluginData.conversationIndex[conversation.id]) {
          const updatedIndex = { ...this.pluginData.conversationIndex };
          delete updatedIndex[conversation.id];
          
          const updatedData = {
            ...this.pluginData,
            conversationIndex: updatedIndex,
            lastUpdated: Date.now()
          };
          
          await this.savePluginData(updatedData);
        }
        
        // Try to delete file if it was created but index update failed
        const path = `${this.settings.getConversationsPath()}/${conversation.id}.json`;
        if (await this.app.vault.adapter.exists(path)) {
          const file = this.app.vault.getAbstractFileByPath(path);
          if (file) {
            await this.app.vault.delete(file);
          }
        }
      } catch (cleanupError) {
        // Just log cleanup errors
        console.error('Error cleaning up after failed conversation creation:', cleanupError);
      }
      
      // Re-throw the original error
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
      // Get data from memory cache or load if not available
      if (!this.pluginData) {
        await this.loadPluginData();
      }
      
      // Check if the file exists first
      const path = `${this.settings.getConversationsPath()}/${id}.json`;
      const file = this.app.vault.getAbstractFileByPath(path);
      
      // First try to delete the file if it exists
      if (file instanceof TFile) {
        await this.app.vault.delete(file);
      }
      
      // Now update the index - only AFTER file deletion was attempted
      const updatedIndex = { ...(this.pluginData!.conversationIndex || {}) };
      
      // Check if the conversation exists in the index before deleting
      if (id in updatedIndex) {
        delete updatedIndex[id];
        
        // Update plugin data
        const updatedData = {
          ...this.pluginData,
          conversationIndex: updatedIndex,
          lastUpdated: Date.now()
        };
        
        // Save plugin data
        await this.savePluginData(updatedData);
      } else if (!file) {
        // If the conversation is not in the index and the file doesn't exist,
        // log a message and return without an error
        console.warn(`Conversation ${id} not found in index or filesystem`);
        return;
      }
      
      // Emit deletion event
      this.eventBus.emit('conversation:deleted', id);
    } catch (error) {
      console.error(`Failed to delete conversation ${id}: ${error}`);
      throw new StorageError(`Failed to delete conversation: ${error.message}`);
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
   * Updates both the conversation file and the metadata index.
   * @param conversationId Conversation ID
   * @param newTitle New conversation title
   * @returns Promise that resolves with the updated conversation
   */
  public async renameConversation(
    conversationId: string,
    newTitle: string
  ): Promise<Conversation> {
    try {
      // Get data from memory cache or load if not available
      if (!this.pluginData) {
        await this.loadPluginData();
      }
      
      // First check if the conversation is in the index
      if (!this.pluginData!.conversationIndex[conversationId]) {
        throw new ConversationNotFoundError(conversationId);
      }
      
      // Get metadata from the index
      const metadata = this.pluginData!.conversationIndex[conversationId];
      
      // Check if the file exists (it might be a newly created conversation)
      const path = `${this.settings.getConversationsPath()}/${conversationId}.json`;
      
      // We'll create a conversation object regardless of whether the file exists
      let conversation: Conversation;
      const file = this.app.vault.getAbstractFileByPath(path);
      
      if (file instanceof TFile) {
        // If the file exists, load it
        try {
          const content = await this.app.vault.read(file);
          conversation = JSON.parse(content) as Conversation;
        } catch (readError) {
          console.warn(`Error reading existing conversation file, will recreate it: ${readError}`);
          // If we can't read the file, we'll create a new conversation object from metadata
          conversation = {
            id: conversationId,
            title: metadata.title,
            createdAt: metadata.createdAt,
            modifiedAt: metadata.modifiedAt,
            messages: [],
            folderId: metadata.folderId,
            tags: metadata.tags,
            isStarred: metadata.isStarred
          };
        }
      } else {
        // If the file doesn't exist yet (possibly due to async delays),
        // construct a conversation object from the metadata
        console.warn(`File for conversation ${conversationId} not found yet, creating from metadata`);
        conversation = {
          id: conversationId,
          title: metadata.title,
          createdAt: metadata.createdAt,
          modifiedAt: metadata.modifiedAt,
          messages: [],
          folderId: metadata.folderId,
          tags: metadata.tags,
          isStarred: metadata.isStarred
        };
      }
      
      // Update the title
      const updatedConversation = {
        ...conversation,
        title: newTitle,
        modifiedAt: Date.now()
      };
      
      // First update the index since we know that exists
      const updatedIndex = { ...this.pluginData!.conversationIndex };
      updatedIndex[conversationId] = {
        ...updatedIndex[conversationId],
        title: newTitle,
        modifiedAt: Date.now()
      };
      
      // Update plugin data
      const updatedData = {
        ...this.pluginData,
        conversationIndex: updatedIndex,
        lastUpdated: Date.now()
      };
      
      // Save plugin data
      await this.savePluginData(updatedData);
      
      // Then save/create the conversation file
      await this.saveConversation(updatedConversation);
      
      // Emit update event
      this.eventBus.emit('conversation:renamed', {
        conversationId,
        oldTitle: conversation.title,
        newTitle: newTitle
      });
      
      return updatedConversation;
    } catch (error) {
      console.error(`Failed to rename conversation ${conversationId}:`, error);
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
  
  /**
   * Get all conversation folders.
   * @returns Promise that resolves with an array of folders
   */
  public async getFolders(): Promise<ConversationFolder[]> {
    // Get data from memory cache or load if not available
    if (!this.pluginData) {
      this.pluginData = await this.loadPluginData();
    }
    
    if (!this.pluginData || !this.pluginData.folders) {
      return [];
    }
    
    // Return a copy of the folders array to prevent direct modification
    return [...this.pluginData.folders];
  }
  
  /**
   * Save all conversation folders.
   * @param folders Array of folders to save
   * @returns Promise that resolves when the folders are saved
   */
  private async saveFolders(folders: ConversationFolder[]): Promise<void> {
    // Use a lock to prevent concurrent access
    if (this.folderOperationInProgress) {
      // Wait a bit and retry
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.saveFolders(folders);
    }
    
    this.folderOperationInProgress = true;
    
    try {
      // First ensure the parent folder exists
      await this.ensureConversationsFolder();
      
      // Get current data
      let pluginData = this.pluginData;
      if (!pluginData) {
        pluginData = await this.loadPluginData();
      }
      
      // Update folders in plugin data
      const updatedData = {
        ...pluginData,
        folders: folders,
        lastUpdated: Date.now()
      };
      
      // Save to plugin data
      await this.savePluginData(updatedData);
      
      // Emit event on success
      this.eventBus.emit('folders:updated', folders);
    } catch (error) {
      console.error('Failed to save folders:', error);
      throw new StorageError(`Failed to save folders: ${error.message}`);
    } finally {
      // Always release the lock
      this.folderOperationInProgress = false;
    }
  }
  
  /**
   * Get a folder by ID.
   * @param id Folder ID
   * @returns Promise that resolves with the folder or null if not found
   */
  public async getFolder(id: string): Promise<ConversationFolder | null> {
    // Get data from memory cache or load if not available
    if (!this.pluginData) {
      this.pluginData = await this.loadPluginData();
    }
    
    if (!this.pluginData || !this.pluginData.folders) {
      return null;
    }
    
    return this.pluginData.folders.find(folder => folder.id === id) || null;
  }
  
  /**
   * Create a new folder.
   * @param folderData Optional partial folder data
   * @returns Promise that resolves with the new folder
   */
  public async createFolder(folderData?: Partial<ConversationFolder>): Promise<ConversationFolder> {
    // Use a lock to prevent concurrent access
    if (this.folderOperationInProgress) {
      // Wait a bit and retry
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.createFolder(folderData);
    }
    
    this.folderOperationInProgress = true;
    
    try {
      // Get data from memory cache or load if not available
      if (!this.pluginData) {
        this.pluginData = await this.loadPluginData();
      }
      
      // If still null, create default data
      if (!this.pluginData) {
        this.pluginData = ConversationUtils.createDefaultPluginData();
      }
      
      // Create new folder
      const folder = ConversationUtils.createFolder(
        folderData?.name || 'New Folder',
        folderData?.parentId || undefined
      );
      
      // Add any additional properties
      if (folderData) {
        Object.assign(folder, folderData);
      }
      
      // Create a new array with the new folder (avoid direct mutation)
      const updatedFolders = [
        ...(this.pluginData?.folders || []), 
        folder
      ];
      
      // Update plugin data
      const updatedData = {
        folders: updatedFolders,
        conversationIndex: this.pluginData?.conversationIndex,
        lastUpdated: Date.now()
      };
      
      // Save to plugin data
      await this.savePluginData(updatedData);
      
      // Emit event
      this.eventBus.emit('folder:created', folder);
      
      return folder;
    } catch (error) {
      console.error('Failed to create folder:', error);
      throw new StorageError(`Failed to create folder: ${error.message}`);
    } finally {
      // Always release the lock
      this.folderOperationInProgress = false;
    }
  }
  
  /**
   * Save a folder.
   * @param folder Folder to save
   * @returns Promise that resolves when the folder is saved
   */
  public async saveFolder(folder: ConversationFolder): Promise<void> {
    // Use a lock to prevent concurrent access
    if (this.folderOperationInProgress) {
      // Wait a bit and retry
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.saveFolder(folder);
    }
    
    this.folderOperationInProgress = true;
    
    try {
      // Get data from memory cache or load if not available
      if (!this.pluginData) {
        this.pluginData = await this.loadPluginData();
      }
      
      // If data is still null, create a default
      if (!this.pluginData) {
        this.pluginData = ConversationUtils.createDefaultPluginData();
      }
      
      const folders = this.pluginData.folders || [];
      
      // Find folder index
      const index = folders.findIndex(f => f.id === folder.id);
      
      // Create a new array with the updated folder
      let updatedFolders;
      if (index === -1) {
        // Folder doesn't exist, add it
        updatedFolders = [...folders, {
          ...folder,
          modifiedAt: Date.now()
        }];
      } else {
        // Update existing folder
        updatedFolders = [...folders];
        updatedFolders[index] = {
          ...folder,
          modifiedAt: Date.now()
        };
      }
      
      // Update plugin data
      const updatedData = {
        folders: updatedFolders,
        conversationIndex: this.pluginData.conversationIndex,
        lastUpdated: Date.now()
      };
      
      // Save to plugin data
      await this.savePluginData(updatedData);
      
      // Emit event
      this.eventBus.emit('folder:updated', folder);
    } catch (error) {
      console.error('Failed to save folder:', error);
      throw new StorageError(`Failed to save folder: ${error.message}`);
    } finally {
      // Always release the lock
      this.folderOperationInProgress = false;
    }
  }
  
  /**
   * Delete a folder.
   * @param id Folder ID
   * @returns Promise that resolves when the folder is deleted
   */
  public async deleteFolder(id: string): Promise<void> {
    // Use a lock to prevent concurrent access
    if (this.folderOperationInProgress) {
      // Wait a bit and retry
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.deleteFolder(id);
    }
    
    this.folderOperationInProgress = true;
    
    try {
      // Get data from memory cache or load if not available
      if (!this.pluginData) {
        this.pluginData = await this.loadPluginData();
      }
      
      // If data is still null, create a default
      if (!this.pluginData) {
        this.pluginData = ConversationUtils.createDefaultPluginData();
        return; // No folder to delete
      }
      
      const folders = this.pluginData.folders || [];
      
      // Find folder index
      const index = folders.findIndex(f => f.id === id);
      
      if (index === -1) {
        // Folder doesn't exist
        return;
      }
      
      // Save folder for event
      const deletedFolder = folders[index];
      
      // Create a new array without the folder
      const updatedFolders = folders.filter((_, i) => i !== index);
      
      // Update conversation index to remove folder ID from any conversations
      const updatedIndex = { ...(this.pluginData.conversationIndex || {}) };
      
      for (const convId in updatedIndex) {
        if (updatedIndex[convId].folderId === id) {
          updatedIndex[convId] = {
            ...updatedIndex[convId],
            folderId: null,
            modifiedAt: Date.now()
          };
          
          // Also need to update the conversation file
          const conversation = await this.getConversation(convId);
          if (conversation) {
            conversation.folderId = null;
            await this.saveConversation(conversation);
          }
        }
      }
      
      // Update plugin data
      const updatedData = {
        folders: updatedFolders,
        conversationIndex: updatedIndex,
        lastUpdated: Date.now()
      };
      
      // Save to plugin data
      await this.savePluginData(updatedData);
      
      // Emit event
      this.eventBus.emit('folder:deleted', id);
    } catch (error) {
      console.error('Failed to delete folder:', error);
      throw new StorageError(`Failed to delete folder: ${error.message}`);
    } finally {
      // Always release the lock
      this.folderOperationInProgress = false;
    }
  }
  
  /**
   * Move a conversation to a folder.
   * @param conversationId Conversation ID
   * @param folderId Folder ID or null to ungroup
   * @returns Promise that resolves with the updated conversation
   */
  public async moveConversationToFolder(
    conversationId: string,
    folderId: string | null
  ): Promise<Conversation> {
    // Use a lock to prevent concurrent operations
    if (this.folderOperationInProgress) {
      // Wait a bit and retry
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.moveConversationToFolder(conversationId, folderId);
    }
    
    this.folderOperationInProgress = true;
    
    try {
      // Get conversation
      const conversation = await this.getConversation(conversationId);
      
      if (!conversation) {
        throw new ConversationNotFoundError(conversationId);
      }
      
      // If folderId is not null, verify folder exists
      if (folderId !== null) {
        const folder = await this.getFolder(folderId);
        if (!folder) {
          throw new Error(`Folder with ID ${folderId} not found`);
        }
      }
      
      // Get data from memory cache or load if not available
      if (!this.pluginData) {
        this.pluginData = await this.loadPluginData();
      }
      
      // If data is still null, create a default
      if (!this.pluginData) {
        this.pluginData = ConversationUtils.createDefaultPluginData();
      }
      
      // Update conversation
      const updatedConversation = {
        ...conversation,
        folderId,
        modifiedAt: Date.now()
      };
      
      // Get or create metadata for this conversation
      const metadata = this.pluginData.conversationIndex[conversationId] || 
                       ConversationUtils.extractMetadata(conversation);
      
      // Create updated index
      const updatedIndex = { 
        ...(this.pluginData.conversationIndex || {})
      };
      
      // Update the conversation metadata
      updatedIndex[conversationId] = {
        ...metadata,
        folderId: folderId,
        modifiedAt: Date.now()
      };
      
      // Update plugin data
      const updatedData = {
        folders: this.pluginData.folders || [],
        conversationIndex: updatedIndex,
        lastUpdated: Date.now()
      };
      
      // Save plugin data
      await this.savePluginData(updatedData);
      
      // Save full conversation content to file
      await this.saveConversation(updatedConversation);
      
      // Emit event
      this.eventBus.emit('conversation:moved', {
        conversationId,
        folderId
      });
      
      return updatedConversation;
    } catch (error) {
      console.error(`Failed to move conversation ${conversationId}:`, error);
      throw error;
    } finally {
      // Always release the lock
      this.folderOperationInProgress = false;
    }
  }
  
  /**
   * Toggle the starred status of a conversation.
   * @param conversationId Conversation ID
   * @returns Promise that resolves with the updated conversation
   */
  public async toggleConversationStar(conversationId: string): Promise<Conversation> {
    // Get conversation
    const conversation = await this.getConversation(conversationId);
    
    if (!conversation) {
      throw new ConversationNotFoundError(conversationId);
    }
    
    // Toggle starred status
    const updatedConversation = {
      ...conversation,
      isStarred: !conversation.isStarred,
      modifiedAt: Date.now()
    };
    
    // Save conversation
    await this.saveConversation(updatedConversation);
    
    // Emit event
    this.eventBus.emit('conversation:starred', {
      conversationId,
      isStarred: updatedConversation.isStarred
    });
    
    return updatedConversation;
  }
  
  /**
   * Update conversation tags.
   * @param conversationId Conversation ID
   * @param tags Array of tags
   * @returns Promise that resolves with the updated conversation
   */
  public async updateConversationTags(
    conversationId: string,
    tags: string[]
  ): Promise<Conversation> {
    // Get conversation
    const conversation = await this.getConversation(conversationId);
    
    if (!conversation) {
      throw new ConversationNotFoundError(conversationId);
    }
    
    // Update tags
    const updatedConversation = {
      ...conversation,
      tags,
      modifiedAt: Date.now()
    };
    
    // Save conversation
    await this.saveConversation(updatedConversation);
    
    // Emit event
    this.eventBus.emit('conversation:tags-updated', {
      conversationId,
      tags
    });
    
    return updatedConversation;
  }
  
  /**
   * Search conversations by query.
   * @param query Search query
   * @returns Promise that resolves with matching conversations
   */
  public async searchConversations(query: string): Promise<Conversation[]> {
    // Get all conversations
    const conversations = await this.getConversations();
    
    if (!query) {
      return conversations;
    }
    
    const lowerQuery = query.toLowerCase();
    
    // Filter conversations by title, content, or tags
    return conversations.filter(conversation => {
      // Check title
      if (conversation.title.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      
      // Check tags
      if (conversation.tags && conversation.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) {
        return true;
      }
      
      // Check message content
      if (conversation.messages.some(message => message.content.toLowerCase().includes(lowerQuery))) {
        return true;
      }
      
      return false;
    });
  }
}
