---
title: Chatsidian UI Design Guidelines
description: Design guidelines and user experience considerations for the Chatsidian chat interface
date: 2025-05-03
status: active
tags:
  - documentation
  - design
  - ui
  - user-experience
---

# Chatsidian UI Design Guidelines

## Design Principles

The Chatsidian UI follows these core design principles to ensure it feels like a native Obsidian component:

1. **Native Integration** - Use Obsidian's CSS variables and UI patterns
2. **Minimalism** - Keep the interface clean and uncluttered
3. **Flexibility** - Support different pane sizes and layouts
4. **Accessibility** - Ensure keyboard navigation and screen reader support
5. **Consistency** - Follow Obsidian's interaction patterns and iconography

## Color Palette

Chatsidian uses Obsidian's native CSS variables to ensure it adapts to any theme:

| UI Element | CSS Variable |
|------------|-------------|
| Background | `--background-primary` |
| Text | `--text-normal` |
| Muted Text | `--text-muted` |
| Borders | `--background-modifier-border` |
| Hover States | `--background-modifier-hover` |
| Accent Color | `--interactive-accent` |
| Error Text | `--text-error` |

## Typography

All text uses Obsidian's native font settings:

- Font Family: Inherited from Obsidian (CSS variable not exposed)
- Font Size: `--font-text-size`
- Line Height: `--line-height`

## Component Guidelines

### Chat Messages

- **User Messages**: Right-aligned with accent color background
- **Assistant Messages**: Left-aligned with form field background color
- **System Messages**: Centered with muted styling
- **Message Actions**: Appear on hover (copy, retry)
- **Timestamps**: Subtle text above each message

### Input Area

- Autogrows with content (up to a maximum height)
- Submit on Enter (Shift+Enter for new line)
- Disable while processing response
- Clear after sending

### Conversation Management

- Sidebar with organized sections (starred, folders, ungrouped)
- Drag and drop for organization
- Context menus for additional actions
- Star button for important conversations

### Tool Visualization

- Collapsible sections for tool calls
- Clear status indicators (pending, running, done, error)
- Code-style formatting for JSON inputs/outputs
- Error indicators with actionable messages

## Interaction Patterns

### Keyboard Shortcuts

- **Enter**: Send message
- **Shift+Enter**: New line in input
- **Escape**: Close sidebars/modals
- **Alt+N** (or platform equivalent): New conversation

### Mouse Interactions

- **Click**: Select conversation/folder
- **Right-click**: Open context menu
- **Drag**: Reorder/move conversations
- **Hover**: Reveal actions

### Touch Support

- Touch areas sized appropriately for touch interaction
- Swipe gestures for navigation
- Long press for context menus

## Responsive Design

The interface adapts to different pane sizes:

- **Small**: Hide selectors, show only essential controls
- **Medium**: Show selectors and basic controls
- **Large**: Show full interface with sidebars

## Dark/Light Mode Support

Since Chatsidian uses Obsidian's CSS variables, it automatically adapts to:

- Dark themes
- Light themes
- High contrast themes
- Custom themes

## Animation Guidelines

Animations are subtle and purpose-driven:

- Typing indicator with bouncing dots
- Smooth transitions for expanding/collapsing elements
- Subtle hover state transitions
- No animations when reduced motion setting is enabled

## Icon Usage

All icons are from Obsidian's Lucide icon set to ensure consistency:

| Function | Icon |
|----------|------|
| Chat | message-square |
| Send | arrow-right |
| New | plus |
| Menu | menu |
| Star | star |
| Copy | copy |
| Retry | refresh-cw |
| Folder | folder |
| Settings | settings |

## Accessibility Considerations

- All interactive elements have appropriate ARIA labels
- Color contrast follows WCAG guidelines
- Keyboard navigation for all functions
- Screen reader support for messages and actions

## Implementation Details

- CSS uses Obsidian's BEM-like naming convention (`chatsidian-component-element`)
- JavaScript components follow Obsidian's patterns
- Event system for component communication
- Native DOM API for UI construction

These guidelines ensure that Chatsidian feels like a native part of the Obsidian interface while providing a powerful, intuitive chat experience.
