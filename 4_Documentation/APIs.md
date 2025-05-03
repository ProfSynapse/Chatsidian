---
title: Chatsidian APIs Documentation
description: Comprehensive API documentation for the Chatsidian plugin components
date: 2025-05-03
status: planning
tags:
  - documentation
  - apis
  - integration
  - development
---

# Chatsidian APIs Documentation

## Overview

This document provides comprehensive documentation for the APIs exposed by the Chatsidian plugin components. These APIs enable interaction between components within the plugin and potentially for external plugins to integrate with Chatsidian functionality.

## Core APIs

### PluginCore

The main plugin class that initializes and coordinates all components.

```typescript
export default class ChatsidianPlugin extends Plugin {
  /**
   * Initialize the plugin and all components
   */
  async onload(): Promise<void>;
  
  /**
   * Clean up resources on plugin unload
   */
  async onunload(): Promise<void>;
  
  /**
   * Activate the chat view in the workspace
   * @returns Promise that resolves when the view is active
   */
  async activateView(): Promise<void>;
  
  /**
   * Get the active chat view
   * @returns The active chat view or null
   */
  getChatView(): ChatView | null;
  
  /**
   * Load plugin settings from disk
   * @returns Promise that resolves when settings are loaded
   */
  async loadSettings(): Promise<void>;
  
  /**
   * Save plugin settings to disk
   * @returns Promise that resolves when settings are saved
   */
  async saveSettings(): Promise<void>;
}
```

### EventBus

Central event bus for communication between components.

```typescript
export type EventHandler = (data?: any) => void | Promise<void>;
export type EventWithResultHandler<T> = (data?: any) => T | Promise<T>;

export class EventBus {
  /**
   * Register an event handler
   * @param event - Event name
   * @param handler - Function to handle the event
   */
  on(event: string, handler: EventHandler): void;
  
  /**
   * Unregister an event handler
   * @param event - Event name
   * @param handler - Function to remove
   */
  off(event: string, handler: EventHandler): void;
  
  /**
   * Register a handler that returns a result
   * @param event - Event name
   * @param handler - Function to handle the event and return a result
   */
  onWithResult<T>(event: string, handler: EventWithResultHandler<T>): void;
  
  /**
   * Emit an event
   * @param event - Event name
   * @param data - Optional data to pass to handlers
   */
  emit(event: string, data?: any): void;
  
  /**
   * Emit an event and collect the result
   * @param event - Event name
   * @param data - Optional data to pass to handlers
   * @returns Promise resolving to the handler result
   */
  emitWithResult<T>(event: string, data?: any): Promise<T>;
  
  /**
   * Remove all event handlers
   */
  clear(): void;
}
```

### SettingsManager

Manages plugin settings and preferences.

```typescript
export interface ChatsidianSettings {
  apiKey: string;
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  conversationsFolderPath: string;
  recentConversationId: string | null;
  streamingEnabled: boolean;
  autoLoadBCPs: string[];
  uiSettings: {
    darkMode: boolean;
    fontSize: number;
    showTimestamps: boolean;
  };
}

export class SettingsManager {
  /**
   * Get the current settings
   * @returns The current settings object
   */
  getSettings(): ChatsidianSettings;
  
  /**
   * Update settings
   * @param updates - Partial settings object with changes
   * @returns Promise resolving when settings are saved
   */
  updateSettings(updates: Partial<ChatsidianSettings>): Promise<void>;
  
  /**
   * Get the API key
   * @returns The API key
   */
  getApiKey(): string;
  
  /**
   * Set the API key
   * @param apiKey - New API key
   * @returns Promise resolving when settings are saved
   */
  setApiKey(apiKey: string): Promise<void>;
  
  /**
   * Get the provider name
   * @returns Provider name (e.g., 'anthropic', 'openai')
   */
  getProvider(): string;
  
  /**
   * Get the model name
   * @returns Model name (e.g., 'claude-3-sonnet')
   */
  getModelName(): string;
  
  /**
   * Get the temperature setting
   * @returns Temperature value between 0 and 1
   */
  getTemperature(): number;
  
  /**
   * Get the max tokens setting
   * @returns Maximum tokens for completion
   */
  getMaxTokens(): number;
  
  /**
   * Get the conversations folder path
   * @returns Path to conversations folder
   */
  getConversationsFolderPath(): string;
  
  /**
   * Get the most recent conversation ID
   * @returns Recent conversation ID or null
   */
  getRecentConversationId(): string | null;
  
  /**
   * Set the most recent conversation ID
   * @param id - Conversation ID or null
   */
  setRecentConversationId(id: string | null): void;
  
  /**
   * Check if streaming is enabled
   * @returns Whether streaming is enabled
   */
  isStreamingEnabled(): boolean;
  
  /**
   * Get auto-load BCPs
   * @returns Array of domain names to auto-load
   */
  getAutoLoadBCPs(): string[];
}
```

