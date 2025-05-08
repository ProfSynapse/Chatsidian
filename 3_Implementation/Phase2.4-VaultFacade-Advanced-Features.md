---
title: Phase 2.4 - VaultFacade Advanced Features
description: Implementation plan for advanced features of the VaultFacade abstraction layer
date: 2025-05-03
status: implementation
tags:
  - implementation
  - phase-2
  - vault-facade
  - advanced-features
  - caching
  - batch-operations
  - transactions
---

# Phase 2.4: VaultFacade Advanced Features

## Overview

This micro-phase focuses on extending the VaultFacade with advanced features to improve performance, reliability, and developer experience. Building on the foundation established in Phase 2.1, we'll implement caching, batch operations, file monitoring, virtual files, and transaction support.

## Goals

- Implement a configurable caching layer for frequently accessed resources
- Create a batch operations system for efficient execution of multiple operations
- Develop a file change monitoring system to track vault changes
- Implement virtual files for in-memory manipulation before committing to disk
- Add transaction support for atomic operations
- Ensure all advanced features have proper error handling and event emission

## Implementation Steps


### 1. Implement Caching Layer

First, we'll add a caching system to improve performance for frequently accessed files:

```typescript
/**
 * Cache configuration options
 */
export interface CacheConfig {
  /**
   * Whether caching is enabled
   */
  enabled: boolean;
  
  /**
   * Maximum number of cached items
   */
  maxSize: number;
  
  /**
   * Time-to-live in milliseconds
   */
  ttl: number;
}

/**
 * Cache entry for a file
 */
interface CacheEntry {
  /**
   * File content
   */
  content: string;
  
  /**
   * Timestamp when the entry was cached
   */
  timestamp: number;
}

/**
 * Default cache configuration
 */
const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  maxSize: 100,
  ttl: 60000 // 1 minute
};

/**
 * Add caching methods to the VaultFacade interface
 */
export interface ICachedVaultFacade extends IVaultFacade {
  /**
   * Configure cache settings
   * @param config - Partial cache configuration to merge with current settings
   */
  configureCache(config: Partial<CacheConfig>): void;
  
  /**
   * Clear the cache
   * @param pattern - Optional pattern to selectively clear cache entries
   */
  clearCache(pattern?: string): void;
  
  /**
   * Preload cache with specific paths
   * @param paths - Paths to preload
   * @returns Promise resolving when preloading is complete
   */
  preloadCache(paths: string[]): Promise<void>;
}

/**
 * Add caching functionality to VaultFacade
 */
export class CachedVaultFacade extends VaultFacade implements ICachedVaultFacade {
  /**
   * Cache of file contents
   */
  private cache: Map<string, CacheEntry> = new Map();
  
  /**
   * Cache configuration
   */
  private cacheConfig: CacheConfig = DEFAULT_CACHE_CONFIG;
  
  /**
   * Cache statistics for optimization
   */
  private cacheStats = {
    hits: 0,
    misses: 0,
    invalidations: 0
  };
  
  /**
   * Configure cache settings
   * @param config - Partial cache configuration to merge with current settings
   */
  public configureCache(config: Partial<CacheConfig>): void {
    this.cacheConfig = {
      ...this.cacheConfig,
      ...config
    };
    
    // If cache is disabled, clear it
    if (!this.cacheConfig.enabled) {
      this.clearCache();
    }
    
    // Emit event
    this.eventBus.emit('vaultFacade:cacheConfigured', this.cacheConfig);
  }
  
  /**
   * Clear the cache
   * @param pattern - Optional pattern to selectively clear cache entries
   */
  public clearCache(pattern?: string): void {
    if (!pattern) {
      // Clear entire cache
      this.cache.clear();
      
      // Emit event
      this.eventBus.emit('vaultFacade:cacheCleared');
      return;
    }
    
    // Clear matching entries
    const keys = Array.from(this.cache.keys());
    let clearedCount = 0;
    
    for (const key of keys) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        clearedCount++;
      }
    }
    
    // Emit event with count
    this.eventBus.emit('vaultFacade:cacheCleared', {
      pattern,
      count: clearedCount
    });
  }
  
  /**
   * Preload cache with specific paths
   * @param paths - Paths to preload
   * @returns Promise resolving when preloading is complete
   */
  public async preloadCache(paths: string[]): Promise<void> {
    // Skip if cache is disabled
    if (!this.cacheConfig.enabled) {
      return;
    }
    
    // Load each path in parallel
    const loadPromises = paths.map(async path => {
      try {
        // Skip if already cached
        if (this.isCached(path)) {
          return;
        }
        
        // Get file
        const file = this.getFileByPath(path);
        if (!file) return;
        
        // Read content
        const content = await this.vault.read(file);
        
        // Add to cache
        this.cache.set(path, {
          content,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error(`Error preloading cache for ${path}:`, error);
      }
    });
    
    // Wait for all loads to complete
    await Promise.all(loadPromises);
    
    // Emit event
    this.eventBus.emit('vaultFacade:cachePreloaded', {
      paths,
      count: paths.length
    });
  }
  
  /**
   * Override readNote to use cache
   * @param path - Path to the note
   * @returns Promise resolving to note content and path
   */
  public async readNote(path: string): Promise<{ content: string; path: string; metadata?: any }> {
    try {
      // Check cache first if enabled
      if (this.cacheConfig.enabled) {
        const cached = this.getCachedEntry(path);
        
        if (cached) {
          // Track cache hit
          this.cacheStats.hits++;
          
          // Emit event for cache hit
          this.eventBus.emit('vaultFacade:cacheHit', { path });
          
          return { content: cached.content, path };
        }
      }
      
      // Cache miss
      if (this.cacheConfig.enabled) {
        this.cacheStats.misses++;
      }
      
      // Get file with proper error handling
      const file = this.getFileByPath(path);
      if (!file) {
        throw new Error(`File not found: ${path}`);
      }
      
      // Use vault.cachedRead for better performance
      const content = await this.app.vault.cachedRead(file);
      
      // Get metadata if available
      const metadata = this.app.metadataCache.getFileCache(file);
      
      const result = { content, path, metadata };
      
      // Add to cache if enabled and file should be cached
      if (this.cacheConfig.enabled && this.shouldCache(file)) {
        this.cache.set(path, {
          content,
          timestamp: Date.now()
        });
        
        // Enforce max cache size
        this.enforceCacheSize();
      }
      
      return result;
    } catch (error) {
      // Cache miss and error, emit event
      if (this.cacheConfig.enabled) {
        this.eventBus.emit('vaultFacade:cacheMiss', { path, error });
      }
      
      // Use Obsidian's Notice API for user feedback
      new Notice(`Error reading note: ${error.message}`);
      
      throw error;
    }
  }
  
  /**
   * Determine if a file should be cached based on type and size
   * @param file - File to check
   * @returns Whether the file should be cached
   */
  private shouldCache(file: TFile): boolean {
    // Don't cache very large files
    const MAX_CACHEABLE_SIZE = 1000000; // 1MB
    if (file.stat.size > MAX_CACHEABLE_SIZE) {
      return false;
    }
    
    // Always cache markdown files
    if (file.extension === 'md') {
      return true;
    }
    
    // Cache other common text files
    const textExtensions = ['txt', 'json', 'yaml', 'yml', 'csv', 'html', 'css', 'js', 'ts'];
    if (textExtensions.includes(file.extension)) {
      return true;
    }
    
    // Don't cache binary files
    return false;
  }
  
  /**
   * Override createNote to invalidate cache
   */
  public async createNote(path: string, content: string, overwrite: boolean = false): Promise<{ path: string }> {
    // Call super implementation
    const result = await super.createNote(path, content, overwrite);
    
    // Invalidate cache
    this.cache.delete(path);
    
    return result;
  }
  
  /**
   * Override updateNote to invalidate cache
   */
  public async updateNote(path: string, content: string): Promise<{ path: string }> {
    // Call super implementation
    const result = await super.updateNote(path, content);
    
    // Invalidate cache
    this.cache.delete(path);
    
    return result;
  }
  
  /**
   * Override deleteNote to invalidate cache
   */
  public async deleteNote(path: string): Promise<void> {
    // Call super implementation
    await super.deleteNote(path);
    
    // Invalidate cache
    this.cache.delete(path);
  }
  
  /**
   * Check if a path is cached
   * @param path - Path to check
   * @returns Whether the path is cached
   */
  private isCached(path: string): boolean {
    // Skip if cache is disabled
    if (!this.cacheConfig.enabled) {
      return false;
    }
    
    // Check if in cache
    const entry = this.cache.get(path);
    
    // Not in cache
    if (!entry) {
      return false;
    }
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.cacheConfig.ttl) {
      // Remove expired entry
      this.cache.delete(path);
      return false;
    }
    
    return true;
  }
  
  /**
   * Get cached entry if valid
   * @param path - Path to get
   * @returns Cache entry or undefined
   */
  private getCachedEntry(path: string): CacheEntry | undefined {
    // Skip if cache is disabled
    if (!this.cacheConfig.enabled) {
      return undefined;
    }
    
    // Check if in cache
    const entry = this.cache.get(path);
    
    // Not in cache
    if (!entry) {
      return undefined;
    }
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.cacheConfig.ttl) {
      // Remove expired entry
      this.cache.delete(path);
      return undefined;
    }
    
    return entry;
  }
  
  /**
   * Enforce maximum cache size
   */
  private enforceCacheSize(): void {
    // Skip if under limit
    if (this.cache.size <= this.cacheConfig.maxSize) {
      return;
    }
    
    // Get entries sorted by timestamp (oldest first)
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest entries until under limit
    const entriesToRemove = entries.slice(0, this.cache.size - this.cacheConfig.maxSize);
    
    for (const [path] of entriesToRemove) {
      this.cache.delete(path);
    }
  }
}
```


