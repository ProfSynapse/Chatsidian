---
title: MCP Connector Component Design
description: Detailed design for the MCP Connector component of the Chatsidian plugin
date: 2025-05-03
status: planning
tags:
  - architecture
  - component-design
  - mcp
  - api-integration
---

# MCP Connector Component Design

## Component Overview

The MCP Connector component is responsible for communication between the Chatsidian plugin and AI models using the Model Context Protocol (MCP). It handles message formatting, API calls, response processing, and tool call execution routing.

## Key Responsibilities

- Format messages for API communication
- Send messages to AI providers
- Process responses and extract tool calls
- Handle streaming responses
- Route tool calls to the Agent Manager
- Handle errors and retries
- Manage API rate limits and quotas

## Internal Structure

### Classes

#### `MCPConnector`

Main connector class that handles communication with AI providers.

```typescript
// src/services/MCPConnector.ts
import { AIMessage, UserMessage, Message } from '../models/Message';
import { Settings } from '../Settings';
import { AgentManager } from './AgentManager';
import { EventEmitter } from 'events';

export class MCPConnector extends EventEmitter {
  private apiKey: string;
  private model: string;
  private agentManager: AgentManager;
  private streamingEnabled: boolean;
  
  constructor(settings: Settings, agentManager: AgentManager) {
    super();
    this.apiKey = settings.getApiKey();
    this.model = settings.getModel();
    this.agentManager = agentManager;
    this.streamingEnabled = settings.getStreamingEnabled();
  }
  
  async sendMessage(message: string, context: Message[]): Promise<AIMessage> {
    // Format messages for API
    const formattedMessages = this.formatMessagesForAPI(context, message);
    
    // Choose API provider based on settings
    const provider = this.getProvider();
    
    // Send to API
    let response;
    if (this.streamingEnabled) {
      response = await this.streamRequest(provider, formattedMessages);
    } else {
      response = await this.sendRequest(provider, formattedMessages);
    }
    
    // Process response
    return this.processResponse(response);
  }
  
  // Provider selection
  private getProvider(): APIProvider {
    // Return provider based on model setting
  }
  
  // Message formatting
  private formatMessagesForAPI(context: Message[], newMessage: string): any {
    // Convert internal message format to provider-specific format
  }
  
  // API requests
  private async sendRequest(provider: APIProvider, messages: any): Promise<any> {
    // Make API call with error handling and retries
  }
  
  private async streamRequest(provider: APIProvider, messages: any): Promise<any> {
    // Make streaming API call
    // Emit events for chunks
  }
  
  // Response processing
  private processResponse(response: any): AIMessage {
    // Extract AI response
    // Process any tool calls
    // Return formatted message
  }
  
  // Tool call handling
  async executeToolCall(toolCall: any): Promise<ToolResult> {
    // Parse tool call parameters
    // Route to appropriate agent via AgentManager
    // Return tool execution result
  }
  
  // Helper methods
  private extractToolCalls(response: any): ToolCall[] {
    // Extract tool calls from response
  }
  
  private formatToolResult(result: any): ToolResult {
    // Format tool result for response
  }
}
```

#### `APIProvider`

Interface for different API providers (Anthropic, OpenAI, etc.).

```typescript
// src/services/providers/APIProvider.ts
export interface APIProvider {
  name: string;
  
  sendMessage(messages: any, options: APIOptions): Promise<any>;
  
  streamMessage(messages: any, options: APIOptions, 
                onChunk: (chunk: any) => void): Promise<any>;
                
  formatMessages(messages: Message[]): any;
  
  parseResponse(response: any): AIMessage;
  
  extractToolCalls(response: any): ToolCall[];
}
```

#### Concrete Provider Implementations

```typescript
// src/services/providers/AnthropicProvider.ts
export class AnthropicProvider implements APIProvider {
  // Implementation for Claude API
}

// src/services/providers/OpenAIProvider.ts
export class OpenAIProvider implements APIProvider {
  // Implementation for OpenAI API
}
```

## Models and Data Structures

### Message Model

