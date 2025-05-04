/**
 * Obsidian imports utility.
 * 
 * This file provides a way to import Obsidian classes in a way that works
 * in both production and test environments. In production, it imports from
 * the actual Obsidian module. In tests, it imports from our mock implementation.
 */

// Define interfaces for Obsidian classes
export interface App {
  workspace: any;
  [key: string]: any;
}

export interface PluginSettingTab {
  app: App;
  containerEl: HTMLElement;
  display(): void;
  hide(): void;
}

export interface Setting {
  setName(name: string): Setting;
  setDesc(desc: string): Setting;
  addText(callback: (text: any) => any): Setting;
  addTextArea(callback: (textarea: any) => any): Setting;
  addToggle(callback: (toggle: any) => any): Setting;
  addDropdown(callback: (dropdown: any) => any): Setting;
  addSlider(callback: (slider: any) => any): Setting;
  addButton(callback: (button: any) => any): Setting;
  addExtraButton(callback: (button: any) => any): Setting;
  setClass(className: string): Setting;
  setDisabled(disabled: boolean): Setting;
  setWarning(): Setting;
}

export interface Plugin {
  app: App;
  manifest: any;
  registerEvent(event: any): void;
  loadData(): Promise<any>;
  saveData(data: any): Promise<void>;
  addSettingTab(tab: PluginSettingTab): void;
  addCommand(command: {
    id: string;
    name: string;
    callback?: () => any;
    checkCallback?: (checking: boolean) => boolean | void;
    hotkeys?: any[];
  }): void;
  addRibbonIcon(icon: string, title: string, callback: (evt: MouseEvent) => any): HTMLElement;
}

export interface Events {
  on(event: string, callback: (data?: any) => any): (data?: any) => any;
  off(event: string, callback: (data?: any) => any): void;
  trigger(event: string, data?: any): void;
}

export interface TFile {
  path: string;
  name: string;
  basename: string;
  extension: string;
}

export interface TFolder {
  path: string;
  name: string;
  children: Array<TFile | TFolder>;
}

export interface Notice {
  constructor(message: string, timeout?: number): Notice;
  setMessage(message: string): void;
  hide(): void;
  noticeEl: HTMLElement;
}

// Import implementations
let AppImpl: any;
let PluginSettingTabImpl: any;
let SettingImpl: any;
let PluginImpl: any;
let EventsImpl: any;
let TFileImpl: any;
let TFolderImpl: any;
let NoticeImpl: any;

try {
  // Try to import from the real Obsidian module
  const obsidian = require('obsidian');
  AppImpl = obsidian.App;
  PluginSettingTabImpl = obsidian.PluginSettingTab;
  SettingImpl = obsidian.Setting;
  PluginImpl = obsidian.Plugin;
  EventsImpl = obsidian.Events;
  TFileImpl = obsidian.TFile;
  TFolderImpl = obsidian.TFolder;
  NoticeImpl = obsidian.Notice;
} catch (e) {
  // If that fails, use our mock implementations
  try {
    const mocks = require('../../tests/mocks/obsidian');
    AppImpl = mocks.App;
    PluginSettingTabImpl = mocks.PluginSettingTab;
    SettingImpl = mocks.Setting;
    PluginImpl = mocks.Plugin;
    EventsImpl = mocks.Events;
  TFileImpl = mocks.TFile;
  TFolderImpl = mocks.TFolder;
  NoticeImpl = mocks.Notice;
  } catch (e) {
    // If both fail, provide dummy implementations
    console.warn('Neither Obsidian nor mocks could be loaded. Using dummy implementations.');
    
    class DummyClass {
      constructor() {
        console.warn('Using dummy Obsidian class');
      }
    }
    
    AppImpl = DummyClass;
    PluginSettingTabImpl = DummyClass;
    SettingImpl = DummyClass;
    PluginImpl = DummyClass;
    EventsImpl = DummyClass;
    TFileImpl = DummyClass;
    TFolderImpl = DummyClass;
    NoticeImpl = DummyClass;
  }
}

// Export implementations
export const App = AppImpl;
export const PluginSettingTab = PluginSettingTabImpl;
export const Setting = SettingImpl;
export const Plugin = PluginImpl;
export const Events = EventsImpl;
export const TFile = TFileImpl;
export const TFolder = TFolderImpl;
export const Notice = NoticeImpl;