## Conversation Management APIs

### ConversationManager

Manages conversation storage and operations.

```typescript
export class ConversationManager {
  /**
   * Initialize conversation storage
   * @returns Promise resolving when initialization is complete
   */
  async initialize(): Promise<void>;
  
  /**
   * Create a new conversation
   * @param title - Optional title for the conversation
   * @returns Promise resolving to the created conversation
   */
  async createNewConversation(title?: string): Promise<Conversation>;
  
  /**
   * Load a conversation by ID
   * @param id - Conversation ID
   * @returns Promise resolving to the conversation or null
   */
  async loadConversation(id: string): Promise<Conversation | null>;
  
  /**
   * Get the current conversation
   * @returns The current conversation or null
   */
  getCurrentConversation(): Conversation | null;
  
  /**
   * Add a user message to the current conversation
   * @param content - Message content
   * @returns Promise resolving to the created message
   */
  async addUserMessage(content: string): Promise<Message>;
  
  /**
   * Add a message to a conversation
   * @param conversationId - Conversation ID
   * @param message - Partial message object
   * @returns Promise resolving to the created message
   */
  async addMessage(conversationId: string, message: Partial<Message>): Promise<Message>;
  
  /**
   * Add a tool result to a message
   * @param conversationId - Conversation ID
   * @param messageId - Message ID
   * @param toolCallId - Tool call ID
   * @param result - Tool result
   * @param error - Optional error message
   */
  async addToolResult(
    conversationId: string,
    messageId: string,
    toolCallId: string,
    result: any,
    error?: string
  ): Promise<void>;
  
  /**
   * Delete a conversation
   * @param id - Conversation ID
   */
  async deleteConversation(id: string): Promise<void>;
  
  /**
   * Update conversation metadata
   * @param id - Conversation ID
   * @param updates - Partial conversation object with changes
   * @returns Promise resolving to the updated conversation
   */
  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation>;
  
  /**
   * Get all conversations
   * @returns Array of conversations sorted by modification time
   */
  getAllConversations(): Conversation[];
}
```

### Conversation Models

```typescript
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
}
```

## MCP Integration APIs

### MCPClient

Handles communication with AI models via the Model Context Protocol.

```typescript
export class MCPClient {
  /**
   * Send a message to the AI model
   * @param conversation - Conversation context
   * @param userMessage - User message to send
   * @returns Promise resolving when processing is complete
   */
  async sendMessage(conversation: Conversation, userMessage: Message): Promise<void>;
  
  /**
   * Update client settings
   * @param settings - New settings manager instance
   */
  async updateSettings(settings: SettingsManager): Promise<void>;
  
  /**
   * Establish connection to AI provider
   */
  async connect(): Promise<void>;
  
  /**
   * Close connection to AI provider
   */
  async disconnect(): Promise<void>;
  
  /**
   * Enable streaming mode
   * @param enabled - Whether to enable streaming
   */
  setStreamingEnabled(enabled: boolean): void;
}
```

### BCPRegistry

Manages Bounded Context Packs (BCPs) for tool capabilities.

