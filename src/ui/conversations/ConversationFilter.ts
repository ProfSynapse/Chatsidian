/**
 * Conversation Filter Module
 * 
 * This module handles filtering and sorting of conversations based on various criteria:
 * - Search query (title, content, tags)
 * - Tags
 * - Folders
 * - Starred status
 * - Sort options (modified date, created date, title)
 * 
 * It provides a clean API for filtering conversations without cluttering the main component.
 */

import { Conversation } from '../../models/Conversation';
import { ConversationFilterOption, ConversationSortOption } from './types';

/**
 * ConversationFilter class for filtering and sorting conversations
 */
export class ConversationFilter {
  /**
   * Filter and sort conversations based on criteria
   * 
   * @param conversations - All conversations
   * @param searchQuery - Optional search query
   * @param selectedTag - Optional tag to filter by
   * @param filterOption - Filter option (all, starred, untagged, unfiled)
   * @param sortOption - Sort option
   * @returns Filtered and sorted conversations
   */
  public static filterAndSort(
    conversations: Conversation[],
    searchQuery: string = '',
    selectedTag: string | null = null,
    filterOption: ConversationFilterOption = ConversationFilterOption.ALL,
    sortOption: ConversationSortOption = ConversationSortOption.MODIFIED_DESC
  ): Conversation[] {
    // Start with all conversations
    let result = [...conversations];
    
    // Apply search filter if there is a search query
    if (searchQuery) {
      result = ConversationFilter.applySearchFilter(result, searchQuery);
    }
    
    // Apply tag filter if there is a selected tag
    if (selectedTag) {
      result = ConversationFilter.applyTagFilter(result, selectedTag);
    }
    
    // Apply filter option
    result = ConversationFilter.applyFilterOption(result, filterOption);
    
    // Apply sort option
    result = ConversationFilter.applySortOption(result, sortOption);
    
    return result;
  }
  
  /**
   * Apply search filter to conversations
   * 
   * @param conversations - Conversations to filter
   * @param query - Search query
   * @returns Filtered conversations
   */
  private static applySearchFilter(conversations: Conversation[], query: string): Conversation[] {
    const lowerQuery = query.toLowerCase();
    
    return conversations.filter(conversation => {
      // Check title
      if (conversation.title.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      
      // Check tags
      if (conversation.tags && conversation.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) {
        return true;
      }
      
      // Check message content
      if (conversation.messages.some(message => message.content.toLowerCase().includes(lowerQuery))) {
        return true;
      }
      
      return false;
    });
  }
  
  /**
   * Apply tag filter to conversations
   * 
   * @param conversations - Conversations to filter
   * @param tag - Tag to filter by
   * @returns Filtered conversations
   */
  private static applyTagFilter(conversations: Conversation[], tag: string): Conversation[] {
    return conversations.filter(conversation => 
      conversation.tags && conversation.tags.includes(tag)
    );
  }
  
  /**
   * Apply filter option to conversations
   * 
   * @param conversations - Conversations to filter
   * @param filterOption - Filter option
   * @returns Filtered conversations
   */
  private static applyFilterOption(
    conversations: Conversation[],
    filterOption: ConversationFilterOption
  ): Conversation[] {
    switch (filterOption) {
      case ConversationFilterOption.STARRED:
        return conversations.filter(conversation => conversation.isStarred);
      
      case ConversationFilterOption.UNTAGGED:
        return conversations.filter(conversation => !conversation.tags || conversation.tags.length === 0);
      
      case ConversationFilterOption.UNFILED:
        return conversations.filter(conversation => !conversation.folderId);
      
      case ConversationFilterOption.ALL:
      default:
        return conversations;
    }
  }
  
  /**
   * Apply sort option to conversations
   * 
   * @param conversations - Conversations to sort
   * @param sortOption - Sort option
   * @returns Sorted conversations
   */
  private static applySortOption(
    conversations: Conversation[],
    sortOption: ConversationSortOption
  ): Conversation[] {
    const sorted = [...conversations];
    
    switch (sortOption) {
      case ConversationSortOption.MODIFIED_DESC:
        sorted.sort((a, b) => b.modifiedAt - a.modifiedAt);
        break;
      
      case ConversationSortOption.MODIFIED_ASC:
        sorted.sort((a, b) => a.modifiedAt - b.modifiedAt);
        break;
      
      case ConversationSortOption.CREATED_DESC:
        sorted.sort((a, b) => b.createdAt - a.createdAt);
        break;
      
      case ConversationSortOption.CREATED_ASC:
        sorted.sort((a, b) => a.createdAt - b.createdAt);
        break;
      
      case ConversationSortOption.TITLE_ASC:
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      
      case ConversationSortOption.TITLE_DESC:
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
    }
    
    return sorted;
  }
  
  /**
   * Extract all unique tags from conversations
   * 
   * @param conversations - All conversations
   * @returns Set of unique tags
   */
  public static extractTags(conversations: Conversation[]): Set<string> {
    const tags = new Set<string>();
    
    for (const conversation of conversations) {
      if (conversation.tags) {
        for (const tag of conversation.tags) {
          tags.add(tag);
        }
      }
    }
    
    return tags;
  }
}
