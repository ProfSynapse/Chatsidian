---
title: Phase 3.4 - Conversation Management UI
description: Implementing UI components for creating, selecting, and managing conversations
date: 2025-05-03
status: planning
tags:
  - implementation
  - phase3
  - ui
  - conversation-management
  - chat-interface
---

# Phase 3.4: Conversation Management UI

## Overview

This microphase focuses on creating UI components for managing conversations in the Chatsidian chat interface. These components will allow users to create new conversations, select existing ones, rename and delete conversations, and organize them with features like starring.

Conversation management is a critical aspect of the user experience, as it allows users to maintain multiple threads of discussion and easily navigate between them. The components developed in this phase will integrate with the StorageManager from Phase 1 to persist conversation data.

## Implementation Details


### ConversationSelector Component

The core component for conversation management is the `ConversationSelector`, which allows users to select from existing conversations:

```typescript
// src/ui/ConversationSelector.ts
import { setIcon, Menu, Notice } from 'obsidian';
import { EventBus } from '../core/EventBus';
import { StorageManager } from '../core/StorageManager';
import { Conversation } from '../models/Conversation';
import { ConversationRenameModal } from './modals/ConversationRenameModal';
import { ConversationDeleteModal } from './modals/ConversationDeleteModal';

export class ConversationSelector {
  private containerEl: HTMLElement;
  private eventBus: EventBus;
  private storage: StorageManager;
  private dropdownEl: HTMLElement;
  private titleEl: HTMLElement;
  private dropdownContentEl: HTMLElement;
  private conversations: Conversation[] = [];
  private activeConversationId: string | null = null;
  
  constructor(containerEl: HTMLElement, eventBus: EventBus, storage: StorageManager) {
    this.containerEl = containerEl;
    this.eventBus = eventBus;
    this.storage = storage;
    
    // Initialize UI
    this.initializeUI();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Load conversations
    this.loadConversations();
  }
  
  private initializeUI(): void {
    // Clear container
    this.containerEl.empty();
    this.containerEl.addClass('chatsidian-conversation-selector');
    
    // Create dropdown
    this.dropdownEl = this.containerEl.createDiv({
      cls: 'chatsidian-dropdown'
    });
    
    // Create title element
    this.titleEl = this.dropdownEl.createDiv({
      cls: 'chatsidian-dropdown-title'
    });
    this.titleEl.textContent = 'New Conversation';
    
    // Create dropdown arrow
    const arrowEl = this.dropdownEl.createDiv({
      cls: 'chatsidian-dropdown-arrow'
    });
    setIcon(arrowEl, 'chevron-down');
    
    // Create dropdown content
    this.dropdownContentEl = this.containerEl.createDiv({
      cls: 'chatsidian-dropdown-content'
    });
    this.dropdownContentEl.style.display = 'none';
    
    // Add "New Conversation" option
    const newConversationEl = this.dropdownContentEl.createDiv({
      cls: 'chatsidian-dropdown-item chatsidian-new-conversation'
    });
    setIcon(newConversationEl, 'plus');
    newConversationEl.createSpan({
      text: 'New Conversation'
    });
    
    // Add divider
    this.dropdownContentEl.createDiv({
      cls: 'chatsidian-dropdown-divider'
    });
  }
  
  private setupEventListeners(): void {
    // Toggle dropdown on click
    this.eventBus.app.registerDomEvent(this.dropdownEl, 'click', (e: MouseEvent) => {
      e.stopPropagation();
      this.toggleDropdown();
    });
    
    // Close dropdown when clicking outside
    this.eventBus.app.registerDomEvent(document, 'click', (e: MouseEvent) => {
      if (!this.containerEl.contains(e.target as Node)) {
        this.closeDropdown();
      }
    });
    
    // Handle new conversation click
    const newConversationEl = this.dropdownContentEl.querySelector('.chatsidian-new-conversation');
    if (newConversationEl) {
      this.eventBus.app.registerDomEvent(newConversationEl, 'click', (e: MouseEvent) => {
        e.stopPropagation();
        this.createNewConversation();
      });
    }
    
    // Listen for conversation changes
    this.eventBus.on('conversation:created', (conversation: Conversation) => {
      this.addConversation(conversation);
      this.setActiveConversation(conversation.id);
    });
    
    this.eventBus.on('conversation:updated', (conversation: Conversation) => {
      this.updateConversation(conversation);
    });
    
    this.eventBus.on('conversation:deleted', (conversationId: string) => {
      this.removeConversation(conversationId);
    });
    
    this.eventBus.on('conversation:starred', (data: { id: string, isStarred: boolean }) => {
      this.updateConversationStar(data.id, data.isStarred);
    });
  }
  
  private async loadConversations(): Promise<void> {
    try {
      // Get conversations from storage
      const conversations = await this.storage.getConversations();
      
      // Sort conversations by last modified date
      this.conversations = conversations.sort((a, b) => 
        (b.lastModified || 0) - (a.lastModified || 0)
      );
      
      // Update dropdown
      this.updateConversationsList();
      
      // Set first conversation as active if exists
      if (this.conversations.length > 0) {
        this.setActiveConversation(this.conversations[0].id);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      new Notice('Failed to load conversations');
    }
  }
  
  private updateConversationsList(): void {
    // Remove existing conversation elements
    const items = this.dropdownContentEl.querySelectorAll('.chatsidian-conversation-item');
    items.forEach(item => item.remove());
    
    // Add conversation elements
    for (const conversation of this.conversations) {
      this.addConversationElement(conversation);
    }
  }
  
  private addConversationElement(conversation: Conversation): HTMLElement {
    // Get divider element
    const divider = this.dropdownContentEl.querySelector('.chatsidian-dropdown-divider');
    
    // Create conversation element
    const conversationEl = document.createElement('div');
    conversationEl.className = 'chatsidian-dropdown-item chatsidian-conversation-item';
    conversationEl.dataset.id = conversation.id;
    
    // Add star icon if starred
    if (conversation.isStarred) {
      const starEl = document.createElement('span');
      starEl.className = 'chatsidian-conversation-star';
      setIcon(starEl, 'star');
      conversationEl.appendChild(starEl);
    }
    
    // Add title
    const titleEl = document.createElement('span');
    titleEl.className = 'chatsidian-conversation-title';
    titleEl.textContent = conversation.title || 'Untitled Conversation';
    conversationEl.appendChild(titleEl);
    
    // Add actions button
    const actionsEl = document.createElement('span');
    actionsEl.className = 'chatsidian-conversation-actions';
    setIcon(actionsEl, 'more-vertical');
    conversationEl.appendChild(actionsEl);
    
    // Add click handler
    this.eventBus.app.registerDomEvent(conversationEl, 'click', (e: MouseEvent) => {
      // If actions button was clicked, show context menu
      if (actionsEl.contains(e.target as Node)) {
        e.stopPropagation();
        this.showConversationMenu(conversation, actionsEl);
        return;
      }
      
      // Otherwise, select conversation
      e.stopPropagation();
      this.setActiveConversation(conversation.id);
      this.closeDropdown();
    });
    
    // Insert element before divider
    this.dropdownContentEl.insertBefore(conversationEl, divider.nextSibling);
    
    return conversationEl;
  }
  
  private showConversationMenu(conversation: Conversation, targetEl: HTMLElement): void {
    const menu = new Menu();
    
    // Add rename option
    menu.addItem(item => {
      item
        .setTitle('Rename')
        .setIcon('pencil')
        .onClick(() => {
          // Show rename modal
          const modal = new ConversationRenameModal(
            this.eventBus.app,
            conversation,
            this.storage
          );
          modal.open();
        });
    });
    
    // Add star/unstar option
    if (conversation.isStarred) {
      menu.addItem(item => {
        item
          .setTitle('Unstar')
          .setIcon('star-off')
          .onClick(() => {
            this.toggleConversationStar(conversation.id);
          });
      });
    } else {
      menu.addItem(item => {
        item
          .setTitle('Star')
          .setIcon('star')
          .onClick(() => {
            this.toggleConversationStar(conversation.id);
          });
      });
    }
    
    // Add delete option
    menu.addItem(item => {
      item
        .setTitle('Delete')
        .setIcon('trash')
        .onClick(() => {
          // Show delete confirmation modal
          const modal = new ConversationDeleteModal(
            this.eventBus.app,
            conversation,
            this.storage
          );
          modal.open();
        });
    });
    
    // Show menu
    menu.showAtMouseEvent(targetEl as any);
  }
  
  private toggleDropdown(): void {
    if (this.dropdownContentEl.style.display === 'none') {
      this.openDropdown();
    } else {
      this.closeDropdown();
    }
  }
  
  private openDropdown(): void {
    this.dropdownContentEl.style.display = 'block';
    this.dropdownEl.addClass('chatsidian-dropdown-open');
  }
  
  private closeDropdown(): void {
    this.dropdownContentEl.style.display = 'none';
    this.dropdownEl.removeClass('chatsidian-dropdown-open');
  }
  
  public setActiveConversation(conversationId: string): void {
    // Update active conversation
    this.activeConversationId = conversationId;
    
    // Find conversation
    const conversation = this.conversations.find(c => c.id === conversationId);
    
    if (conversation) {
      // Update title
      this.titleEl.textContent = conversation.title || 'Untitled Conversation';
      
      // Update active class on dropdown items
      const items = this.dropdownContentEl.querySelectorAll('.chatsidian-conversation-item');
      items.forEach(item => {
        if (item.dataset.id === conversationId) {
          item.addClass('chatsidian-active');
        } else {
          item.removeClass('chatsidian-active');
        }
      });
      
      // Emit event
      this.eventBus.emit('conversation:selected', conversationId);
    }
  }
  
  private async createNewConversation(): Promise<void> {
    try {
      // Create new conversation
      const conversation = await this.storage.createConversation({
        title: 'New Conversation',
        messages: [],
        createdAt: Date.now(),
        lastModified: Date.now()
      });
      
      // Add to list
      this.addConversation(conversation);
      
      // Set as active
      this.setActiveConversation(conversation.id);
      
      // Close dropdown
      this.closeDropdown();
      
      // Emit event
      this.eventBus.emit('conversation:created', conversation);
    } catch (error) {
      console.error('Error creating conversation:', error);
      new Notice('Failed to create conversation');
    }
  }
  
  private addConversation(conversation: Conversation): void {
    // Check if already exists
    const existingIndex = this.conversations.findIndex(c => c.id === conversation.id);
    
    if (existingIndex !== -1) {
      // Replace existing
      this.conversations[existingIndex] = conversation;
    } else {
      // Add to list
      this.conversations.unshift(conversation);
    }
    
    // Update dropdown
    this.updateConversationsList();
  }
  
  private updateConversation(conversation: Conversation): void {
    // Find conversation
    const index = this.conversations.findIndex(c => c.id === conversation.id);
    
    if (index !== -1) {
      // Update conversation
      this.conversations[index] = conversation;
      
      // Update element
      const conversationEl = this.dropdownContentEl.querySelector(
        `.chatsidian-conversation-item[data-id="${conversation.id}"]`
      );
      
      if (conversationEl) {
        const titleEl = conversationEl.querySelector('.chatsidian-conversation-title');
        if (titleEl) {
          titleEl.textContent = conversation.title || 'Untitled Conversation';
        }
      }
      
      // Update title if active
      if (this.activeConversationId === conversation.id) {
        this.titleEl.textContent = conversation.title || 'Untitled Conversation';
      }
    }
  }
  
  private removeConversation(conversationId: string): void {
    // Remove from list
    this.conversations = this.conversations.filter(c => c.id !== conversationId);
    
    // Remove element
    const conversationEl = this.dropdownContentEl.querySelector(
      `.chatsidian-conversation-item[data-id="${conversationId}"]`
    );
    
    if (conversationEl) {
      conversationEl.remove();
    }
    
    // If active conversation was removed, set first conversation as active
    if (this.activeConversationId === conversationId) {
      if (this.conversations.length > 0) {
        this.setActiveConversation(this.conversations[0].id);
      } else {
        this.titleEl.textContent = 'New Conversation';
        this.activeConversationId = null;
        this.eventBus.emit('conversation:selected', null);
      }
    }
  }
  
  private async toggleConversationStar(conversationId: string): Promise<void> {
    // Find conversation
    const conversation = this.conversations.find(c => c.id === conversationId);
    
    if (conversation) {
      // Toggle star
      conversation.isStarred = !conversation.isStarred;
      
      // Save to storage
      await this.storage.saveConversation(conversation);
      
      // Update element
      this.updateConversationStar(conversationId, conversation.isStarred);
      
      // Emit event
      this.eventBus.emit('conversation:starred', {
        id: conversationId,
        isStarred: conversation.isStarred
      });
      
      // Show notification
      new Notice(
        conversation.isStarred
          ? 'Conversation starred'
          : 'Conversation unstarred'
      );
    }
  }
  
  private updateConversationStar(conversationId: string, isStarred: boolean): void {
    // Find element
    const conversationEl = this.dropdownContentEl.querySelector(
      `.chatsidian-conversation-item[data-id="${conversationId}"]`
    );
    
    if (conversationEl) {
      // Find star element
      let starEl = conversationEl.querySelector('.chatsidian-conversation-star');
      
      if (isStarred) {
        // If starred and no star element, add one
        if (!starEl) {
          starEl = document.createElement('span');
          starEl.className = 'chatsidian-conversation-star';
          setIcon(starEl, 'star');
          conversationEl.insertBefore(starEl, conversationEl.firstChild);
        }
      } else {
        // If not starred and star element exists, remove it
        if (starEl) {
          starEl.remove();
        }
      }
    }
    
    // Update conversation in list
    const conversation = this.conversations.find(c => c.id === conversationId);
    if (conversation) {
      conversation.isStarred = isStarred;
    }
  }
}
```

