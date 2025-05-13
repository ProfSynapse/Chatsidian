/**
 * MCP Client Implementation
 * 
 * This file implements the core Model Context Protocol (MCP) client,
 * which enables communication between Obsidian and AI models.
 */

import { App, Component, Events } from 'obsidian';
import { EventBus } from '../../core/EventBus';
import { SettingsManager } from '../../core/SettingsManager';
import { ToolManager } from '../ToolManager';
import {
  IMCPClient,
  ProviderAdapter,
  Conversation,
  Message,
  AssistantMessage,
  ModelRequestOptions,
  MessageRole,
  ToolMessage,
  MCPEventType
} from './MCPInterfaces';
import { ProviderAdapterWrapper } from './providers/ProviderAdapterWrapper';

/**
 * MCP client for communicating with AI providers
 * Extends Component for proper lifecycle management
 */
export class MCPClient extends Component implements IMCPClient {
  private app: App;
  private settings: SettingsManager;
  private toolManager: ToolManager;
  private eventBus: EventBus;
  private events: Events;
  private provider?: ProviderAdapter;
  
  /**
   * Create a new MCP client
   * @param app - Obsidian App instance
   * @param settings - Settings manager for API keys and preferences
   * @param toolManager - Tool manager for tool execution
   * @param eventBus - Event bus for communication
   */
  constructor(
    app: App,
    settings: SettingsManager,
    toolManager: ToolManager,
    eventBus: EventBus
  ) {
    super();
    
    this.app = app;
    this.settings = settings;
    this.toolManager = toolManager;
    this.eventBus = eventBus;
    this.events = new Events();
    
    // Initialize system prompt template
    this.loadSystemPromptTemplate();
  }
  
  /**
   * Component lifecycle method - called when component is loaded
   */
  onload(): void {
    console.log('MCPClient: loaded');
    
    // Load system prompt template
    this.loadSystemPromptTemplate();
    
    // Register event listeners
    this.registerEventListeners();
  }
  
  /**
   * Component lifecycle method - called when component is unloaded
   */
  onunload(): void {
    console.log('MCPClient: unloaded');
    
    // Clean up event listeners
    this.events = new Events();
  }
  
  /**
   * Register event listeners
   */
  private registerEventListeners(): void {
    // Listen for settings changes
    this.registerEvent(
      this.eventBus.on('settings:updated', (data) => {
        // Check if provider settings changed
        if (data.changedKeys.includes('provider') || 
            data.changedKeys.includes('apiKey')) {
          // Reinitialize provider
          this.initialize().catch(error => {
            console.error('Failed to reinitialize MCP client:', error);
            this.eventBus.emit(MCPEventType.Error, {
              conversationId: 'system',
              error
            });
          });
        }
        
        // Check if system prompt template changed
        if (data.changedKeys.includes('systemPromptTemplate')) {
          this.loadSystemPromptTemplate();
        }
      })
    );
  }
  
  /**
   * Load system prompt template
   */
  private loadSystemPromptTemplate(): void {
    // This method is kept for backwards compatibility but no longer loads from settings
    // System prompts are now managed at the agent level only
  }
  
  /**
   * Initialize the client
   * @returns Promise resolving when initialization is complete
   */
  public async initialize(): Promise<void> {
    try {
      // Get provider from settings
      const settings = this.settings.getSettings();
      const providerName = settings.provider;
      const apiKey = this.settings.getApiKey();
      
      if (!apiKey) {
        throw new Error(`No API key found for provider: ${providerName}`);
      }
      
      // Use the existing provider adapters from the main providers directory
      const { ProviderFactory } = await import('../../providers/ProviderFactory');
      
      // Get provider adapter using the static method
      const coreAdapter = ProviderFactory.createProvider(providerName, apiKey, settings.apiEndpoint);
      
      // Wrap the core adapter with our adapter wrapper
      this.provider = new ProviderAdapterWrapper(coreAdapter);
      
      if (!this.provider) {
        throw new Error(`Failed to create provider adapter for: ${providerName}`);
      }
      
      // Test connection
      const connected = await this.provider?.testConnection();
      
      if (!connected) {
        throw new Error(`Failed to connect to ${providerName}`);
      }
      
      // Log initialization
      console.log(`MCP client initialized with provider: ${providerName}`);
    } catch (error) {
      console.error('Failed to initialize MCP client:', error);
      throw error;
    }
  }
  
  /**
   * Send a message to the AI provider
   * @param conversation - Conversation for context
   * @param message - Message to send
   * @param options - Request options
   * @returns Promise resolving to the assistant's response
   */
  public async sendMessage(
    conversation: Conversation,
    message: Message,
    options: Partial<ModelRequestOptions> = {}
  ): Promise<AssistantMessage> {
    try {
      // Check if provider is initialized
      if (!this.provider) {
        await this.initialize();
      }
      
      if (!this.provider) {
        throw new Error('Provider not initialized');
      }
      
      // Ensure system message exists first
      this.ensureSystemMessage(conversation, options.systemPrompt);
      
      // Add message to conversation
      conversation.messages.push(message);
      
      // Update conversation timestamp
      conversation.updatedAt = Date.now();
      
      // Emit event
      this.eventBus.emit(MCPEventType.SendingMessage, {
        conversationId: conversation.id,
        message,
        timestamp: Date.now()
      });
      
      // Get available tools
      const tools = this.toolManager.getToolsForMCP();
      
      // Merge options with defaults
      const settings = this.settings.getSettings();
      const mergedOptions: ModelRequestOptions = {
        model: options.model || settings.model,
        temperature: options.temperature ?? 0.7, // Default temperature if not specified
        max_tokens: options.max_tokens ?? 4000,  // Default max tokens if not specified
        stream: options.stream || false,
        tools,
        ...options.additionalParams
      };
      
      // Send message to provider
      const response = await this.provider.sendMessage(
        conversation.messages,
        mergedOptions
      );
      
      // Add response to conversation
      conversation.messages.push(response);
      
      // Update conversation timestamp
      conversation.updatedAt = Date.now();
      
      // Emit event
      this.eventBus.emit(MCPEventType.ReceivedMessage, {
        conversationId: conversation.id,
        message: response,
        timestamp: Date.now()
      });
      
      // Process tool calls if any
      if (response.tool_calls && response.tool_calls.length > 0) {
        await this.processToolCalls(conversation, response);
      }
      
      return response;
    } catch (error) {
      // Emit error event
      this.eventBus.emit(MCPEventType.Error, {
        conversationId: conversation.id,
        error,
        timestamp: Date.now()
      });
      
      // Re-throw error
      throw error;
    }
  }
  
  /**
   * Stream a message from the AI provider
   * @param conversation - Conversation for context
   * @param message - Message to send
   * @param options - Request options
   * @param onChunk - Callback for each chunk
   * @returns Promise resolving to the complete response
   */
  public async streamMessage(
    conversation: Conversation,
    message: Message,
    options: Partial<ModelRequestOptions> = {},
    onChunk?: (chunk: any) => void
  ): Promise<AssistantMessage> {
    try {
      // Check if provider is initialized
      if (!this.provider) {
        await this.initialize();
      }
      
      if (!this.provider) {
        throw new Error('Provider not initialized');
      }
      
      // Add message to conversation
      conversation.messages.push(message);
      
      // Update conversation timestamp
      conversation.updatedAt = Date.now();
      
      // Emit event
      this.eventBus.emit(MCPEventType.StreamingStart, {
        conversationId: conversation.id,
        message,
        timestamp: Date.now()
      });
      
      // Get available tools
      const tools = this.toolManager.getToolsForMCP();
      
      // Ensure system message exists
      this.ensureSystemMessage(conversation, options.systemPrompt);
      
      // Merge options with defaults
      const settings = this.settings.getSettings();
      const mergedOptions: ModelRequestOptions = {
        model: options.model || settings.model,
        temperature: options.temperature ?? 0.7, // Default temperature if not specified
        max_tokens: options.max_tokens ?? 4000,  // Default max tokens if not specified
        stream: true,
        tools,
        ...options.additionalParams
      };
      
      // Define chunk handler
      const handleChunk = (chunk: any) => {
        // Emit chunk event
        this.eventBus.emit(MCPEventType.StreamingChunk, {
          conversationId: conversation.id,
          chunk,
          timestamp: Date.now()
        });
        
        // Call custom handler if provided
        if (onChunk) {
          onChunk(chunk);
        }
      };
      
      // Stream message from provider
      const response = await this.provider.streamMessage(
        conversation.messages,
        mergedOptions,
        handleChunk
      );
      
      // Add response to conversation
      conversation.messages.push(response);
      
      // Update conversation timestamp
      conversation.updatedAt = Date.now();
      
      // Emit event
      this.eventBus.emit(MCPEventType.StreamingEnd, {
        conversationId: conversation.id,
        message: response,
        timestamp: Date.now()
      });
      
      // Process tool calls if any
      if (response.tool_calls && response.tool_calls.length > 0) {
        await this.processToolCalls(conversation, response);
      }
      
      return response;
    } catch (error) {
      // Emit error event
      this.eventBus.emit(MCPEventType.Error, {
        conversationId: conversation.id,
        error,
        timestamp: Date.now()
      });
      
      // Re-throw error
      throw error;
    }
  }
  
