# Chatsidian Testing Documentation

This directory contains tests for the Chatsidian plugin. The tests are organized by component type and use Jest as the testing framework.

## Test Structure

- **`/tests/core`**: Tests for core functionality like EventBus, StorageManager, etc.
- **`/tests/models`**: Tests for data models like Conversation, Settings, etc.
- **`/tests/services`**: Tests for services like ProviderService, StorageService, etc.
- **`/tests/ui`**: Tests for UI components like ChatView, MessageDisplay, InputArea, etc.
- **`/tests/mcp`**: Tests for Model Context Protocol (MCP) related functionality
- **`/tests/a2a`**: Tests for Agent-to-Agent (A2A) related functionality
- **`/tests/integration`**: Integration tests that test multiple components together
- **`/tests/mocks`**: Mock implementations used across tests
- **`/tests/utils`**: Utility functions for testing

## UI Component Testing

UI components in Chatsidian rely on Obsidian's DOM manipulation methods. To test these components, we need to mock these methods. The approach is as follows:

### Setup

1. Use `setupUITestEnvironment()` from `tests/utils/ui-test-utils.ts` to set up the test environment:
   - This sets up DOM utilities for Obsidian API mocking
   - It mocks the Obsidian API using the mocks in `tests/mocks/obsidian.ts`

2. For components that extend Obsidian's `Component` class, use the following utilities:
   - `createComponentMocks()`: Creates mock functions for common Component methods
   - `applyComponentMocks()`: Applies these mocks to a component instance
   - `applyAppMock()`: Applies a mock app object to a component instance

### Example

```typescript
import { setupUITestEnvironment, createComponentMocks, applyComponentMocks, applyAppMock } from '../utils/ui-test-utils';

// Setup UI test environment
setupUITestEnvironment();

describe('MyComponent', () => {
  let component: MyComponent;
  
  beforeEach(() => {
    // Create the component
    component = new MyComponent();
    
    // Apply mocks
    const mocks = createComponentMocks();
    applyComponentMocks(component, mocks);
    applyAppMock(component);
  });
  
  // Tests...
});
```

## Integration Testing

Integration tests ensure that different components work together correctly. The `UIBackendIntegration.test.ts` file tests the integration between UI components and backend services.

### UI/Backend Integration

The UI/Backend integration tests use a comprehensive mocking approach:
- Mock Obsidian's API using the mocks in `tests/mocks/obsidian.ts`
- Extend the HTMLElement prototype with methods like empty(), createDiv(), etc.
- Mock the app object with workspace, vault, and other properties

## Running Tests

To run all tests:

```bash
npm test
```

To run specific tests:

```bash
npm test -- tests/ui/ChatView.test.ts
```

To run tests with coverage:

```bash
npm test -- --coverage
```

## Test Utilities

### dom-utils.ts

Provides utilities for mocking Obsidian's DOM manipulation methods:
- Extends HTMLElement prototype with methods like empty(), createDiv(), etc.
- Sets up the document object for testing

### ui-test-utils.ts

Provides utilities specifically for testing UI components:
- `setupUITestEnvironment()`: Sets up the test environment for UI components
- `createComponentMocks()`: Creates mock functions for common Component methods
- `applyComponentMocks()`: Applies these mocks to a component instance
- `applyAppMock()`: Applies a mock app object to a component instance
- `createMockWorkspaceLeaf()`: Creates a mock WorkspaceLeaf for testing
