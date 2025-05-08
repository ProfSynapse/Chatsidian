/**
 * ModelSelectorComponent Tests
 * 
 * This file contains tests for the ModelSelectorComponent.
 * It tests the integration of ModelSelector and AgentSelector components.
 */

import { ModelSelectorComponent, ModelSelectorComponentEventType } from '../../../src/ui/models/ModelSelectorComponent';
import { EventBus } from '../../../src/core/EventBus';
import { ProviderService } from '../../../src/services/ProviderService';
import { SettingsService } from '../../../src/services/SettingsService';
import { AgentSystem } from '../../../src/agents/AgentSystem';
import { ModelInfo } from '../../../src/models/Provider';
import { AgentDefinition, AgentRole } from '../../../src/agents/AgentTypes';
import { setupUITestEnvironment } from '../../utils/ui-test-utils';
import { App } from 'obsidian';
import { ModelSelectorEventType } from '../../../src/ui/models/ModelSelector';
import { AgentSelectorEventType } from '../../../src/ui/models/AgentSelector';

// Setup UI test environment
setupUITestEnvironment();

// Mock ProviderService
class MockProviderService {
  private models: ModelInfo[] = [
    {
      id: 'claude-3-opus',
      name: 'Claude 3 Opus',
      provider: 'anthropic',
      contextSize: 200000,
      supportsTools: true,
      supportsJson: true,
      maxOutputTokens: 4096
    },
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      contextSize: 128000,
      supportsTools: true,
      supportsJson: true,
      maxOutputTokens: 4096
    }
  ];

  getSupportedProviders(): string[] {
    return ['anthropic', 'openai', 'google'];
  }

  getAvailableModels(provider: string): ModelInfo[] {
    return this.models.filter(model => model.provider === provider);
  }

  getAllModels(): ModelInfo[] {
    return [...this.models];
  }

  findModelById(id: string): ModelInfo | null {
    return this.models.find(model => model.id === id) || null;
  }

  isProviderSupported(provider: string): boolean {
    return this.getSupportedProviders().includes(provider);
  }
}

// Mock SettingsService
class MockSettingsService {
  private settings = {
    provider: 'anthropic',
    model: 'claude-3-opus',
    defaultAgentId: 'default-agent',
    apiKey: 'mock-api-key'
  };

  getSettingsManager() {
    return {
      getSettings: () => this.settings,
      getProvider: () => this.settings.provider,
      getModel: () => this.settings.model,
      updateSettings: (newSettings: any) => {
        this.settings = { ...this.settings, ...newSettings };
      }
    };
  }
}

// Mock AgentSystem
class MockAgentSystem {
  private agents: AgentDefinition[] = [
    {
      id: 'default-agent',
      name: 'Default Agent',
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
      id: 'code-agent',
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

describe('ModelSelectorComponent', () => {
  let containerEl: HTMLElement;
  let eventBus: EventBus;
  let providerService: MockProviderService;
  let settingsService: MockSettingsService;
  let agentSystem: MockAgentSystem;
  let app: App;
  let modelSelectorComponent: ModelSelectorComponent;
  
  beforeEach(() => {
    // Create container element
    containerEl = document.createElement('div');
    document.body.appendChild(containerEl);
    
    // Create event bus
    eventBus = new EventBus();
    
    // Create services
    providerService = new MockProviderService();
    settingsService = new MockSettingsService();
    agentSystem = new MockAgentSystem();
    
    // Mock Obsidian App
    app = {} as App;
    
    // Create model selector component
    modelSelectorComponent = new ModelSelectorComponent(
      containerEl,
      eventBus,
      providerService as unknown as ProviderService,
      settingsService as unknown as SettingsService,
      agentSystem as unknown as AgentSystem,
      app
    );
  });
  
  afterEach(() => {
    // Clean up
    document.body.removeChild(containerEl);
  });
  
  test('renders component with header, model selector, and agent selector', () => {
    // Check if container has the correct class
    expect(containerEl.classList.contains('chatsidian-model-selector-component')).toBe(true);
    
    // Check if header exists
    const header = containerEl.querySelector('.chatsidian-model-selector-header');
    expect(header).not.toBeNull();
    
    // Check if title exists
    const title = header?.querySelector('.chatsidian-model-selector-title');
    expect(title?.textContent).toBe('Model & Agent Selection');
    
    // Check if settings button exists
    const settingsButton = header?.querySelector('.chatsidian-model-selector-settings-button');
    expect(settingsButton).not.toBeNull();
    
    // Check if model selector container exists
    const modelSelectorContainer = containerEl.querySelector('.chatsidian-model-selector-container');
    expect(modelSelectorContainer).not.toBeNull();
    
    // Check if agent selector container exists
    const agentSelectorContainer = containerEl.querySelector('.chatsidian-agent-selector-container');
    expect(agentSelectorContainer).not.toBeNull();
  });
  
  test('forwards model selected events', () => {
    // Set up spy on event bus
    const emitSpy = jest.spyOn(eventBus, 'emit');
    
    // Simulate model selected event
    const model = providerService.findModelById('claude-3-opus')!;
    eventBus.emit(ModelSelectorEventType.MODEL_SELECTED, { model });
    
    // Check if event was forwarded
    expect(emitSpy).toHaveBeenCalledWith(
      ModelSelectorComponentEventType.MODEL_SELECTED,
      expect.objectContaining({
        model
      })
    );
  });
  
  test('forwards provider changed events', () => {
    // Set up spy on event bus
    const emitSpy = jest.spyOn(eventBus, 'emit');
    
    // Simulate provider changed event
    eventBus.emit(ModelSelectorEventType.PROVIDER_CHANGED, { provider: 'openai' });
    
    // Check if event was forwarded
    expect(emitSpy).toHaveBeenCalledWith(
      ModelSelectorComponentEventType.PROVIDER_CHANGED,
      expect.objectContaining({
        provider: 'openai'
      })
    );
  });
  
  test('forwards agent selected events', () => {
    // Set up spy on event bus
    const emitSpy = jest.spyOn(eventBus, 'emit');
    
    // Simulate agent selected event
    const agent = agentSystem.getAgentDefinition('code-agent')!;
    eventBus.emit(AgentSelectorEventType.AGENT_SELECTED, { agent });
    
    // Check if event was forwarded
    expect(emitSpy).toHaveBeenCalledWith(
      ModelSelectorComponentEventType.AGENT_SELECTED,
      expect.objectContaining({
        agent
      })
    );
  });
  
  test('updates settings when model is selected', () => {
    // Get settings manager
    const settingsManager = settingsService.getSettingsManager();
    
    // Create a spy that will actually call the original method
    const updateSettingsSpy = jest.spyOn(settingsManager, 'updateSettings');
    
    // Ensure the spy is properly installed
    settingsService.getSettingsManager = jest.fn().mockReturnValue({
      ...settingsManager,
      updateSettings: updateSettingsSpy
    });
    
    // Simulate model selected event
    const model = providerService.findModelById('gpt-4o')!;
    eventBus.emit(ModelSelectorEventType.MODEL_SELECTED, { model });
    
    // Check if settings were updated
    expect(updateSettingsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'openai',
        model: 'gpt-4o'
      })
    );
  });
  
  test('updates settings when agent is selected', () => {
    // Get settings manager
    const settingsManager = settingsService.getSettingsManager();
    
    // Create a spy that will actually call the original method
    const updateSettingsSpy = jest.spyOn(settingsManager, 'updateSettings');
    
    // Ensure the spy is properly installed
    settingsService.getSettingsManager = jest.fn().mockReturnValue({
      ...settingsManager,
      updateSettings: updateSettingsSpy
    });
    
    // Simulate agent selected event
    const agent = agentSystem.getAgentDefinition('code-agent')!;
    eventBus.emit(AgentSelectorEventType.AGENT_SELECTED, { agent });
    
    // Check if settings were updated
    expect(updateSettingsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultAgentId: 'code-agent'
      })
    );
  });
  
