import { App, TFile, Vault, Workspace } from 'obsidian';
import { ExecutionContextEnhancer, ContextProvider } from '../../../src/mcp/execution/ExecutionContextEnhancer';
import { ExecutionContext } from '../../../src/mcp/execution/ExecutionContext';
import { Tool } from '../../../src/mcp/interfaces';

describe('ExecutionContextEnhancer', () => {
  let app: App;
  let enhancer: ExecutionContextEnhancer;
  let mockContext: ExecutionContext;
  
  const mockTool: Tool = {
    name: 'testTool',
    description: 'Test tool',
    handler: jest.fn(),
    schema: {}
  };
  
  beforeEach(() => {
    // Mock App and its components
    const mockApp = {
      vault: {
        configDir: '/test/config',
        getAllLoadedFiles: jest.fn().mockReturnValue([]),
        getMarkdownFiles: jest.fn().mockReturnValue([]),
        getConfig: jest.fn()
      } as unknown as Vault,
      workspace: {
        getActiveFile: jest.fn().mockReturnValue(null),
        activeLeaf: {
          getViewState: jest.fn().mockReturnValue({ type: 'markdown' })
        }
      } as unknown as Workspace,
      version: '1.0.0',
      metadataCache: {
        getFileCache: jest.fn().mockReturnValue({})
      },
      plugins: {
        manifests: {},
        enabledPlugins: new Set()
      },
      keymap: {},
      scope: {},
      commands: {},
      setting: {},
      fileManager: {},
      lastEvent: null
    };
    
    app = mockApp as unknown as App;
    enhancer = new ExecutionContextEnhancer(app);
    
    mockContext = {
      tool: mockTool,
      toolCall: {
        id: 'test-123',
        name: 'testTool',
        status: 'pending',
        arguments: {}
      },
      params: {}
    };
  });
  
  describe('basic enhancement', () => {
    it('should preserve original context', async () => {
      const enhanced = await enhancer.enhance(mockContext);
      
      expect(enhanced.tool).toBe(mockTool);
      expect(enhanced.toolCall).toBe(mockContext.toolCall);
      expect(enhanced.params).toBe(mockContext.params);
    });
    
    it('should enhance with environment info', async () => {
      const enhanced = await enhancer.enhance(mockContext, { includeEnv: true });
      
      expect(enhanced.env).toBeDefined();
      expect(enhanced.env?.platform).toBe(process.platform);
      expect(enhanced.env?.version).toBe('1.0.0');
    });
    
    it('should enhance with workspace info', async () => {
      const mockFile = {
        path: 'test.md',
        basename: 'test',
        extension: 'md'
      } as TFile;
      
      (app.workspace.getActiveFile as jest.Mock).mockReturnValue(mockFile);
      
      const enhanced = await enhancer.enhance(mockContext, { includeWorkspace: true });
      
      expect(enhanced.workspace).toBeDefined();
      expect(enhanced.workspace?.activeFile).toEqual({
        path: 'test.md',
        basename: 'test',
        extension: 'md'
      });
      expect(enhanced.workspace?.mode).toBe('markdown');
    });
  });
  
  describe('custom providers', () => {
    let testProvider: ContextProvider;
    
    beforeEach(() => {
      testProvider = {
        name: 'test',
        getContext: jest.fn().mockResolvedValue({ test: true })
      };
      
      enhancer.registerProvider(testProvider);
    });
    
    it('should include custom provider data', async () => {
      const enhanced = await enhancer.enhance(mockContext, {
        providers: [testProvider]
      });
      
      expect(enhanced.providerData?.test).toEqual({ test: true });
      expect(testProvider.getContext).toHaveBeenCalled();
    });
    
    it('should handle unregistered providers', async () => {
      const unregisteredProvider: ContextProvider = {
        name: 'unknown',
        getContext: jest.fn()
      };
      
      const enhanced = await enhancer.enhance(mockContext, {
        providers: [unregisteredProvider]
      });
      
      expect(enhanced.providerData?.unknown).toBeUndefined();
      expect(unregisteredProvider.getContext).not.toHaveBeenCalled();
    });
    
    it('should handle provider unregistration', async () => {
      enhancer.unregisterProvider('test');
      
      const enhanced = await enhancer.enhance(mockContext, {
        providers: [testProvider]
      });
      
      expect(enhanced.providerData?.test).toBeUndefined();
      expect(testProvider.getContext).not.toHaveBeenCalled();
    });
  });
  
  describe('built-in providers', () => {
    it('should provide vault statistics', async () => {
      (app.vault.getAllLoadedFiles as jest.Mock).mockReturnValue([
        { children: [] },
        {},
        {}
      ]);
      
      (app.vault.getMarkdownFiles as jest.Mock).mockReturnValue([{}, {}]);
      
      const context = await ExecutionContextEnhancer.providers.vaultStats.getContext(app);
      
      expect(context.totalFiles).toBe(3);
      expect(context.totalMarkdownFiles).toBe(2);
      expect(context.totalFolders).toBe(1);
    });
    
    it('should provide file metadata', async () => {
      const mockMetadata = {
        frontmatter: { title: 'Test' },
        headings: [{ level: 1, heading: 'Test' }],
        links: [{ link: 'test.md' }],
        tags: ['#test']
      };
      
      (app.metadataCache.getFileCache as jest.Mock).mockReturnValue(mockMetadata);
      (app.workspace.getActiveFile as jest.Mock).mockReturnValue({} as TFile);
      
      const context = await ExecutionContextEnhancer.providers.fileMetadata.getContext(app);
      
      expect(context).toEqual(mockMetadata);
    });
  });
});
