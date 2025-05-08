/**
 * ProviderSettings Component
 * 
 * This component provides a UI for configuring provider settings.
 * It allows setting API keys and other provider-specific options.
 * 
 * @file This file defines the ProviderSettings class for provider configuration.
 */

import { Component, ButtonComponent, TextComponent, ToggleComponent, setIcon, Modal } from 'obsidian';
import { EventBus } from '../../core/EventBus';
import { SettingsService } from '../../services/SettingsService';
import { ProviderService } from '../../services/ProviderService';
import { SettingsManager } from '../../core/SettingsManager';

/**
 * Event types for provider settings components
 */
export enum ProviderSettingsEventType {
  SETTINGS_UPDATED = 'provider-settings:settings-updated',
  API_KEY_UPDATED = 'provider-settings:api-key-updated',
  API_ENDPOINT_UPDATED = 'provider-settings:api-endpoint-updated',
}

/**
 * ProviderSettings component for configuring provider settings
 */
export class ProviderSettings extends Component {
  /**
   * Container element for the provider settings
   */
  private containerEl: HTMLElement;
  
  /**
   * Event bus for component communication
   */
  private eventBus: EventBus;
  
  /**
   * Settings manager for accessing settings
   */
  private settingsManager: SettingsManager;
  
  /**
   * Provider service for accessing provider information
   */
  private providerService: ProviderService;
  
  /**
   * Currently selected provider
   */
  private selectedProvider: string;
  
  /**
   * Constructor for the ProviderSettings
   * 
   * @param containerEl - The container element to render the provider settings in
   * @param eventBus - The event bus for component communication
   * @param settingsService - The settings service for accessing settings
   * @param providerService - The provider service for accessing provider information
   * @param initialProvider - Initial provider to select
   */
  constructor(
    containerEl: HTMLElement,
    eventBus: EventBus,
    settingsService: SettingsService,
    providerService: ProviderService,
    initialProvider?: string
  ) {
    super();
    
    this.containerEl = containerEl;
    this.eventBus = eventBus;
    this.settingsManager = settingsService.getSettingsManager();
    this.providerService = providerService;
    this.selectedProvider = initialProvider || 'anthropic';
    
    this.render();
  }
  
  /**
   * Render the provider settings
   */
  private render(): void {
    this.containerEl.empty();
    this.containerEl.addClass('chatsidian-provider-settings');
    
    // Create header
    const headerEl = this.containerEl.createDiv({
      cls: 'chatsidian-provider-settings-header'
    });
    
    // Create title
    headerEl.createDiv({
      cls: 'chatsidian-provider-settings-title',
      text: 'Provider Settings'
    });
    
    // Create provider selector
    this.renderProviderSelector();
    
    // Create provider settings
    this.renderProviderSettings();
  }
  
  /**
   * Render the provider selector
   */
  private renderProviderSelector(): void {
    const providerSelectorEl = this.containerEl.createDiv({
      cls: 'chatsidian-provider-selector'
    });
    
    // Get supported providers
    const providers = this.providerService.getSupportedProviders();
    
    // Create provider buttons
    for (const provider of providers) {
      const providerButtonEl = providerSelectorEl.createDiv({
        cls: `chatsidian-provider-button ${provider === this.selectedProvider ? 'chatsidian-provider-button-selected' : ''}`
      });
      
      // Create provider icon
      const providerIconEl = providerButtonEl.createDiv({
        cls: 'chatsidian-provider-icon'
      });
      setIcon(providerIconEl, this.getProviderIcon(provider));
      
      // Create provider name
      providerButtonEl.createDiv({
        cls: 'chatsidian-provider-name',
        text: this.formatProviderName(provider)
      });
      
      // Add click handler
      providerButtonEl.addEventListener('click', () => {
        this.selectedProvider = provider;
        this.render();
        
        // Emit provider changed event
        this.eventBus.emit(ProviderSettingsEventType.SETTINGS_UPDATED, {
          provider
        });
      });
    }
  }
  
