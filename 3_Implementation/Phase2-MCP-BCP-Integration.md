---
title: Phase 2 Implementation - MCP and BCP Integration
description: Detailed implementation plan for the Model Context Protocol and Bounded Context Packs integration in the Chatsidian plugin
date: 2025-05-03
status: planning
tags:
  - implementation
  - mcp
  - bcp
  - agent-system
  - tool-management
---

# Phase 2: MCP and BCP Integration

## Overview

Phase 2 focuses on implementing the Model Context Protocol (MCP) client and the Bounded Context Pack (BCP) architecture. This phase builds on the core infrastructure established in Phase 1 to create an intelligent agent system that allows AI assistants to perform operations within the Obsidian vault. The MCP provides the communication framework between the AI and the plugin, while BCPs organize agent capabilities into domain-specific packages.

## Objectives

1. Implement the Model Context Protocol (MCP) client
2. Create the Bounded Context Pack (BCP) registry and infrastructure
3. Develop the Tool Manager for executing operations
4. Implement Agent Manager for custom agent definitions
5. Build domain-specific agent implementations:
   - NoteManager for note CRUD operations
   - FolderManager for folder operations
   - VaultLibrarian for search capabilities
   - PaletteCommander for command palette access
6. Create connection points for AI providers
7. Establish a validation system for tool calls
8. Implement error handling and logging for agent operations


## Key Components

### MCP Client

The MCPClient handles communication with AI providers using the Model Context Protocol.

```typescript
// src/mcp/MCPClient.ts
import { EventBus } from '../core/EventBus';
import { SettingsManager } from '../core/SettingsManager';
import { ProviderAdapter } from '../providers/ProviderAdapter';
import { ProviderFactory } from '../providers/ProviderFactory';
import { ToolManager } from './ToolManager';
import { AgentManager } from './AgentManager';
import { Conversation, Message, ToolCall, ToolResult } from '../models/Conversation';
import { ProviderRequest, ProviderResponse, ProviderChunk } from '../models/Provider';

export class MCPClient {
  private settings: SettingsManager;
  private eventBus: EventBus;
  private providerFactory: ProviderFactory;
  private toolManager: ToolManager;
  private agentManager: AgentManager;
  private currentProvider: ProviderAdapter | null = null;
  private streamHandler: ((chunk: ProviderChunk) => void) | null = null;
  
  constructor(
    settings: SettingsManager,
    eventBus: EventBus,
    providerFactory: ProviderFactory,
    toolManager: ToolManager,
    agentManager: AgentManager
  ) {
    this.settings = settings;
    this.eventBus = eventBus;
    this.providerFactory = providerFactory;
    this.toolManager = toolManager;
    this.agentManager = agentManager;
    
    // Listen for settings changes
    this.eventBus.on('settings:updated', this.handleSettingsUpdated.bind(this));
  }
  
  // Initialize provider
  public async initialize(): Promise<void> {
    const provider = this.settings.getProvider();
    const apiKey = this.settings.getApiKey();
    
    this.currentProvider = this.providerFactory.getAdapter(provider, apiKey);
    
    // Test connection
    try {
      const connected = await this.currentProvider.testConnection();
      
      if (!connected) {
        console.error('Failed to connect to provider');
        throw new Error('Failed to connect to provider');
      }
    } catch (error) {
      console.error('Error connecting to provider:', error);
      throw error;
    }
  }
  
  // Send message to AI provider
  public async sendMessage(
    conversation: Conversation,
    userMessage: Message,
    agentId?: string // Optional agent ID
  ): Promise<Message> {
    try {
      // Ensure provider is initialized
      if (!this.currentProvider) {
        await this.initialize();
      }
      
      // Get agent if specified
      const agent = agentId ? this.agentManager.getAgent(agentId) : null;
      
      // Prepare messages for context
      const messages = this.formatMessages(conversation, agent);
      
      // Get available tools
      const tools = this.toolManager.getToolsForMCP();
      
      // Create request
      const request: ProviderRequest = {
        messages,
        model: agent?.model || this.settings.getModel(),
        temperature: agent?.temperature || this.settings.getSettings().defaultTemperature,
        maxTokens: agent?.maxTokens || this.settings.getSettings().defaultMaxTokens,
        tools,
        stream: this.settings.getSettings().streamingEnabled
      };
      
      // Emit event before sending
      this.eventBus.emit('mcp:sendingMessage', { conversation, userMessage, agentId });
      
      // Send message (streaming or regular)
      let response: ProviderResponse;
      
      if (request.stream) {
        // Set up stream handler
        this.streamHandler = (chunk: ProviderChunk) => {
          this.eventBus.emit('mcp:messageChunk', { 
            chunk, 
            conversationId: conversation.id,
            agentId 
          });
        };
        
        // Stream message
        response = await this.currentProvider.streamMessage(request, this.streamHandler);
        
        // Clear stream handler
        this.streamHandler = null;
      } else {
        // Regular message
        response = await this.currentProvider.sendMessage(request);
      }
      
      // Process AI response
      const assistantMessage = this.createAssistantMessage(response);
      
      // Emit event after receiving
      this.eventBus.emit('mcp:receivedMessage', { 
        conversation, 
        assistantMessage,
        agentId
      });
      
      // Process any tool calls
      if (assistantMessage.toolCalls && assistantMessage.toolCalls.length > 0) {
        await this.processToolCalls(conversation.id, assistantMessage);
      }
      
      return assistantMessage;
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Create error message
      const errorMessage: Message = {
        id: this.generateId(),
        role: 'system',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };
      
      // Emit error event
      this.eventBus.emit('mcp:messageError', { conversation, error, agentId });
      
      return errorMessage;
    }
  }
  
  // Format messages for provider, including agent system prompt if applicable
  private formatMessages(conversation: Conversation, agent: any = null): any[] {
    const result: any[] = [];
    
    // Add system message or agent system prompt if specified
    if (agent && agent.systemPrompt) {
      // Use agent's system prompt
      result.push({
        role: 'system',
        content: agent.systemPrompt
      });
    } else if (conversation.messages.length === 0 || conversation.messages[0].role !== 'system') {
      // Add default system message
      result.push({
        role: 'system',
        content: this.settings.getSettings().defaultSystemPrompt
      });
    }
    
    // Add conversation messages
    for (const message of conversation.messages) {
      const formattedMessage: any = {
        role: message.role,
        content: message.content
      };
      
      // Add tool calls and results if present
      if (message.toolCalls && message.toolCalls.length > 0) {
        formattedMessage.tool_calls = message.toolCalls;
      }
      
      if (message.toolResults && message.toolResults.length > 0) {
        formattedMessage.tool_results = message.toolResults;
      }
      
      result.push(formattedMessage);
    }
    
    return result;
  }
  
  // Create assistant message from provider response
  private createAssistantMessage(response: ProviderResponse): Message {
    return {
      id: this.generateId(),
      role: 'assistant',
      content: response.message.content,
      timestamp: Date.now(),
      toolCalls: response.toolCalls || []
    };
  }
  
  // Process tool calls in message
  private async processToolCalls(conversationId: string, message: Message): Promise<void> {
    if (!message.toolCalls || message.toolCalls.length === 0) {
      return;
    }
    
    // Process each tool call
    for (const toolCall of message.toolCalls) {
      try {
        // Check if this is an agent call
        if (toolCall.name.startsWith('Agent.')) {
          await this.processAgentCall(conversationId, message, toolCall);
          continue;
        }
        
        // Update tool call status
        toolCall.status = 'pending';
        
        // Emit event
        this.eventBus.emit('mcp:toolCallStart', { 
          conversationId, 
          messageId: message.id, 
          toolCall 
        });
        
        // Execute tool call
        const result = await this.toolManager.executeToolCall(toolCall);
        
        // Create tool result
        const toolResult: ToolResult = {
          id: this.generateId(),
          toolCallId: toolCall.id,
          content: result
        };
        
        // Add to message
        if (!message.toolResults) {
          message.toolResults = [];
        }
        
        message.toolResults.push(toolResult);
        
        // Update tool call status
        toolCall.status = 'success';
        
        // Emit event
        this.eventBus.emit('mcp:toolCallComplete', {
          conversationId,
          messageId: message.id,
          toolCall,
          toolResult
        });
      } catch (error) {
        console.error(`Error executing tool call ${toolCall.name}:`, error);
        
        // Create error result
        const toolResult: ToolResult = {
          id: this.generateId(),
          toolCallId: toolCall.id,
          content: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        
        // Add to message
        if (!message.toolResults) {
          message.toolResults = [];
        }
        
        message.toolResults.push(toolResult);
        
        // Update tool call status
        toolCall.status = 'error';
        
        // Emit event
        this.eventBus.emit('mcp:toolCallError', {
          conversationId,
          messageId: message.id,
          toolCall,
          toolResult,
          error
        });
      }
    }
  }
  
  // Process agent call (special tool call to invoke another agent)
  private async processAgentCall(
    conversationId: string, 
    message: Message, 
    toolCall: ToolCall
  ): Promise<void> {
    try {
      // Update tool call status
      toolCall.status = 'pending';
      
      // Extract agent name from tool call
      const agentName = toolCall.name.replace('Agent.', '');
      
      // Get agent
      const agent = this.agentManager.getAgentByName(agentName);
      
      if (!agent) {
        throw new Error(`Agent ${agentName} not found`);
      }
      
      // Create a temporary conversation for the agent
      const tempConversation: Conversation = {
        id: this.generateId(),
        title: `Temp for ${agentName}`,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        messages: []
      };
      
      // Add a user message with the tool call content
      const userMessage: Message = {
        id: this.generateId(),
        role: 'user',
        content: JSON.stringify(toolCall.arguments),
        timestamp: Date.now()
      };
      
      // Send message to the agent
      const agentResponse = await this.sendMessage(
        tempConversation,
        userMessage,
        agent.id
      );
      
      // Create tool result
      const toolResult: ToolResult = {
        id: this.generateId(),
        toolCallId: toolCall.id,
        content: agentResponse.content
      };
      
      // Add to message
      if (!message.toolResults) {
        message.toolResults = [];
      }
      
      message.toolResults.push(toolResult);
      
      // Update tool call status
      toolCall.status = 'success';
      
      // Emit event
      this.eventBus.emit('mcp:toolCallComplete', {
        conversationId,
        messageId: message.id,
        toolCall,
        toolResult
      });
    } catch (error) {
      console.error(`Error executing agent call ${toolCall.name}:`, error);
      
      // Create error result
      const toolResult: ToolResult = {
        id: this.generateId(),
        toolCallId: toolCall.id,
        content: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      // Add to message
      if (!message.toolResults) {
        message.toolResults = [];
      }
      
      message.toolResults.push(toolResult);
      
      // Update tool call status
      toolCall.status = 'error';
      
      // Emit event
      this.eventBus.emit('mcp:toolCallError', {
        conversationId,
        messageId: message.id,
        toolCall,
        toolResult,
        error
      });
    }
  }
  
  // Generate a unique ID
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
  
  // Handle settings updates
  private handleSettingsUpdated(data: any): void {
    // Reinitialize provider if API key or provider changed
    if (
      data.changedKeys.includes('apiKey') ||
      data.changedKeys.includes('provider')
    ) {
      this.currentProvider = null;
      this.initialize().catch(console.error);
    }
  }
}
```


