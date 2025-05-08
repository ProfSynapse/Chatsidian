/**
 * Anthropic Provider Adapter
 *
 * This file implements the ProviderAdapter interface for the Anthropic API.
 * It uses the official Anthropic SDK to communicate with the Anthropic API.
 */
// Import the Anthropic SDK
import Anthropic from '@anthropic-ai/sdk';
import { COMMON_MODELS } from '../models/Provider';
import { BaseAdapter } from './BaseAdapter';
/**
 * Adapter for the Anthropic API.
 */
export class AnthropicAdapter extends BaseAdapter {
    /**
     * Create a new AnthropicAdapter.
     *
     * @param apiKey The Anthropic API key
     * @param apiEndpoint Optional custom API endpoint URL
     */
    constructor(apiKey, apiEndpoint) {
        super(apiKey, apiEndpoint);
        /**
         * The name of the provider
         */
        this.provider = 'anthropic';
        const options = {
            apiKey: this.apiKey,
            dangerouslyAllowBrowser: true // Allow browser environment for testing
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
    async testConnection() {
        try {
            this.validateApiKey();
            // Make a minimal request to test the connection
            await this.client.messages.create({
                model: 'claude-3-haiku-20240307',
                max_tokens: 1,
                messages: [{ role: 'user', content: 'Hello' }]
            });
            return true;
        }
        catch (error) {
            this.logError('testConnection', error);
            return false;
        }
    }
    /**
     * Get a list of available models from Anthropic.
     *
     * @returns A promise that resolves to an array of ModelInfo objects
     */
    async getAvailableModels() {
        try {
            this.validateApiKey();
            // Anthropic doesn't have a models endpoint, so we return the known models
            return COMMON_MODELS.filter(model => model.provider === this.provider);
        }
        catch (error) {
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
    async sendRequest(request) {
        try {
            this.validateApiKey();
            // Create the Anthropic request
            const anthropicRequest = this.createAnthropicRequest(request);
            // Send the request
            const response = await this.client.messages.create(anthropicRequest);
            // Convert the response to our format
            const providerResponse = {
                id: response.id,
                message: {
                    role: 'assistant',
                    content: ''
                }
            };
            // Extract text content
            const textContent = response.content.find((c) => c.type === 'text');
            if (textContent && 'text' in textContent) {
                providerResponse.message.content = textContent.text || '';
            }
            // Add tool calls if present
            if (response.content.some((c) => c.type === 'tool_use')) {
                const toolCalls = response.content
                    .filter((c) => c.type === 'tool_use')
                    .map((c) => ({
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
        }
        catch (error) {
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
    async sendStreamingRequest(request, onChunk) {
        var _a, _b, _c, _d;
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
                const stream = streamResponse;
                // Process the stream
                let responseId = '';
                for await (const chunk of stream) {
                    // Store the response ID
                    if (!responseId && ((_a = chunk.message) === null || _a === void 0 ? void 0 : _a.id)) {
                        responseId = chunk.message.id;
                    }
                    // Process delta
                    if (chunk.type === 'content_block_delta' && ((_b = chunk.delta) === null || _b === void 0 ? void 0 : _b.text)) {
                        const providerChunk = {
                            id: responseId || 'stream',
                            delta: {
                                content: chunk.delta.text
                            }
                        };
                        // Call the callback with the chunk
                        onChunk(providerChunk);
                    }
                    else if (chunk.type === 'content_block_start' && ((_c = chunk.content_block) === null || _c === void 0 ? void 0 : _c.type) === 'tool_use') {
                        // Handle tool use start
                        const toolUse = chunk.content_block;
                        const providerChunk = {
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
                    }
                    else if (chunk.type === 'tool_use_delta' && ((_d = chunk.delta) === null || _d === void 0 ? void 0 : _d.input)) {
                        // Handle tool use input delta
                        const providerChunk = {
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
            throw new Error(`Anthropic streaming request failed: ${error.message}`);
        }
        finally {
            this.abortController = null;
        }
    }
    /**
     * Create an Anthropic request from our common request format.
     *
     * @param request Our common request format
     * @returns Anthropic request format
     */
    createAnthropicRequest(request) {
        // Map our messages to Anthropic format
        const messages = request.messages.map(msg => {
            const anthropicMsg = {
                role: this.mapRole(msg.role),
                content: msg.content
            };
            return anthropicMsg;
        });
        // Create the Anthropic request
        const anthropicRequest = {
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
    mapRole(role) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQW50aHJvcGljQWRhcHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIkFudGhyb3BpY0FkYXB0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7O0dBS0c7QUFFSCwyQkFBMkI7QUFDM0IsT0FBTyxTQUFTLE1BQU0sbUJBQW1CLENBQUM7QUFDMUMsT0FBTyxFQU1MLGFBQWEsRUFDZCxNQUFNLG9CQUFvQixDQUFDO0FBQzVCLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFFNUM7O0dBRUc7QUFDSCxNQUFNLE9BQU8sZ0JBQWlCLFNBQVEsV0FBVztJQVcvQzs7Ozs7T0FLRztJQUNILFlBQVksTUFBYyxFQUFFLFdBQW9CO1FBQzlDLEtBQUssQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFqQjdCOztXQUVHO1FBQ00sYUFBUSxHQUFHLFdBQVcsQ0FBQztRQWdCOUIsTUFBTSxPQUFPLEdBQVE7WUFDbkIsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNO1lBQ25CLHVCQUF1QixFQUFFLElBQUksQ0FBQyx3Q0FBd0M7U0FDdkUsQ0FBQztRQUVGLHNDQUFzQztRQUN0QyxJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUNyQixPQUFPLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUM7UUFDckMsQ0FBQztRQUVELElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDdkMsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0gsS0FBSyxDQUFDLGNBQWM7UUFDbEIsSUFBSSxDQUFDO1lBQ0gsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBRXRCLGdEQUFnRDtZQUNoRCxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQztnQkFDaEMsS0FBSyxFQUFFLHlCQUF5QjtnQkFDaEMsVUFBVSxFQUFFLENBQUM7Z0JBQ2IsUUFBUSxFQUFFLENB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UUFDMUIsUUFBUSxJQUFJLEVBQUUsQ0FBQztZQUNiLEtBQUssUUFBUTtnQkFDWCxPQUFPLFFBQVEsQ0FBQztZQUNsQixLQUFLLFdBQVc7Z0JBQ2QsT0FBTyxXQUFXLENBQUM7WUFDckIsS0FBSyxNQUFNLENBQUM7WUFDWixLQUFLLE9BQU87Z0JBQ1YsT0FBTyxNQUFNLENBQUM7WUFDaEI7Z0JBQ0UsT0FBTyxNQUFNLENBQUM7UUFDbEIsQ0FBQztJQUNILENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBBbnRocm9waWMgUHJvdmlkZXIgQWRhcHRlclxyXG4gKiBcclxuICogVGhpcyBmaWxlIGltcGxlbWVudHMgdGhlIFByb3ZpZGVyQWRhcHRlciBpbnRlcmZhY2UgZm9yIHRoZSBBbnRocm9waWMgQVBJLlxyXG4gKiBJdCB1c2VzIHRoZSBvZmZpY2lhbCBBbnRocm9waWMgU0RLIHRvIGNvbW11bmljYXRlIHdpdGggdGhlIEFudGhyb3BpYyBBUEkuXHJcbiAqL1xyXG5cclxuLy8gSW1wb3J0IHRoZSBBbnRocm9waWMgU0RLXHJcbmltcG9ydCBBbnRocm9waWMgZnJvbSAnQGFudGhyb3BpYy1haS9zZGsnO1xyXG5pbXBvcnQgeyBcclxuICBNb2RlbEluZm8sIFxyXG4gIFByb3ZpZGVyQ2h1bmssIFxyXG4gIFByb3ZpZGVyTWVzc2FnZSwgXHJcbiAgUHJvdmlkZXJSZXF1ZXN0LCBcclxuICBQcm92aWRlclJlc3BvbnNlLFxyXG4gIENPTU1PTl9NT0RFTFNcclxufSBmcm9tICcuLi9tb2RlbHMvUHJvdmlkZXInO1xyXG5pbXBvcnQgeyBCYXNlQWRhcHRlciB9IGZyb20gJy4vQmFzZUFkYXB0ZXInO1xyXG5cclxuLyoqXHJcbiAqIEFkYXB0ZXIgZm9yIHRoZSBBbnRocm9waWMgQVBJLlxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEFudGhyb3BpY0FkYXB0ZXIgZXh0ZW5kcyBCYXNlQWRhcHRlciB7XHJcbiAgLyoqXHJcbiAgICogVGhlIG5hbWUgb2YgdGhlIHByb3ZpZGVyXHJcbiAgICovXHJcbiAgcmVhZG9ubHkgcHJvdmlkZXIgPSAnYW50aHJvcGljJztcclxuXHJcbiAgLyoqXHJcbiAgICogVGhlIEFudGhyb3BpYyBjbGllbnQgaW5zdGFuY2VcclxuICAgKi9cclxuICBwcml2YXRlIGNsaWVudDogQW50aHJvcGljO1xyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSBuZXcgQW50aHJvcGljQWRhcHRlci5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gYXBpS2V5IFRoZSBBbnRocm9waWMgQVBJIGtleVxyXG4gICAqIEBwYXJhbSBhcGlFbmRwb2ludCBPcHRpb25hbCBjdXN0b20gQVBJIGVuZHBvaW50IFVSTFxyXG4gICAqL1xyXG4gIGNvbnN0cnVjdG9yKGFwaUtleTogc3RyaW5nLCBhcGlFbmRwb2ludD86IHN0cmluZykge1xyXG4gICAgc3VwZXIoYXBpS2V5LCBhcGlFbmRwb2ludCk7XHJcbiAgICBcclxuICAgIGNvbnN0IG9wdGlvbnM6IGFueSA9IHtcclxuICAgICAgYXBpS2V5OiB0aGlzLmFwaUtleSxcclxuICAgICAgZGFuZ2Vyb3VzbHlBbGxvd0Jyb3dzZXI6IHRydWUgLy8gQWxsb3cgYnJvd3NlciBlbnZpcm9ubWVudCBmb3IgdGVzdGluZ1xyXG4gICAgfTtcclxuXHJcbiAgICAvLyBVc2UgY3VzdG9tIEFQSSBlbmRwb2ludCBpZiBwcm92aWRlZFxyXG4gICAgaWYgKHRoaXMuYXBpRW5kcG9pbnQpIHtcclxuICAgICAgb3B0aW9ucy5iYXNlVVJMID0gdGhpcy5hcGlFbmRwb2ludDtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmNsaWVudCA9IG5ldyBBbnRocm9waWMob3B0aW9ucyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBUZXN0IHRoZSBjb25uZWN0aW9uIHRvIHRoZSBBbnRocm9waWMgQVBJLlxyXG4gICAqIE1ha2VzIGEgbGlnaHR3ZWlnaHQgQVBJIGNhbGwgdG8gdmVyaWZ5IGNyZWRlbnRpYWxzLlxyXG4gICAqIFxyXG4gICAqIEByZXR1cm5zIEEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIHRydWUgaWYgdGhlIGNvbm5lY3Rpb24gaXMgc3VjY2Vzc2Z1bCwgZmFsc2Ugb3RoZXJ3aXNlXHJcbiAgICovXHJcbiAgYXN5bmMgdGVzdENvbm5lY3Rpb24oKTogUHJvbWlzZTxib29sZWFuPiB7XHJcbiAgICB0cnkge1xyXG4gICAgICB0aGlzLnZhbGlkYXRlQXBpS2V5KCk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBNYWtlIGEgbWluaW1hbCByZXF1ZXN0IHRvIHRlc3QgdGhlIGNvbm5lY3Rpb25cclxuICAgICAgYXdhaXQgdGhpcy5jbGllbnQubWVzc2FnZXMuY3JlYXRlKHtcclxuICAgICAgICBtb2RlbDogJ2NsYXVkZS0zLWhhaWt1LTIwMjQwMzA3JyxcclxuICAgICAgICBtYXhfdG9rZW5zOiAxLFxyXG4gICAgICAgIG1lc3NhZ2VzOiBbeyByb2xlOiAndXNlcicsIGNvbnRlbnQ6ICdIZWxsbycgfV1cclxuICAgICAgfSk7XHJcbiAgICAgIFxyXG4gICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIHRoaXMubG9nRXJyb3IoJ3Rlc3RDb25uZWN0aW9uJywgZXJyb3IpO1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSBsaXN0IG9mIGF2YWlsYWJsZSBtb2RlbHMgZnJvbSBBbnRocm9waWMuXHJcbiAgICogXHJcbiAgICogQHJldHVybnMgQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gYW4gYXJyYXkgb2YgTW9kZWxJbmZvIG9iamVjdHNcclxuICAgKi9cclxuICBhc3luYyBnZXRBdmFpbGFibGVNb2RlbHMoKTogUHJvbWlzZTxNb2RlbEluZm9bXT4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgdGhpcy52YWxpZGF0ZUFwaUtleSgpO1xyXG4gICAgICBcclxuICAgICAgLy8gQW50aHJvcGljIGRvZXNuJ3QgaGF2ZSBhIG1vZGVscyBlbmRwb2ludCwgc28gd2UgcmV0dXJuIHRoZSBrbm93biBtb2RlbHNcclxuICAgICAgcmV0dXJuIENPTU1PTl9NT0RFTFMuZmlsdGVyKG1vZGVsID0+IG1vZGVsLnByb3ZpZGVyID09PSB0aGlzLnByb3ZpZGVyKTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIHRoaXMubG9nRXJyb3IoJ2dldEF2YWlsYWJsZU1vZGVscycsIGVycm9yKTtcclxuICAgICAgcmV0dXJuIENPTU1PTl9NT0RFTFMuZmlsdGVyKG1vZGVsID0+IG1vZGVsLnByb3ZpZGVyID09PSB0aGlzLnByb3ZpZGVyKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNlbmQgYSByZXF1ZXN0IHRvIHRoZSBBbnRocm9waWMgQVBJIGFuZCBnZXQgYSBjb21wbGV0ZSByZXNwb25zZS5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gcmVxdWVzdCBUaGUgcmVxdWVzdCBwYXJhbWV0ZXJzXHJcbiAgICogQHJldHVybnMgQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gYSBQcm92aWRlclJlc3BvbnNlXHJcbiAgICovXHJcbiAgYXN5bmMgc2VuZFJlcXVlc3QocmVxdWVzdDogUHJvdmlkZXJSZXF1ZXN0KTogUHJvbWlzZTxQcm92aWRlclJlc3BvbnNlPiB7XHJcbiAgICB0cnkge1xyXG4gICAgICB0aGlzLnZhbGlkYXRlQXBpS2V5KCk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBDcmVhdGUgdGhlIEFudGhyb3BpYyByZXF1ZXN0XHJcbiAgICAgIGNvbnN0IGFudGhyb3BpY1JlcXVlc3QgPSB0aGlzLmNyZWF0ZUFudGhyb3BpY1JlcXVlc3QocmVxdWVzdCk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBTZW5kIHRoZSByZXF1ZXN0XHJcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5jbGllbnQubWVzc2FnZXMuY3JlYXRlKGFudGhyb3BpY1JlcXVlc3QpO1xyXG4gICAgICBcclxuICAgICAgLy8gQ29udmVydCB0aGUgcmVzcG9uc2UgdG8gb3VyIGZvcm1hdFxyXG4gICAgICBjb25zdCBwcm92aWRlclJlc3BvbnNlOiBQcm92aWRlclJlc3BvbnNlID0ge1xyXG4gICAgICAgIGlkOiByZXNwb25zZS5pZCxcclxuICAgICAgICBtZXNzYWdlOiB7XHJcbiAgICAgICAgICByb2xlOiAnYXNzaXN0YW50JyxcclxuICAgICAgICAgIGNvbnRlbnQ6ICcnXHJcbiAgICAgICAgfVxyXG4gICAgICB9O1xyXG4gICAgICBcclxuICAgICAgLy8gRXh0cmFjdCB0ZXh0IGNvbnRlbnRcclxuICAgICAgY29uc3QgdGV4dENvbnRlbnQgPSByZXNwb25zZS5jb250ZW50LmZpbmQoKGM6IGFueSkgPT4gYy50eXBlID09PSAndGV4dCcpO1xyXG4gICAgICBpZiAodGV4dENvbnRlbnQgJiYgJ3RleHQnIGluIHRleHRDb250ZW50KSB7XHJcbiAgICAgICAgcHJvdmlkZXJSZXNwb25zZS5tZXNzYWdlLmNvbnRlbnQgPSB0ZXh0Q29udGVudC50ZXh0IHx8ICcnO1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICAvLyBBZGQgdG9vbCBjYWxscyBpZiBwcmVzZW50XHJcbiAgICAgIGlmIChyZXNwb25zZS5jb250ZW50LnNvbWUoKGM6IGFueSkgPT4gYy50eXBlID09PSAndG9vbF91c2UnKSkge1xyXG4gICAgICAgIGNvbnN0IHRvb2xDYWxscyA9IHJlc3BvbnNlLmNvbnRlbnRcclxuICAgICAgICAgIC5maWx0ZXIoKGM6IGFueSkgPT4gYy50eXBlID09PSAndG9vbF91c2UnKVxyXG4gICAgICAgICAgLm1hcCgoYzogYW55KSA9PiAoe1xyXG4gICAgICAgICAgICBpZDogYy5pZCxcclxuICAgICAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcclxuICAgICAgICAgICAgZnVuY3Rpb246IHtcclxuICAgICAgICAgICAgICBuYW1lOiBjLm5hbWUsXHJcbiAgICAgICAgICAgICAgYXJndW1lbnRzOiBjLmlucHV0XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0pKTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAodG9vbENhbGxzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgIHByb3ZpZGVyUmVzcG9uc2UudG9vbENhbGxzID0gdG9vbENhbGxzO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgcmV0dXJuIHByb3ZpZGVyUmVzcG9uc2U7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICB0aGlzLmxvZ0Vycm9yKCdzZW5kUmVxdWVzdCcsIGVycm9yKTtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBbnRocm9waWMgcmVxdWVzdCBmYWlsZWQ6ICR7ZXJyb3IubWVzc2FnZX1gKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNlbmQgYSBzdHJlYW1pbmcgcmVxdWVzdCB0byB0aGUgQW50aHJvcGljIEFQSS5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gcmVxdWVzdCBUaGUgcmVxdWVzdCBwYXJhbWV0ZXJzIChzaG91bGQgaGF2ZSBzdHJlYW06IHRydWUpXHJcbiAgICogQHBhcmFtIG9uQ2h1bmsgQ2FsbGJhY2sgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGNhbGxlZCBmb3IgZWFjaCBjaHVuayByZWNlaXZlZFxyXG4gICAqIEByZXR1cm5zIEEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdoZW4gdGhlIHN0cmVhbSBpcyBjb21wbGV0ZVxyXG4gICAqL1xyXG4gIGFzeW5jIHNlbmRTdHJlYW1pbmdSZXF1ZXN0KFxyXG4gICAgcmVxdWVzdDogUHJvdmlkZXJSZXF1ZXN0LFxyXG4gICAgb25DaHVuazogKGNodW5rOiBQcm92aWRlckNodW5rKSA9PiB2b2lkXHJcbiAgKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICB0cnkge1xyXG4gICAgICB0aGlzLnZhbGlkYXRlQXBpS2V5KCk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBFbnN1cmUgc3RyZWFtIGlzIHRydWVcclxuICAgICAgcmVxdWVzdC5zdHJlYW0gPSB0cnVlO1xyXG4gICAgICBcclxuICAgICAgLy8gQ3JlYXRlIHRoZSBBbnRocm9waWMgcmVxdWVzdFxyXG4gICAgICBjb25zdCBhbnRocm9waWNSZXF1ZXN0ID0gdGhpcy5jcmVhdGVBbnRocm9waWNSZXF1ZXN0KHJlcXVlc3QpO1xyXG4gICAgICBcclxuICAgICAgLy8gQ3JlYXRlIGFuIEFib3J0Q29udHJvbGxlciBmb3IgdGhpcyByZXF1ZXN0XHJcbiAgICAgIGNvbnN0IGFib3J0Q29udHJvbGxlciA9IHRoaXMuY3JlYXRlQWJvcnRDb250cm9sbGVyKCk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBTZW5kIHRoZSBzdHJlYW1pbmcgcmVxdWVzdFxyXG4gICAgICBjb25zdCBzdHJlYW1SZXNwb25zZSA9IGF3YWl0IHRoaXMuY2xpZW50Lm1lc3NhZ2VzLmNyZWF0ZSh7XHJcbiAgICAgICAgLi4uYW50aHJvcGljUmVxdWVzdCxcclxuICAgICAgICBzdHJlYW06IHRydWVcclxuICAgICAgfSwge1xyXG4gICAgICAgIHNpZ25hbDogYWJvcnRDb250cm9sbGVyLnNpZ25hbFxyXG4gICAgICB9KTtcclxuICAgICAgXHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgLy8gVXNlIHR5cGUgYXNzZXJ0aW9uIHRvIGVuc3VyZSBUeXBlU2NyaXB0IGtub3dzIHRoaXMgaXMgYW4gYXN5bmMgaXRlcmFibGVcclxuICAgICAgICBjb25zdCBzdHJlYW0gPSBzdHJlYW1SZXNwb25zZSBhcyB1bmtub3duIGFzIEFzeW5jSXRlcmFibGU8YW55PjtcclxuICAgICAgICBcclxuICAgICAgICAvLyBQcm9jZXNzIHRoZSBzdHJlYW1cclxuICAgICAgICBsZXQgcmVzcG9uc2VJZCA9ICcnO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2Ygc3RyZWFtKSB7XHJcbiAgICAgICAgICAvLyBTdG9yZSB0aGUgcmVzcG9uc2UgSURcclxuICAgICAgICAgIGlmICghcmVzcG9uc2VJZCAmJiBjaHVuay5tZXNzYWdlPy5pZCkge1xyXG4gICAgICAgICAgICByZXNwb25zZUlkID0gY2h1bmsubWVzc2FnZS5pZDtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIFxyXG4gICAgICAgICAgLy8gUHJvY2VzcyBkZWx0YVxyXG4gICAgICAgICAgaWYgKGNodW5rLnR5cGUgPT09ICdjb250ZW50X2Jsb2NrX2RlbHRhJyAmJiBjaHVuay5kZWx0YT8udGV4dCkge1xyXG4gICAgICAgICAgICBjb25zdCBwcm92aWRlckNodW5rOiBQcm92aWRlckNodW5rID0ge1xyXG4gICAgICAgICAgICAgIGlkOiByZXNwb25zZUlkIHx8ICdzdHJlYW0nLFxyXG4gICAgICAgICAgICAgIGRlbHRhOiB7XHJcbiAgICAgICAgICAgICAgICBjb250ZW50OiBjaHVuay5kZWx0YS50ZXh0XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gQ2FsbCB0aGUgY2FsbGJhY2sgd2l0aCB0aGUgY2h1bmtcclxuICAgICAgICAgICAgb25DaHVuayhwcm92aWRlckNodW5rKTtcclxuICAgICAgICAgIH0gZWxzZSBpZiAoY2h1bmsudHlwZSA9PT0gJ2NvbnRlbnRfYmxvY2tfc3RhcnQnICYmIGNodW5rLmNvbnRlbnRfYmxvY2s/LnR5cGUgPT09ICd0b29sX3VzZScpIHtcclxuICAgICAgICAgICAgLy8gSGFuZGxlIHRvb2wgdXNlIHN0YXJ0XHJcbiAgICAgICAgICAgIGNvbnN0IHRvb2xVc2UgPSBjaHVuay5jb250ZW50X2Jsb2NrO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgY29uc3QgcHJvdmlkZXJDaHVuazogUHJvdmlkZXJDaHVuayA9IHtcclxuICAgICAgICAgICAgICBpZDogcmVzcG9uc2VJZCB8fCAnc3RyZWFtJyxcclxuICAgICAgICAgICAgICBkZWx0YToge1xyXG4gICAgICAgICAgICAgICAgdG9vbENhbGxzOiBbe1xyXG4gICAgICAgICAgICAgICAgICBpZDogdG9vbFVzZS5pZCxcclxuICAgICAgICAgICAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcclxuICAgICAgICAgICAgICAgICAgZnVuY3Rpb246IHtcclxuICAgICAgICAgICAgICAgICAgICBuYW1lOiB0b29sVXNlLm5hbWUsXHJcbiAgICAgICAgICAgICAgICAgICAgYXJndW1lbnRzOiAne30nXHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1dXHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgb25DaHVuayhwcm92aWRlckNodW5rKTtcclxuICAgICAgICAgIH0gZWxzZSBpZiAoY2h1bmsudHlwZSA9PT0gJ3Rvb2xfdXNlX2RlbHRhJyAmJiBjaHVuay5kZWx0YT8uaW5wdXQpIHtcclxuICAgICAgICAgICAgLy8gSGFuZGxlIHRvb2wgdXNlIGlucHV0IGRlbHRhXHJcbiAgICAgICAgICAgIGNvbnN0IHByb3ZpZGVyQ2h1bms6IFByb3ZpZGVyQ2h1bmsgPSB7XHJcbiAgICAgICAgICAgICAgaWQ6IHJlc3BvbnNlSWQgfHwgJ3N0cmVhbScsXHJcbiAgICAgICAgICAgICAgZGVsdGE6IHtcclxuICAgICAgICAgICAgICAgIHRvb2xDYWxsczogW3tcclxuICAgICAgICAgICAgICAgICAgaWQ6IGNodW5rLmlkLFxyXG4gICAgICAgICAgICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxyXG4gICAgICAgICAgICAgICAgICBmdW5jdGlvbjoge1xyXG4gICAgICAgICAgICAgICAgICAgIGFyZ3VtZW50czogY2h1bmsuZGVsdGEuaW5wdXRcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfV1cclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBvbkNodW5rKHByb3ZpZGVyQ2h1bmspO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfSBjYXRjaCAoc3RyZWFtRXJyb3IpIHtcclxuICAgICAgICBpZiAoc3RyZWFtRXJyb3IubmFtZSA9PT0gJ0Fib3J0RXJyb3InKSB7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRocm93IHN0cmVhbUVycm9yO1xyXG4gICAgICB9XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAvLyBJZ25vcmUgYWJvcnQgZXJyb3JzXHJcbiAgICAgIGlmIChlcnJvci5uYW1lID09PSAnQWJvcnRFcnJvcicpIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIHRoaXMubG9nRXJyb3IoJ3NlbmRTdHJlYW1pbmdSZXF1ZXN0JywgZXJyb3IpO1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFudGhyb3BpYyBzdHJlYW1pbmcgcmVxdWVzdCBmYWlsZWQ6ICR7ZXJyb3IubWVzc2FnZX1gKTtcclxuICAgIH0gZmluYWxseSB7XHJcbiAgICAgIHRoaXMuYWJvcnRDb250cm9sbGVyID0gbnVsbDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhbiBBbnRocm9waWMgcmVxdWVzdCBmcm9tIG91ciBjb21tb24gcmVxdWVzdCBmb3JtYXQuXHJcbiAgICogXHJcbiAgICogQHBhcmFtIHJlcXVlc3QgT3VyIGNvbW1vbiByZXF1ZXN0IGZvcm1hdFxyXG4gICAqIEByZXR1cm5zIEFudGhyb3BpYyByZXF1ZXN0IGZvcm1hdFxyXG4gICAqL1xyXG4gIHByaXZhdGUgY3JlYXRlQW50aHJvcGljUmVxdWVzdChyZXF1ZXN0OiBQcm92aWRlclJlcXVlc3QpOiBhbnkge1xyXG4gICAgLy8gTWFwIG91ciBtZXNzYWdlcyB0byBBbnRocm9waWMgZm9ybWF0XHJcbiAgICBjb25zdCBtZXNzYWdlcyA9IHJlcXVlc3QubWVzc2FnZXMubWFwKG1zZyA9PiB7XHJcbiAgICAgIGNvbnN0IGFudGhyb3BpY01zZzogYW55ID0ge1xyXG4gICAgICAgIHJvbGU6IHRoaXMubWFwUm9sZShtc2cucm9sZSksXHJcbiAgICAgICAgY29udGVudDogbXNnLmNvbnRlbnRcclxuICAgICAgfTtcclxuICAgICAgXHJcbiAgICAgIHJldHVybiBhbnRocm9waWNNc2c7XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgLy8gQ3JlYXRlIHRoZSBBbnRocm9waWMgcmVxdWVzdFxyXG4gICAgY29uc3QgYW50aHJvcGljUmVxdWVzdDogYW55ID0ge1xyXG4gICAgICBtb2RlbDogcmVxdWVzdC5tb2RlbCxcclxuICAgICAgbWVzc2FnZXMsXHJcbiAgICAgIG1heF90b2tlbnM6IHJlcXVlc3QubWF4VG9rZW5zIHx8IDQwOTYsXHJcbiAgICAgIHN0cmVhbTogcmVxdWVzdC5zdHJlYW0gfHwgZmFsc2VcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8vIEFkZCB0ZW1wZXJhdHVyZSBpZiBwcmVzZW50XHJcbiAgICBpZiAocmVxdWVzdC50ZW1wZXJhdHVyZSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIGFudGhyb3BpY1JlcXVlc3QudGVtcGVyYXR1cmUgPSByZXF1ZXN0LnRlbXBlcmF0dXJlO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBBZGQgdG9vbHMgaWYgcHJlc2VudFxyXG4gICAgaWYgKHJlcXVlc3QudG9vbHMgJiYgcmVxdWVzdC50b29scy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIGFudGhyb3BpY1JlcXVlc3QudG9vbHMgPSByZXF1ZXN0LnRvb2xzLm1hcCh0b29sID0+IHtcclxuICAgICAgICBpZiAodG9vbC50eXBlID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBuYW1lOiB0b29sLmZ1bmN0aW9uLm5hbWUsXHJcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiB0b29sLmZ1bmN0aW9uLmRlc2NyaXB0aW9uLFxyXG4gICAgICAgICAgICBpbnB1dF9zY2hlbWE6IHRvb2wuZnVuY3Rpb24ucGFyYW1ldGVyc1xyXG4gICAgICAgICAgfTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRvb2w7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gYW50aHJvcGljUmVxdWVzdDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIE1hcCBvdXIgcm9sZSBuYW1lcyB0byBBbnRocm9waWMgcm9sZSBuYW1lcy5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gcm9sZSBPdXIgcm9sZSBuYW1lXHJcbiAgICogQHJldHVybnMgQW50aHJvcGljIHJvbGUgbmFtZVxyXG4gICAqL1xyXG4gIHByaXZhdGUgbWFwUm9sZShyb2xlOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgc3dpdGNoIChyb2xlKSB7XHJcbiAgICAgIGNhc2UgJ3N5c3RlbSc6XHJcbiAgICAgICAgcmV0dXJuICdzeXN0ZW0nO1xyXG4gICAgICBjYXNlICdhc3Npc3RhbnQnOlxyXG4gICAgICAgIHJldHVybiAnYXNzaXN0YW50JztcclxuICAgICAgY2FzZSAndXNlcic6XHJcbiAgICAgIGNhc2UgJ2h1bWFuJzpcclxuICAgICAgICByZXR1cm4gJ3VzZXInO1xyXG4gICAgICBkZWZhdWx0OlxyXG4gICAgICAgIHJldHVybiAndXNlcic7XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcbiJdfQ==