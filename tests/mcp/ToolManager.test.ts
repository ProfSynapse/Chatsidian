/**
 * Tests for the ToolManager
 */

import { Events } from 'obsidian';
import { ToolManager } from '../../src/mcp/ToolManager';
import { BCPRegistry } from '../../src/mcp/BCPRegistry';
import { EventBus } from '../../src/core/EventBus';
import { Tool } from '../../src/mcp/interfaces';

// Mock app
const mockApp = {
  workspace: {
    containerEl: {
      createDiv: jest.fn(() => ({
        setText: jest.fn(),
        addClass: jest.fn(),
        removeClass: jest.fn()
      }))
    }
  }
} as any;

describe('ToolManager', () => {
  let toolManager: ToolManager;
  let bcpRegistry: BCPRegistry;
  let eventBus: EventBus;
  
  beforeEach(() => {
    // Create event bus
    eventBus = new EventBus();
    
    // Mock SettingsManager and VaultFacade
    const mockSettings = {
      getSettings: jest.fn().mockReturnValue({ autoLoadBCPs: [] })
    } as any;
    
    const mockVaultFacade = {
      // Add any methods needed for tests
    } as any;
    
    // Create BCP registry
    bcpRegistry = new BCPRegistry(mockApp, mockSettings, mockVaultFacade, eventBus);
    
    // Create tool manager
    toolManager = new ToolManager(mockApp, bcpRegistry, eventBus);
    
    // Spy on events
    jest.spyOn(eventBus, 'trigger');
  });
  
  afterEach(() => {
    // Clean up
    toolManager.unload();
    jest.clearAllMocks();
  });
  
  test('should create a tool manager', () => {
    expect(toolManager).toBeDefined();
  });
  
  test('should register and get tools', () => {
    // Create tool handler
    const handler = jest.fn().mockResolvedValue({ result: 'success' });
    
    // Register tool
    toolManager.registerTool(
      'test',
      'tool',
      'Test tool',
      handler,
      { type: 'object', properties: { foo: { type: 'string' } } }
    );
    
    // Get tools
    const tools = toolManager.getTools();
    
    // Check tools
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('test.tool');
    expect(tools[0].description).toBe('Test tool');
    expect(tools[0].handler).toBe(handler);
  });
  
  test('should unregister tools', () => {
    // Register tool
    toolManager.registerTool(
      'test',
      'tool',
      'Test tool',
      jest.fn().mockResolvedValue({ result: 'success' }),
      { type: 'object', properties: { foo: { type: 'string' } } }
    );
    
    // Unregister tool
    toolManager.unregisterTool('test', 'tool');
    
    // Get tools
    const tools = toolManager.getTools();
    
    // Check tools
    expect(tools).toHaveLength(0);
  });
  
  test('should check if tool exists', () => {
    // Register tool
    toolManager.registerTool(
      'test',
      'tool',
      'Test tool',
      jest.fn().mockResolvedValue({ result: 'success' }),
      { type: 'object', properties: { foo: { type: 'string' } } }
    );
    
    // Check if tool exists
    const exists = toolManager.hasTool('test.tool');
    const notExists = toolManager.hasTool('test.notool');
    
    // Check result
    expect(exists).toBe(true);
    expect(notExists).toBe(false);
  });
  
  test('should get tool count', () => {
    // Register tools
    toolManager.registerTool(
      'test',
      'tool1',
      'Test tool 1',
      jest.fn().mockResolvedValue({ result: 'success' }),
      { type: 'object', properties: { foo: { type: 'string' } } }
    );
    
    toolManager.registerTool(
      'test',
      'tool2',
      'Test tool 2',
      jest.fn().mockResolvedValue({ result: 'success' }),
      { type: 'object', properties: { bar: { type: 'string' } } }
    );
    
    // Get tool count
    const count = toolManager.getToolCount();
    
    // Check count
    expect(count).toBe(2);
  });
  
  test('should get tool by name', () => {
    // Create tool handler
    const handler = jest.fn().mockResolvedValue({ result: 'success' });
    
    // Register tool
    toolManager.registerTool(
      'test',
      'tool',
      'Test tool',
      handler,
      { type: 'object', properties: { foo: { type: 'string' } } }
    );
    
    // Get tool
    const tool = toolManager.getTool('test.tool');
    
    // Check tool
    expect(tool).toBeDefined();
    expect(tool?.name).toBe('test.tool');
    expect(tool?.description).toBe('Test tool');
    expect(tool?.handler).toBe(handler);
  });
  
  test('should get tool context', () => {
    // Register tool with context
    toolManager.registerTool(
      'test',
      'tool',
      'Test tool',
      jest.fn().mockResolvedValue({ result: 'success' }),
      { type: 'object', properties: { foo: { type: 'string' } } },
      { context: { bar: 'baz' } }
    );
    
    // Get tool context
    const context = toolManager.getToolContext('test.tool');
    
    // Check context
    expect(context).toEqual({ bar: 'baz' });
  });
  
  test('should validate tool parameters', () => {
    // Register tool
    toolManager.registerTool(
      'test',
      'tool',
      'Test tool',
      jest.fn().mockResolvedValue({ result: 'success' }),
      { 
        type: 'object', 
        properties: { 
          foo: { type: 'string' },
          bar: { type: 'number' }
        },
        required: ['foo']
      }
    );
    
    // Validate valid parameters
    const validResult = toolManager.validateParameters('test', 'tool', { foo: 'bar', bar: 42 });
    
    // Check valid result
    expect(validResult.valid).toBe(true);
    
    // Validate invalid parameters (missing required)
    const invalidResult = toolManager.validateParameters('test', 'tool', { bar: 42 });
    
    // Check invalid result - Ajv correctly validates that the required 'foo' parameter is missing
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors).toBeDefined();
  });
  
  test('should create a tool call', () => {
    // Create tool call
    const toolCall = toolManager.createToolCall('test.tool', { foo: 'bar' });
    
    // Check tool call
    expect(toolCall).toBeDefined();
    expect(toolCall.name).toBe('test.tool');
    expect(toolCall.arguments).toEqual({ foo: 'bar' });
    expect(toolCall.status).toBe('pending');
    expect(toolCall.id).toBeDefined();
    expect(toolCall.createdAt).toBeDefined();
  });
  
  test('should execute a tool call', async () => {
    // Create tool handler
    const handler = jest.fn().mockResolvedValue({ result: 'success' });
    
    // Register tool
    toolManager.registerTool(
      'test',
      'tool',
      'Test tool',
      handler,
      { type: 'object', properties: { foo: { type: 'string' } } }
    );
    
    // Create tool call
    const toolCall = toolManager.createToolCall('test.tool', { foo: 'bar' });
    
    // Execute tool call
    const result = await toolManager.executeToolCall(toolCall);
    
    // Check result
    expect(result).toEqual({ result: 'success' });
    
    // Check handler
    expect(handler).toHaveBeenCalledWith({ foo: 'bar' }, expect.any(Object));
    
    // Check tool call
    expect(toolCall.status).toBe('success');
    expect(toolCall.result).toEqual({ result: 'success' });
  });
  
  test('should handle tool execution errors', async () => {
    // Create tool handler
    const handler = jest.fn().mockRejectedValue(new Error('Tool error'));
    
    // Register tool
    toolManager.registerTool(
      'test',
      'tool',
      'Test tool',
      handler,
      { type: 'object', properties: { foo: { type: 'string' } } }
    );
    
    // Create tool call
    const toolCall = toolManager.createToolCall('test.tool', { foo: 'bar' });
    
    // Execute tool call
    await expect(toolManager.executeToolCall(toolCall)).rejects.toThrow('Tool error');
    
    // Check tool call
    expect(toolCall.status).toBe('error');
    expect(toolCall.error).toBe('Tool error');
  });
  
  test('should handle tool not found', async () => {
    // Create tool call
    const toolCall = toolManager.createToolCall('test.notool', { foo: 'bar' });
    
    // Execute tool call
    await expect(toolManager.executeToolCall(toolCall)).rejects.toThrow('Tool test.notool not found');
    
    // Check tool call
    expect(toolCall.status).toBe('error');
    expect(toolCall.error).toBe('Tool test.notool not found');
  });
  
  test('should check if execution is in progress', async () => {
    // Create tool handler that never resolves
    const handler = jest.fn().mockImplementation(() => new Promise(() => {}));
    
    // Register tool
    toolManager.registerTool(
      'test',
      'tool',
      'Test tool',
      handler,
      { type: 'object', properties: { foo: { type: 'string' } } }
    );
    
    // Create tool call
    const toolCall = toolManager.createToolCall('test.tool', { foo: 'bar' });
    
    // Start execution
    const promise = toolManager.executeToolCall(toolCall);
    
    // Check if execution is in progress
    expect(toolManager.isExecuting()).toBe(true);
    expect(toolManager.isExecuting(toolCall.id)).toBe(true);
    
    // Get active executions
    const activeExecutions = toolManager.getActiveExecutions();
    
    // Check active executions
    expect(activeExecutions).toHaveLength(1);
    expect(activeExecutions[0].id).toBe(toolCall.id);
    
    // Cancel execution
    await toolManager.cancelExecution(toolCall.id);
    
    // Check if execution is still in progress
    expect(toolManager.isExecuting()).toBe(false);
    expect(toolManager.isExecuting(toolCall.id)).toBe(false);
    
    // Catch the rejected promise
    await expect(promise).rejects.toThrow();
  });
  
  test('should get tools formatted for MCP', () => {
    // Register tools
    toolManager.registerTool(
      'test',
      'tool1',
      'Test tool 1',
      jest.fn().mockResolvedValue({ result: 'success' }),
      { type: 'object', properties: { foo: { type: 'string' } } }
    );
    
    toolManager.registerTool(
      'test',
      'tool2',
      'Test tool 2',
      jest.fn().mockResolvedValue({ result: 'success' }),
      { type: 'object', properties: { bar: { type: 'string' } } },
      { display: { showInSuggestions: false } }
    );
    
    // Get tools for MCP
    const tools = toolManager.getToolsForMCP();
    
    // Check tools
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('test.tool1');
    expect(tools[0].description).toBe('Test tool 1');
    expect(tools[0].parameters).toEqual({ type: 'object', properties: { foo: { type: 'string' } } });
  });
});
