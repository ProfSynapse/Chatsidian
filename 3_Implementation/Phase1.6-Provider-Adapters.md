---
title: Phase 1.6 - Provider Adapters
description: Building the provider adapter pattern for AI API connections in the Chatsidian plugin
date: 2025-05-03
status: implementing
tags:
  - implementation
  - microphase
  - provider-adapters
  - chatsidian
---

# Phase 1.6: Provider Adapters

## Overview

This microphase focuses on building the provider adapter pattern for AI API connections in the Chatsidian plugin. The provider adapters serve as a bridge between the plugin and various AI services, providing a unified interface for communication while abstracting away the specific implementation details of each provider's API.

## Objectives

- Create a provider adapter interface
- Implement provider-specific adapters (Anthropic, OpenAI, Google Gemini, OpenRouter, Requesty)
- Create a factory for instantiating the appropriate adapter
- Add support for streaming responses
- Implement robust error handling
- Write tests for provider adapters

## Implementation Steps

### 1. Define the Provider Adapter Interface

Create `src/providers/ProviderAdapter.ts`:

```typescript
/**
 * Provider adapter interface for AI API connections.
 */

import { Plugin } from 'obsidian';
import { ProviderRequest, ProviderResponse, ProviderChunk } from '../models/Provider';

/**
 * Interface for provider adapters
 * Each provider must implement this interface to provide a consistent
 * way of interacting with different AI services.
 */
export interface ProviderAdapter {
  /**
   * Get the provider type
   * @returns The provider type identifier
   */
  getProviderType(): string;
  
  /**
   * Validate the API key with a minimal request
   * @returns Promise resolving to whether the key is valid
   */
  validateApiKey(): Promise<boolean>;
  
  /**
   * Generate a response from the AI model
   * @param request Provider request object
   * @returns Promise resolving to the model's response
   */
  generateResponse(request: ProviderRequest): Promise<ProviderResponse>;
  
  /**
   * Stream a response from the AI model, sending chunks as they arrive
   * @param request Provider request object
   * @param onChunk Callback function for processing each chunk
   * @param plugin Plugin instance for lifecycle management
   * @returns Promise resolving to the complete response when streaming is done
   */
  streamResponse(
    request: ProviderRequest, 
    onChunk: (chunk: ProviderChunk) => void,
    plugin: Plugin
  ): Promise<ProviderResponse>;
  
  /**
   * Create a streaming connection for raw SSE access
   * @param request Provider request object
   * @param plugin Plugin instance for lifecycle management
   * @returns EventSource instance for handling streaming
   */
  createStreamingConnection(
    request: ProviderRequest,
    plugin: Plugin
  ): EventSource;
  
  /**
   * Get a list of available models for this provider
   * @returns Array of model identifiers
   */
  getAvailableModels(): string[];
}
```

### 2. Implement the Base Adapter Class

Create `src/providers/BaseAdapter.ts`:

```typescript
/**
 * Base adapter implementation with common functionality.
 */

import { Plugin, requestUrl, RequestUrlParam, RequestUrlResponse, Notice } from 'obsidian';
import { ProviderAdapter } from './ProviderAdapter';
import { ProviderRequest, ProviderResponse, ProviderChunk } from '../models/Provider';

/**
 * Base adapter that implements common functionality
 * Provider-specific adapters should extend this class
 */
export abstract class BaseAdapter implements ProviderAdapter {
  /**
   * API key for the provider
   */
  protected apiKey: string;
  
  /**
   * Provider type identifier
   */
  protected readonly provider: string;
  
  /**
   * Create a new BaseAdapter instance
   * @param apiKey API key for the provider
   * @param provider Provider type identifier
   */
  constructor(apiKey: string, provider: string) {
    this.apiKey = apiKey;
    this.provider = provider;
  }
  
  /**
   * Get the provider type
   * @returns The provider type identifier
   */
  public getProviderType(): string {
    return this.provider;
  }
  
  /**
   * Get the base URL for the provider's API
   * @returns API base URL
   */
  protected abstract getApiBaseUrl(): string;
  
  /**
   * Get the chat completions endpoint for the provider
   * @returns Chat endpoint path
   */
  protected abstract getChatEndpoint(): string;
  
  /**
   * Get the headers required for API requests
   * @returns Headers object
   */
  protected abstract getHeaders(): Record<string, string>;
  
  /**
   * Get a minimal request body for API validation
   * @returns Minimal valid request body
   */
  protected abstract getMinimalRequestBody(): any;
  
  /**
   * Extract content from the provider's response
   * @param response Provider API response
   * @returns Extracted content
   */
  protected abstract extractContentFromResponse(response: any): string;
  
  /**
   * Make an API request with the given parameters
   * @param endpoint API endpoint path
   * @param body Request body
   * @returns Promise resolving to the response
   */
  protected async makeApiRequest(endpoint: string, body: any): Promise<RequestUrlResponse> {
    const url = `${this.getApiBaseUrl()}${endpoint}`;
    
    try {
      // Using Obsidian's RequestUrlParam interface for type safety
      const params: RequestUrlParam = {
        url,
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        throw: false // Handle errors gracefully instead of throwing
      };
      
      // Make request using Obsidian's requestUrl
      const response = await requestUrl(params);
      
      // Check for error status
      if (response.status >= 400) {
        console.error(`Error response from ${url}: ${response.status}`);
        if (response.json) {
          console.error('Error response body:', response.json);
        }
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      return response;
    } catch (error: any) {
      console.error(`Failed to make request to ${url}:`, error);
      throw error;
    }
  }
  
  /**
   * Validate the API key with a minimal request
   * @returns Promise resolving to whether the key is valid
   */
  public async validateApiKey(): Promise<boolean> {
    if (!this.apiKey) return false;

    try {
      const response = await this.makeApiRequest(
        this.getChatEndpoint(),
        this.getMinimalRequestBody()
      );
      return response.status === 200;
    } catch (error) {
      console.error(`Validation failed for ${this.provider}:`, error);
      return false;
    }
  }
  
  /**
   * Extract JSON content from a code block
   * @param text Text that may contain a JSON code block
   * @returns Parsed JSON content or original text if no code block found
   */
  protected extractJsonFromCodeBlock(text: string): string {
    const codeBlockMatch = text.match(/```json\n([\s\S]*?)```/);
    return codeBlockMatch ? codeBlockMatch[1].trim() : text;
  }
  
  /**
   * Generate a response
   * @param request Provider request object
   * @returns Promise resolving to the model's response
   */
  public abstract generateResponse(request: ProviderRequest): Promise<ProviderResponse>;
  
  /**
   * Stream a response
   * @param request Provider request object
   * @param onChunk Callback function for processing each chunk
   * @returns Promise resolving to the complete response when streaming is done
   */
  public abstract streamResponse(
    request: ProviderRequest,
    onChunk: (chunk: ProviderChunk) => void,
    plugin: Plugin
  ): Promise<ProviderResponse>;
  
  /**
   * Create a streaming connection
   * @param request Provider request object
   * @param plugin Plugin instance for lifecycle management
   * @returns EventSource instance for handling streaming
   */
  public abstract createStreamingConnection(
    request: ProviderRequest,
    plugin: Plugin
  ): EventSource;
  
  /**
   * Get a list of available models for this provider
   * @returns Array of model identifiers
   */
  public abstract getAvailableModels(): string[];
}
```

### 3. Implement the Anthropic Adapter

Create `src/providers/AnthropicAdapter.ts`:

```typescript
/**
 * Anthropic Claude API adapter implementation.
 */

import { BaseAdapter } from './BaseAdapter';
import { ProviderRequest, ProviderResponse, ProviderChunk } from '../models/Provider';

export class AnthropicAdapter extends BaseAdapter {
  /**
   * Anthropic API version
   */
  private anthropicVersion: string = '2023-06-01';
  
  /**
   * Create a new AnthropicAdapter instance
   * @param apiKey Anthropic API key
   */
  constructor(apiKey: string) {
    super(apiKey, 'anthropic');
  }
  
  /**
   * Get the base URL for the Anthropic API
   * @returns API base URL
   */
  protected getApiBaseUrl(): string {
    return 'https://api.anthropic.com/v1';
  }
  
  /**
   * Get the chat completions endpoint for Anthropic
   * @returns Chat endpoint path
   */
  protected getChatEndpoint(): string {
    return '/messages';
  }
  
  /**
   * Get the headers required for Anthropic API requests
   * @returns Headers object
   */
  protected getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': this.anthropicVersion
    };
  }
  
  /**
   * Get a minimal request body for API validation
   * @returns Minimal valid request body
   */
  protected getMinimalRequestBody(): any {
    return {
      model: 'claude-3-5-haiku-20241022',
      messages: [
        { role: 'user', content: 'test' }
      ],
      max_tokens: 1
    };
  }
  
  /**
   * Extract content from the Anthropic API response
   * @param response Anthropic API response
   * @returns Extracted content
   */
  protected extractContentFromResponse(response: any): string {
    if (!response?.content?.[0]?.text) {
      throw new Error('Invalid response format from Anthropic API');
    }
    return response.content[0].text;
  }
  
  /**
   * Format a request for the Anthropic API
   * @param request Provider request object
   * @returns Formatted request for Anthropic API
   */
  private formatRequest(request: ProviderRequest): any {
    // Start with the minimal request body
    const anthropicRequest: any = {
      model: request.model,
      messages: request.messages,
      max_tokens: request.maxTokens || 1024,
      temperature: request.temperature || 0.7,
      stream: request.stream || false
    };
    
    // Add system instruction if present
    if (request.systemInstruction) {
      anthropicRequest.system = request.systemInstruction;
    }
    
    // Add tools if present and supported
    if (request.tools && request.tools.length > 0) {
      anthropicRequest.tools = request.tools;
    }
    
    return anthropicRequest;
  }
  
  /**
   * Generate a response from Claude
   * @param request Provider request object
   * @returns Promise resolving to Claude's response
   */
  public async generateResponse(request: ProviderRequest): Promise<ProviderResponse> {
    try {
      if (!this.apiKey) {
        return {
          success: false,
          error: `${this.provider} adapter is missing an API key.`,
        };
      }

      // Format the request for Anthropic API
      const anthropicRequest = this.formatRequest(request);
      
      // Make the API request
      const response = await this.makeApiRequest(this.getChatEndpoint(), anthropicRequest);
      
      // Extract content
      const content = this.extractContentFromResponse(response.json);
      
      // Extract tool calls if present
      const toolCalls = this.extractToolCallsFromResponse(response.json);
      
      // Return formatted response
      return {
        success: true,
        data: {
          id: response.json.id,
          model: response.json.model,
          message: {
            role: 'assistant',
            content: content
          },
          toolCalls: toolCalls
        }
      };
    } catch (error: any) {
      console.error(`Error in ${this.provider} adapter:`, error);
      const message = error?.message || 'Unknown error occurred';
      if (error.json) {
        console.error('Error response body:', error.json);
      }
      return { success: false, error: message };
    }
  }
  
  /**
   * Extract tool calls from Anthropic API response
   * @param response Anthropic API response
   * @returns Extracted tool calls
   */
  protected extractToolCallsFromResponse(response: any): any[] {
    if (!response?.tool_calls || !Array.isArray(response.tool_calls)) {
      return [];
    }
    
    return response.tool_calls.map((toolCall: any) => ({
      id: toolCall.id,
      name: toolCall.name,
      arguments: JSON.parse(toolCall.input || '{}')
    }));
  }
  
  /**
   * Create an EventSource for streaming from Anthropic
   * @param request Provider request object
   * @param plugin Plugin instance for lifecycle management
   * @returns EventSource for streaming
   */
  public createStreamingConnection(
    request: ProviderRequest,
    plugin: Plugin
  ): EventSource {
    // Ensure the request has streaming enabled
    const streamingRequest = this.formatRequest({
      ...request,
      stream: true
    });
    
    // Create EventSource for SSE
    const source = new EventSource(
      `${this.getApiBaseUrl()}${this.getChatEndpoint()}`,
      {
        headers: this.getHeaders(),
        method: 'POST',
        body: JSON.stringify(streamingRequest)
      }
    );
    
    // Register with plugin for proper lifecycle management
    plugin.register(() => {
      // Ensure streaming connections are closed when plugin unloads
      source.close();
    });
    
    return source;
  }
  
  /**
   * Stream a response from Claude
   * @param request Provider request object
   * @param onChunk Callback function for processing each chunk
   * @param plugin Plugin instance for lifecycle management
   * @returns Promise resolving to the complete response when streaming is done
   */
  public streamResponse(
    request: ProviderRequest,
    onChunk: (chunk: ProviderChunk) => void,
    plugin: Plugin
  ): Promise<ProviderResponse> {
    return new Promise((resolve, reject) => {
      try {
        // Create streaming connection with plugin for lifecycle management
        const source = this.createStreamingConnection(request, plugin);
        
        // Initialize the full response object
        let fullResponse: ProviderResponse = {
          success: true,
          data: {
            id: '',
            model: request.model,
            message: {
              role: 'assistant',
              content: ''
            },
            toolCalls: []
          }
        };
        
        // Handle incoming messages
        source.addEventListener('message', (event) => {
          try {
            // Parse the event data
            const chunk = JSON.parse(event.data);
            
            // Handle different message types
            if (chunk.type === 'message_start') {
              // Message start includes metadata
              fullResponse.data.id = chunk.message.id;
              fullResponse.data.model = chunk.message.model;
            } 
            else if (chunk.type === 'content_block_start') {
              // Content block start
              // Nothing to do here for text blocks
            }
            else if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text') {
              // Content block delta with text
              fullResponse.data.message.content += chunk.delta.text;
              
              // Call onChunk with a formatted chunk
              onChunk({
                type: 'text',
                delta: {
                  content: chunk.delta.text
                }
              });
            } 
            else if (chunk.type === 'tool_use') {
              // Tool call
              const toolCall = {
                id: chunk.id,
                name: chunk.name,
                arguments: chunk.input || {}
              };
              
              // Add to full response
              fullResponse.data.toolCalls.push(toolCall);
              
              // Call onChunk with a formatted chunk
              onChunk({
                type: 'tool_call',
                delta: {
                  toolCall
                }
              });
            }
            else if (chunk.type === 'tool_use_delta') {
              // Tool call delta
              // Find the tool call to update
              const toolCall = fullResponse.data.toolCalls.find(tc => tc.id === chunk.id);
              
              if (toolCall && chunk.delta.input) {
                // Update the arguments
                toolCall.arguments = {
                  ...toolCall.arguments,
                  ...JSON.parse(chunk.delta.input)
                };
                
                // Call onChunk with a formatted chunk
                onChunk({
                  type: 'tool_call_delta',
                  delta: {
                    toolCallId: chunk.id,
                    arguments: chunk.delta.input
                  }
                });
              }
            }
            else if (chunk.type === 'message_delta') {
              // Message delta (stop reason, etc.)
              // Nothing to do here
            }
            else if (chunk.type === 'message_stop') {
              // End of message
              // Close the source and resolve
              source.close();
              resolve(fullResponse);
            }
          } catch (error) {
            console.error('Error processing stream chunk:', error);
          }
        });
        
        // Handle errors
        source.addEventListener('error', (error) => {
          console.error('Streaming error:', error);
          
          // Display notice to user
          new Notice('Connection error: The streaming connection was interrupted.');
          
          // Close the source
          source.close();
          
          // Reject promise
          reject(error);
        });
        
      } catch (error) {
        console.error('Error setting up streaming:', error);
        
        // Display notice to user
        new Notice(`Failed to set up streaming: ${error.message || 'Unknown error'}`);
        
        // Reject promise
        reject(error);
      }
    });
  }
  
  /**
   * Get a list of available models for Anthropic
   * @returns Array of model identifiers
   */
  public getAvailableModels(): string[] {
    return [
      'claude-3-5-haiku-20241022',
      'claude-3-5-sonnet-20241022',
      'claude-3-7-haiku-20250219',
      'claude-3-7-sonnet-20250219'
    ];
  }
}
```

### 4. Implement the OpenAI Adapter

Create `src/providers/OpenAIAdapter.ts`:

```typescript
/**
 * OpenAI API adapter implementation.
 */

import { BaseAdapter } from './BaseAdapter';
import { ProviderRequest, ProviderResponse, ProviderChunk } from '../models/Provider';

export class OpenAIAdapter extends BaseAdapter {
  /**
   * Create a new OpenAIAdapter instance
   * @param apiKey OpenAI API key
   */
  constructor(apiKey: string) {
    super(apiKey, 'openai');
  }
  
  /**
   * Get the base URL for the OpenAI API
   * @returns API base URL
   */
  protected getApiBaseUrl(): string {
    return 'https://api.openai.com/v1';
  }
  
  /**
   * Get the chat completions endpoint for OpenAI
   * @returns Chat endpoint path
   */
  protected getChatEndpoint(): string {
    return '/chat/completions';
  }
  
  /**
   * Get the headers required for OpenAI API requests
   * @returns Headers object
   */
  protected getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }
  
  /**
   * Get a minimal request body for API validation
   * @returns Minimal valid request body
   */
  protected getMinimalRequestBody(): any {
    return {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: 'test' }
      ],
      max_tokens: 1
    };
  }
  
  /**
   * Extract content from the OpenAI API response
   * @param response OpenAI API response
   * @returns Extracted content
   */
  protected extractContentFromResponse(response: any): string {
    if (!response?.choices?.[0]?.message?.content) {
      throw new Error('Invalid response format from OpenAI API');
    }
    return response.choices[0].message.content;
  }
  
  /**
   * Format a request for the OpenAI API
   * @param request Provider request object
   * @returns Formatted request for OpenAI API
   */
  private formatRequest(request: ProviderRequest): any {
    // Start with the minimal request body
    const openAIRequest: any = {
      model: request.model,
      messages: request.messages,
      max_tokens: request.maxTokens || 1024,
      temperature: request.temperature || 0.7,
      stream: request.stream || false
    };
    
    // Add system instruction if present
    if (request.systemInstruction) {
      openAIRequest.messages.unshift({
        role: 'system',
        content: request.systemInstruction
      });
    }
    
    // Add tools if present
    if (request.tools && request.tools.length > 0) {
      openAIRequest.tools = request.tools;
    }
    
    // Add tool choice if present
    if (request.toolChoice) {
      openAIRequest.tool_choice = request.toolChoice;
    }
    
    // Add response format if present
    if (request.responseFormat) {
      openAIRequest.response_format = request.responseFormat;
    }
    
    return openAIRequest;
  }
  
  /**
   * Generate a response from OpenAI
   * @param request Provider request object
   * @returns Promise resolving to OpenAI's response
   */
  public async generateResponse(request: ProviderRequest): Promise<ProviderResponse> {
    try {
      if (!this.apiKey) {
        return {
          success: false,
          error: `${this.provider} adapter is missing an API key.`,
        };
      }

      // Format the request for OpenAI API
      const openAIRequest = this.formatRequest(request);
      
      // Make the API request
      const response = await this.makeApiRequest(this.getChatEndpoint(), openAIRequest);
      
      // Extract content
      const content = this.extractContentFromResponse(response.json);
      
      // Extract tool calls if present
      const toolCalls = this.extractToolCallsFromResponse(response.json);
      
      // Return formatted response
      return {
        success: true,
        data: {
          id: response.json.id,
          model: response.json.model,
          message: {
            role: 'assistant',
            content: content
          },
          toolCalls: toolCalls,
          usage: response.json.usage
        }
      };
    } catch (error: any) {
      console.error(`Error in ${this.provider} adapter:`, error);
      const message = error?.message || 'Unknown error occurred';
      if (error.json) {
        console.error('Error response body:', error.json);
      }
      return { success: false, error: message };
    }
  }
  
  /**
   * Extract tool calls from OpenAI API response
   * @param response OpenAI API response
   * @returns Extracted tool calls
   */
  protected extractToolCallsFromResponse(response: any): any[] {
    if (!response?.choices?.[0]?.message?.tool_calls || 
        !Array.isArray(response.choices[0].message.tool_calls)) {
      return [];
    }
    
    return response.choices[0].message.tool_calls.map((toolCall: any) => ({
      id: toolCall.id,
      name: toolCall.function.name,
      arguments: JSON.parse(toolCall.function.arguments || '{}')
    }));
  }
  
  /**
   * Create an EventSource for streaming from OpenAI
   * @param request Provider request object
   * @returns EventSource for streaming
   */
  public createStreamingConnection(request: ProviderRequest): EventSource {
    // Ensure the request has streaming enabled
    const streamingRequest = this.formatRequest({
      ...request,
      stream: true
    });
    
    // Create EventSource for SSE
    const source = new EventSource(
      `${this.getApiBaseUrl()}${this.getChatEndpoint()}`,
      {
        headers: this.getHeaders(),
        method: 'POST',
        body: JSON.stringify(streamingRequest)
      }
    );
    
    return source;
  }
  
  /**
   * Stream a response from OpenAI
   * @param request Provider request object
   * @param onChunk Callback function for processing each chunk
   * @returns Promise resolving to the complete response when streaming is done
   */
  public streamResponse(
    request: ProviderRequest,
    onChunk: (chunk: ProviderChunk) => void
  ): Promise<ProviderResponse> {
    return new Promise((resolve, reject) => {
      try {
        // Create streaming connection
        const source = this.createStreamingConnection(request);
        
        // Initialize the full response object
        let fullResponse: ProviderResponse = {
          success: true,
          data: {
            id: '',
            model: request.model,
            message: {
              role: 'assistant',
              content: ''
            },
            toolCalls: []
          }
        };
        
        // Handle incoming messages
        source.addEventListener('message', (event) => {
          try {
            // Check for [DONE] message
            if (event.data === '[DONE]') {
              // Close the source and resolve
              source.close();
              resolve(fullResponse);
              return;
            }
            
            // Parse the event data
            const chunk = JSON.parse(event.data);
            
            // Set response ID if not set
            if (!fullResponse.data.id && chunk.id) {
              fullResponse.data.id = chunk.id;
            }
            
            // Set model if not set
            if (!fullResponse.data.model && chunk.model) {
              fullResponse.data.model = chunk.model;
            }
            
            // Handle content delta
            if (chunk.choices?.[0]?.delta?.content) {
              fullResponse.data.message.content += chunk.choices[0].delta.content;
              
              // Call onChunk with a formatted chunk
              onChunk({
                type: 'text',
                delta: {
                  content: chunk.choices[0].delta.content
                }
              });
            }
            
            // Handle tool call delta
            if (chunk.choices?.[0]?.delta?.tool_calls) {
              const deltaToolCalls = chunk.choices[0].delta.tool_calls;
              
              for (const deltaToolCall of deltaToolCalls) {
                // Check if this is a new tool call or an update to an existing one
                if (deltaToolCall.index === undefined) {
                  continue;
                }
                
                const toolCallIndex = deltaToolCall.index;
                const existingToolCall = fullResponse.data.toolCalls[toolCallIndex];
                
                if (!existingToolCall && deltaToolCall.id) {
                  // New tool call
                  const newToolCall = {
                    id: deltaToolCall.id,
                    name: deltaToolCall.function?.name || '',
                    arguments: deltaToolCall.function?.arguments ? 
                      JSON.parse(deltaToolCall.function.arguments) : {}
                  };
                  
                  // Add to full response
                  fullResponse.data.toolCalls[toolCallIndex] = newToolCall;
                  
                  // Call onChunk with a formatted chunk
                  onChunk({
                    type: 'tool_call',
                    delta: {
                      toolCall: newToolCall
                    }
                  });
                } 
                else if (existingToolCall) {
                  // Update to existing tool call
                  if (deltaToolCall.function?.name) {
                    existingToolCall.name = deltaToolCall.function.name;
                  }
                  
                  if (deltaToolCall.function?.arguments) {
                    // For simplicity, we're assuming arguments are always sent as JSON strings
                    // In practice, they might be sent in chunks, requiring more complex handling
                    try {
                      existingToolCall.arguments = {
                        ...existingToolCall.arguments,
                        ...JSON.parse(deltaToolCall.function.arguments)
                      };
                      
                      // Call onChunk with a formatted chunk
                      onChunk({
                        type: 'tool_call_delta',
                        delta: {
                          toolCallId: existingToolCall.id,
                          arguments: deltaToolCall.function.arguments
                        }
                      });
                    } catch (error) {
                      console.error('Error parsing tool call arguments:', error);
                    }
                  }
                }
              }
            }
            
          } catch (error) {
            console.error('Error processing stream chunk:', error);
          }
        });
        
        // Handle errors
        source.addEventListener('error', (error) => {
          console.error('Streaming error:', error);
          source.close();
          reject(error);
        });
        
      } catch (error) {
        console.error('Error setting up streaming:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Get a list of available models for OpenAI
   * @returns Array of model identifiers
   */
  public getAvailableModels(): string[] {
    return [
      'gpt-4o-mini',
      'gpt-4o',
      'gpt-4.1-mini-2025-04-14',
      'gpt-4.1-2025-04-14'
    ];
  }
}
```

