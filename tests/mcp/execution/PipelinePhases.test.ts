import { App, Events } from 'obsidian';
import { ExecutionContext } from '../../../src/mcp/execution/ExecutionContext';
import { Tool } from '../../../src/mcp/interfaces';
import { PipelinePhase, ToolCall } from '../../../src/mcp/ToolManagerInterface';

describe('Pipeline Phases', () => {
  let app: App;
  let events: Events;
  
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
  });
  
  describe('validation phase', () => {
    it('should validate tool parameters', async () => {
      const validationPhase: PipelinePhase = {
        name: 'validation',
        execute: async (context: ExecutionContext) => {
          // Mock validation
          const { tool, params } = context;
          if (!params || Object.keys(params).length === 0) {
            throw new Error('Invalid parameters');
          }
        }
      };
      
      await expect(validationPhase.execute(mockContext))
        .resolves.not.toThrow();
    });
    
    it('should throw on invalid parameters', async () => {
      const invalidContext = {
        ...mockContext,
        params: {}
      };
      
      const validationPhase: PipelinePhase = {
        name: 'validation',
        execute: async (context: ExecutionContext) => {
          const { params } = context;
          if (!params || Object.keys(params).length === 0) {
            throw new Error('Invalid parameters');
          }
        }
      };
      
      await expect(validationPhase.execute(invalidContext))
        .rejects.toThrow('Invalid parameters');
    });
  });
  
  describe('preparation phase', () => {
    it('should prepare execution context', async () => {
      const preparationPhase: PipelinePhase = {
        name: 'preparation',
        execute: async (context: ExecutionContext) => {
          // Add needed properties to context
          context.startTime = Date.now();
          context.toolCall.status = 'running';
        }
      };
      
      await preparationPhase.execute(mockContext);
      
      expect(mockContext.startTime).toBeDefined();
      expect(mockContext.toolCall.status).toBe('running');
    });
  });
  
  describe('execution phase', () => {
    it('should execute tool handler', async () => {
      const mockResult = { success: true };
      mockTool.handler = jest.fn().mockResolvedValue(mockResult);
      
      const executionPhase: PipelinePhase = {
        name: 'execution',
        execute: async (context: ExecutionContext) => {
          const { tool, params } = context;
          context.result = await tool.handler(params);
        }
      };
      
      await executionPhase.execute(mockContext);
      
      expect(mockTool.handler).toHaveBeenCalledWith(mockContext.params);
      expect(mockContext.result).toEqual(mockResult);
    });
    
    it('should handle execution errors', async () => {
      const mockError = new Error('Test error');
      mockTool.handler = jest.fn().mockRejectedValue(mockError);
      
      const executionPhase: PipelinePhase = {
        name: 'execution',
        execute: async (context: ExecutionContext) => {
          try {
            const { tool, params } = context;
            context.result = await tool.handler(params);
          } catch (error) {
            context.error = error as Error;
            throw error;
          }
        }
      };
      
      await expect(executionPhase.execute(mockContext))
        .rejects.toThrow('Test error');
      
      expect(mockContext.error).toBe(mockError);
    });
  });
  
  describe('cleanup phase', () => {
    it('should clean up resources', async () => {
      const cleanupPhase: PipelinePhase = {
        name: 'cleanup',
        execute: async (context: ExecutionContext) => {
          // Update final status
          context.toolCall.status = 'completed';
          context.toolCall.completedAt = Date.now();
        }
      };
      
      await cleanupPhase.execute(mockContext);
      
      expect(mockContext.toolCall.status).toBe('completed');
      expect(mockContext.toolCall.completedAt).toBeDefined();
    });
  });
});
