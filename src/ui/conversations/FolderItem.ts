/**
 * Folder Item Component
 * 
 * This component renders a single folder item in the conversation list.
 * It handles rendering the folder name, expansion state, and child items.
 * Supports nested folder hierarchy with proper visual indentation and connecting lines.
 */

import { setIcon, Menu } from 'obsidian';
import { Conversation, ConversationFolder } from '../../models/Conversation';
import { FolderItemProps } from './types';
import { ConversationItem } from './ConversationItem';

/**
 * FolderItem class for rendering a folder item
 */
export class FolderItem {
  private containerEl: HTMLElement;
  private folder: ConversationFolder;
  private isExpanded: boolean;
  private childFolders: ConversationFolder[];
  private conversations: Conversation[];
  private selectedConversationId: string | null;
  private nestingLevel: number;
  private callbacks: {
    onToggleExpand: (id: string) => void;
    onRename: (id: string) => void;
    onDelete: (id: string) => void;
    onSelectConversation: (id: string) => void;
  };
  
  /**
   * Create a new FolderItem
   * 
   * @param containerEl - Container element to render the item in
   * @param props - Props for the folder item
   * @param nestingLevel - Optional nesting level for nested folders (default: 0)
   */
  constructor(containerEl: HTMLElement, props: FolderItemProps, nestingLevel: number = 0) {
    this.containerEl = containerEl;
    this.folder = props.folder;
    this.isExpanded = props.isExpanded;
    this.childFolders = props.childFolders;
    this.conversations = props.conversations;
    this.selectedConversationId = props.selectedConversationId;
    this.nestingLevel = nestingLevel;
    this.callbacks = {
      onToggleExpand: props.onToggleExpand,
      onRename: props.onRename,
      onDelete: props.onDelete,
      onSelectConversation: props.onSelectConversation
    };
    
    this.render();
  }
  
  /**
   * Render the folder item
   */
  private render(): void {
    // Create folder element with appropriate nesting level class
    const folderEl = this.containerEl.createDiv({ 
      cls: `chatsidian-folder-item chatsidian-folder-level-${this.nestingLevel} chatsidian-draggable` +
           (this.isExpanded ? ' chatsidian-folder-expanded' : '')
    });
    
    // Create header with expand/collapse icon and name
    const headerEl = folderEl.createDiv({ cls: 'chatsidian-folder-header' });
    
    // Create expand/collapse icon
    const expandIconEl = headerEl.createDiv({ cls: 'chatsidian-folder-expand-icon' });
    setIcon(expandIconEl, 'chevron-right');
    
    // Create folder icon
    const folderIconEl = headerEl.createDiv({ cls: 'chatsidian-folder-icon' });
    setIcon(folderIconEl, this.isExpanded ? 'folder-open' : 'folder');
    
    // Create folder name
    const nameEl = headerEl.createDiv({ cls: 'chatsidian-folder-name' });
    nameEl.setText(this.folder.name);
    
    // Create menu button
    const menuButtonEl = headerEl.createDiv({ cls: 'chatsidian-folder-menu' });
    setIcon(menuButtonEl, 'more-vertical');
    
    // Add keyboard shortcut tooltip if this is a top-level folder
    if (this.nestingLevel === 0) {
      const shortcutEl = headerEl.createDiv({ cls: 'chatsidian-keyboard-shortcut' });
      shortcutEl.setText('Alt+F');
    }
    
    // Add click handler to toggle expansion
    headerEl.addEventListener('click', (event) => {
      // Ignore clicks on the menu button
      if (event.target === menuButtonEl || menuButtonEl.contains(event.target as Node)) {
        return;
      }
      
      this.callbacks.onToggleExpand(this.folder.id);
    });
    
    // Add context menu
    menuButtonEl.addEventListener('click', (event) => {
      const menu = new Menu();
      
      menu.addItem(item => {
        item.setTitle('Rename')
          .setIcon('pencil')
          .onClick(() => this.callbacks.onRename(this.folder.id));
      });
      
      menu.addItem(item => {
        item.setTitle('Delete')
          .setIcon('trash')
          .onClick(() => this.callbacks.onDelete(this.folder.id));
      });
      
      menu.addItem(item => {
        item.setTitle('New Folder')
          .setIcon('folder-plus')
          .onClick(() => {
            // This would typically open a folder creation dialog
            // For now, just emit an event that would be handled by the parent
            const event = new CustomEvent('folder:create', {
              detail: { parentId: this.folder.id }
            });
            document.dispatchEvent(event);
          });
      });
      
      menu.addItem(item => {
        item.setTitle('New Conversation')
          .setIcon('file-plus')
          .onClick(() => {
            // This would typically create a new conversation in this folder
            // For now, just emit an event that would be handled by the parent
            const event = new CustomEvent('conversation:create', {
              detail: { folderId: this.folder.id }
            });
            document.dispatchEvent(event);
          });
      });
      
      menu.showAtMouseEvent(event);
    });
    
    // Setup drag and drop
    this.setupDragAndDrop(folderEl);
    
    // Create content container for child items
    if (this.isExpanded) {
      const contentEl = folderEl.createDiv({ cls: 'chatsidian-folder-content' });
      
      // Render child folders recursively
      for (const childFolder of this.childFolders) {
        // Create a new FolderItem for each child folder with increased nesting level
        new FolderItem(contentEl, {
          folder: childFolder,
          isExpanded: this.isChildFolderExpanded(childFolder.id),
          childFolders: this.getChildFoldersFor(childFolder.id),
          conversations: this.getConversationsInFolder(childFolder.id),
          selectedConversationId: this.selectedConversationId,
          onToggleExpand: this.callbacks.onToggleExpand,
          onRename: this.callbacks.onRename,
          onDelete: this.callbacks.onDelete,
          onSelectConversation: this.callbacks.onSelectConversation
        }, this.nestingLevel + 1);
      }
      
      // Render conversations in this folder
      for (const conversation of this.conversations) {
        const conversationEl = contentEl.createDiv({ 
          cls: 'chatsidian-folder-conversation chatsidian-draggable' 
        });
        
        // Create conversation title
        const titleEl = conversationEl.createSpan({ cls: 'chatsidian-folder-conversation-title' });
        titleEl.setText(conversation.title || `Conversation ${conversation.id}`);
        
        // Add selected class if this conversation is selected
        if (conversation.id === this.selectedConversationId) {
          conversationEl.addClass('chatsidian-folder-conversation-selected');
        }
        
        // Add click handler to select conversation
        conversationEl.addEventListener('click', () => {
          this.callbacks.onSelectConversation(conversation.id);
        });
        
        // Setup drag and drop for conversation
        this.setupConversationDragAndDrop(conversationEl, conversation.id);
      }
    }
  }
  
