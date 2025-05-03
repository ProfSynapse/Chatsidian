---
title: Chatsidian User Guide
description: Comprehensive guide to using the Chatsidian plugin for Obsidian
date: 2025-05-03
status: active
tags:
  - documentation
  - user-guide
  - chatsidian
  - getting-started
---

# Chatsidian User Guide

## Introduction

Chatsidian is a powerful chat interface for Obsidian that uses the Model Context Protocol (MCP) to enable AI assistants to take actions directly within your vault. This guide will help you get started with Chatsidian and make the most of its features.

## Getting Started

### Installation

1. Open Obsidian Settings
2. Go to "Community Plugins"
3. Click "Browse" and search for "Chatsidian"
4. Click "Install"
5. Enable the plugin

### Opening Chatsidian

There are three ways to open Chatsidian:

1. Click the message icon (💬) in the left sidebar
2. Use the command palette (Ctrl/Cmd+P) and search for "Open Chatsidian"
3. Use the hotkey if you've assigned one in Obsidian's hotkey settings

## Interface Overview

The Chatsidian interface consists of:

- **Sidebar** (toggle with hamburger menu): For browsing conversations
- **Header**: Contains selectors for conversations, models, and agents
- **Message Area**: Displays the conversation history
- **Input Area**: For typing and sending messages

### Sidebar

The sidebar organizes your conversations into three sections:

1. **Starred**: Important conversations you've marked
2. **Folders**: Custom folders for organizing conversations
3. **Conversations**: Ungrouped conversations

You can:
- Star/unstar conversations using the star icon
- Create folders with the folder+ icon
- Drag conversations between folders
- Right-click for more options (rename, delete, move)

### Header Controls

The header includes:

- **Conversation Selector**: Switch between active conversations
- **Model Selector**: Choose which AI model to use
- **Agent Selector**: Select a specialized agent for specific tasks
- **New Chat Button**: Start a fresh conversation
- **Star Button**: Star the current conversation

### Messages

Messages are color-coded by sender:

- **Your Messages**: Right-aligned in accent color
- **Assistant Messages**: Left-aligned in neutral color
- **System Messages**: Centered with muted styling

Each message has:
- A timestamp showing when it was sent
- Action buttons that appear on hover (copy, retry)
- Tool call visualizations (when the AI uses vault tools)

### Input Area

The input area features:

- An auto-growing text field
- A send button
- Support for multi-line input (Shift+Enter for new line)

## Using Chatsidian

### Basic Conversation

1. Type your message in the input area
2. Press Enter or click Send
3. Wait for the assistant's response
4. Continue the conversation

### Using Different Models

1. Click the model selector in the header
2. Choose from available models
3. The current conversation will use the selected model going forward

### Using Specialized Agents

1. Click the agent selector in the header
2. Choose a specialized agent:
   - **VaultNavigator**: Expert in finding content in your vault
   - **ContentForge**: Specialized in content creation
   - **ResearchSynthesis**: For research and knowledge synthesis
   - **ProjectOrchestrator**: For project management
   - **MetaTagManager**: For metadata and tagging
   - **DataVizAnalyst**: For data analysis and visualization

Each agent has specialized capabilities tailored to specific tasks.

### Working with Tool Calls

When the AI assistant uses tools to interact with your vault, you'll see:

1. Tool call visualizations showing:
   - The tool being used
   - Arguments provided to the tool
   - Results returned by the tool
   - Status indicators (pending, running, completed, error)

2. You can:
   - Click on file paths to open them in Obsidian
   - Expand/collapse tool call sections
   - See detailed error messages if something goes wrong

### Managing Conversations

To organize your conversations:

1. **Create folders**:
   - Click the folder+ icon in the sidebar
   - Enter a name for the folder
   - Click Create

2. **Move conversations**:
   - Drag a conversation to a folder
   - Or right-click and select "Move to..."

3. **Star important conversations**:
   - Click the star icon on a conversation
   - Starred conversations appear in the Starred section

4. **Rename conversations**:
   - Right-click a conversation
   - Select "Rename"
   - Enter a new name
   - Click Save

5. **Delete conversations**:
   - Right-click a conversation
   - Select "Delete"
   - Confirm deletion

## Configuring Chatsidian

### Agent Tools Settings

You can configure which tools are available to each agent:

1. Open Obsidian Settings
2. Go to the Chatsidian tab
3. Under "Agent Tool Settings", toggle tools for each agent:
   - **Note Reader**: Read note contents
   - **Note Editor**: Edit note contents
   - **Vault Manager**: Create, delete, and move files
   - **Vault Librarian**: Search vault content
   - **Palette Commander**: Execute commands from the palette
   - **Project Manager**: Create project plans and checkpoints

### Model Settings

Configure AI models in the settings:

1. Open Obsidian Settings
2. Go to the Chatsidian tab
3. Under "Model Settings", add and configure models:
   - API keys
   - Model parameters
   - Default model selection

## Tips and Tricks

- **Retry feature**: Click the retry icon on your message to put its content back in the input field
- **Copy messages**: Click the copy icon to copy message content to clipboard
- **Multiple windows**: You can open Chatsidian in multiple panes for different conversations
- **Keyboard navigation**: Use Tab to navigate between UI elements
- **Drag to resize**: Resize the sidebar by dragging its edge

## Troubleshooting

- **Message errors**: If a message fails to send, an error will appear with details
- **Tool errors**: If a tool fails, check the error message for details on what went wrong
- **API issues**: Verify your API keys are correctly configured in settings
- **Performance**: For large vaults, consider limiting tool access to improve performance

## Getting Help

- Join the Obsidian Discord for community support
- Check the GitHub repository for known issues
- Submit bug reports through the GitHub issues page

We hope this guide helps you make the most of Chatsidian. Happy chatting!
