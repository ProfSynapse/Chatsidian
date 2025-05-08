/**
 * Filter Controls Component
 * 
 * This component renders controls for filtering and sorting conversations.
 * It includes sort options, filter options, and tag selection.
 */

import { DropdownComponent, setIcon } from 'obsidian';
import { ConversationFilterOption, ConversationSortOption } from './types';

/**
 * Props for the FilterControls component
 */
export interface FilterControlsProps {
  initialSortOption?: ConversationSortOption;
  initialFilterOption?: ConversationFilterOption;
  initialSelectedTag?: string | null;
  availableTags: Set<string>;
  onSortChange: (option: ConversationSortOption) => void;
  onFilterChange: (option: ConversationFilterOption) => void;
  onTagSelect: (tag: string | null) => void;
}

/**
 * FilterControls class for filtering and sorting conversations
 */
export class FilterControls {
  private containerEl: HTMLElement;
  private sortDropdown: DropdownComponent;
  private filterDropdown: DropdownComponent;
  private tagDropdown: DropdownComponent;
  private callbacks: {
    onSortChange: (option: ConversationSortOption) => void;
    onFilterChange: (option: ConversationFilterOption) => void;
    onTagSelect: (tag: string | null) => void;
  };
  private sortOption: ConversationSortOption;
  private filterOption: ConversationFilterOption;
  private selectedTag: string | null;
  private availableTags: Set<string>;
  
  /**
   * Create a new FilterControls
   * 
   * @param containerEl - Container element to render the controls in
   * @param props - Props for the filter controls
   */
  constructor(containerEl: HTMLElement, props: FilterControlsProps) {
    this.containerEl = containerEl;
    this.callbacks = {
      onSortChange: props.onSortChange,
      onFilterChange: props.onFilterChange,
      onTagSelect: props.onTagSelect
    };
    this.sortOption = props.initialSortOption || ConversationSortOption.MODIFIED_DESC;
    this.filterOption = props.initialFilterOption || ConversationFilterOption.ALL;
    this.selectedTag = props.initialSelectedTag || null;
    this.availableTags = props.availableTags;
    
    this.render();
  }
  
  /**
   * Render the filter controls
   */
  private render(): void {
    const controlsEl = this.containerEl.createDiv({ cls: 'chatsidian-filter-controls' });
    
    // Create sort controls
    const sortEl = controlsEl.createDiv({ cls: 'chatsidian-sort-controls' });
    const sortLabelEl = sortEl.createDiv({ cls: 'chatsidian-control-label' });
    sortLabelEl.setText('Sort:');
    
    const sortDropdownEl = sortEl.createDiv({ cls: 'chatsidian-sort-dropdown' });
    this.sortDropdown = new DropdownComponent(sortDropdownEl);
    this.sortDropdown
      .addOption(ConversationSortOption.MODIFIED_DESC, 'Last modified (newest)')
      .addOption(ConversationSortOption.MODIFIED_ASC, 'Last modified (oldest)')
      .addOption(ConversationSortOption.CREATED_DESC, 'Created (newest)')
      .addOption(ConversationSortOption.CREATED_ASC, 'Created (oldest)')
      .addOption(ConversationSortOption.TITLE_ASC, 'Title (A-Z)')
      .addOption(ConversationSortOption.TITLE_DESC, 'Title (Z-A)')
      .setValue(this.sortOption)
      .onChange(value => {
        this.sortOption = value as ConversationSortOption;
        this.callbacks.onSortChange(this.sortOption);
      });
    
    // Create filter controls
    const filterEl = controlsEl.createDiv({ cls: 'chatsidian-filter-controls' });
    const filterLabelEl = filterEl.createDiv({ cls: 'chatsidian-control-label' });
    filterLabelEl.setText('Filter:');
    
    const filterDropdownEl = filterEl.createDiv({ cls: 'chatsidian-filter-dropdown' });
    this.filterDropdown = new DropdownComponent(filterDropdownEl);
    this.filterDropdown
      .addOption(ConversationFilterOption.ALL, 'All conversations')
      .addOption(ConversationFilterOption.STARRED, 'Starred')
      .addOption(ConversationFilterOption.UNTAGGED, 'Untagged')
      .addOption(ConversationFilterOption.UNFILED, 'Unfiled')
      .setValue(this.filterOption)
      .onChange(value => {
        this.filterOption = value as ConversationFilterOption;
        this.callbacks.onFilterChange(this.filterOption);
      });
    
    // Create tag controls
    const tagEl = controlsEl.createDiv({ cls: 'chatsidian-tag-controls' });
    const tagLabelEl = tagEl.createDiv({ cls: 'chatsidian-control-label' });
    tagLabelEl.setText('Tag:');
    
    const tagDropdownEl = tagEl.createDiv({ cls: 'chatsidian-tag-dropdown' });
    this.tagDropdown = new DropdownComponent(tagDropdownEl);
    
    // Add "All tags" option
    this.tagDropdown.addOption('', 'All tags');
    
    // Add available tags
    for (const tag of this.availableTags) {
      this.tagDropdown.addOption(tag, tag);
    }
    
    // Set initial value
    this.tagDropdown.setValue(this.selectedTag || '');
    
    // Add change handler
    this.tagDropdown.onChange(value => {
      this.selectedTag = value || null;
      this.callbacks.onTagSelect(this.selectedTag);
    });
  }
  
  /**
   * Update available tags
   * 
   * @param tags - New available tags
   */
  public updateAvailableTags(tags: Set<string>): void {
    this.availableTags = tags;
    
    // Clear existing options
    this.tagDropdown.selectEl.empty();
    
    // Add "All tags" option
    this.tagDropdown.addOption('', 'All tags');
    
    // Add available tags
    for (const tag of this.availableTags) {
      this.tagDropdown.addOption(tag, tag);
    }
    
    // Set current value
    this.tagDropdown.setValue(this.selectedTag || '');
  }
  
  /**
   * Get the current sort option
   * 
   * @returns The current sort option
   */
  public getSortOption(): ConversationSortOption {
    return this.sortOption;
  }
  
  /**
   * Set the sort option
   * 
   * @param option - The sort option to set
   */
  public setSortOption(option: ConversationSortOption): void {
    this.sortOption = option;
    this.sortDropdown.setValue(option);
    this.callbacks.onSortChange(option);
  }
  
  /**
   * Get the current filter option
   * 
   * @returns The current filter option
   */
  public getFilterOption(): ConversationFilterOption {
    return this.filterOption;
  }
  
  /**
   * Set the filter option
   * 
   * @param option - The filter option to set
   */
  public setFilterOption(option: ConversationFilterOption): void {
    this.filterOption = option;
    this.filterDropdown.setValue(option);
    this.callbacks.onFilterChange(option);
  }
  
  /**
   * Get the currently selected tag
   * 
   * @returns The currently selected tag
   */
  public getSelectedTag(): string | null {
    return this.selectedTag;
  }
  
  /**
   * Set the selected tag
   * 
   * @param tag - The tag to select
   */
  public setSelectedTag(tag: string | null): void {
    this.selectedTag = tag;
    this.tagDropdown.setValue(tag || '');
    this.callbacks.onTagSelect(tag);
  }
}
