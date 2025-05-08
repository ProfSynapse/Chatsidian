import { PipelinePhase, ExecutionContext } from '../ToolManagerInterface';
import { ParameterValidator } from '../validation/ParameterValidator';
import { ToolExecutionResult } from '../interfaces';

/**
 * Standard pipeline phases for tool execution
 */
export class PipelinePhases {
  /**
   * Validation phase - validates tool parameters
   */
  public static validation: PipelinePhase = {
    name: 'validation',
    execute: async (context: ExecutionContext) => {
      const { tool, params } = context;
      const validator = new ParameterValidator();
      const result = validator.validate(tool.schema, params);
      
      if (!result.valid) {
        throw new Error(`Invalid parameters: ${result.errors?.join(', ')}`);
      }
    }
  };
  
  /**
   * Preparation phase - prepares execution context
   */
  public static preparation: PipelinePhase = {
    name: 'preparation',
    execute: async (context: ExecutionContext) => {
      // Set start time if not already set
      context.startTime = context.startTime || Date.now();
      
      // Update tool call status
      context.toolCall.status = 'running';
      context.toolCall.startedAt = Date.now();
      
      // Initialize result storage
      context.result = undefined;
      context.error = undefined;
    }
  };
  
  /**
   * Execution phase - executes tool handler
   */
  public static execution: PipelinePhase = {
    name: 'execution',
    execute: async (context: ExecutionContext) => {
      try {
        const { tool, params, options } = context;
        
        // Execute handler with context
        context.result = await tool.handler(params, {
          signal: options?.signal,
          ...options?.context
        });
      } catch (error) {
        // Store error and re-throw
        context.error = error as Error;
        throw error;
      }
    }
  };
  
  /**
   * Cleanup phase - performs cleanup and status updates
   */
  public static cleanup: PipelinePhase = {
    name: 'cleanup',
    execute: async (context: ExecutionContext) => {
      // Update completion status and timestamp
      context.toolCall.completedAt = Date.now();
      
      // Set final status based on execution result
      if (context.error) {
        context.toolCall.status = 'error';
        context.toolCall.error = context.error.message;
      } else {
        context.toolCall.status = 'completed';
      }
      
      // Format result if needed
      if (context.result && context.options?.format) {
        context.result = await formatResult(context.result, context.options.format);
      }
    }
  };
  
  /**
   * Get all standard phases in order
   * @returns Array of pipeline phases
   */
  public static getStandardPhases(): PipelinePhase[] {
    return [
      this.validation,
      this.preparation,
      this.execution,
      this.cleanup
    ];
  }
}

/**
 * Format result based on specified format
 * @param result - Raw result
 * @param format - Result format
 * @returns Formatted result
 */
async function formatResult(result: any, format: 'json' | 'text' | 'markdown'): Promise<any> {
  // Delegate to ResultFormatter
  const { ResultFormatter } = await import('../formatting/ResultFormatter');
  
  // Create result object with metadata
  const toolResult: ToolExecutionResult = {
    data: result,
    status: 'success',
    metadata: {
      format,
      timestamp: Date.now()
    }
  };
  
  return ResultFormatter.format(toolResult, format);
}
