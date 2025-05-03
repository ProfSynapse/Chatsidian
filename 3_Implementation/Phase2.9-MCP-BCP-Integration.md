---
title: Phase 2.9 - MCP-BCP Integration
description: Implementation plan for connecting MCP system with BCP architecture in Chatsidian
date: 2025-05-03
status: implementation
tags:
  - implementation
  - phase-2
  - mcp
  - bcp
  - integration
  - tools
---

# Phase 2.9: MCP-BCP Integration

## Overview

This micro-phase focuses on connecting the Model Context Protocol (MCP) system with the Bounded Context Pack (BCP) architecture in Chatsidian. The integration will enable AI assistants to discover, register, and use tools from BCPs in a dynamic and extensible way. This phase builds upon the MCP client developed in previous phases and the BCP architecture established earlier, creating a seamless bridge between AI capabilities and vault operations.

## Goals

- Implement a tool discovery mechanism
- Add dynamic tool registration
- Create tool schemas for MCP
- Implement context passing
- Add tool call routing to BCPs
- Develop result formatting


## Implementation Steps

### 1. Implement Tool Discovery Mechanism

First, let's enhance the ToolManager to discover tools from registered BCPs:

```typescript
/**
 * Enhanced ToolManager with discovery capabilities
 */
export class EnhancedToolManager extends ToolManager {
  /**
   * BCP registry reference
   */
  private bcpRegistry: BCPRegistry;
  
  /**
   * Event bus reference
   */
  private eventBus: EventBus;
  
  /**
   * Map of tool names to handlers
   */
  private toolHandlers: Map<string, ToolHandler> = new Map();
  
  /**
   * Map of tool names to schemas
   */
  private toolSchemas: Map<string, any> = new Map();
  
  /**
   * Create a new enhanced tool manager
   * @param eventBus - Event bus for communication
   * @param bcpRegistry - BCP registry for tool discovery
   */
  constructor(eventBus: EventBus, bcpRegistry: BCPRegistry) {
    super(eventBus, bcpRegistry);
    this.eventBus = eventBus;
    this.bcpRegistry = bcpRegistry;
    
    // Listen for BCP events
    this.registerEventListeners();
  }
  
  /**
   * Register event listeners for BCP events
   */
  private registerEventListeners(): void {
    // Listen for pack loaded events
    this.eventBus.on('bcpRegistry:packLoaded', (data) => {
      this.discoverToolsFromPack(data.domain);
    });
    
    // Listen for pack unloaded events
    this.eventBus.on('bcpRegistry:packUnloaded', (data) => {
      this.removeToolsFromPack(data.domain);
    });
  }
  
  /**
   * Discover tools from a loaded BCP
   * @param domain - BCP domain
   */
  public discoverToolsFromPack(domain: string): void {
    // Get the BCP
    const pack = this.bcpRegistry.getPack(domain);
    
    if (!pack) {
      console.warn(`Cannot discover tools: BCP not found: ${domain}`);
      return;
    }
    
    // Register each tool
    for (const tool of pack.tools) {
      const fullName = `${domain}.${tool.name}`;
      
      // Register tool handler
      this.toolHandlers.set(fullName, tool.handler);
      
      // Register tool schema
      this.toolSchemas.set(fullName, tool.schema);
      
      // Emit registration event
      this.eventBus.emit('toolManager:toolRegistered', {
        domain,
        name: tool.name,
        fullName,
        schema: tool.schema
      });
    }
    
    console.log(`Discovered ${pack.tools.length} tools from BCP: ${domain}`);
  }
  
  /**
   * Remove tools from an unloaded BCP
   * @param domain - BCP domain
   */
  public removeToolsFromPack(domain: string): void {
    // Find tools from this domain
    const toolsToRemove: string[] = [];
    
    for (const toolName of this.toolHandlers.keys()) {
      if (toolName.startsWith(`${domain}.`)) {
        toolsToRemove.push(toolName);
      }
    }
    
    // Remove each tool
    for (const toolName of toolsToRemove) {
      this.toolHandlers.delete(toolName);
      this.toolSchemas.delete(toolName);
      
      // Emit removal event
      this.eventBus.emit('toolManager:toolRemoved', {
        fullName: toolName
      });
    }
    
    console.log(`Removed ${toolsToRemove.length} tools from BCP: ${domain}`);
  }
  
  /**
   * Get a tool handler by name
   * @param toolName - Full tool name (domain.name)
   * @returns Tool handler or undefined
   */
  public getToolHandler(toolName: string): ToolHandler | undefined {
    return this.toolHandlers.get(toolName);
  }
  
  /**
   * Get a tool schema by name
   * @param toolName - Full tool name (domain.name)
   * @returns Tool schema or undefined
   */
  public getToolSchema(toolName: string): any | undefined {
    return this.toolSchemas.get(toolName);
  }
  
  /**
   * Get all available tools
   * @returns Array of tools with name, schema, and description
   */
  public getTools(): Tool[] {
    const tools: Tool[] = [];
    
    for (const [name, schema] of this.toolSchemas.entries()) {
      const [domain, toolName] = name.split('.');
      const pack = this.bcpRegistry.getPack(domain);
      
      if (pack) {
        const toolDef = pack.tools.find(t => t.name === toolName);
        
        if (toolDef) {
          tools.push({
            name,
            schema,
            description: toolDef.description || `${toolName} tool from ${domain}`
          });
        }
      }
    }
    
    return tools;
  }
  
  /**
   * Discover all tools from loaded BCPs
   */
  public discoverAllTools(): void {
    // Get all loaded BCPs
    const loadedPacks = this.bcpRegistry.getLoadedPacks();
    
    // Discover tools from each pack
    for (const domain of loadedPacks) {
      this.discoverToolsFromPack(domain);
    }
  }
}
```

### 2. Add Dynamic Tool Registration

Next, let's implement the mechanism for dynamically registering tools with the AI system:

```typescript
/**
 * Tool information for MCP
 */
export interface Tool {
  /**
   * Tool name (domain.name)
   */
  name: string;
  
  /**
   * Tool description
   */
  description: string;
  
  /**
   * Tool schema
   */
  schema: any;
}

/**
 * Tool handler function
 */
export type ToolHandler = (params: any) => Promise<any>;

/**
 * Convert JSON Schema to OpenAI function format
 * @param schema - JSON Schema
 * @param name - Function name
 * @param description - Function description
 * @returns OpenAI function definition
 */
export function convertSchemaToOpenAIFunction(
  schema: any,
  name: string,
  description: string
): any {
  return {
    name,
    description,
    parameters: schema
  };
}

/**
 * Convert JSON Schema to Anthropic tool format
 * @param schema - JSON Schema
 * @param name - Tool name
 * @param description - Tool description
 * @returns Anthropic tool definition
 */
export function convertSchemaToAnthropicTool(
  schema: any,
  name: string,
  description: string
): any {
  return {
    name,
    description,
    input_schema: schema
  };
}

/**
 * Get tools for MCP in the appropriate format
 * @param tools - Tools array
 * @param provider - AI provider name
 * @returns Formatted tools for MCP
 */
export function getToolsForMCP(
  tools: Tool[],
  provider: string
): any[] {
  if (provider === 'anthropic') {
    return tools.map(tool => 
      convertSchemaToAnthropicTool(tool.schema, tool.name, tool.description)
    );
  } else if (provider === 'openai') {
    return tools.map(tool => 
      convertSchemaToOpenAIFunction(tool.schema, tool.name, tool.description)
    );
  } else {
    throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Enhanced MCP client with BCP integration
 */
export class IntegratedMCPClient extends ResilientMCPClient {
  /**
   * Tool manager
   */
  private toolManager: EnhancedToolManager;
  
  /**
   * Create a new integrated MCP client
   * @param settings - Settings manager
   * @param toolManager - Enhanced tool manager
   * @param eventBus - Event bus
   */
  constructor(
    settings: SettingsManager,
    toolManager: EnhancedToolManager,
    eventBus: EventBus
  ) {
    super(settings, toolManager as ToolManager, eventBus);
    this.toolManager = toolManager;
  }
  
  /**
   * Initialize the client
   */
  public async initialize(): Promise<void> {
    // Initialize base client
    await super.initialize();
    
    // Discover all tools
    this.toolManager.discoverAllTools();
  }
  
  /**
   * Get tools for MCP in the appropriate format
   * @param toolFilter - Optional tool filter function
   * @returns Formatted tools for MCP
   */
  public getToolsForMCP(toolFilter?: (tool: Tool) => boolean): any[] {
    // Get all tools
    let tools = this.toolManager.getTools();
    
    // Apply filter if provided
    if (toolFilter) {
      tools = tools.filter(toolFilter);
    }
    
    // Format tools for provider
    const provider = this.settings.getSettings().provider;
    return getToolsForMCP(tools, provider);
  }
}
```

