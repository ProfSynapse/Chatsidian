/**
 * Conversation Manager Module
 * 
 * This module handles conversation-related operations for the conversation list:
 * - Creating conversations
 * - Renaming conversations
 * - Deleting conversations
 * - Selecting conversations
 * - Starring/unstarring conversations
 * 
 * It provides a clean API for conversation management without cluttering the main component.
 */

import { Notice } from 'obsidian';
import { Conversation } from '../../models/Conversation';
import { StorageManager } from '../../core/StorageManager';
import { EventBus } from '../../core/EventBus';
import { ConversationListEventType } from './types';

/**
 * ConversationManager class for managing conversations
 */
export class ConversationManager {
  private storageManager: StorageManager;
  private eventBus: EventBus;
  private conversations: Conversation[] = [];
  private selectedConversationId: string | null = null;
  private _isHandlingMetadataCleanup: boolean = false;
  
  /**
   * Create a new ConversationManager
   * 
   * @param storageManager - Storage manager for persisting conversations
   * @param eventBus - Event bus for component communication
   */
  constructor(storageManager: StorageManager, eventBus: EventBus) {
    this.storageManager = storageManager;
    this.eventBus = eventBus;
    
    // Listen for metadata cleanup events
    // We don't need to register this with the plugin since ConversationManager
    // will be created and destroyed with the view
    this.eventBus.on('conversations:metadata-cleaned', () => {
      console.log('Received metadata cleanup event, syncing conversations');
      
      // Set flag to prevent creation cycles
      this._isHandlingMetadataCleanup = true;
      
      // Synchronize our local conversation list with the storage manager
      this.syncWithStorageManager()
        .finally(() => {
          // Always reset the flag when done
          this._isHandlingMetadataCleanup = false;
        });
    });
  }
  
  /**
   * Synchronize the local conversation list with the storage manager
   * Removes conversations that are in our list but no longer in storage
   */
  private async syncWithStorageManager(): Promise<void> {
    try {
      // Get current conversations from storage
      const storedConversations = await this.storageManager.getConversations();
      
      // Create a set of valid IDs
      const validIds = new Set<string>();
      storedConversations.forEach(c => validIds.add(c.id));
      
      // Find conversations in our list that are no longer in storage
      const staleConversations = this.conversations.filter(c => !validIds.has(c.id));
      
      if (staleConversations.length > 0) {
        console.log(`Removing ${staleConversations.length} stale conversations from UI`);
        
        // Remove stale conversations from our list
        this.conversations = this.conversations.filter(c => validIds.has(c.id));
        
        // If selected conversation was removed, select another one
        if (this.selectedConversationId && !validIds.has(this.selectedConversationId)) {
          if (this.conversations.length > 0) {
            this.selectedConversationId = this.conversations[0].id;
            
            // Emit event for the newly selected conversation
            this.eventBus.emit(
              ConversationListEventType.CONVERSATION_SELECTED,
              this.conversations[0]
            );
          } else {
            this.selectedConversationId = null;
            
            // Only create a new conversation if not already handling a metadata cleanup
            // This prevents cycles of creation during metadata cleanup
            if (!this._isHandlingMetadataCleanup) {
              console.log('No conversations left, creating a new one');
              this.createNewConversation('New Conversation').catch(e => {
                console.error('Failed to create new conversation after sync:', e);
              });
            } else {
              console.log('Not creating new conversation during metadata cleanup to prevent cycles');
            }
          }
        }
      }
    } catch (error) {
      console.error('Error syncing with storage manager:', error);
    }
  }
  
  /**
   * Load conversations from storage
   * 
   * @returns Promise that resolves when conversations are loaded
   */
  public async loadConversations(): Promise<Conversation[]> {
    try {
      // Load conversations from storage
      const storedConversations = await this.storageManager.getConversations();
      
      if (storedConversations && storedConversations.length > 0) {
        this.conversations = storedConversations;
        
        // Set the first conversation as selected if none is selected
        if (!this.selectedConversationId && this.conversations.length > 0) {
          this.selectedConversationId = this.conversations[0].id;
        }
      } else {
        // Create a default conversation if none exist
        await this.createNewConversation('New Conversation');
      }
      
      return this.conversations;
    } catch (error) {
      console.error('Failed to load conversations:', error);
      // Create a default conversation if loading fails
      await this.createNewConversation('New Conversation');
      return this.conversations;
    }
  }
  
  /**
   * Get all conversations
   * 
   * @returns All conversations
   */
  public getConversations(): Conversation[] {
    return [...this.conversations];
  }
  
