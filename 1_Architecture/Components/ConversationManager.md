---
title: Conversation Manager Component Design
description: Detailed design for the Conversation Manager component of the Chatsidian plugin
date: 2025-05-03
status: planning
tags:
  - architecture
  - component-design
  - conversation-management
  - persistence
---

# Conversation Manager Component Design

## Component Overview

The Conversation Manager component is responsible for creating, storing, retrieving, and managing conversations within the Chatsidian plugin. It provides persistence for chat history, handles conversation metadata, and manages the current active conversation state.

## Key Responsibilities

- Creating and initializing new conversations
- Loading and saving conversations to/from disk
- Managing conversation metadata (title, creation date, last modified)
- Tracking the current active conversation
- Adding messages to conversations
- Handling message metadata and relationships
- Managing conversation context windows
- Providing conversation search and filtering

## Internal Structure

### Classes

#### `ConversationManager`

Main class that handles all conversation-related operations.

```typescript
// src/core/ConversationManager.ts
import { App, TFolder, TFile } from 'obsidian';
import { EventBus } from './EventBus';
import { SettingsManager } from './SettingsManager';
import { Conversation, Message, MessageRole } from '../models/Conversation';

export class ConversationManager {
  private app: App;
  private settings: SettingsManager;
  private eventBus: EventBus;
  private conversations: Map<string, Conversation> = new Map();
  private currentConversationId: string | null = null;
  private conversationsFolder: TFolder;
  
  constructor(app: App, settings: SettingsManager, eventBus: EventBus) {
    this.app = app;
    this.settings = settings;
    this.eventBus = eventBus;
    
    // Register event handlers
    this.registerEvents();
  }
  
  // Initialize conversation storage
  public async initialize(): Promise<void> {
    // Create conversations folder if it doesn't exist
    await this.ensureConversationsFolder();
    
    // Load conversation index
    await this.loadConversationIndex();
    
    // Load most recent conversation if available
    const recentId = this.settings.getRecentConversationId();
    if (recentId) {
      await this.loadConversation(recentId);
    }
  }
  
  // Create a new conversation
  public async createNewConversation(title?: string): Promise<Conversation> {
    const id = this.generateId();
    const now = Date.now();
    
    const conversation: Conversation = {
      id,
      title: title || `New Chat ${new Date(now).toLocaleString()}`,
      createdAt: now,
      modifiedAt: now,
      messages: []
    };
    
    // Add to cache
    this.conversations.set(id, conversation);
    
    // Save to disk
    await this.saveConversation(conversation);
    
    // Set as current
    this.setCurrentConversation(id);
    
    // Emit event
    this.eventBus.emit('conversation:created', conversation);
    
    return conversation;
  }
  
  // Load a conversation by ID
  public async loadConversation(id: string): Promise<Conversation | null> {
    // Check cache first
    if (this.conversations.has(id)) {
      this.setCurrentConversation(id);
      return this.conversations.get(id);
    }
    
    // Try to load from disk
    try {
      const conversation = await this.loadConversationFromDisk(id);
      
      if (conversation) {
        // Add to cache
        this.conversations.set(id, conversation);
        
        // Set as current
        this.setCurrentConversation(id);
        
        // Emit event
        this.eventBus.emit('conversation:loaded', conversation);
        
        return conversation;
      }
    } catch (error) {
      console.error(`Error loading conversation ${id}:`, error);
    }
    
    return null;
  }
  
  // Get the current conversation
  public getCurrentConversation(): Conversation | null {
    if (!this.currentConversationId) return null;
    return this.conversations.get(this.currentConversationId) || null;
  }
  
  // Add a user message to the current conversation
  public async addUserMessage(content: string): Promise<Message> {
    const conversation = this.getCurrentConversation();
    if (!conversation) {
      throw new Error('No active conversation');
    }
    
    return this.addMessage(conversation.id, {
      role: MessageRole.User,
      content
    });
  }
  
  // Add a message to a conversation
  public async addMessage(conversationId: string, message: Partial<Message>): Promise<Message> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }
    
    // Create full message object
    const fullMessage: Message = {
      id: this.generateId(),
      role: message.role || MessageRole.User,
      content: message.content || '',
      timestamp: Date.now(),
      ...(message.toolCalls && { toolCalls: message.toolCalls }),
      ...(message.toolResults && { toolResults: message.toolResults })
    };
    
    // Add to conversation
    conversation.messages.push(fullMessage);
    
    // Update modification time
    conversation.modifiedAt = Date.now();
    
    // Save conversation
    await this.saveConversation(conversation);
    
    // Emit event
    this.eventBus.emit('conversation:messageAdded', {
      conversationId,
      message: fullMessage
    });
    
    return fullMessage;
  }
  
  // Add a tool result to a message
  public async addToolResult(
    conversationId: string,
    messageId: string,
    toolCallId: string,
    result: any,
    error?: string
  ): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }
    
    // Find message
    const message = conversation.messages.find(m => m.id === messageId);
    if (!message) {
      throw new Error(`Message ${messageId} not found in conversation ${conversationId}`);
    }
    
    // Ensure toolResults array exists
    if (!message.toolResults) {
      message.toolResults = [];
    }
    
    // Add tool result
    message.toolResults.push({
      id: this.generateId(),
      toolCallId,
      content: result,
      ...(error && { error })
    });
    
    // Update modification time
    conversation.modifiedAt = Date.now();
    
    // Save conversation
    await this.saveConversation(conversation);
    
    // Emit event
    this.eventBus.emit('conversation:toolResultAdded', {
      conversationId,
      messageId,
      toolCallId,
      result
    });
  }
  
  // Delete a conversation
  public async deleteConversation(id: string): Promise<void> {
    // Check if conversation exists
    if (!this.conversations.has(id)) {
      throw new Error(`Conversation ${id} not found`);
    }
    
    // Get reference before removal
    const conversation = this.conversations.get(id);
    
    // Remove from cache
    this.conversations.delete(id);
    
    // Delete file
    const filePath = this.getConversationFilePath(id);
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file && file instanceof TFile) {
      await this.app.vault.delete(file);
    }
    
    // If this was the current conversation, set to null
    if (this.currentConversationId === id) {
      this.currentConversationId = null;
      this.settings.setRecentConversationId(null);
    }
    
    // Emit event
    this.eventBus.emit('conversation:deleted', id);
  }
  
  // Update conversation metadata
  public async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation> {
    // Check if conversation exists
    if (!this.conversations.has(id)) {
      throw new Error(`Conversation ${id} not found`);
    }
    
    // Get conversation
    const conversation = this.conversations.get(id);
    
    // Apply updates
    if (updates.title) conversation.title = updates.title;
    
    // Update modification time
    conversation.modifiedAt = Date.now();
    
    // Save conversation
    await this.saveConversation(conversation);
    
    // Emit event
    this.eventBus.emit('conversation:updated', conversation);
    
    return conversation;
  }
  
  // Get all conversations
  public getAllConversations(): Conversation[] {
    return Array.from(this.conversations.values())
      .sort((a, b) => b.modifiedAt - a.modifiedAt);
  }
  
  // Private methods
  private async ensureConversationsFolder(): Promise<void> {
    const folderPath = this.settings.getConversationsFolderPath();
    
    // Check if folder exists
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!folder) {
      // Create folder
      this.conversationsFolder = await this.app.vault.createFolder(folderPath);
    } else if (folder instanceof TFolder) {
      this.conversationsFolder = folder;
    } else {
      throw new Error(`${folderPath} exists but is not a folder`);
    }
  }
  
  private async loadConversationIndex(): Promise<void> {
    // Get all files in conversations folder
    const folderPath = this.settings.getConversationsFolderPath();
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    
    if (folder && folder instanceof TFolder) {
      // Load metadata for all conversation files
      for (const file of folder.children) {
        if (file instanceof TFile && file.extension === 'json') {
          // Extract ID from filename
          const id = file.basename;
          
          // Add to cache with lazy loading
          this.conversations.set(id, {
            id,
            title: id,
            createdAt: file.stat.ctime,
            modifiedAt: file.stat.mtime,
            messages: [],
            _isLoaded: false
          } as any);
        }
      }
    }
  }
  
  private async loadConversationFromDisk(id: string): Promise<Conversation | null> {
    const filePath = this.getConversationFilePath(id);
    const file = this.app.vault.getAbstractFileByPath(filePath);
    
    if (!file || !(file instanceof TFile)) {
      return null;
    }
    
    // Read file content
    const content = await this.app.vault.read(file);
    
    // Parse JSON
    try {
      const conversation = JSON.parse(content);
      conversation._isLoaded = true;
      return conversation;
    } catch (error) {
      console.error(`Error parsing conversation ${id}:`, error);
      return null;
    }
  }
  
  private async saveConversation(conversation: Conversation): Promise<void> {
    const filePath = this.getConversationFilePath(conversation.id);
    
    // Prepare content
    const content = JSON.stringify(conversation, null, 2);
    
    // Check if file exists
    const file = this.app.vault.getAbstractFileByPath(filePath);
    
    if (file && file instanceof TFile) {
      // Update existing file
      await this.app.vault.modify(file, content);
    } else {
      // Create new file
      await this.app.vault.create(filePath, content);
    }
  }
  
  private getConversationFilePath(id: string): string {
    return `${this.settings.getConversationsFolderPath()}/${id}.json`;
  }
  
  private setCurrentConversation(id: string): void {
    this.currentConversationId = id;
    this.settings.setRecentConversationId(id);
    this.eventBus.emit('conversation:switched', id);
  }
  
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
  
  private registerEvents(): void {
    this.eventBus.on('conversation:addMessage', this.handleAddMessage.bind(this));
    this.eventBus.on('conversation:addToolResult', this.handleAddToolResult.bind(this));
    this.eventBus.on('conversation:update', this.handleUpdateConversation.bind(this));
    this.eventBus.on('conversation:delete', this.handleDeleteConversation.bind(this));
  }
  
  private async handleAddMessage(data: any): Promise<Message> {
    return await this.addMessage(data.conversationId, data);
  }
  
  private async handleAddToolResult(data: any): Promise<void> {
    await this.addToolResult(
      data.conversationId,
      data.messageId,
      data.toolCallId,
      data.result,
      data.error
    );
  }
  
  private async handleUpdateConversation(data: any): Promise<Conversation> {
    return await this.updateConversation(data.id, data.updates);
  }
  
  private async handleDeleteConversation(id: string): Promise<void> {
    await this.deleteConversation(id);
  }
}
```