This component implements a dropdown selector for conversations with the following features:
1. Listing all available conversations
2. Creating new conversations
3. Selecting a conversation to load
4. Context menu for renaming, starring, and deleting conversations
5. Visual indicators for starred conversations
6. Integration with the StorageManager for persistence

The component follows Obsidian's patterns for UI components, using `Menu` for context menus and `Notice` for notifications.

### Modal Dialogs for Conversation Management

We'll create modal dialogs for conversation renaming and deletion using Obsidian's `Modal` class:

```typescript
// src/ui/modals/ConversationRenameModal.ts
import { App, Modal, Setting } from 'obsidian';
import { Conversation } from '../../models/Conversation';
import { StorageManager } from '../../core/StorageManager';

export class ConversationRenameModal extends Modal {
  private conversation: Conversation;
  private storage: StorageManager;
  private newTitle: string;
  
  constructor(app: App, conversation: Conversation, storage: StorageManager) {
    super(app);
    this.conversation = conversation;
    this.storage = storage;
    this.newTitle = conversation.title || 'Untitled Conversation';
  }
  
  onOpen(): void {
    // Set modal title
    this.titleEl.setText('Rename Conversation');
    
    // Create form
    const { contentEl } = this;
    
    // Add title input
    new Setting(contentEl)
      .setName('Title')
      .setDesc('Enter a new title for this conversation')
      .addText(text => text
        .setValue(this.newTitle)
        .onChange(value => {
          this.newTitle = value;
        })
      );
    
    // Add buttons
    const buttonContainer = contentEl.createDiv({
      cls: 'chatsidian-modal-buttons'
    });
    
    // Add cancel button
    const cancelButton = buttonContainer.createEl('button', {
      cls: 'chatsidian-modal-button chatsidian-modal-button-secondary',
      text: 'Cancel'
    });
    
    cancelButton.addEventListener('click', () => {
      this.close();
    });
    
    // Add save button
    const saveButton = buttonContainer.createEl('button', {
      cls: 'chatsidian-modal-button chatsidian-modal-button-primary',
      text: 'Save'
    });
    
    saveButton.addEventListener('click', () => {
      this.save();
    });
    
    // Focus title input
    const inputEl = contentEl.querySelector('input');
    if (inputEl) {
      inputEl.focus();
      inputEl.select();
    }
  }
  
  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
  
  async save(): Promise<void> {
    // Check if title is valid
    if (!this.newTitle.trim()) {
      return;
    }
    
    try {
      // Update conversation
      this.conversation.title = this.newTitle.trim();
      this.conversation.lastModified = Date.now();
      
      // Save to storage
      await this.storage.saveConversation(this.conversation);
      
      // Close modal
      this.close();
    } catch (error) {
      console.error('Error saving conversation:', error);
      // Show error message in modal
      const { contentEl } = this;
      const errorEl = contentEl.createDiv({
        cls: 'chatsidian-modal-error',
        text: 'Failed to save conversation'
      });
      
      // Remove error after 3 seconds
      setTimeout(() => {
        errorEl.remove();
      }, 3000);
    }
  }
}

// src/ui/modals/ConversationDeleteModal.ts
import { App, Modal, Setting } from 'obsidian';
import { Conversation } from '../../models/Conversation';
import { StorageManager } from '../../core/StorageManager';

export class ConversationDeleteModal extends Modal {
  private conversation: Conversation;
  private storage: StorageManager;
  
  constructor(app: App, conversation: Conversation, storage: StorageManager) {
    super(app);
    this.conversation = conversation;
    this.storage = storage;
  }
  
  onOpen(): void {
    // Set modal title
    this.titleEl.setText('Delete Conversation');
    
    // Create form
    const { contentEl } = this;
    
    // Add warning
    contentEl.createDiv({
      cls: 'chatsidian-modal-warning',
      text: 'Are you sure you want to delete this conversation? This action cannot be undone.'
    });
    
    // Add conversation title
    contentEl.createDiv({
      cls: 'chatsidian-modal-info',
      text: `Conversation: ${this.conversation.title || 'Untitled Conversation'}`
    });
    
    // Add buttons
    const buttonContainer = contentEl.createDiv({
      cls: 'chatsidian-modal-buttons'
    });
    
    // Add cancel button
    const cancelButton = buttonContainer.createEl('button', {
      cls: 'chatsidian-modal-button chatsidian-modal-button-secondary',
      text: 'Cancel'
    });
    
    cancelButton.addEventListener('click', () => {
      this.close();
    });
    
    // Add delete button
    const deleteButton = buttonContainer.createEl('button', {
      cls: 'chatsidian-modal-button chatsidian-modal-button-danger',
      text: 'Delete'
    });
    
    deleteButton.addEventListener('click', () => {
      this.delete();
    });
  }
  
  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
  
  async delete(): Promise<void> {
    try {
      // Delete conversation
      await this.storage.deleteConversation(this.conversation.id);
      
      // Close modal
      this.close();
    } catch (error) {
      console.error('Error deleting conversation:', error);
      // Show error message in modal
      const { contentEl } = this;
      const errorEl = contentEl.createDiv({
        cls: 'chatsidian-modal-error',
        text: 'Failed to delete conversation'
      });
      
      // Remove error after 3 seconds
      setTimeout(() => {
        errorEl.remove();
      }, 3000);
    }
  }
}
```

