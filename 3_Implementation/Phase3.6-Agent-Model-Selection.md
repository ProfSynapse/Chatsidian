---
title: Phase 3.6 - Agent and Model Selection
description: Implementing interfaces for selecting AI agents and models
date: 2025-05-03
status: planning
tags:
  - implementation
  - phase3
  - ui
  - agent-selection
  - model-selection
  - chat-interface
---

# Phase 3.6: Agent and Model Selection

## Overview

This microphase focuses on creating UI components for selecting AI agents and models in the Chatsidian chat interface. These components will allow users to choose which AI agent and underlying model to use for their conversations, providing flexibility and customization.

The agent and model selection components will integrate with the AgentManager and ModelManager from Phase 2, allowing users to interact with the different AI capabilities provided by the plugin. The UI will provide clear visual indicators for the current selections and persist these preferences across sessions.

## Implementation Details


### Agent Selection Component

The `AgentSelector` component allows users to select which AI agent to use for their conversations:

```typescript
// src/ui/AgentSelector.ts
import { setIcon, Menu, Notice } from 'obsidian';
import { EventBus } from '../core/EventBus';
import { AgentManager, Agent } from '../mcp/AgentManager';

export class AgentSelector {
  private containerEl: HTMLElement;
  private eventBus: EventBus;
  private agentManager: AgentManager;
  private selectButtonEl: HTMLElement;
  private dropdownEl: HTMLElement;
  private selectedLabelEl: HTMLElement;
  private agents: Agent[] = [];
  private activeAgentId: string | null = null;
  
  constructor(containerEl: HTMLElement, eventBus: EventBus, agentManager: AgentManager) {
    this.containerEl = containerEl;
    this.eventBus = eventBus;
    this.agentManager = agentManager;
    
    // Initialize UI
    this.initializeUI();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Load agents
    this.loadAgents();
  }
  
  private initializeUI(): void {
    // Clear container
    this.containerEl.empty();
    this.containerEl.addClass('chatsidian-agent-selector');
    
    // Create select button
    this.selectButtonEl = this.containerEl.createDiv({
      cls: 'chatsidian-selector-button'
    });
    
    // Create emoji container (instead of icon)
    const emojiEl = this.selectButtonEl.createDiv({
      cls: 'chatsidian-selector-emoji'
    });
    emojiEl.textContent = '🤖'; // Default emoji
    
    // Create selected label
    this.selectedLabelEl = this.selectButtonEl.createDiv({
      cls: 'chatsidian-selector-label'
    });
    this.selectedLabelEl.textContent = 'Default Assistant';
    
    // Create dropdown arrow
    const arrowEl = this.selectButtonEl.createDiv({
      cls: 'chatsidian-selector-arrow'
    });
    setIcon(arrowEl, 'chevron-down');
    
    // Create dropdown content
    this.dropdownEl = this.containerEl.createDiv({
      cls: 'chatsidian-selector-dropdown'
    });
    this.dropdownEl.style.display = 'none';
    
    // Add default option
    const defaultOption = this.dropdownEl.createDiv({
      cls: 'chatsidian-selector-option'
    });
    defaultOption.dataset.id = '';
    
    // Add default emoji (instead of icon)
    const defaultEmojiEl = defaultOption.createDiv({
      cls: 'chatsidian-selector-option-emoji'
    });
    defaultEmojiEl.textContent = '🤖';
    
    defaultOption.createDiv({
      cls: 'chatsidian-selector-option-label',
      text: 'Default Assistant'
    });
    
    // Add divider
    this.dropdownEl.createDiv({
      cls: 'chatsidian-selector-divider'
    });
  }
  
  private setupEventListeners(): void {
    // Toggle dropdown on click
    this.eventBus.app.registerDomEvent(this.selectButtonEl, 'click', (e: MouseEvent) => {
      e.stopPropagation();
      this.toggleDropdown();
    });
    
    // Close dropdown when clicking outside
    this.eventBus.app.registerDomEvent(document, 'click', (e: MouseEvent) => {
      if (!this.containerEl.contains(e.target as Node)) {
        this.closeDropdown();
      }
    });
    
    // Listen for agent changes
    this.eventBus.on('agent:created', (agent: Agent) => {
      this.addAgent(agent);
    });
    
    this.eventBus.on('agent:updated', (agent: Agent) => {
      this.updateAgent(agent);
    });
    
    this.eventBus.on('agent:deleted', (agentId: string) => {
      this.removeAgent(agentId);
    });
  }
  
  private async loadAgents(): Promise<void> {
    try {
      // Get agents from manager
      this.agents = await this.agentManager.getAgents();
      
      // Update dropdown
      this.updateAgentsList();
      
      // Get default agent
      const settings = await this.agentManager.getSettings();
      this.setActiveAgent(settings.defaultAgentId || null);
    } catch (error) {
      console.error('Error loading agents:', error);
      new Notice('Failed to load agents');
    }
  }
  
  private updateAgentsList(): void {
    // Remove existing agent elements
    const options = this.dropdownEl.querySelectorAll('.chatsidian-selector-option:not(:first-child)');
    options.forEach(option => {
      if (option.nextElementSibling?.classList.contains('chatsidian-selector-divider')) {
        return;
      }
      option.remove();
    });
    
    // Add agent elements
    for (const agent of this.agents) {
      this.addAgentElement(agent);
    }
  }
  
  private addAgentElement(agent: Agent): HTMLElement {
    // Get divider element
    const divider = this.dropdownEl.querySelector('.chatsidian-selector-divider');
    
    // Create agent option
    const optionEl = document.createElement('div');
    optionEl.className = 'chatsidian-selector-option';
    optionEl.dataset.id = agent.id;
    
    // Add emoji
    const emojiEl = document.createElement('div');
    emojiEl.className = 'chatsidian-selector-option-emoji';
    emojiEl.textContent = agent.emoji || '🤖'; // Use provided emoji or default
    
    optionEl.appendChild(emojiEl);
    
    // Add label
    const labelEl = document.createElement('div');
    labelEl.className = 'chatsidian-selector-option-label';
    labelEl.textContent = agent.name;
    optionEl.appendChild(labelEl);
    
    // Add click handler
    this.eventBus.app.registerDomEvent(optionEl, 'click', (e: MouseEvent) => {
      e.stopPropagation();
      this.setActiveAgent(agent.id);
      this.closeDropdown();
    });
    
    // Insert element after divider
    this.dropdownEl.insertBefore(optionEl, divider.nextSibling);
    
    return optionEl;
  }
  
  private toggleDropdown(): void {
    if (this.dropdownEl.style.display === 'none') {
      this.openDropdown();
    } else {
      this.closeDropdown();
    }
  }
  
  private openDropdown(): void {
    this.dropdownEl.style.display = 'block';
    this.selectButtonEl.addClass('chatsidian-selector-button-open');
  }
  
  private closeDropdown(): void {
    this.dropdownEl.style.display = 'none';
    this.selectButtonEl.removeClass('chatsidian-selector-button-open');
  }
  
  public setActiveAgent(agentId: string | null): void {
    // Update active agent
    this.activeAgentId = agentId;
    
    // Update selected label
    if (agentId) {
      const agent = this.agents.find(a => a.id === agentId);
      if (agent) {
        this.selectedLabelEl.textContent = agent.name;
      }
    } else {
      this.selectedLabelEl.textContent = 'Default Assistant';
    }
    
    // Update active class on options
    const options = this.dropdownEl.querySelectorAll('.chatsidian-selector-option');
    options.forEach(option => {
      if (option.dataset.id === (agentId || '')) {
        option.addClass('chatsidian-selector-option-active');
      } else {
        option.removeClass('chatsidian-selector-option-active');
      }
    });
    
    // Emit event
    this.eventBus.emit('agent:selected', agentId);
  }
  
  private addAgent(agent: Agent): void {
    // Check if already exists
    const existing = this.agents.find(a => a.id === agent.id);
    
    if (!existing) {
      // Add to list
      this.agents.push(agent);
      
      // Add to dropdown
      this.addAgentElement(agent);
    }
  }
  
  private updateAgent(agent: Agent): void {
    // Update in list
    const index = this.agents.findIndex(a => a.id === agent.id);
    
    if (index !== -1) {
      this.agents[index] = agent;
      
      // Update dropdown
      const optionEl = this.dropdownEl.querySelector(`.chatsidian-selector-option[data-id="${agent.id}"]`);
      
      if (optionEl) {
        const labelEl = optionEl.querySelector('.chatsidian-selector-option-label');
        if (labelEl) {
          labelEl.textContent = agent.name;
        }
        
        const emojiEl = optionEl.querySelector('.chatsidian-selector-option-emoji');
        if (emojiEl) {
          emojiEl.textContent = agent.emoji || '🤖'; // Update emoji
        }
      }
      
      // Update selected label if this is the active agent
      if (this.activeAgentId === agent.id) {
        this.selectedLabelEl.textContent = agent.name;
      }
    }
  }
  
  private removeAgent(agentId: string): void {
    // Remove from list
    this.agents = this.agents.filter(a => a.id !== agentId);
    
    // Remove from dropdown
    const optionEl = this.dropdownEl.querySelector(`.chatsidian-selector-option[data-id="${agentId}"]`);
    
    if (optionEl) {
      optionEl.remove();
    }
    
    // Reset active agent if it was removed
    if (this.activeAgentId === agentId) {
      this.setActiveAgent(null);
    }
  }
}
```

