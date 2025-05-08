/**
 * Resource Manager
 * 
 * This file implements the Resource Manager component, which is responsible for
 * managing MCP resources, including discovery, registration, access, and caching.
 */

import { Component, Events } from 'obsidian';
import { EventBus } from '../../core/EventBus';

/**
 * Resource type
 */
export enum ResourceType {
  /**
   * File resource (e.g., documents, images)
   */
  File = 'file',
  
  /**
   * API resource (e.g., external API endpoints)
   */
  API = 'api',
  
  /**
   * Data resource (e.g., structured data)
   */
  Data = 'data',
  
  /**
   * System resource (e.g., system information)
   */
  System = 'system',
  
  /**
   * Custom resource type
   */
  Custom = 'custom'
}

/**
 * Resource access level
 */
export enum ResourceAccessLevel {
  /**
   * Public resources available to all
   */
  Public = 'public',
  
  /**
   * Protected resources requiring authentication
   */
  Protected = 'protected',
  
  /**
   * Private resources with restricted access
   */
  Private = 'private'
}

/**
 * Resource metadata
 */
export interface ResourceMetadata {
  /**
   * Resource ID
   */
  id: string;
  
  /**
   * Resource name
   */
  name: string;
  
  /**
   * Resource description
   */
  description: string;
  
  /**
   * Resource type
   */
  type: ResourceType;
  
  /**
   * Resource access level
   */
  accessLevel: ResourceAccessLevel;
  
  /**
   * Resource provider (domain)
   */
  provider: string;
  
  /**
   * Resource URI
   */
  uri: string;
  
  /**
   * Resource schema (if applicable)
   */
  schema?: any;
  
  /**
   * Resource version
   */
  version?: string;
  
  /**
   * Resource creation timestamp
   */
  createdAt: number;
  
  /**
   * Resource last updated timestamp
   */
  updatedAt: number;
  
  /**
   * Resource tags
   */
  tags?: string[];
  
  /**
   * Additional metadata
   */
  [key: string]: any;
}

/**
 * Resource handler function
 */
export type ResourceHandler = (params: any, context?: any) => Promise<any>;

/**
 * Resource definition
 */
export interface Resource {
  /**
   * Resource metadata
   */
  metadata: ResourceMetadata;
  
  /**
   * Resource handler function
   */
  handler: ResourceHandler;
  
  /**
   * Resource cache settings
   */
  cache?: {
    /**
     * Whether to enable caching
     */
    enabled: boolean;
    
    /**
     * Time-to-live in milliseconds
     */
    ttl: number;
  };
}

/**
 * Resource access options
 */
export interface ResourceAccessOptions {
  /**
   * Whether to bypass cache
   */
  bypassCache?: boolean;
  
  /**
   * Access token (if required)
   */
  token?: string;
  
  /**
   * Request parameters
   */
  params?: any;
  
  /**
   * Request timeout in milliseconds
   */
  timeout?: number;
  
  /**
   * Abort signal for cancellation
   */
  signal?: AbortSignal;
}

/**
 * Resource access result
 */
export interface ResourceAccessResult {
  /**
   * Resource data
   */
  data: any;
  
  /**
   * Whether the result was from cache
   */
  fromCache: boolean;
  
  /**
   * Resource metadata
   */
  metadata: ResourceMetadata;
  
  /**
   * Access timestamp
   */
  timestamp: number;
  
  /**
   * Response time in milliseconds
   */
  responseTime: number;
}

/**
 * Cache entry
 */
interface CacheEntry {
  /**
   * Cached data
   */
  data: any;
  
  /**
   * Cache timestamp
   */
  timestamp: number;
  
  /**
   * Time-to-live in milliseconds
   */
  ttl: number;
  
  /**
   * Resource metadata
   */
  metadata: ResourceMetadata;
}

/**
 * URI components
 */
export interface URIComponents {
  /**
   * Protocol (scheme)
   */
  protocol: string;
  
  /**
   * Provider (domain)
   */
  provider: string;
  
  /**
   * Resource path
   */
  path: string;
  
  /**
   * Query parameters
   */
  params: Record<string, string>;
}

/**
 * Resource manager for handling MCP resources
 * Extends Component for lifecycle management
 */
export class ResourceManager extends Component {
  private resources: Map<string, Resource> = new Map();
  private cache: Map<string, CacheEntry> = new Map();
  private eventBus: EventBus;
  private events: Events = new Events();
  
