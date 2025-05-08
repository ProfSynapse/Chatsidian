import { App, Events } from 'obsidian';
import { Tool, ValidationResult } from './interfaces';

/**
 * Tool call options
 */
export interface ToolExecutionOptions {
  /**
   * Timeout in milliseconds
   */
  timeout?: number;
  
  /**
   * Signal to abort execution
   */
  signal?: AbortSignal;
  
  /**
   * Context for tool execution
   */
  context?: Record<string, any>;
  
  /**
   * Format for tool results
   */
  format?: 'json' | 'text' | 'markdown';
  
  /**
   * Silent execution (no events)
   */
  silent?: boolean;
}

/**
 * Tool call metadata
 */
export interface ToolCall {
  /**
   * Unique ID of the tool call
   */
  id: string;
  
  /**
   * Name of the tool
   */
  name: string;
  
  /**
   * Tool arguments
   */
  arguments: any;
  
  /**
   * Creation timestamp
   */
  createdAt?: number;
  
  /**
   * Start timestamp
   */
  startedAt?: number;
  
  /**
   * Completion timestamp
   */
  completedAt?: number;
  
  /**
   * Tool call status
   */
  status: 'pending' | 'running' | 'completed' | 'error' | 'cancelled' | 'success';
  
  /**
   * Error message (if status is error)
   */
  error?: string;
  
  /**
   * Execution result
   */
  result?: any;
}

/**
 * Pipeline phase function
 */
export interface PipelinePhase {
  /**
   * Phase name
   */
  name: string;

  /**
   * Phase execution function
   */
  execute: (
    context: ExecutionContext,
    options?: ToolExecutionOptions
  ) => Promise<void>;
}

/**
 * Tool manager interface
 */
export interface IToolManager {
  /**
   * Register a tool
   */
  registerTool(
    domain: string,
    name: string,
    description: string,
    handler: (params: any) => Promise<any>,
    schema: any,
    options?: {
      icon?: string;
      display?: {
        showInSuggestions?: boolean;
        sortOrder?: number;
      };
    }
  ): void;
  
  /**
   * Unregister a tool
   */
  unregisterTool(domain: string, name: string): void;
  
  /**
   * Get all registered tools
   */
  getTools(): Tool[];
  
  /**
   * Get tools formatted for MCP
   */
  getToolsForMCP(): any[];
  
  /**
   * Get a tool by name
   */
  getTool(name: string): Tool | undefined;
  
  /**
   * Validate tool parameters
   */
  validateParameters(domain: string, name: string, params: any): ValidationResult;
  
  /**
   * Execute a tool call
   */
  executeToolCall(toolCall: ToolCall, options?: ToolExecutionOptions): Promise<any>;
  
  /**
   * Cancel ongoing tool execution
   */
  cancelExecution(toolCallId: string): Promise<boolean>;
  
  /**
   * Check if tool execution is in progress
   */
  isExecuting(toolCallId?: string): boolean;
  
  /**
   * Get active tool executions
   */
  getActiveExecutions(): ToolCall[];
}

/**
 * Execution context interface
 * Re-exported for convenience
 */
export interface ExecutionContext {
  toolCall: ToolCall;
  tool: Tool;
  params: any;
  toolContext?: any;
  app?: App;
  events?: Events;
  options?: ToolExecutionOptions;
  signal?: AbortSignal;
  startTime?: number;
  skipRemaining?: boolean;
  result?: any;
  error?: Error;
}
