/**
 * EventBus for component communication in the Chatsidian plugin.
 * 
 * Extends Obsidian's Events class to leverage its existing functionality
 * while adding additional features like async event handling.
 */

import { Events } from '../utils/obsidian-imports';

/**
 * Type definition for event callbacks.
 */
export type EventCallback = (data: any) => void | Promise<void>;

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
  public on(event: string, callback: EventCallback): EventCallback {
    // Using Obsidian's built-in on method
    super.on(event, callback);
    return callback;
  }
  
  /**
   * Unregister an event handler.
   * @param event Event name
   * @param callback Function to remove from listeners
   */
  public off(event: string, callback: EventCallback): void {
    // Using Obsidian's built-in off method
    super.off(event, callback);
  }
  
  /**
   * Emit an event to all registered listeners.
   * @param event Event name
   * @param data Optional data to pass to listeners
   */
  public emit(event: string, data?: any): void {
    // Using Obsidian's built-in trigger method
    this.trigger(event, data);
  }
  
  /**
   * Emit an event and wait for all handlers to complete.
   * @param event Event name
   * @param data Optional data to pass to listeners
   * @returns Promise that resolves when all handlers have completed
   */
  public async emitAsync(event: string, data?: any): Promise<void> {
    const handlers = this.getObsidianEventRef(event);
    if (!handlers || !handlers.length) return;
    
    const promises: Promise<void>[] = [];
    
    for (const handler of handlers) {
      try {
        const result = handler(data);
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    }
    
    if (promises.length > 0) {
      try {
        await Promise.all(promises);
      } catch (error) {
        console.error(`Error in async event handler for ${event}:`, error);
      }
    }
  }
  
  /**
   * Remove all event handlers.
   */
  public clear(): void {
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
  public getEvents(): string[] {
    // Access Obsidian's internal events map
    // Note: This is implementation-specific and may change
    const eventsMap = (this as any).events;
    if (!eventsMap) return [];
    
    return Array.from(Object.keys(eventsMap));
  }
  
  /**
   * Check if an event has listeners.
   * @param event Event name
   * @returns True if the event has listeners
   */
  public hasListeners(event: string): boolean {
    const handlers = this.getObsidianEventRef(event);
    return !!handlers && handlers.length > 0;
  }
  
  /**
   * Get the number of listeners for an event.
   * @param event Event name
   * @returns Number of listeners
   */
  public listenerCount(event: string): number {
    const handlers = this.getObsidianEventRef(event);
    return handlers ? handlers.length : 0;
  }
  
  /**
   * Helper to access Obsidian's internal event references.
   * @param event Event name
   * @returns Array of handlers or undefined
   */
  private getObsidianEventRef(event: string): EventCallback[] | undefined {
    const eventsMap = (this as any).events;
    return eventsMap ? eventsMap[event] : undefined;
  }
}
