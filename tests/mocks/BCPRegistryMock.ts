import { App, Events } from 'obsidian';
import { BCPRegistry } from '../../src/mcp/BCPRegistry';
import { BoundedContextPack, Tool } from '../../src/mcp/interfaces';
import { EventBus } from '../../src/core/EventBus';
import { SettingsManager } from '../../src/core/SettingsManager';
import { VaultFacade } from '../../src/core/VaultFacade';

/**
 * Mock implementation of BCPRegistry for testing
 */
export class BCPRegistryMock extends BCPRegistry {
  private mockPacks: Map<string, BoundedContextPack> = new Map();
  private mockLoadedPacks: Set<string> = new Set();
  
  constructor(
    app: App,
    settings: SettingsManager,
    vaultFacade: VaultFacade,
    eventBus: EventBus
  ) {
    super(app, settings, vaultFacade, eventBus);
  }
  
  /**
   * Add a mock pack
   * @param pack - Pack to add
   */
  public addMockPack(pack: BoundedContextPack): void {
    this.mockPacks.set(pack.domain, pack);
  }
  
  /**
   * Set a pack as loaded
   * @param domain - Domain name
   */
  public setPackLoaded(domain: string): void {
    this.mockLoadedPacks.add(domain);
  }
  
  /**
   * Override getPack to return mock data
   */
  public override getPack(domain: string): BoundedContextPack | undefined {
    return this.mockPacks.get(domain);
  }
  
  /**
   * Override getLoadedPacks to return mock data
   */
  public override getLoadedPacks(): string[] {
    return Array.from(this.mockLoadedPacks);
  }
  
  /**
   * Override isPackLoaded to return mock data
   */
  public override isPackLoaded(domain: string): boolean {
    return this.mockLoadedPacks.has(domain);
  }
  
  /**
   * Clear all mock data
   */
  public clearMocks(): void {
    this.mockPacks.clear();
    this.mockLoadedPacks.clear();
  }
}
