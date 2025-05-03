---
title: Phase 3.7 - Tool Call Visualization
description: Implementing visualization for tool calls and their results within messages
date: 2025-05-03
status: planning
tags:
  - implementation
  - phase3
  - ui
  - tool-calls
  - visualization
  - chat-interface
---

# Phase 3.7: Tool Call Visualization

## Overview

This microphase focuses on creating UI components for visualizing tool calls within messages in the Chatsidian chat interface. Tool calls are a key feature of the Model Context Protocol (MCP), allowing the AI to interact with the Obsidian environment through various tools.

The visualization will provide a clear and intuitive way for users to understand what tools the AI is using, what arguments it's providing, and what results are being returned. This includes status indicators, collapsible sections, and proper formatting for code and structured data.

## Implementation Details


### ToolCallComponent

The core of this microphase is the `ToolCallComponent` for rendering tool calls within messages:

```typescript
// src/ui/ToolCallComponent.ts
import { setIcon, MarkdownRenderer, MarkdownView } from 'obsidian';
import { ToolCall, ToolResult } from '../models/Conversation';

export class ToolCallComponent {
  private containerEl: HTMLElement;
  private toolCall: ToolCall;
  private toolResult: ToolResult | null;
  private app: App;
  private isExpanded: boolean = false;
  
  constructor(containerEl: HTMLElement, toolCall: ToolCall, toolResult: ToolResult | null, app: App) {
    this.containerEl = containerEl;
    this.toolCall = toolCall;
    this.toolResult = toolResult;
    this.app = app;
    
    // Initialize UI
    this.render();
  }
  
  private render(): void {
    // Clear container
    this.containerEl.empty();
    this.containerEl.addClass('chatsidian-tool-call');
    this.containerEl.addClass(`chatsidian-tool-call-${this.toolCall.status}`);
    
    // Create header
    const headerEl = this.containerEl.createDiv({
      cls: 'chatsidian-tool-call-header'
    });
    
    // Add tool icon based on name
    const iconEl = headerEl.createDiv({
      cls: 'chatsidian-tool-call-icon'
    });
    
    // Set appropriate icon based on tool name
    if (this.toolCall.name.includes('read') || this.toolCall.name.includes('search')) {
      setIcon(iconEl, 'search');
    } else if (this.toolCall.name.includes('edit') || this.toolCall.name.includes('write')) {
      setIcon(iconEl, 'pencil');
    } else if (this.toolCall.name.includes('delete')) {
      setIcon(iconEl, 'trash');
    } else if (this.toolCall.name.includes('folder')) {
      setIcon(iconEl, 'folder');
    } else if (this.toolCall.name.includes('command')) {
      setIcon(iconEl, 'terminal-square');
    } else if (this.toolCall.name.includes('project')) {
      setIcon(iconEl, 'kanban');
    } else {
      setIcon(iconEl, 'tool');
    }
    
    // Add tool name
    headerEl.createDiv({
      cls: 'chatsidian-tool-call-name',
      text: this.formatToolName(this.toolCall.name)
    });
    
    // Add status indicator
    const statusEl = headerEl.createDiv({
      cls: `chatsidian-tool-call-status chatsidian-tool-call-status-${this.toolCall.status}`
    });
    
    // Set status text and icon
    if (this.toolCall.status === 'pending') {
      statusEl.textContent = 'Pending';
      setIcon(statusEl, 'clock');
    } else if (this.toolCall.status === 'running') {
      statusEl.textContent = 'Running';
      setIcon(statusEl, 'loader');
    } else if (this.toolCall.status === 'done') {
      statusEl.textContent = 'Completed';
      setIcon(statusEl, 'check');
    } else if (this.toolCall.status === 'error') {
      statusEl.textContent = 'Error';
      setIcon(statusEl, 'alert-triangle');
    }
    
    // Add toggle button
    const toggleEl = headerEl.createDiv({
      cls: 'chatsidian-tool-call-toggle'
    });
    setIcon(toggleEl, this.isExpanded ? 'chevron-up' : 'chevron-down');
    
    // Add toggle functionality
    headerEl.addEventListener('click', () => {
      this.toggleExpanded();
      setIcon(toggleEl, this.isExpanded ? 'chevron-up' : 'chevron-down');
    });
    
    // Create content container
    const contentEl = this.containerEl.createDiv({
      cls: 'chatsidian-tool-call-content'
    });
    
    // Set initial visibility
    contentEl.style.display = this.isExpanded ? 'block' : 'none';
    
    // Add arguments section
    const argsEl = contentEl.createDiv({
      cls: 'chatsidian-tool-call-section'
    });
    
    // Add arguments header
    argsEl.createDiv({
      cls: 'chatsidian-tool-call-section-header',
      text: 'Arguments'
    });
    
    // Format arguments
    const formattedArgs = this.formatArguments(this.toolCall.arguments);
    
    // Add arguments content
    const argsContentEl = argsEl.createDiv({
      cls: 'chatsidian-tool-call-section-content chatsidian-tool-call-arguments'
    });
    
    // Render arguments
    this.renderCode(formattedArgs, 'json', argsContentEl);
    
    // Add result section if available
    if (this.toolResult) {
      const resultEl = contentEl.createDiv({
        cls: 'chatsidian-tool-call-section'
      });
      
      // Add result header
      resultEl.createDiv({
        cls: 'chatsidian-tool-call-section-header',
        text: this.toolResult.error ? 'Error' : 'Result'
      });
      
      // Add result content
      const resultContentEl = resultEl.createDiv({
        cls: `chatsidian-tool-call-section-content ${
          this.toolResult.error ? 'chatsidian-tool-call-error' : 'chatsidian-tool-call-result'
        }`
      });
      
      // Render result or error
      if (this.toolResult.error) {
        resultContentEl.textContent = this.toolResult.error;
      } else {
        this.renderResult(this.toolResult.content, resultContentEl);
      }
    }
  }
  
  private toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
    
    const contentEl = this.containerEl.querySelector('.chatsidian-tool-call-content');
    if (contentEl) {
      contentEl.style.display = this.isExpanded ? 'block' : 'none';
    }
  }
  
  private formatToolName(name: string): string {
    // Convert camelCase to Title Case with spaces
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  }
  
  private formatArguments(args: any): string {
    try {
      return JSON.stringify(args, null, 2);
    } catch (error) {
      return typeof args === 'string' ? args : String(args);
    }
  }
  
  private renderCode(content: string, language: string, containerEl: HTMLElement): void {
    // Create pre and code elements
    const preEl = containerEl.createEl('pre');
    const codeEl = preEl.createEl('code', {
      cls: language ? `language-${language}` : ''
    });
    
    // Set content
    codeEl.textContent = content;
  }
  
  private renderResult(result: any, containerEl: HTMLElement): void {
    // Check result type and render accordingly
    if (typeof result === 'string') {
      // Try to parse as JSON first
      try {
        const parsedResult = JSON.parse(result);
        this.renderCode(JSON.stringify(parsedResult, null, 2), 'json', containerEl);
      } catch (error) {
        // If not JSON, check if it might be markdown
        if (result.includes('#') || result.includes('*') || result.includes('```')) {
          this.renderMarkdown(result, containerEl);
        } else {
          // Render as plain text
          containerEl.textContent = result;
        }
      }
    } else if (typeof result === 'object') {
      // Format object as JSON
      this.renderCode(JSON.stringify(result, null, 2), 'json', containerEl);
    } else {
      // Render as plain text
      containerEl.textContent = String(result);
    }
  }
  
  private renderMarkdown(content: string, containerEl: HTMLElement): void {
    // Clear container
    containerEl.empty();
    
    // Render markdown
    MarkdownRenderer.renderMarkdown(
      content,
      containerEl,
      '',
      null as unknown as MarkdownView
    );
  }
}
```

This component provides a rich visualization for tool calls with:
1. A collapsible header showing the tool name and status
2. Appropriate icons based on the tool type
3. Status indicators with different colors
4. Formatted display of arguments and results
5. Special handling for different result types (JSON, Markdown, plain text)
6. Error display for failed tool operations

The component follows Obsidian's UI patterns and integrates with its Markdown rendering capabilities.

### Integration with MessageList

We need to integrate the `ToolCallComponent` with the `MessageList` to display tool calls within messages:

```typescript
// src/ui/MessageList.ts (updated for tool calls)
import { ToolCallComponent } from './ToolCallComponent';

