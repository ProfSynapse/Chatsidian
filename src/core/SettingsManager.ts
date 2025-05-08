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
import { App, Plugin, PluginSettingTab, Setting } from '../utils/obsidian-imports';
import { ChatsidianSettings, DEFAULT_SETTINGS, SettingsUtils } from '../models/Settings';
import { EventBus } from './EventBus';
import { ModelsLoader } from '../providers/ModelsLoader';
import { ModelSelectorComponent } from '../ui/models/ModelSelectorComponent';
import { ProviderSettings } from '../ui/models/ProviderSettings';
import { AgentDefinition } from '../agents/AgentTypes';

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
  
  /**
   * Get the default system prompt.
   * @returns The default system prompt
   */
  public getDefaultSystemPrompt(): string {
    return this.settings.defaultSystemPrompt;
  }
  
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
  private plugin: any;
  private settings: SettingsManager;
  
  /**
   * Create a new ChatsidianSettingTab.
   * @param app Obsidian app instance
   * @param plugin Plugin instance
   */
  constructor(app: App, plugin: any) {
    super(app, plugin);
    this.plugin = plugin;
    this.settings = plugin.settings;
  }
  
  /**
   * Display the settings UI.
   */
  display(): void {
    const { containerEl } = this;
    const settings = this.settings.getSettings();
    
    containerEl.empty();
    
    this.createApiSettings(containerEl, settings);
    this.createModelAndAgentSettings(containerEl, settings);
    this.createConversationSettings(containerEl, settings);
    this.createUiSettings(containerEl, settings);
    this.createAdvancedSettings(containerEl, settings);
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
    
    // Get models for current provider from the centralized models.yaml
    const modelsLoader = ModelsLoader.getInstance();
    const providerModels = modelsLoader.getModelsForProvider(settings.provider);
    
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
    
    new Setting(containerEl)
      .setName('Default System Prompt')
      .setDesc('Default system prompt to use for new conversations')
      .addTextArea((textarea: any) => textarea
        .setPlaceholder('Enter default system prompt')
        .setValue(settings.defaultSystemPrompt)
          .onChange(async (value: any) => {
          await this.settings.updateSettings({ defaultSystemPrompt: value });
        }))
      .addExtraButton((button: any) => button
        .setIcon('reset')
        .setTooltip('Reset to default')
        .onClick(async () => {
          await this.settings.updateSettings({ 
            defaultSystemPrompt: DEFAULT_SETTINGS.defaultSystemPrompt 
          });
          this.display(); // Refresh UI
        }));
  }
  
  /**
   * Create model and agent settings section.
   * @param containerEl Container element
   * @param settings Current settings
   */
  private createModelAndAgentSettings(containerEl: HTMLElement, settings: ChatsidianSettings): void {
    containerEl.createEl('h2', { text: 'Models & Agents' });
    
    // Create container for model selector component
    const modelSelectorContainer = containerEl.createDiv({ cls: 'chatsidian-settings-model-selector' });
    
    // Create model selector component
    if (this.plugin.providerService && this.plugin.agentSystem) {
      // Create a local event bus for the model selector component
      const localEventBus = new EventBus();
      
      // Create model selector component
      new ModelSelectorComponent(
        modelSelectorContainer,
        localEventBus,
        this.plugin.providerService,
        this.plugin.settingsService,
        this.plugin.agentSystem,
        this.app,
        {
          showProviderSelector: true,
          showModelCapabilities: true,
          filterByProvider: true,
          filterByToolSupport: false,
          showBuiltInAgents: true,
          showCustomAgents: true,
          allowCreatingAgents: true,
          allowEditingAgents: true,
          allowDeletingAgents: true,
          showSettingsButton: false
        }
      );
      
      // Listen for model and agent selection events
      localEventBus.on('model-selector:model-selected', async (data: any) => {
        if (data.model) {
          await this.settings.updateSettings({
            provider: data.model.provider,
            model: data.model.id
          });
        }
      });
      
      localEventBus.on('agent-selector:agent-selected', async (data: any) => {
        if (data.agent) {
          await this.settings.updateSettings({
            defaultAgentId: data.agent.id
          });
        }
      });
    } else {
      modelSelectorContainer.createEl('p', { 
        text: 'Model and agent selection components not available. Please reload the plugin.' 
      });
    }
    
    // Provider-specific settings
    containerEl.createEl('h3', { text: 'Provider Settings' });
    const providerSettingsContainer = containerEl.createDiv({ cls: 'chatsidian-settings-provider-settings' });
    
    if (this.plugin.providerService) {
      // Create provider settings component
      const providerSettings = new ProviderSettings(
        providerSettingsContainer,
        this.plugin.eventBus,
        this.plugin.settingsService,
        this.plugin.providerService,
        settings.provider
      );
    } else {
      providerSettingsContainer.createEl('p', { 
        text: 'Provider settings component not available. Please reload the plugin.' 
      });
    }
    
    // Agent management
    containerEl.createEl('h3', { text: 'Agent Management' });
    const agentManagementContainer = containerEl.createDiv({ cls: 'chatsidian-settings-agent-management' });
    
    if (this.plugin.agentSystem) {
      // Create agent management UI
      const agentSystem = this.plugin.agentSystem;
      
      // List custom agents
      const customAgents = settings.customAgents || [];
      
      if (customAgents.length > 0) {
        const agentList = agentManagementContainer.createEl('ul', { cls: 'chatsidian-agent-list' });
        
        customAgents.forEach((agent: AgentDefinition) => {
          const agentItem = agentList.createEl('li', { cls: 'chatsidian-agent-item' });
          
          agentItem.createEl('span', { text: agent.name, cls: 'chatsidian-agent-name' });
          
          const agentActions = agentItem.createDiv({ cls: 'chatsidian-agent-actions' });
          
          // Edit button
          const editButton = agentActions.createEl('button', { text: 'Edit', cls: 'chatsidian-agent-edit-button' });
          editButton.addEventListener('click', () => {
            // Open agent editor (placeholder for now)
            new this.plugin.app.Notice(`Editing agent ${agent.name} (to be implemented)`);
          });
          
          // Delete button
          const deleteButton = agentActions.createEl('button', { text: 'Delete', cls: 'chatsidian-agent-delete-button' });
          deleteButton.addEventListener('click', async () => {
            const confirmed = await this.plugin.app.modal.confirm(
              `Delete Agent`,
              `Are you sure you want to delete the agent "${agent.name}"? This action cannot be undone.`
            );
            
            if (confirmed) {
              // Remove agent from custom agents
              const updatedAgents = customAgents.filter((a: AgentDefinition) => a.id !== agent.id);
              await this.settings.updateSettings({ customAgents: updatedAgents });
              
              // Delete from agent system
              await agentSystem.deleteCustomAgentDefinition(agent.id);
              
              // Refresh UI
              this.display();
              
              new this.plugin.app.Notice(`Agent "${agent.name}" deleted`);
            }
          });
        });
      } else {
        agentManagementContainer.createEl('p', { text: 'No custom agents created yet.' });
      }
      
      // Create new agent button
      const createAgentButton = agentManagementContainer.createEl('button', { 
        text: 'Create New Agent', 
        cls: 'chatsidian-create-agent-button' 
      });
      
      createAgentButton.addEventListener('click', () => {
        // Open agent creation UI (placeholder for now)
        new this.plugin.app.Notice('Creating new agent (to be implemented)');
      });
    } else {
      agentManagementContainer.createEl('p', { 
        text: 'Agent management not available. Please reload the plugin.' 
      });
    }
  }
  
  /**
   * Create UI settings section.
   * @param containerEl Container element
   * @param settings Current settings
   */
  private createUiSettings(containerEl: HTMLElement, settings: ChatsidianSettings): void {
    containerEl.createEl('h2', { text: 'UI Settings' });
    
    new Setting(containerEl)
      .setName('Theme')
      .setDesc('Choose the theme for the chat interface')
      .addDropdown((dropdown: any) => dropdown
        .addOption('light', 'Light')
        .addOption('dark', 'Dark')
        .addOption('system', 'Use System Theme')
        .setValue(settings.theme)
          .onChange(async (value: any) => {
          await this.settings.updateSettings({ 
            theme: value as ChatsidianSettings['theme'] 
          });
        }));
    
    new Setting(containerEl)
      .setName('Font Size')
      .setDesc('Font size for the chat interface')
      .addSlider((slider: any) => slider
        .setLimits(10, 24, 1)
        .setValue(settings.fontSize)
        .setDynamicTooltip()
          .onChange(async (value: any) => {
          await this.settings.updateSettings({ fontSize: value });
        }));
    
    new Setting(containerEl)
      .setName('Show Timestamps')
      .setDesc('Show message timestamps in the chat interface')
      .addToggle((toggle: any) => toggle
        .setValue(settings.showTimestamps)
          .onChange(async (value: any) => {
          await this.settings.updateSettings({ showTimestamps: value });
        }));
  }
  
  /**
   * Create advanced settings section.
   * @param containerEl Container element
   * @param settings Current settings
   */
  private createAdvancedSettings(containerEl: HTMLElement, settings: ChatsidianSettings): void {
    containerEl.createEl('h2', { text: 'Advanced Settings' });
    
    new Setting(containerEl)
      .setName('Debug Mode')
      .setDesc('Enable debug logging')
      .addToggle((toggle: any) => toggle
        .setValue(settings.debugMode)
          .onChange(async (value: any) => {
          await this.settings.updateSettings({ debugMode: value });
        }));
    
    new Setting(containerEl)
      .setName('Auto-load BCPs')
      .setDesc('Bounded Context Packs to load automatically')
      .addTextArea((textarea: any) => textarea
        .setPlaceholder('System,Vault,Editor')
        .setValue(settings.autoLoadBCPs.join(','))
          .onChange(async (value: any) => {
      const bcps = value.split(',').map((s: any) => s.trim()).filter((s: any) => s);
          await this.settings.updateSettings({ autoLoadBCPs: bcps });
        }));
    
    new Setting(containerEl)
      .setName('Default Temperature')
      .setDesc('Default temperature for AI requests (0.0 - 1.0)')
      .addSlider((slider: any) => slider
        .setLimits(0, 1, 0.1)
        .setValue(settings.defaultTemperature)
        .setDynamicTooltip()
          .onChange(async (value: any) => {
          await this.settings.updateSettings({ defaultTemperature: value });
        }));
    
    new Setting(containerEl)
      .setName('Default Max Tokens')
      .setDesc('Default maximum tokens for AI responses')
      .addText((text: any) => text
        .setPlaceholder('4000')
        .setValue(settings.defaultMaxTokens.toString())
          .onChange(async (value: any) => {
          const tokens = parseInt(value);
          if (!isNaN(tokens)) {
            await this.settings.updateSettings({ defaultMaxTokens: tokens });
          }
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
      // Direct mappings
      if (oldSettings.provider) newSettings.provider = oldSettings.provider;
      if (oldSettings.apiKey) newSettings.apiKey = oldSettings.apiKey;
      if (oldSettings.model) newSettings.model = oldSettings.model;
      if (oldSettings.conversationsFolder) newSettings.conversationsFolder = oldSettings.conversationsFolder;
      if (oldSettings.maxMessages) newSettings.maxMessages = oldSettings.maxMessages;
      if (oldSettings.defaultSystemPrompt) newSettings.defaultSystemPrompt = oldSettings.defaultSystemPrompt;
      if (oldSettings.theme) newSettings.theme = oldSettings.theme;
      if (oldSettings.fontSize) newSettings.fontSize = oldSettings.fontSize;
      if (oldSettings.showTimestamps) newSettings.showTimestamps = oldSettings.showTimestamps;
      if (oldSettings.debugMode) newSettings.debugMode = oldSettings.debugMode;
      if (oldSettings.defaultTemperature) newSettings.defaultTemperature = oldSettings.defaultTemperature;
      if (oldSettings.defaultMaxTokens) newSettings.defaultMaxTokens = oldSettings.defaultMaxTokens;
      
      // Field mappings with changes
      if (Array.isArray(oldSettings.bcps)) {
        newSettings.autoLoadBCPs = oldSettings.bcps;
      } else if (typeof oldSettings.bcps === 'string') {
        newSettings.autoLoadBCPs = oldSettings.bcps.split(',').map((s: string) => s.trim()).filter((s: string) => s);
      }
      
      // Handle any other specific migrations here
    }
    
    return newSettings;
  }
}
