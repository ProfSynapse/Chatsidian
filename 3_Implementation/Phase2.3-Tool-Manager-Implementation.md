---
title: Phase 2.3 - Tool Manager Implementation
description: Implementation plan for the Tool Manager component in Chatsidian
date: 2025-05-03
status: implementation
tags:
  - implementation
  - phase-2
  - tool-manager
  - execution
  - validation
---

# Phase 2.3: Tool Manager Implementation

## Overview

This micro-phase focuses on implementing the Tool Manager component, which serves as the central hub for tool registration, validation, and execution in Chatsidian. The Tool Manager works closely with the BCP Registry to manage tools provided by Bounded Context Packs and handles the execution of these tools when called by the MCP Client.

## Goals

- Implement the Tool Manager component
- Create a robust tool registration and discovery system
- Build a parameter validation mechanism using JSON Schema
- Develop a secure tool execution pipeline
- Implement comprehensive error handling for tool operations

## Implementation Steps

### 1. Define Tool Manager Interfaces

First, we'll define the core interfaces for the Tool Manager:

```typescript
/**
 * Result of tool parameter validation
 */
export interface ValidationResult {
  /**
   * Whether the parameters are valid
   */
  valid: boolean;
  
  /**
   * Array of error messages (if invalid)
   */
  errors?: string[];
}

/**
 * Interface for the Tool Manager
 */
export interface IToolManager {
  /**
   * Register a tool
   * @param domain - Domain of the tool
   * @param name - Name of the tool (without domain prefix)
   * @param description - Human-readable description
   * @param handler - Function to execute when the tool is called
   * @param schema - JSON Schema for tool parameters
   * @param context - Optional context to pass to the handler
   */
  registerTool(
    domain: string,
    name: string,
    description: string,
    handler: (params: any, context?: any) => Promise<any>,
    schema: any,
    context?: any
  ): void;
  
  /**
   * Unregister a tool
   * @param domain - Domain of the tool
   * @param name - Name of the tool (without domain prefix)
   */
  unregisterTool(domain: string, name: string): void;
  
  /**
   * Get all registered tools
   * @returns Array of registered tools
   */
  getTools(): Tool[];
  
  /**
   * Get tools formatted for MCP
   * @returns Array of tools formatted for MCP
   */
  getToolsForMCP(): any[];
  
  /**
   * Execute a tool call
   * @param toolCall - Tool call to execute
   * @returns Promise resolving to the tool result
   */
  executeToolCall(toolCall: ToolCall): Promise<any>;
  
  /**
   * Validate tool parameters
   * @param domain - Domain of the tool
   * @param name - Name of the tool
   * @param params - Parameters to validate
   * @returns Validation result
   */
  validateParameters(domain: string, name: string, params: any): ValidationResult;
}

/**
 * Tool call from MCP
 */
export interface ToolCall {
  /**
   * Unique identifier for the tool call
   */
  id: string;
  
  /**
   * Fully qualified name of the tool (domain.name)
   */
  name: string;
  
  /**
   * Arguments to pass to the tool
   */
  arguments: any;
  
  /**
   * Current status of the tool call
   */
  status?: 'pending' | 'success' | 'error';
}
```


### 2. Implement Tool Manager Class

Next, we'll implement the Tool Manager class that handles tool registration, parameter validation, and execution:

```typescript
import { EventBus } from '../core/EventBus';
import { BCPRegistry } from './BCPRegistry';
import { Tool } from './interfaces';
import { IToolManager, ValidationResult, ToolCall } from './ToolManagerInterface';
import Ajv from 'ajv';

/**
 * ToolManager handles tool registration, validation, and execution
 */
export class ToolManager implements IToolManager {
  private tools: Map<string, Tool> = new Map();
  private contexts: Map<string, any> = new Map();
  private eventBus: EventBus;
  private bcpRegistry: BCPRegistry;
  private validator: Ajv;
  
  /**
   * Create a new ToolManager
   * @param eventBus - Event bus for communication
   * @param bcpRegistry - BCP registry
   */
  constructor(eventBus: EventBus, bcpRegistry: BCPRegistry) {
    this.eventBus = eventBus;
    this.bcpRegistry = bcpRegistry;
    
    // Initialize JSON schema validator
    this.validator = new Ajv({
      allErrors: true,
      coerceTypes: true,
      useDefaults: true,
      strict: false
    });
    
    // Listen for BCP events
    this.registerBCPEvents();
  }
  
  /**
   * Register BCP events
   */
  private registerBCPEvents(): void {
    // Handle pack loaded
    this.eventBus.on('bcpRegistry:packLoaded', (data: any) => {
      const { domain, tools, context } = data;
      
      // Register tools from the pack
      for (const tool of tools) {
        this.registerTool(
          domain,
          tool.name,
          tool.description,
          tool.handler,
          tool.schema,
          context
        );
      }
    });
    
    // Handle pack unloaded
    this.eventBus.on('bcpRegistry:packUnloaded', (data: any) => {
      const { domain } = data;
      
      // Find tools with this domain
      const toolsToUnregister: string[] = [];
      
      for (const fullName of this.tools.keys()) {
        if (fullName.startsWith(`${domain}.`)) {
          toolsToUnregister.push(fullName);
        }
      }
      
      // Unregister tools
      for (const fullName of toolsToUnregister) {
        const [domain, name] = fullName.split('.');
        this.unregisterTool(domain, name);
      }
    });
  }
  
  /**
   * Register a tool
   */
  public registerTool(
    domain: string,
    name: string,
    description: string,
    handler: (params: any, context?: any) => Promise<any>,
    schema: any,
    context?: any
  ): void {
    // Create full name
    const fullName = `${domain}.${name}`;
    
    // Check if tool already exists
    if (this.tools.has(fullName)) {
      console.warn(`Tool ${fullName} is already registered. Overwriting.`);
    }
    
    // Register tool
    this.tools.set(fullName, {
      name,
      description,
      handler,
      schema
    });
    
    // Store context if provided
    if (context) {
      this.contexts.set(fullName, context);
    }
    
    // Validate schema
    if (schema) {
      try {
        this.validator.compile(schema);
      } catch (error) {
        console.warn(`Invalid schema for tool ${fullName}:`, error);
      }
    }
    
    // Emit event
    this.eventBus.emit('toolManager:toolRegistered', {
      domain,
      name,
      fullName,
      description
    });
  }
  
  /**
   * Unregister a tool
   */
  public unregisterTool(domain: string, name: string): void {
    // Create full name
    const fullName = `${domain}.${name}`;
    
    // Check if tool exists
    if (!this.tools.has(fullName)) {
      return;
    }
    
    // Unregister tool
    this.tools.delete(fullName);
    
    // Remove context
    this.contexts.delete(fullName);
    
    // Emit event
    this.eventBus.emit('toolManager:toolUnregistered', {
      domain,
      name,
      fullName
    });
  }
  
  /**
   * Get all registered tools
   */
  public getTools(): Tool[] {
    return Array.from(this.tools.entries()).map(([fullName, tool]) => ({
      ...tool,
      name: fullName
    }));
  }
  
  /**
   * Get tools formatted for MCP
   */
  public getToolsForMCP(): any[] {
    return this.getTools().map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.schema
    }));
  }
  
  /**
   * Execute a tool call
   */
  public async executeToolCall(toolCall: ToolCall): Promise<any> {
    const { id, name, arguments: args } = toolCall;
    
    try {
      // Update status
      toolCall.status = 'pending';
      
      // Emit executing event
      this.eventBus.emit('toolManager:executing', {
        id,
        name,
        arguments: args
      });
      
      // Find tool
      const tool = this.tools.get(name);
      
      if (!tool) {
        throw new Error(`Tool ${name} not found`);
      }
      
      // Validate parameters
      const [domain, toolName] = name.split('.');
      const validation = this.validateParameters(domain, toolName, args);
      
      if (!validation.valid) {
        throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
      }
      
      // Get context for this tool
      const context = this.contexts.get(name);
      
      // Execute handler
      const result = await tool.handler(args, context);
      
      // Update status
      toolCall.status = 'success';
      
      // Emit executed event
      this.eventBus.emit('toolManager:executed', {
        id,
        name,
        arguments: args,
        result
      });
      
      return result;
    } catch (error) {
      // Update status
      toolCall.status = 'error';
      
      // Emit error event
      this.eventBus.emit('toolManager:executionError', {
        id,
        name,
        arguments: args,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Re-throw error
      throw error;
    }
  }
  
  /**
   * Validate tool parameters
   */
  public validateParameters(domain: string, name: string, params: any): ValidationResult {
    // Create full name
    const fullName = `${domain}.${name}`;
    
    // Find tool
    const tool = this.tools.get(fullName);
    
    if (!tool) {
      return {
        valid: false,
        errors: [`Tool ${fullName} not found`]
      };
    }
    
    // Skip validation if no schema
    if (!tool.schema) {
      return { valid: true };
    }
    
    // Get or compile validate function
    let validate = this.validator.getSchema(fullName);
    
    if (!validate) {
      try {
        validate = this.validator.compile(tool.schema);
        
        // Cache the compiled schema
        this.validator.addSchema(tool.schema, fullName);
      } catch (error) {
        return {
          valid: false,
          errors: [`Invalid schema: ${error instanceof Error ? error.message : String(error)}`]
        };
      }
    }
    
    // Validate parameters
    const valid = validate(params);
    
    if (!valid) {
      const errors = validate.errors.map(err => 
        `${err.instancePath} ${err.message}`
      );
      
      return {
        valid: false,
        errors
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Get a tool by name
   * @param name - Fully qualified tool name
   * @returns Tool or undefined
   */
  public getTool(name: string): Tool | undefined {
    const tool = this.tools.get(name);
    
    if (!tool) {
      return undefined;
    }
    
    return {
      ...tool,
      name
    };
  }
  
  /**
   * Check if a tool exists
   * @param name - Fully qualified tool name
   * @returns Whether the tool exists
   */
  public hasTool(name: string): boolean {
    return this.tools.has(name);
  }
  
  /**
   * Get tool count
   * @returns Number of registered tools
   */
  public getToolCount(): number {
    return this.tools.size;
  }
}
```


