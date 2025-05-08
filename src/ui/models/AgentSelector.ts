/**
 * AgentSelector Component
 * 
 * This component provides a dropdown for selecting AI agents.
 * It integrates with the AgentSystem to get available agents
 * and allows filtering by role and capabilities.
 * 
 * @file This file defines the AgentSelector class for agent selection.
 */

import { Component, DropdownComponent, setIcon, ButtonComponent, Modal, TextComponent } from 'obsidian';
import { EventBus } from '../../core/EventBus';
import { AgentDefinition, AgentRole } from '../../agents/AgentTypes';
import { AgentSystem } from '../../agents/AgentSystem';
import { AgentSelectorOptions } from './types';

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
 * Default options for the agent selector
 */
const DEFAULT_OPTIONS: AgentSelectorOptions = {
  showBuiltInAgents: true,
  showCustomAgents: true,
  allowCreatingAgents: true,
  allowEditingAgents: true,
  allowDeletingAgents: true,
};

/**
 * AgentSelector component for selecting AI agents
 */
export class AgentSelector extends Component {
  /**
   * Obsidian app instance
   */
  private readonly app: any;
  /**
   * Container element for the agent selector
   */
  private containerEl: HTMLElement;
  
  /**
   * Event bus for component communication
   */
  private eventBus: EventBus;
  
  /**
   * Agent system for accessing agent information
   */
  private agentSystem: AgentSystem;
  
  /**
   * Options for the agent selector
   */
  private options: AgentSelectorOptions;
  
  /**
   * Currently selected agent
   */
  private selectedAgent: AgentDefinition | null = null;
  
  /**
   * Agent dropdown component
   */
  private agentDropdown: DropdownComponent | null = null;
  
  /**
   * Agent capabilities element
   */
  private agentCapabilitiesEl: HTMLElement | null = null;
  
  /**
   * Constructor for the AgentSelector
   * 
   * @param containerEl - The container element to render the agent selector in
   * @param eventBus - The event bus for component communication
   * @param agentSystem - The agent system for accessing agent information
   * @param options - Options for the agent selector
   * @param initialAgentId - Initial agent ID to select
   */
  constructor(
    containerEl: HTMLElement,
    eventBus: EventBus,
    agentSystem: AgentSystem,
    options: Partial<AgentSelectorOptions> = {},
    initialAgentId?: string
  ) {
    super();
    
    this.containerEl = containerEl;
    this.eventBus = eventBus;
    this.agentSystem = agentSystem;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.app = (window as any).app;
    
    this.render();
    
    // Initialize with the selected agent if provided
    if (initialAgentId) {
      const agent = this.agentSystem.getAgentDefinition(initialAgentId);
      if (agent) {
        this.selectedAgent = agent;
        this.updateAgentCapabilities();
      }
    }
  }
  
  /**
   * Render the agent selector
   */
  private render(): void {
    this.containerEl.empty();
    this.containerEl.addClass('chatsidian-agent-selector');
    
    // Create header with title and create button
    const headerEl = this.containerEl.createDiv({
      cls: 'chatsidian-agent-selector-header'
    });
    
    // Create title
    headerEl.createDiv({
      cls: 'chatsidian-selector-label',
      text: 'Agent'
    });
    
    // Create create button if enabled
    if (this.options.allowCreatingAgents) {
      const createButtonEl = headerEl.createDiv({
        cls: 'chatsidian-agent-create-button'
      });
      
      const createButton = new ButtonComponent(createButtonEl)
        .setIcon('plus')
        .setTooltip('Create new agent')
        .onClick(() => {
          this.openAgentCreationModal();
        });
    }
    
    // Create dropdown container
    const dropdownContainerEl = this.containerEl.createDiv({
      cls: 'chatsidian-dropdown-container'
    });
    
    // Create agent icon
    const agentIconEl = dropdownContainerEl.createDiv({
      cls: 'chatsidian-agent-icon'
    });
    setIcon(agentIconEl, 'bot');
    
    // Create agent dropdown
    this.agentDropdown = new DropdownComponent(dropdownContainerEl);
    
    // Initialize agent dropdown
    this.updateAgentDropdown();
    
    // Add change handler
    this.agentDropdown.onChange(value => {
      const agent = this.agentSystem.getAgentDefinition(value);
      if (agent) {
        this.selectedAgent = agent;
        this.updateAgentCapabilities();
        
        // Emit agent selected event
        this.eventBus.emit(AgentSelectorEventType.AGENT_SELECTED, {
          agent
        });
      }
    });
    
    // Create agent capabilities
    this.agentCapabilitiesEl = this.containerEl.createDiv({
      cls: 'chatsidian-agent-capabilities'
    });
    
    // Initialize agent capabilities
    this.updateAgentCapabilities();
  }
  
