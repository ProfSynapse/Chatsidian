/**
 * MessageDisplay Component
 * 
 * This file implements the components for displaying chat messages in the Chatsidian plugin.
 * It provides components for rendering user and AI messages, including support for markdown
 * rendering and code block formatting.
 * 
 * The components in this file are used by the ChatView to display messages in the chat interface.
 * 
 * @file This file defines the MessageList and MessageComponent classes for displaying chat messages.
 */

import { Component, MarkdownRenderer, setIcon } from 'obsidian';
import { Message, MessageRole, ConversationUtils, ToolCall, ToolResult } from '../models/Conversation';
import { EventBus } from '../core/EventBus';
import { ToolCallList, ToolCallListEventType } from './tools/ToolCallList';

/**
 * MessageList component for displaying a list of messages
 * Manages a collection of MessageComponent instances
 */
export class MessageList extends Component {
  /**
   * Container element for the message list
   */
  private containerEl: HTMLElement;
  
  /**
   * Current messages being displayed
   */
  private messages: Message[] = [];
  
  /**
   * Map of message IDs to their corresponding DOM elements
   */
  private messageElements: Map<string, HTMLElement> = new Map();
  
  /**
   * Event bus for emitting events
   */
  private eventBus: EventBus;
  
  /**
   * Constructor for the MessageList
   * 
   * @param containerEl - The container element to render the message list in
   * @param eventBus - Optional event bus for emitting events
   */
  constructor(containerEl: HTMLElement, eventBus?: EventBus) {
    super();
    this.containerEl = containerEl;
    this.containerEl.addClass('chatsidian-message-list');
    this.eventBus = eventBus || new EventBus();
  }
  
  /**
   * Set the messages to display
   * 
   * @param messages - Array of messages to display
   */
  setMessages(messages: Message[]): void {
    this.messages = [...messages];
    this.render();
  }
  
  /**
   * Add a new message to the list
   * 
   * @param message - The message to add
   */
  addMessage(message: Message): void {
    this.messages.push(message);
    this.renderMessage(message);
    this.scrollToBottom();
  }
  
  /**
   * Update an existing message in the list
   * 
   * @param message - The message with updated content
   */
  updateMessage(message: Message): void {
    const index = this.messages.findIndex(m => m.id === message.id);
    if (index >= 0) {
      this.messages[index] = message;
      
      // Remove existing message element
      const existingEl = this.messageElements.get(message.id);
      if (existingEl) {
        existingEl.remove();
      }
      
      // Render updated message
      this.renderMessage(message);
    }
  }
  
  /**
   * Clear all messages from the list
   */
  clear(): void {
    this.messages = [];
    this.messageElements.clear();
    this.containerEl.empty();
  }
  
  /**
   * Render all messages in the list
   */
  private render(): void {
    this.containerEl.empty();
    this.messageElements.clear();
    
    for (const message of this.messages) {
      this.renderMessage(message);
    }
    
    this.scrollToBottom();
  }
  
  /**
   * Render a single message
   * 
   * @param message - The message to render
   */
  private renderMessage(message: Message): void {
    const messageComponent = new MessageComponent(this.containerEl, message, this.eventBus);
    this.addChild(messageComponent);
    
    // Store reference to the message element
    this.messageElements.set(message.id, messageComponent.getElement());
  }
  
  /**
   * Scroll the message list to the bottom
   */
  private scrollToBottom(): void {
    // Find the scrollable container (might be parent of this container)
    const scrollableContainer = this.containerEl.closest('.chatsidian-message-list-container') || this.containerEl;
    scrollableContainer.scrollTop = scrollableContainer.scrollHeight;
  }
}

/**
 * MessageComponent for displaying a single message
 */
export class MessageComponent extends Component {
  /**
   * The message being displayed
   */
  private message: Message;
  
  /**
   * The container element for this message
   */
  private containerEl: HTMLElement;
  
  /**
   * The element containing this message
   */
  private messageEl: HTMLElement;
  
  /**
   * Event bus for emitting events
   */
  private eventBus?: EventBus;
  
  /**
   * Tool call list component
   */
  private toolCallList?: ToolCallList;
  
  /**
   * Constructor for the MessageComponent
   * 
   * @param containerEl - The container element to render the message in
   * @param message - The message to display
   * @param eventBus - Optional event bus for emitting events
   */
  constructor(containerEl: HTMLElement, message: Message, eventBus?: EventBus) {
    super();
    this.containerEl = containerEl;
    this.message = message;
    this.eventBus = eventBus;
    
    this.messageEl = this.render();
  }
  
  /**
   * Get the DOM element for this message
   * 
   * @returns The message element
   */
  getElement(): HTMLElement {
    return this.messageEl;
  }
  
