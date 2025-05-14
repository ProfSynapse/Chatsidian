/**
 * ConversationListView Component
 * 
 * This is the main component for the conversation list that orchestrates
 * the rendering and functionality of the conversation sidebar.
 * It delegates specific responsibilities to specialized sub-components.
 */

import { Component } from 'obsidian';
import { EventBus } from '../../core/EventBus';
import { StorageManager } from '../../core/StorageManager';

// Import sub-components
import { ConversationManager } from './ConversationManager';
import { FolderManager } from './FolderManager';
import { TagManager } from './TagManager';
import { ConversationListHeader } from './ConversationListHeader';
import { ConversationListContent } from './ConversationListContent';
import { ConversationListSearch } from './ConversationListSearch';
import { ConversationListActions } from './ConversationListActions';
import { ConversationListKeyboardHandler } from './ConversationListKeyboardHandler';
import { ConversationListDragDrop } from './ConversationListDragDrop';

// Import types
import { 
  ConversationSortOption,
  ConversationFilterOption,
  ConversationListEventType
} from './types';
import { Conversation } from '../../models/Conversation';

/**
 * ConversationListView component for managing conversations
 */
export class ConversationListView extends Component {
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
   * Header component
   */
  private header: ConversationListHeader | null = null;
  
  /**
   * Search component 
   */
  private search: ConversationListSearch | null = null;
  
  /**
   * Content component
   */
  private content: ConversationListContent | null = null;
  
  /**
   * Keyboard handler
   */
  private keyboardHandler: ConversationListKeyboardHandler | null = null;
  
  /**
   * Drag and drop handler
   */
  private dragDropHandler: ConversationListDragDrop | null = null;
  
  /**
   * Actions manager
   */
  private actions: ConversationListActions | null = null;
  
  /**
   * Constructor for the ConversationListView
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
    console.log('ConversationListView.initialize: Starting initialization');
    
    // Load conversations and folders
    await this.conversationManager.loadConversations();
    const folders = await this.folderManager.loadFolders();
    
    // Update available tags
    this.tagManager.updateAvailableTags(this.conversationManager.getConversations());
    
    // Initialize all action handlers
    this.actions = new ConversationListActions(
      this.conversationManager,
      this.folderManager,
      this.tagManager,
      this.eventBus,
      this.storageManager
    );
    
    // Initialize keyboard support
    this.keyboardHandler = new ConversationListKeyboardHandler(
      this.containerEl,
      this.actions,
      this.conversationManager
    );
    
    // Register event handlers
    this.registerListEventHandlers();
    this.keyboardHandler.registerKeyboardShortcuts();
    
    // Render the conversation list
    this.render();
    console.log('ConversationListView.initialize: Initialization complete');
  }
  
  /**
   * Register event handlers for the conversation list
   */
  private registerListEventHandlers(): void {
    // Register for storage events
    this.registerEvent(
      this.eventBus.on('storage:reloaded', () => {
        // Reload conversations and folders
        this.conversationManager.loadConversations().then(() => {
          this.folderManager.loadFolders().then(() => {
            // Update available tags
            this.tagManager.updateAvailableTags(this.conversationManager.getConversations());
            
            // Re-render the conversation list
            this.render();
          });
        });
      })
    );
    
    // Listen for conversation events from EventBus
    const conversationEvents = [
      ConversationListEventType.CONVERSATION_CREATED,
      ConversationListEventType.CONVERSATION_DELETED,
      ConversationListEventType.CONVERSATION_RENAMED,
      ConversationListEventType.FOLDER_CREATED,
      ConversationListEventType.FOLDER_DELETED,
      ConversationListEventType.FOLDER_RENAMED
    ];
    
    conversationEvents.forEach(eventType => {
      this.registerEvent(
        this.eventBus.on(eventType, () => {
          this.render();
        })
      );
    });
  }
  
  /**
   * Render the conversation list
   */
  private render(): void {
    this.containerEl.empty();
    this.containerEl.addClass('chatsidian-conversation-list');
    
    // Render header 
    const headerEl = this.containerEl.createDiv({ cls: 'chatsidian-conversation-list-header' });
    this.header = new ConversationListHeader(
      headerEl, 
      {
        onCreateFolder: () => this.actions?.createFolder(),
        onCreateConversation: () => this.actions?.createNewConversation(),
        onFilterOptions: (event) => this.displayFilterMenu(event),
        sortOption: this.sortOption,
        filterOption: this.filterOption,
        tagManager: this.tagManager
      }
    );
    
    // Render search
    const searchContainerEl = this.containerEl.createDiv({ cls: 'chatsidian-search-container' });
    this.search = new ConversationListSearch(
      searchContainerEl,
      {
        initialQuery: this.searchQuery,
        onSearch: (query) => {
          this.searchQuery = query;
          this.render();
        },
        onClear: () => {
          this.searchQuery = '';
          this.render();
        }
      }
    );
    
    // Create conversation list container
    const listContainerEl = this.containerEl.createDiv({ cls: 'chatsidian-conversation-list-container' });
    
    // Set up drag and drop for the container
    if (this.actions) {
      this.dragDropHandler = new ConversationListDragDrop(
        listContainerEl,
        this.actions
      );
    }
    
    // Render content
    if (this.actions) {
      this.content = new ConversationListContent(
        listContainerEl,
        {
          conversationManager: this.conversationManager,
          folderManager: this.folderManager,
          tagManager: this.tagManager,
          searchQuery: this.searchQuery,
          sortOption: this.sortOption,
          filterOption: this.filterOption,
          actions: this.actions
        }
      );
    } else {
      console.error("ConversationListView: actions is null, cannot create ConversationListContent");
    }
  }
  
  /**
   * Display the filter menu
   */
  private displayFilterMenu(event: MouseEvent): void {
    // This method just delegates to the filter menu in the header
    this.header?.showFilterMenu(event);
  }
  
  /**
   * Set the search query
   * 
   * @param query - The search query
   */
  public setSearchQuery(query: string): void {
    this.searchQuery = query;
    
    // Update search bar if it exists
    this.search?.setQuery(query);
    
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
    this.render();
  }
  
  /**
   * Set the filter option
   * 
   * @param option - The filter option
   */
  public setFilterOption(option: ConversationFilterOption): void {
    this.filterOption = option;
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
}

// Re-export event types and enums for external use
export { ConversationListEventType, ConversationSortOption, ConversationFilterOption };