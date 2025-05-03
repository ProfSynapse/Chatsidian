---
title: Phase 2.6 - MCP Client Core Implementation
description: Implementation plan for the core Model Context Protocol (MCP) client in Chatsidian
date: 2025-05-03
status: implementation
tags:
  - implementation
  - phase-2
  - mcp-client
  - ai-integration
  - messaging
---

# Phase 2.6: MCP Client Core Implementation

## Overview

This micro-phase focuses on implementing the core Model Context Protocol (MCP) client for Chatsidian. The MCP client is responsible for establishing communication between Obsidian and AI models, enabling AI assistants to understand and manipulate the vault through the tools implemented in previous phases. The MCP client handles message formatting, context management, and the execution of tool calls requested by AI models.

## Goals

- Implement the core MCP client for communication with AI providers
- Create provider adapters for different AI services (e.g., Anthropic, OpenAI)
- Define message formatting and handling for the MCP protocol
- Implement tool call handling and response processing
- Create a mechanism for managing conversation context
- Ensure secure handling of API keys and authentication

## Implementation Steps

### 1. Define MCP Core Interfaces

First, let's define the core interfaces for the MCP client:

```typescript
/**
 * Message role types
 */
export enum MessageRole {
  System = 'system',
  User = 'user',
  Assistant = 'assistant',
  Tool = 'tool'
}

/**
 * Base message interface
 */
export interface Message {
  /**
   * Message role
   */
  role: MessageRole;
  
  /**
   * Message content
   */
  content: string;
}

/**
 * Tool call from AI assistant
 */
export interface ToolCall {
  /**
   * Tool call ID
   */
  id: string;
  
  /**
   * Tool name
   */
  name: string;
  
  /**
   * Tool arguments
   */
  arguments: Record<string, any>;
}

/**
 * Tool result
 */
export interface ToolResult {
  /**
   * Tool call ID this result is for
   */
  tool_call_id: string;
  
  /**
   * Result content
   */
  content: string;
}

/**
 * Assistant message with tool calls
 */
export interface AssistantMessage extends Message {
  /**
   * Role must be assistant
   */
  role: MessageRole.Assistant;
  
  /**
   * Optional tool calls
   */
  tool_calls?: ToolCall[];
}

/**
 * Tool message with result
 */
export interface ToolMessage extends Message {
  /**
   * Role must be tool
   */
  role: MessageRole.Tool;
  
  /**
   * Tool call ID this message is for
   */
  tool_call_id: string;
}

/**
 * Conversation for context management
 */
export interface Conversation {
  /**
   * Conversation ID
   */
  id: string;
  
  /**
   * Conversation title
   */
  title: string;
  
  /**
   * Messages in the conversation
   */
  messages: (Message | AssistantMessage | ToolMessage)[];
  
  /**
   * Metadata for the conversation
   */
  metadata?: Record<string, any>;
}

/**
 * Options for AI model requests
 */
export interface ModelRequestOptions {
  /**
   * Model to use
   */
  model: string;
  
  /**
   * Temperature (0-1)
   */
  temperature?: number;
  
  /**
   * Maximum tokens to generate
   */
  max_tokens?: number;
  
  /**
   * Whether to stream responses
   */
  stream?: boolean;
  
  /**
   * Available tools
   */
  tools?: any[];
}

/**
 * Interface for AI provider adapters
 */
export interface ProviderAdapter {
  /**
   * Send a message to the AI provider
   * @param messages - Messages for context
   * @param options - Request options
   * @returns Promise resolving to the response
   */
  sendMessage(
    messages: (Message | AssistantMessage | ToolMessage)[],
    options: ModelRequestOptions
  ): Promise<AssistantMessage>;
  
  /**
   * Stream a message from the AI provider
   * @param messages - Messages for context
   * @param options - Request options
   * @param onChunk - Callback for each chunk
   * @returns Promise resolving to the complete response
   */
  streamMessage(
    messages: (Message | AssistantMessage | ToolMessage)[],
    options: ModelRequestOptions,
    onChunk: (chunk: any) => void
  ): Promise<AssistantMessage>;
  
  /**
   * Test the connection to the provider
   * @returns Promise resolving to whether the connection is valid
   */
  testConnection(): Promise<boolean>;
}

/**
 * Interface for the MCP client
 */
export interface IMCPClient {
  /**
   * Initialize the client
   * @returns Promise resolving when initialization is complete
   */
  initialize(): Promise<void>;
  
  /**
   * Send a message to the AI provider
   * @param conversation - Conversation for context
   * @param message - Message to send
   * @param options - Request options
   * @returns Promise resolving to the assistant's response
   */
  sendMessage(
    conversation: Conversation,
    message: Message,
    options?: Partial<ModelRequestOptions>
  ): Promise<AssistantMessage>;
  
  /**
   * Stream a message from the AI provider
   * @param conversation - Conversation for context
   * @param message - Message to send
   * @param options - Request options
   * @param onChunk - Callback for each chunk
   * @returns Promise resolving to the complete response
   */
  streamMessage(
    conversation: Conversation,
    message: Message,
    options?: Partial<ModelRequestOptions>,
    onChunk?: (chunk: any) => void
  ): Promise<AssistantMessage>;
  
  /**
   * Process tool calls in an assistant message
   * @param conversation - Conversation for context
   * @param message - Assistant message with tool calls
   * @returns Promise resolving when tool calls are processed
   */
  processToolCalls(
    conversation: Conversation,
    message: AssistantMessage
  ): Promise<void>;
}
```

