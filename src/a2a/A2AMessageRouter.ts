import { App } from 'obsidian';
import { EventBus } from '../core/EventBus';
import { IA2AMessageRouter } from './interfaces';
import { 
  A2AMessage, 
  A2AMessageFilter, 
  Subscription,
  A2AMessageType
} from './models/A2ATypes';
import { A2ARegistry } from './A2ARegistry';
import { v4 as uuidv4 } from 'uuid';

/**
 * A2A Message Router
 * 
 * Routes messages between agents based on addressing information.
 * Handles message subscriptions and broadcasting.
 */
export class A2AMessageRouter implements IA2AMessageRouter {
  private app: App;
  private eventBus: EventBus;
  private registry: A2ARegistry;
  private handlers: Map<string, (message: A2AMessage) => Promise<A2AMessage>> = new Map();
  private subscriptions: Map<string, { filter: A2AMessageFilter, callback: (message: A2AMessage) => void }> = new Map();
  
  /**
   * Create a new A2A message router
   * @param app - Obsidian app instance
   * @param eventBus - Event bus
   * @param registry - A2A registry
   */
  constructor(
    app: App,
    eventBus: EventBus,
    registry: A2ARegistry
  ) {
    this.app = app;
    this.eventBus = eventBus;
    this.registry = registry;
    
    // Register event listeners
    this.registerEventListeners();
  }
  
  /**
   * Register event listeners
   */
  private registerEventListeners(): void {
    // Listen for agent unregistration
    this.eventBus.on('a2a:registry:agent:unregistered', (data: { agentId: string }) => {
      // Remove handler for unregistered agent
      this.unregisterHandler(data.agentId);
    });
  }
  
