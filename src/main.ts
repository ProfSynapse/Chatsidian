/**
 * Chatsidian Plugin - Main Entry Point
 * 
 * This file serves as the main entry point for the Chatsidian plugin.
 * It initializes the plugin, registers commands, and manages the plugin lifecycle.
 * 
 * The plugin provides a native chat interface within Obsidian, leveraging the
 * Model Context Protocol (MCP) to enable AI assistants to perform actions within the vault.
 * 
 * @file This file defines the ChatsidianPlugin class that extends Obsidian's Plugin class.
 * @author Your Name
 * @version 0.1.0
 */

import { App, Notice, TFile, TFolder } from './utils/obsidian-imports';
import { Plugin } from 'obsidian';
import { EventBus } from './core/EventBus';
import { EventBusFactory } from './core/EventBusFactory';
import { SettingsManager } from './core/SettingsManager';
import { SettingsService } from './services/SettingsService';
import { StorageService } from './services/StorageService';
import { ProviderService } from './services/ProviderService';
import { ChatsidianSettings, DEFAULT_SETTINGS } from './models/Settings';

/**
 * Constants for the plugin
 */
export const PLUGIN_ID = 'chatsidian';
export const PLUGIN_NAME = 'Chatsidian';
export const VIEW_TYPE_CHAT = 'chatsidian-chat-view';
export const VIEW_TYPE_SIDEBAR = 'chatsidian-sidebar';

/**
 * Main plugin class for Chatsidian.
 * Handles plugin initialization, command registration, and lifecycle management.
 */
export default class ChatsidianPlugin extends Plugin {
  /**
   * Settings manager instance
   */
  settings: SettingsManager;

  /**
   * Event bus for plugin-wide events
   */
  eventBus: EventBus;

  /**
   * Settings service for managing settings
   */
  settingsService: SettingsService;
  
  /**
   * Storage service for managing conversations
   */
  storageService: StorageService;
  
  /**
   * Provider service for managing AI providers and models
   */
  providerService: ProviderService;

  /**
   * Whether the plugin is in debug mode
   */
  private debugMode = false;

  /**
   * Called when the plugin is loaded.
   * Initializes settings, registers commands, and sets up event listeners.
   */
  async onload() {
    console.log(`Loading ${PLUGIN_NAME} plugin`);
    const startTime = performance.now();
    
    try {
      // Initialize core components
      await this.initializeCore();
      
      // Register commands
      this.registerCommands();
      
      // Register views (placeholder for now)
      this.registerViews();
      
      // Register event listeners
      this.registerEventListeners();
      
      // Check for version changes and run migrations if needed
      await this.handleVersionChanges();
      
      // Emit plugin loaded event
      this.eventBus.emit('plugin:loaded', undefined);
      
      const loadTime = Math.round(performance.now() - startTime);
      console.log(`${PLUGIN_NAME} plugin loaded in ${loadTime}ms`);
    } catch (error) {
      console.error(`Failed to load ${PLUGIN_NAME} plugin:`, error);
      new Notice(`${PLUGIN_NAME} error: ${error.message || 'Unknown error during initialization'}`);
    }
  }
  
  /**
   * Called when the plugin is unloaded.
   * Cleans up resources and event listeners.
   */
  async onunload() {
    console.log(`Unloading ${PLUGIN_NAME} plugin`);
    
    try {
      // Emit plugin unloaded event
      this.eventBus.emit('plugin:unloaded', undefined);
      
      // Close any open views
      this.closeViews();
      
      // Clear event bus
      this.eventBus.clear();
      
      console.log(`${PLUGIN_NAME} plugin unloaded successfully`);
    } catch (error) {
      console.error(`Error during ${PLUGIN_NAME} plugin unload:`, error);
    }
  }
  
  /**
   * Initialize core components.
   */
  private async initializeCore(): Promise<void> {
    // Initialize event bus
    this.eventBus = EventBusFactory.createBasicEventBus();
    
    // Initialize settings service
    this.settingsService = new SettingsService(this.app, this, this.eventBus);
    this.settings = await this.settingsService.initialize(await this.loadData());
    
    // Update debug mode
    this.debugMode = this.settings.getSettings().debugMode;
    
    // Initialize storage service
    this.storageService = new StorageService(this.app, this, this.eventBus, this.settings);
    await this.storageService.initialize();
    
    // Initialize provider service
    this.providerService = new ProviderService(this.app, this.eventBus, this.settingsService);
    await this.providerService.initialize();
    
    // Ensure plugin folders exist
    await this.ensurePluginFolders();
    
    this.debug('Core components initialized');
  }
  
  /**
   * Register plugin commands.
   */
  private registerCommands(): void {
    // Command to open chat view
    this.addCommand({
      id: 'open-chat',
      name: 'Open Chat',
      callback: () => {
        this.debug('Open chat command triggered');
        // Placeholder until chat view is implemented
        new Notice('Chat view will be implemented in Phase 3');
      }
    });
    
    // Command to start new conversation
    this.addCommand({
      id: 'new-conversation',
      name: 'New Conversation',
      callback: async () => {
        this.debug('New conversation command triggered');
        try {
          const conversation = await this.storageService.createConversation('New Conversation');
          new Notice(`Created new conversation: ${conversation.title}`);
        } catch (error: any) {
          console.error('Failed to create conversation:', error);
          new Notice(`Failed to create conversation: ${error.message}`);
        }
      }
    });
    
    // Command to toggle sidebar
    this.addCommand({
      id: 'toggle-sidebar',
      name: 'Toggle Conversation Sidebar',
      callback: () => {
        this.debug('Toggle sidebar command triggered');
        // Placeholder until sidebar is implemented
        new Notice('Sidebar will be implemented in Phase 3');
      }
    });
    
    // Add ribbon icon
    this.addRibbonIcon('message-circle', PLUGIN_NAME, () => {
      this.debug('Ribbon icon clicked');
      // Placeholder until chat view is implemented
      new Notice('Chat view will be implemented in Phase 3');
    });
    
    this.debug('Commands registered');
  }
  
  /**
   * Register plugin views.
   * These are placeholders until the views are implemented in Phase 3.
   */
  private registerViews(): void {
    // Placeholder for view registration
    // Will be implemented in Phase 3
    this.debug('Views registered (placeholder)');
  }
  
  /**
   * Close any open views.
   */
  private closeViews(): void {
    // Placeholder for view closing
    // Will be implemented in Phase 3
    this.debug('Views closed (placeholder)');
  }
  
  /**
   * Register event listeners for the plugin.
   */
  private registerEventListeners(): void {
    // Listen for settings updates
    this.registerEvent(
      this.eventBus.on('settings:updated', (data) => {
        this.debug('Settings updated:', data.changedKeys);
        
        // Handle specific setting changes
        if (data.changedKeys.includes('debugMode')) {
          this.debugMode = data.currentSettings.debugMode;
          console.log(`Debug mode ${this.debugMode ? 'enabled' : 'disabled'}`);
        }
        
        // Handle conversations folder change
        if (data.changedKeys.includes('conversationsFolder')) {
          this.ensurePluginFolders().catch(error => {
            console.error('Failed to create plugin folders after settings change:', error);
          });
        }
      })
    );
    
    // Listen for storage errors
    this.registerEvent(
      this.eventBus.on('storage:error', (data) => {
        console.error('Storage error:', data.error);
        new Notice(`Storage error: ${data.error.message || 'Unknown error'}`);
      })
    );
    
    // Listen for provider errors
    this.registerEvent(
      this.eventBus.on('provider:error', (data) => {
        console.error('Provider error:', data.error);
        new Notice(`Provider error: ${data.error.message || 'Unknown error'}`);
      })
    );
    
    // Register for file menu events
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu: any, file: any) => {
        if (file instanceof TFile && file.extension === 'json') {
          // Check if this is a conversation file
          const conversationsPath = this.settings.getSettings().conversationsFolder;
          if (file.path.startsWith(conversationsPath)) {
            menu.addItem((item: any) => {
              item
                .setTitle('Open in Chatsidian')
                .setIcon('message-circle')
                .onClick(() => {
                  // Placeholder until chat view is implemented
                  new Notice(`Will open conversation: ${file.basename} (Phase 3)`);
                });
            });
          }
        }
      })
    );
    
    this.debug('Event listeners registered');
  }
  
  /**
   * Ensure plugin folders exist.
   */
  private async ensurePluginFolders(): Promise<void> {
    const settings = this.settings.getSettings();
    const conversationsFolder = settings.conversationsFolder;
    
    try {
      // Check if conversations folder exists
      const folder = this.app.vault.getAbstractFileByPath(conversationsFolder);
      
      if (!folder) {
        // Create folder if it doesn't exist
        await this.app.vault.createFolder(conversationsFolder);
        this.debug(`Created conversations folder: ${conversationsFolder}`);
      } else if (!(folder instanceof TFolder)) {
        console.error(`${conversationsFolder} exists but is not a folder`);
      }
      
      // Create backups folder if it doesn't exist
      const backupsFolder = `${conversationsFolder}/backups`;
      const backupsFolderFile = this.app.vault.getAbstractFileByPath(backupsFolder);
      
      if (!backupsFolderFile) {
        await this.app.vault.createFolder(backupsFolder);
        this.debug(`Created backups folder: ${backupsFolder}`);
      }
    } catch (error) {
      console.error('Failed to create plugin folders:', error);
      throw error;
    }
  }
  
  /**
   * Check for version changes and run migrations if needed.
   */
  private async handleVersionChanges(): Promise<void> {
    const currentVersion = this.manifest.version;
    const savedData = await this.loadData() || {};
    const savedVersion = savedData.pluginVersion;
    
    this.debug(`Plugin version check: current=${currentVersion}, saved=${savedVersion || 'none'}`);
    
    if (currentVersion !== savedVersion) {
      console.log(`${PLUGIN_NAME} updated from ${savedVersion || 'none'} to ${currentVersion}`);
      
      if (!savedVersion) {
        // First install - no migration needed
        new Notice(`${PLUGIN_NAME} ${currentVersion} installed successfully!`);
      } else if (this.isVersionNewer(currentVersion, savedVersion)) {
        // Upgrade case - might need migrations
        new Notice(`${PLUGIN_NAME} updated to version ${currentVersion}`);
        
        // Run version-specific migrations
        await this.runMigrations(savedVersion, currentVersion);
      } else {
        // Downgrade case - handle with caution
        console.warn(`${PLUGIN_NAME} downgraded from ${savedVersion} to ${currentVersion}`);
        new Notice(`${PLUGIN_NAME} downgraded to version ${currentVersion}. Some features may not work correctly.`);
      }
      
      // Update stored version
      const updatedData = {...savedData, pluginVersion: currentVersion};
      await this.saveData(updatedData);
    }
  }
  
  /**
   * Run version-specific migrations.
   */
  private async runMigrations(fromVersion: string, toVersion: string): Promise<void> {
    this.debug(`Running migrations from ${fromVersion} to ${toVersion}`);
    
    // No migrations needed yet, but this is where they would go
    // This is a placeholder for future migrations
  }
  
  /**
   * Check if version a is newer than version b.
   */
  private isVersionNewer(a: string, b: string): boolean {
    const parseVersion = (v: string) => v.split('.').map(n => parseInt(n, 10) || 0);
    
    const va = parseVersion(a);
    const vb = parseVersion(b);
    
    for (let i = 0; i < Math.max(va.length, vb.length); i++) {
      const na = i < va.length ? va[i] : 0;
      const nb = i < vb.length ? vb[i] : 0;
      if (na > nb) return true;
      if (na < nb) return false;
    }
    
    return false; // Versions are equal
  }
  
  /**
   * Log a debug message if debug mode is enabled.
   */
  private debug(message: string, ...args: any[]): void {
    if (this.debugMode) {
      console.log(`[${PLUGIN_NAME}:debug] ${message}`, ...args);
    }
  }
  
  /**
   * Handle an error with source context.
   */
  private handleError(source: string, error: Error): void {
    console.error(`[${PLUGIN_NAME}:${source}] Error:`, error);
    
    // Show notification to user
    if (error.message) {
      new Notice(`${PLUGIN_NAME} error: ${error.message}`);
    }
    
    // Emit error event
    this.eventBus.emit('plugin:error', {
      source,
      error,
      timestamp: Date.now()
    });
  }
  
  /**
   * Called when external settings change (e.g., from Obsidian Sync).
   * This is an optional method from Obsidian's Plugin class.
   */
  onExternalSettingsChange(): void {
    this.debug('External settings change detected');
    
    // Reload settings
    this.loadData().then((data: any) => {
      // Update settings
      if (this.settingsService) {
        this.settingsService.getSettingsManager().updateSettings(data);
      }
    }).catch((error: any) => {
      console.error('Failed to load external settings:', error);
    });
  }
}
