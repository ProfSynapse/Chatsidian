/**
 * VaultFacade.test.ts
 * 
 * This file contains tests for the VaultFacade class, which provides a simplified
 * interface for Obsidian vault operations. The tests use the MockVaultFacade
 * implementation to verify the functionality without requiring an actual Obsidian instance.
 */

import { MockVaultFacade } from '../../src/mocks/MockVaultFacade';
import { 
  FileNotFoundError, 
  FileExistsError, 
  FolderNotFoundError 
} from '../../src/core/VaultErrors';
import { VaultFacadeEventType } from '../../src/core/VaultFacadeInterface';

describe('VaultFacade', () => {
  let vaultFacade: MockVaultFacade;
  
  beforeEach(() => {
    // Create a new MockVaultFacade for each test
    vaultFacade = new MockVaultFacade();
  });
  
  describe('Note operations', () => {
    test('createNote should create a new note', async () => {
      const path = 'test.md';
      const content = 'Test content';
      
      const result = await vaultFacade.createNote(path, content);
      
      expect(result.path).toBe(path);
      expect(await vaultFacade.fileExists(path)).toBe(true);
      
      const note = await vaultFacade.readNote(path);
      expect(note.content).toBe(content);
    });
    
    test('createNote should throw FileExistsError if file exists and overwrite is false', async () => {
      const path = 'test.md';
      const content = 'Test content';
      
      await vaultFacade.createNote(path, content);
      
      await expect(vaultFacade.createNote(path, 'New content')).rejects.toThrow(FileExistsError);
    });
    
    test('createNote should overwrite existing file if overwrite is true', async () => {
      const path = 'test.md';
      const content = 'Test content';
      const newContent = 'New content';
      
      await vaultFacade.createNote(path, content);
      const result = await vaultFacade.createNote(path, newContent, true);
      
      expect(result.path).toBe(path);
      
      const note = await vaultFacade.readNote(path);
      expect(note.content).toBe(newContent);
    });
    
    test('createNote should create parent folders if they do not exist', async () => {
      const path = 'folder/subfolder/test.md';
      const content = 'Test content';
      
      const result = await vaultFacade.createNote(path, content);
      
      expect(result.path).toBe(path);
      expect(await vaultFacade.folderExists('folder')).toBe(true);
      expect(await vaultFacade.folderExists('folder/subfolder')).toBe(true);
      expect(await vaultFacade.fileExists(path)).toBe(true);
    });
    
    test('readNote should read a note', async () => {
      const path = 'test.md';
      const content = 'Test content';
      
      await vaultFacade.createNote(path, content);
      
      const note = await vaultFacade.readNote(path);
      
      expect(note.path).toBe(path);
      expect(note.content).toBe(content);
    });
    
    test('readNote should throw FileNotFoundError if file does not exist', async () => {
      await expect(vaultFacade.readNote('nonexistent.md')).rejects.toThrow(FileNotFoundError);
    });
    
    test('updateNote should update a note', async () => {
      const path = 'test.md';
      const content = 'Test content';
      const newContent = 'New content';
      
      await vaultFacade.createNote(path, content);
      
      const result = await vaultFacade.updateNote(path, newContent);
      
      expect(result.path).toBe(path);
      
      const note = await vaultFacade.readNote(path);
      expect(note.content).toBe(newContent);
    });
    
    test('updateNote should throw FileNotFoundError if file does not exist', async () => {
      await expect(vaultFacade.updateNote('nonexistent.md', 'content')).rejects.toThrow(FileNotFoundError);
    });
    
    test('deleteNote should delete a note', async () => {
      const path = 'test.md';
      const content = 'Test content';
      
      await vaultFacade.createNote(path, content);
      
      await vaultFacade.deleteNote(path);
      
      expect(await vaultFacade.fileExists(path)).toBe(false);
    });
    
    test('deleteNote should throw FileNotFoundError if file does not exist', async () => {
      await expect(vaultFacade.deleteNote('nonexistent.md')).rejects.toThrow(FileNotFoundError);
    });
    
    test('renameNote should rename a note', async () => {
      const path = 'test.md';
      const newPath = 'renamed.md';
      const content = 'Test content';
      
      await vaultFacade.createNote(path, content);
      
      const result = await vaultFacade.renameNote(path, newPath);
      
      expect(result.path).toBe(newPath);
      expect(await vaultFacade.fileExists(path)).toBe(false);
      expect(await vaultFacade.fileExists(newPath)).toBe(true);
      
      const note = await vaultFacade.readNote(newPath);
      expect(note.content).toBe(content);
    });
    
    test('renameNote should throw FileNotFoundError if file does not exist', async () => {
      await expect(vaultFacade.renameNote('nonexistent.md', 'renamed.md')).rejects.toThrow(FileNotFoundError);
    });
    
    test('renameNote should throw FileExistsError if destination file exists', async () => {
      const path1 = 'test1.md';
      const path2 = 'test2.md';
      
      await vaultFacade.createNote(path1, 'Content 1');
      await vaultFacade.createNote(path2, 'Content 2');
      
      await expect(vaultFacade.renameNote(path1, path2)).rejects.toThrow(FileExistsError);
    });
    
    test('renameNote should create parent folders if they do not exist', async () => {
      const path = 'test.md';
      const newPath = 'folder/subfolder/renamed.md';
      const content = 'Test content';
      
      await vaultFacade.createNote(path, content);
      
      const result = await vaultFacade.renameNote(path, newPath);
      
      expect(result.path).toBe(newPath);
      expect(await vaultFacade.folderExists('folder')).toBe(true);
      expect(await vaultFacade.folderExists('folder/subfolder')).toBe(true);
      expect(await vaultFacade.fileExists(newPath)).toBe(true);
    });
  });
  
  describe('Folder operations', () => {
    test('createFolder should create a folder', async () => {
      const path = 'folder';
      
      await vaultFacade.createFolder(path);
      
      expect(await vaultFacade.folderExists(path)).toBe(true);
    });
    
    test('createFolder should create parent folders if they do not exist', async () => {
      const path = 'folder/subfolder/subsubfolder';
      
      await vaultFacade.createFolder(path);
      
      expect(await vaultFacade.folderExists('folder')).toBe(true);
      expect(await vaultFacade.folderExists('folder/subfolder')).toBe(true);
      expect(await vaultFacade.folderExists(path)).toBe(true);
    });
    
    test('createFolder should do nothing if folder already exists', async () => {
      const path = 'folder';
      
      await vaultFacade.createFolder(path);
      await vaultFacade.createFolder(path); // Should not throw
      
      expect(await vaultFacade.folderExists(path)).toBe(true);
    });
    
    test('listFolder should list files and folders in a directory', async () => {
      await vaultFacade.createFolder('folder');
      await vaultFacade.createFolder('folder/subfolder');
      await vaultFacade.createNote('folder/test1.md', 'Content 1');
      await vaultFacade.createNote('folder/test2.md', 'Content 2');
      
      const result = await vaultFacade.listFolder('folder');
      
      expect(result.path).toBe('folder');
      expect(result.files).toContain('folder/test1.md');
      expect(result.files).toContain('folder/test2.md');
      expect(result.folders).toContain('folder/subfolder');
    });
    
    test('listFolder should throw FolderNotFoundError if folder does not exist', async () => {
      await expect(vaultFacade.listFolder('nonexistent')).rejects.toThrow(FolderNotFoundError);
    });
    
    test('listFolder should respect includeFiles option', async () => {
      await vaultFacade.createFolder('folder');
      await vaultFacade.createFolder('folder/subfolder');
      await vaultFacade.createNote('folder/test.md', 'Content');
      
      const result = await vaultFacade.listFolder('folder', { includeFiles: false });
      
      expect(result.files).toHaveLength(0);
      expect(result.folders).toContain('folder/subfolder');
    });
    
    test('listFolder should respect includeFolders option', async () => {
      await vaultFacade.createFolder('folder');
      await vaultFacade.createFolder('folder/subfolder');
      await vaultFacade.createNote('folder/test.md', 'Content');
      
      const result = await vaultFacade.listFolder('folder', { includeFolders: false });
      
      expect(result.files).toContain('folder/test.md');
      expect(result.folders).toHaveLength(0);
    });
    
    test('listFolder should respect recursive option', async () => {
      await vaultFacade.createFolder('folder');
      await vaultFacade.createFolder('folder/subfolder');
      await vaultFacade.createNote('folder/test.md', 'Content');
      await vaultFacade.createNote('folder/subfolder/test.md', 'Content');
      
      const result = await vaultFacade.listFolder('folder', { recursive: true });
      
      expect(result.files).toContain('folder/test.md');
      expect(result.files).toContain('folder/subfolder/test.md');
      expect(result.folders).toContain('folder/subfolder');
    });
    
    test('deleteFolder should delete an empty folder', async () => {
      const path = 'folder';
      
      await vaultFacade.createFolder(path);
      
      await vaultFacade.deleteFolder(path);
      
      expect(await vaultFacade.folderExists(path)).toBe(false);
    });
    
    test('deleteFolder should throw FolderNotFoundError if folder does not exist', async () => {
      await expect(vaultFacade.deleteFolder('nonexistent')).rejects.toThrow(FolderNotFoundError);
    });
    
    test('deleteFolder should throw if folder is not empty and recursive is false', async () => {
      await vaultFacade.createFolder('folder');
      await vaultFacade.createNote('folder/test.md', 'Content');
      
      await expect(vaultFacade.deleteFolder('folder')).rejects.toThrow();
    });
    
    test('deleteFolder should delete folder and contents if recursive is true', async () => {
      await vaultFacade.createFolder('folder');
      await vaultFacade.createFolder('folder/subfolder');
      await vaultFacade.createNote('folder/test.md', 'Content');
      await vaultFacade.createNote('folder/subfolder/test.md', 'Content');
      
      await vaultFacade.deleteFolder('folder', true);
      
      expect(await vaultFacade.folderExists('folder')).toBe(false);
      expect(await vaultFacade.folderExists('folder/subfolder')).toBe(false);
      expect(await vaultFacade.fileExists('folder/test.md')).toBe(false);
      expect(await vaultFacade.fileExists('folder/subfolder/test.md')).toBe(false);
    });
  });
  
  describe('Search operations', () => {
    beforeEach(async () => {
      // Set up test data
      await vaultFacade.createNote('test1.md', 'This is a test document with some content');
      await vaultFacade.createNote('test2.md', 'Another test document with different content');
      await vaultFacade.createNote('folder/test3.md', 'A document in a folder');
      
      // Create a document with frontmatter
      const contentWithFrontmatter = `---
title: Test Document
tags: [test, document, example]
---

This is a document with frontmatter.`;
      
      await vaultFacade.createNote('frontmatter.md', contentWithFrontmatter);
    });
    
    test('searchContent should find content in files', async () => {
      const results = await vaultFacade.searchContent('test');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.path === 'test1.md')).toBe(true);
      expect(results.some(r => r.path === 'test2.md')).toBe(true);
    });
    
    test('searchContent should respect paths option', async () => {
      const results = await vaultFacade.searchContent('document', { paths: ['folder'] });
      
      expect(results.length).toBe(1);
      expect(results[0].path).toBe('folder/test3.md');
    });
    
    test('searchContent should respect includeContent option', async () => {
      const results = await vaultFacade.searchContent('test', { includeContent: true });
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toBeDefined();
    });
    
    test('searchContent should search in frontmatter', async () => {
      const results = await vaultFacade.searchContent('example');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.path === 'frontmatter.md')).toBe(true);
    });
    
    test('searchByTag should find files with matching tag', async () => {
      const results = await vaultFacade.searchByTag('example');
      
      expect(results.length).toBe(1);
      expect(results[0]).toBe('frontmatter.md');
    });
  });
  
  describe('Frontmatter operations', () => {
    test('updateFrontmatter should update frontmatter', async () => {
      const path = 'test.md';
      const content = `---
title: Original Title
---

Content`;
      
      await vaultFacade.createNote(path, content);
      
      await vaultFacade.updateFrontmatter(path, (frontmatter) => {
        frontmatter.title = 'Updated Title';
        frontmatter.tags = ['test', 'updated'];
      });
      
      const note = await vaultFacade.readNote(path);
      
      expect(note.frontmatter).toBeDefined();
      expect(note.frontmatter?.title).toBe('Updated Title');
      expect(note.frontmatter?.tags).toEqual(['test', 'updated']);
    });
    
    test('updateFrontmatter should throw FileNotFoundError if file does not exist', async () => {
      await expect(vaultFacade.updateFrontmatter('nonexistent.md', () => {})).rejects.toThrow(FileNotFoundError);
    });
  });
  
  describe('Events', () => {
    test('should emit events for note operations', async () => {
      const events: string[] = [];
      
      vaultFacade.on(VaultFacadeEventType.NOTE_CREATED, () => events.push('created'));
      vaultFacade.on(VaultFacadeEventType.NOTE_READ, () => events.push('read'));
      vaultFacade.on(VaultFacadeEventType.NOTE_UPDATED, () => events.push('updated'));
      vaultFacade.on(VaultFacadeEventType.NOTE_DELETED, () => events.push('deleted'));
      
      await vaultFacade.createNote('test.md', 'Content');
      await vaultFacade.readNote('test.md');
      await vaultFacade.updateNote('test.md', 'New content');
      await vaultFacade.deleteNote('test.md');
      
      expect(events).toEqual(['created', 'read', 'updated', 'deleted']);
    });
    
    test('should emit events for folder operations', async () => {
      const events: string[] = [];
      
      vaultFacade.on(VaultFacadeEventType.FOLDER_CREATED, () => events.push('created'));
      vaultFacade.on(VaultFacadeEventType.FOLDER_LISTED, () => events.push('listed'));
      vaultFacade.on(VaultFacadeEventType.FOLDER_DELETED, () => events.push('deleted'));
      
      await vaultFacade.createFolder('folder');
      await vaultFacade.listFolder('folder');
      await vaultFacade.deleteFolder('folder');
      
      expect(events).toEqual(['created', 'listed', 'deleted']);
    });
  });
  
  describe('Utility methods', () => {
    test('getParentFolder should return parent folder path', () => {
      expect(vaultFacade.getParentFolder('folder/subfolder/file.md')).toBe('folder/subfolder');
      expect(vaultFacade.getParentFolder('file.md')).toBe('');
      expect(vaultFacade.getParentFolder('')).toBe('');
    });
    
    test('normalizePath should normalize paths', () => {
      expect(vaultFacade.normalizePath('/folder/file.md')).toBe('folder/file.md');
      expect(vaultFacade.normalizePath('folder/file.md/')).toBe('folder/file.md');
      expect(vaultFacade.normalizePath('folder\\file.md')).toBe('folder/file.md');
      expect(vaultFacade.normalizePath('  folder/file.md  ')).toBe('folder/file.md');
    });
  });
});
