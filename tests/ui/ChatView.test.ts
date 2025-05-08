/**
 * ChatView Component Tests
 * 
 * This file contains tests for the ChatView component.
 */

import { ChatView, CHAT_VIEW_TYPE } from '../../src/ui/ChatView';
import { EventBus } from '../../src/core/EventBus';
import { StorageManager } from '../../src/core/StorageManager';
import { SettingsService } from '../../src/services/SettingsService';
import { ProviderService } from '../../src/services/ProviderService';
import { AgentSystem } from '../../src/agents/AgentSystem';
import { WorkspaceLeaf, App } from 'obsidian';
import { 
  setupUITestEnvironment, 
  createComponentMocks, 
  applyComponentMocks, 
  applyAppMock,
  createMockWorkspaceLeaf
} from '../utils/ui-test-utils';

// Setup UI test environment
setupUITestEnvironment();

// Mock Services
class MockStorageManager {
  async getConversations() { return []; }
  async getConversation() { return null; }
  async createConversation(title = 'New Conversation') { 
    return {
      id: 'mock-id',
      title,
      created: Date.now(),
      updated: Date.now(),
      messages: []
    };
  }
  async saveConversation() { return; }
  async deleteConversation() { return; }
  async addMessage() { 
    return {
      id: 'mock-id',
      title: 'Mock Conversation',
      created: Date.now(),
      updated: Date.now(),
      messages: []
    };
  }
  async updateMessage() { 
    return {
      id: 'mock-id',
      title: 'Mock Conversation',
      created: Date.now(),
      updated: Date.now(),
      messages: []
    };
  }
  async initialize() { return; }
  async getFolders() { return []; }
}

class MockSettingsService {
  getSettingsManager() {
    return {
      getSettings: () => ({
        provider: 'anthropic',
        model: 'claude-3-opus',
        defaultAgentId: 'default-agent'
      }),
      getProvider: () => 'anthropic',
      getModel: () => 'claude-3-opus',
      updateSettings: jest.fn()
    };
  }
}

class MockProviderService {
  getSupportedProviders() {
    return ['anthropic', 'openai', 'google'];
  }
  
  getAvailableModels() {
    return [
      {
        id: 'claude-3-opus',
        name: 'Claude 3 Opus',
        provider: 'anthropic',
        contextSize: 200000,
        supportsTools: true
      }
    ];
  }
  
  getAllModels() {
    return this.getAvailableModels();
  }
  
  findModelById() {
    return this.getAvailableModels()[0];
  }
}

class MockAgentSystem {
  getAllAgentDefinitions() {
    return [
      {
        id: 'default-agent',
        name: 'Default Agent',
        description: 'A general-purpose assistant',
        systemPrompt: 'You are a helpful assistant.',
        tools: [],
        builtIn: true,
        defaultSettings: {
          model: 'claude-3-opus',
          temperature: 0.7,
          maxTokens: 4000,
          stream: true
        },
        role: 'GeneralAssistant',
        created: Date.now(),
        modified: Date.now()
      }
    ];
  }
  
  getAgentDefinition() {
    return this.getAllAgentDefinitions()[0];
  }
}

describe('ChatView', () => {
  let view: ChatView;
  let leaf: WorkspaceLeaf;
  let eventBus: EventBus;
  let storageManager: MockStorageManager;
  let settingsService: MockSettingsService;
  let providerService: MockProviderService;
  let agentSystem: MockAgentSystem;
  let app: App;
  
  beforeEach(() => {
    // Create a mock DOM environment
    document.body.innerHTML = '<div id="app"></div>';
    
    // Create mocks
    leaf = createMockWorkspaceLeaf(CHAT_VIEW_TYPE);
    eventBus = new EventBus();
    storageManager = new MockStorageManager();
    settingsService = new MockSettingsService();
    providerService = new MockProviderService();
    agentSystem = new MockAgentSystem();
    app = {} as App;
    
    // Create the view with type assertion
    view = new ChatView(
      leaf as unknown as WorkspaceLeaf, 
      eventBus, 
      storageManager as unknown as StorageManager,
      settingsService as unknown as SettingsService,
      providerService as unknown as ProviderService,
      agentSystem as unknown as AgentSystem
    );
    
    // Apply mocks to the view
    const mocks = createComponentMocks();
    applyComponentMocks(view, mocks);
    applyAppMock(view);
  });
  
  afterEach(() => {
    // Clean up
    document.body.innerHTML = '';
  });
  
  test('should initialize with correct view type', () => {
    expect(view.getViewType()).toBe(CHAT_VIEW_TYPE);
  });
  
  test('should have correct display text', () => {
    expect(view.getDisplayText()).toBe('Chatsidian');
  });
  
  test('should have correct icon', () => {
    expect(view.getIcon()).toBe('message-square');
  });
  
  test('should create UI elements on open', async () => {
    await view.onOpen();
    
    const containerEl = (leaf as any).containerEl;
    
    // Check that the container has the correct class
    expect(containerEl.classList.contains('chatsidian-container')).toBe(true);
    
    // Check that the sidebar container exists
    const sidebarContainer = containerEl.querySelector('.chatsidian-sidebar-container');
    expect(sidebarContainer).not.toBeNull();
    
    // Check that the content container exists
    const contentContainer = containerEl.querySelector('.chatsidian-content-container');
    expect(contentContainer).not.toBeNull();
    
    // Check that the hamburger toggle exists
    const hamburgerToggle = containerEl.querySelector('.chatsidian-hamburger-toggle');
    expect(hamburgerToggle).not.toBeNull();
    
    // Check that the header exists
    const header = containerEl.querySelector('.chatsidian-header');
    expect(header).not.toBeNull();
    
    // Check that the message area exists
    const messageArea = containerEl.querySelector('.chatsidian-message-area');
    expect(messageArea).not.toBeNull();
    
    // Check that the model selector component exists
    const modelSelectorComponent = containerEl.querySelector('.chatsidian-model-selector-component');
    expect(modelSelectorComponent).not.toBeNull();
  });
  
  test('should toggle sidebar when hamburger is clicked', async () => {
    await view.onOpen();
    
    const containerEl = (leaf as any).containerEl;
    const hamburgerToggle = containerEl.querySelector('.chatsidian-hamburger-toggle') as HTMLElement;
    
    // Initially sidebar should be closed
    expect(containerEl.classList.contains('chatsidian-sidebar-open')).toBe(false);
    
    // Click hamburger to open sidebar
    hamburgerToggle.click();
    expect(containerEl.classList.contains('chatsidian-sidebar-open')).toBe(true);
    
    // Click hamburger again to close sidebar
    hamburgerToggle.click();
    expect(containerEl.classList.contains('chatsidian-sidebar-open')).toBe(false);
  });
});
