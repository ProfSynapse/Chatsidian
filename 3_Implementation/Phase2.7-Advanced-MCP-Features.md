---
title: Phase 2.7 - Advanced MCP Features
description: Implementation plan for advanced Model Context Protocol (MCP) features in Chatsidian
date: 2025-05-03
status: implementation
tags:
  - implementation
  - phase-2
  - mcp
  - streaming
  - error-handling
  - message-chain
---

# Phase 2.7: Advanced MCP Features

## Overview

This micro-phase focuses on enhancing the MCP client with advanced capabilities that enable more robust and user-friendly AI interactions. Building on the core MCP client implementation from Phase 2.6, we'll add streaming support for real-time responses, handle tool call results more effectively, implement message chain management for maintaining conversation context, create a response processing pipeline for consistency, and implement error recovery strategies for graceful error handling.

## Goals

- Implement streaming support for real-time AI responses
- Add comprehensive tool call results handling
- Create a message chain management system
- Implement a response processing pipeline
- Add error recovery strategies for AI interactions

## Implementation Steps

### 1. Implement Streaming Support

First, let's enhance the MCP client with streaming support to provide real-time responses:

```typescript
/**
 * Interface for streaming handlers
 */
export interface StreamHandlers {
  /**
   * Called when streaming starts
   */
  onStart?: () => void;
  
  /**
   * Called for each content token
   * @param token - Content token
   */
  onToken?: (token: string) => void;
  
  /**
   * Called for each tool call
   * @param toolCall - Tool call
   */
  onToolCall?: (toolCall: ToolCall) => void;
  
  /**
   * Called when streaming ends
   * @param message - Complete message
   */
  onEnd?: (message: AssistantMessage) => void;
  
  /**
   * Called when an error occurs
   * @param error - Error object
   */
  onError?: (error: Error) => void;
}

/**
 * Enhanced MCP client with streaming support
 */
export class EnhancedMCPClient extends MCPClient {
  /**
   * Stream a message with enhanced handlers
   * @param conversation - Conversation for context
   * @param message - Message to send
   * @param handlers - Stream handlers
   * @param options - Request options
   * @returns Promise resolving when streaming completes
   */
  public async streamMessageWithHandlers(
    conversation: Conversation,
    message: Message,
    handlers: StreamHandlers,
    options?: Partial<ModelRequestOptions>
  ): Promise<AssistantMessage> {
    try {
      // Call onStart handler
      if (handlers.onStart) {
        handlers.onStart();
      }
      
      // Add message to conversation
      conversation.messages.push(message);
      
      // Emit event
      this.eventBus.emit('mcp:streamingStart', {
        conversationId: conversation.id,
        message
      });
      
      // Create response placeholder
      let contentBuilder = '';
      let toolCalls: ToolCall[] = [];
      
      // Define chunk handler
      const handleChunk = (chunk: any) => {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text') {
          // Extract content token
          const token = chunk.delta.text;
          
          // Add to content builder
          contentBuilder += token;
          
          // Call token handler
          if (handlers.onToken) {
            handlers.onToken(token);
          }
        } else if (chunk.type === 'tool_use') {
          // Extract tool call
          const toolCall: ToolCall = {
            id: chunk.id,
            name: chunk.name,
            arguments: chunk.input
          };
          
          // Add to tool calls
          toolCalls.push(toolCall);
          
          // Call tool call handler
          if (handlers.onToolCall) {
            handlers.onToolCall(toolCall);
          }
        }
        
        // Emit chunk event
        this.eventBus.emit('mcp:chunk', {
          conversationId: conversation.id,
          chunk
        });
      };
      
      // Stream message from provider
      const response = await super.streamMessage(
        conversation,
        message,
        options,
        handleChunk
      );
      
      // Call onEnd handler
      if (handlers.onEnd) {
        handlers.onEnd(response);
      }
      
      return response;
    } catch (error) {
      // Call onError handler
      if (handlers.onError) {
        handlers.onError(error);
      }
      
      // Re-throw error
      throw error;
    }
  }
  
  /**
   * Stream a message with UI updates
   * @param conversation - Conversation for context
   * @param message - Message to send
   * @param contentEl - Element to update with content
   * @param options - Request options
   * @returns Promise resolving when streaming completes
   */
  public async streamMessageWithUI(
    conversation: Conversation,
    message: Message,
    contentEl: HTMLElement,
    options?: Partial<ModelRequestOptions>
  ): Promise<AssistantMessage> {
    // Set up handlers
    const handlers: StreamHandlers = {
      onStart: () => {
        // Add loading indicator
        contentEl.empty();
        contentEl.createSpan({
          text: 'Thinking...',
          cls: 'chatsidian-thinking'
        });
      },
      
      onToken: (token) => {
        // Remove loading indicator on first token
        if (contentEl.querySelector('.chatsidian-thinking')) {
          contentEl.empty();
        }
        
        // Append token
        contentEl.createSpan({
          text: token,
          cls: 'chatsidian-token'
        });
      },
      
      onToolCall: (toolCall) => {
        // Show tool call
        const toolCallEl = contentEl.createDiv({
          cls: 'chatsidian-tool-call'
        });
        
        toolCallEl.createEl('strong', {
          text: `Using tool: ${toolCall.name}`
        });
        
        // Add spinner
        toolCallEl.createSpan({
          text: ' ⌛',
          cls: 'chatsidian-tool-spinner'
        });
      },
      
      onEnd: () => {
        // Remove any remaining spinners
        const spinners = contentEl.querySelectorAll('.chatsidian-tool-spinner');
        spinners.forEach(spinner => spinner.remove());
        
        // Add completed indicator
        contentEl.createSpan({
          text: ' ✓',
          cls: 'chatsidian-complete'
        });
      },
      
      onError: (error) => {
        // Show error
        contentEl.empty();
        contentEl.createEl('strong', {
          text: 'Error: ',
          cls: 'chatsidian-error'
        });
        
        contentEl.createSpan({
          text: error.message,
          cls: 'chatsidian-error-message'
        });
      }
    };
    
    // Use streamMessageWithHandlers
    return await this.streamMessageWithHandlers(
      conversation,
      message,
      handlers,
      options
    );
  }
}
```

