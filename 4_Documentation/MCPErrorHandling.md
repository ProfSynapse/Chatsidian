---
title: MCP Error Handling
description: Comprehensive error handling approach for Model Context Protocol in Chatsidian
date: 2025-05-03
status: draft
tags:
  - documentation
  - mcp
  - error-handling
  - implementation
---

# MCP Error Handling

This document provides detailed guidance on implementing robust error handling for the Model Context Protocol (MCP) in the Chatsidian plugin.

## MCP Error Codes

MCP defines specific error codes that need to be handled appropriately. These include standard JSON-RPC error codes as well as MCP-specific codes.

### Error Code Definition

```typescript
// src/mcp/MCPErrors.ts
export enum MCPErrorCode {
  // Standard JSON-RPC error codes
  ParseError = -32700,       // Invalid JSON
  InvalidRequest = -32600,   // Request not conforming to JSON-RPC spec
  MethodNotFound = -32601,   // Method does not exist
  InvalidParams = -32602,    // Invalid method parameters
  InternalError = -32603,    // Internal JSON-RPC error
  
  // MCP-specific error codes
  ResourceNotFound = -32000, // Requested resource not found
  ToolExecutionFailed = -32001, // Tool execution error
  PromptNotFound = -32002,   // Requested prompt not found
  ValidationFailed = -32003, // Schema validation failed
  
  // Authentication and authorization errors
  Unauthorized = -32401,     // Not authenticated
  Forbidden = -32403,        // Not authorized
  
  // Custom Chatsidian error codes
  ConnectionFailed = -33000, // Failed to connect to provider
  RateLimitExceeded = -33001, // Provider rate limit exceeded
  APIKeyInvalid = -33002,    // Invalid API key
  TimeoutError = -33003,     // Operation timed out
  NetworkError = -33004      // Network-related error
}
```

### MCP Error Class

```typescript
// src/mcp/MCPErrors.ts
export class MCPError extends Error {
  constructor(
    public code: MCPErrorCode, 
    message: string, 
    public data?: any
  ) {
    super(message);
    this.name = 'MCPError';
  }
  
  /**
   * Create an MCPError from a JSON-RPC error response
   */
  static fromResponse(response: any): MCPError {
    if (!response || !response.error) {
      return new MCPError(
        MCPErrorCode.InternalError, 
        'Unknown error occurred'
      );
    }
    
    return new MCPError(
      response.error.code, 
      response.error.message,
      response.error.data
    );
  }
  
  /**
   * Create an MCPError from a regular Error
   */
  static fromError(error: Error, code: MCPErrorCode = MCPErrorCode.InternalError): MCPError {
    if (error instanceof MCPError) {
      return error;
    }
    
    return new MCPError(code, error.message);
  }
}
```
## Error Handling Strategy

Chatsidian implements a multi-layered error handling strategy for MCP operations:

1. **Specific Error Handlers** - Custom handlers for each type of error
2. **General Error Handler** - Fallback for unexpected errors
3. **Event-Based Reporting** - Error events emitted for UI updates
4. **User-Friendly Messages** - Clear messages for users
5. **Logging** - Detailed error logging for debugging

### Error Handling in MCPClient

```typescript
// src/mcp/MCPClient.ts
private async handleMCPError(error: any, context: any = {}): Promise<void> {
  // Convert to MCPError if needed
  const mcpError = error instanceof MCPError 
    ? error 
    : MCPError.fromError(error);
  
  // Log error
  console.error(`MCP Error (${mcpError.code}): ${mcpError.message}`, context);
  
  // Handle based on error code
  switch (mcpError.code) {
    case MCPErrorCode.ResourceNotFound:
      this.eventBus.emit('mcp:resourceNotFound', { 
        error: mcpError, 
        context 
      });
      break;
      
    case MCPErrorCode.ToolExecutionFailed:
      this.eventBus.emit('mcp:toolExecutionFailed', { 
        error: mcpError, 
        context 
      });
      break;
      
    case MCPErrorCode.PromptNotFound:
      this.eventBus.emit('mcp:promptNotFound', { 
        error: mcpError, 
        context 
      });
      break;
      
    case MCPErrorCode.Unauthorized:
    case MCPErrorCode.APIKeyInvalid:
      this.eventBus.emit('mcp:authenticationFailed', { 
        error: mcpError, 
        context 
      });
      // Show settings modal
      this.showAPIKeySettings();
      break;
      
    case MCPErrorCode.RateLimitExceeded:
      this.eventBus.emit('mcp:rateLimitExceeded', { 
        error: mcpError, 
        context 
      });
      // Implement exponential backoff
      await this.handleRateLimiting(mcpError.data);
      break;
      
    default:
      // Handle general error
      this.eventBus.emit('mcp:error', { 
        error: mcpError, 
        context 
      });
      break;
  }
  
  // Return a rejected promise to continue the error chain
  throw mcpError;
}
```

