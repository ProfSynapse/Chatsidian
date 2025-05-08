/**
 * InputArea Component
 * 
 * This file implements the input area component for the Chatsidian plugin.
 * It provides a textarea for user input, a send button, and keyboard shortcuts
 * for submitting messages.
 * 
 * The component handles input validation, formatting, and submission to the
 * active conversation.
 * 
 * @file This file defines the InputArea class for user message input.
 */

import { Component, setIcon } from 'obsidian';
import { EventBus } from '../core/EventBus';
import { ConversationUtils, Message, MessageRole } from '../models/Conversation';

/**
 * Event types for input area events
 */
export enum InputAreaEventType {
  MESSAGE_SUBMITTED = 'input-area:message-submitted',
}

/**
 * InputArea component for user message input
 */
export class InputArea extends Component {
  /**
   * Container element for the input area
   */
  private containerEl: HTMLElement;
  
  /**
   * Textarea element for user input
   */
  private textareaEl: HTMLTextAreaElement;
  
  /**
   * Send button element
   */
  private sendButtonEl: HTMLElement;
  
  /**
   * Event bus for component communication
   */
  private eventBus: EventBus;
  
  /**
   * Whether the input is currently disabled
   */
  private isDisabled: boolean = false;
  
  /**
   * Character counter element
   */
  private characterCounterEl: HTMLElement;
  
  /**
   * Typing indicator element
   */
  private typingIndicatorEl: HTMLElement | null = null;
  
  /**
   * Constructor for the InputArea
   * 
   * @param containerEl - The container element to render the input area in
   * @param eventBus - The event bus for component communication
   */
  constructor(containerEl: HTMLElement, eventBus: EventBus) {
    super();
    this.containerEl = containerEl;
    this.eventBus = eventBus;
    
    this.render();
    this.registerEventHandlers();
  }
  
  /**
   * Render the input area
   */
  private render(): void {
    this.containerEl.empty();
    this.containerEl.addClass('chatsidian-input-area');
    
    // Create textarea container
    const textareaContainerEl = this.containerEl.createDiv({
      cls: 'chatsidian-textarea-container'
    });
    
    // Create textarea
    this.textareaEl = textareaContainerEl.createEl('textarea', {
      cls: 'chatsidian-textarea',
      attr: {
        placeholder: 'Type a message...',
        rows: '1'
      }
    });
    
    // Create character counter
    this.characterCounterEl = textareaContainerEl.createDiv({
      cls: 'chatsidian-character-counter',
      text: '0'
    });
    
    // Create typing indicator
    if (this.containerEl.parentElement) {
      this.typingIndicatorEl = this.containerEl.parentElement.createDiv({
        cls: 'chatsidian-typing-indicator'
      });
      
      this.typingIndicatorEl.createSpan({
        text: 'Assistant is typing'
      });
      
      const dotsContainer = this.typingIndicatorEl.createDiv({
        cls: 'chatsidian-typing-indicator-dots'
      });
      
      for (let i = 0; i < 3; i++) {
        dotsContainer.createDiv({
          cls: 'chatsidian-typing-indicator-dot'
        });
      }
    }
    
    // Create button container
    const buttonContainerEl = this.containerEl.createDiv({
      cls: 'chatsidian-button-container'
    });
    
    // Create send button
    this.sendButtonEl = buttonContainerEl.createDiv({
      cls: 'chatsidian-send-button'
    });
    setIcon(this.sendButtonEl, 'arrow-up');
    
    // Add keyboard shortcuts hint
    if (this.containerEl.parentElement) {
      this.containerEl.parentElement.createDiv({
        cls: 'chatsidian-keyboard-hint',
        text: 'Press Enter to send, Shift+Enter for new line, Esc to clear'
      });
    }
  }
  
