import { App } from 'obsidian';
import { EventBus } from '../core/EventBus';
import { SettingsManager } from '../core/SettingsManager';
import { MCPClient } from '../mcp/client/MCPClient';
import { IMCPClient, Conversation, Message, ToolCall, MessageRole } from '../mcp/client/MCPInterfaces';
import { ToolManager } from '../mcp/ToolManager';
import { Agent } from './Agent';
import { AgentDefinition } from './AgentTypes';

/**
 * Connector between Agent System and MCP infrastructure
 * Responsible for creating MCP clients for agents and handling tool execution
 */
export class MCPAgentConnector {
  private app: App;
  private eventBus: EventBus;
  private toolManager: ToolManager;
  private settings: SettingsManager;
  
  /**
   * Create a new MCP agent connector
   * @param app - Obsidian app instance
   * @param eventBus - Event bus
   * @param toolManager - Tool manager
   */
  constructor(
    app: App,
    eventBus: EventBus,
    toolManager: ToolManager,
    settings: SettingsManager
  ) {
    this.app = app;
    this.eventBus = eventBus;
    this.toolManager = toolManager;
    this.settings = settings;
  }
  
  /**
   * Create an MCP client for an agent
   * @param agent - Agent or agent definition
   * @returns MCP client configured for the agent
   */
  public createMCPClient(agent: Agent | AgentDefinition): IMCPClient {
    // Extract definition if agent instance provided
    const definition = 'definition' in agent ? agent.definition : agent;
    
    // Create MCP client
    const mcpClient = new MCPClient(
      this.app,
      this.settings,
      this.toolManager,
      this.eventBus
    );
    
    // Configure client for this agent
    this.configureMCPClient(mcpClient, definition);
    
    return mcpClient;
  }
  
  /**
   * Configure an MCP client for an agent
   * @param mcpClient - MCP client to configure
   * @param definition - Agent definition
   */
  private configureMCPClient(mcpClient: MCPClient, definition: AgentDefinition): void {
    // Filter tools based on agent's allowed tools
    const allowedTools = new Set(definition.tools);
    
    // Override getToolsForMCP to filter tools
    const originalGetToolsForMCP = this.toolManager.getToolsForMCP.bind(this.toolManager);
    this.toolManager.getToolsForMCP = () => {
      const allTools = originalGetToolsForMCP();
      return allTools.filter((tool: any) => {
        // Allow if tool name is in allowed tools
        if (allowedTools.has(tool.name)) {
          return true;
        }
        
        // Allow if domain.operation is in allowed tools
        if (tool.name.includes('.') && allowedTools.has(tool.name)) {
          return true;
        }
        
        return false;
      });
    };
  }
  
  /**
   * Process tool calls from an agent
   * @param agent - Agent that made the tool calls
   * @param conversation - Conversation context
   * @param toolCalls - Tool calls to process
   * @returns Promise resolving when tool calls are processed
   */
  public async processToolCalls(
    agent: Agent,
    conversation: Conversation,
    toolCalls: ToolCall[]
  ): Promise<void> {
    if (!toolCalls || toolCalls.length === 0) {
      return;
    }
    
    // Use the MCP client to process tool calls
    await agent.mcpClient.processToolCalls(conversation, {
      role: MessageRole.Assistant,
      content: '',
      tool_calls: toolCalls
    });
  }
  
  /**
   * Create an MCP client factory function
   * @returns Factory function for creating MCP clients
   */
  public createMCPClientFactory(): (tools: string[]) => IMCPClient {
    return (tools: string[]) => {
      // Create a dummy agent definition with the specified tools
      const dummyDefinition: AgentDefinition = {
        id: 'temp',
        name: 'Temporary Agent',
        role: 'general_assistant' as any,
        description: 'Temporary agent for MCP client creation',
        systemPrompt: '',
        tools,
        defaultSettings: {
          model: 'claude-3-opus-20240229',
          temperature: 0.7,
          maxTokens: 4000,
          stream: true
        },
        builtIn: false
      };
      
      return this.createMCPClient(dummyDefinition);
    };
  }
  
  /**
   * Handle a message from an agent
   * @param agent - Agent that sent the message
   * @param conversation - Conversation context
   * @param message - Message to handle
   * @returns Promise resolving to the processed message
   */
  public async handleAgentMessage(
    agent: Agent,
    conversation: Conversation,
    message: Message
  ): Promise<Message> {
    // For now, just return the message
    // In the future, this could handle special agent instructions
    return message;
  }
}
