/**
 * Tests for the provider adapters.
 */

import { ProviderFactory } from '../../src/providers/ProviderFactory';
import { ProviderAdapter } from '../../src/providers/ProviderAdapter';
import { OpenAIAdapter } from '../../src/providers/OpenAIAdapter';
import { AnthropicAdapter } from '../../src/providers/AnthropicAdapter';
import { GeminiAdapter } from '../../src/providers/GeminiAdapter';
import { ProviderRequest } from '../../src/models/Provider';

// Mock the provider SDKs
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    models: {
      list: jest.fn().mockResolvedValue({
        data: [
          { id: 'gpt-4', object: 'model' },
          { id: 'gpt-3.5-turbo', object: 'model' }
        ]
      })
    },
    chat: {
      completions: {
        create: jest.fn().mockImplementation((params) => {
          if (params.stream) {
            // Return a mock async iterable for streaming
            const mockStream = {
              [Symbol.asyncIterator]: async function* () {
                yield {
                  id: 'mock-id',
                  choices: [
                    {
                      delta: {
                        content: 'Hello'
                      }
                    }
                  ]
                };
                yield {
                  id: 'mock-id',
                  choices: [
                    {
                      delta: {
                        content: ' world'
                      }
                    }
                  ]
                };
              }
            };
            return mockStream;
          }
          
          // Return a mock response for non-streaming
          return {
            id: 'mock-id',
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: 'Hello world'
                }
              }
            ]
          };
        })
      }
    }
  }));
});

jest.mock('anthropic', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockImplementation((params) => {
        if (params.stream) {
          // Return a mock async iterable for streaming
          const mockStream = {
            [Symbol.asyncIterator]: async function* () {
              yield {
                type: 'content_block_start',
                message: { id: 'mock-id' },
                content_block: { type: 'text' }
              };
              yield {
                type: 'content_block_delta',
                delta: { text: 'Hello' }
              };
              yield {
                type: 'content_block_delta',
                delta: { text: ' world' }
              };
            }
          };
          return mockStream;
        }
        
        // Return a mock response for non-streaming
        return {
          id: 'mock-id',
          content: [
            {
              type: 'text',
              text: 'Hello world'
            }
          ]
        };
      })
    }
  }));
});

jest.mock('@google/genai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockImplementation(() => ({
        countTokens: jest.fn().mockResolvedValue({ totalTokens: 5 }),
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: jest.fn().mockReturnValue('Hello world'),
            promptFeedback: { blockReason: 'mock-id' }
          }
        }),
        generateContentStream: jest.fn().mockResolvedValue({
          stream: {
            [Symbol.asyncIterator]: async function* () {
              yield { text: 'Hello' };
              yield { text: ' world' };
            }
          }
        })
      }))
    })),
    HarmCategory: {
      HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
      HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
      HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT'
    },
    HarmBlockThreshold: {
      BLOCK_MEDIUM_AND_ABOVE: 'BLOCK_MEDIUM_AND_ABOVE'
    }
  };
});

describe('ProviderFactory', () => {
  test('should create OpenAI adapter', () => {
    const adapter = ProviderFactory.createProvider('openai', 'test-key');
    expect(adapter).toBeInstanceOf(OpenAIAdapter);
  });

  test('should create Anthropic adapter', () => {
    const adapter = ProviderFactory.createProvider('anthropic', 'test-key');
    expect(adapter).toBeInstanceOf(AnthropicAdapter);
  });

  test('should create Google adapter', () => {
    const adapter = ProviderFactory.createProvider('google', 'test-key');
    expect(adapter).toBeInstanceOf(GeminiAdapter);
  });

  test('should throw error for unsupported provider', () => {
    expect(() => {
      ProviderFactory.createProvider('unsupported', 'test-key');
    }).toThrow('Unsupported provider: unsupported');
  });

  test('should return supported providers', () => {
    const providers = ProviderFactory.getSupportedProviders();
    expect(providers).toContain('openai');
    expect(providers).toContain('anthropic');
    expect(providers).toContain('google');
  });

  test('should check if provider is supported', () => {
    expect(ProviderFactory.isProviderSupported('openai')).toBe(true);
    expect(ProviderFactory.isProviderSupported('unsupported')).toBe(false);
  });
});

