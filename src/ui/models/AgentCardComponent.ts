/**
 * AgentCardComponent
 * 
 * This component renders an agent as a card UI element that can be
 * selected, edited, or deleted. Used in the revised agent selector
 * that displays agents in a grid layout.
 * 
 * @file This file defines the AgentCardComponent class
 */

import { Component, setIcon, ButtonComponent } from 'obsidian';
import { AgentDefinition } from '../../agents/AgentTypes';

/**
 * Event types for agent card interactions
 */
export enum AgentCardEventType {
  SELECTED = 'agent-card:selected',
  EDIT = 'agent-card:edit',
  DELETE = 'agent-card:delete'
}

/**
 * AgentCardComponent displays a single agent as a selectable card
 */
export class AgentCardComponent extends Component {
  /**
   * The container element for this card
   */
  private containerEl: HTMLElement;

  /**
   * The agent definition displayed by this card
   */
  private agent: AgentDefinition;

  /**
   * Whether this card is currently selected
   */
  private selected: boolean = false;

  /**
   * Whether to allow editing this agent
   */
  private allowEditing: boolean = true;

  /**
   * Whether to allow deleting this agent
   */
  private allowDeleting: boolean = true;

  /**
   * Callback function for events on this card
   */
  private onEvent: (type: AgentCardEventType, agent: AgentDefinition) => void;

  /**
   * Constructor for AgentCardComponent
   * 
   * @param containerEl - The container element for this card
   * @param agent - The agent definition to display
   * @param onEvent - Callback for card events
   * @param options - Additional options
   */
  constructor(
    containerEl: HTMLElement,
    agent: AgentDefinition,
    onEvent: (type: AgentCardEventType, agent: AgentDefinition) => void,
    options: {
      selected?: boolean;
      allowEditing?: boolean;
      allowDeleting?: boolean;
    } = {}
  ) {
    super();

    this.containerEl = containerEl;
    this.agent = agent;
    this.onEvent = onEvent;
    
    // Apply options
    this.selected = options.selected || false;
    this.allowEditing = agent.builtIn ? false : (options.allowEditing !== undefined ? options.allowEditing : true);
    this.allowDeleting = agent.builtIn ? false : (options.allowDeleting !== undefined ? options.allowDeleting : true);

    this.render();
  }

  /**
   * Render the agent card
   */
  private render(): void {
    this.containerEl.empty();
    this.containerEl.addClass('chatsidian-agent-card');
    
    if (this.selected) {
      this.containerEl.addClass('chatsidian-agent-card-selected');
    }

    // Create card content container
    const contentEl = this.containerEl.createDiv({
      cls: 'chatsidian-agent-card-content'
    });

    // Create header with emoji and name
    const headerEl = contentEl.createDiv({
      cls: 'chatsidian-agent-card-header'
    });

    // Add emoji or icon
    if (this.agent.emoji) {
      headerEl.createDiv({
        cls: 'chatsidian-agent-card-emoji',
        text: this.agent.emoji
      });
    } else {
      const iconEl = headerEl.createDiv({
        cls: 'chatsidian-agent-card-icon'
      });
      setIcon(iconEl, 'bot');
    }

    // Add agent name
    headerEl.createDiv({
      cls: 'chatsidian-agent-card-name',
      text: this.agent.name
    });

    // Add agent description
    contentEl.createDiv({
      cls: 'chatsidian-agent-card-description',
      text: this.agent.description
    });

    // Add model info
    contentEl.createDiv({
      cls: 'chatsidian-agent-card-model',
      text: `Model: ${this.agent.defaultSettings.model}`
    });

    // Create footer with actions
    const footerEl = contentEl.createDiv({
      cls: 'chatsidian-agent-card-footer'
    });

    // Add built-in badge if applicable
    if (this.agent.builtIn) {
      footerEl.createDiv({
        cls: 'chatsidian-agent-card-built-in',
        text: 'Built-in'
      });
    }

    // Add action buttons if allowed
    if (this.allowDeleting) {
      const actionsEl = footerEl.createDiv({
        cls: 'chatsidian-agent-card-actions'
      });

      // Only add delete button separately
      // Edit functionality will be triggered by clicking the card
      const deleteButtonEl = actionsEl.createDiv();
      new ButtonComponent(deleteButtonEl)
        .setIcon('trash')
        .setTooltip('Delete agent')
        .onClick(e => {
          e.stopPropagation();
          this.onEvent(AgentCardEventType.DELETE, this.agent);
        });
    }

    // Add click handler: always open edit modal (for both built-in and custom agents)
    // This makes cards act as entry points to edit the agent settings
    this.containerEl.addEventListener('click', (e) => {
      // Don't handle click if it's on a button (delete button already has its own handler)
      const target = e.target as HTMLElement;
      if (target.closest('.chatsidian-agent-card-actions')) {
        return;
      }
      
      // Select agent first (for consistency)
      this.onEvent(AgentCardEventType.SELECTED, this.agent);
      
      // Then send the edit event to open the modal immediately
      this.onEvent(AgentCardEventType.EDIT, this.agent);
    });
  }

  /**
   * Set the selected state of this card
   * 
   * @param selected - Whether this card is selected
   */
  setSelected(selected: boolean): void {
    if (this.selected !== selected) {
      this.selected = selected;
      
      if (selected) {
        this.containerEl.addClass('chatsidian-agent-card-selected');
      } else {
        this.containerEl.removeClass('chatsidian-agent-card-selected');
      }
    }
  }

  /**
   * Get the agent definition for this card
   * 
   * @returns The agent definition
   */
  getAgent(): AgentDefinition {
    return this.agent;
  }
}