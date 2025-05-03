---
title: Phase 3 Implementation - Chat Interface
description: Detailed implementation plan for the chat interface of the Chatsidian plugin
date: 2025-05-03
status: planning
tags:
  - implementation
  - ui
  - chat-interface
  - obsidian-views
---

# Phase 3: Chat Interface

## Overview

Phase 3 focuses on creating the user-facing components of the Chatsidian plugin. Building on the core infrastructure from Phase 1 and the MCP/BCP integration from Phase 2, this phase implements a native Obsidian-style chat interface that allows users to interact with AI assistants, select agents, and visualize tool operations within the vault. The UI will be designed to feel like it was created by the Obsidian team themselves, adhering to their design philosophy of minimalism and functionality.

## Design Philosophy

The Chatsidian interface follows these key design principles to align with Obsidian:

1. **Minimalist Design** - Clean, uncluttered interface with a focus on content
2. **Native Integration** - Using Obsidian CSS variables and UI components
3. **Responsive Layout** - Adapting to different pane sizes and Obsidian themes
4. **Keyboard Accessibility** - Supporting Obsidian's keyboard-centric workflow
5. **Consistent Iconography** - Using Obsidian's icon set for familiar interactions

## Objectives

1. Implement a native Obsidian view for the chat interface
2. Create message rendering with Markdown support and message actions (copy, retry)
3. Build an input area with autocompletion
4. Implement conversation management UI with conversation folders and starring
5. Add tool call visualization
6. Integrate agent and model selection in the UI with dropdown menus
7. Add streaming message display
8. Implement responsive layout for different pane sizes
9. Create a conversation sidebar with appropriate organization (starred, folders, ungrouped)
10. Add configurable agent tools through settings

## Key Components

### ChatView

The main view component that hosts the chat interface.

