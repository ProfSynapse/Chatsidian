---
title: Phase 1.4 - Settings Management
description: Implementing settings management with secure API key storage for the Chatsidian plugin
date: 2025-05-03
status: planning
tags:
  - implementation
  - settings
  - api-keys
  - configuration
  - chatsidian
---

# Phase 1.4: Settings Management

## Overview

This microphase focuses on implementing a robust settings management system for the Chatsidian plugin. The settings manager will handle user configuration, including secure storage of API keys, and provide a user interface for settings adjustment through Obsidian's settings tab system.

## Objectives

- Create a settings manager class for handling plugin configuration
- Implement methods for loading and saving settings
- Create an Obsidian settings tab UI for user configuration
- Add secure API key handling
- Set up settings change event propagation
- Write tests for settings functionality

## Implementation Steps

### 1. Create Settings Manager Class

Create `src/core/SettingsManager.ts`:

```typescript
/**
 * Settings manager for the Chatsidian plugin.
 */

import { ChatsidianSettings, DEFAULT_SETTINGS, SettingsUtils } from '../models/Settings';
import { EventBus } from './EventBus';

/**
 * SettingsManager class for managing plugin settings.
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
```

### 2. Create Obsidian Settings Tab

Add to `src/core/SettingsManager.ts`:

```typescript
import { App, PluginSettingTab, Setting } from 'obsidian';
import { COMMON_MODELS } from '../models/Provider';

/**
 * Obsidian settings tab for the Chatsidian plugin.
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
      .addDropdown(dropdown => dropdown
        .addOption('anthropic', 'Anthropic (Claude)')
        .addOption('openai', 'OpenAI (GPT)')
        .addOption('openrouter', 'OpenRouter')
        .addOption('google', 'Google AI')
        .addOption('custom', 'Custom API')
        .setValue(settings.provider)
        .onChange(async (value) => {
          await this.settings.updateSettings({ 
            provider: value as ChatsidianSettings['provider'] 
          });
        }));
    
    new Setting(containerEl)
      .setName('API Key')
      .setDesc('Your API key for the selected provider')
      .addText(text => text
        .setPlaceholder('Enter your API key')
        .setValue(settings.apiKey)
        .onChange(async (value) => {
          await this.settings.setApiKey(value);
        }));
    
    // Only show custom endpoint for custom provider
    if (settings.provider === 'custom') {
      new Setting(containerEl)
        .setName('API Endpoint')
        .setDesc('Custom API endpoint URL')
        .addText(text => text
          .setPlaceholder('https://api.example.com/v1')
          .setValue(settings.apiEndpoint || '')
          .onChange(async (value) => {
            await this.settings.updateSettings({ apiEndpoint: value });
          }));
    }
    
    // Get models for current provider
    const providerModels = COMMON_MODELS.filter(m => m.provider === settings.provider);
    
    new Setting(containerEl)
      .setName('Model')
      .setDesc('Select which model to use')
      .addDropdown(dropdown => {
        // Add common models for current provider
        providerModels.forEach(model => {
          dropdown.addOption(model.id, model.name);
        });
        
        // Add custom option
        dropdown.addOption('custom', 'Custom Model ID');
        
        return dropdown
          .setValue(settings.model)
          .onChange(async (value) => {
            await this.settings.updateSettings({ model: value });
          });
      });
    
    // Show custom model input if custom model is selected
    if (!providerModels.some(m => m.id === settings.model)) {
      new Setting(containerEl)
        .setName('Custom Model ID')
        .setDesc('Enter a custom model identifier')
        .addText(text => text
          .setPlaceholder('model-id')
          .setValue(settings.model)
          .onChange(async (value) => {
            await this.settings.updateSettings({ model: value });
          }));
    }
    
    new Setting(containerEl)
      .setName('Test Connection')
      .setDesc('Test your API connection')
      .addButton(button => button
        .setButtonText('Test')
        .onClick(async () => {
          button.setButtonText('Testing...');
          button.setDisabled(true);
          
          try {
            const provider = this.plugin.providerFactory.getAdapter(
              settings.provider,
              settings.apiKey
            );
            
            const success = await provider.testConnection();
            
            if (success) {
              new this.plugin.app.Notice('Connection successful!');
            } else {
              new this.plugin.app.Notice('Connection failed. Check your API key and settings.');
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
      .addText(text => text
        .setPlaceholder('folder/path')
        .setValue(settings.conversationsFolder)
        .onChange(async (value) => {
          await this.settings.updateSettings({ conversationsFolder: value });
        }));
    
    new Setting(containerEl)
      .setName('Max Messages')
      .setDesc('Maximum number of messages to keep in memory')
      .addSlider(slider => slider
        .setLimits(10, 500, 10)
        .setValue(settings.maxMessages)
        .setDynamicTooltip()
        .onChange(async (value) => {
          await this.settings.updateSettings({ maxMessages: value });
        }));
    
    new Setting(containerEl)
      .setName('Default System Prompt')
      .setDesc('Default system prompt to use for new conversations')
      .addTextArea(textarea => textarea
        .setPlaceholder('Enter default system prompt')
        .setValue(settings.defaultSystemPrompt)
        .onChange(async (value) => {
          await this.settings.updateSettings({ defaultSystemPrompt: value });
        }))
      .addExtraButton(button => button
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
   * Create UI settings section.
   * @param containerEl Container element
   * @param settings Current settings
   */
  private createUiSettings(containerEl: HTMLElement, settings: ChatsidianSettings): void {
    containerEl.createEl('h2', { text: 'UI Settings' });
    
    new Setting(containerEl)
      .setName('Theme')
      .setDesc('Choose the theme for the chat interface')
      .addDropdown(dropdown => dropdown
        .addOption('light', 'Light')
        .addOption('dark', 'Dark')
        .addOption('system', 'Use System Theme')
        .setValue(settings.theme)
        .onChange(async (value) => {
          await this.settings.updateSettings({ 
            theme: value as ChatsidianSettings['theme'] 
          });
        }));
    
    new Setting(containerEl)
      .setName('Font Size')
      .setDesc('Font size for the chat interface')
      .addSlider(slider => slider
        .setLimits(10, 24, 1)
        .setValue(settings.fontSize)
        .setDynamicTooltip()
        .onChange(async (value) => {
          await this.settings.updateSettings({ fontSize: value });
        }));
    
    new Setting(containerEl)
      .setName('Show Timestamps')
      .setDesc('Show message timestamps in the chat interface')
      .addToggle(toggle => toggle
        .setValue(settings.showTimestamps)
        .onChange(async (value) => {
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
      .addToggle(toggle => toggle
        .setValue(settings.debugMode)
        .onChange(async (value) => {
          await this.settings.updateSettings({ debugMode: value });
        }));
    
    new Setting(containerEl)
      .setName('Auto-load BCPs')
      .setDesc('Bounded Context Packs to load automatically')
      .addTextArea(textarea => textarea
        .setPlaceholder('System,Vault,Editor')
        .setValue(settings.autoLoadBCPs.join(','))
        .onChange(async (value) => {
          const bcps = value.split(',').map(s => s.trim()).filter(s => s);
          await this.settings.updateSettings({ autoLoadBCPs: bcps });
        }));
    
    new Setting(containerEl)
      .setName('Default Temperature')
      .setDesc('Default temperature for AI requests (0.0 - 1.0)')
      .addSlider(slider => slider
        .setLimits(0, 1, 0.1)
        .setValue(settings.defaultTemperature)
        .setDynamicTooltip()
        .onChange(async (value) => {
          await this.settings.updateSettings({ defaultTemperature: value });
        }));
    
    new Setting(containerEl)
      .setName('Default Max Tokens')
      .setDesc('Default maximum tokens for AI responses')
      .addText(text => text
        .setPlaceholder('4000')
        .setValue(settings.defaultMaxTokens.toString())
        .onChange(async (value) => {
          const tokens = parseInt(value);
          if (!isNaN(tokens)) {
            await this.settings.updateSettings({ defaultMaxTokens: tokens });
          }
        }));
    
    new Setting(containerEl)
      .setName('Reset All Settings')
      .setDesc('Reset all settings to their default values')
      .addButton(button => button
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
```

