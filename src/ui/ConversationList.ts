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

import { App, Component, setIcon, Notice, Menu, MenuItem } from 'obsidian';
import { FolderCreationModal, FolderRenameModal, ConversationRenameModal } from './conversations/modals';
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
    console.log('ConversationList.initialize: Starting initialization');
    
    // Load conversations and folders
    await this.conversationManager.loadConversations();
    console.log('ConversationList.initialize: Conversations loaded');
    
    const folders = await this.folderManager.loadFolders();
    console.log('ConversationList.initialize: Folders loaded:', folders.map(f => ({id: f.id, name: f.name})));
    
    // Update available tags
    this.tagManager.updateAvailableTags(this.conversationManager.getConversations());
    console.log('ConversationList.initialize: Tags updated');
    
    // Register event handlers
    this.registerEventHandlers();
    console.log('ConversationList.initialize: Event handlers registered');
    
    // Register keyboard shortcuts
    this.registerKeyboardShortcuts();
    console.log('ConversationList.initialize: Keyboard shortcuts registered');
    
    // Render the conversation list
    console.log('ConversationList.initialize: About to render conversation list');
    this.render();
    console.log('ConversationList.initialize: Initialization complete');
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
    
    // Listen for conversation events from EventBus
    this.registerEvent(
      this.eventBus.on(ConversationListEventType.CONVERSATION_CREATED, () => {
        this.render();
      })
    );
    
    this.registerEvent(
      this.eventBus.on(ConversationListEventType.CONVERSATION_DELETED, () => {
        this.render();
      })
    );
    
    this.registerEvent(
      this.eventBus.on(ConversationListEventType.CONVERSATION_RENAMED, () => {
        this.render();
      })
    );
    
    // Listen for folder events from EventBus
    this.registerEvent(
      this.eventBus.on(ConversationListEventType.FOLDER_CREATED, (data) => {
        console.log('ConversationList: Received FOLDER_CREATED event:', data);
        console.log('ConversationList: Current folders before render:', this.folderManager.getFolders().map(f => ({id: f.id, name: f.name})));
        this.render();
      })
    );
    
    this.registerEvent(
      this.eventBus.on(ConversationListEventType.FOLDER_DELETED, () => {
        this.render();
      })
    );
    
    this.registerEvent(
      this.eventBus.on(ConversationListEventType.FOLDER_RENAMED, () => {
        this.render();
      })
    );
    
    // Create handlers for custom events and store references so we can remove them on unload
    const conversationCreateHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail;
      if (detail && detail.folderId) {
        this.createNewConversation(undefined, detail.folderId);
      } else {
        this.createNewConversation();
      }
    };
    
    const folderCreateHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail;
      if (detail && detail.parentId) {
        this.createFolder(undefined, detail.parentId);
      } else {
        this.createFolder();
      }
    };
    
    const folderMovedHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail;
      if (detail && detail.folderId && detail.targetFolderId) {
        // Handle folder moved event
        // This would typically update the folder's parent ID
        console.log(`Folder ${detail.folderId} moved to ${detail.targetFolderId}`);
        // TODO: Implement folder moving functionality
        this.render();
      }
    };
    
    const conversationMovedHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail;
      if (detail && detail.conversationId && detail.folderId !== undefined) {
        this.moveConversationToFolder(detail.conversationId, detail.folderId);
      }
    };

    // Add event listeners and register for cleanup on component unload
    document.addEventListener('conversation:create', conversationCreateHandler);
    document.addEventListener('folder:create', folderCreateHandler);
    document.addEventListener('folder:moved', folderMovedHandler);
    document.addEventListener('conversation:moved', conversationMovedHandler);
    
    // Register cleanup function to be called when component is unloaded
    this.register(() => {
      document.removeEventListener('conversation:create', conversationCreateHandler);
      document.removeEventListener('folder:create', folderCreateHandler);
      document.removeEventListener('folder:moved', folderMovedHandler);
      document.removeEventListener('conversation:moved', conversationMovedHandler);
    });
  }
  
  /**
   * Register keyboard shortcuts for the conversation list
   */
  private registerKeyboardShortcuts(): void {
    // Add keyboard event listener to the container element
    const boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.containerEl.addEventListener('keydown', boundHandleKeyDown);
    
    // Add global keyboard shortcuts
    const globalKeyHandler = (event: KeyboardEvent) => {
      // Alt+F: Focus conversation list
      if (event.altKey && event.key === 'f') {
        event.preventDefault();
        this.containerEl.focus();
      }
    };
    
    document.addEventListener('keydown', globalKeyHandler);
    
    // Register cleanup function
    this.register(() => {
      this.containerEl.removeEventListener('keydown', boundHandleKeyDown);
      document.removeEventListener('keydown', globalKeyHandler);
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
    // Ensure that rendering is called with fresh data
    requestAnimationFrame(() => {
      console.log('Rendering conversation list');
      this.containerEl.empty();
      this.containerEl.addClass('chatsidian-conversation-list');
      
      // Create header with Obsidian-like styling
      const headerEl = this.containerEl.createDiv({ cls: 'chatsidian-conversation-list-header' });
      
      // Left side of header with title
      const headerLeftEl = headerEl.createDiv({ cls: 'chatsidian-header-left' });
      const titleEl = headerLeftEl.createDiv({ cls: 'chatsidian-conversation-list-title' });
      titleEl.setText('Conversations');
      
      // Right side of header with action buttons
      const headerRightEl = headerEl.createDiv({ cls: 'chatsidian-header-actions' });
      
      // Create new folder button
      const newFolderEl = headerRightEl.createDiv({ 
        cls: 'chatsidian-icon-button chatsidian-new-folder-button' 
      });
      setIcon(newFolderEl, 'folder-plus');
      newFolderEl.setAttribute('aria-label', 'New Folder');
      newFolderEl.addEventListener('click', () => this.createFolder());
      
      // Create new conversation button
      const newButtonEl = headerRightEl.createDiv({ 
        cls: 'chatsidian-icon-button chatsidian-new-conversation-button' 
      });
      setIcon(newButtonEl, 'message-square-plus');
      newButtonEl.setAttribute('aria-label', 'New Conversation');
      newButtonEl.addEventListener('click', () => this.createNewConversation());
      
      // Create settings/filter button
      const settingsButtonEl = headerRightEl.createDiv({ 
        cls: 'chatsidian-icon-button chatsidian-filter-button' 
      });
      setIcon(settingsButtonEl, 'settings');
      settingsButtonEl.setAttribute('aria-label', 'Filters & Sorting');
      
      // Display active filter if not default
      if (this.filterOption !== ConversationFilterOption.ALL || 
          this.tagManager.getSelectedTag() !== null) {
        settingsButtonEl.addClass('chatsidian-filter-active');
      }
      
      // Show filter dropdown on click
      settingsButtonEl.addEventListener('click', (event) => {
        const menu = new Menu();
        
        // Sort section
        menu.addItem((item: MenuItem) => {
          item.setTitle('Sort by Last Modified (Newest)')
            .setIcon(this.sortOption === ConversationSortOption.MODIFIED_DESC ? 'checkmark' : '')
            .onClick(() => {
              this.setSortOption(ConversationSortOption.MODIFIED_DESC);
            });
        });
        
        menu.addItem((item: MenuItem) => {
          item.setTitle('Sort by Last Modified (Oldest)')
            .setIcon(this.sortOption === ConversationSortOption.MODIFIED_ASC ? 'checkmark' : '')
            .onClick(() => {
              this.setSortOption(ConversationSortOption.MODIFIED_ASC);
            });
        });
        
        menu.addItem((item: MenuItem) => {
          item.setTitle('Sort by Title')
            .setIcon(this.sortOption === ConversationSortOption.TITLE_ASC ? 'checkmark' : '')
            .onClick(() => {
              this.setSortOption(ConversationSortOption.TITLE_ASC);
            });
        });
        
        menu.addSeparator();
        
        // Filter section
        menu.addItem((item: MenuItem) => {
          item.setTitle('Show All Conversations')
            .setIcon(this.filterOption === ConversationFilterOption.ALL ? 'checkmark' : '')
            .onClick(() => {
              this.setFilterOption(ConversationFilterOption.ALL);
            });
        });
        
        menu.addItem((item: MenuItem) => {
          item.setTitle('Show Starred')
            .setIcon(this.filterOption === ConversationFilterOption.STARRED ? 'checkmark' : '')
            .onClick(() => {
              this.setFilterOption(ConversationFilterOption.STARRED);
            });
        });
        
        menu.addItem((item: MenuItem) => {
          item.setTitle('Show Untagged')
            .setIcon(this.filterOption === ConversationFilterOption.UNTAGGED ? 'checkmark' : '')
            .onClick(() => {
              this.setFilterOption(ConversationFilterOption.UNTAGGED);
            });
        });
        
        menu.addSeparator();
        
        // Tags section
        menu.addItem((item: MenuItem) => {
          item.setTitle('Filter by Tag');
        });
        
        // All tags option
        menu.addItem((item: MenuItem) => {
          item.setTitle('  All Tags')
            .setIcon(this.tagManager.getSelectedTag() === null ? 'checkmark' : '')
            .onClick(() => {
              this.tagManager.setSelectedTag(null);
              this.render();
            });
        });
        
        // Individual tags
        const tags = this.tagManager.getAvailableTags();
        if (tags.size > 0) {
          for (const tag of tags) {
            menu.addItem((item: MenuItem) => {
              item.setTitle(`  #${tag}`)
                .setIcon(this.tagManager.getSelectedTag() === tag ? 'checkmark' : '')
                .onClick(() => {
                  this.tagManager.setSelectedTag(tag);
                  this.render();
                });
            });
          }
        }
        
        menu.showAtMouseEvent(event);
      });
      
      // Create Obsidian-style search
      const searchContainerEl = this.containerEl.createDiv({ cls: 'chatsidian-search-container' });
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
      this.searchBar = new SearchBar(searchContainerEl, searchBarProps);
      
      // Create hidden filter controls (used through the dropdown menu now)
      const filterControlsEl = this.containerEl.createDiv({ 
        cls: 'chatsidian-filter-container hidden' 
      });
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
      
      // Ensure consistent data state before rendering
      this.tagManager.updateAvailableTags(this.conversationManager.getConversations());
      
      // Create conversation list container with context menu for empty space
      const listContainerEl = this.containerEl.createDiv({ cls: 'chatsidian-conversation-list-container' });
      
      // Set up drag and drop for the container to allow dropping conversations at root level
      this.setupContainerDragAndDrop(listContainerEl);
      
      // Add right-click context menu to empty space for folder creation
      listContainerEl.addEventListener('contextmenu', (event) => {
        // Only show context menu if clicking on the container itself, not a child element
        if (event.target === listContainerEl) {
          const menu = new Menu();
          
          // Add options for creating new items
          menu.addItem((item: MenuItem) => {
            item.setTitle('New Chat')
              .setIcon('message-square-plus')
              .onClick(() => this.createNewConversation());
          });
          
          menu.addItem((item: MenuItem) => {
            item.setTitle('New Folder')
              .setIcon('folder-plus')
              .onClick(() => this.createFolder());
          });
          
          menu.showAtMouseEvent(event);
          event.preventDefault();
        }
      });
      
      // Get conversations and apply filters - ensure we get a fresh copy
      const conversations = this.conversationManager.getConversations();
      const filteredConversations = ConversationFilter.filterAndSort(
        conversations,
        this.searchQuery,
        this.tagManager.getSelectedTag(),
        this.filterOption,
        this.sortOption
      );
      
      // Render conversations
      if (filteredConversations.length === 0 && this.searchQuery !== '') {
        const emptyEl = listContainerEl.createDiv({ cls: 'chatsidian-conversation-list-empty' });
        emptyEl.setText('No conversations match your search');
      } else if (filteredConversations.length === 0) {
        const emptyEl = listContainerEl.createDiv({ cls: 'chatsidian-conversation-list-empty' });
        emptyEl.setText('No conversations match your filters');
        
        // Create new conversation button when list is empty
        const newChatButtonEl = listContainerEl.createDiv({ 
          cls: 'chatsidian-empty-state-button'
        });
        newChatButtonEl.setText('Create a new chat');
        newChatButtonEl.addEventListener('click', () => this.createNewConversation());
      } else {
        // FINAL DEBUG APPROACH: Just render ALL folders at the root level to verify they can render
        console.log('ConversationList.render: All available folders from FolderManager:', this.folderManager.getFolders().map(f => ({id: f.id, name: f.name, parentId: f.parentId})));
        
        // Get all folders
        const allFolders = this.folderManager.getFolders();
        
        console.log(`ConversationList.render: DIRECT DEBUG - Rendering ALL ${allFolders.length} folders at root level`);
        
        if (allFolders.length === 0) {
          console.error("ConversationList.render: No folders found in FolderManager.getFolders()!");
        } else {
          // Just render all folders directly at the root level
          for (const folder of allFolders) {
            console.log(`ConversationList.render: Direct rendering of folder ${folder.name} (${folder.id})`);
            
            try {
              // Render folder directly without any filtering
              this.renderFolder(listContainerEl, folder);
              console.log(`ConversationList.render: Successfully rendered folder ${folder.name}`);
            } catch (error) {
              console.error(`ConversationList.render: ERROR rendering folder ${folder.name}:`, error);
            }
          }
        }
        
        // Render conversations that are not in folders
        const unfiledConversations = filteredConversations.filter(c => !c.folderId);
        for (const conversation of unfiledConversations) {
          this.renderConversation(listContainerEl, conversation);
        }
      }
    });
  }
  
  /**
   * Render a folder
   * 
   * @param containerEl - The container element to render the folder in
   * @param folder - The folder to render
   */
  private renderFolder(containerEl: HTMLElement, folder: any): void {
    console.log(`ConversationList.renderFolder: Rendering folder "${folder.name}" (${folder.id}), raw folder object:`, JSON.stringify(folder, null, 2));
    
    // Get child folders
    console.log(`ConversationList.renderFolder: Getting child folders for "${folder.name}" (${folder.id})`);
    const childFolders = this.folderManager.getChildFolders(folder.id);
    console.log(`ConversationList.renderFolder: Found ${childFolders.length} child folders for "${folder.name}"`);
    
    // Get conversations in this folder
    console.log(`ConversationList.renderFolder: Getting conversations for folder "${folder.name}" (${folder.id})`);
    const conversations = this.conversationManager.getConversations().filter(c => c.folderId === folder.id);
    console.log(`ConversationList.renderFolder: Found ${conversations.length} conversations in folder "${folder.name}"`);
    
    // Apply filters to conversations
    const filteredConversations = ConversationFilter.filterAndSort(
      conversations,
      this.searchQuery,
      this.tagManager.getSelectedTag(),
      this.filterOption,
      this.sortOption
    );
    console.log(`ConversationList.renderFolder: After filtering, found ${filteredConversations.length} conversations in folder "${folder.name}"`);
    
    // Force folders to be expanded during initial rendering to show their content
    const isExpanded = true; // Always show expanded for now to debug folder visibility
    
    // IMPORTANT: For debugging, we're going to render all folders regardless of content
    // The original code had a condition that would skip rendering empty folders
    // if (filteredConversations.length === 0 && childFolders.length === 0) { return; }
    // But we've removed that now to force all folders to render
    
    // Always render folder regardless of content for debugging
    console.log(`ConversationList.renderFolder: Creating FolderItem for "${folder.name}" (${folder.id})`);
    
    // Create folder item - ALWAYS RENDER IT REGARDLESS OF CONTENT
    new FolderItem(containerEl, {
      folder,
      isExpanded: isExpanded, // Force expansion to debug
      onToggleExpand: (id) => this.folderManager.toggleFolderExpansion(id),
      onRename: (id) => this.renameFolder(id),
      onDelete: (id) => this.deleteFolder(id),
      childFolders,
      conversations: filteredConversations,
      selectedConversationId: this.conversationManager.getSelectedConversationId(),
      onSelectConversation: (id) => this.selectConversation(id)
    });
    console.log(`ConversationList.renderFolder: COMPLETED rendering folder "${folder.name}" (${folder.id})`);
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
    try {
      // Find the conversation
      const conversation = this.conversationManager.getConversations().find(c => c.id === conversationId);
      
      if (!conversation) {
        console.error(`Conversation with ID ${conversationId} not found`);
        new Notice(`Conversation not found`);
        return;
      }
      
      // Show rename modal instead of using prompt()
      const renameModal = new ConversationRenameModal(
        this.app,
        conversation.title || "Untitled Conversation",
        async (newTitle) => {
          try {
            if (newTitle && newTitle !== conversation.title) {
              // Rename the conversation
              await this.conversationManager.renameConversation(conversationId, newTitle);
              
              // Re-render the conversation list
              this.render();
            }
          } catch (error) {
            console.error('Failed to rename conversation in modal callback:', error);
            // Re-throw to let the modal handle the error
            throw error;
          }
        }
      );
      
      renameModal.open();
    } catch (error) {
      console.error('Error preparing conversation rename:', error);
      new Notice('Failed to rename conversation: ' + (error.message || ''));
    }
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
    
    try {
      // Delete the conversation
      await this.conversationManager.deleteConversation(conversationId);
      
      // Force refresh tags if needed
      this.tagManager.updateAvailableTags(this.conversationManager.getConversations());
      if (this.filterControls) {
        this.filterControls.updateAvailableTags(this.tagManager.getAvailableTags());
      }
      
      // Explicitly re-render the conversation list with a small delay
      // to ensure all state is updated
      setTimeout(() => {
        this.render();
      }, 50);
    } catch (error) {
      console.error('Error deleting conversation:', error);
      new Notice(`Failed to delete conversation: ${error.message || ''}`);
    }
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
      console.log(`ConversationList.createFolder: Creating folder with name "${name || 'via modal'}" and parentId: ${parentId === undefined ? 'undefined' : parentId === null ? 'null' : `"${parentId}"`}`);
      
      // Normalize parentId
      const actualParentId = parentId === undefined || parentId === "undefined" ? null : parentId;
      
      if (name) {
        // If name is provided, create folder directly
        console.log(`ConversationList.createFolder: Creating folder directly with name "${name}" and normalized parentId: ${actualParentId === null ? 'null' : `"${actualParentId}"`}`);
        const newFolder = await this.folderManager.createFolder(name, actualParentId);
        this.render();
        return newFolder;
      } else {
        // Show a folder creation modal dialog instead of using prompt()
        console.log(`ConversationList.createFolder: Opening modal to create folder with normalized parentId: ${actualParentId === null ? 'null' : `"${actualParentId}"`}`);
        const folderModal = new FolderCreationModal(this.app, async (folderName) => {
          try {
            if (folderName) {
              console.log(`ConversationList.createFolder: Creating folder from modal with name "${folderName}" and normalized parentId: ${actualParentId === null ? 'null' : `"${actualParentId}"`}`);
              const newFolder = await this.folderManager.createFolder(folderName, actualParentId);
              this.render();
              return newFolder;
            }
          } catch (error) {
            console.error('Failed to create folder in modal callback:', error);
            // Re-throw to let the modal handle the error
            throw error;
          }
        });
        folderModal.open();
      }
    } catch (error) {
      console.error('Failed to create new folder:', error);
      new Notice('Failed to create new folder: ' + (error.message || ''));
      throw error;
    }
  }
  
  /** 
   * Access to the Obsidian App instance
   */
  private get app(): App {
    // Since this plugin is running in Obsidian, the global 'app' object is available
    return (window as any).app;
  }
  
  /**
   * Rename a folder
   * 
   * @param folderId - The ID of the folder to rename
   */
  public async renameFolder(folderId: string): Promise<void> {
    try {
      // Find the folder
      const folder = this.folderManager.getFolders().find(f => f.id === folderId);
      
      if (!folder) {
        console.error(`Folder with ID ${folderId} not found`);
        new Notice(`Folder not found`);
        return;
      }
      
      // Show rename modal instead of using prompt()
      const renameModal = new FolderRenameModal(
        this.app,
        folder.name,
        async (newName) => {
          try {
            if (newName && newName !== folder.name) {
              // Rename the folder
              await this.folderManager.renameFolder(folderId, newName);
              
              // Re-render the conversation list
              this.render();
            }
          } catch (error) {
            console.error('Failed to rename folder in modal callback:', error);
            // Re-throw to let the modal handle the error
            throw error;
          }
        }
      );
      
      renameModal.open();
    } catch (error) {
      console.error('Error preparing folder rename:', error);
      new Notice('Failed to rename folder: ' + (error.message || ''));
    }
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
    console.log(`ConversationList.moveConversationToFolder: Moving conversation ${conversationId} to folder ${folderId === null ? 'null' : folderId}`);
    
    // Call FolderManager to move the conversation
    await this.folderManager.moveConversationToFolder(conversationId, folderId);
    
    // Update the conversation in the conversation manager
    const conversation = this.conversationManager.getConversations().find(c => c.id === conversationId);
    if (conversation) {
      const oldFolderId = conversation.folderId;
      conversation.folderId = folderId;
      console.log(`ConversationList.moveConversationToFolder: Updated in-memory conversation folderId from ${oldFolderId === undefined ? 'undefined' : oldFolderId === null ? 'null' : oldFolderId} to ${folderId === null ? 'null' : folderId}`);
      
      // Ensure the update is also saved to disk
      console.log(`ConversationList.moveConversationToFolder: Calling conversationManager.updateConversation`);
      await this.conversationManager.updateConversation(conversation);
    } else {
      console.error(`ConversationList.moveConversationToFolder: Could not find conversation ${conversationId} in memory`);
    }
    
    // Re-render the conversation list
    console.log(`ConversationList.moveConversationToFolder: Re-rendering conversation list`);
    this.render();
    
    console.log(`ConversationList.moveConversationToFolder: Completed moving conversation`);
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
      await this.conversationManager.updateConversation(conversation);
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
   * Setup drag and drop for the container to allow dropping conversations at root level
   * 
   * @param containerEl - The container element to set up drag and drop for
   */
  private setupContainerDragAndDrop(containerEl: HTMLElement): void {
    // Add dragover event to show when an item can be dropped
    containerEl.addEventListener('dragover', (event) => {
      // Only accept dragover if it's directly on the container, not its children
      if (event.target === containerEl) {
        event.preventDefault();
        containerEl.addClass('chatsidian-drop-target');
      }
    });
    
    // Add dragleave event to remove highlighting
    containerEl.addEventListener('dragleave', (event) => {
      if (event.target === containerEl) {
        containerEl.removeClass('chatsidian-drop-target');
      }
    });
    
    // Add drop event to handle when an item is dropped
    containerEl.addEventListener('drop', (event) => {
      // Only accept drops if it's directly on the container, not its children
      if (event.target === containerEl) {
        event.preventDefault();
        containerEl.removeClass('chatsidian-drop-target');
        
        // Get the dragged data
        const data = event.dataTransfer?.getData('text/plain');
        
        if (data) {
          try {
            const dragData = JSON.parse(data);
            
            console.log('Drop detected on container:', dragData);
            
            // Handle conversation drop - move to root level (null folderId)
            if (dragData.type === 'conversation') {
              console.log(`Moving conversation ${dragData.id} to root level`);
              this.moveConversationToFolder(dragData.id, null);
            }
          } catch (error) {
            console.error('Failed to parse drag data:', error);
          }
        }
      }
    });
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
