---
title: Phase 2.8 - Agent System Implementation
description: Implementation plan for the agent management system in Chatsidian
date: 2025-05-03
status: implementation
tags:
  - implementation
  - phase-2
  - agents
  - mcp
  - ai-personalities
---

# Phase 2.8: Agent System Implementation

## Overview

This micro-phase focuses on implementing the agent management system for Chatsidian. Agents are specialized AI personalities with specific capabilities, knowledge, and behaviors designed for different use cases. The agent system provides a framework for defining, customizing, and selecting agents, allowing users to interact with the most appropriate AI assistant for their needs. This phase builds upon the advanced MCP features developed in Phase 2.7 and prepares for integration with the BCP architecture in Phase 2.9.

## Goals

- Create a flexible agent management system
- Implement agent definition storage
- Add agent execution flow
- Create agent customization options
- Develop agent selection UI
- Add persistence for agent settings


## Implementation Steps

### 1. Define Agent System Interfaces

First, let's define the core interfaces for the agent system:

```typescript
/**
 * Agent role (persona)
 */
export enum AgentRole {
  GeneralAssistant = 'general_assistant',
  VaultManager = 'vault_manager',
  KnowledgeBase = 'knowledge_base',
  ProjectPlanner = 'project_planner',
  ContentWriter = 'content_writer',
  ResearchAssistant = 'research_assistant',
  CodeAssistant = 'code_assistant',
  Custom = 'custom'
}

/**
 * Agent definition
 */
export interface AgentDefinition {
  /**
   * Agent ID (unique)
   */
  id: string;
  
  /**
   * Agent name
   */
  name: string;
  
  /**
   * Agent role
   */
  role: AgentRole;
  
  /**
   * Agent description
   */
  description: string;
  
  /**
   * System prompt template
   */
  systemPrompt: string;
  
  /**
   * Available tools
   */
  tools: string[];
  
  /**
   * Default model settings
   */
  defaultSettings: AgentSettings;
  
  /**
   * Whether this is a built-in agent
   */
  builtIn: boolean;
  
  /**
   * Emoji for the agent avatar
   */
  emoji?: string;
  
  /**
   * Agent capabilities (for UI display)
   */
  capabilities?: string[];
  
  /**
   * Agent limitations (for UI display)
   */
  limitations?: string[];
  
  /**
   * Creation date
   */
  created?: number;
  
  /**
   * Last modified date
   */
  modified?: number;
}

/**
 * Agent settings
 */
export interface AgentSettings {
  /**
   * Model to use
   */
  model: string;
  
  /**
   * Temperature (0-1)
   */
  temperature: number;
  
  /**
   * Maximum tokens to generate
   */
  maxTokens: number;
  
  /**
   * Whether to stream responses
   */
  stream: boolean;
  
  /**
   * Additional settings
   */
  [key: string]: any;
}

/**
 * Agent instance
 */
export interface Agent {
  /**
   * Agent definition
   */
  definition: AgentDefinition;
  
  /**
   * Agent settings
   */
  settings: AgentSettings;
  
  /**
   * MCP client for the agent
   */
  mcpClient: ResilientMCPClient;
  
  /**
   * Send a message to the agent
   * @param conversation - Conversation for context
   * @param message - Message to send
   * @returns Promise resolving to the agent's response
   */
  sendMessage(
    conversation: Conversation,
    message: Message
  ): Promise<AssistantMessage>;
  
  /**
   * Stream a message from the agent
   * @param conversation - Conversation for context
   * @param message - Message to send
   * @param handlers - Stream handlers
   * @returns Promise resolving to the agent's response
   */
  streamMessage(
    conversation: Conversation,
    message: Message,
    handlers: StreamHandlers
  ): Promise<AssistantMessage>;
}
```


### 2. Implement the Agent Manager

Next, let's implement the core agent manager component:

```typescript
/**
 * Manager for agent definitions and instances
 */
export class AgentManager {
  /**
   * Agent definitions
   */
  private definitions: Map<string, AgentDefinition> = new Map();
  
  /**
   * Active agent instances
   */
  private instances: Map<string, Agent> = new Map();
  
  /**
   * Default agent ID
   */
  private defaultAgentId: string;
  
  /**
   * App reference
   */
  private app: App;
  
  /**
   * Settings manager
   */
  private settings: SettingsManager;
  
  /**
   * Event bus
   */
  private eventBus: EventBus;
  
  /**
   * Tool manager
   */
  private toolManager: ToolManager;
  
  /**
   * MCP client factory
   */
  private mcpClientFactory: (tools: string[]) => ResilientMCPClient;
  
  /**
   * Storage path for agent definitions
   */
  private storagePath: string;
  
  /**
   * Create a new agent manager
   * @param app - App reference
   * @param settings - Settings manager
   * @param eventBus - Event bus
   * @param toolManager - Tool manager
   * @param mcpClientFactory - Factory for creating MCP clients
   */
  constructor(
    app: App,
    settings: SettingsManager,
    eventBus: EventBus,
    toolManager: ToolManager,
    mcpClientFactory: (tools: string[]) => ResilientMCPClient
  ) {
    this.app = app;
    this.settings = settings;
    this.eventBus = eventBus;
    this.toolManager = toolManager;
    this.mcpClientFactory = mcpClientFactory;
    this.storagePath = '.chatsidian/agents';
    
    // Set default agent ID
    this.defaultAgentId = this.settings.getSettings().defaultAgentId || 'general_assistant';
  }
  
  /**
   * Initialize the agent manager
   */
  public async initialize(): Promise<void> {
    // Ensure storage directory exists
    await this.ensureStorageDirectory();
    
    // Register built-in agent definitions
    this.registerBuiltInAgents();
    
    // Load custom agent definitions
    await this.loadCustomAgents();
    
    // Create agent instance for default agent
    await this.getOrCreateAgentInstance(this.defaultAgentId);
    
    // Log initialization
    console.log('Agent manager initialized');
  }
  
  /**
   * Ensure storage directory exists
   */
  private async ensureStorageDirectory(): Promise<void> {
    // Check if directory exists
    if (!this.app.vault.getAbstractFileByPath(this.storagePath)) {
      // Create directory
      await this.app.vault.createFolder(this.storagePath);
    }
  }
  
  /**
   * Register an agent definition
   * @param definition - Agent definition
   */
  public registerAgentDefinition(definition: AgentDefinition): void {
    this.definitions.set(definition.id, definition);
    
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
    return this.definitions.get(id);
  }
  
  /**
   * Get all agent definitions
   * @returns Array of agent definitions
   */
  public getAllAgentDefinitions(): AgentDefinition[] {
    return Array.from(this.definitions.values());
  }
  
  /**
   * Get or create an agent instance
   * @param id - Agent ID
   * @returns Agent instance
   */
  public async getOrCreateAgentInstance(id: string): Promise<Agent> {
    // Check if instance exists
    if (this.instances.has(id)) {
      return this.instances.get(id);
    }
    
    // Get definition
    const definition = this.getAgentDefinition(id);
    
    if (!definition) {
      throw new Error(`Agent definition not found: ${id}`);
    }
    
    // Create MCP client
    const mcpClient = this.mcpClientFactory(definition.tools);
    
    // Create agent instance
    const agent: Agent = {
      definition,
      settings: { ...definition.defaultSettings },
      mcpClient,
      
      // Send a message
      async sendMessage(conversation, message) {
        // Add system message if not present
        if (!conversation.messages.some(msg => msg.role === MessageRole.System)) {
          // Add system message with agent's system prompt
          conversation.messages.unshift({
            role: MessageRole.System,
            content: definition.systemPrompt
          });
        }
        
        // Send message through MCP client
        return await mcpClient.sendMessageWithRecovery(
          conversation,
          message,
          {
            model: this.settings.model,
            temperature: this.settings.temperature,
            maxTokens: this.settings.maxTokens,
            stream: this.settings.stream
          }
        );
      },
      
      // Stream a message
      async streamMessage(conversation, message, handlers) {
        // Add system message if not present
        if (!conversation.messages.some(msg => msg.role === MessageRole.System)) {
          // Add system message with agent's system prompt
          conversation.messages.unshift({
            role: MessageRole.System,
            content: definition.systemPrompt
          });
        }
        
        // Stream message through MCP client
        return await mcpClient.streamMessageWithHandlers(
          conversation,
          message,
          handlers,
          {
            model: this.settings.model,
            temperature: this.settings.temperature,
            maxTokens: this.settings.maxTokens,
            stream: true
          }
        );
      }
    };
    
    // Store instance
    this.instances.set(id, agent);
    
    // Emit event
    this.eventBus.emit('agents:instanceCreated', {
      id,
      agent
    });
    
    return agent;
  }
  
  /**
   * Get the default agent instance
   * @returns Default agent instance
   */
  public async getDefaultAgent(): Promise<Agent> {
    return await this.getOrCreateAgentInstance(this.defaultAgentId);
  }
  
  /**
   * Set the default agent
   * @param id - Agent ID
   */
  public async setDefaultAgent(id: string): Promise<void> {
    // Check if agent exists
    if (!this.definitions.has(id)) {
      throw new Error(`Agent definition not found: ${id}`);
    }
    
    // Update default agent ID
    this.defaultAgentId = id;
    
    // Update settings
    await this.settings.updateSettings({
      defaultAgentId: id
    });
    
    // Emit event
    this.eventBus.emit('agents:defaultAgentChanged', {
      id
    });
  }
  
  /**
   * Update agent settings
   * @param id - Agent ID
   * @param settings - New settings
   */
  public async updateAgentSettings(id: string, settings: Partial<AgentSettings>): Promise<void> {
    // Get agent instance
    const agent = await this.getOrCreateAgentInstance(id);
    
    // Update settings
    agent.settings = {
      ...agent.settings,
      ...settings
    };
    
    // Emit event
    this.eventBus.emit('agents:settingsUpdated', {
      id,
      settings: agent.settings
    });
  }
}
```


