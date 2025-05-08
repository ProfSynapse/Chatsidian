/**
 * Tag Manager Module
 * 
 * This module handles tag-related operations for the conversation list:
 * - Adding tags to conversations
 * - Removing tags from conversations
 * - Tracking available tags
 * - Tag selection for filtering
 * 
 * It provides a clean API for tag management without cluttering the main component.
 */

import { Notice } from 'obsidian';
import { Conversation } from '../../models/Conversation';
import { StorageManager } from '../../core/StorageManager';
import { EventBus } from '../../core/EventBus';
import { ConversationListEventType } from './types';

/**
 * TagManager class for managing conversation tags
 */
export class TagManager {
  private storageManager: StorageManager;
  private eventBus: EventBus;
  private availableTags: Set<string> = new Set();
  private selectedTag: string | null = null;
  
  /**
   * Create a new TagManager
   * 
   * @param storageManager - Storage manager for persisting tags
   * @param eventBus - Event bus for component communication
   */
  constructor(storageManager: StorageManager, eventBus: EventBus) {
    this.storageManager = storageManager;
    this.eventBus = eventBus;
  }
  
  /**
   * Update available tags from conversations
   * 
   * @param conversations - All conversations
   */
  public updateAvailableTags(conversations: Conversation[]): void {
    this.availableTags.clear();
    
    for (const conversation of conversations) {
      if (conversation.tags) {
        for (const tag of conversation.tags) {
          this.availableTags.add(tag);
        }
      }
    }
  }
  
  /**
   * Get all available tags
   * 
   * @returns Set of available tags
   */
  public getAvailableTags(): Set<string> {
    return new Set(this.availableTags);
  }
  
  /**
   * Get the currently selected tag
   * 
   * @returns Selected tag or null if none is selected
   */
  public getSelectedTag(): string | null {
    return this.selectedTag;
  }
  
  /**
   * Set the selected tag
   * 
   * @param tag - Tag to select, or null to clear selection
   */
  public setSelectedTag(tag: string | null): void {
    this.selectedTag = tag;
  }
  
  /**
   * Update conversation tags
   * 
   * @param conversationId - The ID of the conversation to update
   * @param tags - The new tags
   * @returns Promise that resolves when the tags are updated
   */
  public async updateConversationTags(conversationId: string, tags: string[]): Promise<void> {
    try {
      // Update tags
      const updatedConversation = await this.storageManager.updateConversationTags(
        conversationId,
        tags
      );
      
      // Update available tags
      for (const tag of tags) {
        this.availableTags.add(tag);
      }
      
      // Emit event
      this.eventBus.emit(ConversationListEventType.CONVERSATION_TAGGED, {
        conversationId,
        tags
      });
    } catch (error) {
      console.error(`Failed to update tags for conversation ${conversationId}:`, error);
      new Notice(`Failed to update tags: ${error.message}`);
    }
  }
  
  /**
   * Add a tag to a conversation
   * 
   * @param conversationId - The ID of the conversation to update
   * @param tag - The tag to add
   * @returns Promise that resolves when the tag is added
   */
  public async addTag(conversationId: string, tag: string): Promise<void> {
    try {
      // Get conversation
      const conversation = await this.storageManager.getConversation(conversationId);
      
      if (!conversation) {
        console.error(`Conversation with ID ${conversationId} not found`);
        return;
      }
      
      // Create tags array if it doesn't exist
      const tags = conversation.tags || [];
      
      // Check if tag already exists
      if (tags.includes(tag)) {
        return;
      }
      
      // Add tag
      tags.push(tag);
      
      // Update tags
      await this.updateConversationTags(conversationId, tags);
      
      // Add to available tags
      this.availableTags.add(tag);
    } catch (error) {
      console.error(`Failed to add tag to conversation ${conversationId}:`, error);
      new Notice(`Failed to add tag: ${error.message}`);
    }
  }
  
  /**
   * Remove a tag from a conversation
   * 
   * @param conversationId - The ID of the conversation to update
   * @param tag - The tag to remove
   * @returns Promise that resolves when the tag is removed
   */
  public async removeTag(conversationId: string, tag: string): Promise<void> {
    try {
      // Get conversation
      const conversation = await this.storageManager.getConversation(conversationId);
      
      if (!conversation) {
        console.error(`Conversation with ID ${conversationId} not found`);
        return;
      }
      
      // Check if conversation has tags
      if (!conversation.tags || !conversation.tags.includes(tag)) {
        return;
      }
      
      // Remove tag
      const tags = conversation.tags.filter(t => t !== tag);
      
      // Update tags
      await this.updateConversationTags(conversationId, tags);
      
      // Check if tag is still used in any conversation
      // If not, remove from available tags
      const conversations = await this.storageManager.getConversations();
      const tagStillUsed = conversations.some(c => c.tags && c.tags.includes(tag));
      
      if (!tagStillUsed) {
        this.availableTags.delete(tag);
        
        // If this was the selected tag, clear selection
        if (this.selectedTag === tag) {
          this.selectedTag = null;
        }
      }
    } catch (error) {
      console.error(`Failed to remove tag from conversation ${conversationId}:`, error);
      new Notice(`Failed to remove tag: ${error.message}`);
    }
  }
  
  /**
   * Toggle a tag on a conversation
   * 
   * @param conversationId - The ID of the conversation to update
   * @param tag - The tag to toggle
   * @returns Promise that resolves when the tag is toggled
   */
  public async toggleTag(conversationId: string, tag: string): Promise<void> {
    try {
      // Get conversation
      const conversation = await this.storageManager.getConversation(conversationId);
      
      if (!conversation) {
        console.error(`Conversation with ID ${conversationId} not found`);
        return;
      }
      
      // Check if conversation has tags
      if (!conversation.tags || !conversation.tags.includes(tag)) {
        // Tag doesn't exist, add it
        await this.addTag(conversationId, tag);
      } else {
        // Tag exists, remove it
        await this.removeTag(conversationId, tag);
      }
    } catch (error) {
      console.error(`Failed to toggle tag on conversation ${conversationId}:`, error);
      new Notice(`Failed to toggle tag: ${error.message}`);
    }
  }
}
