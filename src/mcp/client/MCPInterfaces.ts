/**
 * MCP Client Interfaces
 * 
 * This file defines the core interfaces for the Model Context Protocol (MCP) client,
 * which enables communication between Obsidian and AI models.
 */

/**
 * Message role types
 */
export enum MessageRole {
  System = 'system',
  User = 'user',
  Assistant = 'assistant',
  Tool = 'tool'
}

/**
 * Base message interface
 */
export interface Message {
  /**
   * Message role
   */
  role: MessageRole;
  
  /**
   * Message content
   */
  content: string;
  
  /**
   * Optional message ID
   */
  id?: string;
  
  /**
   * Optional timestamp
   */
  timestamp?: number;
}

/**
 * Tool call from AI assistant
 */
export interface ToolCall {
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
  arguments: Record<string, any>;
  
  /**
   * Optional status
   */
  status?: 'pending' | 'running' | 'success' | 'error' | 'cancelled';
  
  /**
   * Optional error message
   */
  error?: string;
}

/**
 * Tool result
 */
export interface ToolResult {
  /**
   * Tool call ID this result is for
   */
  tool_call_id: string;
  
  /**
   * Result content
   */
  content: string;
  
  /**
   * Optional status
   */
  status?: 'success' | 'error';
  
  /**
   * Optional error message
   */
  error?: string;
}

/**
 * Assistant message with tool calls
 */
export interface AssistantMessage extends Message {
  /**
   * Role must be assistant
   */
  role: MessageRole.Assistant;
  
  /**
   * Optional tool calls
   */
  tool_calls?: ToolCall[];
}

/**
 * Tool message with result
 */
export interface ToolMessage extends Message {
  /**
   * Role must be tool
   */
  role: MessageRole.Tool;
  
  /**
   * Tool call ID this message is for
   */
  tool_call_id: string;
}

/**
 * Conversation for context management
 */
export interface Conversation {
  /**
   * Conversation ID
   */
  id: string;
  
  /**
   * Conversation title
   */
  title: string;
  
  /**
   * Messages in the conversation
   */
  messages: (Message | AssistantMessage | ToolMessage)[];
  
  /**
   * Metadata for the conversation
   */
  metadata?: Record<string, any>;
  
  /**
   * Creation timestamp
   */
  createdAt?: number;
  
  /**
   * Last updated timestamp
   */
  updatedAt?: number;
}

/**
 * Options for AI model requests
 */
export interface ModelRequestOptions {
  /**
   * Model to use
   */
  model: string;
  
  /**
   * Temperature (0-1)
   */
  temperature?: number;
  
  /**
   * Maximum tokens to generate
   */
  max_tokens?: number;
  
  /**
   * Whether to stream responses
   */
  stream?: boolean;
  
  /**
   * Available tools
   */
  tools?: any[];
  
  /**
   * System prompt override
   */
  systemPrompt?: string;
  
  /**
   * Additional model-specific parameters
   */
  additionalParams?: Record<string, any>;
}

/**
 * Interface for AI provider adapters
 */
export interface ProviderAdapter {
  /**
   * Send a message to the AI provider
   * @param messages - Messages for context
   * @param options - Request options
   * @returns Promise resolving to the response
   */
  sendMessage(
    messages: (Message | AssistantMessage | ToolMessage)[],
    options: ModelRequestOptions
  ): Promise<AssistantMessage>;
  
  /**
   * Stream a message from the AI provider
   * @param messages - Messages for context
   * @param options - Request options
   * @param onChunk - Callback for each chunk
   * @returns Promise resolving to the complete response
   */
  streamMessage(
    messages: (Message | AssistantMessage | ToolMessage)[],
    options: ModelRequestOptions,
    onChunk: (chunk: any) => void
  ): Promise<AssistantMessage>;
  
  /**
   * Test the connection to the provider
   * @returns Promise resolving to whether the connection is valid
   */
  testConnection(): Promise<boolean>;
  
  /**
   * Get available models from the provider
   * @returns Promise resolving to array of model IDs
   */
  getAvailableModels(): Promise<string[]>;
}

/**
 * Interface for the MCP client
 */
export interface IMCPClient {
  /**
   * Initialize the client
   * @returns Promise resolving when initialization is complete
   */
  initialize(): Promise<void>;
  
  /**
   * Send a message to the AI provider
   * @param conversation - Conversation for context
   * @param message - Message to send
   * @param options - Request options
   * @returns Promise resolving to the assistant's response
   */
  sendMessage(
    conversation: Conversation,
    message: Message,
    options?: Partial<ModelRequestOptions>
  ): Promise<AssistantMessage>;
  
  /**
   * Stream a message from the AI provider
   * @param conversation - Conversation for context
   * @param message - Message to send
   * @param options - Request options
   * @param onChunk - Callback for each chunk
   * @returns Promise resolving to the complete response
   */
  streamMessage(
    conversation: Conversation,
    message: Message,
    options?: Partial<ModelRequestOptions>,
    onChunk?: (chunk: any) => void
  ): Promise<AssistantMessage>;
  
  /**
   * Process tool calls in an assistant message
   * @param conversation - Conversation for context
   * @param message - Assistant message with tool calls
   * @returns Promise resolving when tool calls are processed
   */
  processToolCalls(
    conversation: Conversation,
    message: AssistantMessage
  ): Promise<void>;
  
  /**
   * Get the current provider adapter
   * @returns Current provider adapter
   */
  getProvider(): ProviderAdapter;
  
  /**
   * Set the provider adapter
   * @param provider - Provider adapter to use
   */
  setProvider(provider: ProviderAdapter): void;
  
  /**
   * Generate a system prompt for the conversation
   * @param conversation - Conversation to generate prompt for
   * @param customInstructions - Optional custom instructions to include
   * @returns Generated system prompt
   */
  generateSystemPrompt(
    conversation: Conversation,
    customInstructions?: string
  ): string;
}

/**
 * Events emitted by the MCP client
 */
export enum MCPEventType {
  SendingMessage = 'mcp:sendingMessage',
  ReceivedMessage = 'mcp:receivedMessage',
  StreamingStart = 'mcp:streamingStart',
  StreamingChunk = 'mcp:streamingChunk',
  StreamingEnd = 'mcp:streamingEnd',
  ToolCallStart = 'mcp:toolCallStart',
  ToolCallComplete = 'mcp:toolCallComplete',
  Error = 'mcp:error'
}

/**
 * Base event interface
 */
export interface MCPEvent {
  /**
   * Conversation ID
   */
  conversationId: string;
  
  /**
   * Timestamp
   */
  timestamp?: number;
}

/**
 * Message event interface
 */
export interface MCPMessageEvent extends MCPEvent {
  /**
   * Message
   */
  message: Message | AssistantMessage | ToolMessage;
}

/**
 * Chunk event interface
 */
export interface MCPChunkEvent extends MCPEvent {
  /**
   * Chunk data
   */
  chunk: any;
}

/**
 * Tool call event interface
 */
export interface MCPToolCallEvent extends MCPEvent {
  /**
   * Message ID
   */
  messageId?: string;
  
  /**
   * Tool call
   */
  toolCall: ToolCall;
}

/**
 * Error event interface
 */
export interface MCPErrorEvent extends MCPEvent {
  /**
   * Error
   */
  error: Error | string;
}