### 3. Implement Built-in Agent Definitions

Now, let's implement the registration of built-in agent definitions:

```typescript
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
    systemPrompt: `You are Claude, a helpful AI assistant embedded in Obsidian via the Chatsidian plugin.
    
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
    systemPrompt: `You are Claude, an AI assistant specialized in Obsidian vault management.

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
    systemPrompt: `You are Claude, an AI assistant specialized in knowledge retrieval and synthesis within the user's Obsidian vault.

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
  
  // Project Planner
  this.registerAgentDefinition({
    id: 'project_planner',
    name: 'Project Planner',
    role: AgentRole.ProjectPlanner,
    description: 'An assistant specialized in project planning, task management, and workflow optimization.',
    systemPrompt: `You are Claude, an AI assistant specialized in project planning and task management.

Your primary purpose is to help the user plan, organize, and execute projects efficiently.
You can create project structures, break down complex tasks, track progress, and suggest improvements.

Your strengths include:
- Creating well-structured project plans
- Breaking down complex goals into manageable tasks
- Setting up effective tracking systems
- Suggesting process improvements and optimizations
- Creating templates for recurring workflows

When the user needs help with a project, be methodical and thorough in your planning approach.
Focus on clarity, actionability, and practicality in your suggestions and plans.`,
    tools: [
      'NoteManager.readNote',
      'NoteManager.createNote',
      'NoteManager.updateNote',
      'NoteManager.appendToNote',
      'FolderManager.createFolder',
      'FolderManager.listFolder',
      'VaultLibrarian.searchContent',
      'VaultLibrarian.searchTag'
    ],
    defaultSettings: {
      model: 'claude-3-opus-20240229',
      temperature: 0.4,
      maxTokens: 6000,
      stream: true
    },
    builtIn: true,
    emoji: '📋',
    capabilities: [
      'Project planning and structuring',
      'Task breakdown and organization',
      'Timeline and milestone creation',
      'Template generation for workflows',
      'Progress tracking setup'
    ],
    limitations: [
      'Cannot integrate with external project management tools',
      'Cannot automate task updates or tracking',
      'Limited to text-based planning tools',
      'Cannot monitor project progress without user input'
    ],
    created: Date.now()
  });
  
  // Content Writer
  this.registerAgentDefinition({
    id: 'content_writer',
    name: 'Content Writer',
    role: AgentRole.ContentWriter,
    description: 'An assistant specialized in writing, editing, and refining content for your vault.',
    systemPrompt: `You are Claude, an AI assistant specialized in writing and editing content.

Your primary purpose is to help the user create, refine, and organize written content for their vault.
You can write draft content, edit existing text, suggest improvements, and help maintain a consistent style.

Your strengths include:
- Creating well-structured and engaging content
- Editing for clarity, conciseness, and correctness
- Adapting to different writing styles and formats
- Organizing content effectively
- Providing constructive feedback and suggestions

When the user asks for writing help, focus on understanding their goals and preferences.
Be creative yet practical, and always aim to elevate the quality of their content while maintaining their voice.`,
    tools: [
      'NoteManager.readNote',
      'NoteManager.createNote',
      'NoteManager.updateNote',
      'NoteManager.appendToNote',
      'VaultLibrarian.searchContent'
    ],
    defaultSettings: {
      model: 'claude-3-opus-20240229',
      temperature: 0.7,
      maxTokens: 8000,
      stream: true
    },
    builtIn: true,
    emoji: '✏️',
    capabilities: [
      'Content creation and drafting',
      'Editing and refinement',
      'Style consistency maintenance',
      'Format adaptation',
      'Constructive feedback provision'
    ],
    limitations: [
      'Cannot generate images or visual content',
      'Cannot access the latest factual information',
      'Writing style limited by AI capabilities',
      'Cannot automatically detect all grammatical nuances'
    ],
    created: Date.now()
  });
  
  // Research Assistant
  this.registerAgentDefinition({
    id: 'research_assistant',
    name: 'Research Assistant',
    role: AgentRole.ResearchAssistant,
    description: 'An assistant specialized in research, literature review, and knowledge synthesis.',
    systemPrompt: `You are Claude, an AI assistant specialized in research and knowledge synthesis.

Your primary purpose is to help the user conduct research, analyze information, and synthesize knowledge.
You can search through their vault, organize findings, summarize content, and help identify patterns and gaps.

Your strengths include:
- Comprehensive information gathering
- Systematic organization of research findings
- Critical analysis and synthesis of information
- Identification of patterns, connections, and gaps
- Creating structured research notes and literature reviews

When the user asks for research help, be thorough, methodical, and analytical in your approach.
Seek to understand the research question deeply and provide well-structured, evidence-based insights.`,
    tools: [
      'NoteManager.readNote',
      'NoteManager.createNote',
      'NoteManager.appendToNote',
      'VaultLibrarian.searchContent',
      'VaultLibrarian.searchTag',
      'VaultLibrarian.searchProperty',
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
    emoji: '🔍',
    capabilities: [
      'Comprehensive information gathering',
      'Research organization and structuring',
      'Content analysis and synthesis',
      'Pattern and gap identification',
      'Literature review creation'
    ],
    limitations: [
      'Limited to information in the vault',
      'Cannot access the latest research publications',
      'Cannot perform statistical analysis of data',
      'Cannot automatically verify factual accuracy'
    ],
    created: Date.now()
  });
  
  // Code Assistant
  this.registerAgentDefinition({
    id: 'code_assistant',
    name: 'Code Assistant',
    role: AgentRole.CodeAssistant,
    description: 'An assistant specialized in programming, code explanation, and development tasks.',
    systemPrompt: `You are Claude, an AI assistant specialized in programming and code assistance.

Your primary purpose is to help the user with programming tasks, code understanding, and development projects.
You can explain code, write new functions, debug issues, and help document technical projects.

Your strengths include:
- Explaining complex code in simple terms
- Writing efficient and clean code in various languages
- Debugging and problem-solving
- Suggesting best practices and optimizations
- Helping document code and technical concepts

When the user asks for programming help, focus on understanding their specific needs.
Be clear and precise in your explanations, and provide well-structured, readable code.`,
    tools: [
      'NoteManager.readNote',
      'NoteManager.createNote',
      'NoteManager.updateNote',
      'VaultLibrarian.searchContent'
    ],
    defaultSettings: {
      model: 'claude-3-opus-20240229',
      temperature: 0.3,
      maxTokens: 8000,
      stream: true
    },
    builtIn: true,
    emoji: '👨‍💻',
    capabilities: [
      'Code explanation and documentation',
      'Function and script writing',
      'Debugging assistance',
      'Best practice recommendations',
      'Technical concept explanation'
    ],
    limitations: [
      'Cannot execute code within the environment',
      'Cannot directly test solutions',
      'Limited awareness of latest frameworks/libraries',
      'Cannot access external code repositories'
    ],
    created: Date.now()
  });
}
```


### 4. Implement Agent Definition Storage

Let's implement the storage and loading of agent definitions:

```typescript
/**
 * Load custom agent definitions from storage
 */
