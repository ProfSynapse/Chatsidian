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

describe('StorageService', () => {
  let app: App;
  let plugin: Plugin;
  let eventBus: EventBus;
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
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create dependencies
    app = {} as App;
    plugin = {} as Plugin;
    eventBus = new EventBus();
    settings = {} as SettingsManager;
    
    // Create storage service
    storageService = new StorageService(app, plugin, eventBus, settings);
    
    // Get the mocked StorageManager instance
    storageManager = (StorageManager as jest.MockedClass<typeof StorageManager>).mock.instances[0] as jest.Mocked<StorageManager>;
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
  
  describe('saveConversation', () => {
    it('should save conversation using storage manager', async () => {
      // Mock saveConversation method
      storageManager.saveConversation.mockResolvedValue();
      
      await storageService.saveConversation(sampleConversation);
      
      // Should call storage manager
      expect(storageManager.saveConversation).toHaveBeenCalledWith(sampleConversation);
    });
    
    it('should handle errors', async () => {
      // Mock saveConversation method to throw error
      storageManager.saveConversation.mockRejectedValue(new Error('Test error'));
      
      await expect(storageService.saveConversation(sampleConversation))
        .rejects.toThrow('Test error');
      
      // Should call storage manager
      expect(storageManager.saveConversation).toHaveBeenCalledWith(sampleConversation);
      
      // Should emit error event
      expect(eventBus.emit).toHaveBeenCalledWith('storage:error', {
        error: expect.any(Error),
      });
    });
  });
  
  describe('deleteConversation', () => {
    it('should delete conversation using storage manager', async () => {
      // Mock deleteConversation method
      storageManager.deleteConversation.mockResolvedValue();
      
      await storageService.deleteConversation('test-conversation');
      
      // Should call storage manager
      expect(storageManager.deleteConversation).toHaveBeenCalledWith('test-conversation');
    });
    
    it('should handle errors', async () => {
      // Mock deleteConversation method to throw error
      storageManager.deleteConversation.mockRejectedValue(new Error('Test error'));
      
      await expect(storageService.deleteConversation('test-conversation'))
        .rejects.toThrow('Test error');
      
      // Should call storage manager
      expect(storageManager.deleteConversation).toHaveBeenCalledWith('test-conversation');
      
      // Should emit error event
      expect(eventBus.emit).toHaveBeenCalledWith('storage:error', {
        error: expect.any(Error),
      });
    });
  });
  
  describe('addMessage', () => {
    it('should add message using storage manager', async () => {
      // Mock addMessage method
      storageManager.addMessage.mockResolvedValue(sampleConversation);
      
      const message = {
        id: 'new-msg',
        role: MessageRole.User,
        content: 'New message',
        timestamp: Date.now(),
      };
      
      const updatedConversation = await storageService.addMessage('test-conversation', message);
      
      // Should call storage manager
      expect(storageManager.addMessage).toHaveBeenCalledWith('test-conversation', message);
      
      // Should return updated conversation
      expect(updatedConversation).toEqual(sampleConversation);
    });
    
    it('should handle errors', async () => {
      // Mock addMessage method to throw error
      storageManager.addMessage.mockRejectedValue(new ConversationNotFoundError('test-conversation'));
      
      const message = {
        id: 'new-msg',
        role: MessageRole.User,
        content: 'New message',
        timestamp: Date.now(),
      };
      
      await expect(storageService.addMessage('test-conversation', message))
        .rejects.toThrow(ConversationNotFoundError);
      
      // Should call storage manager
      expect(storageManager.addMessage).toHaveBeenCalledWith('test-conversation', message);
      
      // Should emit error event
      expect(eventBus.emit).toHaveBeenCalledWith('storage:error', {
        error: expect.any(ConversationNotFoundError),
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