export class MessageList {
  // ... existing code ...
  
  private renderMessage(message: Message): HTMLElement {
    // ... existing message rendering code ...
    
    // Add tool calls if present
    if (message.toolCalls && message.toolCalls.length > 0) {
      const toolCallsEl = messageEl.createDiv({
        cls: 'chatsidian-message-tool-calls'
      });
      
      // Render each tool call
      for (const toolCall of message.toolCalls) {
        // Find matching tool result
        const toolResult = message.toolResults?.find(
          result => result.toolCallId === toolCall.id
        ) || null;
        
        // Create tool call container
        const toolCallContainerEl = toolCallsEl.createDiv();
        
        // Render tool call
        new ToolCallComponent(
          toolCallContainerEl,
          toolCall,
          toolResult,
          this.app
        );
      }
    }
    
    return messageEl;
  }
  
  // Add support for streaming tool calls
  public updateStreamingToolCall(toolCall: ToolCall): void {
    // Check if we have a streaming message
    if (!this.streamingMessageEl) {
      return;
    }
    
    // Get or create tool calls container
    let toolCallsEl = this.streamingMessageEl.querySelector('.chatsidian-message-tool-calls');
    
    if (!toolCallsEl) {
      toolCallsEl = this.streamingMessageEl.createDiv({
        cls: 'chatsidian-message-tool-calls'
      });
    }
    
    // Check if this tool call already exists
    let toolCallEl = toolCallsEl.querySelector(`[data-tool-call-id="${toolCall.id}"]`);
    
    if (!toolCallEl) {
      // Create new tool call container
      toolCallEl = toolCallsEl.createDiv();
      toolCallEl.dataset.toolCallId = toolCall.id;
      
      // Render tool call
      new ToolCallComponent(
        toolCallEl,
        toolCall,
        null, // No result while streaming
        this.app
      );
    } else {
      // Update existing tool call
      toolCallEl.empty();
      
      // Render updated tool call
      new ToolCallComponent(
        toolCallEl,
        toolCall,
        null,
        this.app
      );
    }
    
    // Scroll to bottom
    this.scrollToBottom();
  }
  
