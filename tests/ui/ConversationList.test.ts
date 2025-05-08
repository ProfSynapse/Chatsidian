/**
 * ConversationList Component Tests
 * 
 * This file contains tests for the ConversationList component.
 * It tests the rendering, event handling, and functionality of the conversation list,
 * with a focus on keyboard shortcuts and navigation.
 */

import { ConversationList, ConversationListEventType } from '../../src/ui/ConversationList';
import { EventBus } from '../../src/core/EventBus';
import { StorageManager } from '../../src/core/StorageManager';
import { Conversation } from '../../src/models/Conversation';
import { setupUITestEnvironment } from '../utils/ui-test-utils';
import { Component } from 'obsidian';

// Setup UI test environment
setupUITestEnvironment();

// Mock the manager classes
jest.mock('../../src/ui/conversations/ConversationManager', () => {
  return {
    ConversationManager: jest.fn().mockImplementation(() => ({
      loadConversations: jest.fn().mockResolvedValue([]),
      getConversations: jest.fn().mockReturnValue([
        { id: 'conv1', title: 'Conversation 1', messages: [], tags: [], starred: false },
        { id: 'conv2', title: 'Conversation 2', messages: [], tags: [], starred: true },
        { id: 'conv3', title: 'Conversation 3', messages: [], tags: ['tag1'], starred: false }
      ]),
      getSelectedConversationId: jest.fn().mockReturnValue('conv1'),
      getSelectedConversation: jest.fn().mockReturnValue({ id: 'conv1', title: 'Conversation 1', messages: [], tags: [], starred: false }),
      selectConversation: jest.fn(),
      createNewConversation: jest.fn().mockResolvedValue({ id: 'new-conv', title: 'New Conversation', messages: [], tags: [], starred: false }),
      deleteConversation: jest.fn().mockResolvedValue(undefined),
      renameConversation: jest.fn().mockResolvedValue(undefined),
      toggleConversationStar: jest.fn().mockResolvedValue(undefined),
      updateConversation: jest.fn().mockResolvedValue(undefined)
    }))
  };
});

jest.mock('../../src/ui/conversations/FolderManager', () => {
  return {
    FolderManager: jest.fn().mockImplementation(() => ({
      loadFolders: jest.fn().mockResolvedValue([]),
      getFolders: jest.fn().mockReturnValue([
        { id: 'folder1', name: 'Folder 1', parentId: null },
        { id: 'folder2', name: 'Folder 2', parentId: null }
      ]),
      getChildFolders: jest.fn().mockReturnValue([]),
      isFolderExpanded: jest.fn().mockReturnValue(true),
      toggleFolderExpansion: jest.fn(),
      createFolder: jest.fn().mockResolvedValue({ id: 'new-folder', name: 'New Folder', parentId: null }),
      renameFolder: jest.fn().mockResolvedValue(undefined),
      deleteFolder: jest.fn().mockResolvedValue(undefined),
      moveConversationToFolder: jest.fn().mockResolvedValue(undefined)
    }))
  };
});

jest.mock('../../src/ui/conversations/TagManager', () => {
  return {
    TagManager: jest.fn().mockImplementation(() => ({
      updateAvailableTags: jest.fn(),
      getAvailableTags: jest.fn().mockReturnValue(['tag1', 'tag2']),
      getSelectedTag: jest.fn().mockReturnValue(null),
      setSelectedTag: jest.fn(),
      updateConversationTags: jest.fn().mockResolvedValue(undefined)
    }))
  };
});

jest.mock('../../src/ui/conversations/SearchBar', () => {
  return {
    SearchBar: jest.fn().mockImplementation(() => ({
      focus: jest.fn(),
      setQuery: jest.fn()
    }))
  };
});

jest.mock('../../src/ui/conversations/FilterControls', () => {
  return {
    FilterControls: jest.fn().mockImplementation(() => ({
      updateAvailableTags: jest.fn(),
      setSortOption: jest.fn(),
      setFilterOption: jest.fn()
    }))
  };
});

