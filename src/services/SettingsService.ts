/**
 * Settings service for plugin integration.
 * 
 * This file provides a service class for initializing and managing plugin settings,
 * integrating the SettingsManager with the Obsidian plugin lifecycle.
 */

import { App } from '../utils/obsidian-imports';
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
 * Provides a bridge between the plugin and the settings management system.
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
