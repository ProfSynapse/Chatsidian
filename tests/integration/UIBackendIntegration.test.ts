/**
 * UI/Backend Integration Tests
 * 
 * This file contains integration tests for the UI components and backend services,
 * specifically focusing on the integration between ChatView and StorageManager for
 * conversation persistence.
 * 
 * @file This file tests the integration between UI components and backend services.
 */

import { CHAT_VIEW_TYPE } from '../../src/ui/ChatView';
import { ConversationListEventType } from '../../src/ui/ConversationList';
import { InputAreaEventType } from '../../src/ui/InputArea';
import { MockConversationList } from '../mocks/MockConversationList';
import { EventBus } from '../../src/core/EventBus';
import { StorageManager } from '../../src/core/StorageManager';
import { Conversation, ConversationUtils, Message, MessageRole } from '../../src/models/Conversation';
import { Component } from '../../tests/mocks/obsidian';

// Mock Obsidian API
jest.mock('obsidian', () => {
  // Import the actual mocks
  const actualMocks = jest.requireActual('../../tests/mocks/obsidian');
  
  return {
    ...actualMocks
  };
});

// Add Obsidian-specific methods to HTMLElement for testing
declare global {
  interface HTMLElement {
    empty(): HTMLElement;
    createDiv(options?: { cls?: string, text?: string }): HTMLDivElement;
    createSpan(options?: { cls?: string, text?: string }): HTMLSpanElement;
    setText(text: string): HTMLElement;
    addClass(className: string): HTMLElement;
  }
}

// Implement the methods
HTMLElement.prototype.empty = function() {
  while (this.firstChild) {
    this.removeChild(this.firstChild);
  }
  return this;
};

HTMLElement.prototype.createDiv = function(options?: { cls?: string, text?: string }) {
  const div = document.createElement('div');
  if (options?.cls) {
    div.className = options.cls;
  }
  if (options?.text) {
    div.textContent = options.text;
  }
  this.appendChild(div);
  return div;
};

HTMLElement.prototype.createSpan = function(options?: { cls?: string, text?: string }) {
  const span = document.createElement('span');
  if (options?.cls) {
    span.className = options.cls;
  }
  if (options?.text) {
    span.textContent = options.text;
  }
  this.appendChild(span);
  return span;
};

HTMLElement.prototype.setText = function(text: string) {
  this.textContent = text;
  return this;
};

HTMLElement.prototype.addClass = function(className: string) {
  this.classList.add(className);
  return this;
};

// Mock ChatView for testing
class MockChatView extends Component {
  private eventBus: EventBus;
  private storageManager: StorageManager;
  private activeConversation: Conversation | null = null;
  containerEl: HTMLElement;
  
  constructor(containerEl: HTMLElement, eventBus: EventBus, storageManager: StorageManager) {
    super();
    this.containerEl = containerEl;
    this.eventBus = eventBus;
    this.storageManager = storageManager;
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
    // Clear container
    this.containerEl.empty();
    this.containerEl.addClass('chatsidian-container');
    
    // Create main layout - sidebar and content
    const sidebarContainerEl = this.containerEl.createDiv({ cls: 'chatsidian-sidebar-container' });
    const contentContainerEl = this.containerEl.createDiv({ cls: 'chatsidian-content-container' });
    
    // Create hamburger menu toggle for sidebar
    const hamburgerEl = contentContainerEl.createDiv({ 
      cls: 'chatsidian-hamburger-toggle' 
    });
    hamburgerEl.innerHTML = '<svg viewBox="0 0 100 80" width="20" height="20"><rect width="100" height="15"></rect><rect y="30" width="100" height="15"></rect><rect y="60" width="100" height="15"></rect></svg>';
    hamburgerEl.addEventListener('click', () => this.toggleSidebar());
    
    // Create header
    const headerEl = contentContainerEl.createDiv({ cls: 'chatsidian-header' });
    headerEl.setText('Chatsidian Chat Interface');
    
    // Create message area
    contentContainerEl.createDiv({ cls: 'chatsidian-message-area' });
    
    // Register event handlers
    this.registerEventHandlers();
    
    return Promise.resolve();
  }
  
