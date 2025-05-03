---
title: Phase 1.3 - Event Bus Implementation
description: Creating the event system for component communication in the Chatsidian plugin
date: 2025-05-03
status: planning
tags:
  - implementation
  - event-bus
  - pub-sub
  - component-communication
  - chatsidian
---

# Phase 1.3: Event Bus Implementation

## Overview

This microphase focuses on implementing an event system that allows different components of the Chatsidian plugin to communicate with each other in a decoupled manner. The event bus will follow the publisher-subscriber (pub-sub) pattern, enabling components to publish events and subscribe to events from other components without direct dependencies.

## Objectives

- Implement event bus core functionality
- Add support for asynchronous event handlers
- Create event types and documentation
- Add handling for errors in event callbacks
- Write unit tests for the event bus

## Implementation Steps

### 1. Implement Event Bus Core Functionality

Create `src/core/EventBus.ts`:

```typescript
/**
 * EventBus for component communication in the Chatsidian plugin.
 * 
 * Uses the publisher-subscriber pattern to decouple components.
 */

/**
 * Type definition for event callbacks.
 */
export type EventCallback = (data: any) => void | Promise<void>;

/**
 * EventBus class for managing event subscriptions and emissions.
 */
export class EventBus {
  /**
   * Map of event names to sets of callbacks.
   */
  private events: Map<string, Set<EventCallback>> = new Map();
  
  /**
   * Register an event handler.
   * @param event Event name to listen for
   * @param callback Function to call when the event is emitted
   */
  public on(event: string, callback: EventCallback): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    
    this.events.get(event)!.add(callback);
  }
  
  /**
   * Unregister an event handler.
   * @param event Event name
   * @param callback Function to remove from listeners
   */
  public off(event: string, callback: EventCallback): void {
    if (!this.events.has(event)) {
      return;
    }
    
    this.events.get(event)!.delete(callback);
    
    // Clean up empty sets
    if (this.events.get(event)!.size === 0) {
      this.events.delete(event);
    }
  }
  
  /**
   * Emit an event to all registered listeners.
   * @param event Event name
   * @param data Optional data to pass to listeners
   */
  public emit(event: string, data?: any): void {
    if (!this.events.has(event)) {
      return;
    }
    
    const callbacks = Array.from(this.events.get(event)!);
    
    // Execute callbacks
    for (const callback of callbacks) {
      try {
        const result = callback(data);
        
        // Handle promises
        if (result instanceof Promise) {
          result.catch(error => {
            console.error(`Error in event handler for ${event}:`, error);
          });
        }
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    }
  }
  
  /**
   * Emit an event and wait for all handlers to complete.
   * @param event Event name
   * @param data Optional data to pass to listeners
   * @returns Promise that resolves when all handlers have completed
   */
  public async emitAsync(event: string, data?: any): Promise<void> {
    if (!this.events.has(event)) {
      return;
    }
    
    const callbacks = Array.from(this.events.get(event)!);
    const promises: Promise<void>[] = [];
    
    // Execute callbacks
    for (const callback of callbacks) {
      try {
        const result = callback(data);
        
        // Handle promises
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    }
    
    // Wait for all promises to resolve
    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }
  
  /**
   * Remove all event handlers.
   */
  public clear(): void {
    this.events.clear();
  }
  
  /**
   * Get a list of all events with listeners.
   * @returns Array of event names
   */
  public getEvents(): string[] {
    return Array.from(this.events.keys());
  }
  
  /**
   * Check if an event has listeners.
   * @param event Event name
   * @returns True if the event has listeners
   */
  public hasListeners(event: string): boolean {
    return this.events.has(event) && this.events.get(event)!.size > 0;
  }
  
  /**
   * Get the number of listeners for an event.
   * @param event Event name
   * @returns Number of listeners
   */
  public listenerCount(event: string): number {
    if (!this.events.has(event)) {
      return 0;
    }
    
    return this.events.get(event)!.size;
  }
}
```

