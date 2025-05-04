/**
 * Tests for the ProviderService.
 */

import { ProviderService } from '../../src/services/ProviderService';
import { SettingsService } from '../../src/services/SettingsService';
import { EventBus } from '../../src/core/EventBus';
import { SettingsManager } from '../../src/core/SettingsManager';
import { ChatsidianSettings } from '../../src/models/Settings';
import { ProviderFactory } from '../../src/providers/ProviderFactory';
import { ProviderAdapter } from '../../src/providers/ProviderAdapter';
import { ProviderRequest } from '../../src/models/Provider';

// Mock the SettingsService
jest.mock('../../src/services/SettingsService', () => {
  return {
    SettingsService: jest.fn().mockImplementation(() => ({
      getSettingsManager: jest.fn().mockReturnValue({
        getSettings: jest.fn().mockReturnValue({
          provider: 'openai',
          apiKey: 'test-key',
          apiEndpoint: 'https://api.test.com'
        })
      })
    }))
  };
});

// Mock the ProviderFactory
jest.mock('../../src/providers/ProviderFactory', () => {
  const mockAdapter = {
    provider: 'openai',
    testConnection: jest.fn().mockResolvedValue(true),
    getAvailableModels: jest.fn().mockResolvedValue([
      { id: 'gpt-4', name: 'GPT-4', provider: 'openai' }
    ]),
    sendRequest: jest.fn().mockResolvedValue({
      id: 'mock-id',
      message: { role: 'assistant', content: 'Hello world' }
    }),
    sendStreamingRequest: jest.fn().mockImplementation((request, onChunk) => {
      onChunk({
        id: 'mock-id',
        delta: { content: 'Hello world' }
      });
      return Promise.resolve();
    }),
    cancelRequest: jest.fn().mockResolvedValue(undefined)
  };

  return {
    ProviderFactory: {
      createProvider: jest.fn().mockReturnValue(mockAdapter),
      getSupportedProviders: jest.fn().mockReturnValue(['openai', 'anthropic', 'google']),
      isProviderSupported: jest.fn().mockImplementation((provider) => {
        return ['openai', 'anthropic', 'google'].includes(provider);
      })
    }
  };
});

describe('ProviderService', () => {
  let providerService: ProviderService;
  let eventBus: EventBus;
  let settingsService: SettingsService;

  beforeEach(() => {
    eventBus = new EventBus();
    settingsService = new SettingsService({} as any, {} as any, eventBus);
    providerService = new ProviderService(eventBus, settingsService);
  });

  test('should get provider adapter', async () => {
    const adapter = await providerService.getProvider('openai');
    expect(adapter).toBeDefined();
    expect(adapter.provider).toBe('openai');
    expect(ProviderFactory.createProvider).toHaveBeenCalledWith('openai', 'test-key', 'https://api.test.com');
  });

  test('should get provider adapter with custom API key', async () => {
    const adapter = await providerService.getProvider('openai', 'custom-key');
    expect(adapter).toBeDefined();
    expect(ProviderFactory.createProvider).toHaveBeenCalledWith('openai', 'custom-key', undefined);
  });

  test('should get provider adapter with custom API endpoint', async () => {
    const adapter = await providerService.getProvider('openai', 'custom-key', 'https://custom.api.com');
    expect(adapter).toBeDefined();
    expect(ProviderFactory.createProvider).toHaveBeenCalledWith('openai', 'custom-key', 'https://custom.api.com');
  });

  test('should test connection', async () => {
    const result = await providerService.testConnection('openai');
    expect(result).toBe(true);
  });

  test('should get available models', async () => {
    const models = await providerService.getAvailableModels('openai');
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('gpt-4');
  });

  test('should send request', async () => {
    const request: ProviderRequest = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }]
    };
    
    const response = await providerService.sendRequest('openai', request);
    expect(response.message.content).toBe('Hello world');
  });

  test('should send streaming request', async () => {
    const request: ProviderRequest = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      stream: true
    };
    
    const chunks: string[] = [];
    
    await providerService.sendStreamingRequest('openai', request, (chunk) => {
      if (chunk.delta.content) {
        chunks.push(chunk.delta.content);
      }
    });
    
    expect(chunks.join('')).toBe('Hello world');
  });

  test('should cancel request', async () => {
    await providerService.cancelRequest('openai');
    // Just verify it doesn't throw
  });

  test('should get supported providers', () => {
    const providers = providerService.getSupportedProviders();
    expect(providers).toContain('openai');
    expect(providers).toContain('anthropic');
    expect(providers).toContain('google');
  });

  test('should check if provider is supported', () => {
    expect(providerService.isProviderSupported('openai')).toBe(true);
    expect(providerService.isProviderSupported('unsupported')).toBe(false);
  });

  test('should clear cache', () => {
    providerService.clearCache();
    // Just verify it doesn't throw
  });
});
