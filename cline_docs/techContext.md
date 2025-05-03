# Technical Context: Chatsidian

*This file details the technologies used, development setup, technical constraints, and dependencies, based on initial project documentation.*

## Technology Stack

-   **Primary Language**: TypeScript
-   **Framework/Environment**: Obsidian Plugin API
-   **UI (Potential)**: React (mentioned as optional in Readme, but core UI seems to rely on native Obsidian views)
-   **AI Integration**: Model Context Protocol (MCP)
-   **Build System**: esbuild (from Phase 1.1 plan)
-   **Testing**: Jest (from Phase 1.1 plan)

## Development Setup

-   Requires a standard Node.js environment for TypeScript development, building, and testing.
-   Development involves using the Obsidian API and likely testing within an Obsidian development vault.
-   Build process managed by `esbuild.config.mjs`.
-   TypeScript configuration managed by `tsconfig.json`.
-   Plugin manifest defined in `manifest.json`.

## Technical Constraints

1.  **Obsidian API Limitations**:
    -   The plugin must operate within the capabilities and sandbox of the Obsidian Plugin API.
    -   Future changes to the Obsidian API could require updates to the plugin.
2.  **Performance**:
    -   Handling potentially large conversations and asynchronous tool operations needs careful performance management to avoid impacting Obsidian's responsiveness.
    -   Efficient data storage and retrieval within the vault are necessary.
3.  **Cross-Platform Compatibility**:
    -   The plugin must function correctly across all operating systems supported by Obsidian (Windows, macOS, Linux). Platform-specific considerations might be needed.
4.  **MCP Dependency**:
    -   Relies on AI providers supporting the Model Context Protocol.
    -   Requires robust handling of API communication, including errors and potentially streaming responses.

## Key Dependencies

-   **Obsidian API**: The core dependency for all plugin functionality.
-   **TypeScript**: Language and type system.
-   **esbuild**: Build tool.
-   **Jest**: Testing framework.
-   **AI Provider APIs**: Specific libraries or fetch implementations for interacting with MCP-compliant AI services (e.g., Anthropic, OpenAI).