These modal dialogs provide user interfaces for renaming and deleting conversations. They use Obsidian's `Modal` and `Setting` classes to create consistent UI elements and handle the interaction flow.

The `ConversationRenameModal` allows users to enter a new title for a conversation, while the `ConversationDeleteModal` provides a confirmation dialog before deleting a conversation.

### Integration with ChatView

We need to integrate the `ConversationSelector` component with the `ChatView`:

```typescript
// src/ui/ChatView.ts (updated for conversation management)
import { ConversationSelector } from './ConversationSelector';

export class ChatView extends ItemView {
  // ... existing code ...
  
  private conversationSelector: ConversationSelector;
  private currentConversationId: string | null = null;
  
  async onOpen(): Promise<void> {
    // ... existing setup code ...
    
    // Initialize conversation selector
    this.conversationSelector = new ConversationSelector(
      this.headerEl.createDiv({ cls: 'chatsidian-conversation-selector-container' }),
      this.eventBus,
      this.storage
    );
    
    // Register conversation events
    this.registerConversationEvents();
    
    // ... existing code ...
  }
  
  private registerConversationEvents(): void {
    // Listen for conversation selection
    this.registerEvent(
      this.eventBus.on('conversation:selected', (conversationId: string) => {
        this.loadConversation(conversationId);
      })
    );
    
    // Listen for conversation creation
    this.registerEvent(
      this.eventBus.on('conversation:created', (conversation: Conversation) => {
        this.loadConversation(conversation.id);
      })
    );
    
    // Listen for conversation deletion
    this.registerEvent(
      this.eventBus.on('conversation:deleted', (conversationId: string) => {
        if (this.currentConversationId === conversationId) {
          // If current conversation was deleted, clear messages
          this.messageList.setMessages([]);
          this.currentConversationId = null;
        }
      })
    );
  }
  
  private async loadConversation(conversationId: string): Promise<void> {
    if (!conversationId) {
      return;
    }
    
    try {
      // Get conversation from storage
      const conversation = await this.storage.getConversation(conversationId);
      
      if (!conversation) {
        console.error(`Conversation not found: ${conversationId}`);
        return;
      }
      
      // Set current conversation
      this.currentConversationId = conversationId;
      
      // Update message list
      this.messageList.setMessages(conversation.messages);
      
      // Enable input
      this.inputArea.setEnabled(true);
      this.inputArea.focus();
    } catch (error) {
      console.error('Error loading conversation:', error);
      new Notice('Failed to load conversation');
    }
  }
  
  private async handleMessageSubmit(content: string): Promise<void> {
    // ... existing code ...
    
    try {
      // Create user message
      const userMessage: Message = {
        id: this.generateId(),
        role: 'user',
        content: content,
        timestamp: Date.now()
      };
      
      // Add user message to UI
      this.messageList.addMessage(userMessage);
      
      // If no current conversation, create one
      if (!this.currentConversationId) {
        try {
          // Create new conversation
          const conversation = await this.storage.createConversation({
            title: this.generateConversationTitle(content),
            messages: [userMessage],
            createdAt: Date.now(),
            lastModified: Date.now()
          });
          
          // Set current conversation
          this.currentConversationId = conversation.id;
          
          // Emit event
          this.eventBus.emit('conversation:created', conversation);
        } catch (error) {
          console.error('Error creating conversation:', error);
          new Notice('Failed to create conversation');
          return;
        }
      } else {
        // Add message to existing conversation
        try {
          // Get conversation
          const conversation = await this.storage.getConversation(this.currentConversationId);
          
          if (!conversation) {
            console.error(`Conversation not found: ${this.currentConversationId}`);
            return;
          }
          
          // Add message
          conversation.messages.push(userMessage);
          conversation.lastModified = Date.now();
          
          // Save conversation
          await this.storage.saveConversation(conversation);
        } catch (error) {
          console.error('Error updating conversation:', error);
          new Notice('Failed to save message');
          return;
        }
      }
      
      // ... rest of existing code ...
    } catch (error) {
      // ... existing error handling ...
    }
  }
  
  private generateConversationTitle(content: string): string {
    // Generate a title based on the first message
    // Limit to first 30 characters of first line
    const firstLine = content.split('\n')[0].trim();
    const title = firstLine.length > 30
      ? firstLine.substring(0, 30) + '...'
      : firstLine;
    
    return title || 'New Conversation';
  }
}
```

