/**
 * ToolCallComponent
 * 
 * This file implements the component for displaying a single tool call in the Chatsidian plugin.
 * It provides a UI for viewing tool call details, arguments, and results, with support for
 * collapsing/expanding, copying, and retrying tool calls.
 * 
 * @file This file defines the ToolCallComponent class for displaying a single tool call.
 */

import { Component } from 'obsidian';
import { ToolCall, ToolResult } from '../../models/Conversation';
import { EventBus } from '../../core/EventBus';

/**
 * Event types for ToolCallComponent
 */
export enum ToolCallComponentEventType {
  COPY = 'tool-call-component:copy',
  COPY_RESULT = 'tool-call-component:copy-result',
  RETRY = 'tool-call-component:retry',
  TOGGLE = 'tool-call-component:toggle'
}

/**
 * Component for displaying a single tool call
 */
export class ToolCallComponent extends Component {
  /**
   * The tool call being displayed
   */
  private toolCall: ToolCall;
  
  /**
   * The tool result being displayed (if available)
   */
  private toolResult?: ToolResult;
  
  /**
   * The container element for this component
   */
  private containerEl: HTMLElement;
  
  /**
   * The element containing this tool call
   */
  private toolCallEl: HTMLElement;
  
  /**
   * The content element for this tool call
   */
  private contentEl?: HTMLElement;
  
  /**
   * Whether the tool call content is collapsed
   */
  private isCollapsed = false;
  
  /**
   * Event bus for emitting events
   */
  private eventBus: EventBus;
  
  /**
   * Constructor for the ToolCallComponent
   * 
   * @param containerEl - The container element to render the tool call in
   * @param toolCall - The tool call to display
   * @param toolResult - The tool result to display (if available)
   * @param eventBus - Event bus for emitting events
   */
  constructor(
    containerEl: HTMLElement,
    toolCall: ToolCall,
    toolResult?: ToolResult,
    eventBus?: EventBus
  ) {
    super();
    this.containerEl = containerEl;
    this.toolCall = toolCall;
    this.toolResult = toolResult;
    this.eventBus = eventBus || new EventBus();
    
    this.toolCallEl = this.render();
  }
  
  /**
   * Get the DOM element for this tool call
   * 
   * @returns The tool call element
   */
  getElement(): HTMLElement {
    return this.toolCallEl;
  }
  
  /**
   * Update the tool call and result
   * 
   * @param toolCall - The updated tool call
   * @param toolResult - The updated tool result (if available)
   */
  update(toolCall: ToolCall, toolResult?: ToolResult): void {
    this.toolCall = toolCall;
    this.toolResult = toolResult;
    
    // Remove existing element
    this.toolCallEl.remove();
    
    // Render updated element
    this.toolCallEl = this.render();
  }
  
  /**
   * Toggle the collapsed state of the tool call content
   */
  toggle(): void {
    if (!this.contentEl) return;
    
    this.isCollapsed = !this.isCollapsed;
    
    if (this.isCollapsed) {
      this.contentEl.addClass('chatsidian-tool-call-collapsed');
    } else {
      this.contentEl.removeClass('chatsidian-tool-call-collapsed');
    }
    
    // Emit toggle event
    this.eventBus.emit(ToolCallComponentEventType.TOGGLE, {
      toolCall: this.toolCall,
      toolResult: this.toolResult,
      isCollapsed: this.isCollapsed
    });
  }
  
