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
    constructor() {
        this.app = mockApp;
        this.saveData = jest.fn().mockResolvedValue(undefined);
        this.addSettingTab = jest.fn();
    }
}
describe('SettingsService', () => {
    let eventBus;
    let plugin;
    let settingsService;
    beforeEach(() => {
        eventBus = new EventBus();
        plugin = new MockPlugin();
        settingsService = new SettingsService(mockApp, plugin, eventBus);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU2V0dGluZ3NTZXJ2aWNlLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJTZXR0aW5nc1NlcnZpY2UudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDckUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQzdELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUVuRCxzQkFBc0I7QUFDdEIsTUFBTSxPQUFPLEdBQUc7SUFDZCxTQUFTLEVBQUU7UUFDVCxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRTtRQUNiLEdBQUcsRUFBRSxJQUFJLENBQUMsRUFBRSxFQUFFO1FBQ2QsT0FBTyxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUU7S0FDbkI7Q0FDRixDQUFDO0FBRUYsY0FBYztBQUNkLE1BQU0sVUFBVTtJQU1kO1FBQ0UsSUFBSSxDQUFDLEdBQUcsR0FBRyxPQUFPLENBQUM7UUFDbkIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsRUFBRSxFQUFFLENBQUMsaUJBQWlCLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDdkQsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsRUFBRSxFQUFFLENBQUM7SUFDakMsQ0FBQztDQUNGO0FBRUQsUUFBUSxDQUFDLGlCQUFpQixFQUFFLEdBQUcsRUFBRTtJQUMvQixJQUFJLFFBQWtCLENBQUM7SUFDdkIsSUFBSSxNQUFrQixDQUFDO0lBQ3ZCLElBQUksZUFBZ0MsQ0FBQztJQUVyQyxVQUFVLENBQUMsR0FBRyxFQUFFO1FBQ2QsUUFBUSxHQUFHLElBQUksUUFBUSxFQUFFLENBQUM7UUFDMUIsTUFBTSxHQUFHLElBQUksVUFBVSxFQUFFLENBQUM7UUFDMUIsZUFBZSxHQUFHLElBQUksZUFB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eEMsTUFBTSxlQUFlLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBRXJDLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7WUFDaEMsUUFBUSxFQUFFLFFBQVE7WUFDbEIsS0FBSyxFQUFFLE9BQU87WUFDZCxTQUFTLEVBQUUsSUFBSTtTQUNoQixDQUFDLENBQUM7UUFFSCxNQUFNLGVBQWUsQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLENBQUM7UUFFakQsTUFBTSxRQUFRLEdBQUcsZUFBZSxDQUFDLGtCQUFrQixFQUFFLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDcEUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDekMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDckMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDeEMsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFNldHRpbmdzU2VydmljZSB9IGZyb20gJy4uLy4uL3NyYy9zZXJ2aWNlcy9TZXR0aW5nc1NlcnZpY2UnO1xyXG5pbXBvcnQgeyBTZXR0aW5nc01hbmFnZXIgfSBmcm9tICcuLi8uLi9zcmMvY29yZS9TZXR0aW5nc01hbmFnZXInO1xyXG5pbXBvcnQgeyBERUZBVUxUX1NFVFRJTkdTIH0gZnJvbSAnLi4vLi4vc3JjL21vZGVscy9TZXR0aW5ncyc7XHJcbmltcG9ydCB7IEV2ZW50QnVzIH0gZnJvbSAnLi4vLi4vc3JjL2NvcmUvRXZlbnRCdXMnO1xyXG5cclxuLy8gTW9jayBPYnNpZGlhbidzIEFwcFxyXG5jb25zdCBtb2NrQXBwID0ge1xyXG4gIHdvcmtzcGFjZToge1xyXG4gICAgb246IGplc3QuZm4oKSxcclxuICAgIG9mZjogamVzdC5mbigpLFxyXG4gICAgdHJpZ2dlcjogamVzdC5mbigpXHJcbiAgfVxyXG59O1xyXG5cclxuLy8gTW9jayBQbHVnaW5cclxuY2xhc3MgTW9ja1BsdWdpbiB7XHJcbiAgc2V0dGluZ3M6IGFueTtcclxuICBhcHA6IGFueTtcclxuICBzYXZlRGF0YTogamVzdC5Nb2NrO1xyXG4gIGFkZFNldHRpbmdUYWI6IGplc3QuTW9jaztcclxuICBcclxuICBjb25zdHJ1Y3RvcigpIHtcclxuICAgIHRoaXMuYXBwID0gbW9ja0FwcDtcclxuICAgIHRoaXMuc2F2ZURhdGEgPSBqZXN0LmZuKCkubW9ja1Jlc29sdmVkVmFsdWUodW5kZWZpbmVkKTtcclxuICAgIHRoaXMuYWRkU2V0dGluZ1RhYiA9IGplc3QuZm4oKTtcclxuICB9XHJcbn1cclxuXHJcbmRlc2NyaWJlKCdTZXR0aW5nc1NlcnZpY2UnLCAoKSA9PiB7XHJcbiAgbGV0IGV2ZW50QnVzOiBFdmVudEJ1cztcclxuICBsZXQgcGx1Z2luOiBNb2NrUGx1Z2luO1xyXG4gIGxldCBzZXR0aW5nc1NlcnZpY2U6IFNldHRpbmdzU2VydmljZTtcclxuICBcclxuICBiZWZvcmVFYWNoKCgpID0+IHtcclxuICAgIGV2ZW50QnVzID0gbmV3IEV2ZW50QnVzKCk7XHJcbiAgICBwbHVnaW4gPSBuZXcgTW9ja1BsdWdpbigpO1xyXG4gICAgc2V0dGluZ3NTZXJ2aWNlID0gbmV3IFNldHRpbmdzU2VydmljZShtb2NrQXBwIGFzIGFueSwgcGx1Z2luLCBldmVudEJ1cyk7XHJcbiAgfSk7XHJcbiAgXHJcbiAgdGVzdCgnc2hvdWxkIGluaXRpYWxpemUgd2l0aCBkZWZhdWx0IHNldHRpbmdzIGlmIG5vIHNhdmVkIGRhdGEnLCBhc3luYyAoKSA9PiB7XHJcbiAgICBjb25zdCBzZXR0aW5nc0hhbmRsZXIgPSBqZXN0LmZuKCk7XHJcbiAgICBldmVudEJ1cy5vbignc2V0dGluZ3M6bG9hZGVkJywgc2V0dGluZ3NIYW5kbGVyKTtcclxuICAgIFxyXG4gICAgY29uc3Qgc2V0dGluZ3NNYW5hZ2VyID0gYXdhaXQgc2V0dGluZ3NTZXJ2aWNlLmluaXRpYWxpemUobnVsbCk7XHJcbiAgICBcclxuICAgIC8vIENoZWNrIHNldHRpbmdzIG1hbmFnZXIgd2FzIGNyZWF0ZWRcclxuICAgIGV4cGVjdChzZXR0aW5nc01hbmFnZXIpLnRvQmVJbnN0YW5jZU9mKFNldHRpbmdzTWFuYWdlcik7XHJcbiAgICBcclxuICAgIC8vIENoZWNrIHNldHRpbmdzIHRhYiB3YXMgYWRkZWRcclxuICAgIGV4cGVjdChwbHVnaW4uYWRkU2V0dGluZ1RhYikudG9IYXZlQmVlbkNhbGxlZCgpO1xyXG4gICAgXHJcbiAgICAvLyBDaGVjayBldmVudCB3YXMgZW1pdHRlZFxyXG4gICAgZXhwZWN0KHNldHRpbmdzSGFuZGxlcikudG9IYXZlQmVlbkNhbGxlZFdpdGgoZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoREVGQVVMVF9TRVRUSU5HUykpO1xyXG4gIH0pO1xyXG4gIFxyXG4gIHRlc3QoJ3Nob3VsZCBpbml0aWFsaXplIHdpdGggc2F2ZWQgc2V0dGluZ3MnLCBhc3luYyAoKSA9PiB7XHJcbiAgICBjb25zdCBzYXZlZERhdGEgPSB7XHJcbiAgICAgIGFwaUtleTogJ3NhdmVkLWtleScsXHJcbiAgICAgIHByb3ZpZGVyOiAnb3BlbmFpJyxcclxuICAgICAgbW9kZWw6ICdncHQtNCdcclxuICAgIH07XHJcbiAgICBcclxuICAgIGNvbnN0IHNldHRpbmdzTWFuYWdlciA9IGF3YWl0IHNldHRpbmdzU2VydmljZS5pbml0aWFsaXplKHNhdmVkRGF0YSk7XHJcbiAgICBjb25zdCBzZXR0aW5ncyA9IHNldHRpbmdzTWFuYWdlci5nZXRTZXR0aW5ncygpO1xyXG4gICAgXHJcbiAgICBleHBlY3Qoc2V0dGluZ3MuYXBpS2V5KS50b0JlKCdzYXZlZC1rZXknKTtcclxuICAgIGV4cGVjdChzZXR0aW5ncy5wcm92aWRlcikudG9CZSgnb3BlbmFpJyk7XHJcbiAgICBleHBlY3Qoc2V0dGluZ3MubW9kZWwpLnRvQmUoJ2dwdC00Jyk7XHJcbiAgfSk7XHJcbiAgXHJcbiAgdGVzdCgnc2hvdWxkIG1pZ3JhdGUgc2V0dGluZ3MgZnJvbSBvbGQgZm9ybWF0JywgYXN5bmMgKCkgPT4ge1xyXG4gICAgY29uc3Qgb2xkU2V0dGluZ3MgPSB7XHJcbiAgICAgIGFwaUtleTogJ29sZC1rZXknLFxyXG4gICAgICBiY3BzOiAnU3lzdGVtLFZhdWx0LEVkaXRvcicgLy8gT2xkIGZvcm1hdFxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgY29uc3Qgc2V0dGluZ3NNYW5hZ2VyID0gYXdhaXQgc2V0dGluZ3NTZXJ2aWNlLmluaXRpYWxpemUob2xkU2V0dGluZ3MpO1xyXG4gICAgY29uc3Qgc2V0dGluZ3MgPSBzZXR0aW5nc01hbmFnZXIuZ2V0U2V0dGluZ3MoKTtcclxuICAgIFxyXG4gICAgZXhwZWN0KHNldHRpbmdzLmFwaUtleSkudG9CZSgnb2xkLWtleScpO1xyXG4gICAgZXhwZWN0KHNldHRpbmdzLmF1dG9Mb2FkQkNQcykudG9FcXVhbChbJ1N5c3RlbScsICdWYXVsdCcsICdFZGl0b3InXSk7IC8vIFNob3VsZCBiZSBtaWdyYXRlZCB0byBhcnJheVxyXG4gIH0pO1xyXG4gIFxyXG4gIHRlc3QoJ3Nob3VsZCBzYXZlIHNldHRpbmdzIHRvIHBsdWdpbiBkYXRhJywgYXN5bmMgKCkgPT4ge1xyXG4gICAgY29uc3Qgc2V0dGluZ3NNYW5hZ2VyID0gYXdhaXQgc2V0dGluZ3NTZXJ2aWNlLmluaXRpYWxpemUoe30pO1xyXG4gICAgXHJcbiAgICAvLyBVcGRhdGUgc2V0dGluZ3NcclxuICAgIGF3YWl0IHNldHRpbmdzTWFuYWdlci51cGRhdGVTZXR0aW5ncyh7XHJcbiAgICAgIGFwaUtleTogJ25ldy1rZXknXHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgLy8gQ2hlY2sgc2F2ZURhdGEgd2FzIGNhbGxlZFxyXG4gICAgZXhwZWN0KHBsdWdpbi5zYXZlRGF0YSkudG9IYXZlQmVlbkNhbGxlZFdpdGgoZXhwZWN0Lm9iamVjdENvbnRhaW5pbmcoe1xyXG4gICAgICBhcGlLZXk6ICduZXcta2V5J1xyXG4gICAgfSkpO1xyXG4gIH0pO1xyXG4gIFxyXG4gIHRlc3QoJ3Nob3VsZCBnZXQgc2V0dGluZ3MgbWFuYWdlcicsIGFzeW5jICgpID0+IHtcclxuICAgIGF3YWl0IHNldHRpbmdzU2VydmljZS5pbml0aWFsaXplKHt9KTtcclxuICAgIFxyXG4gICAgY29uc3Qgc2V0dGluZ3NNYW5hZ2VyID0gc2V0dGluZ3NTZXJ2aWNlLmdldFNldHRpbmdzTWFuYWdlcigpO1xyXG4gICAgXHJcbiAgICBleHBlY3Qoc2V0dGluZ3NNYW5hZ2VyKS50b0JlSW5zdGFuY2VPZihTZXR0aW5nc01hbmFnZXIpO1xyXG4gIH0pO1xyXG4gIFxyXG4gIHRlc3QoJ3Nob3VsZCBleHBvcnQgc2V0dGluZ3MnLCBhc3luYyAoKSA9PiB7XHJcbiAgICBhd2FpdCBzZXR0aW5nc1NlcnZpY2UuaW5pdGlhbGl6ZSh7XHJcbiAgICAgIGFwaUtleTogJ3NlY3JldC1rZXknLFxyXG4gICAgICBwcm92aWRlcjogJ2FudGhyb3BpYydcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICAvLyBFeHBvcnQgd2l0aG91dCBBUEkga2V5XHJcbiAgICBjb25zdCBleHBvcnRlZEpzb24gPSBzZXR0aW5nc1NlcnZpY2UuZXhwb3J0U2V0dGluZ3MoZmFsc2UpO1xyXG4gICAgY29uc3QgZXhwb3J0ZWQgPSBKU09OLnBhcnNlKGV4cG9ydGVkSnNvbik7XHJcbiAgICBcclxuICAgIGV4cGVjdChleHBvcnRlZC5wcm92aWRlcikudG9CZSgnYW50aHJvcGljJyk7XHJcbiAgICBleHBlY3QoZXhwb3J0ZWQuYXBpS2V5KS50b0JlKCcnKTsgLy8gQVBJIGtleSBzaG91bGQgYmUgcmVtb3ZlZFxyXG4gICAgXHJcbiAgICAvLyBFeHBvcnQgd2l0aCBBUEkga2V5XHJcbiAgICBjb25zdCBleHBvcnRlZFdpdGhLZXlKc29uID0gc2V0dGluZ3NTZXJ2aWNlLmV4cG9ydFNldHRpbmdzKHRydWUpO1xyXG4gICAgY29uc3QgZXhwb3J0ZWRXaXRoS2V5ID0gSlNPTi5wYXJzZShleHBvcnRlZFdpdGhLZXlKc29uKTtcclxuICAgIFxyXG4gICAgZXhwZWN0KGV4cG9ydGVkV2l0aEtleS5wcm92aWRlcikudG9CZSgnYW50aHJvcGljJyk7XHJcbiAgICBleHBlY3QoZXhwb3J0ZWRXaXRoS2V5LmFwaUtleSkudG9CZSgnc2VjcmV0LWtleScpOyAvLyBBUEkga2V5IHNob3VsZCBiZSBpbmNsdWRlZFxyXG4gIH0pO1xyXG4gIFxyXG4gIHRlc3QoJ3Nob3VsZCBpbXBvcnQgc2V0dGluZ3MnLCBhc3luYyAoKSA9PiB7XHJcbiAgICBhd2FpdCBzZXR0aW5nc1NlcnZpY2UuaW5pdGlhbGl6ZSh7fSk7XHJcbiAgICBcclxuICAgIGNvbnN0IGltcG9ydEpzb24gPSBKU09OLnN0cmluZ2lmeSh7XHJcbiAgICAgIHByb3ZpZGVyOiAnb3BlbmFpJyxcclxuICAgICAgbW9kZWw6ICdncHQtNCcsXHJcbiAgICAgIGRlYnVnTW9kZTogdHJ1ZVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIGF3YWl0IHNldHRpbmdzU2VydmljZS5pbXBvcnRTZXR0aW5ncyhpbXBvcnRKc29uKTtcclxuICAgIFxyXG4gICAgY29uc3Qgc2V0dGluZ3MgPSBzZXR0aW5nc1NlcnZpY2UuZ2V0U2V0dGluZ3NNYW5hZ2VyKCkuZ2V0U2V0dGluZ3MoKTtcclxuICAgIGV4cGVjdChzZXR0aW5ncy5wcm92aWRlcikudG9CZSgnb3BlbmFpJyk7XHJcbiAgICBleHBlY3Qoc2V0dGluZ3MubW9kZWwpLnRvQmUoJ2dwdC00Jyk7XHJcbiAgICBleHBlY3Qoc2V0dGluZ3MuZGVidWdNb2RlKS50b0JlKHRydWUpO1xyXG4gIH0pO1xyXG59KTtcclxuIl19