### 3. Implement Tool Execution Pipeline

To provide a structured and extensible approach to tool execution, we'll implement a pipeline pattern:

```typescript
/**
 * Context for tool execution
 */
export interface ExecutionContext {
  /**
   * Tool call being executed
   */
  toolCall: ToolCall;
  
  /**
   * Tool to execute
   */
  tool: Tool;
  
  /**
   * Tool context
   */
  toolContext?: any;
  
  /**
   * Event bus for communication
   */
  eventBus: EventBus;
  
  /**
   * Result of execution (set by execution phase)
   */
  result?: any;
  
  /**
   * Error that occurred (if any)
   */
  error?: Error;
  
  /**
   * Whether to skip remaining phases
   */
  skipRemaining?: boolean;
}

/**
 * Represents a phase in the tool execution pipeline
 */
export interface PipelinePhase {
  /**
   * Name of the phase
   */
  name: string;
  
  /**
   * Execute the phase
   * @param context - Execution context
   * @returns Promise resolving when the phase is complete
   */
  execute(context: ExecutionContext): Promise<void>;
}

/**
 * Tool execution pipeline
 */
export class ToolExecutionPipeline {
  private phases: PipelinePhase[] = [];
  
  /**
   * Add a phase to the pipeline
   * @param phase - Phase to add
   */
  public addPhase(phase: PipelinePhase): void {
    this.phases.push(phase);
  }
  
  /**
   * Execute the pipeline
   * @param context - Execution context
   * @returns Promise resolving to the result
   */
  public async execute(context: ExecutionContext): Promise<any> {
    try {
      // Execute each phase
      for (const phase of this.phases) {
        // Skip if marked
        if (context.skipRemaining) {
          break;
        }
        
        // Execute phase
        await phase.execute(context);
      }
      
      // Return result
      return context.result;
    } catch (error) {
      // Set error in context
      context.error = error instanceof Error ? error : new Error(String(error));
      
      // Set status to error
      context.toolCall.status = 'error';
      
      // Emit error event
      context.eventBus.emit('toolManager:executionError', {
        id: context.toolCall.id,
        name: context.toolCall.name,
        arguments: context.toolCall.arguments,
        error: context.error.message
      });
      
      // Re-throw error
      throw error;
    }
  }
}
```

