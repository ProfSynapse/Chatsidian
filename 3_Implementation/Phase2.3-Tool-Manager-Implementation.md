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
  
  /**
   * Transformed parameters (after validation/coercion)
   */
  params?: any;
}

/**
 * Tool call status
 */
export type ToolCallStatus = 'pending' | 'running' | 'success' | 'error' | 'cancelled';

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
  status?: ToolCallStatus;
  
  /**
   * Creation timestamp
   */
  createdAt?: number;
  
  /**
   * Execution start timestamp
   */
  startedAt?: number;
  
  /**
   * Execution completion timestamp
   */
  completedAt?: number;
  
  /**
   * Error message if status is 'error'
   */
  error?: string;
  
  /**
   * Result of execution if status is 'success'
   */
  result?: any;
}

/**
 * Tool execution options
 */
export interface ToolExecutionOptions {
  /**
   * Timeout for tool execution in milliseconds
   */
  timeout?: number;
  
  /**
   * Whether to run in silent mode (no UI notifications)
   */
  silent?: boolean;
  
  /**
   * Custom context for the tool execution
   */
  context?: any;
  
  /**
   * Debug mode for additional logging
   */
  debug?: boolean;
}

/**
 * Interface for the Tool Manager Component
 * Extends Obsidian's Component pattern for lifecycle management
 */
export interface IToolManager {
  /**
   * Register a tool
   * @param domain - Domain of the tool
   * @param name - Name of the tool (without domain prefix)
   * @param description - Human-readable description
   * @param handler - Function to execute when the tool is called
   * @param schema - JSON Schema for tool parameters
   * @param options - Additional options (icon, display preferences, etc.)
   */
  registerTool(
    domain: string,
    name: string,
    description: string,
    handler: (params: any, context?: any) => Promise<any>,
    schema: any,
    options?: {
      icon?: string;
      display?: {
        showInSuggestions?: boolean;
        sortOrder?: number;
      };
      context?: any;
    }
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
   * @param options - Execution options
   * @returns Promise resolving to the tool result
   */
  executeToolCall(toolCall: ToolCall, options?: ToolExecutionOptions): Promise<any>;
  
  /**
   * Validate tool parameters
   * @param domain - Domain of the tool
   * @param name - Name of the tool
   * @param params - Parameters to validate
   * @returns Validation result
   */
  validateParameters(domain: string, name: string, params: any): ValidationResult;
  
  /**
   * Register event listeners
   * @param eventName - Event name to listen for
   * @param callback - Callback function
   */
  on(eventName: string, callback: (data: any) => void): void;
  
  /**
   * Unregister event listeners
   * @param eventName - Event name
   * @param callback - Callback function
   */
  off(eventName: string, callback: (data: any) => void): void;
  
  /**
   * Check if tool execution is currently in progress
   * @param toolCallId - Optional tool call ID to check
   * @returns Whether execution is in progress
   */
  isExecuting(toolCallId?: string): boolean;
  
  /**
   * Cancel ongoing tool execution
   * @param toolCallId - Tool call ID to cancel
   * @returns Promise resolving to whether cancellation was successful
   */
  cancelExecution(toolCallId: string): Promise<boolean>;
}
```


### 2. Implement Tool Manager Class

Next, we'll implement the Tool Manager class that handles tool registration, parameter validation, and execution:

```typescript
import { App, Component, Notice, Events, debounce } from 'obsidian';
import { BCPRegistry } from './BCPRegistry';
import { Tool } from './interfaces';
import { 
  IToolManager, 
  ValidationResult, 
  ToolCall, 
  ToolCallStatus,
  ToolExecutionOptions 
} from './ToolManagerInterface';
import Ajv from 'ajv';

/**
 * ToolManager handles tool registration, validation, and execution
 * Extends Component for proper lifecycle management
 */
export class ToolManager extends Component implements IToolManager {
  private app: App;
  private tools: Map<string, Tool> = new Map();
  private contexts: Map<string, any> = new Map();
  private options: Map<string, any> = new Map();
  private bcpRegistry: BCPRegistry;
  private validator: Ajv;
  private events: Events = new Events();
  
  // Active tool executions
  private activeExecutions: Map<string, { 
    toolCall: ToolCall,
    abortController?: AbortController,
    timeoutId?: NodeJS.Timeout
  }> = new Map();
  
  /**
   * Create a new ToolManager
   * @param app - Obsidian App instance
   * @param bcpRegistry - BCP registry
   */
  constructor(app: App, bcpRegistry: BCPRegistry) {
    super();
    
    this.app = app;
    this.bcpRegistry = bcpRegistry;
    
    // Initialize JSON schema validator
    this.validator = new Ajv({
      allErrors: true,
      coerceTypes: true,
      useDefaults: true,
      strict: false
    });
    
    // Register for BCP events with proper cleanup
    this.registerBCPEvents();
  }
  
  /**
   * Component lifecycle method - called when component is loaded
   */
  onload(): void {
    console.log('ToolManager: loaded');
    
    // Add status bar item for active tools
    this.addStatusBarIndicator();
    
    // Clean up any lingering executions
    this.cleanupExecutions();
  }
  
  /**
   * Component lifecycle method - called when component is unloaded
   */
  onunload(): void {
    console.log('ToolManager: unloaded');
    
    // Cancel any active executions
    this.cleanupExecutions();
    
    // Clean up event listeners
    this.events = new Events();
  }
  
  /**
   * Add a status bar indicator for active tool executions
   */
  private addStatusBarIndicator(): void {
    const statusBar = this.addStatusBarItem();
    statusBar.setText('');
    statusBar.addClass('chatsidian-tool-manager-status');
    
    // Update status bar every second
    this.registerInterval(window.setInterval(() => {
      const activeCount = this.activeExecutions.size;
      
      if (activeCount > 0) {
        statusBar.setText(`🛠️ ${activeCount} tool${activeCount > 1 ? 's' : ''} running`);
        statusBar.addClass('active');
      } else {
        statusBar.setText('');
        statusBar.removeClass('active');
      }
    }, 1000));
  }
  
  /**
   * Clean up any lingering executions
   */
  private cleanupExecutions(): void {
    // Cancel all active executions
    for (const [id, execution] of this.activeExecutions.entries()) {
      try {
        // Clear timeout
        if (execution.timeoutId) {
          clearTimeout(execution.timeoutId);
        }
        
        // Abort execution
        if (execution.abortController) {
          execution.abortController.abort();
        }
        
        // Update status
        execution.toolCall.status = 'cancelled';
        execution.toolCall.completedAt = Date.now();
        
        // Trigger event
        this.events.trigger('toolManager:cancelled', {
          id,
          name: execution.toolCall.name
        });
      } catch (error) {
        console.error(`Error cleaning up execution ${id}:`, error);
      }
    }
    
    // Clear active executions
    this.activeExecutions.clear();
  }
  
