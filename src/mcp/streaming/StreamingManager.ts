/**
 * Streaming Manager
 * 
 * This file implements the Streaming Manager component, which is responsible for
 * handling streaming responses from AI providers in an efficient and reliable manner.
 */

import { Component, Events } from 'obsidian';
import { EventBus } from '../../core/EventBus';
import { MCPEventType, MCPChunkEvent, AssistantMessage } from '../client/MCPInterfaces';

/**
 * Chunk processing strategy
 */
export enum ChunkProcessingStrategy {
  /**
   * Process chunks immediately as they arrive
   */
  Immediate = 'immediate',
  
  /**
   * Buffer chunks and process in batches
   */
  Buffered = 'buffered',
  
  /**
   * Debounce processing to reduce UI updates
   */
  Debounced = 'debounced'
}

/**
 * Streaming options
 */
export interface StreamingOptions {
  /**
   * Chunk processing strategy
   */
  processingStrategy?: ChunkProcessingStrategy;
  
  /**
   * Buffer size for buffered processing
   */
  bufferSize?: number;
  
  /**
   * Debounce interval in milliseconds
   */
  debounceInterval?: number;
  
  /**
   * Maximum time to wait for chunks in milliseconds
   */
  streamingTimeout?: number;
  
  /**
   * Whether to emit detailed events for debugging
   */
  debugEvents?: boolean;
}

/**
 * Streaming status
 */
export enum StreamingStatus {
  Idle = 'idle',
  Streaming = 'streaming',
  Paused = 'paused',
  Completed = 'completed',
  Error = 'error'
}

/**
 * Streaming session
 */
export interface StreamingSession {
  /**
   * Session ID
   */
  id: string;
  
  /**
   * Conversation ID
   */
  conversationId: string;
  
  /**
   * Current status
   */
  status: StreamingStatus;
  
  /**
   * Accumulated content
   */
  content: string;
  
  /**
   * Buffered chunks
   */
  buffer: any[];
  
  /**
   * Start timestamp
   */
  startTime: number;
  
  /**
   * Last activity timestamp
   */
  lastActivity: number;
  
  /**
   * Timeout ID for streaming timeout
   */
  timeoutId?: NodeJS.Timeout;
  
  /**
   * Debounce timeout ID
   */
  debounceTimeoutId?: NodeJS.Timeout;
  
  /**
   * Error if status is error
   */
  error?: Error;
  
  /**
   * Tool calls extracted from chunks
   */
  toolCalls: any[];
  
  /**
   * Chunk processor function
   */
  chunkProcessor?: (chunk: any) => void;
  
  /**
   * Completion callback
   */
  onComplete?: (message: AssistantMessage) => void;
  
  /**
   * Error callback
   */
  onError?: (error: Error) => void;
}

/**
 * Streaming manager for handling streaming responses
 * Extends Component for lifecycle management
 */
export class StreamingManager extends Component {
  private sessions: Map<string, StreamingSession> = new Map();
  private eventBus: EventBus;
  private events: Events = new Events();
  private defaultOptions: StreamingOptions = {
    processingStrategy: ChunkProcessingStrategy.Buffered,
    bufferSize: 5,
    debounceInterval: 100,
    streamingTimeout: 30000, // 30 seconds
    debugEvents: false
  };
  
  /**
   * Create a new streaming manager
   * @param eventBus - Event bus for plugin-wide events
   */
  constructor(eventBus: EventBus) {
    super();
    this.eventBus = eventBus;
  }
  
  /**
   * Component lifecycle method - called when component is loaded
   */
  onload(): void {
    console.log('StreamingManager: loaded');
    
    // Register for MCP events
    this.registerEventListeners();
  }
  
  /**
   * Component lifecycle method - called when component is unloaded
   */
  onunload(): void {
    console.log('StreamingManager: unloaded');
    
    // Clean up all active sessions
    this.cleanupSessions();
    
    // Clean up event listeners
    this.events = new Events();
  }
  
