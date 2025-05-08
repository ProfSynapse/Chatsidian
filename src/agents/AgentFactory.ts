import { App } from 'obsidian';
import { IMCPClient } from '../mcp/client/MCPInterfaces';
import { Agent } from './Agent';
import { AgentDefinition } from './AgentTypes';

/**
 * Factory for creating agent instances
 */
export class AgentFactory {
  private app: App;
  
  /**
   * Create a new agent factory
   * @param app - Obsidian app instance
   */
  constructor(app: App) {
    this.app = app;
  }
  
  /**
   * Create an agent instance from a definition
   * @param definition - Agent definition
   * @param mcpClient - MCP client for the agent
   * @returns Agent instance
   */
  public createAgent(definition: AgentDefinition, mcpClient: IMCPClient): Agent {
    // Create the base agent
    const agent = new Agent(this.app, definition, mcpClient);
    
    // Initialize the agent
    agent.initialize().catch(error => {
      console.error(`Error initializing agent ${definition.id}:`, error);
    });
    
    return agent;
  }
  
  /**
   * Create multiple agents from definitions
   * @param definitions - Agent definitions
   * @param mcpClientFactory - Factory function for creating MCP clients
   * @returns Map of agent ID to agent instance
   */
  public createAgents(
    definitions: AgentDefinition[],
    mcpClientFactory: (tools: string[]) => IMCPClient
  ): Map<string, Agent> {
    const agents = new Map<string, Agent>();
    
    for (const definition of definitions) {
      // Create MCP client for this agent
      const mcpClient = mcpClientFactory(definition.tools);
      
      // Create agent
      const agent = this.createAgent(definition, mcpClient);
      
      // Add to map
      agents.set(definition.id, agent);
    }
    
    return agents;
  }
  
  /**
   * Create a clone of an existing agent with modified settings
   * @param sourceAgent - Source agent to clone
   * @param overrides - Definition overrides
   * @returns New agent instance
   */
  public cloneAgent(
    sourceAgent: Agent,
    overrides: Partial<AgentDefinition>
  ): Agent {
    // Create new definition with overrides
    const definition: AgentDefinition = {
      ...sourceAgent.definition,
      ...overrides,
      // Ensure ID is preserved if not explicitly overridden
      id: overrides.id || sourceAgent.definition.id
    };
    
    // Create new agent
    const agent = new Agent(this.app, definition, sourceAgent.mcpClient);
    
    // Initialize the agent
    agent.initialize().catch(error => {
      console.error(`Error initializing cloned agent ${definition.id}:`, error);
    });
    
    return agent;
  }
}