  /**
   * Register BCP events
   */
  private registerBCPEvents(): void {
    // Register for BCP events with proper cleanup
    this.registerEvent(
      this.bcpRegistry.on('bcpRegistry:packLoaded', (data: any) => {
        this.handlePackLoaded(data);
      })
    );
    
    this.registerEvent(
      this.bcpRegistry.on('bcpRegistry:packUnloaded', (data: any) => {
        this.handlePackUnloaded(data);
      })
    );
  }
  
  /**
   * Handle pack loaded event
   * @param data - Event data
   */
  private handlePackLoaded(data: any): void {
    const { domain, tools, context } = data;
    
    // Register tools from the pack
    for (const tool of tools) {
      this.registerTool(
        domain,
        tool.name,
        tool.description,
        tool.handler,
        tool.schema,
        {
          icon: tool.icon,
          display: tool.display,
          context
        }
      );
    }
  }
  
  /**
   * Handle pack unloaded event
   * @param data - Event data
   */
  private handlePackUnloaded(data: any): void {
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
  }
  
  /**
   * Register event listeners
   * @param eventName - Event name
   * @param callback - Callback function
   */
  on(eventName: string, callback: (data: any) => void): void {
    this.events.on(eventName, callback);
  }
  
  /**
   * Unregister event listeners
   * @param eventName - Event name
   * @param callback - Callback function
   */
  off(eventName: string, callback: (data: any) => void): void {
    this.events.off(eventName, callback);
  }
  
  /**
   * Register a tool
   * @param domain - Domain of the tool
   * @param name - Name of the tool (without domain prefix)
   * @param description - Human-readable description
   * @param handler - Function to execute when the tool is called
   * @param schema - JSON Schema for tool parameters
   * @param options - Additional options (icon, display preferences, context)
   */
  public registerTool(
    domain: string,
    name: string,
    description: string,
    handler: (params: any, context?: any) => Promise<any>,
    schema: any,
    options?: {
      icon?: string;
      display?: {
        showInSuggestions?: boolean;
        sortOrder?: number;
      };
      context?: any;
    }
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
      schema,
      icon: options?.icon
    });
    
    // Store context if provided
    if (options?.context) {
      this.contexts.set(fullName, options.context);
    }
    
    // Store additional options
    this.options.set(fullName, options || {});
    
    // Validate schema
    if (schema) {
      try {
        this.validator.compile(schema);
      } catch (error) {
        console.warn(`Invalid schema for tool ${fullName}:`, error);
        new Notice(`Warning: Invalid schema for tool ${fullName}`, 3000);
      }
    }
    
