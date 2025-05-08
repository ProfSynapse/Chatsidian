/**
 * Tests for the A2A Registry
 * 
 * This file contains tests for the A2ARegistry class, which maintains
 * a registry of available agents, their capabilities, and endpoints.
 */

import { App } from 'obsidian';
import { EventBus } from '../../src/core/EventBus';
import { A2ARegistry } from '../../src/a2a/A2ARegistry';
import { AgentCapability } from '../../src/a2a/models/A2ATypes';

describe('A2ARegistry', () => {
  let app: jest.Mocked<App>;
  let eventBus: jest.Mocked<EventBus>;
  let registry: A2ARegistry;
  
  beforeEach(() => {
    // Mock dependencies
    app = {} as jest.Mocked<App>;
    eventBus = {
      emit: jest.fn()
    } as unknown as jest.Mocked<EventBus>;
    
    // Create registry
    registry = new A2ARegistry(app, eventBus);
  });
  
  describe('Agent Registration', () => {
    it('should register an agent correctly', () => {
      // Create capabilities
      const capabilities: AgentCapability[] = [
        {
          id: 'test-capability',
          name: 'Test Capability',
          version: '1.0.0',
          description: 'A test capability'
        }
      ];
      
      // Register agent
      registry.registerAgent('test-agent', capabilities);
      
      // Verify agent was registered
      const agent = registry.getAgent('test-agent');
      expect(agent).not.toBeNull();
      expect(agent?.id).toBe('test-agent');
      expect(agent?.capabilities).toEqual(capabilities);
      
      // Verify event was emitted
      expect(eventBus.emit).toHaveBeenCalledWith(
        'a2a:registry:agent:registered',
        expect.objectContaining({
          agentId: 'test-agent'
        })
      );
    });
    
    it('should update an existing agent', () => {
      // Register agent
      registry.registerAgent('test-agent', []);
      
      // Update capabilities
      const newCapabilities: AgentCapability[] = [
        {
          id: 'new-capability',
          name: 'New Capability',
          version: '1.0.0',
          description: 'A new capability'
        }
      ];
      
      // Update agent
      registry.registerAgent('test-agent', newCapabilities);
      
      // Verify agent was updated
      const agent = registry.getAgent('test-agent');
      expect(agent?.capabilities).toEqual(newCapabilities);
    });
  });
  
  describe('Agent Discovery', () => {
    it('should find agents by capability', () => {
      // Register agents with different capabilities
      registry.registerAgent('agent-1', [
        { id: 'cap-1', name: 'Capability 1', version: '1.0.0', description: 'Description 1' }
      ]);
      
      registry.registerAgent('agent-2', [
        { id: 'cap-2', name: 'Capability 2', version: '1.0.0', description: 'Description 2' }
      ]);
      
      registry.registerAgent('agent-3', [
        { id: 'cap-1', name: 'Capability 1', version: '1.0.0', description: 'Description 1' },
        { id: 'cap-3', name: 'Capability 3', version: '1.0.0', description: 'Description 3' }
      ]);
      
      // Find agents with capability 'cap-1'
      const agents = registry.findAgentsByCapability('cap-1');
      
      // Verify results
      expect(agents).toHaveLength(2);
      expect(agents.map(a => a.id)).toContain('agent-1');
      expect(agents.map(a => a.id)).toContain('agent-3');
    });
  });
  
  describe('Agent Endpoints', () => {
    it('should generate correct endpoints for agents', () => {
      // Register agent
      registry.registerAgent('test-agent', []);
      
      // Get agent
      const agent = registry.getAgent('test-agent');
      
      // Verify endpoints
      expect(agent?.endpoints.messaging).toBe('/a2a/agents/test-agent/messages');
      expect(agent?.endpoints.taskDelegation).toBe('/a2a/agents/test-agent/tasks');
      expect(agent?.endpoints.capabilityDiscovery).toBe('/a2a/agents/test-agent/capabilities');
    });
  });
});