import { App, Events } from 'obsidian';
import { BCPRegistryForTests } from '../../src/mcp/BCPRegistryForTests';
import { ExecutionPipeline } from '../../src/mcp/execution/ExecutionPipeline';
import { ExecutionContextEnhancer } from '../../src/mcp/execution/ExecutionContextEnhancer';
import { MCPSchemaValidator } from '../../src/mcp/validation/MCPSchemaValidator';
import { ResultFormatter } from '../../src/mcp/formatting/ResultFormatter';
import { BoundedContextPack, Tool } from '../../src/mcp/interfaces';
import { ToolCall } from '../../src/mcp/ToolManagerInterface';
import { SettingsManager } from '../../src/core/SettingsManager';
import { EventBus } from '../../src/core/EventBus';
import { VaultFacade } from '../../src/core/VaultFacade';
import { ChatsidianSettings, DEFAULT_SETTINGS } from '../../src/models/Settings';
import { MockVaultFacade } from '../../src/mocks/MockVaultFacade';

describe('MCP Integration Tests', () => {
  let app: App;
  let events: Events;
  let settings: SettingsManager;
  let eventBus: EventBus;
  let bcpRegistry: BCPRegistryForTests;
  let pipeline: ExecutionPipeline;
  let contextEnhancer: ExecutionContextEnhancer;
  let validator: MCPSchemaValidator;
  let vault: MockVaultFacade;
  
  // Mock BCP for testing
  const testBCP: BoundedContextPack = {
    domain: 'test',
    description: 'Test BCP',
    tools: [
      {
        name: 'testTool',
        description: 'Test tool',
        schema: {
          type: 'object',
          properties: {
            input: { type: 'string' },
            count: { type: 'number' }
          },
          required: ['input']
        },
        handler: jest.fn().mockResolvedValue({ result: 'success' })
      }
    ]
  };
  
  beforeEach(() => {
    events = new Events();
    
    // Create Event Bus with all required methods
    eventBus = {
      emit: jest.fn(),
      emitAsync: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      once: jest.fn(),
      clear: jest.fn(),
      getEvents: jest.fn(),
      getHandlers: jest.fn(),
      hasListeners: jest.fn(),
      listenerCount: jest.fn(),
      getObsidianEventRef: jest.fn()
    } as unknown as EventBus;
    
    // Create Mock App
    const mockApp = {
      vault: {
        configDir: '/test/config',
        getAllLoadedFiles: jest.fn().mockReturnValue([]),
        getMarkdownFiles: jest.fn().mockReturnValue([]),
        getAbstractFileByPath: jest.fn(),
        adapter: {
          exists: jest.fn(),
          read: jest.fn(),
          write: jest.fn()
        }
      },
      workspace: {
        getActiveFile: jest.fn().mockReturnValue(null),
        activeLeaf: {
          getViewState: jest.fn().mockReturnValue({ type: 'markdown' })
        }
      },
      metadataCache: {
        getFileCache: jest.fn()
      },
      keymap: {},
      scope: {},
      commands: {},
      fileManager: {},
      lastEvent: null
    };
    
    app = mockApp as unknown as App;
    
    // Create Mock Vault
    vault = new MockVaultFacade();
    
    // Mock Settings Manager with all required methods
    settings = {
      settings: DEFAULT_SETTINGS,
      saveSettings: jest.fn(),
      eventBus,
      getSettings: jest.fn().mockReturnValue(DEFAULT_SETTINGS),
      updateSettings: jest.fn(),
      setApiKey: jest.fn(),
      getProvider: jest.fn(),
      getApiKey: jest.fn(),
      getModel: jest.fn(),
      getConversationsPath: jest.fn(),
      getDefaultSystemPrompt: jest.fn(),
      isDebugModeEnabled: jest.fn(),
      resetToDefaults: jest.fn()
    } as unknown as SettingsManager;
    
    // Initialize components with correct arguments
    bcpRegistry = new BCPRegistryForTests(app, settings, vault as unknown as VaultFacade, eventBus);
    pipeline = new ExecutionPipeline(app, events);
    contextEnhancer = new ExecutionContextEnhancer(app);
    validator = new MCPSchemaValidator();
  });
  
  describe('end-to-end tool execution', () => {
    it('should execute tool with validation and context enhancement', async () => {
      // Register test BCP
      await bcpRegistry.registerPack(testBCP);
      
      // Create tool call
      const toolCall: ToolCall = {
        id: 'test-123',
        name: 'testTool',
        arguments: {
          input: 'test data',
          count: 42
        },
        status: 'pending'
      };
      
      // Get tool definition
      const tool = testBCP.tools[0];
      
      // Validate parameters
      const validationResult = validator.validate(tool.schema, toolCall.arguments);
      expect(validationResult.valid).toBe(true);
      
      // Create execution context
      const baseContext = {
        tool,
        toolCall,
        params: toolCall.arguments,
        events,
        app
      };
      
      // Enhance context
      const enhancedContext = await contextEnhancer.enhance(baseContext, {
        includeEnv: true,
        includeWorkspace: true
      });
      
      // Execute tool
      const result = await pipeline.execute(enhancedContext);
      
      // Verify execution
      expect(result.status).toBe('success');
      expect(result.data).toBeDefined();
      expect(tool.handler).toHaveBeenCalled();
      
      // Format result
      const formatted = ResultFormatter.format(result);
      expect(formatted).toBeDefined();
    });
  });
  
  describe('error handling', () => {
    it('should handle tool execution errors', async () => {
      const errorBCP: BoundedContextPack = {
        ...testBCP,
        tools: [{
          ...testBCP.tools[0],
          handler: jest.fn().mockRejectedValue(new Error('Test error'))
        }]
      };
      
      await bcpRegistry.registerPack(errorBCP);
      
      const toolCall: ToolCall = {
        id: 'error-123',
        name: 'testTool',
        arguments: {
          input: 'test'
        },
        status: 'pending'
      };
      
      const tool = errorBCP.tools[0];
      const baseContext = {
        tool,
        toolCall,
        params: toolCall.arguments,
        events,
        app
      };
      
      const result = await pipeline.execute(baseContext);
      
      expect(result.status).toBe('error');
      expect(result.error).toBe('Test error');
    });
  });
});
