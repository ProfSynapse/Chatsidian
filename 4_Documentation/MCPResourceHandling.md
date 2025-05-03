---
title: MCP Resource Handling
description: Implementation guide for MCP resource support in Chatsidian
date: 2025-05-03
status: draft
tags:
  - documentation
  - mcp
  - resources
  - implementation
---

# MCP Resource Handling

This document provides detailed guidance on implementing resource handling for the Model Context Protocol (MCP) in the Chatsidian plugin. Resources are a core primitive in MCP that allow servers to expose data and content that can be read by clients.

## Resource Implementation Overview

Resources in MCP represent any kind of data that a server wants to make available to clients, including:

- File contents
- Database records
- API responses
- Live system data
- Screenshots and images
- Log files
- And more

Each resource is identified by a unique URI and can contain either text or binary data.

## Resource Interface

```typescript
// src/mcp/resources/ResourceManager.ts
export interface MCPResource {
  uri: string;           // Unique identifier for the resource
  name: string;          // Human-readable name
  description?: string;  // Optional description
  mimeType?: string;     // Optional MIME type
}

export interface ResourceContent {
  uri: string;        // The URI of the resource
  mimeType?: string;  // Optional MIME type
  text?: string;      // For text resources
  blob?: string;      // For binary resources (base64 encoded)
}
```

## Resource Manager Implementation

```typescript
// src/mcp/resources/ResourceManager.ts
export class ResourceManager {
  private plugin: ChatsidianPlugin;
  private eventBus: EventBus;
  private mcpClient: MCPClient;
  private cache: Map<string, ResourceContent> = new Map();
  
  constructor(plugin: ChatsidianPlugin, eventBus: EventBus, mcpClient: MCPClient) {
    this.plugin = plugin;
    this.eventBus = eventBus;
    this.mcpClient = mcpClient;
    
    // Register event listeners
    this.registerEvents();
  }
  
  private registerEvents(): void {
    // Listen for MCP events
    this.eventBus.on('mcp:resourceUpdated', this.handleResourceUpdate.bind(this));
    this.eventBus.on('mcp:resourcesListChanged', this.handleResourcesListChanged.bind(this));
  }
  
  /**
   * List all available resources
   */
  public async listResources(): Promise<MCPResource[]> {
    try {
      return await this.mcpClient.listResources();
    } catch (error) {
      console.error('Error listing resources:', error);
      throw error;
    }
  }
  
  /**
   * Get resource content
   */
  public async getResource(uri: string, useCache: boolean = true): Promise<ResourceContent> {
    try {
      // Check cache first if enabled
      if (useCache && this.cache.has(uri)) {
        return this.cache.get(uri)!;
      }
      
      // Fetch from provider
      const content = await this.mcpClient.getResource(uri);
      
      // Cache result
      this.cache.set(uri, content);
      
      return content;
    } catch (error) {
      console.error(`Error getting resource ${uri}:`, error);
      throw error;
    }
  }
  
  /**
   * Subscribe to resource updates
   */
  public async subscribeToResource(uri: string, callback: (update: ResourceContent) => void): Promise<() => void> {
    try {
      return await this.mcpClient.subscribeToResource(uri, callback);
    } catch (error) {
      console.error(`Error subscribing to resource ${uri}:`, error);
      throw error;
    }
  }
  
  /**
   * Handle resource update event
   */
  private async handleResourceUpdate(data: { uri: string }): Promise<void> {
    const { uri } = data;
    
    // Clear cache for this resource
    this.cache.delete(uri);
    
    // Emit event
    this.eventBus.emit('resource:updated', { uri });
  }
  
  /**
   * Handle resources list changed event
   */
  private async handleResourcesListChanged(): Promise<void> {
    // Clear all cache
    this.cache.clear();
    
    // Fetch new resources list
    const resources = await this.listResources();
    
    // Emit event
    this.eventBus.emit('resource:listChanged', { resources });
  }
  
  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.clear();
  }
}
```

## Integration with MCPClient

The MCPClient should be updated to support resource operations:

```typescript
// Add to MCPClient.ts
/**
 * List available resources
 */
public async listResources(): Promise<MCPResource[]> {
  try {
    // Ensure provider is initialized
    if (!this.currentProvider) {
      await this.initialize();
    }
    
    // Check capability
    if (!this.supportsCapability('resources')) {
      console.warn('Server does not support resources capability');
      return [];
    }
    
    // Get resources
    const resources = await this.currentProvider.listResources();
    
    // Emit event
    this.eventBus.emit('mcp:resourcesListed', { resources });
    
    return resources;
  } catch (error) {
    console.error('Error listing resources:', error);
    this.eventBus.emit('mcp:resourcesError', { error });
    throw error;
  }
}

/**
 * Get resource content
 */
public async getResource(uri: string): Promise<ResourceContent> {
  try {
    // Ensure provider is initialized
    if (!this.currentProvider) {
      await this.initialize();
    }
    
    // Check capability
    if (!this.supportsCapability('resources')) {
      throw new Error('Server does not support resources capability');
    }
    
    // Get resource
    const resource = await this.currentProvider.getResource(uri);
    
    // Emit event
    this.eventBus.emit('mcp:resourceFetched', { uri, resource });
    
    return resource;
  } catch (error) {
    console.error('Error fetching resource:', error);
    this.eventBus.emit('mcp:resourceError', { uri, error });
    throw error;
  }
}

/**
 * Subscribe to resource updates
 */
public async subscribeToResource(uri: string, callback: (update: ResourceContent) => void): Promise<() => void> {
  try {
    // Ensure provider is initialized
    if (!this.currentProvider) {
      await this.initialize();
    }
    
    // Check capability
    if (!this.supportsCapability('resources')) {
      throw new Error('Server does not support resources capability');
    }
    
    // Subscribe to resource
    const unsubscribe = await this.currentProvider.subscribeToResource(uri, (update) => {
      // Emit event
      this.eventBus.emit('mcp:resourceUpdated', { uri, update });
      
      // Call callback
      callback(update);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error('Error subscribing to resource:', error);
    this.eventBus.emit('mcp:resourceSubscriptionError', { uri, error });
    throw error;
  }
}
```

## Resource Template Support

MCP also supports resource templates for dynamic resources. Here's how to implement them:

```typescript
// src/mcp/resources/ResourceManager.ts
export interface ResourceTemplate {
  uriTemplate: string;  // URI template following RFC 6570
  name: string;         // Human-readable name for this type
  description?: string; // Optional description
  mimeType?: string;    // Optional MIME type for all matching resources
}

// Add to ResourceManager.ts
/**
 * List resource templates
 */
public async listResourceTemplates(): Promise<ResourceTemplate[]> {
  try {
    // Check if provider supports resource templates
    if (!this.mcpClient.supportsCapability('resourceTemplates')) {
      return [];
    }
    
    return await this.mcpClient.listResourceTemplates();
  } catch (error) {
    console.error('Error listing resource templates:', error);
    throw error;
  }
}

/**
 * Create resource URI from template
 */
public createResourceUri(template: ResourceTemplate, params: Record<string, string>): string {
  // Simple implementation for basic templates
  let uri = template.uriTemplate;
  
  // Replace each parameter in the template
  for (const [key, value] of Object.entries(params)) {
    uri = uri.replace(`{${key}}`, encodeURIComponent(value));
  }
  
  return uri;
}

// Add to MCPClient.ts
/**
 * List resource templates
 */
public async listResourceTemplates(): Promise<ResourceTemplate[]> {
  try {
    // Ensure provider is initialized
    if (!this.currentProvider) {
      await this.initialize();
    }
    
    // Check capability
    if (!this.supportsCapability('resourceTemplates')) {
      console.warn('Server does not support resource templates capability');
      return [];
    }
    
    // Get resource templates
    const templates = await this.currentProvider.listResourceTemplates();
    
    // Emit event
    this.eventBus.emit('mcp:resourceTemplatesListed', { templates });
    
    return templates;
  } catch (error) {
    console.error('Error listing resource templates:', error);
    this.eventBus.emit('mcp:resourceTemplatesError', { error });
    throw error;
  }
}
```

## Obsidian-Specific Resource Mapping

Integrate Obsidian's vault content as MCP resources:

```typescript
// src/mcp/resources/ObsidianResourceProvider.ts
export class ObsidianResourceProvider {
  private app: App;
  
  constructor(app: App) {
    this.app = app;
  }
  
  /**
   * Get resources for Obsidian vault
   */
  public getVaultResources(): MCPResource[] {
    const resources: MCPResource[] = [];
    
    // Add vault root
    resources.push({
      uri: 'obsidian://vault',
      name: 'Vault Root',
      description: 'Root folder of the Obsidian vault',
      mimeType: 'application/folder'
    });
    
    // Add recent files
    const recentFiles = this.app.workspace.getLastOpenFiles();
    for (const filePath of recentFiles) {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (file instanceof TFile) {
        resources.push({
          uri: `obsidian://file/${encodeURIComponent(file.path)}`,
          name: file.name,
          description: 'Recently opened file',
          mimeType: this.getMimeType(file)
        });
      }
    }
    
    // Add active file
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile) {
      resources.push({
        uri: `obsidian://file/${encodeURIComponent(activeFile.path)}`,
        name: activeFile.name,
        description: 'Currently active file',
        mimeType: this.getMimeType(activeFile)
      });
    }
    
    return resources;
  }
  
  /**
   * Get content for an Obsidian resource
   */
  public async getResourceContent(uri: string): Promise<ResourceContent> {
    // Parse URI
    const parsed = this.parseObsidianUri(uri);
    
    if (!parsed) {
      throw new Error(`Invalid Obsidian resource URI: ${uri}`);
    }
    
    // Handle different resource types
    switch (parsed.type) {
      case 'file':
        return this.getFileContent(parsed.path);
      case 'folder':
        return this.getFolderContent(parsed.path);
      case 'vault':
        return this.getVaultContent();
      default:
        throw new Error(`Unsupported Obsidian resource type: ${parsed.type}`);
    }
  }
  
  /**
   * Parse Obsidian URI
   */
  private parseObsidianUri(uri: string): { type: string, path?: string } | null {
    // Match obsidian://type/path
    const match = uri.match(/^obsidian:\/\/([a-z]+)(?:\/(.+))?$/);
    
    if (!match) {
      return null;
    }
    
    return {
      type: match[1],
      path: match[2] ? decodeURIComponent(match[2]) : undefined
    };
  }
  
  /**
   * Get MIME type for a file
   */
  private getMimeType(file: TFile): string {
    // Map extensions to MIME types
    const mimeTypes: Record<string, string> = {
      'md': 'text/markdown',
      'txt': 'text/plain',
      'json': 'application/json',
      'js': 'text/javascript',
      'css': 'text/css',
      'html': 'text/html',
      'pdf': 'application/pdf',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml'
    };
    
    return mimeTypes[file.extension] || 'application/octet-stream';
  }
  
  // Implementation for content getters...
}
```

## Usage Examples

Here are examples of how to use the resource handling capabilities in the Chatsidian plugin:

```typescript
// Example 1: Listing resources
async function listAvailableResources() {
  // Get resource manager
  const resourceManager = plugin.resourceManager;
  
  // List resources
  const resources = await resourceManager.listResources();
  
  // Display resources in UI
  console.log(`Found ${resources.length} resources:`);
  for (const resource of resources) {
    console.log(`- ${resource.name} (${resource.uri})`);
  }
}

// Example 2: Fetching a resource
async function fetchResourceContent(uri: string) {
  // Get resource manager
  const resourceManager = plugin.resourceManager;
  
  try {
    // Get resource content
    const content = await resourceManager.getResource(uri);
    
    // Handle content based on MIME type
    if (content.text) {
      console.log('Resource content:', content.text.substring(0, 100) + '...');
      
      // Display in UI
      updateResourcePreview(content.text, content.mimeType);
    } else if (content.blob) {
      console.log('Binary resource, size:', content.blob.length);
      
      // Handle binary data based on MIME type
      if (content.mimeType?.startsWith('image/')) {
        displayImage(`data:${content.mimeType};base64,${content.blob}`);
      } else {
        offerDownload(content.blob, getFilenameFromUri(uri), content.mimeType);
      }
    }
  } catch (error) {
    console.error(`Error fetching resource ${uri}:`, error);
    displayError(`Failed to fetch resource: ${error.message}`);
  }
}

// Example 3: Subscribing to resource updates
async function subscribeToActiveNote() {
  // Get active file
  const activeFile = app.workspace.getActiveFile();
  
  if (!activeFile) {
    console.warn('No active file');
    return;
  }
  
  // Get resource manager
  const resourceManager = plugin.resourceManager;
  
  // Create resource URI
  const uri = `obsidian://file/${encodeURIComponent(activeFile.path)}`;
  
  try {
    // Subscribe to updates
    const unsubscribe = await resourceManager.subscribeToResource(uri, (update) => {
      console.log('Resource updated:', update);
      
      // Update UI
      if (update.text) {
        updateResourcePreview(update.text, update.mimeType);
      }
    });
    
    // Store unsubscribe function to call later
    activeSubscriptions.set(uri, unsubscribe);
    
    console.log(`Subscribed to updates for ${uri}`);
  } catch (error) {
    console.error(`Error subscribing to ${uri}:`, error);
    displayError(`Failed to subscribe to resource: ${error.message}`);
  }
}