  /**
   * Render the tool call
   * 
   * @returns The rendered tool call element
   */
  private render(): HTMLElement {
    const { id, name, arguments: args, status } = this.toolCall;
    
    // Create tool call container with appropriate class based on status
    const toolCallEl = this.containerEl.createDiv({
      cls: `chatsidian-tool-call chatsidian-tool-call-${status}`
    });
    
    // Create header
    const headerEl = toolCallEl.createDiv({
      cls: 'chatsidian-tool-call-header'
    });
    
    // Add toggle button
    const toggleEl = headerEl.createDiv({
      cls: 'chatsidian-tool-call-toggle'
    });
    toggleEl.setText(this.isCollapsed ? '▶' : '▼');
    toggleEl.addEventListener('click', () => this.toggle());
    
    // Add tool call name
    headerEl.createDiv({
      cls: 'chatsidian-tool-call-name',
      text: name
    });
    
    // Add status indicator
    headerEl.createDiv({
      cls: `chatsidian-tool-call-status chatsidian-tool-call-status-${status}`,
      text: status
    });
    
    // Add action buttons
    const actionsEl = headerEl.createDiv({
      cls: 'chatsidian-tool-call-actions'
    });
    
    // Add copy button
    const copyBtn = actionsEl.createEl('button', {
      cls: 'chatsidian-tool-call-copy-btn',
      text: 'Copy'
    });
    copyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Copy tool call to clipboard
      const toolCallText = JSON.stringify(args, null, 2);
      navigator.clipboard.writeText(toolCallText).then(() => {
        copyBtn.setText('Copied!');
        setTimeout(() => {
          copyBtn.setText('Copy');
        }, 2000);
      });
      
      // Emit copy event
      this.eventBus.emit(ToolCallComponentEventType.COPY, {
        toolCall: this.toolCall,
        toolResult: this.toolResult
      });
    });
    
    // Add retry button for error status
    if (status === 'error') {
      const retryBtn = actionsEl.createEl('button', {
        cls: 'chatsidian-tool-call-retry-btn',
        text: 'Retry'
      });
      retryBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Emit retry event
        this.eventBus.emit(ToolCallComponentEventType.RETRY, {
          toolCall: this.toolCall,
          toolResult: this.toolResult
        });
      });
    }
    
    // Create content container
    this.contentEl = toolCallEl.createDiv({
      cls: `chatsidian-tool-call-content ${this.isCollapsed ? 'chatsidian-tool-call-collapsed' : ''}`
    });
    
    // Add arguments section
    const argsSection = this.contentEl.createDiv({
      cls: 'chatsidian-tool-call-section'
    });
    
    argsSection.createDiv({
      cls: 'chatsidian-tool-call-section-title',
      text: 'Arguments'
    });
    
    const argsEl = argsSection.createEl('pre', {
      cls: 'chatsidian-tool-call-args chatsidian-tool-call-json'
    });
    argsEl.createEl('code', {
      text: JSON.stringify(args, null, 2)
    });
    
    // Add result section if available
    if (this.toolResult) {
      const resultSection = this.contentEl.createDiv({
        cls: 'chatsidian-tool-call-section'
      });
      
      resultSection.createDiv({
        cls: 'chatsidian-tool-call-section-title',
        text: 'Result'
      });
      
      // Add copy result button
      const copyResultBtn = resultSection.createEl('button', {
        cls: 'chatsidian-tool-call-copy-result-btn',
        text: 'Copy Result'
      });
      copyResultBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Copy result to clipboard
        const resultContent = this.toolResult?.error || 
          (typeof this.toolResult?.content === 'string' 
            ? this.toolResult.content 
            : JSON.stringify(this.toolResult?.content, null, 2));
        
        navigator.clipboard.writeText(resultContent).then(() => {
          copyResultBtn.setText('Copied!');
          setTimeout(() => {
            copyResultBtn.setText('Copy Result');
          }, 2000);
        });
        
        // Emit copy result event
        this.eventBus.emit(ToolCallComponentEventType.COPY_RESULT, {
          toolCall: this.toolCall,
          toolResult: this.toolResult
        });
      });
      
      // Display error if present
      if (this.toolResult.error) {
        resultSection.createDiv({
          cls: 'chatsidian-tool-call-error',
          text: `Error: ${this.toolResult.error}`
        });
      } else {
        // Display result content
        const resultContent = typeof this.toolResult.content === 'string'
          ? this.toolResult.content
          : JSON.stringify(this.toolResult.content, null, 2);
        
        const resultEl = resultSection.createEl('pre', {
          cls: 'chatsidian-tool-call-result'
        });
        resultEl.createEl('code', {
          text: resultContent
        });
      }
    }
    
    return toolCallEl;
  }
}
