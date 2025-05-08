import { App, Events } from 'obsidian';
import { Tool } from '../interfaces';
import { ExecutionContext } from './ExecutionContext';
import { ResultFormatter } from '../formatting/ResultFormatter';
import { ToolExecutionResult } from '../interfaces';

/**
 * Tool execution pipeline that manages tool execution lifecycle
 */
export class ExecutionPipeline {
  private app: App;
  private events: Events;
  
  /**
   * Create a new execution pipeline
   * @param app - Obsidian app instance
   * @param events - Event bus
   */
  constructor(app: App, events: Events) {
    this.app = app;
    this.events = events;
  }
  
  /**
   * Execute a tool
   * @param context - Execution context
   * @param options - Execution options
   * @returns Promise resolving to execution result
   */
  public async execute(
    context: ExecutionContext,
    options: {
      timeout?: number;
      signal?: AbortSignal;
    } = {}
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Extract needed values from context
      const { tool, params } = context;
      const { signal } = options;
      
      // Check if already aborted
      if (signal?.aborted) {
        throw new Error('Execution aborted by signal');
      }
      
      // Execute phases
      await this.beforeExecution(context);
      const result = await this.executeHandler(tool, params, context, signal);
      await this.afterExecution(context, result);
      
      // Return result with metadata
      return {
        data: result,
        status: 'success',
        metadata: {
          executionTime: Date.now() - startTime
        }
      };
    } catch (error) {
      // Format error result
      const errorResult: ToolExecutionResult = {
        data: null,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          executionTime: Date.now() - startTime,
          errorType: error instanceof Error ? error.name : 'UnknownError',
          errorStack: error instanceof Error ? error.stack : undefined
        }
      };
      
      // Handle error
      await this.handleError(context, errorResult);
      
      // Return formatted error
      return errorResult;
    }
  }
  
  /**
   * Run before execution hooks
   * @param context - Execution context
   */
  private async beforeExecution(context: ExecutionContext): Promise<void> {
    // Emit starting event
    this.events.trigger('toolExecution:starting', {
      toolName: context.tool.name,
      params: context.params,
      timestamp: Date.now()
    });
  }
  
  /**
   * Execute the tool handler
   * @param tool - Tool to execute
   * @param params - Tool parameters
   * @param context - Execution context
   * @param signal - Abort signal
   * @returns Promise resolving to handler result
   */
  private async executeHandler(
    tool: Tool,
    params: any,
    context: ExecutionContext,
    signal?: AbortSignal
  ): Promise<any> {
    // Add signal to context
    const executionContext = {
      ...context,
      signal
    };
    
    // Create a promise that rejects when the signal is aborted
    if (signal) {
      return Promise.race([
        tool.handler(params, executionContext),
        new Promise((_, reject) => {
          // If already aborted, reject immediately
          if (signal.aborted) {
            reject(new Error('Execution aborted by signal'));
            return;
          }
          
          // Otherwise, set up the abort listener
          const abortHandler = () => {
            reject(new Error('Execution aborted by signal'));
          };
          
          signal.addEventListener('abort', abortHandler, { once: true });
        })
      ]);
    }
    
    // If no signal, just execute the handler
    return tool.handler(params, executionContext);
  }
  
  /**
   * Format execution result
   * @param result - Raw execution result
   * @param context - Execution context
   * @returns Formatted result
   */
  private async formatResult(result: any, context: ExecutionContext): Promise<any> {
    // Create result object
    const toolResult: ToolExecutionResult = {
      data: result,
      status: 'success'
    };
    
    // Detect best format if none specified
    const format = context.options?.format || ResultFormatter.detectFormat(toolResult);
    
    // Format result
    return ResultFormatter.format(toolResult, format);
  }
  
  /**
   * Run after execution hooks
   * @param context - Execution context
   * @param result - Execution result
   */
  private async afterExecution(
    context: ExecutionContext,
    result: any
  ): Promise<void> {
    // Ensure result is not undefined for the event
    const eventResult = result === undefined ? null : result;
    
    // Emit completed event
    this.events.trigger('toolExecution:completed', {
      toolName: context.tool.name,
      params: context.params,
      result: eventResult,
      timestamp: Date.now()
    });
  }
  
  /**
   * Handle execution error
   * @param context - Execution context
   * @param error - Error result
   */
  private async handleError(
    context: ExecutionContext,
    error: ToolExecutionResult
  ): Promise<void> {
    // Emit error event
    this.events.trigger('toolExecution:error', {
      toolName: context.tool.name,
      params: context.params,
      error: error.error,
      metadata: error.metadata,
      timestamp: Date.now()
    });
  }
  
  /**
   * Create standard pipeline
   * @param app - Obsidian app instance
   * @param events - Event bus
   * @returns Standard pipeline instance
   */
  public static createStandardPipeline(app: App, events: Events): ExecutionPipeline {
    return new ExecutionPipeline(app, events);
  }
}