  /**
   * Register event listeners
   */
  private registerEventListeners(): void {
    // Listen for streaming events from MCPClient
    this.registerEvent(
      this.eventBus.on(MCPEventType.StreamingStart, (data) => {
        this.handleStreamingStart(data);
      })
    );
    
    this.registerEvent(
      this.eventBus.on(MCPEventType.StreamingChunk, (data) => {
        this.handleStreamingChunk(data);
      })
    );
    
    this.registerEvent(
      this.eventBus.on(MCPEventType.StreamingEnd, (data) => {
        this.handleStreamingEnd(data);
      })
    );
    
    this.registerEvent(
      this.eventBus.on(MCPEventType.Error, (data) => {
        // Only handle errors for active streaming sessions
        if (this.hasSession(data.conversationId)) {
          this.handleStreamingError(data.conversationId, data.error);
        }
      })
    );
  }
  
  /**
   * Clean up all active sessions
   */
  private cleanupSessions(): void {
    for (const [sessionId, session] of this.sessions.entries()) {
      this.cleanupSession(sessionId);
    }
    
    this.sessions.clear();
  }
  
  /**
   * Clean up a specific session
   * @param sessionId - Session ID to clean up
   */
  private cleanupSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return;
    }
    
    // Clear timeouts
    if (session.timeoutId) {
      clearTimeout(session.timeoutId);
    }
    
    if (session.debounceTimeoutId) {
      clearTimeout(session.debounceTimeoutId);
    }
    
    // Clear buffer
    session.buffer = [];
    
    // Remove from sessions
    this.sessions.delete(sessionId);
    
    // Emit event
    this.events.trigger('streamingManager:sessionClosed', {
      sessionId,
      conversationId: session.conversationId
    });
  }
  
  /**
   * Create a new streaming session
   * @param conversationId - Conversation ID
   * @param options - Streaming options
   * @returns Session ID
   */
  public createSession(
    conversationId: string,
    options: StreamingOptions = {}
  ): string {
    // Generate session ID
    const sessionId = this.generateSessionId();
    
    // Merge options with defaults
    const mergedOptions = { ...this.defaultOptions, ...options };
    
    // Create session
    const session: StreamingSession = {
      id: sessionId,
      conversationId,
      status: StreamingStatus.Idle,
      content: '',
      buffer: [],
      startTime: Date.now(),
      lastActivity: Date.now(),
      toolCalls: []
    };
    
    // Set timeout if specified
    if (mergedOptions.streamingTimeout) {
      session.timeoutId = setTimeout(() => {
        this.handleStreamingTimeout(sessionId);
      }, mergedOptions.streamingTimeout);
    }
    
    // Store session
    this.sessions.set(sessionId, session);
    
    // Emit event
    this.events.trigger('streamingManager:sessionCreated', {
      sessionId,
      conversationId,
      options: mergedOptions
    });
    
    return sessionId;
  }
  
  /**
   * Check if a session exists
   * @param conversationId - Conversation ID
   * @returns Whether a session exists for the conversation
   */
  public hasSession(conversationId: string): boolean {
    for (const session of this.sessions.values()) {
      if (session.conversationId === conversationId) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Get a session by conversation ID
   * @param conversationId - Conversation ID
   * @returns Session or undefined
   */
  public getSessionByConversationId(conversationId: string): StreamingSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.conversationId === conversationId) {
        return session;
      }
    }
    
    return undefined;
  }
  
  /**
   * Get a session by session ID
   * @param sessionId - Session ID
   * @returns Session or undefined
   */
  public getSession(sessionId: string): StreamingSession | undefined {
    return this.sessions.get(sessionId);
  }
  
  /**
   * Handle streaming start event
   * @param data - Event data
   */
  private handleStreamingStart(data: any): void {
    const { conversationId } = data;
    
    // Check if session already exists
    let session = this.getSessionByConversationId(conversationId);
    
    if (!session) {
      // Create new session
      const sessionId = this.createSession(conversationId);
      session = this.sessions.get(sessionId);
      
      if (!session) {
        console.error(`Failed to create streaming session for conversation ${conversationId}`);
        return;
      }
    }
    
    // Update session status
    session.status = StreamingStatus.Streaming;
    session.startTime = Date.now();
    session.lastActivity = Date.now();
    session.content = '';
    session.buffer = [];
    session.toolCalls = [];
    
    // Emit event
    this.events.trigger('streamingManager:streamingStarted', {
      sessionId: session.id,
      conversationId
    });
  }
  
  /**
   * Handle streaming chunk event
   * @param data - Event data
   */
  private handleStreamingChunk(data: MCPChunkEvent): void {
    const { conversationId, chunk } = data;
    
    // Get session
    const session = this.getSessionByConversationId(conversationId);
    
    if (!session) {
      console.warn(`Received chunk for unknown conversation ${conversationId}`);
      return;
    }
    
    // Update last activity
    session.lastActivity = Date.now();
    
    // Add to buffer
    session.buffer.push(chunk);
    
    // Process based on strategy
    const options = this.defaultOptions;
    
    switch (options.processingStrategy) {
      case ChunkProcessingStrategy.Immediate:
        this.processChunk(session, chunk);
        break;
        
      case ChunkProcessingStrategy.Buffered:
        if (session.buffer.length >= (options.bufferSize || 5)) {
          this.processBuffer(session);
        }
        break;
        
      case ChunkProcessingStrategy.Debounced:
        // Clear existing timeout
        if (session.debounceTimeoutId) {
          clearTimeout(session.debounceTimeoutId);
        }
        
        // Set new timeout
        session.debounceTimeoutId = setTimeout(() => {
          this.processBuffer(session);
        }, options.debounceInterval || 100);
        break;
    }
    
    // Call custom processor if provided
    if (session.chunkProcessor) {
      session.chunkProcessor(chunk);
    }
  }
  
  /**
   * Process a single chunk
   * @param session - Streaming session
   * @param chunk - Chunk to process
   */
  private processChunk(session: StreamingSession, chunk: any): void {
    try {
      // Extract content from chunk based on provider format
      let content = '';
      let toolCalls: any[] = [];
      
      if (typeof chunk === 'string') {
        content = chunk;
      } else if (chunk.choices && chunk.choices[0]) {
        // OpenAI format
        const delta = chunk.choices[0].delta;
        
        if (delta.content) {
          content = delta.content;
        }
        
        if (delta.tool_calls) {
          toolCalls = delta.tool_calls;
        }
      } else if (chunk.delta) {
        // Anthropic format
        if (chunk.delta.text) {
          content = chunk.delta.text;
        }
        
        if (chunk.delta.tool_calls) {
          toolCalls = chunk.delta.tool_calls;
        }
      }
      
      // Update session content
      if (content) {
        session.content += content;
      }
      
      // Update tool calls
      if (toolCalls.length > 0) {
        this.updateToolCalls(session, toolCalls);
      }
      
      // Emit event
      this.events.trigger('streamingManager:chunkProcessed', {
        sessionId: session.id,
        conversationId: session.conversationId,
        content,
        toolCalls
      });
    } catch (error) {
      console.error('Error processing chunk:', error);
      
      // Emit error event
      this.events.trigger('streamingManager:chunkError', {
        sessionId: session.id,
        conversationId: session.conversationId,
        error
      });
    }
  }
  
  /**
   * Process the buffer
   * @param session - Streaming session
   */
  private processBuffer(session: StreamingSession): void {
    if (session.buffer.length === 0) {
      return;
    }
    
    try {
      // Process each chunk
      for (const chunk of session.buffer) {
        this.processChunk(session, chunk);
      }
      
      // Clear buffer
      session.buffer = [];
      
      // Emit event
      this.events.trigger('streamingManager:bufferProcessed', {
        sessionId: session.id,
        conversationId: session.conversationId,
        currentContent: session.content
      });
    } catch (error) {
      console.error('Error processing buffer:', error);
      
      // Emit error event
      this.events.trigger('streamingManager:bufferError', {
        sessionId: session.id,
        conversationId: session.conversationId,
        error
      });
    }
  }
  
  /**
   * Update tool calls from chunks
   * @param session - Streaming session
   * @param newToolCalls - New tool calls from chunk
   */
  private updateToolCalls(session: StreamingSession, newToolCalls: any[]): void {
    for (const newToolCall of newToolCalls) {
      // Find existing tool call
      const existingIndex = session.toolCalls.findIndex(tc => tc.index === newToolCall.index);
      
      if (existingIndex >= 0) {
        // Update existing tool call
        const existing = session.toolCalls[existingIndex];
        
        // Merge properties
        if (newToolCall.id) {
          existing.id = newToolCall.id;
        }
        
        if (newToolCall.type) {
          existing.type = newToolCall.type;
        }
        
        if (newToolCall.function) {
          if (!existing.function) {
            existing.function = { name: '', arguments: '' };
          }
          
          if (newToolCall.function.name) {
            existing.function.name = newToolCall.function.name;
          }
          
          if (newToolCall.function.arguments) {
            existing.function.arguments += newToolCall.function.arguments;
          }
        }
      } else {
        // Add new tool call
        session.toolCalls.push(newToolCall);
      }
    }
  }
  
  /**
   * Handle streaming end event
   * @param data - Event data
   */
  private handleStreamingEnd(data: any): void {
    const { conversationId, message } = data;
    
    // Get session
    const session = this.getSessionByConversationId(conversationId);
    
    if (!session) {
      console.warn(`Received streaming end for unknown conversation ${conversationId}`);
      return;
    }
    
    // Process any remaining chunks in buffer
    if (session.buffer.length > 0) {
      this.processBuffer(session);
    }
    
    // Update session status
    session.status = StreamingStatus.Completed;
    
    // Clear timeout
    if (session.timeoutId) {
      clearTimeout(session.timeoutId);
      session.timeoutId = undefined;
    }
    
    // Call completion callback if provided
    if (session.onComplete) {
      session.onComplete(message);
    }
    
    // Emit event
    this.events.trigger('streamingManager:streamingCompleted', {
      sessionId: session.id,
      conversationId,
      content: session.content,
      toolCalls: session.toolCalls,
      duration: Date.now() - session.startTime
    });
    
    // Clean up session
    this.cleanupSession(session.id);
  }
  
  /**
   * Handle streaming error
   * @param conversationId - Conversation ID
   * @param error - Error
   */
  private handleStreamingError(conversationId: string, error: Error | string): void {
    // Get session
    const session = this.getSessionByConversationId(conversationId);
    
    if (!session) {
      console.warn(`Received streaming error for unknown conversation ${conversationId}`);
      return;
    }
    
    // Update session status
    session.status = StreamingStatus.Error;
    session.error = error instanceof Error ? error : new Error(error);
    
    // Clear timeout
    if (session.timeoutId) {
      clearTimeout(session.timeoutId);
      session.timeoutId = undefined;
    }
    
    // Call error callback if provided
    if (session.onError) {
      session.onError(session.error);
    }
    
    // Emit event
    this.events.trigger('streamingManager:streamingError', {
      sessionId: session.id,
      conversationId,
      error: session.error,
      content: session.content,
      duration: Date.now() - session.startTime
    });
    
    // Clean up session
    this.cleanupSession(session.id);
  }
  
  /**
   * Handle streaming timeout
   * @param sessionId - Session ID
   */
  private handleStreamingTimeout(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return;
    }
    
    // Create timeout error
    const error = new Error(`Streaming timed out after ${Date.now() - session.startTime}ms`);
    
    // Handle as error
    this.handleStreamingError(session.conversationId, error);
  }
  
  /**
   * Generate a unique session ID
   * @returns Unique session ID
   */
  private generateSessionId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
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
  
  /**
   * Pause streaming for a session
   * @param conversationId - Conversation ID
   * @returns Whether the operation was successful
   */
  public pauseStreaming(conversationId: string): boolean {
    const session = this.getSessionByConversationId(conversationId);
    
    if (!session || session.status !== StreamingStatus.Streaming) {
      return false;
    }
    
    // Update status
    session.status = StreamingStatus.Paused;
    
    // Emit event
    this.events.trigger('streamingManager:streamingPaused', {
      sessionId: session.id,
      conversationId
    });
    
    return true;
  }
  
  /**
   * Resume streaming for a session
   * @param conversationId - Conversation ID
   * @returns Whether the operation was successful
   */
  public resumeStreaming(conversationId: string): boolean {
    const session = this.getSessionByConversationId(conversationId);
    
    if (!session || session.status !== StreamingStatus.Paused) {
      return false;
    }
    
    // Update status
    session.status = StreamingStatus.Streaming;
    
    // Emit event
    this.events.trigger('streamingManager:streamingResumed', {
      sessionId: session.id,
      conversationId
    });
    
    return true;
  }
  
  /**
   * Cancel streaming for a session
   * @param conversationId - Conversation ID
   * @returns Whether the operation was successful
   */
  public cancelStreaming(conversationId: string): boolean {
    const session = this.getSessionByConversationId(conversationId);
    
    if (!session) {
      return false;
    }
    
    // Clean up session
    this.cleanupSession(session.id);
    
    // Emit event
    this.events.trigger('streamingManager:streamingCancelled', {
      sessionId: session.id,
      conversationId
    });
    
    return true;
  }
  
  /**
   * Set chunk processor for a session
   * @param conversationId - Conversation ID
   * @param processor - Chunk processor function
   * @returns Whether the operation was successful
   */
  public setChunkProcessor(
    conversationId: string,
    processor: (chunk: any) => void
  ): boolean {
    const session = this.getSessionByConversationId(conversationId);
    
    if (!session) {
      return false;
    }
    
    session.chunkProcessor = processor;
    return true;
  }
  
  /**
   * Set completion callback for a session
   * @param conversationId - Conversation ID
   * @param callback - Completion callback
   * @returns Whether the operation was successful
   */
  public setCompletionCallback(
    conversationId: string,
    callback: (message: AssistantMessage) => void
  ): boolean {
    const session = this.getSessionByConversationId(conversationId);
    
    if (!session) {
      return false;
    }
    
    session.onComplete = callback;
    return true;
  }
  
  /**
   * Set error callback for a session
   * @param conversationId - Conversation ID
   * @param callback - Error callback
   * @returns Whether the operation was successful
   */
  public setErrorCallback(
    conversationId: string,
    callback: (error: Error) => void
  ): boolean {
    const session = this.getSessionByConversationId(conversationId);
    
    if (!session) {
      return false;
    }
    
    session.onError = callback;
    return true;
  }
  
  /**
   * Get streaming status for a conversation
   * @param conversationId - Conversation ID
   * @returns Streaming status or undefined if no session exists
   */
  public getStreamingStatus(conversationId: string): StreamingStatus | undefined {
    const session = this.getSessionByConversationId(conversationId);
    
    if (!session) {
      return undefined;
    }
    
    return session.status;
  }
  
  /**
   * Get current content for a streaming session
   * @param conversationId - Conversation ID
   * @returns Current content or undefined if no session exists
   */
  public getCurrentContent(conversationId: string): string | undefined {
    const session = this.getSessionByConversationId(conversationId);
    
    if (!session) {
      return undefined;
    }
    
    return session.content;
  }
  
  /**
   * Get current tool calls for a streaming session
   * @param conversationId - Conversation ID
   * @returns Current tool calls or undefined if no session exists
   */
  public getCurrentToolCalls(conversationId: string): any[] | undefined {
    const session = this.getSessionByConversationId(conversationId);
    
    if (!session) {
      return undefined;
    }
    
    return [...session.toolCalls];
  }
}

/**
 * Create a new streaming manager
 * @param eventBus - Event bus for plugin-wide events
 * @returns Streaming manager
 */
export function createStreamingManager(eventBus: EventBus): StreamingManager {
  return new StreamingManager(eventBus);
}