### Models

#### `Conversation` Model

```typescript
// src/models/Conversation.ts
export enum MessageRole {
  User = 'user',
  Assistant = 'assistant',
  System = 'system'
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: any;
  status: 'pending' | 'success' | 'error';
}

export interface ToolResult {
  id: string;
  toolCallId: string;
  content: any;
  error?: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  modifiedAt: number;
  messages: Message[];
  
  // Internal flag for lazy loading
  _isLoaded?: boolean;
}
```

## Conversation Storage Format

Conversations are stored as JSON files within a dedicated folder in the vault:

```
[vault]/.chatsidian/conversations/
  [conversation-id-1].json
  [conversation-id-2].json
  ...
```

### JSON Format

```json
{
  "id": "abcd1234",
  "title": "Research on Bounded Context Packs",
  "createdAt": 1714590000000,
  "modifiedAt": 1714593000000,
  "messages": [
    {
      "id": "msg1",
      "role": "user",
      "content": "What are Bounded Context Packs?",
      "timestamp": 1714590000000
    },
    {
      "id": "msg2",
      "role": "assistant",
      "content": "Bounded Context Packs (BCPs) are a pattern for organizing tool capabilities in AI applications...",
      "timestamp": 1714590005000,
      "toolCalls": [
        {
          "id": "tool1",
          "name": "NoteReader.readNote",
          "arguments": {
            "path": "some/path/to/note.md"
          },
          "status": "success"
        }
      ],
      "toolResults": [
        {
          "id": "result1",
          "toolCallId": "tool1",
          "content": {
            "path": "some/path/to/note.md",
            "content": "Note content here..."
          }
        }
      ]
    }
  ]
}
```

