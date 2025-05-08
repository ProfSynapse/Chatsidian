/**
 * Google Gemini Provider Adapter
 * 
 * This file implements the ProviderAdapter interface for the Google Gemini API.
 * It uses the official Google Gemini SDK to communicate with the Google AI API.
 */

// Import the Google Gemini SDK
import { GoogleGenAI } from '@google/genai';
import { 
  ModelInfo, 
  ProviderChunk, 
  ProviderMessage, 
  ProviderRequest, 
  ProviderResponse
} from '../models/Provider';
import { ModelsLoader } from './ModelsLoader';
import { BaseAdapter } from './BaseAdapter';

/**
 * Adapter for the Google Gemini API.
 */
export class GeminiAdapter extends BaseAdapter {
  /**
   * The name of the provider
   */
  readonly provider = 'google';

  /**
   * The Google Generative AI client instance
   */
  private client: any;

  /**
   * Create a new GeminiAdapter.
   * 
   * @param apiKey The Google AI API key
   * @param apiEndpoint Optional custom API endpoint URL
   */
  constructor(apiKey: string, apiEndpoint?: string) {
    super(apiKey, apiEndpoint);
    
    // Create the Google Generative AI client
    const options: any = {
      apiKey: this.apiKey
    };

    // Use custom API endpoint if provided
    if (this.apiEndpoint) {
      options.apiEndpoint = this.apiEndpoint;
    }

    // Use type assertion to avoid TypeScript errors
    this.client = new GoogleGenAI(options);
  }

  /**
   * Test the connection to the Google Gemini API.
   * Makes a lightweight API call to verify credentials.
   * 
   * @returns A promise that resolves to true if the connection is successful, false otherwise
   */
  async testConnection(): Promise<boolean> {
    try {
      this.validateApiKey();
      
      // Make a minimal request to test the connection
      const model = (this.client as any).getGenerativeModel({ model: 'gemini-1.5-flash' });
      await model.generateContent('Hello');
      
      return true;
    } catch (error) {
      this.logError('testConnection', error);
      return false;
    }
  }

  /**
   * Get a list of available models from Google Gemini.
   * 
   * @returns A promise that resolves to an array of ModelInfo objects
   */
  async getAvailableModels(): Promise<ModelInfo[]> {
    try {
      this.validateApiKey();
      
      // Google doesn't have a models endpoint, so we use the centralized models.yaml
      const modelsLoader = ModelsLoader.getInstance();
      return modelsLoader.getModelsForProvider(this.provider);
    } catch (error) {
      this.logError('getAvailableModels', error);
      // Still use the centralized models.yaml even in error case
      const modelsLoader = ModelsLoader.getInstance();
      return modelsLoader.getModelsForProvider(this.provider);
    }
  }

  /**
   * Send a request to the Google Gemini API and get a complete response.
   * 
   * @param request The request parameters
   * @returns A promise that resolves to a ProviderResponse
   */
  async sendRequest(request: ProviderRequest): Promise<ProviderResponse> {
    try {
      this.validateApiKey();
      
      // Create the Gemini request
      const geminiRequest = this.createGeminiRequest(request);
      
      // Get the model
      const model = (this.client as any).getGenerativeModel({ 
        model: request.model,
        safetySettings: this.getSafetySettings()
      });
      
      // Send the request
      const response = await model.generateContent({
        contents: geminiRequest.contents,
        generationConfig: geminiRequest.generationConfig,
        tools: geminiRequest.tools
      });
      
      // Convert the response to our format
      const providerResponse: ProviderResponse = {
        id: 'gemini-response',
        message: {
          role: 'assistant',
          content: ''
        }
      };
      
      // Extract text content
      if (response) {
        providerResponse.message.content = response.text || '';
      }
      
      // Add tool calls if present
      if (response.functionCalls && response.functionCalls.length > 0) {
        const toolCalls = response.functionCalls.map((call: any, index: number) => ({
          id: `call-${index}`,
          type: 'function',
          function: {
            name: call.name,
            arguments: call.args ? JSON.stringify(call.args) : '{}'
          }
        }));
        
        if (toolCalls.length > 0) {
          providerResponse.toolCalls = toolCalls;
        }
      }
      
      return providerResponse;
    } catch (error) {
      this.logError('sendRequest', error);
      throw new Error(`Google Gemini request failed: ${error.message}`);
    }
  }