// Example 4: Using resource templates
async function fetchWeatherResource() {
  // Get resource manager
  const resourceManager = plugin.resourceManager;
  
  try {
    // List templates
    const templates = await resourceManager.listResourceTemplates();
    
    // Find weather template
    const weatherTemplate = templates.find(t => t.name.includes('Weather'));
    
    if (!weatherTemplate) {
      console.warn('Weather template not found');
      return;
    }
    
    // Create URI from template
    const uri = resourceManager.createResourceUri(weatherTemplate, {
      location: 'New York',
      units: 'metric'
    });
    
    // Fetch resource
    const content = await resourceManager.getResource(uri);
    
    // Display in UI
    if (content.text) {
      displayWeatherData(JSON.parse(content.text));
    }
  } catch (error) {
    console.error('Error fetching weather:', error);
    displayError(`Failed to fetch weather: ${error.message}`);
  }
}
```

## Integration with Chat Interface

Add resource support to the chat interface for a better user experience:

```typescript
// src/ui/ResourcePanel.ts
export class ResourcePanel extends Component {
  private resourceManager: ResourceManager;
  private selectedResource: MCPResource | null = null;
  private resourceContent: ResourceContent | null = null;
  
  constructor(containerEl: HTMLElement, resourceManager: ResourceManager) {
    super();
    this.containerEl = containerEl;
    this.resourceManager = resourceManager;
  }
  
  async onload() {
    // Load initial resources
    await this.loadResources();
    
    // Render UI
    this.render();
  }
  
  async loadResources() {
    try {
      this.resources = await this.resourceManager.listResources();
    } catch (error) {
      console.error('Error loading resources:', error);
      this.resources = [];
    }
  }
  
  async selectResource(resource: MCPResource) {
    this.selectedResource = resource;
    
    try {
      this.resourceContent = await this.resourceManager.getResource(resource.uri);
      this.render();
    } catch (error) {
      console.error(`Error loading resource ${resource.uri}:`, error);
      this.resourceContent = null;
      this.render();
    }
  }
  
  render() {
    const { containerEl } = this;
    
    containerEl.empty();
    
    // Create resources list
    const resourcesList = containerEl.createDiv('resources-list');
    
    for (const resource of this.resources) {
      const resourceEl = resourcesList.createDiv('resource-item');
      resourceEl.createSpan({ text: resource.name });
      
      // Add click handler
      resourceEl.addEventListener('click', () => {
        this.selectResource(resource);
      });
      
      // Mark selected
      if (this.selectedResource?.uri === resource.uri) {
        resourceEl.addClass('selected');
      }
    }
    
    // Create resource preview
    const previewEl = containerEl.createDiv('resource-preview');
    
    if (this.selectedResource && this.resourceContent) {
      previewEl.createEl('h3', { text: this.selectedResource.name });
      
      if (this.resourceContent.text) {
        // Text content
        if (this.resourceContent.mimeType === 'text/markdown') {
          // Render markdown
          MarkdownRenderer.renderMarkdown(
            this.resourceContent.text,
            previewEl.createDiv('markdown-preview'),
            '',
            null
          );
        } else {
          // Plain text
          previewEl.createEl('pre').createEl('code', {
            text: this.resourceContent.text
          });
        }
      } else if (this.resourceContent.blob) {
        // Binary content
        if (this.resourceContent.mimeType?.startsWith('image/')) {
          // Image
          const img = previewEl.createEl('img');
          img.src = `data:${this.resourceContent.mimeType};base64,${this.resourceContent.blob}`;
        } else {
          // Other binary
          previewEl.createSpan({
            text: 'Binary content'
          });
          
          // Add download button
          const downloadBtn = previewEl.createEl('button', {
            text: 'Download'
          });
          
          downloadBtn.addEventListener('click', () => {
            this.downloadResource();
          });
        }
      }
      
      // Add refresh button
      const refreshBtn = previewEl.createEl('button', {
        text: 'Refresh'
      });
      
      refreshBtn.addEventListener('click', () => {
        this.refreshResource();
      });
    } else if (this.selectedResource) {
      previewEl.createSpan({
        text: 'Error loading resource'
      });
    } else {
      previewEl.createSpan({
        text: 'Select a resource to preview'
      });
    }
  }
  
  // Implementation for refreshResource and downloadResource...
}
```

## Implementation References

The resource handling implementation should be integrated into these components:

- [[💻 Coding/Projects/Chatsidian/1_Architecture/Components/MCPConnector.md]] - For the core MCP connection handling
- Create new files:
  - `src/mcp/resources/ResourceManager.ts` - For resource management
  - `src/mcp/resources/ObsidianResourceProvider.ts` - For Obsidian resource integration
  - `src/ui/ResourcePanel.ts` - For resource UI components

## References to MCP Specification

Resources are described in the MCP specification:
- [MCP Resources Documentation](https://modelcontextprotocol.io/docs/concepts/resources)
- [Resource Template Specification](https://datatracker.ietf.org/doc/html/rfc6570)
