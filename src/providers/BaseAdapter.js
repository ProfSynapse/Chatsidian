/**
 * Base Provider Adapter
 *
 * This file provides a base implementation of the ProviderAdapter interface
 * with common functionality that can be shared across all provider adapters.
 *
 * Specific provider adapters can extend this class and override methods as needed
 * while inheriting common behavior.
 */
import { modelRegistry } from './ModelRegistry';
/**
 * Abstract base class for provider adapters.
 * Implements common functionality and provides a foundation for specific adapters.
 */
export class BaseAdapter {
    /**
     * Create a new BaseAdapter.
     *
     * @param apiKey The API key for the provider
     * @param apiEndpoint Optional custom API endpoint URL
     */
    constructor(apiKey, apiEndpoint) {
        /**
         * AbortController for cancelling requests
         */
        this.abortController = null;
        this.apiKey = apiKey;
        this.apiEndpoint = apiEndpoint;
    }
    /**
     * Get a list of available models from this provider.
     * Default implementation uses the ModelRegistry to get models.
     * Providers can override this method to fetch models from their API if needed.
     */
    async getAvailableModels() {
        try {
            // Get models from the ModelRegistry
            return modelRegistry.getModelsForProvider(this.provider);
        }
        catch (error) {
            this.logError('getAvailableModels', error);
            return [];
        }
    }
    /**
     * Cancel an ongoing streaming request.
     * This provides a common implementation that can be overridden if needed.
     */
    async cancelRequest() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }
    /**
     * Create a new AbortController for a request.
     * This is used internally to manage request cancellation.
     *
     * @returns The created AbortController
     */
    createAbortController() {
        // Cancel any existing request first
        if (this.abortController) {
            this.abortController.abort();
        }
        this.abortController = new AbortController();
        return this.abortController;
    }
    /**
     * Log an error with consistent formatting.
     *
     * @param method The method where the error occurred
     * @param error The error object
     */
    logError(method, error) {
        console.error(`[${this.provider}Adapter.${method}] Error:`, error);
    }
    /**
     * Validate that the API key is not empty.
     *
     * @throws Error if the API key is empty
     */
    validateApiKey() {
        if (!this.apiKey) {
            throw new Error(`API key is required for ${this.provider}`);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQmFzZUFkYXB0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJCYXNlQWRhcHRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7R0FRRztBQVNILE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUU5Qzs7O0dBR0c7QUFDSCxNQUFNLE9BQWdCLFdBQVc7SUFxQi9COzs7OztPQUtHO0lBQ0gsWUFBWSxNQUFjLEVBQUUsV0FBb0I7UUFYaEQ7O1dBRUc7UUFDTyxvQkFBZSxHQUEyQixJQUFJLENBQUM7UUFTdkQsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFDckIsSUFBSSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUM7SUFDakMsQ0FBQztJQVFEOzs7O09BSUc7SUFDSCxLQUFLLENBQUMsa0JBQWtCO1FBQ3RCLElBQUksQ0FBQztZQUNILDRDQUE0QztZQUM1QyxNQUFNLFlBQVksR0FBRyxZQUFZLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDaEQsT0FBTyxZQUFZLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzFELENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsSUFBSSxDQUFDLFFBQVEsQ0FBQyxvQkFBb0IsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUMzQyxPQUFPLEVBQUUsQ0FBQztRQUNaLENBQUM7SUFDSCxDQUFDO0lBaUJEOzs7T0FHRztJQUNILEtBQUssQ0FBQyxhQUFhO1FBQ2pCLElBQUksSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQ3pCLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDN0IsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUM7UUFDOUIsQ0FBQztJQUNILENBQUM7SUFFRDs7Ozs7T0FLRztJQUNPLHFCQUFxQjtRQUM3QixvQ0FBb0M7UUFDcEMsSUFBSSxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDekIsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUMvQixDQUFDO1FBRUQsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO1FBQzdDLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQztJQUM5QixDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDTyxRQUFRLENBQUMsTUFBYyxFQUFFLEtBQVU7UUFDM0MsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxRQUFRLFdBQVcsTUFBTSxVQUFVLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDckUsQ0FBQztJQUVEOzs7O09BSUc7SUFDTyxjQUFjO1FBQ3RCLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDakIsTUFBTSxJQUFJLEtBQUssQ0FBQywyQkFBMkIsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7UUFDOUQsQ0FBQztJQUNILENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBCYXNlIFByb3ZpZGVyIEFkYXB0ZXJcclxuICogXHJcbiAqIFRoaXMgZmlsZSBwcm92aWRlcyBhIGJhc2UgaW1wbGVtZW50YXRpb24gb2YgdGhlIFByb3ZpZGVyQWRhcHRlciBpbnRlcmZhY2VcclxuICogd2l0aCBjb21tb24gZnVuY3Rpb25hbGl0eSB0aGF0IGNhbiBiZSBzaGFyZWQgYWNyb3NzIGFsbCBwcm92aWRlciBhZGFwdGVycy5cclxuICogXHJcbiAqIFNwZWNpZmljIHByb3ZpZGVyIGFkYXB0ZXJzIGNhbiBleHRlbmQgdGhpcyBjbGFzcyBhbmQgb3ZlcnJpZGUgbWV0aG9kcyBhcyBuZWVkZWRcclxuICogd2hpbGUgaW5oZXJpdGluZyBjb21tb24gYmVoYXZpb3IuXHJcbiAqL1xyXG5cclxuaW1wb3J0IHsgXHJcbiAgTW9kZWxJbmZvLCBcclxuICBQcm92aWRlckNodW5rLCBcclxuICBQcm92aWRlclJlcXVlc3QsIFxyXG4gIFByb3ZpZGVyUmVzcG9uc2UgXHJcbn0gZnJvbSAnLi4vbW9kZWxzL1Byb3ZpZGVyJztcclxuaW1wb3J0IHsgUHJvdmlkZXJBZGFwdGVyIH0gZnJvbSAnLi9Qcm92aWRlckFkYXB0ZXInO1xyXG5pbXBvcnQgeyBNb2RlbHNMb2FkZXIgfSBmcm9tICcuL01vZGVsc0xvYWRlcic7XHJcblxyXG4vKipcclxuICogQWJzdHJhY3QgYmFzZSBjbGFzcyBmb3IgcHJvdmlkZXIgYWRhcHRlcnMuXHJcbiAqIEltcGxlbWVudHMgY29tbW9uIGZ1bmN0aW9uYWxpdHkgYW5kIHByb3ZpZGVzIGEgZm91bmRhdGlvbiBmb3Igc3BlY2lmaWMgYWRhcHRlcnMuXHJcbiAqL1xyXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQmFzZUFkYXB0ZXIgaW1wbGVtZW50cyBQcm92aWRlckFkYXB0ZXIge1xyXG4gIC8qKlxyXG4gICAqIFRoZSBuYW1lIG9mIHRoZSBwcm92aWRlciAoZS5nLiwgJ2FudGhyb3BpYycsICdvcGVuYWknLCAnZ29vZ2xlJylcclxuICAgKi9cclxuICBhYnN0cmFjdCByZWFkb25seSBwcm92aWRlcjogc3RyaW5nO1xyXG5cclxuICAvKipcclxuICAgKiBUaGUgQVBJIGtleSBmb3IgYXV0aGVudGljYXRpbmcgd2l0aCB0aGUgcHJvdmlkZXJcclxuICAgKi9cclxuICBwcm90ZWN0ZWQgYXBpS2V5OiBzdHJpbmc7XHJcblxyXG4gIC8qKlxyXG4gICAqIE9wdGlvbmFsIGN1c3RvbSBBUEkgZW5kcG9pbnQgVVJMXHJcbiAgICovXHJcbiAgcHJvdGVjdGVkIGFwaUVuZHBvaW50Pzogc3RyaW5nO1xyXG5cclxuICAvKipcclxuICAgKiBBYm9ydENvbnRyb2xsZXIgZm9yIGNhbmNlbGxpbmcgcmVxdWVzdHNcclxuICAgKi9cclxuICBwcm90ZWN0ZWQgYWJvcnRDb250cm9sbGVyOiBBYm9ydENvbnRyb2xsZXIgfCBudWxsID0gbnVsbDtcclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgbmV3IEJhc2VBZGFwdGVyLlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBhcGlLZXkgVGhlIEFQSSBrZXkgZm9yIHRoZSBwcm92aWRlclxyXG4gICAqIEBwYXJhbSBhcGlFbmRwb2ludCBPcHRpb25hbCBjdXN0b20gQVBJIGVuZHBvaW50IFVSTFxyXG4gICAqL1xyXG4gIGNvbnN0cnVjdG9yKGFwaUtleTogc3RyaW5nLCBhcGlFbmRwb2ludD86IHN0cmluZykge1xyXG4gICAgdGhpcy5hcGlLZXkgPSBhcGlLZXk7XHJcbiAgICB0aGlzLmFwaUVuZHBvaW50ID0gYXBpRW5kcG9pbnQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBUZXN0IHRoZSBjb25uZWN0aW9uIHRvIHRoZSBwcm92aWRlciBBUEkuXHJcbiAgICogVGhpcyBzaG91bGQgYmUgaW1wbGVtZW50ZWQgYnkgZWFjaCBzcGVjaWZpYyBhZGFwdGVyLlxyXG4gICAqL1xyXG4gIGFic3RyYWN0IHRlc3RDb25uZWN0aW9uKCk6IFByb21pc2U8Ym9vbGVhbj47XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIGxpc3Qgb2YgYXZhaWxhYmxlIG1vZGVscyBmcm9tIHRoaXMgcHJvdmlkZXIuXHJcbiAgICogRGVmYXVsdCBpbXBsZW1lbnRhdGlvbiB1c2VzIHRoZSBNb2RlbHNMb2FkZXIgdG8gZ2V0IG1vZGVscyBmcm9tIHRoZSBZQU1MIGZpbGUuXHJcbiAgICogUHJvdmlkZXJzIGNhbiBvdmVycmlkZSB0aGlzIG1ldGhvZCB0byBmZXRjaCBtb2RlbHMgZnJvbSB0aGVpciBBUEkgaWYgbmVlZGVkLlxyXG4gICAqL1xyXG4gIGFzeW5jIGdldEF2YWlsYWJsZU1vZGVscygpOiBQcm9taXNlPE1vZGVsSW5mb1tdPiB7XHJcbiAgICB0cnkge1xyXG4gICAgICAvLyBHZXQgbW9kZWxzIGZyb20gdGhlIGNlbnRyYWxpemVkIFlBTUwgZmlsZVxyXG4gICAgICBjb25zdCBtb2RlbHNMb2FkZXIgPSBNb2RlbHNMb2FkZXIuZ2V0SW5zdGFuY2UoKTtcclxuICAgICAgcmV0dXJuIG1vZGVsc0xvYWRlci5nZXRNb2RlbHNGb3JQcm92aWRlcih0aGlzLnByb3ZpZGVyKTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIHRoaXMubG9nRXJyb3IoJ2dldEF2YWlsYWJsZU1vZGVscycsIGVycm9yKTtcclxuICAgICAgcmV0dXJuIFtdO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2VuZCBhIHJlcXVlc3QgdG8gdGhlIHByb3ZpZGVyIEFQSSBhbmQgZ2V0IGEgY29tcGxldGUgcmVzcG9uc2UuXHJcbiAgICogVGhpcyBzaG91bGQgYmUgaW1wbGVtZW50ZWQgYnkgZWFjaCBzcGVjaWZpYyBhZGFwdGVyLlxyXG4gICAqL1xyXG4gIGFic3RyYWN0IHNlbmRSZXF1ZXN0KHJlcXVlc3Q6IFByb3ZpZGVyUmVxdWVzdCk6IFByb21pc2U8UHJvdmlkZXJSZXNwb25zZT47XHJcblxyXG4gIC8qKlxyXG4gICAqIFNlbmQgYSBzdHJlYW1pbmcgcmVxdWVzdCB0byB0aGUgcHJvdmlkZXIgQVBJLlxyXG4gICAqIFRoaXMgc2hvdWxkIGJlIGltcGxlbWVudGVkIGJ5IGVhY2ggc3BlY2lmaWMgYWRhcHRlci5cclxuICAgKi9cclxuICBhYnN0cmFjdCBzZW5kU3RyZWFtaW5nUmVxdWVzdChcclxuICAgIHJlcXVlc3Q6IFByb3ZpZGVyUmVxdWVzdCxcclxuICAgIG9uQ2h1bms6IChjaHVuazogUHJvdmlkZXJDaHVuaykgPT4gdm9pZFxyXG4gICk6IFByb21pc2U8dm9pZD47XHJcblxyXG4gIC8qKlxyXG4gICAqIENhbmNlbCBhbiBvbmdvaW5nIHN0cmVhbWluZyByZXF1ZXN0LlxyXG4gICAqIFRoaXMgcHJvdmlkZXMgYSBjb21tb24gaW1wbGVtZW50YXRpb24gdGhhdCBjYW4gYmUgb3ZlcnJpZGRlbiBpZiBuZWVkZWQuXHJcbiAgICovXHJcbiAgYXN5bmMgY2FuY2VsUmVxdWVzdCgpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGlmICh0aGlzLmFib3J0Q29udHJvbGxlcikge1xyXG4gICAgICB0aGlzLmFib3J0Q29udHJvbGxlci5hYm9ydCgpO1xyXG4gICAgICB0aGlzLmFib3J0Q29udHJvbGxlciA9IG51bGw7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSBuZXcgQWJvcnRDb250cm9sbGVyIGZvciBhIHJlcXVlc3QuXHJcbiAgICogVGhpcyBpcyB1c2VkIGludGVybmFsbHkgdG8gbWFuYWdlIHJlcXVlc3QgY2FuY2VsbGF0aW9uLlxyXG4gICAqIFxyXG4gICAqIEByZXR1cm5zIFRoZSBjcmVhdGVkIEFib3J0Q29udHJvbGxlclxyXG4gICAqL1xyXG4gIHByb3RlY3RlZCBjcmVhdGVBYm9ydENvbnRyb2xsZXIoKTogQWJvcnRDb250cm9sbGVyIHtcclxuICAgIC8vIENhbmNlbCBhbnkgZXhpc3RpbmcgcmVxdWVzdCBmaXJzdFxyXG4gICAgaWYgKHRoaXMuYWJvcnRDb250cm9sbGVyKSB7XHJcbiAgICAgIHRoaXMuYWJvcnRDb250cm9sbGVyLmFib3J0KCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHRoaXMuYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xyXG4gICAgcmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogTG9nIGFuIGVycm9yIHdpdGggY29uc2lzdGVudCBmb3JtYXR0aW5nLlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBtZXRob2QgVGhlIG1ldGhvZCB3aGVyZSB0aGUgZXJyb3Igb2NjdXJyZWRcclxuICAgKiBAcGFyYW0gZXJyb3IgVGhlIGVycm9yIG9iamVjdFxyXG4gICAqL1xyXG4gIHByb3RlY3RlZCBsb2dFcnJvcihtZXRob2Q6IHN0cmluZywgZXJyb3I6IGFueSk6IHZvaWQge1xyXG4gICAgY29uc29sZS5lcnJvcihgWyR7dGhpcy5wcm92aWRlcn1BZGFwdGVyLiR7bWV0aG9kfV0gRXJyb3I6YCwgZXJyb3IpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVmFsaWRhdGUgdGhhdCB0aGUgQVBJIGtleSBpcyBub3QgZW1wdHkuXHJcbiAgICogXHJcbiAgICogQHRocm93cyBFcnJvciBpZiB0aGUgQVBJIGtleSBpcyBlbXB0eVxyXG4gICAqL1xyXG4gIHByb3RlY3RlZCB2YWxpZGF0ZUFwaUtleSgpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5hcGlLZXkpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBUEkga2V5IGlzIHJlcXVpcmVkIGZvciAke3RoaXMucHJvdmlkZXJ9YCk7XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcbiJdfQ==