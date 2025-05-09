/**
 * Settings service for plugin integration.
 *
 * This file provides a service class for initializing and managing plugin settings,
 * integrating the SettingsManager with the Obsidian plugin lifecycle.
 */
import { DEFAULT_SETTINGS } from '../models/Settings';
import { SettingsManager, ChatsidianSettingTab, SettingsExportImport, SettingsMigration } from '../core/SettingsManager';
/**
 * Service class for initializing and managing plugin settings.
 * Provides a bridge between the plugin and the settings management system.
 */
export class SettingsService {
    /**
     * Create a new SettingsService.
     * @param app Obsidian app instance
     * @param plugin Plugin instance
     * @param eventBus Event bus
     */
    constructor(app, plugin, eventBus) {
        this.app = app;
        this.plugin = plugin;
        this.eventBus = eventBus;
    }
    /**
     * Initialize the settings service.
     * @param savedData Previously saved settings data
     * @returns The settings manager
     */
    async initialize(savedData) {
        // Migrate settings if necessary
        const migratedSettings = SettingsMigration.migrateSettings(savedData);
        // Create settings manager
        this.settingsManager = new SettingsManager(migratedSettings || DEFAULT_SETTINGS, async (settings) => await this.saveSettings(settings), this.eventBus);
        // Create export/import utility
        this.settingsExportImport = new SettingsExportImport(this.settingsManager);
        // Add settings tab to Obsidian
        this.plugin.addSettingTab(new ChatsidianSettingTab(this.app, this.plugin));
        // Emit settings loaded event
        this.eventBus.emit('settings:loaded', this.settingsManager.getSettings());
        return this.settingsManager;
    }
    /**
     * Save settings to disk.
     * @param settings Settings to save
     * @returns Promise that resolves when settings are saved
     */
    async saveSettings(settings) {
        await this.plugin.saveData(settings);
    }
    /**
     * Get the settings manager.
     * @returns The settings manager
     */
    getSettingsManager() {
        return this.settingsManager;
    }
    /**
     * Export settings to JSON.
     * @param includeApiKey Whether to include the API key
     * @returns Settings as a JSON string
     */
    exportSettings(includeApiKey = false) {
        return this.settingsExportImport.exportToJson(includeApiKey);
    }
    /**
     * Import settings from JSON.
     * @param json Settings JSON
     * @returns Promise that resolves when settings are imported
     */
    async importSettings(json) {
        await this.settingsExportImport.importFromJson(json);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU2V0dGluZ3NTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiU2V0dGluZ3NTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7OztHQUtHO0FBR0gsT0FBTyxFQUFzQixnQkFBZ0IsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzFFLE9BQU8sRUFDTCxlQUFlLEVBQ2Ysb0JBQW9CLEVBQ3BCLG9CQUFvQixFQUNwQixpQkFBaUIsRUFDbEIsTUFBTSx5QkFBeUIsQ0FBQztBQUdqQzs7O0dBR0c7QUFDSCxNQUFNLE9BQU8sZUFBZTtJQU8xQjs7Ozs7T0FLRztJQUNILFlBQVksR0FBUSxFQUFFLE1BQVcsRUFBRSxRQUFrQjtRQUNuRCxJQUFJLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztRQUNmLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO0lBQzNCLENBQUM7SUFFRDs7OztPQUlHO0lBQ0ksS0FBSyxDQUFDLFVBQVUsQ0FBQyxTQUFjO1FBQ3BDLGdDQUFnQztRQUNoQyxNQUFNLGdCQUFnQixHQUFHLGlCQUFpQixDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUV0RSwwQkFBMEI7UUFDMUIsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLGVBQWUsQ0FDeEMsZ0JBQWdCLElBQUksZ0JBQWdCLEVBQ3BDLEtBQUssRUFBRSxRQUE0QixFQUFFLEVBQUUsQ0FBQyxNQUFNLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLEVBQ3pFLElBQUksQ0FBQyxRQUFRLENBQ2QsQ0FBQztRQUVGLCtCQUErQjtRQUMvQixJQUFJLENBQUMsb0JBQW9CLEdBQUcsSUFBSSxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7UUFFM0UsK0JBQStCO1FBQy9CLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLElBQUksb0JBQW9CLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUUzRSw2QkFBNkI7UUFDN0IsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO1FBRTFFLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQztJQUM5QixDQUFDO0lBRUQ7Ozs7T0FJRztJQUNLLEtBQUssQ0FBQyxZQUFZLENBQUMsUUFBNEI7UUFDckQsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUN2QyxDQUFDO0lBRUQ7OztPQUdHO0lBQ0ksa0JBQWtCO1FBQ3ZCLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQztJQUM5QixDQUFDO0lBRUQ7Ozs7T0FJRztJQUNJLGNBQWMsQ0FBQyxnQkFBeUIsS0FBSztRQUNsRCxPQUFPLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxZQUFZLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDL0QsQ0FBQztJQUVEOzs7O09BSUc7SUFDSSxLQUFLLENBQUMsY0FBYyxDQUFDLElBQVk7UUFDdEMsTUFBTSxJQUFJLENBQUMsb0JBQW9CLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3ZELENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBTZXR0aW5ncyBzZXJ2aWNlIGZvciBwbHVnaW4gaW50ZWdyYXRpb24uXHJcbiAqIFxyXG4gKiBUaGlzIGZpbGUgcHJvdmlkZXMgYSBzZXJ2aWNlIGNsYXNzIGZvciBpbml0aWFsaXppbmcgYW5kIG1hbmFnaW5nIHBsdWdpbiBzZXR0aW5ncyxcclxuICogaW50ZWdyYXRpbmcgdGhlIFNldHRpbmdzTWFuYWdlciB3aXRoIHRoZSBPYnNpZGlhbiBwbHVnaW4gbGlmZWN5Y2xlLlxyXG4gKi9cclxuXHJcbmltcG9ydCB7IEFwcCB9IGZyb20gJy4uL3V0aWxzL29ic2lkaWFuLWltcG9ydHMnO1xyXG5pbXBvcnQgeyBDaGF0c2lkaWFuU2V0dGluZ3MsIERFRkFVTFRfU0VUVElOR1MgfSBmcm9tICcuLi9tb2RlbHMvU2V0dGluZ3MnO1xyXG5pbXBvcnQgeyBcclxuICBTZXR0aW5nc01hbmFnZXIsIFxyXG4gIENoYXRzaWRpYW5TZXR0aW5nVGFiLFxyXG4gIFNldHRpbmdzRXhwb3J0SW1wb3J0LFxyXG4gIFNldHRpbmdzTWlncmF0aW9uXHJcbn0gZnJvbSAnLi4vY29yZS9TZXR0aW5nc01hbmFnZXInO1xyXG5pbXBvcnQgeyBFdmVudEJ1cyB9IGZyb20gJy4uL2NvcmUvRXZlbnRCdXMnO1xyXG5cclxuLyoqXHJcbiAqIFNlcnZpY2UgY2xhc3MgZm9yIGluaXRpYWxpemluZyBhbmQgbWFuYWdpbmcgcGx1Z2luIHNldHRpbmdzLlxyXG4gKiBQcm92aWRlcyBhIGJyaWRnZSBiZXR3ZWVuIHRoZSBwbHVnaW4gYW5kIHRoZSBzZXR0aW5ncyBtYW5hZ2VtZW50IHN5c3RlbS5cclxuICovXHJcbmV4cG9ydCBjbGFzcyBTZXR0aW5nc1NlcnZpY2Uge1xyXG4gIHByaXZhdGUgYXBwOiBBcHA7XHJcbiAgcHJpdmF0ZSBwbHVnaW46IGFueTtcclxuICBwcml2YXRlIGV2ZW50QnVzOiBFdmVudEJ1cztcclxuICBwcml2YXRlIHNldHRpbmdzTWFuYWdlcjogU2V0dGluZ3NNYW5hZ2VyO1xyXG4gIHByaXZhdGUgc2V0dGluZ3NFeHBvcnRJbXBvcnQ6IFNldHRpbmdzRXhwb3J0SW1wb3J0O1xyXG4gIFxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIG5ldyBTZXR0aW5nc1NlcnZpY2UuXHJcbiAgICogQHBhcmFtIGFwcCBPYnNpZGlhbiBhcHAgaW5zdGFuY2VcclxuICAgKiBAcGFyYW0gcGx1Z2luIFBsdWdpbiBpbnN0YW5jZVxyXG4gICAqIEBwYXJhbSBldmVudEJ1cyBFdmVudCBidXNcclxuICAgKi9cclxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBhbnksIGV2ZW50QnVzOiBFdmVudEJ1cykge1xyXG4gICAgdGhpcy5hcHAgPSBhcHA7XHJcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcclxuICAgIHRoaXMuZXZlbnRCdXMgPSBldmVudEJ1cztcclxuICB9XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbGl6ZSB0aGUgc2V0dGluZ3Mgc2VydmljZS5cclxuICAgKiBAcGFyYW0gc2F2ZWREYXRhIFByZXZpb3VzbHkgc2F2ZWQgc2V0dGluZ3MgZGF0YVxyXG4gICAqIEByZXR1cm5zIFRoZSBzZXR0aW5ncyBtYW5hZ2VyXHJcbiAgICovXHJcbiAgcHVibGljIGFzeW5jIGluaXRpYWxpemUoc2F2ZWREYXRhOiBhbnkpOiBQcm9taXNlPFNldHRpbmdzTWFuYWdlcj4ge1xyXG4gICAgLy8gTWlncmF0ZSBzZXR0aW5ncyBpZiBuZWNlc3NhcnlcclxuICAgIGNvbnN0IG1pZ3JhdGVkU2V0dGluZ3MgPSBTZXR0aW5nc01pZ3JhdGlvbi5taWdyYXRlU2V0dGluZ3Moc2F2ZWREYXRhKTtcclxuICAgIFxyXG4gICAgLy8gQ3JlYXRlIHNldHRpbmdzIG1hbmFnZXJcclxuICAgIHRoaXMuc2V0dGluZ3NNYW5hZ2VyID0gbmV3IFNldHRpbmdzTWFuYWdlcihcclxuICAgICAgbWlncmF0ZWRTZXR0aW5ncyB8fCBERUZBVUxUX1NFVFRJTkdTLFxyXG4gICAgICBhc3luYyAoc2V0dGluZ3M6IENoYXRzaWRpYW5TZXR0aW5ncykgPT4gYXdhaXQgdGhpcy5zYXZlU2V0dGluZ3Moc2V0dGluZ3MpLFxyXG4gICAgICB0aGlzLmV2ZW50QnVzXHJcbiAgICApO1xyXG4gICAgXHJcbiAgICAvLyBDcmVhdGUgZXhwb3J0L2ltcG9ydCB1dGlsaXR5XHJcbiAgICB0aGlzLnNldHRpbmdzRXhwb3J0SW1wb3J0ID0gbmV3IFNldHRpbmdzRXhwb3J0SW1wb3J0KHRoaXMuc2V0dGluZ3NNYW5hZ2VyKTtcclxuICAgIFxyXG4gICAgLy8gQWRkIHNldHRpbmdzIHRhYiB0byBPYnNpZGlhblxyXG4gICAgdGhpcy5wbHVnaW4uYWRkU2V0dGluZ1RhYihuZXcgQ2hhdHNpZGlhblNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMucGx1Z2luKSk7XHJcbiAgICBcclxuICAgIC8vIEVtaXQgc2V0dGluZ3MgbG9hZGVkIGV2ZW50XHJcbiAgICB0aGlzLmV2ZW50QnVzLmVtaXQoJ3NldHRpbmdzOmxvYWRlZCcsIHRoaXMuc2V0dGluZ3NNYW5hZ2VyLmdldFNldHRpbmdzKCkpO1xyXG4gICAgXHJcbiAgICByZXR1cm4gdGhpcy5zZXR0aW5nc01hbmFnZXI7XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIFNhdmUgc2V0dGluZ3MgdG8gZGlzay5cclxuICAgKiBAcGFyYW0gc2V0dGluZ3MgU2V0dGluZ3MgdG8gc2F2ZVxyXG4gICAqIEByZXR1cm5zIFByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIHNldHRpbmdzIGFyZSBzYXZlZFxyXG4gICAqL1xyXG4gIHByaXZhdGUgYXN5bmMgc2F2ZVNldHRpbmdzKHNldHRpbmdzOiBDaGF0c2lkaWFuU2V0dGluZ3MpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVEYXRhKHNldHRpbmdzKTtcclxuICB9XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBzZXR0aW5ncyBtYW5hZ2VyLlxyXG4gICAqIEByZXR1cm5zIFRoZSBzZXR0aW5ncyBtYW5hZ2VyXHJcbiAgICovXHJcbiAgcHVibGljIGdldFNldHRpbmdzTWFuYWdlcigpOiBTZXR0aW5nc01hbmFnZXIge1xyXG4gICAgcmV0dXJuIHRoaXMuc2V0dGluZ3NNYW5hZ2VyO1xyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBFeHBvcnQgc2V0dGluZ3MgdG8gSlNPTi5cclxuICAgKiBAcGFyYW0gaW5jbHVkZUFwaUtleSBXaGV0aGVyIHRvIGluY2x1ZGUgdGhlIEFQSSBrZXlcclxuICAgKiBAcmV0dXJucyBTZXR0aW5ncyBhcyBhIEpTT04gc3RyaW5nXHJcbiAgICovXHJcbiAgcHVibGljIGV4cG9ydFNldHRpbmdzKGluY2x1ZGVBcGlLZXk6IGJvb2xlYW4gPSBmYWxzZSk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gdGhpcy5zZXR0aW5nc0V4cG9ydEltcG9ydC5leHBvcnRUb0pzb24oaW5jbHVkZUFwaUtleSk7XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIEltcG9ydCBzZXR0aW5ncyBmcm9tIEpTT04uXHJcbiAgICogQHBhcmFtIGpzb24gU2V0dGluZ3MgSlNPTlxyXG4gICAqIEByZXR1cm5zIFByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIHNldHRpbmdzIGFyZSBpbXBvcnRlZFxyXG4gICAqL1xyXG4gIHB1YmxpYyBhc3luYyBpbXBvcnRTZXR0aW5ncyhqc29uOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMuc2V0dGluZ3NFeHBvcnRJbXBvcnQuaW1wb3J0RnJvbUpzb24oanNvbik7XHJcbiAgfVxyXG59XHJcbiJdfQ==