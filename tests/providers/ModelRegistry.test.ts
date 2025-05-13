/**
 * Tests for the ModelRegistry class
 */

import { ModelRegistry } from '../../src/providers/ModelRegistry';
import { ProviderType } from '../../src/ui/models/ProviderType';

describe('ModelRegistry', () => {
  let modelRegistry: ModelRegistry;

  beforeEach(() => {
    // Get a fresh instance for each test
    // We're using a hacky way to reset the singleton by accessing private property
    (ModelRegistry as any).instance = null;
    modelRegistry = ModelRegistry.getInstance();
  });

  test('getInstance returns a singleton instance', () => {
    const instance1 = ModelRegistry.getInstance();
    const instance2 = ModelRegistry.getInstance();
    expect(instance1).toBe(instance2);
  });

  test('getModelsForProvider returns models for a specific provider', () => {
    const openaiModels = modelRegistry.getModelsForProvider('openai');
    expect(openaiModels).toBeDefined();
    expect(openaiModels.length).toBeGreaterThan(0);
    openaiModels.forEach(model => {
      expect(model.provider).toBe('openai');
    });

    const anthropicModels = modelRegistry.getModelsForProvider('anthropic');
    expect(anthropicModels).toBeDefined();
    expect(anthropicModels.length).toBeGreaterThan(0);
    anthropicModels.forEach(model => {
      expect(model.provider).toBe('anthropic');
    });
  });

  test('getModelsForProvider returns empty array for unknown provider', () => {
    const models = modelRegistry.getModelsForProvider('unknown' as ProviderType);
    expect(models).toEqual([]);
  });

  test('getAllModels returns all models from all providers', () => {
    const allModels = modelRegistry.getAllModels();
    expect(allModels).toBeDefined();
    expect(allModels.length).toBeGreaterThan(0);

    // Check that we have models from different providers
    const providers = new Set(allModels.map(model => model.provider));
    expect(providers.size).toBeGreaterThan(1);
  });

  test('getAvailableProviders returns all provider types', () => {
    const providers = modelRegistry.getAvailableProviders();
    expect(providers).toBeDefined();
    expect(providers.length).toBeGreaterThan(0);
    expect(providers).toContain('openai');
    expect(providers).toContain('anthropic');
    expect(providers).toContain('google');
    expect(providers).toContain('openrouter');
    expect(providers).toContain('requesty');
  });

  test('findModelById finds a model by ID across providers', () => {
    const model = modelRegistry.findModelById('o3');
    expect(model).toBeDefined();
    expect(model?.id).toBe('o3');
    expect(model?.provider).toBe('openai');
  });

  test('findModelById with provider filter finds a model within that provider', () => {
    const model = modelRegistry.findModelById('o3', 'openai');
    expect(model).toBeDefined();
    expect(model?.id).toBe('o3');
    expect(model?.provider).toBe('openai');
  });

  test('findModelById returns undefined for unknown model ID', () => {
    const model = modelRegistry.findModelById('non-existent-model');
    expect(model).toBeUndefined();
  });

  test('findModelById returns undefined when model not in specified provider', () => {
    const model = modelRegistry.findModelById('o3', 'anthropic');
    expect(model).toBeUndefined();
  });
  
  test('Anthropic models include extended thinking option', () => {
    const anthropicModels = modelRegistry.getModelsForProvider('anthropic');
    const thinkingModel = anthropicModels.find(model => model.extendedThinking === true);
    expect(thinkingModel).toBeDefined();
    expect(thinkingModel?.name).toContain('Thinking');
  });
});