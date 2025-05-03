---
title: Phase 1.2 - Data Models and TypeScript Interfaces
description: Defining the core data models and TypeScript interfaces for the Chatsidian plugin
date: 2025-05-03
status: planning
tags:
  - implementation
  - data-models
  - typescript
  - interfaces
  - chatsidian
---

# Phase 1.2: Data Models and TypeScript Interfaces

## Overview

This microphase focuses on defining the core data models and TypeScript interfaces that will form the foundation of the Chatsidian plugin. Well-designed data models are essential for maintaining type safety, providing clear documentation, and ensuring consistency across the application.

## Objectives

- Define conversation and message models
- Create provider-related interfaces
- Establish settings model with default values
- Document model relationships and usage patterns
- Write unit tests for the models

## Implementation Steps

### 1. Create Conversation and Message Models

Create `src/models/Conversation.ts`:

```typescript
/**
 * Models related to conversations and messages in the Chatsidian plugin.
 */

/**
 * Represents a conversation between a user and an AI assistant.
 */
export interface Conversation {
  // Unique identifier for the conversation
  id: string;
  
  // Display title for the conversation
  title: string;
  
  // Timestamp when the conversation was created
  createdAt: number;
  
  // Timestamp when the conversation was last modified
  modifiedAt: number;
  
  // Array of messages in the conversation
  messages: Message[];
  
  // Optional metadata for the conversation (tags, context, etc.)
  metadata?: Record<string, any>;
}

/**
 * Enum for message roles in a conversation.
 */
export enum MessageRole {
  User = 'user',
  Assistant = 'assistant',
  System = 'system'
}

/**
 * Represents a single message in a conversation.
 */
export interface Message {
  // Unique identifier for the message
  id: string;
  
  // The role of the message sender
  role: MessageRole;
  
  // The content of the message
  content: string;
  
  // Timestamp when the message was sent
  timestamp: number;
  
  // Optional tool calls made by this message
  toolCalls?: ToolCall[];
  
  // Optional tool results from tool calls
  toolResults?: ToolResult[];
}

/**
 * Represents a tool call made by the AI.
 */
export interface ToolCall {
  // Unique identifier for the tool call
  id: string;
  
  // The name of the tool being called
  name: string;
  
  // The arguments passed to the tool
  arguments: any;
  
  // The status of the tool call
  status: 'pending' | 'success' | 'error';
}

/**
 * Represents the result of a tool call.
 */
export interface ToolResult {
  // Unique identifier for the result
  id: string;
  
  // The ID of the tool call this result is for
  toolCallId: string;
  
  // The content returned by the tool
  content: any;
  
  // Optional error message if the tool call failed
  error?: string;
}

/**
 * Utility functions for working with conversations
 */
export class ConversationUtils {
  /**
   * Creates a new conversation with default values.
   * @param title Optional title for the conversation
   * @returns A new Conversation object with a generated ID
   */
  static createNew(title?: string): Conversation {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2);
    const now = Date.now();
    
    return {
      id,
      title: title || `New Conversation (${new Date(now).toLocaleString()})`,
      createdAt: now,
      modifiedAt: now,
      messages: []
    };
  }
  
  /**
   * Creates a new message with default values.
   * @param role The role of the message sender
   * @param content The content of the message
   * @returns A new Message object with a generated ID
   */
  static createMessage(role: MessageRole, content: string): Message {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2);
    
    return {
      id,
      role,
      content,
      timestamp: Date.now()
    };
  }
  
  /**
   * Adds a new message to a conversation.
   * @param conversation The conversation to add the message to
   * @param message The message to add
   * @returns The updated conversation
   */
  static addMessage(conversation: Conversation, message: Message): Conversation {
    return {
      ...conversation,
      messages: [...conversation.messages, message],
      modifiedAt: Date.now()
    };
  }
}
```

### 2. Define Provider-Related Interfaces

Create `src/models/Provider.ts`:

```typescript
/**
 * Models related to AI providers and their APIs.
 */

/**
 * Represents a message in the format expected by AI providers.
 */
export interface ProviderMessage {
  // The role of the message sender
  role: string;
  
  // The content of the message
  content: string;
  
  // Optional tool calls made by this message
  toolCalls?: any[];
  
  // Optional tool results from tool calls
  toolResults?: any[];
}

/**
 * Represents a request to an AI provider.
 */
export interface ProviderRequest {
  // The messages to send to the provider
  messages: ProviderMessage[];
  
  // The model to use for the request
  model: string;
  
  // Optional temperature parameter
  temperature?: number;
  
  // Optional maximum tokens parameter
  maxTokens?: number;
  
  // Optional tools to make available to the model
  tools?: any[];
  
  // Whether to stream the response
  stream?: boolean;
}

/**
 * Represents a response from an AI provider.
 */
export interface ProviderResponse {
  // Unique identifier for the response
  id: string;
  
  // The message returned by the provider
  message: ProviderMessage;
  
  // Optional tool calls made by the model
  toolCalls?: any[];
}

/**
 * Represents a chunk of a streamed response.
 */
export interface ProviderChunk {
  // Unique identifier for the response
  id: string;
  
  // The delta content for this chunk
  delta: {
    // Optional text content
    content?: string;
    
    // Optional tool call updates
    toolCalls?: any[];
  };
}

/**
 * Represents an error from an AI provider.
 */
export interface ProviderError {
  // Error code
  code: string;
  
  // Error message
  message: string;
  
  // Optional parameter that caused the error
  param?: string;
  
  // Error type
  type: string;
}

/**
 * Model information for provider selection.
 */
export interface ModelInfo {
  // Unique identifier for the model
  id: string;
  
  // Display name for the model
  name: string;
  
  // Provider that offers this model
  provider: string;
  
  // Context window size in tokens
  contextSize: number;
  
  // Whether the model supports tool calls
  supportsTools: boolean;
  
  // Whether the model is suited for JSON mode
  supportsJson?: boolean;
  
  // Maximum token output supported
  maxOutputTokens?: number;
}

/**
 * Common model presets for different providers.
 */
export const COMMON_MODELS: ModelInfo[] = [
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    contextSize: 200000,
    supportsTools: true,
    supportsJson: true,
    maxOutputTokens: 4096
  },
  {
    id: 'claude-3-sonnet-20240229',
    name: 'Claude 3 Sonnet',
    provider: 'anthropic',
    contextSize: 200000,
    supportsTools: true,
    supportsJson: true,
    maxOutputTokens: 4096
  },
  {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    contextSize: 200000,
    supportsTools: true,
    supportsJson: true,
    maxOutputTokens: 4096
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    contextSize: 128000,
    supportsTools: true,
    supportsJson: true,
    maxOutputTokens: 4096
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    contextSize: 128000,
    supportsTools: true,
    supportsJson: true,
    maxOutputTokens: 4096
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    contextSize: 16385,
    supportsTools: true,
    supportsJson: true,
    maxOutputTokens: 4096
  }
];
```

### 3. Create Settings Model with Default Values

Create `src/models/Settings.ts`:

```typescript
/**
 * Settings model for the Chatsidian plugin.
 */

/**
 * Interface for Chatsidian plugin settings.
 */
export interface ChatsidianSettings {
  // API Configuration
  
  // The AI provider to use
  provider: 'anthropic' | 'openai' | 'openrouter' | 'google' | 'custom';
  
  // API key for the selected provider
  apiKey: string;
  
  // Optional custom API endpoint
  apiEndpoint?: string;
  
  // Model to use for the selected provider
  model: string;
  
  // Conversation Settings
  
  // Folder where conversations are stored
  conversationsFolder: string;
  
  // Maximum number of messages to keep in memory
  maxMessages: number;
  
  // Default system prompt to use for new conversations
  defaultSystemPrompt: string;
  
  // UI Settings
  
  // Theme for the UI
  theme: 'light' | 'dark' | 'system';
  
  // Font size for the UI
  fontSize: number;
  
  // Whether to show timestamps in the UI
  showTimestamps: boolean;
  
  // Advanced Settings
  
  // Whether to enable debug mode
  debugMode: boolean;
  
  // Bounded Context Packs to load automatically
  autoLoadBCPs: string[];
  
  // Default temperature for AI requests
  defaultTemperature: number;
  
  // Default maximum tokens for AI responses
  defaultMaxTokens: number;
}

/**
 * Default settings for the Chatsidian plugin.
 */
export const DEFAULT_SETTINGS: ChatsidianSettings = {
  provider: 'anthropic',
  apiKey: '',
  model: 'claude-3-opus-20240229',
  conversationsFolder: '.chatsidian/conversations',
  maxMessages: 100,
  defaultSystemPrompt: 'You are an AI assistant helping with Obsidian vault management.',
  theme: 'system',
  fontSize: 14,
  showTimestamps: true,
  debugMode: false,
  autoLoadBCPs: ['System'],
  defaultTemperature: 0.7,
  defaultMaxTokens: 4000
};

/**
 * Utility functions for working with settings.
 */
export class SettingsUtils {
  /**
   * Validates settings and provides valid defaults.
   * @param settings The settings to validate
   * @returns A valid settings object
   */
  static validate(settings: Partial<ChatsidianSettings>): ChatsidianSettings {
    return {
      ...DEFAULT_SETTINGS,
      ...settings,
      // Ensure provider is a valid option
      provider: this.validateProvider(settings.provider),
      // Ensure folder path is valid
      conversationsFolder: this.validateFolderPath(settings.conversationsFolder),
      // Ensure temperature is between 0 and 1
      defaultTemperature: this.validateTemperature(settings.defaultTemperature),
      // Ensure max tokens is a positive number
      defaultMaxTokens: this.validateMaxTokens(settings.defaultMaxTokens)
    };
  }
  
  /**
   * Validates the provider setting.
   * @param provider The provider to validate
   * @returns A valid provider
   */
  private static validateProvider(provider?: string): ChatsidianSettings['provider'] {
    const validProviders = ['anthropic', 'openai', 'openrouter', 'google', 'custom'];
    return validProviders.includes(provider as any) 
      ? (provider as ChatsidianSettings['provider']) 
      : DEFAULT_SETTINGS.provider;
  }
  
  /**
   * Validates a folder path.
   * @param path The path to validate
   * @returns A valid folder path
   */
  private static validateFolderPath(path?: string): string {
    if (!path) return DEFAULT_SETTINGS.conversationsFolder;
    
    // Remove leading/trailing slashes
    path = path.replace(/^\/+|\/+$/g, '');
    
    // Ensure path is not empty
    return path || DEFAULT_SETTINGS.conversationsFolder;
  }
  
  /**
   * Validates the temperature setting.
   * @param temperature The temperature to validate
   * @returns A valid temperature between 0 and 1
   */
  private static validateTemperature(temperature?: number): number {
    if (temperature === undefined) return DEFAULT_SETTINGS.defaultTemperature;
    
    return Math.max(0, Math.min(1, temperature));
  }
  
  /**
   * Validates the max tokens setting.
   * @param maxTokens The max tokens to validate
   * @returns A valid max tokens value
   */
  private static validateMaxTokens(maxTokens?: number): number {
    if (maxTokens === undefined) return DEFAULT_SETTINGS.defaultMaxTokens;
    
    return Math.max(1, Math.min(32000, maxTokens));
  }
}
```

### 4. Document Model Relationships

Create `src/models/README.md`:

```markdown
# Chatsidian Data Models

This directory contains TypeScript interfaces and models for the Chatsidian plugin.

## Model Relationships

### Conversation Model

```
Conversation
  ├── id: string
  ├── title: string
  ├── createdAt: number
  ├── modifiedAt: number
  ├── messages: Message[]
  └── metadata?: Record<string, any>
```

### Message Model

```
Message
  ├── id: string
  ├── role: MessageRole
  ├── content: string
  ├── timestamp: number
  ├── toolCalls?: ToolCall[]
  └── toolResults?: ToolResult[]
```

### Provider Models

```
ProviderRequest
  ├── messages: ProviderMessage[]
  ├── model: string
  ├── temperature?: number
  ├── maxTokens?: number
  ├── tools?: any[]
  └── stream?: boolean