  /**
   * Get the currently selected conversation ID
   * 
   * @returns Selected conversation ID or null if none is selected
   */
  public getSelectedConversationId(): string | null {
    return this.selectedConversationId;
  }
  
  /**
   * Get the currently selected conversation
   * 
   * @returns Selected conversation or null if none is selected
   */
  public getSelectedConversation(): Conversation | null {
    if (!this.selectedConversationId) {
      return null;
    }
    
    return this.conversations.find(c => c.id === this.selectedConversationId) || null;
  }
  
  /**
   * Create a new conversation
   * 
   * @param title - Optional title for the new conversation
   * @returns Promise that resolves with the new conversation
   */
  public async createNewConversation(title?: string): Promise<Conversation> {
    try {
      // Create a new conversation using StorageManager
      // The StorageManager now ensures the file is fully written and verified
      const newTitle = title || `New Conversation ${this.conversations.length + 1}`;
      const newConversation = await this.storageManager.createConversation(newTitle);
      
      // The conversation file is now guaranteed to exist and be valid,
      // so we can safely use it without additional verification
      
      // Add to local conversations list
      this.conversations.push(newConversation);
      
      // Select the new conversation
      this.selectConversation(newConversation.id);
      
      // Emit event
      this.eventBus.emit(ConversationListEventType.CONVERSATION_CREATED, newConversation);
      
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
    // Find the conversation
    const conversation = this.conversations.find(c => c.id === conversationId);
    
    if (!conversation) {
      console.error(`Conversation with ID ${conversationId} not found`);
      return;
    }
    
    // Update selected conversation
    this.selectedConversationId = conversationId;
    
    // Emit event
    this.eventBus.emit(ConversationListEventType.CONVERSATION_SELECTED, conversation);
  }
  
  /**
   * Rename a conversation
   * 
   * @param conversationId - The ID of the conversation to rename
   * @param newTitle - The new title for the conversation
   * @returns Promise that resolves when the conversation is renamed
   */
  public async renameConversation(conversationId: string, newTitle: string): Promise<void> {
    try {
      // Find the conversation
      const conversation = this.conversations.find(c => c.id === conversationId);
      
      if (!conversation) {
        console.error(`Conversation with ID ${conversationId} not found in ConversationManager`);
        new Notice(`Cannot rename: conversation not found`);
        return;
      }
      
      if (!newTitle || newTitle === conversation.title) {
        return;
      }
      
      try {
        // Update conversation title using StorageManager
        const updatedConversation = await this.storageManager.renameConversation(conversationId, newTitle);
        
        // Update local conversation
        conversation.title = newTitle;
        
        // Emit event
        this.eventBus.emit(ConversationListEventType.CONVERSATION_RENAMED, updatedConversation);
      } catch (error) {
        // Check if this is a ConversationNotFoundError
        if (error.name === 'ConversationNotFoundError') {
          // The file doesn't exist, but we have it in the UI
          // Remove it from the conversations list
          console.warn(`Conversation ${conversationId} file not found, removing from UI`);
          const conversationIndex = this.conversations.findIndex(c => c.id === conversationId);
          
          if (conversationIndex !== -1) {
            this.conversations.splice(conversationIndex, 1);
            
            // If it was the selected conversation, select another
            if (this.selectedConversationId === conversationId) {
              if (this.conversations.length > 0) {
                this.selectedConversationId = this.conversations[0].id;
                this.eventBus.emit(
                  ConversationListEventType.CONVERSATION_SELECTED,
                  this.conversations[0]
                );
              } else {
                this.selectedConversationId = null;
                
                // Create a new conversation if none left
                this.createNewConversation('New Conversation').catch(e => {
                  console.error('Failed to create new conversation after removing invalid one:', e);
                });
              }
            }
            
            // Emit deletion event
            this.eventBus.emit(ConversationListEventType.CONVERSATION_DELETED, conversation);
          }
          
          new Notice(`Removed invalid conversation that no longer exists on disk`);
        } else {
          // Other error, let the caller handle it
          throw error;
        }
      }
    } catch (error) {
      console.error(`Failed to rename conversation ${conversationId}:`, error);
      new Notice(`Failed to rename conversation: ${error.message}`);
    }
  }
  
  /**
   * Delete a conversation
   * 
   * @param conversationId - The ID of the conversation to delete
   * @returns Promise that resolves when the conversation is deleted
   */
  public async deleteConversation(conversationId: string): Promise<void> {
    try {
      // Find the conversation
      const conversationIndex = this.conversations.findIndex(c => c.id === conversationId);
      
      if (conversationIndex === -1) {
        console.error(`Conversation with ID ${conversationId} not found in ConversationManager`);
        // Try to delete from storage anyway in case it exists there
        try {
          await this.storageManager.deleteConversation(conversationId);
        } catch (storageError) {
          // Ignore errors from storage manager - just log them
          console.warn(`Storage manager also couldn't find conversation ${conversationId}: ${storageError.message}`);
        }
        return;
      }
      
      // Get the conversation before removing it
      const deletedConversation = this.conversations[conversationIndex];
      
      try {
        // Delete the conversation using StorageManager
        await this.storageManager.deleteConversation(conversationId);
      } catch (deleteError) {
        // If the file doesn't exist, continue with UI cleanup
        if (!(deleteError instanceof Error) || 
            !deleteError.message.includes('not found')) {
          throw deleteError; // Rethrow if it's not a "not found" error
        }
        console.warn(`File for conversation ${conversationId} not found, cleaning up UI only`);
      }
      
      // Remove from local conversations list
      this.conversations.splice(conversationIndex, 1);
      
      // If we deleted the selected conversation, select another one
      if (this.selectedConversationId === conversationId) {
        if (this.conversations.length > 0) {
          // Select the previous conversation, or the first one if we deleted the first
          const newIndex = Math.max(0, conversationIndex - 1);
          this.selectedConversationId = this.conversations[newIndex].id;
          
          // Emit event for the newly selected conversation
          this.eventBus.emit(
            ConversationListEventType.CONVERSATION_SELECTED,
            this.conversations[newIndex]
          );
        } else {
          // No conversations left
          this.selectedConversationId = null;
        }
      }
      
      // Emit event
      this.eventBus.emit(ConversationListEventType.CONVERSATION_DELETED, deletedConversation);
      
      // If no conversations left, create a new one
      if (this.conversations.length === 0) {
        await this.createNewConversation('New Conversation');
      }
    } catch (error) {
      console.error(`Failed to delete conversation ${conversationId}:`, error);
      new Notice(`Failed to delete conversation: ${error.message}`);
    }
  }
  
  /**
   * Toggle the starred status of a conversation
   * 
   * @param conversationId - The ID of the conversation to star/unstar
   * @returns Promise that resolves when the conversation is starred/unstarred
   */
  public async toggleConversationStar(conversationId: string): Promise<void> {
    try {
      // Find the conversation
      const conversation = this.conversations.find(c => c.id === conversationId);
      
      if (!conversation) {
        console.error(`Conversation with ID ${conversationId} not found`);
        return;
      }
      
      // Toggle starred status
      const updatedConversation = await this.storageManager.toggleConversationStar(conversationId);
      
      // Update local conversation
      conversation.isStarred = updatedConversation.isStarred;
      
      // Emit event
      this.eventBus.emit(ConversationListEventType.CONVERSATION_STARRED, {
        conversationId,
        isStarred: updatedConversation.isStarred
      });
    } catch (error) {
      console.error(`Failed to toggle star for conversation ${conversationId}:`, error);
      new Notice(`Failed to toggle star: ${error.message}`);
    }
  }
  
  /**
   * Update a conversation in the local list and save to storage
   * 
   * @param updatedConversation - The updated conversation
   */
  public async updateConversation(updatedConversation: Conversation): Promise<void> {
    console.log(`ConversationManager.updateConversation: Updating conversation ${updatedConversation.id} with folderId ${updatedConversation.folderId === undefined ? 'undefined' : updatedConversation.folderId === null ? 'null' : updatedConversation.folderId}`);
    
    // Find the conversation
    const index = this.conversations.findIndex(c => c.id === updatedConversation.id);
    
    if (index !== -1) {
      // Update the conversation in memory
      this.conversations[index] = updatedConversation;
      
      // Also save to storage (IMPORTANT!)
      try {
        console.log(`ConversationManager.updateConversation: Saving to storage`);
        await this.storageManager.saveConversation(updatedConversation);
        console.log(`ConversationManager.updateConversation: Successfully saved to storage`);
      } catch (error) {
        console.error(`ConversationManager.updateConversation: Failed to save conversation ${updatedConversation.id} to storage:`, error);
        new Notice(`Failed to save conversation: ${error.message || 'Unknown error'}`);
      }
    } else {
      console.error(`ConversationManager.updateConversation: Conversation ${updatedConversation.id} not found in memory`);
    }
  }
}