### 3. Create Tool Schemas for MCP

Let's implement a utility to create standardized tool schemas:

```typescript
/**
 * Type definitions for schema properties
 */
export enum PropertyType {
  String = 'string',
  Number = 'number',
  Integer = 'integer',
  Boolean = 'boolean',
  Array = 'array',
  Object = 'object'
}

/**
 * Property definition
 */
export interface PropertyDefinition {
  /**
   * Property type
   */
  type: PropertyType;
  
  /**
   * Property description
   */
  description: string;
  
  /**
   * Whether the property is required
   */
  required?: boolean;
  
  /**
   * Enum values (for string type)
   */
  enum?: string[];
  
  /**
   * Minimum value (for number/integer type)
   */
  minimum?: number;
  
  /**
   * Maximum value (for number/integer type)
   */
  maximum?: number;
  
  /**
   * Default value
   */
  default?: any;
  
  /**
   * Array item type (for array type)
   */
  items?: PropertyDefinition | PropertyDefinition[];
  
  /**
   * Object properties (for object type)
   */
  properties?: Record<string, PropertyDefinition>;
  
  /**
   * Object required properties (for object type)
   */
  objectRequired?: string[];
}

/**
 * Schema builder for tool definitions
 */
export class SchemaBuilder {
  /**
   * Property definitions
   */
  private properties: Record<string, any> = {};
  
  /**
   * Required properties
   */
  private required: string[] = [];
  
  /**
   * Add a string property
   * @param name - Property name
   * @param description - Property description
   * @param options - Additional options
   * @returns SchemaBuilder instance
   */
  public addString(
    name: string,
    description: string,
    options: {
      required?: boolean;
      enum?: string[];
      default?: string;
    } = {}
  ): SchemaBuilder {
    this.properties[name] = {
      type: PropertyType.String,
      description
    };
    
    if (options.enum) {
      this.properties[name].enum = options.enum;
    }
    
    if (options.default !== undefined) {
      this.properties[name].default = options.default;
    }
    
    if (options.required) {
      this.required.push(name);
    }
    
    return this;
  }
  
  /**
   * Add a number property
   * @param name - Property name
   * @param description - Property description
   * @param options - Additional options
   * @returns SchemaBuilder instance
   */
  public addNumber(
    name: string,
    description: string,
    options: {
      required?: boolean;
      minimum?: number;
      maximum?: number;
      default?: number;
    } = {}
  ): SchemaBuilder {
    this.properties[name] = {
      type: PropertyType.Number,
      description
    };
    
    if (options.minimum !== undefined) {
      this.properties[name].minimum = options.minimum;
    }
    
    if (options.maximum !== undefined) {
      this.properties[name].maximum = options.maximum;
    }
    
    if (options.default !== undefined) {
      this.properties[name].default = options.default;
    }
    
    if (options.required) {
      this.required.push(name);
    }
    
    return this;
  }
  
  /**
   * Add a boolean property
   * @param name - Property name
   * @param description - Property description
   * @param options - Additional options
   * @returns SchemaBuilder instance
   */
  public addBoolean(
    name: string,
    description: string,
    options: {
      required?: boolean;
      default?: boolean;
    } = {}
  ): SchemaBuilder {
    this.properties[name] = {
      type: PropertyType.Boolean,
      description
    };
    
    if (options.default !== undefined) {
      this.properties[name].default = options.default;
    }
    
    if (options.required) {
      this.required.push(name);
    }
    
    return this;
  }
  
  /**
   * Add an array property
   * @param name - Property name
   * @param description - Property description
   * @param itemType - Array item type
   * @param options - Additional options
   * @returns SchemaBuilder instance
   */
  public addArray(
    name: string,
    description: string,
    itemType: PropertyDefinition,
    options: {
      required?: boolean;
    } = {}
  ): SchemaBuilder {
    this.properties[name] = {
      type: PropertyType.Array,
      description,
      items: itemType
    };
    
    if (options.required) {
      this.required.push(name);
    }
    
    return this;
  }
  
  /**
   * Add an object property
   * @param name - Property name
   * @param description - Property description
   * @param properties - Object properties
   * @param options - Additional options
   * @returns SchemaBuilder instance
   */
  public addObject(
    name: string,
    description: string,
    properties: Record<string, PropertyDefinition>,
    options: {
      required?: boolean;
      objectRequired?: string[];
    } = {}
  ): SchemaBuilder {
    this.properties[name] = {
      type: PropertyType.Object,
      description,
      properties
    };
    
    if (options.objectRequired && options.objectRequired.length > 0) {
      this.properties[name].required = options.objectRequired;
    }
    
    if (options.required) {
      this.required.push(name);
    }
    
    return this;
  }
  
  /**
   * Build the schema
   * @returns JSON Schema
   */
  public build(): any {
    const schema: any = {
      type: 'object',
      properties: this.properties
    };
    
    if (this.required.length > 0) {
      schema.required = this.required;
    }
    
    return schema;
  }
}
```

