/**
 * Mock implementation of Obsidian's API for testing.
 * This allows us to test components that depend on Obsidian's API
 * without requiring the actual Obsidian module.
 */
/**
 * Mock implementation of Obsidian's Events class.
 */
export class Events {
    constructor() {
        this.events = {};
    }
    /**
     * Register an event handler.
     * @param event Event name
     * @param callback Function to call when the event is triggered
     * @returns The callback function
     */
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
        return callback;
    }
    /**
     * Unregister an event handler.
     * @param event Event name
     * @param callback Function to remove
     */
    off(event, callback) {
        if (!this.events[event])
            return;
        const index = this.events[event].indexOf(callback);
        if (index !== -1) {
            this.events[event].splice(index, 1);
        }
        if (this.events[event].length === 0) {
            delete this.events[event];
        }
    }
    /**
     * Trigger an event.
     * @param event Event name
     * @param data Data to pass to handlers
     */
    trigger(event, data) {
        if (!this.events[event])
            return;
        for (const callback of this.events[event]) {
            try {
                callback(data);
            }
            catch (error) {
                console.error(`Error in event handler for ${event}:`, error);
            }
        }
    }
}
/**
 * Mock implementation of Obsidian's TFile class.
 */
export class TFile {
    constructor(path) {
        this.path = path;
        this.name = path.split('/').pop() || '';
        // Extract basename and extension
        const parts = this.name.split('.');
        this.extension = parts.length > 1 ? parts.pop() || '' : '';
        this.basename = parts.join('.');
    }
}
/**
 * Mock implementation of Obsidian's TFolder class.
 */
export class TFolder {
    constructor(path) {
        this.path = path;
        this.name = path.split('/').pop() || '';
        this.children = [];
    }
    /**
     * Add a child file or folder.
     * @param child Child file or folder
     */
    addChild(child) {
        this.children.push(child);
    }
}
/**
 * Mock implementation of Obsidian's Notice class.
 */
export class Notice {
    constructor(message, timeout) {
        this.message = message;
        this.noticeEl = document.createElement('div');
        this.noticeEl.textContent = message;
        // Auto-hide after timeout if specified
        if (timeout) {
            setTimeout(() => this.hide(), timeout);
        }
    }
    /**
     * Set the notice message.
     * @param message New message
     */
    setMessage(message) {
        this.message = message;
        this.noticeEl.textContent = message;
    }
    /**
     * Hide the notice.
     */
    hide() {
        // In a real implementation, this would remove the notice from the DOM
    }
}
/**
 * Mock implementation of Obsidian's Plugin class.
 */
export class Plugin {
    constructor() {
        this.app = {};
        this.manifest = {};
    }
    registerEvent(event) {
        // Mock implementation
    }
    async loadData() {
        return {};
    }
    async saveData(data) {
        // Mock implementation
    }
    addSettingTab(tab) {
        // Mock implementation
    }
    addCommand(command) {
        // Mock implementation
    }
    addRibbonIcon(icon, title, callback) {
        const element = document.createElement('div');
        element.classList.add('ribbon-icon');
        element.setAttribute('aria-label', title);
        element.addEventListener('click', callback);
        return element;
    }
}
/**
 * Mock implementation of Obsidian's App class.
 */
export class App {
    constructor() {
        this.workspace = {};
    }
}
/**
 * Mock implementation of Obsidian's PluginSettingTab class.
 */
export class PluginSettingTab {
    constructor(app, plugin) {
        this.app = app;
        this.containerEl = document.createElement('div');
    }
    display() {
        // Mock implementation
    }
    hide() {
        // Mock implementation
    }
}
/**
 * Mock implementation of Obsidian's Setting class.
 */
