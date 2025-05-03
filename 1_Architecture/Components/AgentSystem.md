---
title: Agent System Component Design
description: Detailed design for the Agent System component of the Chatsidian plugin
date: 2025-05-03
status: planning
tags:
  - architecture
  - component-design
  - agents
  - mcp
---

# Agent System Component Design

## Component Overview

The Agent System component manages the execution of operations within the Obsidian vault through a system of specialized agents. This component is largely adapted from the Claudesidian codebase, with modifications to support direct integration with the Chatsidian plugin rather than the Claude Desktop app.

## Key Responsibilities

- Managing the registry of available agents
- Routing tool calls to appropriate agents
- Validating operation parameters
- Executing agent operations (modes)
- Handling errors and reporting results
- Converting between MCP tool call format and agent operations

## Internal Structure

### Classes

#### `AgentManager`

Central manager class that handles agent registration and operation routing.

```typescript
// src/services/AgentManager.ts
import { App } from 'obsidian';
import { IAgent } from '../agents/interfaces/IAgent';
import { EventEmitter } from 'events';

export class AgentManager extends EventEmitter {
  private agents: Map<string, IAgent> = new Map();
  
  constructor(private app: App) {
    super();
    this.initializeAgents();
  }
  
  // Initialize and register default agents
  private initializeAgents(): void {
    // Create and register standard agents
    this.registerAgent(new NoteReaderAgent(this.app));
    this.registerAgent(new NoteEditorAgent(this.app));
    this.registerAgent(new VaultLibrarianAgent(this.app));
    this.registerAgent(new VaultManagerAgent(this.app));
  }
  
  // Register a new agent
  registerAgent(agent: IAgent): void {
    if (this.agents.has(agent.name)) {
      throw new Error(`Agent ${agent.name} is already registered`);
    }
    
    this.agents.set(agent.name, agent);
    this.emit('agentRegistered', agent.name);
  }
  
  // Get an agent by name
  getAgent(name: string): IAgent {
    const agent = this.agents.get(name);
    if (!agent) {
      throw new Error(`Agent ${name} not found`);
    }
    
    return agent;
  }
  
  // Get all registered agents
  getAgents(): IAgent[] {
    return Array.from(this.agents.values());
  }
  
  // Get available tools for MCP
  getAvailableTools(): any[] {
    const tools = [];
    
    for (const agent of this.getAgents()) {
      const modes = agent.getModes();
      
      // Convert agent and its modes to MCP tool format
      const tool = {
        name: agent.name,
        description: agent.description,
        inputSchema: this.createAgentSchema(agent, modes)
      };
      
      tools.push(tool);
    }
    
    return tools;
  }
  
  // Create JSON schema for agent from its modes
  private createAgentSchema(agent: IAgent, modes: IMode[]): any {
    // Create a schema combining all modes as in Claudesidian
  }
  
  // Execute an agent operation
  async executeAgentMode(agentName: string, mode: string, params: any): Promise<any> {
    try {
      // Get the agent
      const agent = this.getAgent(agentName);
      
      // Validate parameters
      this.validateParameters(agent, mode, params);
      
      // Execute the mode
      const result = await agent.executeMode(mode, params);
      
      return result;
    } catch (error) {
      // Log and rethrow
      console.error(`Error executing agent ${agentName} mode ${mode}:`, error);
      throw error;
    }
  }
  
  // Execute tool call from MCP
  async executeToolCall(toolCall: any): Promise<any> {
    // Extract agent name, mode and parameters from tool call
    const { agent: agentName, mode, params } = this.parseToolCall(toolCall);
    
    // Execute the operation
    return this.executeAgentMode(agentName, mode, params);
  }
  
  // Parse tool call into agent, mode and parameters
  private parseToolCall(toolCall: any): { agent: string; mode: string; params: any } {
    // Extract agent and mode from tool name
    const agentName = toolCall.name;
    const mode = toolCall.arguments.mode;
    
    // Extract parameters, removing the mode
    const { mode: _, ...params } = toolCall.arguments;
    
    return {
      agent: agentName,
      mode,
      params
    };
  }
  
  // Validate parameters against mode schema
  private validateParameters(agent: IAgent, mode: string, params: any): void {
    // Get the mode
    const modeObj = agent.getMode(mode);
    if (!modeObj) {
      throw new Error(`Mode ${mode} not found in agent ${agent.name}`);
    }
    
    // Get parameter schema
    const schema = modeObj.getParameterSchema();
    
    // Validate parameters against schema
    // Implement JSON schema validation here
  }
}
```

#### `BaseAgent`

Abstract base class for all agents (adapted from Claudesidian).