### 2. Add Tool Call Results Handling

Next, let's implement enhanced tool call results handling:

```typescript
/**
 * Tool call status
 */
export enum ToolCallStatus {
  Pending = 'pending',
  Running = 'running',
  Success = 'success',
  Error = 'error'
}

/**
 * Tool call with execution status
 */
export interface ToolCallExecution {
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
  
  /**
   * Execution status
   */
  status: ToolCallStatus;
  
  /**
   * Execution result (if status is success)
   */
  result?: any;
  
  /**
   * Error (if status is error)
   */
  error?: Error | string;
  
  /**
   * Execution time in milliseconds
   */
  executionTime?: number;
  
  /**
   * Timestamp when execution started
   */
  startTime?: number;
  
  /**
   * Timestamp when execution ended
   */
  endTime?: number;
}

/**
 * Enhanced MCP client with improved tool call handling
 */
export class ToolAwareMCPClient extends EnhancedMCPClient {
  /**
   * Process tool calls with enhanced tracking
   * @param conversation - Conversation for context
   * @param message - Assistant message with tool calls
   * @returns Promise resolving with tool call executions
   */
  public async processToolCallsWithTracking(
    conversation: Conversation,
    message: AssistantMessage
  ): Promise<ToolCallExecution[]> {
    // Skip if no tool calls
    if (!message.tool_calls || message.tool_calls.length === 0) {
      return [];
    }
    
    // Map to track executions
    const executions: ToolCallExecution[] = message.tool_calls.map(toolCall => ({
      id: toolCall.id,
      name: toolCall.name,
      arguments: toolCall.arguments,
      status: ToolCallStatus.Pending
    }));
    
    // Process each tool call
    for (const execution of executions) {
      try {
        // Update status
        execution.status = ToolCallStatus.Running;
        execution.startTime = Date.now();
        
        // Emit event
        this.eventBus.emit('mcp:toolCallStart', {
          conversationId: conversation.id,
          execution
        });
        
        // Execute tool call
        const result = await this.toolManager.executeToolCall({
          id: execution.id,
          name: execution.name,
          arguments: execution.arguments,
          status: 'pending'
        });
        
        // Update execution
        execution.status = ToolCallStatus.Success;
        execution.result = result;
        execution.endTime = Date.now();
        execution.executionTime = execution.endTime - execution.startTime;
        
        // Create tool message
        const toolMessage: ToolMessage = {
          role: MessageRole.Tool,
          content: JSON.stringify(result),
          tool_call_id: execution.id
        };
        
        // Add to conversation
        conversation.messages.push(toolMessage);
        
        // Emit event
        this.eventBus.emit('mcp:toolCallComplete', {
          conversationId: conversation.id,
          execution
        });
      } catch (error) {
        // Update execution
        execution.status = ToolCallStatus.Error;
        execution.error = error;
        execution.endTime = Date.now();
        execution.executionTime = execution.endTime - execution.startTime;
        
        // Create error message
        const errorMessage: ToolMessage = {
          role: MessageRole.Tool,
          content: JSON.stringify({
            error: error instanceof Error ? error.message : String(error)
          }),
          tool_call_id: execution.id
        };
        
        // Add to conversation
        conversation.messages.push(errorMessage);
        
        // Emit error event
        this.eventBus.emit('mcp:toolCallError', {
          conversationId: conversation.id,
          execution,
          error
        });
      }
    }
    
    return executions;
  }
  
  /**
   * Execute a full conversation turn with tool call handling
   * @param conversation - Conversation for context
   * @param message - User message
   * @param contentEl - Element to update with content
   * @param options - Request options
   * @returns Promise resolving when the turn is complete
   */
  public async executeConversationTurn(
    conversation: Conversation,
    message: Message,
    contentEl: HTMLElement,
    options?: Partial<ModelRequestOptions>
  ): Promise<AssistantMessage> {
    // Stream initial response
    const response = await this.streamMessageWithUI(
      conversation,
      message,
      contentEl,
      options
    );
    
    // Check for tool calls
    if (response.tool_calls && response.tool_calls.length > 0) {
      // Create tool calls section
      const toolCallsEl = contentEl.createDiv({
        cls: 'chatsidian-tool-calls-section'
      });
      
      toolCallsEl.createEl('h4', {
        text: 'Executing tools...'
      });
      
      // Process tool calls
      const executions = await this.processToolCallsWithTracking(conversation, response);
      
      // Display results
      const resultsEl = toolCallsEl.createDiv({
        cls: 'chatsidian-tool-results'
      });
      
      // For each execution
      for (const execution of executions) {
        const executionEl = resultsEl.createDiv({
          cls: `chatsidian-tool-execution chatsidian-tool-status-${execution.status}`
        });
        
        executionEl.createEl('strong', {
          text: execution.name
        });
        
        executionEl.createSpan({
          text: ` (${execution.executionTime}ms): `
        });
        
        if (execution.status === ToolCallStatus.Success) {
          executionEl.createSpan({
            text: JSON.stringify(execution.result, null, 2),
            cls: 'chatsidian-tool-result'
          });
        } else if (execution.status === ToolCallStatus.Error) {
          executionEl.createSpan({
            text: String(execution.error),
            cls: 'chatsidian-tool-error'
          });
        }
      }
      
      // If there were tool calls, we need to follow up with another message
      const followUpResponse = await this.streamMessageWithUI(
        conversation,
        {
          role: MessageRole.User,
          content: 'Please continue based on the tool results.'
        },
        contentEl.createDiv({ cls: 'chatsidian-follow-up' }),
        options
      );
      
      // Return the follow-up response
      return followUpResponse;
    }
    
    // Return the original response if no tool calls
    return response;
  }
}
```

