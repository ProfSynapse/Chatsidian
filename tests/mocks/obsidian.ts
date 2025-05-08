/**
 * Mock implementation of Obsidian's API for testing.
 * This allows us to test components that depend on Obsidian's API
 * without requiring the actual Obsidian module.
 * 
 * This file provides mock implementations of various Obsidian classes and functions
 * including Component, Events, TFile, Notice, Menu, and more.
 */

/**
 * Mock implementation of Obsidian's debounce function.
 * @param fn - Function to debounce
 * @param timeout - Timeout in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  timeout: number = 0
): (...args: Parameters<T>) => void {
  let timer: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timer) {
      clearTimeout(timer);
    }
    
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, timeout);
  };
}

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
 * Mock implementation of Obsidian's Menu class.
 */
export class Menu {
  private items: any[] = [];
  
  /**
   * Add an item to the menu.
   * @param callback Function to call with the item
   * @returns This menu
   */
  addItem(callback: (item: any) => any): this {
    const item = {
      setTitle: () => item,
      setIcon: () => item,
      onClick: (fn: () => void) => {
        if (fn) fn();
        return item;
      }
    };
    callback(item);
    this.items.push(item);
    return this;
  }
  
  /**
   * Show the menu at a mouse event.
   * @param event Mouse event
   */
  showAtMouseEvent(event: MouseEvent): void {
    // Mock implementation
  }
  
  /**
   * Show the menu at a position.
   * @param x X coordinate
   * @param y Y coordinate
   */
  showAtPosition(x: number, y: number): void {
    // Mock implementation
  }
  
  /**
   * Hide the menu.
   */
  hide(): void {
    // Mock implementation
  }
}

/**
 * Mock implementation of Obsidian's setIcon function.
 * @param el Element to set the icon on
 * @param iconId Icon ID
 */
