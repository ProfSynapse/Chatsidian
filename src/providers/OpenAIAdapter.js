/**
 * OpenAI Provider Adapter
 *
 * This file implements the ProviderAdapter interface for the OpenAI API.
 * It uses the official OpenAI SDK to communicate with the OpenAI API.
 */
import OpenAI from 'openai';
import { COMMON_MODELS } from '../models/Provider';
import { BaseAdapter } from './BaseAdapter';
/**
 * Adapter for the OpenAI API.
 */
export class OpenAIAdapter extends BaseAdapter {
    /**
     * Create a new OpenAIAdapter.
     *
     * @param apiKey The OpenAI API key
     * @param apiEndpoint Optional custom API endpoint URL
     */
    constructor(apiKey, apiEndpoint) {
        super(apiKey, apiEndpoint);
        /**
         * The name of the provider
         */
        this.provider = 'openai';
        const options = {
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
    async testConnection() {
        try {
            this.validateApiKey();
            // List models as a lightweight API call to test connection
            await this.client.models.list();
            return true;
        }
        catch (error) {
            this.logError('testConnection', error);
            return false;
        }
    }
    /**
     * Get a list of available models from OpenAI.
     *
     * @returns A promise that resolves to an array of ModelInfo objects
     */
    async getAvailableModels() {
        try {
            this.validateApiKey();
            // Get models from OpenAI API
            const response = await this.client.models.list();
            // Filter for chat models and map to ModelInfo format
            const openaiModels = response.data
                .filter(model => model.id.includes('gpt'))
                .map(model => {
                // Try to find the model in COMMON_MODELS
                const knownModel = COMMON_MODELS.find(m => m.id === model.id && m.provider === this.provider);
                if (knownModel) {
                    return knownModel;
                }
                // Create a new ModelInfo for unknown models
                return {
                    id: model.id,
                    name: model.id, // Use ID as name for unknown models
                    provider: this.provider,
                    contextSize: 4096, // Default context size
                    supportsTools: model.id.includes('gpt-4') || model.id.includes('gpt-3.5-turbo'), // Assume newer models support tools
                    supportsJson: model.id.includes('gpt-4') || model.id.includes('gpt-3.5-turbo'), // Assume newer models support JSON
                    maxOutputTokens: 4096 // Default max output tokens
                };
            });
            return openaiModels;
        }
        catch (error) {
            this.logError('getAvailableModels', error);
            return COMMON_MODELS.filter(model => model.provider === this.provider);
        }
    }
    /**
     * Send a request to the OpenAI API and get a complete response.
     *
     * @param request The request parameters
     * @returns A promise that resolves to a ProviderResponse
     */
    async sendRequest(request) {
        var _a, _b, _c, _d, _e, _f;
        try {
            this.validateApiKey();
            // Create the OpenAI request
            const openaiRequest = this.createOpenAIRequest(request);
            // Send the request
            const response = await this.client.chat.completions.create(openaiRequest);
            // Convert the response to our format
            const providerResponse = {
                id: response.id,
                message: {
                    role: ((_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.role) || 'assistant',
                    content: ((_d = (_c = response.choices[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content) || ''
                }
            };
            // Add tool calls if present
            if ((_f = (_e = response.choices[0]) === null || _e === void 0 ? void 0 : _e.message) === null || _f === void 0 ? void 0 : _f.tool_calls) {
                providerResponse.toolCalls = response.choices[0].message.tool_calls;
            }
            return providerResponse;
        }
        catch (error) {
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
    async sendStreamingRequest(request, onChunk) {
        var _a;
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
                const stream = streamResponse;
                for await (const chunk of stream) {
                    // Store the response ID
                    if (!responseId && chunk.id) {
                        responseId = chunk.id;
                    }
                    // Process delta
                    const delta = (_a = chunk.choices[0]) === null || _a === void 0 ? void 0 : _a.delta;
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
            throw new Error(`OpenAI streaming request failed: ${error.message}`);
        }
        finally {
            this.abortController = null;
        }
    }
    /**
     * Create an OpenAI request from our common request format.
     *
     * @param request Our common request format
     * @returns OpenAI request format
     */
    createOpenAIRequest(request) {
        // Map our messages to OpenAI format
        const messages = request.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            tool_calls: msg.toolCalls,
            tool_results: msg.toolResults
        }));
        // Create the OpenAI request
        const openaiRequest = {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiT3BlbkFJQWRhcHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIk9wZW5BSUFkYXB0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7O0dBS0c7QUFFSCxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQU1MLGFBQWEsRUFDZCxNQUFNLG9CQUFvQixDQUFDO0FBQzVCLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFFNUM7O0dBRUc7QUFDSCxNQUFNLE9BQU8sYUFBYyxTQUFRLFdBQVc7SUFXNUM7Ozs7O09BS0c7SUFDSCxZQUFZLE1BQWMsRUFBRSxXQUFvQjtRQUM5QyxLQUFLLENBQUMsTUFBTSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBakI3Qjs7V0FFRztRQUNNLGFBQVEsR0FBRyxRQUFRLENBQUM7UUFnQjNCLE1BQU0sT0FBTyxHQUFRO1lBQ25CLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTtTQUNwQixDQUFDO1FBRUYsc0NBQXNDO1FBQ3RDLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ3JCLE9BQU8sQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQztRQUNyQyxDQUFDO1FBRUQsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSCxLQUFLLENBQUMsY0FBYztRQUNsQixJQUFJLENBQUM7WUFDSCxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7WUFFdEIsMkRBQTJEO1lBQzNELE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDaEMsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNmLElBQUksQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDdkMsT0FB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QU8sYUFBYSxDQUFDO0lBQ3ZCLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBPcGVuQUkgUHJvdmlkZXIgQWRhcHRlclxyXG4gKiBcclxuICogVGhpcyBmaWxlIGltcGxlbWVudHMgdGhlIFByb3ZpZGVyQWRhcHRlciBpbnRlcmZhY2UgZm9yIHRoZSBPcGVuQUkgQVBJLlxyXG4gKiBJdCB1c2VzIHRoZSBvZmZpY2lhbCBPcGVuQUkgU0RLIHRvIGNvbW11bmljYXRlIHdpdGggdGhlIE9wZW5BSSBBUEkuXHJcbiAqL1xyXG5cclxuaW1wb3J0IE9wZW5BSSBmcm9tICdvcGVuYWknO1xyXG5pbXBvcnQgeyBcclxuICBNb2RlbEluZm8sIFxyXG4gIFByb3ZpZGVyQ2h1bmssIFxyXG4gIFByb3ZpZGVyTWVzc2FnZSwgXHJcbiAgUHJvdmlkZXJSZXF1ZXN0LCBcclxuICBQcm92aWRlclJlc3BvbnNlLFxyXG4gIENPTU1PTl9NT0RFTFNcclxufSBmcm9tICcuLi9tb2RlbHMvUHJvdmlkZXInO1xyXG5pbXBvcnQgeyBCYXNlQWRhcHRlciB9IGZyb20gJy4vQmFzZUFkYXB0ZXInO1xyXG5cclxuLyoqXHJcbiAqIEFkYXB0ZXIgZm9yIHRoZSBPcGVuQUkgQVBJLlxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIE9wZW5BSUFkYXB0ZXIgZXh0ZW5kcyBCYXNlQWRhcHRlciB7XHJcbiAgLyoqXHJcbiAgICogVGhlIG5hbWUgb2YgdGhlIHByb3ZpZGVyXHJcbiAgICovXHJcbiAgcmVhZG9ubHkgcHJvdmlkZXIgPSAnb3BlbmFpJztcclxuXHJcbiAgLyoqXHJcbiAgICogVGhlIE9wZW5BSSBjbGllbnQgaW5zdGFuY2VcclxuICAgKi9cclxuICBwcml2YXRlIGNsaWVudDogT3BlbkFJO1xyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSBuZXcgT3BlbkFJQWRhcHRlci5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gYXBpS2V5IFRoZSBPcGVuQUkgQVBJIGtleVxyXG4gICAqIEBwYXJhbSBhcGlFbmRwb2ludCBPcHRpb25hbCBjdXN0b20gQVBJIGVuZHBvaW50IFVSTFxyXG4gICAqL1xyXG4gIGNvbnN0cnVjdG9yKGFwaUtleTogc3RyaW5nLCBhcGlFbmRwb2ludD86IHN0cmluZykge1xyXG4gICAgc3VwZXIoYXBpS2V5LCBhcGlFbmRwb2ludCk7XHJcbiAgICBcclxuICAgIGNvbnN0IG9wdGlvbnM6IGFueSA9IHtcclxuICAgICAgYXBpS2V5OiB0aGlzLmFwaUtleVxyXG4gICAgfTtcclxuXHJcbiAgICAvLyBVc2UgY3VzdG9tIEFQSSBlbmRwb2ludCBpZiBwcm92aWRlZFxyXG4gICAgaWYgKHRoaXMuYXBpRW5kcG9pbnQpIHtcclxuICAgICAgb3B0aW9ucy5iYXNlVVJMID0gdGhpcy5hcGlFbmRwb2ludDtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmNsaWVudCA9IG5ldyBPcGVuQUkob3B0aW9ucyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBUZXN0IHRoZSBjb25uZWN0aW9uIHRvIHRoZSBPcGVuQUkgQVBJLlxyXG4gICAqIE1ha2VzIGEgbGlnaHR3ZWlnaHQgQVBJIGNhbGwgdG8gdmVyaWZ5IGNyZWRlbnRpYWxzLlxyXG4gICAqIFxyXG4gICAqIEByZXR1cm5zIEEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIHRydWUgaWYgdGhlIGNvbm5lY3Rpb24gaXMgc3VjY2Vzc2Z1bCwgZmFsc2Ugb3RoZXJ3aXNlXHJcbiAgICovXHJcbiAgYXN5bmMgdGVzdENvbm5lY3Rpb24oKTogUHJvbWlzZTxib29sZWFuPiB7XHJcbiAgICB0cnkge1xyXG4gICAgICB0aGlzLnZhbGlkYXRlQXBpS2V5KCk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBMaXN0IG1vZGVscyBhcyBhIGxpZ2h0d2VpZ2h0IEFQSSBjYWxsIHRvIHRlc3QgY29ubmVjdGlvblxyXG4gICAgICBhd2FpdCB0aGlzLmNsaWVudC5tb2RlbHMubGlzdCgpO1xyXG4gICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIHRoaXMubG9nRXJyb3IoJ3Rlc3RDb25uZWN0aW9uJywgZXJyb3IpO1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSBsaXN0IG9mIGF2YWlsYWJsZSBtb2RlbHMgZnJvbSBPcGVuQUkuXHJcbiAgICogXHJcbiAgICogQHJldHVybnMgQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gYW4gYXJyYXkgb2YgTW9kZWxJbmZvIG9iamVjdHNcclxuICAgKi9cclxuICBhc3luYyBnZXRBdmFpbGFibGVNb2RlbHMoKTogUHJvbWlzZTxNb2RlbEluZm9bXT4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgdGhpcy52YWxpZGF0ZUFwaUtleSgpO1xyXG4gICAgICBcclxuICAgICAgLy8gR2V0IG1vZGVscyBmcm9tIE9wZW5BSSBBUElcclxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLmNsaWVudC5tb2RlbHMubGlzdCgpO1xyXG4gICAgICBcclxuICAgICAgLy8gRmlsdGVyIGZvciBjaGF0IG1vZGVscyBhbmQgbWFwIHRvIE1vZGVsSW5mbyBmb3JtYXRcclxuICAgICAgY29uc3Qgb3BlbmFpTW9kZWxzID0gcmVzcG9uc2UuZGF0YVxyXG4gICAgICAgIC5maWx0ZXIobW9kZWwgPT4gbW9kZWwuaWQuaW5jbHVkZXMoJ2dwdCcpKVxyXG4gICAgICAgIC5tYXAobW9kZWwgPT4ge1xyXG4gICAgICAgICAgLy8gVHJ5IHRvIGZpbmQgdGhlIG1vZGVsIGluIENPTU1PTl9NT0RFTFNcclxuICAgICAgICAgIGNvbnN0IGtub3duTW9kZWwgPSBDT01NT05fTU9ERUxTLmZpbmQobSA9PiBtLmlkID09PSBtb2RlbC5pZCAmJiBtLnByb3ZpZGVyID09PSB0aGlzLnByb3ZpZGVyKTtcclxuICAgICAgICAgIFxyXG4gICAgICAgICAgaWYgKGtub3duTW9kZWwpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGtub3duTW9kZWw7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBcclxuICAgICAgICAgIC8vIENyZWF0ZSBhIG5ldyBNb2RlbEluZm8gZm9yIHVua25vd24gbW9kZWxzXHJcbiAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBpZDogbW9kZWwuaWQsXHJcbiAgICAgICAgICAgIG5hbWU6IG1vZGVsLmlkLCAvLyBVc2UgSUQgYXMgbmFtZSBmb3IgdW5rbm93biBtb2RlbHNcclxuICAgICAgICAgICAgcHJvdmlkZXI6IHRoaXMucHJvdmlkZXIsXHJcbiAgICAgICAgICAgIGNvbnRleHRTaXplOiA0MDk2LCAvLyBEZWZhdWx0IGNvbnRleHQgc2l6ZVxyXG4gICAgICAgICAgICBzdXBwb3J0c1Rvb2xzOiBtb2RlbC5pZC5pbmNsdWRlcygnZ3B0LTQnKSB8fCBtb2RlbC5pZC5pbmNsdWRlcygnZ3B0LTMuNS10dXJibycpLCAvLyBBc3N1bWUgbmV3ZXIgbW9kZWxzIHN1cHBvcnQgdG9vbHNcclxuICAgICAgICAgICAgc3VwcG9ydHNKc29uOiBtb2RlbC5pZC5pbmNsdWRlcygnZ3B0LTQnKSB8fCBtb2RlbC5pZC5pbmNsdWRlcygnZ3B0LTMuNS10dXJibycpLCAvLyBBc3N1bWUgbmV3ZXIgbW9kZWxzIHN1cHBvcnQgSlNPTlxyXG4gICAgICAgICAgICBtYXhPdXRwdXRUb2tlbnM6IDQwOTYgLy8gRGVmYXVsdCBtYXggb3V0cHV0IHRva2Vuc1xyXG4gICAgICAgICAgfTtcclxuICAgICAgICB9KTtcclxuICAgICAgXHJcbiAgICAgIHJldHVybiBvcGVuYWlNb2RlbHM7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICB0aGlzLmxvZ0Vycm9yKCdnZXRBdmFpbGFibGVNb2RlbHMnLCBlcnJvcik7XHJcbiAgICAgIHJldHVybiBDT01NT05fTU9ERUxTLmZpbHRlcihtb2RlbCA9PiBtb2RlbC5wcm92aWRlciA9PT0gdGhpcy5wcm92aWRlcik7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZW5kIGEgcmVxdWVzdCB0byB0aGUgT3BlbkFJIEFQSSBhbmQgZ2V0IGEgY29tcGxldGUgcmVzcG9uc2UuXHJcbiAgICogXHJcbiAgICogQHBhcmFtIHJlcXVlc3QgVGhlIHJlcXVlc3QgcGFyYW1ldGVyc1xyXG4gICAqIEByZXR1cm5zIEEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIGEgUHJvdmlkZXJSZXNwb25zZVxyXG4gICAqL1xyXG4gIGFzeW5jIHNlbmRSZXF1ZXN0KHJlcXVlc3Q6IFByb3ZpZGVyUmVxdWVzdCk6IFByb21pc2U8UHJvdmlkZXJSZXNwb25zZT4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgdGhpcy52YWxpZGF0ZUFwaUtleSgpO1xyXG4gICAgICBcclxuICAgICAgLy8gQ3JlYXRlIHRoZSBPcGVuQUkgcmVxdWVzdFxyXG4gICAgICBjb25zdCBvcGVuYWlSZXF1ZXN0ID0gdGhpcy5jcmVhdGVPcGVuQUlSZXF1ZXN0KHJlcXVlc3QpO1xyXG4gICAgICBcclxuICAgICAgLy8gU2VuZCB0aGUgcmVxdWVzdFxyXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuY2xpZW50LmNoYXQuY29tcGxldGlvbnMuY3JlYXRlKG9wZW5haVJlcXVlc3QpO1xyXG4gICAgICBcclxuICAgICAgLy8gQ29udmVydCB0aGUgcmVzcG9uc2UgdG8gb3VyIGZvcm1hdFxyXG4gICAgICBjb25zdCBwcm92aWRlclJlc3BvbnNlOiBQcm92aWRlclJlc3BvbnNlID0ge1xyXG4gICAgICAgIGlkOiByZXNwb25zZS5pZCxcclxuICAgICAgICBtZXNzYWdlOiB7XHJcbiAgICAgICAgICByb2xlOiByZXNwb25zZS5jaG9pY2VzWzBdPy5tZXNzYWdlPy5yb2xlIHx8ICdhc3Npc3RhbnQnLFxyXG4gICAgICAgICAgY29udGVudDogcmVzcG9uc2UuY2hvaWNlc1swXT8ubWVzc2FnZT8uY29udGVudCB8fCAnJ1xyXG4gICAgICAgIH1cclxuICAgICAgfTtcclxuICAgICAgXHJcbiAgICAgIC8vIEFkZCB0b29sIGNhbGxzIGlmIHByZXNlbnRcclxuICAgICAgaWYgKHJlc3BvbnNlLmNob2ljZXNbMF0/Lm1lc3NhZ2U/LnRvb2xfY2FsbHMpIHtcclxuICAgICAgICBwcm92aWRlclJlc3BvbnNlLnRvb2xDYWxscyA9IHJlc3BvbnNlLmNob2ljZXNbMF0ubWVzc2FnZS50b29sX2NhbGxzO1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICByZXR1cm4gcHJvdmlkZXJSZXNwb25zZTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIHRoaXMubG9nRXJyb3IoJ3NlbmRSZXF1ZXN0JywgZXJyb3IpO1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYE9wZW5BSSByZXF1ZXN0IGZhaWxlZDogJHtlcnJvci5tZXNzYWdlfWApO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2VuZCBhIHN0cmVhbWluZyByZXF1ZXN0IHRvIHRoZSBPcGVuQUkgQVBJLlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSByZXF1ZXN0IFRoZSByZXF1ZXN0IHBhcmFtZXRlcnMgKHNob3VsZCBoYXZlIHN0cmVhbTogdHJ1ZSlcclxuICAgKiBAcGFyYW0gb25DaHVuayBDYWxsYmFjayBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgY2FsbGVkIGZvciBlYWNoIGNodW5rIHJlY2VpdmVkXHJcbiAgICogQHJldHVybnMgQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiB0aGUgc3RyZWFtIGlzIGNvbXBsZXRlXHJcbiAgICovXHJcbiAgYXN5bmMgc2VuZFN0cmVhbWluZ1JlcXVlc3QoXHJcbiAgICByZXF1ZXN0OiBQcm92aWRlclJlcXVlc3QsXHJcbiAgICBvbkNodW5rOiAoY2h1bms6IFByb3ZpZGVyQ2h1bmspID0+IHZvaWRcclxuICApOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIHRoaXMudmFsaWRhdGVBcGlLZXkoKTtcclxuICAgICAgXHJcbiAgICAgIC8vIEVuc3VyZSBzdHJlYW0gaXMgdHJ1ZVxyXG4gICAgICByZXF1ZXN0LnN0cmVhbSA9IHRydWU7XHJcbiAgICAgIFxyXG4gICAgICAvLyBDcmVhdGUgdGhlIE9wZW5BSSByZXF1ZXN0XHJcbiAgICAgIGNvbnN0IG9wZW5haVJlcXVlc3QgPSB0aGlzLmNyZWF0ZU9wZW5BSVJlcXVlc3QocmVxdWVzdCk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBDcmVhdGUgYW4gQWJvcnRDb250cm9sbGVyIGZvciB0aGlzIHJlcXVlc3RcclxuICAgICAgY29uc3QgYWJvcnRDb250cm9sbGVyID0gdGhpcy5jcmVhdGVBYm9ydENvbnRyb2xsZXIoKTtcclxuICAgICAgXHJcbiAgICAgIC8vIFNlbmQgdGhlIHN0cmVhbWluZyByZXF1ZXN0XHJcbiAgICAgIGNvbnN0IHN0cmVhbVJlc3BvbnNlID0gYXdhaXQgdGhpcy5jbGllbnQuY2hhdC5jb21wbGV0aW9ucy5jcmVhdGUoe1xyXG4gICAgICAgIC4uLm9wZW5haVJlcXVlc3QsXHJcbiAgICAgICAgc3RyZWFtOiB0cnVlXHJcbiAgICAgIH0sIHtcclxuICAgICAgICBzaWduYWw6IGFib3J0Q29udHJvbGxlci5zaWduYWxcclxuICAgICAgfSk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBQcm9jZXNzIHRoZSBzdHJlYW1cclxuICAgICAgbGV0IHJlc3BvbnNlSWQgPSAnJztcclxuICAgICAgXHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgLy8gVXNlIHR5cGUgYXNzZXJ0aW9uIHRvIGVuc3VyZSBUeXBlU2NyaXB0IGtub3dzIHRoaXMgaXMgYW4gYXN5bmMgaXRlcmFibGVcclxuICAgICAgICBjb25zdCBzdHJlYW0gPSBzdHJlYW1SZXNwb25zZSBhcyB1bmtub3duIGFzIEFzeW5jSXRlcmFibGU8YW55PjtcclxuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGNodW5rIG9mIHN0cmVhbSkge1xyXG4gICAgICAgICAgLy8gU3RvcmUgdGhlIHJlc3BvbnNlIElEXHJcbiAgICAgICAgICBpZiAoIXJlc3BvbnNlSWQgJiYgY2h1bmsuaWQpIHtcclxuICAgICAgICAgICAgcmVzcG9uc2VJZCA9IGNodW5rLmlkO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgXHJcbiAgICAgICAgICAvLyBQcm9jZXNzIGRlbHRhXHJcbiAgICAgICAgICBjb25zdCBkZWx0YSA9IGNodW5rLmNob2ljZXNbMF0/LmRlbHRhO1xyXG4gICAgICAgICAgXHJcbiAgICAgICAgICBpZiAoZGVsdGEpIHtcclxuICAgICAgICAgICAgY29uc3QgcHJvdmlkZXJDaHVuazogUHJvdmlkZXJDaHVuayA9IHtcclxuICAgICAgICAgICAgICBpZDogcmVzcG9uc2VJZCB8fCAnc3RyZWFtJyxcclxuICAgICAgICAgICAgICBkZWx0YToge31cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIEFkZCBjb250ZW50IGRlbHRhIGlmIHByZXNlbnRcclxuICAgICAgICAgICAgaWYgKGRlbHRhLmNvbnRlbnQpIHtcclxuICAgICAgICAgICAgICBwcm92aWRlckNodW5rLmRlbHRhLmNvbnRlbnQgPSBkZWx0YS5jb250ZW50O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBBZGQgdG9vbCBjYWxsIGRlbHRhIGlmIHByZXNlbnRcclxuICAgICAgICAgICAgaWYgKGRlbHRhLnRvb2xfY2FsbHMpIHtcclxuICAgICAgICAgICAgICBwcm92aWRlckNodW5rLmRlbHRhLnRvb2xDYWxscyA9IGRlbHRhLnRvb2xfY2FsbHM7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIENhbGwgdGhlIGNhbGxiYWNrIHdpdGggdGhlIGNodW5rXHJcbiAgICAgICAgICAgIG9uQ2h1bmsocHJvdmlkZXJDaHVuayk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGNhdGNoIChzdHJlYW1FcnJvcikge1xyXG4gICAgICAgIGlmIChzdHJlYW1FcnJvci5uYW1lID09PSAnQWJvcnRFcnJvcicpIHtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhyb3cgc3RyZWFtRXJyb3I7XHJcbiAgICAgIH1cclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIC8vIElnbm9yZSBhYm9ydCBlcnJvcnNcclxuICAgICAgaWYgKGVycm9yLm5hbWUgPT09ICdBYm9ydEVycm9yJykge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgdGhpcy5sb2dFcnJvcignc2VuZFN0cmVhbWluZ1JlcXVlc3QnLCBlcnJvcik7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihgT3BlbkFJIHN0cmVhbWluZyByZXF1ZXN0IGZhaWxlZDogJHtlcnJvci5tZXNzYWdlfWApO1xyXG4gICAgfSBmaW5hbGx5IHtcclxuICAgICAgdGhpcy5hYm9ydENvbnRyb2xsZXIgPSBudWxsO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGFuIE9wZW5BSSByZXF1ZXN0IGZyb20gb3VyIGNvbW1vbiByZXF1ZXN0IGZvcm1hdC5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gcmVxdWVzdCBPdXIgY29tbW9uIHJlcXVlc3QgZm9ybWF0XHJcbiAgICogQHJldHVybnMgT3BlbkFJIHJlcXVlc3QgZm9ybWF0XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBjcmVhdGVPcGVuQUlSZXF1ZXN0KHJlcXVlc3Q6IFByb3ZpZGVyUmVxdWVzdCk6IGFueSB7XHJcbiAgICAvLyBNYXAgb3VyIG1lc3NhZ2VzIHRvIE9wZW5BSSBmb3JtYXRcclxuICAgIGNvbnN0IG1lc3NhZ2VzID0gcmVxdWVzdC5tZXNzYWdlcy5tYXAobXNnID0+ICh7XHJcbiAgICAgIHJvbGU6IG1zZy5yb2xlIGFzIGFueSxcclxuICAgICAgY29udGVudDogbXNnLmNvbnRlbnQsXHJcbiAgICAgIHRvb2xfY2FsbHM6IG1zZy50b29sQ2FsbHMsXHJcbiAgICAgIHRvb2xfcmVzdWx0czogbXNnLnRvb2xSZXN1bHRzXHJcbiAgICB9KSk7XHJcbiAgICBcclxuICAgIC8vIENyZWF0ZSB0aGUgT3BlbkFJIHJlcXVlc3RcclxuICAgIGNvbnN0IG9wZW5haVJlcXVlc3Q6IGFueSA9IHtcclxuICAgICAgbW9kZWw6IHJlcXVlc3QubW9kZWwsXHJcbiAgICAgIG1lc3NhZ2VzLFxyXG4gICAgICB0ZW1wZXJhdHVyZTogcmVxdWVzdC50ZW1wZXJhdHVyZSxcclxuICAgICAgbWF4X3Rva2VuczogcmVxdWVzdC5tYXhUb2tlbnMsXHJcbiAgICAgIHN0cmVhbTogcmVxdWVzdC5zdHJlYW1cclxuICAgIH07XHJcbiAgICBcclxuICAgIC8vIEFkZCB0b29scyBpZiBwcmVzZW50XHJcbiAgICBpZiAocmVxdWVzdC50b29scyAmJiByZXF1ZXN0LnRvb2xzLmxlbmd0aCA+IDApIHtcclxuICAgICAgb3BlbmFpUmVxdWVzdC50b29scyA9IHJlcXVlc3QudG9vbHM7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiBvcGVuYWlSZXF1ZXN0O1xyXG4gIH1cclxufVxyXG4iXX0=