```typescript
export interface Tool {
  name: string;
  description: string;
  handler: (params: any) => Promise<any>;
  schema: any;
}

export interface BoundedContextPack {
  domain: string;
  description: string;
  tools: Tool[];
}

export class BCPRegistry {
  /**
   * Initialize the BCP registry
   * @returns Promise resolving when initialization is complete
   */
  async initialize(): Promise<void>;
  
  /**
   * Load a bounded context pack
   * @param domain - Domain name of the pack
   * @returns Promise resolving to result of loading
   */
  async loadPack(domain: string): Promise<any>;
  
  /**
   * Unload a bounded context pack
   * @param domain - Domain name of the pack
   * @returns Promise resolving to result of unloading
   */
  async unloadPack(domain: string): Promise<any>;
  
  /**
   * List all available packs
   * @returns Promise resolving to list of packs
   */
  async listPacks(): Promise<any>;
  
  /**
   * Get all tools from loaded packs
   * @returns Array of tools
   */
  getLoadedTools(): Tool[];
  
  /**
   * Check if a pack is loaded
   * @param domain - Domain name of the pack
   * @returns Whether the pack is loaded
   */
  isPackLoaded(domain: string): boolean;
  
  /**
   * Get information about a pack
   * @param domain - Domain name of the pack
   * @returns Pack information or null
   */
  getPackInfo(domain: string): Partial<BoundedContextPack> | null;
}
```

### ToolManager

Handles tool execution and management.

```typescript
export class ToolManager {
  /**
   * Register a tool
   * @param name - Fully qualified tool name (domain.toolName)
   * @param description - Tool description
   * @param handler - Function to execute
   * @param schema - JSON Schema for parameters
   */
  registerTool(
    name: string,
    description: string,
    handler: (params: any) => Promise<any>,
    schema: any
  ): void;
  
  /**
   * Unregister a tool
   * @param name - Fully qualified tool name
   */
  unregisterTool(name: string): void;
  
  /**
   * Get all available tools
   * @returns Array of tool definitions
   */
  getAvailableTools(): any[];
  
  /**
   * Execute a tool call
   * @param toolCall - Tool call object from MCP
   * @returns Promise resolving to tool execution result
   */
  async executeToolCall(toolCall: any): Promise<any>;
  
  /**
   * Validate tool parameters
   * @param name - Tool name
   * @param params - Parameters to validate
   * @returns Validation result
   */
  validateParameters(name: string, params: any): {
    valid: boolean;
    errors?: string[];
  };
  
  /**
   * Check if a tool exists
   * @param name - Tool name
   * @returns Whether the tool exists
   */
  hasTool(name: string): boolean;
}
```

## UI APIs

### ChatView

Main UI component for the chat interface.

```typescript
export class ChatView extends ItemView {
  /**
   * Get the view type identifier
   * @returns View type string
   */
  getViewType(): string;
  
  /**
   * Get the display text for the view
   * @returns Display text
   */
  getDisplayText(): string;
  
  /**
   * Handle view opening
   * @returns Promise resolving when view is open
   */
  async onOpen(): Promise<void>;
  
  /**
   * Handle view closing
   * @returns Promise resolving when view is closed
   */
  async onClose(): Promise<void>;
  
  /**
   * Handle sending a message
   * @param content - Message content
   * @returns Promise resolving when message is sent
   */
  async handleSendMessage(content: string): Promise<void>;
  
  /**
   * Handle selecting a conversation
   * @param id - Conversation ID
   * @returns Promise resolving when conversation is selected
   */
  async handleConversationSelect(id: string): Promise<void>;
  
  /**
   * Handle creating a new conversation
   * @returns Promise resolving when conversation is created
   */
  async handleNewConversation(): Promise<void>;
  
  /**
   * Set typing indicator state
   * @param isTyping - Whether typing is in progress
   */
  setTypingIndicator(isTyping: boolean): void;
  
  /**
   * Add a message to the UI
   * @param message - Message to add
   */
  addMessage(message: Message): void;
  
  /**
   * Clear all messages from the UI
   */
  clearMessages(): void;
}
```

### MessageList

Component for rendering messages.

```typescript
export class MessageList {
  /**
   * Initialize the component
   * @param container - HTML container element
   * @param eventBus - Event bus instance
   */
  constructor(container: HTMLElement, eventBus: EventBus);
  
  /**
   * Render all messages
   * @param messages - Array of messages to render
   */
  render(messages: Message[]): void;
  
  /**
   * Add a single message to the list
   * @param message - Message to add
   */
  addMessage(message: Message): void;
  
  /**
   * Update a message in the list
   * @param messageId - Message ID
   * @param updates - Updates to apply
   */
  updateMessage(messageId: string, updates: Partial<Message>): void;
  
  /**
   * Clear all messages
   */
  clear(): void;
  
  /**
   * Scroll to the bottom of the list
   */
  scrollToBottom(): void;
}
```

