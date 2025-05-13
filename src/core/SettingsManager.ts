/**
 * Settings manager for the Chatsidian plugin.
 * 
 * This file provides classes for managing plugin settings, including:
 * - SettingsManager: Core class for managing settings state and updates
 * - ChatsidianSettingTab: Obsidian settings tab UI
 * - SettingsExportImport: Utilities for exporting and importing settings
 * - SettingsMigration: Utilities for migrating settings from previous versions
 */

// Import from obsidian in production, but use mocks in tests
import { App, Plugin, PluginSettingTab, Setting, Notice } from '../utils/obsidian-imports';
import { ChatsidianSettings, DEFAULT_SETTINGS, SettingsUtils } from '../models/Settings';
import { EventBus } from './EventBus';
import { modelRegistry } from '../providers/ModelRegistry';
import { ModelSelectorComponent } from '../ui/models/ModelSelectorComponent';
import { ProviderSettings } from '../ui/models/ProviderSettings';
import { AgentDefinition } from '../agents/AgentTypes';
import { ProviderType, ProviderTypeUtils } from '../ui/models/ProviderType';

/**
 * SettingsManager class for managing plugin settings.
 * Handles loading, saving, and updating settings, and emits events when settings change.
 */
export class SettingsManager {
  private settings: ChatsidianSettings;
  private saveSettings: (settings: ChatsidianSettings) => Promise<void>;
  private eventBus: EventBus;
  
  /**
   * Create a new SettingsManager.
   * @param initialSettings Initial settings values
   * @param saveSettings Function to save settings to disk
   * @param eventBus Event bus for emitting settings events
   */
  constructor(
    initialSettings: Partial<ChatsidianSettings>,
    saveSettings: (settings: ChatsidianSettings) => Promise<void>,
    eventBus: EventBus
  ) {
    this.settings = SettingsUtils.validate(initialSettings);
    this.saveSettings = saveSettings;
    this.eventBus = eventBus;
  }
  
  /**
   * Get a copy of the current settings.
   * @returns A copy of the settings object
   */
  public getSettings(): ChatsidianSettings {
    return { ...this.settings };
  }
  
  /**
   * Update settings with new values.
   * @param updates Partial settings object with values to update
   * @returns Promise that resolves when settings are saved
   */
  public async updateSettings(updates: Partial<ChatsidianSettings>): Promise<void> {
    const previousSettings = { ...this.settings };
    
    // Validate and merge updates
    const validated = SettingsUtils.validate({
      ...this.settings,
      ...updates
    });
    
    this.settings = validated;
    
    // Determine which keys were changed
    const changedKeys = Object.keys(updates).filter(key => {
      const k = key as keyof ChatsidianSettings;
      return JSON.stringify(previousSettings[k]) !== JSON.stringify(this.settings[k]);
    });
    
    // Save settings to disk
    await this.saveSettings(this.settings);
    
    // Notify listeners of changes
    this.eventBus.emit('settings:updated', {
      previousSettings,
      currentSettings: { ...this.settings },
      changedKeys
    });
  }
  
  /**
   * Set the API key for the current provider.
   * @param apiKey API key to set
   * @returns Promise that resolves when settings are saved
   */
  public async setApiKey(apiKey: string): Promise<void> {
    await this.updateSettings({ apiKey });
  }
  
  /**
   * Get the current provider.
   * @returns The current provider
   */
  public getProvider(): string {
    return this.settings.provider;
  }
  
  /**
   * Get the API key for the current provider.
   * @returns The API key
   */
  public getApiKey(): string {
    return this.settings.apiKey;
  }
  
  /**
   * Get the current model.
   * @returns The current model
   */
  public getModel(): string {
    return this.settings.model;
  }
  
  /**
   * Get the conversations folder path.
   * @returns The conversations folder path
   */
  public getConversationsPath(): string {
    return this.settings.conversationsFolder;
  }
  
  // No getDefaultSystemPrompt method needed as system prompts are now managed by specific components
  
  /**
   * Check if debug mode is enabled.
   * @returns True if debug mode is enabled
   */
  public isDebugModeEnabled(): boolean {
    return this.settings.debugMode;
  }
  
  /**
   * Reset settings to defaults.
   * @returns Promise that resolves when settings are reset
   */
  public async resetToDefaults(): Promise<void> {
    await this.updateSettings(DEFAULT_SETTINGS);
  }
}

