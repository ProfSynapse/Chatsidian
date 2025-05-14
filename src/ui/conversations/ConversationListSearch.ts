/**
 * ConversationListSearch Component
 * 
 * This component handles the search functionality for the conversation list.
 * It provides a search input field and handles search query updates.
 */

import { setIcon } from 'obsidian';

export interface ConversationListSearchProps {
  initialQuery: string;
  onSearch: (query: string) => void;
  onClear: () => void;
}

export class ConversationListSearch {
  private containerEl: HTMLElement;
  private props: ConversationListSearchProps;
  private searchInputEl: HTMLInputElement | null = null;
  private clearButtonEl: HTMLElement | null = null;
  
  constructor(containerEl: HTMLElement, props: ConversationListSearchProps) {
    this.containerEl = containerEl;
    this.props = props;
    
    this.render();
  }
  
  /**
   * Render the search component
   */
  private render(): void {
    this.containerEl.empty();
    
    // Create search input wrapper
    const searchWrapperEl = this.containerEl.createDiv({ cls: 'chatsidian-search-wrapper' });
    
    // Create search icon
    const searchIconEl = searchWrapperEl.createDiv({ cls: 'chatsidian-search-icon' });
    setIcon(searchIconEl, 'search');
    
    // Create search input
    this.searchInputEl = searchWrapperEl.createEl('input', {
      cls: 'chatsidian-search-input',
      attr: {
        type: 'text',
        placeholder: 'Search conversations...',
        value: this.props.initialQuery
      }
    });
    
    // Add event listeners
    this.searchInputEl.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const query = target.value.trim();
      this.props.onSearch(query);
      this.updateClearButton(query);
    });
    
    this.searchInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.clearSearch();
        e.preventDefault();
      }
    });
    
    // Create clear button if there's a query
    this.clearButtonEl = searchWrapperEl.createDiv({ 
      cls: 'chatsidian-search-clear' + (this.props.initialQuery ? '' : ' hidden') 
    });
    setIcon(this.clearButtonEl, 'x');
    this.clearButtonEl.setAttribute('aria-label', 'Clear search');
    
    // Add event listener to clear button
    this.clearButtonEl.addEventListener('click', () => {
      this.clearSearch();
    });
  }
  
  /**
   * Clear the search input
   */
  private clearSearch(): void {
    if (this.searchInputEl) {
      this.searchInputEl.value = '';
      this.updateClearButton('');
      this.props.onClear();
    }
  }
  
  /**
   * Update the clear button visibility
   */
  private updateClearButton(query: string): void {
    if (this.clearButtonEl) {
      if (query) {
        this.clearButtonEl.removeClass('hidden');
      } else {
        this.clearButtonEl.addClass('hidden');
      }
    }
  }
  
  /**
   * Set the search query
   */
  public setQuery(query: string): void {
    if (this.searchInputEl) {
      this.searchInputEl.value = query;
      this.updateClearButton(query);
    }
  }
  
  /**
   * Focus the search input
   */
  public focus(): void {
    if (this.searchInputEl) {
      this.searchInputEl.focus();
    }
  }
}