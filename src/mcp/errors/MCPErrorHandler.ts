/**
 * MCP Error Handler
 * 
 * This file implements the MCP Error Handler component, which provides
 * advanced error handling, recovery strategies, and error reporting for MCP operations.
 */

import { Component, Events, Notice } from 'obsidian';
import { EventBus } from '../../core/EventBus';
import { MCPEventType, MCPErrorEvent } from '../client/MCPInterfaces';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  /**
   * Debug level - informational errors
   */
  Debug = 'debug',
  
  /**
   * Info level - non-critical errors
   */
  Info = 'info',
  
  /**
   * Warning level - potential issues
   */
  Warning = 'warning',
  
  /**
   * Error level - operational errors
   */
  Error = 'error',
  
  /**
   * Critical level - severe errors
   */
  Critical = 'critical',
  
  /**
   * Fatal level - unrecoverable errors
   */
  Fatal = 'fatal'
}

/**
 * Error category
 */
export enum ErrorCategory {
  /**
   * Network errors
   */
  Network = 'network',
  
  /**
   * Authentication errors
   */
  Authentication = 'authentication',
  
  /**
   * Authorization errors
   */
  Authorization = 'authorization',
  
  /**
   * Validation errors
   */
  Validation = 'validation',
  
  /**
   * Resource errors
   */
  Resource = 'resource',
  
  /**
   * Tool execution errors
   */
  ToolExecution = 'tool-execution',
  
  /**
   * Provider errors
   */
  Provider = 'provider',
  
  /**
   * Schema errors
   */
  Schema = 'schema',
  
  /**
   * Timeout errors
   */
  Timeout = 'timeout',
  
  /**
   * Internal errors
   */
  Internal = 'internal',
  
  /**
   * Unknown errors
   */
  Unknown = 'unknown'
}

/**
 * Recovery strategy
 */
export enum RecoveryStrategy {
  /**
   * No recovery - fail immediately
   */
  None = 'none',
  
  /**
   * Retry the operation
   */
  Retry = 'retry',
  
  /**
   * Fallback to an alternative
   */
  Fallback = 'fallback',
  
  /**
   * Circuit breaker - prevent cascading failures
   */
  CircuitBreaker = 'circuit-breaker',
  
  /**
   * Graceful degradation - continue with reduced functionality
   */
  GracefulDegradation = 'graceful-degradation'
}

/**
 * Error code
 */
export enum ErrorCode {
  // Network errors (1000-1099)
  NetworkUnavailable = 1000,
  ConnectionTimeout = 1001,
  RequestFailed = 1002,
  ResponseInvalid = 1003,
  
  // Authentication errors (1100-1199)
  AuthenticationFailed = 1100,
  InvalidCredentials = 1101,
  TokenExpired = 1102,
  
  // Authorization errors (1200-1299)
  AuthorizationFailed = 1200,
  InsufficientPermissions = 1201,
  ResourceForbidden = 1202,
  
  // Validation errors (1300-1399)
  ValidationFailed = 1300,
  InvalidParameters = 1301,
  SchemaViolation = 1302,
  
  // Resource errors (1400-1499)
  ResourceNotFound = 1400,
  ResourceUnavailable = 1401,
  ResourceConflict = 1402,
  
  // Tool execution errors (1500-1599)
  ToolExecutionFailed = 1500,
  ToolNotFound = 1501,
  ToolTimeout = 1502,
  
  // Provider errors (1600-1699)
  ProviderUnavailable = 1600,
  ProviderRateLimited = 1601,
  ProviderError = 1602,
  
  // Schema errors (1700-1799)
  SchemaInvalid = 1700,
  SchemaValidationFailed = 1701,
  
  // Timeout errors (1800-1899)
  OperationTimeout = 1800,
  StreamingTimeout = 1801,
  
  // Internal errors (1900-1999)
  InternalError = 1900,
  UnexpectedError = 1901,
  
  // Unknown errors (2000+)
  UnknownError = 2000
}

/**
 * Error details
 */
export interface ErrorDetails {
  /**
   * Error code
   */
  code: ErrorCode;
  
  /**
   * Error message
   */
  message: string;
  
  /**
   * Error category
   */
  category: ErrorCategory;
  
  /**
   * Error severity
   */
  severity: ErrorSeverity;
  