  /**
   * Update the agent dropdown
   */
  private updateAgentDropdown(): void {
    if (!this.agentDropdown) {
      return;
    }
    
    // Clear existing options
    this.agentDropdown.selectEl.empty();
    
    // Get all agent definitions
    const agents = this.agentSystem.getAllAgentDefinitions();
    
    // Filter agents based on options
    const filteredAgents = agents.filter(agent => {
      if (agent.builtIn && !this.options.showBuiltInAgents) {
        return false;
      }
      
      if (!agent.builtIn && !this.options.showCustomAgents) {
        return false;
      }
      
      return true;
    });
    
    // Sort agents by name
    filteredAgents.sort((a, b) => a.name.localeCompare(b.name));
    
    // Add options to dropdown
    for (const agent of filteredAgents) {
      this.agentDropdown.addOption(agent.id, agent.name);
    }
    
    // Set initial value if available
    if (filteredAgents.length > 0) {
      const initialAgent = this.selectedAgent && filteredAgents.find(a => a.id === this.selectedAgent?.id)
        ? this.selectedAgent.id
        : filteredAgents[0].id;
        
      this.agentDropdown.setValue(initialAgent);
      
      // Update selected agent
      this.selectedAgent = this.agentSystem.getAgentDefinition(initialAgent) || null;
      this.updateAgentCapabilities();
    } else {
      this.selectedAgent = null;
      this.updateAgentCapabilities();
    }
  }
  