  /**
   * Create a new resource manager
   * @param eventBus - Event bus for plugin-wide events
   */
  constructor(eventBus: EventBus) {
    super();
    this.eventBus = eventBus;
  }
  
  /**
   * Component lifecycle method - called when component is loaded
   */
  onload(): void {
    console.log('ResourceManager: loaded');
    
    // Start cache cleanup interval
    this.registerInterval(
      window.setInterval(() => this.cleanupCache(), 60000) // Clean up every minute
    );
  }
  
  /**
   * Component lifecycle method - called when component is unloaded
   */
  onunload(): void {
    console.log('ResourceManager: unloaded');
    
    // Clear cache
    this.cache.clear();
    
    // Clean up event listeners
    this.events = new Events();
  }
  
  /**
   * Register a resource
   * @param metadata - Resource metadata
   * @param handler - Resource handler function
   * @param cacheSettings - Cache settings
   * @returns Whether registration was successful
   */
  public registerResource(
    metadata: ResourceMetadata,
    handler: ResourceHandler,
    cacheSettings?: {
      enabled: boolean;
      ttl: number;
    }
  ): boolean {
    try {
      // Validate URI
      this.parseURI(metadata.uri);
      
      // Create resource
      const resource: Resource = {
        metadata,
        handler,
        cache: cacheSettings
      };
      
      // Store resource
      this.resources.set(metadata.uri, resource);
      
      // Emit event
      this.events.trigger('resourceManager:resourceRegistered', {
        uri: metadata.uri,
        type: metadata.type,
        provider: metadata.provider
      });
      
      return true;
    } catch (error) {
      console.error(`Failed to register resource ${metadata.uri}:`, error);
      return false;
    }
  }
  
  /**
   * Unregister a resource
   * @param uri - Resource URI
   * @returns Whether unregistration was successful
   */
  public unregisterResource(uri: string): boolean {
    // Check if resource exists
    if (!this.resources.has(uri)) {
      return false;
    }
    
    // Get resource
    const resource = this.resources.get(uri);
    
    if (!resource) {
      return false;
    }
    
    // Remove from resources
    this.resources.delete(uri);
    
    // Remove from cache
    this.invalidateCache(uri);
    
    // Emit event
    this.events.trigger('resourceManager:resourceUnregistered', {
      uri,
      type: resource.metadata.type,
      provider: resource.metadata.provider
    });
    
    return true;
  }
  
  /**
   * Access a resource
   * @param uri - Resource URI
   * @param options - Access options
   * @returns Promise resolving to resource access result
   */
  public async accessResource(
    uri: string,
    options: ResourceAccessOptions = {}
  ): Promise<ResourceAccessResult> {
    // Parse URI
    const components = this.parseURI(uri);
    
    // Find resource
    const resource = this.resources.get(uri);
    
    if (!resource) {
      throw new Error(`Resource not found: ${uri}`);
    }
    
    // Check access level
    await this.checkAccess(resource.metadata, options);
    
    // Emit access event
    this.events.trigger('resourceManager:resourceAccessing', {
      uri,
      type: resource.metadata.type,
      provider: resource.metadata.provider,
      params: options.params
    });
    
    // Check cache if enabled and not bypassed
    if (
      resource.cache?.enabled &&
      !options.bypassCache &&
      this.isCacheValid(uri)
    ) {
      const cacheEntry = this.cache.get(uri);
      
      if (cacheEntry) {
        // Emit cache hit event
        this.events.trigger('resourceManager:cacheHit', {
          uri,
          age: Date.now() - cacheEntry.timestamp
        });
        
        return {
          data: cacheEntry.data,
          fromCache: true,
          metadata: resource.metadata,
          timestamp: Date.now(),
          responseTime: 0
        };
      }
    }
    
    // Start timer
    const startTime = Date.now();
    
    try {
      // Execute handler
      const data = await resource.handler(options.params || {}, {
        uri,
        components,
        token: options.token,
        signal: options.signal
      });
      
      // Calculate response time
      const responseTime = Date.now() - startTime;
      
      // Update cache if enabled
      if (resource.cache?.enabled) {
        this.updateCache(uri, data, resource.cache.ttl, resource.metadata);
      }
      
      // Emit access success event
      this.events.trigger('resourceManager:resourceAccessed', {
        uri,
        type: resource.metadata.type,
        provider: resource.metadata.provider,
        responseTime
      });
      
      return {
        data,
        fromCache: false,
        metadata: resource.metadata,
        timestamp: Date.now(),
        responseTime
      };
    } catch (error) {
      // Calculate response time
      const responseTime = Date.now() - startTime;
      
      // Emit access error event
      this.events.trigger('resourceManager:resourceAccessError', {
        uri,
        type: resource.metadata.type,
        provider: resource.metadata.provider,
        error,
        responseTime
      });
      
      throw error;
    }
  }
  