  /**
   * Original error
   */
  originalError?: Error | string;
  
  /**
   * Error timestamp
   */
  timestamp: number;
  
  /**
   * Error context
   */
  context?: {
    /**
     * Conversation ID
     */
    conversationId?: string;
    
    /**
     * Operation name
     */
    operation?: string;
    
    /**
     * Additional context
     */
    [key: string]: any;
  };
  
  /**
   * Recovery strategy
   */
  recoveryStrategy?: RecoveryStrategy;
  
  /**
   * Recovery attempts
   */
  recoveryAttempts?: number;
  
  /**
   * Maximum recovery attempts
   */
  maxRecoveryAttempts?: number;
  
  /**
   * Whether the error was handled
   */
  handled?: boolean;
  
  /**
   * User-friendly message
   */
  userMessage?: string;
  
  /**
   * Troubleshooting steps
   */
  troubleshootingSteps?: string[];
}

/**
 * Error handling options
 */
export interface ErrorHandlingOptions {
  /**
   * Whether to show a notification
   */
  showNotification?: boolean;
  
  /**
   * Whether to log to console
   */
  logToConsole?: boolean;
  
  /**
   * Whether to emit events
   */
  emitEvents?: boolean;
  
  /**
   * Whether to attempt recovery
   */
  attemptRecovery?: boolean;
  
  /**
   * Maximum recovery attempts
   */
  maxRecoveryAttempts?: number;
  
  /**
   * Recovery strategy
   */
  recoveryStrategy?: RecoveryStrategy;
  
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
 * Circuit breaker state
 */
export enum CircuitBreakerState {
  /**
   * Circuit is closed (normal operation)
   */
  Closed = 'closed',
  
  /**
   * Circuit is open (failing)
   */
  Open = 'open',
  
  /**
   * Circuit is half-open (testing recovery)
   */
  HalfOpen = 'half-open'
}

/**
 * Circuit breaker
 */
interface CircuitBreaker {
  /**
   * Circuit key (operation or resource)
   */
  key: string;
  
  /**
   * Current state
   */
  state: CircuitBreakerState;
  
  /**
   * Failure count
   */
  failureCount: number;
  
  /**
   * Success count (for half-open state)
   */
  successCount: number;
  
  /**
   * Last failure timestamp
   */
  lastFailure: number;
  
  /**
   * Last state change timestamp
   */
  lastStateChange: number;
  
  /**
   * Failure threshold
   */
  failureThreshold: number;
  
  /**
   * Reset timeout in milliseconds
   */
  resetTimeout: number;
  
  /**
   * Success threshold (for half-open state)
   */
  successThreshold: number;
}

/**
 * Default error handling options
 */
const DEFAULT_ERROR_HANDLING_OPTIONS: ErrorHandlingOptions = {
  showNotification: true,
  logToConsole: true,
  emitEvents: true,
  attemptRecovery: true,
  maxRecoveryAttempts: 3,
  recoveryStrategy: RecoveryStrategy.Retry,
  retryDelay: 1000,
  useExponentialBackoff: true,
  jitterFactor: 0.2
};

/**
 * MCP error handler for advanced error handling
 * Extends Component for lifecycle management
 */
export class MCPErrorHandler extends Component {
  private eventBus: EventBus;
  private events: Events = new Events();
  private options: ErrorHandlingOptions;
  private errorLog: ErrorDetails[] = [];
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  
  /**
   * Create a new MCP error handler
   * @param eventBus - Event bus for plugin-wide events
   * @param options - Error handling options
   */
  constructor(eventBus: EventBus, options: Partial<ErrorHandlingOptions> = {}) {
    super();
    this.eventBus = eventBus;
    this.options = { ...DEFAULT_ERROR_HANDLING_OPTIONS, ...options };
  }
  
  /**
   * Component lifecycle method - called when component is loaded
   */
  onload(): void {
    console.log('MCPErrorHandler: loaded');
    
    // Register for MCP error events
    this.registerEventListeners();
    
    // Start circuit breaker check interval
    this.registerInterval(
      window.setInterval(() => this.checkCircuitBreakers(), 5000) // Check every 5 seconds
    );
  }
  
  /**
   * Component lifecycle method - called when component is unloaded
   */
  onunload(): void {
    console.log('MCPErrorHandler: unloaded');
    
    // Clean up event listeners
    this.events = new Events();
  }
  