  /**
   * Update the agent capabilities display
   */
  private updateAgentCapabilities(): void {
    if (!this.agentCapabilitiesEl) {
      return;
    }
    
    this.agentCapabilitiesEl.empty();
    
    if (!this.selectedAgent) {
      this.agentCapabilitiesEl.createDiv({
        cls: 'chatsidian-agent-capabilities-empty',
        text: 'No agent selected'
      });
      return;
    }
    
    // Create capabilities container
    const capabilitiesContainerEl = this.agentCapabilitiesEl.createDiv({
      cls: 'chatsidian-agent-capabilities-container'
    });
    
    // Create header with agent info and actions
    const headerEl = capabilitiesContainerEl.createDiv({
      cls: 'chatsidian-agent-header'
    });
    
    // Create agent emoji if available
    if (this.selectedAgent.emoji) {
      headerEl.createDiv({
        cls: 'chatsidian-agent-emoji',
        text: this.selectedAgent.emoji
      });
    }
    
    // Create agent info
    const agentInfoEl = headerEl.createDiv({
      cls: 'chatsidian-agent-info'
    });
    
    // Create agent name
    agentInfoEl.createDiv({
      cls: 'chatsidian-agent-name',
      text: this.selectedAgent.name
    });
    
    // Create agent role
    agentInfoEl.createDiv({
      cls: 'chatsidian-agent-role',
      text: this.formatAgentRole(this.selectedAgent.role)
    });
    
    // Create agent actions if not built-in
    if (!this.selectedAgent.builtIn) {
      const actionsEl = headerEl.createDiv({
        cls: 'chatsidian-agent-actions'
      });
      
      // Create edit button if enabled
      if (this.options.allowEditingAgents) {
        const editButtonEl = actionsEl.createDiv({
          cls: 'chatsidian-agent-edit-button'
        });
        
        const editButton = new ButtonComponent(editButtonEl)
          .setIcon('pencil')
          .setTooltip('Edit agent')
          .onClick(() => {
            this.openAgentEditModal(this.selectedAgent!);
          });
      }
      
      // Create delete button if enabled
      if (this.options.allowDeletingAgents) {
        const deleteButtonEl = actionsEl.createDiv({
          cls: 'chatsidian-agent-delete-button'
        });
        
        const deleteButton = new ButtonComponent(deleteButtonEl)
          .setIcon('trash')
          .setTooltip('Delete agent')
          .onClick(() => {
            this.deleteAgent(this.selectedAgent!.id);
          });
      }
    }
    
    // Create agent description
    capabilitiesContainerEl.createDiv({
      cls: 'chatsidian-agent-description',
      text: this.selectedAgent.description
    });
    
    // Create agent capabilities if available
    if (this.selectedAgent.capabilities && this.selectedAgent.capabilities.length > 0) {
      const capabilitiesEl = capabilitiesContainerEl.createDiv({
        cls: 'chatsidian-agent-capabilities-list'
      });
      
      // Create capabilities header
      capabilitiesEl.createDiv({
        cls: 'chatsidian-agent-capabilities-header',
        text: 'Capabilities'
      });
      
      // Create capabilities list
      const capabilitiesListEl = capabilitiesEl.createDiv({
        cls: 'chatsidian-agent-capabilities-items'
      });
      
      // Add each capability
      for (const capability of this.selectedAgent.capabilities) {
        const capabilityEl = capabilitiesListEl.createDiv({
          cls: 'chatsidian-agent-capability-item'
        });
        
        // Create capability icon
        const capabilityIconEl = capabilityEl.createDiv({
          cls: 'chatsidian-agent-capability-icon'
        });
        setIcon(capabilityIconEl, 'check');
        
        // Create capability text
        capabilityEl.createDiv({
          cls: 'chatsidian-agent-capability-text',
          text: capability
        });
      }
    }
    
    // Create agent limitations if available
    if (this.selectedAgent.limitations && this.selectedAgent.limitations.length > 0) {
      const limitationsEl = capabilitiesContainerEl.createDiv({
        cls: 'chatsidian-agent-limitations-list'
      });
      
      // Create limitations header
      limitationsEl.createDiv({
        cls: 'chatsidian-agent-limitations-header',
        text: 'Limitations'
      });
      
      // Create limitations list
      const limitationsListEl = limitationsEl.createDiv({
        cls: 'chatsidian-agent-limitations-items'
      });
      
      // Add each limitation
      for (const limitation of this.selectedAgent.limitations) {
        const limitationEl = limitationsListEl.createDiv({
          cls: 'chatsidian-agent-limitation-item'
        });
        
        // Create limitation icon
        const limitationIconEl = limitationEl.createDiv({
          cls: 'chatsidian-agent-limitation-icon'
        });
        setIcon(limitationIconEl, 'x');
        
        // Create limitation text
        limitationEl.createDiv({
          cls: 'chatsidian-agent-limitation-text',
          text: limitation
        });
      }
    }
    
    // Create agent model settings
    const settingsEl = capabilitiesContainerEl.createDiv({
      cls: 'chatsidian-agent-settings'
    });
    
    // Create settings header
    settingsEl.createDiv({
      cls: 'chatsidian-agent-settings-header',
      text: 'Model Settings'
    });
    
    // Create settings list
    const settingsListEl = settingsEl.createDiv({
      cls: 'chatsidian-agent-settings-items'
    });
    
    // Add model setting
    const modelSettingEl = settingsListEl.createDiv({
      cls: 'chatsidian-agent-setting-item'
    });
    modelSettingEl.createDiv({
      cls: 'chatsidian-agent-setting-label',
      text: 'Model:'
    });
    modelSettingEl.createDiv({
      cls: 'chatsidian-agent-setting-value',
      text: this.selectedAgent.defaultSettings.model
    });
    
    // Add temperature setting
    const temperatureSettingEl = settingsListEl.createDiv({
      cls: 'chatsidian-agent-setting-item'
    });
    temperatureSettingEl.createDiv({
      cls: 'chatsidian-agent-setting-label',
      text: 'Temperature:'
    });
    temperatureSettingEl.createDiv({
      cls: 'chatsidian-agent-setting-value',
      text: this.selectedAgent.defaultSettings.temperature.toString()
    });
    
    // Add max tokens setting
    const maxTokensSettingEl = settingsListEl.createDiv({
      cls: 'chatsidian-agent-setting-item'
    });
    maxTokensSettingEl.createDiv({
      cls: 'chatsidian-agent-setting-label',
      text: 'Max Tokens:'
    });
    maxTokensSettingEl.createDiv({
      cls: 'chatsidian-agent-setting-value',
      text: this.selectedAgent.defaultSettings.maxTokens.toString()
    });
  }
  
