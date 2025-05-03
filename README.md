# Chatsidian

An Obsidian plugin for native chat with MCP integration.

## Features

- Native chat interface embedded directly within Obsidian
- Integration with AI models via the Model Context Protocol (MCP)
- Reuse of Claudesidian's agent architecture for vault operations
- Persistent conversation history and management
- Configurable settings for API keys, models, and preferences

## Installation

1. Download the latest release
2. Extract the zip file into your Obsidian plugins folder
3. Enable the plugin in Obsidian settings

## Development

### Prerequisites

- Node.js 16+
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/chatsidian.git
cd chatsidian

# Install dependencies
npm install

# Build the plugin
npm run build

# Run in development mode with auto-reload
npm run dev
```

## Testing

```bash
# Run tests
npm test

# Generate coverage report
npm run coverage
```

## Project Structure

- `src/` - Source code
  - `models/` - Data models and interfaces
  - `core/` - Core components (EventBus, SettingsManager, StorageManager)
  - `providers/` - Provider adapters for AI services
- `tests/` - Test files

## License

MIT