  /**
   * Check if a resource exists
   * @param uri - Resource URI
   * @returns Whether the resource exists
   */
  public hasResource(uri: string): boolean {
    return this.resources.has(uri);
  }
  
  /**
   * Get resource metadata
   * @param uri - Resource URI
   * @returns Resource metadata or undefined
   */
  public getResourceMetadata(uri: string): ResourceMetadata | undefined {
    const resource = this.resources.get(uri);
    
    if (!resource) {
      return undefined;
    }
    
    return { ...resource.metadata };
  }
  
  /**
   * List all resources
   * @param filter - Optional filter function
   * @returns Array of resource metadata
   */
  public listResources(
    filter?: (metadata: ResourceMetadata) => boolean
  ): ResourceMetadata[] {
    const resources: ResourceMetadata[] = [];
    
    for (const resource of this.resources.values()) {
      if (!filter || filter(resource.metadata)) {
        resources.push({ ...resource.metadata });
      }
    }
    
    return resources;
  }
  
  /**
   * List resources by provider
   * @param provider - Provider name
   * @returns Array of resource metadata
   */
  public listResourcesByProvider(provider: string): ResourceMetadata[] {
    return this.listResources(metadata => metadata.provider === provider);
  }
  
  /**
   * List resources by type
   * @param type - Resource type
   * @returns Array of resource metadata
   */
  public listResourcesByType(type: ResourceType): ResourceMetadata[] {
    return this.listResources(metadata => metadata.type === type);
  }
  
  /**
   * List resources by access level
   * @param accessLevel - Access level
   * @returns Array of resource metadata
   */
  public listResourcesByAccessLevel(accessLevel: ResourceAccessLevel): ResourceMetadata[] {
    return this.listResources(metadata => metadata.accessLevel === accessLevel);
  }
  
  /**
   * List resources by tag
   * @param tag - Tag to filter by
   * @returns Array of resource metadata
   */
  public listResourcesByTag(tag: string): ResourceMetadata[] {
    return this.listResources(metadata => metadata.tags?.includes(tag) || false);
  }
  
