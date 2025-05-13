# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chatsidian is an Obsidian plugin that provides a native chat interface within Obsidian, leveraging the Model Context Protocol (MCP) to enable AI assistants to perform operations directly within the vault. It integrates components like EventBus, SettingsManager, StorageManager, AgentSystem, and a Chat UI.

## Development Commands

```bash
# Install dependencies
npm install

# Build the plugin
npm run build

# Run in development mode with auto-reload
npm run dev

# Run tests
npm test

# Run specific tests
npm test -- tests/ui/ChatView.test.ts

# Run tests with coverage
npm test -- --coverage

# Run live API tests (requires API keys)
npm run test:live
```

## Architecture Overview

Chatsidian follows a modular architecture with clear separation of concerns:

1. **Core Infrastructure**
   - EventBus: Event-based communication system
   - SettingsManager: Manages plugin configuration
   - StorageManager: Handles data persistence
   - VaultFacade: Abstraction layer for Obsidian API operations

2. **MCP Integration**
   - MCPConnector: Handles communication with AI providers
   - BCPRegistry: Manages Bounded Context Packs for different domains
   - ToolManager: Manages available tools for AI models
   - AgentSystem: Routes and executes operations within Obsidian vault

3. **Chat Interface**
   - ChatView: Main UI component
   - MessageDisplay: Renders messages with Markdown support
   - ConversationManager: Manages conversation persistence
   - ToolCallVisualization: Shows tool execution results

## Key Components

### EventBus
Central event system that enables component communication. Components emit and listen for events to coordinate actions without tight coupling.

### VaultFacade
Abstraction layer for Obsidian's Vault, MetadataCache, and Workspace APIs. Provides simplified interfaces for operations like reading/writing notes, folder management, and search.

### AgentSystem
Manages execution of operations within the vault through specialized agents. Routes tool calls to appropriate agents and handles response formatting.

### MCPConnector
Handles communication with AI providers using the Model Context Protocol. Formats messages, processes responses, and routes tool calls to the Agent System.

### BCPRegistry
Manages domain-specific Bounded Context Packs that implement specific capabilities (e.g., note management, vault search, folder operations).

## Testing Approach

The project uses Jest as the testing framework with specialized utilities for UI testing:

- `setupUITestEnvironment()`: Prepares the test environment for UI components
- `createComponentMocks()`: Creates mock functions for Component methods
- Mock implementations for Obsidian API in `/tests/mocks`

Integration tests ensure components work together correctly:
- UI/Backend integration tests verify communication between UI and services
- End-to-end tests validate complete workflows

## Common Patterns

1. **Event-Based Communication**: Components communicate through typed events
2. **Dependency Injection**: Components receive dependencies at creation
3. **Adapter Pattern**: Abstract provider APIs behind common interfaces
4. **Facade Pattern**: Simplify complex subsystems (like VaultFacade)
5. **Repository Pattern**: Abstract data access through services
6. **Command Pattern**: Encapsulate operations as executable objects

## File Structure

- `src/` - Source code
  - `core/` - Core components (EventBus, SettingsManager, etc.)
  - `agents/` - Agent system implementation
  - `mcp/` - MCP integration components
  - `models/` - Data models and interfaces
  - `providers/` - Provider adapters for AI services
  - `ui/` - User interface components
  - `services/` - Service layer components
  - `utils/` - Utility functions