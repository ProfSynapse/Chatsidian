/**
 * Requesty Provider Adapter
 * 
 * This file implements the ProviderAdapter interface for the Requesty API.
 * It uses Obsidian's requestUrl method to communicate with the Requesty API.
 */

import { requestUrl, RequestUrlParam } from 'obsidian';
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
 * Adapter for the Requesty API.
 */
export class RequestyAdapter extends BaseAdapter {
  /**
   * The name of the provider
   */
  readonly provider = 'requesty';

  /**
   * Create a new RequestyAdapter.
   * 
   * @param apiKey The Requesty API key
   * @param apiEndpoint Optional custom API endpoint URL
   */
  constructor(apiKey: string, apiEndpoint?: string) {
    super(apiKey, apiEndpoint);
  }

  /**
   * Get the base URL for the Requesty API.
   * 
   * @returns The base URL
   */
  private getBaseUrl(): string {
    return this.apiEndpoint || 'https://router.requesty.ai';
  }

  /**
   * Test the connection to the Requesty API.
   * Makes a lightweight API call to verify credentials.
   * 
   * @returns A promise that resolves to true if the connection is successful, false otherwise
   */
  async testConnection(): Promise<boolean> {
    try {
      this.validateApiKey();
      
      // Make a minimal request to test the connection
      const response = await requestUrl({
        url: `${this.getBaseUrl()}/v1/models`,
        method: 'GET',
        headers: this.getHeaders(),
        throw: false
      });
      
      return response.status === 200;
    } catch (error) {
      this.logError('testConnection', error);
      return false;
    }
  }

  /**
   * Get a list of available models from Requesty.
   * 
   * @returns A promise that resolves to an array of ModelInfo objects
   */
  async getAvailableModels(): Promise<ModelInfo[]> {
    try {
      this.validateApiKey();
      
      // Request models from Requesty API
      const response = await requestUrl({
        url: `${this.getBaseUrl()}/v1/models`,
        method: 'GET',
        headers: this.getHeaders(),
        throw: false
      });
      
      if (response.status !== 200) {
        throw new Error(`Failed to get models: ${response.status} ${response.text}`);
      }
      
      // Parse the response
      const data = response.json;
      
      // Map to our ModelInfo format
      if (data && data.data && Array.isArray(data.data)) {
        return data.data.map((model: any) => {
          // Try to find the model in COMMON_MODELS
          const providerName = model.id.split('/')[0] || 'unknown';
          const modelId = model.id.split('/')[1] || model.id;
          
          return {
            id: model.id,
            name: model.name || modelId,
            provider: this.provider,
            contextSize: model.context_length || 4096,
            supportsTools: model.capabilities?.tools || false,
            supportsJson: model.capabilities?.json_response || false,
            maxOutputTokens: model.capabilities?.max_output_tokens || 4096
          };
        });
      }
      
      // Fallback to known models
      return [
        {
          id: 'openai/gpt-4o',
          name: 'GPT-4o (via Requesty)',
          provider: this.provider,
          contextSize: 128000,
          supportsTools: true,
          supportsJson: true,
          maxOutputTokens: 4096
        },
        {
          id: 'anthropic/claude-3-opus-20240229',
          name: 'Claude 3 Opus (via Requesty)',
          provider: this.provider,
          contextSize: 200000,
          supportsTools: true,
          supportsJson: true,
          maxOutputTokens: 4096
        },
        {
          id: 'anthropic/claude-3-sonnet-20240229',
          name: 'Claude 3 Sonnet (via Requesty)',
          provider: this.provider,
          contextSize: 200000,
          supportsTools: true,
          supportsJson: true,
          maxOutputTokens: 4096
        }
      ];
    } catch (error) {
      this.logError('getAvailableModels', error);
      // Return a default set of models
      return [
        {
          id: 'openai/gpt-4o',
          name: 'GPT-4o (via Requesty)',
          provider: this.provider,
          contextSize: 128000,
          supportsTools: true,
          supportsJson: true,
          maxOutputTokens: 4096
        },
        {
          id: 'anthropic/claude-3-opus-20240229',
          name: 'Claude 3 Opus (via Requesty)',
          provider: this.provider,
          contextSize: 200000,
          supportsTools: true,
          supportsJson: true,
          maxOutputTokens: 4096
        }
      ];
    }
  }

