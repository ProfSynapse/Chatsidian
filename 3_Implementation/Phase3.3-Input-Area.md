---
title: Phase 3.3 - Interactive Input Area
description: Creating a responsive input area with auto-growing textarea and submission handling
date: 2025-05-03
status: planning
tags:
  - implementation
  - phase3
  - ui
  - input-area
  - chat-interface
---

# Phase 3.3: Interactive Input Area

## Overview

This microphase focuses on creating the input area for the Chatsidian chat interface. The input area is where users compose and submit their messages, so it needs to be intuitive, responsive, and provide a smooth user experience.

The key features of the input area include an auto-growing textarea that expands as users type, a send button for message submission, keyboard shortcuts for efficient interaction, and proper state management during message processing.

## Implementation Details


### InputArea Component

The core of this microphase is the `InputArea` component that handles user input:

```typescript
// src/ui/InputArea.ts
import { setIcon } from 'obsidian';
import { EventBus } from '../core/EventBus';

export class InputArea {
  private containerEl: HTMLElement;
  private eventBus: EventBus;
  private textareaEl: HTMLTextAreaElement;
  private sendButtonEl: HTMLElement;
  private charCounterEl: HTMLElement;
  private enabled: boolean = true;
  private maxLength: number = 32000; // Default max length
  
  constructor(containerEl: HTMLElement, eventBus: EventBus) {
    this.containerEl = containerEl;
    this.eventBus = eventBus;
    
    // Initialize UI
    this.initializeUI();
    
    // Set up event listeners
    this.setupEventListeners();
  }
  
  private initializeUI(): void {
    // Clear container
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
    this.charCounterEl = textareaContainerEl.createDiv({
      cls: 'chatsidian-char-counter'
    });
    this.updateCharCounter();
    
    // Create send button
    this.sendButtonEl = this.containerEl.createDiv({
      cls: 'chatsidian-send-button'
    });
    setIcon(this.sendButtonEl, 'arrow-up');
  }
  
  private setupEventListeners(): void {
    // Handle textarea input for autogrow
    this.eventBus.app.registerDomEvent(this.textareaEl, 'input', () => {
      this.autoGrow();
      this.updateCharCounter();
    });
    
    // Handle key press
    this.eventBus.app.registerDomEvent(this.textareaEl, 'keydown', (event: KeyboardEvent) => {
      // Submit on Enter (without Shift)
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.submit();
      }
    });
    
    // Handle send button click
    this.eventBus.app.registerDomEvent(this.sendButtonEl, 'click', () => {
      this.submit();
    });
  }
  
  private autoGrow(): void {
    // Reset height to auto to get correct scrollHeight
    this.textareaEl.style.height = 'auto';
    
    // Set height to scrollHeight to fit content
    const newHeight = Math.min(this.textareaEl.scrollHeight, 150); // Max height of 150px
    this.textareaEl.style.height = `${newHeight}px`;
  }
  
  private updateCharCounter(): void {
    const length = this.textareaEl.value.length;
    this.charCounterEl.textContent = `${length}/${this.maxLength}`;
    
    // Add warning class if approaching max length
    if (length > this.maxLength * 0.8) {
      this.charCounterEl.addClass('chatsidian-char-counter-warning');
    } else {
      this.charCounterEl.removeClass('chatsidian-char-counter-warning');
    }
  }
  
  private submit(): void {
    // Check if enabled
    if (!this.enabled) {
      return;
    }
    
    // Get value
    const value = this.textareaEl.value.trim();
    
    // Skip if empty
    if (!value) {
      return;
    }
    
    // Check if exceeds max length
    if (value.length > this.maxLength) {
      // Notify user
      this.eventBus.emit('notification:show', {
        message: `Message exceeds maximum length of ${this.maxLength} characters`,
        type: 'error'
      });
      return;
    }
    
    // Emit event
    this.eventBus.emit('input:submit', value);
    
    // Clear input
    this.setValue('');
    
    // Focus textarea
    this.focus();
  }
  
  public setValue(value: string): void {
    this.textareaEl.value = value;
    this.autoGrow();
    this.updateCharCounter();
  }
  
  public getValue(): string {
    return this.textareaEl.value;
  }
  
  public focus(): void {
    this.textareaEl.focus();
  }
  
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.textareaEl.disabled = !enabled;
    
    if (enabled) {
      this.containerEl.removeClass('chatsidian-input-disabled');
      this.sendButtonEl.removeClass('chatsidian-send-button-disabled');
    } else {
      this.containerEl.addClass('chatsidian-input-disabled');
      this.sendButtonEl.addClass('chatsidian-send-button-disabled');
    }
  }
  
  public setMaxLength(maxLength: number): void {
    this.maxLength = maxLength;
    this.updateCharCounter();
  }
}
```

This component implements the following features:
1. An auto-growing textarea that expands as the user types
2. A send button with icon
3. Character counter with visual warning when approaching limits
4. Keyboard shortcuts (Enter to send, Shift+Enter for newline)
5. Disabled state for when messages are being processed
6. Focus management

The component emits events through the `EventBus` to communicate with other components, particularly when a message is submitted.

### Input Area Styling

According to [[💻 Coding/Projects/Chatsidian/4_Documentation/UIDesignGuidelines]], the input area should be responsive and visually consistent with Obsidian's design patterns. We'll add the following CSS:

```css
/* src/styles.css - Input area styling */

/* Input area container */
.chatsidian-input-area {
  display: flex;
  align-items: flex-end;
  padding: 12px;
  border-top: 1px solid var(--background-modifier-border);
  background-color: var(--background-primary);
}

/* Textarea container */
.chatsidian-textarea-container {
  flex-grow: 1;
  margin-right: 8px;
  position: relative;
}

/* Textarea */
.chatsidian-textarea {
  width: 100%;
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid var(--background-modifier-border);
  background-color: var(--background-modifier-form-field);
  color: var(--text-normal);
  resize: none;
  font-family: inherit;
  font-size: inherit;
  line-height: 1.5;
  min-height: 24px;
  max-height: 150px;
  overflow-y: auto;
  transition: border-color 0.15s ease;
}

.chatsidian-textarea:focus {
  outline: none;
  border-color: var(--interactive-accent);
}

.chatsidian-textarea::placeholder {
  color: var(--text-faint);
}

/* Character counter */
.chatsidian-char-counter {
  position: absolute;
  bottom: 4px;
  right: 8px;
  font-size: 0.75em;
  color: var(--text-muted);
  pointer-events: none;
  opacity: 0.7;
}

.chatsidian-char-counter-warning {
  color: var(--text-error);
  opacity: 1;
}

/* Send button */
.chatsidian-send-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: var(--interactive-accent);
  color: var(--text-on-accent);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.chatsidian-send-button:hover {
  background-color: var(--interactive-accent-hover);
}

.chatsidian-send-button svg {
  width: 20px;
  height: 20px;
}

/* Disabled state */
.chatsidian-input-disabled .chatsidian-textarea {
  background-color: var(--background-modifier-border);
  color: var(--text-muted);
  cursor: not-allowed;
}

.chatsidian-send-button-disabled {
  background-color: var(--background-modifier-border);
  color: var(--text-muted);
  cursor: not-allowed;
}
```

This CSS provides styling for:
1. The input area container with proper spacing and borders
2. The textarea with auto-grow capabilities and focus states
3. The character counter with warning state
4. The send button with hover effects
5. Disabled states for the input area