ProviderResponse
  ├── id: string
  ├── message: ProviderMessage
  └── toolCalls?: any[]
```

### Settings Model

```
ChatsidianSettings
  ├── provider: string
  ├── apiKey: string
  ├── apiEndpoint?: string
  ├── model: string
  ├── conversationsFolder: string
  ├── maxMessages: number
  ├── defaultSystemPrompt: string
  ├── theme: string
  ├── fontSize: number
  ├── showTimestamps: boolean
  ├── debugMode: boolean
  ├── autoLoadBCPs: string[]
  ├── defaultTemperature: number
  └── defaultMaxTokens: number
```

## Usage Patterns

### Creating a New Conversation

```typescript
import { ConversationUtils, MessageRole } from './Conversation';

// Create a new conversation
const conversation = ConversationUtils.createNew('My Conversation');

// Add a user message
const userMessage = ConversationUtils.createMessage(MessageRole.User, 'Hello, AI!');
const updatedConversation = ConversationUtils.addMessage(conversation, userMessage);
```

### Working with Settings

```typescript
import { DEFAULT_SETTINGS, SettingsUtils } from './Settings';

// Load settings from storage
const loadedSettings = { ...DEFAULT_SETTINGS, apiKey: 'my-api-key' };

// Validate settings
const validatedSettings = SettingsUtils.validate(loadedSettings);
```

### Making Provider Requests

```typescript
import { ProviderRequest } from './Provider';

// Create a request
const request: ProviderRequest = {
  messages: [
    { role: 'user', content: 'Hello, AI!' }
  ],
  model: 'claude-3-opus-20240229',
  temperature: 0.7,
  maxTokens: 4000
};
```
```

### 5. Write Unit Tests for Models

Create `tests/models/Conversation.test.ts`:

```typescript
import { Conversation, Message, MessageRole, ConversationUtils } from '../../src/models/Conversation';

describe('Conversation Model', () => {
  test('should create a valid conversation', () => {
    const conversation: Conversation = {
      id: 'test-id',
      title: 'Test Conversation',
      createdAt: 1619816400000,
      modifiedAt: 1619816400000,
      messages: []
    };
    
    expect(conversation.id).toBe('test-id');
    expect(conversation.title).toBe('Test Conversation');
    expect(conversation.messages).toHaveLength(0);
  });
  
  test('should add messages to conversation', () => {
    const conversation: Conversation = {
      id: 'test-id',
      title: 'Test Conversation',
      createdAt: 1619816400000,
      modifiedAt: 1619816400000,
      messages: []
    };
    
    const message: Message = {
      id: 'msg-1',
      role: MessageRole.User,
      content: 'Hello, world!',
      timestamp: 1619816400000
    };
    
    conversation.messages.push(message);
    
    expect(conversation.messages).toHaveLength(1);
    expect(conversation.messages[0].content).toBe('Hello, world!');
  });
  
  test('createNew should generate a conversation with default values', () => {
    const conversation = ConversationUtils.createNew();
    
    expect(conversation.id).toBeDefined();
    expect(conversation.title).toContain('New Conversation');
    expect(conversation.createdAt).toBeDefined();
    expect(conversation.modifiedAt).toBeDefined();
    expect(conversation.messages).toHaveLength(0);
  });
  
  test('createNew should accept a custom title', () => {
    const title = 'Custom Title';
    const conversation = ConversationUtils.createNew(title);
    
    expect(conversation.title).toBe(title);
  });
  
  test('createMessage should generate a message with the given role and content', () => {
    const role = MessageRole.User;
    const content = 'Hello, world!';
    const message = ConversationUtils.createMessage(role, content);
    
    expect(message.id).toBeDefined();
    expect(message.role).toBe(role);
    expect(message.content).toBe(content);
    expect(message.timestamp).toBeDefined();
  });
  
  test('addMessage should add a message to a conversation', () => {
    const conversation = ConversationUtils.createNew();
    const message = ConversationUtils.createMessage(MessageRole.User, 'Hello, world!');
    
    const updatedConversation = ConversationUtils.addMessage(conversation, message);
    
    expect(updatedConversation.messages).toHaveLength(1);
    expect(updatedConversation.messages[0].content).toBe('Hello, world!');
    expect(updatedConversation.modifiedAt).toBeGreaterThanOrEqual(conversation.modifiedAt);
  });
});
```