### 2. Implement Batch Operations

Next, let's implement a batch operations system for efficient execution of multiple operations:

```typescript
/**
 * Batch operation types
 */
export type BatchOperation = 
  | { type: 'read'; path: string }
  | { type: 'create'; path: string; content: string; overwrite?: boolean }
  | { type: 'update'; path: string; content: string }
  | { type: 'delete'; path: string }
  | { type: 'list'; path: string; options?: any };

/**
 * Result of a batch operation
 */
export interface BatchResult {
  /**
   * Whether the operation succeeded
   */
  success: boolean;
  
  /**
   * Operation result (if successful)
   */
  result?: any;
  
  /**
   * Error message (if failed)
   */
  error?: string;
}

/**
 * Add batch operations to the VaultFacade interface
 */
export interface IBatchVaultFacade extends ICachedVaultFacade {
  /**
   * Execute multiple operations in a single batch
   * @param operations - Array of operations to perform
   * @returns Array of results for each operation
   */
  executeBatch(operations: BatchOperation[]): Promise<BatchResult[]>;
}

/**
 * Add batch operations to VaultFacade
 */
export class BatchVaultFacade extends CachedVaultFacade implements IBatchVaultFacade {
  /**
   * Execute multiple operations in a single batch
   * @param operations - Array of operations to perform
   * @returns Array of results for each operation
   */
  public async executeBatch(operations: BatchOperation[]): Promise<BatchResult[]> {
    const results: BatchResult[] = [];
    
    // Start batch
    this.eventBus.emit('vaultFacade:batchStarted', {
      operations: operations.length
    });
    
    // Execute each operation
    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      
      try {
        let result: any;
        
        // Execute operation based on type
        switch (operation.type) {
          case 'read':
            result = await this.readNote(operation.path);
            break;
            
          case 'create':
            result = await this.createNote(
              operation.path,
              operation.content,
              operation.overwrite
            );
            break;
            
          case 'update':
            result = await this.updateNote(
              operation.path,
              operation.content
            );
            break;
            
          case 'delete':
            await this.deleteNote(operation.path);
            result = { path: operation.path };
            break;
            
          case 'list':
            result = await this.listFolder(
              operation.path,
              operation.options
            );
            break;
            
          default:
            throw new Error(`Unknown operation type: ${(operation as any).type}`);
        }
        
        // Add success result
        results.push({
          success: true,
          result
        });
        
        // Emit progress event
        this.eventBus.emit('vaultFacade:batchProgress', {
          current: i + 1,
          total: operations.length,
          success: true
        });
      } catch (error) {
        // Add error result
        results.push({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
        
        // Emit progress event
        this.eventBus.emit('vaultFacade:batchProgress', {
          current: i + 1,
          total: operations.length,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // End batch
    this.eventBus.emit('vaultFacade:batchCompleted', {
      operations: operations.length,
      results: results.length,
      success: results.filter(r => r.success).length,
      errors: results.filter(r => !r.success).length
    });
    
    return results;
  }
  
  /**
   * Execute multiple operations as an atomic batch (all succeed or all fail)
   * @param operations - Array of operations to perform
   * @returns Array of results for each operation
   */
  public async executeAtomicBatch(operations: BatchOperation[]): Promise<BatchResult[]> {
    // Start transaction
    const transaction = this.beginTransaction();
    
    try {
      // Add operations to transaction
      for (const operation of operations) {
        this.addOperation(transaction.id, operation);
      }
      
      // Commit transaction
      return await this.commitTransaction(transaction.id);
    } catch (error) {
      // Rollback transaction on error
      await this.rollbackTransaction(transaction.id);
      
      // Re-throw error
      throw error;
    }
  }
}
```

### 3. Create Batch Operation Example

Here's an example of how to use batch operations to efficiently perform multiple vault operations:

```typescript
/**
 * Example of using batch operations
 */
/**
 * Enhanced batch operations with undo support and error handling
 */
export class EnhancedBatchVaultFacade extends BatchVaultFacade {
  /**
   * Execute a batch with progress tracking and user feedback
   */
  public async executeWithProgress(operations: BatchOperation[]): Promise<BatchResult[]> {
    // Create status bar item for tracking progress
    const statusBar = this.addStatusBarItem();
    statusBar.setText('Processing batch operations...');
    
    try {
      // Start batch with progress tracking
      let completed = 0;
      const total = operations.length;
      
      // Update progress in status bar
      const updateProgress = () => {
        completed++;
        statusBar.setText(`Processing: ${completed}/${total} operations`);
      };
      
      // Register progress event handler
      const progressHandler = this.eventBus.on('vaultFacade:batchProgress', () => {
        updateProgress();
      });
      
      // Execute batch
      const results = await this.executeBatch(operations);
      
      // Unregister progress handler
      this.eventBus.off('vaultFacade:batchProgress', progressHandler);
      
      // Show completion notice
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;
      
      if (failureCount === 0) {
        new Notice(`Batch completed: ${successCount} operations successful`);
      } else {
        new Notice(`Batch completed with errors: ${successCount} succeeded, ${failureCount} failed`);
      }
      
      // Clear status bar
      statusBar.setText('');
      
      return results;
    } catch (error) {
      // Clear status bar on error
      statusBar.setText('');
      
      // Show error notice
      new Notice(`Batch operation failed: ${error.message}`);
      
      throw error;
    }
  }
}

export function demonstrateBatchOperations(vaultFacade: BatchVaultFacade) {
  // Define batch operations
  const operations: BatchOperation[] = [
    // Create a new folder
    { 
      type: 'create', 
      path: 'Batch Example/readme.md', 
      content: '# Batch Operations Example\n\nThis folder was created using batch operations.' 
    },
    
    // Create multiple notes
    { 
      type: 'create', 
      path: 'Batch Example/note1.md', 
      content: '# Note 1\n\nThis is the first note.' 
    },
    { 
      type: 'create', 
      path: 'Batch Example/note2.md', 
      content: '# Note 2\n\nThis is the second note.' 
    },
    { 
      type: 'create', 
      path: 'Batch Example/note3.md', 
      content: '# Note 3\n\nThis is the third note.' 
    },
    
    // Read a note
    { 
      type: 'read', 
      path: 'Batch Example/note1.md' 
    },
    
    // List folder contents
    { 
      type: 'list', 
      path: 'Batch Example' 
    }
  ];
  
  // Execute batch operations
  async function executeBatch() {
    try {
      // Execute batch
      const results = await vaultFacade.executeBatch(operations);
      
      // Process results
      console.log(`Batch completed: ${results.filter(r => r.success).length}/${results.length} operations successful`);
      
      // Check folder contents
      const folderContents = results[results.length - 1].result;
      console.log('Folder contents:', folderContents);
    } catch (error) {
      console.error('Error executing batch:', error);
    }
  }
  
  // Execute the batch
  executeBatch();
}
```


### 4. Implement File Change Monitoring

Now, let's add a system to monitor file changes:

```typescript
/**
 * Types of file changes
 */
export type ChangeType = 'create' | 'modify' | 'delete' | 'rename';

/**
 * Information about a file change
 */
export interface FileChange {
  /**
   * Path to the file
   */
  path: string;
  
  /**
   * Type of change
   */
  type: ChangeType;
  
  /**
   * Old path (for rename operations)
   */
  oldPath?: string;
}

/**
 * File change watcher
 */
interface Watcher {
  /**
   * Unique watcher ID
   */
  id: string;
  
  /**
   * Path to watch
   */
  path: string;
  
  /**
   * Callback to invoke when changes occur
   */
  callback: (change: FileChange) => void;
}

/**
 * Add file monitoring to the VaultFacade interface
 */
export interface IWatchableVaultFacade extends IBatchVaultFacade {
  /**
   * Watch a file or folder for changes
   * @param path - Path to watch
   * @param callback - Function to call when changes occur
   * @returns Unique watcher ID
   */
  watchChanges(
    path: string, 
    callback: (change: FileChange) => void
  ): string;
  
  /**
   * Stop watching a path
   * @param id - Watcher ID to remove
   */
  unwatchChanges(id: string): void;
  
  /**
   * Get all active watchers
   * @returns Array of watcher information
   */
  getWatchers(): { id: string; path: string }[];
}

/**
 * Add file change monitoring to VaultFacade
 */
export class WatchableVaultFacade extends BatchVaultFacade implements IWatchableVaultFacade {
  /**
   * Map of watcher IDs to watchers
   */
  private watchers: Map<string, Watcher> = new Map();
  
  /**
   * Constructor
   */
  constructor(app: App, eventBus: EventBus) {
    super(app, eventBus);
    
    // Register Obsidian vault event handlers
    this.registerVaultEvents();
  }
  
  /**
   * Register Obsidian vault event handlers
   */
  private registerVaultEvents(): void {
    // Use registerEvent for proper cleanup when component is unloaded
    // File created
    this.registerEvent(
      this.app.vault.on('create', (file) => {
        this.handleFileChange('create', file);
      })
    );
    
    // File modified
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        this.handleFileChange('modify', file);
      })
    );
    
    // File deleted
    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        this.handleFileChange('delete', file);
      })
    );
    
    // File renamed
    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        this.handleFileChange('rename', file, oldPath);
      })
    );
  }
  
  /**
   * Handle file changes and notify watchers
   * @param type - Type of change
   * @param file - File that changed
   * @param oldPath - Old path (for rename operations)
   */
  private handleFileChange(type: ChangeType, file: TFile | TFolder, oldPath?: string): void {
    // Create change object
    const change: FileChange = {
      path: file.path,
      type,
      oldPath
    };
    
    // Notify watchers
    for (const watcher of this.watchers.values()) {
      // Check if watcher is interested in this file
      if (file.path.startsWith(watcher.path) || 
          (oldPath && oldPath.startsWith(watcher.path))) {
        try {
          // Call watcher callback
          watcher.callback(change);
        } catch (error) {
          console.error(`Error in watcher callback (${watcher.id}):`, error);
        }
      }
    }
    
    // Emit event
    this.eventBus.emit('vaultFacade:fileChanged', change);
    
    // Handle cache invalidation
    if (type === 'modify' || type === 'delete' || type === 'rename') {
      if (oldPath) {
        this.cache.delete(oldPath);
      }
      
      if (type !== 'delete') {
        this.cache.delete(file.path);
      }
    }
  }
  
  /**
   * Watch a file or folder for changes
   * @param path - Path to watch
   * @param callback - Function to call when changes occur
   * @returns Unique watcher ID
   */
  public watchChanges(
    path: string, 
    callback: (change: FileChange) => void
  ): string {
    // Generate unique ID
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    
    // Create watcher
    const watcher: Watcher = {
      id,
      path,
      callback
    };
    
    // Add to watchers
    this.watchers.set(id, watcher);
    
    // Emit event
    this.eventBus.emit('vaultFacade:watcherCreated', {
      id,
      path
    });
    
    return id;
  }
  
  /**
   * Stop watching a path
   * @param id - Watcher ID to remove
   */
  public unwatchChanges(id: string): void {
    // Check if watcher exists
    if (!this.watchers.has(id)) {
      return;
    }
    
    // Get watcher
    const watcher = this.watchers.get(id);
    
    // Remove watcher
    this.watchers.delete(id);
    
    // Emit event
    this.eventBus.emit('vaultFacade:watcherRemoved', {
      id,
      path: watcher.path
    });
  }
  
  /**
   * Get all active watchers
   * @returns Array of watcher information
   */
  public getWatchers(): { id: string; path: string }[] {
    return Array.from(this.watchers.values()).map(watcher => ({
      id: watcher.id,
      path: watcher.path
    }));
  }
}
```

