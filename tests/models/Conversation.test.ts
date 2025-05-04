import {
  Conversation,
  Message,
  MessageRole,
  ConversationUtils,
} from '../../src/models/Conversation';

// Mock TFile if needed for tests involving file/path properties
// jest.mock('obsidian', () => ({ TFile: jest.fn() }), { virtual: true });

describe('Conversation Model & Utils', () => {
  let baseConversation: Conversation;
  let baseMessage: Message;

  beforeEach(() => {
    // Reset base objects before each test
    baseConversation = {
      id: 'test-conv-id',
      title: 'Test Conversation',
      createdAt: 1619816400000, // Consistent timestamp for predictability
      modifiedAt: 1619816400000,
      messages: [],
      // Optional fields can be added if needed for specific tests
      // metadata: {},
      // file: new TFile(), // Requires mocking TFile
      // path: 'test/path/conversation.json'
    };

    baseMessage = {
      id: 'test-msg-id',
      role: MessageRole.User,
      content: 'Hello, test!',
      timestamp: 1619816400000,
      // Optional fields
      // toolCalls: [],
      // toolResults: []
    };
  });

  // --- Basic Interface Tests ---

  test('Conversation interface should accept valid properties', () => {
    const conversation: Conversation = { ...baseConversation }; // Use spread to avoid mutation
    expect(conversation.id).toBe('test-conv-id');
    expect(conversation.title).toBe('Test Conversation');
    expect(conversation.messages).toEqual([]); // Check for empty array
  });

  test('Message interface should accept valid properties', () => {
    const message: Message = { ...baseMessage };
    expect(message.id).toBe('test-msg-id');
    expect(message.role).toBe(MessageRole.User);
    expect(message.content).toBe('Hello, test!');
  });

  test('MessageRole enum should have correct values', () => {
    expect(MessageRole.User).toBe('user');
    expect(MessageRole.Assistant).toBe('assistant');
    expect(MessageRole.System).toBe('system');
  });

  // --- ConversationUtils Tests ---

  describe('ConversationUtils.createNew', () => {
    test('should generate a conversation with a unique ID', () => {
      const conversation1 = ConversationUtils.createNew();
      const conversation2 = ConversationUtils.createNew();
      expect(conversation1.id).toBeDefined();
      expect(conversation2.id).toBeDefined();
      expect(conversation1.id).not.toBe(conversation2.id);
    });

    test('should generate a conversation with default title containing date/time', () => {
      const conversation = ConversationUtils.createNew();
      // Check if title contains "New Conversation" and some date/time representation (e.g., year, slashes, colons)
      expect(conversation.title).toMatch(/New Conversation \(.+\)/);
      expect(conversation.title).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/); // Example date format check
    });

    test('should accept and use a custom title', () => {
      const customTitle = 'My Custom Chat';
      const conversation = ConversationUtils.createNew(customTitle);
      expect(conversation.title).toBe(customTitle);
    });

    test('should initialize with empty messages array', () => {
      const conversation = ConversationUtils.createNew();
      expect(conversation.messages).toEqual([]);
    });

    test('should set createdAt and modifiedAt timestamps', () => {
      const before = Date.now();
      const conversation = ConversationUtils.createNew();
      const after = Date.now();
      expect(conversation.createdAt).toBeGreaterThanOrEqual(before);
      expect(conversation.createdAt).toBeLessThanOrEqual(after);
      expect(conversation.modifiedAt).toEqual(conversation.createdAt);
    });
  });

  describe('ConversationUtils.createMessage', () => {
    test('should generate a message with a unique ID', () => {
      const message1 = ConversationUtils.createMessage(MessageRole.User, 'Msg 1');
      const message2 = ConversationUtils.createMessage(MessageRole.User, 'Msg 2');
      expect(message1.id).toBeDefined();
      expect(message2.id).toBeDefined();
      expect(message1.id).not.toBe(message2.id);
    });

    test('should set the correct role and content', () => {
      const role = MessageRole.Assistant;
      const content = 'This is assistant content.';
      const message = ConversationUtils.createMessage(role, content);
      expect(message.role).toBe(role);
      expect(message.content).toBe(content);
    });

    test('should set the timestamp', () => {
      const before = Date.now();
      const message = ConversationUtils.createMessage(MessageRole.User, 'Timestamp test');
      const after = Date.now();
      expect(message.timestamp).toBeGreaterThanOrEqual(before);
      expect(message.timestamp).toBeLessThanOrEqual(after);
    });

    test('should not include toolCalls or toolResults by default', () => {
      const message = ConversationUtils.createMessage(MessageRole.User, 'No tools');
      expect(message.toolCalls).toBeUndefined();
      expect(message.toolResults).toBeUndefined();
    });
  });

  describe('ConversationUtils.addMessage', () => {
    test('should return a new conversation object (immutability)', () => {
      const originalConversation = ConversationUtils.createNew();
      const message = ConversationUtils.createMessage(MessageRole.User, 'Immutable?');
      const updatedConversation = ConversationUtils.addMessage(originalConversation, message);

      expect(updatedConversation).not.toBe(originalConversation); // Check for different object reference
      expect(originalConversation.messages).toHaveLength(0); // Original should be unchanged
    });

    test('should add the message to the messages array', () => {
      const conversation = ConversationUtils.createNew();
      const message = ConversationUtils.createMessage(MessageRole.User, 'Add me');
      const updatedConversation = ConversationUtils.addMessage(conversation, message);

      expect(updatedConversation.messages).toHaveLength(1);
      expect(updatedConversation.messages[0]).toEqual(message); // Check if the correct message was added
    });

    test('should add multiple messages correctly', () => {
      let conversation = ConversationUtils.createNew();
      const message1 = ConversationUtils.createMessage(MessageRole.User, 'First');
      const message2 = ConversationUtils.createMessage(MessageRole.Assistant, 'Second');

      conversation = ConversationUtils.addMessage(conversation, message1);
      conversation = ConversationUtils.addMessage(conversation, message2);

      expect(conversation.messages).toHaveLength(2);
      expect(conversation.messages[0]).toEqual(message1);
      expect(conversation.messages[1]).toEqual(message2);
    });

    test('should update the modifiedAt timestamp', () => {
      const conversation = ConversationUtils.createNew();
      // Ensure a slight delay for timestamp comparison
      jest.advanceTimersByTime(10);
      const message = ConversationUtils.createMessage(MessageRole.User, 'Update time');
      const updatedConversation = ConversationUtils.addMessage(conversation, message);

      expect(updatedConversation.modifiedAt).toBeGreaterThan(conversation.createdAt);
      expect(updatedConversation.modifiedAt).toBeGreaterThanOrEqual(message.timestamp);
    });
  });

  // --- Edge Cases/Optional Fields ---
  test('Conversation can include optional fields', () => {
      const conversation: Conversation = {
          ...baseConversation,
          metadata: { tag: 'test' },
          path: 'a/b/c.json'
      };
      expect(conversation.metadata).toEqual({ tag: 'test' });
      expect(conversation.path).toBe('a/b/c.json');
  });

  test('Message can include optional tool calls and results', () => {
      const toolCall: any = { id: 'tc1', name: 'tool', arguments: {}, status: 'pending' };
      const toolResult: any = { id: 'tr1', toolCallId: 'tc1', content: 'result' };
      const message: Message = {
          ...baseMessage,
          toolCalls: [toolCall],
          toolResults: [toolResult]
      };
      expect(message.toolCalls).toEqual([toolCall]);
      expect(message.toolResults).toEqual([toolResult]);
  });

});

// Enable fake timers for timestamp tests if needed
beforeAll(() => {
  jest.useFakeTimers();
});

afterAll(() => {
  jest.useRealTimers();
});
