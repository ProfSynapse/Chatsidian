---
title: Phase 1.5 - Storage Abstractions
description: Developing storage abstractions for Obsidian vault interaction in the Chatsidian plugin
date: 2025-05-03
status: planning
tags:
  - implementation
  - storage
  - data-persistence
  - vault-interaction
  - chatsidian
---

# Phase 1.5: Storage Abstractions

## Overview

This microphase focuses on developing robust storage abstractions for the Chatsidian plugin, enabling it to interact with the Obsidian vault for data persistence. The storage system will handle saving and loading conversations, managing folders, and caching data for improved performance.

## Objectives

- Create a storage manager class for handling data persistence
- Implement conversation loading, saving, and management
- Add folder management functionality
- Set up caching for improved performance
- Handle file system edge cases and errors
- Write tests for storage functionality

## Implementation Steps

### 1. Create Storage Manager Class

Create `src/core/StorageManager.ts`:

```typescript
/**
 * Storage manager for the Chatsidian plugin.
 * 
 * Handles data persistence within the Obsidian vault.
 */

import { App, TFile, TFolder } from 'obsidian';
import { Conversation, Message } from '../models/Conversation';
import { EventBus } from './EventBus';
import { SettingsManager } from './SettingsManager';

/**
 * Options for the StorageManager.
 */
export interface StorageManagerOptions {
  /**
   * Whether to enable caching.
   */
  enableCaching?: boolean;
  
  /**
   * Time in milliseconds before cache entries expire.
   */
  cacheExpiryTime?: number;
}

/**
 * Default options for the StorageManager.
 */
const DEFAULT_OPTIONS: StorageManagerOptions = {
  enableCaching: true,
  cacheExpiryTime: 5 * 60 * 1000 // 5 minutes
};

/**
 * Interface for cached conversation entry.
 */
interface CachedConversation {
  /**
   * The conversation data.
   */
  conversation: Conversation;
  
  /**
   * Whether the conversation is fully loaded.
   */
  isFullyLoaded: boolean;
  
  /**
   * Timestamp when the conversation was last accessed.
   */
  lastAccessed: number;
}

/**
 * StorageManager class for data persistence.
 */
export class StorageManager {
  private app: App;
  private settings: SettingsManager;
  private eventBus: EventBus;
  private options: StorageManagerOptions;
  
  /**
   * Cache of conversations.
   */
  private conversationsCache: Map<string, CachedConversation> = new Map();
  
  /**
   * Create a new StorageManager.
   * @param app Obsidian app instance
   * @param settings Settings manager
   * @param eventBus Event bus
   * @param options Optional configuration options
   */
  constructor(
    app: App, 
    settings: SettingsManager, 
    eventBus: EventBus,
    options: StorageManagerOptions = {}
  ) {
    this.app = app;
    this.settings = settings;
    this.eventBus = eventBus;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }
  
  /**
   * Initialize the storage manager.
   * @returns Promise that resolves when initialization is complete
   */
  public async initialize(): Promise<void> {
    // Ensure conversations folder exists
    await this.ensureConversationsFolder();
    
    // Load conversation index (metadata only)
    await this.loadConversationIndex();
    
    // Set up event listeners
    this.registerEventListeners();
  }
  
  /**
   * Register event listeners.
   */
  private registerEventListeners(): void {
    // Listen for settings changes
    this.eventBus.on('settings:updated', async (event) => {
      // If conversations folder changed, reload index
      if (event.changedKeys.includes('conversationsFolder')) {
        await this.handleConversationsFolderChanged();
      }
    });
  }
  
  /**
   * Handle conversations folder change.
   */
  private async handleConversationsFolderChanged(): Promise<void> {
    // Clear cache
    this.conversationsCache.clear();
    
    // Ensure new folder exists
    await this.ensureConversationsFolder();
    
    // Reload conversation index
    await this.loadConversationIndex();
    
    // Notify listeners
    this.eventBus.emit('storage:reloaded', undefined);
  }
  
  /**
   * Ensure the conversations folder exists.
   * @returns Promise that resolves when the folder exists
   */
  private async ensureConversationsFolder(): Promise<void> {
    const path = this.settings.getConversationsPath();
    
    try {
      const folder = this.app.vault.getAbstractFileByPath(path);
      
      if (!folder) {
        // Create folder if it doesn't exist
        await this.app.vault.createFolder(path);
      } else if (!(folder instanceof TFolder)) {
        throw new Error(`${path} exists but is not a folder`);
      }
    } catch (error) {
      console.error(`Failed to create conversations folder: ${error}`);
      throw error;
    }
  }
  
  /**
   * Load the conversation index (metadata only).
   */
  private async loadConversationIndex(): Promise<void> {
    const path = this.settings.getConversationsPath();
    const folder = this.app.vault.getAbstractFileByPath(path);
    
    if (folder instanceof TFolder) {
      for (const file of folder.children) {
        if (file instanceof TFile && file.extension === 'json') {
          const id = file.basename;
          
          // Create placeholder with minimal info
          this.conversationsCache.set(id, {
            conversation: {
              id,
              title: id, // Will be updated when fully loaded
              createdAt: file.stat.ctime,
              modifiedAt: file.stat.mtime,
              messages: []
            },
            isFullyLoaded: false,
            lastAccessed: Date.now()
          });
        }
      }
    }
  }
  
  /**
   * Get all conversations (metadata only).
   * @returns Promise that resolves with an array of conversations
   */
  public async getConversations(): Promise<Conversation[]> {
    // Return conversations from cache, sorted by modification date
    return Array.from(this.conversationsCache.values())
      .map(cached => cached.conversation)
      .sort((a, b) => b.modifiedAt - a.modifiedAt);
  }
  
  /**
   * Get a conversation by ID.
   * @param id Conversation ID
   * @returns Promise that resolves with the conversation or null if not found
   */
  public async getConversation(id: string): Promise<Conversation | null> {
    // Check if conversation is in cache and fully loaded
    const cached = this.conversationsCache.get(id);
    if (cached && cached.isFullyLoaded) {
      // Update last accessed time
      cached.lastAccessed = Date.now();
      return cached.conversation;
    }
    
    // Load from disk
    try {
      const path = `${this.settings.getConversationsPath()}/${id}.json`;
      const file = this.app.vault.getAbstractFileByPath(path);
      
      if (!(file instanceof TFile)) {
        return null;
      }
      
      const content = await this.app.vault.read(file);
      const conversation = JSON.parse(content) as Conversation;
      
      // Update cache
      this.conversationsCache.set(id, {
        conversation,
        isFullyLoaded: true,
        lastAccessed: Date.now()
      });
      
      // Emit event
      this.eventBus.emit('conversation:loaded', conversation);
      
      return conversation;
    } catch (error) {
      console.error(`Failed to load conversation ${id}: ${error}`);
      return null;
    }
  }
  
  /**
   * Save a conversation.
   * @param conversation Conversation to save
   * @returns Promise that resolves when the conversation is saved
   */
  public async saveConversation(conversation: Conversation): Promise<void> {
    try {
      // Update modification time
      conversation.modifiedAt = Date.now();
      
      // Path to file
      const path = `${this.settings.getConversationsPath()}/${conversation.id}.json`;
      
      // Convert to JSON
      const content = JSON.stringify(conversation, null, 2);
      
      // Check if file exists
      const file = this.app.vault.getAbstractFileByPath(path);
      
      if (file instanceof TFile) {
        // Update existing file
        await this.app.vault.modify(file, content);
      } else {
        // Create new file
        await this.app.vault.create(path, content);
      }
      
      // Update cache
      this.conversationsCache.set(conversation.id, {
        conversation: { ...conversation },
        isFullyLoaded: true,
        lastAccessed: Date.now()
      });
      
      // Emit event
      this.eventBus.emit('conversation:saved', conversation);
    } catch (error) {
      console.error(`Failed to save conversation ${conversation.id}: ${error}`);
      throw error;
    }
  }
  
  /**
   * Create a new conversation.
   * @param title Optional title for the conversation
   * @returns Promise that resolves with the new conversation
   */
  public async createConversation(title?: string): Promise<Conversation> {
    const id = this.generateId();
    const now = Date.now();
    
    const conversation: Conversation = {
      id,
      title: title || `New Conversation (${new Date(now).toLocaleString()})`,
      createdAt: now,
      modifiedAt: now,
      messages: []
    };
    
    await this.saveConversation(conversation);
    
    // Emit event
    this.eventBus.emit('conversation:created', conversation);
    
    return conversation;
  }
  
  /**
   * Delete a conversation.
   * @param id Conversation ID
   * @returns Promise that resolves when the conversation is deleted
   */
  public async deleteConversation(id: string): Promise<void> {
    try {
      const path = `${this.settings.getConversationsPath()}/${id}.json`;
      const file = this.app.vault.getAbstractFileByPath(path);
      
      if (file instanceof TFile) {
        await this.app.vault.delete(file);
      }
      
      // Remove from cache
      this.conversationsCache.delete(id);
      
      // Emit event
      this.eventBus.emit('conversation:deleted', id);
    } catch (error) {
      console.error(`Failed to delete conversation ${id}: ${error}`);
      throw error;
    }
  }
  
  /**
   * Add a message to a conversation.
   * @param conversationId Conversation ID
   * @param message Message to add
   * @returns Promise that resolves with the updated conversation
   */
  public async addMessage(conversationId: string, message: Message): Promise<Conversation> {
    // Get conversation
    const conversation = await this.getConversation(conversationId);
    
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }
    
    // Add message
    conversation.messages.push(message);
    
    // Save conversation
    await this.saveConversation(conversation);
    
    // Emit event
    this.eventBus.emit('message:added', {
      conversationId,
      message
    });
    
    return conversation;
  }
  
  /**
   * Update a message in a conversation.
   * @param conversationId Conversation ID
   * @param messageId Message ID
   * @param updatedContent Updated message content
   * @returns Promise that resolves with the updated conversation
   */
  public async updateMessage(
    conversationId: string,
    messageId: string,
    updatedContent: string
  ): Promise<Conversation> {
    // Get conversation
    const conversation = await this.getConversation(conversationId);
    
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }
    
    // Find message
    const messageIndex = conversation.messages.findIndex(m => m.id === messageId);
    
    if (messageIndex === -1) {
      throw new Error(`Message ${messageId} not found in conversation ${conversationId}`);
    }
    
    // Store previous content for event
    const previousContent = conversation.messages[messageIndex].content;
    
    // Update message
    conversation.messages[messageIndex].content = updatedContent;
    
    // Save conversation
    await this.saveConversation(conversation);
    
    // Emit event
    this.eventBus.emit('message:updated', {
      conversationId,
      messageId,
      previousContent,
      currentContent: updatedContent
    });
    
    return conversation;
  }
  
  /**
   * Delete a message from a conversation.
   * @param conversationId Conversation ID
   * @param messageId Message ID
   * @returns Promise that resolves with the updated conversation
   */
  public async deleteMessage(conversationId: string, messageId: string): Promise<Conversation> {
    // Get conversation
    const conversation = await this.getConversation(conversationId);
    
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }
    
    // Find message
    const messageIndex = conversation.messages.findIndex(m => m.id === messageId);
    
    if (messageIndex === -1) {
      throw new Error(`Message ${messageId} not found in conversation ${conversationId}`);
    }
    
    // Remove message
    conversation.messages.splice(messageIndex, 1);
    
    // Save conversation
    await this.saveConversation(conversation);
    
    // Emit event
    this.eventBus.emit('message:deleted', {
      conversationId,
      messageId
    });
    
    return conversation;
  }
  
  /**
   * Update a conversation's metadata.
   * @param conversationId Conversation ID
   * @param updates Updates to apply
   * @returns Promise that resolves with the updated conversation
   */
  public async updateConversationMetadata(
    conversationId: string,
    updates: Partial<Pick<Conversation, 'title' | 'metadata'>>
  ): Promise<Conversation> {
    // Get conversation
    const conversation = await this.getConversation(conversationId);
    
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }
    
    // Store previous state for event
    const previousConversation = { ...conversation };
    
    // Apply updates
    if (updates.title !== undefined) {
      conversation.title = updates.title;
    }
    
    if (updates.metadata !== undefined) {
      conversation.metadata = updates.metadata;
    }
    
    // Save conversation
    await this.saveConversation(conversation);
    
    // Emit event
    this.eventBus.emit('conversation:updated', {
      previousConversation,
      currentConversation: conversation
    });
    
    return conversation;
  }
  
  /**
   * Export a conversation to JSON.
   * @param conversationId Conversation ID
   * @returns Promise that resolves with the conversation as a JSON string
   */
  public async exportConversation(conversationId: string): Promise<string> {
    const conversation = await this.getConversation(conversationId);
    
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }
    
    return JSON.stringify(conversation, null, 2);
  }
  
  /**
   * Import a conversation from JSON.
   * @param json Conversation JSON
   * @returns Promise that resolves with the imported conversation
   */
  public async importConversation(json: string): Promise<Conversation> {
    try {
      const importedConversation = JSON.parse(json) as Conversation;
      
      // Validate imported conversation
      if (!importedConversation.id || !Array.isArray(importedConversation.messages)) {
        throw new Error('Invalid conversation format');
      }
      
      // Generate a new ID to avoid conflicts
      const originalId = importedConversation.id;
      importedConversation.id = this.generateId();
      
      // Update title to indicate it's an import
      if (!importedConversation.title.includes('(Import)')) {
        importedConversation.title = `${importedConversation.title} (Import)`;
      }
      
      // Save the conversation
      await this.saveConversation(importedConversation);
      
      // Log import
      console.log(`Imported conversation ${originalId} as ${importedConversation.id}`);
      
      return importedConversation;
    } catch (error) {
      console.error(`Failed to import conversation: ${error}`);
      throw error;
    }
  }
  
  /**
   * Clear the cache.
   */
  public clearCache(): void {
    this.conversationsCache.clear();
  }
  
  /**
   * Prune expired cache entries.
   */
  public pruneCache(): void {
    if (!this.options.enableCaching) {
      this.clearCache();
      return;
    }
    
    const now = Date.now();
    const expiryTime = this.options.cacheExpiryTime || DEFAULT_OPTIONS.cacheExpiryTime!;
    
    for (const [id, cached] of this.conversationsCache.entries()) {
      // If fully loaded and expired, convert to metadata-only
      if (cached.isFullyLoaded && now - cached.lastAccessed > expiryTime) {
        this.conversationsCache.set(id, {
          conversation: {
            id: cached.conversation.id,
            title: cached.conversation.title,
            createdAt: cached.conversation.createdAt,
            modifiedAt: cached.conversation.modifiedAt,
            messages: []
          },
          isFullyLoaded: false,
          lastAccessed: cached.lastAccessed
        });
      }
    }
  }
  
  /**
   * Generate a unique ID.
   * @returns A unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
}
```