    // Trigger event with debounce to avoid UI freezes with many registrations
    this.triggerToolRegistered(domain, name, fullName, description, options?.icon);
  }
  
  /**
   * Trigger tool registered event with debounce
   */
  private triggerToolRegistered = debounce((
    domain: string,
    name: string,
    fullName: string,
    description: string,
    icon?: string
  ): void => {
    // Trigger event
    this.events.trigger('toolManager:toolRegistered', {
      domain,
      name,
      fullName,
      description,
      icon
    });
    
    // Log tool registration in debug mode
    console.log(`Tool registered: ${fullName} (${description})`);
  }, 50);
  
  /**
   * Unregister a tool
   * @param domain - Domain of the tool
   * @param name - Name of the tool (without domain prefix)
   */
  public unregisterTool(domain: string, name: string): void {
    // Create full name
    const fullName = `${domain}.${name}`;
    
    // Check if tool exists
    if (!this.tools.has(fullName)) {
      return;
    }
    
    // Cancel any active executions for this tool
    for (const [id, execution] of this.activeExecutions.entries()) {
      if (execution.toolCall.name === fullName) {
        this.cancelExecution(id);
      }
    }
    
    // Unregister tool
    this.tools.delete(fullName);
    
    // Remove context and options
    this.contexts.delete(fullName);
    this.options.delete(fullName);
    
    // Remove cached validator
    try {
      this.validator.removeSchema(fullName);
    } catch (error) {
      console.warn(`Error removing schema for ${fullName}:`, error);
    }
    
    // Trigger event
    this.events.trigger('toolManager:toolUnregistered', {
      domain,
      name,
      fullName
    });
  }
  
  /**
   * Get all registered tools
   * @returns Array of registered tools with full metadata
   */
  public getTools(): Tool[] {
    return Array.from(this.tools.entries()).map(([fullName, tool]) => {
      const options = this.options.get(fullName) || {};
      
      return {
        ...tool,
        name: fullName,
        icon: tool.icon || options.icon,
        display: options.display
      };
    });
  }
  
  /**
   * Get tools formatted for MCP
   * @returns Array of tools formatted for MCP
   */
  public getToolsForMCP(): any[] {
    return this.getTools()
      .filter(tool => {
        // Skip tools that aren't meant to be shown in suggestions
        const options = this.options.get(tool.name) || {};
        return options.display?.showInSuggestions !== false;
      })
      .map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.schema || { type: "object", properties: {} }
      }));
  }
  
  /**
   * Check if a tool exists
   * @param fullName - Fully qualified tool name (domain.name)
   * @returns Whether the tool exists
   */
  public hasTool(fullName: string): boolean {
    return this.tools.has(fullName);
  }
  
  /**
   * Get tool count
   * @returns Number of registered tools
   */
  public getToolCount(): number {
    return this.tools.size;
  }
  
  /**
   * Get a tool by name
   * @param fullName - Fully qualified tool name (domain.name)
   * @returns Tool or undefined
   */
  public getTool(fullName: string): Tool | undefined {
    const tool = this.tools.get(fullName);
    
    if (!tool) {
      return undefined;
    }
    
    const options = this.options.get(fullName) || {};
    
    return {
      ...tool,
      name: fullName,
      icon: tool.icon || options.icon,
      display: options.display
    };
  }
  
  /**
   * Get tool context
   * @param fullName - Fully qualified tool name (domain.name)
   * @returns Context or undefined
   */
  public getToolContext(fullName: string): any {
    return this.contexts.get(fullName);
  }
  
  /**
   * Check if tool execution is currently in progress
   * @param toolCallId - Optional tool call ID to check
   * @returns Whether execution is in progress
   */
  public isExecuting(toolCallId?: string): boolean {
    if (toolCallId) {
      return this.activeExecutions.has(toolCallId);
    }
    
    return this.activeExecutions.size > 0;
  }
  
  /**
   * Cancel ongoing tool execution
   * @param toolCallId - Tool call ID to cancel
   * @returns Promise resolving to whether cancellation was successful
   */
  public async cancelExecution(toolCallId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(toolCallId);
    
    if (!execution) {
      return false;
    }
    
    try {
      // Clear timeout
      if (execution.timeoutId) {
        clearTimeout(execution.timeoutId);
      }
      
      // Abort execution
      if (execution.abortController) {
        execution.abortController.abort();
      }
      
      // Update status
      execution.toolCall.status = 'cancelled';
      execution.toolCall.completedAt = Date.now();
      
      // Trigger event
      this.events.trigger('toolManager:cancelled', {
        id: toolCallId,
        name: execution.toolCall.name,
        toolCall: execution.toolCall
      });
      
      // Remove from active executions
      this.activeExecutions.delete(toolCallId);
      
      return true;
    } catch (error) {
      console.error(`Error cancelling execution ${toolCallId}:`, error);
      return false;
    }
  }
  
  /**
   * Execute a tool call
   * @param toolCall - Tool call to execute
   * @param options - Execution options
   * @returns Promise resolving to the tool result
   */
  public async executeToolCall(toolCall: ToolCall, options: ToolExecutionOptions = {}): Promise<any> {
    const { id, name, arguments: args } = toolCall;
    
    // Create abort controller for cancellation
    const abortController = new AbortController();
    
    // Set execution timestamps
    toolCall.createdAt = toolCall.createdAt || Date.now();
    toolCall.startedAt = Date.now();
    
    try {
      // Update status
      toolCall.status = 'pending';
      
      // Add to active executions
      this.activeExecutions.set(id, {
        toolCall,
        abortController
      });
      
      // Trigger executing event
      this.events.trigger('toolManager:executing', {
        id,
        name,
        arguments: args,
        options
      });
      
      // Show notification if not silent
      if (!options.silent) {
        new Notice(`Executing tool: ${name}`, 2000);
      }
      
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
      
      // Apply timeout if specified
      if (options.timeout) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error(`Tool execution timed out after ${options.timeout}ms`));
          }, options.timeout);
          
          // Store timeout ID for cleanup
          this.activeExecutions.get(id).timeoutId = timeoutId;
        });
        
        // Create execution promise
        const executionPromise = this.executeToolWithContext(tool, args, options.context, id, abortController.signal);
        
        // Race timeout against execution
        toolCall.status = 'running';
        
        // Await result with timeout
        const result = await Promise.race([executionPromise, timeoutPromise]);
        
        // Update status and result
        toolCall.status = 'success';
        toolCall.result = result;
        toolCall.completedAt = Date.now();
        
        // Remove from active executions
        this.activeExecutions.delete(id);
        
        // Trigger executed event
        this.events.trigger('toolManager:executed', {
          id,
          name,
          arguments: args,
          result,
          duration: toolCall.completedAt - toolCall.startedAt
        });
        
        // Show success notification if not silent
        if (!options.silent) {
          new Notice(`Tool executed successfully: ${name}`, 2000);
        }
        
        return result;
      } else {
        // Execute without timeout
        toolCall.status = 'running';
        
        // Execute with context
        const result = await this.executeToolWithContext(tool, args, options.context, id, abortController.signal);
        
        // Update status and result
        toolCall.status = 'success';
        toolCall.result = result;
        toolCall.completedAt = Date.now();
        
        // Remove from active executions
        this.activeExecutions.delete(id);
        
        // Trigger executed event
        this.events.trigger('toolManager:executed', {
          id,
          name,
          arguments: args,
          result,
          duration: toolCall.completedAt - toolCall.startedAt
        });
        
        // Show success notification if not silent
        if (!options.silent) {
          new Notice(`Tool executed successfully: ${name}`, 2000);
        }
        
        return result;
      }
    } catch (error) {
      // Update status and error
      toolCall.status = 'error';
      toolCall.error = error instanceof Error ? error.message : String(error);
      toolCall.completedAt = Date.now();
      
      // Remove from active executions
      this.activeExecutions.delete(id);
      
      // Trigger error event
      this.events.trigger('toolManager:executionError', {
        id,
        name,
        arguments: args,
        error: toolCall.error,
        duration: toolCall.completedAt - toolCall.startedAt
      });
      
      // Show error notification if not silent
      if (!options.silent) {
        new Notice(`Tool execution failed: ${toolCall.error}`, 5000);
      }
      
      // Log error in console
      console.error(`Tool execution error (${name}):`, error);
      
      // Re-throw error
      throw error;
    }
  }
  
  /**
   * Execute a tool with context
   * @param tool - Tool to execute
   * @param args - Arguments to pass
   * @param customContext - Custom context to merge with tool context
   * @param toolCallId - Tool call ID
   * @param signal - AbortSignal for cancellation
   * @returns Promise resolving to the result
   */
  private async executeToolWithContext(
    tool: Tool,
    args: any,
    customContext?: any,
    toolCallId?: string,
    signal?: AbortSignal
  ): Promise<any> {
    // Get stored context for this tool
    const storedContext = this.contexts.get(tool.name);
    
    // Merge contexts
    const mergedContext = {
      ...storedContext,
      ...customContext,
      app: this.app,
      signal,
      toolCallId
    };
    
    // Execute handler with merged context
    return tool.handler(args, mergedContext);
  }
  
  /**
   * Validate tool parameters
   * @param domain - Domain of the tool
   * @param name - Name of the tool
   * @param params - Parameters to validate
   * @returns Validation result
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
      return { 
        valid: true,
        params
      };
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
    
    // Create a deep copy of params to avoid modifying the original
    const paramsCopy = JSON.parse(JSON.stringify(params));
    
    // Validate parameters
    const valid = validate(paramsCopy);
    
    if (!valid) {
      const errors = validate.errors.map(err => 
        `${err.instancePath} ${err.message}`
      );
      
      return {
        valid: false,
        errors
      };
    }
    
    // Return validated and potentially transformed params
    return { 
      valid: true,
      params: paramsCopy
    };
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
   * Events instance for publishing events
   */
  events: Events;
  
  /**
   * Obsidian App instance
   */
  app: App;
  
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
  
  /**
   * AbortSignal for cancellation
   */
  signal?: AbortSignal;
  
  /**
   * Start timestamp
   */
  startTime: number;
  
  /**
   * Execution options
   */
  options?: ToolExecutionOptions;
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
 * Tool execution pipeline that extends Component for lifecycle management
 */
export class ToolExecutionPipeline extends Component {
  private phases: PipelinePhase[] = [];
  private app: App;
  private events: Events;
  
  /**
   * Create a new ToolExecutionPipeline
   * @param app - Obsidian App instance
   * @param events - Events instance
   */
  constructor(app: App, events: Events) {
    super();
    this.app = app;
    this.events = events;
  }
  
  /**
   * Component onload lifecycle method
   */
  onload(): void {
    console.log('ToolExecutionPipeline: loaded');
  }
  
  /**
   * Component onunload lifecycle method
   */
  onunload(): void {
    console.log('ToolExecutionPipeline: unloaded');
    
    // Clear phases
    this.phases = [];
  }
  
  /**
   * Add a phase to the pipeline
   * @param phase - Phase to add
   */
  public addPhase(phase: PipelinePhase): void {
    this.phases.push(phase);
  }
  
  /**
   * Remove a phase from the pipeline
   * @param phaseName - Name of the phase to remove
   * @returns Whether the phase was removed
   */
  public removePhase(phaseName: string): boolean {
    const initialLength = this.phases.length;
    this.phases = this.phases.filter(phase => phase.name !== phaseName);
    return this.phases.length < initialLength;
  }
  
