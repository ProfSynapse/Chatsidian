/**
 * Tests for the MCPClient
 * 
 * This file contains tests for the MCPClient class, which is responsible for
 * communicating with AI providers using the Model Context Protocol (MCP).
 */

import { Events } from 'obsidian';
import { MCPClient } from '../../../src/mcp/client/MCPClient';
import { SettingsManager } from '../../../src/core/SettingsManager';
import { ToolManager } from '../../../src/mcp/ToolManager';
import { EventBus } from '../../../src/core/EventBus';
import { 
  Message, 
  MessageRole, 
  Conversation,
  ProviderAdapter
} from '../../../src/mcp/client/MCPInterfaces';

// Mock the ProviderFactory import
jest.mock('../../../src/providers/ProviderFactory', () => ({
  ProviderFactory: {
    createProvider: jest.fn().mockImplementation(() => ({
      sendRequest: jest.fn().mockResolvedValue({
        message: {
          role: 'assistant',
          content: 'Mock response'
        }
      }),
      sendStreamingRequest: jest.fn().mockImplementation(async (request, onChunk) => {
        onChunk({ 
          id: 'chunk-1', 
          delta: { content: 'Mock ' },
          finish_reason: null
        });
        onChunk({ 
          id: 'chunk-2', 
          delta: { content: 'response' },
          finish_reason: 'stop'
        });
      }),
      testConnection: jest.fn().mockResolvedValue(true),
      getAvailableModels: jest.fn().mockResolvedValue([
        { id: 'model1', name: 'Model 1' },
        { id: 'model2', name: 'Model 2' }
      ])
    }))
  }
}));

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

// Mock provider adapter
class MockProviderAdapter implements ProviderAdapter {
  public sendMessage = jest.fn().mockImplementation(async () => ({
    role: MessageRole.Assistant,
    content: 'Mock response',
    timestamp: Date.now()
  }));
  
  public streamMessage = jest.fn().mockImplementation(async (messages, options, onChunk) => {
    // Call onChunk with some mock chunks
    onChunk({ type: 'content', content: 'Mock ' });
    onChunk({ type: 'content', content: 'response' });
    
    // Return complete message
    return {
      role: MessageRole.Assistant,
      content: 'Mock response',
      timestamp: Date.now()
    };
  });
  
  public testConnection = jest.fn().mockResolvedValue(true);
  
  public getAvailableModels = jest.fn().mockResolvedValue(['model1', 'model2']);
}

