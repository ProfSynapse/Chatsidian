/**
 * Search Bar Component
 * 
 * This component renders a search bar for filtering conversations.
 * It handles user input and emits search events.
 */

import { TextComponent, setIcon } from 'obsidian';

/**
 * Props for the SearchBar component
 */
export interface SearchBarProps {
  initialQuery?: string;
  onSearch: (query: string) => void;
  onClear: () => void;
}

/**
 * SearchBar class for searching conversations
 */
export class SearchBar {
  private containerEl: HTMLElement;
  private searchInput: TextComponent;
  private callbacks: {
    onSearch: (query: string) => void;
    onClear: () => void;
  };
  private query: string = '';
  
  /**
   * Create a new SearchBar
   * 
   * @param containerEl - Container element to render the search bar in
   * @param props - Props for the search bar
   */
  constructor(containerEl: HTMLElement, props: SearchBarProps) {
    this.containerEl = containerEl;
    this.callbacks = {
      onSearch: props.onSearch,
      onClear: props.onClear
    };
    this.query = props.initialQuery || '';
    
    this.render();
  }
  
  /**
   * Render the search bar
   */
  private render(): void {
    const searchBarEl = this.containerEl.createDiv({ cls: 'chatsidian-search-bar' });
    
    // Create search icon (matching Obsidian's style)
    const searchIconEl = searchBarEl.createDiv({ cls: 'chatsidian-search-icon' });
    setIcon(searchIconEl, 'search');
    
    // Create search input with Obsidian styling
    const searchInputEl = searchBarEl.createDiv({ cls: 'chatsidian-search-input' });
    this.searchInput = new TextComponent(searchInputEl);
    this.searchInput
      .setPlaceholder('Search chats...')
      .setValue(this.query)
      .onChange(value => {
        this.query = value;
        this.callbacks.onSearch(value);
        
        // Show/hide clear button based on whether there's a query
        if (value) {
          clearButtonEl.style.display = 'flex';
          searchBarEl.addClass('chatsidian-search-has-query');
        } else {
          clearButtonEl.style.display = 'none';
          searchBarEl.removeClass('chatsidian-search-has-query');
        }
      });
      
    // Add enter key handler for immediate search
    this.searchInput.inputEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        this.callbacks.onSearch(this.query);
      }
      
      // Escape clears the search
      if (event.key === 'Escape') {
        this.clear();
        event.preventDefault();
      }
    });
    
    // Create clear button with Obsidian styling
    const clearButtonEl = searchBarEl.createDiv({ cls: 'chatsidian-search-clear' });
    setIcon(clearButtonEl, 'x');
    clearButtonEl.setAttribute('aria-label', 'Clear search');
    clearButtonEl.addEventListener('click', () => {
      this.searchInput.setValue('');
      this.query = '';
      this.callbacks.onClear();
      clearButtonEl.style.display = 'none';
      searchBarEl.removeClass('chatsidian-search-has-query');
      // Focus back on the search input
      this.searchInput.inputEl.focus();
    });
    
    // Initially hide clear button if there's no query
    if (!this.query) {
      clearButtonEl.style.display = 'none';
    } else {
      searchBarEl.addClass('chatsidian-search-has-query');
    }
  }
  
  /**
   * Get the current search query
   * 
   * @returns The current search query
   */
  public getQuery(): string {
    return this.query;
  }
  
  /**
   * Set the search query
   * 
   * @param query - The search query to set
   */
  public setQuery(query: string): void {
    this.query = query;
    this.searchInput.setValue(query);
    this.callbacks.onSearch(query);
  }
  
  /**
   * Clear the search query
   */
  public clear(): void {
    this.setQuery('');
    this.callbacks.onClear();
  }
  
  /**
   * Focus the search input
   */
  public focus(): void {
    this.searchInput.inputEl.focus();
  }
}
