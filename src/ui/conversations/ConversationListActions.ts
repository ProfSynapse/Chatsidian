/**
 * ConversationListActions Component
 * 
 * This component handles all action operations for the conversation list:
 * - Creating, renaming, deleting conversations
 * - Creating, renaming, deleting folders
 * - Moving conversations between folders
 * - Star/unstar conversations
 * - Tag management
 * 
 * It centralizes all these actions to reduce code duplication and simplify the main component.
 */

import { App, Notice } from 'obsidian';
import { FolderCreationModal, FolderRenameModal, ConversationRenameModal } from './modals';
import { ConversationManager } from './ConversationManager';
import { FolderManager } from './FolderManager';
import { TagManager } from './TagManager';
import { EventBus } from '../../core/EventBus';
import { StorageManager } from '../../core/StorageManager';
import { Conversation } from '../../models/Conversation';

export class ConversationListActions {
  private conversationManager: ConversationManager;
  private folderManager: FolderManager;
  private tagManager: TagManager;
  private eventBus: EventBus;
  private storageManager: StorageManager;
  
  constructor(
    conversationManager: ConversationManager,
    folderManager: FolderManager,
    tagManager: TagManager,
    eventBus: EventBus,
    storageManager: StorageManager
  ) {
    this.conversationManager = conversationManager;
    this.folderManager = folderManager;
    this.tagManager = tagManager;
    this.eventBus = eventBus;
    this.storageManager = storageManager;
    
    this.registerEventHandlers();
  }
  
  /**
   * Register event handlers for custom DOM events
   */
  private registerEventHandlers(): void {
    // Create handlers for custom events
    const conversationCreateHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail;
      if (detail && detail.folderId) {
        this.createNewConversation(undefined, detail.folderId);
      } else {
        this.createNewConversation();
      }
    };
    
