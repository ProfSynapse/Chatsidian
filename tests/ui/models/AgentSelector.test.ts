/**
 * AgentSelector Component Tests
 * 
 * This file contains tests for the AgentSelector component.
 * It tests the rendering, event handling, and functionality of the agent selector.
 */

import { AgentSelector, AgentSelectorEventType } from '../../../src/ui/models/AgentSelector';
import { EventBus } from '../../../src/core/EventBus';
import { AgentSystem } from '../../../src/agents/AgentSystem';
import { AgentDefinition, AgentRole } from '../../../src/agents/AgentTypes';
import { setupUITestEnvironment } from '../../utils/ui-test-utils';

// Setup UI test environment
setupUITestEnvironment();

// Mock AgentSystem
class MockAgentSystem {
  private agents: AgentDefinition[] = [
    {
      id: 'general-assistant',
      name: 'General Assistant',
      role: AgentRole.GeneralAssistant,
      description: 'A general-purpose assistant',
      systemPrompt: 'You are a helpful assistant.',
      tools: [],
      defaultSettings: {
        model: 'claude-3-opus',
        temperature: 0.7,
        maxTokens: 4000,
        stream: true
      },
      builtIn: true,
      capabilities: ['General assistance', 'Answering questions'],
      limitations: ['Cannot access the internet'],
      created: Date.now(),
      modified: Date.now()
    },
    {
      id: 'code-assistant',
      name: 'Code Assistant',
      role: AgentRole.CodeAssistant,
      description: 'An assistant specialized in coding tasks',
      systemPrompt: 'You are a coding assistant.',
      tools: [],
      defaultSettings: {
        model: 'gpt-4o',
        temperature: 0.3,
        maxTokens: 8000,
        stream: true
      },
      builtIn: true,
      capabilities: ['Code generation', 'Code explanation', 'Debugging'],
      limitations: ['Cannot execute code'],
      created: Date.now(),
      modified: Date.now()
    },
    {
      id: 'custom-agent',
      name: 'Custom Agent',
      role: AgentRole.Custom,
      description: 'A custom agent',
      systemPrompt: 'You are a custom assistant.',
      tools: [],
      defaultSettings: {
        model: 'claude-3-sonnet',
        temperature: 0.5,
        maxTokens: 4000,
        stream: true
      },
      builtIn: false,
      emoji: '🚀',
      capabilities: ['Custom capability 1', 'Custom capability 2'],
      limitations: ['Custom limitation'],
      created: Date.now(),
      modified: Date.now()
    }
  ];

  getAllAgentDefinitions(): AgentDefinition[] {
    return [...this.agents];
  }

  getAgentDefinition(id: string): AgentDefinition | null {
    return this.agents.find(agent => agent.id === id) || null;
  }

  saveCustomAgentDefinition(agent: AgentDefinition): Promise<void> {
    const index = this.agents.findIndex(a => a.id === agent.id);
    if (index >= 0) {
      this.agents[index] = agent;
    } else {
      this.agents.push(agent);
    }
    return Promise.resolve();
  }

  deleteCustomAgentDefinition(id: string): Promise<void> {
    const index = this.agents.findIndex(agent => agent.id === id);
    if (index >= 0) {
      this.agents.splice(index, 1);
    }
    return Promise.resolve();
  }
}

