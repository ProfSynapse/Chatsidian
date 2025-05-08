/**
 * Anthropic Provider Adapter
 * 
 * This file implements the provider adapter for Anthropic's Claude API,
 * allowing Chatsidian to communicate with Claude models.
 */

import { 
  ProviderAdapter, 
  ModelRequestOptions, 
  Message, 
  AssistantMessage, 
  ToolMessage, 
  MessageRole, 
  ToolCall 
} from '../MCPInterfaces';

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
   * @param messages - Messages for context
   * @param options - Request options
   * @returns Promise resolving to the assistant's response
   */
  public async sendMessage(
    messages: (Message | AssistantMessage | ToolMessage)[],
    options: ModelRequestOptions
  ): Promise<AssistantMessage> {
    try {
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
        ...options.additionalParams
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
        const errorData = await response.json();
        throw new Error(`Anthropic API error: ${errorData.error?.message || response.statusText}`);
      }
      
      // Parse response
      const result = await response.json();
      
      // Format response as AssistantMessage
      return this.formatResponse(result);
    } catch (error) {
      console.error('Error sending message to Anthropic:', error);
      throw error;
    }
  }
  
  /**
   * Stream a message from Claude
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
    try {
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
        stream: true,
        ...options.additionalParams
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
        const errorData = await response.json();
        throw new Error(`Anthropic API error: ${errorData.error?.message || response.statusText}`);
      }
      
      // Process the stream
      const reader = response.body!.getReader();
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
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error streaming message from Anthropic:', error);
      throw error;
    }
  }
  
  /**
   * Test the connection to Anthropic
   * @returns Promise resolving to whether the connection is valid
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
   * Get available models from Anthropic
   * @returns Promise resolving to array of model IDs
   */
  public async getAvailableModels(): Promise<string[]> {
    try {
      // Send request to get models
      const response = await fetch('https://api.anthropic.com/v1/models', {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey,
          'Anthropic-Version': this.apiVersion
        }
      });
      
      // Check for errors
      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.statusText}`);
      }
      
      // Parse response
      const result = await response.json();
      
      // Extract model IDs
      return result.models.map((model: any) => model.id);
    } catch (error) {
      console.error('Error getting available models from Anthropic:', error);
      return [];
    }
  }
  
  /**
   * Format messages for Anthropic API
   * @param messages - Messages to format
   * @returns Formatted messages
   * @private
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
   * @param tools - Tools to format
   * @returns Formatted tools
   * @private
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
   * @param response - Response to format
   * @returns Formatted response
   * @private
   */
  private formatResponse(response: any): AssistantMessage {
    const message = response.content;
    let content = '';
    let toolCalls: ToolCall[] | undefined;
    
    // Process content blocks
    for (const block of message) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'tool_use') {
        // Initialize tool calls array if needed
        if (!toolCalls) {
          toolCalls = [];
        }
        
        // Add tool call
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input
        });
      }
    }
    
    // Convert to AssistantMessage format
    return {
      role: MessageRole.Assistant,
      content,
      tool_calls: toolCalls,
      id: response.id,
      timestamp: Date.now()
    };
  }
}