### 4. Implement Context Passing

Next, let's implement context passing between the MCP client and BCPs:

```typescript
/**
 * Context for tool execution
 */
export interface ToolExecutionContext {
  /**
   * Conversation ID
   */
  conversationId: string;
  
  /**
   * User ID
   */
  userId?: string;
  
  /**
   * Message ID
   */
  messageId?: string;
  
  /**
   * Tool call ID
   */
  toolCallId: string;
  
  /**
   * Current time
   */
  timestamp: number;
  
  /**
   * Additional context
   */
  [key: string]: any;
}

/**
 * Tool execution request
 */
export interface ToolExecutionRequest {
  /**
   * Tool name
   */
  name: string;
  
  /**
   * Tool arguments
   */
  arguments: any;
  
  /**
   * Execution context
   */
  context: ToolExecutionContext;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  /**
   * Result data
   */
  data: any;
  
  /**
   * Execution status
   */
  status: 'success' | 'error';
  
  /**
   * Error message (if status is error)
   */
  error?: string;
  
  /**
   * Execution metadata
   */
  metadata?: {
    /**
     * Execution time in milliseconds
     */
    executionTime: number;
    
    /**
     * Additional metadata
     */
    [key: string]: any;
  };
}

/**
 * Enhanced tool manager with context passing
 */
export class ContextAwareToolManager extends EnhancedToolManager {
  /**
   * Execute a tool with context
   * @param request - Tool execution request
   * @returns Tool execution result
   */
  public async executeToolWithContext(
    request: ToolExecutionRequest
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Emit execution start event
      this.eventBus.emit('toolManager:executionStart', {
        request,
        startTime
      });
      
      // Get tool handler
      const handler = this.getToolHandler(request.name);
      
      if (!handler) {
        throw new Error(`Tool not found: ${request.name}`);
      }
      
      // Execute tool
      const data = await handler(request.arguments);
      
      // Calculate execution time
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // Create result
      const result: ToolExecutionResult = {
        data,
        status: 'success',
        metadata: {
          executionTime
        }
      };
      
      // Emit execution end event
      this.eventBus.emit('toolManager:executionEnd', {
        request,
        result,
        startTime,
        endTime,
        executionTime
      });
      
      return result;
    } catch (error) {
      // Calculate execution time
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // Create error result
      const result: ToolExecutionResult = {
        data: null,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          executionTime,
          errorType: error instanceof Error ? error.name : 'Unknown',
          errorStack: error instanceof Error ? error.stack : undefined
        }
      };
      
      // Emit execution error event
      this.eventBus.emit('toolManager:executionError', {
        request,
        error,
        startTime,
        endTime,
        executionTime
      });
      
      return result;
    }
  }
}
```

### 5. Add Tool Call Routing to BCPs

Now, let's implement the routing of tool calls to the appropriate BCPs:

```typescript
/**
 * MCP client with tool routing capabilities
 */
export class RoutingMCPClient extends IntegratedMCPClient {
  /**
   * Execute a tool call with routing
   * @param toolCall - Tool call to execute
   * @param context - Execution context
   * @returns Tool execution result
   */
  public async executeToolCall(
    toolCall: ToolCall,
    context: Partial<ToolExecutionContext>
  ): Promise<ToolExecutionResult> {
    // Create full context
    const fullContext: ToolExecutionContext = {
      conversationId: context.conversationId || 'unknown',
      toolCallId: toolCall.id,
      timestamp: Date.now(),
      ...context
    };
    
    // Create execution request
    const request: ToolExecutionRequest = {
      name: toolCall.name,
      arguments: toolCall.arguments,
      context: fullContext
    };
    
    // Get tool manager
    const toolManager = this.toolManager as ContextAwareToolManager;
    
    // Execute tool with context
    return await toolManager.executeToolWithContext(request);
  }
  
  /**
   * Process tool calls from an assistant message
   * @param conversation - Conversation context
   * @param message - Assistant message with tool calls
   * @returns Processed tool calls with results
   */
  public async processToolCalls(
    conversation: Conversation,
    message: AssistantMessage
  ): Promise<Array<{
    toolCall: ToolCall;
    result: ToolExecutionResult;
  }>> {
    // Skip if no tool calls
    if (!message.tool_calls || message.tool_calls.length === 0) {
      return [];
    }
    
    // Set up execution context
    const context: Partial<ToolExecutionContext> = {
      conversationId: conversation.id,
      messageId: message.id
    };
    
    // Process each tool call
    const results = [];
    
    for (const toolCall of message.tool_calls) {
      try {
        // Execute tool call
        const result = await this.executeToolCall(toolCall, context);
        
        // Add result
        results.push({
          toolCall,
          result
        });
        
        // Create tool message
        const toolMessage: ToolMessage = {
          role: MessageRole.Tool,
          content: JSON.stringify(result.data),
          tool_call_id: toolCall.id
        };
        
        // Add to conversation
        conversation.messages.push(toolMessage);
      } catch (error) {
        // Create error result
        const errorResult: ToolExecutionResult = {
          data: null,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
          metadata: {
            executionTime: 0,
            errorType: error instanceof Error ? error.name : 'Unknown'
          }
        };
        
        // Add result
        results.push({
          toolCall,
          result: errorResult
        });
        
        // Create error message
        const errorMessage: ToolMessage = {
          role: MessageRole.Tool,
          content: JSON.stringify({
            error: error instanceof Error ? error.message : String(error)
          }),
          tool_call_id: toolCall.id
        };
        
        // Add to conversation
        conversation.messages.push(errorMessage);
      }
    }
    
    return results;
  }
}
```

### 6. Develop Result Formatting

Finally, let's implement standardized result formatting for tool outputs:

```typescript
/**
 * Result formatter for tool outputs
 */
export class ResultFormatter {
  /**
   * Format a tool execution result for display
   * @param result - Tool execution result
   * @param format - Output format
   * @returns Formatted result
   */
  public static format(
    result: ToolExecutionResult,
    format: 'json' | 'text' | 'markdown' = 'json'
  ): string {
    if (result.status === 'error') {
      return this.formatError(result, format);
    }
    
    switch (format) {
      case 'text':
        return this.formatAsText(result);
      
      case 'markdown':
        return this.formatAsMarkdown(result);
      
      case 'json':
      default:
        return this.formatAsJson(result);
    }
  }
  
  /**
   * Format an error result
   * @param result - Error result
   * @param format - Output format
   * @returns Formatted error
   */
  private static formatError(
    result: ToolExecutionResult,
    format: 'json' | 'text' | 'markdown'
  ): string {
    const errorMessage = result.error || 'Unknown error';
    
    switch (format) {
      case 'text':
        return `Error: ${errorMessage}`;
      
      case 'markdown':
        return `**Error**: ${errorMessage}`;
      
      case 'json':
      default:
        return JSON.stringify({
          error: errorMessage,
          metadata: result.metadata
        }, null, 2);
    }
  }
  
  /**
   * Format a result as JSON
   * @param result - Tool execution result
   * @returns JSON string
   */
  private static formatAsJson(result: ToolExecutionResult): string {
    return JSON.stringify(result.data, null, 2);
  }
  
  /**
   * Format a result as plain text
   * @param result - Tool execution result
   * @returns Plain text string
   */
  private static formatAsText(result: ToolExecutionResult): string {
    if (typeof result.data === 'string') {
      return result.data;
    }
    
    if (typeof result.data === 'number' || typeof result.data === 'boolean') {
      return String(result.data);
    }
    
    if (Array.isArray(result.data)) {
      return result.data.map(item => {
        if (typeof item === 'object') {
          return JSON.stringify(item);
        } else {
          return String(item);
        }
      }).join('\n');
    }
    
    if (typeof result.data === 'object' && result.data !== null) {
      // Format object properties
      return Object.entries(result.data)
        .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
        .join('\n');
    }
    
    return String(result.data);
  }
  
  /**
   * Format a result as markdown
   * @param result - Tool execution result
   * @returns Markdown string
   */
  private static formatAsMarkdown(result: ToolExecutionResult): string {
    if (typeof result.data === 'string') {
      return result.data;
    }
    
    if (typeof result.data === 'number' || typeof result.data === 'boolean') {
      return String(result.data);
    }
    
    if (Array.isArray(result.data)) {
      if (result.data.length === 0) {
        return '_No items_';
      }
      
      if (typeof result.data[0] === 'object') {
        // Table format for array of objects
        const keys = Object.keys(result.data[0]);
        
        // Create header
        let markdown = '| ' + keys.join(' | ') + ' |\n';
        markdown += '|' + keys.map(() => '---').join('|') + '|\n';
        
        // Create rows
        for (const item of result.data) {
          markdown += '| ';
          
          for (const key of keys) {
            const value = item[key];
            markdown += (typeof value === 'object' ? JSON.stringify(value) : value) + ' | ';
          }
          
          markdown += '\n';
        }
        
        return markdown;
      } else {
        // List format for array of primitives
        return result.data.map(item => `- ${item}`).join('\n');
      }
    }
    
    if (typeof result.data === 'object' && result.data !== null) {
      // Format object properties
      return Object.entries(result.data)
        .map(([key, value]) => `**${key}**: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
        .join('\n\n');
    }
    
    return String(result.data);
  }
}
```

## Integration with Plugin Core

Let's update the main plugin class to integrate all the MCP-BCP components:

```typescript
import { Plugin } from 'obsidian';
import { EventBus } from './core/EventBus';
import { SettingsManager } from './core/SettingsManager';
import { EnhancedVaultFacade } from './core/VaultFacade';
import { BCPRegistry } from './mcp/BCPRegistry';
import { ContextAwareToolManager } from './mcp/ContextAwareToolManager';
import { RoutingMCPClient } from './mcp/RoutingMCPClient';
import { ConversationManager } from './mcp/ConversationManager';
import { registerBuiltInBCPs, autoLoadBCPs } from './mcp/BCPManager';
import { BCPContext } from './mcp/BCPFactory';
import { MessageRole } from './mcp/interfaces';

