/**
 * Conversation UI Component Types
 * 
 * This file contains types, enums, and interfaces used by the conversation UI components.
 * These shared types help maintain consistency across the conversation management system.
 */

import { Conversation, ConversationFolder } from '../../models/Conversation';
import { EventBus } from '../../core/EventBus';
import { StorageManager } from '../../core/StorageManager';

/**
 * Event types for conversation list events
 */
export enum ConversationListEventType {
  CONVERSATION_SELECTED = 'conversation-list:conversation-selected',
  CONVERSATION_CREATED = 'conversation-list:conversation-created',
  CONVERSATION_RENAMED = 'conversation-list:conversation-renamed',
  CONVERSATION_DELETED = 'conversation-list:conversation-deleted',
  FOLDER_CREATED = 'conversation-list:folder-created',
  FOLDER_RENAMED = 'conversation-list:folder-renamed',
  FOLDER_DELETED = 'conversation-list:folder-deleted',
  CONVERSATION_MOVED = 'conversation-list:conversation-moved',
  CONVERSATION_TAGGED = 'conversation-list:conversation-tagged',
  CONVERSATION_STARRED = 'conversation-list:conversation-starred',
}

/**
 * Sort options for the conversation list
 */
export enum ConversationSortOption {
  MODIFIED_DESC = 'modified-desc',
  MODIFIED_ASC = 'modified-asc',
  CREATED_DESC = 'created-desc',
  CREATED_ASC = 'created-asc',
  TITLE_ASC = 'title-asc',
  TITLE_DESC = 'title-desc',
}

/**
 * Filter options for the conversation list
 */
export enum ConversationFilterOption {
  ALL = 'all',
  STARRED = 'starred',
  UNTAGGED = 'untagged',
  UNFILED = 'unfiled',
}

/**
 * Common props shared by conversation UI components
 */
export interface ConversationComponentProps {
  eventBus: EventBus;
  storageManager: StorageManager;
}

/**
 * Props for components that need conversation data
 */
export interface WithConversationsProps extends ConversationComponentProps {
  conversations: Conversation[];
  selectedConversationId: string | null;
}

/**
 * Props for components that need folder data
 */
export interface WithFoldersProps extends ConversationComponentProps {
  folders: ConversationFolder[];
  expandedFolderIds: Set<string>;
}

/**
 * Props for components that need filtering data
 */
export interface WithFilteringProps extends ConversationComponentProps {
  searchQuery: string;
  sortOption: ConversationSortOption;
  filterOption: ConversationFilterOption;
  selectedTag: string | null;
  availableTags: Set<string>;
}

/**
 * Interface for conversation item rendering
 */
export interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onStar: (id: string) => void;
  onMove: (id: string, folderId: string | null) => void;
  onTagsUpdate: (id: string, tags: string[]) => void;
}

/**
 * Interface for folder item rendering
 */
export interface FolderItemProps {
  folder: ConversationFolder;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  childFolders: ConversationFolder[];
  conversations: Conversation[];
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
}
