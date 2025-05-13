/**
 * BCP Registry - Manages Bounded Context Packs
 * 
 * This class is responsible for managing the discovery, loading, and unloading
 * of Bounded Context Packs (BCPs) that provide domain-specific functionality
 * to the Chatsidian plugin.
 */

import { App, Component, Notice, debounce, Events } from 'obsidian';
import { SettingsManager } from '../core/SettingsManager';
import { VaultFacade } from '../core/VaultFacade';
import { BoundedContextPack, Tool, BCPMetadata } from './interfaces';
import { EventBus } from '../core/EventBus';

/**
 * BCPRegistry manages loading, unloading, and discovery of BCP modules
 * Extends Component for proper lifecycle management
 */
export class BCPRegistry extends Component {
  private app: App;
  private settings: SettingsManager;
  private vaultFacade: VaultFacade;
  private events: Events;
  private eventBus: EventBus;
  
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
   * @param eventBus - Event bus for plugin-wide events
   */
  constructor(
    app: App, 
    settings: SettingsManager,
    vaultFacade: VaultFacade,
    eventBus: EventBus
  ) {
    super();
    this.app = app;
    this.settings = settings;
    this.vaultFacade = vaultFacade;
    this.events = new Events();
    this.eventBus = eventBus;
    
    // Register for settings changes
    // Use arrow function to preserve 'this' context without needing bind
    this.registerEvent(
      this.eventBus.on('settings:updated', (settings) => this.handleSettingsChanged(settings))
    );
  }
  
  /**
   * Handle settings changed event
   * @param settings - New settings
   */
  private handleSettingsChanged(settings: any) {
    // Update auto-loaded BCPs if the setting has changed
    this.updateAutoLoadedBCPs();
  }
  
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
   * @public - Explicitly marked as public for testing
   */
  public async discoverPacks(): Promise<void> {
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
  public async updateAutoLoadedBCPs(): Promise<void> {
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
   * @public - Explicitly marked as public for testing
   */
  public mockPackImport(domain: string): BoundedContextPack {
    // This is a placeholder for actual dynamic imports
    const icons: Record<string, string> = {
      'NoteManager': 'file-text',
      'FolderManager': 'folder',
      'VaultLibrarian': 'search',
      'PaletteCommander': 'command'
    };

    const icon = domain in icons ? icons[domain] : 'package';
    
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
   * @public - Explicitly marked as public for testing
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
  }
  
  /**
   * Register system BCP for managing BCPs
   */
  public registerSystemBCP(): void {
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
   * @public - Explicitly marked as public for testing
   */
  public async loadAutoLoadPacks(): Promise<void> {
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
      if (!pack) {
        throw new Error(`BCP ${domain} found in registry but pack is undefined`);
      }
      
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
          // Register the tool handler with the pack component
          // so it gets cleaned up properly when unloaded
          packComponent.register(() => {
            // Cleanup logic when component is unloaded
            console.log(`Tool ${tool.name} handler unregistered`);
          });
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
      
      return { 
        loaded: domain, 
        status: 'loaded',
        dependencies: loadedDependencies.length > 0 ? loadedDependencies : undefined
      };
    } catch (error: any) {
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
      if (!pack) {
        throw new Error(`BCP ${domain} found in registry but pack is undefined`);
      }
      
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
      
      return { 
        unloaded: domain, 
        status: 'unloaded',
        dependents: unloadedDependents.length > 0 ? unloadedDependents : undefined
      };
    } catch (error: any) {
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
