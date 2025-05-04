/**
 * Anthropic Provider Adapter
 * 
 * This file implements the ProviderAdapter interface for the Anthropic API.
 * It uses the official Anthropic SDK to communicate with the Anthropic API.
 */

// Import the Anthropic SDK
import Anthropic from '@anthropic-ai/sdk';
import { 
  ModelInfo, 
  ProviderChunk, 
  ProviderMessage, 
  ProviderRequest, 
  ProviderResponse,
  COMMON_MODELS
} from '../models/Provider';
import { BaseAdapter } from './BaseAdapter';

/**
 * Adapter for the Anthropic API.
 */
export class AnthropicAdapter extends BaseAdapter {
  /**
   * The name of the provider
   */
  readonly provider = 'anthropic';

  /**
   * The Anthropic client instance
   */
  private client: Anthropic;

  /**
   * Create a new AnthropicAdapter.
   * 
   * @param apiKey The Anthropic API key
   * @param apiEndpoint Optional custom API endpoint URL
   */
  constructor(apiKey: string, apiEndpoint?: string) {
    super(apiKey, apiEndpoint);
    
    const options: any = {
      apiKey: this.apiKey
    };

    // Use custom API endpoint if provided
    if (this.apiEndpoint) {
      options.baseURL = this.apiEndpoint;
    }

    this.client = new Anthropic(options);
  }

  /**
   * Test the connection to the Anthropic API.
   * Makes a lightweight API call to verify credentials.
   * 
   * @returns A promise that resolves to true if the connection is successful, false otherwise
   */
  async testConnection(): Promise<boolean> {
    try {
      this.validateApiKey();
      
      // Make a minimal request to test the connection
      await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hello' }]
      });
      
