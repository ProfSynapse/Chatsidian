/**
 * OpenAI Provider Adapter
 * 
 * This file implements the ProviderAdapter interface for the OpenAI API.
 * It uses the official OpenAI SDK to communicate with the OpenAI API.
 */

import OpenAI from 'openai';
import { 
  ModelInfo, 
  ProviderChunk, 
  ProviderMessage, 
  ProviderRequest, 
  ProviderResponse
} from '../models/Provider';
import { modelRegistry } from './ModelRegistry';
import { ProviderType } from '../ui/models/ProviderType';
import { BaseAdapter } from './BaseAdapter';

/**
 * Adapter for the OpenAI API.
 */
export class OpenAIAdapter extends BaseAdapter {
  /**
   * The name of the provider
   */
  readonly provider = 'openai';

  /**
   * The OpenAI client instance
   */
  private client: OpenAI;

  /**
   * Create a new OpenAIAdapter.
   * 
   * @param apiKey The OpenAI API key
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

    this.client = new OpenAI(options);
  }

  /**
   * Test the connection to the OpenAI API.
   * Makes a lightweight API call to verify credentials.
   * 
   * @returns A promise that resolves to true if the connection is successful, false otherwise
   */
  async testConnection(): Promise<boolean> {
    try {
      this.validateApiKey();
      
      // List models as a lightweight API call to test connection
      await this.client.models.list();
      return true;
    } catch (error) {
      this.logError('testConnection', error);
      return false;
    }
  }

  /**
   * Get a list of available models from OpenAI.
   * 
   * @returns A promise that resolves to an array of ModelInfo objects
   */
  async getAvailableModels(): Promise<ModelInfo[]> {
    try {
      this.validateApiKey();
      
      // Use the ModelRegistry instead of API call
      return modelRegistry.getModelsForProvider('openai' as ProviderType);
    } catch (error) {
      this.logError('getAvailableModels', error);
      // Still use the ModelRegistry even in error case
      return modelRegistry.getModelsForProvider('openai' as ProviderType);
    }
  }

  /**
   * Send a request to the OpenAI API and get a complete response.
   * 
   * @param request The request parameters
   * @returns A promise that resolves to a ProviderResponse
   */
  async sendRequest(request: ProviderRequest): Promise<ProviderResponse> {
    try {
      this.validateApiKey();
      
      // Create the OpenAI request
      const openaiRequest = this.createOpenAIRequest(request);
      
      // Send the request
      const response = await this.client.chat.completions.create(openaiRequest);
      
      // Convert the response to our format
      const providerResponse: ProviderResponse = {
        id: response.id,
        message: {
          role: response.choices[0]?.message?.role || 'assistant',
          content: response.choices[0]?.message?.content || ''
        }
      };
      
      // Add tool calls if present
      if (response.choices[0]?.message?.tool_calls) {
        providerResponse.toolCalls = response.choices[0].message.tool_calls;
      }
      
      return providerResponse;
    } catch (error) {
      this.logError('sendRequest', error);
      throw new Error(`OpenAI request failed: ${error.message}`);
    }
  }

  /**
   * Send a streaming request to the OpenAI API.
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
      
      // Create the OpenAI request
      const openaiRequest = this.createOpenAIRequest(request);
      
      // Create an AbortController for this request
      const abortController = this.createAbortController();
      
      // Send the streaming request
      const streamResponse = await this.client.chat.completions.create({
        ...openaiRequest,
        stream: true
      }, {
        signal: abortController.signal
      });
      
      // Process the stream
      let responseId = '';
      
      try {
        // Use type assertion to ensure TypeScript knows this is an async iterable
        const stream = streamResponse as unknown as AsyncIterable<any>;
        for await (const chunk of stream) {
          // Store the response ID
          if (!responseId && chunk.id) {
            responseId = chunk.id;
          }
          
          // Process delta
          const delta = chunk.choices[0]?.delta;
          
          if (delta) {
            const providerChunk: ProviderChunk = {
              id: responseId || 'stream',
              delta: {}
            };
            
            // Add content delta if present
            if (delta.content) {
              providerChunk.delta.content = delta.content;
            }
            
            // Add tool call delta if present
            if (delta.tool_calls) {
              providerChunk.delta.toolCalls = delta.tool_calls;
            }
            
            // Call the callback with the chunk
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
      throw new Error(`OpenAI streaming request failed: ${error.message}`);
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Create an OpenAI request from our common request format.
   * 
   * @param request Our common request format
   * @returns OpenAI request format
   */
  private createOpenAIRequest(request: ProviderRequest): any {
    // Map our messages to OpenAI format
    const messages = request.messages.map(msg => ({
      role: msg.role as any,
      content: msg.content,
      tool_calls: msg.toolCalls,
      tool_results: msg.toolResults
    }));
    
    // Create the OpenAI request
    const openaiRequest: any = {
      model: request.model,
      messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream: request.stream
    };
    
    // Add tools if present
    if (request.tools && request.tools.length > 0) {
      openaiRequest.tools = request.tools;
    }
    
    return openaiRequest;
  }
}