### Using Try-Catch with Error Handling

All MCP operations should use try-catch blocks with proper error handling:

```typescript
public async sendMessage(
  conversation: Conversation,
  userMessage: Message,
  agentId?: string
): Promise<Message> {
  try {
    // Operation implementation...
    
    return assistantMessage;
  } catch (error) {
    // Handle error with context
    return this.handleMCPError(error, {
      operation: 'sendMessage',
      conversation: conversation.id,
      agentId
    }).catch(() => {
      // Create error message when all else fails
      return {
        id: this.generateId(),
        role: 'system',
        content: error instanceof MCPError 
          ? error.getUserFriendlyMessage() 
          : 'An unexpected error occurred',
        timestamp: Date.now()
      };
    });
  }
}
```
## Rate Limiting Handling

MCP operations may be subject to rate limiting by providers. Here's a robust way to handle rate limits:

```typescript
// src/mcp/MCPClient.ts
private rateLimitState: {
  retryCount: number;
  lastRetry: number;
  maxRetries: number;
  baseDelay: number;
} = {
  retryCount: 0,
  lastRetry: 0,
  maxRetries: 5,
  baseDelay: 1000 // 1 second
}

/**
 * Handle rate limiting with exponential backoff
 */
private async handleRateLimiting(data?: any): Promise<void> {
  // Increment retry count
  this.rateLimitState.retryCount++;
  this.rateLimitState.lastRetry = Date.now();
  
  // Check if max retries exceeded
  if (this.rateLimitState.retryCount > this.rateLimitState.maxRetries) {
    // Reset state
    this.resetRateLimitState();
    
    // Throw error
    throw new MCPError(
      MCPErrorCode.RateLimitExceeded,
      'Maximum retry attempts exceeded'
    );
  }
  
  // Calculate exponential backoff delay
  const delay = Math.min(
    this.rateLimitState.baseDelay * Math.pow(2, this.rateLimitState.retryCount - 1),
    60000 // Max 1 minute
  );
  
  // Get reset time from data if available
  let waitTime = delay;
  if (data && data.retryAfter) {
    // Use provider's retry-after if available
    waitTime = Math.max(parseInt(data.retryAfter) * 1000, delay);
  }
  
  // Log retry
  console.log(`Rate limited. Retrying in ${waitTime / 1000}s (attempt ${this.rateLimitState.retryCount} of ${this.rateLimitState.maxRetries})`);
  
  // Wait before retrying
  await new Promise(resolve => setTimeout(resolve, waitTime));
}

/**
 * Reset rate limit state
 */
private resetRateLimitState(): void {
  this.rateLimitState = {
    retryCount: 0,
    lastRetry: 0,
    maxRetries: 5,
    baseDelay: 1000
  };
}
```
## Connection Error Recovery

Handling connection errors with automatic reconnection:

```typescript
// src/mcp/MCPClient.ts
private connectionState: {
  connected: boolean;
  reconnecting: boolean;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  reconnectDelay: number;
} = {
  connected: false,
  reconnecting: false,
  reconnectAttempts: 0,
  maxReconnectAttempts: 3,
  reconnectDelay: 2000 // 2 seconds
}

/**
 * Attempt to reconnect to the provider
 */
private async reconnect(): Promise<boolean> {
  // Check if already reconnecting
  if (this.connectionState.reconnecting) {
    return false;
  }
  
  // Set reconnecting state
  this.connectionState.reconnecting = true;
  
  try {
    // Increment reconnect attempts
    this.connectionState.reconnectAttempts++;
    
    // Check if max attempts exceeded
    if (this.connectionState.reconnectAttempts > this.connectionState.maxReconnectAttempts) {
      console.error('Maximum reconnection attempts exceeded');
      this.resetConnectionState();
      return false;
    }
    
    // Log reconnection attempt
    console.log(`Attempting to reconnect (attempt ${this.connectionState.reconnectAttempts} of ${this.connectionState.maxReconnectAttempts})...`);
    
    // Wait before reconnecting
    await new Promise(resolve => setTimeout(resolve, this.connectionState.reconnectDelay));
    
    // Close current provider if exists
    if (this.currentProvider) {
      try {
        await this.currentProvider.close();
      } catch (error) {
        console.error('Error closing current provider:', error);
      }
      
      this.currentProvider = null;
    }
    
    // Initialize new connection
    await this.initialize();
    
    // Reset reconnect attempts on success
    this.connectionState.reconnectAttempts = 0;
    this.connectionState.connected = true;
    this.connectionState.reconnecting = false;
    
    // Emit reconnected event
    this.eventBus.emit('mcp:reconnected');
    
    return true;
  } catch (error) {
    console.error('Failed to reconnect:', error);
    
    // Continue reconnection attempts if not max
    if (this.connectionState.reconnectAttempts < this.connectionState.maxReconnectAttempts) {
      // Exponential backoff
      this.connectionState.reconnectDelay *= 2;
      
      // Schedule next reconnection attempt
      setTimeout(() => {
        this.reconnect().catch(console.error);
      }, this.connectionState.reconnectDelay);
    } else {
      // Reset connection state
      this.resetConnectionState();
      
      // Emit reconnection failed event
      this.eventBus.emit('mcp:reconnectionFailed', { error });
    }
    
    return false;
  }
}

/**
 * Reset connection state
 */
private resetConnectionState(): void {
  this.connectionState = {
    connected: false,
    reconnecting: false,
    reconnectAttempts: 0,
    maxReconnectAttempts: 3,
    reconnectDelay: 2000
  };
}
```
## Error UI Integration

