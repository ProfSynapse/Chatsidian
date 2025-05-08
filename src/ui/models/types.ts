/**
 * Types for model selection components
 * 
 * This file defines the types and interfaces used by the model selection components.
 * It includes event types, component props, and other shared types.
 */

import { ModelInfo } from '../../models/Provider';
import { AgentDefinition, AgentSettings } from '../../agents/AgentTypes';

/**
 * Event types for model selection components
 */
export enum ModelSelectorEventType {
  MODEL_SELECTED = 'model-selector:model-selected',
  PROVIDER_CHANGED = 'model-selector:provider-changed',
}

/**
 * Event types for agent selection components
 */
export enum AgentSelectorEventType {
  AGENT_SELECTED = 'agent-selector:agent-selected',
  AGENT_CREATED = 'agent-selector:agent-created',
  AGENT_UPDATED = 'agent-selector:agent-updated',
  AGENT_DELETED = 'agent-selector:agent-deleted',
}

/**
 * Event types for provider settings components
 */
export enum ProviderSettingsEventType {
  SETTINGS_UPDATED = 'provider-settings:settings-updated',
  API_KEY_UPDATED = 'provider-settings:api-key-updated',
  API_ENDPOINT_UPDATED = 'provider-settings:api-endpoint-updated',
}

/**
 * Model selection event data
 */
export interface ModelSelectedEvent {
  model: ModelInfo;
  provider: string;
}

/**
 * Provider changed event data
 */
export interface ProviderChangedEvent {
  provider: string;
}

/**
 * Agent selection event data
 */
export interface AgentSelectedEvent {
  agent: AgentDefinition;
}

/**
 * Agent creation event data
 */
export interface AgentCreatedEvent {
  agent: AgentDefinition;
}

/**
 * Agent update event data
 */
export interface AgentUpdatedEvent {
  agent: AgentDefinition;
}

/**
 * Agent deletion event data
 */
export interface AgentDeletedEvent {
  agentId: string;
}

/**
 * Provider settings update event data
 */
export interface ProviderSettingsUpdatedEvent {
  provider: string;
  apiKey?: string;
  apiEndpoint?: string;
}

/**
 * Model selector options
 */
export interface ModelSelectorOptions {
  /**
   * Whether to show the provider selector
   */
  showProviderSelector?: boolean;
  
  /**
   * Whether to show model capabilities
   */
  showModelCapabilities?: boolean;
  
  /**
   * Whether to filter models by provider
   */
  filterByProvider?: boolean;
  
  /**
   * Whether to filter models by tool support
   */
  filterByToolSupport?: boolean;
}

/**
 * Agent selector options
 */
export interface AgentSelectorOptions {
  /**
   * Whether to show built-in agents
   */
  showBuiltInAgents?: boolean;
  
  /**
   * Whether to show custom agents
   */
  showCustomAgents?: boolean;
  
  /**
   * Whether to allow creating new agents
   */
  allowCreatingAgents?: boolean;
  
  /**
   * Whether to allow editing agents
   */
  allowEditingAgents?: boolean;
  
  /**
   * Whether to allow deleting agents
   */
  allowDeletingAgents?: boolean;
}