export function setIcon(el: HTMLElement, iconId: string): void {
  el.innerHTML = `<svg class="icon ${iconId}"><use xlink:href="#${iconId}"></use></svg>`;
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
 * Mock implementation of Obsidian's Component class.
 */
export class Component {
  private _loaded: boolean = false;
  private _children: Component[] = [];
  
  /**
   * Register an event to be detached when the component is unloaded.
   * @param event Event to register
   */
  registerEvent(event: any): void {
    // Mock implementation
  }
  
  /**
   * Load the component.
   */
  load(): void {
    this._loaded = true;
  }
  
  /**
   * Unload the component.
   */
  unload(): void {
    this._loaded = false;
    
    // Unload all children
    for (const child of this._children) {
      child.unload();
    }
    this._children = [];
  }
  
  /**
   * Check if the component is loaded.
   */
  get loaded(): boolean {
    return this._loaded;
  }
  
  /**
   * Add a child component.
   * @param component Child component
   */
  addChild(component: Component): Component {
    this._children.push(component);
    return component;
  }
  
  /**
   * Register a DOM event to be detached when the component is unloaded.
   * @param el Element
   * @param event Event name
   * @param callback Callback function
   */
  registerDomEvent(el: Element, event: string, callback: (evt: any) => any): void {
    // Mock implementation
    el.addEventListener(event, callback);
  }
}

/**
 * Mock implementation of Obsidian's MarkdownRenderer class.
 */
export class MarkdownRenderer {
  /**
   * Render markdown content to an element.
   * @param markdown The markdown content to render
   * @param el The element to render into
   * @param sourcePath The source path of the markdown file
   * @param component The component that owns this markdown
   * @returns The element with rendered markdown
   */
  static async renderMarkdown(
    markdown: string,
    el: HTMLElement,
    sourcePath: string,
    component: Component
  ): Promise<HTMLElement> {
    // Create proper markdown structure with h1 and li elements for tests to pass
    if (markdown.includes('# ')) {
      const h1 = document.createElement('h1');
      h1.textContent = markdown.split('# ')[1].split('\n')[0];
      el.appendChild(h1);
    }
    
    if (markdown.includes('- ')) {
      const ul = document.createElement('ul');
      const lines = markdown.split('\n');
      for (const line of lines) {
        if (line.startsWith('- ')) {
          const li = document.createElement('li');
          li.textContent = line.substring(2);
          ul.appendChild(li);
        }
      }
      el.appendChild(ul);
    }
    
    // Handle code blocks
    if (markdown.includes('```')) {
      const codeBlocks = markdown.match(/```(\w*)\n([\s\S]*?)```/g);
      if (codeBlocks) {
        for (const block of codeBlocks) {
          const language = block.match(/```(\w*)/)?.[1] || '';
          const code = block.replace(/```\w*\n/, '').replace(/```$/, '');
          
          const pre = document.createElement('pre');
          const codeEl = document.createElement('code');
          codeEl.textContent = code;
          codeEl.className = `language-${language || 'text'}`;
          pre.appendChild(codeEl);
          el.appendChild(pre);
        }
      }
    }
    
    // Handle plain text that's not in special blocks
    const plainText = markdown
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/^#.*$/gm, '') // Remove headings
      .replace(/^- .*$/gm, '') // Remove list items
      .trim();
    
    if (plainText) {
      const p = document.createElement('p');
      p.textContent = plainText;
      el.appendChild(p);
    }
    
    return el;
  }
}

/**
 * Mock implementation of Obsidian's WorkspaceLeaf class.
 */
export class WorkspaceLeaf {
  containerEl: HTMLElement;
  view: View | null = null;
  
  constructor() {
    this.containerEl = document.createElement('div');
  }
  
  getViewType(): string {
    return this.view ? this.view.getViewType() : '';
  }
  
  async setViewState(state: any): Promise<void> {
    // Mock implementation
  }
}

/**
 * Mock implementation of Obsidian's View class.
 */
export class View {
  containerEl: HTMLElement;
  
  constructor() {
    this.containerEl = document.createElement('div');
  }
  
  getViewType(): string {
    return '';
  }
  
  onOpen(): Promise<void> {
    return Promise.resolve();
  }
  
  onClose(): Promise<void> {
    return Promise.resolve();
  }
}

/**
 * Mock implementation of Obsidian's ItemView class.
 */
export class ItemView extends View {
  leaf: WorkspaceLeaf;
  
  constructor(leaf: WorkspaceLeaf) {
    super();
    this.leaf = leaf;
    this.containerEl = leaf.containerEl;
  }
  
  getDisplayText(): string {
    return '';
  }
  
  getIcon(): string {
    return '';
  }
  
  onResize(): void {
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

/**
 * Mock implementation of Obsidian's Modal class.
 */
export class Modal {
  app: App;
  contentEl: HTMLElement;
  
  constructor(app: App) {
    this.app = app;
    this.contentEl = document.createElement('div');
  }
  
  open(): void {
    // Mock implementation
  }
  
  close(): void {
    // Mock implementation
  }
  
  onOpen(): void {
    // Mock implementation to be overridden
  }
  
  onClose(): void {
    // Mock implementation to be overridden
  }
}

/**
 * Mock implementation of Obsidian's DropdownComponent class.
 */
export class DropdownComponent {
  containerEl: HTMLElement;
  selectEl: HTMLSelectElement;
  
  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
    this.selectEl = document.createElement('select');
    this.containerEl.appendChild(this.selectEl);
  }
  
  addOption(value: string, display: string): this {
    const option = document.createElement('option');
    option.value = value;
    option.text = display;
    this.selectEl.appendChild(option);
    return this;
  }
  
  setValue(value: string): this {
    this.selectEl.value = value;
    return this;
  }
  
  getValue(): string {
    return this.selectEl.value;
  }
  
  onChange(callback: (value: string) => any): this {
    this.selectEl.addEventListener('change', () => {
      callback(this.getValue());
    });
    return this;
  }
}

/**
 * Mock implementation of Obsidian's ButtonComponent class.
 */
export class ButtonComponent {
  containerEl: HTMLElement;
  buttonEl: HTMLButtonElement;
  
  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
    this.buttonEl = document.createElement('button');
    this.containerEl.appendChild(this.buttonEl);
  }
  
  setButtonText(text: string): this {
    this.buttonEl.textContent = text;
    return this;
  }
  
  setIcon(icon: string): this {
    setIcon(this.buttonEl, icon);
    return this;
  }
  
  setTooltip(tooltip: string): this {
    this.buttonEl.setAttribute('aria-label', tooltip);
    return this;
  }
  
  setCta(): this {
    this.buttonEl.classList.add('mod-cta');
    return this;
  }
  
  onClick(callback: (evt: MouseEvent) => any): this {
    this.buttonEl.addEventListener('click', callback);
    return this;
  }
  
  setDisabled(disabled: boolean): this {
    this.buttonEl.disabled = disabled;
    return this;
  }
}

/**
 * Mock implementation of Obsidian's TextComponent class.
 */
export class TextComponent {
  containerEl: HTMLElement;
  inputEl: HTMLInputElement;
  
  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
    this.inputEl = document.createElement('input');
    this.inputEl.type = 'text';
    this.containerEl.appendChild(this.inputEl);
  }
  
  setValue(value: string): this {
    this.inputEl.value = value;
    return this;
  }
  
  getValue(): string {
    return this.inputEl.value;
  }
  
  setPlaceholder(placeholder: string): this {
    this.inputEl.placeholder = placeholder;
    return this;
  }
  
  onChange(callback: (value: string) => any): this {
    this.inputEl.addEventListener('change', () => {
      callback(this.getValue());
    });
    return this;
  }
  
  setDisabled(disabled: boolean): this {
    this.inputEl.disabled = disabled;
    return this;
  }
}

/**
 * Mock implementation of Obsidian's ToggleComponent class.
 */
export class ToggleComponent {
  containerEl: HTMLElement;
  toggleEl: HTMLInputElement;
  
  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
    this.toggleEl = document.createElement('input');
    this.toggleEl.type = 'checkbox';
    this.containerEl.appendChild(this.toggleEl);
  }
  
  setValue(value: boolean): this {
    this.toggleEl.checked = value;
    return this;
  }
  
  getValue(): boolean {
    return this.toggleEl.checked;
  }
  
  onChange(callback: (value: boolean) => any): this {
    this.toggleEl.addEventListener('change', () => {
      callback(this.getValue());
    });
    return this;
  }
  
  setDisabled(disabled: boolean): this {
    this.toggleEl.disabled = disabled;
    return this;
  }
}