  /**
   * Register event handlers for the input area
   */
  private registerEventHandlers(): void {
    // Handle send button click
    this.sendButtonEl.addEventListener('click', () => {
      this.handleSubmit();
    });
    
    // Handle textarea input for auto-resize and character count
    this.textareaEl.addEventListener('input', () => {
      this.autoResizeTextarea();
      this.updateCharacterCount();
    });
    
    // Handle keyboard shortcuts
    this.textareaEl.addEventListener('keydown', (event) => {
      // Enter without shift for submit
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.handleSubmit();
      }
      
      // Shift+Enter for new line
      if (event.key === 'Enter' && event.shiftKey) {
        // Default behavior (new line) is fine
      }
      
      // Escape to clear input
      if (event.key === 'Escape') {
        this.clearInput();
      }
    });
  }
  
  /**
   * Update the character count display
   */
  private updateCharacterCount(): void {
    const count = this.textareaEl.value.length;
    this.characterCounterEl.setText(count.toString());
    
    // Add visual indication for longer messages
    if (count > 500) {
      this.characterCounterEl.addClass('chatsidian-character-count-high');
    } else {
      this.characterCounterEl.removeClass('chatsidian-character-count-high');
    }
  }
  
  /**
   * Auto-resize the textarea based on content
   */
  private autoResizeTextarea(): void {
    // Reset height to auto to get the correct scrollHeight
    this.textareaEl.style.height = 'auto';
    
    // Set height to scrollHeight to fit content
    const newHeight = Math.min(
      Math.max(this.textareaEl.scrollHeight, 36), // Min height 36px
      200 // Max height 200px
    );
    this.textareaEl.style.height = `${newHeight}px`;
    
    // Update send button state
    this.updateSendButtonState();
  }
  
  /**
   * Update the send button state based on input content
   */
  private updateSendButtonState(): void {
    const hasContent = this.textareaEl.value.trim().length > 0;
    
    if (hasContent) {
      this.sendButtonEl.addClass('chatsidian-send-button-active');
    } else {
      this.sendButtonEl.removeClass('chatsidian-send-button-active');
    }
  }
  
  /**
   * Handle message submission
   */
  private handleSubmit(): void {
    if (this.isDisabled) {
      return;
    }
    
    const content = this.textareaEl.value.trim();
    
    if (content.length === 0) {
      return;
    }
    
    // Create message
    const message = ConversationUtils.createMessage(MessageRole.User, content);
    
    // Emit message submitted event
    this.eventBus.emit(InputAreaEventType.MESSAGE_SUBMITTED, message);
    
    // Clear input
    this.clearInput();
  }
  
  /**
   * Clear the input textarea
   */
  private clearInput(): void {
    this.textareaEl.value = '';
    this.autoResizeTextarea();
    this.updateCharacterCount();
  }
  
  /**
   * Focus the input textarea
   */
  focus(): void {
    this.textareaEl.focus();
  }
  
  /**
   * Set the disabled state of the input area
   * 
   * @param disabled - Whether the input area should be disabled
   */
  setDisabled(disabled: boolean): void {
    this.isDisabled = disabled;
    
    if (disabled) {
      this.textareaEl.setAttribute('disabled', 'true');
      this.containerEl.addClass('chatsidian-input-area-disabled');
    } else {
      this.textareaEl.removeAttribute('disabled');
      this.containerEl.removeClass('chatsidian-input-area-disabled');
    }
  }
  
  /**
   * Show the typing indicator
   */
  showTypingIndicator(): void {
    if (this.typingIndicatorEl) {
      this.typingIndicatorEl.addClass('active');
    }
  }
  
  /**
   * Hide the typing indicator
   */
  hideTypingIndicator(): void {
    if (this.typingIndicatorEl) {
      this.typingIndicatorEl.removeClass('active');
    }
  }
  
  /**
   * Get the current input value
   * 
   * @returns The current input value
   */
  getValue(): string {
    return this.textareaEl.value;
  }
  
  /**
   * Set the input value
   * 
   * @param value - The value to set
   */
  setValue(value: string): void {
    this.textareaEl.value = value;
    this.autoResizeTextarea();
    this.updateCharacterCount();
  }
}