Create `tests/models/Settings.test.ts`:

```typescript
import { ChatsidianSettings, DEFAULT_SETTINGS, SettingsUtils } from '../../src/models/Settings';

describe('Settings Model', () => {
  test('DEFAULT_SETTINGS should have all required properties', () => {
    expect(DEFAULT_SETTINGS.provider).toBeDefined();
    expect(DEFAULT_SETTINGS.apiKey).toBeDefined();
    expect(DEFAULT_SETTINGS.model).toBeDefined();
    expect(DEFAULT_SETTINGS.conversationsFolder).toBeDefined();
    expect(DEFAULT_SETTINGS.maxMessages).toBeDefined();
    expect(DEFAULT_SETTINGS.defaultSystemPrompt).toBeDefined();
    expect(DEFAULT_SETTINGS.theme).toBeDefined();
    expect(DEFAULT_SETTINGS.fontSize).toBeDefined();
    expect(DEFAULT_SETTINGS.showTimestamps).toBeDefined();
    expect(DEFAULT_SETTINGS.debugMode).toBeDefined();
    expect(DEFAULT_SETTINGS.autoLoadBCPs).toBeDefined();
    expect(DEFAULT_SETTINGS.defaultTemperature).toBeDefined();
    expect(DEFAULT_SETTINGS.defaultMaxTokens).toBeDefined();
  });
  
  test('validate should use default values for missing properties', () => {
    const partialSettings: Partial<ChatsidianSettings> = {
      apiKey: 'test-key'
    };
    
    const validatedSettings = SettingsUtils.validate(partialSettings);
    
    expect(validatedSettings.apiKey).toBe('test-key');
    expect(validatedSettings.provider).toBe(DEFAULT_SETTINGS.provider);
    expect(validatedSettings.model).toBe(DEFAULT_SETTINGS.model);
    // Check that all other properties have default values
  });
  
  test('validate should correct invalid provider', () => {
    const settings: Partial<ChatsidianSettings> = {
      provider: 'invalid' as any
    };
    
    const validatedSettings = SettingsUtils.validate(settings);
    
    expect(validatedSettings.provider).toBe(DEFAULT_SETTINGS.provider);
  });
  
  test('validate should normalize folder path', () => {
    const settings: Partial<ChatsidianSettings> = {
      conversationsFolder: '/test/path/'
    };
    
    const validatedSettings = SettingsUtils.validate(settings);
    
    expect(validatedSettings.conversationsFolder).toBe('test/path');
  });
  
  test('validate should clamp temperature between 0 and 1', () => {
    expect(SettingsUtils.validate({ defaultTemperature: -0.5 }).defaultTemperature).toBe(0);
    expect(SettingsUtils.validate({ defaultTemperature: 1.5 }).defaultTemperature).toBe(1);
    expect(SettingsUtils.validate({ defaultTemperature: 0.5 }).defaultTemperature).toBe(0.5);
  });
  
  test('validate should ensure maxTokens is a positive number', () => {
    expect(SettingsUtils.validate({ defaultMaxTokens: -100 }).defaultMaxTokens).toBe(1);
    expect(SettingsUtils.validate({ defaultMaxTokens: 50000 }).defaultMaxTokens).toBe(32000);
    expect(SettingsUtils.validate({ defaultMaxTokens: 2000 }).defaultMaxTokens).toBe(2000);
  });
});
```

## References

- [[💻 Coding/Documentation/Obsidian/Plugin - Documentation.md]] - Obsidian Plugin API documentation
- [[💻 Coding/Documentation/Obsidian/PluginSettingTab - Documentation.md]] - Plugin settings documentation

## Next Steps

After completing this microphase, proceed to:
- [[💻 Coding/Projects/Chatsidian/3_Implementation/Phase1.3-Event-Bus.md]] - Implementing the event system for component communication
