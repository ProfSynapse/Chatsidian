/**
 * Requesty Provider Adapter
 *
 * This file implements the ProviderAdapter interface for the Requesty API.
 * It uses Obsidian's requestUrl method to communicate with the Requesty API.
 */
import { requestUrl } from 'obsidian';
import { BaseAdapter } from './BaseAdapter';
/**
 * Adapter for the Requesty API.
 */
export class RequestyAdapter extends BaseAdapter {
    /**
     * Create a new RequestyAdapter.
     *
     * @param apiKey The Requesty API key
     * @param apiEndpoint Optional custom API endpoint URL
     */
    constructor(apiKey, apiEndpoint) {
        super(apiKey, apiEndpoint);
        /**
         * The name of the provider
         */
        this.provider = 'requesty';
    }
    /**
     * Get the base URL for the Requesty API.
     *
     * @returns The base URL
     */
    getBaseUrl() {
        return this.apiEndpoint || 'https://router.requesty.ai';
    }
    /**
     * Test the connection to the Requesty API.
     * Makes a lightweight API call to verify credentials.
     *
     * @returns A promise that resolves to true if the connection is successful, false otherwise
     */
    async testConnection() {
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
        }
        catch (error) {
            this.logError('testConnection', error);
            return false;
        }
    }
    /**
     * Get a list of available models from Requesty.
     *
     * @returns A promise that resolves to an array of ModelInfo objects
     */
    async getAvailableModels() {
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
                return data.data.map((model) => {
                    var _a, _b, _c;
                    // Try to find the model in COMMON_MODELS
                    const providerName = model.id.split('/')[0] || 'unknown';
                    const modelId = model.id.split('/')[1] || model.id;
                    return {
                        id: model.id,
                        name: model.name || modelId,
                        provider: this.provider,
                        contextSize: model.context_length || 4096,
                        supportsTools: ((_a = model.capabilities) === null || _a === void 0 ? void 0 : _a.tools) || false,
                        supportsJson: ((_b = model.capabilities) === null || _b === void 0 ? void 0 : _b.json_response) || false,
                        maxOutputTokens: ((_c = model.capabilities) === null || _c === void 0 ? void 0 : _c.max_output_tokens) || 4096
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
        }
        catch (error) {
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
    async sendRequest(request) {
        var _a, _b, _c, _d, _e, _f;
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
            const providerResponse = {
                id: data.id || 'requesty-response',
                message: {
                    role: 'assistant',
                    content: ((_c = (_b = (_a = data.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) || ''
                }
            };
            // Add tool calls if present
            if ((_f = (_e = (_d = data.choices) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.message) === null || _f === void 0 ? void 0 : _f.tool_calls) {
                providerResponse.toolCalls = data.choices[0].message.tool_calls.map((toolCall) => ({
                    id: toolCall.id,
                    type: 'function',
                    function: {
                        name: toolCall.function.name,
                        arguments: toolCall.function.arguments
                    }
                }));
            }
            return providerResponse;
        }
        catch (error) {
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
    async sendStreamingRequest(request, onChunk) {
        var _a;
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
            const reader = (_a = response.body) === null || _a === void 0 ? void 0 : _a.getReader();
            if (!reader) {
                throw new Error('Response body is not readable');
            }
            // Create an AbortController for this request
            const abortController = this.createAbortController();
            // Process the stream
            return new Promise(async (resolve, reject) => {
                var _a, _b;
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
                                    const delta = (_b = (_a = data.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.delta;
                                    if (delta) {
                                        const providerChunk = {
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
                                catch (error) {
                                    console.error('Error processing stream chunk:', error);
                                }
                            }
                        }
                    }
                    resolve();
                }
                catch (error) {
                    // Ignore if we aborted
                    if (abortController.signal.aborted) {
                        resolve();
                        return;
                    }
                    reject(error);
                }
            });
        }
        catch (error) {
            // Ignore abort errors
            if (error.name === 'AbortError') {
                return;
            }
            this.logError('sendStreamingRequest', error);
            throw new Error(`Requesty streaming request failed: ${error.message}`);
        }
        finally {
            this.abortController = null;
        }
    }
    /**
     * Create a Requesty request from our common request format.
     *
     * @param request Our common request format
     * @returns Requesty request format
     */
    createRequestyRequest(request) {
        // Create the Requesty request (OpenAI-compatible format)
        const requestyRequest = {
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
    getHeaders() {
        return {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUmVxdWVzdHlBZGFwdGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiUmVxdWVzdHlBZGFwdGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7OztHQUtHO0FBRUgsT0FBTyxFQUFFLFVBQVUsRUFBbUIsTUFBTSxVQUFVLENBQUM7QUFTdkQsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUU1Qzs7R0FFRztBQUNILE1BQU0sT0FBTyxlQUFnQixTQUFRLFdBQVc7SUFNOUM7Ozs7O09BS0c7SUFDSCxZQUFZLE1BQWMsRUFBRSxXQUFvQjtRQUM5QyxLQUFLLENBQUMsTUFBTSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBWjdCOztXQUVHO1FBQ00sYUFBUSxHQUFHLFVBQVUsQ0FBQztJQVUvQixDQUFDO0lBRUQ7Ozs7T0FJRztJQUNLLFVBQVU7UUFDaEIsT0FBTyxJQUFJLENBQUMsV0FBVyxJQUFJLDRCQUE0QixDQUFDO0lBQzFELENBQUM7SUFFRDs7Ozs7T0FLRztJQUNILEtBQUssQ0FBQyxjQUFjO1FBQ2xCLElBQUksQ0FBQztZQUNILElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUV0QixnREFBZ0Q7WUFDaEQsTUFBTSxRQUFRLEdBQUcsTUFBTSxVQUFVLENBQUM7Z0JBQ2hDLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxVQUFVLEVBQUUsWUFBWTtnQkFDckMsTUFBTSxFQUFFLEtBQUs7Z0JBQ2IsT0FBTyxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUU7Z0JBQzFCLEtBQUssRUFBRSxLQUFLO2FBQ2IsQ0FBQyxDQUFDO1lBRUgsT0FBTyxRQUFRLENBQUMsTUFBTSxLQUFLLEdBQUcsQ0FBQztRQUNqQyxDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNmLElBQUksQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDdkMsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDO0lBQ0gsQ0FBQztJQUVEOzs7O09BSUc7SUFDSCxLQUFLLENBQUMsa0JBQWtCO1FBQ3RCLElBQUksQ0FBQztZQUNILElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUV0QixtQ0FBbUM7WUFDbkMsTUFBTSxRQUFRLEdBQUcsTUFBTSxVQUFVLENBQUM7Z0JBQ2hDLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxVQUFVLEVBQUUsWUFBWTtnQkFDckMsTUFBTSxFQUFFLEtBQUs7Z0JBQ2IsT0FBTyxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUU7Z0JBQzFCLEtBQUssRUFBRSxLQUFLO2FBQ2IsQ0FBQyxDQUFDO1lBRUgsSUFBSSxRQUFRLENBQUMsTUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDO2dCQUM1QixNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixRQUFRLENBQUMsTUFBTSxJQUFJLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBQy9FLENBQUM7WUFFRCxxQkFBcUI7WUFDckIsTUFBTSxJQUFJLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQztZQUUzQiw4QkFBOEI7WUFDOUIsSUFBSSxJQUFJLElBQUksSUFBSSxDQUFDLElBQUksSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUNsRCxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBVSxFQUFFLEVBQUU7O29CQUNsQyx5Q0FBeUM7b0JBQ3pDLE1BQU0sWUFBWSxHQUFHLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLFNBQVMsQ0FBQztvQkFDekQsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLEVBQUUsQ0FBQztvQkFFbkQsT0FBTzt3QkFDTCxFQUFFLEVBQUUsS0FBSyxDQUFDLEVBQUU7d0JBQ1osSUFBSSxFQUFFLEtBQUssQ0FBQyxJQUFJLElBQUksT0FBTzt3QkFDM0IsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRO3dCQUN2QixXQUFXLEVBQUUsS0FBSyxDQUFDLGNBQWMsSUFBSSxJQUFJO3dCQUN6QyxhQUFhLEVBQUUsQ0FBQSxNQUFBLEtBQUssQ0FBQyxZQUFZLDBDQUFFLEtBQUssS0FBSSxLQUFLO3dCQUNqRCxZQUFZLEVBQUUsQ0FBQSxNQUFBLEtBQUssQ0FBQyxZQUFZLDBDQUFFLGFBQWEsS0FBSSxLQUFLO3dCQUN4RCxlQUFlLEVBQUUsQ0FBQSxNQUFBLEtBQUssQ0FBQyxZQUFZLDBDQUFFLGlCQUFpQixLQUFJLElBQUk7cUJBQy9ELENBQUM7Z0JBQ0osQ0FBQyxDQUFDLENBQUM7WUFDTCxDQUFDO1lBRUQsMkJBQTJCO1lBQzNCLE9BQU87Z0JBQ0w7b0JBQ0UsRUFBRSxFQUFFLGVBQWU7b0JBQ25CLElBQUksRUFBRSx1QkFBdUI7b0JBQzdCLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUTtvQkFDdkIsV0FBVyxFQUFFLE1BQU07b0JBQ25CLGFBQWEsRUFBRSxJQUFJO29CQUNuQixZQUFZLEVBQUUsSUFBSTtvQkFDbEIsZUFBZSxFQUFFLElBQUk7aUJBQ3RCO2dCQUNEO29CQUNFLEVBQUUsRUFBRSxrQ0FBa0M7b0JBQ3RDLElBQUksRUFBRSw4QkFBOEI7b0JBQ3BDLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUTtvQkFDdkIsV0FBVyxFQUFFLE1BQU07b0JBQ25CLGFBQWEsRUFBRSxJQUFJO29CQUNuQixZQUFZLEVBQUUsSUFBSTtvQkFDbEIsZUFBZSxFQUFFLElBQUk7aUJBQ3RCO2dCQUNEO29CQUNFLEVBQUUsRUFBRSxvQ0FBb0M7b0JBQ3hDLElBQUksRUFBRSxnQ0FBZ0M7b0JBQ3RDLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUTtvQkFDdkIsV0FBVyxFQUFFLE1BQU07b0JBQ25CLGFBQWEsRUFBRSxJQUFJO29CQUNuQixZQUFZLEVBQUUsSUFBSTtvQkFDbEIsZUFBZSxFQUFFLElBQUk7aUJBQ3RCO2FBQ0YsQ0FBQztRQUNKLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsSUFBSSxDQUFDLFFBQVEsQ0FBQyxvQkFBb0IsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUMzQyxpQ0FBaUM7WUFDakMsT0FBTztnQkFDTDtvQkFDRSxFQUFFLEVBQUUsZUFBZTtvQkFDbkIsSUFBSSxFQUFFLHVCQUF1QjtvQkFDN0IsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRO29CQUN2QixXQUFXLEVBQUUsTUFBTTtvQkFDbkIsYUFBYSxFQUFFLElBQUk7b0JBQ25CLFlBQVksRUFBRSxJQUFJO29CQUNsQixlQUFlLEVBQUUsSUFBSTtpQkFDdEI7Z0JBQ0Q7b0JBQ0UsRUFBRSxFQUFFLGtDQUFrQztvQkFDdEMsSUFBSSxFQUFFLDhCQUE4QjtvQkFDcEMsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRO29CQUN2QixXQUFXLEVBQUUsTUFBTTtvQkFDbkIsYUFBYSxFQUFFLElBQUk7b0JBQ25CLFlBQVksRUFBRSxJQUFJO29CQUNsQixlQUFlLEVBQUUsSUFBSTtpQkFDdEI7YUFDRixDQUFDO1FBQ0osQ0FBQztJQUNILENBQUM7SUFFRDs7Ozs7T0FLRztJQUNILEtBQUssQ0FBQyxXQUFXLENBQUMsT0FBd0I7O1FBQ3hDLElBQUksQ0FBQztZQUNILElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUV0Qiw4QkFBOEI7WUFDOUIsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBRTVELG1CQUFtQjtZQUNuQixNQUFNLFFBQVEsR0FBRyxNQUFNLFVBQVUsQ0FBQztnQkFDaEMsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLFVBQVUsRUFBRSxzQkFBc0I7Z0JBQy9DLE1BQU0sRUFBRSxNQUFNO2dCQUNkLE9BQU8sRUFBRSxJQUFJLENBQUMsVUFBVSxFQUFFO2dCQUMxQixJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUM7Z0JBQ3JDLEtBQUssRUFBRSxLQUFLO2FBQ2IsQ0FBQyxDQUFDO1lBRUgsSUFBSSxRQUFRLENBQUMsTUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDO2dCQUM1QixNQUFNLElBQUksS0FBSyxDQUFDLG1CQUFtQixRQUFRLENBQUMsTUFBTSxJQUFJLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBQ3pFLENBQUM7WUFFRCxNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDO1lBRTNCLHFDQUFxQztZQUNyQyxNQUFNLGdCQUFnQixHQUFxQjtnQkFDekMsRUFBRSxFQUFFLElBQUksQ0FBQyxFQUFFLElBQUksbUJBQW1CO2dCQUNsQyxPQUFPLEVBQUU7b0JBQ1AsSUFBSSxFQUFFLFdBQVc7b0JBQ2pCLE9BQU8sRUFBRSxDQUFBLE1BQUEsTUFBQSxNQUFBLElBQUksQ0FBQyxPQUFPLDBDQUFHLENBQUMsQ0FBQywwQ0FBRSxPQUFPLDBDQUFFLE9BQU8sS0FBSSxFQUFFO2lCQUNuRDthQUNGLENBQUM7WUFFRiw0QkFBNEI7WUFDNUIsSUFBSSxNQUFBLE1BQUEsTUFBQSxJQUFJLENBQUMsT0FBTywwQ0FBRyxDQUFDLENBQUMsMENBQUUsT0FBTywwQ0FBRSxVQUFVLEVBQUUsQ0FBQztnQkFDM0MsZ0JBQWdCLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxRQUFhLEVBQUUsRUFBRSxDQUFDLENBQUM7b0JBQ3RGLEVBQUUsRUFBRSxRQUFRLENBQUMsRUFBRTtvQkFDZixJQUFJLEVBQUUsVUFBVTtvQkFDaEIsUUFBUSxFQUFFO3dCQUNSLElBQUksRUFBRSxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUk7d0JBQzVCLFNBQVMsRUFBRSxRQUFRLENBQUMsUUFBUSxDQUFDLFNBQVM7cUJBQ3ZDO2lCQUNGLENBQUMsQ0FBQyxDQUFDO1lBQ04sQ0FBQztZQUVELE9BQU8sZ0JBQWdCLENBQUM7UUFDMUIsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixJQUFJLENBQUMsUUFBUSxDQUFDLGFBQWEsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUNwQyxNQUFNLElBQUksS0FBSyxDQUFDLDRCQUE0QixLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztRQUMvRCxDQUFDO0lBQ0gsQ0FBQztJQUVEOzs7Ozs7T0FNRztJQUNILEtBQUssQ0FBQyxvQkFBb0IsQ0FDeEIsT0FBd0IsRUFDeEIsT0FBdUM7O1FBRXZDLElBQUksQ0FBQztZQUNILElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUV0Qix3QkFBd0I7WUFDeEIsT0FBTyxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7WUFFdEIsOEJBQThCO1lBQzlCLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUU1RCw0RkFBNEY7WUFDNUYsOENBQThDO1lBQzlDLE1BQU0sUUFBUSxHQUFHLE1BQU0sS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLFVBQVUsRUFBRSxzQkFBc0IsRUFBRTtnQkFDdkUsTUFBTSxFQUFFLE1BQU07Z0JBQ2QsT0FBTyxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUU7Z0JBQzFCLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQzthQUN0QyxDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUNqQixNQUFNLElBQUksS0FBSyxDQUFDLDZCQUE2QixRQUFRLENBQUMsTUFBTSxJQUFJLFFBQVEsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO1lBQ3pGLENBQUM7WUFFRCxNQUFNLE1BQU0sR0FBRyxNQUFBLFFBQVEsQ0FBQyxJQUFJLDBDQUFFLFNBQVMsRUFBRSxDQUFDO1lBQzFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDWixNQUFNLElBQUksS0FBSyxDQUFDLCtCQUErQixDQUFDLENBQUM7WUFDbkQsQ0FBQztZQUVELDZDQUE2QztZQUM3QyxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztZQUVyRCxxQkFBcUI7WUFDckIsT0FBTyxJQUFJLE9BQU8sQ0FBQyxLQUFLLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFOztnQkFDM0MsSUFBSSxVQUFVLEdBQUcsRUFBRSxDQUFDO2dCQUNwQixJQUFJLE9BQU8sR0FBRyxJQUFJLFdBQVcsRUFBRSxDQUFDO2dCQUNoQyxJQUFJLE1BQU0sR0FBRyxFQUFFLENBQUM7Z0JBRWhCLElBQUksQ0FBQztvQkFDSCx1QkFBdUI7b0JBQ3ZCLGVBQWUsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRTt3QkFDcEQsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDO3dCQUNoQixPQUFPLEVBQUUsQ0FBQztvQkFDWixDQUFDLENBQUMsQ0FBQztvQkFFSCxrQkFBa0I7b0JBQ2xCLE9BQU8sSUFBSSxFQUFFLENBQUM7d0JBQ1osTUFBTSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsR0FBRyxNQUFNLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQzt3QkFFNUMsSUFBSSxJQUFJLEVBQUUsQ0FBQzs0QkFDVCxNQUFNO3dCQUNSLENBQUM7d0JBRUQsbUJBQW1CO3dCQUNuQixNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO3dCQUN0RCxNQUFNLElBQUksS0FBSyxDQUFDO3dCQUVoQiw2QkFBNkI7d0JBQzdCLE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7d0JBQ2pDLE1BQU0sR0FBRyxLQUFLLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsOENBQThDO3dCQUUxRSxLQUFLLE1BQU0sSUFBSSxJQUFJLEtBQUssRUFBRSxDQUFDOzRCQUN6QixnQ0FBZ0M7NEJBQ2hDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO2dDQUN6QyxTQUFTOzRCQUNYLENBQUM7NEJBRUQsMkJBQTJCOzRCQUMzQixJQUFJLElBQUksS0FBSyxjQUFjLEVBQUUsQ0FBQztnQ0FDNUIsU0FBUzs0QkFDWCxDQUFDOzRCQUVELGlCQUFpQjs0QkFDakIsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7Z0NBQzlCLElBQUksQ0FBQztvQ0FDSCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQ0FFM0Msd0JBQXdCO29DQUN4QixJQUFJLENBQUMsVUFBVSxJQUFJLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQzt3Q0FDM0IsVUFBVSxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUM7b0NBQ3ZCLENBQUM7b0NBRUQsZ0JBQWdCO29DQUNoQixNQUFNLEtBQUssR0FBRyxNQUFBLE1BQUEsSUFBSSxDQUFDLE9BQU8sMENBQUcsQ0FBQyxDQUFDLDBDQUFFLEtBQUssQ0FBQztvQ0FFdkMsSUFBSSxLQUFLLEVBQUUsQ0FBQzt3Q0FDVixNQUFNLGFBQWEsR0FBa0I7NENBQ25DLEVBQUUsRUFBRSxVQUFVLElBQUksUUFBUTs0Q0FDMUIsS0FBSyxFQUFFLEVBQUU7eUNBQ1YsQ0FBQzt3Q0FFRiwrQkFBK0I7d0NBQy9CLElBQUksS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDOzRDQUNsQixhQUFhLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDO3dDQUM5QyxDQUFDO3dDQUVELGlDQUFpQzt3Q0FDakMsSUFBSSxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUM7NENBQ3JCLGFBQWEsQ0FBQyxLQUFLLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUM7d0NBQ25ELENBQUM7d0NBRUQsbUNBQW1DO3dDQUNuQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7b0NBQ3pCLENBQUM7Z0NBQ0gsQ0FBQztnQ0FBQyxPQUFPLEtBQUssRUFBRSxDQUFDO29DQUNmLE9BQU8sQ0FBQyxLQUFLLENBQUMsZ0NBQWdDLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0NBQ3pELENBQUM7NEJBQ0gsQ0FBQzt3QkFDSCxDQUFDO29CQUNILENBQUM7b0JBRUQsT0FBTyxFQUFFLENBQUM7Z0JBQ1osQ0FBQztnQkFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO29CQUNmLHVCQUF1QjtvQkFDdkIsSUFBSSxlQUFlLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDO3dCQUNuQyxPQUFPLEVBQUUsQ0FBQzt3QkFDVixPQUFPO29CQUNULENBQUM7b0JBRUQsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNoQixDQUFDO1lBQ0gsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNmLHNCQUFzQjtZQUN0QixJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssWUFBWSxFQUFFLENBQUM7Z0JBQ2hDLE9BQU87WUFDVCxDQUFDO1lBRUQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxzQkFBc0IsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUM3QyxNQUFNLElBQUksS0FBSyxDQUFDLHNDQUFzQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztRQUN6RSxDQUFDO2dCQUFTLENBQUM7WUFDVCxJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksQ0FBQztRQUM5QixDQUFDO0lBQ0gsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0sscUJBQXFCLENBQUMsT0FBd0I7UUFDcEQseURBQXlEO1FBQ3pELE1BQU0sZUFBZSxHQUFRO1lBQzNCLEtBQUssRUFBRSxPQUFPLENBQUMsS0FBSztZQUNwQixRQUFRLEVBQUUsT0FBTyxDQUFDLFFBQVE7WUFDMUIsV0FBVyxFQUFFLE9BQU8sQ0FBQyxXQUFXLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxHQUFHO1lBQzFFLFVBQVUsRUFBRSxPQUFPLENBQUMsU0FBUyxJQUFJLElBQUk7WUFDckMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxNQUFNLElBQUksS0FBSztTQUNoQyxDQUFDO1FBRUYsdUJBQXVCO1FBQ3ZCLElBQUksT0FBTyxDQUFDLEtBQUssSUFBSSxPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUM5QyxlQUFlLENBQUMsS0FBSyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUM7UUFDeEMsQ0FBQztRQUVELE9BQU8sZUFBZSxDQUFDO0lBQ3pCLENBQUM7SUFFRDs7OztPQUlHO0lBQ0ssVUFBVTtRQUNoQixPQUFPO1lBQ0wsZUFBZSxFQUFFLFVBQVUsSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUN4QyxjQUFjLEVBQUUsa0JBQWtCO1NBQ25DLENBQUM7SUFDSixDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogUmVxdWVzdHkgUHJvdmlkZXIgQWRhcHRlclxyXG4gKiBcclxuICogVGhpcyBmaWxlIGltcGxlbWVudHMgdGhlIFByb3ZpZGVyQWRhcHRlciBpbnRlcmZhY2UgZm9yIHRoZSBSZXF1ZXN0eSBBUEkuXHJcbiAqIEl0IHVzZXMgT2JzaWRpYW4ncyByZXF1ZXN0VXJsIG1ldGhvZCB0byBjb21tdW5pY2F0ZSB3aXRoIHRoZSBSZXF1ZXN0eSBBUEkuXHJcbiAqL1xyXG5cclxuaW1wb3J0IHsgcmVxdWVzdFVybCwgUmVxdWVzdFVybFBhcmFtIH0gZnJvbSAnb2JzaWRpYW4nO1xyXG5pbXBvcnQgeyBcclxuICBNb2RlbEluZm8sIFxyXG4gIFByb3ZpZGVyQ2h1bmssIFxyXG4gIFByb3ZpZGVyTWVzc2FnZSwgXHJcbiAgUHJvdmlkZXJSZXF1ZXN0LCBcclxuICBQcm92aWRlclJlc3BvbnNlLFxyXG4gIENPTU1PTl9NT0RFTFNcclxufSBmcm9tICcuLi9tb2RlbHMvUHJvdmlkZXInO1xyXG5pbXBvcnQgeyBCYXNlQWRhcHRlciB9IGZyb20gJy4vQmFzZUFkYXB0ZXInO1xyXG5cclxuLyoqXHJcbiAqIEFkYXB0ZXIgZm9yIHRoZSBSZXF1ZXN0eSBBUEkuXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgUmVxdWVzdHlBZGFwdGVyIGV4dGVuZHMgQmFzZUFkYXB0ZXIge1xyXG4gIC8qKlxyXG4gICAqIFRoZSBuYW1lIG9mIHRoZSBwcm92aWRlclxyXG4gICAqL1xyXG4gIHJlYWRvbmx5IHByb3ZpZGVyID0gJ3JlcXVlc3R5JztcclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgbmV3IFJlcXVlc3R5QWRhcHRlci5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gYXBpS2V5IFRoZSBSZXF1ZXN0eSBBUEkga2V5XHJcbiAgICogQHBhcmFtIGFwaUVuZHBvaW50IE9wdGlvbmFsIGN1c3RvbSBBUEkgZW5kcG9pbnQgVVJMXHJcbiAgICovXHJcbiAgY29uc3RydWN0b3IoYXBpS2V5OiBzdHJpbmcsIGFwaUVuZHBvaW50Pzogc3RyaW5nKSB7XHJcbiAgICBzdXBlcihhcGlLZXksIGFwaUVuZHBvaW50KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgYmFzZSBVUkwgZm9yIHRoZSBSZXF1ZXN0eSBBUEkuXHJcbiAgICogXHJcbiAgICogQHJldHVybnMgVGhlIGJhc2UgVVJMXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBnZXRCYXNlVXJsKCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gdGhpcy5hcGlFbmRwb2ludCB8fCAnaHR0cHM6Ly9yb3V0ZXIucmVxdWVzdHkuYWknO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVGVzdCB0aGUgY29ubmVjdGlvbiB0byB0aGUgUmVxdWVzdHkgQVBJLlxyXG4gICAqIE1ha2VzIGEgbGlnaHR3ZWlnaHQgQVBJIGNhbGwgdG8gdmVyaWZ5IGNyZWRlbnRpYWxzLlxyXG4gICAqIFxyXG4gICAqIEByZXR1cm5zIEEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIHRydWUgaWYgdGhlIGNvbm5lY3Rpb24gaXMgc3VjY2Vzc2Z1bCwgZmFsc2Ugb3RoZXJ3aXNlXHJcbiAgICovXHJcbiAgYXN5bmMgdGVzdENvbm5lY3Rpb24oKTogUHJvbWlzZTxib29sZWFuPiB7XHJcbiAgICB0cnkge1xyXG4gICAgICB0aGlzLnZhbGlkYXRlQXBpS2V5KCk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBNYWtlIGEgbWluaW1hbCByZXF1ZXN0IHRvIHRlc3QgdGhlIGNvbm5lY3Rpb25cclxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCByZXF1ZXN0VXJsKHtcclxuICAgICAgICB1cmw6IGAke3RoaXMuZ2V0QmFzZVVybCgpfS92MS9tb2RlbHNgLFxyXG4gICAgICAgIG1ldGhvZDogJ0dFVCcsXHJcbiAgICAgICAgaGVhZGVyczogdGhpcy5nZXRIZWFkZXJzKCksXHJcbiAgICAgICAgdGhyb3c6IGZhbHNlXHJcbiAgICAgIH0pO1xyXG4gICAgICBcclxuICAgICAgcmV0dXJuIHJlc3BvbnNlLnN0YXR1cyA9PT0gMjAwO1xyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgdGhpcy5sb2dFcnJvcigndGVzdENvbm5lY3Rpb24nLCBlcnJvcik7XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIGxpc3Qgb2YgYXZhaWxhYmxlIG1vZGVscyBmcm9tIFJlcXVlc3R5LlxyXG4gICAqIFxyXG4gICAqIEByZXR1cm5zIEEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIGFuIGFycmF5IG9mIE1vZGVsSW5mbyBvYmplY3RzXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0QXZhaWxhYmxlTW9kZWxzKCk6IFByb21pc2U8TW9kZWxJbmZvW10+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIHRoaXMudmFsaWRhdGVBcGlLZXkoKTtcclxuICAgICAgXHJcbiAgICAgIC8vIFJlcXVlc3QgbW9kZWxzIGZyb20gUmVxdWVzdHkgQVBJXHJcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcmVxdWVzdFVybCh7XHJcbiAgICAgICAgdXJsOiBgJHt0aGlzLmdldEJhc2VVcmwoKX0vdjEvbW9kZWxzYCxcclxuICAgICAgICBtZXRob2Q6ICdHRVQnLFxyXG4gICAgICAgIGhlYWRlcnM6IHRoaXMuZ2V0SGVhZGVycygpLFxyXG4gICAgICAgIHRocm93OiBmYWxzZVxyXG4gICAgICB9KTtcclxuICAgICAgXHJcbiAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgIT09IDIwMCkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGdldCBtb2RlbHM6ICR7cmVzcG9uc2Uuc3RhdHVzfSAke3Jlc3BvbnNlLnRleHR9YCk7XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIC8vIFBhcnNlIHRoZSByZXNwb25zZVxyXG4gICAgICBjb25zdCBkYXRhID0gcmVzcG9uc2UuanNvbjtcclxuICAgICAgXHJcbiAgICAgIC8vIE1hcCB0byBvdXIgTW9kZWxJbmZvIGZvcm1hdFxyXG4gICAgICBpZiAoZGF0YSAmJiBkYXRhLmRhdGEgJiYgQXJyYXkuaXNBcnJheShkYXRhLmRhdGEpKSB7XHJcbiAgICAgICAgcmV0dXJuIGRhdGEuZGF0YS5tYXAoKG1vZGVsOiBhbnkpID0+IHtcclxuICAgICAgICAgIC8vIFRyeSB0byBmaW5kIHRoZSBtb2RlbCBpbiBDT01NT05fTU9ERUxTXHJcbiAgICAgICAgICBjb25zdCBwcm92aWRlck5hbWUgPSBtb2RlbC5pZC5zcGxpdCgnLycpWzBdIHx8ICd1bmtub3duJztcclxuICAgICAgICAgIGNvbnN0IG1vZGVsSWQgPSBtb2RlbC5pZC5zcGxpdCgnLycpWzFdIHx8IG1vZGVsLmlkO1xyXG4gICAgICAgICAgXHJcbiAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBpZDogbW9kZWwuaWQsXHJcbiAgICAgICAgICAgIG5hbWU6IG1vZGVsLm5hbWUgfHwgbW9kZWxJZCxcclxuICAgICAgICAgICAgcHJvdmlkZXI6IHRoaXMucHJvdmlkZXIsXHJcbiAgICAgICAgICAgIGNvbnRleHRTaXplOiBtb2RlbC5jb250ZXh0X2xlbmd0aCB8fCA0MDk2LFxyXG4gICAgICAgICAgICBzdXBwb3J0c1Rvb2xzOiBtb2RlbC5jYXBhYmlsaXRpZXM/LnRvb2xzIHx8IGZhbHNlLFxyXG4gICAgICAgICAgICBzdXBwb3J0c0pzb246IG1vZGVsLmNhcGFiaWxpdGllcz8uanNvbl9yZXNwb25zZSB8fCBmYWxzZSxcclxuICAgICAgICAgICAgbWF4T3V0cHV0VG9rZW5zOiBtb2RlbC5jYXBhYmlsaXRpZXM/Lm1heF9vdXRwdXRfdG9rZW5zIHx8IDQwOTZcclxuICAgICAgICAgIH07XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIC8vIEZhbGxiYWNrIHRvIGtub3duIG1vZGVsc1xyXG4gICAgICByZXR1cm4gW1xyXG4gICAgICAgIHtcclxuICAgICAgICAgIGlkOiAnb3BlbmFpL2dwdC00bycsXHJcbiAgICAgICAgICBuYW1lOiAnR1BULTRvICh2aWEgUmVxdWVzdHkpJyxcclxuICAgICAgICAgIHByb3ZpZGVyOiB0aGlzLnByb3ZpZGVyLFxyXG4gICAgICAgICAgY29udGV4dFNpemU6IDEyODAwMCxcclxuICAgICAgICAgIHN1cHBvcnRzVG9vbHM6IHRydWUsXHJcbiAgICAgICAgICBzdXBwb3J0c0pzb246IHRydWUsXHJcbiAgICAgICAgICBtYXhPdXRwdXRUb2tlbnM6IDQwOTZcclxuICAgICAgICB9LFxyXG4gICAgICAgIHtcclxuICAgICAgICAgIGlkOiAnYW50aHJvcGljL2NsYXVkZS0zLW9wdXMtMjAyNDAyMjknLFxyXG4gICAgICAgICAgbmFtZTogJ0NsYXVkZSAzIE9wdXMgKHZpYSBSZXF1ZXN0eSknLFxyXG4gICAgICAgICAgcHJvdmlkZXI6IHRoaXMucHJvdmlkZXIsXHJcbiAgICAgICAgICBjb250ZXh0U2l6ZTogMjAwMDAwLFxyXG4gICAgICAgICAgc3VwcG9ydHNUb29sczogdHJ1ZSxcclxuICAgICAgICAgIHN1cHBvcnRzSnNvbjogdHJ1ZSxcclxuICAgICAgICAgIG1heE91dHB1dFRva2VuczogNDA5NlxyXG4gICAgICAgIH0sXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgaWQ6ICdhbnRocm9waWMvY2xhdWRlLTMtc29ubmV0LTIwMjQwMjI5JyxcclxuICAgICAgICAgIG5hbWU6ICdDbGF1ZGUgMyBTb25uZXQgKHZpYSBSZXF1ZXN0eSknLFxyXG4gICAgICAgICAgcHJvdmlkZXI6IHRoaXMucHJvdmlkZXIsXHJcbiAgICAgICAgICBjb250ZXh0U2l6ZTogMjAwMDAwLFxyXG4gICAgICAgICAgc3VwcG9ydHNUb29sczogdHJ1ZSxcclxuICAgICAgICAgIHN1cHBvcnRzSnNvbjogdHJ1ZSxcclxuICAgICAgICAgIG1heE91dHB1dFRva2VuczogNDA5NlxyXG4gICAgICAgIH1cclxuICAgICAgXTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIHRoaXMubG9nRXJyb3IoJ2dldEF2YWlsYWJsZU1vZGVscycsIGVycm9yKTtcclxuICAgICAgLy8gUmV0dXJuIGEgZGVmYXVsdCBzZXQgb2YgbW9kZWxzXHJcbiAgICAgIHJldHVybiBbXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgaWQ6ICdvcGVuYWkvZ3B0LTRvJyxcclxuICAgICAgICAgIG5hbWU6ICdHUFQtNG8gKHZpYSBSZXF1ZXN0eSknLFxyXG4gICAgICAgICAgcHJvdmlkZXI6IHRoaXMucHJvdmlkZXIsXHJcbiAgICAgICAgICBjb250ZXh0U2l6ZTogMTI4MDAwLFxyXG4gICAgICAgICAgc3VwcG9ydHNUb29sczogdHJ1ZSxcclxuICAgICAgICAgIHN1cHBvcnRzSnNvbjogdHJ1ZSxcclxuICAgICAgICAgIG1heE91dHB1dFRva2VuczogNDA5NlxyXG4gICAgICAgIH0sXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgaWQ6ICdhbnRocm9waWMvY2xhdWRlLTMtb3B1cy0yMDI0MDIyOScsXHJcbiAgICAgICAgICBuYW1lOiAnQ2xhdWRlIDMgT3B1cyAodmlhIFJlcXVlc3R5KScsXHJcbiAgICAgICAgICBwcm92aWRlcjogdGhpcy5wcm92aWRlcixcclxuICAgICAgICAgIGNvbnRleHRTaXplOiAyMDAwMDAsXHJcbiAgICAgICAgICBzdXBwb3J0c1Rvb2xzOiB0cnVlLFxyXG4gICAgICAgICAgc3VwcG9ydHNKc29uOiB0cnVlLFxyXG4gICAgICAgICAgbWF4T3V0cHV0VG9rZW5zOiA0MDk2XHJcbiAgICAgICAgfVxyXG4gICAgICBdO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2VuZCBhIHJlcXVlc3QgdG8gdGhlIFJlcXVlc3R5IEFQSSBhbmQgZ2V0IGEgY29tcGxldGUgcmVzcG9uc2UuXHJcbiAgICogXHJcbiAgICogQHBhcmFtIHJlcXVlc3QgVGhlIHJlcXVlc3QgcGFyYW1ldGVyc1xyXG4gICAqIEByZXR1cm5zIEEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIGEgUHJvdmlkZXJSZXNwb25zZVxyXG4gICAqL1xyXG4gIGFzeW5jIHNlbmRSZXF1ZXN0KHJlcXVlc3Q6IFByb3ZpZGVyUmVxdWVzdCk6IFByb21pc2U8UHJvdmlkZXJSZXNwb25zZT4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgdGhpcy52YWxpZGF0ZUFwaUtleSgpO1xyXG4gICAgICBcclxuICAgICAgLy8gQ3JlYXRlIHRoZSBSZXF1ZXN0eSByZXF1ZXN0XHJcbiAgICAgIGNvbnN0IHJlcXVlc3R5UmVxdWVzdCA9IHRoaXMuY3JlYXRlUmVxdWVzdHlSZXF1ZXN0KHJlcXVlc3QpO1xyXG4gICAgICBcclxuICAgICAgLy8gU2VuZCB0aGUgcmVxdWVzdFxyXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHJlcXVlc3RVcmwoe1xyXG4gICAgICAgIHVybDogYCR7dGhpcy5nZXRCYXNlVXJsKCl9L3YxL2NoYXQvY29tcGxldGlvbnNgLFxyXG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxyXG4gICAgICAgIGhlYWRlcnM6IHRoaXMuZ2V0SGVhZGVycygpLFxyXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlcXVlc3R5UmVxdWVzdCksXHJcbiAgICAgICAgdGhyb3c6IGZhbHNlXHJcbiAgICAgIH0pO1xyXG4gICAgICBcclxuICAgICAgaWYgKHJlc3BvbnNlLnN0YXR1cyAhPT0gMjAwKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBSZXF1ZXN0IGZhaWxlZDogJHtyZXNwb25zZS5zdGF0dXN9ICR7cmVzcG9uc2UudGV4dH1gKTtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgY29uc3QgZGF0YSA9IHJlc3BvbnNlLmpzb247XHJcbiAgICAgIFxyXG4gICAgICAvLyBDb252ZXJ0IHRoZSByZXNwb25zZSB0byBvdXIgZm9ybWF0XHJcbiAgICAgIGNvbnN0IHByb3ZpZGVyUmVzcG9uc2U6IFByb3ZpZGVyUmVzcG9uc2UgPSB7XHJcbiAgICAgICAgaWQ6IGRhdGEuaWQgfHwgJ3JlcXVlc3R5LXJlc3BvbnNlJyxcclxuICAgICAgICBtZXNzYWdlOiB7XHJcbiAgICAgICAgICByb2xlOiAnYXNzaXN0YW50JyxcclxuICAgICAgICAgIGNvbnRlbnQ6IGRhdGEuY2hvaWNlcz8uWzBdPy5tZXNzYWdlPy5jb250ZW50IHx8ICcnXHJcbiAgICAgICAgfVxyXG4gICAgICB9O1xyXG4gICAgICBcclxuICAgICAgLy8gQWRkIHRvb2wgY2FsbHMgaWYgcHJlc2VudFxyXG4gICAgICBpZiAoZGF0YS5jaG9pY2VzPy5bMF0/Lm1lc3NhZ2U/LnRvb2xfY2FsbHMpIHtcclxuICAgICAgICBwcm92aWRlclJlc3BvbnNlLnRvb2xDYWxscyA9IGRhdGEuY2hvaWNlc1swXS5tZXNzYWdlLnRvb2xfY2FsbHMubWFwKCh0b29sQ2FsbDogYW55KSA9PiAoe1xyXG4gICAgICAgICAgaWQ6IHRvb2xDYWxsLmlkLFxyXG4gICAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcclxuICAgICAgICAgIGZ1bmN0aW9uOiB7XHJcbiAgICAgICAgICAgIG5hbWU6IHRvb2xDYWxsLmZ1bmN0aW9uLm5hbWUsXHJcbiAgICAgICAgICAgIGFyZ3VtZW50czogdG9vbENhbGwuZnVuY3Rpb24uYXJndW1lbnRzXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSkpO1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICByZXR1cm4gcHJvdmlkZXJSZXNwb25zZTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIHRoaXMubG9nRXJyb3IoJ3NlbmRSZXF1ZXN0JywgZXJyb3IpO1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFJlcXVlc3R5IHJlcXVlc3QgZmFpbGVkOiAke2Vycm9yLm1lc3NhZ2V9YCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZW5kIGEgc3RyZWFtaW5nIHJlcXVlc3QgdG8gdGhlIFJlcXVlc3R5IEFQSS5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gcmVxdWVzdCBUaGUgcmVxdWVzdCBwYXJhbWV0ZXJzIChzaG91bGQgaGF2ZSBzdHJlYW06IHRydWUpXHJcbiAgICogQHBhcmFtIG9uQ2h1bmsgQ2FsbGJhY2sgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGNhbGxlZCBmb3IgZWFjaCBjaHVuayByZWNlaXZlZFxyXG4gICAqIEByZXR1cm5zIEEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdoZW4gdGhlIHN0cmVhbSBpcyBjb21wbGV0ZVxyXG4gICAqL1xyXG4gIGFzeW5jIHNlbmRTdHJlYW1pbmdSZXF1ZXN0KFxyXG4gICAgcmVxdWVzdDogUHJvdmlkZXJSZXF1ZXN0LFxyXG4gICAgb25DaHVuazogKGNodW5rOiBQcm92aWRlckNodW5rKSA9PiB2b2lkXHJcbiAgKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICB0cnkge1xyXG4gICAgICB0aGlzLnZhbGlkYXRlQXBpS2V5KCk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBFbnN1cmUgc3RyZWFtIGlzIHRydWVcclxuICAgICAgcmVxdWVzdC5zdHJlYW0gPSB0cnVlO1xyXG4gICAgICBcclxuICAgICAgLy8gQ3JlYXRlIHRoZSBSZXF1ZXN0eSByZXF1ZXN0XHJcbiAgICAgIGNvbnN0IHJlcXVlc3R5UmVxdWVzdCA9IHRoaXMuY3JlYXRlUmVxdWVzdHlSZXF1ZXN0KHJlcXVlc3QpO1xyXG4gICAgICBcclxuICAgICAgLy8gRm9yIHN0cmVhbWluZywgd2UgbmVlZCB0byB1c2UgYSBkaWZmZXJlbnQgYXBwcm9hY2ggc2luY2UgRXZlbnRTb3VyY2UgZG9lc24ndCBzdXBwb3J0IFBPU1RcclxuICAgICAgLy8gV2UnbGwgdXNlIGZldGNoIHdpdGggUmVhZGFibGVTdHJlYW0gaW5zdGVhZFxyXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGAke3RoaXMuZ2V0QmFzZVVybCgpfS92MS9jaGF0L2NvbXBsZXRpb25zYCwge1xyXG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxyXG4gICAgICAgIGhlYWRlcnM6IHRoaXMuZ2V0SGVhZGVycygpLFxyXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlcXVlc3R5UmVxdWVzdClcclxuICAgICAgfSk7XHJcbiAgICAgIFxyXG4gICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTdHJlYW1pbmcgcmVxdWVzdCBmYWlsZWQ6ICR7cmVzcG9uc2Uuc3RhdHVzfSAke3Jlc3BvbnNlLnN0YXR1c1RleHR9YCk7XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIGNvbnN0IHJlYWRlciA9IHJlc3BvbnNlLmJvZHk/LmdldFJlYWRlcigpO1xyXG4gICAgICBpZiAoIXJlYWRlcikge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignUmVzcG9uc2UgYm9keSBpcyBub3QgcmVhZGFibGUnKTtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgLy8gQ3JlYXRlIGFuIEFib3J0Q29udHJvbGxlciBmb3IgdGhpcyByZXF1ZXN0XHJcbiAgICAgIGNvbnN0IGFib3J0Q29udHJvbGxlciA9IHRoaXMuY3JlYXRlQWJvcnRDb250cm9sbGVyKCk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBQcm9jZXNzIHRoZSBzdHJlYW1cclxuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGFzeW5jIChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICBsZXQgcmVzcG9uc2VJZCA9ICcnO1xyXG4gICAgICAgIGxldCBkZWNvZGVyID0gbmV3IFRleHREZWNvZGVyKCk7XHJcbiAgICAgICAgbGV0IGJ1ZmZlciA9ICcnO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAvLyBTZXQgdXAgYWJvcnQgaGFuZGxlclxyXG4gICAgICAgICAgYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKCdhYm9ydCcsICgpID0+IHtcclxuICAgICAgICAgICAgcmVhZGVyLmNhbmNlbCgpO1xyXG4gICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICAgIFxyXG4gICAgICAgICAgLy8gUmVhZCB0aGUgc3RyZWFtXHJcbiAgICAgICAgICB3aGlsZSAodHJ1ZSkge1xyXG4gICAgICAgICAgICBjb25zdCB7IGRvbmUsIHZhbHVlIH0gPSBhd2FpdCByZWFkZXIucmVhZCgpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKGRvbmUpIHtcclxuICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gRGVjb2RlIHRoZSBjaHVua1xyXG4gICAgICAgICAgICBjb25zdCBjaHVuayA9IGRlY29kZXIuZGVjb2RlKHZhbHVlLCB7IHN0cmVhbTogdHJ1ZSB9KTtcclxuICAgICAgICAgICAgYnVmZmVyICs9IGNodW5rO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gUHJvY2VzcyBhbnkgY29tcGxldGUgbGluZXNcclxuICAgICAgICAgICAgY29uc3QgbGluZXMgPSBidWZmZXIuc3BsaXQoJ1xcbicpO1xyXG4gICAgICAgICAgICBidWZmZXIgPSBsaW5lcy5wb3AoKSB8fCAnJzsgLy8gS2VlcCB0aGUgbGFzdCBpbmNvbXBsZXRlIGxpbmUgaW4gdGhlIGJ1ZmZlclxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XHJcbiAgICAgICAgICAgICAgLy8gU2tpcCBlbXB0eSBsaW5lcyBhbmQgY29tbWVudHNcclxuICAgICAgICAgICAgICBpZiAoIWxpbmUudHJpbSgpIHx8IGxpbmUuc3RhcnRzV2l0aCgnOicpKSB7XHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIFtET05FXSBtZXNzYWdlXHJcbiAgICAgICAgICAgICAgaWYgKGxpbmUgPT09ICdkYXRhOiBbRE9ORV0nKSB7XHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgLy8gUGFyc2UgdGhlIGRhdGFcclxuICAgICAgICAgICAgICBpZiAobGluZS5zdGFydHNXaXRoKCdkYXRhOiAnKSkge1xyXG4gICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgY29uc3QgZGF0YSA9IEpTT04ucGFyc2UobGluZS5zdWJzdHJpbmcoNikpO1xyXG4gICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgLy8gU3RvcmUgdGhlIHJlc3BvbnNlIElEXHJcbiAgICAgICAgICAgICAgICAgIGlmICghcmVzcG9uc2VJZCAmJiBkYXRhLmlkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2VJZCA9IGRhdGEuaWQ7XHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgIC8vIFByb2Nlc3MgZGVsdGFcclxuICAgICAgICAgICAgICAgICAgY29uc3QgZGVsdGEgPSBkYXRhLmNob2ljZXM/LlswXT8uZGVsdGE7XHJcbiAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICBpZiAoZGVsdGEpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBwcm92aWRlckNodW5rOiBQcm92aWRlckNodW5rID0ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgaWQ6IHJlc3BvbnNlSWQgfHwgJ3N0cmVhbScsXHJcbiAgICAgICAgICAgICAgICAgICAgICBkZWx0YToge31cclxuICAgICAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIC8vIEFkZCBjb250ZW50IGRlbHRhIGlmIHByZXNlbnRcclxuICAgICAgICAgICAgICAgICAgICBpZiAoZGVsdGEuY29udGVudCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgcHJvdmlkZXJDaHVuay5kZWx0YS5jb250ZW50ID0gZGVsdGEuY29udGVudDtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gQWRkIHRvb2wgY2FsbCBkZWx0YSBpZiBwcmVzZW50XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRlbHRhLnRvb2xfY2FsbHMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgIHByb3ZpZGVyQ2h1bmsuZGVsdGEudG9vbENhbGxzID0gZGVsdGEudG9vbF9jYWxscztcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gQ2FsbCB0aGUgY2FsbGJhY2sgd2l0aCB0aGUgY2h1bmtcclxuICAgICAgICAgICAgICAgICAgICBvbkNodW5rKHByb3ZpZGVyQ2h1bmspO1xyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBwcm9jZXNzaW5nIHN0cmVhbSBjaHVuazonLCBlcnJvcik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBcclxuICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgLy8gSWdub3JlIGlmIHdlIGFib3J0ZWRcclxuICAgICAgICAgIGlmIChhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHtcclxuICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBcclxuICAgICAgICAgIHJlamVjdChlcnJvcik7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIC8vIElnbm9yZSBhYm9ydCBlcnJvcnNcclxuICAgICAgaWYgKGVycm9yLm5hbWUgPT09ICdBYm9ydEVycm9yJykge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgdGhpcy5sb2dFcnJvcignc2VuZFN0cmVhbWluZ1JlcXVlc3QnLCBlcnJvcik7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihgUmVxdWVzdHkgc3RyZWFtaW5nIHJlcXVlc3QgZmFpbGVkOiAke2Vycm9yLm1lc3NhZ2V9YCk7XHJcbiAgICB9IGZpbmFsbHkge1xyXG4gICAgICB0aGlzLmFib3J0Q29udHJvbGxlciA9IG51bGw7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSBSZXF1ZXN0eSByZXF1ZXN0IGZyb20gb3VyIGNvbW1vbiByZXF1ZXN0IGZvcm1hdC5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gcmVxdWVzdCBPdXIgY29tbW9uIHJlcXVlc3QgZm9ybWF0XHJcbiAgICogQHJldHVybnMgUmVxdWVzdHkgcmVxdWVzdCBmb3JtYXRcclxuICAgKi9cclxuICBwcml2YXRlIGNyZWF0ZVJlcXVlc3R5UmVxdWVzdChyZXF1ZXN0OiBQcm92aWRlclJlcXVlc3QpOiBhbnkge1xyXG4gICAgLy8gQ3JlYXRlIHRoZSBSZXF1ZXN0eSByZXF1ZXN0IChPcGVuQUktY29tcGF0aWJsZSBmb3JtYXQpXHJcbiAgICBjb25zdCByZXF1ZXN0eVJlcXVlc3Q6IGFueSA9IHtcclxuICAgICAgbW9kZWw6IHJlcXVlc3QubW9kZWwsXHJcbiAgICAgIG1lc3NhZ2VzOiByZXF1ZXN0Lm1lc3NhZ2VzLFxyXG4gICAgICB0ZW1wZXJhdHVyZTogcmVxdWVzdC50ZW1wZXJhdHVyZSAhPT0gdW5kZWZpbmVkID8gcmVxdWVzdC50ZW1wZXJhdHVyZSA6IDAuNyxcclxuICAgICAgbWF4X3Rva2VuczogcmVxdWVzdC5tYXhUb2tlbnMgfHwgNDA5NixcclxuICAgICAgc3RyZWFtOiByZXF1ZXN0LnN0cmVhbSB8fCBmYWxzZVxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLy8gQWRkIHRvb2xzIGlmIHByZXNlbnRcclxuICAgIGlmIChyZXF1ZXN0LnRvb2xzICYmIHJlcXVlc3QudG9vbHMubGVuZ3RoID4gMCkge1xyXG4gICAgICByZXF1ZXN0eVJlcXVlc3QudG9vbHMgPSByZXF1ZXN0LnRvb2xzO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gcmVxdWVzdHlSZXF1ZXN0O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBoZWFkZXJzIGZvciBSZXF1ZXN0eSBBUEkgcmVxdWVzdHMuXHJcbiAgICogXHJcbiAgICogQHJldHVybnMgVGhlIGhlYWRlcnMgb2JqZWN0XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBnZXRIZWFkZXJzKCk6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4ge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgJ0F1dGhvcml6YXRpb24nOiBgQmVhcmVyICR7dGhpcy5hcGlLZXl9YCxcclxuICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ1xyXG4gICAgfTtcclxuICB9XHJcbn1cclxuIl19