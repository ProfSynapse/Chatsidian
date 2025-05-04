/**
 * Custom error classes for the storage system.
 * 
 * This file provides specialized error classes for storage operations,
 * allowing for more detailed error handling and reporting.
 */

/**
 * Base error class for storage errors.
 */
export class StorageError extends Error {
  /**
   * Create a new StorageError.
   * @param message Error message
   */
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
    
    // This is necessary for proper instanceof checks with custom Error subclasses
    Object.setPrototypeOf(this, StorageError.prototype);
  }
}

/**
 * Error when a conversation is not found.
 */
export class ConversationNotFoundError extends StorageError {
  /**
   * Conversation ID.
   */
  public conversationId: string;
  
  /**
   * Create a new ConversationNotFoundError.
   * @param conversationId Conversation ID
   */
  constructor(conversationId: string) {
    super(`Conversation ${conversationId} not found`);
    this.name = 'ConversationNotFoundError';
    this.conversationId = conversationId;
    
    Object.setPrototypeOf(this, ConversationNotFoundError.prototype);
  }
}

/**
 * Error when a message is not found.
 */
export class MessageNotFoundError extends StorageError {
  /**
   * Conversation ID.
   */
  public conversationId: string;
  
  /**
   * Message ID.
   */
  public messageId: string;
  
  /**
   * Create a new MessageNotFoundError.
   * @param conversationId Conversation ID
   * @param messageId Message ID
   */
  constructor(conversationId: string, messageId: string) {
    super(`Message ${messageId} not found in conversation ${conversationId}`);
    this.name = 'MessageNotFoundError';
    this.conversationId = conversationId;
    this.messageId = messageId;
    
    Object.setPrototypeOf(this, MessageNotFoundError.prototype);
  }
}

/**
 * Error when a folder operation fails.
 */
export class FolderOperationError extends StorageError {
  /**
   * Path to the folder.
   */
  public path: string;
  
  /**
   * Create a new FolderOperationError.
   * @param path Path to the folder
   * @param message Error message
   */
  constructor(path: string, message: string) {
    super(`Folder operation failed for ${path}: ${message}`);
    this.name = 'FolderOperationError';
    this.path = path;
    
    Object.setPrototypeOf(this, FolderOperationError.prototype);
  }
}

/**
 * Error when a file operation fails.
 */
export class FileOperationError extends StorageError {
  /**
   * Path to the file.
   */
  public path: string;
  
  /**
   * Create a new FileOperationError.
   * @param path Path to the file
   * @param message Error message
   */
  constructor(path: string, message: string) {
    super(`File operation failed for ${path}: ${message}`);
    this.name = 'FileOperationError';
    this.path = path;
    
    Object.setPrototypeOf(this, FileOperationError.prototype);
  }
}

/**
 * Error when parsing JSON fails.
 */
export class JsonParseError extends StorageError {
  /**
   * Create a new JsonParseError.
   * @param message Error message
   */
  constructor(message: string) {
    super(`Failed to parse JSON: ${message}`);
    this.name = 'JsonParseError';
    
    Object.setPrototypeOf(this, JsonParseError.prototype);
  }
}

/**
 * Error when importing/exporting fails.
 */
export class ImportExportError extends StorageError {
  /**
   * Create a new ImportExportError.
   * @param message Error message
   */
  constructor(message: string) {
    super(`Import/export operation failed: ${message}`);
    this.name = 'ImportExportError';
    
    Object.setPrototypeOf(this, ImportExportError.prototype);
  }
}