### 5. Create File Monitoring Example

Here's an example of how to use file monitoring to track changes to notes:

```typescript
/**
 * Example of using file monitoring
 */
export function demonstrateFileMonitoring(vaultFacade: WatchableVaultFacade) {
  // Watch a folder for changes
  const watcherId = vaultFacade.watchChanges('Daily Notes', (change) => {
    // Handle different change types
    switch (change.type) {
      case 'create':
        console.log(`New file created: ${change.path}`);
        break;
        
      case 'modify':
        console.log(`File modified: ${change.path}`);
        break;
        
      case 'delete':
        console.log(`File deleted: ${change.path}`);
        break;
        
      case 'rename':
        console.log(`File renamed from ${change.oldPath} to ${change.path}`);
        break;
    }
    
    // Update UI or perform other actions based on changes
    // ...
  });
  
  // Log the watcher ID for later removal
  console.log(`Watching 'Daily Notes' with watcher ID: ${watcherId}`);
  
  // Example of removing the watcher after some time
  setTimeout(() => {
    vaultFacade.unwatchChanges(watcherId);
    console.log(`Stopped watching 'Daily Notes'`);
  }, 3600000); // Stop watching after 1 hour
}
```


### 6. Implement Virtual Files

Let's add support for virtual files that can be manipulated in memory before committing to disk:

```typescript
/**
 * Virtual file for in-memory manipulation
 */
export interface VirtualFile {
  /**
   * Path of the virtual file
   */
  path: string;
  
  /**
   * Content of the virtual file
   */
  content: string;
  
  /**
   * Whether the file has been modified
   */
  isDirty: boolean;
}

/**
 * Add virtual file support to the VaultFacade interface
 */
export interface IVirtualVaultFacade extends IWatchableVaultFacade {
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
  
  /**
   * Get all virtual files
   * @returns Array of virtual files
   */
  getVirtualFiles(): VirtualFile[];
}

/**
 * Add virtual file support to VaultFacade
 */
export class VirtualVaultFacade extends WatchableVaultFacade implements IVirtualVaultFacade {
  /**
   * Map of path to virtual file
   */
  private virtualFiles: Map<string, VirtualFile> = new Map();
  
  /**
   * Create a virtual file in memory
   * @param path - Path for the virtual file
   * @param content - Initial content
   * @returns Virtual file object
   */
  public createVirtualFile(path: string, content: string): VirtualFile {
    const virtualFile: VirtualFile = {
      path,
      content,
      isDirty: true
    };
    
    // Add to virtual files
    this.virtualFiles.set(path, virtualFile);
    
    // Emit event
    this.eventBus.emit('vaultFacade:virtualFileCreated', {
      path,
      size: content.length
    });
    
    return virtualFile;
  }
  
  /**
   * Get a virtual file
   * @param path - Path of the virtual file
   * @returns Virtual file or null if not found
   */
  public getVirtualFile(path: string): VirtualFile | null {
    return this.virtualFiles.get(path) || null;
  }
  
  /**
   * Update a virtual file
   * @param path - Path of the virtual file
   * @param content - New content
   * @returns Updated virtual file
   */
  public updateVirtualFile(path: string, content: string): VirtualFile {
    // Check if virtual file exists
    const virtualFile = this.virtualFiles.get(path);
    
    if (!virtualFile) {
      // Create new virtual file
      return this.createVirtualFile(path, content);
    }
    
    // Update content
    virtualFile.content = content;
    virtualFile.isDirty = true;
    
    // Emit event
    this.eventBus.emit('vaultFacade:virtualFileUpdated', {
      path,
      size: content.length
    });
    
    return virtualFile;
  }
  
  /**
   * Commit a virtual file to disk
   * @param path - Path of the virtual file
   * @returns Promise resolving when file is committed
   */
  public async commitVirtualFile(path: string): Promise<void> {
    // Check if virtual file exists
    const virtualFile = this.virtualFiles.get(path);
    
    if (!virtualFile) {
      throw new Error(`Virtual file not found: ${path}`);
    }
    
    // Create or update file
    const file = this.getFileByPath(path);
    
    if (file) {
      // Update existing file
      await this.updateNote(path, virtualFile.content);
    } else {
      // Create new file
      await this.createNote(path, virtualFile.content);
    }
    
    // Mark as not dirty
    virtualFile.isDirty = false;
    
    // Emit event
    this.eventBus.emit('vaultFacade:virtualFileCommitted', {
      path,
      size: virtualFile.content.length
    });
  }
  
  /**
   * Discard a virtual file
   * @param path - Path of the virtual file
   */
  public discardVirtualFile(path: string): void {
    // Check if virtual file exists
    if (!this.virtualFiles.has(path)) {
      return;
    }
    
    // Remove virtual file
    this.virtualFiles.delete(path);
    
    // Emit event
    this.eventBus.emit('vaultFacade:virtualFileDiscarded', {
      path
    });
  }
  
  /**
   * Get all virtual files
   * @returns Array of virtual files
   */
  public getVirtualFiles(): VirtualFile[] {
    return Array.from(this.virtualFiles.values());
  }
  
  /**
   * Override readNote to check virtual files first
   */
  public async readNote(path: string): Promise<{ content: string; path: string }> {
    // Check virtual files first
    const virtualFile = this.virtualFiles.get(path);
    
    if (virtualFile) {
      // Emit event
      this.eventBus.emit('vaultFacade:virtualFileRead', {
        path,
        size: virtualFile.content.length
      });
      
      return {
        content: virtualFile.content,
        path
      };
    }
    
    // Not a virtual file, use super implementation
    return super.readNote(path);
  }
}
```

### 7. Create Virtual Files Example

Here's an example of how to use virtual files for complex editing operations:

```typescript
/**
 * Example of using virtual files
 */
export function demonstrateVirtualFiles(vaultFacade: VirtualVaultFacade) {
  /**
   * Create a new blog post draft
   * @param title - Post title
   * @returns Path to the virtual file
   */
  async function createBlogPostDraft(title: string): Promise<string> {
    // Generate file path
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const path = `Blog Drafts/${sanitizedTitle}.md`;
    
    // Create template
    const content = `---
title: ${title}
date: ${new Date().toISOString().split('T')[0]}
status: draft
tags:
  - blog
  - draft
---

# ${title}

## Introduction

Write your introduction here...

## Main Content

Write your main content here...

## Conclusion

