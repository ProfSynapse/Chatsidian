---
title: Phase 3.8 - Settings Interface
description: Creating settings interface using Obsidian's PluginSettingTab
date: 2025-05-03
status: planning
tags:
  - implementation
  - phase3
  - ui
  - settings
  - configuration
  - plugin-settings
---

# Phase 3.8: Settings Interface

## Overview

This microphase focuses on creating a comprehensive settings interface for the Chatsidian plugin using Obsidian's `PluginSettingTab` API. The settings interface will allow users to configure various aspects of the plugin, including API keys for AI providers, agent configurations, tool permissions, and UI preferences.

A well-designed settings interface is critical for plugin usability, as it provides users with control over the plugin's behavior and customization options. By leveraging Obsidian's native settings API, we can create a consistent and intuitive experience for users.

## Implementation Details

### Settings Tab Component

The main `ChatsidianSettingsTab` class extends Obsidian's `PluginSettingTab`:

```typescript
// src/settings/ChatsidianSettingsTab.ts
import { App, PluginSettingTab } from 'obsidian';
import { ChatsidianPlugin } from '../main';
import { APIKeySettings } from './APIKeySettings';
import { AgentToolSettings } from './AgentToolSettings';
import { ConversationSettings } from './ConversationSettings';
import { UISettings } from './UISettings';

export class ChatsidianSettingsTab extends PluginSettingTab {
  private plugin: ChatsidianPlugin;
  private apiKeySettings: APIKeySettings;
  private agentToolSettings: AgentToolSettings;
  private conversationSettings: ConversationSettings;
  private uiSettings: UISettings;
  
  constructor(app: App, plugin: ChatsidianPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    
    // Initialize settings components
    this.apiKeySettings = new APIKeySettings(plugin);
    this.agentToolSettings = new AgentToolSettings(plugin);
    this.conversationSettings = new ConversationSettings(plugin);
    this.uiSettings = new UISettings(plugin);
  }
  
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    
    containerEl.createEl('h1', { text: 'Chatsidian Settings' });
    
    // Add API Key section
    containerEl.createEl('h2', { text: 'API Keys' });
    this.apiKeySettings.display(containerEl);
    
    // Add Agent & Tool section
    containerEl.createEl('h2', { text: 'Agents & Tools' });
    this.agentToolSettings.display(containerEl);
    
    // Add Conversation section
    containerEl.createEl('h2', { text: 'Conversations' });
    this.conversationSettings.display(containerEl);
    
    // Add UI section
    containerEl.createEl('h2', { text: 'User Interface' });
    this.uiSettings.display(containerEl);
    
    // Add plugin info
    containerEl.createEl('div', {
      cls: 'chatsidian-settings-footer',
      text: `Chatsidian v${this.plugin.manifest.version}`
    });
  }
}
```

This component organizes the settings interface into sections for different aspects of the plugin, making it easy for users to find and configure specific settings.

### API Key Settings

The `APIKeySettings` class handles API key configuration for different providers:

```typescript
// src/settings/APIKeySettings.ts
import { Setting } from 'obsidian';
import { ChatsidianPlugin } from '../main';

export class APIKeySettings {
  private plugin: ChatsidianPlugin;
  
  constructor(plugin: ChatsidianPlugin) {
    this.plugin = plugin;
  }
  
  display(containerEl: HTMLElement): void {
    // Get settings
    const settings = this.plugin.settings;
    
    // Add description
    containerEl.createEl('p', { 
      text: 'Configure API keys for AI providers. Your API keys are stored securely in your vault.'
    });
    
    // Add Anthropic API key setting
    new Setting(containerEl)
      .setName('Anthropic API Key')
      .setDesc('API key for Anthropic Claude models')
      .addText(text => text
        .setPlaceholder('Enter your Anthropic API key')
        .setValue(settings.apiKeys.anthropic || '')
        .onChange(async (value) => {
          settings.apiKeys.anthropic = value;
          await this.plugin.saveSettings();
        })
      );
    
    // Add OpenAI API key setting
    new Setting(containerEl)
      .setName('OpenAI API Key')
      .setDesc('API key for OpenAI GPT models')
      .addText(text => text
        .setPlaceholder('Enter your OpenAI API key')
        .setValue(settings.apiKeys.openai || '')
        .onChange(async (value) => {
          settings.apiKeys.openai = value;
          await this.plugin.saveSettings();
        })
      );
    
    // Add API base URL settings
    containerEl.createEl('h3', { text: 'API Base URLs' });
    containerEl.createEl('p', { 
      text: 'Optional: Override the default API endpoints (for self-hosted models or proxies)'
    });
    
    // Add Anthropic API URL setting
    new Setting(containerEl)
      .setName('Anthropic API URL')
      .setDesc('Leave empty to use the default endpoint')
      .addText(text => text
        .setPlaceholder('https://api.anthropic.com')
        .setValue(settings.apiBaseUrls.anthropic || '')
        .onChange(async (value) => {
          settings.apiBaseUrls.anthropic = value;
          await this.plugin.saveSettings();
        })
      );
    
    // Add OpenAI API URL setting
    new Setting(containerEl)
      .setName('OpenAI API URL')
      .setDesc('Leave empty to use the default endpoint')
      .addText(text => text
        .setPlaceholder('https://api.openai.com')
        .setValue(settings.apiBaseUrls.openai || '')
        .onChange(async (value) => {
          settings.apiBaseUrls.openai = value;
          await this.plugin.saveSettings();
        })
      );
  }
}
```

This component provides secure input fields for API keys and optional custom API endpoints for self-hosted models or proxies.

### Agent & Tool Settings

The `AgentToolSettings` class manages agent configuration and tool permissions:

```typescript
// src/settings/AgentToolSettings.ts
import { Setting, ButtonComponent, setIcon, Notice } from 'obsidian';
import { ChatsidianPlugin } from '../main';
import { AgentEditModal } from './modals/AgentEditModal';
import { ModelEditModal } from './modals/ModelEditModal';

export class AgentToolSettings {
  private plugin: ChatsidianPlugin;
  
  constructor(plugin: ChatsidianPlugin) {
    this.plugin = plugin;
  }
  
  display(containerEl: HTMLElement): void {
    // Get settings
    const settings = this.plugin.settings;
    
    // Default Agent and Model
    containerEl.createEl('h3', { text: 'Default Selections' });
    
    // Add default agent setting
    new Setting(containerEl)
      .setName('Default Agent')
      .setDesc('The default agent to use for new conversations')
      .addDropdown(async dropdown => {
        // Add empty option
        dropdown.addOption('', 'None (Use system default)');
        
        // Get agents
        const agents = await this.plugin.agentManager.getAgents();
        
        // Add agent options
        for (const agent of agents) {
          dropdown.addOption(agent.id, agent.name);
        }
        
        // Set value
        dropdown.setValue(settings.defaultAgentId || '');
        
        // Handle change
        dropdown.onChange(async (value) => {
          settings.defaultAgentId = value || null;
          await this.plugin.saveSettings();
        });
      });
    
    // Add default model setting
    new Setting(containerEl)
      .setName('Default Model')
      .setDesc('The default model to use for new conversations')
      .addDropdown(async dropdown => {
        // Add empty option
        dropdown.addOption('', 'None (Use system default)');
        
        // Get models
        const models = await this.plugin.modelManager.getModels();
        
        // Add model options
        for (const model of models) {
          dropdown.addOption(model.id, `${model.name} (${model.provider})`);
        }
        
        // Set value
        dropdown.setValue(settings.defaultModelId || '');
        
        // Handle change
        dropdown.onChange(async (value) => {
          settings.defaultModelId = value || null;
          await this.plugin.saveSettings();
        });
      });
    
    // Agent Management
    containerEl.createEl('h3', { text: 'Agent Management' });
    
    // Create container for agents
    const agentsContainer = containerEl.createDiv({
      cls: 'chatsidian-settings-agents-container'
    });
    
    // Add button to create a new agent
    const agentButtonContainer = containerEl.createDiv({
      cls: 'chatsidian-settings-button-container'
    });
    
    const newAgentButton = new ButtonComponent(agentButtonContainer)
      .setButtonText('Create New Agent')
      .onClick(() => {
        const modal = new AgentEditModal(
          this.plugin.app,
          this.plugin.agentManager,
          null,
          () => {
            // Refresh display after creating agent
            this.display(containerEl);
          }
        );
        modal.open();
      });
    
    // Load agents
    this.loadAgents(agentsContainer);
    
    // Model Management
    containerEl.createEl('h3', { text: 'Model Management' });
    
    // Create container for models
    const modelsContainer = containerEl.createDiv({
      cls: 'chatsidian-settings-models-container'
    });
    
    // Add button to create a new model
    const modelButtonContainer = containerEl.createDiv({
      cls: 'chatsidian-settings-button-container'
    });
    
    const newModelButton = new ButtonComponent(modelButtonContainer)
      .setButtonText('Create New Model')
      .onClick(() => {
        const modal = new ModelEditModal(
          this.plugin.app,
          this.plugin.modelManager,
          null,
          () => {
            // Refresh display after creating model
            this.display(containerEl);
          }
        );
        modal.open();
      });
    
    // Load models
    this.loadModels(modelsContainer);
  }
  
  private async loadAgents(containerEl: HTMLElement): Promise<void> {
    try {
      // Clear container
      containerEl.empty();
      
      // Get agents
      const agents = await this.plugin.agentManager.getAgents();
      
      if (agents.length === 0) {
        containerEl.createEl('p', {
          text: 'No agents found. Create a new agent to get started.'
        });
        return;
      }
      
      // Render each agent
      for (const agent of agents) {
        this.renderAgentSetting(containerEl.createDiv(), agent);
      }
    } catch (error) {
      console.error('Error loading agents:', error);
      containerEl.createEl('p', {
        text: 'Error loading agents. Please try again.'
      });
    }
  }
  
  private async loadModels(containerEl: HTMLElement): Promise<void> {
    try {
      // Clear container
      containerEl.empty();
      
      // Get models
      const models = await this.plugin.modelManager.getModels();
      
      if (models.length === 0) {
        containerEl.createEl('p', {
          text: 'No models found. Create a new model to get started.'
        });
        return;
      }
      
      // Render each model
      for (const model of models) {
        this.renderModelSetting(containerEl.createDiv(), model);
      }
    } catch (error) {
      console.error('Error loading models:', error);
      containerEl.createEl('p', {
        text: 'Error loading models. Please try again.'
      });
    }
  }
  
  private renderAgentSetting(containerEl: HTMLElement, agent: Agent): void {
    const agentEl = containerEl.createDiv({
      cls: 'chatsidian-settings-agent'
    });
    
    // Add agent header
    const headerEl = agentEl.createDiv({
      cls: 'chatsidian-settings-agent-header'
    });
    
    // Add emoji and name
    const nameContainer = headerEl.createDiv({
      cls: 'chatsidian-settings-agent-name-container'
    });
    
    // Add emoji avatar
    nameContainer.createEl('span', {
      cls: 'chatsidian-settings-agent-emoji',
      text: agent.emoji || '🤖'
    });
    
    // Add agent name
    nameContainer.createEl('h4', {
      text: agent.name,
      cls: 'chatsidian-settings-agent-name'
    });
    
    // Add actions
    const actionsEl = headerEl.createDiv({
      cls: 'chatsidian-settings-agent-actions'
    });
    
    // Add edit button
    const editButton = new ButtonComponent(actionsEl)
      .setIcon('pencil')
      .setTooltip('Edit agent')
      .onClick(() => {
        const modal = new AgentEditModal(
          this.plugin.app,
          this.plugin.agentManager,
          agent,
          () => {
            // Refresh just this agent
            this.updateAgentSetting(agentEl, agent);
          }
        );
        modal.open();
      });
    
    // Add delete button
    const deleteButton = new ButtonComponent(actionsEl)
      .setIcon('trash')
      .setTooltip('Delete agent')
      .onClick(async () => {
        // Confirm deletion
        if (confirm(`Are you sure you want to delete the agent "${agent.name}"?`)) {
          await this.plugin.agentManager.deleteAgent(agent.id);
          // Remove from DOM
          agentEl.remove();
        }
      });
    
    // Add agent description if exists
    if (agent.description) {
      agentEl.createEl('p', {
        text: agent.description,
        cls: 'chatsidian-settings-agent-description'
      });
    }
    
    // Add tool permissions
    this.renderAgentToolPermissions(agentEl, agent);
  }
  
  private updateAgentSetting(agentEl: HTMLElement, agent: Agent): void {
    // Clear container
    agentEl.empty();
    
    // Re-render agent
    this.renderAgentSetting(agentEl, agent);
  }
  
  private renderAgentToolPermissions(containerEl: HTMLElement, agent: Agent): void {
    // Get available tools
    const availableTools = [
      { id: 'noteReader', name: 'Note Reader', description: 'Read notes from the vault' },
      { id: 'noteEditor', name: 'Note Editor', description: 'Edit notes in the vault' },
      { id: 'vaultManager', name: 'Vault Manager', description: 'Manage files and folders in the vault' },
      { id: 'vaultLibrarian', name: 'Vault Librarian', description: 'Search and navigate the vault' },
      { id: 'paletteCommander', name: 'Palette Commander', description: 'Execute commands from the command palette' },
      { id: 'projectManager', name: 'Project Manager', description: 'Manage projects in the vault' }
    ];
    
    // Create tools section
    const toolsSection = containerEl.createDiv({
      cls: 'chatsidian-settings-agent-tools'
    });
    
    // Add heading
    toolsSection.createEl('h5', {
      text: 'Allowed Tools'
    });
    
    // Add toggle for each tool
    for (const tool of availableTools) {
      new Setting(toolsSection)
        .setName(tool.name)
        .setDesc(tool.description)
        .addToggle(toggle => {
          toggle
            .setValue(agent.tools?.includes(tool.id) || false)
            .onChange(async (value) => {
              // Initialize tools array if not exists
              if (!agent.tools) {
                agent.tools = [];
              }
              
              if (value && !agent.tools.includes(tool.id)) {
                // Add tool
                agent.tools.push(tool.id);
              } else if (!value && agent.tools.includes(tool.id)) {
                // Remove tool
                agent.tools = agent.tools.filter(id => id !== tool.id);
              }
              
              // Save agent
              await this.plugin.agentManager.saveAgent(agent);
            });
        });
    }
  }
  
  private renderModelSetting(containerEl: HTMLElement, model: Model): void {
    const modelEl = containerEl.createDiv({
      cls: 'chatsidian-settings-model'
    });
    
    // Add model header
    const headerEl = modelEl.createDiv({
      cls: 'chatsidian-settings-model-header'
    });
    
    // Add model name
    headerEl.createEl('h4', {
      text: model.name,
      cls: 'chatsidian-settings-model-name'
    });
    
    // Add model provider
    headerEl.createEl('span', {
      text: model.provider,
      cls: 'chatsidian-settings-model-provider'
    });
    
    // Add edit button
    const editButton = headerEl.createDiv({
      cls: 'chatsidian-settings-model-action',
      attr: { 'aria-label': 'Edit model' }
    });
    setIcon(editButton, 'edit');
    
    // Add delete button
    const deleteButton = headerEl.createDiv({
      cls: 'chatsidian-settings-model-action',
      attr: { 'aria-label': 'Delete model' }
    });
    setIcon(deleteButton, 'trash');
    
    // Add model details
    const detailsEl = modelEl.createDiv({
      cls: 'chatsidian-settings-model-details'
    });
    
    // Add model ID
    detailsEl.createEl('div', {
      cls: 'chatsidian-settings-model-detail',
      text: `Model ID: ${model.modelId}`
    });
    
    // Add max tokens if available
    if (model.maxTokens) {
      detailsEl.createEl('div', {
        cls: 'chatsidian-settings-model-detail',
        text: `Max Tokens: ${model.maxTokens}`
      });
    }
    
    // Add temperature if available
    if (model.temperature !== undefined) {
      detailsEl.createEl('div', {
        cls: 'chatsidian-settings-model-detail',
        text: `Temperature: ${model.temperature}`
      });
    }
    
    // Add edit button handler
    editButton.addEventListener('click', () => {
      const modal = new ModelEditModal(
        this.plugin.app,
        this.plugin.modelManager,
        model,
        () => {
          // Refresh display after editing model
          this.display(containerEl);
        }
      );
      modal.open();
    });
    
    // Add delete button handler
    deleteButton.addEventListener('click', () => {
      // Get confirmation
      if (confirm(`Are you sure you want to delete the model "${model.name}"?`)) {
        // Delete model
        this.plugin.modelManager.deleteModel(model.id)
          .then(() => {
            // Refresh display after deleting model
            this.display(containerEl);
          })
          .catch(error => {
            console.error('Error deleting model:', error);
            // Show error notification
            new Notice('Failed to delete model');
          });
      }
    });
  }
}
```

This component provides settings for:
1. Default agent and model selection
2. Agent management (create, edit, delete)
3. Tool permissions for each agent
4. Model management (create, edit, delete)

### Conversation Settings

The `ConversationSettings` class handles settings related to conversations:

```typescript
// src/settings/ConversationSettings.ts
import { Setting } from 'obsidian';
import { ChatsidianPlugin } from '../main';

export class ConversationSettings {
  private plugin: ChatsidianPlugin;
  
  constructor(plugin: ChatsidianPlugin) {
    this.plugin = plugin;
  }
  
  display(containerEl: HTMLElement): void {
    // Get settings
    const settings = this.plugin.settings;
    
    // Add description
    containerEl.createEl('p', { 
      text: 'Configure how conversations are managed and stored.'
    });
    
    // Add conversation storage settings
    new Setting(containerEl)
      .setName('Storage Location')
      .setDesc('The folder where conversations are stored in the vault.')
      .addText(text => text
        .setPlaceholder('conversations')
        .setValue(settings.conversationStorage.folder || 'conversations')
        .onChange(async (value) => {
          settings.conversationStorage.folder = value || 'conversations';
          await this.plugin.saveSettings();
        })
      );
    
    // Add conversation history limit
    new Setting(containerEl)
      .setName('Conversation History Limit')
      .setDesc('Maximum number of conversations to keep in history. Set to 0 for unlimited.')
      .addText(text => text
        .setPlaceholder('50')
        .setValue(String(settings.conversationStorage.historyLimit || 50))
        .onChange(async (value) => {
          const numValue = parseInt(value);
          if (!isNaN(numValue) && numValue >= 0) {
            settings.conversationStorage.historyLimit = numValue;
            await this.plugin.saveSettings();
          }
        })
      );
    
    // Add auto-title setting
    new Setting(containerEl)
      .setName('Auto-generate Conversation Titles')
      .setDesc('Automatically generate titles for new conversations based on the first message.')
      .addToggle(toggle => toggle
        .setValue(settings.conversations.autoTitle || true)
        .onChange(async (value) => {
          settings.conversations.autoTitle = value;
          await this.plugin.saveSettings();
        })
      );
    
    // Add conversation cleanup setting
    new Setting(containerEl)
      .setName('Conversation Cleanup')
      .setDesc('Automatically clean up old conversations when the history limit is reached.')
      .addToggle(toggle => toggle
        .setValue(settings.conversationStorage.autoCleanup || true)
        .onChange(async (value) => {
          settings.conversationStorage.autoCleanup = value;
          await this.plugin.saveSettings();
        })
      );
    
    // Add message limit setting
    new Setting(containerEl)
      .setName('Message Character Limit')
      .setDesc('Maximum number of characters allowed in a single message.')
      .addText(text => text
        .setPlaceholder('32000')
        .setValue(String(settings.conversations.messageCharLimit || 32000))
        .onChange(async (value) => {
          const numValue = parseInt(value);
          if (!isNaN(numValue) && numValue > 0) {
            settings.conversations.messageCharLimit = numValue;
            await this.plugin.saveSettings();
          }
        })
      );
  }
}
```

This component provides settings for:
1. Conversation storage location
2. History limits and cleanup options
3. Auto-titling for new conversations
4. Message character limits

### UI Settings

The `UISettings` class handles user interface preferences:

```typescript
// src/settings/UISettings.ts
import { Setting } from 'obsidian';
import { ChatsidianPlugin } from '../main';

export class UISettings {
  private plugin: ChatsidianPlugin;
  
  constructor(plugin: ChatsidianPlugin) {
    this.plugin = plugin;
  }
  
  display(containerEl: HTMLElement): void {
    // Get settings
    const settings = this.plugin.settings;
    
    // Add description
    containerEl.createEl('p', { 
      text: 'Configure the appearance and behavior of the chat interface.'
    });
    
    // Add sidebar default state setting
    new Setting(containerEl)
      .setName('Sidebar Default State')
      .setDesc('Whether the conversation sidebar should be open by default.')
      .addToggle(toggle => toggle
        .setValue(settings.ui.sidebarOpenByDefault || false)
        .onChange(async (value) => {
          settings.ui.sidebarOpenByDefault = value;
          await this.plugin.saveSettings();
        })
      );
    
    // Add message display settings
    containerEl.createEl('h3', { text: 'Message Display' });
    
    // Add timestamp setting
    new Setting(containerEl)
      .setName('Show Message Timestamps')
      .setDesc('Show timestamps for each message.')
      .addToggle(toggle => toggle
        .setValue(settings.ui.showTimestamps || true)
        .onChange(async (value) => {
          settings.ui.showTimestamps = value;
          await this.plugin.saveSettings();
        })
      );
    
    // Add typing indicator setting
    new Setting(containerEl)
      .setName('Show Typing Indicator')
      .setDesc('Show a typing indicator when the AI is generating a response.')
      .addToggle(toggle => toggle
        .setValue(settings.ui.showTypingIndicator || true)
        .onChange(async (value) => {
          settings.ui.showTypingIndicator = value;
          await this.plugin.saveSettings();
        })
      );
    
    // Add message streaming setting
    new Setting(containerEl)
      .setName('Enable Message Streaming')
      .setDesc('Show AI responses as they are being generated, rather than waiting for the full response.')
      .addToggle(toggle => toggle
        .setValue(settings.ui.enableMessageStreaming || true)
        .onChange(async (value) => {
          settings.ui.enableMessageStreaming = value;
          await this.plugin.saveSettings();
        })
      );
    
    // Add tool call settings
    containerEl.createEl('h3', { text: 'Tool Calls' });
    
    // Add tool call visibility setting
    new Setting(containerEl)
      .setName('Show Tool Calls')
      .setDesc('Show tool calls and their results in messages.')
      .addToggle(toggle => toggle
        .setValue(settings.ui.showToolCalls || true)
        .onChange(async (value) => {
          settings.ui.showToolCalls = value;
          await this.plugin.saveSettings();
        })
      );
    
    // Add tool call expanded by default setting
    new Setting(containerEl)
      .setName('Expand Tool Calls by Default')
      .setDesc('Whether tool call details should be expanded by default.')
      .addToggle(toggle => toggle
        .setValue(settings.ui.expandToolCallsByDefault || false)
        .onChange(async (value) => {
          settings.ui.expandToolCallsByDefault = value;
          await this.plugin.saveSettings();
        })
      );
    
    // Add input area settings
    containerEl.createEl('h3', { text: 'Input Area' });
    
    // Add enter to send setting
    new Setting(containerEl)
      .setName('Enter to Send')
      .setDesc('Use Enter key to send messages. Shift+Enter will create a new line.')
      .addToggle(toggle => toggle
        .setValue(settings.ui.enterToSend || true)
        .onChange(async (value) => {
          settings.ui.enterToSend = value;
          await this.plugin.saveSettings();
        })
      );
    
    // Add autofocus input setting
    new Setting(containerEl)
      .setName('Autofocus Input')
      .setDesc('Automatically focus the input area when opening the chat view.')
      .addToggle(toggle => toggle
        .setValue(settings.ui.autofocusInput || true)
        .onChange(async (value) => {
          settings.ui.autofocusInput = value;
          await this.plugin.saveSettings();
        })
      );
    
    // Add spellcheck setting
    new Setting(containerEl)
      .setName('Enable Spellcheck')
      .setDesc('Enable spellcheck in the input area.')
      .addToggle(toggle => toggle
        .setValue(settings.ui.enableSpellcheck || true)
        .onChange(async (value) => {
          settings.ui.enableSpellcheck = value;
          await this.plugin.saveSettings();
        })
      );
  }
}
```

This component provides settings for:
1. Sidebar default state
2. Message display options (timestamps, typing indicator, streaming)
3. Tool call visibility and expansion
4. Input area behavior (Enter to send, autofocus, spellcheck)

### Edit Modals for Agents and Models

Let's implement the edit modals for agents and models:

```typescript
// src/settings/modals/AgentEditModal.ts
import { App, Modal, Setting } from 'obsidian';
import { AgentManager, Agent } from '../../mcp/AgentManager';

export class AgentEditModal extends Modal {
  private agentManager: AgentManager;
  private agent: Partial<Agent>;
  private isNew: boolean;
  private onSave: () => void;
  
  constructor(
    app: App,
    agentManager: AgentManager,
    agent: Agent | null,
    onSave: () => void
  ) {
    super(app);
    this.agentManager = agentManager;
    this.isNew = !agent;
    this.agent = agent ? { ...agent } : {
      name: '',
      description: '',
      emoji: '🤖',
      systemPrompt: '',
      tools: []
    };
    this.onSave = onSave;
  }
  
  onOpen(): void {
    // Set modal title
    this.titleEl.setText(this.isNew ? 'Create Agent' : 'Edit Agent');
    
    // Create form
    const { contentEl } = this;
    
    // Add name setting
    new Setting(contentEl)
      .setName('Name')
      .setDesc('The name of the agent.')
      .addText(text => text
        .setValue(this.agent.name || '')
        .setPlaceholder('Agent name')
        .onChange(value => {
          this.agent.name = value;
        })
      );
    
    // Add description setting
    new Setting(contentEl)
      .setName('Description')
      .setDesc('A description of what this agent does.')
      .addTextArea(textarea => textarea
        .setValue(this.agent.description || '')
        .setPlaceholder('Agent description')
        .onChange(value => {
          this.agent.description = value;
        })
      );
    
    // Add emoji avatar setting
    new Setting(contentEl)
      .setName('Avatar')
      .setDesc('Choose an emoji avatar for this agent')
      .addText(text => {
        text
          .setValue(this.agent.emoji || '🤖')
          .setPlaceholder('Enter emoji')
          .onChange(value => {
            this.agent.emoji = value;
          });
          
        // Make text input emoji-friendly
        text.inputEl.style.fontSize = '24px';
        text.inputEl.style.textAlign = 'center';
        text.inputEl.style.width = '48px';
        
        // Add hint text
        contentEl.createEl('div', {
          cls: 'chatsidian-emoji-hint',
          text: 'Click to enter an emoji (Windows: Win+., Mac: Cmd+Ctrl+Space)'
        });
      });
    
    // Add system prompt setting
    const systemPromptSetting = new Setting(contentEl)
      .setName('System Prompt')
      .setDesc('The system prompt to use for this agent. This sets the behavior and capabilities of the agent.');
    
    // Add large textarea for system prompt
    const systemPromptContainer = contentEl.createDiv({
      cls: 'chatsidian-system-prompt-container'
    });
    
    const systemPromptTextarea = systemPromptContainer.createEl('textarea', {
      cls: 'chatsidian-system-prompt-textarea',
      attr: { rows: '10' }
    });
    
    systemPromptTextarea.value = this.agent.systemPrompt || '';
    systemPromptTextarea.addEventListener('input', () => {
      this.agent.systemPrompt = systemPromptTextarea.value;
    });
    
    // Add buttons
    const buttonContainer = contentEl.createDiv({
      cls: 'chatsidian-modal-buttons'
    });
    
    // Add cancel button
    const cancelButton = buttonContainer.createEl('button', {
      cls: 'chatsidian-modal-button chatsidian-modal-button-secondary',
      text: 'Cancel'
    });
    
    cancelButton.addEventListener('click', () => {
      this.close();
    });
    
    // Add save button
    const saveButton = buttonContainer.createEl('button', {
      cls: 'chatsidian-modal-button chatsidian-modal-button-primary',
      text: this.isNew ? 'Create' : 'Save'
    });
    
    saveButton.addEventListener('click', () => {
      this.save();
    });
  }
  
  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
  
  async save(): Promise<void> {
    // Validate inputs
    if (!this.agent.name) {
      // Show error message
      const { contentEl } = this;
      const errorEl = contentEl.createDiv({
        cls: 'chatsidian-modal-error',
        text: 'Agent name is required.'
      });
      
      // Remove error after 3 seconds
      setTimeout(() => {
        errorEl.remove();
      }, 3000);
      
      return;
    }
    
    try {
      if (this.isNew) {
        // Create new agent
        await this.agentManager.createAgent(this.agent);
      } else {
        // Update existing agent
        await this.agentManager.saveAgent(this.agent as Agent);
      }
      
      // Call onSave callback
      this.onSave();
      
      // Close modal
      this.close();
    } catch (error) {
      console.error('Error saving agent:', error);
      
      // Show error message
      const { contentEl } = this;
      const errorEl = contentEl.createDiv({
        cls: 'chatsidian-modal-error',
        text: 'Failed to save agent.'
      });
      
      // Remove error after 3 seconds
      setTimeout(() => {
        errorEl.remove();
      }, 3000);
    }
  }
}

// src/settings/modals/ModelEditModal.ts
import { App, Modal, Setting } from 'obsidian';
import { ModelManager, Model } from '../../mcp/ModelManager';

export class ModelEditModal extends Modal {
  private modelManager: ModelManager;
  private model: Partial<Model>;
  private isNew: boolean;
  private onSave: () => void;
  
  constructor(
    app: App,
    modelManager: ModelManager,
    model: Model | null,
    onSave: () => void
  ) {
    super(app);
    this.modelManager = modelManager;
    this.isNew = !model;
    this.model = model ? { ...model } : {
      name: '',
      provider: 'anthropic',
      modelId: '',
      maxTokens: 4000,
      temperature: 0.7
    };
    this.onSave = onSave;
  }
  
  onOpen(): void {
    // Set modal title
    this.titleEl.setText(this.isNew ? 'Create Model' : 'Edit Model');
    
    // Create form
    const { contentEl } = this;
    
    // Add name setting
    new Setting(contentEl)
      .setName('Name')
      .setDesc('The display name of the model.')
      .addText(text => text
        .setValue(this.model.name || '')
        .setPlaceholder('Model name')
        .onChange(value => {
          this.model.name = value;
        })
      );
    
    // Add provider setting
    new Setting(contentEl)
      .setName('Provider')
      .setDesc('The AI provider for this model.')
      .addDropdown(dropdown => {
        dropdown.addOption('anthropic', 'Anthropic');
        dropdown.addOption('openai', 'OpenAI');
        
        dropdown.setValue(this.model.provider || 'anthropic');
        dropdown.onChange(value => {
          this.model.provider = value;
          
          // Update model ID placeholder based on provider
          const modelIdSetting = contentEl.querySelector('.model-id-setting input');
          if (modelIdSetting) {
            if (value === 'anthropic') {
              modelIdSetting.setAttribute('placeholder', 'claude-3-opus-20240229');
            } else if (value === 'openai') {
              modelIdSetting.setAttribute('placeholder', 'gpt-4');
            }
          }
        });
      });
    
    // Add model ID setting
    const modelIdSetting = new Setting(contentEl)
      .setName('Model ID')
      .setDesc('The specific model identifier used by the provider.')
      .addText(text => {
        text
          .setValue(this.model.modelId || '')
          .setPlaceholder(this.model.provider === 'openai' ? 'gpt-4' : 'claude-3-opus-20240229')
          .onChange(value => {
            this.model.modelId = value;
          });
        
        // Add class for easy selection
        text.inputEl.parentElement?.addClass('model-id-setting');
      });
    
    // Add max tokens setting
    new Setting(contentEl)
      .setName('Max Tokens')
      .setDesc('Maximum number of tokens to generate in the response.')
      .addText(text => text
        .setValue(String(this.model.maxTokens || 4000))
        .onChange(value => {
          const numValue = parseInt(value);
          if (!isNaN(numValue) && numValue > 0) {
            this.model.maxTokens = numValue;
          }
        })
      );
    
    // Add temperature setting
    new Setting(contentEl)
      .setName('Temperature')
      .setDesc('Controls randomness. Lower values are more focused and deterministic, higher values more creative.')
      .addSlider(slider => slider
        .setLimits(0, 2, 0.1)
        .setValue(this.model.temperature || 0.7)
        .setDynamicTooltip()
        .onChange(value => {
          this.model.temperature = value;
        })
      );
    
    // Add buttons
    const buttonContainer = contentEl.createDiv({
      cls: 'chatsidian-modal-buttons'
    });
    
    // Add cancel button
    const cancelButton = buttonContainer.createEl('button', {
      cls: 'chatsidian-modal-button chatsidian-modal-button-secondary',
      text: 'Cancel'
    });
    
    cancelButton.addEventListener('click', () => {
      this.close();
    });
    
    // Add save button
    const saveButton = buttonContainer.createEl('button', {
      cls: 'chatsidian-modal-button chatsidian-modal-button-primary',
      text: this.isNew ? 'Create' : 'Save'
    });
    
    saveButton.addEventListener('click', () => {
      this.save();
    });
  }
  
  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
  
  async save(): Promise<void> {
    // Validate inputs
    if (!this.model.name) {
      // Show error message for missing name
      this.showError('Model name is required.');
      return;
    }
    
    if (!this.model.modelId) {
      // Show error message for missing model ID
      this.showError('Model ID is required.');
      return;
    }
    
    try {
      if (this.isNew) {
        // Create new model
        await this.modelManager.createModel(this.model);
      } else {
        // Update existing model
        await this.modelManager.saveModel(this.model as Model);
      }
      
      // Call onSave callback
      this.onSave();
      
      // Close modal
      this.close();
    } catch (error) {
      console.error('Error saving model:', error);
      this.showError('Failed to save model.');
    }
  }
  
  private showError(message: string): void {
    const { contentEl } = this;
    const errorEl = contentEl.createDiv({
      cls: 'chatsidian-modal-error',
      text: message
    });
    
    // Remove error after 3 seconds
    setTimeout(() => {
      errorEl.remove();
    }, 3000);
  }
}
```

These modal dialogs provide interfaces for:
1. Creating and editing agents with name, description, emoji, and system prompt
2. Creating and editing models with provider, model ID, and generation parameters
3. Validation of required fields
4. Error handling and feedback

### Settings Registration in Main Plugin

Finally, we need to register the settings tab in the main plugin file:

```typescript
// src/main.ts (update for settings tab)
import { ChatsidianSettingsTab } from './settings/ChatsidianSettingsTab';

export default class ChatsidianPlugin extends Plugin {
  public settings: ChatsidianSettings;
  
  // ... existing code ...
  
  async onload() {
    // Load settings
    this.settings = await this.loadSettings();
    
    // Add settings tab
    this.addSettingTab(new ChatsidianSettingsTab(this.app, this));
    
    // ... rest of existing code ...
  }
  
  async loadSettings(): Promise<ChatsidianSettings> {
    const defaultSettings: ChatsidianSettings = {
      apiKeys: {
        anthropic: '',
        openai: ''
      },
      apiBaseUrls: {
        anthropic: '',
        openai: ''
      },
      defaultAgentId: null,
      defaultModelId: null,
      conversationStorage: {
        folder: 'conversations',
        historyLimit: 50,
        autoCleanup: true
      },
      conversations: {
        autoTitle: true,
        messageCharLimit: 32000
      },
      ui: {
        sidebarOpenByDefault: false,
        showTimestamps: true,
        showTypingIndicator: true,
        enableMessageStreaming: true,
        showToolCalls: true,
        expandToolCallsByDefault: false,
        enterToSend: true,
        autofocusInput: true,
        enableSpellcheck: true
      }
    };
    
    // Load saved settings
    const savedSettings = await this.loadData() as Partial<ChatsidianSettings>;
    
    // Merge saved settings with defaults
    return Object.assign({}, defaultSettings, savedSettings);
  }
  
  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
```

This adds the settings tab to the plugin and provides methods for loading and saving settings with default values.

### CSS Styling for Settings

Let's add CSS styling for the settings interface components:

```css
/* src/styles.css - Settings styling */

/* Settings tab */
.chatsidian-settings-footer {
  margin-top: 30px;
  padding-top: 10px;
  border-top: 1px solid var(--background-modifier-border);
  color: var(--text-muted);
  font-size: 0.8em;
  text-align: center;
}

/* Agent and model settings */
.chatsidian-settings-agents-container,
.chatsidian-settings-models-container {
  margin: 15px 0;
}

.chatsidian-settings-agent,
.chatsidian-settings-model {
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  padding: 15px;
  margin-bottom: 15px;
  background-color: var(--background-secondary);
}

.chatsidian-settings-agent-header,
.chatsidian-settings-model-header {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.chatsidian-settings-agent-name-container {
  display: flex;
  align-items: center;
  flex-grow: 1;
}

.chatsidian-settings-agent-emoji {
  font-size: 1.2em;
  margin-right: 8px;
}

.chatsidian-settings-agent-name,
.chatsidian-settings-model-name {
  margin: 0;
  font-size: 1.1em;
  font-weight: 600;
}

.chatsidian-settings-model-provider {
  background-color: var(--interactive-accent);
  color: var(--text-on-accent);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8em;
  margin-right: 10px;
}

.chatsidian-settings-agent-actions,
.chatsidian-settings-model-actions {
  display: flex;
  gap: 8px;
}

.chatsidian-settings-agent-action,
.chatsidian-settings-model-action {
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-muted);
}

.chatsidian-settings-agent-action:hover,
.chatsidian-settings-model-action:hover {
  background-color: var(--background-modifier-hover);
  color: var(--text-normal);
}

.chatsidian-settings-agent-description {
  margin: 0 0 10px 0;
  color: var(--text-muted);
  font-size: 0.9em;
}

.chatsidian-settings-model-details {
  margin-top: 10px;
  font-size: 0.9em;
  color: var(--text-muted);
}

.chatsidian-settings-model-detail {
  margin-bottom: 5px;
}

.chatsidian-settings-agent-tools h5 {
  margin: 0 0 10px 0;
  font-size: 0.9em;
  text-transform: uppercase;
  color: var(--text-muted);
}

/* Button containers */
.chatsidian-settings-button-container {
  display: flex;
  justify-content: center;
  margin: 10px 0 20px 0;
}

/* Modal styling */
.chatsidian-modal-buttons {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.chatsidian-modal-button {
  padding: 6px 12px;
  border-radius: 4px;
  margin-left: 8px;
  cursor: pointer;
  font-size: 0.9em;
  border: none;
}

.chatsidian-modal-button-primary {
  background-color: var(--interactive-accent);
  color: var(--text-on-accent);
}

.chatsidian-modal-button-secondary {
  background-color: var(--background-modifier-form-field);
  color: var(--text-normal);
}

.chatsidian-modal-button-danger {
  background-color: var(--text-error);
  color: white;
}

.chatsidian-modal-error {
  color: var(--text-error);
  margin-top: 10px;
  padding: 8px;
  border: 1px solid var(--text-error);
  border-radius: 4px;
  background-color: rgba(var(--text-error-rgb), 0.1);
}

/* System prompt textarea */
.chatsidian-system-prompt-container {
  margin-bottom: 20px;
}

.chatsidian-system-prompt-textarea {
  width: 100%;
  height: 200px;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid var(--background-modifier-border);
  background-color: var(--background-modifier-form-field);
  color: var(--text-normal);
  font-family: var(--font-monospace);
  resize: vertical;
}

.chatsidian-system-prompt-textarea:focus {
  outline: none;
  border-color: var(--interactive-accent);
}

/* Emoji hint */
.chatsidian-emoji-hint {
  font-size: 0.8em;
  color: var(--text-muted);
  margin-top: 4px;
  margin-bottom: 12px;
}
```

This CSS provides styling for:
1. Agent and model cards with headers and action buttons
2. Modal dialogs for editing agents and models
3. System prompt textarea with proper sizing
4. Button containers and action buttons
5. Error messages with visual feedback
6. Emoji selector UI elements

All styling uses Obsidian's CSS variables to ensure compatibility with different themes.

## Settings Data Model

The settings UI components interact with a comprehensive settings data model:

```typescript
// src/models/Settings.ts
export interface ChatsidianSettings {
  apiKeys: {
    anthropic: string;
    openai: string;
    [key: string]: string;
  };
  apiBaseUrls: {
    anthropic: string;
    openai: string;
    [key: string]: string;
  };
  defaultAgentId: string | null;
  defaultModelId: string | null;
  conversationStorage: {
    folder: string;
    historyLimit: number;
    autoCleanup: boolean;
  };
  conversations: {
    autoTitle: boolean;
    messageCharLimit: number;
  };
  ui: {
    sidebarOpenByDefault: boolean;
    showTimestamps: boolean;
    showTypingIndicator: boolean;
    enableMessageStreaming: boolean;
    showToolCalls: boolean;
    expandToolCallsByDefault: boolean;
    enterToSend: boolean;
    autofocusInput: boolean;
    enableSpellcheck: boolean;
  };
}
```

This model defines the structure for all plugin settings, including:
1. API keys and base URLs for different providers
2. Default agent and model selections
3. Conversation storage options
4. UI preferences

## Integration with Obsidian APIs

Throughout this implementation, we've leveraged several Obsidian API components:

1. **PluginSettingTab**: The base class for creating settings tabs in Obsidian plugins, providing the necessary lifecycle methods for displaying and saving settings.

2. **Setting**: A utility class for creating standardized setting items with labels, descriptions, and various controls (text inputs, toggles, dropdowns, etc.).

3. **Modal**: Used for creating dialog windows for editing agents and models, with methods for managing the dialog lifecycle.

4. **ButtonComponent**: A utility class for creating styled buttons with icons and click handlers.

5. **Notice**: Used for displaying temporary notifications to provide feedback to the user.

By using these native Obsidian components, we ensure that our settings interface integrates seamlessly with the Obsidian experience and maintains consistency with other plugins.

## Testing Strategy

Testing for this microphase will involve:

1. **Unit Testing**:
   - Test the settings loading and saving logic
   - Verify merging of default settings with saved settings
   - Test validation of settings values

2. **Integration Testing**:
   - Test that settings are correctly applied to UI components
   - Verify that agent and model changes are reflected in the selectors
   - Test that API keys are properly stored and retrieved

3. **Manual UI Testing**:
   - Test the settings UI with different Obsidian themes
   - Verify all inputs work as expected
   - Test agent and model creation, editing, and deletion
   - Test tool permission toggles
   - Check for any visual inconsistencies

4. **Settings Persistence Testing**:
   - Verify settings are saved and loaded correctly
   - Test that settings persist across Obsidian restarts
   - Check that API keys are securely stored

## Security Considerations

Special attention has been paid to the security of sensitive information, particularly API keys:

1. API keys are stored using Obsidian's data API, which provides secure storage for plugin data.
2. The settings UI does not display API keys in plain text when the settings tab is open, reducing the risk of accidental exposure.
3. API keys are only used when needed for making API requests and are not stored in memory longer than necessary.

## Dependencies

This microphase depends on:
- Phase 1 components (Storage, Settings infrastructure)
- Phase 2 components (AgentManager, ModelManager)
- Obsidian's Settings API

## Next Steps

After completing this microphase, we'll have a comprehensive settings interface for configuring all aspects of the plugin. The next microphase will focus on responsive design and accessibility enhancements to ensure the plugin works well across different device sizes and is accessible to all users.

## Additional Resources

- [[💻 Coding/Documentation/Obsidian/Plugin - Documentation]]
- [[💻 Coding/Documentation/Obsidian/Modal - Documentation]]
- [Obsidian API Documentation](https://github.com/obsidianmd/obsidian-api)
