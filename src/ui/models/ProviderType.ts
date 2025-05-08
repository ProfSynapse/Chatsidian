/**
 * Provider Type Definitions
 * 
 * This file defines the provider types used throughout the application.
 * It provides a centralized place for provider type definitions to ensure consistency.
 * 
 * @file This file defines the ProviderType type and related utilities.
 */

/**
 * Provider type representing the supported AI providers
 */
export type ProviderType = 'anthropic' | 'openai' | 'openrouter' | 'google' | 'custom' | 'requesty';

/**
 * Default provider type
 */
export const DEFAULT_PROVIDER: ProviderType = 'anthropic';

/**
 * Array of valid provider types
 */
export const VALID_PROVIDER_TYPES: readonly ProviderType[] = [
  'anthropic',
  'openai',
  'openrouter',
  'google',
  'custom',
  'requesty'
] as const;

/**
 * Utility functions for working with provider types
 */
export const ProviderTypeUtils = {
  /**
   * Check if a string is a valid provider type
   * 
   * @param provider - The provider string to check
   * @returns Whether the provider is a valid ProviderType
   */
  isValidProviderType(provider: string): boolean {
    return VALID_PROVIDER_TYPES.includes(provider as ProviderType);
  },
  
  /**
   * Convert a string to a provider type, defaulting to 'anthropic' if invalid
   * 
   * @param provider - The provider string to convert
   * @returns A valid ProviderType
   */
  toProviderType(provider: string): ProviderType {
    return this.isValidProviderType(provider) ? 
      (provider as ProviderType) : 
      DEFAULT_PROVIDER;
  },
  
  /**
   * Get the display name for a provider type
   * 
   * @param provider - The provider type
   * @returns The formatted display name
   */
  getDisplayName(provider: string): string {
    const providerType = this.toProviderType(provider);
      
    switch (providerType) {
      case 'openai':
        return 'OpenAI';
      case 'anthropic':
        return 'Anthropic';
      case 'google':
        return 'Google';
      case 'openrouter':
        return 'OpenRouter';
      case 'custom':
        return 'Custom';
      case 'requesty':
        return 'Requesty';
      default:
        return provider.charAt(0).toUpperCase() + provider.slice(1);
    }
  }
};
