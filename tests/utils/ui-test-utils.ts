/**
 * UI Test Utilities
 * 
 * This file provides utility functions for testing UI components.
 * It includes functions for mocking Obsidian's API and setting up common test environments.
 */

import { Component, WorkspaceLeaf } from 'obsidian';
import { setupDomUtils } from './dom-utils';

/**
 * Set up the DOM utilities and mock Obsidian's API for UI component tests.
 * This should be called at the beginning of each UI component test file.
 */
export function setupUITestEnvironment(): void {
  // Setup DOM utilities for Obsidian API mocking
  setupDomUtils();
  
  // Mock Obsidian's API
  jest.mock('obsidian', () => {
    // Import the actual mocks
    const actualMocks = jest.requireActual('../../tests/mocks/obsidian');
    
    return {
      ...actualMocks
    };
  });
}

/**
 * Create mock functions for common Obsidian Component methods.
 * These can be used to mock methods on UI components that extend Obsidian's Component class.
 */
export function createComponentMocks() {
  return {
    mockAddChild: jest.fn().mockImplementation(function(child: any) {
      return child;
    }),
    
    mockRegisterEvent: jest.fn(),
    
    mockRegisterDomEvent: jest.fn().mockImplementation(function(el: any, event: string, callback: (evt: any) => any) {
      if (el && el.addEventListener) {
        el.addEventListener(event, callback);
      }
    })
  };
}

/**
 * Create a mock app object with common properties needed for testing.
 * This can be used to mock the app property on components that use it.
 */
export function createMockApp() {
  return {
    workspace: {
      on: jest.fn().mockReturnValue('mock-event'),
      off: jest.fn(),
      getActiveViewOfType: jest.fn(),
      getLeaf: jest.fn().mockReturnValue({
        setViewState: jest.fn().mockResolvedValue(undefined)
      })
    },
    vault: {
      getFiles: jest.fn().mockReturnValue([]),
      read: jest.fn().mockResolvedValue(''),
      adapter: {
        exists: jest.fn().mockResolvedValue(true),
        read: jest.fn().mockResolvedValue(''),
        write: jest.fn().mockResolvedValue(undefined)
      }
    },
    metadataCache: {
      getFileCache: jest.fn().mockReturnValue(null)
    }
  };
}

/**
 * Apply component mocks to a component instance.
 * This patches the component with mock methods for testing.
 * 
 * @param component The component instance to patch
 * @param mocks The mock functions to apply
 */
export function applyComponentMocks(component: Component, mocks: ReturnType<typeof createComponentMocks>): void {
  component.addChild = mocks.mockAddChild;
  component.registerEvent = mocks.mockRegisterEvent;
  component.registerDomEvent = mocks.mockRegisterDomEvent;
}

/**
 * Apply app mock to a component instance.
 * This patches the component with a mock app object for testing.
 * 
 * @param component The component instance to patch
 * @param app The mock app object to apply
 */
export function applyAppMock(component: any, app = createMockApp()): void {
  Object.defineProperty(component, 'app', {
    value: app,
    writable: true
  });
}

/**
 * Create a mock WorkspaceLeaf for testing.
 * 
 * @param viewType The view type for the leaf
 * @returns A mock WorkspaceLeaf
 */
export function createMockWorkspaceLeaf(viewType: string): WorkspaceLeaf {
  const leaf = {
    containerEl: document.createElement('div'),
    view: null,
    getViewType: () => viewType
  } as unknown as WorkspaceLeaf;
  
  return leaf;
}