    const folderCreateHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail;
      if (detail && detail.parentId) {
        this.createFolder(undefined, detail.parentId);
      } else {
        this.createFolder();
      }
    };
    
    const folderMovedHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail;
      if (detail && detail.folderId && detail.targetFolderId) {
        // Handle folder moved event
        console.log(`Folder ${detail.folderId} moved to ${detail.targetFolderId}`);
        // TODO: Implement folder moving functionality
      }
    };
    
    const conversationMovedHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail;
      if (detail && detail.conversationId && detail.folderId !== undefined) {
        this.moveConversationToFolder(detail.conversationId, detail.folderId);
      }
    };
    
    // Add event listeners
    document.addEventListener('conversation:create', conversationCreateHandler);
    document.addEventListener('folder:create', folderCreateHandler);
    document.addEventListener('folder:moved', folderMovedHandler);
    document.addEventListener('conversation:moved', conversationMovedHandler);
    
    // Register cleanup function with the event bus
    this.eventBus.on('conversation-list:unload', () => {
      document.removeEventListener('conversation:create', conversationCreateHandler);
      document.removeEventListener('folder:create', folderCreateHandler);
      document.removeEventListener('folder:moved', folderMovedHandler);
      document.removeEventListener('conversation:moved', conversationMovedHandler);
    });
  }
  
  /**
   * Create a new conversation
   * 
   * @param title - Optional title for the new conversation
   * @param folderId - Optional folder ID to create the conversation in
   * @returns Promise that resolves with the new conversation
   */
  public async createNewConversation(title?: string, folderId?: string): Promise<Conversation> {
    try {
      // Create a new conversation
      const newConversation = await this.conversationManager.createNewConversation(title);
      
      // Move to folder if specified
      if (folderId) {
        await this.moveConversationToFolder(newConversation.id, folderId);
      }
      
      return newConversation;
    } catch (error) {
      console.error('Failed to create new conversation:', error);
      new Notice('Failed to create new conversation');
      throw error;
    }
  }
  
  /**
   * Select a conversation
   * 
   * @param conversationId - The ID of the conversation to select
   */
  public selectConversation(conversationId: string): void {
    this.conversationManager.selectConversation(conversationId);
  }
  
  /**
   * Rename a conversation
   * 
   * @param conversationId - The ID of the conversation to rename
   */
  public async renameConversation(conversationId: string): Promise<void> {
    try {
      // Find the conversation
      const conversation = this.conversationManager.getConversations().find(c => c.id === conversationId);
      
      if (!conversation) {
        console.error(`Conversation with ID ${conversationId} not found`);
        new Notice(`Conversation not found`);
        return;
      }
      
      // Show rename modal
      const renameModal = new ConversationRenameModal(
        this.app,
        conversation.title || "Untitled Conversation",
        async (newTitle) => {
          try {
            if (newTitle && newTitle !== conversation.title) {
              // Rename the conversation
              await this.conversationManager.renameConversation(conversationId, newTitle);
            }
          } catch (error) {
            console.error('Failed to rename conversation in modal callback:', error);
            throw error;
          }
        }
      );
      
      renameModal.open();
    } catch (error) {
      console.error('Error preparing conversation rename:', error);
      new Notice('Failed to rename conversation: ' + (error.message || ''));
    }
  }
  
  /**
   * Delete a conversation
   * 
   * @param conversationId - The ID of the conversation to delete
   */
  public async deleteConversation(conversationId: string): Promise<void> {
    // Find the conversation
    const conversation = this.conversationManager.getConversations().find(c => c.id === conversationId);
    
    if (!conversation) {
      console.error(`Conversation with ID ${conversationId} not found`);
      return;
    }
    
    // Confirm deletion
    const confirmed = confirm(`Are you sure you want to delete "${conversation.title}"?`);
    
    if (!confirmed) {
      return;
    }
    
    try {
      // Delete the conversation
      await this.conversationManager.deleteConversation(conversationId);
      
      // Force refresh tags
      this.tagManager.updateAvailableTags(this.conversationManager.getConversations());
    } catch (error) {
      console.error('Error deleting conversation:', error);
      new Notice(`Failed to delete conversation: ${error.message || ''}`);
    }
  }
  
  /**
   * Create a new folder
   * 
   * @param name - Optional name for the new folder
   * @param parentId - Optional parent folder ID
   * @returns Promise that resolves with the new folder
   */
  public async createFolder(name?: string, parentId?: string | null): Promise<any> {
    try {
      // Normalize parentId
      const actualParentId = parentId === undefined || parentId === "undefined" ? null : parentId;
      
      if (name) {
        // If name is provided, create folder directly
        const newFolder = await this.folderManager.createFolder(name, actualParentId);
        return newFolder;
      } else {
        // Show a folder creation modal dialog
        const folderModal = new FolderCreationModal(this.app, async (folderName) => {
          try {
            if (folderName) {
              const newFolder = await this.folderManager.createFolder(folderName, actualParentId);
              return newFolder;
            }
          } catch (error) {
            console.error('Failed to create folder in modal callback:', error);
            throw error;
          }
        });
        folderModal.open();
      }
    } catch (error) {
      console.error('Failed to create new folder:', error);
      new Notice('Failed to create new folder: ' + (error.message || ''));
      throw error;
    }
  }
  
  /**
   * Rename a folder
   * 
   * @param folderId - The ID of the folder to rename
   */
  public async renameFolder(folderId: string): Promise<void> {
    try {
      // Find the folder
      const folder = this.folderManager.getFolders().find(f => f.id === folderId);
      
      if (!folder) {
        console.error(`Folder with ID ${folderId} not found`);
        new Notice(`Folder not found`);
        return;
      }
      
      // Show rename modal
      const renameModal = new FolderRenameModal(
        this.app,
        folder.name,
        async (newName) => {
          try {
            if (newName && newName !== folder.name) {
              // Rename the folder
              await this.folderManager.renameFolder(folderId, newName);
            }
          } catch (error) {
            console.error('Failed to rename folder in modal callback:', error);
            throw error;
          }
        }
      );
      
      renameModal.open();
    } catch (error) {
      console.error('Error preparing folder rename:', error);
      new Notice('Failed to rename folder: ' + (error.message || ''));
    }
  }
  
  /**
   * Delete a folder
   * 
   * @param folderId - The ID of the folder to delete
   */
  public async deleteFolder(folderId: string): Promise<void> {
    // Find the folder
    const folder = this.folderManager.getFolders().find(f => f.id === folderId);
    
    if (!folder) {
      console.error(`Folder with ID ${folderId} not found`);
      return;
    }
    
    // Confirm deletion
    const confirmed = confirm(`Are you sure you want to delete "${folder.name}"? Conversations in this folder will be moved to the root level.`);
    
    if (!confirmed) {
      return;
    }
    
    // Delete the folder
    await this.folderManager.deleteFolder(folderId);
  }
  
  /**
   * Move a conversation to a folder
   * 
   * @param conversationId - The ID of the conversation to move
   * @param folderId - The ID of the folder to move to, or null to ungroup
   */
  public async moveConversationToFolder(conversationId: string, folderId: string | null): Promise<void> {
    console.log(`ConversationListActions.moveConversationToFolder: Moving conversation ${conversationId} to folder ${folderId === null ? 'null' : folderId}`);
    
    // Call FolderManager to move the conversation
    await this.folderManager.moveConversationToFolder(conversationId, folderId);
    
    // Update the conversation in the conversation manager
    const conversation = this.conversationManager.getConversations().find(c => c.id === conversationId);
    if (conversation) {
      const oldFolderId = conversation.folderId;
      conversation.folderId = folderId;
      console.log(`ConversationListActions.moveConversationToFolder: Updated in-memory conversation folderId from ${oldFolderId === undefined ? 'undefined' : oldFolderId === null ? 'null' : oldFolderId} to ${folderId === null ? 'null' : folderId}`);
      
      // Ensure the update is also saved to disk
      console.log(`ConversationListActions.moveConversationToFolder: Calling conversationManager.updateConversation`);
      await this.conversationManager.updateConversation(conversation);
    } else {
      console.error(`ConversationListActions.moveConversationToFolder: Could not find conversation ${conversationId} in memory`);
    }
    
    console.log(`ConversationListActions.moveConversationToFolder: Completed moving conversation`);
  }
  
  /**
   * Toggle the starred status of a conversation
   * 
   * @param conversationId - The ID of the conversation to star/unstar
   */
  public async toggleConversationStar(conversationId: string): Promise<void> {
    await this.conversationManager.toggleConversationStar(conversationId);
  }
  
  /**
   * Update conversation tags
   * 
   * @param conversationId - The ID of the conversation to update
   * @param tags - The new tags
   */
  public async updateConversationTags(conversationId: string, tags: string[]): Promise<void> {
    await this.tagManager.updateConversationTags(conversationId, tags);
    
    // Update the conversation in the conversation manager
    const conversation = this.conversationManager.getConversations().find(c => c.id === conversationId);
    if (conversation) {
      conversation.tags = tags;
      await this.conversationManager.updateConversation(conversation);
    }
    
    // Update available tags
    this.tagManager.updateAvailableTags(this.conversationManager.getConversations());
  }
  
  /**
   * Access to the Obsidian App instance
   */
  private get app(): App {
    // Since this plugin is running in Obsidian, the global 'app' object is available
    return (window as any).app;
  }
}