### 3. Add Export/Import Functionality

Add to `src/core/SettingsManager.ts`:

```typescript
/**
 * Settings export/import utilities.
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
```

### 4. Add Settings Migration Support

Add to `src/core/SettingsManager.ts`:

```typescript
/**
 * Settings migration utilities.
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
```

### 5. Create Settings Service for Plugin Integration

Create `src/services/SettingsService.ts`:

```typescript
/**
 * Settings service for plugin integration.
 */

import { App } from 'obsidian';
import { ChatsidianSettings, DEFAULT_SETTINGS } from '../models/Settings';
import { 
  SettingsManager, 
  ChatsidianSettingTab,
  SettingsExportImport,
  SettingsMigration
} from '../core/SettingsManager';
import { EventBus } from '../core/EventBus';

/**
 * Service class for initializing and managing plugin settings.
 */
export class SettingsService {
  private app: App;
  private plugin: any;
  private eventBus: EventBus;
  private settingsManager: SettingsManager;
  private settingsExportImport: SettingsExportImport;
  
  /**
   * Create a new SettingsService.
   * @param app Obsidian app instance
   * @param plugin Plugin instance
   * @param eventBus Event bus
   */
  constructor(app: App, plugin: any, eventBus: EventBus) {
    this.app = app;
    this.plugin = plugin;
    this.eventBus = eventBus;
  }
  
  /**
   * Initialize the settings service.
   * @param savedData Previously saved settings data
   * @returns The settings manager
   */
  public async initialize(savedData: any): Promise<SettingsManager> {
    // Migrate settings if necessary
    const migratedSettings = SettingsMigration.migrateSettings(savedData);
    
    // Create settings manager
    this.settingsManager = new SettingsManager(
      migratedSettings || DEFAULT_SETTINGS,
      async (settings: ChatsidianSettings) => await this.saveSettings(settings),
      this.eventBus
    );
    
    // Create export/import utility
    this.settingsExportImport = new SettingsExportImport(this.settingsManager);
    
    // Add settings tab to Obsidian
    this.plugin.addSettingTab(new ChatsidianSettingTab(this.app, this.plugin));
    
    // Emit settings loaded event
    this.eventBus.emit('settings:loaded', this.settingsManager.getSettings());
    
    return this.settingsManager;
  }
  
  /**
   * Save settings to disk.
   * @param settings Settings to save
   * @returns Promise that resolves when settings are saved
   */
  private async saveSettings(settings: ChatsidianSettings): Promise<void> {
    await this.plugin.saveData(settings);
  }
  
  /**
   * Get the settings manager.
   * @returns The settings manager
   */
  public getSettingsManager(): SettingsManager {
    return this.settingsManager;
  }
  
  /**
   * Export settings to JSON.
   * @param includeApiKey Whether to include the API key
   * @returns Settings as a JSON string
   */
  public exportSettings(includeApiKey: boolean = false): string {
    return this.settingsExportImport.exportToJson(includeApiKey);
  }
  
  /**
   * Import settings from JSON.
   * @param json Settings JSON
   * @returns Promise that resolves when settings are imported
   */
  public async importSettings(json: string): Promise<void> {
    await this.settingsExportImport.importFromJson(json);
  }
}
```

### 6. Write Tests for Settings Manager

Create `tests/core/SettingsManager.test.ts`:

```typescript
import { SettingsManager } from '../../src/core/SettingsManager';
import { ChatsidianSettings, DEFAULT_SETTINGS } from '../../src/models/Settings';
import { EventBus } from '../../src/core/EventBus';

describe('SettingsManager', () => {
  let eventBus: EventBus;
  let saveSettings: jest.Mock;
  let settingsManager: SettingsManager;
  
  beforeEach(() => {
    eventBus = new EventBus();
    saveSettings = jest.fn().mockResolvedValue(undefined);
    settingsManager = new SettingsManager(
      { ...DEFAULT_SETTINGS },
      saveSettings,
      eventBus
    );
  });
  
  test('should initialize with default settings', () => {
    const settings = settingsManager.getSettings();
    
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });
  
  test('should initialize with custom settings', () => {
    const customSettings = {
      ...DEFAULT_SETTINGS,
      apiKey: 'test-key',
      model: 'test-model'
    };
    
    const manager = new SettingsManager(
      customSettings,
      saveSettings,
      eventBus
    );
    
    const settings = manager.getSettings();
    
    expect(settings.apiKey).toBe('test-key');
    expect(settings.model).toBe('test-model');
  });
  
  test('should update settings', async () => {
    const settingsHandler = jest.fn();
    eventBus.on('settings:updated', settingsHandler);
    
    await settingsManager.updateSettings({
      apiKey: 'new-key',
      model: 'new-model'
    });
    
    // Check settings were updated
    const settings = settingsManager.getSettings();
    expect(settings.apiKey).toBe('new-key');
    expect(settings.model).toBe('new-model');
    
    // Check save was called
    expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'new-key',
      model: 'new-model'
    }));
    
    // Check event was emitted
    expect(settingsHandler).toHaveBeenCalledWith(expect.objectContaining({
      previousSettings: expect.any(Object),
      currentSettings: expect.any(Object),
      changedKeys: expect.arrayContaining(['apiKey', 'model'])
    }));
  });
  
  test('should set API key', async () => {
    await settingsManager.setApiKey('new-key');
    
    const settings = settingsManager.getSettings();
    expect(settings.apiKey).toBe('new-key');
    expect(saveSettings).toHaveBeenCalled();
  });
  
  test('should get provider', () => {
    expect(settingsManager.getProvider()).toBe(DEFAULT_SETTINGS.provider);
  });
  
  test('should get API key', () => {
    expect(settingsManager.getApiKey()).toBe(DEFAULT_SETTINGS.apiKey);
  });
  
  test('should get model', () => {
    expect(settingsManager.getModel()).toBe(DEFAULT_SETTINGS.model);
  });
  
  test('should get conversations path', () => {
    expect(settingsManager.getConversationsPath()).toBe(DEFAULT_SETTINGS.conversationsFolder);
  });
  
  test('should reset to defaults', async () => {
    // First update some settings
    await settingsManager.updateSettings({
      apiKey: 'test-key',
      model: 'test-model'
    });
    
    // Then reset to defaults
    await settingsManager.resetToDefaults();
    
    const settings = settingsManager.getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });
});
```

Create `tests/core/SettingsExportImport.test.ts`:

```typescript
import { SettingsManager, SettingsExportImport } from '../../src/core/SettingsManager';
import { DEFAULT_SETTINGS } from '../../src/models/Settings';
import { EventBus } from '../../src/core/EventBus';

describe('SettingsExportImport', () => {
  let eventBus: EventBus;
  let saveSettings: jest.Mock;
  let settingsManager: SettingsManager;
  let exportImport: SettingsExportImport;
  
  beforeEach(() => {
    eventBus = new EventBus();
    saveSettings = jest.fn().mockResolvedValue(undefined);
    settingsManager = new SettingsManager(
      { ...DEFAULT_SETTINGS, apiKey: 'test-key' },
      saveSettings,
      eventBus
    );
    exportImport = new SettingsExportImport(settingsManager);
  });
  
  test('should export settings to JSON without API key', () => {
    const json = exportImport.exportToJson(false);
    const exported = JSON.parse(json);
    
    expect(exported).toEqual(expect.objectContaining({
      ...DEFAULT_SETTINGS,
      apiKey: '' // API key should be removed
    }));
  });
  
  test('should export settings to JSON with API key', () => {
    const json = exportImport.exportToJson(true);
    const exported = JSON.parse(json);
    
    expect(exported).toEqual(expect.objectContaining({
      ...DEFAULT_SETTINGS,
      apiKey: 'test-key' // API key should be included
    }));
  });
  
  test('should import settings from JSON', async () => {
    const importJson = JSON.stringify({
      provider: 'openai',
      model: 'gpt-4',
      debugMode: true
    });
    
    await exportImport.importFromJson(importJson);
    
    const settings = settingsManager.getSettings();
    expect(settings.provider).toBe('openai');
    expect(settings.model).toBe('gpt-4');
    expect(settings.debugMode).toBe(true);
  });
  
  test('should throw error on invalid JSON', async () => {
    await expect(exportImport.importFromJson('invalid json')).rejects.toThrow();
  });
  
  test('should throw error on invalid settings format', async () => {
    await expect(exportImport.importFromJson('"not an object"')).rejects.toThrow();
  });
});
```

## Integration Example

```typescript
// In plugin main.ts
import { Plugin } from 'obsidian';
import { EventBus } from './core/EventBus';
import { SettingsService } from './services/SettingsService';

export default class ChatsidianPlugin extends Plugin {
  public settings: SettingsManager;
  public eventBus: EventBus;
  private settingsService: SettingsService;
  
  async onload() {
    console.log('Loading Chatsidian plugin');
    
    // Initialize event bus
    this.eventBus = new EventBus();
    
    // Initialize settings
    this.settingsService = new SettingsService(this.app, this, this.eventBus);
    this.settings = await this.settingsService.initialize(await this.loadData());
    
    // Settings event example
    this.eventBus.on('settings:updated', (data) => {
      console.log('Settings updated:', data.changedKeys);
      
      // Handle specific setting changes
      if (data.changedKeys.includes('debugMode')) {
        const debugMode = data.currentSettings.debugMode;
        console.log(`Debug mode ${debugMode ? 'enabled' : 'disabled'}`);
      }
    });
    
    console.log('Chatsidian settings loaded');
  }
}
```

## References

- [[💻 Coding/Documentation/Obsidian/Plugin - Documentation.md]] - Obsidian Plugin API documentation
- [[💻 Coding/Documentation/Obsidian/PluginSettingTab - Documentation.md]] - Obsidian PluginSettingTab documentation

## Next Steps

After completing this microphase, proceed to:
- [[💻 Coding/Projects/Chatsidian/3_Implementation/Phase1.5-Storage-Abstractions.md]] - Implementing storage abstractions for Obsidian vault interaction
