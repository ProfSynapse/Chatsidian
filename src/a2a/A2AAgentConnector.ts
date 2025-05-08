import { App } from 'obsidian';
import { EventBus } from '../core/EventBus';
import { Agent } from '../agents/Agent';
import { IA2AAgentConnector } from './interfaces';
import { 
  A2AMessage, 
  A2ATask, 
  A2ATaskResult, 
  A2ATaskUpdate, 
  AgentCapability, 
  Subscription,
  A2AMessageType,
  TaskStatus
} from './models/A2ATypes';
import { A2ARegistry } from './A2ARegistry';
import { A2AMessageRouter } from './A2AMessageRouter';
import { A2AProtocolHandler } from './A2AProtocolHandler';
import { v4 as uuidv4 } from 'uuid';

/**
 * A2A Agent Connector
 * 
 * Serves as the bridge between agents and the A2A protocol system.
 * Handles agent registration, message sending, capability discovery, and task delegation.
 */
export class A2AAgentConnector implements IA2AAgentConnector {
  private app: App;
  private eventBus: EventBus;
  private registry: A2ARegistry;
  private messageRouter: A2AMessageRouter;
  private protocolHandler: A2AProtocolHandler;
  
  /**
   * Create a new A2A agent connector
   * @param app - Obsidian app instance
   * @param eventBus - Event bus
   * @param registry - A2A registry
   * @param messageRouter - A2A message router
   * @param protocolHandler - A2A protocol handler
   */
  constructor(
    app: App,
    eventBus: EventBus,
    registry: A2ARegistry,
    messageRouter: A2AMessageRouter,
    protocolHandler: A2AProtocolHandler
  ) {
    this.app = app;
    this.eventBus = eventBus;
    this.registry = registry;
    this.messageRouter = messageRouter;
    this.protocolHandler = protocolHandler;
    
    // Register event listeners
    this.registerEventListeners();
  }
  
  /**
   * Register event listeners
   */
  private registerEventListeners(): void {
    // Listen for task updates
    this.eventBus.on('a2a:task:update', (data: { taskId: string, update: A2ATaskUpdate }) => {
      // Handle task update
      console.log(`A2A task update for ${data.taskId}:`, data.update);
    });
    
    // Listen for agent registration
    this.eventBus.on('a2a:agent:registered', (data: { agentId: string }) => {
      // Handle agent registration
      console.log(`Agent registered with A2A: ${data.agentId}`);
    });
  }
  
  /**
   * Register an agent with the A2A system
   * @param agent - The agent to register
   * @returns Promise resolving when registration is complete
   */
  public async registerAgent(agent: Agent): Promise<void> {
    try {
      // Extract agent capabilities
      const capabilities = this.extractAgentCapabilities(agent);
      
      // Register agent with registry
      this.registry.registerAgent(agent.definition.id, capabilities);
      
      // Register message handler for the agent
      this.messageRouter.registerHandler(agent.definition.id, async (message: A2AMessage) => {
        return await this.handleAgentMessage(agent, message);
      });
      
      // Emit event
      this.eventBus.emit('a2a:agent:registered', {
        agentId: agent.definition.id
      });
      
      console.log(`Agent ${agent.definition.id} registered with A2A`);
    } catch (error) {
      console.error(`Error registering agent ${agent.definition.id} with A2A:`, error);
      throw error;
    }
  }
  
  /**
   * Extract agent capabilities
   * @param agent - The agent
   * @returns Array of agent capabilities
   */
  private extractAgentCapabilities(agent: Agent): AgentCapability[] {
    // For now, convert tools to capabilities
    // In the future, this could be more sophisticated
    return (agent.definition.tools || []).map(tool => {
      return {
        id: tool,
        name: tool,
        version: '1.0.0',
        description: `Capability for ${tool}`
      };
    });
  }
  
