import { App, Events } from 'obsidian';
import { EventBus } from '../core/EventBus';
import { ToolManager } from './ToolManager';
import { BCPRegistry } from './BCPRegistry';
import { Tool, BoundedContextPack } from './interfaces';

/**
 * Enhanced ToolManager with discovery capabilities
 * Extends base ToolManager to add tool discovery and management features
 */
export class EnhancedToolManager extends ToolManager {
  /**
   * Map of tool names to schemas
   */
  private toolSchemas: Map<string, any> = new Map();
  
  /**
   * Store references to dependencies
   */
  private _eventBus: EventBus;
  private _bcpRegistry: BCPRegistry;
  
  /**
   * Create a new enhanced tool manager
   * @param app - Obsidian app instance
   * @param eventBus - Event bus for communication
   * @param bcpRegistry - BCP registry for tool discovery
   */
  constructor(app: App, eventBus: EventBus, bcpRegistry: BCPRegistry) {
    super(app, bcpRegistry, eventBus);
    
    // Store references
    this._eventBus = eventBus;
    this._bcpRegistry = bcpRegistry;
    
    // Register event listeners
    this.registerBCPEventListeners();
  }
  
  /**
   * Handle pack loaded event
   * @param data - Event data
   */
  public onPackLoaded(data: any): void {
    if (data && data.domain) {
      this.discoverToolsFromPack(data.domain);
    }
  }
  
  /**
   * Handle pack unloaded event
   * @param data - Event data
   */
  public onPackUnloaded(data: any): void {
    if (data && data.domain) {
      this.removeToolsFromPack(data.domain);
    }
  }
  
  /**
   * Register event listeners for BCP events
   * This method is public to allow tests to spy on it
   */
  public registerBCPEventListeners(): void {
    // Remove any existing listeners first
    this._eventBus.off('bcpRegistry:packLoaded', this.onPackLoaded.bind(this));
    this._eventBus.off('bcpRegistry:packUnloaded', this.onPackUnloaded.bind(this));
    
    // Register new listeners
    this._eventBus.on('bcpRegistry:packLoaded', this.onPackLoaded.bind(this));
    this._eventBus.on('bcpRegistry:packUnloaded', this.onPackUnloaded.bind(this));
  }
  
  /**
   * Discover tools from a loaded BCP
   * @param domain - BCP domain
   */
  public discoverToolsFromPack(domain: string): void {
    // Get the pack from the BCP registry
    const pack = this._bcpRegistry.getPack(domain);
    
    if (!pack || !pack.tools || !pack.tools.length) {
      console.warn(`Cannot discover tools: BCP not found or empty: ${domain}`);
      return;
    }
    
    // Register each tool from the pack
    for (const tool of pack.tools) {
      // Register tool with base manager
      this.registerTool(
        domain,
        tool.name,
        tool.description,
        tool.handler,
        tool.schema,
        {
          icon: tool.icon,
          display: tool.display
        }
      );
      
      // Store schema
      const fullName = `${domain}.${tool.name}`;
      this.toolSchemas.set(fullName, tool.schema);
    }
    
    console.log(`Discovered ${pack.tools.length} tools from BCP: ${domain}`);
  }
  
  /**
   * Remove tools from an unloaded BCP
   * @param domain - BCP domain
   */
  public removeToolsFromPack(domain: string): void {
    // Get tool names from this domain using public getTools()
    const tools = this.getTools().filter(tool => 
      tool.name.startsWith(`${domain}.`)
    );
    
    // Remove each tool
    for (const tool of tools) {
      const [toolDomain, name] = tool.name.split('.');
      
      // Unregister from base manager
      this.unregisterTool(toolDomain, name);
      
      // Remove schema
      this.toolSchemas.delete(tool.name);
    }
    
    console.log(`Removed ${tools.length} tools from BCP: ${domain}`);
  }
  
  /**
   * Get a tool schema by name
   * @param toolName - Full tool name (domain.name)
   * @returns Tool schema or undefined
   */
  public getToolSchema(toolName: string): any | undefined {
    return this.toolSchemas.get(toolName);
  }
  
  /**
   * Get all tools with their schemas
   * @returns Array of tools with schemas
   */
  public override getTools(): Tool[] {
    const tools = super.getTools();
    
    return tools.map(tool => {
      const schema = this.getToolSchema(tool.name);
      return {
        ...tool,
        schema: schema || tool.schema || {}
      };
    });
  }
  
  /**
   * Get tools formatted for MCP
   * @returns Array of tools formatted for MCP
   */
  public override getToolsForMCP(): any[] {
    return this.getTools()
      .filter(tool => {
        const fullTool = this.getTool(tool.name);
        return fullTool?.display?.showInSuggestions !== false;
      })
      .map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.schema || { type: "object", properties: {} }
      }));
  }
  
  /**
   * Discover all tools from loaded BCPs
   */
  public discoverAllTools(): void {
    // Get loaded domains
    const domains = this._bcpRegistry.getLoadedPacks();
    
    // Discover tools from each domain
    for (const domain of domains) {
      this.discoverToolsFromPack(domain);
    }
  }
}