  /**
   * Register event listeners
   */
  private registerEventListeners(): void {
    // Listen for MCP error events
    this.registerEvent(
      this.eventBus.on(MCPEventType.Error, (data: MCPErrorEvent) => {
        this.handleMCPError(data);
      })
    );
  }
  
  /**
   * Handle MCP error event
   * @param data - Error event data
   */
  private handleMCPError(data: MCPErrorEvent): void {
    const { conversationId, error } = data;
    
    // Create error details
    const errorDetails = this.createErrorDetails(error, {
      conversationId
    });
    
    // Handle error
    this.handleError(errorDetails);
  }
  
  /**
   * Create error details from an error
   * @param error - Error to process
   * @param context - Error context
   * @returns Error details
   */
  public createErrorDetails(
    error: Error | string,
    context: Record<string, any> = {}
  ): ErrorDetails {
    // Extract error message
    const errorMessage = error instanceof Error ? error.message : error;
    
    // Determine error category and code
    const { category, code, severity } = this.categorizeError(errorMessage);
    
    // Create error details
    const errorDetails: ErrorDetails = {
      code,
      message: errorMessage,
      category,
      severity,
      originalError: error,
      timestamp: Date.now(),
      context,
      recoveryStrategy: this.options.recoveryStrategy,
      recoveryAttempts: 0,
      maxRecoveryAttempts: this.options.maxRecoveryAttempts,
      handled: false,
      userMessage: this.getUserFriendlyMessage(code, errorMessage),
      troubleshootingSteps: this.getTroubleshootingSteps(code, category)
    };
    
    return errorDetails;
  }
  
  /**
   * Categorize an error
   * @param errorMessage - Error message
   * @returns Error category, code, and severity
   */
  private categorizeError(errorMessage: string): {
    category: ErrorCategory;
    code: ErrorCode;
    severity: ErrorSeverity;
  } {
    const lowerMessage = errorMessage.toLowerCase();
    
    // Network errors
    if (
      lowerMessage.includes('network') ||
      lowerMessage.includes('connection') ||
      lowerMessage.includes('offline') ||
      lowerMessage.includes('unreachable')
    ) {
      return {
        category: ErrorCategory.Network,
        code: ErrorCode.NetworkUnavailable,
        severity: ErrorSeverity.Error
      };
    }
    
    // Timeout errors
    if (
      lowerMessage.includes('timeout') ||
      lowerMessage.includes('timed out')
    ) {
      return {
        category: ErrorCategory.Timeout,
        code: ErrorCode.OperationTimeout,
        severity: ErrorSeverity.Warning
      };
    }
    
    // Authentication errors
    if (
      lowerMessage.includes('authentication') ||
      lowerMessage.includes('unauthenticated') ||
      lowerMessage.includes('api key') ||
      lowerMessage.includes('credentials')
    ) {
      return {
        category: ErrorCategory.Authentication,
        code: ErrorCode.AuthenticationFailed,
        severity: ErrorSeverity.Error
      };
    }
    
    // Default to unknown
    return {
      category: ErrorCategory.Unknown,
      code: ErrorCode.UnknownError,
      severity: ErrorSeverity.Error
    };
  }
  
  /**
   * Get a user-friendly error message
   * @param code - Error code
   * @param errorMessage - Original error message
   * @returns User-friendly message
   */
  private getUserFriendlyMessage(code: ErrorCode, errorMessage: string): string {
    switch (code) {
      case ErrorCode.NetworkUnavailable:
        return 'Unable to connect to the server. Please check your internet connection.';
        
      case ErrorCode.ConnectionTimeout:
        return 'The connection timed out. Please try again later.';
        
      case ErrorCode.AuthenticationFailed:
        return 'Authentication failed. Please check your API key or credentials.';
        
      default:
        // Sanitize error message for user display
        return errorMessage.replace(/\b(api|key|token|secret|password)\b/gi, '***');
    }
  }
  
