/**
 * Provider Adapter Wrapper
 * 
 * This file provides a wrapper around the existing ProviderAdapter interface
 * to adapt it to the MCPInterfaces.ProviderAdapter interface.
 */

import { ProviderAdapter as CoreProviderAdapter } from '../../../providers/ProviderAdapter';
import { 
  ProviderAdapter, 
  Message, 
  AssistantMessage, 
  ToolMessage, 
  ModelRequestOptions,
  MessageRole
} from '../MCPInterfaces';
import { ProviderRequest, ProviderMessage } from '../../../models/Provider';

/**
 * Wrapper for provider adapters that adapts the core ProviderAdapter interface
 * to the MCPInterfaces.ProviderAdapter interface.
 */
export class ProviderAdapterWrapper implements ProviderAdapter {
  private coreAdapter: CoreProviderAdapter;
  
  /**
   * Create a new provider adapter wrapper
   * @param coreAdapter - Core provider adapter to wrap
   */
  constructor(coreAdapter: CoreProviderAdapter) {
    this.coreAdapter = coreAdapter;
  }
  
  /**
   * Send a message to the provider
   * @param messages - Messages for context
   * @param options - Request options
   * @returns Promise resolving to the assistant's response
   */
  public async sendMessage(
    messages: (Message | AssistantMessage | ToolMessage)[],
    options: ModelRequestOptions
  ): Promise<AssistantMessage> {
    // Convert messages to provider format
    const providerMessages = this.convertToProviderMessages(messages);
    
    // Create request
    const request: ProviderRequest = {
      model: options.model,
      messages: providerMessages,
      temperature: options.temperature,
      maxTokens: options.max_tokens,
      stream: false,
      tools: options.tools
    };
    
    // Send request
    const response = await this.coreAdapter.sendRequest(request);
    
    // Convert response to AssistantMessage
    return this.convertToAssistantMessage(response.message);
  }
  
  /**
   * Stream a message from the provider
   * @param messages - Messages for context
   * @param options - Request options
   * @param onChunk - Callback for each chunk
   * @returns Promise resolving to the complete response
   */
  public async streamMessage(
    messages: (Message | AssistantMessage | ToolMessage)[],
    options: ModelRequestOptions,
    onChunk: (chunk: any) => void
  ): Promise<AssistantMessage> {
    // Convert messages to provider format
    const providerMessages = this.convertToProviderMessages(messages);
    
    // Create request
    const request: ProviderRequest = {
      model: options.model,
      messages: providerMessages,
      temperature: options.temperature,
      maxTokens: options.max_tokens,
      stream: true,
      tools: options.tools
    };
    
    // Create response accumulator
    let content = '';
    let toolCalls: any[] = [];
    
    // Send streaming request
    await this.coreAdapter.sendStreamingRequest(request, (chunk) => {
      // Process chunk based on the ProviderChunk structure
      if (chunk.delta.content) {
        content += chunk.delta.content;
      }
      
      // Handle tool calls if present
      if (chunk.delta.toolCalls && chunk.delta.toolCalls.length > 0) {
        for (const toolCall of chunk.delta.toolCalls) {
          // Find existing tool call or create new one
          const existingToolCall = toolCalls.find(tc => tc.id === toolCall.id);
          
          if (existingToolCall) {
            // Update existing tool call
            if (toolCall.name) existingToolCall.name = toolCall.name;
            if (toolCall.arguments) existingToolCall.arguments = toolCall.arguments;
          } else {
            // Add new tool call
            toolCalls.push({
              id: toolCall.id || chunk.id,
              name: toolCall.name || '',
              arguments: toolCall.arguments || {}
            });
          }
        }
      }
      
      // Call chunk handler
      onChunk(chunk);
    });
    
    // Return complete message
    return {
      role: MessageRole.Assistant,
      content,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      timestamp: Date.now()
    };
  }
  
  /**
   * Test the connection to the provider
   * @returns Promise resolving to whether the connection is valid
   */
  public async testConnection(): Promise<boolean> {
    return this.coreAdapter.testConnection();
  }
  
  /**
   * Get available models from the provider
   * @returns Promise resolving to array of model IDs
   */
  public async getAvailableModels(): Promise<string[]> {
    const models = await this.coreAdapter.getAvailableModels();
    return models.map(model => model.id);
  }
  
  /**
   * Convert MCP messages to provider messages
   * @param messages - MCP messages
   * @returns Provider messages
   * @private
   */
  private convertToProviderMessages(
    messages: (Message | AssistantMessage | ToolMessage)[]
  ): ProviderMessage[] {
    return messages.map(message => {
      const providerMessage: ProviderMessage = {
        role: message.role,
        content: message.content
      };
      
      // Add tool_call_id for tool messages
      if (message.role === MessageRole.Tool) {
        // Use the toolResults array for tool messages
        providerMessage.toolResults = [{
          toolCallId: (message as ToolMessage).tool_call_id,
          content: message.content
        }];
      }
      
      return providerMessage;
    });
  }
  
  /**
   * Convert provider message to assistant message
   * @param message - Provider message
   * @returns Assistant message
   * @private
   */
  private convertToAssistantMessage(message: ProviderMessage): AssistantMessage {
    return {
      role: MessageRole.Assistant,
      content: message.content || '',
      tool_calls: message.toolCalls,
      timestamp: Date.now()
    };
  }
}