### InputArea

Component for message input.

```typescript
export class InputArea {
  /**
   * Initialize the component
   * @param container - HTML container element
   * @param eventBus - Event bus instance
   */
  constructor(container: HTMLElement, eventBus: EventBus);
  
  /**
   * Get the input value
   * @returns Current input text
   */
  getValue(): string;
  
  /**
   * Set the input value
   * @param value - Text to set
   */
  setValue(value: string): void;
  
  /**
   * Clear the input
   */
  clear(): void;
  
  /**
   * Focus the input
   */
  focus(): void;
  
  /**
   * Enable or disable the input
   * @param enabled - Whether input is enabled
   */
  setEnabled(enabled: boolean): void;
}
```

## Agent System APIs

### AgentSystem

Manages agent execution and coordination.

```typescript
export class AgentSystem {
  /**
   * Initialize the agent system
   * @returns Promise resolving when initialization is complete
   */
  async initialize(): Promise<void>;
  
  /**
   * Register an agent
   * @param agent - Agent instance
   */
  registerAgent(agent: IAgent): void;
  
  /**
   * Get an agent by name
   * @param name - Agent name
   * @returns Agent instance or undefined
   */
  getAgent(name: string): IAgent | undefined;
  
  /**
   * Execute an agent mode
   * @param agentName - Agent name
   * @param mode - Mode name
   * @param params - Mode parameters
   * @returns Promise resolving to execution result
   */
  async executeAgentMode(
    agentName: string, 
    mode: string, 
    params: any
  ): Promise<any>;
  
  /**
   * Get all registered agents
   * @returns Array of agents
   */
  getAgents(): IAgent[];
}
```

### Agent Interfaces

```typescript
export interface IAgent {
  name: string;
  description: string;
  version: string;
  
  /**
   * Get all modes supported by this agent
   * @returns Array of modes
   */
  getModes(): IMode[];
  
  /**
   * Get a specific mode
   * @param modeSlug - Mode slug
   * @returns Mode or undefined
   */
  getMode(modeSlug: string): IMode | undefined;
  
  /**
   * Initialize the agent
   * @returns Promise resolving when initialization is complete
   */
  initialize(): Promise<void>;
  
  /**
   * Execute a mode
   * @param modeSlug - Mode slug
   * @param params - Mode parameters
   * @returns Promise resolving to execution result
   */
  executeMode(modeSlug: string, params: any): Promise<any>;
}

export interface IMode<T = any, R = any> {
  slug: string;
  name: string;
  description: string;
  version: string;
  
  /**
   * Execute the mode
   * @param params - Mode parameters
   * @returns Promise resolving to execution result
   */
  execute(params: T): Promise<R>;
  
  /**
   * Get parameter schema
   * @returns JSON Schema for parameters
   */
  getParameterSchema(): any;
  
  /**
   * Get result schema
   * @returns JSON Schema for result
   */
  getResultSchema(): any;
}
```

## Event Types

Chatsidian uses a centralized event system. Here are the main event types:

| Event Name | Data Type | Description |
|------------|-----------|-------------|
| `conversation:created` | `Conversation` | A new conversation was created |
| `conversation:loaded` | `Conversation` | A conversation was loaded |
| `conversation:switched` | `string` (ID) | The active conversation changed |
| `conversation:messageAdded` | `{ conversationId: string, message: Message }` | A message was added to a conversation |
| `conversation:toolResultAdded` | `{ conversationId: string, messageId: string, toolCallId: string, result: any }` | A tool result was added |
| `conversation:updated` | `Conversation` | A conversation was updated |
| `conversation:deleted` | `string` (ID) | A conversation was deleted |
| `settings:changed` | `ChatsidianSettings` | Settings were updated |
| `tool:register` | `{ name: string, description: string, handler: Function, schema: any }` | A tool was registered |
| `tool:unregister` | `string` (name) | A tool was unregistered |
| `tools:changed` | none | The available tools changed |
| `ui:typingIndicator` | `boolean` | Typing indicator state changed |
| `bcp:load` | `string` (domain) | Request to load a BCP |
| `bcp:unload` | `string` (domain) | Request to unload a BCP |
| `bcp:list` | none | Request to list available BCPs |