  /**
   * Get troubleshooting steps for an error
   * @param code - Error code
   * @param category - Error category
   * @returns Troubleshooting steps
   */
  private getTroubleshootingSteps(code: ErrorCode, category: ErrorCategory): string[] {
    switch (category) {
      case ErrorCategory.Network:
        return [
          'Check your internet connection',
          'Verify that the server is reachable',
          'Try again later'
        ];
        
      case ErrorCategory.Authentication:
        return [
          'Verify your API key or credentials',
          'Check if your API key has expired',
          'Generate a new API key if necessary'
        ];
        
      default:
        return [
          'Try the operation again',
          'Check the application logs for more details',
          'Contact support if the issue persists'
        ];
    }
  }
  
  /**
   * Handle an error
   * @param errorDetails - Error details
   * @param options - Error handling options (overrides defaults)
   * @returns Promise resolving to whether the error was handled
   */
  public async handleError(
    errorDetails: ErrorDetails,
    options: Partial<ErrorHandlingOptions> = {}
  ): Promise<boolean> {
    // Merge options
    const mergedOptions: ErrorHandlingOptions = {
      ...this.options,
      ...options
    };
    
    // Add to error log
    this.errorLog.push(errorDetails);
    
    // Trim error log if too large
    if (this.errorLog.length > 100) {
      this.errorLog = this.errorLog.slice(-100);
    }
    
    // Log to console
    if (mergedOptions.logToConsole) {
      this.logErrorToConsole(errorDetails);
    }
    
    // Show notification
    if (mergedOptions.showNotification && errorDetails.userMessage) {
      new Notice(errorDetails.userMessage, 5000);
    }
    
    // Emit events
    if (mergedOptions.emitEvents) {
      this.emitErrorEvents(errorDetails);
    }
    
    // Check circuit breaker
    if (
      errorDetails.context?.operation &&
      this.isCircuitOpen(errorDetails.context.operation)
    ) {
      // Circuit is open, don't attempt recovery
      errorDetails.handled = true;
      errorDetails.recoveryStrategy = RecoveryStrategy.CircuitBreaker;
      
      // Emit circuit breaker event
      this.events.trigger('mcpErrorHandler:circuitBreakerTripped', {
        operation: errorDetails.context.operation,
        error: errorDetails
      });
      
      return true;
    }
    
    // Attempt recovery
    if (mergedOptions.attemptRecovery) {
      const recovered = await this.attemptRecovery(errorDetails, mergedOptions);
      
      if (recovered) {
        errorDetails.handled = true;
        return true;
      }
    }
    
    // Update circuit breaker
    if (errorDetails.context?.operation) {
      this.recordFailure(errorDetails.context.operation);
    }
    
    // Mark as handled
    errorDetails.handled = true;
    
    return false;
  }
  
  /**
   * Log an error to the console
   * @param errorDetails - Error details
   */
  private logErrorToConsole(errorDetails: ErrorDetails): void {
    const { code, message, category, severity, context } = errorDetails;
    
    console.group(`[MCP Error] ${category} (${code}): ${message}`);
    console.error('Error details:', errorDetails);
    
    if (errorDetails.originalError instanceof Error) {
      console.error('Original error:', errorDetails.originalError);
      console.error('Stack trace:', errorDetails.originalError.stack);
    }
    
    console.groupEnd();
  }
  
  /**
   * Emit error events
   * @param errorDetails - Error details
   */
  private emitErrorEvents(errorDetails: ErrorDetails): void {
    // Emit to internal events
    this.events.trigger('mcpErrorHandler:error', errorDetails);
    
    // Emit category-specific event
    this.events.trigger(`mcpErrorHandler:${errorDetails.category}Error`, errorDetails);
    
    // Emit severity-specific event
    this.events.trigger(`mcpErrorHandler:${errorDetails.severity}Error`, errorDetails);
    
    // Emit to event bus
    this.eventBus.emit('mcpErrorHandler:error', errorDetails);
  }
  
