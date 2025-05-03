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
  
  // Basic folder operations
  listFolder(path: string, options?: ListFolderOptions): Promise<{ files: string[]; folders: string[] }>;
  createFolder(path: string): Promise<void>;
  deleteFolder(path: string, recursive?: boolean): Promise<void>;
  
  // Search operations
  searchContent(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  searchByTag(tag: string): Promise<string[]>;
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
import { App, TFile, TFolder, MetadataCache, Vault } from 'obsidian';
import { EventBus } from '../core/EventBus';
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
 */
export class VaultFacade implements IVaultFacade {
  private app: App;
  private metadataCache: MetadataCache;
  private vault: Vault;
  private eventBus: EventBus;
  
  /**
   * Create a new VaultFacade
   * @param app - Obsidian App instance
   * @param eventBus - EventBus for communication
   */
  constructor(app: App, eventBus: EventBus) {
    this.app = app;
    this.metadataCache = app.metadataCache;
    this.vault = app.vault;
    this.eventBus = eventBus;
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
      
      // Read content
      const content = await this.vault.read(file);
      
      // Emit event
      this.eventBus.emit('vaultFacade:noteRead', { path });
      
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
        await this.ensureFolderExists(path);
        await this.vault.create(path, content);
      }
      
      // Emit event
      this.eventBus.emit('vaultFacade:noteCreated', { path, overwrite });
      
      return { path };
    } catch (error) {
      // Handle errors
      if (error instanceof VaultError) {
        throw error;
      }
      
      console.error(`Error creating note: ${path}`, error);
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
      
      // Update content
      await this.vault.modify(file, content);
      
      // Emit event
      this.eventBus.emit('vaultFacade:noteUpdated', { path });
      
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
      
      // Delete file
      await this.vault.delete(file);
      
      // Emit event
      this.eventBus.emit('vaultFacade:noteDeleted', { path });
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
      
      // Process folder children
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
      
      // Emit event
      this.eventBus.emit('vaultFacade:folderListed', { path });
      
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
      
      // Create folder
      await this.vault.createFolder(path);
      
      // Emit event
      this.eventBus.emit('vaultFacade:folderCreated', { path });
    } catch (error) {
      console.error(`Error creating folder: ${path}`, error);
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
      
      // Delete folder
      await this.vault.delete(folder, recursive);
      
      // Emit event
      this.eventBus.emit('vaultFacade:folderDeleted', { path, recursive });
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
      
      // This is a simplified approach - in a real implementation, 
      // we would use Obsidian's internal search API
      const searchResults: SearchResult[] = [];
      
      // Get all markdown files
      const files = this.vault.getMarkdownFiles();
      
      // Filter by paths if specified
      const filteredFiles = options.paths 
        ? files.filter(file => options.paths.some(p => file.path.startsWith(p)))
        : files;
      
      // Search through each file
      for (const file of filteredFiles) {
        // Get file metadata
        const metadata = this.metadataCache.getFileCache(file);
        
        // Check if query appears in title
        const title = file.basename;
        const titleMatch = title.toLowerCase().includes(query.toLowerCase());
        
        // Check if query appears in headings
        const headings = metadata?.headings || [];
        const headingMatch = headings.some(h => 
          h.heading.toLowerCase().includes(query.toLowerCase())
        );
        
        // Get content if needed
        let content = '';
        let contentMatch = false;
        
        if (includeContent || (!titleMatch && !headingMatch)) {
          content = await this.vault.read(file);
          contentMatch = content.toLowerCase().includes(query.toLowerCase());
        }
        
        // If any match found, add to results
        if (titleMatch || headingMatch || contentMatch) {
          // Calculate score based on match type
          const score = (titleMatch ? 100 : 0) + (headingMatch ? 50 : 0) + (contentMatch ? 10 : 0);
          
          // Create snippet
          let snippet = '';
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
          } else {
            snippet = titleMatch ? title : headings.find(h => 
              h.heading.toLowerCase().includes(query.toLowerCase())
            )?.heading || '';
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
      
      // Emit event
      this.eventBus.emit('vaultFacade:contentSearched', { query });
      
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
      
      // Emit event
      this.eventBus.emit('vaultFacade:tagSearched', { tag });
      
      return files.map(file => file.path);
    } catch (error) {
      console.error(`Error searching by tag: ${tag}`, error);
      throw new VaultError(`Failed to search by tag: ${error.message}`);
    }
  }
  
  // Helper methods
  
  /**
   * Get file by path
   * @param path - File path
   * @returns TFile or null if not found
   */
  private getFileByPath(path: string): TFile | null {
    const file = this.app.vault.getAbstractFileByPath(path);
    return file instanceof TFile ? file : null;
  }
  
  /**
   * Get folder by path
   * @param path - Folder path
   * @returns TFolder or null if not found
   */
  private getFolderByPath(path: string): TFolder | null {
    const folder = this.app.vault.getAbstractFileByPath(path);
    return folder instanceof TFolder ? folder : null;
  }
  
  /**
   * Ensure folder exists
   * @param filePath - File path
   * @returns Promise resolving when folder exists
   */
  private async ensureFolderExists(filePath: string): Promise<void> {
    const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
    
    if (!folderPath) {
      return; // File is in root
    }
    
    const folder = this.getFolderByPath(folderPath);
    
    if (!folder) {
      await this.vault.createFolder(folderPath);
    }
  }
}
```

### 3. Create Mock VaultFacade for Testing

To facilitate unit testing without an actual Obsidian instance:

```typescript
/**
 * MockVaultFacade provides an in-memory implementation for testing
 */
export class MockVaultFacade implements IVaultFacade {
  private files: Map<string, string> = new Map();
  private folders: Set<string> = new Set();
  private eventBus: EventBus;
  
  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
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
    
    this.eventBus.emit('vaultFacade:noteRead', { path });
    
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
    
    this.eventBus.emit('vaultFacade:noteCreated', { path, overwrite });
    
    return { path };
  }
  
  // Implement remaining methods...
}
```

### 4. Integrate VaultFacade with Plugin Core

Update the main plugin class to use the VaultFacade:

```typescript
import { Plugin } from 'obsidian';
import { EventBus } from './core/EventBus';
import { SettingsManager } from './core/SettingsManager';
import { VaultFacade } from './core/VaultFacade';