export class Setting {
    constructor(containerEl) {
        this.containerEl = containerEl;
        this.settingEl = document.createElement('div');
        this.containerEl.appendChild(this.settingEl);
    }
    setName(name) {
        return this;
    }
    setDesc(desc) {
        return this;
    }
    addText(callback) {
        return this;
    }
    addTextArea(callback) {
        return this;
    }
    addToggle(callback) {
        return this;
    }
    addDropdown(callback) {
        return this;
    }
    addSlider(callback) {
        return this;
    }
    addButton(callback) {
        return this;
    }
    addExtraButton(callback) {
        return this;
    }
    setClass(className) {
        return this;
    }
    setDisabled(disabled) {
        return this;
    }
    setWarning() {
        return this;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2JzaWRpYW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJvYnNpZGlhbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7OztHQUlHO0FBRUg7O0dBRUc7QUFDSCxNQUFNLE9BQU8sTUFBTTtJQUFuQjtRQUNVLFdBQU0sR0FBK0MsRUFBRSxDQUFDO0lBa0RsRSxDQUFDO0lBaERDOzs7OztPQUtHO0lBQ0gsRUFBRSxDQUFDLEtBQWEsRUFBRSxRQUE2QjtRQUM3QyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3hCLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQzFCLENBQUM7UUFDRCxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNsQyxPQUFPLFFBQVEsQ0FBQztJQUNsQixDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILEdBQUcsQ0FBQyxLQUFhLEVBQUUsUUFBNkI7UUFDOUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDO1lBQUUsT0FBTztRQUVoQyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNuRCxJQUFJLEtBQUssS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQ2pCLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztRQUN0QyxDQUFDO1FBRUQsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUNwQyxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDNUIsQ0FBQztJQUNILENBQUM7SUFFRDs7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Q0FBQyxLQUFLLENBQUMsQ0FBQztRQUMvQyxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDL0MsQ0FBQztJQUVELE9BQU8sQ0FBQyxJQUFZO1FBQ2xCLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVELE9BQU8sQ0FBQyxJQUFZO1FBQ2xCLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVELE9BQU8sQ0FBQyxRQUE0QjtRQUNsQyxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRCxXQUFXLENBQUMsUUFBZ0M7UUFDMUMsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQsU0FBUyxDQUFDLFFBQThCO1FBQ3RDLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVELFdBQVcsQ0FBQyxRQUFnQztRQUMxQyxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRCxTQUFTLENBQUMsUUFBOEI7UUFDdEMsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQsU0FBUyxDQUFDLFFBQThCO1FBQ3RDLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVELGNBQWMsQ0FBQyxRQUE4QjtRQUMzQyxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRCxRQUFRLENBQUMsU0FBaUI7UUFDeEIsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQsV0FBVyxDQUFDLFFBQWlCO1FBQzNCLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVELFVBQVU7UUFDUixPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBNb2NrIGltcGxlbWVudGF0aW9uIG9mIE9ic2lkaWFuJ3MgQVBJIGZvciB0ZXN0aW5nLlxyXG4gKiBUaGlzIGFsbG93cyB1cyB0byB0ZXN0IGNvbXBvbmVudHMgdGhhdCBkZXBlbmQgb24gT2JzaWRpYW4ncyBBUElcclxuICogd2l0aG91dCByZXF1aXJpbmcgdGhlIGFjdHVhbCBPYnNpZGlhbiBtb2R1bGUuXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIE1vY2sgaW1wbGVtZW50YXRpb24gb2YgT2JzaWRpYW4ncyBFdmVudHMgY2xhc3MuXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgRXZlbnRzIHtcclxuICBwcml2YXRlIGV2ZW50czogUmVjb3JkPHN0cmluZywgQXJyYXk8KGRhdGE/OiBhbnkpID0+IGFueT4+ID0ge307XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlZ2lzdGVyIGFuIGV2ZW50IGhhbmRsZXIuXHJcbiAgICogQHBhcmFtIGV2ZW50IEV2ZW50IG5hbWVcclxuICAgKiBAcGFyYW0gY2FsbGJhY2sgRnVuY3Rpb24gdG8gY2FsbCB3aGVuIHRoZSBldmVudCBpcyB0cmlnZ2VyZWRcclxuICAgKiBAcmV0dXJucyBUaGUgY2FsbGJhY2sgZnVuY3Rpb25cclxuICAgKi9cclxuICBvbihldmVudDogc3RyaW5nLCBjYWxsYmFjazogKGRhdGE/OiBhbnkpID0+IGFueSk6IChkYXRhPzogYW55KSA9PiBhbnkge1xyXG4gICAgaWYgKCF0aGlzLmV2ZW50c1tldmVudF0pIHtcclxuICAgICAgdGhpcy5ldmVudHNbZXZlbnRdID0gW107XHJcbiAgICB9XHJcbiAgICB0aGlzLmV2ZW50c1tldmVudF0ucHVzaChjYWxsYmFjayk7XHJcbiAgICByZXR1cm4gY2FsbGJhY2s7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVbnJlZ2lzdGVyIGFuIGV2ZW50IGhhbmRsZXIuXHJcbiAgICogQHBhcmFtIGV2ZW50IEV2ZW50IG5hbWVcclxuICAgKiBAcGFyYW0gY2FsbGJhY2sgRnVuY3Rpb24gdG8gcmVtb3ZlXHJcbiAgICovXHJcbiAgb2ZmKGV2ZW50OiBzdHJpbmcsIGNhbGxiYWNrOiAoZGF0YT86IGFueSkgPT4gYW55KTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMuZXZlbnRzW2V2ZW50XSkgcmV0dXJuO1xyXG4gICAgXHJcbiAgICBjb25zdCBpbmRleCA9IHRoaXMuZXZlbnRzW2V2ZW50XS5pbmRleE9mKGNhbGxiYWNrKTtcclxuICAgIGlmIChpbmRleCAhPT0gLTEpIHtcclxuICAgICAgdGhpcy5ldmVudHNbZXZlbnRdLnNwbGljZShpbmRleCwgMSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGlmICh0aGlzLmV2ZW50c1tldmVudF0ubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgIGRlbGV0ZSB0aGlzLmV2ZW50c1tldmVudF07XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBUcmlnZ2VyIGFuIGV2ZW50LlxyXG4gICAqIEBwYXJhbSBldmVudCBFdmVudCBuYW1lXHJcbiAgICogQHBhcmFtIGRhdGEgRGF0YSB0byBwYXNzIHRvIGhhbmRsZXJzXHJcbiAgICovXHJcbiAgdHJpZ2dlcihldmVudDogc3RyaW5nLCBkYXRhPzogYW55KTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMuZXZlbnRzW2V2ZW50XSkgcmV0dXJuO1xyXG4gICAgXHJcbiAgICBmb3IgKGNvbnN0IGNhbGxiYWNrIG9mIHRoaXMuZXZlbnRzW2V2ZW50XSkge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGNhbGxiYWNrKGRhdGEpO1xyXG4gICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYEVycm9yIGluIGV2ZW50IGhhbmRsZXIgZm9yICR7ZXZlbnR9OmAsIGVycm9yKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIE1vY2sgaW1wbGVtZW50YXRpb24gb2YgT2JzaWRpYW4ncyBURmlsZSBjbGFzcy5cclxuICovXHJcbmV4cG9ydCBjbGFzcyBURmlsZSB7XHJcbiAgcGF0aDogc3RyaW5nO1xyXG4gIG5hbWU6IHN0cmluZztcclxuICBiYXNlbmFtZTogc3RyaW5nO1xyXG4gIGV4dGVuc2lvbjogc3RyaW5nO1xyXG4gIFxyXG4gIGNvbnN0cnVjdG9yKHBhdGg6IHN0cmluZykge1xyXG4gICAgdGhpcy5wYXRoID0gcGF0aDtcclxuICAgIHRoaXMubmFtZSA9IHBhdGguc3BsaXQoJy8nKS5wb3AoKSB8fCAnJztcclxuICAgIFxyXG4gICAgLy8gRXh0cmFjdCBiYXNlbmFtZSBhbmQgZXh0ZW5zaW9uXHJcbiAgICBjb25zdCBwYXJ0cyA9IHRoaXMubmFtZS5zcGxpdCgnLicpO1xyXG4gICAgdGhpcy5leHRlbnNpb24gPSBwYXJ0cy5sZW5ndGggPiAxID8gcGFydHMucG9wKCkgfHwgJycgOiAnJztcclxuICAgIHRoaXMuYmFzZW5hbWUgPSBwYXJ0cy5qb2luKCcuJyk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogTW9jayBpbXBsZW1lbnRhdGlvbiBvZiBPYnNpZGlhbidzIFRGb2xkZXIgY2xhc3MuXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgVEZvbGRlciB7XHJcbiAgcGF0aDogc3RyaW5nO1xyXG4gIG5hbWU6IHN0cmluZztcclxuICBjaGlsZHJlbjogQXJyYXk8VEZpbGUgfCBURm9sZGVyPjtcclxuICBcclxuICBjb25zdHJ1Y3RvcihwYXRoOiBzdHJpbmcpIHtcclxuICAgIHRoaXMucGF0aCA9IHBhdGg7XHJcbiAgICB0aGlzLm5hbWUgPSBwYXRoLnNwbGl0KCcvJykucG9wKCkgfHwgJyc7XHJcbiAgICB0aGlzLmNoaWxkcmVuID0gW107XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIEFkZCBhIGNoaWxkIGZpbGUgb3IgZm9sZGVyLlxyXG4gICAqIEBwYXJhbSBjaGlsZCBDaGlsZCBmaWxlIG9yIGZvbGRlclxyXG4gICAqL1xyXG4gIGFkZENoaWxkKGNoaWxkOiBURmlsZSB8IFRGb2xkZXIpOiB2b2lkIHtcclxuICAgIHRoaXMuY2hpbGRyZW4ucHVzaChjaGlsZCk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogTW9jayBpbXBsZW1lbnRhdGlvbiBvZiBPYnNpZGlhbidzIE5vdGljZSBjbGFzcy5cclxuICovXHJcbmV4cG9ydCBjbGFzcyBOb3RpY2Uge1xyXG4gIG5vdGljZUVsOiBIVE1MRWxlbWVudDtcclxuICBwcml2YXRlIG1lc3NhZ2U6IHN0cmluZztcclxuICBcclxuICBjb25zdHJ1Y3RvcihtZXNzYWdlOiBzdHJpbmcsIHRpbWVvdXQ/OiBudW1iZXIpIHtcclxuICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XHJcbiAgICB0aGlzLm5vdGljZUVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICB0aGlzLm5vdGljZUVsLnRleHRDb250ZW50ID0gbWVzc2FnZTtcclxuICAgIFxyXG4gICAgLy8gQXV0by1oaWRlIGFmdGVyIHRpbWVvdXQgaWYgc3BlY2lmaWVkXHJcbiAgICBpZiAodGltZW91dCkge1xyXG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMuaGlkZSgpLCB0aW1lb3V0KTtcclxuICAgIH1cclxuICB9XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogU2V0IHRoZSBub3RpY2UgbWVzc2FnZS5cclxuICAgKiBAcGFyYW0gbWVzc2FnZSBOZXcgbWVzc2FnZVxyXG4gICAqL1xyXG4gIHNldE1lc3NhZ2UobWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XHJcbiAgICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xyXG4gICAgdGhpcy5ub3RpY2VFbC50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XHJcbiAgfVxyXG4gIFxyXG4gIC8qKlxyXG4gICAqIEhpZGUgdGhlIG5vdGljZS5cclxuICAgKi9cclxuICBoaWRlKCk6IHZvaWQge1xyXG4gICAgLy8gSW4gYSByZWFsIGltcGxlbWVudGF0aW9uLCB0aGlzIHdvdWxkIHJlbW92ZSB0aGUgbm90aWNlIGZyb20gdGhlIERPTVxyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIE1vY2sgaW1wbGVtZW50YXRpb24gb2YgT2JzaWRpYW4ncyBQbHVnaW4gY2xhc3MuXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgUGx1Z2luIHtcclxuICBhcHA6IGFueTtcclxuICBtYW5pZmVzdDogYW55O1xyXG4gIFxyXG4gIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgdGhpcy5hcHAgPSB7fTtcclxuICAgIHRoaXMubWFuaWZlc3QgPSB7fTtcclxuICB9XHJcbiAgXHJcbiAgcmVnaXN0ZXJFdmVudChldmVudDogYW55KTogdm9pZCB7XHJcbiAgICAvLyBNb2NrIGltcGxlbWVudGF0aW9uXHJcbiAgfVxyXG4gIFxyXG4gIGFzeW5jIGxvYWREYXRhKCk6IFByb21pc2U8YW55PiB7XHJcbiAgICByZXR1cm4ge307XHJcbiAgfVxyXG4gIFxyXG4gIGFzeW5jIHNhdmVEYXRhKGRhdGE6IGFueSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgLy8gTW9jayBpbXBsZW1lbnRhdGlvblxyXG4gIH1cclxuICBcclxuICBhZGRTZXR0aW5nVGFiKHRhYjogUGx1Z2luU2V0dGluZ1RhYik6IHZvaWQge1xyXG4gICAgLy8gTW9jayBpbXBsZW1lbnRhdGlvblxyXG4gIH1cclxuICBcclxuICBhZGRDb21tYW5kKGNvbW1hbmQ6IHtcclxuICAgIGlkOiBzdHJpbmc7XHJcbiAgICBuYW1lOiBzdHJpbmc7XHJcbiAgICBjYWxsYmFjaz86ICgpID0+IGFueTtcclxuICAgIGNoZWNrQ2FsbGJhY2s/OiAoY2hlY2tpbmc6IGJvb2xlYW4pID0+IGJvb2xlYW4gfCB2b2lkO1xyXG4gICAgaG90a2V5cz86IGFueVtdO1xyXG4gIH0pOiB2b2lkIHtcclxuICAgIC8vIE1vY2sgaW1wbGVtZW50YXRpb25cclxuICB9XHJcbiAgXHJcbiAgYWRkUmliYm9uSWNvbihpY29uOiBzdHJpbmcsIHRpdGxlOiBzdHJpbmcsIGNhbGxiYWNrOiAoZXZ0OiBNb3VzZUV2ZW50KSA9PiBhbnkpOiBIVE1MRWxlbWVudCB7XHJcbiAgICBjb25zdCBlbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICBlbGVtZW50LmNsYXNzTGlzdC5hZGQoJ3JpYmJvbi1pY29uJyk7XHJcbiAgICBlbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIHRpdGxlKTtcclxuICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBjYWxsYmFjayk7XHJcbiAgICByZXR1cm4gZWxlbWVudDtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBNb2NrIGltcGxlbWVudGF0aW9uIG9mIE9ic2lkaWFuJ3MgQXBwIGNsYXNzLlxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEFwcCB7XHJcbiAgd29ya3NwYWNlOiBhbnk7XHJcbiAgXHJcbiAgY29uc3RydWN0b3IoKSB7XHJcbiAgICB0aGlzLndvcmtzcGFjZSA9IHt9O1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIE1vY2sgaW1wbGVtZW50YXRpb24gb2YgT2JzaWRpYW4ncyBQbHVnaW5TZXR0aW5nVGFiIGNsYXNzLlxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFBsdWdpblNldHRpbmdUYWIge1xyXG4gIGFwcDogQXBwO1xyXG4gIGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudDtcclxuICBcclxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBhbnkpIHtcclxuICAgIHRoaXMuYXBwID0gYXBwO1xyXG4gICAgdGhpcy5jb250YWluZXJFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIH1cclxuICBcclxuICBkaXNwbGF5KCk6IHZvaWQge1xyXG4gICAgLy8gTW9jayBpbXBsZW1lbnRhdGlvblxyXG4gIH1cclxuICBcclxuICBoaWRlKCk6IHZvaWQge1xyXG4gICAgLy8gTW9jayBpbXBsZW1lbnRhdGlvblxyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIE1vY2sgaW1wbGVtZW50YXRpb24gb2YgT2JzaWRpYW4ncyBTZXR0aW5nIGNsYXNzLlxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFNldHRpbmcge1xyXG4gIHByaXZhdGUgY29udGFpbmVyRWw6IEhUTUxFbGVtZW50O1xyXG4gIHByaXZhdGUgc2V0dGluZ0VsOiBIVE1MRWxlbWVudDtcclxuICBcclxuICBjb25zdHJ1Y3Rvcihjb250YWluZXJFbDogSFRNTEVsZW1lbnQpIHtcclxuICAgIHRoaXMuY29udGFpbmVyRWwgPSBjb250YWluZXJFbDtcclxuICAgIHRoaXMuc2V0dGluZ0VsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICB0aGlzLmNvbnRhaW5lckVsLmFwcGVuZENoaWxkKHRoaXMuc2V0dGluZ0VsKTtcclxuICB9XHJcbiAgXHJcbiAgc2V0TmFtZShuYW1lOiBzdHJpbmcpOiB0aGlzIHtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuICBcclxuICBzZXREZXNjKGRlc2M6IHN0cmluZyk6IHRoaXMge1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG4gIFxyXG4gIGFkZFRleHQoY2FsbGJhY2s6ICh0ZXh0OiBhbnkpID0+IGFueSk6IHRoaXMge1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG4gIFxyXG4gIGFkZFRleHRBcmVhKGNhbGxiYWNrOiAodGV4dGFyZWE6IGFueSkgPT4gYW55KTogdGhpcyB7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcbiAgXHJcbiAgYWRkVG9nZ2xlKGNhbGxiYWNrOiAodG9nZ2xlOiBhbnkpID0+IGFueSk6IHRoaXMge1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG4gIFxyXG4gIGFkZERyb3Bkb3duKGNhbGxiYWNrOiAoZHJvcGRvd246IGFueSkgPT4gYW55KTogdGhpcyB7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcbiAgXHJcbiAgYWRkU2xpZGVyKGNhbGxiYWNrOiAoc2xpZGVyOiBhbnkpID0+IGFueSk6IHRoaXMge1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG4gIFxyXG4gIGFkZEJ1dHRvbihjYWxsYmFjazogKGJ1dHRvbjogYW55KSA9PiBhbnkpOiB0aGlzIHtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuICBcclxuICBhZGRFeHRyYUJ1dHRvbihjYWxsYmFjazogKGJ1dHRvbjogYW55KSA9PiBhbnkpOiB0aGlzIHtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuICBcclxuICBzZXRDbGFzcyhjbGFzc05hbWU6IHN0cmluZyk6IHRoaXMge1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG4gIFxyXG4gIHNldERpc2FibGVkKGRpc2FibGVkOiBib29sZWFuKTogdGhpcyB7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcbiAgXHJcbiAgc2V0V2FybmluZygpOiB0aGlzIHtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxufVxyXG4iXX0=