### 5. Implement the Google Gemini Adapter

Create `src/providers/GeminiAdapter.ts`:

```typescript
/**
 * Google Gemini API adapter implementation.
 */

import { BaseAdapter } from './BaseAdapter';
import { ProviderRequest, ProviderResponse, ProviderChunk } from '../models/Provider';

export class GeminiAdapter extends BaseAdapter {
  /**
   * Create a new GeminiAdapter instance
   * @param apiKey Google AI Studio API key
   */
  constructor(apiKey: string) {
    super(apiKey, 'google');
  }
  
  /**
   * Get the base URL for the Gemini API
   * @returns API base URL
   */
  protected getApiBaseUrl(): string {
    return 'https://generativelanguage.googleapis.com/v1';
  }
  
  /**
   * Get the chat completions endpoint for Gemini
   * @returns Chat endpoint path with API key
   */
  protected getChatEndpoint(): string {
    return `/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`;
  }
  
  /**
   * Get the headers required for Gemini API requests
   * @returns Headers object
   */
  protected getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json'
    };
  }
  
  /**
   * Get a minimal request body for API validation
   * @returns Minimal valid request body
   */
  protected getMinimalRequestBody(): any {
    return {
      contents: [{
        parts: [{ text: 'test' }]
      }]
    };
  }
  
  /**
   * Extract content from the Gemini API response
   * @param response Gemini API response
   * @returns Extracted content
   */
  protected extractContentFromResponse(response: any): string {
    if (!response?.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid response format from Google Gemini API');
    }
    return response.candidates[0].content.parts[0].text;
  }
  
  /**
   * Format a request for the Gemini API
   * @param request Provider request object
   * @returns Formatted request for Gemini API
   */
  private formatRequest(request: ProviderRequest): any {
    // Convert messages to Gemini format
    const contents = [];
    
    // Handle system instruction
    if (request.systemInstruction) {
      contents.push({
        role: 'system',
        parts: [{ text: request.systemInstruction }]
      });
    }
    
    // Add conversation messages
    for (const message of request.messages) {
      // Convert role
      const role = message.role === 'assistant' ? 'model' : message.role;
      
      // Create content parts
      const parts = [];
      
      // Add text
      if (typeof message.content === 'string') {
        parts.push({ text: message.content });
      } else if (Array.isArray(message.content)) {
        // Handle multimodal content (not fully implemented here)
        for (const item of message.content) {
          if (item.type === 'text') {
            parts.push({ text: item.text });
          } else if (item.type === 'image_url') {
            // This would need additional implementation for image handling
            parts.push({ 
              inline_data: {
                mime_type: 'image/jpeg',
                data: item.image_url.url
              }
            });
          }
        }
      }
      
      // Add to contents
      contents.push({
        role,
        parts
      });
    }
    
    // Create the final request
    const geminiRequest: any = {
      contents,
      generationConfig: {
        temperature: request.temperature || 0.7,
        maxOutputTokens: request.maxTokens || 1024,
        topP: 0.8,
        topK: 40
      }
    };
    
    // Add streaming flag
    if (request.stream) {
      geminiRequest.stream = true;
    }
    
    return geminiRequest;
  }
  
  /**
   * Generate a response from Gemini
   * @param request Provider request object
   * @returns Promise resolving to Gemini's response
   */
  public async generateResponse(request: ProviderRequest): Promise<ProviderResponse> {
    try {
      if (!this.apiKey) {
        return {
          success: false,
          error: `${this.provider} adapter is missing an API key.`,
        };
      }

      // Format the request for Gemini API
      const geminiRequest = this.formatRequest(request);
      
      // Make the API request
      const response = await this.makeApiRequest(this.getChatEndpoint(), geminiRequest);
      
      // Extract content
      const content = this.extractContentFromResponse(response.json);
      
      // Return formatted response
      return {
        success: true,
        data: {
          id: response.json.candidates?.[0]?.citationMetadata?.citationId || '',
          model: request.model,
          message: {
            role: 'assistant',
            content: content
          },
          toolCalls: [] // Gemini may support function calling differently
        }
      };
    } catch (error: any) {
      console.error(`Error in ${this.provider} adapter:`, error);
      const message = error?.message || 'Unknown error occurred';
      if (error.json?.error?.message) {
        return { 
          success: false, 
          error: `Gemini API error: ${error.json.error.message}` 
        };
      }
      return { success: false, error: message };
    }
  }
  
  /**
   * Extract tool calls from Gemini API response
   * @param response Gemini API response
   * @returns Extracted tool calls (Gemini may handle tools differently)
   */
  protected extractToolCallsFromResponse(response: any): any[] {
    // Gemini's function calling is implemented differently
    // This would need to be expanded for actual tool support
    return [];
  }
  
  /**
   * Create an EventSource for streaming from Gemini
   * @param request Provider request object
   * @returns EventSource for streaming
   */
  public createStreamingConnection(request: ProviderRequest): EventSource {
    // Ensure the request has streaming enabled
    const streamingRequest = this.formatRequest({
      ...request,
      stream: true
    });
    
    // Create EventSource for SSE
    const source = new EventSource(
      `${this.getApiBaseUrl()}${this.getChatEndpoint()}`,
      {
        headers: this.getHeaders(),
        method: 'POST',
        body: JSON.stringify(streamingRequest)
      }
    );
    
    return source;
  }
  
  /**
   * Stream a response from Gemini
   * @param request Provider request object
   * @param onChunk Callback function for processing each chunk
   * @returns Promise resolving to the complete response when streaming is done
   */
  public streamResponse(
    request: ProviderRequest,
    onChunk: (chunk: ProviderChunk) => void
  ): Promise<ProviderResponse> {
    return new Promise((resolve, reject) => {
      try {
        // Create streaming connection
        const source = this.createStreamingConnection(request);
        
        // Initialize the full response object
        let fullResponse: ProviderResponse = {
          success: true,
          data: {
            id: '',
            model: request.model,
            message: {
              role: 'assistant',
              content: ''
            },
            toolCalls: []
          }
        };
        
        // Handle incoming messages
        source.addEventListener('message', (event) => {
          try {
            // Parse the event data
            const chunk = JSON.parse(event.data);
            
            // Handle different response types
            if (chunk.promptFeedback) {
              // This is metadata, not content
              return;
            }
            
            // Extract text content
            if (chunk.candidates?.[0]?.content?.parts?.[0]?.text) {
              const text = chunk.candidates[0].content.parts[0].text;
              fullResponse.data.message.content += text;
              
              // Call onChunk with a formatted chunk
              onChunk({
                type: 'text',
                delta: {
                  content: text
                }
              });
            }
            
            // Check for done status
            if (chunk.candidates?.[0]?.finishReason === 'STOP') {
              // Close the source and resolve
              source.close();
              resolve(fullResponse);
            }
            
          } catch (error) {
            console.error('Error processing stream chunk:', error);
          }
        });
        
        // Handle errors
        source.addEventListener('error', (error) => {
          console.error('Streaming error:', error);
          source.close();
          reject(error);
        });
        
      } catch (error) {
        console.error('Error setting up streaming:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Get a list of available models for Gemini
   * @returns Array of model identifiers
   */
  public getAvailableModels(): string[] {
    return [
      'gemini-2.0-flash-lite-preview-02-05',
      'gemini-2.0-flash-exp',
      'gemini-2.5-flash-preview-04-17',
      'gemini-2.5-pro-preview-04-17'
    ];
  }
}
```

### 6. Implement the OpenRouter Adapter

Create `src/providers/OpenRouterAdapter.ts`:

```typescript
/**
 * OpenRouter API adapter implementation.
 */

import { BaseAdapter } from './BaseAdapter';
import { ProviderRequest, ProviderResponse, ProviderChunk } from '../models/Provider';

export class OpenRouterAdapter extends BaseAdapter {
  /**
   * Create a new OpenRouterAdapter instance
   * @param apiKey OpenRouter API key
   */
  constructor(apiKey: string) {
    super(apiKey, 'openrouter');
  }
  
  /**
   * Get the base URL for the OpenRouter API
   * @returns API base URL
   */
  protected getApiBaseUrl(): string {
    return 'https://openrouter.ai/api/v1';
  }
  
  /**
   * Get the chat completions endpoint for OpenRouter
   * @returns Chat endpoint path
   */
  protected getChatEndpoint(): string {
    return '/chat/completions';
  }
  
  /**
   * Get the headers required for OpenRouter API requests
   * @returns Headers object
   */
  protected getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://www.synapticlabs.ai',
      'X-Title': 'Obsidian Chatsidian Plugin'
    };
  }
  
  /**
   * Get a minimal request body for API validation
   * @returns Minimal valid request body
   */
  protected getMinimalRequestBody(): any {
    return {
      model: 'anthropic/claude-3-5-haiku',
      messages: [
        { role: 'user', content: 'test' }
      ],
      max_tokens: 1,
      stream: false
    };
  }
  
  /**
   * Extract content from the OpenRouter API response
   * @param response OpenRouter API response
   * @returns Extracted content
   */
  protected extractContentFromResponse(response: any): string {
    if (!response?.choices?.[0]?.message?.content) {
      console.error('Unexpected OpenRouter response structure:', response);
      throw new Error('Invalid response format from OpenRouter API');
    }
    return response.choices[0].message.content;
  }
  
  /**
   * Format a request for the OpenRouter API
   * @param request Provider request object
   * @returns Formatted request for OpenRouter API
   */
  private formatRequest(request: ProviderRequest): any {
    // OpenRouter uses OpenAI-compatible format
    const openRouterRequest: any = {
      model: request.model, // Should include provider prefix (e.g., 'anthropic/claude-3-5-haiku')
      messages: request.messages,
      max_tokens: request.maxTokens || 1024,
      temperature: request.temperature || 0.7,
      stream: request.stream || false
    };
    
    // Add system instruction if it's not already included in messages
    if (request.systemInstruction && !request.messages.some(m => m.role === 'system')) {
      openRouterRequest.messages.unshift({
        role: 'system',
        content: request.systemInstruction
      });
    }
    
    // Add tools if present
    if (request.tools && request.tools.length > 0) {
      openRouterRequest.tools = request.tools;
    }
    
    // Add tool choice if present
    if (request.toolChoice) {
      openRouterRequest.tool_choice = request.toolChoice;
    }
    
    // Add response format if present
    if (request.responseFormat) {
      openRouterRequest.response_format = request.responseFormat;
    }
    
    return openRouterRequest;
  }
  
  /**
   * Generate a response from OpenRouter
   * @param request Provider request object
   * @returns Promise resolving to OpenRouter's response
   */
  public async generateResponse(request: ProviderRequest): Promise<ProviderResponse> {
    try {
      if (!this.apiKey) {
        return {
          success: false,
          error: `${this.provider} adapter is missing an API key.`,
        };
      }

      // Format the request for OpenRouter API
      const openRouterRequest = this.formatRequest(request);
      
      // Make the API request
      const response = await this.makeApiRequest(this.getChatEndpoint(), openRouterRequest);
      
      // Extract content
      const content = this.extractContentFromResponse(response.json);
      
      // Extract tool calls if present
      const toolCalls = this.extractToolCallsFromResponse(response.json);
      
      // Return formatted response
      return {
        success: true,
        data: {
          id: response.json.id,
          model: response.json.model,
          message: {
            role: 'assistant',
            content: content
          },
          toolCalls: toolCalls,
          usage: response.json.usage
        }
      };
    } catch (error: any) {
      console.error(`Error in ${this.provider} adapter:`, error);
      const message = error?.message || 'Unknown error occurred';
      if (error.json) {
        console.error('Error response body:', error.json);
      }
      return { success: false, error: message };
    }
  }
  
  /**
   * Extract tool calls from OpenRouter API response
   * @param response OpenRouter API response
   * @returns Extracted tool calls
   */
  protected extractToolCallsFromResponse(response: any): any[] {
    if (!response?.choices?.[0]?.message?.tool_calls || 
        !Array.isArray(response.choices[0].message.tool_calls)) {
      return [];
    }
    
    return response.choices[0].message.tool_calls.map((toolCall: any) => ({
      id: toolCall.id,
      name: toolCall.function.name,
      arguments: JSON.parse(toolCall.function.arguments || '{}')
    }));
  }
  
  /**
   * Create an EventSource for streaming from OpenRouter
   * @param request Provider request object
   * @returns EventSource for streaming
   */
  public createStreamingConnection(request: ProviderRequest): EventSource {
    // Ensure the request has streaming enabled
    const streamingRequest = this.formatRequest({
      ...request,
      stream: true
    });
    
    // Create EventSource for SSE
    const source = new EventSource(
      `${this.getApiBaseUrl()}${this.getChatEndpoint()}`,
      {
        headers: this.getHeaders(),
        method: 'POST',
        body: JSON.stringify(streamingRequest)
      }
    );
    
    return source;
  }
  
  /**
   * Stream a response from OpenRouter
   * @param request Provider request object
   * @param onChunk Callback function for processing each chunk
   * @returns Promise resolving to the complete response when streaming is done
   */
  public streamResponse(
    request: ProviderRequest,
    onChunk: (chunk: ProviderChunk) => void
  ): Promise<ProviderResponse> {
    return new Promise((resolve, reject) => {
      try {
        // Create streaming connection
        const source = this.createStreamingConnection(request);
        
        // Initialize the full response object
        let fullResponse: ProviderResponse = {
          success: true,
          data: {
            id: '',
            model: request.model,
            message: {
              role: 'assistant',
              content: ''
            },
            toolCalls: []
          }
        };
        
        // Handle incoming messages
        source.addEventListener('message', (event) => {
          try {
            // Skip comments (OpenRouter sends some as heartbeats)
            if (event.data.startsWith(':')) {
              return;
            }
            
            // Check for [DONE] message
            if (event.data === '[DONE]') {
              // Close the source and resolve
              source.close();
              resolve(fullResponse);
              return;
            }
            
            // Parse the event data
            const chunk = JSON.parse(event.data);
            
            // Set response ID if not set
            if (!fullResponse.data.id && chunk.id) {
              fullResponse.data.id = chunk.id;
            }
            
            // Set model if not set
            if (!fullResponse.data.model && chunk.model) {
              fullResponse.data.model = chunk.model;
            }
            
            // Handle content delta
            if (chunk.choices?.[0]?.delta?.content) {
              fullResponse.data.message.content += chunk.choices[0].delta.content;
              
              // Call onChunk with a formatted chunk
              onChunk({
                type: 'text',
                delta: {
                  content: chunk.choices[0].delta.content
                }
              });
            }
            
            // Handle tool call delta (using OpenAI format)
            if (chunk.choices?.[0]?.delta?.tool_calls) {
              const deltaToolCalls = chunk.choices[0].delta.tool_calls;
              
              for (const deltaToolCall of deltaToolCalls) {
                // Check if this is a new tool call or an update to an existing one
                if (deltaToolCall.index === undefined) {
                  continue;
                }
                
                const toolCallIndex = deltaToolCall.index;
                const existingToolCall = fullResponse.data.toolCalls[toolCallIndex];
                
                if (!existingToolCall && deltaToolCall.id) {
                  // New tool call
                  const newToolCall = {
                    id: deltaToolCall.id,
                    name: deltaToolCall.function?.name || '',
                    arguments: deltaToolCall.function?.arguments ? 
                      JSON.parse(deltaToolCall.function.arguments) : {}
                  };
                  
                  // Add to full response
                  fullResponse.data.toolCalls[toolCallIndex] = newToolCall;
                  
                  // Call onChunk with a formatted chunk
                  onChunk({
                    type: 'tool_call',
                    delta: {
                      toolCall: newToolCall
                    }
                  });
                } 
                else if (existingToolCall) {
                  // Update to existing tool call
                  if (deltaToolCall.function?.name) {
                    existingToolCall.name = deltaToolCall.function.name;
                  }
                  
                  if (deltaToolCall.function?.arguments) {
                    // For simplicity, we're assuming arguments are always sent as JSON strings
                    try {
                      existingToolCall.arguments = {
                        ...existingToolCall.arguments,
                        ...JSON.parse(deltaToolCall.function.arguments)
                      };
                      
                      // Call onChunk with a formatted chunk
                      onChunk({
                        type: 'tool_call_delta',
                        delta: {
                          toolCallId: existingToolCall.id,
                          arguments: deltaToolCall.function.arguments
                        }
                      });
                    } catch (error) {
                      console.error('Error parsing tool call arguments:', error);
                    }
                  }
                }
              }
            }
            
          } catch (error) {
            console.error('Error processing stream chunk:', error);
          }
        });
        
        // Handle errors
        source.addEventListener('error', (error) => {
          console.error('Streaming error:', error);
          source.close();
          reject(error);
        });
        
      } catch (error) {
        console.error('Error setting up streaming:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Get a list of available models for OpenRouter
   * @returns Array of model identifiers
   */
  public getAvailableModels(): string[] {
    return [
      'anthropic/claude-3-5-haiku',
      'anthropic/claude-3-7-sonnet',
      'google/gemini-2.0-flash-exp:free',
      'perplexity/sonar-reasoning',
      'perplexity/sonar',
      'openai/gpt-4o-2024-11-20',
      'openai/gpt-4o-mini',
      'openai/gpt-4.1-mini',
      'openai/gpt-4.1'
    ];
  }
}
```

