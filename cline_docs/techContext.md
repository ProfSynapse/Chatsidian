# Technical Context: Chatsidian

*This file details the technologies used, development setup, technical constraints, and dependencies, based on initial project documentation.*

## Technology Stack

-   **Primary Language**: TypeScript
-   **Framework/Environment**: Obsidian Plugin API
-   **UI (Potential)**: React (mentioned as optional in Readme, but core UI seems to rely on native Obsidian views)
-   **AI Integration**: Model Context Protocol (MCP)
-   **Build System**: esbuild (configured in `esbuild.config.mjs`)
-   **Testing**: Jest (configured in `jest.config.js`)
-   **Linting**: ESLint (configured in `.eslintrc.js`)

## Development Setup

-   Requires a standard Node.js environment for TypeScript development, building, and testing.
-   Development involves using the Obsidian API and likely testing within an Obsidian development vault.
-   Build process managed by `esbuild.config.mjs`.
-   TypeScript configuration managed by `tsconfig.json`.
-   Plugin manifest defined in `manifest.json`.
-   Testing environment configured in `jest.config.js` with jsdom for UI components.
-   Mocks for Obsidian API in `tests/mocks/obsidian.ts` for testing without an actual Obsidian instance.

## Technical Constraints

1.  **Obsidian API Limitations**:
    -   The plugin must operate within the capabilities and sandbox of the Obsidian Plugin API.
    -   Future changes to the Obsidian API could require updates to the plugin.
    -   Obsidian's Component pattern must be followed for proper lifecycle management.
2.  **Performance**:
    -   Handling potentially large conversations and asynchronous tool operations needs careful performance management to avoid impacting Obsidian's responsiveness.
    -   Efficient data storage and retrieval within the vault are necessary.
    -   The VaultFacade abstraction layer helps optimize vault operations by using appropriate Obsidian API methods (e.g., cachedRead for better performance).
3.  **Cross-Platform Compatibility**:
    -   The plugin must function correctly across all operating systems supported by Obsidian (Windows, macOS, Linux).
    -   Path handling in the VaultFacade normalizes paths to ensure consistent behavior across platforms.
4.  **MCP Dependency**:
    -   Relies on AI providers supporting the Model Context Protocol.
    -   Requires robust handling of API communication, including errors and potentially streaming responses.
    -   Provider adapters abstract away the differences between AI providers.
5.  **TypeScript Access Modifiers**:
    -   TypeScript's access modifiers (private/protected) can cause issues at runtime when trying to test classes.
    -   For testing classes with private methods, we use a wrapper pattern (e.g., BCPRegistryForTests) that reimplements the necessary functionality rather than trying to access private methods directly.

## Key Dependencies

-   **Obsidian API**: The core dependency for all plugin functionality.
-   **TypeScript**: Language and type system.
-   **esbuild**: Build tool.
-   **Jest**: Testing framework.
-   **AI Provider SDKs**:
    -   OpenAI SDK: For interacting with OpenAI models.
    -   Anthropic SDK: For interacting with Anthropic models.
    -   Google Generative AI SDK: For interacting with Google Gemini models.
-   **js-yaml**: For loading model definitions from YAML files.

## Core Technical Components

### VaultFacade Abstraction Layer

The VaultFacade provides a simplified, consistent interface for all Obsidian vault operations, improving testability, maintainability, and performance of Chatsidian.

#### Key Technical Features

-   **Interface-Based Design**: The `IVaultFacade` interface defines a clear contract for vault operations, allowing for multiple implementations.
-   **Promise-Based API**: All methods return Promises for consistent asynchronous operation.
-   **Typed Event System**: Events are strongly typed with specific data structures for each event type.
-   **Error Hierarchy**: Custom error types for different failure scenarios, with consistent error propagation.
-   **Path Normalization**: Consistent path handling across the application, removing leading/trailing slashes and handling relative paths.
-   **Component Lifecycle Integration**: Extends Obsidian's Component class for proper resource cleanup.
-   **Mock Implementation**: `MockVaultFacade` provides an in-memory implementation for testing without requiring an actual Obsidian instance.

#### Technical Implementation Details

-   **File Structure**:
    -   `src/core/VaultFacadeInterface.ts`: Interface and type definitions.
    -   `src/core/VaultErrors.ts`: Custom error types.
    -   `src/core/VaultFacade.ts`: Implementation using Obsidian's API.
    -   `src/mocks/MockVaultFacade.ts`: Mock implementation for testing.
    -   `tests/core/VaultFacade.test.ts`: Unit tests.

-   **Key Methods**:
    -   `readNote`: Read a note by path, with optional frontmatter extraction.
    -   `createNote`: Create a new note, with optional overwrite.
    -   `updateNote`: Update a note's content.
    -   `deleteNote`: Delete a note (moves to trash).
    -   `renameNote`: Rename or move a note.
    -   `listFolder`: List files and folders in a directory.
    -   `createFolder`: Create a new folder.
    -   `deleteFolder`: Delete a folder.
    -   `searchContent`: Search content by query string.
    -   `searchByTag`: Search files by tag.
    -   `updateFrontmatter`: Update frontmatter of a note.
    -   `getAttachmentPath`: Get available path for an attachment.
    -   `fileExists`: Check if a file exists.
    -   `folderExists`: Check if a folder exists.
    -   `getParentFolder`: Get the parent folder of a path.
    -   `normalizePath`: Normalize a path.

-   **Event System**:
    -   Events for all vault operations (create, read, update, delete, rename).
    -   Events for external changes to the vault.
    -   Typed event data for better type safety.

-   **Performance Optimizations**:
    -   Uses `cachedRead` for better performance when just displaying content.
    -   Uses Obsidian's `MetadataCache` for efficient searching and frontmatter operations.
    -   Implements path normalization to avoid redundant operations.

### Provider Adapters System

The Provider Adapters system provides a unified interface for interacting with different AI providers, abstracting away the differences between them.

#### Key Technical Features

-   **Interface-Based Design**: The `ProviderAdapter` interface defines a clear contract for provider operations.
-   **Factory Pattern**: The `ProviderFactory` creates provider adapters based on the provider type.
-   **Centralized Model Definitions**: All model definitions are stored in a central YAML file.
-   **Streaming Support**: All providers support streaming responses.
-   **Tool/Function Calling Support**: All providers support tool/function calling.

### Storage Abstractions System

The Storage Abstractions system provides a unified interface for data persistence within the Obsidian vault.

#### Key Technical Features

-   **Error Hierarchy**: Custom error types for different failure scenarios.
-   **Utility Methods**: Helper methods for common storage operations.
-   **Event-Based Notifications**: Events for storage operations.
-   **Import/Export Support**: Support for importing and exporting conversations.

### Settings Management System

The Settings Management system provides a unified interface for managing plugin settings.

#### Key Technical Features

-   **Settings Validation**: Validation of settings to ensure they are valid.
-   **Settings Migration**: Migration of settings from previous versions.
-   **Settings Export/Import**: Support for exporting and importing settings.
-   **Settings Change Events**: Events for settings changes.
-   **Obsidian Settings Tab Integration**: Integration with Obsidian's settings tab system.

### Event Bus System

The Event Bus system provides a unified interface for event-based communication between components.

#### Key Technical Features

-   **Type-Safe Events**: Type-safe event definitions and handlers.
-   **Debug Logging**: Optional debug logging of events.
-   **Factory Methods**: Factory methods for creating different types of event buses.