### 2. Create Storage Service for Plugin Integration

Create `src/services/StorageService.ts`:

```typescript
/**
 * Storage service for plugin integration.
 */

import { App } from 'obsidian';
import { StorageManager, StorageManagerOptions } from '../core/StorageManager';
import { SettingsManager } from '../core/SettingsManager';
import { EventBus } from '../core/EventBus';
import { Conversation, Message } from '../models/Conversation';

/**
 * Service class for initializing and managing plugin storage.
 */
export class StorageService {
  private app: App;
  private settings: SettingsManager;
  private eventBus: EventBus;
  private storageManager: StorageManager;
  
  /**
   * Create a new StorageService.
   * @param app Obsidian app instance
   * @param settings Settings manager
   * @param eventBus Event bus
   */
  constructor(app: App, settings: SettingsManager, eventBus: EventBus) {
    this.app = app;
    this.settings = settings;
    this.eventBus = eventBus;
  }
  
  /**
   * Initialize the storage service.
   * @param options Optional configuration options
   * @returns Promise that resolves with the storage manager
   */
  public async initialize(options?: StorageManagerOptions): Promise<StorageManager> {
    // Create storage manager
    this.storageManager = new StorageManager(
      this.app,
      this.settings,
      this.eventBus,
      options
    );
    
    // Initialize storage
    await this.storageManager.initialize();
    
    // Set up cache maintenance
    this.setupCacheMaintenance();
    
    return this.storageManager;
  }
  
  /**
   * Set up cache maintenance.
   */
  private setupCacheMaintenance(): void {
    // Prune cache every 10 minutes
    const pruneInterval = window.setInterval(() => {
      this.storageManager.pruneCache();
    }, 10 * 60 * 1000);
    
    // Register the interval for cleanup
    this.eventBus.on('plugin:unloaded', () => {
      window.clearInterval(pruneInterval);
    });
  }
  
  /**
   * Get the storage manager.
   * @returns The storage manager
   */
  public getStorageManager(): StorageManager {
    return this.storageManager;
  }
  
  /**
   * Get all conversations.
   * @returns Promise that resolves with an array of conversations
   */
  public async getConversations(): Promise<Conversation[]> {
    return this.storageManager.getConversations();
  }
  
  /**
   * Get a conversation by ID.
   * @param id Conversation ID
   * @returns Promise that resolves with the conversation or null if not found
   */
  public async getConversation(id: string): Promise<Conversation | null> {
    return this.storageManager.getConversation(id);
  }
  
  /**
   * Create a new conversation.
   * @param title Optional title for the conversation
   * @returns Promise that resolves with the new conversation
   */
  public async createConversation(title?: string): Promise<Conversation> {
    return this.storageManager.createConversation(title);
  }
  
  /**
   * Delete a conversation.
   * @param id Conversation ID
   * @returns Promise that resolves when the conversation is deleted
   */
  public async deleteConversation(id: string): Promise<void> {
    return this.storageManager.deleteConversation(id);
  }
  
  /**
   * Add a message to a conversation.
   * @param conversationId Conversation ID
   * @param message Message to add
   * @returns Promise that resolves with the updated conversation
   */
  public async addMessage(conversationId: string, message: Message): Promise<Conversation> {
    return this.storageManager.addMessage(conversationId, message);
  }
}
```