```typescript
// src/models/Message.ts
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface UserMessage extends Message {
  role: 'user';
}

export interface AIMessage extends Message {
  role: 'assistant';
  toolCalls?: ToolCall[];
}

export interface SystemMessage extends Message {
  role: 'system';
}
```

### Tool Call Model

```typescript
// src/models/ToolCall.ts
export interface ToolCall {
  id: string;
  agent: string;
  mode: string;
  params: any;
  timestamp: number;
  status: 'pending' | 'success' | 'error';
}

export interface ToolResult {
  id: string;
  toolCallId: string;
  content: string;
  error?: string;
  timestamp: number;
}
```

## API Integration

### MCP Message Format

The connector uses the Model Context Protocol format for messages:

```typescript
// MCP Message Format Example
const mcpMessage = {
  messages: [
    {
      role: "user",
      content: {
        type: "text",
        text: "User message content"
      }
    },
    {
      role: "assistant",
      content: {
        type: "text",
        text: "Assistant response content"
      }
    }
  ],
  tools: [
    // Available tools from Agent Manager
    {
      name: "noteReader",
      description: "Read notes from the vault",
      inputSchema: {
        // Tool schema
      }
    },
    // Additional tools...
  ]
};
```

### MCP Connection Lifecycle

The MCPConnector manages the complete MCP connection lifecycle according to the specification:

```typescript
// Initialize MCP connection
private async initializeMCPConnection(): Promise<any> {
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
    
    // Store server capabilities
    this.serverCapabilities = initResponse.capabilities || {};
    
    // Emit event
    this.eventBus.emit('mcp:initialized', initResponse);
    
    return initResponse;
  } catch (error) {
    console.error('Error initializing MCP connection:', error);
    this.eventBus.emit('mcp:initializationError', { error });
    throw error;
  }
}

// Check version compatibility
private isCompatibleVersion(serverVersion: string, clientVersion: string): boolean {
  // Simple version comparison (should be enhanced for proper semver)
  const serverParts = serverVersion.split('.');
  const clientParts = clientVersion.split('.');
  
  // Compare major version
  return serverParts[0] === clientParts[0];
}

// Close connection
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

### MCP Resources Support

The connector provides full support for the MCP resources capability:

```typescript
// List available resources
public async listResources(): Promise<any[]> {
  try {
    // Ensure provider is initialized
    if (!this.currentProvider) {
      await this.initialize();
    }
    
    // Check capability
    if (!this.supportsCapability('resources')) {
      console.warn('Server does not support resources capability');
      return [];
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

// Get resource content
public async getResource(uri: string): Promise<any> {
  try {
    // Ensure provider is initialized
    if (!this.currentProvider) {
      await this.initialize();
    }
    
    // Check capability
    if (!this.supportsCapability('resources')) {
      throw new Error('Server does not support resources capability');
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

// Subscribe to resource updates
public async subscribeToResource(uri: string, callback: (update: any) => void): Promise<() => void> {
  try {
    // Ensure provider is initialized
    if (!this.currentProvider) {
      await this.initialize();
    }
    
    // Check capability
    if (!this.supportsCapability('resources')) {
      throw new Error('Server does not support resources capability');
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

### MCP Prompts Support

The connector provides support for the MCP prompts capability:

```typescript
// List available prompts
public async listPrompts(): Promise<any[]> {
  try {
    // Ensure provider is initialized
    if (!this.currentProvider) {
      await this.initialize();
    }
    
    // Check capability
    if (!this.supportsCapability('prompts')) {
      console.warn('Server does not support prompts capability');
      return [];
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

// Get prompt with arguments
public async getPrompt(name: string, args?: any): Promise<any> {
  try {
    // Ensure provider is initialized
    if (!this.currentProvider) {
      await this.initialize();
    }
    
    // Check capability
    if (!this.supportsCapability('prompts')) {
      throw new Error('Server does not support prompts capability');
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
    
    // Use prompt messages to create a request
    const messages = [
      ...conversation.messages,
      ...prompt.messages
    ];
    
    // Create a specialized request with the prompt content
    const request: ProviderRequest = {
      messages: this.formatMessagesForAPI(messages),
      model: agentId ? this.agentManager.getAgent(agentId)?.model : this.settings.getModel(),
      temperature: agentId ? this.agentManager.getAgent(agentId)?.temperature : this.settings.getSettings().defaultTemperature,
      maxTokens: agentId ? this.agentManager.getAgent(agentId)?.maxTokens : this.settings.getSettings().defaultMaxTokens,
      tools: this.toolManager.getToolsForMCP(),
      stream: this.settings.getSettings().streamingEnabled
    };
    
    // Send request
    const response = await this.currentProvider.sendMessage(request);
    
    // Process response and create message
    const assistantMessage = this.createAssistantMessage(response);
    
    // Process any tool calls
    if (assistantMessage.toolCalls && assistantMessage.toolCalls.length > 0) {
      await this.processToolCalls(conversation.id, assistantMessage);
    }
    
    return assistantMessage;
  } catch (error) {
    console.error('Error creating message from prompt:', error);
    this.eventBus.emit('mcp:promptMessageError', { promptName, promptArgs, error });
    throw error;
  }
}
```

### MCP Root Management

The connector provides support for the MCP roots capability:

```typescript
// Set roots
public async setRoots(roots: Array<{uri: string, name?: string}>): Promise<void> {
  try {
    // Ensure provider is initialized
    if (!this.currentProvider) {
      await this.initialize();
    }
    
    // Check capability
    if (!this.supportsCapability('roots')) {
      console.warn('Server does not support roots capability');
      return;
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

// Get roots
public async getRoots(): Promise<Array<{uri: string, name?: string}>> {
  try {
    // Ensure provider is initialized
    if (!this.currentProvider) {
      await this.initialize();
    }
    
    // Check capability
    if (!this.supportsCapability('roots')) {
      console.warn('Server does not support roots capability');
      return [];
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

// Initialize roots from vault
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

### Enhanced Streaming Support

The connector provides robust support for streaming responses:

```typescript
// Stream message with SSE
public async streamMessage(
  conversation: Conversation,
  userMessage: Message,
  agentId?: string
): Promise<EventSource> {
  // Ensure provider is initialized
  if (!this.currentProvider) {
    await this.initialize();
  }
  
  // Get agent if specified
  const agent = agentId ? this.agentManager.getAgent(agentId) : null;
  
  // Prepare messages for context
  const messages = this.formatMessages(conversation, agent);
  
  // Get available tools
  const tools = this.toolManager.getToolsForMCP();
  
  // Create request
  const request: ProviderRequest = {
    messages,
    model: agent?.model || this.settings.getModel(),
    temperature: agent?.temperature || this.settings.getSettings().defaultTemperature,
    maxTokens: agent?.maxTokens || this.settings.getSettings().defaultMaxTokens,
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
```
```

### Provider-Specific Adaptations

The connector handles the translation between the MCP format and provider-specific formats:

#### Anthropic Claude Format

```typescript
// Anthropic Claude API Format Example
const claudeMessage = {
  model: "claude-3-5-sonnet-20250419",
  messages: [
    {
      role: "user",
      content: "User message content"
    },
    {
      role: "assistant",
      content: "Assistant response content"
    }
  ],
  tools: [
    // Tool definitions
  ],
  temperature: 0.7,
  max_tokens: 1000
};
```

#### OpenAI Format

```typescript
// OpenAI API Format Example
const openAIMessage = {
  model: "gpt-4o-2024-05-13",
  messages: [
    {
      role: "user",
      content: "User message content"
    },
    {
      role: "assistant",
      content: "Assistant response content"
    }
  ],
  tools: [
    // Tool definitions
  ],
  temperature: 0.7,
  max_tokens: 1000
};
```

## Message Flow

### Regular Message Flow

1. User sends message via Chat Interface
2. Chat Interface calls `sendMessage` on MCP Connector
3. MCP Connector formats messages for selected provider
4. MCP Connector sends API request
5. MCP Connector processes response
6. MCP Connector extracts any tool calls
7. MCP Connector returns formatted AIMessage
8. Chat Interface displays the message

### Streaming Message Flow

1. User sends message via Chat Interface
2. Chat Interface calls `sendMessage` on MCP Connector
3. MCP Connector formats messages for selected provider
4. MCP Connector initiates streaming request
5. For each chunk received:
   - MCP Connector emits 'chunk' event
   - Chat Interface updates UI with partial response
6. On completion:
   - MCP Connector processes complete response
   - MCP Connector extracts any tool calls
   - MCP Connector returns formatted AIMessage
   - Chat Interface finalizes message display

### Tool Call Flow

1. MCP Connector extracts tool call from AI response
2. MCP Connector calls `executeToolCall`
3. `executeToolCall` routes to Agent Manager
4. Agent Manager executes tool call
5. Result is returned to MCP Connector
6. MCP Connector formats result
7. MCP Connector includes result in next API call

## Error Handling

### API Errors

1. **Authentication Errors**
   - Invalid API key
   - Expired API key
   - Guide user to update API key in settings

2. **Rate Limit Errors**
   - Implement exponential backoff
   - Inform user of rate limiting
   - Provide quota information

3. **Server Errors**
   - Handle timeouts
   - Implement retry logic
   - Log error details

### Tool Execution Errors

1. **Missing Tool**
   - Handle cases where requested tool isn't available
   - Provide alternative suggestions

2. **Parameter Errors**
   - Validate parameters before execution
   - Return clear error messages

3. **Execution Errors**
   - Capture and format error details
   - Return structured error response

## Integration with Other Components

### Agent Manager

- Routes tool calls to appropriate agents
- Executes agent operations
- Returns tool results

### Settings Manager

- Retrieves API keys and configuration
- Gets model preferences
- Updates on settings changes

### Chat Interface

- Receives message sending requests
- Receives streaming events
- Handles message and tool call visualization

## Pseudocode Examples

### Sending a Message

```typescript
async function sendMessage(message: string, context: Message[]): Promise<AIMessage> {
  try {
    // Format messages
    const formattedMessages = formatMessagesForAPI(context, message);
    
    // Get available tools from Agent Manager
    const tools = agentManager.getAvailableTools();
    
    // Prepare API request
    const request = {
      model: this.model,
      messages: formattedMessages,
      tools: tools,
      temperature: this.settings.getTemperature(),
      max_tokens: this.settings.getMaxTokens()
    };
    
    // Send request
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });
    
    // Check for errors
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API Error: ${error.message}`);
    }
    
    // Parse response
    const result = await response.json();
    
    // Process and return
    return processResponse(result);
  } catch (error) {
    // Handle errors
    logError('Message sending failed', error);
    throw error;
  }
}
```

### Processing Tool Calls

```typescript
function processResponse(response: any): AIMessage {
  // Extract basic message content
  const content = response.choices[0].message.content;
  
  // Extract tool calls if present
  const toolCalls = extractToolCalls(response);
  
  // Create AI message
  const message: AIMessage = {
    id: generateId(),
    role: 'assistant',
    content,
    timestamp: Date.now(),
    toolCalls
  };
  
  // Execute tool calls if present
  if (toolCalls && toolCalls.length > 0) {
    for (const toolCall of toolCalls) {
      executeToolCall(toolCall).then(result => {
        // Add result to message
        message.toolResults = [...(message.toolResults || []), result];
        
        // Emit tool result event
        emit('toolResult', { toolCall, result });
      });
    }
  }
  
  return message;
}
```

## Testing Approach

1. **Unit Tests**
   - Test message formatting
   - Test response parsing
   - Test error handling

2. **Integration Tests**
   - Test API communication
   - Test tool call routing

3. **Mock Tests**
   - Use API mocks for predictable testing
   - Simulate error conditions

## References

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/docs/concepts/architecture)
- [Anthropic API Reference](https://docs.anthropic.com/claude/reference/messages_post)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)