This integration adds the following functionality:
1. Displaying the conversation selector in the header
2. Loading conversations when selected
3. Creating new conversations when needed
4. Saving messages to the current conversation
5. Handling conversation deletion

The implementation ensures that conversations are properly managed and persisted through the StorageManager.

### CSS Styling for Conversation Management

We'll add CSS styling for the conversation management components:

```css
/* src/styles.css - Conversation management styling */

/* Conversation selector */
.chatsidian-conversation-selector-container {
  flex-grow: 1;
  margin-right: 16px;
}

.chatsidian-conversation-selector {
  position: relative;
}

/* Dropdown */
.chatsidian-dropdown {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  background-color: var(--background-modifier-form-field);
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.chatsidian-dropdown:hover,
.chatsidian-dropdown-open {
  border-color: var(--interactive-accent);
}

.chatsidian-dropdown-title {
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 8px;
}

.chatsidian-dropdown-arrow {
  color: var(--text-muted);
}

.chatsidian-dropdown-open .chatsidian-dropdown-arrow {
  color: var(--text-normal);
}

/* Dropdown content */
.chatsidian-dropdown-content {
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  max-height: 300px;
  overflow-y: auto;
  margin-top: 4px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  background-color: var(--background-primary);
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* Dropdown items */
.chatsidian-dropdown-item {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  cursor: pointer;
}

.chatsidian-dropdown-item:hover {
  background-color: var(--background-modifier-hover);
}

.chatsidian-dropdown-item.chatsidian-active {
  background-color: var(--background-modifier-hover);
  font-weight: 500;
}

.chatsidian-dropdown-divider {
  height: 1px;
  background-color: var(--background-modifier-border);
  margin: 4px 0;
}

/* New conversation option */
.chatsidian-new-conversation {
  color: var(--interactive-accent);
}

.chatsidian-new-conversation svg {
  margin-right: 8px;
}

/* Conversation item */
.chatsidian-conversation-item {
  justify-content: space-between;
}

.chatsidian-conversation-star {
  margin-right: 6px;
  color: var(--text-accent);
}

.chatsidian-conversation-title {
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chatsidian-conversation-actions {
  color: var(--text-muted);
  opacity: 0.7;
  transition: opacity 0.15s ease;
}

.chatsidian-conversation-item:hover .chatsidian-conversation-actions {
  opacity: 1;
}

/* Modal styles */
.chatsidian-modal-buttons {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.chatsidian-modal-button {
  padding: 6px 12px;
  border-radius: 4px;
  margin-left: 8px;
  cursor: pointer;
  font-size: 0.9em;
  border: none;
}

.chatsidian-modal-button-primary {
  background-color: var(--interactive-accent);
  color: var(--text-on-accent);
}

.chatsidian-modal-button-secondary {
  background-color: var(--background-modifier-form-field);
  color: var(--text-normal);
}

.chatsidian-modal-button-danger {
  background-color: var(--text-error);
  color: white;
}

.chatsidian-modal-warning {
  color: var(--text-error);
  margin-bottom: 16px;
}

.chatsidian-modal-info {
  margin-bottom: 16px;
}

.chatsidian-modal-error {
  color: var(--text-error);
  margin-top: 16px;
  font-size: 0.9em;
}
```