```typescript
// src/ui/ChatView.ts
import { ItemView, WorkspaceLeaf, MarkdownRenderer, setIcon, Notice } from 'obsidian';
import { EventBus } from '../core/EventBus';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { ConversationSelector } from './ConversationSelector';
import { ModelSelector } from './ModelSelector';
import { AgentSelector } from './AgentSelector';
import { ConversationSidebar } from './ConversationSidebar';
import { Conversation, Message, ConversationFolder } from '../models/Conversation';
import { StorageManager } from '../core/StorageManager';
import { MCPClient } from '../mcp/MCPClient';
import { AgentManager } from '../mcp/AgentManager';
import { ModelManager } from '../mcp/ModelManager';

export const CHAT_VIEW_TYPE = 'chatsidian-chat-view';

export class ChatView extends ItemView {
  private eventBus: EventBus;
  private storage: StorageManager;
  private mcpClient: MCPClient;
  private agentManager: AgentManager;
  private modelManager: ModelManager;
  
  private messageList: MessageList;
  private inputArea: InputArea;
  private conversationSelector: ConversationSelector;
  private agentSelector: AgentSelector;
  private modelSelector: ModelSelector;
  private sidebar: ConversationSidebar;
  
  private sidebarContainerEl: HTMLElement;
  private contentContainerEl: HTMLElement;
  private isSidebarOpen: boolean = false;
  
  private currentConversation: Conversation | null = null;
  private currentAgentId: string | null = null;
  private currentModelId: string | null = null;
  private isTyping: boolean = false;
  
  constructor(
    leaf: WorkspaceLeaf,
    eventBus: EventBus,
    storage: StorageManager,
    mcpClient: MCPClient,
    agentManager: AgentManager,
    modelManager: ModelManager
  ) {
    super(leaf);
    this.eventBus = eventBus;
    this.storage = storage;
    this.mcpClient = mcpClient;
    this.agentManager = agentManager;
    this.modelManager = modelManager;
  }
  
  getViewType(): string {
    return CHAT_VIEW_TYPE;
  }
  
  getDisplayText(): string {
    return 'Chatsidian';
  }
  
  getIcon(): string {
    return 'message-square';
  }
  
  async onOpen(): Promise<void> {
    const { containerEl } = this;
    
    // Clear container
    containerEl.empty();
    containerEl.addClass('chatsidian-container');
    
    // Create main layout - sidebar and content
    this.sidebarContainerEl = containerEl.createDiv({ cls: 'chatsidian-sidebar-container' });
    this.contentContainerEl = containerEl.createDiv({ cls: 'chatsidian-content-container' });
    
    // Initialize sidebar
    this.sidebar = new ConversationSidebar(
      this.sidebarContainerEl,
      this.eventBus,
      this.storage
    );
    
    // Create hamburger menu toggle for sidebar
    const hamburgerEl = this.contentContainerEl.createDiv({ 
      cls: 'chatsidian-hamburger-toggle' 
    });
    setIcon(hamburgerEl, 'menu');
    hamburgerEl.addEventListener('click', () => this.toggleSidebar());
    
    // Create header
    const headerEl = this.contentContainerEl.createDiv({ cls: 'chatsidian-header' });
    
    // Create conversation selector
    this.conversationSelector = new ConversationSelector(
      headerEl.createDiv({ cls: 'chatsidian-conversation-selector' }),
      this.eventBus,
      this.storage
    );
    
    // Create model selector
    this.modelSelector = new ModelSelector(
      headerEl.createDiv({ cls: 'chatsidian-model-selector' }),
      this.eventBus,
      this.modelManager
    );
    
    // Create agent selector
    this.agentSelector = new AgentSelector(
      headerEl.createDiv({ cls: 'chatsidian-agent-selector' }),
      this.eventBus,
      this.agentManager
    );
    
    // Create action buttons
    const actionsEl = headerEl.createDiv({ cls: 'chatsidian-actions' });
    
    // New conversation button
    const newButton = actionsEl.createDiv({ 
      cls: 'chatsidian-action-button chatsidian-new-button',
      attr: { 'aria-label': 'New Chat' }
    });
    setIcon(newButton, 'plus');
    newButton.addEventListener('click', () => this.createNewConversation());
    
    // Star conversation button
    const starButton = actionsEl.createDiv({ 
      cls: 'chatsidian-action-button chatsidian-star-button',
      attr: { 'aria-label': 'Star Conversation' }
    });
    setIcon(starButton, 'star');
    starButton.addEventListener('click', () => this.toggleStarConversation());
    
    // Create message area container
    const messageAreaEl = this.contentContainerEl.createDiv({ cls: 'chatsidian-message-area' });
    
    // Create message list
    this.messageList = new MessageList(
      messageAreaEl.createDiv({ cls: 'chatsidian-messages' }),
      this.eventBus,
      this.app
    );
    
    // Create input area
    this.inputArea = new InputArea(
      messageAreaEl.createDiv({ cls: 'chatsidian-input' }),
      this.eventBus
    );
    
    // Register event handlers
    this.registerEvents();
    
    // Load initial state
    await this.loadInitialState();
  }
  
  private async loadInitialState(): Promise<void> {
    // Get all conversations
    const conversations = await this.storage.getConversations();
    
    if (conversations.length > 0) {
      // Load most recent conversation
      const recentConversation = conversations[0];
      await this.loadConversation(recentConversation.id);
    } else {
      // Create a new conversation
      await this.createNewConversation();
    }
  }
  
  private async loadConversation(id: string): Promise<void> {
    // Load conversation from storage
    const conversation = await this.storage.getConversation(id);
    
    if (!conversation) {
      console.error(`Failed to load conversation ${id}`);
      return;
    }
    
    // Update current conversation
    this.currentConversation = conversation;
    
    // Update UI
    this.conversationSelector.setActiveConversation(conversation.id);
    this.messageList.setConversation(conversation);
    
    // Enable input
    this.inputArea.setEnabled(true);
    
    // Focus input
    this.inputArea.focus();
  }
  
  private async createNewConversation(): Promise<void> {
    // Create a new conversation
    const conversation = await this.storage.createConversation();
    
    // Load the new conversation
    await this.loadConversation(conversation.id);
  }
  
  private async sendMessage(content: string): Promise<void> {
    if (!this.currentConversation) {
      return;
    }
    
    // Disable input while processing
    this.inputArea.setEnabled(false);
    
    // Show typing indicator
    this.setTypingIndicator(true);
    
    try {
      // Add user message to conversation
      const userMessage: Message = {
        id: this.generateId(),
        role: 'user',
        content,
        timestamp: Date.now()
      };
      
      // Add to conversation
      this.currentConversation.messages.push(userMessage);
      
      // Update message list
      this.messageList.addMessage(userMessage);
      
      // Save conversation
      await this.storage.saveConversation(this.currentConversation);
      
      // Send to AI
      const assistantMessage = await this.mcpClient.sendMessage(
        this.currentConversation,
        userMessage,
        this.currentAgentId
      );
      
      // Add assistant message to conversation
      this.currentConversation.messages.push(assistantMessage);
      
      // Update message list
      this.messageList.addMessage(assistantMessage);
      
      // Save conversation
      await this.storage.saveConversation(this.currentConversation);
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Show error in message list
      const errorMessage: Message = {
        id: this.generateId(),
        role: 'system',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };
      
      this.messageList.addMessage(errorMessage);
    } finally {
      // Hide typing indicator
      this.setTypingIndicator(false);
      
      // Re-enable input
      this.inputArea.setEnabled(true);
      
      // Focus input
      this.inputArea.focus();
    }
  }
  
  private setTypingIndicator(isTyping: boolean): void {
    this.isTyping = isTyping;
    this.messageList.setTypingIndicator(isTyping);
  }
  
  private handleAgentChanged(agentId: string | null): void {
    this.currentAgentId = agentId;
  }
  
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
  
  private toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
    
    if (this.isSidebarOpen) {
      this.containerEl.addClass('chatsidian-sidebar-open');
    } else {
      this.containerEl.removeClass('chatsidian-sidebar-open');
    }
  }
  
  private toggleStarConversation(): void {
    if (!this.currentConversation) {
      return;
    }
    
    // Toggle star status
    this.currentConversation.isStarred = !this.currentConversation.isStarred;
    
    // Update star button appearance
    const starButton = this.contentContainerEl.querySelector('.chatsidian-star-button');
    if (starButton) {
      if (this.currentConversation.isStarred) {
        starButton.addClass('chatsidian-starred');
        setIcon(starButton, 'star');
      } else {
        starButton.removeClass('chatsidian-starred');
        setIcon(starButton, 'star');
      }
    }
    
    // Save conversation to update star status
    this.storage.saveConversation(this.currentConversation);
    
    // Emit event for sidebar to update
    this.eventBus.emit('conversation:starred', {
      id: this.currentConversation.id,
      isStarred: this.currentConversation.isStarred
    });
    
    // Show notification
    new Notice(
      this.currentConversation.isStarred 
        ? 'Conversation starred' 
        : 'Conversation unstarred'
    );
  }
  
  private handleModelChanged(modelId: string | null): void {
    this.currentModelId = modelId;
    
    // If we have an active conversation, update its model ID
    if (this.currentConversation) {
      this.currentConversation.modelId = modelId;
      this.storage.saveConversation(this.currentConversation);
    }
  }
  
  private registerEvents(): void {
    // Listen for message submissions
    this.eventBus.on('input:submit', (content: string) => this.sendMessage(content));
    
    // Listen for conversation changes
    this.eventBus.on('conversation:selected', (id: string) => this.loadConversation(id));
    this.eventBus.on('conversation:new', () => this.createNewConversation());
    
    // Listen for agent changes
    this.eventBus.on('agent:selected', (id: string | null) => this.handleAgentChanged(id));
    
    // Listen for model changes
    this.eventBus.on('model:selected', (id: string | null) => this.handleModelChanged(id));
    
    // Listen for message chunks (streaming)
    this.eventBus.on('mcp:messageChunk', (data: any) => {
      if (
        this.currentConversation && 
        data.conversationId === this.currentConversation.id
      ) {
        this.messageList.updateStreamingMessage(data.chunk);
      }
    });
    
    // Listen for message retry
    this.eventBus.on('message:retry', (message: Message) => {
      if (this.currentConversation) {
        // Get the message content
        const content = message.content;
        
        // Focus input and set content
        this.inputArea.setValue(content);
        this.inputArea.focus();
      }
    });
    
    // Listen for folder changes
    this.eventBus.on('conversation:folder:created', (folder: ConversationFolder) => {
      // Update UI if needed
    });
    
    this.eventBus.on('conversation:folder:deleted', (folderId: string) => {
      // Update UI if needed
    });
    
    this.eventBus.on('conversation:folder:updated', (folder: ConversationFolder) => {
      // Update UI if needed
    });
    
    this.eventBus.on('conversation:moved', (data: { conversationId: string, folderId: string | null }) => {
      // Update UI if needed
    });
  }
  
  async onClose(): Promise<void> {
    // Clean up event listeners
    this.eventBus.off('input:submit');
    this.eventBus.off('conversation:selected');
    this.eventBus.off('conversation:new');
    this.eventBus.off('agent:selected');
    this.eventBus.off('model:selected');
    this.eventBus.off('mcp:messageChunk');
    this.eventBus.off('message:retry');
    this.eventBus.off('conversation:folder:created');
    this.eventBus.off('conversation:folder:deleted');
    this.eventBus.off('conversation:folder:updated');
    this.eventBus.off('conversation:moved');
  }
}
```


