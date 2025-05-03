---
title: Phase 2.1 - VaultFacade Foundation
description: Implementation plan for the foundational VaultFacade abstraction layer in Chatsidian
date: 2025-05-03
status: implementation
tags:
  - implementation
  - phase-2
  - vault-facade
  - abstraction
  - foundation
---

# Phase 2.1: VaultFacade Foundation

## Overview

This micro-phase focuses on creating the foundational VaultFacade abstraction layer. The VaultFacade will provide a simplified, consistent interface for all Obsidian vault operations, improving testability, maintainability, and performance of Chatsidian.

## Goals

- Design and implement the core VaultFacade interface
- Create standardized error handling for vault operations
- Implement basic file and folder operations
- Establish a foundation for more advanced features in later phases
- Ensure proper integration with Obsidian's API

## Implementation Steps

### 1. Define Core Interfaces

First, we need to define the interfaces that will represent the VaultFacade and its related components:

```typescript
// Define a set of specific error types for vault operations
export class VaultError extends Error {
  constructor(message: string) {
    super(`[VaultFacade] ${message}`);
    this.name = 'VaultError';
  }
}

export class FileNotFoundError extends VaultError { /* ... */ }
export class FolderNotFoundError extends VaultError { /* ... */ }
export class FileExistsError extends VaultError { /* ... */ }
export class AccessDeniedError extends VaultError { /* ... */ }

// Define the core interface for VaultFacade
export interface IVaultFacade {
  // Basic file operations
  readNote(path: string): Promise<{ content: string; path: string }>;
  createNote(path: string, content: string, overwrite?: boolean): Promise<{ path: string }>;
  updateNote(path: string, content: string): Promise<{ path: string }>;
  deleteNote(path: string): Promise<void>;
  renameNote(path: string, newPath: string): Promise<{ path: string }>;
  
  // Basic folder operations
  listFolder(path: string, options?: ListFolderOptions): Promise<{ files: string[]; folders: string[] }>;
  createFolder(path: string): Promise<void>;
  deleteFolder(path: string, recursive?: boolean): Promise<void>;
  
  // Search operations
  searchContent(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  searchByTag(tag: string): Promise<string[]>;
  
  // Frontmatter operations
  updateFrontmatter(path: string, updateFn: (frontmatter: any) => void): Promise<void>;
  
  // Attachment operations
  getAttachmentPath(filename: string, sourcePath: string): Promise<string>;
  
  // Event registration
  on(name: string, callback: (data: any) => void): void;
  off(name: string, callback: (data: any) => void): void;
}

// Define types for options and results
export interface ListFolderOptions {
  includeFiles?: boolean;
  includeFolders?: boolean;
  includeHidden?: boolean;
}

export interface SearchOptions {
  includeContent?: boolean;
  limit?: number;
  paths?: string[];
}

export interface SearchResult {
  path: string;
  score: number;
  snippet: string;
  content?: string;
}
```

### 2. Implement Basic VaultFacade Class

Next, implement the core VaultFacade class that will use Obsidian's API:

```typescript
import { App, TFile, TFolder, MetadataCache, Vault, Events, Component, Notice } from 'obsidian';
import { 
  IVaultFacade, 
  VaultError, 
  FileNotFoundError,
  FolderNotFoundError,
  FileExistsError,
  ListFolderOptions,
  SearchOptions,
  SearchResult 
} from './interfaces';

/**
 * VaultFacade provides a simplified interface for Obsidian vault operations
 * Extends Component to use Obsidian's lifecycle management
 */
export class VaultFacade extends Component implements IVaultFacade {
  private app: App;
  private metadataCache: MetadataCache;
  private vault: Vault;
  private events: Events;
  
  /**
   * Create a new VaultFacade
   * @param app - Obsidian App instance
   */
  constructor(app: App) {
    super();
    this.app = app;
    this.metadataCache = app.metadataCache;
    this.vault = app.vault;
    this.events = new Events();
    
    // Register vault event listeners
    this.registerVaultEvents();
  }
  
  /**
   * Register vault events with automatic cleanup when component is unloaded
   */
  private registerVaultEvents(): void {
    // Listen for file creation events
    this.registerEvent(
      this.app.vault.on('create', (file) => {
        this.events.trigger('vaultFacade:externalCreate', { path: file.path, file });
      })
    );
    
    // Listen for file modification events
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        this.events.trigger('vaultFacade:externalModify', { path: file.path, file });
      })
    );
    
    // Listen for file deletion events
    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        this.events.trigger('vaultFacade:externalDelete', { path: file.path, file });
      })
    );
    
    // Listen for file rename events
    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        this.events.trigger('vaultFacade:externalRename', { oldPath, newPath: file.path, file });
      })
    );
  }
  
  /**
   * Register an event listener
   * @param name - Event name
   * @param callback - Callback function
   */
  on(name: string, callback: (data: any) => void): void {
    this.events.on(name, callback);
  }
  
  /**
   * Unregister an event listener
   * @param name - Event name
   * @param callback - Callback function
   */
  off(name: string, callback: (data: any) => void): void {
    this.events.off(name, callback);
  }
  
  /**
   * Read a note by path
   * @param path - Path to the note
   * @returns Promise resolving to note content and path
   * @throws FileNotFoundError if file doesn't exist
   */
  async readNote(path: string): Promise<{ content: string; path: string }> {
    try {
      // Get file
      const file = this.getFileByPath(path);
      if (!file) {
        throw new FileNotFoundError(path);
      }
      
      // Use appropriate read method based on context
      // Use cachedRead for better performance when just displaying content
      const content = await this.vault.cachedRead(file);
      
      // Trigger event
      this.events.trigger('vaultFacade:noteRead', { path });
      
      return { content, path };
    } catch (error) {
      // Re-throw VaultError instances
      if (error instanceof VaultError) {
        throw error;
      }
      
      // Wrap other errors
      console.error(`Error reading note: ${path}`, error);
      throw new VaultError(`Failed to read note: ${error.message}`);
    }
  }
  
  /**
   * Create a new note
   * @param path - Path to the note
   * @param content - Note content
   * @param overwrite - Whether to overwrite if file exists
   * @returns Promise resolving to created note path
   * @throws FileExistsError if file exists and overwrite is false
   */
  async createNote(path: string, content: string, overwrite: boolean = false): Promise<{ path: string }> {
    try {
      // Check if file exists
      const file = this.getFileByPath(path);
      
      if (file && !overwrite) {
        throw new FileExistsError(path);
      }
      
      // Create or modify file
      if (file && overwrite) {
        await this.vault.modify(file, content);
      } else {
        // Ensure parent folder exists
        const folderPath = path.substring(0, path.lastIndexOf('/'));
        if (folderPath) {
          const folder = this.getFolderByPath(folderPath);
          if (!folder) {
            await this.vault.createFolder(folderPath);
          }
        }
        
        // Use atomic operation to create the file
        await this.vault.create(path, content);
      }
      
      // User feedback with Notice
      new Notice(`Note created: ${path.split('/').pop()}`);
      
      // Trigger event
      this.events.trigger('vaultFacade:noteCreated', { path, overwrite });
      
      return { path };
    } catch (error) {
      // Handle errors
      if (error instanceof VaultError) {
        throw error;
      }
      
      console.error(`Error creating note: ${path}`, error);
      new Notice(`Error creating note: ${error.message}`);
      throw new VaultError(`Failed to create note: ${error.message}`);
    }
  }
  
  /**
   * Update a note's content
   * @param path - Path to the note
   * @param content - New content
   * @returns Promise resolving to updated note path
   * @throws FileNotFoundError if file doesn't exist
   */
  async updateNote(path: string, content: string): Promise<{ path: string }> {
    try {
      // Get file
      const file = this.getFileByPath(path);
      if (!file) {
        throw new FileNotFoundError(path);
      }
      
      // Use Obsidian's atomic process method to safely update the file
      await this.vault.process(file, (currentContent) => {
        return content;
      });
      
      // Trigger event
      this.events.trigger('vaultFacade:noteUpdated', { path });
      
      return { path };
    } catch (error) {
      // Handle errors
      if (error instanceof VaultError) {
        throw error;
      }
      
      console.error(`Error updating note: ${path}`, error);
      throw new VaultError(`Failed to update note: ${error.message}`);
    }
  }
  
  /**
   * Delete a note
   * @param path - Path to the note
   * @returns Promise resolving when note is deleted
   * @throws FileNotFoundError if file doesn't exist
   */
  async deleteNote(path: string): Promise<void> {
    try {
      // Get file
      const file = this.getFileByPath(path);
      if (!file) {
        throw new FileNotFoundError(path);
      }
      
      // Use FileManager to trash the file instead of deleting it permanently
      // This follows Obsidian's user preference (system trash or .trash folder)
      await this.app.fileManager.trashFile(file);
      
      // Trigger event
      this.events.trigger('vaultFacade:noteDeleted', { path });
    } catch (error) {
      // Handle errors
      if (error instanceof VaultError) {
        throw error;
      }
      
      console.error(`Error deleting note: ${path}`, error);
      throw new VaultError(`Failed to delete note: ${error.message}`);
    }
  }
  
  /**
   * Rename or move a note
   * @param path - Current path
   * @param newPath - New path
   * @returns Promise resolving to new path
   * @throws FileNotFoundError if file doesn't exist
   */
  async renameNote(path: string, newPath: string): Promise<{ path: string }> {
    try {
      // Get file
      const file = this.getFileByPath(path);
      if (!file) {
        throw new FileNotFoundError(path);
      }
      
      // Use FileManager for rename to properly update links
      await this.app.fileManager.renameFile(file, newPath);
      
      // Trigger event
      this.events.trigger('vaultFacade:noteRenamed', { oldPath: path, newPath });
      
      return { path: newPath };
    } catch (error) {
      // Handle errors
      if (error instanceof VaultError) {
        throw error;
      }
      
      console.error(`Error renaming note: ${path} to ${newPath}`, error);
      throw new VaultError(`Failed to rename note: ${error.message}`);
    }
  }
  
  /**
   * List files and folders in a directory
   * @param path - Path to the folder
   * @param options - Listing options
   * @returns Promise resolving to files and folders in the directory
   * @throws FolderNotFoundError if folder doesn't exist
   */
  async listFolder(
    path: string, 
    options: ListFolderOptions = {}
  ): Promise<{ files: string[]; folders: string[] }> {
    try {
      // Set defaults
      const includeFiles = options.includeFiles !== false;
      const includeFolders = options.includeFolders !== false;
      const includeHidden = options.includeHidden === true;
      
      // Get folder
      const folder = this.getFolderByPath(path);
      if (!folder) {
        throw new FolderNotFoundError(path);
      }
      
      // Prepare result arrays
      const files: string[] = [];
      const folders: string[] = [];
      
      // Use Vault.recurseChildren to efficiently process folder contents
      if (path === '' || path === '/') {
        // For the root folder, use vault.getRoot()
        const root = this.vault.getRoot();
        
        // Process folder children
        for (const child of root.children) {
          // Skip hidden files/folders unless explicitly included
          if (!includeHidden && child.path.split('/').pop()?.startsWith('.')) {
            continue;
          }
          
          if (child instanceof TFolder && includeFolders) {
            folders.push(child.path);
          } else if (child instanceof TFile && includeFiles) {
            files.push(child.path);
          }
        }
      } else {
        // For non-root folders, process children directly
        for (const child of folder.children) {
          // Skip hidden files/folders unless explicitly included
          if (!includeHidden && child.path.split('/').pop()?.startsWith('.')) {
            continue;
          }
          
          if (child instanceof TFolder && includeFolders) {
            folders.push(child.path);
          } else if (child instanceof TFile && includeFiles) {
            files.push(child.path);
          }
        }
      }
      
      // Trigger event
      this.events.trigger('vaultFacade:folderListed', { path });
      
      return { files, folders };
    } catch (error) {
      // Handle errors
      if (error instanceof VaultError) {
        throw error;
      }
      
      console.error(`Error listing folder: ${path}`, error);
      throw new VaultError(`Failed to list folder: ${error.message}`);
    }
  }
  
  /**
   * Create a new folder
   * @param path - Path to the folder
   * @returns Promise resolving when folder is created
   */
  async createFolder(path: string): Promise<void> {
    try {
      // Check if folder already exists
      const existing = this.getFolderByPath(path);
      if (existing) {
        return; // Folder already exists, nothing to do
      }
      
      // Create folder using Obsidian's Vault API
      await this.vault.createFolder(path);
      
      // User feedback
      new Notice(`Folder created: ${path.split('/').pop()}`);
      
      // Trigger event
      this.events.trigger('vaultFacade:folderCreated', { path });
    } catch (error) {
      console.error(`Error creating folder: ${path}`, error);
      new Notice(`Error creating folder: ${error.message}`);
      throw new VaultError(`Failed to create folder: ${error.message}`);
    }
  }
  
  /**
   * Delete a folder
   * @param path - Path to the folder
   * @param recursive - Whether to delete contents recursively
   * @returns Promise resolving when folder is deleted
   * @throws FolderNotFoundError if folder doesn't exist
   */
  async deleteFolder(path: string, recursive: boolean = false): Promise<void> {
    try {
      // Get folder
      const folder = this.getFolderByPath(path);
      if (!folder) {
        throw new FolderNotFoundError(path);
      }
      
      // Check if folder is empty or recursive is true
      if (!recursive && folder.children.length > 0) {
        throw new VaultError(`Folder is not empty, use recursive: true to delete anyway`);
      }
      
      // Use trashFolder method for better alignment with Obsidian's trash preferences
      if (folder.children.length === 0 || recursive) {
        await this.app.vault.trash(folder, true);
        
        // User feedback
        new Notice(`Folder moved to trash: ${path.split('/').pop()}`);
      }
      
      // Trigger event
      this.events.trigger('vaultFacade:folderDeleted', { path, recursive });
    } catch (error) {
      // Handle errors
      if (error instanceof VaultError) {
        throw error;
      }
      
      console.error(`Error deleting folder: ${path}`, error);
      throw new VaultError(`Failed to delete folder: ${error.message}`);
    }
  }
  
  /**
   * Search content by query string
   * @param query - Search query
   * @param options - Search options
   * @returns Promise resolving to search results
   */
  async searchContent(
    query: string, 
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    try {
      // Set defaults
      const includeContent = options.includeContent === true;
      const limit = options.limit || 20;
      
      // Create search results array
      const searchResults: SearchResult[] = [];
      
      // Get all markdown files
      const files = this.vault.getMarkdownFiles();
      
      // Filter by paths if specified
      const filteredFiles = options.paths 
        ? files.filter(file => options.paths.some(p => file.path.startsWith(p)))
        : files;
      
      // Search through each file
      for (const file of filteredFiles) {
        // Get file metadata cache for efficient searching
        const metadata = this.metadataCache.getFileCache(file);
        if (!metadata) continue;
        
        // Initialize match flags and score
        let titleMatch = false;
        let headingMatch = false;
        let frontmatterMatch = false;
        let tagsMatch = false;
        let contentMatch = false;
        let score = 0;
        
        // Check title match
        const title = file.basename;
        titleMatch = title.toLowerCase().includes(query.toLowerCase());
        if (titleMatch) score += 100;
        
        // Check headings match
        const headings = metadata.headings || [];
        headingMatch = headings.some(h => 
          h.heading.toLowerCase().includes(query.toLowerCase())
        );
        if (headingMatch) score += 50;
        
        // Check frontmatter match
        if (metadata.frontmatter) {
          const frontmatterStr = JSON.stringify(metadata.frontmatter).toLowerCase();
          frontmatterMatch = frontmatterStr.includes(query.toLowerCase());
          if (frontmatterMatch) score += 40;
        }
        
        // Check tags match
        const tags = metadata.tags || [];
        tagsMatch = tags.some(tag => 
          tag.tag.toLowerCase().includes(query.toLowerCase())
        );
        if (tagsMatch) score += 60;
        
        // Create snippet and check content match if needed
        let snippet = '';
        let content = '';
        
        // Only read content if really needed
        if (includeContent || (!titleMatch && !headingMatch && !frontmatterMatch && !tagsMatch)) {
          // Use more efficient cachedRead for better performance
          content = await this.vault.cachedRead(file);
          contentMatch = content.toLowerCase().includes(query.toLowerCase());
          if (contentMatch) score += 10;
          
          // Create snippet from content if content matches
          if (contentMatch) {
            const lowerContent = content.toLowerCase();
            const index = lowerContent.indexOf(query.toLowerCase());
            if (index >= 0) {
              const start = Math.max(0, index - 40);
              const end = Math.min(content.length, index + query.length + 40);
              snippet = (start > 0 ? '...' : '') + 
                content.substring(start, end) + 
                (end < content.length ? '...' : '');
            } else {
              snippet = content.substring(0, 80) + '...';
            }
          }
        }
        
        // If title, heading, frontmatter, tag, or content match, add to results
        if (titleMatch || headingMatch || frontmatterMatch || tagsMatch || contentMatch) {
          // Determine snippet if not already set
          if (!snippet) {
            if (titleMatch) {
              snippet = title;
            } else if (headingMatch) {
              snippet = headings.find(h => 
                h.heading.toLowerCase().includes(query.toLowerCase())
              )?.heading || '';
            } else if (tagsMatch) {
              snippet = tags.map(t => t.tag).join(', ');
            } else if (frontmatterMatch) {
              snippet = 'Matched in frontmatter metadata';
            }
          }
          
          // Add to results
          searchResults.push({
            path: file.path,
            score,
            snippet,
            content: includeContent ? content : undefined
          });
        }
      }
      
      // Sort by score and limit results
      searchResults.sort((a, b) => b.score - a.score);
      const limitedResults = searchResults.slice(0, limit);
      
      // Trigger event
      this.events.trigger('vaultFacade:contentSearched', { query });
      
      return limitedResults;
    } catch (error) {
      console.error(`Error searching content: ${query}`, error);
      throw new VaultError(`Failed to search content: ${error.message}`);
    }
  }
  
  /**
   * Search files by tag
   * @param tag - Tag to search for
   * @returns Promise resolving to files with matching tag
   */
  async searchByTag(tag: string): Promise<string[]> {
    try {
      // Normalize tag (remove # if present)
      const normalizedTag = tag.startsWith('#') ? tag.substring(1) : tag;
      
      // Use Obsidian's metadata cache to find files with tag
      const files = this.metadataCache.getFilesByTag(normalizedTag);
      
      // Trigger event
      this.events.trigger('vaultFacade:tagSearched', { tag });
      
      return files.map(file => file.path);
    } catch (error) {
      console.error(`Error searching by tag: ${tag}`, error);
      throw new VaultError(`Failed to search by tag: ${error.message}`);
    }
  }
  
  /**
   * Update frontmatter of a note
   * @param path - Path to the note
   * @param updateFn - Function to update frontmatter
   * @returns Promise resolving when frontmatter is updated
   */
  async updateFrontmatter(path: string, updateFn: (frontmatter: any) => void): Promise<void> {
    try {
      // Get file
      const file = this.getFileByPath(path);
      if (!file) {
        throw new FileNotFoundError(path);
      }
      
      // Use Obsidian's atomic frontmatter processing
      await this.app.fileManager.processFrontMatter(file, updateFn);
      
      // Trigger event
      this.events.trigger('vaultFacade:frontmatterUpdated', { path });
    } catch (error) {
      console.error(`Error updating frontmatter: ${path}`, error);
      throw new VaultError(`Failed to update frontmatter: ${error.message}`);
    }
  }
  
  /**
   * Get available path for an attachment
   * @param filename - Attachment filename
   * @param sourcePath - Source note path
   * @returns Promise resolving to available path
   */
  async getAttachmentPath(filename: string, sourcePath: string): Promise<string> {
    try {
      // Use Obsidian's built-in path resolution
      const attachmentPath = this.app.fileManager.getAvailablePathForAttachment(filename, sourcePath);
      
      return attachmentPath;
    } catch (error) {
      console.error(`Error getting attachment path: ${filename}`, error);
      throw new VaultError(`Failed to get attachment path: ${error.message}`);
    }
  }
  
  // Helper methods
  
  /**
   * Get file by path
   * @param path - File path
   * @returns TFile or null if not found
   */
  private getFileByPath(path: string): TFile | null {
    // Use Vault's optimized methods for getting files by path
    return this.app.vault.getFileByPath(path);
  }
  
  /**
   * Get folder by path
   * @param path - Folder path
   * @returns TFolder or null if not found
   */
  private getFolderByPath(path: string): TFolder | null {
    // Use Vault's optimized methods for getting folders by path
    return this.app.vault.getFolderByPath(path);
  }
}
```

