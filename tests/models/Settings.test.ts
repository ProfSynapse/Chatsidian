import {
  ChatsidianSettings,
  DEFAULT_SETTINGS,
  SettingsUtils,
  loadSettings,
  prepareSettingsForSave,
} from '../../src/models/Settings';

describe('Settings Model & Utils', () => {
  // --- DEFAULT_SETTINGS Tests ---

  test('DEFAULT_SETTINGS should contain all required properties', () => {
    // Check a few key properties to ensure the object structure is correct
    expect(DEFAULT_SETTINGS).toHaveProperty('provider');
    expect(DEFAULT_SETTINGS).toHaveProperty('apiKey');
    expect(DEFAULT_SETTINGS).toHaveProperty('model');
    expect(DEFAULT_SETTINGS).toHaveProperty('conversationsFolder');
    expect(DEFAULT_SETTINGS).toHaveProperty('maxMessages');
    expect(DEFAULT_SETTINGS).toHaveProperty('defaultSystemPrompt');
    expect(DEFAULT_SETTINGS).toHaveProperty('theme');
    expect(DEFAULT_SETTINGS).toHaveProperty('fontSize');
    expect(DEFAULT_SETTINGS).toHaveProperty('showTimestamps');
    expect(DEFAULT_SETTINGS).toHaveProperty('debugMode');
    expect(DEFAULT_SETTINGS).toHaveProperty('autoLoadBCPs');
    expect(DEFAULT_SETTINGS).toHaveProperty('defaultTemperature');
    expect(DEFAULT_SETTINGS).toHaveProperty('defaultMaxTokens');
    // Ensure no unexpected properties are present (optional check)
    expect(Object.keys(DEFAULT_SETTINGS).length).toBe(14);
  });

  test('DEFAULT_SETTINGS should have sensible default values', () => {
    expect(DEFAULT_SETTINGS.apiKey).toBe('');
    expect(DEFAULT_SETTINGS.provider).toBe('anthropic');
    expect(DEFAULT_SETTINGS.theme).toBe('system');
    expect(DEFAULT_SETTINGS.debugMode).toBe(false);
    expect(DEFAULT_SETTINGS.defaultTemperature).toBe(0.7);
    expect(DEFAULT_SETTINGS.conversationsFolder).toBe('.chatsidian/conversations');
  });

  // --- SettingsUtils.validate Tests ---

  describe('SettingsUtils.validate', () => {
    test('should return default settings if input is empty or null', () => {
      expect(SettingsUtils.validate({})).toEqual(DEFAULT_SETTINGS);
      expect(SettingsUtils.validate(null as any)).toEqual(DEFAULT_SETTINGS);
      expect(SettingsUtils.validate(undefined as any)).toEqual(DEFAULT_SETTINGS);
    });

    test('should merge partial settings with defaults', () => {
      const partial: Partial<ChatsidianSettings> = {
        apiKey: 'test-key-123',
        fontSize: 16,
      };
      const validated = SettingsUtils.validate(partial);
      expect(validated.apiKey).toBe('test-key-123');
      expect(validated.fontSize).toBe(16);
      expect(validated.provider).toBe(DEFAULT_SETTINGS.provider); // Check a default value
      expect(validated.model).toBe(DEFAULT_SETTINGS.model); // Check another default
    });

    test('should validate and correct provider', () => {
      expect(SettingsUtils.validate({ provider: 'openai' }).provider).toBe('openai');
      expect(SettingsUtils.validate({ provider: 'invalid-provider' as any }).provider).toBe(DEFAULT_SETTINGS.provider);
    });

     test('should validate and correct theme', () => {
      expect(SettingsUtils.validate({ theme: 'dark' }).theme).toBe('dark');
      expect(SettingsUtils.validate({ theme: 'invalid-theme' as any }).theme).toBe(DEFAULT_SETTINGS.theme);
    });

    test('should validate and normalize conversationsFolder path', () => {
      expect(SettingsUtils.validate({ conversationsFolder: 'my/chats/' }).conversationsFolder).toBe('my/chats');
      expect(SettingsUtils.validate({ conversationsFolder: '/leading/slash' }).conversationsFolder).toBe('leading/slash');
      expect(SettingsUtils.validate({ conversationsFolder: 'trailing/slash/' }).conversationsFolder).toBe('trailing/slash');
      expect(SettingsUtils.validate({ conversationsFolder: '//multiple///slashes//' }).conversationsFolder).toBe('multiple///slashes'); // Inner slashes remain
      expect(SettingsUtils.validate({ conversationsFolder: '' }).conversationsFolder).toBe(DEFAULT_SETTINGS.conversationsFolder);
      expect(SettingsUtils.validate({ conversationsFolder: '/' }).conversationsFolder).toBe(DEFAULT_SETTINGS.conversationsFolder); // Path becomes empty after trim
       expect(SettingsUtils.validate({ conversationsFolder: 'back\\slashes\\' }).conversationsFolder).toBe('back\\slashes');
    });

    test('should validate and clamp temperature', () => {
      expect(SettingsUtils.validate({ defaultTemperature: -0.5 }).defaultTemperature).toBe(0);
      expect(SettingsUtils.validate({ defaultTemperature: 1.5 }).defaultTemperature).toBe(1);
      expect(SettingsUtils.validate({ defaultTemperature: 0.5 }).defaultTemperature).toBe(0.5);
      expect(SettingsUtils.validate({ defaultTemperature: undefined }).defaultTemperature).toBe(DEFAULT_SETTINGS.defaultTemperature);
    });

    test('should validate and clamp maxTokens', () => {
      expect(SettingsUtils.validate({ defaultMaxTokens: 0 }).defaultMaxTokens).toBe(1);
      expect(SettingsUtils.validate({ defaultMaxTokens: -100 }).defaultMaxTokens).toBe(1);
      expect(SettingsUtils.validate({ defaultMaxTokens: 50000 }).defaultMaxTokens).toBe(32000); // Clamp to max practical limit
      expect(SettingsUtils.validate({ defaultMaxTokens: 2048 }).defaultMaxTokens).toBe(2048);
      expect(SettingsUtils.validate({ defaultMaxTokens: undefined }).defaultMaxTokens).toBe(DEFAULT_SETTINGS.defaultMaxTokens);
       expect(SettingsUtils.validate({ defaultMaxTokens: 4000.5 }).defaultMaxTokens).toBe(4000); // Should floor
    });

     test('should validate numeric properties', () => {
      expect(SettingsUtils.validate({ fontSize: 6 }).fontSize).toBe(8); // Clamp min
      expect(SettingsUtils.validate({ fontSize: 15 }).fontSize).toBe(15);
      expect(SettingsUtils.validate({ maxMessages: 5 }).maxMessages).toBe(10); // Clamp min
      expect(SettingsUtils.validate({ maxMessages: 200 }).maxMessages).toBe(200);
    });

    test('should validate boolean properties', () => {
      expect(SettingsUtils.validate({ showTimestamps: false }).showTimestamps).toBe(false);
      expect(SettingsUtils.validate({ showTimestamps: true }).showTimestamps).toBe(true);
      expect(SettingsUtils.validate({ showTimestamps: undefined }).showTimestamps).toBe(DEFAULT_SETTINGS.showTimestamps);
      expect(SettingsUtils.validate({ debugMode: true }).debugMode).toBe(true);
      expect(SettingsUtils.validate({ debugMode: false }).debugMode).toBe(false);
      expect(SettingsUtils.validate({ debugMode: undefined }).debugMode).toBe(DEFAULT_SETTINGS.debugMode);
    });

     test('should validate array properties', () => {
      expect(SettingsUtils.validate({ autoLoadBCPs: ['CustomBCP'] }).autoLoadBCPs).toEqual(['CustomBCP']);
      expect(SettingsUtils.validate({ autoLoadBCPs: undefined }).autoLoadBCPs).toEqual(DEFAULT_SETTINGS.autoLoadBCPs);
      expect(SettingsUtils.validate({ autoLoadBCPs: 'not-an-array' as any }).autoLoadBCPs).toEqual(DEFAULT_SETTINGS.autoLoadBCPs);
    });

     test('should handle empty strings correctly', () => {
        const settings = SettingsUtils.validate({ apiKey: '', defaultSystemPrompt: '' });
        expect(settings.apiKey).toBe('');
        expect(settings.defaultSystemPrompt).toBe(''); // Should allow empty system prompt
        expect(settings.apiEndpoint).toBe('');
     });
  });

  // --- loadSettings Tests ---

  describe('loadSettings', () => {
    test('should call validate with the loaded data', () => {
      const mockData = { apiKey: 'loaded-key', provider: 'openai' };
      const validateSpy = jest.spyOn(SettingsUtils, 'validate');
      loadSettings(mockData);
      expect(validateSpy).toHaveBeenCalledWith(mockData);
      validateSpy.mockRestore();
    });

    test('should call validate with empty object if loaded data is null/undefined', () => {
      const validateSpy = jest.spyOn(SettingsUtils, 'validate');
      loadSettings(null);
      expect(validateSpy).toHaveBeenCalledWith({});
      loadSettings(undefined);
      expect(validateSpy).toHaveBeenCalledWith({});
      validateSpy.mockRestore();
    });

    test('should return validated settings', () => {
        const mockData = { apiKey: 'loaded-key', defaultTemperature: 1.5 }; // Invalid temp
        const settings = loadSettings(mockData);
        expect(settings.apiKey).toBe('loaded-key');
        expect(settings.defaultTemperature).toBe(1); // Check validation occurred
        expect(settings.provider).toBe(DEFAULT_SETTINGS.provider); // Check default merge
    });
  });

  // --- prepareSettingsForSave Tests ---

  describe('prepareSettingsForSave', () => {
    test('should return a copy of the settings object', () => {
      const settings: ChatsidianSettings = { ...DEFAULT_SETTINGS, apiKey: 'save-key' };
      const prepared = prepareSettingsForSave(settings);
      expect(prepared).toEqual(settings);
      expect(prepared).not.toBe(settings); // Ensure it's a copy
    });

    // Add more tests here if prepareSettingsForSave ever includes transformations
    // test('should perform necessary transformations before saving', () => {
    //   // Example: const settings = { ...DEFAULT_SETTINGS, someDate: new Date() };
    //   // const prepared = prepareSettingsForSave(settings);
    //   // expect(typeof prepared.someDate).toBe('number'); // Assuming conversion to timestamp
    // });
  });
});
