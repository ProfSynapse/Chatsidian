/**
 * Factory for creating different types of event buses.
 */
import { EventBus } from './EventBus';
import { LoggingEventBus } from './LoggingEventBus';
import { TypedEventBus } from './EventTypes';
/**
 * Factory class for creating event buses.
 */
export class EventBusFactory {
    /**
     * Create a basic EventBus.
     * @returns EventBus instance
     */
    static createBasicEventBus() {
        return new EventBus();
    }
    /**
     * Create a logging EventBus.
     * @param debugMode Whether to enable debug logging
     * @returns LoggingEventBus instance
     */
    static createLoggingEventBus(debugMode = false) {
        return new LoggingEventBus(new EventBus(), debugMode);
    }
    /**
     * Create a typed EventBus.
     * @returns TypedEventBus instance
     */
    static createTypedEventBus() {
        return new TypedEventBus(new EventBus());
    }
    /**
     * Create a typed and logging EventBus.
     * @param debugMode Whether to enable debug logging
     * @returns TypedEventBus instance with logging
     */
    static createTypedLoggingEventBus(debugMode = false) {
        return new TypedEventBus(new LoggingEventBus(new EventBus(), debugMode));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRXZlbnRCdXNGYWN0b3J5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiRXZlbnRCdXNGYWN0b3J5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztHQUVHO0FBRUgsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLFlBQVksQ0FBQztBQUN0QyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDcEQsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUU3Qzs7R0FFRztBQUNILE1BQU0sT0FBTyxlQUFlO0lBQzFCOzs7T0FHRztJQUNJLE1BQU0sQ0FBQyxtQkFBbUI7UUFDL0IsT0FBTyxJQUFJLFFBQVEsRUFBRSxDQUFDO0lBQ3hCLENBQUM7SUFFRDs7OztPQUlHO0lBQ0ksTUFBTSxDQUFDLHFCQUFxQixDQUFDLFlBQXFCLEtBQUs7UUFDNUQsT0FBTyxJQUFJLGVBQWUsQ0FBQyxJQUFJLFFBQVEsRUFBRSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ3hELENBQUM7SUFFRDs7O09BR0c7SUFDSSxNQUFNLENBQUMsbUJBQW1CO1FBQy9CLE9BQU8sSUFBSSxhQUFhLENBQUMsSUFBSSxRQUFRLEVBQUUsQ0FBQyxDQUFDO0lBQzNDLENBQUM7SUFFRDs7OztPQUlHO0lBQ0ksTUFBTSxDQUFDLDBCQUEwQixDQUFDLFlBQXFCLEtBQUs7UUFDakUsT0FBTyxJQUFJLGFBQWEsQ0FBQyxJQUFJLGVBQWUsQ0FBQyxJQUFJLFFBQVEsRUFBRSxFQUFFLFNBQVMsQ0FBUSxDQUFDLENBQUM7SUFDbEYsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIEZhY3RvcnkgZm9yIGNyZWF0aW5nIGRpZmZlcmVudCB0eXBlcyBvZiBldmVudCBidXNlcy5cclxuICovXHJcblxyXG5pbXBvcnQgeyBFdmVudEJ1cyB9IGZyb20gJy4vRXZlbnRCdXMnO1xyXG5pbXBvcnQgeyBMb2dnaW5nRXZlbnRCdXMgfSBmcm9tICcuL0xvZ2dpbmdFdmVudEJ1cyc7XHJcbmltcG9ydCB7IFR5cGVkRXZlbnRCdXMgfSBmcm9tICcuL0V2ZW50VHlwZXMnO1xyXG5cclxuLyoqXHJcbiAqIEZhY3RvcnkgY2xhc3MgZm9yIGNyZWF0aW5nIGV2ZW50IGJ1c2VzLlxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEV2ZW50QnVzRmFjdG9yeSB7XHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgYmFzaWMgRXZlbnRCdXMuXHJcbiAgICogQHJldHVybnMgRXZlbnRCdXMgaW5zdGFuY2VcclxuICAgKi9cclxuICBwdWJsaWMgc3RhdGljIGNyZWF0ZUJhc2ljRXZlbnRCdXMoKTogRXZlbnRCdXMge1xyXG4gICAgcmV0dXJuIG5ldyBFdmVudEJ1cygpO1xyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBDcmVhdGUgYSBsb2dnaW5nIEV2ZW50QnVzLlxyXG4gICAqIEBwYXJhbSBkZWJ1Z01vZGUgV2hldGhlciB0byBlbmFibGUgZGVidWcgbG9nZ2luZ1xyXG4gICAqIEByZXR1cm5zIExvZ2dpbmdFdmVudEJ1cyBpbnN0YW5jZVxyXG4gICAqL1xyXG4gIHB1YmxpYyBzdGF0aWMgY3JlYXRlTG9nZ2luZ0V2ZW50QnVzKGRlYnVnTW9kZTogYm9vbGVhbiA9IGZhbHNlKTogTG9nZ2luZ0V2ZW50QnVzIHtcclxuICAgIHJldHVybiBuZXcgTG9nZ2luZ0V2ZW50QnVzKG5ldyBFdmVudEJ1cygpLCBkZWJ1Z01vZGUpO1xyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBDcmVhdGUgYSB0eXBlZCBFdmVudEJ1cy5cclxuICAgKiBAcmV0dXJucyBUeXBlZEV2ZW50QnVzIGluc3RhbmNlXHJcbiAgICovXHJcbiAgcHVibGljIHN0YXRpYyBjcmVhdGVUeXBlZEV2ZW50QnVzKCk6IFR5cGVkRXZlbnRCdXMge1xyXG4gICAgcmV0dXJuIG5ldyBUeXBlZEV2ZW50QnVzKG5ldyBFdmVudEJ1cygpKTtcclxuICB9XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgdHlwZWQgYW5kIGxvZ2dpbmcgRXZlbnRCdXMuXHJcbiAgICogQHBhcmFtIGRlYnVnTW9kZSBXaGV0aGVyIHRvIGVuYWJsZSBkZWJ1ZyBsb2dnaW5nXHJcbiAgICogQHJldHVybnMgVHlwZWRFdmVudEJ1cyBpbnN0YW5jZSB3aXRoIGxvZ2dpbmdcclxuICAgKi9cclxuICBwdWJsaWMgc3RhdGljIGNyZWF0ZVR5cGVkTG9nZ2luZ0V2ZW50QnVzKGRlYnVnTW9kZTogYm9vbGVhbiA9IGZhbHNlKTogVHlwZWRFdmVudEJ1cyB7XHJcbiAgICByZXR1cm4gbmV3IFR5cGVkRXZlbnRCdXMobmV3IExvZ2dpbmdFdmVudEJ1cyhuZXcgRXZlbnRCdXMoKSwgZGVidWdNb2RlKSBhcyBhbnkpO1xyXG4gIH1cclxufVxyXG4iXX0=