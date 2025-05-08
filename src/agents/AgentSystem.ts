import { App, Component } from 'obsidian';
import { EventBus } from '../core/EventBus';
import { SettingsManager } from '../core/SettingsManager';
import { VaultFacade } from '../core/VaultFacade';
import { BCPRegistry } from '../mcp/BCPRegistry';
import { ToolManager } from '../mcp/ToolManager';
import { Conversation, Message, MessageRole } from '../mcp/client/MCPInterfaces';
import { Agent } from './Agent';
import { AgentDefinition, AgentRole, AgentSettings, AssistantMessage } from './AgentTypes';
import { AgentContext } from './AgentContext';
import { AgentFactory } from './AgentFactory';
import { AgentOrchestrator } from './AgentOrchestrator';
import { BCPAgentConnector } from './BCPAgentConnector';
import { MCPAgentConnector } from './MCPAgentConnector';
import { v4 as uuidv4 } from 'uuid';

/**
 * Main Agent System class that coordinates all agent-related functionality
 * Extends Component for proper lifecycle management
 */
export class AgentSystem extends Component {
  private app: App;
  private eventBus: EventBus;
  private settings: SettingsManager;
  private vaultFacade: VaultFacade;
  private bcpRegistry: BCPRegistry;
  private toolManager: ToolManager;
  
  // Agent system components
  private agentFactory: AgentFactory;
  private agentOrchestrator: AgentOrchestrator;
  private bcpConnector: BCPAgentConnector;
  private mcpConnector: MCPAgentConnector;
  
  // Agent definitions and instances
  private agentDefinitions: Map<string, AgentDefinition> = new Map();
  private builtInAgents: Set<string> = new Set();
  
  /**
   * Create a new Agent System
   * @param app - Obsidian app instance
   * @param eventBus - Event bus
   * @param settings - Settings manager
   * @param vaultFacade - Vault facade
   * @param bcpRegistry - BCP registry
   * @param toolManager - Tool manager
   */
  constructor(
    app: App,
    eventBus: EventBus,
    settings: SettingsManager,
    vaultFacade: VaultFacade,
    bcpRegistry: BCPRegistry,
    toolManager: ToolManager
  ) {
    super();
    
    this.app = app;
    this.eventBus = eventBus;
    this.settings = settings;
    this.vaultFacade = vaultFacade;
    this.bcpRegistry = bcpRegistry;
    this.toolManager = toolManager;
    
    // Create agent system components
    this.agentFactory = new AgentFactory(app);
    this.agentOrchestrator = new AgentOrchestrator(app, eventBus);
    this.bcpConnector = new BCPAgentConnector(app, eventBus, bcpRegistry);
    this.mcpConnector = new MCPAgentConnector(app, eventBus, toolManager, settings);
  }
  
  /**
   * Component lifecycle method - called when component is loaded
   */
  async onload(): Promise<void> {
    console.log('AgentSystem: loaded');
    
    // Register built-in agent definitions
    this.registerBuiltInAgents();
    
    // Load custom agent definitions
    await this.loadCustomAgents();
    
    // Register event listeners
    this.registerEventListeners();
    
    // Log initialization
    console.log('Agent system initialized with', this.agentDefinitions.size, 'agent definitions');
  }
  
  /**
   * Component lifecycle method - called when component is unloaded
   */
  async onunload(): Promise<void> {
    console.log('AgentSystem: unloaded');
    
    // Clean up resources
    this.agentDefinitions.clear();
    this.builtInAgents.clear();
  }
  
  /**
   * Register event listeners
   */
  private registerEventListeners(): void {
    // Listen for settings changes
    this.registerEvent(
      this.eventBus.on('settings:updated', (data) => {
        // Check if agent settings changed
        if (data.changedKeys.includes('agents')) {
          // Reload custom agents
          this.loadCustomAgents().catch(error => {
            console.error('Failed to reload custom agents:', error);
          });
        }
      })
    );
  }
  
