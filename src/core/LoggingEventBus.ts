/**
 * Logging wrapper for the EventBus.
 * 
 * Adds debug logging for all events when debug mode is enabled.
 */

import { EventBus, EventCallback } from './EventBus';

/**
 * LoggingEventBus class that wraps an EventBus with debug logging.
 */
export class LoggingEventBus {
  private eventBus: EventBus;
  private debugMode: boolean;
  
  /**
   * Create a new LoggingEventBus.
   * @param eventBus EventBus to wrap
   * @param debugMode Whether to enable debug logging
   */
  constructor(eventBus: EventBus, debugMode: boolean = false) {
    this.eventBus = eventBus;
    this.debugMode = debugMode;
  }
  
  /**
   * Set debug mode.
   * @param enabled Whether to enable debug logging
   */
  public setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }
  
  /**
   * Register an event handler.
   * @param event Event name to listen for
   * @param callback Function to call when the event is emitted
   * @returns The callback function for use with offref
   */
  public on(event: string, callback: EventCallback): EventCallback {
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
  public off(event: string, callback: EventCallback): void {
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
  public emit(event: string, data?: any): void {
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
  public async emitAsync(event: string, data?: any): Promise<void> {
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
  public clear(): void {
    this.eventBus.clear();
    
    if (this.debugMode) {
      console.log(`[EventBus] Cleared all event handlers`);
    }
  }
  
  /**
   * Get a list of all events with listeners.
   * @returns Array of event names
   */
  public getEvents(): string[] {
    return this.eventBus.getEvents();
  }
  
  /**
   * Check if an event has listeners.
   * @param event Event name
   * @returns True if the event has listeners
   */
  public hasListeners(event: string): boolean {
    return this.eventBus.hasListeners(event);
  }
  
  /**
   * Get the number of listeners for an event.
   * @param event Event name
   * @returns Number of listeners
   */
  public listenerCount(event: string): number {
    return this.eventBus.listenerCount(event);
  }
}
