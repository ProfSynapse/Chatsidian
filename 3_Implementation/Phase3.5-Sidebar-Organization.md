---
title: Phase 3.5 - Sidebar and Organization
description: Implementing the conversation sidebar with organization capabilities
date: 2025-05-03
status: planning
tags:
  - implementation
  - phase3
  - ui
  - sidebar
  - organization
  - chat-interface
---

# Phase 3.5: Sidebar and Organization

## Overview

This microphase focuses on creating a sidebar for browsing and organizing conversations in the Chatsidian plugin. The sidebar provides a more comprehensive view of all conversations compared to the dropdown selector, with additional organization features like folders, starring, and drag-and-drop reordering.

The sidebar will be collapsible to maximize space for the chat interface when needed, while providing powerful organization tools when expanded. It will integrate with the StorageManager from Phase 1 to persist organization changes.

## Implementation Details


      attr: {
        'aria-label': 'More actions'
      }
    });
    setIcon(menuEl, 'more-horizontal');
    
    // Add event listeners
    
    // Click to select
    this.eventBus.app.registerDomEvent(conversationEl, 'click', (e: MouseEvent) => {
      // Ignore if clicking on actions
      if (actionsEl.contains(e.target as Node)) {
        return;
      }
      
      this.selectConversation(conversation.id);
    });
    
    // Context menu
    this.eventBus.app.registerDomEvent(menuEl, 'click', (e: MouseEvent) => {
      e.stopPropagation();
      this.showConversationMenu(conversation, menuEl as HTMLElement);
    });
    
    // Drag start
    this.eventBus.app.registerDomEvent(conversationEl, 'dragstart', (e: DragEvent) => {
      if (!e.dataTransfer) return;
      
      e.dataTransfer.setData('text/plain', conversation.id);
      e.dataTransfer.effectAllowed = 'move';
      
      conversationEl.addClass('chatsidian-dragging');
    });
    
    // Drag end
    this.eventBus.app.registerDomEvent(conversationEl, 'dragend', () => {
      conversationEl.removeClass('chatsidian-dragging');
    });
    
    return conversationEl;
  }
  
  private renderFolderItem(folder: ConversationFolder): HTMLElement {
    // Create folder item
    const folderEl = this.foldersSectionEl.createDiv({
      cls: 'chatsidian-folder-item'
    });
    folderEl.dataset.id = folder.id;
    
    // Create folder header
    const headerEl = folderEl.createDiv({
      cls: 'chatsidian-folder-header'
    });
    
    // Add toggle button
    const toggleEl = headerEl.createDiv({
      cls: 'chatsidian-folder-toggle'
    });
    
    // Set toggle icon based on expanded state
    if (this.expandedFolders.has(folder.id)) {
      setIcon(toggleEl, 'chevron-down');
    } else {
      setIcon(toggleEl, 'chevron-right');
    }
    
    // Add folder icon
    const iconEl = headerEl.createDiv({
      cls: 'chatsidian-item-icon'
    });
    setIcon(iconEl, 'folder');
    
    // Add title
    headerEl.createDiv({
      cls: 'chatsidian-item-title',
      text: folder.name
    });
    
    // Add actions
    const actionsEl = headerEl.createDiv({
      cls: 'chatsidian-item-actions'
    });
    
    // Add menu button
    const menuEl = actionsEl.createDiv({
      cls: 'chatsidian-item-action',
      attr: {
        'aria-label': 'More actions'
      }
    });
    setIcon(menuEl, 'more-horizontal');
    
    // Create folder content
    const contentEl = folderEl.createDiv({
      cls: 'chatsidian-folder-content'
    });
    
    // Set initial state
    if (this.expandedFolders.has(folder.id)) {
      contentEl.addClass('chatsidian-expanded');
      contentEl.removeClass('chatsidian-collapsed');
    } else {
      contentEl.addClass('chatsidian-collapsed');
      contentEl.removeClass('chatsidian-expanded');
    }
    
    // Add conversations in this folder
    const folderConversations = this.conversations.filter(c => c.folderId === folder.id);
    
    if (folderConversations.length === 0) {
      contentEl.createDiv({
        cls: 'chatsidian-empty-section',
        text: 'Empty folder'
      });
    } else {
      for (const conversation of folderConversations) {
        this.renderConversationItem(conversation, contentEl);
      }
    }
    
    // Add event listeners
    
    // Toggle folder
    this.eventBus.app.registerDomEvent(toggleEl, 'click', (e: MouseEvent) => {
      e.stopPropagation();
      this.toggleFolder(folder.id);
    });
    
    // Context menu
    this.eventBus.app.registerDomEvent(menuEl, 'click', (e: MouseEvent) => {
      e.stopPropagation();
      this.showFolderMenu(folder, menuEl as HTMLElement);
    });
    
    // Drag over
    this.eventBus.app.registerDomEvent(headerEl, 'dragover', (e: DragEvent) => {
      e.preventDefault();
      if (!e.dataTransfer) return;
      
      e.dataTransfer.dropEffect = 'move';
      
      // Add drop target class
      headerEl.addClass('chatsidian-drop-target');
    });
    
    // Drag leave
    this.eventBus.app.registerDomEvent(headerEl, 'dragleave', () => {
      headerEl.removeClass('chatsidian-drop-target');
    });
    
    // Drop
    this.eventBus.app.registerDomEvent(headerEl, 'drop', async (e: DragEvent) => {
      e.preventDefault();
      if (!e.dataTransfer) return;
      
      // Remove drop target class
      headerEl.removeClass('chatsidian-drop-target');
      
      // Get conversation ID
      const conversationId = e.dataTransfer.getData('text/plain');
      
      // Move conversation to folder
      await this.moveConversation(conversationId, folder.id);
    });
    
    return folderEl;
  }
  
  private showConversationMenu(conversation: Conversation, targetEl: HTMLElement): void {
    const menu = new Menu();
    
    // Add rename option
    menu.addItem(item => {
      item
        .setTitle('Rename')
        .setIcon('pencil')
        .onClick(() => {
          const modal = new ConversationRenameModal(
            this.app,
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
    
    // Add move options
    const moveSubmenu = menu.addSubmenu({ title: 'Move to' });
    
    // Add ungrouped option if in folder
    if (conversation.folderId) {
      moveSubmenu.addItem(item => {
        item
          .setTitle('Ungrouped')
          .setIcon('message-square')
          .onClick(() => {
            this.moveConversation(conversation.id, null);
          });
      });
    }
    
    // Add folder options
    for (const folder of this.folders) {
      // Skip current folder
      if (folder.id === conversation.folderId) {
        continue;
      }
      
      moveSubmenu.addItem(item => {
        item
          .setTitle(folder.name)
          .setIcon('folder')
          .onClick(() => {
            this.moveConversation(conversation.id, folder.id);
          });
      });
    }
    
    // Add delete option
    menu.addItem(item => {
      item
        .setTitle('Delete')
        .setIcon('trash')
        .onClick(() => {
          const modal = new ConversationDeleteModal(
            this.app,
            conversation,
            this.storage
          );
          modal.open();
        });
    });
    
    // Show menu
    menu.showAtMouseEvent(targetEl as any);
  }
  
  private showFolderMenu(folder: ConversationFolder, targetEl: HTMLElement): void {
    const menu = new Menu();
    
    // Add rename option
    menu.addItem(item => {
      item
        .setTitle('Rename')
        .setIcon('pencil')
        .onClick(() => {
          const modal = new FolderRenameModal(
            this.app,
            folder,
            this.storage
          );
          modal.open();
        });
    });
    
    // Add expand/collapse option
    if (this.expandedFolders.has(folder.id)) {
      menu.addItem(item => {
        item
          .setTitle('Collapse')
          .setIcon('chevron-right')
          .onClick(() => {
            this.toggleFolder(folder.id);
          });
      });
    } else {
      menu.addItem(item => {
        item
          .setTitle('Expand')
          .setIcon('chevron-down')
          .onClick(() => {
            this.toggleFolder(folder.id);
          });
      });
    }
    
    // Add delete option
    menu.addItem(item => {
      item
        .setTitle('Delete')
        .setIcon('trash')
        .onClick(() => {
          this.deleteFolder(folder.id);
        });
    });
    
    // Show menu
    menu.showAtMouseEvent(targetEl as any);
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
      
      // Emit event
      this.eventBus.emit('conversation:created', conversation);
      
      // Select conversation
      this.selectConversation(conversation.id);
    } catch (error) {
      console.error('Error creating conversation:', error);
      new Notice('Failed to create conversation');
    }
  }
  
  private createNewFolder(): void {
    const modal = new FolderCreateModal(
      this.app,
      this.storage
    );
    modal.open();
  }
  
  private async toggleFolder(folderId: string): Promise<void> {
    // Get folder element
    const folderEl = this.foldersSectionEl.querySelector(
      `.chatsidian-folder-item[data-id="${folderId}"]`
    );
    
    if (!folderEl) return;
    
    // Get content element
    const contentEl = folderEl.querySelector('.chatsidian-folder-content');
    if (!contentEl) return;
    
    // Get toggle element
    const toggleEl = folderEl.querySelector('.chatsidian-folder-toggle');
    if (!toggleEl) return;
    
    // Toggle state
    if (this.expandedFolders.has(folderId)) {
      // Collapse folder
      this.expandedFolders.delete(folderId);
      contentEl.addClass('chatsidian-collapsed');
      contentEl.removeClass('chatsidian-expanded');
      setIcon(toggleEl, 'chevron-right');
    } else {
      // Expand folder
      this.expandedFolders.add(folderId);
      contentEl.addClass('chatsidian-expanded');
      contentEl.removeClass('chatsidian-collapsed');
      setIcon(toggleEl, 'chevron-down');
    }
    
    // Save expanded folders
    await this.saveExpandedFolders();
  }
  
  private async saveExpandedFolders(): Promise<void> {
    try {
      // Get settings
      const settings = await this.storage.getSettings();
      
      // Update expanded folders
      settings.expandedFolders = Array.from(this.expandedFolders);
      
      // Save settings
      await this.storage.saveSettings(settings);
    } catch (error) {
      console.error('Error saving expanded folders:', error);
    }
  }
  
  private selectConversation(conversationId: string): void {
    // Update active conversation
    this.activeConversationId = conversationId;
    
    // Update UI
    this.updateActiveConversation();
    
    // Emit event
    this.eventBus.emit('conversation:selected', conversationId);
  }
  
  private updateActiveConversation(): void {
    // Remove active class from all conversations
    const items = this.containerEl.querySelectorAll('.chatsidian-conversation-item');
    items.forEach(item => {
      item.removeClass('chatsidian-active');
    });
    
    // Add active class to selected conversation
    if (this.activeConversationId) {
      const activeEl = this.containerEl.querySelector(
        `.chatsidian-conversation-item[data-id="${this.activeConversationId}"]`
      );
      
      if (activeEl) {
        activeEl.addClass('chatsidian-active');
      }
    }
  }
  
  private async toggleConversationStar(conversationId: string): Promise<void> {
    // Find conversation
    const conversation = this.conversations.find(c => c.id === conversationId);
    
    if (!conversation) return;
    
    // Toggle star
    conversation.isStarred = !conversation.isStarred;
    
    // Save to storage
    await this.storage.saveConversation(conversation);
    
    // Emit event
    this.eventBus.emit('conversation:starred', {
      id: conversationId,
      isStarred: conversation.isStarred
    });
  }
  
  private async moveConversation(conversationId: string, folderId: string | null): Promise<void> {
    // Find conversation
    const conversation = this.conversations.find(c => c.id === conversationId);
    
    if (!conversation) return;
    
    // Update folder
    conversation.folderId = folderId;
    
    // Save to storage
    await this.storage.saveConversation(conversation);
    
    // Emit event
    this.eventBus.emit('conversation:moved', {
      conversationId,
      folderId
    });
    
    // Re-render sidebar
    this.renderSidebar();
  }
  
  private async deleteFolder(folderId: string): Promise<void> {
    // Check if folder has conversations
    const folderConversations = this.conversations.filter(c => c.folderId === folderId);
    
    if (folderConversations.length > 0) {
      // Ask for confirmation
      const confirm = window.confirm(
        `This folder contains ${folderConversations.length} conversation${
          folderConversations.length === 1 ? '' : 's'
        }. Delete anyway?`
      );
      
      if (!confirm) return;
      
      // Move conversations to ungrouped
      for (const conversation of folderConversations) {
        conversation.folderId = null;
        await this.storage.saveConversation(conversation);
      }
    }
    
    // Delete folder
    await this.storage.deleteFolder(folderId);
    
    // Remove from expanded folders
    this.expandedFolders.delete(folderId);
    await this.saveExpandedFolders();
    
    // Emit event
    this.eventBus.emit('folder:deleted', folderId);
    
    // Re-render sidebar
    this.renderSidebar();
  }
  
  // Event handlers
  
  private handleConversationCreated(conversation: Conversation): void {
    // Add to list
    this.conversations.unshift(conversation);
    
    // Re-render sidebar
    this.renderSidebar();
  }
  
  private handleConversationUpdated(conversation: Conversation): void {
    // Update in list
    const index = this.conversations.findIndex(c => c.id === conversation.id);
    
    if (index !== -1) {
      this.conversations[index] = conversation;
      
      // Re-render sidebar
      this.renderSidebar();
    }
  }
  
  private handleConversationDeleted(conversationId: string): void {
    // Remove from list
    this.conversations = this.conversations.filter(c => c.id !== conversationId);
    
    // Re-render sidebar
    this.renderSidebar();
  }
  
  private handleConversationStarred(conversationId: string, isStarred: boolean): void {
    // Update in list
    const conversation = this.conversations.find(c => c.id === conversationId);
    
    if (conversation) {
      conversation.isStarred = isStarred;
      
      // Re-render sidebar
      this.renderSidebar();
    }
  }
  
  private handleConversationSelected(conversationId: string): void {
    // Update active conversation
    this.activeConversationId = conversationId;
    
    // Update UI
    this.updateActiveConversation();
  }
  
  private handleConversationMoved(conversationId: string, folderId: string | null): void {
    // Update in list
    const conversation = this.conversations.find(c => c.id === conversationId);
    
    if (conversation) {
      conversation.folderId = folderId;
      
      // Re-render sidebar
      this.renderSidebar();
    }
  }
  
  private handleFolderCreated(folder: ConversationFolder): void {
    // Add to list
    this.folders.push(folder);
    
    // Add to expanded folders
    this.expandedFolders.add(folder.id);
    this.saveExpandedFolders();
    
    // Re-render sidebar
    this.renderSidebar();
  }
  
  private handleFolderUpdated(folder: ConversationFolder): void {
    // Update in list
    const index = this.folders.findIndex(f => f.id === folder.id);
    
    if (index !== -1) {
      this.folders[index] = folder;
      
      // Re-render sidebar
      this.renderSidebar();
    }
  }
  
  private handleFolderDeleted(folderId: string): void {
    // Remove from list
    this.folders = this.folders.filter(f => f.id !== folderId);
    
    // Remove from expanded folders
    this.expandedFolders.delete(folderId);
    this.saveExpandedFolders();
    
    // Re-render sidebar
    this.renderSidebar();
  }
}
```

This component implements a comprehensive sidebar for conversation management with the following features:
1. Sections for starred, folders, and ungrouped conversations
2. Folder creation, renaming, and deletion
3. Conversation starring and organization
4. Drag-and-drop for moving conversations between folders
5. Context menus for conversation and folder actions
6. Folder expansion/collapse with state persistence

The component integrates with the `StorageManager` to persist all organization changes.

### Folder Modal Implementation

We'll create modal dialogs for folder creation and renaming:

```typescript
// src/ui/modals/FolderModal.ts
import { App, Modal, Setting } from 'obsidian';
import { ConversationFolder } from '../../models/Conversation';
import { StorageManager } from '../../core/StorageManager';

export class FolderCreateModal extends Modal {
  private storage: StorageManager;
  private folderName: string = '';
  
  constructor(app: App, storage: StorageManager) {
    super(app);
    this.storage = storage;
  }
  
  onOpen(): void {
    // Set modal title
    this.titleEl.setText('Create Folder');
    
    // Create form
    const { contentEl } = this;
    
    // Add name input
    new Setting(contentEl)
      .setName('Folder Name')
      .setDesc('Enter a name for the new folder')
      .addText(text => text
        .setValue(this.folderName)
        .onChange(value => {
          this.folderName = value;
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
    
    // Add create button
    const createButton = buttonContainer.createEl('button', {
      cls: 'chatsidian-modal-button chatsidian-modal-button-primary',
      text: 'Create'
    });
    
    createButton.addEventListener('click', () => {
      this.createFolder();
    });
    
    // Focus name input
    const inputEl = contentEl.querySelector('input');
    if (inputEl) {
      inputEl.focus();
    }
  }
  
  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
  
  async createFolder(): Promise<void> {
    // Check if name is valid
    if (!this.folderName.trim()) {
      return;
    }
    
    try {
      // Create folder
      const folder = await this.storage.createFolder({
        name: this.folderName.trim()
      });
      
      // Close modal
      this.close();
      
      // Return folder
      return folder;
    } catch (error) {
      console.error('Error creating folder:', error);
      // Show error message in modal
      const { contentEl } = this;
      const errorEl = contentEl.createDiv({
        cls: 'chatsidian-modal-error',
        text: 'Failed to create folder'
      });
      
      // Remove error after 3 seconds
      setTimeout(() => {
        errorEl.remove();
      }, 3000);
    }
  }
}

export class FolderRenameModal extends Modal {
  private folder: ConversationFolder;
  private storage: StorageManager;
  private folderName: string;
  
  constructor(app: App, folder: ConversationFolder, storage: StorageManager) {
    super(app);
    this.folder = folder;
    this.storage = storage;
    this.folderName = folder.name;
  }
  
  onOpen(): void {
    // Set modal title
    this.titleEl.setText('Rename Folder');
    
    // Create form
    const { contentEl } = this;
    
    // Add name input
    new Setting(contentEl)
      .setName('Folder Name')
      .setDesc('Enter a new name for the folder')
      .addText(text => text
        .setValue(this.folderName)
        .onChange(value => {
          this.folderName = value;
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
      this.renameFolder();
    });
    
    // Focus name input
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
  
  async renameFolder(): Promise<void> {
    // Check if name is valid
    if (!this.folderName.trim()) {
      return;
    }
    
    try {
      // Update folder
      this.folder.name = this.folderName.trim();
      
      // Save to storage
      await this.storage.saveFolder(this.folder);
      
      // Close modal
      this.close();
    } catch (error) {
      console.error('Error renaming folder:', error);
      // Show error message in modal
      const { contentEl } = this;
      const errorEl = contentEl.createDiv({
        cls: 'chatsidian-modal-error',
        text: 'Failed to rename folder'
      });
      
      // Remove error after 3 seconds
      setTimeout(() => {
        errorEl.remove();
      }, 3000);
    }
  }
}
```

These modal dialogs provide user interfaces for creating and renaming folders, following the same pattern as the conversation modal dialogs from the previous microphase.

### CSS Styling for Sidebar

Now let's add CSS styling for the sidebar:

```css
/* src/styles.css - Sidebar styling */

/* Sidebar container */
.chatsidian-sidebar-container {
  width: 250px;
  border-right: 1px solid var(--background-modifier-border);
  display: none;
  height: 100%;
  overflow-y: auto;
  background-color: var(--background-secondary);
}

.chatsidian-container.chatsidian-sidebar-open .chatsidian-sidebar-container {
  display: block;
}

.chatsidian-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 8px;
}

/* Sidebar header */
.chatsidian-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--background-modifier-border);
}

.chatsidian-sidebar-title {
  font-size: 1.1em;
  font-weight: 600;
  color: var(--text-normal);
}

.chatsidian-sidebar-actions {
  display: flex;
  align-items: center;
}

.chatsidian-sidebar-action {
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  color: var(--text-muted);
  margin-left: 4px;
}

.chatsidian-sidebar-action:hover {
  color: var(--text-normal);
  background-color: var(--background-modifier-hover);
}

/* Sections */
.chatsidian-section-wrapper {
  margin-bottom: 16px;
}

.chatsidian-section-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  color: var(--text-muted);
  font-size: 0.85em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.chatsidian-section-icon {
  margin-right: 4px;
}

.chatsidian-section-title {
  flex-grow: 1;
}

.chatsidian-section-content {
  margin-left: 4px;
}

.chatsidian-empty-section {
  color: var(--text-muted);
  font-style: italic;
  font-size: 0.9em;
  padding: 8px;
  text-align: center;
}

/* Conversation item */
.chatsidian-conversation-item {
  display: flex;
  align-items: center;
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  position: relative;
  margin-bottom: 2px;
}

.chatsidian-conversation-item:hover {
  background-color: var(--background-modifier-hover);
}

.chatsidian-conversation-item.chatsidian-active {
  background-color: var(--background-modifier-hover);
  font-weight: 500;
}

.chatsidian-item-icon {
  margin-right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.chatsidian-conversation-star {
  color: var(--text-accent);
}

.chatsidian-item-title {
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.95em;
}

.chatsidian-item-actions {
  display: none;
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
}

.chatsidian-conversation-item:hover .chatsidian-item-actions,
.chatsidian-folder-header:hover .chatsidian-item-actions {
  display: flex;
}

.chatsidian-item-action {
  padding: 4px;
  cursor: pointer;
  color: var(--text-muted);
  border-radius: 4px;
}

.chatsidian-item-action:hover {
  background-color: var(--background-modifier-hover);
  color: var(--text-normal);
}

/* Folder item */
.chatsidian-folder-item {
  margin-bottom: 4px;
}

.chatsidian-folder-header {
  display: flex;
  align-items: center;
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  position: relative;
  margin-bottom: 2px;
}

.chatsidian-folder-header:hover {
  background-color: var(--background-modifier-hover);
}

.chatsidian-folder-toggle {
  margin-right: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.chatsidian-folder-content {
  margin-left: 24px;
  transition: max-height 0.2s ease, opacity 0.2s ease;
}

.chatsidian-folder-content.chatsidian-collapsed {
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  margin-bottom: 0;
}

.chatsidian-folder-content.chatsidian-expanded {
  max-height: 1000px;
  opacity: 1;
  margin-top: 4px;
}

/* Drag and drop */
.chatsidian-dragging {
  opacity: 0.5;
}

.chatsidian-drop-target {
  background-color: var(--background-modifier-hover);
  border: 1px dashed var(--text-accent);
  border-radius: 4px;
}
```

This CSS provides styling for:
1. The sidebar container with proper width and scrolling
2. Sections for different conversation categories
3. Folder items with collapsible content
4. Conversation items with hover and active states
5. Drag and drop visual feedback
6. Context menu triggers

All styling uses Obsidian's CSS variables to ensure compatibility with different themes.

### Integration with ChatView

We need to integrate the `ConversationSidebar` component with the `ChatView`:

```typescript
// src/ui/ChatView.ts (updated for sidebar)
import { ConversationSidebar } from './ConversationSidebar';

export class ChatView extends ItemView {
  // ... existing code ...
  
  private conversationSidebar: ConversationSidebar;
  private isSidebarOpen: boolean = false;
  private sidebarToggleButton: HTMLElement;
  
  async onOpen(): Promise<void> {
    const { containerEl } = this;
    
    // Clear container
    containerEl.empty();
    containerEl.addClass('chatsidian-container');
    
    // Create main layout - sidebar and content
    this.sidebarContainerEl = containerEl.createDiv({ cls: 'chatsidian-sidebar-container' });
    this.contentContainerEl = containerEl.createDiv({ cls: 'chatsidian-content-container' });
    
    // Initialize sidebar
    this.conversationSidebar = new ConversationSidebar(
      this.sidebarContainerEl,
      this.eventBus,
      this.storage,
      this.app
    );
    
    // Create hamburger menu toggle for sidebar
    this.sidebarToggleButton = this.contentContainerEl.createDiv({ 
      cls: 'chatsidian-sidebar-toggle' 
    });
    setIcon(this.sidebarToggleButton, 'menu');
    
    // Register click handler
    this.registerDomEvent(this.sidebarToggleButton, 'click', () => {
      this.toggleSidebar();
    });
    
    // ... rest of existing code ...
    
    // Load sidebar state
    await this.loadSidebarState();
  }
  
  private async loadSidebarState(): Promise<void> {
    try {
      // Get settings
      const settings = await this.storage.getSettings();
      
      // Set sidebar state
      this.isSidebarOpen = settings.sidebarOpen || false;
      
      // Update UI
      if (this.isSidebarOpen) {
        this.containerEl.addClass('chatsidian-sidebar-open');
      } else {
        this.containerEl.removeClass('chatsidian-sidebar-open');
      }
    } catch (error) {
      console.error('Error loading sidebar state:', error);
    }
  }
  
  private async toggleSidebar(): Promise<void> {
    // Toggle state
    this.isSidebarOpen = !this.isSidebarOpen;
    
    // Update UI
    if (this.isSidebarOpen) {
      this.containerEl.addClass('chatsidian-sidebar-open');
    } else {
      this.containerEl.removeClass('chatsidian-sidebar-open');
    }
    
    // Save state
    try {
      // Get settings
      const settings = await this.storage.getSettings();
      
      // Update sidebar state
      settings.sidebarOpen = this.isSidebarOpen;
      
      // Save settings
      await this.storage.saveSettings(settings);
    } catch (error) {
      console.error('Error saving sidebar state:', error);
    }
  }
  
  // ... rest of existing code ...
}
```

This integration adds the sidebar to the chat view with:
1. Initializing the sidebar component
2. Adding a toggle button for showing/hiding the sidebar
3. Persisting the sidebar open/closed state across sessions
4. Handling sidebar toggle events

### Expanded Data Models

To fully support conversation organization, we need to extend the data models to include folder information:

```typescript
// src/models/Conversation.ts (updated)
export interface ConversationFolder {
  id: string;
  name: string;
  parentId?: string;
  createdAt: number;
  lastModified?: number;
  metadata?: {
    [key: string]: any;
  };
}

// Additional methods in StorageManager
async createFolder(folder?: Partial<ConversationFolder>): Promise<ConversationFolder>;
async getFolder(id: string): Promise<ConversationFolder | null>;
async getFolders(): Promise<ConversationFolder[]>;
async saveFolder(folder: ConversationFolder): Promise<void>;
async deleteFolder(id: string): Promise<void>;
```

The `ConversationFolder` interface defines the structure for folders, which can be nested by specifying a `parentId`. The `StorageManager` is extended with methods for creating, retrieving, updating, and deleting folders.

## Drag-and-Drop Implementation

The sidebar implements the HTML5 drag-and-drop API to allow users to organize conversations by dragging them between folders:

1. **Draggable Conversations**:
   - Each conversation item has the `draggable="true"` attribute
   - Drag events store the conversation ID in the drag data
   - Visual feedback is provided with the `chatsidian-dragging` class

2. **Drop Targets**:
   - Folder headers serve as drop targets
   - The `dragover` event allows drops by calling `preventDefault()`
   - Visual feedback is provided with the `chatsidian-drop-target` class
   - The `drop` event retrieves the conversation ID and triggers the move

3. **Conversation Moving**:
   - When a conversation is dropped on a folder, the `moveConversation` method is called
   - This updates the conversation's `folderId` and saves it to storage
   - The sidebar is then re-rendered to reflect the new organization

4. **Support for Ungrouped**:
   - Conversations can be moved out of folders by using the context menu
   - Setting the `folderId` to `null` moves a conversation to the ungrouped section

This implementation provides a natural and intuitive way for users to organize their conversations, following standard UI patterns.

## Testing Strategy

Testing for this microphase will involve:

1. **Unit Testing**:
   - Test the `ConversationSidebar` component methods
   - Verify proper event handling
   - Test folder expansion/collapse functionality

2. **Integration Testing**:
   - Test integration with `ChatView`
   - Verify sidebar toggle functionality
   - Test folder and conversation persistence

3. **Manual UI Testing**:
   - Test conversation organization with folders
   - Verify drag-and-drop functionality
   - Test folder creation, renaming, and deletion
   - Verify sidebar state persistence
   - Test with multiple folders and nested content

4. **Accessibility Testing**:
   - Verify keyboard navigation through the sidebar
   - Test screen reader compatibility
   - Check for proper focus management

## Dependencies

This microphase depends on:
- Phase 1 components (EventBus, StorageManager)
- Phase 3.1 (Core View Registration)
- Phase 3.4 (Conversation Management)
- Obsidian's Menu and Modal APIs

## Next Steps

After completing this microphase, we'll have a fully functional sidebar for browsing and organizing conversations. The next microphases will focus on:
1. Implementing agent and model selection UI
2. Adding tool call visualization
3. Creating the settings interface

## Additional Resources

- [[💻 Coding/Projects/Chatsidian/4_Documentation/UIDesignGuidelines]]
- [[💻 Coding/Documentation/Obsidian/Modal - Documentation]]
- [HTML5 Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)
