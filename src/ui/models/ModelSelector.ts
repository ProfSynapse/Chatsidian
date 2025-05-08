/**
 * ModelSelector Component
 * 
 * This component provides a dropdown for selecting AI models.
 * It integrates with the ProviderService to get available models
 * and allows filtering by provider and capabilities.
 * 
 * @file This file defines the ModelSelector class for model selection.
 */

import { Component, DropdownComponent, setIcon } from 'obsidian';
import { EventBus } from '../../core/EventBus';
import { ModelInfo } from '../../models/Provider';
import { ProviderType, ProviderTypeUtils } from './ProviderType';
import { ProviderService } from '../../services/ProviderService';
import { ModelSelectorOptions } from './types';

/**
 * Event types for model selection components
 */
export enum ModelSelectorEventType {
  MODEL_SELECTED = 'model-selector:model-selected',
  PROVIDER_CHANGED = 'model-selector:provider-changed',
}

/**
 * Default options for the model selector
 */
const DEFAULT_OPTIONS: ModelSelectorOptions = {
  showProviderSelector: true,
  showModelCapabilities: true,
  filterByProvider: true,
  filterByToolSupport: true,
};

/**
 * ModelSelector component for selecting AI models
 */
export class ModelSelector extends Component {
  /**
   * Container element for the model selector
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
   * Options for the model selector
   */
  private options: ModelSelectorOptions;
  
  /**
   * Currently selected provider
   */
  private selectedProvider: ProviderType;
  
  /**
   * Currently selected model
   */
  private selectedModel: ModelInfo | null = null;
  
  /**
   * Provider dropdown component
   */
  private providerDropdown: DropdownComponent | null = null;
  
  /**
   * Model dropdown component
   */
  private modelDropdown: DropdownComponent | null = null;
  
  /**
   * Model capabilities element
   */
  private modelCapabilitiesEl: HTMLElement | null = null;
  
  /**
   * Constructor for the ModelSelector
   * 
   * @param containerEl - The container element to render the model selector in
   * @param eventBus - The event bus for component communication
   * @param providerService - The provider service for accessing model information
   * @param options - Options for the model selector
   * @param initialProvider - Initial provider to select
   * @param initialModelId - Initial model ID to select
   */
  constructor(
    containerEl: HTMLElement,
    eventBus: EventBus,
    providerService: ProviderService,
    options: Partial<ModelSelectorOptions> = {},
    initialProvider?: ProviderType | string,
    initialModelId?: string
  ) {
    super();
    
    this.containerEl = containerEl;
    this.eventBus = eventBus;
    this.providerService = providerService;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.selectedProvider = initialProvider ? 
      ProviderTypeUtils.toProviderType(initialProvider) : 
      'anthropic';
    
    this.render();
    
    // Initialize with the selected model if provided
    if (initialModelId) {
      const model = this.providerService.findModelById(initialModelId);
      if (model) {
        this.selectedModel = model;
        this.selectedProvider = model.provider;
        this.updateModelDropdown();
        this.updateModelCapabilities();
      }
    }
  }
  
  /**
   * Render the model selector
   */
  private render(): void {
    this.containerEl.empty();
    this.containerEl.addClass('chatsidian-model-selector');
    
    // Create provider selector if enabled
    if (this.options.showProviderSelector) {
      this.renderProviderSelector();
    }
    
    // Create model selector
    this.renderModelSelector();
    
    // Create model capabilities if enabled
    if (this.options.showModelCapabilities) {
      this.renderModelCapabilities();
    }
  }
  