### 3. Create Message Chain Management

Let's implement a system for managing message chains to handle context and context windows:

```typescript
/**
 * Message chain manager for conversation context
 */
export class MessageChainManager {
  /**
   * Maximum number of messages to include in context
   */
  private maxMessages: number;
  
  /**
   * Maximum number of tokens to include in context
   */
  private maxTokens: number;
  
  /**
   * Token counter function
   */
  private tokenCounter: (message: Message) => number;
  
  /**
   * Create a new message chain manager
   * @param options - Configuration options
   */
  constructor(options: {
    maxMessages?: number;
    maxTokens?: number;
    tokenCounter?: (message: Message) => number;
  }) {
    this.maxMessages = options.maxMessages || 100;
    this.maxTokens = options.maxTokens || 16000;
    this.tokenCounter = options.tokenCounter || this.simpleTokenCounter;
  }
  
  /**
   * Simple token counter (rough approximation)
   * @param message - Message to count tokens for
   * @returns Estimated token count
   */
  private simpleTokenCounter(message: Message): number {
    // Rough approximation: 1 token per 4 characters (English text average)
    return Math.ceil((JSON.stringify(message).length + message.content.length) / 4);
  }
  
  /**
   * Filter system messages
   * @param messages - Messages to filter
   * @returns System messages only
   */
  private getSystemMessages(messages: Message[]): Message[] {
    return messages.filter(msg => msg.role === MessageRole.System);
  }
  
  /**
   * Get critical tool messages needed for context
   * @param messages - Messages to filter
   * @param recentToolCallIds - Recent tool call IDs
   * @returns Tool messages needed for context
   */
  private getCriticalToolMessages(
    messages: (Message | AssistantMessage | ToolMessage)[],
    recentToolCallIds: string[]
  ): ToolMessage[] {
    return messages.filter(
      msg => msg.role === MessageRole.Tool && 
             recentToolCallIds.includes((msg as ToolMessage).tool_call_id)
    ) as ToolMessage[];
  }
  
  /**
   * Get messages for context, respecting limits
   * @param conversation - Conversation
   * @returns Messages to include in context
   */
  public getContextMessages(conversation: Conversation): Message[] {
    const allMessages = conversation.messages;
    
    // Always include system messages
    const systemMessages = this.getSystemMessages(allMessages);
    
    // Find recent tool call IDs (from most recent assistant messages)
    const recentToolCallIds: string[] = [];
    
    // Scan from most recent messages backwards
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const msg = allMessages[i];
      
      if (msg.role === MessageRole.Assistant && (msg as AssistantMessage).tool_calls) {
        const toolCalls = (msg as AssistantMessage).tool_calls;
        
        if (toolCalls) {
          toolCalls.forEach(tc => recentToolCallIds.push(tc.id));
        }
      }
    }
    
    // Get critical tool messages
    const criticalToolMessages = this.getCriticalToolMessages(
      allMessages, 
      recentToolCallIds
    );
    
    // Token counts for required messages
    const systemTokens = systemMessages.reduce(
      (sum, msg) => sum + this.tokenCounter(msg), 
      0
    );
    
    const toolTokens = criticalToolMessages.reduce(
      (sum, msg) => sum + this.tokenCounter(msg), 
      0
    );
    
    // Remaining tokens for conversation
    const remainingTokens = this.maxTokens - systemTokens - toolTokens;
    
    // Get conversation messages (excluding system and tool)
    const conversationMessages = allMessages.filter(
      msg => msg.role !== MessageRole.System && 
             !(msg.role === MessageRole.Tool && 
               recentToolCallIds.includes((msg as ToolMessage).tool_call_id))
    );
    
    // Select messages from most recent backwards
    const selectedMessages: Message[] = [];
    let currentTokens = 0;
    
    // Start from most recent
    for (let i = conversationMessages.length - 1; i >= 0; i--) {
      const msg = conversationMessages[i];
      const msgTokens = this.tokenCounter(msg);
      
      // Check if adding this message would exceed limits
      if (selectedMessages.length >= this.maxMessages - systemMessages.length - criticalToolMessages.length) {
        break;
      }
      
      if (currentTokens + msgTokens > remainingTokens) {
        break;
      }
      
      // Add message
      selectedMessages.unshift(msg);
      currentTokens += msgTokens;
    }
    
    // Combine all message types in the correct order
    return [
      ...systemMessages,
      ...selectedMessages,
      ...criticalToolMessages
    ];
  }
  
  /**
   * Compress conversation to stay within limits
   * @param conversation - Conversation to compress
   * @returns Compressed conversation
   */
  public compressConversation(conversation: Conversation): Conversation {
    // Get context messages
    const contextMessages = this.getContextMessages(conversation);
    
    // Create compressed conversation
    return {
      id: conversation.id,
      title: conversation.title,
      messages: contextMessages,
      metadata: {
        ...conversation.metadata,
        compressed: true,
        originalMessageCount: conversation.messages.length
      }
    };
  }
  
  /**
   * Summarize conversation history that would be truncated
   * @param conversation - Conversation to summarize
   * @returns Summary of older messages
   */
  public async summarizeOlderMessages(
    conversation: Conversation,
    ai: MCPClient
  ): Promise<string> {
    // Get messages that would be included in context
    const contextMessages = this.getContextMessages(conversation);
    const contextMessageIds = new Set(contextMessages.map(msg => JSON.stringify(msg)));
    
    // Find messages that would be excluded
    const excludedMessages = conversation.messages.filter(
      msg => !contextMessageIds.has(JSON.stringify(msg))
    );
    
    // If no excluded messages, return empty summary
    if (excludedMessages.length === 0) {
      return '';
    }
    
    // Create a temporary conversation for the summarization request
    const tempConversation: Conversation = {
      id: 'temp-summarization',
      title: 'Summarization',
      messages: [
        {
          role: MessageRole.System,
          content: 'You are a helpful AI assistant that summarizes conversation history. Provide a brief summary of the key points in the conversation history below.'
        },
        {
          role: MessageRole.User,
          content: `Summarize the following conversation history in 2-3 concise sentences. Focus on the key topics, decisions, and questions:\n\n${excludedMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n\n')}`
        }
      ]
    };
    
    // Send request to AI
    const response = await ai.sendMessage(
      tempConversation,
      tempConversation.messages[tempConversation.messages.length - 1]
    );
    
    return response.content;
  }
}
```

### 4. Implement Response Processing Pipeline

Now, let's create a pipeline for processing AI responses:

```typescript
/**
 * Pipeline processor interface
 */
