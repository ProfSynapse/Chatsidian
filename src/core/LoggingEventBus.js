/**
 * Logging wrapper for the EventBus.
 *
 * Adds debug logging for all events when debug mode is enabled.
 */
/**
 * LoggingEventBus class that wraps an EventBus with debug logging.
 */
export class LoggingEventBus {
    /**
     * Create a new LoggingEventBus.
     * @param eventBus EventBus to wrap
     * @param debugMode Whether to enable debug logging
     */
    constructor(eventBus, debugMode = false) {
        this.eventBus = eventBus;
        this.debugMode = debugMode;
    }
    /**
     * Set debug mode.
     * @param enabled Whether to enable debug logging
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }
    /**
     * Register an event handler.
     * @param event Event name to listen for
     * @param callback Function to call when the event is emitted
     * @returns The callback function for use with offref
     */
    on(event, callback) {
        const result = this.eventBus.on(event, callback);
        if (this.debugMode) {
            console.log(`[EventBus] Registered handler for '${event}'`);
        }
        return result;
    }
    /**
     * Unregister an event handler.
     * @param event Event name
     * @param callback Function to remove from listeners
     */
    off(event, callback) {
        this.eventBus.off(event, callback);
        if (this.debugMode) {
            console.log(`[EventBus] Unregistered handler for '${event}'`);
        }
    }
    /**
     * Emit an event to all registered listeners.
     * @param event Event name
     * @param data Optional data to pass to listeners
     */
    emit(event, data) {
        if (this.debugMode) {
            console.log(`[EventBus] Emitting event '${event}'`, data);
        }
        this.eventBus.emit(event, data);
    }
    /**
     * Emit an event and wait for all handlers to complete.
     * @param event Event name
     * @param data Optional data to pass to listeners
     * @returns Promise that resolves when all handlers have completed
     */
    async emitAsync(event, data) {
        if (this.debugMode) {
            console.log(`[EventBus] Emitting async event '${event}'`, data);
        }
        await this.eventBus.emitAsync(event, data);
        if (this.debugMode) {
            console.log(`[EventBus] Completed async event '${event}'`);
        }
    }
    /**
     * Remove all event handlers.
     */
    clear() {
        this.eventBus.clear();
        if (this.debugMode) {
            console.log(`[EventBus] Cleared all event handlers`);
        }
    }
    /**
     * Get a list of all events with listeners.
     * @returns Array of event names
     */
    getEvents() {
        return this.eventBus.getEvents();
    }
    /**
     * Check if an event has listeners.
     * @param event Event name
     * @returns True if the event has listeners
     */
    hasListeners(event) {
        return this.eventBus.hasListeners(event);
    }
    /**
     * Get the number of listeners for an event.
     * @param event Event name
     * @returns Number of listeners
     */
    listenerCount(event) {
        return this.eventBus.listenerCount(event);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTG9nZ2luZ0V2ZW50QnVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiTG9nZ2luZ0V2ZW50QnVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7O0dBSUc7QUFJSDs7R0FFRztBQUNILE1BQU0sT0FBTyxlQUFlO0lBSTFCOzs7O09BSUc7SUFDSCxZQUFZLFFBQWtCLEVBQUUsWUFBcUIsS0FBSztRQUN4RCxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztRQUN6QixJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQztJQUM3QixDQUFDO0lBRUQ7OztPQUdHO0lBQ0ksWUFBWSxDQUFDLE9BQWdCO1FBQ2xDLElBQUksQ0FBQyxTQUFTLEdBQUcsT0FBTyxDQUFDO0lBQzNCLENBQUM7SUFFRDs7Ozs7T0FLRztJQUNJLEVBQUUsQ0FBQyxLQUFhLEVBQUUsUUFBdUI7UUFDOUMsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBRWpELElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ25CLE9BQU8sQ0FBQyxHQUFHLENBQUMsc0NBQXNDLEtBQUssR0FBRyxDQUFDLENBQUM7UUFDOUQsQ0FBQztRQUVELE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7SUFFRDs7OztPQUlHO0lBQ0ksR0FBRyxDQUFDLEtBQWEsRUFBRSxRQUF1QjtRQUMvQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFFbkMsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDbkIsT0FBTyxDQUFDLEdBQUcsQ0FBQyx3Q0FBd0MsS0FBSyxHQUFHLENBQUMsQ0FBQztRQUNoRSxDQUFDO0lBQ0gsQ0FBQztJQUVEOzs7O09BSUc7SUFDSSxJQUFJLENBQUMsS0FBYSxFQUFFLElBQVU7UUFDbkMsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDbkIsT0FBTyxDQUFDLEdBQUcsQ0FBQyw4QkFBOEIsS0FBSyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDNUQsQ0FBQztRQUVELElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNsQyxDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSSxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQWEsRUFBRSxJQUFVO1FBQzlDLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ25CLE9BQU8sQ0FBQyxHQUFHLENBQUMsb0NBQW9DLEtBQUssR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ2xFLENBQUM7UUFFRCxNQUFNLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztRQUUzQyxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNuQixPQUFPLENBQUMsR0FBRyxDQUFDLHFDQUFxQyxLQUFLLEdBQUcsQ0FBQyxDQUFDO1FBQzdELENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSSxLQUFLO1FBQ1YsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUV0QixJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNuQixPQUFPLENBQUMsR0FBRyxDQUFDLHVDQUF1QyxDQUFDLENBQUM7UUFDdkQsQ0FBQztJQUNILENBQUM7SUFFRDs7O09BR0c7SUFDSSxTQUFTO1FBQ2QsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRSxDQUFDO0lBQ25DLENBQUM7SUFFRDs7OztPQUlHO0lBQ0ksWUFBWSxDQUFDLEtBQWE7UUFDL0IsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUMzQyxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNJLGFBQWEsQ0FBQyxLQUFhO1FBQ2hDLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDNUMsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIExvZ2dpbmcgd3JhcHBlciBmb3IgdGhlIEV2ZW50QnVzLlxyXG4gKiBcclxuICogQWRkcyBkZWJ1ZyBsb2dnaW5nIGZvciBhbGwgZXZlbnRzIHdoZW4gZGVidWcgbW9kZSBpcyBlbmFibGVkLlxyXG4gKi9cclxuXHJcbmltcG9ydCB7IEV2ZW50QnVzLCBFdmVudENhbGxiYWNrIH0gZnJvbSAnLi9FdmVudEJ1cyc7XHJcblxyXG4vKipcclxuICogTG9nZ2luZ0V2ZW50QnVzIGNsYXNzIHRoYXQgd3JhcHMgYW4gRXZlbnRCdXMgd2l0aCBkZWJ1ZyBsb2dnaW5nLlxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIExvZ2dpbmdFdmVudEJ1cyB7XHJcbiAgcHJpdmF0ZSBldmVudEJ1czogRXZlbnRCdXM7XHJcbiAgcHJpdmF0ZSBkZWJ1Z01vZGU6IGJvb2xlYW47XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgbmV3IExvZ2dpbmdFdmVudEJ1cy5cclxuICAgKiBAcGFyYW0gZXZlbnRCdXMgRXZlbnRCdXMgdG8gd3JhcFxyXG4gICAqIEBwYXJhbSBkZWJ1Z01vZGUgV2hldGhlciB0byBlbmFibGUgZGVidWcgbG9nZ2luZ1xyXG4gICAqL1xyXG4gIGNvbnN0cnVjdG9yKGV2ZW50QnVzOiBFdmVudEJ1cywgZGVidWdNb2RlOiBib29sZWFuID0gZmFsc2UpIHtcclxuICAgIHRoaXMuZXZlbnRCdXMgPSBldmVudEJ1cztcclxuICAgIHRoaXMuZGVidWdNb2RlID0gZGVidWdNb2RlO1xyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBTZXQgZGVidWcgbW9kZS5cclxuICAgKiBAcGFyYW0gZW5hYmxlZCBXaGV0aGVyIHRvIGVuYWJsZSBkZWJ1ZyBsb2dnaW5nXHJcbiAgICovXHJcbiAgcHVibGljIHNldERlYnVnTW9kZShlbmFibGVkOiBib29sZWFuKTogdm9pZCB7XHJcbiAgICB0aGlzLmRlYnVnTW9kZSA9IGVuYWJsZWQ7XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIFJlZ2lzdGVyIGFuIGV2ZW50IGhhbmRsZXIuXHJcbiAgICogQHBhcmFtIGV2ZW50IEV2ZW50IG5hbWUgdG8gbGlzdGVuIGZvclxyXG4gICAqIEBwYXJhbSBjYWxsYmFjayBGdW5jdGlvbiB0byBjYWxsIHdoZW4gdGhlIGV2ZW50IGlzIGVtaXR0ZWRcclxuICAgKiBAcmV0dXJucyBUaGUgY2FsbGJhY2sgZnVuY3Rpb24gZm9yIHVzZSB3aXRoIG9mZnJlZlxyXG4gICAqL1xyXG4gIHB1YmxpYyBvbihldmVudDogc3RyaW5nLCBjYWxsYmFjazogRXZlbnRDYWxsYmFjayk6IEV2ZW50Q2FsbGJhY2sge1xyXG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy5ldmVudEJ1cy5vbihldmVudCwgY2FsbGJhY2spO1xyXG4gICAgXHJcbiAgICBpZiAodGhpcy5kZWJ1Z01vZGUpIHtcclxuICAgICAgY29uc29sZS5sb2coYFtFdmVudEJ1c10gUmVnaXN0ZXJlZCBoYW5kbGVyIGZvciAnJHtldmVudH0nYCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiByZXN1bHQ7XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIFVucmVnaXN0ZXIgYW4gZXZlbnQgaGFuZGxlci5cclxuICAgKiBAcGFyYW0gZXZlbnQgRXZlbnQgbmFtZVxyXG4gICAqIEBwYXJhbSBjYWxsYmFjayBGdW5jdGlvbiB0byByZW1vdmUgZnJvbSBsaXN0ZW5lcnNcclxuICAgKi9cclxuICBwdWJsaWMgb2ZmKGV2ZW50OiBzdHJpbmcsIGNhbGxiYWNrOiBFdmVudENhbGxiYWNrKTogdm9pZCB7XHJcbiAgICB0aGlzLmV2ZW50QnVzLm9mZihldmVudCwgY2FsbGJhY2spO1xyXG4gICAgXHJcbiAgICBpZiAodGhpcy5kZWJ1Z01vZGUpIHtcclxuICAgICAgY29uc29sZS5sb2coYFtFdmVudEJ1c10gVW5yZWdpc3RlcmVkIGhhbmRsZXIgZm9yICcke2V2ZW50fSdgKTtcclxuICAgIH1cclxuICB9XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogRW1pdCBhbiBldmVudCB0byBhbGwgcmVnaXN0ZXJlZCBsaXN0ZW5lcnMuXHJcbiAgICogQHBhcmFtIGV2ZW50IEV2ZW50IG5hbWVcclxuICAgKiBAcGFyYW0gZGF0YSBPcHRpb25hbCBkYXRhIHRvIHBhc3MgdG8gbGlzdGVuZXJzXHJcbiAgICovXHJcbiAgcHVibGljIGVtaXQoZXZlbnQ6IHN0cmluZywgZGF0YT86IGFueSk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuZGVidWdNb2RlKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKGBbRXZlbnRCdXNdIEVtaXR0aW5nIGV2ZW50ICcke2V2ZW50fSdgLCBkYXRhKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdGhpcy5ldmVudEJ1cy5lbWl0KGV2ZW50LCBkYXRhKTtcclxuICB9XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogRW1pdCBhbiBldmVudCBhbmQgd2FpdCBmb3IgYWxsIGhhbmRsZXJzIHRvIGNvbXBsZXRlLlxyXG4gICAqIEBwYXJhbSBldmVudCBFdmVudCBuYW1lXHJcbiAgICogQHBhcmFtIGRhdGEgT3B0aW9uYWwgZGF0YSB0byBwYXNzIHRvIGxpc3RlbmVyc1xyXG4gICAqIEByZXR1cm5zIFByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIGFsbCBoYW5kbGVycyBoYXZlIGNvbXBsZXRlZFxyXG4gICAqL1xyXG4gIHB1YmxpYyBhc3luYyBlbWl0QXN5bmMoZXZlbnQ6IHN0cmluZywgZGF0YT86IGFueSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgaWYgKHRoaXMuZGVidWdNb2RlKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKGBbRXZlbnRCdXNdIEVtaXR0aW5nIGFzeW5jIGV2ZW50ICcke2V2ZW50fSdgLCBkYXRhKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgYXdhaXQgdGhpcy5ldmVudEJ1cy5lbWl0QXN5bmMoZXZlbnQsIGRhdGEpO1xyXG4gICAgXHJcbiAgICBpZiAodGhpcy5kZWJ1Z01vZGUpIHtcclxuICAgICAgY29uc29sZS5sb2coYFtFdmVudEJ1c10gQ29tcGxldGVkIGFzeW5jIGV2ZW50ICcke2V2ZW50fSdgKTtcclxuICAgIH1cclxuICB9XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogUmVtb3ZlIGFsbCBldmVudCBoYW5kbGVycy5cclxuICAgKi9cclxuICBwdWJsaWMgY2xlYXIoKTogdm9pZCB7XHJcbiAgICB0aGlzLmV2ZW50QnVzLmNsZWFyKCk7XHJcbiAgICBcclxuICAgIGlmICh0aGlzLmRlYnVnTW9kZSkge1xyXG4gICAgICBjb25zb2xlLmxvZyhgW0V2ZW50QnVzXSBDbGVhcmVkIGFsbCBldmVudCBoYW5kbGVyc2ApO1xyXG4gICAgfVxyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBHZXQgYSBsaXN0IG9mIGFsbCBldmVudHMgd2l0aCBsaXN0ZW5lcnMuXHJcbiAgICogQHJldHVybnMgQXJyYXkgb2YgZXZlbnQgbmFtZXNcclxuICAgKi9cclxuICBwdWJsaWMgZ2V0RXZlbnRzKCk6IHN0cmluZ1tdIHtcclxuICAgIHJldHVybiB0aGlzLmV2ZW50QnVzLmdldEV2ZW50cygpO1xyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBDaGVjayBpZiBhbiBldmVudCBoYXMgbGlzdGVuZXJzLlxyXG4gICAqIEBwYXJhbSBldmVudCBFdmVudCBuYW1lXHJcbiAgICogQHJldHVybnMgVHJ1ZSBpZiB0aGUgZXZlbnQgaGFzIGxpc3RlbmVyc1xyXG4gICAqL1xyXG4gIHB1YmxpYyBoYXNMaXN0ZW5lcnMoZXZlbnQ6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIHRoaXMuZXZlbnRCdXMuaGFzTGlzdGVuZXJzKGV2ZW50KTtcclxuICB9XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBudW1iZXIgb2YgbGlzdGVuZXJzIGZvciBhbiBldmVudC5cclxuICAgKiBAcGFyYW0gZXZlbnQgRXZlbnQgbmFtZVxyXG4gICAqIEByZXR1cm5zIE51bWJlciBvZiBsaXN0ZW5lcnNcclxuICAgKi9cclxuICBwdWJsaWMgbGlzdGVuZXJDb3VudChldmVudDogc3RyaW5nKTogbnVtYmVyIHtcclxuICAgIHJldHVybiB0aGlzLmV2ZW50QnVzLmxpc3RlbmVyQ291bnQoZXZlbnQpO1xyXG4gIH1cclxufVxyXG4iXX0=