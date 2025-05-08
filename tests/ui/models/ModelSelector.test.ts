/**
 * ModelSelector Component Tests
 * 
 * This file contains tests for the ModelSelector component.
 * It tests the rendering, event handling, and functionality of the model selector.
 */

import { ModelSelector, ModelSelectorEventType } from '../../../src/ui/models/ModelSelector';
import { EventBus } from '../../../src/core/EventBus';
import { ProviderService } from '../../../src/services/ProviderService';
import { ModelInfo } from '../../../src/models/Provider';
import { setupUITestEnvironment } from '../../utils/ui-test-utils';
import { ProviderType } from '../../../src/ui/models/ProviderType';

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
      id: 'claude-3-sonnet',
      name: 'Claude 3 Sonnet',
      provider: 'anthropic',
      contextSize: 180000,
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
    },
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      provider: 'openai',
      contextSize: 128000,
      supportsTools: true,
      supportsJson: true,
      maxOutputTokens: 4096
    },
    {
      id: 'gemini-pro',
      name: 'Gemini Pro',
      provider: 'google',
      contextSize: 32000,
      supportsTools: true,
      supportsJson: false,
      maxOutputTokens: 2048
    }
  ];

  getSupportedProviders(): string[] {
    return ['anthropic', 'openai', 'google', 'openrouter', 'custom'];
  }

  getAvailableModels(provider: ProviderType): ModelInfo[] {
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

describe('ModelSelector', () => {
  let containerEl: HTMLElement;
  let eventBus: EventBus;
  let providerService: MockProviderService;
  let modelSelector: ModelSelector;
  
  beforeEach(() => {
    // Create container element
    containerEl = document.createElement('div');
    document.body.appendChild(containerEl);
    
    // Create event bus
    eventBus = new EventBus();
    
    // Create provider service
    providerService = new MockProviderService();
    
    // Create model selector with default options
    modelSelector = new ModelSelector(
      containerEl, 
      eventBus, 
      providerService as unknown as ProviderService
    );
  });
  
  afterEach(() => {
    // Clean up
    document.body.removeChild(containerEl);
  });
  
  test('renders model selector with provider and model dropdowns', () => {
    // Check if container has the correct class
    expect(containerEl.classList.contains('chatsidian-model-selector')).toBe(true);
    
    // Check if provider selector exists
    const providerSelector = containerEl.querySelector('.chatsidian-provider-selector');
    expect(providerSelector).not.toBeNull();
    
    // Check if model selector exists
    const modelSelectorDropdown = containerEl.querySelector('.chatsidian-model-selector-dropdown');
    expect(modelSelectorDropdown).not.toBeNull();
    
    // Check if model capabilities exists
    const modelCapabilities = containerEl.querySelector('.chatsidian-model-capabilities');
    expect(modelCapabilities).not.toBeNull();
  });
  
  test('initializes with the correct default provider', () => {
    // Default provider should be 'anthropic'
    expect(modelSelector.getSelectedProvider()).toBe('anthropic');
    
    // Provider dropdown should have the correct value
    const providerDropdown = containerEl.querySelector('.chatsidian-provider-selector select') as HTMLSelectElement;
    expect(providerDropdown.value).toBe('anthropic');
  });
  
  test('initializes with models from the selected provider', () => {
    // Model dropdown should have options from the selected provider
    const modelDropdown = containerEl.querySelector('.chatsidian-model-selector-dropdown select') as HTMLSelectElement;
    
    // Should have options for Claude models
    expect(modelDropdown.options.length).toBe(2);
    expect(modelDropdown.options[0].value).toBe('claude-3-opus');
    expect(modelDropdown.options[1].value).toBe('claude-3-sonnet');
  });
  
  test('displays model capabilities for the selected model', () => {
    // Model capabilities should show information about the selected model
    const modelCapabilities = containerEl.querySelector('.chatsidian-model-capabilities');
    
    // Should show context size
    const contextSizeEl = modelCapabilities?.querySelector('.chatsidian-model-info-item:nth-child(1)');
    expect(contextSizeEl?.textContent).toContain('Context Size:');
    expect(contextSizeEl?.textContent).toContain('200,000');
    
    // Should show tool support
    const toolSupportEl = modelCapabilities?.querySelector('.chatsidian-model-info-item:nth-child(2)');
    expect(toolSupportEl?.textContent).toContain('Tool Support:');
    expect(toolSupportEl?.textContent).toContain('Yes');
    
    // Should show JSON support
    const jsonSupportEl = modelCapabilities?.querySelector('.chatsidian-model-info-item:nth-child(3)');
    expect(jsonSupportEl?.textContent).toContain('JSON Support:');
    expect(jsonSupportEl?.textContent).toContain('Yes');
    
    // Should show max output tokens
    const maxOutputTokensEl = modelCapabilities?.querySelector('.chatsidian-model-info-item:nth-child(4)');
    expect(maxOutputTokensEl?.textContent).toContain('Max Output:');
    expect(maxOutputTokensEl?.textContent).toContain('4,096');
  });
  
  test('emits model selected event when model is changed', () => {
    // Set up spy on event bus
    const emitSpy = jest.spyOn(eventBus, 'emit');
    
    // Get model dropdown
    const modelDropdown = containerEl.querySelector('.chatsidian-model-selector-dropdown select') as HTMLSelectElement;
    
    // Change model
    modelDropdown.value = 'claude-3-sonnet';
    modelDropdown.dispatchEvent(new Event('change'));
    
    // Check if event was emitted
    expect(emitSpy).toHaveBeenCalledWith(
      ModelSelectorEventType.MODEL_SELECTED,
      expect.objectContaining({
        model: expect.objectContaining({
          id: 'claude-3-sonnet',
          name: 'Claude 3 Sonnet',
          provider: 'anthropic'
        }),
        provider: 'anthropic'
      })
    );
  });
  
  test('emits provider changed event when provider is changed', () => {
    // Set up spy on event bus
    const emitSpy = jest.spyOn(eventBus, 'emit');
    
    // Get provider dropdown
    const providerDropdown = containerEl.querySelector('.chatsidian-provider-selector select') as HTMLSelectElement;
    
    // Change provider
    providerDropdown.value = 'openai';
    providerDropdown.dispatchEvent(new Event('change'));
    
    // Check if event was emitted
    expect(emitSpy).toHaveBeenCalledWith(
      ModelSelectorEventType.PROVIDER_CHANGED,
      expect.objectContaining({
        provider: 'openai'
      })
    );
  });
  
  test('updates model dropdown when provider is changed', () => {
    // Get provider dropdown
    const providerDropdown = containerEl.querySelector('.chatsidian-provider-selector select') as HTMLSelectElement;
    
    // Change provider to OpenAI
    providerDropdown.value = 'openai';
    providerDropdown.dispatchEvent(new Event('change'));
    
    // Get model dropdown
    const modelDropdown = containerEl.querySelector('.chatsidian-model-selector-dropdown select') as HTMLSelectElement;
    
    // Should have options for OpenAI models
    expect(modelDropdown.options.length).toBe(2);
    // Models are sorted alphabetically by name, so "GPT-4 Turbo" comes before "GPT-4o"
    expect(modelDropdown.options[0].value).toBe('gpt-4-turbo');
    expect(modelDropdown.options[1].value).toBe('gpt-4o');
  });
  
  test('updates model capabilities when model is changed', () => {
    // Get model dropdown
    const modelDropdown = containerEl.querySelector('.chatsidian-model-selector-dropdown select') as HTMLSelectElement;
    
    // Change model to Claude 3 Sonnet
    modelDropdown.value = 'claude-3-sonnet';
    modelDropdown.dispatchEvent(new Event('change'));
    
    // Model capabilities should show information about the selected model
    const modelCapabilities = containerEl.querySelector('.chatsidian-model-capabilities');
    
    // Should show context size for Claude 3 Sonnet
    const contextSizeEl = modelCapabilities?.querySelector('.chatsidian-model-info-item:nth-child(1)');
    expect(contextSizeEl?.textContent).toContain('Context Size:');
    expect(contextSizeEl?.textContent).toContain('180,000');
  });
  
  test('can be initialized with custom options', () => {
    // Clean up previous instance
    document.body.removeChild(containerEl);
    containerEl = document.createElement('div');
    document.body.appendChild(containerEl);
    
    // Create model selector with custom options
    modelSelector = new ModelSelector(
      containerEl, 
      eventBus, 
      providerService as unknown as ProviderService,
      {
        showProviderSelector: false,
        showModelCapabilities: false,
        filterByProvider: false,
        filterByToolSupport: true
      }
    );
    
    // Provider selector should not exist
    const providerSelector = containerEl.querySelector('.chatsidian-provider-selector');
    expect(providerSelector).toBeNull();
    
    // Model capabilities should not exist
    const modelCapabilities = containerEl.querySelector('.chatsidian-model-capabilities');
    expect(modelCapabilities).toBeNull();
    
    // Model dropdown should have all models that support tools
    const modelDropdown = containerEl.querySelector('.chatsidian-model-selector-dropdown select') as HTMLSelectElement;
    expect(modelDropdown.options.length).toBe(5); // All models in our mock support tools
  });
  
  test('can be initialized with specific provider and model', () => {
    // Clean up previous instance
    document.body.removeChild(containerEl);
    containerEl = document.createElement('div');
    document.body.appendChild(containerEl);
    
    // Create model selector with specific provider and model
    modelSelector = new ModelSelector(
      containerEl, 
      eventBus, 
      providerService as unknown as ProviderService,
      {},
      'openai',
      'gpt-4o'
    );
    
    // Provider dropdown should have the correct value
    const providerDropdown = containerEl.querySelector('.chatsidian-provider-selector select') as HTMLSelectElement;
    expect(providerDropdown.value).toBe('openai');
    
    // Model dropdown should have the correct value
    const modelDropdown = containerEl.querySelector('.chatsidian-model-selector-dropdown select') as HTMLSelectElement;
    expect(modelDropdown.value).toBe('gpt-4o');
    
    // Selected model should be correct
    expect(modelSelector.getSelectedModel()?.id).toBe('gpt-4o');
    expect(modelSelector.getSelectedModel()?.name).toBe('GPT-4o');
  });
  
  test('setSelectedModel updates the selected model', () => {
    // Set selected model
    const result = modelSelector.setSelectedModel('gpt-4o');
    
    // Should return true for successful update
    expect(result).toBe(true);
    
    // Selected model should be updated
    expect(modelSelector.getSelectedModel()?.id).toBe('gpt-4o');
    
    // Provider should also be updated
    expect(modelSelector.getSelectedProvider()).toBe('openai');
    
    // Provider dropdown should be updated
    const providerDropdown = containerEl.querySelector('.chatsidian-provider-selector select') as HTMLSelectElement;
    expect(providerDropdown.value).toBe('openai');
    
    // Model dropdown should be updated
    const modelDropdown = containerEl.querySelector('.chatsidian-model-selector-dropdown select') as HTMLSelectElement;
    expect(modelDropdown.value).toBe('gpt-4o');
  });
  
  test('setSelectedProvider updates the selected provider', () => {
    // Set selected provider
    modelSelector.setSelectedProvider('google');
    
    // Selected provider should be updated
    expect(modelSelector.getSelectedProvider()).toBe('google');
    
    // Provider dropdown should be updated
    const providerDropdown = containerEl.querySelector('.chatsidian-provider-selector select') as HTMLSelectElement;
    expect(providerDropdown.value).toBe('google');
    
    // Model dropdown should be updated with Google models
    const modelDropdown = containerEl.querySelector('.chatsidian-model-selector-dropdown select') as HTMLSelectElement;
    expect(modelDropdown.options.length).toBe(1);
    expect(modelDropdown.options[0].value).toBe('gemini-pro');
  });
});