### 4. Implement Standard Pipeline Phases

Now, let's define standard phases for the execution pipeline:

```typescript
/**
 * Standard pipeline phases
 */
export const standardPipelines = {
  /**
   * Validation phase
   */
  validation: {
    name: 'validation',
    async execute(context: ExecutionContext): Promise<void> {
      const { toolCall, tool, eventBus } = context;
      
      // Skip if no schema
      if (!tool.schema) {
        return;
      }
      
      // Emit validation event
      eventBus.emit('toolManager:validating', {
        id: toolCall.id,
        name: toolCall.name,
        arguments: toolCall.arguments
      });
      
      // Create validator
      const ajv = new Ajv({
        allErrors: true,
        coerceTypes: true,
        useDefaults: true,
        strict: false
      });
      
      // Compile schema
      const validate = ajv.compile(tool.schema);
      
      // Validate parameters
      const valid = validate(toolCall.arguments);
      
      if (!valid) {
        const errors = validate.errors.map(err => 
          `${err.instancePath} ${err.message}`
        );
        
        throw new Error(`Invalid parameters: ${errors.join(', ')}`);
      }
    }
  },
  
  /**
   * Authorization phase
   */
  authorization: {
    name: 'authorization',
    async execute(context: ExecutionContext): Promise<void> {
      const { toolCall, eventBus } = context;
      
      // Emit authorization event
      eventBus.emit('toolManager:authorizing', {
        id: toolCall.id,
        name: toolCall.name,
        arguments: toolCall.arguments
      });
      
      // Authorization logic would go here
      // For example, check if the tool has permissions to execute
      
      // For now, we'll just pass through
    }
  },
  
  /**
   * Execution phase
   */
  execution: {
    name: 'execution',
    async execute(context: ExecutionContext): Promise<void> {
      const { toolCall, tool, toolContext, eventBus } = context;
      
      // Emit execution event
      eventBus.emit('toolManager:executing', {
        id: toolCall.id,
        name: toolCall.name,
        arguments: toolCall.arguments
      });
      
      // Execute tool
      const result = await tool.handler(toolCall.arguments, toolContext);
      
      // Set result in context
      context.result = result;
      
      // Update tool call status
      toolCall.status = 'success';
      
      // Emit success event
      eventBus.emit('toolManager:executed', {
        id: toolCall.id,
        name: toolCall.name,
        arguments: toolCall.arguments,
        result
      });
    }
  },
  
  /**
   * Logging phase
   */
  logging: {
    name: 'logging',
    async execute(context: ExecutionContext): Promise<void> {
      const { toolCall, result } = context;
      
      // Log tool execution
      console.log(`Tool executed: ${toolCall.name}`, {
        id: toolCall.id,
        arguments: toolCall.arguments,
        result
      });
    }
  }
};

/**
 * Create a standard execution pipeline
 * @returns Pipeline with standard phases
 */
export function createStandardPipeline(): ToolExecutionPipeline {
  const pipeline = new ToolExecutionPipeline();
  
  // Add standard phases
  pipeline.addPhase(standardPipelines.validation);
  pipeline.addPhase(standardPipelines.authorization);
  pipeline.addPhase(standardPipelines.execution);
  pipeline.addPhase(standardPipelines.logging);
  
  return pipeline;
}
```


