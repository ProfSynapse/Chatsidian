/**
 * Storage service for plugin integration.
 *
 * This file provides a service class for initializing and managing the storage system,
 * integrating the StorageManager with the Obsidian plugin lifecycle.
 */
import { StorageManager } from '../core/StorageManager';
import { StorageError, ConversationNotFoundError, MessageNotFoundError, FolderOperationError, FileOperationError, JsonParseError, ImportExportError } from '../core/StorageErrors';
/**
 * Service class for initializing and managing the storage system.
 * Provides a bridge between the plugin and the storage management system.
 */
export class StorageService {
    /**
     * Create a new StorageService.
     * @param app Obsidian app instance
     * @param plugin Plugin instance
     * @param eventBus Event bus
     * @param settings Settings manager
     */
    constructor(app, plugin, eventBus, settings) {
        this.app = app;
        this.plugin = plugin;
        this.eventBus = eventBus;
        this.settings = settings;
    }
    /**
     * Initialize the storage service.
     * @returns Promise that resolves when initialization is complete
     */
    async initialize() {
        // Create storage manager
        this.storageManager = new StorageManager(this.app, this.plugin, this.settings, this.eventBus);
        // Initialize storage manager
        await this.storageManager.initialize();
        // Register for plugin lifecycle events
        this.registerEventListeners();
        // Emit storage initialized event
        this.eventBus.emit('storage:initialized', undefined);
    }
    /**
     * Register event listeners for the storage service.
     */
    registerEventListeners() {
        // Listen for plugin unload event
        this.plugin.registerEvent(this.eventBus.on('plugin:unloaded', () => {
            // Clean up any resources if needed
            console.log('Storage service shutting down');
        }));
    }
    /**
     * Get all conversations.
     * @returns Promise that resolves with an array of conversations
     */
    async getConversations() {
        try {
            return await this.storageManager.getConversations();
        }
        catch (error) {
            console.error('Error getting conversations:', error);
            this.handleStorageError(error);
            return [];
        }
    }
    /**
     * Get a conversation by ID.
     * @param id Conversation ID
     * @returns Promise that resolves with the conversation or null if not found
     */
    async getConversation(id) {
        try {
            return await this.storageManager.getConversation(id);
        }
        catch (error) {
            console.error(`Error getting conversation ${id}:`, error);
            this.handleStorageError(error);
            return null;
        }
    }
    /**
     * Create a new conversation.
     * @param title Optional title for the conversation
     * @returns Promise that resolves with the new conversation
     */
    async createConversation(title) {
        try {
            return await this.storageManager.createConversation(title);
        }
        catch (error) {
            console.error('Error creating conversation:', error);
            this.handleStorageError(error);
            throw error;
        }
    }
    /**
     * Save a conversation.
     * @param conversation Conversation to save
     * @returns Promise that resolves when the conversation is saved
     */
    async saveConversation(conversation) {
        try {
            await this.storageManager.saveConversation(conversation);
        }
        catch (error) {
            console.error(`Error saving conversation ${conversation.id}:`, error);
            this.handleStorageError(error);
            throw error;
        }
    }
    /**
     * Delete a conversation.
     * @param id Conversation ID
     * @returns Promise that resolves when the conversation is deleted
     */
    async deleteConversation(id) {
        try {
            await this.storageManager.deleteConversation(id);
        }
        catch (error) {
            console.error(`Error deleting conversation ${id}:`, error);
            this.handleStorageError(error);
            throw error;
        }
    }
    /**
     * Add a message to a conversation.
     * @param conversationId Conversation ID
     * @param message Message to add
     * @returns Promise that resolves with the updated conversation
     */
    async addMessage(conversationId, message) {
        try {
            return await this.storageManager.addMessage(conversationId, message);
        }
        catch (error) {
            console.error(`Error adding message to conversation ${conversationId}:`, error);
            this.handleStorageError(error);
            throw error;
        }
    }
    /**
     * Update a message in a conversation.
     * @param conversationId Conversation ID
     * @param messageId Message ID
     * @param updatedContent Updated message content
     * @returns Promise that resolves with the updated conversation
     */
    async updateMessage(conversationId, messageId, updatedContent) {
        try {
            return await this.storageManager.updateMessage(conversationId, messageId, updatedContent);
        }
        catch (error) {
            console.error(`Error updating message ${messageId} in conversation ${conversationId}:`, error);
            this.handleStorageError(error);
            throw error;
        }
    }
    /**
     * Rename a conversation.
     * @param conversationId Conversation ID
     * @param newTitle New conversation title
     * @returns Promise that resolves with the updated conversation
     */
    async renameConversation(conversationId, newTitle) {
        try {
            return await this.storageManager.renameConversation(conversationId, newTitle);
        }
        catch (error) {
            console.error(`Error renaming conversation ${conversationId}:`, error);
            this.handleStorageError(error);
            throw error;
        }
    }
    /**
     * Export a conversation to Markdown.
     * @param conversationId Conversation ID
     * @returns Promise that resolves when the export is complete
     */
    async exportToMarkdown(conversationId) {
        try {
            await this.storageManager.exportToMarkdown(conversationId);
        }
        catch (error) {
            console.error(`Error exporting conversation ${conversationId} to Markdown:`, error);
            this.handleStorageError(error);
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
            await this.storageManager.exportToJson(conversationId);
        }
        catch (error) {
            console.error(`Error exporting conversation ${conversationId} to JSON:`, error);
            this.handleStorageError(error);
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
            return await this.storageManager.importConversation(json);
        }
        catch (error) {
            console.error('Error importing conversation:', error);
            this.handleStorageError(error);
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
            return await this.storageManager.importFromMarkdown(markdown);
        }
        catch (error) {
            console.error('Error importing conversation from Markdown:', error);
            this.handleStorageError(error);
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
            return await this.storageManager.backupConversation(conversationId);
        }
        catch (error) {
            console.error(`Error backing up conversation ${conversationId}:`, error);
            this.handleStorageError(error);
            throw error;
        }
    }
    /**
     * Handle storage errors.
     * @param error Error to handle
     */
    handleStorageError(error) {
        // Emit error event
        this.eventBus.emit('storage:error', { error });
        // Handle specific error types
        if (error instanceof ConversationNotFoundError) {
            console.error(`Conversation not found: ${error.conversationId}`);
        }
        else if (error instanceof MessageNotFoundError) {
            console.error(`Message not found: ${error.messageId} in conversation ${error.conversationId}`);
        }
        else if (error instanceof FolderOperationError) {
            console.error(`Folder operation failed: ${error.path}`);
        }
        else if (error instanceof FileOperationError) {
            console.error(`File operation failed: ${error.path}`);
        }
        else if (error instanceof JsonParseError) {
            console.error(`JSON parse error: ${error.message}`);
        }
        else if (error instanceof ImportExportError) {
            console.error(`Import/export error: ${error.message}`);
        }
        else if (error instanceof StorageError) {
            console.error(`Storage error: ${error.message}`);
        }
        else {
            console.error(`Unknown storage error: ${error}`);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU3RvcmFnZVNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJTdG9yYWdlU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7R0FLRztBQU1ILE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUN4RCxPQUFPLEVBQ0wsWUFBWSxFQUNaLHlCQUF5QixFQUN6QixvQkFBb0IsRUFDcEIsb0JBQW9CLEVBQ3BCLGtCQUFrQixFQUNsQixjQUFjLEVBQ2QsaUJBQWlCLEVBQ2xCLE1BQU0sdUJBQXVCLENBQUM7QUFFL0I7OztHQUdHO0FBQ0gsTUFBTSxPQUFPLGNBQWM7SUFPekI7Ozs7OztPQU1HO0lBQ0gsWUFDRSxHQUFRLEVBQ1IsTUFBYyxFQUNkLFFBQWtCLEVBQ2xCLFFBQXlCO1FBRXpCLElBQUksQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO1FBQ2YsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFDckIsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7UUFDekIsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7SUFDM0IsQ0FBQztJQUVEOzs7T0FHRztJQUNJLEtBQUssQ0FBQyxVQUFVO1FBQ3JCLHlCQUF5QjtRQUN6QixJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksY0FBYyxDQUN0QyxJQUFJLENBQUMsR0FBRyxFQUNSLElBQUksQ0FBQyxNQUFNLEVBQ1gsSUFBSSxDQUFDLFFBQVEsRUFDYixJQUFJLENBQUMsUUFBUSxDQUNkLENBQUM7UUFFRiw2QkFBNkI7UUFDN0IsTUFBTSxJQUFJLENBQUMsY0FBYyxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBRXZDLHVDQUF1QztRQUN2QyxJQUFJLENBQUMsc0JBQXNCLEVBQUUsQ0FBQztRQUU5QixpQ0FBaUM7UUFDakMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMscUJBQXFCLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDdkQsQ0FBQztJ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Q0FBQyxLQUFLLENBQUMsc0JBQXNCLEtBQUssQ0FBQyxTQUFTLG9CQUFvQixLQUFLLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQztRQUNqRyxDQUFDO2FBQU0sSUFBSSxLQUFLLFlBQVksb0JBQW9CLEVBQUUsQ0FBQztZQUNqRCxPQUFPLENBQUMsS0FBSyxDQUFDLDRCQUE0QixLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUMxRCxDQUFDO2FBQU0sSUFBSSxLQUFLLFlBQVksa0JBQWtCLEVBQUUsQ0FBQztZQUMvQyxPQUFPLENBQUMsS0FBSyxDQUFDLDBCQUEwQixLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUN4RCxDQUFDO2FBQU0sSUFBSSxLQUFLLFlBQVksY0FBYyxFQUFFLENBQUM7WUFDM0MsT0FBTyxDQUFDLEtBQUssQ0FBQyxxQkFBcUIsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDdEQsQ0FBQzthQUFNLElBQUksS0FBSyxZQUFZLGlCQUFpQixFQUFFLENBQUM7WUFDOUMsT0FBTyxDQUFDLEtBQUssQ0FBQyx3QkFBd0IsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDekQsQ0FBQzthQUFNLElBQUksS0FBSyxZQUFZLFlBQVksRUFBRSxDQUFDO1lBQ3pDLE9BQU8sQ0FBQyxLQUFLLENBQUMsa0JBQWtCLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1FBQ25ELENBQUM7YUFBTSxDQUFDO1lBQ04sT0FBTyxDQUFDLEtBQUssQ0FBQywwQkFBMEIsS0FBSyxFQUFFLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0gsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIFN0b3JhZ2Ugc2VydmljZSBmb3IgcGx1Z2luIGludGVncmF0aW9uLlxyXG4gKiBcclxuICogVGhpcyBmaWxlIHByb3ZpZGVzIGEgc2VydmljZSBjbGFzcyBmb3IgaW5pdGlhbGl6aW5nIGFuZCBtYW5hZ2luZyB0aGUgc3RvcmFnZSBzeXN0ZW0sXHJcbiAqIGludGVncmF0aW5nIHRoZSBTdG9yYWdlTWFuYWdlciB3aXRoIHRoZSBPYnNpZGlhbiBwbHVnaW4gbGlmZWN5Y2xlLlxyXG4gKi9cclxuXHJcbmltcG9ydCB7IEFwcCwgUGx1Z2luIH0gZnJvbSAnLi4vdXRpbHMvb2JzaWRpYW4taW1wb3J0cyc7XHJcbmltcG9ydCB7IENvbnZlcnNhdGlvbiwgTWVzc2FnZSB9IGZyb20gJy4uL21vZGVscy9Db252ZXJzYXRpb24nO1xyXG5pbXBvcnQgeyBFdmVudEJ1cyB9IGZyb20gJy4uL2NvcmUvRXZlbnRCdXMnO1xyXG5pbXBvcnQgeyBTZXR0aW5nc01hbmFnZXIgfSBmcm9tICcuLi9jb3JlL1NldHRpbmdzTWFuYWdlcic7XHJcbmltcG9ydCB7IFN0b3JhZ2VNYW5hZ2VyIH0gZnJvbSAnLi4vY29yZS9TdG9yYWdlTWFuYWdlcic7XHJcbmltcG9ydCB7XHJcbiAgU3RvcmFnZUVycm9yLFxyXG4gIENvbnZlcnNhdGlvbk5vdEZvdW5kRXJyb3IsXHJcbiAgTWVzc2FnZU5vdEZvdW5kRXJyb3IsXHJcbiAgRm9sZGVyT3BlcmF0aW9uRXJyb3IsXHJcbiAgRmlsZU9wZXJhdGlvbkVycm9yLFxyXG4gIEpzb25QYXJzZUVycm9yLFxyXG4gIEltcG9ydEV4cG9ydEVycm9yXHJcbn0gZnJvbSAnLi4vY29yZS9TdG9yYWdlRXJyb3JzJztcclxuXHJcbi8qKlxyXG4gKiBTZXJ2aWNlIGNsYXNzIGZvciBpbml0aWFsaXppbmcgYW5kIG1hbmFnaW5nIHRoZSBzdG9yYWdlIHN5c3RlbS5cclxuICogUHJvdmlkZXMgYSBicmlkZ2UgYmV0d2VlbiB0aGUgcGx1Z2luIGFuZCB0aGUgc3RvcmFnZSBtYW5hZ2VtZW50IHN5c3RlbS5cclxuICovXHJcbmV4cG9ydCBjbGFzcyBTdG9yYWdlU2VydmljZSB7XHJcbiAgcHJpdmF0ZSBhcHA6IEFwcDtcclxuICBwcml2YXRlIHBsdWdpbjogUGx1Z2luO1xyXG4gIHByaXZhdGUgZXZlbnRCdXM6IEV2ZW50QnVzO1xyXG4gIHByaXZhdGUgc2V0dGluZ3M6IFNldHRpbmdzTWFuYWdlcjtcclxuICBwcml2YXRlIHN0b3JhZ2VNYW5hZ2VyOiBTdG9yYWdlTWFuYWdlcjtcclxuICBcclxuICAvKipcclxuICAgKiBDcmVhdGUgYSBuZXcgU3RvcmFnZVNlcnZpY2UuXHJcbiAgICogQHBhcmFtIGFwcCBPYnNpZGlhbiBhcHAgaW5zdGFuY2VcclxuICAgKiBAcGFyYW0gcGx1Z2luIFBsdWdpbiBpbnN0YW5jZVxyXG4gICAqIEBwYXJhbSBldmVudEJ1cyBFdmVudCBidXNcclxuICAgKiBAcGFyYW0gc2V0dGluZ3MgU2V0dGluZ3MgbWFuYWdlclxyXG4gICAqL1xyXG4gIGNvbnN0cnVjdG9yKFxyXG4gICAgYXBwOiBBcHAsXHJcbiAgICBwbHVnaW46IFBsdWdpbixcclxuICAgIGV2ZW50QnVzOiBFdmVudEJ1cyxcclxuICAgIHNldHRpbmdzOiBTZXR0aW5nc01hbmFnZXJcclxuICApIHtcclxuICAgIHRoaXMuYXBwID0gYXBwO1xyXG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XHJcbiAgICB0aGlzLmV2ZW50QnVzID0gZXZlbnRCdXM7XHJcbiAgICB0aGlzLnNldHRpbmdzID0gc2V0dGluZ3M7XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIEluaXRpYWxpemUgdGhlIHN0b3JhZ2Ugc2VydmljZS5cclxuICAgKiBAcmV0dXJucyBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiBpbml0aWFsaXphdGlvbiBpcyBjb21wbGV0ZVxyXG4gICAqL1xyXG4gIHB1YmxpYyBhc3luYyBpbml0aWFsaXplKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgLy8gQ3JlYXRlIHN0b3JhZ2UgbWFuYWdlclxyXG4gICAgdGhpcy5zdG9yYWdlTWFuYWdlciA9IG5ldyBTdG9yYWdlTWFuYWdlcihcclxuICAgICAgdGhpcy5hcHAsXHJcbiAgICAgIHRoaXMucGx1Z2luLFxyXG4gICAgICB0aGlzLnNldHRpbmdzLFxyXG4gICAgICB0aGlzLmV2ZW50QnVzXHJcbiAgICApO1xyXG4gICAgXHJcbiAgICAvLyBJbml0aWFsaXplIHN0b3JhZ2UgbWFuYWdlclxyXG4gICAgYXdhaXQgdGhpcy5zdG9yYWdlTWFuYWdlci5pbml0aWFsaXplKCk7XHJcbiAgICBcclxuICAgIC8vIFJlZ2lzdGVyIGZvciBwbHVnaW4gbGlmZWN5Y2xlIGV2ZW50c1xyXG4gICAgdGhpcy5yZWdpc3RlckV2ZW50TGlzdGVuZXJzKCk7XHJcbiAgICBcclxuICAgIC8vIEVtaXQgc3RvcmFnZSBpbml0aWFsaXplZCBldmVudFxyXG4gICAgdGhpcy5ldmVudEJ1cy5lbWl0KCdzdG9yYWdlOmluaXRpYWxpemVkJywgdW5kZWZpbmVkKTtcclxuICB9XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogUmVnaXN0ZXIgZXZlbnQgbGlzdGVuZXJzIGZvciB0aGUgc3RvcmFnZSBzZXJ2aWNlLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgcmVnaXN0ZXJFdmVudExpc3RlbmVycygpOiB2b2lkIHtcclxuICAgIC8vIExpc3RlbiBmb3IgcGx1Z2luIHVubG9hZCBldmVudFxyXG4gICAgdGhpcy5wbHVnaW4ucmVnaXN0ZXJFdmVudChcclxuICAgICAgdGhpcy5ldmVudEJ1cy5vbigncGx1Z2luOnVubG9hZGVkJywgKCkgPT4ge1xyXG4gICAgICAgIC8vIENsZWFuIHVwIGFueSByZXNvdXJjZXMgaWYgbmVlZGVkXHJcbiAgICAgICAgY29uc29sZS5sb2coJ1N0b3JhZ2Ugc2VydmljZSBzaHV0dGluZyBkb3duJyk7XHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBHZXQgYWxsIGNvbnZlcnNhdGlvbnMuXHJcbiAgICogQHJldHVybnMgUHJvbWlzZSB0aGF0IHJlc29sdmVzIHdpdGggYW4gYXJyYXkgb2YgY29udmVyc2F0aW9uc1xyXG4gICAqL1xyXG4gIHB1YmxpYyBhc3luYyBnZXRDb252ZXJzYXRpb25zKCk6IFByb21pc2U8Q29udmVyc2F0aW9uW10+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLnN0b3JhZ2VNYW5hZ2VyLmdldENvbnZlcnNhdGlvbnMoKTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGdldHRpbmcgY29udmVyc2F0aW9uczonLCBlcnJvcik7XHJcbiAgICAgIHRoaXMuaGFuZGxlU3RvcmFnZUVycm9yKGVycm9yKTtcclxuICAgICAgcmV0dXJuIFtdO1xyXG4gICAgfVxyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBHZXQgYSBjb252ZXJzYXRpb24gYnkgSUQuXHJcbiAgICogQHBhcmFtIGlkIENvbnZlcnNhdGlvbiBJRFxyXG4gICAqIEByZXR1cm5zIFByb21pc2UgdGhhdCByZXNvbHZlcyB3aXRoIHRoZSBjb252ZXJzYXRpb24gb3IgbnVsbCBpZiBub3QgZm91bmRcclxuICAgKi9cclxuICBwdWJsaWMgYXN5bmMgZ2V0Q29udmVyc2F0aW9uKGlkOiBzdHJpbmcpOiBQcm9taXNlPENvbnZlcnNhdGlvbiB8IG51bGw+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLnN0b3JhZ2VNYW5hZ2VyLmdldENvbnZlcnNhdGlvbihpZCk7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKGBFcnJvciBnZXR0aW5nIGNvbnZlcnNhdGlvbiAke2lkfTpgLCBlcnJvcik7XHJcbiAgICAgIHRoaXMuaGFuZGxlU3RvcmFnZUVycm9yKGVycm9yKTtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIG5ldyBjb252ZXJzYXRpb24uXHJcbiAgICogQHBhcmFtIHRpdGxlIE9wdGlvbmFsIHRpdGxlIGZvciB0aGUgY29udmVyc2F0aW9uXHJcbiAgICogQHJldHVybnMgUHJvbWlzZSB0aGF0IHJlc29sdmVzIHdpdGggdGhlIG5ldyBjb252ZXJzYXRpb25cclxuICAgKi9cclxuICBwdWJsaWMgYXN5bmMgY3JlYXRlQ29udmVyc2F0aW9uKHRpdGxlPzogc3RyaW5nKTogUHJvbWlzZTxDb252ZXJzYXRpb24+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLnN0b3JhZ2VNYW5hZ2VyLmNyZWF0ZUNvbnZlcnNhdGlvbih0aXRsZSk7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBjcmVhdGluZyBjb252ZXJzYXRpb246JywgZXJyb3IpO1xyXG4gICAgICB0aGlzLmhhbmRsZVN0b3JhZ2VFcnJvcihlcnJvcik7XHJcbiAgICAgIHRocm93IGVycm9yO1xyXG4gICAgfVxyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBTYXZlIGEgY29udmVyc2F0aW9uLlxyXG4gICAqIEBwYXJhbSBjb252ZXJzYXRpb24gQ29udmVyc2F0aW9uIHRvIHNhdmVcclxuICAgKiBAcmV0dXJucyBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiB0aGUgY29udmVyc2F0aW9uIGlzIHNhdmVkXHJcbiAgICovXHJcbiAgcHVibGljIGFzeW5jIHNhdmVDb252ZXJzYXRpb24oY29udmVyc2F0aW9uOiBDb252ZXJzYXRpb24pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGF3YWl0IHRoaXMuc3RvcmFnZU1hbmFnZXIuc2F2ZUNvbnZlcnNhdGlvbihjb252ZXJzYXRpb24pO1xyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgY29uc29sZS5lcnJvcihgRXJyb3Igc2F2aW5nIGNvbnZlcnNhdGlvbiAke2NvbnZlcnNhdGlvbi5pZH06YCwgZXJyb3IpO1xyXG4gICAgICB0aGlzLmhhbmRsZVN0b3JhZ2VFcnJvcihlcnJvcik7XHJcbiAgICAgIHRocm93IGVycm9yO1xyXG4gICAgfVxyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBEZWxldGUgYSBjb252ZXJzYXRpb24uXHJcbiAgICogQHBhcmFtIGlkIENvbnZlcnNhdGlvbiBJRFxyXG4gICAqIEByZXR1cm5zIFByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIHRoZSBjb252ZXJzYXRpb24gaXMgZGVsZXRlZFxyXG4gICAqL1xyXG4gIHB1YmxpYyBhc3luYyBkZWxldGVDb252ZXJzYXRpb24oaWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgYXdhaXQgdGhpcy5zdG9yYWdlTWFuYWdlci5kZWxldGVDb252ZXJzYXRpb24oaWQpO1xyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgY29uc29sZS5lcnJvcihgRXJyb3IgZGVsZXRpbmcgY29udmVyc2F0aW9uICR7aWR9OmAsIGVycm9yKTtcclxuICAgICAgdGhpcy5oYW5kbGVTdG9yYWdlRXJyb3IoZXJyb3IpO1xyXG4gICAgICB0aHJvdyBlcnJvcjtcclxuICAgIH1cclxuICB9XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogQWRkIGEgbWVzc2FnZSB0byBhIGNvbnZlcnNhdGlvbi5cclxuICAgKiBAcGFyYW0gY29udmVyc2F0aW9uSWQgQ29udmVyc2F0aW9uIElEXHJcbiAgICogQHBhcmFtIG1lc3NhZ2UgTWVzc2FnZSB0byBhZGRcclxuICAgKiBAcmV0dXJucyBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2l0aCB0aGUgdXBkYXRlZCBjb252ZXJzYXRpb25cclxuICAgKi9cclxuICBwdWJsaWMgYXN5bmMgYWRkTWVzc2FnZShcclxuICAgIGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsXHJcbiAgICBtZXNzYWdlOiBNZXNzYWdlXHJcbiAgKTogUHJvbWlzZTxDb252ZXJzYXRpb24+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLnN0b3JhZ2VNYW5hZ2VyLmFkZE1lc3NhZ2UoY29udmVyc2F0aW9uSWQsIG1lc3NhZ2UpO1xyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgY29uc29sZS5lcnJvcihgRXJyb3IgYWRkaW5nIG1lc3NhZ2UgdG8gY29udmVyc2F0aW9uICR7Y29udmVyc2F0aW9uSWR9OmAsIGVycm9yKTtcclxuICAgICAgdGhpcy5oYW5kbGVTdG9yYWdlRXJyb3IoZXJyb3IpO1xyXG4gICAgICB0aHJvdyBlcnJvcjtcclxuICAgIH1cclxuICB9XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogVXBkYXRlIGEgbWVzc2FnZSBpbiBhIGNvbnZlcnNhdGlvbi5cclxuICAgKiBAcGFyYW0gY29udmVyc2F0aW9uSWQgQ29udmVyc2F0aW9uIElEXHJcbiAgICogQHBhcmFtIG1lc3NhZ2VJZCBNZXNzYWdlIElEXHJcbiAgICogQHBhcmFtIHVwZGF0ZWRDb250ZW50IFVwZGF0ZWQgbWVzc2FnZSBjb250ZW50XHJcbiAgICogQHJldHVybnMgUHJvbWlzZSB0aGF0IHJlc29sdmVzIHdpdGggdGhlIHVwZGF0ZWQgY29udmVyc2F0aW9uXHJcbiAgICovXHJcbiAgcHVibGljIGFzeW5jIHVwZGF0ZU1lc3NhZ2UoXHJcbiAgICBjb252ZXJzYXRpb25JZDogc3RyaW5nLFxyXG4gICAgbWVzc2FnZUlkOiBzdHJpbmcsXHJcbiAgICB1cGRhdGVkQ29udGVudDogc3RyaW5nXHJcbiAgKTogUHJvbWlzZTxDb252ZXJzYXRpb24+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLnN0b3JhZ2VNYW5hZ2VyLnVwZGF0ZU1lc3NhZ2UoXHJcbiAgICAgICAgY29udmVyc2F0aW9uSWQsXHJcbiAgICAgICAgbWVzc2FnZUlkLFxyXG4gICAgICAgIHVwZGF0ZWRDb250ZW50XHJcbiAgICAgICk7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKGBFcnJvciB1cGRhdGluZyBtZXNzYWdlICR7bWVzc2FnZUlkfSBpbiBjb252ZXJzYXRpb24gJHtjb252ZXJzYXRpb25JZH06YCwgZXJyb3IpO1xyXG4gICAgICB0aGlzLmhhbmRsZVN0b3JhZ2VFcnJvcihlcnJvcik7XHJcbiAgICAgIHRocm93IGVycm9yO1xyXG4gICAgfVxyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBSZW5hbWUgYSBjb252ZXJzYXRpb24uXHJcbiAgICogQHBhcmFtIGNvbnZlcnNhdGlvbklkIENvbnZlcnNhdGlvbiBJRFxyXG4gICAqIEBwYXJhbSBuZXdUaXRsZSBOZXcgY29udmVyc2F0aW9uIHRpdGxlXHJcbiAgICogQHJldHVybnMgUHJvbWlzZSB0aGF0IHJlc29sdmVzIHdpdGggdGhlIHVwZGF0ZWQgY29udmVyc2F0aW9uXHJcbiAgICovXHJcbiAgcHVibGljIGFzeW5jIHJlbmFtZUNvbnZlcnNhdGlvbihcclxuICAgIGNvbnZlcnNhdGlvbklkOiBzdHJpbmcsXHJcbiAgICBuZXdUaXRsZTogc3RyaW5nXHJcbiAgKTogUHJvbWlzZTxDb252ZXJzYXRpb24+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLnN0b3JhZ2VNYW5hZ2VyLnJlbmFtZUNvbnZlcnNhdGlvbihjb252ZXJzYXRpb25JZCwgbmV3VGl0bGUpO1xyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgY29uc29sZS5lcnJvcihgRXJyb3IgcmVuYW1pbmcgY29udmVyc2F0aW9uICR7Y29udmVyc2F0aW9uSWR9OmAsIGVycm9yKTtcclxuICAgICAgdGhpcy5oYW5kbGVTdG9yYWdlRXJyb3IoZXJyb3IpO1xyXG4gICAgICB0aHJvdyBlcnJvcjtcclxuICAgIH1cclxuICB9XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogRXhwb3J0IGEgY29udmVyc2F0aW9uIHRvIE1hcmtkb3duLlxyXG4gICAqIEBwYXJhbSBjb252ZXJzYXRpb25JZCBDb252ZXJzYXRpb24gSURcclxuICAgKiBAcmV0dXJucyBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiB0aGUgZXhwb3J0IGlzIGNvbXBsZXRlXHJcbiAgICovXHJcbiAgcHVibGljIGFzeW5jIGV4cG9ydFRvTWFya2Rvd24oY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgYXdhaXQgdGhpcy5zdG9yYWdlTWFuYWdlci5leHBvcnRUb01hcmtkb3duKGNvbnZlcnNhdGlvbklkKTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoYEVycm9yIGV4cG9ydGluZyBjb252ZXJzYXRpb24gJHtjb252ZXJzYXRpb25JZH0gdG8gTWFya2Rvd246YCwgZXJyb3IpO1xyXG4gICAgICB0aGlzLmhhbmRsZVN0b3JhZ2VFcnJvcihlcnJvcik7XHJcbiAgICAgIHRocm93IGVycm9yO1xyXG4gICAgfVxyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBFeHBvcnQgYSBjb252ZXJzYXRpb24gdG8gSlNPTi5cclxuICAgKiBAcGFyYW0gY29udmVyc2F0aW9uSWQgQ29udmVyc2F0aW9uIElEXHJcbiAgICogQHJldHVybnMgUHJvbWlzZSB0aGF0IHJlc29sdmVzIHdoZW4gdGhlIGV4cG9ydCBpcyBjb21wbGV0ZVxyXG4gICAqL1xyXG4gIHB1YmxpYyBhc3luYyBleHBvcnRUb0pzb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgYXdhaXQgdGhpcy5zdG9yYWdlTWFuYWdlci5leHBvcnRUb0pzb24oY29udmVyc2F0aW9uSWQpO1xyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgY29uc29sZS5lcnJvcihgRXJyb3IgZXhwb3J0aW5nIGNvbnZlcnNhdGlvbiAke2NvbnZlcnNhdGlvbklkfSB0byBKU09OOmAsIGVycm9yKTtcclxuICAgICAgdGhpcy5oYW5kbGVTdG9yYWdlRXJyb3IoZXJyb3IpO1xyXG4gICAgICB0aHJvdyBlcnJvcjtcclxuICAgIH1cclxuICB9XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogSW1wb3J0IGEgY29udmVyc2F0aW9uIGZyb20gSlNPTi5cclxuICAgKiBAcGFyYW0ganNvbiBDb252ZXJzYXRpb24gSlNPTlxyXG4gICAqIEByZXR1cm5zIFByb21pc2UgdGhhdCByZXNvbHZlcyB3aXRoIHRoZSBpbXBvcnRlZCBjb252ZXJzYXRpb25cclxuICAgKi9cclxuICBwdWJsaWMgYXN5bmMgaW1wb3J0Q29udmVyc2F0aW9uKGpzb246IHN0cmluZyk6IFByb21pc2U8Q29udmVyc2F0aW9uPiB7XHJcbiAgICB0cnkge1xyXG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy5zdG9yYWdlTWFuYWdlci5pbXBvcnRDb252ZXJzYXRpb24oanNvbik7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBpbXBvcnRpbmcgY29udmVyc2F0aW9uOicsIGVycm9yKTtcclxuICAgICAgdGhpcy5oYW5kbGVTdG9yYWdlRXJyb3IoZXJyb3IpO1xyXG4gICAgICB0aHJvdyBlcnJvcjtcclxuICAgIH1cclxuICB9XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogSW1wb3J0IGEgY29udmVyc2F0aW9uIGZyb20gTWFya2Rvd24uXHJcbiAgICogQHBhcmFtIG1hcmtkb3duIE1hcmtkb3duIGNvbnRlbnRcclxuICAgKiBAcmV0dXJucyBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2l0aCB0aGUgaW1wb3J0ZWQgY29udmVyc2F0aW9uXHJcbiAgICovXHJcbiAgcHVibGljIGFzeW5jIGltcG9ydEZyb21NYXJrZG93bihtYXJrZG93bjogc3RyaW5nKTogUHJvbWlzZTxDb252ZXJzYXRpb24+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIHJldHVybiBhd2FpdCB0aGlzLnN0b3JhZ2VNYW5hZ2VyLmltcG9ydEZyb21NYXJrZG93bihtYXJrZG93bik7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBpbXBvcnRpbmcgY29udmVyc2F0aW9uIGZyb20gTWFya2Rvd246JywgZXJyb3IpO1xyXG4gICAgICB0aGlzLmhhbmRsZVN0b3JhZ2VFcnJvcihlcnJvcik7XHJcbiAgICAgIHRocm93IGVycm9yO1xyXG4gICAgfVxyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBDcmVhdGUgYSBiYWNrdXAgb2YgYSBjb252ZXJzYXRpb24uXHJcbiAgICogQHBhcmFtIGNvbnZlcnNhdGlvbklkIENvbnZlcnNhdGlvbiBJRFxyXG4gICAqIEByZXR1cm5zIFByb21pc2UgdGhhdCByZXNvbHZlcyB3aXRoIHRoZSBwYXRoIHRvIHRoZSBiYWNrdXAgZmlsZVxyXG4gICAqL1xyXG4gIHB1YmxpYyBhc3luYyBiYWNrdXBDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQ6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XHJcbiAgICB0cnkge1xyXG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy5zdG9yYWdlTWFuYWdlci5iYWNrdXBDb252ZXJzYXRpb24oY29udmVyc2F0aW9uSWQpO1xyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgY29uc29sZS5lcnJvcihgRXJyb3IgYmFja2luZyB1cCBjb252ZXJzYXRpb24gJHtjb252ZXJzYXRpb25JZH06YCwgZXJyb3IpO1xyXG4gICAgICB0aGlzLmhhbmRsZVN0b3JhZ2VFcnJvcihlcnJvcik7XHJcbiAgICAgIHRocm93IGVycm9yO1xyXG4gICAgfVxyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBIYW5kbGUgc3RvcmFnZSBlcnJvcnMuXHJcbiAgICogQHBhcmFtIGVycm9yIEVycm9yIHRvIGhhbmRsZVxyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlU3RvcmFnZUVycm9yKGVycm9yOiBhbnkpOiB2b2lkIHtcclxuICAgIC8vIEVtaXQgZXJyb3IgZXZlbnRcclxuICAgIHRoaXMuZXZlbnRCdXMuZW1pdCgnc3RvcmFnZTplcnJvcicsIHsgZXJyb3IgfSk7XHJcbiAgICBcclxuICAgIC8vIEhhbmRsZSBzcGVjaWZpYyBlcnJvciB0eXBlc1xyXG4gICAgaWYgKGVycm9yIGluc3RhbmNlb2YgQ29udmVyc2F0aW9uTm90Rm91bmRFcnJvcikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKGBDb252ZXJzYXRpb24gbm90IGZvdW5kOiAke2Vycm9yLmNvbnZlcnNhdGlvbklkfWApO1xyXG4gICAgfSBlbHNlIGlmIChlcnJvciBpbnN0YW5jZW9mIE1lc3NhZ2VOb3RGb3VuZEVycm9yKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoYE1lc3NhZ2Ugbm90IGZvdW5kOiAke2Vycm9yLm1lc3NhZ2VJZH0gaW4gY29udmVyc2F0aW9uICR7ZXJyb3IuY29udmVyc2F0aW9uSWR9YCk7XHJcbiAgICB9IGVsc2UgaWYgKGVycm9yIGluc3RhbmNlb2YgRm9sZGVyT3BlcmF0aW9uRXJyb3IpIHtcclxuICAgICAgY29uc29sZS5lcnJvcihgRm9sZGVyIG9wZXJhdGlvbiBmYWlsZWQ6ICR7ZXJyb3IucGF0aH1gKTtcclxuICAgIH0gZWxzZSBpZiAoZXJyb3IgaW5zdGFuY2VvZiBGaWxlT3BlcmF0aW9uRXJyb3IpIHtcclxuICAgICAgY29uc29sZS5lcnJvcihgRmlsZSBvcGVyYXRpb24gZmFpbGVkOiAke2Vycm9yLnBhdGh9YCk7XHJcbiAgICB9IGVsc2UgaWYgKGVycm9yIGluc3RhbmNlb2YgSnNvblBhcnNlRXJyb3IpIHtcclxuICAgICAgY29uc29sZS5lcnJvcihgSlNPTiBwYXJzZSBlcnJvcjogJHtlcnJvci5tZXNzYWdlfWApO1xyXG4gICAgfSBlbHNlIGlmIChlcnJvciBpbnN0YW5jZW9mIEltcG9ydEV4cG9ydEVycm9yKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoYEltcG9ydC9leHBvcnQgZXJyb3I6ICR7ZXJyb3IubWVzc2FnZX1gKTtcclxuICAgIH0gZWxzZSBpZiAoZXJyb3IgaW5zdGFuY2VvZiBTdG9yYWdlRXJyb3IpIHtcclxuICAgICAgY29uc29sZS5lcnJvcihgU3RvcmFnZSBlcnJvcjogJHtlcnJvci5tZXNzYWdlfWApO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgY29uc29sZS5lcnJvcihgVW5rbm93biBzdG9yYWdlIGVycm9yOiAke2Vycm9yfWApO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG4iXX0=