export interface ResponseProcessor {
  /**
   * Process an assistant message
   * @param message - Message to process
   * @param conversation - Conversation context
   * @returns Processed message
   */
  process(
    message: AssistantMessage, 
    conversation: Conversation
  ): Promise<AssistantMessage>;
}

/**
 * Markdown formatter processor
 */
export class MarkdownFormatterProcessor implements ResponseProcessor {
  /**
   * Process response to clean up markdown
   */
  public async process(
    message: AssistantMessage, 
    conversation: Conversation
  ): Promise<AssistantMessage> {
    // Skip if no content
    if (!message.content) {
      return message;
    }
    
    // Process content
    let content = message.content;
    
    // Fix code blocks that don't have language specified
    content = content.replace(/```\s*\n/g, '```txt\n');
    
    // Ensure headers have spaces after #
    content = content.replace(/^(#{1,6})([^#\s])/gm, '$1 $2');
    
    // Fix list items without spaces
    content = content.replace(/^([*-])([^\s])/gm, '$1 $2');
    
    // Update message
    return {
      ...message,
      content
    };
  }
}

/**
 * Link formatter processor
 */
export class LinkFormatterProcessor implements ResponseProcessor {
  /**
   * Process response to fix internal links
   */
  public async process(
    message: AssistantMessage, 
    conversation: Conversation
  ): Promise<AssistantMessage> {
    // Skip if no content
    if (!message.content) {
      return message;
    }
    
    // Process content
    let content = message.content;
    
    // Convert Wiki links to Markdown links
    content = content.replace(/\[\[([^\]|]+)\]\]/g, '[$1]($1.md)');
    content = content.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '[$2]($1.md)');
    
    // Update message
    return {
      ...message,
      content
    };
  }
}

/**
 * Response processing pipeline
 */
export class ResponsePipeline {
  /**
   * Processors in the pipeline
   */
  private processors: ResponseProcessor[] = [];
  