### 3. Create Storage Utilities for Common Tasks

Create `src/core/StorageUtils.ts`:

```typescript
/**
 * Utility functions for the storage system.
 */

import { App, TFile, TFolder } from 'obsidian';
import { Conversation, Message, MessageRole } from '../models/Conversation';

/**
 * StorageUtils class for common storage tasks.
 */
export class StorageUtils {
  /**
   * Convert a conversation to Markdown format.
   * @param conversation Conversation to convert
   * @returns Conversation as Markdown
   */
  public static conversationToMarkdown(conversation: Conversation): string {
    let markdown = `# ${conversation.title}\n\n`;
    
    markdown += `- Created: ${new Date(conversation.createdAt).toLocaleString()}\n`;
    markdown += `- Modified: ${new Date(conversation.modifiedAt).toLocaleString()}\n\n`;
    
    if (conversation.metadata) {
      markdown += `## Metadata\n\n`;
      
      for (const [key, value] of Object.entries(conversation.metadata)) {
        markdown += `- ${key}: ${value}\n`;
      }
      
      markdown += '\n';
    }
    
    markdown += `## Conversation\n\n`;
    
    for (const message of conversation.messages) {
      const timestamp = new Date(message.timestamp).toLocaleString();
      const role = message.role.charAt(0).toUpperCase() + message.role.slice(1);
      
      markdown += `### ${role} (${timestamp})\n\n`;
      markdown += `${message.content}\n\n`;
      
      if (message.toolCalls && message.toolCalls.length > 0) {
        markdown += `**Tool Calls:**\n\n`;
        
        for (const toolCall of message.toolCalls) {
          markdown += `- Tool: ${toolCall.name}\n`;
          markdown += `  - Arguments: ${JSON.stringify(toolCall.arguments)}\n`;
          markdown += `  - Status: ${toolCall.status}\n\n`;
        }
      }
      
      if (message.toolResults && message.toolResults.length > 0) {
        markdown += `**Tool Results:**\n\n`;
        
        for (const toolResult of message.toolResults) {
          markdown += `- Tool Call: ${toolResult.toolCallId}\n`;
          
          if (toolResult.error) {
            markdown += `  - Error: ${toolResult.error}\n\n`;
          } else {
            markdown += `  - Content: ${JSON.stringify(toolResult.content)}\n\n`;
          }
        }
      }
    }
    
    return markdown;
  }
  
  /**
   * Create a backup of a conversation in the vault.
   * @param app Obsidian app instance
   * @param conversation Conversation to backup
   * @param backupFolder Folder to store backups
   * @returns Promise that resolves with the path to the backup file
   */
  public static async backupConversation(
    app: App,
    conversation: Conversation,
    backupFolder: string
  ): Promise<string> {
    try {
      // Ensure backup folder exists
      let folder = app.vault.getAbstractFileByPath(backupFolder);
      
      if (!folder) {
        await app.vault.createFolder(backupFolder);
      } else if (!(folder instanceof TFolder)) {
        throw new Error(`${backupFolder} exists but is not a folder`);
      }
      
      // Create backup filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safeTitle = conversation.title
        .replace(/[^a-zA-Z0-9]/g, '-')
        .replace(/--+/g, '-')
        .slice(0, 50);
      const filename = `${backupFolder}/${safeTitle}-${timestamp}.json`;
      
      // Create backup file
      await app.vault.create(filename, JSON.stringify(conversation, null, 2));
      
      return filename;
    } catch (error) {
      console.error(`Failed to backup conversation: ${error}`);
      throw error;
    }
  }
  
  /**
   * Export a conversation to an external file.
   * @param app Obsidian app instance
   * @param conversation Conversation to export
   * @param format Export format ('json' or 'markdown')
   * @returns Promise that resolves when the export is complete
   */
  public static async exportConversationToFile(
    app: App,
    conversation: Conversation,
    format: 'json' | 'markdown'
  ): Promise<void> {
    try {
      // Create filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safeTitle = conversation.title
        .replace(/[^a-zA-Z0-9]/g, '-')
        .replace(/--+/g, '-')
        .slice(0, 50);
      const extension = format === 'json' ? 'json' : 'md';
      const filename = `${safeTitle}-${timestamp}.${extension}`;
      
      // Create content
      const content = format === 'json'
        ? JSON.stringify(conversation, null, 2)
        : this.conversationToMarkdown(conversation);
      
      // Create temporary file
      const tempFilePath = `${app.vault.configDir}/tmp/${filename}`;
      const tempFile = await app.vault.create(tempFilePath, content);
      
      // Show save dialog
      // This would typically use Electron to show a file save dialog,
      // but since we're in Obsidian, we'll use a different approach
      
      // For now, create a notice to let the user know where the file was saved
      const notice = new (app as any).Notice(
        `Exported to ${tempFilePath}. Copy this file to your desired location.`,
        10000 // 10 seconds
      );
      
      // Add a button to open the file
      notice.noticeEl.createEl('button', {
        text: 'Open File',
        cls: 'mod-cta'
      }, (button) => {
        button.onclick = () => {
          app.workspace.openLinkText(tempFilePath, '', true);
        };
      });
    } catch (error) {
      console.error(`Failed to export conversation: ${error}`);
      throw error;
    }
  }
  
  /**
   * Parse Markdown into a conversation.
   * @param markdown Markdown content
   * @returns Parsed conversation
   */
  public static parseMarkdownToConversation(markdown: string): Conversation {
    try {
      const lines = markdown.split('\n');
      const conversation: Conversation = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2),
        title: 'Imported Conversation',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        messages: []
      };
      
      let currentRole: MessageRole | null = null;
      let currentContent = '';
      let currentMessage: Partial<Message> | null = null;
      
      // Extract title from first heading
      const titleMatch = markdown.match(/^# (.+)$/m);
      if (titleMatch) {
        conversation.title = titleMatch[1];
      }
      
      // Process lines
      for (const line of lines) {
        const roleMatch = line.match(/^### (User|Assistant|System)/i);
        
        if (roleMatch) {
          // Save previous message if exists
          if (currentMessage && currentContent.trim()) {
            conversation.messages.push({
              id: Date.now().toString(36) + Math.random().toString(36).substring(2),
              role: currentRole!,
              content: currentContent.trim(),
              timestamp: Date.now() - (conversation.messages.length * 1000)
            });
          }
          
          // Start new message
          currentRole = roleMatch[1].toLowerCase() as MessageRole;
          currentContent = '';
          currentMessage = { role: currentRole };
        } else if (currentMessage) {
          // Add line to current message
          currentContent += line + '\n';
        }
      }
      
      // Add final message if exists
      if (currentMessage && currentContent.trim()) {
        conversation.messages.push({
          id: Date.now().toString(36) + Math.random().toString(36).substring(2),
          role: currentRole!,
          content: currentContent.trim(),
          timestamp: Date.now() - (conversation.messages.length * 1000)
        });
      }
      
      return conversation;
    } catch (error) {
      console.error(`Failed to parse Markdown to conversation: ${error}`);
      throw error;
    }
  }
}
```

### 4. Add Storage Error Handling

Create `src/core/StorageErrors.ts`:

```typescript
/**
 * Custom error classes for the storage system.
 */