private async loadCustomAgents(): Promise<void> {
  // Get storage folder
  const folder = this.app.vault.getAbstractFileByPath(this.storagePath);
  
  if (!folder || !(folder instanceof TFolder)) {
    return;
  }
  
  // Get all JSON files
  const files = folder.children.filter(file => 
    file instanceof TFile && file.extension === 'json'
  );
  
  // Load each file
  for (const file of files) {
    try {
      // Read file
      const content = await this.app.vault.read(file as TFile);
      
      // Parse JSON
      const definition = JSON.parse(content) as AgentDefinition;
      
      // Register definition (skip if built-in)
      if (!this.definitions.has(definition.id)) {
        this.registerAgentDefinition(definition);
      }
    } catch (error) {
      console.error(`Error loading agent definition from ${file.path}:`, error);
    }
  }
}

/**
 * Save an agent definition to storage
 * @param definition - Agent definition to save
 */
public async saveAgentDefinition(definition: AgentDefinition): Promise<void> {
  // Don't save built-in agents
  if (definition.builtIn) {
    return;
  }
  
  // Update timestamps
  if (!definition.created) {
    definition.created = Date.now();
  }
  
  definition.modified = Date.now();
  
  // Register definition
  this.registerAgentDefinition(definition);
  
  // Create file path
  const filePath = `${this.storagePath}/${definition.id}.json`;
  
  // Convert to JSON
  const content = JSON.stringify(definition, null, 2);
  
  // Save to file
  const file = this.app.vault.getAbstractFileByPath(filePath);
  
  if (file) {
    await this.app.vault.modify(file as TFile, content);
  } else {
    await this.app.vault.create(filePath, content);
  }
  
  // Emit event
  this.eventBus.emit('agents:definitionSaved', {
    id: definition.id,
    definition
  });
}

