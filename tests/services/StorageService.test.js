/**
 * Tests for the StorageService class.
 *
 * These tests verify the functionality of the StorageService class,
 * which provides a service layer for plugin integration with the storage system.
 */
import { StorageManager } from '../../src/core/StorageManager';
import { StorageService } from '../../src/services/StorageService';
import { MessageRole } from '../../src/models/Conversation';
import { ConversationNotFoundError, MessageNotFoundError } from '../../src/core/StorageErrors';
// Mock dependencies
jest.mock('../../src/core/StorageManager');
jest.mock('../../src/core/EventBus');
describe('StorageService', () => {
    let app;
    let plugin;
    let eventBus;
    let settings;
    let storageManager;
    let storageService;
    // Sample conversation for testing
    const sampleConversation = {
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
        app = {};
        plugin = {
            registerEvent: jest.fn(),
        };
        eventBus = {
            emit: jest.fn(),
            on: jest.fn().mockReturnValue({ id: 'event-subscription' }),
        };
        settings = {};
        // Mock StorageManager constructor and get instance
        storageManager = new StorageManager(app, plugin, settings, eventBus);
        StorageManager.mockImplementation(() => storageManager);
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
            const updatedConversation = await storageService.updateMessage('test-conversation', 'msg1', 'Updated content');
            // Should call storage manager
            expect(storageManager.updateMessage).toHaveBeenCalledWith('test-conversation', 'msg1', 'Updated content');
            // Should return updated conversation
            expect(updatedConversation).toEqual(sampleConversation);
        });
        it('should handle errors', async () => {
            // Mock updateMessage method to throw error
            storageManager.updateMessage.mockRejectedValue(new MessageNotFoundError('test-conversation', 'msg1'));
            await expect(storageService.updateMessage('test-conversation', 'msg1', 'Updated content'))
                .rejects.toThrow(MessageNotFoundError);
            // Should call storage manager
            expect(storageManager.updateMessage).toHaveBeenCalledWith('test-conversation', 'msg1', 'Updated content');
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
                storageService.handleStorageError(error);
                // Should emit error event
                expect(eventBus.emit).toHaveBeenCalledWith('storage:error', { error });
                // Should log error
                expect(console.error).toHaveBeenCalled();
            });
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU3RvcmFnZVNlcnZpY2UudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIlN0b3JhZ2VTZXJ2aWNlLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7O0dBS0c7QUFLSCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDL0QsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ25FLE9BQU8sRUFBZ0IsV0FBVyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDMUUsT0FBTyxFQUNMLHlCQUF5QixFQUN6QixvQkFBb0IsRUFDckIsTUFBTSw4QkFBOEIsQ0FBQztBQUV0QyxvQkFBb0I7QUFDcEIsSUFBSSxDQUFDLElBQUksQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO0FBQzNDLElBQUksQ0FBQyxJQUFJLENBQUMseUJBQXlCLENBQUMsQ0FBQztBQUVyQyxRQUFRLENBQUMsZ0JBQWdCLEVBQUUsR0FBRyxFQUFFO0lBQzlCLElBQUksR0FBUSxDQUFDO0lBQ2IsSUFBSSxNQUEyQixDQUFDO0lBQ2hDLElBQUksUUFBK0IsQ0FBQztJQUNwQyxJQUFJLFFBQXlCLENBQUM7SUFDOUIsSUFBSSxjQUEyQyxDQUFDO0lBQ2hELElBQUksY0FBOEIsQ0FBQztJQUVuQyxrQ0FBa0M7SUFDbEMsTUFBTSxrQkFBa0IsR0FBaUI7UUFDdkMsRUFBRSxFQUFFLG1CQUFtQjtRQUN2QixLQUFLLEVBQUUsbUJBQW1CO1FBQzFCLFNBQVMsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO1FBQ3JCLFVBQVUsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO1FBQ3RCLFFBQVEsRUFBRTtZQUNSO2dCQUNFLEVBQUUsRUFBRSxNQUFNO2dCQUNWLElBQUksRUFBRSxXQUFXLENBQUMsSUFBSTtnQkFDdEIsT0FBTyxFQUFFLE9BQU87Z0JBQ2hCLFNBQVMsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO2FBQ3RCO1lBQ0Q7Z0JBQ0UsRUFBRSxF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Z0JBRXZFLG1CQUFtQjtnQkFDbkIsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1lBQzNDLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIFRlc3RzIGZvciB0aGUgU3RvcmFnZVNlcnZpY2UgY2xhc3MuXHJcbiAqIFxyXG4gKiBUaGVzZSB0ZXN0cyB2ZXJpZnkgdGhlIGZ1bmN0aW9uYWxpdHkgb2YgdGhlIFN0b3JhZ2VTZXJ2aWNlIGNsYXNzLFxyXG4gKiB3aGljaCBwcm92aWRlcyBhIHNlcnZpY2UgbGF5ZXIgZm9yIHBsdWdpbiBpbnRlZ3JhdGlvbiB3aXRoIHRoZSBzdG9yYWdlIHN5c3RlbS5cclxuICovXHJcblxyXG5pbXBvcnQgeyBBcHAsIFBsdWdpbiB9IGZyb20gJy4uLy4uL3NyYy91dGlscy9vYnNpZGlhbi1pbXBvcnRzJztcclxuaW1wb3J0IHsgRXZlbnRCdXMgfSBmcm9tICcuLi8uLi9zcmMvY29yZS9FdmVudEJ1cyc7XHJcbmltcG9ydCB7IFNldHRpbmdzTWFuYWdlciB9IGZyb20gJy4uLy4uL3NyYy9jb3JlL1NldHRpbmdzTWFuYWdlcic7XHJcbmltcG9ydCB7IFN0b3JhZ2VNYW5hZ2VyIH0gZnJvbSAnLi4vLi4vc3JjL2NvcmUvU3RvcmFnZU1hbmFnZXInO1xyXG5pbXBvcnQgeyBTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uL3NyYy9zZXJ2aWNlcy9TdG9yYWdlU2VydmljZSc7XHJcbmltcG9ydCB7IENvbnZlcnNhdGlvbiwgTWVzc2FnZVJvbGUgfSBmcm9tICcuLi8uLi9zcmMvbW9kZWxzL0NvbnZlcnNhdGlvbic7XHJcbmltcG9ydCB7IFxyXG4gIENvbnZlcnNhdGlvbk5vdEZvdW5kRXJyb3IsXHJcbiAgTWVzc2FnZU5vdEZvdW5kRXJyb3IgXHJcbn0gZnJvbSAnLi4vLi4vc3JjL2NvcmUvU3RvcmFnZUVycm9ycyc7XHJcblxyXG4vLyBNb2NrIGRlcGVuZGVuY2llc1xyXG5qZXN0Lm1vY2soJy4uLy4uL3NyYy9jb3JlL1N0b3JhZ2VNYW5hZ2VyJyk7XHJcbmplc3QubW9jaygnLi4vLi4vc3JjL2NvcmUvRXZlbnRCdXMnKTtcclxuXHJcbmRlc2NyaWJlKCdTdG9yYWdlU2VydmljZScsICgpID0+IHtcclxuICBsZXQgYXBwOiBBcHA7XHJcbiAgbGV0IHBsdWdpbjogamVzdC5Nb2NrZWQ8UGx1Z2luPjtcclxuICBsZXQgZXZlbnRCdXM6IGplc3QuTW9ja2VkPEV2ZW50QnVzPjtcclxuICBsZXQgc2V0dGluZ3M6IFNldHRpbmdzTWFuYWdlcjtcclxuICBsZXQgc3RvcmFnZU1hbmFnZXI6IGplc3QuTW9ja2VkPFN0b3JhZ2VNYW5hZ2VyPjtcclxuICBsZXQgc3RvcmFnZVNlcnZpY2U6IFN0b3JhZ2VTZXJ2aWNlO1xyXG4gIFxyXG4gIC8vIFNhbXBsZSBjb252ZXJzYXRpb24gZm9yIHRlc3RpbmdcclxuICBjb25zdCBzYW1wbGVDb252ZXJzYXRpb246IENvbnZlcnNhdGlvbiA9IHtcclxuICAgIGlkOiAndGVzdC1jb252ZXJzYXRpb24nLFxyXG4gICAgdGl0bGU6ICdUZXN0IENvbnZlcnNhdGlvbicsXHJcbiAgICBjcmVhdGVkQXQ6IERhdGUubm93KCksXHJcbiAgICBtb2RpZmllZEF0OiBEYXRlLm5vdygpLFxyXG4gICAgbWVzc2FnZXM6IFtcclxuICAgICAge1xyXG4gICAgICAgIGlkOiAnbXNnMScsXHJcbiAgICAgICAgcm9sZTogTWVzc2FnZVJvbGUuVXNlcixcclxuICAgICAgICBjb250ZW50OiAnSGVsbG8nLFxyXG4gICAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcclxuICAgICAgfSxcclxuICAgICAge1xyXG4gICAgICAgIGlkOiAnbXNnMicsXHJcbiAgICAgICAgcm9sZTogTWVzc2FnZVJvbGUuQXNzaXN0YW50LFxyXG4gICAgICAgIGNvbnRlbnQ6ICdIaSB0aGVyZSEnLFxyXG4gICAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcclxuICAgICAgfSxcclxuICAgIF0sXHJcbiAgfTtcclxuICBcclxuICBiZWZvcmVFYWNoKGFzeW5jICgpID0+IHtcclxuICAgIC8vIFJlc2V0IG1vY2tzXHJcbiAgICBqZXN0LmNsZWFyQWxsTW9ja3MoKTtcclxuICAgIFxyXG4gICAgLy8gQ3JlYXRlIGRlcGVuZGVuY2llc1xyXG4gICAgYXBwID0ge30gYXMgQXBwO1xyXG4gICAgcGx1Z2luID0ge1xyXG4gICAgICByZWdpc3RlckV2ZW50OiBqZXN0LmZuKCksXHJcbiAgICB9IGFzIHVua25vd24gYXMgamVzdC5Nb2NrZWQ8UGx1Z2luPjtcclxuICAgIGV2ZW50QnVzID0ge1xyXG4gICAgICBlbWl0OiBqZXN0LmZuKCksXHJcbiAgICAgIG9uOiBqZXN0LmZuKCkubW9ja1JldHVyblZhbHVlKHsgaWQ6ICdldmVudC1zdWJzY3JpcHRpb24nIH0pLFxyXG4gICAgfSBhcyB1bmtub3duIGFzIGplc3QuTW9ja2VkPEV2ZW50QnVzPjtcclxuICAgIHNldHRpbmdzID0ge30gYXMgU2V0dGluZ3NNYW5hZ2VyO1xyXG4gICAgXHJcbiAgICAvLyBNb2NrIFN0b3JhZ2VNYW5hZ2VyIGNvbnN0cnVjdG9yIGFuZCBnZXQgaW5zdGFuY2VcclxuICAgIHN0b3JhZ2VNYW5hZ2VyID0gbmV3IFN0b3JhZ2VNYW5hZ2VyKGFwcCwgcGx1Z2luLCBzZXR0aW5ncywgZXZlbnRCdXMpIGFzIGplc3QuTW9ja2VkPFN0b3JhZ2VNYW5hZ2VyPjtcclxuICAgIChTdG9yYWdlTWFuYWdlciBhcyBqZXN0Lk1vY2tlZENsYXNzPHR5cGVvZiBTdG9yYWdlTWFuYWdlcj4pLm1vY2tJbXBsZW1lbnRhdGlvbigoKSA9PiBzdG9yYWdlTWFuYWdlcik7XHJcbiAgICBcclxuICAgIC8vIENyZWF0ZSBzdG9yYWdlIHNlcnZpY2VcclxuICAgIHN0b3JhZ2VTZXJ2aWNlID0gbmV3IFN0b3JhZ2VTZXJ2aWNlKGFwcCwgcGx1Z2luLCBldmVudEJ1cywgc2V0dGluZ3MpO1xyXG4gICAgXHJcbiAgICAvLyBJbml0aWFsaXplIHN0b3JhZ2VTZXJ2aWNlIChjcmVhdGVzIHN0b3JhZ2VNYW5hZ2VyIGluc3RhbmNlKVxyXG4gICAgYXdhaXQgc3RvcmFnZVNlcnZpY2UuaW5pdGlhbGl6ZSgpO1xyXG4gIH0pO1xyXG4gIFxyXG4gIGRlc2NyaWJlKCdpbml0aWFsaXplJywgKCkgPT4ge1xyXG4gICAgaXQoJ3Nob3VsZCBpbml0aWFsaXplIHRoZSBzdG9yYWdlIG1hbmFnZXInLCBhc3luYyAoKSA9PiB7XHJcbiAgICAgIC8vIE1vY2sgaW5pdGlhbGl6ZSBtZXRob2RcclxuICAgICAgc3RvcmFnZU1hbmFnZXIuaW5pdGlhbGl6ZS5tb2NrUmVzb2x2ZWRWYWx1ZSgpO1xyXG4gICAgICBcclxuICAgICAgYXdhaXQgc3RvcmFnZVNlcnZpY2UuaW5pdGlhbGl6ZSgpO1xyXG4gICAgICBcclxuICAgICAgLy8gU2hvdWxkIGluaXRpYWxpemUgc3RvcmFnZSBtYW5hZ2VyXHJcbiAgICAgIGV4cGVjdChzdG9yYWdlTWFuYWdlci5pbml0aWFsaXplKS50b0hhdmVCZWVuQ2FsbGVkKCk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBTaG91bGQgZW1pdCBldmVudFxyXG4gICAgICBleHBlY3QoZXZlbnRCdXMuZW1pdCkudG9IYXZlQmVlbkNhbGxlZFdpdGgoJ3N0b3JhZ2U6aW5pdGlhbGl6ZWQnLCB1bmRlZmluZWQpO1xyXG4gICAgICBcclxuICAgICAgLy8gU2hvdWxkIHJlZ2lzdGVyIHBsdWdpbiB1bmxvYWQgZXZlbnRcclxuICAgICAgZXhwZWN0KHBsdWdpbi5yZWdpc3RlckV2ZW50KS50b0hhdmVCZWVuQ2FsbGVkKCk7XHJcbiAgICB9KTtcclxuICB9KTtcclxuICBcclxuICBkZXNjcmliZSgnZ2V0Q29udmVyc2F0aW9ucycsICgpID0+IHtcclxuICAgIGl0KCdzaG91bGQgcmV0dXJuIGNvbnZlcnNhdGlvbnMgZnJvbSBzdG9yYWdlIG1hbmFnZXInLCBhc3luYyAoKSA9PiB7XHJcbiAgICAgIC8vIE1vY2sgZ2V0Q29udmVyc2F0aW9ucyBtZXRob2RcclxuICAgICAgc3RvcmFnZU1hbmFnZXIuZ2V0Q29udmVyc2F0aW9ucy5tb2NrUmVzb2x2ZWRWYWx1ZShbc2FtcGxlQ29udmVyc2F0aW9uXSk7XHJcbiAgICAgIFxyXG4gICAgICBjb25zdCBjb252ZXJzYXRpb25zID0gYXdhaXQgc3RvcmFnZVNlcnZpY2UuZ2V0Q29udmVyc2F0aW9ucygpO1xyXG4gICAgICBcclxuICAgICAgLy8gU2hvdWxkIGNhbGwgc3RvcmFnZSBtYW5hZ2VyXHJcbiAgICAgIGV4cGVjdChzdG9yYWdlTWFuYWdlci5nZXRDb252ZXJzYXRpb25zKS50b0hhdmVCZWVuQ2FsbGVkKCk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBTaG91bGQgcmV0dXJuIGNvbnZlcnNhdGlvbnNcclxuICAgICAgZXhwZWN0KGNvbnZlcnNhdGlvbnMpLnRvRXF1YWwoW3NhbXBsZUNvbnZlcnNhdGlvbl0pO1xyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIGl0KCdzaG91bGQgaGFuZGxlIGVycm9ycyBhbmQgcmV0dXJuIGVtcHR5IGFycmF5JywgYXN5bmMgKCkgPT4ge1xyXG4gICAgICAvLyBNb2NrIGdldENvbnZlcnNhdGlvbnMgbWV0aG9kIHRvIHRocm93IGVycm9yXHJcbiAgICAgIHN0b3JhZ2VNYW5hZ2VyLmdldENvbnZlcnNhdGlvbnMubW9ja1JlamVjdGVkVmFsdWUobmV3IEVycm9yKCdUZXN0IGVycm9yJykpO1xyXG4gICAgICBcclxuICAgICAgY29uc3QgY29udmVyc2F0aW9ucyA9IGF3YWl0IHN0b3JhZ2VTZXJ2aWNlLmdldENvbnZlcnNhdGlvbnMoKTtcclxuICAgICAgXHJcbiAgICAgIC8vIFNob3VsZCBjYWxsIHN0b3JhZ2UgbWFuYWdlclxyXG4gICAgICBleHBlY3Qoc3RvcmFnZU1hbmFnZXIuZ2V0Q29udmVyc2F0aW9ucykudG9IYXZlQmVlbkNhbGxlZCgpO1xyXG4gICAgICBcclxuICAgICAgLy8gU2hvdWxkIHJldHVybiBlbXB0eSBhcnJheVxyXG4gICAgICBleHBlY3QoY29udmVyc2F0aW9ucykudG9FcXVhbChbXSk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBTaG91bGQgZW1pdCBlcnJvciBldmVudFxyXG4gICAgICBleHBlY3QoZXZlbnRCdXMuZW1pdCkudG9IYXZlQmVlbkNhbGxlZFdpdGgoJ3N0b3JhZ2U6ZXJyb3InLCB7XHJcbiAgICAgICAgZXJyb3I6IGV4cGVjdC5hbnkoRXJyb3IpLFxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG4gIFxyXG4gIGRlc2NyaWJlKCdnZXRDb252ZXJzYXRpb24nLCAoKSA9PiB7XHJcbiAgICBpdCgnc2hvdWxkIHJldHVybiBjb252ZXJzYXRpb24gZnJvbSBzdG9yYWdlIG1hbmFnZXInLCBhc3luYyAoKSA9PiB7XHJcbiAgICAgIC8vIE1vY2sgZ2V0Q29udmVyc2F0aW9uIG1ldGhvZFxyXG4gICAgICBzdG9yYWdlTWFuYWdlci5nZXRDb252ZXJzYXRpb24ubW9ja1Jlc29sdmVkVmFsdWUoc2FtcGxlQ29udmVyc2F0aW9uKTtcclxuICAgICAgXHJcbiAgICAgIGNvbnN0IGNvbnZlcnNhdGlvbiA9IGF3YWl0IHN0b3JhZ2VTZXJ2aWNlLmdldENvbnZlcnNhdGlvbigndGVzdC1jb252ZXJzYXRpb24nKTtcclxuICAgICAgXHJcbiAgICAgIC8vIFNob3VsZCBjYWxsIHN0b3JhZ2UgbWFuYWdlclxyXG4gICAgICBleHBlY3Qoc3RvcmFnZU1hbmFnZXIuZ2V0Q29udmVyc2F0aW9uKS50b0hhdmVCZWVuQ2FsbGVkV2l0aCgndGVzdC1jb252ZXJzYXRpb24nKTtcclxuICAgICAgXHJcbiAgICAgIC8vIFNob3VsZCByZXR1cm4gY29udmVyc2F0aW9uXHJcbiAgICAgIGV4cGVjdChjb252ZXJzYXRpb24pLnRvRXF1YWwoc2FtcGxlQ29udmVyc2F0aW9uKTtcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBpdCgnc2hvdWxkIGhhbmRsZSBlcnJvcnMgYW5kIHJldHVybiBudWxsJywgYXN5bmMgKCkgPT4ge1xyXG4gICAgICAvLyBNb2NrIGdldENvbnZlcnNhdGlvbiBtZXRob2QgdG8gdGhyb3cgZXJyb3JcclxuICAgICAgc3RvcmFnZU1hbmFnZXIuZ2V0Q29udmVyc2F0aW9uLm1vY2tSZWplY3RlZFZhbHVlKG5ldyBFcnJvcignVGVzdCBlcnJvcicpKTtcclxuICAgICAgXHJcbiAgICAgIGNvbnN0IGNvbnZlcnNhdGlvbiA9IGF3YWl0IHN0b3JhZ2VTZXJ2aWNlLmdldENvbnZlcnNhdGlvbigndGVzdC1jb252ZXJzYXRpb24nKTtcclxuICAgICAgXHJcbiAgICAgIC8vIFNob3VsZCBjYWxsIHN0b3JhZ2UgbWFuYWdlclxyXG4gICAgICBleHBlY3Qoc3RvcmFnZU1hbmFnZXIuZ2V0Q29udmVyc2F0aW9uKS50b0hhdmVCZWVuQ2FsbGVkV2l0aCgndGVzdC1jb252ZXJzYXRpb24nKTtcclxuICAgICAgXHJcbiAgICAgIC8vIFNob3VsZCByZXR1cm4gbnVsbFxyXG4gICAgICBleHBlY3QoY29udmVyc2F0aW9uKS50b0JlTnVsbCgpO1xyXG4gICAgICBcclxuICAgICAgLy8gU2hvdWxkIGVtaXQgZXJyb3IgZXZlbnRcclxuICAgICAgZXhwZWN0KGV2ZW50QnVzLmVtaXQpLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKCdzdG9yYWdlOmVycm9yJywge1xyXG4gICAgICAgIGVycm9yOiBleHBlY3QuYW55KEVycm9yKSxcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9KTtcclxuICBcclxuICBkZXNjcmliZSgnY3JlYXRlQ29udmVyc2F0aW9uJywgKCkgPT4ge1xyXG4gICAgaXQoJ3Nob3VsZCBjcmVhdGUgY29udmVyc2F0aW9uIHVzaW5nIHN0b3JhZ2UgbWFuYWdlcicsIGFzeW5jICgpID0+IHtcclxuICAgICAgLy8gTW9jayBjcmVhdGVDb252ZXJzYXRpb24gbWV0aG9kXHJcbiAgICAgIHN0b3JhZ2VNYW5hZ2VyLmNyZWF0ZUNvbnZlcnNhdGlvbi5tb2NrUmVzb2x2ZWRWYWx1ZShzYW1wbGVDb252ZXJzYXRpb24pO1xyXG4gICAgICBcclxuICAgICAgY29uc3QgY29udmVyc2F0aW9uID0gYXdhaXQgc3RvcmFnZVNlcnZpY2UuY3JlYXRlQ29udmVyc2F0aW9uKCdUZXN0IENvbnZlcnNhdGlvbicpO1xyXG4gICAgICBcclxuICAgICAgLy8gU2hvdWxkIGNhbGwgc3RvcmFnZSBtYW5hZ2VyXHJcbiAgICAgIGV4cGVjdChzdG9yYWdlTWFuYWdlci5jcmVhdGVDb252ZXJzYXRpb24pLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKCdUZXN0IENvbnZlcnNhdGlvbicpO1xyXG4gICAgICBcclxuICAgICAgLy8gU2hvdWxkIHJldHVybiBjb252ZXJzYXRpb25cclxuICAgICAgZXhwZWN0KGNvbnZlcnNhdGlvbikudG9FcXVhbChzYW1wbGVDb252ZXJzYXRpb24pO1xyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIGl0KCdzaG91bGQgaGFuZGxlIGVycm9ycycsIGFzeW5jICgpID0+IHtcclxuICAgICAgLy8gTW9jayBjcmVhdGVDb252ZXJzYXRpb24gbWV0aG9kIHRvIHRocm93IGVycm9yXHJcbiAgICAgIHN0b3JhZ2VNYW5hZ2VyLmNyZWF0ZUNvbnZlcnNhdGlvbi5tb2NrUmVqZWN0ZWRWYWx1ZShuZXcgRXJyb3IoJ1Rlc3QgZXJyb3InKSk7XHJcbiAgICAgIFxyXG4gICAgICBhd2FpdCBleHBlY3Qoc3RvcmFnZVNlcnZpY2UuY3JlYXRlQ29udmVyc2F0aW9uKCdUZXN0IENvbnZlcnNhdGlvbicpKVxyXG4gICAgICAgIC5yZWplY3RzLnRvVGhyb3coJ1Rlc3QgZXJyb3InKTtcclxuICAgICAgXHJcbiAgICAgIC8vIFNob3VsZCBjYWxsIHN0b3JhZ2UgbWFuYWdlclxyXG4gICAgICBleHBlY3Qoc3RvcmFnZU1hbmFnZXIuY3JlYXRlQ29udmVyc2F0aW9uKS50b0hhdmVCZWVuQ2FsbGVkV2l0aCgnVGVzdCBDb252ZXJzYXRpb24nKTtcclxuICAgICAgXHJcbiAgICAgIC8vIFNob3VsZCBlbWl0IGVycm9yIGV2ZW50XHJcbiAgICAgIGV4cGVjdChldmVudEJ1cy5lbWl0KS50b0hhdmVCZWVuQ2FsbGVkV2l0aCgnc3RvcmFnZTplcnJvcicsIHtcclxuICAgICAgICBlcnJvcjogZXhwZWN0LmFueShFcnJvciksXHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfSk7XHJcbiAgXHJcbiAgZGVzY3JpYmUoJ3VwZGF0ZU1lc3NhZ2UnLCAoKSA9PiB7XHJcbiAgICBpdCgnc2hvdWxkIHVwZGF0ZSBtZXNzYWdlIHVzaW5nIHN0b3JhZ2UgbWFuYWdlcicsIGFzeW5jICgpID0+IHtcclxuICAgICAgLy8gTW9jayB1cGRhdGVNZXNzYWdlIG1ldGhvZFxyXG4gICAgICBzdG9yYWdlTWFuYWdlci51cGRhdGVNZXNzYWdlLm1vY2tSZXNvbHZlZFZhbHVlKHNhbXBsZUNvbnZlcnNhdGlvbik7XHJcbiAgICAgIFxyXG4gICAgICBjb25zdCB1cGRhdGVkQ29udmVyc2F0aW9uID0gYXdhaXQgc3RvcmFnZVNlcnZpY2UudXBkYXRlTWVzc2FnZShcclxuICAgICAgICAndGVzdC1jb252ZXJzYXRpb24nLFxyXG4gICAgICAgICdtc2cxJyxcclxuICAgICAgICAnVXBkYXRlZCBjb250ZW50J1xyXG4gICAgICApO1xyXG4gICAgICBcclxuICAgICAgLy8gU2hvdWxkIGNhbGwgc3RvcmFnZSBtYW5hZ2VyXHJcbiAgICAgIGV4cGVjdChzdG9yYWdlTWFuYWdlci51cGRhdGVNZXNzYWdlKS50b0hhdmVCZWVuQ2FsbGVkV2l0aChcclxuICAgICAgICAndGVzdC1jb252ZXJzYXRpb24nLFxyXG4gICAgICAgICdtc2cxJyxcclxuICAgICAgICAnVXBkYXRlZCBjb250ZW50J1xyXG4gICAgICApO1xyXG4gICAgICBcclxuICAgICAgLy8gU2hvdWxkIHJldHVybiB1cGRhdGVkIGNvbnZlcnNhdGlvblxyXG4gICAgICBleHBlY3QodXBkYXRlZENvbnZlcnNhdGlvbikudG9FcXVhbChzYW1wbGVDb252ZXJzYXRpb24pO1xyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIGl0KCdzaG91bGQgaGFuZGxlIGVycm9ycycsIGFzeW5jICgpID0+IHtcclxuICAgICAgLy8gTW9jayB1cGRhdGVNZXNzYWdlIG1ldGhvZCB0byB0aHJvdyBlcnJvclxyXG4gICAgICBzdG9yYWdlTWFuYWdlci51cGRhdGVNZXNzYWdlLm1vY2tSZWplY3RlZFZhbHVlKG5ldyBNZXNzYWdlTm90Rm91bmRFcnJvcigndGVzdC1jb252ZXJzYXRpb24nLCAnbXNnMScpKTtcclxuICAgICAgXHJcbiAgICAgIGF3YWl0IGV4cGVjdChzdG9yYWdlU2VydmljZS51cGRhdGVNZXNzYWdlKCd0ZXN0LWNvbnZlcnNhdGlvbicsICdtc2cxJywgJ1VwZGF0ZWQgY29udGVudCcpKVxyXG4gICAgICAgIC5yZWplY3RzLnRvVGhyb3coTWVzc2FnZU5vdEZvdW5kRXJyb3IpO1xyXG4gICAgICBcclxuICAgICAgLy8gU2hvdWxkIGNhbGwgc3RvcmFnZSBtYW5hZ2VyXHJcbiAgICAgIGV4cGVjdChzdG9yYWdlTWFuYWdlci51cGRhdGVNZXNzYWdlKS50b0hhdmVCZWVuQ2FsbGVkV2l0aChcclxuICAgICAgICAndGVzdC1jb252ZXJzYXRpb24nLFxyXG4gICAgICAgICdtc2cxJyxcclxuICAgICAgICAnVXBkYXRlZCBjb250ZW50J1xyXG4gICAgICApO1xyXG4gICAgICBcclxuICAgICAgLy8gU2hvdWxkIGVtaXQgZXJyb3IgZXZlbnRcclxuICAgICAgZXhwZWN0KGV2ZW50QnVzLmVtaXQpLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKCdzdG9yYWdlOmVycm9yJywge1xyXG4gICAgICAgIGVycm9yOiBleHBlY3QuYW55KE1lc3NhZ2VOb3RGb3VuZEVycm9yKSxcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9KTtcclxuICBcclxuICBkZXNjcmliZSgnaGFuZGxlU3RvcmFnZUVycm9yJywgKCkgPT4ge1xyXG4gICAgaXQoJ3Nob3VsZCBlbWl0IGVycm9yIGV2ZW50IGFuZCBsb2cgc3BlY2lmaWMgZXJyb3IgdHlwZXMnLCAoKSA9PiB7XHJcbiAgICAgIC8vIENyZWF0ZSBzcHkgZm9yIGNvbnNvbGUuZXJyb3JcclxuICAgICAgamVzdC5zcHlPbihjb25zb2xlLCAnZXJyb3InKS5tb2NrSW1wbGVtZW50YXRpb24oKTtcclxuICAgICAgXHJcbiAgICAgIC8vIFRlc3QgZGlmZmVyZW50IGVycm9yIHR5cGVzXHJcbiAgICAgIGNvbnN0IGVycm9ycyA9IFtcclxuICAgICAgICBuZXcgQ29udmVyc2F0aW9uTm90Rm91bmRFcnJvcigndGVzdC1jb252ZXJzYXRpb24nKSxcclxuICAgICAgICBuZXcgTWVzc2FnZU5vdEZvdW5kRXJyb3IoJ3Rlc3QtY29udmVyc2F0aW9uJywgJ21zZzEnKSxcclxuICAgICAgICBuZXcgRXJyb3IoJ0dlbmVyaWMgZXJyb3InKSxcclxuICAgICAgXTtcclxuICAgICAgXHJcbiAgICAgIGVycm9ycy5mb3JFYWNoKGVycm9yID0+IHtcclxuICAgICAgICAvLyBDYWxsIHByaXZhdGUgbWV0aG9kIHVzaW5nIGFueSB0eXBlIGFzc2VydGlvblxyXG4gICAgICAgIChzdG9yYWdlU2VydmljZSBhcyBhbnkpLmhhbmRsZVN0b3JhZ2VFcnJvcihlcnJvcik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gU2hvdWxkIGVtaXQgZXJyb3IgZXZlbnRcclxuICAgICAgICBleHBlY3QoZXZlbnRCdXMuZW1pdCkudG9IYXZlQmVlbkNhbGxlZFdpdGgoJ3N0b3JhZ2U6ZXJyb3InLCB7IGVycm9yIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFNob3VsZCBsb2cgZXJyb3JcclxuICAgICAgICBleHBlY3QoY29uc29sZS5lcnJvcikudG9IYXZlQmVlbkNhbGxlZCgpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG59KTtcclxuIl19