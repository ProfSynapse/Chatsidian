/**
 * MockVaultFacade.ts
 * 
 * This file provides a mock implementation of the VaultFacade interface for testing.
 * It simulates Obsidian's vault operations using in-memory storage, allowing for
 * unit testing without requiring an actual Obsidian instance.
 * 
 * Related files:
 * - VaultErrors.ts: Custom error types for vault operations
 * - VaultFacadeInterface.ts: Interface definitions for VaultFacade
 * - VaultFacade.ts: Real implementation of the VaultFacade interface
 */

import { Events } from 'obsidian';
import {
  IVaultFacade,
  ListFolderOptions,
  SearchOptions,
  SearchResult,
  NoteReadResult,
  NoteOperationResult,
  FolderListResult,
  VaultFacadeEventType
} from '../core/VaultFacadeInterface';
import {
  VaultError,
  FileNotFoundError,
  FolderNotFoundError,
  FileExistsError,
  InvalidPathError,
  OperationFailedError
} from '../core/VaultErrors';

/**
 * MockVaultFacade provides an in-memory implementation of the VaultFacade interface for testing
 */
export class MockVaultFacade extends Events implements IVaultFacade {
  private files: Map<string, string> = new Map();
  private frontmatter: Map<string, Record<string, any>> = new Map();
  private folders: Set<string> = new Set();
  
  /**
   * Create a new MockVaultFacade
   */
  constructor() {
    super();
    // Add root folder
    this.folders.add('');
  }
  
  /**
   * Read a note by path
   * @param path - Path to the note
   * @returns Promise resolving to note content and path
   * @throws FileNotFoundError if file doesn't exist
   */
  async readNote(path: string): Promise<NoteReadResult> {
    try {
      const normalizedPath = this.normalizePath(path);
      
      if (!this.files.has(normalizedPath)) {
        throw new FileNotFoundError(normalizedPath);
      }
      
      const content = this.files.get(normalizedPath) || '';
      const frontmatter = this.frontmatter.get(normalizedPath);
      
      this.trigger(VaultFacadeEventType.NOTE_READ, { path: normalizedPath });
      
      return { content, path: normalizedPath, frontmatter };
    } catch (error) {
      if (error instanceof VaultError) {
        throw error;
      }
      
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
      const normalizedPath = this.normalizePath(path);
      
      if (this.files.has(normalizedPath) && !overwrite) {
        throw new FileExistsError(normalizedPath);
      }
      
      // Ensure parent folder exists
      const folderPath = this.getParentFolder(normalizedPath);
      if (folderPath && !this.folders.has(folderPath)) {
        await this.createFolder(folderPath);
      }
      
      this.files.set(normalizedPath, content);
      
      // Extract frontmatter if present
      this.extractFrontmatter(normalizedPath, content);
      
      this.trigger(VaultFacadeEventType.NOTE_CREATED, { 
        path: normalizedPath, 
        overwrite 
      });
      
      return { path: normalizedPath };
    } catch (error) {
      if (error instanceof VaultError) {
        throw error;
      }
      
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
      const normalizedPath = this.normalizePath(path);
      
      if (!this.files.has(normalizedPath)) {
        throw new FileNotFoundError(normalizedPath);
      }
      
      this.files.set(normalizedPath, content);
      
      // Extract frontmatter if present
      this.extractFrontmatter(normalizedPath, content);
      
      this.trigger(VaultFacadeEventType.NOTE_UPDATED, { path: normalizedPath });
      
      return { path: normalizedPath };
    } catch (error) {
      if (error instanceof VaultError) {
        throw error;
      }
      
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
      const normalizedPath = this.normalizePath(path);
      
      if (!this.files.has(normalizedPath)) {
        throw new FileNotFoundError(normalizedPath);
      }
      
      this.files.delete(normalizedPath);
      this.frontmatter.delete(normalizedPath);
      
      this.trigger(VaultFacadeEventType.NOTE_DELETED, { path: normalizedPath });
    } catch (error) {
      if (error instanceof VaultError) {
        throw error;
      }
      
      throw new OperationFailedError('deleteNote', path, error.message);
    }
  }
  