  /**
   * Send a request to the Requesty API and get a complete response.
   * 
   * @param request The request parameters
   * @returns A promise that resolves to a ProviderResponse
   */
  async sendRequest(request: ProviderRequest): Promise<ProviderResponse> {
    try {
      this.validateApiKey();
      
      // Create the Requesty request
      const requestyRequest = this.createRequestyRequest(request);
      
      // Send the request
      const response = await requestUrl({
        url: `${this.getBaseUrl()}/v1/chat/completions`,
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestyRequest),
        throw: false
      });
      
      if (response.status !== 200) {
        throw new Error(`Request failed: ${response.status} ${response.text}`);
      }
      
      const data = response.json;
      
      // Convert the response to our format
      const providerResponse: ProviderResponse = {
        id: data.id || 'requesty-response',
        message: {
          role: 'assistant',
          content: data.choices?.[0]?.message?.content || ''
        }
      };
      
      // Add tool calls if present
      if (data.choices?.[0]?.message?.tool_calls) {
        providerResponse.toolCalls = data.choices[0].message.tool_calls.map((toolCall: any) => ({
          id: toolCall.id,
          type: 'function',
          function: {
            name: toolCall.function.name,
            arguments: toolCall.function.arguments
          }
        }));
      }
      
      return providerResponse;
    } catch (error) {
      this.logError('sendRequest', error);
      throw new Error(`Requesty request failed: ${error.message}`);
    }
  }

  /**
   * Send a streaming request to the Requesty API.
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
      
      // Create the Requesty request
      const requestyRequest = this.createRequestyRequest(request);
      
      // For streaming, we need to use a different approach since EventSource doesn't support POST
      // We'll use fetch with ReadableStream instead
      const response = await fetch(`${this.getBaseUrl()}/v1/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestyRequest)
      });
      
      if (!response.ok) {
        throw new Error(`Streaming request failed: ${response.status} ${response.statusText}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }
      
      // Create an AbortController for this request
      const abortController = this.createAbortController();
      
      // Process the stream
      return new Promise(async (resolve, reject) => {
        let responseId = '';
        let decoder = new TextDecoder();
        let buffer = '';
        
        try {
          // Set up abort handler
          abortController.signal.addEventListener('abort', () => {
            reader.cancel();
            resolve();
          });
          
          // Read the stream
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              break;
            }
            
            // Decode the chunk
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            
            // Process any complete lines
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer
            
            for (const line of lines) {
              // Skip empty lines and comments
              if (!line.trim() || line.startsWith(':')) {
                continue;
              }
              
              // Check for [DONE] message
              if (line === 'data: [DONE]') {
                continue;
              }
              
              // Parse the data
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.substring(6));
                  
                  // Store the response ID
                  if (!responseId && data.id) {
                    responseId = data.id;
                  }
                  
                  // Process delta
                  const delta = data.choices?.[0]?.delta;
                  
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
                } catch (error) {
                  console.error('Error processing stream chunk:', error);
                }
              }
            }
          }
          
          resolve();
        } catch (error) {
          // Ignore if we aborted
          if (abortController.signal.aborted) {
            resolve();
            return;
          }
          
          reject(error);
        }
      });
    } catch (error) {
      // Ignore abort errors
      if (error.name === 'AbortError') {
        return;
      }
      
      this.logError('sendStreamingRequest', error);
      throw new Error(`Requesty streaming request failed: ${error.message}`);
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Create a Requesty request from our common request format.
   * 
   * @param request Our common request format
   * @returns Requesty request format
   */
  private createRequestyRequest(request: ProviderRequest): any {
    // Create the Requesty request (OpenAI-compatible format)
    const requestyRequest: any = {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature !== undefined ? request.temperature : 0.7,
      max_tokens: request.maxTokens || 4096,
      stream: request.stream || false
    };
    
    // Add tools if present
    if (request.tools && request.tools.length > 0) {
      requestyRequest.tools = request.tools;
    }
    
    return requestyRequest;
  }

  /**
   * Get the headers for Requesty API requests.
   * 
   * @returns The headers object
   */
  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }
}
