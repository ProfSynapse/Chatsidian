---
title: MCP Streaming Implementation
description: Implementation guide for enhanced streaming support in Chatsidian using the Model Context Protocol
date: 2025-05-03
status: draft
tags:
  - documentation
  - mcp
  - streaming
  - implementation
---

# MCP Streaming Implementation

This document provides a detailed guide for implementing enhanced streaming support in the Chatsidian plugin using the Model Context Protocol (MCP). Streaming enables real-time display of AI responses, improving the user experience.

## Streaming Overview

MCP supports streaming responses through Server-Sent Events (SSE), which allows for real-time updates from the AI provider. This is particularly valuable for:

1. **Immediate Feedback** - Users see responses as they're generated
2. **Long Responses** - Better UX for detailed or lengthy outputs
3. **Tool Integration** - Real-time visibility of tool calls and results
4. **Progress Indicators** - Show when the AI is thinking

## Streaming API Implementation

### MCPClient Streaming Support

```typescript
// src/mcp/MCPClient.ts
/**
 * Stream a message with SSE transport
 */
public async streamMessage(
  conversation: Conversation,
  userMessage: Message,
  agentId?: string
): Promise<EventSource> {
  try {
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
    
    // Emit event before sending
    this.eventBus.emit('mcp:streamingStart', { 
      conversation,
      userMessage,
      agentId
    });
    
    // Create streaming connection
    const source = this.currentProvider.createStreamingConnection(request);
    
    // Set up event handlers
    source.addEventListener('message', (event) => {
      try {
        const chunk = JSON.parse(event.data);
        
        // Emit chunk event
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
      console.error('Streaming error:', error);
      
      // Emit error event
      this.eventBus.emit('mcp:streamError', { 
        conversationId: conversation.id,
        agentId,
        error 
      });
    });
    
    source.addEventListener('close', () => {
      // Emit close event
      this.eventBus.emit('mcp:streamClosed', { 
        conversationId: conversation.id,
        agentId 
      });
    });
    
    return source;
  } catch (error) {
    console.error('Error setting up streaming connection:', error);
    this.eventBus.emit('mcp:streamError', { 
      conversation, 
      userMessage,
      agentId,
      error
    });
    throw error;
  }
}
```

### Provider Adapter Interface

Update the ProviderAdapter interface to support streaming:

```typescript
// src/providers/ProviderAdapter.ts
export interface ProviderAdapter {
  // ... other methods
  
  /**
   * Create a streaming connection
   */
  createStreamingConnection(request: ProviderRequest): EventSource;
  
  /**
   * Stream a message and collect all chunks
   */
  streamMessage(
    request: ProviderRequest, 
    onChunk: (chunk: ProviderChunk) => void
  ): Promise<ProviderResponse>;
}
```

### Anthropic Provider Implementation

Implement streaming for the Anthropic Claude API:

```typescript
// src/providers/AnthropicProvider.ts
export class AnthropicProvider implements ProviderAdapter {
  // ... other methods
  
  /**
   * Create a streaming connection to Claude API
   */
  public createStreamingConnection(request: ProviderRequest): EventSource {
    // Format request for Anthropic API
    const anthropicRequest = this.formatRequest(request);
    
    // Create EventSource
    const source = new EventSource(
      `${this.apiEndpoint}/v1/messages`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'Anthropic-Version': this.anthropicVersion
        },
        method: 'POST',
        body: JSON.stringify(anthropicRequest)
      }
    );
    
    return source;
  }
  
  /**
   * Stream a message and collect all chunks
   */
  public async streamMessage(
    request: ProviderRequest, 
    onChunk: (chunk: ProviderChunk) => void
  ): Promise<ProviderResponse> {
    return new Promise((resolve, reject) => {
      // Create streaming connection
      const source = this.createStreamingConnection(request);
      
      // Full response being built
      let fullResponse: ProviderResponse = {
        message: {
          role: 'assistant',
          content: ''
        },
        model: request.model,
        toolCalls: []
      };
      
      // Set up event handlers
      source.addEventListener('message', (event) => {
        try {
          const chunk = JSON.parse(event.data);
          
          // Update full response
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text') {
            fullResponse.message.content += chunk.delta.text;
          } else if (chunk.type === 'tool_use' || chunk.type === 'tool_use_delta') {
            // Handle tool calls
            this.updateToolCalls(fullResponse, chunk);
          }
          
          // Call onChunk callback
          onChunk({
            type: 'chunk',
            content: chunk
          });
        } catch (error) {
          console.error('Error parsing chunk:', error);
        }
      });
      
      source.addEventListener('error', (error) => {
        // Clean up
        source.close();
        
        // Reject promise
        reject(error);
      });
      
      source.addEventListener('done', () => {
        // Clean up
        source.close();
        
        // Resolve with full response
        resolve(fullResponse);
      });
    });
  }
  
  /**
   * Update tool calls in the response
   */
  private updateToolCalls(response: ProviderResponse, chunk: any): void {
    // Implementation details depend on the specific API format
    // This is a simplified example
    
    if (chunk.type === 'tool_use') {
      // New tool call
      response.toolCalls = [
        ...(response.toolCalls || []),
        {
          id: chunk.id,
          name: chunk.name,
          arguments: chunk.input || {}
        }
      ];
    } else if (chunk.type === 'tool_use_delta') {
      // Update existing tool call
      const toolCall = response.toolCalls?.find(tc => tc.id === chunk.id);
      
      if (toolCall) {
        // Update arguments
        if (chunk.delta.input) {
          toolCall.arguments = {
            ...toolCall.arguments,
            ...chunk.delta.input
          };
        }
      }
    }
  }
}
```

## Handling Streaming in the UI

Implement UI components to handle streaming responses:

```typescript
// src/ui/ChatView.ts
export class ChatView extends ItemView {
  // ... other properties
  private streamingMessage: HTMLElement | null = null;
  private currentStreamSource: EventSource | null = null;
  private streamedContent: string = '';
  private streamedToolCalls: ToolCall[] = [];
  
  constructor(leaf: WorkspaceLeaf, plugin: ChatsidianPlugin) {
    super(leaf);
    this.plugin = plugin;
    
    // Register event listeners
    this.registerEvents();
  }
  
  private registerEvents(): void {
    // Listen for streaming events
    this.plugin.eventBus.on('mcp:messageChunk', this.handleMessageChunk.bind(this));
    this.plugin.eventBus.on('mcp:streamError', this.handleStreamError.bind(this));
    this.plugin.eventBus.on('mcp:streamClosed', this.handleStreamClosed.bind(this));
  }
  
  /**
   * Handle message chunk event
   */
  private handleMessageChunk(data: { chunk: any, conversationId: string }): void {
    const { chunk, conversationId } = data;
    
    // Check if for current conversation
    if (this.currentConversation?.id !== conversationId) {
      return;
    }
    
    // Create streaming message container if not exists
    if (!this.streamingMessage) {
      // Create container
      this.streamingMessage = this.createStreamingMessageElement();
      
      // Reset streaming state
      this.streamedContent = '';
      this.streamedToolCalls = [];
      
      // Add to messages container
      this.messagesContainer.appendChild(this.streamingMessage);
      
      // Scroll to bottom
      this.scrollToBottom();
    }
    
    // Update streamed content
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text') {
      this.streamedContent += chunk.delta.text;
      this.updateStreamingMessageContent();
    } else if (chunk.type === 'tool_use' || chunk.type === 'tool_use_delta') {
      this.updateStreamingToolCalls(chunk);
    }
  }
  
  /**
   * Create streaming message element
   */
  private createStreamingMessageElement(): HTMLElement {
    const el = document.createElement('div');
    el.classList.add('message', 'message-assistant', 'message-streaming');
    
    // Add avatar
    const avatar = document.createElement('div');
    avatar.classList.add('message-avatar');
    avatar.innerHTML = '<svg>...</svg>'; // Assistant avatar SVG
    el.appendChild(avatar);
    
    // Add content container
    const content = document.createElement('div');
    content.classList.add('message-content');
    el.appendChild(content);
    
    // Add typing indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.classList.add('typing-indicator');
    typingIndicator.innerHTML = '<span></span><span></span><span></span>';
    content.appendChild(typingIndicator);
    
    return el;
  }
  
  /**
   * Update streaming message content
   */
  private updateStreamingMessageContent(): void {
    if (!this.streamingMessage) return;
    
    // Get content container
    const content = this.streamingMessage.querySelector('.message-content');
    if (!content) return;
    
    // Remove typing indicator
    const typingIndicator = content.querySelector('.typing-indicator');
    if (typingIndicator) {
      content.removeChild(typingIndicator);
    }
    
    // Format markdown
    const formatted = this.formatMarkdown(this.streamedContent);
    
    // Update content
    content.innerHTML = formatted;
    
    // Add tool calls if any
    if (this.streamedToolCalls.length > 0) {
      this.renderToolCalls(content, this.streamedToolCalls);
    }
    
    // Add typing indicator at the end
    const newTypingIndicator = document.createElement('div');
    newTypingIndicator.classList.add('typing-indicator');
    newTypingIndicator.innerHTML = '<span></span><span></span><span></span>';
    content.appendChild(newTypingIndicator);
    
    // Scroll to bottom
    this.scrollToBottom();
  }
  
  /**
   * Update streaming tool calls
   */
  private updateStreamingToolCalls(chunk: any): void {
    // Implementation depends on the specific API format
    // This is a simplified example
    
    if (chunk.type === 'tool_use') {
      // New tool call
      this.streamedToolCalls.push({
        id: chunk.id,
        name: chunk.name,
        arguments: chunk.input || {},
        status: 'pending'
      });
    } else if (chunk.type === 'tool_use_delta') {
      // Update existing tool call
      const toolCall = this.streamedToolCalls.find(tc => tc.id === chunk.id);
      
      if (toolCall && chunk.delta.input) {
        // Update arguments
        toolCall.arguments = {
          ...toolCall.arguments,
          ...chunk.delta.input
        };
      }
    }
    
    // Update UI
    this.updateStreamingMessageContent();
  }
  
  /**
   * Handle stream error
   */
  private handleStreamError(data: { error: any, conversationId: string }): void {
    const { error, conversationId } = data;
    
    console.error('Stream error:', error);
    
    // Check if for current conversation
    if (this.currentConversation?.id !== conversationId) {
      return;
    }
    
    // Display error in streaming message if exists
    if (this.streamingMessage) {
      // Get content container
      const content = this.streamingMessage.querySelector('.message-content');
      if (!content) return;
      
      // Remove typing indicator
      const typingIndicator = content.querySelector('.typing-indicator');
      if (typingIndicator) {
        content.removeChild(typingIndicator);
      }
      
      // Add error message
      const errorEl = document.createElement('div');
      errorEl.classList.add('error-message');
      errorEl.textContent = 'Error: The connection was interrupted. ';
      
      // Add retry button
      const retryBtn = document.createElement('button');
      retryBtn.textContent = 'Retry';
      retryBtn.addEventListener('click', () => this.retryLastMessage());
      errorEl.appendChild(retryBtn);
      
      content.appendChild(errorEl);
    }
    
    // Clean up streaming state
    this.currentStreamSource?.close();
    this.currentStreamSource = null;
    this.streamingMessage = null;
  }
  
  /**
   * Handle stream closed
   */
  private handleStreamClosed(data: { conversationId: string }): void {
    const { conversationId } = data;
    
    // Check if for current conversation
    if (this.currentConversation?.id !== conversationId) {
      return;
    }
    
    // Finalize streaming message if exists
    if (this.streamingMessage) {
      // Get content container
      const content = this.streamingMessage.querySelector('.message-content');
      if (!content) return;
      
      // Remove typing indicator
      const typingIndicator = content.querySelector('.typing-indicator');
      if (typingIndicator) {
        content.removeChild(typingIndicator);
      }
      
      // Remove streaming class
      this.streamingMessage.classList.remove('message-streaming');
      
      // Create message object
      const message: Message = {
        id: this.generateId(),
        role: 'assistant',
        content: this.streamedContent,
        toolCalls: this.streamedToolCalls,
        timestamp: Date.now()
      };
      
      // Add to conversation
      this.plugin.conversationManager.addMessageToConversation(
        this.currentConversation.id,
        message
      );
    }
    
    // Clean up streaming state
    this.currentStreamSource?.close();
    this.currentStreamSource = null;
    this.streamingMessage = null;
    this.streamedContent = '';
    this.streamedToolCalls = [];
  }
}
```

