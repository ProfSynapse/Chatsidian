---
title: Phase 2.5 - Initial BCPs Implementation
description: Implementation plan for the core Bounded Context Packs (BCPs) in Chatsidian
date: 2025-05-03
status: implementation
tags:
  - implementation
  - phase-2
  - bcps
  - tools
  - vault-operations
---

# Phase 2.5: Initial BCPs Implementation

## Overview

This micro-phase focuses on implementing the core Bounded Context Packs (BCPs) for Chatsidian. These BCPs will provide the fundamental tools that AI assistants can use to interact with the Obsidian vault through the Model Context Protocol (MCP). Each BCP is designed around a specific domain of functionality, providing a clear separation of concerns and facilitating modular development.

## Goals

- Implement the NoteManager BCP for note operations
- Implement the FolderManager BCP for folder operations
- Implement the VaultLibrarian BCP for search and query capabilities
- Implement the PaletteCommander BCP for command palette access
- Ensure all BCPs leverage the enhanced VaultFacade capabilities
- Create comprehensive tool documentation for AI context

## Implementation Steps


### 1. Create BCP Factory Pattern

First, let's define a common pattern for creating BCPs:

```typescript
/**
 * Context provided to BCP factories
 */
export interface BCPContext {
  /**
   * VaultFacade for vault operations
   */
  vaultFacade: EnhancedVaultFacade;
  
  /**
   * EventBus for event communication
   */
  eventBus: EventBus;
  
  /**
   * SettingsManager for accessing plugin settings
   */
  settings: SettingsManager;
}

/**
 * Factory function for creating BCPs
 */
export type BCPFactory = (context: BCPContext) => BoundedContextPack;

/**
 * Register a BCP factory with the registry
 * @param registry - BCP registry
 * @param factory - BCP factory function
 * @param context - BCP context
 */
export function registerBCP(
  registry: BCPRegistry,
  factory: BCPFactory,
  context: BCPContext
): void {
  // Create BCP using factory
  const bcp = factory(context);
  
  // Register BCP with registry
  registry.registerPack(bcp);
}
```

### 2. Create SchemaBuilder Utilities

Before implementing the BCPs, let's create a utility class for building JSON Schema definitions for tools:

```typescript
/**
 * Utility for building JSON Schema definitions
 */
export class SchemaBuilder {
  private schema: any = {
    type: 'object',
    properties: {},
    required: []
  };
  
  /**
   * Add a string property
   * @param name - Property name
   * @param description - Property description
   * @param required - Whether the property is required
   * @param options - Additional options
   * @returns The builder instance for chaining
   */
  public addString(
    name: string, 
    description: string, 
    required: boolean = false,
    options: {
      minLength?: number;
      maxLength?: number;
      pattern?: string;
      enum?: string[];
      format?: string;
    } = {}
  ): SchemaBuilder {
    // Add property
    this.schema.properties[name] = {
      type: 'string',
      description
    };
    
    // Add options
    if (options.minLength !== undefined) {
      this.schema.properties[name].minLength = options.minLength;
    }
    
    if (options.maxLength !== undefined) {
      this.schema.properties[name].maxLength = options.maxLength;
    }
    
    if (options.pattern !== undefined) {
      this.schema.properties[name].pattern = options.pattern;
    }
    
    if (options.enum !== undefined) {
      this.schema.properties[name].enum = options.enum;
    }
    
    if (options.format !== undefined) {
      this.schema.properties[name].format = options.format;
    }
    
    // Add to required if needed
    if (required) {
      this.schema.required.push(name);
    }
    
    return this;
  }
  
  /**
   * Add a boolean property
   * @param name - Property name
   * @param description - Property description
   * @param required - Whether the property is required
   * @returns The builder instance for chaining
   */
  public addBoolean(
    name: string, 
    description: string, 
    required: boolean = false
  ): SchemaBuilder {
    // Add property
    this.schema.properties[name] = {
      type: 'boolean',
      description
    };
    
    // Add to required if needed
    if (required) {
      this.schema.required.push(name);
    }
    
    return this;
  }
  
  /**
   * Add other property types and utility methods
   * (omitted for brevity)
   */
  
  /**
   * Build the schema
   * @returns The complete JSON Schema
   */
  public build(): any {
    // If no required properties, remove the required array
    if (this.schema.required.length === 0) {
      delete this.schema.required;
    }
    
    return this.schema;
  }
}
```


### 3. Implement NoteManager BCP

The NoteManager BCP provides tools for reading, creating, updating, and deleting notes in the vault:

```typescript
/**
 * Create the NoteManager BCP
 * @param context - BCP context
 * @returns BoundedContextPack
 */
export function createNoteManagerBCP(context: BCPContext): BoundedContextPack {
  const { vaultFacade, eventBus } = context;
  
  return {
    domain: 'NoteManager',
    description: 'Tools for managing notes in the vault',
    tools: [
      {
        name: 'read',
        description: 'Read a note from the vault',
        handler: async (params: { path: string }) => {
          // Use Obsidian's native Vault.read method through our facade
          const file = vaultFacade.app.vault.getAbstractFileByPath(params.path);
          if (!file || !(file instanceof vaultFacade.app.vault.constructor.TFile)) {
            throw new Error(`File not found: ${params.path}`);
          }
          
          const content = await vaultFacade.app.vault.read(file);
          
          // Return enhanced information about the file
          return {
            content,
            path: file.path,
            name: file.name,
            basename: file.basename,
            extension: file.extension,
            stat: {
              ctime: file.stat.ctime,
              mtime: file.stat.mtime,
              size: file.stat.size
            }
          };
        },
        schema: new SchemaBuilder()
          .addString('path', 'Path to the note', true)
          .build()
      },
      
      {
        name: 'create',
        description: 'Create a new note in the vault',
        handler: async (params: { 
          path: string; 
          content: string; 
          options?: {
            mtime?: number,
            ctime?: number
          }
        }) => {
          try {
            // Use Obsidian's native Vault.create method directly
            const file = await vaultFacade.app.vault.create(
              params.path,
              params.content,
              params.options
            );
            
            // Return rich file information
            return {
              path: file.path,
              name: file.name,
              basename: file.basename,
              extension: file.extension,
              stat: {
                ctime: file.stat.ctime,
                mtime: file.stat.mtime
              }
            };
          } catch (error) {
            // Handle Obsidian's specific error pattern for existing files
            if (error.message && error.message.includes('already exists')) {
              throw new Error(`File already exists: ${params.path}`);
            }
            throw error;
          }
        },
        schema: new SchemaBuilder()
          .addString('path', 'Path where the note should be created', true)
          .addString('content', 'Content of the note', true)
          .addObject('options', 'Creation options (optional)', false, {
            properties: {
              mtime: { type: 'number', description: 'Modified time' },
              ctime: { type: 'number', description: 'Created time' }
            }
          })
          .build()
      },
      
      {
        name: 'modify',
        description: 'Update an existing note in the vault',
        handler: async (params: { path: string; content: string }) => {
          // Get the file using Obsidian's native method
          const file = vaultFacade.app.vault.getAbstractFileByPath(params.path);
          if (!file || !(file instanceof vaultFacade.app.vault.constructor.TFile)) {
            throw new Error(`File not found: ${params.path}`);
          }
          
          // Use Obsidian's native Vault.modify method
          await vaultFacade.app.vault.modify(file, params.content);
          
          // Return enhanced file information
          return {
            path: file.path,
            name: file.name,
            basename: file.basename,
            extension: file.extension,
            stat: {
              ctime: file.stat.ctime,
              mtime: file.stat.mtime,
              size: file.stat.size
            }
          };
        },
        schema: new SchemaBuilder()
          .addString('path', 'Path to the note', true)
          .addString('content', 'New content of the note', true)
          .build()
      },
      
      {
        name: 'delete',
        description: 'Delete a note from the vault',
        handler: async (params: { path: string; useTrash?: boolean }) => {
          // Get the file using Obsidian's native method
          const file = vaultFacade.app.vault.getAbstractFileByPath(params.path);
          if (!file || !(file instanceof vaultFacade.app.vault.constructor.TFile)) {
            throw new Error(`File not found: ${params.path}`);
          }
          
          // Use Obsidian's native Vault.delete or trash method based on preference
          if (params.useTrash !== false) {
            // Default behavior: move to trash
            await vaultFacade.app.vault.trash(file, false);
          } else {
            // Permanent deletion when explicitly requested
            await vaultFacade.app.vault.delete(file);
          }
          
          return { 
            success: true, 
            path: params.path,
            deletionType: params.useTrash !== false ? 'trashed' : 'permanent'
          };
        },
        schema: new SchemaBuilder()
          .addString('path', 'Path to the note to delete', true)
          .addBoolean('useTrash', 'Whether to move the file to trash (default: true)')
          .build()
      },
      
      {
        name: 'appendToNote',
        description: 'Append content to an existing note',
        handler: async (params: { path: string; content: string }) => {
          // Read existing content
          const { content: existingContent } = await vaultFacade.readNote(params.path);
          
          // Append new content
          const newContent = existingContent + '\n' + params.content;
          
          // Update note
          return await vaultFacade.updateNote(params.path, newContent);
        },
        schema: new SchemaBuilder()
          .addString('path', 'Path to the note', true)
          .addString('content', 'Content to append', true)
          .build()
      },
      
      {
        name: 'prependToNote',
        description: 'Prepend content to an existing note',
        handler: async (params: { path: string; content: string }) => {
          // Read existing content
          const { content: existingContent } = await vaultFacade.readNote(params.path);
          
          // Prepend new content
          const newContent = params.content + '\n' + existingContent;
          
          // Update note
          return await vaultFacade.updateNote(params.path, newContent);
        },
        schema: new SchemaBuilder()
          .addString('path', 'Path to the note', true)
          .addString('content', 'Content to prepend', true)
          .build()
      },
      
      {
        name: 'replaceInNote',
        description: 'Replace text in a note',
        handler: async (params: { 
          path: string; 
          search: string; 
          replace: string;
          replaceAll?: boolean
        }) => {
          // Read existing content
          const { content } = await vaultFacade.readNote(params.path);
          
          // Replace text
          let newContent: string;
          
          if (params.replaceAll) {
            // Global replacement
            newContent = content.split(params.search).join(params.replace);
          } else {
            // Single replacement
            newContent = content.replace(params.search, params.replace);
          }
          
          // Update note
          return await vaultFacade.updateNote(params.path, newContent);
        },
        schema: new SchemaBuilder()
          .addString('path', 'Path to the note', true)
          .addString('search', 'Text to search for', true)
          .addString('replace', 'Text to replace with', true)
          .addBoolean('replaceAll', 'Whether to replace all occurrences (default: false)')
          .build()
      },
      
      {
        name: 'readLines',
        description: 'Read specific lines from a note',
        handler: async (params: { 
          path: string; 
          startLine: number; 
          endLine?: number 
        }) => {
          // Read note
          const { content } = await vaultFacade.readNote(params.path);
          
          // Split into lines
          const lines = content.split('\n');
          
          // Validate line numbers
          const start = Math.max(0, params.startLine - 1); // Convert to 0-based
          const end = params.endLine ? Math.min(lines.length, params.endLine) : start + 1;
          
          // Extract lines
          const selectedLines = lines.slice(start, end);
          
          return {
            path: params.path,
            lines: selectedLines,
            startLine: params.startLine,
            endLine: params.endLine || params.startLine,
            content: selectedLines.join('\n')
          };
        },
        schema: new SchemaBuilder()
          .addString('path', 'Path to the note', true)
          .addNumber('startLine', 'Start line (1-based)', true, { minimum: 1 })
          .addNumber('endLine', 'End line (1-based, inclusive)', false, { minimum: 1 })
          .build()
      },
      
      {
        name: 'insertAtLine',
        description: 'Insert content at a specific line in a note',
        handler: async (params: { 
          path: string; 
          line: number; 
          content: string 
        }) => {
          // Read note
          const { content } = await vaultFacade.readNote(params.path);
          
          // Split into lines
          const lines = content.split('\n');
          
          // Validate line number
          const lineIndex = Math.min(lines.length, Math.max(0, params.line - 1)); // Convert to 0-based
          
          // Insert content
          lines.splice(lineIndex, 0, params.content);
          
          // Join lines
          const newContent = lines.join('\n');
          
          // Update note
          return await vaultFacade.updateNote(params.path, newContent);
        },
        schema: new SchemaBuilder()
          .addString('path', 'Path to the note', true)
          .addNumber('line', 'Line number to insert at (1-based)', true, { minimum: 1 })
          .addString('content', 'Content to insert', true)
          .build()
      },
      
      {
        name: 'deleteLines',
        description: 'Delete specific lines from a note',
        handler: async (params: { 
          path: string; 
          startLine: number; 
          endLine?: number 
        }) => {
          // Read note
          const { content } = await vaultFacade.readNote(params.path);
          
          // Split into lines
          const lines = content.split('\n');
          
          // Validate line numbers
          const start = Math.max(0, params.startLine - 1); // Convert to 0-based
          const end = params.endLine ? Math.min(lines.length, params.endLine) : start + 1;
          
          // Delete lines
          lines.splice(start, end - start);
          
          // Join lines
          const newContent = lines.join('\n');
          
          // Update note
          return await vaultFacade.updateNote(params.path, newContent);
        },
        schema: new SchemaBuilder()
          .addString('path', 'Path to the note', true)
          .addNumber('startLine', 'Start line (1-based)', true, { minimum: 1 })
          .addNumber('endLine', 'End line (1-based, inclusive)', false, { minimum: 1 })
          .build()
      },
      
      {
        name: 'createBinary',
        description: 'Create a new binary file in the vault',
        handler: async (params: { 
          path: string; 
          data: ArrayBuffer;
          options?: {
            mtime?: number;
            ctime?: number;
          }
        }) => {
          try {
            // Use Obsidian's native Vault.createBinary method directly
            const file = await vaultFacade.app.vault.createBinary(
              params.path,
              params.data,
              params.options
            );
            
            // Return rich file information
            return {
              path: file.path,
              name: file.name,
              basename: file.basename,
              extension: file.extension,
              stat: {
                ctime: file.stat.ctime,
                mtime: file.stat.mtime,
                size: file.stat.size
              }
            };
          } catch (error) {
            // Handle Obsidian's specific error pattern for existing files
            if (error.message && error.message.includes('already exists')) {
              throw new Error(`File already exists: ${params.path}`);
            }
            throw error;
          }
        },
        schema: new SchemaBuilder()
          .addString('path', 'Path where the binary file should be created', true)
          .addObject('data', 'Binary data as ArrayBuffer', true)
          .addObject('options', 'Creation options (optional)', false, {
            properties: {
              mtime: { type: 'number', description: 'Modified time' },
              ctime: { type: 'number', description: 'Created time' }
            }
          })
          .build()
      },
      
      {
        name: 'rename',
        description: 'Rename a note to a new path',
        handler: async (params: { path: string; newPath: string }) => {
          // Get the file using Obsidian's native method
          const file = vaultFacade.app.vault.getAbstractFileByPath(params.path);
          if (!file || !(file instanceof vaultFacade.app.vault.constructor.TFile)) {
            throw new Error(`File not found: ${params.path}`);
          }
          
          // Use Obsidian's native Vault.rename method
          await vaultFacade.app.vault.rename(file, params.newPath);
          
          return {
            success: true,
            oldPath: params.path,
            newPath: params.newPath
          };
        },
        schema: new SchemaBuilder()
          .addString('path', 'Current path of the note', true)
          .addString('newPath', 'New path for the note', true)
          .build()
      },
      
      {
        name: 'batchEdit',
        description: 'Perform multiple edits on a note in a single operation',
        handler: async (params: { 
          path: string; 
          operations: Array<{
            type: 'append' | 'prepend' | 'replace' | 'insert' | 'delete';
            content?: string;
            search?: string;
            replace?: string;
            replaceAll?: boolean;
            line?: number;
            startLine?: number;
            endLine?: number;
          }>
        }) => {
          // Get the file using Obsidian's native method
          const file = vaultFacade.app.vault.getAbstractFileByPath(params.path);
          if (!file || !(file instanceof vaultFacade.app.vault.constructor.TFile)) {
            throw new Error(`File not found: ${params.path}`);
          }
          
          // Read content using Obsidian's native method
          const content = await vaultFacade.app.vault.read(file);
          
          // Apply operations sequentially
          let newContent = content;
          
          for (const op of params.operations) {
            switch (op.type) {
              case 'append':
                newContent = newContent + '\n' + op.content;
                break;
                
              case 'prepend':
                newContent = op.content + '\n' + newContent;
                break;
                
              case 'replace':
                if (op.replaceAll) {
                  newContent = newContent.split(op.search).join(op.replace);
                } else {
                  newContent = newContent.replace(op.search, op.replace);
                }
                break;
                
              case 'insert':
                const insertLines = newContent.split('\n');
                const insertIndex = Math.min(insertLines.length, Math.max(0, op.line - 1));
                insertLines.splice(insertIndex, 0, op.content);
                newContent = insertLines.join('\n');
                break;
                
              case 'delete':
                const deleteLines = newContent.split('\n');
                const deleteStart = Math.max(0, op.startLine - 1);
                const deleteEnd = op.endLine ? Math.min(deleteLines.length, op.endLine) : deleteStart + 1;
                deleteLines.splice(deleteStart, deleteEnd - deleteStart);
                newContent = deleteLines.join('\n');
                break;
            }
          }
          
          // Update note using Obsidian's native method
          await vaultFacade.app.vault.modify(file, newContent);
          
          // Return rich file information
          return {
            path: file.path,
            name: file.name,
            basename: file.basename,
            extension: file.extension,
            stat: {
              ctime: file.stat.ctime,
              mtime: file.stat.mtime,
              size: file.stat.size
            }
          };
        },
        schema: {
          type: 'object',
          required: ['path', 'operations'],
          properties: {
            path: {
              type: 'string',
              description: 'Path to the note'
            },
            operations: {
              type: 'array',
              description: 'Array of edit operations to perform',
              items: {
                type: 'object',
                required: ['type'],
                properties: {
                  type: {
                    type: 'string',
                    enum: ['append', 'prepend', 'replace', 'insert', 'delete'],
                    description: 'Type of edit operation'
                  },
                  content: {
                    type: 'string',
                    description: 'Content for append, prepend, or insert operations'
                  },
                  search: {
                    type: 'string',
                    description: 'Text to search for in replace operations'
                  },
                  replace: {
                    type: 'string',
                    description: 'Replacement text for replace operations'
                  },
                  replaceAll: {
                    type: 'boolean',
                    description: 'Whether to replace all occurrences in replace operations'
                  },
                  line: {
                    type: 'number',
                    description: 'Line number for insert operations'
                  },
                  startLine: {
                    type: 'number',
                    description: 'Start line for delete operations'
                  },
                  endLine: {
                    type: 'number',
                    description: 'End line for delete operations'
                  }
                }
              }
            }
          }
        }
      }
    ]
  };
}
```