Write your conclusion here...
`;
    
    // Create virtual file
    const virtualFile = vaultFacade.createVirtualFile(path, content);
    
    console.log(`Created virtual blog post draft: ${path}`);
    
    return path;
  }
  
  /**
   * Update a blog post draft
   * @param path - Path to the draft
   * @param section - Section to update
   * @param content - New content
   */
  async function updateBlogPostDraft(
    path: string,
    section: 'Introduction' | 'Main Content' | 'Conclusion',
    content: string
  ): Promise<void> {
    // Get virtual file
    const virtualFile = vaultFacade.getVirtualFile(path);
    
    if (!virtualFile) {
      throw new Error(`Blog post draft not found: ${path}`);
    }
    
    // Find section in content
    const sectionRegex = new RegExp(`## ${section}\n\n.*?\n\n`, 's');
    const updatedContent = virtualFile.content.replace(
      sectionRegex,
      `## ${section}\n\n${content}\n\n`
    );
    
    // Update virtual file
    vaultFacade.updateVirtualFile(path, updatedContent);
    
    console.log(`Updated "${section}" section in ${path}`);
  }
  
  /**
   * Publish blog post
   * @param path - Path to the draft
   */
  async function publishBlogPost(path: string): Promise<string> {
    // Get virtual file
    const virtualFile = vaultFacade.getVirtualFile(path);
    
    if (!virtualFile) {
      throw new Error(`Blog post draft not found: ${path}`);
    }
    
    // Update frontmatter
    const updatedContent = virtualFile.content.replace(
      'status: draft',
      'status: published'
    );
    
    // Create published path
    const publishedPath = path.replace('Blog Drafts', 'Blog Published');
    
    // Create virtual file for published post
    vaultFacade.createVirtualFile(publishedPath, updatedContent);
    
    // Commit both files
    await vaultFacade.commitVirtualFile(path);
    await vaultFacade.commitVirtualFile(publishedPath);
    
    console.log(`Published blog post: ${publishedPath}`);
    
    return publishedPath;
  }
  
  // Example usage
  async function workWithBlogPost() {
    try {
      // Create draft
      const path = await createBlogPostDraft('Using Virtual Files in Obsidian');
      
      // Update sections
      await updateBlogPostDraft(
        path,
        'Introduction',
        'Virtual files provide a powerful way to work with content in memory before committing to disk.'
      );
      
      await updateBlogPostDraft(
        path,
        'Main Content',
        'The VirtualVaultFacade class extends the standard VaultFacade with support for virtual files...'
      );
      
      await updateBlogPostDraft(
        path,
        'Conclusion',
        'By using virtual files, you can perform complex edits and only save when ready.'
      );
      
      // Publish
      const publishedPath = await publishBlogPost(path);
      
      console.log('Blog post workflow complete!');
    } catch (error) {
      console.error('Error working with blog post:', error);
    }
  }
  
  // Run the example
  workWithBlogPost();
}
```


### 8. Implement Transaction Support

Finally, let's add transaction support for atomic operations:

```typescript
/**
 * Transaction for atomic operations
 */
export interface Transaction {
  /**
   * Unique transaction ID
   */
  id: string;
  
  /**
   * Operations to perform
   */
  operations: BatchOperation[];
  
  /**
   * Current transaction status
   */
  status: 'pending' | 'committed' | 'rolled-back';
}

/**
 * Add transaction support to the VaultFacade interface
 */
export interface ITransactionalVaultFacade extends IVirtualVaultFacade {
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
   * @returns Promise resolving to results of operations
   */
  commitTransaction(transactionId: string): Promise<BatchResult[]>;
  
  /**
   * Rollback a transaction
   * @param transactionId - Transaction ID
   */
  rollbackTransaction(transactionId: string): Promise<void>;
  
  /**
   * Get a transaction by ID
   * @param transactionId - Transaction ID
   * @returns Transaction or null if not found
   */
  getTransaction(transactionId: string): Transaction | null;
}

/**
 * Add transaction support to VaultFacade
 */
export class TransactionalVaultFacade extends VirtualVaultFacade implements ITransactionalVaultFacade {
  /**
   * Map of transaction ID to transaction
   */
  private transactions: Map<string, Transaction> = new Map();
  
  /**
   * Begin a new transaction
   * @returns Transaction object
   */
  public beginTransaction(): Transaction {
    // Generate unique ID
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    
    // Create transaction
    const transaction: Transaction = {
      id,
      operations: [],
      status: 'pending'
    };
    
    // Add to transactions
    this.transactions.set(id, transaction);
    
    // Emit event
    this.eventBus.emit('vaultFacade:transactionBegun', {
      id
    });
    
    return transaction;
  }
  
  /**
   * Add operation to a transaction
   * @param transactionId - Transaction ID
   * @param operation - Operation to add
   */
  public addOperation(transactionId: string, operation: BatchOperation): void {
    // Check if transaction exists
    const transaction = this.transactions.get(transactionId);
    
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }
    
    // Check if transaction is pending
    if (transaction.status !== 'pending') {
      throw new Error(`Cannot add operation to ${transaction.status} transaction`);
    }
    
    // Add operation
    transaction.operations.push(operation);
    
    // Emit event
    this.eventBus.emit('vaultFacade:operationAdded', {
      transactionId,
      operationCount: transaction.operations.length
    });
  }
  
  /**
   * Commit a transaction
   * @param transactionId - Transaction ID
   * @returns Promise resolving to results of operations
   */
  public async commitTransaction(transactionId: string): Promise<BatchResult[]> {
    // Check if transaction exists
    const transaction = this.transactions.get(transactionId);
    
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }
    
    // Check if transaction is pending
    if (transaction.status !== 'pending') {
      throw new Error(`Cannot commit ${transaction.status} transaction`);
    }
    
    // Emit event
    this.eventBus.emit('vaultFacade:transactionCommitting', {
      id: transactionId,
      operationCount: transaction.operations.length
    });
    
    try {
      // Execute operations
      const results = await this.executeBatch(transaction.operations);
      
      // Check if any operation failed
      const anyFailures = results.some(r => !r.success);
      
      if (anyFailures) {
        // Roll back on any failure
        await this.rollbackTransaction(transactionId);
        
        throw new Error('Transaction rolled back due to operation failures');
      }
      
      // Mark as committed
      transaction.status = 'committed';
      
      // Emit event
      this.eventBus.emit('vaultFacade:transactionCommitted', {
        id: transactionId,
        operationCount: transaction.operations.length
      });
      
      return results;
    } catch (error) {
      // Roll back on error
      await this.rollbackTransaction(transactionId);
      
      // Re-throw error
      throw error;
    }
  }
  
  /**
   * Rollback a transaction
   * @param transactionId - Transaction ID
   */
  public async rollbackTransaction(transactionId: string): Promise<void> {
    // Check if transaction exists
    const transaction = this.transactions.get(transactionId);
    
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }
    
    // Check if already rolled back
    if (transaction.status === 'rolled-back') {
      return;
    }
    
    // Mark as rolled back
    transaction.status = 'rolled-back';
    
    // Emit event
    this.eventBus.emit('vaultFacade:transactionRolledBack', {
      id: transactionId,
      operationCount: transaction.operations.length
    });
    
    // Implement rollback using Obsidian's native Command system for undo support
    const operationSnapshots = this.transactionHistory.get(transactionId) || [];
    
    if (operationSnapshots.length > 0) {
      // Restore state from snapshots in reverse order
      for (let i = operationSnapshots.length - 1; i >= 0; i--) {
        const snapshot = operationSnapshots[i];
        try {
          // Restore from snapshot
          await this.restoreFromSnapshot(snapshot);
        } catch (error) {
          console.error(`Error restoring snapshot: ${error.message}`);
          // Continue with other snapshots
        }
      }
    } else {
      console.warn(`No operation snapshots found for transaction: ${transactionId}`);
    }
    
    // Clear snapshots after rollback
    this.transactionHistory.delete(transactionId);
  }
  
  /**
   * Get a transaction by ID
   * @param transactionId - Transaction ID
   * @returns Transaction or null if not found
   */
  public getTransaction(transactionId: string): Transaction | null {
    return this.transactions.get(transactionId) || null;
  }
  
  /**
   * Get all transactions
   * @returns Array of transactions
   */
  public getTransactions(): Transaction[] {
    return Array.from(this.transactions.values());
  }
}
```

### 9. Create Transaction Example

Here's an example of how to use transactions for atomic operations:

```typescript
/**
 * Example of using transactions
 */
