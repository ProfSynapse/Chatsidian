/**
 * VaultFacade.ts
 * 
 * This file implements the VaultFacade abstraction layer, which provides a simplified,
 * consistent interface for all Obsidian vault operations. It wraps the Obsidian API
 * and provides additional functionality, error handling, and event emission.
 * 
 * The VaultFacade extends Obsidian's Component class to leverage its lifecycle management,
 * ensuring proper cleanup when the plugin is unloaded.
 * 
 * Related files:
 * - VaultErrors.ts: Custom error types for vault operations
 * - VaultFacadeInterface.ts: Interface definitions for VaultFacade
 */

import { App, TFile, TFolder, MetadataCache, Vault, Events, Component, Notice } from 'obsidian';
import {
  IVaultFacade,
  ListFolderOptions,
  SearchOptions,
  SearchResult,
  NoteReadResult,
  NoteOperationResult,
  FolderListResult,
  VaultFacadeEventType
} from './VaultFacadeInterface';
import {
  VaultError,
  FileNotFoundError,
  FolderNotFoundError,
  FileExistsError,
  AccessDeniedError,
  InvalidPathError,
  OperationFailedError
} from './VaultErrors';

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
        this.events.trigger(VaultFacadeEventType.EXTERNAL_CREATE, { path: file.path, file });
      })
    );
    
    // Listen for file modification events
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file instanceof TFile) {
          this.events.trigger(VaultFacadeEventType.EXTERNAL_MODIFY, { path: file.path, file });
        }
      })
    );
    
    // Listen for file deletion events
    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        this.events.trigger(VaultFacadeEventType.EXTERNAL_DELETE, { path: file.path, file });
      })
    );
    
    // Listen for file rename events
    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        this.events.trigger(VaultFacadeEventType.EXTERNAL_RENAME, { 
          oldPath, 
          newPath: file.path, 
          file 
        });
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
  async readNote(path: string): Promise<NoteReadResult> {
    try {
      // Normalize path
      const normalizedPath = this.normalizePath(path);
      
      // Get file
      const file = this.getFileByPath(normalizedPath);
      if (!file) {
        throw new FileNotFoundError(normalizedPath);
      }
      
      // Use appropriate read method based on context
      // Use cachedRead for better performance when just displaying content
      const content = await this.vault.cachedRead(file);
      
      // Get frontmatter if available
      const frontmatter = this.metadataCache.getFileCache(file)?.frontmatter;
      
      // Trigger event
      this.events.trigger(VaultFacadeEventType.NOTE_READ, { path: normalizedPath });
      
      return { content, path: normalizedPath, frontmatter, file };
    } catch (error) {
      // Re-throw VaultError instances
      if (error instanceof VaultError) {
        throw error;
      }
      
      // Wrap other errors
      console.error(`Error reading note: ${path}`, error);
      throw new OperationFailedError('readNote', path, error.message);
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
  async createNote(path: string, content: string, overwrite: boolean = false): Promise<NoteOperationResult> {
    try {
      // Normalize path
      const normalizedPath = this.normalizePath(path);
      
      // Check if file exists
      const file = this.getFileByPath(normalizedPath);
      
      if (file && !overwrite) {
        throw new FileExistsError(normalizedPath);
      }
      
      // Create or modify file
      let resultFile: TFile;
      
      if (file && overwrite) {
        await this.vault.modify(file, content);
        resultFile = file;
      } else {
        // Ensure parent folder exists
        const folderPath = this.getParentFolder(normalizedPath);
        if (folderPath) {
          const folder = this.getFolderByPath(folderPath);
          if (!folder) {
            await this.createFolder(folderPath);
          }
        }
        
        // Use atomic operation to create the file
        resultFile = await this.vault.create(normalizedPath, content);
      }
      
      // User feedback with Notice
      new Notice(`Note created: ${normalizedPath.split('/').pop()}`);
      
      // Trigger event
      this.events.trigger(VaultFacadeEventType.NOTE_CREATED, { 
        path: normalizedPath, 
        overwrite 
      });
      
      return { path: normalizedPath, file: resultFile };
    } catch (error) {
      // Handle errors
      if (error instanceof VaultError) {
        throw error;
      }
      
      console.error(`Error creating note: ${path}`, error);
      new Notice(`Error creating note: ${error.message}`);
      throw new OperationFailedError('createNote', path, error.message);
    }
  }
  
  /**
   * Update a note's content
   * @param path - Path to the note
   * @param content - New content
   * @returns Promise resolving to updated note path
   * @throws FileNotFoundError if file doesn't exist
   */
  async updateNote(path: string, content: string): Promise<NoteOperationResult> {
    try {
      // Normalize path
      const normalizedPath = this.normalizePath(path);
      
      // Get file
      const file = this.getFileByPath(normalizedPath);
      if (!file) {
        throw new FileNotFoundError(normalizedPath);
      }
      
      // Use Obsidian's atomic process method to safely update the file
      await this.vault.modify(file, content);
      
      // Trigger event
      this.events.trigger(VaultFacadeEventType.NOTE_UPDATED, { path: normalizedPath });
      
      return { path: normalizedPath, file };
    } catch (error) {
      // Handle errors
      if (error instanceof VaultError) {
        throw error;
      }
      
      console.error(`Error updating note: ${path}`, error);
      throw new OperationFailedError('updateNote', path, error.message);
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
      // Normalize path
      const normalizedPath = this.normalizePath(path);
      
      // Get file
      const file = this.getFileByPath(normalizedPath);
      if (!file) {
        throw new FileNotFoundError(normalizedPath);
      }
      
      // Use FileManager to trash the file instead of deleting it permanently
      // This follows Obsidian's user preference (system trash or .trash folder)
      await this.app.fileManager.trashFile(file);
      
      // User feedback
      new Notice(`Note moved to trash: ${normalizedPath.split('/').pop()}`);
      
      // Trigger event
      this.events.trigger(VaultFacadeEventType.NOTE_DELETED, { path: normalizedPath });
    } catch (error) {
      // Handle errors
      if (error instanceof VaultError) {
        throw error;
      }
      
      console.error(`Error deleting note: ${path}`, error);
      throw new OperationFailedError('deleteNote', path, error.message);
    }
  }
  
  /**
   * Rename or move a note
   * @param path - Current path
   * @param newPath - New path
   * @returns Promise resolving to new path
   * @throws FileNotFoundError if file doesn't exist
   */
  async renameNote(path: string, newPath: string): Promise<NoteOperationResult> {
    try {
      // Normalize paths
      const normalizedPath = this.normalizePath(path);
      const normalizedNewPath = this.normalizePath(newPath);
      
      // Get file
      const file = this.getFileByPath(normalizedPath);
      if (!file) {
        throw new FileNotFoundError(normalizedPath);
      }
      
      // Check if destination exists
      const destFile = this.getFileByPath(normalizedNewPath);
      if (destFile) {
        throw new FileExistsError(normalizedNewPath);
      }
      
      // Ensure parent folder exists
      const folderPath = this.getParentFolder(normalizedNewPath);
      if (folderPath) {
        const folder = this.getFolderByPath(folderPath);
        if (!folder) {
          await this.createFolder(folderPath);
        }
      }
      
      // Use FileManager for rename to properly update links
      await this.app.fileManager.renameFile(file, normalizedNewPath);
      
      // Get the new file reference
      const newFile = this.getFileByPath(normalizedNewPath) || undefined;
      
      // User feedback
      new Notice(`Note renamed: ${normalizedPath.split('/').pop()} → ${normalizedNewPath.split('/').pop()}`);
      
      // Trigger event
      this.events.trigger(VaultFacadeEventType.NOTE_RENAMED, { 
        oldPath: normalizedPath, 
        newPath: normalizedNewPath 
      });
      
      return { path: normalizedNewPath, file: newFile };
    } catch (error) {
      // Handle errors
      if (error instanceof VaultError) {
        throw error;
      }
      
      console.error(`Error renaming note: ${path} to ${newPath}`, error);
      throw new OperationFailedError('renameNote', path, error.message);
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
  ): Promise<FolderListResult> {
    try {
      // Normalize path
      const normalizedPath = this.normalizePath(path);
      
      // Set defaults
      const includeFiles = options.includeFiles !== false;
      const includeFolders = options.includeFolders !== false;
      const includeHidden = options.includeHidden === true;
      const recursive = options.recursive === true;
      
      // Get folder
      const folder = this.getFolderByPath(normalizedPath);
      if (!folder && normalizedPath !== '') {
        throw new FolderNotFoundError(normalizedPath);
      }
      
      // Prepare result arrays
      const files: string[] = [];
      const folders: string[] = [];
      
      // Function to process a folder and its children
      const processFolder = (folderObj: TFolder, currentPath: string) => {
        // Process folder children
        for (const child of folderObj.children) {
          // Skip hidden files/folders unless explicitly included
          if (!includeHidden && child.name.startsWith('.')) {
            continue;
          }
          
          if (child instanceof TFolder) {
            if (includeFolders) {
              folders.push(child.path);
            }
            
            // Process subfolders recursively if requested
            if (recursive) {
              processFolder(child, child.path);
            }
          } else if (child instanceof TFile && includeFiles) {
            files.push(child.path);
          }
        }
      };
      
      // Process the root folder or the specified folder
      if (normalizedPath === '') {
        // For the root folder, use vault.getRoot()
        const rootFolder = this.vault.getRoot();
        processFolder(rootFolder, '');
      } else if (folder) {
        // For non-root folders, process the specified folder
        processFolder(folder, normalizedPath);
      }
      
      // Trigger event
      this.events.trigger(VaultFacadeEventType.FOLDER_LISTED, { path: normalizedPath });
      
      return { files, folders, path: normalizedPath };
    } catch (error) {
      // Handle errors
      if (error instanceof VaultError) {
        throw error;
      }
      
      console.error(`Error listing folder: ${path}`, error);
      throw new OperationFailedError('listFolder', path, error.message);
    }
  }
  
  /**
   * Create a new folder
   * @param path - Path to the folder
   * @returns Promise resolving when folder is created
   */
  async createFolder(path: string): Promise<void> {
    try {
      // Normalize path
      const normalizedPath = this.normalizePath(path);
      
      // Check if folder already exists
      const existing = this.getFolderByPath(normalizedPath);
      if (existing) {
        return; // Folder already exists, nothing to do
      }
      
      try {
        // Create folder using Obsidian's Vault API
        await this.vault.createFolder(normalizedPath);
        
        // User feedback only when successfully creating a new folder
        new Notice(`Folder created: ${normalizedPath.split('/').pop()}`);
        
        // Trigger event
        this.events.trigger(VaultFacadeEventType.FOLDER_CREATED, { path: normalizedPath });
      } catch (createError) {
        // Check if error is because folder already exists
        if (createError.message && createError.message.includes("already exists")) {
          // This is not an error condition, the folder exists which is what we want
          console.log(`Folder already exists (race condition): ${normalizedPath}`);
          return;
        }
        throw createError; // Re-throw other errors
      }
    } catch (error) {
      console.error(`Error creating folder: ${path}`, error);
      new Notice(`Error creating folder: ${error.message}`);
      throw new OperationFailedError('createFolder', path, error.message);
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
      // Normalize path
      const normalizedPath = this.normalizePath(path);
      
      // Get folder
      const folder = this.getFolderByPath(normalizedPath);
      if (!folder) {
        throw new FolderNotFoundError(normalizedPath);
      }
      
      // Check if folder is empty or recursive is true
      if (!recursive && folder.children.length > 0) {
        throw new VaultError(`Folder is not empty, use recursive: true to delete anyway`);
      }
      
      // Use trashFolder method for better alignment with Obsidian's trash preferences
      if (folder.children.length === 0 || recursive) {
        await this.app.vault.trash(folder, true);
        
        // User feedback
        new Notice(`Folder moved to trash: ${normalizedPath.split('/').pop()}`);
      }
      
      // Trigger event
      this.events.trigger(VaultFacadeEventType.FOLDER_DELETED, { 
        path: normalizedPath, 
        recursive 
      });
    } catch (error) {
      // Handle errors
      if (error instanceof VaultError) {
        throw error;
      }
      
      console.error(`Error deleting folder: ${path}`, error);
      throw new OperationFailedError('deleteFolder', path, error.message);
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
      const searchFilenames = options.searchFilenames !== false;
      const searchContent = options.searchContent !== false;
      const searchFrontmatter = options.searchFrontmatter !== false;
      const searchTags = options.searchTags !== false;
      const paths = options.paths || [];
      
      // Create search results array
      const searchResults: SearchResult[] = [];
      
      // Get all markdown files
      const files = this.vault.getMarkdownFiles();
      
      // Filter by paths if specified
      const filteredFiles = paths.length > 0
        ? files.filter(file => paths.some(p => file.path.startsWith(this.normalizePath(p))))
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
        let matchType: SearchResult['matchType'] = undefined;
        
        // Check title match
        if (searchFilenames) {
          const title = file.basename;
          titleMatch = title.toLowerCase().includes(query.toLowerCase());
          if (titleMatch) {
            score += 100;
            matchType = 'title';
          }
        }
        
        // Check headings match
        const headings = metadata.headings || [];
        headingMatch = headings.some(h => 
          h.heading.toLowerCase().includes(query.toLowerCase())
        );
        if (headingMatch) {
          score += 50;
          matchType = matchType ? 'multiple' : 'heading';
        }
        
        // Check frontmatter match
        if (searchFrontmatter && metadata.frontmatter) {
          const frontmatterStr = JSON.stringify(metadata.frontmatter).toLowerCase();
          frontmatterMatch = frontmatterStr.includes(query.toLowerCase());
          if (frontmatterMatch) {
            score += 40;
            matchType = matchType ? 'multiple' : 'frontmatter';
          }
        }
        
        // Check tags match
        if (searchTags) {
          const tags = metadata.tags || [];
          tagsMatch = tags.some(tag => 
            tag.tag.toLowerCase().includes(query.toLowerCase())
          );
          if (tagsMatch) {
            score += 60;
            matchType = matchType ? 'multiple' : 'tags';
          }
        }
        
        // Create snippet and check content match if needed
        let snippet = '';
        let content = '';
        
        // Only read content if really needed
        if (includeContent || (searchContent && !titleMatch && !headingMatch && !frontmatterMatch && !tagsMatch)) {
          // Use more efficient cachedRead for better performance
          content = await this.vault.cachedRead(file);
          
          if (searchContent) {
            contentMatch = content.toLowerCase().includes(query.toLowerCase());
            if (contentMatch) {
              score += 10;
              matchType = matchType ? 'multiple' : 'content';
            }
          }
          
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
              snippet = file.basename;
            } else if (headingMatch) {
              snippet = headings.find(h => 
                h.heading.toLowerCase().includes(query.toLowerCase())
              )?.heading || '';
            } else if (tagsMatch && metadata.tags) {
              snippet = metadata.tags.map((t: { tag: string }) => t.tag).join(', ');
            } else if (frontmatterMatch) {
              snippet = 'Matched in frontmatter metadata';
            }
          }
          
          // Add to results
          searchResults.push({
            path: file.path,
            score,
            snippet,
            content: includeContent ? content : undefined,
            matchType
          });
        }
      }
      
      // Sort by score and limit results
      searchResults.sort((a, b) => b.score - a.score);
      const limitedResults = searchResults.slice(0, limit);
      
      // Trigger event
      this.events.trigger(VaultFacadeEventType.CONTENT_SEARCHED, { query });
      
      return limitedResults;
    } catch (error) {
      console.error(`Error searching content: ${query}`, error);
      throw new OperationFailedError('searchContent', '', error.message);
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
      
      // Manual implementation since getFilesByTag might not be available
      const allFiles = this.vault.getMarkdownFiles();
      const matchingFiles: TFile[] = [];
      
      for (const file of allFiles) {
        const cache = this.metadataCache.getFileCache(file);
        if (cache && cache.tags) {
          const hasTag = cache.tags.some((t: { tag: string }) => 
            t.tag.toLowerCase() === normalizedTag.toLowerCase() || 
            t.tag.toLowerCase() === `#${normalizedTag.toLowerCase()}`
          );
          
          if (hasTag) {
            matchingFiles.push(file);
          }
        }
      }
      
      // Trigger event
      this.events.trigger(VaultFacadeEventType.TAG_SEARCHED, { tag });
      
      return matchingFiles.map((file: TFile) => file.path);
    } catch (error) {
      console.error(`Error searching by tag: ${tag}`, error);
      throw new OperationFailedError('searchByTag', '', error.message);
    }
  }
  
  /**
   * Update frontmatter of a note
   * @param path - Path to the note
   * @param updateFn - Function to update frontmatter
   * @returns Promise resolving when frontmatter is updated
   */
  async updateFrontmatter(path: string, updateFn: (frontmatter: Record<string, any>) => void): Promise<void> {
    try {
      // Normalize path
      const normalizedPath = this.normalizePath(path);
      
      // Get file
      const file = this.getFileByPath(normalizedPath);
      if (!file) {
        throw new FileNotFoundError(normalizedPath);
      }
      
      // Use Obsidian's atomic frontmatter processing
      await this.app.fileManager.processFrontMatter(file, updateFn);
      
      // Trigger event
      this.events.trigger(VaultFacadeEventType.FRONTMATTER_UPDATED, { path: normalizedPath });
    } catch (error) {
      console.error(`Error updating frontmatter: ${path}`, error);
      throw new OperationFailedError('updateFrontmatter', path, error.message);
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
      // Normalize path
      const normalizedSourcePath = this.normalizePath(sourcePath);
      
      // Use Obsidian's built-in path resolution
      const attachmentPath = this.app.fileManager.getAvailablePathForAttachment(filename, normalizedSourcePath);
      
      return attachmentPath;
    } catch (error) {
      console.error(`Error getting attachment path: ${filename}`, error);
      throw new OperationFailedError('getAttachmentPath', filename, error.message);
    }
  }
  
  /**
   * Check if a file exists
   * @param path - Path to check
   * @returns Promise resolving to true if file exists, false otherwise
   */
  async fileExists(path: string): Promise<boolean> {
    try {
      // Normalize path
      const normalizedPath = this.normalizePath(path);
      
      // Check if file exists
      const file = this.getFileByPath(normalizedPath);
      
      return !!file;
    } catch (error) {
      console.error(`Error checking if file exists: ${path}`, error);
      throw new OperationFailedError('fileExists', path, error.message);
    }
  }
  
  /**
   * Check if a folder exists
   * @param path - Path to check
   * @returns Promise resolving to true if folder exists, false otherwise
   */
  async folderExists(path: string): Promise<boolean> {
    try {
      // Normalize path
      const normalizedPath = this.normalizePath(path);
      
      // Check if folder exists
      const folder = this.getFolderByPath(normalizedPath);
      
      return !!folder;
    } catch (error) {
      console.error(`Error checking if folder exists: ${path}`, error);
      throw new OperationFailedError('folderExists', path, error.message);
    }
  }
  
  /**
   * Get the parent folder of a path
   * @param path - Path to get parent folder of
   * @returns Parent folder path
   */
  getParentFolder(path: string): string {
    // Handle empty path or root path
    if (!path || path === '/') {
      return '';
    }
    
    // Normalize path
    const normalizedPath = this.normalizePath(path);
    
    // Get parent folder
    const lastSlashIndex = normalizedPath.lastIndexOf('/');
    
    // If no slash, return empty string (root folder)
    if (lastSlashIndex === -1) {
      return '';
    }
    
    // Return parent folder path
    return normalizedPath.substring(0, lastSlashIndex);
  }
  
  /**
   * Normalize a path (remove leading/trailing slashes, handle relative paths)
   * @param path - Path to normalize
   * @returns Normalized path
   */
  normalizePath(path: string): string {
    // Simple normalization
    // Remove leading and trailing slashes
    let normalizedPath = path.trim();
    
    // Replace backslashes with forward slashes
    normalizedPath = normalizedPath.replace(/\\/g, '/');
    
    // Remove leading slash
    if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.substring(1);
    }
    
    // Remove trailing slash
    if (normalizedPath.endsWith('/') && normalizedPath.length > 1) {
      normalizedPath = normalizedPath.substring(0, normalizedPath.length - 1);
    }
    
    return normalizedPath;
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
    // Handle root folder
    if (path === '') {
      return this.app.vault.getRoot();
    }
    
    // Use Vault's optimized methods for getting folders by path
    return this.app.vault.getFolderByPath(path);
  }
}
