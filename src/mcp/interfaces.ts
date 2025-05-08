/**
 * MCP Core Interfaces
 * Contains type definitions and interfaces for the Model Context Protocol
 */

/**
 * Interface for a Bounded Context Pack (BCP)
 * A BCP provides domain-specific functionality to the plugin
 */
export interface BoundedContextPack {
  /**
   * Domain name for the pack (unique identifier)
   */
  domain: string;
  
  /**
   * Human-readable description of the pack
   */
  description: string;
  
  /**
   * Array of tools included in the pack
   */
  tools: Tool[];
  
  /**
   * Optional version number
   */
  version?: string;
  
  /**
   * Optional dependencies on other BCPs
   */
  dependencies?: string[];
  
  /**
   * Load handler - called when the BCP is loaded
   */
  onload?: () => Promise<void>;
  
  /**
   * Unload handler - called when the BCP is unloaded
   */
  onunload?: () => Promise<void>;
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
    executionTime?: number;
    
    /**
     * Error type (if status is error)
     */
    errorType?: string;
    
    /**
     * Error stack (if status is error)
     */
    errorStack?: string;
    
    /**
     * Additional metadata
     */
    [key: string]: any;
  };
}

/**
 * Tool execution options
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
}

/**
 * Tool call metadata
 */
export interface ToolCallMetadata {
  /**
   * Tool call ID
   */
  id: string;
  
  /**
   * Tool name
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
  status: 'pending' | 'running' | 'completed' | 'error' | 'cancelled';
  
  /**
   * Error message (if status is error)
   */
  error?: string;
}

/**
 * Tool validation result
 */
export interface ValidationResult {
  /**
   * Whether validation passed
   */
  valid: boolean;
  
  /**
   * Validation errors (if valid is false)
   */
  errors?: string[];
  
  /**
   * Validated parameters (if valid is true)
   */
  params?: any;
}

/**
 * Tool definition
 */
export interface Tool {
  /**
   * Tool name
   */
  name: string;
  
  /**
   * Tool description
   */
  description: string;
  
  /**
   * Tool handler function
   * @param params - Tool parameters
   * @param context - Tool execution context
   * @returns Promise resolving to tool result
   */
  handler: (params: any, context?: Record<string, any>) => Promise<any>;
  
  /**
   * Tool parameter schema
   */
  schema: any;
  
  /**
   * Tool display icon
   */
  icon?: string;
  
  /**
   * Tool display options
   */
  display?: {
    /**
     * Whether to show in suggestions
     */
    showInSuggestions?: boolean;
    
    /**
     * Sort order in suggestions
     */
    sortOrder?: number;
  };
}
