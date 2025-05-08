/**
 * ModelSelectorComponent
 * 
 * This component provides a comprehensive UI for selecting AI models and agents.
 * It combines the ModelSelector, AgentSelector, and ProviderSettings components
 * into a single cohesive interface.
 * 
 * @file This file defines the ModelSelectorComponent class that integrates model and agent selection.
 */

import { Component, setIcon, App } from 'obsidian';
import { EventBus } from '../../core/EventBus';
import { ProviderService } from '../../services/ProviderService';
import { SettingsService } from '../../services/SettingsService';
import { AgentSystem } from '../../agents/AgentSystem';
import { ModelSelector, ModelSelectorEventType } from './ModelSelector';
import { AgentSelector, AgentSelectorEventType } from './AgentSelector';
import { ProviderSettings, ProviderSettingsEventType, ProviderSettingsModal } from './ProviderSettings';
import { ProviderType, ProviderTypeUtils } from './ProviderType';
import { ModelInfo } from '../../models/Provider';
import { AgentDefinition } from '../../agents/AgentTypes';

/**
 * Event types for the model selector component
 */
export enum ModelSelectorComponentEventType {
  MODEL_SELECTED = 'model-selector-component:model-selected',
  AGENT_SELECTED = 'model-selector-component:agent-selected',
  PROVIDER_CHANGED = 'model-selector-component:provider-changed',
  SETTINGS_UPDATED = 'model-selector-component:settings-updated',
}

/**
 * Options for the model selector component
 */
export interface ModelSelectorComponentOptions {
  /**
   * Whether to show the provider selector
   */
  showProviderSelector: boolean;
  
  /**
   * Whether to show model capabilities
   */
  showModelCapabilities: boolean;
  
  /**
   * Whether to filter models by provider
   */
  filterByProvider: boolean;
  
  /**
   * Whether to filter models by tool support
   */
  filterByToolSupport: boolean;
  
  /**
   * Whether to show built-in agents
   */
  showBuiltInAgents: boolean;
  
  /**
   * Whether to show custom agents
   */
  showCustomAgents: boolean;
  
  /**
   * Whether to allow creating agents
   */
  allowCreatingAgents: boolean;
  
  /**
   * Whether to allow editing agents
   */
  allowEditingAgents: boolean;
  
  /**
   * Whether to allow deleting agents
   */
  allowDeletingAgents: boolean;
  
  /**
   * Whether to show the settings button
   */
  showSettingsButton: boolean;
}

/**
 * Default options for the model selector component
 */
const DEFAULT_OPTIONS: ModelSelectorComponentOptions = {
  showProviderSelector: true,
  showModelCapabilities: true,
  filterByProvider: true,
  filterByToolSupport: true,
  showBuiltInAgents: true,
  showCustomAgents: true,
  allowCreatingAgents: true,
  allowEditingAgents: true,
  allowDeletingAgents: true,
  showSettingsButton: true,
};

/**
 * ModelSelectorComponent class that integrates model and agent selection
 */
export class ModelSelectorComponent extends Component {
  /**
   * Container element for the component
   */
  private containerEl: HTMLElement;
  
  /**
   * Event bus for component communication
   */
  private eventBus: EventBus;
  
  /**
   * Provider service for accessing model information
   */
  private providerService: ProviderService;
  
  /**
   * Settings service for accessing settings
   */
  private settingsService: SettingsService;
  
  /**
   * Agent system for accessing agent information
   */
  private agentSystem: AgentSystem;
  
  /**
   * Options for the component
   */
  private options: ModelSelectorComponentOptions;
  
  /**
   * Model selector component
   */
  private modelSelector: ModelSelector | null = null;
  
  /**
   * Agent selector component
   */
  private agentSelector: AgentSelector | null = null;
  
  /**
   * Currently selected model
   */
  private selectedModel: ModelInfo | null = null;
  
  /**
   * Currently selected agent
   */
  private selectedAgent: AgentDefinition | null = null;
  
  /**
   * App instance for accessing Obsidian API
   */
  private app: App;

  /**
   * Constructor for the ModelSelectorComponent
   * 
   * @param containerEl - The container element to render the component in
   * @param eventBus - The event bus for component communication
   * @param providerService - The provider service for accessing model information
   * @param settingsService - The settings service for accessing settings
   * @param agentSystem - The agent system for accessing agent information
   * @param app - The Obsidian app instance
   * @param options - Options for the component
   */
  constructor(
    containerEl: HTMLElement,
    eventBus: EventBus,
    providerService: ProviderService,
    settingsService: SettingsService,
    agentSystem: AgentSystem,
    app: App,
    options: Partial<ModelSelectorComponentOptions> = {}
  ) {
    super();
    
    this.containerEl = containerEl;
    this.eventBus = eventBus;
    this.providerService = providerService;
    this.settingsService = settingsService;
    this.agentSystem = agentSystem;
    this.app = app;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    
    this.render();
    this.registerEventHandlers();
  }
  