## Streaming CSS Styling

Add CSS styles for streaming messages:

```css
/* src/styles.css */
/* Streaming message styles */
.message-streaming {
  position: relative;
}

.typing-indicator {
  display: inline-flex;
  align-items: center;
  margin-left: 4px;
}

.typing-indicator span {
  height: 4px;
  width: 4px;
  margin: 0 1px;
  background-color: var(--text-muted);
  display: block;
  border-radius: 50%;
  opacity: 0.4;
}

.typing-indicator span:nth-child(1) {
  animation: typing 1s infinite;
}

.typing-indicator span:nth-child(2) {
  animation: typing 1s 0.25s infinite;
}

.typing-indicator span:nth-child(3) {
  animation: typing 1s 0.5s infinite;
}

@keyframes typing {
  0% {
    transform: translateY(0px);
    opacity: 0.4;
  }
  50% {
    transform: translateY(-5px);
    opacity: 0.9;
  }
  100% {
    transform: translateY(0px);
    opacity: 0.4;
  }
}
```

## Integration with Tool Execution

Implement streaming support for tool execution:

```typescript
// src/mcp/MCPClient.ts
/**
 * Process tool calls during streaming
 */
public async processStreamingToolCall(
  conversationId: string,
  toolCall: ToolCall
): Promise<ToolResult> {
  try {
    // Update tool call status
    toolCall.status = 'pending';
    
    // Emit event
    this.eventBus.emit('mcp:toolCallStart', { 
      conversationId, 
      toolCall 
    });
    
    // Execute tool call
    const result = await this.toolManager.executeToolCall(toolCall);
    
    // Create tool result
    const toolResult: ToolResult = {
      id: this.generateId(),
      toolCallId: toolCall.id,
      content: result
    };
    
    // Update tool call status
    toolCall.status = 'success';
    
    // Emit event
    this.eventBus.emit('mcp:toolCallComplete', {
      conversationId,
      toolCall,
      toolResult
    });
    
    return toolResult;
  } catch (error) {
    console.error(`Error executing tool call ${toolCall.name}:`, error);
    
    // Create error result
    const toolResult: ToolResult = {
      id: this.generateId(),
      toolCallId: toolCall.id,
      content: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    
    // Update tool call status
    toolCall.status = 'error';
    
    // Emit event
    this.eventBus.emit('mcp:toolCallError', {
      conversationId,
      toolCall,
      toolResult,
      error
    });
    
    return toolResult;
  }
}
```

## Streaming Input Controls

Add controls for managing streaming in the chat interface:

```typescript
// src/ui/InputArea.ts
export class InputArea {
  // ... other properties
  private isStreaming: boolean = false;
  private cancelButton: HTMLButtonElement;
  
  constructor(containerEl: HTMLElement, plugin: ChatsidianPlugin, chatView: ChatView) {
    this.containerEl = containerEl;
    this.plugin = plugin;
    this.chatView = chatView;
    
    // Create UI
    this.createUI();
    
    // Register event listeners
    this.registerEvents();
  }
  
  private createUI(): void {
    // ... other UI elements
    
    // Create cancel button (initially hidden)
    this.cancelButton = document.createElement('button');
    this.cancelButton.classList.add('cancel-button', 'hidden');
    this.cancelButton.innerHTML = '<svg>...</svg>'; // Cancel icon
    this.cancelButton.title = 'Cancel streaming';
    this.cancelButton.addEventListener('click', this.handleCancelClick.bind(this));
    this.controlsContainer.appendChild(this.cancelButton);
  }
  
  private registerEvents(): void {
    // Listen for streaming events
    this.plugin.eventBus.on('mcp:streamingStart', this.handleStreamingStart.bind(this));
    this.plugin.eventBus.on('mcp:streamClosed', this.handleStreamingEnd.bind(this));
    this.plugin.eventBus.on('mcp:streamError', this.handleStreamingEnd.bind(this));
  }
  
  /**
   * Handle send button click
   */
  private async handleSendClick(): Promise<void> {
    const content = this.inputEl.value.trim();
    if (!content) return;
    
    // Disable input during streaming
    this.inputEl.disabled = true;
    this.sendButton.disabled = true;
    
    // Clear input
    this.inputEl.value = '';
    
    // Send message with streaming
    await this.chatView.sendMessageWithStreaming(content);
  }
  
  /**
   * Handle cancel button click
   */
  private handleCancelClick(): void {
    // Cancel streaming
    this.chatView.cancelStreaming();
    
    // Update UI
    this.handleStreamingEnd();
  }
  
  /**
   * Handle streaming start
   */
  private handleStreamingStart(): void {
    this.isStreaming = true;
    
    // Show cancel button
    this.cancelButton.classList.remove('hidden');
    
    // Hide send button
    this.sendButton.classList.add('hidden');
    
    // Disable input
    this.inputEl.disabled = true;
  }
  
  /**
   * Handle streaming end
   */
  private handleStreamingEnd(): void {
    this.isStreaming = false;
    
    // Hide cancel button
    this.cancelButton.classList.add('hidden');
    
    // Show send button
    this.sendButton.classList.remove('hidden');
    
    // Enable input
    this.inputEl.disabled = false;
    this.sendButton.disabled = false;
    
    // Focus input
    this.inputEl.focus();
  }
}
```

## Implementation References

The streaming implementation should be integrated into these components:

- [[💻 Coding/Projects/Chatsidian/1_Architecture/Components/MCPConnector.md]] - For the core streaming connection
- [[💻 Coding/Projects/Chatsidian/3_Implementation/Phase2-MCP-BCP-Integration.md]] - For integration with BCPs
- New files:
  - `src/ui/ChatView.ts` - For streaming UI handling
  - `src/ui/InputArea.ts` - For input controls during streaming
  - `src/styles.css` - For streaming-related styles

## Browser Compatibility

Note that some browsers may have different implementations or limitations with Server-Sent Events (SSE). To ensure broad compatibility:

1. Consider implementing a fallback mechanism for older browsers
2. Test streaming on different browsers (Chrome, Firefox, Safari)
3. Handle reconnection for unstable connections

## Performance Considerations

When implementing streaming, consider these performance aspects:

1. **DOM Updates** - Minimize DOM manipulation during streaming to avoid UI jank
2. **Memory Usage** - Clear unnecessary data structures after streaming completes
3. **Bandwidth** - Handle slow connections and provide user feedback
4. **Reconnection Logic** - Implement exponential backoff for reconnection attempts

## References to MCP Specification

Streaming is described in the MCP specification:
- [MCP Transports Documentation](https://modelcontextprotocol.io/docs/concepts/transports)
- [SSE Transport Specification](https://modelcontextprotocol.io/docs/concepts/transports#server-sent-events-sse)