This CSS provides styling for:
1. The conversation dropdown selector
2. Conversation list items with star indicators
3. New conversation option
4. Modal dialogs for renaming and deletion
5. Button styles for different actions

All styling uses Obsidian's CSS variables to ensure compatibility with different themes.

## Conversation Data Model

The conversation components rely on the `Conversation` model defined in Phase 1. For reference, here's the model structure:

```typescript
// src/models/Conversation.ts
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  lastModified?: number;
  isStarred?: boolean;
  folderId?: string;
  modelId?: string;
  metadata?: {
    [key: string]: any;
  };
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  metadata?: {
    [key: string]: any;
  };
}

// Tool call interfaces (will be implemented in later phases)
export interface ToolCall {
  id: string;
  name: string;
  arguments: any;
  status: 'pending' | 'running' | 'done' | 'error';
}

export interface ToolResult {
  toolCallId: string;
  content: any;
  error?: string;
}
```

This model provides the data structure for conversations, messages, and tool interactions. The conversation management components in this phase primarily work with the `Conversation` interface.

## Integration with StorageManager

The conversation components integrate with the `StorageManager` from Phase 1 to persist and retrieve conversation data. The key methods used are:

```typescript
// src/core/StorageManager.ts (reference methods)
async getConversations(): Promise<Conversation[]>;
async getConversation(id: string): Promise<Conversation | null>;
async createConversation(conversation?: Partial<Conversation>): Promise<Conversation>;
async saveConversation(conversation: Conversation): Promise<void>;
async deleteConversation(id: string): Promise<void>;
```