### 2. Implement Provider Adapters

Next, let's create adapters for different AI providers, starting with Anthropic's Claude:

```typescript
/**
 * Adapter for Anthropic's Claude API
 */
export class AnthropicAdapter implements ProviderAdapter {
  private apiKey: string;
  private apiUrl: string = 'https://api.anthropic.com/v1/messages';
  private apiVersion: string = '2023-06-01';
  
  /**
   * Create a new Anthropic adapter
   * @param apiKey - Anthropic API key
   */
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  /**
   * Send a message to Claude
   */
  public async sendMessage(
    messages: (Message | AssistantMessage | ToolMessage)[],
    options: ModelRequestOptions
  ): Promise<AssistantMessage> {
    // Format messages for Anthropic API
    const formattedMessages = this.formatMessages(messages);
    
    // Prepare tools if available
    const tools = options.tools ? this.formatTools(options.tools) : undefined;
    
    // Create request body
    const body = {
      model: options.model,
      messages: formattedMessages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 4000,
      tools: tools
    };
    
    // Send request
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'Anthropic-Version': this.apiVersion
      },
      body: JSON.stringify(body)
    });
    
    // Check for errors
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
    }
    
    // Parse response
    const result = await response.json();
    
    // Format response as AssistantMessage
    return this.formatResponse(result);
  }
  
  /**
   * Stream a message from Claude
   */
  public async streamMessage(
    messages: (Message | AssistantMessage | ToolMessage)[],
    options: ModelRequestOptions,
    onChunk: (chunk: any) => void
  ): Promise<AssistantMessage> {
    // Format messages for Anthropic API
    const formattedMessages = this.formatMessages(messages);
    
    // Prepare tools if available
    const tools = options.tools ? this.formatTools(options.tools) : undefined;
    
    // Create request body
    const body = {
      model: options.model,
      messages: formattedMessages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 4000,
      tools: tools,
      stream: true
    };
    
    // Send request
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'Anthropic-Version': this.apiVersion
      },
      body: JSON.stringify(body)
    });
    
    // Check for errors
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
    }
    
    // Process the stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let content = '';
    let toolCalls: ToolCall[] = [];
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }
      
      // Decode chunk
      const chunk = decoder.decode(value);
      
      // Process SSE format
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (!line.startsWith('data:')) {
          continue;
        }
        
        // Extract JSON data
        const data = line.slice(5).trim();
        
        if (data === '[DONE]') {
          break;
        }
        
        try {
          const parsed = JSON.parse(data);
          
          // Handle different event types
          if (parsed.type === 'content_block_delta' && parsed.delta.type === 'text') {
            content += parsed.delta.text;
          } else if (parsed.type === 'tool_use') {
            // Add tool call
            toolCalls.push({
              id: parsed.id,
              name: parsed.name,
              arguments: parsed.input
            });
          }
          
          // Call chunk handler
          onChunk(parsed);
        } catch (error) {
          console.error('Error parsing chunk:', error);
        }
      }
    }
    
    // Return complete message
    return {
      role: MessageRole.Assistant,
      content,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined
    };
  }
  
  /**
   * Test the connection to Anthropic
   */
  public async testConnection(): Promise<boolean> {
    try {
      // Send a simple request to test the API key
      const response = await fetch('https://api.anthropic.com/v1/models', {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey,
          'Anthropic-Version': this.apiVersion
        }
      });
      
      return response.ok;
    } catch (error) {
      console.error('Error testing Anthropic connection:', error);
      return false;
    }
  }
  
  /**
   * Format messages for Anthropic API
   */
  private formatMessages(messages: (Message | AssistantMessage | ToolMessage)[]): any[] {
    return messages.map(message => {
      const formatted: any = {
        role: message.role,
        content: message.content
      };
      
      // Add tool_call_id for tool messages
      if (message.role === MessageRole.Tool) {
        formatted.tool_call_id = (message as ToolMessage).tool_call_id;
      }
      
      return formatted;
    });
  }
  
  /**
   * Format tools for Anthropic API
   */
  private formatTools(tools: any[]): any[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.schema
    }));
  }
  
  /**
   * Format response from Anthropic API
   */
  private formatResponse(response: any): AssistantMessage {
    const message = response.content;
    
    // Convert to AssistantMessage format
    return {
      role: MessageRole.Assistant,
      content: message.text || '',
      tool_calls: message.tool_calls
    };
  }
}
```

