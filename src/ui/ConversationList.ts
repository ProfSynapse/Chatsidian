/**
 * ConversationList Component
 * 
 * This file implements the conversation list component for the Chatsidian plugin.
 * It provides a list of conversations in the sidebar with functionality to create,
 * rename, delete, and switch between conversations.
 * 
 * The component uses the StorageManager to persist conversations and the EventBus
 * for communication with other components.
 * 
 * Features include:
 * - Conversation folders for organization
 * - Tags for categorization
 * - Search functionality
 * - Sorting and filtering options
 * - Starring/favoriting conversations
 * 
 * @file This file defines the ConversationList class for conversation management.
 */

import { Component, setIcon, Notice } from 'obsidian';
import { EventBus } from '../core/EventBus';
import { StorageManager } from '../core/StorageManager';
import { Conversation } from '../models/Conversation';

// Import modular components
import { ConversationManager } from './conversations/ConversationManager';
import { FolderManager } from './conversations/FolderManager';
import { TagManager } from './conversations/TagManager';
import { ConversationFilter } from './conversations/ConversationFilter';
import { SearchBar, SearchBarProps } from './conversations/SearchBar';
import { FilterControls, FilterControlsProps } from './conversations/FilterControls';
import { ConversationItem } from './conversations/ConversationItem';
import { FolderItem } from './conversations/FolderItem';
import { 
  ConversationListEventType, 
  ConversationSortOption, 
  ConversationFilterOption 
} from './conversations/types';

/**
 * ConversationList component for managing conversations
 */
export class ConversationList extends Component {
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
   * Conversation manager for conversation operations
   */
  private conversationManager: ConversationManager;
  
  /**
   * Folder manager for folder operations
   */
  private folderManager: FolderManager;
  
  /**
   * Tag manager for tag operations
   */
  private tagManager: TagManager;
  
  /**
   * Current search query
   */
  private searchQuery: string = '';
  
  /**
   * Current sort option
   */
  private sortOption: ConversationSortOption = ConversationSortOption.MODIFIED_DESC;
  
  /**
   * Current filter option
   */
  private filterOption: ConversationFilterOption = ConversationFilterOption.ALL;
  
  /**
   * Search bar component
   */
  private searchBar: SearchBar | null = null;
  
  /**
   * Filter controls component
   */
  private filterControls: FilterControls | null = null;
  
  /**
   * Constructor for the ConversationList
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
    
    // Initialize managers
    this.conversationManager = new ConversationManager(storageManager, eventBus);
    this.folderManager = new FolderManager(storageManager, eventBus);
    this.tagManager = new TagManager(storageManager, eventBus);
    
    this.initialize();
  }
  
  /**
   * Initialize the conversation list
   */
  private async initialize(): Promise<void> {
    // Load conversations and folders
    await this.conversationManager.loadConversations();
    await this.folderManager.loadFolders();
    
    // Update available tags
    this.tagManager.updateAvailableTags(this.conversationManager.getConversations());
    
    // Register event handlers
    this.registerEventHandlers();
    
    // Register keyboard shortcuts
    this.registerKeyboardShortcuts();
    
    // Render the conversation list
    this.render();
  }
  
  /**
   * Register event handlers for the conversation list
   */
  private registerEventHandlers(): void {
    // Register for storage events
    this.registerEvent(
      this.eventBus.on('storage:reloaded', () => {
        // Reload conversations and folders
        this.conversationManager.loadConversations().then(() => {
          this.folderManager.loadFolders().then(() => {
            // Update available tags
            this.tagManager.updateAvailableTags(this.conversationManager.getConversations());
            
            // Update filter controls if they exist
            if (this.filterControls) {
              this.filterControls.updateAvailableTags(this.tagManager.getAvailableTags());
            }
            
            // Re-render the conversation list
            this.render();
          });
        });
      })
    );
    
    // Register for custom events
    document.addEventListener('conversation:create', (event: CustomEvent) => {
      const detail = event.detail;
      if (detail && detail.folderId) {
        this.createNewConversation(undefined, detail.folderId);
      } else {
        this.createNewConversation();
      }
    });
    
    document.addEventListener('folder:create', (event: CustomEvent) => {
      const detail = event.detail;
      if (detail && detail.parentId) {
        this.createFolder(undefined, detail.parentId);
      } else {
        this.createFolder();
      }
    });
    
    document.addEventListener('folder:moved', (event: CustomEvent) => {
      const detail = event.detail;
      if (detail && detail.folderId && detail.targetFolderId) {
        // Handle folder moved event
        // This would typically update the folder's parent ID
        console.log(`Folder ${detail.folderId} moved to ${detail.targetFolderId}`);
        // TODO: Implement folder moving functionality
        this.render();
      }
    });
    
    document.addEventListener('conversation:moved', (event: CustomEvent) => {
      const detail = event.detail;
      if (detail && detail.conversationId && detail.folderId !== undefined) {
        this.moveConversationToFolder(detail.conversationId, detail.folderId);
      }
    });
  }
  