These methods handle the storage and retrieval of conversations in the Obsidian vault. The `StorageManager` is responsible for generating unique IDs, handling file operations, and managing the conversation data structure.

## Testing Strategy

Testing for this microphase will involve:

1. **Unit Testing**:
   - Test the `ConversationSelector` component methods
   - Verify proper event handling
   - Test modal dialog functionality

2. **Integration Testing**:
   - Test integration with `ChatView`
   - Verify conversation loading and saving
   - Test message persistence within conversations

3. **Manual UI Testing**:
   - Test conversation selection from dropdown
   - Verify conversation creation works
   - Test renaming and deletion through modals
   - Verify starring functionality
   - Test with multiple conversations
   - Verify proper conversation switching

4. **Storage Testing**:
   - Verify conversations are properly saved to storage
   - Test loading conversations from storage
   - Verify conversation updates are persisted

## Accessibility Considerations

For accessibility, we need to ensure:

1. **Keyboard Navigation**:
   - The dropdown can be operated via keyboard
   - Modal dialogs are properly focusable
   - Tab order is logical and complete

2. **Screen Reader Support**:
   - Add appropriate ARIA attributes to dropdown
   - Ensure modals are announced properly
   - Provide context for actions

```typescript
// src/ui/ConversationSelector.ts (accessibility enhancements)
private initializeUI(): void {
  // ... existing code ...
  
  // Add ARIA attributes for accessibility
  this.dropdownEl.setAttribute('role', 'button');
  this.dropdownEl.setAttribute('aria-haspopup', 'true');
  this.dropdownEl.setAttribute('aria-expanded', 'false');
  this.dropdownEl.setAttribute('tabindex', '0');
  
  this.dropdownContentEl.setAttribute('role', 'listbox');
  this.dropdownContentEl.setAttribute('aria-label', 'Conversations');
  
  // ... rest of existing code ...
}

private toggleDropdown(): void {
  if (this.dropdownContentEl.style.display === 'none') {
    this.openDropdown();
  } else {
    this.closeDropdown();
  }
  
  // Update ARIA attributes
  this.dropdownEl.setAttribute('aria-expanded', 
    this.dropdownContentEl.style.display !== 'none' ? 'true' : 'false'
  );
}
```

These enhancements improve the accessibility of the conversation management UI.

## Dependencies

This microphase depends on:
- Phase 1 components (EventBus, StorageManager)
- Phase 3.1 (Core View Registration)
- Phase 3.2 (Message Display)
- Phase 3.3 (Input Area)

## Next Steps

After completing this microphase, we'll have a fully functional conversation management interface. The next microphases will focus on:
1. Building the conversation sidebar with folder organization
2. Implementing agent and model selection
3. Adding tool call visualization

## Additional Resources

- [[💻 Coding/Projects/Chatsidian/4_Documentation/UIDesignGuidelines]]
- [[💻 Coding/Documentation/Obsidian/Modal - Documentation]]
- [Obsidian Menu API Documentation](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts#L3880)