### 3. Implement MCP Client

Now, let's implement the core MCP client:

```typescript
/**
 * MCP client for communicating with AI providers
 */
export class MCPClient implements IMCPClient {
  private settings: SettingsManager;
  private toolManager: ToolManager;
  private eventBus: EventBus;
  private provider: ProviderAdapter;
  
  /**
   * Create a new MCP client
   * @param settings - Settings manager for API keys and preferences
   * @param toolManager - Tool manager for tool execution
   * @param eventBus - Event bus for communication
   */
  constructor(
    settings: SettingsManager,
    toolManager: ToolManager,
    eventBus: EventBus
  ) {
    this.settings = settings;
    this.toolManager = toolManager;
    this.eventBus = eventBus;
  }
  
  /**
   * Initialize the client
   */
  public async initialize(): Promise<void> {
    // Get provider from settings
    const providerName = this.settings.getSettings().provider;
    const apiKey = this.settings.getApiKey();
    
    // Create provider adapter
    switch (providerName) {
      case 'anthropic':
        this.provider = new AnthropicAdapter(apiKey);
        break;
        
      case 'openai':
        // this.provider = new OpenAIAdapter(apiKey);
        throw new Error('OpenAI provider not yet implemented');
        
      default:
        throw new Error(`Unknown provider: ${providerName}`);
    }
    
    // Test connection
    const connected = await this.provider.testConnection();
    
    if (!connected) {
      throw new Error(`Failed to connect to ${providerName}`);
    }
    
    // Log initialization
    console.log(`MCP client initialized with provider: ${providerName}`);
  }
  
  /**
   * Send a message to the AI provider
   */
  public async sendMessage(
    conversation: Conversation,
    message: Message,
    options?: Partial<ModelRequestOptions>
  ): Promise<AssistantMessage> {
    try {
      // Add message to conversation
      conversation.messages.push(message);
      
      // Emit event
      this.eventBus.emit('mcp:sendingMessage', {
        conversationId: conversation.id,
        message
      });
      
      // Get available tools
      const tools = this.toolManager.getToolsForMCP();
      
      // Merge options with defaults
      const mergedOptions: ModelRequestOptions = {
        model: options?.model || this.settings.getSettings().model,
        temperature: options?.temperature || this.settings.getSettings().temperature,
        max_tokens: options?.max_tokens || this.settings.getSettings().maxTokens,
        stream: options?.stream || false,
        tools
      };
      
      // Send message to provider
      const response = await this.provider.sendMessage(
        conversation.messages,
        mergedOptions
      );
      
      // Add response to conversation
      conversation.messages.push(response);
      
      // Emit event
      this.eventBus.emit('mcp:receivedMessage', {
        conversationId: conversation.id,
        message: response
      });
      
      // Process tool calls if any
      if (response.tool_calls && response.tool_calls.length > 0) {
        await this.processToolCalls(conversation, response);
      }
      
      return response;
    } catch (error) {
      // Emit error event
      this.eventBus.emit('mcp:error', {
        conversationId: conversation.id,
        error
      });
      
      // Re-throw error
      throw error;
    }
  }
  
  /**
   * Stream a message from the AI provider
   */
  public async streamMessage(
    conversation: Conversation,
    message: Message,
    options?: Partial<ModelRequestOptions>,
    onChunk?: (chunk: any) => void
  ): Promise<AssistantMessage> {
    try {
      // Add message to conversation
      conversation.messages.push(message);
      
      // Emit event
      this.eventBus.emit('mcp:streamingStart', {
        conversationId: conversation.id,
        message
      });
      
      // Get available tools
      const tools = this.toolManager.getToolsForMCP();
      
      // Merge options with defaults
      const mergedOptions: ModelRequestOptions = {
        model: options?.model || this.settings.getSettings().model,
        temperature: options?.temperature || this.settings.getSettings().temperature,
        max_tokens: options?.max_tokens || this.settings.getSettings().maxTokens,
        stream: true,
        tools
      };
      
      // Define chunk handler
      const handleChunk = (chunk: any) => {
        // Emit chunk event
        this.eventBus.emit('mcp:chunk', {
          conversationId: conversation.id,
          chunk
        });
        
        // Call custom handler if provided
        if (onChunk) {
          onChunk(chunk);
        }
      };
      
      // Stream message from provider
      const response = await this.provider.streamMessage(
        conversation.messages,
        mergedOptions,
        handleChunk
      );
      
      // Add response to conversation
      conversation.messages.push(response);
      
      // Emit event
      this.eventBus.emit('mcp:streamingEnd', {
        conversationId: conversation.id,
        message: response
      });
      
      // Process tool calls if any
      if (response.tool_calls && response.tool_calls.length > 0) {
        await this.processToolCalls(conversation, response);
      }
      
      return response;
    } catch (error) {
      // Emit error event
      this.eventBus.emit('mcp:error', {
        conversationId: conversation.id,
        error
      });
      
      // Re-throw error
      throw error;
    }
  }
  
  /**
   * Process tool calls in an assistant message
   */
  public async processToolCalls(
    conversation: Conversation,
    message: AssistantMessage
  ): Promise<void> {
    // Skip if no tool calls
    if (!message.tool_calls || message.tool_calls.length === 0) {
      return;
    }
    
    // Process each tool call
    for (const toolCall of message.tool_calls) {
      try {
        // Emit event
        this.eventBus.emit('mcp:toolCallStart', {
          conversationId: conversation.id,
          messageId: message.id,
          toolCall
        });
        
        // Execute tool call
        const result = await this.toolManager.executeToolCall({
          id: toolCall.id,
          name: toolCall.name,
          arguments: toolCall.arguments,
          status: 'pending'
        });
        
        // Create tool message
        const toolMessage: ToolMessage = {
          role: MessageRole.Tool,
          content: JSON.stringify(result),
          tool_call_id: toolCall.id
        };
        
        // Add to conversation
        conversation.messages.push(toolMessage);
        
        // Emit event
        this.eventBus.emit('mcp:toolCallComplete', {
          conversationId: conversation.id,
          messageId: message.id,
          toolCall,
          result
        });
      } catch (error) {
        // Create error message
        const errorMessage: ToolMessage = {
          role: MessageRole.Tool,
          content: JSON.stringify({
            error: error instanceof Error ? error.message : String(error)
          }),
          tool_call_id: toolCall.id
        };
        
        // Add to conversation
        conversation.messages.push(errorMessage);
        
        // Emit error event
        this.eventBus.emit('mcp:toolCallError', {
          conversationId: conversation.id,
          messageId: message.id,
          toolCall,
          error
        });
      }
    }
  }
}
```

