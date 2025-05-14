/**
 * ConversationListDragDrop Component
 * 
 * This component handles drag and drop functionality for the conversation list,
 * allowing users to drag conversations between folders.
 */

import { ConversationListActions } from './ConversationListActions';

export class ConversationListDragDrop {
  private containerEl: HTMLElement;
  private actions: ConversationListActions;
  
  constructor(containerEl: HTMLElement, actions: ConversationListActions) {
    this.containerEl = containerEl;
    this.actions = actions;
    
    this.setupContainerDragAndDrop();
  }
  
  /**
   * Setup drag and drop for the container to allow dropping conversations at root level
   */
  private setupContainerDragAndDrop(): void {
    // Add dragover event to show when an item can be dropped
    this.containerEl.addEventListener('dragover', (event) => {
      // Only accept dragover if it's directly on the container, not its children
      if (event.target === this.containerEl) {
        event.preventDefault();
        this.containerEl.addClass('chatsidian-drop-target');
      }
    });
    
    // Add dragleave event to remove highlighting
    this.containerEl.addEventListener('dragleave', (event) => {
      if (event.target === this.containerEl) {
        this.containerEl.removeClass('chatsidian-drop-target');
      }
    });
    
    // Add drop event to handle when an item is dropped
    this.containerEl.addEventListener('drop', (event) => {
      // Only accept drops if it's directly on the container, not its children
      if (event.target === this.containerEl) {
        event.preventDefault();
        this.containerEl.removeClass('chatsidian-drop-target');
        
        // Get the dragged data
        const data = event.dataTransfer?.getData('text/plain');
        
        if (data) {
          try {
            const dragData = JSON.parse(data);
            
            console.log('Drop detected on container:', dragData);
            
            // Handle conversation drop - move to root level (null folderId)
            if (dragData.type === 'conversation') {
              console.log(`Moving conversation ${dragData.id} to root level`);
              this.actions.moveConversationToFolder(dragData.id, null);
            }
          } catch (error) {
            console.error('Failed to parse drag data:', error);
          }
        }
      }
    });
  }
  
  /**
   * Setup drag and drop for a folder element
   * 
   * @param folderEl - The folder element
   * @param folderId - The folder ID
   */
  public setupFolderDragAndDrop(folderEl: HTMLElement, folderId: string): void {
    // Make folder a drop target
    folderEl.setAttribute('draggable', 'true');
    
    // Add dragover event to highlight drop target
    folderEl.addEventListener('dragover', (event) => {
      event.preventDefault();
      folderEl.addClass('chatsidian-drop-target');
    });
    
    // Add dragleave event to remove highlighting
    folderEl.addEventListener('dragleave', () => {
      folderEl.removeClass('chatsidian-drop-target');
    });
    
    // Add drop event handler
    folderEl.addEventListener('drop', (event) => {
      event.preventDefault();
      folderEl.removeClass('chatsidian-drop-target');
      
      // Get the dragged data
      const data = event.dataTransfer?.getData('text/plain');
      
      if (data) {
        try {
          const dragData = JSON.parse(data);
          
          // Handle conversation drop
          if (dragData.type === 'conversation') {
            console.log(`Moving conversation ${dragData.id} to folder ${folderId}`);
            this.actions.moveConversationToFolder(dragData.id, folderId);
          }
          
          // Handle folder drop (not implemented yet)
          if (dragData.type === 'folder') {
            console.log(`TODO: Move folder ${dragData.id} to folder ${folderId}`);
            // TODO: Implement folder nesting
          }
        } catch (error) {
          console.error('Failed to parse drag data:', error);
        }
      }
    });
    
    // Add dragstart event for the folder itself
    folderEl.addEventListener('dragstart', (event) => {
      // Set data for drag operation
      event.dataTransfer?.setData('text/plain', JSON.stringify({
        type: 'folder',
        id: folderId
      }));
    });
  }
  
  /**
   * Setup drag and drop for a conversation element
   * 
   * @param conversationEl - The conversation element
   * @param conversationId - The conversation ID
   */
  public setupConversationDragAndDrop(conversationEl: HTMLElement, conversationId: string): void {
    // Make conversation draggable
    conversationEl.setAttribute('draggable', 'true');
    
    // Add dragstart event
    conversationEl.addEventListener('dragstart', (event) => {
      // Set data for drag operation
      event.dataTransfer?.setData('text/plain', JSON.stringify({
        type: 'conversation',
        id: conversationId
      }));
    });
  }
}