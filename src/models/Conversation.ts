/**
 * Models related to conversations and messages in the Chatsidian plugin.
 * Defines the core data structures for representing chat interactions,
 * including conversations, messages, roles, and tool usage.
 * Also provides utility functions for creating and managing these structures.
 */

import { TFile } from 'obsidian';

/**
 * Represents a conversation between a user and an AI assistant.
 * This is the main container for a chat session.
 */
export interface Conversation {
  /** Unique identifier for the conversation */
  id: string;

  /** Display title for the conversation */
  title: string;

  /** Timestamp when the conversation was created (Unix epoch milliseconds) */
  createdAt: number;

  /** Timestamp when the conversation was last modified (Unix epoch milliseconds) */
  modifiedAt: number;

  /** Array of messages in the conversation, ordered chronologically */
  messages: Message[];

  /** Optional metadata for the conversation (e.g., tags, context, associated notes) */
  metadata?: Record<string, any>;

  /** Optional reference to the Obsidian file where this conversation is stored */
  file?: TFile;

  /** Optional path within the vault where this conversation is stored */
  path?: string;
  
  /** Optional folder ID that this conversation belongs to */
  folderId?: string | null;
  
  /** Optional array of tags for this conversation */
  tags?: string[];
  
  /** Whether this conversation is starred/favorited */
  isStarred?: boolean;
}

/**
 * Represents a folder for organizing conversations
 */
export interface ConversationFolder {
  /** Unique identifier for the folder */
  id: string;
  
  /** Display name for the folder */
  name: string;
  
  /** Optional parent folder ID for nested folders */
  parentId?: string | null;
  
  /** Timestamp when the folder was created (Unix epoch milliseconds) */
  createdAt: number;
  
  /** Timestamp when the folder was last modified (Unix epoch milliseconds) */
  modifiedAt?: number;
  
  /** Optional metadata for the folder */
  metadata?: Record<string, any>;
}

/**
 * Enum for message roles in a conversation, indicating the sender.
 */
export enum MessageRole {
  User = 'user',
  Assistant = 'assistant',
  System = 'system',
}

/**
 * Represents a single message within a conversation.
 */
export interface Message {
  /** Unique identifier for the message */
  id: string;

  /** The role of the message sender */
  role: MessageRole;

  /** The textual content of the message */
  content: string;

  /** Timestamp when the message was sent (Unix epoch milliseconds) */
  timestamp: number;

  /** Optional array of tool calls made by the assistant in this message */
  toolCalls?: ToolCall[];

  /** Optional array of results corresponding to tool calls */
  toolResults?: ToolResult[];
}

/**
 * Represents a tool call requested by the AI assistant.
 */
export interface ToolCall {
  /** Unique identifier for the tool call instance */
  id: string;

  /** The name of the tool being called (e.g., 'NoteManager.createNote') */
  name: string;

  /** The arguments passed to the tool, typically as a JSON object */
  arguments: any;

  /** The current status of the tool call */
  status: 'pending' | 'success' | 'error';
}

/**
 * Represents the result returned from executing a tool call.
 */
export interface ToolResult {
  /** Unique identifier for the result */
  id: string;

  /** The ID of the tool call this result corresponds to */
  toolCallId: string;

  /** The content returned by the tool, can be any serializable type */
  content: any;

  /** Optional error message if the tool call failed */
  error?: string;
}

/**
 * Provides utility functions for creating and managing Conversation and Message objects.
 */
export class ConversationUtils {
  /**
   * Creates a new Conversation object with default values and generated IDs.
   * @param title Optional title for the new conversation. Defaults to a timestamped title.
   * @returns A new Conversation object.
   */
  static createNew(title?: string): Conversation {
    const id = this.generateId();
    const now = Date.now();

    return {
      id,
      title: title || `New Conversation (${new Date(now).toLocaleString()})`,
      createdAt: now,
      modifiedAt: now,
      messages: [],
      folderId: null,
      tags: [],
      isStarred: false
    };
  }

  /**
   * Creates a new Message object with a generated ID and current timestamp.
   * @param role The role of the message sender (User, Assistant, System).
   * @param content The textual content of the message.
   * @returns A new Message object.
   */
  static createMessage(role: MessageRole, content: string): Message {
    const id = this.generateId();

    return {
      id,
      role,
      content,
      timestamp: Date.now(),
    };
  }

  /**
   * Adds a new message to a conversation immutably.
   * Updates the conversation's modifiedAt timestamp.
   * @param conversation The conversation to add the message to.
   * @param message The message to add.
   * @returns A new Conversation object with the added message.
   */
  static addMessage(conversation: Conversation, message: Message): Conversation {
    return {
      ...conversation,
      messages: [...conversation.messages, message],
      modifiedAt: Date.now(),
    };
  }
  
  /**
   * Creates a new ConversationFolder object with default values and generated IDs.
   * @param name The name of the folder.
   * @param parentId Optional parent folder ID for nested folders.
   * @returns A new ConversationFolder object.
   */
  static createFolder(name: string, parentId?: string): ConversationFolder {
    const id = this.generateId();
    const now = Date.now();
    
    return {
      id,
      name,
      parentId: parentId || null,
      createdAt: now,
      modifiedAt: now
    };
  }

  /**
   * Generates a unique ID combining timestamp and random string.
   * @returns A unique string identifier.
   */
  private static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  }
}
