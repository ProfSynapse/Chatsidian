/**
 * Definitions for event types used in the Chatsidian plugin.
 * 
 * This provides type safety and documentation for the event bus.
 */

import { Conversation, Message } from '../models/Conversation';
import { ChatsidianSettings } from '../models/Settings';

/**
 * Interface for all event types.
 */
export interface EventTypes {
  // Settings events
  'settings:loaded': ChatsidianSettings;
  'settings:updated': {
    previousSettings: ChatsidianSettings;
    currentSettings: ChatsidianSettings;
    changedKeys: string[];
  };
  
  // Conversation events
  'conversation:created': Conversation;
  'conversation:loaded': Conversation;
  'conversation:updated': {
    previousConversation: Conversation;
    currentConversation: Conversation;
  };
  'conversation:deleted': string; // Conversation ID
  'conversation:selected': string; // Conversation ID
  
  // Message events
  'message:added': {
    conversationId: string;
    message: Message;
  };
  'message:updated': {
    conversationId: string;
    messageId: string;
    previousContent: string;
    currentContent: string;
  };
  'message:deleted': {
    conversationId: string;
    messageId: string;
  };
  
  // AI provider events
  'provider:connected': {
    provider: string;
    status: 'success' | 'error';
    error?: string;
  };
  'provider:message:sending': {
    conversationId: string;
    message: Message;
  };
  'provider:message:received': {
    conversationId: string;
    message: Message;
  };
  'provider:message:stream': {
    conversationId: string;
    messageId: string;
    content: string;
    isDone: boolean;
  };
  'provider:error': {
    conversationId?: string;
    error: any;
  };
  
  // Plugin lifecycle events
  'plugin:loaded': void;
  'plugin:unloaded': void;
  
  // UI events
  'ui:theme:changed': 'light' | 'dark' | 'system';
  'ui:view:opened': string; // View ID
  'ui:view:closed': string; // View ID
  
  // Storage events
  'storage:initialized': void;
  'storage:reloaded': void;
  'storage:error': {
    error: any;
  };
  'conversation:renamed': {
    oldId: string;
    newId: string;
  };
  
  // MCP events (placeholder for Phase 2)
  'mcp:connected': {
    status: 'success' | 'error';
    error?: string;
  };
  'mcp:disconnected': void;
  
  // BCP events (placeholder for Phase 2)
  'bcp:loaded': string; // BCP ID
  'bcp:unloaded': string; // BCP ID
}

/**
 * Type-safe wrapper for the EventBus.
 */
export class TypedEventBus {
  private eventBus: import('./EventBus').EventBus;
  
  /**
   * Create a new TypedEventBus.
   * @param eventBus The EventBus instance to wrap
   */
  constructor(eventBus: import('./EventBus').EventBus) {
    this.eventBus = eventBus;
  }
  
  /**
   * Register an event handler with type checking.
   * @param event Event name
   * @param callback Function to call when the event is emitted
   * @returns The callback function for use with offref
   */
  public on<K extends keyof EventTypes>(
    event: K,
    callback: (data: EventTypes[K]) => void | Promise<void>
  ): (data: EventTypes[K]) => void | Promise<void> {
    return this.eventBus.on(event as string, callback as import('./EventBus').EventCallback);
  }
  
  /**
   * Unregister an event handler with type checking.
   * @param event Event name
   * @param callback Function to remove from listeners
   */
  public off<K extends keyof EventTypes>(
    event: K,
    callback: (data: EventTypes[K]) => void | Promise<void>
  ): void {
    this.eventBus.off(event as string, callback as import('./EventBus').EventCallback);
  }
  
  /**
   * Emit an event to all registered listeners with type checking.
   * @param event Event name
   * @param data Data to pass to listeners
   */
  public emit<K extends keyof EventTypes>(
    event: K,
    data: EventTypes[K]
  ): void {
    this.eventBus.emit(event as string, data);
  }
  
  /**
   * Emit an event and wait for all handlers to complete with type checking.
   * @param event Event name
   * @param data Data to pass to listeners
   * @returns Promise that resolves when all handlers have completed
   */
  public async emitAsync<K extends keyof EventTypes>(
    event: K,
    data: EventTypes[K]
  ): Promise<void> {
    await this.eventBus.emitAsync(event as string, data);
  }
  
  /**
   * Remove all event handlers.
   */
  public clear(): void {
    this.eventBus.clear();
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
  public hasListeners<K extends keyof EventTypes>(event: K): boolean {
    return this.eventBus.hasListeners(event as string);
  }
  
  /**
   * Get the number of listeners for an event.
   * @param event Event name
   * @returns Number of listeners
   */
  public listenerCount<K extends keyof EventTypes>(event: K): number {
    return this.eventBus.listenerCount(event as string);
  }
}
