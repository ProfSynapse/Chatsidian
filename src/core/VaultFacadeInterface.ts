/**
 * VaultFacadeInterface.ts
 * 
 * This file defines the interfaces and types for the VaultFacade abstraction layer.
 * The VaultFacade provides a simplified, consistent interface for all Obsidian vault operations,
 * improving testability, maintainability, and performance of Chatsidian.
 * 
 * It serves as a contract between the plugin and the Obsidian API, allowing for
 * easier mocking in tests and consistent error handling across the application.
 * 
 * Related files:
 * - VaultErrors.ts: Custom error types for vault operations
 * - VaultFacade.ts: Implementation of the VaultFacade interface
 * - MockVaultFacade.ts: Mock implementation for testing
 */

import { TFile, TFolder } from 'obsidian';

/**
 * Options for listing folder contents
 */
export interface ListFolderOptions {
  /** Whether to include files in the results (default: true) */
  includeFiles?: boolean;
  
  /** Whether to include folders in the results (default: true) */
  includeFolders?: boolean;
  
  /** Whether to include hidden files/folders (starting with .) (default: false) */
  includeHidden?: boolean;
  
  /** Whether to recursively list contents of subfolders (default: false) */
  recursive?: boolean;
}

/**
 * Options for searching content
 */
export interface SearchOptions {
  /** Whether to include the full content in the results (default: false) */
  includeContent?: boolean;
  
  /** Maximum number of results to return (default: 20) */
  limit?: number;
  
  /** Paths to restrict the search to (default: all paths) */
  paths?: string[];
  
  /** Whether to search in file names (default: true) */
  searchFilenames?: boolean;
  
  /** Whether to search in file content (default: true) */
  searchContent?: boolean;
  
  /** Whether to search in frontmatter (default: true) */
  searchFrontmatter?: boolean;
  
  /** Whether to search in tags (default: true) */
  searchTags?: boolean;
}

/**
 * Result of a search operation
 */
export interface SearchResult {
  /** Path to the file */
  path: string;
  
  /** Relevance score (higher is more relevant) */
  score: number;
  
  /** Text snippet showing the context of the match */
  snippet: string;
  
  /** Full content of the file (only included if includeContent is true) */
  content?: string;
  
  /** Indicates what part of the file matched (title, content, frontmatter, tags) */
  matchType?: 'title' | 'content' | 'frontmatter' | 'tags' | 'heading' | 'multiple';
}

/**
 * Result of a note read operation
 */
export interface NoteReadResult {
  /** Content of the note */
  content: string;
  
  /** Path to the note */
  path: string;
  
  /** Frontmatter of the note, if any */
  frontmatter?: Record<string, any>;
  
  /** Reference to the Obsidian TFile object */
  file?: TFile;
}

/**
 * Result of a note create/update/rename operation
 */
export interface NoteOperationResult {
  /** Path to the note */
  path: string;
  
  /** Reference to the Obsidian TFile object */
  file?: TFile;
}

/**
 * Result of a folder list operation
 */
export interface FolderListResult {
  /** Paths to files in the folder */
  files: string[];
  
  /** Paths to folders in the folder */
  folders: string[];
  
  /** Path to the folder */
  path: string;
}

/**
 * Core interface for VaultFacade
 */
export interface IVaultFacade {
  // Basic file operations
  
  /**
   * Read a note by path
   * @param path - Path to the note
   * @returns Promise resolving to note content and path
   * @throws FileNotFoundError if file doesn't exist
   */
  readNote(path: string): Promise<NoteReadResult>;
  
  /**
   * Create a new note
   * @param path - Path to the note
   * @param content - Note content
   * @param overwrite - Whether to overwrite if file exists (default: false)
   * @returns Promise resolving to created note path
   * @throws FileExistsError if file exists and overwrite is false
   */
  createNote(path: string, content: string, overwrite?: boolean): Promise<NoteOperationResult>;
  
  /**
   * Update a note's content
   * @param path - Path to the note
   * @param content - New content
   * @returns Promise resolving to updated note path
   * @throws FileNotFoundError if file doesn't exist
   */
  updateNote(path: string, content: string): Promise<NoteOperationResult>;
  
  /**
   * Delete a note
   * @param path - Path to the note
   * @returns Promise resolving when note is deleted
   * @throws FileNotFoundError if file doesn't exist
   */
  deleteNote(path: string): Promise<void>;
  
  /**
   * Rename or move a note
   * @param path - Current path
   * @param newPath - New path
   * @returns Promise resolving to new path
   * @throws FileNotFoundError if file doesn't exist
   * @throws FileExistsError if destination file exists
   */
  renameNote(path: string, newPath: string): Promise<NoteOperationResult>;
  
  // Basic folder operations
  
  /**
   * List files and folders in a directory
   * @param path - Path to the folder
   * @param options - Listing options
   * @returns Promise resolving to files and folders in the directory
   * @throws FolderNotFoundError if folder doesn't exist
   */
  listFolder(path: string, options?: ListFolderOptions): Promise<FolderListResult>;
  
  /**
   * Create a new folder
   * @param path - Path to the folder
   * @returns Promise resolving when folder is created
   */
  createFolder(path: string): Promise<void>;
  
  /**
   * Delete a folder
   * @param path - Path to the folder
   * @param recursive - Whether to delete contents recursively (default: false)
   * @returns Promise resolving when folder is deleted
   * @throws FolderNotFoundError if folder doesn't exist
   */
  deleteFolder(path: string, recursive?: boolean): Promise<void>;
  
  // Search operations
  
