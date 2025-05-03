---
title: Chatsidian Plugin Architecture
description: A comprehensive architectural design for Chatsidian, a native chat interface for Obsidian with MCP integration
date: 2025-05-03
status: planning
tags:
  - architecture
  - obsidian-plugin
  - chat-interface
  - mcp
---

# Chatsidian: Native Chat Interface for Obsidian

## Overview

Chatsidian is an Obsidian plugin that provides a native chat interface within Obsidian, leveraging the Model Context Protocol (MCP) to enable AI assistants to take actions directly within the vault. Unlike Claudesidian, which connects the Claude Desktop app to an Obsidian vault, Chatsidian integrates the chat interface directly within Obsidian and allows for sequential or simultaneous CRUD operations.

## Key Features

- Native chat interface embedded directly within Obsidian
- Integration with AI models via the Model Context Protocol (MCP)
- Reuse of Claudesidian's agent architecture for vault operations
- Persistent conversation history and management
- Configurable settings for API keys, models, and preferences

## Architecture Documentation

### 1. Architecture
- [Architecture Overview](1_Architecture/Overview.md) - High-level system architecture and design principles
- [Component Designs](1_Architecture/Components/) - Detailed component-level architecture

### 2. Tests
- [Test Strategy](2_Tests/TestStrategy.md) - Overall approach to testing the plugin

### 3. Implementation
- [Phase 1: Core Framework](3_Implementation/Phase1.md) - Initial implementation of core components
- [Phase 2: Feature Implementation](3_Implementation/Phase2.md) - Implementation of main features
- [Phase 3: Integration and Refinement](3_Implementation/Phase3.md) - Integration with existing systems and refinement

### 4. Documentation
- [APIs](4_Documentation/APIs.md) - API documentation for plugin components
- [Data Models](4_Documentation/DataModels.md) - Documentation for data models and schemas

## Technology Stack

- **TypeScript** - Primary programming language
- **Obsidian API** - For plugin development and UI integration
- **Model Context Protocol** - For AI model integration
- **React** - For UI components (optional)

## Key Architectural Decisions

1. **Chat UI Implementation** - Native Obsidian views instead of web workers/iframes
2. **Agent System Reuse** - Leverage existing Claudesidian agent architecture
3. **Conversation Persistence** - JSON-based file storage in vault
4. **MCP Integration** - Direct API integration with AI providers
5. **Component Structure** - Modular design with clear separation of concerns