/**
 * Base error class for storage errors.
 */
export class StorageError extends Error {
  /**
   * Create a new StorageError.
   * @param message Error message
   */
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Error when a conversation is not found.
 */
export class ConversationNotFoundError extends StorageError {
  /**
   * Conversation ID.
   */
  public conversationId: string;
  
  /**
   * Create a new ConversationNotFoundError.
   * @param conversationId Conversation ID
   */
  constructor(conversationId: string) {
    super(`Conversation ${conversationId} not found`);
    this.name = 'ConversationNotFoundError';
    this.conversationId = conversationId;
  }
}

/**
 * Error when a message is not found.
 */
export class MessageNotFoundError extends StorageError {
  /**
   * Conversation ID.
   */
  public conversationId: string;
  
  /**
   * Message ID.
   */
  public messageId: string;
  
  /**
   * Create a new MessageNotFoundError.
   * @param conversationId Conversation ID
   * @param messageId Message ID
   */
  constructor(conversationId: string, messageId: string) {
    super(`Message ${messageId} not found in conversation ${conversationId}`);
    this.name = 'MessageNotFoundError';
    this.conversationId = conversationId;
    this.messageId = messageId;
  }
}

/**
 * Error when a folder operation fails.
 */
export class FolderOperationError extends StorageError {
  /**
   * Path to the folder.
   */
  public path: string;
  