  /**
   * Format an agent role for display
   * 
   * @param role - The agent role to format
   * @returns The formatted agent role
   */
  private formatAgentRole(role: AgentRole): string {
    // Format the role for display
    switch (role) {
      case AgentRole.GeneralAssistant:
        return 'General Assistant';
      case AgentRole.VaultManager:
        return 'Vault Manager';
      case AgentRole.KnowledgeBase:
        return 'Knowledge Base';
      case AgentRole.ProjectPlanner:
        return 'Project Planner';
      case AgentRole.ContentWriter:
        return 'Content Writer';
      case AgentRole.ResearchAssistant:
        return 'Research Assistant';
      case AgentRole.CodeAssistant:
        return 'Code Assistant';
      case AgentRole.Custom:
        return 'Custom';
      default:
        return role;
    }
  }
  
  /**
   * Open the agent creation modal
   */
  private openAgentCreationModal(): void {
    // Create a new modal for agent creation
    const modal = new AgentCreationModal(this.app, this.agentSystem, (agent) => {
      // Handle agent creation
      this.agentSystem.saveCustomAgentDefinition(agent).then(() => {
        // Update the dropdown
        this.updateAgentDropdown();
        
        // Select the new agent
        if (this.agentDropdown) {
          this.agentDropdown.setValue(agent.id);
          this.selectedAgent = agent;
          this.updateAgentCapabilities();
        }
        
        // Emit agent created event
        this.eventBus.emit(AgentSelectorEventType.AGENT_CREATED, {
          agent
        });
      }).catch(error => {
        console.error('Failed to save agent:', error);
      });
    });
    
    modal.open();
  }
  
  /**
   * Open the agent edit modal
   * 
   * @param agent - The agent to edit
   */
  private openAgentEditModal(agent: AgentDefinition): void {
    // Create a new modal for agent editing
    const modal = new AgentCreationModal(this.app, this.agentSystem, (updatedAgent) => {
      // Handle agent update
      this.agentSystem.saveCustomAgentDefinition(updatedAgent).then(() => {
        // Update the dropdown
        this.updateAgentDropdown();
        
        // Select the updated agent
        if (this.agentDropdown) {
          this.agentDropdown.setValue(updatedAgent.id);
          this.selectedAgent = updatedAgent;
          this.updateAgentCapabilities();
        }
        
        // Emit agent updated event
        this.eventBus.emit(AgentSelectorEventType.AGENT_UPDATED, {
          agent: updatedAgent
        });
      }).catch(error => {
        console.error('Failed to update agent:', error);
      });
    }, agent);
    
    modal.open();
  }
  
  /**
   * Delete an agent
   * 
   * @param agentId - The ID of the agent to delete
   */
  private deleteAgent(agentId: string): void {
    // Confirm deletion
    if (!confirm(`Are you sure you want to delete this agent?`)) {
      return;
    }
    
    // Delete the agent
    this.agentSystem.deleteCustomAgentDefinition(agentId).then(() => {
      // Update the dropdown
      this.updateAgentDropdown();
      
      // Emit agent deleted event
      this.eventBus.emit(AgentSelectorEventType.AGENT_DELETED, {
        agentId
      });
    }).catch(error => {
      console.error('Failed to delete agent:', error);
    });
  }
  
  /**
   * Get the currently selected agent
   * 
   * @returns The currently selected agent or null if none selected
   */
  getSelectedAgent(): AgentDefinition | null {
    return this.selectedAgent;
  }
  
  /**
   * Set the selected agent by ID
   * 
   * @param agentId - The agent ID to select
   * @returns Whether the agent was found and selected
   */
  setSelectedAgent(agentId: string): boolean {
    const agent = this.agentSystem.getAgentDefinition(agentId);
    if (agent && this.agentDropdown) {
      this.selectedAgent = agent;
      this.agentDropdown.setValue(agentId);
      this.updateAgentCapabilities();
      return true;
    }
    
    return false;
  }
}

/**
 * Modal for creating or editing an agent
 */
class AgentCreationModal extends Modal {
  /**
   * Agent system for accessing agent information
   */
  private agentSystem: AgentSystem;
  
  /**
   * Callback for when an agent is created or updated
   */
  private onSubmit: (agent: AgentDefinition) => void;
  
  /**
   * Agent to edit, if editing an existing agent
   */
  private editingAgent: AgentDefinition | null = null;
  
  /**
   * Constructor for the AgentCreationModal
   * 
   * @param app - The Obsidian app
   * @param agentSystem - The agent system for accessing agent information
   * @param onSubmit - Callback for when an agent is created or updated
   * @param editingAgent - Agent to edit, if editing an existing agent
   */
  constructor(
    app: any,
    agentSystem: AgentSystem,
    onSubmit: (agent: AgentDefinition) => void,
    editingAgent?: AgentDefinition
  ) {
    super(app);
    this.agentSystem = agentSystem;
    this.onSubmit = onSubmit;
    this.editingAgent = editingAgent || null;
  }
  
