/**
 * Utility functions for the storage system.
 * 
 * This file provides helper functions for common storage tasks such as
 * converting conversations to Markdown, handling backups, and parsing
 * Markdown into conversations.
 */

import { App, TFile, TFolder, Notice } from '../utils/obsidian-imports';
import { Conversation, Message, MessageRole, ToolCall, ToolResult } from '../models/Conversation';
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
  public static conversationToMarkdown(conversation: Conversation): string {
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
        } else if (Array.isArray(value)) {
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
          } else {
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
  public static async backupConversation(
    app: App,
    conversation: Conversation,
    backupFolder: string
  ): Promise<string> {
    try {
      // Ensure backup folder exists
      let folder = app.vault.getAbstractFileByPath(backupFolder);
      
      if (!folder) {
        await app.vault.createFolder(backupFolder);
      } else if (!(folder instanceof TFolder)) {
        throw new Error(`${backupFolder} exists but is not a folder`);
      }
      
      // Create backup filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safeTitle = this.sanitizeFilename(conversation.title);
      const filename = `${backupFolder}/${safeTitle}-${timestamp}.json`;
      
      // Create backup file
      await app.vault.create(filename, JSON.stringify(conversation, null, 2));
      
      return filename;
    } catch (error) {
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
  public static async exportConversation(
    app: App,
    conversation: Conversation,
    format: 'json' | 'markdown'
  ): Promise<void> {
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
        await app.fileManager.createNewMarkdownFile(
          null, // Uses default location from Obsidian settings
          safeTitle,
          content
        );
      } else {
        // For JSON, we need to use the vault API directly
        // Create a temporary file first, then let the user save it
        const tempPath = `${safeTitle}.${extension}`;
        const file = await app.vault.create(tempPath, content);
        
        // Open the file
        await app.workspace.openLinkText(file.path, '', true);
        
        // Show a notice
        new Notice(`Exported to ${file.path}`);
      }
    } catch (error) {
      console.error(`Failed to export conversation: ${error}`);
      throw new ImportExportError(error.message);
    }
  }
  
  /**
   * Parse Markdown into a conversation.
   * @param markdown Markdown content
   * @returns Parsed conversation
   */
  public static parseMarkdownToConversation(markdown: string): Conversation {
    try {
      const lines = markdown.split('\n');
      const conversation: Conversation = {
        id: this.generateId(),
        title: 'Imported Conversation',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        messages: []
      };
      
      // Extract front matter
      let inFrontMatter = false;
      let frontMatterLines: string[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.trim() === '---') {
          if (!inFrontMatter) {
            inFrontMatter = true;
            continue;
          } else {
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
      let currentRole: MessageRole | null = null;
      let currentContent = '';
      let currentMessage: Partial<Message> | null = null;
      let currentToolCalls: ToolCall[] = [];
      let currentToolResults: ToolResult[] = [];
      
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
          currentRole = roleMatch[1].toLowerCase() as MessageRole;
          currentContent = '';
          currentMessage = { role: currentRole };
          currentToolCalls = [];
          currentToolResults = [];
        } else if (toolCallsMatch) {
          // We're now parsing tool calls
          // The content before this point is the message content
          currentContent = currentContent.trim();
        } else if (toolResultsMatch) {
          // We're now parsing tool results
        } else if (currentMessage) {
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
    } catch (error) {
      console.error(`Failed to parse Markdown to conversation: ${error}`);
      throw new ImportExportError(`Failed to parse Markdown: ${error.message}`);
    }
  }
  
  /**
   * Parse JSON into a conversation.
   * @param json JSON string
   * @returns Parsed conversation
   */
  public static parseJsonToConversation(json: string): Conversation {
    try {
      const parsed = JSON.parse(json);
      
      // Validate basic structure
      if (!parsed.id || !parsed.title || !Array.isArray(parsed.messages)) {
        throw new Error('Invalid conversation format: missing required fields');
      }
      
      // Ensure all required fields are present
      const conversation: Conversation = {
        id: parsed.id,
        title: parsed.title,
        createdAt: parsed.createdAt || Date.now(),
        modifiedAt: parsed.modifiedAt || Date.now(),
        messages: parsed.messages.map((msg: any) => ({
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
    } catch (error) {
      console.error(`Failed to parse JSON to conversation: ${error}`);
      throw new JsonParseError(error.message);
    }
  }
  
  /**
   * Sanitize a filename to be safe for file systems.
   * @param filename Filename to sanitize
   * @returns Sanitized filename
   */
  public static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9]/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/--+/g, '-')          // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, '')         // Remove leading/trailing hyphens
      .slice(0, 50);                 // Limit length
  }
  
  /**
   * Generate a unique ID.
   * @returns A unique ID
   */
  public static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  }
}