  /**
   * Create a new FolderOperationError.
   * @param path Path to the folder
   * @param message Error message
   */
  constructor(path: string, message: string) {
    super(`Folder operation failed for ${path}: ${message}`);
    this.name = 'FolderOperationError';
    this.path = path;
  }
}

/**
 * Error when a file operation fails.
 */
export class FileOperationError extends StorageError {
  /**
   * Path to the file.
   */
  public path: string;
  
  /**
   * Create a new FileOperationError.
   * @param path Path to the file
   * @param message Error message
   */
  constructor(path: string, message: string) {
    super(`File operation failed for ${path}: ${message}`);
    this.name = 'FileOperationError';
    this.path = path;
  }
}

/**
 * Error when parsing JSON fails.
 */
export class JsonParseError extends StorageError {
  /**
   * Create a new JsonParseError.
   * @param message Error message
   */
  constructor(message: string) {
    super(`Failed to parse JSON: ${message}`);
    this.name = 'JsonParseError';
  }
}

/**
 * Error when importing/exporting fails.
 */
export class ImportExportError extends StorageError {
  /**
   * Create a new ImportExportError.
   * @param message Error message
   */
  constructor(message: string) {
    super(`Import/export operation failed: ${message}`);
    this.name = 'ImportExportError';
  }
}
```

### 5. Write Tests for Storage Manager

Create `tests/core/StorageManager.test.ts`:

```typescript
import { App, TFile, TFolder } from 'obsidian';
import { StorageManager } from '../../src/core/StorageManager';
import { SettingsManager } from '../../src/core/SettingsManager';
import { EventBus } from '../../src/core/EventBus';
import { Conversation, Message, MessageRole } from '../../src/models/Conversation';

// Mock Obsidian App
class MockApp {
  vault: any;
  
