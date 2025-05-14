/**
 * Conversation Item Component
 * 
 * This component renders a single conversation item in the conversation list.
 * It handles rendering the conversation title, tags, and action buttons.
 */

import { setIcon, Menu } from 'obsidian';
import { Conversation } from '../../models/Conversation';
import { ConversationItemProps } from './types';

/**
 * ConversationItem class for rendering a conversation item
 */
export class ConversationItem {
  private containerEl: HTMLElement;
  private conversation: Conversation;
  private isSelected: boolean;
  private callbacks: {
    onSelect: (id: string) => void;
    onRename: (id: string) => void;
    onDelete: (id: string) => void;
    onStar: (id: string) => void;
    onMove: (id: string, folderId: string | null) => void;
    onTagsUpdate: (id: string, tags: string[]) => void;
  };
  
  /**
   * Create a new ConversationItem
   * 
   * @param containerEl - Container element to render the item in
   * @param props - Props for the conversation item
   */
  constructor(containerEl: HTMLElement, props: ConversationItemProps) {
    this.containerEl = containerEl;
    this.conversation = props.conversation;
    this.isSelected = props.isSelected;
    this.callbacks = {
      onSelect: props.onSelect,
      onRename: props.onRename,
      onDelete: props.onDelete,
      onStar: props.onStar,
      onMove: props.onMove,
      onTagsUpdate: props.onTagsUpdate
    };
    
    this.render();
  }
  
  /**
   * Render the conversation item
   */
  private render(): void {
    const itemEl = this.containerEl.createDiv({ cls: 'chatsidian-conversation-item chatsidian-draggable' });
    
    // Make the item draggable
    itemEl.setAttribute('draggable', 'true');
    
    // Add data attributes needed for drag operations
    itemEl.setAttribute('data-conversation-id', this.conversation.id);
    itemEl.setAttribute('data-type', 'conversation');
    
    // Add selected class if this is the selected conversation
    if (this.isSelected) {
      itemEl.addClass('chatsidian-conversation-item-selected');
    }
    
    // Add starred class if this is a starred conversation
    if (this.conversation.isStarred) {
      itemEl.addClass('chatsidian-conversation-item-starred');
    }
    
    // Create star icon
    const starEl = itemEl.createDiv({ cls: 'chatsidian-conversation-item-star' });
    setIcon(starEl, this.conversation.isStarred ? 'star' : 'star-off');
    starEl.addEventListener('click', (event) => {
      event.stopPropagation();
      this.callbacks.onStar(this.conversation.id);
    });
    
    // Create title element
    const titleEl = itemEl.createDiv({ cls: 'chatsidian-conversation-item-title' });
    titleEl.setText(this.conversation.title);
    
    // Create tags container if there are tags
    if (this.conversation.tags && this.conversation.tags.length > 0) {
      const tagsEl = itemEl.createDiv({ cls: 'chatsidian-conversation-item-tags' });
      
      for (const tag of this.conversation.tags) {
        const tagEl = tagsEl.createSpan({ cls: 'chatsidian-conversation-item-tag' });
        tagEl.setText(tag);
        
        // Add click handler to remove tag
        tagEl.addEventListener('click', (event) => {
          event.stopPropagation();
          const updatedTags = this.conversation.tags?.filter(t => t !== tag) || [];
          this.callbacks.onTagsUpdate(this.conversation.id, updatedTags);
        });
      }
    }
    
    // Create menu button
    const menuButtonEl = itemEl.createDiv({ cls: 'chatsidian-conversation-item-menu' });
    setIcon(menuButtonEl, 'more-vertical');
    
    // Add click handler to select conversation
    itemEl.addEventListener('click', (event) => {
      // Ignore clicks on the menu button or star
      if (event.target === menuButtonEl || menuButtonEl.contains(event.target as Node) ||
          event.target === starEl || starEl.contains(event.target as Node)) {
        return;
      }
      
      this.callbacks.onSelect(this.conversation.id);
    });
    
    // Add context menu
    menuButtonEl.addEventListener('click', (event) => {
      const menu = new Menu();
      
      menu.addItem(item => {
        item.setTitle('Rename')
          .setIcon('pencil')
          .onClick(() => this.callbacks.onRename(this.conversation.id));
      });
      
      menu.addItem(item => {
        item.setTitle('Delete')
          .setIcon('trash')
          .onClick(() => this.callbacks.onDelete(this.conversation.id));
      });
      
      menu.addItem(item => {
        item.setTitle(this.conversation.isStarred ? 'Unstar' : 'Star')
          .setIcon(this.conversation.isStarred ? 'star-off' : 'star')
          .onClick(() => this.callbacks.onStar(this.conversation.id));
      });
      
      menu.addItem(item => {
        item.setTitle('Move to...')
          .setIcon('folder')
          .onClick(() => {
            // This would typically open a folder selection dialog
            // For now, just move to root (null)
            this.callbacks.onMove(this.conversation.id, null);
          });
      });
      
      menu.addItem(item => {
        item.setTitle('Add Tag')
          .setIcon('tag')
          .onClick(() => {
            // This would typically open a tag input dialog
            const tag = prompt('Enter tag name:');
            if (tag) {
              const tags = [...(this.conversation.tags || [])];
              if (!tags.includes(tag)) {
                tags.push(tag);
                this.callbacks.onTagsUpdate(this.conversation.id, tags);
              }
            }
          });
      });
      
      menu.showAtMouseEvent(event);
    });
    
    // Setup drag and drop functionality
    this.setupDragAndDrop(itemEl);
  }
  
  /**
   * Setup drag and drop for conversation item
   * 
   * @param conversationEl - The conversation element
   */
  private setupDragAndDrop(conversationEl: HTMLElement): void {
    // Add drag start event
    conversationEl.addEventListener('dragstart', (event) => {
      console.log(`ConversationItem: Drag started for conversation ${this.conversation.id}`);
      
      // Set drag data
      event.dataTransfer?.setData('text/plain', JSON.stringify({
        type: 'conversation',
        id: this.conversation.id
      }));
      
      // Set drag effect
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
      }
      
      // Add dragging class with delay for better visual feedback
      setTimeout(() => {
        conversationEl.addClass('chatsidian-dragging');
      }, 0);
    });
    
    // Add drag end event
    conversationEl.addEventListener('dragend', () => {
      console.log(`ConversationItem: Drag ended for conversation ${this.conversation.id}`);
      
      // Remove dragging class
      conversationEl.removeClass('chatsidian-dragging');
    });
  }
}