describe('OpenAIAdapter', () => {
  let adapter: ProviderAdapter;

  beforeEach(() => {
    adapter = new OpenAIAdapter('test-key');
  });

  test('should have correct provider name', () => {
    expect(adapter.provider).toBe('openai');
  });

  test('should test connection', async () => {
    const result = await adapter.testConnection();
    expect(result).toBe(true);
  });

  test('should get available models', async () => {
    const models = await adapter.getAvailableModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models[0].provider).toBe('openai');
  });

  test('should send request', async () => {
    const request: ProviderRequest = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }]
    };
    
    const response = await adapter.sendRequest(request);
    expect(response.message.content).toBe('Hello world');
  });

  test('should send streaming request', async () => {
    const request: ProviderRequest = {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      stream: true
    };
    
    const chunks: string[] = [];
    
    await adapter.sendStreamingRequest(request, (chunk) => {
      if (chunk.delta.content) {
        chunks.push(chunk.delta.content);
      }
    });
    
    expect(chunks.join('')).toBe('Hello world');
  });
});

describe('AnthropicAdapter', () => {
  let adapter: ProviderAdapter;

  beforeEach(() => {
    adapter = new AnthropicAdapter('test-key');
  });

  test('should have correct provider name', () => {
    expect(adapter.provider).toBe('anthropic');
  });

  test('should test connection', async () => {
    const result = await adapter.testConnection();
    expect(result).toBe(true);
  });

  test('should get available models', async () => {
    const models = await adapter.getAvailableModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models[0].provider).toBe('anthropic');
  });

  test('should send request', async () => {
    const request: ProviderRequest = {
      model: 'claude-3-opus-20240229',
      messages: [{ role: 'user', content: 'Hello' }]
    };
    
    const response = await adapter.sendRequest(request);
    expect(response.message.content).toBe('Hello world');
  });

  test('should send streaming request', async () => {
    const request: ProviderRequest = {
      model: 'claude-3-opus-20240229',
      messages: [{ role: 'user', content: 'Hello' }],
      stream: true
    };
    
    const chunks: string[] = [];
    
    await adapter.sendStreamingRequest(request, (chunk) => {
      if (chunk.delta.content) {
        chunks.push(chunk.delta.content);
      }
    });
    
    expect(chunks.join('')).toBe('Hello world');
  });
});

describe('GeminiAdapter', () => {
  let adapter: ProviderAdapter;

  beforeEach(() => {
    adapter = new GeminiAdapter('test-key');
  });

  test('should have correct provider name', () => {
    expect(adapter.provider).toBe('google');
  });

  test('should test connection', async () => {
    const result = await adapter.testConnection();
    expect(result).toBe(true);
  });

  test('should get available models', async () => {
    const models = await adapter.getAvailableModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models[0].provider).toBe('google');
  });

  test('should send request', async () => {
    const request: ProviderRequest = {
      model: 'gemini-1.5-pro',
      messages: [{ role: 'user', content: 'Hello' }]
    };
    
    const response = await adapter.sendRequest(request);
    expect(response.message.content).toBe('Hello world');
  });

  test('should send streaming request', async () => {
    const request: ProviderRequest = {
      model: 'gemini-1.5-pro',
      messages: [{ role: 'user', content: 'Hello' }],
      stream: true
    };
    
    const chunks: string[] = [];
    
    await adapter.sendStreamingRequest(request, (chunk) => {
      if (chunk.delta.content) {
        chunks.push(chunk.delta.content);
      }
    });
    
    expect(chunks.join('')).toBe('Hello world');
  });
});
