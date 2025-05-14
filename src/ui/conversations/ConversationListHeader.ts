/**
 * ConversationListHeader Component
 * 
 * This component handles the header section of the conversation list,
 * including the title, buttons for creating folders and conversations,
 * and filter/sort menu.
 */

import { Menu, MenuItem, setIcon } from 'obsidian';
import { ConversationSortOption, ConversationFilterOption } from './types';
import { TagManager } from './TagManager';

interface ConversationListHeaderProps {
  onCreateFolder: () => void;
  onCreateConversation: () => void;
  onFilterOptions: (event: MouseEvent) => void;
  sortOption: ConversationSortOption;
  filterOption: ConversationFilterOption;
  tagManager: TagManager;
}

export class ConversationListHeader {
  private containerEl: HTMLElement;
  private props: ConversationListHeaderProps;
  private settingsButtonEl: HTMLElement | null = null;
  
  constructor(containerEl: HTMLElement, props: ConversationListHeaderProps) {
    this.containerEl = containerEl;
    this.props = props;
    
    this.render();
  }
  
  /**
   * Render the header
   */
  private render(): void {
    // Left side of header with title
    const headerLeftEl = this.containerEl.createDiv({ cls: 'chatsidian-header-left' });
    const titleEl = headerLeftEl.createDiv({ cls: 'chatsidian-conversation-list-title' });
    titleEl.setText('Conversations');
    
    // Right side of header with action buttons
    const headerRightEl = this.containerEl.createDiv({ cls: 'chatsidian-header-actions' });
    
    // Create new folder button
    const newFolderEl = headerRightEl.createDiv({ 
      cls: 'chatsidian-icon-button chatsidian-new-folder-button' 
    });
    setIcon(newFolderEl, 'folder-plus');
    newFolderEl.setAttribute('aria-label', 'New Folder');
    newFolderEl.addEventListener('click', () => this.props.onCreateFolder());
    
    // Create new conversation button
    const newButtonEl = headerRightEl.createDiv({ 
      cls: 'chatsidian-icon-button chatsidian-new-conversation-button' 
    });
    setIcon(newButtonEl, 'message-square-plus');
    newButtonEl.setAttribute('aria-label', 'New Conversation');
    newButtonEl.addEventListener('click', () => this.props.onCreateConversation());
    
    // Create settings/filter button
    this.settingsButtonEl = headerRightEl.createDiv({ 
      cls: 'chatsidian-icon-button chatsidian-filter-button' 
    });
    setIcon(this.settingsButtonEl, 'settings');
    this.settingsButtonEl.setAttribute('aria-label', 'Filters & Sorting');
    
    // Display active filter if not default
    if (this.props.filterOption !== ConversationFilterOption.ALL || 
        this.props.tagManager.getSelectedTag() !== null) {
      this.settingsButtonEl.addClass('chatsidian-filter-active');
    }
    
    // Show filter dropdown on click
    this.settingsButtonEl.addEventListener('click', (event) => {
      this.props.onFilterOptions(event);
    });
  }
  
  /**
   * Display the filter menu
   */
  public showFilterMenu(event: MouseEvent): void {
    const menu = new Menu();
    
    // Sort section
    menu.addItem((item: MenuItem) => {
      item.setTitle('Sort by Last Modified (Newest)')
        .setIcon(this.props.sortOption === ConversationSortOption.MODIFIED_DESC ? 'checkmark' : '')
        .onClick(() => {
          this.updateSortOption(ConversationSortOption.MODIFIED_DESC);
        });
    });
    
    menu.addItem((item: MenuItem) => {
      item.setTitle('Sort by Last Modified (Oldest)')
        .setIcon(this.props.sortOption === ConversationSortOption.MODIFIED_ASC ? 'checkmark' : '')
        .onClick(() => {
          this.updateSortOption(ConversationSortOption.MODIFIED_ASC);
        });
    });
    
    menu.addItem((item: MenuItem) => {
      item.setTitle('Sort by Title')
        .setIcon(this.props.sortOption === ConversationSortOption.TITLE_ASC ? 'checkmark' : '')
        .onClick(() => {
          this.updateSortOption(ConversationSortOption.TITLE_ASC);
        });
    });
    
    menu.addSeparator();
    
    // Filter section
    menu.addItem((item: MenuItem) => {
      item.setTitle('Show All Conversations')
        .setIcon(this.props.filterOption === ConversationFilterOption.ALL ? 'checkmark' : '')
        .onClick(() => {
          this.updateFilterOption(ConversationFilterOption.ALL);
        });
    });
    
    menu.addItem((item: MenuItem) => {
      item.setTitle('Show Starred')
        .setIcon(this.props.filterOption === ConversationFilterOption.STARRED ? 'checkmark' : '')
        .onClick(() => {
          this.updateFilterOption(ConversationFilterOption.STARRED);
        });
    });
    
    menu.addItem((item: MenuItem) => {
      item.setTitle('Show Untagged')
        .setIcon(this.props.filterOption === ConversationFilterOption.UNTAGGED ? 'checkmark' : '')
        .onClick(() => {
          this.updateFilterOption(ConversationFilterOption.UNTAGGED);
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
        .setIcon(this.props.tagManager.getSelectedTag() === null ? 'checkmark' : '')
        .onClick(() => {
          this.props.tagManager.setSelectedTag(null);
          this.updateHeader();
        });
    });
    
    // Individual tags
    const tags = this.props.tagManager.getAvailableTags();
    if (tags.size > 0) {
      for (const tag of tags) {
        menu.addItem((item: MenuItem) => {
          item.setTitle(`  #${tag}`)
            .setIcon(this.props.tagManager.getSelectedTag() === tag ? 'checkmark' : '')
            .onClick(() => {
              this.props.tagManager.setSelectedTag(tag);
              this.updateHeader();
            });
        });
      }
    }
    
    menu.showAtMouseEvent(event);
  }
  
  /**
   * Update the sort option
   */
  private updateSortOption(option: ConversationSortOption): void {
    if (this.props.sortOption !== option) {
      // Update through the parent to re-render
      const parentView = this.containerEl.closest('.chatsidian-conversation-list');
      if (parentView) {
        const customEvent = new CustomEvent('conversation-list:sort-changed', {
          detail: { sortOption: option },
          bubbles: true
        });
        parentView.dispatchEvent(customEvent);
      }
    }
  }
  
  /**
   * Update the filter option
   */
  private updateFilterOption(option: ConversationFilterOption): void {
    if (this.props.filterOption !== option) {
      // Update through the parent to re-render
      const parentView = this.containerEl.closest('.chatsidian-conversation-list');
      if (parentView) {
        const customEvent = new CustomEvent('conversation-list:filter-changed', {
          detail: { filterOption: option },
          bubbles: true
        });
        parentView.dispatchEvent(customEvent);
      }
    }
  }
  
  /**
   * Update the header to reflect filter changes
   */
  private updateHeader(): void {
    // Display active filter if not default
    if (this.settingsButtonEl) {
      if (this.props.filterOption !== ConversationFilterOption.ALL || 
          this.props.tagManager.getSelectedTag() !== null) {
        this.settingsButtonEl.addClass('chatsidian-filter-active');
      } else {
        this.settingsButtonEl.removeClass('chatsidian-filter-active');
      }
    }
    
    // Notify parent to update
    const parentView = this.containerEl.closest('.chatsidian-conversation-list');
    if (parentView) {
      const customEvent = new CustomEvent('conversation-list:tag-filter-changed', {
        bubbles: true
      });
      parentView.dispatchEvent(customEvent);
    }
  }
}