/**
 * Folder Manager Module
 * 
 * This module handles folder-related operations for the conversation list:
 * - Creating folders
 * - Renaming folders
 * - Deleting folders
 * - Moving conversations between folders
 * - Folder expansion/collapse state
 * 
 * It provides a clean API for folder management without cluttering the main component.
 */

import { Notice } from 'obsidian';
import { ConversationFolder } from '../../models/Conversation';
import { StorageManager } from '../../core/StorageManager';
import { EventBus } from '../../core/EventBus';
import { ConversationListEventType } from './types';

/**
 * FolderManager class for managing conversation folders
 */
export class FolderManager {
  private storageManager: StorageManager;
  private eventBus: EventBus;
  private folders: ConversationFolder[] = [];
  private expandedFolderIds: Set<string> = new Set();
  
  /**
   * Create a new FolderManager
   * 
   * @param storageManager - Storage manager for persisting folders
   * @param eventBus - Event bus for component communication
   */
  constructor(storageManager: StorageManager, eventBus: EventBus) {
    this.storageManager = storageManager;
    this.eventBus = eventBus;
  }
  
  /**
   * Load folders from storage
   * 
   * @returns Promise that resolves when folders are loaded
   */
  public async loadFolders(): Promise<ConversationFolder[]> {
    try {
      // Load folders from storage
      const storedFolders = await this.storageManager.getFolders();
      this.folders = storedFolders;
      return this.folders;
    } catch (error) {
      console.error('Failed to load folders:', error);
      this.folders = [];
      return [];
    }
  }
  
  /**
   * Get all folders
   * 
   * @returns All folders
   */
  public getFolders(): ConversationFolder[] {
    return [...this.folders];
  }
  
  /**
   * Get expanded folder IDs
   * 
   * @returns Set of expanded folder IDs
   */
  public getExpandedFolderIds(): Set<string> {
    return new Set(this.expandedFolderIds);
  }
  
  /**
   * Create a new folder
   * 
   * @param name - Optional name for the new folder
   * @param parentId - Optional parent folder ID
   * @returns Promise that resolves with the new folder
   */
  public async createFolder(name?: string, parentId?: string): Promise<ConversationFolder> {
    try {
      // Create a new folder using StorageManager
      const folderName = name || 'New Folder';
      const newFolder = await this.storageManager.createFolder({
        name: folderName,
        parentId: parentId
      });
      
      // Add to local folders list
      this.folders.push(newFolder);
      
      // Expand the folder
      this.expandedFolderIds.add(newFolder.id);
      
      // Emit event
      this.eventBus.emit(ConversationListEventType.FOLDER_CREATED, newFolder);
      
      return newFolder;
    } catch (error) {
      console.error('Failed to create new folder:', error);
      new Notice('Failed to create new folder');
      throw error;
    }
  }
  
  /**
   * Rename a folder
   * 
   * @param folderId - The ID of the folder to rename
   * @param newName - The new name for the folder
   * @returns Promise that resolves when the folder is renamed
   */
  public async renameFolder(folderId: string, newName: string): Promise<void> {
    try {
      // Find the folder
      const folder = this.folders.find(f => f.id === folderId);
      
      if (!folder) {
        console.error(`Folder with ID ${folderId} not found`);
        return;
      }
      
      if (!newName || newName === folder.name) {
        return;
      }
      
      // Update folder name
      const updatedFolder = {
        ...folder,
        name: newName,
        modifiedAt: Date.now()
      };
      
      // Save folder
      await this.storageManager.saveFolder(updatedFolder);
      
      // Update local folder
      folder.name = newName;
      folder.modifiedAt = Date.now();
      
      // Emit event
      this.eventBus.emit(ConversationListEventType.FOLDER_RENAMED, updatedFolder);
    } catch (error) {
      console.error(`Failed to rename folder ${folderId}:`, error);
      new Notice(`Failed to rename folder: ${error.message}`);
    }
  }
  
  /**
   * Delete a folder
   * 
   * @param folderId - The ID of the folder to delete
   * @returns Promise that resolves when the folder is deleted
   */
  public async deleteFolder(folderId: string): Promise<void> {
    try {
      // Find the folder
      const folderIndex = this.folders.findIndex(f => f.id === folderId);
      
      if (folderIndex === -1) {
        console.error(`Folder with ID ${folderId} not found`);
        return;
      }
      
      // Get the folder before removing it
      const deletedFolder = this.folders[folderIndex];
      
      // Delete the folder using StorageManager
      await this.storageManager.deleteFolder(folderId);
      
      // Remove from local folders list
      this.folders.splice(folderIndex, 1);
      
      // Remove from expanded folders
      this.expandedFolderIds.delete(folderId);
      
      // Emit event
      this.eventBus.emit(ConversationListEventType.FOLDER_DELETED, deletedFolder);
    } catch (error) {
      console.error(`Failed to delete folder ${folderId}:`, error);
      new Notice(`Failed to delete folder: ${error.message}`);
    }
  }
  
  /**
   * Toggle folder expansion
   * 
   * @param folderId - The ID of the folder to toggle
   */
  public toggleFolderExpansion(folderId: string): void {
    if (this.expandedFolderIds.has(folderId)) {
      this.expandedFolderIds.delete(folderId);
    } else {
      this.expandedFolderIds.add(folderId);
    }
  }
  
  /**
   * Move a conversation to a folder
   * 
   * @param conversationId - The ID of the conversation to move
   * @param folderId - The ID of the folder to move to, or null to ungroup
   * @returns Promise that resolves when the conversation is moved
   */
  public async moveConversationToFolder(conversationId: string, folderId: string | null): Promise<void> {
    try {
      // If folderId is not null, verify folder exists
      if (folderId !== null && !this.folders.some(f => f.id === folderId)) {
        console.error(`Folder with ID ${folderId} not found`);
        return;
      }
      
      // Move conversation to folder
      await this.storageManager.moveConversationToFolder(
        conversationId,
        folderId
      );
      
      // Emit event
      this.eventBus.emit(ConversationListEventType.CONVERSATION_MOVED, {
        conversationId,
        folderId
      });
    } catch (error) {
      console.error(`Failed to move conversation ${conversationId}:`, error);
      new Notice(`Failed to move conversation: ${error.message}`);
    }
  }
  
  /**
   * Get child folders for a parent folder
   * 
   * @param parentId - Parent folder ID, or null for root folders
   * @returns Child folders
   */
  public getChildFolders(parentId: string | null): ConversationFolder[] {
    return this.folders.filter(folder => folder.parentId === parentId);
  }
  
  /**
   * Check if a folder is expanded
   * 
   * @param folderId - Folder ID
   * @returns True if the folder is expanded
   */
  public isFolderExpanded(folderId: string): boolean {
    return this.expandedFolderIds.has(folderId);
  }
}
