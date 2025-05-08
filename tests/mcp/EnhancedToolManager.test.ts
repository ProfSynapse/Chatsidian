import { App, Events } from 'obsidian';
import { EventBus } from '../../src/core/EventBus';
import { EnhancedToolManager } from '../../src/mcp/EnhancedToolManager';
import { Tool, BoundedContextPack } from '../../src/mcp/interfaces';
import { SettingsManager } from '../../src/core/SettingsManager';
import { VaultFacade } from '../../src/core/VaultFacade';
import { BCPRegistryMock } from '../mocks/BCPRegistryMock';

// Mock dependencies
jest.mock('obsidian');

describe('EnhancedToolManager', () => {
  let app: App;
  let eventBus: EventBus;
  let bcpRegistry: BCPRegistryMock;
  let toolManager: EnhancedToolManager;
  let settings: SettingsManager;
  let vaultFacade: VaultFacade;
  
  const mockTool: Tool = {
    name: 'testTool',
    description: 'Test tool',
    handler: jest.fn(),
    schema: { type: 'object', properties: {} }
  };
  
  const mockPack: BoundedContextPack = {
    domain: 'testDomain',
    description: 'Test pack',
    tools: [mockTool],
    version: '1.0.0'
  };
  
  beforeEach(() => {
    // Set up mocks
    app = new App();
    eventBus = new EventBus();
    settings = {
      getSettings: jest.fn().mockReturnValue({}),
      updateSettings: jest.fn()
    } as unknown as SettingsManager;
    vaultFacade = {} as VaultFacade;
    
    // Create BCP Registry with all required dependencies
    bcpRegistry = new BCPRegistryMock(app, settings, vaultFacade, eventBus);
    
    // Add mock pack to registry
    bcpRegistry.addMockPack(mockPack);
    bcpRegistry.setPackLoaded(mockPack.domain);
    
    // Create tool manager
    toolManager = new EnhancedToolManager(app, eventBus, bcpRegistry);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
    bcpRegistry.clearMocks();
  });
  
  describe('Tool Discovery', () => {
    it('should discover tools from a BCP domain', () => {
      // Set up spies
      const registerToolSpy = jest.spyOn(toolManager, 'registerTool');
      
      // Discover tools
      toolManager.discoverToolsFromPack('testDomain');
      
      // Verify tool was registered
      expect(registerToolSpy).toHaveBeenCalledWith(
        'testDomain',
        'testTool',
        mockTool.description,
        mockTool.handler,
        mockTool.schema,
        expect.any(Object)
      );
    });
    
    it('should store tool schemas', () => {
      // Discover tools
      toolManager.discoverToolsFromPack('testDomain');
      
      // Get schema
      const schema = toolManager.getToolSchema('testDomain.testTool');
      
      // Verify schema was stored
      expect(schema).toEqual(mockTool.schema);
    });
    
    it('should log warning if no tools found for domain', () => {
      // Mock console.warn
      const consoleSpy = jest.spyOn(console, 'warn');
      
      // Discover tools from nonexistent domain
      toolManager.discoverToolsFromPack('nonexistentDomain');
      
      // Verify warning was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot discover tools: BCP not found or empty')
      );
    });
  });
  
  describe('Tool Removal', () => {
    it('should remove tools from a BCP domain', () => {
      // First discover tools
      toolManager.discoverToolsFromPack('testDomain');
      
      // Set up spies
      const unregisterToolSpy = jest.spyOn(toolManager, 'unregisterTool');
      
      // Remove tools
      toolManager.removeToolsFromPack('testDomain');
      
      // Verify tool was unregistered
      expect(unregisterToolSpy).toHaveBeenCalledWith('testDomain', 'testTool');
    });
    
    it('should remove tool schemas', () => {
      // First discover tool
      toolManager.discoverToolsFromPack('testDomain');
      
      // Then remove tools
      toolManager.removeToolsFromPack('testDomain');
      
      // Get schema
      const schema = toolManager.getToolSchema('testDomain.testTool');
      
      // Verify schema was removed
      expect(schema).toBeUndefined();
    });
  });
  
  describe('Event Handling', () => {
    it('should handle pack loaded events', () => {
      // Directly test the event handler
      const discoverSpy = jest.spyOn(toolManager, 'discoverToolsFromPack');
      
      // Call the handler directly
      toolManager.onPackLoaded({ domain: 'testDomain' });
      
      // Verify tools were discovered
      expect(discoverSpy).toHaveBeenCalledWith('testDomain');
    });
    
    it('should handle pack unloaded events', () => {
      // First discover tools
      toolManager.discoverToolsFromPack('testDomain');
      
      // Set up spy
      const removeSpy = jest.spyOn(toolManager, 'removeToolsFromPack');
      
      // Call the handler directly
      toolManager.onPackUnloaded({ domain: 'testDomain' });
      
      // Verify tools were removed
      expect(removeSpy).toHaveBeenCalledWith('testDomain');
    });
    
    it('should register event listeners', () => {
      // Spy on eventBus.on
      const onSpy = jest.spyOn(eventBus, 'on');
      
      // Re-register event listeners
      toolManager.registerBCPEventListeners();
      
      // Verify listeners were registered
      expect(onSpy).toHaveBeenCalledWith('bcpRegistry:packLoaded', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('bcpRegistry:packUnloaded', expect.any(Function));
    });
  });
  
  describe('Tool Utilities', () => {
    it('should include schemas in getTools response', () => {
      // First discover tools
      toolManager.discoverToolsFromPack('testDomain');
      
      // Get tools
      const tools = toolManager.getTools();
      
      // Verify schema is included
      expect(tools[0].schema).toEqual(mockTool.schema);
    });
    
    it('should format tools for MCP', () => {
      // First discover tools
      toolManager.discoverToolsFromPack('testDomain');
      
      // Get MCP tools
      const mcpTools = toolManager.getToolsForMCP();
      
      // Verify format
      expect(mcpTools[0]).toEqual({
        name: 'testDomain.testTool',
        description: mockTool.description,
        parameters: mockTool.schema
      });
    });
    
    it('should discover all tools from loaded BCPs', () => {
      // Set up spy
      const discoverSpy = jest.spyOn(toolManager, 'discoverToolsFromPack');
      
      // Discover all tools
      toolManager.discoverAllTools();
      
      // Verify each domain was discovered
      expect(discoverSpy).toHaveBeenCalledWith('testDomain');
    });
  });
});