  /**
   * Route a message to its recipient
   * @param message - The message to route
   * @returns Promise resolving to the response message
   */
  public async routeMessage(message: A2AMessage): Promise<A2AMessage> {
    try {
      // Validate message
      if (!message.id || !message.type || !message.sender || !message.metadata) {
        throw new Error('Invalid message: missing required fields');
      }
      
      // Log message routing
      console.log(`Routing A2A message ${message.id} from ${message.sender.id} to ${message.recipient?.id || 'broadcast'}`);
      
      // Emit event
      this.eventBus.emit('a2a:message:routed', {
        messageId: message.id,
        message
      });
      
      // Check if broadcast message
      if (!message.recipient) {
        await this.broadcastMessage(message);
        
        // Return acknowledgment for broadcast
        return {
          id: uuidv4(),
          type: A2AMessageType.RESPONSE,
          sender: {
            id: 'a2a_system',
            name: 'A2A System'
          },
          recipient: message.sender,
          content: 'Message broadcast successfully',
          metadata: {
            timestamp: Date.now(),
            correlationId: message.metadata.correlationId
          }
        };
      }
      
      // Get handler for recipient
      const handler = this.handlers.get(message.recipient.id);
      
      if (!handler) {
        throw new Error(`No handler registered for agent ${message.recipient.id}`);
      }
      
      // Call handler
      const response = await handler(message);
      
      // Notify subscribers
      this.notifySubscribers(message);
      
      return response;
    } catch (error) {
      console.error('Error routing A2A message:', error);
      
      // Return error message
      return {
        id: uuidv4(),
        type: A2AMessageType.ERROR,
        sender: {
          id: 'a2a_system',
          name: 'A2A System'
        },
        recipient: message.sender,
        content: '',
        metadata: {
          timestamp: Date.now(),
          correlationId: message.metadata?.correlationId || uuidv4()
        },
        error: {
          code: 'message_routing_error',
          message: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }
  
  /**
   * Register a message handler for an agent
   * @param agentId - The agent ID
   * @param handler - The message handler function
   */
  public registerHandler(agentId: string, handler: (message: A2AMessage) => Promise<A2AMessage>): void {
    // Register handler
    this.handlers.set(agentId, handler);
    
    // Log registration
    console.log(`Registered A2A message handler for agent ${agentId}`);
    
    // Emit event
    this.eventBus.emit('a2a:message:handler:registered', {
      agentId
    });
  }
  
  /**
   * Unregister a message handler for an agent
   * @param agentId - The agent ID
   */
  public unregisterHandler(agentId: string): void {
    // Check if handler exists
    if (!this.handlers.has(agentId)) {
      console.warn(`No A2A message handler registered for agent ${agentId}`);
      return;
    }
    
    // Unregister handler
    this.handlers.delete(agentId);
    
    // Log unregistration
    console.log(`Unregistered A2A message handler for agent ${agentId}`);
    
    // Emit event
    this.eventBus.emit('a2a:message:handler:unregistered', {
      agentId
    });
  }
  
  /**
   * Broadcast a message to multiple agents
   * @param message - The broadcast message
   * @returns Promise resolving when broadcast is complete
   */
  public async broadcastMessage(message: A2AMessage): Promise<void> {
    try {
      // Validate message
      if (!message.id || !message.type || !message.sender || !message.metadata) {
        throw new Error('Invalid message: missing required fields');
      }
      
      // Log broadcast
      console.log(`Broadcasting A2A message ${message.id} from ${message.sender.id}`);
      
      // Get all agents
      const agents = this.registry.getAllAgents();
      
      // Send message to each agent (except sender)
      const promises: Promise<void>[] = [];
      
      for (const agent of agents) {
        // Skip sender
        if (agent.id === message.sender.id) {
          continue;
        }
        
        // Get handler for agent
        const handler = this.handlers.get(agent.id);
        
        if (!handler) {
          console.warn(`No handler registered for agent ${agent.id}, skipping broadcast`);
          continue;
        }
        
        // Create directed message
        const directedMessage: A2AMessage = {
          ...message,
          recipient: {
            id: agent.id,
            name: agent.name
          }
        };
        
        // Call handler asynchronously
        promises.push(
          handler(directedMessage)
            .then(() => {
              // Notify subscribers
              this.notifySubscribers(directedMessage);
            })
            .catch(error => {
              console.error(`Error broadcasting to agent ${agent.id}:`, error);
            })
        );
      }
      
      // Wait for all handlers to complete
      await Promise.all(promises);
      
      // Emit event
      this.eventBus.emit('a2a:message:broadcast', {
        messageId: message.id,
        message
      });
    } catch (error) {
      console.error('Error broadcasting A2A message:', error);
      throw error;
    }
  }
  
  /**
   * Subscribe to messages based on a filter
   * @param filter - The message filter
   * @param callback - The callback to invoke when messages are received
   * @returns Subscription object for managing the subscription
   */
  public subscribeToMessages(filter: A2AMessageFilter, callback: (message: A2AMessage) => void): Subscription {
    // Generate subscription ID
    const subscriptionId = uuidv4();
    
    // Register subscription
    this.subscriptions.set(subscriptionId, {
      filter,
      callback
    });
    
    // Log subscription
    console.log(`Registered A2A message subscription ${subscriptionId}`);
    
    // Return subscription
    return {
      unsubscribe: () => {
        // Unregister subscription
        this.subscriptions.delete(subscriptionId);
        
        // Log unsubscription
        console.log(`Unregistered A2A message subscription ${subscriptionId}`);
      }
    };
  }
  
  /**
   * Notify subscribers of a message
   * @param message - The message
   */
  private notifySubscribers(message: A2AMessage): void {
    // Check each subscription
    for (const [subscriptionId, subscription] of this.subscriptions.entries()) {
      // Check filter
      if (this.matchesFilter(message, subscription.filter)) {
        try {
          // Call callback
          subscription.callback(message);
        } catch (error) {
          console.error(`Error in A2A message subscription ${subscriptionId} callback:`, error);
        }
      }
    }
  }
  
  /**
   * Check if a message matches a filter
   * @param message - The message
   * @param filter - The filter
   * @returns Whether the message matches the filter
   */
  private matchesFilter(message: A2AMessage, filter: A2AMessageFilter): boolean {
    // Check sender
    if (filter.sender && message.sender.id !== filter.sender) {
      return false;
    }
    
    // Check recipient
    if (filter.recipient && (!message.recipient || message.recipient.id !== filter.recipient)) {
      return false;
    }
    
    // Check type
    if (filter.type) {
      if (Array.isArray(filter.type)) {
        if (!filter.type.includes(message.type)) {
          return false;
        }
      } else if (message.type !== filter.type) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Clear all handlers and subscriptions
   */
  public clear(): void {
    // Clear handlers
    this.handlers.clear();
    
    // Clear subscriptions
    this.subscriptions.clear();
    
    // Log clear
    console.log('Cleared all A2A message handlers and subscriptions');
    
    // Emit event
    this.eventBus.emit('a2a:message:router:cleared', {});
  }
}