### 5. Implement Enhanced Tool Manager with Pipeline

Now, let's enhance the Tool Manager to use the execution pipeline:

```typescript
/**
 * Enhanced Tool Manager with execution pipeline
 */
export class EnhancedToolManager extends ToolManager {
  private pipeline: ToolExecutionPipeline;
  
  /**
   * Create a new EnhancedToolManager
   * @param eventBus - Event bus for communication
   * @param bcpRegistry - BCP registry
   */
  constructor(eventBus: EventBus, bcpRegistry: BCPRegistry) {
    super(eventBus, bcpRegistry);
    
    // Create standard pipeline
    this.pipeline = createStandardPipeline();
  }
  
  /**
   * Execute a tool call using the pipeline
   * @param toolCall - Tool call to execute
   * @returns Promise resolving to the result
   */
  public async executeToolCall(toolCall: ToolCall): Promise<any> {
    // Find tool
    const tool = this.getTool(toolCall.name);
    
    if (!tool) {
      throw new Error(`Tool ${toolCall.name} not found`);
    }
    
    // Get context for this tool
    const toolContext = this.getToolContext(toolCall.name);
    
    // Create execution context
    const context: ExecutionContext = {
      toolCall,
      tool,
      toolContext,
      eventBus: this.getEventBus()
    };
    
    // Execute pipeline
    return this.pipeline.execute(context);
  }
  
  /**
   * Add a custom phase to the pipeline
   * @param phase - Phase to add
   */
  public addPipelinePhase(phase: PipelinePhase): void {
    this.pipeline.addPhase(phase);
  }
  
  /**
   * Set a custom pipeline
   * @param pipeline - Pipeline to set
   */
  public setPipeline(pipeline: ToolExecutionPipeline): void {
    this.pipeline = pipeline;
  }
  
  /**
   * Get the current pipeline
   * @returns The current pipeline
   */
  public getPipeline(): ToolExecutionPipeline {
    return this.pipeline;
  }
  
  /**
   * Get tool context
   * @param name - Fully qualified tool name
   * @returns Tool context or undefined
   */
  private getToolContext(name: string): any {
    return this.contexts.get(name);
  }
  
  /**
   * Get event bus
   * @returns Event bus
   */
  private getEventBus(): EventBus {
    return this.eventBus;
  }
}
```

### 6. Create Schema Builder Utility

To help with creating JSON Schema definitions for tools:

```typescript
/**
 * Utility for building JSON Schema definitions
 */
export class SchemaBuilder {
  private schema: any = {
    type: 'object',
    properties: {},
    required: []
  };
  
  /**
   * Add a string property
   * @param name - Property name
   * @param description - Property description
   * @param required - Whether the property is required
   * @param options - Additional options
   * @returns The builder instance for chaining
   */
  public addString(
    name: string, 
    description: string, 
    required: boolean = false,
    options: {
      minLength?: number;
      maxLength?: number;
      pattern?: string;
      enum?: string[];
      format?: string;
    } = {}
  ): SchemaBuilder {
    // Add property
    this.schema.properties[name] = {
      type: 'string',
      description
    };
    
    // Add options
    if (options.minLength !== undefined) {
      this.schema.properties[name].minLength = options.minLength;
    }
    
    if (options.maxLength !== undefined) {
      this.schema.properties[name].maxLength = options.maxLength;
    }
    
    if (options.pattern !== undefined) {
      this.schema.properties[name].pattern = options.pattern;
    }
    
    if (options.enum !== undefined) {
      this.schema.properties[name].enum = options.enum;
    }
    
    if (options.format !== undefined) {
      this.schema.properties[name].format = options.format;
    }
    
    // Add to required if needed
    if (required) {
      this.schema.required.push(name);
    }
    
    return this;
  }
  
  /**
   * Add a number property
   * @param name - Property name
   * @param description - Property description
   * @param required - Whether the property is required
   * @param options - Additional options
   * @returns The builder instance for chaining
   */
  public addNumber(
    name: string, 
    description: string, 
    required: boolean = false,
    options: {
      minimum?: number;
      maximum?: number;
      multipleOf?: number;
      exclusiveMinimum?: number;
      exclusiveMaximum?: number;
    } = {}
  ): SchemaBuilder {
    // Add property
    this.schema.properties[name] = {
      type: 'number',
      description
    };
    
    // Add options
    if (options.minimum !== undefined) {
      this.schema.properties[name].minimum = options.minimum;
    }
    
    if (options.maximum !== undefined) {
      this.schema.properties[name].maximum = options.maximum;
    }
    
    if (options.multipleOf !== undefined) {
      this.schema.properties[name].multipleOf = options.multipleOf;
    }
    
    if (options.exclusiveMinimum !== undefined) {
      this.schema.properties[name].exclusiveMinimum = options.exclusiveMinimum;
    }
    
    if (options.exclusiveMaximum !== undefined) {
      this.schema.properties[name].exclusiveMaximum = options.exclusiveMaximum;
    }
    
    // Add to required if needed
    if (required) {
      this.schema.required.push(name);
    }
    
    return this;
  }
  
  /**
   * Add a boolean property
   * @param name - Property name
   * @param description - Property description
   * @param required - Whether the property is required
   * @returns The builder instance for chaining
   */
  public addBoolean(
    name: string, 
    description: string, 
    required: boolean = false
  ): SchemaBuilder {
    // Add property
    this.schema.properties[name] = {
      type: 'boolean',
      description
    };
    
    // Add to required if needed
    if (required) {
      this.schema.required.push(name);
    }
    
    return this;
  }
  
  /**
   * Add an array property
   * @param name - Property name
   * @param description - Property description
   * @param itemType - Type of items in the array
   * @param required - Whether the property is required
   * @param options - Additional options
   * @returns The builder instance for chaining
   */
  public addArray(
    name: string, 
    description: string, 
    itemType: any,
    required: boolean = false,
    options: {
      minItems?: number;
      maxItems?: number;
      uniqueItems?: boolean;
    } = {}
  ): SchemaBuilder {
    // Add property
    this.schema.properties[name] = {
      type: 'array',
      description,
      items: itemType
    };
    
    // Add options
    if (options.minItems !== undefined) {
      this.schema.properties[name].minItems = options.minItems;
    }
    
    if (options.maxItems !== undefined) {
      this.schema.properties[name].maxItems = options.maxItems;
    }
    
    if (options.uniqueItems !== undefined) {
      this.schema.properties[name].uniqueItems = options.uniqueItems;
    }
    
    // Add to required if needed
    if (required) {
      this.schema.required.push(name);
    }
    
    return this;
  }
  
  /**
   * Add an object property
   * @param name - Property name
   * @param description - Property description
   * @param properties - Object properties
   * @param required - Whether the property is required
   * @returns The builder instance for chaining
   */
  public addObject(
    name: string, 
    description: string, 
    properties: any,
    required: boolean = false
  ): SchemaBuilder {
    // Add property
    this.schema.properties[name] = {
      type: 'object',
      description,
      properties
    };
    
    // Add to required if needed
    if (required) {
      this.schema.required.push(name);
    }
    
    return this;
  }
  
  /**
   * Build the schema
   * @returns The complete JSON Schema
   */
  public build(): any {
    // If no required properties, remove the required array
    if (this.schema.required.length === 0) {
      delete this.schema.required;
    }
    
    return this.schema;
  }
  
  /**
   * Reset the builder
   * @returns The builder instance for chaining
   */
  public reset(): SchemaBuilder {
    this.schema = {
      type: 'object',
      properties: {},
      required: []
    };
    
    return this;
  }
}
```


