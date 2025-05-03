---
title: Chatsidian Data Models Documentation
description: Documentation for the data models used in the Chatsidian plugin
date: 2025-05-03
status: planning
tags:
  - documentation
  - data-models
  - schema
  - persistence
---

# Chatsidian Data Models Documentation

## Overview

This document describes the data models used throughout the Chatsidian plugin. These models define the structure of conversations, messages, settings, and other persistent data within the plugin.

## Core Data Models

### Conversation Model

The Conversation model represents a chat conversation with an AI assistant.

```typescript
export interface Conversation {
  /**
   * Unique identifier for the conversation
   */
  id: string;
  
  /**
   * Human-readable title for the conversation
   */
  title: string;
  
  /**
   * Timestamp when the conversation was created (milliseconds since epoch)
   */
  createdAt: number;
  
  /**
   * Timestamp when the conversation was last modified (milliseconds since epoch)
   */
  modifiedAt: number;
  
  /**
   * Array of messages in the conversation
   */
  messages: Message[];
  
  /**
   * Optional metadata for the conversation
   */
  metadata?: {
    /**
     * Tags for categorizing the conversation
     */
    tags?: string[];
    
    /**
     * Whether the conversation is starred/favorited
     */
    starred?: boolean;
    
    /**
     * Custom properties for the conversation
     */
    [key: string]: any;
  };
  
  /**
   * Internal flag for lazy loading (not serialized)
   * @internal
   */
  _isLoaded?: boolean;
}
```

#### JSON Representation

```json
{
  "id": "abcd1234",
  "title": "Research on Bounded Context Packs",
  "createdAt": 1714590000000,
  "modifiedAt": 1714593000000,
  "messages": [...],
  "metadata": {
    "tags": ["research", "architecture"],
    "starred": true
  }
}
```

### Message Model

The Message model represents a single message in a conversation.

```typescript
/**
 * Possible roles for a message
 */
export enum MessageRole {
  /**
   * Message from the user
   */
  User = 'user',
  
  /**
   * Message from the AI assistant
   */
  Assistant = 'assistant',
  
  /**
   * System message (notifications, errors, etc.)
   */
  System = 'system'
}

export interface Message {
  /**
   * Unique identifier for the message
   */
  id: string;
  
  /**
   * Role of the message sender
   */
  role: MessageRole;
  
  /**
   * Message content (text)
   */
  content: string;
  
  /**
   * Timestamp when the message was created (milliseconds since epoch)
   */
  timestamp: number;
  
  /**
   * Optional tool calls included in the message
   */
  toolCalls?: ToolCall[];
  
  /**
   * Optional tool results for tool calls
   */
  toolResults?: ToolResult[];
}
```

#### JSON Representation

```json
{
  "id": "msg1",
  "role": "user",
  "content": "What are Bounded Context Packs?",
  "timestamp": 1714590000000
}
```

### Tool Call Model

The ToolCall model represents a request to execute a tool.

```typescript
export interface ToolCall {
  /**
   * Unique identifier for the tool call
   */
  id: string;
  
  /**
   * Fully qualified name of the tool (domain.name)
   */
  name: string;
  
  /**
   * Arguments passed to the tool
   */
  arguments: any;
  
  /**
   * Current status of the tool call
   */
  status: 'pending' | 'success' | 'error';
}
```

#### JSON Representation

```json
{
  "id": "tool1",
  "name": "NoteReader.readNote",
  "arguments": {
    "path": "some/path/to/note.md"
  },
  "status": "success"
}
```

### Tool Result Model

The ToolResult model represents the result of a tool execution.

```typescript
export interface ToolResult {
  /**
   * Unique identifier for the tool result
   */
  id: string;
  
  /**
   * ID of the tool call this result is for
   */
  toolCallId: string;
  
  /**
   * Result content from the tool execution
   */
  content: any;
  
  /**
   * Optional error message if the tool execution failed
   */
  error?: string;
}
```

#### JSON Representation

```json
{
  "id": "result1",
  "toolCallId": "tool1",
  "content": {
    "path": "some/path/to/note.md",
    "content": "Note content here..."
  }
}
```

## Settings Models

### Plugin Settings

The Settings model represents user preferences for the plugin.

```typescript
export interface ChatsidianSettings {
  /**
   * API key for AI provider
   */
  apiKey: string;
  
  /**
   * Name of the AI provider (e.g., 'anthropic', 'openai')
   */
  provider: string;
  
  /**
   * Name of the AI model to use
   */
  model: string;
  
  /**
   * Temperature setting for response generation (0-1)
   */
  temperature: number;
  
  /**
   * Maximum tokens for response generation
   */
  maxTokens: number;
  
  /**
   * Path to the folder where conversations are stored
   */
  conversationsFolderPath: string;
  
  /**
   * ID of the most recently used conversation
   */
  recentConversationId: string | null;
  
  /**
   * Whether streaming responses are enabled
   */
  streamingEnabled: boolean;
  
  /**
   * BCPs to load automatically on startup
   */
  autoLoadBCPs: string[];
  
  /**
   * UI customization settings
   */
  uiSettings: {
    /**
     * Whether dark mode is enabled
     */
    darkMode: boolean;
    
    /**
     * Font size for messages (pixels)
     */
    fontSize: number;
    
    /**
     * Whether to show message timestamps
     */
    showTimestamps: boolean;
    
    /**
     * Custom CSS class for the chat view
     */
    customCssClass?: string;
  };
}
```

#### JSON Representation

