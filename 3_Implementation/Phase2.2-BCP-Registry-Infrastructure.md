---
title: Phase 2.2 - BCP Registry Infrastructure
description: Implementation plan for the Bounded Context Pack (BCP) registry system in Chatsidian
date: 2025-05-03
status: implementation
tags:
  - implementation
  - phase-2
  - bcp-registry
  - plugin-architecture
---

# Phase 2.2: BCP Registry Infrastructure

## Overview

This micro-phase focuses on designing and implementing the Bounded Context Pack (BCP) registry system. The BCP registry is responsible for managing the discovery, loading, and unloading of tool packs that provide domain-specific functionality to the Chatsidian plugin.

## Goals

- Define interfaces for BCPs and related components
- Create the core BCP registry infrastructure
- Implement BCP discovery and management
- Establish a system for dynamically loading and unloading BCPs
- Set up dependency management between BCPs

## Implementation Steps

### 1. Define BCP Interfaces

First, we'll define the core interfaces for BCPs and tools:

```typescript
/**
 * Interface for a Tool that can be called by AI assistants
 */
export interface Tool {
  /**
   * Name of the tool (without domain prefix)
   */
  name: string;
  
  /**
   * Human-readable description of the tool
   */
  description: string;
  
  /**
   * Function that implements the tool's functionality
   * @param params - Parameters passed to the tool
   * @param context - Execution context (available dependencies)
   * @returns Promise resolving to tool result
   */
  handler: (params: any, context?: any) => Promise<any>;
  
  /**
   * JSON Schema defining tool parameters
   */
  schema: any;
  
  /**
   * Optional icon for the tool (Obsidian icon ID)
   */
  icon?: string;
  
  /**
   * Optional display options for the tool
   */
  display?: {
    /**
     * Whether to show the tool in suggestions
     */
    showInSuggestions?: boolean;
    
    /**
     * Sort order for the tool in suggestions
     */
    sortOrder?: number;
  };
}

/**
 * Interface for a Bounded Context Pack (BCP) Component
 * This extends Obsidian's Component model for proper lifecycle management
 */
export interface BoundedContextPack {
  /**
   * Domain name for the pack (unique identifier)
   */
  domain: string;
  
  /**
   * Human-readable description of the pack
   */
  description: string;
  
  /**
   * Array of tools included in the pack
   */
  tools: Tool[];
  
  /**
   * Optional dependencies on other BCPs
   */
  dependencies?: string[];
  
  /**
   * Optional version number
   */
  version?: string;
  
  /**
   * Load handler - called when the BCP is loaded
   * Allows the BCP to perform initialization tasks
   */
  onload?: () => Promise<void>;
  
  /**
   * Unload handler - called when the BCP is unloaded
   * Allows the BCP to perform cleanup tasks
   */
  onunload?: () => Promise<void>;
}

/**
 * Interface for BCP metadata
 */
export interface BCPMetadata {
  domain: string;
  description: string;
  version?: string;
  toolCount: number;
  loaded: boolean;
  dependencies?: string[];
  icon?: string;
  
  /**
   * Status information
   */
  status?: {
    /**
     * Whether the BCP is a system BCP that cannot be unloaded
     */
    isSystem?: boolean;
    
    /**
     * Last loaded timestamp
     */
    loadedAt?: number;
    
    /**
     * Any active error
     */
    error?: string;
  };
}
```

### 2. Create BCP Registry Class

Next, implement the BCPRegistry that will manage BCPs:

```typescript
import { App, Component, Notice, debounce, Events } from 'obsidian';
import { SettingsManager } from '../core/SettingsManager';
import { VaultFacade } from '../core/VaultFacade';
import { BoundedContextPack, Tool, BCPMetadata } from './interfaces';

/**
 * BCPRegistry manages loading, unloading, and discovery of BCP modules
 * Extends Component for proper lifecycle management
 */
export class BCPRegistry extends Component {
  private app: App;
  private settings: SettingsManager;
  private vaultFacade: VaultFacade;
  private events: Events;
  
  // Collection of available packs (loaded or not)
  private packs: Map<string, BoundedContextPack> = new Map();
  
  // Track which packs are currently loaded
  private loadedPacks: Set<string> = new Set();
  
  // Track pack dependencies
  private dependencies: Map<string, Set<string>> = new Map();

  // Track pack components for proper lifecycle management
  private packComponents: Map<string, Component> = new Map();
  
  /**
   * Create a new BCPRegistry
   * @param app - Obsidian App instance
   * @param settings - Settings manager
   * @param vaultFacade - VaultFacade for vault operations
   */
  constructor(
    app: App, 
    settings: SettingsManager,
    vaultFacade: VaultFacade
  ) {
    super();
    this.app = app;
    this.settings = settings;
    this.vaultFacade = vaultFacade;
    this.events = new Events();
    
    // Register for settings changes
    this.registerEvent(
      this.settings.on('settings:changed', this.handleSettingsChanged.bind(this))
    );
  }
  
  /**
   * Handle settings changed event
   * @param settings - New settings
   */
  private handleSettingsChanged = debounce((settings: any) => {
    // Update auto-loaded BCPs if the setting has changed
    this.updateAutoLoadedBCPs();
  }, 500);
  
  /**
   * Called when Component is loaded
   * Initialize the BCP registry
   */
  async onload(): Promise<void> {
    console.log('Initializing BCP Registry');
    
    try {
      // Discover available packs
      await this.discoverPacks();
      
      // Register system BCP
      this.registerSystemBCP();
      
      // Wait for workspace to be ready before loading BCPs
      this.app.workspace.onLayoutReady(async () => {
        // Auto-load configured packs
        await this.loadAutoLoadPacks();
        
        // Trigger initialization complete event
        this.events.trigger('bcpRegistry:initialized', {
          packCount: this.packs.size,
          loadedCount: this.loadedPacks.size
        });
        
        new Notice('BCP Registry initialized with ' + this.loadedPacks.size + ' packs');
      });
    } catch (error) {
      console.error('Error initializing BCP registry:', error);
      new Notice('Error initializing BCP registry: ' + error.message);
    }
  }
  
  /**
   * Called when Component is unloaded
   * Clean up all loaded BCPs
   */
  async onunload(): Promise<void> {
    console.log('Unloading BCP Registry');
    
    // Unload all BCPs except System
    const domains = Array.from(this.loadedPacks);
    
    for (const domain of domains) {
      // Skip System BCP
      if (domain === 'System') continue;
      
      try {
        await this.unloadPack(domain);
      } catch (error) {
        console.error(`Error unloading pack ${domain}:`, error);
      }
    }
    
    // Clear collections
    this.packs.clear();
    this.loadedPacks.clear();
    this.dependencies.clear();
    this.packComponents.clear();
  }
  
  /**
   * Register for events
   * @param callback - Event callback
   */
  on(name: string, callback: (data: any) => void): void {
    this.events.on(name, callback);
  }
  
  /**
   * Unregister from events
   * @param callback - Event callback
   */
  off(name: string, callback: (data: any) => void): void {
    this.events.off(name, callback);
  }
  
  /**
   * Discover available packs
   * @returns Promise resolving when discovery is complete
   */
  private async discoverPacks(): Promise<void> {
    try {
      // In a real implementation, we would discover packs from:
      // 1. Built-in packs (imported from code)
      // 2. Community packs (discovered from a directory)
      // 3. User-created packs (discovered from user space)
      
      // For this implementation, we'll focus on built-in packs:
      const builtInDomains = [
        'NoteManager',
        'FolderManager',
        'VaultLibrarian',
        'PaletteCommander'
      ];
      
      // Import each built-in pack
      for (const domain of builtInDomains) {
        try {
          // This would be replaced with actual dynamic imports
          // const packModule = await import(`../bcps/${domain}`);
          // const pack = packModule.default;
          
          // For now, we'll mock the import
          const pack = this.mockPackImport(domain);
          
          // Register the pack
          this.registerPack(pack);
          
          console.log(`Discovered built-in pack: ${domain}`);
        } catch (error) {
          console.error(`Error loading built-in pack ${domain}:`, error);
        }
      }
      
      // Trigger discovery complete event
      this.events.trigger('bcpRegistry:discoveryComplete', {
        packCount: this.packs.size
      });
    } catch (error) {
      console.error('Error discovering packs:', error);
      throw error;
    }
  }
  
  /**
   * Update auto-loaded BCPs based on current settings
   */
  private async updateAutoLoadedBCPs(): Promise<void> {
    const settings = this.settings.getSettings();
    const autoLoadBCPs = settings.autoLoadBCPs || [];
    
    // Unload BCPs that are no longer in auto-load list
    for (const domain of this.loadedPacks) {
      // Skip System BCP
      if (domain === 'System') continue;
      
      if (!autoLoadBCPs.includes(domain)) {
        try {
          await this.unloadPack(domain);
        } catch (error) {
          console.error(`Error unloading pack ${domain}:`, error);
        }
      }
    }
    
    // Load new auto-load BCPs
    for (const domain of autoLoadBCPs) {
      try {
        if (!this.loadedPacks.has(domain)) {
          await this.loadPack(domain);
        }
      } catch (error) {
        console.error(`Error auto-loading pack ${domain}:`, error);
      }
    }
  }
  
  /**
   * Mock pack import (would be replaced with actual imports)
   * @param domain - Domain name
   * @returns Mocked pack
   */
  private mockPackImport(domain: string): BoundedContextPack {
    // This is a placeholder for actual dynamic imports
    const icons = {
      'NoteManager': 'file-text',
      'FolderManager': 'folder',
      'VaultLibrarian': 'search',
      'PaletteCommander': 'command'
    };

    const icon = icons[domain] || 'package';
    
    return {
      domain,
      description: `${domain} operations for Obsidian`,
      tools: [
        {
          name: 'exampleTool',
          description: 'Example tool',
          icon: icon,
          handler: async (params: any) => {
            return { success: true, params };
          },
          schema: {
            type: 'object',
            properties: {
              example: {
                type: 'string'
              }
            }
          }
        }
      ],
      // Add lifecycle methods
      onload: async () => {
        console.log(`${domain} loaded`);
      },
      onunload: async () => {
        console.log(`${domain} unloaded`);
      }
    };
  }
  
  /**
   * Register a pack
   * @param pack - Pack to register
   */
  public registerPack(pack: BoundedContextPack): void {
    // Validate pack
    if (!pack.domain) {
      throw new Error('Pack domain is required');
    }
    
    if (!pack.tools || !Array.isArray(pack.tools)) {
      throw new Error('Pack tools must be an array');
    }
    
    // Register pack
    this.packs.set(pack.domain, pack);
    
    // Register dependencies
    if (pack.dependencies && Array.isArray(pack.dependencies)) {
      this.dependencies.set(pack.domain, new Set(pack.dependencies));
    }
    
    // Create a Component for the pack for lifecycle management
    const packComponent = new Component();
    this.packComponents.set(pack.domain, packComponent);
    
    // Add packComponent as a child of this component
    this.addChild(packComponent);
    
    // Trigger event
    this.events.trigger('bcpRegistry:packRegistered', {
      domain: pack.domain,
      toolCount: pack.tools.length
    });
    
    // User feedback
    new Notice(`BCP ${pack.domain} registered`);
  }
  
  /**
   * Register system BCP for managing BCPs
   */
  private registerSystemBCP(): void {
    const systemBCP: BoundedContextPack = {
      domain: 'System',
      description: 'System operations for BCP management',
      tools: [
        {
          name: 'listBCPs',
          description: 'List all available BCPs',
          icon: 'list',
          handler: async () => this.listPacksDetailed(),
          schema: {}
        },
        {
          name: 'loadBCP',
          description: 'Load a BCP by domain',
          icon: 'download',
          handler: async (params: { domain: string }) => this.loadPack(params.domain),
          schema: {
            type: 'object',
            required: ['domain'],
            properties: {
              domain: {
                type: 'string',
                description: 'Domain of the BCP to load'
              }
            }
          }
        },
        {
          name: 'unloadBCP',
          description: 'Unload a BCP by domain',
          icon: 'x',
          handler: async (params: { domain: string }) => this.unloadPack(params.domain),
          schema: {
            type: 'object',
            required: ['domain'],
            properties: {
              domain: {
                type: 'string',
                description: 'Domain of the BCP to unload'
              }
            }
          }
        }
      ],
      // Add lifecycle methods for System BCP
      onload: async () => {
        console.log('System BCP loaded');
      },
      onunload: async () => {
        console.log('System BCP unloaded');
      }
    };
    
    // Register system BCP
    this.registerPack(systemBCP);
    
    // System BCP is always loaded
    this.loadedPacks.add('System');
    
    // Trigger event
    this.events.trigger('bcpRegistry:systemBCPRegistered');
  }
  
  /**
   * Load auto-load packs from settings
   * @returns Promise resolving when auto-load packs are loaded
   */
  private async loadAutoLoadPacks(): Promise<void> {
    try {
      const settings = this.settings.getSettings();
      const autoLoadBCPs = settings.autoLoadBCPs || [];
      
      // Load each auto-load pack
      for (const domain of autoLoadBCPs) {
        try {
          await this.loadPack(domain);
        } catch (error) {
          console.error(`Error auto-loading pack ${domain}:`, error);
          new Notice(`Error loading BCP ${domain}: ${error.message}`);
        }
      }
      
      // Trigger event
      this.events.trigger('bcpRegistry:autoLoadComplete', {
        loadedCount: this.loadedPacks.size
      });
    } catch (error) {
      console.error('Error loading auto-load packs:', error);
      throw error;
    }
  }
  
  /**
   * Load a pack by domain
   * @param domain - Domain name
   * @returns Promise resolving to load result
   */
  public async loadPack(domain: string): Promise<{
    loaded: string;
    status: string;
    dependencies?: string[];
  }> {
    try {
      // Check if pack exists
      if (!this.packs.has(domain)) {
        throw new Error(`BCP ${domain} not found`);
      }
      
      // Check if already loaded
      if (this.loadedPacks.has(domain)) {
        return { 
          loaded: domain, 
          status: 'already-loaded' 
        };
      }
      
      // Get pack
      const pack = this.packs.get(domain);
      
      // Load dependencies first
      const dependencies = this.dependencies.get(domain);
      const loadedDependencies: string[] = [];
      
      if (dependencies && dependencies.size > 0) {
        for (const dependency of dependencies) {
          // Skip if already loaded
          if (this.loadedPacks.has(dependency)) {
            continue;
          }
          
          // Load dependency
          await this.loadPack(dependency);
          loadedDependencies.push(dependency);
        }
      }
      
      // Create context for tools
      const context = {
        vaultFacade: this.vaultFacade,
        settings: this.settings,
        app: this.app
      };
      
      // Call pack's onload lifecycle method if it exists
      if (pack.onload) {
        await pack.onload();
      }
      
      // Register DOM event handlers or other event listeners for the pack
      const packComponent = this.packComponents.get(domain);
      if (packComponent) {
        // Activate the pack component to initialize it
        packComponent.load();
        
        // Register event handlers from the pack
        for (const tool of pack.tools) {
          // For tool-specific setup, we might register handlers, etc.
          if (tool.handler) {
            // Register the tool handler with the pack component
            // so it gets cleaned up properly when unloaded
            packComponent.register(() => {
              // Cleanup logic when component is unloaded
              console.log(`Tool ${tool.name} handler unregistered`);
            });
          }
        }
      }
      
      // Mark as loaded
      this.loadedPacks.add(domain);
      
      // Trigger tools registered event
      this.events.trigger('bcpRegistry:packLoaded', {
        domain,
        tools: pack.tools,
        context
      });
      
      // User feedback
      new Notice(`BCP ${domain} loaded successfully`);
      
      return { 
        loaded: domain, 
        status: 'loaded',
        dependencies: loadedDependencies.length > 0 ? loadedDependencies : undefined
      };
    } catch (error) {
      console.error(`Error loading pack ${domain}:`, error);
      new Notice(`Error loading BCP ${domain}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Unload a pack by domain
   * @param domain - Domain name
   * @returns Promise resolving to unload result
   */
  public async unloadPack(domain: string): Promise<{
    unloaded: string;
    status: string;
    dependents?: string[];
  }> {
    try {
      // Check if pack exists
      if (!this.packs.has(domain)) {
        throw new Error(`BCP ${domain} not found`);
      }
      
      // Check if loaded
      if (!this.loadedPacks.has(domain)) {
        return { 
          unloaded: domain, 
          status: 'not-loaded' 
        };
      }
      
      // Prevent unloading System BCP
      if (domain === 'System') {
        throw new Error('Cannot unload System BCP');
      }
      
      // Check for dependent packs
      const dependents = this.getDependentPacks(domain);
      
      // Unload dependents first
      const unloadedDependents: string[] = [];
      
      for (const dependent of dependents) {
        // Skip if not loaded
        if (!this.loadedPacks.has(dependent)) {
          continue;
        }
        
        // Unload dependent
        await this.unloadPack(dependent);
        unloadedDependents.push(dependent);
      }
      
      // Get pack
      const pack = this.packs.get(domain);
      
      // Call pack's onunload lifecycle method if it exists
      if (pack.onunload) {
        await pack.onunload();
      }
      
      // Unload the pack component to clean up event handlers
      const packComponent = this.packComponents.get(domain);
      if (packComponent) {
        packComponent.unload();
      }
      
      // Mark as unloaded
      this.loadedPacks.delete(domain);
      
      // Trigger tools unregistered event
      this.events.trigger('bcpRegistry:packUnloaded', {
        domain
      });
      
      // User feedback
      new Notice(`BCP ${domain} unloaded`);
      
      return { 
        unloaded: domain, 
        status: 'unloaded',
        dependents: unloadedDependents.length > 0 ? unloadedDependents : undefined
      };
    } catch (error) {
      console.error(`Error unloading pack ${domain}:`, error);
      new Notice(`Error unloading BCP ${domain}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get packs that depend on a given pack
   * @param domain - Domain name
   * @returns Array of dependent pack domains
   */
  private getDependentPacks(domain: string): string[] {
    const dependents: string[] = [];
    
    for (const [packDomain, dependencies] of this.dependencies.entries()) {
      if (dependencies.has(domain)) {
        dependents.push(packDomain);
      }
    }
    
    return dependents;
  }
  
  /**
   * List available packs with metadata
   * @returns Array of pack metadata
   */
  public listPacks(): BCPMetadata[] {
    return Array.from(this.packs.entries()).map(([domain, pack]) => {
      // Find first tool with an icon to use as pack icon
      const icon = pack.tools.find(tool => tool.icon)?.icon;
      
      return {
        domain,
        description: pack.description,
        version: pack.version,
        toolCount: pack.tools.length,
        loaded: this.loadedPacks.has(domain),
        dependencies: pack.dependencies,
        icon: icon,
        status: {
          isSystem: domain === 'System',
          loadedAt: this.loadedPacks.has(domain) ? Date.now() : undefined
        }
      };
    });
  }
  
  /**
   * List available packs with detailed information
   * @returns Detailed pack listing
   */
  public listPacksDetailed(): {
    packs: BCPMetadata[];
    total: number;
    loaded: number;
  } {
    const packs = this.listPacks();
    
    return {
      packs,
      total: packs.length,
      loaded: this.loadedPacks.size
    };
  }
  
  /**
   * Get a pack by domain
   * @param domain - Domain name
   * @returns Pack or undefined
   */
  public getPack(domain: string): BoundedContextPack | undefined {
    return this.packs.get(domain);
  }
  
  /**
   * Check if a pack is loaded
   * @param domain - Domain name
   * @returns Whether pack is loaded
   */
  public isPackLoaded(domain: string): boolean {
    return this.loadedPacks.has(domain);
  }
  
  /**
   * Get loaded packs
   * @returns Array of loaded pack domains
   */
  public getLoadedPacks(): string[] {
    return Array.from(this.loadedPacks);
  }
  
  /**
   * Get loaded tools
   * @returns Array of all tools from loaded packs
   */
  public getLoadedTools(): Tool[] {
    const tools: Tool[] = [];
    
    for (const domain of this.loadedPacks) {
      const pack = this.packs.get(domain);
      
      if (pack) {
        tools.push(...pack.tools.map(tool => ({
          ...tool,
          // Add domain prefix to name
          name: `${domain}.${tool.name}`
        })));
      }
    }
    
    return tools;
  }
  
  /**
   * Get a pack component
   * @param domain - Domain name
   * @returns Component or undefined
   */
  public getPackComponent(domain: string): Component | undefined {
    return this.packComponents.get(domain);
  }
  
  /**
   * Check if a tool exists
   * @param toolId - Tool ID (domain.name)
   * @returns Whether tool exists
   */
  public hasToolById(toolId: string): boolean {
    const [domain, name] = toolId.split('.');
    
    if (!domain || !name) {
      return false;
    }
    
    const pack = this.packs.get(domain);
    
    if (!pack) {
      return false;
    }
    
    return pack.tools.some(tool => tool.name === name);
  }
  
  /**
   * Get a tool by ID
   * @param toolId - Tool ID (domain.name)
   * @returns Tool or undefined
   */
  public getToolById(toolId: string): Tool | undefined {
    const [domain, name] = toolId.split('.');
    
    if (!domain || !name) {
      return undefined;
    }
    
    const pack = this.packs.get(domain);
    
    if (!pack) {
      return undefined;
    }
    
    return pack.tools.find(tool => tool.name === name);
  }
}
```

### 3. Implement Dynamic BCP Loading

Create a mechanism for dynamically loading BCP modules:

```typescript
/**
 * Load a BCP module dynamically
 * @param domain - Domain name
 * @param context - Context to provide to the BCP
 * @returns Promise resolving to the BCP
 */
export async function loadBCPModule(
  domain: string,
  context: any
): Promise<BoundedContextPack> {
  try {
    // In a production environment, this would be a dynamic import
    // const module = await import(`../bcps/${domain}`);
    // return module.default(context);
    
    // Add timestamp and request ID for debugging
    const requestId = Math.random().toString(36).substring(2, 15);
    console.log(`[${requestId}] Loading BCP module ${domain} at ${new Date().toISOString()}`);
    
    // For development, we can use a switch with proper error handling
    let pack: BoundedContextPack;
    
    try {
      switch (domain) {
        case 'NoteManager':
          // Import NoteManager module
          const NoteManagerModule = await import('../bcps/NoteManager');
          pack = NoteManagerModule.default(context);
          break;
          
        case 'FolderManager':
          // Import FolderManager module
          const FolderManagerModule = await import('../bcps/FolderManager');
          pack = FolderManagerModule.default(context);
          break;
          
        case 'VaultLibrarian':
          // Import VaultLibrarian module
          const VaultLibrarianModule = await import('../bcps/VaultLibrarian');
          pack = VaultLibrarianModule.default(context);
          break;
          
        case 'PaletteCommander':
          // Import PaletteCommander module
          const PaletteCommanderModule = await import('../bcps/PaletteCommander');
          pack = PaletteCommanderModule.default(context);
          break;
          
        default:
          throw new Error(`Unknown BCP domain: ${domain}`);
      }
      
      console.log(`[${requestId}] Successfully loaded BCP module ${domain}`);
      
      // Ensure pack has required properties
      if (!pack.domain) {
        pack.domain = domain;
      }
      
      if (!pack.tools) {
        pack.tools = [];
      }
      
      // Add default lifecycle methods if not provided
      if (!pack.onload) {
        pack.onload = async () => {
          console.log(`${domain} loaded (default handler)`);
        };
      }
      
      if (!pack.onunload) {
        pack.onunload = async () => {
          console.log(`${domain} unloaded (default handler)`);
        };
      }
      
      return pack;
    } catch (error) {
      console.error(`[${requestId}] Error in import for BCP module ${domain}:`, error);
      
      // Create a fallback error-displaying BCP
      return {
        domain,
        description: `Error loading ${domain}: ${error.message}`,
        tools: [{
          name: 'error',
          description: `Error loading ${domain}`,
          icon: 'alert-triangle',
          handler: async () => ({ error: error.message }),
          schema: {}
        }],
        onload: async () => {
          console.error(`Error BCP for ${domain} loaded`);
          new Notice(`Error loading BCP ${domain}: ${error.message}`, 10000);
        },
        onunload: async () => {
          console.log(`Error BCP for ${domain} unloaded`);
        }
      };
    }
  } catch (error) {
    console.error(`Error in loadBCPModule for ${domain}:`, error);
    throw error;
  }
}
```

### 4. Update Plugin Core for BCP Registry

Modify the main plugin class to set up the BCP registry:

```typescript
import { App, Component, Notice, Plugin, debounce } from 'obsidian';
import { SettingsManager } from './core/SettingsManager';
import { VaultFacade } from './core/VaultFacade';
import { BCPRegistry } from './mcp/BCPRegistry';

/**
 * Context provided to BCPs
 */
export interface BCPContext {
  /**
   * Obsidian App instance
   */
  app: App;
  
  /**
   * Vault facade for vault operations
   */
  vaultFacade: VaultFacade;
  
  /**
   * Settings manager
   */
  settings: SettingsManager;
  
  /**
   * Parent component for lifecycle management
   */
  parent?: Component;
}

/**
 * Factory function for creating BCPs
 * @param context - Context provided to the BCP
 * @returns Bounded Context Pack
 */
export type BCPFactory = (context: BCPContext) => BoundedContextPack;

export default class ChatsidianPlugin extends Plugin {
  public settings: SettingsManager;
  public vaultFacade: VaultFacade;
  public bcpRegistry: BCPRegistry;
  
  async onload() {
    console.log('Loading Chatsidian plugin');
    
    // Initialize settings - using Component pattern
    this.settings = new SettingsManager(this.app);
    this.addChild(this.settings);
    await this.settings.load();
    
    // Initialize vault facade - using Component pattern
    this.vaultFacade = new VaultFacade(this.app);
    this.addChild(this.vaultFacade);
    
    // Initialize BCP registry - using Component pattern
    this.bcpRegistry = new BCPRegistry(
      this.app, 
      this.settings,
      this.vaultFacade
    );
    this.addChild(this.bcpRegistry);
    
    // Register commands
    this.addCommands();
    
    // Initialize ribbon icon for BCP management
    this.addRibbonBCPIcon();
    
    // Show startup notice
    new Notice('Chatsidian plugin loaded', 2000);
  }
  
  /**
   * Add commands to the command palette
   */
  private addCommands() {
    // Add command to list BCPs
    this.addCommand({
      id: 'list-bcps',
      name: 'List BCPs',
      callback: () => {
        const bcps = this.bcpRegistry.listPacks();
        new Notice(`Loaded BCPs: ${this.bcpRegistry.getLoadedPacks().join(', ')}`, 5000);
      }
    });
    
    // Add command to reload BCPs
    this.addCommand({
      id: 'reload-bcps',
      name: 'Reload BCPs',
      callback: async () => {
        // Unload all BCPs
        const loadedPacks = this.bcpRegistry.getLoadedPacks();
        for (const domain of loadedPacks) {
          if (domain !== 'System') {
            await this.bcpRegistry.unloadPack(domain);
          }
        }
        
        // Reload auto-load BCPs
        const settings = this.settings.getSettings();
        const autoLoadBCPs = settings.autoLoadBCPs || [];
        for (const domain of autoLoadBCPs) {
          await this.bcpRegistry.loadPack(domain);
        }
        
        new Notice('BCPs reloaded', 2000);
      }
    });
  }
  
  /**
   * Add ribbon icon for BCP management
   */
  private addRibbonBCPIcon() {
    const ribbonIcon = this.addRibbonIcon(
      'package',
      'Chatsidian BCPs',
      (evt) => {
        const bcps = this.bcpRegistry.listPacks();
        const loadedCount = this.bcpRegistry.getLoadedPacks().length;
        
        // Show notification with BCP stats
        new Notice(`BCPs: ${bcps.length} total, ${loadedCount} loaded`, 3000);
      }
    );
    
    // Add classes for styling
    ribbonIcon.addClass('chatsidian-bcp-icon');
  }
  
  /**
   * Called when plugin is unloaded
   * Component cleanup is handled automatically
   */
  onunload() {
    console.log('Unloading Chatsidian plugin');
    
    // Plugin.onunload will automatically unload all child components
    // including vaultFacade and bcpRegistry
    
    new Notice('Chatsidian plugin unloaded', 2000);
  }
  
  /**
   * Create an example BCP
   * @returns Bounded Context Pack
   */
  public createExampleBCP(): BoundedContextPack {
    const context: BCPContext = {
      app: this.app,
      vaultFacade: this.vaultFacade,
      settings: this.settings,
      parent: this.bcpRegistry
    };
    
    return {
      domain: 'Example',
      description: 'Example BCP',
      tools: [
        {
          name: 'hello',
          description: 'Say hello',
          icon: 'message-circle',
          handler: async (params: { name: string }) => {
            return { message: `Hello, ${params.name}!` };
          },
          schema: {
            type: 'object',
            required: ['name'],
            properties: {
              name: {
                type: 'string',
                description: 'Name to greet'
              }
            }
          }
        }
      ],
      onload: async () => {
        console.log('Example BCP loaded');
        // Any setup code here
      },
      onunload: async () => {
        console.log('Example BCP unloaded');
        // Any cleanup code here
      }
    };
  }
}
```

### 5. Define BCP Factory Structure

Create a standard structure for BCP factory functions:

```typescript
/**
 * Factory function for creating BCPs
 * @param context - Context provided to the BCP
 * @returns Bounded Context Pack
 */
export type BCPFactory = (context: BCPContext) => BoundedContextPack;

/**
 * Context provided to BCPs
 */
export interface BCPContext {
  /**
   * Vault facade for vault operations
   */
  vaultFacade: VaultFacade;
  
  /**
   * Event bus for communication
   */
  eventBus: EventBus;
  
  /**
   * Settings manager
   */
  settings: SettingsManager;
}

/**
 * Example BCP factory
 * @param context - BCP context
 * @returns Bounded Context Pack
 */
export function createExampleBCP(context: BCPContext): BoundedContextPack {
  const { vaultFacade, eventBus, settings } = context;
  
  return {
    domain: 'Example',
    description: 'Example BCP',
    tools: [
      {
        name: 'hello',
        description: 'Say hello',
        handler: async (params: { name: string }) => {
          return { message: `Hello, ${params.name}!` };
        },
        schema: {
          type: 'object',
          required: ['name'],
          properties: {
            name: {
              type: 'string',
              description: 'Name to greet'
            }
          }
        }
      }
    ]
  };
}
```

## Documentation References

- [[💻 Coding/Projects/Chatsidian/1_Architecture/Overview]]
- [[💻 Coding/Projects/Chatsidian/1_Architecture/Components/VaultFacade]]
- [[💻 Coding/Projects/Chatsidian/4_Documentation/APIs]]
- [[💻 Coding/Projects/Chatsidian/3_Implementation/Phase2.1-VaultFacade-Foundation]]

## Testing Strategy

- Unit tests for the BCPRegistry component lifecycle
  - Test proper registration of event handlers
  - Test cleanup during component unloading
  - Test parent-child component relationships
- Integration tests with Obsidian's Component model
  - Verify Component lifecycle hooks are called correctly
  - Test proper event propagation through the component hierarchy
  - Test that child components are loaded/unloaded appropriately
- Test BCP loading and unloading with complete lifecycle handling
  - Verify onload and onunload methods are called
  - Test proper cleanup of resources during unload
  - Test that pack components are properly initialized and cleaned up
- Test dependency management
  - Test automatic loading of dependencies
  - Test prevention of circular dependencies
  - Test handling of missing dependencies
- Test tool registration and execution
  - Verify tools are properly registered with domain prefixes
  - Test tool handler execution with appropriate context
  - Test error handling during tool execution
- Performance tests for BCP operations
  - Measure initialization time
  - Test performance with many BCPs and tools
  - Verify startup performance in real Obsidian environment

## Next Steps

Phase 2.3 will focus on implementing the Tool Manager, which will work in conjunction with the BCP Registry. The Tool Manager will be responsible for executing tools and handling parameter validation, following the Obsidian Component pattern we've established.

The Tool Manager will:
1. Register as a child component of the main plugin
2. Subscribe to BCP registry events for tool registration/unregistration
3. Provide a consistent interface for tool execution
4. Implement proper error handling and user feedback via Notices
5. Support parameter validation based on JSON Schema
6. Handle tool execution context with proper lifecycle management

With both the VaultFacade and BCPRegistry now properly aligned with Obsidian's Component model, the Tool Manager will complete our core infrastructure for tool execution and BCP management, providing a robust foundation for the rest of the plugin. registry to execute tools and handle parameter validation.
