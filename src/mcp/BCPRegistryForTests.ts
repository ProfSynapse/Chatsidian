/**
 * BCP Registry For Tests - Test wrapper for BCPRegistry
 * 
 * This is a test-specific wrapper around BCPRegistry that provides
 * access to the functionality needed for testing. It does not extend
 * BCPRegistry but instead wraps it and delegates to it.
 */

import { App, Component, Notice, Events } from 'obsidian';
import { SettingsManager } from '../core/SettingsManager';
import { VaultFacade } from '../core/VaultFacade';
import { BoundedContextPack, Tool, BCPMetadata } from './interfaces';
import { EventBus } from '../core/EventBus';
import { BCPRegistry } from './BCPRegistry';

/**
 * BCPRegistryForTests provides a testing interface for BCPRegistry
 */
export class BCPRegistryForTests {
  // The wrapped BCPRegistry instance
  private registry: BCPRegistry;
  
  // Internal collections for testing
  public packs: Map<string, BoundedContextPack> = new Map();
  public loadedPacks: Set<string> = new Set();
  public dependencies: Map<string, Set<string>> = new Map();
  public packComponents: Map<string, Component> = new Map();
  public events: Events = new Events();
  
  // App instance for testing
  private app: App;
  
  /**
   * Create a new BCPRegistryForTests
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
    // Create the wrapped registry
    this.registry = new BCPRegistry(app, settings, vaultFacade, eventBus);
    this.app = app;
    
    // Initialize System BCP
    this.registerSystemBCP();
  }
  
  /**
   * Register system BCP for testing
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
        }
      ],
      onload: async () => {
        console.log('System BCP loaded');
      },
      onunload: async () => {
        console.log('System BCP unloaded');
      }
    };
    
    // Register system BCP
    this.packs.set('System', systemBCP);
    this.loadedPacks.add('System');
  }
  
  /**
   * Mock onload for testing
   */
  async onload(): Promise<void> {
    // Call workspace.onLayoutReady
    if (typeof this.app.workspace.onLayoutReady === 'function') {
      this.app.workspace.onLayoutReady(() => {
        // This is the callback that would be called when the layout is ready
      });
    }
    
    // Discover packs
    await this.discoverPacks();
    
    return Promise.resolve();
  }
  
  /**
   * Mock onunload for testing
   */
  async onunload(): Promise<void> {
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
    
    return Promise.resolve();
  }
  
  /**
   * Add a child component
   * @param component - Component to add
   */
  addChild(component: Component): void {
    // Just a stub for testing
  }
  
  /**
   * Mock pack import for testing
   * @param domain - Domain name
   * @returns Mocked pack
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
   * Discover available packs
   * @returns Promise resolving when discovery is complete
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
    
    // Trigger event
    this.events.trigger('bcpRegistry:packRegistered', {
      domain: pack.domain,
      toolCount: pack.tools.length
    });
  }
  
  /**
   * Load auto-load packs from settings
   * @returns Promise resolving when auto-load packs are loaded
   */
  public async loadAutoLoadPacks(): Promise<void> {
    try {
      // Mock settings for testing
      const autoLoadBCPs = ['TestDomain'];
      
      // Load each auto-load pack
      for (const domain of autoLoadBCPs) {
        try {
          await this.loadPack(domain);
        } catch (error) {
          console.error(`Error auto-loading pack ${domain}:`, error);
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
      
      // Call pack's onload lifecycle method if it exists
      if (pack.onload) {
        await pack.onload();
      }
      
      // Mark as loaded
      this.loadedPacks.add(domain);
      
      // Trigger tools registered event
      this.events.trigger('bcpRegistry:packLoaded', {
        domain,
        tools: pack.tools
      });
      
      return { 
        loaded: domain, 
        status: 'loaded',
        dependencies: loadedDependencies.length > 0 ? loadedDependencies : undefined
      };
    } catch (error: any) {
      console.error(`Error loading pack ${domain}:`, error);
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