  /**
   * Register keyboard shortcuts for the conversation list
   */
  private registerKeyboardShortcuts(): void {
    // Add keyboard event listener to the container element
    this.containerEl.addEventListener('keydown', this.handleKeyDown.bind(this));
    
    // Add global keyboard shortcuts
    document.addEventListener('keydown', (event: KeyboardEvent) => {
      // Alt+F: Focus conversation list
      if (event.altKey && event.key === 'f') {
        event.preventDefault();
        this.containerEl.focus();
      }
    });
  }
  
  /**
   * Handle keyboard events for the conversation list
   * 
   * @param event - The keyboard event
   */
  private handleKeyDown(event: KeyboardEvent): void {
    // Only handle keyboard shortcuts if the conversation list has focus
    if (!this.containerEl.contains(document.activeElement)) {
      return;
    }
    
    // Handle keyboard shortcuts
    switch (event.key) {
      case 'n':
        // Ctrl+N: Create new conversation
        if (event.ctrlKey && !event.shiftKey) {
          event.preventDefault();
          this.createNewConversation();
        }
        // Ctrl+Shift+N: Create new folder
        else if (event.ctrlKey && event.shiftKey) {
          event.preventDefault();
          this.createFolder();
        }
        break;
        
      case 'f':
        // Ctrl+F: Focus search bar
        if (event.ctrlKey) {
          event.preventDefault();
          if (this.searchBar) {
            this.searchBar.focus();
          }
        }
        break;
        
      case 's':
        // Ctrl+S: Star/unstar selected conversation
        if (event.ctrlKey) {
          event.preventDefault();
          const selectedId = this.conversationManager.getSelectedConversationId();
          if (selectedId) {
            this.toggleConversationStar(selectedId);
          }
        }
        break;
        
      case 'Delete':
        // Delete: Delete selected conversation
        event.preventDefault();
        const selectedId = this.conversationManager.getSelectedConversationId();
        if (selectedId) {
          this.deleteConversation(selectedId);
        }
        break;
        
      case 'ArrowUp':
        // Up arrow: Select previous conversation
        event.preventDefault();
        this.selectAdjacentConversation(-1);
        break;
        
      case 'ArrowDown':
        // Down arrow: Select next conversation
        event.preventDefault();
        this.selectAdjacentConversation(1);
        break;
        
      case 'Enter':
        // Enter: Open selected conversation
        event.preventDefault();
        const selectedConversationId = this.conversationManager.getSelectedConversationId();
        if (selectedConversationId) {
          this.selectConversation(selectedConversationId);
        }
        break;
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
    setIcon(newButtonEl, 'plus');
    newButtonEl.setAttribute('aria-label', 'New Conversation');
    newButtonEl.addEventListener('click', () => this.createNewConversation());
    
    // Create search bar
    const searchBarEl = this.containerEl.createDiv({ cls: 'chatsidian-search-container' });
    const searchBarProps: SearchBarProps = {
      initialQuery: this.searchQuery,
      onSearch: (query) => {
        this.searchQuery = query;
        this.render();
      },
      onClear: () => {
        this.searchQuery = '';
        this.render();
      }
    };
    this.searchBar = new SearchBar(searchBarEl, searchBarProps);
    
    // Create filter controls
    const filterControlsEl = this.containerEl.createDiv({ cls: 'chatsidian-filter-container' });
    const filterControlsProps: FilterControlsProps = {
      initialSortOption: this.sortOption,
      initialFilterOption: this.filterOption,
      initialSelectedTag: this.tagManager.getSelectedTag(),
      availableTags: this.tagManager.getAvailableTags(),
      onSortChange: (option) => {
        this.sortOption = option;
        this.render();
      },
      onFilterChange: (option) => {
        this.filterOption = option;
        this.render();
      },
      onTagSelect: (tag) => {
        this.tagManager.setSelectedTag(tag);
        this.render();
      }
    };
    this.filterControls = new FilterControls(filterControlsEl, filterControlsProps);
    
    // Create conversation list container
    const listContainerEl = this.containerEl.createDiv({ cls: 'chatsidian-conversation-list-container' });
    
    // Get conversations and apply filters
    const conversations = this.conversationManager.getConversations();
    const filteredConversations = ConversationFilter.filterAndSort(
      conversations,
      this.searchQuery,
      this.tagManager.getSelectedTag(),
      this.filterOption,
      this.sortOption
    );
    
    // Render conversations
    if (filteredConversations.length === 0) {
      const emptyEl = listContainerEl.createDiv({ cls: 'chatsidian-conversation-list-empty' });
      emptyEl.setText('No conversations match your filters');
    } else {
      // Get root folders (no parent)
      const rootFolders = this.folderManager.getChildFolders(null);
      
      // Render root folders
      for (const folder of rootFolders) {
        this.renderFolder(listContainerEl, folder);
      }
      
      // Render conversations that are not in folders
      const unfiledConversations = filteredConversations.filter(c => !c.folderId);
      for (const conversation of unfiledConversations) {
        this.renderConversation(listContainerEl, conversation);
      }
    }
  }
  
  /**
   * Render a folder
   * 
   * @param containerEl - The container element to render the folder in
   * @param folder - The folder to render
   */
  private renderFolder(containerEl: HTMLElement, folder: any): void {
    // Get child folders
    const childFolders = this.folderManager.getChildFolders(folder.id);
    
    // Get conversations in this folder
    const conversations = this.conversationManager.getConversations().filter(c => c.folderId === folder.id);
    
    // Apply filters to conversations
    const filteredConversations = ConversationFilter.filterAndSort(
      conversations,
      this.searchQuery,
      this.tagManager.getSelectedTag(),
      this.filterOption,
      this.sortOption
    );
    
    // Only render folder if it has matching conversations or child folders
    if (filteredConversations.length > 0 || childFolders.length > 0) {
      // Create folder item
      new FolderItem(containerEl, {
        folder,
        isExpanded: this.folderManager.isFolderExpanded(folder.id),
        onToggleExpand: (id) => this.folderManager.toggleFolderExpansion(id),
        onRename: (id) => this.renameFolder(id),
        onDelete: (id) => this.deleteFolder(id),
        childFolders,
        conversations: filteredConversations,
        selectedConversationId: this.conversationManager.getSelectedConversationId(),
        onSelectConversation: (id) => this.selectConversation(id)
      });
    }
  }
  
  /**
   * Render a conversation
   * 
   * @param containerEl - The container element to render the conversation in
   * @param conversation - The conversation to render
   */
  private renderConversation(containerEl: HTMLElement, conversation: Conversation): void {
    // Create conversation item
    new ConversationItem(containerEl, {
      conversation,
      isSelected: conversation.id === this.conversationManager.getSelectedConversationId(),
      onSelect: (id) => this.selectConversation(id),
      onRename: (id) => this.renameConversation(id),
      onDelete: (id) => this.deleteConversation(id),
      onStar: (id) => this.toggleConversationStar(id),
      onMove: (id, folderId) => this.moveConversationToFolder(id, folderId),
      onTagsUpdate: (id, tags) => this.updateConversationTags(id, tags)
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
      
      // Re-render the conversation list
      this.render();
      
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
    this.render();
  }
  
  /**
   * Rename a conversation
   * 
   * @param conversationId - The ID of the conversation to rename
   */
  public async renameConversation(conversationId: string): Promise<void> {
    // Find the conversation
    const conversation = this.conversationManager.getConversations().find(c => c.id === conversationId);
    
    if (!conversation) {
      console.error(`Conversation with ID ${conversationId} not found`);
      return;
    }
    
    // Prompt for new title
    const newTitle = prompt('Enter new conversation title:', conversation.title);
    
    if (!newTitle || newTitle === conversation.title) {
      return;
    }
    
    // Rename the conversation
    await this.conversationManager.renameConversation(conversationId, newTitle);
    
    // Re-render the conversation list
    this.render();
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
    
    // Delete the conversation
    await this.conversationManager.deleteConversation(conversationId);
    
    // Re-render the conversation list
    this.render();
  }
  
  /**
   * Create a new folder
   * 
   * @param name - Optional name for the new folder
   * @param parentId - Optional parent folder ID
   * @returns Promise that resolves with the new folder
   */
  public async createFolder(name?: string, parentId?: string): Promise<any> {
    try {
      // Prompt for folder name if not provided
      const folderName = name || prompt('Enter folder name:', 'New Folder');
      
      if (!folderName) {
        return;
      }
      
      // Create a new folder
      const newFolder = await this.folderManager.createFolder(folderName, parentId);
      
      // Re-render the conversation list
      this.render();
      
      return newFolder;
    } catch (error) {
      console.error('Failed to create new folder:', error);
      new Notice('Failed to create new folder');
      throw error;
    }
  }
  
  /**
   * Rename a folder
   * 
   * @param folderId - The ID of the folder to rename
   */
  public async renameFolder(folderId: string): Promise<void> {
    // Find the folder
    const folder = this.folderManager.getFolders().find(f => f.id === folderId);
    
    if (!folder) {
      console.error(`Folder with ID ${folderId} not found`);
      return;
    }
    
    // Prompt for new name
    const newName = prompt('Enter new folder name:', folder.name);
    
    if (!newName || newName === folder.name) {
      return;
    }
    
    // Rename the folder
    await this.folderManager.renameFolder(folderId, newName);
    
    // Re-render the conversation list
    this.render();
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
    
    // Re-render the conversation list
    this.render();
  }
  
  /**
   * Move a conversation to a folder
   * 
   * @param conversationId - The ID of the conversation to move
   * @param folderId - The ID of the folder to move to, or null to ungroup
   */
  public async moveConversationToFolder(conversationId: string, folderId: string | null): Promise<void> {
    await this.folderManager.moveConversationToFolder(conversationId, folderId);
    
    // Update the conversation in the conversation manager
    const conversation = this.conversationManager.getConversations().find(c => c.id === conversationId);
    if (conversation) {
      conversation.folderId = folderId;
      this.conversationManager.updateConversation(conversation);
    }
    
    // Re-render the conversation list
    this.render();
  }
  
  /**
   * Toggle the starred status of a conversation
   * 
   * @param conversationId - The ID of the conversation to star/unstar
   */
  public async toggleConversationStar(conversationId: string): Promise<void> {
    await this.conversationManager.toggleConversationStar(conversationId);
    
    // Re-render the conversation list
    this.render();
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
      this.conversationManager.updateConversation(conversation);
    }
    
    // Update available tags
    this.tagManager.updateAvailableTags(this.conversationManager.getConversations());
    
    // Update filter controls if they exist
    if (this.filterControls) {
      this.filterControls.updateAvailableTags(this.tagManager.getAvailableTags());
    }
    
    // Re-render the conversation list
    this.render();
  }
  
  /**
   * Set the search query
   * 
   * @param query - The search query
   */
  public setSearchQuery(query: string): void {
    this.searchQuery = query;
    
    // Update search bar if it exists
    if (this.searchBar) {
      this.searchBar.setQuery(query);
    }
    
    // Re-render the conversation list
    this.render();
  }
  
  /**
   * Set the sort option
   * 
   * @param option - The sort option
   */
  public setSortOption(option: ConversationSortOption): void {
    this.sortOption = option;
    
    // Update filter controls if they exist
    if (this.filterControls) {
      this.filterControls.setSortOption(option);
    }
    
    // Re-render the conversation list
    this.render();
  }
  
  /**
   * Set the filter option
   * 
   * @param option - The filter option
   */
  public setFilterOption(option: ConversationFilterOption): void {
    this.filterOption = option;
    
    // Update filter controls if they exist
    if (this.filterControls) {
      this.filterControls.setFilterOption(option);
    }
    
    // Re-render the conversation list
    this.render();
  }
  
  /**
   * Get the currently selected conversation
   * 
   * @returns The currently selected conversation, or null if none is selected
   */
  public getSelectedConversation(): Conversation | null {
    return this.conversationManager.getSelectedConversation();
  }
  
  /**
   * Get all conversations
   * 
   * @returns All conversations
   */
  public getConversations(): Conversation[] {
    return this.conversationManager.getConversations();
  }
  
  /**
   * Select the next or previous conversation in the list
   * 
   * @param direction - 1 for next, -1 for previous
   */
  private selectAdjacentConversation(direction: number): void {
    // Get all visible conversations
    const conversations = this.conversationManager.getConversations();
    const filteredConversations = ConversationFilter.filterAndSort(
      conversations,
      this.searchQuery,
      this.tagManager.getSelectedTag(),
      this.filterOption,
      this.sortOption
    );
    
    if (filteredConversations.length === 0) {
      return;
    }
    
    // Get the currently selected conversation
    const selectedId = this.conversationManager.getSelectedConversationId();
    
    // Find the index of the currently selected conversation
    const currentIndex = selectedId 
      ? filteredConversations.findIndex(c => c.id === selectedId)
      : -1;
    
    // Calculate the new index
    let newIndex = currentIndex + direction;
    
    // Wrap around if needed
    if (newIndex < 0) {
      newIndex = filteredConversations.length - 1;
    } else if (newIndex >= filteredConversations.length) {
      newIndex = 0;
    }
    
    // Select the new conversation
    this.selectConversation(filteredConversations[newIndex].id);
  }
}

// Re-export event types and enums for external use
export { ConversationListEventType, ConversationSortOption, ConversationFilterOption };