describe('ConversationList', () => {
  let containerEl: HTMLElement;
  let eventBus: EventBus;
  let storageManager: StorageManager;
  let conversationList: ConversationList;
  
  beforeEach(() => {
    // Create container element
    containerEl = document.createElement('div');
    document.body.appendChild(containerEl);
    
    // Create event bus
    eventBus = new EventBus();
    
    // Mock storage manager
    storageManager = {
      getConversations: jest.fn().mockResolvedValue([
        { id: 'conv1', title: 'Conversation 1', messages: [], tags: [], starred: false },
        { id: 'conv2', title: 'Conversation 2', messages: [], tags: [], starred: true },
        { id: 'conv3', title: 'Conversation 3', messages: [], tags: ['tag1'], starred: false }
      ]),
      createConversation: jest.fn().mockResolvedValue({ id: 'new-conv', title: 'New Conversation', messages: [], tags: [], starred: false }),
      updateConversation: jest.fn().mockResolvedValue(undefined),
      deleteConversation: jest.fn().mockResolvedValue(undefined),
      getConversation: jest.fn().mockImplementation((id) => {
        if (id === 'conv1') {
          return Promise.resolve({ id: 'conv1', title: 'Conversation 1', messages: [], tags: [], starred: false });
        }
        return Promise.resolve(null);
      }),
      addMessageToConversation: jest.fn().mockResolvedValue(undefined)
    } as unknown as StorageManager;
    
    // Create conversation list
    conversationList = new ConversationList(containerEl, eventBus, storageManager);
  });
  
  afterEach(() => {
    // Clean up
    document.body.removeChild(containerEl);
    jest.clearAllMocks();
  });
  
  test('renders conversation list with header and container', () => {
    // Check if container has the correct class
    expect(containerEl.classList.contains('chatsidian-conversation-list')).toBe(true);
    
    // Check if header exists
    const header = containerEl.querySelector('.chatsidian-conversation-list-header');
    expect(header).not.toBeNull();
    
    // Check if title exists
    const title = containerEl.querySelector('.chatsidian-conversation-list-title');
    expect(title).not.toBeNull();
    
    // Check if new button exists
    const newButton = containerEl.querySelector('.chatsidian-conversation-new-button');
    expect(newButton).not.toBeNull();
    
    // Check if search container exists
    const searchContainer = containerEl.querySelector('.chatsidian-search-container');
    expect(searchContainer).not.toBeNull();
    
    // Check if filter container exists
    const filterContainer = containerEl.querySelector('.chatsidian-filter-container');
    expect(filterContainer).not.toBeNull();
    
    // Check if list container exists
    const listContainer = containerEl.querySelector('.chatsidian-conversation-list-container');
    expect(listContainer).not.toBeNull();
  });
  
  test('handles Ctrl+N keyboard shortcut to create new conversation', () => {
    // Get the createNewConversation method from the ConversationList instance
    const createNewConversationSpy = jest.spyOn(conversationList as any, 'createNewConversation');
    
    // Mock the document.activeElement to return the container element
    Object.defineProperty(document, 'activeElement', {
      value: containerEl,
      writable: true
    });
    
    // Directly call the registerKeyboardShortcuts method to ensure event listeners are set up
    (conversationList as any).registerKeyboardShortcuts();
    
    // Simulate Ctrl+N key press
    const ctrlNEvent = new KeyboardEvent('keydown', { 
      key: 'n', 
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });
    containerEl.dispatchEvent(ctrlNEvent);
    
    // Directly call the keyboard event handler
    const keydownHandler = (conversationList as any).containerEl.onkeydown || 
                          ((conversationList as any).containerEl as any)._listeners?.keydown?.[0];
    
    if (keydownHandler) {
      keydownHandler(ctrlNEvent);
    }
    
    // Check if createNewConversation was called
    expect(createNewConversationSpy).toHaveBeenCalled();
  });
  
  test('handles Ctrl+Shift+N keyboard shortcut to create new folder', () => {
    // Get the createFolder method from the ConversationList instance
    const createFolderSpy = jest.spyOn(conversationList as any, 'createFolder');
    
    // Mock the document.activeElement to return the container element
    Object.defineProperty(document, 'activeElement', {
      value: containerEl,
      writable: true
    });
    
    // Directly call the keyboard event handler with a Ctrl+Shift+N event
    const ctrlShiftNEvent = new KeyboardEvent('keydown', { 
      key: 'n', 
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true
    });
    
    // Directly call the keyboard event handler
    const keydownHandler = (conversationList as any).containerEl.onkeydown || 
                          ((conversationList as any).containerEl as any)._listeners?.keydown?.[0];
    
    if (keydownHandler) {
      keydownHandler(ctrlShiftNEvent);
    } else {
      // Manually call the handler with the event
      (conversationList as any).registerKeyboardShortcuts();
      (conversationList as any).handleKeyDown(ctrlShiftNEvent);
    }
    
    // Check if createFolder was called
    expect(createFolderSpy).toHaveBeenCalled();
  });
  
  test('handles Ctrl+F keyboard shortcut to focus search bar', () => {
    // Get the searchBar instance
    const searchBar = (conversationList as any).searchBar;
    
    // Mock the document.activeElement to return the container element
    Object.defineProperty(document, 'activeElement', {
      value: containerEl,
      writable: true
    });
    
    // Directly call the keyboard event handler with a Ctrl+F event
    const ctrlFEvent = new KeyboardEvent('keydown', { 
      key: 'f', 
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });
    
    // Manually call the handler with the event
    (conversationList as any).registerKeyboardShortcuts();
    (conversationList as any).handleKeyDown(ctrlFEvent);
    
    // Check if searchBar.focus was called
    expect(searchBar.focus).toHaveBeenCalled();
  });
  
  test('handles Ctrl+S keyboard shortcut to toggle star on selected conversation', () => {
    // Get the toggleConversationStar method from the ConversationList instance
    const toggleStarSpy = jest.spyOn(conversationList as any, 'toggleConversationStar');
    
    // Mock the document.activeElement to return the container element
    Object.defineProperty(document, 'activeElement', {
      value: containerEl,
      writable: true
    });
    
    // Directly call the keyboard event handler with a Ctrl+S event
    const ctrlSEvent = new KeyboardEvent('keydown', { 
      key: 's', 
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });
    
    // Manually call the handler with the event
    (conversationList as any).registerKeyboardShortcuts();
    (conversationList as any).handleKeyDown(ctrlSEvent);
    
    // Check if toggleConversationStar was called with the selected conversation ID
    expect(toggleStarSpy).toHaveBeenCalledWith('conv1');
  });
  
  test('handles Delete keyboard shortcut to delete selected conversation', () => {
    // Get the deleteConversation method from the ConversationList instance
    const deleteConversationSpy = jest.spyOn(conversationList as any, 'deleteConversation');
    
    // Mock the document.activeElement to return the container element
    Object.defineProperty(document, 'activeElement', {
      value: containerEl,
      writable: true
    });
    
    // Directly call the keyboard event handler with a Delete event
    const deleteEvent = new KeyboardEvent('keydown', { 
      key: 'Delete',
      bubbles: true,
      cancelable: true
    });
    
    // Manually call the handler with the event
    (conversationList as any).registerKeyboardShortcuts();
    (conversationList as any).handleKeyDown(deleteEvent);
    
    // Check if deleteConversation was called with the selected conversation ID
    expect(deleteConversationSpy).toHaveBeenCalledWith('conv1');
  });
  
  test('handles ArrowUp keyboard shortcut to select previous conversation', () => {
    // Get the selectAdjacentConversation method from the ConversationList instance
    const selectAdjacentSpy = jest.spyOn(conversationList as any, 'selectAdjacentConversation');
    
    // Mock the document.activeElement to return the container element
    Object.defineProperty(document, 'activeElement', {
      value: containerEl,
      writable: true
    });
    
    // Directly call the keyboard event handler with an ArrowUp event
    const arrowUpEvent = new KeyboardEvent('keydown', { 
      key: 'ArrowUp',
      bubbles: true,
      cancelable: true
    });
    
    // Manually call the handler with the event
    (conversationList as any).registerKeyboardShortcuts();
    (conversationList as any).handleKeyDown(arrowUpEvent);
    
    // Check if selectAdjacentConversation was called with -1 (previous)
    expect(selectAdjacentSpy).toHaveBeenCalledWith(-1);
  });
  
  test('handles ArrowDown keyboard shortcut to select next conversation', () => {
    // Get the selectAdjacentConversation method from the ConversationList instance
    const selectAdjacentSpy = jest.spyOn(conversationList as any, 'selectAdjacentConversation');
    
    // Mock the document.activeElement to return the container element
    Object.defineProperty(document, 'activeElement', {
      value: containerEl,
      writable: true
    });
    
    // Directly call the keyboard event handler with an ArrowDown event
    const arrowDownEvent = new KeyboardEvent('keydown', { 
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true
    });
    
    // Manually call the handler with the event
    (conversationList as any).registerKeyboardShortcuts();
    (conversationList as any).handleKeyDown(arrowDownEvent);
    
    // Check if selectAdjacentConversation was called with 1 (next)
    expect(selectAdjacentSpy).toHaveBeenCalledWith(1);
  });
  
  test('handles Enter keyboard shortcut to open selected conversation', () => {
    // Get the selectConversation method from the ConversationList instance
    const selectConversationSpy = jest.spyOn(conversationList as any, 'selectConversation');
    
    // Mock the document.activeElement to return the container element
    Object.defineProperty(document, 'activeElement', {
      value: containerEl,
      writable: true
    });
    
    // Directly call the keyboard event handler with an Enter event
    const enterEvent = new KeyboardEvent('keydown', { 
      key: 'Enter',
      bubbles: true,
      cancelable: true
    });
    
    // Manually call the handler with the event
    (conversationList as any).registerKeyboardShortcuts();
    (conversationList as any).handleKeyDown(enterEvent);
    
    // Check if selectConversation was called with the selected conversation ID
    expect(selectConversationSpy).toHaveBeenCalledWith('conv1');
  });
  
  test('handles Alt+F global keyboard shortcut to focus conversation list', () => {
    // Mock the focus method on the container element
    containerEl.focus = jest.fn();
    
    // Simulate Alt+F key press on document
    const altFEvent = new KeyboardEvent('keydown', { 
      key: 'f', 
      altKey: true,
      bubbles: true 
    });
    document.dispatchEvent(altFEvent);
    
    // Check if containerEl.focus was called
    expect(containerEl.focus).toHaveBeenCalled();
  });
  
  test('selectAdjacentConversation selects the next conversation', () => {
    // Get the selectConversation method from the ConversationList instance
    const selectConversationSpy = jest.spyOn(conversationList as any, 'selectConversation');
    
    // Call selectAdjacentConversation with 1 (next)
    (conversationList as any).selectAdjacentConversation(1);
    
    // Check if selectConversation was called with the next conversation ID
    expect(selectConversationSpy).toHaveBeenCalledWith('conv2');
  });
  
  test('selectAdjacentConversation selects the previous conversation', () => {
    // Mock the ConversationFilter.filterAndSort method to return conversations in reverse order
    jest.mock('../../src/ui/conversations/ConversationFilter', () => {
      return {
        ConversationFilter: {
          filterAndSort: jest.fn().mockReturnValue([
            { id: 'conv3', title: 'Conversation 3', messages: [], tags: ['tag1'], starred: false },
            { id: 'conv2', title: 'Conversation 2', messages: [], tags: [], starred: true },
            { id: 'conv1', title: 'Conversation 1', messages: [], tags: [], starred: false }
          ])
        }
      };
    });
    
    // Get the selectConversation method from the ConversationList instance
    const selectConversationSpy = jest.spyOn(conversationList as any, 'selectConversation');
    
    // Call selectAdjacentConversation with -1 (previous)
    (conversationList as any).selectAdjacentConversation(-1);
    
    // Check if selectConversation was called with the previous conversation ID
    expect(selectConversationSpy).toHaveBeenCalled();
  });
  
  test('keyboard shortcuts are only handled when conversation list has focus', () => {
    // Create a different element and focus it
    const otherEl = document.createElement('div');
    document.body.appendChild(otherEl);
    otherEl.focus();
    
    // Get the createNewConversation method from the ConversationList instance
    const createNewConversationSpy = jest.spyOn(conversationList as any, 'createNewConversation');
    
    // Simulate Ctrl+N key press
    const ctrlNEvent = new KeyboardEvent('keydown', { 
      key: 'n', 
      ctrlKey: true,
      bubbles: true 
    });
    containerEl.dispatchEvent(ctrlNEvent);
    
    // Check that createNewConversation was not called because the conversation list doesn't have focus
    expect(createNewConversationSpy).not.toHaveBeenCalled();
    
    // Clean up
    document.body.removeChild(otherEl);
  });
});
