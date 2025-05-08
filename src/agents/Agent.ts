import { App } from 'obsidian';
import { IMCPClient, Conversation, Message, MessageRole } from '../mcp/client/MCPInterfaces';
import { AgentDefinition, AgentSettings, AssistantMessage, StreamHandlers } from './AgentTypes';
import { AgentContext } from './AgentContext';
import { v4 as uuidv4 } from 'uuid';

/**
 * Base Agent class that implements common agent functionality
 */
export class Agent {
  /**
   * Agent definition
   */
  public definition: AgentDefinition;
  
  /**
   * Agent settings
   */
  public settings: AgentSettings;
  
  /**
   * MCP client for the agent
   */
  public mcpClient: IMCPClient;
  
  /**
   * Obsidian app instance
   */
  private app: App;
  
  /**
   * Agent context
   */
  private context: AgentContext | null = null;
  
  /**
   * Create a new agent
   * @param app - Obsidian app instance
   * @param definition - Agent definition
   * @param mcpClient - MCP client
   */
  constructor(
    app: App,
    definition: AgentDefinition,
    mcpClient: IMCPClient
  ) {
    this.app = app;
    this.definition = definition;
    this.mcpClient = mcpClient;
    this.settings = { ...definition.defaultSettings };
  }
  
  /**
   * Initialize the agent
   * @returns Promise resolving when initialization is complete
   */
  public async initialize(): Promise<void> {
    // No default initialization needed
  }
  
  /**
   * Create a context for this agent
   * @param conversation - Conversation for the context
   * @returns Agent context
   */
  public createContext(conversation: Conversation): AgentContext {
    this.context = new AgentContext(uuidv4(), this.definition, conversation);
    return this.context;
  }
  
  /**
   * Get the current context
   * @returns Current context or null if not set
   */
  public getContext(): AgentContext | null {
    return this.context;
  }
  
  /**
   * Set the current context
   * @param context - Agent context
   */
  public setContext(context: AgentContext): void {
    this.context = context;
  }
  
  /**
   * Send a message to the agent
   * @param conversation - Conversation for context
   * @param message - Message to send
   * @returns Promise resolving to the agent's response
   */
  public async sendMessage(
    conversation: Conversation,
    message: Message
  ): Promise<AssistantMessage> {
    try {
      // Ensure system message exists
      this.ensureSystemMessage(conversation);
      
      // Send message through MCP client
      const response = await this.mcpClient.sendMessage(
        conversation,
        message,
        {
          model: this.settings.model,
          temperature: this.settings.temperature,
          max_tokens: this.settings.maxTokens,
          stream: this.settings.stream
        }
      );
      
      // Convert to our AssistantMessage type
      const agentResponse: AssistantMessage = {
        role: MessageRole.Assistant,
        content: response.content,
        toolCalls: response.tool_calls,
        id: response.id,
        timestamp: response.timestamp
      };
      
      return agentResponse;
    } catch (error) {
      console.error(`Error sending message to agent ${this.definition.id}:`, error);
      throw error;
    }
  }
  
  /**
   * Stream a message from the agent
   * @param conversation - Conversation for context
   * @param message - Message to send
   * @param handlers - Stream handlers
   * @returns Promise resolving to the agent's response
   */
  public async streamMessage(
    conversation: Conversation,
    message: Message,
    handlers: StreamHandlers
  ): Promise<AssistantMessage> {
    try {
      // Ensure system message exists
      this.ensureSystemMessage(conversation);
      
      // Define chunk handler
      const handleChunk = (chunk: any) => {
        // Handle content
        if (chunk.content && handlers.onContent) {
          handlers.onContent(chunk.content);
        }
        
        // Handle tool calls
        if (chunk.tool_calls && handlers.onToolCall) {
          for (const toolCall of chunk.tool_calls) {
            handlers.onToolCall(toolCall);
          }
        }
      };
      
      // Stream message through MCP client
      const response = await this.mcpClient.streamMessage(
        conversation,
        message,
        {
          model: this.settings.model,
          temperature: this.settings.temperature,
          max_tokens: this.settings.maxTokens,
          stream: true
        },
        handleChunk
      );
      
      // Call completion handler
      if (handlers.onComplete) {
        handlers.onComplete();
      }
      
      // Convert to our AssistantMessage type
      const agentResponse: AssistantMessage = {
        role: MessageRole.Assistant,
        content: response.content,
        toolCalls: response.tool_calls,
        id: response.id,
        timestamp: response.timestamp
      };
      
      return agentResponse;
    } catch (error) {
      // Call error handler
      if (handlers.onError) {
        handlers.onError(error instanceof Error ? error : new Error(String(error)));
      }
      
      console.error(`Error streaming message from agent ${this.definition.id}:`, error);
      throw error;
    }
  }
  
  /**
   * Ensure system message exists in conversation
   * @param conversation - Conversation to check
   */
  private ensureSystemMessage(conversation: Conversation): void {
    // Check if system message exists
    const hasSystemMessage = conversation.messages.some(
      message => message.role === MessageRole.System
    );
    
    // Add system message if not exists
    if (!hasSystemMessage) {
      conversation.messages.unshift({
        role: MessageRole.System,
        content: this.definition.systemPrompt,
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Update agent settings
   * @param settings - New settings
   */
  public updateSettings(settings: Partial<AgentSettings>): void {
    this.settings = {
      ...this.settings,
      ...settings
    };
  }
  
  /**
   * Reset agent settings to defaults
   */
  public resetSettings(): void {
    this.settings = { ...this.definition.defaultSettings };
  }
  
  /**
   * Get a string representation of the agent
   * @returns String representation
   */
  public toString(): string {
    return `Agent(${this.definition.id}): ${this.definition.name}`;
  }
}