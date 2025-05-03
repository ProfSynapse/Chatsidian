---
title: MCP Integration Best Practices
description: Comprehensive guide for implementing the Model Context Protocol in Chatsidian
date: 2025-05-03
status: draft
tags:
  - documentation
  - mcp
  - implementation
  - best-practices
---

# MCP Integration Best Practices

This document outlines best practices for implementing the Model Context Protocol (MCP) in the Chatsidian plugin. It provides concrete examples and references to relevant documentation.

## 1. Enhanced Tool Schema Validation

Proper schema validation is essential for robust MCP tool integration. The MCP specification recommends using JSON Schema validation to ensure tool parameters meet requirements.

### Implementation Example

```typescript
import Ajv from 'ajv';

private validateParameters(tool: Tool, params: any): void {
  if (!tool.schema) {
    return;
  }
  
  const ajv = new Ajv({
    allErrors: true,          // Return all errors, not just the first
    coerceTypes: true,        // Attempt to coerce values to the right type
    useDefaults: true,        // Apply default values from schema
    removeAdditional: false   // Don't remove additional properties
  });
  
  // Compile validation function for this schema
  const validate = ajv.compile(tool.schema);
  
  // Perform validation
  const valid = validate(params);
  
  // Throw error with details if invalid
  if (!valid) {
    const errors = validate.errors || [];
    const errorMessages = errors.map(err => 
      `${err.instancePath} ${err.message}`
    ).join('; ');
    
    throw new Error(`Invalid parameters: ${errorMessages}`);
  }
}
```

**Reference**: See the implementation in [[💻 Coding/Projects/Chatsidian/3_Implementation/Phase2-MCP-BCP-Integration.md]] around line 310.

## 2. Resource Management Support

MCP resources are a core primitive that allows servers to expose data that can be read by clients. Adding resource support to the MCPClient enhances its capabilities.

### Implementation Example

```typescript
// Add to MCPClient.ts
public async getResource(uri: string): Promise<any> {
  try {
    // Ensure provider is initialized
    if (!this.currentProvider) {
      await this.initialize();
    }
    
    // Get resource
    const resource = await this.currentProvider.getResource(uri);
    
    // Emit event
    this.eventBus.emit('mcp:resourceFetched', { uri, resource });
    
    return resource;
  } catch (error) {
    console.error('Error fetching resource:', error);
    this.eventBus.emit('mcp:resourceError', { uri, error });
    throw error;
  }
}

// List available resources
public async listResources(): Promise<any[]> {
  try {
    // Ensure provider is initialized
    if (!this.currentProvider) {
      await this.initialize();
    }
    
    // Get resources
    const resources = await this.currentProvider.listResources();
    
    // Emit event
    this.eventBus.emit('mcp:resourcesListed', { resources });
    
    return resources;
  } catch (error) {
    console.error('Error listing resources:', error);
    this.eventBus.emit('mcp:resourcesError', { error });
    throw error;
  }
}

// Subscribe to resource updates
public async subscribeToResource(uri: string, callback: (update: any) => void): Promise<() => void> {
  try {
    // Ensure provider is initialized
    if (!this.currentProvider) {
      await this.initialize();
    }
    
    // Subscribe to resource
    const unsubscribe = await this.currentProvider.subscribeToResource(uri, (update) => {
      // Emit event
      this.eventBus.emit('mcp:resourceUpdated', { uri, update });
      
      // Call callback
      callback(update);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error('Error subscribing to resource:', error);
    this.eventBus.emit('mcp:resourceSubscriptionError', { uri, error });
    throw error;
  }
}
```

**Reference**: This is a new addition that should be incorporated into [[💻 Coding/Projects/Chatsidian/1_Architecture/Components/MCPConnector.md]] around line 180.

## 3. Enhanced Streaming Support

MCP supports streaming responses, which is particularly useful for long-running operations or real-time updates. Here's how to implement streaming correctly.

### Implementation Example

