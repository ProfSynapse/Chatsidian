---
title: Chatsidian Architecture Overview
description: High-level architectural design for the Chatsidian plugin, a native chat interface for Obsidian with MCP integration
date: 2025-05-03
status: planning
tags:
  - architecture
  - obsidian-plugin
  - chat-interface
  - mcp
---

# Chatsidian Architecture Overview

## System Purpose and Goals

Chatsidian provides a native, Obsidian-like chat interface directly within Obsidian while leveraging the Model Context Protocol (MCP) to enable AI assistants to perform actions within the vault. The architecture aims to achieve the following goals:

1. **Native Integration** - Follow Obsidian's design patterns and API usage for seamless integration
2. **Agent-Based Actions** - Perform vault operations via MCP using domain-specific Bounded Context Packs
3. **Conversation Management** - Persist and manage chat history within the vault
4. **Performance** - Minimize latency and resource usage
5. **Extensibility** - Allow for future expansion of capabilities
6. **User Experience** - Match Obsidian's look and feel while providing intuitive chat functionality

## Implementation Phases

The Chatsidian project is structured into the following implementation phases:

### Phase 1: Core Infrastructure

Building the foundation with:
- Data models and type definitions
- Settings management system
- Provider adapter pattern for AI API connections
- Storage abstractions for vault interaction
- Event system for component communication

### Phase 2: MCP and BCP Integration

Implementing the intelligent agent system with:
- Model Context Protocol (MCP) client implementation
- Bounded Context Pack (BCP) architecture
- Domain-specific agent implementations:
  - NoteManager for note CRUD operations
  - FolderManager for folder operations
  - VaultLibrarian for search capabilities
  - PaletteCommander for command palette access

### Phase 3: Chat Interface

Creating the user-facing components:
- Native Obsidian view implementation
- Message rendering with Markdown support
- Input area with autocompletion
- Conversation management UI
- Tool call visualization

### Phase 4: External API

Adding extensibility features:
- Public API for other plugins
- Event hooks for external integration
- Custom extension points
- Documentation for developers

### Phase 5: Integration

Bringing all components together:
- End-to-end testing
- Performance optimization
- Edge case handling
- Refinement of user experience

### Phase 6: Testing and Quality Assurance

Final preparation for release:
- Bug fixing
- User acceptance testing
- Documentation completion
- Release preparation

## Core Architectural Patterns

The Chatsidian architecture implements several key patterns aligned with Obsidian's architecture:

- **Event-Based Communication** - Components communicate through events like Obsidian
- **Adapter Pattern** - Abstract AI providers behind common interfaces
- **Repository Pattern** - Abstract data access through dedicated services
- **Command Pattern** - Encapsulate operations as executable objects
- **Dependency Injection** - Components receive their dependencies at creation
- **Bounded Context** - Tools are organized by domain and scope

## High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                  Chatsidian Plugin                       │
├─────────────────┬──────────────────┬───────────────────┐
│  UI Components  │  Core Components │  MCP Components   │
├─────────────────┼──────────────────┼───────────────────┤
│ - ChatView      │ - PluginCore     │ - MCPClient       │
│ - MessageList   │ - SettingsManager│ - BCPRegistry     │
│ - InputArea     │ - StorageManager │ - ToolManager     │
│ - Sidebar       │ - EventBus       │ - AgentSystem     │
└─────────────────┴──────────────────┴───────────────────┘
          │                │                 │
          ▼                ▼                 ▼
┌─────────────────┬──────────────────┬───────────────────┐
│  Obsidian API   │  Storage Layer   │   AI Providers    │
├─────────────────┼──────────────────┼───────────────────┤
│ - Plugin API    │ - ConversationDB │ - Anthropic       │
│ - Vault API     │ - SettingsDB     │ - OpenAI          │
│ - Workspace API │ - Cache          │ - OpenRouter      │
│ - Markdown      │ - FileSystem     │ - Google AI       │
└─────────────────┴──────────────────┴───────────────────┘
```

## Core Components

### 1. PluginCore

The main entry point that initializes all components:

```typescript
export default class ChatsidianPlugin extends Plugin {
  // Lifecycle methods
  async onload(): Promise<void> {
    // Initialize components
    // Register views
    // Set up event listeners
  }
  