### Tool Manager

The ToolManager handles tool registration, validation, and execution.

```typescript
// src/mcp/ToolManager.ts
import { EventBus } from '../core/EventBus';
import { ToolCall } from '../models/Conversation';
import { BCPRegistry } from './BCPRegistry';

export interface Tool {
  name: string;
  description: string;
  handler: (params: any) => Promise<any>;
  schema: any;
}

export class ToolManager {
  private tools: Map<string, Tool> = new Map();
  private eventBus: EventBus;
  private bcpRegistry: BCPRegistry;
  
  constructor(eventBus: EventBus, bcpRegistry: BCPRegistry) {
    this.eventBus = eventBus;
    this.bcpRegistry = bcpRegistry;
    
    // Listen for BCP events
    this.eventBus.on('bcp:loaded', this.handleBCPLoaded.bind(this));
    this.eventBus.on('bcp:unloaded', this.handleBCPUnloaded.bind(this));
  }
  
  // Register a tool
  public registerTool(
    domain: string,
    name: string,
    description: string,
    handler: (params: any) => Promise<any>,
    schema: any
  ): void {
    const fullName = `${domain}.${name}`;
    
    if (this.tools.has(fullName)) {
      throw new Error(`Tool ${fullName} is already registered`);
    }
    
    this.tools.set(fullName, {
      name: fullName,
      description,
      handler,
      schema
    });
    
    // Emit event
    this.eventBus.emit('tool:registered', { domain, name, fullName });
  }
  
  // Unregister a tool
  public unregisterTool(fullName: string): void {
    if (!this.tools.has(fullName)) {
      return;
    }
    
    this.tools.delete(fullName);
    
    // Emit event
    this.eventBus.emit('tool:unregistered', { fullName });
  }
  
  // Get all tools
  public getTools(): Tool[] {
    return Array.from(this.tools.values());
  }
  
  // Get tools formatted for MCP
  public getToolsForMCP(): any[] {
    return this.getTools().map(tool => ({
      name: tool.name,
      description: tool.description,
      schema: tool.schema
    }));
  }
  
  // Execute a tool call
  public async executeToolCall(toolCall: ToolCall): Promise<any> {
    const { name, arguments: args } = toolCall;
    
    // Find tool
    const tool = this.tools.get(name);
    
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }
    
    // Validate parameters
    this.validateParameters(tool, args);
    
    // Execute handler
    try {
      // Emit event before execution
      this.eventBus.emit('tool:executing', { name, args });
      
      const result = await tool.handler(args);
      
      // Emit event after execution
      this.eventBus.emit('tool:executed', { name, args, result });
      
      return result;
    } catch (error) {
      // Emit error event
      this.eventBus.emit('tool:executionError', { name, args, error });
      
      throw error;
    }
  }
  
  // Validate parameters against schema
  private validateParameters(tool: Tool, params: any): void {
    // Skip validation if no schema
    if (!tool.schema) {
      return;
    }
    
    // Use JSON Schema validation
    // Note: In actual implementation, import Ajv from 'ajv'
    const ajv = new Ajv({
      allErrors: true,          // Return all errors, not just the first
      coerceTypes: true,        // Attempt to coerce values to the right type
      useDefaults: true,        // Apply default values from schema
      removeAdditional: false   // Don't remove additional properties
    });
    
    // Compile validation function for this schema
    const validate = ajv.compile(tool.schema);
    
    // Perform validation
    const valid = validate(params);
    
    // Throw error with details if invalid
    if (!valid) {
      const errors = validate.errors || [];
      const errorMessages = errors.map(err => 
        `${err.instancePath} ${err.message}`
      ).join('; ');
      
      throw new Error(`Invalid parameters: ${errorMessages}`);
    }
  }
  
  // Handle BCP loaded event
  private handleBCPLoaded(data: any): void {
    const { domain, tools } = data;
    
    // Register tools from the BCP
    for (const tool of tools) {
      this.registerTool(
        domain,
        tool.name,
        tool.description,
        tool.handler,
        tool.schema
      );
    }
  }
  
  // Handle BCP unloaded event
  private handleBCPUnloaded(data: any): void {
    const { domain } = data;
    
    // Unregister tools with this domain
    for (const toolName of this.tools.keys()) {
      if (toolName.startsWith(`${domain}.`)) {
        this.unregisterTool(toolName);
      }
    }
  }
}
```