```typescript
// Add SSE transport support
public async streamMessage(
  conversation: Conversation,
  userMessage: Message,
  agentId?: string
): Promise<EventSource> {
  // Ensure provider is initialized
  if (!this.currentProvider) {
    await this.initialize();
  }
  
  // Prepare messages for context
  const messages = this.formatMessages(conversation, agentId ? this.agentManager.getAgent(agentId) : null);
  
  // Get available tools
  const tools = this.toolManager.getToolsForMCP();
  
  // Create request
  const request: ProviderRequest = {
    messages,
    model: agentId ? this.agentManager.getAgent(agentId)?.model : this.settings.getModel(),
    temperature: agentId ? this.agentManager.getAgent(agentId)?.temperature : this.settings.getSettings().defaultTemperature,
    maxTokens: agentId ? this.agentManager.getAgent(agentId)?.maxTokens : this.settings.getSettings().defaultMaxTokens,
    tools,
    stream: true
  };
  
  // Start the streaming connection
  const source = this.currentProvider.createStreamingConnection(request);
  
  // Set up event handlers
  source.addEventListener('message', (event) => {
    try {
      const chunk = JSON.parse(event.data);
      this.eventBus.emit('mcp:messageChunk', { 
        chunk, 
        conversationId: conversation.id,
        agentId 
      });
    } catch (error) {
      console.error('Error parsing chunk:', error);
    }
  });
  
  source.addEventListener('error', (error) => {
    this.eventBus.emit('mcp:streamError', { 
      conversationId: conversation.id,
      agentId,
      error 
    });
  });
  
  source.addEventListener('close', () => {
    this.eventBus.emit('mcp:streamClosed', { 
      conversationId: conversation.id,
      agentId 
    });
  });
  
  return source;
}

// Handle stream events in the UI component
private setupStreamHandlers(): void {
  this.eventBus.on('mcp:messageChunk', (data) => {
    const { chunk, conversationId } = data;
    
    // Update UI with the new chunk
    this.updateMessageContent(conversationId, chunk);
  });
  
  this.eventBus.on('mcp:streamError', (data) => {
    const { error, conversationId } = data;
    
    // Handle error in UI
    this.showStreamError(conversationId, error);
  });
  
  this.eventBus.on('mcp:streamClosed', (data) => {
    const { conversationId } = data;
    
    // Finalize UI update
    this.finalizeStreamedMessage(conversationId);
  });
}
```

**Reference**: This enhanced streaming implementation should replace the streaming code in [[💻 Coding/Projects/Chatsidian/3_Implementation/Phase2-MCP-BCP-Integration.md]] around line 108.

## 4. Connection Management According to MCP Spec

Proper initialization and connection management are important parts of the MCP specification. Here's how to implement the connection lifecycle.

### Implementation Example

```typescript
// Add to MCPClient.ts
private async initializeMCPConnection(): Promise<void> {
  try {
    // Create initialization request
    const initRequest = {
      protocol: {
        name: 'mcp',
        version: '1.0.0'
      },
      clientInfo: {
        name: 'chatsidian',
        version: '1.0.0'
      },
      capabilities: {
        tools: true,
        resources: true,
        prompts: true
      }
    };
    
    // Send initialization request
    const initResponse = await this.currentProvider.initialize(initRequest);
    
    // Check compatibility
    if (initResponse.protocol.name !== 'mcp') {
      throw new Error(`Unsupported protocol: ${initResponse.protocol.name}`);
    }
    
    // Compare versions
    const serverVersion = initResponse.protocol.version;
    if (!this.isCompatibleVersion(serverVersion, '1.0.0')) {
      throw new Error(`Incompatible MCP version: ${serverVersion}`);
    }
    
    // Send initialized notification
    await this.currentProvider.sendInitialized();
    
    // Emit event
    this.eventBus.emit('mcp:initialized', initResponse);
  } catch (error) {
    console.error('Error initializing MCP connection:', error);
    this.eventBus.emit('mcp:initializationError', { error });
    throw error;
  }
}

private isCompatibleVersion(serverVersion: string, clientVersion: string): boolean {
  // Simple version comparison (should be enhanced for proper semver)
  const serverParts = serverVersion.split('.');
  const clientParts = clientVersion.split('.');
  
  // Compare major version
  return serverParts[0] === clientParts[0];
}

// Add connection termination handling
public async disconnect(): Promise<void> {
  try {
    if (this.currentProvider) {
      await this.currentProvider.close();
      this.eventBus.emit('mcp:disconnected');
      this.currentProvider = null;
    }
  } catch (error) {
    console.error('Error disconnecting from provider:', error);
    this.eventBus.emit('mcp:disconnectionError', { error });
    throw error;
  }
}
```