  /**
   * Add a processor to the pipeline
   * @param processor - Processor to add
   */
  public addProcessor(processor: ResponseProcessor): void {
    this.processors.push(processor);
  }
  
  /**
   * Process a message through the pipeline
   * @param message - Message to process
   * @param conversation - Conversation context
   * @returns Processed message
   */
  public async process(
    message: AssistantMessage, 
    conversation: Conversation
  ): Promise<AssistantMessage> {
    let processedMessage = message;
    
    for (const processor of this.processors) {
      processedMessage = await processor.process(processedMessage, conversation);
    }
    
    return processedMessage;
  }
}

/**
 * MCP client with response processing
 */
export class ProcessingMCPClient extends ToolAwareMCPClient {
  /**
   * Response pipeline
   */
  private pipeline: ResponsePipeline;
  
  /**
   * Create a new processing MCP client
   */
  constructor(
    settings: SettingsManager,
    toolManager: ToolManager,
    eventBus: EventBus
  ) {
    super(settings, toolManager, eventBus);
    
    // Create pipeline
    this.pipeline = new ResponsePipeline();
    
    // Add default processors
    this.pipeline.addProcessor(new MarkdownFormatterProcessor());
    this.pipeline.addProcessor(new LinkFormatterProcessor());
  }
  
  /**
   * Send a message with response processing
   */
  public async sendMessageWithProcessing(
    conversation: Conversation,
    message: Message,
    options?: Partial<ModelRequestOptions>
  ): Promise<AssistantMessage> {
    // Send message
    const response = await super.sendMessage(conversation, message, options);
    
    // Process response
    const processedResponse = await this.pipeline.process(response, conversation);
    
    // Replace response in conversation
    const index = conversation.messages.findIndex(
      msg => msg === response
    );
    
    if (index !== -1) {
      conversation.messages[index] = processedResponse;
    }
    
    return processedResponse;
  }
}
```

### 5. Add Error Recovery Strategies

Finally, let's implement error recovery strategies:

```typescript
/**
 * Error type for categorization
 */
export enum MCPErrorType {
  Network = 'network',
  Authentication = 'authentication',
  RateLimit = 'rate_limit',
  InvalidRequest = 'invalid_request',
  ServiceUnavailable = 'service_unavailable',
  Timeout = 'timeout',
  TokenLimitExceeded = 'token_limit_exceeded',
  ToolExecution = 'tool_execution',
  Unknown = 'unknown'
}

/**
 * MCP error with additional information
 */
export class MCPError extends Error {
  /**
   * Error type
   */
  public type: MCPErrorType;
  
  /**
   * Whether the error is retryable
   */
  public retryable: boolean;
  
  /**
   * Suggested retry delay in milliseconds
   */
  public retryDelay?: number;
  
  /**
   * Original error object
   */
  public originalError?: Error;
  
  /**
   * Create a new MCP error
   * @param message - Error message
   * @param type - Error type
   * @param retryable - Whether the error is retryable
   * @param retryDelay - Suggested retry delay in milliseconds
   * @param originalError - Original error
   */
  constructor(
    message: string,
    type: MCPErrorType = MCPErrorType.Unknown,
    retryable: boolean = false,
    retryDelay?: number,
    originalError?: Error
  ) {
    super(message);
    this.name = 'MCPError';
    this.type = type;
    this.retryable = retryable;
    this.retryDelay = retryDelay;
    this.originalError = originalError;
  }
  
  /**
   * Create a network error
   * @param message - Error message
   * @param originalError - Original error
   * @returns Network error
   */
  public static network(message: string, originalError?: Error): MCPError {
    return new MCPError(
      message,
      MCPErrorType.Network,
      true,
      1000,
      originalError
    );
  }
  
  /**
   * Create an authentication error
   * @param message - Error message
   * @param originalError - Original error
   * @returns Authentication error
   */
  public static authentication(message: string, originalError?: Error): MCPError {
    return new MCPError(
      message,
      MCPErrorType.Authentication,
      false,
      undefined,
      originalError
    );
  }
  
