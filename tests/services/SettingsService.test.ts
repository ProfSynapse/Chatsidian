import { SettingsService } from '../../src/services/SettingsService';
import { SettingsManager } from '../../src/core/SettingsManager';
import { DEFAULT_SETTINGS } from '../../src/models/Settings';
import { EventBus } from '../../src/core/EventBus';

// Mock Obsidian's App
const mockApp = {
  workspace: {
    on: jest.fn(),
    off: jest.fn(),
    trigger: jest.fn()
  }
};

// Mock Plugin
class MockPlugin {
  settings: any;
  app: any;
  saveData: jest.Mock;
  addSettingTab: jest.Mock;
  
  constructor() {
    this.app = mockApp;
    this.saveData = jest.fn().mockResolvedValue(undefined);
    this.addSettingTab = jest.fn();
  }
}

describe('SettingsService', () => {
  let eventBus: EventBus;
  let plugin: MockPlugin;
  let settingsService: SettingsService;
  
  beforeEach(() => {
    eventBus = new EventBus();
    plugin = new MockPlugin();
    settingsService = new SettingsService(mockApp as any, plugin, eventBus);
  });
  
  test('should initialize with default settings if no saved data', async () => {
    const settingsHandler = jest.fn();
    eventBus.on('settings:loaded', settingsHandler);
    
    const settingsManager = await settingsService.initialize(null);
    
    // Check settings manager was created
    expect(settingsManager).toBeInstanceOf(SettingsManager);
    
    // Check settings tab was added
    expect(plugin.addSettingTab).toHaveBeenCalled();
    
    // Check event was emitted
    expect(settingsHandler).toHaveBeenCalledWith(expect.objectContaining(DEFAULT_SETTINGS));
  });
  
  test('should initialize with saved settings', async () => {
    const savedData = {
      apiKey: 'saved-key',
      provider: 'openai',
      model: 'gpt-4'
    };
    
    const settingsManager = await settingsService.initialize(savedData);
    const settings = settingsManager.getSettings();
    
    expect(settings.apiKey).toBe('saved-key');
    expect(settings.provider).toBe('openai');
    expect(settings.model).toBe('gpt-4');
  });
  
  test('should migrate settings from old format', async () => {
    const oldSettings = {
      apiKey: 'old-key',
      bcps: 'System,Vault,Editor' // Old format
    };
    
    const settingsManager = await settingsService.initialize(oldSettings);
    const settings = settingsManager.getSettings();
    
    expect(settings.apiKey).toBe('old-key');
    expect(settings.autoLoadBCPs).toEqual(['System', 'Vault', 'Editor']); // Should be migrated to array
  });
  
  test('should save settings to plugin data', async () => {
    const settingsManager = await settingsService.initialize({});
    
    // Update settings
    await settingsManager.updateSettings({
      apiKey: 'new-key'
    });
    
    // Check saveData was called
    expect(plugin.saveData).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'new-key'
    }));
  });
  
  test('should get settings manager', async () => {
    await settingsService.initialize({});
    
    const settingsManager = settingsService.getSettingsManager();
    
    expect(settingsManager).toBeInstanceOf(SettingsManager);
  });
  
  test('should export settings', async () => {
    await settingsService.initialize({
      apiKey: 'secret-key',
      provider: 'anthropic'
    });
    
    // Export without API key
    const exportedJson = settingsService.exportSettings(false);
    const exported = JSON.parse(exportedJson);
    
    expect(exported.provider).toBe('anthropic');
    expect(exported.apiKey).toBe(''); // API key should be removed
    
    // Export with API key
    const exportedWithKeyJson = settingsService.exportSettings(true);
    const exportedWithKey = JSON.parse(exportedWithKeyJson);
    
    expect(exportedWithKey.provider).toBe('anthropic');
    expect(exportedWithKey.apiKey).toBe('secret-key'); // API key should be included
  });
  
  test('should import settings', async () => {
    await settingsService.initialize({});
    
    const importJson = JSON.stringify({
      provider: 'openai',
      model: 'gpt-4',
      debugMode: true
    });
    
    await settingsService.importSettings(importJson);
    
    const settings = settingsService.getSettingsManager().getSettings();
    expect(settings.provider).toBe('openai');
    expect(settings.model).toBe('gpt-4');
    expect(settings.debugMode).toBe(true);
  });
});
