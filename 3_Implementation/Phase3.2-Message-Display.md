---
title: Phase 3.2 - Message Display and Rendering
description: Implementing the message display component with Obsidian's Markdown rendering capabilities
date: 2025-05-03
status: planning
tags:
  - implementation
  - phase3
  - ui
  - message-rendering
  - markdown
  - chat-interface
---

# Phase 3.2: Message Display and Rendering

## Overview

This microphase focuses on creating the message display component for the Chatsidian chat interface. This component is responsible for rendering conversation messages with proper styling, supporting Markdown content, and providing interactive elements for message management.

The message display component is a critical part of the chat interface, as it's where users will spend most of their time reading and interacting with content. It needs to support different message types, render Markdown properly, and provide a smooth user experience with proper scrolling and visual feedback.

## Implementation Details


### MessageList Component

The core of this microphase is the `MessageList` component that manages the rendering and interaction of chat messages. This component will handle the different message types, rendering of Markdown content, and scrolling behavior.

```typescript
// src/ui/MessageList.ts
import { App, MarkdownRenderer, MarkdownView, setIcon, Notice } from 'obsidian';
import { EventBus } from '../core/EventBus';
import { Message } from '../models/Message';

export class MessageList {
  private containerEl: HTMLElement;
  private eventBus: EventBus;
  private app: App;
  private messagesEl: HTMLElement;
  private typingIndicatorEl: HTMLElement;
  private messages: Message[] = [];
  private isTyping: boolean = false;
  
  constructor(containerEl: HTMLElement, eventBus: EventBus, app: App) {
    this.containerEl = containerEl;
    this.eventBus = eventBus;
    this.app = app;
    
    // Initialize UI
    this.initializeUI();
  }
  
  private initializeUI(): void {
    // Clear container
    this.containerEl.empty();
    this.containerEl.addClass('chatsidian-message-list');
    
    // Create messages container
    this.messagesEl = this.containerEl.createDiv({
      cls: 'chatsidian-messages'
    });
    
    // Create typing indicator
    this.typingIndicatorEl = this.containerEl.createDiv({
      cls: 'chatsidian-typing-indicator'
    });
    this.typingIndicatorEl.innerHTML = `
      <div class="chatsidian-typing-dot"></div>
      <div class="chatsidian-typing-dot"></div>
      <div class="chatsidian-typing-dot"></div>
    `;
    this.typingIndicatorEl.style.display = 'none';
  }
  
  public setMessages(messages: Message[]): void {
    this.messages = [...messages];
    this.renderMessages();
  }
  
  public addMessage(message: Message): void {
    this.messages.push(message);
    this.renderMessage(message);
    this.scrollToBottom();
  }
  
  public setTypingIndicator(isTyping: boolean): void {
    this.isTyping = isTyping;
    this.typingIndicatorEl.style.display = isTyping ? 'flex' : 'none';
    
    if (isTyping) {
      this.scrollToBottom();
    }
  }
  
  private renderMessages(): void {
    // Clear messages container
    this.messagesEl.empty();
    
    // Render each message
    for (const message of this.messages) {
      this.renderMessage(message);
    }
    
    // Scroll to bottom
    this.scrollToBottom();
  }
  
  private renderMessage(message: Message): HTMLElement {
    // Create message container based on role
    const messageEl = this.messagesEl.createDiv({
      cls: `chatsidian-message chatsidian-message-${message.role}`
    });
    
    // Add timestamp
    const timestampEl = messageEl.createDiv({
      cls: 'chatsidian-message-timestamp'
    });
    timestampEl.textContent = this.formatTimestamp(message.timestamp);
    
    // Create message bubble
    const bubbleEl = messageEl.createDiv({
      cls: 'chatsidian-message-bubble'
    });
    
    // Create content container
    const contentEl = bubbleEl.createDiv({
      cls: 'chatsidian-message-content'
    });
    
    // Render content using Obsidian's Markdown renderer
    this.renderMarkdown(message.content, contentEl);
    
    // Add message actions
    this.addMessageActions(bubbleEl, message);
    
    return messageEl;
  }
  
  private renderMarkdown(content: string, containerEl: HTMLElement): void {
    // Clear container
    containerEl.empty();
    
    // Render markdown using Obsidian's renderer
    MarkdownRenderer.renderMarkdown(
      content,
      containerEl,
      '',
      null as unknown as MarkdownView // This is a workaround for the type requirement
    );
  }
  
  private addMessageActions(messageEl: HTMLElement, message: Message): void {
    // Create actions container
    const actionsEl = messageEl.createDiv({
      cls: 'chatsidian-message-actions'
    });
    
    // Add copy button
    const copyButton = actionsEl.createDiv({
      cls: 'chatsidian-message-action chatsidian-copy-button',
      attr: { 'aria-label': 'Copy message' }
    });
    setIcon(copyButton, 'copy');
    
    // Add click handler for copy button
    this.eventBus.app.registerDomEvent(copyButton, 'click', (e: MouseEvent) => {
      e.stopPropagation();
      
      // Copy message content to clipboard
      navigator.clipboard.writeText(message.content)
        .then(() => {
          new Notice('Copied to clipboard');
        })
        .catch(err => {
          console.error('Failed to copy:', err);
          new Notice('Failed to copy to clipboard');
        });
    });
    
    // Add retry button for user messages
    if (message.role === 'user') {
      const retryButton = actionsEl.createDiv({
        cls: 'chatsidian-message-action chatsidian-retry-button',
        attr: { 'aria-label': 'Retry message' }
      });
      setIcon(retryButton, 'refresh-cw');
      
      // Add click handler for retry button
      this.eventBus.app.registerDomEvent(retryButton, 'click', (e: MouseEvent) => {
        e.stopPropagation();
        this.eventBus.emit('message:retry', message);
      });
    }
  }
  
  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  private scrollToBottom(): void {
    // Scroll to bottom of messages container
    this.containerEl.scrollTop = this.containerEl.scrollHeight;
  }
}
```