### 4. Implement FolderManager BCP

The FolderManager BCP provides tools for creating, listing, and managing folders:

```typescript
/**
 * Create the FolderManager BCP
 * @param context - BCP context
 * @returns BoundedContextPack
 */
export function createFolderManagerBCP(context: BCPContext): BoundedContextPack {
  const { vaultFacade, eventBus } = context;
  
  return {
    domain: 'FolderManager',
    description: 'Tools for managing folders in the vault',
    tools: [
      {
        name: 'createFolder',
        description: 'Create a new folder in the vault',
        handler: async (params: { path: string }) => {
          try {
            // Use Obsidian's native Vault.createFolder method directly
            const folder = await vaultFacade.app.vault.createFolder(params.path);
            
            // Return enhanced folder information
            return { 
              success: true, 
              path: folder.path,
              name: folder.name,
              isRoot: folder.isRoot()
            };
          } catch (error) {
            // Handle Obsidian's specific error for existing folders
            if (error.message && error.message.includes('already exists')) {
              throw new Error(`Folder already exists: ${params.path}`);
            }
            throw error;
          }
        },
        schema: new SchemaBuilder()
          .addString('path', 'Path where the folder should be created', true)
          .build()
      },
      
      {
        name: 'listFolder',
        description: 'List the contents of a folder',
        handler: async (params: { 
          path: string; 
          includeFiles?: boolean; 
          includeFolders?: boolean;
          includeHidden?: boolean;
        }) => {
          return await vaultFacade.listFolder(
            params.path, 
            {
              includeFiles: params.includeFiles, 
              includeFolders: params.includeFolders,
              includeHidden: params.includeHidden
            }
          );
        },
        schema: new SchemaBuilder()
          .addString('path', 'Path to the folder', true)
          .addBoolean('includeFiles', 'Whether to include files (default: true)')
          .addBoolean('includeFolders', 'Whether to include folders (default: true)')
          .addBoolean('includeHidden', 'Whether to include hidden files (default: false)')
          .build()
      },
      
      {
        name: 'deleteFolder',
        description: 'Delete a folder from the vault',
        handler: async (params: { path: string; recursive?: boolean }) => {
          await vaultFacade.deleteFolder(params.path, params.recursive);
          return { success: true, path: params.path };
        },
        schema: new SchemaBuilder()
          .addString('path', 'Path to the folder to delete', true)
          .addBoolean('recursive', 'Whether to delete recursively (default: false)')
          .build()
      },
      
      {
        name: 'moveFolder',
        description: 'Move a folder to a new location',
        handler: async (params: { path: string; newPath: string }) => {
          // Get vault file
          const folder = vaultFacade.app.vault.getAbstractFileByPath(params.path);
          
          if (!folder) {
            throw new Error(`Folder not found: ${params.path}`);
          }
          
          // Move folder
          await vaultFacade.app.vault.rename(folder, params.newPath);
          
          return { 
            success: true, 
            oldPath: params.path,
            newPath: params.newPath
          };
        },
        schema: new SchemaBuilder()
          .addString('path', 'Path to the folder to move', true)
          .addString('newPath', 'New path for the folder', true)
          .build()
      },
      
      {
        name: 'renameFolder',
        description: 'Rename a folder',
        handler: async (params: { path: string; newName: string }) => {
          // Get folder
          const folder = vaultFacade.app.vault.getAbstractFileByPath(params.path);
          
          if (!folder) {
            throw new Error(`Folder not found: ${params.path}`);
          }
          
          // Get parent path
          const parentPath = params.path.substring(0, params.path.lastIndexOf('/'));
          
          // Create new path
          const newPath = parentPath 
            ? `${parentPath}/${params.newName}` 
            : params.newName;
          
          // Move folder
          await vaultFacade.app.vault.rename(folder, newPath);
          
          return { 
            success: true, 
            oldPath: params.path,
            newPath: newPath
          };
        },
        schema: new SchemaBuilder()
          .addString('path', 'Path to the folder to rename', true)
          .addString('newName', 'New name for the folder', true)
          .build()
      },
      
      {
        name: 'createFolderStructure',
        description: 'Create a nested folder structure',
        handler: async (params: { 
          basePath: string; 
          structure: string[] 
        }) => {
          // Create base folder if it doesn't exist
          if (!vaultFacade.app.vault.getAbstractFileByPath(params.basePath)) {
            await vaultFacade.createFolder(params.basePath);
          }
          
          // Create folders
          const results = [];
          
          for (const folderPath of params.structure) {
            const fullPath = params.basePath 
              ? `${params.basePath}/${folderPath}` 
              : folderPath;
            
            try {
              await vaultFacade.createFolder(fullPath);
              results.push({
                path: fullPath,
                success: true
              });
            } catch (error) {
              results.push({
                path: fullPath,
                success: false,
                error: error instanceof Error ? error.message : String(error)
              });
            }
          }
          
          return {
            basePath: params.basePath,
            created: results.filter(r => r.success).length,
            total: params.structure.length,
            results
          };
        },
        schema: {
          type: 'object',
          required: ['basePath', 'structure'],
          properties: {
            basePath: {
              type: 'string',
              description: 'Base path for the folder structure'
            },
            structure: {
              type: 'array',
              description: 'Array of folder paths relative to the base path',
              items: {
                type: 'string'
              }
            }
          }
        }
      },
      
      {
        name: 'listRecursive',
        description: 'List folder contents recursively',
        handler: async (params: { 
          path: string; 
          includeFiles?: boolean; 
          includeFolders?: boolean;
          includeHidden?: boolean;
        }) => {
          const options = {
            includeFiles: params.includeFiles !== false,
            includeFolders: params.includeFolders !== false,
            includeHidden: params.includeHidden === true
          };
          
          // Get root folder
          const rootFolder = vaultFacade.app.vault.getAbstractFileByPath(params.path);
          
          if (!rootFolder) {
            throw new Error(`Folder not found: ${params.path}`);
          }
          
          // Recursively collect files and folders
          const files: string[] = [];
          const folders: string[] = [];
          
          function collect(folder) {
            if (options.includeFolders) {
              folders.push(folder.path);
            }
            
            for (const child of folder.children) {
              // Skip hidden files/folders unless explicitly included
              if (!options.includeHidden && child.path.split('/').pop()?.startsWith('.')) {
                continue;
              }
              
              if (child instanceof vaultFacade.app.vault.constructor.TFolder) {
                collect(child);
              } else if (options.includeFiles) {
                files.push(child.path);
              }
            }
          }
          
          collect(rootFolder);
          
          return {
            path: params.path,
            files,
            folders,
            count: {
              files: files.length,
              folders: folders.length,
              total: files.length + folders.length
            }
          };
        },
        schema: new SchemaBuilder()
          .addString('path', 'Path to the folder', true)
          .addBoolean('includeFiles', 'Whether to include files (default: true)')
          .addBoolean('includeFolders', 'Whether to include folders (default: true)')
          .addBoolean('includeHidden', 'Whether to include hidden files (default: false)')
          .build()
      },
      
      {
        name: 'watchFolder',
        description: 'Watch a folder for changes',
        handler: async (params: { path: string }) => {
          // Set up watcher
          const watcherId = vaultFacade.watchChanges(params.path, (change) => {
            // Emit event for AI to listen to
            eventBus.emit('folderManager:folderChanged', {
              watcherId,
              change
            });
          });
          
          return {
            success: true,
            path: params.path,
            watcherId
          };
        },
        schema: new SchemaBuilder()
          .addString('path', 'Path to the folder to watch', true)
          .build()
      },
      
      {
        name: 'unwatchFolder',
        description: 'Stop watching a folder',
        handler: async (params: { watcherId: string }) => {
          // Remove watcher
          vaultFacade.unwatchChanges(params.watcherId);
          
          return {
            success: true,
            watcherId: params.watcherId
          };
        },
        schema: new SchemaBuilder()
          .addString('watcherId', 'ID of the watcher to remove', true)
          .build()
      }
    ]
  };
}
```


### 5. Implement VaultLibrarian BCP

The VaultLibrarian BCP provides tools for searching and navigating the vault:

```typescript
/**
 * Create the VaultLibrarian BCP
 * @param context - BCP context
 * @returns BoundedContextPack
 */
export function createVaultLibrarianBCP(context: BCPContext): BoundedContextPack {
  const { vaultFacade, eventBus } = context;
  
  return {
    domain: 'VaultLibrarian',
    description: 'Tools for searching and navigating the vault',
    tools: [
      {
        name: 'searchContent',
        description: 'Search for content in the vault',
        handler: async (params: {
          query: string;
          includeContent?: boolean;
          limit?: number;
          paths?: string[];
          searchTypes?: Array<'title' | 'content' | 'tag' | 'heading' | 'property'>;
        }) => {
          // Get all markdown files
          const allFiles = vaultFacade.app.vault.getMarkdownFiles();
          
          // Filter by paths if provided
          const filteredFiles = params.paths 
            ? allFiles.filter(file => params.paths.some(path => file.path.startsWith(path)))
            : allFiles;
          
          // Default search types
          const searchTypes = params.searchTypes || ['title', 'content', 'tag', 'heading'];
          
          // Normalize query
          const normalizedQuery = params.query.toLowerCase();
          
          // Array to store search results
          const results = [];
          
          // Search in files
          for (const file of filteredFiles) {
            // Get metadata cache for this file
            const cache = vaultFacade.app.metadataCache.getFileCache(file);
            if (!cache && searchTypes.some(type => type !== 'content')) continue;
            
            // Initialize file match data
            let foundMatch = false;
            let score = 0;
            let matchDetails = [];
            
            // Search in title
            if (searchTypes.includes('title')) {
              const titleMatch = file.basename.toLowerCase().includes(normalizedQuery);
              if (titleMatch) {
                foundMatch = true;
                score += 100;
                matchDetails.push({ type: 'title', text: file.basename });
              }
            }
            
            // Search in headings
            if (searchTypes.includes('heading') && cache?.headings) {
              const headingMatches = cache.headings.filter(h => 
                h.heading.toLowerCase().includes(normalizedQuery)
              );
              
              if (headingMatches.length > 0) {
                foundMatch = true;
                score += 80;
                matchDetails.push(...headingMatches.map(h => ({ 
                  type: 'heading', 
                  level: h.level, 
                  text: h.heading 
                })));
              }
            }
            
            // Search in tags
            if (searchTypes.includes('tag') && cache?.tags) {
              const tagMatches = cache.tags.filter(tag => 
                tag.tag.toLowerCase().includes(normalizedQuery)
              );
              
              if (tagMatches.length > 0) {
                foundMatch = true;
                score += 70;
                matchDetails.push(...tagMatches.map(tag => ({ 
                  type: 'tag', 
                  text: tag.tag 
                })));
              }
            }
            
            // Search in properties
            if (searchTypes.includes('property') && cache?.frontmatter) {
              const frontmatterStr = JSON.stringify(cache.frontmatter).toLowerCase();
              const propertyMatch = frontmatterStr.includes(normalizedQuery);
              
              if (propertyMatch) {
                foundMatch = true;
                score += 60;
                
                // Find which properties match
                const matchingProps = Object.entries(cache.frontmatter)
                  .filter(([key, value]) => {
                    const keyMatch = key.toLowerCase().includes(normalizedQuery);
                    const valueMatch = String(value).toLowerCase().includes(normalizedQuery);
                    return keyMatch || valueMatch;
                  })
                  .map(([key, value]) => ({ type: 'property', key, value: String(value) }));
                  
                matchDetails.push(...matchingProps);
              }
            }
            
            // Search in content (only if needed)
            let content;
            let snippet = '';
            
            if (!foundMatch && searchTypes.includes('content') || params.includeContent) {
              content = await vaultFacade.app.vault.read(file);
              const contentMatch = content.toLowerCase().includes(normalizedQuery);
              
              if (contentMatch) {
                foundMatch = true;
                score += 40;
                
                // Create snippet
                const index = content.toLowerCase().indexOf(normalizedQuery);
                const start = Math.max(0, index - 40);
                const end = Math.min(content.length, index + params.query.length + 60);
                
                snippet = (start > 0 ? '...' : '') + 
                  content.substring(start, end) + 
                  (end < content.length ? '...' : '');
                  
                matchDetails.push({ type: 'content', snippet });
              }
            }
            
            // Add to results if any match found
            if (foundMatch) {
              results.push({
                path: file.path,
                name: file.basename,
                score,
                matches: matchDetails,
                snippet: snippet || matchDetails[0]?.text || file.basename,
                content: params.includeContent ? content : undefined
              });
            }
          }
          
          // Sort results by score (descending)
          results.sort((a, b) => b.score - a.score);
          
          // Apply limit
          const limit = params.limit || 20;
          const limitedResults = results.slice(0, limit);
          
          return {
            query: params.query,
            count: limitedResults.length,
            total: results.length,
            results: limitedResults
          };
        },
        schema: new SchemaBuilder()
          .addString('query', 'Query string to search for', true)
          .addBoolean('includeContent', 'Whether to include full content in results (default: false)')
          .addNumber('limit', 'Maximum number of results to return (default: 20)', false, {
            minimum: 1,
            maximum: 100
          })
          .addArray('paths', 'Only search in these paths (optional)', false)
          .addArray('searchTypes', 'Types of content to search in (default: all)', false, {
            items: {
              type: 'string',
              enum: ['title', 'content', 'tag', 'heading', 'property']
            }
          })
          .build()
      },
      
      {
        name: 'searchTag',
        description: 'Search for notes with a specific tag',
        handler: async (params: { tag: string; limit?: number }) => {
          // Normalize tag (remove # if present)
          const normalizedTag = params.tag.startsWith('#') 
            ? params.tag.substring(1) 
            : params.tag;
          
          // Use Obsidian's metadata cache
          const files = vaultFacade.app.metadataCache.getFilesByTag(normalizedTag);
          
          // Apply limit if specified
          const limitedFiles = params.limit 
            ? files.slice(0, params.limit) 
            : files;
          
          return {
            tag: params.tag,
            count: limitedFiles.length,
            total: files.length,
            results: limitedFiles.map(file => file.path)
          };
        },
        schema: new SchemaBuilder()
          .addString('tag', 'Tag to search for', true)
          .addNumber('limit', 'Maximum number of results to return', false, {
            minimum: 1,
            maximum: 100
          })
          .build()
      },
      
      {
        name: 'searchProperty',
        description: 'Search for notes with a specific property',
        handler: async (params: { key: string; value?: string; limit?: number }) => {
          // Get all files
          const allFiles = vaultFacade.app.vault.getMarkdownFiles();
          
          // Filter files with matching property
          const results = [];
          
          for (const file of allFiles) {
            const metadata = vaultFacade.app.metadataCache.getFileCache(file);
            
            // Skip files without frontmatter
            if (!metadata || !metadata.frontmatter) {
              continue;
            }
            
            // Check if property exists
            if (!(params.key in metadata.frontmatter)) {
              continue;
            }
            
            // Check property value if specified
            if (params.value && metadata.frontmatter[params.key] !== params.value) {
              continue;
            }
            
            // Add to results
            results.push({
              path: file.path,
              value: metadata.frontmatter[params.key]
            });
            
            // Check limit
            if (params.limit && results.length >= params.limit) {
              break;
            }
          }
          
          return {
            key: params.key,
            value: params.value,
            count: results.length,
            results
          };
        },
        schema: new SchemaBuilder()
          .addString('key', 'Property key to search for', true)
          .addString('value', 'Optional property value to match', false)
          .addNumber('limit', 'Maximum number of results to return', false, {
            minimum: 1,
            maximum: 100
          })
          .build()
      },
      
      {
        name: 'listTags',
        description: 'List all tags in the vault',
        handler: async (params: { limit?: number }) => {
          // Get all tags from metadata cache
          const tagCounts = {};
          
          // Iterate through all markdown files
          for (const file of vaultFacade.app.vault.getMarkdownFiles()) {
            const metadata = vaultFacade.app.metadataCache.getFileCache(file);
            
            // Skip files without tags
            if (!metadata || !metadata.tags) {
              continue;
            }
            
            // Count tags
            for (const tag of metadata.tags) {
              const tagName = tag.tag;
              tagCounts[tagName] = (tagCounts[tagName] || 0) + 1;
            }
          }
          
          // Convert to array and sort by count
          const tags = Object.entries(tagCounts)
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count);
          
          // Apply limit if specified
          const limitedTags = params.limit 
            ? tags.slice(0, params.limit) 
            : tags;
          
          return {
            count: limitedTags.length,
            total: tags.length,
            tags: limitedTags
          };
        },
        schema: new SchemaBuilder()
          .addNumber('limit', 'Maximum number of tags to return', false, {
            minimum: 1,
            maximum: 100
          })
          .build()
      },
      
      {
        name: 'listProperties',
        description: 'List all frontmatter properties used in the vault',
        handler: async (params: { limit?: number }) => {
          // Track properties and their usage
          const propertyUsage = {};
          
          // Iterate through all markdown files
          for (const file of vaultFacade.app.vault.getMarkdownFiles()) {
            const metadata = vaultFacade.app.metadataCache.getFileCache(file);
            
            // Skip files without frontmatter
            if (!metadata || !metadata.frontmatter) {
              continue;
            }
            
            // Count property usage
            for (const key of Object.keys(metadata.frontmatter)) {
              propertyUsage[key] = (propertyUsage[key] || 0) + 1;
            }
          }
          
          // Convert to array and sort by usage
          const properties = Object.entries(propertyUsage)
            .map(([key, count]) => ({ key, count }))
            .sort((a, b) => b.count - a.count);
          
          // Apply limit if specified
          const limitedProperties = params.limit 
            ? properties.slice(0, params.limit) 
            : properties;
          
          return {
            count: limitedProperties.length,
            total: properties.length,
            properties: limitedProperties
          };
        },
        schema: new SchemaBuilder()
          .addNumber('limit', 'Maximum number of properties to return', false, {
            minimum: 1,
            maximum: 100
          })
          .build()
      },
      
      {
        name: 'findRecentNotes',
        description: 'Find recently modified notes',
        handler: async (params: { 
          limit?: number; 
          days?: number; 
          path?: string;
        }) => {
          // Get all markdown files
          let files = vaultFacade.app.vault.getMarkdownFiles();
          
          // Filter by path if specified
          if (params.path) {
            files = files.filter(file => file.path.startsWith(params.path));
          }
          
          // Sort by modification time (newest first)
          files.sort((a, b) => b.stat.mtime - a.stat.mtime);
          
          // Filter by days if specified
          if (params.days) {
            const cutoff = Date.now() - (params.days * 24 * 60 * 60 * 1000);
            files = files.filter(file => file.stat.mtime >= cutoff);
          }
          
          // Apply limit if specified
          const limitedFiles = params.limit 
            ? files.slice(0, params.limit) 
            : files;
          
          // Format results
          const results = limitedFiles.map(file => ({
            path: file.path,
            modified: new Date(file.stat.mtime).toISOString(),
            created: new Date(file.stat.ctime).toISOString()
          }));
          
          return {
            count: results.length,
            total: files.length,
            results
          };
        },
        schema: new SchemaBuilder()
          .addNumber('limit', 'Maximum number of notes to return', false, {
            minimum: 1,
            maximum: 100
          })
          .addNumber('days', 'Only include notes modified within this many days', false, {
            minimum: 1
          })
          .addString('path', 'Only include notes within this path', false)
          .build()
      },
      
      {
        name: 'findLinksTo',
        description: 'Find notes that link to a specific note',
        handler: async (params: { path: string; limit?: number }) => {
          // Get all markdown files
          const files = vaultFacade.app.vault.getMarkdownFiles();
          
          // Find backlinks
          const results = [];
          
          for (const file of files) {
            const metadata = vaultFacade.app.metadataCache.getFileCache(file);
            
            // Skip files without links
            if (!metadata || !metadata.links) {
              continue;
            }
            
            // Check if file links to the target
            const links = metadata.links.filter(link => {
              // Get resolved path
              let resolvedPath = vaultFacade.app.metadataCache.getFirstLinkpathDest(
                link.link,
                file.path
              )?.path;
              
              return resolvedPath === params.path;
            });
            
            if (links.length > 0) {
              results.push({
                path: file.path,
                linkCount: links.length
              });
            }
            
            // Check limit
            if (params.limit && results.length >= params.limit) {
              break;
            }
          }
          
          // Sort by link count
          results.sort((a, b) => b.linkCount - a.linkCount);
          
          return {
            target: params.path,
            count: results.length,
            results
          };
        },
        schema: new SchemaBuilder()
          .addString('path', 'Path to the note', true)
          .addNumber('limit', 'Maximum number of results to return', false, {
            minimum: 1,
            maximum: 100
          })
          .build()
      },
      
      {
        name: 'findUnlinked',
        description: 'Find notes that have no incoming links',
        handler: async (params: { limit?: number; path?: string }) => {
          // Get all markdown files
          let files = vaultFacade.app.vault.getMarkdownFiles();
          
          // Filter by path if specified
          if (params.path) {
            files = files.filter(file => file.path.startsWith(params.path));
          }
          
          // Build a set of all files that are linked to
          const linkedFiles = new Set();
          
          for (const file of files) {
            const metadata = vaultFacade.app.metadataCache.getFileCache(file);
            
            // Skip files without links
            if (!metadata || !metadata.links) {
              continue;
            }
            
            // Add linked files to set
            for (const link of metadata.links) {
              const target = vaultFacade.app.metadataCache.getFirstLinkpathDest(
                link.link,
                file.path
              );
              
              if (target) {
                linkedFiles.add(target.path);
              }
            }
          }
          
          // Find files with no incoming links
          const unlinked = files.filter(file => !linkedFiles.has(file.path));
          
          // Apply limit if specified
          const limitedResults = params.limit 
            ? unlinked.slice(0, params.limit) 
            : unlinked;
          
          // Format results
          const results = limitedResults.map(file => ({
            path: file.path,
            modified: new Date(file.stat.mtime).toISOString()
          }));
          
          return {
            count: results.length,
            total: unlinked.length,
            results
          };
        },
        schema: new SchemaBuilder()
          .addNumber('limit', 'Maximum number of results to return', false, {
            minimum: 1,
            maximum: 100
          })
          .addString('path', 'Only include notes within this path', false)
          .build()
      }
    ]
  };
}
```