  constructor() {
    this.vault = {
      getAbstractFileByPath: jest.fn(),
      createFolder: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockResolvedValue({ path: 'test.json' }),
      read: jest.fn(),
      modify: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined)
    };
  }
}

describe('StorageManager', () => {
  let app: MockApp;
  let settings: SettingsManager;
  let eventBus: EventBus;
  let storageManager: StorageManager;
  
  beforeEach(() => {
    app = new MockApp();
    eventBus = new EventBus();
    settings = {
      getConversationsPath: jest.fn().mockReturnValue('.chatsidian/conversations')
    } as unknown as SettingsManager;
    
    storageManager = new StorageManager(
      app as unknown as App,
      settings,
      eventBus
    );
  });
  
  test('should initialize successfully', async () => {
    // Mock folder not found, then create
    app.vault.getAbstractFileByPath.mockReturnValue(null);
    
    await storageManager.initialize();
    
    expect(app.vault.getAbstractFileByPath).toHaveBeenCalledWith('.chatsidian/conversations');
    expect(app.vault.createFolder).toHaveBeenCalledWith('.chatsidian/conversations');
  });
  
  test('should load conversation index', async () => {
    // Mock folder with files
    const mockFolder = {
      children: [
        { basename: 'conv1', extension: 'json', stat: { ctime: 100, mtime: 200 } },
        { basename: 'conv2', extension: 'json', stat: { ctime: 300, mtime: 400 } },
        { basename: 'not-a-json', extension: 'txt', stat: { ctime: 500, mtime: 600 } }
      ]
    };
    mockFolder.children.forEach(child => {
      child.__proto__ = TFile.prototype;
    });
    mockFolder.__proto__ = TFolder.prototype;
    
    app.vault.getAbstractFileByPath.mockReturnValue(mockFolder);
    
    await storageManager.initialize();
    
    const conversations = await storageManager.getConversations();
    
    expect(conversations).toHaveLength(2);
    expect(conversations[0].id).toBe('conv2'); // Sorted by modifiedAt
    expect(conversations[1].id).toBe('conv1');
  });
  
  test('should get conversation', async () => {
    // Mock file
    const mockFile = {
      __proto__: TFile.prototype,
      basename: 'conv1',
      extension: 'json'
    };
    
    // Mock vault.read to return conversation JSON
    const mockConversation: Conversation = {
      id: 'conv1',
      title: 'Test Conversation',
      createdAt: 100,
      modifiedAt: 200,
      messages: []
    };
    
    app.vault.getAbstractFileByPath.mockReturnValue(mockFile);
    app.vault.read.mockResolvedValue(JSON.stringify(mockConversation));
    
    await storageManager.initialize();
    
    const conversation = await storageManager.getConversation('conv1');
    
    expect(conversation).not.toBeNull();
    expect(conversation!.id).toBe('conv1');
    expect(conversation!.title).toBe('Test Conversation');
    
    // Check that it was cached
    const cachedConversation = await storageManager.getConversation('conv1');
    expect(app.vault.read).toHaveBeenCalledTimes(1); // Should not read again
  });
  
  test('should save conversation', async () => {
    // Mock file not found, then create
    app.vault.getAbstractFileByPath.mockReturnValue(null);
    
    const conversation: Conversation = {
      id: 'conv1',
      title: 'Test Conversation',
      createdAt: 100,
      modifiedAt: 200,
      messages: []
    };
    
    await storageManager.initialize();
    await storageManager.saveConversation(conversation);
    
    expect(app.vault.create).toHaveBeenCalledWith(
      '.chatsidian/conversations/conv1.json',
      expect.any(String)
    );
    
    // Check event was emitted
    const handler = jest.fn();
    eventBus.on('conversation:saved', handler);
    
    await storageManager.saveConversation(conversation);
    
    expect(handler).toHaveBeenCalledWith(conversation);
  });
  
  test('should create conversation', async () => {
    // Mock file not found, then create
    app.vault.getAbstractFileByPath.mockReturnValue(null);
    
    await storageManager.initialize();
    
    const conversation = await storageManager.createConversation('New Conversation');
    
    expect(conversation.title).toBe('New Conversation');
    expect(conversation.messages).toHaveLength(0);
    expect(app.vault.create).toHaveBeenCalled();
    
    // Check event was emitted
    const handler = jest.fn();
    eventBus.on('conversation:created', handler);
    
    await storageManager.createConversation('Another Conversation');
    
    expect(handler).toHaveBeenCalled();
  });
  
  test('should delete conversation', async () => {
    // Mock file
    const mockFile = {
      __proto__: TFile.prototype,
      basename: 'conv1',
      extension: 'json'
    };
    
    app.vault.getAbstractFileByPath.mockReturnValue(mockFile);
    
    await storageManager.initialize();
    await storageManager.deleteConversation('conv1');
    
    expect(app.vault.delete).toHaveBeenCalledWith(mockFile);
    
    // Check event was emitted
    const handler = jest.fn();
    eventBus.on('conversation:deleted', handler);
    
    await storageManager.deleteConversation('conv1');
    
    expect(handler).toHaveBeenCalledWith('conv1');
  });
  
  test('should add message to conversation', async () => {
    // Mock conversation
    const mockConversation: Conversation = {
      id: 'conv1',
      title: 'Test Conversation',
      createdAt: 100,
      modifiedAt: 200,
      messages: []
    };
    
    // Mock getConversation
    jest.spyOn(storageManager, 'getConversation').mockResolvedValue(mockConversation);
    
    // Mock saveConversation
    jest.spyOn(storageManager, 'saveConversation').mockResolvedValue();
    
    await storageManager.initialize();
    
    const message: Message = {
      id: 'msg1',
      role: MessageRole.User,
      content: 'Hello, world!',
      timestamp: 300
    };
    
    await storageManager.addMessage('conv1', message);
    
    expect(storageManager.getConversation).toHaveBeenCalledWith('conv1');
    expect(storageManager.saveConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'conv1',
        messages: [message]
      })
    );
    
    // Check event was emitted
    const handler = jest.fn();
    eventBus.on('message:added', handler);
    
    await storageManager.addMessage('conv1', message);
    
    expect(handler).toHaveBeenCalledWith({
      conversationId: 'conv1',
      message
    });
  });
  
  test('should update conversation metadata', async () => {
    // Mock conversation
    const mockConversation: Conversation = {
      id: 'conv1',
      title: 'Test Conversation',
      createdAt: 100,
      modifiedAt: 200,
      messages: []
    };
    
    // Mock getConversation
    jest.spyOn(storageManager, 'getConversation').mockResolvedValue(mockConversation);
    
    // Mock saveConversation
    jest.spyOn(storageManager, 'saveConversation').mockResolvedValue();
    
    await storageManager.initialize();
    
    await storageManager.updateConversationMetadata('conv1', {
      title: 'Updated Title',
      metadata: { tags: ['test'] }
    });
    
    expect(storageManager.saveConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'conv1',
        title: 'Updated Title',
        metadata: { tags: ['test'] }
      })
    );
    
    // Check event was emitted
    const handler = jest.fn();
    eventBus.on('conversation:updated', handler);
    
    await storageManager.updateConversationMetadata('conv1', {
      title: 'Another Title'
    });
    
    expect(handler).toHaveBeenCalled();
  });
  
  test('should handle settings change', async () => {
    // Mock folder
    app.vault.getAbstractFileByPath.mockReturnValue({
      __proto__: TFolder.prototype,
      children: []
    });
    
    await storageManager.initialize();
    
    // Spy on methods
    jest.spyOn(storageManager, 'clearCache');
    jest.spyOn(storageManager, 'initialize').mockResolvedValue();
    
    // Emit settings changed event
    await eventBus.emitAsync('settings:updated', {
      previousSettings: { conversationsFolder: '.chatsidian/conversations' },
      currentSettings: { conversationsFolder: '.chatsidian/new-folder' },
      changedKeys: ['conversationsFolder']
    });
    
    // Should clear cache and reinitialize
    expect(settings.getConversationsPath).toHaveBeenCalled();
  });
});
```

### 6. Create Integration Test for Storage Service

Create `tests/services/StorageService.test.ts`:

```typescript
import { App } from 'obsidian';
import { StorageService } from '../../src/services/StorageService';
import { SettingsManager } from '../../src/core/SettingsManager';
import { EventBus } from '../../src/core/EventBus';
import { StorageManager } from '../../src/core/StorageManager';

