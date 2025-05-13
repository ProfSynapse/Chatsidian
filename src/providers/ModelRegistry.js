/**
 * ModelRegistry
 * 
 * This file provides a central registry of all available AI models for Chatsidian.
 * It replaces the YAML configuration with a TypeScript implementation for better
 * type safety and easier integration with Obsidian's plugin environment.
 */

/**
 * Registry of all models available in Chatsidian
 */
export class ModelRegistry {
    /**
     * Private constructor to enforce singleton pattern
     */
    constructor() {
        this.models = new Map();
        this.initializeModels();
    }
    
    /**
     * Get the singleton instance of ModelRegistry
     */
    static getInstance() {
        if (!ModelRegistry.instance) {
            ModelRegistry.instance = new ModelRegistry();
        }
        return ModelRegistry.instance;
    }
    
    /**
     * Initialize all models for all providers
     */
    initializeModels() {
        // OpenAI models
        this.models.set('openai', [
            {
                id: 'o3',
                name: 'o3',
                provider: 'openai',
                contextSize: 1000000,
                supportsTools: true,
                supportsJson: true,
                maxOutputTokens: 32768
            },
            {
                id: 'o4-mini',
                name: 'o4-mini',
                provider: 'openai',
                contextSize: 1000000,
                supportsTools: true,
                supportsJson: true,
                maxOutputTokens: 16384
            },
            {
                id: 'gpt-4.1',
                name: 'GPT-4.1',
                provider: 'openai',
                contextSize: 1000000,
                supportsTools: true,
                supportsJson: true,
                maxOutputTokens: 32768
            },
            {
                id: 'gpt-4.1-mini',
                name: 'GPT-4.1 Mini',
                provider: 'openai',
                contextSize: 1000000,
                supportsTools: true,
                supportsJson: true,
                maxOutputTokens: 16384
            },
            {
                id: 'gpt-4.1-nano',
                name: 'GPT-4.1 Nano',
                provider: 'openai',
                contextSize: 1000000,
                supportsTools: true,
                supportsJson: true,
                maxOutputTokens: 8192
            }
        ]);
        
        // Anthropic models
        this.models.set('anthropic', [
            {
                id: 'claude-3-7-haiku-20250219',
                name: 'Claude 3.7 Haiku',
                provider: 'anthropic',
                contextSize: 200000,
                supportsTools: true,
                supportsJson: true,
                maxOutputTokens: 4096
            },
            {
                id: 'claude-3-7-sonnet-20250219',
                name: 'Claude 3.7 Sonnet',
                provider: 'anthropic',
                contextSize: 128000,
                supportsTools: true,
                supportsJson: true,
                maxOutputTokens: 64000
            },
            {
                id: 'claude-3-7-sonnet-20250219',
                name: 'Claude 3.7 Sonnet (Thinking)',
                provider: 'anthropic',
                contextSize: 128000,
                supportsTools: true,
                supportsJson: true,
                maxOutputTokens: 128000,
                // Additional property for extended thinking
                extendedThinking: true
            }
        ]);
        
        // Google Gemini models
        this.models.set('google', [
            {
                id: 'gemini-2.5-flash',
                name: 'Gemini 2.5 Flash',
                provider: 'google',
                contextSize: 1000000,
                supportsTools: true,
                supportsJson: false,
                maxOutputTokens: 16384
            },
            {
                id: 'gemini-2.5-pro',
                name: 'Gemini 2.5 Pro',
                provider: 'google',
                contextSize: 2000000,
                supportsTools: true,
                supportsJson: false,
                maxOutputTokens: 32768
            }
        ]);
        
        // OpenRouter models
        this.models.set('openrouter', [
            {
                id: 'openai/o3',
                name: 'o3 (via OpenRouter)',
                provider: 'openrouter',
                contextSize: 1000000,
                supportsTools: true,
                supportsJson: true,
                maxOutputTokens: 32768
            },
            {
                id: 'openai/o4-mini',
                name: 'o4-mini (via OpenRouter)',
                provider: 'openrouter',
                contextSize: 1000000,
                supportsTools: true,
                supportsJson: true,
                maxOutputTokens: 16384
            },
            {
                id: 'openai/gpt-4.1',
                name: 'GPT-4.1 (via OpenRouter)',
                provider: 'openrouter',
                contextSize: 1000000,
                supportsTools: true,
                supportsJson: true,
                maxOutputTokens: 32768
            },
            {
                id: 'openai/gpt-4.1-mini',
                name: 'GPT-4.1 Mini (via OpenRouter)',
                provider: 'openrouter',
                contextSize: 1000000,
                supportsTools: true,
                supportsJson: true,
                maxOutputTokens: 16384
            },
            {
                id: 'openai/gpt-4.1-nano',
                name: 'GPT-4.1 Nano (via OpenRouter)',
                provider: 'openrouter',
                contextSize: 1000000,
                supportsTools: true,
                supportsJson: true,
                maxOutputTokens: 8192
            },
            {
                id: 'anthropic/claude-3-7-haiku-20250219',
                name: 'Claude 3.7 Haiku (via OpenRouter)',
                provider: 'openrouter',
                contextSize: 200000,
                supportsTools: true,
                supportsJson: true,
                maxOutputTokens: 4096
            },
            {
                id: 'anthropic/claude-3-7-sonnet-20250219',
                name: 'Claude 3.7 Sonnet (via OpenRouter)',
                provider: 'openrouter',
                contextSize: 128000,
                supportsTools: true,
                supportsJson: true,
                maxOutputTokens: 64000
            },
            {
                id: 'google/gemini-2.5-flash',
                name: 'Gemini 2.5 Flash (via OpenRouter)',
                provider: 'openrouter',
                contextSize: 1000000,
                supportsTools: true,
                supportsJson: false,
                maxOutputTokens: 16384
            },
            {
                id: 'google/gemini-2.5-pro',
                name: 'Gemini 2.5 Pro (via OpenRouter)',
                provider: 'openrouter',
                contextSize: 2000000,
                supportsTools: true,
                supportsJson: false,
                maxOutputTokens: 32768
            }
        ]);
        
        // Requesty models
        this.models.set('requesty', [
            {
                id: 'openai/o3',
                name: 'o3 (via Requesty)',
                provider: 'requesty',
                contextSize: 1000000,
                supportsTools: true,
                supportsJson: true,
                maxOutputTokens: 32768
            },
            {
                id: 'openai/o4-mini',
                name: 'o4-mini (via Requesty)',
                provider: 'requesty',
                contextSize: 1000000,
                supportsTools: true,
                supportsJson: true,
                maxOutputTokens: 16384
            },
            {
                id: 'openai/gpt-4.1',
                name: 'GPT-4.1 (via Requesty)',
                provider: 'requesty',
                contextSize: 1000000,
                supportsTools: true,
                supportsJson: true,
                maxOutputTokens: 32768
            },
            {
                id: 'openai/gpt-4.1-mini',
                name: 'GPT-4.1 Mini (via Requesty)',
                provider: 'requesty',
                contextSize: 1000000,
                supportsTools: true,
                supportsJson: true,
                maxOutputTokens: 16384
            },
            {
                id: 'openai/gpt-4.1-nano',
                name: 'GPT-4.1 Nano (via Requesty)',
                provider: 'requesty',
                contextSize: 1000000,
                supportsTools: true,
                supportsJson: true,
                maxOutputTokens: 8192
            },
            {
                id: 'anthropic/claude-3-7-haiku-20250219',
                name: 'Claude 3.7 Haiku (via Requesty)',
                provider: 'requesty',
                contextSize: 200000,
                supportsTools: true,
                supportsJson: true,
                maxOutputTokens: 4096
            },
            {
                id: 'anthropic/claude-3-7-sonnet-20250219',
                name: 'Claude 3.7 Sonnet (via Requesty)',
                provider: 'requesty',
                contextSize: 128000,
                supportsTools: true,
                supportsJson: true,
                maxOutputTokens: 64000
            },
            {
                id: 'google/gemini-2.5-flash',
                name: 'Gemini 2.5 Flash (via Requesty)',
                provider: 'requesty',
                contextSize: 1000000,
                supportsTools: true,
                supportsJson: false,
                maxOutputTokens: 16384
            },
            {
                id: 'google/gemini-2.5-pro',
                name: 'Gemini 2.5 Pro (via Requesty)',
                provider: 'requesty',
                contextSize: 2000000,
                supportsTools: true,
                supportsJson: false,
                maxOutputTokens: 32768
            }
        ]);
    }
    
    /**
     * Get models for a specific provider
     */
    getModelsForProvider(provider) {
        return this.models.get(provider) || [];
    }
    
    /**
     * Get all available models across all providers
     */
    getAllModels() {
        const allModels = [];
        
        this.models.forEach(providerModels => {
            allModels.push(...providerModels);
        });
        
        return allModels;
    }
    
    /**
     * Get a list of all available providers
     */
    getAvailableProviders() {
        return Array.from(this.models.keys());
    }
    
    /**
     * Find a model by its ID across all providers
     */
    findModelById(modelId, provider) {
        if (provider) {
            const providerModels = this.models.get(provider);
            return providerModels?.find(m => m.id === modelId);
        }
        
        for (const [_, providerModels] of this.models) {
            const model = providerModels.find(m => m.id === modelId);
            if (model) {
                return model;
            }
        }
        
        return undefined;
    }
}

// Export ModelRegistry instance
export const modelRegistry = ModelRegistry.getInstance();