  /**
   * Render the component
   */
  private render(): void {
    this.containerEl.empty();
    this.containerEl.addClass('chatsidian-model-selector-component');
    
    // Create header with title and settings button
    const headerEl = this.containerEl.createDiv({
      cls: 'chatsidian-model-selector-header'
    });
    
    // Create title
    headerEl.createDiv({
      cls: 'chatsidian-model-selector-title',
      text: 'Model & Agent Selection'
    });
    
    // Create settings button if enabled
    if (this.options.showSettingsButton) {
      const settingsButtonEl = headerEl.createDiv({
        cls: 'chatsidian-model-selector-settings-button'
      });
      setIcon(settingsButtonEl, 'settings');
      settingsButtonEl.addEventListener('click', () => this.openProviderSettings());
    }
    
    // Create model selector container
    const modelSelectorContainerEl = this.containerEl.createDiv({
      cls: 'chatsidian-model-selector-container'
    });
    
    // Initialize model selector
    this.modelSelector = new ModelSelector(
      modelSelectorContainerEl,
      this.eventBus,
      this.providerService,
      {
        showProviderSelector: this.options.showProviderSelector,
        showModelCapabilities: this.options.showModelCapabilities,
        filterByProvider: this.options.filterByProvider,
        filterByToolSupport: this.options.filterByToolSupport,
      },
      ProviderTypeUtils.toProviderType(this.settingsService.getSettingsManager().getProvider()),
      this.settingsService.getSettingsManager().getModel()
    );
    this.addChild(this.modelSelector);
    
    // Create agent selector container
    const agentSelectorContainerEl = this.containerEl.createDiv({
      cls: 'chatsidian-agent-selector-container'
    });
    
    // Initialize agent selector
    this.agentSelector = new AgentSelector(
      agentSelectorContainerEl,
      this.eventBus,
      this.agentSystem,
      {
        showBuiltInAgents: this.options.showBuiltInAgents,
        showCustomAgents: this.options.showCustomAgents,
        allowCreatingAgents: this.options.allowCreatingAgents,
        allowEditingAgents: this.options.allowEditingAgents,
        allowDeletingAgents: this.options.allowDeletingAgents,
      },
      this.settingsService.getSettingsManager().getSettings().defaultAgentId
    );
    this.addChild(this.agentSelector);
  }
  
  /**
   * Register event handlers for the component
   */
  private registerEventHandlers(): void {
    // Listen for model selection events
    this.registerEvent(
      this.eventBus.on(ModelSelectorEventType.MODEL_SELECTED, (data: { model: ModelInfo }) => {
        this.selectedModel = data.model;
        
        // Update settings
        this.settingsService.getSettingsManager().updateSettings({
          provider: data.model.provider,
          model: data.model.id
        });
        
        // Emit model selected event
        this.eventBus.emit(ModelSelectorComponentEventType.MODEL_SELECTED, {
          model: data.model
        });
      })
    );
    
    // Listen for provider changed events
    this.registerEvent(
      this.eventBus.on(ModelSelectorEventType.PROVIDER_CHANGED, (data: { provider: string }) => {
        // Emit provider changed event
        this.eventBus.emit(ModelSelectorComponentEventType.PROVIDER_CHANGED, {
          provider: data.provider
        });
      })
    );
    
    // Listen for agent selection events
    this.registerEvent(
      this.eventBus.on(AgentSelectorEventType.AGENT_SELECTED, (data: { agent: AgentDefinition }) => {
        this.selectedAgent = data.agent;
        
        // Update settings
        this.settingsService.getSettingsManager().updateSettings({
          defaultAgentId: data.agent.id
        });
        
        // Emit agent selected event
        this.eventBus.emit(ModelSelectorComponentEventType.AGENT_SELECTED, {
          agent: data.agent
        });
      })
    );
    
    // Listen for provider settings events
    this.registerEvent(
      this.eventBus.on(ProviderSettingsEventType.SETTINGS_UPDATED, (data: any) => {
        // Emit settings updated event
        this.eventBus.emit(ModelSelectorComponentEventType.SETTINGS_UPDATED, data);
      })
    );
  }
  
  /**
   * Open the provider settings modal
   */
  private openProviderSettings(): void {
    // Create modal
    const modal = new ProviderSettingsModal(
      this.app,
      this.eventBus,
      this.settingsService,
      this.providerService
    );
    
    // Open modal
    modal.open();
  }
  
  /**
   * Get the currently selected model
   * 
   * @returns The currently selected model or null if none selected
   */
  getSelectedModel(): ModelInfo | null {
    return this.selectedModel || (this.modelSelector ? this.modelSelector.getSelectedModel() : null);
  }
  
  /**
   * Get the currently selected agent
   * 
   * @returns The currently selected agent or null if none selected
   */
  getSelectedAgent(): AgentDefinition | null {
    return this.selectedAgent || (this.agentSelector ? this.agentSelector.getSelectedAgent() : null);
  }
  
  /**
   * Set the selected model by ID
   * 
   * @param modelId - The model ID to select
   * @returns Whether the model was found and selected
   */
  setSelectedModel(modelId: string): boolean {
    if (this.modelSelector) {
      return this.modelSelector.setSelectedModel(modelId);
    }
    return false;
  }
  
  /**
   * Set the selected agent by ID
   * 
   * @param agentId - The agent ID to select
   * @returns Whether the agent was found and selected
   */
  setSelectedAgent(agentId: string): boolean {
    if (this.agentSelector) {
      return this.agentSelector.setSelectedAgent(agentId);
    }
    return false;
  }
  
  /**
   * Set the selected provider
   * 
   * @param provider - The provider to select
   */
  setSelectedProvider(provider: ProviderType | string): void {
    if (this.modelSelector) {
      this.modelSelector.setSelectedProvider(provider);
    }
  }
}