  /**
   * Attempt to recover from an error
   * @param errorDetails - Error details
   * @param options - Error handling options
   * @returns Promise resolving to whether recovery was successful
   */
  private async attemptRecovery(
    errorDetails: ErrorDetails,
    options: ErrorHandlingOptions
  ): Promise<boolean> {
    // Check if recovery is possible
    if (
      !options.attemptRecovery ||
      !options.recoveryStrategy ||
      options.recoveryStrategy === RecoveryStrategy.None ||
      !errorDetails.context?.operation
    ) {
      return false;
    }
    
    // Check recovery attempts
    if (
      errorDetails.recoveryAttempts !== undefined &&
      options.maxRecoveryAttempts !== undefined &&
      errorDetails.recoveryAttempts >= options.maxRecoveryAttempts
    ) {
      // Too many attempts
      this.events.trigger('mcpErrorHandler:recoveryExhausted', {
        operation: errorDetails.context.operation,
        attempts: errorDetails.recoveryAttempts,
        error: errorDetails
      });
      
      return false;
    }
    
    // Increment recovery attempts
    errorDetails.recoveryAttempts = (errorDetails.recoveryAttempts || 0) + 1;
    
    // Apply recovery strategy
    switch (options.recoveryStrategy) {
      case RecoveryStrategy.Retry:
        return this.applyRetryStrategy(errorDetails, options);
        
      case RecoveryStrategy.Fallback:
        return this.applyFallbackStrategy(errorDetails);
        
      case RecoveryStrategy.CircuitBreaker:
        return this.applyCircuitBreakerStrategy(errorDetails);
        
      case RecoveryStrategy.GracefulDegradation:
        return this.applyGracefulDegradationStrategy(errorDetails);
        
      default:
        return false;
    }
  }
  
  /**
   * Apply retry strategy
   * @param errorDetails - Error details
   * @param options - Error handling options
   * @returns Promise resolving to whether retry was successful
   */
  private async applyRetryStrategy(
    errorDetails: ErrorDetails,
    options: ErrorHandlingOptions
  ): Promise<boolean> {
    // Calculate retry delay
    let delay = options.retryDelay || 1000;
    
    // Apply exponential backoff
    if (options.useExponentialBackoff && errorDetails.recoveryAttempts) {
      delay = delay * Math.pow(2, errorDetails.recoveryAttempts - 1);
    }
    
    // Apply jitter
    if (options.jitterFactor && options.jitterFactor > 0) {
      const jitter = delay * options.jitterFactor;
      delay = delay + (Math.random() * jitter * 2) - jitter;
    }
    
    // Emit retry event
    this.events.trigger('mcpErrorHandler:retrying', {
      operation: errorDetails.context?.operation,
      attempt: errorDetails.recoveryAttempts,
      delay,
      error: errorDetails
    });
    
    // Wait for delay
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // In a real implementation, we would retry the operation here
    // For now, we'll just return false to indicate that recovery failed
    return false;
  }
  
  /**
   * Apply fallback strategy
   * @param errorDetails - Error details
   * @returns Promise resolving to whether fallback was successful
   */
  private async applyFallbackStrategy(errorDetails: ErrorDetails): Promise<boolean> {
    // In a real implementation, we would use a fallback mechanism here
    // For now, we'll just return false to indicate that recovery failed
    return false;
  }
  
  /**
   * Apply circuit breaker strategy
   * @param errorDetails - Error details
   * @returns Promise resolving to whether circuit breaker was successful
   */
  private async applyCircuitBreakerStrategy(errorDetails: ErrorDetails): Promise<boolean> {
    if (!errorDetails.context?.operation) {
      return false;
    }
    
    // Get or create circuit breaker
    const circuitBreaker = this.getOrCreateCircuitBreaker(errorDetails.context.operation);
    
    // Record failure
    this.recordFailure(errorDetails.context.operation);
    
    // Check if circuit is open
    if (circuitBreaker.state === CircuitBreakerState.Open) {
      // Circuit is open, don't attempt recovery
      return false;
    }
    
    // In a real implementation, we might retry the operation if the circuit is closed or half-open
    // For now, we'll just return false to indicate that recovery failed
    return false;
  }
  
  /**
   * Apply graceful degradation strategy
   * @param errorDetails - Error details
   * @returns Promise resolving to whether graceful degradation was successful
   */
  private async applyGracefulDegradationStrategy(errorDetails: ErrorDetails): Promise<boolean> {
    // In a real implementation, we would use a graceful degradation mechanism here
    // For now, we'll just return false to indicate that recovery failed
    return false;
  }
  
  /**
   * Check if circuit is open for an operation
   * @param key - Circuit breaker key
   * @returns Whether the circuit is open
   */
  private isCircuitOpen(key: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(key);
    
    if (!circuitBreaker) {
      return false;
    }
    
    return circuitBreaker.state === CircuitBreakerState.Open;
  }
  