  /**
   * Search content by query string
   * @param query - Search query
   * @param options - Search options
   * @returns Promise resolving to search results
   */
  searchContent(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  
  /**
   * Search files by tag
   * @param tag - Tag to search for (with or without #)
   * @returns Promise resolving to files with matching tag
   */
  searchByTag(tag: string): Promise<string[]>;
  
  // Frontmatter operations
  
  /**
   * Update frontmatter of a note
   * @param path - Path to the note
   * @param updateFn - Function to update frontmatter
   * @returns Promise resolving when frontmatter is updated
   * @throws FileNotFoundError if file doesn't exist
   */
  updateFrontmatter(path: string, updateFn: (frontmatter: Record<string, any>) => void): Promise<void>;
  
  // Attachment operations
  
  /**
   * Get available path for an attachment
   * @param filename - Attachment filename
   * @param sourcePath - Source note path
   * @returns Promise resolving to available path
   */
  getAttachmentPath(filename: string, sourcePath: string): Promise<string>;
  
  // Utility methods
  
  /**
   * Check if a file exists
   * @param path - Path to check
   * @returns Promise resolving to true if file exists, false otherwise
   */
  fileExists(path: string): Promise<boolean>;
  
  /**
   * Check if a folder exists
   * @param path - Path to check
   * @returns Promise resolving to true if folder exists, false otherwise
   */
  folderExists(path: string): Promise<boolean>;
  
  /**
   * Get the parent folder of a path
   * @param path - Path to get parent folder of
   * @returns Parent folder path
   */
  getParentFolder(path: string): string;
  
  /**
   * Normalize a path (remove leading/trailing slashes, handle relative paths)
   * @param path - Path to normalize
   * @returns Normalized path
   */
  normalizePath(path: string): string;
  
  // Event registration
  
  /**
   * Register an event listener
   * @param name - Event name
   * @param callback - Callback function
   */
  on(name: string, callback: (data: any) => void): void;
  
  /**
   * Unregister an event listener
   * @param name - Event name
   * @param callback - Callback function
   */
  off(name: string, callback: (data: any) => void): void;
}

/**
 * Event names for VaultFacade events
 */
export enum VaultFacadeEventType {
  // Note events
  NOTE_READ = 'vaultFacade:noteRead',
  NOTE_CREATED = 'vaultFacade:noteCreated',
  NOTE_UPDATED = 'vaultFacade:noteUpdated',
  NOTE_DELETED = 'vaultFacade:noteDeleted',
  NOTE_RENAMED = 'vaultFacade:noteRenamed',
  
  // Folder events
  FOLDER_LISTED = 'vaultFacade:folderListed',
  FOLDER_CREATED = 'vaultFacade:folderCreated',
  FOLDER_DELETED = 'vaultFacade:folderDeleted',
  
  // Search events
  CONTENT_SEARCHED = 'vaultFacade:contentSearched',
  TAG_SEARCHED = 'vaultFacade:tagSearched',
  
  // Frontmatter events
  FRONTMATTER_UPDATED = 'vaultFacade:frontmatterUpdated',
  
  // External events (from Obsidian)
  EXTERNAL_CREATE = 'vaultFacade:externalCreate',
  EXTERNAL_MODIFY = 'vaultFacade:externalModify',
  EXTERNAL_DELETE = 'vaultFacade:externalDelete',
  EXTERNAL_RENAME = 'vaultFacade:externalRename'
}

/**
 * Event data for note read events
 */
export interface NoteReadEventData {
  path: string;
}

/**
 * Event data for note created events
 */
export interface NoteCreatedEventData {
  path: string;
  overwrite: boolean;
}

/**
 * Event data for note updated events
 */
export interface NoteUpdatedEventData {
  path: string;
}

/**
 * Event data for note deleted events
 */
export interface NoteDeletedEventData {
  path: string;
}

/**
 * Event data for note renamed events
 */
export interface NoteRenamedEventData {
  oldPath: string;
  newPath: string;
}

/**
 * Event data for folder listed events
 */
export interface FolderListedEventData {
  path: string;
}

/**
 * Event data for folder created events
 */
export interface FolderCreatedEventData {
  path: string;
}

/**
 * Event data for folder deleted events
 */
export interface FolderDeletedEventData {
  path: string;
  recursive: boolean;
}

/**
 * Event data for content searched events
 */
export interface ContentSearchedEventData {
  query: string;
}

/**
 * Event data for tag searched events
 */
export interface TagSearchedEventData {
  tag: string;
}

/**
 * Event data for frontmatter updated events
 */
export interface FrontmatterUpdatedEventData {
  path: string;
}

/**
 * Event data for external create events
 */
export interface ExternalCreateEventData {
  path: string;
  file: TFile | TFolder;
}

/**
 * Event data for external modify events
 */
export interface ExternalModifyEventData {
  path: string;
  file: TFile;
}

/**
 * Event data for external delete events
 */
export interface ExternalDeleteEventData {
  path: string;
  file: TFile | TFolder;
}

/**
 * Event data for external rename events
 */
export interface ExternalRenameEventData {
  oldPath: string;
  newPath: string;
  file: TFile | TFolder;
}

/**
 * Union type for all VaultFacade event data
 */
export type VaultFacadeEventData =
  | NoteReadEventData
  | NoteCreatedEventData
  | NoteUpdatedEventData
  | NoteDeletedEventData
  | NoteRenamedEventData
  | FolderListedEventData
  | FolderCreatedEventData
  | FolderDeletedEventData
  | ContentSearchedEventData
  | TagSearchedEventData
  | FrontmatterUpdatedEventData
  | ExternalCreateEventData
  | ExternalModifyEventData
  | ExternalDeleteEventData
  | ExternalRenameEventData;