**Reference**: This should be incorporated into the initialization process in [[💻 Coding/Projects/Chatsidian/3_Implementation/Phase2-MCP-BCP-Integration.md]] around line 73.

## 5. MCP Prompt Support

MCP prompts are predefined templates that can be used to standardize and share common LLM interactions. Here's how to add support for prompts.

### Implementation Example

```typescript
// Add to MCPClient.ts
public async listPrompts(): Promise<any[]> {
  try {
    // Ensure provider is initialized
    if (!this.currentProvider) {
      await this.initialize();
    }
    
    // Get prompts
    const prompts = await this.currentProvider.listPrompts();
    
    // Emit event
    this.eventBus.emit('mcp:promptsListed', { prompts });
    
    return prompts;
  } catch (error) {
    console.error('Error listing prompts:', error);
    this.eventBus.emit('mcp:promptsError', { error });
    throw error;
  }
}

public async getPrompt(name: string, args?: any): Promise<any> {
  try {
    // Ensure provider is initialized
    if (!this.currentProvider) {
      await this.initialize();
    }
    
    // Get prompt
    const prompt = await this.currentProvider.getPrompt(name, args);
    
    // Emit event
    this.eventBus.emit('mcp:promptFetched', { name, args, prompt });
    
    return prompt;
  } catch (error) {
    console.error('Error fetching prompt:', error);
    this.eventBus.emit('mcp:promptError', { name, args, error });
    throw error;
  }
}

// Create a message from a prompt
public async createMessageFromPrompt(
  conversation: Conversation,
  promptName: string,
  promptArgs?: any,
  agentId?: string
): Promise<Message> {
  try {
    // Get prompt
    const prompt = await this.getPrompt(promptName, promptArgs);
    
    // Create a user message with the prompt content
    const userMessage: Message = {
      id: this.generateId(),
      role: 'user',
      content: JSON.stringify(prompt),
      timestamp: Date.now()
    };
    
    // Send message using the prompt
    return await this.sendMessage(conversation, userMessage, agentId);
  } catch (error) {
    console.error('Error creating message from prompt:', error);
    this.eventBus.emit('mcp:promptMessageError', { promptName, promptArgs, error });
    throw error;
  }
}
```

**Reference**: This should be added as a new section to [[💻 Coding/Projects/Chatsidian/1_Architecture/Components/MCPConnector.md]] around line 230.

## 6. MCP-Specific Error Handling

MCP defines specific error codes that should be handled appropriately. Here's how to implement MCP-specific error handling.

### Implementation Example

```typescript
// Add to a new file src/mcp/MCPErrors.ts
export enum MCPErrorCode {
  // Standard JSON-RPC error codes
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  
  // MCP-specific error codes
  ResourceNotFound = -32000,
  ToolExecutionFailed = -32001,
  PromptNotFound = -32002,
  ValidationFailed = -32003,
  
  // Custom error codes
  AuthenticationFailed = -33000,
  ConnectionTimeout = -33001,
  RateLimitExceeded = -33002
}

export class MCPError extends Error {
  constructor(public code: MCPErrorCode, message: string, public data?: any) {
    super(message);
    this.name = 'MCPError';
  }
  
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
}

// Example usage in MCPClient.ts
try {
  // API call
} catch (error) {
  if (error instanceof MCPError) {
    // Handle MCP-specific errors
    switch (error.code) {
      case MCPErrorCode.ResourceNotFound:
        // Handle resource not found
        this.eventBus.emit('mcp:resourceNotFound', { error });
        break;
        
      case MCPErrorCode.ToolExecutionFailed:
        // Handle tool execution failure
        this.eventBus.emit('mcp:toolExecutionFailed', { error });
        break;
        
      case MCPErrorCode.RateLimitExceeded:
        // Handle rate limit
        this.handleRateLimiting(error.data);
        break;
        
      default:
        // Handle other MCP errors
        this.eventBus.emit('mcp:error', { error });
        break;
    }
  } else {
    // Handle generic errors
    this.eventBus.emit('mcp:unknownError', { error });
  }
  
  throw error;
}
```