/**
 * Obsidian settings tab for the Chatsidian plugin.
 * Provides a user interface for adjusting plugin settings.
 */
export class ChatsidianSettingTab extends PluginSettingTab {
  app: any;
  containerEl: HTMLElement;
  private plugin: any;
  private settings: SettingsManager;
  
  /**
   * Create a new ChatsidianSettingTab.
   * @param app Obsidian app instance
   * @param plugin Plugin instance
   */
  constructor(app: any, plugin: any) {
    super(app, plugin);
    this.app = app;
    this.plugin = plugin;
    // Use settingsService to get the settings manager
    this.settings = plugin.settingsService?.getSettingsManager();
  }
  
  /**
   * Hide the settings tab.
   * This will be called by Obsidian when the settings tab is closed.
   */
  hide(): void {
    // Clean up any resources
    this.containerEl.empty();
    
    // Emit event that settings tab was closed
    if (this.plugin.eventBus) {
      this.plugin.eventBus.emit('settings:closed', undefined);
    }
  }
  
  /**
   * Display the settings UI.
   */
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    
    // Add a guard to check if settings manager is available
    if (!this.settings) {
      containerEl.createEl('div', { 
        text: 'Settings manager not initialized properly. Please reload the plugin.',
        cls: 'chatsidian-settings-error'
      });
      return;
    }
    
    const settings = this.settings.getSettings();
    
    this.createApiSettings(containerEl, settings);
    this.createAgentSettings(containerEl, settings);
    this.createConversationSettings(containerEl, settings);
    this.createDebugSettings(containerEl, settings);
  }
  
  /**
   * Create API settings section.
   * @param containerEl Container element
   * @param settings Current settings
   */
  private createApiSettings(containerEl: HTMLElement, settings: ChatsidianSettings): void {
    containerEl.createEl('h2', { text: 'API Settings' });
    
    new Setting(containerEl)
      .setName('AI Provider')
      .setDesc('Select which AI service to use')
      .addDropdown((dropdown: any) => dropdown
        .addOption('anthropic', 'Anthropic (Claude)')
        .addOption('openai', 'OpenAI (GPT)')
        .addOption('openrouter', 'OpenRouter')
        .addOption('google', 'Google AI')
        .addOption('custom', 'Custom API')
        .setValue(settings.provider)
          .onChange(async (value: any) => {
          await this.settings.updateSettings({ 
            provider: value as ChatsidianSettings['provider'] 
          });
        }));
    
    new Setting(containerEl)
      .setName('API Key')
      .setDesc('Your API key for the selected provider')
      .addText((text: any) => text
        .setPlaceholder('Enter your API key')
        .setValue(settings.apiKey)
          .onChange(async (value: any) => {
          await this.settings.setApiKey(value);
        }));
    
    // Only show custom endpoint for custom provider
    if (settings.provider === 'custom') {
      new Setting(containerEl)
        .setName('API Endpoint')
        .setDesc('Custom API endpoint URL')
        .addText((text: any) => text
          .setPlaceholder('https://api.example.com/v1')
          .setValue(settings.apiEndpoint || '')
          .onChange(async (value: any) => {
            await this.settings.updateSettings({ apiEndpoint: value });
          }));
    }
    
    // Get models for current provider from the ModelRegistry
    const providerModels = ProviderTypeUtils.isValidProviderType(settings.provider) 
      ? modelRegistry.getModelsForProvider(settings.provider as ProviderType)
      : [];
    
    new Setting(containerEl)
      .setName('Model')
      .setDesc('Select which model to use')
      .addDropdown((dropdown: any) => {
        // Add common models for current provider
        providerModels.forEach(model => {
          dropdown.addOption(model.id, model.name);
        });
        
        // Add custom option
        dropdown.addOption('custom', 'Custom Model ID');
        
        return dropdown
          .setValue(settings.model)
          .onChange(async (value: any) => {
            await this.settings.updateSettings({ model: value });
          });
      });
    
    // Show custom model input if custom model is selected
    if (!providerModels.some(m => m.id === settings.model)) {
      new Setting(containerEl)
        .setName('Custom Model ID')
        .setDesc('Enter a custom model identifier')
        .addText((text: any) => text
          .setPlaceholder('model-id')
          .setValue(settings.model)
          .onChange(async (value: any) => {
            await this.settings.updateSettings({ model: value });
          }));
    }
    
    new Setting(containerEl)
      .setName('Test Connection')
      .setDesc('Test your API connection')
      .addButton((button: any) => button
        .setButtonText('Test')
        .onClick(async () => {
          button.setButtonText('Testing...');
          button.setDisabled(true);
          
          try {
            const provider = this.plugin.providerFactory?.getAdapter(
              settings.provider,
              settings.apiKey
            );
            
            if (provider) {
              const success = await provider.testConnection();
              
              if (success) {
                new this.plugin.app.Notice('Connection successful!');
              } else {
                new this.plugin.app.Notice('Connection failed. Check your API key and settings.');
              }
            } else {
              new this.plugin.app.Notice('Provider adapter not available yet.');
            }
          } catch (error) {
            new this.plugin.app.Notice(`Error: ${error.message}`);
          } finally {
            button.setButtonText('Test');
            button.setDisabled(false);
          }
        }));
  }
  
  /**
   * Create conversation settings section.
   * @param containerEl Container element
   * @param settings Current settings
   */
  private createConversationSettings(containerEl: HTMLElement, settings: ChatsidianSettings): void {
    containerEl.createEl('h2', { text: 'Conversation Settings' });
    
    new Setting(containerEl)
      .setName('Conversations Folder')
      .setDesc('Folder where conversations are stored')
      .addText((text: any) => text
        .setPlaceholder('folder/path')
        .setValue(settings.conversationsFolder)
          .onChange(async (value: any) => {
          await this.settings.updateSettings({ conversationsFolder: value });
        }));
    
    new Setting(containerEl)
      .setName('Max Messages')
      .setDesc('Maximum number of messages to keep in memory')
      .addSlider((slider: any) => slider
        .setLimits(10, 500, 10)
        .setValue(settings.maxMessages)
        .setDynamicTooltip()
          .onChange(async (value: any) => {
          await this.settings.updateSettings({ maxMessages: value });
        }));
  }
  
  /**
   * Create agent settings section.
   * @param containerEl Container element
   * @param settings Current settings
   */
  private createAgentSettings(containerEl: HTMLElement, settings: ChatsidianSettings): void {
    containerEl.createEl('h2', { text: 'Agent Settings' });
    
    // Create container for agent display
    const agentSelectorContainer = containerEl.createDiv({ cls: 'chatsidian-settings-agent-selector' });
    
    if (this.plugin.providerService && this.plugin.agentSystem) {
      // Create a local event bus for the agent selector component
      const localEventBus = new EventBus();
      
      // Create standalone agent selector component
      const agentSystem = this.plugin.agentSystem;
      import('../ui/models/AgentSelector').then(({ AgentSelector }) => {
        new AgentSelector(
          agentSelectorContainer,
          localEventBus,
          agentSystem,
          {
            showBuiltInAgents: true,
            showCustomAgents: true,
            allowCreatingAgents: true,
            allowEditingAgents: true,
            allowDeletingAgents: true
          },
          settings.defaultAgentId
        );
      }).catch(err => {
        console.error('Failed to load AgentSelector component:', err);
        agentSelectorContainer.createEl('p', { 
          text: 'Failed to load agent selector component. Please reload the plugin.' 
        });
      });
      
      // Listen for agent selection events
      localEventBus.on('agent-selector:agent-selected', async (data: any) => {
        if (data.agent) {
          await this.settings.updateSettings({
            defaultAgentId: data.agent.id
          });
        }
      });
      
      // Listen for agent creation events
      localEventBus.on('agent-selector:agent-created', async (data: any) => {
        if (data.agent) {
          const customAgents = settings.customAgents || [];
          customAgents.push(data.agent);
          await this.settings.updateSettings({ customAgents });
          new Notice(`Agent "${data.agent.name}" created`);
        }
      });
      
      // Listen for agent deletion events
      localEventBus.on('agent-selector:agent-deleted', async (data: any) => {
        if (data.agentId) {
          const customAgents = settings.customAgents || [];
          const updatedAgents = customAgents.filter((a: AgentDefinition) => a.id !== data.agentId);
          await this.settings.updateSettings({ customAgents: updatedAgents });
          new Notice(`Agent deleted`);
        }
      });
    } else {
      agentSelectorContainer.createEl('p', { 
        text: 'Agent management not available. Please reload the plugin.' 
      });
    }
  }
  
  /**
   * Create debug settings section.
   * @param containerEl Container element
   * @param settings Current settings
   */
  private createDebugSettings(containerEl: HTMLElement, settings: ChatsidianSettings): void {
    containerEl.createEl('h2', { text: 'Debug Settings' });
    
    new Setting(containerEl)
      .setName('Debug Mode')
      .setDesc('Enable verbose logging')
      .addToggle((toggle: any) => toggle
        .setValue(settings.debugMode)
          .onChange(async (value: any) => {
          await this.settings.updateSettings({ debugMode: value });
        }));
    
    new Setting(containerEl)
      .setName('Reset All Settings')
      .setDesc('Reset all settings to their default values')
      .addButton((button: any) => button
        .setButtonText('Reset All')
        .setWarning()
        .onClick(async () => {
          const confirm = await this.plugin.app.modal.confirm(
            'Reset all settings?',
            'This will reset all settings to their default values. This action cannot be undone.'
          );
          
          if (confirm) {
            await this.settings.resetToDefaults();
            this.display(); // Refresh UI
            new this.plugin.app.Notice('Settings reset to defaults');
          }
        }));
  }
}

