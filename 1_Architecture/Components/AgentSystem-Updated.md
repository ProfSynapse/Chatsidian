---
title: Agent System Component Design (Updated)
description: Detailed design for the Agent System component in Chatsidian
date: 2025-05-03
status: active
tags:
  - architecture
  - component
  - agent-system
  - mcp
---

# Agent System Component Design

## Overview

The Agent System is responsible for managing AI agents, their capabilities, and their system prompts. It provides an abstraction layer between the user interface and the underlying AI providers, allowing for a consistent interaction model regardless of which AI model or service is being used.

## Key Components

### Agent Manager

The `AgentManager` class is the central component responsible for managing agent definitions and their associated capabilities:

```typescript
// src/mcp/AgentManager.ts
import { App } from 'obsidian';
import { v4 as uuidv4 } from 'uuid';
import { StorageManager } from '../core/StorageManager';
import { EventBus } from '../core/EventBus';

/**
 * Agent representation in the system
 */
export interface Agent {
  /**
   * Unique identifier for the agent
   */
  id: string;
  
  /**
   * Display name for the agent
   */
  name: string;
  
  /**
   * Optional description of the agent's capabilities
   */
  description?: string;
  
  /**
   * Emoji to represent the agent in the UI
   */
  emoji: string;
  
  /**
   * System prompt that defines the agent's behavior
   */
  systemPrompt?: string;
  
  /**
   * Array of tool IDs that the agent has permission to use
   */
  tools?: string[];
  
  /**
   * Timestamp when the agent was created
   */
  createdAt: number;
  
  /**
   * Timestamp when the agent was last modified
   */
  lastModified?: number;
  
  /**
   * Optional metadata object for arbitrary data
   */
  metadata?: {
    [key: string]: any;
  };
}

/**
 * Agent settings type
 */
export interface AgentSettings {
  /**
   * ID of the default agent to use when none is specified
   */
  defaultAgentId: string | null;
}

/**
 * Class responsible for managing agents
 */
export class AgentManager {
  private storage: StorageManager;
  private eventBus: EventBus;
  private app: App;
  private agents: Map<string, Agent> = new Map();
  private settings: AgentSettings = {
    defaultAgentId: null
  };
  
  constructor(app: App, storage: StorageManager, eventBus: EventBus) {
    this.app = app;
    this.storage = storage;
    this.eventBus = eventBus;
  }
  
  /**
   * Initialize the agent manager
   */
  async initialize(): Promise<void> {
    // Load saved agents
    await this.loadAgents();
    
    // Load settings
    await this.loadSettings();
    
    // Set up event listeners
    this.setupEvents();
  }
  
  /**
   * Set up event listeners
   */
  private setupEvents(): void {
    // Here we'd register any event listeners relevant to agent management
  }
  
  /**
   * Load saved agents from storage
   */
  private async loadAgents(): Promise<void> {
    try {
      const agentData = await this.storage.loadData('agents');
      
      if (agentData) {
        const agentArray = JSON.parse(agentData) as Agent[];
        
        // Clear existing agents
        this.agents.clear();
        
        // Add agents to map
        for (const agent of agentArray) {
          this.agents.set(agent.id, agent);
        }
      }
    } catch (error) {
      console.error('Error loading agents:', error);
    }
  }
  
  /**
   * Save agents to storage
   */
  private async saveAgents(): Promise<void> {
    try {
      const agentArray = Array.from(this.agents.values());
      await this.storage.saveData('agents', JSON.stringify(agentArray));
    } catch (error) {
      console.error('Error saving agents:', error);
    }
  }
  
  /**
   * Load agent settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      const settingsData = await this.storage.loadData('agent-settings');
      
      if (settingsData) {
        this.settings = JSON.parse(settingsData) as AgentSettings;
      }
    } catch (error) {
      console.error('Error loading agent settings:', error);
    }
  }
  
  /**
   * Save agent settings to storage
   */
  private async saveSettings(): Promise<void> {
    try {
      await this.storage.saveData('agent-settings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Error saving agent settings:', error);
    }
  }
  
  /**
   * Get all agents
   */
  async getAgents(): Promise<Agent[]> {
    return Array.from(this.agents.values());
  }
  
  /**
   * Get a specific agent by ID
   */
  async getAgent(id: string): Promise<Agent | null> {
    return this.agents.get(id) || null;
  }
  
  /**
   * Create a new agent
   */
  async createAgent(agentData: Partial<Agent>): Promise<Agent> {
    const agent: Agent = {
      id: uuidv4(),
      name: agentData.name || 'New Agent',
      description: agentData.description || '',
      emoji: agentData.emoji || '🤖',
      systemPrompt: agentData.systemPrompt || '',
      tools: agentData.tools || [],
      createdAt: Date.now(),
      lastModified: Date.now(),
      metadata: agentData.metadata || {}
    };
    
    // Add to map
    this.agents.set(agent.id, agent);
    
    // Save to storage
    await this.saveAgents();
    
    // Emit event
    this.eventBus.emit('agent:created', agent);
    
    return agent;
  }
  
  /**
   * Update an existing agent
   */
  async saveAgent(agentData: Agent): Promise<Agent> {
    // Check if agent exists
    if (!this.agents.has(agentData.id)) {
      throw new Error(`Agent with ID ${agentData.id} not found`);
    }
    
    // Update lastModified
    agentData.lastModified = Date.now();
    
    // Update in map
    this.agents.set(agentData.id, agentData);
    
    // Save to storage
    await this.saveAgents();
    
    // Emit event
    this.eventBus.emit('agent:updated', agentData);
    
    return agentData;
  }
  
  /**
   * Delete an agent
   */
  async deleteAgent(id: string): Promise<void> {
    // Check if agent exists
    if (!this.agents.has(id)) {
      throw new Error(`Agent with ID ${id} not found`);
    }
    
    // Check if it's the default agent
    if (this.settings.defaultAgentId === id) {
      // Clear default agent
      this.settings.defaultAgentId = null;
      await this.saveSettings();
    }
    
    // Remove from map
    this.agents.delete(id);
    
    // Save to storage
    await this.saveAgents();
    
    // Emit event
    this.eventBus.emit('agent:deleted', id);
  }
  
  