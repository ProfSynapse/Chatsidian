---
title: Vault Facade Design
description: Design document for the Obsidian Vault Facade abstraction layer for Chatsidian
date: 2025-05-03
status: planning
tags:
  - architecture
  - component
  - abstraction
  - vault-operations
---

# Vault Facade Design

## Overview

The Vault Facade serves as an abstraction layer between Chatsidian's Bounded Context Packs (BCPs) and Obsidian's native APIs. This facade simplifies vault operations, provides consistent error handling, enables testing through mocking, and insulates the plugin from Obsidian API changes.

## Core Responsibilities

1. **API Abstraction**: Provide a simplified interface for Obsidian's Vault, MetadataCache, and Workspace APIs
2. **Error Handling**: Standardize error handling and logging for vault operations
3. **Performance Optimization**: Implement caching and batch operations strategies
4. **Testing Support**: Enable unit testing through mockable interfaces

## Basic Operations

### Reading and Writing Notes

```typescript
interface VaultFacade {
  /**
   * Read a note by path
   * @param path - Path to the note
   * @returns Promise resolving to note content and path
   */
  readNote(path: string): Promise<{ content: string; path: string }>;
  
  /**
   * Create or update a note
   * @param path - Path to the note
   * @param content - Note content
   * @param overwrite - Whether to overwrite if file exists
   * @returns Promise resolving to created note path
   */
  createNote(path: string, content: string, overwrite?: boolean): Promise<{ path: string }>;
  
  /**
   * Update a portion of a note
   * @param path - Path to the note
   * @param search - Text to search for
   * @param replace - Text to replace with
   * @param replaceAll - Whether to replace all occurrences
   * @returns Promise resolving to updated note path
   */
  updateNote(path: string, search: string, replace: string, replaceAll?: boolean): Promise<{ path: string }>;
  
  /**
   * Delete a note
   * @param path - Path to the note
   * @returns Promise resolving when note is deleted
   */
  deleteNote(path: string): Promise<void>;
}
```

### Folder Operations

```typescript
interface VaultFacade {
  /**
   * List files and folders in a directory
   * @param path - Path to the folder
   * @param options - Listing options
   * @returns Object with files and folders arrays
   */
  listFolder(
    path: string, 
    options?: { 
      includeFiles?: boolean; 
      includeFolders?: boolean;
      includeHidden?: boolean;
    }
  ): Promise<{ files: string[]; folders: string[] }>;
  
  /**
   * Create a new folder
   * @param path - Path to the folder
   * @returns Promise resolving when folder is created
   */
  createFolder(path: string): Promise<void>;
  
  /**
   * Delete a folder
   * @param path - Path to the folder
   * @param recursive - Whether to delete contents recursively
   * @returns Promise resolving when folder is deleted
   */
  deleteFolder(path: string, recursive?: boolean): Promise<void>;
  
  /**
   * Move a folder
   * @param oldPath - Current path
   * @param newPath - New path
   * @returns Promise resolving when folder is moved
   */
  moveFolder(oldPath: string, newPath: string): Promise<void>;
}
```

### Search Operations

```typescript
interface VaultFacade {
  /**
   * Search content by query string
   * @param query - Search query
   * @param options - Search options
   * @returns Search results
   */
  searchContent(
    query: string, 
    options?: { 
      includeContent?: boolean; 
      limit?: number;
      paths?: string[];
    }
  ): Promise<{ 
    results: Array<{ 
      path: string; 
      score: number; 
      snippet: string;
      content?: string;
    }>
  }>;
  
  /**
   * Search files by tag
   * @param tag - Tag to search for
   * @returns Files with matching tag
   */
  searchByTag(tag: string): Promise<{ results: string[] }>;
  
  /**
   * Search files by property
   * @param key - Property key
   * @param value - Optional property value
   * @returns Files with matching property
   */
  searchByProperty(key: string, value?: string): Promise<{ results: string[] }>;
}
```

## Advanced Features

### Caching Layer

The facade implements a configurable caching strategy to improve performance for frequently accessed resources.

```typescript
interface CacheConfig {
  enabled: boolean;
  maxSize: number;  // Maximum number of cached items
  ttl: number;      // Time-to-live in milliseconds
}

interface VaultFacade {
  /**
   * Configure cache settings
   * @param config - Cache configuration
   */
  configureCache(config: Partial<CacheConfig>): void;
  
  /**
   * Clear the cache
   * @param pattern - Optional pattern to selectively clear cache
   */
  clearCache(pattern?: string): void;
  
  /**
   * Preload cache with specific paths
   * @param paths - Paths to preload
   */
  preloadCache(paths: string[]): Promise<void>;
}
```

### Batch Operations

Support for executing multiple operations efficiently in a single call.

```typescript
type BatchOperation = 
  | { type: 'read'; path: string }
  | { type: 'create'; path: string; content: string; overwrite?: boolean }
  | { type: 'update'; path: string; search: string; replace: string; replaceAll?: boolean }
  | { type: 'delete'; path: string }
  | { type: 'list'; path: string; options?: any };

interface VaultFacade {
  /**
   * Execute multiple operations in a single batch
   * @param operations - Array of operations to perform
   * @returns Results of each operation
   */
  executeBatch(operations: BatchOperation[]): Promise<Array<any>>;
}
```

### Change Monitoring

Watch files or directories for changes to trigger callbacks.

```typescript
type ChangeType = 'create' | 'modify' | 'delete' | 'rename';

interface FileChange {
  path: string;
  type: ChangeType;
  oldPath?: string;  // For rename operations
}

interface VaultFacade {
  /**
   * Watch a file or folder for changes
   * @param path - Path to watch
   * @param callback - Function to call when changes occur
   * @returns Unique watcher ID
   */
  watchChanges(
    path: string, 
    callback: (changes: FileChange) => void
  ): string;
  
  /**
   * Stop watching a path
   * @param id - Watcher ID to remove
   */
  unwatchChanges(id: string): void;
}
```

