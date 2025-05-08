/**
 * OpenRouter Provider Adapter
 *
 * This file implements the ProviderAdapter interface for the OpenRouter API.
 * It uses Obsidian's requestUrl method to communicate with the OpenRouter API.
 */
import { requestUrl } from 'obsidian';
import { BaseAdapter } from './BaseAdapter';
/**
 * Adapter for the OpenRouter API.
 */
export class OpenRouterAdapter extends BaseAdapter {
    /**
     * Create a new OpenRouterAdapter.
     *
     * @param apiKey The OpenRouter API key
     * @param apiEndpoint Optional custom API endpoint URL
     */
    constructor(apiKey, apiEndpoint) {
        super(apiKey, apiEndpoint);
        /**
         * The name of the provider
         */
        this.provider = 'openrouter';
    }
    /**
     * Get the base URL for the OpenRouter API.
     *
     * @returns The base URL
     */
    getBaseUrl() {
        return this.apiEndpoint || 'https://openrouter.ai/api/v1';
    }
    /**
     * Test the connection to the OpenRouter API.
     * Makes a lightweight API call to verify credentials.
     *
     * @returns A promise that resolves to true if the connection is successful, false otherwise
     */
    async testConnection() {
        try {
            this.validateApiKey();
            // Make a minimal request to test the connection
            const response = await requestUrl({
                url: `${this.getBaseUrl()}/models`,
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
     * Get a list of available models from OpenRouter.
     *
     * @returns A promise that resolves to an array of ModelInfo objects
     */
    async getAvailableModels() {
        try {
            this.validateApiKey();
            // Request models from OpenRouter API
            const response = await requestUrl({
                url: `${this.getBaseUrl()}/models`,
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
                    // Extract provider and model name
                    const providerName = model.id.split('/')[0] || 'unknown';
                    const modelId = model.id.split('/')[1] || model.id;
                    return {
                        id: model.id,
                        name: model.name || `${providerName} ${modelId}`,
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
                    id: 'anthropic/claude-3-opus-20240229',
                    name: 'Claude 3 Opus (via OpenRouter)',
                    provider: this.provider,
                    contextSize: 200000,
                    supportsTools: true,
                    supportsJson: true,
                    maxOutputTokens: 4096
                },
                {
                    id: 'anthropic/claude-3-sonnet-20240229',
                    name: 'Claude 3 Sonnet (via OpenRouter)',
                    provider: this.provider,
                    contextSize: 200000,
                    supportsTools: true,
                    supportsJson: true,
                    maxOutputTokens: 4096
                },
                {
                    id: 'anthropic/claude-3-haiku-20240307',
                    name: 'Claude 3 Haiku (via OpenRouter)',
                    provider: this.provider,
                    contextSize: 200000,
                    supportsTools: true,
                    supportsJson: true,
                    maxOutputTokens: 4096
                },
                {
                    id: 'openai/gpt-4o',
                    name: 'GPT-4o (via OpenRouter)',
                    provider: this.provider,
                    contextSize: 128000,
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
                    id: 'anthropic/claude-3-opus-20240229',
                    name: 'Claude 3 Opus (via OpenRouter)',
                    provider: this.provider,
                    contextSize: 200000,
                    supportsTools: true,
                    supportsJson: true,
                    maxOutputTokens: 4096
                },
                {
                    id: 'openai/gpt-4o',
                    name: 'GPT-4o (via OpenRouter)',
                    provider: this.provider,
                    contextSize: 128000,
                    supportsTools: true,
                    supportsJson: true,
                    maxOutputTokens: 4096
                }
            ];
        }
    }
    /**
     * Send a request to the OpenRouter API and get a complete response.
     *
     * @param request The request parameters
     * @returns A promise that resolves to a ProviderResponse
     */
    async sendRequest(request) {
        var _a, _b, _c, _d, _e, _f;
        try {
            this.validateApiKey();
            // Create the OpenRouter request
            const openRouterRequest = this.createOpenRouterRequest(request);
            // Send the request
            const response = await requestUrl({
                url: `${this.getBaseUrl()}/chat/completions`,
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(openRouterRequest),
                throw: false
            });
            if (response.status !== 200) {
                throw new Error(`Request failed: ${response.status} ${response.text}`);
            }
            const data = response.json;
            // Convert the response to our format
            const providerResponse = {
                id: data.id || 'openrouter-response',
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
            throw new Error(`OpenRouter request failed: ${error.message}`);
        }
    }
    /**
     * Send a streaming request to the OpenRouter API.
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
            // Create the OpenRouter request
            const openRouterRequest = this.createOpenRouterRequest(request);
            // For streaming, we need to use fetch with ReadableStream
            const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(openRouterRequest)
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
                                            providerChunk.delta.toolCalls = delta.tool_calls.map((toolCall) => {
                                                var _a, _b;
                                                return ({
                                                    id: toolCall.id,
                                                    type: 'function',
                                                    function: {
                                                        name: (_a = toolCall.function) === null || _a === void 0 ? void 0 : _a.name,
                                                        arguments: (_b = toolCall.function) === null || _b === void 0 ? void 0 : _b.arguments
                                                    }
                                                });
                                            });
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
            throw new Error(`OpenRouter streaming request failed: ${error.message}`);
        }
        finally {
            this.abortController = null;
        }
    }
    /**
     * Create an OpenRouter request from our common request format.
     *
     * @param request Our common request format
     * @returns OpenRouter request format
     */
    createOpenRouterRequest(request) {
        // Create the OpenRouter request (OpenAI-compatible format)
        const openRouterRequest = {
            model: request.model,
            messages: request.messages,
            temperature: request.temperature !== undefined ? request.temperature : 0.7,
            max_tokens: request.maxTokens || 4096,
            stream: request.stream || false
        };
        // Add tools if present
        if (request.tools && request.tools.length > 0) {
            openRouterRequest.tools = request.tools;
        }
        return openRouterRequest;
    }
    /**
     * Get the headers for OpenRouter API requests.
     *
     * @returns The headers object
     */
    getHeaders() {
        return {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/synaptic-labs/chatsidian',
            'X-Title': 'Obsidian Chatsidian Plugin'
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiT3BlblJvdXRlckFkYXB0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJPcGVuUm91dGVyQWRhcHRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7R0FLRztBQUVILE9BQU8sRUFBRSxVQUFVLEVBQW1CLE1BQU0sVUFBVSxDQUFDO0FBU3ZELE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFFNUM7O0dBRUc7QUFDSCxNQUFNLE9BQU8saUJBQWtCLFNBQVEsV0FBVztJQU1oRDs7Ozs7T0FLRztJQUNILFlBQVksTUFBYyxFQUFFLFdBQW9CO1FBQzlDLEtBQUssQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFaN0I7O1dBRUc7UUFDTSxhQUFRLEdBQUcsWUFBWSxDQUFDO0lBVWpDLENBQUM7SUFFRDs7OztPQUlHO0lBQ0ssVUFBVTtRQUNoQixPQUFPLElBQUksQ0FBQyxXQUFXLElBQUksOEJBQThCLENBQUM7SUFDNUQsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0gsS0FBSyxDQUFDLGNBQWM7UUFDbEIsSUFBSSxDQUFDO1lBQ0gsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBRXRCLGdEQUFnRDtZQUNoRCxNQUFNLFFBQVEsR0FBRyxNQUFNLFVBQVUsQ0FBQztnQkFDaEMsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLFVBQVUsRUFBRSxTQUFTO2dCQUNsQyxNQUFNLEVBQUUsS0FBSztnQkFDYixPQUFPLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRTtnQkFDMUIsS0FBSyxFQUFFLEtBQUs7YUFDYixDQUFDLENBQUM7WUFFSCxPQUFPLFFBQVEsQ0FBQyxNQUFNLEtBQUssR0FBRyxDQUFDO1FBQ2pDLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsSUFBSSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUN2QyxPQUFPLEtBQUssQ0FBQztRQUNmLENBQUM7SUFDSCxD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OlsiLyoqXHJcbiAqIE9wZW5Sb3V0ZXIgUHJvdmlkZXIgQWRhcHRlclxyXG4gKiBcclxuICogVGhpcyBmaWxlIGltcGxlbWVudHMgdGhlIFByb3ZpZGVyQWRhcHRlciBpbnRlcmZhY2UgZm9yIHRoZSBPcGVuUm91dGVyIEFQSS5cclxuICogSXQgdXNlcyBPYnNpZGlhbidzIHJlcXVlc3RVcmwgbWV0aG9kIHRvIGNvbW11bmljYXRlIHdpdGggdGhlIE9wZW5Sb3V0ZXIgQVBJLlxyXG4gKi9cclxuXHJcbmltcG9ydCB7IHJlcXVlc3RVcmwsIFJlcXVlc3RVcmxQYXJhbSB9IGZyb20gJ29ic2lkaWFuJztcclxuaW1wb3J0IHsgXHJcbiAgTW9kZWxJbmZvLCBcclxuICBQcm92aWRlckNodW5rLCBcclxuICBQcm92aWRlck1lc3NhZ2UsIFxyXG4gIFByb3ZpZGVyUmVxdWVzdCwgXHJcbiAgUHJvdmlkZXJSZXNwb25zZSxcclxuICBDT01NT05fTU9ERUxTXHJcbn0gZnJvbSAnLi4vbW9kZWxzL1Byb3ZpZGVyJztcclxuaW1wb3J0IHsgQmFzZUFkYXB0ZXIgfSBmcm9tICcuL0Jhc2VBZGFwdGVyJztcclxuXHJcbi8qKlxyXG4gKiBBZGFwdGVyIGZvciB0aGUgT3BlblJvdXRlciBBUEkuXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgT3BlblJvdXRlckFkYXB0ZXIgZXh0ZW5kcyBCYXNlQWRhcHRlciB7XHJcbiAgLyoqXHJcbiAgICogVGhlIG5hbWUgb2YgdGhlIHByb3ZpZGVyXHJcbiAgICovXHJcbiAgcmVhZG9ubHkgcHJvdmlkZXIgPSAnb3BlbnJvdXRlcic7XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIG5ldyBPcGVuUm91dGVyQWRhcHRlci5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gYXBpS2V5IFRoZSBPcGVuUm91dGVyIEFQSSBrZXlcclxuICAgKiBAcGFyYW0gYXBpRW5kcG9pbnQgT3B0aW9uYWwgY3VzdG9tIEFQSSBlbmRwb2ludCBVUkxcclxuICAgKi9cclxuICBjb25zdHJ1Y3RvcihhcGlLZXk6IHN0cmluZywgYXBpRW5kcG9pbnQ/OiBzdHJpbmcpIHtcclxuICAgIHN1cGVyKGFwaUtleSwgYXBpRW5kcG9pbnQpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBiYXNlIFVSTCBmb3IgdGhlIE9wZW5Sb3V0ZXIgQVBJLlxyXG4gICAqIFxyXG4gICAqIEByZXR1cm5zIFRoZSBiYXNlIFVSTFxyXG4gICAqL1xyXG4gIHByaXZhdGUgZ2V0QmFzZVVybCgpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIHRoaXMuYXBpRW5kcG9pbnQgfHwgJ2h0dHBzOi8vb3BlbnJvdXRlci5haS9hcGkvdjEnO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVGVzdCB0aGUgY29ubmVjdGlvbiB0byB0aGUgT3BlblJvdXRlciBBUEkuXHJcbiAgICogTWFrZXMgYSBsaWdodHdlaWdodCBBUEkgY2FsbCB0byB2ZXJpZnkgY3JlZGVudGlhbHMuXHJcbiAgICogXHJcbiAgICogQHJldHVybnMgQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gdHJ1ZSBpZiB0aGUgY29ubmVjdGlvbiBpcyBzdWNjZXNzZnVsLCBmYWxzZSBvdGhlcndpc2VcclxuICAgKi9cclxuICBhc3luYyB0ZXN0Q29ubmVjdGlvbigpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIHRoaXMudmFsaWRhdGVBcGlLZXkoKTtcclxuICAgICAgXHJcbiAgICAgIC8vIE1ha2UgYSBtaW5pbWFsIHJlcXVlc3QgdG8gdGVzdCB0aGUgY29ubmVjdGlvblxyXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHJlcXVlc3RVcmwoe1xyXG4gICAgICAgIHVybDogYCR7dGhpcy5nZXRCYXNlVXJsKCl9L21vZGVsc2AsXHJcbiAgICAgICAgbWV0aG9kOiAnR0VUJyxcclxuICAgICAgICBoZWFkZXJzOiB0aGlzLmdldEhlYWRlcnMoKSxcclxuICAgICAgICB0aHJvdzogZmFsc2VcclxuICAgICAgfSk7XHJcbiAgICAgIFxyXG4gICAgICByZXR1cm4gcmVzcG9uc2Uuc3RhdHVzID09PSAyMDA7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICB0aGlzLmxvZ0Vycm9yKCd0ZXN0Q29ubmVjdGlvbicsIGVycm9yKTtcclxuICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgbGlzdCBvZiBhdmFpbGFibGUgbW9kZWxzIGZyb20gT3BlblJvdXRlci5cclxuICAgKiBcclxuICAgKiBAcmV0dXJucyBBIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byBhbiBhcnJheSBvZiBNb2RlbEluZm8gb2JqZWN0c1xyXG4gICAqL1xyXG4gIGFzeW5jIGdldEF2YWlsYWJsZU1vZGVscygpOiBQcm9taXNlPE1vZGVsSW5mb1tdPiB7XHJcbiAgICB0cnkge1xyXG4gICAgICB0aGlzLnZhbGlkYXRlQXBpS2V5KCk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBSZXF1ZXN0IG1vZGVscyBmcm9tIE9wZW5Sb3V0ZXIgQVBJXHJcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcmVxdWVzdFVybCh7XHJcbiAgICAgICAgdXJsOiBgJHt0aGlzLmdldEJhc2VVcmwoKX0vbW9kZWxzYCxcclxuICAgICAgICBtZXRob2Q6ICdHRVQnLFxyXG4gICAgICAgIGhlYWRlcnM6IHRoaXMuZ2V0SGVhZGVycygpLFxyXG4gICAgICAgIHRocm93OiBmYWxzZVxyXG4gICAgICB9KTtcclxuICAgICAgXHJcbiAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgIT09IDIwMCkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGdldCBtb2RlbHM6ICR7cmVzcG9uc2Uuc3RhdHVzfSAke3Jlc3BvbnNlLnRleHR9YCk7XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIC8vIFBhcnNlIHRoZSByZXNwb25zZVxyXG4gICAgICBjb25zdCBkYXRhID0gcmVzcG9uc2UuanNvbjtcclxuICAgICAgXHJcbiAgICAgIC8vIE1hcCB0byBvdXIgTW9kZWxJbmZvIGZvcm1hdFxyXG4gICAgICBpZiAoZGF0YSAmJiBkYXRhLmRhdGEgJiYgQXJyYXkuaXNBcnJheShkYXRhLmRhdGEpKSB7XHJcbiAgICAgICAgcmV0dXJuIGRhdGEuZGF0YS5tYXAoKG1vZGVsOiBhbnkpID0+IHtcclxuICAgICAgICAgIC8vIEV4dHJhY3QgcHJvdmlkZXIgYW5kIG1vZGVsIG5hbWVcclxuICAgICAgICAgIGNvbnN0IHByb3ZpZGVyTmFtZSA9IG1vZGVsLmlkLnNwbGl0KCcvJylbMF0gfHwgJ3Vua25vd24nO1xyXG4gICAgICAgICAgY29uc3QgbW9kZWxJZCA9IG1vZGVsLmlkLnNwbGl0KCcvJylbMV0gfHwgbW9kZWwuaWQ7XHJcbiAgICAgICAgICBcclxuICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGlkOiBtb2RlbC5pZCxcclxuICAgICAgICAgICAgbmFtZTogbW9kZWwubmFtZSB8fCBgJHtwcm92aWRlck5hbWV9ICR7bW9kZWxJZH1gLFxyXG4gICAgICAgICAgICBwcm92aWRlcjogdGhpcy5wcm92aWRlcixcclxuICAgICAgICAgICAgY29udGV4dFNpemU6IG1vZGVsLmNvbnRleHRfbGVuZ3RoIHx8IDQwOTYsXHJcbiAgICAgICAgICAgIHN1cHBvcnRzVG9vbHM6IG1vZGVsLmNhcGFiaWxpdGllcz8udG9vbHMgfHwgZmFsc2UsXHJcbiAgICAgICAgICAgIHN1cHBvcnRzSnNvbjogbW9kZWwuY2FwYWJpbGl0aWVzPy5qc29uX3Jlc3BvbnNlIHx8IGZhbHNlLFxyXG4gICAgICAgICAgICBtYXhPdXRwdXRUb2tlbnM6IG1vZGVsLmNhcGFiaWxpdGllcz8ubWF4X291dHB1dF90b2tlbnMgfHwgNDA5NlxyXG4gICAgICAgICAgfTtcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgLy8gRmFsbGJhY2sgdG8ga25vd24gbW9kZWxzXHJcbiAgICAgIHJldHVybiBbXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgaWQ6ICdhbnRocm9waWMvY2xhdWRlLTMtb3B1cy0yMDI0MDIyOScsXHJcbiAgICAgICAgICBuYW1lOiAnQ2xhdWRlIDMgT3B1cyAodmlhIE9wZW5Sb3V0ZXIpJyxcclxuICAgICAgICAgIHByb3ZpZGVyOiB0aGlzLnByb3ZpZGVyLFxyXG4gICAgICAgICAgY29udGV4dFNpemU6IDIwMDAwMCxcclxuICAgICAgICAgIHN1cHBvcnRzVG9vbHM6IHRydWUsXHJcbiAgICAgICAgICBzdXBwb3J0c0pzb246IHRydWUsXHJcbiAgICAgICAgICBtYXhPdXRwdXRUb2tlbnM6IDQwOTZcclxuICAgICAgICB9LFxyXG4gICAgICAgIHtcclxuICAgICAgICAgIGlkOiAnYW50aHJvcGljL2NsYXVkZS0zLXNvbm5ldC0yMDI0MDIyOScsXHJcbiAgICAgICAgICBuYW1lOiAnQ2xhdWRlIDMgU29ubmV0ICh2aWEgT3BlblJvdXRlciknLFxyXG4gICAgICAgICAgcHJvdmlkZXI6IHRoaXMucHJvdmlkZXIsXHJcbiAgICAgICAgICBjb250ZXh0U2l6ZTogMjAwMDAwLFxyXG4gICAgICAgICAgc3VwcG9ydHNUb29sczogdHJ1ZSxcclxuICAgICAgICAgIHN1cHBvcnRzSnNvbjogdHJ1ZSxcclxuICAgICAgICAgIG1heE91dHB1dFRva2VuczogNDA5NlxyXG4gICAgICAgIH0sXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgaWQ6ICdhbnRocm9waWMvY2xhdWRlLTMtaGFpa3UtMjAyNDAzMDcnLFxyXG4gICAgICAgICAgbmFtZTogJ0NsYXVkZSAzIEhhaWt1ICh2aWEgT3BlblJvdXRlciknLFxyXG4gICAgICAgICAgcHJvdmlkZXI6IHRoaXMucHJvdmlkZXIsXHJcbiAgICAgICAgICBjb250ZXh0U2l6ZTogMjAwMDAwLFxyXG4gICAgICAgICAgc3VwcG9ydHNUb29sczogdHJ1ZSxcclxuICAgICAgICAgIHN1cHBvcnRzSnNvbjogdHJ1ZSxcclxuICAgICAgICAgIG1heE91dHB1dFRva2VuczogNDA5NlxyXG4gICAgICAgIH0sXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgaWQ6ICdvcGVuYWkvZ3B0LTRvJyxcclxuICAgICAgICAgIG5hbWU6ICdHUFQtNG8gKHZpYSBPcGVuUm91dGVyKScsXHJcbiAgICAgICAgICBwcm92aWRlcjogdGhpcy5wcm92aWRlcixcclxuICAgICAgICAgIGNvbnRleHRTaXplOiAxMjgwMDAsXHJcbiAgICAgICAgICBzdXBwb3J0c1Rvb2xzOiB0cnVlLFxyXG4gICAgICAgICAgc3VwcG9ydHNKc29uOiB0cnVlLFxyXG4gICAgICAgICAgbWF4T3V0cHV0VG9rZW5zOiA0MDk2XHJcbiAgICAgICAgfVxyXG4gICAgICBdO1xyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgdGhpcy5sb2dFcnJvcignZ2V0QXZhaWxhYmxlTW9kZWxzJywgZXJyb3IpO1xyXG4gICAgICAvLyBSZXR1cm4gYSBkZWZhdWx0IHNldCBvZiBtb2RlbHNcclxuICAgICAgcmV0dXJuIFtcclxuICAgICAgICB7XHJcbiAgICAgICAgICBpZDogJ2FudGhyb3BpYy9jbGF1ZGUtMy1vcHVzLTIwMjQwMjI5JyxcclxuICAgICAgICAgIG5hbWU6ICdDbGF1ZGUgMyBPcHVzICh2aWEgT3BlblJvdXRlciknLFxyXG4gICAgICAgICAgcHJvdmlkZXI6IHRoaXMucHJvdmlkZXIsXHJcbiAgICAgICAgICBjb250ZXh0U2l6ZTogMjAwMDAwLFxyXG4gICAgICAgICAgc3VwcG9ydHNUb29sczogdHJ1ZSxcclxuICAgICAgICAgIHN1cHBvcnRzSnNvbjogdHJ1ZSxcclxuICAgICAgICAgIG1heE91dHB1dFRva2VuczogNDA5NlxyXG4gICAgICAgIH0sXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgaWQ6ICdvcGVuYWkvZ3B0LTRvJyxcclxuICAgICAgICAgIG5hbWU6ICdHUFQtNG8gKHZpYSBPcGVuUm91dGVyKScsXHJcbiAgICAgICAgICBwcm92aWRlcjogdGhpcy5wcm92aWRlcixcclxuICAgICAgICAgIGNvbnRleHRTaXplOiAxMjgwMDAsXHJcbiAgICAgICAgICBzdXBwb3J0c1Rvb2xzOiB0cnVlLFxyXG4gICAgICAgICAgc3VwcG9ydHNKc29uOiB0cnVlLFxyXG4gICAgICAgICAgbWF4T3V0cHV0VG9rZW5zOiA0MDk2XHJcbiAgICAgICAgfVxyXG4gICAgICBdO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2VuZCBhIHJlcXVlc3QgdG8gdGhlIE9wZW5Sb3V0ZXIgQVBJIGFuZCBnZXQgYSBjb21wbGV0ZSByZXNwb25zZS5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gcmVxdWVzdCBUaGUgcmVxdWVzdCBwYXJhbWV0ZXJzXHJcbiAgICogQHJldHVybnMgQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gYSBQcm92aWRlclJlc3BvbnNlXHJcbiAgICovXHJcbiAgYXN5bmMgc2VuZFJlcXVlc3QocmVxdWVzdDogUHJvdmlkZXJSZXF1ZXN0KTogUHJvbWlzZTxQcm92aWRlclJlc3BvbnNlPiB7XHJcbiAgICB0cnkge1xyXG4gICAgICB0aGlzLnZhbGlkYXRlQXBpS2V5KCk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBDcmVhdGUgdGhlIE9wZW5Sb3V0ZXIgcmVxdWVzdFxyXG4gICAgICBjb25zdCBvcGVuUm91dGVyUmVxdWVzdCA9IHRoaXMuY3JlYXRlT3BlblJvdXRlclJlcXVlc3QocmVxdWVzdCk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBTZW5kIHRoZSByZXF1ZXN0XHJcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcmVxdWVzdFVybCh7XHJcbiAgICAgICAgdXJsOiBgJHt0aGlzLmdldEJhc2VVcmwoKX0vY2hhdC9jb21wbGV0aW9uc2AsXHJcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXHJcbiAgICAgICAgaGVhZGVyczogdGhpcy5nZXRIZWFkZXJzKCksXHJcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkob3BlblJvdXRlclJlcXVlc3QpLFxyXG4gICAgICAgIHRocm93OiBmYWxzZVxyXG4gICAgICB9KTtcclxuICAgICAgXHJcbiAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgIT09IDIwMCkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUmVxdWVzdCBmYWlsZWQ6ICR7cmVzcG9uc2Uuc3RhdHVzfSAke3Jlc3BvbnNlLnRleHR9YCk7XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIGNvbnN0IGRhdGEgPSByZXNwb25zZS5qc29uO1xyXG4gICAgICBcclxuICAgICAgLy8gQ29udmVydCB0aGUgcmVzcG9uc2UgdG8gb3VyIGZvcm1hdFxyXG4gICAgICBjb25zdCBwcm92aWRlclJlc3BvbnNlOiBQcm92aWRlclJlc3BvbnNlID0ge1xyXG4gICAgICAgIGlkOiBkYXRhLmlkIHx8ICdvcGVucm91dGVyLXJlc3BvbnNlJyxcclxuICAgICAgICBtZXNzYWdlOiB7XHJcbiAgICAgICAgICByb2xlOiAnYXNzaXN0YW50JyxcclxuICAgICAgICAgIGNvbnRlbnQ6IGRhdGEuY2hvaWNlcz8uWzBdPy5tZXNzYWdlPy5jb250ZW50IHx8ICcnXHJcbiAgICAgICAgfVxyXG4gICAgICB9O1xyXG4gICAgICBcclxuICAgICAgLy8gQWRkIHRvb2wgY2FsbHMgaWYgcHJlc2VudFxyXG4gICAgICBpZiAoZGF0YS5jaG9pY2VzPy5bMF0/Lm1lc3NhZ2U/LnRvb2xfY2FsbHMpIHtcclxuICAgICAgICBwcm92aWRlclJlc3BvbnNlLnRvb2xDYWxscyA9IGRhdGEuY2hvaWNlc1swXS5tZXNzYWdlLnRvb2xfY2FsbHMubWFwKCh0b29sQ2FsbDogYW55KSA9PiAoe1xyXG4gICAgICAgICAgaWQ6IHRvb2xDYWxsLmlkLFxyXG4gICAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcclxuICAgICAgICAgIGZ1bmN0aW9uOiB7XHJcbiAgICAgICAgICAgIG5hbWU6IHRvb2xDYWxsLmZ1bmN0aW9uLm5hbWUsXHJcbiAgICAgICAgICAgIGFyZ3VtZW50czogdG9vbENhbGwuZnVuY3Rpb24uYXJndW1lbnRzXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSkpO1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICByZXR1cm4gcHJvdmlkZXJSZXNwb25zZTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIHRoaXMubG9nRXJyb3IoJ3NlbmRSZXF1ZXN0JywgZXJyb3IpO1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYE9wZW5Sb3V0ZXIgcmVxdWVzdCBmYWlsZWQ6ICR7ZXJyb3IubWVzc2FnZX1gKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNlbmQgYSBzdHJlYW1pbmcgcmVxdWVzdCB0byB0aGUgT3BlblJvdXRlciBBUEkuXHJcbiAgICogXHJcbiAgICogQHBhcmFtIHJlcXVlc3QgVGhlIHJlcXVlc3QgcGFyYW1ldGVycyAoc2hvdWxkIGhhdmUgc3RyZWFtOiB0cnVlKVxyXG4gICAqIEBwYXJhbSBvbkNodW5rIENhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBjYWxsZWQgZm9yIGVhY2ggY2h1bmsgcmVjZWl2ZWRcclxuICAgKiBAcmV0dXJucyBBIHByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIHRoZSBzdHJlYW0gaXMgY29tcGxldGVcclxuICAgKi9cclxuICBhc3luYyBzZW5kU3RyZWFtaW5nUmVxdWVzdChcclxuICAgIHJlcXVlc3Q6IFByb3ZpZGVyUmVxdWVzdCxcclxuICAgIG9uQ2h1bms6IChjaHVuazogUHJvdmlkZXJDaHVuaykgPT4gdm9pZFxyXG4gICk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgdGhpcy52YWxpZGF0ZUFwaUtleSgpO1xyXG4gICAgICBcclxuICAgICAgLy8gRW5zdXJlIHN0cmVhbSBpcyB0cnVlXHJcbiAgICAgIHJlcXVlc3Quc3RyZWFtID0gdHJ1ZTtcclxuICAgICAgXHJcbiAgICAgIC8vIENyZWF0ZSB0aGUgT3BlblJvdXRlciByZXF1ZXN0XHJcbiAgICAgIGNvbnN0IG9wZW5Sb3V0ZXJSZXF1ZXN0ID0gdGhpcy5jcmVhdGVPcGVuUm91dGVyUmVxdWVzdChyZXF1ZXN0KTtcclxuICAgICAgXHJcbiAgICAgIC8vIEZvciBzdHJlYW1pbmcsIHdlIG5lZWQgdG8gdXNlIGZldGNoIHdpdGggUmVhZGFibGVTdHJlYW1cclxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHt0aGlzLmdldEJhc2VVcmwoKX0vY2hhdC9jb21wbGV0aW9uc2AsIHtcclxuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcclxuICAgICAgICBoZWFkZXJzOiB0aGlzLmdldEhlYWRlcnMoKSxcclxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShvcGVuUm91dGVyUmVxdWVzdClcclxuICAgICAgfSk7XHJcbiAgICAgIFxyXG4gICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTdHJlYW1pbmcgcmVxdWVzdCBmYWlsZWQ6ICR7cmVzcG9uc2Uuc3RhdHVzfSAke3Jlc3BvbnNlLnN0YXR1c1RleHR9YCk7XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIGNvbnN0IHJlYWRlciA9IHJlc3BvbnNlLmJvZHk/LmdldFJlYWRlcigpO1xyXG4gICAgICBpZiAoIXJlYWRlcikge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignUmVzcG9uc2UgYm9keSBpcyBub3QgcmVhZGFibGUnKTtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgLy8gQ3JlYXRlIGFuIEFib3J0Q29udHJvbGxlciBmb3IgdGhpcyByZXF1ZXN0XHJcbiAgICAgIGNvbnN0IGFib3J0Q29udHJvbGxlciA9IHRoaXMuY3JlYXRlQWJvcnRDb250cm9sbGVyKCk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBQcm9jZXNzIHRoZSBzdHJlYW1cclxuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGFzeW5jIChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICBsZXQgcmVzcG9uc2VJZCA9ICcnO1xyXG4gICAgICAgIGxldCBkZWNvZGVyID0gbmV3IFRleHREZWNvZGVyKCk7XHJcbiAgICAgICAgbGV0IGJ1ZmZlciA9ICcnO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAvLyBTZXQgdXAgYWJvcnQgaGFuZGxlclxyXG4gICAgICAgICAgYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKCdhYm9ydCcsICgpID0+IHtcclxuICAgICAgICAgICAgcmVhZGVyLmNhbmNlbCgpO1xyXG4gICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICAgIFxyXG4gICAgICAgICAgLy8gUmVhZCB0aGUgc3RyZWFtXHJcbiAgICAgICAgICB3aGlsZSAodHJ1ZSkge1xyXG4gICAgICAgICAgICBjb25zdCB7IGRvbmUsIHZhbHVlIH0gPSBhd2FpdCByZWFkZXIucmVhZCgpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKGRvbmUpIHtcclxuICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gRGVjb2RlIHRoZSBjaHVua1xyXG4gICAgICAgICAgICBjb25zdCBjaHVuayA9IGRlY29kZXIuZGVjb2RlKHZhbHVlLCB7IHN0cmVhbTogdHJ1ZSB9KTtcclxuICAgICAgICAgICAgYnVmZmVyICs9IGNodW5rO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gUHJvY2VzcyBhbnkgY29tcGxldGUgbGluZXNcclxuICAgICAgICAgICAgY29uc3QgbGluZXMgPSBidWZmZXIuc3BsaXQoJ1xcbicpO1xyXG4gICAgICAgICAgICBidWZmZXIgPSBsaW5lcy5wb3AoKSB8fCAnJzsgLy8gS2VlcCB0aGUgbGFzdCBpbmNvbXBsZXRlIGxpbmUgaW4gdGhlIGJ1ZmZlclxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XHJcbiAgICAgICAgICAgICAgLy8gU2tpcCBlbXB0eSBsaW5lcyBhbmQgY29tbWVudHNcclxuICAgICAgICAgICAgICBpZiAoIWxpbmUudHJpbSgpIHx8IGxpbmUuc3RhcnRzV2l0aCgnOicpKSB7XHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIFtET05FXSBtZXNzYWdlXHJcbiAgICAgICAgICAgICAgaWYgKGxpbmUgPT09ICdkYXRhOiBbRE9ORV0nKSB7XHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgLy8gUGFyc2UgdGhlIGRhdGFcclxuICAgICAgICAgICAgICBpZiAobGluZS5zdGFydHNXaXRoKCdkYXRhOiAnKSkge1xyXG4gICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgY29uc3QgZGF0YSA9IEpTT04ucGFyc2UobGluZS5zdWJzdHJpbmcoNikpO1xyXG4gICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgLy8gU3RvcmUgdGhlIHJlc3BvbnNlIElEXHJcbiAgICAgICAgICAgICAgICAgIGlmICghcmVzcG9uc2VJZCAmJiBkYXRhLmlkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2VJZCA9IGRhdGEuaWQ7XHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgIC8vIFByb2Nlc3MgZGVsdGFcclxuICAgICAgICAgICAgICAgICAgY29uc3QgZGVsdGEgPSBkYXRhLmNob2ljZXM/LlswXT8uZGVsdGE7XHJcbiAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICBpZiAoZGVsdGEpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBwcm92aWRlckNodW5rOiBQcm92aWRlckNodW5rID0ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgaWQ6IHJlc3BvbnNlSWQgfHwgJ3N0cmVhbScsXHJcbiAgICAgICAgICAgICAgICAgICAgICBkZWx0YToge31cclxuICAgICAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIC8vIEFkZCBjb250ZW50IGRlbHRhIGlmIHByZXNlbnRcclxuICAgICAgICAgICAgICAgICAgICBpZiAoZGVsdGEuY29udGVudCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgcHJvdmlkZXJDaHVuay5kZWx0YS5jb250ZW50ID0gZGVsdGEuY29udGVudDtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gQWRkIHRvb2wgY2FsbCBkZWx0YSBpZiBwcmVzZW50XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRlbHRhLnRvb2xfY2FsbHMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgIHByb3ZpZGVyQ2h1bmsuZGVsdGEudG9vbENhbGxzID0gZGVsdGEudG9vbF9jYWxscy5tYXAoKHRvb2xDYWxsOiBhbnkpID0+ICh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkOiB0b29sQ2FsbC5pZCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb246IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiB0b29sQ2FsbC5mdW5jdGlvbj8ubmFtZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBhcmd1bWVudHM6IHRvb2xDYWxsLmZ1bmN0aW9uPy5hcmd1bWVudHNcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgfSkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICAvLyBDYWxsIHRoZSBjYWxsYmFjayB3aXRoIHRoZSBjaHVua1xyXG4gICAgICAgICAgICAgICAgICAgIG9uQ2h1bmsocHJvdmlkZXJDaHVuayk7XHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHByb2Nlc3Npbmcgc3RyZWFtIGNodW5rOicsIGVycm9yKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICAgIFxyXG4gICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAvLyBJZ25vcmUgaWYgd2UgYWJvcnRlZFxyXG4gICAgICAgICAgaWYgKGFib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZCkge1xyXG4gICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIFxyXG4gICAgICAgICAgcmVqZWN0KGVycm9yKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgLy8gSWdub3JlIGFib3J0IGVycm9yc1xyXG4gICAgICBpZiAoZXJyb3IubmFtZSA9PT0gJ0Fib3J0RXJyb3InKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICB0aGlzLmxvZ0Vycm9yKCdzZW5kU3RyZWFtaW5nUmVxdWVzdCcsIGVycm9yKTtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBPcGVuUm91dGVyIHN0cmVhbWluZyByZXF1ZXN0IGZhaWxlZDogJHtlcnJvci5tZXNzYWdlfWApO1xyXG4gICAgfSBmaW5hbGx5IHtcclxuICAgICAgdGhpcy5hYm9ydENvbnRyb2xsZXIgPSBudWxsO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGFuIE9wZW5Sb3V0ZXIgcmVxdWVzdCBmcm9tIG91ciBjb21tb24gcmVxdWVzdCBmb3JtYXQuXHJcbiAgICogXHJcbiAgICogQHBhcmFtIHJlcXVlc3QgT3VyIGNvbW1vbiByZXF1ZXN0IGZvcm1hdFxyXG4gICAqIEByZXR1cm5zIE9wZW5Sb3V0ZXIgcmVxdWVzdCBmb3JtYXRcclxuICAgKi9cclxuICBwcml2YXRlIGNyZWF0ZU9wZW5Sb3V0ZXJSZXF1ZXN0KHJlcXVlc3Q6IFByb3ZpZGVyUmVxdWVzdCk6IGFueSB7XHJcbiAgICAvLyBDcmVhdGUgdGhlIE9wZW5Sb3V0ZXIgcmVxdWVzdCAoT3BlbkFJLWNvbXBhdGlibGUgZm9ybWF0KVxyXG4gICAgY29uc3Qgb3BlblJvdXRlclJlcXVlc3Q6IGFueSA9IHtcclxuICAgICAgbW9kZWw6IHJlcXVlc3QubW9kZWwsXHJcbiAgICAgIG1lc3NhZ2VzOiByZXF1ZXN0Lm1lc3NhZ2VzLFxyXG4gICAgICB0ZW1wZXJhdHVyZTogcmVxdWVzdC50ZW1wZXJhdHVyZSAhPT0gdW5kZWZpbmVkID8gcmVxdWVzdC50ZW1wZXJhdHVyZSA6IDAuNyxcclxuICAgICAgbWF4X3Rva2VuczogcmVxdWVzdC5tYXhUb2tlbnMgfHwgNDA5NixcclxuICAgICAgc3RyZWFtOiByZXF1ZXN0LnN0cmVhbSB8fCBmYWxzZVxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLy8gQWRkIHRvb2xzIGlmIHByZXNlbnRcclxuICAgIGlmIChyZXF1ZXN0LnRvb2xzICYmIHJlcXVlc3QudG9vbHMubGVuZ3RoID4gMCkge1xyXG4gICAgICBvcGVuUm91dGVyUmVxdWVzdC50b29scyA9IHJlcXVlc3QudG9vbHM7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiBvcGVuUm91dGVyUmVxdWVzdDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgaGVhZGVycyBmb3IgT3BlblJvdXRlciBBUEkgcmVxdWVzdHMuXHJcbiAgICogXHJcbiAgICogQHJldHVybnMgVGhlIGhlYWRlcnMgb2JqZWN0XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBnZXRIZWFkZXJzKCk6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4ge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgJ0F1dGhvcml6YXRpb24nOiBgQmVhcmVyICR7dGhpcy5hcGlLZXl9YCxcclxuICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcclxuICAgICAgJ0hUVFAtUmVmZXJlcic6ICdodHRwczovL2dpdGh1Yi5jb20vc3luYXB0aWMtbGFicy9jaGF0c2lkaWFuJyxcclxuICAgICAgJ1gtVGl0bGUnOiAnT2JzaWRpYW4gQ2hhdHNpZGlhbiBQbHVnaW4nXHJcbiAgICB9O1xyXG4gIH1cclxufVxyXG4iXX0=