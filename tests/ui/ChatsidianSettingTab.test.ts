/**
 * Tests for the ChatsidianSettingTab class.
 * 
 * This file contains tests for the ChatsidianSettingTab class, which provides
 * the settings UI for the Chatsidian plugin.
 */

import { ChatsidianSettingTab } from '../../src/core/SettingsManager';
import { App, PluginSettingTab } from '../../src/utils/obsidian-imports';
import { EventBus } from '../../src/core/EventBus';
import { SettingsManager } from '../../src/core/SettingsManager';
import { DEFAULT_SETTINGS } from '../../src/models/Settings';
import { SettingsService } from '../../src/services/SettingsService';
import { ProviderService } from '../../src/services/ProviderService';
import { AgentSystem } from '../../src/agents/AgentSystem';
import { AgentRole } from '../../src/agents/AgentTypes';

// Mock dependencies
jest.mock('../../src/ui/models/ModelSelectorComponent', () => {
  return {
    ModelSelectorComponent: jest.fn().mockImplementation(() => {
      return {
        render: jest.fn(),
        unload: jest.fn()
      };
    })
  };
});

jest.mock('../../src/ui/models/ProviderSettings', () => {
  return {
    ProviderSettings: jest.fn().mockImplementation(() => {
      return {
        render: jest.fn(),
        unload: jest.fn()
      };
    })
  };
});