/**
 * Settings export/import utilities.
 * Provides functionality for exporting settings to JSON and importing from JSON.
 */
export class SettingsExportImport {
  private settings: SettingsManager;
  
  /**
   * Create a new SettingsExportImport.
   * @param settings Settings manager
   */
  constructor(settings: SettingsManager) {
    this.settings = settings;
  }
  
  /**
   * Export settings to JSON.
   * @param includeApiKey Whether to include the API key
   * @returns Settings as a JSON string
   */
  public exportToJson(includeApiKey: boolean = false): string {
    const settings = this.settings.getSettings();
    
    // Create a copy for export
    const exportSettings = { ...settings };
    
    // Remove sensitive data if not included
    if (!includeApiKey) {
      exportSettings.apiKey = '';
    }
    
    return JSON.stringify(exportSettings, null, 2);
  }
  
  /**
   * Import settings from JSON.
   * @param json Settings JSON
   * @returns Promise that resolves when settings are imported
   */
  public async importFromJson(json: string): Promise<void> {
    try {
      const importedSettings = JSON.parse(json);
      
      // Validate imported settings
      if (typeof importedSettings !== 'object') {
        throw new Error('Invalid settings format');
      }
      
      // Update settings
      await this.settings.updateSettings(importedSettings);
      
      return;
    } catch (error) {
      throw new Error(`Failed to import settings: ${error.message}`);
    }
  }
}

/**
 * Settings migration utilities.
 * Provides functionality for migrating settings from previous versions.
 */
export class SettingsMigration {
  /**
   * Migrate settings from a previous version.
   * @param oldSettings Settings from a previous version
   * @returns Migrated settings
   */
  public static migrateSettings(oldSettings: any): Partial<ChatsidianSettings> {
    // Start with empty settings
    const newSettings: Partial<ChatsidianSettings> = {};
    
    // Map known fields from old to new format
    if (oldSettings) {
      // Direct mappings - only keep fields that are still in the current schema
      if (oldSettings.provider) newSettings.provider = oldSettings.provider;
      if (oldSettings.apiKey) newSettings.apiKey = oldSettings.apiKey;
      if (oldSettings.model) newSettings.model = oldSettings.model;
      if (oldSettings.conversationsFolder) newSettings.conversationsFolder = oldSettings.conversationsFolder;
      if (oldSettings.maxMessages) newSettings.maxMessages = oldSettings.maxMessages;
      if (oldSettings.debugMode) newSettings.debugMode = oldSettings.debugMode;
      
      // Save any agent settings
      if (oldSettings.defaultAgentId) newSettings.defaultAgentId = oldSettings.defaultAgentId;
      if (oldSettings.customAgents) newSettings.customAgents = oldSettings.customAgents;
      
      // Note: UI settings (theme, fontSize, showTimestamps) are now removed
      // Note: Advanced settings (autoLoadBCPs, defaultTemperature, defaultMaxTokens) are now removed
      
      // Handle any other specific migrations here
    }
    
    return newSettings;
  }
}
