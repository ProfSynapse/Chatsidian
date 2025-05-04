/**
 * Tests for the StorageManager class.
 * 
 * These tests verify the functionality of the StorageManager class,
 * which handles data persistence within the Obsidian vault.
 */

import { App, TFile, TFolder, Plugin } from '../../src/utils/obsidian-imports';
import { EventBus } from '../../src/core/EventBus';
import { SettingsManager } from '../../src/core/SettingsManager';
import { StorageManager } from '../../src/core/StorageManager';
import { Conversation, MessageRole } from '../../src/models/Conversation';
import { 
  ConversationNotFoundError,
  MessageNotFoundError 
} from '../../src/core/StorageErrors';

// Mock dependencies
jest.mock('../../src/utils/obsidian-imports', () => {
  const originalModule = jest.requireActual('../../src/utils/obsidian-imports');
  
  // Mock TFile
  class MockTFile {
    path: string;
    name: string;
    basename: string;
    extension: string;
    
    constructor(path: string) {
      this.path = path;
      this.name = path.split('/').pop() || '';
      const parts = this.name.split('.');
      this.extension = parts.length > 1 ? parts.pop() || '' : '';
      this.basename = parts.join('.');
    }
  }
  
  // Mock TFolder
  class MockTFolder {
    path: string;
    name: string;
    children: Array<MockTFile | MockTFolder>;
    
    constructor(path: string) {
      this.path = path;
      this.name = path.split('/').pop() || '';
      this.children = [];
    }
    
    addChild(child: MockTFile | MockTFolder): void {
      this.children.push(child);
    }
  }
  
  // Mock App
  const mockApp = {
    vault: {
      getAbstractFileByPath: jest.fn(),
      createFolder: jest.fn(),
      read: jest.fn(),
      create: jest.fn(),
      modify: jest.fn(),
      delete: jest.fn(),
      on: jest.fn().mockReturnValue('event-ref'),
    },
    fileManager: {
      createNewMarkdownFile: jest.fn(),
      renameFile: jest.fn(),
    },
    workspace: {
      openLinkText: jest.fn(),
    },
  };
  
  // Mock Plugin
  const mockPlugin = {
    registerEvent: jest.fn(),
  };
  
  return {
    ...originalModule,
    App: mockApp,
    TFile: MockTFile,
    TFolder: MockTFolder,
    Plugin: mockPlugin,
  };
});