```json
{
  "apiKey": "sk-xxxxxxxxxxxx",
  "provider": "anthropic",
  "model": "claude-3-opus-20240229",
  "temperature": 0.7,
  "maxTokens": 4000,
  "conversationsFolderPath": ".chatsidian/conversations",
  "recentConversationId": "abcd1234",
  "streamingEnabled": true,
  "autoLoadBCPs": ["System", "NoteReader"],
  "uiSettings": {
    "darkMode": true,
    "fontSize": 14,
    "showTimestamps": true
  }
}
```

## BCP Models

### Bounded Context Pack Model

The BoundedContextPack model represents a collection of related tools.

```typescript
export interface BoundedContextPack {
  /**
   * Domain name for the pack (unique identifier)
   */
  domain: string;
  
  /**
   * Human-readable description of the pack
   */
  description: string;
  
  /**
   * Array of tools included in the pack
   */
  tools: Tool[];
}
```

### Tool Model

The Tool model represents a callable function available to the AI.

```typescript
export interface Tool {
  /**
   * Name of the tool (without domain prefix)
   */
  name: string;
  
  /**
   * Human-readable description of the tool
   */
  description: string;
  
  /**
   * Function that implements the tool
   */
  handler: (params: any) => Promise<any>;
  
  /**
   * JSON Schema for tool parameters
   */
  schema: any;
}
```

## Storage Structure

### Folder Structure

Chatsidian stores its data within the Obsidian vault using the following structure:

```
[vault]/
  .chatsidian/
    settings.json                # Plugin settings
    conversations/
      [conversation-id-1].json   # Conversation files
      [conversation-id-2].json
      ...
```

### Data Flow

#### Conversation Saving

1. Conversation is created/updated in memory
2. ConversationManager serializes the conversation to JSON
3. JSON is saved to .chatsidian/conversations/[id].json
4. Event is emitted to notify UI of changes

#### Conversation Loading

1. ConversationManager reads .chatsidian/conversations/[id].json
2. JSON is parsed into a Conversation object
3. Conversation is stored in memory cache
4. Event is emitted to notify UI of loaded conversation

#### Settings Saving/Loading

1. Settings are accessed/modified through SettingsManager
2. Changes are saved to .chatsidian/settings.json
3. Events are emitted to notify components of setting changes

## Schema Validation

### Tool Parameter Validation

Tool parameters are validated against JSON Schema definitions:

```typescript
export function validateParameters(schema: any, params: any): {
  valid: boolean;
  errors?: string[];
} {
  // Validation implementation
  if (!schema) {
    return { valid: true };
  }
  
  // Check required properties
  if (schema.required) {
    for (const required of schema.required) {
      if (!(required in params)) {
        return {
          valid: false,
          errors: [`Missing required parameter: ${required}`]
        };
      }
    }
  }
  
  // Check property types
  if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      if (key in params) {
        // Type validation based on property definition
        // ...
      }
    }
  }
  
  return { valid: true };
}
```

## Migration Strategies

### Version Compatibility

When upgrading the plugin, data models may evolve. The following strategies ensure backward compatibility:

1. **Additive Changes** - New optional fields can be added without breaking existing data
2. **Default Values** - Missing fields use sensible defaults
3. **Version Fields** - Data structures include version fields for migration logic
4. **Migration Functions** - Explicit migration of old data structures to new formats

### Migration Example

```typescript
export async function migrateConversation(
  conversation: any, 
  fromVersion: string, 
  toVersion: string
): Promise<Conversation> {
  // Migration from v1.0 to v2.0
  if (fromVersion === '1.0' && toVersion === '2.0') {
    // Add missing fields with defaults
    if (!conversation.metadata) {
      conversation.metadata = {};
    }
    
    // Convert old format to new
    if (conversation.tools) {
      conversation.messages.forEach((message: any) => {
        if (message.toolId) {
          // Create tool calls array if it doesn't exist
          if (!message.toolCalls) {
            message.toolCalls = [];
          }
          
          // Add tool call from old format
          message.toolCalls.push({
            id: message.toolId,
            name: message.toolName,
            arguments: message.toolArgs,
            status: message.toolStatus || 'success'
          });
          
          // Remove old properties
          delete message.toolId;
          delete message.toolName;
          delete message.toolArgs;
          delete message.toolStatus;
        }
      });
      
      // Remove old tools array
      delete conversation.tools;
    }
  }
  
  return conversation as Conversation;
}
```

## Best Practices

### Working with Conversations

1. **Use ConversationManager API** - Never manipulate conversation files directly
2. **Handle Large Conversations** - Use lazy loading for message content
3. **Validate Before Saving** - Ensure data models are valid before persistence
4. **Event-Driven Updates** - Subscribe to events for UI updates

### Tool Implementation

1. **Clear Parameter Documentation** - Use descriptive schema properties
2. **Defensive Programming** - Validate inputs thoroughly
3. **Async Operations** - Return Promises for all operations
4. **Error Handling** - Provide clear error messages

### Security Considerations

1. **API Key Storage** - Use secure storage for API keys
2. **Input Validation** - Validate all user and AI inputs
3. **Path Safety** - Prevent directory traversal in file operations
4. **Error Messages** - Avoid leaking sensitive information in errors

## Extending Data Models

### Custom Metadata

Conversation and message models support custom metadata:

```typescript
// Add custom metadata to a conversation
conversation.metadata = {
  ...conversation.metadata,
  project: 'Research Project',
  priority: 'high',
  customField: {
    nestedData: true
  }
};

// Add custom metadata to a message
message.metadata = {
  sourceMaterial: ['document1.md', 'document2.md'],
  confidenceScore: 0.95
};
```

### Plugin Integration

Other plugins can extend Chatsidian's data models:

```typescript
// Register a schema extension
api.registerSchemaExtension('conversation', {
  properties: {
    metadata: {
      properties: {
        myPluginData: {
          type: 'object',
          properties: {
            // Custom properties
          }
        }
      }
    }
  }
});
```