### 4. Implement Conversation Manager

Now, let's implement a conversation manager to handle conversation state:

```typescript
/**
 * Manager for conversations
 */
export class ConversationManager {
  private app: App;
  private settings: SettingsManager;
  private eventBus: EventBus;
  private conversations: Map<string, Conversation> = new Map();
  private currentConversationId: string | null = null;
  private storagePath: string;
  
  /**
   * Create a new conversation manager
   * @param app - Obsidian app
   * @param settings - Settings manager
   * @param eventBus - Event bus
   */
  constructor(
    app: App,
    settings: SettingsManager,
    eventBus: EventBus
  ) {
    this.app = app;
    this.settings = settings;
    this.eventBus = eventBus;
    this.storagePath = '.chatsidian/conversations';
  }
  
  /**
   * Initialize the conversation manager
   */
  public async initialize(): Promise<void> {
    // Create conversations folder if it doesn't exist
    await this.ensureConversationsFolder();
    
    // Load recent conversation
    const recentId = this.settings.getSettings().recentConversationId;
    
    if (recentId) {
      try {
        await this.loadConversation(recentId);
        this.currentConversationId = recentId;
      } catch (error) {
        console.error(`Error loading recent conversation ${recentId}:`, error);
      }
    }
  }
  
  /**
   * Ensure conversations folder exists
   */
  private async ensureConversationsFolder(): Promise<void> {
    // Check if folder exists
    if (!this.app.vault.getAbstractFileByPath(this.storagePath)) {
      // Create folder
      await this.app.vault.createFolder(this.storagePath);
    }
  }
  
  /**
   * Create a new conversation
   * @param title - Conversation title
   * @returns New conversation
   */
  public async createConversation(title?: string): Promise<Conversation> {
    // Generate ID
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2);
    
    // Create conversation
    const conversation: Conversation = {
      id,
      title: title || `Conversation ${new Date().toLocaleString()}`,
      messages: [],
      metadata: {
        created: Date.now(),
        modified: Date.now()
      }
    };
    
    // Add to cache
    this.conversations.set(id, conversation);
    
    // Set as current
    this.currentConversationId = id;
    
    // Update recent conversation
    this.settings.updateSettings({
      recentConversationId: id
    });
    
    // Save to disk
    await this.saveConversation(conversation);
    
    // Emit event
    this.eventBus.emit('conversation:created', conversation);
    
    return conversation;
  }
  
  /**
   * Load a conversation by ID
   * @param id - Conversation ID
   * @returns Loaded conversation
   */
  public async loadConversation(id: string): Promise<Conversation> {
    // Check cache first
    if (this.conversations.has(id)) {
      return this.conversations.get(id);
    }
    
    // Load from disk
    const path = `${this.storagePath}/${id}.json`;
    const file = this.app.vault.getAbstractFileByPath(path);
    
    if (!file) {
      throw new Error(`Conversation not found: ${id}`);
    }
    
    // Read file
    const content = await this.app.vault.read(file as TFile);
    
    // Parse JSON
    const conversation = JSON.parse(content) as Conversation;
    
    // Add to cache
    this.conversations.set(id, conversation);
    
    // Emit event
    this.eventBus.emit('conversation:loaded', conversation);
    
    return conversation;
  }
  
  /**
   * Save a conversation
   * @param conversation - Conversation to save
   */
  public async saveConversation(conversation: Conversation): Promise<void> {
    // Update modification time
    if (conversation.metadata) {
      conversation.metadata.modified = Date.now();
    }
    
    // Convert to JSON
    const content = JSON.stringify(conversation, null, 2);
    
    // Save to disk
    const path = `${this.storagePath}/${conversation.id}.json`;
    const file = this.app.vault.getAbstractFileByPath(path);
    
    if (file) {
      await this.app.vault.modify(file as TFile, content);
    } else {
      await this.app.vault.create(path, content);
    }
    
    // Emit event
    this.eventBus.emit('conversation:saved', conversation);
  }
  
  /**
   * Delete a conversation
   * @param id - Conversation ID
   */
  public async deleteConversation(id: string): Promise<void> {
    // Remove from cache
    this.conversations.delete(id);
    
    // Remove from disk
    const path = `${this.storagePath}/${id}.json`;
    const file = this.app.vault.getAbstractFileByPath(path);
    
    if (file) {
      await this.app.vault.delete(file);
    }
    
    // Update current conversation
    if (this.currentConversationId === id) {
      this.currentConversationId = null;
      
      // Update recent conversation
      this.settings.updateSettings({
        recentConversationId: null
      });
    }
    
    // Emit event
    this.eventBus.emit('conversation:deleted', { id });
  }
  
  /**
   * Get the current conversation
   * @returns Current conversation or null
   */
  public getCurrentConversation(): Conversation | null {
    if (!this.currentConversationId) {
      return null;
    }
    
    return this.conversations.get(this.currentConversationId) || null;
  }
  
  /**
   * Set the current conversation
   * @param id - Conversation ID
   */
  public async setCurrentConversation(id: string): Promise<void> {
    // Load conversation if not in cache
    if (!this.conversations.has(id)) {
      await this.loadConversation(id);
    }
    
    // Set as current
    this.currentConversationId = id;
    
    // Update recent conversation
    this.settings.updateSettings({
      recentConversationId: id
    });
    
    // Emit event
    this.eventBus.emit('conversation:setCurrent', {
      id,
      conversation: this.conversations.get(id)
    });
  }
  
  /**
   * Get all conversations
   * @returns Array of conversations
   */
  public async getAllConversations(): Promise<Conversation[]> {
    // Get all conversation files
    const folder = this.app.vault.getAbstractFileByPath(this.storagePath);
    
    if (!folder || !(folder instanceof TFolder)) {
      return [];
    }
    
    // Load conversations not in cache
    const files = folder.children.filter(file => 
      file instanceof TFile && file.extension === 'json'
    );
    
    // Load each conversation
    for (const file of files) {
      const id = file.basename;
      
      if (!this.conversations.has(id)) {
        try {
          await this.loadConversation(id);
        } catch (error) {
          console.error(`Error loading conversation ${id}:`, error);
        }
      }
    }
    
    // Return all conversations
    return Array.from(this.conversations.values());
  }
  
  /**
   * Add a message to a conversation
   * @param conversationId - Conversation ID
   * @param message - Message to add
   */
  public async addMessage(
    conversationId: string,
    message: Message | AssistantMessage | ToolMessage
  ): Promise<void> {
    // Get conversation
    const conversation = this.conversations.get(conversationId);
    
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    
    // Add message
    conversation.messages.push(message);
    
    // Save conversation
    await this.saveConversation(conversation);
    
    // Emit event
    this.eventBus.emit('conversation:messageAdded', {
      conversationId,
      message
    });
  }
}
```

