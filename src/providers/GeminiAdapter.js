/**
 * Google Gemini Provider Adapter
 *
 * This file implements the ProviderAdapter interface for the Google Gemini API.
 * It uses the official Google Gemini SDK to communicate with the Google AI API.
 */
// Import the Google Gemini SDK
import { GoogleGenAI } from '@google/genai';
import { COMMON_MODELS } from '../models/Provider';
import { BaseAdapter } from './BaseAdapter';
/**
 * Adapter for the Google Gemini API.
 */
export class GeminiAdapter extends BaseAdapter {
    /**
     * Create a new GeminiAdapter.
     *
     * @param apiKey The Google AI API key
     * @param apiEndpoint Optional custom API endpoint URL
     */
    constructor(apiKey, apiEndpoint) {
        super(apiKey, apiEndpoint);
        /**
         * The name of the provider
         */
        this.provider = 'google';
        // Create the Google Generative AI client
        const options = {
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
    async testConnection() {
        try {
            this.validateApiKey();
            // Make a minimal request to test the connection
            const model = this.client.getGenerativeModel({ model: 'gemini-1.5-flash' });
            await model.generateContent('Hello');
            return true;
        }
        catch (error) {
            this.logError('testConnection', error);
            return false;
        }
    }
    /**
     * Get a list of available models from Google Gemini.
     *
     * @returns A promise that resolves to an array of ModelInfo objects
     */
    async getAvailableModels() {
        try {
            this.validateApiKey();
            // Google doesn't have a models endpoint, so we return the known models
            return [
                {
                    id: 'gemini-1.5-flash',
                    name: 'Gemini 1.5 Flash',
                    provider: this.provider,
                    contextSize: 1000000,
                    supportsTools: true,
                    supportsJson: true,
                    maxOutputTokens: 8192
                },
                {
                    id: 'gemini-1.5-pro',
                    name: 'Gemini 1.5 Pro',
                    provider: this.provider,
                    contextSize: 1000000,
                    supportsTools: true,
                    supportsJson: true,
                    maxOutputTokens: 8192
                },
                {
                    id: 'gemini-1.0-pro',
                    name: 'Gemini 1.0 Pro',
                    provider: this.provider,
                    contextSize: 32768,
                    supportsTools: true,
                    supportsJson: true,
                    maxOutputTokens: 8192
                }
            ];
        }
        catch (error) {
            this.logError('getAvailableModels', error);
            return COMMON_MODELS.filter(model => model.provider === this.provider);
        }
    }
    /**
     * Send a request to the Google Gemini API and get a complete response.
     *
     * @param request The request parameters
     * @returns A promise that resolves to a ProviderResponse
     */
    async sendRequest(request) {
        try {
            this.validateApiKey();
            // Create the Gemini request
            const geminiRequest = this.createGeminiRequest(request);
            // Get the model
            const model = this.client.getGenerativeModel({
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
            const providerResponse = {
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
                const toolCalls = response.functionCalls.map((call, index) => ({
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
        }
        catch (error) {
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
    async sendStreamingRequest(request, onChunk) {
        try {
            this.validateApiKey();
            // Ensure stream is true
            request.stream = true;
            // Create the Gemini request
            const geminiRequest = this.createGeminiRequest(request);
            // Create an AbortController for this request
            const abortController = this.createAbortController();
            // Get the model
            const model = this.client.getGenerativeModel({
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
                let currentFunctionCall = null;
                for await (const chunk of streamResponse) {
                    // Process text chunks
                    if (chunk.text) {
                        const providerChunk = {
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
                            const providerChunk = {
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
                            const providerChunk = {
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
            }
            catch (streamError) {
                if (streamError.name === 'AbortError') {
                    return;
                }
                throw streamError;
            }
        }
        catch (error) {
            // Ignore abort errors
            if (error.name === 'AbortError') {
                return;
            }
            this.logError('sendStreamingRequest', error);
            throw new Error(`Google Gemini streaming request failed: ${error.message}`);
        }
        finally {
            this.abortController = null;
        }
    }
    /**
     * Create a Google Gemini request from our common request format.
     *
     * @param request Our common request format
     * @returns Google Gemini request format
     */
    createGeminiRequest(request) {
        // Map our messages to Gemini format
        const contents = this.convertMessagesToGeminiFormat(request.messages);
        // Create the Gemini request
        const geminiRequest = {
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
    convertMessagesToGeminiFormat(messages) {
        const geminiMessages = [];
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
        }
        else if (systemPrompt) {
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
    getSafetySettings() {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiR2VtaW5pQWRhcHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIkdlbWluaUFkYXB0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7O0dBS0c7QUFFSCwrQkFBK0I7QUFDL0IsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUM1QyxPQUFPLEVBTUwsYUFBYSxFQUNkLE1BQU0sb0JBQW9CLENBQUM7QUFDNUIsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUU1Qzs7R0FFRztBQUNILE1BQU0sT0FBTyxhQUFjLFNBQVEsV0FBVztJQVc1Qzs7Ozs7T0FLRztJQUNILFlBQVksTUFBYyxFQUFFLFdBQW9CO1FBQzlDLEtBQUssQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFqQjdCOztXQUVHO1FBQ00sYUFBUSxHQUFHLFFBQVEsQ0FBQztRQWdCM0IseUNBQXlDO1FBQ3pDLE1BQU0sT0FBTyxHQUFRO1lBQ25CLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTtTQUNwQixDQUFDO1FBRUYsc0NBQXNDO1FBQ3RDLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ3JCLE9BQU8sQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQztRQUN6QyxDQUFDO1FBRUQsZ0RBQWdEO1FBQ2hELElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDekMsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0gsS0FBSyxDQUFDLGNBQWM7UUFDbEIsSUFBSSxDQUFDO1lBQ0gsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBRXRCLGdEQUFnRDtZQUNoRCxNQUFNLEtBQUssR0FBSSxJQUFJLENBQUMsTUFBYyxDQUFDLGtCQUFrQixDQUFDLEVBQUUsS0FBSyxFQUFFLGtCQUFrQixFQUFFLENBQUMsQ0FBQztZQUNyRixNQUFNLEtBQUssQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUM7WUFFckMsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNmLElBQUksQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDdkMsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDO0lBQ0gsQ0FBQztJQUVEOzs7O09BSUc7SUFDSCxLQUFLLENBQUMsa0JBQWtCO1FBQ3RCLElBQUksQ0FBQztZQUNILElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUV0Qix1RUFBdUU7WUFDdkUsT0FBTztnQkFDTDtvQkFDRSxFQUFFLEVBQUUsa0JBQWtCO29CQUN0QixJQUFJLEVBQUUsa0JBQWtCO29CQUN4QixRQUFRLEVBQUUsSUFBSSxDQUFDLFFBQVE7b0JBQ3ZCLFdBQVcsRUFBRSxPQUFPO29CQUNwQixhQUFhLEVBQUUsSUFBSTtvQkFDbkIsWUFBWSxFQUFFLElBQUk7b0JBQ2xCLGVBQWUsRUFBRSxJQUFJO2lCQUN0QjtnQkFDRDtvQkFDRSxFQUFFLEVBQUUsZ0JBQWdCO29CQUNwQixJQUFJLEVBQUUsZ0JBQWdCO29CQUN0QixRQUFRLEVBQUUsSUFBSSxDQUFDLFFBQVE7b0JBQ3ZCLFdBQVcsRUFBRSxPQUFPO29CQUNwQixhQUFhLEVBQUUsSUFBSTtvQkFDbkIsWUFBWSxFQUFFLElBQUk7b0JBQ2xCLGVBQWUsRUFBRSxJQUFJO2lCQUN0QjtnQkFDRDtvQkFDRSxFQUFFLEVBQUUsZ0JBQWdCO29CQUNwQixJQUFJLEVBQUUsZ0JBQWdCO29CQUN0QixRQUFRLEVBQUUsSUFBSSxDQUFDLFFBQVE7b0JBQ3ZCLFdBQVcsRUFBRSxLQUFLO29CQUNsQixhQUFhLEVBQUUsSUFBSTtvQkFDbkIsWUFBWSxFQUFFLElBQUk7b0JBQ2xCLGVBQWUsRUFBRSxJQUFJO2lCQUN0QjthQUNGLENBQUM7UUFDSixDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNmLElBQUksQ0FBQyxRQUFRLENBQUMsb0JBQW9CLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDM0MsT0FBTyxhQUFhLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLFFBQVEsS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDekUsQ0FBQztJQUNILENBQUM7SUFFRDs7Ozs7T0FLRztJQUNILEtBQUssQ0FBQyxXQUFXLENBQUMsT0FBd0I7UUFDeEMsSUFBSSxDQUFDO1lBQ0gsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBRXRCLDRCQUE0QjtZQUM1QixNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDLENBQUM7WUFFeEQsZ0JBQWdCO1lBQ2hCLE1BQU0sS0FBSyxHQUFJLElBQUksQ0FBQyxNQUFjLENBQUMsa0JBQWtCLENBQUM7Z0JBQ3BELEtBQUssRUFBRSxPQUFPLENBQUMsS0FBSztnQkFDcEIsY0FBYyxFQUFFLElBQUksQ0FBQyxpQkFBaUIsRUFBRTthQUN6QyxDQUFDLENBQUM7WUFFSCxtQkFBbUI7WUFDbkIsTUFBTSxRQUFRLEdBQUcsTUFBTSxLQUFLLENBQUMsZUFBZSxDQUFDO2dCQUMzQyxRQUFRLEVBQUUsYUFBYSxDQUFDLFFBQVE7Z0JBQ2hDLGdCQUFnQixFQUFFLGFBQWEsQ0FBQyxnQkFBZ0I7Z0JBQ2hELEtBQUssRUFBRSxhQUFhLENBQUMsS0FBSzthQUMzQixDQUFDLENBQUM7WUFFSCxxQ0FBcUM7WUFDckMsTUFBTSxnQkFBZ0IsR0FBcUI7Z0JBQ3pDLEVBQUUsRUFBRSxpQkFBaUI7Z0JBQ3JCLE9BQU8sRUFBRTtvQkFDUCxJQUFJLEVBQUUsV0FBVztvQkFDakIsT0FBTyxFQUFFLEVBQUU7aUJBQ1o7YUFDRixDQUFDO1lBRUYsdUJBQXVCO1lBQ3ZCLElBQUksUUFBUSxFQUFFLENBQUM7Z0JBQ2IsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLE9BQU8sR0FBRyxRQUFRLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQztZQUN6RCxDQUFDO1lBRUQsNEJBQTRCO1lBQzVCLElBQUksUUFBUSxDQUFDLGFBQWEsSUFBSSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDaEUsTUFBTSxTQUFTLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFTLEVBQUUsS0FBYSxFQUFFLEVBQUUsQ0FBQyxDQUFDO29CQUMxRSxFQUFFLEVBQUUsUUFBUSxLQUFLLEVBQUU7b0JBQ25CLElBQUksRUFBRSxVQUFVO29CQUNoQixRQUFRLEVBQUU7d0JBQ1IsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO3dCQUNmLFNBQVMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSTtxQkFDeEQ7aUJBQ0YsQ0FBQyxDQUFDLENBQUM7Z0JBRUosSUFBSSxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO29CQUN6QixnQkFBZ0IsQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDO2dCQUN6QyxDQUFDO1lBQ0gsQ0FBQztZQUVELE9BQU8sZ0JBQWdCLENBQUM7UUFDMUIsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixJQUFJLENBQUMsUUFBUSxDQUFDLGFBQWEsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUNwQyxNQUFNLElBQUksS0FBSyxDQUFDLGlDQUFpQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztRQUNwRSxDQUFDO0lBQ0gsQ0FBQztJQUVEOzs7Ozs7T0FNRztJQUNILEtBQUssQ0FBQyxvQkFBb0IsQ0FDeEIsT0FBd0IsRUFDeEIsT0FBdUM7UUFFdkMsSUFBSSxDQUFDO1lBQ0gsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBRXRCLHdCQUF3QjtZQUN4QixPQUFPLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQztZQUV0Qiw0QkFBNEI7WUFDNUIsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBRXhELDZDQUE2QztZQUM3QyxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztZQUVyRCxnQkFBZ0I7WUFDaEIsTUFBTSxLQUFLLEdBQUksSUFBSSxDQUFDLE1BQWMsQ0FBQyxrQkFBa0IsQ0FBQztnQkFDcEQsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLO2dCQUNwQixjQUFjLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixFQUFFO2FBQ3pDLENBQUMsQ0FBQztZQUVILDZCQUE2QjtZQUM3QixNQUFNLGNBQWMsR0FBRyxNQUFNLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQztnQkFDdkQsUUFBUSxFQUFFLGFBQWEsQ0FBQyxRQUFRO2dCQUNoQyxnQkFBZ0IsRUFBRSxhQUFhLENBQUMsZ0JBQWdCO2dCQUNoRCxLQUFLLEVBQUUsYUFBYSxDQUFDLEtBQUs7YUFDM0IsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDO2dCQUNILHFCQUFxQjtnQkFDckIsSUFBSSxVQUFVLEdBQUcsZUFBZSxDQUFDO2dCQUNqQyxJQUFJLHNCQUFzQixHQUFHLEtBQUssQ0FBQztnQkFDbkMsSUFBSSxtQkFBbUIsR0FBUSxJQUFJLENBQUM7Z0JBRXBDLElBQUksS0FBSyxFQUFFLE1BQU0sS0FBSyxJQUFJLGNBQWMsRUFBRSxDQUFDO29CQUN6QyxzQkFBc0I7b0JBQ3RCLElBQUksS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO3dCQUNmLE1BQU0sYUFBYSxHQUFrQjs0QkFDbkMsRUFBRSxFQUFFLFVBQVU7NEJBQ2QsS0FBSyxFQUFFO2dDQUNMLE9BQU8sRUFBRSxLQUFLLENBQUMsSUFBSTs2QkFDcEI7eUJBQ0YsQ0FBQzt3QkFFRixPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7b0JBQ3pCLENBQUM7b0JBRUQsK0JBQStCO29CQUMvQixJQUFJLEtBQUssQ0FBQyxhQUFhLElBQUksS0FBSyxDQUFDLGFBQWEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7d0JBQzFELE1BQU0sWUFBWSxHQUFHLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBRTVDLDJCQUEyQjt3QkFDM0IsSUFBSSxDQUFDLHNCQUFzQixFQUFFLENBQUM7NEJBQzVCLHNCQUFzQixHQUFHLElBQUksQ0FBQzs0QkFDOUIsbUJBQW1CLEdBQUc7Z0NBQ3BCLEVBQUUsRUFBRSxRQUFRLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRTtnQ0FDeEIsSUFBSSxFQUFFLFlBQVksQ0FBQyxJQUFJO2dDQUN2QixJQUFJLEVBQUUsRUFBRTs2QkFDVCxDQUFDOzRCQUVGLHlCQUF5Qjs0QkFDekIsTUFBTSxhQUFhLEdBQWtCO2dDQUNuQyxFQUFFLEVBQUUsVUFBVTtnQ0FDZCxLQUFLLEVBQUU7b0NBQ0wsU0FBUyxFQUFFLENBQUM7NENBQ1YsRUFBRSxFQUFFLG1CQUFtQixDQUFDLEVBQUU7NENBQzFCLElBQUksRUFBRSxVQUFVOzRDQUNoQixRQUFRLEVBQUU7Z0RBQ1IsSUFBSSxFQUFFLFlBQVksQ0FBQyxJQUFJO2dEQUN2QixTQUFTLEVBQUUsSUFBSTs2Q0FDaEI7eUNBQ0YsQ0FBQztpQ0FDSDs2QkFDRixDQUFDOzRCQUVGLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQzt3QkFDekIsQ0FBQzt3QkFFRCw2QkFBNkI7d0JBQzdCLElBQUksWUFBWSxDQUFDLElBQUksRUFBRSxDQUFDOzRCQUN0QixvQ0FBb0M7NEJBQ3BDLE1BQU0sQ0FBQyxNQUFNLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQzs0QkFFM0QsNkJBQTZCOzRCQUM3QixNQUFNLGFBQWEsR0FBa0I7Z0NBQ25DLEVBQUUsRUFBRSxVQUFVO2dDQUNkLEtBQUssRUFBRTtvQ0FDTCxTQUFTLEVBQUUsQ0FBQzs0Q0FDVixFQUFFLEVBQUUsbUJBQW1CLENBQUMsRUFBRTs0Q0FDMUIsSUFBSSxFQUFFLFVBQVU7NENBQ2hCLFFBQVEsRUFBRTtnREFDUixTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUM7NkNBQ3BEO3lDQUNGLENBQUM7aUNBQ0g7NkJBQ0YsQ0FBQzs0QkFFRixPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7d0JBQ3pCLENBQUM7b0JBQ0gsQ0FBQztnQkFDSCxDQUFDO1lBQ0gsQ0FBQztZQUFDLE9BQU8sV0FBVyxFQUFFLENBQUM7Z0JBQ3JCLElBQUksV0FBVyxDQUFDLElBQUksS0FBSyxZQUFZLEVBQUUsQ0FBQztvQkFDdEMsT0FBTztnQkFDVCxDQUFDO2dCQUNELE1BQU0sV0FBVyxDQUFDO1lBQ3BCLENBQUM7UUFDSCxDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNmLHNCQUFzQjtZQUN0QixJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssWUFBWSxFQUFFLENBQUM7Z0JBQ2hDLE9BQU87WUFDVCxDQUFDO1lBRUQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxzQkFBc0IsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUM3QyxNQUFNLElBQUksS0FBSyxDQUFDLDJDQUEyQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztRQUM5RSxDQUFDO2dCQUFTLENBQUM7WUFDVCxJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksQ0FBQztRQUM5QixDQUFDO0lBQ0gsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0ssbUJBQW1CLENBQUMsT0FBd0I7UUFDbEQsb0NBQW9DO1FBQ3BDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFdEUsNEJBQTRCO1FBQzVCLE1BQU0sYUFBYSxHQUFRO1lBQ3pCLFFBQVE7WUFDUixnQkFBZ0IsRUFBRTtnQkFDaEIsV0FBVyxFQUFFLE9BQU8sQ0FBQyxXQUFXLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxHQUFHO2dCQUMxRSxlQUFlLEVBQUUsT0FBTyxDQUFDLFNBQVMsSUFBSSxJQUFJO2FBQzNDO1NBQ0YsQ0FBQztRQUVGLHVCQUF1QjtRQUN2QixJQUFJLE9BQU8sQ0FBQyxLQUFLLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDOUMsYUFBYSxDQUFDLEtBQUssR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDN0MsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLFVBQVUsRUFBRSxDQUFDO29CQUM3QixPQUFPO3dCQUNMLG9CQUFvQixFQUFFLENBQUM7Z0NBQ3JCLElBQUksRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUk7Z0NBQ3hCLFdBQVcsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVc7Z0NBQ3RDLFVBQVUsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVU7NkJBQ3JDLENBQUM7cUJBQ0gsQ0FBQztnQkFDSixDQUFDO2dCQUNELE9BQU8sSUFBSSxDQUFDO1lBQ2QsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO1FBRUQsT0FBTyxhQUFhLENBQUM7SUFDdkIsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0ssNkJBQTZCLENBQUMsUUFBMkI7UUFDL0QsTUFBTSxjQUFjLEdBQVUsRUFBRSxDQUFDO1FBQ2pDLElBQUksWUFBWSxHQUFHLEVBQUUsQ0FBQztRQUV0QixvQ0FBb0M7UUFDcEMsTUFBTSxhQUFhLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEtBQUssUUFBUSxDQUFDLENBQUM7UUFDbEUsSUFBSSxhQUFhLEVBQUUsQ0FBQztZQUNsQixZQUFZLEdBQUcsYUFBYSxDQUFDLE9BQU8sQ0FBQztRQUN2QyxDQUFDO1FBRUQsOEJBQThCO1FBQzlCLE1BQU0saUJBQWlCLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEtBQUssUUFBUSxDQUFDLENBQUM7UUFFeEUsMkJBQTJCO1FBQzNCLEtBQUssTUFBTSxPQUFPLElBQUksaUJBQWlCLEVBQUUsQ0FBQztZQUN4QyxjQUFjLENBQUMsSUFBSSxDQUFDO2dCQUNsQixJQUFJLEVBQUUsT0FBTyxDQUFDLElBQUksS0FBSyxXQUFXLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTTtnQkFDckQsS0FBSyxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO2FBQ25DLENBQUMsQ0FBQztRQUNMLENBQUM7UUFFRCwrREFBK0Q7UUFDL0QsSUFBSSxZQUFZLElBQUksY0FBYyxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxNQUFNLEVBQUUsQ0FBQztZQUNuRixNQUFNLFlBQVksR0FBRyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDdkMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsR0FBRyxZQUFZLE9BQU8sWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNsRixDQUFDO2FBQU0sSUFBSSxZQUFZLEVBQUUsQ0FBQztZQUN4QixnRUFBZ0U7WUFDaEUsY0FBYyxDQUFDLE9BQU8sQ0FBQztnQkFDckIsSUFBSSxFQUFFLE1BQU07Z0JBQ1osS0FBSyxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLENBQUM7YUFDaEMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELE9BQU8sY0FBYyxDQUFDO0lBQ3hCLENBQUM7SUFFRDs7OztPQUlHO0lBQ0ssaUJBQWlCO1FBQ3ZCLDhCQUE4QjtRQUM5QixPQUFPO1lBQ0w7Z0JBQ0UsUUFBUSxFQUFFLDBCQUEwQjtnQkFDcEMsU0FBUyxFQUFFLHdCQUF3QjthQUNwQztZQUNEO2dCQUNFLFFBQVEsRUFBRSwyQkFBMkI7Z0JBQ3JDLFNBQVMsRUFBRSx3QkFBd0I7YUFDcEM7WUFDRDtnQkFDRSxRQUFRLEVBQUUsaUNBQWlDO2dCQUMzQyxTQUFTLEVBQUUsd0JBQXdCO2FBQ3BDO1lBQ0Q7Z0JBQ0UsUUFBUSxFQUFFLGlDQUFpQztnQkFDM0MsU0FBUyxFQUFFLHdCQUF3QjthQUNwQztTQUNGLENBQUM7SUFDSixDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogR29vZ2xlIEdlbWluaSBQcm92aWRlciBBZGFwdGVyXHJcbiAqIFxyXG4gKiBUaGlzIGZpbGUgaW1wbGVtZW50cyB0aGUgUHJvdmlkZXJBZGFwdGVyIGludGVyZmFjZSBmb3IgdGhlIEdvb2dsZSBHZW1pbmkgQVBJLlxyXG4gKiBJdCB1c2VzIHRoZSBvZmZpY2lhbCBHb29nbGUgR2VtaW5pIFNESyB0byBjb21tdW5pY2F0ZSB3aXRoIHRoZSBHb29nbGUgQUkgQVBJLlxyXG4gKi9cclxuXHJcbi8vIEltcG9ydCB0aGUgR29vZ2xlIEdlbWluaSBTREtcclxuaW1wb3J0IHsgR29vZ2xlR2VuQUkgfSBmcm9tICdAZ29vZ2xlL2dlbmFpJztcclxuaW1wb3J0IHsgXHJcbiAgTW9kZWxJbmZvLCBcclxuICBQcm92aWRlckNodW5rLCBcclxuICBQcm92aWRlck1lc3NhZ2UsIFxyXG4gIFByb3ZpZGVyUmVxdWVzdCwgXHJcbiAgUHJvdmlkZXJSZXNwb25zZSxcclxuICBDT01NT05fTU9ERUxTXHJcbn0gZnJvbSAnLi4vbW9kZWxzL1Byb3ZpZGVyJztcclxuaW1wb3J0IHsgQmFzZUFkYXB0ZXIgfSBmcm9tICcuL0Jhc2VBZGFwdGVyJztcclxuXHJcbi8qKlxyXG4gKiBBZGFwdGVyIGZvciB0aGUgR29vZ2xlIEdlbWluaSBBUEkuXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgR2VtaW5pQWRhcHRlciBleHRlbmRzIEJhc2VBZGFwdGVyIHtcclxuICAvKipcclxuICAgKiBUaGUgbmFtZSBvZiB0aGUgcHJvdmlkZXJcclxuICAgKi9cclxuICByZWFkb25seSBwcm92aWRlciA9ICdnb29nbGUnO1xyXG5cclxuICAvKipcclxuICAgKiBUaGUgR29vZ2xlIEdlbmVyYXRpdmUgQUkgY2xpZW50IGluc3RhbmNlXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBjbGllbnQ6IGFueTtcclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgbmV3IEdlbWluaUFkYXB0ZXIuXHJcbiAgICogXHJcbiAgICogQHBhcmFtIGFwaUtleSBUaGUgR29vZ2xlIEFJIEFQSSBrZXlcclxuICAgKiBAcGFyYW0gYXBpRW5kcG9pbnQgT3B0aW9uYWwgY3VzdG9tIEFQSSBlbmRwb2ludCBVUkxcclxuICAgKi9cclxuICBjb25zdHJ1Y3RvcihhcGlLZXk6IHN0cmluZywgYXBpRW5kcG9pbnQ/OiBzdHJpbmcpIHtcclxuICAgIHN1cGVyKGFwaUtleSwgYXBpRW5kcG9pbnQpO1xyXG4gICAgXHJcbiAgICAvLyBDcmVhdGUgdGhlIEdvb2dsZSBHZW5lcmF0aXZlIEFJIGNsaWVudFxyXG4gICAgY29uc3Qgb3B0aW9uczogYW55ID0ge1xyXG4gICAgICBhcGlLZXk6IHRoaXMuYXBpS2V5XHJcbiAgICB9O1xyXG5cclxuICAgIC8vIFVzZSBjdXN0b20gQVBJIGVuZHBvaW50IGlmIHByb3ZpZGVkXHJcbiAgICBpZiAodGhpcy5hcGlFbmRwb2ludCkge1xyXG4gICAgICBvcHRpb25zLmFwaUVuZHBvaW50ID0gdGhpcy5hcGlFbmRwb2ludDtcclxuICAgIH1cclxuXHJcbiAgICAvLyBVc2UgdHlwZSBhc3NlcnRpb24gdG8gYXZvaWQgVHlwZVNjcmlwdCBlcnJvcnNcclxuICAgIHRoaXMuY2xpZW50ID0gbmV3IEdvb2dsZUdlbkFJKG9wdGlvbnMpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVGVzdCB0aGUgY29ubmVjdGlvbiB0byB0aGUgR29vZ2xlIEdlbWluaSBBUEkuXHJcbiAgICogTWFrZXMgYSBsaWdodHdlaWdodCBBUEkgY2FsbCB0byB2ZXJpZnkgY3JlZGVudGlhbHMuXHJcbiAgICogXHJcbiAgICogQHJldHVybnMgQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gdHJ1ZSBpZiB0aGUgY29ubmVjdGlvbiBpcyBzdWNjZXNzZnVsLCBmYWxzZSBvdGhlcndpc2VcclxuICAgKi9cclxuICBhc3luYyB0ZXN0Q29ubmVjdGlvbigpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIHRoaXMudmFsaWRhdGVBcGlLZXkoKTtcclxuICAgICAgXHJcbiAgICAgIC8vIE1ha2UgYSBtaW5pbWFsIHJlcXVlc3QgdG8gdGVzdCB0aGUgY29ubmVjdGlvblxyXG4gICAgICBjb25zdCBtb2RlbCA9ICh0aGlzLmNsaWVudCBhcyBhbnkpLmdldEdlbmVyYXRpdmVNb2RlbCh7IG1vZGVsOiAnZ2VtaW5pLTEuNS1mbGFzaCcgfSk7XHJcbiAgICAgIGF3YWl0IG1vZGVsLmdlbmVyYXRlQ29udGVudCgnSGVsbG8nKTtcclxuICAgICAgXHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgdGhpcy5sb2dFcnJvcigndGVzdENvbm5lY3Rpb24nLCBlcnJvcik7XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIGxpc3Qgb2YgYXZhaWxhYmxlIG1vZGVscyBmcm9tIEdvb2dsZSBHZW1pbmkuXHJcbiAgICogXHJcbiAgICogQHJldHVybnMgQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gYW4gYXJyYXkgb2YgTW9kZWxJbmZvIG9iamVjdHNcclxuICAgKi9cclxuICBhc3luYyBnZXRBdmFpbGFibGVNb2RlbHMoKTogUHJvbWlzZTxNb2RlbEluZm9bXT4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgdGhpcy52YWxpZGF0ZUFwaUtleSgpO1xyXG4gICAgICBcclxuICAgICAgLy8gR29vZ2xlIGRvZXNuJ3QgaGF2ZSBhIG1vZGVscyBlbmRwb2ludCwgc28gd2UgcmV0dXJuIHRoZSBrbm93biBtb2RlbHNcclxuICAgICAgcmV0dXJuIFtcclxuICAgICAgICB7XHJcbiAgICAgICAgICBpZDogJ2dlbWluaS0xLjUtZmxhc2gnLFxyXG4gICAgICAgICAgbmFtZTogJ0dlbWluaSAxLjUgRmxhc2gnLFxyXG4gICAgICAgICAgcHJvdmlkZXI6IHRoaXMucHJvdmlkZXIsXHJcbiAgICAgICAgICBjb250ZXh0U2l6ZTogMTAwMDAwMCxcclxuICAgICAgICAgIHN1cHBvcnRzVG9vbHM6IHRydWUsXHJcbiAgICAgICAgICBzdXBwb3J0c0pzb246IHRydWUsXHJcbiAgICAgICAgICBtYXhPdXRwdXRUb2tlbnM6IDgxOTJcclxuICAgICAgICB9LFxyXG4gICAgICAgIHtcclxuICAgICAgICAgIGlkOiAnZ2VtaW5pLTEuNS1wcm8nLFxyXG4gICAgICAgICAgbmFtZTogJ0dlbWluaSAxLjUgUHJvJyxcclxuICAgICAgICAgIHByb3ZpZGVyOiB0aGlzLnByb3ZpZGVyLFxyXG4gICAgICAgICAgY29udGV4dFNpemU6IDEwMDAwMDAsXHJcbiAgICAgICAgICBzdXBwb3J0c1Rvb2xzOiB0cnVlLFxyXG4gICAgICAgICAgc3VwcG9ydHNKc29uOiB0cnVlLFxyXG4gICAgICAgICAgbWF4T3V0cHV0VG9rZW5zOiA4MTkyXHJcbiAgICAgICAgfSxcclxuICAgICAgICB7XHJcbiAgICAgICAgICBpZDogJ2dlbWluaS0xLjAtcHJvJyxcclxuICAgICAgICAgIG5hbWU6ICdHZW1pbmkgMS4wIFBybycsXHJcbiAgICAgICAgICBwcm92aWRlcjogdGhpcy5wcm92aWRlcixcclxuICAgICAgICAgIGNvbnRleHRTaXplOiAzMjc2OCxcclxuICAgICAgICAgIHN1cHBvcnRzVG9vbHM6IHRydWUsXHJcbiAgICAgICAgICBzdXBwb3J0c0pzb246IHRydWUsXHJcbiAgICAgICAgICBtYXhPdXRwdXRUb2tlbnM6IDgxOTJcclxuICAgICAgICB9XHJcbiAgICAgIF07XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICB0aGlzLmxvZ0Vycm9yKCdnZXRBdmFpbGFibGVNb2RlbHMnLCBlcnJvcik7XHJcbiAgICAgIHJldHVybiBDT01NT05fTU9ERUxTLmZpbHRlcihtb2RlbCA9PiBtb2RlbC5wcm92aWRlciA9PT0gdGhpcy5wcm92aWRlcik7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZW5kIGEgcmVxdWVzdCB0byB0aGUgR29vZ2xlIEdlbWluaSBBUEkgYW5kIGdldCBhIGNvbXBsZXRlIHJlc3BvbnNlLlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSByZXF1ZXN0IFRoZSByZXF1ZXN0IHBhcmFtZXRlcnNcclxuICAgKiBAcmV0dXJucyBBIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byBhIFByb3ZpZGVyUmVzcG9uc2VcclxuICAgKi9cclxuICBhc3luYyBzZW5kUmVxdWVzdChyZXF1ZXN0OiBQcm92aWRlclJlcXVlc3QpOiBQcm9taXNlPFByb3ZpZGVyUmVzcG9uc2U+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIHRoaXMudmFsaWRhdGVBcGlLZXkoKTtcclxuICAgICAgXHJcbiAgICAgIC8vIENyZWF0ZSB0aGUgR2VtaW5pIHJlcXVlc3RcclxuICAgICAgY29uc3QgZ2VtaW5pUmVxdWVzdCA9IHRoaXMuY3JlYXRlR2VtaW5pUmVxdWVzdChyZXF1ZXN0KTtcclxuICAgICAgXHJcbiAgICAgIC8vIEdldCB0aGUgbW9kZWxcclxuICAgICAgY29uc3QgbW9kZWwgPSAodGhpcy5jbGllbnQgYXMgYW55KS5nZXRHZW5lcmF0aXZlTW9kZWwoeyBcclxuICAgICAgICBtb2RlbDogcmVxdWVzdC5tb2RlbCxcclxuICAgICAgICBzYWZldHlTZXR0aW5nczogdGhpcy5nZXRTYWZldHlTZXR0aW5ncygpXHJcbiAgICAgIH0pO1xyXG4gICAgICBcclxuICAgICAgLy8gU2VuZCB0aGUgcmVxdWVzdFxyXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IG1vZGVsLmdlbmVyYXRlQ29udGVudCh7XHJcbiAgICAgICAgY29udGVudHM6IGdlbWluaVJlcXVlc3QuY29udGVudHMsXHJcbiAgICAgICAgZ2VuZXJhdGlvbkNvbmZpZzogZ2VtaW5pUmVxdWVzdC5nZW5lcmF0aW9uQ29uZmlnLFxyXG4gICAgICAgIHRvb2xzOiBnZW1pbmlSZXF1ZXN0LnRvb2xzXHJcbiAgICAgIH0pO1xyXG4gICAgICBcclxuICAgICAgLy8gQ29udmVydCB0aGUgcmVzcG9uc2UgdG8gb3VyIGZvcm1hdFxyXG4gICAgICBjb25zdCBwcm92aWRlclJlc3BvbnNlOiBQcm92aWRlclJlc3BvbnNlID0ge1xyXG4gICAgICAgIGlkOiAnZ2VtaW5pLXJlc3BvbnNlJyxcclxuICAgICAgICBtZXNzYWdlOiB7XHJcbiAgICAgICAgICByb2xlOiAnYXNzaXN0YW50JyxcclxuICAgICAgICAgIGNvbnRlbnQ6ICcnXHJcbiAgICAgICAgfVxyXG4gICAgICB9O1xyXG4gICAgICBcclxuICAgICAgLy8gRXh0cmFjdCB0ZXh0IGNvbnRlbnRcclxuICAgICAgaWYgKHJlc3BvbnNlKSB7XHJcbiAgICAgICAgcHJvdmlkZXJSZXNwb25zZS5tZXNzYWdlLmNvbnRlbnQgPSByZXNwb25zZS50ZXh0IHx8ICcnO1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICAvLyBBZGQgdG9vbCBjYWxscyBpZiBwcmVzZW50XHJcbiAgICAgIGlmIChyZXNwb25zZS5mdW5jdGlvbkNhbGxzICYmIHJlc3BvbnNlLmZ1bmN0aW9uQ2FsbHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGNvbnN0IHRvb2xDYWxscyA9IHJlc3BvbnNlLmZ1bmN0aW9uQ2FsbHMubWFwKChjYWxsOiBhbnksIGluZGV4OiBudW1iZXIpID0+ICh7XHJcbiAgICAgICAgICBpZDogYGNhbGwtJHtpbmRleH1gLFxyXG4gICAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcclxuICAgICAgICAgIGZ1bmN0aW9uOiB7XHJcbiAgICAgICAgICAgIG5hbWU6IGNhbGwubmFtZSxcclxuICAgICAgICAgICAgYXJndW1lbnRzOiBjYWxsLmFyZ3MgPyBKU09OLnN0cmluZ2lmeShjYWxsLmFyZ3MpIDogJ3t9J1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pKTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAodG9vbENhbGxzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgIHByb3ZpZGVyUmVzcG9uc2UudG9vbENhbGxzID0gdG9vbENhbGxzO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgcmV0dXJuIHByb3ZpZGVyUmVzcG9uc2U7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICB0aGlzLmxvZ0Vycm9yKCdzZW5kUmVxdWVzdCcsIGVycm9yKTtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBHb29nbGUgR2VtaW5pIHJlcXVlc3QgZmFpbGVkOiAke2Vycm9yLm1lc3NhZ2V9YCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZW5kIGEgc3RyZWFtaW5nIHJlcXVlc3QgdG8gdGhlIEdvb2dsZSBHZW1pbmkgQVBJLlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSByZXF1ZXN0IFRoZSByZXF1ZXN0IHBhcmFtZXRlcnMgKHNob3VsZCBoYXZlIHN0cmVhbTogdHJ1ZSlcclxuICAgKiBAcGFyYW0gb25DaHVuayBDYWxsYmFjayBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgY2FsbGVkIGZvciBlYWNoIGNodW5rIHJlY2VpdmVkXHJcbiAgICogQHJldHVybnMgQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiB0aGUgc3RyZWFtIGlzIGNvbXBsZXRlXHJcbiAgICovXHJcbiAgYXN5bmMgc2VuZFN0cmVhbWluZ1JlcXVlc3QoXHJcbiAgICByZXF1ZXN0OiBQcm92aWRlclJlcXVlc3QsXHJcbiAgICBvbkNodW5rOiAoY2h1bms6IFByb3ZpZGVyQ2h1bmspID0+IHZvaWRcclxuICApOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIHRoaXMudmFsaWRhdGVBcGlLZXkoKTtcclxuICAgICAgXHJcbiAgICAgIC8vIEVuc3VyZSBzdHJlYW0gaXMgdHJ1ZVxyXG4gICAgICByZXF1ZXN0LnN0cmVhbSA9IHRydWU7XHJcbiAgICAgIFxyXG4gICAgICAvLyBDcmVhdGUgdGhlIEdlbWluaSByZXF1ZXN0XHJcbiAgICAgIGNvbnN0IGdlbWluaVJlcXVlc3QgPSB0aGlzLmNyZWF0ZUdlbWluaVJlcXVlc3QocmVxdWVzdCk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBDcmVhdGUgYW4gQWJvcnRDb250cm9sbGVyIGZvciB0aGlzIHJlcXVlc3RcclxuICAgICAgY29uc3QgYWJvcnRDb250cm9sbGVyID0gdGhpcy5jcmVhdGVBYm9ydENvbnRyb2xsZXIoKTtcclxuICAgICAgXHJcbiAgICAgIC8vIEdldCB0aGUgbW9kZWxcclxuICAgICAgY29uc3QgbW9kZWwgPSAodGhpcy5jbGllbnQgYXMgYW55KS5nZXRHZW5lcmF0aXZlTW9kZWwoeyBcclxuICAgICAgICBtb2RlbDogcmVxdWVzdC5tb2RlbCxcclxuICAgICAgICBzYWZldHlTZXR0aW5nczogdGhpcy5nZXRTYWZldHlTZXR0aW5ncygpXHJcbiAgICAgIH0pO1xyXG4gICAgICBcclxuICAgICAgLy8gU2VuZCB0aGUgc3RyZWFtaW5nIHJlcXVlc3RcclxuICAgICAgY29uc3Qgc3RyZWFtUmVzcG9uc2UgPSBhd2FpdCBtb2RlbC5nZW5lcmF0ZUNvbnRlbnRTdHJlYW0oe1xyXG4gICAgICAgIGNvbnRlbnRzOiBnZW1pbmlSZXF1ZXN0LmNvbnRlbnRzLFxyXG4gICAgICAgIGdlbmVyYXRpb25Db25maWc6IGdlbWluaVJlcXVlc3QuZ2VuZXJhdGlvbkNvbmZpZyxcclxuICAgICAgICB0b29sczogZ2VtaW5pUmVxdWVzdC50b29sc1xyXG4gICAgICB9KTtcclxuICAgICAgXHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgLy8gUHJvY2VzcyB0aGUgc3RyZWFtXHJcbiAgICAgICAgbGV0IHJlc3BvbnNlSWQgPSAnZ2VtaW5pLXN0cmVhbSc7XHJcbiAgICAgICAgbGV0IGZ1bmN0aW9uQ2FsbEluUHJvZ3Jlc3MgPSBmYWxzZTtcclxuICAgICAgICBsZXQgY3VycmVudEZ1bmN0aW9uQ2FsbDogYW55ID0gbnVsbDtcclxuICAgICAgICBcclxuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGNodW5rIG9mIHN0cmVhbVJlc3BvbnNlKSB7XHJcbiAgICAgICAgICAvLyBQcm9jZXNzIHRleHQgY2h1bmtzXHJcbiAgICAgICAgICBpZiAoY2h1bmsudGV4dCkge1xyXG4gICAgICAgICAgICBjb25zdCBwcm92aWRlckNodW5rOiBQcm92aWRlckNodW5rID0ge1xyXG4gICAgICAgICAgICAgIGlkOiByZXNwb25zZUlkLFxyXG4gICAgICAgICAgICAgIGRlbHRhOiB7XHJcbiAgICAgICAgICAgICAgICBjb250ZW50OiBjaHVuay50ZXh0XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgb25DaHVuayhwcm92aWRlckNodW5rKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIFxyXG4gICAgICAgICAgLy8gUHJvY2VzcyBmdW5jdGlvbiBjYWxsIGNodW5rc1xyXG4gICAgICAgICAgaWYgKGNodW5rLmZ1bmN0aW9uQ2FsbHMgJiYgY2h1bmsuZnVuY3Rpb25DYWxscy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGZ1bmN0aW9uQ2FsbCA9IGNodW5rLmZ1bmN0aW9uQ2FsbHNbMF07XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBTdGFydCBvZiBhIGZ1bmN0aW9uIGNhbGxcclxuICAgICAgICAgICAgaWYgKCFmdW5jdGlvbkNhbGxJblByb2dyZXNzKSB7XHJcbiAgICAgICAgICAgICAgZnVuY3Rpb25DYWxsSW5Qcm9ncmVzcyA9IHRydWU7XHJcbiAgICAgICAgICAgICAgY3VycmVudEZ1bmN0aW9uQ2FsbCA9IHtcclxuICAgICAgICAgICAgICAgIGlkOiBgY2FsbC0ke0RhdGUubm93KCl9YCxcclxuICAgICAgICAgICAgICAgIG5hbWU6IGZ1bmN0aW9uQ2FsbC5uYW1lLFxyXG4gICAgICAgICAgICAgICAgYXJnczoge31cclxuICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgIC8vIFNlbmQgdGhlIGZ1bmN0aW9uIG5hbWVcclxuICAgICAgICAgICAgICBjb25zdCBwcm92aWRlckNodW5rOiBQcm92aWRlckNodW5rID0ge1xyXG4gICAgICAgICAgICAgICAgaWQ6IHJlc3BvbnNlSWQsXHJcbiAgICAgICAgICAgICAgICBkZWx0YToge1xyXG4gICAgICAgICAgICAgICAgICB0b29sQ2FsbHM6IFt7XHJcbiAgICAgICAgICAgICAgICAgICAgaWQ6IGN1cnJlbnRGdW5jdGlvbkNhbGwuaWQsXHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcclxuICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbjoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgbmFtZTogZnVuY3Rpb25DYWxsLm5hbWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICBhcmd1bWVudHM6ICd7fSdcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgIH1dXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICBvbkNodW5rKHByb3ZpZGVyQ2h1bmspO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBQcm9jZXNzIGZ1bmN0aW9uIGFyZ3VtZW50c1xyXG4gICAgICAgICAgICBpZiAoZnVuY3Rpb25DYWxsLmFyZ3MpIHtcclxuICAgICAgICAgICAgICAvLyBNZXJnZSBuZXcgYXJncyB3aXRoIGV4aXN0aW5nIGFyZ3NcclxuICAgICAgICAgICAgICBPYmplY3QuYXNzaWduKGN1cnJlbnRGdW5jdGlvbkNhbGwuYXJncywgZnVuY3Rpb25DYWxsLmFyZ3MpO1xyXG4gICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgIC8vIFNlbmQgdGhlIHVwZGF0ZWQgYXJndW1lbnRzXHJcbiAgICAgICAgICAgICAgY29uc3QgcHJvdmlkZXJDaHVuazogUHJvdmlkZXJDaHVuayA9IHtcclxuICAgICAgICAgICAgICAgIGlkOiByZXNwb25zZUlkLFxyXG4gICAgICAgICAgICAgICAgZGVsdGE6IHtcclxuICAgICAgICAgICAgICAgICAgdG9vbENhbGxzOiBbe1xyXG4gICAgICAgICAgICAgICAgICAgIGlkOiBjdXJyZW50RnVuY3Rpb25DYWxsLmlkLFxyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXHJcbiAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb246IHtcclxuICAgICAgICAgICAgICAgICAgICAgIGFyZ3VtZW50czogSlNPTi5zdHJpbmdpZnkoY3VycmVudEZ1bmN0aW9uQ2FsbC5hcmdzKVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgfV1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgIG9uQ2h1bmsocHJvdmlkZXJDaHVuayk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH0gY2F0Y2ggKHN0cmVhbUVycm9yKSB7XHJcbiAgICAgICAgaWYgKHN0cmVhbUVycm9yLm5hbWUgPT09ICdBYm9ydEVycm9yJykge1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aHJvdyBzdHJlYW1FcnJvcjtcclxuICAgICAgfVxyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgLy8gSWdub3JlIGFib3J0IGVycm9yc1xyXG4gICAgICBpZiAoZXJyb3IubmFtZSA9PT0gJ0Fib3J0RXJyb3InKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICB0aGlzLmxvZ0Vycm9yKCdzZW5kU3RyZWFtaW5nUmVxdWVzdCcsIGVycm9yKTtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBHb29nbGUgR2VtaW5pIHN0cmVhbWluZyByZXF1ZXN0IGZhaWxlZDogJHtlcnJvci5tZXNzYWdlfWApO1xyXG4gICAgfSBmaW5hbGx5IHtcclxuICAgICAgdGhpcy5hYm9ydENvbnRyb2xsZXIgPSBudWxsO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgR29vZ2xlIEdlbWluaSByZXF1ZXN0IGZyb20gb3VyIGNvbW1vbiByZXF1ZXN0IGZvcm1hdC5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gcmVxdWVzdCBPdXIgY29tbW9uIHJlcXVlc3QgZm9ybWF0XHJcbiAgICogQHJldHVybnMgR29vZ2xlIEdlbWluaSByZXF1ZXN0IGZvcm1hdFxyXG4gICAqL1xyXG4gIHByaXZhdGUgY3JlYXRlR2VtaW5pUmVxdWVzdChyZXF1ZXN0OiBQcm92aWRlclJlcXVlc3QpOiBhbnkge1xyXG4gICAgLy8gTWFwIG91ciBtZXNzYWdlcyB0byBHZW1pbmkgZm9ybWF0XHJcbiAgICBjb25zdCBjb250ZW50cyA9IHRoaXMuY29udmVydE1lc3NhZ2VzVG9HZW1pbmlGb3JtYXQocmVxdWVzdC5tZXNzYWdlcyk7XHJcbiAgICBcclxuICAgIC8vIENyZWF0ZSB0aGUgR2VtaW5pIHJlcXVlc3RcclxuICAgIGNvbnN0IGdlbWluaVJlcXVlc3Q6IGFueSA9IHtcclxuICAgICAgY29udGVudHMsXHJcbiAgICAgIGdlbmVyYXRpb25Db25maWc6IHtcclxuICAgICAgICB0ZW1wZXJhdHVyZTogcmVxdWVzdC50ZW1wZXJhdHVyZSAhPT0gdW5kZWZpbmVkID8gcmVxdWVzdC50ZW1wZXJhdHVyZSA6IDAuNyxcclxuICAgICAgICBtYXhPdXRwdXRUb2tlbnM6IHJlcXVlc3QubWF4VG9rZW5zIHx8IDQwOTYsXHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgICBcclxuICAgIC8vIEFkZCB0b29scyBpZiBwcmVzZW50XHJcbiAgICBpZiAocmVxdWVzdC50b29scyAmJiByZXF1ZXN0LnRvb2xzLmxlbmd0aCA+IDApIHtcclxuICAgICAgZ2VtaW5pUmVxdWVzdC50b29scyA9IHJlcXVlc3QudG9vbHMubWFwKHRvb2wgPT4ge1xyXG4gICAgICAgIGlmICh0b29sLnR5cGUgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGZ1bmN0aW9uRGVjbGFyYXRpb25zOiBbe1xyXG4gICAgICAgICAgICAgIG5hbWU6IHRvb2wuZnVuY3Rpb24ubmFtZSxcclxuICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogdG9vbC5mdW5jdGlvbi5kZXNjcmlwdGlvbixcclxuICAgICAgICAgICAgICBwYXJhbWV0ZXJzOiB0b29sLmZ1bmN0aW9uLnBhcmFtZXRlcnNcclxuICAgICAgICAgICAgfV1cclxuICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0b29sO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIGdlbWluaVJlcXVlc3Q7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDb252ZXJ0IG91ciBtZXNzYWdlcyBmb3JtYXQgdG8gR29vZ2xlIEdlbWluaSBmb3JtYXQuXHJcbiAgICogXHJcbiAgICogQHBhcmFtIG1lc3NhZ2VzIE91ciBtZXNzYWdlc1xyXG4gICAqIEByZXR1cm5zIEdvb2dsZSBHZW1pbmkgZm9ybWF0IG1lc3NhZ2VzXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBjb252ZXJ0TWVzc2FnZXNUb0dlbWluaUZvcm1hdChtZXNzYWdlczogUHJvdmlkZXJNZXNzYWdlW10pOiBhbnlbXSB7XHJcbiAgICBjb25zdCBnZW1pbmlNZXNzYWdlczogYW55W10gPSBbXTtcclxuICAgIGxldCBzeXN0ZW1Qcm9tcHQgPSAnJztcclxuICAgIFxyXG4gICAgLy8gRXh0cmFjdCBzeXN0ZW0gbWVzc2FnZSBpZiBwcmVzZW50XHJcbiAgICBjb25zdCBzeXN0ZW1NZXNzYWdlID0gbWVzc2FnZXMuZmluZChtc2cgPT4gbXNnLnJvbGUgPT09ICdzeXN0ZW0nKTtcclxuICAgIGlmIChzeXN0ZW1NZXNzYWdlKSB7XHJcbiAgICAgIHN5c3RlbVByb21wdCA9IHN5c3RlbU1lc3NhZ2UuY29udGVudDtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8gUHJvY2VzcyBub24tc3lzdGVtIG1lc3NhZ2VzXHJcbiAgICBjb25zdCBub25TeXN0ZW1NZXNzYWdlcyA9IG1lc3NhZ2VzLmZpbHRlcihtc2cgPT4gbXNnLnJvbGUgIT09ICdzeXN0ZW0nKTtcclxuICAgIFxyXG4gICAgLy8gQ29udmVydCB0byBHZW1pbmkgZm9ybWF0XHJcbiAgICBmb3IgKGNvbnN0IG1lc3NhZ2Ugb2Ygbm9uU3lzdGVtTWVzc2FnZXMpIHtcclxuICAgICAgZ2VtaW5pTWVzc2FnZXMucHVzaCh7XHJcbiAgICAgICAgcm9sZTogbWVzc2FnZS5yb2xlID09PSAnYXNzaXN0YW50JyA/ICdtb2RlbCcgOiAndXNlcicsXHJcbiAgICAgICAgcGFydHM6IFt7IHRleHQ6IG1lc3NhZ2UuY29udGVudCB9XVxyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8gSWYgdGhlcmUncyBhIHN5c3RlbSBwcm9tcHQsIGFkZCBpdCB0byB0aGUgZmlyc3QgdXNlciBtZXNzYWdlXHJcbiAgICBpZiAoc3lzdGVtUHJvbXB0ICYmIGdlbWluaU1lc3NhZ2VzLmxlbmd0aCA+IDAgJiYgZ2VtaW5pTWVzc2FnZXNbMF0ucm9sZSA9PT0gJ3VzZXInKSB7XHJcbiAgICAgIGNvbnN0IGZpcnN0TWVzc2FnZSA9IGdlbWluaU1lc3NhZ2VzWzBdO1xyXG4gICAgICBmaXJzdE1lc3NhZ2UucGFydHNbMF0udGV4dCA9IGAke3N5c3RlbVByb21wdH1cXG5cXG4ke2ZpcnN0TWVzc2FnZS5wYXJ0c1swXS50ZXh0fWA7XHJcbiAgICB9IGVsc2UgaWYgKHN5c3RlbVByb21wdCkge1xyXG4gICAgICAvLyBJZiB0aGVyZSdzIG5vIHVzZXIgbWVzc2FnZSwgY3JlYXRlIG9uZSB3aXRoIHRoZSBzeXN0ZW0gcHJvbXB0XHJcbiAgICAgIGdlbWluaU1lc3NhZ2VzLnVuc2hpZnQoe1xyXG4gICAgICAgIHJvbGU6ICd1c2VyJyxcclxuICAgICAgICBwYXJ0czogW3sgdGV4dDogc3lzdGVtUHJvbXB0IH1dXHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gZ2VtaW5pTWVzc2FnZXM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgc2FmZXR5IHNldHRpbmdzIGZvciB0aGUgR29vZ2xlIEdlbWluaSBBUEkuXHJcbiAgICogXHJcbiAgICogQHJldHVybnMgU2FmZXR5IHNldHRpbmdzXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBnZXRTYWZldHlTZXR0aW5ncygpOiBhbnlbXSB7XHJcbiAgICAvLyBVc2UgZGVmYXVsdCBzYWZldHkgc2V0dGluZ3NcclxuICAgIHJldHVybiBbXHJcbiAgICAgIHtcclxuICAgICAgICBjYXRlZ29yeTogJ0hBUk1fQ0FURUdPUllfSEFSQVNTTUVOVCcsXHJcbiAgICAgICAgdGhyZXNob2xkOiAnQkxPQ0tfTUVESVVNX0FORF9BQk9WRSdcclxuICAgICAgfSxcclxuICAgICAge1xyXG4gICAgICAgIGNhdGVnb3J5OiAnSEFSTV9DQVRFR09SWV9IQVRFX1NQRUVDSCcsXHJcbiAgICAgICAgdGhyZXNob2xkOiAnQkxPQ0tfTUVESVVNX0FORF9BQk9WRSdcclxuICAgICAgfSxcclxuICAgICAge1xyXG4gICAgICAgIGNhdGVnb3J5OiAnSEFSTV9DQVRFR09SWV9TRVhVQUxMWV9FWFBMSUNJVCcsXHJcbiAgICAgICAgdGhyZXNob2xkOiAnQkxPQ0tfTUVESVVNX0FORF9BQk9WRSdcclxuICAgICAgfSxcclxuICAgICAge1xyXG4gICAgICAgIGNhdGVnb3J5OiAnSEFSTV9DQVRFR09SWV9EQU5HRVJPVVNfQ09OVEVOVCcsXHJcbiAgICAgICAgdGhyZXNob2xkOiAnQkxPQ0tfTUVESVVNX0FORF9BQk9WRSdcclxuICAgICAgfVxyXG4gICAgXTtcclxuICB9XHJcbn1cclxuIl19