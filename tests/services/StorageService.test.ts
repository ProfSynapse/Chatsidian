/**
 * Tests for the StorageService class.
 * 
 * These tests verify the functionality of the StorageService class,
 * which provides a service layer for plugin integration with the storage system.
 */

import { App, Plugin } from '../../src/utils/obsidian-imports';
import { EventBus } from '../../src/core/EventBus';
import { SettingsManager } from '../../src/core/SettingsManager';
import { StorageManager } from '../../src/core/StorageManager';
import { StorageService } from '../../src/services/StorageService';
import { Conversation, MessageRole } from '../../src/models/Conversation';
import { 
  ConversationNotFoundError,
  MessageNotFoundError 
} from '../../src/core/StorageErrors';

// Mock dependencies
jest.mock('../../src/core/StorageManager');
jest.mock('../../src/core/EventBus');

describe('StorageService', () => {
  let app: App;
  let plugin: jest.Mocked<Plugin>;
  let eventBus: jest.Mocked<EventBus>;
  let settings: SettingsManager;
  let storageManager: jest.Mocked<StorageManager>;
  let storageService: StorageService;
  
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
  
  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create dependencies
    app = {} as App;
    plugin = {
      registerEvent: jest.fn(),
    } as unknown as jest.Mocked<Plugin>;
    eventBus = {
      emit: jest.fn(),
      on: jest.fn().mockReturnValue({ id: 'event-subscription' }),
    } as unknown as jest.Mocked<EventBus>;
    settings = {} as SettingsManager;
    
    // Mock StorageManager constructor and get instance
    storageManager = new StorageManager(app, plugin, settings, eventBus) as jest.Mocked<StorageManager>;
    (StorageManager as jest.MockedClass<typeof StorageManager>).mockImplementation(() => storageManager);
    
    // Create storage service
    storageService = new StorageService(app, plugin, eventBus, settings);
    
    // Initialize storageService (creates storageManager instance)
    await storageService.initialize();
  });
  
  describe('initialize', () => {
    it('should initialize the storage manager', async () => {
      // Mock initialize method
      storageManager.initialize.mockResolvedValue();
      
      await storageService.initialize();
      
      // Should initialize storage manager
      expect(storageManager.initialize).toHaveBeenCalled();
      
      // Should emit event
      expect(eventBus.emit).toHaveBeenCalledWith('storage:initialized', undefined);
      
      // Should register plugin unload event
      expect(plugin.registerEvent).toHaveBeenCalled();
    });
  });
  
  describe('getConversations', () => {
    it('should return conversations from storage manager', async () => {
      // Mock getConversations method
      storageManager.getConversations.mockResolvedValue([sampleConversation]);
      
      const conversations = await storageService.getConversations();
      
      // Should call storage manager
      expect(storageManager.getConversations).toHaveBeenCalled();
      
      // Should return conversations
      expect(conversations).toEqual([sampleConversation]);
    });
    
    it('should handle errors and return empty array', async () => {
      // Mock getConversations method to throw error
      storageManager.getConversations.mockRejectedValue(new Error('Test error'));
      
      const conversations = await storageService.getConversations();
      
      // Should call storage manager
      expect(storageManager.getConversations).toHaveBeenCalled();
      
      // Should return empty array
      expect(conversations).toEqual([]);
      
      // Should emit error event
      expect(eventBus.emit).toHaveBeenCalledWith('storage:error', {
        error: expect.any(Error),
      });
    });
  });
  
  describe('getConversation', () => {
    it('should return conversation from storage manager', async () => {
      // Mock getConversation method
      storageManager.getConversation.mockResolvedValue(sampleConversation);
      
      const conversation = await storageService.getConversation('test-conversation');
      
      // Should call storage manager
      expect(storageManager.getConversation).toHaveBeenCalledWith('test-conversation');
      
      // Should return conversation
      expect(conversation).toEqual(sampleConversation);
    });
    
    it('should handle errors and return null', async () => {
      // Mock getConversation method to throw error
      storageManager.getConversation.mockRejectedValue(new Error('Test error'));
      
      const conversation = await storageService.getConversation('test-conversation');
      
      // Should call storage manager
      expect(storageManager.getConversation).toHaveBeenCalledWith('test-conversation');
      
      // Should return null
      expect(conversation).toBeNull();
      
      // Should emit error event
      expect(eventBus.emit).toHaveBeenCalledWith('storage:error', {
        error: expect.any(Error),
      });
    });
  });
  
  describe('createConversation', () => {
    it('should create conversation using storage manager', async () => {
      // Mock createConversation method
      storageManager.createConversation.mockResolvedValue(sampleConversation);
      
      const conversation = await storageService.createConversation('Test Conversation');
      
      // Should call storage manager
      expect(storageManager.createConversation).toHaveBeenCalledWith('Test Conversation');
      
      // Should return conversation
      expect(conversation).toEqual(sampleConversation);
    });
    
    it('should handle errors', async () => {
      // Mock createConversation method to throw error
      storageManager.createConversation.mockRejectedValue(new Error('Test error'));
      
      await expect(storageService.createConversation('Test Conversation'))
        .rejects.toThrow('Test error');
      
      // Should call storage manager
      expect(storageManager.createConversation).toHaveBeenCalledWith('Test Conversation');
      
      // Should emit error event
      expect(eventBus.emit).toHaveBeenCalledWith('storage:error', {
        error: expect.any(Error),
      });
    });
  });
  
  describe('updateMessage', () => {
    it('should update message using storage manager', async () => {
      // Mock updateMessage method
      storageManager.updateMessage.mockResolvedValue(sampleConversation);
      
      const updatedConversation = await storageService.updateMessage(
        'test-conversation',
        'msg1',
        'Updated content'
      );
      
      // Should call storage manager
      expect(storageManager.updateMessage).toHaveBeenCalledWith(
        'test-conversation',
        'msg1',
        'Updated content'
      );
      
      // Should return updated conversation
      expect(updatedConversation).toEqual(sampleConversation);
    });
    
    it('should handle errors', async () => {
      // Mock updateMessage method to throw error
      storageManager.updateMessage.mockRejectedValue(new MessageNotFoundError('test-conversation', 'msg1'));
      
      await expect(storageService.updateMessage('test-conversation', 'msg1', 'Updated content'))
        .rejects.toThrow(MessageNotFoundError);
      
      // Should call storage manager
      expect(storageManager.updateMessage).toHaveBeenCalledWith(
        'test-conversation',
        'msg1',
        'Updated content'
      );
      
      // Should emit error event
      expect(eventBus.emit).toHaveBeenCalledWith('storage:error', {
        error: expect.any(MessageNotFoundError),
      });
    });
  });
  
  describe('handleStorageError', () => {
    it('should emit error event and log specific error types', () => {
      // Create spy for console.error
      jest.spyOn(console, 'error').mockImplementation();
      
      // Test different error types
      const errors = [
        new ConversationNotFoundError('test-conversation'),
        new MessageNotFoundError('test-conversation', 'msg1'),
        new Error('Generic error'),
      ];
      
      errors.forEach(error => {
        // Call private method using any type assertion
        (storageService as any).handleStorageError(error);
        
        // Should emit error event
        expect(eventBus.emit).toHaveBeenCalledWith('storage:error', { error });
        
        // Should log error
        expect(console.error).toHaveBeenCalled();
      });
    });
  });
});