### MessageList

The MessageList component renders conversation messages and handles tool call visualization.

```typescript
// src/ui/MessageList.ts
import { App, MarkdownRenderer, MarkdownView } from 'obsidian';
import { EventBus } from '../core/EventBus';
import { Conversation, Message, ToolCall, ToolResult } from '../models/Conversation';

export class MessageList {
  private containerEl: HTMLElement;
  private eventBus: EventBus;
  private app: App;
  private messagesEl: HTMLElement;
  private typingIndicatorEl: HTMLElement;
  private conversation: Conversation | null = null;
  private streamingMessageEl: HTMLElement | null = null;
  private streamingContent: string = '';
  
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
  
  public setConversation(conversation: Conversation): void {
    this.conversation = conversation;
    
    // Clear messages
    this.messagesEl.empty();
    
    // Reset streaming state
    this.streamingMessageEl = null;
    this.streamingContent = '';
    
    // Render messages
    for (const message of conversation.messages) {
      this.renderMessage(message);
    }
    
    // Scroll to bottom
    this.scrollToBottom();
  }
  
  public addMessage(message: Message): void {
    if (!this.conversation) {
      return;
    }
    
    // Render message
    this.renderMessage(message);
    
    // Scroll to bottom
    this.scrollToBottom();
  }
  
  public setTypingIndicator(visible: boolean): void {
    this.typingIndicatorEl.style.display = visible ? 'flex' : 'none';
    
    if (visible) {
      this.scrollToBottom();
    }
  }
  
  public updateStreamingMessage(chunk: any): void {
    // Check if there's content to update
    if (!chunk.delta || (!chunk.delta.content && !chunk.delta.toolCalls)) {
      return;
    }
    
    // Create streaming message if not exists
    if (!this.streamingMessageEl) {
      // Create message container
      this.streamingMessageEl = this.messagesEl.createDiv({
        cls: 'chatsidian-message chatsidian-message-assistant'
      });
      
      // Create message content
      const contentEl = this.streamingMessageEl.createDiv({
        cls: 'chatsidian-message-content'
      });
      
      // Reset streaming content
      this.streamingContent = '';
    }
    
    // Update content if present
    if (chunk.delta.content) {
      this.streamingContent += chunk.delta.content;
      
      // Get content element
      const contentEl = this.streamingMessageEl.querySelector('.chatsidian-message-content');
      
      if (contentEl) {
        // Render markdown
        this.renderMarkdown(this.streamingContent, contentEl);
      }
    }
    
    // Update tool calls if present (not streaming yet, just placeholder)
    if (chunk.delta.toolCalls && chunk.delta.toolCalls.length > 0) {
      // Get or create tool calls container
      let toolCallsEl = this.streamingMessageEl.querySelector('.chatsidian-tool-calls');
      
      if (!toolCallsEl) {
        toolCallsEl = this.streamingMessageEl.createDiv({
          cls: 'chatsidian-tool-calls'
        });
      }
      
      // Add placeholder for tool call
      toolCallsEl.createDiv({
        cls: 'chatsidian-tool-call-placeholder',
        text: 'Tool call received... processing'
      });
    }
    
    // Scroll to bottom
    this.scrollToBottom();
  }
  
  private renderMessage(message: Message): void {
    // Create message container
    const messageEl = this.messagesEl.createDiv({
      cls: `chatsidian-message chatsidian-message-${message.role}`
    });
    
    // Set data attribute for message ID
    messageEl.dataset.messageId = message.id;
    
    // Add timestamp
    const timestampEl = messageEl.createDiv({
      cls: 'chatsidian-message-timestamp'
    });
    timestampEl.textContent = this.formatTimestamp(message.timestamp);
    
    // Create message content container
    const bubbleEl = messageEl.createDiv({
      cls: 'chatsidian-message-bubble'
    });
    
    // Create message content
    const contentEl = bubbleEl.createDiv({
      cls: 'chatsidian-message-content'
    });
    
    // Render markdown content
    this.renderMarkdown(message.content, contentEl);
    
    // Add message actions (copy, retry)
    this.addMessageActions(bubbleEl, message);
    
    // Render tool calls if present
    if (message.toolCalls && message.toolCalls.length > 0) {
      this.renderToolCalls(message.toolCalls, message.toolResults || [], messageEl);
    }
    
    // Update streaming message element if this is a new assistant message
    if (message.role === 'assistant' && !message.id.startsWith('stream-')) {
      this.streamingMessageEl = null;
      this.streamingContent = '';
    }
  }
  
  private addMessageActions(messageEl: HTMLElement, message: Message): void {
    // Create message actions container (hidden by default, visible on hover)
    const actionsEl = messageEl.createDiv({ 
      cls: 'chatsidian-message-actions' 
    });
    
    // Add copy button
    const copyButton = actionsEl.createDiv({ 
      cls: 'chatsidian-message-action chatsidian-copy-button',
      attr: { 'aria-label': 'Copy message' }
    });
    setIcon(copyButton, 'copy');
    
    copyButton.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // Copy message content to clipboard
      navigator.clipboard.writeText(message.content).then(() => {
        // Show copy confirmation
        new Notice('Copied to clipboard');
      });
    });
    
    // Add retry button for user messages
    if (message.role === 'user') {
      const retryButton = actionsEl.createDiv({ 
        cls: 'chatsidian-message-action chatsidian-retry-button',
        attr: { 'aria-label': 'Retry message' }
      });
      setIcon(retryButton, 'refresh-cw');
      
      retryButton.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Emit retry event
        this.eventBus.emit('message:retry', message);
      });
    }
  }
  
  private renderToolCalls(
    toolCalls: ToolCall[], 
    toolResults: ToolResult[], 
    messageEl: HTMLElement
  ): void {
    // Create tool calls container
    const toolCallsEl = messageEl.createDiv({
      cls: 'chatsidian-tool-calls'
    });
    
    // Render each tool call
    for (const toolCall of toolCalls) {
      this.renderToolCall(toolCall, toolResults, toolCallsEl);
    }
  }
  
  private renderToolCall(
    toolCall: ToolCall, 
    toolResults: ToolResult[], 
    containerEl: HTMLElement
  ): void {
    // Create tool call container
    const toolCallEl = containerEl.createDiv({
      cls: `chatsidian-tool-call chatsidian-tool-call-${toolCall.status}`
    });
    
    // Set data attribute for tool call ID
    toolCallEl.dataset.toolCallId = toolCall.id;
    
    // Create header
    const headerEl = toolCallEl.createDiv({
      cls: 'chatsidian-tool-call-header'
    });
    
    // Add tool name
    headerEl.createSpan({
      cls: 'chatsidian-tool-name',
      text: toolCall.name
    });
    
    // Add status indicator
    headerEl.createSpan({
      cls: `chatsidian-tool-status chatsidian-tool-status-${toolCall.status}`,
      text: toolCall.status
    });
    
    // Create tool arguments
    const argsEl = toolCallEl.createDiv({
      cls: 'chatsidian-tool-arguments'
    });
    
    // Format arguments
    const formattedArgs = JSON.stringify(toolCall.arguments, null, 2);
    
    // Create code block for arguments
    const argsCodeEl = argsEl.createEl('pre').createEl('code');
    argsCodeEl.textContent = formattedArgs;
    
    // Find matching tool result
    const toolResult = toolResults.find(result => result.toolCallId === toolCall.id);
    
    // Render tool result if present
    if (toolResult) {
      this.renderToolResult(toolResult, toolCallEl);
    }
  }
  
  private renderToolResult(toolResult: ToolResult, toolCallEl: HTMLElement): void {
    // Create tool result container
    const resultEl = toolCallEl.createDiv({
      cls: 'chatsidian-tool-result'
    });
    
    // Check if there's an error
    if (toolResult.error) {
      resultEl.addClass('chatsidian-tool-result-error');
      
      // Add error message
      resultEl.createDiv({
        cls: 'chatsidian-tool-error',
        text: toolResult.error
      });
      
      return;
    }
    
    // Create result content
    const contentEl = resultEl.createDiv({
      cls: 'chatsidian-tool-result-content'
    });
    
    // Format result
    let formattedResult: string;
    
    try {
      formattedResult = JSON.stringify(toolResult.content, null, 2);
    } catch (error) {
      formattedResult = String(toolResult.content);
    }
    
    // Create code block for result
    const resultCodeEl = contentEl.createEl('pre').createEl('code');
    resultCodeEl.textContent = formattedResult;
  }
  
  private renderMarkdown(content: string, containerEl: HTMLElement): void {
    // Clear container
    containerEl.empty();
    
    // Render markdown
    MarkdownRenderer.renderMarkdown(
      content,
      containerEl,
      '',
      null as unknown as MarkdownView
    );
  }
  
  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  private scrollToBottom(): void {
    this.containerEl.scrollTop = this.containerEl.scrollHeight;
  }
}
```