describe('AgentSelector', () => {
  let containerEl: HTMLElement;
  let eventBus: EventBus;
  let agentSystem: MockAgentSystem;
  let agentSelector: AgentSelector;
  
  beforeEach(() => {
    // Create container element
    containerEl = document.createElement('div');
    document.body.appendChild(containerEl);
    
    // Create event bus
    eventBus = new EventBus();
    
    // Create agent system
    agentSystem = new MockAgentSystem();
    
    // Create agent selector with default options
    agentSelector = new AgentSelector(
      containerEl, 
      eventBus, 
      agentSystem as unknown as AgentSystem
    );
  });
  
  afterEach(() => {
    // Clean up
    document.body.removeChild(containerEl);
  });
  
  test('renders agent selector with header and dropdown', () => {
    // Check if container has the correct class
    expect(containerEl.classList.contains('chatsidian-agent-selector')).toBe(true);
    
    // Check if header exists
    const header = containerEl.querySelector('.chatsidian-agent-selector-header');
    expect(header).not.toBeNull();
    
    // Check if title exists
    const title = header?.querySelector('.chatsidian-selector-label');
    expect(title?.textContent).toBe('Agent');
    
    // Check if create button exists
    const createButton = header?.querySelector('.chatsidian-agent-create-button');
    expect(createButton).not.toBeNull();
    
    // Check if dropdown container exists
    const dropdownContainer = containerEl.querySelector('.chatsidian-dropdown-container');
    expect(dropdownContainer).not.toBeNull();
    
    // Check if agent icon exists
    const agentIcon = dropdownContainer?.querySelector('.chatsidian-agent-icon');
    expect(agentIcon).not.toBeNull();
    
    // Check if agent capabilities exists
    const agentCapabilities = containerEl.querySelector('.chatsidian-agent-capabilities');
    expect(agentCapabilities).not.toBeNull();
  });
  
  test('initializes with all agents in dropdown', () => {
    // Agent dropdown should have options for all agents
    const agentDropdown = containerEl.querySelector('.chatsidian-dropdown-container select') as HTMLSelectElement;
    
    // Should have options for all agents
    expect(agentDropdown.options.length).toBe(3);
    // Agents are sorted alphabetically by name, so "Code Assistant" comes first
    expect(agentDropdown.options[0].value).toBe('code-assistant');
    expect(agentDropdown.options[1].value).toBe('custom-agent');
    expect(agentDropdown.options[2].value).toBe('general-assistant');
  });
  
  test('displays agent capabilities for the selected agent', () => {
    // Agent capabilities should show information about the selected agent
    const agentCapabilities = containerEl.querySelector('.chatsidian-agent-capabilities');
    
    // Should show agent name for the first agent (Code Assistant due to alphabetical sorting)
    const agentName = agentCapabilities?.querySelector('.chatsidian-agent-name');
    expect(agentName?.textContent).toBe('Code Assistant');
    
    // Should show agent role for the first agent (Code Assistant due to alphabetical sorting)
    const agentRole = agentCapabilities?.querySelector('.chatsidian-agent-role');
    expect(agentRole?.textContent).toBe('Code Assistant');
    
    // Should show agent description for the first agent (Code Assistant due to alphabetical sorting)
    const agentDescription = agentCapabilities?.querySelector('.chatsidian-agent-description');
    expect(agentDescription?.textContent).toBe('An assistant specialized in coding tasks');
    
    // Should show agent capabilities for Code Assistant
    const capabilitiesItems = agentCapabilities?.querySelectorAll('.chatsidian-agent-capability-item');
    expect(capabilitiesItems?.length).toBe(3);
    expect(capabilitiesItems?.[0].textContent).toContain('Code generation');
    expect(capabilitiesItems?.[1].textContent).toContain('Code explanation');
    expect(capabilitiesItems?.[2].textContent).toContain('Debugging');
    
    // Should show agent limitations for Code Assistant
    const limitationsItems = agentCapabilities?.querySelectorAll('.chatsidian-agent-limitation-item');
    expect(limitationsItems?.length).toBe(1);
    expect(limitationsItems?.[0].textContent).toContain('Cannot execute code');
    
    // Should show model settings for Code Assistant
    const modelSetting = agentCapabilities?.querySelector('.chatsidian-agent-setting-item:nth-child(1)');
    expect(modelSetting?.textContent).toContain('Model:');
    expect(modelSetting?.textContent).toContain('gpt-4o');
    
    // Should show temperature setting for Code Assistant
    const temperatureSetting = agentCapabilities?.querySelector('.chatsidian-agent-setting-item:nth-child(2)');
    expect(temperatureSetting?.textContent).toContain('Temperature:');
    expect(temperatureSetting?.textContent).toContain('0.3');
    
    // Should show max tokens setting for Code Assistant
    const maxTokensSetting = agentCapabilities?.querySelector('.chatsidian-agent-setting-item:nth-child(3)');
    expect(maxTokensSetting?.textContent).toContain('Max Tokens:');
    expect(maxTokensSetting?.textContent).toContain('8000');
  });
  
  test('emits agent selected event when agent is changed', () => {
    // Set up spy on event bus
    const emitSpy = jest.spyOn(eventBus, 'emit');
    
    // Get agent dropdown
    const agentDropdown = containerEl.querySelector('.chatsidian-dropdown-container select') as HTMLSelectElement;
    
    // Change agent
    agentDropdown.value = 'code-assistant';
    agentDropdown.dispatchEvent(new Event('change'));
    
    // Check if event was emitted
    expect(emitSpy).toHaveBeenCalledWith(
      AgentSelectorEventType.AGENT_SELECTED,
      expect.objectContaining({
        agent: expect.objectContaining({
          id: 'code-assistant',
          name: 'Code Assistant',
          role: AgentRole.CodeAssistant
        })
      })
    );
  });
  
  test('updates agent capabilities when agent is changed', () => {
    // Get agent dropdown
    const agentDropdown = containerEl.querySelector('.chatsidian-dropdown-container select') as HTMLSelectElement;
    
    // Change agent to Code Assistant
    agentDropdown.value = 'code-assistant';
    agentDropdown.dispatchEvent(new Event('change'));
    
    // Agent capabilities should show information about the selected agent
    const agentCapabilities = containerEl.querySelector('.chatsidian-agent-capabilities');
    
    // Should show agent name for Code Assistant
    const agentName = agentCapabilities?.querySelector('.chatsidian-agent-name');
    expect(agentName?.textContent).toBe('Code Assistant');
    
    // Should show agent role for Code Assistant
    const agentRole = agentCapabilities?.querySelector('.chatsidian-agent-role');
    expect(agentRole?.textContent).toBe('Code Assistant');
    
    // Should show agent description for Code Assistant
    const agentDescription = agentCapabilities?.querySelector('.chatsidian-agent-description');
    expect(agentDescription?.textContent).toBe('An assistant specialized in coding tasks');
    
    // Should show agent capabilities for Code Assistant
    const capabilitiesItems = agentCapabilities?.querySelectorAll('.chatsidian-agent-capability-item');
    expect(capabilitiesItems?.length).toBe(3);
    expect(capabilitiesItems?.[0].textContent).toContain('Code generation');
    expect(capabilitiesItems?.[1].textContent).toContain('Code explanation');
    expect(capabilitiesItems?.[2].textContent).toContain('Debugging');
  });
  
  test('displays edit and delete buttons for custom agents', () => {
    // Get agent dropdown
    const agentDropdown = containerEl.querySelector('.chatsidian-dropdown-container select') as HTMLSelectElement;
    
    // Change agent to Custom Agent
    agentDropdown.value = 'custom-agent';
    agentDropdown.dispatchEvent(new Event('change'));
    
    // Agent capabilities should show information about the selected agent
    const agentCapabilities = containerEl.querySelector('.chatsidian-agent-capabilities');
    
    // Should show agent actions for custom agent
    const agentActions = agentCapabilities?.querySelector('.chatsidian-agent-actions');
    expect(agentActions).not.toBeNull();
    
    // Should show edit button
    const editButton = agentActions?.querySelector('.chatsidian-agent-edit-button');
    expect(editButton).not.toBeNull();
    
    // Should show delete button
    const deleteButton = agentActions?.querySelector('.chatsidian-agent-delete-button');
    expect(deleteButton).not.toBeNull();
  });
  
  test('does not display edit and delete buttons for built-in agents', () => {
    // Get agent dropdown
    const agentDropdown = containerEl.querySelector('.chatsidian-dropdown-container select') as HTMLSelectElement;
    
    // Change agent to General Assistant (built-in)
    agentDropdown.value = 'general-assistant';
    agentDropdown.dispatchEvent(new Event('change'));
    
    // Agent capabilities should show information about the selected agent
    const agentCapabilities = containerEl.querySelector('.chatsidian-agent-capabilities');
    
    // Should not show agent actions for built-in agent
    const agentActions = agentCapabilities?.querySelector('.chatsidian-agent-actions');
    expect(agentActions).toBeNull();
  });
  
  test('can be initialized with custom options', () => {
    // Clean up previous instance
    document.body.removeChild(containerEl);
    containerEl = document.createElement('div');
    document.body.appendChild(containerEl);
    
    // Create agent selector with custom options
    agentSelector = new AgentSelector(
      containerEl, 
      eventBus, 
      agentSystem as unknown as AgentSystem,
      {
        showBuiltInAgents: false,
        showCustomAgents: true,
        allowCreatingAgents: false,
        allowEditingAgents: false,
        allowDeletingAgents: false
      }
    );
    
    // Create button should not exist
    const createButton = containerEl.querySelector('.chatsidian-agent-create-button');
    expect(createButton).toBeNull();
    
    // Agent dropdown should only have custom agents
    const agentDropdown = containerEl.querySelector('.chatsidian-dropdown-container select') as HTMLSelectElement;
    expect(agentDropdown.options.length).toBe(1);
    expect(agentDropdown.options[0].value).toBe('custom-agent');
  });
  
  test('can be initialized with specific agent', () => {
    // Clean up previous instance
    document.body.removeChild(containerEl);
    containerEl = document.createElement('div');
    document.body.appendChild(containerEl);
    
    // Create agent selector with specific agent
    agentSelector = new AgentSelector(
      containerEl, 
      eventBus, 
      agentSystem as unknown as AgentSystem,
      {},
      'code-assistant'
    );
    
    // Agent dropdown should have the correct value
    const agentDropdown = containerEl.querySelector('.chatsidian-dropdown-container select') as HTMLSelectElement;
    expect(agentDropdown.value).toBe('code-assistant');
    
    // Selected agent should be correct
    expect(agentSelector.getSelectedAgent()?.id).toBe('code-assistant');
    expect(agentSelector.getSelectedAgent()?.name).toBe('Code Assistant');
  });
  
  test('setSelectedAgent updates the selected agent', () => {
    // Set selected agent
    const result = agentSelector.setSelectedAgent('code-assistant');
    
    // Should return true for successful update
    expect(result).toBe(true);
    
    // Selected agent should be updated
    expect(agentSelector.getSelectedAgent()?.id).toBe('code-assistant');
    
    // Agent dropdown should be updated
    const agentDropdown = containerEl.querySelector('.chatsidian-dropdown-container select') as HTMLSelectElement;
    expect(agentDropdown.value).toBe('code-assistant');
    
    // Agent capabilities should be updated
    const agentCapabilities = containerEl.querySelector('.chatsidian-agent-capabilities');
    const agentName = agentCapabilities?.querySelector('.chatsidian-agent-name');
    expect(agentName?.textContent).toBe('Code Assistant');
  });
  
  test('returns false when setting invalid agent', () => {
    // Set invalid agent
    const result = agentSelector.setSelectedAgent('non-existent-agent');
    
    // Should return false for failed update
    expect(result).toBe(false);
    
    // Selected agent should not be updated (code-assistant is the default due to alphabetical sorting)
    expect(agentSelector.getSelectedAgent()?.id).toBe('code-assistant');
  });
  
  test('displays emoji for agents with emoji', () => {
    // Get agent dropdown
    const agentDropdown = containerEl.querySelector('.chatsidian-dropdown-container select') as HTMLSelectElement;
    
    // Change agent to Custom Agent (has emoji)
    agentDropdown.value = 'custom-agent';
    agentDropdown.dispatchEvent(new Event('change'));
    
    // Agent capabilities should show information about the selected agent
    const agentCapabilities = containerEl.querySelector('.chatsidian-agent-capabilities');
    
    // Should show emoji
    const agentEmoji = agentCapabilities?.querySelector('.chatsidian-agent-emoji');
    expect(agentEmoji).not.toBeNull();
    expect(agentEmoji?.textContent).toBe('🚀');
  });
});