**Reference**: This should be added as a new file at [[💻 Coding/Projects/Chatsidian/src/mcp/MCPErrors.ts]] and referenced in the error handling sections of [[💻 Coding/Projects/Chatsidian/3_Implementation/Phase2-MCP-BCP-Integration.md]].

## 7. Root Management

MCP's concept of "roots" define boundaries for server operations. Here's how to implement root management.

### Implementation Example

```typescript
// Add to MCPClient.ts
public async setRoots(roots: Array<{uri: string, name?: string}>): Promise<void> {
  try {
    // Ensure provider is initialized
    if (!this.currentProvider) {
      await this.initialize();
    }
    
    // Set roots
    await this.currentProvider.setRoots(roots);
    
    // Emit event
    this.eventBus.emit('mcp:rootsSet', { roots });
  } catch (error) {
    console.error('Error setting roots:', error);
    this.eventBus.emit('mcp:rootsError', { roots, error });
    throw error;
  }
}

public async getRoots(): Promise<Array<{uri: string, name?: string}>> {
  try {
    // Ensure provider is initialized
    if (!this.currentProvider) {
      await this.initialize();
    }
    
    // Get roots
    const roots = await this.currentProvider.getRoots();
    
    // Emit event
    this.eventBus.emit('mcp:rootsFetched', { roots });
    
    return roots;
  } catch (error) {
    console.error('Error getting roots:', error);
    this.eventBus.emit('mcp:rootsError', { error });
    throw error;
  }
}

// Initialize roots based on vault
public async initializeRootsFromVault(): Promise<void> {
  try {
    // Get root folders in the vault
    const rootFolders = this.app.vault.getRoot().children
      .filter(child => child instanceof TFolder)
      .map(folder => ({
        uri: `file://${folder.path}`,
        name: folder.name
      }));
    
    // Set roots
    await this.setRoots(rootFolders);
  } catch (error) {
    console.error('Error initializing roots from vault:', error);
    this.eventBus.emit('mcp:rootsInitializationError', { error });
    throw error;
  }
}
```

**Reference**: This should be added to [[💻 Coding/Projects/Chatsidian/1_Architecture/Components/MCPConnector.md]] around line 280.

## 8. MCP Notification Handling

MCP servers can send notifications to clients, which should be handled properly.

### Implementation Example

```typescript
// Add to MCPClient.ts
private setupNotificationHandlers(): void {
  if (!this.currentProvider) {
    return;
  }
  
  // Handle resource list changed notifications
  this.currentProvider.onNotification('notifications/resources/list_changed', () => {
    // Reload resources
    this.listResources().catch(console.error);
    
    // Emit event
    this.eventBus.emit('mcp:resourceListChanged');
  });
  
  // Handle resource updated notifications
  this.currentProvider.onNotification('notifications/resources/updated', (params) => {
    const { uri } = params;
    
    // Emit event
    this.eventBus.emit('mcp:resourceUpdated', { uri });
  });
  
  // Handle tools list changed notifications
  this.currentProvider.onNotification('notifications/tools/list_changed', () => {
    // Reload tools
    this.refreshToolsList().catch(console.error);
    
    // Emit event
    this.eventBus.emit('mcp:toolsListChanged');
  });
  
  // Handle prompts list changed notifications
  this.currentProvider.onNotification('notifications/prompts/list_changed', () => {
    // Reload prompts
    this.listPrompts().catch(console.error);
    
    // Emit event
    this.eventBus.emit('mcp:promptsListChanged');
  });
  
  // Handle log messages
  this.currentProvider.onNotification('notifications/log', (params) => {
    const { level, data } = params;
    
    // Log message
    switch (level) {
      case 'info':
        console.info(`[MCP] ${data}`);
        break;
      case 'warn':
        console.warn(`[MCP] ${data}`);
        break;
      case 'error':
        console.error(`[MCP] ${data}`);
        break;
      default:
        console.log(`[MCP] ${data}`);
        break;
    }
    
    // Emit event
    this.eventBus.emit('mcp:logMessage', { level, data });
  });
}
```

**Reference**: This should be added to the initialization process in [[💻 Coding/Projects/Chatsidian/3_Implementation/Phase2-MCP-BCP-Integration.md]] after the connection is established.

## 9. ProviderAdapter Interface Updates

The provider adapter interface should be updated to support all MCP features.

### Implementation Example

```typescript
// Update ProviderAdapter.ts
export interface ProviderAdapter {
  // Connection management
  initialize(options: any): Promise<any>;
  sendInitialized(): Promise<void>;
  close(): Promise<void>;
  