  /**
   * Render the provider selector
   */
  private renderProviderSelector(): void {
    const providerSelectorEl = this.containerEl.createDiv({
      cls: 'chatsidian-provider-selector'
    });
    
    // Create label
    providerSelectorEl.createDiv({
      cls: 'chatsidian-selector-label',
      text: 'Provider'
    });
    
    // Create dropdown container
    const dropdownContainerEl = providerSelectorEl.createDiv({
      cls: 'chatsidian-dropdown-container'
    });
    
    // Create provider icon
    const providerIconEl = dropdownContainerEl.createDiv({
      cls: 'chatsidian-provider-icon'
    });
    setIcon(providerIconEl, 'cloud');
    
    // Create provider dropdown
    this.providerDropdown = new DropdownComponent(dropdownContainerEl);
    
    // Get supported providers
    const providers = this.providerService.getSupportedProviders();
    
    // Add options to dropdown
    for (const provider of providers) {
      this.providerDropdown.addOption(provider, this.formatProviderName(provider));
    }
    
    // Set initial value
    this.providerDropdown.setValue(this.selectedProvider);
    
    // Add change handler
    this.providerDropdown.onChange(value => {
      this.selectedProvider = ProviderTypeUtils.toProviderType(value);
      this.updateModelDropdown();
      
      // Emit provider changed event
      this.eventBus.emit(ModelSelectorEventType.PROVIDER_CHANGED, {
        provider: value
      });
    });
  }
  
  /**
   * Render the model selector
   */
  private renderModelSelector(): void {
    const modelSelectorEl = this.containerEl.createDiv({
      cls: 'chatsidian-model-selector-dropdown'
    });
    
    // Create label
    modelSelectorEl.createDiv({
      cls: 'chatsidian-selector-label',
      text: 'Model'
    });
    
    // Create dropdown container
    const dropdownContainerEl = modelSelectorEl.createDiv({
      cls: 'chatsidian-dropdown-container'
    });
    
    // Create model icon
    const modelIconEl = dropdownContainerEl.createDiv({
      cls: 'chatsidian-model-icon'
    });
    setIcon(modelIconEl, 'cpu');
    
    // Create model dropdown
    this.modelDropdown = new DropdownComponent(dropdownContainerEl);
    
    // Initialize model dropdown
    this.updateModelDropdown();
    
    // Add change handler
    this.modelDropdown.onChange(value => {
      const model = this.providerService.findModelById(value);
      if (model) {
        this.selectedModel = model;
        this.updateModelCapabilities();
        
        // Emit model selected event
        this.eventBus.emit(ModelSelectorEventType.MODEL_SELECTED, {
          model,
          provider: this.selectedProvider
        });
      }
    });
  }
  
  /**
   * Render the model capabilities
   */
  private renderModelCapabilities(): void {
    this.modelCapabilitiesEl = this.containerEl.createDiv({
      cls: 'chatsidian-model-capabilities'
    });
    
    // Initialize model capabilities
    this.updateModelCapabilities();
  }
  
  /**
   * Update the model dropdown based on the selected provider
   */
  private updateModelDropdown(): void {
    if (!this.modelDropdown) {
      return;
    }
    
    // Clear existing options
    this.modelDropdown.selectEl.empty();
    
    // Get models for the selected provider
    let models: ModelInfo[] = [];
    
    if (this.options.filterByProvider) {
      models = this.providerService.getAvailableModels(this.selectedProvider);
    } else {
      models = this.providerService.getAllModels();
    }
    
    // Filter by tool support if enabled
    if (this.options.filterByToolSupport) {
      models = models.filter(model => model.supportsTools);
    }
    
    // Sort models by name
    models.sort((a, b) => a.name.localeCompare(b.name));
    
    // Add options to dropdown
    for (const model of models) {
      this.modelDropdown.addOption(model.id, model.name);
    }
    
    // Set initial value if available
    if (models.length > 0) {
      const initialModel = this.selectedModel && models.find(m => m.id === this.selectedModel?.id)
        ? this.selectedModel.id
        : models[0].id;
        
      this.modelDropdown.setValue(initialModel);
      
      // Update selected model
      this.selectedModel = this.providerService.findModelById(initialModel) || null;
      this.updateModelCapabilities();
    } else {
      this.selectedModel = null;
      this.updateModelCapabilities();
    }
  }
  