### 7. Implement the Requesty Adapter

Create `src/providers/RequestyAdapter.ts`:

```typescript
/**
 * Requesty API adapter implementation.
 */

import { BaseAdapter } from './BaseAdapter';
import { ProviderRequest, ProviderResponse, ProviderChunk } from '../models/Provider';

export class RequestyAdapter extends BaseAdapter {
  /**
   * Create a new RequestyAdapter instance
   * @param apiKey Requesty API key
   */
  constructor(apiKey: string) {
    super(apiKey, 'requesty');
  }
  
  /**
   * Get the base URL for the Requesty API
   * @returns API base URL
   */
  protected getApiBaseUrl(): string {
    return 'https://router.requesty.ai';
  }
  
  /**
   * Get the chat completions endpoint for Requesty
   * @returns Chat endpoint path
   */
  protected getChatEndpoint(): string {
    return '/v1/chat/completions';
  }
  
  /**
   * Get the headers required for Requesty API requests
   * @returns Headers object
   */
  protected getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }
  
  /**
   * Get a minimal request body for API validation
   * @returns Minimal valid request body
   */
  protected getMinimalRequestBody(): any {
    return {
      model: 'openai/gpt-4o-mini',
      messages: [
        { role: 'user', content: 'test' }
      ],
      max_tokens: 1
    };
  }
  
  /**
   * Extract content from the Requesty API response
   * @param response Requesty API response
   * @returns Extracted content
   */
  protected extractContentFromResponse(response: any): string {
    if (!response?.choices?.[0]?.message?.content) {
      throw new Error('Invalid response format from Requesty API');
    }
    return response.choices[0].message.content;
  }
```

  /**
   * Format a request for the Requesty API
   * @param request Provider request object
   * @returns Formatted request for Requesty API
   */
  private formatRequest(request: ProviderRequest): any {
    // Requesty uses OpenAI-compatible format
    const requestyRequest: any = {
      model: request.model, // Should include provider prefix (e.g., 'openai/gpt-4o')
      messages: request.messages,
      max_tokens: request.maxTokens || 1024,
      temperature: request.temperature || 0.7,
      stream: request.stream || false
    };
    
    // Add system instruction if it's not already included in messages
    if (request.systemInstruction && !request.messages.some(m => m.role === 'system')) {
      requestyRequest.messages.unshift({
        role: 'system',
        content: request.systemInstruction
      });
    }
    
    // Add tools if present
    if (request.tools && request.tools.length > 0) {
      requestyRequest.tools = request.tools;
    }
    
    // Add tool choice if present
    if (request.toolChoice) {
      requestyRequest.tool_choice = request.toolChoice;
    }
    
    // Add response format if present
    if (request.responseFormat) {
      requestyRequest.response_format = request.responseFormat;
    }
    
    return requestyRequest;
  }
  
  /**
   * Generate a response from Requesty
   * @param request Provider request object
   * @returns Promise resolving to Requesty's response
   */
  public async generateResponse(request: ProviderRequest): Promise<ProviderResponse> {
    try {
      if (!this.apiKey) {
        return {
          success: false,
          error: `${this.provider} adapter is missing an API key.`,
        };
      }

      // Format the request for Requesty API
      const requestyRequest = this.formatRequest(request);
      
      // Make the API request
      const response = await this.makeApiRequest(this.getChatEndpoint(), requestyRequest);
      
      // Extract content
      const content = this.extractContentFromResponse(response.json);
      
      // Extract tool calls if present
      const toolCalls = this.extractToolCallsFromResponse(response.json);
      
      // Return formatted response
      return {
        success: true,
        data: {
          id: response.json.id,
          model: response.json.model,
          message: {
            role: 'assistant',
            content: content
          },
          toolCalls: toolCalls,
          usage: response.json.usage
        }
      };
    } catch (error: any) {
      console.error(`Error in ${this.provider} adapter:`, error);
      const message = error?.message || 'Unknown error occurred';
      if (error.json) {
        console.error('Error response body:', error.json);
      }
      return { success: false, error: message };
    }
  }
