import { MarkdownRenderer } from 'obsidian';
import { ToolExecutionResult } from '../interfaces';

/**
 * Output format options for tool results
 */
export type ResultFormat = 'json' | 'text' | 'markdown';

/**
 * Result formatter for tool outputs
 * Handles standardized formatting of tool execution results
 */
export class ResultFormatter {
  /**
   * Format a tool execution result
   * @param result - Tool execution result
   * @param format - Output format
   * @returns Formatted result string
   */
  public static format(result: ToolExecutionResult, format: ResultFormat = 'json'): string {
    // Handle error results first
    if (result.status === 'error') {
      return this.formatError(result, format);
    }
    
    // Format based on requested format
    switch (format) {
      case 'text':
        return this.formatAsText(result);
      case 'markdown':
        return this.formatAsMarkdown(result);
      case 'json':
      default:
        return this.formatAsJson(result);
    }
  }
  
  /**
   * Format an error result
   * @param result - Error result
   * @param format - Output format
   * @returns Formatted error string
   */
  private static formatError(result: ToolExecutionResult, format: ResultFormat): string {
    const errorMessage = result.error || 'Unknown error';
    const metadata = result.metadata || {};
    
    switch (format) {
      case 'text':
        return `Error: ${errorMessage}\n` +
          (metadata.errorType ? `Type: ${metadata.errorType}\n` : '') +
          (metadata.executionTime ? `Time: ${metadata.executionTime}ms` : '');
      
      case 'markdown':
        return `**Error**: ${errorMessage}\n\n` +
          (metadata.errorType ? `*Type*: \`${metadata.errorType}\`\n` : '') +
          (metadata.executionTime ? `*Time*: \`${metadata.executionTime}ms\`` : '');
      
      case 'json':
      default:
        return JSON.stringify({
          error: errorMessage,
          metadata
        }, null, 2);
    }
  }
  
  /**
   * Format result as JSON
   * @param result - Tool execution result
   * @returns JSON string
   */
  private static formatAsJson(result: ToolExecutionResult): string {
    return JSON.stringify({
      data: result.data,
      metadata: result.metadata
    }, null, 2);
  }
  
  /**
   * Format result as plain text
   * @param result - Tool execution result
   * @returns Plain text string
   */
  private static formatAsText(result: ToolExecutionResult): string {
    const { data } = result;
    
    if (typeof data === 'string') {
      return data;
    }
    
    if (typeof data === 'number' || typeof data === 'boolean') {
      return String(data);
    }
    
    if (Array.isArray(data)) {
      return data.map(item => {
        if (typeof item === 'object') {
          return JSON.stringify(item, null, 2);
        }
        return String(item);
      }).join('\n');
    }
    
    if (typeof data === 'object' && data !== null) {
      return Object.entries(data)
        .map(([key, value]) => {
          const valueStr = typeof value === 'object' 
            ? JSON.stringify(value, null, 2)
            : String(value);
          return `${key}: ${valueStr}`;
        })
        .join('\n');
    }
    
    return String(data);
  }
  
  /**
   * Format result as markdown
   * @param result - Tool execution result
   * @returns Markdown string
   */
  private static formatAsMarkdown(result: ToolExecutionResult): string {
    const { data } = result;
    
    if (typeof data === 'string') {
      return data;
    }
    
    if (typeof data === 'number' || typeof data === 'boolean') {
      return String(data);
    }
    
    if (Array.isArray(data)) {
      // Handle empty array
      if (data.length === 0) {
        return '_No items_';
      }
      
      // Format array as table if it contains objects
      if (typeof data[0] === 'object') {
        const keys = Object.keys(data[0]);
        
        // Table header
        let markdown = '| ' + keys.join(' | ') + ' |\n';
        markdown += '|' + keys.map(() => '---').join('|') + '|\n';
        
        // Table rows
        for (const item of data) {
          markdown += '| ' + keys.map(key => {
            const value = item[key];
            return typeof value === 'object' 
              ? '`' + JSON.stringify(value) + '`'
              : String(value);
          }).join(' | ') + ' |\n';
        }
        
        return markdown;
      }
      
      // Format array as list for primitive values
      return data.map(item => `- ${String(item)}`).join('\n');
    }
    
    if (typeof data === 'object' && data !== null) {
      return Object.entries(data)
        .map(([key, value]) => {
          const valueStr = typeof value === 'object'
            ? '```json\n' + JSON.stringify(value, null, 2) + '\n```'
            : String(value);
          return `**${key}**: ${valueStr}`;
        })
        .join('\n\n');
    }
    
    return String(data);
  }
  
  /**
   * Detect best format for a result
   * @param result - Tool execution result
   * @returns Detected format
   */
  public static detectFormat(result: ToolExecutionResult): ResultFormat {
    const { data } = result;
    
    // If data contains markdown-specific characters, suggest markdown
    if (typeof data === 'string' && (
      data.includes('**') || 
      data.includes('__') ||
      data.includes('```') ||
      data.includes('> ') ||
      data.includes('- ') ||
      data.includes('# ')
    )) {
      return 'markdown';
    }
    
    // If data is an array of objects, suggest markdown for table formatting
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
      return 'markdown';
    }
    
    // If data is a complex object, suggest JSON
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      return 'json';
    }
    
    // Default to text for simple values
    return 'text';
  }
}
