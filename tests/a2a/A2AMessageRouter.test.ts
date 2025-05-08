/**
 * Tests for the A2A Message Router
 * 
 * This file contains tests for the A2AMessageRouter class, which routes
 * messages between agents based on addressing information.
 */

import { App } from 'obsidian';
import { EventBus } from '../../src/core/EventBus';
import { A2ARegistry } from '../../src/a2a/A2ARegistry';
import { A2AMessageRouter } from '../../src/a2a/A2AMessageRouter';
import { A2AMessageType } from '../../src/a2a/models/A2ATypes';

describe('A2AMessageRouter', () => {
  let app: jest.Mocked<App>;
  let eventBus: jest.Mocked<EventBus>;
  let registry: jest.Mocked<A2ARegistry>;
  let router: A2AMessageRouter;
  
  beforeEach(() => {
    // Mock dependencies
    app = {} as jest.Mocked<App>;
    eventBus = {
      emit: jest.fn(),
      on: jest.fn()
    } as unknown as jest.Mocked<EventBus>;
    
    registry = {
      getAllAgents: jest.fn().mockReturnValue([])
    } as unknown as jest.Mocked<A2ARegistry>;
    
    // Create router
    router = new A2AMessageRouter(app, eventBus, registry);
  });
  
  describe('Message Routing', () => {
    it('should route messages to registered handlers', async () => {
      // Create handler
      const handler = jest.fn().mockResolvedValue({
        id: 'response-id',
        type: A2AMessageType.RESPONSE,
        sender: { id: 'agent-b', name: 'Agent B' },
        recipient: { id: 'agent-a', name: 'Agent A' },
        content: 'Response from Agent B',
        metadata: { timestamp: Date.now() }
      });
      
      // Register handler
      router.registerHandler('agent-b', handler);
      
      // Create message
      const message = {
        id: 'message-id',
        type: A2AMessageType.REQUEST,
        sender: { id: 'agent-a', name: 'Agent A' },
        recipient: { id: 'agent-b', name: 'Agent B' },
        content: 'Hello from Agent A',
        metadata: { timestamp: Date.now() }
      };
      
      // Route message
      const response = await router.routeMessage(message);
      
      // Verify handler was called
      expect(handler).toHaveBeenCalledWith(message);
      
      // Verify response
      expect(response.content).toBe('Response from Agent B');
    });
    
    it('should handle errors during message routing', async () => {
      // Create handler that throws
      const handler = jest.fn().mockRejectedValue(new Error('Routing error'));
      
      // Register handler
      router.registerHandler('agent-b', handler);
      
      // Create message
      const message = {
        id: 'message-id',
        type: A2AMessageType.REQUEST,
        sender: { id: 'agent-a', name: 'Agent A' },
        recipient: { id: 'agent-b', name: 'Agent B' },
        content: 'Hello from Agent A',
        metadata: { timestamp: Date.now() }
      };
      
      // Route message should return an error message
      const response = await router.routeMessage(message);
      expect(response.type).toBe(A2AMessageType.ERROR);
      expect(response.error?.message).toBe('Routing error');
    });
  });
  
  describe('Broadcast Messages', () => {
    it('should broadcast messages to all agents', async () => {
      // Create handlers
      const handler1 = jest.fn().mockResolvedValue({
        id: 'response-1',
        type: A2AMessageType.RESPONSE,
        sender: { id: 'agent-1', name: 'Agent 1' },
        recipient: { id: 'agent-a', name: 'Agent A' },
        content: 'Response from Agent 1',
        metadata: { timestamp: Date.now() }
      });
      
      const handler2 = jest.fn().mockResolvedValue({
        id: 'response-2',
        type: A2AMessageType.RESPONSE,
        sender: { id: 'agent-2', name: 'Agent 2' },
        recipient: { id: 'agent-a', name: 'Agent A' },
        content: 'Response from Agent 2',
        metadata: { timestamp: Date.now() }
      });
      
      // Register handlers
      router.registerHandler('agent-1', handler1);
      router.registerHandler('agent-2', handler2);
      
      // Mock registry to return agents
      registry.getAllAgents.mockReturnValue([
        {
          id: 'agent-1',
          name: 'Agent 1',
          capabilities: [],
          endpoints: {
            messaging: '/a2a/agents/agent-1/messages',
            taskDelegation: '/a2a/agents/agent-1/tasks',
            capabilityDiscovery: '/a2a/agents/agent-1/capabilities'
          }
        },
        {
          id: 'agent-2',
          name: 'Agent 2',
          capabilities: [],
          endpoints: {
            messaging: '/a2a/agents/agent-2/messages',
            taskDelegation: '/a2a/agents/agent-2/tasks',
            capabilityDiscovery: '/a2a/agents/agent-2/capabilities'
          }
        },
        {
          id: 'agent-a',
          name: 'Agent A',
          capabilities: [],
          endpoints: {
            messaging: '/a2a/agents/agent-a/messages',
            taskDelegation: '/a2a/agents/agent-a/tasks',
            capabilityDiscovery: '/a2a/agents/agent-a/capabilities'
          }
        }
      ]);
      
      // Create message
      const message = {
        id: 'broadcast-id',
        type: A2AMessageType.REQUEST,
        sender: { id: 'agent-a', name: 'Agent A' },
        recipient: { id: '*', name: 'All Agents' },
        content: 'Hello from Agent A',
        metadata: { timestamp: Date.now() }
      };
      
      // Broadcast message
      await router.broadcastMessage(message);
      
      // Verify handlers were called
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });
  
  describe('Subscription Management', () => {
    it('should notify subscribers when messages match filter', () => {
      // Create callback
      const callback = jest.fn();
      
      // Create filter
      const filter = {
        sender: 'agent-a',
        type: A2AMessageType.REQUEST
      };
      
      // Subscribe
      const subscription = router.subscribeToMessages(filter, callback);
      
      // Create message that matches filter
      const message = {
        id: 'message-id',
        type: A2AMessageType.REQUEST,
        sender: { id: 'agent-a', name: 'Agent A' },
        recipient: { id: 'agent-b', name: 'Agent B' },
        content: 'Hello from Agent A',
        metadata: { timestamp: Date.now() }
      };
      
      // Simulate message routing
      (router as any).notifySubscribers(message);
      
      // Verify callback was called
      expect(callback).toHaveBeenCalledWith(message);
      
      // Unsubscribe
      subscription.unsubscribe();
      
      // Reset mock
      callback.mockReset();
      
      // Simulate another message routing
      (router as any).notifySubscribers(message);
      
      // Verify callback was not called after unsubscribing
      expect(callback).not.toHaveBeenCalled();
    });
  });
});