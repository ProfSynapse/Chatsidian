/**
 * Execution Utilities
 *
 * This file provides utility functions for tool execution,
 * including timeout handling, cancellation, and context merging.
 */

import { ToolCall } from '../ToolManagerInterface';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create an AbortController with optional timeout
 * @param timeoutMs - Optional timeout in milliseconds
 * @returns AbortController
 */
export function createAbortController(timeoutMs?: number): AbortController {
  const controller = new AbortController();
  
  if (timeoutMs && timeoutMs > 0) {
    // Use globalThis.setTimeout in case we're in Node or browser
    const timer = (globalThis as any).setTimeout(() => {
      if (!controller.signal.aborted) {
        controller.abort(new Error(`Operation timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    // Clean up timer when aborted
    controller.signal.addEventListener('abort', () => {
      (globalThis as any).clearTimeout(timer);
    }, { once: true });
  }
  
  return controller;
}

/**
 * Execute a function with timeout
 * @param fn - Function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param args - Arguments to pass to the function
 * @returns Promise resolving to the function result
 */
export async function executeWithTimeout<T>(
  fn: (...args: any[]) => Promise<T>,
  timeoutMs: number,
  ...args: any[]
): Promise<T> {
  const controller = createAbortController(timeoutMs);
  const resultPromise = fn(...args);
  
  try {
    // Race the function against the timeout
    return await Promise.race([
      resultPromise,
      new Promise<T>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(controller.signal.reason);
        });
      })
    ]);
  } finally {
    controller.abort();
  }
}

/**
 * Deep clone an object
 * @param obj - Object to clone
 * @returns Cloned object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Create a tool call with default values
 * @param name - Tool name
 * @param args - Tool arguments
 * @param id - Optional ID (generated if not provided)
 * @returns Tool call
 */
export function createToolCall(name: string, args: any, id?: string): ToolCall {
  return {
    id: id || generateId(),
    name,
    arguments: args,
    status: 'pending',
    createdAt: Date.now()
  };
}

/**
 * Generate a unique ID using UUID v4
 * @returns Random UUID
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Format error for display
 * @param error - Error to format
 * @returns Formatted error message
 */
export function formatError(error: any): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Merge tool contexts
 * @param baseContext - Base context
 * @param additionalContext - Additional context to merge
 * @returns Merged context
 */
export function mergeToolContexts(baseContext?: any, additionalContext?: any): any {
  if (!baseContext) {
    return additionalContext || {};
  }
  
  if (!additionalContext) {
    return baseContext;
  }
  
  return {
    ...baseContext,
    ...additionalContext
  };
}
