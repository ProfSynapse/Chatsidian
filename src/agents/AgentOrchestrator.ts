import { App } from 'obsidian';
import { EventBus } from '../core/EventBus';
import { Conversation, Message, MessageRole } from '../mcp/client/MCPInterfaces';
import { Agent } from './Agent';
import { AgentDefinition, AgentRole, AssistantMessage } from './AgentTypes';
import { AgentContext } from './AgentContext';
import { v4 as uuidv4 } from 'uuid';

/**
 * Intent classification result
 */
interface IntentClassification {
  /**
   * Primary intent
   */
  intent: string;
  
  /**
   * Confidence score (0-1)
   */
  confidence: number;
  
  /**
   * Agent role best suited for this intent
   */
  agentRole: AgentRole;
  
  /**
   * Entities extracted from the message
   */
  entities?: Record<string, any>;
}

/**
 * Agent orchestrator for coordinating multiple agents
 */
export class AgentOrchestrator {
  private app: App;
  private eventBus: EventBus;
  private agents: Map<string, Agent> = new Map();
  private contexts: Map<string, AgentContext> = new Map();
  private defaultAgentId: string | null = null;
  
  /**
   * Create a new agent orchestrator
   * @param app - Obsidian app instance
   * @param eventBus - Event bus
   */
  constructor(app: App, eventBus: EventBus) {
    this.app = app;
    this.eventBus = eventBus;
  }
  
  /**
   * Register an agent with the orchestrator
   * @param agent - Agent to register
   */
  public registerAgent(agent: Agent): void {
    this.agents.set(agent.definition.id, agent);
    
    // Set as default if no default agent
    if (!this.defaultAgentId) {
      this.defaultAgentId = agent.definition.id;
    }
    
    // Emit event
    this.eventBus.emit('agents:registered', {
      agentId: agent.definition.id,
      agent: agent.definition
    });
  }
  
