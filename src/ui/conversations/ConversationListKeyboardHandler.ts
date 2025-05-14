/**
 * ConversationListKeyboardHandler Component
 * 
 * This component handles keyboard navigation and shortcuts for the conversation list.
 */

import { ConversationListActions } from './ConversationListActions';
import { ConversationManager } from './ConversationManager';
import { ConversationFilter } from './ConversationFilter';
import { ConversationSortOption, ConversationFilterOption } from './types';

export class ConversationListKeyboardHandler {
  private containerEl: HTMLElement;
  private actions: ConversationListActions;
  private conversationManager: ConversationManager;
  
  constructor(
    containerEl: HTMLElement,
    actions: ConversationListActions,
    conversationManager: ConversationManager
  ) {
    this.containerEl = containerEl;
    this.actions = actions;
    this.conversationManager = conversationManager;
  }
  
  /**
   * Register keyboard shortcuts for the conversation list
   */
  public registerKeyboardShortcuts(): void {
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
    
    // Register cleanup function via custom event listener
    const cleanup = () => {
      this.containerEl.removeEventListener('keydown', boundHandleKeyDown);
      document.removeEventListener('keydown', globalKeyHandler);
    };
    
    // Listen for component unload
    document.addEventListener('conversation-list:unload', cleanup, { once: true });
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
          this.actions.createNewConversation();
        }
        // Ctrl+Shift+N: Create new folder
        else if (event.ctrlKey && event.shiftKey) {
          event.preventDefault();
          this.actions.createFolder();
        }
        break;
        
      case 'f':
        // Ctrl+F: Focus search bar
        if (event.ctrlKey) {
          event.preventDefault();
          // Dispatch custom event to focus search
          const focusSearchEvent = new CustomEvent('conversation-list:focus-search', {
            bubbles: true
          });
          this.containerEl.dispatchEvent(focusSearchEvent);
        }
        break;
        
      case 's':
        // Ctrl+S: Star/unstar selected conversation
        if (event.ctrlKey) {
          event.preventDefault();
          const selectedId = this.conversationManager.getSelectedConversationId();
          if (selectedId) {
            this.actions.toggleConversationStar(selectedId);
          }
        }
        break;
        
      case 'Delete':
        // Delete: Delete selected conversation
        event.preventDefault();
        const selectedId = this.conversationManager.getSelectedConversationId();
        if (selectedId) {
          this.actions.deleteConversation(selectedId);
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
          this.actions.selectConversation(selectedConversationId);
        }
        break;
    }
  }
  
  /**
   * Select the next or previous conversation in the list
   * 
   * @param direction - 1 for next, -1 for previous
   */
  private selectAdjacentConversation(direction: number): void {
    // Get current filter state from the parent view
    // First, find the parent element
    const parentEl = this.containerEl.closest('.chatsidian-conversation-list');
    if (!parentEl) return;
    
    // Get filter state via custom event to avoid direct coupling
    const event = new CustomEvent('conversation-list:get-filter-state', {
      bubbles: true,
      detail: {
        callback: (data: { 
          searchQuery: string, 
          sortOption: ConversationSortOption, 
          filterOption: ConversationFilterOption,
          selectedTag: string | null
        }) => {
          this.performAdjacentConversationSelection(direction, data);
        }
      }
    });
    
    parentEl.dispatchEvent(event);
  }
  
  /**
   * Perform the adjacent conversation selection with filter data
   */
  private performAdjacentConversationSelection(
    direction: number, 
    filterData: {
      searchQuery: string,
      sortOption: ConversationSortOption,
      filterOption: ConversationFilterOption,
      selectedTag: string | null
    }
  ): void {
    // Get all visible conversations
    const conversations = this.conversationManager.getConversations();
    const filteredConversations = ConversationFilter.filterAndSort(
      conversations,
      filterData.searchQuery,
      filterData.selectedTag,
      filterData.filterOption,
      filterData.sortOption
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
    this.actions.selectConversation(filteredConversations[newIndex].id);
  }
}