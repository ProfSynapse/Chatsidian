/**
 * ToolCallList
 * 
 * This file implements the component for displaying a list of tool calls in the Chatsidian plugin.
 * It provides a UI for viewing multiple tool calls and their results, with support for
 * collapsing/expanding all tool calls at once.
 * 
 * @file This file defines the ToolCallList class for displaying a list of tool calls.
 */

import { Component } from 'obsidian';
import { ToolCall, ToolResult } from '../../models/Conversation';
import { EventBus } from '../../core/EventBus';
import { ToolCallComponent, ToolCallComponentEventType } from './ToolCallComponent';

/**
 * Event types for ToolCallList
 */
export enum ToolCallListEventType {
  RETRY_TOOL_CALL = 'tool-call-list:retry',
  COPY_TOOL_CALL = 'tool-call-list:copy',
  COPY_TOOL_RESULT = 'tool-call-list:copy-result',
  TOGGLE_ALL = 'tool-call-list:toggle-all'
}

/**
 * Component for displaying a list of tool calls
 */
export class ToolCallList extends Component {
  /**
   * The container element for this component
   */
  private containerEl: HTMLElement;
  
  /**
   * The list element for tool calls
   */
  private listEl: HTMLElement;
  
  /**
   * The current tool calls being displayed
   */
  private toolCalls: ToolCall[] = [];
  
  /**
   * The current tool results being displayed
   */
  private toolResults: ToolResult[] = [];
  
  /**
   * Map of tool call IDs to their corresponding components
   */
  private toolCallComponents: Map<string, ToolCallComponent> = new Map();
  
  /**
   * Whether all tool calls are currently collapsed
   */
  private allCollapsed = false;
  
  /**
   * Event bus for emitting events
   */
  private eventBus: EventBus;
  
  /**
   * Constructor for the ToolCallList
   * 
   * @param containerEl - The container element to render the list in
   * @param eventBus - Event bus for emitting events
   */
  constructor(containerEl: HTMLElement, eventBus?: EventBus) {
    super();
    this.containerEl = containerEl;
    this.eventBus = eventBus || new EventBus();
    
    this.listEl = this.render();
  }
  
  /**
   * Set the tool calls and results to display
   * 
   * @param toolCalls - Array of tool calls to display
   * @param toolResults - Array of tool results to display
   */
  setToolCalls(toolCalls: ToolCall[], toolResults: ToolResult[]): void {
    this.toolCalls = [...toolCalls];
    this.toolResults = [...toolResults];
    
    this.render();
  }
  
  /**
   * Toggle the collapsed state of all tool calls
   */
  toggleAll(): void {
    this.allCollapsed = !this.allCollapsed;
    
    // Toggle all tool call components
    this.toolCallComponents.forEach(component => {
      if (this.allCollapsed) {
        component.toggle();
      } else {
        component.toggle();
      }
    });
    
    // Emit toggle all event
    this.eventBus.emit(ToolCallListEventType.TOGGLE_ALL, {
      allCollapsed: this.allCollapsed
    });
  }
  
  /**
   * Render the tool call list
   * 
   * @returns The rendered list element
   */
  private render(): HTMLElement {
    // Clear container
    this.containerEl.empty();
    this.toolCallComponents.clear();
    
    // Create list container
    const listEl = this.containerEl.createDiv({
      cls: 'chatsidian-tool-call-list'
    });
    
    // Create header
    const headerEl = listEl.createDiv({
      cls: 'chatsidian-tool-call-list-header'
    });
    
    // Add title
    headerEl.createDiv({
      cls: 'chatsidian-tool-call-list-title',
      text: `Tool Calls (${this.toolCalls.length})`
    });
    
    // Add controls
    const controlsEl = headerEl.createDiv({
      cls: 'chatsidian-tool-call-list-controls'
    });
    
    // Add toggle all button
    const toggleAllBtn = controlsEl.createEl('button', {
      cls: 'chatsidian-tool-call-list-toggle-all',
      text: this.allCollapsed ? 'Expand All' : 'Collapse All'
    });
    toggleAllBtn.addEventListener('click', () => this.toggleAll());
    
    // Render tool calls
    for (const toolCall of this.toolCalls) {
      const toolResult = this.toolResults.find(r => r.toolCallId === toolCall.id);
      
      // Create tool call container
      const toolCallContainerEl = listEl.createDiv();
      
      // Get the status for this tool call
      const status = toolCall.status || 'pending';
      
      // Add status class to the container
      toolCallContainerEl.addClass(`chatsidian-tool-call-${status}`);
      
      // Add a status indicator element inside the container
      toolCallContainerEl.createDiv({
        cls: `chatsidian-tool-call-${status}`
      });
      
      // Create tool call component
      const toolCallComponent = new ToolCallComponent(
        toolCallContainerEl,
        toolCall,
        toolResult,
        this.eventBus
      );
      this.addChild(toolCallComponent);
      
      // Store reference to component
      this.toolCallComponents.set(toolCall.id, toolCallComponent);
      
      // Register event handlers for tool call component events
      this.registerEvent(
        this.eventBus.on(ToolCallComponentEventType.RETRY, (event) => {
          if (event.toolCall.id === toolCall.id) {
            // Forward event to parent component
            this.eventBus.emit(ToolCallListEventType.RETRY_TOOL_CALL, event);
          }
        })
      );
      
      this.registerEvent(
        this.eventBus.on(ToolCallComponentEventType.COPY, (event) => {
          if (event.toolCall.id === toolCall.id) {
            // Forward event to parent component
            this.eventBus.emit(ToolCallListEventType.COPY_TOOL_CALL, event);
          }
        })
      );
      
      this.registerEvent(
        this.eventBus.on(ToolCallComponentEventType.COPY_RESULT, (event) => {
          if (event.toolCall.id === toolCall.id) {
            // Forward event to parent component
            this.eventBus.emit(ToolCallListEventType.COPY_TOOL_RESULT, event);
          }
        })
      );
    }
    
    return listEl;
  }
}