/**
 * Delete an agent definition
 * @param id - Agent ID
 */
public async deleteAgentDefinition(id: string): Promise<void> {
  // Get definition
  const definition = this.getAgentDefinition(id);
  
  if (!definition) {
    throw new Error(`Agent definition not found: ${id}`);
  }
  
  // Cannot delete built-in agents
  if (definition.builtIn) {
    throw new Error(`Cannot delete built-in agent: ${id}`);
  }
  
  // Remove from definitions
  this.definitions.delete(id);
  
  // Remove from instances
  this.instances.delete(id);
  
  // Remove from storage
  const filePath = `${this.storagePath}/${id}.json`;
  const file = this.app.vault.getAbstractFileByPath(filePath);
  
  if (file) {
    await this.app.vault.delete(file);
  }
  
  // If this was the default agent, reset to general assistant
  if (this.defaultAgentId === id) {
    await this.setDefaultAgent('general_assistant');
  }
  
  // Emit event
  this.eventBus.emit('agents:definitionDeleted', {
    id
  });
}

/**
 * Create a custom agent definition
 * @param definition - Partial agent definition
 * @returns Complete agent definition
 */
public async createCustomAgent(definition: Partial<AgentDefinition>): Promise<AgentDefinition> {
  // Generate ID if not provided
  const id = definition.id || `custom_${Date.now().toString(36)}`;
  
  // Create complete definition
  const completeDefinition: AgentDefinition = {
    id,
    name: definition.name || 'Custom Agent',
    role: definition.role || AgentRole.Custom,
    description: definition.description || 'A custom assistant.',
    systemPrompt: definition.systemPrompt || 'You are Claude, a helpful AI assistant.',
    tools: definition.tools || [],
    defaultSettings: definition.defaultSettings || {
      model: 'claude-3-opus-20240229',
      temperature: 0.7,
      maxTokens: 4000,
      stream: true
    },
    builtIn: false,
    emoji: definition.emoji || '🤖',
    capabilities: definition.capabilities || [],
    limitations: definition.limitations || [],
    created: Date.now(),
    modified: Date.now()
  };
  
  // Save definition
  await this.saveAgentDefinition(completeDefinition);
  
  return completeDefinition;
}

