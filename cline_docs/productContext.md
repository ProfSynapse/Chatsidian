# Product Context: Chatsidian

*This file describes why Chatsidian exists, the problems it solves, how it should work, and user experience goals, based on initial project documentation.*

## Why Chatsidian?

Obsidian users currently lack a deeply integrated chat interface that can directly interact with their vault content using modern AI capabilities. While solutions like Claudesidian connect external applications, Chatsidian aims to provide this functionality *natively* within Obsidian itself.

## Problems Solved

1.  **Lack of Native Chat:** Provides a chat UI directly within the Obsidian workspace, eliminating the need to switch between applications.
2.  **Limited AI Vault Interaction:** Enables AI assistants (via MCP) to perform complex, sequential, or simultaneous CRUD operations and other actions directly on notes, folders, and other vault elements, going beyond simple read/write capabilities.
3.  **Fragmented Workflow:** Consolidates AI-assisted note-taking, research, and content generation within the Obsidian environment.

## How It Should Work

-   Users interact with an AI model through a familiar chat interface located in an Obsidian view (e.g., sidebar or main panel).
-   The AI assistant, powered by MCP and configured BCPs, can understand requests related to the vault and execute actions like creating notes, searching content, summarizing text, managing folders, etc.
-   Conversations are saved persistently within the vault, allowing users to revisit past interactions.
-   The plugin integrates seamlessly with Obsidian's APIs for vault operations, commands, and UI elements.

## User Experience Goals

1.  **Native Look and Feel:** The interface should feel like a natural part of Obsidian, adhering to its design language and conventions.
2.  **Intuitive Interaction:** Chatting with the AI and understanding its actions (including tool calls) should be straightforward.
3.  **Seamless Integration:** Interacting with the vault via the AI should feel fluid and integrated into the user's existing Obsidian workflow.
4.  **Performance:** The chat interface and AI interactions should be responsive and not hinder Obsidian's overall performance.
5.  **Reliability:** Conversation history and plugin settings should be saved reliably within the vault.