  /**
   * Record a failure for a circuit breaker
   * @param key - Circuit breaker key
   */
  private recordFailure(key: string): void {
    // Get or create circuit breaker
    const circuitBreaker = this.getOrCreateCircuitBreaker(key);
    
    // Update failure count and timestamp
    circuitBreaker.failureCount++;
    circuitBreaker.lastFailure = Date.now();
    circuitBreaker.successCount = 0;
    
    // Check if failure threshold is reached
    if (
      circuitBreaker.state === CircuitBreakerState.Closed &&
      circuitBreaker.failureCount >= circuitBreaker.failureThreshold
    ) {
      // Open the circuit
      circuitBreaker.state = CircuitBreakerState.Open;
      circuitBreaker.lastStateChange = Date.now();
      
      // Emit event
      this.events.trigger('mcpErrorHandler:circuitOpened', {
        key,
        failureCount: circuitBreaker.failureCount,
        failureThreshold: circuitBreaker.failureThreshold
      });
    }
  }
  
  /**
   * Record a success for a circuit breaker
   * @param key - Circuit breaker key
   */
  private recordSuccess(key: string): void {
    // Get circuit breaker
    const circuitBreaker = this.circuitBreakers.get(key);
    
    if (!circuitBreaker) {
      return;
    }
    
    // Reset failure count
    circuitBreaker.failureCount = 0;
    
    // Check if half-open circuit should be closed
    if (circuitBreaker.state === CircuitBreakerState.HalfOpen) {
      circuitBreaker.successCount++;
      
      if (circuitBreaker.successCount >= circuitBreaker.successThreshold) {
        // Close the circuit
        circuitBreaker.state = CircuitBreakerState.Closed;
        circuitBreaker.lastStateChange = Date.now();
        
        // Emit event
        this.events.trigger('mcpErrorHandler:circuitClosed', {
          key,
          successCount: circuitBreaker.successCount,
          successThreshold: circuitBreaker.successThreshold
        });
      }
    }
  }
  
  /**
   * Check circuit breakers for reset
   */
  private checkCircuitBreakers(): void {
    const now = Date.now();
    
    for (const [key, breaker] of this.circuitBreakers.entries()) {
      // Check if open circuit should be reset to half-open
      if (
        breaker.state === CircuitBreakerState.Open &&
        now - breaker.lastFailure > breaker.resetTimeout
      ) {
        // Reset to half-open
        breaker.state = CircuitBreakerState.HalfOpen;
        breaker.lastStateChange = now;
        breaker.successCount = 0;
        
        // Emit event
        this.events.trigger('mcpErrorHandler:circuitHalfOpen', {
          key,
          lastFailure: new Date(breaker.lastFailure).toISOString(),
          downtime: now - breaker.lastFailure
        });
      }
    }
  }
  
  /**
   * Get or create a circuit breaker
   * @param key - Circuit breaker key
   * @returns Circuit breaker
   */
  private getOrCreateCircuitBreaker(key: string): CircuitBreaker {
    // Check if circuit breaker exists
    if (this.circuitBreakers.has(key)) {
      return this.circuitBreakers.get(key)!;
    }
    
    // Create new circuit breaker
    const circuitBreaker: CircuitBreaker = {
      key,
      state: CircuitBreakerState.Closed,
      failureCount: 0,
      successCount: 0,
      lastFailure: 0,
      lastStateChange: Date.now(),
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      successThreshold: 2
    };
    
    // Store circuit breaker
    this.circuitBreakers.set(key, circuitBreaker);
    
    return circuitBreaker;
  }
  
  /**
   * Register event listeners
   * @param eventName - Event name
   * @param callback - Callback function
   */
  public on(eventName: string, callback: (data: any) => void): void {
    this.events.on(eventName, callback);
  }
  
  /**
   * Unregister event listeners
   * @param eventName - Event name
   * @param callback - Callback function
   */
  public off(eventName: string, callback: (data: any) => void): void {
    this.events.off(eventName, callback);
  }
}

/**
 * Create a new MCP error handler
 * @param eventBus - Event bus for plugin-wide events
 * @param options - Error handling options
 * @returns MCP error handler
 */
export function createMCPErrorHandler(
  eventBus: EventBus,
  options: Partial<ErrorHandlingOptions> = {}
): MCPErrorHandler {
  return new MCPErrorHandler(eventBus, options);
}