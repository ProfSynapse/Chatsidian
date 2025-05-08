/**
 * VaultErrors.ts
 * 
 * This file defines custom error types for vault operations in Chatsidian.
 * These error types provide more specific information about what went wrong
 * during vault operations, allowing for better error handling and user feedback.
 * 
 * Related files:
 * - VaultFacade.ts: Implementation of the VaultFacade interface
 * - VaultFacadeInterface.ts: Interface definitions for VaultFacade
 */

/**
 * Base error class for all vault-related errors
 */
export class VaultError extends Error {
  /**
   * Create a new VaultError
   * @param message - Error message
   */
  constructor(message: string) {
    super(message);
    this.name = 'VaultError';
    
    // This is needed to make instanceof work correctly with custom errors in TypeScript
    Object.setPrototypeOf(this, VaultError.prototype);
  }
}

/**
 * Error thrown when a file is not found
 */
export class FileNotFoundError extends VaultError {
  /**
   * Path to the file that was not found
   */
  path: string;
  
  /**
   * Create a new FileNotFoundError
   * @param path - Path to the file that was not found
   */
  constructor(path: string) {
    super(`File not found: ${path}`);
    this.name = 'FileNotFoundError';
    this.path = path;
    
    Object.setPrototypeOf(this, FileNotFoundError.prototype);
  }
}

/**
 * Error thrown when a folder is not found
 */
export class FolderNotFoundError extends VaultError {
  /**
   * Path to the folder that was not found
   */
  path: string;
  
  /**
   * Create a new FolderNotFoundError
   * @param path - Path to the folder that was not found
   */
  constructor(path: string) {
    super(`Folder not found: ${path}`);
    this.name = 'FolderNotFoundError';
    this.path = path;
    
    Object.setPrototypeOf(this, FolderNotFoundError.prototype);
  }
}

/**
 * Error thrown when a file already exists
 */
export class FileExistsError extends VaultError {
  /**
   * Path to the file that already exists
   */
  path: string;
  
  /**
   * Create a new FileExistsError
   * @param path - Path to the file that already exists
   */
  constructor(path: string) {
    super(`File already exists: ${path}`);
    this.name = 'FileExistsError';
    this.path = path;
    
    Object.setPrototypeOf(this, FileExistsError.prototype);
  }
}

/**
 * Error thrown when access to a file or folder is denied
 */
export class AccessDeniedError extends VaultError {
  /**
   * Path to the file or folder that access was denied to
   */
  path: string;
  
  /**
   * Create a new AccessDeniedError
   * @param path - Path to the file or folder that access was denied to
   */
  constructor(path: string) {
    super(`Access denied: ${path}`);
    this.name = 'AccessDeniedError';
    this.path = path;
    
    Object.setPrototypeOf(this, AccessDeniedError.prototype);
  }
}

/**
 * Error thrown when a path is invalid
 */
export class InvalidPathError extends VaultError {
  /**
   * The invalid path
   */
  path: string;
  
  /**
   * Create a new InvalidPathError
   * @param path - The invalid path
   */
  constructor(path: string) {
    super(`Invalid path: ${path}`);
    this.name = 'InvalidPathError';
    this.path = path;
    
    Object.setPrototypeOf(this, InvalidPathError.prototype);
  }
}

/**
 * Error thrown when an operation fails
 */
export class OperationFailedError extends VaultError {
  /**
   * The operation that failed
   */
  operation: string;
  
  /**
   * Path to the file or folder that the operation was performed on
   */
  path: string;
  
  /**
   * Create a new OperationFailedError
   * @param operation - The operation that failed
   * @param path - Path to the file or folder that the operation was performed on
   * @param reason - Reason for the failure
   */
  constructor(operation: string, path: string, reason: string) {
    super(`Operation ${operation} failed on ${path}: ${reason}`);
    this.name = 'OperationFailedError';
    this.operation = operation;
    this.path = path;
    
    Object.setPrototypeOf(this, OperationFailedError.prototype);
  }
}