  /**
   * Render the provider settings
   */
  private renderProviderSettings(): void {
    const providerSettingsEl = this.containerEl.createDiv({
      cls: 'chatsidian-provider-settings-content'
    });
    
    // Create settings form
    const formEl = providerSettingsEl.createDiv({
      cls: 'chatsidian-provider-settings-form'
    });
    
    // Create API key field
    const apiKeyContainerEl = formEl.createDiv({
      cls: 'chatsidian-form-group'
    });
    apiKeyContainerEl.createDiv({
      cls: 'chatsidian-form-label',
      text: 'API Key'
    });
    const apiKeyInputEl = apiKeyContainerEl.createDiv({
      cls: 'chatsidian-form-input'
    });
    const apiKeyInput = new TextComponent(apiKeyInputEl);
    apiKeyInput.inputEl.type = 'password';
    apiKeyInput.inputEl.placeholder = 'Enter API key';
    
    // Set initial value
    const currentSettings = this.settingsManager.getSettings();
    const apiKey = currentSettings.provider === this.selectedProvider ? currentSettings.apiKey : '';
    if (apiKey) {
      apiKeyInput.setValue('••••••••••••••••••••••••••');
    }
    
    // Add change handler
    apiKeyInput.onChange(value => {
      if (value && value !== '••••••••••••••••••••••••••') {
        this.settingsManager.setApiKey(value);
        
        // Emit API key updated event
        this.eventBus.emit(ProviderSettingsEventType.API_KEY_UPDATED, {
          provider: this.selectedProvider,
          apiKey: value
        });
      }
    });
    
    // Create API endpoint field for custom providers
    if (this.selectedProvider === 'custom') {
      const apiEndpointContainerEl = formEl.createDiv({
        cls: 'chatsidian-form-group'
      });
      apiEndpointContainerEl.createDiv({
        cls: 'chatsidian-form-label',
        text: 'API Endpoint'
      });
      const apiEndpointInputEl = apiEndpointContainerEl.createDiv({
        cls: 'chatsidian-form-input'
      });
      const apiEndpointInput = new TextComponent(apiEndpointInputEl);
      apiEndpointInput.inputEl.placeholder = 'Enter API endpoint URL';
      
      // Set initial value
      const currentSettings = this.settingsManager.getSettings();
      const apiEndpoint = currentSettings.apiEndpoint || '';
      if (apiEndpoint) {
        apiEndpointInput.setValue(apiEndpoint);
      }
      
      // Add change handler
      apiEndpointInput.onChange(value => {
        if (value) {
          this.settingsManager.updateSettings({ apiEndpoint: value });
          
          // Emit API endpoint updated event
          this.eventBus.emit(ProviderSettingsEventType.API_ENDPOINT_UPDATED, {
            provider: this.selectedProvider,
            apiEndpoint: value
          });
        }
      });
    }
    
    // Create provider-specific settings
    this.renderProviderSpecificSettings(formEl);
    
    // Create save button
    const saveButtonEl = formEl.createDiv({
      cls: 'chatsidian-form-buttons'
    });
    const saveButton = new ButtonComponent(saveButtonEl)
      .setButtonText('Save')
      .setCta()
      .onClick(() => {
        // Settings are automatically saved when updated
        
        // Show success message
        const successEl = formEl.createDiv({
          cls: 'chatsidian-form-success',
          text: 'Settings saved successfully!'
        });
        
        // Remove success message after 3 seconds
        setTimeout(() => {
          successEl.remove();
        }, 3000);
      });
  }
  
  /**
   * Render provider-specific settings
   * 
   * @param containerEl - The container element to render the settings in
   */
  private renderProviderSpecificSettings(containerEl: HTMLElement): void {
    // Add provider-specific settings based on the selected provider
    switch (this.selectedProvider) {
      case 'anthropic':
        this.renderAnthropicSettings(containerEl);
        break;
      case 'openai':
        this.renderOpenAISettings(containerEl);
        break;
      case 'google':
        this.renderGoogleSettings(containerEl);
        break;
      case 'openrouter':
        this.renderOpenRouterSettings(containerEl);
        break;
      case 'custom':
        this.renderCustomSettings(containerEl);
        break;
    }
  }
  