### 5. Update Plugin Core for MCP Integration

Now, let's update the main plugin class to integrate the MCP client:

```typescript
import { Plugin } from 'obsidian';
import { EventBus } from './core/EventBus';
import { SettingsManager } from './core/SettingsManager';
import { EnhancedVaultFacade } from './core/VaultFacade';
import { BCPRegistry } from './mcp/BCPRegistry';
import { ToolManager } from './mcp/ToolManager';
import { MCPClient } from './mcp/MCPClient';
import { ConversationManager } from './mcp/ConversationManager';
import { BCPContext, registerBCP } from './mcp/BCPFactory';
import { createNoteManagerBCP } from './bcps/NoteManager';
import { createFolderManagerBCP } from './bcps/FolderManager';
import { createVaultLibrarianBCP } from './bcps/VaultLibrarian';
import { createPaletteCommanderBCP } from './bcps/PaletteCommander';
import { MessageRole } from './mcp/interfaces';

export default class ChatsidianPlugin extends Plugin {
  public eventBus: EventBus;
  public settings: SettingsManager;
  public vaultFacade: EnhancedVaultFacade;
  public bcpRegistry: BCPRegistry;
  public toolManager: ToolManager;
  public mcpClient: MCPClient;
  public conversationManager: ConversationManager;
  
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
    
    // Initialize conversation manager
    this.conversationManager = new ConversationManager(
      this.app,
      this.settings,
      this.eventBus
    );
    await this.conversationManager.initialize();
    
    // Initialize MCP client
    this.mcpClient = new MCPClient(
      this.settings,
      this.toolManager,
      this.eventBus
    );
    await this.mcpClient.initialize();
    
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
    
    // Register command to send a message
    this.addCommand({
      id: 'send-message',
      name: 'Send Message to AI',
      callback: async () => {
        // Get current conversation or create one
        let conversation = this.conversationManager.getCurrentConversation();
        
        if (!conversation) {
          conversation = await this.conversationManager.createConversation();
        }
        
        // Get user input
        const message = await this.getUserInput('Enter message');
        
        if (!message) {
          return;
        }
        
        // Send message
        await this.sendMessage(conversation.id, message);
      }
    });
    
    // Register event handlers
    this.registerEvents();
    
    console.log('Chatsidian plugin loaded');
  }
  
  /**
   * Send a message to the AI
   * @param conversationId - Conversation ID
   * @param content - Message content
   */
  public async sendMessage(conversationId: string, content: string): Promise<void> {
    try {
      // Get conversation
      const conversation = await this.conversationManager.loadConversation(conversationId);
      
      // Create user message
      const message = {
        role: MessageRole.User,
        content
      };
      
      // Add to conversation
      await this.conversationManager.addMessage(conversationId, message);
      
      // Send to AI
      const response = await this.mcpClient.sendMessage(conversation, message);
      
      // Add response to conversation
      await this.conversationManager.addMessage(conversationId, response);
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Show error notification
      this.addErrorNotification(`Error sending message: ${error.message}`);
    }
  }
  
  /**
   * Get user input via modal
   * @param placeholder - Input placeholder
   * @returns User input or null if cancelled
   */
  private async getUserInput(placeholder: string): Promise<string | null> {
    return new Promise(resolve => {
      const modal = new Modal(this.app);
      
      modal.contentEl.createEl('textarea', {
        attr: {
          placeholder
        },
        cls: 'chatsidian-input'
      });
      
      const buttonContainer = modal.contentEl.createDiv({
        cls: 'chatsidian-button-container'
      });
      
      buttonContainer.createEl('button', {
        text: 'Cancel',
        cls: 'chatsidian-button-cancel'
      }).addEventListener('click', () => {
        modal.close();
        resolve(null);
      });
      
      buttonContainer.createEl('button', {
        text: 'Send',
        cls: 'chatsidian-button-send'
      }).addEventListener('click', () => {
        const input = modal.contentEl.querySelector('textarea').value;
        modal.close();
        resolve(input);
      });
      
      modal.open();
    });
  }
  
  /**
   * Add error notification
   * @param message - Error message
   */
  private addErrorNotification(message: string): void {
    new Notice(message, 5000);
  }
  
  private registerEvents() {
    // Log MCP events in debug mode
    if (this.settings.getSettings().debugMode) {
      this.eventBus.on('mcp:sendingMessage', data => {
        console.log(`Sending message to ${data.conversationId}`);
      });
      
      this.eventBus.on('mcp:receivedMessage', data => {
        console.log(`Received message from ${data.conversationId}`);
      });
      
      this.eventBus.on('mcp:toolCallStart', data => {
        console.log(`Tool call started: ${data.toolCall.name}`);
      });
      
      this.eventBus.on('mcp:toolCallComplete', data => {
        console.log(`Tool call completed: ${data.toolCall.name}`);
      });
      
      this.eventBus.on('mcp:error', data => {
        console.error(`MCP error in ${data.conversationId}:`, data.error);
      });
    }
  }
  
  onunload() {
    // Clean up resources
    this.eventBus.clear();
  }
}
```

