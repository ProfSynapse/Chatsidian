# Chatsidian Data Models

This directory contains the core TypeScript interfaces and utility classes that define the data structures used throughout the Chatsidian plugin. These models ensure type safety and consistency for conversations, AI provider interactions, and plugin settings.

## Core Models

-   **`Conversation.ts`**: Defines `Conversation`, `Message`, `MessageRole`, `ToolCall`, and `ToolResult` interfaces, along with `ConversationUtils` for creating and managing conversation data. Includes integration points for Obsidian (`TFile`, `path`).
-   **`Provider.ts`**: Defines interfaces for interacting with AI provider APIs (`ProviderMessage`, `ProviderRequest`, `ProviderResponse`, `ProviderChunk`, `ProviderError`), metadata for models (`ModelInfo`), and a list of common models (`COMMON_MODELS`).
-   **`Settings.ts`**: Defines the `ChatsidianSettings` interface, `DEFAULT_SETTINGS`, and `SettingsUtils` for validation. Includes `loadSettings` and `prepareSettingsForSave` for integration with Obsidian's data persistence.

## Model Relationships

### Conversation & Message Structure

```mermaid
graph TD
    Conversation -->|contains| Messages(Message Array);
    Messages --> Message;
    Message -->|optional| ToolCalls(ToolCall Array);
    Message -->|optional| ToolResults(ToolResult Array);
    ToolCalls --> ToolCall;
    ToolResults --> ToolResult;
    ToolResult -->|references| ToolCall;

    subgraph Conversation
        direction LR
        id1[id: string]
        title[title: string]
        createdAt[createdAt: number]
        modifiedAt[modifiedAt: number]
        metadata[metadata?: Record]
        file[file?: TFile]
        path[path?: string]
        Messages
    end

    subgraph Message
        direction LR
        id2[id: string]
        role[role: MessageRole]
        content[content: string]
        timestamp[timestamp: number]
        ToolCalls
        ToolResults
    end

    subgraph ToolCall
        direction LR
        id3[id: string]
        name[name: string]
        arguments[arguments: any]
        status[status: 'pending' | 'success' | 'error']
    end

    subgraph ToolResult
        direction LR
        id4[id: string]
        toolCallId[toolCallId: string]
        content[content: any]
        error[error?: string]
    end
```

### Provider Interaction Structure

```mermaid
graph TD
    ProviderRequest -->|contains| ProviderMessages(ProviderMessage Array);
    ProviderMessages --> ProviderMessage;
    ProviderResponse -->|contains| RespMessage(ProviderMessage);
    ProviderResponse -->|optional| RespToolCalls(ToolCall Array);
    ProviderChunk -->|contains| Delta;

    subgraph ProviderRequest
        direction LR
        ProviderMessages
        model[model: string]
        temp[temperature?: number]
        maxTok[maxTokens?: number]
        tools[tools?: any[]]
        stream[stream?: boolean]
    end

    subgraph ProviderMessage
        direction LR
        role[role: string]
        content[content: string]
        provToolCalls[toolCalls?: any[]]
        provToolResults[toolResults?: any[]]
    end

    subgraph ProviderResponse
        direction LR
        id[id: string]
        RespMessage
        RespToolCalls
    end

     subgraph ProviderChunk
        direction LR
        id_chunk[id: string]
        Delta
    end

    subgraph Delta
        direction LR
        content_delta[content?: string]
        toolCalls_delta[toolCalls?: any[]]
    end
```

### Settings Structure

```mermaid
graph TD
    ChatsidianSettings --> APIConfig[API Configuration];
    ChatsidianSettings --> ConvConfig[Conversation Settings];
    ChatsidianSettings --> UIConfig[UI Settings];
    ChatsidianSettings --> AdvConfig[Advanced Settings];

    subgraph APIConfig
        direction LR
        provider[provider: string]
        apiKey[apiKey: string]
        apiEndpoint[apiEndpoint?: string]
        model[model: string]
    end

    subgraph ConvConfig
        direction LR
        folder[conversationsFolder: string]
        maxMsg[maxMessages: number]
        sysPrompt[defaultSystemPrompt: string]
    end

    subgraph UIConfig
        direction LR
        theme[theme: string]
        fontSize[fontSize: number]
        timestamps[showTimestamps: boolean]
    end

    subgraph AdvConfig
        direction LR
        debug[debugMode: boolean]
        bcps[autoLoadBCPs: string[]]
        temp[defaultTemperature: number]
        maxTok[defaultMaxTokens: number]
    end
```

## Usage Patterns

### Creating a New Conversation

```typescript
import { ConversationUtils, MessageRole } from './Conversation';

// Create a new conversation
const conversation = ConversationUtils.createNew('My First Chat');

// Add a user message
const userMessage = ConversationUtils.createMessage(MessageRole.User, 'Hello, Chatsidian!');
const updatedConversation = ConversationUtils.addMessage(conversation, userMessage);

console.log(updatedConversation);
```

### Working with Settings

```typescript
import { DEFAULT_SETTINGS, SettingsUtils, loadSettings, prepareSettingsForSave } from './Settings';

// Simulate loading data from Obsidian
const loadedDataFromObsidian = { apiKey: 'user-api-key', fontSize: 16 };

// Load and validate settings
const currentSettings = loadSettings(loadedDataFromObsidian);
console.log('Loaded Settings:', currentSettings);

// Modify a setting
currentSettings.theme = 'dark';

// Prepare settings for saving
const settingsToSave = prepareSettingsForSave(currentSettings);
console.log('Settings to Save:', settingsToSave);

// In a real scenario, you would use Obsidian's saveData(settingsToSave)
```

### Making Provider Requests (Conceptual)

```typescript
import { ProviderRequest, ProviderMessage } from './Provider';
import { Message, MessageRole } from './Conversation'; // Assuming you have internal messages

// Example internal messages
const internalMessages: Message[] = [
  { id: '1', role: MessageRole.System, content: 'You are helpful.', timestamp: Date.now() },
  { id: '2', role: MessageRole.User, content: 'Explain quantum physics.', timestamp: Date.now() },
];

// Convert internal messages to provider format (implementation needed)
function convertToProviderMessages(messages: Message[]): ProviderMessage[] {
  return messages.map(msg => ({
    role: msg.role, // Assuming roles map directly for this provider
    content: msg.content,
    // Add tool call/result conversion if necessary
  }));
}

// Create a request payload
const request: ProviderRequest = {
  messages: convertToProviderMessages(internalMessages),
  model: 'claude-3-opus-20240229', // From settings or user selection
  temperature: 0.7, // From settings
  maxTokens: 4000, // From settings
  stream: false, // Or true, depending on desired behavior
  // tools: [...] // Add tool definitions if applicable
};

// Send the request using an API client (implementation elsewhere)
// const response = await apiClient.sendRequest(request);