  /**
   * Render Anthropic-specific settings
   * 
   * @param containerEl - The container element to render the settings in
   */
  private renderAnthropicSettings(containerEl: HTMLElement): void {
    // Create version field
    const versionContainerEl = containerEl.createDiv({
      cls: 'chatsidian-form-group'
    });
    versionContainerEl.createDiv({
      cls: 'chatsidian-form-label',
      text: 'API Version'
    });
    const versionInputEl = versionContainerEl.createDiv({
      cls: 'chatsidian-form-input'
    });
    const versionInput = new TextComponent(versionInputEl);
    versionInput.inputEl.placeholder = 'Enter API version (e.g., 2023-06-01)';
    
    // Set initial value
    const settings = this.settingsManager.getSettings();
    const version = settings.provider === 'anthropic' ? 
      (settings as any).apiVersion || '' : '';
    if (version) {
      versionInput.setValue(version);
    }
    
    // Add change handler
    versionInput.onChange(value => {
      if (value) {
        const updates = { ...this.settingsManager.getSettings() };
        (updates as any).apiVersion = value;
        this.settingsManager.updateSettings(updates);
      }
    });
  }
  
  /**
   * Render OpenAI-specific settings
   * 
   * @param containerEl - The container element to render the settings in
   */
  private renderOpenAISettings(containerEl: HTMLElement): void {
    // Create organization field
    const orgContainerEl = containerEl.createDiv({
      cls: 'chatsidian-form-group'
    });
    orgContainerEl.createDiv({
      cls: 'chatsidian-form-label',
      text: 'Organization ID (optional)'
    });
    const orgInputEl = orgContainerEl.createDiv({
      cls: 'chatsidian-form-input'
    });
    const orgInput = new TextComponent(orgInputEl);
    orgInput.inputEl.placeholder = 'Enter organization ID';
    
    // Set initial value
    const settings = this.settingsManager.getSettings();
    const org = settings.provider === 'openai' ? 
      (settings as any).organization || '' : '';
    if (org) {
      orgInput.setValue(org);
    }
    
    // Add change handler
    orgInput.onChange(value => {
      const updates = { ...this.settingsManager.getSettings() };
      (updates as any).organization = value;
      this.settingsManager.updateSettings(updates);
    });
    
    // Create beta features toggle
    const betaContainerEl = containerEl.createDiv({
      cls: 'chatsidian-form-group'
    });
    betaContainerEl.createDiv({
      cls: 'chatsidian-form-label',
      text: 'Enable Beta Features'
    });
    const betaInputEl = betaContainerEl.createDiv({
      cls: 'chatsidian-form-input'
    });
    const betaToggle = new ToggleComponent(betaInputEl);
    
    // Set initial value
    const beta = settings.provider === 'openai' ? 
      (settings as any).enableBeta === true : false;
    betaToggle.setValue(beta);
    
    // Add change handler
    betaToggle.onChange(value => {
      const updates = { ...this.settingsManager.getSettings() };
      (updates as any).enableBeta = value;
      this.settingsManager.updateSettings(updates);
    });
  }
  
  /**
   * Render Google-specific settings
   * 
   * @param containerEl - The container element to render the settings in
   */
  private renderGoogleSettings(containerEl: HTMLElement): void {
    // Create project ID field
    const projectContainerEl = containerEl.createDiv({
      cls: 'chatsidian-form-group'
    });
    projectContainerEl.createDiv({
      cls: 'chatsidian-form-label',
      text: 'Project ID'
    });
    const projectInputEl = projectContainerEl.createDiv({
      cls: 'chatsidian-form-input'
    });
    const projectInput = new TextComponent(projectInputEl);
    projectInput.inputEl.placeholder = 'Enter Google Cloud project ID';
    
    // Set initial value
    const settings = this.settingsManager.getSettings();
    const project = settings.provider === 'google' ? 
      (settings as any).projectId || '' : '';
    if (project) {
      projectInput.setValue(project);
    }
    
    // Add change handler
    projectInput.onChange(value => {
      if (value) {
        const updates = { ...this.settingsManager.getSettings() };
        (updates as any).projectId = value;
        this.settingsManager.updateSettings(updates);
      }
    });
    
    // Create location field
    const locationContainerEl = containerEl.createDiv({
      cls: 'chatsidian-form-group'
    });
    locationContainerEl.createDiv({
      cls: 'chatsidian-form-label',
      text: 'Location'
    });
    const locationInputEl = locationContainerEl.createDiv({
      cls: 'chatsidian-form-input'
    });
    const locationInput = new TextComponent(locationInputEl);
    locationInput.inputEl.placeholder = 'Enter location (e.g., us-central1)';
    
    // Set initial value
    const location = settings.provider === 'google' ? 
      (settings as any).location || '' : '';
    if (location) {
      locationInput.setValue(location);
    }
    
    // Add change handler
    locationInput.onChange(value => {
      if (value) {
        const updates = { ...this.settingsManager.getSettings() };
        (updates as any).location = value;
        this.settingsManager.updateSettings(updates);
      }
    });
  }
  