  // Add support for tool results
  public updateToolCallResult(toolCallId: string, result: ToolResult): void {
    // Find the tool call element
    const toolCallEl = this.containerEl.querySelector(`[data-tool-call-id="${toolCallId}"]`);
    
    if (!toolCallEl) {
      return;
    }
    
    // Get the tool call
    const toolCall = this.findToolCall(toolCallId);
    
    if (!toolCall) {
      return;
    }
    
    // Update tool call status
    toolCall.status = result.error ? 'error' : 'done';
    
    // Re-render tool call
    toolCallEl.empty();
    
    // Render updated tool call
    new ToolCallComponent(
      toolCallEl,
      toolCall,
      result,
      this.app
    );
    
    // Scroll to bottom
    this.scrollToBottom();
  }
  
  private findToolCall(toolCallId: string): ToolCall | null {
    // Check all messages for the tool call
    for (const message of this.messages) {
      if (message.toolCalls) {
        const toolCall = message.toolCalls.find(tc => tc.id === toolCallId);
        if (toolCall) {
          return toolCall;
        }
      }
    }
    
    return null;
  }
}
```

This integration adds:
1. Rendering tool calls within messages
2. Support for updating streaming tool calls as they progress
3. Handling tool results when they become available
4. Proper scrolling to keep the latest content visible

### CSS Styling for Tool Calls

We'll add CSS styling for the tool call components:

```css
/* src/styles.css - Tool call styling */

/* Tool call container */
.chatsidian-message-tool-calls {
  margin-top: 8px;
  border-radius: 4px;
  overflow: hidden;
}