### InputArea

The InputArea component handles user input with autogrowing textarea and submit functionality.

```typescript
// src/ui/InputArea.ts
import { EventBus } from '../core/EventBus';

export class InputArea {
  private containerEl: HTMLElement;
  private eventBus: EventBus;
  private textareaEl: HTMLTextAreaElement;
  private buttonEl: HTMLButtonElement;
  private enabled: boolean = true;
  
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
    
    // Create button
    this.buttonEl = this.containerEl.createEl('button', {
      cls: 'chatsidian-send-button',
      text: 'Send'
    });
  }
  
  private setupEventListeners(): void {
    // Handle textarea input for autogrow
    this.textareaEl.addEventListener('input', () => {
      this.autoGrow();
    });
    
    // Handle key press
    this.textareaEl.addEventListener('keydown', (event) => {
      // Submit on Enter (without Shift)
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.submit();
      }
    });
    
    // Handle button click
    this.buttonEl.addEventListener('click', () => {
      this.submit();
    });
  }
  
  private autoGrow(): void {
    // Reset height to auto to get correct scrollHeight
    this.textareaEl.style.height = 'auto';
    
    // Set height to scrollHeight to fit content
    this.textareaEl.style.height = (this.textareaEl.scrollHeight) + 'px';
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
    
    // Emit event
    this.eventBus.emit('input:submit', value);
    
    // Clear input
    this.textareaEl.value = '';
    
    // Reset height
    this.textareaEl.style.height = 'auto';
    
    // Focus textarea
    this.textareaEl.focus();
  }
  
  public setValue(value: string): void {
    this.textareaEl.value = value;
    this.autoGrow();
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
    this.buttonEl.disabled = !enabled;
    
    if (enabled) {
      this.containerEl.removeClass('chatsidian-input-disabled');
    } else {
      this.containerEl.addClass('chatsidian-input-disabled');
    }
  }
}
```


### ConversationSelector

The ConversationSelector component allows users to select existing conversations.