```typescript
// src/agents/baseAgent.ts
import { IAgent } from './interfaces/IAgent';
import { IMode } from './interfaces/IMode';

export abstract class BaseAgent implements IAgent {
  name: string;
  description: string;
  version: string;
  protected modes: Map<string, IMode> = new Map();
  
  constructor(name: string, description: string, version: string) {
    this.name = name;
    this.description = description;
    this.version = version;
  }
  
  getModes(): IMode[] {
    return Array.from(this.modes.values());
  }
  
  getMode(modeSlug: string): IMode | undefined {
    return this.modes.get(modeSlug);
  }
  
  registerMode(mode: IMode): void {
    this.modes.set(mode.slug, mode);
  }
  
  async initialize(): Promise<void> {
    // Default implementation does nothing
  }
  
  async executeMode(modeSlug: string, params: any): Promise<any> {
    const mode = this.modes.get(modeSlug);
    if (!mode) {
      throw new Error(`Mode ${modeSlug} not found in agent ${this.name}`);
    }
    
    return await mode.execute(params);
  }
}
```

#### `BaseMode`

Abstract base class for all agent modes (adapted from Claudesidian).

```typescript
// src/agents/baseMode.ts
import { IMode } from './interfaces/IMode';

export abstract class BaseMode<T = any, R = any> implements IMode<T, R> {
  slug: string;
  name: string;
  description: string;
  version: string;
  
  constructor(slug: string, name: string, description: string, version: string) {
    this.slug = slug;
    this.name = name;
    this.description = description;
    this.version = version;
  }
  
  abstract execute(params: T): Promise<R>;
  
  abstract getParameterSchema(): any;
  
  getResultSchema(): any {
    // Default implementation returns a simple success schema
    return {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the operation was successful'
        },
        error: {
          type: 'string',
          description: 'Error message if operation failed'
        }
      }
    };
  }
}
```

### Interfaces

#### `IAgent`

Interface for all agents.

```typescript
// src/agents/interfaces/IAgent.ts
import { IMode } from './IMode';

export interface IAgent {
  name: string;
  description: string;
  version: string;
  
  getModes(): IMode[];
  getMode(modeSlug: string): IMode | undefined;
  initialize(): Promise<void>;
  executeMode(modeSlug: string, params: any): Promise<any>;
}
```

#### `IMode`

Interface for agent modes.

```typescript
// src/agents/interfaces/IMode.ts
export interface IMode<T = any, R = any> {
  slug: string;
  name: string;
  description: string;
  version: string;
  
  execute(params: T): Promise<R>;
  getParameterSchema(): any;
  getResultSchema(): any;
}
```

## Agent Implementations

### `NoteReaderAgent`

Agent for reading notes from the vault.

```typescript
// src/agents/noteReader/noteReader.ts
import { App } from 'obsidian';
import { BaseAgent } from '../baseAgent';
import { NoteReaderConfig } from './config';
import { ReadNoteMode, BatchReadMode, ReadLineMode } from './modes';

export class NoteReaderAgent extends BaseAgent {
  constructor(app: App) {
    super(
      NoteReaderConfig.name,
      NoteReaderConfig.description,
      NoteReaderConfig.version
    );
    
    // Register modes
    this.registerMode(new ReadNoteMode(app));
    this.registerMode(new BatchReadMode(app));
    this.registerMode(new ReadLineMode(app));
  }
}
```

### `NoteEditorAgent`

Agent for editing notes in the vault.

```typescript
// src/agents/noteEditor/noteEditor.ts
import { App } from 'obsidian';
import { BaseAgent } from '../baseAgent';
import { NoteEditorConfig } from './config';
import {
  ReplaceMode,
  InsertMode,
  DeleteMode,
  AppendMode,
  PrependMode,
  BatchMode
} from './modes';

export class NoteEditorAgent extends BaseAgent {
  constructor(app: App) {
    super(
      NoteEditorConfig.name,
      NoteEditorConfig.description,
      NoteEditorConfig.version
    );
    
    // Register modes
    this.registerMode(new ReplaceMode(app));
    this.registerMode(new InsertMode(app));
    this.registerMode(new DeleteMode(app));
    this.registerMode(new AppendMode(app));
    this.registerMode(new PrependMode(app));
    this.registerMode(new BatchMode(app));
  }
}
```

Additional agents like `VaultLibrarianAgent` and `VaultManagerAgent` follow similar patterns.

## Operation Flow

### Agent Registration Flow

1. On plugin initialization:
   - `AgentManager` is created
   - Default agents are instantiated
   - Each agent registers its modes
   - Agents are added to the registry

2. On demand:
   - Additional agents can be registered at runtime
   - Events are emitted to notify of new capabilities

### Tool Call Execution Flow

1. `MCPConnector` receives a tool call from AI response
2. Tool call is passed to `AgentManager.executeToolCall`
3. `AgentManager` parses the tool call to extract agent, mode, and parameters
4. `AgentManager` retrieves the specified agent
5. `AgentManager` validates parameters against the mode's schema
6. Operation is executed via `agent.executeMode(mode, params)`
7. Result is returned to `MCPConnector`
8. Result is formatted and included in the next API call