describe('StorageService', () => {
  let app: Partial<App>;
  let settings: SettingsManager;
  let eventBus: EventBus;
  let storageService: StorageService;
  
  beforeEach(() => {
    app = {
      vault: {
        getAbstractFileByPath: jest.fn().mockReturnValue(null),
        createFolder: jest.fn().mockResolvedValue(undefined)
      }
    };
    
    eventBus = new EventBus();
    settings = {
      getConversationsPath: jest.fn().mockReturnValue('.chatsidian/conversations')
    } as unknown as SettingsManager;
    
    storageService = new StorageService(
      app as App,
      settings,
      eventBus
    );
  });
  
  test('should initialize', async () => {
    // Mock StorageManager
    jest.spyOn(StorageManager.prototype, 'initialize').mockResolvedValue();
    
    const storageManager = await storageService.initialize();
    
    expect(storageManager).toBeInstanceOf(StorageManager);
    expect(StorageManager.prototype.initialize).toHaveBeenCalled();
  });
  
  test('should get storage manager', async () => {
    // Mock StorageManager
    jest.spyOn(StorageManager.prototype, 'initialize').mockResolvedValue();
    
    await storageService.initialize();
    
    const storageManager = storageService.getStorageManager();
    
    expect(storageManager).toBeInstanceOf(StorageManager);
  });
  
  test('should set up cache maintenance', async () => {
    // Mock window.setInterval
    const originalSetInterval = window.setInterval;
    const mockSetInterval = jest.fn().mockReturnValue(123);
    window.setInterval = mockSetInterval;
    
    // Mock StorageManager
    jest.spyOn(StorageManager.prototype, 'initialize').mockResolvedValue();
    jest.spyOn(StorageManager.prototype, 'pruneCache').mockImplementation(() => {});
    
    await storageService.initialize();
    
    // Should set up interval
    expect(mockSetInterval).toHaveBeenCalled();
    
    // Reset window.setInterval
    window.setInterval = originalSetInterval;
  });
  
  test('should clean up on plugin unload', async () => {
    // Mock window.setInterval and clearInterval
    const originalSetInterval = window.setInterval;
    const originalClearInterval = window.clearInterval;
    const mockSetInterval = jest.fn().mockReturnValue(123);
    const mockClearInterval = jest.fn();
    window.setInterval = mockSetInterval;
    window.clearInterval = mockClearInterval;
    
    // Mock StorageManager
    jest.spyOn(StorageManager.prototype, 'initialize').mockResolvedValue();
    
    await storageService.initialize();
    
    // Emit plugin unloaded event
    await eventBus.emitAsync('plugin:unloaded', undefined);
    
    // Should clear interval
    expect(mockClearInterval).toHaveBeenCalledWith(123);
    
    // Reset window functions
    window.setInterval = originalSetInterval;
    window.clearInterval = originalClearInterval;
  });
  
  test('should delegate to storage manager', async () => {
    // Mock StorageManager methods
    const mockStorageManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getConversations: jest.fn().mockResolvedValue([]),
      getConversation: jest.fn().mockResolvedValue(null),
      createConversation: jest.fn().mockResolvedValue({ id: 'conv1' }),
      deleteConversation: jest.fn().mockResolvedValue(undefined),
      addMessage: jest.fn().mockResolvedValue({ id: 'conv1' })
    };
    
    // Mock constructor
    jest.spyOn(StorageManager.prototype, 'initialize').mockResolvedValue();
    jest.spyOn(StorageService.prototype, 'getStorageManager').mockReturnValue(
      mockStorageManager as unknown as StorageManager
    );
    
    await storageService.initialize();
    
    // Test delegation methods
    await storageService.getConversations();
    expect(mockStorageManager.getConversations).toHaveBeenCalled();
    
    await storageService.getConversation('conv1');
    expect(mockStorageManager.getConversation).toHaveBeenCalledWith('conv1');
    
    await storageService.createConversation('Test');
    expect(mockStorageManager.createConversation).toHaveBeenCalledWith('Test');
    
    await storageService.deleteConversation('conv1');
    expect(mockStorageManager.deleteConversation).toHaveBeenCalledWith('conv1');
    
    await storageService.addMessage('conv1', { id: 'msg1' } as any);
    expect(mockStorageManager.addMessage).toHaveBeenCalledWith('conv1', { id: 'msg1' });
  });
});
```

## Integration Example

```typescript
// In plugin main.ts
import { Plugin } from 'obsidian';
import { EventBus } from './core/EventBus';
import { SettingsService } from './services/SettingsService';
import { StorageService } from './services/StorageService';