  // Message handling
  sendMessage(request: ProviderRequest): Promise<ProviderResponse>;
  streamMessage(request: ProviderRequest, onChunk: ChunkCallback): Promise<ProviderResponse>;
  createStreamingConnection(request: ProviderRequest): EventSource;
  
  // Tool handling
  getToolsFromProvider(): Promise<any[]>;
  
  // Resource handling
  listResources(): Promise<any[]>;
  getResource(uri: string): Promise<any>;
  subscribeToResource(uri: string, callback: (update: any) => void): Promise<() => void>;
  
  // Prompt handling
  listPrompts(): Promise<any[]>;
  getPrompt(name: string, args?: any): Promise<any>;
  
  // Root handling
  setRoots(roots: Array<{uri: string, name?: string}>): Promise<void>;
  getRoots(): Promise<Array<{uri: string, name?: string}>>;
  
  // Notification handling
  onNotification(method: string, handler: (params: any) => void): void;
  
  // Test connection
  testConnection(): Promise<boolean>;
}
```

**Reference**: This should update the provider adapter interface in [[💻 Coding/Projects/Chatsidian/src/providers/ProviderAdapter.ts]].

## 10. Adding MCP Capability Detection

MCP clients should detect and adapt to server capabilities dynamically.

### Implementation Example

```typescript
// Add to MCPClient.ts
private serverCapabilities: {
  tools?: boolean;
  resources?: boolean;
  prompts?: boolean;
  roots?: boolean;
  sampling?: boolean;
} = {};

private async detectServerCapabilities(): Promise<void> {
  try {
    // Get server capabilities from initialization response
    const initResponse = await this.initializeMCPConnection();
    
    // Store capabilities
    this.serverCapabilities = initResponse.capabilities || {};
    
    // Log available capabilities
    console.log('Server capabilities:', this.serverCapabilities);
    
    // Emit event
    this.eventBus.emit('mcp:capabilitiesDetected', { capabilities: this.serverCapabilities });
  } catch (error) {
    console.error('Error detecting server capabilities:', error);
    this.eventBus.emit('mcp:capabilitiesError', { error });
    throw error;
  }
}

// Check if server supports a capability
public supportsCapability(capability: string): boolean {
  return Boolean(this.serverCapabilities[capability]);
}

// Safely call capabilities only if supported
private async safelyCall<T>(
  capability: string, 
  fn: () => Promise<T>, 
  fallback: T
): Promise<T> {
  if (this.supportsCapability(capability)) {
    return await fn();
  }
  
  console.warn(`Server does not support capability: ${capability}`);
  return fallback;
}

// Example usage
public async listResources(): Promise<any[]> {
  return this.safelyCall('resources', 
    async () => {
      // Resource listing implementation
      const resources = await this.currentProvider.listResources();
      this.eventBus.emit('mcp:resourcesListed', { resources });
      return resources;
    },
    [] // Empty array fallback if not supported
  );
}
```

**Reference**: This should be added to the initialization process in [[💻 Coding/Projects/Chatsidian/3_Implementation/Phase2-MCP-BCP-Integration.md]] as part of the connection setup.
