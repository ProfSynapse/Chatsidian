/**
 * Chatsidian Plugin - Main Entry Point
 * 
 * This file serves as the main entry point for the Chatsidian plugin.
 * It initializes the plugin, registers commands, and manages the plugin lifecycle.
 * 
 * The plugin provides a native chat interface within Obsidian, leveraging the
 * Model Context Protocol (MCP) to enable AI assistants to perform actions within the vault.
 * 
 * @file This file defines the ChatsidianPlugin class that extends Obsidian's Plugin class.
 * @author Your Name
 * @version 0.1.0
 */

import { Plugin } from 'obsidian';
import { ChatsidianSettings, DEFAULT_SETTINGS } from './models/Settings';

/**
 * Main plugin class for Chatsidian.
 * Handles plugin initialization, command registration, and lifecycle management.
 */
export default class ChatsidianPlugin extends Plugin {
  /**
   * Plugin settings
   */
  settings: ChatsidianSettings;

  /**
   * Called when the plugin is loaded.
   * Initializes settings, registers commands, and sets up event listeners.
   */
  async onload() {
    console.log('Loading Chatsidian plugin');
    
    // Load settings
    await this.loadSettings();
    
    // Add command to open chat
    this.addCommand({
      id: 'open-chatsidian',
      name: 'Open Chatsidian',
      callback: () => {
        console.log('Chat interface not yet implemented');
      }
    });
    
    // Add ribbon icon
    this.addRibbonIcon('message-square', 'Chatsidian', () => {
      console.log('Chatsidian ribbon icon clicked');
      // Will later open the chat interface
    });
    
    console.log('Chatsidian plugin loaded');
  }
  
  /**
   * Called when the plugin is unloaded.
   * Cleans up resources and event listeners.
   */
  async onunload() {
    console.log('Unloading Chatsidian plugin');
  }
  
  /**
   * Loads plugin settings from Obsidian's data storage.
   */
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  
  /**
   * Saves plugin settings to Obsidian's data storage.
   */
  async saveSettings() {
    await this.saveData(this.settings);
  }
}