  /**
   * Create a rate limit error
   * @param message - Error message
   * @param retryDelay - Suggested retry delay in milliseconds
   * @param originalError - Original error
   * @returns Rate limit error
   */
  public static rateLimit(message: string, retryDelay: number = 60000, originalError?: Error): MCPError {
    return new MCPError(
      message,
      MCPErrorType.RateLimit,
      true,
      retryDelay,
      originalError
    );
  }
  
  /**
   * Create a token limit exceeded error
   * @param message - Error message
   * @param originalError - Original error
   * @returns Token limit exceeded error
   */
  public static tokenLimitExceeded(message: string, originalError?: Error): MCPError {
    return new MCPError(
      message,
      MCPErrorType.TokenLimitExceeded,
      false,
      undefined,
      originalError
    );
  }
  
  /**
   * Create a tool execution error
   * @param message - Error message
   * @param originalError - Original error
   * @returns Tool execution error
   */
  public static toolExecution(message: string, originalError?: Error): MCPError {
    return new MCPError(
      message,
      MCPErrorType.ToolExecution,
      false,
      undefined,
      originalError
    );
  }
}

/**
 * Error recovery strategy interface
 */
export interface ErrorRecoveryStrategy {
  /**
   * Check if this strategy can handle the error
   * @param error - Error to check
   * @returns Whether this strategy can handle the error
   */
  canHandle(error: MCPError): boolean;
  
  /**
   * Recover from an error
   * @param error - Error to recover from
   * @param client - MCP client
   * @param conversation - Conversation
   * @param lastMessage - Last message sent
   * @param options - Request options
   * @returns Recovery result
   */
  recover(
    error: MCPError,
    client: ProcessingMCPClient,
    conversation: Conversation,
    lastMessage: Message,
    options?: Partial<ModelRequestOptions>
  ): Promise<AssistantMessage | null>;
}

/**
 * Retry strategy for retryable errors
 */
export class RetryStrategy implements ErrorRecoveryStrategy {
  /**
   * Maximum number of retries
   */
  private maxRetries: number;
  
  /**
   * Create a new retry strategy
   * @param maxRetries - Maximum number of retries
   */
  constructor(maxRetries: number = 3) {
    this.maxRetries = maxRetries;
  }
  
  /**
   * Check if this strategy can handle the error
   */
  public canHandle(error: MCPError): boolean {
    return error.retryable;
  }
  
  /**
   * Recover from an error
   */
  public async recover(
    error: MCPError,
    client: ProcessingMCPClient,
    conversation: Conversation,
    lastMessage: Message,
    options?: Partial<ModelRequestOptions>
  ): Promise<AssistantMessage | null> {
    const retryCount = options?.metadata?.retryCount || 0;
    
    if (retryCount >= this.maxRetries) {
      return null;
    }
    
    // Wait for retry delay
    if (error.retryDelay) {
      await new Promise(resolve => setTimeout(resolve, error.retryDelay));
    }
    
    // Retry with incremented retry count
    const retryOptions = {
      ...options,
      metadata: {
        ...options?.metadata,
        retryCount: retryCount + 1
      }
    };
    
    return await client.sendMessageWithProcessing(
      conversation,
      lastMessage,
      retryOptions
    );
  }
}

/**
 * Token limit recovery strategy
 */
export class TokenLimitStrategy implements ErrorRecoveryStrategy {
  /**
   * Message chain manager
   */
  private chainManager: MessageChainManager;
  
  /**
   * Create a new token limit strategy
   * @param chainManager - Message chain manager
   */
  constructor(chainManager: MessageChainManager) {
    this.chainManager = chainManager;
  }
  
  /**
   * Check if this strategy can handle the error
   */
  public canHandle(error: MCPError): boolean {
    return error.type === MCPErrorType.TokenLimitExceeded;
  }
  
  /**
   * Recover from an error
   */
  public async recover(
    error: MCPError,
    client: ProcessingMCPClient,
    conversation: Conversation,
    lastMessage: Message,
    options?: Partial<ModelRequestOptions>
  ): Promise<AssistantMessage | null> {
    // Compress conversation
    const compressedConversation = this.chainManager.compressConversation(
      conversation
    );
    
    // Try again with compressed conversation
    return await client.sendMessageWithProcessing(
      compressedConversation,
      lastMessage,
      options
    );
  }
}

/**
 * MCP client with error recovery
 */
export class ResilientMCPClient extends ProcessingMCPClient {
  /**
   * Error recovery strategies
   */
  private strategies: ErrorRecoveryStrategy[] = [];
  
  /**
   * Message chain manager
   */
  private chainManager: MessageChainManager;
  
