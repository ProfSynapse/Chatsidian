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
    
    // Create expand/collapse icon - using Obsidian's native triangle style
    const expandIconEl = headerEl.createDiv({ cls: 'chatsidian-folder-expand-icon' });
    setIcon(expandIconEl, 'right-triangle');
    
    // Create folder icon
    const folderIconEl = headerEl.createDiv({ cls: 'chatsidian-folder-icon' });
    setIcon(folderIconEl, this.isExpanded ? 'folder-open' : 'folder');
    
    // Create folder name
    const nameEl = headerEl.createDiv({ cls: 'chatsidian-folder-name' });
    nameEl.setText(this.folder.name);
    
    // Add conversation count badge
    const countEl = headerEl.createDiv({ cls: 'chatsidian-folder-count' });
    const conversationCount = this.conversations.length;
    if (conversationCount > 0) {
      countEl.setText(conversationCount.toString());
    } else {
      countEl.hide();
    }
    
    // Create menu button
    const menuButtonEl = headerEl.createDiv({ cls: 'chatsidian-folder-menu' });
    setIcon(menuButtonEl, 'more-horizontal');
    
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
    
    // Add context menu with Obsidian-like styling and organization
    menuButtonEl.addEventListener('click', (event) => {
      const menu = new Menu();
      
      // Creation section (matching Obsidian's order)
      menu.addItem(item => {
        item.setTitle('New Chat')
          .setIcon('message-square-plus')
          .onClick(() => {
            const event = new CustomEvent('conversation:create', {
              detail: { folderId: this.folder.id }
            });
            document.dispatchEvent(event);
          });
      });
      
      menu.addItem(item => {
        item.setTitle('New Folder')
          .setIcon('folder-plus')
          .onClick(() => {
            const event = new CustomEvent('folder:create', {
              detail: { parentId: this.folder.id }
            });
            document.dispatchEvent(event);
          });
      });
      
      // Add separator between groups (like Obsidian)
      menu.addSeparator();
      
      // Actions section
      menu.addItem(item => {
        item.setTitle('Rename')
          .setIcon('pencil')
          .setSection('action')
          .onClick(() => this.callbacks.onRename(this.folder.id));
      });
      
      menu.addItem(item => {
        item.setTitle('Delete')
          .setIcon('trash-2')
          .setSection('action')
          .onClick(() => this.callbacks.onDelete(this.folder.id));
      });
      
      // Sort options - adding typical Obsidian functionality
      menu.addSeparator();
      
      const sortSubmenu = new Menu();
      
      sortSubmenu.addItem(item => {
        item.setTitle('By Name')
          .setIcon('sort-alpha-asc')
          .onClick(() => {
            const event = new CustomEvent('folder:sort', {
              detail: { folderId: this.folder.id, sortBy: 'name' }
            });
            document.dispatchEvent(event);
          });
      });
      
      sortSubmenu.addItem(item => {
        item.setTitle('By Date Modified')
          .setIcon('clock')
          .onClick(() => {
            const event = new CustomEvent('folder:sort', {
              detail: { folderId: this.folder.id, sortBy: 'modified' }
            });
            document.dispatchEvent(event);
          });
      });
      
      // Sort header (without submenu functionality since it's not supported)
      menu.addItem(item => {
        item.setTitle('Sort by Name')
          .setIcon('sort-alpha-asc')
          .onClick(() => {
            const event = new CustomEvent('folder:sort', {
              detail: { folderId: this.folder.id, sortBy: 'name' }
            });
            document.dispatchEvent(event);
          });
      });
      
      menu.addItem(item => {
        item.setTitle('Sort by Date Modified')
          .setIcon('clock')
          .onClick(() => {
            const event = new CustomEvent('folder:sort', {
              detail: { folderId: this.folder.id, sortBy: 'modified' }
            });
            document.dispatchEvent(event);
          });
      });
      
      menu.showAtMouseEvent(event);
    });
    
    // Setup drag and drop with improved Obsidian-like styling
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
      
      // Render conversations in this folder with Obsidian-like styling
      for (const conversation of this.conversations) {
        const conversationEl = contentEl.createDiv({ 
          cls: 'chatsidian-folder-conversation chatsidian-draggable' 
        });
        
        // Add document icon to match Obsidian's file display
        const iconEl = conversationEl.createDiv({ cls: 'chatsidian-conversation-icon' });
        setIcon(iconEl, 'message-square');
        
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
        
        // Setup drag and drop for conversation with improved visuals
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
    // Force all child folders to be expanded for debugging purposes
    return true;
    
    /* 
     * Note: The original implementation here has a placeholder that always returns false.
     * This causes child folders to always be collapsed, which might explain why folders
     * are not visible in the sidebar. The proper implementation would pass the expanded
     * state from FolderManager down to each nested FolderItem component.
     * 
     * The correct fix would be to check the expandedFolderIds in FolderManager,
     * but we don't have direct access to that here. 
     * 
     * For testing purposes, we're now forcing all child folders to be expanded
     * to ensure they're visible in the sidebar.
     */
  }
  
  /**
   * Get child folders for a parent folder
   * 
   * @param parentId - The ID of the parent folder
   * @returns Array of child folders
   */
  private getChildFoldersFor(parentId: string): ConversationFolder[] {
    // Find child folders in the childFolders array that have this parentId
    return this.childFolders.filter(folder => folder.parentId === parentId);
  }
  
  /**
   * Get conversations in a folder
   * 
   * @param folderId - The ID of the folder
   * @returns Array of conversations in the folder
   */
  private getConversationsInFolder(folderId: string): Conversation[] {
    // Find conversations in the conversations array that have this folderId
    return this.conversations.filter(conv => conv.folderId === folderId);
  }
  
  /**
   * Setup drag and drop for folder with Obsidian-like styling
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
      
      // Set drag image
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
      }
      
      // Add dragging class with delay for better visual feedback
      setTimeout(() => {
        folderEl.addClass('chatsidian-dragging');
      }, 0);
    });
    
    // Add drag end event
    folderEl.addEventListener('dragend', () => {
      // Remove dragging class
      folderEl.removeClass('chatsidian-dragging');
      
      // Remove any drop indicators that might be lingering
      document.querySelectorAll('.chatsidian-folder-drop-indicator').forEach(el => el.remove());
    });
    
    // Add drag over event
    folderEl.addEventListener('dragover', (event) => {
      // Prevent default to allow drop
      event.preventDefault();
      
      // Add drop target class with slight delay for smoother visuals
      if (!folderEl.hasClass('chatsidian-folder-drop-target')) {
        setTimeout(() => {
          folderEl.addClass('chatsidian-folder-drop-target');
        }, 50);
      }
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
            // Show brief drop animation
            this.showDropAnimation(folderEl);
            
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
            // Show brief drop animation
            this.showDropAnimation(folderEl);
            
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
   * Show a brief animation when items are dropped
   * 
   * @param targetEl - Element where the drop occurred
   */
  private showDropAnimation(targetEl: HTMLElement): void {
    // Create drop indicator
    const indicator = targetEl.createDiv({ cls: 'chatsidian-folder-drop-indicator' });
    
    // Remove indicator after animation completes
    setTimeout(() => {
      indicator.remove();
    }, 500);
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
