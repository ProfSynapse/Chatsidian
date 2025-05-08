/**
 * MessageDisplay Component Tests
 * 
 * This file contains tests for the MessageDisplay components.
 */

import { MessageList, MessageComponent } from '../../src/ui/MessageDisplay';
import { ConversationUtils, MessageRole } from '../../src/models/Conversation';
import { setupUITestEnvironment } from '../utils/ui-test-utils';

// Setup UI test environment
setupUITestEnvironment();

describe('MessageList', () => {
  let messageList: MessageList;
  let containerEl: HTMLElement;
  
  beforeEach(() => {
    // Create a mock DOM environment
    document.body.innerHTML = '<div id="container"></div>';
    containerEl = document.getElementById('container') as HTMLElement;
    
    // Create the message list
    messageList = new MessageList(containerEl);
  });
  
  afterEach(() => {
    // Clean up
    document.body.innerHTML = '';
  });
  
  test('should initialize with empty messages', () => {
    expect(containerEl.classList.contains('chatsidian-message-list')).toBe(true);
    expect(containerEl.children.length).toBe(0);
  });
  
  test('should render messages when setMessages is called', () => {
    // Create sample messages
    const messages = [
      ConversationUtils.createMessage(MessageRole.User, 'Hello'),
      ConversationUtils.createMessage(MessageRole.Assistant, 'Hi there!')
    ];
    
    // Set messages
    messageList.setMessages(messages);
    
    // Check that messages are rendered
    expect(containerEl.children.length).toBe(2);
    expect(containerEl.querySelector('.chatsidian-message-user')).not.toBeNull();
    expect(containerEl.querySelector('.chatsidian-message-assistant')).not.toBeNull();
  });
  
  test('should add a message when addMessage is called', () => {
    // Add a message
    const message = ConversationUtils.createMessage(MessageRole.User, 'Hello');
    messageList.addMessage(message);
    
    // Check that message is rendered
    expect(containerEl.children.length).toBe(1);
    expect(containerEl.querySelector('.chatsidian-message-user')).not.toBeNull();
    
    // Add another message
    const message2 = ConversationUtils.createMessage(MessageRole.Assistant, 'Hi there!');
    messageList.addMessage(message2);
    
    // Check that both messages are rendered
    expect(containerEl.children.length).toBe(2);
    expect(containerEl.querySelector('.chatsidian-message-assistant')).not.toBeNull();
  });
  
  test('should update a message when updateMessage is called', () => {
    // Add a message
    const message = ConversationUtils.createMessage(MessageRole.User, 'Hello');
    messageList.addMessage(message);
    
    // Check initial content
    const initialContent = containerEl.textContent;
    expect(initialContent).toContain('Hello');
    
    // Update the message
    const updatedMessage = { ...message, content: 'Updated content' };
    messageList.updateMessage(updatedMessage);
    
    // Check that content is updated
    const updatedContent = containerEl.textContent;
    expect(updatedContent).toContain('Updated content');
    expect(containerEl.children.length).toBe(1);
  });
  
  test('should clear messages when clear is called', () => {
    // Add some messages
    const messages = [
      ConversationUtils.createMessage(MessageRole.User, 'Hello'),
      ConversationUtils.createMessage(MessageRole.Assistant, 'Hi there!')
    ];
    
    messageList.setMessages(messages);
    expect(containerEl.children.length).toBe(2);
    
    // Clear messages
    messageList.clear();
    expect(containerEl.children.length).toBe(0);
  });
});

