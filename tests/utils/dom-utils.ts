/**
 * DOM Utilities for Testing
 * 
 * This file provides utilities for testing UI components that use Obsidian's
 * DOM manipulation methods. It extends the HTMLElement prototype with methods
 * like empty(), createDiv(), createSpan(), setText(), and addClass() to mimic
 * Obsidian's API.
 */

/**
 * Extend HTMLElement prototype with Obsidian's DOM manipulation methods
 */
export function setupDomUtils() {
  // Add Obsidian-specific methods to HTMLElement for testing
  if (!HTMLElement.prototype.empty) {
    HTMLElement.prototype.empty = function() {
      while (this.firstChild) {
        this.removeChild(this.firstChild);
      }
      return this;
    };
  }

  if (!HTMLElement.prototype.createDiv) {
    HTMLElement.prototype.createDiv = function(options?: { cls?: string, text?: string }) {
      const div = document.createElement('div');
      if (options?.cls) {
        div.className = options.cls;
      }
      if (options?.text) {
        div.textContent = options.text;
      }
      this.appendChild(div);
      return div;
    };
  }

  if (!HTMLElement.prototype.createSpan) {
    HTMLElement.prototype.createSpan = function(options?: { cls?: string, text?: string }) {
      const span = document.createElement('span');
      if (options?.cls) {
        span.className = options.cls;
      }
      if (options?.text) {
        span.textContent = options.text;
      }
      this.appendChild(span);
      return span;
    };
  }

  if (!HTMLElement.prototype.createEl) {
    HTMLElement.prototype.createEl = function<K extends keyof HTMLElementTagNameMap>(
      tag: K,
      options?: { cls?: string, text?: string, attr?: Record<string, string> }
    ): HTMLElementTagNameMap[K] {
      const el = document.createElement(tag);
      if (options?.cls) {
        el.className = options.cls;
      }
      if (options?.text) {
        el.textContent = options.text;
      }
      if (options?.attr) {
        Object.entries(options.attr).forEach(([key, value]) => {
          el.setAttribute(key, value);
        });
      }
      this.appendChild(el);
      return el as HTMLElementTagNameMap[K];
    };
  }

  if (!HTMLElement.prototype.setText) {
    HTMLElement.prototype.setText = function(text: string) {
      this.textContent = text;
      return this;
    };
  }

  if (!HTMLElement.prototype.addClass) {
    HTMLElement.prototype.addClass = function(className: string) {
      this.classList.add(className);
      return this;
    };
  }

  if (!HTMLElement.prototype.removeClass) {
    HTMLElement.prototype.removeClass = function(className: string) {
      this.classList.remove(className);
      return this;
    };
  }

  // Mock app.workspace.renderMarkdown
  if (typeof window !== 'undefined') {
    if (!window.app) {
      (window as any).app = {
        workspace: {
          renderMarkdown: (markdown: string, el: HTMLElement, sourcePath: string, component: any) => {
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
            } else {
              el.innerHTML += `<div class="markdown-rendered">${markdown}</div>`;
            }
            return el;
          }
        }
      };
    }
  }

  // Directly add the addChild method to the prototype
  if (typeof HTMLElement !== 'undefined' && !HTMLElement.prototype.addChild) {
    HTMLElement.prototype.addChild = function(child: any) {
      // Mock implementation
      return child;
    };
  }
}

/**
 * Extend the global interface for HTMLElement to include Obsidian's methods
 */
declare global {
  interface HTMLElement {
    empty(): HTMLElement;
    createDiv(options?: { cls?: string, text?: string }): HTMLDivElement;
    createSpan(options?: { cls?: string, text?: string }): HTMLSpanElement;
    createEl<K extends keyof HTMLElementTagNameMap>(
      tag: K,
      options?: { cls?: string, text?: string, attr?: Record<string, string> }
    ): HTMLElementTagNameMap[K];
    setText(text: string): HTMLElement;
    addClass(className: string): HTMLElement;
    removeClass(className: string): HTMLElement;
    addChild(child: any): any;
  }

  interface Window {
    app?: {
      workspace: {
        renderMarkdown: (markdown: string, el: HTMLElement, sourcePath: string, component: any) => HTMLElement;
      }
    }
  }
}