  /**
   * Render OpenRouter-specific settings
   * 
   * @param containerEl - The container element to render the settings in
   */
  private renderOpenRouterSettings(containerEl: HTMLElement): void {
    // Create referral ID field
    const referralContainerEl = containerEl.createDiv({
      cls: 'chatsidian-form-group'
    });
    referralContainerEl.createDiv({
      cls: 'chatsidian-form-label',
      text: 'Referral ID (optional)'
    });
    const referralInputEl = referralContainerEl.createDiv({
      cls: 'chatsidian-form-input'
    });
    const referralInput = new TextComponent(referralInputEl);
    referralInput.inputEl.placeholder = 'Enter referral ID';
    
    // Set initial value
    const settings = this.settingsManager.getSettings();
    const referral = settings.provider === 'openrouter' ? 
      (settings as any).referralId || '' : '';
    if (referral) {
      referralInput.setValue(referral);
    }
    
    // Add change handler
    referralInput.onChange(value => {
      const updates = { ...this.settingsManager.getSettings() };
      (updates as any).referralId = value;
      this.settingsManager.updateSettings(updates);
    });
  }
  
  /**
   * Render custom provider settings
   * 
   * @param containerEl - The container element to render the settings in
   */
  private renderCustomSettings(containerEl: HTMLElement): void {
    // Create model format field
    const formatContainerEl = containerEl.createDiv({
      cls: 'chatsidian-form-group'
    });
    formatContainerEl.createDiv({
      cls: 'chatsidian-form-label',
      text: 'Model Format'
    });
    const formatInputEl = formatContainerEl.createDiv({
      cls: 'chatsidian-form-input'
    });
    const formatInput = new TextComponent(formatInputEl);
    formatInput.inputEl.placeholder = 'Enter model format (openai, anthropic, etc.)';
    
    // Set initial value
    const settings = this.settingsManager.getSettings();
    const format = settings.provider === 'custom' ? 
      (settings as any).modelFormat || '' : '';
    if (format) {
      formatInput.setValue(format);
    }
    
    // Add change handler
    formatInput.onChange(value => {
      if (value) {
        const updates = { ...this.settingsManager.getSettings() };
        (updates as any).modelFormat = value;
        this.settingsManager.updateSettings(updates);
      }
    });
    
    // Create headers field
    const headersContainerEl = containerEl.createDiv({
      cls: 'chatsidian-form-group'
    });
    headersContainerEl.createDiv({
      cls: 'chatsidian-form-label',
      text: 'Custom Headers (JSON)'
    });
    const headersInputEl = headersContainerEl.createDiv({
      cls: 'chatsidian-form-input'
    });
    const headersInput = document.createElement('textarea');
    headersInput.className = 'chatsidian-textarea';
    headersInput.rows = 3;
    headersInput.placeholder = '{"header1": "value1", "header2": "value2"}';
    
    // Set initial value
    const headers = settings.provider === 'custom' ? 
      (settings as any).headers || '' : '';
    if (headers) {
      try {
        headersInput.value = JSON.stringify(JSON.parse(headers), null, 2);
      } catch (e) {
        headersInput.value = headers;
      }
    }
    
    // Add change handler
    headersInput.addEventListener('change', () => {
      try {
        // Validate JSON
        const value = headersInput.value.trim();
        if (value) {
          JSON.parse(value);
          const updates = { ...this.settingsManager.getSettings() };
          (updates as any).headers = value;
          this.settingsManager.updateSettings(updates);
        } else {
          const updates = { ...this.settingsManager.getSettings() };
          (updates as any).headers = '';
          this.settingsManager.updateSettings(updates);
        }
      } catch (e) {
        // Show error message
        const errorEl = headersContainerEl.createDiv({
          cls: 'chatsidian-form-error',
          text: 'Invalid JSON format'
        });
        
        // Remove error message after 3 seconds
        setTimeout(() => {
          errorEl.remove();
        }, 3000);
      }
    });
    
    headersInputEl.appendChild(headersInput);
  }
  