.chatsidian-tool-call {
  background-color: var(--background-secondary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  margin-bottom: 8px;
  overflow: hidden;
}

/* Tool call header */
.chatsidian-tool-call-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background-color: var(--background-secondary-alt);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.chatsidian-tool-call-header:hover {
  background-color: var(--background-modifier-hover);
}

.chatsidian-tool-call-icon {
  margin-right: 8px;
  color: var(--text-muted);
}

.chatsidian-tool-call-name {
  flex-grow: 1;
  font-weight: 500;
  font-size: 0.9em;
}

/* Status indicators */
.chatsidian-tool-call-status {
  display: flex;
  align-items: center;
  font-size: 0.8em;
  padding: 2px 6px;
  border-radius: 4px;
  margin-right: 8px;
}

.chatsidian-tool-call-status svg {
  margin-right: 4px;
  width: 14px;
  height: 14px;
}

.chatsidian-tool-call-status-pending {
  background-color: var(--text-muted);
  color: var(--background-primary);
}

.chatsidian-tool-call-status-running {
  background-color: var(--text-accent);
  color: var(--background-primary);
}

.chatsidian-tool-call-status-done {
  background-color: var(--color-green);
  color: var(--background-primary);
}

.chatsidian-tool-call-status-error {
  background-color: var(--text-error);
  color: var(--background-primary);
}

/* Tool call toggle */
.chatsidian-tool-call-toggle {
  color: var(--text-muted);
}

/* Tool call content */
.chatsidian-tool-call-content {
  padding: 0 12px 12px;
  font-size: 0.9em;
}

/* Tool call sections */
.chatsidian-tool-call-section {
  margin-top: 8px;
}

.chatsidian-tool-call-section-header {
  font-weight: 500;
  margin-bottom: 4px;
  color: var(--text-muted);
  font-size: 0.8em;
  text-transform: uppercase;
}

.chatsidian-tool-call-section-content {
  background-color: var(--code-background);
  border-radius: 4px;
  padding: 8px;
  overflow-x: auto;
}

/* Arguments */
.chatsidian-tool-call-arguments pre {
  margin: 0;
}

.chatsidian-tool-call-arguments code {
  font-family: var(--font-monospace);
}

/* Results */
.chatsidian-tool-call-result pre {
  margin: 0;
}

/* Errors */
.chatsidian-tool-call-error {
  color: var(--text-error);
}

/* Animation for running status */
@keyframes chatsidian-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.chatsidian-tool-call-status-running svg {
  animation: chatsidian-spin 1.5s linear infinite;
}
```

This CSS provides styling for:
1. Tool call containers with collapsible headers
2. Status indicators with different colors based on state
3. Formatted display of arguments and results
4. Error highlighting
5. Animation for the running status icon

All styling uses Obsidian's CSS variables to ensure compatibility with different themes.

### Integration with MCP Client

The tool call visualization needs to integrate with the MCP client from Phase 2 to receive tool call events:

```typescript
// src/ui/ChatView.ts (updated for tool calls)
export class ChatView extends ItemView {
  // ... existing code ...
  
  private registerEvents(): void {
    // ... existing events ...
    
    // Listen for tool call events
    this.registerEvent(
      this.eventBus.on('mcp:toolCall', (data: {
        conversationId: string,
        toolCall: ToolCall
      }) => {
        // Check if this is for the current conversation
        if (this.currentConversationId === data.conversationId) {
          this.messageList.updateStreamingToolCall(data.toolCall);
        }
      })
    );
    
    // Listen for tool result events
    this.registerEvent(
      this.eventBus.on('mcp:toolResult', (data: {
        conversationId: string,
        toolCallId: string,
        result: ToolResult
      }) => {
        // Check if this is for the current conversation
        if (this.currentConversationId === data.conversationId) {
          this.messageList.updateToolCallResult(data.toolCallId, data.result);
        }
      })
    );
  }
}
```

The MCP client will emit events when tool calls are initiated and when results are received:

```typescript
// src/mcp/MCPClient.ts (reference for tool call events)
private handleToolCall(toolCall: ToolCall, conversationId: string): void {
  // Emit tool call event
  this.eventBus.emit('mcp:toolCall', {
    conversationId,
    toolCall
  });
  
  // Execute tool
  this.executeToolCall(toolCall, conversationId)
    .then(result => {
      // Emit tool result event
      this.eventBus.emit('mcp:toolResult', {
        conversationId,
        toolCallId: toolCall.id,
        result
      });
    })
    .catch(error => {
      // Emit tool error event
      this.eventBus.emit('mcp:toolResult', {
        conversationId,
        toolCallId: toolCall.id,
        result: {
          toolCallId: toolCall.id,
          content: null,
          error: error.message || 'Unknown error'
        }
      });
    });
}
```

This integration ensures that tool calls and their results are properly visualized as they happen, providing real-time feedback to the user.

### Special Tool Result Handling

Different tools may return results in different formats. We'll enhance the `renderResult` method to handle specific tool types:

```typescript
// src/ui/ToolCallComponent.ts (additional result handling)
private renderResult(result: any, containerEl: HTMLElement): void {
  // ... existing type-based rendering ...
  
  // Special handling for specific tools
  const toolName = this.toolCall.name.toLowerCase();
  
  if (toolName === 'vaultlibrarian' && toolName.includes('search')) {
    // Render search results in a more readable format
    this.renderSearchResults(result, containerEl);
  } else if (toolName === 'notereader') {
    // Render note content as markdown
    this.renderMarkdown(result.content, containerEl);
  } else if (toolName === 'palettecommander' && toolName.includes('list')) {
    // Render command list as a table
    this.renderCommandList(result, containerEl);
  } else {
    // Use default rendering
    // ... existing rendering logic ...
  }
}

private renderSearchResults(results: any, containerEl: HTMLElement): void {
  // Create table for search results
  const tableEl = containerEl.createEl('table', {
    cls: 'chatsidian-search-results'
  });
  
  // Create header row
  const headerRow = tableEl.createEl('tr');
  headerRow.createEl('th', { text: 'File' });
  headerRow.createEl('th', { text: 'Match' });
  
  // Create rows for each result
  if (results.results && Array.isArray(results.results)) {
    for (const result of results.results) {
      const row = tableEl.createEl('tr');
      
      // File column
      const fileCell = row.createEl('td');
      fileCell.createEl('span', {
        cls: 'chatsidian-search-result-file',
        text: result.path
      });
      
      // Match column
      const matchCell = row.createEl('td');
      if (result.snippet) {
        matchCell.createEl('span', {
          cls: 'chatsidian-search-result-snippet',
          text: result.snippet
        });
      }
    }
  }
}

private renderCommandList(commands: any, containerEl: HTMLElement): void {
  // Create table for commands
  const tableEl = containerEl.createEl('table', {
    cls: 'chatsidian-command-list'
  });
  
  // Create header row
  const headerRow = tableEl.createEl('tr');
  headerRow.createEl('th', { text: 'ID' });
  headerRow.createEl('th', { text: 'Name' });
  
  // Create rows for each command
  if (Array.isArray(commands)) {
    for (const command of commands) {
      const row = tableEl.createEl('tr');
      
      // ID column
      row.createEl('td', {
        text: command.id
      });
      
      // Name column
      row.createEl('td', {
        text: command.name
      });
    }
  }
}
```

This enhanced rendering provides more user-friendly displays for specific tool results, making the interface more intuitive and useful.

## Tool Call Model Extensions

To fully support tool call visualization, we need to ensure our data models include all necessary fields:

```typescript
// src/models/Conversation.ts (tool-related interfaces)
export interface ToolCall {
  id: string;
  name: string;
  arguments: any;
  status: 'pending' | 'running' | 'done' | 'error';
  timestamp?: number;
}

export interface ToolResult {
  toolCallId: string;
  content: any;
  error?: string;
  timestamp?: number;
}

// Extended Message interface to include tool calls
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  metadata?: {
    [key: string]: any;
  };
}
```

These interfaces define the structure for tool calls and results, which are used by the visualization components.

## Testing Strategy

Testing for this microphase will involve:

1. **Unit Testing**:
   - Test the `ToolCallComponent` rendering methods
   - Verify proper handling of different result types
   - Test status indicator display

2. **Integration Testing**:
   - Test integration with `MessageList`
   - Verify tool call events are properly handled
   - Test result updates and status changes

3. **Manual UI Testing**:
   - Test collapsible tool call sections
   - Verify visual appearance of different status indicators
   - Test with various tool types and result formats
   - Check streaming updates for tool calls

4. **MCP Integration Testing**:
   - Test end-to-end flow from MCP client to visualization
   - Verify real tool execution and result display
   - Test error handling for failed tool operations

## Dependencies

This microphase depends on:
- Phase 1 components (EventBus)
- Phase 2 components (MCP Client, Tool System)
- Phase 3.1 (Core View Registration)
- Phase 3.2 (Message Display)

## Next Steps

After completing this microphase, we'll have a fully functional tool call visualization system integrated with the chat interface. The next microphases will focus on:
1. Implementing the settings interface
2. Adding responsive design and accessibility enhancements
3. Final integration and testing

## Additional Resources

- [[💻 Coding/Projects/Chatsidian/4_Documentation/UIDesignGuidelines]]
- [[💻 Coding/Projects/Chatsidian/1_Architecture/Components/MCPConnector]]
- [[💻 Coding/Projects/Chatsidian/1_Architecture/Components/ChatInterface]]