## Integration Examples

### Registering Custom Tools

```typescript
// Register a custom tool programmatically
const toolManager = plugin.toolManager;

toolManager.registerTool(
  'CustomDomain.myTool',
  'Custom tool description',
  async (params) => {
    // Implementation
    return { result: 'success' };
  },
  {
    type: 'object',
    required: ['param1'],
    properties: {
      param1: {
        type: 'string',
        description: 'Parameter description'
      }
    }
  }
);
```

### Creating a Custom BCP

```typescript
// Create a custom BCP
import { BoundedContextPack } from 'chatsidian';

const myPack: BoundedContextPack = {
  domain: 'CustomDomain',
  description: 'Custom domain for special operations',
  tools: [
    {
      name: 'myTool',
      description: 'Custom tool description',
      schema: { /* JSON Schema */ },
      handler: async (params) => {
        // Implementation
        return { result: 'success' };
      }
    }
  ]
};

// Register the pack
plugin.bcpRegistry.registerPack(myPack);
```

### Listening for Events

```typescript
// Subscribe to events
const eventBus = plugin.eventBus;

// Listen for new messages
eventBus.on('conversation:messageAdded', (data) => {
  const { conversationId, message } = data;
  console.log(`New message in conversation ${conversationId}:`, message);
});

// Listen for tool calls
eventBus.on('tool:called', (data) => {
  const { name, params, result } = data;
  console.log(`Tool ${name} called with params:`, params);
  console.log('Result:', result);
});
```

## Extending Chatsidian

Chatsidian is designed to be extended with plugins. Here are the main extension points:

### Custom UI Components

```typescript
// Create a custom UI component
class CustomComponent extends ChatComponent {
  constructor(container: HTMLElement, eventBus: EventBus) {
    super(container, eventBus);
    // Initialize
  }
  
  render() {
    // Custom rendering logic
  }
}

// Register with chat view
plugin.registerChatComponent('custom', CustomComponent);
```

### Custom Agents

```typescript
// Create a custom agent
class CustomAgent extends BaseAgent {
  constructor(app: App) {
    super('CustomAgent', 'Custom agent description', '1.0.0');
    
    // Register modes
    this.registerMode(new CustomMode(app));
  }
}

// Register with agent system
plugin.agentSystem.registerAgent(new CustomAgent(plugin.app));
```

### Custom API Providers

```typescript
// Create a custom API provider
class CustomProvider implements APIProvider {
  name = 'custom';
  
  async sendMessage(messages: any, options: APIOptions): Promise<any> {
    // Custom implementation
  }
  
  async streamMessage(
    messages: any, 
    options: APIOptions, 
    onChunk: (chunk: any) => void
  ): Promise<any> {
    // Custom implementation
  }
  
  formatMessages(messages: Message[]): any {
    // Format conversion
  }
  
  parseResponse(response: any): AIMessage {
    // Response parsing
  }
  
  extractToolCalls(response: any): ToolCall[] {
    // Tool call extraction
  }
}

// Register with MCP client
plugin.mcpClient.registerProvider('custom', new CustomProvider());
```

## Best Practices

1. **Event-driven architecture** - Use the event system for communication between components
2. **Async operations** - Use async/await for all I/O operations
3. **Error handling** - Properly handle and report errors
4. **Type safety** - Use TypeScript interfaces and types
5. **Testability** - Design components with testing in mind
6. **Performance** - Consider performance implications, especially with large conversations

## Compatibility Notes

- The plugin requires Obsidian v1.0.0 or later
- MCP integration is compatible with the Model Context Protocol specification v1.0
- API providers support Anthropic API v2023-06-01 and OpenAI API v2023-05-15

## Versioning

Chatsidian follows semantic versioning (SemVer):

- Major version: Breaking API changes
- Minor version: New features without breaking changes
- Patch version: Bug fixes and minor improvements

## Security Considerations

- API keys are stored securely in Obsidian's secure storage
- Tool calls are validated against schemas before execution
- Permissions are checked before file operations
- Conversations are stored within the vault for data sovereignty