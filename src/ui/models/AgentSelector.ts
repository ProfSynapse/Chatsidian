/**
 * AgentSelector Component
 * 
 * This component provides a grid of agent cards for selecting AI agents.
 * It integrates with the AgentSystem to get available agents
 * and allows searching, creating, editing, and deleting agents.
 * 
 * @file This file defines the AgentSelector class for agent selection.
 */

import { Component, ButtonComponent, setIcon, Modal, TextComponent, SearchComponent, ToggleComponent } from 'obsidian';
import { EventBus } from '../../core/EventBus';
import { AgentDefinition, AgentRole } from '../../agents/AgentTypes';
import { AgentSystem } from '../../agents/AgentSystem';
import { AgentSelectorOptions } from './types';
import { AgentCardComponent, AgentCardEventType } from './AgentCardComponent';

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
   * Search query for filtering agents
   */
  private searchQuery: string = '';
  
  /**
   * Agent card components
   */
  private agentCards: Map<string, AgentCardComponent> = new Map();
  
  /**
   * Agent grid element
   */
  private agentGridEl: HTMLElement | null = null;

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
        this.updateAgentSelection();
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
    
    // Create header left section with title and count
    const headerLeftEl = headerEl.createDiv({
      cls: 'chatsidian-agent-selector-header-left'
    });
    
    // Create title
    headerLeftEl.createDiv({
      cls: 'chatsidian-selector-label',
      text: 'Agents'
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
    
    // Create search container
    const searchContainerEl = this.containerEl.createDiv({
      cls: 'chatsidian-agent-search-container'
    });
    
    // Create search component
    const searchComponent = new SearchComponent(searchContainerEl);
    searchComponent.setPlaceholder('Search agents...');
    searchComponent.onChange(query => {
      this.searchQuery = query;
      this.updateAgentGrid();
    });
    
    // Create agent grid
    this.agentGridEl = this.containerEl.createDiv({
      cls: 'chatsidian-agent-grid'
    });
    
    // Initialize agent grid
    this.updateAgentGrid();
  }
  
  /**
   * Update the agent grid
   */
  private updateAgentGrid(): void {
    if (!this.agentGridEl) {
      return;
    }
    
    // Clear existing grid
    this.agentGridEl.empty();
    this.agentCards.clear();
    
    // Get all agent definitions
    const agents = this.agentSystem.getAllAgentDefinitions();
    
    // Filter agents based on options and search query
    const filteredAgents = agents.filter(agent => {
      // Filter by built-in flag
      if (agent.builtIn && !this.options.showBuiltInAgents) {
        return false;
      }
      
      if (!agent.builtIn && !this.options.showCustomAgents) {
        return false;
      }
      
      // Filter by search query
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        const nameMatch = agent.name.toLowerCase().includes(query);
        const descriptionMatch = agent.description.toLowerCase().includes(query);
        const roleMatch = agent.role.toLowerCase().includes(query);
        
        return nameMatch || descriptionMatch || roleMatch;
      }
      
      return true;
    });
    
    // Sort agents by name
    filteredAgents.sort((a, b) => a.name.localeCompare(b.name));
    
    // Add agent cards to grid
    for (const agent of filteredAgents) {
      const cardEl = this.agentGridEl.createDiv({
        cls: 'chatsidian-agent-card-container'
      });
      
      const card = new AgentCardComponent(
        cardEl,
        agent,
        (type, agent) => {
          console.log(`Card event from ${agent.name}: ${type}`);
          this.handleAgentCardEvent(type, agent);
        },
        {
          selected: this.selectedAgent?.id === agent.id,
          allowEditing: agent.builtIn ? true : this.options.allowEditingAgents,
          allowDeleting: agent.builtIn ? false : this.options.allowDeletingAgents
        }
      );
      
      this.agentCards.set(agent.id, card);
      this.addChild(card);
    }
    
    // Add empty state if no agents
    if (filteredAgents.length === 0) {
      const emptyStateEl = this.agentGridEl.createDiv({
        cls: 'chatsidian-agent-grid-empty'
      });
      
      if (this.searchQuery) {
        emptyStateEl.createDiv({
          cls: 'chatsidian-agent-grid-empty-text',
          text: `No agents found matching "${this.searchQuery}"`
        });
      } else {
        emptyStateEl.createDiv({
          cls: 'chatsidian-agent-grid-empty-text',
          text: 'No agents available'
        });
      }
    }
  }
  
  /**
   * Handle agent card events
   * 
   * @param type - The event type
   * @param agent - The agent affected by the event
   */
  private handleAgentCardEvent(type: AgentCardEventType, agent: AgentDefinition): void {
    switch (type) {
      case AgentCardEventType.SELECTED:
        // Update the selected agent
        this.selectedAgent = agent;
        this.updateAgentSelection();
        
        // Emit agent selected event
        this.eventBus.emit(AgentSelectorEventType.AGENT_SELECTED, {
          agent
        });
        break;
        
      case AgentCardEventType.EDIT:
        // First select the agent
        this.selectedAgent = agent;
        this.updateAgentSelection();
        
        // Then open the edit modal
        this.openAgentEditModal(agent);
        break;
        
      case AgentCardEventType.DELETE:
        this.deleteAgent(agent.id);
        break;
    }
  }
  
  /**
   * Update the agent selection UI
   */
  private updateAgentSelection(): void {
    // Update card selection state
    for (const [id, card] of this.agentCards.entries()) {
      card.setSelected(this.selectedAgent?.id === id);
    }
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
        // Update the agent grid
        this.updateAgentGrid();
        
        // Select the new agent
        this.selectedAgent = agent;
        this.updateAgentSelection();
        
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
    // If agent is built-in, create a duplicate to edit
    const isBuiltIn = agent.builtIn;
    let editingAgent = agent;
    
    // For built-in agents, create a copy to edit
    if (isBuiltIn) {
      editingAgent = {
        ...agent,
        id: `custom_${Date.now()}`,
        name: `${agent.name} (Custom)`,
        builtIn: false,
        created: Date.now(),
        modified: Date.now()
      };
    }
    
    // Create a new modal for agent editing
    const modal = new AgentCreationModal(this.app, this.agentSystem, (updatedAgent) => {
      // Handle agent update
      this.agentSystem.saveCustomAgentDefinition(updatedAgent).then(() => {
        // Update the agent grid
        this.updateAgentGrid();
        
        // Select the updated agent
        this.selectedAgent = updatedAgent;
        this.updateAgentSelection();
        
        // Emit agent updated event
        this.eventBus.emit(AgentSelectorEventType.AGENT_UPDATED, {
          agent: updatedAgent
        });
      }).catch(error => {
        console.error('Failed to update agent:', error);
      });
    }, editingAgent);
    
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
      // Update the agent grid
      this.updateAgentGrid();
      
      // Clear selection if the deleted agent was selected
      if (this.selectedAgent?.id === agentId) {
        this.selectedAgent = null;
      }
      
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
    if (agent) {
      this.selectedAgent = agent;
      this.updateAgentSelection();
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
    contentEl.empty();
    contentEl.addClass('chatsidian-agent-modal');
    
    // Set title using Obsidian's standard title styling
    const titleEl = contentEl.createEl('h2', {
      text: this.editingAgent ? 'Edit Agent' : 'Create Agent',
      cls: 'modal-title' // Use Obsidian's modal-title class
    });
    
    // Create form container
    const formEl = contentEl.createEl('form', {
      cls: 'chatsidian-agent-form'
    });
    
    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
    
    // Create tab container using Obsidian's tab styling
    const tabContainerEl = formEl.createDiv({
      cls: 'chatsidian-modal-tabs'
    });
    
    // Create tabs with consistent styling
    const basicTabEl = tabContainerEl.createDiv({
      cls: 'chatsidian-modal-tab chatsidian-modal-tab-active',
      text: 'Basic Settings'
    });
    
    const advancedTabEl = tabContainerEl.createDiv({
      cls: 'chatsidian-modal-tab',
      text: 'Advanced Settings'
    });
    
    const toolsTabEl = tabContainerEl.createDiv({
      cls: 'chatsidian-modal-tab',
      text: 'Tools'
    });
    
    // Create tab content containers
    const tabContentEl = formEl.createDiv({
      cls: 'chatsidian-modal-tab-content'
    });
    
    // Basic settings tab content
    const basicTabContentEl = tabContentEl.createDiv({
      cls: 'chatsidian-modal-tab-pane chatsidian-modal-tab-pane-active'
    });
    
    // Advanced settings tab content
    const advancedTabContentEl = tabContentEl.createDiv({
      cls: 'chatsidian-modal-tab-pane'
    });
    
    // Tools tab content
    const toolsTabContentEl = tabContentEl.createDiv({
      cls: 'chatsidian-modal-tab-pane'
    });
    
    // Set up tab click handlers
    basicTabEl.addEventListener('click', () => {
      this.activateTab(tabContainerEl, tabContentEl, 0);
    });
    
    advancedTabEl.addEventListener('click', () => {
      this.activateTab(tabContainerEl, tabContentEl, 1);
    });
    
    toolsTabEl.addEventListener('click', () => {
      this.activateTab(tabContainerEl, tabContentEl, 2);
    });
    
    // BASIC SETTINGS TAB - Using Obsidian's Setting API
    
    // Create agent info section
    const agentInfoSectionEl = basicTabContentEl.createDiv({
      cls: 'chatsidian-form-section'
    });
    
    // Create agent info section header
    agentInfoSectionEl.createEl('h3', {
      text: 'Agent Information',
      cls: 'setting-item-heading'
    });
    
    // Create name field using TextComponent
    const nameContainerEl = agentInfoSectionEl.createDiv({
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
    
    // Create emoji field
    const emojiContainerEl = agentInfoSectionEl.createDiv({
      cls: 'chatsidian-form-group'
    });
    emojiContainerEl.createDiv({
      cls: 'chatsidian-form-label',
      text: 'Emoji Avatar'
    });
    
    const emojiSelectorEl = emojiContainerEl.createDiv({
      cls: 'chatsidian-emoji-selector'
    });
    
    // Create emoji grid with common options
    const commonEmojis = ['🤖', '🧠', '🔍', '📝', '💻', '📊', '🗂️', '📚', '🧩', '🔧', '⚙️', '🧪', '🔬', '📈'];
    const emojiGridEl = emojiSelectorEl.createDiv({
      cls: 'chatsidian-emoji-grid'
    });
    
    // Current selected emoji
    const selectedEmoji = this.editingAgent?.emoji || '🤖';
    
    // Create emoji buttons
    for (const emoji of commonEmojis) {
      const emojiBtn = emojiGridEl.createDiv({
        cls: 'chatsidian-emoji-option' + (emoji === selectedEmoji ? ' chatsidian-emoji-selected' : ''),
        text: emoji
      });
      
      emojiBtn.addEventListener('click', () => {
        // Remove selected class from all options
        emojiGridEl.querySelectorAll('.chatsidian-emoji-option').forEach(el => {
          el.removeClass('chatsidian-emoji-selected');
        });
        
        // Add selected class to clicked option
        emojiBtn.addClass('chatsidian-emoji-selected');
        
        // Update selected emoji
        const currentEmoji = emoji;
        emojiInput.setValue(currentEmoji);
      });
    }
    
    // Create custom emoji input
    const emojiInputEl = emojiSelectorEl.createDiv({
      cls: 'chatsidian-form-input chatsidian-emoji-custom-input'
    });
    emojiInputEl.createDiv({
      cls: 'chatsidian-emoji-custom-label',
      text: 'Custom:'
    });
    
    const emojiInput = new TextComponent(emojiInputEl);
    if (this.editingAgent && this.editingAgent.emoji) {
      emojiInput.setValue(this.editingAgent.emoji);
    } else {
      emojiInput.setValue('🤖');
    }
    
    emojiInput.onChange((value: string) => {
      if (value) {
        // Remove selected class from all options
        emojiGridEl.querySelectorAll('.chatsidian-emoji-option').forEach(el => {
          el.removeClass('chatsidian-emoji-selected');
        });
      }
    });
    
    // Create role field
    const roleContainerEl = agentInfoSectionEl.createDiv({
      cls: 'chatsidian-form-group'
    });
    roleContainerEl.createDiv({
      cls: 'chatsidian-form-label',
      text: 'Role'
    });
    const roleInputEl = roleContainerEl.createDiv({
      cls: 'chatsidian-form-input'
    });
    const roleDropdown = new SearchComponent(roleInputEl);
    roleDropdown.setPlaceholder('Select a role...');
    
    // Add role options
    const roleOptions = document.createElement('datalist');
    roleOptions.id = 'agent-role-options';
    for (const role in AgentRole) {
      if (isNaN(Number(role))) {
        const option = document.createElement('option');
        option.value = role;
        roleOptions.appendChild(option);
      }
    }
    
    document.body.appendChild(roleOptions);
    const roleInput = roleDropdown.inputEl;
    roleInput.setAttribute('list', 'agent-role-options');
    
    if (this.editingAgent) {
      // Get the role name from the AgentRole enum
      const roleName = Object.keys(AgentRole).find(key => 
        AgentRole[key as keyof typeof AgentRole] === this.editingAgent?.role
      ) || '';
      roleDropdown.setValue(roleName);
    } else {
      roleDropdown.setValue('Custom');
    }
    
    // Create description field
    const descContainerEl = agentInfoSectionEl.createDiv({
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
    
    // Create system prompt field
    const promptContainerEl = basicTabContentEl.createDiv({
      cls: 'chatsidian-form-section'
    });
    
    promptContainerEl.createEl('h3', {
      text: 'Instructions',
      cls: 'chatsidian-form-section-title'
    });
    
    promptContainerEl.createDiv({
      cls: 'chatsidian-form-help-text',
      text: 'These instructions tell the AI how to behave. Be specific about what the agent should do and how it should respond.'
    });
    
    const promptInputEl = promptContainerEl.createDiv({
      cls: 'chatsidian-form-input'
    });
    const promptInput = document.createElement('textarea');
    promptInput.className = 'chatsidian-textarea chatsidian-prompt-textarea';
    promptInput.rows = 10;
    if (this.editingAgent) {
      promptInput.value = this.editingAgent.systemPrompt;
    }
    promptInputEl.appendChild(promptInput);
    
    // ADVANCED SETTINGS TAB
    
    // Create model settings section
    const modelSettingsSectionEl = advancedTabContentEl.createDiv({
      cls: 'chatsidian-form-section'
    });
    
    modelSettingsSectionEl.createEl('h3', {
      text: 'Model Settings',
      cls: 'chatsidian-form-section-title'
    });
    
    // Create model field
    const modelContainerEl = modelSettingsSectionEl.createDiv({
      cls: 'chatsidian-form-group'
    });
    modelContainerEl.createDiv({
      cls: 'chatsidian-form-label',
      text: 'Default Model'
    });
    
    const modelHelperEl = modelContainerEl.createDiv({
      cls: 'chatsidian-form-help-text'
    });
    modelHelperEl.createSpan({
      text: 'Select the AI model this agent will use by default.'
    });
    
    const modelInputEl = modelContainerEl.createDiv({
      cls: 'chatsidian-form-input'
    });
    
    // Create model selector dropdown
    const modelSelectorEl = document.createElement('select');
    modelSelectorEl.className = 'chatsidian-model-selector';
    
    // Common models
    const commonModels = [
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'gpt-4o',
      'gpt-4-turbo',
      'gpt-3.5-turbo',
      'gemini-1.0-pro'
    ];
    
    // Add model options
    for (const model of commonModels) {
      const option = document.createElement('option');
      option.value = model;
      option.text = model;
      modelSelectorEl.appendChild(option);
    }
    
    // Set current model
    if (this.editingAgent) {
      modelSelectorEl.value = this.editingAgent.defaultSettings.model;
    } else {
      modelSelectorEl.value = 'claude-3-opus-20240229';
    }
    
    modelInputEl.appendChild(modelSelectorEl);
    
    // Create custom model field
    const customModelContainerEl = modelSettingsSectionEl.createDiv({
      cls: 'chatsidian-form-group'
    });
    customModelContainerEl.createDiv({
      cls: 'chatsidian-form-label',
      text: 'Custom Model (optional)'
    });
    
    const customModelHelperEl = customModelContainerEl.createDiv({
      cls: 'chatsidian-form-help-text'
    });
    customModelHelperEl.createSpan({
      text: 'If your model is not in the list above, enter it here.'
    });
    
    const customModelInputEl = customModelContainerEl.createDiv({
      cls: 'chatsidian-form-input'
    });
    const modelInput = new TextComponent(customModelInputEl);
    
    // Update model input field based on dropdown selection
    modelSelectorEl.addEventListener('change', () => {
      modelInput.setValue(modelSelectorEl.value);
    });
    
    if (this.editingAgent) {
      modelInput.setValue(this.editingAgent.defaultSettings.model);
    } else {
      modelInput.setValue('claude-3-opus-20240229');
    }
    
    // Create temperature field
    const tempContainerEl = modelSettingsSectionEl.createDiv({
      cls: 'chatsidian-form-group'
    });
    tempContainerEl.createDiv({
      cls: 'chatsidian-form-label',
      text: 'Temperature (0-1)'
    });
    
    const tempHelperEl = tempContainerEl.createDiv({
      cls: 'chatsidian-form-help-text'
    });
    tempHelperEl.createSpan({
      text: 'Controls randomness. Lower values are more deterministic, higher values more creative.'
    });
    
    const tempSliderContainerEl = tempContainerEl.createDiv({
      cls: 'chatsidian-form-slider-container'
    });
    
    // Create temperature slider
    const tempSlider = document.createElement('input');
    tempSlider.type = 'range';
    tempSlider.min = '0';
    tempSlider.max = '1';
    tempSlider.step = '0.01';
    tempSlider.className = 'chatsidian-form-slider';
    
    if (this.editingAgent) {
      tempSlider.value = this.editingAgent.defaultSettings.temperature.toString();
    } else {
      tempSlider.value = '0.7';
    }
    
    tempSliderContainerEl.appendChild(tempSlider);
    
    // Create temperature value display
    const tempValueEl = tempSliderContainerEl.createDiv({
      cls: 'chatsidian-form-slider-value'
    });
    tempValueEl.textContent = tempSlider.value;
    
    // Create temperature input field for direct entry
    const tempInputEl = tempContainerEl.createDiv({
      cls: 'chatsidian-form-input'
    });
    const tempInput = new TextComponent(tempInputEl);
    
    if (this.editingAgent) {
      tempInput.setValue(this.editingAgent.defaultSettings.temperature.toString());
    } else {
      tempInput.setValue('0.7');
    }
    
    // Update temp input and display when slider changes
    tempSlider.addEventListener('input', () => {
      tempValueEl.textContent = tempSlider.value;
      tempInput.setValue(tempSlider.value);
    });
    
    // Update slider and display when input changes
    tempInput.onChange(value => {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue >= 0 && numValue <= 1) {
        tempSlider.value = value;
        tempValueEl.textContent = value;
      }
    });
    
    // Create max tokens field
    const tokensContainerEl = modelSettingsSectionEl.createDiv({
      cls: 'chatsidian-form-group'
    });
    tokensContainerEl.createDiv({
      cls: 'chatsidian-form-label',
      text: 'Max Tokens'
    });
    
    const tokensHelperEl = tokensContainerEl.createDiv({
      cls: 'chatsidian-form-help-text'
    });
    tokensHelperEl.createSpan({
      text: 'Maximum number of tokens (words/characters) in the AI response.'
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
    
    // TOOLS TAB
    
    toolsTabContentEl.createEl('h3', {
      text: 'Available Tools',
      cls: 'chatsidian-form-section-title'
    });
    
    const toolsHelperEl = toolsTabContentEl.createDiv({
      cls: 'chatsidian-form-help-text'
    });
    toolsHelperEl.createSpan({
      text: 'Select which tools this agent can access. Tools allow the agent to perform actions in your vault.'
    });
    
    const toolsListEl = toolsTabContentEl.createDiv({
      cls: 'chatsidian-tools-list'
    });
    
    // Define common tools
    const commonTools = [
      { id: 'vault-search', name: 'Vault Search', description: 'Search for notes in your vault' },
      { id: 'note-create', name: 'Create Notes', description: 'Create new notes in your vault' },
      { id: 'note-edit', name: 'Edit Notes', description: 'Modify existing notes in your vault' },
      { id: 'internet-search', name: 'Internet Search', description: 'Search the web for information' },
      { id: 'folder-manage', name: 'Folder Management', description: 'Create and organize folders' },
      { id: 'tag-manage', name: 'Tag Management', description: 'Add and organize tags' },
      { id: 'file-explorer', name: 'File Explorer', description: 'Browse files and folders' },
      { id: 'metadata-editor', name: 'Metadata Editor', description: 'Edit note metadata and frontmatter' }
    ];
    
    // Get current tools
    const currentTools = this.editingAgent ? this.editingAgent.tools : [];
    
    // Tool toggle components
    const toolToggles: Record<string, any> = {};
    
    // Create tool toggles
    for (const tool of commonTools) {
      const toolItemEl = toolsListEl.createDiv({
        cls: 'chatsidian-tool-item'
      });
      
      const toolInfoEl = toolItemEl.createDiv({
        cls: 'chatsidian-tool-info'
      });
      
      toolInfoEl.createDiv({
        cls: 'chatsidian-tool-name',
        text: tool.name
      });
      
      toolInfoEl.createDiv({
        cls: 'chatsidian-tool-description',
        text: tool.description
      });
      
      const toolToggleEl = toolItemEl.createDiv({
        cls: 'chatsidian-tool-toggle'
      });
      
      // Create toggle component
      const toggle = new ToggleComponent(toolToggleEl);
      // Set initial value based on current tools
      if (currentTools && Array.isArray(currentTools)) {
        toggle.setValue(currentTools.includes(tool.id));
      }
      
      // Store toggle reference
      toolToggles[tool.id] = toggle;
    }
    
    // Create capabilities section - future improvement
    
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
    this.roleInput = roleInput;
    this.descInput = descInput;
    this.emojiInput = emojiInput;
    this.promptInput = promptInput;
    this.modelInput = modelInput;
    this.tempInput = tempInput;
    this.tokensInput = tokensInput;
    this.toolToggles = toolToggles;
  }
  
  /**
   * Activate a tab
   * 
   * @param tabContainer - The tab container element
   * @param tabContent - The tab content container element
   * @param tabIndex - The index of the tab to activate
   */
  private activateTab(tabContainer: HTMLElement, tabContent: HTMLElement, tabIndex: number): void {
    // Get all tabs
    const tabs = tabContainer.querySelectorAll('.chatsidian-modal-tab');
    const tabPanes = tabContent.querySelectorAll('.chatsidian-modal-tab-pane');
    
    // Remove active class from all tabs
    tabs.forEach(tab => {
      tab.removeClass('chatsidian-modal-tab-active');
    });
    
    // Remove active class from all tab panes
    tabPanes.forEach(pane => {
      pane.removeClass('chatsidian-modal-tab-pane-active');
    });
    
    // Add active class to selected tab
    tabs[tabIndex]?.addClass('chatsidian-modal-tab-active');
    
    // Add active class to selected tab pane
    tabPanes[tabIndex]?.addClass('chatsidian-modal-tab-pane-active');
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
    
    const roleValue = this.roleInput.value.trim();
    let role: AgentRole;
    
    // Convert role string to AgentRole enum
    if (Object.keys(AgentRole).includes(roleValue)) {
      role = AgentRole[roleValue as keyof typeof AgentRole];
    } else {
      role = AgentRole.Custom;
    }
    
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
    
    // Get selected tools
    const tools: string[] = [];
    for (const [toolId, toggle] of Object.entries(this.toolToggles)) {
      if (toggle.getValue()) {
        tools.push(toolId);
      }
    }
    
    // Create agent definition
    const agent: AgentDefinition = {
      id: this.editingAgent ? this.editingAgent.id : `custom_${Date.now()}`,
      name,
      role,
      description,
      systemPrompt,
      tools,
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
    
    // Remove role options datalist
    const roleOptions = document.getElementById('agent-role-options');
    if (roleOptions) {
      document.body.removeChild(roleOptions);
    }
  }
  
  // Input references for submission
  private nameInput!: TextComponent;
  private roleInput!: HTMLInputElement;
  private descInput!: TextComponent;
  private emojiInput!: TextComponent;
  private promptInput!: HTMLTextAreaElement;
  private modelInput!: TextComponent;
  private tempInput!: TextComponent;
  private tokensInput!: TextComponent;
  private toolToggles: Record<string, any> = {};
}