This component implements a dropdown selector for agents with the following features:
1. Displaying a list of available agents
2. Selecting an agent to use for conversations
3. Visual indicator for the currently selected agent
4. Integration with the AgentManager from Phase 2

The component follows Obsidian's UI patterns with a clean dropdown interface and proper event handling.

        if (labelEl) {
          labelEl.textContent = model.name;
        }
        
        const providerEl = optionEl.querySelector('.chatsidian-selector-option-provider');
        if (providerEl) {
          providerEl.textContent = model.provider;
        }
      }
      
      // Update selected label if this is the active model
      if (this.activeModelId === model.id) {
        this.selectedLabelEl.textContent = model.name;
      }
    }
  }
  
  private removeModel(modelId: string): void {
    // Remove from list
    this.models = this.models.filter(m => m.id !== modelId);
    
    // Remove from dropdown
    const optionEl = this.dropdownEl.querySelector(`.chatsidian-selector-option[data-id="${modelId}"]`);
    
    if (optionEl) {
      optionEl.remove();
    }
    
    // Reset active model if it was removed
    if (this.activeModelId === modelId) {
      this.setActiveModel(null);
    }
  }
}
```

This component implements a dropdown selector for models with the following features:
1. Displaying a list of available models with their providers
2. Selecting a model to use for conversations
3. Visual indicator for the currently selected model
4. Integration with the ModelManager from Phase 2

The component has a similar structure to the AgentSelector but includes additional information about the model provider.

### CSS Styling for Agent and Model Selectors

Let's add CSS styling for the selector components:

```css
/* src/styles.css - Agent and Model selector styling */

/* Selector container */
.chatsidian-agent-selector,
.chatsidian-model-selector {
  position: relative;
  margin-right: 8px;
}

/* Selector button */
.chatsidian-selector-button {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--background-modifier-border);
  background-color: var(--background-primary);
  cursor: pointer;
  min-width: 120px;
  height: 28px;
  transition: border-color 0.15s ease;
}

.chatsidian-selector-button:hover,
.chatsidian-selector-button-open {
  border-color: var(--interactive-accent);
}

/* Emoji styling (new) */
.chatsidian-selector-emoji {
  margin-right: 6px;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  text-align: center;
}

/* Emoji styling */
.chatsidian-selector-emoji {
  margin-right: 6px;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  text-align: center;
}

.chatsidian-selector-label {
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.9em;
}

.chatsidian-selector-arrow {
  margin-left: 6px;
  color: var(--text-muted);
}

/* Dropdown */
.chatsidian-selector-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  width: 200px;
  max-height: 300px;
  overflow-y: auto;
  margin-top: 4px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  background-color: var(--background-primary);
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* Dropdown option */
.chatsidian-selector-option {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  cursor: pointer;
  position: relative;
}

.chatsidian-selector-option:hover {
  background-color: var(--background-modifier-hover);
}

.chatsidian-selector-option-active {
  background-color: var(--background-modifier-hover);
}

.chatsidian-selector-option-icon {
  margin-right: 8px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Option emoji styling (new) */
.chatsidian-selector-option-emoji {
  margin-right: 8px;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  text-align: center;
}

.chatsidian-selector-option-label {
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.9em;
}

.chatsidian-selector-option-provider {
  font-size: 0.8em;
  color: var(--text-muted);
  margin-left: 8px;
}

.chatsidian-selector-divider {
  height: 1px;
  background-color: var(--background-modifier-border);
  margin: 4px 0;
}
```

This CSS provides styling for:
1. The selector buttons with icons and labels
2. Dropdown menus with options
3. Visual indicators for active selections
4. Different states like hover and open

All styling uses Obsidian's CSS variables to ensure compatibility with different themes.

### Integration with ChatView

Now let's integrate the agent and model selectors with the `ChatView`:

```typescript
// src/ui/ChatView.ts (updated for agent and model selection)
import { AgentSelector } from './AgentSelector';
import { ModelSelector } from './ModelSelector';

export class ChatView extends ItemView {
  // ... existing code ...
  
  private agentSelector: AgentSelector;
  private modelSelector: ModelSelector;
  private currentAgentId: string | null = null;
  private currentModelId: string | null = null;
  
  async onOpen(): Promise<void> {
    // ... existing code ...
    
    // Create header
    const headerEl = this.contentContainerEl.createDiv({ cls: 'chatsidian-header' });
    
    // Create conversation selector
    this.conversationSelector = new ConversationSelector(
      headerEl.createDiv({ cls: 'chatsidian-conversation-selector-container' }),
      this.eventBus,
      this.storage
    );
    
    // Create selectors container
    const selectorsEl = headerEl.createDiv({ cls: 'chatsidian-selectors-container' });
    
    // Create agent selector
    this.agentSelector = new AgentSelector(
      selectorsEl.createDiv(),
      this.eventBus,
      this.agentManager
    );
    
    // Create model selector
    this.modelSelector = new ModelSelector(
      selectorsEl.createDiv(),
      this.eventBus,
      this.modelManager
    );
    
    // Register selector events
    this.registerSelectorEvents();
    
    // ... existing code ...
  }
  
  private registerSelectorEvents(): void {
    // Listen for agent selection
    this.registerEvent(
      this.eventBus.on('agent:selected', (agentId: string | null) => {
        this.handleAgentSelected(agentId);
      })
    );
    
    // Listen for model selection
    this.registerEvent(
      this.eventBus.on('model:selected', (modelId: string | null) => {
        this.handleModelSelected(modelId);
      })
    );
  }
  
  private async handleAgentSelected(agentId: string | null): Promise<void> {
    // Update current agent
    this.currentAgentId = agentId;
    
    // If we have an active conversation, update its agent ID
    if (this.currentConversationId) {
      try {
        // Get conversation
        const conversation = await this.storage.getConversation(this.currentConversationId);
        
        if (conversation) {
          // Update agent ID
          conversation.agentId = agentId;
          
          // Save conversation
          await this.storage.saveConversation(conversation);
        }
      } catch (error) {
        console.error('Error updating conversation agent:', error);
      }
    }
  }
  
  private async handleModelSelected(modelId: string | null): Promise<void> {
    // Update current model
    this.currentModelId = modelId;
    
    // If we have an active conversation, update its model ID
    if (this.currentConversationId) {
      try {
        // Get conversation
        const conversation = await this.storage.getConversation(this.currentConversationId);
        
        if (conversation) {
          // Update model ID
          conversation.modelId = modelId;
          
          // Save conversation
          await this.storage.saveConversation(conversation);
        }
      } catch (error) {
        console.error('Error updating conversation model:', error);
      }
    }
  }
  
  private async loadConversation(conversationId: string): Promise<void> {
    // ... existing code ...
    
    // Update agent and model selectors
    if (conversation.agentId) {
      this.agentSelector.setActiveAgent(conversation.agentId);
      this.currentAgentId = conversation.agentId;
    } else {
      this.agentSelector.setActiveAgent(null);
      this.currentAgentId = null;
    }
    
    if (conversation.modelId) {
      this.modelSelector.setActiveModel(conversation.modelId);
      this.currentModelId = conversation.modelId;
    } else {
      this.modelSelector.setActiveModel(null);
      this.currentModelId = null;
    }
    
    // ... existing code ...
  }
  
  private async handleMessageSubmit(content: string): Promise<void> {
    // ... existing code ...
    
    try {
      // ... existing code ...
      
      // Send to MCP Client
      const assistantMessage = await this.mcpClient.sendMessage(
        this.currentConversation,
        userMessage,
        this.currentAgentId,
        this.currentModelId
      );
      
      // ... existing code ...
    } catch (error) {
      // ... existing error handling ...
    }
  }
}
```

This integration adds:
1. Agent and model selectors in the header
2. Event handling for agent and model selection
3. Updating the conversation with the selected agent and model
4. Loading agent and model settings when switching conversations
5. Passing the selected agent and model to the MCP client when sending messages

### Model and Agent Definitions

To properly support the selectors, we need to define the Model and Agent interfaces that will be used by the ModelManager and AgentManager from Phase 2:

```typescript
// src/mcp/ModelManager.ts (reference)
export interface Model {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  maxTokens?: number;
  contextWindow?: number;
  createdAt: number;
  lastModified?: number;
  metadata?: {
    [key: string]: any;
  };
}

// src/mcp/AgentManager.ts (reference)
export interface Agent {
  id: string;
  name: string;
  description?: string;
  emoji: string;
  systemPrompt?: string;
  tools?: string[];
  createdAt: number;
  lastModified?: number;
  metadata?: {
    [key: string]: any;
  };
}
```

These interfaces define the data structures for models and agents, which will be managed by the ModelManager and AgentManager respectively.

## Default Agent and Model

To provide a better user experience, we'll implement functionality to set default agents and models that will be used for new conversations:

```typescript
// src/ui/settings/AgentModelSettings.ts
import { App, PluginSettingTab, Setting } from 'obsidian';
import { ChatsidianPlugin } from '../../main';
import { AgentManager, Agent } from '../../mcp/AgentManager';
import { ModelManager, Model } from '../../mcp/ModelManager';

export class AgentModelSettingsTab extends PluginSettingTab {
  private plugin: ChatsidianPlugin;
  private agentManager: AgentManager;
  private modelManager: ModelManager;
  
  constructor(app: App, plugin: ChatsidianPlugin, agentManager: AgentManager, modelManager: ModelManager) {
    super(app, plugin);
    this.plugin = plugin;
    this.agentManager = agentManager;
    this.modelManager = modelManager;
  }
  
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    
    containerEl.createEl('h2', { text: 'Agent and Model Settings' });
    
    // Default agent setting
    new Setting(containerEl)
      .setName('Default Agent')
      .setDesc('Set the default agent for new conversations')
      .addDropdown(async (dropdown) => {
        // Add "Default" option
        dropdown.addOption('', 'Default Assistant');
        
        // Get agents
        const agents = await this.agentManager.getAgents();
        
        // Add agent options
        for (const agent of agents) {
          dropdown.addOption(agent.id, agent.name);
        }
        
        // Get settings
        const settings = await this.agentManager.getSettings();
        
        // Set value
        dropdown.setValue(settings.defaultAgentId || '');
        
        // Handle change
        dropdown.onChange(async (value) => {
          // Update settings
          settings.defaultAgentId = value || null;
          
          // Save settings
          await this.agentManager.saveSettings(settings);
        });
      });
    
    // Default model setting
    new Setting(containerEl)
      .setName('Default Model')
      .setDesc('Set the default model for new conversations')
      .addDropdown(async (dropdown) => {
        // Add "Default" option
        dropdown.addOption('', 'Default Model');
        
        // Get models
        const models = await this.modelManager.getModels();
        
        // Add model options
        for (const model of models) {
          dropdown.addOption(model.id, `${model.name} (${model.provider})`);
        }
        
        // Get settings
        const settings = await this.modelManager.getSettings();
        
        // Set value
        dropdown.setValue(settings.defaultModelId || '');
        
        // Handle change
        dropdown.onChange(async (value) => {
          // Update settings
          settings.defaultModelId = value || null;
          
          // Save settings
          await this.modelManager.saveSettings(settings);
        });
      });
  }
}
```

This settings tab allows users to set default agents and models, which will be used when creating new conversations if no specific agent or model is selected.

## Integration with the MCP Client

The selected agent and model need to be integrated with the MCP client from Phase 2 to ensure that the right agent and model are used for each conversation:

```typescript
// src/mcp/MCPClient.ts (reference)
async sendMessage(
  conversation: Conversation,
  message: Message,
  agentId: string | null = null,
  modelId: string | null = null
): Promise<Message> {
  // Determine which agent to use
  const effectiveAgentId = agentId || conversation.agentId || this.getDefaultAgentId();
  
  // Determine which model to use
  const effectiveModelId = modelId || conversation.modelId || this.getDefaultModelId();
  
  // Get agent
  const agent = effectiveAgentId ? await this.agentManager.getAgent(effectiveAgentId) : null;
  
  // Get model
  const model = effectiveModelId ? await this.modelManager.getModel(effectiveModelId) : null;
  
  // Create MCP message with appropriate agent and model
  const mcpMessage = this.createMCPMessage(conversation, message, agent, model);
  
  // Send to provider
  // ... implementation details ...
  
  // Return response
  return assistantMessage;
}
```

This integration ensures that the selected agent and model are used when sending messages to the AI provider, falling back to conversation-specific settings or defaults if not explicitly specified.

## Testing Strategy

Testing for this microphase will involve:

1. **Unit Testing**:
   - Test the `AgentSelector` and `ModelSelector` components
   - Verify proper event handling
   - Test default agent and model functionality

2. **Integration Testing**:
   - Test integration with `ChatView`
   - Verify selection state persists with conversations
   - Test integration with the MCP client

3. **Manual UI Testing**:
   - Test selecting different agents and models
   - Verify visual indicators for current selections
   - Test persistence across conversations
   - Test setting and using default agents and models

4. **Accessibility Testing**:
   - Verify keyboard navigation for selectors
   - Test screen reader compatibility
   - Check for proper focus management

## Dependencies

This microphase depends on:
- Phase 1 components (EventBus, StorageManager)
- Phase 2 components (AgentManager, ModelManager, MCPClient)
- Phase 3.1 (Core View Registration)
- Phase 3.4 (Conversation Management)

## Next Steps

After completing this microphase, we'll have fully functional agent and model selection UI components. The next microphases will focus on:
1. Implementing tool call visualization
2. Creating the settings interface
3. Adding responsive design and accessibility

## Additional Resources

- [[💻 Coding/Projects/Chatsidian/4_Documentation/UIDesignGuidelines]]
- [[💻 Coding/Projects/Chatsidian/1_Architecture/Components/ProviderAdapters]]

        if (labelEl) {
          labelEl.textContent = model.name;
        }
        
        const providerEl = optionEl.querySelector('.chatsidian-selector-option-provider');
        if (providerEl) {
          providerEl.textContent = model.provider;
        }
      }
      
      // Update selected label if this is the active model
      if (this.activeModelId === model.id) {
        this.selectedLabelEl.textContent = model.name;
      }
    }
  }
  
  private removeModel(modelId: string): void {
    // Remove from list
    this.models = this.models.filter(m => m.id !== modelId);
    
    // Remove from dropdown
    const optionEl = this.dropdownEl.querySelector(`.chatsidian-selector-option[data-id="${modelId}"]`);
    
    if (optionEl) {
      optionEl.remove();
    }
    
    // Reset active model if it was removed
    if (this.activeModelId === modelId) {
      this.setActiveModel(null);
    }
  }
}
```

This component implements a dropdown selector for models with the following features:
1. Displaying a list of available models
2. Selecting a model to use for conversations
3. Visual indicator for the currently selected model
4. Integration with the ModelManager from Phase 2
5. Provider-specific icons for different AI services

Like the `AgentSelector`, this component follows Obsidian's UI patterns with a clean dropdown interface and proper event handling.

### CSS Styling for Selectors

Let's add CSS styling for the agent and model selectors:

```css
/* src/styles.css - Agent and Model selector styling */

/* Selector container */
.chatsidian-agent-selector,
.chatsidian-model-selector {
  position: relative;
  margin-right: 8px;
}

/* Selector button */
.chatsidian-selector-button {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  background-color: var(--background-modifier-form-field);
  cursor: pointer;
  transition: border-color 0.15s ease;
  min-width: 120px;
}

.chatsidian-selector-button:hover,
.chatsidian-selector-button-open {
  border-color: var(--interactive-accent);
}

.chatsidian-selector-icon {
  margin-right: 6px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
}

.chatsidian-selector-label {
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.9em;
}

.chatsidian-selector-arrow {
  margin-left: 6px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Dropdown */
.chatsidian-selector-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  width: 200px;
  max-height: 300px;
  overflow-y: auto;
  margin-top: 4px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  background-color: var(--background-primary);
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* Divider */
.chatsidian-selector-divider {
  height: 1px;
  background-color: var(--background-modifier-border);
  margin: 4px 0;
}

/* Options */
.chatsidian-selector-option {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  cursor: pointer;
}

.chatsidian-selector-option:hover {
  background-color: var(--background-modifier-hover);
}

.chatsidian-selector-option-active {
  background-color: var(--background-modifier-hover);
  font-weight: 500;
}

.chatsidian-selector-option-icon {
  margin-right: 8px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
}

.chatsidian-selector-option-label {
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.9em;
}

.chatsidian-selector-option-provider {
  font-size: 0.8em;
  color: var(--text-muted);
  margin-left: 8px;
}
```

This CSS provides styling for:
1. Selector buttons with icons and labels
2. Dropdown menus for selecting options
3. Visual indicators for active selections
4. Provider labels for models

All styling uses Obsidian's CSS variables to ensure compatibility with different themes.

### Integration with ChatView

We need to integrate the `AgentSelector` and `ModelSelector` components with the `ChatView`:

```typescript
// src/ui/ChatView.ts (updated for agent and model selection)
import { AgentSelector } from './AgentSelector';
import { ModelSelector } from './ModelSelector';

export class ChatView extends ItemView {
  // ... existing code ...
  
  private agentSelector: AgentSelector;
  private modelSelector: ModelSelector;
  private currentAgentId: string | null = null;
  private currentModelId: string | null = null;
  
  async onOpen(): Promise<void> {
    // ... existing setup code ...
    
    // Create header
    const headerEl = this.contentContainerEl.createDiv({
      cls: 'chatsidian-header'
    });
    
    // Create conversation selector container
    const conversationSelectorContainer = headerEl.createDiv({
      cls: 'chatsidian-conversation-selector-container'
    });
    
    // Initialize conversation selector
    this.conversationSelector = new ConversationSelector(
      conversationSelectorContainer,
      this.eventBus,
      this.storage
    );
    
    // Create selectors container
    const selectorsContainer = headerEl.createDiv({
      cls: 'chatsidian-selectors-container'
    });
    
    // Initialize agent selector
    this.agentSelector = new AgentSelector(
      selectorsContainer.createDiv({ cls: 'chatsidian-agent-selector-container' }),
      this.eventBus,
      this.agentManager
    );
    
    // Initialize model selector
    this.modelSelector = new ModelSelector(
      selectorsContainer.createDiv({ cls: 'chatsidian-model-selector-container' }),
      this.eventBus,
      this.modelManager
    );
    
    // ... rest of existing code ...
    
    // Register agent and model events
    this.registerAgentModelEvents();
  }
  
  private registerAgentModelEvents(): void {
    // Listen for agent selection
    this.registerEvent(
      this.eventBus.on('agent:selected', (agentId: string | null) => {
        this.handleAgentSelected(agentId);
      })
    );
    
    // Listen for model selection
    this.registerEvent(
      this.eventBus.on('model:selected', (modelId: string | null) => {
        this.handleModelSelected(modelId);
      })
    );
  }
  
  private async handleAgentSelected(agentId: string | null): Promise<void> {
    // Update current agent
    this.currentAgentId = agentId;
    
    // If we have an active conversation, update its agent ID
    if (this.currentConversationId) {
      try {
        // Get conversation
        const conversation = await this.storage.getConversation(this.currentConversationId);
        
        if (conversation) {
          // Update agent
          conversation.agentId = agentId;
          
          // Save conversation
          await this.storage.saveConversation(conversation);
        }
      } catch (error) {
        console.error('Error updating conversation agent:', error);
      }
    }
  }
  
  private async handleModelSelected(modelId: string | null): Promise<void> {
    // Update current model
    this.currentModelId = modelId;
    
    // If we have an active conversation, update its model ID
    if (this.currentConversationId) {
      try {
        // Get conversation
        const conversation = await this.storage.getConversation(this.currentConversationId);
        
        if (conversation) {
          // Update model
          conversation.modelId = modelId;
          
          // Save conversation
          await this.storage.saveConversation(conversation);
        }
      } catch (error) {
        console.error('Error updating conversation model:', error);
      }
    }
  }
  
  private async loadConversation(conversationId: string): Promise<void> {
    // ... existing load code ...
    
    // Update agent and model selectors if the conversation has specific settings
    if (conversation.agentId) {
      this.agentSelector.setActiveAgent(conversation.agentId);
      this.currentAgentId = conversation.agentId;
    }
    
    if (conversation.modelId) {
      this.modelSelector.setActiveModel(conversation.modelId);
      this.currentModelId = conversation.modelId;
    }
    
    // ... rest of existing load code ...
  }
  
  private async handleMessageSubmit(content: string): Promise<void> {
    // ... existing code ...
    
    try {
      // ... existing message creation code ...
      
      // Send message to MCP Client with agent and model IDs
      const assistantMessage = await this.mcpClient.sendMessage({
        message: userMessage,
        conversationId: this.currentConversationId,
        agentId: this.currentAgentId,
        modelId: this.currentModelId
      });
      
      // ... rest of existing code ...
    } catch (error) {
      // ... existing error handling ...
    }
  }
}
```

This integration adds:
1. Displaying the agent and model selectors in the header
2. Handling agent and model selection events
3. Updating the current conversation with the selected agent and model
4. Passing agent and model information to the MCP client when sending messages
5. Loading agent and model settings from conversations

### Agent and Model Interfaces

For reference, here are the interfaces for agents and models that these components use:

```typescript
// src/mcp/AgentManager.ts
export interface Agent {
  id: string;
  name: string;
  description?: string;
  emoji: string;
  tools?: string[];
  systemPrompt?: string;
  metadata?: {
    [key: string]: any;
  };
}

// src/mcp/ModelManager.ts
export interface Model {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  metadata?: {
    [key: string]: any;
  };
}
```

These interfaces define the structure for agents and models used by the selectors. The `AgentManager` and `ModelManager` from Phase 2 provide methods for creating, retrieving, updating, and deleting agents and models.

## Default Agent and Model Settings

To allow users to set default agent and model preferences, we'll add them to the settings interface:

```typescript
// src/models/Settings.ts (addition)
export interface Settings {
  // ... existing settings ...
  defaultAgentId?: string;
  defaultModelId?: string;
}
```

When loading the agent and model selectors, they should check for these default settings:

```typescript
// src/ui/AgentSelector.ts (update)
private async loadAgents(): Promise<void> {
  try {
    // Get agents from manager
    this.agents = await this.agentManager.getAgents();
    
    // Update dropdown
    this.updateAgentsList();
    
    // Get settings
    const settings = await this.storage.getSettings();
    
    // Set default agent if specified
    if (settings.defaultAgentId) {
      this.setActiveAgent(settings.defaultAgentId);
    }
  } catch (error) {
    console.error('Error loading agents:', error);
    new Notice('Failed to load agents');
  }
}

// src/ui/ModelSelector.ts (update)
private async loadModels(): Promise<void> {
  try {
    // Get models from manager
    this.models = await this.modelManager.getModels();
    
    // Update dropdown
    this.updateModelsList();
    
    // Get settings
    const settings = await this.storage.getSettings();
    
    // Set default model if specified
    if (settings.defaultModelId) {
      this.setActiveModel(settings.defaultModelId);
    }
  } catch (error) {
    console.error('Error loading models:', error);
    new Notice('Failed to load models');
  }
}
```

These default settings will be configurable in the settings tab that will be implemented in a later microphase.

## Additional Header Styling

To properly integrate the agent and model selectors into the header, we'll update the header styling:

```css
/* src/styles.css - Header layout */
.chatsidian-header {
  display: flex;
  align-items: center;
  padding: 12px 12px 12px 42px; /* Extra left padding for hamburger */
  border-bottom: 1px solid var(--background-modifier-border);
  background-color: var(--background-primary);
  z-index: 5;
}

.chatsidian-conversation-selector-container {
  flex-grow: 1;
  margin-right: 16px;
}

.chatsidian-selectors-container {
  display: flex;
  align-items: center;
}

.chatsidian-agent-selector-container,
.chatsidian-model-selector-container {
  margin-right: 8px;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .chatsidian-header {
    flex-wrap: wrap;
  }
  
  .chatsidian-conversation-selector-container {
    margin-bottom: 8px;
    width: 100%;
  }
  
  .chatsidian-selectors-container {
    width: 100%;
    justify-content: flex-end;
  }
}
```

This CSS ensures the header components are properly laid out and responsive, with the conversation selector taking up available space and the agent/model selectors aligned to the right.

## Testing Strategy

Testing for this microphase will involve:

1. **Unit Testing**:
   - Test the `AgentSelector` and `ModelSelector` component methods
   - Verify proper event handling
   - Test selection persistence

2. **Integration Testing**:
   - Test integration with `ChatView`
   - Verify agent and model selection affects conversations
   - Test persistence of selections

3. **Manual UI Testing**:
   - Test agent and model selection from dropdowns
   - Verify visual indicators for current selections
   - Test with multiple agents and models
   - Verify conversation-specific settings override defaults

4. **Accessibility Testing**:
   - Verify keyboard navigation for dropdowns
   - Test screen reader compatibility
   - Check for proper focus management

## Dependencies

This microphase depends on:
- Phase 1 components (EventBus, StorageManager)
- Phase 2 components (AgentManager, ModelManager)
- Phase 3.1 (Core View Registration)
- Phase 3.4 (Conversation Management)

## Integration with MCP

The agent and model selection components integrate with the Model Context Protocol (MCP) from Phase 2 by:

1. **Providing Context to Messages**:
   - The selected agent and model IDs are passed to the MCP client when sending messages
   - This allows the MCP client to use the appropriate agent and model for processing

2. **Conversation-Specific Settings**:
   - Each conversation can have its own agent and model settings
   - These are saved in the conversation data and loaded when the conversation is selected

3. **Default Settings**:
   - Default agent and model settings can be configured in the plugin settings
   - These are used when no conversation-specific settings are available

This integration ensures that the UI selections translate directly to the underlying AI behavior, providing a consistent and customizable experience.

## Next Steps

After completing this microphase, we'll have fully functional agent and model selection components integrated with the chat interface. The next microphases will focus on:
1. Implementing tool call visualization
2. Creating the settings interface
3. Adding responsive design and accessibility enhancements

## Additional Resources

- [[💻 Coding/Projects/Chatsidian/4_Documentation/UIDesignGuidelines]]
- [[💻 Coding/Projects/Chatsidian/1_Architecture/Components/MCPConnector]] (for MCP integration details)
