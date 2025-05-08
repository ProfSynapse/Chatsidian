/**
 * EventBus for component communication in the Chatsidian plugin.
 *
 * Extends Obsidian's Events class to leverage its existing functionality
 * while adding additional features like async event handling.
 */
import { Events } from '../utils/obsidian-imports';
/**
 * EventBus class for managing event subscriptions and emissions.
 * Extends Obsidian's Events class for better integration.
 */
export class EventBus extends Events {
    /**
     * Register an event handler.
     * @param event Event name to listen for
     * @param callback Function to call when the event is emitted
     * @returns The callback function for use with offref
     */
    on(event, callback) {
        // Using Obsidian's built-in on method
        super.on(event, callback);
        return callback;
    }
    /**
     * Unregister an event handler.
     * @param event Event name
     * @param callback Function to remove from listeners
     */
    off(event, callback) {
        // Using Obsidian's built-in off method
        super.off(event, callback);
    }
    /**
     * Emit an event to all registered listeners.
     * @param event Event name
     * @param data Optional data to pass to listeners
     */
    emit(event, data) {
        // Using Obsidian's built-in trigger method
        this.trigger(event, data);
    }
    /**
     * Emit an event and wait for all handlers to complete.
     * @param event Event name
     * @param data Optional data to pass to listeners
     * @returns Promise that resolves when all handlers have completed
     */
    async emitAsync(event, data) {
        const handlers = this.getObsidianEventRef(event);
        if (!handlers || !handlers.length)
            return;
        const promises = [];
        for (const handler of handlers) {
            try {
                const result = handler(data);
                if (result instanceof Promise) {
                    promises.push(result);
                }
            }
            catch (error) {
                console.error(`Error in event handler for ${event}:`, error);
            }
        }
        if (promises.length > 0) {
            try {
                await Promise.all(promises);
            }
            catch (error) {
                console.error(`Error in async event handler for ${event}:`, error);
            }
        }
    }
    /**
     * Remove all event handlers.
     */
    clear() {
        // Clear all events using Obsidian's API
        // This is a workaround since Events doesn't have a direct clear method
        const events = this.getEvents();
        for (const event of events) {
            const handlers = this.getObsidianEventRef(event);
            if (handlers) {
                for (const handler of handlers.slice()) {
                    this.off(event, handler);
                }
            }
        }
    }
    /**
     * Get a list of all events with listeners.
     * @returns Array of event names
     */
    getEvents() {
        // Access Obsidian's internal events map
        // Note: This is implementation-specific and may change
        const eventsMap = this.events;
        if (!eventsMap)
            return [];
        return Array.from(Object.keys(eventsMap));
    }
    /**
     * Check if an event has listeners.
     * @param event Event name
     * @returns True if the event has listeners
     */
    hasListeners(event) {
        const handlers = this.getObsidianEventRef(event);
        return !!handlers && handlers.length > 0;
    }
    /**
     * Get the number of listeners for an event.
     * @param event Event name
     * @returns Number of listeners
     */
    listenerCount(event) {
        const handlers = this.getObsidianEventRef(event);
        return handlers ? handlers.length : 0;
    }
    /**
     * Helper to access Obsidian's internal event references.
     * @param event Event name
     * @returns Array of handlers or undefined
     */
    getObsidianEventRef(event) {
        const eventsMap = this.events;
        return eventsMap ? eventsMap[event] : undefined;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRXZlbnRCdXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJFdmVudEJ1cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7R0FLRztBQUVILE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQU9uRDs7O0dBR0c7QUFDSCxNQUFNLE9BQU8sUUFBUyxTQUFRLE1BQU07SUFDbEM7Ozs7O09BS0c7SUFDSSxFQUFFLENBQUMsS0FBYSxFQUFFLFFBQXVCO1FBQzlDLHNDQUFzQztRQUN0QyxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztRQUMxQixPQUFPLFFBQVEsQ0FBQztJQUNsQixDQUFDO0lBRUQ7Ozs7T0FJRztJQUNJLEdBQUcsQ0FBQyxLQUFhLEVBQUUsUUFBdUI7UUFDL0MsdUNBQXVDO1FBQ3ZDLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQzdCLENBQUM7SUFFRDs7OztPQUlHO0lBQ0ksSUFBSSxDQUFDLEtBQWEsRUFBRSxJQUFVO1FBQ25DLDJDQUEyQztRQUMzQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztJQUM1QixDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSSxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQWEsRUFBRSxJQUFVO1FBQzlDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNqRCxJQUFJLENBQUMsUUFBUSxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU07WUFBRSxPQUFPO1FBRTFDLE1BQU0sUUFBUSxHQUFvQixFQUFFLENBQUM7UUFFckMsS0FBSyxNQUFNLE9BQU8sSUFBSSxRQUFRLEVBQUUsQ0FBQztZQUMvQixJQUFJLENBQUM7Z0JBQ0gsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUM3QixJQUFJLE1BQU0sWUFBWSxPQUFPLEVBQUUsQ0FBQztvQkFDOUIsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDeEIsQ0FBQztZQUNILENBQUM7WUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO2dCQUNmLE9BQU8sQ0FBQyxLQUFLLENBQUMsOEJBQThCLEtBQUssR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQy9ELENBQUM7UUFDSCxDQUFDO1FBRUQsSUFBSSxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ3hCLElBQUksQ0FBQztnQkFDSCxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDOUIsQ0FBQztZQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7Z0JBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyxvQ0FBb0MsS0FBSyxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDckUsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSSxLQUFLO1FBQ1Ysd0NBQXdDO1FBQ3hDLHVFQUF1RTtRQUN2RSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDaEMsS0FBSyxNQUFNLEtBQUssSUFBSSxNQUFNLEVBQUUsQ0FBQztZQUMzQixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDakQsSUFBSSxRQUFRLEVBQUUsQ0FBQztnQkFDYixLQUFLLE1BQU0sT0FBTyxJQUFJLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDO29CQUN2QyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFDM0IsQ0FBQztZQUNILENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztJQUVEOzs7T0FHRztJQUNJLFNBQVM7UUFDZCx3Q0FBd0M7UUFDeEMsdURBQXVEO1FBQ3ZELE1BQU0sU0FBUyxHQUFJLElBQVksQ0FBQyxNQUFNLENBQUM7UUFDdkMsSUFBSSxDQUFDLFNBQVM7WUFBRSxPQUFPLEVBQUUsQ0FBQztRQUUxQixPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFFRDs7OztPQUlHO0lBQ0ksWUFBWSxDQUFDLEtBQWE7UUFDL0IsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2pELE9BQU8sQ0FBQyxDQUFDLFFBQVEsSUFBSSxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztJQUMzQyxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNJLGFBQWEsQ0FBQyxLQUFhO1FBQ2hDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNqRCxPQUFPLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3hDLENBQUM7SUFFRDs7OztPQUlHO0lBQ0ssbUJBQW1CLENBQUMsS0FBYTtRQUN2QyxNQUFNLFNBQVMsR0FBSSxJQUFZLENBQUMsTUFBTSxDQUFDO1FBQ3ZDLE9BQU8sU0FBUyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUNsRCxDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogRXZlbnRCdXMgZm9yIGNvbXBvbmVudCBjb21tdW5pY2F0aW9uIGluIHRoZSBDaGF0c2lkaWFuIHBsdWdpbi5cclxuICogXHJcbiAqIEV4dGVuZHMgT2JzaWRpYW4ncyBFdmVudHMgY2xhc3MgdG8gbGV2ZXJhZ2UgaXRzIGV4aXN0aW5nIGZ1bmN0aW9uYWxpdHlcclxuICogd2hpbGUgYWRkaW5nIGFkZGl0aW9uYWwgZmVhdHVyZXMgbGlrZSBhc3luYyBldmVudCBoYW5kbGluZy5cclxuICovXHJcblxyXG5pbXBvcnQgeyBFdmVudHMgfSBmcm9tICcuLi91dGlscy9vYnNpZGlhbi1pbXBvcnRzJztcclxuXHJcbi8qKlxyXG4gKiBUeXBlIGRlZmluaXRpb24gZm9yIGV2ZW50IGNhbGxiYWNrcy5cclxuICovXHJcbmV4cG9ydCB0eXBlIEV2ZW50Q2FsbGJhY2sgPSAoZGF0YTogYW55KSA9PiB2b2lkIHwgUHJvbWlzZTx2b2lkPjtcclxuXHJcbi8qKlxyXG4gKiBFdmVudEJ1cyBjbGFzcyBmb3IgbWFuYWdpbmcgZXZlbnQgc3Vic2NyaXB0aW9ucyBhbmQgZW1pc3Npb25zLlxyXG4gKiBFeHRlbmRzIE9ic2lkaWFuJ3MgRXZlbnRzIGNsYXNzIGZvciBiZXR0ZXIgaW50ZWdyYXRpb24uXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgRXZlbnRCdXMgZXh0ZW5kcyBFdmVudHMge1xyXG4gIC8qKlxyXG4gICAqIFJlZ2lzdGVyIGFuIGV2ZW50IGhhbmRsZXIuXHJcbiAgICogQHBhcmFtIGV2ZW50IEV2ZW50IG5hbWUgdG8gbGlzdGVuIGZvclxyXG4gICAqIEBwYXJhbSBjYWxsYmFjayBGdW5jdGlvbiB0byBjYWxsIHdoZW4gdGhlIGV2ZW50IGlzIGVtaXR0ZWRcclxuICAgKiBAcmV0dXJucyBUaGUgY2FsbGJhY2sgZnVuY3Rpb24gZm9yIHVzZSB3aXRoIG9mZnJlZlxyXG4gICAqL1xyXG4gIHB1YmxpYyBvbihldmVudDogc3RyaW5nLCBjYWxsYmFjazogRXZlbnRDYWxsYmFjayk6IEV2ZW50Q2FsbGJhY2sge1xyXG4gICAgLy8gVXNpbmcgT2JzaWRpYW4ncyBidWlsdC1pbiBvbiBtZXRob2RcclxuICAgIHN1cGVyLm9uKGV2ZW50LCBjYWxsYmFjayk7XHJcbiAgICByZXR1cm4gY2FsbGJhY2s7XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIFVucmVnaXN0ZXIgYW4gZXZlbnQgaGFuZGxlci5cclxuICAgKiBAcGFyYW0gZXZlbnQgRXZlbnQgbmFtZVxyXG4gICAqIEBwYXJhbSBjYWxsYmFjayBGdW5jdGlvbiB0byByZW1vdmUgZnJvbSBsaXN0ZW5lcnNcclxuICAgKi9cclxuICBwdWJsaWMgb2ZmKGV2ZW50OiBzdHJpbmcsIGNhbGxiYWNrOiBFdmVudENhbGxiYWNrKTogdm9pZCB7XHJcbiAgICAvLyBVc2luZyBPYnNpZGlhbidzIGJ1aWx0LWluIG9mZiBtZXRob2RcclxuICAgIHN1cGVyLm9mZihldmVudCwgY2FsbGJhY2spO1xyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBFbWl0IGFuIGV2ZW50IHRvIGFsbCByZWdpc3RlcmVkIGxpc3RlbmVycy5cclxuICAgKiBAcGFyYW0gZXZlbnQgRXZlbnQgbmFtZVxyXG4gICAqIEBwYXJhbSBkYXRhIE9wdGlvbmFsIGRhdGEgdG8gcGFzcyB0byBsaXN0ZW5lcnNcclxuICAgKi9cclxuICBwdWJsaWMgZW1pdChldmVudDogc3RyaW5nLCBkYXRhPzogYW55KTogdm9pZCB7XHJcbiAgICAvLyBVc2luZyBPYnNpZGlhbidzIGJ1aWx0LWluIHRyaWdnZXIgbWV0aG9kXHJcbiAgICB0aGlzLnRyaWdnZXIoZXZlbnQsIGRhdGEpO1xyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBFbWl0IGFuIGV2ZW50IGFuZCB3YWl0IGZvciBhbGwgaGFuZGxlcnMgdG8gY29tcGxldGUuXHJcbiAgICogQHBhcmFtIGV2ZW50IEV2ZW50IG5hbWVcclxuICAgKiBAcGFyYW0gZGF0YSBPcHRpb25hbCBkYXRhIHRvIHBhc3MgdG8gbGlzdGVuZXJzXHJcbiAgICogQHJldHVybnMgUHJvbWlzZSB0aGF0IHJlc29sdmVzIHdoZW4gYWxsIGhhbmRsZXJzIGhhdmUgY29tcGxldGVkXHJcbiAgICovXHJcbiAgcHVibGljIGFzeW5jIGVtaXRBc3luYyhldmVudDogc3RyaW5nLCBkYXRhPzogYW55KTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBoYW5kbGVycyA9IHRoaXMuZ2V0T2JzaWRpYW5FdmVudFJlZihldmVudCk7XHJcbiAgICBpZiAoIWhhbmRsZXJzIHx8ICFoYW5kbGVycy5sZW5ndGgpIHJldHVybjtcclxuICAgIFxyXG4gICAgY29uc3QgcHJvbWlzZXM6IFByb21pc2U8dm9pZD5bXSA9IFtdO1xyXG4gICAgXHJcbiAgICBmb3IgKGNvbnN0IGhhbmRsZXIgb2YgaGFuZGxlcnMpIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCByZXN1bHQgPSBoYW5kbGVyKGRhdGEpO1xyXG4gICAgICAgIGlmIChyZXN1bHQgaW5zdGFuY2VvZiBQcm9taXNlKSB7XHJcbiAgICAgICAgICBwcm9taXNlcy5wdXNoKHJlc3VsdCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYEVycm9yIGluIGV2ZW50IGhhbmRsZXIgZm9yICR7ZXZlbnR9OmAsIGVycm9yKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBpZiAocHJvbWlzZXMubGVuZ3RoID4gMCkge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGF3YWl0IFByb21pc2UuYWxsKHByb21pc2VzKTtcclxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKGBFcnJvciBpbiBhc3luYyBldmVudCBoYW5kbGVyIGZvciAke2V2ZW50fTpgLCBlcnJvcik7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogUmVtb3ZlIGFsbCBldmVudCBoYW5kbGVycy5cclxuICAgKi9cclxuICBwdWJsaWMgY2xlYXIoKTogdm9pZCB7XHJcbiAgICAvLyBDbGVhciBhbGwgZXZlbnRzIHVzaW5nIE9ic2lkaWFuJ3MgQVBJXHJcbiAgICAvLyBUaGlzIGlzIGEgd29ya2Fyb3VuZCBzaW5jZSBFdmVudHMgZG9lc24ndCBoYXZlIGEgZGlyZWN0IGNsZWFyIG1ldGhvZFxyXG4gICAgY29uc3QgZXZlbnRzID0gdGhpcy5nZXRFdmVudHMoKTtcclxuICAgIGZvciAoY29uc3QgZXZlbnQgb2YgZXZlbnRzKSB7XHJcbiAgICAgIGNvbnN0IGhhbmRsZXJzID0gdGhpcy5nZXRPYnNpZGlhbkV2ZW50UmVmKGV2ZW50KTtcclxuICAgICAgaWYgKGhhbmRsZXJzKSB7XHJcbiAgICAgICAgZm9yIChjb25zdCBoYW5kbGVyIG9mIGhhbmRsZXJzLnNsaWNlKCkpIHtcclxuICAgICAgICAgIHRoaXMub2ZmKGV2ZW50LCBoYW5kbGVyKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgbGlzdCBvZiBhbGwgZXZlbnRzIHdpdGggbGlzdGVuZXJzLlxyXG4gICAqIEByZXR1cm5zIEFycmF5IG9mIGV2ZW50IG5hbWVzXHJcbiAgICovXHJcbiAgcHVibGljIGdldEV2ZW50cygpOiBzdHJpbmdbXSB7XHJcbiAgICAvLyBBY2Nlc3MgT2JzaWRpYW4ncyBpbnRlcm5hbCBldmVudHMgbWFwXHJcbiAgICAvLyBOb3RlOiBUaGlzIGlzIGltcGxlbWVudGF0aW9uLXNwZWNpZmljIGFuZCBtYXkgY2hhbmdlXHJcbiAgICBjb25zdCBldmVudHNNYXAgPSAodGhpcyBhcyBhbnkpLmV2ZW50cztcclxuICAgIGlmICghZXZlbnRzTWFwKSByZXR1cm4gW107XHJcbiAgICBcclxuICAgIHJldHVybiBBcnJheS5mcm9tKE9iamVjdC5rZXlzKGV2ZW50c01hcCkpO1xyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBDaGVjayBpZiBhbiBldmVudCBoYXMgbGlzdGVuZXJzLlxyXG4gICAqIEBwYXJhbSBldmVudCBFdmVudCBuYW1lXHJcbiAgICogQHJldHVybnMgVHJ1ZSBpZiB0aGUgZXZlbnQgaGFzIGxpc3RlbmVyc1xyXG4gICAqL1xyXG4gIHB1YmxpYyBoYXNMaXN0ZW5lcnMoZXZlbnQ6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgaGFuZGxlcnMgPSB0aGlzLmdldE9ic2lkaWFuRXZlbnRSZWYoZXZlbnQpO1xyXG4gICAgcmV0dXJuICEhaGFuZGxlcnMgJiYgaGFuZGxlcnMubGVuZ3RoID4gMDtcclxuICB9XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBudW1iZXIgb2YgbGlzdGVuZXJzIGZvciBhbiBldmVudC5cclxuICAgKiBAcGFyYW0gZXZlbnQgRXZlbnQgbmFtZVxyXG4gICAqIEByZXR1cm5zIE51bWJlciBvZiBsaXN0ZW5lcnNcclxuICAgKi9cclxuICBwdWJsaWMgbGlzdGVuZXJDb3VudChldmVudDogc3RyaW5nKTogbnVtYmVyIHtcclxuICAgIGNvbnN0IGhhbmRsZXJzID0gdGhpcy5nZXRPYnNpZGlhbkV2ZW50UmVmKGV2ZW50KTtcclxuICAgIHJldHVybiBoYW5kbGVycyA/IGhhbmRsZXJzLmxlbmd0aCA6IDA7XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIEhlbHBlciB0byBhY2Nlc3MgT2JzaWRpYW4ncyBpbnRlcm5hbCBldmVudCByZWZlcmVuY2VzLlxyXG4gICAqIEBwYXJhbSBldmVudCBFdmVudCBuYW1lXHJcbiAgICogQHJldHVybnMgQXJyYXkgb2YgaGFuZGxlcnMgb3IgdW5kZWZpbmVkXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBnZXRPYnNpZGlhbkV2ZW50UmVmKGV2ZW50OiBzdHJpbmcpOiBFdmVudENhbGxiYWNrW10gfCB1bmRlZmluZWQge1xyXG4gICAgY29uc3QgZXZlbnRzTWFwID0gKHRoaXMgYXMgYW55KS5ldmVudHM7XHJcbiAgICByZXR1cm4gZXZlbnRzTWFwID8gZXZlbnRzTWFwW2V2ZW50XSA6IHVuZGVmaW5lZDtcclxuICB9XHJcbn1cclxuIl19