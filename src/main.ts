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
import { Plugin, WorkspaceLeaf } from 'obsidian';
import { EventBus } from './core/EventBus';
import { EventBusFactory } from './core/EventBusFactory';
import { SettingsManager, ChatsidianSettingTab } from './core/SettingsManager';
import { SettingsService } from './services/SettingsService';
import { StorageService } from './services/StorageService';
import { ProviderService } from './services/ProviderService';
import { VaultFacade } from './core/VaultFacade';
import { BCPRegistry } from './mcp/BCPRegistry';
import { ToolManager } from './mcp/ToolManager';
import { MCPClient } from './mcp/client/MCPClient';
import { AgentSystem } from './agents/AgentSystem';
import { A2AAgentSystemIntegration } from './a2a/integration/AgentSystemIntegration';
import { ChatView } from './ui/ChatView';

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
   * VaultFacade for vault operations
   */
  vaultFacade: VaultFacade;
  
  /**
   * BCP Registry for managing Bounded Context Packs
   */
  bcpRegistry: BCPRegistry;
  
  /**
   * Tool Manager for managing tools
   */
  toolManager: ToolManager;
  
  /**
   * MCP Client for communicating with AI providers
   */
  mcpClient: MCPClient;
  
  /**
   * Agent System for managing agents
   */
  agentSystem: AgentSystem;
  
  /**
   * A2A Agent System Integration for A2A protocol support
   */
  a2aIntegration: A2AAgentSystemIntegration;

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
    
    // Register settings tab
    this.addSettingTab(new ChatsidianSettingTab(this.app, this));
    
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
    
    // Initialize VaultFacade - using Component pattern
    this.vaultFacade = new VaultFacade(this.app);
    this.addChild(this.vaultFacade);
    
    // Initialize storage service with VaultFacade
    this.storageService = new StorageService(this.app, this, this.eventBus, this.settings);
    await this.storageService.initialize();
    
    // Initialize provider service
    this.providerService = new ProviderService(this.app, this.eventBus, this.settingsService);
    await this.providerService.initialize();
    
    // Initialize BCP Registry - using Component pattern
    this.bcpRegistry = new BCPRegistry(this.app, this.settings, this.vaultFacade, this.eventBus);
    this.addChild(this.bcpRegistry);
    
    // Initialize Tool Manager - using Component pattern
    this.toolManager = new ToolManager(this.app, this.bcpRegistry, this.eventBus);
    this.addChild(this.toolManager);
    
    // Initialize MCP Client - using Component pattern
    this.mcpClient = new MCPClient(this.app, this.settings, this.toolManager, this.eventBus);
    this.addChild(this.mcpClient);
    
    // Initialize Agent System - using Component pattern
    this.agentSystem = new AgentSystem(
      this.app,
      this.eventBus,
      this.settings,
      this.vaultFacade,
      this.bcpRegistry,
      this.toolManager
    );
    this.addChild(this.agentSystem);
    
    // Initialize A2A Agent System Integration
    this.a2aIntegration = new A2AAgentSystemIntegration(
      this.app,
      this.eventBus,
      this.agentSystem
    );
    
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
        this.activateChatView();
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
    
    // Command to list BCPs
    this.addCommand({
      id: 'list-bcps',
      name: 'List Bounded Context Packs',
      callback: () => {
        this.debug('List BCPs command triggered');
        const bcpInfo = this.bcpRegistry.listPacksDetailed();
        new Notice(`BCPs: ${bcpInfo.loaded} loaded of ${bcpInfo.total} available`);
      }
    });
    
    // Add ribbon icon
    this.addRibbonIcon('message-circle', PLUGIN_NAME, () => {
      this.debug('Ribbon icon clicked');
      this.activateChatView();
    });
    
    // Add BCP ribbon icon
    this.addRibbonIcon('package', 'Chatsidian BCPs', () => {
      this.debug('BCP ribbon icon clicked');
      const bcpInfo = this.bcpRegistry.listPacksDetailed();
      new Notice(`BCPs: ${bcpInfo.loaded} loaded of ${bcpInfo.total} available`);
    });
    
    // Add A2A command
    this.addCommand({
      id: 'initialize-a2a',
      name: 'Initialize A2A Protocol',
      callback: async () => {
        this.debug('Initialize A2A command triggered');
        try {
          await this.a2aIntegration.initialize();
          new Notice('A2A protocol initialized successfully');
        } catch (error: any) {
          console.error('Failed to initialize A2A protocol:', error);
          new Notice(`Failed to initialize A2A protocol: ${error.message}`);
        }
      }
    });
    
    this.debug('Commands registered');
  }
  
  /**
   * Register plugin views.
   */
  private registerViews(): void {
    // Register chat view
    this.registerView(
      VIEW_TYPE_CHAT,
      (leaf) => new ChatView(
        leaf, 
        this.eventBus, 
        this.storageService.getStorageManager(),
        this.settingsService,
        this.providerService,
        this.agentSystem
      )
    );
    
    // Load CSS styles
    this.loadStyles();
    
    this.debug('Views registered');
  }
  
  /**
   * Close any open views.
   */
  private closeViews(): void {
    // Close chat view
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_CHAT);
    
    this.debug('Views closed');
  }
  
  /**
   * Load CSS styles for the plugin.
   */
  private loadStyles(): void {
    // Add styles.css to the document
    const styleEl = document.createElement('link');
    styleEl.rel = 'stylesheet';
    styleEl.href = this.app.vault.adapter.getResourcePath('styles.css');
    document.head.appendChild(styleEl);
    
    // Trigger Style Settings plugin to parse our CSS variables
    // This allows users to customize the plugin appearance
    setTimeout(() => {
      this.app.workspace.trigger('parse-style-settings');
      this.debug('Style Settings triggered');
    }, 500);
    
    this.debug('Styles loaded');
  }
  
  /**
   * Activate the chat view.
   * Opens the chat view in a new leaf or focuses an existing one.
   */
  public async activateChatView(): Promise<void> {
    const { workspace } = this.app;
    
    try {
      // Check if view is already open
      let leaf = workspace.getLeavesOfType(VIEW_TYPE_CHAT)[0];
      
      if (!leaf) {
        // Create new leaf in right split
        const newLeaf = workspace.getRightLeaf(false);
        
        if (!newLeaf) {
          throw new Error('Could not create leaf for chat view');
        }
        
        // Set view state
        await newLeaf.setViewState({
          type: VIEW_TYPE_CHAT,
          active: true
        });
        
        leaf = newLeaf;
      }
      
      // Reveal leaf - at this point leaf should not be null
      workspace.revealLeaf(leaf);
      
      this.debug('Chat view activated');
    } catch (error) {
      this.debug('Failed to activate chat view:', error);
      new Notice('Failed to open chat view');
    }
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
      // Check if conversations folder exists using VaultFacade
      const folderExists = await this.vaultFacade.folderExists(conversationsFolder);
      
      if (!folderExists) {
        // Create folder if it doesn't exist
        await this.vaultFacade.createFolder(conversationsFolder);
        this.debug(`Created conversations folder: ${conversationsFolder}`);
      }
      
      // Create backups folder if it doesn't exist
      const backupsFolder = `${conversationsFolder}/backups`;
      const backupsFolderExists = await this.vaultFacade.folderExists(backupsFolder);
      
      if (!backupsFolderExists) {
        await this.vaultFacade.createFolder(backupsFolder);
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