export default class ChatsidianPlugin extends Plugin {
  public settings: SettingsManager;
  public storage: StorageManager;
  public eventBus: EventBus;
  private settingsService: SettingsService;
  private storageService: StorageService;
  
  async onload() {
    console.log('Loading Chatsidian plugin');
    
    // Initialize event bus
    this.eventBus = new EventBus();
    
    // Initialize settings
    this.settingsService = new SettingsService(this.app, this, this.eventBus);
    this.settings = await this.settingsService.initialize(await this.loadData());
    
    // Initialize storage
    this.storageService = new StorageService(this.app, this.settings, this.eventBus);
    this.storage = await this.storageService.initialize();
    
    // Example: Create a new conversation
    try {
      const conversation = await this.storage.createConversation('Test Conversation');
      console.log('Created conversation:', conversation.id);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
    
    console.log('Chatsidian plugin loaded');
  }
  
  async onunload() {
    console.log('Unloading Chatsidian plugin');
    
    // Emit plugin unloaded event for cleanup
    await this.eventBus.emitAsync('plugin:unloaded', undefined);
  }
}
```

## References

- [[💻 Coding/Documentation/Obsidian/Plugin - Documentation.md]] - Obsidian Plugin API documentation
- [[💻 Coding/Documentation/Obsidian/TAbstractFile - Documentation.md]] - Obsidian file system documentation

## Next Steps

After completing this microphase, proceed to:
- [[💻 Coding/Projects/Chatsidian/3_Implementation/Phase1.6-Provider-Adapters.md]] - Building the provider adapter pattern for AI API connections
