import { App } from 'obsidian';
import { EventBus } from '../core/EventBus';
import { BCPRegistry } from '../mcp/BCPRegistry';
import { BoundedContextPack, Tool } from '../mcp/interfaces';
import { Agent } from './Agent';
import { AgentDefinition } from './AgentTypes';

/**
 * Connector between Agent System and BCP Registry
 * Responsible for connecting agents with Basic Capability Providers
 */
export class BCPAgentConnector {
  private app: App;
  private eventBus: EventBus;
  private bcpRegistry: BCPRegistry;
  
  /**
   * Create a new BCP agent connector
   * @param app - Obsidian app instance
   * @param eventBus - Event bus
   * @param bcpRegistry - BCP registry
   */
  constructor(
    app: App,
    eventBus: EventBus,
    bcpRegistry: BCPRegistry
  ) {
    this.app = app;
    this.eventBus = eventBus;
    this.bcpRegistry = bcpRegistry;
  }
  
  /**
   * Get available BCP capabilities for an agent
   * @param agent - Agent or agent definition
   * @returns Array of available BCP capabilities
   */
  public getAgentCapabilities(agent: Agent | AgentDefinition): string[] {
    // Extract definition if agent instance provided
    const definition = 'definition' in agent ? agent.definition : agent;
    
    // Get all registered BCPs
    const packDomains = this.bcpRegistry.getLoadedPacks();
    const bcps: BoundedContextPack[] = [];
    
    // Get each pack
    for (const domain of packDomains) {
      const pack = this.bcpRegistry.getPack(domain);
      if (pack) {
        bcps.push(pack);
      }
    }
    
    // Filter capabilities based on agent's allowed tools
    const allowedTools = new Set(definition.tools);
    const capabilities: string[] = [];
    
    // Collect all capabilities from BCPs that match allowed tools
    for (const bcp of bcps) {
      const bcpCapabilities = bcp.tools;
      
      for (const capability of bcpCapabilities) {
        const capabilityId = `${bcp.domain}.${capability.name}`;
        
        // Add if capability ID is in allowed tools
        if (allowedTools.has(capabilityId)) {
          capabilities.push(capabilityId);
        }
      }
    }
    
    return capabilities;
  }
  
  /**
   * Check if an agent has a specific capability
   * @param agent - Agent or agent definition
   * @param capabilityId - Capability ID (e.g., "NoteManager.readNote")
   * @returns Whether the agent has the capability
   */
  public hasCapability(agent: Agent | AgentDefinition, capabilityId: string): boolean {
    // Extract definition if agent instance provided
    const definition = 'definition' in agent ? agent.definition : agent;
    
    // Check if capability is in agent's allowed tools
    return definition.tools.includes(capabilityId);
  }
  
  /**
   * Execute a BCP capability for an agent
   * @param agent - Agent
   * @param capabilityId - Capability ID (e.g., "NoteManager.readNote")
   * @param params - Capability parameters
   * @returns Promise resolving to the capability result
   */
  public async executeCapability(
    agent: Agent,
    capabilityId: string,
    params: any
  ): Promise<any> {
    // Check if agent has the capability
    if (!this.hasCapability(agent, capabilityId)) {
      throw new Error(`Agent ${agent.definition.id} does not have capability: ${capabilityId}`);
    }
    
    // Parse capability ID
    const [bcpName, capabilityName] = capabilityId.split('.');
    
    if (!bcpName || !capabilityName) {
      throw new Error(`Invalid capability ID format: ${capabilityId}`);
    }
    
    // Get BCP
    const bcp = this.bcpRegistry.getPack(bcpName);
    
    if (!bcp) {
      throw new Error(`BCP not found: ${bcpName}`);
    }
    
    // Execute capability
    try {
      // Create execution context
      const context = {
        agent: agent.definition,
        app: this.app,
        timestamp: Date.now()
      };
      
      // Find the tool with the matching name
      const tool = bcp.tools.find((t: Tool) => t.name === capabilityName);
      
      if (!tool) {
        throw new Error(`Capability not found: ${capabilityName} in BCP ${bcpName}`);
      }
      
      // Execute the tool handler
      const result = await tool.handler(params, context);
      
      // Emit event
      this.eventBus.emit('agents:capabilityExecuted', {
        agentId: agent.definition.id,
        capabilityId,
        params,
        result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      // Emit error event
      this.eventBus.emit('agents:capabilityError', {
        agentId: agent.definition.id,
        capabilityId,
        params,
        error,
        timestamp: Date.now()
      });
      
      // Re-throw error
      throw error;
    }
  }
  
  /**
   * Get BCP capability metadata
   * @param capabilityId - Capability ID (e.g., "NoteManager.readNote")
   * @returns Capability metadata or null if not found
   */
  public getCapabilityMetadata(capabilityId: string): any | null {
    // Parse capability ID
    const [bcpName, capabilityName] = capabilityId.split('.');
    
    if (!bcpName || !capabilityName) {
      return null;
    }
    
    // Get BCP
    const bcp = this.bcpRegistry.getPack(bcpName);
    
    if (!bcp) {
      return null;
    }
    
    // Get capability
    const capabilities = bcp.tools;
    const capability = capabilities.find((cap: Tool) => cap.name === capabilityName);
    
    if (!capability) {
      return null;
    }
    
    return {
      id: capabilityId,
      name: capability.name,
      description: capability.description,
      parameters: capability.schema,
      schema: capability.schema,
      bcpName: bcp.domain,
      bcpDescription: bcp.description
    };
  }
  
  /**
   * Get all available BCP capabilities
   * @returns Array of capability metadata
   */
  public getAllCapabilities(): any[] {
    const capabilities: any[] = [];
    
    // Get all registered BCPs
    const packDomains = this.bcpRegistry.getLoadedPacks();
    const bcps: BoundedContextPack[] = [];
    
    // Get each pack
    for (const domain of packDomains) {
      const pack = this.bcpRegistry.getPack(domain);
      if (pack) {
        bcps.push(pack);
      }
    }
    
    // Collect all capabilities
    for (const bcp of bcps) {
      const bcpCapabilities = bcp.tools;
      
      for (const capability of bcpCapabilities) {
        capabilities.push({
          id: `${bcp.domain}.${capability.name}`,
          name: capability.name,
          description: capability.description,
          parameters: capability.schema,
          schema: capability.schema,
          bcpName: bcp.domain,
          bcpDescription: bcp.description
        });
      }
    }
    
    return capabilities;
  }
}