## Optimization Strategies

### Lazy Loading

Conversations are lazy-loaded to improve performance with many conversations:

1. During initialization, only metadata is loaded (ID, title, creation/modification times)
2. Full conversation content is loaded only when explicitly requested
3. This reduces memory usage and startup time

### Conversation Pruning

To manage memory usage:

1. Keep only a configurable number of conversations in memory
2. Prune least recently used conversations when limit is reached
3. Write changes to disk before removing from memory

### Context Window Management

For very long conversations:

1. Track token usage for context window management
2. Implement message summarization for long conversations
3. Provide options to truncate or selectively include messages for new requests

## Integration with Other Components

### Settings Manager

- Stores user preferences for conversation management
- Configures conversations folder path
- Remembers most recent conversation

### Event Bus

- Notifies UI of conversation changes
- Receives requests for conversation operations
- Coordinates between components

### MCP Connector

- Receives conversation context for API requests
- Adds AI responses to conversations
- Adds tool calls and results to messages

### Chat Interface

- Displays conversation messages
- Handles user input for new messages
- Provides conversation selection UI

## Error Handling

1. **File I/O Errors**
   - Handle file read/write failures
   - Implement auto-recovery and backups
   - Log errors with context

2. **Parsing Errors**
   - Handle corrupted conversation files
   - Provide data recovery options
   - Validate data structure during load

3. **Concurrency Issues**
   - Handle concurrent modifications
   - Implement versioning or locking if needed
   - Resolve conflicts gracefully

## Performance Considerations

1. **Memory Management**
   - Implement lazy loading for conversation content
   - Limit the number of conversations kept in memory
   - Optimize JSON serialization/deserialization

2. **File Operations**
   - Use async file operations to avoid blocking UI
   - Implement batching for multiple operations
   - Consider debouncing for frequent saves

3. **Large Conversations**
   - Handle conversations with many messages efficiently
   - Implement pagination or virtualization for rendering
   - Support context window management

## Testing Approach

1. **Unit Tests**
   - Test conversation creation, loading, and saving
   - Verify message management functions
   - Test error handling

2. **Integration Tests**
   - Test interaction with file system
   - Verify event handling with other components
   - Test conversation switching

3. **Performance Tests**
   - Test with large conversations
   - Measure load times and memory usage
   - Verify lazy loading effectiveness

## Future Enhancements

1. **Conversation Search**
   - Implement full-text search across conversations
   - Add filtering by date, content, or tools used
   - Provide search results highlighting

2. **Export/Import**
   - Support exporting conversations to Markdown
   - Enable importing conversations from external sources
   - Implement conversation sharing

3. **Tagging and Organization**
   - Add support for tagging conversations
   - Implement conversation folders or categories
   - Add favorites or pinning functionality

4. **Conversation Templates**
   - Support saving conversations as templates
   - Implement template selection for new conversations
   - Pre-populate conversations with system prompts

5. **Advanced Context Management**
   - Implement summarization for long conversations
   - Add semantic chunking for context optimization
   - Support user-controlled context management