### BCP Registry

The BCPRegistry manages Bounded Context Packs (BCPs) for organizing tools by domain.

```typescript
// src/mcp/BCPRegistry.ts
import { App } from 'obsidian';
import { EventBus } from '../core/EventBus';
import { SettingsManager } from '../core/SettingsManager';
import { Tool } from './ToolManager';

export interface BoundedContextPack {
  domain: string;
  description: string;
  tools: Tool[];
}

export class BCPRegistry {
  private app: App;
  private eventBus: EventBus;
  private settings: SettingsManager;
  private packs: Map<string, BoundedContextPack> = new Map();
  private loadedPacks: Set<string> = new Set();
  
  constructor(app: App, eventBus: EventBus, settings: SettingsManager) {
    this.app = app;
    this.eventBus = eventBus;
    this.settings = settings;
  }
  
  // Initialize registry
  public async initialize(): Promise<void> {
    // Register built-in BCPs
    await this.registerBuiltInPacks();
    
    // Register system tools (for managing BCPs)
    this.registerSystemTools();
    
    // Auto-load specified BCPs from settings
    const autoLoadBCPs = this.settings.getSettings().autoLoadBCPs;
    
    for (const domain of autoLoadBCPs) {
      if (this.packs.has(domain)) {
        await this.loadPack(domain);
      }
    }
  }
  
  // Register built-in BCPs
  private async registerBuiltInPacks(): Promise<void> {
    // These would be imported from their respective modules
    // For simplicity, we'll just list them here
    const packs: BoundedContextPack[] = [
      await this.importPack('NoteManager'),
      await this.importPack('FolderManager'),
      await this.importPack('VaultLibrarian'),
      await this.importPack('PaletteCommander')
    ];
    
    // Register each pack
    for (const pack of packs) {
      this.packs.set(pack.domain, pack);
    }
  }
  
  // Import a pack module (would be replaced with actual dynamic imports)
  private async importPack(domain: string): Promise<BoundedContextPack> {
    // This would normally use dynamic import
    // For example: return import(`../bcps/${domain}`).default;
    
    // For simplicity, we're mocking the import with placeholder data
    const toolsMap: Record<string, Tool[]> = {
      'NoteManager': [
        {
          name: 'readNote',
          description: 'Read a note from the vault',
          handler: async (params: any) => { /* Implementation */ },
          schema: { /* JSON Schema */ }
        },
        {
          name: 'createNote',
          description: 'Create a new note in the vault',
          handler: async (params: any) => { /* Implementation */ },
          schema: { /* JSON Schema */ }
        },
        // More tools...
      ],
      'FolderManager': [
        {
          name: 'createFolder',
          description: 'Create a new folder in the vault',
          handler: async (params: any) => { /* Implementation */ },
          schema: { /* JSON Schema */ }
        },
        // More tools...
      ],
      // More domains...
    };
    
    return {
      domain,
      description: `${domain} operations for Obsidian`,
      tools: toolsMap[domain] || []
    };
  }
  
  // Register system tools for BCP management
  private registerSystemTools(): void {
    this.packs.set('System', {
      domain: 'System',
      description: 'System operations for BCP management',
      tools: [
        {
          name: 'listBCPs',
          description: 'List all available BCPs',
          handler: async () => this.listPacks(),
          schema: {}
        },
        {
          name: 'loadBCP',
          description: 'Load a BCP by domain',
          handler: async (params: { domain: string }) => this.loadPack(params.domain),
          schema: {
            type: 'object',
            required: ['domain'],
            properties: {
              domain: {
                type: 'string',
                description: 'Domain of the BCP to load'
              }
            }
          }
        },
        {
          name: 'unloadBCP',
          description: 'Unload a BCP by domain',
          handler: async (params: { domain: string }) => this.unloadPack(params.domain),
          schema: {
            type: 'object',
            required: ['domain'],
            properties: {
              domain: {
                type: 'string',
                description: 'Domain of the BCP to unload'
              }
            }
          }
        }
      ]
    });
    
    // System BCP is always loaded
    this.loadedPacks.add('System');
    
    // Emit event for System BCP loaded
    this.eventBus.emit('bcp:loaded', {
      domain: 'System',
      tools: this.packs.get('System')!.tools
    });
  }
  
  // Load a pack by domain
  public async loadPack(domain: string): Promise<any> {
    // Check if pack exists
    if (!this.packs.has(domain)) {
      throw new Error(`BCP ${domain} not found`);
    }
    
    // Check if already loaded
    if (this.loadedPacks.has(domain)) {
      return { loaded: domain, status: 'already-loaded' };
    }
    
    // Get pack
    const pack = this.packs.get(domain)!;
    
    // Mark as loaded
    this.loadedPacks.add(domain);
    
    // Emit event for tools to be registered
    this.eventBus.emit('bcp:loaded', {
      domain,
      tools: pack.tools
    });
    
    return { loaded: domain, count: pack.tools.length };
  }
  
  // Unload a pack by domain
  public async unloadPack(domain: string): Promise<any> {
    // Check if pack exists
    if (!this.packs.has(domain)) {
      throw new Error(`BCP ${domain} not found`);
    }
    
    // Check if loaded
    if (!this.loadedPacks.has(domain)) {
      return { unloaded: domain, status: 'not-loaded' };
    }
    
    // Prevent unloading System BCP
    if (domain === 'System') {
      throw new Error('Cannot unload System BCP');
    }
    
    // Mark as unloaded
    this.loadedPacks.delete(domain);
    
    // Emit event for tools to be unregistered
    this.eventBus.emit('bcp:unloaded', { domain });
    
    return { unloaded: domain };
  }
  
  // List all packs
  public listPacks(): any {
    return {
      packs: Array.from(this.packs.entries()).map(([domain, pack]) => ({
        domain,
        description: pack.description,
        loaded: this.loadedPacks.has(domain),
        toolCount: pack.tools.length
      }))
    };
  }
  
  // Get loaded packs
  public getLoadedPacks(): string[] {
    return Array.from(this.loadedPacks);
  }
  
  // Check if pack is loaded
  public isPackLoaded(domain: string): boolean {
    return this.loadedPacks.has(domain);
  }
  
  // Get pack info
  public getPackInfo(domain: string): BoundedContextPack | null {
    return this.packs.get(domain) || null;
  }
}
```


