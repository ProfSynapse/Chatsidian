/**
 * Modals for the Chatsidian Conversation UI
 * 
 * This file contains modal dialog implementations used by the conversation management UI
 * for operations like creating folders, renaming folders and renaming conversations.
 */

import { App, Modal, Setting } from 'obsidian';

/**
 * Modal for creating a new folder
 */
export class FolderCreationModal extends Modal {
  private folderName: string = 'New Folder';
  private onSubmit: (folderName: string) => void;

  constructor(app: App, onSubmit: (folderName: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    
    contentEl.empty();
    contentEl.addClass('chatsidian-folder-modal');
    
    contentEl.createEl('h2', { text: 'Create Folder' });
    
    // Error message element (hidden initially)
    const errorEl = contentEl.createDiv({ cls: 'chatsidian-modal-error' });
    errorEl.hide();
    
    const nameInput = new Setting(contentEl)
      .setName('Folder name')
      .addText(text => {
        // Store the text component and update value
        const textComponent = text
          .setValue(this.folderName)
          .onChange(value => {
            this.folderName = value;
            // Hide error when user starts typing
            errorEl.hide();
          });
          
        // Focus input with delay to ensure DOM is ready
        setTimeout(() => {
          if (textComponent.inputEl) {
            textComponent.inputEl.focus();
            textComponent.inputEl.select();
          }
        }, 50);
        
        return textComponent;
      });
    
    const buttonContainer = contentEl.createDiv({ cls: 'chatsidian-modal-button-container' });
    
    // Cancel button
    buttonContainer.createEl('button', { text: 'Cancel' })
      .addEventListener('click', () => {
        this.close();
      });
    
    // Create button
    const createButton = buttonContainer.createEl('button', { 
      cls: 'mod-cta',
      text: 'Create' 
    });
    
    createButton.addEventListener('click', async () => {
      if (!this.folderName.trim()) {
        errorEl.setText('Folder name cannot be empty');
        errorEl.show();
        return;
      }
      
      try {
        await this.onSubmit(this.folderName);
        this.close();
      } catch (error) {
        console.error('Error creating folder:', error);
        errorEl.setText(error.message || 'Error creating folder');
        errorEl.show();
      }
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

/**
 * Modal for renaming a folder
 */
export class FolderRenameModal extends Modal {
  private folderName: string;
  private onSubmit: (newName: string) => void;

  constructor(app: App, currentName: string, onSubmit: (newName: string) => void) {
    super(app);
    this.folderName = currentName;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    
    contentEl.empty();
    contentEl.addClass('chatsidian-folder-modal');
    
    contentEl.createEl('h2', { text: 'Rename Folder' });
    
    // Error message element (hidden initially)
    const errorEl = contentEl.createDiv({ cls: 'chatsidian-modal-error' });
    errorEl.hide();
    
    new Setting(contentEl)
      .setName('New name')
      .addText(text => {
        // Store the text component and update value
        const textComponent = text
          .setValue(this.folderName)
          .onChange(value => {
            this.folderName = value;
            // Hide error when user starts typing
            errorEl.hide();
          });
          
        // Focus input with delay to ensure DOM is ready
        setTimeout(() => {
          if (textComponent.inputEl) {
            textComponent.inputEl.focus();
            textComponent.inputEl.select();
          }
        }, 50);
        
        return textComponent;
      });
    
    const buttonContainer = contentEl.createDiv({ cls: 'chatsidian-modal-button-container' });
    
    // Cancel button
    buttonContainer.createEl('button', { text: 'Cancel' })
      .addEventListener('click', () => {
        this.close();
      });
    
    // Rename button
    const renameButton = buttonContainer.createEl('button', { 
      cls: 'mod-cta',
      text: 'Rename' 
    });
    
    renameButton.addEventListener('click', async () => {
      if (!this.folderName.trim()) {
        errorEl.setText('Folder name cannot be empty');
        errorEl.show();
        return;
      }
      
      try {
        await this.onSubmit(this.folderName);
        this.close();
      } catch (error) {
        console.error('Error renaming folder:', error);
        errorEl.setText(error.message || 'Error renaming folder');
        errorEl.show();
      }
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

/**
 * Modal for renaming a conversation
 */
export class ConversationRenameModal extends Modal {
  private conversationTitle: string;
  private onSubmit: (newTitle: string) => void;

  constructor(app: App, currentTitle: string, onSubmit: (newTitle: string) => void) {
    super(app);
    this.conversationTitle = currentTitle;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    
    contentEl.empty();
    contentEl.addClass('chatsidian-conversation-modal');
    
    contentEl.createEl('h2', { text: 'Rename Chat' });
    
    // Error message element (hidden initially)
    const errorEl = contentEl.createDiv({ cls: 'chatsidian-modal-error' });
    errorEl.hide();
    
    new Setting(contentEl)
      .setName('New title')
      .addText(text => {
        // Store the text component and update value
        const textComponent = text
          .setValue(this.conversationTitle)
          .onChange(value => {
            this.conversationTitle = value;
            // Hide error when user starts typing
            errorEl.hide();
          });
          
        // Focus input with delay to ensure DOM is ready
        setTimeout(() => {
          if (textComponent.inputEl) {
            textComponent.inputEl.focus();
            textComponent.inputEl.select();
          }
        }, 50);
        
        return textComponent;
      });
    
    const buttonContainer = contentEl.createDiv({ cls: 'chatsidian-modal-button-container' });
    
    // Cancel button
    buttonContainer.createEl('button', { text: 'Cancel' })
      .addEventListener('click', () => {
        this.close();
      });
    
    // Rename button
    const renameButton = buttonContainer.createEl('button', { 
      cls: 'mod-cta',
      text: 'Rename' 
    });
    
    renameButton.addEventListener('click', async () => {
      if (!this.conversationTitle.trim()) {
        errorEl.setText('Conversation title cannot be empty');
        errorEl.show();
        return;
      }
      
      try {
        await this.onSubmit(this.conversationTitle);
        this.close();
      } catch (error) {
        console.error('Error renaming conversation:', error);
        errorEl.setText(error.message || 'Error renaming conversation');
        errorEl.show();
      }
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}