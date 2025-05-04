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

## Integration with Obsidian

The EventBus extends Obsidian's Events class for better integration with the Obsidian API. When using the EventBus in the plugin's main class, you should register Obsidian's events using the `registerEvent` method:

```typescript
// In your plugin's main class
class ChatsidianPlugin extends Plugin {
  public eventBus: EventBus;
  
  async onload() {
    // Initialize event bus
    this.eventBus = new EventBus();
    
    // Register Obsidian workspace events
    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        this.eventBus.emit('ui:layout:changed');
      })
    );
    
    // Register Obsidian file events
    this.registerEvent(
      this.app.vault.on('create', (file) => {
        if (file.path.startsWith(this.settings.conversationsFolder)) {
          this.eventBus.emit('conversation:file:created', { file });
        }
      })
    );
    
    // Other initialization
  }
}
```

By using Obsidian's registration methods via `this.registerEvent()`, these event handlers will be automatically cleaned up when the plugin is unloaded, preventing memory leaks and ensuring proper lifecycle management.