export default class ChatsidianPlugin extends Plugin {
  public eventBus: EventBus;
  public settings: SettingsManager;
  public vaultFacade: EnhancedVaultFacade;
  public bcpRegistry: BCPRegistry;
  public toolManager: ContextAwareToolManager;
  public mcpClient: RoutingMCPClient;
  public conversationManager: ConversationManager;
  
  async onload() {
    console.log('Loading Chatsidian plugin');
    
    // Initialize event bus
    this.eventBus = new EventBus();
    
    // Initialize settings
    this.settings = new SettingsManager(this.app, this.eventBus);
    await this.settings.load();
    
    // Initialize enhanced vault facade
    this.vaultFacade = new EnhancedVaultFacade(this.app, this.eventBus);
    
    // Configure vault facade based on settings
    this.vaultFacade.configureCache({
      enabled: this.settings.getSettings().cacheEnabled,
      maxSize: this.settings.getSettings().cacheSize,
      ttl: this.settings.getSettings().cacheTTL
    });
    
    // Initialize BCP registry
    this.bcpRegistry = new BCPRegistry(
      this.app, 
      this.eventBus, 
      this.settings
    );
    
    // Initialize tool manager
    this.toolManager = new ContextAwareToolManager(this.eventBus, this.bcpRegistry);
    
    // Initialize conversation manager
    this.conversationManager = new ConversationManager(
      this.app,
      this.settings,
      this.eventBus
    );
    await this.conversationManager.initialize();
    
    // Create BCP context
    const bcpContext: BCPContext = {
      vaultFacade: this.vaultFacade,
      eventBus: this.eventBus,
      settings: this.settings
    };
    
    // Register built-in BCPs
    registerBuiltInBCPs(this.bcpRegistry, bcpContext);
    
    // Initialize BCP registry
    await this.bcpRegistry.initialize();
    
    // Auto-load configured BCPs
    await autoLoadBCPs(
      this.bcpRegistry,
      this.settings.getSettings().autoLoadBCPs || [
        'NoteManager',
        'FolderManager',
        'VaultLibrarian'
      ]
    );
    
    // Initialize MCP client with routing capabilities
    this.mcpClient = new RoutingMCPClient(
      this.settings,
      this.toolManager,
      this.eventBus
    );
    await this.mcpClient.initialize();
    
    // Register command to send a message
    this.addCommand({
      id: 'send-message',
      name: 'Send Message to AI',
      callback: async () => {
        // Get current conversation or create one
        let conversation = this.conversationManager.getCurrentConversation();
        
        if (!conversation) {
          conversation = await this.conversationManager.createConversation();
        }
        
        // Get user input
        const message = await this.getUserInput('Enter message');
        
        if (!message) {
          return;
        }
        
        // Send message
        await this.sendMessageWithUI(conversation.id, message);
      }
    });
    
    // Register command to list available tools
    this.addCommand({
      id: 'list-tools',
      name: 'List Available Tools',
      callback: async () => {
        // Get all tools
        const tools = this.toolManager.getTools();
        
        // Create modal
        const modal = new Modal(this.app);
        
        modal.contentEl.createEl('h2', {
          text: 'Available Tools'
        });
        
        const toolsList = modal.contentEl.createEl('ul');
        
        for (const tool of tools) {
          const item = toolsList.createEl('li');
          
          item.createEl('strong', {
            text: tool.name
          });
          
          item.createSpan({
            text: `: ${tool.description}`
          });
        }
        
        modal.open();
      }
    });
    
    // Register event handlers
    this.registerEvents();
    
    console.log('Chatsidian plugin loaded');
  }
  