  /**
   * Create a new resilient MCP client
   */
  constructor(
    settings: SettingsManager,
    toolManager: ToolManager,
    eventBus: EventBus
  ) {
    super(settings, toolManager, eventBus);
    
    // Create chain manager
    this.chainManager = new MessageChainManager({
      maxMessages: settings.getSettings().maxContextMessages || 100,
      maxTokens: settings.getSettings().maxContextTokens || 16000
    });
    
    // Add default strategies
    this.strategies.push(new RetryStrategy(3));
    this.strategies.push(new TokenLimitStrategy(this.chainManager));
  }
  
  /**
   * Add a recovery strategy
   * @param strategy - Strategy to add
   */
  public addRecoveryStrategy(strategy: ErrorRecoveryStrategy): void {
    this.strategies.push(strategy);
  }
  
  /**
   * Send a message with error recovery
   */
  public async sendMessageWithRecovery(
    conversation: Conversation,
    message: Message,
    options?: Partial<ModelRequestOptions>
  ): Promise<AssistantMessage> {
    try {
      // Try to send message normally
      return await super.sendMessageWithProcessing(conversation, message, options);
    } catch (error) {
      // Convert to MCP error
      const mcpError = this.convertError(error);
      
      // Emit error event
      this.eventBus.emit('mcp:error', {
        conversationId: conversation.id,
        error: mcpError
      });
      
      // Try recovery strategies
      for (const strategy of this.strategies) {
        if (strategy.canHandle(mcpError)) {
          const result = await strategy.recover(
            mcpError,
            this,
            conversation,
            message,
            options
          );
          
          if (result) {
            return result;
          }
        }
      }
      
      // If no strategy could recover, re-throw error
      throw mcpError;
    }
  }
  
  /**
   * Convert an error to an MCP error
   * @param error - Error to convert
   * @returns MCP error
   */
  private convertError(error: any): MCPError {
    // If already an MCP error, return as is
    if (error instanceof MCPError) {
      return error;
    }
    
    // Common error patterns
    if (error.name === 'AbortError' || error.message.includes('fetch failed')) {
      return MCPError.network('Network error: Failed to connect to AI provider', error);
    }
    
    if (error.message.includes('401') || error.message.includes('API key')) {
      return MCPError.authentication('Authentication error: Invalid API key', error);
    }
    
    if (error.message.includes('429') || error.message.includes('rate limit')) {
      return MCPError.rateLimit('Rate limit exceeded: Please try again later', undefined, error);
    }
    
    if (error.message.includes('token') && error.message.includes('limit')) {
      return MCPError.tokenLimitExceeded('Token limit exceeded: Conversation is too long', error);
    }
    
    if (error.message.includes('tool') || error.message.includes('execution')) {
      return MCPError.toolExecution(`Tool execution error: ${error.message}`, error);
    }
    
    // Unknown error
    return new MCPError(
      `Error communicating with AI provider: ${error.message}`,
      MCPErrorType.Unknown,
      false,
      undefined,
      error
    );
  }
}

/**
 * Factory function to create the most capable MCP client
 * @param settings - Settings manager
 * @param toolManager - Tool manager
 * @param eventBus - Event bus
 * @returns MCP client
 */
export function createAdvancedMCPClient(
  settings: SettingsManager,
  toolManager: ToolManager,
  eventBus: EventBus
): ResilientMCPClient {
  return new ResilientMCPClient(settings, toolManager, eventBus);
}
```

## Integration

To bring all these advanced features together, let's update our plugin core:

```typescript
import { Plugin } from 'obsidian';
import { EventBus } from './core/EventBus';
import { SettingsManager } from './core/SettingsManager';
import { EnhancedVaultFacade } from './core/VaultFacade';
import { BCPRegistry } from './mcp/BCPRegistry';
import { ToolManager } from './mcp/ToolManager';
import { ConversationManager } from './mcp/ConversationManager';
import { registerBuiltInBCPs, autoLoadBCPs } from './mcp/BCPManager';
import { BCPContext } from './mcp/BCPFactory';
import { createAdvancedMCPClient, ResilientMCPClient } from './mcp/AdvancedMCPClient';
import { MessageRole } from './mcp/interfaces';

export default class ChatsidianPlugin extends Plugin {
  public eventBus: EventBus;
  public settings: SettingsManager;
  public vaultFacade: EnhancedVaultFacade;
  public bcpRegistry: BCPRegistry;
  public toolManager: ToolManager;
  public mcpClient: ResilientMCPClient;
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
    
    // Create BCP context
    const bcpContext: BCPContext = {
      vaultFacade: this.vaultFacade,
      eventBus: this.eventBus,
      settings: this.settings
    };
    
    // Register built-in BCPs
    registerBuiltInBCPs(this.bcpRegistry, bcpContext);
    
    // Initialize BCP registry
    await this.bcpRegistry.initialize();
    