### 3. Create Mock VaultFacade for Testing

To facilitate unit testing without an actual Obsidian instance:

```typescript
/**
 * MockVaultFacade provides an in-memory implementation for testing
 * Extends Events to mimic the real VaultFacade's event behavior
 */
export class MockVaultFacade extends Events implements IVaultFacade {
  private files: Map<string, string> = new Map();
  private folders: Set<string> = new Set();
  private frontmatter: Map<string, any> = new Map();
  
  constructor() {
    super();
    // Add root folder
    this.folders.add('');
  }
  
  /**
   * Read a note by path
   */
  async readNote(path: string): Promise<{ content: string; path: string }> {
    if (!this.files.has(path)) {
      throw new FileNotFoundError(path);
    }
    
    const content = this.files.get(path);
    
    this.trigger('vaultFacade:noteRead', { path });
    
    return { content, path };
  }
  
  /**
   * Create a new note
   */
  async createNote(path: string, content: string, overwrite: boolean = false): Promise<{ path: string }> {
    if (this.files.has(path) && !overwrite) {
      throw new FileExistsError(path);
    }
    
    // Ensure parent folder exists
    const folderPath = path.substring(0, path.lastIndexOf('/'));
    if (folderPath && !this.folders.has(folderPath)) {
      await this.createFolder(folderPath);
    }
    
    this.files.set(path, content);
    
    this.trigger('vaultFacade:noteCreated', { path, overwrite });
    
    return { path };
  }
  
  /**
   * Update a note's content
   */
  async updateNote(path: string, content: string): Promise<{ path: string }> {
    if (!this.files.has(path)) {
      throw new FileNotFoundError(path);
    }
    
    this.files.set(path, content);
    
    this.trigger('vaultFacade:noteUpdated', { path });
    
    return { path };
  }
  
  /**
   * Delete a note
   */
  async deleteNote(path: string): Promise<void> {
    if (!this.files.has(path)) {
      throw new FileNotFoundError(path);
    }
    
    this.files.delete(path);
    this.frontmatter.delete(path);
    
    this.trigger('vaultFacade:noteDeleted', { path });
  }
  
  /**
   * Rename a note
   */
  async renameNote(path: string, newPath: string): Promise<{ path: string }> {
    if (!this.files.has(path)) {
      throw new FileNotFoundError(path);
    }
    
    const content = this.files.get(path);
    await this.createNote(newPath, content);
    await this.deleteNote(path);
    
    // Copy frontmatter if it exists
    if (this.frontmatter.has(path)) {
      this.frontmatter.set(newPath, this.frontmatter.get(path));
      this.frontmatter.delete(path);
    }
    
    this.trigger('vaultFacade:noteRenamed', { oldPath: path, newPath });
    
    return { path: newPath };
  }
  
  /**
   * List folder contents
   */
  async listFolder(
    path: string, 
    options: ListFolderOptions = {}
  ): Promise<{ files: string[]; folders: string[] }> {
    if (!this.folders.has(path)) {
      throw new FolderNotFoundError(path);
    }
    
    const includeFiles = options.includeFiles !== false;
    const includeFolders = options.includeFolders !== false;
    const includeHidden = options.includeHidden === true;
    
    const files: string[] = [];
    const folders: string[] = [];
    
    // Filter files
    if (includeFiles) {
      for (const filePath of this.files.keys()) {
        const fileDir = filePath.substring(0, filePath.lastIndexOf('/'));
        
        if (fileDir === path) {
          const fileName = filePath.split('/').pop();
          
          // Skip hidden files
          if (!includeHidden && fileName.startsWith('.')) {
            continue;
          }
          
          files.push(filePath);
        }
      }
    }
    
    // Filter folders
    if (includeFolders) {
      for (const folderPath of this.folders) {
        if (folderPath === path) {
          continue; // Skip current folder
        }
        
        const folderParent = folderPath.substring(0, folderPath.lastIndexOf('/'));
        
        if (folderParent === path) {
          const folderName = folderPath.split('/').pop();
          
          // Skip hidden folders
          if (!includeHidden && folderName.startsWith('.')) {
            continue;
          }
          
          folders.push(folderPath);
        }
      }
    }
    
    this.trigger('vaultFacade:folderListed', { path });
    
    return { files, folders };
  }
  
  /**
   * Create a folder
   */
  async createFolder(path: string): Promise<void> {
    if (this.folders.has(path)) {
      return; // Already exists
    }
    
    // Ensure parent folder exists
    const parentPath = path.substring(0, path.lastIndexOf('/'));
    if (parentPath && !this.folders.has(parentPath)) {
      await this.createFolder(parentPath);
    }
    
    this.folders.add(path);
    
    this.trigger('vaultFacade:folderCreated', { path });
  }
  
  /**
   * Delete a folder
   */
  async deleteFolder(path: string, recursive: boolean = false): Promise<void> {
    if (!this.folders.has(path)) {
      throw new FolderNotFoundError(path);
    }
    
    // Check if folder has children
    const { files, folders } = await this.listFolder(path, {
      includeFiles: true,
      includeFolders: true,
      includeHidden: true
    });
    
    if ((files.length > 0 || folders.length > 0) && !recursive) {
      throw new VaultError(`Folder is not empty, use recursive: true to delete anyway`);
    }
    
    // Delete children recursively
    if (recursive) {
      for (const file of files) {
        await this.deleteNote(file);
      }
      
      for (const folder of folders) {
        await this.deleteFolder(folder, true);
      }
    }
    
    this.folders.delete(path);
    
    this.trigger('vaultFacade:folderDeleted', { path, recursive });
  }
  
  /**
   * Search content
   */
  async searchContent(
    query: string, 
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const includeContent = options.includeContent === true;
    const limit = options.limit || 20;
    
    const results: SearchResult[] = [];
    
    for (const [path, content] of this.files.entries()) {
      // Skip filtered paths
      if (options.paths && !options.paths.some(p => path.startsWith(p))) {
        continue;
      }
      
      if (content.toLowerCase().includes(query.toLowerCase())) {
        const score = 10;
        const lowerContent = content.toLowerCase();
        const index = lowerContent.indexOf(query.toLowerCase());
        
        let snippet = '';
        if (index >= 0) {
          const start = Math.max(0, index - 40);
          const end = Math.min(content.length, index + query.length + 40);
          snippet = (start > 0 ? '...' : '') + 
            content.substring(start, end) + 
            (end < content.length ? '...' : '');
        } else {
          snippet = content.substring(0, 80) + '...';
        }
        
        results.push({
          path,
          score,
          snippet,
          content: includeContent ? content : undefined
        });
      }
    }
    
    // Sort and limit
    results.sort((a, b) => b.score - a.score);
    const limited = results.slice(0, limit);
    
    this.trigger('vaultFacade:contentSearched', { query });
    
    return limited;
  }
  
  /**
   * Search by tag
   */
  async searchByTag(tag: string): Promise<string[]> {
    const normalizedTag = tag.startsWith('#') ? tag.substring(1) : tag;
    const results: string[] = [];
    
    for (const [path, content] of this.files.entries()) {
      if (content.includes(`#${normalizedTag}`)) {
        results.push(path);
      }
    }
    
    this.trigger('vaultFacade:tagSearched', { tag });
    
    return results;
  }
  
  /**
   * Update frontmatter
   */
  async updateFrontmatter(path: string, updateFn: (frontmatter: any) => void): Promise<void> {
    if (!this.files.has(path)) {
      throw new FileNotFoundError(path);
    }
    
    // Initialize frontmatter if it doesn't exist
    if (!this.frontmatter.has(path)) {
      this.frontmatter.set(path, {});
    }
    
    const frontmatter = this.frontmatter.get(path);
    updateFn(frontmatter);
    
    this.trigger('vaultFacade:frontmatterUpdated', { path });
  }
  
  /**
   * Get attachment path
   */
  async getAttachmentPath(filename: string, sourcePath: string): Promise<string> {
    // Ensure attachments folder exists
    const attachmentsFolder = 'attachments';
    if (!this.folders.has(attachmentsFolder)) {
      await this.createFolder(attachmentsFolder);
    }
    
    // Check for duplicates
    let attachmentPath = `${attachmentsFolder}/${filename}`;
    let counter = 1;
    
    while (this.files.has(attachmentPath)) {
      const ext = filename.lastIndexOf('.');
      if (ext !== -1) {
        const name = filename.substring(0, ext);
        const extension = filename.substring(ext);
        attachmentPath = `${attachmentsFolder}/${name}-${counter}${extension}`;
      } else {
        attachmentPath = `${attachmentsFolder}/${filename}-${counter}`;
      }
      counter++;
    }
    
    return attachmentPath;
  }
}
```

### 4. Integrate VaultFacade with Plugin Core

Update the main plugin class to use the VaultFacade:

```typescript
import { Plugin, Notice, debounce } from 'obsidian';
import { SettingsManager } from './core/SettingsManager';
import { VaultFacade } from './core/VaultFacade';

