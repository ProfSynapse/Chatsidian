/**
 * Mock implementation of Obsidian's API for testing.
 * This allows us to test components that depend on Obsidian's API
 * without requiring the actual Obsidian module.
 */

/**
 * Mock implementation of Obsidian's Events class.
 */
export class Events {
  private events: Record<string, Array<(data?: any) => any>> = {};

  /**
   * Register an event handler.
   * @param event Event name
   * @param callback Function to call when the event is triggered
   * @returns The callback function
   */
  on(event: string, callback: (data?: any) => any): (data?: any) => any {
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
  off(event: string, callback: (data?: any) => any): void {
    if (!this.events[event]) return;
    
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
  trigger(event: string, data?: any): void {
    if (!this.events[event]) return;
    
    for (const callback of this.events[event]) {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    }
  }
}

/**
 * Mock implementation of Obsidian's TFile class.
 */
export class TFile {
  path: string;
  name: string;
  basename: string;
  extension: string;
  
  constructor(path: string) {
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
  path: string;
  name: string;
  children: Array<TFile | TFolder>;
  
  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() || '';
    this.children = [];
  }
  
  /**
   * Add a child file or folder.
   * @param child Child file or folder
   */
  addChild(child: TFile | TFolder): void {
    this.children.push(child);
  }
}

/**
 * Mock implementation of Obsidian's Notice class.
 */
export class Notice {
  noticeEl: HTMLElement;
  private message: string;
  
  constructor(message: string, timeout?: number) {
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
  setMessage(message: string): void {
    this.message = message;
    this.noticeEl.textContent = message;
  }
  
  /**
   * Hide the notice.
   */
  hide(): void {
    // In a real implementation, this would remove the notice from the DOM
  }
}

/**
 * Mock implementation of Obsidian's Plugin class.
 */
export class Plugin {
  app: any;
  manifest: any;
  
  constructor() {
    this.app = {};
    this.manifest = {};
  }
  
  registerEvent(event: any): void {
    // Mock implementation
  }
  
  async loadData(): Promise<any> {
    return {};
  }
  
  async saveData(data: any): Promise<void> {
    // Mock implementation
  }
  
  addSettingTab(tab: PluginSettingTab): void {
    // Mock implementation
  }
  
  addCommand(command: {
    id: string;
    name: string;
    callback?: () => any;
    checkCallback?: (checking: boolean) => boolean | void;
    hotkeys?: any[];
  }): void {
    // Mock implementation
  }
  
  addRibbonIcon(icon: string, title: string, callback: (evt: MouseEvent) => any): HTMLElement {
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
  workspace: any;
  
  constructor() {
    this.workspace = {};
  }
}

/**
 * Mock implementation of Obsidian's PluginSettingTab class.
 */
export class PluginSettingTab {
  app: App;
  containerEl: HTMLElement;
  
  constructor(app: App, plugin: any) {
    this.app = app;
    this.containerEl = document.createElement('div');
  }
  
  display(): void {
    // Mock implementation
  }
  
  hide(): void {
    // Mock implementation
  }
}

/**
 * Mock implementation of Obsidian's Setting class.
 */
export class Setting {
  private containerEl: HTMLElement;
  private settingEl: HTMLElement;
  
  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
    this.settingEl = document.createElement('div');
    this.containerEl.appendChild(this.settingEl);
  }
  
  setName(name: string): this {
    return this;
  }
  
  setDesc(desc: string): this {
    return this;
  }
  
  addText(callback: (text: any) => any): this {
    return this;
  }
  
  addTextArea(callback: (textarea: any) => any): this {
    return this;
  }
  
  addToggle(callback: (toggle: any) => any): this {
    return this;
  }
  
  addDropdown(callback: (dropdown: any) => any): this {
    return this;
  }
  
  addSlider(callback: (slider: any) => any): this {
    return this;
  }
  
  addButton(callback: (button: any) => any): this {
    return this;
  }
  
  addExtraButton(callback: (button: any) => any): this {
    return this;
  }
  
  setClass(className: string): this {
    return this;
  }
  
  setDisabled(disabled: boolean): this {
    return this;
  }
  
  setWarning(): this {
    return this;
  }
}