  /**
   * Called when the modal is opened
   */
  onOpen(): void {
    const { contentEl } = this;
    
    // Set title
    contentEl.createEl('h2', {
      text: this.editingAgent ? 'Edit Agent' : 'Create Agent'
    });
    
    // Create form
    const formEl = contentEl.createEl('form');
    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
    
    // Create name field
    const nameContainerEl = formEl.createDiv({
      cls: 'chatsidian-form-group'
    });
    nameContainerEl.createDiv({
      cls: 'chatsidian-form-label',
      text: 'Name'
    });
    const nameInputEl = nameContainerEl.createDiv({
      cls: 'chatsidian-form-input'
    });
    const nameInput = new TextComponent(nameInputEl);
    if (this.editingAgent) {
      nameInput.setValue(this.editingAgent.name);
    }
    
    // Create role field
    const roleContainerEl = formEl.createDiv({
      cls: 'chatsidian-form-group'
    });
    roleContainerEl.createDiv({
      cls: 'chatsidian-form-label',
      text: 'Role'
    });
    const roleInputEl = roleContainerEl.createDiv({
      cls: 'chatsidian-form-input'
    });
    const roleDropdown = new DropdownComponent(roleInputEl);
    
    // Add role options
    for (const role in AgentRole) {
      if (isNaN(Number(role))) {
        roleDropdown.addOption(AgentRole[role as keyof typeof AgentRole], role);
      }
    }
    
    if (this.editingAgent) {
      roleDropdown.setValue(this.editingAgent.role);
    } else {
      roleDropdown.setValue(AgentRole.Custom);
    }
    
    // Create description field
    const descContainerEl = formEl.createDiv({
      cls: 'chatsidian-form-group'
    });
    descContainerEl.createDiv({
      cls: 'chatsidian-form-label',
      text: 'Description'
    });
    const descInputEl = descContainerEl.createDiv({
      cls: 'chatsidian-form-input'
    });
    const descInput = new TextComponent(descInputEl);
    if (this.editingAgent) {
      descInput.setValue(this.editingAgent.description);
    }
    
    // Create emoji field
    const emojiContainerEl = formEl.createDiv({
      cls: 'chatsidian-form-group'
    });
    emojiContainerEl.createDiv({
      cls: 'chatsidian-form-label',
      text: 'Emoji (optional)'
    });
    const emojiInputEl = emojiContainerEl.createDiv({
      cls: 'chatsidian-form-input'
    });
    const emojiInput = new TextComponent(emojiInputEl);
    if (this.editingAgent && this.editingAgent.emoji) {
      emojiInput.setValue(this.editingAgent.emoji);
    }
    
    // Create system prompt field
    const promptContainerEl = formEl.createDiv({
      cls: 'chatsidian-form-group'
    });
    promptContainerEl.createDiv({
      cls: 'chatsidian-form-label',
      text: 'System Prompt'
    });
    const promptInputEl = promptContainerEl.createDiv({
      cls: 'chatsidian-form-input'
    });
    const promptInput = document.createElement('textarea');
    promptInput.className = 'chatsidian-textarea';
    promptInput.rows = 5;
    if (this.editingAgent) {
      promptInput.value = this.editingAgent.systemPrompt;
    }
    promptInputEl.appendChild(promptInput);
    
    // Create model field
    const modelContainerEl = formEl.createDiv({
      cls: 'chatsidian-form-group'
    });
    modelContainerEl.createDiv({
      cls: 'chatsidian-form-label',
      text: 'Default Model'
    });
    const modelInputEl = modelContainerEl.createDiv({
      cls: 'chatsidian-form-input'
    });
    const modelInput = new TextComponent(modelInputEl);
    if (this.editingAgent) {
      modelInput.setValue(this.editingAgent.defaultSettings.model);
    } else {
      modelInput.setValue('claude-3-opus-20240229');
    }
    
    // Create temperature field
    const tempContainerEl = formEl.createDiv({
      cls: 'chatsidian-form-group'
    });
    tempContainerEl.createDiv({
      cls: 'chatsidian-form-label',
      text: 'Temperature (0-1)'
    });
    const tempInputEl = tempContainerEl.createDiv({
      cls: 'chatsidian-form-input'
    });
    const tempInput = new TextComponent(tempInputEl);
    if (this.editingAgent) {
      tempInput.setValue(this.editingAgent.defaultSettings.temperature.toString());
    } else {
      tempInput.setValue('0.7');
    }
    
    // Create max tokens field
    const tokensContainerEl = formEl.createDiv({
      cls: 'chatsidian-form-group'
    });
    tokensContainerEl.createDiv({
      cls: 'chatsidian-form-label',
      text: 'Max Tokens'
    });
    const tokensInputEl = tokensContainerEl.createDiv({
      cls: 'chatsidian-form-input'
    });
    const tokensInput = new TextComponent(tokensInputEl);
    if (this.editingAgent) {
      tokensInput.setValue(this.editingAgent.defaultSettings.maxTokens.toString());
    } else {
      tokensInput.setValue('4000');
    }
    
    // Create buttons
    const buttonsEl = formEl.createDiv({
      cls: 'chatsidian-form-buttons'
    });
    
    // Create cancel button
    const cancelButtonEl = buttonsEl.createDiv({
      cls: 'chatsidian-form-button'
    });
    const cancelButton = new ButtonComponent(cancelButtonEl)
      .setButtonText('Cancel')
      .onClick(() => {
        this.close();
      });
    
    // Create submit button
    const submitButtonEl = buttonsEl.createDiv({
      cls: 'chatsidian-form-button'
    });
    const submitButton = new ButtonComponent(submitButtonEl)
      .setButtonText(this.editingAgent ? 'Update' : 'Create')
      .setCta()
      .onClick(() => {
        this.handleSubmit();
      });
    
    // Store input references for submission
    this.nameInput = nameInput;
    this.roleDropdown = roleDropdown;
    this.descInput = descInput;
    this.emojiInput = emojiInput;
    this.promptInput = promptInput;
    this.modelInput = modelInput;
    this.tempInput = tempInput;
    this.tokensInput = tokensInput;
  }
  
