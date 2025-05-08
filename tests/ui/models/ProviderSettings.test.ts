/**
 * ProviderSettings Component Tests
 * 
 * This file contains tests for the ProviderSettings component.
 * It tests the rendering, event handling, and functionality of the provider settings.
 */

import { ProviderSettings, ProviderSettingsEventType, ProviderSettingsModal } from '../../../src/ui/models/ProviderSettings';
import { EventBus } from '../../../src/core/EventBus';
import { SettingsService } from '../../../src/services/SettingsService';
import { ProviderService } from '../../../src/services/ProviderService';
import { SettingsManager } from '../../../src/core/SettingsManager';
import { setupUITestEnvironment } from '../../utils/ui-test-utils';
import { App } from 'obsidian';

// Setup UI test environment
setupUITestEnvironment();

// Mock SettingsService
class MockSettingsService {
  private settings = {
    provider: 'anthropic',
    model: 'claude-3-opus',
    apiKey: 'mock-api-key',
    apiEndpoint: '',
    apiVersion: '2023-06-01'
  };

  getSettingsManager(): SettingsManager {
    return {
      getSettings: () => ({ ...this.settings }),
      getProvider: () => this.settings.provider,
      getModel: () => this.settings.model,
      updateSettings: (newSettings: any) => {
        this.settings = { ...this.settings, ...newSettings };
      },
      setApiKey: (apiKey: string) => {
        this.settings.apiKey = apiKey;
      }
    } as unknown as SettingsManager;
  }
}

// Mock ProviderService
class MockProviderService {
  getSupportedProviders(): string[] {
    return ['anthropic', 'openai', 'google', 'openrouter', 'custom'];
  }

  isProviderSupported(provider: string): boolean {
    return this.getSupportedProviders().includes(provider);
  }
}