  /**
   * Process tool calls in an assistant message
   * @param conversation - Conversation for context
   * @param message - Assistant message with tool calls
   * @returns Promise resolving when tool calls are processed
   */
  public async processToolCalls(
    conversation: Conversation,
    message: AssistantMessage
  ): Promise<void> {
    // Skip if no tool calls
    if (!message.tool_calls || message.tool_calls.length === 0) {
      return;
    }
    
    // Process each tool call
    for (const toolCall of message.tool_calls) {
      try {
        // Emit event
        this.eventBus.emit(MCPEventType.ToolCallStart, {
          conversationId: conversation.id,
          messageId: message.id,
          toolCall,
          timestamp: Date.now()
        });
        
        // Extract domain and name from tool name
        const [domain, name] = toolCall.name.split('.');
        
        if (!domain || !name) {
          throw new Error(`Invalid tool name format: ${toolCall.name}`);
        }
        
        // Validate parameters
        const validationResult = this.toolManager.validateParameters(
          domain,
          name,
          toolCall.arguments
        );
        
        if (!validationResult.valid) {
          throw new Error(`Invalid parameters: ${validationResult.errors?.join(', ')}`);
        }
        
        // Execute tool call
        const result = await this.toolManager.executeToolCall({
          id: toolCall.id,
          name: toolCall.name,
          arguments: toolCall.arguments,
          status: 'pending'
        });
        
        // Create tool message
        const toolMessage: ToolMessage = {
          role: MessageRole.Tool,
          content: typeof result === 'string' ? result : JSON.stringify(result),
          tool_call_id: toolCall.id,
          timestamp: Date.now()
        };
        
        // Add to conversation
        conversation.messages.push(toolMessage);
        
        // Update conversation timestamp
        conversation.updatedAt = Date.now();
        
        // Emit event
        this.eventBus.emit(MCPEventType.ToolCallComplete, {
          conversationId: conversation.id,
          messageId: message.id,
          toolCall,
          result,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error(`Error processing tool call ${toolCall.name}:`, error);
        
        // Create error tool message
        const toolMessage: ToolMessage = {
          role: MessageRole.Tool,
          content: `Error: ${error instanceof Error ? error.message : String(error)}`,
          tool_call_id: toolCall.id,
          timestamp: Date.now()
        };
        
        // Add to conversation
        conversation.messages.push(toolMessage);
        
        // Update conversation timestamp
        conversation.updatedAt = Date.now();
        
        // Emit error event
        this.eventBus.emit(MCPEventType.Error, {
          conversationId: conversation.id,
          messageId: message.id,
          toolCall,
          error,
          timestamp: Date.now()
        });
      }
    }
  }
  
  /**
   * Get the current provider adapter
   * @returns Current provider adapter
   */
  public getProvider(): ProviderAdapter {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    
    return this.provider;
  }
  
  /**
   * Set the provider adapter
   * @param provider - Provider adapter to use
   */
  public setProvider(provider: ProviderAdapter): void {
    this.provider = provider;
  }
  
  /**
   * Generate a system prompt for the conversation
   * @param conversation - Conversation to generate prompt for
   * @param customInstructions - Optional custom instructions to include
   * @returns Generated system prompt
   */
  public generateSystemPrompt(
    conversation: Conversation,
    customInstructions?: string
  ): string {
    // Start with agent instructions or an empty string
    let prompt = '';
    
    // Add custom instructions if provided
    if (customInstructions) {
      prompt += customInstructions;
    }
    
    // Add conversation-specific instructions
    if (conversation.metadata?.instructions) {
      prompt += (prompt ? '\n\n' : '') + conversation.metadata.instructions;
    }
    
    // Add available tools information
    const tools = this.toolManager.getToolsForMCP();
    
    if (tools.length > 0) {
      prompt += '\n\nYou have access to the following tools:\n\n';
      
      for (const tool of tools) {
        prompt += `- ${tool.name}: ${tool.description}\n`;
      }
      
      prompt += '\nUse these tools when appropriate to help the user.';
    }
    
    return prompt;
  }
  
  /**
   * Ensure system message exists in conversation
   * @param conversation - Conversation to check
   * @param customInstructions - Optional custom instructions
   */
  private ensureSystemMessage(
    conversation: Conversation,
    customInstructions?: string
  ): void {
    // Check if system message exists
    const hasSystemMessage = conversation.messages.some(
      message => message.role === MessageRole.System
    );
    
    // Add system message if not exists and if we have instructions
    if (!hasSystemMessage) {
      const systemPrompt = this.generateSystemPrompt(conversation, customInstructions);
      
      // Only add system message if we have some instructions
      if (systemPrompt.trim()) {
        conversation.messages.unshift({
          role: MessageRole.System,
          content: systemPrompt,
          timestamp: Date.now()
        });
      }
    }
  }
  
  /**
   * Register event listeners
   * @param eventName - Event name
   * @param callback - Callback function
   */
  public on(eventName: string, callback: (data: any) => void): void {
    this.events.on(eventName, callback);
  }
  
  /**
   * Unregister event listeners
   * @param eventName - Event name
   * @param callback - Callback function
   */
  public off(eventName: string, callback: (data: any) => void): void {
    this.events.off(eventName, callback);
  }
}