  test('getSelectedModel returns the correct model', () => {
    // Initially should return the default model
    const initialModel = modelSelectorComponent.getSelectedModel();
    expect(initialModel?.id).toBe('claude-3-opus');
    
    // Simulate model selected event
    const newModel = providerService.findModelById('gpt-4o')!;
    eventBus.emit(ModelSelectorEventType.MODEL_SELECTED, { model: newModel });
    
    // Should return the new model
    const selectedModel = modelSelectorComponent.getSelectedModel();
    expect(selectedModel?.id).toBe('gpt-4o');
  });
  
  test('getSelectedAgent returns the correct agent', () => {
    // Initially should return the default agent
    const initialAgent = modelSelectorComponent.getSelectedAgent();
    expect(initialAgent?.id).toBe('default-agent');
    
    // Simulate agent selected event
    const newAgent = agentSystem.getAgentDefinition('code-agent')!;
    eventBus.emit(AgentSelectorEventType.AGENT_SELECTED, { agent: newAgent });
    
    // Should return the new agent
    const selectedAgent = modelSelectorComponent.getSelectedAgent();
    expect(selectedAgent?.id).toBe('code-agent');
  });
  
  test('setSelectedModel updates the selected model', () => {
    // Set selected model
    const result = modelSelectorComponent.setSelectedModel('gpt-4o');
    
    // Should return true for successful update
    expect(result).toBe(true);
    
    // Selected model should be updated
    const selectedModel = modelSelectorComponent.getSelectedModel();
    expect(selectedModel?.id).toBe('gpt-4o');
  });
  
  test('setSelectedAgent updates the selected agent', () => {
    // Set selected agent
    const result = modelSelectorComponent.setSelectedAgent('code-agent');
    
    // Should return true for successful update
    expect(result).toBe(true);
    
    // Selected agent should be updated
    const selectedAgent = modelSelectorComponent.getSelectedAgent();
    expect(selectedAgent?.id).toBe('code-agent');
  });
  
  test('setSelectedProvider updates the selected provider', () => {
    // Set selected provider
    modelSelectorComponent.setSelectedProvider('openai');
    
    // Selected model should be updated to an OpenAI model
    const selectedModel = modelSelectorComponent.getSelectedModel();
    expect(selectedModel?.provider).toBe('openai');
  });
  
  test('can be initialized with custom options', () => {
    // Clean up previous instance
    document.body.removeChild(containerEl);
    containerEl = document.createElement('div');
    document.body.appendChild(containerEl);
    
    // Create model selector component with custom options
    modelSelectorComponent = new ModelSelectorComponent(
      containerEl,
      eventBus,
      providerService as unknown as ProviderService,
      settingsService as unknown as SettingsService,
      agentSystem as unknown as AgentSystem,
      app,
      {
        showProviderSelector: false,
        showModelCapabilities: false,
        filterByProvider: false,
        filterByToolSupport: true,
        showBuiltInAgents: false,
        showCustomAgents: true,
        allowCreatingAgents: false,
        allowEditingAgents: false,
        allowDeletingAgents: false,
        showSettingsButton: false
      }
    );
    
    // Settings button should not exist
    const settingsButton = containerEl.querySelector('.chatsidian-model-selector-settings-button');
    expect(settingsButton).toBeNull();
  });
});