  /**
   * Register built-in agent definitions
   */
  private registerBuiltInAgents(): void {
    // General Assistant
    this.registerAgentDefinition({
      id: 'general_assistant',
      name: 'General Assistant',
      role: AgentRole.GeneralAssistant,
      description: 'A helpful, general-purpose assistant that can assist with a wide range of tasks.',
      systemPrompt: `You are a helpful AI assistant embedded in Obsidian via the Chatsidian plugin.
      
You can help the user with a wide range of tasks, including answering questions, providing information, 
and assisting with various writing and thinking tasks.

You have access to the user's Obsidian vault through specially provided tools, but you should only use 
these tools when explicitly asked to interact with the vault.

When asked questions, be helpful, accurate, and concise. If you don't know the answer to a question, 
don't make up information - just say you don't know.`,
      tools: [
        'NoteManager.readNote'
      ],
      defaultSettings: {
        model: 'claude-3-opus-20240229',
        temperature: 0.7,
        maxTokens: 4000,
        stream: true
      },
      builtIn: true,
      emoji: '🤖',
      capabilities: [
        'Answer questions and provide information',
        'Engage in thoughtful conversation',
        'Assist with writing and thinking tasks',
        'Read notes from the vault when specifically asked'
      ],
      limitations: [
        'Limited vault access (read-only)',
        'Cannot search or navigate the vault',
        'Cannot create or modify notes',
        'Limited awareness of vault structure'
      ],
      created: Date.now()
    });
    
    // Vault Manager
    this.registerAgentDefinition({
      id: 'vault_manager',
      name: 'Vault Manager',
      role: AgentRole.VaultManager,
      description: 'A specialized assistant for managing, organizing, and navigating your Obsidian vault.',
      systemPrompt: `You are an AI assistant specialized in Obsidian vault management.

You have comprehensive access to the user's Obsidian vault through a set of specialized tools.
Your primary purpose is to help the user manage, organize, and navigate their vault effectively.

You can:
- Create, read, update, and delete notes and folders
- Search for content within the vault
- Help organize and restructure the vault
- Create and manage backlinks and connections between notes
- Suggest improvements to vault structure

When the user asks for help with their vault, be proactive in using your tools to assist them.
Always prioritize preserving user data and confirming before making significant changes.`,
      tools: [
        'NoteManager.readNote',
        'NoteManager.createNote',
        'NoteManager.updateNote',
        'NoteManager.deleteNote',
        'NoteManager.appendToNote',
        'NoteManager.prependToNote',
        'NoteManager.replaceInNote',
        'FolderManager.createFolder',
        'FolderManager.listFolder',
        'FolderManager.deleteFolder',
        'FolderManager.listRecursive',
        'VaultLibrarian.searchContent',
        'VaultLibrarian.searchTag',
        'VaultLibrarian.findRecentNotes'
      ],
      defaultSettings: {
        model: 'claude-3-opus-20240229',
        temperature: 0.5,
        maxTokens: 4000,
        stream: true
      },
      builtIn: true,
      emoji: '📁',
      capabilities: [
        'Comprehensive vault management',
        'Note and folder operations',
        'Content search and organization',
        'Structure improvements and recommendations',
        'Vault navigation assistance'
      ],
      limitations: [
        'Cannot access system files outside the vault',
        'Actions limited to vault-related tasks',
        'Cannot commit to git or other version control systems',
        'Cannot install or manage plugins'
      ],
      created: Date.now()
    });
    
    // Knowledge Base
    this.registerAgentDefinition({
      id: 'knowledge_base',
      name: 'Knowledge Base',
      role: AgentRole.KnowledgeBase,
      description: 'An assistant specialized in knowledge retrieval and synthesis from your vault.',
      systemPrompt: `You are an AI assistant specialized in knowledge retrieval and synthesis within the user's Obsidian vault.

Your primary purpose is to help the user find, understand, and connect information stored in their vault.
You can search throughout the vault, find connections between notes, and synthesize information into helpful responses.

Your strengths include:
- Finding relevant information across the user's knowledge base
- Connecting related concepts and notes
- Summarizing and synthesizing information from multiple sources
- Providing accurate answers based on the user's own knowledge

When the user asks a question, always search their vault first before relying on your general knowledge.
Present information clearly, cite specific notes, and help the user expand their knowledge base when appropriate.`,
      tools: [
        'NoteManager.readNote',
        'VaultLibrarian.searchContent',
        'VaultLibrarian.searchTag',
        'VaultLibrarian.searchProperty',
        'VaultLibrarian.findLinksTo',
        'FolderManager.listFolder',
        'FolderManager.listRecursive'
      ],
      defaultSettings: {
        model: 'claude-3-opus-20240229',
        temperature: 0.3,
        maxTokens: 8000,
        stream: true
      },
      builtIn: true,
      emoji: '📚',
      capabilities: [
        'Comprehensive vault search',
        'Information retrieval and synthesis',
        'Connecting related information',
        'Answering questions from vault content',
        'Finding and explaining connections between notes'
      ],
      limitations: [
        'Read-only access to the vault',
        'Cannot modify or create notes',
        'Answer quality depends on vault content',
        'Cannot access external information sources'
      ],
      created: Date.now()
    });
  }
  
