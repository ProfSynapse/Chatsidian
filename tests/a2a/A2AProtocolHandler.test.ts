/**
 * Tests for the A2A Protocol Handler
 * 
 * This file contains tests for the A2AProtocolHandler class, which implements
 * the A2A protocol specifics for message formatting, validation, and protocol flows.
 */

import { App } from 'obsidian';
import { EventBus } from '../../src/core/EventBus';
import { A2AProtocolHandler } from '../../src/a2a/A2AProtocolHandler';
import { A2AMessageType, TaskStatus } from '../../src/a2a/models/A2ATypes';

// Mock uuid for consistent testing
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid-1234')
}));

describe('A2AProtocolHandler', () => {
  let app: jest.Mocked<App>;
  let eventBus: jest.Mocked<EventBus>;
  let protocolHandler: A2AProtocolHandler;
  
  beforeEach(() => {
    // Mock dependencies
    app = {} as jest.Mocked<App>;
    eventBus = {
      emit: jest.fn()
    } as unknown as jest.Mocked<EventBus>;
    
    // Create protocol handler
    protocolHandler = new A2AProtocolHandler(app, eventBus);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Message Formatting', () => {
    it('should format a complete message correctly', () => {
      // Create message parameters
      const messageParams = {
        id: 'test-id',
        type: A2AMessageType.REQUEST,
        sender: { id: 'agent-a', name: 'Agent A' },
        recipient: { id: 'agent-b', name: 'Agent B' },
        content: 'Hello from Agent A',
        metadata: { timestamp: 1234567890, correlationId: 'corr-123' }
      };
      
      // Format message
      const formattedMessage = protocolHandler.formatMessage(messageParams);
      
      // Verify message
      expect(formattedMessage).toEqual(messageParams);
      
      // Verify event was emitted
      expect(eventBus.emit).toHaveBeenCalledWith('a2a:message:formatted', {
        messageId: 'test-id',
        message: messageParams
      });
    });
    
    it('should generate an ID if not provided', () => {
      // Create message parameters without ID
      const messageParams = {
        type: A2AMessageType.REQUEST,
        sender: { id: 'agent-a', name: 'Agent A' },
        recipient: { id: 'agent-b', name: 'Agent B' },
        content: 'Hello from Agent A'
      };
      
      // Format message
      const formattedMessage = protocolHandler.formatMessage(messageParams);
      
      // Verify ID was generated
      expect(formattedMessage.id).toBe('mock-uuid-1234');
    });
    
    it('should add default metadata if not provided', () => {
      // Create message parameters without metadata
      const messageParams = {
        type: A2AMessageType.REQUEST,
        sender: { id: 'agent-a', name: 'Agent A' },
        recipient: { id: 'agent-b', name: 'Agent B' },
        content: 'Hello from Agent A'
      };
      
      // Mock Date.now
      const originalDateNow = Date.now;
      Date.now = jest.fn().mockReturnValue(9876543210);
      
      try {
        // Format message
        const formattedMessage = protocolHandler.formatMessage(messageParams);
        
        // Verify metadata was added
        expect(formattedMessage.metadata).toEqual({ timestamp: 9876543210 });
      } finally {
        // Restore Date.now
        Date.now = originalDateNow;
      }
    });
    
    it('should add timestamp to metadata if not provided', () => {
      // Create message parameters with metadata but no timestamp
      const messageParams = {
        type: A2AMessageType.REQUEST,
        sender: { id: 'agent-a', name: 'Agent A' },
        recipient: { id: 'agent-b', name: 'Agent B' },
        content: 'Hello from Agent A',
        metadata: { correlationId: 'corr-123', timestamp: 0 } // Add timestamp with placeholder value
      };
      
      // Mock Date.now
      const originalDateNow = Date.now;
      Date.now = jest.fn().mockReturnValue(9876543210);
      
      try {
        // Format message
        const formattedMessage = protocolHandler.formatMessage(messageParams);
        
        // Verify timestamp was added
        expect(formattedMessage.metadata).toEqual({
          correlationId: 'corr-123',
          timestamp: 9876543210
        });
      } finally {
        // Restore Date.now
        Date.now = originalDateNow;
      }
    });
    
    it('should set empty content if not provided', () => {
      // Create message parameters without content
      const messageParams = {
        type: A2AMessageType.REQUEST,
        sender: { id: 'agent-a', name: 'Agent A' },
        recipient: { id: 'agent-b', name: 'Agent B' }
      };
      
      // Format message
      const formattedMessage = protocolHandler.formatMessage(messageParams);
      
      // Verify content was set to empty string
      expect(formattedMessage.content).toBe('');
    });
    
    it('should set recipient to null if not provided', () => {
      // Create message parameters without recipient
      const messageParams = {
        type: A2AMessageType.REQUEST,
        sender: { id: 'agent-a', name: 'Agent A' },
        content: 'Hello from Agent A'
      };
      
      // Format message
      const formattedMessage = protocolHandler.formatMessage(messageParams);
      
      // Verify recipient was set to null
      expect(formattedMessage.recipient).toBeNull();
    });
    
    it('should include optional fields if provided', () => {
      // Create message parameters with optional fields
      const messageParams = {
        type: A2AMessageType.REQUEST,
        sender: { id: 'agent-a', name: 'Agent A' },
        recipient: { id: 'agent-b', name: 'Agent B' },
        content: 'Hello from Agent A',
        task: {
          id: 'task-123',
          description: 'Test task',
          status: TaskStatus.PENDING
        },
        capabilities: {
          required: ['capability1', 'capability2'],
          optional: ['capability3']
        }
      };
      
      // Format message
      const formattedMessage = protocolHandler.formatMessage(messageParams);
      
      // Verify optional fields were included
      expect(formattedMessage.task).toEqual(messageParams.task);
      expect(formattedMessage.capabilities).toEqual(messageParams.capabilities);
    });
    
    it('should throw error if type is not provided', () => {
      // Create message parameters without type
      const messageParams = {
        sender: { id: 'agent-a', name: 'Agent A' },
        recipient: { id: 'agent-b', name: 'Agent B' },
        content: 'Hello from Agent A'
      };
      
      // Verify error is thrown
      expect(() => protocolHandler.formatMessage(messageParams)).toThrow('Message type is required');
    });
    
    it('should throw error if sender is not provided', () => {
      // Create message parameters without sender
      const messageParams = {
        type: A2AMessageType.REQUEST,
        recipient: { id: 'agent-b', name: 'Agent B' },
        content: 'Hello from Agent A'
      };
      
      // Verify error is thrown
      expect(() => protocolHandler.formatMessage(messageParams)).toThrow('Message sender is required');
    });
  });
  
  describe('Message Validation', () => {
    it('should validate a valid message', () => {
      // Create valid message
      const message = {
        id: 'test-id',
        type: A2AMessageType.REQUEST,
        sender: { id: 'agent-a', name: 'Agent A' },
        recipient: { id: 'agent-b', name: 'Agent B' },
        content: 'Hello from Agent A',
        metadata: { timestamp: 1234567890 }
      };
      
      // Validate message
      const result = protocolHandler.validateMessage(message);
      
      // Verify result
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
    
    it('should validate a broadcast message without recipient', () => {
      // Create broadcast message
      const message = {
        id: 'test-id',
        type: A2AMessageType.CAPABILITY_DISCOVERY,
        sender: { id: 'agent-a', name: 'Agent A' },
        content: 'Hello from Agent A',
        metadata: { timestamp: 1234567890 }
      };
      
      // Validate message
      const result = protocolHandler.validateMessage(message);
      
      // Verify result
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
    
    it('should invalidate a message with missing fields', () => {
      // Create invalid message
      const message = {
        type: A2AMessageType.REQUEST,
        sender: { id: 'agent-a' }, // Missing name
        content: 'Hello from Agent A'
        // Missing id, recipient, metadata
      };
      
      // Validate message
      const result = protocolHandler.validateMessage(message);
      
      // Verify result
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
      
      // Verify specific errors
      const errorFields = result.errors?.map(e => e.field);
      expect(errorFields).toContain('id');
      expect(errorFields).toContain('sender.name');
      expect(errorFields).toContain('recipient');
      expect(errorFields).toContain('metadata');
    });
    
    it('should invalidate a message with invalid type', () => {
      // Create message with invalid type
      const message = {
        id: 'test-id',
        type: 'INVALID_TYPE',
        sender: { id: 'agent-a', name: 'Agent A' },
        recipient: { id: 'agent-b', name: 'Agent B' },
        content: 'Hello from Agent A',
        metadata: { timestamp: 1234567890 }
      };
      
      // Validate message
      const result = protocolHandler.validateMessage(message);
      
      // Verify result
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      
      // Verify specific error
      const typeError = result.errors?.find(e => e.field === 'type');
      expect(typeError).toBeDefined();
      expect(typeError?.code).toBe('invalid_value');
    });
    
    it('should validate a message with task', () => {
      // Create message with task
      const message = {
        id: 'test-id',
        type: A2AMessageType.REQUEST,
        sender: { id: 'agent-a', name: 'Agent A' },
        recipient: { id: 'agent-b', name: 'Agent B' },
        content: 'Hello from Agent A',
        metadata: { timestamp: 1234567890 },
        task: {
          id: 'task-123',
          description: 'Test task',
          status: TaskStatus.PENDING
        }
      };
      
      // Validate message
      const result = protocolHandler.validateMessage(message);
      
      // Verify result
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
    
    it('should invalidate a message with invalid task', () => {
      // Create message with invalid task
      const message = {
        id: 'test-id',
        type: A2AMessageType.REQUEST,
        sender: { id: 'agent-a', name: 'Agent A' },
        recipient: { id: 'agent-b', name: 'Agent B' },
        content: 'Hello from Agent A',
        metadata: { timestamp: 1234567890 },
        task: {
          // Missing id, description
          status: 'INVALID_STATUS'
        }
      };
      
      // Validate message
      const result = protocolHandler.validateMessage(message);
      
      // Verify result
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      
      // Verify specific errors
      const errorFields = result.errors?.map(e => e.field);
      expect(errorFields).toContain('task.id');
      expect(errorFields).toContain('task.description');
      expect(errorFields).toContain('task.status');
    });
    
    it('should validate a message with capabilities', () => {
      // Create message with capabilities
      const message = {
        id: 'test-id',
        type: A2AMessageType.REQUEST,
        sender: { id: 'agent-a', name: 'Agent A' },
        recipient: { id: 'agent-b', name: 'Agent B' },
        content: 'Hello from Agent A',
        metadata: { timestamp: 1234567890 },
        capabilities: {
          required: ['capability1', 'capability2'],
          optional: ['capability3']
        }
      };
      
      // Validate message
      const result = protocolHandler.validateMessage(message);
      
      // Verify result
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
    
    it('should invalidate a message with invalid capabilities', () => {
      // Create message with invalid capabilities
      const message = {
        id: 'test-id',
        type: A2AMessageType.REQUEST,
        sender: { id: 'agent-a', name: 'Agent A' },
        recipient: { id: 'agent-b', name: 'Agent B' },
        content: 'Hello from Agent A',
        metadata: { timestamp: 1234567890 },
        capabilities: {
          // Missing required
          optional: 'not-an-array'
        }
      };
      
      // Validate message
      const result = protocolHandler.validateMessage(message);
      
      // Verify result
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      
      // Verify specific errors
      const errorFields = result.errors?.map(e => e.field);
      expect(errorFields).toContain('capabilities.required');
      expect(errorFields).toContain('capabilities.optional');
    });
    
    it('should handle null message', () => {
      // Validate null message
      const result = protocolHandler.validateMessage(null);
      
      // Verify result
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0].field).toBe('message');
    });
  });
  
  describe('Protocol Handlers', () => {
    it('should handle negotiation request', async () => {
      // Create request for negotiation (using REQUEST type since NEGOTIATION isn't defined)
      const request = {
        id: 'test-id',
        type: A2AMessageType.REQUEST,
        sender: { id: 'agent-a', name: 'Agent A' },
        recipient: { id: 'agent-b', name: 'Agent B' },
        content: 'Negotiation request',
        metadata: { timestamp: 1234567890, correlationId: 'corr-123' }
      };
      
      // Handle negotiation
      const response = await protocolHandler.handleNegotiation(request);
      
      // Verify response
      expect(response.type).toBe(A2AMessageType.RESPONSE);
      expect(response.sender.id).toBe('a2a_system');
      expect(response.recipient).toBe(request.sender);
      expect(response.metadata.correlationId).toBe('corr-123');
      expect(JSON.parse(response.content).accepted).toBe(true);
    });
    
    it('should handle negotiation error', async () => {
      // Create invalid negotiation request
      const request = {
        // Missing required fields
        sender: { id: 'agent-a' }
      };
      
      // Handle negotiation
      const response = await protocolHandler.handleNegotiation(request);
      
      // Verify response
      expect(response.type).toBe(A2AMessageType.ERROR);
      expect(response.sender.id).toBe('a2a_system');
      expect(response.recipient).toBe(request.sender);
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe('negotiation_error');
    });
    
    it('should handle task delegation', async () => {
      // Create task
      const task = {
        id: 'task-123',
        description: 'Test task',
        delegatedBy: { id: 'agent-a', name: 'Agent A' }
      };
      
      // Handle task delegation
      const result = await protocolHandler.handleTaskDelegation(task);
      
      // Verify result
      expect(result.taskId).toBe('task-123');
      expect(result.status).toBe(TaskStatus.COMPLETED);
      expect(result.result).toBeDefined();
      expect(result.completedBy.id).toBe('a2a_system');
      expect(result.completedAt).toBeDefined();
    });
    
    it('should handle task delegation error', async () => {
      // Create invalid task
      const task = {
        // Missing required fields
      };
      
      // Handle task delegation
      const result = await protocolHandler.handleTaskDelegation(task);
      
      // Verify result
      expect(result.status).toBe(TaskStatus.FAILED);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('task_delegation_error');
    });
    
    it('should handle capability discovery', () => {
      // Create capability discovery request
      const request = {
        id: 'test-id',
        type: A2AMessageType.CAPABILITY_DISCOVERY,
        sender: { id: 'agent-a', name: 'Agent A' },
        content: 'Capability discovery request',
        metadata: { timestamp: 1234567890, correlationId: 'corr-123' }
      };
      
      // Handle capability discovery
      const response = protocolHandler.handleCapabilityDiscovery(request);
      
      // Verify response
      expect(response.type).toBe(A2AMessageType.CAPABILITY_RESPONSE);
      expect(response.sender.id).toBe('a2a_system');
      expect(response.recipient).toBe(request.sender);
      expect(response.metadata.correlationId).toBe('corr-123');
      expect(JSON.parse(response.content)).toEqual([]);
    });
    
    it('should handle capability discovery error', () => {
      // Create invalid capability discovery request
      const request = {
        // Missing required fields
        sender: { id: 'agent-a' }
      };
      
      // Handle capability discovery
      const response = protocolHandler.handleCapabilityDiscovery(request);
      
      // Verify response
      expect(response.type).toBe(A2AMessageType.ERROR);
      expect(response.sender.id).toBe('a2a_system');
      expect(response.recipient).toBe(request.sender);
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe('capability_discovery_error');
    });
    
    it('should handle A2A error', () => {
      // Create error
      const error = {
        code: 'test_error',
        message: 'Test error message'
      };
      
      // Handle error
      const response = protocolHandler.handleError(error);
      
      // Verify response
      expect(response.type).toBe(A2AMessageType.ERROR);
      expect(response.sender.id).toBe('a2a_system');
      expect(response.recipient).toBeNull();
      expect(response.error).toBe(error);
    });
  });
});