  /**
   * Handle a message for an agent
   * @param agent - The agent
   * @param message - The message
   * @returns Promise resolving to the agent's response
   */
  private async handleAgentMessage(agent: Agent, message: A2AMessage): Promise<A2AMessage> {
    try {
      // Validate message
      const validationResult = this.protocolHandler.validateMessage(message);
      if (!validationResult.valid) {
        throw new Error(`Invalid A2A message: ${JSON.stringify(validationResult.errors)}`);
      }
      
      // Handle different message types
      switch (message.type) {
        case A2AMessageType.CAPABILITY_DISCOVERY:
          return this.handleCapabilityDiscovery(agent, message);
          
        case A2AMessageType.TASK_DELEGATION:
          return this.handleTaskDelegation(agent, message);
          
        case A2AMessageType.REQUEST:
          return this.handleRequest(agent, message);
          
        default:
          throw new Error(`Unsupported message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`Error handling message for agent ${agent.definition.id}:`, error);
      
      // Create error response
      return this.protocolHandler.formatMessage({
        type: A2AMessageType.ERROR,
        sender: {
          id: agent.definition.id,
          name: agent.definition.name
        },
        recipient: message.sender,
        content: '',
        metadata: {
          timestamp: Date.now(),
          correlationId: message.metadata.correlationId
        },
        error: {
          code: 'message_handling_error',
          message: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }
  
  /**
   * Handle capability discovery request
   * @param agent - The agent
   * @param message - The capability discovery message
   * @returns Promise resolving to the capability response
   */
  private async handleCapabilityDiscovery(agent: Agent, message: A2AMessage): Promise<A2AMessage> {
    // Get agent capabilities
    const capabilities = this.extractAgentCapabilities(agent);
    
    // Create response
    return this.protocolHandler.formatMessage({
      type: A2AMessageType.CAPABILITY_RESPONSE,
      sender: {
        id: agent.definition.id,
        name: agent.definition.name
      },
      recipient: message.sender,
      content: JSON.stringify(capabilities),
      metadata: {
        timestamp: Date.now(),
        correlationId: message.metadata.correlationId
      }
    });
  }
  
  /**
   * Handle task delegation request
   * @param agent - The agent
   * @param message - The task delegation message
   * @returns Promise resolving to the task response
   */
  private async handleTaskDelegation(agent: Agent, message: A2AMessage): Promise<A2AMessage> {
    try {
      // Parse task from message
      const task: A2ATask = JSON.parse(message.content);
      
      // Update task status
      this.eventBus.emit('a2a:task:update', {
        taskId: task.id,
        update: {
          taskId: task.id,
          status: TaskStatus.IN_PROGRESS,
          message: 'Task received and processing',
          updatedAt: Date.now()
        }
      });
      
      // TODO: Implement actual task execution
      // For now, just simulate task execution
      const result: A2ATaskResult = {
        taskId: task.id,
        status: TaskStatus.COMPLETED,
        result: { success: true, message: 'Task completed successfully' },
        completedBy: {
          id: agent.definition.id,
          name: agent.definition.name
        },
        completedAt: Date.now()
      };
      
      // Create response
      return this.protocolHandler.formatMessage({
        type: A2AMessageType.TASK_COMPLETION,
        sender: {
          id: agent.definition.id,
          name: agent.definition.name
        },
        recipient: message.sender,
        content: JSON.stringify(result),
        task: {
          id: task.id,
          description: task.description,
          status: TaskStatus.COMPLETED
        },
        metadata: {
          timestamp: Date.now(),
          correlationId: message.metadata.correlationId
        }
      });
    } catch (error) {
      console.error(`Error handling task delegation for agent ${agent.definition.id}:`, error);
      
      // Create error response
      return this.protocolHandler.formatMessage({
        type: A2AMessageType.ERROR,
        sender: {
          id: agent.definition.id,
          name: agent.definition.name
        },
        recipient: message.sender,
        content: '',
        metadata: {
          timestamp: Date.now(),
          correlationId: message.metadata.correlationId
        },
        error: {
          code: 'task_delegation_error',
          message: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }
  
  /**
   * Handle general request
   * @param agent - The agent
   * @param message - The request message
   * @returns Promise resolving to the response
   */
  private async handleRequest(agent: Agent, message: A2AMessage): Promise<A2AMessage> {
    try {
      // TODO: Implement actual request handling
      // For now, just echo the request
      return this.protocolHandler.formatMessage({
        type: A2AMessageType.RESPONSE,
        sender: {
          id: agent.definition.id,
          name: agent.definition.name
        },
        recipient: message.sender,
        content: `Echo: ${message.content}`,
        metadata: {
          timestamp: Date.now(),
          correlationId: message.metadata.correlationId
        }
      });
    } catch (error) {
      console.error(`Error handling request for agent ${agent.definition.id}:`, error);
      
      // Create error response
      return this.protocolHandler.formatMessage({
        type: A2AMessageType.ERROR,
        sender: {
          id: agent.definition.id,
          name: agent.definition.name
        },
        recipient: message.sender,
        content: '',
        metadata: {
          timestamp: Date.now(),
          correlationId: message.metadata.correlationId
        },
        error: {
          code: 'request_handling_error',
          message: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }
  
  /**
   * Send an A2A message to another agent
   * @param fromAgent - The sending agent
   * @param message - The A2A message to send
   * @returns Promise resolving to the response message
   */
  public async sendMessage(fromAgent: Agent, message: A2AMessage): Promise<A2AMessage> {
    try {
      // Validate message
      const validationResult = this.protocolHandler.validateMessage(message);
      if (!validationResult.valid) {
        throw new Error(`Invalid A2A message: ${JSON.stringify(validationResult.errors)}`);
      }
      
      // Ensure message has required fields
      if (!message.id) {
        message.id = uuidv4();
      }
      
      if (!message.metadata) {
        message.metadata = {
          timestamp: Date.now()
        };
      }
      
      if (!message.metadata.timestamp) {
        message.metadata.timestamp = Date.now();
      }
      
      if (!message.metadata.correlationId) {
        message.metadata.correlationId = uuidv4();
      }
      
      // Set sender if not already set
      if (!message.sender) {
        message.sender = {
          id: fromAgent.definition.id,
          name: fromAgent.definition.name
        };
      }
      
      // Route message
      const response = await this.messageRouter.routeMessage(message);
      
      return response;
    } catch (error) {
      console.error(`Error sending message from agent ${fromAgent.definition.id}:`, error);
      
      // Create error response
      return this.protocolHandler.formatMessage({
        type: A2AMessageType.ERROR,
        sender: {
          id: 'a2a_system',
          name: 'A2A System'
        },
        recipient: {
          id: fromAgent.definition.id,
          name: fromAgent.definition.name
        },
        content: '',
        metadata: {
          timestamp: Date.now(),
          correlationId: message.metadata?.correlationId || uuidv4()
        },
        error: {
          code: 'message_sending_error',
          message: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }
  
  /**
   * Discover capabilities of other agents
   * @param fromAgent - The agent requesting capabilities
   * @param filter - Optional capability filter
   * @returns Promise resolving to available capabilities
   */
  public async discoverCapabilities(fromAgent: Agent, filter?: string[]): Promise<AgentCapability[]> {
    try {
      // Create discovery message
      const message = this.protocolHandler.formatMessage({
        type: A2AMessageType.CAPABILITY_DISCOVERY,
        sender: {
          id: fromAgent.definition.id,
          name: fromAgent.definition.name
        },
        recipient: null, // Broadcast
        content: filter ? JSON.stringify(filter) : '',
        metadata: {
          timestamp: Date.now(),
          correlationId: uuidv4()
        }
      });
      
      // Broadcast message
      await this.messageRouter.broadcastMessage(message);
      
      // Get capabilities from registry
      let capabilities: AgentCapability[] = [];
      
      if (filter && filter.length > 0) {
        // Filter capabilities
        for (const capability of filter) {
          const agents = this.registry.findAgentsByCapability(capability);
          for (const agent of agents) {
            capabilities = capabilities.concat(
              agent.capabilities.filter((cap: any) => cap.id === capability)
            );
          }
        }
      } else {
        // Get all capabilities
        const agents = this.registry.getAllAgents();
        for (const agent of agents) {
          capabilities = capabilities.concat(agent.capabilities);
        }
      }
      
      return capabilities;
    } catch (error) {
      console.error(`Error discovering capabilities for agent ${fromAgent.definition.id}:`, error);
      throw error;
    }
  }
  
  /**
   * Delegate a task to another agent
   * @param fromAgent - The delegating agent
   * @param toAgentId - The recipient agent ID
   * @param task - The task to delegate
   * @returns Promise resolving to the task result
   */
  public async delegateTask(fromAgent: Agent, toAgentId: string, task: A2ATask): Promise<A2ATaskResult> {
    try {
      // Ensure task has required fields
      if (!task.id) {
        task.id = uuidv4();
      }
      
      if (!task.delegatedBy) {
        task.delegatedBy = {
          id: fromAgent.definition.id,
          name: fromAgent.definition.name
        };
      }
      
      // Create task delegation message
      const message = this.protocolHandler.formatMessage({
        type: A2AMessageType.TASK_DELEGATION,
        sender: {
          id: fromAgent.definition.id,
          name: fromAgent.definition.name
        },
        recipient: {
          id: toAgentId,
          name: this.registry.getAgent(toAgentId)?.name || toAgentId
        },
        content: JSON.stringify(task),
        task: {
          id: task.id,
          description: task.description,
          status: TaskStatus.PENDING,
          delegatedBy: fromAgent.definition.id
        },
        metadata: {
          timestamp: Date.now(),
          correlationId: uuidv4()
        }
      });
      
      // Send message
      const response = await this.sendMessage(fromAgent, message);
      
      // Parse task result
      if (response.type === A2AMessageType.TASK_COMPLETION) {
        return JSON.parse(response.content);
      } else if (response.type === A2AMessageType.ERROR) {
        throw new Error(`Task delegation error: ${response.content}`);
      } else {
        throw new Error(`Unexpected response type: ${response.type}`);
      }
    } catch (error) {
      console.error(`Error delegating task from agent ${fromAgent.definition.id} to ${toAgentId}:`, error);
      
      // Create error result
      return {
        taskId: task.id,
        status: TaskStatus.FAILED,
        error: {
          code: 'task_delegation_error',
          message: error instanceof Error ? error.message : String(error)
        },
        completedBy: {
          id: 'a2a_system',
          name: 'A2A System'
        },
        completedAt: Date.now()
      };
    }
  }
  
  /**
   * Subscribe to task updates
   * @param taskId - The task ID to subscribe to
   * @param callback - The callback to invoke when updates are received
   * @returns Subscription object for managing the subscription
   */
  public subscribeToTaskUpdates(taskId: string, callback: (update: A2ATaskUpdate) => void): Subscription {
    // Create event handler
    const handler = (data: { taskId: string, update: A2ATaskUpdate }) => {
      if (data.taskId === taskId) {
        callback(data.update);
      }
    };
    
    // Subscribe to task updates
    const unsubscribe = this.eventBus.on('a2a:task:update', handler);
    
    // Return subscription
    return {
      unsubscribe: () => {
        // EventBus.on returns the callback function itself
        // We need to call off with the event name and callback
        this.eventBus.off('a2a:task:update', handler);
      }
    };
  }
}
