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
}

/**
 * Interface for a Bounded Context Pack (BCP)
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
}
```

### 2. Create BCP Registry Class

Next, implement the BCPRegistry that will manage BCPs:

```typescript
import { App } from 'obsidian';
import { EventBus } from '../core/EventBus';
import { SettingsManager } from '../core/SettingsManager';
import { VaultFacade } from '../core/VaultFacade';
import { BoundedContextPack, Tool, BCPMetadata } from './interfaces';

/**
 * BCPRegistry manages loading, unloading, and discovery of BCP modules
 */
export class BCPRegistry {
  private app: App;
  private eventBus: EventBus;
  private settings: SettingsManager;
  private vaultFacade: VaultFacade;
  
  // Collection of available packs (loaded or not)
  private packs: Map<string, BoundedContextPack> = new Map();
  
  // Track which packs are currently loaded
  private loadedPacks: Set<string> = new Set();
  
  // Track pack dependencies
  private dependencies: Map<string, Set<string>> = new Map();
  
  /**
   * Create a new BCPRegistry
   * @param app - Obsidian App instance
   * @param eventBus - EventBus for communication
   * @param settings - Settings manager
   * @param vaultFacade - VaultFacade for vault operations
   */
  constructor(
    app: App, 
    eventBus: EventBus, 
    settings: SettingsManager,
    vaultFacade: VaultFacade
  ) {
    this.app = app;
    this.eventBus = eventBus;
    this.settings = settings;
    this.vaultFacade = vaultFacade;
  }
  
  /**
   * Initialize the BCP registry
   * @returns Promise resolving when initialization is complete
   */
  public async initialize(): Promise<void> {
    try {
      // Discover available packs
      await this.discoverPacks();
      
      // Register system BCP
      this.registerSystemBCP();
      
      // Auto-load configured packs
      await this.loadAutoLoadPacks();
      
      // Emit initialization complete event
      this.eventBus.emit('bcpRegistry:initialized', {
        packCount: this.packs.size,
        loadedCount: this.loadedPacks.size
      });
    } catch (error) {
      console.error('Error initializing BCP registry:', error);
      throw error;
    }
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
      
      // Emit discovery complete event
      this.eventBus.emit('bcpRegistry:discoveryComplete', {
        packCount: this.packs.size
      });
    } catch (error) {
      console.error('Error discovering packs:', error);
      throw error;
    }
  }
  
  /**
   * Mock pack import (would be replaced with actual imports)
   * @param domain - Domain name
   * @returns Mocked pack
   */
  private mockPackImport(domain: string): BoundedContextPack {
    // This is a placeholder for actual dynamic imports
    return {
      domain,
      description: `${domain} operations for Obsidian`,
      tools: [
        {
          name: 'exampleTool',
          description: 'Example tool',
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
      ]
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
    
    // Emit event
    this.eventBus.emit('bcpRegistry:packRegistered', {
      domain: pack.domain,
      toolCount: pack.tools.length
    });
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
          handler: async () => this.listPacksDetailed(),
          schema: {}
        },
        {
          name: 'loadBCP',
          description: 'Load a BCP by domain',
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
      ]
    };
    
    // Register system BCP
    this.registerPack(systemBCP);
    
    // System BCP is always loaded
    this.loadedPacks.add('System');
    
    // Emit event
    this.eventBus.emit('bcpRegistry:systemBCPRegistered');
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
        }
      }
      
      // Emit event
      this.eventBus.emit('bcpRegistry:autoLoadComplete', {
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
      
      // Mark as loaded
      this.loadedPacks.add(domain);
      
      // Create context for tools
      const context = {
        vaultFacade: this.vaultFacade,
        eventBus: this.eventBus,
        settings: this.settings
      };
      
      // Emit tools registered event
      this.eventBus.emit('bcpRegistry:packLoaded', {
        domain,
        tools: pack.tools,
        context
      });
      
      return { 
        loaded: domain, 
        status: 'loaded',
        dependencies: loadedDependencies.length > 0 ? loadedDependencies : undefined
      };
    } catch (error) {
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
      
      // Mark as unloaded
      this.loadedPacks.delete(domain);
      
      // Emit tools unregistered event
      this.eventBus.emit('bcpRegistry:packUnloaded', {
        domain
      });
      
      return { 
        unloaded: domain, 
        status: 'unloaded',
        dependents: unloadedDependents.length > 0 ? unloadedDependents : undefined
      };
    } catch (error) {
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
    return Array.from(this.packs.entries()).map(([domain, pack]) => ({
      domain,
      description: pack.description,
      version: pack.version,
      toolCount: pack.tools.length,
      loaded: this.loadedPacks.has(domain),
      dependencies: pack.dependencies
    }));
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
    
    // For development, we can use a switch
    let pack: BoundedContextPack;
    
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
    
    return pack;
  } catch (error) {
    console.error(`Error loading BCP module ${domain}:`, error);
    throw error;
  }
}
```

### 4. Update Plugin Core for BCP Registry

Modify the main plugin class to set up the BCP registry:

```typescript
import { Plugin } from 'obsidian';
import { EventBus } from './core/EventBus';
import { SettingsManager } from './core/SettingsManager';
import { VaultFacade } from './core/VaultFacade';
import { BCPRegistry } from './mcp/BCPRegistry';

export default class ChatsidianPlugin extends Plugin {
  public eventBus: EventBus;
  public settings: SettingsManager;
  public vaultFacade: VaultFacade;
  public bcpRegistry: BCPRegistry;
  
  async onload() {
    console.log('Loading Chatsidian plugin');
    
    // Initialize event bus
    this.eventBus = new EventBus();
    
    // Initialize settings
    this.settings = new SettingsManager(this.app, this.eventBus);
    await this.settings.load();
    
    // Initialize vault facade
    this.vaultFacade = new VaultFacade(this.app, this.eventBus);
    
    // Initialize BCP registry
    this.bcpRegistry = new BCPRegistry(
      this.app, 
      this.eventBus, 
      this.settings,
      this.vaultFacade
    );
    await this.bcpRegistry.initialize();
    
    // Register event handlers
    this.registerEvents();
    
    console.log('Chatsidian plugin loaded');
  }
  
  private registerEvents() {
    // Log BCP events in debug mode
    if (this.settings.getSettings().debugMode) {
      this.eventBus.on('bcpRegistry:packLoaded', data => {
        console.log(`Pack loaded: ${data.domain} with ${data.tools.length} tools`);
      });
      
      this.eventBus.on('bcpRegistry:packUnloaded', data => {
        console.log(`Pack unloaded: ${data.domain}`);
      });
      
      // Register other event handlers...
    }
  }
  
  onunload() {
    // Clean up resources
    this.eventBus.clear();
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

- Unit tests for the BCP registry
- Test loading and unloading of packs
- Test dependency management
- Test tool registration

## Next Steps

Phase 2.3 will focus on implementing the Tool Manager, which will work in conjunction with the BCP registry to execute tools and handle parameter validation.
