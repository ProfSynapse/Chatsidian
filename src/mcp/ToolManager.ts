/**
 * Tool Manager Implementation
 * 
 * This file implements the Tool Manager component, which is responsible for
 * tool registration, validation, and execution in Chatsidian.
 */

import { App, Component, Notice, Events } from 'obsidian';
import { BCPRegistry } from './BCPRegistry';
import { Tool } from './interfaces';
import { 
  IToolManager, 
  ToolCall, 
  ToolExecutionOptions
} from './ToolManagerInterface';
import { ValidationResult } from './interfaces';
import { EventBus } from '../core/EventBus';
import { ParameterValidator } from './validation/ParameterValidator';
import { ExecutionPipeline } from './execution/ExecutionPipeline';
import { createExecutionContext } from './execution/ExecutionContext';
import { createToolCall, generateId, createAbortController } from './utils/ExecutionUtils';

/**
 * Tool Manager handles tool registration, validation, and execution
 * Extends Component for proper lifecycle management
 */
export class ToolManager extends Component implements IToolManager {
  private app: App;
  private tools: Map<string, Tool> = new Map();
  private contexts: Map<string, any> = new Map();
  private options: Map<string, any> = new Map();
  private bcpRegistry: BCPRegistry;
  private validator: ParameterValidator;
  private events: Events = new Events();
  private eventBus: EventBus;
  private pipeline: ExecutionPipeline;
  
  // Active tool executions
  protected activeExecutions: Map<string, { 
    toolCall: ToolCall,
    abortController?: AbortController,
    timeoutId?: NodeJS.Timeout
  }> = new Map();
  
  /**
   * Create a new ToolManager
   * @param app - Obsidian App instance
   * @param bcpRegistry - BCP registry
   * @param eventBus - Event bus for plugin-wide events
   */
  constructor(app: App, bcpRegistry: BCPRegistry, eventBus: EventBus) {
    super();
    
    this.app = app;
    this.bcpRegistry = bcpRegistry;
    this.eventBus = eventBus;
    
    // Initialize validator
    this.validator = new ParameterValidator();
    
    // Initialize pipeline
    this.pipeline = ExecutionPipeline.createStandardPipeline(app, this.events);
    
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
    // Create status bar item using Obsidian's API
    const statusBarEl = this.app.workspace.containerEl.createDiv();
    const statusBar = {
      setText: (text: string) => { statusBarEl.setText(text); },
      addClass: (cls: string) => { statusBarEl.addClass(cls); },
      removeClass: (cls: string) => { statusBarEl.removeClass(cls); }
    };
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
    // Use the EventBus directly
    this.eventBus.on('bcpRegistry:packLoaded', (data: any) => {
      this.handlePackLoaded(data);
    });
    
    this.eventBus.on('bcpRegistry:packUnloaded', (data: any) => {
      this.handlePackUnloaded(data);
    });
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
        this.validator.addSchema(fullName, schema);
      } catch (error) {
        console.warn(`Invalid schema for tool ${fullName}:`, error);
        new Notice(`Warning: Invalid schema for tool ${fullName}`, 3000);
      }
    }
    
    // Trigger event
    this.events.trigger('toolManager:toolRegistered', {
      domain,
      name,
      fullName,
      description,
      icon: options?.icon
    });
    
    // Log tool registration in debug mode
    console.log(`Tool registered: ${fullName} (${description})`);
  }
  
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
   * Get active executions
   * @returns Array of active tool calls
   */
  public getActiveExecutions(): ToolCall[] {
    return Array.from(this.activeExecutions.values()).map(execution => execution.toolCall);
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
    const abortController = createAbortController(options.timeout);
    
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
      
      // Find tool
      const tool = this.tools.get(name);
      
      if (!tool) {
        throw new Error(`Tool ${name} not found`);
      }
      
      // Get tool context
      const toolContext = this.getToolContext(name);
      
      // Create execution context
      const context = createExecutionContext(toolCall, tool, options);
      context.toolContext = toolContext;
      context.app = this.app;
      context.events = this.events;
      
      // Execute pipeline
      const result = await this.pipeline.execute(context, {
        timeout: options.timeout,
        signal: abortController.signal
      });
      
      // Update tool call with result
      toolCall.status = result.status === 'success' ? 'success' : 'error';
      toolCall.result = result.data;
      toolCall.error = result.error;
      toolCall.completedAt = Date.now();
      
      // Remove from active executions
      this.activeExecutions.delete(id);
      
      // If there was an error, throw it
      if (result.status === 'error') {
        throw new Error(result.error || 'Unknown error');
      }
      
      // Return just the data part of the result
      return result.data;
    } catch (error) {
      // Update status and error
      toolCall.status = 'error';
      toolCall.error = error instanceof Error ? error.message : String(error);
      toolCall.completedAt = Date.now();
      
      // Remove from active executions
      this.activeExecutions.delete(id);
      
      // Log error in console
      console.error(`Tool execution error (${name}):`, error);
      
      // Re-throw error
      throw error;
    }
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
    
    // Validate parameters
    return this.validator.validate(fullName, params);
  }
  
  /**
   * Create a tool call
   * @param name - Tool name
   * @param args - Tool arguments
   * @param id - Optional ID (generated if not provided)
   * @returns Tool call
   */
  public createToolCall(name: string, args: any, id?: string): ToolCall {
    return createToolCall(name, args, id);
  }
}