### 6. Implement PaletteCommander BCP

The PaletteCommander BCP provides tools for interacting with Obsidian's command palette:

```typescript
/**
 * Create the PaletteCommander BCP
 * @param context - BCP context
 * @returns BoundedContextPack
 */
export function createPaletteCommanderBCP(context: BCPContext): BoundedContextPack {
  const { vaultFacade, eventBus } = context;
  
  return {
    domain: 'PaletteCommander',
    description: 'Tools for interacting with Obsidian command palette',
    tools: [
      {
        name: 'listCommands',
        description: 'List available commands in Obsidian',
        handler: async (params: { filter?: string }) => {
          // Get commands from app
          const commands = vaultFacade.app.commands.commands;
          
          // Convert to array
          const commandArray = Object.entries(commands).map(([id, command]) => ({
            id,
            name: command.name,
            hotkeys: command.hotkeys?.map(hotkey => hotkey.toString()) || []
          }));
          
          // Apply filter if specified
          const filteredCommands = params.filter
            ? commandArray.filter(cmd => 
                cmd.name.toLowerCase().includes(params.filter.toLowerCase()) || 
                cmd.id.toLowerCase().includes(params.filter.toLowerCase())
              )
            : commandArray;
          
          // Sort by name
          filteredCommands.sort((a, b) => a.name.localeCompare(b.name));
          
          return {
            count: filteredCommands.length,
            total: commandArray.length,
            commands: filteredCommands
          };
        },
        schema: new SchemaBuilder()
          .addString('filter', 'Optional filter to apply to command names', false)
          .build()
      },
      
      {
        name: 'executeCommand',
        description: 'Execute an Obsidian command by ID',
        handler: async (params: { id: string; checkCallback?: boolean }) => {
          // Get command detail
          const command = vaultFacade.app.commands.commands[params.id];
          
          // Check if command exists
          if (!command) {
            throw new Error(`Command not found: ${params.id}`);
          }
          
          try {
            // Check if command can be executed (if specified)
            if (params.checkCallback && command.checkCallback) {
              // For commands with checkCallback, check if they can be executed first
              const canExecute = command.checkCallback(false);
              if (!canExecute) {
                return {
                  success: false,
                  id: params.id,
                  name: command.name,
                  error: "Command cannot be executed in the current context",
                  canExecute: false
                };
              }
            }
            
            // Execute command and track success
            const result = await vaultFacade.app.commands.executeCommandById(params.id);
            
            // Return detailed information
            return {
              success: true,
              id: params.id,
              name: command.name,
              result: result ?? true,
              commandType: {
                hasCallback: !!command.callback,
                hasCheckCallback: !!command.checkCallback,
                hasEditorCallback: !!command.editorCallback,
                hasEditorCheckCallback: !!command.editorCheckCallback
              }
            };
          } catch (error) {
            // Return detailed error information
            return {
              success: false,
              id: params.id,
              name: command.name,
              error: error instanceof Error ? error.message : String(error)
            };
          }
        },
        schema: new SchemaBuilder()
          .addString('id', 'ID of the command to execute', true)
          .addBoolean('checkCallback', 'Whether to check if command can be executed before trying (default: false)')
          .build()
      },
      
      {
        name: 'createCommandChain',
        description: 'Create and execute a chain of commands',
        handler: async (params: { commands: string[] }) => {
          const results = [];
          
          // Execute each command in sequence
          for (const id of params.commands) {
            try {
              // Check if command exists
              if (!vaultFacade.app.commands.commands[id]) {
                results.push({
                  id,
                  success: false,
                  error: `Command not found: ${id}`
                });
                continue;
              }
              
              // Execute command
              const result = await vaultFacade.app.commands.executeCommandById(id);
              
              // Add result
              results.push({
                id,
                name: vaultFacade.app.commands.commands[id].name,
                success: true,
                result
              });
            } catch (error) {
              // Add error
              results.push({
                id,
                name: vaultFacade.app.commands.commands[id]?.name,
                success: false,
                error: error instanceof Error ? error.message : String(error)
              });
            }
          }
          
          return {
            executed: results.filter(r => r.success).length,
            total: params.commands.length,
            results
          };
        },
        schema: {
          type: 'object',
          required: ['commands'],
          properties: {
            commands: {
              type: 'array',
              description: 'Array of command IDs to execute in sequence',
              items: {
                type: 'string'
              }
            }
          }
        }
      },
      
      {
        name: 'findCommandById',
        description: 'Find a command by ID',
        handler: async (params: { id: string }) => {
          // Check if command exists
          const command = vaultFacade.app.commands.commands[params.id];
          
          if (!command) {
            throw new Error(`Command not found: ${params.id}`);
          }
          
          return {
            id: params.id,
            name: command.name,
            hotkeys: command.hotkeys?.map(hotkey => hotkey.toString()) || [],
            callback: !!command.callback,
            checkCallback: !!command.checkCallback,
            editorCallback: !!command.editorCallback,
            editorCheckCallback: !!command.editorCheckCallback
          };
        },
        schema: new SchemaBuilder()
          .addString('id', 'ID of the command to find', true)
          .build()
      },
      
      {
        name: 'findCommandByName',
        description: 'Find a command by name',
        handler: async (params: { name: string }) => {
          // Get commands from app
          const commands = vaultFacade.app.commands.commands;
          
          // Convert to array
          const commandArray = Object.entries(commands)
            .map(([id, command]) => ({
              id,
              name: command.name,
              hotkeys: command.hotkeys?.map(hotkey => hotkey.toString()) || [],
              callback: !!command.callback,
              checkCallback: !!command.checkCallback,
              editorCallback: !!command.editorCallback,
              editorCheckCallback: !!command.editorCheckCallback
            }))
            .filter(cmd => 
              cmd.name.toLowerCase().includes(params.name.toLowerCase())
            );
          
          // Sort by relevance (exact match first, then startsWith, then includes)
          commandArray.sort((a, b) => {
            const nameA = a.name.toLowerCase();
            const nameB = b.name.toLowerCase();
            const searchTerm = params.name.toLowerCase();
            
            if (nameA === searchTerm && nameB !== searchTerm) return -1;
            if (nameA !== searchTerm && nameB === searchTerm) return 1;
            if (nameA.startsWith(searchTerm) && !nameB.startsWith(searchTerm)) return -1;
            if (!nameA.startsWith(searchTerm) && nameB.startsWith(searchTerm)) return 1;
            return 0;
          });
          
          return {
            query: params.name,
            count: commandArray.length,
            commands: commandArray
          };
        },
        schema: new SchemaBuilder()
          .addString('name', 'Name of the command to find', true)
          .build()
      },
      
      {
        name: 'getCommandGroups',
        description: 'Get commands grouped by plugin',
        handler: async () => {
          // Get commands from app
          const commands = vaultFacade.app.commands.commands;
          
          // Group by plugin ID
          const groups = {};
          
          for (const [id, command] of Object.entries(commands)) {
            const pluginId = id.split(':')[0];
            
            if (!groups[pluginId]) {
              groups[pluginId] = [];
            }
            
            groups[pluginId].push({
              id,
              name: command.name,
              hotkeys: command.hotkeys?.map(hotkey => hotkey.toString()) || []
            });
          }
          
          // Format result
          const result = Object.entries(groups).map(([pluginId, commands]) => ({
            plugin: pluginId,
            count: commands.length,
            commands
          }));
          
          // Sort by plugin ID
          result.sort((a, b) => a.plugin.localeCompare(b.plugin));
          
          return {
            groups: result,
            totalPlugins: result.length,
            totalCommands: Object.values(commands).length
          };
        },
        schema: {}
      },
      
      {
        name: 'executeCommandWithHotkey',
        description: 'Execute a command using its hotkey',
        handler: async (params: { hotkey: string }) => {
          // Parse hotkey
          const hotkeyParts = params.hotkey.toLowerCase().split('+');
          
          // Build event
          const event = new KeyboardEvent('keydown', {
            key: hotkeyParts[hotkeyParts.length - 1],
            ctrlKey: hotkeyParts.includes('ctrl'),
            shiftKey: hotkeyParts.includes('shift'),
            altKey: hotkeyParts.includes('alt'),
            metaKey: hotkeyParts.includes('meta') || hotkeyParts.includes('cmd'),
            bubbles: true
          });
          
          // Get active leaf view
          const view = vaultFacade.app.workspace.getActiveViewOfType(vaultFacade.app.workspace.constructor.View);
          
          if (!view) {
            throw new Error('No active view');
          }
          
          // Dispatch event
          view.containerEl.dispatchEvent(event);
          
          return {
            success: true,
            hotkey: params.hotkey
          };
        },
        schema: new SchemaBuilder()
          .addString('hotkey', 'Hotkey to simulate (e.g., "Ctrl+P")', true)
          .build()
      }
    ]
  };
}
```