  /**
   * Rename or move a note
   * @param path - Current path
   * @param newPath - New path
   * @returns Promise resolving to new path
   * @throws FileNotFoundError if file doesn't exist
   * @throws FileExistsError if destination file exists
   */
  async renameNote(path: string, newPath: string): Promise<NoteOperationResult> {
    try {
      const normalizedPath = this.normalizePath(path);
      const normalizedNewPath = this.normalizePath(newPath);
      
      if (!this.files.has(normalizedPath)) {
        throw new FileNotFoundError(normalizedPath);
      }
      
      if (this.files.has(normalizedNewPath)) {
        throw new FileExistsError(normalizedNewPath);
      }
      
      // Ensure parent folder exists
      const folderPath = this.getParentFolder(normalizedNewPath);
      if (folderPath && !this.folders.has(folderPath)) {
        await this.createFolder(folderPath);
      }
      
      // Move file
      const content = this.files.get(normalizedPath) || '';
      this.files.set(normalizedNewPath, content);
      this.files.delete(normalizedPath);
      
      // Move frontmatter if it exists
      if (this.frontmatter.has(normalizedPath)) {
        this.frontmatter.set(normalizedNewPath, this.frontmatter.get(normalizedPath) || {});
        this.frontmatter.delete(normalizedPath);
      }
      
      this.trigger(VaultFacadeEventType.NOTE_RENAMED, { 
        oldPath: normalizedPath, 
        newPath: normalizedNewPath 
      });
      
      return { path: normalizedNewPath };
    } catch (error) {
      if (error instanceof VaultError) {
        throw error;
      }
      
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
      const normalizedPath = this.normalizePath(path);
      
      if (!this.folders.has(normalizedPath)) {
        throw new FolderNotFoundError(normalizedPath);
      }
      
      const includeFiles = options.includeFiles !== false;
      const includeFolders = options.includeFolders !== false;
      const includeHidden = options.includeHidden === true;
      const recursive = options.recursive === true;
      
      const files: string[] = [];
      const folders: string[] = [];
      
      // Helper function to check if a path is a direct child of a folder
      const isDirectChild = (childPath: string, parentPath: string): boolean => {
        if (parentPath === '') {
          // Root folder
          return !childPath.includes('/');
        }
        
        const childParts = childPath.split('/');
        const parentParts = parentPath.split('/');
        
        return childParts.length === parentParts.length + 1 && 
               childPath.startsWith(parentPath + '/');
      };
      
      // Helper function to check if a path is a descendant of a folder
      const isDescendant = (childPath: string, parentPath: string): boolean => {
        if (parentPath === '') {
          // Root folder
          return true;
        }
        
        return childPath.startsWith(parentPath + '/');
      };
      
      // Process files
      if (includeFiles) {
        for (const filePath of this.files.keys()) {
          const fileName = filePath.split('/').pop() || '';
          
          // Skip hidden files
          if (!includeHidden && fileName.startsWith('.')) {
            continue;
          }
          
          if (recursive) {
            if (isDescendant(filePath, normalizedPath)) {
              files.push(filePath);
            }
          } else {
            if (isDirectChild(filePath, normalizedPath)) {
              files.push(filePath);
            }
          }
        }
      }
      
      // Process folders
      if (includeFolders) {
        for (const folderPath of this.folders) {
          if (folderPath === normalizedPath) {
            continue; // Skip current folder
          }
          
          const folderName = folderPath.split('/').pop() || '';
          
          // Skip hidden folders
          if (!includeHidden && folderName.startsWith('.')) {
            continue;
          }
          
          if (recursive) {
            if (isDescendant(folderPath, normalizedPath)) {
              folders.push(folderPath);
            }
          } else {
            if (isDirectChild(folderPath, normalizedPath)) {
              folders.push(folderPath);
            }
          }
        }
      }
      
      this.trigger(VaultFacadeEventType.FOLDER_LISTED, { path: normalizedPath });
      
      return { files, folders, path: normalizedPath };
    } catch (error) {
      if (error instanceof VaultError) {
        throw error;
      }
      
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
      const normalizedPath = this.normalizePath(path);
      
      if (this.folders.has(normalizedPath)) {
        return; // Folder already exists
      }
      
      // Ensure parent folders exist
      const parentPath = this.getParentFolder(normalizedPath);
      if (parentPath && !this.folders.has(parentPath)) {
        await this.createFolder(parentPath);
      }
      
      this.folders.add(normalizedPath);
      
      this.trigger(VaultFacadeEventType.FOLDER_CREATED, { path: normalizedPath });
    } catch (error) {
      if (error instanceof VaultError) {
        throw error;
      }
      
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
      const normalizedPath = this.normalizePath(path);
      
      if (!this.folders.has(normalizedPath)) {
        throw new FolderNotFoundError(normalizedPath);
      }
      
      // Check if folder has children without triggering an event
      const files: string[] = [];
      const folders: string[] = [];
      
      // Find all files and folders in this directory
      for (const filePath of this.files.keys()) {
        if (filePath.startsWith(normalizedPath + '/')) {
          files.push(filePath);
        }
      }
      
      for (const folderPath of this.folders) {
        if (folderPath !== normalizedPath && folderPath.startsWith(normalizedPath + '/')) {
          folders.push(folderPath);
        }
      }
      
      if ((files.length > 0 || folders.length > 0) && !recursive) {
        throw new VaultError(`Folder is not empty, use recursive: true to delete anyway`);
      }
      
      // Delete children recursively
      if (recursive) {
        // Delete all files in this folder and subfolders
        for (const file of files) {
          this.files.delete(file);
          this.frontmatter.delete(file);
        }
        
        // Delete subfolders in reverse order (deepest first)
        const sortedFolders = folders.sort((a, b) => b.split('/').length - a.split('/').length);
        for (const folder of sortedFolders) {
          this.folders.delete(folder);
        }
      }
      
      this.folders.delete(normalizedPath);
      
      this.trigger(VaultFacadeEventType.FOLDER_DELETED, { 
        path: normalizedPath, 
        recursive 
      });
    } catch (error) {
      if (error instanceof VaultError) {
        throw error;
      }
      
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
      const includeContent = options.includeContent === true;
      const limit = options.limit || 20;
      const searchFilenames = options.searchFilenames !== false;
      const searchContent = options.searchContent !== false;
      const searchFrontmatter = options.searchFrontmatter !== false;
      const searchTags = options.searchTags !== false;
      const paths = options.paths || [];
      
      const results: SearchResult[] = [];
      const lowerQuery = query.toLowerCase();
      
      // Filter files by path if specified
      const filesToSearch = paths.length > 0
        ? Array.from(this.files.keys()).filter(path => 
            paths.some(p => path.startsWith(this.normalizePath(p)))
          )
        : Array.from(this.files.keys());
      
      for (const path of filesToSearch) {
        let score = 0;
        let matchType: SearchResult['matchType'] = undefined;
        let snippet = '';
        
        // Check filename match
        if (searchFilenames) {
          const filename = path.split('/').pop() || '';
          if (filename.toLowerCase().includes(lowerQuery)) {
            score += 100;
            matchType = 'title';
            snippet = filename;
          }
        }
        
        // Check content match
        const content = this.files.get(path) || '';
        if (searchContent && content.toLowerCase().includes(lowerQuery)) {
          score += 10;
          matchType = matchType ? 'multiple' : 'content';
          
          // Create snippet
          const index = content.toLowerCase().indexOf(lowerQuery);
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
        
        // Check frontmatter match
        if (searchFrontmatter && this.frontmatter.has(path)) {
          const frontmatter = this.frontmatter.get(path);
          const frontmatterStr = JSON.stringify(frontmatter).toLowerCase();
          if (frontmatterStr.includes(lowerQuery)) {
            score += 40;
            matchType = matchType ? 'multiple' : 'frontmatter';
            if (!snippet) {
              snippet = 'Matched in frontmatter metadata';
            }
          }
        }
        
        // Check tags match (simplified)
        if (searchTags && this.frontmatter.has(path)) {
          const frontmatter = this.frontmatter.get(path);
          const tags = frontmatter?.tags || [];
          if (Array.isArray(tags) && tags.some(tag => 
            tag.toLowerCase().includes(lowerQuery) || 
            `#${tag}`.toLowerCase().includes(lowerQuery)
          )) {
            score += 60;
            matchType = matchType ? 'multiple' : 'tags';
            if (!snippet) {
              snippet = `Tags: ${tags.join(', ')}`;
            }
          }
        }
        
        // Add to results if there's a match
        if (score > 0) {
          results.push({
            path,
            score,
            snippet,
            content: includeContent ? content : undefined,
            matchType
          });
        }
      }
      
      // Sort by score and limit results
      results.sort((a, b) => b.score - a.score);
      const limitedResults = results.slice(0, limit);
      
      this.trigger(VaultFacadeEventType.CONTENT_SEARCHED, { query });
      
      return limitedResults;
    } catch (error) {
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
      const normalizedTag = tag.startsWith('#') ? tag.substring(1) : tag;
      const lowerTag = normalizedTag.toLowerCase();
      
      const results: string[] = [];
      
      // Search through frontmatter for tags
      for (const [path, frontmatter] of this.frontmatter.entries()) {
        const tags = frontmatter?.tags || [];
        
        if (Array.isArray(tags) && tags.some(t => 
          t.toLowerCase() === lowerTag || 
          `#${t}`.toLowerCase() === `#${lowerTag}`
        )) {
          results.push(path);
        }
      }
      
      this.trigger(VaultFacadeEventType.TAG_SEARCHED, { tag });
      
      return results;
    } catch (error) {
      throw new OperationFailedError('searchByTag', '', error.message);
    }
  }
  
  /**
   * Update frontmatter of a note
   * @param path - Path to the note
   * @param updateFn - Function to update frontmatter
   * @returns Promise resolving when frontmatter is updated
   * @throws FileNotFoundError if file doesn't exist
   */
  async updateFrontmatter(path: string, updateFn: (frontmatter: Record<string, any>) => void): Promise<void> {
    try {
      const normalizedPath = this.normalizePath(path);
      
      if (!this.files.has(normalizedPath)) {
        throw new FileNotFoundError(normalizedPath);
      }
      
      // Initialize frontmatter if it doesn't exist
      if (!this.frontmatter.has(normalizedPath)) {
        this.frontmatter.set(normalizedPath, {});
      }
      
      // Get frontmatter and apply update
      const frontmatter = this.frontmatter.get(normalizedPath) || {};
      updateFn(frontmatter);
      
      // Update frontmatter
      this.frontmatter.set(normalizedPath, frontmatter);
      
      // Update file content with new frontmatter
      this.updateFileWithFrontmatter(normalizedPath);
      
      this.trigger(VaultFacadeEventType.FRONTMATTER_UPDATED, { path: normalizedPath });
    } catch (error) {
      if (error instanceof VaultError) {
        throw error;
      }
      
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
      const normalizedSourcePath = this.normalizePath(sourcePath);
      
      // Create attachments folder if it doesn't exist
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
    } catch (error) {
      throw new OperationFailedError('getAttachmentPath', filename, error.message);
    }
  }
  
  /**
   * Check if a file exists
   * @param path - Path to check
   * @returns Promise resolving to true if file exists, false otherwise
   */
  async fileExists(path: string): Promise<boolean> {
    const normalizedPath = this.normalizePath(path);
    return this.files.has(normalizedPath);
  }
  
  /**
   * Check if a folder exists
   * @param path - Path to check
   * @returns Promise resolving to true if folder exists, false otherwise
   */
  async folderExists(path: string): Promise<boolean> {
    const normalizedPath = this.normalizePath(path);
    return this.folders.has(normalizedPath);
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
    
    const normalizedPath = this.normalizePath(path);
    const lastSlashIndex = normalizedPath.lastIndexOf('/');
    
    // If no slash, return empty string (root folder)
    if (lastSlashIndex === -1) {
      return '';
    }
    
    return normalizedPath.substring(0, lastSlashIndex);
  }
  
  /**
   * Normalize a path (remove leading/trailing slashes, handle relative paths)
   * @param path - Path to normalize
   * @returns Normalized path
   */
  normalizePath(path: string): string {
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
  
  /**
   * Extract frontmatter from file content
   * @param path - Path to the file
   * @param content - File content
   */
  private extractFrontmatter(path: string, content: string): void {
    // Simple frontmatter extraction (YAML between --- markers)
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
    const match = content.match(frontmatterRegex);
    
    if (match && match[1]) {
      try {
        // Simple YAML parsing (for testing purposes only)
        const frontmatter: Record<string, any> = {};
        const lines = match[1].split('\n');
        
        for (const line of lines) {
          const colonIndex = line.indexOf(':');
          if (colonIndex !== -1) {
            const key = line.substring(0, colonIndex).trim();
            let value = line.substring(colonIndex + 1).trim();
            
            // Handle arrays (simple implementation)
            if (value.startsWith('[') && value.endsWith(']')) {
              value = value.substring(1, value.length - 1);
              frontmatter[key] = value.split(',').map(v => v.trim());
            } else {
              // Handle strings, numbers, booleans
              if (value === 'true') {
                frontmatter[key] = true;
              } else if (value === 'false') {
                frontmatter[key] = false;
              } else if (!isNaN(Number(value))) {
                frontmatter[key] = Number(value);
              } else {
                frontmatter[key] = value;
              }
            }
          }
        }
        
        this.frontmatter.set(path, frontmatter);
      } catch (error) {
        console.error(`Error parsing frontmatter for ${path}:`, error);
      }
    }
  }
  
  /**
   * Update file content with frontmatter
   * @param path - Path to the file
   */
  private updateFileWithFrontmatter(path: string): void {
    if (!this.files.has(path) || !this.frontmatter.has(path)) {
      return;
    }
    
    const content = this.files.get(path) || '';
    const frontmatter = this.frontmatter.get(path) || {};
    
    // Convert frontmatter to YAML
    let yamlFrontmatter = '---\n';
    for (const [key, value] of Object.entries(frontmatter)) {
      if (Array.isArray(value)) {
        yamlFrontmatter += `${key}: [${value.join(', ')}]\n`;
      } else {
        yamlFrontmatter += `${key}: ${value}\n`;
      }
    }
    yamlFrontmatter += '---\n\n';
    
    // Replace existing frontmatter or add new frontmatter
    const frontmatterRegex = /^---\s*\n[\s\S]*?\n---\s*\n/;
    if (frontmatterRegex.test(content)) {
      this.files.set(path, content.replace(frontmatterRegex, yamlFrontmatter));
    } else {
      this.files.set(path, yamlFrontmatter + content);
    }
  }
}
