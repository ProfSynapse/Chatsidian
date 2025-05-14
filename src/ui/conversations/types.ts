/**
 * Conversation UI Component Types
 * 
 * This file contains types, enums, and interfaces used by the conversation UI components.
 * These shared types help maintain consistency across the conversation management system.
 */

import { Conversation, ConversationFolder } from '../../models/Conversation';
import { EventBus } from '../../core/EventBus';
import { StorageManager } from '../../core/StorageManager';
import { App, Component } from 'obsidian';
import { ConversationManager } from './ConversationManager';
import { FolderManager } from './FolderManager';
import { TagManager } from './TagManager';
import { SearchBar } from './SearchBar';
import { FilterControls } from './FilterControls';

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

/**
 * Context interface shared between modularized conversation list components
 */
export interface ConversationListContext {
  containerEl: HTMLElement;
  eventBus: EventBus;
  storageManager: StorageManager;
  conversationManager: ConversationManager;
  folderManager: FolderManager;
  tagManager: TagManager;
  searchQuery: string;
  sortOption: ConversationSortOption;
  filterOption: ConversationFilterOption;
  searchBar: SearchBar | null;
  filterControls: FilterControls | null;
  app: App;
  render: () => void;
  setSearchQuery: (query: string) => void;
  setSortOption: (option: ConversationSortOption) => void;
  setFilterOption: (option: ConversationFilterOption) => void;
  getSelectedConversation: () => Conversation | null;
  getConversations: () => Conversation[];
  createNewConversation: (title?: string, folderId?: string) => Promise<Conversation>;
  selectConversation: (conversationId: string) => void;
  renameConversation: (conversationId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  createFolder: (name?: string, parentId?: string) => Promise<any>;
  renameFolder: (folderId: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  moveConversationToFolder: (conversationId: string, folderId: string | null) => Promise<void>;
  toggleConversationStar: (conversationId: string) => Promise<void>;
  updateConversationTags: (conversationId: string, tags: string[]) => Promise<void>;
}

/**
 * Props for ConversationListHeader component
 */
export interface ConversationListHeaderProps {
  context: ConversationListContext;
}

/**
 * Props for ConversationListSearch component
 */
export interface ConversationListSearchProps {
  context: ConversationListContext;
}

/**
 * Props for ConversationListContent component
 */
export interface ConversationListContentProps {
  context: ConversationListContext;
}

/**
 * Props for ConversationListActions component
 */
export interface ConversationListActionsProps {
  context: ConversationListContext;
}

/**
 * Props for ConversationListKeyboardHandler component
 */
export interface ConversationListKeyboardHandlerProps {
  context: ConversationListContext;
}

/**
 * Props for ConversationListDragDrop component
 */
export interface ConversationListDragDropProps {
  context: ConversationListContext;
  containerEl: HTMLElement;
}

/**
 * Interface for sharing common methods across components
 */
export interface ConversationListMethods {
  initialize: () => Promise<void>;
  registerEventHandlers: () => void;
  render: () => void;
  
  // Actions
  createNewConversation: (title?: string, folderId?: string) => Promise<Conversation>;
  selectConversation: (conversationId: string) => void;
  renameConversation: (conversationId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  createFolder: (name?: string, parentId?: string) => Promise<any>;
  renameFolder: (folderId: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  moveConversationToFolder: (conversationId: string, folderId: string | null) => Promise<void>;
  toggleConversationStar: (conversationId: string) => Promise<void>;
  updateConversationTags: (conversationId: string, tags: string[]) => Promise<void>;
  
  // Settings and filtering
  setSearchQuery: (query: string) => void;
  setSortOption: (option: ConversationSortOption) => void;
  setFilterOption: (option: ConversationFilterOption) => void;
  
  // Utilities
  getSelectedConversation: () => Conversation | null;
  getConversations: () => Conversation[];
  renderFolder: (containerEl: HTMLElement, folder: ConversationFolder) => void;
  renderConversation: (containerEl: HTMLElement, conversation: Conversation) => void;
}