describe('ChatsidianSettingTab', () => {
  let app: any;
  let plugin: any;
  let settingsTab: ChatsidianSettingTab;
  let eventBus: EventBus;
  let settingsManager: SettingsManager;
  let settingsService: SettingsService;
  let providerService: ProviderService;
  let agentSystem: AgentSystem;
  
  beforeEach(() => {
    // Create mocks
    app = {
      workspace: {},
      vault: {
        adapter: {
          write: jest.fn().mockResolvedValue(undefined),
          read: jest.fn().mockResolvedValue('{}')
        }
      },
      modal: {
        confirm: jest.fn().mockResolvedValue(true)
      }
    };
    
    eventBus = new EventBus();
    
    // Create settings manager
    settingsManager = new SettingsManager(
      DEFAULT_SETTINGS,
      async () => Promise.resolve(),
      eventBus
    );
    
    // Create provider service
    providerService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getSupportedProviders: jest.fn().mockReturnValue(['anthropic', 'openai', 'google', 'openrouter', 'custom']),
      isProviderSupported: jest.fn().mockReturnValue(true),
      getProviderAdapter: jest.fn(),
      getModelsForProvider: jest.fn().mockReturnValue([]),
      getEventBus: jest.fn().mockReturnValue(eventBus)
    } as unknown as ProviderService;
    
    // Create settings service
    settingsService = {
      initialize: jest.fn().mockResolvedValue(settingsManager),
      getSettingsManager: jest.fn().mockReturnValue(settingsManager),
      getEventBus: jest.fn().mockReturnValue(eventBus)
    } as unknown as SettingsService;
    
    // Create agent system
    agentSystem = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getAgentDefinitions: jest.fn().mockReturnValue([]),
      getAgentById: jest.fn(),
      createAgent: jest.fn(),
      deleteCustomAgentDefinition: jest.fn().mockResolvedValue(undefined)
    } as unknown as AgentSystem;
    
    // Create plugin mock
    plugin = {
      app,
      settings: settingsManager,
      eventBus,
      settingsService,
      providerService,
      agentSystem
    };
    
    // Create settings tab
    settingsTab = new ChatsidianSettingTab(app, plugin);
    
    // Mock DOM methods
    document.body.innerHTML = '<div></div>';
    settingsTab.containerEl = document.createElement('div');
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  test('should extend PluginSettingTab', () => {
    expect(settingsTab).toBeInstanceOf(PluginSettingTab);
  });
  
  test('should display settings UI', () => {
    // Mock createElement to track created elements
    const createElSpy = jest.spyOn(settingsTab.containerEl, 'createEl');
    const createDivSpy = jest.spyOn(settingsTab.containerEl, 'createDiv');
    
    // Call display method
    settingsTab.display();
    
    // Verify sections were created
    expect(createElSpy).toHaveBeenCalledWith('h2', { text: 'API Settings' });
    expect(createElSpy).toHaveBeenCalledWith('h2', { text: 'Agent Management' });
    expect(createElSpy).toHaveBeenCalledWith('h2', { text: 'Conversation Settings' });
    expect(createElSpy).toHaveBeenCalledWith('h2', { text: 'UI Settings' });
    expect(createElSpy).toHaveBeenCalledWith('h2', { text: 'Advanced Settings' });
    
    // Verify agent management container was created 
    expect(createDivSpy).toHaveBeenCalledWith({ cls: 'chatsidian-settings-agent-management' });
  });
  
  test('should update settings when changed', async () => {
    // Spy on settings manager
    const updateSettingsSpy = jest.spyOn(settingsManager, 'updateSettings');
    
    // Mock Setting class
    const mockSetting: any = {
      setName: jest.fn().mockReturnThis(),
      setDesc: jest.fn().mockReturnThis(),
      addDropdown: jest.fn().mockImplementation(cb => {
        const dropdown: any = {
          addOption: jest.fn().mockReturnThis(),
          setValue: jest.fn().mockReturnThis(),
          onChange: jest.fn().mockImplementation(fn => {
            // Simulate change event
            fn('openai');
            return dropdown;
          })
        };
        cb(dropdown);
        return mockSetting;
      })
    };
    
    // Mock Setting constructor
    const originalSetting = (global as any).Setting;
    (global as any).Setting = jest.fn().mockImplementation(() => mockSetting);
    
    // Call display method
    settingsTab.display();
    
    // Verify settings were updated
    expect(updateSettingsSpy).toHaveBeenCalledWith({ provider: 'openai' });
    
    // Restore original Setting
    (global as any).Setting = originalSetting;
  });
  
  test('should not create model selector component', () => {
    // Import the mocked class
    const { ModelSelectorComponent } = require('../../src/ui/models/ModelSelectorComponent');
    
    // Call display method
    settingsTab.display();
    
    // Verify ModelSelectorComponent was NOT created since it's been removed
    expect(ModelSelectorComponent).not.toHaveBeenCalled();
  });
  
  test('should not create provider settings component', () => {
    // Import the mocked class
    const { ProviderSettings } = require('../../src/ui/models/ProviderSettings');
    
    // Call display method
    settingsTab.display();
    
    // Verify ProviderSettings was NOT created since it's been removed
    expect(ProviderSettings).not.toHaveBeenCalled();
  });
  
  test('should handle custom agents', async () => {
    // Mock settings with custom agents
    const customAgents = [
      { 
        id: 'agent1', 
        name: 'Test Agent 1', 
        systemPrompt: 'You are a test agent',
        role: AgentRole.Custom,
        description: 'Test agent 1',
        tools: [],
        defaultSettings: {
          model: 'test-model',
          temperature: 0.7,
          maxTokens: 1000,
          stream: true
        },
        builtIn: false
      },
      { 
        id: 'agent2', 
        name: 'Test Agent 2', 
        systemPrompt: 'You are another test agent',
        role: AgentRole.Custom,
        description: 'Test agent 2',
        tools: [],
        defaultSettings: {
          model: 'test-model',
          temperature: 0.7,
          maxTokens: 1000,
          stream: true
        },
        builtIn: false
      }
    ];
    
    jest.spyOn(settingsManager, 'getSettings').mockReturnValue({
      ...DEFAULT_SETTINGS,
      customAgents
    });
    
    // Mock createElement to capture created elements
    const createElSpy = jest.spyOn(document.createElement('div'), 'createEl');
    
    // Call display method
    settingsTab.display();
    
    // Verify agent list was created
    expect(createElSpy).toHaveBeenCalledWith('ul', { cls: 'chatsidian-agent-list' });
  });
});
