/**
 * Advanced Tool Manager
 * 
 * This file implements the Advanced Tool Manager component, which extends
 * the core ToolManager with advanced execution capabilities.
 */

import { App, Component, Events } from 'obsidian';
import { EventBus } from '../../core/EventBus';
import { ToolManager } from '../ToolManager';
import { 
  ToolCall, 
  ToolExecutionOptions
} from '../ToolManagerInterface';
import { createAbortController } from '../utils/ExecutionUtils';

/**
 * Tool execution priority
 */
export enum ToolExecutionPriority {
  /**
   * Low priority - executed last
   */
  Low = 'low',
  
  /**
   * Normal priority - default
   */
  Normal = 'normal',
  
  /**
   * High priority - executed first
   */
  High = 'high',
  
  /**
   * Critical priority - executed immediately
   */
  Critical = 'critical'
}

/**
 * Tool execution mode
 */
export enum ToolExecutionMode {
  /**
   * Sequential execution - one at a time
   */
  Sequential = 'sequential',
  
  /**
   * Concurrent execution - multiple at once
   */
  Concurrent = 'concurrent',
  
  /**
   * Batch execution - grouped by priority
   */
  Batch = 'batch'
}

/**
 * Tool execution status
 */
export enum ToolExecutionStatus {
  /**
   * Queued for execution
   */
  Queued = 'queued',
  
  /**
   * Currently executing
   */
  Executing = 'executing',
  
  /**
   * Execution completed successfully
   */
  Completed = 'completed',
  
  /**
   * Execution failed
   */
  Failed = 'failed',
  
  /**
   * Execution was cancelled
   */
  Cancelled = 'cancelled',
  
  /**
   * Execution is paused
   */
  Paused = 'paused'
}

/**
 * Advanced tool execution options
 */
export interface AdvancedToolExecutionOptions extends ToolExecutionOptions {
  /**
   * Execution priority
   */
  priority?: ToolExecutionPriority;
  
  /**
   * Dependencies (tool call IDs that must complete before this one)
   */
  dependencies?: string[];
  
  /**
   * Maximum retry count
   */
  maxRetries?: number;
  
  /**
   * Retry delay in milliseconds
   */
  retryDelay?: number;
  
  /**
   * Whether to use exponential backoff for retries
   */
  useExponentialBackoff?: boolean;
  
  /**
   * Jitter factor for retry delay (0-1)
   */
  jitterFactor?: number;
}

/**
 * Tool chain options
 */
export interface ToolChainOptions {
  /**
   * Tool calls to execute in sequence
   */
  toolCalls: ToolCall[];
  
  /**
   * Whether to stop chain on error
   */
  stopOnError?: boolean;
  
  /**
   * Whether to pass results between tools
   */
  passResults?: boolean;
  
  /**
   * Result transformation function
   */
  resultTransform?: (result: any, index: number) => any;
  
  /**
   * Base execution options for all tools
   */
  baseOptions?: AdvancedToolExecutionOptions;
}

/**
 * Advanced tool manager for enhanced tool execution
 * Extends ToolManager for backward compatibility
 */
export class AdvancedToolManager extends ToolManager {
  private executionMode: ToolExecutionMode = ToolExecutionMode.Sequential;
  private executionHistory: { toolCall: ToolCall, result?: any, error?: Error }[] = [];
  private maxConcurrentExecutions: number = 3;
  private defaultRetryCount: number = 3;
  private defaultRetryDelay: number = 1000;
  
  /**
   * Create a new advanced tool manager
   * @param app - Obsidian App instance
   * @param bcpRegistry - BCP registry
   * @param eventBus - Event bus for plugin-wide events
   */
  constructor(
    app: App,
    bcpRegistry: any,
    eventBus: EventBus
  ) {
    super(app, bcpRegistry, eventBus);
  }
  
  /**
   * Component lifecycle method - called when component is loaded
   */
  onload(): void {
    super.onload();
    console.log('AdvancedToolManager: loaded');
  }
  
  /**
   * Component lifecycle method - called when component is unloaded
   */
  onunload(): void {
    super.onunload();
    console.log('AdvancedToolManager: unloaded');
  }
  
  /**
   * Execute a tool call with advanced options
   * @param toolCall - Tool call to execute
   * @param options - Advanced execution options
   * @returns Promise resolving to the tool result
   */
  public async executeToolCallAdvanced(
    toolCall: ToolCall,
    options: AdvancedToolExecutionOptions = {}
  ): Promise<any> {
    try {
      // Set execution timestamps
      toolCall.createdAt = toolCall.createdAt || Date.now();
      
      // Execute tool using parent class method
      const result = await super.executeToolCall(toolCall, options);
      
      // Add to history
      this.executionHistory.push({
        toolCall,
        result
      });
      
      // Trim history if too large
      if (this.executionHistory.length > 100) {
        this.executionHistory = this.executionHistory.slice(-100);
      }
      
      return result;
    } catch (error) {
      // Add to history
      this.executionHistory.push({
        toolCall,
        error: error instanceof Error ? error : new Error(String(error))
      });
      
      // Re-throw error
      throw error;
    }
  }
  
