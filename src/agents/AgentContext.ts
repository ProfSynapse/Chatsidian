import { Conversation } from '../mcp/client/MCPInterfaces';
import { AgentDefinition } from './AgentTypes';

/**
 * Context for an agent's execution
 */
export interface AgentContextData {
  /**
   * Unique identifier for this context
   */
  id: string;
  
  /**
   * Agent definition
   */
  agent: AgentDefinition;
  
  /**
   * Current conversation
   */
  conversation: Conversation;
  
  /**
   * Memory for the agent (persists between conversations)
   */
  memory: Record<string, any>;
  
  /**
   * Creation timestamp
   */
  createdAt: number;
  
  /**
   * Last updated timestamp
   */
  updatedAt: number;
}

/**
 * Agent context manager
 * Maintains state and conversation history for agents
 */
export class AgentContext {
  private context: AgentContextData;
  
  /**
   * Create a new agent context
   * @param id - Context ID
   * @param agent - Agent definition
   * @param conversation - Initial conversation
   */
  constructor(id: string, agent: AgentDefinition, conversation: Conversation) {
    const now = Date.now();
    
    this.context = {
      id,
      agent,
      conversation,
      memory: {},
      createdAt: now,
      updatedAt: now
    };
  }
  
  /**
   * Get the context data
   * @returns Context data
   */
  public getContext(): AgentContextData {
    return this.context;
  }
  
  /**
   * Get the conversation
   * @returns Current conversation
   */
  public getConversation(): Conversation {
    return this.context.conversation;
  }
  
  /**
   * Set the conversation
   * @param conversation - New conversation
   */
  public setConversation(conversation: Conversation): void {
    this.context.conversation = conversation;
    this.context.updatedAt = Date.now();
  }
  
  /**
   * Get a memory value
   * @param key - Memory key
   * @returns Memory value or undefined
   */
  public getMemory<T>(key: string): T | undefined {
    return this.context.memory[key] as T;
  }
  
  /**
   * Set a memory value
   * @param key - Memory key
   * @param value - Memory value
   */
  public setMemory<T>(key: string, value: T): void {
    this.context.memory[key] = value;
    this.context.updatedAt = Date.now();
  }
  
  /**
   * Clear a memory value
   * @param key - Memory key
   */
  public clearMemory(key: string): void {
    delete this.context.memory[key];
    this.context.updatedAt = Date.now();
  }
  
  /**
   * Clear all memory
   */
  public clearAllMemory(): void {
    this.context.memory = {};
    this.context.updatedAt = Date.now();
  }
  
  /**
   * Get all memory
   * @returns All memory
   */
  public getAllMemory(): Record<string, any> {
    return { ...this.context.memory };
  }
  
  /**
   * Create a summary of the context
   * @returns Context summary
   */
  public getSummary(): string {
    const { id, agent, conversation, createdAt, updatedAt } = this.context;
    const memoryKeys = Object.keys(this.context.memory);
    const messageCount = conversation.messages.length;
    
    return `Agent Context ${id}:
Agent: ${agent.name} (${agent.id})
Conversation: ${conversation.title} (${conversation.id})
Messages: ${messageCount}
Memory Keys: ${memoryKeys.join(', ') || 'None'}
Created: ${new Date(createdAt).toISOString()}
Updated: ${new Date(updatedAt).toISOString()}`;
  }
  
  /**
   * Serialize the context to JSON
   * @returns Serialized context
   */
  public toJSON(): string {
    return JSON.stringify(this.context);
  }
  
  /**
   * Create a context from JSON
   * @param json - Serialized context
   * @returns New agent context
   */
  public static fromJSON(json: string): AgentContext {
    const data = JSON.parse(json) as AgentContextData;
    const context = new AgentContext(data.id, data.agent, data.conversation);
    context.context = data;
    return context;
  }
}