### Agent Manager

The AgentManager handles custom agent definitions, allowing users to create specialized AI assistants.

```typescript
// src/mcp/AgentManager.ts
import { App, TFile, TFolder } from 'obsidian';
import { EventBus } from '../core/EventBus';
import { SettingsManager } from '../core/SettingsManager';
import { Tool } from './ToolManager';

export interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  icon?: string;
  metadata?: Record<string, any>;
}

export class AgentManager {
  private app: App;
  private eventBus: EventBus;
  private settings: SettingsManager;
  private agents: Map<string, Agent> = new Map();
  private agentsFolder: string;
  
  constructor(app: App, eventBus: EventBus, settings: SettingsManager) {
    this.app = app;
    this.eventBus = eventBus;
    this.settings = settings;
    this.agentsFolder = '.chatsidian/agents';
  }
  
  // Initialize agent manager
  public async initialize(): Promise<void> {
    // Ensure agent folder exists
    await this.ensureAgentsFolder();
    
    // Load existing agents
    await this.loadAgents();
    
    // Register agents as tools
    this.registerAgentsAsTools();
  }
  
  // Create agents folder if it doesn't exist
  private async ensureAgentsFolder(): Promise<void> {
    try {
      const folder = this.app.vault.getAbstractFileByPath(this.agentsFolder);
      
      if (!folder) {
        await this.app.vault.createFolder(this.agentsFolder);
      }
    } catch (error) {
      console.error('Error ensuring agents folder:', error);
      throw error;
    }
  }
  
  // Load all agents from disk
  private async loadAgents(): Promise<void> {
    try {
      const folder = this.app.vault.getAbstractFileByPath(this.agentsFolder);
      
      if (!folder || !(folder instanceof TFolder)) {
        return;
      }
      
      // Load each agent file
      for (const file of folder.children) {
        if (file instanceof TFile && file.extension === 'json') {
          try {
            const content = await this.app.vault.read(file);
            const agent = JSON.parse(content) as Agent;
            
            this.agents.set(agent.id, agent);
          } catch (error) {
            console.error(`Error loading agent ${file.name}:`, error);
          }
        }
      }
      
      console.log(`Loaded ${this.agents.size} agents`);
    } catch (error) {
      console.error('Error loading agents:', error);
      throw error;
    }
  }
  
  // Register agents as tools
  private registerAgentsAsTools(): void {
    // Create a BCP-like structure for agents
    const agentTools: Tool[] = [];
    
    for (const agent of this.agents.values()) {
      agentTools.push({
        name: agent.name,
        description: `${agent.description} (Custom Agent)`,
        handler: async (params: any) => {
          // This will be handled by the MCPClient
          return {};
        },
        schema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'The prompt to send to the agent'
            }
          }
        }
      });
    }
    
    // Emit event to register agent tools
    if (agentTools.length > 0) {
      this.eventBus.emit('bcp:loaded', {
        domain: 'Agent',
        tools: agentTools
      });
    }
  }
  
  // Create a new agent
  public async createAgent(agentData: Omit<Agent, 'id'>): Promise<Agent> {
    // Create agent with generated ID
    const agent: Agent = {
      id: this.generateId(),
      ...agentData
    };
    
    // Save to disk
    await this.saveAgent(agent);
    
    // Add to cache
    this.agents.set(agent.id, agent);
    
    // Register as tool
    this.eventBus.emit('bcp:loaded', {
      domain: 'Agent',
      tools: [{
        name: agent.name,
        description: `${agent.description} (Custom Agent)`,
        handler: async (params: any) => {
          // This will be handled by the MCPClient
          return {};
        },
        schema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'The prompt to send to the agent'
            }
          }
        }
      }]
    });
    
    // Emit event
    this.eventBus.emit('agent:created', agent);
    
    return agent;
  }
  
  // Update an existing agent
  public async updateAgent(id: string, updates: Partial<Agent>): Promise<Agent> {
    // Check if agent exists
    if (!this.agents.has(id)) {
      throw new Error(`Agent ${id} not found`);
    }
    
    // Get current agent
    const agent = this.agents.get(id)!;
    
    // Check for name change (would require tool re-registration)
    const nameChanged = updates.name && updates.name !== agent.name;
    
    // Apply updates
    const updatedAgent: Agent = {
      ...agent,
      ...updates
    };
    
    // Save to disk
    await this.saveAgent(updatedAgent);
    
    // Update cache
    this.agents.set(id, updatedAgent);
    
    // Handle name change
    if (nameChanged) {
      // Unregister old tool
      this.eventBus.emit('bcp:unloaded', { domain: 'Agent' });
      
      // Re-register all agent tools
      this.registerAgentsAsTools();
    }
    
    // Emit event
    this.eventBus.emit('agent:updated', updatedAgent);
    
    return updatedAgent;
  }
  
  // Delete an agent
  public async deleteAgent(id: string): Promise<void> {
    // Check if agent exists
    if (!this.agents.has(id)) {
      throw new Error(`Agent ${id} not found`);
    }
    
    // Get agent
    const agent = this.agents.get(id)!;
    
    // Delete file
    const filePath = `${this.agentsFolder}/${id}.json`;
    const file = this.app.vault.getAbstractFileByPath(filePath);
    
    if (file instanceof TFile) {
      await this.app.vault.delete(file);
    }
    
    // Remove from cache
    this.agents.delete(id);
    
    // Unregister as tool
    this.eventBus.emit('bcp:unloaded', { domain: 'Agent' });
    
    // Re-register remaining agents
    this.registerAgentsAsTools();
    
    // Emit event
    this.eventBus.emit('agent:deleted', id);
  }
  
  // Save agent to disk
  private async saveAgent(agent: Agent): Promise<void> {
    const filePath = `${this.agentsFolder}/${agent.id}.json`;
    const content = JSON.stringify(agent, null, 2);
    
    const file = this.app.vault.getAbstractFileByPath(filePath);
    
    if (file instanceof TFile) {
      await this.app.vault.modify(file, content);
    } else {
      await this.app.vault.create(filePath, content);
    }
  }
  
  // Get agent by ID
  public getAgent(id: string): Agent | null {
    return this.agents.get(id) || null;
  }
  
  // Get agent by name
  public getAgentByName(name: string): Agent | null {
    for (const agent of this.agents.values()) {
      if (agent.name === name) {
        return agent;
      }
    }
    
    return null;
  }
  
  // Get all agents
  public getAgents(): Agent[] {
    return Array.from(this.agents.values());
  }
  
  // Generate a unique ID
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
}
```


