/**
 * Mock ConversationList for testing
 * 
 * This file provides a mock implementation of the ConversationList component
 * for use in integration tests. It simplifies the behavior of the real component
 * to make testing easier and more predictable.
 * 
 * @file This file defines a mock ConversationList for testing.
 */

import { Component } from '../../tests/mocks/obsidian';
import { EventBus } from '../../src/core/EventBus';
import { StorageManager } from '../../src/core/StorageManager';
import { Conversation } from '../../src/models/Conversation';
import { ConversationListEventType } from '../../src/ui/ConversationList';

/**
 * Mock ConversationList component for testing
 */
export class MockConversationList extends Component {
  /**
   * Container element for the conversation list
   */
  private containerEl: HTMLElement;
  
  /**
   * Event bus for component communication
   */
  private eventBus: EventBus;
  
  /**
   * Storage manager for persisting conversations
   */
  private storageManager: StorageManager;
  
  /**
   * List of conversations
   */
  private conversations: Conversation[] = [];
  
  /**
   * Currently selected conversation ID
   */
  private selectedConversationId: string | null = null;
  
  /**
   * Constructor for the MockConversationList
   * 
   * @param containerEl - The container element to render the conversation list in
   * @param eventBus - The event bus for component communication
   * @param storageManager - The storage manager for persisting conversations
   */
  constructor(containerEl: HTMLElement, eventBus: EventBus, storageManager: StorageManager) {
    super();
    this.containerEl = containerEl;
    this.eventBus = eventBus;
    this.storageManager = storageManager;
    
    // Load conversations but don't create a default one
    this.loadConversations();
  }
  
  /**
   * Load conversations from storage
   */
  private async loadConversations(): Promise<void> {
    try {
      // Load conversations from storage
      const storedConversations = await this.storageManager.getConversations();
      
      if (storedConversations && storedConversations.length > 0) {
        this.conversations = storedConversations;
        
        // Set the first conversation as selected if none is selected
        if (!this.selectedConversationId && this.conversations.length > 0) {
          this.selectedConversationId = this.conversations[0].id;
        }
      }
      
      // Render the conversations
      this.render();
      
      // Wait for DOM to update
      await new Promise(resolve => setTimeout(resolve, 0));
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  }
  
  /**
   * Render the conversation list
   */
  private render(): void {
    this.containerEl.empty();
    this.containerEl.addClass('chatsidian-conversation-list');
    
    // Create header with title and new conversation button
    const headerEl = this.containerEl.createDiv({ cls: 'chatsidian-conversation-list-header' });
    
    const titleEl = headerEl.createDiv({ cls: 'chatsidian-conversation-list-title' });
    titleEl.setText('Conversations');
    
    const newButtonEl = headerEl.createDiv({ cls: 'chatsidian-conversation-new-button' });
    newButtonEl.innerHTML = '<svg class="icon plus"><use xlink:href="#plus"></use></svg>';
    newButtonEl.setAttribute('aria-label', 'New Conversation');
    newButtonEl.addEventListener('click', () => this.createNewConversation());
    
    // Create conversation list container
    const listContainerEl = this.containerEl.createDiv({ cls: 'chatsidian-conversation-list-container' });
    
    // Render conversations
    if (this.conversations.length === 0) {
      const emptyEl = listContainerEl.createDiv({ cls: 'chatsidian-conversation-list-empty' });
      emptyEl.setText('No conversations yet');
    } else {
      this.conversations.forEach(conversation => {
        this.renderConversationItem(listContainerEl, conversation);
      });
    }
  }
  
  /**
   * Render a single conversation item
   * 
   * @param containerEl - The container element to render the conversation item in
   * @param conversation - The conversation to render
   */
  private renderConversationItem(containerEl: HTMLElement, conversation: Conversation): void {
    const itemEl = containerEl.createDiv({ cls: 'chatsidian-conversation-item' });
    
    // Add selected class if this is the selected conversation
    if (conversation.id === this.selectedConversationId) {
      itemEl.addClass('chatsidian-conversation-item-selected');
    }
    
    // Create title element
    const titleEl = itemEl.createDiv({ cls: 'chatsidian-conversation-item-title' });
    titleEl.setText(conversation.title);
    
    // Create menu button
    const menuButtonEl = itemEl.createDiv({ cls: 'chatsidian-conversation-item-menu' });
    menuButtonEl.innerHTML = '<svg class="icon more-vertical"><use xlink:href="#more-vertical"></use></svg>';
    
    // Add click handler to select conversation
    itemEl.addEventListener('click', (event) => {
      // Ignore clicks on the menu button
      if (event.target === menuButtonEl || menuButtonEl.contains(event.target as Node)) {
        return;
      }
      
      this.selectConversation(conversation.id);
    });
  }
  
  /**
   * Create a new conversation
   * 
   * @param title - Optional title for the new conversation
   * @returns The new conversation
   */
  public async createNewConversation(title?: string): Promise<Conversation> {
    try {
      // Create a new conversation using StorageManager
      const newTitle = title || `New Conversation ${this.conversations.length + 1}`;
      const newConversation = await this.storageManager.createConversation(newTitle);
      
      // Add to local conversations list
      this.conversations.push(newConversation);
      
      // Render the updated list
      this.render();
      
      // Select the new conversation
      this.selectConversation(newConversation.id);
      
      // Emit event
      this.eventBus.emit(ConversationListEventType.CONVERSATION_CREATED, newConversation);
      
      return newConversation;
    } catch (error) {
      console.error('Failed to create new conversation:', error);
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
    
    // Render the updated list
    this.render();
    
    // Emit event
    this.eventBus.emit(ConversationListEventType.CONVERSATION_SELECTED, conversation);
  }
  
  /**
   * Get the currently selected conversation
   * 
   * @returns The currently selected conversation, or null if none is selected
   */
  public getSelectedConversation(): Conversation | null {
    if (!this.selectedConversationId) {
      return null;
    }
    
    return this.conversations.find(c => c.id === this.selectedConversationId) || null;
  }
  
  /**
   * Get all conversations
   * 
   * @returns All conversations
   */
  public getConversations(): Conversation[] {
    return [...this.conversations];
  }
}