### 2. Create Event Types Definition

Create `src/core/EventTypes.ts`:

```typescript
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
  
  constructor(eventBus: import('./EventBus').EventBus) {
    this.eventBus = eventBus;
  }
  
  /**
   * Register an event handler with type checking.
   * @param event Event name
   * @param callback Function to call when the event is emitted
   */
  public on<K extends keyof EventTypes>(
    event: K,
    callback: (data: EventTypes[K]) => void | Promise<void>
  ): void {
    this.eventBus.on(event as string, callback as import('./EventBus').EventCallback);
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
```

### 3. Add Debug Logging for Events

Create `src/core/LoggingEventBus.ts`:

```typescript
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
   */
  public on(event: string, callback: EventCallback): void {
    this.eventBus.on(event, callback);
    
    if (this.debugMode) {
      console.log(`[EventBus] Registered handler for '${event}'`);
    }
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
```

### 4. Create EventBus Factory

Create `src/core/EventBusFactory.ts`:

```typescript
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
  public static createBasicEventBus(): EventBus {
    return new EventBus();
  }
  
  /**
   * Create a logging EventBus.
   * @param debugMode Whether to enable debug logging
   * @returns LoggingEventBus instance
   */
  public static createLoggingEventBus(debugMode: boolean = false): LoggingEventBus {
    return new LoggingEventBus(new EventBus(), debugMode);
  }
  
  /**
   * Create a typed EventBus.
   * @returns TypedEventBus instance
   */
  public static createTypedEventBus(): TypedEventBus {
    return new TypedEventBus(new EventBus());
  }
  
  /**
   * Create a typed and logging EventBus.
   * @param debugMode Whether to enable debug logging
   * @returns TypedEventBus instance with logging
   */
  public static createTypedLoggingEventBus(debugMode: boolean = false): TypedEventBus {
    return new TypedEventBus(new LoggingEventBus(new EventBus(), debugMode) as any);
  }
}
```

### 5. Document Event Usage Patterns

Create `src/core/README.md`:

```markdown
# Chatsidian Core Components

This directory contains core infrastructure components for the Chatsidian plugin.

## EventBus

The EventBus is a publisher-subscriber implementation that enables decoupled communication between components. Components can publish events that others can subscribe to without direct dependencies.

### Basic Usage

```typescript
import { EventBus } from './EventBus';

// Create an event bus
const eventBus = new EventBus();

// Register an event handler
eventBus.on('settings:updated', (data) => {
  console.log('Settings updated:', data);
});

// Emit an event
eventBus.emit('settings:updated', { key: 'value' });

// Unregister an event handler
eventBus.off('settings:updated', handleSettingsUpdated);
```

### Typed Usage

```typescript
import { EventBusFactory } from './EventBusFactory';
import { EventTypes } from './EventTypes';

// Create a typed event bus
const eventBus = EventBusFactory.createTypedEventBus();

// Register a typed event handler
eventBus.on('settings:updated', (data) => {
  // data is typed as { previousSettings, currentSettings, changedKeys }
  console.log('Changed keys:', data.changedKeys);
});

// Emit a typed event
eventBus.emit('settings:updated', {
  previousSettings: { /* ... */ },
  currentSettings: { /* ... */ },
  changedKeys: ['theme']
});
```

### Async Events

```typescript
import { EventBusFactory } from './EventBusFactory';

// Create an event bus
const eventBus = EventBusFactory.createBasicEventBus();

// Register an async event handler
eventBus.on('data:load', async (data) => {
  await someAsyncOperation();
  console.log('Data loaded');
});

// Emit an async event and wait for all handlers
await eventBus.emitAsync('data:load', { source: 'file.json' });
console.log('All handlers completed');
```

### Debug Logging

```typescript
import { EventBusFactory } from './EventBusFactory';

// Create a logging event bus
const eventBus = EventBusFactory.createLoggingEventBus(true);

