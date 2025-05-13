/**
 * ProviderSettings Component
 * 
 * This component provides a UI for configuring provider settings.
 * It allows setting API keys and other provider-specific options.
 * 
 * @file This file defines the ProviderSettings class for provider configuration.
 */

import { Component, ButtonComponent, TextComponent, ToggleComponent, Modal, App, Setting } from 'obsidian';
import { EventBus } from '../../core/EventBus';
import { SettingsService } from '../../services/SettingsService';
import { ProviderService } from '../../services/ProviderService';
import { SettingsManager } from '../../core/SettingsManager';
import { Notice } from '../../utils/obsidian-imports';

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
    
    // Create provider selector
    this.renderProviderSelector();
    
    // Create provider settings
    this.renderProviderSettings();
  }
  
  /**
   * Render the provider selector
   */
  private renderProviderSelector(): void {
    new Setting(this.containerEl)
      .setName('Provider')
      .setDesc('Select the AI provider to use')
      .addDropdown(dropdown => {
        // Get supported providers
        const providers = this.providerService.getSupportedProviders();
        
        // Add providers to dropdown
        for (const provider of providers) {
          dropdown.addOption(provider, this.formatProviderName(provider));
        }
        
        // Set initial value
        dropdown.setValue(this.selectedProvider);
        
        // Add change handler
        dropdown.onChange(value => {
          this.selectedProvider = value;
          this.render();
          
          // Emit provider changed event
          this.eventBus.emit(ProviderSettingsEventType.SETTINGS_UPDATED, {
            provider: value
          });
        });
      });
  }
  
  /**
   * Render the provider settings
   */
  private renderProviderSettings(): void {
    // Create API key field
    new Setting(this.containerEl)
      .setName('API Key')
      .setDesc('Enter your API key for the selected provider')
      .addText(text => {
        // Set initial value
        const currentSettings = this.settingsManager.getSettings();
        const apiKey = currentSettings.provider === this.selectedProvider ? currentSettings.apiKey : '';
        if (apiKey) {
          text.setValue('••••••••••••••••••••••••••');
        }
        
        // Set input type to password
        text.inputEl.type = 'password';
        text.inputEl.placeholder = 'Enter API key';
        
        // Add change handler
        text.onChange(value => {
          if (value && value !== '••••••••••••••••••••••••••') {
            this.settingsManager.setApiKey(value);
            
            // Emit API key updated event
            this.eventBus.emit(ProviderSettingsEventType.API_KEY_UPDATED, {
              provider: this.selectedProvider,
              apiKey: value
            });
          }
        });
      });
    
    // Create API endpoint field for custom providers
    if (this.selectedProvider === 'custom') {
      new Setting(this.containerEl)
        .setName('API Endpoint')
        .setDesc('Enter the endpoint URL for the custom provider')
        .addText(text => {
          // Set initial value
          const currentSettings = this.settingsManager.getSettings();
          const apiEndpoint = currentSettings.apiEndpoint || '';
          if (apiEndpoint) {
            text.setValue(apiEndpoint);
          }
          
          text.inputEl.placeholder = 'Enter API endpoint URL';
          
          // Add change handler
          text.onChange(value => {
            if (value) {
              this.settingsManager.updateSettings({ apiEndpoint: value });
              
              // Emit API endpoint updated event
              this.eventBus.emit(ProviderSettingsEventType.API_ENDPOINT_UPDATED, {
                provider: this.selectedProvider,
                apiEndpoint: value
              });
            }
          });
        });
    }
    
    // Create provider-specific settings
    this.renderProviderSpecificSettings();
  }
  
  /**
   * Render provider-specific settings
   */
  private renderProviderSpecificSettings(): void {
    // Add provider-specific settings based on the selected provider
    switch (this.selectedProvider) {
      case 'anthropic':
        this.renderAnthropicSettings();
        break;
      case 'openai':
        this.renderOpenAISettings();
        break;
      case 'google':
        this.renderGoogleSettings();
        break;
      case 'openrouter':
        this.renderOpenRouterSettings();
        break;
      case 'custom':
        this.renderCustomSettings();
        break;
    }
  }
  
  /**
   * Render Anthropic-specific settings
   */
  private renderAnthropicSettings(): void {
    // Create version field
    new Setting(this.containerEl)
      .setName('API Version')
      .setDesc('Enter the Anthropic API version to use')
      .addText(text => {
        // Set initial value
        const settings = this.settingsManager.getSettings();
        const version = settings.provider === 'anthropic' ? 
          (settings as any).apiVersion || '' : '';
        if (version) {
          text.setValue(version);
        }
        
        text.inputEl.placeholder = 'Enter API version (e.g., 2023-06-01)';
        
        // Add change handler
        text.onChange(value => {
          if (value) {
            const updates = { ...this.settingsManager.getSettings() };
            (updates as any).apiVersion = value;
            this.settingsManager.updateSettings(updates);
          }
        });
      });
  }
  
  /**
   * Render OpenAI-specific settings
   */
  private renderOpenAISettings(): void {
    // Create organization field
    new Setting(this.containerEl)
      .setName('Organization ID')
      .setDesc('Enter your OpenAI organization ID (optional)')
      .addText(text => {
        // Set initial value
        const settings = this.settingsManager.getSettings();
        const org = settings.provider === 'openai' ? 
          (settings as any).organization || '' : '';
        if (org) {
          text.setValue(org);
        }
        
        text.inputEl.placeholder = 'Enter organization ID';
        
        // Add change handler
        text.onChange(value => {
          const updates = { ...this.settingsManager.getSettings() };
          (updates as any).organization = value;
          this.settingsManager.updateSettings(updates);
        });
      });
    
    // Create beta features toggle
    new Setting(this.containerEl)
      .setName('Enable Beta Features')
      .setDesc('Toggle to enable OpenAI beta features')
      .addToggle(toggle => {
        // Set initial value
        const settings = this.settingsManager.getSettings();
        const beta = settings.provider === 'openai' ? 
          (settings as any).enableBeta === true : false;
        toggle.setValue(beta);
        
        // Add change handler
        toggle.onChange(value => {
          const updates = { ...this.settingsManager.getSettings() };
          (updates as any).enableBeta = value;
          this.settingsManager.updateSettings(updates);
        });
      });
  }
  
  /**
   * Render Google-specific settings
   */
  private renderGoogleSettings(): void {
    // Create project ID field
    new Setting(this.containerEl)
      .setName('Project ID')
      .setDesc('Enter your Google Cloud project ID')
      .addText(text => {
        // Set initial value
        const settings = this.settingsManager.getSettings();
        const project = settings.provider === 'google' ? 
          (settings as any).projectId || '' : '';
        if (project) {
          text.setValue(project);
        }
        
        text.inputEl.placeholder = 'Enter Google Cloud project ID';
        
        // Add change handler
        text.onChange(value => {
          if (value) {
            const updates = { ...this.settingsManager.getSettings() };
            (updates as any).projectId = value;
            this.settingsManager.updateSettings(updates);
          }
        });
      });
    
    // Create location field
    new Setting(this.containerEl)
      .setName('Location')
      .setDesc('Enter the Google Cloud location')
      .addText(text => {
        // Set initial value
        const settings = this.settingsManager.getSettings();
        const location = settings.provider === 'google' ? 
          (settings as any).location || '' : '';
        if (location) {
          text.setValue(location);
        }
        
        text.inputEl.placeholder = 'Enter location (e.g., us-central1)';
        
        // Add change handler
        text.onChange(value => {
          if (value) {
            const updates = { ...this.settingsManager.getSettings() };
            (updates as any).location = value;
            this.settingsManager.updateSettings(updates);
          }
        });
      });
  }
  
  /**
   * Render OpenRouter-specific settings
   */
  private renderOpenRouterSettings(): void {
    // Create referral ID field
    new Setting(this.containerEl)
      .setName('Referral ID')
      .setDesc('Enter your OpenRouter referral ID (optional)')
      .addText(text => {
        // Set initial value
        const settings = this.settingsManager.getSettings();
        const referral = settings.provider === 'openrouter' ? 
          (settings as any).referralId || '' : '';
        if (referral) {
          text.setValue(referral);
        }
        
        text.inputEl.placeholder = 'Enter referral ID';
        
        // Add change handler
        text.onChange(value => {
          const updates = { ...this.settingsManager.getSettings() };
          (updates as any).referralId = value;
          this.settingsManager.updateSettings(updates);
        });
      });
  }
  
  /**
   * Render custom provider settings
   */
  private renderCustomSettings(): void {
    // Create model format field
    new Setting(this.containerEl)
      .setName('Model Format')
      .setDesc('Enter the format used by the custom model')
      .addText(text => {
        // Set initial value
        const settings = this.settingsManager.getSettings();
        const format = settings.provider === 'custom' ? 
          (settings as any).modelFormat || '' : '';
        if (format) {
          text.setValue(format);
        }
        
        text.inputEl.placeholder = 'Enter model format (openai, anthropic, etc.)';
        
        // Add change handler
        text.onChange(value => {
          if (value) {
            const updates = { ...this.settingsManager.getSettings() };
            (updates as any).modelFormat = value;
            this.settingsManager.updateSettings(updates);
          }
        });
      });
    
    // Create headers field
    new Setting(this.containerEl)
      .setName('Custom Headers')
      .setDesc('Enter custom headers as JSON')
      .addTextArea(textarea => {
        // Set initial value
        const settings = this.settingsManager.getSettings();
        const headers = settings.provider === 'custom' ? 
          (settings as any).headers || '' : '';
        if (headers) {
          try {
            textarea.setValue(JSON.stringify(JSON.parse(headers), null, 2));
          } catch (e) {
            textarea.setValue(headers);
          }
        }
        
        textarea.inputEl.rows = 3;
        textarea.inputEl.placeholder = '{"header1": "value1", "header2": "value2"}';
        textarea.inputEl.style.fontFamily = 'var(--font-monospace)';
        textarea.inputEl.style.fontSize = 'var(--font-smaller)';
        
        // Add change handler
        textarea.onChange(value => {
          try {
            // Validate JSON
            if (value.trim()) {
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
            // Show error using Obsidian's native notification
            new Notice('Invalid JSON format');
          }
        });
      });
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
    app: App,
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
    
    // Set modal title
    contentEl.createEl('h2', {
      text: 'Provider Settings',
      cls: 'modal-title'
    });
    
    // Create provider settings container
    const providerSettingsContainerEl = contentEl.createDiv({
      cls: 'modal-content'
    });
    
    // Initialize provider settings component
    this.providerSettings = new ProviderSettings(
      providerSettingsContainerEl,
      this.eventBus,
      this.settingsService,
      this.providerService,
      this.settingsService.getSettingsManager().getProvider()
    );
    
    // Create button container using Obsidian's standard modal buttons pattern
    const buttonContainerEl = contentEl.createDiv({
      cls: 'modal-button-container'
    });
    
    // Add close button
    new ButtonComponent(buttonContainerEl)
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