## Tool Definition Format

Agent capabilities are exposed as tools through the MCP protocol using this format:

```typescript
// Example tool definition
{
  name: "noteReader",
  description: "Read notes from the vault",
  inputSchema: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["readNote", "batchRead", "readLine"],
        description: "The operation mode for this agent"
      }
    },
    required: ["mode"],
    allOf: [
      {
        if: {
          properties: { mode: { enum: ["readNote"] } },
          required: ["mode"]
        },
        then: {
          properties: {
            path: {
              type: "string",
              description: "Path to the note"
            }
          },
          required: ["path"]
        }
      },
      // Additional mode schemas...
    ]
  }
}
```

## Error Handling

### Agent Errors

1. **Missing Agent**
   - Handle cases where an agent doesn't exist
   - Provide helpful error message with available agents

2. **Missing Mode**
   - Handle cases where a mode doesn't exist
   - Provide helpful error message with available modes

3. **Parameter Validation**
   - Validate parameters against JSON schema
   - Return clear validation errors

4. **Execution Errors**
   - Capture and format operation errors
   - Include helpful context for troubleshooting

## Integration with Other Components

### MCP Connector

- Receives tool call requests
- Gets available tools list
- Receives tool execution results

### Settings Manager

- Configures which agents are enabled
- Sets agent-specific options

## Security and Safety

1. **Parameter Validation**
   - All parameters are validated against schemas
   - Prevent malicious inputs

2. **Path Validation**
   - File and folder paths are validated
   - Prevent directory traversal attacks

3. **Operation Confirmation**
   - Potentially destructive operations can be configured to require confirmation
   - Provide detailed description of changes

## Pseudocode Examples

### Tool Call Parsing and Execution

```typescript
async function executeToolCall(toolCall: any): Promise<any> {
  try {
    // Parse tool call
    const { agent, mode, params } = parseToolCall(toolCall);
    
    // Log operation
    console.log(`Executing ${agent}.${mode} with params:`, params);
    
    // Execute operation
    const result = await executeAgentMode(agent, mode, params);
    
    // Format result
    return {
      status: 'success',
      result: result
    };
  } catch (error) {
    // Log error
    console.error('Tool call execution failed:', error);
    
    // Return error result
    return {
      status: 'error',
      error: error.message
    };
  }
}

function parseToolCall(toolCall: any): { agent: string; mode: string; params: any } {
  // Validate tool call
  if (!toolCall || !toolCall.name || !toolCall.arguments) {
    throw new Error('Invalid tool call format');
  }
  
  // Extract agent name
  const agentName = toolCall.name;
  
  // Extract mode and params
  const { mode, ...params } = toolCall.arguments;
  
  if (!mode) {
    throw new Error('Missing required parameter: mode');
  }
  
  return {
    agent: agentName,
    mode,
    params
  };
}
```

### Parameter Validation

```typescript
function validateParameters(agent: IAgent, mode: string, params: any): void {
  // Get the mode
  const modeObj = agent.getMode(mode);
  if (!modeObj) {
    throw new Error(`Mode ${mode} not found in agent ${agent.name}`);
  }
  
  // Get schema
  const schema = modeObj.getParameterSchema();
  
  // Validate required parameters
  if (schema.required) {
    for (const required of schema.required) {
      if (!(required in params)) {
        throw new Error(`Missing required parameter: ${required}`);
      }
    }
  }
  
  // Validate parameter types
  if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      if (key in params) {
        // Type validation
        if (prop.type === 'string' && typeof params[key] !== 'string') {
          throw new Error(`Parameter ${key} must be a string`);
        } else if (prop.type === 'number' && typeof params[key] !== 'number') {
          throw new Error(`Parameter ${key} must be a number`);
        } else if (prop.type === 'boolean' && typeof params[key] !== 'boolean') {
          throw new Error(`Parameter ${key} must be a boolean`);
        } else if (prop.type === 'array' && !Array.isArray(params[key])) {
          throw new Error(`Parameter ${key} must be an array`);
        }
        
        // Enum validation
        if (prop.enum && !prop.enum.includes(params[key])) {
          throw new Error(`Parameter ${key} must be one of: ${prop.enum.join(', ')}`);
        }
      }
    }
  }
}
```

## Testing Approach

1. **Unit Tests**
   - Test agent registration
   - Test mode execution
   - Test parameter validation
   - Test error handling

2. **Integration Tests**
   - Test tool call execution
   - Test agent interaction with vault

3. **Performance Tests**
   - Test with large operations
   - Test concurrent operations

## References

- Claudesidian agent architecture (provided repository)
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/docs/concepts/tools)