### 7. Update Plugin Core for Tool Manager

Modify the main plugin class to integrate the Tool Manager:

```typescript
import { Plugin } from 'obsidian';
import { EventBus } from './core/EventBus';
import { SettingsManager } from './core/SettingsManager';
import { VaultFacade } from './core/VaultFacade';
import { BCPRegistry } from './mcp/BCPRegistry';
import { EnhancedToolManager } from './mcp/ToolManager';

export default class ChatsidianPlugin extends Plugin {
  public eventBus: EventBus;
  public settings: SettingsManager;
  public vaultFacade: VaultFacade;
  public bcpRegistry: BCPRegistry;
  public toolManager: EnhancedToolManager;
  
  async onload() {
    console.log('Loading Chatsidian plugin');
    
    // Initialize event bus
    this.eventBus = new EventBus();
    
    // Initialize settings
    this.settings = new SettingsManager(this.app, this.eventBus);
    await this.settings.load();
    
    // Initialize vault facade
    this.vaultFacade = new VaultFacade(this.app, this.eventBus);
    
    // Initialize BCP registry
    this.bcpRegistry = new BCPRegistry(
      this.app, 
      this.eventBus, 
      this.settings,
      this.vaultFacade
    );
    
    // Initialize tool manager
    this.toolManager = new EnhancedToolManager(
      this.eventBus,
      this.bcpRegistry
    );
    
    // Add custom pipeline phase for event logging
    if (this.settings.getSettings().verboseLogging) {
      this.toolManager.addPipelinePhase({
        name: 'eventLogging',
        async execute(context: ExecutionContext): Promise<void> {
          const { toolCall, result } = context;
          
          console.log(`[EVENT LOG] Tool executed: ${toolCall.name}`, {
            id: toolCall.id,
            arguments: toolCall.arguments,
            result
          });
        }
      });
    }
    
    // Initialize BCP registry (after tool manager setup)
    await this.bcpRegistry.initialize();
    
    // Register event handlers
    this.registerEvents();
    
    console.log('Chatsidian plugin loaded');
  }
  
  private registerEvents() {
    // Log tool events in debug mode
    if (this.settings.getSettings().debugMode) {
      this.eventBus.on('toolManager:toolRegistered', data => {
        console.log(`Tool registered: ${data.fullName}`);
      });
      
      this.eventBus.on('toolManager:executing', data => {
        console.log(`Tool executing: ${data.name}`, data.arguments);
      });
      
      this.eventBus.on('toolManager:executed', data => {
        console.log(`Tool executed: ${data.name}`, data.result);
      });
      
      this.eventBus.on('toolManager:executionError', data => {
        console.error(`Tool execution error: ${data.name}`, data.error);
      });
    }
  }
  
  onunload() {
    // Clean up resources
    this.eventBus.clear();
  }
}
```

### 8. Example Tool Registration and Execution

Here's an example of how to use the Tool Manager to register and execute tools:

```typescript
/**
 * Example of tool registration and execution
 */
export function demonstrateToolManager(plugin: ChatsidianPlugin) {
  const { toolManager, eventBus, vaultFacade } = plugin;
  
  // Create schema for a "greet" tool
  const greetSchema = new SchemaBuilder()
    .addString('name', 'Name to greet', true)
    .addString('language', 'Language for greeting', false, {
      enum: ['en', 'es', 'fr', 'de', 'ja']
    })
    .build();
  
  // Register a tool
  toolManager.registerTool(
    'Example',
    'greet',
    'Greet a person in different languages',
    async (params: { name: string; language?: string }) => {
      const { name, language = 'en' } = params;
      
      // Define greetings for different languages
      const greetings: Record<string, string> = {
        en: 'Hello',
        es: 'Hola',
        fr: 'Bonjour',
        de: 'Hallo',
        ja: 'こんにちは'
      };
      
      // Get greeting for the specified language
      const greeting = greetings[language] || greetings.en;
      
      return {
        message: `${greeting}, ${name}!`,
        language
      };
    },
    greetSchema
  );
  
  // Example of executing a tool
  async function executeGreetTool() {
    try {
      // Create tool call
      const toolCall: ToolCall = {
        id: 'example-1',
        name: 'Example.greet',
        arguments: {
          name: 'World',
          language: 'ja'
        }
      };
      
      // Execute tool call
      const result = await toolManager.executeToolCall(toolCall);
      
      console.log('Tool result:', result);
      // Expected output: { message: 'こんにちは, World!', language: 'ja' }
    } catch (error) {
      console.error('Error executing tool:', error);
    }
  }
  
  // Execute the tool
  executeGreetTool();
}
```

## Documentation References

- [[💻 Coding/Projects/Chatsidian/1_Architecture/Overview]]
- [[💻 Coding/Projects/Chatsidian/1_Architecture/Components/VaultFacade]]
- [[💻 Coding/Projects/Chatsidian/4_Documentation/APIs]]
- [[💻 Coding/Projects/Chatsidian/4_Documentation/MCPStreamingImplementation]]
- [[💻 Coding/Projects/Chatsidian/3_Implementation/Phase2.1-VaultFacade-Foundation]]
- [[💻 Coding/Projects/Chatsidian/3_Implementation/Phase2.2-BCP-Registry-Infrastructure]]

## Testing Strategy

### Unit Tests

- Test tool registration and unregistration
- Test parameter validation with various schemas
- Test tool execution with success and failure cases
- Test pipeline execution

```typescript
// Example unit test for tool parameter validation
describe('ToolManager - Parameter Validation', () => {
  let toolManager: ToolManager;
  let eventBus: EventBus;
  let bcpRegistry: BCPRegistry;
  
  beforeEach(() => {
    eventBus = new EventBus();
    bcpRegistry = mock<BCPRegistry>();
    toolManager = new ToolManager(eventBus, bcpRegistry);
    
    // Register a test tool
    toolManager.registerTool(
      'Test',
      'validateMe',
      'Test validation',
      async () => ({}),
      {
        type: 'object',
        required: ['requiredParam'],
        properties: {
          requiredParam: {
            type: 'string'
          },
          numberParam: {
            type: 'number',
            minimum: 1,
            maximum: 10
          },
          enumParam: {
            type: 'string',
            enum: ['a', 'b', 'c']
          }
        }
      }
    );
  });
  
  test('should validate valid parameters', () => {
    const result = toolManager.validateParameters('Test', 'validateMe', {
      requiredParam: 'value',
      numberParam: 5,
      enumParam: 'a'
    });
    
    expect(result.valid).toBe(true);
  });
  
  test('should reject missing required parameters', () => {
    const result = toolManager.validateParameters('Test', 'validateMe', {
      numberParam: 5
    });
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(expect.stringContaining('requiredParam'));
  });
  
  test('should reject invalid number parameters', () => {
    const result = toolManager.validateParameters('Test', 'validateMe', {
      requiredParam: 'value',
      numberParam: 20
    });
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(expect.stringContaining('maximum'));
  });
  
  test('should reject invalid enum parameters', () => {
    const result = toolManager.validateParameters('Test', 'validateMe', {
      requiredParam: 'value',
      enumParam: 'd'
    });
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(expect.stringContaining('enum'));
  });
});
```

### Integration Tests

- Test integration between BCP Registry and Tool Manager
- Test tool execution with real VaultFacade operations
- Test pipeline with custom phases

## Next Steps

Phase 2.4 will focus on implementing advanced features for the VaultFacade, building on the framework established in this phase.