export default class ChatsidianPlugin extends Plugin {
  public eventBus: EventBus;
  public settings: SettingsManager;
  public vaultFacade: VaultFacade;
  
  async onload() {
    console.log('Loading Chatsidian plugin');
    
    // Initialize event bus
    this.eventBus = new EventBus();
    
    // Initialize settings
    this.settings = new SettingsManager(this.app, this.eventBus);
    await this.settings.load();
    
    // Initialize vault facade
    this.vaultFacade = new VaultFacade(this.app, this.eventBus);
    
    // Register event handlers
    this.registerEvents();
    
    console.log('Chatsidian plugin loaded');
  }
  
  private registerEvents() {
    // Log vault operations in debug mode
    if (this.settings.getSettings().debugMode) {
      this.eventBus.on('vaultFacade:noteRead', data => {
        console.log('Note read:', data.path);
      });
      
      // Register other event handlers...
    }
  }
  
  onunload() {
    // Clean up resources
    this.eventBus.clear();
  }
}
```

## Documentation References

- [[💻 Coding/Projects/Chatsidian/1_Architecture/Components/VaultFacade]]
- [[💻 Coding/Projects/Chatsidian/1_Architecture/Overview]]
- [[💻 Coding/Projects/Chatsidian/4_Documentation/DataModels]]

## Testing Strategy

- Unit tests for each core VaultFacade method
- Integration tests with Obsidian API mocks
- Error handling tests for expected failure cases
- Performance tests for basic operations

## Next Steps

The next phase (Phase 2.2) will focus on building the BCP Registry infrastructure that will utilize this VaultFacade to access Obsidian's vault in a consistent, testable manner.