  /**
   * Send a message to the AI with UI updates
   * @param conversationId - Conversation ID
   * @param content - Message content
   */
  public async sendMessageWithUI(conversationId: string, content: string): Promise<void> {
    try {
      // Get conversation
      const conversation = await this.conversationManager.loadConversation(conversationId);
      
      // Create user message
      const message = {
        role: MessageRole.User,
        content
      };
      
      // Add to conversation
      await this.conversationManager.addMessage(conversationId, message);
      
      // Create UI container
      const container = document.createElement('div');
      container.className = 'chatsidian-response-container';
      
      // Add to active view
      const view = this.app.workspace.getActiveViewOfType(this.app.workspace.constructor.View);
      
      if (view) {
        view.containerEl.appendChild(container);
      }
      
      // Get available tools for this conversation
      const tools = this.toolManager.getTools();
      
      // Send to AI with UI updates
      const response = await this.mcpClient.executeConversationTurn(
        conversation,
        message,
        container,
        {
          tools: this.mcpClient.getToolsForMCP()
        }
      );
      
      // Add response to conversation
      await this.conversationManager.addMessage(conversationId, response);
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Show error notification
      this.addErrorNotification(`Error sending message: ${error.message}`);
    }
  }
  
  /**
   * Get user input via modal
   * @param placeholder - Input placeholder
   * @returns User input or null if cancelled
   */
  private async getUserInput(placeholder: string): Promise<string | null> {
    return new Promise(resolve => {
      const modal = new Modal(this.app);
      
      modal.contentEl.createEl('textarea', {
        attr: {
          placeholder
        },
        cls: 'chatsidian-input'
      });
      
      const buttonContainer = modal.contentEl.createDiv({
        cls: 'chatsidian-button-container'
      });
      
      buttonContainer.createEl('button', {
        text: 'Cancel',
        cls: 'chatsidian-button-cancel'
      }).addEventListener('click', () => {
        modal.close();
        resolve(null);
      });
      
      buttonContainer.createEl('button', {
        text: 'Send',
        cls: 'chatsidian-button-send'
      }).addEventListener('click', () => {
        const input = modal.contentEl.querySelector('textarea').value;
        modal.close();
        resolve(input);
      });
      
      modal.open();
    });
  }
  
  /**
   * Add error notification
   * @param message - Error message
   */
  private addErrorNotification(message: string): void {
    new Notice(message, 5000);
  }
  
  private registerEvents() {
    // Log MCP events in debug mode
    if (this.settings.getSettings().debugMode) {
      this.eventBus.on('mcp:sendingMessage', data => {
        console.log(`Sending message to ${data.conversationId}`);
      });
      
      this.eventBus.on('mcp:receivedMessage', data => {
        console.log(`Received message from ${data.conversationId}`);
      });
      
      this.eventBus.on('toolManager:executionStart', data => {
        console.log(`Tool execution started: ${data.request.name}`, data.request.arguments);
      });
      
      this.eventBus.on('toolManager:executionEnd', data => {
        console.log(`Tool execution completed: ${data.request.name}`, data.result);
      });
      
      this.eventBus.on('toolManager:executionError', data => {
        console.error(`Tool execution error: ${data.request.name}:`, data.error);
      });
      
      this.eventBus.on('mcp:error', data => {
        console.error(`MCP error in ${data.conversationId}:`, data.error);
      });
    }
  }
  