describe('MessageComponent', () => {
  let containerEl: HTMLElement;
  
  beforeEach(() => {
    // Create a mock DOM environment
    document.body.innerHTML = '<div id="container"></div>';
    containerEl = document.getElementById('container') as HTMLElement;
  });
  
  afterEach(() => {
    // Clean up
    document.body.innerHTML = '';
  });
  
  test('should render user message correctly', () => {
    // Create a user message
    const message = ConversationUtils.createMessage(MessageRole.User, 'Hello, this is a test message.');
    
    // Create message component
    const messageComponent = new MessageComponent(containerEl, message);
    
    // Check that message is rendered correctly
    const messageEl = containerEl.querySelector('.chatsidian-message');
    expect(messageEl).not.toBeNull();
    expect(messageEl?.classList.contains('chatsidian-message-user')).toBe(true);
    
    // Check avatar
    const avatarEl = messageEl?.querySelector('.chatsidian-message-avatar');
    expect(avatarEl).not.toBeNull();
    
    // Check role label
    const roleEl = messageEl?.querySelector('.chatsidian-message-role');
    expect(roleEl?.textContent).toBe('You');
    
    // Check content
    const contentEl = messageEl?.querySelector('.chatsidian-message-markdown');
    expect(contentEl?.textContent).toContain('Hello, this is a test message.');
  });
  
  test('should render assistant message correctly', () => {
    // Create an assistant message
    const message = ConversationUtils.createMessage(MessageRole.Assistant, 'I can help with that!');
    
    // Create message component
    const messageComponent = new MessageComponent(containerEl, message);
    
    // Check that message is rendered correctly
    const messageEl = containerEl.querySelector('.chatsidian-message');
    expect(messageEl).not.toBeNull();
    expect(messageEl?.classList.contains('chatsidian-message-assistant')).toBe(true);
    
    // Check role label
    const roleEl = messageEl?.querySelector('.chatsidian-message-role');
    expect(roleEl?.textContent).toBe('Assistant');
    
    // Check content
    const contentEl = messageEl?.querySelector('.chatsidian-message-markdown');
    expect(contentEl?.textContent).toContain('I can help with that!');
  });
  
  test('should render markdown content correctly', async () => {
    // Create a message with markdown content
    const markdownContent = '# Heading\n\n- List item 1\n- List item 2\n\n```js\nconst x = 1;\n```';
    const message = ConversationUtils.createMessage(MessageRole.Assistant, markdownContent);
    
    // Create message component
    const messageComponent = new MessageComponent(containerEl, message);
    
    // Check that markdown is rendered
    const contentEl = containerEl.querySelector('.chatsidian-message-markdown');
    
    // Wait for markdown rendering to complete
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Check for heading
    expect(contentEl?.querySelector('h1')).not.toBeNull();
    
    // Check for list
    const listItems = contentEl?.querySelectorAll('li');
    expect(listItems?.length).toBe(2);
    
    // Check for code block
    const codeBlock = contentEl?.querySelector('pre code');
    expect(codeBlock).not.toBeNull();
  });
  
  test('should render tool calls correctly', () => {
    // Create a message with tool calls
    const message = ConversationUtils.createMessage(MessageRole.Assistant, 'I\'ll help you with that.');
    message.toolCalls = [
      {
        id: 'tool1',
        name: 'searchVault',
        arguments: { query: 'obsidian' },
        status: 'success'
      }
    ];
    message.toolResults = [
      {
        id: 'result1',
        toolCallId: 'tool1',
        content: 'Found 5 notes matching "obsidian"'
      }
    ];
    
    // Create message component
    const messageComponent = new MessageComponent(containerEl, message);
    
    // Check that tool calls are rendered
    const toolCallsEl = containerEl.querySelector('.chatsidian-tool-calls');
    expect(toolCallsEl).not.toBeNull();
    
    // Check tool call name
    const toolCallNameEl = toolCallsEl?.querySelector('.chatsidian-tool-call-name');
    expect(toolCallNameEl?.textContent).toBe('searchVault');
    
    // Check tool call status
    const toolCallStatusEl = toolCallsEl?.querySelector('.chatsidian-tool-call-status');
    expect(toolCallStatusEl?.textContent).toBe('success');
    
    // Check tool call arguments
    const toolCallArgsEl = toolCallsEl?.querySelector('.chatsidian-tool-call-args');
    expect(toolCallArgsEl?.textContent).toContain('query');
    expect(toolCallArgsEl?.textContent).toContain('obsidian');
    
    // Check tool call result
    const toolCallResultEl = toolCallsEl?.querySelector('.chatsidian-tool-call-result');
    expect(toolCallResultEl?.textContent).toContain('Found 5 notes');
  });
});
