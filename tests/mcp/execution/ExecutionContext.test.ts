import { App, Events } from 'obsidian';
import { ExecutionContext, createExecutionContext } from '../../../src/mcp/execution/ExecutionContext';
import { Tool } from '../../../src/mcp/interfaces';
import { ToolCall, ToolExecutionOptions } from '../../../src/mcp/ToolManagerInterface';

describe('ExecutionContext', () => {
  const toolCall: ToolCall = {
    id: 'test-123',
    name: 'testTool',
    arguments: { foo: 'bar' },
    status: 'pending'
  };
  
  const tool: Tool = {
    name: 'testTool',
    description: 'Test tool',
    handler: jest.fn(),
    schema: {}
  };
  
  it('should create basic context', () => {
    const context = createExecutionContext(toolCall, tool);
    
    expect(context.toolCall).toBe(toolCall);
    expect(context.tool).toBe(tool);
    expect(context.params).toEqual(toolCall.arguments);
    expect(context.startTime).toBeDefined();
  });
  
  it('should include tool context from options', () => {
    const options: ToolExecutionOptions = {
      context: { user: 'testUser' },
      silent: true
    };
    
    const context = createExecutionContext(toolCall, tool, options);
    
    expect(context.toolContext).toEqual(options.context);
  });
  
  it('should handle undefined options', () => {
    const context = createExecutionContext(toolCall, tool, undefined);
    
    expect(context.toolContext).toBeUndefined();
    expect(context.options).toEqual({});
  });
  
  describe('mergeExecutionContext', () => {
    const baseContext: ExecutionContext = {
      toolCall: {
        id: 'test-456',
        name: 'testTool',
        arguments: { baz: 'qux' },
        status: 'pending'
      },
      tool,
      params: { baz: 'qux' },
      toolContext: { user: 'testUser' },
      app: {} as App,
      events: new Events(),
      options: {},
      signal: undefined,
      startTime: Date.now(),
      skipRemaining: false,
      result: { success: true },
      error: new Error('Test error')
    };
    
    it('should merge new properties', () => {
      const additionalProps = {
        skipRemaining: true,
        result: { data: 'updated' }
      };
      
      const merged = createExecutionContext(toolCall, tool, {});
      Object.assign(merged, additionalProps);
      
      expect(merged.skipRemaining).toBe(true);
      expect(merged.result).toEqual({ data: 'updated' });
    });
  });
});
