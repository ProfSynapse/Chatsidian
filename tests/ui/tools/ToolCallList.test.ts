/**
 * ToolCallList Tests
 * 
 * This file contains tests for the ToolCallList component.
 */

import { ToolCallList, ToolCallListEventType } from '../../../src/ui/tools/ToolCallList';
import { EventBus } from '../../../src/core/EventBus';
import { setupUITestEnvironment } from '../../utils/ui-test-utils';
import { ToolCall, ToolResult } from '../../../src/models/Conversation';

// Setup UI test environment
setupUITestEnvironment();

describe('ToolCallList', () => {
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
  
  test('should render a list of tool calls', () => {
    // Create sample tool calls
    const toolCalls: ToolCall[] = [
      {
        id: 'tool1',
        name: 'searchVault',
        arguments: { query: 'obsidian' },
        status: 'success'
      },
      {
        id: 'tool2',
        name: 'createNote',
        arguments: { title: 'New Note', content: 'Content' },
        status: 'error'
      }
    ];
    
    const toolResults: ToolResult[] = [
      {
        id: 'result1',
        toolCallId: 'tool1',
        content: 'Found 5 notes matching "obsidian"'
      },
      {
        id: 'result2',
        toolCallId: 'tool2',
        content: null,
        error: 'Permission denied'
      }
    ];
    
    // Create component
    const component = new ToolCallList(containerEl, eventBus);
    component.setToolCalls(toolCalls, toolResults);
    
    // Check that tool calls are rendered
    const toolCallEls = containerEl.querySelectorAll('.chatsidian-tool-call');
    expect(toolCallEls.length).toBe(2);
    
    // Check first tool call
    const firstToolCall = toolCallEls[0];
    expect(firstToolCall.querySelector('.chatsidian-tool-call-name')?.textContent).toBe('searchVault');
    expect(firstToolCall.classList.contains('chatsidian-tool-call-success')).toBe(true);
    
    // Check second tool call
    const secondToolCall = toolCallEls[1];
    expect(secondToolCall.querySelector('.chatsidian-tool-call-name')?.textContent).toBe('createNote');
    expect(secondToolCall.classList.contains('chatsidian-tool-call-error')).toBe(true);
  });
  
  test('should update tool calls when setToolCalls is called', () => {
    // Create component with initial tool calls
    const component = new ToolCallList(containerEl, eventBus);
    component.setToolCalls(
      [
        {
          id: 'tool1',
          name: 'searchVault',
          arguments: { query: 'obsidian' },
          status: 'pending'
        }
      ],
      []
    );
    
    // Check initial state
    expect(containerEl.querySelectorAll('.chatsidian-tool-call').length).toBe(1);
    expect(containerEl.querySelector('.chatsidian-tool-call-pending')).not.toBeNull();
    
    // Update tool calls
    component.setToolCalls(
      [
        {
          id: 'tool1',
          name: 'searchVault',
          arguments: { query: 'obsidian' },
          status: 'success'
        },
        {
          id: 'tool2',
          name: 'createNote',
          arguments: { title: 'New Note' },
          status: 'pending'
        }
      ],
      [
        {
          id: 'result1',
          toolCallId: 'tool1',
          content: 'Found 5 notes matching "obsidian"'
        }
      ]
    );
    
    // Check updated state
    const toolCallEls = containerEl.querySelectorAll('.chatsidian-tool-call');
    expect(toolCallEls.length).toBe(2);
    
    // First tool call should be updated to success
    const firstToolCall = toolCallEls[0];
    expect(firstToolCall.classList.contains('chatsidian-tool-call-success')).toBe(true);
    
    // Second tool call should be pending
    const secondToolCall = toolCallEls[1];
    expect(secondToolCall.classList.contains('chatsidian-tool-call-pending')).toBe(true);
  });
  
  test('should emit events when tool call components emit events', () => {
    // Create sample tool calls
    const toolCalls: ToolCall[] = [
      {
        id: 'tool1',
        name: 'searchVault',
        arguments: { query: 'obsidian' },
        status: 'success'
      }
    ];
    
    const toolResults: ToolResult[] = [
      {
        id: 'result1',
        toolCallId: 'tool1',
        content: 'Found 5 notes matching "obsidian"'
      }
    ];
    
    // Create component
    const component = new ToolCallList(containerEl, eventBus);
    component.setToolCalls(toolCalls, toolResults);
    
    // Set up event listeners
    const retryToolCallSpy = jest.fn();
    const copyToolCallSpy = jest.fn();
    const copyToolResultSpy = jest.fn();
    
    eventBus.on(ToolCallListEventType.RETRY_TOOL_CALL, retryToolCallSpy);
    eventBus.on(ToolCallListEventType.COPY_TOOL_CALL, copyToolCallSpy);
    eventBus.on(ToolCallListEventType.COPY_TOOL_RESULT, copyToolResultSpy);
    
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
      toolCall: toolCalls[0],
      toolResult: toolResults[0]
    }));
    
    // Click copy result button
    const copyResultBtn = containerEl.querySelector('.chatsidian-tool-call-copy-result-btn') as HTMLElement;
    copyResultBtn.click();
    
    // Check that event was emitted
    expect(copyToolResultSpy).toHaveBeenCalledWith(expect.objectContaining({
      toolCall: toolCalls[0],
      toolResult: toolResults[0]
    }));
  });
  
  test('should toggle all tool calls when toggle all button is clicked', () => {
    // Create sample tool calls
    const toolCalls: ToolCall[] = [
      {
        id: 'tool1',
        name: 'searchVault',
        arguments: { query: 'obsidian' },
        status: 'success'
      },
      {
        id: 'tool2',
        name: 'createNote',
        arguments: { title: 'New Note' },
        status: 'success'
      }
    ];
    
    // Create component
    const component = new ToolCallList(containerEl, eventBus);
    component.setToolCalls(toolCalls, []);
    
    // Check initial state - all content should be visible
    const contentEls = containerEl.querySelectorAll('.chatsidian-tool-call-content');
    contentEls.forEach(el => {
      expect(el.classList.contains('chatsidian-tool-call-collapsed')).toBe(false);
    });
    
    // Click toggle all button
    const toggleAllBtn = containerEl.querySelector('.chatsidian-tool-call-list-toggle-all') as HTMLElement;
    toggleAllBtn.click();
    
    // All content should be hidden
    contentEls.forEach(el => {
      expect(el.classList.contains('chatsidian-tool-call-collapsed')).toBe(true);
    });
    
    // Click toggle all button again
    toggleAllBtn.click();
    
    // All content should be visible again
    contentEls.forEach(el => {
      expect(el.classList.contains('chatsidian-tool-call-collapsed')).toBe(false);
    });
  });
  
  test('should handle empty tool calls list', () => {
    // Create component with no tool calls
    const component = new ToolCallList(containerEl, eventBus);
    component.setToolCalls([], []);
    
    // Should render empty list with header
    expect(containerEl.querySelector('.chatsidian-tool-call-list-header')).not.toBeNull();
    expect(containerEl.querySelectorAll('.chatsidian-tool-call').length).toBe(0);
    
    // Add tool calls
    component.setToolCalls(
      [
        {
          id: 'tool1',
          name: 'searchVault',
          arguments: { query: 'obsidian' },
          status: 'success'
        }
      ],
      []
    );
    
    // Should now have one tool call
    expect(containerEl.querySelectorAll('.chatsidian-tool-call').length).toBe(1);
  });
});