  /**
   * Get the icon for a provider
   * 
   * @param provider - The provider to get the icon for
   * @returns The icon name
   */
  private getProviderIcon(provider: string): string {
    // Get the icon for the provider
    switch (provider.toLowerCase()) {
      case 'openai':
        return 'bot';
      case 'anthropic':
        return 'message-square';
      case 'google':
        return 'search';
      case 'openrouter':
        return 'globe';
      case 'custom':
        return 'settings';
      default:
        return 'cloud';
    }
  }
  
  /**
   * Format a provider name for display
   * 
   * @param provider - The provider name to format
   * @returns The formatted provider name
   */
  private formatProviderName(provider: string): string {
    // Capitalize first letter and handle special cases
    switch (provider.toLowerCase()) {
      case 'openai':
        return 'OpenAI';
      case 'anthropic':
        return 'Anthropic';
      case 'google':
        return 'Google';
      case 'openrouter':
        return 'OpenRouter';
      case 'custom':
        return 'Custom';
      default:
        return provider.charAt(0).toUpperCase() + provider.slice(1);
    }
  }
  
  /**
   * Set the selected provider
   * 
   * @param provider - The provider to select
   */
  setSelectedProvider(provider: string): void {
    if (this.providerService.isProviderSupported(provider)) {
      this.selectedProvider = provider;
      this.render();
    }
  }
  
  /**
   * Get the currently selected provider
   * 
   * @returns The currently selected provider
   */
  getSelectedProvider(): string {
    return this.selectedProvider;
  }
}

/**
 * Modal for provider settings
 */
export class ProviderSettingsModal extends Modal {
  /**
   * Event bus for component communication
   */
  private eventBus: EventBus;
  
  /**
   * Settings service for accessing settings
   */
  private settingsService: SettingsService;
  
  /**
   * Provider service for accessing provider information
   */
  private providerService: ProviderService;
  
  /**
   * Provider settings component
   */
  private providerSettings: ProviderSettings | null = null;
  
  /**
   * Constructor for the ProviderSettingsModal
   * 
   * @param app - The Obsidian app
   * @param eventBus - The event bus for component communication
   * @param settingsService - The settings service for accessing settings
   * @param providerService - The provider service for accessing provider information
   */
  constructor(
    app: any,
    eventBus: EventBus,
    settingsService: SettingsService,
    providerService: ProviderService
  ) {
    super(app);
    this.eventBus = eventBus;
    this.settingsService = settingsService;
    this.providerService = providerService;
  }
  
  /**
   * Called when the modal is opened
   */
  onOpen(): void {
    const { contentEl } = this;
    
    // Set title
    contentEl.createEl('h2', {
      text: 'Provider Settings'
    });
    
    // Create provider settings container
    const providerSettingsContainerEl = contentEl.createDiv({
      cls: 'chatsidian-provider-settings-modal-container'
    });
    
    // Initialize provider settings component
    this.providerSettings = new ProviderSettings(
      providerSettingsContainerEl,
      this.eventBus,
      this.settingsService,
      this.providerService,
      this.settingsService.getSettingsManager().getProvider()
    );
    
    // Create close button
    const closeButtonEl = contentEl.createDiv({
      cls: 'chatsidian-modal-buttons'
    });
    
    const closeButton = new ButtonComponent(closeButtonEl)
      .setButtonText('Close')
      .setCta()
      .onClick(() => {
        this.close();
      });
  }
  
  /**
   * Called when the modal is closed
   */
  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
    
    // Clean up provider settings component
    if (this.providerSettings) {
      this.providerSettings.unload();
      this.providerSettings = null;
    }
  }
}
