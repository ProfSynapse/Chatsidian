/**
 * Storage manager for the Chatsidian plugin.
 *
 * This file provides the core functionality for data persistence within the Obsidian vault,
 * leveraging Obsidian's built-in APIs for file operations and event handling.
 */
import { TFile, TFolder } from '../utils/obsidian-imports';
import { ConversationUtils } from '../models/Conversation';
import { StorageUtils } from './StorageUtils';
import { ConversationNotFoundError, MessageNotFoundError, FolderOperationError, FileOperationError, JsonParseError } from './StorageErrors';
/**
 * StorageManager class for data persistence.
 * Handles saving and loading conversations, managing folders, and leveraging Obsidian's native APIs.
 */
export class StorageManager {
    /**
     * Create a new StorageManager.
     * @param app Obsidian app instance
     * @param plugin Plugin instance for lifecycle management
     * @param settings Settings manager
     * @param eventBus Event bus
     */
    constructor(app, plugin, settings, eventBus) {
        this.app = app;
        this.plugin = plugin;
        this.settings = settings;
        this.eventBus = eventBus;
    }
    /**
     * Initialize the storage manager.
     * @returns Promise that resolves when initialization is complete
     */
    async initialize() {
        // Ensure conversations folder exists
        await this.ensureConversationsFolder();
        // Register for Obsidian's vault events directly
        this.registerVaultEventListeners();
        // Register for settings changes
        this.plugin.registerEvent(this.eventBus.on('settings:updated', async (event) => {
            // If conversations folder changed, handle the change
            if (event.changedKeys.includes('conversationsFolder')) {
                await this.handleConversationsFolderChanged();
            }
        }));
    }
    /**
     * Register for Obsidian's native vault events.
     */
    registerVaultEventListeners() {
        // Register for file creation events
        this.plugin.registerEvent(this.app.vault.on('create', (file) => {
            if (this.isConversationFile(file)) {
                // A new conversation file was created
                this.loadConversation(file.basename)
                    .then(conversation => {
                    if (conversation) {
                        this.eventBus.emit('conversation:loaded', conversation);
                    }
                })
                    .catch(error => {
                    console.error(`Error loading conversation after creation: ${error}`);
                });
            }
        }));
        // Register for file modification events
        this.plugin.registerEvent(this.app.vault.on('modify', (file) => {
            if (this.isConversationFile(file)) {
                // A conversation file was modified
                this.loadConversation(file.basename)
                    .then(conversation => {
                    if (conversation) {
                        this.eventBus.emit('conversation:updated', {
                            previousConversation: conversation, // This isn't accurate but we don't have the previous state
                            currentConversation: conversation
                        });
                    }
                })
                    .catch(error => {
                    console.error(`Error loading conversation after modification: ${error}`);
                });
            }
        }));
        // Register for file deletion events
        this.plugin.registerEvent(this.app.vault.on('delete', (file) => {
            if (this.isConversationFile(file)) {
                // A conversation file was deleted
                this.eventBus.emit('conversation:deleted', file.basename);
            }
        }));
        // Register for file rename events
        this.plugin.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
            var _a;
            if (this.isConversationFile(file)) {
                // A conversation file was renamed
                const oldBasename = (_a = oldPath.split('/').pop()) === null || _a === void 0 ? void 0 : _a.replace('.json', '');
                if (oldBasename) {
                    this.eventBus.emit('conversation:renamed', {
                        oldId: oldBasename,
                        newId: file.basename
                    });
                }
            }
        }));
    }
    /**
     * Check if a file is a conversation file.
     * @param file File to check
     * @returns True if the file is a conversation file
     */
    isConversationFile(file) {
        if (!(file instanceof TFile))
            return false;
        if (file.extension !== 'json')
            return false;
        const conversationsPath = this.settings.getConversationsPath();
        return file.path.startsWith(conversationsPath);
    }
    /**
     * Handle conversations folder change.
     */
    async handleConversationsFolderChanged() {
        // Ensure the new folder exists
        await this.ensureConversationsFolder();
        // Notify listeners that storage has been reloaded
        this.eventBus.emit('storage:reloaded', undefined);
    }
    /**
     * Ensure the conversations folder exists.
     * @returns Promise that resolves when the folder exists
     */
    async ensureConversationsFolder() {
        const path = this.settings.getConversationsPath();
        try {
            const folder = this.app.vault.getAbstractFileByPath(path);
            if (!folder) {
                // Create folder if it doesn't exist
                await this.app.vault.createFolder(path);
            }
            else if (!(folder instanceof TFolder)) {
                throw new FolderOperationError(path, `${path} exists but is not a folder`);
            }
        }
        catch (error) {
            console.error(`Failed to create conversations folder: ${error}`);
            throw new FolderOperationError(path, error.message);
        }
    }
    /**
     * Get all conversations.
     * @returns Promise that resolves with an array of conversations
     */
    async getConversations() {
        const path = this.settings.getConversationsPath();
        const folder = this.app.vault.getAbstractFileByPath(path);
        if (!(folder instanceof TFolder)) {
            return [];
        }
        const conversations = [];
        for (const file of folder.children) {
            if (file instanceof TFile && file.extension === 'json') {
                try {
                    const conversation = await this.loadConversation(file.basename);
                    if (conversation) {
                        conversations.push(conversation);
                    }
                }
                catch (error) {
                    console.error(`Error loading conversation ${file.basename}: ${error}`);
                    // Continue with other conversations
                }
            }
        }
        // Sort by modification date (newest first)
        return conversations.sort((a, b) => b.modifiedAt - a.modifiedAt);
    }
    /**
     * Get a conversation by ID.
     * @param id Conversation ID
     * @returns Promise that resolves with the conversation or null if not found
     */
    async getConversation(id) {
        return this.loadConversation(id);
    }
    /**
     * Load a conversation from disk.
     * @param id Conversation ID
     * @returns Promise that resolves with the conversation or null if not found
     */
    async loadConversation(id) {
        try {
            const path = `${this.settings.getConversationsPath()}/${id}.json`;
            const file = this.app.vault.getAbstractFileByPath(path);
            if (!(file instanceof TFile)) {
                return null;
            }
            const content = await this.app.vault.read(file);
            try {
                const conversation = JSON.parse(content);
                // Add file reference
                conversation.file = file;
                conversation.path = file.path;
                return conversation;
            }
            catch (error) {
                throw new JsonParseError(error.message);
            }
        }
        catch (error) {
            if (error instanceof JsonParseError) {
                throw error;
            }
            console.error(`Failed to load conversation ${id}: ${error}`);
            return null;
        }
    }
    /**
     * Save a conversation.
     * @param conversation Conversation to save
     * @returns Promise that resolves when the conversation is saved
     */
    async saveConversation(conversation) {
        try {
            // Update modification time
            conversation.modifiedAt = Date.now();
            // Path to file
            const path = `${this.settings.getConversationsPath()}/${conversation.id}.json`;
            // Create a copy without file reference for serialization
            const conversationToSave = { ...conversation };
            delete conversationToSave.file;
            delete conversationToSave.path;
            // Convert to JSON
            const content = JSON.stringify(conversationToSave, null, 2);
            // Check if file exists
            const file = this.app.vault.getAbstractFileByPath(path);
            if (file instanceof TFile) {
                // Update existing file
                await this.app.vault.modify(file, content);
            }
            else {
                // Create new file
                await this.app.vault.create(path, content);
            }
            // We don't need to emit an event here as the vault events will handle that
        }
        catch (error) {
            console.error(`Failed to save conversation ${conversation.id}: ${error}`);
            throw new FileOperationError(`${this.settings.getConversationsPath()}/${conversation.id}.json`, error.message);
        }
    }
    /**
     * Create a new conversation.
     * @param title Optional title for the conversation
     * @returns Promise that resolves with the new conversation
     */
    async createConversation(title) {
        const conversation = ConversationUtils.createNew(title);
        await this.saveConversation(conversation);
        // Vault 'create' event will trigger the 'conversation:created' event
        return conversation;
    }
    /**
     * Delete a conversation.
     * @param id Conversation ID
     * @returns Promise that resolves when the conversation is deleted
     */
    async deleteConversation(id) {
        try {
            const path = `${this.settings.getConversationsPath()}/${id}.json`;
            const file = this.app.vault.getAbstractFileByPath(path);
            if (file instanceof TFile) {
                await this.app.vault.delete(file);
            }
            else {
                throw new ConversationNotFoundError(id);
            }
            // Vault 'delete' event will trigger the 'conversation:deleted' event
        }
        catch (error) {
            if (error instanceof ConversationNotFoundError) {
                throw error;
            }
            console.error(`Failed to delete conversation ${id}: ${error}`);
            throw new FileOperationError(`${this.settings.getConversationsPath()}/${id}.json`, error.message);
        }
    }
    /**
     * Add a message to a conversation.
     * @param conversationId Conversation ID
     * @param message Message to add
     * @returns Promise that resolves with the updated conversation
     */
    async addMessage(conversationId, message) {
        // Get conversation
        const conversation = await this.getConversation(conversationId);
        if (!conversation) {
            throw new ConversationNotFoundError(conversationId);
        }
        // Add message
        const updatedConversation = ConversationUtils.addMessage(conversation, message);
        // Save conversation
        await this.saveConversation(updatedConversation);
        // Emit a specific message event
        this.eventBus.emit('message:added', {
            conversationId,
            message
        });
        return updatedConversation;
    }
    /**
     * Update a message in a conversation.
     * @param conversationId Conversation ID
     * @param messageId Message ID
     * @param updatedContent Updated message content
     * @returns Promise that resolves with the updated conversation
     */
    async updateMessage(conversationId, messageId, updatedContent) {
        // Get conversation
        const conversation = await this.getConversation(conversationId);
        if (!conversation) {
            throw new ConversationNotFoundError(conversationId);
        }
        // Find message
        const messageIndex = conversation.messages.findIndex(m => m.id === messageId);
        if (messageIndex === -1) {
            throw new MessageNotFoundError(conversationId, messageId);
        }
        // Store previous content for event
        const previousContent = conversation.messages[messageIndex].content;
        // Create a new conversation object with the updated message
        const updatedConversation = {
            ...conversation,
            messages: [...conversation.messages],
            modifiedAt: Date.now()
        };
        // Update the message
        updatedConversation.messages[messageIndex] = {
            ...updatedConversation.messages[messageIndex],
            content: updatedContent
        };
        // Save conversation
        await this.saveConversation(updatedConversation);
        // Emit a specific message event
        this.eventBus.emit('message:updated', {
            conversationId,
            messageId,
            previousContent,
            currentContent: updatedContent
        });
        return updatedConversation;
    }
    /**
     * Rename a conversation.
     * Uses FileManager to ensure links are updated.
     * @param conversationId Conversation ID
     * @param newTitle New conversation title
     * @returns Promise that resolves with the updated conversation
     */
    async renameConversation(conversationId, newTitle) {
        // Get conversation
        const conversation = await this.getConversation(conversationId);
        if (!conversation) {
            throw new ConversationNotFoundError(conversationId);
        }
        // Create a new conversation object with the updated title
        const updatedConversation = {
            ...conversation,
            title: newTitle,
            modifiedAt: Date.now()
        };
        // Save conversation
        await this.saveConversation(updatedConversation);
        return updatedConversation;
    }
    /**
     * Export a conversation to Markdown.
     * @param conversationId Conversation ID
     * @returns Promise that resolves when the export is complete
     */
    async exportToMarkdown(conversationId) {
        try {
            const conversation = await this.getConversation(conversationId);
            if (!conversation) {
                throw new ConversationNotFoundError(conversationId);
            }
            await StorageUtils.exportConversation(this.app, conversation, 'markdown');
        }
        catch (error) {
            if (error instanceof ConversationNotFoundError) {
                throw error;
            }
            console.error(`Failed to export conversation ${conversationId}: ${error}`);
            throw error;
        }
    }
    /**
     * Export a conversation to JSON.
     * @param conversationId Conversation ID
     * @returns Promise that resolves when the export is complete
     */
    async exportToJson(conversationId) {
        try {
            const conversation = await this.getConversation(conversationId);
            if (!conversation) {
                throw new ConversationNotFoundError(conversationId);
            }
            await StorageUtils.exportConversation(this.app, conversation, 'json');
        }
        catch (error) {
            if (error instanceof ConversationNotFoundError) {
                throw error;
            }
            console.error(`Failed to export conversation ${conversationId}: ${error}`);
            throw error;
        }
    }
    /**
     * Import a conversation from JSON.
     * @param json Conversation JSON
     * @returns Promise that resolves with the imported conversation
     */
    async importConversation(json) {
        try {
            const importedConversation = StorageUtils.parseJsonToConversation(json);
            // Generate a new ID to avoid conflicts
            const originalId = importedConversation.id;
            importedConversation.id = StorageUtils.generateId();
            // Update title to indicate it's an import
            if (!importedConversation.title.includes('(Import)')) {
                importedConversation.title = `${importedConversation.title} (Import)`;
            }
            // Save the conversation
            await this.saveConversation(importedConversation);
            return importedConversation;
        }
        catch (error) {
            console.error(`Failed to import conversation: ${error}`);
            throw error;
        }
    }
    /**
     * Import a conversation from Markdown.
     * @param markdown Markdown content
     * @returns Promise that resolves with the imported conversation
     */
    async importFromMarkdown(markdown) {
        try {
            const importedConversation = StorageUtils.parseMarkdownToConversation(markdown);
            // Save the conversation
            await this.saveConversation(importedConversation);
            return importedConversation;
        }
        catch (error) {
            console.error(`Failed to import conversation from Markdown: ${error}`);
            throw error;
        }
    }
    /**
     * Create a backup of a conversation.
     * @param conversationId Conversation ID
     * @returns Promise that resolves with the path to the backup file
     */
    async backupConversation(conversationId) {
        try {
            const conversation = await this.getConversation(conversationId);
            if (!conversation) {
                throw new ConversationNotFoundError(conversationId);
            }
            const backupFolder = `${this.settings.getConversationsPath()}/backups`;
            return await StorageUtils.backupConversation(this.app, conversation, backupFolder);
        }
        catch (error) {
            if (error instanceof ConversationNotFoundError) {
                throw error;
            }
            console.error(`Failed to backup conversation ${conversationId}: ${error}`);
            throw error;
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU3RvcmFnZU1hbmFnZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJTdG9yYWdlTWFuYWdlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7R0FLRztBQUVILE9BQU8sRUFBTyxLQUFLLEVBQUUsT0FBTyxFQUFrQixNQUFNLDJCQUEyQixDQUFDO0FBQ2hGLE9BQU8sRUFBc0MsaUJBQWlCLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUcvRixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDOUMsT0FBTyxFQUVMLHlCQUF5QixFQUN6QixvQkFBb0IsRUFDcEIsb0JBQW9CLEVBQ3BCLGtCQUFrQixFQUNsQixjQUFjLEVBQ2YsTUFBTSxpQkFBaUIsQ0FBQztBQUV6Qjs7O0dBR0c7QUFDSCxNQUFNLE9BQU8sY0FBYztJQU16Qjs7Ozs7O09BTUc7SUFDSCxZQUNFLEdBQVEsRUFDUixNQUFjLEVBQ2QsUUFBeUIsRUFDekIsUUFBa0I7UUFFbEIsSUFBSSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7UUFDZixJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztRQUNyQixJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztRQUN6QixJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztJQUMzQixDQUFDO0lBRUQ7OztPQUdHO0lBQ0ksS0FBSyxDQUFDLFVBQVU7UUFDckIscUNBQXFDO1FBQ3JDLE1BQU0sSUFBSSxDQUFDLHlCQUF5QixFQUFFLENBQUM7UUFFdkMsZ0RBQWdEO1FBQ2hELElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDO1FBRW5DLGdDQUFnQztRQUNoQyxJQUFJLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FDdkIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsa0JBQWtCLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxFQUFFO1lBQ25ELHFEQUFxRDtZQUNyRCxJQUFJLEtBQUssQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLHFCQUFxQixDQUFDLEVBQUUsQ0FBQztnQkFDdEQsTUFBTSxJQUFJLENBQUMsZ0NBQWdDLEVBQUUsQ0FBQztZQUNoRCxDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQ0gsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNLLDJCQUEyQjtRQUNqQyxvQ0FBb0M7UUFDcEMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQ3ZCLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxJQUFXLEVBQUUsRUFBRTtZQUMxQyxJQUFJLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUNsQyxzQ0FBc0M7Z0JBQ3RDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO3FCQUNqQyxJQUFJLENBQUMsWUFBWSxDQUFDLEVBQUU7b0JBQ25CLElBQUksWUFBWSxFQUFFLENBQUM7d0JBQ2pCLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLHFCQUFxQixFQUFFLFlBQVksQ0FBQyxDQUFDO29CQUMxRCxDQUFDO2dCQUNILENBQUMsQ0FBQztxQkFDRCxLQUFLLENBQUMsS0FBSyxDQUFDLEVBQUU7b0JBQ2IsT0FBTyxDQUFDLEtBQUssQ0FBQyw4Q0FBOEMsS0FBSyxFQUFFLENBQUMsQ0FBQztnQkFDdkUsQ0FBQyxDQUFDLENBQUM7WUFDUCxDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQ0gsQ0FBQztRQUVGLHdDQUF3QztRQUN4QyxJQUFJLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FDdkIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLFFBQVEsRUFBRSxDQUFDLElBQVcsRUFBRSxFQUFFO1lBQzFDLElBQUksSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7Z0JBQ2xDLG1DQUFtQztnQkFDbkMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUM7cUJBQ2pDLElBQUksQ0FBQyxZQUFZLENBQUMsRUFBRTtvQkFDbkIsSUFBSSxZQUFZLEVBQUUsQ0FBQzt3QkFDakIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsc0JBQXNCLEVBQUU7NEJBQ3pDLG9CQUFvQixFQUFFLFlBQVksRUFBRSwyREFBMkQ7NEJBQy9GLG1CQUFtQixFQUFFLFlBQVk7eUJBQ2xDLENBQUMsQ0FBQztvQkFDTCxDQUFDO2dCQUNILENBQUMsQ0FBQztxQkFDRCxLQUFLLENBQUMsS0FBSyxDQUFDLEVBQUU7b0JBQ2IsT0FBTyxDQUFDLEtBQUssQ0FBQyxrREFBa0QsS0FBSyxFQUFFLENBQUMsQ0FBQztnQkFDM0UsQ0FBQyxDQUFDLENBQUM7WUFDUCxDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQ0gsQ0FBQztRQUVGLG9DQUFvQztRQUNwQyxJQUFJLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FDdkIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLFFBQVEsRUFBRSxDQUFDLElBQVcsRUFBRSxFQUFFO1lBQzFDLElBQUksSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7Z0JBQ2xDLGtDQUFrQztnQkFDbEMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsc0JBQXNCLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQzVELENBQUM7UUFDSCxDQUFDLENBQUMsQ0FDSCxDQUFDO1FBRUYsa0NBQWtDO1FBQ2xDLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUN2QixJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsUUFBUSxFQUFFLENBQUMsSUFBVyxFQUFFLE9BQWUsRUFBRSxFQUFFOztZQUMzRCxJQUFJLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUNsQyxrQ0FBa0M7Z0JBQ2xDLE1BQU0sV0FBVyxHQUFHLE1BQUEsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsMENBQUUsT0FBTyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQztnQkFDbkUsSUFBSSxXQUFXLEVBQUUsQ0FBQztvQkFDaEIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsc0JBQXNCLEVBQUU7d0JBQ3pDLEtBQUssRUFBRSxXQUFXO3dCQUNsQixLQUFLLEVBQUUsSUFBSSxDQUFDLFFBQVE7cUJBQ3JCLENBQUMsQ0FBQztnQkFDTCxDQUFDO1lBQ0gsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUNILENBQUM7SUFDSixDQUFDO0lBRUQ7Ozs7T0FJRztJQUNLLGtCQUFrQixDQUFDLElBQVc7UUFDcEMsSUFBSSxDQUFDLENBQUMsSUFBSSxZQUFZLEtBQUssQ0FBQztZQUFFLE9BQU8sS0FBSyxDQUFDO1FBQzNDLElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxNQUFNO1lBQUUsT0FBTyxLQUFLLENBQUM7UUFFNUMsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLG9CQUFvQixFQUFFLENBQUM7UUFDL0QsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ2pELENBQUM7SUFFRDs7T0FFRztJQUNLLEtBQUssQ0FBQyxnQ0FBZ0M7UUFDNUMsK0JBQStCO1FBQy9CLE1BQU0sSUFBSSxDQUFDLHlCQUF5QixFQUFFLENBQUM7UUFFdkMsa0RBQWtEO1FBQ2xELElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLGtCQUFrQixFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ3BELENBQUM7SUFFRDs7O09BR0c7SUFDSyxLQUFLLENBQUMseUJBQXlCO1FBQ3JDLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsb0JBQW9CLEVBQUUsQ0FBQztRQUVsRCxJQUFJLENBQUM7WUFDSCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUUxRCxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQ1osb0NBQW9DO2dCQUNwQyxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUMxQyxDQUFDO2lCQUFNLElBQUksQ0FBQyxDQUFDLE1BQU0sWUFBWSxPQUFPLENBQUMsRUFBRSxDQUFDO2dCQUN4QyxNQUFNLElBQUksb0JBQW9CLENBQUMsSUFBSSxFQUFFLEdBQUcsSUFBSSw2QkFBNkIsQ0FBQyxDQUFDO1lBQzdFLENBQUM7UUFDSCxDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNmLE9BQU8sQ0FBQyxLQUFLLENBQUMsMENBQTBDLEtBQUssRUFBRSxDQUFDLENBQUM7WUFDakUsTUFBTSxJQUFJLG9CQUFvQixDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDdEQsQ0FBQztJQUNILENBQUM7SUFFRDs7O09BR0c7SUFDSSxLQUFLLENBQUMsZ0JBQWdCO1FBQzNCLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsb0JBQW9CLEVBQUUsQ0FBQztRQUNsRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUUxRCxJQUFJLENBQUMsQ0FBQyxNQUFNLFlBQVksT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxPQUFPLEVBQUUsQ0FBQztRQUNaLENBQUM7UUFFRCxNQUFNLGFBQWEsR0FBbUIsRUFBRSxDQUFDO1FBRXpDLEtBQUssTUFBTSxJQUFJLElBQUksTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ25DLElBQUksSUFBSSxZQUFZLEtBQUssSUFBSSxJQUFJLENBQUMsU0FBUyxLQUFLLE1BQU0sRUFBRSxDQUFDO2dCQUN2RCxJQUFJLENBQUM7b0JBQ0gsTUFBTSxZQUFZLEdBQUcsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO29CQUNoRSxJQUFJLFlBQVksRUFBRSxDQUFDO3dCQUNqQixhQUFhLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO29CQUNuQyxDQUFDO2dCQUNILENBQUM7Z0JBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztvQkFDZixPQUFPLENBQUMsS0FBSyxDQUFDLDhCQUE4QixJQUFJLENBQUMsUUFBUSxLQUFLLEtBQUssRUFBRSxDQUFDLENBQUM7b0JBQ3ZFLG9DQUFvQztnQkFDdEMsQ0FBQztZQUNILENBQUM7UUFDSCxDQUFDO1FBRUQsMkNBQTJDO1FBQzNDLE9BQU8sYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ25FLENBQUM7SUFFRDs7OztPQUlHO0lBQ0ksS0FBSyxDQUFDLGVBQWUsQ0FBQyxFQUFVO1FBQ3JDLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ25DLENBQUM7SUFFRDs7OztPQUlHO0lBQ0ssS0FBSyxDQUFDLGdCQUFnQixDQUFDLEVBQVU7UUFDdkMsSUFBSSxDQUFDO1lBQ0gsTUFBTSxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLG9CQUFvQixFQUFFLElBQUksRUFBRSxPQUFPLENBQUM7WUFDbEUsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFeEQsSUFBSSxDQUFDLENBQUMsSUFBSSxZQUFZLEtBQUssQ0FBQyxFQUFFLENBQUM7Z0JBQzdCLE9BQU8sSUFBSSxDQUFDO1lBQ2QsQ0FBQztZQUVELE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBRWhELElBQUksQ0FBQztnQkFDSCxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBaUIsQ0FBQztnQkFFekQscUJBQXFCO2dCQUNyQixZQUFZLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztnQkFDekIsWUFBWSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO2dCQUU5QixPQUFPLFlBQVksQ0FBQztZQUN0QixDQUFDO1lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztnQkFDZixNQUFNLElBQUksY0FBYyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUMxQyxDQUFDO1FBQ0gsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixJQUFJLEtBQUssWUFBWSxjQUFjLEVBQUUsQ0FBQztnQkFDcEMsTUFBTSxLQUFLLENBQUM7WUFDZCxDQUFDO1lBQ0QsT0FBTyxDQUFDLEtBQUssQ0FBQywrQkFBK0IsRUFBRSxLQUFLLEtBQUssRUFBRSxDQUFDLENBQUM7WUFDN0QsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO0lBQ0gsQ0FBQztJQUVEOzs7O09BSUc7SUFDSSxLQUFLLENBQUMsZ0JBQWdCLENBQUMsWUFBMEI7UUFDdEQsSUFBSSxDQUFDO1lBQ0gsMkJBQTJCO1lBQzNCLFlBQVksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBRXJDLGVBQWU7WUFDZixNQUFNLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsb0JBQW9CLEVBQUUsSUFBSSxZQUFZLENBQUMsRUFBRSxPQUFPLENBQUM7WUFFL0UseURBQXlEO1lBQ3pELE1BQU0sa0JBQWtCLEdBQUcsRUFBRSxHQUFHLFlBQVksRUFBRSxDQUFDO1lBQy9DLE9BQU8sa0JBQWtCLENBQUMsSUFBSSxDQUFDO1lBQy9CLE9BQU8sa0JBQWtCLENBQUMsSUFBSSxDQUFDO1lBRS9CLGtCQUFrQjtZQUNsQixNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLGtCQUFrQixFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztZQUU1RCx1QkFBdUI7WUFDdkIsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFeEQsSUFBSSxJQUFJLFlBQVksS0FBSyxFQUFFLENBQUM7Z0JBQzFCLHVCQUF1QjtnQkFDdkIsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQzdDLENBQUM7aUJBQU0sQ0FBQztnQkFDTixrQkFBa0I7Z0JBQ2xCLE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztZQUM3QyxDQUFDO1lBRUQsMkVBQTJFO1FBQzdFLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQywrQkFBK0IsWUFBWSxDQUFDLEVBQUUsS0FBSyxLQUFLLEVBQUUsQ0FBQyxDQUFDO1lBQzFFLE1BQU0sSUFBSSxrQkFBa0IsQ0FBQyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsb0JBQW9CLEVBQUUsSUFBSSxZQUFZLENBQUMsRUFBRSxPQUFPLEVBQUUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2pILENBQUM7SUFDSCxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNJLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxLQUFjO1FBQzVDLE1BQU0sWUFBWSxHQUFHLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUV4RCxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUUxQyxxRUFBcUU7UUFDckUsT0FBTyxZQUFZLENBQUM7SUFDdEIsQ0FBQztJQUVEOzs7O09BSUc7SUFDSSxLQUFLLENBQUMsa0JBQWtCLENBQUMsRUFBVTtRQUN4QyxJQUFJLENBQUM7WUFDSCxNQUFNLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsb0JBQW9CLEVBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQztZQUNsRSxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUV4RCxJQUFJLElBQUksWUFBWSxLQUFLLEVBQUUsQ0FBQztnQkFDMUIsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDcEMsQ0FBQztpQkFBTSxDQUFDO2dCQUNOLE1BQU0sSUFBSSx5QkFBeUIsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUMxQyxDQUFDO1lBRUQscUVBQXFFO1FBQ3ZFLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsSUFBSSxLQUFLLFlBQVkseUJBQXlCLEVBQUUsQ0FBQztnQkFDL0MsTUFBTSxLQUFLLENBQUM7WUFDZCxDQUFDO1lBQ0QsT0FBTyxDQUFDLEtBQUssQ0FBQyxpQ0FBaUMsRUFBRSxLQUFLLEtBQUssRUFBRSxDQUFDLENBQUM7WUFDL0QsTUFBTSxJQUFJLGtCQUFrQixDQUFDLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxvQkFBb0IsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNwRyxDQUFDO0lBQ0gsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0ksS0FBSyxDQUFDLFVBQVUsQ0FBQyxjQUFzQixFQUFFLE9BQWdCO1FBQzlELG1CQUFtQjtRQUNuQixNQUFNLFlBQVksR0FBRyxNQUFNLElBQUksQ0FBQyxlQUFlLENBQUMsY0FBYyxDQUFDLENBQUM7UUFFaEUsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ2xCLE1BQU0sSUFBSSx5QkFBeUIsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUN0RCxDQUFDO1FBRUQsY0FBYztRQUNkLE1BQU0sbUJBQW1CLEdBQUcsaUJBQWlCLENBQUMsVUFBVSxDQUFDLFlBQVksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUVoRixvQkFBb0I7UUFDcEIsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsbUJBQW1CLENBQUMsQ0FBQztRQUVqRCxnQ0FBZ0M7UUFDaEMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFO1lBQ2xDLGNBQWM7WUFDZCxPQUFPO1NBQ1IsQ0FBQyxDQUFDO1FBRUgsT0FBTyxtQkFBbUIsQ0FBQztJQUM3QixDQUFDO0lBRUQ7Ozs7OztPQU1HO0lBQ0ksS0FBSyxDQUFDLGFBQWEsQ0FDeEIsY0FBc0IsRUFDdEIsU0FBaUIsRUFDakIsY0FBc0I7UUFFdEIsbUJBQW1CO1FBQ25CLE1BQU0sWUFBWSxHQUFHLE1BQU0sSUFBSSxDQUFDLGVBQWUsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUVoRSxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDbEIsTUFBTSxJQUFJLHlCQUF5QixDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ3RELENBQUM7UUFFRCxlQUFlO1FBQ2YsTUFBTSxZQUFZLEdBQUcsWUFBWSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLFNBQVMsQ0FBQyxDQUFDO1FBRTlFLElBQUksWUFBWSxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUM7WUFDeEIsTUFBTSxJQUFJLG9CQUFvQixDQUFDLGNBQWMsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUM1RCxDQUFDO1FBRUQsbUNBQW1DO1FBQ25DLE1BQU0sZUFBZSxHQUFHLFlBQVksQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLENBQUMsT0FBTyxDQUFDO1FBRXBFLDREQUE0RDtRQUM1RCxNQUFNLG1CQUFtQixHQUFHO1lBQzFCLEdBQUcsWUFBWTtZQUNmLFFBQVEsRUFBRSxDQUFDLEdBQUcsWUFBWSxDQUFDLFFBQVEsQ0FBQztZQUNwQyxVQUFVLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtTQUN2QixDQUFDO1FBRUYscUJBQXFCO1FBQ3JCLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsR0FBRztZQUMzQyxHQUFHLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUM7WUFDN0MsT0FBTyxFQUFFLGNBQWM7U0FDeEIsQ0FBQztRQUVGLG9CQUFvQjtRQUNwQixNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBRWpELGdDQUFnQztRQUNoQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsRUFBRTtZQUNwQyxjQUFjO1lBQ2QsU0FBUztZQUNULGVBQWU7WUFDZixjQUFjLEVBQUUsY0FBYztTQUMvQixDQUFDLENBQUM7UUFFSCxPQUFPLG1CQUFtQixDQUFDO0lBQzdCLENBQUM7SUFFRDs7Ozs7O09BTUc7SUFDSSxLQUFLLENBQUMsa0JBQWtCLENBQzdCLGNBQXNCLEVBQ3RCLFFBQWdCO1FBRWhCLG1CQUFtQjtRQUNuQixNQUFNLFlBQVksR0FBRyxNQUFNLElBQUksQ0FBQyxlQUFlLENBQUMsY0FBYyxDQUFDLENBQUM7UUFFaEUsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ2xCLE1BQU0sSUFBSSx5QkFBeUIsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUN0RCxDQUFDO1FBRUQsMERBQTBEO1FBQzFELE1BQU0sbUJBQW1CLEdBQUc7WUFDMUIsR0FBRyxZQUFZO1lBQ2YsS0FBSyxFQUFFLFFBQVE7WUFDZixVQUFVLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtTQUN2QixDQUFDO1FBRUYsb0JBQW9CO1FBQ3BCLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLG1CQUFtQixDQUFDLENBQUM7UUFFakQsT0FBTyxtQkFBbUIsQ0FBQztJQUM3QixDQUFDO0lBRUQ7Ozs7T0FJRztJQUNJLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxjQUFzQjtRQUNsRCxJQUFJLENBQUM7WUFDSCxNQUFNLFlBQVksR0FBRyxNQUFNLElBQUksQ0FBQyxlQUFlLENBQUMsY0FBYyxDQUFDLENBQUM7WUFFaEUsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO2dCQUNsQixNQUFNLElBQUkseUJBQXlCLENBQUMsY0FBYyxDQUFDLENBQUM7WUFDdEQsQ0FBQztZQUVELE1BQU0sWUFBWSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsWUFBWSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQzVFLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsSUFBSSxLQUFLLFlBQVkseUJBQXlCLEVBQUUsQ0FBQztnQkFDL0MsTUFBTSxLQUFLLENBQUM7WUFDZCxDQUFDO1lBQ0QsT0FBTyxDQUFDLEtBQUssQ0FBQyxpQ0FBaUMsY0FBYyxLQUFLLEtBQUssRUFBRSxDQUFDLENBQUM7WUFDM0UsTUFBTSxLQUFLLENBQUM7UUFDZCxDQUFDO0lBQ0gsQ0FBQztJQUVEOzs7O09BSUc7SUFDSSxLQUFLLENBQUMsWUFBWSxDQUFDLGNBQXNCO1FBQzlDLElBQUksQ0FBQztZQUNILE1BQU0sWUFBWSxHQUFHLE1BQU0sSUFBSSxDQUFDLGVBQWUsQ0FBQyxjQUFjLENBQUMsQ0FBQztZQUVoRSxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7Z0JBQ2xCLE1BQU0sSUFBSSx5QkFBeUIsQ0FBQyxjQUFjLENBQUMsQ0FBQztZQUN0RCxDQUFDO1lBRUQsTUFBTSxZQUFZLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxZQUFZLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDeEUsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixJQUFJLEtBQUssWUFBWSx5QkFBeUIsRUFBRSxDQUFDO2dCQUMvQyxNQUFNLEtBQUssQ0FBQztZQUNkLENBQUM7WUFDRCxPQUFPLENBQUMsS0FBSyxDQUFDLGlDQUFpQyxjQUFjLEtBQUssS0FBSyxFQUFFLENBQUMsQ0FBQztZQUMzRSxNQUFNLEtBQUssQ0FBQztRQUNkLENBQUM7SUFDSCxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNJLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxJQUFZO1FBQzFDLElBQUksQ0FBQztZQUNILE1BQU0sb0JBQW9CLEdBQUcsWUFBWSxDQUFDLHVCQUF1QixDQUFDLElBQUksQ0FBQyxDQUFDO1lBRXhFLHVDQUF1QztZQUN2QyxNQUFNLFVBQVUsR0FBRyxvQkFBb0IsQ0FBQyxFQUFFLENBQUM7WUFDM0Msb0JBQW9CLENBQUMsRUFBRSxHQUFHLFlBQVksQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUVwRCwwQ0FBMEM7WUFDMUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztnQkFDckQsb0JBQW9CLENBQUMsS0FBSyxHQUFHLEdBQUcsb0JBQW9CLENBQUMsS0FBSyxXQUFXLENBQUM7WUFDeEUsQ0FBQztZQUVELHdCQUF3QjtZQUN4QixNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1lBRWxELE9BQU8sb0JBQW9CLENBQUM7UUFDOUIsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixPQUFPLENBQUMsS0FBSyxDQUFDLGtDQUFrQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO1lBQ3pELE1BQU0sS0FBSyxDQUFDO1FBQ2QsQ0FBQztJQUNILENBQUM7SUFFRDs7OztPQUlHO0lBQ0ksS0FBSyxDQUFDLGtCQUFrQixDQUFDLFFBQWdCO1FBQzlDLElBQUksQ0FBQztZQUNILE1BQU0sb0JBQW9CLEdBQUcsWUFBWSxDQUFDLDJCQUEyQixDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBRWhGLHdCQUF3QjtZQUN4QixNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1lBRWxELE9BQU8sb0JBQW9CLENBQUM7UUFDOUIsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixPQUFPLENBQUMsS0FBSyxDQUFDLGdEQUFnRCxLQUFLLEVBQUUsQ0FBQyxDQUFDO1lBQ3ZFLE1BQU0sS0FBSyxDQUFDO1FBQ2QsQ0FBQztJQUNILENBQUM7SUFFRDs7OztPQUlHO0lBQ0ksS0FBSyxDQUFDLGtCQUFrQixDQUFDLGNBQXNCO1FBQ3BELElBQUksQ0FBQztZQUNILE1BQU0sWUFBWSxHQUFHLE1BQU0sSUFBSSxDQUFDLGVBQWUsQ0FBQyxjQUFjLENBQUMsQ0FBQztZQUVoRSxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7Z0JBQ2xCLE1BQU0sSUFBSSx5QkFBeUIsQ0FBQyxjQUFjLENBQUMsQ0FBQztZQUN0RCxDQUFDO1lBRUQsTUFBTSxZQUFZLEdBQUcsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLG9CQUFvQixFQUFFLFVBQVUsQ0FBQztZQUV2RSxPQUFPLE1BQU0sWUFBWSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsWUFBWSxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQ3JGLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsSUFBSSxLQUFLLFlBQVkseUJBQXlCLEVBQUUsQ0FBQztnQkFDL0MsTUFBTSxLQUFLLENBQUM7WUFDZCxDQUFDO1lBQ0QsT0FBTyxDQUFDLEtBQUssQ0FBQyxpQ0FBaUMsY0FBYyxLQUFLLEtBQUssRUFBRSxDQUFDLENBQUM7WUFDM0UsTUFBTSxLQUFLLENBQUM7UUFDZCxDQUFDO0lBQ0gsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIFN0b3JhZ2UgbWFuYWdlciBmb3IgdGhlIENoYXRzaWRpYW4gcGx1Z2luLlxyXG4gKiBcclxuICogVGhpcyBmaWxlIHByb3ZpZGVzIHRoZSBjb3JlIGZ1bmN0aW9uYWxpdHkgZm9yIGRhdGEgcGVyc2lzdGVuY2Ugd2l0aGluIHRoZSBPYnNpZGlhbiB2YXVsdCxcclxuICogbGV2ZXJhZ2luZyBPYnNpZGlhbidzIGJ1aWx0LWluIEFQSXMgZm9yIGZpbGUgb3BlcmF0aW9ucyBhbmQgZXZlbnQgaGFuZGxpbmcuXHJcbiAqL1xyXG5cclxuaW1wb3J0IHsgQXBwLCBURmlsZSwgVEZvbGRlciwgTm90aWNlLCBQbHVnaW4gfSBmcm9tICcuLi91dGlscy9vYnNpZGlhbi1pbXBvcnRzJztcclxuaW1wb3J0IHsgQ29udmVyc2F0aW9uLCBNZXNzYWdlLCBNZXNzYWdlUm9sZSwgQ29udmVyc2F0aW9uVXRpbHMgfSBmcm9tICcuLi9tb2RlbHMvQ29udmVyc2F0aW9uJztcclxuaW1wb3J0IHsgRXZlbnRCdXMgfSBmcm9tICcuL0V2ZW50QnVzJztcclxuaW1wb3J0IHsgU2V0dGluZ3NNYW5hZ2VyIH0gZnJvbSAnLi9TZXR0aW5nc01hbmFnZXInO1xyXG5pbXBvcnQgeyBTdG9yYWdlVXRpbHMgfSBmcm9tICcuL1N0b3JhZ2VVdGlscyc7XHJcbmltcG9ydCB7XHJcbiAgU3RvcmFnZUVycm9yLFxyXG4gIENvbnZlcnNhdGlvbk5vdEZvdW5kRXJyb3IsXHJcbiAgTWVzc2FnZU5vdEZvdW5kRXJyb3IsXHJcbiAgRm9sZGVyT3BlcmF0aW9uRXJyb3IsXHJcbiAgRmlsZU9wZXJhdGlvbkVycm9yLFxyXG4gIEpzb25QYXJzZUVycm9yXHJcbn0gZnJvbSAnLi9TdG9yYWdlRXJyb3JzJztcclxuXHJcbi8qKlxyXG4gKiBTdG9yYWdlTWFuYWdlciBjbGFzcyBmb3IgZGF0YSBwZXJzaXN0ZW5jZS5cclxuICogSGFuZGxlcyBzYXZpbmcgYW5kIGxvYWRpbmcgY29udmVyc2F0aW9ucywgbWFuYWdpbmcgZm9sZGVycywgYW5kIGxldmVyYWdpbmcgT2JzaWRpYW4ncyBuYXRpdmUgQVBJcy5cclxuICovXHJcbmV4cG9ydCBjbGFzcyBTdG9yYWdlTWFuYWdlciB7XHJcbiAgcHJpdmF0ZSBhcHA6IEFwcDtcclxuICBwcml2YXRlIHBsdWdpbjogUGx1Z2luO1xyXG4gIHByaXZhdGUgc2V0dGluZ3M6IFNldHRpbmdzTWFuYWdlcjtcclxuICBwcml2YXRlIGV2ZW50QnVzOiBFdmVudEJ1cztcclxuICBcclxuICAvKipcclxuICAgKiBDcmVhdGUgYSBuZXcgU3RvcmFnZU1hbmFnZXIuXHJcbiAgICogQHBhcmFtIGFwcCBPYnNpZGlhbiBhcHAgaW5zdGFuY2VcclxuICAgKiBAcGFyYW0gcGx1Z2luIFBsdWdpbiBpbnN0YW5jZSBmb3IgbGlmZWN5Y2xlIG1hbmFnZW1lbnRcclxuICAgKiBAcGFyYW0gc2V0dGluZ3MgU2V0dGluZ3MgbWFuYWdlclxyXG4gICAqIEBwYXJhbSBldmVudEJ1cyBFdmVudCBidXNcclxuICAgKi9cclxuICBjb25zdHJ1Y3RvcihcclxuICAgIGFwcDogQXBwLFxyXG4gICAgcGx1Z2luOiBQbHVnaW4sXHJcbiAgICBzZXR0aW5nczogU2V0dGluZ3NNYW5hZ2VyLCBcclxuICAgIGV2ZW50QnVzOiBFdmVudEJ1c1xyXG4gICkge1xyXG4gICAgdGhpcy5hcHAgPSBhcHA7XHJcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcclxuICAgIHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcclxuICAgIHRoaXMuZXZlbnRCdXMgPSBldmVudEJ1cztcclxuICB9XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbGl6ZSB0aGUgc3RvcmFnZSBtYW5hZ2VyLlxyXG4gICAqIEByZXR1cm5zIFByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIGluaXRpYWxpemF0aW9uIGlzIGNvbXBsZXRlXHJcbiAgICovXHJcbiAgcHVibGljIGFzeW5jIGluaXRpYWxpemUoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICAvLyBFbnN1cmUgY29udmVyc2F0aW9ucyBmb2xkZXIgZXhpc3RzXHJcbiAgICBhd2FpdCB0aGlzLmVuc3VyZUNvbnZlcnNhdGlvbnNGb2xkZXIoKTtcclxuICAgIFxyXG4gICAgLy8gUmVnaXN0ZXIgZm9yIE9ic2lkaWFuJ3MgdmF1bHQgZXZlbnRzIGRpcmVjdGx5XHJcbiAgICB0aGlzLnJlZ2lzdGVyVmF1bHRFdmVudExpc3RlbmVycygpO1xyXG4gICAgXHJcbiAgICAvLyBSZWdpc3RlciBmb3Igc2V0dGluZ3MgY2hhbmdlc1xyXG4gICAgdGhpcy5wbHVnaW4ucmVnaXN0ZXJFdmVudChcclxuICAgICAgdGhpcy5ldmVudEJ1cy5vbignc2V0dGluZ3M6dXBkYXRlZCcsIGFzeW5jIChldmVudCkgPT4ge1xyXG4gICAgICAgIC8vIElmIGNvbnZlcnNhdGlvbnMgZm9sZGVyIGNoYW5nZWQsIGhhbmRsZSB0aGUgY2hhbmdlXHJcbiAgICAgICAgaWYgKGV2ZW50LmNoYW5nZWRLZXlzLmluY2x1ZGVzKCdjb252ZXJzYXRpb25zRm9sZGVyJykpIHtcclxuICAgICAgICAgIGF3YWl0IHRoaXMuaGFuZGxlQ29udmVyc2F0aW9uc0ZvbGRlckNoYW5nZWQoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBSZWdpc3RlciBmb3IgT2JzaWRpYW4ncyBuYXRpdmUgdmF1bHQgZXZlbnRzLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgcmVnaXN0ZXJWYXVsdEV2ZW50TGlzdGVuZXJzKCk6IHZvaWQge1xyXG4gICAgLy8gUmVnaXN0ZXIgZm9yIGZpbGUgY3JlYXRpb24gZXZlbnRzXHJcbiAgICB0aGlzLnBsdWdpbi5yZWdpc3RlckV2ZW50KFxyXG4gICAgICB0aGlzLmFwcC52YXVsdC5vbignY3JlYXRlJywgKGZpbGU6IFRGaWxlKSA9PiB7XHJcbiAgICAgICAgaWYgKHRoaXMuaXNDb252ZXJzYXRpb25GaWxlKGZpbGUpKSB7XHJcbiAgICAgICAgICAvLyBBIG5ldyBjb252ZXJzYXRpb24gZmlsZSB3YXMgY3JlYXRlZFxyXG4gICAgICAgICAgdGhpcy5sb2FkQ29udmVyc2F0aW9uKGZpbGUuYmFzZW5hbWUpXHJcbiAgICAgICAgICAgIC50aGVuKGNvbnZlcnNhdGlvbiA9PiB7XHJcbiAgICAgICAgICAgICAgaWYgKGNvbnZlcnNhdGlvbikge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5ldmVudEJ1cy5lbWl0KCdjb252ZXJzYXRpb246bG9hZGVkJywgY29udmVyc2F0aW9uKTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgIC5jYXRjaChlcnJvciA9PiB7XHJcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgRXJyb3IgbG9hZGluZyBjb252ZXJzYXRpb24gYWZ0ZXIgY3JlYXRpb246ICR7ZXJyb3J9YCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfSlcclxuICAgICk7XHJcbiAgICBcclxuICAgIC8vIFJlZ2lzdGVyIGZvciBmaWxlIG1vZGlmaWNhdGlvbiBldmVudHNcclxuICAgIHRoaXMucGx1Z2luLnJlZ2lzdGVyRXZlbnQoXHJcbiAgICAgIHRoaXMuYXBwLnZhdWx0Lm9uKCdtb2RpZnknLCAoZmlsZTogVEZpbGUpID0+IHtcclxuICAgICAgICBpZiAodGhpcy5pc0NvbnZlcnNhdGlvbkZpbGUoZmlsZSkpIHtcclxuICAgICAgICAgIC8vIEEgY29udmVyc2F0aW9uIGZpbGUgd2FzIG1vZGlmaWVkXHJcbiAgICAgICAgICB0aGlzLmxvYWRDb252ZXJzYXRpb24oZmlsZS5iYXNlbmFtZSlcclxuICAgICAgICAgICAgLnRoZW4oY29udmVyc2F0aW9uID0+IHtcclxuICAgICAgICAgICAgICBpZiAoY29udmVyc2F0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmV2ZW50QnVzLmVtaXQoJ2NvbnZlcnNhdGlvbjp1cGRhdGVkJywge1xyXG4gICAgICAgICAgICAgICAgICBwcmV2aW91c0NvbnZlcnNhdGlvbjogY29udmVyc2F0aW9uLCAvLyBUaGlzIGlzbid0IGFjY3VyYXRlIGJ1dCB3ZSBkb24ndCBoYXZlIHRoZSBwcmV2aW91cyBzdGF0ZVxyXG4gICAgICAgICAgICAgICAgICBjdXJyZW50Q29udmVyc2F0aW9uOiBjb252ZXJzYXRpb25cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgLmNhdGNoKGVycm9yID0+IHtcclxuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBFcnJvciBsb2FkaW5nIGNvbnZlcnNhdGlvbiBhZnRlciBtb2RpZmljYXRpb246ICR7ZXJyb3J9YCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfSlcclxuICAgICk7XHJcbiAgICBcclxuICAgIC8vIFJlZ2lzdGVyIGZvciBmaWxlIGRlbGV0aW9uIGV2ZW50c1xyXG4gICAgdGhpcy5wbHVnaW4ucmVnaXN0ZXJFdmVudChcclxuICAgICAgdGhpcy5hcHAudmF1bHQub24oJ2RlbGV0ZScsIChmaWxlOiBURmlsZSkgPT4ge1xyXG4gICAgICAgIGlmICh0aGlzLmlzQ29udmVyc2F0aW9uRmlsZShmaWxlKSkge1xyXG4gICAgICAgICAgLy8gQSBjb252ZXJzYXRpb24gZmlsZSB3YXMgZGVsZXRlZFxyXG4gICAgICAgICAgdGhpcy5ldmVudEJ1cy5lbWl0KCdjb252ZXJzYXRpb246ZGVsZXRlZCcsIGZpbGUuYmFzZW5hbWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSlcclxuICAgICk7XHJcbiAgICBcclxuICAgIC8vIFJlZ2lzdGVyIGZvciBmaWxlIHJlbmFtZSBldmVudHNcclxuICAgIHRoaXMucGx1Z2luLnJlZ2lzdGVyRXZlbnQoXHJcbiAgICAgIHRoaXMuYXBwLnZhdWx0Lm9uKCdyZW5hbWUnLCAoZmlsZTogVEZpbGUsIG9sZFBhdGg6IHN0cmluZykgPT4ge1xyXG4gICAgICAgIGlmICh0aGlzLmlzQ29udmVyc2F0aW9uRmlsZShmaWxlKSkge1xyXG4gICAgICAgICAgLy8gQSBjb252ZXJzYXRpb24gZmlsZSB3YXMgcmVuYW1lZFxyXG4gICAgICAgICAgY29uc3Qgb2xkQmFzZW5hbWUgPSBvbGRQYXRoLnNwbGl0KCcvJykucG9wKCk/LnJlcGxhY2UoJy5qc29uJywgJycpO1xyXG4gICAgICAgICAgaWYgKG9sZEJhc2VuYW1lKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZXZlbnRCdXMuZW1pdCgnY29udmVyc2F0aW9uOnJlbmFtZWQnLCB7XHJcbiAgICAgICAgICAgICAgb2xkSWQ6IG9sZEJhc2VuYW1lLFxyXG4gICAgICAgICAgICAgIG5ld0lkOiBmaWxlLmJhc2VuYW1lXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfSlcclxuICAgICk7XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIENoZWNrIGlmIGEgZmlsZSBpcyBhIGNvbnZlcnNhdGlvbiBmaWxlLlxyXG4gICAqIEBwYXJhbSBmaWxlIEZpbGUgdG8gY2hlY2tcclxuICAgKiBAcmV0dXJucyBUcnVlIGlmIHRoZSBmaWxlIGlzIGEgY29udmVyc2F0aW9uIGZpbGVcclxuICAgKi9cclxuICBwcml2YXRlIGlzQ29udmVyc2F0aW9uRmlsZShmaWxlOiBURmlsZSk6IGJvb2xlYW4ge1xyXG4gICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkgcmV0dXJuIGZhbHNlO1xyXG4gICAgaWYgKGZpbGUuZXh0ZW5zaW9uICE9PSAnanNvbicpIHJldHVybiBmYWxzZTtcclxuICAgIFxyXG4gICAgY29uc3QgY29udmVyc2F0aW9uc1BhdGggPSB0aGlzLnNldHRpbmdzLmdldENvbnZlcnNhdGlvbnNQYXRoKCk7XHJcbiAgICByZXR1cm4gZmlsZS5wYXRoLnN0YXJ0c1dpdGgoY29udmVyc2F0aW9uc1BhdGgpO1xyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBIYW5kbGUgY29udmVyc2F0aW9ucyBmb2xkZXIgY2hhbmdlLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlQ29udmVyc2F0aW9uc0ZvbGRlckNoYW5nZWQoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICAvLyBFbnN1cmUgdGhlIG5ldyBmb2xkZXIgZXhpc3RzXHJcbiAgICBhd2FpdCB0aGlzLmVuc3VyZUNvbnZlcnNhdGlvbnNGb2xkZXIoKTtcclxuICAgIFxyXG4gICAgLy8gTm90aWZ5IGxpc3RlbmVycyB0aGF0IHN0b3JhZ2UgaGFzIGJlZW4gcmVsb2FkZWRcclxuICAgIHRoaXMuZXZlbnRCdXMuZW1pdCgnc3RvcmFnZTpyZWxvYWRlZCcsIHVuZGVmaW5lZCk7XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIEVuc3VyZSB0aGUgY29udmVyc2F0aW9ucyBmb2xkZXIgZXhpc3RzLlxyXG4gICAqIEByZXR1cm5zIFByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIHRoZSBmb2xkZXIgZXhpc3RzXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBhc3luYyBlbnN1cmVDb252ZXJzYXRpb25zRm9sZGVyKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgcGF0aCA9IHRoaXMuc2V0dGluZ3MuZ2V0Q29udmVyc2F0aW9uc1BhdGgoKTtcclxuICAgIFxyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgZm9sZGVyID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHBhdGgpO1xyXG4gICAgICBcclxuICAgICAgaWYgKCFmb2xkZXIpIHtcclxuICAgICAgICAvLyBDcmVhdGUgZm9sZGVyIGlmIGl0IGRvZXNuJ3QgZXhpc3RcclxuICAgICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5jcmVhdGVGb2xkZXIocGF0aCk7XHJcbiAgICAgIH0gZWxzZSBpZiAoIShmb2xkZXIgaW5zdGFuY2VvZiBURm9sZGVyKSkge1xyXG4gICAgICAgIHRocm93IG5ldyBGb2xkZXJPcGVyYXRpb25FcnJvcihwYXRoLCBgJHtwYXRofSBleGlzdHMgYnV0IGlzIG5vdCBhIGZvbGRlcmApO1xyXG4gICAgICB9XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gY3JlYXRlIGNvbnZlcnNhdGlvbnMgZm9sZGVyOiAke2Vycm9yfWApO1xyXG4gICAgICB0aHJvdyBuZXcgRm9sZGVyT3BlcmF0aW9uRXJyb3IocGF0aCwgZXJyb3IubWVzc2FnZSk7XHJcbiAgICB9XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIEdldCBhbGwgY29udmVyc2F0aW9ucy5cclxuICAgKiBAcmV0dXJucyBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2l0aCBhbiBhcnJheSBvZiBjb252ZXJzYXRpb25zXHJcbiAgICovXHJcbiAgcHVibGljIGFzeW5jIGdldENvbnZlcnNhdGlvbnMoKTogUHJvbWlzZTxDb252ZXJzYXRpb25bXT4ge1xyXG4gICAgY29uc3QgcGF0aCA9IHRoaXMuc2V0dGluZ3MuZ2V0Q29udmVyc2F0aW9uc1BhdGgoKTtcclxuICAgIGNvbnN0IGZvbGRlciA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChwYXRoKTtcclxuICAgIFxyXG4gICAgaWYgKCEoZm9sZGVyIGluc3RhbmNlb2YgVEZvbGRlcikpIHtcclxuICAgICAgcmV0dXJuIFtdO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBjb25zdCBjb252ZXJzYXRpb25zOiBDb252ZXJzYXRpb25bXSA9IFtdO1xyXG4gICAgXHJcbiAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZm9sZGVyLmNoaWxkcmVuKSB7XHJcbiAgICAgIGlmIChmaWxlIGluc3RhbmNlb2YgVEZpbGUgJiYgZmlsZS5leHRlbnNpb24gPT09ICdqc29uJykge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBjb25zdCBjb252ZXJzYXRpb24gPSBhd2FpdCB0aGlzLmxvYWRDb252ZXJzYXRpb24oZmlsZS5iYXNlbmFtZSk7XHJcbiAgICAgICAgICBpZiAoY29udmVyc2F0aW9uKSB7XHJcbiAgICAgICAgICAgIGNvbnZlcnNhdGlvbnMucHVzaChjb252ZXJzYXRpb24pO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGBFcnJvciBsb2FkaW5nIGNvbnZlcnNhdGlvbiAke2ZpbGUuYmFzZW5hbWV9OiAke2Vycm9yfWApO1xyXG4gICAgICAgICAgLy8gQ29udGludWUgd2l0aCBvdGhlciBjb252ZXJzYXRpb25zXHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIFNvcnQgYnkgbW9kaWZpY2F0aW9uIGRhdGUgKG5ld2VzdCBmaXJzdClcclxuICAgIHJldHVybiBjb252ZXJzYXRpb25zLnNvcnQoKGEsIGIpID0+IGIubW9kaWZpZWRBdCAtIGEubW9kaWZpZWRBdCk7XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIEdldCBhIGNvbnZlcnNhdGlvbiBieSBJRC5cclxuICAgKiBAcGFyYW0gaWQgQ29udmVyc2F0aW9uIElEXHJcbiAgICogQHJldHVybnMgUHJvbWlzZSB0aGF0IHJlc29sdmVzIHdpdGggdGhlIGNvbnZlcnNhdGlvbiBvciBudWxsIGlmIG5vdCBmb3VuZFxyXG4gICAqL1xyXG4gIHB1YmxpYyBhc3luYyBnZXRDb252ZXJzYXRpb24oaWQ6IHN0cmluZyk6IFByb21pc2U8Q29udmVyc2F0aW9uIHwgbnVsbD4ge1xyXG4gICAgcmV0dXJuIHRoaXMubG9hZENvbnZlcnNhdGlvbihpZCk7XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIExvYWQgYSBjb252ZXJzYXRpb24gZnJvbSBkaXNrLlxyXG4gICAqIEBwYXJhbSBpZCBDb252ZXJzYXRpb24gSURcclxuICAgKiBAcmV0dXJucyBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2l0aCB0aGUgY29udmVyc2F0aW9uIG9yIG51bGwgaWYgbm90IGZvdW5kXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBhc3luYyBsb2FkQ29udmVyc2F0aW9uKGlkOiBzdHJpbmcpOiBQcm9taXNlPENvbnZlcnNhdGlvbiB8IG51bGw+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IHBhdGggPSBgJHt0aGlzLnNldHRpbmdzLmdldENvbnZlcnNhdGlvbnNQYXRoKCl9LyR7aWR9Lmpzb25gO1xyXG4gICAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHBhdGgpO1xyXG4gICAgICBcclxuICAgICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkge1xyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcclxuICAgICAgXHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgY29udmVyc2F0aW9uID0gSlNPTi5wYXJzZShjb250ZW50KSBhcyBDb252ZXJzYXRpb247XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gQWRkIGZpbGUgcmVmZXJlbmNlXHJcbiAgICAgICAgY29udmVyc2F0aW9uLmZpbGUgPSBmaWxlO1xyXG4gICAgICAgIGNvbnZlcnNhdGlvbi5wYXRoID0gZmlsZS5wYXRoO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBjb252ZXJzYXRpb247XHJcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEpzb25QYXJzZUVycm9yKGVycm9yLm1lc3NhZ2UpO1xyXG4gICAgICB9XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBKc29uUGFyc2VFcnJvcikge1xyXG4gICAgICAgIHRocm93IGVycm9yO1xyXG4gICAgICB9XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoYEZhaWxlZCB0byBsb2FkIGNvbnZlcnNhdGlvbiAke2lkfTogJHtlcnJvcn1gKTtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIFNhdmUgYSBjb252ZXJzYXRpb24uXHJcbiAgICogQHBhcmFtIGNvbnZlcnNhdGlvbiBDb252ZXJzYXRpb24gdG8gc2F2ZVxyXG4gICAqIEByZXR1cm5zIFByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIHRoZSBjb252ZXJzYXRpb24gaXMgc2F2ZWRcclxuICAgKi9cclxuICBwdWJsaWMgYXN5bmMgc2F2ZUNvbnZlcnNhdGlvbihjb252ZXJzYXRpb246IENvbnZlcnNhdGlvbik6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgLy8gVXBkYXRlIG1vZGlmaWNhdGlvbiB0aW1lXHJcbiAgICAgIGNvbnZlcnNhdGlvbi5tb2RpZmllZEF0ID0gRGF0ZS5ub3coKTtcclxuICAgICAgXHJcbiAgICAgIC8vIFBhdGggdG8gZmlsZVxyXG4gICAgICBjb25zdCBwYXRoID0gYCR7dGhpcy5zZXR0aW5ncy5nZXRDb252ZXJzYXRpb25zUGF0aCgpfS8ke2NvbnZlcnNhdGlvbi5pZH0uanNvbmA7XHJcbiAgICAgIFxyXG4gICAgICAvLyBDcmVhdGUgYSBjb3B5IHdpdGhvdXQgZmlsZSByZWZlcmVuY2UgZm9yIHNlcmlhbGl6YXRpb25cclxuICAgICAgY29uc3QgY29udmVyc2F0aW9uVG9TYXZlID0geyAuLi5jb252ZXJzYXRpb24gfTtcclxuICAgICAgZGVsZXRlIGNvbnZlcnNhdGlvblRvU2F2ZS5maWxlO1xyXG4gICAgICBkZWxldGUgY29udmVyc2F0aW9uVG9TYXZlLnBhdGg7XHJcbiAgICAgIFxyXG4gICAgICAvLyBDb252ZXJ0IHRvIEpTT05cclxuICAgICAgY29uc3QgY29udGVudCA9IEpTT04uc3RyaW5naWZ5KGNvbnZlcnNhdGlvblRvU2F2ZSwgbnVsbCwgMik7XHJcbiAgICAgIFxyXG4gICAgICAvLyBDaGVjayBpZiBmaWxlIGV4aXN0c1xyXG4gICAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHBhdGgpO1xyXG4gICAgICBcclxuICAgICAgaWYgKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkge1xyXG4gICAgICAgIC8vIFVwZGF0ZSBleGlzdGluZyBmaWxlXHJcbiAgICAgICAgYXdhaXQgdGhpcy5hcHAudmF1bHQubW9kaWZ5KGZpbGUsIGNvbnRlbnQpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIENyZWF0ZSBuZXcgZmlsZVxyXG4gICAgICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNyZWF0ZShwYXRoLCBjb250ZW50KTtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgLy8gV2UgZG9uJ3QgbmVlZCB0byBlbWl0IGFuIGV2ZW50IGhlcmUgYXMgdGhlIHZhdWx0IGV2ZW50cyB3aWxsIGhhbmRsZSB0aGF0XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gc2F2ZSBjb252ZXJzYXRpb24gJHtjb252ZXJzYXRpb24uaWR9OiAke2Vycm9yfWApO1xyXG4gICAgICB0aHJvdyBuZXcgRmlsZU9wZXJhdGlvbkVycm9yKGAke3RoaXMuc2V0dGluZ3MuZ2V0Q29udmVyc2F0aW9uc1BhdGgoKX0vJHtjb252ZXJzYXRpb24uaWR9Lmpzb25gLCBlcnJvci5tZXNzYWdlKTtcclxuICAgIH1cclxuICB9XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgbmV3IGNvbnZlcnNhdGlvbi5cclxuICAgKiBAcGFyYW0gdGl0bGUgT3B0aW9uYWwgdGl0bGUgZm9yIHRoZSBjb252ZXJzYXRpb25cclxuICAgKiBAcmV0dXJucyBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2l0aCB0aGUgbmV3IGNvbnZlcnNhdGlvblxyXG4gICAqL1xyXG4gIHB1YmxpYyBhc3luYyBjcmVhdGVDb252ZXJzYXRpb24odGl0bGU/OiBzdHJpbmcpOiBQcm9taXNlPENvbnZlcnNhdGlvbj4ge1xyXG4gICAgY29uc3QgY29udmVyc2F0aW9uID0gQ29udmVyc2F0aW9uVXRpbHMuY3JlYXRlTmV3KHRpdGxlKTtcclxuICAgIFxyXG4gICAgYXdhaXQgdGhpcy5zYXZlQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbik7XHJcbiAgICBcclxuICAgIC8vIFZhdWx0ICdjcmVhdGUnIGV2ZW50IHdpbGwgdHJpZ2dlciB0aGUgJ2NvbnZlcnNhdGlvbjpjcmVhdGVkJyBldmVudFxyXG4gICAgcmV0dXJuIGNvbnZlcnNhdGlvbjtcclxuICB9XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogRGVsZXRlIGEgY29udmVyc2F0aW9uLlxyXG4gICAqIEBwYXJhbSBpZCBDb252ZXJzYXRpb24gSURcclxuICAgKiBAcmV0dXJucyBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiB0aGUgY29udmVyc2F0aW9uIGlzIGRlbGV0ZWRcclxuICAgKi9cclxuICBwdWJsaWMgYXN5bmMgZGVsZXRlQ29udmVyc2F0aW9uKGlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IHBhdGggPSBgJHt0aGlzLnNldHRpbmdzLmdldENvbnZlcnNhdGlvbnNQYXRoKCl9LyR7aWR9Lmpzb25gO1xyXG4gICAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHBhdGgpO1xyXG4gICAgICBcclxuICAgICAgaWYgKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkge1xyXG4gICAgICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0LmRlbGV0ZShmaWxlKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB0aHJvdyBuZXcgQ29udmVyc2F0aW9uTm90Rm91bmRFcnJvcihpZCk7XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIC8vIFZhdWx0ICdkZWxldGUnIGV2ZW50IHdpbGwgdHJpZ2dlciB0aGUgJ2NvbnZlcnNhdGlvbjpkZWxldGVkJyBldmVudFxyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgQ29udmVyc2F0aW9uTm90Rm91bmRFcnJvcikge1xyXG4gICAgICAgIHRocm93IGVycm9yO1xyXG4gICAgICB9XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoYEZhaWxlZCB0byBkZWxldGUgY29udmVyc2F0aW9uICR7aWR9OiAke2Vycm9yfWApO1xyXG4gICAgICB0aHJvdyBuZXcgRmlsZU9wZXJhdGlvbkVycm9yKGAke3RoaXMuc2V0dGluZ3MuZ2V0Q29udmVyc2F0aW9uc1BhdGgoKX0vJHtpZH0uanNvbmAsIGVycm9yLm1lc3NhZ2UpO1xyXG4gICAgfVxyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBBZGQgYSBtZXNzYWdlIHRvIGEgY29udmVyc2F0aW9uLlxyXG4gICAqIEBwYXJhbSBjb252ZXJzYXRpb25JZCBDb252ZXJzYXRpb24gSURcclxuICAgKiBAcGFyYW0gbWVzc2FnZSBNZXNzYWdlIHRvIGFkZFxyXG4gICAqIEByZXR1cm5zIFByb21pc2UgdGhhdCByZXNvbHZlcyB3aXRoIHRoZSB1cGRhdGVkIGNvbnZlcnNhdGlvblxyXG4gICAqL1xyXG4gIHB1YmxpYyBhc3luYyBhZGRNZXNzYWdlKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsIG1lc3NhZ2U6IE1lc3NhZ2UpOiBQcm9taXNlPENvbnZlcnNhdGlvbj4ge1xyXG4gICAgLy8gR2V0IGNvbnZlcnNhdGlvblxyXG4gICAgY29uc3QgY29udmVyc2F0aW9uID0gYXdhaXQgdGhpcy5nZXRDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQpO1xyXG4gICAgXHJcbiAgICBpZiAoIWNvbnZlcnNhdGlvbikge1xyXG4gICAgICB0aHJvdyBuZXcgQ29udmVyc2F0aW9uTm90Rm91bmRFcnJvcihjb252ZXJzYXRpb25JZCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIEFkZCBtZXNzYWdlXHJcbiAgICBjb25zdCB1cGRhdGVkQ29udmVyc2F0aW9uID0gQ29udmVyc2F0aW9uVXRpbHMuYWRkTWVzc2FnZShjb252ZXJzYXRpb24sIG1lc3NhZ2UpO1xyXG4gICAgXHJcbiAgICAvLyBTYXZlIGNvbnZlcnNhdGlvblxyXG4gICAgYXdhaXQgdGhpcy5zYXZlQ29udmVyc2F0aW9uKHVwZGF0ZWRDb252ZXJzYXRpb24pO1xyXG4gICAgXHJcbiAgICAvLyBFbWl0IGEgc3BlY2lmaWMgbWVzc2FnZSBldmVudFxyXG4gICAgdGhpcy5ldmVudEJ1cy5lbWl0KCdtZXNzYWdlOmFkZGVkJywge1xyXG4gICAgICBjb252ZXJzYXRpb25JZCxcclxuICAgICAgbWVzc2FnZVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIHJldHVybiB1cGRhdGVkQ29udmVyc2F0aW9uO1xyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBVcGRhdGUgYSBtZXNzYWdlIGluIGEgY29udmVyc2F0aW9uLlxyXG4gICAqIEBwYXJhbSBjb252ZXJzYXRpb25JZCBDb252ZXJzYXRpb24gSURcclxuICAgKiBAcGFyYW0gbWVzc2FnZUlkIE1lc3NhZ2UgSURcclxuICAgKiBAcGFyYW0gdXBkYXRlZENvbnRlbnQgVXBkYXRlZCBtZXNzYWdlIGNvbnRlbnRcclxuICAgKiBAcmV0dXJucyBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2l0aCB0aGUgdXBkYXRlZCBjb252ZXJzYXRpb25cclxuICAgKi9cclxuICBwdWJsaWMgYXN5bmMgdXBkYXRlTWVzc2FnZShcclxuICAgIGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsXHJcbiAgICBtZXNzYWdlSWQ6IHN0cmluZyxcclxuICAgIHVwZGF0ZWRDb250ZW50OiBzdHJpbmdcclxuICApOiBQcm9taXNlPENvbnZlcnNhdGlvbj4ge1xyXG4gICAgLy8gR2V0IGNvbnZlcnNhdGlvblxyXG4gICAgY29uc3QgY29udmVyc2F0aW9uID0gYXdhaXQgdGhpcy5nZXRDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQpO1xyXG4gICAgXHJcbiAgICBpZiAoIWNvbnZlcnNhdGlvbikge1xyXG4gICAgICB0aHJvdyBuZXcgQ29udmVyc2F0aW9uTm90Rm91bmRFcnJvcihjb252ZXJzYXRpb25JZCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIEZpbmQgbWVzc2FnZVxyXG4gICAgY29uc3QgbWVzc2FnZUluZGV4ID0gY29udmVyc2F0aW9uLm1lc3NhZ2VzLmZpbmRJbmRleChtID0+IG0uaWQgPT09IG1lc3NhZ2VJZCk7XHJcbiAgICBcclxuICAgIGlmIChtZXNzYWdlSW5kZXggPT09IC0xKSB7XHJcbiAgICAgIHRocm93IG5ldyBNZXNzYWdlTm90Rm91bmRFcnJvcihjb252ZXJzYXRpb25JZCwgbWVzc2FnZUlkKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8gU3RvcmUgcHJldmlvdXMgY29udGVudCBmb3IgZXZlbnRcclxuICAgIGNvbnN0IHByZXZpb3VzQ29udGVudCA9IGNvbnZlcnNhdGlvbi5tZXNzYWdlc1ttZXNzYWdlSW5kZXhdLmNvbnRlbnQ7XHJcbiAgICBcclxuICAgIC8vIENyZWF0ZSBhIG5ldyBjb252ZXJzYXRpb24gb2JqZWN0IHdpdGggdGhlIHVwZGF0ZWQgbWVzc2FnZVxyXG4gICAgY29uc3QgdXBkYXRlZENvbnZlcnNhdGlvbiA9IHtcclxuICAgICAgLi4uY29udmVyc2F0aW9uLFxyXG4gICAgICBtZXNzYWdlczogWy4uLmNvbnZlcnNhdGlvbi5tZXNzYWdlc10sXHJcbiAgICAgIG1vZGlmaWVkQXQ6IERhdGUubm93KClcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8vIFVwZGF0ZSB0aGUgbWVzc2FnZVxyXG4gICAgdXBkYXRlZENvbnZlcnNhdGlvbi5tZXNzYWdlc1ttZXNzYWdlSW5kZXhdID0ge1xyXG4gICAgICAuLi51cGRhdGVkQ29udmVyc2F0aW9uLm1lc3NhZ2VzW21lc3NhZ2VJbmRleF0sXHJcbiAgICAgIGNvbnRlbnQ6IHVwZGF0ZWRDb250ZW50XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICAvLyBTYXZlIGNvbnZlcnNhdGlvblxyXG4gICAgYXdhaXQgdGhpcy5zYXZlQ29udmVyc2F0aW9uKHVwZGF0ZWRDb252ZXJzYXRpb24pO1xyXG4gICAgXHJcbiAgICAvLyBFbWl0IGEgc3BlY2lmaWMgbWVzc2FnZSBldmVudFxyXG4gICAgdGhpcy5ldmVudEJ1cy5lbWl0KCdtZXNzYWdlOnVwZGF0ZWQnLCB7XHJcbiAgICAgIGNvbnZlcnNhdGlvbklkLFxyXG4gICAgICBtZXNzYWdlSWQsXHJcbiAgICAgIHByZXZpb3VzQ29udGVudCxcclxuICAgICAgY3VycmVudENvbnRlbnQ6IHVwZGF0ZWRDb250ZW50XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgcmV0dXJuIHVwZGF0ZWRDb252ZXJzYXRpb247XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIFJlbmFtZSBhIGNvbnZlcnNhdGlvbi5cclxuICAgKiBVc2VzIEZpbGVNYW5hZ2VyIHRvIGVuc3VyZSBsaW5rcyBhcmUgdXBkYXRlZC5cclxuICAgKiBAcGFyYW0gY29udmVyc2F0aW9uSWQgQ29udmVyc2F0aW9uIElEXHJcbiAgICogQHBhcmFtIG5ld1RpdGxlIE5ldyBjb252ZXJzYXRpb24gdGl0bGVcclxuICAgKiBAcmV0dXJucyBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2l0aCB0aGUgdXBkYXRlZCBjb252ZXJzYXRpb25cclxuICAgKi9cclxuICBwdWJsaWMgYXN5bmMgcmVuYW1lQ29udmVyc2F0aW9uKFxyXG4gICAgY29udmVyc2F0aW9uSWQ6IHN0cmluZyxcclxuICAgIG5ld1RpdGxlOiBzdHJpbmdcclxuICApOiBQcm9taXNlPENvbnZlcnNhdGlvbj4ge1xyXG4gICAgLy8gR2V0IGNvbnZlcnNhdGlvblxyXG4gICAgY29uc3QgY29udmVyc2F0aW9uID0gYXdhaXQgdGhpcy5nZXRDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQpO1xyXG4gICAgXHJcbiAgICBpZiAoIWNvbnZlcnNhdGlvbikge1xyXG4gICAgICB0aHJvdyBuZXcgQ29udmVyc2F0aW9uTm90Rm91bmRFcnJvcihjb252ZXJzYXRpb25JZCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIENyZWF0ZSBhIG5ldyBjb252ZXJzYXRpb24gb2JqZWN0IHdpdGggdGhlIHVwZGF0ZWQgdGl0bGVcclxuICAgIGNvbnN0IHVwZGF0ZWRDb252ZXJzYXRpb24gPSB7XHJcbiAgICAgIC4uLmNvbnZlcnNhdGlvbixcclxuICAgICAgdGl0bGU6IG5ld1RpdGxlLFxyXG4gICAgICBtb2RpZmllZEF0OiBEYXRlLm5vdygpXHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICAvLyBTYXZlIGNvbnZlcnNhdGlvblxyXG4gICAgYXdhaXQgdGhpcy5zYXZlQ29udmVyc2F0aW9uKHVwZGF0ZWRDb252ZXJzYXRpb24pO1xyXG4gICAgXHJcbiAgICByZXR1cm4gdXBkYXRlZENvbnZlcnNhdGlvbjtcclxuICB9XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogRXhwb3J0IGEgY29udmVyc2F0aW9uIHRvIE1hcmtkb3duLlxyXG4gICAqIEBwYXJhbSBjb252ZXJzYXRpb25JZCBDb252ZXJzYXRpb24gSURcclxuICAgKiBAcmV0dXJucyBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiB0aGUgZXhwb3J0IGlzIGNvbXBsZXRlXHJcbiAgICovXHJcbiAgcHVibGljIGFzeW5jIGV4cG9ydFRvTWFya2Rvd24oY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgY29udmVyc2F0aW9uID0gYXdhaXQgdGhpcy5nZXRDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQpO1xyXG4gICAgICBcclxuICAgICAgaWYgKCFjb252ZXJzYXRpb24pIHtcclxuICAgICAgICB0aHJvdyBuZXcgQ29udmVyc2F0aW9uTm90Rm91bmRFcnJvcihjb252ZXJzYXRpb25JZCk7XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIGF3YWl0IFN0b3JhZ2VVdGlscy5leHBvcnRDb252ZXJzYXRpb24odGhpcy5hcHAsIGNvbnZlcnNhdGlvbiwgJ21hcmtkb3duJyk7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBDb252ZXJzYXRpb25Ob3RGb3VuZEVycm9yKSB7XHJcbiAgICAgICAgdGhyb3cgZXJyb3I7XHJcbiAgICAgIH1cclxuICAgICAgY29uc29sZS5lcnJvcihgRmFpbGVkIHRvIGV4cG9ydCBjb252ZXJzYXRpb24gJHtjb252ZXJzYXRpb25JZH06ICR7ZXJyb3J9YCk7XHJcbiAgICAgIHRocm93IGVycm9yO1xyXG4gICAgfVxyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBFeHBvcnQgYSBjb252ZXJzYXRpb24gdG8gSlNPTi5cclxuICAgKiBAcGFyYW0gY29udmVyc2F0aW9uSWQgQ29udmVyc2F0aW9uIElEXHJcbiAgICogQHJldHVybnMgUHJvbWlzZSB0aGF0IHJlc29sdmVzIHdoZW4gdGhlIGV4cG9ydCBpcyBjb21wbGV0ZVxyXG4gICAqL1xyXG4gIHB1YmxpYyBhc3luYyBleHBvcnRUb0pzb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgY29udmVyc2F0aW9uID0gYXdhaXQgdGhpcy5nZXRDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQpO1xyXG4gICAgICBcclxuICAgICAgaWYgKCFjb252ZXJzYXRpb24pIHtcclxuICAgICAgICB0aHJvdyBuZXcgQ29udmVyc2F0aW9uTm90Rm91bmRFcnJvcihjb252ZXJzYXRpb25JZCk7XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIGF3YWl0IFN0b3JhZ2VVdGlscy5leHBvcnRDb252ZXJzYXRpb24odGhpcy5hcHAsIGNvbnZlcnNhdGlvbiwgJ2pzb24nKTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIENvbnZlcnNhdGlvbk5vdEZvdW5kRXJyb3IpIHtcclxuICAgICAgICB0aHJvdyBlcnJvcjtcclxuICAgICAgfVxyXG4gICAgICBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gZXhwb3J0IGNvbnZlcnNhdGlvbiAke2NvbnZlcnNhdGlvbklkfTogJHtlcnJvcn1gKTtcclxuICAgICAgdGhyb3cgZXJyb3I7XHJcbiAgICB9XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIEltcG9ydCBhIGNvbnZlcnNhdGlvbiBmcm9tIEpTT04uXHJcbiAgICogQHBhcmFtIGpzb24gQ29udmVyc2F0aW9uIEpTT05cclxuICAgKiBAcmV0dXJucyBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2l0aCB0aGUgaW1wb3J0ZWQgY29udmVyc2F0aW9uXHJcbiAgICovXHJcbiAgcHVibGljIGFzeW5jIGltcG9ydENvbnZlcnNhdGlvbihqc29uOiBzdHJpbmcpOiBQcm9taXNlPENvbnZlcnNhdGlvbj4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgaW1wb3J0ZWRDb252ZXJzYXRpb24gPSBTdG9yYWdlVXRpbHMucGFyc2VKc29uVG9Db252ZXJzYXRpb24oanNvbik7XHJcbiAgICAgIFxyXG4gICAgICAvLyBHZW5lcmF0ZSBhIG5ldyBJRCB0byBhdm9pZCBjb25mbGljdHNcclxuICAgICAgY29uc3Qgb3JpZ2luYWxJZCA9IGltcG9ydGVkQ29udmVyc2F0aW9uLmlkO1xyXG4gICAgICBpbXBvcnRlZENvbnZlcnNhdGlvbi5pZCA9IFN0b3JhZ2VVdGlscy5nZW5lcmF0ZUlkKCk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBVcGRhdGUgdGl0bGUgdG8gaW5kaWNhdGUgaXQncyBhbiBpbXBvcnRcclxuICAgICAgaWYgKCFpbXBvcnRlZENvbnZlcnNhdGlvbi50aXRsZS5pbmNsdWRlcygnKEltcG9ydCknKSkge1xyXG4gICAgICAgIGltcG9ydGVkQ29udmVyc2F0aW9uLnRpdGxlID0gYCR7aW1wb3J0ZWRDb252ZXJzYXRpb24udGl0bGV9IChJbXBvcnQpYDtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgLy8gU2F2ZSB0aGUgY29udmVyc2F0aW9uXHJcbiAgICAgIGF3YWl0IHRoaXMuc2F2ZUNvbnZlcnNhdGlvbihpbXBvcnRlZENvbnZlcnNhdGlvbik7XHJcbiAgICAgIFxyXG4gICAgICByZXR1cm4gaW1wb3J0ZWRDb252ZXJzYXRpb247XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gaW1wb3J0IGNvbnZlcnNhdGlvbjogJHtlcnJvcn1gKTtcclxuICAgICAgdGhyb3cgZXJyb3I7XHJcbiAgICB9XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIEltcG9ydCBhIGNvbnZlcnNhdGlvbiBmcm9tIE1hcmtkb3duLlxyXG4gICAqIEBwYXJhbSBtYXJrZG93biBNYXJrZG93biBjb250ZW50XHJcbiAgICogQHJldHVybnMgUHJvbWlzZSB0aGF0IHJlc29sdmVzIHdpdGggdGhlIGltcG9ydGVkIGNvbnZlcnNhdGlvblxyXG4gICAqL1xyXG4gIHB1YmxpYyBhc3luYyBpbXBvcnRGcm9tTWFya2Rvd24obWFya2Rvd246IHN0cmluZyk6IFByb21pc2U8Q29udmVyc2F0aW9uPiB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBpbXBvcnRlZENvbnZlcnNhdGlvbiA9IFN0b3JhZ2VVdGlscy5wYXJzZU1hcmtkb3duVG9Db252ZXJzYXRpb24obWFya2Rvd24pO1xyXG4gICAgICBcclxuICAgICAgLy8gU2F2ZSB0aGUgY29udmVyc2F0aW9uXHJcbiAgICAgIGF3YWl0IHRoaXMuc2F2ZUNvbnZlcnNhdGlvbihpbXBvcnRlZENvbnZlcnNhdGlvbik7XHJcbiAgICAgIFxyXG4gICAgICByZXR1cm4gaW1wb3J0ZWRDb252ZXJzYXRpb247XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gaW1wb3J0IGNvbnZlcnNhdGlvbiBmcm9tIE1hcmtkb3duOiAke2Vycm9yfWApO1xyXG4gICAgICB0aHJvdyBlcnJvcjtcclxuICAgIH1cclxuICB9XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgYmFja3VwIG9mIGEgY29udmVyc2F0aW9uLlxyXG4gICAqIEBwYXJhbSBjb252ZXJzYXRpb25JZCBDb252ZXJzYXRpb24gSURcclxuICAgKiBAcmV0dXJucyBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2l0aCB0aGUgcGF0aCB0byB0aGUgYmFja3VwIGZpbGVcclxuICAgKi9cclxuICBwdWJsaWMgYXN5bmMgYmFja3VwQ29udmVyc2F0aW9uKGNvbnZlcnNhdGlvbklkOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgY29udmVyc2F0aW9uID0gYXdhaXQgdGhpcy5nZXRDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQpO1xyXG4gICAgICBcclxuICAgICAgaWYgKCFjb252ZXJzYXRpb24pIHtcclxuICAgICAgICB0aHJvdyBuZXcgQ29udmVyc2F0aW9uTm90Rm91bmRFcnJvcihjb252ZXJzYXRpb25JZCk7XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIGNvbnN0IGJhY2t1cEZvbGRlciA9IGAke3RoaXMuc2V0dGluZ3MuZ2V0Q29udmVyc2F0aW9uc1BhdGgoKX0vYmFja3Vwc2A7XHJcbiAgICAgIFxyXG4gICAgICByZXR1cm4gYXdhaXQgU3RvcmFnZVV0aWxzLmJhY2t1cENvbnZlcnNhdGlvbih0aGlzLmFwcCwgY29udmVyc2F0aW9uLCBiYWNrdXBGb2xkZXIpO1xyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgQ29udmVyc2F0aW9uTm90Rm91bmRFcnJvcikge1xyXG4gICAgICAgIHRocm93IGVycm9yO1xyXG4gICAgICB9XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoYEZhaWxlZCB0byBiYWNrdXAgY29udmVyc2F0aW9uICR7Y29udmVyc2F0aW9uSWR9OiAke2Vycm9yfWApO1xyXG4gICAgICB0aHJvdyBlcnJvcjtcclxuICAgIH1cclxuICB9XHJcbn1cclxuIl19