### 7. Integrate BCPs with Plugin Core

Now let's update the main plugin class to register all BCPs during initialization:

```typescript
import { Plugin } from 'obsidian';
import { EventBus } from './core/EventBus';
import { SettingsManager } from './core/SettingsManager';
import { EnhancedVaultFacade } from './core/VaultFacade';
import { BCPRegistry } from './mcp/BCPRegistry';
import { ToolManager } from './mcp/ToolManager';
import { BCPContext, registerBCP } from './mcp/BCPFactory';
import { createNoteManagerBCP } from './bcps/NoteManager';
import { createFolderManagerBCP } from './bcps/FolderManager';
import { createVaultLibrarianBCP } from './bcps/VaultLibrarian';
import { createPaletteCommanderBCP } from './bcps/PaletteCommander';

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
      this.settings
    );
    
    // Initialize tool manager
    this.toolManager = new ToolManager(this.eventBus, this.bcpRegistry);
    
    // Create BCP context
    const bcpContext: BCPContext = {
      vaultFacade: this.vaultFacade,
      eventBus: this.eventBus,
      settings: this.settings
    };
    
    // Register built-in BCPs
    registerBCP(this.bcpRegistry, createNoteManagerBCP, bcpContext);
    registerBCP(this.bcpRegistry, createFolderManagerBCP, bcpContext);
    registerBCP(this.bcpRegistry, createVaultLibrarianBCP, bcpContext);
    registerBCP(this.bcpRegistry, createPaletteCommanderBCP, bcpContext);
    
    // Initialize BCP registry
    await this.bcpRegistry.initialize();
    
    // Auto-load configured BCPs
    const autoLoadBCPs = this.settings.getSettings().autoLoadBCPs || [
      'NoteManager',
      'FolderManager',
      'VaultLibrarian'
    ];
    
    for (const domain of autoLoadBCPs) {
      try {
        await this.bcpRegistry.loadPack(domain);
        console.log(`Auto-loaded BCP: ${domain}`);
      } catch (error) {
        console.error(`Error auto-loading BCP ${domain}:`, error);
      }
    }
    
    // Register event handlers
    this.registerEvents();
    
    console.log('Chatsidian plugin loaded');
  }
  
  private registerEvents() {
    // Log BCP events in debug mode
    if (this.settings.getSettings().debugMode) {
      this.eventBus.on('bcpRegistry:packLoaded', data => {
        console.log(`BCP loaded: ${data.domain} with ${data.tools.length} tools`);
      });
      
      this.eventBus.on('toolManager:toolRegistered', data => {
        console.log(`Tool registered: ${data.fullName}`);
      });
      
      this.eventBus.on('toolManager:executing', data => {
        console.log(`Executing tool: ${data.name}`, data.arguments);
      });
    }
  }
  
  onunload() {
    // Clean up resources
    this.eventBus.clear();
  }
}
```

### 8. Create BCP Registration Module

To make it easier to register and manage all BCPs, let's create a dedicated module:

```typescript
// src/mcp/BCPManager.ts
import { BCPContext, registerBCP } from './BCPFactory';
import { BCPRegistry } from './BCPRegistry';
import { createNoteManagerBCP } from '../bcps/NoteManager';
import { createFolderManagerBCP } from '../bcps/FolderManager';
import { createVaultLibrarianBCP } from '../bcps/VaultLibrarian';
import { createPaletteCommanderBCP } from '../bcps/PaletteCommander';

/**
 * Register all built-in BCPs with the registry
 * @param registry - BCP registry
 * @param context - BCP context
 */
export function registerBuiltInBCPs(
  registry: BCPRegistry,
  context: BCPContext
): void {
  // Register core BCPs
  registerBCP(registry, createNoteManagerBCP, context);
  registerBCP(registry, createFolderManagerBCP, context);
  registerBCP(registry, createVaultLibrarianBCP, context);
  registerBCP(registry, createPaletteCommanderBCP, context);
  
  // Log registration
  console.log('Registered built-in BCPs');
}

/**
 * Auto-load BCPs based on settings
 * @param registry - BCP registry
 * @param domains - Domains to auto-load
 * @returns Promise resolving when all BCPs are loaded
 */
export async function autoLoadBCPs(
  registry: BCPRegistry,
  domains: string[]
): Promise<void> {
  for (const domain of domains) {
    try {
      await registry.loadPack(domain);
      console.log(`Auto-loaded BCP: ${domain}`);
    } catch (error) {
      console.error(`Error auto-loading BCP ${domain}:`, error);
    }
  }
}

/**
 * Get all available BCP domains
 * @param registry - BCP registry
 * @returns Array of available domain names
 */
export function getAvailableBCPDomains(registry: BCPRegistry): string[] {
  return registry.listPacks().map(pack => pack.domain);
}

/**
 * Get all loaded BCP domains
 * @param registry - BCP registry
 * @returns Array of loaded domain names
 */
export function getLoadedBCPDomains(registry: BCPRegistry): string[] {
  return registry.getLoadedPacks();
}
```

### 9. Create AI Tool Documentation

For the AI assistant to effectively use these tools, we should create comprehensive documentation that will be included in the system prompt:

```markdown
# Chatsidian Tools Documentation

Chatsidian provides a set of tools for interacting with an Obsidian vault. These tools are organized into domain-specific Bounded Context Packs (BCPs).

## Available BCPs

The following BCPs are available in Chatsidian:

- **NoteManager**: Tools for managing notes in the vault
- **FolderManager**: Tools for managing folders in the vault
- **VaultLibrarian**: Tools for searching and navigating the vault
- **PaletteCommander**: Tools for interacting with Obsidian's command palette

## NoteManager Tools

### readNote

Read a note from the vault.

**Parameters:**
- `path` (string, required): Path to the note

**Example:**
```json
{
  "path": "Projects/Chatsidian/README.md"
}
```

**Returns:**
```json
{
  "content": "# Chatsidian\n\nA native chat interface for Obsidian.",
  "path": "Projects/Chatsidian/README.md"
}
```

### createNote

Create a new note in the vault.

**Parameters:**
- `path` (string, required): Path where the note should be created
- `content` (string, required): Content of the note
- `overwrite` (boolean, optional): Whether to overwrite existing note (default: false)

**Example:**
```json
{
  "path": "Daily Notes/2025-05-03.md",
  "content": "# Journal Entry\n\nToday I worked on implementing the Chatsidian plugin.",
  "overwrite": false
}
```

**Returns:**
```json
{
  "path": "Daily Notes/2025-05-03.md"
}
```

### updateNote

Update an existing note in the vault.

**Parameters:**
- `path` (string, required): Path to the note
- `content` (string, required): New content of the note

**Example:**
```json
{
  "path": "Projects/Tasks.md",
  "content": "# Tasks\n\n- [x] Implement NoteManager BCP\n- [ ] Implement FolderManager BCP"
}
```

**Returns:**
```json
{
  "path": "Projects/Tasks.md"
}
```

### appendToNote

Append content to an existing note.

**Parameters:**
- `path` (string, required): Path to the note
- `content` (string, required): Content to append

**Example:**
```json
{
  "path": "Projects/Ideas.md",
  "content": "## New Idea\n\nImplement virtual file system for in-memory editing."
}
```

**Returns:**
```json
{
  "path": "Projects/Ideas.md"
}
```

## FolderManager Tools

### createFolder

Create a new folder in the vault.

**Parameters:**
- `path` (string, required): Path where the folder should be created

**Example:**
```json
{
  "path": "Projects/Chatsidian/Docs"
}
```

**Returns:**
```json
{
  "success": true,
  "path": "Projects/Chatsidian/Docs"
}
```

### listFolder

List the contents of a folder.

**Parameters:**
- `path` (string, required): Path to the folder
- `includeFiles` (boolean, optional): Whether to include files (default: true)
- `includeFolders` (boolean, optional): Whether to include folders (default: true)
- `includeHidden` (boolean, optional): Whether to include hidden files (default: false)

**Example:**
```json
{
  "path": "Projects/Chatsidian",
  "includeFiles": true,
  "includeFolders": true
}
```

**Returns:**
```json
{
  "path": "Projects/Chatsidian",
  "files": [
    "Projects/Chatsidian/README.md",
    "Projects/Chatsidian/main.ts"
  ],
  "folders": [
    "Projects/Chatsidian/src",
    "Projects/Chatsidian/tests"
  ]
}
```

## VaultLibrarian Tools

### searchContent

Search for content in the vault.

**Parameters:**
- `query` (string, required): Query string to search for
- `includeContent` (boolean, optional): Whether to include full content in results (default: false)
- `limit` (number, optional): Maximum number of results to return (default: 20)
- `paths` (string[], optional): Only search in these paths

**Example:**
```json
{
  "query": "Chatsidian plugin",
  "includeContent": false,
  "limit": 5
}
```

**Returns:**
```json
{
  "query": "Chatsidian plugin",
  "results": [
    {
      "path": "Projects/Chatsidian/README.md",
      "score": 100,
      "snippet": "# Chatsidian\n\nA native chat interface for Obsidian..."
    },
    {
      "path": "Projects/Chatsidian/src/main.ts",
      "score": 80,
      "snippet": "export default class ChatsidianPlugin extends Plugin..."
    }
  ]
}
```

## PaletteCommander Tools

### listCommands

List available commands in Obsidian.

**Parameters:**
- `filter` (string, optional): Optional filter to apply to command names

**Example:**
```json
{
  "filter": "note"
}
```

**Returns:**
```json
{
  "count": 5,
  "total": 120,
  "commands": [
    {
      "id": "app:create-new-note",
      "name": "Create new note",
      "hotkeys": ["Ctrl+N"]
    },
    {
      "id": "app:delete-note",
      "name": "Delete note",
      "hotkeys": []
    }
  ]
}
```

### executeCommand

Execute an Obsidian command by ID.

**Parameters:**
- `id` (string, required): ID of the command to execute

**Example:**
```json
{
  "id": "app:create-new-note"
}
```

**Returns:**
```json
{
  "success": true,
  "id": "app:create-new-note",
  "name": "Create new note",
  "result": true
}
```

## Best Practices

1. **Use appropriate tools for the task**: Choose the most specific tool for each operation.
2. **Handle errors gracefully**: Check for common errors like missing files.
3. **Minimize tool calls**: Batch operations when possible to reduce overhead.
4. **Preserve user content**: Be careful when modifying or deleting files.
5. **Use absolute paths**: Always use complete paths from the vault root.
```


## Testing Strategy

### Unit Tests

- Test each BCP tool with various inputs
- Test error handling for edge cases
- Test tool interactions with the VaultFacade

```typescript
// Example unit test for NoteManager BCP
describe('NoteManager BCP', () => {
  let bcpContext: BCPContext;
  let bcp: BoundedContextPack;
  let mockVaultFacade: MockVaultFacade;
  let mockEventBus: MockEventBus;
  
  beforeEach(() => {
    mockVaultFacade = new MockVaultFacade();
    mockEventBus = new MockEventBus();
    
    bcpContext = {
      vaultFacade: mockVaultFacade as any,
      eventBus: mockEventBus as any,
      settings: mock<SettingsManager>()
    };
    
    bcp = createNoteManagerBCP(bcpContext);
  });
  
  test('readNote should call VaultFacade.readNote', async () => {
    // Setup
    const readNote = bcp.tools.find(t => t.name === 'readNote');
    const readNoteSpy = jest.spyOn(mockVaultFacade, 'readNote')
      .mockResolvedValue({ content: 'test content', path: 'test.md' });
    
    // Execute
    const result = await readNote.handler({ path: 'test.md' });
    
    // Verify
    expect(readNoteSpy).toHaveBeenCalledWith('test.md');
    expect(result).toEqual({ content: 'test content', path: 'test.md' });
  });
  
  test('createNote should call VaultFacade.createNote', async () => {
    // Setup
    const createNote = bcp.tools.find(t => t.name === 'createNote');
    const createNoteSpy = jest.spyOn(mockVaultFacade, 'createNote')
      .mockResolvedValue({ path: 'test.md' });
    
    // Execute
    const result = await createNote.handler({
      path: 'test.md',
      content: 'test content',
      overwrite: true
    });
    
    // Verify
    expect(createNoteSpy).toHaveBeenCalledWith(
      'test.md',
      'test content',
      true
    );
    expect(result).toEqual({ path: 'test.md' });
  });
  
  test('appendToNote should read and then update the note', async () => {
    // Setup
    const appendToNote = bcp.tools.find(t => t.name === 'appendToNote');
    const readNoteSpy = jest.spyOn(mockVaultFacade, 'readNote')
      .mockResolvedValue({ content: 'existing content', path: 'test.md' });
    const updateNoteSpy = jest.spyOn(mockVaultFacade, 'updateNote')
      .mockResolvedValue({ path: 'test.md' });
    
    // Execute
    const result = await appendToNote.handler({
      path: 'test.md',
      content: 'appended content'
    });
    
    // Verify
    expect(readNoteSpy).toHaveBeenCalledWith('test.md');
    expect(updateNoteSpy).toHaveBeenCalledWith(
      'test.md',
      'existing content\nappended content'
    );
    expect(result).toEqual({ path: 'test.md' });
  });
});
```

### Integration Tests

- Test BCPs with the actual VaultFacade
- Test interactions between different BCPs
- Test tool execution through the ToolManager

```typescript
// Example integration test
describe('BCPs Integration', () => {
  let plugin: ChatsidianPlugin;
  
  beforeEach(async () => {
    // Setup plugin
    plugin = new ChatsidianPlugin(app, manifest);
    await plugin.onload();
  });
  
  afterEach(async () => {
    // Cleanup
    await plugin.onunload();
  });
  
  test('should create, read, and delete a note', async () => {
    // Get tools
    const createTool = plugin.toolManager.getTool('NoteManager.createNote');
    const readTool = plugin.toolManager.getTool('NoteManager.readNote');
    const deleteTool = plugin.toolManager.getTool('NoteManager.deleteNote');
    
    const testPath = 'test/integration-test.md';
    const testContent = '# Integration Test\n\nThis is a test note.';
    
    try {
      // Create note
      await plugin.toolManager.executeToolCall({
        id: 'test-1',
        name: 'NoteManager.createNote',
        arguments: {
          path: testPath,
          content: testContent
        }
      });
      
      // Read note
      const readResult = await plugin.toolManager.executeToolCall({
        id: 'test-2',
        name: 'NoteManager.readNote',
        arguments: {
          path: testPath
        }
      });
      
      // Verify content
      expect(readResult.content).toEqual(testContent);
      
      // Delete note
      await plugin.toolManager.executeToolCall({
        id: 'test-3',
        name: 'NoteManager.deleteNote',
        arguments: {
          path: testPath
        }
      });
      
      // Verify deletion
      await expect(plugin.toolManager.executeToolCall({
        id: 'test-4',
        name: 'NoteManager.readNote',
        arguments: {
          path: testPath
        }
      })).rejects.toThrow();
    } finally {
      // Cleanup
      try {
        await plugin.vaultFacade.deleteNote(testPath);
      } catch (error) {
        // Note may already be deleted
      }
    }
  });
});
```

