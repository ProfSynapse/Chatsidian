import { App } from 'obsidian';
import { EventBus } from '../../core/EventBus';
import { AgentSystem } from '../../agents/AgentSystem';
import { Agent } from '../../agents/Agent';
import {
  A2AAgentConnector,
  A2ARegistry,
  A2AMessageRouter,
  A2AProtocolHandler,
  A2AMessageType,
  createA2AComponents
} from '../index';

/**
 * A2A Agent System Integration
 * 
 * Integrates the A2A protocol with the existing agent system.
 */
export class A2AAgentSystemIntegration {
  private app: App;
  private eventBus: EventBus;
  private agentSystem: AgentSystem;
  
  private a2aRegistry: A2ARegistry;
  private a2aMessageRouter: A2AMessageRouter;
  private a2aProtocolHandler: A2AProtocolHandler;
  private a2aAgentConnector: A2AAgentConnector;
  
  /**
   * Create a new A2A agent system integration
   * @param app - Obsidian app instance
   * @param eventBus - Event bus
   * @param agentSystem - Agent system
   */
  constructor(
    app: App,
    eventBus: EventBus,
    agentSystem: AgentSystem
  ) {
    this.app = app;
    this.eventBus = eventBus;
    this.agentSystem = agentSystem;
    
    // Create A2A components
    const components = createA2AComponents(app, eventBus);
    this.a2aRegistry = components.registry;
    this.a2aMessageRouter = components.messageRouter;
    this.a2aProtocolHandler = components.protocolHandler;
    this.a2aAgentConnector = components.agentConnector;
    
    // Register event listeners
    this.registerEventListeners();
  }
  
  /**
   * Register event listeners
   */
  private registerEventListeners(): void {
    // Listen for agent creation
    this.eventBus.on('agents:created', (data: { agent: Agent }) => {
      // Register agent with A2A
      this.registerAgentWithA2A(data.agent);
    });
  }
  
  /**
   * Register an agent with A2A
   * @param agent - The agent to register
   */
  private async registerAgentWithA2A(agent: Agent): Promise<void> {
    try {
      await this.a2aAgentConnector.registerAgent(agent);
      console.log(`Agent ${agent.definition.id} registered with A2A`);
    } catch (error) {
      console.error(`Error registering agent ${agent.definition.id} with A2A:`, error);
    }
  }
  
  /**
   * Enable A2A for an agent
   * @param agent - The agent to enable A2A for
   * @returns Promise resolving when A2A is enabled
   */
  public async enableA2AForAgent(agent: Agent): Promise<void> {
    try {
      // Register agent with A2A
      await this.a2aAgentConnector.registerAgent(agent);
      
      // Add A2A methods to agent
      this.extendAgentWithA2AMethods(agent);
      
      console.log(`A2A enabled for agent ${agent.definition.id}`);
    } catch (error) {
      console.error(`Error enabling A2A for agent ${agent.definition.id}:`, error);
      throw error;
    }
  }
  
  /**
   * Extend an agent with A2A methods
   * @param agent - The agent to extend
   */
  private extendAgentWithA2AMethods(agent: Agent): void {
    // Add A2A methods to agent
    (agent as any).a2a = {
      // Enable flag
      enabled: true,
      
      // Send message
      sendMessage: async (toAgentId: string, content: string) => {
        // Create message
        const message = this.a2aProtocolHandler.formatMessage({
          type: A2AMessageType.REQUEST,
          sender: {
            id: agent.definition.id,
            name: agent.definition.name
          },
          recipient: {
            id: toAgentId,
            name: this.a2aRegistry.getAgent(toAgentId)?.name || toAgentId
          },
          content,
          metadata: {
            timestamp: Date.now()
          }
        });
        
        // Send message
        return this.a2aAgentConnector.sendMessage(agent, message);
      },
      
      // Discover capabilities
      discoverCapabilities: async (filter?: string[]) => {
        return this.a2aAgentConnector.discoverCapabilities(agent, filter);
      },
      
      // Delegate task
      delegateTask: async (toAgentId: string, task: any) => {
        return this.a2aAgentConnector.delegateTask(agent, toAgentId, task);
      }
    };
  }
  
  /**
   * Initialize A2A for all existing agents
   * @returns Promise resolving when initialization is complete
   */
  public async initialize(): Promise<void> {
    try {
      // Get all agent definitions
      const agentDefinitions = this.agentSystem.getAllAgentDefinitions();
      
      // Create and enable A2A for each agent
      for (const definition of agentDefinitions) {
        // Create agent
        const agent = this.agentSystem.createAgent(definition.id);
        
        // Enable A2A
        await this.enableA2AForAgent(agent);
      }
      
      console.log('A2A initialized for all agents');
    } catch (error) {
      console.error('Error initializing A2A:', error);
      throw error;
    }
  }
  
  /**
   * Get the A2A agent connector
   * @returns A2A agent connector
   */
  public getA2AAgentConnector(): A2AAgentConnector {
    return this.a2aAgentConnector;
  }
  
  /**
   * Get the A2A registry
   * @returns A2A registry
   */
  public getA2ARegistry(): A2ARegistry {
    return this.a2aRegistry;
  }
  
  /**
   * Get the A2A message router
   * @returns A2A message router
   */
  public getA2AMessageRouter(): A2AMessageRouter {
    return this.a2aMessageRouter;
  }
  
  /**
   * Get the A2A protocol handler
   * @returns A2A protocol handler
   */
  public getA2AProtocolHandler(): A2AProtocolHandler {
    return this.a2aProtocolHandler;
  }
}