describe('ProviderSettings', () => {
  let containerEl: HTMLElement;
  let eventBus: EventBus;
  let settingsService: MockSettingsService;
  let providerService: MockProviderService;
  let providerSettings: ProviderSettings;
  
  beforeEach(() => {
    // Create container element
    containerEl = document.createElement('div');
    document.body.appendChild(containerEl);
    
    // Create event bus
    eventBus = new EventBus();
    
    // Create services
    settingsService = new MockSettingsService();
    providerService = new MockProviderService();
    
    // Create provider settings
    providerSettings = new ProviderSettings(
      containerEl, 
      eventBus, 
      settingsService as unknown as SettingsService,
      providerService as unknown as ProviderService
    );
  });
  
  afterEach(() => {
    // Clean up
    document.body.removeChild(containerEl);
  });
  
  test('renders provider settings with header and provider selector', () => {
    // Check if container has the correct class
    expect(containerEl.classList.contains('chatsidian-provider-settings')).toBe(true);
    
    // Check if header exists
    const header = containerEl.querySelector('.chatsidian-provider-settings-header');
    expect(header).not.toBeNull();
    
    // Check if title exists
    const title = header?.querySelector('.chatsidian-provider-settings-title');
    expect(title?.textContent).toBe('Provider Settings');
    
    // Check if provider selector exists
    const providerSelector = containerEl.querySelector('.chatsidian-provider-selector');
    expect(providerSelector).not.toBeNull();
    
    // Check if provider buttons exist
    const providerButtons = providerSelector?.querySelectorAll('.chatsidian-provider-button');
    expect(providerButtons?.length).toBe(5); // anthropic, openai, google, openrouter, custom
    
    // Check if settings content exists
    const settingsContent = containerEl.querySelector('.chatsidian-provider-settings-content');
    expect(settingsContent).not.toBeNull();
    
    // Check if form exists
    const form = settingsContent?.querySelector('.chatsidian-provider-settings-form');
    expect(form).not.toBeNull();
    
    // Check if API key field exists
    const apiKeyField = form?.querySelector('.chatsidian-form-group:nth-child(1)');
    expect(apiKeyField?.querySelector('.chatsidian-form-label')?.textContent).toBe('API Key');
  });
  
  test('initializes with the correct provider selected', () => {
    // Default provider should be 'anthropic'
    expect(providerSettings.getSelectedProvider()).toBe('anthropic');
    
    // Anthropic button should be selected
    const anthropicButton = containerEl.querySelector('.chatsidian-provider-button:nth-child(1)');
    expect(anthropicButton?.classList.contains('chatsidian-provider-button-selected')).toBe(true);
    
    // Other buttons should not be selected
    const openaiButton = containerEl.querySelector('.chatsidian-provider-button:nth-child(2)');
    expect(openaiButton?.classList.contains('chatsidian-provider-button-selected')).toBe(false);
  });
  
  test('displays provider-specific settings for Anthropic', () => {
    // Check if API version field exists for Anthropic
    const form = containerEl.querySelector('.chatsidian-provider-settings-form');
    const apiVersionField = form?.querySelector('.chatsidian-form-group:nth-child(2)');
    expect(apiVersionField?.querySelector('.chatsidian-form-label')?.textContent).toBe('API Version');
    
    // API version input should have the correct value
    const apiVersionInput = apiVersionField?.querySelector('input');
    expect(apiVersionInput?.value).toBe('2023-06-01');
  });
  
  test('changes provider when provider button is clicked', () => {
    // Click OpenAI button
    const openaiButton = containerEl.querySelector('.chatsidian-provider-button:nth-child(2)');
    openaiButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    
    // Selected provider should be updated
    expect(providerSettings.getSelectedProvider()).toBe('openai');
    
    // After clicking, we need to get the buttons again because the component re-renders
    const updatedOpenaiButton = containerEl.querySelector('.chatsidian-provider-button:nth-child(2)');
    const updatedAnthropicButton = containerEl.querySelector('.chatsidian-provider-button:nth-child(1)');
    
    // OpenAI button should be selected
    expect(updatedOpenaiButton?.classList.contains('chatsidian-provider-button-selected')).toBe(true);
    
    // Anthropic button should not be selected
    expect(updatedAnthropicButton?.classList.contains('chatsidian-provider-button-selected')).toBe(false);
    
    // Check if OpenAI-specific settings are displayed
    const form = containerEl.querySelector('.chatsidian-provider-settings-form');
    const orgField = form?.querySelector('.chatsidian-form-group:nth-child(2)');
    expect(orgField?.querySelector('.chatsidian-form-label')?.textContent).toBe('Organization ID (optional)');
    
    // Check if beta features toggle exists
    const betaField = form?.querySelector('.chatsidian-form-group:nth-child(3)');
    expect(betaField?.querySelector('.chatsidian-form-label')?.textContent).toBe('Enable Beta Features');
  });
  
  test('emits settings updated event when provider is changed', () => {
    // Set up spy on event bus
    const emitSpy = jest.spyOn(eventBus, 'emit');
    
    // Click OpenAI button
    const openaiButton = containerEl.querySelector('.chatsidian-provider-button:nth-child(2)');
    openaiButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    
    // Check if event was emitted
    expect(emitSpy).toHaveBeenCalledWith(
      ProviderSettingsEventType.SETTINGS_UPDATED,
      expect.objectContaining({
        provider: 'openai'
      })
    );
  });
  
  test('emits API key updated event when API key is changed', () => {
    // Set up spy on event bus
    const emitSpy = jest.spyOn(eventBus, 'emit');
    
    // Get API key input
    const apiKeyInput = containerEl.querySelector('.chatsidian-form-group:nth-child(1) input') as HTMLInputElement;
    
    // Change API key
    apiKeyInput.value = 'new-api-key';
    apiKeyInput.dispatchEvent(new Event('change'));
    
    // Check if event was emitted
    expect(emitSpy).toHaveBeenCalledWith(
      ProviderSettingsEventType.API_KEY_UPDATED,
      expect.objectContaining({
        provider: 'anthropic',
        apiKey: 'new-api-key'
      })
    );
  });
  
  test('updates settings when API key is changed', () => {
    // Clean up previous instance
    document.body.removeChild(containerEl);
    containerEl = document.createElement('div');
    document.body.appendChild(containerEl);
    
    // Create a new settings service with a spy
    const newSettingsService = new MockSettingsService();
    const settingsManager = newSettingsService.getSettingsManager();
    const setApiKeySpy = jest.spyOn(settingsManager, 'setApiKey');
    
    // Mock the getSettingsManager method to return our spied manager
    newSettingsService.getSettingsManager = jest.fn().mockReturnValue(settingsManager);
    
    // Create a new provider settings with the spied service
    const newProviderSettings = new ProviderSettings(
      containerEl, 
      eventBus, 
      newSettingsService as unknown as SettingsService,
      providerService as unknown as ProviderService
    );
    
    // Get API key input
    const apiKeyInput = containerEl.querySelector('.chatsidian-form-group:nth-child(1) input') as HTMLInputElement;
    
    // Change API key
    apiKeyInput.value = 'new-api-key';
    apiKeyInput.dispatchEvent(new Event('change'));
    
    // Check if settings were updated
    expect(setApiKeySpy).toHaveBeenCalledWith('new-api-key');
  });
  
  test('displays API endpoint field for custom provider', () => {
    // Click Custom button
    const customButton = containerEl.querySelector('.chatsidian-provider-button:nth-child(5)');
    customButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    
    // Check if API endpoint field exists
    const form = containerEl.querySelector('.chatsidian-provider-settings-form');
    const apiEndpointField = form?.querySelector('.chatsidian-form-group:nth-child(2)');
    expect(apiEndpointField?.querySelector('.chatsidian-form-label')?.textContent).toBe('API Endpoint');
    
    // Check if model format field exists
    const modelFormatField = form?.querySelector('.chatsidian-form-group:nth-child(3)');
    expect(modelFormatField?.querySelector('.chatsidian-form-label')?.textContent).toBe('Model Format');
    
    // Check if custom headers field exists
    const headersField = form?.querySelector('.chatsidian-form-group:nth-child(4)');
    expect(headersField?.querySelector('.chatsidian-form-label')?.textContent).toBe('Custom Headers (JSON)');
  });
  
  test('emits API endpoint updated event when API endpoint is changed', () => {
    // Set up spy on event bus
    const emitSpy = jest.spyOn(eventBus, 'emit');
    
    // Click Custom button
    const customButton = containerEl.querySelector('.chatsidian-provider-button:nth-child(5)');
    customButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    
    // Get API endpoint input
    const apiEndpointInput = containerEl.querySelector('.chatsidian-form-group:nth-child(2) input') as HTMLInputElement;
    
    // Change API endpoint
    apiEndpointInput.value = 'https://custom-api.example.com';
    apiEndpointInput.dispatchEvent(new Event('change'));
    
    // Check if event was emitted
    expect(emitSpy).toHaveBeenCalledWith(
      ProviderSettingsEventType.API_ENDPOINT_UPDATED,
      expect.objectContaining({
        provider: 'custom',
        apiEndpoint: 'https://custom-api.example.com'
      })
    );
  });
  
  test('updates settings when API endpoint is changed', () => {
    // Clean up previous instance
    document.body.removeChild(containerEl);
    containerEl = document.createElement('div');
    document.body.appendChild(containerEl);
    
    // Create a new settings service with a spy
    const newSettingsService = new MockSettingsService();
    const settingsManager = newSettingsService.getSettingsManager();
    const updateSettingsSpy = jest.spyOn(settingsManager, 'updateSettings');
    
    // Mock the getSettingsManager method to return our spied manager
    newSettingsService.getSettingsManager = jest.fn().mockReturnValue(settingsManager);
    
    // Create a new provider settings with the spied service
    const newProviderSettings = new ProviderSettings(
      containerEl, 
      eventBus, 
      newSettingsService as unknown as SettingsService,
      providerService as unknown as ProviderService,
      'custom' // Initialize with custom provider
    );
    
    // Get API endpoint input
    const apiEndpointInput = containerEl.querySelector('.chatsidian-form-group:nth-child(2) input') as HTMLInputElement;
    
    // Change API endpoint
    apiEndpointInput.value = 'https://custom-api.example.com';
    apiEndpointInput.dispatchEvent(new Event('change'));
    
    // Check if settings were updated
    expect(updateSettingsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        apiEndpoint: 'https://custom-api.example.com'
      })
    );
  });
  
  test('can be initialized with specific provider', () => {
    // Clean up previous instance
    document.body.removeChild(containerEl);
    containerEl = document.createElement('div');
    document.body.appendChild(containerEl);
    
    // Create provider settings with specific provider
    providerSettings = new ProviderSettings(
      containerEl, 
      eventBus, 
      settingsService as unknown as SettingsService,
      providerService as unknown as ProviderService,
      'openai'
    );
    
    // Selected provider should be 'openai'
    expect(providerSettings.getSelectedProvider()).toBe('openai');
    
    // OpenAI button should be selected
    const openaiButton = containerEl.querySelector('.chatsidian-provider-button:nth-child(2)');
    expect(openaiButton?.classList.contains('chatsidian-provider-button-selected')).toBe(true);
  });
  
  test('setSelectedProvider updates the selected provider', () => {
    // Set selected provider
    providerSettings.setSelectedProvider('google');
    
    // Selected provider should be updated
    expect(providerSettings.getSelectedProvider()).toBe('google');
    
    // Google button should be selected
    const googleButton = containerEl.querySelector('.chatsidian-provider-button:nth-child(3)');
    expect(googleButton?.classList.contains('chatsidian-provider-button-selected')).toBe(true);
    
    // Check if Google-specific settings are displayed
    const form = containerEl.querySelector('.chatsidian-provider-settings-form');
    const projectIdField = form?.querySelector('.chatsidian-form-group:nth-child(2)');
    expect(projectIdField?.querySelector('.chatsidian-form-label')?.textContent).toBe('Project ID');
  });
});