  /**
   * Check if a child folder is expanded
   * 
   * @param folderId - The ID of the child folder
   * @returns True if the child folder is expanded
   */
  private isChildFolderExpanded(folderId: string): boolean {
    // This would typically check the expanded state in the parent component
    // For now, just return false
    return false;
  }
  
  /**
   * Get child folders for a parent folder
   * 
   * @param parentId - The ID of the parent folder
   * @returns Array of child folders
   */
  private getChildFoldersFor(parentId: string): ConversationFolder[] {
    // This would typically get child folders from the parent component
    // For now, just return an empty array
    return [];
  }
  
  /**
   * Get conversations in a folder
   * 
   * @param folderId - The ID of the folder
   * @returns Array of conversations in the folder
   */
  private getConversationsInFolder(folderId: string): Conversation[] {
    // This would typically get conversations from the parent component
    // For now, just return an empty array
    return [];
  }
  
  /**
   * Setup drag and drop for folder
   * 
   * @param folderEl - The folder element
   */
  private setupDragAndDrop(folderEl: HTMLElement): void {
    // Make folder draggable
    folderEl.setAttribute('draggable', 'true');
    
    // Add folder ID as data attribute
    folderEl.setAttribute('data-folder-id', this.folder.id);
    
    // Add drag start event
    folderEl.addEventListener('dragstart', (event) => {
      // Set drag data
      event.dataTransfer?.setData('text/plain', JSON.stringify({
        type: 'folder',
        id: this.folder.id
      }));
      
      // Add dragging class
      folderEl.addClass('chatsidian-dragging');
    });
    
    // Add drag end event
    folderEl.addEventListener('dragend', () => {
      // Remove dragging class
      folderEl.removeClass('chatsidian-dragging');
    });
    
    // Add drag over event
    folderEl.addEventListener('dragover', (event) => {
      // Prevent default to allow drop
      event.preventDefault();
      
      // Add drop target class
      folderEl.addClass('chatsidian-folder-drop-target');
    });
    
    // Add drag leave event
    folderEl.addEventListener('dragleave', () => {
      // Remove drop target class
      folderEl.removeClass('chatsidian-folder-drop-target');
    });
    
    // Add drop event
    folderEl.addEventListener('drop', (event) => {
      // Prevent default action
      event.preventDefault();
      
      // Remove drop target class
      folderEl.removeClass('chatsidian-folder-drop-target');
      
      // Get drag data
      const data = event.dataTransfer?.getData('text/plain');
      
      if (data) {
        try {
          const dragData = JSON.parse(data);
          
          // Handle folder drop
          if (dragData.type === 'folder') {
            // Emit folder moved event
            const folderMovedEvent = new CustomEvent('folder:moved', {
              detail: {
                folderId: dragData.id,
                targetFolderId: this.folder.id
              }
            });
            document.dispatchEvent(folderMovedEvent);
          }
          
          // Handle conversation drop
          if (dragData.type === 'conversation') {
            // Emit conversation moved event
            const conversationMovedEvent = new CustomEvent('conversation:moved', {
              detail: {
                conversationId: dragData.id,
                folderId: this.folder.id
              }
            });
            document.dispatchEvent(conversationMovedEvent);
          }
        } catch (error) {
          console.error('Failed to parse drag data:', error);
        }
      }
    });
  }
  
  /**
   * Setup drag and drop for conversation
   * 
   * @param conversationEl - The conversation element
   * @param conversationId - The conversation ID
   */
  private setupConversationDragAndDrop(conversationEl: HTMLElement, conversationId: string): void {
    // Make conversation draggable
    conversationEl.setAttribute('draggable', 'true');
    
    // Add conversation ID as data attribute
    conversationEl.setAttribute('data-conversation-id', conversationId);
    
    // Add drag start event
    conversationEl.addEventListener('dragstart', (event) => {
      // Set drag data
      event.dataTransfer?.setData('text/plain', JSON.stringify({
        type: 'conversation',
        id: conversationId
      }));
      
      // Add dragging class
      conversationEl.addClass('chatsidian-dragging');
    });
    
    // Add drag end event
    conversationEl.addEventListener('dragend', () => {
      // Remove dragging class
      conversationEl.removeClass('chatsidian-dragging');
    });
  }
}