export default class ChatsidianPlugin extends Plugin {
  public settings: SettingsManager;
  public vaultFacade: VaultFacade;
  
  async onload() {
    console.log('Loading Chatsidian plugin');
    
    // Initialize settings
    this.settings = new SettingsManager(this.app);
    await this.settings.load();
    
    // Initialize vault facade - add to plugin for automatic cleanup
    this.vaultFacade = new VaultFacade(this.app);
    this.addChild(this.vaultFacade);
    
    // Register event handlers
    this.registerVaultFacadeEvents();
    
    // Register layout ready event to ensure vault is fully loaded
    this.app.workspace.onLayoutReady(() => {
      this.onLayoutReady();
    });
    
    new Notice('Chatsidian plugin loaded');
  }
  
  private onLayoutReady() {
    // Initialize any components that need a fully loaded vault
    console.log('Chatsidian layout ready');
  }
  
  private registerVaultFacadeEvents() {
    // Register event listeners using the Component pattern
    if (this.settings.getSettings().debugMode) {
      // Use debounce for operations that may happen frequently
      const logNoteOperation = debounce((message: string, data: any) => {
        console.log(message, data);
      }, 100);
      
      // Log vault operations in debug mode
      this.vaultFacade.on('vaultFacade:noteRead', data => {
        logNoteOperation('Note read:', data.path);
      });
      
      this.vaultFacade.on('vaultFacade:noteCreated', data => {
        console.log('Note created:', data.path);
      });
      
      this.vaultFacade.on('vaultFacade:noteUpdated', data => {
        logNoteOperation('Note updated:', data.path);
      });
      
      this.vaultFacade.on('vaultFacade:noteDeleted', data => {
        console.log('Note deleted:', data.path);
      });
      
      this.vaultFacade.on('vaultFacade:noteRenamed', data => {
        console.log('Note renamed:', data.oldPath, 'to', data.newPath);
      });
      
      // Register listeners for external changes
      this.vaultFacade.on('vaultFacade:externalCreate', data => {
        console.log('External file created:', data.path);
      });
      
      this.vaultFacade.on('vaultFacade:externalModify', data => {
        logNoteOperation('External file modified:', data.path);
      });
    }
  }
  