// All events will be logged to the console
eventBus.emit('app:initialized');
// Console: [EventBus] Emitting event 'app:initialized'
```

## Standard Events

See `EventTypes.ts` for a complete list of standard events used in the plugin. Some key events include:

- `settings:updated` - When settings are changed
- `conversation:created` - When a new conversation is created
- `conversation:loaded` - When a conversation is loaded from storage
- `message:added` - When a message is added to a conversation
- `provider:message:received` - When a message is received from an AI provider
```

### 6. Write Unit Tests for Event Bus

Create `tests/core/EventBus.test.ts`:

```typescript
import { EventBus } from '../../src/core/EventBus';

describe('EventBus', () => {
  let eventBus: EventBus;
  
  beforeEach(() => {
    eventBus = new EventBus();
  });
  
  test('should register and trigger event handlers', () => {
    const handler = jest.fn();
    
    eventBus.on('test', handler);
    eventBus.emit('test', { data: 'test' });
    
    expect(handler).toHaveBeenCalledWith({ data: 'test' });
  });
  
  test('should unregister event handlers', () => {
    const handler = jest.fn();
    
    eventBus.on('test', handler);
    eventBus.off('test', handler);
    eventBus.emit('test', { data: 'test' });
    
    expect(handler).not.toHaveBeenCalled();
  });
  
  test('should handle multiple handlers for the same event', () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();
    
    eventBus.on('test', handler1);
    eventBus.on('test', handler2);
    eventBus.emit('test', { data: 'test' });
    
    expect(handler1).toHaveBeenCalledWith({ data: 'test' });
    expect(handler2).toHaveBeenCalledWith({ data: 'test' });
  });
  
  test('should handle errors in event handlers', () => {
    const errorHandler = jest.fn().mockImplementation(() => {
      throw new Error('Test error');
    });
    const handler = jest.fn();
    
    // Mock console.error to track calls
    const originalConsoleError = console.error;
    console.error = jest.fn();
    
    eventBus.on('test', errorHandler);
    eventBus.on('test', handler);
    eventBus.emit('test', { data: 'test' });
    
    // Restore console.error
    console.error = originalConsoleError;
    
    // First handler threw an error but second was still called
    expect(errorHandler).toHaveBeenCalledWith({ data: 'test' });
    expect(handler).toHaveBeenCalledWith({ data: 'test' });
    expect(console.error).toHaveBeenCalled();
  });
  
  test('should handle async event handlers', async () => {
    const asyncHandler = jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return 'done';
    });
    
    eventBus.on('test', asyncHandler);
    eventBus.emit('test', { data: 'test' });
    
    // Handler was called but we didn't wait for it
    expect(asyncHandler).toHaveBeenCalledWith({ data: 'test' });
  });
  
  test('should wait for async event handlers with emitAsync', async () => {
    const results: string[] = [];
    
    const asyncHandler1 = jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      results.push('handler1');
    });
    
    const asyncHandler2 = jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
      results.push('handler2');
    });
    
    eventBus.on('test', asyncHandler1);
    eventBus.on('test', asyncHandler2);
    
    await eventBus.emitAsync('test', { data: 'test' });
    
    // Both handlers were called and completed
    expect(asyncHandler1).toHaveBeenCalledWith({ data: 'test' });
    expect(asyncHandler2).toHaveBeenCalledWith({ data: 'test' });
    expect(results).toContain('handler1');
    expect(results).toContain('handler2');
  });
  
  test('should handle errors in async event handlers', async () => {
    const asyncErrorHandler = jest.fn().mockImplementation(async () => {
      throw new Error('Async test error');
    });
    
    const asyncHandler = jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
      return 'done';
    });
    
    // Mock console.error to track calls
    const originalConsoleError = console.error;
    console.error = jest.fn();
    
    eventBus.on('test', asyncErrorHandler);
    eventBus.on('test', asyncHandler);
    
    await eventBus.emitAsync('test', { data: 'test' });
    
    // Restore console.error
    console.error = originalConsoleError;
    
    // Both handlers were called
    expect(asyncErrorHandler).toHaveBeenCalledWith({ data: 'test' });
    expect(asyncHandler).toHaveBeenCalledWith({ data: 'test' });
    expect(console.error).toHaveBeenCalled();
  });
  
  test('should clear all event handlers', () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();
    
    eventBus.on('test1', handler1);
    eventBus.on('test2', handler2);
    eventBus.clear();
    
    eventBus.emit('test1');
    eventBus.emit('test2');
    
    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });
  
  test('should get a list of events with listeners', () => {
    eventBus.on('test1', () => {});
    eventBus.on('test2', () => {});
    
    const events = eventBus.getEvents();
    
    expect(events).toHaveLength(2);
    expect(events).toContain('test1');
    expect(events).toContain('test2');
  });
  
  test('should check if an event has listeners', () => {
    eventBus.on('test', () => {});
    
    expect(eventBus.hasListeners('test')).toBe(true);
    expect(eventBus.hasListeners('other')).toBe(false);
  });
  
  test('should get the number of listeners for an event', () => {
    eventBus.on('test', () => {});
    eventBus.on('test', () => {});
    
    expect(eventBus.listenerCount('test')).toBe(2);
    expect(eventBus.listenerCount('other')).toBe(0);
  });
});
```

