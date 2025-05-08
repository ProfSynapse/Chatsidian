import { App, Events } from 'obsidian';
import { ExecutionPipeline } from '../../../src/mcp/execution/ExecutionPipeline';
import { Tool } from '../../../src/mcp/interfaces';
import { ExecutionContext } from '../../../src/mcp/execution/ExecutionContext';
import { PipelinePhase, ToolCall } from '../../../src/mcp/ToolManagerInterface';

describe('ExecutionPipeline', () => {
  let app: App;
  let events: Events;
  let pipeline: ExecutionPipeline;
  
  const mockTool: Tool = {
    name: 'testTool',
    description: 'Test tool',
    handler: jest.fn(),
    schema: {}
  };
  
  const mockToolCall: ToolCall = {
    id: 'test-123',
    name: 'testTool',
    arguments: { test: true },
    status: 'pending'
  };
  
  const mockContext: ExecutionContext = {
    tool: mockTool,
    toolCall: mockToolCall,
    params: { test: true },
    startTime: Date.now()
  };
  
  beforeEach(() => {
    app = new App();
    events = new Events();
    pipeline = new ExecutionPipeline(app, events);
  });
  
  describe('execute', () => {
    it('should execute tool handler', async () => {
      // Set up mock handler
      const mockResult = { success: true };
      mockTool.handler = jest.fn().mockResolvedValue(mockResult);
      
      // Execute
      const result = await pipeline.execute(mockContext);
      
      // Verify
      expect(result.status).toBe('success');
      expect(result.data).toEqual(mockResult);
      expect(result.metadata?.executionTime).toBeDefined();
    });
    
    it('should handle execution error', async () => {
      // Set up mock error
      const mockError = new Error('Test error');
      mockTool.handler = jest.fn().mockRejectedValue(mockError);
      
      // Execute and verify error
      const result = await pipeline.execute(mockContext);
      
      expect(result.status).toBe('error');
      expect(result.error).toBe('Test error');
      expect(result.metadata?.errorType).toBe('Error');
      expect(result.metadata?.errorStack).toBeDefined();
    });
    
    it('should respect abort signal', async () => {
      // Set up abortable handler
      const abortController = new AbortController();
      mockTool.handler = jest.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(resolve, 1000);
        });
      });
      
      // Start execution then abort
      const executePromise = pipeline.execute(mockContext, {
        signal: abortController.signal
      });
      
      abortController.abort();
      
      // Verify execution was aborted
      const result = await executePromise;
      expect(result.status).toBe('error');
      expect(result.error).toContain('aborted');
    });
  });
  
  describe('events', () => {
    it('should emit execution events', async () => {
      // Set up event spies
      const startSpy = jest.fn();
      const completeSpy = jest.fn();
      
      events.on('toolExecution:starting', startSpy);
      events.on('toolExecution:completed', completeSpy);
      
      // Execute
      await pipeline.execute(mockContext);
      
      // Verify events
      expect(startSpy).toHaveBeenCalledWith({
        toolName: mockTool.name,
        params: mockContext.params,
        timestamp: expect.any(Number)
      });
      
      expect(completeSpy).toHaveBeenCalledWith({
        toolName: mockTool.name,
        params: mockContext.params,
        result: expect.any(Object),
        timestamp: expect.any(Number)
      });
    });
    
    it('should emit error event on failure', async () => {
      // Set up error event spy
      const errorSpy = jest.fn();
      events.on('toolExecution:error', errorSpy);
      
      // Set up mock error
      const mockError = new Error('Test error');
      mockTool.handler = jest.fn().mockRejectedValue(mockError);
      
      // Execute
      await pipeline.execute(mockContext);
      
      // Verify error event
      expect(errorSpy).toHaveBeenCalledWith({
        toolName: mockTool.name,
        params: mockContext.params,
        error: 'Test error',
        metadata: expect.any(Object),
        timestamp: expect.any(Number)
      });
    });
  });
});