  /**
   * Render the message
   * 
   * @returns The rendered message element
   */
  private render(): HTMLElement {
    const { role, content, toolCalls, toolResults } = this.message;
    
    // Create message container with appropriate class based on role
    const messageEl = this.containerEl.createDiv({
      cls: `chatsidian-message chatsidian-message-${role}`
    });
    
    // Add avatar/icon based on role
    const avatarEl = messageEl.createDiv({ cls: 'chatsidian-message-avatar' });
    const iconEl = avatarEl.createDiv({ cls: 'chatsidian-avatar-icon' });
    
    // Use the imported setIcon function
    try {
      if (role === MessageRole.User) {
        iconEl.setText('U'); // Fallback text
        setIcon(iconEl, 'user');
      } else {
        iconEl.setText('A'); // Fallback text
        setIcon(iconEl, 'bot');
      }
    } catch (e) {
      // Keep the fallback text if icon fails
      console.warn('Could not set icon:', e);
    }
    
    // Create content container
    const contentEl = messageEl.createDiv({ cls: 'chatsidian-message-content' });
    
    // Add role label
    const roleLabel = role === MessageRole.User ? 'You' : 'Assistant';
    contentEl.createDiv({ 
      cls: 'chatsidian-message-role',
      text: roleLabel
    });
    
    // Create markdown content element
    const markdownEl = contentEl.createDiv({ cls: 'chatsidian-message-markdown' });
    
    // Handle typing indicator or render markdown
    if (content === '...') {
      // Create typing indicator with animated dots
      const typingIndicatorEl = markdownEl.createDiv({ cls: 'chatsidian-typing-indicator' });
      for (let i = 0; i < 3; i++) {
        typingIndicatorEl.createDiv({ cls: 'chatsidian-typing-dot' });
      }
    } else {
      // Render markdown content
      this.renderMarkdown(content, markdownEl);
    }
    
    // Render tool calls if present
    if (toolCalls && toolCalls.length > 0) {
      this.renderToolCalls(toolCalls, toolResults, contentEl);
    }
    
    return messageEl;
  }
  
  /**
   * Render markdown content
   * 
   * @param content - The markdown content to render
   * @param containerEl - The container element to render into
   */
  private async renderMarkdown(content: string, containerEl: HTMLElement): Promise<void> {
    try {
      await MarkdownRenderer.renderMarkdown(
        content,
        containerEl,
        '',
        this
      );
      
      // Add syntax highlighting to code blocks
      containerEl.querySelectorAll('pre code').forEach((codeBlock) => {
        codeBlock.addClass('language-' + (codeBlock.className.match(/language-(\w+)/) || ['', 'text'])[1]);
      });
      
      // Add copy button to code blocks
      containerEl.querySelectorAll('pre').forEach((preBlock) => {
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-code-button';
        copyButton.textContent = 'Copy';
        preBlock.appendChild(copyButton);
        
        copyButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const codeElement = preBlock.querySelector('code');
          if (codeElement) {
            const codeText = codeElement.textContent || '';
            navigator.clipboard.writeText(codeText).then(() => {
              // Show feedback
              copyButton.textContent = 'Copied!';
              setTimeout(() => {
                copyButton.textContent = 'Copy';
              }, 2000);
            }).catch((err) => {
              console.error('Failed to copy code: ', err);
              copyButton.textContent = 'Error';
              setTimeout(() => {
                copyButton.textContent = 'Copy';
              }, 2000);
            });
          }
        });
      });
    } catch (error) {
      console.error('Error rendering markdown:', error);
      containerEl.setText(content);
    }
  }
  
  /**
   * Render tool calls and their results
   * 
   * @param toolCalls - Array of tool calls to render
   * @param toolResults - Array of tool results to render
   * @param containerEl - The container element to render into
   */
  private renderToolCalls(
    toolCalls: ToolCall[],
    toolResults: ToolResult[] | undefined,
    containerEl: HTMLElement
  ): void {
    // Create container for tool calls
    const toolCallsEl = containerEl.createDiv({ cls: 'chatsidian-tool-calls' });
    
    // Create event bus if not provided
    const eventBus = this.eventBus || new EventBus();
    
    // Create tool call list component
    this.toolCallList = new ToolCallList(toolCallsEl, eventBus);
    this.addChild(this.toolCallList);
    
    // Set tool calls and results
    this.toolCallList.setToolCalls(
      toolCalls,
      toolResults || []
    );
    
    // Register event handlers for tool call list events
    this.registerEvent(
      eventBus.on(ToolCallListEventType.RETRY_TOOL_CALL, (event) => {
        console.log('Tool call retry requested:', event.toolCall);
        // Forward event to parent component if needed
      })
    );
    
    this.registerEvent(
      eventBus.on(ToolCallListEventType.COPY_TOOL_CALL, (event) => {
        console.log('Tool call copied:', event.toolCall);
      })
    );
    
    this.registerEvent(
      eventBus.on(ToolCallListEventType.COPY_TOOL_RESULT, (event) => {
        console.log('Tool result copied:', event.toolResult);
      })
    );
  }
}
