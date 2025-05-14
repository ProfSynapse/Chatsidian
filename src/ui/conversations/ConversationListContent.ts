/**
 * ConversationListContent Component
 * 
 * This component handles the rendering of the conversation list content,
 * including folders and conversations based on filtering and sorting criteria.
 */

import { Menu, MenuItem } from 'obsidian';
import { Conversation } from '../../models/Conversation';
import { ConversationManager } from './ConversationManager';
import { FolderManager } from './FolderManager';
import { TagManager } from './TagManager';
import { ConversationFilter } from './ConversationFilter';
import { ConversationItem } from './ConversationItem';
import { FolderItem } from './FolderItem';
import { ConversationListActions } from './ConversationListActions';
import { ConversationSortOption, ConversationFilterOption } from './types';

export interface ConversationListContentProps {
  conversationManager: ConversationManager;
  folderManager: FolderManager;
  tagManager: TagManager;
  searchQuery: string;
  sortOption: ConversationSortOption;
  filterOption: ConversationFilterOption;
  actions: ConversationListActions;
}

export class ConversationListContent {
  private containerEl: HTMLElement;
  private props: ConversationListContentProps;
  
  constructor(containerEl: HTMLElement, props: ConversationListContentProps) {
    this.containerEl = containerEl;
    this.props = props;
    
    this.render();
    this.setupContextMenu();
  }
  
  /**
   * Render the conversation list content
   */
  private render(): void {
    const { 
      conversationManager, 
      folderManager, 
      tagManager, 
      searchQuery, 
      sortOption, 
      filterOption 
    } = this.props;
    
    // Get conversations and apply filters
    const conversations = conversationManager.getConversations();
    const filteredConversations = ConversationFilter.filterAndSort(
      conversations,
      searchQuery,
      tagManager.getSelectedTag(),
      filterOption,
      sortOption
    );
    
    // Render conversations
    if (filteredConversations.length === 0 && searchQuery !== '') {
      const emptyEl = this.containerEl.createDiv({ cls: 'chatsidian-conversation-list-empty' });
      emptyEl.setText('No conversations match your search');
      
    } else if (filteredConversations.length === 0) {
      const emptyEl = this.containerEl.createDiv({ cls: 'chatsidian-conversation-list-empty' });
      emptyEl.setText('No conversations match your filters');
      
      // Create new conversation button when list is empty
      const newChatButtonEl = this.containerEl.createDiv({ 
        cls: 'chatsidian-empty-state-button'
      });
      newChatButtonEl.setText('Create a new chat');
      newChatButtonEl.addEventListener('click', () => this.props.actions.createNewConversation());
      
    } else {
      // Get all folders
      const allFolders = folderManager.getFolders();
      
      // Render all folders at root level
      for (const folder of allFolders) {
        try {
          this.renderFolder(folder);
        } catch (error) {
          console.error(`ConversationListContent: ERROR rendering folder ${folder.name}:`, error);
        }
      }
      
      // Render conversations that are not in folders
      const unfiledConversations = filteredConversations.filter(c => !c.folderId);
      for (const conversation of unfiledConversations) {
        this.renderConversation(conversation);
      }
    }
  }
  
  /**
   * Set up context menu for empty space
   */
  private setupContextMenu(): void {
    // Add right-click context menu to empty space for folder creation
    this.containerEl.addEventListener('contextmenu', (event) => {
      // Only show context menu if clicking on the container itself, not a child element
      if (event.target === this.containerEl) {
        const menu = new Menu();
        
        // Add options for creating new items
        menu.addItem((item: MenuItem) => {
          item.setTitle('New Chat')
            .setIcon('message-square-plus')
            .onClick(() => this.props.actions.createNewConversation());
        });
        
        menu.addItem((item: MenuItem) => {
          item.setTitle('New Folder')
            .setIcon('folder-plus')
            .onClick(() => this.props.actions.createFolder());
        });
        
        menu.showAtMouseEvent(event);
        event.preventDefault();
      }
    });
  }
  
  /**
   * Render a folder
   * 
   * @param folder - The folder to render
   */
  private renderFolder(folder: any): void {
    const { folderManager, conversationManager, searchQuery, tagManager, filterOption, sortOption } = this.props;
    
    // Get child folders
    const childFolders = folderManager.getChildFolders(folder.id);
    
    // Get conversations in this folder
    const conversations = conversationManager.getConversations().filter(c => c.folderId === folder.id);
    
    // Apply filters to conversations
    const filteredConversations = ConversationFilter.filterAndSort(
      conversations,
      searchQuery,
      tagManager.getSelectedTag(),
      filterOption,
      sortOption
    );
    
    // Force folders to be expanded during initial rendering to show their content
    const isExpanded = folderManager.isFolderExpanded(folder.id);
    
    // Create folder item
    new FolderItem(this.containerEl, {
      folder,
      isExpanded: isExpanded,
      onToggleExpand: (id) => folderManager.toggleFolderExpansion(id),
      onRename: (id) => this.props.actions.renameFolder(id),
      onDelete: (id) => this.props.actions.deleteFolder(id),
      childFolders,
      conversations: filteredConversations,
      selectedConversationId: conversationManager.getSelectedConversationId(),
      onSelectConversation: (id) => this.props.actions.selectConversation(id)
    });
  }
  
  /**
   * Render a conversation
   * 
   * @param conversation - The conversation to render
   */
  private renderConversation(conversation: Conversation): void {
    const { conversationManager, actions } = this.props;
    
    // Create conversation item
    new ConversationItem(this.containerEl, {
      conversation,
      isSelected: conversation.id === conversationManager.getSelectedConversationId(),
      onSelect: (id) => actions.selectConversation(id),
      onRename: (id) => actions.renameConversation(id),
      onDelete: (id) => actions.deleteConversation(id),
      onStar: (id) => actions.toggleConversationStar(id),
      onMove: (id, folderId) => actions.moveConversationToFolder(id, folderId),
      onTagsUpdate: (id, tags) => actions.updateConversationTags(id, tags)
    });
  }
}