  /**
   * Update the model capabilities display
   */
  private updateModelCapabilities(): void {
    if (!this.modelCapabilitiesEl || !this.options.showModelCapabilities) {
      return;
    }
    
    this.modelCapabilitiesEl.empty();
    
    if (!this.selectedModel) {
      this.modelCapabilitiesEl.createDiv({
        cls: 'chatsidian-model-capabilities-empty',
        text: 'No model selected'
      });
      return;
    }
    
    // Create capabilities container
    const capabilitiesContainerEl = this.modelCapabilitiesEl.createDiv({
      cls: 'chatsidian-model-capabilities-container'
    });
    
    // Add model info
    const modelInfoEl = capabilitiesContainerEl.createDiv({
      cls: 'chatsidian-model-info'
    });
    
    // Add context size
    const contextSizeEl = modelInfoEl.createDiv({
      cls: 'chatsidian-model-info-item'
    });
    contextSizeEl.createSpan({
      cls: 'chatsidian-model-info-label',
      text: 'Context Size:'
    });
    contextSizeEl.createSpan({
      cls: 'chatsidian-model-info-value',
      text: `${this.formatNumber(this.selectedModel.contextSize)} tokens`
    });
    
    // Add tool support
    const toolSupportEl = modelInfoEl.createDiv({
      cls: 'chatsidian-model-info-item'
    });
    toolSupportEl.createSpan({
      cls: 'chatsidian-model-info-label',
      text: 'Tool Support:'
    });
    toolSupportEl.createSpan({
      cls: 'chatsidian-model-info-value',
      text: this.selectedModel.supportsTools ? 'Yes' : 'No'
    });
    
    // Add JSON support if available
    if (this.selectedModel.supportsJson !== undefined) {
      const jsonSupportEl = modelInfoEl.createDiv({
        cls: 'chatsidian-model-info-item'
      });
      jsonSupportEl.createSpan({
        cls: 'chatsidian-model-info-label',
        text: 'JSON Support:'
      });
      jsonSupportEl.createSpan({
        cls: 'chatsidian-model-info-value',
        text: this.selectedModel.supportsJson ? 'Yes' : 'No'
      });
    }
    
    // Add max output tokens if available
    if (this.selectedModel.maxOutputTokens !== undefined) {
      const maxOutputTokensEl = modelInfoEl.createDiv({
        cls: 'chatsidian-model-info-item'
      });
      maxOutputTokensEl.createSpan({
        cls: 'chatsidian-model-info-label',
        text: 'Max Output:'
      });
      maxOutputTokensEl.createSpan({
        cls: 'chatsidian-model-info-value',
        text: `${this.formatNumber(this.selectedModel.maxOutputTokens)} tokens`
      });
    }
  }
  
  /**
   * Format a provider name for display
   * 
   * @param provider - The provider name to format
   * @returns The formatted provider name
   */
  private formatProviderName(provider: string): string {
    return ProviderTypeUtils.getDisplayName(provider);
  }
  
  /**
   * Format a number with commas
   * 
   * @param num - The number to format
   * @returns The formatted number
   */
  private formatNumber(num: number): string {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  
  /**
   * Get the currently selected model
   * 
   * @returns The currently selected model or null if none selected
   */
  getSelectedModel(): ModelInfo | null {
    return this.selectedModel;
  }
  
  /**
   * Get the currently selected provider
   * 
   * @returns The currently selected provider
   */
  getSelectedProvider(): ProviderType {
    return this.selectedProvider;
  }
  
  /**
   * Set the selected model by ID
   * 
   * @param modelId - The model ID to select
   * @returns Whether the model was found and selected
   */
  setSelectedModel(modelId: string): boolean {
    const model = this.providerService.findModelById(modelId);
    if (model && this.modelDropdown) {
      this.selectedModel = model;
      this.selectedProvider = model.provider;
      
      // Update provider dropdown if available
      if (this.providerDropdown) {
        this.providerDropdown.setValue(this.selectedProvider);
      }
      
      // Update model dropdown
      this.updateModelDropdown();
      this.modelDropdown.setValue(modelId);
      
      // Update model capabilities
      this.updateModelCapabilities();
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Set the selected provider
   * 
   * @param provider - The provider to select
   */
  setSelectedProvider(provider: ProviderType | string): void {
    if (this.providerDropdown && this.providerService.isProviderSupported(provider)) {
      this.selectedProvider = ProviderTypeUtils.toProviderType(provider);
      this.providerDropdown.setValue(provider);
      this.updateModelDropdown();
    }
  }
}
