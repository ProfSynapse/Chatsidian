import { IMCPClient, Conversation, Message, MessageRole, AssistantMessage as MCPAssistantMessage } from '../mcp/client/MCPInterfaces';

/**
 * Agent role (persona)
 */
export enum AgentRole {
  GeneralAssistant = 'general_assistant',
  VaultManager = 'vault_manager',
  KnowledgeBase = 'knowledge_base',
  ProjectPlanner = 'project_planner',
  ContentWriter = 'content_writer',
  ResearchAssistant = 'research_assistant',
  CodeAssistant = 'code_assistant',
  Custom = 'custom'
}

/**
 * Agent definition
 */
export interface AgentDefinition {
  /**
   * Agent ID (unique)
   */
  id: string;
  
  /**
   * Agent name
   */
  name: string;
  
  /**
   * Agent role
   */
  role: AgentRole;
  
  /**
   * Agent description
   */
  description: string;
  
  /**
   * System prompt template
   */
  systemPrompt: string;
  
  /**
   * Available tools
   */
  tools: string[];
  
  /**
   * Default model settings
   */
  defaultSettings: AgentSettings;
  
  /**
   * Whether this is a built-in agent
   */
  builtIn: boolean;
  
  /**
   * Emoji for the agent avatar
   */
  emoji?: string;
  
  /**
   * Agent capabilities (for UI display)
   */
  capabilities?: string[];
  
  /**
   * Agent limitations (for UI display)
   */
  limitations?: string[];
  
  /**
   * Creation date
   */
  created?: number;
  
  /**
   * Last modified date
   */
  modified?: number;
}

/**
 * Agent settings
 */
export interface AgentSettings {
  /**
   * Model to use
   */
  model: string;
  
  /**
   * Temperature (0-1)
   */
  temperature: number;
  
  /**
   * Maximum tokens to generate
   */
  maxTokens: number;
  
  /**
   * Whether to stream responses
   */
  stream: boolean;
  
  /**
   * Additional settings
   */
  [key: string]: any;
}

/**
 * Stream handlers for agent responses
 */
export interface StreamHandlers {
  /**
   * Handler for content chunks
   */
  onContent?: (content: string) => void;
  
  /**
   * Handler for tool calls
   */
  onToolCall?: (toolCall: any) => void;
  
  /**
   * Handler for errors
   */
  onError?: (error: Error) => void;
  
  /**
   * Handler for completion
   */
  onComplete?: () => void;
}

/**
 * Assistant message with potential tool calls
 */
export interface AssistantMessage extends Message {
  toolCalls?: any[];
}

/**
 * Agent instance
 */
export interface Agent {
  /**
   * Agent definition
   */
  definition: AgentDefinition;
  
  /**
   * Agent settings
   */
  settings: AgentSettings;
  
  /**
   * MCP client for the agent
   */
  mcpClient: IMCPClient;
  
  /**
   * Send a message to the agent
   * @param conversation - Conversation for context
   * @param message - Message to send
   * @returns Promise resolving to the agent's response
   */
  sendMessage(
    conversation: Conversation,
    message: Message
  ): Promise<AssistantMessage>;
  
  /**
   * Stream a message from the agent
   * @param conversation - Conversation for context
   * @param message - Message to send
   * @param handlers - Stream handlers
   * @returns Promise resolving to the agent's response
   */
  streamMessage(
    conversation: Conversation,
    message: Message,
    handlers: StreamHandlers
  ): Promise<AssistantMessage>;
}