```typescript
// src/ui/ConversationSelector.ts
import { EventBus } from '../core/EventBus';
import { StorageManager } from '../core/StorageManager';
import { Conversation } from '../models/Conversation';

export class ConversationSelector {
  private containerEl: HTMLElement;
  private eventBus: EventBus;
  private storage: StorageManager;
  private selectEl: HTMLSelectElement;
  private activeConversationId: string | null = null;
  private conversations: Conversation[] = [];
  
  constructor(containerEl: HTMLElement, eventBus: EventBus, storage: StorageManager) {
    this.containerEl = containerEl;
    this.eventBus = eventBus;
    this.storage = storage;
    
    // Initialize UI
    this.initializeUI();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Load conversations
    this.loadConversations();
  }
  
  private initializeUI(): void {
    // Clear container
    this.containerEl.empty();
    this.containerEl.addClass('chatsidian-conversation-selector');
    
    // Create select element
    this.selectEl = this.containerEl.createEl('select', {
      cls: 'chatsidian-conversation-select'
    });
    
    // Add placeholder option
    const placeholderOption = this.selectEl.createEl('option', {
      text: 'Select conversation',
      value: ''
    });
    placeholderOption.disabled = true;
    placeholderOption.selected = true;
  }
  
  private setupEventListeners(): void {
    // Handle select change
    this.selectEl.addEventListener('change', () => {
      const conversationId = this.selectEl.value;
      
      if (conversationId) {
        this.eventBus.emit('conversation:selected', conversationId);
      }
    });
    
    // Listen for conversation changes
    this.eventBus.on('conversation:created', (conversation: Conversation) => {
      this.addConversation(conversation);
      this.setActiveConversation(conversation.id);
    });
    
    this.eventBus.on('conversation:updated', (conversation: Conversation) => {
      this.updateConversation(conversation);
    });
    
    this.eventBus.on('conversation:deleted', (conversationId: string) => {
      this.removeConversation(conversationId);
    });
  }
  
  private async loadConversations(): Promise<void> {
    // Get conversations from storage
    this.conversations = await this.storage.getConversations();
    
    // Clear options (except placeholder)
    while (this.selectEl.options.length > 1) {
      this.selectEl.remove(1);
    }
    
    // Add options for each conversation
    for (const conversation of this.conversations) {
      this.addConversationOption(conversation);
    }
  }
  
  private addConversationOption(conversation: Conversation): void {
    // Create option
    const option = document.createElement('option');
    option.value = conversation.id;
    option.textContent = conversation.title;
    option.dataset.conversationId = conversation.id;
    
    // Add to select
    this.selectEl.appendChild(option);
  }
  
  public setActiveConversation(conversationId: string): void {
    this.activeConversationId = conversationId;
    this.selectEl.value = conversationId;
  }
  
  private addConversation(conversation: Conversation): void {
    // Check if already exists
    const existing = this.conversations.find(c => c.id === conversation.id);
    
    if (!existing) {
      // Add to list
      this.conversations.push(conversation);
      
      // Add option
      this.addConversationOption(conversation);
    }
  }
  
  private updateConversation(conversation: Conversation): void {
    // Update in list
    const index = this.conversations.findIndex(c => c.id === conversation.id);
    
    if (index !== -1) {
      this.conversations[index] = conversation;
      
      // Update option
      const option = this.selectEl.querySelector(`option[data-conversation-id="${conversation.id}"]`);
      
      if (option) {
        option.textContent = conversation.title;
      }
    }
  }
  
  private removeConversation(conversationId: string): void {
    // Remove from list
    this.conversations = this.conversations.filter(c => c.id !== conversationId);
    
    // Remove option
    const option = this.selectEl.querySelector(`option[data-conversation-id="${conversationId}"]`);
    
    if (option) {
      option.remove();
    }
    
    // Reset active conversation if it was removed
    if (this.activeConversationId === conversationId) {
      this.activeConversationId = null;
      this.selectEl.value = '';
    }
  }
}
```

### ModelSelector

The ModelSelector component allows users to select different AI models.

```typescript
// src/ui/ModelSelector.ts
import { EventBus } from '../core/EventBus';
import { ModelManager, Model } from '../mcp/ModelManager';

export class ModelSelector {
  private containerEl: HTMLElement;
  private eventBus: EventBus;
  private modelManager: ModelManager;
  private selectEl: HTMLSelectElement;
  private activeModelId: string | null = null;
  private models: Model[] = [];
  
  constructor(containerEl: HTMLElement, eventBus: EventBus, modelManager: ModelManager) {
    this.containerEl = containerEl;
    this.eventBus = eventBus;
    this.modelManager = modelManager;
    
    // Initialize UI
    this.initializeUI();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Load models
    this.loadModels();
  }
  
  private initializeUI(): void {
    // Clear container
    this.containerEl.empty();
    this.containerEl.addClass('chatsidian-model-selector');
    
    // Create select element
    this.selectEl = this.containerEl.createEl('select', {
      cls: 'chatsidian-model-select'
    });
    
    // Add default option
    const defaultOption = this.selectEl.createEl('option', {
      text: 'Default Model',
      value: ''
    });
  }
  
  private setupEventListeners(): void {
    // Handle select change
    this.selectEl.addEventListener('change', () => {
      const modelId = this.selectEl.value;
      
      // Emit event with null for default model
      this.eventBus.emit('model:selected', modelId || null);
      
      // Update active model
      this.activeModelId = modelId || null;
    });
    
    // Listen for model changes
    this.eventBus.on('model:created', (model: Model) => {
      this.addModel(model);
    });
    
    this.eventBus.on('model:updated', (model: Model) => {
      this.updateModel(model);
    });
    
    this.eventBus.on('model:deleted', (modelId: string) => {
      this.removeModel(modelId);
    });
  }
  
  private loadModels(): void {
    // Get models from manager
    this.models = this.modelManager.getModels();
    
    // Add options for each model
    for (const model of this.models) {
      this.addModelOption(model);
    }
  }
  
  private addModelOption(model: Model): void {
    // Create option
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.name;
    option.dataset.modelId = model.id;
    
    // Add to select
    this.selectEl.appendChild(option);
  }
  
  public setActiveModel(modelId: string | null): void {
    this.activeModelId = modelId;
    this.selectEl.value = modelId || '';
  }
  
  private addModel(model: Model): void {
    // Check if already exists
    const existing = this.models.find(m => m.id === model.id);
    
    if (!existing) {
      // Add to list
      this.models.push(model);
      
      // Add option
      this.addModelOption(model);
    }
  }
  
  private updateModel(model: Model): void {
    // Update in list
    const index = this.models.findIndex(m => m.id === model.id);
    
    if (index !== -1) {
      this.models[index] = model;
      
      // Update option
      const option = this.selectEl.querySelector(`option[data-model-id="${model.id}"]`);
      
      if (option) {
        option.textContent = model.name;
      }
    }
  }
  
  private removeModel(modelId: string): void {
    // Remove from list
    this.models = this.models.filter(m => m.id !== modelId);
    
    // Remove option
    const option = this.selectEl.querySelector(`option[data-model-id="${modelId}"]`);
    
    if (option) {
      option.remove();
    }
    
    // Reset active model if it was removed
    if (this.activeModelId === modelId) {
      this.activeModelId = null;
      this.selectEl.value = '';
      
      // Emit event
      this.eventBus.emit('model:selected', null);
    }
  }
}
```

### AgentSelector

The AgentSelector component allows users to select different agents.

