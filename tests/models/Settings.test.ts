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
    expect(DEFAULT_SETTINGS).toHaveProperty('apiEndpoint');
    expect(DEFAULT_SETTINGS).toHaveProperty('model');
    expect(DEFAULT_SETTINGS).toHaveProperty('conversationsFolder');
    expect(DEFAULT_SETTINGS).toHaveProperty('maxMessages');
    expect(DEFAULT_SETTINGS).toHaveProperty('debugMode');
    expect(DEFAULT_SETTINGS).toHaveProperty('defaultAgentId');
    expect(DEFAULT_SETTINGS).toHaveProperty('customAgents');
    // Ensure no unexpected properties are present (optional check)
    expect(Object.keys(DEFAULT_SETTINGS).length).toBe(9);
  });

  test('DEFAULT_SETTINGS should have sensible default values', () => {
    expect(DEFAULT_SETTINGS.apiKey).toBe('');
    expect(DEFAULT_SETTINGS.provider).toBe('anthropic');
    expect(DEFAULT_SETTINGS.debugMode).toBe(false);
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
        maxMessages: 150,
      };
      const validated = SettingsUtils.validate(partial);
      expect(validated.apiKey).toBe('test-key-123');
      expect(validated.maxMessages).toBe(150);
      expect(validated.provider).toBe(DEFAULT_SETTINGS.provider); // Check a default value
      expect(validated.model).toBe(DEFAULT_SETTINGS.model); // Check another default
    });

    test('should validate and correct provider', () => {
      expect(SettingsUtils.validate({ provider: 'openai' }).provider).toBe('openai');
      expect(SettingsUtils.validate({ provider: 'invalid-provider' as any }).provider).toBe(DEFAULT_SETTINGS.provider);
    });

    // Theme validation removed

    test('should validate and normalize conversationsFolder path', () => {
      expect(SettingsUtils.validate({ conversationsFolder: 'my/chats/' }).conversationsFolder).toBe('my/chats');
      expect(SettingsUtils.validate({ conversationsFolder: '/leading/slash' }).conversationsFolder).toBe('leading/slash');
      expect(SettingsUtils.validate({ conversationsFolder: 'trailing/slash/' }).conversationsFolder).toBe('trailing/slash');
      expect(SettingsUtils.validate({ conversationsFolder: '//multiple///slashes//' }).conversationsFolder).toBe('multiple///slashes'); // Inner slashes remain
      expect(SettingsUtils.validate({ conversationsFolder: '' }).conversationsFolder).toBe(DEFAULT_SETTINGS.conversationsFolder);
      expect(SettingsUtils.validate({ conversationsFolder: '/' }).conversationsFolder).toBe(DEFAULT_SETTINGS.conversationsFolder); // Path becomes empty after trim
       expect(SettingsUtils.validate({ conversationsFolder: 'back\\slashes\\' }).conversationsFolder).toBe('back\\slashes');
    });

    // Temperature validation removed
    
    // MaxTokens validation removed

     test('should validate numeric properties', () => {
      expect(SettingsUtils.validate({ maxMessages: 5 }).maxMessages).toBe(10); // Clamp min
      expect(SettingsUtils.validate({ maxMessages: 200 }).maxMessages).toBe(200);
    });

    test('should validate boolean properties', () => {
      expect(SettingsUtils.validate({ debugMode: true }).debugMode).toBe(true);
      expect(SettingsUtils.validate({ debugMode: false }).debugMode).toBe(false);
      expect(SettingsUtils.validate({ debugMode: undefined }).debugMode).toBe(DEFAULT_SETTINGS.debugMode);
    });

     test('should validate array properties', () => {
      expect(SettingsUtils.validate({ customAgents: [] }).customAgents).toEqual([]);
      expect(SettingsUtils.validate({ customAgents: undefined }).customAgents).toEqual(DEFAULT_SETTINGS.customAgents);
      expect(SettingsUtils.validate({ customAgents: 'not-an-array' as any }).customAgents).toEqual(DEFAULT_SETTINGS.customAgents);
    });

     test('should handle empty strings correctly', () => {
        const settings = SettingsUtils.validate({ apiKey: '' });
        expect(settings.apiKey).toBe('');
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
        const mockData = { apiKey: 'loaded-key', maxMessages: 5 }; // Too small, should be clamped
        const settings = loadSettings(mockData);
        expect(settings.apiKey).toBe('loaded-key');
        expect(settings.maxMessages).toBe(10); // Check validation occurred 
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