    // Auto-load configured BCPs
    await autoLoadBCPs(
      this.bcpRegistry,
      this.settings.getSettings().autoLoadBCPs || [
        'NoteManager',
        'FolderManager',
        'VaultLibrarian'
      ]
    );
    
    // Initialize MCP client with advanced features
    this.mcpClient = createAdvancedMCPClient(
      this.settings,
      this.toolManager,
      this.eventBus
    );
    await this.mcpClient.initialize();
    
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
        await this.sendMessageWithUI(conversation.id, message);
      }
    });
    
    // Register event handlers
    this.registerEvents();
    
    console.log('Chatsidian plugin loaded');
  }
  
  /**
   * Send a message to the AI with UI updates
   * @param conversationId - Conversation ID
   * @param content - Message content
   */
  public async sendMessageWithUI(conversationId: string, content: string): Promise<void> {
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
      
      // Create UI container
      const container = document.createElement('div');
      container.className = 'chatsidian-response-container';
      
      // Add to active view
      const view = this.app.workspace.getActiveViewOfType(this.app.workspace.constructor.View);
      
      if (view) {
        view.containerEl.appendChild(container);
      }
      
      // Send to AI with UI updates
      const response = await this.mcpClient.executeConversationTurn(
        conversation,
        message,
        container
      );
      
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
        console.log(`Tool call started: ${data.execution.name}`);
      });
      
      this.eventBus.on('mcp:toolCallComplete', data => {
        console.log(`Tool call completed: ${data.execution.name}`);
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

## Documentation References

- [[💻 Coding/Projects/Chatsidian/1_Architecture/Overview]]
- [[💻 Coding/Projects/Chatsidian/1_Architecture/Components/MCPConnector]]
- [[💻 Coding/Projects/Chatsidian/4_Documentation/MCPStreamingImplementation]]
- [[💻 Coding/Projects/Chatsidian/4_Documentation/MCPErrorHandling]]
- [[💻 Coding/Projects/Chatsidian/3_Implementation/Phase2.6-MCP-Client-Core]]

## Testing Strategy

### Unit Tests

- Test streaming message handling with mock events
- Test tool call execution tracking
- Test message chain management with different conversation sizes
- Test response processing pipeline with various message formats
- Test error recovery strategies with different error types

```typescript
// Example test for MessageChainManager
describe('MessageChainManager', () => {
  let chainManager: MessageChainManager;
  let conversation: Conversation;
  
  beforeEach(() => {
    chainManager = new MessageChainManager({
      maxMessages: 10,
      maxTokens: 1000
    });
    
    // Create test conversation
    conversation = {
      id: 'test-conversation',
      title: 'Test Conversation',
      messages: [
        {
          role: MessageRole.System,
          content: 'You are a helpful assistant.'
        },
        {
          role: MessageRole.User,
          content: 'Hello!'
        },
        {
          role: MessageRole.Assistant,
          content: 'Hi there! How can I help you today?'
        }
      ]
    };
  });
  
  test('should include system messages in context', () => {
    const contextMessages = chainManager.getContextMessages(conversation);
    
    const systemMessages = contextMessages.filter(
      msg => msg.role === MessageRole.System
    );
    
    expect(systemMessages.length).toBe(1);
    expect(systemMessages[0].content).toBe('You are a helpful assistant.');
  });
  
  test('should prioritize recent messages when over limit', () => {
    // Add many messages to exceed limits
    for (let i = 0; i < 20; i++) {
      conversation.messages.push({
        role: MessageRole.User,
        content: `Message ${i}`
      });
      
      conversation.messages.push({
        role: MessageRole.Assistant,
        content: `Response ${i}`
      });
    }
    
    const contextMessages = chainManager.getContextMessages(conversation);
    
    // Should be limited to maxMessages
    expect(contextMessages.length).toBeLessThanOrEqual(10);
    
    // Should include most recent messages
    const lastUserMessage = conversation.messages[conversation.messages.length - 2];
    const lastAssistantMessage = conversation.messages[conversation.messages.length - 1];
    
    const containsLastUser = contextMessages.some(
      msg => msg.role === lastUserMessage.role && 
            msg.content === lastUserMessage.content
    );
    
    const containsLastAssistant = contextMessages.some(
      msg => msg.role === lastAssistantMessage.role && 
            msg.content === lastAssistantMessage.content
    );
    
    expect(containsLastUser).toBe(true);
    expect(containsLastAssistant).toBe(true);
  });
});
```

### Integration Tests

- Test streaming responses with actual API clients
- Test error recovery with simulated errors
- Test full conversation flow with tool calls and recovery
- Test response processing with actual conversations

## Next Steps

Phase 2.8 will focus on implementing the agent system, building on the advanced MCP features added in this phase. This will allow for specialized AI agents with different capabilities and personalities to assist users with specific tasks.

The streaming support, robust error handling, and message chain management implemented in this phase lay the groundwork for a responsive and reliable AI assistant experience within Obsidian.