### Virtual Files

Support for in-memory files that can be manipulated before committing to disk.

```typescript
interface VirtualFile {
  path: string;
  content: string;
  isDirty: boolean;
}

interface VaultFacade {
  /**
   * Create a virtual file in memory
   * @param path - Path for the virtual file
   * @param content - Initial content
   * @returns Virtual file object
   */
  createVirtualFile(path: string, content: string): VirtualFile;
  
  /**
   * Get a virtual file
   * @param path - Path of the virtual file
   * @returns Virtual file or null if not found
   */
  getVirtualFile(path: string): VirtualFile | null;
  
  /**
   * Update a virtual file
   * @param path - Path of the virtual file
   * @param content - New content
   * @returns Updated virtual file
   */
  updateVirtualFile(path: string, content: string): VirtualFile;
  
  /**
   * Commit a virtual file to disk
   * @param path - Path of the virtual file
   * @returns Promise resolving when file is committed
   */
  commitVirtualFile(path: string): Promise<void>;
  
  /**
   * Discard a virtual file
   * @param path - Path of the virtual file
   */
  discardVirtualFile(path: string): void;
}
```

### Transaction Support

Group operations that should succeed or fail together.

```typescript
interface Transaction {
  id: string;
  operations: BatchOperation[];
  status: 'pending' | 'committed' | 'rolled-back';
}

interface VaultFacade {
  /**
   * Begin a new transaction
   * @returns Transaction object
   */
  beginTransaction(): Transaction;
  
  /**
   * Add operation to a transaction
   * @param transactionId - Transaction ID
   * @param operation - Operation to add
   */
  addOperation(transactionId: string, operation: BatchOperation): void;
  
  /**
   * Commit a transaction
   * @param transactionId - Transaction ID
   * @returns Promise resolving when all operations complete
   */
  commitTransaction(transactionId: string): Promise<any[]>;
  
  /**
   * Rollback a transaction
   * @param transactionId - Transaction ID
   */
  rollbackTransaction(transactionId: string): void;
}
```

## Implementation Strategy

### Phase 1: Core Implementation

1. Implement basic operations (read, write, list, search)
2. Set up logging and error handling
3. Create facade interfaces for testability

### Phase 2: Performance Enhancements

1. Add caching layer for frequently accessed files
2. Implement batch operations
3. Add change monitoring capabilities

### Phase 3: Advanced Features

1. Implement virtual files
2. Add transaction support
3. Create convenience methods for common operations

## Integration with BCPs

BCPs will use the Vault Facade instead of directly accessing Obsidian APIs:

```typescript
// Example BCP implementation
export const NoteManagerBCP: BoundedContextPack = {
  domain: 'NoteManager',
  description: 'Performs operations on notes in the vault',
  tools: [
    {
      name: 'readNote',
      description: 'Read a note from the vault',
      schema: {/* JSON Schema */},
      handler: async (params, context) => {
        const { vaultFacade } = context;
        return await vaultFacade.readNote(params.path);
      }
    },
    // Other tools...
  ]
};
```

## Dependency Injection

The Vault Facade will be injected into BCPs at registration time:

```typescript
// In BCPRegistry
async loadPack(domain: string): Promise<void> {
  const pack = await import(`../bcps/${domain}`);
  
  // Inject dependencies
  const context = {
    vaultFacade: this.vaultFacade,
    eventBus: this.eventBus
  };
  
  // Register tools with context
  pack.tools.forEach(tool => {
    this.toolManager.registerTool(
      `${domain}.${tool.name}`,
      tool.description,
      (params) => tool.handler(params, context),
      tool.schema
    );
  });
}
```

## Error Handling Strategy

The Vault Facade implements a standardized error handling approach:

1. **Specific Error Types**: Define specific error classes for different failures
2. **Contextual Information**: Include relevant context in error messages
3. **Retry Logic**: Implement retry for transient failures
4. **Logging**: Comprehensive logging for debugging

```typescript
// Error types
export class VaultError extends Error {
  constructor(message: string) {
    super(`[VaultFacade] ${message}`);
    this.name = 'VaultError';
  }
}

export class FileNotFoundError extends VaultError {
  constructor(path: string) {
    super(`File not found: ${path}`);
    this.name = 'FileNotFoundError';
  }
}

export class AccessDeniedError extends VaultError {
  constructor(path: string, operation: string) {
    super(`Access denied for operation ${operation} on path: ${path}`);
    this.name = 'AccessDeniedError';
  }
}
```

## Testing Approach

The Vault Facade is designed for testability:

1. **Interface-Based Design**: All methods defined in interfaces
2. **Mock Implementation**: Separate mock implementation for testing
3. **In-Memory Mode**: Option to run in memory-only mode for tests
4. **Test Helpers**: Utility functions for test setup and verification

```typescript
// Example mock for testing
export class MockVaultFacade implements VaultFacade {
  private files: Map<string, string> = new Map();
  
  async readNote(path: string): Promise<{ content: string; path: string }> {
    const content = this.files.get(path);
    if (!content) {
      throw new FileNotFoundError(path);
    }
    return { content, path };
  }
  
  async createNote(path: string, content: string): Promise<{ path: string }> {
    this.files.set(path, content);
    return { path };
  }
  
  // Other method implementations...
}
```

## Performance Considerations

1. **Lazy Loading**: Only load resources when needed
2. **Caching Strategy**: Balance memory usage with performance
3. **Batch Processing**: Minimize API calls for multiple operations
4. **Resource Cleanup**: Properly release resources when no longer needed