All styling uses Obsidian's CSS variables to ensure compatibility with different themes.

  private async handleMessageSubmit(content: string): Promise<void> {
    // Prevent multiple submissions
    if (this.isSubmitting) {
      return;
    }
    
    // Set submitting state
    this.isSubmitting = true;
    this.inputArea.setEnabled(false);
    
    try {
      // Create user message
      const userMessage: Message = {
        id: this.generateId(),
        role: 'user',
        content: content,
        timestamp: Date.now()
      };
      
      // Add user message to UI
      this.messageList.addMessage(userMessage);
      
      // Show typing indicator
      this.messageList.setTypingIndicator(true);
      
      // Send message to MCP Client
      // This will use the MCPClient from Phase 2
      // For now, we'll just emit an event
      this.eventBus.emit('mcp:sendMessage', {
        message: userMessage,
        conversationId: this.currentConversationId
      });
      
      // In a real implementation, we would await the response
      // and handle it, but for this phase, we'll just simulate it
      
      // Simulate assistant response after a delay
      setTimeout(() => {
        // Hide typing indicator
        this.messageList.setTypingIndicator(false);
        
        // Create assistant message
        const assistantMessage: Message = {
          id: this.generateId(),
          role: 'assistant',
          content: `I received your message: "${content}"\n\nThis is a placeholder response until the MCP client is implemented.`,
          timestamp: Date.now()
        };
        
        // Add assistant message to UI
        this.messageList.addMessage(assistantMessage);
        
        // Reset submitting state
        this.isSubmitting = false;
        this.inputArea.setEnabled(true);
      }, 1500);
    } catch (error) {
      // Handle errors
      console.error('Error sending message:', error);
      
      // Create error message
      const errorMessage: Message = {
        id: this.generateId(),
        role: 'system',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };
      
      // Add error message to UI
      this.messageList.addMessage(errorMessage);
      
      // Hide typing indicator
      this.messageList.setTypingIndicator(false);
      
      // Reset submitting state
      this.isSubmitting = false;
      this.inputArea.setEnabled(true);
    }
  }
  
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
}
```

This integration adds the following functionality:
1. Message submission handling
2. User and assistant message rendering
3. Typing indicator management
4. Error handling
5. Disabling the input area during message processing

The implementation includes a simulated response for demonstration purposes, which will be replaced with actual MCP client integration in a later phase.

### Focus Management and Accessibility

An important aspect of the input area is proper focus management for a good user experience. We'll add methods to the `InputArea` component to handle focus:

```typescript
// src/ui/InputArea.ts (additional methods)
/**
 * Handles focus lifecycle events
 */
public onViewOpen(): void {
  // Focus the textarea when the view is opened
  setTimeout(() => this.focus(), 100);
}

public onViewFocus(): void {
  // Focus the textarea when the view gets focus
  this.focus();
}

/**
 * Handles resize events
 */
public onResize(): void {
  // Recalculate textarea height
  this.autoGrow();
}
```

And we'll add these methods to the `ChatView` lifecycle:

```typescript
// src/ui/ChatView.ts (updated with focus management)
async onOpen(): Promise<void> {
  // ... existing code ...
  
  // Set initial focus
  this.inputArea.onViewOpen();
}

setViewOnResize(): void {
  // Handle resize event
  super.setViewOnResize();
  
  // Update input area
  if (this.inputArea) {
    this.inputArea.onResize();
  }
}

onPaneActive(): void {
  // Focus input when pane becomes active
  super.onPaneActive();
  
  // Focus input area
  if (this.inputArea) {
    this.inputArea.onViewFocus();
  }
}
```

This ensures that the input area receives focus at appropriate times, providing a seamless user experience.

## Accessibility Considerations

For accessibility, we'll add ARIA attributes to the input area:

```typescript
// src/ui/InputArea.ts (updated initialization)
private initializeUI(): void {
  // ... existing code ...
  
  // Add ARIA attributes
  this.textareaEl.setAttribute('aria-label', 'Message input');
  this.sendButtonEl.setAttribute('aria-label', 'Send message');
  
  // ... rest of existing code ...
}
```

These attributes improve screen reader compatibility, making the interface more accessible to all users.

## Testing Strategy

Testing for this microphase will involve:

1. **Unit Testing**:
   - Test the `InputArea` component methods
   - Verify character counting and validation
   - Test auto-grow functionality

2. **Integration Testing**:
   - Test integration with `ChatView`
   - Verify event handling between components

3. **Manual UI Testing**:
   - Test auto-growing with different content lengths
   - Verify keyboard shortcuts (Enter to send, Shift+Enter for newline)
   - Test disabled state during message processing
   - Verify character counter with warnings
   - Test focus management across different scenarios

4. **Accessibility Testing**:
   - Verify keyboard navigation
   - Test screen reader compatibility
   - Check focus management for accessibility

## Dependencies

This microphase depends on:
- Phase 3.1 (Core View Registration)
- Phase 3.2 (Message Display)
- EventBus from Phase 1

## Integration with Other Components

The `InputArea` component will integrate with:
1. **ChatView**: As the container for input
2. **EventBus**: For communicating message submission events
3. **MessageList**: For updating UI after message submission

## Next Steps

After completing this microphase, we'll have a fully functional input area that allows users to compose and submit messages with a smooth, responsive interface.

The next microphases will focus on:
1. Implementing conversation management UI
2. Creating the conversation sidebar
3. Adding agent and model selection UI

## Additional Resources

- [[💻 Coding/Projects/Chatsidian/4_Documentation/UIDesignGuidelines]]
- [Obsidian Icon Documentation](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts#L3774)
