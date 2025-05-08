/**
 * Execution Context Definitions
 * 
 * This file defines the execution context types and interfaces used
 * in the tool execution pipeline.
 */

import { App, Events } from 'obsidian';
import { Tool } from '../interfaces';
import { ToolCall, ToolExecutionOptions } from '../ToolManagerInterface';

/**
 * Execution context for tool execution pipeline
 */
export interface ExecutionContext {
  /**
   * Tool call being executed
   */
  toolCall: ToolCall;
  
  /**
   * Tool definition
   */
  tool: Tool;
  
  /**
   * Tool parameters
   */
  params: any;
  
  /**
   * Tool context (merged from registration and execution)
   */
  toolContext?: any;
  
  /**
   * Obsidian app instance
   */
  app?: App;
  
  /**
   * Events instance for emitting events
   */
  events?: Events;
  
  /**
   * Execution options
   */
  options?: ToolExecutionOptions & {
    format?: 'json' | 'text' | 'markdown';
  };
  
  /**
   * Abort signal for cancellation
   */
  signal?: AbortSignal;
  
  /**
   * Execution start time
   */
  startTime?: number;
  
  /**
   * Skip remaining phases
   */
  skipRemaining?: boolean;
  
  /**
   * Execution result
   */
  result?: any;
  
  /**
   * Execution error
   */
  error?: Error;
}

/**
 * Create a new execution context
 * @param toolCall - Tool call to execute
 * @param tool - Tool definition
 * @param options - Execution options
 * @returns Execution context
 */
export function createExecutionContext(
  toolCall: ToolCall,
  tool: Tool,
  options: ToolExecutionOptions = {}
): ExecutionContext {
  return {
    toolCall,
    tool,
    params: toolCall.arguments,
    toolContext: options.context,
    options: {
      ...options,
      format: options.format as 'json' | 'text' | 'markdown'
    },
    signal: undefined, // Will be set by the execution pipeline
    startTime: Date.now()
  };
}

/**
 * Merge execution context with additional properties
 * @param context - Execution context
 * @param properties - Additional properties
 * @returns Merged execution context
 */
export function mergeExecutionContext(
  context: ExecutionContext,
  properties: Partial<ExecutionContext>
): ExecutionContext {
  return {
    ...context,
    ...properties
  };
}