To provide a good user experience, errors should be presented in a user-friendly way:

```typescript
// src/ui/ErrorDisplay.ts
export class ErrorDisplay {
  private plugin: ChatsidianPlugin;
  
  constructor(plugin: ChatsidianPlugin) {
    this.plugin = plugin;
    
    // Register event listeners
    this.registerEvents();
  }
  
  private registerEvents(): void {
    // Listen for MCP errors
    this.plugin.eventBus.on('mcp:error', this.handleError.bind(this));
    this.plugin.eventBus.on('mcp:connectionError', this.handleConnectionError.bind(this));
    this.plugin.eventBus.on('mcp:authenticationFailed', this.handleAuthError.bind(this));
    this.plugin.eventBus.on('mcp:rateLimitExceeded', this.handleRateLimitError.bind(this));
    
    // Listen for tool execution errors
    this.plugin.eventBus.on('mcp:toolExecutionFailed', this.handleToolError.bind(this));
    
    // Listen for other specific errors
    this.plugin.eventBus.on('mcp:resourceNotFound', this.handleResourceError.bind(this));
    this.plugin.eventBus.on('mcp:promptNotFound', this.handlePromptError.bind(this));
  }
  
  /**
   * Handle general MCP error
   */
  private handleError(data: { error: MCPError, context: any }): void {
    const { error, context } = data;
    
    // Show notification
    this.plugin.app.noticeWithOptions({
      level: 'error',
      title: 'Chatsidian Error',
      message: error.getUserFriendlyMessage(),
      timeout: 7000
    });
    
    // Log for debugging
    console.error('MCP Error:', error, context);
  }
  
  /**
   * Handle connection error
   */
  private handleConnectionError(data: { error: MCPError, context: any }): void {
    const { error, context } = data;
    
    // Show notification
    this.plugin.app.noticeWithOptions({
      level: 'error',
      title: 'Connection Error',
      message: error.getUserFriendlyMessage(),
      timeout: 10000
    });
    
    // Log for debugging
    console.error('Connection Error:', error, context);
  }
  
  /**
   * Handle authentication error
   */
  private handleAuthError(data: { error: MCPError, context: any }): void {
    const { error, context } = data;
    
    // Show notification with button to open settings
    this.plugin.app.noticeWithOptions({
      level: 'error',
      title: 'Authentication Error',
      message: error.getUserFriendlyMessage(),
      timeout: 15000,
      buttons: [{
        text: 'Open Settings',
        onClick: () => {
          // Open settings tab
          this.plugin.app.setting.open();
          this.plugin.app.setting.openTabById('chatsidian');
        }
      }]
    });
    
    // Log for debugging
    console.error('Authentication Error:', error, context);
  }
}

// Integration with main plugin
export default class ChatsidianPlugin extends Plugin {
  // ... other properties
  public errorDisplay: ErrorDisplay;
  
  async onload() {
    // ... other initialization
    
    // Initialize error display
    this.errorDisplay = new ErrorDisplay(this);
    
    // Add global error handler
    window.addEventListener('error', this.handleGlobalError.bind(this));
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
  }
}
```

## Implementation References

The error handling implementation should be integrated into these components:

- [[💻 Coding/Projects/Chatsidian/1_Architecture/Components/MCPConnector.md]] - For the core MCP connection handling
- [[💻 Coding/Projects/Chatsidian/3_Implementation/Phase2-MCP-BCP-Integration.md]] - For integration with BCPs
- New file at `src/mcp/MCPErrors.ts` - For error code definitions
- New file at `src/ui/ErrorDisplay.ts` - For UI integration

These implementations enhance the reliability and user experience of the Chatsidian plugin when interacting with MCP-enabled AI providers.