This component implements the core functionality for displaying messages:

1. It manages a container for messages with proper styling
2. It renders each message using Obsidian's `MarkdownRenderer` for proper Markdown support
3. It adds message actions like copy and retry
4. It handles the typing indicator display
5. It manages scrolling behavior to ensure new messages are visible

The component is designed to work with the `EventBus` from Phase 1, emitting events when the user interacts with messages.

### Message Styling

Following the guidelines in [[💻 Coding/Projects/Chatsidian/4_Documentation/UIDesignGuidelines]], we'll add CSS styling for the different message types and components:

```css
/* src/styles.css - Message styling additions */

/* Message list container */
.chatsidian-message-list {
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.chatsidian-messages {
  flex-grow: 1;
  padding: 16px;
}

/* Message container */
.chatsidian-message {
  margin-bottom: 16px;
  position: relative;
  display: flex;
  flex-direction: column;
  max-width: 80%;
}

.chatsidian-message-user {
  align-items: flex-end;
  align-self: flex-end;
}

.chatsidian-message-assistant {
  align-items: flex-start;
  align-self: flex-start;
}

.chatsidian-message-system {
  align-items: center;
  align-self: center;
  max-width: 90%;
}

/* Timestamp */
.chatsidian-message-timestamp {
  font-size: 0.8em;
  color: var(--text-muted);
  margin-bottom: 4px;
}

/* Message bubble */
.chatsidian-message-bubble {
  border-radius: 12px;
  padding: 8px 12px;
  position: relative;
}

.chatsidian-message-user .chatsidian-message-bubble {
  background-color: var(--interactive-accent);
  color: var(--text-on-accent);
  border-top-right-radius: 4px;
}

.chatsidian-message-assistant .chatsidian-message-bubble {
  background-color: var(--background-modifier-form-field);
  color: var(--text-normal);
  border-top-left-radius: 4px;
}

.chatsidian-message-system .chatsidian-message-bubble {
  background-color: var(--background-modifier-border);
  color: var(--text-muted);
  font-style: italic;
}

/* Message content */
.chatsidian-message-content {
  overflow-wrap: break-word;
  word-break: break-word;
}

/* Override some markdown styling */
.chatsidian-message-user .chatsidian-message-content a {
  color: var(--text-on-accent);
  text-decoration: underline;
}

.chatsidian-message-user .chatsidian-message-content code {
  background-color: rgba(255, 255, 255, 0.2);
  color: var(--text-on-accent);
}

/* Message actions */
.chatsidian-message-actions {
  position: absolute;
  top: 0;
  transform: translateY(-50%);
  display: none;
  background-color: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  padding: 2px;
  z-index: 10;
}

.chatsidian-message-user .chatsidian-message-actions {
  left: 0;
}

.chatsidian-message-assistant .chatsidian-message-actions {
  right: 0;
}

.chatsidian-message-bubble:hover .chatsidian-message-actions {
  display: flex;
}

.chatsidian-message-action {
  cursor: pointer;
  padding: 4px;
  color: var(--text-muted);
  border-radius: 4px;
  margin: 0 2px;
}

.chatsidian-message-action:hover {
  background-color: var(--background-modifier-hover);
  color: var(--text-normal);
}

/* Typing indicator */
.chatsidian-typing-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  margin-left: 12px;
  align-self: flex-start;
}

.chatsidian-typing-dot {
  width: 8px;
  height: 8px;
  margin: 0 2px;
  background-color: var(--text-muted);
  border-radius: 50%;
  animation: chatsidian-typing-animation 1.4s infinite ease-in-out;
}

.chatsidian-typing-dot:nth-child(1) {
  animation-delay: 0s;
}

.chatsidian-typing-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.chatsidian-typing-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes chatsidian-typing-animation {
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-6px);
  }
}
```

