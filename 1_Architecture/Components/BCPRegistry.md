---
title: BCP Registry Component Design
description: Detailed design for the Bounded Context Pack (BCP) Registry component of the Chatsidian plugin
date: 2025-05-03
status: planning
tags:
  - architecture
  - component-design
  - bounded-context-packs
  - mcp
---

# BCP Registry Component Design

## Component Overview

The BCP Registry component implements the Bounded Context Packs pattern to organize tool capabilities in Chatsidian. It manages the registration, loading, and unloading of tool packs that represent cohesive slices of functionality, allowing for efficient context window management and improved modularity.

## Key Responsibilities

- Managing the registry of available Bounded Context Packs
- Handling dynamic loading and unloading of packs
- Providing system-level tools for pack management
- Facilitating on-demand tool availability
- Notifying the MCP Connector of tool changes

## Internal Structure

### Classes

#### `BCPRegistry`

Main registry class that manages bounded context packs.

```typescript
// src/mcp/BCPRegistry.ts
import { App } from 'obsidian';
import { EventBus } from '../core/EventBus';

export class BCPRegistry {
  private app: App;
  private eventBus: EventBus;
  private packs: Map<string, BoundedContextPack> = new Map();
  private loadedPacks: Set<string> = new Set();
  
  constructor(app: App, eventBus: EventBus) {
    this.app = app;
    this.eventBus = eventBus;
    
    // Register event handlers
    this.eventBus.on('bcp:load', this.loadPack.bind(this));
    this.eventBus.on('bcp:unload', this.unloadPack.bind(this));
    this.eventBus.on('bcp:list', this.listPacks.bind(this));
  }
  
  public async initialize(): Promise<void> {
    // Register built-in BCPs
    await this.registerBuiltInPacks();
    
    // Register system tools
    this.registerSystemTools();
  }
  
  // Registers all built-in packs from the bcps folder
  private async registerBuiltInPacks(): Promise<void> { /* ... */ }
  
  // Registers system-level tools for BCP management
  private registerSystemTools(): void { /* ... */ }
  
  // Loads a BCP and registers its tools
  private async loadPack(domain: string): Promise<any> { /* ... */ }
  
  // Unloads a BCP and unregisters its tools
  private async unloadPack(domain: string): Promise<any> { /* ... */ }
  
  // Lists all available BCPs
  private async listPacks(): Promise<any> { /* ... */ }
  
  // Returns all tools from loaded packs
  public getLoadedTools(): Tool[] { /* ... */ }
}
```

#### `BoundedContextPack` Interface

Interface for bounded context pack definitions.

```typescript
export interface BoundedContextPack {
  domain: string;          // Unique domain name for the pack
  description: string;     // Human-readable description
  tools: Tool[];           // Collection of tools in this pack
}

export interface Tool {
  name: string;            // Tool name (without domain prefix)
  description: string;     // Human-readable description
  handler: (params: any) => Promise<any>;  // Function to execute
  schema: any;             // JSON Schema for parameters
}
```

## Tool Pack Structure

Each Bounded Context Pack is structured as a separate folder with the following organization:

```
src/bcps/
  NoteReader/                  // BCP for note reading operations
    index.ts                   // Exports pack definition
    readNote.ts                // Individual tool implementations
    batchRead.ts
    readLine.ts
  NoteEditor/                  // BCP for note editing operations
    index.ts
    replace.ts
    append.ts
    ...
```

### Pack Definition Example

```typescript
// src/bcps/NoteReader/index.ts
import { BoundedContextPack } from '../../mcp/BCPRegistry';
import { readNote } from './readNote';
import { batchRead } from './batchRead';
import { readLine } from './readLine';

export default {
  domain: 'NoteReader',
  description: 'Read notes from the vault',
  tools: [
    {
      name: 'readNote',
      description: 'Read a note from the vault',
      schema: { /* JSON Schema */ },
      handler: readNote
    },
    // Other tools...
  ]
} as BoundedContextPack;
```

### Individual Tool Example

```typescript
// src/bcps/NoteReader/readNote.ts
import { App, TFile } from 'obsidian';

export async function readNote(params: { path: string }, app: App): Promise<any> {
  const { path } = params;
  
  // Validate path
  if (!path) {
    throw new Error('Path is required');
  }
  
  // Get file and read content
  const file = app.vault.getAbstractFileByPath(path);
  // ... implementation details
  
  return {
    path,
    content,
    metadata: { /* file metadata */ }
  };
}
```

## System Tools

The BCP Registry provides the following system-level tools for BCP management:

1. **System.listBCPs** - Lists all available bounded context packs with their load status
2. **System.loadBCP** - Dynamically loads a BCP by domain name
3. **System.unloadBCP** - Unloads a previously loaded BCP

These tools are always available and do not need to be explicitly loaded.

## BCP Operation Flow

### Initialization Flow

1. Plugin initializes the BCP Registry
2. Registry registers all built-in packs but does not load them
3. Registry registers system tools
4. Only system tools are available in the initial MCP manifest

### Dynamic Loading Flow

1. Model notices it needs a capability not in the current manifest
2. Model calls `System.listBCPs()` to discover available packs
3. Model calls `System.loadBCP({domain: "NoteReader"})` to load a relevant pack
4. BCP Registry registers all tools from the pack
5. Registry emits a tools changed event
6. MCP Connector updates its manifest with new tools
7. Model can now see and use the newly loaded tools

### Unloading Flow

1. Model determines a pack is no longer needed
2. Model calls `System.unloadBCP({domain: "NoteReader"})`
3. BCP Registry unregisters all tools from the pack
4. Registry emits a tools changed event
5. MCP Connector updates its manifest, removing the unloaded tools

## Integration with Other Components

### MCP Connector

- Receives notifications when tools are loaded or unloaded
- Updates its tool manifest in response to changes
- Routes tool calls to the Tool Manager

### Tool Manager

- Receives tool registrations from the BCP Registry
- Validates tool parameters against schemas
- Executes tool handlers

### Plugin Core

- Initializes the BCP Registry during plugin load
- Provides access to the Obsidian API for tool operations

## Error Handling

1. **Pack Not Found**
   - Return clear error message if requested pack doesn't exist
   - Provide list of available packs

2. **Tool Execution Errors**
   - Capture and report errors from tool handlers
   - Provide helpful context for troubleshooting

3. **System Pack Protection**
   - Prevent unloading of the System pack
   - Ensure system tools are always available

## Testing Approach

1. **Unit Tests**
   - Test individual tool implementations
   - Verify pack loading/unloading logic
   - Test parameter validation

2. **Integration Tests**
   - Test interaction with MCP Connector
   - Verify tool registration events
   - Test system tools functionality

## Advantages of BCP Pattern

The Bounded Context Pack pattern provides several advantages:

1. **Token Economy** - Reduces prompt size by only including relevant tools
2. **Modular Architecture** - Maintains separation of concerns with independent packages
3. **Progressive Enhancement** - Loads capabilities on demand
4. **Extensibility** - Makes it easy to add new packs without modifying core code
5. **Maintainability** - Tools related to a domain are grouped together

## Implementation Considerations

1. **Performance Impact**
   - Pack loading should be efficient to minimize latency
   - Consider preloading commonly used packs

2. **Security**
   - Validate input parameters thoroughly
   - Consider requiring confirmation for destructive operations

3. **Discoverability**
   - Ensure pack names and descriptions are intuitive
   - Group related functionality logically

4. **Cross-Pack Dependencies**
   - Handle dependencies between packs
   - Consider automatic loading of dependent packs