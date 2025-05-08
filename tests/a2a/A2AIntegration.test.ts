import { App } from 'obsidian';
import { EventBus } from '../../src/core/EventBus';
import { AgentSystem } from '../../src/agents/AgentSystem';
import { Agent } from '../../src/agents/Agent';
import { 
  A2AAgentConnector, 
  A2ARegistry, 
  A2AMessageRouter, 
  A2AProtocolHandler,
  A2AMessageType,
  createA2AComponents
} from '../../src/a2a';
import { A2AAgentSystemIntegration } from '../../src/a2a/integration/AgentSystemIntegration';

// Mock dependencies
jest.mock('obsidian');
jest.mock('../../src/core/EventBus');
jest.mock('../../src/agents/AgentSystem');
jest.mock('../../src/agents/Agent');

describe('A2A Integration Tests', () => {
  // Test dependencies
  let app: jest.Mocked<App>;
  let eventBus: jest.Mocked<EventBus>;
  let agentSystem: jest.Mocked<AgentSystem>;
  
  // A2A components
  let a2aRegistry: A2ARegistry;
  let a2aMessageRouter: A2AMessageRouter;
  let a2aProtocolHandler: A2AProtocolHandler;
  let a2aAgentConnector: A2AAgentConnector;
  
  // Integration
  let integration: A2AAgentSystemIntegration;
  
  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mocks
    app = new App() as jest.Mocked<App>;
    eventBus = new EventBus() as jest.Mocked<EventBus>;
    agentSystem = new AgentSystem(
      app,
      eventBus,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    ) as jest.Mocked<AgentSystem>;
    
    // Create A2A components
    const components = createA2AComponents(app, eventBus);
    a2aRegistry = components.registry;
    a2aMessageRouter = components.messageRouter;
    a2aProtocolHandler = components.protocolHandler;
    a2aAgentConnector = components.agentConnector;
    
    // Create integration
    integration = new A2AAgentSystemIntegration(app, eventBus, agentSystem);
  });
  
  describe('Agent Registration', () => {
    it('should register an agent with A2A', async () => {
      // Create agent definition
      const agentDefinition = {
        id: 'test-agent',
        name: 'Test Agent',
        role: 'test' as any,
        description: 'Test agent',
        systemPrompt: 'Test prompt',
        tools: ['test-tool'],
        defaultSettings: {
          model: 'test-model',
          temperature: 0.5,
          maxTokens: 1000,
          stream: true
        },
        builtIn: false
      };
      
      // Create mock agent
      const agent = new Agent(app, agentDefinition, {} as any) as jest.Mocked<Agent>;
      agent.definition = agentDefinition;
      
      // Enable A2A for agent
      await integration.enableA2AForAgent(agent);
      
      // Check if agent was extended with A2A methods
      expect((agent as any).a2a).toBeDefined();
      expect((agent as any).a2a.enabled).toBe(true);
      expect(typeof (agent as any).a2a.sendMessage).toBe('function');
      expect(typeof (agent as any).a2a.discoverCapabilities).toBe('function');
      expect(typeof (agent as any).a2a.delegateTask).toBe('function');
    });
  });
  
  describe('Message Sending', () => {
    it('should have message sending capability', async () => {
      // Create agent definitions
      const agentADefinition = {
        id: 'agent-a',
        name: 'Agent A',
        role: 'test' as any,
        description: 'Test agent A',
        systemPrompt: 'Test prompt',
        tools: ['test-tool'],
        defaultSettings: {
          model: 'test-model',
          temperature: 0.5,
          maxTokens: 1000,
          stream: true
        },
        builtIn: false
      };
      
      // Create mock agent
      const agentA = new Agent(app, agentADefinition, {} as any) as jest.Mocked<Agent>;
      agentA.definition = agentADefinition;
      
      // Enable A2A for agent
      await integration.enableA2AForAgent(agentA);
      
      // Verify that agent has A2A message sending method
      expect((agentA as any).a2a).toBeDefined();
      expect((agentA as any).a2a.sendMessage).toBeDefined();
      expect(typeof (agentA as any).a2a.sendMessage).toBe('function');
    });
  });
  
  describe('Capability Discovery', () => {
    it('should have capability discovery functionality', async () => {
      // Create agent definition
      const agentDefinition = {
        id: 'test-agent',
        name: 'Test Agent',
        role: 'test' as any,
        description: 'Test agent',
        systemPrompt: 'Test prompt',
        tools: ['test-tool'],
        defaultSettings: {
          model: 'test-model',
          temperature: 0.5,
          maxTokens: 1000,
          stream: true
        },
        builtIn: false
      };
      
      // Create mock agent
      const agent = new Agent(app, agentDefinition, {} as any) as jest.Mocked<Agent>;
      agent.definition = agentDefinition;
      
      // Enable A2A for agent
      await integration.enableA2AForAgent(agent);
      
      // Verify that agent has A2A capability discovery method
      expect((agent as any).a2a).toBeDefined();
      expect((agent as any).a2a.discoverCapabilities).toBeDefined();
      expect(typeof (agent as any).a2a.discoverCapabilities).toBe('function');
    });
  });
  
  describe('Task Delegation', () => {
    it('should have task delegation functionality', async () => {
      // Create agent definition
      const agentADefinition = {
        id: 'agent-a',
        name: 'Agent A',
        role: 'test' as any,
        description: 'Test agent A',
        systemPrompt: 'Test prompt',
        tools: ['test-tool'],
        defaultSettings: {
          model: 'test-model',
          temperature: 0.5,
          maxTokens: 1000,
          stream: true
        },
        builtIn: false
      };
      
      // Create mock agent
      const agentA = new Agent(app, agentADefinition, {} as any) as jest.Mocked<Agent>;
      agentA.definition = agentADefinition;
      
      // Enable A2A for agent
      await integration.enableA2AForAgent(agentA);
      
      // Verify that agent has A2A task delegation method
      expect((agentA as any).a2a).toBeDefined();
      expect((agentA as any).a2a.delegateTask).toBeDefined();
      expect(typeof (agentA as any).a2a.delegateTask).toBe('function');
    });
  });
});