describe('MCPClient', () => {
  let mcpClient: MCPClient;
  let settingsManager: SettingsManager;
  let toolManager: ToolManager;
  let eventBus: EventBus;
  let mockProvider: MockProviderAdapter;
  
  beforeEach(async () => {
    // Create event bus
    eventBus = new EventBus();
    
    // Create settings manager
    settingsManager = {
      getSettings: jest.fn().mockReturnValue({
        provider: 'mock',
        apiKey: 'test-key',
        apiEndpoint: '',
        model: 'test-model',
        defaultTemperature: 0.7,
        defaultMaxTokens: 4000
      }),
      getApiKey: jest.fn().mockReturnValue('test-key'),
      updateSettings: jest.fn()
    } as any;
    
    // Create tool manager
    toolManager = {
      getToolsForMCP: jest.fn().mockReturnValue([
        {
          name: 'test.tool',
          description: 'Test tool',
          schema: { type: 'object', properties: {} }
        }
      ]),
      validateParameters: jest.fn().mockReturnValue({ valid: true }),
      executeToolCall: jest.fn().mockResolvedValue({ result: 'success' })
    } as any;
    
    // Create mock provider
    mockProvider = new MockProviderAdapter();
    
    // Create MCP client
    mcpClient = new MCPClient(mockApp, settingsManager, toolManager, eventBus);
    
    // Spy on events
    jest.spyOn(eventBus, 'emit');
    
    // Initialize the client
    await mcpClient.initialize();
    
    // Set provider directly
    (mcpClient as any).provider = mockProvider;
  });
  
  afterEach(() => {
    // Clean up
    mcpClient.unload();
    jest.clearAllMocks();
  });
  
  test('should create an MCP client', () => {
    expect(mcpClient).toBeDefined();
  });
  
  test('should send a message', async () => {
    // Create conversation
    const conversation: Conversation = {
      id: 'test-conversation',
      title: 'Test Conversation',
      messages: []
    };
    
    // Create message
    const message: Message = {
      role: MessageRole.User,
      content: 'Hello, world!',
      timestamp: Date.now()
    };
    
    // Send message
    const response = await mcpClient.sendMessage(conversation, message);
    
    // Check response
    expect(response).toBeDefined();
    expect(response.role).toBe(MessageRole.Assistant);
    expect(response.content).toBe('Mock response');
    
    // Check conversation
    expect(conversation.messages).toHaveLength(3);
    expect(conversation.messages[0].role).toBe(MessageRole.System);
    expect(conversation.messages[1].role).toBe(MessageRole.User);
    expect(conversation.messages[2].role).toBe(MessageRole.Assistant);
    expect(conversation.messages[2].content).toBe('Mock response');
    
    // Check provider
    expect(mockProvider.sendMessage).toHaveBeenCalled();
    
    // Check events
    expect(eventBus.emit).toHaveBeenCalledWith('mcp:sendingMessage', expect.any(Object));
    expect(eventBus.emit).toHaveBeenCalledWith('mcp:receivedMessage', expect.any(Object));
  });
  
  test('should stream a message', async () => {
    // Create conversation
    const conversation: Conversation = {
      id: 'test-conversation',
      title: 'Test Conversation',
      messages: []
    };
    
    // Create message
    const message: Message = {
      role: MessageRole.User,
      content: 'Hello, world!',
      timestamp: Date.now()
    };
    
    // Create chunk handler
    const onChunk = jest.fn();
    
    // Stream message
    const response = await mcpClient.streamMessage(conversation, message, {}, onChunk);
    
    // Check response
    expect(response).toBeDefined();
    expect(response.role).toBe(MessageRole.Assistant);
    expect(response.content).toBe('Mock response');
    
    // Check conversation
    expect(conversation.messages).toHaveLength(3);
    expect(conversation.messages[0].role).toBe(MessageRole.System);
    expect(conversation.messages[1].role).toBe(MessageRole.User);
    expect(conversation.messages[2].role).toBe(MessageRole.Assistant);
    expect(conversation.messages[2].content).toBe('Mock response');
    
    // Check provider
    expect(mockProvider.streamMessage).toHaveBeenCalled();
    
    // Check events
    expect(eventBus.emit).toHaveBeenCalledWith('mcp:streamingStart', expect.any(Object));
    expect(eventBus.emit).toHaveBeenCalledWith('mcp:streamingEnd', expect.any(Object));
  });
  
  test('should process tool calls', async () => {
    // Create conversation
    const conversation: Conversation = {
      id: 'test-conversation',
      title: 'Test Conversation',
      messages: []
    };
    
    // Create assistant message with tool calls
    const message: any = {
      role: MessageRole.Assistant,
      content: 'I will help you with that',
      tool_calls: [
        {
          id: 'tool-call-1',
          name: 'test.tool',
          arguments: { param: 'value' }
        }
      ],
      timestamp: Date.now()
    };
    
    // Process tool calls
    await mcpClient.processToolCalls(conversation, message);
    
    // Check conversation
    expect(conversation.messages).toHaveLength(1);
    expect(conversation.messages[0].role).toBe(MessageRole.Tool);
    
    // Check tool manager
    expect(toolManager.validateParameters).toHaveBeenCalled();
    expect(toolManager.executeToolCall).toHaveBeenCalled();
    
    // Check events
    expect(eventBus.emit).toHaveBeenCalledWith('mcp:toolCallStart', expect.any(Object));
    expect(eventBus.emit).toHaveBeenCalledWith('mcp:toolCallComplete', expect.any(Object));
  });
  
  test('should generate system prompt', () => {
    // Create conversation
    const conversation: Conversation = {
      id: 'test-conversation',
      title: 'Test Conversation',
      messages: [],
      metadata: {
        instructions: 'Custom instructions'
      }
    };
    
    // Generate system prompt
    const prompt = mcpClient.generateSystemPrompt(conversation);
    
    // Check prompt
    expect(prompt).toContain('You are a helpful assistant');
    expect(prompt).toContain('Custom instructions');
    expect(prompt).toContain('test.tool');
  });

  test('should handle initialization errors', async () => {
    // Mock settings to return no API key
    settingsManager.getApiKey = jest.fn().mockReturnValue(undefined);
    
    // Try to initialize
    await expect(mcpClient.initialize()).rejects.toThrow('No API key found for provider: mock');
  });

  test('should handle provider change events', async () => {
    // Create spy for initialize
    const initSpy = jest.spyOn(mcpClient, 'initialize');
    
    // Manually call the private method to register event listeners
    (mcpClient as any).registerEventListeners();
    
    // Trigger settings update event
    eventBus.emit('settings:updated', {
      changedKeys: ['provider', 'apiKey']
    });

    // Wait for any async operations
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check if initialize was called
    expect(initSpy).toHaveBeenCalled();
  });

  test('should handle errors during message sending', async () => {
    // Create conversation
    const conversation: Conversation = {
      id: 'test-conversation',
      title: 'Test Conversation',
      messages: []
    };

    // Create message
    const message: Message = {
      role: MessageRole.User,
      content: 'Hello, world!',
      timestamp: Date.now()
    };

    // Mock provider to throw error
    mockProvider.sendMessage.mockRejectedValueOnce(new Error('Provider error'));

    // Send message should throw
    await expect(mcpClient.sendMessage(conversation, message)).rejects.toThrow('Provider error');
    
    // Check error event was emitted
    expect(eventBus.emit).toHaveBeenCalledWith('mcp:error', expect.any(Object));
  });

  test('should handle streaming errors', async () => {
    // Create conversation
    const conversation: Conversation = {
      id: 'test-conversation',
      title: 'Test Conversation',
      messages: []
    };

    // Create message
    const message: Message = {
      role: MessageRole.User,
      content: 'Hello, world!',
      timestamp: Date.now()
    };

    // Mock provider to throw error
    mockProvider.streamMessage.mockRejectedValueOnce(new Error('Streaming error'));

    // Stream message should throw
    await expect(mcpClient.streamMessage(conversation, message)).rejects.toThrow('Streaming error');
    
    // Check error event was emitted
    expect(eventBus.emit).toHaveBeenCalledWith('mcp:error', expect.any(Object));
  });

  test('should handle errors in tool calls', async () => {
    // Create conversation
    const conversation: Conversation = {
      id: 'test-conversation',
      title: 'Test Conversation',
      messages: []
    };

    // Create assistant message with invalid tool call
    const message: any = {
      role: MessageRole.Assistant,
      content: 'I will help you with that',
      tool_calls: [
        {
          id: 'tool-call-1',
          name: 'invalid.tool',
          arguments: { param: 'value' }
        }
      ],
      timestamp: Date.now()
    };

    // Mock toolManager
    toolManager.executeToolCall = jest.fn().mockRejectedValue(new Error('Tool execution error'));

    // Process tool calls
    await mcpClient.processToolCalls(conversation, message);

    // Check conversation
    expect(conversation.messages[0].role).toBe(MessageRole.Tool);
    expect(conversation.messages[0].content).toContain('Error:');

    // Check error event was emitted
    expect(eventBus.emit).toHaveBeenCalledWith('mcp:error', expect.any(Object));
  });

  test('should handle provider getter/setter', () => {
    // Create new mock provider
    const newProvider = new MockProviderAdapter();

    // Set new provider
    mcpClient.setProvider(newProvider);

    // Get provider should return new provider
    expect(mcpClient.getProvider()).toBe(newProvider);

    // Set provider to undefined
    (mcpClient as any).provider = undefined;

    // Get provider should throw
    expect(() => mcpClient.getProvider()).toThrow('Provider not initialized');
  });

  test('should register and unregister event listeners', () => {
    // Create event handler
    const handler = jest.fn();

    // Register event listener
    mcpClient.on('test-event', handler);

    // Get access to events through private property
    const events = (mcpClient as any).events;

    // Trigger event
    events.trigger('test-event', { data: 'test' });

    // Handler should be called
    expect(handler).toHaveBeenCalledWith({ data: 'test' });

    // Unregister event listener
    mcpClient.off('test-event', handler);

    // Reset mock
    handler.mockReset();

    // Trigger event again
    events.trigger('test-event', { data: 'test' });

    // Handler should not be called
    expect(handler).not.toHaveBeenCalled();
  });

  test('should handle invalid tool parameters', async () => {
    // Create conversation
    const conversation: Conversation = {
      id: 'test-conversation',
      title: 'Test Conversation',
      messages: []
    };

    // Create assistant message with invalid parameters
    const message: any = {
      role: MessageRole.Assistant,
      content: 'I will help you with that',
      tool_calls: [
        {
          id: 'tool-call-1',
          name: 'test.tool',
          arguments: { invalid: 'value' }
        }
      ],
      timestamp: Date.now()
    };

    // Mock validation to fail
    toolManager.validateParameters = jest.fn().mockReturnValue({ 
      valid: false, 
      errors: ['Invalid parameter: invalid'] 
    });

    // Process tool calls
    await mcpClient.processToolCalls(conversation, message);

    // Check error was handled
    expect(conversation.messages[0].content).toContain('Invalid parameters:');
  });

  test('system prompt template exists', () => {
    // Initial state
    const testConversation: Conversation = {
      id: 'test-conversation',
      title: 'Test Conversation',
      messages: []
    };
    expect(mcpClient.generateSystemPrompt(testConversation)).toContain('You are a helpful assistant');
  });

  test('should handle tool errors gracefully', async () => {
    // Create conversation
    const conversation: Conversation = {
      id: 'test-conversation',
      title: 'Test Conversation',
      messages: []
    };

    // Create message with tool call
    const message: any = {
      role: MessageRole.Assistant,
      content: 'Let me help you with that',
      tool_calls: [
        {
          id: 'tool-1',
          name: 'test.tool',
          arguments: { param: 'value' }
        }
      ],
      timestamp: Date.now()
    };

    // Mock tool execution to throw error
    toolManager.executeToolCall = jest.fn().mockRejectedValue(new Error('Tool execution failed'));

    // Process tool calls
    await mcpClient.processToolCalls(conversation, message);

    // Check error message was added
    expect(conversation.messages[0].role).toBe(MessageRole.Tool);
    expect(conversation.messages[0].content).toContain('Tool execution failed');
    
    // Check error event was emitted
    expect(eventBus.emit).toHaveBeenCalledWith('mcp:error', expect.objectContaining({
      conversationId: 'test-conversation',
      error: expect.any(Error)
    }));
  });
});
