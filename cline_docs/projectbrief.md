# Project Brief: Chatsidian

*This file outlines the core requirements and goals for the Chatsidian project, derived from initial project documentation.*

## Project Goal

To create **Chatsidian**, an Obsidian plugin providing a native chat interface within Obsidian. This interface will leverage the Model Context Protocol (MCP) to enable AI assistants to interact with and perform actions directly within the user's Obsidian vault.

## Core Requirements

1.  **Native Obsidian Integration**: The chat interface must be embedded directly within Obsidian, following its design patterns and API usage for a seamless user experience.
2.  **MCP Integration**: Integrate with AI models via the Model Context Protocol (MCP) to facilitate communication and action-taking.
3.  **Agent-Based Vault Actions**: Utilize an agent system (reusing concepts from Claudesidian) with domain-specific Bounded Context Packs (BCPs) to perform CRUD operations and other actions within the vault (e.g., note management, folder operations, search).
4.  **Persistent Conversations**: Store and manage chat history reliably within the user's vault.
5.  **Configurability**: Allow users to configure settings such as API keys, model choices, and other preferences.
6.  **Performance**: Ensure the plugin is responsive and minimizes resource consumption.
7.  **Extensibility**: Design the architecture to allow for future expansion and integration with other plugins or features.
