/**
 * ToolCallComponent Tests
 * 
 * This file contains tests for the ToolCallComponent.
 */

import { ToolCallComponent } from '../../../src/ui/tools/ToolCallComponent';
import { ConversationUtils, MessageRole } from '../../../src/models/Conversation';
import { EventBus } from '../../../src/core/EventBus';
import { setupUITestEnvironment } from '../../utils/ui-test-utils';

// Setup UI test environment
setupUITestEnvironment();

describe('ToolCallComponent', () => {
  let containerEl: HTMLElement;
  let eventBus: EventBus;
  
  beforeEach(() => {
    // Create a mock DOM environment
    document.body.innerHTML = '<div id="container"></div>';
    containerEl = document.getElementById('container') as HTMLElement;
    eventBus = new EventBus();
  });
  
  afterEach(() => {
    // Clean up
    document.body.innerHTML = '';
  });
  
  test('should render a tool call with success status', () => {
    // Create a sample tool call
    const toolCall = {
      id: 'tool1',
      name: 'searchVault',
      arguments: { query: 'obsidian' },
      status: 'success' as const
    };
    
    const toolResult = {
      id: 'result1',
      toolCallId: 'tool1',
      content: 'Found 5 notes matching "obsidian"'
    };
    
    // Create component
    const component = new ToolCallComponent(containerEl, toolCall, toolResult, eventBus);
    
    // Check that tool call is rendered
    expect(containerEl.querySelector('.chatsidian-tool-call')).not.toBeNull();
    expect(containerEl.querySelector('.chatsidian-tool-call-success')).not.toBeNull();
    
    // Check tool call name
    const nameEl = containerEl.querySelector('.chatsidian-tool-call-name');
    expect(nameEl?.textContent).toBe('searchVault');
    
    // Check tool call status
    const statusEl = containerEl.querySelector('.chatsidian-tool-call-status');
    expect(statusEl?.textContent).toBe('success');
    
    // Check tool call arguments
    const argsEl = containerEl.querySelector('.chatsidian-tool-call-args');
    expect(argsEl?.textContent).toContain('query');
    expect(argsEl?.textContent).toContain('obsidian');
    
    // Check tool call result
    const resultEl = containerEl.querySelector('.chatsidian-tool-call-result');
    expect(resultEl?.textContent).toContain('Found 5 notes');
  });
  
  test('should render a tool call with error status', () => {
    // Create a sample tool call with error
    const toolCall = {
      id: 'tool2',
      name: 'createNote',
      arguments: { title: 'New Note', content: 'Content' },
      status: 'error' as const
    };
    
    const toolResult = {
      id: 'result2',
      toolCallId: 'tool2',
      content: null,
      error: 'Permission denied'
    };
    
    // Create component
    const component = new ToolCallComponent(containerEl, toolCall, toolResult, eventBus);
    
    // Check that tool call is rendered with error status
    expect(containerEl.querySelector('.chatsidian-tool-call-error')).not.toBeNull();
    
    // Check for retry button (only shown for errors)
    const retryBtn = containerEl.querySelector('.chatsidian-tool-call-retry-btn');
    expect(retryBtn).not.toBeNull();
    expect(retryBtn?.textContent).toBe('Retry');
    
    // Check error message
    const errorEl = containerEl.querySelector('.chatsidian-tool-call-error');
    expect(errorEl?.textContent).toContain('Permission denied');
  });
  
  test('should toggle content visibility when toggle button is clicked', () => {
    // Create a sample tool call
    const toolCall = {
      id: 'tool3',
      name: 'listFiles',
      arguments: { path: '/' },
      status: 'success' as const
    };
    
    // Create component
    const component = new ToolCallComponent(containerEl, toolCall, undefined, eventBus);
    
    // Content should be visible initially
    const contentEl = containerEl.querySelector('.chatsidian-tool-call-content');
    expect(contentEl?.classList.contains('chatsidian-tool-call-collapsed')).toBe(false);
    
    // Click toggle button
    const toggleEl = containerEl.querySelector('.chatsidian-tool-call-toggle') as HTMLElement;
    toggleEl.click();
    
    // Content should be hidden
    expect(contentEl?.classList.contains('chatsidian-tool-call-collapsed')).toBe(true);
    
    // Click toggle button again
    toggleEl.click();
    
    // Content should be visible again
    expect(contentEl?.classList.contains('chatsidian-tool-call-collapsed')).toBe(false);
  });
  
  test('should emit events when buttons are clicked', () => {
    // Create a sample tool call
    const toolCall = {
      id: 'tool4',
      name: 'searchVault',
      arguments: { query: 'obsidian' },
      status: 'success' as const
    };
    
    const toolResult = {
      id: 'result4',
      toolCallId: 'tool4',
      content: 'Found 5 notes matching "obsidian"'
    };
    
    // Create component
    const component = new ToolCallComponent(containerEl, toolCall, toolResult, eventBus);
    
    // Set up event listeners
    const copyToolCallSpy = jest.fn();
    const copyToolResultSpy = jest.fn();
    
    eventBus.on('tool-call-component:copy', copyToolCallSpy);
    eventBus.on('tool-call-component:copy-result', copyToolResultSpy);
    
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined)
      }
    });
    
    // Click copy button
    const copyBtn = containerEl.querySelector('.chatsidian-tool-call-copy-btn') as HTMLElement;
    copyBtn.click();
    
    // Check that event was emitted
    expect(copyToolCallSpy).toHaveBeenCalledWith(expect.objectContaining({
      toolCall,
      toolResult
    }));
    
    // Click copy result button
    const copyResultBtn = containerEl.querySelector('.chatsidian-tool-call-copy-result-btn') as HTMLElement;
    copyResultBtn.click();
    
    // Check that event was emitted
    expect(copyToolResultSpy).toHaveBeenCalledWith(expect.objectContaining({
      toolCall,
      toolResult
    }));
  });
  
  test('should update when tool call or result changes', () => {
    // Create a sample tool call
    const toolCall = {
      id: 'tool5',
      name: 'searchVault',
      arguments: { query: 'obsidian' },
      status: 'pending' as const
    };
    
    // Create component
    const component = new ToolCallComponent(containerEl, toolCall, undefined, eventBus);
    
    // Check initial status
    let statusEl = containerEl.querySelector('.chatsidian-tool-call-status');
    expect(statusEl?.textContent).toBe('pending');
    
    // Update tool call
    const updatedToolCall = {
      ...toolCall,
      status: 'success' as const
    };
    
    const toolResult = {
      id: 'result5',
      toolCallId: 'tool5',
      content: 'Found 5 notes matching "obsidian"'
    };
    
    component.update(updatedToolCall, toolResult);
    
    // Check updated status
    statusEl = containerEl.querySelector('.chatsidian-tool-call-status');
    expect(statusEl?.textContent).toBe('success');
    
    // Check that result is now rendered
    const resultEl = containerEl.querySelector('.chatsidian-tool-call-result');
    expect(resultEl).not.toBeNull();
    expect(resultEl?.textContent).toContain('Found 5 notes');
  });
});