describe('ProviderSettingsModal', () => {
  let app: App;
  let eventBus: EventBus;
  let settingsService: MockSettingsService;
  let providerService: MockProviderService;
  let modal: ProviderSettingsModal;
  
  beforeEach(() => {
    // Mock Obsidian App
    app = {
      workspace: {
        containerEl: document.createElement('div')
      }
    } as unknown as App;
    
    // Create event bus
    eventBus = new EventBus();
    
    // Create services
    settingsService = new MockSettingsService();
    providerService = new MockProviderService();
    
    // Create modal
    modal = new ProviderSettingsModal(
      app,
      eventBus,
      settingsService as unknown as SettingsService,
      providerService as unknown as ProviderService
    );
  });
  
  test('creates provider settings component when opened', () => {
    // Mock contentEl
    const contentEl = document.createElement('div');
    Object.defineProperty(modal, 'contentEl', {
      get: () => contentEl
    });
    
    // Open modal
    modal.onOpen();
    
    // Check if title exists
    const title = contentEl.querySelector('h2');
    expect(title?.textContent).toBe('Provider Settings');
    
    // Check if provider settings container exists
    const container = contentEl.querySelector('.chatsidian-provider-settings-modal-container');
    expect(container).not.toBeNull();
    
    // Check if provider settings component was created
    const providerSettings = contentEl.querySelector('.chatsidian-provider-settings');
    expect(providerSettings).not.toBeNull();
    
    // Check if close button exists
    const closeButton = contentEl.querySelector('.chatsidian-modal-buttons');
    expect(closeButton).not.toBeNull();
  });
  
  test('cleans up when closed', () => {
    // Mock contentEl
    const contentEl = document.createElement('div');
    Object.defineProperty(modal, 'contentEl', {
      get: () => contentEl
    });
    
    // Open modal
    modal.onOpen();
    
    // Create spy for empty method
    const emptySpy = jest.spyOn(contentEl, 'empty');
    
    // Close modal
    modal.onClose();
    
    // Check if contentEl was emptied
    expect(emptySpy).toHaveBeenCalled();
  });
});
