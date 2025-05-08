import { App } from 'obsidian';
import { EventBus } from '../core/EventBus';
import { IA2ARegistry } from './interfaces';
import { AgentRegistration, AgentCapability, AgentCard } from './models/A2ATypes';

/**
 * A2A Registry
 * 
 * Maintains a registry of available agents, their capabilities, and endpoints.
 * Provides discovery mechanisms for finding agents and capabilities.
 */
export class A2ARegistry implements IA2ARegistry {
  private app: App;
  private eventBus: EventBus;
  private agents: Map<string, AgentRegistration> = new Map();
  
  /**
   * Create a new A2A registry
   * @param app - Obsidian app instance
   * @param eventBus - Event bus
   */
  constructor(
    app: App,
    eventBus: EventBus
  ) {
    this.app = app;
    this.eventBus = eventBus;
  }
  
  /**
   * Register an agent with the registry
   * @param agentId - The agent ID
   * @param capabilities - The agent's capabilities
   */
  public registerAgent(agentId: string, capabilities: AgentCapability[]): void {
    // Check if agent already exists
    if (this.agents.has(agentId)) {
      // Update existing agent
      const agent = this.agents.get(agentId)!;
      agent.capabilities = capabilities;
      this.agents.set(agentId, agent);
      
      // Emit event
      this.eventBus.emit('a2a:registry:agent:updated', {
        agentId,
        agent
      });
      
      return;
    }
    
    // Create new agent registration
    const agent: AgentRegistration = {
      id: agentId,
      name: agentId, // Use ID as name for now
      capabilities,
      endpoints: {
        messaging: `/a2a/agents/${agentId}/messages`,
        taskDelegation: `/a2a/agents/${agentId}/tasks`,
        capabilityDiscovery: `/a2a/agents/${agentId}/capabilities`
      }
    };
    
    // Add to registry
    this.agents.set(agentId, agent);
    
    // Emit event
    this.eventBus.emit('a2a:registry:agent:registered', {
      agentId,
      agent
    });
    
    console.log(`Agent ${agentId} registered with A2A registry`);
  }
  
  /**
   * Unregister an agent from the registry
   * @param agentId - The agent ID
   */
  public unregisterAgent(agentId: string): void {
    // Check if agent exists
    if (!this.agents.has(agentId)) {
      console.warn(`Agent ${agentId} not found in A2A registry`);
      return;
    }
    
    // Remove from registry
    this.agents.delete(agentId);
    
    // Emit event
    this.eventBus.emit('a2a:registry:agent:unregistered', {
      agentId
    });
    
    console.log(`Agent ${agentId} unregistered from A2A registry`);
  }
  
  /**
   * Get an agent registration by ID
   * @param agentId - The agent ID
   * @returns The agent registration or null if not found
   */
  public getAgent(agentId: string): AgentRegistration | null {
    return this.agents.get(agentId) || null;
  }
  
  /**
   * Find agents by capability
   * @param capability - The capability to search for
   * @returns Array of agent registrations with the capability
   */
  public findAgentsByCapability(capability: string): AgentRegistration[] {
    const result: AgentRegistration[] = [];
    
    // Search all agents
    for (const agent of this.agents.values()) {
      // Check if agent has capability
      const hasCapability = agent.capabilities.some(cap => cap.id === capability);
      
      if (hasCapability) {
        result.push(agent);
      }
    }
    
    return result;
  }
  
  /**
   * Get all registered agents
   * @returns Array of all agent registrations
   */
  public getAllAgents(): AgentRegistration[] {
    return Array.from(this.agents.values());
  }
  
  /**
   * Export an agent card for discovery
   * @param agentId - The agent ID
   * @returns The agent card
   */
  public exportAgentCard(agentId: string): AgentCard {
    // Get agent
    const agent = this.getAgent(agentId);
    
    if (!agent) {
      throw new Error(`Agent ${agentId} not found in A2A registry`);
    }
    
    // Create agent card
    const card: AgentCard = {
      id: agent.id,
      name: agent.name,
      capabilities: agent.capabilities,
      version: '1.0.0',
      endpoints: {
        messaging: agent.endpoints.messaging,
        taskDelegation: agent.endpoints.taskDelegation,
        capabilityDiscovery: agent.endpoints.capabilityDiscovery
      }
    };
    
    return card;
  }
  
  /**
   * Import an agent card from discovery
   * @param agentCard - The agent card
   */
  public importAgentCard(agentCard: AgentCard): void {
    // Create agent registration from card
    const agent: AgentRegistration = {
      id: agentCard.id,
      name: agentCard.name,
      capabilities: agentCard.capabilities,
      endpoints: {
        messaging: agentCard.endpoints.messaging || `/a2a/agents/${agentCard.id}/messages`,
        taskDelegation: agentCard.endpoints.taskDelegation || `/a2a/agents/${agentCard.id}/tasks`,
        capabilityDiscovery: agentCard.endpoints.capabilityDiscovery || `/a2a/agents/${agentCard.id}/capabilities`
      }
    };
    
    // Add to registry
    this.agents.set(agent.id, agent);
    
    // Emit event
    this.eventBus.emit('a2a:registry:agent:imported', {
      agentId: agent.id,
      agent
    });
    
    console.log(`Agent ${agent.id} imported from card into A2A registry`);
  }
  
  /**
   * Update an agent's capabilities
   * @param agentId - The agent ID
   * @param capabilities - The new capabilities
   */
  public updateAgentCapabilities(agentId: string, capabilities: AgentCapability[]): void {
    // Get agent
    const agent = this.getAgent(agentId);
    
    if (!agent) {
      throw new Error(`Agent ${agentId} not found in A2A registry`);
    }
    
    // Update capabilities
    agent.capabilities = capabilities;
    
    // Update registry
    this.agents.set(agentId, agent);
    
    // Emit event
    this.eventBus.emit('a2a:registry:agent:capabilities:updated', {
      agentId,
      capabilities
    });
    
    console.log(`Agent ${agentId} capabilities updated in A2A registry`);
  }
  
  /**
   * Update an agent's endpoints
   * @param agentId - The agent ID
   * @param endpoints - The new endpoints
   */
  public updateAgentEndpoints(
    agentId: string, 
    endpoints: {
      messaging?: string;
      taskDelegation?: string;
      capabilityDiscovery?: string;
    }
  ): void {
    // Get agent
    const agent = this.getAgent(agentId);
    
    if (!agent) {
      throw new Error(`Agent ${agentId} not found in A2A registry`);
    }
    
    // Update endpoints
    if (endpoints.messaging) {
      agent.endpoints.messaging = endpoints.messaging;
    }
    
    if (endpoints.taskDelegation) {
      agent.endpoints.taskDelegation = endpoints.taskDelegation;
    }
    
    if (endpoints.capabilityDiscovery) {
      agent.endpoints.capabilityDiscovery = endpoints.capabilityDiscovery;
    }
    
    // Update registry
    this.agents.set(agentId, agent);
    
    // Emit event
    this.eventBus.emit('a2a:registry:agent:endpoints:updated', {
      agentId,
      endpoints: agent.endpoints
    });
    
    console.log(`Agent ${agentId} endpoints updated in A2A registry`);
  }
  
  /**
   * Clear the registry
   */
  public clear(): void {
    // Clear all agents
    this.agents.clear();
    
    // Emit event
    this.eventBus.emit('a2a:registry:cleared', {});
    
    console.log('A2A registry cleared');
  }
}