## Documentation References

- [[💻 Coding/Projects/Chatsidian/1_Architecture/Overview]]
- [[💻 Coding/Projects/Chatsidian/1_Architecture/Components/VaultFacade]]
- [[💻 Coding/Projects/Chatsidian/3_Implementation/Phase2.1-VaultFacade-Foundation]]
- [[💻 Coding/Projects/Chatsidian/3_Implementation/Phase2.2-BCP-Registry-Infrastructure]]
- [[💻 Coding/Projects/Chatsidian/3_Implementation/Phase2.3-Tool-Manager-Implementation]]
- [[💻 Coding/Projects/Chatsidian/3_Implementation/Phase2.4-VaultFacade-Advanced-Features]]

## Next Steps

Phase 2.6 will focus on implementing the MCP Client core functionality, which will allow AI assistants to access and use the BCPs implemented in this phase. The MCP Client will provide the connection between the AI models and the tools, handling message formatting, context management, and tool execution.

Future phases will also include:

1. Adding more specialized BCPs for specific domains
2. Creating a user interface for interacting with the AI assistants
3. Implementing streaming responses for real-time interaction
4. Adding settings for customizing AI behavior and tool availability

With the core BCPs implemented in this phase, we now have a solid foundation for AI-assisted vault operations in Obsidian.


## Enhanced File Type Handling

To better align with Obsidian's API, we've added a utility for file type detection that will be used in the BCPs:

```typescript
/**
 * Utilities for file type checking
 */
export class FileTypeUtil {
  /**
   * Check if a file is a Markdown file
   * @param file - File to check
   * @returns Whether the file is a Markdown file
   */
  public static isMarkdownFile(file: TAbstractFile): boolean {
    return file instanceof TFile && file.extension === 'md';
  }
  
  /**
   * Check if a file is an image file
   * @param file - File to check
   * @returns Whether the file is an image file
   */
  public static isImageFile(file: TAbstractFile): boolean {
    if (!(file instanceof TFile)) return false;
    
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'];
    return imageExtensions.includes(file.extension.toLowerCase());
  }
  
  /**
   * Check if a file is a binary file
   * @param file - File to check
   * @returns Whether the file is a binary file
   */
  public static isBinaryFile(file: TAbstractFile): boolean {
    if (!(file instanceof TFile)) return false;
    
    const textExtensions = ['md', 'txt', 'csv', 'json', 'js', 'ts', 'jsx', 'tsx', 'css', 'html', 'xml', 'yaml', 'yml'];
    return !textExtensions.includes(file.extension.toLowerCase());
  }
  
  /**
   * Get file type information
   * @param file - File to check
   * @returns File type information
   */
  public static getFileTypeInfo(file: TAbstractFile): {
    isFolder: boolean;
    isMarkdown: boolean;
    isImage: boolean;
    isBinary: boolean;
    extension?: string;
  } {
    if (file instanceof TFolder) {
      return {
        isFolder: true,
        isMarkdown: false,
        isImage: false,
        isBinary: false
      };
    }
    
    if (file instanceof TFile) {
      return {
        isFolder: false,
        isMarkdown: file.extension === 'md',
        isImage: this.isImageFile(file),
        isBinary: this.isBinaryFile(file),
        extension: file.extension
      };
    }
    
    return {
      isFolder: false,
      isMarkdown: false,
      isImage: false,
      isBinary: false
    };
  }
}
```

To improve compatibility with the Obsidian API, let's add this file type detection tool to the NoteManager BCP:

```typescript
{
  name: 'getFileInfo',
  description: 'Get detailed information about a file',
  handler: async (params: { path: string }) => {
    // Get file from path
    const file = vaultFacade.app.vault.getAbstractFileByPath(params.path);
    
    if (!file) {
      throw new Error(`File not found: ${params.path}`);
    }
    
    // Base info for any abstract file
    const baseInfo = {
      path: file.path,
      name: file.name,
      parent: file.parent?.path
    };
    
    // Add file-specific information
    if (file instanceof vaultFacade.app.vault.constructor.TFile) {
      const fileInfo = {
        ...baseInfo,
        basename: file.basename,
        extension: file.extension,
        stat: {
          ctime: file.stat.ctime,
          mtime: file.stat.mtime,
          size: file.stat.size
        },
        ...FileTypeUtil.getFileTypeInfo(file)
      };
      
      // Add metadata if it's a markdown file
      if (fileInfo.isMarkdown) {
        const metadata = vaultFacade.app.metadataCache.getFileCache(file);
        if (metadata) {
          fileInfo.metadata = {
            headings: metadata.headings?.map(h => ({ 
              level: h.level, 
              text: h.heading 
            })),
            tags: metadata.tags?.map(t => t.tag),
            links: metadata.links?.map(l => ({ 
              link: l.link,
              displayText: l.displayText
            })),
            frontmatter: metadata.frontmatter
          };
        }
      }
      
      return fileInfo;
    } 
    
    // It's a folder
    if (file instanceof vaultFacade.app.vault.constructor.TFolder) {
      return {
        ...baseInfo,
        isFolder: true,
        isRoot: file.isRoot(),
        children: file.children?.map(child => ({
          path: child.path,
          name: child.name,
          isFolder: child instanceof vaultFacade.app.vault.constructor.TFolder
        }))
      };
    }
    
    // Fallback for other abstract file types
    return baseInfo;
  },
  schema: new SchemaBuilder()
    .addString('path', 'Path to the file or folder', true)
    .build()
}
```

## Improved Error Handling

To further enhance the BCPs' alignment with Obsidian's API, we need to implement standardized error handling. Let's add utilities to handle Obsidian-specific errors:

```typescript
/**
 * Standardized error classes
 */
export class VaultError extends Error {
  constructor(message: string) {
    super(`[Vault] ${message}`);
    this.name = 'VaultError';
  }
}

export class FileNotFoundError extends VaultError {
  constructor(path: string) {
    super(`File not found: ${path}`);
    this.name = 'FileNotFoundError';
  }
}

export class FileExistsError extends VaultError {
  constructor(path: string) {
    super(`File already exists: ${path}`);
    this.name = 'FileExistsError';
  }
}

export class FolderNotFoundError extends VaultError {
  constructor(path: string) {
    super(`Folder not found: ${path}`);
    this.name = 'FolderNotFoundError';
  }
}

export class AccessDeniedError extends VaultError {
  constructor(path: string, operation: string) {
    super(`Access denied for operation '${operation}' on path: ${path}`);
    this.name = 'AccessDeniedError';
  }
}

/**
 * Error handler for Obsidian vault operations
 */
export class ErrorHandler {
  /**
   * Handle errors from Obsidian's API
   * @param error - Original error
   * @param path - Path that was being accessed
   * @param operation - Operation being performed
   * @returns A standardized error
   */
  public static handleVaultError(error: any, path: string, operation: string): Error {
    // If already a VaultError, return as is
    if (error instanceof VaultError) {
      return error;
    }
    
    const errorMessage = error?.message || String(error);
    
    // Match common Obsidian error patterns
    if (errorMessage.includes('already exists')) {
      return new FileExistsError(path);
    }
    
    if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
      return new FileNotFoundError(path);
    }
    
    if (errorMessage.includes('EACCES') || errorMessage.includes('permission denied')) {
      return new AccessDeniedError(path, operation);
    }
    
    // Default to general vault error
    return new VaultError(`Error in operation '${operation}' on path '${path}': ${errorMessage}`);
  }
}
```

## Integration with BCPRegistry

To ensure these improvements are available through the BCPRegistry, we need to update the registry initialization code:

```typescript
/**
 * Initialize BCPs with enhanced error handling
 * @param registry - BCP registry
 * @param context - BCP context with enhanced type detection
 */
export async function initializeBCPs(registry: BCPRegistry, context: BCPContext): Promise<void> {
  // Register all BCPs
  registerBCP(registry, createNoteManagerBCP, context);
  registerBCP(registry, createFolderManagerBCP, context);
  registerBCP(registry, createVaultLibrarianBCP, context);
  registerBCP(registry, createPaletteCommanderBCP, context);
  
  // Set up error handlers and utilities
  registry.onError((error, toolName) => {
    // Standard error handling
    console.error(`Error in tool ${toolName}:`, error);
    
    // Standardize errors
    const standardizedError = error instanceof VaultError 
      ? error 
      : new VaultError(`Error in ${toolName}: ${error.message || String(error)}`);
    
    // Emit errors to event bus for consistent handling
    context.eventBus.emit('bcpRegistry:error', {
      toolName,
      error: standardizedError
    });
  });
  
  // Emit initialization event
  context.eventBus.emit('bcpRegistry:initialized');
}
```

These improvements will make our implementation more robust and better aligned with Obsidian's native API patterns while maintaining compatibility with our existing architecture.