### 6. Create System Prompt Generator

To provide context to the AI about the available tools, let's create a system prompt generator:

```typescript
/**
 * Generate system prompt for AI context
 * @param toolManager - Tool manager
 * @returns System prompt
 */
export function generateSystemPrompt(toolManager: ToolManager): string {
  // Get all tools
  const tools = toolManager.getTools();
  
  // Group tools by domain
  const domains = new Map<string, Tool[]>();
  
  for (const tool of tools) {
    const [domain, name] = tool.name.split('.');
    
    if (!domains.has(domain)) {
      domains.set(domain, []);
    }
    
    domains.get(domain).push({
      ...tool,
      name // Use short name without domain prefix
    });
  }
  
  // Build system prompt
  let prompt = `# Chatsidian

You are Claude, an AI assistant helping with Obsidian vault management through Chatsidian.

## Available Tools

You have access to the following tools to help interact with the Obsidian vault:

`;

  // Add tool documentation
  for (const [domain, domainTools] of domains.entries()) {
    prompt += `### ${domain}\n\n`;
    
    for (const tool of domainTools) {
      prompt += `#### ${tool.name}\n\n`;
      prompt += `${tool.description}\n\n`;
      
      // Add parameters
      if (tool.schema && tool.schema.properties) {
        prompt += '**Parameters:**\n';
        
        for (const [paramName, param] of Object.entries(tool.schema.properties)) {
          const required = tool.schema.required && tool.schema.required.includes(paramName);
          
          prompt += `- \`${paramName}\` (${param.type}${required ? ', required' : ''}): ${param.description}\n`;
        }
        
        prompt += '\n';
      }
      
      // Add example JSON
      if (tool.schema && tool.schema.properties) {
        prompt += '**Example:**\n```json\n{\n';
        
        for (const [paramName, param] of Object.entries(tool.schema.properties)) {
          // Skip this parameter in example if it's optional and complex
          if (!tool.schema.required || !tool.schema.required.includes(paramName)) {
            if (param.type === 'array' || param.type === 'object') {
              continue;
            }
          }
          
          let exampleValue: any;
          
          switch (param.type) {
            case 'string':
              if (param.enum) {
                exampleValue = `"${param.enum[0]}"`;
              } else if (paramName.includes('path')) {
                exampleValue = '"Projects/Example.md"';
              } else {
                exampleValue = '"example"';
              }
              break;
              
            case 'number':
              exampleValue = param.minimum || 0;
              break;
              
            case 'boolean':
              exampleValue = false;
              break;
              
            case 'array':
              exampleValue = '[]';
              break;
              
            case 'object':
              exampleValue = '{}';
              break;
              
            default:
              exampleValue = 'null';
          }
          
          prompt += `  "${paramName}": ${exampleValue}${Object.keys(tool.schema.properties).pop() !== paramName ? ',' : ''}\n`;
        }
        
        prompt += '}\n```\n\n';
      }
    }
  }
  
  // Add Best Practices
  prompt += `## Best Practices

1. **Use appropriate tools for the task**: Choose the most specific tool for each operation.
2. **Handle errors gracefully**: Check for common errors like missing files.
3. **Minimize tool calls**: Batch operations when possible to reduce overhead.
4. **Preserve user content**: Be careful when modifying or deleting files.
5. **Use absolute paths**: Always use complete paths from the vault root.
6. **Validate inputs**: Ensure paths and parameters are valid before operating on them.

You should help the user manage their Obsidian vault efficiently by using these tools. When asked to perform a task, first think about which tools are needed, then execute them in the appropriate order, and finally summarize the results in a helpful way.`;

  return prompt;
}
```

## Documentation References

- [[💻 Coding/Projects/Chatsidian/1_Architecture/Overview]]
- [[💻 Coding/Projects/Chatsidian/1_Architecture/Components/MCPConnector]]
- [[💻 Coding/Projects/Chatsidian/4_Documentation/APIs]]
- [[💻 Coding/Projects/Chatsidian/4_Documentation/MCPStreamingImplementation]]
- [[💻 Coding/Projects/Chatsidian/3_Implementation/Phase2.3-Tool-Manager-Implementation]]
- [[💻 Coding/Projects/Chatsidian/3_Implementation/Phase2.5-Initial-BCPs-Implementation]]

## Testing Strategy

### Unit Tests

- Test provider adapters with mock API responses
- Test conversation management
- Test system prompt generation
- Test MCP client with mock providers

```typescript
// Example unit test for Anthropic adapter
describe('AnthropicAdapter', () => {
  let adapter: AnthropicAdapter;
  let fetchMock: jest.SpyInstance;
  
  beforeEach(() => {
    adapter = new AnthropicAdapter('test-api-key');
    
    // Mock fetch
    fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        content: [
          {
            type: 'text',
            text: 'This is a test response'
          }
        ],
        model: 'claude-3-opus-20240229',
        id: 'test-id'
      }),
      status: 200,
      statusText: 'OK'
    }));
  });
  
  afterEach(() => {
    fetchMock.mockRestore();
  });
  
  test('should format messages correctly', async () => {
    // Create messages
    const messages = [
      {
        role: MessageRole.System,
        content: 'You are a helpful assistant'
      },
      {
        role: MessageRole.User,
        content: 'Hello, world!'
      }
    ];
    
    // Call sendMessage
    await adapter.sendMessage(messages, {
      model: 'claude-3-opus-20240229'
    });
    
    // Verify fetch was called with correct parameters
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-API-Key': 'test-api-key',
          'Anthropic-Version': '2023-06-01'
        }),
        body: expect.any(String)
      })
    );
    
    // Verify request body
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    
    expect(requestBody).toEqual({
      model: 'claude-3-opus-20240229',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant'
        },
        {
          role: 'user',
          content: 'Hello, world!'
        }
      ],
      temperature: 0.7,
      max_tokens: 4000
    });
  });
  
  test('should format response correctly', async () => {
    // Create messages
    const messages = [
      {
        role: MessageRole.User,
        content: 'Hello, world!'
      }
    ];
    
    // Call sendMessage
    const response = await adapter.sendMessage(messages, {
      model: 'claude-3-opus-20240229'
    });
    
    // Verify response
    expect(response).toEqual({
      role: MessageRole.Assistant,
      content: 'This is a test response'
    });
  });
});
```

### Integration Tests

- Test full MCP client with actual API calls (using test API keys)
- Test conversation flow with tool calls
- Test error handling and recovery

## Next Steps

Phase 2.7 will focus on implementing advanced MCP features like streaming, building on the foundation established in this phase. Future phases will include:

1. Adding a user interface for the chat interaction
2. Implementing conversation history and management
3. Enhancing the system prompt with more vault context
4. Implementing more AI providers
5. Adding support for specialized agents with different capabilities
