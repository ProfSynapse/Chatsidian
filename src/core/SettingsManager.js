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
import { PluginSettingTab, Setting } from '../utils/obsidian-imports';
import { DEFAULT_SETTINGS, SettingsUtils } from '../models/Settings';
import { COMMON_MODELS } from '../models/Provider';
/**
 * SettingsManager class for managing plugin settings.
 * Handles loading, saving, and updating settings, and emits events when settings change.
 */
export class SettingsManager {
    /**
     * Create a new SettingsManager.
     * @param initialSettings Initial settings values
     * @param saveSettings Function to save settings to disk
     * @param eventBus Event bus for emitting settings events
     */
    constructor(initialSettings, saveSettings, eventBus) {
        this.settings = SettingsUtils.validate(initialSettings);
        this.saveSettings = saveSettings;
        this.eventBus = eventBus;
    }
    /**
     * Get a copy of the current settings.
     * @returns A copy of the settings object
     */
    getSettings() {
        return { ...this.settings };
    }
    /**
     * Update settings with new values.
     * @param updates Partial settings object with values to update
     * @returns Promise that resolves when settings are saved
     */
    async updateSettings(updates) {
        const previousSettings = { ...this.settings };
        // Validate and merge updates
        const validated = SettingsUtils.validate({
            ...this.settings,
            ...updates
        });
        this.settings = validated;
        // Determine which keys were changed
        const changedKeys = Object.keys(updates).filter(key => {
            const k = key;
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
    async setApiKey(apiKey) {
        await this.updateSettings({ apiKey });
    }
    /**
     * Get the current provider.
     * @returns The current provider
     */
    getProvider() {
        return this.settings.provider;
    }
    /**
     * Get the API key for the current provider.
     * @returns The API key
     */
    getApiKey() {
        return this.settings.apiKey;
    }
    /**
     * Get the current model.
     * @returns The current model
     */
    getModel() {
        return this.settings.model;
    }
    /**
     * Get the conversations folder path.
     * @returns The conversations folder path
     */
    getConversationsPath() {
        return this.settings.conversationsFolder;
    }
    /**
     * Get the default system prompt.
     * @returns The default system prompt
     */
    getDefaultSystemPrompt() {
        return this.settings.defaultSystemPrompt;
    }
    /**
     * Check if debug mode is enabled.
     * @returns True if debug mode is enabled
     */
    isDebugModeEnabled() {
        return this.settings.debugMode;
    }
    /**
     * Reset settings to defaults.
     * @returns Promise that resolves when settings are reset
     */
    async resetToDefaults() {
        await this.updateSettings(DEFAULT_SETTINGS);
    }
}
/**
 * Obsidian settings tab for the Chatsidian plugin.
 * Provides a user interface for adjusting plugin settings.
 */
export class ChatsidianSettingTab extends PluginSettingTab {
    /**
     * Create a new ChatsidianSettingTab.
     * @param app Obsidian app instance
     * @param plugin Plugin instance
     */
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
        // Use settingsService to get the settings manager
        this.settings = plugin.settingsService?.getSettingsManager();
    }
    /**
     * Display the settings UI.
     */
    display() {
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
        this.createConversationSettings(containerEl, settings);
        this.createUiSettings(containerEl, settings);
        this.createAdvancedSettings(containerEl, settings);
    }
    /**
     * Create API settings section.
     * @param containerEl Container element
     * @param settings Current settings
     */
    createApiSettings(containerEl, settings) {
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
                provider: value
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
            var _a;
            button.setButtonText('Testing...');
            button.setDisabled(true);
            try {
                const provider = (_a = this.plugin.providerFactory) === null || _a === void 0 ? void 0 : _a.getAdapter(settings.provider, settings.apiKey);
                if (provider) {
                    const success = await provider.testConnection();
                    if (success) {
                        new this.plugin.app.Notice('Connection successful!');
                    }
                    else {
                        new this.plugin.app.Notice('Connection failed. Check your API key and settings.');
                    }
                }
                else {
                    new this.plugin.app.Notice('Provider adapter not available yet.');
                }
            }
            catch (error) {
                new this.plugin.app.Notice(`Error: ${error.message}`);
            }
            finally {
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
    createConversationSettings(containerEl, settings) {
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
    createUiSettings(containerEl, settings) {
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
                theme: value
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
    createAdvancedSettings(containerEl, settings) {
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
            const confirm = await this.plugin.app.modal.confirm('Reset all settings?', 'This will reset all settings to their default values. This action cannot be undone.');
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
    /**
     * Create a new SettingsExportImport.
     * @param settings Settings manager
     */
    constructor(settings) {
        this.settings = settings;
    }
    /**
     * Export settings to JSON.
     * @param includeApiKey Whether to include the API key
     * @returns Settings as a JSON string
     */
    exportToJson(includeApiKey = false) {
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
    async importFromJson(json) {
        try {
            const importedSettings = JSON.parse(json);
            // Validate imported settings
            if (typeof importedSettings !== 'object') {
                throw new Error('Invalid settings format');
            }
            // Update settings
            await this.settings.updateSettings(importedSettings);
            return;
        }
        catch (error) {
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
    static migrateSettings(oldSettings) {
        // Start with empty settings
        const newSettings = {};
        // Map known fields from old to new format
        if (oldSettings) {
            // Direct mappings
            if (oldSettings.provider)
                newSettings.provider = oldSettings.provider;
            if (oldSettings.apiKey)
                newSettings.apiKey = oldSettings.apiKey;
            if (oldSettings.model)
                newSettings.model = oldSettings.model;
            if (oldSettings.conversationsFolder)
                newSettings.conversationsFolder = oldSettings.conversationsFolder;
            if (oldSettings.maxMessages)
                newSettings.maxMessages = oldSettings.maxMessages;
            if (oldSettings.defaultSystemPrompt)
                newSettings.defaultSystemPrompt = oldSettings.defaultSystemPrompt;
            if (oldSettings.theme)
                newSettings.theme = oldSettings.theme;
            if (oldSettings.fontSize)
                newSettings.fontSize = oldSettings.fontSize;
            if (oldSettings.showTimestamps)
                newSettings.showTimestamps = oldSettings.showTimestamps;
            if (oldSettings.debugMode)
                newSettings.debugMode = oldSettings.debugMode;
            if (oldSettings.defaultTemperature)
                newSettings.defaultTemperature = oldSettings.defaultTemperature;
            if (oldSettings.defaultMaxTokens)
                newSettings.defaultMaxTokens = oldSettings.defaultMaxTokens;
            // Field mappings with changes
            if (Array.isArray(oldSettings.bcps)) {
                newSettings.autoLoadBCPs = oldSettings.bcps;
            }
            else if (typeof oldSettings.bcps === 'string') {
                newSettings.autoLoadBCPs = oldSettings.bcps.split(',').map((s) => s.trim()).filter((s) => s);
            }
            // Handle any other specific migrations here
        }
        return newSettings;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU2V0dGluZ3NNYW5hZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiU2V0dGluZ3NNYW5hZ2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7OztHQVFHO0FBRUgsNkRBQTZEO0FBQzdELE9BQU8sRUFBTyxnQkFBZ0IsRUFBRSxPQUFPLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUMzRSxPQUFPLEVBQXNCLGdCQUFnQixFQUFFLGFBQWEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBRXpGLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUVuRDs7O0dBR0c7QUFDSCxNQUFNLE9BQU8sZUFBZTtJQUsxQjs7Ozs7T0FLRztJQUNILFlBQ0UsZUFBNEMsRUFDNUMsWUFBNkQsRUFDN0QsUUFBa0I7UUFFbEIsSUFBSSxDQUFDLFFBQVEsR0FBRyxhQUFhLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ3hELElBQUksQ0FBQyxZQUFZLEdBQUcsWUFBWSxDQUFDO1FBQ2pDLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO0lBQzNCLENBQUM7SUFFRDs7O09BR0c7SUFDSSxXQUFXO1FBQ2hCLE9BQU8sRUFBRSxHQUFHLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUM5QixDQUFDO0lBRUQ7Ozs7T0FJRztJQUNJLEtBQUssQ0FBQyxjQUFjLENBQUMsT0FBb0M7UUFDOUQsTUFBTSxnQkFBZ0IsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBRTlDLDZCQUE2QjtRQUM3QixNQUFNLFNBQVMsR0FBRyxhQUFhLENBQUMsUUFBUSxDQUFDO1lBQ3ZDLEdBQUcsSUFBSSxDQUFDLFFBQVE7WUFDaEIsR0FBRyxPQUFPO1NBQ1gsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLFFBQVEsR0FBRyxTQUFTLENBQUM7UUFFMUIsb0NBQW9DO1FBQ3BDLE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxJ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IG1hbmFnZXIgZm9yIHRoZSBDaGF0c2lkaWFuIHBsdWdpbi5cclxuICogXHJcbiAqIFRoaXMgZmlsZSBwcm92aWRlcyBjbGFzc2VzIGZvciBtYW5hZ2luZyBwbHVnaW4gc2V0dGluZ3MsIGluY2x1ZGluZzpcclxuICogLSBTZXR0aW5nc01hbmFnZXI6IENvcmUgY2xhc3MgZm9yIG1hbmFnaW5nIHNldHRpbmdzIHN0YXRlIGFuZCB1cGRhdGVzXHJcbiAqIC0gQ2hhdHNpZGlhblNldHRpbmdUYWI6IE9ic2lkaWFuIHNldHRpbmdzIHRhYiBVSVxyXG4gKiAtIFNldHRpbmdzRXhwb3J0SW1wb3J0OiBVdGlsaXRpZXMgZm9yIGV4cG9ydGluZyBhbmQgaW1wb3J0aW5nIHNldHRpbmdzXHJcbiAqIC0gU2V0dGluZ3NNaWdyYXRpb246IFV0aWxpdGllcyBmb3IgbWlncmF0aW5nIHNldHRpbmdzIGZyb20gcHJldmlvdXMgdmVyc2lvbnNcclxuICovXHJcblxyXG4vLyBJbXBvcnQgZnJvbSBvYnNpZGlhbiBpbiBwcm9kdWN0aW9uLCBidXQgdXNlIG1vY2tzIGluIHRlc3RzXHJcbmltcG9ydCB7IEFwcCwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZyB9IGZyb20gJy4uL3V0aWxzL29ic2lkaWFuLWltcG9ydHMnO1xyXG5pbXBvcnQgeyBDaGF0c2lkaWFuU2V0dGluZ3MsIERFRkFVTFRfU0VUVElOR1MsIFNldHRpbmdzVXRpbHMgfSBmcm9tICcuLi9tb2RlbHMvU2V0dGluZ3MnO1xyXG5pbXBvcnQgeyBFdmVudEJ1cyB9IGZyb20gJy4vRXZlbnRCdXMnO1xyXG5pbXBvcnQgeyBDT01NT05fTU9ERUxTIH0gZnJvbSAnLi4vbW9kZWxzL1Byb3ZpZGVyJztcclxuXHJcbi8qKlxyXG4gKiBTZXR0aW5nc01hbmFnZXIgY2xhc3MgZm9yIG1hbmFnaW5nIHBsdWdpbiBzZXR0aW5ncy5cclxuICogSGFuZGxlcyBsb2FkaW5nLCBzYXZpbmcsIGFuZCB1cGRhdGluZyBzZXR0aW5ncywgYW5kIGVtaXRzIGV2ZW50cyB3aGVuIHNldHRpbmdzIGNoYW5nZS5cclxuICovXHJcbmV4cG9ydCBjbGFzcyBTZXR0aW5nc01hbmFnZXIge1xyXG4gIHByaXZhdGUgc2V0dGluZ3M6IENoYXRzaWRpYW5TZXR0aW5ncztcclxuICBwcml2YXRlIHNhdmVTZXR0aW5nczogKHNldHRpbmdzOiBDaGF0c2lkaWFuU2V0dGluZ3MpID0+IFByb21pc2U8dm9pZD47XHJcbiAgcHJpdmF0ZSBldmVudEJ1czogRXZlbnRCdXM7XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgbmV3IFNldHRpbmdzTWFuYWdlci5cclxuICAgKiBAcGFyYW0gaW5pdGlhbFNldHRpbmdzIEluaXRpYWwgc2V0dGluZ3MgdmFsdWVzXHJcbiAgICogQHBhcmFtIHNhdmVTZXR0aW5ncyBGdW5jdGlvbiB0byBzYXZlIHNldHRpbmdzIHRvIGRpc2tcclxuICAgKiBAcGFyYW0gZXZlbnRCdXMgRXZlbnQgYnVzIGZvciBlbWl0dGluZyBzZXR0aW5ncyBldmVudHNcclxuICAgKi9cclxuICBjb25zdHJ1Y3RvcihcclxuICAgIGluaXRpYWxTZXR0aW5nczogUGFydGlhbDxDaGF0c2lkaWFuU2V0dGluZ3M+LFxyXG4gICAgc2F2ZVNldHRpbmdzOiAoc2V0dGluZ3M6IENoYXRzaWRpYW5TZXR0aW5ncykgPT4gUHJvbWlzZTx2b2lkPixcclxuICAgIGV2ZW50QnVzOiBFdmVudEJ1c1xyXG4gICkge1xyXG4gICAgdGhpcy5zZXR0aW5ncyA9IFNldHRpbmdzVXRpbHMudmFsaWRhdGUoaW5pdGlhbFNldHRpbmdzKTtcclxuICAgIHRoaXMuc2F2ZVNldHRpbmdzID0gc2F2ZVNldHRpbmdzO1xyXG4gICAgdGhpcy5ldmVudEJ1cyA9IGV2ZW50QnVzO1xyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBHZXQgYSBjb3B5IG9mIHRoZSBjdXJyZW50IHNldHRpbmdzLlxyXG4gICAqIEByZXR1cm5zIEEgY29weSBvZiB0aGUgc2V0dGluZ3Mgb2JqZWN0XHJcbiAgICovXHJcbiAgcHVibGljIGdldFNldHRpbmdzKCk6IENoYXRzaWRpYW5TZXR0aW5ncyB7XHJcbiAgICByZXR1cm4geyAuLi50aGlzLnNldHRpbmdzIH07XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIFVwZGF0ZSBzZXR0aW5ncyB3aXRoIG5ldyB2YWx1ZXMuXHJcbiAgICogQHBhcmFtIHVwZGF0ZXMgUGFydGlhbCBzZXR0aW5ncyBvYmplY3Qgd2l0aCB2YWx1ZXMgdG8gdXBkYXRlXHJcbiAgICogQHJldHVybnMgUHJvbWlzZSB0aGF0IHJlc29sdmVzIHdoZW4gc2V0dGluZ3MgYXJlIHNhdmVkXHJcbiAgICovXHJcbiAgcHVibGljIGFzeW5jIHVwZGF0ZVNldHRpbmdzKHVwZGF0ZXM6IFBhcnRpYWw8Q2hhdHNpZGlhblNldHRpbmdzPik6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgcHJldmlvdXNTZXR0aW5ncyA9IHsgLi4udGhpcy5zZXR0aW5ncyB9O1xyXG4gICAgXHJcbiAgICAvLyBWYWxpZGF0ZSBhbmQgbWVyZ2UgdXBkYXRlc1xyXG4gICAgY29uc3QgdmFsaWRhdGVkID0gU2V0dGluZ3NVdGlscy52YWxpZGF0ZSh7XHJcbiAgICAgIC4uLnRoaXMuc2V0dGluZ3MsXHJcbiAgICAgIC4uLnVwZGF0ZXNcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICB0aGlzLnNldHRpbmdzID0gdmFsaWRhdGVkO1xyXG4gICAgXHJcbiAgICAvLyBEZXRlcm1pbmUgd2hpY2gga2V5cyB3ZXJlIGNoYW5nZWRcclxuICAgIGNvbnN0IGNoYW5nZWRLZXlzID0gT2JqZWN0LmtleXModXBkYXRlcykuZmlsdGVyKGtleSA9PiB7XHJcbiAgICAgIGNvbnN0IGsgPSBrZXkgYXMga2V5b2YgQ2hhdHNpZGlhblNldHRpbmdzO1xyXG4gICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocHJldmlvdXNTZXR0aW5nc1trXSkgIT09IEpTT04uc3RyaW5naWZ5KHRoaXMuc2V0dGluZ3Nba10pO1xyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIC8vIFNhdmUgc2V0dGluZ3MgdG8gZGlza1xyXG4gICAgYXdhaXQgdGhpcy5zYXZlU2V0dGluZ3ModGhpcy5zZXR0aW5ncyk7XHJcbiAgICBcclxuICAgIC8vIE5vdGlmeSBsaXN0ZW5lcnMgb2YgY2hhbmdlc1xyXG4gICAgdGhpcy5ldmVudEJ1cy5lbWl0KCdzZXR0aW5nczp1cGRhdGVkJywge1xyXG4gICAgICBwcmV2aW91c1NldHRpbmdzLFxyXG4gICAgICBjdXJyZW50U2V0dGluZ3M6IHsgLi4udGhpcy5zZXR0aW5ncyB9LFxyXG4gICAgICBjaGFuZ2VkS2V5c1xyXG4gICAgfSk7XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIFNldCB0aGUgQVBJIGtleSBmb3IgdGhlIGN1cnJlbnQgcHJvdmlkZXIuXHJcbiAgICogQHBhcmFtIGFwaUtleSBBUEkga2V5IHRvIHNldFxyXG4gICAqIEByZXR1cm5zIFByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIHNldHRpbmdzIGFyZSBzYXZlZFxyXG4gICAqL1xyXG4gIHB1YmxpYyBhc3luYyBzZXRBcGlLZXkoYXBpS2V5OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMudXBkYXRlU2V0dGluZ3MoeyBhcGlLZXkgfSk7XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgY3VycmVudCBwcm92aWRlci5cclxuICAgKiBAcmV0dXJucyBUaGUgY3VycmVudCBwcm92aWRlclxyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXRQcm92aWRlcigpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIHRoaXMuc2V0dGluZ3MucHJvdmlkZXI7XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgQVBJIGtleSBmb3IgdGhlIGN1cnJlbnQgcHJvdmlkZXIuXHJcbiAgICogQHJldHVybnMgVGhlIEFQSSBrZXlcclxuICAgKi9cclxuICBwdWJsaWMgZ2V0QXBpS2V5KCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gdGhpcy5zZXR0aW5ncy5hcGlLZXk7XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgY3VycmVudCBtb2RlbC5cclxuICAgKiBAcmV0dXJucyBUaGUgY3VycmVudCBtb2RlbFxyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXRNb2RlbCgpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIHRoaXMuc2V0dGluZ3MubW9kZWw7XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgY29udmVyc2F0aW9ucyBmb2xkZXIgcGF0aC5cclxuICAgKiBAcmV0dXJucyBUaGUgY29udmVyc2F0aW9ucyBmb2xkZXIgcGF0aFxyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXRDb252ZXJzYXRpb25zUGF0aCgpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIHRoaXMuc2V0dGluZ3MuY29udmVyc2F0aW9uc0ZvbGRlcjtcclxuICB9XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBkZWZhdWx0IHN5c3RlbSBwcm9tcHQuXHJcbiAgICogQHJldHVybnMgVGhlIGRlZmF1bHQgc3lzdGVtIHByb21wdFxyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXREZWZhdWx0U3lzdGVtUHJvbXB0KCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gdGhpcy5zZXR0aW5ncy5kZWZhdWx0U3lzdGVtUHJvbXB0O1xyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBDaGVjayBpZiBkZWJ1ZyBtb2RlIGlzIGVuYWJsZWQuXHJcbiAgICogQHJldHVybnMgVHJ1ZSBpZiBkZWJ1ZyBtb2RlIGlzIGVuYWJsZWRcclxuICAgKi9cclxuICBwdWJsaWMgaXNEZWJ1Z01vZGVFbmFibGVkKCk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIHRoaXMuc2V0dGluZ3MuZGVidWdNb2RlO1xyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBSZXNldCBzZXR0aW5ncyB0byBkZWZhdWx0cy5cclxuICAgKiBAcmV0dXJucyBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiBzZXR0aW5ncyBhcmUgcmVzZXRcclxuICAgKi9cclxuICBwdWJsaWMgYXN5bmMgcmVzZXRUb0RlZmF1bHRzKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy51cGRhdGVTZXR0aW5ncyhERUZBVUxUX1NFVFRJTkdTKTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBPYnNpZGlhbiBzZXR0aW5ncyB0YWIgZm9yIHRoZSBDaGF0c2lkaWFuIHBsdWdpbi5cclxuICogUHJvdmlkZXMgYSB1c2VyIGludGVyZmFjZSBmb3IgYWRqdXN0aW5nIHBsdWdpbiBzZXR0aW5ncy5cclxuICovXHJcbmV4cG9ydCBjbGFzcyBDaGF0c2lkaWFuU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xyXG4gIHByaXZhdGUgcGx1Z2luOiBhbnk7XHJcbiAgcHJpdmF0ZSBzZXR0aW5nczogU2V0dGluZ3NNYW5hZ2VyO1xyXG4gIFxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIG5ldyBDaGF0c2lkaWFuU2V0dGluZ1RhYi5cclxuICAgKiBAcGFyYW0gYXBwIE9ic2lkaWFuIGFwcCBpbnN0YW5jZVxyXG4gICAqIEBwYXJhbSBwbHVnaW4gUGx1Z2luIGluc3RhbmNlXHJcbiAgICovXHJcbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogYW55KSB7XHJcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XHJcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcclxuICAgIHRoaXMuc2V0dGluZ3MgPSBwbHVnaW4uc2V0dGluZ3M7XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIERpc3BsYXkgdGhlIHNldHRpbmdzIFVJLlxyXG4gICAqL1xyXG4gIGRpc3BsYXkoKTogdm9pZCB7XHJcbiAgICBjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xyXG4gICAgY29uc3Qgc2V0dGluZ3MgPSB0aGlzLnNldHRpbmdzLmdldFNldHRpbmdzKCk7XHJcbiAgICBcclxuICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XHJcbiAgICBcclxuICAgIHRoaXMuY3JlYXRlQXBpU2V0dGluZ3MoY29udGFpbmVyRWwsIHNldHRpbmdzKTtcclxuICAgIHRoaXMuY3JlYXRlQ29udmVyc2F0aW9uU2V0dGluZ3MoY29udGFpbmVyRWwsIHNldHRpbmdzKTtcclxuICAgIHRoaXMuY3JlYXRlVWlTZXR0aW5ncyhjb250YWluZXJFbCwgc2V0dGluZ3MpO1xyXG4gICAgdGhpcy5jcmVhdGVBZHZhbmNlZFNldHRpbmdzKGNvbnRhaW5lckVsLCBzZXR0aW5ncyk7XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBBUEkgc2V0dGluZ3Mgc2VjdGlvbi5cclxuICAgKiBAcGFyYW0gY29udGFpbmVyRWwgQ29udGFpbmVyIGVsZW1lbnRcclxuICAgKiBAcGFyYW0gc2V0dGluZ3MgQ3VycmVudCBzZXR0aW5nc1xyXG4gICAqL1xyXG4gIHByaXZhdGUgY3JlYXRlQXBpU2V0dGluZ3MoY29udGFpbmVyRWw6IEhUTUxFbGVtZW50LCBzZXR0aW5nczogQ2hhdHNpZGlhblNldHRpbmdzKTogdm9pZCB7XHJcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdBUEkgU2V0dGluZ3MnIH0pO1xyXG4gICAgXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoJ0FJIFByb3ZpZGVyJylcclxuICAgICAgLnNldERlc2MoJ1NlbGVjdCB3aGljaCBBSSBzZXJ2aWNlIHRvIHVzZScpXHJcbiAgICAgIC5hZGREcm9wZG93bihkcm9wZG93biA9PiBkcm9wZG93blxyXG4gICAgICAgIC5hZGRPcHRpb24oJ2FudGhyb3BpYycsICdBbnRocm9waWMgKENsYXVkZSknKVxyXG4gICAgICAgIC5hZGRPcHRpb24oJ29wZW5haScsICdPcGVuQUkgKEdQVCknKVxyXG4gICAgICAgIC5hZGRPcHRpb24oJ29wZW5yb3V0ZXInLCAnT3BlblJvdXRlcicpXHJcbiAgICAgICAgLmFkZE9wdGlvbignZ29vZ2xlJywgJ0dvb2dsZSBBSScpXHJcbiAgICAgICAgLmFkZE9wdGlvbignY3VzdG9tJywgJ0N1c3RvbSBBUEknKVxyXG4gICAgICAgIC5zZXRWYWx1ZShzZXR0aW5ncy5wcm92aWRlcilcclxuICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLnNldHRpbmdzLnVwZGF0ZVNldHRpbmdzKHsgXHJcbiAgICAgICAgICAgIHByb3ZpZGVyOiB2YWx1ZSBhcyBDaGF0c2lkaWFuU2V0dGluZ3NbJ3Byb3ZpZGVyJ10gXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9KSk7XHJcbiAgICBcclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZSgnQVBJIEtleScpXHJcbiAgICAgIC5zZXREZXNjKCdZb3VyIEFQSSBrZXkgZm9yIHRoZSBzZWxlY3RlZCBwcm92aWRlcicpXHJcbiAgICAgIC5hZGRUZXh0KHRleHQgPT4gdGV4dFxyXG4gICAgICAgIC5zZXRQbGFjZWhvbGRlcignRW50ZXIgeW91ciBBUEkga2V5JylcclxuICAgICAgICAuc2V0VmFsdWUoc2V0dGluZ3MuYXBpS2V5KVxyXG4gICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgIGF3YWl0IHRoaXMuc2V0dGluZ3Muc2V0QXBpS2V5KHZhbHVlKTtcclxuICAgICAgICB9KSk7XHJcbiAgICBcclxuICAgIC8vIE9ubHkgc2hvdyBjdXN0b20gZW5kcG9pbnQgZm9yIGN1c3RvbSBwcm92aWRlclxyXG4gICAgaWYgKHNldHRpbmdzLnByb3ZpZGVyID09PSAnY3VzdG9tJykge1xyXG4gICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgICAuc2V0TmFtZSgnQVBJIEVuZHBvaW50JylcclxuICAgICAgICAuc2V0RGVzYygnQ3VzdG9tIEFQSSBlbmRwb2ludCBVUkwnKVxyXG4gICAgICAgIC5hZGRUZXh0KHRleHQgPT4gdGV4dFxyXG4gICAgICAgICAgLnNldFBsYWNlaG9sZGVyKCdodHRwczovL2FwaS5leGFtcGxlLmNvbS92MScpXHJcbiAgICAgICAgICAuc2V0VmFsdWUoc2V0dGluZ3MuYXBpRW5kcG9pbnQgfHwgJycpXHJcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc2V0dGluZ3MudXBkYXRlU2V0dGluZ3MoeyBhcGlFbmRwb2ludDogdmFsdWUgfSk7XHJcbiAgICAgICAgICB9KSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIEdldCBtb2RlbHMgZm9yIGN1cnJlbnQgcHJvdmlkZXJcclxuICAgIGNvbnN0IHByb3ZpZGVyTW9kZWxzID0gQ09NTU9OX01PREVMUy5maWx0ZXIobSA9PiBtLnByb3ZpZGVyID09PSBzZXR0aW5ncy5wcm92aWRlcik7XHJcbiAgICBcclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZSgnTW9kZWwnKVxyXG4gICAgICAuc2V0RGVzYygnU2VsZWN0IHdoaWNoIG1vZGVsIHRvIHVzZScpXHJcbiAgICAgIC5hZGREcm9wZG93bihkcm9wZG93biA9PiB7XHJcbiAgICAgICAgLy8gQWRkIGNvbW1vbiBtb2RlbHMgZm9yIGN1cnJlbnQgcHJvdmlkZXJcclxuICAgICAgICBwcm92aWRlck1vZGVscy5mb3JFYWNoKG1vZGVsID0+IHtcclxuICAgICAgICAgIGRyb3Bkb3duLmFkZE9wdGlvbihtb2RlbC5pZCwgbW9kZWwubmFtZSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gQWRkIGN1c3RvbSBvcHRpb25cclxuICAgICAgICBkcm9wZG93bi5hZGRPcHRpb24oJ2N1c3RvbScsICdDdXN0b20gTW9kZWwgSUQnKTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gZHJvcGRvd25cclxuICAgICAgICAgIC5zZXRWYWx1ZShzZXR0aW5ncy5tb2RlbClcclxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5zZXR0aW5ncy51cGRhdGVTZXR0aW5ncyh7IG1vZGVsOiB2YWx1ZSB9KTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICB9KTtcclxuICAgIFxyXG4gICAgLy8gU2hvdyBjdXN0b20gbW9kZWwgaW5wdXQgaWYgY3VzdG9tIG1vZGVsIGlzIHNlbGVjdGVkXHJcbiAgICBpZiAoIXByb3ZpZGVyTW9kZWxzLnNvbWUobSA9PiBtLmlkID09PSBzZXR0aW5ncy5tb2RlbCkpIHtcclxuICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgICAgLnNldE5hbWUoJ0N1c3RvbSBNb2RlbCBJRCcpXHJcbiAgICAgICAgLnNldERlc2MoJ0VudGVyIGEgY3VzdG9tIG1vZGVsIGlkZW50aWZpZXInKVxyXG4gICAgICAgIC5hZGRUZXh0KHRleHQgPT4gdGV4dFxyXG4gICAgICAgICAgLnNldFBsYWNlaG9sZGVyKCdtb2RlbC1pZCcpXHJcbiAgICAgICAgICAuc2V0VmFsdWUoc2V0dGluZ3MubW9kZWwpXHJcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc2V0dGluZ3MudXBkYXRlU2V0dGluZ3MoeyBtb2RlbDogdmFsdWUgfSk7XHJcbiAgICAgICAgICB9KSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZSgnVGVzdCBDb25uZWN0aW9uJylcclxuICAgICAgLnNldERlc2MoJ1Rlc3QgeW91ciBBUEkgY29ubmVjdGlvbicpXHJcbiAgICAgIC5hZGRCdXR0b24oYnV0dG9uID0+IGJ1dHRvblxyXG4gICAgICAgIC5zZXRCdXR0b25UZXh0KCdUZXN0JylcclxuICAgICAgICAub25DbGljayhhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgICBidXR0b24uc2V0QnV0dG9uVGV4dCgnVGVzdGluZy4uLicpO1xyXG4gICAgICAgICAgYnV0dG9uLnNldERpc2FibGVkKHRydWUpO1xyXG4gICAgICAgICAgXHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBwcm92aWRlciA9IHRoaXMucGx1Z2luLnByb3ZpZGVyRmFjdG9yeT8uZ2V0QWRhcHRlcihcclxuICAgICAgICAgICAgICBzZXR0aW5ncy5wcm92aWRlcixcclxuICAgICAgICAgICAgICBzZXR0aW5ncy5hcGlLZXlcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChwcm92aWRlcikge1xyXG4gICAgICAgICAgICAgIGNvbnN0IHN1Y2Nlc3MgPSBhd2FpdCBwcm92aWRlci50ZXN0Q29ubmVjdGlvbigpO1xyXG4gICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgIGlmIChzdWNjZXNzKSB7XHJcbiAgICAgICAgICAgICAgICBuZXcgdGhpcy5wbHVnaW4uYXBwLk5vdGljZSgnQ29ubmVjdGlvbiBzdWNjZXNzZnVsIScpO1xyXG4gICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBuZXcgdGhpcy5wbHVnaW4uYXBwLk5vdGljZSgnQ29ubmVjdGlvbiBmYWlsZWQuIENoZWNrIHlvdXIgQVBJIGtleSBhbmQgc2V0dGluZ3MuJyk7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgIG5ldyB0aGlzLnBsdWdpbi5hcHAuTm90aWNlKCdQcm92aWRlciBhZGFwdGVyIG5vdCBhdmFpbGFibGUgeWV0LicpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICBuZXcgdGhpcy5wbHVnaW4uYXBwLk5vdGljZShgRXJyb3I6ICR7ZXJyb3IubWVzc2FnZX1gKTtcclxuICAgICAgICAgIH0gZmluYWxseSB7XHJcbiAgICAgICAgICAgIGJ1dHRvbi5zZXRCdXR0b25UZXh0KCdUZXN0Jyk7XHJcbiAgICAgICAgICAgIGJ1dHRvbi5zZXREaXNhYmxlZChmYWxzZSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSkpO1xyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBDcmVhdGUgY29udmVyc2F0aW9uIHNldHRpbmdzIHNlY3Rpb24uXHJcbiAgICogQHBhcmFtIGNvbnRhaW5lckVsIENvbnRhaW5lciBlbGVtZW50XHJcbiAgICogQHBhcmFtIHNldHRpbmdzIEN1cnJlbnQgc2V0dGluZ3NcclxuICAgKi9cclxuICBwcml2YXRlIGNyZWF0ZUNvbnZlcnNhdGlvblNldHRpbmdzKGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCwgc2V0dGluZ3M6IENoYXRzaWRpYW5TZXR0aW5ncyk6IHZvaWQge1xyXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoJ2gyJywgeyB0ZXh0OiAnQ29udmVyc2F0aW9uIFNldHRpbmdzJyB9KTtcclxuICAgIFxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKCdDb252ZXJzYXRpb25zIEZvbGRlcicpXHJcbiAgICAgIC5zZXREZXNjKCdGb2xkZXIgd2hlcmUgY29udmVyc2F0aW9ucyBhcmUgc3RvcmVkJylcclxuICAgICAgLmFkZFRleHQodGV4dCA9PiB0ZXh0XHJcbiAgICAgICAgLnNldFBsYWNlaG9sZGVyKCdmb2xkZXIvcGF0aCcpXHJcbiAgICAgICAgLnNldFZhbHVlKHNldHRpbmdzLmNvbnZlcnNhdGlvbnNGb2xkZXIpXHJcbiAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5zZXR0aW5ncy51cGRhdGVTZXR0aW5ncyh7IGNvbnZlcnNhdGlvbnNGb2xkZXI6IHZhbHVlIH0pO1xyXG4gICAgICAgIH0pKTtcclxuICAgIFxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKCdNYXggTWVzc2FnZXMnKVxyXG4gICAgICAuc2V0RGVzYygnTWF4aW11bSBudW1iZXIgb2YgbWVzc2FnZXMgdG8ga2VlcCBpbiBtZW1vcnknKVxyXG4gICAgICAuYWRkU2xpZGVyKHNsaWRlciA9PiBzbGlkZXJcclxuICAgICAgICAuc2V0TGltaXRzKDEwLCA1MDAsIDEwKVxyXG4gICAgICAgIC5zZXRWYWx1ZShzZXR0aW5ncy5tYXhNZXNzYWdlcylcclxuICAgICAgICAuc2V0RHluYW1pY1Rvb2x0aXAoKVxyXG4gICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgIGF3YWl0IHRoaXMuc2V0dGluZ3MudXBkYXRlU2V0dGluZ3MoeyBtYXhNZXNzYWdlczogdmFsdWUgfSk7XHJcbiAgICAgICAgfSkpO1xyXG4gICAgXHJcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcclxuICAgICAgLnNldE5hbWUoJ0RlZmF1bHQgU3lzdGVtIFByb21wdCcpXHJcbiAgICAgIC5zZXREZXNjKCdEZWZhdWx0IHN5c3RlbSBwcm9tcHQgdG8gdXNlIGZvciBuZXcgY29udmVyc2F0aW9ucycpXHJcbiAgICAgIC5hZGRUZXh0QXJlYSh0ZXh0YXJlYSA9PiB0ZXh0YXJlYVxyXG4gICAgICAgIC5zZXRQbGFjZWhvbGRlcignRW50ZXIgZGVmYXVsdCBzeXN0ZW0gcHJvbXB0JylcclxuICAgICAgICAuc2V0VmFsdWUoc2V0dGluZ3MuZGVmYXVsdFN5c3RlbVByb21wdClcclxuICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLnNldHRpbmdzLnVwZGF0ZVNldHRpbmdzKHsgZGVmYXVsdFN5c3RlbVByb21wdDogdmFsdWUgfSk7XHJcbiAgICAgICAgfSkpXHJcbiAgICAgIC5hZGRFeHRyYUJ1dHRvbihidXR0b24gPT4gYnV0dG9uXHJcbiAgICAgICAgLnNldEljb24oJ3Jlc2V0JylcclxuICAgICAgICAuc2V0VG9vbHRpcCgnUmVzZXQgdG8gZGVmYXVsdCcpXHJcbiAgICAgICAgLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5zZXR0aW5ncy51cGRhdGVTZXR0aW5ncyh7IFxyXG4gICAgICAgICAgICBkZWZhdWx0U3lzdGVtUHJvbXB0OiBERUZBVUxUX1NFVFRJTkdTLmRlZmF1bHRTeXN0ZW1Qcm9tcHQgXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICAgIHRoaXMuZGlzcGxheSgpOyAvLyBSZWZyZXNoIFVJXHJcbiAgICAgICAgfSkpO1xyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBDcmVhdGUgVUkgc2V0dGluZ3Mgc2VjdGlvbi5cclxuICAgKiBAcGFyYW0gY29udGFpbmVyRWwgQ29udGFpbmVyIGVsZW1lbnRcclxuICAgKiBAcGFyYW0gc2V0dGluZ3MgQ3VycmVudCBzZXR0aW5nc1xyXG4gICAqL1xyXG4gIHByaXZhdGUgY3JlYXRlVWlTZXR0aW5ncyhjb250YWluZXJFbDogSFRNTEVsZW1lbnQsIHNldHRpbmdzOiBDaGF0c2lkaWFuU2V0dGluZ3MpOiB2b2lkIHtcclxuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ1VJIFNldHRpbmdzJyB9KTtcclxuICAgIFxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKCdUaGVtZScpXHJcbiAgICAgIC5zZXREZXNjKCdDaG9vc2UgdGhlIHRoZW1lIGZvciB0aGUgY2hhdCBpbnRlcmZhY2UnKVxyXG4gICAgICAuYWRkRHJvcGRvd24oZHJvcGRvd24gPT4gZHJvcGRvd25cclxuICAgICAgICAuYWRkT3B0aW9uKCdsaWdodCcsICdMaWdodCcpXHJcbiAgICAgICAgLmFkZE9wdGlvbignZGFyaycsICdEYXJrJylcclxuICAgICAgICAuYWRkT3B0aW9uKCdzeXN0ZW0nLCAnVXNlIFN5c3RlbSBUaGVtZScpXHJcbiAgICAgICAgLnNldFZhbHVlKHNldHRpbmdzLnRoZW1lKVxyXG4gICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgIGF3YWl0IHRoaXMuc2V0dGluZ3MudXBkYXRlU2V0dGluZ3MoeyBcclxuICAgICAgICAgICAgdGhlbWU6IHZhbHVlIGFzIENoYXRzaWRpYW5TZXR0aW5nc1sndGhlbWUnXSBcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pKTtcclxuICAgIFxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKCdGb250IFNpemUnKVxyXG4gICAgICAuc2V0RGVzYygnRm9udCBzaXplIGZvciB0aGUgY2hhdCBpbnRlcmZhY2UnKVxyXG4gICAgICAuYWRkU2xpZGVyKHNsaWRlciA9PiBzbGlkZXJcclxuICAgICAgICAuc2V0TGltaXRzKDEwLCAyNCwgMSlcclxuICAgICAgICAuc2V0VmFsdWUoc2V0dGluZ3MuZm9udFNpemUpXHJcbiAgICAgICAgLnNldER5bmFtaWNUb29sdGlwKClcclxuICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLnNldHRpbmdzLnVwZGF0ZVNldHRpbmdzKHsgZm9udFNpemU6IHZhbHVlIH0pO1xyXG4gICAgICAgIH0pKTtcclxuICAgIFxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKCdTaG93IFRpbWVzdGFtcHMnKVxyXG4gICAgICAuc2V0RGVzYygnU2hvdyBtZXNzYWdlIHRpbWVzdGFtcHMgaW4gdGhlIGNoYXQgaW50ZXJmYWNlJylcclxuICAgICAgLmFkZFRvZ2dsZSh0b2dnbGUgPT4gdG9nZ2xlXHJcbiAgICAgICAgLnNldFZhbHVlKHNldHRpbmdzLnNob3dUaW1lc3RhbXBzKVxyXG4gICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcclxuICAgICAgICAgIGF3YWl0IHRoaXMuc2V0dGluZ3MudXBkYXRlU2V0dGluZ3MoeyBzaG93VGltZXN0YW1wczogdmFsdWUgfSk7XHJcbiAgICAgICAgfSkpO1xyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBDcmVhdGUgYWR2YW5jZWQgc2V0dGluZ3Mgc2VjdGlvbi5cclxuICAgKiBAcGFyYW0gY29udGFpbmVyRWwgQ29udGFpbmVyIGVsZW1lbnRcclxuICAgKiBAcGFyYW0gc2V0dGluZ3MgQ3VycmVudCBzZXR0aW5nc1xyXG4gICAqL1xyXG4gIHByaXZhdGUgY3JlYXRlQWR2YW5jZWRTZXR0aW5ncyhjb250YWluZXJFbDogSFRNTEVsZW1lbnQsIHNldHRpbmdzOiBDaGF0c2lkaWFuU2V0dGluZ3MpOiB2b2lkIHtcclxuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0FkdmFuY2VkIFNldHRpbmdzJyB9KTtcclxuICAgIFxyXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXHJcbiAgICAgIC5zZXROYW1lKCdEZWJ1ZyBNb2RlJylcclxuICAgICAgLnNldERlc2MoJ0VuYWJsZSBkZWJ1ZyBsb2dnaW5nJylcclxuICAgICAgLmFkZFRvZ2dsZSh0b2dnbGUgPT4gdG9nZ2xlXHJcbiAgICAgICAgLnNldFZhbHVlKHNldHRpbmdzLmRlYnVnTW9kZSlcclxuICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLnNldHRpbmdzLnVwZGF0ZVNldHRpbmdzKHsgZGVidWdNb2RlOiB2YWx1ZSB9KTtcclxuICAgICAgICB9KSk7XHJcbiAgICBcclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZSgnQXV0by1sb2FkIEJDUHMnKVxyXG4gICAgICAuc2V0RGVzYygnQm91bmRlZCBDb250ZXh0IFBhY2tzIHRvIGxvYWQgYXV0b21hdGljYWxseScpXHJcbiAgICAgIC5hZGRUZXh0QXJlYSh0ZXh0YXJlYSA9PiB0ZXh0YXJlYVxyXG4gICAgICAgIC5zZXRQbGFjZWhvbGRlcignU3lzdGVtLFZhdWx0LEVkaXRvcicpXHJcbiAgICAgICAgLnNldFZhbHVlKHNldHRpbmdzLmF1dG9Mb2FkQkNQcy5qb2luKCcsJykpXHJcbiAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgY29uc3QgYmNwcyA9IHZhbHVlLnNwbGl0KCcsJykubWFwKHMgPT4gcy50cmltKCkpLmZpbHRlcihzID0+IHMpO1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5zZXR0aW5ncy51cGRhdGVTZXR0aW5ncyh7IGF1dG9Mb2FkQkNQczogYmNwcyB9KTtcclxuICAgICAgICB9KSk7XHJcbiAgICBcclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZSgnRGVmYXVsdCBUZW1wZXJhdHVyZScpXHJcbiAgICAgIC5zZXREZXNjKCdEZWZhdWx0IHRlbXBlcmF0dXJlIGZvciBBSSByZXF1ZXN0cyAoMC4wIC0gMS4wKScpXHJcbiAgICAgIC5hZGRTbGlkZXIoc2xpZGVyID0+IHNsaWRlclxyXG4gICAgICAgIC5zZXRMaW1pdHMoMCwgMSwgMC4xKVxyXG4gICAgICAgIC5zZXRWYWx1ZShzZXR0aW5ncy5kZWZhdWx0VGVtcGVyYXR1cmUpXHJcbiAgICAgICAgLnNldER5bmFtaWNUb29sdGlwKClcclxuICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICBhd2FpdCB0aGlzLnNldHRpbmdzLnVwZGF0ZVNldHRpbmdzKHsgZGVmYXVsdFRlbXBlcmF0dXJlOiB2YWx1ZSB9KTtcclxuICAgICAgICB9KSk7XHJcbiAgICBcclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZSgnRGVmYXVsdCBNYXggVG9rZW5zJylcclxuICAgICAgLnNldERlc2MoJ0RlZmF1bHQgbWF4aW11bSB0b2tlbnMgZm9yIEFJIHJlc3BvbnNlcycpXHJcbiAgICAgIC5hZGRUZXh0KHRleHQgPT4gdGV4dFxyXG4gICAgICAgIC5zZXRQbGFjZWhvbGRlcignNDAwMCcpXHJcbiAgICAgICAgLnNldFZhbHVlKHNldHRpbmdzLmRlZmF1bHRNYXhUb2tlbnMudG9TdHJpbmcoKSlcclxuICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICBjb25zdCB0b2tlbnMgPSBwYXJzZUludCh2YWx1ZSk7XHJcbiAgICAgICAgICBpZiAoIWlzTmFOKHRva2VucykpIHtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5zZXR0aW5ncy51cGRhdGVTZXR0aW5ncyh7IGRlZmF1bHRNYXhUb2tlbnM6IHRva2VucyB9KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KSk7XHJcbiAgICBcclxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxyXG4gICAgICAuc2V0TmFtZSgnUmVzZXQgQWxsIFNldHRpbmdzJylcclxuICAgICAgLnNldERlc2MoJ1Jlc2V0IGFsbCBzZXR0aW5ncyB0byB0aGVpciBkZWZhdWx0IHZhbHVlcycpXHJcbiAgICAgIC5hZGRCdXR0b24oYnV0dG9uID0+IGJ1dHRvblxyXG4gICAgICAgIC5zZXRCdXR0b25UZXh0KCdSZXNldCBBbGwnKVxyXG4gICAgICAgIC5zZXRXYXJuaW5nKClcclxuICAgICAgICAub25DbGljayhhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgICBjb25zdCBjb25maXJtID0gYXdhaXQgdGhpcy5wbHVnaW4uYXBwLm1vZGFsLmNvbmZpcm0oXHJcbiAgICAgICAgICAgICdSZXNldCBhbGwgc2V0dGluZ3M/JyxcclxuICAgICAgICAgICAgJ1RoaXMgd2lsbCByZXNldCBhbGwgc2V0dGluZ3MgdG8gdGhlaXIgZGVmYXVsdCB2YWx1ZXMuIFRoaXMgYWN0aW9uIGNhbm5vdCBiZSB1bmRvbmUuJ1xyXG4gICAgICAgICAgKTtcclxuICAgICAgICAgIFxyXG4gICAgICAgICAgaWYgKGNvbmZpcm0pIHtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5zZXR0aW5ncy5yZXNldFRvRGVmYXVsdHMoKTtcclxuICAgICAgICAgICAgdGhpcy5kaXNwbGF5KCk7IC8vIFJlZnJlc2ggVUlcclxuICAgICAgICAgICAgbmV3IHRoaXMucGx1Z2luLmFwcC5Ob3RpY2UoJ1NldHRpbmdzIHJlc2V0IHRvIGRlZmF1bHRzJyk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSkpO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIFNldHRpbmdzIGV4cG9ydC9pbXBvcnQgdXRpbGl0aWVzLlxyXG4gKiBQcm92aWRlcyBmdW5jdGlvbmFsaXR5IGZvciBleHBvcnRpbmcgc2V0dGluZ3MgdG8gSlNPTiBhbmQgaW1wb3J0aW5nIGZyb20gSlNPTi5cclxuICovXHJcbmV4cG9ydCBjbGFzcyBTZXR0aW5nc0V4cG9ydEltcG9ydCB7XHJcbiAgcHJpdmF0ZSBzZXR0aW5nczogU2V0dGluZ3NNYW5hZ2VyO1xyXG4gIFxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIG5ldyBTZXR0aW5nc0V4cG9ydEltcG9ydC5cclxuICAgKiBAcGFyYW0gc2V0dGluZ3MgU2V0dGluZ3MgbWFuYWdlclxyXG4gICAqL1xyXG4gIGNvbnN0cnVjdG9yKHNldHRpbmdzOiBTZXR0aW5nc01hbmFnZXIpIHtcclxuICAgIHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcclxuICB9XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogRXhwb3J0IHNldHRpbmdzIHRvIEpTT04uXHJcbiAgICogQHBhcmFtIGluY2x1ZGVBcGlLZXkgV2hldGhlciB0byBpbmNsdWRlIHRoZSBBUEkga2V5XHJcbiAgICogQHJldHVybnMgU2V0dGluZ3MgYXMgYSBKU09OIHN0cmluZ1xyXG4gICAqL1xyXG4gIHB1YmxpYyBleHBvcnRUb0pzb24oaW5jbHVkZUFwaUtleTogYm9vbGVhbiA9IGZhbHNlKTogc3RyaW5nIHtcclxuICAgIGNvbnN0IHNldHRpbmdzID0gdGhpcy5zZXR0aW5ncy5nZXRTZXR0aW5ncygpO1xyXG4gICAgXHJcbiAgICAvLyBDcmVhdGUgYSBjb3B5IGZvciBleHBvcnRcclxuICAgIGNvbnN0IGV4cG9ydFNldHRpbmdzID0geyAuLi5zZXR0aW5ncyB9O1xyXG4gICAgXHJcbiAgICAvLyBSZW1vdmUgc2Vuc2l0aXZlIGRhdGEgaWYgbm90IGluY2x1ZGVkXHJcbiAgICBpZiAoIWluY2x1ZGVBcGlLZXkpIHtcclxuICAgICAgZXhwb3J0U2V0dGluZ3MuYXBpS2V5ID0gJyc7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShleHBvcnRTZXR0aW5ncywgbnVsbCwgMik7XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIEltcG9ydCBzZXR0aW5ncyBmcm9tIEpTT04uXHJcbiAgICogQHBhcmFtIGpzb24gU2V0dGluZ3MgSlNPTlxyXG4gICAqIEByZXR1cm5zIFByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIHNldHRpbmdzIGFyZSBpbXBvcnRlZFxyXG4gICAqL1xyXG4gIHB1YmxpYyBhc3luYyBpbXBvcnRGcm9tSnNvbihqc29uOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGltcG9ydGVkU2V0dGluZ3MgPSBKU09OLnBhcnNlKGpzb24pO1xyXG4gICAgICBcclxuICAgICAgLy8gVmFsaWRhdGUgaW1wb3J0ZWQgc2V0dGluZ3NcclxuICAgICAgaWYgKHR5cGVvZiBpbXBvcnRlZFNldHRpbmdzICE9PSAnb2JqZWN0Jykge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzZXR0aW5ncyBmb3JtYXQnKTtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgLy8gVXBkYXRlIHNldHRpbmdzXHJcbiAgICAgIGF3YWl0IHRoaXMuc2V0dGluZ3MudXBkYXRlU2V0dGluZ3MoaW1wb3J0ZWRTZXR0aW5ncyk7XHJcbiAgICAgIFxyXG4gICAgICByZXR1cm47XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBpbXBvcnQgc2V0dGluZ3M6ICR7ZXJyb3IubWVzc2FnZX1gKTtcclxuICAgIH1cclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTZXR0aW5ncyBtaWdyYXRpb24gdXRpbGl0aWVzLlxyXG4gKiBQcm92aWRlcyBmdW5jdGlvbmFsaXR5IGZvciBtaWdyYXRpbmcgc2V0dGluZ3MgZnJvbSBwcmV2aW91cyB2ZXJzaW9ucy5cclxuICovXHJcbmV4cG9ydCBjbGFzcyBTZXR0aW5nc01pZ3JhdGlvbiB7XHJcbiAgLyoqXHJcbiAgICogTWlncmF0ZSBzZXR0aW5ncyBmcm9tIGEgcHJldmlvdXMgdmVyc2lvbi5cclxuICAgKiBAcGFyYW0gb2xkU2V0dGluZ3MgU2V0dGluZ3MgZnJvbSBhIHByZXZpb3VzIHZlcnNpb25cclxuICAgKiBAcmV0dXJucyBNaWdyYXRlZCBzZXR0aW5nc1xyXG4gICAqL1xyXG4gIHB1YmxpYyBzdGF0aWMgbWlncmF0ZVNldHRpbmdzKG9sZFNldHRpbmdzOiBhbnkpOiBQYXJ0aWFsPENoYXRzaWRpYW5TZXR0aW5ncz4ge1xyXG4gICAgLy8gU3RhcnQgd2l0aCBlbXB0eSBzZXR0aW5nc1xyXG4gICAgY29uc3QgbmV3U2V0dGluZ3M6IFBhcnRpYWw8Q2hhdHNpZGlhblNldHRpbmdzPiA9IHt9O1xyXG4gICAgXHJcbiAgICAvLyBNYXAga25vd24gZmllbGRzIGZyb20gb2xkIHRvIG5ldyBmb3JtYXRcclxuICAgIGlmIChvbGRTZXR0aW5ncykge1xyXG4gICAgICAvLyBEaXJlY3QgbWFwcGluZ3NcclxuICAgICAgaWYgKG9sZFNldHRpbmdzLnByb3ZpZGVyKSBuZXdTZXR0aW5ncy5wcm92aWRlciA9IG9sZFNldHRpbmdzLnByb3ZpZGVyO1xyXG4gICAgICBpZiAob2xkU2V0dGluZ3MuYXBpS2V5KSBuZXdTZXR0aW5ncy5hcGlLZXkgPSBvbGRTZXR0aW5ncy5hcGlLZXk7XHJcbiAgICAgIGlmIChvbGRTZXR0aW5ncy5tb2RlbCkgbmV3U2V0dGluZ3MubW9kZWwgPSBvbGRTZXR0aW5ncy5tb2RlbDtcclxuICAgICAgaWYgKG9sZFNldHRpbmdzLmNvbnZlcnNhdGlvbnNGb2xkZXIpIG5ld1NldHRpbmdzLmNvbnZlcnNhdGlvbnNGb2xkZXIgPSBvbGRTZXR0aW5ncy5jb252ZXJzYXRpb25zRm9sZGVyO1xyXG4gICAgICBpZiAob2xkU2V0dGluZ3MubWF4TWVzc2FnZXMpIG5ld1NldHRpbmdzLm1heE1lc3NhZ2VzID0gb2xkU2V0dGluZ3MubWF4TWVzc2FnZXM7XHJcbiAgICAgIGlmIChvbGRTZXR0aW5ncy5kZWZhdWx0U3lzdGVtUHJvbXB0KSBuZXdTZXR0aW5ncy5kZWZhdWx0U3lzdGVtUHJvbXB0ID0gb2xkU2V0dGluZ3MuZGVmYXVsdFN5c3RlbVByb21wdDtcclxuICAgICAgaWYgKG9sZFNldHRpbmdzLnRoZW1lKSBuZXdTZXR0aW5ncy50aGVtZSA9IG9sZFNldHRpbmdzLnRoZW1lO1xyXG4gICAgICBpZiAob2xkU2V0dGluZ3MuZm9udFNpemUpIG5ld1NldHRpbmdzLmZvbnRTaXplID0gb2xkU2V0dGluZ3MuZm9udFNpemU7XHJcbiAgICAgIGlmIChvbGRTZXR0aW5ncy5zaG93VGltZXN0YW1wcykgbmV3U2V0dGluZ3Muc2hvd1RpbWVzdGFtcHMgPSBvbGRTZXR0aW5ncy5zaG93VGltZXN0YW1wcztcclxuICAgICAgaWYgKG9sZFNldHRpbmdzLmRlYnVnTW9kZSkgbmV3U2V0dGluZ3MuZGVidWdNb2RlID0gb2xkU2V0dGluZ3MuZGVidWdNb2RlO1xyXG4gICAgICBpZiAob2xkU2V0dGluZ3MuZGVmYXVsdFRlbXBlcmF0dXJlKSBuZXdTZXR0aW5ncy5kZWZhdWx0VGVtcGVyYXR1cmUgPSBvbGRTZXR0aW5ncy5kZWZhdWx0VGVtcGVyYXR1cmU7XHJcbiAgICAgIGlmIChvbGRTZXR0aW5ncy5kZWZhdWx0TWF4VG9rZW5zKSBuZXdTZXR0aW5ncy5kZWZhdWx0TWF4VG9rZW5zID0gb2xkU2V0dGluZ3MuZGVmYXVsdE1heFRva2VucztcclxuICAgICAgXHJcbiAgICAgIC8vIEZpZWxkIG1hcHBpbmdzIHdpdGggY2hhbmdlc1xyXG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShvbGRTZXR0aW5ncy5iY3BzKSkge1xyXG4gICAgICAgIG5ld1NldHRpbmdzLmF1dG9Mb2FkQkNQcyA9IG9sZFNldHRpbmdzLmJjcHM7XHJcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIG9sZFNldHRpbmdzLmJjcHMgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgbmV3U2V0dGluZ3MuYXV0b0xvYWRCQ1BzID0gb2xkU2V0dGluZ3MuYmNwcy5zcGxpdCgnLCcpLm1hcCgoczogc3RyaW5nKSA9PiBzLnRyaW0oKSkuZmlsdGVyKChzOiBzdHJpbmcpID0+IHMpO1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICAvLyBIYW5kbGUgYW55IG90aGVyIHNwZWNpZmljIG1pZ3JhdGlvbnMgaGVyZVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gbmV3U2V0dGluZ3M7XHJcbiAgfVxyXG59XHJcbiJdfQ==