  /**
   * Load custom agent definitions from settings
   */
  private async loadCustomAgents(): Promise<void> {
    try {
      const settings = this.settings.getSettings();
      const customAgents = settings.customAgents || [];
      
      // Register each custom agent
      for (const agentData of customAgents as AgentDefinition[]) {
        try {
          // Skip if already registered as built-in
          if (this.builtInAgents.has(agentData.id)) {
            continue;
          }
          
          // Register agent definition
          this.registerAgentDefinition(agentData);
        } catch (error) {
          console.error(`Error loading custom agent ${agentData.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error loading custom agents:', error);
    }
  }
  
  /**
   * Register an agent definition
   * @param definition - Agent definition
   */
  public registerAgentDefinition(definition: AgentDefinition): void {
    // Validate definition
    if (!definition.id) {
      throw new Error('Agent ID is required');
    }
    
    if (!definition.name) {
      throw new Error('Agent name is required');
    }
    
    if (!definition.role) {
      throw new Error('Agent role is required');
    }
    
    // Add to definitions
    this.agentDefinitions.set(definition.id, definition);
    
    // Track built-in agents
    if (definition.builtIn) {
      this.builtInAgents.add(definition.id);
    }
    
    // Emit event
    this.eventBus.emit('agents:definitionRegistered', {
      id: definition.id,
      definition
    });
  }
  
  /**
   * Get an agent definition by ID
   * @param id - Agent ID
   * @returns Agent definition or undefined
   */
  public getAgentDefinition(id: string): AgentDefinition | undefined {
    return this.agentDefinitions.get(id);
  }
  
  /**
   * Get all agent definitions
   * @returns Array of agent definitions
   */
  public getAllAgentDefinitions(): AgentDefinition[] {
    return Array.from(this.agentDefinitions.values());
  }
  
  /**
   * Create an agent instance from a definition
   * @param id - Agent definition ID
   * @returns Agent instance
   */
  public createAgent(id: string): Agent {
    // Get definition
    const definition = this.getAgentDefinition(id);
    
    if (!definition) {
      throw new Error(`Agent definition not found: ${id}`);
    }
    
    // Create MCP client
    const mcpClient = this.mcpConnector.createMCPClient(definition);
    
    // Create agent
    const agent = this.agentFactory.createAgent(definition, mcpClient);
    
    // Register with orchestrator
    this.agentOrchestrator.registerAgent(agent);
    
    return agent;
  }
  
  /**
   * Process a message with the agent system
   * @param conversation - Conversation for context
   * @param message - Message to process
   * @param agentId - Optional agent ID to use
   * @returns Promise resolving to the agent's response
   */
  public async processMessage(
    conversation: Conversation,
    message: Message,
    agentId?: string
  ): Promise<AssistantMessage> {
    return await this.agentOrchestrator.processMessage(
      conversation,
      message,
      agentId
    );
  }
  
  /**
   * Create a new conversation
   * @param title - Conversation title
   * @returns New conversation
   */
  public createConversation(title: string): Conversation {
    return {
      id: uuidv4(),
      title: title || 'New Conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }
  
  /**
   * Get the agent orchestrator
   * @returns Agent orchestrator
   */
  public getOrchestrator(): AgentOrchestrator {
    return this.agentOrchestrator;
  }
  
  /**
   * Get the BCP connector
   * @returns BCP connector
   */
  public getBCPConnector(): BCPAgentConnector {
    return this.bcpConnector;
  }
  
  /**
   * Get the MCP connector
   * @returns MCP connector
   */
  public getMCPConnector(): MCPAgentConnector {
    return this.mcpConnector;
  }
  
  /**
   * Save a custom agent definition
   * @param definition - Agent definition
   * @returns Promise resolving when saved
   */
  public async saveCustomAgentDefinition(definition: AgentDefinition): Promise<void> {
    try {
      // Don't allow modifying built-in agents
      if (this.builtInAgents.has(definition.id)) {
        throw new Error(`Cannot modify built-in agent: ${definition.id}`);
      }
      
      // Update timestamps
      if (!definition.created) {
        definition.created = Date.now();
      }
      
      definition.modified = Date.now();
      
      // Register definition
      this.registerAgentDefinition(definition);
      
      // Update settings
      const settings = this.settings.getSettings();
      const customAgents = settings.customAgents || [];
      
      // Find existing agent
      const existingIndex = customAgents.findIndex((a: AgentDefinition) => a.id === definition.id);
      
      if (existingIndex >= 0) {
        // Update existing
        customAgents[existingIndex] = definition;
      } else {
        // Add new
        customAgents.push(definition);
      }
      
      // Save settings
      await this.settings.updateSettings({
        customAgents: customAgents
      });
    } catch (error) {
      console.error(`Error saving custom agent ${definition.id}:`, error);
      throw error;
    }
  }
  
  /**
   * Delete a custom agent definition
   * @param id - Agent ID
   * @returns Promise resolving when deleted
   */
  public async deleteCustomAgentDefinition(id: string): Promise<void> {
    try {
      // Don't allow deleting built-in agents
      if (this.builtInAgents.has(id)) {
        throw new Error(`Cannot delete built-in agent: ${id}`);
      }
      
      // Remove from definitions
      this.agentDefinitions.delete(id);
      
      // Update settings
      const settings = this.settings.getSettings();
      const customAgents = settings.customAgents || [];
      
      // Filter out agent
      const updatedAgents = customAgents.filter((a: AgentDefinition) => a.id !== id);
      
      // Save settings
      await this.settings.updateSettings({
        customAgents: updatedAgents
      });
      
      // Emit event
      this.eventBus.emit('agents:definitionDeleted', {
        id
      });
    } catch (error) {
      console.error(`Error deleting custom agent ${id}:`, error);
      throw error;
    }
  }
}
