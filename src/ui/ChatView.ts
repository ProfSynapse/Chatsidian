/**
 * ChatView Component
 * 
 * This file implements the main chat view for the Chatsidian plugin.
 * It extends Obsidian's ItemView to create a native view within the Obsidian interface.
 * 
 * The view provides a layout with a sidebar for conversation management and a main content area
 * for displaying and interacting with chat messages.
 * 
 * @file This file defines the ChatView class that extends Obsidian's ItemView class.
 */

import { ItemView, WorkspaceLeaf, setIcon, Notice } from 'obsidian';
import { EventBus } from '../core/EventBus';
import { StorageManager } from '../core/StorageManager';
import { MessageList } from './MessageDisplay';
import { InputArea, InputAreaEventType } from './InputArea';
import { ConversationList, ConversationListEventType } from './ConversationList';
import { Conversation, ConversationUtils, Message, MessageRole } from '../models/Conversation';
import { ModelSelectorComponent, ModelSelectorComponentEventType } from './models/ModelSelectorComponent';
import { ProviderSettingsModal } from './models/ProviderSettings';
import { ProviderType, ProviderTypeUtils } from './models/ProviderType';
import { SettingsService } from '../services/SettingsService';
import { ProviderService } from '../services/ProviderService';
import { AgentSystem } from '../agents/AgentSystem';
import { ModelInfo } from '../models/Provider';
import { AgentDefinition } from '../agents/AgentTypes';

/**
 * View type identifier for the chat view
 */
export const CHAT_VIEW_TYPE = 'chatsidian-chat-view';

/**
 * ChatView class that implements the main chat interface
 * Extends Obsidian's ItemView for native integration
 */
export class ChatView extends ItemView {
  /**
   * Event bus for component communication
   */
  private eventBus: EventBus;
  
  /**
   * Storage manager for persisting conversations
   */
  private storageManager: StorageManager;
  
  /**
   * Settings service for accessing settings
   */
  private settingsService: SettingsService;
  
  /**
   * Provider service for accessing provider information
   */
  private providerService: ProviderService;
  
  /**
   * Agent system for accessing agent information
   */
  private agentSystem: AgentSystem;
  
  /**
   * Container element for the sidebar
   */
  private sidebarContainerEl: HTMLElement;
  
  /**
   * Container element for the main content
   */
  private contentContainerEl: HTMLElement;
  
  /**
   * Whether the sidebar is currently open
   */
  private isSidebarOpen: boolean = true;
  
  /**
   * Current active conversation
   */
  private activeConversation: Conversation | null = null;
  
  /**
   * Message list component
   */
  private messageList: MessageList | null = null;
  
  /**
   * Model selector component
   */
  private modelSelectorComponent: ModelSelectorComponent | null = null;
  
  /**
   * Currently selected model
   */
  private selectedModel: ModelInfo | null = null;
  
  /**
   * Currently selected agent
   */
  private selectedAgent: AgentDefinition | null = null;
  
  /**
   * Constructor for the ChatView
   * 
   * @param leaf - The workspace leaf to attach the view to
   * @param eventBus - The event bus for component communication
   * @param storageManager - The storage manager for persisting conversations
   * @param settingsService - The settings service for accessing settings
   * @param providerService - The provider service for accessing provider information
   * @param agentSystem - The agent system for accessing agent information
   */
  constructor(
    leaf: WorkspaceLeaf, 
    eventBus: EventBus, 
    storageManager: StorageManager,
    settingsService: SettingsService,
    providerService: ProviderService,
    agentSystem: AgentSystem
  ) {
    super(leaf);
    this.eventBus = eventBus;
    this.storageManager = storageManager;
    this.settingsService = settingsService;
    this.providerService = providerService;
    this.agentSystem = agentSystem;
  }
  
  /**
   * Get the unique identifier for this view type
   * Required by Obsidian's ItemView
   * 
   * @returns The view type identifier
   */
  getViewType(): string {
    return CHAT_VIEW_TYPE;
  }
  
  /**
   * Get the display name for this view
   * Required by Obsidian's ItemView
   * 
   * @returns The display name
   */
  getDisplayText(): string {
    return 'Chatsidian';
  }
  
  /**
   * Get the icon name for this view
   * Required by Obsidian's ItemView
   * 
   * @returns The icon name from Obsidian's icon set
   */
  getIcon(): string {
    return 'message-square';
  }
  
  /**
   * Called when the view is opened
   * Initializes the UI components
   */
  async onOpen(): Promise<void> {
    const { containerEl } = this;
    
    // Clear container
    containerEl.empty();
    containerEl.addClass('chatsidian-container');
    
    // Create main layout - sidebar and content
    this.sidebarContainerEl = containerEl.createDiv({ cls: 'chatsidian-sidebar-container' });
    this.contentContainerEl = containerEl.createDiv({ cls: 'chatsidian-content-container' });
    
    // Set initial sidebar state
    if (!this.isSidebarOpen) {
      containerEl.addClass('chatsidian-sidebar-closed');
    } else {
      containerEl.addClass('chatsidian-sidebar-open');
    }
    
    // Initialize conversation list in sidebar
    const conversationList = new ConversationList(
      this.sidebarContainerEl,
      this.eventBus,
      this.storageManager
    );
    this.addChild(conversationList);
    
    // Create header with conversation title
    const headerEl = this.contentContainerEl.createDiv({ cls: 'chatsidian-header' });
    
    // Create hamburger menu toggle for sidebar
    const hamburgerEl = headerEl.createDiv({ 
      cls: 'chatsidian-hamburger-toggle' 
    });
    setIcon(hamburgerEl, 'menu');
    hamburgerEl.addEventListener('click', () => this.toggleSidebar());
    
    // Create title with flex layout to center it
    const titleContainerEl = headerEl.createDiv({ cls: 'chatsidian-header-title-container' });
    const titleEl = titleContainerEl.createDiv({ cls: 'chatsidian-header-title' });
    titleEl.setText('Chatsidian Chat Interface');
    
    // Create message area container
    const messageAreaEl = this.contentContainerEl.createDiv({ cls: 'chatsidian-message-area' });
    
    // Create message list container
    const messageListContainerEl = messageAreaEl.createDiv({ cls: 'chatsidian-message-list-container' });
    
    // Initialize message list component
    this.messageList = new MessageList(messageListContainerEl);
    this.addChild(this.messageList);
    
    // Create model/agent selection container
    const modelAgentContainerEl = messageAreaEl.createDiv({ cls: 'chatsidian-model-agent-container' });
    
    // Initialize model selector component
    this.modelSelectorComponent = new ModelSelectorComponent(
      modelAgentContainerEl,
      this.eventBus,
      this.providerService,
      this.settingsService,
      this.agentSystem,
      this.app,
      {
        showProviderSelector: true,
        showModelCapabilities: false,
        filterByProvider: true,
        filterByToolSupport: true,
        showBuiltInAgents: true,
        showCustomAgents: true,
        allowCreatingAgents: false,
        allowEditingAgents: false,
        allowDeletingAgents: false,
        showSettingsButton: true
      }
    );
    this.addChild(this.modelSelectorComponent);
    
    // Create input area container
    const inputAreaContainerEl = messageAreaEl.createDiv({ cls: 'chatsidian-input-area-container' });
    
    // Initialize input area component
    const inputArea = new InputArea(inputAreaContainerEl, this.eventBus);
    this.addChild(inputArea);
    
    // Register event handlers
    this.registerEventHandlers();
  }
  
  /**
   * Set the active conversation
   * 
   * @param conversation - The conversation to set as active
   */
  setActiveConversation(conversation: Conversation): void {
    this.activeConversation = conversation;
    
    if (this.messageList) {
      this.messageList.setMessages(conversation.messages);
    }
    
    // Update just the title in the header
    const titleEl = this.contentContainerEl.querySelector('.chatsidian-header-title');
    if (titleEl) {
      titleEl.setText(conversation.title);
    }
    
    // Close the sidebar after selecting a conversation (on mobile)
    if (window.innerWidth <= 768) {
      this.isSidebarOpen = true; // Set to true so toggle will make it false
      this.toggleSidebar();
    }
  }
  
  /**
   * Add a message to the active conversation
   * 
   * @param message - The message to add
   */
  async addMessage(message: Message): Promise<void> {
    if (!this.activeConversation) {
      return;
    }
    
    try {
      // Add the message to the conversation using StorageManager
      this.activeConversation = await this.storageManager.addMessage(
        this.activeConversation.id,
        message
      );
      
      // Add the message to the message list
      if (this.messageList) {
        this.messageList.addMessage(message);
      }
    } catch (error) {
      console.error('Failed to add message to conversation:', error);
      new Notice('Failed to add message to conversation');
    }
  }
  
  
  /**
   * Register event handlers for the view
   */
  private registerEventHandlers(): void {
    // Register DOM events using this.registerDomEvent for proper cleanup
    
    // Listen for window resize events
    this.registerDomEvent(window, 'resize', () => {
      // Handle resize if needed
    });
    
    // Listen for plugin events using the event bus
    // These will be cleaned up when the view is closed
    
    // Listen for theme change events
    this.registerEvent(
      this.app.workspace.on('css-change', () => {
        // Handle theme change if needed
      })
    );
    
    // Listen for conversation selection events
    this.registerEvent(
      this.eventBus.on(ConversationListEventType.CONVERSATION_SELECTED, (conversation: Conversation) => {
        this.setActiveConversation(conversation);
      })
    );
    
    // Listen for message submitted events from the input area
    this.registerEvent(
      this.eventBus.on(InputAreaEventType.MESSAGE_SUBMITTED, async (message: Message) => {
        // Add the user message to the conversation
        this.addMessage(message);
        
        // Generate a response using the selected model and agent
        this.generateResponse(message);
      })
    );
    
    // Listen for model selection events
    this.registerEvent(
      this.eventBus.on(ModelSelectorComponentEventType.MODEL_SELECTED, (data: { model: ModelInfo }) => {
        this.selectedModel = data.model;
      })
    );
    
    // Listen for agent selection events
    this.registerEvent(
      this.eventBus.on(ModelSelectorComponentEventType.AGENT_SELECTED, (data: { agent: AgentDefinition }) => {
        this.selectedAgent = data.agent;
      })
    );
  }
  
  /**
   * Generate a response using the selected model and agent
   * @param message - The user message to respond to
   */
  private async generateResponse(message: Message): Promise<void> {
    if (!this.activeConversation) {
      return;
    }
    
    // Disable input while generating response
    const inputArea = this.containerEl.querySelector('.chatsidian-input-area');
    if (inputArea) {
      inputArea.addClass('chatsidian-input-area-disabled');
    }
    
    // Add a typing indicator
    const typingMessage = ConversationUtils.createMessage(
      MessageRole.Assistant,
      '...'
    );
    
    if (this.messageList) {
      this.messageList.addMessage(typingMessage);
      // Scroll to bottom when adding typing indicator
      const messageListContainer = this.contentContainerEl.querySelector('.chatsidian-message-list-container');
      if (messageListContainer) {
        messageListContainer.scrollTop = messageListContainer.scrollHeight;
      }
    }
    
    try {
      // Get the selected model and agent
      const model = this.selectedModel || {
        id: this.settingsService.getSettingsManager().getModel(),
        provider: ProviderTypeUtils.toProviderType(this.settingsService.getSettingsManager().getProvider()),
        name: this.settingsService.getSettingsManager().getModel(),
        contextSize: 8000,
        supportsTools: true
      };
      
      const agentId = this.selectedAgent?.id || 
        this.settingsService.getSettingsManager().getSettings().defaultAgentId || 
        'general_assistant';
      
      // For now, just simulate a response
      // In a real implementation, this would call the agent system
      // this.agentSystem.processMessage(this.activeConversation, message, agentId)
      
      // Simulate a delay for the AI response
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Create the final response message
      const responseMessage = {
        ...typingMessage,
        content: `I'm using the ${model.name} model with the ${agentId} agent. How can I assist you with your Obsidian vault today?`
      };
      
      // Update the message in the UI
      if (this.messageList) {
        this.messageList.updateMessage(responseMessage);
      }
      
      // Save the message to storage
      if (this.activeConversation) {
        await this.storageManager.addMessage(
          this.activeConversation.id,
          responseMessage
        );
      }
    } catch (error) {
      console.error('Failed to generate AI response:', error);
      new Notice('Failed to generate AI response');
      
      // Update the typing indicator with an error message
      const errorMessage = {
        ...typingMessage,
        content: 'Sorry, I encountered an error while generating a response. Please try again.'
      };
      
      if (this.messageList) {
        this.messageList.updateMessage(errorMessage);
      }
    } finally {
      // Re-enable input
      if (inputArea) {
        inputArea.removeClass('chatsidian-input-area-disabled');
      }
    }
  }
  
  
  /**
   * Toggle the sidebar visibility
   */
  private toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
    
    if (this.isSidebarOpen) {
      this.containerEl.removeClass('chatsidian-sidebar-closed');
      this.containerEl.addClass('chatsidian-sidebar-open');
    } else {
      this.containerEl.removeClass('chatsidian-sidebar-open');
      this.containerEl.addClass('chatsidian-sidebar-closed');
    }
    
    // Toggle the sidebar button active state
    const hamburgerEl = this.containerEl.querySelector('.chatsidian-hamburger-toggle');
    if (hamburgerEl) {
      if (this.isSidebarOpen) {
        hamburgerEl.addClass('active');
      } else {
        hamburgerEl.removeClass('active');
      }
    }
  }
  
  /**
   * Called when the view is closed
   * Cleans up resources and event listeners
   */
  async onClose(): Promise<void> {
    // The registerDomEvent and registerEvent methods will automatically
    // clean up the event listeners when the view is closed
  }
}
