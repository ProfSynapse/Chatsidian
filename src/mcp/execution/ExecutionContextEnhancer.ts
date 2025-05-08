import { App, TAbstractFile, TFile } from 'obsidian';
import { ExecutionContext } from './ExecutionContext';
import { ToolCall } from '../ToolManagerInterface';
import { Tool } from '../interfaces';

/**
 * Enhanced execution context
 */
export interface EnhancedExecutionContext extends ExecutionContext {
  env?: {
    platform: string;
    version: string;
    mobile: boolean;
    desktop: boolean;
    lastUpdate: number;
  };
  
  preferences?: {
    theme: string;
    baseFontSize: number;
    foldHeading: boolean;
    showLineNumber: boolean;
    spellcheck: boolean;
    readableLineLength: boolean;
  };
  
  pluginState?: {
    version: string | undefined;
    enabled: boolean;
    dataPath: string;
  };
  
  workspace?: {
    activeFile: {
      path: string;
      basename: string;
      extension: string;
    } | null;
    mode: string | undefined;
    lastAccessed: number;
  };
  
  providerData?: Record<string, any>;
}

/**
 * Context enhancement options
 */
export interface ContextEnhancementOptions {
  /**
   * Include environment info
   */
  includeEnv?: boolean;
  
  /**
   * Include user preferences
   */
  includePrefs?: boolean;
  
  /**
   * Include plugin state
   */
  includePluginState?: boolean;
  
  /**
   * Include workspace info
   */
  includeWorkspace?: boolean;
  
  /**
   * Additional context providers
   */
  providers?: ContextProvider[];
}

/**
 * Context provider interface
 */
export interface ContextProvider {
  /**
   * Provider name
   */
  name: string;
  
  /**
   * Get context data
   */
  getContext(): Promise<Record<string, any>>;
}

/**
 * Enhanced execution context provider
 */
export class ExecutionContextEnhancer {
  private app: App;
  private providers: Map<string, ContextProvider>;
  
  constructor(app: App) {
    this.app = app;
    this.providers = new Map();
  }
  
  /**
   * Register a context provider
   * @param provider - Context provider
   */
  public registerProvider(provider: ContextProvider): void {
    this.providers.set(provider.name, provider);
  }
  
  /**
   * Unregister a context provider
   * @param name - Provider name
   */
  public unregisterProvider(name: string): void {
    this.providers.delete(name);
  }
  
  /**
   * Enhance execution context
   * @param context - Base execution context
   * @param options - Enhancement options
   * @returns Enhanced context
   */
  public async enhance(
    context: ExecutionContext,
    options: ContextEnhancementOptions = {}
  ): Promise<EnhancedExecutionContext> {
    // Start with base context
    const enhanced = { ...context } as EnhancedExecutionContext;
    
    // Add environment info
    if (options.includeEnv) {
      enhanced.env = await this.getEnvironmentInfo();
    }
    
    // Add user preferences
    if (options.includePrefs) {
      enhanced.preferences = await this.getUserPreferences();
    }
    
    // Add plugin state
    if (options.includePluginState) {
      enhanced.pluginState = await this.getPluginState();
    }
    
    // Add workspace info
    if (options.includeWorkspace) {
      enhanced.workspace = await this.getWorkspaceInfo();
    }
    
    // Add provider contexts
    if (options.providers) {
      enhanced.providerData = {};
      for (const provider of options.providers) {
        if (this.providers.has(provider.name)) {
          enhanced.providerData[provider.name] = 
            await this.providers.get(provider.name)!.getContext();
        }
      }
    }
    
    return enhanced;
  }
  
  /**
   * Get environment information
   * @returns Environment info
   */
  private async getEnvironmentInfo(): Promise<EnhancedExecutionContext['env']> {
    return {
      platform: process.platform,
      version: (this.app as any).version || 'unknown',
      mobile: !!(this.app as any).isMobile,
      desktop: !!(this.app as any).isDesktop,
      lastUpdate: Date.now()
    };
  }
  
  /**
   * Get user preferences
   * @returns User preferences
   */
  private async getUserPreferences(): Promise<EnhancedExecutionContext['preferences']> {
    // Get relevant preferences from app
    const vault = this.app.vault as any;
    return {
      theme: vault.getConfig('theme') || 'default',
      baseFontSize: vault.getConfig('baseFontSize') || 16,
      foldHeading: vault.getConfig('foldHeading') || false,
      showLineNumber: vault.getConfig('showLineNumber') || false,
      spellcheck: vault.getConfig('spellcheck') || false,
      readableLineLength: vault.getConfig('readableLineLength') || false
    };
  }
  
  /**
   * Get plugin state
   * @returns Plugin state
   */
  private async getPluginState(): Promise<EnhancedExecutionContext['pluginState']> {
    // Get plugin-specific state
    const plugins = (this.app as any).plugins || {};
    const manifest = plugins.manifests?.['obsidian-chatsidian'];
    
    return {
      version: manifest?.version,
      enabled: !!plugins.enabledPlugins?.has('obsidian-chatsidian'),
      dataPath: this.app.vault.configDir
    };
  }
  
  /**
   * Get workspace information
   * @returns Workspace info
   */
  private async getWorkspaceInfo(): Promise<EnhancedExecutionContext['workspace']> {
    const activeFile = this.app.workspace.getActiveFile();
    
    return {
      activeFile: activeFile ? {
        path: activeFile.path,
        basename: activeFile.basename,
        extension: activeFile.extension
      } : null,
      mode: this.app.workspace.activeLeaf?.getViewState()?.type,
      lastAccessed: Date.now()
    };
  }
  
  /**
   * Built-in context providers
   */
  public static providers = {
    /**
     * Vault statistics provider
     */
    vaultStats: {
      name: 'vaultStats',
      getContext: async (app: App) => {
        const files = app.vault.getAllLoadedFiles();
        return {
          totalFiles: files.length,
          totalMarkdownFiles: app.vault.getMarkdownFiles().length,
          totalFolders: files.filter(f => 'children' in f).length,
          lastModified: (app.vault as any).getLastModified?.()?.ts || Date.now()
        };
      }
    },
    
    /**
     * File metadata provider
     */
    fileMetadata: {
      name: 'fileMetadata',
      getContext: async (app: App) => {
        const activeFile = app.workspace.getActiveFile();
        if (!activeFile) return {};
        
        const metadata = app.metadataCache.getFileCache(activeFile);
        return {
          frontmatter: metadata?.frontmatter || {},
          headings: metadata?.headings || [],
          links: metadata?.links || [],
          tags: metadata?.tags || []
        };
      }
    }
  };
}
