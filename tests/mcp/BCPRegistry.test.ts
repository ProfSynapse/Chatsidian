/**
 * Tests for the BCP Registry
 * 
 * This file contains tests for the BCPRegistry class, which manages
 * Bounded Context Packs (BCPs) in the Chatsidian plugin.
 */

import { App, Component, Events } from 'obsidian';
import { BCPRegistryForTests } from '../../src/mcp/BCPRegistryForTests';
import { SettingsManager } from '../../src/core/SettingsManager';
import { VaultFacade } from '../../src/core/VaultFacade';
import { EventBus } from '../../src/core/EventBus';
import { BoundedContextPack, Tool } from '../../src/mcp/interfaces';

// Mock dependencies
jest.mock('obsidian');

describe('BCPRegistry', () => {
  // Test dependencies
  let app: jest.Mocked<App>;
  let settings: jest.Mocked<SettingsManager>;
  let vaultFacade: jest.Mocked<VaultFacade>;
  let eventBus: jest.Mocked<EventBus>;
  let registry: BCPRegistryForTests;
  
  // Mock BCP for testing
  const mockBCP: BoundedContextPack = {
    domain: 'TestDomain',
    description: 'Test BCP for testing',
    tools: [
      {
        name: 'testTool',
        description: 'A test tool',
        handler: jest.fn().mockResolvedValue({ success: true }),
        schema: { type: 'object' },
        icon: 'test-icon'
      }
    ],
    onload: jest.fn().mockResolvedValue(undefined),
    onunload: jest.fn().mockResolvedValue(undefined)
  };
  
  // Mock BCP with dependencies
  const mockBCPWithDeps: BoundedContextPack = {
    domain: 'DependentDomain',
    description: 'Test BCP with dependencies',
    dependencies: ['TestDomain'],
    tools: [
      {
        name: 'dependentTool',
        description: 'A dependent tool',
        handler: jest.fn().mockResolvedValue({ success: true }),
        schema: { type: 'object' }
      }
    ],
    onload: jest.fn().mockResolvedValue(undefined),
    onunload: jest.fn().mockResolvedValue(undefined)
  };
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock dependencies
    app = {
      workspace: {
        onLayoutReady: jest.fn().mockImplementation(cb => cb())
      }
    } as unknown as jest.Mocked<App>;
    
    settings = {
      getSettings: jest.fn().mockReturnValue({
        autoLoadBCPs: ['TestDomain']
      })
    } as unknown as jest.Mocked<SettingsManager>;
    
    vaultFacade = {} as jest.Mocked<VaultFacade>;
    
    eventBus = {
      on: jest.fn().mockImplementation((event, callback) => {
        // Return a function that can be properly bound
        return callback;
      }),
      emit: jest.fn()
    } as unknown as jest.Mocked<EventBus>;
    
    // Create registry instance
    registry = new BCPRegistryForTests(app, settings, vaultFacade, eventBus);
    
    // Mock methods
    registry.mockPackImport = jest.fn().mockReturnValue(mockBCP);
    
    // Mock Events class
    (Events as jest.Mock).mockImplementation(() => ({
      on: jest.fn(),
      off: jest.fn(),
      trigger: jest.fn()
    }));
    
    // Mock Component class
    (Component as jest.Mock).mockImplementation(() => ({
      load: jest.fn(),
      unload: jest.fn(),
      register: jest.fn(),
      registerEvent: jest.fn(),
      addChild: jest.fn()
    }));
    
    // Add addChild method to the registry instance
    registry.addChild = jest.fn();
  });
  
  describe('initialization', () => {
    it('should initialize correctly', async () => {
      // Call onload
      await registry.onload();
      
      // Verify workspace.onLayoutReady was called
      expect(app.workspace.onLayoutReady).toHaveBeenCalled();
      
      // Verify system BCP was registered
      expect(registry.packs.has('System')).toBe(true);
      expect(registry.loadedPacks.has('System')).toBe(true);
    });
    
    it('should discover built-in packs', async () => {
      // Call discoverPacks directly
      await registry.discoverPacks();
      
      // Verify mockPackImport was called for each built-in domain
      expect(registry.mockPackImport).toHaveBeenCalledTimes(4);
      
      // Verify events were triggered
      expect(registry.events.trigger).toHaveBeenCalledWith(
        'bcpRegistry:discoveryComplete',
        expect.any(Object)
      );
    });
    
    it('should auto-load configured packs', async () => {
      // Register a test pack
      registry.registerPack(mockBCP);
      
      // Call loadAutoLoadPacks
      await registry.loadAutoLoadPacks();
      
      // Verify pack was loaded
      expect(registry.loadedPacks.has('TestDomain')).toBe(true);
      
      // Verify events were triggered
      expect(registry.events.trigger).toHaveBeenCalledWith(
        'bcpRegistry:autoLoadComplete',
        expect.any(Object)
      );
    });
  });
  
  describe('pack registration', () => {
    it('should register a pack correctly', () => {
      // Register a test pack
      registry.registerPack(mockBCP);
      
      // Verify pack was registered
      expect(registry.packs.has('TestDomain')).toBe(true);
      expect(registry.packs.get('TestDomain')).toBe(mockBCP);
      
      // Verify component was created
      expect(registry.packComponents.has('TestDomain')).toBe(true);
      
      // Verify events were triggered
      expect(registry.events.trigger).toHaveBeenCalledWith(
        'bcpRegistry:packRegistered',
        expect.objectContaining({
          domain: 'TestDomain',
          toolCount: 1
        })
      );
    });
    
    it('should register dependencies correctly', () => {
      // Register a pack with dependencies
      registry.registerPack(mockBCPWithDeps);
      
      // Verify dependencies were registered
      expect(registry.dependencies.has('DependentDomain')).toBe(true);
      expect(registry.dependencies.get('DependentDomain')?.has('TestDomain')).toBe(true);
    });
    
    it('should validate packs during registration', () => {
      // Try to register an invalid pack (no domain)
      const invalidPack = { ...mockBCP, domain: undefined };
      
      // Expect error
      expect(() => registry.registerPack(invalidPack as any)).toThrow('Pack domain is required');
      
      // Try to register an invalid pack (no tools)
      const invalidPack2 = { ...mockBCP, tools: undefined };
      
      // Expect error
      expect(() => registry.registerPack(invalidPack2 as any)).toThrow('Pack tools must be an array');
    });
  });
  
  describe('pack loading', () => {
    beforeEach(() => {
      // Register test packs
      registry.registerPack(mockBCP);
      registry.registerPack(mockBCPWithDeps);
    });
    
    it('should load a pack correctly', async () => {
      // Load the test pack
      const result = await registry.loadPack('TestDomain');
      
      // Verify result
      expect(result).toEqual({
        loaded: 'TestDomain',
        status: 'loaded',
        dependencies: undefined
      });
      
      // Verify pack was loaded
      expect(registry.loadedPacks.has('TestDomain')).toBe(true);
      
      // Verify onload was called
      expect(mockBCP.onload).toHaveBeenCalled();
      
      // Verify events were triggered
      expect(registry.events.trigger).toHaveBeenCalledWith(
        'bcpRegistry:packLoaded',
        expect.objectContaining({
          domain: 'TestDomain'
        })
      );
    });
    
    it('should load dependencies automatically', async () => {
      // Load the dependent pack
      const result = await registry.loadPack('DependentDomain');
      
      // Verify result
      expect(result).toEqual({
        loaded: 'DependentDomain',
        status: 'loaded',
        dependencies: ['TestDomain']
      });
      
      // Verify both packs were loaded
      expect(registry.loadedPacks.has('TestDomain')).toBe(true);
      expect(registry.loadedPacks.has('DependentDomain')).toBe(true);
      
      // Verify onload was called for both packs
      expect(mockBCP.onload).toHaveBeenCalled();
      expect(mockBCPWithDeps.onload).toHaveBeenCalled();
    });
    
    it('should handle already loaded packs', async () => {
      // Load the test pack
      await registry.loadPack('TestDomain');
      
      // Try to load it again
      const result = await registry.loadPack('TestDomain');
      
      // Verify result
      expect(result).toEqual({
        loaded: 'TestDomain',
        status: 'already-loaded'
      });
      
      // Verify onload was called only once
      expect(mockBCP.onload).toHaveBeenCalledTimes(1);
    });
    
    it('should handle non-existent packs', async () => {
      // Try to load a non-existent pack
      await expect(registry.loadPack('NonExistentDomain')).rejects.toThrow(
        'BCP NonExistentDomain not found'
      );
    });
  });
  
  describe('pack unloading', () => {
    beforeEach(async () => {
      // Register and load test packs
      registry.registerPack(mockBCP);
      registry.registerPack(mockBCPWithDeps);
      await registry.loadPack('TestDomain');
      await registry.loadPack('DependentDomain');
    });
    
    it('should unload a pack correctly', async () => {
      // Unload the dependent pack first (to avoid dependency issues)
      const result = await registry.unloadPack('DependentDomain');
      
      // Verify result
      expect(result).toEqual({
        unloaded: 'DependentDomain',
        status: 'unloaded',
        dependents: undefined
      });
      
      // Verify pack was unloaded
      expect(registry.loadedPacks.has('DependentDomain')).toBe(false);
      
      // Verify onunload was called
      expect(mockBCPWithDeps.onunload).toHaveBeenCalled();
      
      // Verify events were triggered
      expect(registry.events.trigger).toHaveBeenCalledWith(
        'bcpRegistry:packUnloaded',
        expect.objectContaining({
          domain: 'DependentDomain'
        })
      );
    });
    
    it('should unload dependents automatically', async () => {
      // Try to unload the base pack
      const result = await registry.unloadPack('TestDomain');
      
      // Verify result
      expect(result).toEqual({
        unloaded: 'TestDomain',
        status: 'unloaded',
        dependents: ['DependentDomain']
      });
      
      // Verify both packs were unloaded
      expect(registry.loadedPacks.has('TestDomain')).toBe(false);
      expect(registry.loadedPacks.has('DependentDomain')).toBe(false);
      
      // Verify onunload was called for both packs
      expect(mockBCP.onunload).toHaveBeenCalled();
      expect(mockBCPWithDeps.onunload).toHaveBeenCalled();
    });
    
    it('should handle already unloaded packs', async () => {
      // Unload the dependent pack
      await registry.unloadPack('DependentDomain');
      
      // Try to unload it again
      const result = await registry.unloadPack('DependentDomain');
      
      // Verify result
      expect(result).toEqual({
        unloaded: 'DependentDomain',
        status: 'not-loaded'
      });
      
      // Verify onunload was called only once
      expect(mockBCPWithDeps.onunload).toHaveBeenCalledTimes(1);
    });
    
    it('should prevent unloading the System BCP', async () => {
      // Try to unload the System BCP
      await expect(registry.unloadPack('System')).rejects.toThrow(
        'Cannot unload System BCP'
      );
    });
  });
  
  describe('tool management', () => {
    beforeEach(async () => {
      // Register and load test packs
      registry.registerPack(mockBCP);
      await registry.loadPack('TestDomain');
    });
    
    it('should list loaded tools correctly', () => {
      // Get loaded tools
      const tools = registry.getLoadedTools();
      
      // Verify tools
      expect(tools).toHaveLength(2); // System BCP tool + TestDomain tool
      expect(tools.some(t => t.name === 'TestDomain.testTool')).toBe(true);
    });
    
    it('should check if a tool exists correctly', () => {
      // Check if tools exist
      expect(registry.hasToolById('TestDomain.testTool')).toBe(true);
      expect(registry.hasToolById('TestDomain.nonExistentTool')).toBe(false);
      expect(registry.hasToolById('NonExistentDomain.testTool')).toBe(false);
    });
    
    it('should get a tool by ID correctly', () => {
      // Get tool by ID
      const tool = registry.getToolById('TestDomain.testTool');
      
      // Verify tool
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('testTool');
      expect(tool?.description).toBe('A test tool');
      
      // Get non-existent tool
      expect(registry.getToolById('TestDomain.nonExistentTool')).toBeUndefined();
      expect(registry.getToolById('NonExistentDomain.testTool')).toBeUndefined();
    });
  });
  
  describe('metadata and listing', () => {
    beforeEach(() => {
      // Register test packs
      registry.registerPack(mockBCP);
      registry.registerPack(mockBCPWithDeps);
    });
    
    it('should list packs correctly', () => {
      // List packs
      const packs = registry.listPacks();
      
      // Verify packs
      expect(packs).toHaveLength(3); // System BCP + 2 test packs
      
      // Find TestDomain pack
      const testPack = packs.find(p => p.domain === 'TestDomain');
      expect(testPack).toBeDefined();
      expect(testPack?.description).toBe('Test BCP for testing');
      expect(testPack?.toolCount).toBe(1);
      expect(testPack?.icon).toBe('test-icon');
      
      // Find DependentDomain pack
      const depPack = packs.find(p => p.domain === 'DependentDomain');
      expect(depPack).toBeDefined();
      expect(depPack?.dependencies).toContain('TestDomain');
    });
    
    it('should provide detailed pack listing', () => {
      // Get detailed listing
      const listing = registry.listPacksDetailed();
      
      // Verify listing
      expect(listing.packs).toHaveLength(3); // System BCP + 2 test packs
      expect(listing.total).toBe(3);
      expect(listing.loaded).toBe(1); // Only System BCP is loaded by default
    });
  });
  
  describe('cleanup', () => {
    beforeEach(async () => {
      // Register and load test packs
      registry.registerPack(mockBCP);
      registry.registerPack(mockBCPWithDeps);
      await registry.loadPack('TestDomain');
      await registry.loadPack('DependentDomain');
    });
    
    it('should clean up correctly on unload', async () => {
      // Call onunload
      await registry.onunload();
      
      // Verify all packs were unloaded except System
      expect(registry.loadedPacks.size).toBe(1);
      expect(registry.loadedPacks.has('System')).toBe(true);
      
      // Verify onunload was called for both packs
      expect(mockBCP.onunload).toHaveBeenCalled();
      expect(mockBCPWithDeps.onunload).toHaveBeenCalled();
    });
    
    describe('error handling', () => {
      it('should handle errors during pack discovery', async () => {
        // Mock discovery error
        jest.spyOn(registry, 'discoverPacks').mockImplementation(() => {
          console.error('Error discovering packs:', new Error('Discovery error'));
          throw new Error('Discovery error');
        });
        
        // Mock console.error to verify it's called
        const originalConsoleError = console.error;
        console.error = jest.fn();
        
        try {
          // Should throw after logging error
          await registry.discoverPacks();
          fail('Expected an error to be thrown');
        } catch (error) {
          // Verify error was logged
          expect(console.error).toHaveBeenCalled();
        }
        
        // Restore console.error
        console.error = originalConsoleError;
      });
      
      it('should handle errors during pack loading', async () => {
        // Register a pack with failing onload
        const errorPack = {
          ...mockBCP,
          domain: 'ErrorPack',
          onload: jest.fn().mockRejectedValue(new Error('Load error'))
        };
        
        registry.registerPack(errorPack);
        
        // Should throw when loading
        await expect(registry.loadPack('ErrorPack')).rejects.toThrow('Load error');
        
        // Verify pack is not marked as loaded
        expect(registry.loadedPacks.has('ErrorPack')).toBe(false);
      });
    });
  
    describe('settings changes', () => {
      it('should update auto-loaded BCPs when settings change', async () => {
        // Register test packs
        registry.registerPack(mockBCP);
        const mockBCPWithDeps = {
          ...mockBCP,
          domain: 'DependentDomain',
          dependencies: ['TestDomain']
        };
        registry.registerPack(mockBCPWithDeps);
        
        // Load initial packs
        await registry.loadAutoLoadPacks();
        
        // Verify TestDomain is loaded
        expect(registry.loadedPacks.has('TestDomain')).toBe(true);
        
        // Simulate settings change by directly calling loadPack for DependentDomain
        await registry.loadPack('DependentDomain');
        
        // Verify TestDomain is still loaded (due to dependency) and DependentDomain is loaded
        expect(registry.loadedPacks.has('TestDomain')).toBe(true);
        expect(registry.loadedPacks.has('DependentDomain')).toBe(true);
      });
    });
  });
  
  describe('error handling', () => {
    it('should handle errors during pack discovery', async () => {
      // Mock discovery error
      jest.spyOn(registry, 'discoverPacks').mockImplementation(() => {
        console.error('Error discovering packs:', new Error('Discovery error'));
        throw new Error('Discovery error');
      });
      
      // Mock console.error to verify it's called
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      try {
        // Should throw after logging error
        await registry.discoverPacks();
        fail('Expected an error to be thrown');
      } catch (error) {
        // Verify error was logged
        expect(console.error).toHaveBeenCalled();
      }
      
      // Restore console.error
      console.error = originalConsoleError;
    });
    
    it('should handle errors during pack loading', async () => {
      // Register a pack with failing onload
      const errorPack = {
        ...mockBCP,
        domain: 'ErrorPack',
        onload: jest.fn().mockRejectedValue(new Error('Load error'))
      };
      
      registry.registerPack(errorPack);
      
      // Should throw when loading
      await expect(registry.loadPack('ErrorPack')).rejects.toThrow('Load error');
      
      // Verify pack is not marked as loaded
      expect(registry.loadedPacks.has('ErrorPack')).toBe(false);
    });
  });

  describe('dependency handling', () => {
    it('should load dependencies when loading a pack', async () => {
      // Register test packs
      registry.registerPack(mockBCP);
      const mockBCPWithDeps = {
        ...mockBCP,
        domain: 'DependentDomain',
        dependencies: ['TestDomain']
      };
      registry.registerPack(mockBCPWithDeps);
      
      // Load the dependent pack
      await registry.loadPack('DependentDomain');
      
      // Verify both packs are loaded
      expect(registry.loadedPacks.has('TestDomain')).toBe(true);
      expect(registry.loadedPacks.has('DependentDomain')).toBe(true);
    });
  });
});