```typescript
// src/ui/AgentSelector.ts
import { EventBus } from '../core/EventBus';
import { AgentManager, Agent } from '../mcp/AgentManager';

export class AgentSelector {
  private containerEl: HTMLElement;
  private eventBus: EventBus;
  private agentManager: AgentManager;
  private selectEl: HTMLSelectElement;
  private activeAgentId: string | null = null;
  private agents: Agent[] = [];
  
  constructor(containerEl: HTMLElement, eventBus: EventBus, agentManager: AgentManager) {
    this.containerEl = containerEl;
    this.eventBus = eventBus;
    this.agentManager = agentManager;
    
    // Initialize UI
    this.initializeUI();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Load agents
    this.loadAgents();
  }
  
  private initializeUI(): void {
    // Clear container
    this.containerEl.empty();
    this.containerEl.addClass('chatsidian-agent-selector');
    
    // Create select element
    this.selectEl = this.containerEl.createEl('select', {
      cls: 'chatsidian-agent-select'
    });
    
    // Add default option
    const defaultOption = this.selectEl.createEl('option', {
      text: 'Default Assistant',
      value: ''
    });
  }
  
  private setupEventListeners(): void {
    // Handle select change
    this.selectEl.addEventListener('change', () => {
      const agentId = this.selectEl.value;
      
      // Emit event with null for default agent
      this.eventBus.emit('agent:selected', agentId || null);
      
      // Update active agent
      this.activeAgentId = agentId || null;
    });
    
    // Listen for agent changes
    this.eventBus.on('agent:created', (agent: Agent) => {
      this.addAgent(agent);
    });
    
    this.eventBus.on('agent:updated', (agent: Agent) => {
      this.updateAgent(agent);
    });
    
    this.eventBus.on('agent:deleted', (agentId: string) => {
      this.removeAgent(agentId);
    });
  }
  
  private loadAgents(): void {
    // Get agents from manager
    this.agents = this.agentManager.getAgents();
    
    // Add options for each agent
    for (const agent of this.agents) {
      this.addAgentOption(agent);
    }
  }
  
  private addAgentOption(agent: Agent): void {
    // Create option
    const option = document.createElement('option');
    option.value = agent.id;
    option.textContent = agent.name;
    option.dataset.agentId = agent.id;
    
    // Add to select
    this.selectEl.appendChild(option);
  }
  
  public setActiveAgent(agentId: string | null): void {
    this.activeAgentId = agentId;
    this.selectEl.value = agentId || '';
  }
  
  private addAgent(agent: Agent): void {
    // Check if already exists
    const existing = this.agents.find(a => a.id === agent.id);
    
    if (!existing) {
      // Add to list
      this.agents.push(agent);
      
      // Add option
      this.addAgentOption(agent);
    }
  }
  
  private updateAgent(agent: Agent): void {
    // Update in list
    const index = this.agents.findIndex(a => a.id === agent.id);
    
    if (index !== -1) {
      this.agents[index] = agent;
      
      // Update option
      const option = this.selectEl.querySelector(`option[data-agent-id="${agent.id}"]`);
      
      if (option) {
        option.textContent = agent.name;
      }
    }
  }
  
  private removeAgent(agentId: string): void {
    // Remove from list
    this.agents = this.agents.filter(a => a.id !== agentId);
    
    // Remove option
    const option = this.selectEl.querySelector(`option[data-agent-id="${agentId}"]`);
    
    if (option) {
      option.remove();
    }
    
    // Reset active agent if it was removed
    if (this.activeAgentId === agentId) {
      this.activeAgentId = null;
      this.selectEl.value = '';
      
      // Emit event
      this.eventBus.emit('agent:selected', null);
    }
  }
}
```

### ConversationSidebar

The ConversationSidebar component provides a panel for browsing and organizing conversations.

```typescript
// src/ui/ConversationSidebar.ts
import { EventBus } from '../core/EventBus';
import { StorageManager } from '../core/StorageManager';
import { Conversation, ConversationFolder } from '../models/Conversation';
import { setIcon, Notice, Menu, Modal } from 'obsidian';

export class ConversationSidebar {
  private containerEl: HTMLElement;
  private eventBus: EventBus;
  private storage: StorageManager;
  private app: App;
  
  private starredSectionEl: HTMLElement;
  private foldersSectionEl: HTMLElement;
  private conversationsSectionEl: HTMLElement;
  
  private conversations: Conversation[] = [];
  private folders: ConversationFolder[] = [];
  
  constructor(containerEl: HTMLElement, eventBus: EventBus, storage: StorageManager, app: App) {
    this.containerEl = containerEl;
    this.eventBus = eventBus;
    this.storage = storage;
    this.app = app;
    
    // Initialize UI
    this.initializeUI();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Load data
    this.loadData();
  }
  
  // Additional methods as previously defined
}
```

### CSS Styling

The UI uses Obsidian's native CSS variables for consistent theming and appearance:

```css
/* src/styles.css */

/* Main container */
.chatsidian-container {
  display: flex;
  height: 100%;
  overflow: hidden;
  background-color: var(--background-primary);
  color: var(--text-normal);
  font-size: var(--font-text-size);
  line-height: var(--line-height);
}

/* Sidebar */
.chatsidian-sidebar-container {
  width: 250px;
  border-right: 1px solid var(--background-modifier-border);
  display: none;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
}

.chatsidian-container.chatsidian-sidebar-open .chatsidian-sidebar-container {
  display: flex;
}

.chatsidian-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 8px;
}

.chatsidian-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--background-modifier-border);
}

.chatsidian-sidebar-title {
  font-size: 1.1em;
  font-weight: 600;
}

.chatsidian-sidebar-action {
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  color: var(--text-muted);
}

.chatsidian-sidebar-action:hover {
  color: var(--text-normal);
  background-color: var(--background-modifier-hover);
}

/* Sidebar sections */
.chatsidian-section-wrapper {
  margin-bottom: 16px;
}

.chatsidian-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  color: var(--text-muted);
  font-size: 0.85em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.chatsidian-section-title {
  margin: 0;
}

.chatsidian-empty-section {
  color: var(--text-muted);
  font-style: italic;
  font-size: 0.9em;
  padding: 8px;
  text-align: center;
}

/* Conversation and folder items */
.chatsidian-conversation-item, .chatsidian-folder-header {
  display: flex;
  align-items: center;
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  position: relative;
  margin-bottom: 2px;
}

.chatsidian-conversation-item:hover, .chatsidian-folder-header:hover {
  background-color: var(--background-modifier-hover);
}

.chatsidian-conversation-item.chatsidian-active {
  background-color: var(--background-modifier-hover);
  font-weight: 500;
}

.chatsidian-folder-item {
  margin-bottom: 4px;
}

.chatsidian-folder-toggle {
  margin-right: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.chatsidian-folder-content {
  margin-left: 24px;
  transition: max-height 0.2s ease, opacity 0.2s ease;
}

.chatsidian-folder-content.chatsidian-collapsed {
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  margin-bottom: 0;
}

.chatsidian-folder-content.chatsidian-expanded {
  max-height: 1000px;
  opacity: 1;
  margin-top: 4px;
}

.chatsidian-item-icon {
  margin-right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.chatsidian-item-title {
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.95em;
}

.chatsidian-item-actions {
  display: none;
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background-color: var(--background-primary);
  border-radius: 4px;
}

.chatsidian-conversation-item:hover .chatsidian-item-actions,
.chatsidian-folder-header:hover .chatsidian-item-actions {
  display: flex;
}

.chatsidian-item-action {
  padding: 4px;
  cursor: pointer;
  color: var(--text-muted);
  border-radius: 4px;
  margin-left: 2px;
}

.chatsidian-item-action:hover {
  background-color: var(--background-modifier-hover);
  color: var(--text-normal);
}

.chatsidian-item-action.chatsidian-starred {
  color: var(--text-accent);
}

/* Drag and drop */
.chatsidian-dragging {
  opacity: 0.5;
}

.chatsidian-drop-target {
  background-color: var(--background-modifier-hover);
  border: 1px dashed var(--text-accent);
  border-radius: 4px;
}

/* Content container */
.chatsidian-content-container {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* Hamburger menu button */
.chatsidian-hamburger-toggle {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 6px;
  cursor: pointer;
  border-radius: 4px;
  z-index: 10;
  color: var(--text-muted);
}

.chatsidian-hamburger-toggle:hover {
  background-color: var(--background-modifier-hover);
  color: var(--text-normal);
}

/* Header */
.chatsidian-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 12px 12px 42px; /* Extra left padding for hamburger */
  border-bottom: 1px solid var(--background-modifier-border);
  background-color: var(--background-primary);
  z-index: 5;
}

/* Selectors */
.chatsidian-conversation-selector,
.chatsidian-model-selector,
.chatsidian-agent-selector {
  margin-right: 8px;
}

.chatsidian-conversation-select,
.chatsidian-model-select,
.chatsidian-agent-select {
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--background-modifier-border);
  background-color: var(--background-primary);
  color: var(--text-normal);
  font-size: 0.9em;
  max-width: 180px;
  min-width: 120px;
}

.chatsidian-conversation-select:focus,
.chatsidian-model-select:focus,
.chatsidian-agent-select:focus {
  border-color: var(--interactive-accent);
  outline: none;
}

/* Action buttons in header */
.chatsidian-actions {
  display: flex;
  align-items: center;
}

.chatsidian-action-button {
  cursor: pointer;
  padding: 6px;
  border-radius: 4px;
  margin-left: 4px;
  color: var(--text-muted);
}

.chatsidian-action-button:hover {
  background-color: var(--background-modifier-hover);
  color: var(--text-normal);
}

.chatsidian-action-button.chatsidian-starred {
  color: var(--text-accent);
}

/* Message area */
.chatsidian-message-area {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Messages list */
.chatsidian-messages {
  flex-grow: 1;
  overflow-y: auto;
  padding: 16px;
}

/* Message container */
.chatsidian-message {
  margin-bottom: 16px;
  position: relative;
  display: flex;
  flex-direction: column;
}

.chatsidian-message-user {
  align-items: flex-end;
}

.chatsidian-message-assistant {
  align-items: flex-start;
}

.chatsidian-message-system {
  align-items: center;
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
  max-width: 80%;
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

/* Message actions */
.chatsidian-message-actions {
  position: absolute;
  top: 0;
  right: 0;
  transform: translateY(-50%);
  display: none;
  background-color: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  padding: 2px;
  z-index: 10;
}

.chatsidian-message-bubble:hover .chatsidian-message-actions {
  display: flex;
}

.chatsidian-message-action {
  cursor: pointer;
  padding: 4px;
  color: var(--text-muted);
  border-radius: 4px;
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

/* Input area */
.chatsidian-input {
  padding: 12px;
  border-top: 1px solid var(--background-modifier-border);
  background-color: var(--background-primary);
}

.chatsidian-input-area {
  display: flex;
  align-items: flex-end;
}

.chatsidian-textarea-container {
  flex-grow: 1;
  margin-right: 8px;
}

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
  max-height: 150px;
  overflow-y: auto;
}

.chatsidian-textarea:focus {
  outline: none;
  border-color: var(--interactive-accent);
}

.chatsidian-send-button {
  padding: 8px 16px;
  border-radius: 12px;
  background-color: var(--interactive-accent);
  color: var(--text-on-accent);
  border: none;
  cursor: pointer;
  font-weight: 500;
  height: 34px;
}

.chatsidian-send-button:hover {
  background-color: var(--interactive-accent-hover);
}

.chatsidian-send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chatsidian-input-disabled .chatsidian-textarea {
  background-color: var(--background-modifier-border);
  cursor: not-allowed;
}

/* Tool calls */
.chatsidian-tool-calls {
  margin-top: 8px;
  border-radius: 8px;
  border: 1px solid var(--background-modifier-border);
  overflow: hidden;
}

.chatsidian-tool-call {
  margin-bottom: 8px;
  border-radius: 4px;
  overflow: hidden;
}

.chatsidian-tool-call:last-child {
  margin-bottom: 0;
}

.chatsidian-tool-call-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background-color: var(--background-modifier-form-field);
  border-bottom: 1px solid var(--background-modifier-border);
  font-size: 0.9em;
}

.chatsidian-tool-name {
  font-weight: 500;
}

.chatsidian-tool-status {
  font-size: 0.8em;
  border-radius: 4px;
  padding: 2px 6px;
}

.chatsidian-tool-status-pending {
  background-color: var(--text-muted);
  color: var(--background-primary);
}

.chatsidian-tool-status-running {
  background-color: var(--text-accent);
  color: var(--background-primary);
}

.chatsidian-tool-status-done {
  background-color: var(--color-green);
  color: var(--background-primary);
}

.chatsidian-tool-status-error {
  background-color: var(--text-error);
  color: var(--background-primary);
}

.chatsidian-tool-arguments, 
.chatsidian-tool-result-content {
  padding: 8px;
  background-color: var(--code-background);
  overflow-x: auto;
  font-size: 0.9em;
}

.chatsidian-tool-arguments pre,
.chatsidian-tool-result-content pre {
  margin: 0;
}

.chatsidian-tool-result {
  border-top: 1px dashed var(--background-modifier-border);
}

.chatsidian-tool-result-error {
  background-color: var(--background-modifier-error);
}

.chatsidian-tool-error {
  padding: 8px;
  color: var(--text-error);
  font-weight: 500;
}

.chatsidian-tool-call-placeholder {
  padding: 8px;
  color: var(--text-muted);
  font-style: italic;
  text-align: center;
}

/* Modal dialogs */
.chatsidian-warning {
  color: var(--text-error);
  margin-bottom: 16px;
}

.chatsidian-input {
  width: 100%;
  padding: 8px;
  margin-bottom: 16px;
  border-radius: 4px;
  border: 1px solid var(--background-modifier-border);
  background-color: var(--background-modifier-form-field);
}

.chatsidian-button-container {
  display: flex;
  justify-content: flex-end;
}

.chatsidian-button {
  padding: 6px 12px;
  border-radius: 4px;
  margin-left: 8px;
  cursor: pointer;
  border: none;
  font-weight: 500;
}

.chatsidian-button-primary {
  background-color: var(--interactive-accent);
  color: var(--text-on-accent);
}

.chatsidian-button-secondary {
  background-color: var(--background-modifier-form-field);
  color: var(--text-normal);
}

.chatsidian-button-danger {
  background-color: var(--text-error);
  color: white;
}

.chatsidian-separator {
  height: 1px;
  background-color: var(--background-modifier-border);
  margin: 8px 0;
}

.chatsidian-folder-option {
  padding: 8px;
  cursor: pointer;
  border-radius: 4px;
}

.chatsidian-folder-option:hover {
  background-color: var(--background-modifier-hover);
}
```