  /**
   * Handle form submission
   */
  private handleSubmit(): void {
    // Validate inputs
    const name = this.nameInput.getValue().trim();
    if (!name) {
      alert('Name is required');
      return;
    }
    
    const role = this.roleDropdown.getValue() as AgentRole;
    const description = this.descInput.getValue().trim();
    if (!description) {
      alert('Description is required');
      return;
    }
    
    const emoji = this.emojiInput.getValue().trim();
    const systemPrompt = this.promptInput.value.trim();
    if (!systemPrompt) {
      alert('System prompt is required');
      return;
    }
    
    const model = this.modelInput.getValue().trim();
    if (!model) {
      alert('Model is required');
      return;
    }
    
    const temperatureStr = this.tempInput.getValue().trim();
    const temperature = parseFloat(temperatureStr);
    if (isNaN(temperature) || temperature < 0 || temperature > 1) {
      alert('Temperature must be a number between 0 and 1');
      return;
    }
    
    const maxTokensStr = this.tokensInput.getValue().trim();
    const maxTokens = parseInt(maxTokensStr);
    if (isNaN(maxTokens) || maxTokens <= 0) {
      alert('Max tokens must be a positive number');
      return;
    }
    
    // Create agent definition
    const agent: AgentDefinition = {
      id: this.editingAgent ? this.editingAgent.id : `custom_${Date.now()}`,
      name,
      role,
      description,
      systemPrompt,
      tools: this.editingAgent ? this.editingAgent.tools : [],
      defaultSettings: {
        model,
        temperature,
        maxTokens,
        stream: true
      },
      builtIn: false,
      emoji: emoji || undefined,
      capabilities: this.editingAgent ? this.editingAgent.capabilities : [],
      limitations: this.editingAgent ? this.editingAgent.limitations : [],
      created: this.editingAgent ? this.editingAgent.created : Date.now(),
      modified: Date.now()
    };
    
    // Call onSubmit callback
    this.onSubmit(agent);
    
    // Close modal
    this.close();
  }
  
  /**
   * Called when the modal is closed
   */
  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
  
  // Input references for submission
  private nameInput!: TextComponent;
  private roleDropdown!: DropdownComponent;
  private descInput!: TextComponent;
  private emojiInput!: TextComponent;
  private promptInput!: HTMLTextAreaElement;
  private modelInput!: TextComponent;
  private tempInput!: TextComponent;
  private tokensInput!: TextComponent;
}