/**
 * Update a custom agent definition
 * @param id - Agent ID
 * @param updates - Definition updates
 * @returns Updated definition
 */
public async updateCustomAgent(id: string, updates: Partial<AgentDefinition>): Promise<AgentDefinition> {
  // Get existing definition
  const existing = this.getAgentDefinition(id);
  
  if (!existing) {
    throw new Error(`Agent definition not found: ${id}`);
  }
  
  // Cannot update built-in agents (except settings)
  if (existing.builtIn && (
    updates.systemPrompt !== undefined ||
    updates.tools !== undefined ||
    updates.name !== undefined ||
    updates.description !== undefined ||
    updates.role !== undefined
  )) {
    throw new Error(`Cannot modify built-in agent: ${id}`);
  }
  
  // Create updated definition
  const updated: AgentDefinition = {
    ...existing,
    ...updates,
    id, // Ensure ID doesn't change
    builtIn: existing.builtIn, // Ensure builtIn doesn't change
    modified: Date.now() // Update modified timestamp
  };
  
  // Save updated definition
  await this.saveAgentDefinition(updated);
  
  // Update instance if exists
  if (this.instances.has(id)) {
    const instance = this.instances.get(id);
    instance.definition = updated;
    
    // Update settings if default settings changed
    if (updates.defaultSettings) {
      instance.settings = {
        ...instance.settings,
        ...updates.defaultSettings
      };
    }
  }
  
  return updated;
}

/**
 * Duplicate an agent definition
 * @param id - Source agent ID
 * @param newName - New agent name
 * @returns New agent definition
 */
public async duplicateAgentDefinition(id: string, newName?: string): Promise<AgentDefinition> {
  // Get source definition
  const source = this.getAgentDefinition(id);
  
  if (!source) {
    throw new Error(`Agent definition not found: ${id}`);
  }
  
  // Generate new ID
  const newId = `custom_${Date.now().toString(36)}`;
  
  // Create new definition
  const newDefinition: AgentDefinition = {
    ...source,
    id: newId,
    name: newName || `${source.name} (Copy)`,
    builtIn: false,
    created: Date.now(),
    modified: Date.now()
  };
  
  // Save new definition
  await this.saveAgentDefinition(newDefinition);
  
  return newDefinition;
}
```