  /**
   * Parse a resource URI
   * @param uri - Resource URI
   * @returns URI components
   */
  public parseURI(uri: string): URIComponents {
    try {
      // URI format: protocol://provider/path?param1=value1&param2=value2
      const match = uri.match(/^([a-z]+):\/\/([a-z0-9_-]+)\/([^?]*)(?:\?(.*))?$/i);
      
      if (!match) {
        throw new Error(`Invalid URI format: ${uri}`);
      }
      
      const [, protocol, provider, path, queryString] = match;
      
      // Parse query parameters
      const params: Record<string, string> = {};
      
      if (queryString) {
        const pairs = queryString.split('&');
        
        for (const pair of pairs) {
          const [key, value] = pair.split('=');
          params[decodeURIComponent(key)] = decodeURIComponent(value || '');
        }
      }
      
      return {
        protocol,
        provider,
        path,
        params
      };
    } catch (error) {
      throw new Error(`Failed to parse URI ${uri}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Build a resource URI
   * @param components - URI components
   * @returns Resource URI
   */
  public buildURI(components: URIComponents): string {
    try {
      // Build query string
      let queryString = '';
      
      if (Object.keys(components.params).length > 0) {
        queryString = '?' + Object.entries(components.params)
          .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
          .join('&');
      }
      
      // Build URI
      return `${components.protocol}://${components.provider}/${components.path}${queryString}`;
    } catch (error) {
      throw new Error(`Failed to build URI: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Check if a cache entry is valid
   * @param uri - Resource URI
   * @returns Whether the cache entry is valid
   */
  private isCacheValid(uri: string): boolean {
    const entry = this.cache.get(uri);
    
    if (!entry) {
      return false;
    }
    
    return Date.now() - entry.timestamp < entry.ttl;
  }
  
  /**
   * Update cache for a resource
   * @param uri - Resource URI
   * @param data - Resource data
   * @param ttl - Time-to-live in milliseconds
   * @param metadata - Resource metadata
   */
  private updateCache(uri: string, data: any, ttl: number, metadata: ResourceMetadata): void {
    this.cache.set(uri, {
      data,
      timestamp: Date.now(),
      ttl,
      metadata
    });
    
    // Emit cache update event
    this.events.trigger('resourceManager:cacheUpdated', {
      uri,
      ttl
    });
  }
  
  /**
   * Invalidate cache for a resource
   * @param uri - Resource URI
   */
  public invalidateCache(uri: string): void {
    if (this.cache.has(uri)) {
      this.cache.delete(uri);
      
      // Emit cache invalidation event
      this.events.trigger('resourceManager:cacheInvalidated', {
        uri
      });
    }
  }
  
  /**
   * Clear all cache entries
   */
  public clearCache(): void {
    this.cache.clear();
    
    // Emit cache clear event
    this.events.trigger('resourceManager:cacheCleared', {});
  }
  
  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [uri, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= entry.ttl) {
        this.cache.delete(uri);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      // Emit cache cleanup event
      this.events.trigger('resourceManager:cacheCleanup', {
        expiredCount
      });
    }
  }
  
  /**
   * Check access to a resource
   * @param metadata - Resource metadata
   * @param options - Access options
   * @returns Promise resolving when access is granted
   * @throws Error when access is denied
   */
  private async checkAccess(
    metadata: ResourceMetadata,
    options: ResourceAccessOptions
  ): Promise<void> {
    // Public resources are always accessible
    if (metadata.accessLevel === ResourceAccessLevel.Public) {
      return;
    }
    
    // Protected resources require a token
    if (metadata.accessLevel === ResourceAccessLevel.Protected) {
      if (!options.token) {
        throw new Error(`Access denied: Resource ${metadata.uri} requires authentication`);
      }
      
      // Validate token (in a real implementation, this would verify the token)
      if (!this.validateToken(options.token, metadata)) {
        throw new Error(`Access denied: Invalid token for resource ${metadata.uri}`);
      }
      
      return;
    }
    
    // Private resources require additional checks
    if (metadata.accessLevel === ResourceAccessLevel.Private) {
      if (!options.token) {
        throw new Error(`Access denied: Resource ${metadata.uri} requires authentication`);
      }
      
      // Validate token (in a real implementation, this would verify the token)
      if (!this.validateToken(options.token, metadata)) {
        throw new Error(`Access denied: Invalid token for resource ${metadata.uri}`);
      }
      
      // Check additional permissions (in a real implementation, this would check permissions)
      if (!this.checkPermissions(options.token, metadata)) {
        throw new Error(`Access denied: Insufficient permissions for resource ${metadata.uri}`);
      }
      
      return;
    }
    
    // Unknown access level
    throw new Error(`Access denied: Unknown access level for resource ${metadata.uri}`);
  }
  
  /**
   * Validate a token
   * @param token - Token to validate
   * @param metadata - Resource metadata
   * @returns Whether the token is valid
   */
  private validateToken(token: string, metadata: ResourceMetadata): boolean {
    // In a real implementation, this would verify the token
    // For now, we'll just check if it's not empty
    return token.length > 0;
  }
  
  /**
   * Check permissions for a resource
   * @param token - Access token
   * @param metadata - Resource metadata
   * @returns Whether the user has permission
   */
  private checkPermissions(token: string, metadata: ResourceMetadata): boolean {
    // In a real implementation, this would check permissions
    // For now, we'll just return true
    return true;
  }
  
  /**
   * Register event listeners
   * @param eventName - Event name
   * @param callback - Callback function
   */
  public on(eventName: string, callback: (data: any) => void): void {
    this.events.on(eventName, callback);
  }
  
  /**
   * Unregister event listeners
   * @param eventName - Event name
   * @param callback - Callback function
   */
  public off(eventName: string, callback: (data: any) => void): void {
    this.events.off(eventName, callback);
  }
}

/**
 * Create a new resource manager
 * @param eventBus - Event bus for plugin-wide events
 * @returns Resource manager
 */
export function createResourceManager(eventBus: EventBus): ResourceManager {
  return new ResourceManager(eventBus);
}