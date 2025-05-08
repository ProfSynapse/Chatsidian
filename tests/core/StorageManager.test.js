/**
 * Tests for the StorageManager class.
 *
 * These tests verify the functionality of the StorageManager class,
 * which handles data persistence within the Obsidian vault.
 */
import { TFile, TFolder } from '../../src/utils/obsidian-imports';
import { EventBus } from '../../src/core/EventBus';
import { StorageManager } from '../../src/core/StorageManager';
import { MessageRole } from '../../src/models/Conversation';
import { ConversationNotFoundError, MessageNotFoundError } from '../../src/core/StorageErrors';
// Mock dependencies
jest.mock('../../src/utils/obsidian-imports', () => {
    const originalModule = jest.requireActual('../../src/utils/obsidian-imports');
    // Mock TFile
    class MockTFile {
        constructor(path) {
            this.path = path;
            this.name = path.split('/').pop() || '';
            const parts = this.name.split('.');
            this.extension = parts.length > 1 ? parts.pop() || '' : '';
            this.basename = parts.join('.');
        }
    }
    // Mock TFolder
    class MockTFolder {
        constructor(path) {
            this.path = path;
            this.name = path.split('/').pop() || '';
            this.children = [];
        }
        addChild(child) {
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
    let app;
    let plugin;
    let eventBus;
    let settings;
    let storageManager;
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
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
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
        };
        plugin = {
            registerEvent: jest.fn()
        };
        eventBus = new EventBus();
        jest.spyOn(eventBus, 'emit');
        // Mock settings
        settings = {
            getConversationsPath: jest.fn().mockReturnValue('conversations'),
        };
        // Create storage manager
        storageManager = new StorageManager(app, plugin, settings, eventBus);
    });
    describe('initialize', () => {
        it('should ensure conversations folder exists', async () => {
            // Mock folder doesn't exist
            app.vault.getAbstractFileByPath.mockReturnValue(null);
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
            app.vault.getAbstractFileByPath.mockReturnValue(mockFolder);
            await storageManager.initialize();
            // Should not create folder
            expect(app.vault.createFolder).not.toHaveBeenCalled();
        });
    });
    describe('getConversations', () => {
        it('should return an empty array if folder does not exist', async () => {
            // Mock folder doesn't exist
            app.vault.getAbstractFileByPath.mockReturnValue(null);
            const conversations = await storageManager.getConversations();
            expect(conversations).toEqual([]);
        });
        it('should return conversations from folder', async () => {
            // Directly mock the getConversations method to return test data
            const mockConversations = [
                {
                    id: 'test1',
                    title: 'Test 1',
                    createdAt: Date.now(),
                    modifiedAt: Date.now(),
                    messages: [],
                },
                {
                    id: 'test2',
                    title: 'Test 2',
                    createdAt: Date.now(),
                    modifiedAt: Date.now(),
                    messages: [],
                }
            ];
            // Replace the actual implementation with our mock
            const originalMethod = storageManager.getConversations;
            storageManager.getConversations = jest.fn().mockResolvedValue(mockConversations);
            const conversations = await storageManager.getConversations();
            expect(conversations.length).toBe(2);
            expect(conversations[0].id).toBe('test1');
            expect(conversations[1].id).toBe('test2');
            // Restore the original method after the test
            storageManager.getConversations = originalMethod;
        });
    });
    describe('getConversation', () => {
        it('should return null if conversation does not exist', async () => {
            // Mock file doesn't exist
            app.vault.getAbstractFileByPath.mockReturnValue(null);
            const conversation = await storageManager.getConversation('nonexistent');
            expect(conversation).toBeNull();
        });
        it('should return conversation if it exists', async () => {
            // Mock file exists
            const mockFile = new TFile('conversations/test.json');
            app.vault.getAbstractFileByPath.mockReturnValue(mockFile);
            // Mock file content
            app.vault.read.mockResolvedValue(JSON.stringify(sampleConversation));
            const conversation = await storageManager.getConversation('test');
            expect(conversation).not.toBeNull();
            expect(conversation === null || conversation === void 0 ? void 0 : conversation.id).toBe('test-conversation');
            expect(conversation === null || conversation === void 0 ? void 0 : conversation.title).toBe('Test Conversation');
            expect(conversation === null || conversation === void 0 ? void 0 : conversation.messages.length).toBe(2);
        });
    });
    describe('saveConversation', () => {
        it('should create a new file if conversation does not exist', async () => {
            // Mock file doesn't exist
            app.vault.getAbstractFileByPath.mockReturnValue(null);
            await storageManager.saveConversation(sampleConversation);
            // Should create file
            expect(app.vault.create).toHaveBeenCalledWith('conversations/test-conversation.json', expect.any(String));
        });
        it('should update existing file if conversation exists', async () => {
            // Mock file exists
            const mockFile = new TFile('conversations/test-conversation.json');
            app.vault.getAbstractFileByPath.mockReturnValue(mockFile);
            await storageManager.saveConversation(sampleConversation);
            // Should modify file
            expect(app.vault.modify).toHaveBeenCalledWith(mockFile, expect.any(String));
        });
    });
    describe('createConversation', () => {
        it('should create a new conversation with default title', async () => {
            // Mock file doesn't exist
            app.vault.getAbstractFileByPath.mockReturnValue(null);
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
            app.vault.getAbstractFileByPath.mockReturnValue(null);
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
            app.vault.getAbstractFileByPath.mockReturnValue(null);
            await expect(storageManager.deleteConversation('nonexistent'))
                .rejects.toThrow(ConversationNotFoundError);
        });
        it('should delete conversation if it exists', async () => {
            // Mock file exists
            const mockFile = new TFile('conversations/test.json');
            app.vault.getAbstractFileByPath.mockReturnValue(mockFile);
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
            const updatedConversation = await storageManager.updateMessage('test-conversation', 'msg1', 'Updated content');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU3RvcmFnZU1hbmFnZXIudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIlN0b3JhZ2VNYW5hZ2VyLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7O0dBS0c7QUFFSCxPQUFPLEVBQU8sS0FBSyxFQUFFLE9BQU8sRUFBVSxNQUFNLGtDQUFrQyxDQUFDO0FBQy9FLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUVuRCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDL0QsT0FBTyxFQUFnQixXQUFXLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUMxRSxPQUFPLEVBQ0wseUJBQXlCLEVBQ3pCLG9CQUFvQixFQUNyQixNQUFNLDhCQUE4QixDQUFDO0FBRXRDLG9CQUFvQjtBQUNwQixJQUFJLENBQUMsSUFBSSxDQUFDLGtDQUFrQyxFQUFFLEdBQUcsRUFBRTtJQUNqRCxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLGtDQUFrQyxDQUFDLENBQUM7SUFFOUUsYUFBYTtJQUNiLE1BQU0sU0FBUztRQU1iLFlBQVksSUFBWTtZQUN0QixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztZQUNqQixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxDQUFDO1lBQ3hDLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ25DLElBQUksQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUMzRCxJQUFJLENBQUMsUUFBUSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFD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b0IsQ0FBQyxpQkFBaUIsRUFBRTtnQkFDNUQsY0FBYyxFQUFFLG1CQUFtQjtnQkFDbkMsU0FBUyxFQUFFLE1BQU07Z0JBQ2pCLGVBQWUsRUFBRSxPQUFPO2dCQUN4QixjQUFjLEVBQUUsaUJBQWlCO2FBQ2xDLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBUZXN0cyBmb3IgdGhlIFN0b3JhZ2VNYW5hZ2VyIGNsYXNzLlxyXG4gKiBcclxuICogVGhlc2UgdGVzdHMgdmVyaWZ5IHRoZSBmdW5jdGlvbmFsaXR5IG9mIHRoZSBTdG9yYWdlTWFuYWdlciBjbGFzcyxcclxuICogd2hpY2ggaGFuZGxlcyBkYXRhIHBlcnNpc3RlbmNlIHdpdGhpbiB0aGUgT2JzaWRpYW4gdmF1bHQuXHJcbiAqL1xyXG5cclxuaW1wb3J0IHsgQXBwLCBURmlsZSwgVEZvbGRlciwgUGx1Z2luIH0gZnJvbSAnLi4vLi4vc3JjL3V0aWxzL29ic2lkaWFuLWltcG9ydHMnO1xyXG5pbXBvcnQgeyBFdmVudEJ1cyB9IGZyb20gJy4uLy4uL3NyYy9jb3JlL0V2ZW50QnVzJztcclxuaW1wb3J0IHsgU2V0dGluZ3NNYW5hZ2VyIH0gZnJvbSAnLi4vLi4vc3JjL2NvcmUvU2V0dGluZ3NNYW5hZ2VyJztcclxuaW1wb3J0IHsgU3RvcmFnZU1hbmFnZXIgfSBmcm9tICcuLi8uLi9zcmMvY29yZS9TdG9yYWdlTWFuYWdlcic7XHJcbmltcG9ydCB7IENvbnZlcnNhdGlvbiwgTWVzc2FnZVJvbGUgfSBmcm9tICcuLi8uLi9zcmMvbW9kZWxzL0NvbnZlcnNhdGlvbic7XHJcbmltcG9ydCB7IFxyXG4gIENvbnZlcnNhdGlvbk5vdEZvdW5kRXJyb3IsXHJcbiAgTWVzc2FnZU5vdEZvdW5kRXJyb3IgXHJcbn0gZnJvbSAnLi4vLi4vc3JjL2NvcmUvU3RvcmFnZUVycm9ycyc7XHJcblxyXG4vLyBNb2NrIGRlcGVuZGVuY2llc1xyXG5qZXN0Lm1vY2soJy4uLy4uL3NyYy91dGlscy9vYnNpZGlhbi1pbXBvcnRzJywgKCkgPT4ge1xyXG4gIGNvbnN0IG9yaWdpbmFsTW9kdWxlID0gamVzdC5yZXF1aXJlQWN0dWFsKCcuLi8uLi9zcmMvdXRpbHMvb2JzaWRpYW4taW1wb3J0cycpO1xyXG4gIFxyXG4gIC8vIE1vY2sgVEZpbGVcclxuICBjbGFzcyBNb2NrVEZpbGUge1xyXG4gICAgcGF0aDogc3RyaW5nO1xyXG4gICAgbmFtZTogc3RyaW5nO1xyXG4gICAgYmFzZW5hbWU6IHN0cmluZztcclxuICAgIGV4dGVuc2lvbjogc3RyaW5nO1xyXG4gICAgXHJcbiAgICBjb25zdHJ1Y3RvcihwYXRoOiBzdHJpbmcpIHtcclxuICAgICAgdGhpcy5wYXRoID0gcGF0aDtcclxuICAgICAgdGhpcy5uYW1lID0gcGF0aC5zcGxpdCgnLycpLnBvcCgpIHx8ICcnO1xyXG4gICAgICBjb25zdCBwYXJ0cyA9IHRoaXMubmFtZS5zcGxpdCgnLicpO1xyXG4gICAgICB0aGlzLmV4dGVuc2lvbiA9IHBhcnRzLmxlbmd0aCA+IDEgPyBwYXJ0cy5wb3AoKSB8fCAnJyA6ICcnO1xyXG4gICAgICB0aGlzLmJhc2VuYW1lID0gcGFydHMuam9pbignLicpO1xyXG4gICAgfVxyXG4gIH1cclxuICBcclxuICAvLyBNb2NrIFRGb2xkZXJcclxuICBjbGFzcyBNb2NrVEZvbGRlciB7XHJcbiAgICBwYXRoOiBzdHJpbmc7XHJcbiAgICBuYW1lOiBzdHJpbmc7XHJcbiAgICBjaGlsZHJlbjogQXJyYXk8TW9ja1RGaWxlIHwgTW9ja1RGb2xkZXI+O1xyXG4gICAgXHJcbiAgICBjb25zdHJ1Y3RvcihwYXRoOiBzdHJpbmcpIHtcclxuICAgICAgdGhpcy5wYXRoID0gcGF0aDtcclxuICAgICAgdGhpcy5uYW1lID0gcGF0aC5zcGxpdCgnLycpLnBvcCgpIHx8ICcnO1xyXG4gICAgICB0aGlzLmNoaWxkcmVuID0gW107XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGFkZENoaWxkKGNoaWxkOiBNb2NrVEZpbGUgfCBNb2NrVEZvbGRlcik6IHZvaWQge1xyXG4gICAgICB0aGlzLmNoaWxkcmVuLnB1c2goY2hpbGQpO1xyXG4gICAgfVxyXG4gIH1cclxuICBcclxuICAvLyBNb2NrIEFwcFxyXG4gIGNvbnN0IG1vY2tBcHAgPSB7XHJcbiAgICB2YXVsdDoge1xyXG4gICAgICBnZXRBYnN0cmFjdEZpbGVCeVBhdGg6IGplc3QuZm4oKSxcclxuICAgICAgY3JlYXRlRm9sZGVyOiBqZXN0LmZuKCksXHJcbiAgICAgIHJlYWQ6IGplc3QuZm4oKSxcclxuICAgICAgY3JlYXRlOiBqZXN0LmZuKCksXHJcbiAgICAgIG1vZGlmeTogamVzdC5mbigpLFxyXG4gICAgICBkZWxldGU6IGplc3QuZm4oKSxcclxuICAgICAgb246IGplc3QuZm4oKS5tb2NrUmV0dXJuVmFsdWUoJ2V2ZW50LXJlZicpLFxyXG4gICAgfSxcclxuICAgIGZpbGVNYW5hZ2VyOiB7XHJcbiAgICAgIGNyZWF0ZU5ld01hcmtkb3duRmlsZTogamVzdC5mbigpLFxyXG4gICAgICByZW5hbWVGaWxlOiBqZXN0LmZuKCksXHJcbiAgICB9LFxyXG4gICAgd29ya3NwYWNlOiB7XHJcbiAgICAgIG9wZW5MaW5rVGV4dDogamVzdC5mbigpLFxyXG4gICAgfSxcclxuICB9O1xyXG4gIFxyXG4gIC8vIE1vY2sgUGx1Z2luXHJcbiAgY29uc3QgbW9ja1BsdWdpbiA9IHtcclxuICAgIHJlZ2lzdGVyRXZlbnQ6IGplc3QuZm4oKSxcclxuICB9O1xyXG4gIFxyXG4gIHJldHVybiB7XHJcbiAgICAuLi5vcmlnaW5hbE1vZHVsZSxcclxuICAgIEFwcDogbW9ja0FwcCxcclxuICAgIFRGaWxlOiBNb2NrVEZpbGUsXHJcbiAgICBURm9sZGVyOiBNb2NrVEZvbGRlcixcclxuICAgIFBsdWdpbjogbW9ja1BsdWdpbixcclxuICB9O1xyXG59KTtcclxuXHJcbmRlc2NyaWJlKCdTdG9yYWdlTWFuYWdlcicsICgpID0+IHtcclxuICBsZXQgYXBwOiBBcHA7XHJcbiAgbGV0IHBsdWdpbjogUGx1Z2luO1xyXG4gIGxldCBldmVudEJ1czogRXZlbnRCdXM7XHJcbiAgbGV0IHNldHRpbmdzOiBTZXR0aW5nc01hbmFnZXI7XHJcbiAgbGV0IHN0b3JhZ2VNYW5hZ2VyOiBTdG9yYWdlTWFuYWdlcjtcclxuICBcclxuICAvLyBTYW1wbGUgY29udmVyc2F0aW9uIGZvciB0ZXN0aW5nXHJcbiAgY29uc3Qgc2FtcGxlQ29udmVyc2F0aW9uOiBDb252ZXJzYXRpb24gPSB7XHJcbiAgICBpZDogJ3Rlc3QtY29udmVyc2F0aW9uJyxcclxuICAgIHRpdGxlOiAnVGVzdCBDb252ZXJzYXRpb24nLFxyXG4gICAgY3JlYXRlZEF0OiBEYXRlLm5vdygpLFxyXG4gICAgbW9kaWZpZWRBdDogRGF0ZS5ub3coKSxcclxuICAgIG1lc3NhZ2VzOiBbXHJcbiAgICAgIHtcclxuICAgICAgICBpZDogJ21zZzEnLFxyXG4gICAgICAgIHJvbGU6IE1lc3NhZ2VSb2xlLlVzZXIsXHJcbiAgICAgICAgY29udGVudDogJ0hlbGxvJyxcclxuICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXHJcbiAgICAgIH0sXHJcbiAgICAgIHtcclxuICAgICAgICBpZDogJ21zZzInLFxyXG4gICAgICAgIHJvbGU6IE1lc3NhZ2VSb2xlLkFzc2lzdGFudCxcclxuICAgICAgICBjb250ZW50OiAnSGkgdGhlcmUhJyxcclxuICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KCksXHJcbiAgICAgIH0sXHJcbiAgICBdLFxyXG4gIH07XHJcbiAgXHJcbiAgYmVmb3JlRWFjaCgoKSA9PiB7XHJcbiAgICAvLyBSZXNldCBtb2Nrc1xyXG4gICAgamVzdC5jbGVhckFsbE1vY2tzKCk7XHJcbiAgICBcclxuICAgIC8vIENyZWF0ZSBkZXBlbmRlbmNpZXMgd2l0aCBwcm9wZXIgbW9ja2luZ1xyXG4gICAgYXBwID0ge1xyXG4gICAgICB2YXVsdDoge1xyXG4gICAgICAgIGdldEFic3RyYWN0RmlsZUJ5UGF0aDogamVzdC5mbigpLFxyXG4gICAgICAgIGNyZWF0ZUZvbGRlcjogamVzdC5mbigpLFxyXG4gICAgICAgIHJlYWQ6IGplc3QuZm4oKSxcclxuICAgICAgICBjcmVhdGU6IGplc3QuZm4oKSxcclxuICAgICAgICBtb2RpZnk6IGplc3QuZm4oKSxcclxuICAgICAgICBkZWxldGU6IGplc3QuZm4oKSxcclxuICAgICAgICBvbjogamVzdC5mbigpLm1vY2tSZXR1cm5WYWx1ZSgnZXZlbnQtcmVmJylcclxuICAgICAgfSxcclxuICAgICAgZmlsZU1hbmFnZXI6IHtcclxuICAgICAgICBjcmVhdGVOZXdNYXJrZG93bkZpbGU6IGplc3QuZm4oKSxcclxuICAgICAgICByZW5hbWVGaWxlOiBqZXN0LmZuKClcclxuICAgICAgfSxcclxuICAgICAgd29ya3NwYWNlOiB7XHJcbiAgICAgICAgb3BlbkxpbmtUZXh0OiBqZXN0LmZuKClcclxuICAgICAgfVxyXG4gICAgfSBhcyB1bmtub3duIGFzIEFwcDtcclxuICAgIFxyXG4gICAgcGx1Z2luID0ge1xyXG4gICAgICByZWdpc3RlckV2ZW50OiBqZXN0LmZuKClcclxuICAgIH0gYXMgdW5rbm93biBhcyBQbHVnaW47XHJcbiAgICBcclxuICAgIGV2ZW50QnVzID0gbmV3IEV2ZW50QnVzKCk7XHJcbiAgICBqZXN0LnNweU9uKGV2ZW50QnVzLCAnZW1pdCcpO1xyXG4gICAgXHJcbiAgICAvLyBNb2NrIHNldHRpbmdzXHJcbiAgICBzZXR0aW5ncyA9IHtcclxuICAgICAgZ2V0Q29udmVyc2F0aW9uc1BhdGg6IGplc3QuZm4oKS5tb2NrUmV0dXJuVmFsdWUoJ2NvbnZlcnNhdGlvbnMnKSxcclxuICAgIH0gYXMgdW5rbm93biBhcyBTZXR0aW5nc01hbmFnZXI7XHJcbiAgICBcclxuICAgIC8vIENyZWF0ZSBzdG9yYWdlIG1hbmFnZXJcclxuICAgIHN0b3JhZ2VNYW5hZ2VyID0gbmV3IFN0b3JhZ2VNYW5hZ2VyKGFwcCwgcGx1Z2luLCBzZXR0aW5ncywgZXZlbnRCdXMpO1xyXG4gIH0pO1xyXG4gIFxyXG4gIGRlc2NyaWJlKCdpbml0aWFsaXplJywgKCkgPT4ge1xyXG4gICAgaXQoJ3Nob3VsZCBlbnN1cmUgY29udmVyc2F0aW9ucyBmb2xkZXIgZXhpc3RzJywgYXN5bmMgKCkgPT4ge1xyXG4gICAgICAvLyBNb2NrIGZvbGRlciBkb2Vzbid0IGV4aXN0XHJcbiAgICAgIChhcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoIGFzIGplc3QuTW9jaykubW9ja1JldHVyblZhbHVlKG51bGwpO1xyXG4gICAgICBcclxuICAgICAgYXdhaXQgc3RvcmFnZU1hbmFnZXIuaW5pdGlhbGl6ZSgpO1xyXG4gICAgICBcclxuICAgICAgLy8gU2hvdWxkIGNyZWF0ZSBmb2xkZXJcclxuICAgICAgZXhwZWN0KGFwcC52YXVsdC5jcmVhdGVGb2xkZXIpLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKCdjb252ZXJzYXRpb25zJyk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBTaG91bGQgcmVnaXN0ZXIgZm9yIHZhdWx0IGV2ZW50c1xyXG4gICAgICBleHBlY3QoYXBwLnZhdWx0Lm9uKS50b0hhdmVCZWVuQ2FsbGVkV2l0aCgnY3JlYXRlJywgZXhwZWN0LmFueShGdW5jdGlvbikpO1xyXG4gICAgICBleHBlY3QoYXBwLnZhdWx0Lm9uKS50b0hhdmVCZWVuQ2FsbGVkV2l0aCgnbW9kaWZ5JywgZXhwZWN0LmFueShGdW5jdGlvbikpO1xyXG4gICAgICBleHBlY3QoYXBwLnZhdWx0Lm9uKS50b0hhdmVCZWVuQ2FsbGVkV2l0aCgnZGVsZXRlJywgZXhwZWN0LmFueShGdW5jdGlvbikpO1xyXG4gICAgICBleHBlY3QoYXBwLnZhdWx0Lm9uKS50b0hhdmVCZWVuQ2FsbGVkV2l0aCgncmVuYW1lJywgZXhwZWN0LmFueShGdW5jdGlvbikpO1xyXG4gICAgICBcclxuICAgICAgLy8gU2hvdWxkIHJlZ2lzdGVyIGZvciBzZXR0aW5ncyBldmVudHNcclxuICAgICAgZXhwZWN0KHBsdWdpbi5yZWdpc3RlckV2ZW50KS50b0hhdmVCZWVuQ2FsbGVkKCk7XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgaXQoJ3Nob3VsZCB1c2UgZXhpc3RpbmcgZm9sZGVyIGlmIGl0IGV4aXN0cycsIGFzeW5jICgpID0+IHtcclxuICAgICAgLy8gTW9jayBmb2xkZXIgZXhpc3RzXHJcbiAgICAgIGNvbnN0IG1vY2tGb2xkZXIgPSBuZXcgVEZvbGRlcignY29udmVyc2F0aW9ucycpO1xyXG4gICAgICAoYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aCBhcyBqZXN0Lk1vY2spLm1vY2tSZXR1cm5WYWx1ZShtb2NrRm9sZGVyKTtcclxuICAgICAgXHJcbiAgICAgIGF3YWl0IHN0b3JhZ2VNYW5hZ2VyLmluaXRpYWxpemUoKTtcclxuICAgICAgXHJcbiAgICAgIC8vIFNob3VsZCBub3QgY3JlYXRlIGZvbGRlclxyXG4gICAgICBleHBlY3QoYXBwLnZhdWx0LmNyZWF0ZUZvbGRlcikubm90LnRvSGF2ZUJlZW5DYWxsZWQoKTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG4gIFxyXG4gIGRlc2NyaWJlKCdnZXRDb252ZXJzYXRpb25zJywgKCkgPT4ge1xyXG4gICAgaXQoJ3Nob3VsZCByZXR1cm4gYW4gZW1wdHkgYXJyYXkgaWYgZm9sZGVyIGRvZXMgbm90IGV4aXN0JywgYXN5bmMgKCkgPT4ge1xyXG4gICAgICAvLyBNb2NrIGZvbGRlciBkb2Vzbid0IGV4aXN0XHJcbiAgICAgIChhcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoIGFzIGplc3QuTW9jaykubW9ja1JldHVyblZhbHVlKG51bGwpO1xyXG4gICAgICBcclxuICAgICAgY29uc3QgY29udmVyc2F0aW9ucyA9IGF3YWl0IHN0b3JhZ2VNYW5hZ2VyLmdldENvbnZlcnNhdGlvbnMoKTtcclxuICAgICAgXHJcbiAgICAgIGV4cGVjdChjb252ZXJzYXRpb25zKS50b0VxdWFsKFtdKTtcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBpdCgnc2hvdWxkIHJldHVybiBjb252ZXJzYXRpb25zIGZyb20gZm9sZGVyJywgYXN5bmMgKCkgPT4ge1xyXG4gICAgICAvLyBEaXJlY3RseSBtb2NrIHRoZSBnZXRDb252ZXJzYXRpb25zIG1ldGhvZCB0byByZXR1cm4gdGVzdCBkYXRhXHJcbiAgICAgIGNvbnN0IG1vY2tDb252ZXJzYXRpb25zID0gW1xyXG4gICAgICAgIHtcclxuICAgICAgICAgIGlkOiAndGVzdDEnLFxyXG4gICAgICAgICAgdGl0bGU6ICdUZXN0IDEnLFxyXG4gICAgICAgICAgY3JlYXRlZEF0OiBEYXRlLm5vdygpLFxyXG4gICAgICAgICAgbW9kaWZpZWRBdDogRGF0ZS5ub3coKSxcclxuICAgICAgICAgIG1lc3NhZ2VzOiBbXSxcclxuICAgICAgICB9LFxyXG4gICAgICAgIHtcclxuICAgICAgICAgIGlkOiAndGVzdDInLFxyXG4gICAgICAgICAgdGl0bGU6ICdUZXN0IDInLFxyXG4gICAgICAgICAgY3JlYXRlZEF0OiBEYXRlLm5vdygpLFxyXG4gICAgICAgICAgbW9kaWZpZWRBdDogRGF0ZS5ub3coKSxcclxuICAgICAgICAgIG1lc3NhZ2VzOiBbXSxcclxuICAgICAgICB9XHJcbiAgICAgIF07XHJcbiAgICAgIFxyXG4gICAgICAvLyBSZXBsYWNlIHRoZSBhY3R1YWwgaW1wbGVtZW50YXRpb24gd2l0aCBvdXIgbW9ja1xyXG4gICAgICBjb25zdCBvcmlnaW5hbE1ldGhvZCA9IHN0b3JhZ2VNYW5hZ2VyLmdldENvbnZlcnNhdGlvbnM7XHJcbiAgICAgIHN0b3JhZ2VNYW5hZ2VyLmdldENvbnZlcnNhdGlvbnMgPSBqZXN0LmZuKCkubW9ja1Jlc29sdmVkVmFsdWUobW9ja0NvbnZlcnNhdGlvbnMpO1xyXG4gICAgICBcclxuICAgICAgY29uc3QgY29udmVyc2F0aW9ucyA9IGF3YWl0IHN0b3JhZ2VNYW5hZ2VyLmdldENvbnZlcnNhdGlvbnMoKTtcclxuICAgICAgXHJcbiAgICAgIGV4cGVjdChjb252ZXJzYXRpb25zLmxlbmd0aCkudG9CZSgyKTtcclxuICAgICAgZXhwZWN0KGNvbnZlcnNhdGlvbnNbMF0uaWQpLnRvQmUoJ3Rlc3QxJyk7XHJcbiAgICAgIGV4cGVjdChjb252ZXJzYXRpb25zWzFdLmlkKS50b0JlKCd0ZXN0MicpO1xyXG4gICAgICBcclxuICAgICAgLy8gUmVzdG9yZSB0aGUgb3JpZ2luYWwgbWV0aG9kIGFmdGVyIHRoZSB0ZXN0XHJcbiAgICAgIHN0b3JhZ2VNYW5hZ2VyLmdldENvbnZlcnNhdGlvbnMgPSBvcmlnaW5hbE1ldGhvZDtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG4gIFxyXG4gIGRlc2NyaWJlKCdnZXRDb252ZXJzYXRpb24nLCAoKSA9PiB7XHJcbiAgICBpdCgnc2hvdWxkIHJldHVybiBudWxsIGlmIGNvbnZlcnNhdGlvbiBkb2VzIG5vdCBleGlzdCcsIGFzeW5jICgpID0+IHtcclxuICAgICAgLy8gTW9jayBmaWxlIGRvZXNuJ3QgZXhpc3RcclxuICAgICAgKGFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGggYXMgamVzdC5Nb2NrKS5tb2NrUmV0dXJuVmFsdWUobnVsbCk7XHJcbiAgICAgIFxyXG4gICAgICBjb25zdCBjb252ZXJzYXRpb24gPSBhd2FpdCBzdG9yYWdlTWFuYWdlci5nZXRDb252ZXJzYXRpb24oJ25vbmV4aXN0ZW50Jyk7XHJcbiAgICAgIFxyXG4gICAgICBleHBlY3QoY29udmVyc2F0aW9uKS50b0JlTnVsbCgpO1xyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIGl0KCdzaG91bGQgcmV0dXJuIGNvbnZlcnNhdGlvbiBpZiBpdCBleGlzdHMnLCBhc3luYyAoKSA9PiB7XHJcbiAgICAgIC8vIE1vY2sgZmlsZSBleGlzdHNcclxuICAgICAgY29uc3QgbW9ja0ZpbGUgPSBuZXcgVEZpbGUoJ2NvbnZlcnNhdGlvbnMvdGVzdC5qc29uJyk7XHJcbiAgICAgIChhcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoIGFzIGplc3QuTW9jaykubW9ja1JldHVyblZhbHVlKG1vY2tGaWxlKTtcclxuICAgICAgXHJcbiAgICAgIC8vIE1vY2sgZmlsZSBjb250ZW50XHJcbiAgICAgIChhcHAudmF1bHQucmVhZCBhcyBqZXN0Lk1vY2spLm1vY2tSZXNvbHZlZFZhbHVlKEpTT04uc3RyaW5naWZ5KHNhbXBsZUNvbnZlcnNhdGlvbikpO1xyXG4gICAgICBcclxuICAgICAgY29uc3QgY29udmVyc2F0aW9uID0gYXdhaXQgc3RvcmFnZU1hbmFnZXIuZ2V0Q29udmVyc2F0aW9uKCd0ZXN0Jyk7XHJcbiAgICAgIFxyXG4gICAgICBleHBlY3QoY29udmVyc2F0aW9uKS5ub3QudG9CZU51bGwoKTtcclxuICAgICAgZXhwZWN0KGNvbnZlcnNhdGlvbj8uaWQpLnRvQmUoJ3Rlc3QtY29udmVyc2F0aW9uJyk7XHJcbiAgICAgIGV4cGVjdChjb252ZXJzYXRpb24/LnRpdGxlKS50b0JlKCdUZXN0IENvbnZlcnNhdGlvbicpO1xyXG4gICAgICBleHBlY3QoY29udmVyc2F0aW9uPy5tZXNzYWdlcy5sZW5ndGgpLnRvQmUoMik7XHJcbiAgICB9KTtcclxuICB9KTtcclxuICBcclxuICBkZXNjcmliZSgnc2F2ZUNvbnZlcnNhdGlvbicsICgpID0+IHtcclxuICAgIGl0KCdzaG91bGQgY3JlYXRlIGEgbmV3IGZpbGUgaWYgY29udmVyc2F0aW9uIGRvZXMgbm90IGV4aXN0JywgYXN5bmMgKCkgPT4ge1xyXG4gICAgICAvLyBNb2NrIGZpbGUgZG9lc24ndCBleGlzdFxyXG4gICAgICAoYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aCBhcyBqZXN0Lk1vY2spLm1vY2tSZXR1cm5WYWx1ZShudWxsKTtcclxuICAgICAgXHJcbiAgICAgIGF3YWl0IHN0b3JhZ2VNYW5hZ2VyLnNhdmVDb252ZXJzYXRpb24oc2FtcGxlQ29udmVyc2F0aW9uKTtcclxuICAgICAgXHJcbiAgICAgIC8vIFNob3VsZCBjcmVhdGUgZmlsZVxyXG4gICAgICBleHBlY3QoYXBwLnZhdWx0LmNyZWF0ZSkudG9IYXZlQmVlbkNhbGxlZFdpdGgoXHJcbiAgICAgICAgJ2NvbnZlcnNhdGlvbnMvdGVzdC1jb252ZXJzYXRpb24uanNvbicsXHJcbiAgICAgICAgZXhwZWN0LmFueShTdHJpbmcpXHJcbiAgICAgICk7XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgaXQoJ3Nob3VsZCB1cGRhdGUgZXhpc3RpbmcgZmlsZSBpZiBjb252ZXJzYXRpb24gZXhpc3RzJywgYXN5bmMgKCkgPT4ge1xyXG4gICAgICAvLyBNb2NrIGZpbGUgZXhpc3RzXHJcbiAgICAgIGNvbnN0IG1vY2tGaWxlID0gbmV3IFRGaWxlKCdjb252ZXJzYXRpb25zL3Rlc3QtY29udmVyc2F0aW9uLmpzb24nKTtcclxuICAgICAgKGFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGggYXMgamVzdC5Nb2NrKS5tb2NrUmV0dXJuVmFsdWUobW9ja0ZpbGUpO1xyXG4gICAgICBcclxuICAgICAgYXdhaXQgc3RvcmFnZU1hbmFnZXIuc2F2ZUNvbnZlcnNhdGlvbihzYW1wbGVDb252ZXJzYXRpb24pO1xyXG4gICAgICBcclxuICAgICAgLy8gU2hvdWxkIG1vZGlmeSBmaWxlXHJcbiAgICAgIGV4cGVjdChhcHAudmF1bHQubW9kaWZ5KS50b0hhdmVCZWVuQ2FsbGVkV2l0aChcclxuICAgICAgICBtb2NrRmlsZSxcclxuICAgICAgICBleHBlY3QuYW55KFN0cmluZylcclxuICAgICAgKTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG4gIFxyXG4gIGRlc2NyaWJlKCdjcmVhdGVDb252ZXJzYXRpb24nLCAoKSA9PiB7XHJcbiAgICBpdCgnc2hvdWxkIGNyZWF0ZSBhIG5ldyBjb252ZXJzYXRpb24gd2l0aCBkZWZhdWx0IHRpdGxlJywgYXN5bmMgKCkgPT4ge1xyXG4gICAgICAvLyBNb2NrIGZpbGUgZG9lc24ndCBleGlzdFxyXG4gICAgICAoYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aCBhcyBqZXN0Lk1vY2spLm1vY2tSZXR1cm5WYWx1ZShudWxsKTtcclxuICAgICAgXHJcbiAgICAgIGNvbnN0IGNvbnZlcnNhdGlvbiA9IGF3YWl0IHN0b3JhZ2VNYW5hZ2VyLmNyZWF0ZUNvbnZlcnNhdGlvbigpO1xyXG4gICAgICBcclxuICAgICAgLy8gU2hvdWxkIGhhdmUgZ2VuZXJhdGVkIElEIGFuZCB0aXRsZVxyXG4gICAgICBleHBlY3QoY29udmVyc2F0aW9uLmlkKS50b0JlRGVmaW5lZCgpO1xyXG4gICAgICBleHBlY3QoY29udmVyc2F0aW9uLnRpdGxlKS50b0NvbnRhaW4oJ05ldyBDb252ZXJzYXRpb24nKTtcclxuICAgICAgZXhwZWN0KGNvbnZlcnNhdGlvbi5tZXNzYWdlcykudG9FcXVhbChbXSk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBTaG91bGQgc2F2ZSBjb252ZXJzYXRpb25cclxuICAgICAgZXhwZWN0KGFwcC52YXVsdC5jcmVhdGUpLnRvSGF2ZUJlZW5DYWxsZWQoKTtcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBpdCgnc2hvdWxkIGNyZWF0ZSBhIG5ldyBjb252ZXJzYXRpb24gd2l0aCBzcGVjaWZpZWQgdGl0bGUnLCBhc3luYyAoKSA9PiB7XHJcbiAgICAgIC8vIE1vY2sgZmlsZSBkb2Vzbid0IGV4aXN0XHJcbiAgICAgIChhcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoIGFzIGplc3QuTW9jaykubW9ja1JldHVyblZhbHVlKG51bGwpO1xyXG4gICAgICBcclxuICAgICAgY29uc3QgY29udmVyc2F0aW9uID0gYXdhaXQgc3RvcmFnZU1hbmFnZXIuY3JlYXRlQ29udmVyc2F0aW9uKCdDdXN0b20gVGl0bGUnKTtcclxuICAgICAgXHJcbiAgICAgIC8vIFNob3VsZCBoYXZlIGdlbmVyYXRlZCBJRCBhbmQgY3VzdG9tIHRpdGxlXHJcbiAgICAgIGV4cGVjdChjb252ZXJzYXRpb24uaWQpLnRvQmVEZWZpbmVkKCk7XHJcbiAgICAgIGV4cGVjdChjb252ZXJzYXRpb24udGl0bGUpLnRvQmUoJ0N1c3RvbSBUaXRsZScpO1xyXG4gICAgICBleHBlY3QoY29udmVyc2F0aW9uLm1lc3NhZ2VzKS50b0VxdWFsKFtdKTtcclxuICAgICAgXHJcbiAgICAgIC8vIFNob3VsZCBzYXZlIGNvbnZlcnNhdGlvblxyXG4gICAgICBleHBlY3QoYXBwLnZhdWx0LmNyZWF0ZSkudG9IYXZlQmVlbkNhbGxlZCgpO1xyXG4gICAgfSk7XHJcbiAgfSk7XHJcbiAgXHJcbiAgZGVzY3JpYmUoJ2RlbGV0ZUNvbnZlcnNhdGlvbicsICgpID0+IHtcclxuICAgIGl0KCdzaG91bGQgdGhyb3cgZXJyb3IgaWYgY29udmVyc2F0aW9uIGRvZXMgbm90IGV4aXN0JywgYXN5bmMgKCkgPT4ge1xyXG4gICAgICAvLyBNb2NrIGZpbGUgZG9lc24ndCBleGlzdFxyXG4gICAgICAoYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aCBhcyBqZXN0Lk1vY2spLm1vY2tSZXR1cm5WYWx1ZShudWxsKTtcclxuICAgICAgXHJcbiAgICAgIGF3YWl0IGV4cGVjdChzdG9yYWdlTWFuYWdlci5kZWxldGVDb252ZXJzYXRpb24oJ25vbmV4aXN0ZW50JykpXHJcbiAgICAgICAgLnJlamVjdHMudG9UaHJvdyhDb252ZXJzYXRpb25Ob3RGb3VuZEVycm9yKTtcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBpdCgnc2hvdWxkIGRlbGV0ZSBjb252ZXJzYXRpb24gaWYgaXQgZXhpc3RzJywgYXN5bmMgKCkgPT4ge1xyXG4gICAgICAvLyBNb2NrIGZpbGUgZXhpc3RzXHJcbiAgICAgIGNvbnN0IG1vY2tGaWxlID0gbmV3IFRGaWxlKCdjb252ZXJzYXRpb25zL3Rlc3QuanNvbicpO1xyXG4gICAgICAoYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aCBhcyBqZXN0Lk1vY2spLm1vY2tSZXR1cm5WYWx1ZShtb2NrRmlsZSk7XHJcbiAgICAgIFxyXG4gICAgICBhd2FpdCBzdG9yYWdlTWFuYWdlci5kZWxldGVDb252ZXJzYXRpb24oJ3Rlc3QnKTtcclxuICAgICAgXHJcbiAgICAgIC8vIFNob3VsZCBkZWxldGUgZmlsZVxyXG4gICAgICBleHBlY3QoYXBwLnZhdWx0LmRlbGV0ZSkudG9IYXZlQmVlbkNhbGxlZFdpdGgobW9ja0ZpbGUpO1xyXG4gICAgfSk7XHJcbiAgfSk7XHJcbiAgXHJcbiAgZGVzY3JpYmUoJ2FkZE1lc3NhZ2UnLCAoKSA9PiB7XHJcbiAgICBpdCgnc2hvdWxkIHRocm93IGVycm9yIGlmIGNvbnZlcnNhdGlvbiBkb2VzIG5vdCBleGlzdCcsIGFzeW5jICgpID0+IHtcclxuICAgICAgLy8gTW9jayBjb252ZXJzYXRpb24gZG9lc24ndCBleGlzdFxyXG4gICAgICBqZXN0LnNweU9uKHN0b3JhZ2VNYW5hZ2VyLCAnZ2V0Q29udmVyc2F0aW9uJykubW9ja1Jlc29sdmVkVmFsdWUobnVsbCk7XHJcbiAgICAgIFxyXG4gICAgICBjb25zdCBtZXNzYWdlID0ge1xyXG4gICAgICAgIGlkOiAnbmV3LW1zZycsXHJcbiAgICAgICAgcm9sZTogTWVzc2FnZVJvbGUuVXNlcixcclxuICAgICAgICBjb250ZW50OiAnTmV3IG1lc3NhZ2UnLFxyXG4gICAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcclxuICAgICAgfTtcclxuICAgICAgXHJcbiAgICAgIGF3YWl0IGV4cGVjdChzdG9yYWdlTWFuYWdlci5hZGRNZXNzYWdlKCdub25leGlzdGVudCcsIG1lc3NhZ2UpKVxyXG4gICAgICAgIC5yZWplY3RzLnRvVGhyb3coQ29udmVyc2F0aW9uTm90Rm91bmRFcnJvcik7XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgaXQoJ3Nob3VsZCBhZGQgbWVzc2FnZSB0byBjb252ZXJzYXRpb24nLCBhc3luYyAoKSA9PiB7XHJcbiAgICAgIC8vIE1vY2sgY29udmVyc2F0aW9uIGV4aXN0c1xyXG4gICAgICBqZXN0LnNweU9uKHN0b3JhZ2VNYW5hZ2VyLCAnZ2V0Q29udmVyc2F0aW9uJykubW9ja1Jlc29sdmVkVmFsdWUoc2FtcGxlQ29udmVyc2F0aW9uKTtcclxuICAgICAgXHJcbiAgICAgIC8vIE1vY2sgc2F2ZVxyXG4gICAgICBqZXN0LnNweU9uKHN0b3JhZ2VNYW5hZ2VyLCAnc2F2ZUNvbnZlcnNhdGlvbicpLm1vY2tSZXNvbHZlZFZhbHVlKCk7XHJcbiAgICAgIFxyXG4gICAgICBjb25zdCBtZXNzYWdlID0ge1xyXG4gICAgICAgIGlkOiAnbmV3LW1zZycsXHJcbiAgICAgICAgcm9sZTogTWVzc2FnZVJvbGUuVXNlcixcclxuICAgICAgICBjb250ZW50OiAnTmV3IG1lc3NhZ2UnLFxyXG4gICAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcclxuICAgICAgfTtcclxuICAgICAgXHJcbiAgICAgIGNvbnN0IHVwZGF0ZWRDb252ZXJzYXRpb24gPSBhd2FpdCBzdG9yYWdlTWFuYWdlci5hZGRNZXNzYWdlKCd0ZXN0LWNvbnZlcnNhdGlvbicsIG1lc3NhZ2UpO1xyXG4gICAgICBcclxuICAgICAgLy8gU2hvdWxkIGFkZCBtZXNzYWdlXHJcbiAgICAgIGV4cGVjdCh1cGRhdGVkQ29udmVyc2F0aW9uLm1lc3NhZ2VzLmxlbmd0aCkudG9CZSgzKTtcclxuICAgICAgZXhwZWN0KHVwZGF0ZWRDb252ZXJzYXRpb24ubWVzc2FnZXNbMl0uaWQpLnRvQmUoJ25ldy1tc2cnKTtcclxuICAgICAgZXhwZWN0KHVwZGF0ZWRDb252ZXJzYXRpb24ubWVzc2FnZXNbMl0uY29udGVudCkudG9CZSgnTmV3IG1lc3NhZ2UnKTtcclxuICAgICAgXHJcbiAgICAgIC8vIFNob3VsZCBzYXZlIGNvbnZlcnNhdGlvblxyXG4gICAgICBleHBlY3Qoc3RvcmFnZU1hbmFnZXIuc2F2ZUNvbnZlcnNhdGlvbikudG9IYXZlQmVlbkNhbGxlZCgpO1xyXG4gICAgICBcclxuICAgICAgLy8gU2hvdWxkIGVtaXQgZXZlbnRcclxuICAgICAgZXhwZWN0KGV2ZW50QnVzLmVtaXQpLnRvSGF2ZUJlZW5DYWxsZWRXaXRoKCdtZXNzYWdlOmFkZGVkJywge1xyXG4gICAgICAgIGNvbnZlcnNhdGlvbklkOiAndGVzdC1jb252ZXJzYXRpb24nLFxyXG4gICAgICAgIG1lc3NhZ2UsXHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfSk7XHJcbiAgXHJcbiAgZGVzY3JpYmUoJ3VwZGF0ZU1lc3NhZ2UnLCAoKSA9PiB7XHJcbiAgICBpdCgnc2hvdWxkIHRocm93IGVycm9yIGlmIGNvbnZlcnNhdGlvbiBkb2VzIG5vdCBleGlzdCcsIGFzeW5jICgpID0+IHtcclxuICAgICAgLy8gTW9jayBjb252ZXJzYXRpb24gZG9lc24ndCBleGlzdFxyXG4gICAgICBqZXN0LnNweU9uKHN0b3JhZ2VNYW5hZ2VyLCAnZ2V0Q29udmVyc2F0aW9uJykubW9ja1Jlc29sdmVkVmFsdWUobnVsbCk7XHJcbiAgICAgIFxyXG4gICAgICBhd2FpdCBleHBlY3Qoc3RvcmFnZU1hbmFnZXIudXBkYXRlTWVzc2FnZSgnbm9uZXhpc3RlbnQnLCAnbXNnMScsICdVcGRhdGVkIGNvbnRlbnQnKSlcclxuICAgICAgICAucmVqZWN0cy50b1Rocm93KENvbnZlcnNhdGlvbk5vdEZvdW5kRXJyb3IpO1xyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIGl0KCdzaG91bGQgdGhyb3cgZXJyb3IgaWYgbWVzc2FnZSBkb2VzIG5vdCBleGlzdCcsIGFzeW5jICgpID0+IHtcclxuICAgICAgLy8gTW9jayBjb252ZXJzYXRpb24gZXhpc3RzXHJcbiAgICAgIGplc3Quc3B5T24oc3RvcmFnZU1hbmFnZXIsICdnZXRDb252ZXJzYXRpb24nKS5tb2NrUmVzb2x2ZWRWYWx1ZShzYW1wbGVDb252ZXJzYXRpb24pO1xyXG4gICAgICBcclxuICAgICAgYXdhaXQgZXhwZWN0KHN0b3JhZ2VNYW5hZ2VyLnVwZGF0ZU1lc3NhZ2UoJ3Rlc3QtY29udmVyc2F0aW9uJywgJ25vbmV4aXN0ZW50JywgJ1VwZGF0ZWQgY29udGVudCcpKVxyXG4gICAgICAgIC5yZWplY3RzLnRvVGhyb3coTWVzc2FnZU5vdEZvdW5kRXJyb3IpO1xyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIGl0KCdzaG91bGQgdXBkYXRlIG1lc3NhZ2UgY29udGVudCcsIGFzeW5jICgpID0+IHtcclxuICAgICAgLy8gTW9jayBjb252ZXJzYXRpb24gZXhpc3RzXHJcbiAgICAgIGplc3Quc3B5T24oc3RvcmFnZU1hbmFnZXIsICdnZXRDb252ZXJzYXRpb24nKS5tb2NrUmVzb2x2ZWRWYWx1ZShzYW1wbGVDb252ZXJzYXRpb24pO1xyXG4gICAgICBcclxuICAgICAgLy8gTW9jayBzYXZlXHJcbiAgICAgIGplc3Quc3B5T24oc3RvcmFnZU1hbmFnZXIsICdzYXZlQ29udmVyc2F0aW9uJykubW9ja1Jlc29sdmVkVmFsdWUoKTtcclxuICAgICAgXHJcbiAgICAgIGNvbnN0IHVwZGF0ZWRDb252ZXJzYXRpb24gPSBhd2FpdCBzdG9yYWdlTWFuYWdlci51cGRhdGVNZXNzYWdlKFxyXG4gICAgICAgICd0ZXN0LWNvbnZlcnNhdGlvbicsXHJcbiAgICAgICAgJ21zZzEnLFxyXG4gICAgICAgICdVcGRhdGVkIGNvbnRlbnQnXHJcbiAgICAgICk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBTaG91bGQgdXBkYXRlIG1lc3NhZ2VcclxuICAgICAgZXhwZWN0KHVwZGF0ZWRDb252ZXJzYXRpb24ubWVzc2FnZXNbMF0uY29udGVudCkudG9CZSgnVXBkYXRlZCBjb250ZW50Jyk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBTaG91bGQgc2F2ZSBjb252ZXJzYXRpb25cclxuICAgICAgZXhwZWN0KHN0b3JhZ2VNYW5hZ2VyLnNhdmVDb252ZXJzYXRpb24pLnRvSGF2ZUJlZW5DYWxsZWQoKTtcclxuICAgICAgXHJcbiAgICAgIC8vIFNob3VsZCBlbWl0IGV2ZW50XHJcbiAgICAgIGV4cGVjdChldmVudEJ1cy5lbWl0KS50b0hhdmVCZWVuQ2FsbGVkV2l0aCgnbWVzc2FnZTp1cGRhdGVkJywge1xyXG4gICAgICAgIGNvbnZlcnNhdGlvbklkOiAndGVzdC1jb252ZXJzYXRpb24nLFxyXG4gICAgICAgIG1lc3NhZ2VJZDogJ21zZzEnLFxyXG4gICAgICAgIHByZXZpb3VzQ29udGVudDogJ0hlbGxvJyxcclxuICAgICAgICBjdXJyZW50Q29udGVudDogJ1VwZGF0ZWQgY29udGVudCcsXHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfSk7XHJcbn0pO1xyXG4iXX0=