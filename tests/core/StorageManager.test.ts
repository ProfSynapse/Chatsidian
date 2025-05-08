import { App, TFile, TFolder, Plugin } from '../../src/utils/obsidian-imports';
import { EventBus } from '../../src/core/EventBus';
import { SettingsManager } from '../../src/core/SettingsManager';
import { StorageManager } from '../../src/core/StorageManager';
import { MessageRole, Conversation } from '../../src/models/Conversation';
import { 
  ConversationNotFoundError,
  MessageNotFoundError,
  FileOperationError,
  FolderOperationError,
  JsonParseError
} from '../../src/core/StorageErrors';
import { StorageUtils } from '../../src/core/StorageUtils';

// Mock dependencies first
jest.mock('../../src/core/EventBus', () => {
  return {
    EventBus: jest.fn().mockImplementation(() => ({
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      trigger: jest.fn()
    }))
  };
});

jest.mock('../../src/utils/obsidian-imports', () => {
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
  
  return {
    TFile: MockTFile,
    TFolder: MockTFolder,
    App: jest.fn(),
    Plugin: jest.fn(),
    Notice: jest.fn()
  };
});

describe('StorageManager', () => {
  let app: App;
  let plugin: Plugin;
  let eventBus: EventBus;
  let settings: SettingsManager;
  let storageManager: StorageManager;
  let mockTFolder: typeof TFolder;
  let mockTFile: typeof TFile;

  // Sample conversation for testing
  const sampleConversation = {
    id: 'test-conversation',
    title: 'Test Conversation',
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    messages: [
      {
        id: 'msg1',
        role: 'user' as MessageRole,
        content: 'Hello',
        timestamp: Date.now(),
      },
      {
        id: 'msg2',
        role: 'assistant' as MessageRole,
        content: 'Hi there!',
        timestamp: Date.now(),
      },
    ],
  };
  
  beforeEach(() => {
    mockTFolder = TFolder;
    mockTFile = TFile;
    
    // Reset mocks
    jest.clearAllMocks();

    // Mock StorageUtils static methods
    jest.spyOn(StorageUtils, 'exportConversation').mockImplementation(async (app: App, conversation: Conversation, format: 'json' | 'markdown') => {
      const path = format === 'markdown' ? 'test.md' : 'test.json';
      await app.vault.create(path, format === 'markdown' ? '# Test Export' : JSON.stringify(conversation));
    });
    
    jest.spyOn(StorageUtils, 'parseMarkdownToConversation').mockImplementation(() => ({
      id: 'imported-id',
      title: 'Test Conversation',
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      messages: [
        {
          id: 'msg1',
          role: 'user' as MessageRole,
          content: 'Hello',
          timestamp: Date.now()
        },
        {
          id: 'msg2',
          role: 'assistant' as MessageRole,
          content: 'Hi there!',
          timestamp: Date.now()
        }
      ]
    }));

    jest.spyOn(StorageUtils, 'generateId').mockReturnValue('new-id');

    jest.spyOn(StorageUtils, 'parseJsonToConversation').mockImplementation(() => ({
      id: 'new-id',
      title: 'Test Import',
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      messages: []
    }));

    jest.spyOn(StorageUtils, 'backupConversation').mockImplementation(async (app: App, conversation: Conversation, backupFolder: string) => {
      const path = `${backupFolder}/${conversation.id}.json`;
      await app.vault.create(path, JSON.stringify(conversation));
      return path;
    });
    
    // Create dependencies with proper mocking
    app = {
      vault: {
        getAbstractFileByPath: jest.fn(),
        createFolder: jest.fn(),
        read: jest.fn(),
        create: jest.fn(),
        modify: jest.fn(),
        delete: jest.fn(),
        on: jest.fn().mockReturnValue('event-ref')
      },
      fileManager: {
        createNewMarkdownFile: jest.fn(),
        renameFile: jest.fn()
      },
      workspace: {
        openLinkText: jest.fn()
      }
    } as unknown as App;
    
    plugin = {
      registerEvent: jest.fn()
    } as unknown as Plugin;
    
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
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
      await storageManager.initialize();
      expect(app.vault.createFolder).toHaveBeenCalledWith('conversations');
      expect(app.vault.on).toHaveBeenCalledWith('create', expect.any(Function));
      expect(app.vault.on).toHaveBeenCalledWith('modify', expect.any(Function));
      expect(app.vault.on).toHaveBeenCalledWith('delete', expect.any(Function));
      expect(app.vault.on).toHaveBeenCalledWith('rename', expect.any(Function));
      expect(plugin.registerEvent).toHaveBeenCalled();
    });

    it('should use existing folder if it exists', async () => {
      const mockFolder = new mockTFolder('conversations');
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFolder);
      await storageManager.initialize();
      expect(app.vault.createFolder).not.toHaveBeenCalled();
    });

    it('should handle folder creation error', async () => {
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
      (app.vault.createFolder as jest.Mock).mockRejectedValue(new Error('Failed to create folder'));
      
      await expect(storageManager.initialize()).rejects.toThrow(FolderOperationError);
    });

    it('should handle non-folder path', async () => {
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(new mockTFile('conversations'));
      
      await expect(storageManager.initialize()).rejects.toThrow(FolderOperationError);
    });

    it('should handle settings change event', async () => {
      // Setup the event handler mock
      const mockEventHandler = jest.fn();
      (eventBus.on as jest.Mock).mockImplementation((event, handler) => {
        if (event === 'settings:updated') {
          mockEventHandler.mockImplementation(handler);
        }
        return { event, handler };
      });
      
      // Initialize to register the handler
      await storageManager.initialize();
      
      // Trigger the event
      mockEventHandler({ changedKeys: ['conversationsFolder'] });
      
      // Verify the handler called the appropriate method
      expect(app.vault.getAbstractFileByPath).toHaveBeenCalled();
    });
  });

  describe('getConversations', () => {
    it('should return empty array if folder does not exist', async () => {
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
      const result = await storageManager.getConversations();
      expect(result).toEqual([]);
    });

    it('should handle non-folder path', async () => {
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(new mockTFile('conversations'));
      const result = await storageManager.getConversations();
      expect(result).toEqual([]);
    });

    it('should skip non-JSON files', async () => {
      const mockFolder = new mockTFolder('conversations');
      const mockFiles = [
        new mockTFile('conversations/test1.json'),
        new mockTFile('conversations/test2.md'),
        new mockTFile('conversations/test3.json')
      ];
      mockFolder.children = mockFiles;
      
      (app.vault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) => {
        if (path === 'conversations') {
          return mockFolder;
        }
        if (path.endsWith('.json')) {
          return mockFiles.find(f => f.path === path) || null;
        }
        return null;
      });
      
      (app.vault.read as jest.Mock).mockImplementation((file: TFile) => {
        return Promise.resolve(JSON.stringify({
          id: file.basename,
          title: `Test ${file.basename}`,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          messages: []
        }));
      });
      
      const conversations = await storageManager.getConversations();
      expect(conversations).toHaveLength(2);
      expect(conversations.map((c: Conversation) => c.id)).toEqual(['test1', 'test3']);
    });

    it('should handle invalid JSON data', async () => {
      const mockFolder = new mockTFolder('conversations');
      const mockFiles = [
        new mockTFile('conversations/test1.json'),
        new mockTFile('conversations/test2.json')
      ];
      mockFolder.children = mockFiles;
      
      (app.vault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) => {
        if (path === 'conversations') {
          return mockFolder;
        }
        return mockFiles.find(f => f.path === path) || null;
      });
      
      (app.vault.read as jest.Mock).mockImplementation((file: TFile) => {
        if (file.basename === 'test1') {
          return Promise.resolve('invalid json');
        }
        return Promise.resolve(JSON.stringify({
          id: file.basename,
          title: 'Test 2',
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          messages: []
        }));
      });
      
      const conversations = await storageManager.getConversations();
      expect(conversations).toHaveLength(1);
      expect(conversations[0].id).toBe('test2');
    });

    it('should sort conversations by modification date', async () => {
      const mockFolder = new mockTFolder('conversations');
      const mockFiles = [
        new mockTFile('conversations/test1.json'),
        new mockTFile('conversations/test2.json')
      ];
      mockFolder.children = mockFiles;
      
      const now = Date.now();
      (app.vault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) => {
        if (path === 'conversations') {
          return mockFolder;
        }
        return mockFiles.find(f => f.path === path) || null;
      });
      
      (app.vault.read as jest.Mock).mockImplementation((file: TFile) => {
        return Promise.resolve(JSON.stringify({
          id: file.basename,
          title: file.basename === 'test1' ? 'Test 1' : 'Test 2',
          createdAt: now,
          modifiedAt: file.basename === 'test1' ? now - 1000 : now,
          messages: []
        }));
      });
      
      const conversations = await storageManager.getConversations();
      expect(conversations).toHaveLength(2);
      expect(conversations[0].id).toBe('test2');
      expect(conversations[1].id).toBe('test1');
    });
  });

  describe('getConversation', () => {
    it('should return conversation by ID', async () => {
      const mockFile = new mockTFile('conversations/test-id.json');
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (app.vault.read as jest.Mock).mockResolvedValue(JSON.stringify(sampleConversation));
      
      const conversation = await storageManager.getConversation('test-id');
      expect(conversation).not.toBeNull();
      expect(conversation?.id).toBe('test-conversation');
    });
    
    it('should return null if conversation does not exist', async () => {
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
      
      const conversation = await storageManager.getConversation('nonexistent');
      expect(conversation).toBeNull();
    });
    
    it('should handle JSON parse error', async () => {
      const mockFile = new mockTFile('conversations/test-id.json');
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (app.vault.read as jest.Mock).mockResolvedValue('invalid json');
      
      await expect(storageManager.getConversation('test-id')).rejects.toThrow(JsonParseError);
    });
  });

  describe('saveConversation', () => {
    it('should create new conversation file if it does not exist', async () => {
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
      
      await storageManager.saveConversation(sampleConversation);
      
      expect(app.vault.create).toHaveBeenCalledWith(
        'conversations/test-conversation.json',
        expect.any(String)
      );
    });
    
    it('should update existing conversation file', async () => {
      const mockFile = new mockTFile('conversations/test-conversation.json');
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      
      await storageManager.saveConversation(sampleConversation);
      
      expect(app.vault.modify).toHaveBeenCalledWith(
        mockFile,
        expect.any(String)
      );
    });
    
    it('should handle file operation error', async () => {
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
      (app.vault.create as jest.Mock).mockRejectedValue(new Error('Failed to create file'));
      
      await expect(storageManager.saveConversation(sampleConversation)).rejects.toThrow(FileOperationError);
    });
    
    it('should update modification time', async () => {
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
      const originalTime = sampleConversation.modifiedAt;
      
      await storageManager.saveConversation(sampleConversation);
      
      expect(sampleConversation.modifiedAt).not.toBe(originalTime);
    });
  });

  describe('createConversation', () => {
    it('should create a new conversation with default title', async () => {
      // Mock Date.now() to return a fixed timestamp for testing
      const originalDateNow = Date.now;
      const mockTimestamp = 1620000000000; // Fixed timestamp for testing
      global.Date.now = jest.fn(() => mockTimestamp);
      
      jest.spyOn(storageManager, 'saveConversation').mockResolvedValue();
      
      const conversation = await storageManager.createConversation();
      
      expect(conversation.id).toBeDefined();
      // Check for the title without the timestamp part
      expect(conversation.title).toContain('New Conversation');
      expect(conversation.messages).toEqual([]);
      
      // Restore original Date.now
      global.Date.now = originalDateNow;
    });
    
    it('should create a new conversation with custom title', async () => {
      jest.spyOn(storageManager, 'saveConversation').mockResolvedValue();
      
      const conversation = await storageManager.createConversation('Custom Title');
      
      expect(conversation.id).toBeDefined();
      expect(conversation.title).toBe('Custom Title');
    });
  });

  describe('deleteConversation', () => {
    it('should delete conversation file', async () => {
      const mockFile = new mockTFile('conversations/test-id.json');
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      
      await storageManager.deleteConversation('test-id');
      
      expect(app.vault.delete).toHaveBeenCalledWith(mockFile);
    });
    
    it('should throw error if conversation does not exist', async () => {
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);
      
      await expect(storageManager.deleteConversation('nonexistent')).rejects.toThrow(ConversationNotFoundError);
    });
    
    it('should handle file operation error', async () => {
      const mockFile = new mockTFile('conversations/test-id.json');
      (app.vault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
      (app.vault.delete as jest.Mock).mockRejectedValue(new Error('Failed to delete file'));
      
      await expect(storageManager.deleteConversation('test-id')).rejects.toThrow(FileOperationError);
    });
  });

  describe('messageOperations', () => {
    it('should add message to conversation', async () => {
      jest.spyOn(storageManager, 'getConversation').mockResolvedValue(sampleConversation);
      jest.spyOn(storageManager, 'saveConversation').mockResolvedValue();
      
      const newMessage = {
        id: 'new-msg',
        role: 'user' as MessageRole,
        content: 'Test message',
        timestamp: Date.now()
      };
      
      const result = await storageManager.addMessage('test-conversation', newMessage);
      expect(result.messages).toHaveLength(3);
      expect(result.messages[2]).toEqual(newMessage);
      expect(eventBus.emit).toHaveBeenCalledWith('message:added', {
        conversationId: 'test-conversation',
        message: newMessage
      });
    });

    it('should throw error when adding message to nonexistent conversation', async () => {
      jest.spyOn(storageManager, 'getConversation').mockResolvedValue(null);
      
      const newMessage = {
        id: 'new-msg',
        role: 'user' as MessageRole,
        content: 'Test message',
        timestamp: Date.now()
      };
      
      await expect(storageManager.addMessage('nonexistent', newMessage)).rejects.toThrow(ConversationNotFoundError);
    });

    it('should update message content', async () => {
      jest.spyOn(storageManager, 'getConversation').mockResolvedValue(sampleConversation);
      jest.spyOn(storageManager, 'saveConversation').mockResolvedValue();
      
      const result = await storageManager.updateMessage(
        'test-conversation',
        'msg1',
        'Updated content'
      );
      
      expect(result.messages[0].content).toBe('Updated content');
      expect(eventBus.emit).toHaveBeenCalledWith('message:updated', {
        conversationId: 'test-conversation',
        messageId: 'msg1',
        previousContent: 'Hello',
        currentContent: 'Updated content'
      });
    });

    it('should throw error when updating nonexistent message', async () => {
      jest.spyOn(storageManager, 'getConversation').mockResolvedValue(sampleConversation);
      
      await expect(storageManager.updateMessage(
        'test-conversation',
        'nonexistent',
        'Updated content'
      )).rejects.toThrow(MessageNotFoundError);
    });
  });

  describe('renameConversation', () => {
    it('should rename conversation', async () => {
      jest.spyOn(storageManager, 'getConversation').mockResolvedValue(sampleConversation);
      jest.spyOn(storageManager, 'saveConversation').mockResolvedValue();
      
      const result = await storageManager.renameConversation('test-conversation', 'New Title');
      
      expect(result.title).toBe('New Title');
    });
    
    it('should throw error when renaming nonexistent conversation', async () => {
      jest.spyOn(storageManager, 'getConversation').mockResolvedValue(null);
      
      await expect(storageManager.renameConversation('nonexistent', 'New Title')).rejects.toThrow(ConversationNotFoundError);
    });
  });

  describe('import/export', () => {
    it('should export to markdown', async () => {
      jest.spyOn(storageManager, 'getConversation').mockResolvedValue(sampleConversation);
      await storageManager.exportToMarkdown('test-conversation');
      expect(StorageUtils.exportConversation).toHaveBeenCalledWith(app, sampleConversation, 'markdown');
    });

    it('should throw error when exporting nonexistent conversation to markdown', async () => {
      jest.spyOn(storageManager, 'getConversation').mockResolvedValue(null);
      await expect(storageManager.exportToMarkdown('nonexistent')).rejects.toThrow(ConversationNotFoundError);
    });

    it('should handle export error for markdown', async () => {
      jest.spyOn(storageManager, 'getConversation').mockResolvedValue(sampleConversation);
      (StorageUtils.exportConversation as jest.Mock).mockRejectedValue(new Error('Export failed'));
      
      await expect(storageManager.exportToMarkdown('test-conversation')).rejects.toThrow();
    });

    it('should export to json', async () => {
      jest.spyOn(storageManager, 'getConversation').mockResolvedValue(sampleConversation);
      await storageManager.exportToJson('test-conversation');
      expect(StorageUtils.exportConversation).toHaveBeenCalledWith(app, sampleConversation, 'json');
    });

    it('should throw error when exporting nonexistent conversation to json', async () => {
      jest.spyOn(storageManager, 'getConversation').mockResolvedValue(null);
      await expect(storageManager.exportToJson('nonexistent')).rejects.toThrow(ConversationNotFoundError);
    });

    it('should import from markdown', async () => {
      const markdown = `# Test Conversation\n\nUser: Hello\n\nAssistant: Hi there!`;
      jest.spyOn(storageManager, 'saveConversation').mockResolvedValue();
      
      const result = await storageManager.importFromMarkdown(markdown);
      expect(StorageUtils.parseMarkdownToConversation).toHaveBeenCalledWith(markdown);
      expect(result.title).toBe('Test Conversation');
      expect(result.messages).toHaveLength(2);
    });

    it('should handle import error for markdown', async () => {
      const markdown = `Invalid markdown`;
      (StorageUtils.parseMarkdownToConversation as jest.Mock).mockImplementation(() => {
        throw new Error('Parse failed');
      });
      
      await expect(storageManager.importFromMarkdown(markdown)).rejects.toThrow();
    });

    it('should import from json', async () => {
      const importedConversation = { ...sampleConversation, id: 'imported-conversation' };
      jest.spyOn(storageManager, 'saveConversation').mockResolvedValue();
      
      const result = await storageManager.importConversation(JSON.stringify(importedConversation));
      expect(StorageUtils.parseJsonToConversation).toHaveBeenCalledWith(JSON.stringify(importedConversation));
      expect(result.id).toBe('new-id');
      expect(result.title).toBe('Test Import (Import)');
    });

    it('should handle import error for json', async () => {
      const json = `Invalid json`;
      (StorageUtils.parseJsonToConversation as jest.Mock).mockImplementation(() => {
        throw new Error('Parse failed');
      });
      
      await expect(storageManager.importConversation(json)).rejects.toThrow();
    });
  });

  describe('backup', () => {
    it('should create conversation backup', async () => {
      jest.spyOn(storageManager, 'getConversation').mockResolvedValue(sampleConversation);
      jest.spyOn(app.vault, 'createFolder').mockImplementation(async (path: string) => new mockTFolder(path));
      
      const backupPath = await storageManager.backupConversation('test-conversation');
      expect(backupPath).toBeDefined();
      expect(StorageUtils.backupConversation).toHaveBeenCalledWith(
        app,
        sampleConversation,
        'conversations/backups'
      );
    });

    it('should throw error when backing up nonexistent conversation', async () => {
      jest.spyOn(storageManager, 'getConversation').mockResolvedValue(null);
      await expect(storageManager.backupConversation('nonexistent'))
        .rejects.toThrow(ConversationNotFoundError);
    });

    it('should handle backup error', async () => {
      jest.spyOn(storageManager, 'getConversation').mockResolvedValue(sampleConversation);
      (StorageUtils.backupConversation as jest.Mock).mockRejectedValue(new Error('Backup failed'));
      
      await expect(storageManager.backupConversation('test-conversation')).rejects.toThrow();
    });
  });

  describe('event handling', () => {
    it('should handle file creation events', async () => {
      // Setup the vault.on mock to capture handlers
      const handlers: Record<string, Function> = {};
      (app.vault.on as jest.Mock).mockImplementation((event: string, handler: Function) => {
        handlers[event] = handler;
        return 'event-ref';
      });
      
      // Initialize to register handlers
      await storageManager.initialize();
      
      // Create a mock file
      const mockFile = new mockTFile('conversations/new-conversation.json');
      
      // Mock the loadConversation method
      jest.spyOn(storageManager as any, 'loadConversation').mockResolvedValue(sampleConversation);
      
      // Trigger the event
      await handlers['create'](mockFile);
      
      // Verify the event was emitted
      expect(eventBus.emit).toHaveBeenCalledWith('conversation:loaded', sampleConversation);
    });
    
    it('should handle file modification events', async () => {
      // Setup the vault.on mock to capture handlers
      const handlers: Record<string, Function> = {};
      (app.vault.on as jest.Mock).mockImplementation((event: string, handler: Function) => {
        handlers[event] = handler;
        return 'event-ref';
      });
      
      // Initialize to register handlers
      await storageManager.initialize();
      
      // Create a mock file
      const mockFile = new mockTFile('conversations/test-conversation.json');
      
      // Mock the loadConversation method
      jest.spyOn(storageManager as any, 'loadConversation').mockResolvedValue(sampleConversation);
      
      // Trigger the event
      await handlers['modify'](mockFile);
      
      // Verify the event was emitted
      expect(eventBus.emit).toHaveBeenCalledWith('conversation:updated', expect.any(Object));
    });
    
    it('should handle file deletion events', async () => {
      // Setup the vault.on mock to capture handlers
      const handlers: Record<string, Function> = {};
      (app.vault.on as jest.Mock).mockImplementation((event: string, handler: Function) => {
        handlers[event] = handler;
        return 'event-ref';
      });
      
      // Initialize to register handlers
      await storageManager.initialize();
      
      // Create a mock file
      const mockFile = new mockTFile('conversations/test-conversation.json');
      
      // Trigger the event
      handlers['delete'](mockFile);
      
      // Verify the event was emitted
      expect(eventBus.emit).toHaveBeenCalledWith('conversation:deleted', 'test-conversation');
    });
    
    it('should handle file rename events', async () => {
      // Setup the vault.on mock to capture handlers
      const handlers: Record<string, Function> = {};
      (app.vault.on as jest.Mock).mockImplementation((event: string, handler: Function) => {
        handlers[event] = handler;
        return 'event-ref';
      });
      
      // Initialize to register handlers
      await storageManager.initialize();
      
      // Create a mock file
      const mockFile = new mockTFile('conversations/new-name.json');
      
      // Trigger the event
      handlers['rename'](mockFile, 'conversations/old-name.json');
      
      // Verify the event was emitted
      expect(eventBus.emit).toHaveBeenCalledWith('conversation:renamed', {
        oldId: 'old-name',
        newId: 'new-name'
      });
    });
  });
});