  setActiveConversation(conversation: Conversation): void {
    this.activeConversation = conversation;
    
    // Update the header with the conversation title
    const headerEl = this.containerEl.querySelector('.chatsidian-header');
    if (headerEl) {
      headerEl.textContent = conversation.title;
    }
  }
  
  async addMessage(message: Message): Promise<void> {
    if (!this.activeConversation) {
      return;
    }
    
    try {
      // Add the message to the conversation using StorageManager
      this.activeConversation = await this.storageManager.addMessage(
        this.activeConversation.id,
        message
      );
    } catch (error) {
      console.error('Failed to add message to conversation:', error);
    }
  }
  
  private registerEventHandlers(): void {
    // Listen for conversation selection events
    this.registerEvent(
      this.eventBus.on(ConversationListEventType.CONVERSATION_SELECTED, (conversation: Conversation) => {
        this.setActiveConversation(conversation);
      })
    );
    
    // Listen for message submitted events from the input area
    this.registerEvent(
      this.eventBus.on(InputAreaEventType.MESSAGE_SUBMITTED, async (message: Message) => {
        // Add the user message to the conversation
        this.addMessage(message);
      })
    );
  }
  
  private toggleSidebar(): void {
    this.containerEl.classList.toggle('chatsidian-sidebar-open');
  }
}

// Mock StorageManager with tracking for method calls
class MockStorageManager {
  // Mock properties
  app: any = {};
  plugin: any = {};
  settings: any = {};
  eventBus: EventBus = new EventBus();
  vaultFacade: any = {};
  
  // Test-specific properties
  conversations: Conversation[] = [];
  methodCalls: Record<string, any[]> = {
    getConversations: [],
    getConversation: [],
    createConversation: [],
    saveConversation: [],
    deleteConversation: [],
    addMessage: [],
    updateMessage: [],
    renameConversation: []
  };
  
  async initialize() { 
    return; 
  }
  
  async getConversations() { 
    this.methodCalls.getConversations.push([]);
    return [...this.conversations]; 
  }
  
  async getConversation(id: string) { 
    this.methodCalls.getConversation.push([id]);
    return this.conversations.find(c => c.id === id) || null; 
  }
  
  async createConversation(title = 'New Conversation') { 
    this.methodCalls.createConversation.push([title]);
    const conversation = ConversationUtils.createNew(title);
    this.conversations.push(conversation);
    return conversation;
  }
  
  async saveConversation(conversation: Conversation) { 
    this.methodCalls.saveConversation.push([conversation]);
    const index = this.conversations.findIndex(c => c.id === conversation.id);
    if (index >= 0) {
      this.conversations[index] = conversation;
    } else {
      this.conversations.push(conversation);
    }
    return;
  }
  
  async deleteConversation(id: string) { 
    this.methodCalls.deleteConversation.push([id]);
    const index = this.conversations.findIndex(c => c.id === id);
    if (index >= 0) {
      this.conversations.splice(index, 1);
    }
    return;
  }
  
  async addMessage(conversationId: string, message: Message) { 
    this.methodCalls.addMessage.push([conversationId, message]);
    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    
    const updatedConversation = ConversationUtils.addMessage(conversation, message);
    await this.saveConversation(updatedConversation);
    return updatedConversation;
  }
  
  async updateMessage(conversationId: string, messageId: string, content: string) { 
    this.methodCalls.updateMessage.push([conversationId, messageId, content]);
    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    
    const messageIndex = conversation.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) {
      throw new Error(`Message not found: ${messageId}`);
    }
    
    const updatedConversation = {
      ...conversation,
      messages: [...conversation.messages],
      modifiedAt: Date.now()
    };
    
    updatedConversation.messages[messageIndex] = {
      ...updatedConversation.messages[messageIndex],
      content
    };
    
    await this.saveConversation(updatedConversation);
    return updatedConversation;
  }
  
  async renameConversation(conversationId: string, newTitle: string) { 
    this.methodCalls.renameConversation.push([conversationId, newTitle]);
    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    
    const updatedConversation = {
      ...conversation,
      title: newTitle,
      modifiedAt: Date.now()
    };
    
    await this.saveConversation(updatedConversation);
    return updatedConversation;
  }
  
  // Helper method to reset tracking
  resetTracking() {
    Object.keys(this.methodCalls).forEach(key => {
      this.methodCalls[key] = [];
    });
  }
}