### Domain-Specific BCPs

Let's implement one of the core domain-specific BCPs as an example.

#### NoteManager BCP

The NoteManager BCP provides tools for reading, creating, updating, and deleting notes.

```typescript
// src/bcps/NoteManager/index.ts
import { App, TFile } from 'obsidian';
import { BoundedContextPack } from '../../mcp/BCPRegistry';

export default function createNoteManagerBCP(app: App): BoundedContextPack {
  return {
    domain: 'NoteManager',
    description: 'Tools for managing notes in the vault',
    tools: [
      {
        name: 'readNote',
        description: 'Read a note from the vault',
        handler: async (params: { path: string }) => {
          return readNote(app, params.path);
        },
        schema: {
          type: 'object',
          required: ['path'],
          properties: {
            path: {
              type: 'string',
              description: 'Path to the note'
            }
          }
        }
      },
      {
        name: 'createNote',
        description: 'Create a new note in the vault',
        handler: async (params: { path: string, content: string }) => {
          return createNote(app, params.path, params.content);
        },
        schema: {
          type: 'object',
          required: ['path', 'content'],
          properties: {
            path: {
              type: 'string',
              description: 'Path where the note should be created'
            },
            content: {
              type: 'string',
              description: 'Content of the note'
            }
          }
        }
      },
      {
        name: 'updateNote',
        description: 'Update an existing note in the vault',
        handler: async (params: { path: string, content: string }) => {
          return updateNote(app, params.path, params.content);
        },
        schema: {
          type: 'object',
          required: ['path', 'content'],
          properties: {
            path: {
              type: 'string',
              description: 'Path to the note'
            },
            content: {
              type: 'string',
              description: 'New content of the note'
            }
          }
        }
      },
      {
        name: 'deleteNote',
        description: 'Delete a note from the vault',
        handler: async (params: { path: string }) => {
          return deleteNote(app, params.path);
        },
        schema: {
          type: 'object',
          required: ['path'],
          properties: {
            path: {
              type: 'string',
              description: 'Path to the note to delete'
            }
          }
        }
      },
      {
        name: 'appendToNote',
        description: 'Append content to an existing note',
        handler: async (params: { path: string, content: string }) => {
          return appendToNote(app, params.path, params.content);
        },
        schema: {
          type: 'object',
          required: ['path', 'content'],
          properties: {
            path: {
              type: 'string',
              description: 'Path to the note'
            },
            content: {
              type: 'string',
              description: 'Content to append'
            }
          }
        }
      }
    ]
  };
}

// Tool Implementations

async function readNote(app: App, path: string): Promise<any> {
  // Validate path
  if (!path) {
    throw new Error('Path is required');
  }
  
  // Get file
  const file = app.vault.getAbstractFileByPath(path);
  
  if (!file) {
    throw new Error(`File not found: ${path}`);
  }
  
  if (!(file instanceof TFile)) {
    throw new Error(`Not a file: ${path}`);
  }
  
  // Read file content
  const content = await app.vault.read(file);
  
  // Get file metadata
  const metadata = app.metadataCache.getFileCache(file);
  
  return {
    path,
    content,
    metadata: {
      size: file.stat.size,
      created: file.stat.ctime,
      modified: file.stat.mtime,
      frontmatter: metadata?.frontmatter
    }
  };
}

async function createNote(app: App, path: string, content: string): Promise<any> {
  // Validate parameters
  if (!path) {
    throw new Error('Path is required');
  }
  
  if (content === undefined || content === null) {
    throw new Error('Content is required');
  }
  
  // Check if file already exists
  const existing = app.vault.getAbstractFileByPath(path);
  
  if (existing) {
    throw new Error(`File already exists: ${path}`);
  }
  
  // Create the file
  try {
    const file = await app.vault.create(path, content);
    
    return {
      success: true,
      path,
      size: file.stat.size,
      created: file.stat.ctime
    };
  } catch (error) {
    throw new Error(`Failed to create note: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function updateNote(app: App, path: string, content: string): Promise<any> {
  // Validate parameters
  if (!path) {
    throw new Error('Path is required');
  }
  
  if (content === undefined || content === null) {
    throw new Error('Content is required');
  }
  
  // Get file
  const file = app.vault.getAbstractFileByPath(path);
  
  if (!file) {
    throw new Error(`File not found: ${path}`);
  }
  
  if (!(file instanceof TFile)) {
    throw new Error(`Not a file: ${path}`);
  }
  
  // Update the file
  try {
    await app.vault.modify(file, content);
    
    return {
      success: true,
      path,
      modified: file.stat.mtime
    };
  } catch (error) {
    throw new Error(`Failed to update note: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function deleteNote(app: App, path: string): Promise<any> {
  // Validate path
  if (!path) {
    throw new Error('Path is required');
  }
  
  // Get file
  const file = app.vault.getAbstractFileByPath(path);
  
  if (!file) {
    throw new Error(`File not found: ${path}`);
  }
  
  if (!(file instanceof TFile)) {
    throw new Error(`Not a file: ${path}`);
  }
  
  // Delete the file
  try {
    await app.vault.delete(file);
    
    return {
      success: true,
      path
    };
  } catch (error) {
    throw new Error(`Failed to delete note: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function appendToNote(app: App, path: string, content: string): Promise<any> {
  // Validate parameters
  if (!path) {
    throw new Error('Path is required');
  }
  
  if (content === undefined || content === null) {
    throw new Error('Content is required');
  }
  
  // Get file
  const file = app.vault.getAbstractFileByPath(path);
  
  if (!file) {
    throw new Error(`File not found: ${path}`);
  }
  
  if (!(file instanceof TFile)) {
    throw new Error(`Not a file: ${path}`);
  }
  
  // Read current content
  const currentContent = await app.vault.read(file);
  
  // Append the new content
  const newContent = currentContent + '\n' + content;
  
  // Update the file
  try {
    await app.vault.modify(file, newContent);
    
    return {
      success: true,
      path,
      modified: file.stat.mtime
    };
  } catch (error) {
    throw new Error(`Failed to append to note: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```


#### FolderManager BCP

The FolderManager BCP provides tools for creating, listing, and managing folders.

```typescript
// src/bcps/FolderManager/index.ts
import { App, TFolder, TAbstractFile } from 'obsidian';
import { BoundedContextPack } from '../../mcp/BCPRegistry';

export default function createFolderManagerBCP(app: App): BoundedContextPack {
  return {
    domain: 'FolderManager',
    description: 'Tools for managing folders in the vault',
    tools: [
      {
        name: 'createFolder',
        description: 'Create a new folder in the vault',
        handler: async (params: { path: string }) => {
          return createFolder(app, params.path);
        },
        schema: {
          type: 'object',
          required: ['path'],
          properties: {
            path: {
              type: 'string',
              description: 'Path where the folder should be created'
            }
          }
        }
      },
      {
        name: 'listFolder',
        description: 'List the contents of a folder',
        handler: async (params: { 
          path: string, 
          includeFiles?: boolean, 
          includeFolders?: boolean 
        }) => {
          return listFolder(
            app, 
            params.path, 
            params.includeFiles !== false, 
            params.includeFolders !== false
          );
        },
        schema: {
          type: 'object',
          required: ['path'],
          properties: {
            path: {
              type: 'string',
              description: 'Path to the folder'
            },
            includeFiles: {
              type: 'boolean',
              description: 'Whether to include files in the results (default: true)'
            },
            includeFolders: {
              type: 'boolean',
              description: 'Whether to include folders in the results (default: true)'
            }
          }
        }
      },
      {
        name: 'deleteFolder',
        description: 'Delete a folder from the vault',
        handler: async (params: { path: string, recursive?: boolean }) => {
          return deleteFolder(app, params.path, params.recursive || false);
        },
        schema: {
          type: 'object',
          required: ['path'],
          properties: {
            path: {
              type: 'string',
              description: 'Path to the folder to delete'
            },
            recursive: {
              type: 'boolean',
              description: 'Whether to delete the folder recursively (default: false)'
            }
          }
        }
      },
      {
        name: 'moveFolder',
        description: 'Move a folder to a new location',
        handler: async (params: { path: string, newPath: string }) => {
          return moveFolder(app, params.path, params.newPath);
        },
        schema: {
          type: 'object',
          required: ['path', 'newPath'],
          properties: {
            path: {
              type: 'string',
              description: 'Path to the folder to move'
            },
            newPath: {
              type: 'string',
              description: 'New path for the folder'
            }
          }
        }
      }
    ]
  };
}

// Tool Implementations

async function createFolder(app: App, path: string): Promise<any> {
  // Validate path
  if (!path) {
    throw new Error('Path is required');
  }
  
  // Check if folder already exists
  const existing = app.vault.getAbstractFileByPath(path);
  
  if (existing) {
    throw new Error(`Folder already exists: ${path}`);
  }
  
  // Create the folder
  try {
    await app.vault.createFolder(path);
    
    return {
      success: true,
      path
    };
  } catch (error) {
    throw new Error(`Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function listFolder(
  app: App, 
  path: string, 
  includeFiles: boolean = true, 
  includeFolders: boolean = true
): Promise<any> {
  // Validate path
  if (!path) {
    throw new Error('Path is required');
  }
  
  // Get folder
  const folder = app.vault.getAbstractFileByPath(path);
  
  if (!folder) {
    throw new Error(`Folder not found: ${path}`);
  }
  
  if (!(folder instanceof TFolder)) {
    throw new Error(`Not a folder: ${path}`);
  }
  
  // Get children
  const files: string[] = [];
  const folders: string[] = [];
  
  for (const child of folder.children) {
    if (child instanceof TFolder && includeFolders) {
      folders.push(child.path);
    } else if (includeFiles) {
      files.push(child.path);
    }
  }
  
  return {
    path,
    files,
    folders,
    count: {
      files: files.length,
      folders: folders.length,
      total: files.length + folders.length
    }
  };
}

async function deleteFolder(app: App, path: string, recursive: boolean = false): Promise<any> {
  // Validate path
  if (!path) {
    throw new Error('Path is required');
  }
  
  // Get folder
  const folder = app.vault.getAbstractFileByPath(path);
  
  if (!folder) {
    throw new Error(`Folder not found: ${path}`);
  }
  
  if (!(folder instanceof TFolder)) {
    throw new Error(`Not a folder: ${path}`);
  }
  
  // Check if folder is empty or recursive is true
  if (!recursive && folder.children.length > 0) {
    throw new Error(`Folder is not empty, use recursive: true to delete anyway`);
  }
  
  // Delete the folder
  try {
    await app.vault.delete(folder, true);
    
    return {
      success: true,
      path
    };
  } catch (error) {
    throw new Error(`Failed to delete folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function moveFolder(app: App, path: string, newPath: string): Promise<any> {
  // Validate paths
  if (!path) {
    throw new Error('Path is required');
  }
  
  if (!newPath) {
    throw new Error('New path is required');
  }
  
  // Get folder
  const folder = app.vault.getAbstractFileByPath(path);
  
  if (!folder) {
    throw new Error(`Folder not found: ${path}`);
  }
  
  if (!(folder instanceof TFolder)) {
    throw new Error(`Not a folder: ${path}`);
  }
  
  // Check if destination folder exists
  const destination = app.vault.getAbstractFileByPath(newPath);
  
  if (destination) {
    throw new Error(`Destination already exists: ${newPath}`);
  }
  
  // Move the folder
  try {
    await app.vault.rename(folder, newPath);
    
    return {
      success: true,
      path: newPath,
      oldPath: path
    };
  } catch (error) {
    throw new Error(`Failed to move folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

}

async function listRecursive(
  app: App, 
  path: string, 
  includeFiles: boolean = true, 
  includeFolders: boolean = true
): Promise<any> {
  // Validate path
  if (!path) {
    throw new Error('Path is required');
  }
  
  // Get folder
  const rootFolder = app.vault.getAbstractFileByPath(path);
  
  if (!rootFolder) {
    throw new Error(`Folder not found: ${path}`);
  }
  
  if (!(rootFolder instanceof TFolder)) {
    throw new Error(`Not a folder: ${path}`);
  }
  
  // Recursively collect files and folders
  const files: string[] = [];
  const folders: string[] = [];
  
  function collect(folder: TFolder) {
    if (includeFolders) {
      folders.push(folder.path);
    }
    
    for (const child of folder.children) {
      if (child instanceof TFolder) {
        collect(child);
      } else if (includeFiles) {
        files.push(child.path);
      }
    }
  }
  
  collect(rootFolder);
  
  return {
    root: path,
    files,
    folders,
    count: {
      files: files.length,
      folders: folders.length,
      total: files.length + folders.length
    }
  };
}
```


#### PaletteCommander BCP

The PaletteCommander BCP provides tools for interacting with Obsidian's command palette.

```typescript
// src/bcps/PaletteCommander/index.ts
import { App, Command } from 'obsidian';
import { BoundedContextPack } from '../../mcp/BCPRegistry';

export default function createPaletteCommanderBCP(app: App): BoundedContextPack {
  return {
    domain: 'PaletteCommander',
    description: 'Tools for interacting with Obsidian command palette',
    tools: [
      {
        name: 'listCommands',
        description: 'List available commands in Obsidian',
        handler: async (params: { filter?: string }) => {
          return listCommands(app, params.filter);
        },
        schema: {
          type: 'object',
          properties: {
            filter: {
              type: 'string',
              description: 'Optional filter to apply to command names'
            }
          }
        }
      },
      {
        name: 'executeCommand',
        description: 'Execute an Obsidian command by ID',
        handler: async (params: { id: string }) => {
          return executeCommand(app, params.id);
        },
        schema: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'ID of the command to execute'
            }
          }
        }
      }
    ]
  };
}

// Tool Implementations

function listCommands(app: App, filter?: string): any {
  // Get all commands
  const commands = app.commands.commands;
  
  // Convert to array
  const commandArray = Object.entries(commands).map(([id, command]) => ({
    id,
    name: command.name,
    hotkeys: command.hotkeys?.map(hotkey => hotkey.toString()) || []
  }));
  
  // Apply filter if specified
  const filteredCommands = filter
    ? commandArray.filter(cmd => 
        cmd.name.toLowerCase().includes(filter.toLowerCase()) || 
        cmd.id.toLowerCase().includes(filter.toLowerCase())
      )
    : commandArray;
  
  return {
    count: filteredCommands.length,
    commands: filteredCommands
  };
}

async function executeCommand(app: App, id: string): Promise<any> {
  // Validate ID
  if (!id) {
    throw new Error('Command ID is required');
  }
  
  // Check if command exists
  if (!app.commands.commands[id]) {
    throw new Error(`Command not found: ${id}`);
  }
  
  // Execute command
  try {
    const result = await app.commands.executeCommandById(id);
    
    return {
      success: true,
      id,
      name: app.commands.commands[id].name,
      result
    };
  } catch (error) {
    throw new Error(`Failed to execute command: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

## Integration with Plugin Core

Now let's modify the main plugin class to integrate all these MCP and BCP components:

```typescript
// src/main.ts
import { Plugin } from 'obsidian';
import { EventBus } from './core/EventBus';
import { SettingsManager, ChatsidianSettingTab } from './core/SettingsManager';
import { StorageManager } from './core/StorageManager';
import { ProviderFactory } from './providers/ProviderFactory';
import { BCPRegistry } from './mcp/BCPRegistry';
import { ToolManager } from './mcp/ToolManager';
import { MCPClient } from './mcp/MCPClient';
import { AgentManager } from './mcp/AgentManager';
import { DEFAULT_SETTINGS } from './models/Settings';

export default class ChatsidianPlugin extends Plugin {
  public settings: SettingsManager;
  public storage: StorageManager;
  public eventBus: EventBus;
  public providerFactory: ProviderFactory;
  public bcpRegistry: BCPRegistry;
  public toolManager: ToolManager;
  public mcpClient: MCPClient;
  public agentManager: AgentManager;
  
  async onload() {
    console.log('Loading Chatsidian plugin');
    
    // Initialize event bus
    this.eventBus = new EventBus();
    
    // Initialize settings
    const savedData = await this.loadData();
    this.settings = new SettingsManager(
      savedData || DEFAULT_SETTINGS,
      async (settings) => await this.saveData(settings),
      this.eventBus
    );
    
    // Initialize storage
    this.storage = new StorageManager(this.app, this.settings, this.eventBus);
    await this.storage.initialize();
    
    // Initialize provider factory
    this.providerFactory = new ProviderFactory();
    
    // Initialize the BCP Registry
    this.bcpRegistry = new BCPRegistry(this.app, this.eventBus, this.settings);
    
    // Initialize the Tool Manager
    this.toolManager = new ToolManager(this.eventBus, this.bcpRegistry);
    
    // Initialize the Agent Manager
    this.agentManager = new AgentManager(this.app, this.eventBus, this.settings);
    await this.agentManager.initialize();
    
    // Initialize the BCP Registry
    await this.bcpRegistry.initialize();
    
    // Initialize the MCP Client
    this.mcpClient = new MCPClient(
      this.settings,
      this.eventBus,
      this.providerFactory,
      this.toolManager,
      this.agentManager
    );
    await this.mcpClient.initialize();
    
    // Register settings tab
    this.addSettingTab(new ChatsidianSettingTab(this.app, this));
    
    // Register command to open chat
    this.addCommand({
      id: 'open-chatsidian',
      name: 'Open Chatsidian',
      callback: () => {
        // Will be implemented in Phase 3
        console.log('Chat interface not yet implemented');
      }
    });
    
    console.log('Chatsidian plugin loaded');
  }
  
  async onunload() {
    console.log('Unloading Chatsidian plugin');
    
    // Clean up resources
    this.eventBus.clear();
  }
}
```

## Agent Settings Tab

Let's create an extension of the settings tab to include agent management:

```typescript
// src/core/AgentSettingsTab.ts
import { App, PluginSettingTab, Setting, ButtonComponent, TextComponent, Modal } from 'obsidian';
import { AgentManager, Agent } from '../mcp/AgentManager';

export class AgentSettingsTab extends PluginSettingTab {
  private plugin: any;
  private agentManager: AgentManager;
  
  constructor(app: App, plugin: any) {
    super(app, plugin);
    this.plugin = plugin;
    this.agentManager = plugin.agentManager;
  }
  
  display(): void {
    const { containerEl } = this;
    
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Agent Management' });
    
    // Add new agent button
    new Setting(containerEl)
      .setName('Add Agent')
      .setDesc('Create a new AI agent with custom settings')
      .addButton(button => button
        .setButtonText('Create Agent')
        .onClick(() => {
          new AgentModal(this.app, this.agentManager, null, () => {
            this.display(); // Refresh view
          }).open();
        }));
    
    containerEl.createEl('h3', { text: 'Existing Agents' });
    
    // List existing agents
    const agents = this.agentManager.getAgents();
    
    if (agents.length === 0) {
      containerEl.createEl('p', { text: 'No agents created yet.' });
    } else {
      for (const agent of agents) {
        new Setting(containerEl)
          .setName(agent.name)
          .setDesc(agent.description)
          .addButton(button => button
            .setButtonText('Edit')
            .onClick(() => {
              new AgentModal(this.app, this.agentManager, agent, () => {
                this.display(); // Refresh view
              }).open();
            }))
          .addButton(button => button
            .setButtonText('Delete')
            .setClass('mod-warning')
            .onClick(async () => {
              if (confirm(`Are you sure you want to delete the agent "${agent.name}"?`)) {
                await this.agentManager.deleteAgent(agent.id);
                this.display(); // Refresh view
              }
            }));
      }
    }
  }
}

// Modal for creating/editing agents
class AgentModal extends Modal {
  private agentManager: AgentManager;
  private agent: Agent | null;
  private onSave: () => void;
  private nameInput: TextComponent;
  private descriptionInput: TextComponent;
  private systemPromptInput: HTMLTextAreaElement;
  private modelInput: TextComponent;
  private temperatureInput: HTMLInputElement;
  private maxTokensInput: HTMLInputElement;
  
  constructor(
    app: App, 
    agentManager: AgentManager, 
    agent: Agent | null,
    onSave: () => void
  ) {
    super(app);
    this.agentManager = agentManager;
    this.agent = agent;
    this.onSave = onSave;
  }
  
  onOpen() {
    const { contentEl } = this;
    
    contentEl.empty();
    contentEl.addClass('chatsidian-agent-modal');
    
    contentEl.createEl('h2', { text: this.agent ? 'Edit Agent' : 'Create Agent' });
    
    // Name field
    new Setting(contentEl)
      .setName('Name')
      .setDesc('Agent name (must be unique)')
      .addText(text => {
        this.nameInput = text;
        text.setValue(this.agent?.name || '')
          .setPlaceholder('Agent name')
          .onChange(() => { /* Store on save */ });
      });
    
    // Description field
    new Setting(contentEl)
      .setName('Description')
      .setDesc('Short description of this agent')
      .addText(text => {
        this.descriptionInput = text;
        text.setValue(this.agent?.description || '')
          .setPlaceholder('Agent description')
          .onChange(() => { /* Store on save */ });
      });
    
    // System prompt field
    contentEl.createEl('h3', { text: 'System Prompt' });
    
    const promptContainer = contentEl.createDiv();
    promptContainer.addClass('chatsidian-system-prompt');
    
    this.systemPromptInput = promptContainer.createEl('textarea');
    this.systemPromptInput.rows = 10;
    this.systemPromptInput.value = this.agent?.systemPrompt || 'You are an AI assistant helping with Obsidian vault management.';
    
    // Model field
    new Setting(contentEl)
      .setName('Model')
      .setDesc('AI model to use for this agent')
      .addText(text => {
        this.modelInput = text;
        text.setValue(this.agent?.model || 'claude-3-opus-20240229')
          .setPlaceholder('Model name')
          .onChange(() => { /* Store on save */ });
      });
    
    // Temperature field
    new Setting(contentEl)
      .setName('Temperature')
      .setDesc('Temperature setting (0.0 - 1.0)')
      .addSlider(slider => {
        this.temperatureInput = slider.sliderEl;
        slider.setLimits(0, 1, 0.1)
          .setValue(this.agent?.temperature || 0.7)
          .setDynamicTooltip();
      });
    
    // Max tokens field
    new Setting(contentEl)
      .setName('Max Tokens')
      .setDesc('Maximum tokens in response')
      .addSlider(slider => {
        this.maxTokensInput = slider.sliderEl;
        slider.setLimits(100, 8000, 100)
          .setValue(this.agent?.maxTokens || 4000)
          .setDynamicTooltip();
      });
    
    // Save button
    new Setting(contentEl)
      .addButton(button => button
        .setButtonText('Save')
        .setCta()
        .onClick(() => this.saveAgent()))
      .addButton(button => button
        .setButtonText('Cancel')
        .onClick(() => this.close()));
  }
  
  async saveAgent() {
    const name = this.nameInput.getValue();
    const description = this.descriptionInput.getValue();
    const systemPrompt = this.systemPromptInput.value;
    const model = this.modelInput.getValue();
    const temperature = parseFloat(this.temperatureInput.value);
    const maxTokens = parseInt(this.maxTokensInput.value);
    
    // Validate inputs
    if (!name) {
      alert('Name is required');
      return;
    }
    
    if (!systemPrompt) {
      alert('System prompt is required');
      return;
    }
    
    try {
      if (this.agent) {
        // Update existing agent
        await this.agentManager.updateAgent(this.agent.id, {
          name,
          description,
          systemPrompt,
          model,
          temperature,
          maxTokens
        });
      } else {
        // Create new agent
        await this.agentManager.createAgent({
          name,
          description,
          systemPrompt,
          model,
          temperature,
          maxTokens
        });
      }
      
      this.close();
      this.onSave();
    } catch (error) {
      alert(`Error saving agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
```

## Implementation Considerations

### Security and Error Handling

The components include comprehensive error handling to ensure robust operation:

1. **Tool Parameter Validation**: All tool inputs are validated against schemas before execution to prevent invalid operations.

2. **Permission Checks**: File and folder operations validate paths to prevent unauthorized access.

3. **Error Reporting**: Detailed error messages are returned to provide context for troubleshooting.

4. **Exception Handling**: All asynchronous operations are wrapped in try-catch blocks to prevent unhandled exceptions.

### Performance Optimization

Several performance enhancements are incorporated:

1. **Lazy Loading**: BCPs are loaded only when needed, reducing memory usage and startup time.

2. **Caching**: Agent definitions and other frequently accessed data are cached in memory.

3. **Efficient File Operations**: File operations are performed using Obsidian's vault API for optimal performance.

4. **Event-Based Communication**: The event system allows for decoupled components and efficient updates.

## Bounded Context Pack Registration Process

The registration process for BCPs follows these steps:

1. The BCPRegistry discovers and registers available packs during initialization.
2. System tools are registered for managing BCPs (listBCPs, loadBCP, unloadBCP).
3. Auto-load BCPs are loaded based on settings.
4. When a BCP is loaded, its tools are registered with the ToolManager.
5. The MCPClient includes available tools in requests to AI providers.

## Agent System Integration

Agents are integrated into the system in the following ways:

1. Agents are stored as JSON files in the .chatsidian/agents folder.
2. The AgentManager loads agent definitions and registers them as tools.
3. The MCPClient can send messages with specific agent contexts.
4. Agent-specific settings (system prompt, model, temperature) override defaults.
5. The UI allows selecting different agents for conversations.

## Testing Strategy

Testing the MCP and BCP integration requires a multi-layered approach:

1. **Unit Tests**: Test individual components like ToolManager, BCPRegistry, and AgentManager.

2. **Integration Tests**: Test the interaction between components, such as loading a BCP and executing its tools.

3. **End-to-End Tests**: Test complete workflows like using an agent to search and modify vault content.

4. **Mock Tests**: Use mocked Obsidian API for testing tool implementations without a real vault.

## Next Steps

After completing Phase 2, we'll move to Phase 3, which focuses on:

1. Implementing the chat interface with Obsidian's view system
2. Creating message rendering with Markdown support
3. Building the input area with autocompletion
4. Implementing conversation management UI
5. Adding tool call visualization
6. Integrating agent selection in the UI