  // onunload() is handled automatically by the Component pattern
  // The plugin's children (including vaultFacade) will be unloaded automatically
}
```

## Documentation References

- [[💻 Coding/Projects/Chatsidian/1_Architecture/Components/VaultFacade]]
- [[💻 Coding/Projects/Chatsidian/1_Architecture/Overview]]
- [[💻 Coding/Projects/Chatsidian/4_Documentation/DataModels]]

## Testing Strategy

- Unit tests for each core VaultFacade method using the MockVaultFacade for isolation
- Integration tests with Obsidian API mocks to verify correct API usage
- Component lifecycle tests to ensure proper registration/unregistration of events
- Error handling tests for expected failure cases with appropriate error propagation
- Performance tests comparing direct API usage vs. VaultFacade abstraction
- Event emission tests to verify correct event triggering and data passing

## Next Steps

The next phase (Phase 2.2) will focus on building the BCP Registry infrastructure that will utilize this VaultFacade to access Obsidian's vault in a consistent, testable manner.

With the improved Obsidian API alignment in the VaultFacade, the BCP Registry will benefit from:

1. Better lifecycle management through the Component pattern
2. More consistent error handling and user feedback
3. Automatic event cleanup when components are unloaded
4. More efficient search operations leveraging MetadataCache
5. Link-aware file operations that maintain document integrity
6. Improved frontmatter handling for metadata operations

These improvements will ensure that the Chatsidian plugin integrates smoothly with Obsidian's core systems while maintaining a clean, testable abstraction layer for the rest of the application to build upon.