describe('StorageManager', () => {
  let app: App;
  let plugin: Plugin;
  let eventBus: EventBus;
  let settings: SettingsManager;
  let storageManager: StorageManager;
  
  // Sample conversation for testing
  const sampleConversation: Conversation = {
    id: 'test-conversation',
    title: 'Test Conversation',
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    messages: [
      {
        id: 'msg1',
        role: MessageRole.User,
        content: 'Hello',
        timestamp: Date.now(),
      },
      {
        id: 'msg2',
        role: MessageRole.Assistant,
        content: 'Hi there!',
        timestamp: Date.now(),
      },
    ],
  };
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create dependencies
    app = new App() as any;
    plugin = new Plugin() as any;
    eventBus = new EventBus();
    
    // Mock settings
    settings = {
      getConversationsPath: jest.fn().mockReturnValue('conversations'),
    } as unknown as SettingsManager;
    
    // Create storage manager
    storageManager = new StorageManager(app, plugin, settings, eventBus);
  });
  
  describe('initialize', () => {
    it('should ensure conversations folder exists', async () => {
      // Mock folder doesn't exist
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
      
      await storageManager.initialize();
      
      // Should create folder
      expect(app.vault.createFolder).toHaveBeenCalledWith('conversations');
      
      // Should register for vault events
      expect(app.vault.on).toHaveBeenCalledWith('create', expect.any(Function));
      expect(app.vault.on).toHaveBeenCalledWith('modify', expect.any(Function));
      expect(app.vault.on).toHaveBeenCalledWith('delete', expect.any(Function));
      expect(app.vault.on).toHaveBeenCalledWith('rename', expect.any(Function));
      
      // Should register for settings events
      expect(plugin.registerEvent).toHaveBeenCalled();
    });
    
    it('should use existing folder if it exists', async () => {
      // Mock folder exists
      const mockFolder = new TFolder('conversations');
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFolder);
      
      await storageManager.initialize();
      
      // Should not create folder
      expect(app.vault.createFolder).not.toHaveBeenCalled();
    });
  });
  
  describe('getConversations', () => {
    it('should return an empty array if folder does not exist', async () => {
      // Mock folder doesn't exist
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
      
      const conversations = await storageManager.getConversations();
      
      expect(conversations).toEqual([]);
    });
    
    it('should return conversations from folder', async () => {
      // Mock folder with files
      const mockFolder = new TFolder('conversations');
      const mockFile1 = new TFile('conversations/test1.json');
      const mockFile2 = new TFile('conversations/test2.json');
      mockFolder.addChild(mockFile1);
      mockFolder.addChild(mockFile2);
      
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFolder);
      
      // Mock file content
      (app.vault.read as jest.Mock).mockImplementation((file) => {
        if (file === mockFile1) {
          return JSON.stringify({
            id: 'test1',
            title: 'Test 1',
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            messages: [],
          });
        } else if (file === mockFile2) {
          return JSON.stringify({
            id: 'test2',
            title: 'Test 2',
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            messages: [],
          });
        }
        return '';
      });
      
      const conversations = await storageManager.getConversations();
      
      expect(conversations.length).toBe(2);
      expect(conversations[0].id).toBe('test1');
      expect(conversations[1].id).toBe('test2');
    });
  });
  
  describe('getConversation', () => {
    it('should return null if conversation does not exist', async () => {
      // Mock file doesn't exist
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
      
      const conversation = await storageManager.getConversation('nonexistent');
      
      expect(conversation).toBeNull();
    });
    
    it('should return conversation if it exists', async () => {
      // Mock file exists
      const mockFile = new TFile('conversations/test.json');
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      
      // Mock file content
      (app.vault.read as jest.Mock).mockResolvedValue(JSON.stringify(sampleConversation));
      
      const conversation = await storageManager.getConversation('test');
      
      expect(conversation).not.toBeNull();
      expect(conversation?.id).toBe('test-conversation');
      expect(conversation?.title).toBe('Test Conversation');
      expect(conversation?.messages.length).toBe(2);
    });
  });
  
  describe('saveConversation', () => {
    it('should create a new file if conversation does not exist', async () => {
      // Mock file doesn't exist
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
      
      await storageManager.saveConversation(sampleConversation);
      
      // Should create file
      expect(app.vault.create).toHaveBeenCalledWith(
        'conversations/test-conversation.json',
        expect.any(String)
      );
    });
    
    it('should update existing file if conversation exists', async () => {
      // Mock file exists
      const mockFile = new TFile('conversations/test-conversation.json');
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      
      await storageManager.saveConversation(sampleConversation);
      
      // Should modify file
      expect(app.vault.modify).toHaveBeenCalledWith(
        mockFile,
        expect.any(String)
      );
    });
  });
  
  describe('createConversation', () => {
    it('should create a new conversation with default title', async () => {
      // Mock file doesn't exist
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
      
      const conversation = await storageManager.createConversation();
      
      // Should have generated ID and title
      expect(conversation.id).toBeDefined();
      expect(conversation.title).toContain('New Conversation');
      expect(conversation.messages).toEqual([]);
      
      // Should save conversation
      expect(app.vault.create).toHaveBeenCalled();
    });
    
    it('should create a new conversation with specified title', async () => {
      // Mock file doesn't exist
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
      
      const conversation = await storageManager.createConversation('Custom Title');
      
      // Should have generated ID and custom title
      expect(conversation.id).toBeDefined();
      expect(conversation.title).toBe('Custom Title');
      expect(conversation.messages).toEqual([]);
      
      // Should save conversation
      expect(app.vault.create).toHaveBeenCalled();
    });
  });
  
  describe('deleteConversation', () => {
    it('should throw error if conversation does not exist', async () => {
      // Mock file doesn't exist
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
      
      await expect(storageManager.deleteConversation('nonexistent'))
        .rejects.toThrow(ConversationNotFoundError);
    });
    
    it('should delete conversation if it exists', async () => {
      // Mock file exists
      const mockFile = new TFile('conversations/test.json');
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      
      await storageManager.deleteConversation('test');
      
      // Should delete file
      expect(app.vault.delete).toHaveBeenCalledWith(mockFile);
    });
  });
  
  describe('addMessage', () => {
    it('should throw error if conversation does not exist', async () => {
      // Mock conversation doesn't exist
      jest.spyOn(storageManager, 'getConversation').mockResolvedValue(null);
      
      const message = {
        id: 'new-msg',
        role: MessageRole.User,
        content: 'New message',
        timestamp: Date.now(),
      };
      
      await expect(storageManager.addMessage('nonexistent', message))
        .rejects.toThrow(ConversationNotFoundError);
    });
    
    it('should add message to conversation', async () => {
      // Mock conversation exists
      jest.spyOn(storageManager, 'getConversation').mockResolvedValue(sampleConversation);
      
      // Mock save
      jest.spyOn(storageManager, 'saveConversation').mockResolvedValue();
      
      const message = {
        id: 'new-msg',
        role: MessageRole.User,
        content: 'New message',
        timestamp: Date.now(),
      };
      
      const updatedConversation = await storageManager.addMessage('test-conversation', message);
      
      // Should add message
      expect(updatedConversation.messages.length).toBe(3);
      expect(updatedConversation.messages[2].id).toBe('new-msg');
      expect(updatedConversation.messages[2].content).toBe('New message');
      
      // Should save conversation
      expect(storageManager.saveConversation).toHaveBeenCalled();
      
      // Should emit event
      expect(eventBus.emit).toHaveBeenCalledWith('message:added', {
        conversationId: 'test-conversation',
        message,
      });
    });
  });
  
  describe('updateMessage', () => {
    it('should throw error if conversation does not exist', async () => {
      // Mock conversation doesn't exist
      jest.spyOn(storageManager, 'getConversation').mockResolvedValue(null);
      
      await expect(storageManager.updateMessage('nonexistent', 'msg1', 'Updated content'))
        .rejects.toThrow(ConversationNotFoundError);
    });
    
    it('should throw error if message does not exist', async () => {
      // Mock conversation exists
      jest.spyOn(storageManager, 'getConversation').mockResolvedValue(sampleConversation);
      
      await expect(storageManager.updateMessage('test-conversation', 'nonexistent', 'Updated content'))
        .rejects.toThrow(MessageNotFoundError);
    });
    
    it('should update message content', async () => {
      // Mock conversation exists
      jest.spyOn(storageManager, 'getConversation').mockResolvedValue(sampleConversation);
      
      // Mock save
      jest.spyOn(storageManager, 'saveConversation').mockResolvedValue();
      
      const updatedConversation = await storageManager.updateMessage(
        'test-conversation',
        'msg1',
        'Updated content'
      );
      
      // Should update message
      expect(updatedConversation.messages[0].content).toBe('Updated content');
      
      // Should save conversation
      expect(storageManager.saveConversation).toHaveBeenCalled();
      
      // Should emit event
      expect(eventBus.emit).toHaveBeenCalledWith('message:updated', {
        conversationId: 'test-conversation',
        messageId: 'msg1',
        previousContent: 'Hello',
        currentContent: 'Updated content',
      });
    });
  });
});