The CSS provides styling for:
1. Different message types (user, assistant, system) with appropriate alignment and colors
2. Message bubbles with a chat-like appearance
3. Message actions that appear on hover
4. A typing indicator with animated dots
5. Proper Markdown content styling within messages

All styling uses Obsidian's CSS variables to ensure compatibility with different themes.

### Integration with ChatView

We need to integrate the `MessageList` component with the `ChatView` created in the previous microphase:

```typescript
// src/ui/ChatView.ts (updated)
import { MessageList } from './MessageList';

export class ChatView extends ItemView {
  // ... existing code ...
  
  private messageList: MessageList;
  
  async onOpen(): Promise<void> {
    // ... existing setup code ...
    
    // Initialize message list
    this.messageList = new MessageList(
      this.messagesContainerEl,
      this.eventBus,
      this.app
    );
    
    // Register message events
    this.registerMessageEvents();
    
    // ... existing code ...
  }
  
  private registerMessageEvents(): void {
    // Listen for message retry events
    this.registerEvent(
      this.eventBus.on('message:retry', (message: Message) => {
        // This will be implemented in the input area microphase
        console.log('Retry message:', message);
      })
    );
  }
  
  // Method to add a new message to the UI
  public addMessage(message: Message): void {
    this.messageList.addMessage(message);
  }
  
  // Method to set typing indicator
  public setTypingIndicator(isTyping: boolean): void {
    this.messageList.setTypingIndicator(isTyping);
  }
  
  // Method to load a conversation
  public loadConversation(messages: Message[]): void {
    this.messageList.setMessages(messages);
  }
}
```

This update adds the `MessageList` component to the `ChatView` and provides methods for adding messages, setting the typing indicator state, and loading a full conversation.

### Streaming Message Support

An important feature for chat interfaces is the ability to stream responses from the AI, showing messages as they're being generated. We'll add support for this in the `MessageList` component:

```typescript
// src/ui/MessageList.ts (additional methods)
private streamingMessageEl: HTMLElement | null = null;
private streamingContent: string = '';

public updateStreamingMessage(chunk: string): void {
  // If no streaming message exists, create one
  if (!this.streamingMessageEl) {
    // Create a new message element for the assistant
    this.streamingMessageEl = this.messagesEl.createDiv({
      cls: 'chatsidian-message chatsidian-message-assistant'
    });
    
    // Add timestamp
    const timestampEl = this.streamingMessageEl.createDiv({
      cls: 'chatsidian-message-timestamp'
    });
    timestampEl.textContent = this.formatTimestamp(Date.now());
    
    // Create bubble and content elements
    const bubbleEl = this.streamingMessageEl.createDiv({
      cls: 'chatsidian-message-bubble'
    });
    
    bubbleEl.createDiv({
      cls: 'chatsidian-message-content'
    });
    
    // Reset streaming content
    this.streamingContent = '';
  }
  
  // Update streaming content
  this.streamingContent += chunk;
  
  // Get content element
  const contentEl = this.streamingMessageEl.querySelector('.chatsidian-message-content');
  
  if (contentEl) {
    // Render markdown with updated content
    this.renderMarkdown(this.streamingContent, contentEl);
  }
  
  // Scroll to bottom
  this.scrollToBottom();
}

public finalizeStreamingMessage(message: Message): void {
  // If there's no streaming message, just add the message normally
  if (!this.streamingMessageEl) {
    this.addMessage(message);
    return;
  }
  
  // Reset streaming state
  this.streamingMessageEl = null;
  this.streamingContent = '';
  
  // Add the complete message
  this.addMessage(message);
}
```