      return true;
    } catch (error) {
      this.logError('testConnection', error);
      return false;
    }
  }

  /**
   * Get a list of available models from Anthropic.
   * 
   * @returns A promise that resolves to an array of ModelInfo objects
   */
  async getAvailableModels(): Promise<ModelInfo[]> {
    try {
      this.validateApiKey();
      
      // Anthropic doesn't have a models endpoint, so we return the known models
      return COMMON_MODELS.filter(model => model.provider === this.provider);
    } catch (error) {
      this.logError('getAvailableModels', error);
      return COMMON_MODELS.filter(model => model.provider === this.provider);
    }
  }

  /**
   * Send a request to the Anthropic API and get a complete response.
   * 
   * @param request The request parameters
   * @returns A promise that resolves to a ProviderResponse
   */
  async sendRequest(request: ProviderRequest): Promise<ProviderResponse> {
    try {
      this.validateApiKey();
      
      // Create the Anthropic request
      const anthropicRequest = this.createAnthropicRequest(request);
      
      // Send the request
      const response = await this.client.messages.create(anthropicRequest);
      
      // Convert the response to our format
      const providerResponse: ProviderResponse = {
        id: response.id,
        message: {
          role: 'assistant',
          content: ''
        }
      };
      
      // Extract text content
      const textContent = response.content.find((c: any) => c.type === 'text');
      if (textContent && 'text' in textContent) {
        providerResponse.message.content = textContent.text || '';
      }
      
      // Add tool calls if present
      if (response.content.some((c: any) => c.type === 'tool_use')) {
        const toolCalls = response.content
          .filter((c: any) => c.type === 'tool_use')
          .map((c: any) => ({
            id: c.id,
            type: 'function',
            function: {
              name: c.name,
              arguments: c.input
            }
          }));
        
        if (toolCalls.length > 0) {
          providerResponse.toolCalls = toolCalls;
        }
      }
      
      return providerResponse;
    } catch (error) {
      this.logError('sendRequest', error);
      throw new Error(`Anthropic request failed: ${error.message}`);
    }
  }

  /**
   * Send a streaming request to the Anthropic API.
   * 
   * @param request The request parameters (should have stream: true)
   * @param onChunk Callback function that will be called for each chunk received
   * @returns A promise that resolves when the stream is complete
   */
  async sendStreamingRequest(
    request: ProviderRequest,
    onChunk: (chunk: ProviderChunk) => void
  ): Promise<void> {
    try {
      this.validateApiKey();
      
      // Ensure stream is true
      request.stream = true;
      
      // Create the Anthropic request
      const anthropicRequest = this.createAnthropicRequest(request);
      
      // Create an AbortController for this request
      const abortController = this.createAbortController();
      
      // Send the streaming request
      const streamResponse = await this.client.messages.create({
        ...anthropicRequest,
        stream: true
      }, {
        signal: abortController.signal
      });
      
      try {
        // Use type assertion to ensure TypeScript knows this is an async iterable
        const stream = streamResponse as unknown as AsyncIterable<any>;
        
        // Process the stream
        let responseId = '';
        
        for await (const chunk of stream) {
          // Store the response ID
          if (!responseId && chunk.message?.id) {
            responseId = chunk.message.id;
          }
          
          // Process delta
          if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
            const providerChunk: ProviderChunk = {
              id: responseId || 'stream',
              delta: {
                content: chunk.delta.text
              }
            };
            
            // Call the callback with the chunk
            onChunk(providerChunk);
          } else if (chunk.type === 'content_block_start' && chunk.content_block?.type === 'tool_use') {
            // Handle tool use start
            const toolUse = chunk.content_block;
            
            const providerChunk: ProviderChunk = {
              id: responseId || 'stream',
              delta: {
                toolCalls: [{
                  id: toolUse.id,
                  type: 'function',
                  function: {
                    name: toolUse.name,
                    arguments: '{}'
                  }
                }]
              }
            };
            
            onChunk(providerChunk);
          } else if (chunk.type === 'tool_use_delta' && chunk.delta?.input) {
            // Handle tool use input delta
            const providerChunk: ProviderChunk = {
              id: responseId || 'stream',
              delta: {
                toolCalls: [{
                  id: chunk.id,
                  type: 'function',
                  function: {
                    arguments: chunk.delta.input
                  }
                }]
              }
            };
            
            onChunk(providerChunk);
          }
        }
      } catch (streamError) {
        if (streamError.name === 'AbortError') {
          return;
        }
        throw streamError;
      }
    } catch (error) {
      // Ignore abort errors
      if (error.name === 'AbortError') {
        return;
      }
      
      this.logError('sendStreamingRequest', error);
      throw new Error(`Anthropic streaming request failed: ${error.message}`);
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Create an Anthropic request from our common request format.
   * 
   * @param request Our common request format
   * @returns Anthropic request format
   */
  private createAnthropicRequest(request: ProviderRequest): any {
    // Map our messages to Anthropic format
    const messages = request.messages.map(msg => {
      const anthropicMsg: any = {
        role: this.mapRole(msg.role),
        content: msg.content
      };
      
      return anthropicMsg;
    });
    
    // Create the Anthropic request
    const anthropicRequest: any = {
      model: request.model,
      messages,
      max_tokens: request.maxTokens || 4096,
      stream: request.stream || false
    };
    
    // Add temperature if present
    if (request.temperature !== undefined) {
      anthropicRequest.temperature = request.temperature;
    }
    
    // Add tools if present
    if (request.tools && request.tools.length > 0) {
      anthropicRequest.tools = request.tools.map(tool => {
        if (tool.type === 'function') {
          return {
            name: tool.function.name,
            description: tool.function.description,
            input_schema: tool.function.parameters
          };
        }
        return tool;
      });
    }
    
    return anthropicRequest;
  }

  /**
   * Map our role names to Anthropic role names.
   * 
   * @param role Our role name
   * @returns Anthropic role name
   */
  private mapRole(role: string): string {
    switch (role) {
      case 'system':
        return 'system';
      case 'assistant':
        return 'assistant';
      case 'user':
      case 'human':
        return 'user';
      default:
        return 'user';
    }
  }
}