export function demonstrateTransactions(vaultFacade: TransactionalVaultFacade) {
  /**
   * Create a project structure with transactions
   * @param projectName - Name of the project
   * @param description - Project description
   * @returns Promise resolving when project is created
   */
  async function createProject(projectName: string, description: string): Promise<void> {
    // Begin transaction
    const transaction = vaultFacade.beginTransaction();
    
    // Sanitize project name for folder
    const sanitizedName = projectName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const projectFolder = `Projects/${sanitizedName}`;
    
    try {
      // Add operations to create project structure
      
      // 1. Create project folder
      vaultFacade.addOperation(transaction.id, {
        type: 'create',
        path: `${projectFolder}/README.md`,
        content: `# ${projectName}\n\n${description}\n\n## Project Structure\n\n- \`docs/\` - Documentation\n- \`src/\` - Source code\n- \`tests/\` - Tests\n`
      });
      
      // 2. Create documentation folder
      vaultFacade.addOperation(transaction.id, {
        type: 'create',
        path: `${projectFolder}/docs/index.md`,
        content: `# ${projectName} Documentation\n\nWelcome to the documentation for ${projectName}.\n`
      });
      
      // 3. Create source code folder
      vaultFacade.addOperation(transaction.id, {
        type: 'create',
        path: `${projectFolder}/src/index.md`,
        content: `# ${projectName} Source Code\n\nMain source code directory for ${projectName}.\n`
      });
      
      // 4. Create tests folder
      vaultFacade.addOperation(transaction.id, {
        type: 'create',
        path: `${projectFolder}/tests/index.md`,
        content: `# ${projectName} Tests\n\nTest files for ${projectName}.\n`
      });
      
      // 5. Create project metadata
      vaultFacade.addOperation(transaction.id, {
        type: 'create',
        path: `${projectFolder}/project.json`,
        content: JSON.stringify({
          name: projectName,
          description,
          created: new Date().toISOString(),
          status: 'active'
        }, null, 2)
      });
      
      // Commit the transaction
      const results = await vaultFacade.commitTransaction(transaction.id);
      
      console.log(`Project "${projectName}" created successfully with ${results.length} operations.`);
    } catch (error) {
      // Transaction will be automatically rolled back
      console.error(`Failed to create project "${projectName}":`, error);
      throw error;
    }
  }
  
  // Example usage
  async function setupProject() {
    try {
      await createProject(
        "Chatsidian Pro",
        "An enhanced version of Chatsidian with additional features and improved UI."
      );
      
      console.log('Project setup complete!');
    } catch (error) {
      console.error('Project setup failed:', error);
    }
  }
  
  // Run the example
  setupProject();
}
```


### 10. Create Enhanced VaultFacade

Let's combine all the advanced features into a single enhanced VaultFacade class:

```typescript
/**
 * Enhanced VaultFacade with all advanced features
 */