  /**
   * Execute a chain of tool calls
   * @param options - Tool chain options
   * @returns Promise resolving to the results of all tool calls
   */
  public async executeToolChain(options: ToolChainOptions): Promise<any[]> {
    const { toolCalls, stopOnError = true, passResults = true, resultTransform, baseOptions } = options;
    
    // Validate tool calls
    if (!toolCalls || !Array.isArray(toolCalls) || toolCalls.length === 0) {
      throw new Error('Tool calls array is required and must not be empty');
    }
    
    const results: any[] = [];
    
    // Execute tools in sequence
    for (let i = 0; i < toolCalls.length; i++) {
      const toolCall = toolCalls[i];
      
      // Pass previous result if enabled
      if (passResults && i > 0 && results[i - 1] !== undefined) {
        // Transform result if transform function is provided
        const inputResult = resultTransform ? resultTransform(results[i - 1], i - 1) : results[i - 1];
        
        // Merge with existing arguments
        toolCall.arguments = {
          ...toolCall.arguments,
          previousResult: inputResult
        };
      }
      
      try {
        // Execute tool call
        const result = await this.executeToolCallAdvanced(toolCall, baseOptions);
        
        // Add to results
        results.push(result);
      } catch (error) {
        // Add error to results
        results.push(undefined);
        
        // Stop chain if stopOnError is true
        if (stopOnError) {
          throw error;
        }
      }
    }
    
    return results;
  }
  
  /**
   * Execute multiple tool calls concurrently
   * @param toolCalls - Tool calls to execute
   * @param options - Advanced execution options for all tool calls
   * @returns Promise resolving to the results of all tool calls
   */
  public async executeToolsConcurrently(
    toolCalls: ToolCall[],
    options: AdvancedToolExecutionOptions = {}
  ): Promise<any[]> {
    // Validate tool calls
    if (!toolCalls || !Array.isArray(toolCalls) || toolCalls.length === 0) {
      throw new Error('Tool calls array is required and must not be empty');
    }
    
    // Create promises for all tool calls
    const promises = toolCalls.map(toolCall => 
      this.executeToolCallAdvanced(toolCall, options)
    );
    
    // Execute all promises concurrently
    return Promise.all(promises);
  }
  
  /**
   * Retry a failed tool call
   * @param toolCallId - Tool call ID to retry
   * @param options - Advanced execution options
   * @returns Promise resolving to the tool result
   */
  public async retryToolCall(
    toolCallId: string,
    options: AdvancedToolExecutionOptions = {}
  ): Promise<any> {
    // Find tool call in history
    const historyEntry = this.executionHistory.find(entry => entry.toolCall.id === toolCallId);
    
    if (!historyEntry) {
      throw new Error(`Tool call ${toolCallId} not found in history`);
    }
    
    // Execute tool call again
    return this.executeToolCallAdvanced(historyEntry.toolCall, options);
  }
  
  /**
   * Get execution history
   * @param limit - Maximum number of entries to return
   * @returns Execution history
   */
  public getExecutionHistory(limit?: number): { toolCall: ToolCall, result?: any, error?: Error }[] {
    if (limit) {
      return [...this.executionHistory].slice(-limit);
    }
    
    return [...this.executionHistory];
  }
  
  /**
   * Clear execution history
   */
  public clearExecutionHistory(): void {
    this.executionHistory = [];
  }
  
  /**
   * Set the execution mode
   * @param mode - Execution mode
   */
  public setExecutionMode(mode: ToolExecutionMode): void {
    this.executionMode = mode;
  }
  
  /**
   * Get the execution mode
   * @returns Execution mode
   */
  public getExecutionMode(): ToolExecutionMode {
    return this.executionMode;
  }
  
  /**
   * Set the maximum concurrent executions
   * @param max - Maximum concurrent executions
   */
  public setMaxConcurrentExecutions(max: number): void {
    this.maxConcurrentExecutions = max;
  }
  
  /**
   * Get the maximum concurrent executions
   * @returns Maximum concurrent executions
   */
  public getMaxConcurrentExecutions(): number {
    return this.maxConcurrentExecutions;
  }
}

/**
 * Create a new advanced tool manager
 * @param app - Obsidian App instance
 * @param bcpRegistry - BCP registry
 * @param eventBus - Event bus for plugin-wide events
 * @returns Advanced tool manager
 */
export function createAdvancedToolManager(
  app: App,
  bcpRegistry: any,
  eventBus: EventBus
): AdvancedToolManager {
  return new AdvancedToolManager(app, bcpRegistry, eventBus);
}