// Mock WorkspaceLeaf for testing
class MockWorkspaceLeaf {
  containerEl: HTMLElement;
  
  constructor() {
    this.containerEl = document.createElement('div');
  }
  
  getViewType(): string {
    return CHAT_VIEW_TYPE;
  }
}

describe('UI/Backend Integration', () => {
  let chatView: MockChatView;
  let containerEl: HTMLElement;
  let eventBus: EventBus;
  let storageManager: MockStorageManager;
  
  beforeEach(() => {
    // Create a mock DOM environment
    document.body.innerHTML = '<div id="app"></div>';
    
    // Create mocks
    containerEl = document.createElement('div');
    eventBus = new EventBus();
    storageManager = new MockStorageManager();
    
    // Reset tracking
    storageManager.resetTracking();
    
    // Create the view with type assertion
    chatView = new MockChatView(containerEl, eventBus, storageManager as unknown as StorageManager);
  });
  
  afterEach(() => {
    // Clean up
    document.body.innerHTML = '';
  });
  
  test('ChatView initializes and opens correctly', async () => {
    await chatView.onOpen();
    
    // Check that the container has the correct class
    expect(containerEl.classList.contains('chatsidian-container')).toBe(true);
    
    // Check that the sidebar container exists
    const sidebarContainer = containerEl.querySelector('.chatsidian-sidebar-container');
    expect(sidebarContainer).not.toBeNull();
    
    // Check that the content container exists
    const contentContainer = containerEl.querySelector('.chatsidian-content-container');
    expect(contentContainer).not.toBeNull();
  });
  
  test('ChatView sets active conversation correctly', async () => {
    await chatView.onOpen();
    
    // Create a test conversation
    const conversation = await storageManager.createConversation('Test Conversation');
    
    // Set as active conversation
    chatView.setActiveConversation(conversation);
    
    // Check that the header was updated
    const headerEl = containerEl.querySelector('.chatsidian-header');
    expect(headerEl?.textContent).toBe('Test Conversation');
  });
  
  test('ChatView adds message to active conversation using StorageManager', async () => {
    await chatView.onOpen();
    
    // Create a test conversation
    const conversation = await storageManager.createConversation('Test Conversation');
    
    // Set as active conversation
    chatView.setActiveConversation(conversation);
    
    // Create a test message
    const message = ConversationUtils.createMessage(MessageRole.User, 'Test message');
    
    // Add message to conversation
    await chatView.addMessage(message);
    
    // Check that StorageManager.addMessage was called with correct parameters
    expect(storageManager.methodCalls.addMessage.length).toBe(1);
    expect(storageManager.methodCalls.addMessage[0][0]).toBe(conversation.id);
    expect(storageManager.methodCalls.addMessage[0][1]).toBe(message);
    
    // Check that the message was added to the conversation
    const updatedConversation = await storageManager.getConversation(conversation.id);
    expect(updatedConversation?.messages.length).toBe(1);
    expect(updatedConversation?.messages[0].content).toBe('Test message');
  });
  
  test('ConversationList loads conversations from StorageManager', async () => {
    // Create a container for the conversation list
    const containerEl = document.createElement('div');
    document.body.appendChild(containerEl);
    
    // Create a test conversation
    await storageManager.createConversation('Test Conversation 1');
    await storageManager.createConversation('Test Conversation 2');
    
    // Reset tracking
    storageManager.resetTracking();
    
    // Create conversation list
    const conversationList = new MockConversationList(
      containerEl,
      eventBus,
      storageManager as unknown as StorageManager
    );
    
    // Wait for DOM to update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check that StorageManager.getConversations was called
    expect(storageManager.methodCalls.getConversations.length).toBe(1);
    
    // Check that the conversations were rendered
    const conversationItems = containerEl.querySelectorAll('.chatsidian-conversation-item');
    expect(conversationItems.length).toBe(2);
    
    // Clean up
    document.body.removeChild(containerEl);
  });
  
  test('ConversationList creates new conversation using StorageManager', async () => {
    // Create a container for the conversation list
    const containerEl = document.createElement('div');
    
    // Create conversation list
    const conversationList = new MockConversationList(
      containerEl,
      eventBus,
      storageManager as unknown as StorageManager
    );
    
    // Reset tracking
    storageManager.resetTracking();
    
    // Create a new conversation
    await conversationList.createNewConversation('New Test Conversation');
    
    // Check that StorageManager.createConversation was called with correct parameters
    expect(storageManager.methodCalls.createConversation.length).toBe(1);
    expect(storageManager.methodCalls.createConversation[0][0]).toBe('New Test Conversation');
    
    // Check that the conversation was created
    const conversations = await storageManager.getConversations();
    expect(conversations.length).toBe(1);
    expect(conversations[0].title).toBe('New Test Conversation');
  });
  
  test('ConversationList selects conversation and emits event', async () => {
    // Create a container for the conversation list
    const containerEl = document.createElement('div');
    
    // Create conversation list first
    const conversationList = new MockConversationList(
      containerEl,
      eventBus,
      storageManager as unknown as StorageManager
    );
    
    // Create a test conversation using the conversation list
    const conversation = await conversationList.createNewConversation('Test Conversation');
    
    // Reset tracking
    storageManager.resetTracking();
    
    // Create a spy for the event
    const eventSpy = jest.fn();
    eventBus.on(ConversationListEventType.CONVERSATION_SELECTED, eventSpy);
    
    // Select the conversation
    conversationList.selectConversation(conversation.id);
    
    // Check that the event was emitted with the correct conversation
    expect(eventSpy).toHaveBeenCalledWith(conversation);
  });
  
  test('ChatView responds to message submission events', async () => {
    await chatView.onOpen();
    
    // Create a test conversation
    const conversation = await storageManager.createConversation('Test Conversation');
    
    // Set as active conversation
    chatView.setActiveConversation(conversation);
    
    // Reset tracking
    storageManager.resetTracking();
    
    // Create a test message
    const message = ConversationUtils.createMessage(MessageRole.User, 'Test message');
    
    // Emit message submitted event
    eventBus.emit(InputAreaEventType.MESSAGE_SUBMITTED, message);
    
    // Check that StorageManager.addMessage was called with correct parameters
    expect(storageManager.methodCalls.addMessage.length).toBe(1);
    expect(storageManager.methodCalls.addMessage[0][0]).toBe(conversation.id);
    expect(storageManager.methodCalls.addMessage[0][1]).toBe(message);
  });
  
  test('Full conversation flow: create, select, add message', async () => {
    await chatView.onOpen();
    
    // Create a container for the conversation list
    const sidebarContainer = containerEl.querySelector('.chatsidian-sidebar-container') as HTMLElement;
    
    // Create conversation list
    const conversationList = new MockConversationList(
      sidebarContainer,
      eventBus,
      storageManager as unknown as StorageManager
    );
    
    // Reset tracking
    storageManager.resetTracking();
    
    // Create a new conversation
    const conversation = await conversationList.createNewConversation('Flow Test Conversation');
    
    // Check that the conversation was created
    expect(storageManager.methodCalls.createConversation.length).toBe(1);
    
    // Reset tracking
    storageManager.resetTracking();
    
    // Select the conversation (this should emit an event that ChatView listens to)
    conversationList.selectConversation(conversation.id);
    
    // Create a test message
    const message = ConversationUtils.createMessage(MessageRole.User, 'Flow test message');
    
    // Reset tracking
    storageManager.resetTracking();
    
    // Add message to conversation
    await chatView.addMessage(message);
    
    // Check that StorageManager.addMessage was called with correct parameters
    expect(storageManager.methodCalls.addMessage.length).toBe(1);
    expect(storageManager.methodCalls.addMessage[0][0]).toBe(conversation.id);
    
    // Check that the message was added to the conversation
    const updatedConversation = await storageManager.getConversation(conversation.id);
    expect(updatedConversation?.messages.length).toBe(1);
    expect(updatedConversation?.messages[0].content).toBe('Flow test message');
  });
});