  /**
   * Send a streaming request to the Google Gemini API.
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
      
      // Create the Gemini request
      const geminiRequest = this.createGeminiRequest(request);
      
      // Create an AbortController for this request
      const abortController = this.createAbortController();
      
      // Get the model
      const model = (this.client as any).getGenerativeModel({ 
        model: request.model,
        safetySettings: this.getSafetySettings()
      });
      
      // Send the streaming request
      const streamResponse = await model.generateContentStream({
        contents: geminiRequest.contents,
        generationConfig: geminiRequest.generationConfig,
        tools: geminiRequest.tools
      });
      
      try {
        // Process the stream
        let responseId = 'gemini-stream';
        let functionCallInProgress = false;
        let currentFunctionCall: any = null;
        
        for await (const chunk of streamResponse) {
          // Process text chunks
          if (chunk.text) {
            const providerChunk: ProviderChunk = {
              id: responseId,
              delta: {
                content: chunk.text
              }
            };
            
            onChunk(providerChunk);
          }
          
          // Process function call chunks
          if (chunk.functionCalls && chunk.functionCalls.length > 0) {
            const functionCall = chunk.functionCalls[0];
            
            // Start of a function call
            if (!functionCallInProgress) {
              functionCallInProgress = true;
              currentFunctionCall = {
                id: `call-${Date.now()}`,
                name: functionCall.name,
                args: {}
              };
              
              // Send the function name
              const providerChunk: ProviderChunk = {
                id: responseId,
                delta: {
                  toolCalls: [{
                    id: currentFunctionCall.id,
                    type: 'function',
                    function: {
                      name: functionCall.name,
                      arguments: '{}'
                    }
                  }]
                }
              };
              
              onChunk(providerChunk);
            }
            
            // Process function arguments
            if (functionCall.args) {
              // Merge new args with existing args
              Object.assign(currentFunctionCall.args, functionCall.args);
              
              // Send the updated arguments
              const providerChunk: ProviderChunk = {
                id: responseId,
                delta: {
                  toolCalls: [{
                    id: currentFunctionCall.id,
                    type: 'function',
                    function: {
                      arguments: JSON.stringify(currentFunctionCall.args)
                    }
                  }]
                }
              };
              
              onChunk(providerChunk);
            }
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
      throw new Error(`Google Gemini streaming request failed: ${error.message}`);
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Create a Google Gemini request from our common request format.
   * 
   * @param request Our common request format
   * @returns Google Gemini request format
   */
  private createGeminiRequest(request: ProviderRequest): any {
    // Map our messages to Gemini format
    const contents = this.convertMessagesToGeminiFormat(request.messages);
    
    // Create the Gemini request
    const geminiRequest: any = {
      contents,
      generationConfig: {
        temperature: request.temperature !== undefined ? request.temperature : 0.7,
        maxOutputTokens: request.maxTokens || 4096,
      }
    };
    
    // Add tools if present
    if (request.tools && request.tools.length > 0) {
      geminiRequest.tools = request.tools.map(tool => {
        if (tool.type === 'function') {
          return {
            functionDeclarations: [{
              name: tool.function.name,
              description: tool.function.description,
              parameters: tool.function.parameters
            }]
          };
        }
        return tool;
      });
    }
    
    return geminiRequest;
  }

  /**
   * Convert our messages format to Google Gemini format.
   * 
   * @param messages Our messages
   * @returns Google Gemini format messages
   */
  private convertMessagesToGeminiFormat(messages: ProviderMessage[]): any[] {
    const geminiMessages: any[] = [];
    let systemPrompt = '';
    
    // Extract system message if present
    const systemMessage = messages.find(msg => msg.role === 'system');
    if (systemMessage) {
      systemPrompt = systemMessage.content;
    }
    
    // Process non-system messages
    const nonSystemMessages = messages.filter(msg => msg.role !== 'system');
    
    // Convert to Gemini format
    for (const message of nonSystemMessages) {
      geminiMessages.push({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }]
      });
    }
    
    // If there's a system prompt, add it to the first user message
    if (systemPrompt && geminiMessages.length > 0 && geminiMessages[0].role === 'user') {
      const firstMessage = geminiMessages[0];
      firstMessage.parts[0].text = `${systemPrompt}\n\n${firstMessage.parts[0].text}`;
    } else if (systemPrompt) {
      // If there's no user message, create one with the system prompt
      geminiMessages.unshift({
        role: 'user',
        parts: [{ text: systemPrompt }]
      });
    }
    
    return geminiMessages;
  }

  /**
   * Get safety settings for the Google Gemini API.
   * 
   * @returns Safety settings
   */
  private getSafetySettings(): any[] {
    // Use default safety settings
    return [
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      }
    ];
  }
}
