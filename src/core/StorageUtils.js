/**
 * Utility functions for the storage system.
 *
 * This file provides helper functions for common storage tasks such as
 * converting conversations to Markdown, handling backups, and parsing
 * Markdown into conversations.
 */
import { TFolder, Notice } from '../utils/obsidian-imports';
import { JsonParseError, ImportExportError } from './StorageErrors';
/**
 * StorageUtils class for common storage tasks.
 */
export class StorageUtils {
    /**
     * Convert a conversation to Markdown format with front matter.
     * @param conversation Conversation to convert
     * @returns Conversation as Markdown with front matter
     */
    static conversationToMarkdown(conversation) {
        // Create front matter
        let markdown = '---\n';
        markdown += `title: ${conversation.title}\n`;
        markdown += `created: ${new Date(conversation.createdAt).toISOString()}\n`;
        markdown += `modified: ${new Date(conversation.modifiedAt).toISOString()}\n`;
        markdown += `id: ${conversation.id}\n`;
        markdown += `messageCount: ${conversation.messages.length}\n`;
        markdown += `tags: [conversation]\n`;
        // Add any custom metadata
        if (conversation.metadata) {
            for (const [key, value] of Object.entries(conversation.metadata)) {
                if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                    markdown += `${key}: ${value}\n`;
                }
                else if (Array.isArray(value)) {
                    markdown += `${key}: [${value.join(', ')}]\n`;
                }
            }
        }
        markdown += '---\n\n';
        // Add conversation title
        markdown += `# ${conversation.title}\n\n`;
        // Add conversation metadata
        markdown += `- Created: ${new Date(conversation.createdAt).toLocaleString()}\n`;
        markdown += `- Modified: ${new Date(conversation.modifiedAt).toLocaleString()}\n\n`;
        // Add messages
        markdown += `## Conversation\n\n`;
        for (const message of conversation.messages) {
            const timestamp = new Date(message.timestamp).toLocaleString();
            const role = message.role.charAt(0).toUpperCase() + message.role.slice(1);
            markdown += `### ${role} (${timestamp})\n\n`;
            markdown += `${message.content}\n\n`;
            // Add tool calls if present
            if (message.toolCalls && message.toolCalls.length > 0) {
                markdown += `**Tool Calls:**\n\n`;
                for (const toolCall of message.toolCalls) {
                    markdown += `- Tool: ${toolCall.name}\n`;
                    markdown += `  - Arguments: ${JSON.stringify(toolCall.arguments, null, 2)}\n`;
                    markdown += `  - Status: ${toolCall.status}\n\n`;
                }
            }
            // Add tool results if present
            if (message.toolResults && message.toolResults.length > 0) {
                markdown += `**Tool Results:**\n\n`;
                for (const toolResult of message.toolResults) {
                    markdown += `- Tool Call: ${toolResult.toolCallId}\n`;
                    if (toolResult.error) {
                        markdown += `  - Error: ${toolResult.error}\n\n`;
                    }
                    else {
                        markdown += `  - Content: ${JSON.stringify(toolResult.content, null, 2)}\n\n`;
                    }
                }
            }
        }
        return markdown;
    }
    /**
     * Create a backup of a conversation in the vault.
     * @param app Obsidian app instance
     * @param conversation Conversation to backup
     * @param backupFolder Folder to store backups
     * @returns Promise that resolves with the path to the backup file
     */
    static async backupConversation(app, conversation, backupFolder) {
        try {
            // Ensure backup folder exists
            let folder = app.vault.getAbstractFileByPath(backupFolder);
            if (!folder) {
                await app.vault.createFolder(backupFolder);
            }
            else if (!(folder instanceof TFolder)) {
                throw new Error(`${backupFolder} exists but is not a folder`);
            }
            // Create backup filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const safeTitle = this.sanitizeFilename(conversation.title);
            const filename = `${backupFolder}/${safeTitle}-${timestamp}.json`;
            // Create backup file
            await app.vault.create(filename, JSON.stringify(conversation, null, 2));
            return filename;
        }
        catch (error) {
            console.error(`Failed to backup conversation: ${error}`);
            throw error;
        }
    }
    /**
     * Export a conversation to an external file.
     * @param app Obsidian app instance
     * @param conversation Conversation to export
     * @param format Export format ('json' or 'markdown')
     * @returns Promise that resolves when the export is complete
     */
    static async exportConversation(app, conversation, format) {
        try {
            // Create filename
            const safeTitle = this.sanitizeFilename(conversation.title);
            const extension = format === 'json' ? 'json' : 'md';
            // Create content
            const content = format === 'json'
                ? JSON.stringify(conversation, null, 2)
                : this.conversationToMarkdown(conversation);
            // Use Obsidian's FileManager to create a new file
            if (format === 'markdown') {
                await app.fileManager.createNewMarkdownFile(null, // Uses default location from Obsidian settings
                safeTitle, content);
            }
            else {
                // For JSON, we need to use the vault API directly
                // Create a temporary file first, then let the user save it
                const tempPath = `${safeTitle}.${extension}`;
                const file = await app.vault.create(tempPath, content);
                // Open the file
                await app.workspace.openLinkText(file.path, '', true);
                // Show a notice
                new Notice(`Exported to ${file.path}`);
            }
        }
        catch (error) {
            console.error(`Failed to export conversation: ${error}`);
            throw new ImportExportError(error.message);
        }
    }
    /**
     * Parse Markdown into a conversation.
     * @param markdown Markdown content
     * @returns Parsed conversation
     */
    static parseMarkdownToConversation(markdown) {
        try {
            const lines = markdown.split('\n');
            const conversation = {
                id: this.generateId(),
                title: 'Imported Conversation',
                createdAt: Date.now(),
                modifiedAt: Date.now(),
                messages: []
            };
            // Extract front matter
            let inFrontMatter = false;
            let frontMatterLines = [];
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.trim() === '---') {
                    if (!inFrontMatter) {
                        inFrontMatter = true;
                        continue;
                    }
                    else {
                        inFrontMatter = false;
                        break;
                    }
                }
                if (inFrontMatter) {
                    frontMatterLines.push(line);
                }
            }
            // Parse front matter
            for (const line of frontMatterLines) {
                const match = line.match(/^([^:]+):\s*(.+)$/);
                if (match) {
                    const [, key, value] = match;
                    switch (key.trim()) {
                        case 'title':
                            conversation.title = value.trim();
                            break;
                        case 'created':
                            conversation.createdAt = new Date(value.trim()).getTime();
                            break;
                        case 'modified':
                            conversation.modifiedAt = new Date(value.trim()).getTime();
                            break;
                        case 'id':
                            conversation.id = value.trim();
                            break;
                        default:
                            // Store other metadata
                            if (!conversation.metadata) {
                                conversation.metadata = {};
                            }
                            conversation.metadata[key.trim()] = value.trim();
                    }
                }
            }
            // Extract title from first heading if not in front matter
            if (conversation.title === 'Imported Conversation') {
                const titleMatch = markdown.match(/^# (.+)$/m);
                if (titleMatch) {
                    conversation.title = titleMatch[1];
                }
            }
            // Process messages
            let currentRole = null;
            let currentContent = '';
            let currentMessage = null;
            let currentToolCalls = [];
            let currentToolResults = [];
            // Skip front matter in processing
            const contentLines = inFrontMatter ? lines.slice(frontMatterLines.length + 2) : lines;
            for (const line of contentLines) {
                const roleMatch = line.match(/^### (User|Assistant|System)/i);
                const toolCallsMatch = line.match(/^\*\*Tool Calls:\*\*$/);
                const toolResultsMatch = line.match(/^\*\*Tool Results:\*\*$/);
                if (roleMatch) {
                    // Save previous message if exists
                    if (currentMessage && currentRole) {
                        conversation.messages.push({
                            id: this.generateId(),
                            role: currentRole,
                            content: currentContent.trim(),
                            timestamp: Date.now() - (conversation.messages.length * 1000),
                            toolCalls: currentToolCalls.length > 0 ? currentToolCalls : undefined,
                            toolResults: currentToolResults.length > 0 ? currentToolResults : undefined
                        });
                    }
                    // Start new message
                    currentRole = roleMatch[1].toLowerCase();
                    currentContent = '';
                    currentMessage = { role: currentRole };
                    currentToolCalls = [];
                    currentToolResults = [];
                }
                else if (toolCallsMatch) {
                    // We're now parsing tool calls
                    // The content before this point is the message content
                    currentContent = currentContent.trim();
                }
                else if (toolResultsMatch) {
                    // We're now parsing tool results
                }
                else if (currentMessage) {
                    // Add line to current message
                    currentContent += line + '\n';
                }
            }
            // Add final message if exists
            if (currentMessage && currentRole) {
                conversation.messages.push({
                    id: this.generateId(),
                    role: currentRole,
                    content: currentContent.trim(),
                    timestamp: Date.now() - (conversation.messages.length * 1000),
                    toolCalls: currentToolCalls.length > 0 ? currentToolCalls : undefined,
                    toolResults: currentToolResults.length > 0 ? currentToolResults : undefined
                });
            }
            return conversation;
        }
        catch (error) {
            console.error(`Failed to parse Markdown to conversation: ${error}`);
            throw new ImportExportError(`Failed to parse Markdown: ${error.message}`);
        }
    }
    /**
     * Parse JSON into a conversation.
     * @param json JSON string
     * @returns Parsed conversation
     */
    static parseJsonToConversation(json) {
        try {
            const parsed = JSON.parse(json);
            // Validate basic structure
            if (!parsed.id || !parsed.title || !Array.isArray(parsed.messages)) {
                throw new Error('Invalid conversation format: missing required fields');
            }
            // Ensure all required fields are present
            const conversation = {
                id: parsed.id,
                title: parsed.title,
                createdAt: parsed.createdAt || Date.now(),
                modifiedAt: parsed.modifiedAt || Date.now(),
                messages: parsed.messages.map((msg) => ({
                    id: msg.id || this.generateId(),
                    role: msg.role,
                    content: msg.content,
                    timestamp: msg.timestamp || Date.now(),
                    toolCalls: msg.toolCalls,
                    toolResults: msg.toolResults
                })),
                metadata: parsed.metadata
            };
            return conversation;
        }
        catch (error) {
            console.error(`Failed to parse JSON to conversation: ${error}`);
            throw new JsonParseError(error.message);
        }
    }
    /**
     * Sanitize a filename to be safe for file systems.
     * @param filename Filename to sanitize
     * @returns Sanitized filename
     */
    static sanitizeFilename(filename) {
        return filename
            .replace(/[^a-zA-Z0-9]/g, '-') // Replace non-alphanumeric with hyphens
            .replace(/--+/g, '-') // Replace multiple hyphens with single hyphen
            .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
            .slice(0, 50); // Limit length
    }
    /**
     * Generate a unique ID.
     * @returns A unique ID
     */
    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU3RvcmFnZVV0aWxzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiU3RvcmFnZVV0aWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBYyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFFeEUsT0FBTyxFQUFFLGNBQWMsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBRXBFOztHQUVHO0FBQ0gsTUFBTSxPQUFPLFlBQVk7SUFDdkI7Ozs7T0FJRztJQUNJLE1BQU0sQ0FBQyxzQkFBc0IsQ0FBQyxZQUEwQjtRQUM3RCxzQkFBc0I7UUFDdEIsSUFBSSxRQUFRLEdBQUcsT0FBTyxDQUFDO1FBQ3ZCLFFBQVEsSUFBSSxVQUFVLFlBQVksQ0FBQyxLQUFLLElBQUksQ0FBQztRQUM3QyxRQUFRLElBQUksWUFBWSxJQUFJLElBQUksQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQztRQUMzRSxRQUFRLElBQUksYUFBYSxJQUFJLElBQUksQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQztRQUM3RSxRQUFRLElBQUksT0FBTyxZQUFZLENBQUMsRUFBRSxJQUFJLENBQUM7UUFDdkMsUUFBUSxJQUFJLGlCQUFpQixZQUFZLENBQUMsUUFBUSxDQUFDLE1BQU0sSUFBSSxDQUFDO1FBQzlELFFBQVEsSUFBSSx3QkFBd0IsQ0FBQztRQUVyQywwQkFBMEI7UUFDMUIsSUFBSSxZQUFZLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDMUIsS0FBSyxNQUFNLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7Z0JBQ2pFLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxP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QyxDQUFVLDhDQUE4QzthQUM1RSxPQUFPLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxDQUFTLGtDQUFrQzthQUNoRSxLQUFLLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQWlCLGVBQWU7SUFDbEQsQ0FBQztJQUVEOzs7T0FHRztJQUNJLE1BQU0sQ0FBQyxVQUFVO1FBQ3RCLE9BQU8sSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDOUUsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIFV0aWxpdHkgZnVuY3Rpb25zIGZvciB0aGUgc3RvcmFnZSBzeXN0ZW0uXHJcbiAqIFxyXG4gKiBUaGlzIGZpbGUgcHJvdmlkZXMgaGVscGVyIGZ1bmN0aW9ucyBmb3IgY29tbW9uIHN0b3JhZ2UgdGFza3Mgc3VjaCBhc1xyXG4gKiBjb252ZXJ0aW5nIGNvbnZlcnNhdGlvbnMgdG8gTWFya2Rvd24sIGhhbmRsaW5nIGJhY2t1cHMsIGFuZCBwYXJzaW5nXHJcbiAqIE1hcmtkb3duIGludG8gY29udmVyc2F0aW9ucy5cclxuICovXHJcblxyXG5pbXBvcnQgeyBBcHAsIFRGaWxlLCBURm9sZGVyLCBOb3RpY2UgfSBmcm9tICcuLi91dGlscy9vYnNpZGlhbi1pbXBvcnRzJztcclxuaW1wb3J0IHsgQ29udmVyc2F0aW9uLCBNZXNzYWdlLCBNZXNzYWdlUm9sZSwgVG9vbENhbGwsIFRvb2xSZXN1bHQgfSBmcm9tICcuLi9tb2RlbHMvQ29udmVyc2F0aW9uJztcclxuaW1wb3J0IHsgSnNvblBhcnNlRXJyb3IsIEltcG9ydEV4cG9ydEVycm9yIH0gZnJvbSAnLi9TdG9yYWdlRXJyb3JzJztcclxuXHJcbi8qKlxyXG4gKiBTdG9yYWdlVXRpbHMgY2xhc3MgZm9yIGNvbW1vbiBzdG9yYWdlIHRhc2tzLlxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFN0b3JhZ2VVdGlscyB7XHJcbiAgLyoqXHJcbiAgICogQ29udmVydCBhIGNvbnZlcnNhdGlvbiB0byBNYXJrZG93biBmb3JtYXQgd2l0aCBmcm9udCBtYXR0ZXIuXHJcbiAgICogQHBhcmFtIGNvbnZlcnNhdGlvbiBDb252ZXJzYXRpb24gdG8gY29udmVydFxyXG4gICAqIEByZXR1cm5zIENvbnZlcnNhdGlvbiBhcyBNYXJrZG93biB3aXRoIGZyb250IG1hdHRlclxyXG4gICAqL1xyXG4gIHB1YmxpYyBzdGF0aWMgY29udmVyc2F0aW9uVG9NYXJrZG93bihjb252ZXJzYXRpb246IENvbnZlcnNhdGlvbik6IHN0cmluZyB7XHJcbiAgICAvLyBDcmVhdGUgZnJvbnQgbWF0dGVyXHJcbiAgICBsZXQgbWFya2Rvd24gPSAnLS0tXFxuJztcclxuICAgIG1hcmtkb3duICs9IGB0aXRsZTogJHtjb252ZXJzYXRpb24udGl0bGV9XFxuYDtcclxuICAgIG1hcmtkb3duICs9IGBjcmVhdGVkOiAke25ldyBEYXRlKGNvbnZlcnNhdGlvbi5jcmVhdGVkQXQpLnRvSVNPU3RyaW5nKCl9XFxuYDtcclxuICAgIG1hcmtkb3duICs9IGBtb2RpZmllZDogJHtuZXcgRGF0ZShjb252ZXJzYXRpb24ubW9kaWZpZWRBdCkudG9JU09TdHJpbmcoKX1cXG5gO1xyXG4gICAgbWFya2Rvd24gKz0gYGlkOiAke2NvbnZlcnNhdGlvbi5pZH1cXG5gO1xyXG4gICAgbWFya2Rvd24gKz0gYG1lc3NhZ2VDb3VudDogJHtjb252ZXJzYXRpb24ubWVzc2FnZXMubGVuZ3RofVxcbmA7XHJcbiAgICBtYXJrZG93biArPSBgdGFnczogW2NvbnZlcnNhdGlvbl1cXG5gO1xyXG4gICAgXHJcbiAgICAvLyBBZGQgYW55IGN1c3RvbSBtZXRhZGF0YVxyXG4gICAgaWYgKGNvbnZlcnNhdGlvbi5tZXRhZGF0YSkge1xyXG4gICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhjb252ZXJzYXRpb24ubWV0YWRhdGEpKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyB8fCB0eXBlb2YgdmFsdWUgPT09ICdib29sZWFuJykge1xyXG4gICAgICAgICAgbWFya2Rvd24gKz0gYCR7a2V5fTogJHt2YWx1ZX1cXG5gO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcclxuICAgICAgICAgIG1hcmtkb3duICs9IGAke2tleX06IFske3ZhbHVlLmpvaW4oJywgJyl9XVxcbmA7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIG1hcmtkb3duICs9ICctLS1cXG5cXG4nO1xyXG4gICAgXHJcbiAgICAvLyBBZGQgY29udmVyc2F0aW9uIHRpdGxlXHJcbiAgICBtYXJrZG93biArPSBgIyAke2NvbnZlcnNhdGlvbi50aXRsZX1cXG5cXG5gO1xyXG4gICAgXHJcbiAgICAvLyBBZGQgY29udmVyc2F0aW9uIG1ldGFkYXRhXHJcbiAgICBtYXJrZG93biArPSBgLSBDcmVhdGVkOiAke25ldyBEYXRlKGNvbnZlcnNhdGlvbi5jcmVhdGVkQXQpLnRvTG9jYWxlU3RyaW5nKCl9XFxuYDtcclxuICAgIG1hcmtkb3duICs9IGAtIE1vZGlmaWVkOiAke25ldyBEYXRlKGNvbnZlcnNhdGlvbi5tb2RpZmllZEF0KS50b0xvY2FsZVN0cmluZygpfVxcblxcbmA7XHJcbiAgICBcclxuICAgIC8vIEFkZCBtZXNzYWdlc1xyXG4gICAgbWFya2Rvd24gKz0gYCMjIENvbnZlcnNhdGlvblxcblxcbmA7XHJcbiAgICBcclxuICAgIGZvciAoY29uc3QgbWVzc2FnZSBvZiBjb252ZXJzYXRpb24ubWVzc2FnZXMpIHtcclxuICAgICAgY29uc3QgdGltZXN0YW1wID0gbmV3IERhdGUobWVzc2FnZS50aW1lc3RhbXApLnRvTG9jYWxlU3RyaW5nKCk7XHJcbiAgICAgIGNvbnN0IHJvbGUgPSBtZXNzYWdlLnJvbGUuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBtZXNzYWdlLnJvbGUuc2xpY2UoMSk7XHJcbiAgICAgIFxyXG4gICAgICBtYXJrZG93biArPSBgIyMjICR7cm9sZX0gKCR7dGltZXN0YW1wfSlcXG5cXG5gO1xyXG4gICAgICBtYXJrZG93biArPSBgJHttZXNzYWdlLmNvbnRlbnR9XFxuXFxuYDtcclxuICAgICAgXHJcbiAgICAgIC8vIEFkZCB0b29sIGNhbGxzIGlmIHByZXNlbnRcclxuICAgICAgaWYgKG1lc3NhZ2UudG9vbENhbGxzICYmIG1lc3NhZ2UudG9vbENhbGxzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICBtYXJrZG93biArPSBgKipUb29sIENhbGxzOioqXFxuXFxuYDtcclxuICAgICAgICBcclxuICAgICAgICBmb3IgKGNvbnN0IHRvb2xDYWxsIG9mIG1lc3NhZ2UudG9vbENhbGxzKSB7XHJcbiAgICAgICAgICBtYXJrZG93biArPSBgLSBUb29sOiAke3Rvb2xDYWxsLm5hbWV9XFxuYDtcclxuICAgICAgICAgIG1hcmtkb3duICs9IGAgIC0gQXJndW1lbnRzOiAke0pTT04uc3RyaW5naWZ5KHRvb2xDYWxsLmFyZ3VtZW50cywgbnVsbCwgMil9XFxuYDtcclxuICAgICAgICAgIG1hcmtkb3duICs9IGAgIC0gU3RhdHVzOiAke3Rvb2xDYWxsLnN0YXR1c31cXG5cXG5gO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgLy8gQWRkIHRvb2wgcmVzdWx0cyBpZiBwcmVzZW50XHJcbiAgICAgIGlmIChtZXNzYWdlLnRvb2xSZXN1bHRzICYmIG1lc3NhZ2UudG9vbFJlc3VsdHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIG1hcmtkb3duICs9IGAqKlRvb2wgUmVzdWx0czoqKlxcblxcbmA7XHJcbiAgICAgICAgXHJcbiAgICAgICAgZm9yIChjb25zdCB0b29sUmVzdWx0IG9mIG1lc3NhZ2UudG9vbFJlc3VsdHMpIHtcclxuICAgICAgICAgIG1hcmtkb3duICs9IGAtIFRvb2wgQ2FsbDogJHt0b29sUmVzdWx0LnRvb2xDYWxsSWR9XFxuYDtcclxuICAgICAgICAgIFxyXG4gICAgICAgICAgaWYgKHRvb2xSZXN1bHQuZXJyb3IpIHtcclxuICAgICAgICAgICAgbWFya2Rvd24gKz0gYCAgLSBFcnJvcjogJHt0b29sUmVzdWx0LmVycm9yfVxcblxcbmA7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBtYXJrZG93biArPSBgICAtIENvbnRlbnQ6ICR7SlNPTi5zdHJpbmdpZnkodG9vbFJlc3VsdC5jb250ZW50LCBudWxsLCAyKX1cXG5cXG5gO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gbWFya2Rvd247XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIGJhY2t1cCBvZiBhIGNvbnZlcnNhdGlvbiBpbiB0aGUgdmF1bHQuXHJcbiAgICogQHBhcmFtIGFwcCBPYnNpZGlhbiBhcHAgaW5zdGFuY2VcclxuICAgKiBAcGFyYW0gY29udmVyc2F0aW9uIENvbnZlcnNhdGlvbiB0byBiYWNrdXBcclxuICAgKiBAcGFyYW0gYmFja3VwRm9sZGVyIEZvbGRlciB0byBzdG9yZSBiYWNrdXBzXHJcbiAgICogQHJldHVybnMgUHJvbWlzZSB0aGF0IHJlc29sdmVzIHdpdGggdGhlIHBhdGggdG8gdGhlIGJhY2t1cCBmaWxlXHJcbiAgICovXHJcbiAgcHVibGljIHN0YXRpYyBhc3luYyBiYWNrdXBDb252ZXJzYXRpb24oXHJcbiAgICBhcHA6IEFwcCxcclxuICAgIGNvbnZlcnNhdGlvbjogQ29udmVyc2F0aW9uLFxyXG4gICAgYmFja3VwRm9sZGVyOiBzdHJpbmdcclxuICApOiBQcm9taXNlPHN0cmluZz4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgLy8gRW5zdXJlIGJhY2t1cCBmb2xkZXIgZXhpc3RzXHJcbiAgICAgIGxldCBmb2xkZXIgPSBhcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGJhY2t1cEZvbGRlcik7XHJcbiAgICAgIFxyXG4gICAgICBpZiAoIWZvbGRlcikge1xyXG4gICAgICAgIGF3YWl0IGFwcC52YXVsdC5jcmVhdGVGb2xkZXIoYmFja3VwRm9sZGVyKTtcclxuICAgICAgfSBlbHNlIGlmICghKGZvbGRlciBpbnN0YW5jZW9mIFRGb2xkZXIpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke2JhY2t1cEZvbGRlcn0gZXhpc3RzIGJ1dCBpcyBub3QgYSBmb2xkZXJgKTtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgLy8gQ3JlYXRlIGJhY2t1cCBmaWxlbmFtZVxyXG4gICAgICBjb25zdCB0aW1lc3RhbXAgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkucmVwbGFjZSgvWzouXS9nLCAnLScpO1xyXG4gICAgICBjb25zdCBzYWZlVGl0bGUgPSB0aGlzLnNhbml0aXplRmlsZW5hbWUoY29udmVyc2F0aW9uLnRpdGxlKTtcclxuICAgICAgY29uc3QgZmlsZW5hbWUgPSBgJHtiYWNrdXBGb2xkZXJ9LyR7c2FmZVRpdGxlfS0ke3RpbWVzdGFtcH0uanNvbmA7XHJcbiAgICAgIFxyXG4gICAgICAvLyBDcmVhdGUgYmFja3VwIGZpbGVcclxuICAgICAgYXdhaXQgYXBwLnZhdWx0LmNyZWF0ZShmaWxlbmFtZSwgSlNPTi5zdHJpbmdpZnkoY29udmVyc2F0aW9uLCBudWxsLCAyKSk7XHJcbiAgICAgIFxyXG4gICAgICByZXR1cm4gZmlsZW5hbWU7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gYmFja3VwIGNvbnZlcnNhdGlvbjogJHtlcnJvcn1gKTtcclxuICAgICAgdGhyb3cgZXJyb3I7XHJcbiAgICB9XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIEV4cG9ydCBhIGNvbnZlcnNhdGlvbiB0byBhbiBleHRlcm5hbCBmaWxlLlxyXG4gICAqIEBwYXJhbSBhcHAgT2JzaWRpYW4gYXBwIGluc3RhbmNlXHJcbiAgICogQHBhcmFtIGNvbnZlcnNhdGlvbiBDb252ZXJzYXRpb24gdG8gZXhwb3J0XHJcbiAgICogQHBhcmFtIGZvcm1hdCBFeHBvcnQgZm9ybWF0ICgnanNvbicgb3IgJ21hcmtkb3duJylcclxuICAgKiBAcmV0dXJucyBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiB0aGUgZXhwb3J0IGlzIGNvbXBsZXRlXHJcbiAgICovXHJcbiAgcHVibGljIHN0YXRpYyBhc3luYyBleHBvcnRDb252ZXJzYXRpb24oXHJcbiAgICBhcHA6IEFwcCxcclxuICAgIGNvbnZlcnNhdGlvbjogQ29udmVyc2F0aW9uLFxyXG4gICAgZm9ybWF0OiAnanNvbicgfCAnbWFya2Rvd24nXHJcbiAgKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICB0cnkge1xyXG4gICAgICAvLyBDcmVhdGUgZmlsZW5hbWVcclxuICAgICAgY29uc3Qgc2FmZVRpdGxlID0gdGhpcy5zYW5pdGl6ZUZpbGVuYW1lKGNvbnZlcnNhdGlvbi50aXRsZSk7XHJcbiAgICAgIGNvbnN0IGV4dGVuc2lvbiA9IGZvcm1hdCA9PT0gJ2pzb24nID8gJ2pzb24nIDogJ21kJztcclxuICAgICAgXHJcbiAgICAgIC8vIENyZWF0ZSBjb250ZW50XHJcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBmb3JtYXQgPT09ICdqc29uJ1xyXG4gICAgICAgID8gSlNPTi5zdHJpbmdpZnkoY29udmVyc2F0aW9uLCBudWxsLCAyKVxyXG4gICAgICAgIDogdGhpcy5jb252ZXJzYXRpb25Ub01hcmtkb3duKGNvbnZlcnNhdGlvbik7XHJcbiAgICAgIFxyXG4gICAgICAvLyBVc2UgT2JzaWRpYW4ncyBGaWxlTWFuYWdlciB0byBjcmVhdGUgYSBuZXcgZmlsZVxyXG4gICAgICBpZiAoZm9ybWF0ID09PSAnbWFya2Rvd24nKSB7XHJcbiAgICAgICAgYXdhaXQgYXBwLmZpbGVNYW5hZ2VyLmNyZWF0ZU5ld01hcmtkb3duRmlsZShcclxuICAgICAgICAgIG51bGwsIC8vIFVzZXMgZGVmYXVsdCBsb2NhdGlvbiBmcm9tIE9ic2lkaWFuIHNldHRpbmdzXHJcbiAgICAgICAgICBzYWZlVGl0bGUsXHJcbiAgICAgICAgICBjb250ZW50XHJcbiAgICAgICAgKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBGb3IgSlNPTiwgd2UgbmVlZCB0byB1c2UgdGhlIHZhdWx0IEFQSSBkaXJlY3RseVxyXG4gICAgICAgIC8vIENyZWF0ZSBhIHRlbXBvcmFyeSBmaWxlIGZpcnN0LCB0aGVuIGxldCB0aGUgdXNlciBzYXZlIGl0XHJcbiAgICAgICAgY29uc3QgdGVtcFBhdGggPSBgJHtzYWZlVGl0bGV9LiR7ZXh0ZW5zaW9ufWA7XHJcbiAgICAgICAgY29uc3QgZmlsZSA9IGF3YWl0IGFwcC52YXVsdC5jcmVhdGUodGVtcFBhdGgsIGNvbnRlbnQpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIE9wZW4gdGhlIGZpbGVcclxuICAgICAgICBhd2FpdCBhcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChmaWxlLnBhdGgsICcnLCB0cnVlKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBTaG93IGEgbm90aWNlXHJcbiAgICAgICAgbmV3IE5vdGljZShgRXhwb3J0ZWQgdG8gJHtmaWxlLnBhdGh9YCk7XHJcbiAgICAgIH1cclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoYEZhaWxlZCB0byBleHBvcnQgY29udmVyc2F0aW9uOiAke2Vycm9yfWApO1xyXG4gICAgICB0aHJvdyBuZXcgSW1wb3J0RXhwb3J0RXJyb3IoZXJyb3IubWVzc2FnZSk7XHJcbiAgICB9XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIFBhcnNlIE1hcmtkb3duIGludG8gYSBjb252ZXJzYXRpb24uXHJcbiAgICogQHBhcmFtIG1hcmtkb3duIE1hcmtkb3duIGNvbnRlbnRcclxuICAgKiBAcmV0dXJucyBQYXJzZWQgY29udmVyc2F0aW9uXHJcbiAgICovXHJcbiAgcHVibGljIHN0YXRpYyBwYXJzZU1hcmtkb3duVG9Db252ZXJzYXRpb24obWFya2Rvd246IHN0cmluZyk6IENvbnZlcnNhdGlvbiB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBsaW5lcyA9IG1hcmtkb3duLnNwbGl0KCdcXG4nKTtcclxuICAgICAgY29uc3QgY29udmVyc2F0aW9uOiBDb252ZXJzYXRpb24gPSB7XHJcbiAgICAgICAgaWQ6IHRoaXMuZ2VuZXJhdGVJZCgpLFxyXG4gICAgICAgIHRpdGxlOiAnSW1wb3J0ZWQgQ29udmVyc2F0aW9uJyxcclxuICAgICAgICBjcmVhdGVkQXQ6IERhdGUubm93KCksXHJcbiAgICAgICAgbW9kaWZpZWRBdDogRGF0ZS5ub3coKSxcclxuICAgICAgICBtZXNzYWdlczogW11cclxuICAgICAgfTtcclxuICAgICAgXHJcbiAgICAgIC8vIEV4dHJhY3QgZnJvbnQgbWF0dGVyXHJcbiAgICAgIGxldCBpbkZyb250TWF0dGVyID0gZmFsc2U7XHJcbiAgICAgIGxldCBmcm9udE1hdHRlckxpbmVzOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgICBcclxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIGNvbnN0IGxpbmUgPSBsaW5lc1tpXTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAobGluZS50cmltKCkgPT09ICctLS0nKSB7XHJcbiAgICAgICAgICBpZiAoIWluRnJvbnRNYXR0ZXIpIHtcclxuICAgICAgICAgICAgaW5Gcm9udE1hdHRlciA9IHRydWU7XHJcbiAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgaW5Gcm9udE1hdHRlciA9IGZhbHNlO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGluRnJvbnRNYXR0ZXIpIHtcclxuICAgICAgICAgIGZyb250TWF0dGVyTGluZXMucHVzaChsaW5lKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIC8vIFBhcnNlIGZyb250IG1hdHRlclxyXG4gICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgZnJvbnRNYXR0ZXJMaW5lcykge1xyXG4gICAgICAgIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaCgvXihbXjpdKyk6XFxzKiguKykkLyk7XHJcbiAgICAgICAgaWYgKG1hdGNoKSB7XHJcbiAgICAgICAgICBjb25zdCBbLCBrZXksIHZhbHVlXSA9IG1hdGNoO1xyXG4gICAgICAgICAgXHJcbiAgICAgICAgICBzd2l0Y2ggKGtleS50cmltKCkpIHtcclxuICAgICAgICAgICAgY2FzZSAndGl0bGUnOlxyXG4gICAgICAgICAgICAgIGNvbnZlcnNhdGlvbi50aXRsZSA9IHZhbHVlLnRyaW0oKTtcclxuICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSAnY3JlYXRlZCc6XHJcbiAgICAgICAgICAgICAgY29udmVyc2F0aW9uLmNyZWF0ZWRBdCA9IG5ldyBEYXRlKHZhbHVlLnRyaW0oKSkuZ2V0VGltZSgpO1xyXG4gICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlICdtb2RpZmllZCc6XHJcbiAgICAgICAgICAgICAgY29udmVyc2F0aW9uLm1vZGlmaWVkQXQgPSBuZXcgRGF0ZSh2YWx1ZS50cmltKCkpLmdldFRpbWUoKTtcclxuICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSAnaWQnOlxyXG4gICAgICAgICAgICAgIGNvbnZlcnNhdGlvbi5pZCA9IHZhbHVlLnRyaW0oKTtcclxuICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAvLyBTdG9yZSBvdGhlciBtZXRhZGF0YVxyXG4gICAgICAgICAgICAgIGlmICghY29udmVyc2F0aW9uLm1ldGFkYXRhKSB7XHJcbiAgICAgICAgICAgICAgICBjb252ZXJzYXRpb24ubWV0YWRhdGEgPSB7fTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgY29udmVyc2F0aW9uLm1ldGFkYXRhW2tleS50cmltKCldID0gdmFsdWUudHJpbSgpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgLy8gRXh0cmFjdCB0aXRsZSBmcm9tIGZpcnN0IGhlYWRpbmcgaWYgbm90IGluIGZyb250IG1hdHRlclxyXG4gICAgICBpZiAoY29udmVyc2F0aW9uLnRpdGxlID09PSAnSW1wb3J0ZWQgQ29udmVyc2F0aW9uJykge1xyXG4gICAgICAgIGNvbnN0IHRpdGxlTWF0Y2ggPSBtYXJrZG93bi5tYXRjaCgvXiMgKC4rKSQvbSk7XHJcbiAgICAgICAgaWYgKHRpdGxlTWF0Y2gpIHtcclxuICAgICAgICAgIGNvbnZlcnNhdGlvbi50aXRsZSA9IHRpdGxlTWF0Y2hbMV07XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICAvLyBQcm9jZXNzIG1lc3NhZ2VzXHJcbiAgICAgIGxldCBjdXJyZW50Um9sZTogTWVzc2FnZVJvbGUgfCBudWxsID0gbnVsbDtcclxuICAgICAgbGV0IGN1cnJlbnRDb250ZW50ID0gJyc7XHJcbiAgICAgIGxldCBjdXJyZW50TWVzc2FnZTogUGFydGlhbDxNZXNzYWdlPiB8IG51bGwgPSBudWxsO1xyXG4gICAgICBsZXQgY3VycmVudFRvb2xDYWxsczogVG9vbENhbGxbXSA9IFtdO1xyXG4gICAgICBsZXQgY3VycmVudFRvb2xSZXN1bHRzOiBUb29sUmVzdWx0W10gPSBbXTtcclxuICAgICAgXHJcbiAgICAgIC8vIFNraXAgZnJvbnQgbWF0dGVyIGluIHByb2Nlc3NpbmdcclxuICAgICAgY29uc3QgY29udGVudExpbmVzID0gaW5Gcm9udE1hdHRlciA/IGxpbmVzLnNsaWNlKGZyb250TWF0dGVyTGluZXMubGVuZ3RoICsgMikgOiBsaW5lcztcclxuICAgICAgXHJcbiAgICAgIGZvciAoY29uc3QgbGluZSBvZiBjb250ZW50TGluZXMpIHtcclxuICAgICAgICBjb25zdCByb2xlTWF0Y2ggPSBsaW5lLm1hdGNoKC9eIyMjIChVc2VyfEFzc2lzdGFudHxTeXN0ZW0pL2kpO1xyXG4gICAgICAgIGNvbnN0IHRvb2xDYWxsc01hdGNoID0gbGluZS5tYXRjaCgvXlxcKlxcKlRvb2wgQ2FsbHM6XFwqXFwqJC8pO1xyXG4gICAgICAgIGNvbnN0IHRvb2xSZXN1bHRzTWF0Y2ggPSBsaW5lLm1hdGNoKC9eXFwqXFwqVG9vbCBSZXN1bHRzOlxcKlxcKiQvKTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAocm9sZU1hdGNoKSB7XHJcbiAgICAgICAgICAvLyBTYXZlIHByZXZpb3VzIG1lc3NhZ2UgaWYgZXhpc3RzXHJcbiAgICAgICAgICBpZiAoY3VycmVudE1lc3NhZ2UgJiYgY3VycmVudFJvbGUpIHtcclxuICAgICAgICAgICAgY29udmVyc2F0aW9uLm1lc3NhZ2VzLnB1c2goe1xyXG4gICAgICAgICAgICAgIGlkOiB0aGlzLmdlbmVyYXRlSWQoKSxcclxuICAgICAgICAgICAgICByb2xlOiBjdXJyZW50Um9sZSxcclxuICAgICAgICAgICAgICBjb250ZW50OiBjdXJyZW50Q29udGVudC50cmltKCksXHJcbiAgICAgICAgICAgICAgdGltZXN0YW1wOiBEYXRlLm5vdygpIC0gKGNvbnZlcnNhdGlvbi5tZXNzYWdlcy5sZW5ndGggKiAxMDAwKSxcclxuICAgICAgICAgICAgICB0b29sQ2FsbHM6IGN1cnJlbnRUb29sQ2FsbHMubGVuZ3RoID4gMCA/IGN1cnJlbnRUb29sQ2FsbHMgOiB1bmRlZmluZWQsXHJcbiAgICAgICAgICAgICAgdG9vbFJlc3VsdHM6IGN1cnJlbnRUb29sUmVzdWx0cy5sZW5ndGggPiAwID8gY3VycmVudFRvb2xSZXN1bHRzIDogdW5kZWZpbmVkXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgXHJcbiAgICAgICAgICAvLyBTdGFydCBuZXcgbWVzc2FnZVxyXG4gICAgICAgICAgY3VycmVudFJvbGUgPSByb2xlTWF0Y2hbMV0udG9Mb3dlckNhc2UoKSBhcyBNZXNzYWdlUm9sZTtcclxuICAgICAgICAgIGN1cnJlbnRDb250ZW50ID0gJyc7XHJcbiAgICAgICAgICBjdXJyZW50TWVzc2FnZSA9IHsgcm9sZTogY3VycmVudFJvbGUgfTtcclxuICAgICAgICAgIGN1cnJlbnRUb29sQ2FsbHMgPSBbXTtcclxuICAgICAgICAgIGN1cnJlbnRUb29sUmVzdWx0cyA9IFtdO1xyXG4gICAgICAgIH0gZWxzZSBpZiAodG9vbENhbGxzTWF0Y2gpIHtcclxuICAgICAgICAgIC8vIFdlJ3JlIG5vdyBwYXJzaW5nIHRvb2wgY2FsbHNcclxuICAgICAgICAgIC8vIFRoZSBjb250ZW50IGJlZm9yZSB0aGlzIHBvaW50IGlzIHRoZSBtZXNzYWdlIGNvbnRlbnRcclxuICAgICAgICAgIGN1cnJlbnRDb250ZW50ID0gY3VycmVudENvbnRlbnQudHJpbSgpO1xyXG4gICAgICAgIH0gZWxzZSBpZiAodG9vbFJlc3VsdHNNYXRjaCkge1xyXG4gICAgICAgICAgLy8gV2UncmUgbm93IHBhcnNpbmcgdG9vbCByZXN1bHRzXHJcbiAgICAgICAgfSBlbHNlIGlmIChjdXJyZW50TWVzc2FnZSkge1xyXG4gICAgICAgICAgLy8gQWRkIGxpbmUgdG8gY3VycmVudCBtZXNzYWdlXHJcbiAgICAgICAgICBjdXJyZW50Q29udGVudCArPSBsaW5lICsgJ1xcbic7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICAvLyBBZGQgZmluYWwgbWVzc2FnZSBpZiBleGlzdHNcclxuICAgICAgaWYgKGN1cnJlbnRNZXNzYWdlICYmIGN1cnJlbnRSb2xlKSB7XHJcbiAgICAgICAgY29udmVyc2F0aW9uLm1lc3NhZ2VzLnB1c2goe1xyXG4gICAgICAgICAgaWQ6IHRoaXMuZ2VuZXJhdGVJZCgpLFxyXG4gICAgICAgICAgcm9sZTogY3VycmVudFJvbGUsXHJcbiAgICAgICAgICBjb250ZW50OiBjdXJyZW50Q29udGVudC50cmltKCksXHJcbiAgICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KCkgLSAoY29udmVyc2F0aW9uLm1lc3NhZ2VzLmxlbmd0aCAqIDEwMDApLFxyXG4gICAgICAgICAgdG9vbENhbGxzOiBjdXJyZW50VG9vbENhbGxzLmxlbmd0aCA+IDAgPyBjdXJyZW50VG9vbENhbGxzIDogdW5kZWZpbmVkLFxyXG4gICAgICAgICAgdG9vbFJlc3VsdHM6IGN1cnJlbnRUb29sUmVzdWx0cy5sZW5ndGggPiAwID8gY3VycmVudFRvb2xSZXN1bHRzIDogdW5kZWZpbmVkXHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIHJldHVybiBjb252ZXJzYXRpb247XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gcGFyc2UgTWFya2Rvd24gdG8gY29udmVyc2F0aW9uOiAke2Vycm9yfWApO1xyXG4gICAgICB0aHJvdyBuZXcgSW1wb3J0RXhwb3J0RXJyb3IoYEZhaWxlZCB0byBwYXJzZSBNYXJrZG93bjogJHtlcnJvci5tZXNzYWdlfWApO1xyXG4gICAgfVxyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBQYXJzZSBKU09OIGludG8gYSBjb252ZXJzYXRpb24uXHJcbiAgICogQHBhcmFtIGpzb24gSlNPTiBzdHJpbmdcclxuICAgKiBAcmV0dXJucyBQYXJzZWQgY29udmVyc2F0aW9uXHJcbiAgICovXHJcbiAgcHVibGljIHN0YXRpYyBwYXJzZUpzb25Ub0NvbnZlcnNhdGlvbihqc29uOiBzdHJpbmcpOiBDb252ZXJzYXRpb24ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShqc29uKTtcclxuICAgICAgXHJcbiAgICAgIC8vIFZhbGlkYXRlIGJhc2ljIHN0cnVjdHVyZVxyXG4gICAgICBpZiAoIXBhcnNlZC5pZCB8fCAhcGFyc2VkLnRpdGxlIHx8ICFBcnJheS5pc0FycmF5KHBhcnNlZC5tZXNzYWdlcykpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29udmVyc2F0aW9uIGZvcm1hdDogbWlzc2luZyByZXF1aXJlZCBmaWVsZHMnKTtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgLy8gRW5zdXJlIGFsbCByZXF1aXJlZCBmaWVsZHMgYXJlIHByZXNlbnRcclxuICAgICAgY29uc3QgY29udmVyc2F0aW9uOiBDb252ZXJzYXRpb24gPSB7XHJcbiAgICAgICAgaWQ6IHBhcnNlZC5pZCxcclxuICAgICAgICB0aXRsZTogcGFyc2VkLnRpdGxlLFxyXG4gICAgICAgIGNyZWF0ZWRBdDogcGFyc2VkLmNyZWF0ZWRBdCB8fCBEYXRlLm5vdygpLFxyXG4gICAgICAgIG1vZGlmaWVkQXQ6IHBhcnNlZC5tb2RpZmllZEF0IHx8IERhdGUubm93KCksXHJcbiAgICAgICAgbWVzc2FnZXM6IHBhcnNlZC5tZXNzYWdlcy5tYXAoKG1zZzogYW55KSA9PiAoe1xyXG4gICAgICAgICAgaWQ6IG1zZy5pZCB8fCB0aGlzLmdlbmVyYXRlSWQoKSxcclxuICAgICAgICAgIHJvbGU6IG1zZy5yb2xlLFxyXG4gICAgICAgICAgY29udGVudDogbXNnLmNvbnRlbnQsXHJcbiAgICAgICAgICB0aW1lc3RhbXA6IG1zZy50aW1lc3RhbXAgfHwgRGF0ZS5ub3coKSxcclxuICAgICAgICAgIHRvb2xDYWxsczogbXNnLnRvb2xDYWxscyxcclxuICAgICAgICAgIHRvb2xSZXN1bHRzOiBtc2cudG9vbFJlc3VsdHNcclxuICAgICAgICB9KSksXHJcbiAgICAgICAgbWV0YWRhdGE6IHBhcnNlZC5tZXRhZGF0YVxyXG4gICAgICB9O1xyXG4gICAgICBcclxuICAgICAgcmV0dXJuIGNvbnZlcnNhdGlvbjtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoYEZhaWxlZCB0byBwYXJzZSBKU09OIHRvIGNvbnZlcnNhdGlvbjogJHtlcnJvcn1gKTtcclxuICAgICAgdGhyb3cgbmV3IEpzb25QYXJzZUVycm9yKGVycm9yLm1lc3NhZ2UpO1xyXG4gICAgfVxyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBTYW5pdGl6ZSBhIGZpbGVuYW1lIHRvIGJlIHNhZmUgZm9yIGZpbGUgc3lzdGVtcy5cclxuICAgKiBAcGFyYW0gZmlsZW5hbWUgRmlsZW5hbWUgdG8gc2FuaXRpemVcclxuICAgKiBAcmV0dXJucyBTYW5pdGl6ZWQgZmlsZW5hbWVcclxuICAgKi9cclxuICBwdWJsaWMgc3RhdGljIHNhbml0aXplRmlsZW5hbWUoZmlsZW5hbWU6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gZmlsZW5hbWVcclxuICAgICAgLnJlcGxhY2UoL1teYS16QS1aMC05XS9nLCAnLScpIC8vIFJlcGxhY2Ugbm9uLWFscGhhbnVtZXJpYyB3aXRoIGh5cGhlbnNcclxuICAgICAgLnJlcGxhY2UoLy0tKy9nLCAnLScpICAgICAgICAgIC8vIFJlcGxhY2UgbXVsdGlwbGUgaHlwaGVucyB3aXRoIHNpbmdsZSBoeXBoZW5cclxuICAgICAgLnJlcGxhY2UoL14tfC0kL2csICcnKSAgICAgICAgIC8vIFJlbW92ZSBsZWFkaW5nL3RyYWlsaW5nIGh5cGhlbnNcclxuICAgICAgLnNsaWNlKDAsIDUwKTsgICAgICAgICAgICAgICAgIC8vIExpbWl0IGxlbmd0aFxyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBHZW5lcmF0ZSBhIHVuaXF1ZSBJRC5cclxuICAgKiBAcmV0dXJucyBBIHVuaXF1ZSBJRFxyXG4gICAqL1xyXG4gIHB1YmxpYyBzdGF0aWMgZ2VuZXJhdGVJZCgpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIERhdGUubm93KCkudG9TdHJpbmcoMzYpICsgTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc3Vic3RyaW5nKDIsIDkpO1xyXG4gIH1cclxufVxyXG4iXX0=