  /**
   * Get an agent by ID
   * @param id - Agent ID
   * @returns Agent or undefined
   */
  public getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }
  
  /**
   * Get all registered agents
   * @returns Array of agents
   */
  public getAgents(): Agent[] {
    return Array.from(this.agents.values());
  }
  
  /**
   * Set the default agent
   * @param id - Agent ID
   */
  public setDefaultAgent(id: string): void {
    if (!this.agents.has(id)) {
      throw new Error(`Agent not found: ${id}`);
    }
    
    this.defaultAgentId = id;
    
    // Emit event
    this.eventBus.emit('agents:defaultChanged', {
      agentId: id
    });
  }
  
  /**
   * Get the default agent
   * @returns Default agent or undefined
   */
  public getDefaultAgent(): Agent | undefined {
    if (!this.defaultAgentId) {
      return undefined;
    }
    
    return this.agents.get(this.defaultAgentId);
  }
  
  /**
   * Create a context for an agent
   * @param agentId - Agent ID
   * @param conversation - Conversation for context
   * @returns Agent context
   */
  public createContext(agentId: string, conversation: Conversation): AgentContext {
    const agent = this.getAgent(agentId);
    
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    
    const contextId = uuidv4();
    const context = new AgentContext(contextId, agent.definition, conversation);
    
    // Store context
    this.contexts.set(contextId, context);
    
    // Set context on agent
    agent.setContext(context);
    
    return context;
  }
  
  /**
   * Get a context by ID
   * @param id - Context ID
   * @returns Context or undefined
   */
  public getContext(id: string): AgentContext | undefined {
    return this.contexts.get(id);
  }
  
  /**
   * Process a message with the most appropriate agent
   * @param conversation - Conversation for context
   * @param message - Message to process
   * @param preferredAgentId - Optional preferred agent ID
   * @returns Promise resolving to the agent's response
   */
  public async processMessage(
    conversation: Conversation,
    message: Message,
    preferredAgentId?: string
  ): Promise<AssistantMessage> {
    try {
      // Use preferred agent if specified
      if (preferredAgentId && this.agents.has(preferredAgentId)) {
        const agent = this.agents.get(preferredAgentId)!;
        return await this.sendMessageToAgent(agent, conversation, message);
      }
      
      // Classify intent to determine best agent
      const classification = await this.classifyIntent(message.content);
      
      // Find agent with matching role
      const matchingAgents = Array.from(this.agents.values()).filter(
        agent => agent.definition.role === classification.agentRole
      );
      
      // Use matching agent or default
      const agent = matchingAgents.length > 0
        ? matchingAgents[0]
        : this.getDefaultAgent();
      
      if (!agent) {
        throw new Error('No suitable agent found and no default agent set');
      }
      
      // Send message to agent
      return await this.sendMessageToAgent(agent, conversation, message);
    } catch (error) {
      console.error('Error processing message:', error);
      
      // Create error response
      const errorResponse: AssistantMessage = {
        role: MessageRole.Assistant,
        content: `Error processing your message: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now()
      };
      
      return errorResponse;
    }
  }
  
  /**
   * Send a message to a specific agent
   * @param agent - Agent to send message to
   * @param conversation - Conversation for context
   * @param message - Message to send
   * @returns Promise resolving to the agent's response
   */
  private async sendMessageToAgent(
    agent: Agent,
    conversation: Conversation,
    message: Message
  ): Promise<AssistantMessage> {
    // Create context if not exists
    if (!agent.getContext()) {
      this.createContext(agent.definition.id, conversation);
    }
    
    // Send message
    const response = await agent.sendMessage(conversation, message);
    
    // Emit event
    this.eventBus.emit('agents:messageProcessed', {
      agentId: agent.definition.id,
      message,
      response,
      timestamp: Date.now()
    });
    
    return response;
  }
  
  /**
   * Classify the intent of a message
   * @param content - Message content
   * @returns Promise resolving to intent classification
   */
  private async classifyIntent(content: string): Promise<IntentClassification> {
    // In a real implementation, this would use NLP or ML to classify intent
    // For now, we'll use a simple keyword-based approach
    
    const lowerContent = content.toLowerCase();
    
    // Define patterns for different intents
    const patterns: Array<{
      keywords: string[];
      intent: string;
      agentRole: AgentRole;
    }> = [
      {
        keywords: ['create', 'new', 'add', 'write', 'make'],
        intent: 'create_content',
        agentRole: AgentRole.ContentWriter
      },
      {
        keywords: ['search', 'find', 'look', 'where', 'locate'],
        intent: 'search_vault',
        agentRole: AgentRole.KnowledgeBase
      },
      {
        keywords: ['organize', 'move', 'rename', 'delete', 'folder'],
        intent: 'manage_vault',
        agentRole: AgentRole.VaultManager
      },
      {
        keywords: ['plan', 'project', 'schedule', 'task', 'timeline'],
        intent: 'project_planning',
        agentRole: AgentRole.ProjectPlanner
      },
      {
        keywords: ['research', 'analyze', 'study', 'investigate'],
        intent: 'research',
        agentRole: AgentRole.ResearchAssistant
      },
      {
        keywords: ['code', 'function', 'script', 'program', 'debug'],
        intent: 'coding',
        agentRole: AgentRole.CodeAssistant
      }
    ];
    
    // Count keyword matches for each intent
    const scores = patterns.map(pattern => {
      const matchCount = pattern.keywords.filter(keyword => 
        lowerContent.includes(keyword)
      ).length;
      
      const score = matchCount / pattern.keywords.length;
      
      return {
        intent: pattern.intent,
        agentRole: pattern.agentRole,
        score
      };
    });
    
    // Find highest scoring intent
    const bestMatch = scores.reduce((best, current) => 
      current.score > best.score ? current : best
    , { intent: 'general', agentRole: AgentRole.GeneralAssistant, score: 0.1 });
    
    return {
      intent: bestMatch.intent,
      confidence: bestMatch.score,
      agentRole: bestMatch.agentRole
    };
  }
  
  /**
   * Get agents that can handle a specific intent
   * @param intent - Intent to handle
   * @returns Array of suitable agents
   */
  public getAgentsForIntent(intent: string): Agent[] {
    // For now, we'll use a simple mapping of intents to agent roles
    const intentToRole: Record<string, AgentRole> = {
      'create_content': AgentRole.ContentWriter,
      'search_vault': AgentRole.KnowledgeBase,
      'manage_vault': AgentRole.VaultManager,
      'project_planning': AgentRole.ProjectPlanner,
      'research': AgentRole.ResearchAssistant,
      'coding': AgentRole.CodeAssistant,
      'general': AgentRole.GeneralAssistant
    };
    
    const role = intentToRole[intent] || AgentRole.GeneralAssistant;
    
    // Find agents with matching role
    return Array.from(this.agents.values()).filter(
      agent => agent.definition.role === role
    );
  }
  
  /**
   * Orchestrate a multi-agent conversation
   * @param conversation - Conversation for context
   * @param message - Message to process
   * @returns Promise resolving to the final response
   */
  public async orchestrateConversation(
    conversation: Conversation,
    message: Message
  ): Promise<AssistantMessage> {
    // Classify intent
    const classification = await this.classifyIntent(message.content);
    
    // Get primary agent
    const primaryAgents = this.getAgentsForIntent(classification.intent);
    const primaryAgent = primaryAgents.length > 0
      ? primaryAgents[0]
      : this.getDefaultAgent();
    
    if (!primaryAgent) {
      throw new Error('No suitable agent found and no default agent set');
    }
    
    // Process with primary agent
    const primaryResponse = await this.sendMessageToAgent(
      primaryAgent,
      conversation,
      message
    );
    
    // For now, just return the primary response
    // In a more advanced implementation, we could:
    // 1. Analyze the response for sub-tasks
    // 2. Delegate sub-tasks to specialized agents
    // 3. Combine responses into a unified response
    
    return primaryResponse;
  }
}