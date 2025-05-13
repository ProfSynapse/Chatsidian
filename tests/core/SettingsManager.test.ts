import { SettingsManager, SettingsExportImport } from '../../src/core/SettingsManager';
import { ChatsidianSettings, DEFAULT_SETTINGS } from '../../src/models/Settings';
import { EventBus } from '../../src/core/EventBus';

describe('SettingsManager', () => {
  let eventBus: EventBus;
  let saveSettings: jest.Mock;
  let settingsManager: SettingsManager;
  
  beforeEach(() => {
    eventBus = new EventBus();
    saveSettings = jest.fn().mockResolvedValue(undefined);
    settingsManager = new SettingsManager(
      { ...DEFAULT_SETTINGS },
      saveSettings,
      eventBus
    );
  });
  
  test('should initialize with default settings', () => {
    const settings = settingsManager.getSettings();
    
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });
  
  test('should initialize with custom settings', () => {
    const customSettings = {
      ...DEFAULT_SETTINGS,
      apiKey: 'test-key',
      model: 'test-model'
    };
    
    const manager = new SettingsManager(
      customSettings,
      saveSettings,
      eventBus
    );
    
    const settings = manager.getSettings();
    
    expect(settings.apiKey).toBe('test-key');
    expect(settings.model).toBe('test-model');
  });
  
  test('should update settings', async () => {
    const settingsHandler = jest.fn();
    eventBus.on('settings:updated', settingsHandler);
    
    await settingsManager.updateSettings({
      apiKey: 'new-key',
      model: 'new-model'
    });
    
    // Check settings were updated
    const settings = settingsManager.getSettings();
    expect(settings.apiKey).toBe('new-key');
    expect(settings.model).toBe('new-model');
    
    // Check save was called
    expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'new-key',
      model: 'new-model'
    }));
    
    // Check event was emitted
    expect(settingsHandler).toHaveBeenCalledWith(expect.objectContaining({
      previousSettings: expect.any(Object),
      currentSettings: expect.any(Object),
      changedKeys: expect.arrayContaining(['apiKey', 'model'])
    }));
  });
  
  test('should set API key', async () => {
    await settingsManager.setApiKey('new-key');
    
    const settings = settingsManager.getSettings();
    expect(settings.apiKey).toBe('new-key');
    expect(saveSettings).toHaveBeenCalled();
  });
  
  test('should get provider', () => {
    expect(settingsManager.getProvider()).toBe(DEFAULT_SETTINGS.provider);
  });
  
  test('should get API key', () => {
    expect(settingsManager.getApiKey()).toBe(DEFAULT_SETTINGS.apiKey);
  });
  
  test('should get model', () => {
    expect(settingsManager.getModel()).toBe(DEFAULT_SETTINGS.model);
  });
  
  test('should get conversations path', () => {
    expect(settingsManager.getConversationsPath()).toBe(DEFAULT_SETTINGS.conversationsFolder);
  });
  
  
  test('should check if debug mode is enabled', () => {
    expect(settingsManager.isDebugModeEnabled()).toBe(DEFAULT_SETTINGS.debugMode);
  });
  
  test('should reset to defaults', async () => {
    // First update some settings
    await settingsManager.updateSettings({
      apiKey: 'test-key',
      model: 'test-model'
    });
    
    // Then reset to defaults
    await settingsManager.resetToDefaults();
    
    const settings = settingsManager.getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe('SettingsExportImport', () => {
  let eventBus: EventBus;
  let saveSettings: jest.Mock;
  let settingsManager: SettingsManager;
  let exportImport: SettingsExportImport;
  
  beforeEach(() => {
    eventBus = new EventBus();
    saveSettings = jest.fn().mockResolvedValue(undefined);
    settingsManager = new SettingsManager(
      { ...DEFAULT_SETTINGS, apiKey: 'test-key' },
      saveSettings,
      eventBus
    );
    exportImport = new SettingsExportImport(settingsManager);
  });
  
  test('should export settings to JSON without API key', () => {
    const json = exportImport.exportToJson(false);
    const exported = JSON.parse(json);
    
    expect(exported).toEqual(expect.objectContaining({
      ...DEFAULT_SETTINGS,
      apiKey: '' // API key should be removed
    }));
  });
  
  test('should export settings to JSON with API key', () => {
    const json = exportImport.exportToJson(true);
    const exported = JSON.parse(json);
    
    expect(exported).toEqual(expect.objectContaining({
      ...DEFAULT_SETTINGS,
      apiKey: 'test-key' // API key should be included
    }));
  });
  
  test('should import settings from JSON', async () => {
    const importJson = JSON.stringify({
      provider: 'openai',
      model: 'gpt-4',
      debugMode: true
    });
    
    await exportImport.importFromJson(importJson);
    
    const settings = settingsManager.getSettings();
    expect(settings.provider).toBe('openai');
    expect(settings.model).toBe('gpt-4');
    expect(settings.debugMode).toBe(true);
  });
  
  test('should throw error on invalid JSON', async () => {
    await expect(exportImport.importFromJson('invalid json')).rejects.toThrow();
  });
  
  test('should throw error on invalid settings format', async () => {
    await expect(exportImport.importFromJson('"not an object"')).rejects.toThrow();
  });
});
