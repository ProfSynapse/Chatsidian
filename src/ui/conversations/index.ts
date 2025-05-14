/**
 * Conversations Module Index
 * 
 * This file exports all conversation-related components and types
 * to provide a clean and organized API for the conversation system.
 */

// Export the main view component
export { ConversationListView } from './ConversationListView';

// Export supporting components
export { ConversationListHeader } from './ConversationListHeader';
export { ConversationListContent } from './ConversationListContent';
export { ConversationListSearch } from './ConversationListSearch';
export { ConversationListActions } from './ConversationListActions';
export { ConversationListKeyboardHandler } from './ConversationListKeyboardHandler';
export { ConversationListDragDrop } from './ConversationListDragDrop';

// Export managers
export { ConversationManager } from './ConversationManager';
export { FolderManager } from './FolderManager';
export { TagManager } from './TagManager';

// Export item components
export { ConversationItem } from './ConversationItem';
export { FolderItem } from './FolderItem';

// Export utility components
export { ConversationFilter } from './ConversationFilter';
export { FilterControls } from './FilterControls';
export { SearchBar } from './SearchBar';

// Export enums
export {
  ConversationListEventType,
  ConversationSortOption,
  ConversationFilterOption
} from './types';

// Export types
export type {
  ConversationItemProps,
  FolderItemProps,
  ConversationComponentProps,
  WithConversationsProps,
  WithFoldersProps,
  WithFilteringProps
} from './types';