export class EnhancedVaultFacade extends TransactionalVaultFacade implements 
  ICachedVaultFacade, 
  IBatchVaultFacade,
  IWatchableVaultFacade,
  IVirtualVaultFacade,
  ITransactionalVaultFacade {
  
  /**
   * Map for operation snapshots to support rollback
   */
  private transactionHistory: Map<string, OperationSnapshot[]> = new Map();
  
  /**
   * Track performance metrics for operations
   */
  private metrics: Record<string, {
    calls: number;
    totalTime: number;
    averageTime: number;
    maxTime: number;
  }> = {};
  
  /**
   * Constructor
   */
  constructor(app: App, eventBus: EventBus) {
    super(app, eventBus);
    
    // Initialize with default settings
    this.configureCache({
      enabled: true,
      maxSize: 100,
      ttl: 60000 // 1 minute
    });
    
    // Initialize metrics
    this.initializeMetrics();
    
    // Log initialization
    console.log('EnhancedVaultFacade initialized with all advanced features');
  }
  
  /**
   * Component lifecycle method - called when component is loaded
   */
  onload(): void {
    super.onload();
    
    // Register for Obsidian's layout-ready event to perform additional initialization
    this.registerEvent(
      this.app.workspace.on('layout-ready', () => {
        this.onWorkspaceReady();
      })
    );
  }
  
  /**
   * Called when workspace layout is ready
   */
  private onWorkspaceReady(): void {
    // Preload frequently used files in cache
    this.preloadCommonFiles();
  }
  
  /**
   * Preload commonly accessed files
   */
  private preloadCommonFiles(): void {
    // Only preload if cache is enabled
    if (!this.cacheConfig.enabled) return;
    
    // Common files to preload
    const commonFiles = [
      'README.md',
      'index.md'
    ];
    
    // Preload files
    this.preloadCache(commonFiles).catch(error => {
      console.warn('Error preloading cache:', error);
    });
  }
  
  /**
   * Initialize performance metrics
   */
  private initializeMetrics(): void {
    // Initialize metrics for common operations
    const operations = [
      'readNote',
      'createNote',
      'updateNote',
      'deleteNote',
      'listFolder',
      'executeBatch',
      'commitTransaction'
    ];
    
    for (const op of operations) {
      this.metrics[op] = {
        calls: 0,
        totalTime: 0,
        averageTime: 0,
        maxTime: 0
      };
    }
  }
  
  /**
   * Record performance metric for an operation
   * @param operation - Operation name
   * @param time - Execution time in milliseconds
   */
  private recordMetric(operation: string, time: number): void {
    if (!this.metrics[operation]) {
      this.metrics[operation] = {
        calls: 0,
        totalTime: 0,
        averageTime: 0,
        maxTime: 0
      };
    }
    
    const metric = this.metrics[operation];
    metric.calls++;
    metric.totalTime += time;
    metric.averageTime = metric.totalTime / metric.calls;
    metric.maxTime = Math.max(metric.maxTime, time);
  }
  
  /**
   * Get performance metrics
   * @returns Performance metrics for all operations
   */
  public getPerformanceMetrics(): Record<string, {
    calls: number;
    totalTime: number;
    averageTime: number;
    maxTime: number;
  }> {
    return { ...this.metrics };
  }
  
  /**
   * Get cache statistics
   * @returns Cache hit/miss statistics
   */
  public getCacheStats(): { hits: number; misses: number; invalidations: number } {
    return { ...this.cacheStats };
  }
  
  /**
   * Enhanced search that leverages Obsidian's MetadataCache
   * @param query - Search query
   * @param options - Search options
   * @returns Search results with improved metadata
   */
  public async searchWithMetadata(query: string, options?: any): Promise<any[]> {
    const startTime = Date.now();
    
    try {
      // Use Obsidian's MetadataCache for more efficient searching
      const results = [];
      
      // Get all markdown files
      const files = this.app.vault.getMarkdownFiles();
      
      // For each file, check if it matches the query
      for (const file of files) {
        // Get file metadata
        const metadata = this.app.metadataCache.getFileCache(file);
        if (!metadata) continue;
        
        // Check for match in title
        const titleMatch = file.basename.toLowerCase().includes(query.toLowerCase());
        
        // Check for match in headings
        const headingsMatch = metadata.headings?.some(h => 
          h.heading.toLowerCase().includes(query.toLowerCase())
        ) || false;
        
        // Check for match in tags
        const tagsMatch = metadata.tags?.some(tag => 
          tag.tag.toLowerCase().includes(query.toLowerCase())
        ) || false;
        
        // Add to results if any match
        if (titleMatch || headingsMatch || tagsMatch) {
          results.push({
            path: file.path,
            title: file.basename,
            matches: {
              title: titleMatch,
              headings: headingsMatch,
              tags: tagsMatch
            },
            metadata
          });
        }
      }
      
      // Record metric
      this.recordMetric('searchWithMetadata', Date.now() - startTime);
      
      return results;
    } catch (error) {
      console.error('Error in searchWithMetadata:', error);
      throw error;
    }
  }
  
  /**
   * Operation snapshot for transaction rollback
   */
  private interface OperationSnapshot {
    operation: BatchOperation;
    previousState?: any;
    path: string;
  }
  
  /**
   * Create operation snapshot before executing
   * @param operation - Operation to snapshot
   * @returns Promise resolving to snapshot
   */
  private async createOperationSnapshot(operation: BatchOperation): Promise<OperationSnapshot> {
    const snapshot: OperationSnapshot = { operation, path: operation.path };
    
    try {
      // For operations that modify content, store the previous state
      if (operation.type === 'update' || operation.type === 'delete') {
        const file = this.getFileByPath(operation.path);
        if (file) {
          // Read current content
          const content = await this.app.vault.read(file);
          snapshot.previousState = { content };
        }
      }
    } catch (error) {
      console.warn(`Error creating operation snapshot: ${error.message}`);
    }
    
    return snapshot;
  }
  
  /**
   * Restore state from operation snapshot
   * @param snapshot - Operation snapshot
   * @returns Promise resolving when restored
   */
  private async restoreFromSnapshot(snapshot: OperationSnapshot): Promise<void> {
    try {
      const { operation, previousState } = snapshot;
      
      if (!previousState) return;
      
      // Restore based on operation type
      switch (operation.type) {
        case 'update':
        case 'delete':
          // Restore previous content
          if (previousState.content) {
            const file = this.getFileByPath(operation.path);
            if (file) {
              await this.app.vault.modify(file, previousState.content);
            } else {
              // File was deleted, recreate it
              await this.app.vault.create(operation.path, previousState.content);
            }
          }
          break;
          
        case 'create':
          // Delete created file
          const file = this.getFileByPath(operation.path);
          if (file) {
            await this.app.vault.delete(file);
          }
          break;
      }
    } catch (error) {
      console.error(`Error restoring from snapshot: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Override commitTransaction to track operation snapshots
   */
  public async commitTransaction(transactionId: string): Promise<BatchResult[]> {
    // Check if transaction exists
    const transaction = this.getTransaction(transactionId);
    
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }
    
    // Create snapshots for operations
    const snapshots: OperationSnapshot[] = [];
    for (const operation of transaction.operations) {
      const snapshot = await this.createOperationSnapshot(operation);
      snapshots.push(snapshot);
    }
    
    // Store snapshots for potential rollback
    this.transactionHistory.set(transactionId, snapshots);
    
    // Continue with normal commit
    return super.commitTransaction(transactionId);
  }
}
```

### 11. Update Plugin Core for Enhanced VaultFacade

Now, let's update the main plugin class to use the EnhancedVaultFacade:

```typescript
import { Plugin } from 'obsidian';
import { EventBus } from './core/EventBus';
import { SettingsManager } from './core/SettingsManager';
import { EnhancedVaultFacade } from './core/VaultFacade';
import { BCPRegistry } from './mcp/BCPRegistry';
import { ToolManager } from './mcp/ToolManager';

export default class ChatsidianPlugin extends Plugin {
  public eventBus: EventBus;
  public settings: SettingsManager;
  public vaultFacade: EnhancedVaultFacade;
  public bcpRegistry: BCPRegistry;
  public toolManager: ToolManager;
  
  async onload() {
    console.log('Loading Chatsidian plugin');
    
    // Initialize event bus
    this.eventBus = new EventBus();
    
    // Initialize settings
    this.settings = new SettingsManager(this.app, this.eventBus);
    await this.settings.load();
    
    // Initialize enhanced vault facade
    this.vaultFacade = new EnhancedVaultFacade(this.app, this.eventBus);
    
    // Configure vault facade based on settings
    this.vaultFacade.configureCache({
      enabled: this.settings.getSettings().cacheEnabled,
      maxSize: this.settings.getSettings().cacheSize,
      ttl: this.settings.getSettings().cacheTTL
    });
    
    // Initialize BCP registry
    this.bcpRegistry = new BCPRegistry(
      this.app, 
      this.eventBus, 
      this.settings,
      this.vaultFacade
    );
    
    // Initialize tool manager
    this.toolManager = new ToolManager(this.eventBus, this.bcpRegistry);
    
    // Initialize BCP registry
    await this.bcpRegistry.initialize();
    
    // Register event handlers
    this.registerEvents();
    
    // Preload cache with frequently accessed files
    if (this.settings.getSettings().cacheEnabled) {
      const frequentFiles = [
        'README.md',
        'Daily Notes/index.md',
        'Projects/index.md'
      ];
      
      this.vaultFacade.preloadCache(frequentFiles)
        .catch(error => console.error('Error preloading cache:', error));
    }
    
    console.log('Chatsidian plugin loaded');
  }
  
  private registerEvents() {
    // Log VaultFacade events in debug mode
    if (this.settings.getSettings().debugMode) {
      // Cache events
      this.eventBus.on('vaultFacade:cacheHit', data => {
        console.log(`Cache hit: ${data.path}`);
      });
      
      this.eventBus.on('vaultFacade:cacheMiss', data => {
        console.log(`Cache miss: ${data.path}`);
      });
      
      // Batch operation events
      this.eventBus.on('vaultFacade:batchCompleted', data => {
        console.log(`Batch completed: ${data.success}/${data.operations} operations successful`);
      });
      
      // File change events
      this.eventBus.on('vaultFacade:fileChanged', change => {
        console.log(`File changed: ${change.path} (${change.type})`);
      });
      
      // Virtual file events
      this.eventBus.on('vaultFacade:virtualFileCommitted', data => {
        console.log(`Virtual file committed: ${data.path}`);
      });
      
      // Transaction events
      this.eventBus.on('vaultFacade:transactionCommitted', data => {
        console.log(`Transaction committed: ${data.id} with ${data.operationCount} operations`);
      });
    }
  }
  
  async onload() {
    console.log('Loading Chatsidian plugin');
    
    // Initialize event bus
    this.eventBus = new EventBus();
    
    // Initialize settings with proper component lifecycle
    this.settings = new SettingsManager(this.app, this.eventBus);
    this.addChild(this.settings); // Add as child for automatic lifecycle management
    await this.settings.load();
    
    // Initialize enhanced vault facade with proper component lifecycle
    this.vaultFacade = new EnhancedVaultFacade(this.app, this.eventBus);
    this.addChild(this.vaultFacade); // Add as child for automatic lifecycle management
    
    // Configure vault facade based on settings
    this.vaultFacade.configureCache({
      enabled: this.settings.getSettings().cacheEnabled,
      maxSize: this.settings.getSettings().cacheSize,
      ttl: this.settings.getSettings().cacheTTL
    });
    
    // Initialize BCP registry with proper component lifecycle
    this.bcpRegistry = new BCPRegistry(
      this.app, 
      this.eventBus, 
      this.settings,
      this.vaultFacade
    );
    this.addChild(this.bcpRegistry); // Add as child for automatic lifecycle management
    
    // Initialize tool manager with proper component lifecycle
    this.toolManager = new ToolManager(this.eventBus, this.bcpRegistry);
    this.addChild(this.toolManager); // Add as child for automatic lifecycle management
    
    // Initialize BCP registry
    await this.bcpRegistry.initialize();
    
    // Register event handlers with proper cleanup
    this.registerEvents();
    
    // Wait for workspace to be ready before preloading cache
    this.app.workspace.onLayoutReady(() => {
      this.onWorkspaceReady();
    });
    
    console.log('Chatsidian plugin loaded');
  }
  
  private onWorkspaceReady() {
    // Preload cache with frequently accessed files once workspace is ready
    if (this.settings.getSettings().cacheEnabled) {
      const frequentFiles = [
        'README.md',
        'Daily Notes/index.md',
        'Projects/index.md'
      ];
      
      this.vaultFacade.preloadCache(frequentFiles)
        .catch(error => console.error('Error preloading cache:', error));
    }
  }
  
  private registerEvents() {
    // Log VaultFacade events in debug mode using proper event registration
    if (this.settings.getSettings().debugMode) {
      // Cache events
      this.registerEvent(
        this.eventBus.on('vaultFacade:cacheHit', data => {
          console.log(`Cache hit: ${data.path}`);
        })
      );
      
      this.registerEvent(
        this.eventBus.on('vaultFacade:cacheMiss', data => {
          console.log(`Cache miss: ${data.path}`);
        })
      );
      
      // Batch operation events
      this.registerEvent(
        this.eventBus.on('vaultFacade:batchCompleted', data => {
          console.log(`Batch completed: ${data.success}/${data.operations} operations successful`);
        })
      );
      
      // File change events
      this.registerEvent(
        this.eventBus.on('vaultFacade:fileChanged', change => {
          console.log(`File changed: ${change.path} (${change.type})`);
        })
      );
      
      // Virtual file events
      this.registerEvent(
        this.eventBus.on('vaultFacade:virtualFileCommitted', data => {
          console.log(`Virtual file committed: ${data.path}`);
        })
      );
      
      // Transaction events
      this.registerEvent(
        this.eventBus.on('vaultFacade:transactionCommitted', data => {
          console.log(`Transaction committed: ${data.id} with ${data.operationCount} operations`);
        })
      );
    }
  }
  
  /**
   * Called when plugin is unloaded
   * Component cleanup is handled automatically through the Component pattern
   */
  onunload() {
    console.log('Unloading Chatsidian plugin');
    // Automatic cleanup through Component pattern
    // Each child component will have its onunload method called
    super.onunload();
  }
}
```

## Documentation References

- [[💻 Coding/Projects/Chatsidian/1_Architecture/Overview]]
- [[💻 Coding/Projects/Chatsidian/1_Architecture/Components/VaultFacade]]
- [[💻 Coding/Projects/Chatsidian/4_Documentation/APIs]]
- [[💻 Coding/Projects/Chatsidian/3_Implementation/Phase2.1-VaultFacade-Foundation]]
- [[💻 Coding/Projects/Chatsidian/3_Implementation/Phase2.2-BCP-Registry-Infrastructure]]
- [[💻 Coding/Projects/Chatsidian/3_Implementation/Phase2.3-Tool-Manager-Implementation]]

## Testing Strategy

### Unit Tests

- Test caching with hits, misses, and invalidation
- Test batch operations with success and failure cases
- Test file watchers and event emission
- Test virtual files and committing to disk
- Test transactions with commit and rollback

```typescript
// Example unit test for caching
describe('EnhancedVaultFacade - Caching', () => {
  let vaultFacade: EnhancedVaultFacade;
  let app: App;
  let eventBus: EventBus;
  let emitSpy: jest.SpyInstance;
  
  beforeEach(() => {
    app = mock<App>();
    eventBus = new EventBus();
    emitSpy = jest.spyOn(eventBus, 'emit');
    
    vaultFacade = new EnhancedVaultFacade(app, eventBus);
    vaultFacade.configureCache({
      enabled: true,
      maxSize: 10,
      ttl: 5000
    });
  });
  
  test('should use cache for repeated reads', async () => {
    // Mock vault.read to return content
    const mockRead = jest.fn().mockResolvedValue('test content');
    app.vault.read = mockRead;
    
    // Mock getFileByPath to return a file
    vaultFacade['getFileByPath'] = jest.fn().mockReturnValue({} as TFile);
    
    // First read should hit the real file
    await vaultFacade.readNote('test.md');
    
    // Second read should use cache
    await vaultFacade.readNote('test.md');
    
    // Read should only be called once
    expect(mockRead).toHaveBeenCalledTimes(1);
    
    // Should emit cache hit event
    expect(emitSpy).toHaveBeenCalledWith('vaultFacade:cacheHit', expect.anything());
  });
  
  test('should enforce max cache size', async () => {
    // Mock getFileByPath and vault.read
    vaultFacade['getFileByPath'] = jest.fn().mockReturnValue({} as TFile);
    app.vault.read = jest.fn().mockImplementation((file) => Promise.resolve(`content for ${file}`));
    
    // Configure small cache
    vaultFacade.configureCache({
      enabled: true,
      maxSize: 3,
      ttl: 5000
    });
    
    // Read more files than max size
    for (let i = 0; i < 5; i++) {
      await vaultFacade.readNote(`file${i}.md`);
    }
    
    // Cache should only contain newest 3 files
    const cache = (vaultFacade as any).cache;
    expect(cache.size).toBe(3);
    expect(cache.has('file0.md')).toBe(false);
    expect(cache.has('file1.md')).toBe(false);
    expect(cache.has('file2.md')).toBe(true);
    expect(cache.has('file3.md')).toBe(true);
    expect(cache.has('file4.md')).toBe(true);
  });
});
```

### Integration Tests

- Test interactions between different advanced features
- Test with real BCPs and tools
- Test performance under load

## Next Steps

Phase 2.5 will focus on implementing the core BCPs using the advanced VaultFacade capabilities, building on the foundation established in this phase.