  /**
   * Clear all phases from the pipeline
   */
  public clearPhases(): void {
    this.phases = [];
  }
  
  /**
   * Get all phases in the pipeline
   * @returns Array of phases
   */
  public getPhases(): PipelinePhase[] {
    return [...this.phases];
  }
  
  /**
   * Execute the pipeline
   * @param context - Execution context
   * @returns Promise resolving to the result
   */
  public async execute(context: ExecutionContext): Promise<any> {
    try {
      // Add app and events to context if not already present
      context.app = context.app || this.app;
      context.events = context.events || this.events;
      context.startTime = context.startTime || Date.now();
      
      // Trigger pipeline started event
      this.events.trigger('toolManager:pipelineStarted', {
        id: context.toolCall.id,
        name: context.toolCall.name,
        phases: this.phases.map(p => p.name)
      });
      
      // Execute each phase
      for (const phase of this.phases) {
        // Check for cancellation
        if (context.signal?.aborted) {
          context.skipRemaining = true;
          throw new Error('Execution was cancelled');
        }
        
        // Skip if marked
        if (context.skipRemaining) {
          break;
        }
        
        // Trigger phase started event
        this.events.trigger('toolManager:phaseStarted', {
          id: context.toolCall.id,
          phase: phase.name
        });
        
        // Execute phase
        try {
          await phase.execute(context);
          
          // Trigger phase completed event
          this.events.trigger('toolManager:phaseCompleted', {
            id: context.toolCall.id,
            phase: phase.name,
            duration: Date.now() - context.startTime
          });
        } catch (error) {
          // Trigger phase error event
          this.events.trigger('toolManager:phaseError', {
            id: context.toolCall.id,
            phase: phase.name,
            error: error instanceof Error ? error.message : String(error)
          });
          
          // Re-throw error
          throw error;
        }
      }
      
      // Trigger pipeline completed event
      this.events.trigger('toolManager:pipelineCompleted', {
        id: context.toolCall.id,
        name: context.toolCall.name,
        duration: Date.now() - context.startTime,
        result: context.result
      });
      
      // Return result
      return context.result;
    } catch (error) {
      // Set error in context
      context.error = error instanceof Error ? error : new Error(String(error));
      
      // Set status to error
      context.toolCall.status = 'error';
      context.toolCall.error = context.error.message;
      
      // Trigger pipeline error event
      this.events.trigger('toolManager:pipelineError', {
        id: context.toolCall.id,
        name: context.toolCall.name,
        arguments: context.toolCall.arguments,
        error: context.error.message,
        duration: Date.now() - context.startTime
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
   * Input validation phase
   */
  validation: {
    name: 'validation',
    async execute(context: ExecutionContext): Promise<void> {
      const { toolCall, tool, events } = context;
      
      // Skip if no schema
      if (!tool.schema) {
        return;
      }
      
      // Trigger validation event
      events.trigger('toolManager:validating', {
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
      
      // Create a deep copy to avoid modifying original
      const argsCopy = JSON.parse(JSON.stringify(toolCall.arguments));
      
      // Validate parameters
      const valid = validate(argsCopy);
      
      if (!valid) {
        const errors = validate.errors.map(err => 
          `${err.instancePath} ${err.message}`
        );
        
        throw new Error(`Invalid parameters: ${errors.join(', ')}`);
      }
      
      // Update arguments with coerced values
      toolCall.arguments = argsCopy;
    }
  },
  
  /**
   * Authorization phase
   */
  authorization: {
    name: 'authorization',
    async execute(context: ExecutionContext): Promise<void> {
      const { toolCall, events, app, options } = context;
      
      // Skip if authorization not needed (e.g. read-only operation)
      const toolName = toolCall.name.toLowerCase();
      const readOnlyOperation = 
        toolName.includes('read') || 
        toolName.includes('get') || 
        toolName.includes('list') || 
        toolName.includes('search');
      
      // Always authorize read-only operations
      if (readOnlyOperation) {
        return;
      }
      
      // Trigger authorization event
      events.trigger('toolManager:authorizing', {
        id: toolCall.id,
        name: toolCall.name,
        arguments: toolCall.arguments
      });
      
      // For write operations, could prompt user for confirmation
      // For demo purposes, we'll just add a notice and continue
      if (!options?.silent) {
        new Notice(`Executing tool: ${toolCall.name}`, 2000);
      }
    }
  },
  
  /**
   * Execution phase
   */
  execution: {
    name: 'execution',
    async execute(context: ExecutionContext): Promise<void> {
      const { toolCall, tool, toolContext, events, signal } = context;
      
      // Check if cancelled
      if (signal?.aborted) {
        throw new Error('Execution cancelled');
      }
      
      // Trigger execution event
      events.trigger('toolManager:executing', {
        id: toolCall.id,
        name: toolCall.name,
        arguments: toolCall.arguments
      });
      
      // Update tool call status
      toolCall.status = 'running';
      
      // Execute tool with cancellation signal
      const result = await tool.handler(toolCall.arguments, {
        ...toolContext,
        signal
      });
      
      // Set result in context
      context.result = result;
      
      // Update tool call status and result
      toolCall.status = 'success';
      toolCall.result = result;
      
      // Trigger success event
      events.trigger('toolManager:executed', {
        id: toolCall.id,
        name: toolCall.name,
        arguments: toolCall.arguments,
        result
      });
    }
  },
  
  /**
   * Notification phase
   */
  notification: {
    name: 'notification',
    async execute(context: ExecutionContext): Promise<void> {
      const { toolCall, result, options } = context;
      
      // Skip if silent mode
      if (options?.silent) {
        return;
      }
      
      // Show success notification
      new Notice(`Tool completed: ${toolCall.name}`, 2000);
    }
  },
  
  /**
   * Logging phase
   */
  logging: {
    name: 'logging',
    async execute(context: ExecutionContext): Promise<void> {
      const { toolCall, result, options } = context;
      
      // Skip if not in debug mode
      if (!options?.debug) {
        return;
      }
      
      // Log tool execution
      console.log(`Tool executed: ${toolCall.name}`, {
        id: toolCall.id,
        arguments: toolCall.arguments,
        result,
        duration: `${Date.now() - context.startTime}ms`
      });
    }
  }
};

/**
 * Create a standard execution pipeline
 * @param app - Obsidian App instance
 * @param events - Events instance
 * @returns Pipeline with standard phases
 */
export function createStandardPipeline(app: App, events: Events): ToolExecutionPipeline {
  const pipeline = new ToolExecutionPipeline(app, events);
  
  // Add standard phases
  pipeline.addPhase(standardPipelines.validation);
  pipeline.addPhase(standardPipelines.authorization);
  pipeline.addPhase(standardPipelines.execution);
  pipeline.addPhase(standardPipelines.notification);
  pipeline.addPhase(standardPipelines.logging);
  
  return pipeline;
}

/**
 * Create a pipeline specifically for read operations
 * @param app - Obsidian App instance
 * @param events - Events instance
 * @returns Pipeline for read operations
 */
export function createReadPipeline(app: App, events: Events): ToolExecutionPipeline {
  const pipeline = new ToolExecutionPipeline(app, events);
  
  // Add phases optimized for read operations
  pipeline.addPhase(standardPipelines.validation);
  pipeline.addPhase(standardPipelines.execution);
  pipeline.addPhase(standardPipelines.logging);
  
  return pipeline;
}

/**
 * Create a pipeline for write operations
 * @param app - Obsidian App instance
 * @param events - Events instance
 * @returns Pipeline for write operations
 */
export function createWritePipeline(app: App, events: Events): ToolExecutionPipeline {
  const pipeline = new ToolExecutionPipeline(app, events);
  
  // Add phases with extra validation for write operations
  pipeline.addPhase(standardPipelines.validation);
  pipeline.addPhase(standardPipelines.authorization);
  pipeline.addPhase({
    name: 'backupCheck',
    async execute(context: ExecutionContext): Promise<void> {
      // Could implement a backup mechanism for write operations
      // For now, just continue
    }
  });
  pipeline.addPhase(standardPipelines.execution);
  pipeline.addPhase(standardPipelines.notification);
  pipeline.addPhase(standardPipelines.logging);
  
  return pipeline;
}
```


### 5. Implement Enhanced Tool Manager with Pipeline

Now, let's enhance the Tool Manager to use the execution pipeline:

```typescript
/**
 * Enhanced Tool Manager with execution pipeline
 * Uses Obsidian's Component pattern for lifecycle management
 */
export class EnhancedToolManager extends ToolManager {
  private readPipeline: ToolExecutionPipeline;
  private writePipeline: ToolExecutionPipeline;
  private standardPipeline: ToolExecutionPipeline;
  
  /**
   * Create a new EnhancedToolManager
   * @param app - Obsidian App instance
   * @param bcpRegistry - BCP registry
   */
  constructor(app: App, bcpRegistry: BCPRegistry) {
    super(app, bcpRegistry);
    
    // Create pipelines
    this.standardPipeline = createStandardPipeline(app, this.events);
    this.readPipeline = createReadPipeline(app, this.events);
    this.writePipeline = createWritePipeline(app, this.events);
    
    // Add as children for lifecycle management
    this.addChild(this.standardPipeline);
    this.addChild(this.readPipeline);
    this.addChild(this.writePipeline);
  }
  
  /**
   * Component onload lifecycle method
   */
  onload(): void {
    super.onload();
    console.log('EnhancedToolManager: loaded');
    
    // Register command for showing active tools
    this.addCommand('showActiveTools');
  }
  
  /**
   * Add commands to the command palette
   * @param commandType - Type of command to add
   */
  private addCommand(commandType: string): void {
    switch (commandType) {
      case 'showActiveTools':
        this.registerCommand('showActiveTools');
        break;
    }
  }
  
  /**
   * Register a command with Obsidian
   * @param commandId - Command ID
   */
  private registerCommand(commandId: string): void {
    switch (commandId) {
      case 'showActiveTools':
        this.app.commands.registerCommand({
          id: 'chatsidian-show-active-tools',
          name: 'Show active tools',
          callback: () => {
            const activeCount = this.activeExecutions.size;
            if (activeCount > 0) {
              const activeTools = Array.from(this.activeExecutions.values())
                .map(execution => execution.toolCall.name)
                .join(', ');
              
              new Notice(`Active tools (${activeCount}): ${activeTools}`, 5000);
            } else {
              new Notice('No active tools', 2000);
            }
          }
        });
        break;
    }
  }
  
  /**
   * Execute a tool call using the appropriate pipeline
   * @param toolCall - Tool call to execute
   * @param options - Execution options
   * @returns Promise resolving to the result
   */
  public async executeToolCall(toolCall: ToolCall, options: ToolExecutionOptions = {}): Promise<any> {
    // Find tool
    const tool = this.getTool(toolCall.name);
    
    if (!tool) {
      throw new Error(`Tool ${toolCall.name} not found`);
    }
    
    // Get context for this tool
    const toolContext = this.getToolContext(toolCall.name);
    
    // Choose appropriate pipeline based on tool name
    const pipeline = this.choosePipeline(toolCall.name);
    
    // Create abort controller for cancellation
    const abortController = new AbortController();
    
    // Add to active executions
    this.activeExecutions.set(toolCall.id, {
      toolCall,
      abortController
    });
    
    try {
      // Set timestamps
      toolCall.createdAt = toolCall.createdAt || Date.now();
      toolCall.startedAt = Date.now();
      
      // Create execution context
      const context: ExecutionContext = {
        toolCall,
        tool,
        toolContext,
        events: this.events,
        app: this.app,
        signal: abortController.signal,
        startTime: toolCall.startedAt,
        options
      };
      
      // Apply timeout if specified
      if (options.timeout) {
        const timeoutId = setTimeout(() => {
          abortController.abort('Timeout');
          
          // Remove from active executions
          this.activeExecutions.delete(toolCall.id);
          
          // Update status
          toolCall.status = 'error';
          toolCall.error = `Execution timed out after ${options.timeout}ms`;
          toolCall.completedAt = Date.now();
          
          // Trigger timeout event
          this.events.trigger('toolManager:executionTimeout', {
            id: toolCall.id,
            name: toolCall.name,
            duration: Date.now() - toolCall.startedAt
          });
          
          // Show timeout notification if not silent
          if (!options.silent) {
            new Notice(`Tool execution timed out: ${toolCall.name}`, 3000);
          }
        }, options.timeout);
        
        // Store timeout ID
        this.activeExecutions.get(toolCall.id).timeoutId = timeoutId;
      }
      
      // Execute pipeline
      const result = await pipeline.execute(context);
      
      // Update status and timestamps
      toolCall.status = 'success';
      toolCall.result = result;
      toolCall.completedAt = Date.now();
      
      // Remove from active executions
      this.activeExecutions.delete(toolCall.id);
      
      return result;
    } catch (error) {
      // Update error status
      toolCall.status = 'error';
      toolCall.error = error instanceof Error ? error.message : String(error);
      toolCall.completedAt = Date.now();
      
      // Remove from active executions
      this.activeExecutions.delete(toolCall.id);
      
      // Re-throw error
      throw error;
    }
  }
  
  /**
   * Choose the appropriate pipeline based on tool name
   * @param toolName - Full tool name (domain.name)
   * @returns The appropriate pipeline
   */
  private choosePipeline(toolName: string): ToolExecutionPipeline {
    // Normalize tool name for comparison
    const normalizedName = toolName.toLowerCase();
    
    // Check for read operations
    const isReadOperation = 
      normalizedName.includes('read') || 
      normalizedName.includes('get') || 
      normalizedName.includes('list') || 
      normalizedName.includes('search');
    
    // Check for write operations
    const isWriteOperation = 
      normalizedName.includes('create') || 
      normalizedName.includes('update') || 
      normalizedName.includes('delete') || 
      normalizedName.includes('write') || 
      normalizedName.includes('modify');
    
    // Choose pipeline based on operation type
    if (isReadOperation) {
      return this.readPipeline;
    } else if (isWriteOperation) {
      return this.writePipeline;
    } else {
      return this.standardPipeline;
    }
  }
  
  /**
   * Add a custom phase to a pipeline
   * @param phase - Phase to add
   * @param pipelineType - Type of pipeline ('standard', 'read', or 'write')
   */
  public addPipelinePhase(phase: PipelinePhase, pipelineType: 'standard' | 'read' | 'write' = 'standard'): void {
    switch (pipelineType) {
      case 'standard':
        this.standardPipeline.addPhase(phase);
        break;
      case 'read':
        this.readPipeline.addPhase(phase);
        break;
      case 'write':
        this.writePipeline.addPhase(phase);
        break;
    }
  }
  
  /**
   * Get a pipeline by type
   * @param type - Pipeline type
   * @returns The requested pipeline
   */
  public getPipeline(type: 'standard' | 'read' | 'write' = 'standard'): ToolExecutionPipeline {
    switch (type) {
      case 'read':
        return this.readPipeline;
      case 'write':
        return this.writePipeline;
      default:
        return this.standardPipeline;
    }
  }
}
```

### 6. Create Schema Builder Utility

To help with creating JSON Schema definitions for tools:

```typescript
/**
 * Utility for building JSON Schema definitions
 * Follows Obsidian's Component pattern with static utilities
 */
export class SchemaBuilder {
  private schema: any = {
    type: 'object',
    properties: {},
    required: []
  };
  
  /**
   * Create a new SchemaBuilder with default settings
   * @returns A new SchemaBuilder instance
   */
  public static create(): SchemaBuilder {
    return new SchemaBuilder();
  }
  
  /**
   * Create a schema for a file operation
   * @param description - Schema description
   * @returns A new SchemaBuilder instance with file path field
   */
  public static createFileSchema(description: string = 'File operation'): SchemaBuilder {
    return new SchemaBuilder()
      .setDescription(description)
      .addString('path', 'Path to the file', true, {
        minLength: 1
      });
  }
  
  /**
   * Create a schema for a folder operation
   * @param description - Schema description
   * @returns A new SchemaBuilder instance with folder path field
   */
  public static createFolderSchema(description: string = 'Folder operation'): SchemaBuilder {
    return new SchemaBuilder()
      .setDescription(description)
      .addString('path', 'Path to the folder', true, {
        minLength: 1
      });
  }
  
  /**
   * Create a schema for a search operation
   * @param description - Schema description
   * @returns A new SchemaBuilder instance with search query field
   */
  public static createSearchSchema(description: string = 'Search operation'): SchemaBuilder {
    return new SchemaBuilder()
      .setDescription(description)
      .addString('query', 'Search query', true, {
        minLength: 1
      });
  }
  
  /**
   * Set the schema description
   * @param description - Schema description
   * @returns The builder instance for chaining
   */
  public setDescription(description: string): SchemaBuilder {
    this.schema.description = description;
    return this;
  }
  
  /**
   * Set schema title
   * @param title - Schema title
   * @returns The builder instance for chaining
   */
  public setTitle(title: string): SchemaBuilder {
    this.schema.title = title;
    return this;
  }
  
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
      default?: string;
      examples?: string[];
    } = {}
  ): SchemaBuilder {
    // Add property
    this.schema.properties[name] = {
      type: 'string',
      description
    };
    
    // Add options using Object.assign for cleaner code
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        this.schema.properties[name][key] = value;
      }
    });
    
    // Add to required if needed
    if (required) {
      this.schema.required = this.schema.required || [];
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
      default?: number;
      examples?: number[];
    } = {}
  ): SchemaBuilder {
    // Add property
    this.schema.properties[name] = {
      type: 'number',
      description
    };
    
    // Add options using Object.assign for cleaner code
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        this.schema.properties[name][key] = value;
      }
    });
    
    // Add to required if needed
    if (required) {
      this.schema.required = this.schema.required || [];
      this.schema.required.push(name);
    }
    
    return this;
  }
  
  /**
   * Add a boolean property
   * @param name - Property name
   * @param description - Property description
   * @param required - Whether the property is required
   * @param defaultValue - Default value if not specified
   * @returns The builder instance for chaining
   */
  public addBoolean(
    name: string, 
    description: string, 
    required: boolean = false,
    defaultValue?: boolean
  ): SchemaBuilder {
    // Add property
    this.schema.properties[name] = {
      type: 'boolean',
      description
    };
    
    // Add default value if specified
    if (defaultValue !== undefined) {
      this.schema.properties[name].default = defaultValue;
    }
    
    // Add to required if needed
    if (required) {
      this.schema.required = this.schema.required || [];
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
      default?: any[];
      examples?: any[][];
    } = {}
  ): SchemaBuilder {
    // Add property
    this.schema.properties[name] = {
      type: 'array',
      description,
      items: itemType
    };
    
    // Add options using Object.assign for cleaner code
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        this.schema.properties[name][key] = value;
      }
    });
    
    // Add to required if needed
    if (required) {
      this.schema.required = this.schema.required || [];
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
   * @param requiredProperties - Array of required property names
   * @returns The builder instance for chaining
   */
  public addObject(
    name: string, 
    description: string, 
    properties: any,
    required: boolean = false,
    requiredProperties: string[] = []
  ): SchemaBuilder {
    // Add property
    this.schema.properties[name] = {
      type: 'object',
      description,
      properties
    };
    
    // Add required properties if specified
    if (requiredProperties.length > 0) {
      this.schema.properties[name].required = requiredProperties;
    }
    
    // Add to required if needed
    if (required) {
      this.schema.required = this.schema.required || [];
      this.schema.required.push(name);
    }
    
    return this;
  }
  
  /**
   * Add an enum property
   * @param name - Property name
   * @param description - Property description
   * @param values - Enum values
   * @param required - Whether the property is required
   * @param defaultValue - Default value if not specified
   * @returns The builder instance for chaining
   */
  public addEnum<T>(
    name: string,
    description: string,
    values: T[],
    required: boolean = false,
    defaultValue?: T
  ): SchemaBuilder {
    // Add property
    this.schema.properties[name] = {
      enum: values,
      description
    };
    
    // Add default value if specified
    if (defaultValue !== undefined) {
      this.schema.properties[name].default = defaultValue;
    }
    
    // Add to required if needed
    if (required) {
      this.schema.required = this.schema.required || [];
      this.schema.required.push(name);
    }
    
    return this;
  }
  
  /**
   * Build the schema
   * @returns The complete JSON Schema
   */
  public build(): any {
    // Deep clone to avoid modifying the internal schema
    const result = JSON.parse(JSON.stringify(this.schema));
    
    // If no required properties, remove the required array
    if (!result.required || result.required.length === 0) {
      delete result.required;
    }
    
    return result;
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
  
  /**
   * Create a copy of the current builder
   * @returns A new SchemaBuilder with the same schema
   */
  public clone(): SchemaBuilder {
    const clone = new SchemaBuilder();
    clone.schema = JSON.parse(JSON.stringify(this.schema));
    return clone;
  }
}
```


### 7. Update Plugin Core for Tool Manager

Modify the main plugin class to integrate the Tool Manager:

```typescript
import { Plugin, Notice, debounce } from 'obsidian';
import { SettingsManager } from './core/SettingsManager';
import { VaultFacade } from './core/VaultFacade';
import { BCPRegistry } from './mcp/BCPRegistry';
import { EnhancedToolManager, ExecutionContext, PipelinePhase } from './mcp/ToolManager';

export default class ChatsidianPlugin extends Plugin {
  public settings: SettingsManager;
  public vaultFacade: VaultFacade;
  public bcpRegistry: BCPRegistry;
  public toolManager: EnhancedToolManager;
  
  async onload() {
    console.log('Loading Chatsidian plugin');
    
    // Initialize components with proper lifecycle management
    
    // Initialize settings
    this.settings = new SettingsManager(this.app);
    this.addChild(this.settings);
    await this.settings.load();
    
    // Initialize vault facade
    this.vaultFacade = new VaultFacade(this.app);
    this.addChild(this.vaultFacade);
    
    // Initialize BCP registry
    this.bcpRegistry = new BCPRegistry(
      this.app, 
      this.settings,
      this.vaultFacade
    );
    this.addChild(this.bcpRegistry);
    
    // Initialize tool manager
    this.toolManager = new EnhancedToolManager(
      this.app,
      this.bcpRegistry
    );
    this.addChild(this.toolManager);
    
    // Add custom pipeline phases based on settings
    this.configurePipelines();
    
    // Add UI elements
    this.addRibbonIcon();
    this.addCommands();
    
    // Add listener for settings changes
    this.registerEvent(
      this.settings.on('settings:changed', this.handleSettingsChanged.bind(this))
    );
    
    // Initialize when workspace is ready
    this.app.workspace.onLayoutReady(() => {
      this.onWorkspaceReady();
    });
    
    new Notice('Chatsidian plugin loaded', 2000);
  }
  
  /**
   * Fired when the workspace layout is ready
   */
  private onWorkspaceReady(): void {
    // Now that the UI is ready, initialize components that need UI
    console.log('Chatsidian workspace ready');
  }
  
  /**
   * Handle settings changes
   * @param settings - New settings
   */
  private handleSettingsChanged = debounce((settings: any): void => {
    // Reconfigure pipelines based on new settings
    this.configurePipelines();
  }, 500);
  
  /**
   * Configure tool execution pipelines based on settings
   */
  private configurePipelines(): void {
    const settings = this.settings.getSettings();
    
    // Add verbose logging phase if enabled
    if (settings.verboseLogging) {
      const loggingPhase: PipelinePhase = {
        name: 'verboseLogging',
        async execute(context: ExecutionContext): Promise<void> {
          const { toolCall, result, startTime } = context;
          
          console.log(`[VERBOSE] Tool executed: ${toolCall.name}`, {
            id: toolCall.id,
            arguments: toolCall.arguments,
            result,
            duration: `${Date.now() - startTime}ms`
          });
        }
      };
      
      // Add to all pipelines
      this.toolManager.addPipelinePhase(loggingPhase, 'standard');
      this.toolManager.addPipelinePhase(loggingPhase, 'read');
      this.toolManager.addPipelinePhase(loggingPhase, 'write');
    }
    
    // Add confirmation phase for write operations if enabled
    if (settings.confirmWrites) {
      const confirmationPhase: PipelinePhase = {
        name: 'userConfirmation',
        async execute(context: ExecutionContext): Promise<void> {
          const { toolCall, options } = context;
          
          // Skip if silent mode or not a write operation
          if (options?.silent) {
            return;
          }
          
          // Show confirmation notice
          new Notice(`Executing write operation: ${toolCall.name}`, 3000);
          
          // Could implement a modal confirmation dialog here
          // For now, just continue without waiting
        }
      };
      
      // Add to write pipeline only
      this.toolManager.addPipelinePhase(confirmationPhase, 'write');
    }
  }
  
  /**
   * Add ribbon icon
   */
  private addRibbonIcon(): void {
    const ribbonIcon = this.addRibbonIcon(
      'message-square',
      'Chatsidian',
      (evt: MouseEvent) => {
        // Show stats about active tools
        const activeCount = this.toolManager.isExecuting() ? 
          'Running' : 'Idle';
        
        const toolCount = this.toolManager.getToolCount();
        
        new Notice(`Chatsidian: ${activeCount} (${toolCount} tools available)`, 3000);
      }
    );
    
    // Add classes for styling
    ribbonIcon.addClass('chatsidian-ribbon-icon');
  }
  
  /**
   * Add commands to the command palette
   */
  private addCommands(): void {
    // Add command to show active tools
    this.addCommand({
      id: 'show-active-tools',
      name: 'Show active tools',
      callback: () => {
        const activeCount = this.toolManager.isExecuting() ? 
          'Tools are running' : 'No active tools';
          
        new Notice(activeCount, 2000);
      }
    });
    
    // Add command to cancel all tool executions
    this.addCommand({
      id: 'cancel-tool-executions',
      name: 'Cancel all tool executions',
      callback: async () => {
        // Get all active executions
        const activeTools = this.toolManager.getActiveExecutions();
        
        if (activeTools.length === 0) {
          new Notice('No active tools to cancel', 2000);
          return;
        }
        
        // Cancel all active executions
        for (const toolCall of activeTools) {
          await this.toolManager.cancelExecution(toolCall.id);
        }
        
        new Notice(`Cancelled ${activeTools.length} tool executions`, 2000);
      }
    });
  }
  
  /**
   * Plugin unload method - automatically cleans up components
   */
  onunload() {
    console.log('Unloading Chatsidian plugin');
    
    // The Plugin base class takes care of unloading all child components
    
    new Notice('Chatsidian plugin unloaded', 2000);
  }
}
```

### 8. Example Tool Registration and Execution

Here's an example of how to use the Tool Manager to register and execute tools:

```typescript
/**
 * Example of tool registration and execution with Obsidian integration
 */
export class ToolExampleManager extends Component {
  private plugin: ChatsidianPlugin;
  
  constructor(plugin: ChatsidianPlugin) {
    super();
    this.plugin = plugin;
  }
  
  /**
   * Component lifecycle method - called when component is loaded
   */
  onload(): void {
    // Register example tools
    this.registerExampleTools();
    
    // Add command to execute example tools
    this.addExampleCommands();
  }
  
  /**
   * Register example tools
   */
  private registerExampleTools(): void {
    // Register greeting tool
    this.registerGreetingTool();
    
    // Register note utility tools
    this.registerNoteUtilityTools();
  }
  
  /**
   * Register greeting tool
   */
  private registerGreetingTool(): void {
    // Create schema using updated SchemaBuilder
    const greetSchema = SchemaBuilder.create()
      .setTitle('Greeting Parameters')
      .setDescription('Parameters for greeting someone')
      .addString('name', 'Name to greet', true, {
        minLength: 1,
        examples: ['World', 'Claude', 'Friend']
      })
      .addEnum('language', 'Language for greeting', false, 
        ['en', 'es', 'fr', 'de', 'ja'], 'en')
      .build();
    
    // Register tool
    this.plugin.toolManager.registerTool(
      'Example',
      'greet',
      'Greet a person in different languages',
      this.handleGreetTool.bind(this),
      greetSchema,
      {
        icon: 'message-circle',
        display: {
          showInSuggestions: true,
          sortOrder: 1
        }
      }
    );
    
    // Log registration
    console.log('Registered greeting tool');
  }
  
  /**
   * Handle greeting tool execution
   * @param params - Tool parameters
   * @param context - Execution context
   * @returns Tool result
   */
  private async handleGreetTool(
    params: { name: string; language?: string },
    context?: any
  ): Promise<any> {
    const { name, language = 'en' } = params;
    
    // Check for cancellation
    if (context?.signal?.aborted) {
      throw new Error('Tool execution cancelled');
    }
    
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
    
    // Show greeting in UI
    if (!context?.silent) {
      new Notice(`${greeting}, ${name}!`, 3000);
    }
    
    // Return result
    return {
      message: `${greeting}, ${name}!`,
      language
    };
  }
  
  /**
   * Register note utility tools
   */
  private registerNoteUtilityTools(): void {
    // Create schema for note creation
    const createNoteSchema = SchemaBuilder.createFileSchema('Create a new note')
      .addString('content', 'Note content', true)
      .addBoolean('overwrite', 'Whether to overwrite existing note', false, false)
      .build();
    
    // Register create note tool
    this.plugin.toolManager.registerTool(
      'NoteUtils',
      'createNote',
      'Create a new note in the vault',
      async (params: { path: string; content: string; overwrite?: boolean }, context?: any) => {
        // Use VaultFacade to create the note
        const result = await this.plugin.vaultFacade.createNote(
          params.path,
          params.content,
          params.overwrite
        );
        
        return result;
      },
      createNoteSchema,
      {
        icon: 'file-plus',
        display: {
          showInSuggestions: true
        }
      }
    );
    
    // Create schema for note reading
    const readNoteSchema = SchemaBuilder.createFileSchema('Read a note')
      .build();
    
    // Register read note tool
    this.plugin.toolManager.registerTool(
      'NoteUtils',
      'readNote',
      'Read a note from the vault',
      async (params: { path: string }, context?: any) => {
        // Use VaultFacade to read the note
        const result = await this.plugin.vaultFacade.readNote(params.path);
        
        return result;
      },
      readNoteSchema,
      {
        icon: 'file-text',
        display: {
          showInSuggestions: true
        }
      }
    );
  }
  
  /**
   * Add example commands to command palette
   */
  private addExampleCommands(): void {
    // Register command to execute greeting tool
    this.plugin.addCommand({
      id: 'execute-greeting-tool',
      name: 'Execute greeting tool',
      callback: () => {
        this.executeGreetTool();
      }
    });
  }
  
  /**
   * Execute greeting tool
   */
  private async executeGreetTool(): Promise<void> {
    try {
      // Create tool call
      const toolCall: ToolCall = {
        id: 'example-' + Date.now(),
        name: 'Example.greet',
        arguments: {
          name: 'Obsidian User',
          language: 'en'
        }
      };
      
      // Execute tool call with options
      const result = await this.plugin.toolManager.executeToolCall(toolCall, {
        timeout: 5000,
        debug: true
      });
      
      console.log('Tool result:', result);
    } catch (error) {
      console.error('Error executing tool:', error);
      new Notice(`Error: ${error.message}`, 3000);
    }
  }
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

- Test component lifecycle management
  - Verify proper initialization and cleanup
  - Test parent-child component relationships
  - Verify event registration and unregistration

- Test tool registration and unregistration
  - Test registration with various options
  - Test icon and display preferences
  - Test unregistration cleanup
  - Test duplicate tool handling

- Test parameter validation
  - Test with various schema types and validations
  - Test required parameter validation
  - Test number range validation
  - Test enum validation
  - Test string pattern validation
  - Test complex nested object validation
  - Test validation with defaults and transformations

- Test tool execution
  - Test successful execution with various parameter types
  - Test error handling and propagation
  - Test timeout handling
  - Test cancellation
  - Test context passing
  - Test pipeline phase execution

### Integration Tests

- Test integration with Obsidian's Component lifecycle
  - Verify proper initialization and cleanup during plugin load/unload
  - Test parent-child component relationship with plugin
  - Test automatic event cleanup when components are unloaded

- Test integration between BCP Registry and Tool Manager
  - Verify tools are properly registered when BCPs are loaded
  - Verify tools are properly unregistered when BCPs are unloaded
  - Test dependency handling between BCPs and tools

- Test tool execution with real Obsidian APIs
  - Test integration with VaultFacade for real file operations
  - Test Notice integration for user feedback
  - Test command registration and execution
  - Test UI elements and interaction

- Test pipeline integration
  - Test standard pipeline execution with real tools
  - Test read/write pipelines with appropriate operations
  - Test pipeline customization with custom phases
  - Test pipeline adaptation based on settings

### Performance Tests

- Test tool execution performance
  - Measure execution time for various tool types
  - Test parallel tool execution
  - Test performance with many registered tools
  - Test memory usage during tool execution

- Test pipeline performance
  - Measure overhead of pipeline phases
  - Compare performance of different pipeline configurations
  - Test optimization techniques for pipeline execution

- Test schema validation performance
  - Compare performance of different schema validation approaches
  - Test caching strategies for schemas
  - Measure impact of schema complexity on validation time

## Next Steps

Phase 2.4 will focus on implementing advanced features for the VaultFacade, building on the Component-based framework established in this phase. The enhancements will include:

1. Advanced metadata management for files and folders
2. Improved search capabilities with more efficient MetadataCache usage
3. Support for file and folder operations with link updating
4. Integration with Obsidian's file history and version tracking
5. Enhanced frontmatter and YAML handling

These improvements will further align the Chatsidian plugin with Obsidian's API patterns and best practices, ensuring robustness, maintainability, and extensibility. The Component-based architecture we've established in Phases 2.1-2.3 provides a solid foundation for these advanced features, enabling proper lifecycle management and efficient resource usage.

The Tool Manager implemented in this phase will serve as the central execution engine for all tool operations, providing a consistent interface for BCPs to register and execute tools, with robust error handling, validation, and pipeline customization options.