Create `tests/core/TypedEventBus.test.ts`:

```typescript
import { TypedEventBus, EventTypes } from '../../src/core/EventTypes';
import { EventBus } from '../../src/core/EventBus';

describe('TypedEventBus', () => {
  let eventBus: EventBus;
  let typedEventBus: TypedEventBus;
  
  beforeEach(() => {
    eventBus = new EventBus();
    typedEventBus = new TypedEventBus(eventBus);
  });
  
  test('should register and trigger typed event handlers', () => {
    const handler = jest.fn();
    
    typedEventBus.on('ui:theme:changed', handler);
    typedEventBus.emit('ui:theme:changed', 'dark');
    
    expect(handler).toHaveBeenCalledWith('dark');
  });
  
  test('should unregister typed event handlers', () => {
    const handler = jest.fn();
    
    typedEventBus.on('ui:theme:changed', handler);
    typedEventBus.off('ui:theme:changed', handler);
    typedEventBus.emit('ui:theme:changed', 'dark');
    
    expect(handler).not.toHaveBeenCalled();
  });
  
  test('should handle complex typed events', () => {
    interface SettingsUpdatedEvent extends EventTypes['settings:updated'] {}
    
    const handler = jest.fn();
    const event: SettingsUpdatedEvent = {
      previousSettings: { /* Minimal mock of settings */ } as any,
      currentSettings: { /* Minimal mock of settings */ } as any,
      changedKeys: ['theme', 'fontSize']
    };
    
    typedEventBus.on('settings:updated', handler);
    typedEventBus.emit('settings:updated', event);
    
    expect(handler).toHaveBeenCalledWith(event);
    expect(handler.mock.calls[0][0].changedKeys).toEqual(['theme', 'fontSize']);
  });
  
  test('should await async typed event handlers', async () => {
    const handler = jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    
    typedEventBus.on('plugin:loaded', handler);
    await typedEventBus.emitAsync('plugin:loaded', undefined);
    
    expect(handler).toHaveBeenCalled();
  });
});
```

## References

- [[💻 Coding/Documentation/Obsidian/Plugin - Documentation.md]] - Obsidian Plugin API documentation for event handling
- [JavaScript Event Patterns](https://www.patterns.dev/posts/observer-pattern) - Observer pattern in JavaScript

## Next Steps

After completing this microphase, proceed to:
- [[💻 Coding/Projects/Chatsidian/3_Implementation/Phase1.4-Settings-Management.md]] - Implementing settings management with secure API key storage