## Agent Settings Implementation

The plugin will include settings to configure which tools are available to each agent:

```typescript
// src/settings/AgentToolSettings.ts
import { App, PluginSettingTab, Setting } from 'obsidian';
import { ChatsidianPlugin } from '../main';
import { AgentManager, Agent } from '../mcp/AgentManager';

export class AgentToolSettingsTab extends PluginSettingTab {
  private plugin: ChatsidianPlugin;
  private agentManager: AgentManager;
  
  constructor(app: App, plugin: ChatsidianPlugin, agentManager: AgentManager) {
    super(app, plugin);
    this.plugin = plugin;
    this.agentManager = agentManager;
  }
  
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    
    containerEl.createEl('h2', { text: 'Agent Tool Settings' });
    
    // Get all agents
    const agents = this.agentManager.getAgents();
    
    // Get all available tools
    const availableTools = [
      { id: 'noteReader', name: 'Note Reader' },
      { id: 'noteEditor', name: 'Note Editor' },
      { id: 'vaultManager', name: 'Vault Manager' },
      { id: 'vaultLibrarian', name: 'Vault Librarian' },
      { id: 'paletteCommander', name: 'Palette Commander' },
      { id: 'projectManager', name: 'Project Manager' }
    ];
    
    // Show settings for each agent
    for (const agent of agents) {
      containerEl.createEl('h3', { text: agent.name });
      
      // Create setting for each tool
      for (const tool of availableTools) {
        new Setting(containerEl)
          .setName(tool.name)
          .setDesc(`Allow ${agent.name} to use the ${tool.name} tool`)
          .addToggle(toggle => {
            toggle
              .setValue(this.agentHasTool(agent, tool.id))
              .onChange(async (value) => {
                await this.updateAgentTool(agent, tool.id, value);
              });
          });
      }
      
      containerEl.createEl('hr');
    }
  }
  
  private agentHasTool(agent: Agent, toolId: string): boolean {
    return agent.tools?.includes(toolId) || false;
  }
  
  private async updateAgentTool(agent: Agent, toolId: string, enabled: boolean): Promise<void> {
    // Initialize tools array if not exists
    if (!agent.tools) {
      agent.tools = [];
    }
    
    if (enabled && !agent.tools.includes(toolId)) {
      // Add tool
      agent.tools.push(toolId);
    } else if (!enabled && agent.tools.includes(toolId)) {
      // Remove tool
      agent.tools = agent.tools.filter(id => id !== toolId);
    }
    
    // Save agent
    await this.agentManager.saveAgent(agent);
  }
}
```

## Component Integration and Configuration

The plugin's main file will integrate all components and provide configuration options:

```typescript
// src/main.ts
import { Plugin, WorkspaceLeaf } from 'obsidian';
import { EventBus } from './core/EventBus';
import { StorageManager } from './core/StorageManager';
import { MCPClient } from './mcp/MCPClient';
import { AgentManager } from './mcp/AgentManager';
import { ModelManager } from './mcp/ModelManager';
import { ChatView, CHAT_VIEW_TYPE } from './ui/ChatView';
import { AgentToolSettingsTab } from './settings/AgentToolSettings';

export default class ChatsidianPlugin extends Plugin {
  private eventBus: EventBus;
  private storage: StorageManager;
  private mcpClient: MCPClient;
  private agentManager: AgentManager;
  private modelManager: ModelManager;
  
  async onload() {
    // Initialize services
    this.eventBus = new EventBus();
    this.storage = new StorageManager(this);
    this.agentManager = new AgentManager(this.app, this);
    this.modelManager = new ModelManager(this.app, this);
    this.mcpClient = new MCPClient(this.app, this);
    
    // Register views
    this.registerView(
      CHAT_VIEW_TYPE,
      (leaf) => new ChatView(
        leaf,
        this.eventBus,
        this.storage,
        this.mcpClient,
        this.agentManager,
        this.modelManager
      )
    );
    
    // Add settings tab
    this.addSettingTab(new AgentToolSettingsTab(
      this.app,
      this,
      this.agentManager
    ));
    
    // Add ribbon icon
    this.addRibbonIcon('message-square', 'Open Chatsidian', () => {
      this.activateView();
    });
    
    // Add command
    this.addCommand({
      id: 'open-chatsidian',
      name: 'Open Chatsidian Chat Interface',
      callback: () => {
        this.activateView();
      }
    });
  }
  
  async onunload() {
    // Clean up resources
  }
  
  async activateView() {
    const { workspace } = this.app;
    
    // Check if view is already open
    let leaf = workspace.getLeavesOfType(CHAT_VIEW_TYPE)[0];
    
    if (!leaf) {
      // Create new leaf in right split
      leaf = workspace.getRightLeaf(false);
      await leaf.setViewState({
        type: CHAT_VIEW_TYPE,
        active: true
      });
    }
    
    // Reveal leaf
    workspace.revealLeaf(leaf);
  }
}
```