  onunload() {
    // Clean up resources
    this.eventBus.clear();
  }
}
```

## Documentation References

- [[💻 Coding/Projects/Chatsidian/1_Architecture/Overview]]
- [[💻 Coding/Projects/Chatsidian/1_Architecture/Components/MCPConnector]]
- [[💻 Coding/Projects/Chatsidian/1_Architecture/Components/BCPArchitecture]]
- [[💻 Coding/Projects/Chatsidian/3_Implementation/Phase2.3-Tool-Manager-Implementation]]
- [[💻 Coding/Projects/Chatsidian/3_Implementation/Phase2.6-MCP-Client-Core]]
- [[💻 Coding/Projects/Chatsidian/3_Implementation/Phase2.7-Advanced-MCP-Features]]
- [[💻 Coding/Projects/Chatsidian/4_Documentation/MCPPromptDesign]]

## Testing Strategy

### Unit Tests

- Test tool discovery functionality
- Test dynamic tool registration
- Test tool schema conversion for different providers
- Test context passing between components
- Test tool execution with routing
- Test result formatting for different output types

```typescript
// Example test for tool discovery
describe('EnhancedToolManager', () => {
  let toolManager: EnhancedToolManager;
  let mockEventBus: MockEventBus;
  let mockBCPRegistry: MockBCPRegistry;
  
  beforeEach(() => {
    mockEventBus = new MockEventBus();
    mockBCPRegistry = new MockBCPRegistry();
    
    toolManager = new EnhancedToolManager(
      mockEventBus as any,
      mockBCPRegistry as any
    );
  });
  
  test('should discover tools from a BCP', async () => {
    // Mock BCP
    const mockPack = {
      domain: 'TestDomain',
      description: 'Test BCP',
      tools: [
        {
          name: 'testTool',
          description: 'Test tool',
          handler: jest.fn(),
          schema: { type: 'object', properties: {} }
        },
        {
          name: 'anotherTool',
          description: 'Another test tool',
          handler: jest.fn(),
          schema: { type: 'object', properties: {} }
        }
      ]
    };
    
    // Mock getPack method
    mockBCPRegistry.getPack.mockReturnValue(mockPack);
    
    // Discover tools
    toolManager.discoverToolsFromPack('TestDomain');
    
    // Get tools
    const tools = toolManager.getTools();
    
    // Verify tools were discovered
    expect(tools.length).toBe(2);
    expect(tools[0].name).toBe('TestDomain.testTool');
    expect(tools[1].name).toBe('TestDomain.anotherTool');
    
    // Verify event was emitted
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'toolManager:toolRegistered',
      expect.objectContaining({
        domain: 'TestDomain',
        name: 'testTool',
        fullName: 'TestDomain.testTool'
      })
    );
    
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'toolManager:toolRegistered',
      expect.objectContaining({
        domain: 'TestDomain',
        name: 'anotherTool',
        fullName: 'TestDomain.anotherTool'
      })
    );
  });
  
  test('should remove tools when BCP is unloaded', async () => {
    // Mock BCP
    const mockPack = {
      domain: 'TestDomain',
      description: 'Test BCP',
      tools: [
        {
          name: 'testTool',
          description: 'Test tool',
          handler: jest.fn(),
          schema: { type: 'object', properties: {} }
        }
      ]
    };
    
    // Mock getPack method
    mockBCPRegistry.getPack.mockReturnValue(mockPack);
    
    // Discover tools
    toolManager.discoverToolsFromPack('TestDomain');
    
    // Verify tool was discovered
    expect(toolManager.getTools().length).toBe(1);
    
    // Remove tools
    toolManager.removeToolsFromPack('TestDomain');
    
    // Verify tool was removed
    expect(toolManager.getTools().length).toBe(0);
    
    // Verify event was emitted
    expect(mockEventBus.emit).toHaveBeenCalledWith(
      'toolManager:toolRemoved',
      expect.objectContaining({
        fullName: 'TestDomain.testTool'
      })
    );
  });
});
```

### Integration Tests

- Test full MCP-BCP integration flow
- Test tool discovery and registration during plugin initialization
- Test tool execution in a real conversation
- Test error handling and recovery with real tools

## Next Steps

Phase 2.10 will focus on comprehensive testing and performance optimization of the integrated system. The MCP-BCP integration implemented in this phase provides a solid foundation for the agent system to be developed in future phases.