These methods support streaming messages:
- `updateStreamingMessage` updates a temporary message element with new content as it arrives
- `finalizeStreamingMessage` replaces the temporary message with the final complete message

And in the `ChatView`, we'll add event handlers for streaming:

```typescript
// src/ui/ChatView.ts (updated again)
private registerMessageEvents(): void {
  // ... existing code ...
  
  // Listen for streaming chunks
  this.registerEvent(
    this.eventBus.on('message:chunk', (chunk: string) => {
      this.messageList.updateStreamingMessage(chunk);
    })
  );
  
  // Listen for streaming completion
  this.registerEvent(
    this.eventBus.on('message:complete', (message: Message) => {
      this.messageList.finalizeStreamingMessage(message);
    })
  );
}
```

This enables the chat interface to show messages as they're being generated, providing a more responsive and engaging user experience.

## Markdown Rendering Considerations

According to [[💻 Coding/Projects/Chatsidian/4_Documentation/UIDesignGuidelines]], we need to ensure proper rendering of Markdown content within messages. Obsidian's `MarkdownRenderer.renderMarkdown()` method handles most of the work, but there are some special considerations:

1. **Code Blocks**: Code blocks need special styling within messages, especially in user messages where the background is colored
2. **Images**: Images should be constrained to the message width
3. **Links**: Links in user messages need contrasting colors

We'll add additional CSS to handle these cases:

```css
/* src/styles.css - Additional Markdown styling */

/* Code blocks in messages */
.chatsidian-message-content pre {
  margin: 0.5em 0;
}

.chatsidian-message-content code {
  font-family: var(--font-monospace);
  font-size: 0.9em;
}

.chatsidian-message-user .chatsidian-message-content pre {
  background-color: rgba(0, 0, 0, 0.2);
  padding: 8px;
  border-radius: 4px;
}

/* Images in messages */
.chatsidian-message-content img {
  max-width: 100%;
  border-radius: 4px;
}

/* Tables in messages */
.chatsidian-message-content table {
  border-collapse: collapse;
  width: 100%;
  margin: 0.5em 0;
}

.chatsidian-message-content th,
.chatsidian-message-content td {
  border: 1px solid var(--background-modifier-border);
  padding: 4px 8px;
}

.chatsidian-message-user .chatsidian-message-content th,
.chatsidian-message-user .chatsidian-message-content td {
  border-color: rgba(255, 255, 255, 0.2);
}
```

These styles ensure that Markdown elements like code blocks, images, and tables render correctly within the chat messages, regardless of the message type.

## Testing Strategy

Testing for this microphase will involve:

1. **Unit Testing**:
   - Test the `MessageList` component methods
   - Verify correct message rendering
   - Test streaming functionality

2. **Integration Testing**:
   - Test integration with `ChatView`
   - Verify event handling between components

3. **Manual UI Testing**:
   - Test rendering of different message types
   - Verify Markdown rendering (code, images, links, etc.)
   - Test message actions (copy, retry)
   - Verify scrolling behavior
   - Test streaming messages with different content types

4. **Accessibility Testing**:
   - Verify proper keyboard navigation
   - Test screen reader compatibility
   - Check color contrast

## Dependencies

This microphase depends on:
- Phase 3.1 (Core View Registration)
- Obsidian's MarkdownRenderer API
- EventBus from Phase 1

## Integration with Other Components

The `MessageList` component will integrate with:
1. **ChatView**: As the container for messages
2. **EventBus**: For handling message-related events
3. **Provider Adapters**: For receiving streaming message chunks (indirectly through EventBus)

## Next Steps

After completing this microphase, we'll have a fully functional message display component capable of rendering different message types with proper Markdown support and interactive elements.

The next microphases will focus on:
1. Implementing the input area with auto-growing textarea
2. Creating conversation management and selection UI
3. Adding tool call visualization within messages

## Additional Resources

- [[💻 Coding/Projects/Chatsidian/4_Documentation/UIDesignGuidelines]]
- [Obsidian Markdown Rendering Documentation](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts#L4409)