```

  /**
   * Extract tool calls from Requesty API response
   * @param response Requesty API response
   * @returns Extracted tool calls
   */
  protected extractToolCallsFromResponse(response: any): any[] {
    if (!response?.choices?.[0]?.message?.tool_calls || 
        !Array.isArray(response.choices[0].message.tool_calls)) {
      return [];
    }
    
    return response.choices[0].message.tool_calls.map((toolCall: any) => ({
      id: toolCall.id,
      name: toolCall.function.name,
      arguments: JSON.parse(toolCall.function.arguments || '{}')
    }));
  }
  
  /**
   * Create an EventSource for streaming from Requesty
   * @param request Provider request object
   * @returns EventSource for streaming
   */
  public createStreamingConnection(request: ProviderRequest): EventSource {
    // Ensure the request has streaming enabled
    const streamingRequest = this.formatRequest({
      ...request,
      stream: true
    });
    
    // Create EventSource for SSE
    const source = new EventSource(
      `${this.getApiBaseUrl()}${this.getChatEndpoint()}`,
      {
        headers: this.getHeaders(),
        method: 'POST',
        body: JSON.stringify(streamingRequest)
      }
    );
    
    return source;
  }
```

  /**
   * Stream a response from Requesty
   * @param request Provider request object
   * @param onChunk Callback function for processing each chunk
   * @returns Promise resolving to the complete response when streaming is done
   */
  public streamResponse(
    request: ProviderRequest,
    onChunk: (chunk: ProviderChunk) => void
  ): Promise<ProviderResponse> {
    return new Promise((resolve, reject) => {
      try {
        // Create streaming connection
        const source = this.createStreamingConnection(request);
        
        // Initialize the full response object
        let fullResponse: ProviderResponse = {
          success: true,
          data: {
            id: '',
            model: request.model,
            message: {
              role: 'assistant',
              content: ''
            },
            toolCalls: []
          }
        };
        
        // Handle incoming messages
        source.addEventListener('message', (event) => {
          try {
            // Check for [DONE] message
            if (event.data === '[DONE]') {
              // Close the source and resolve
              source.close();
              resolve(fullResponse);
              return;
            }
            
            // Parse the event data
            const chunk = JSON.parse(event.data);
            
            // Set response ID if not set
            if (!fullResponse.data.id && chunk.id) {
              fullResponse.data.id = chunk.id;
            }
            
            // Set model if not set
            if (!fullResponse.data.model && chunk.model) {
              fullResponse.data.model = chunk.model;
            }
            
            // Handle content delta
            if (chunk.choices?.[0]?.delta?.content) {
              fullResponse.data.message.content += chunk.choices[0].delta.content;
              
              // Call onChunk with a formatted chunk
              onChunk({
                type: 'text',
                delta: {
                  content: chunk.choices[0].delta.content
                }
              });
            }
            
            // Handle tool call delta (using OpenAI format)
            if (chunk.choices?.[0]?.delta?.tool_calls) {
              // Handle tool calls (similar to OpenAI)
              // Implementation omitted for brevity
            }
            
          } catch (error) {
            console.error('Error processing stream chunk:', error);
          }
        });
        
        // Handle errors
        source.addEventListener('error', (error) => {
          console.error('Streaming error:', error);
          source.close();
          reject(error);
        });
        
      } catch (error) {
        console.error('Error setting up streaming:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Get a list of available models for Requesty
   * @returns Array of model identifiers
   */
  public getAvailableModels(): string[] {
    return [
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'anthropic/claude-3-5-haiku',
      'anthropic/claude-3-7-sonnet'
    ];
  }
}
```

### 8. Implement the Provider Factory

Create `src/providers/ProviderFactory.ts`:

```typescript
/**
 * Factory for creating provider adapters.
 */

import { SettingsManager } from '../core/SettingsManager';
import { ProviderAdapter } from './ProviderAdapter';
import { AnthropicAdapter } from './AnthropicAdapter';
import { OpenAIAdapter } from './OpenAIAdapter';
import { GeminiAdapter } from './GeminiAdapter';
import { OpenRouterAdapter } from './OpenRouterAdapter';
import { RequestyAdapter } from './RequestyAdapter';

/**
 * Factory class for creating provider adapters
 */
export class ProviderFactory {
  /**
   * Create a provider adapter based on the provider type
   * @param provider Provider type (e.g., 'anthropic', 'openai')
   * @param apiKey API key for the provider
   * @returns Provider adapter instance
   */
  public static createAdapter(provider: string, apiKey: string): ProviderAdapter {
    switch (provider) {
      case 'anthropic':
        return new AnthropicAdapter(apiKey);
      case 'openai':
        return new OpenAIAdapter(apiKey);
      case 'google':
        return new GeminiAdapter(apiKey);
      case 'openrouter':
        return new OpenRouterAdapter(apiKey);
      case 'requesty':
        return new RequestyAdapter(apiKey);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }
  
  /**
   * Create a provider adapter from settings
   * @param settings Settings manager
   * @returns Provider adapter instance
   */
  public static createAdapterFromSettings(settings: SettingsManager): ProviderAdapter {
    const provider = settings.getProvider();
    const apiKey = settings.getApiKey();
    
    if (!apiKey) {
      throw new Error(`Missing API key for provider: ${provider}`);
    }
    
    return this.createAdapter(provider, apiKey);
  }
  
  /**
   * Get provider from model name
   * @param modelName Model name
   * @returns Provider type or undefined
   */
  public static getProviderFromModel(modelName: string): string | undefined {
    if (modelName.includes('claude')) {
      return 'anthropic';
    } else if (modelName.includes('gpt')) {
      return 'openai';
    } else if (modelName.includes('gemini')) {
      return 'google';
    }
    return undefined;
  }
}
```

### 9. Implement the Validation Service

Create `src/providers/ValidationService.ts`:

```typescript
/**
 * Service for validating provider API keys.
 */

import { debounce, Events, Plugin } from 'obsidian';
import { ProviderFactory } from './ProviderFactory';
import { SettingsManager } from '../core/SettingsManager';
import { EventBus } from '../core/EventBus';

/**
 * Service for validating provider API keys
 */
export class ValidationService {
  private settings: SettingsManager;
  private eventBus: EventBus;
  private saveSettings: () => Promise<void>;
  private plugin: Plugin;
  
  /**
   * Create a new ValidationService instance
   * @param settings Settings manager
   * @param eventBus Event bus
   * @param saveSettings Function to save settings
   * @param plugin Plugin instance for lifecycle management
   */
  constructor(
    settings: SettingsManager,
    eventBus: EventBus,
    saveSettings: () => Promise<void>,
    plugin: Plugin
  ) {
    this.settings = settings;
    this.eventBus = eventBus;
    this.saveSettings = saveSettings;
    this.plugin = plugin;
  }
  
  /**
   * Validate an API key for a provider
   * @param provider Provider type
   * @param apiKey API key to validate
   * @returns Promise resolving to whether the key is valid
   */
  public async validateApiKey(provider: string, apiKey: string): Promise<boolean> {
    try {
      const adapter = ProviderFactory.createAdapter(provider, apiKey);
      return await adapter.validateApiKey();
    } catch (error) {
      console.error(`Error validating ${provider} API key:`, error);
      return false;
    }
  }
  
  /**
   * Debounced validation to prevent excessive API calls using Obsidian's debounce utility
   */
  public validateApiKeyDebounced = debounce(
    async (provider: string, apiKey: string): Promise<boolean> => {
      try {
        // Emit validation start event
        this.eventBus.emit('provider:validating', { provider });
        
        // Validate the API key
        const isValid = await this.validateApiKey(provider, apiKey);
        
        // Update validation status in settings
        await this.updateValidationStatus(provider, isValid);
        
        // Emit validation complete event
        this.eventBus.emit('provider:validated', { 
          provider, 
          isValid 
        });
        
        return isValid;
      } catch (error) {
        console.error(`Error in debounced validation for ${provider}:`, error);
        
        // Emit validation error event
        this.eventBus.emit('provider:validationError', { 
          provider, 
          error 
        });
        
        return false;
      }
    },
    1000, // 1 second debounce
    true   // Leading edge execution (optional, depending on preference)
  );
  
  /**
   * Update validation status in settings
   * @param provider Provider type
   * @param isValid Whether the API key is valid
   */
  private async updateValidationStatus(provider: string, isValid: boolean): Promise<void> {
    // Update settings object directly
    this.settings.validatedProviders = this.settings.validatedProviders || {};
    this.settings.validatedProviders[provider] = isValid;
    
    // Use plugin's saveSettings method
    await this.saveSettings();
  }
}
```

### 10. Update Provider Types

Create `src/models/Provider.ts` with updated types:

```typescript
/**
 * Provider types and interfaces.
 */

/**
 * Provider request object
 */
export interface ProviderRequest {
  /**
   * The model to use
   */
  model: string;
  
  /**
   * The messages to send
   */
  messages: Array<{
    role: string;
    content: string | Array<{
      type: string;
      [key: string]: any;
    }>;
  }>;
  
  /**
   * The system instruction
   */
  systemInstruction?: string;
  
  /**
   * The maximum number of tokens to generate
   */
  maxTokens?: number;
  
  /**
   * The sampling temperature
   */
  temperature?: number;
  
  /**
   * Whether to stream the response
   */
  stream?: boolean;
  
  /**
   * Tool definitions to provide to the model
   */
  tools?: Array<{
    type: string;
    function: {
      name: string;
      description: string;
      parameters: any;
    };
  }>;
  
  /**
   * Tool choice configuration
   */
  toolChoice?: string | { type: string; function: { name: string } };
  
  /**
   * Response format configuration
   */
  responseFormat?: { type: string };
}

/**
 * Provider response object
 */
export interface ProviderResponse {
  /**
   * Whether the request was successful
   */
  success: boolean;
  
  /**
   * Error message if unsuccessful
   */
  error?: string;
  
  /**
   * Response data if successful
   */
  data?: {
    /**
     * Response ID
     */
    id: string;
    
    /**
     * Model used
     */
    model: string;
    
    /**
     * Assistant message
     */
    message: {
      role: string;
      content: string;
    };
    
    /**
     * Tool calls made by the assistant
     */
    toolCalls?: Array<{
      id: string;
      name: string;
      arguments: any;
    }>;
    
    /**
     * Token usage information
     */
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  };
}

/**
 * Chunk from a streaming response
 */
export interface ProviderChunk {
  /**
   * Chunk type
   */
  type: 'text' | 'tool_call' | 'tool_call_delta';
  
  /**
   * Chunk delta information
   */
  delta: {
    /**
     * Text content delta
     */
    content?: string;
    
    /**
     * Tool call delta
     */
    toolCall?: {
      id: string;
      name: string;
      arguments: any;
    };
    
    /**
     * Tool call ID for delta updates
     */
    toolCallId?: string;
    
    /**
     * Tool call arguments delta
     */
    arguments?: string;
  };
}
```

### 11. Write Provider Adapter Tests

Create `tests/providers/ProviderAdapter.test.ts`:

```typescript
/**
 * Tests for provider adapters.
 */

import { AnthropicAdapter } from '../../src/providers/AnthropicAdapter';
import { OpenAIAdapter } from '../../src/providers/OpenAIAdapter';
import { GeminiAdapter } from '../../src/providers/GeminiAdapter';
import { ProviderFactory } from '../../src/providers/ProviderFactory';

// Mock requestUrl
jest.mock('obsidian', () => ({
  requestUrl: jest.fn(),
  debounce: (fn: Function) => fn
}));

describe('Provider Adapters', () => {
  // Reset mocks between tests
  beforeEach(() => {
    jest.resetAllMocks();
  });
  
  describe('AnthropicAdapter', () => {
    const adapter = new AnthropicAdapter('test-api-key');
    
    test('should return the correct provider type', () => {
      expect(adapter.getProviderType()).toBe('anthropic');
    });
    
    test('should validate API key', async () => {
      // Mock requestUrl
      const mockRequestUrl = require('obsidian').requestUrl;
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: {
          id: 'test-id',
          content: [{ text: 'Test response' }]
        }
      });
      
      const result = await adapter.validateApiKey();
      expect(result).toBe(true);
      expect(mockRequestUrl).toHaveBeenCalledTimes(1);
    });
    
    test('should handle API key validation failure', async () => {
      // Mock requestUrl
      const mockRequestUrl = require('obsidian').requestUrl;
      mockRequestUrl.mockRejectedValueOnce(new Error('Invalid API key'));
      
      const result = await adapter.validateApiKey();
      expect(result).toBe(false);
      expect(mockRequestUrl).toHaveBeenCalledTimes(1);
    });
    
    test('should generate a response', async () => {
      // Mock requestUrl
      const mockRequestUrl = require('obsidian').requestUrl;
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: {
          id: 'test-id',
          model: 'claude-3-5-haiku',
          content: [{ type: 'text', text: 'Test response' }]
        }
      });
      
      const result = await adapter.generateResponse({
        model: 'claude-3-5-haiku',
        messages: [{ role: 'user', content: 'Test prompt' }]
      });
      
      expect(result.success).toBe(true);
      expect(result.data?.message.content).toBe('Test response');
      expect(mockRequestUrl).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('OpenAIAdapter', () => {
    const adapter = new OpenAIAdapter('test-api-key');
    
    test('should return the correct provider type', () => {
      expect(adapter.getProviderType()).toBe('openai');
    });
    
    test('should validate API key', async () => {
      // Mock requestUrl
      const mockRequestUrl = require('obsidian').requestUrl;
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: {
          id: 'test-id',
          choices: [{ message: { content: 'Test response' } }]
        }
      });
      
      const result = await adapter.validateApiKey();
      expect(result).toBe(true);
      expect(mockRequestUrl).toHaveBeenCalledTimes(1);
    });
    
    test('should handle API key validation failure', async () => {
      // Mock requestUrl
      const mockRequestUrl = require('obsidian').requestUrl;
      mockRequestUrl.mockRejectedValueOnce(new Error('Invalid API key'));
      
      const result = await adapter.validateApiKey();
      expect(result).toBe(false);
      expect(mockRequestUrl).toHaveBeenCalledTimes(1);
    });
    
    test('should generate a response', async () => {
      // Mock requestUrl
      const mockRequestUrl = require('obsidian').requestUrl;
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: {
          id: 'test-id',
          model: 'gpt-4o',
          choices: [{ message: { content: 'Test response' } }]
        }
      });
      
      const result = await adapter.generateResponse({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Test prompt' }]
      });
      
      expect(result.success).toBe(true);
      expect(result.data?.message.content).toBe('Test response');
      expect(mockRequestUrl).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('ProviderFactory', () => {
    test('should create the correct adapter for a provider', () => {
      const anthropicAdapter = ProviderFactory.createAdapter('anthropic', 'test-key');
      expect(anthropicAdapter).toBeInstanceOf(AnthropicAdapter);
      expect(anthropicAdapter.getProviderType()).toBe('anthropic');
      
      const openaiAdapter = ProviderFactory.createAdapter('openai', 'test-key');
      expect(openaiAdapter).toBeInstanceOf(OpenAIAdapter);
      expect(openaiAdapter.getProviderType()).toBe('openai');
      
      const geminiAdapter = ProviderFactory.createAdapter('google', 'test-key');
      expect(geminiAdapter).toBeInstanceOf(GeminiAdapter);
      expect(geminiAdapter.getProviderType()).toBe('google');
    });
    
    test('should throw an error for an unsupported provider', () => {
      expect(() => {
        ProviderFactory.createAdapter('unsupported', 'test-key');
      }).toThrow('Unsupported provider: unsupported');
    });
    
    test('should get provider from model name', () => {
      expect(ProviderFactory.getProviderFromModel('claude-3-5-haiku')).toBe('anthropic');
      expect(ProviderFactory.getProviderFromModel('gpt-4o')).toBe('openai');
      expect(ProviderFactory.getProviderFromModel('gemini-2-0-flash')).toBe('google');
      expect(ProviderFactory.getProviderFromModel('unknown-model')).toBeUndefined();
    });
  });
});
```

### 12. Integration with Main Plugin

Update `src/main.ts` to add provider adapters:

```typescript
// In plugin's main class

/**
 * Initialize provider adapters with Obsidian's lifecycle management
 */
private async initializeProviders(): Promise<void> {
  // Create validation service with plugin instance for lifecycle management
  this.validationService = new ValidationService(
    this.settings, 
    this.eventBus,
    this.saveSettings.bind(this),
    this
  );
  
  // Get provider from settings
  const provider = this.settings.getProvider();
  const apiKey = this.settings.getApiKey();
  
  // Validate API key
  if (apiKey) {
    const isValid = await this.validationService.validateApiKey(provider, apiKey);
    console.log(`Provider ${provider} API key validation: ${isValid ? 'valid' : 'invalid'}`);
  } else {
    console.warn(`No API key set for provider ${provider}`);
    new Notice(`No API key set for provider ${provider}. Please configure in settings.`);
  }
  
  // Create adapter
  try {
    this.currentProvider = ProviderFactory.createAdapterFromSettings(this.settings);
    console.log(`Created provider adapter for ${provider}`);
  } catch (error) {
    console.error(`Failed to create provider adapter for ${provider}:`, error);
    new Notice(`Failed to initialize provider: ${error.message}`);
  }
  
  // Listen for settings changes using Obsidian's registerEvent for proper lifecycle management
  this.registerEvent(
    this.app.workspace.on('layout-ready', () => {
      // Perform actions when layout is ready - this ensures vault is accessible
      console.log('Obsidian layout ready, provider adapters initialized');
    })
  );
  
  // Register for settings changes using Obsidian's registerEvent
  this.registerEvent(
    this.eventBus.on('settings:changed', async ({ changedKeys }) => {
      if (changedKeys.includes('provider') || changedKeys.includes('apiKey')) {
        await this.initializeProviders();
      }
    })
  );
}
```

## Model Provider Documentation

### Anthropic

- API Base URL: `https://api.anthropic.com/v1`
- Chat Endpoint: `/messages`
- Required Headers:
  - `Content-Type: application/json`
  - `x-api-key: {API_KEY}`
  - `anthropic-version: 2023-06-01`
- Streaming Support: Yes (Server-Sent Events)
- Tool Call Support: Yes

### OpenAI

- API Base URL: `https://api.openai.com/v1`
- Chat Endpoint: `/chat/completions`
- Required Headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer {API_KEY}`
- Streaming Support: Yes (Server-Sent Events)
- Tool Call Support: Yes

### Google Gemini

- API Base URL: `https://generativelanguage.googleapis.com/v1`
- Chat Endpoint: `/models/{MODEL_ID}:generateContent?key={API_KEY}`
- Required Headers:
  - `Content-Type: application/json`
- Streaming Support: Yes (Server-Sent Events)
- Tool Call Support: Limited

### OpenRouter

- API Base URL: `https://openrouter.ai/api/v1`
- Chat Endpoint: `/chat/completions`
- Required Headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer {API_KEY}`
  - `HTTP-Referer`: Your application URL
  - `X-Title`: Your application name
- Streaming Support: Yes (Server-Sent

## Obsidian API Alignment Recommendations

This implementation of Provider Adapters has been improved to better align with Obsidian's native APIs and patterns. Key improvements include:

1. **Network Requests**
   - Using Obsidian's `RequestUrlParam` interface for type safety
   - Setting `throw: false` to handle errors gracefully
   - Better error handling with proper error messages

2. **Lifecycle Management**
   - Adding `Plugin` parameter to streaming methods for proper cleanup
   - Using `plugin.register(() => { source.close(); })` to ensure connections are closed on unload
   - Registering for Obsidian's native events with `registerEvent`

3. **User Feedback**
   - Using Obsidian's `Notice` API for user notifications on error
   - Providing clear error messages in the UI

4. **Event Handling**
   - Leveraging Obsidian's `Events` class for event management
   - Cleaner integration with Obsidian's event system

5. **Settings Management**
   - Using Obsidian's settings management patterns
   - Better integration with plugin's `saveSettings` method

6. **Debouncing**
   - Properly using Obsidian's `debounce` utility with correct parameters
   - Adding support for leading edge execution

These improvements make the Provider Adapters more robust and better integrated with Obsidian's ecosystem, ensuring proper resource management and consistent user experience.

## Next Steps

After completing this microphase, proceed to Microphase 1.7 (Plugin Lifecycle Management) to integrate these provider adapters into the complete plugin lifecycle.
