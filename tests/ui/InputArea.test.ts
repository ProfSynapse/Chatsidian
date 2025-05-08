/**
 * InputArea Component Tests
 * 
 * This file contains tests for the InputArea component.
 * It tests the rendering, event handling, and functionality of the input area.
 */

import { InputArea, InputAreaEventType } from '../../src/ui/InputArea';
import { EventBus } from '../../src/core/EventBus';
import { Message, MessageRole } from '../../src/models/Conversation';
import { setupUITestEnvironment } from '../utils/ui-test-utils';
import { Component } from 'obsidian';

// Setup UI test environment
setupUITestEnvironment();

describe('InputArea', () => {
  let containerEl: HTMLElement;
  let eventBus: EventBus;
  let inputArea: InputArea;
  
  beforeEach(() => {
    // Create container element
    containerEl = document.createElement('div');
    document.body.appendChild(containerEl);
    
    // Create event bus
    eventBus = new EventBus();
    
    // Create input area
    inputArea = new InputArea(containerEl, eventBus);
  });
  
  afterEach(() => {
    // Clean up
    document.body.removeChild(containerEl);
  });
  
  test('renders input area with textarea and send button', () => {
    // Check if container has the correct class
    expect(containerEl.classList.contains('chatsidian-input-area')).toBe(true);
    
    // Check if textarea exists
    const textarea = containerEl.querySelector('.chatsidian-textarea');
    expect(textarea).not.toBeNull();
    
    // Check if send button exists
    const sendButton = containerEl.querySelector('.chatsidian-send-button');
    expect(sendButton).not.toBeNull();
  });
  
  test('emits message submitted event when send button is clicked', () => {
    // Set up spy on event bus
    const emitSpy = jest.spyOn(eventBus, 'emit');
    
    // Get textarea and send button
    const textarea = containerEl.querySelector('.chatsidian-textarea') as HTMLTextAreaElement;
    const sendButton = containerEl.querySelector('.chatsidian-send-button') as HTMLElement;
    
    // Set textarea value
    textarea.value = 'Test message';
    
    // Click send button
    sendButton.click();
    
    // Check if event was emitted
    expect(emitSpy).toHaveBeenCalledWith(
      InputAreaEventType.MESSAGE_SUBMITTED,
      expect.objectContaining({
        role: MessageRole.User,
        content: 'Test message'
      })
    );
    
    // Check if textarea was cleared
    expect(textarea.value).toBe('');
  });
  
  test('does not emit event when textarea is empty', () => {
    // Set up spy on event bus
    const emitSpy = jest.spyOn(eventBus, 'emit');
    
    // Get send button
    const sendButton = containerEl.querySelector('.chatsidian-send-button') as HTMLElement;
    
    // Click send button with empty textarea
    sendButton.click();
    
    // Check that no event was emitted
    expect(emitSpy).not.toHaveBeenCalled();
  });
  
  test('handles Enter key to submit message', () => {
    // Set up spy on event bus
    const emitSpy = jest.spyOn(eventBus, 'emit');
    
    // Get textarea
    const textarea = containerEl.querySelector('.chatsidian-textarea') as HTMLTextAreaElement;
    
    // Set textarea value
    textarea.value = 'Test message';
    
    // Simulate Enter key press
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    textarea.dispatchEvent(enterEvent);
    
    // Check if event was emitted
    expect(emitSpy).toHaveBeenCalledWith(
      InputAreaEventType.MESSAGE_SUBMITTED,
      expect.objectContaining({
        role: MessageRole.User,
        content: 'Test message'
      })
    );
  });
  
  test('does not submit on Shift+Enter', () => {
    // Set up spy on event bus
    const emitSpy = jest.spyOn(eventBus, 'emit');
    
    // Get textarea
    const textarea = containerEl.querySelector('.chatsidian-textarea') as HTMLTextAreaElement;
    
    // Set textarea value
    textarea.value = 'Test message';
    
    // Simulate Shift+Enter key press
    const shiftEnterEvent = new KeyboardEvent('keydown', { 
      key: 'Enter', 
      shiftKey: true,
      bubbles: true 
    });
    textarea.dispatchEvent(shiftEnterEvent);
    
    // Check that no event was emitted
    expect(emitSpy).not.toHaveBeenCalled();
  });
  
  test('clears input on Escape key', () => {
    // Get textarea
    const textarea = containerEl.querySelector('.chatsidian-textarea') as HTMLTextAreaElement;
    
    // Set textarea value
    textarea.value = 'Test message';
    
    // Simulate Escape key press
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    textarea.dispatchEvent(escapeEvent);
    
    // Check if textarea was cleared
    expect(textarea.value).toBe('');
  });
  
  test('disables input area', () => {
    // Get textarea
    const textarea = containerEl.querySelector('.chatsidian-textarea') as HTMLTextAreaElement;
    
    // Disable input area
    inputArea.setDisabled(true);
    
    // Check if textarea is disabled
    expect(textarea.hasAttribute('disabled')).toBe(true);
    expect(containerEl.classList.contains('chatsidian-input-area-disabled')).toBe(true);
    
    // Enable input area
    inputArea.setDisabled(false);
    
    // Check if textarea is enabled
    expect(textarea.hasAttribute('disabled')).toBe(false);
    expect(containerEl.classList.contains('chatsidian-input-area-disabled')).toBe(false);
  });
  
  test('gets and sets input value', () => {
    // Get textarea
    const textarea = containerEl.querySelector('.chatsidian-textarea') as HTMLTextAreaElement;
    
    // Set value
    inputArea.setValue('Test message');
    
    // Check if textarea value was set
    expect(textarea.value).toBe('Test message');
    
    // Get value
    const value = inputArea.getValue();
    
    // Check if value was retrieved correctly
    expect(value).toBe('Test message');
  });
});