  async onunload(): Promise<void> {
    // Clean up resources
  }
}
```

### 2. SettingsManager

Manages plugin configuration and preferences:

```typescript
export class SettingsManager {
  // API key management
  // Provider configuration
  // UI preferences
  // Save/load settings
}
```

### 3. StorageManager

Handles data persistence within the vault:

```typescript
export class StorageManager {
  // Conversation storage
  // File operations
  // Caching
  // Data migration
}
```

### 4. EventBus

Facilitates communication between components:

```typescript
export class EventBus {
  // Event subscription
  // Event dispatching
  // Event filtering
}
```

### 5. MCPClient

Manages communication with AI providers using the Model Context Protocol:

```typescript
export class MCPClient {
  // Provider management
  // Message formatting
  // Tool execution
  // Response processing
}
```

### 6. BCPRegistry

Manages Bounded Context Packs for different domains:

```typescript
export class BCPRegistry {
  // BCP registration
  // Tool discovery
  // Dynamic loading/unloading
}
```

### 7. ChatView

The main UI component:

```typescript
export class ChatView extends ItemView {
  // UI rendering
  // Event handling
  // Message display
  // Input processing
}
```

## Bounded Context Packs

Chatsidian organizes agent capabilities into domain-specific Bounded Context Packs:

### 1. NoteManager BCP

Responsible for note operations:

```typescript
export const NoteManagerBCP: BoundedContextPack = {
  domain: 'NoteManager',
  tools: [
    {
      name: 'readNote',
      handler: async (params) => {/* implementation */}
    },
    {
      name: 'createNote',
      handler: async (params) => {/* implementation */}
    },
    {
      name: 'updateNote',
      handler: async (params) => {/* implementation */}
    },
    {
      name: 'deleteNote',
      handler: async (params) => {/* implementation */}
    }
  ]
};
```

### 2. FolderManager BCP

Responsible for folder operations:

```typescript
export const FolderManagerBCP: BoundedContextPack = {
  domain: 'FolderManager',
  tools: [
    {
      name: 'createFolder',
      handler: async (params) => {/* implementation */}
    },
    {
      name: 'listFolder',
      handler: async (params) => {/* implementation */}
    },
    {
      name: 'moveFolder',
      handler: async (params) => {/* implementation */}
    },
    {
      name: 'deleteFolder',
      handler: async (params) => {/* implementation */}
    }
  ]
};
```

### 3. VaultLibrarian BCP

Responsible for search and query operations:

```typescript
export const VaultLibrarianBCP: BoundedContextPack = {
  domain: 'VaultLibrarian',
  tools: [
    {
      name: 'searchContent',
      handler: async (params) => {/* implementation */}
    },
    {
      name: 'searchTags',
      handler: async (params) => {/* implementation */}
    },
    {
      name: 'searchProperties',
      handler: async (params) => {/* implementation */}
    },
    {
      name: 'listRecursive',
      handler: async (params) => {/* implementation */}
    }
  ]
};
```

### 4. PaletteCommander BCP

Responsible for executing Obsidian commands:

```typescript
export const PaletteCommanderBCP: BoundedContextPack = {
  domain: 'PaletteCommander',
  tools: [
    {
      name: 'listCommands',
      handler: async (params) => {/* implementation */}
    },
    {
      name: 'executeCommand',
      handler: async (params) => {/* implementation */}
    }
  ]
};
```

## Data Flow

### 1. User Message Flow

1. User enters message in ChatView
2. ChatView dispatches message event
3. MCPClient formats message for AI provider
4. MCPClient sends message to provider
5. Provider response is processed for tool calls
6. Tool calls are routed to appropriate BCP tools
7. Tool results are returned to provider
8. Final response is displayed in ChatView

### 2. Conversation Management Flow

1. New conversation is created
2. Messages are added to conversation
3. StorageManager saves conversation to vault
4. Conversation can be loaded, searched, and navigated

### 3. Settings Flow

1. User updates settings in settings tab
2. SettingsManager saves settings
3. Components are notified of settings changes
4. Components apply new settings

## Integration with Obsidian

Chatsidian integrates with key Obsidian APIs:

### 1. Plugin API

```typescript
// Register views
this.registerView(VIEW_TYPE, (leaf) => new ChatView(leaf));

// Register commands
this.addCommand({
  id: 'open-chatsidian',
  name: 'Open Chatsidian',
  callback: () => this.activateView()
});

// Register settings tab
this.addSettingTab(new ChatsidianSettingTab(this.app, this));
```

### 2. Vault API

```typescript
// Read file
const file = this.app.vault.getAbstractFileByPath(path);
const content = await this.app.vault.read(file);

// Create file
await this.app.vault.create(path, content);

// Modify file
await this.app.vault.modify(file, newContent);

// Delete file
await this.app.vault.delete(file);
```

### 3. Workspace API

```typescript
// Open chat in new leaf
const leaf = this.app.workspace.getLeaf();
await leaf.setViewState({ type: VIEW_TYPE });

// Check if view is already open
const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
```

### 4. MetadataCache API

```typescript
// Get file metadata
const fileCache = this.app.metadataCache.getFileCache(file);

// Search content
const results = this.app.metadataCache.getFilesByTag(tag);
```

## Design Principles

Chatsidian follows these key principles aligned with Obsidian's philosophy:

1. **Local-First** - All data is stored in the vault
2. **Privacy-Focused** - No data is sent to servers except API requests
3. **User Control** - Users have full control over data and settings
4. **Native Experience** - UI follows Obsidian patterns
5. **Extensibility** - Plugin can be extended by other plugins
6. **Modularity** - Components are loosely coupled
7. **Performance** - Operations are optimized for responsiveness

## Technical Constraints

1. **Obsidian API Limitations**
   - Plugin must work within Obsidian's sandbox
   - API changes could impact functionality

2. **Performance Considerations**
   - Large conversations could impact performance
   - Tool operations must be asynchronous

3. **Cross-Platform Support**
   - Must work on all platforms supported by Obsidian
   - May require platform-specific accommodations

## Future Extensibility

1. **Plugin API**
   - Expose API for other plugins to interact with Chatsidian

2. **Custom Agents**
   - Allow users to create custom BCPs

3. **Template System**
   - Develop prompt templates for common tasks

4. **Integration with Other Plugins**
   - DataView, Templater, etc.

## Resources and References

- [Obsidian Plugin API Documentation](https://docs.obsidian.md/)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [Obsidian Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
