import { TypedEventBus, EventTypes } from '../../src/core/EventTypes';
import { EventBus } from '../../src/core/EventBus';

describe('TypedEventBus', () => {
  let eventBus: EventBus;
  let typedEventBus: TypedEventBus;
  
  beforeEach(() => {
    eventBus = new EventBus();
    typedEventBus = new TypedEventBus(eventBus);
  });
  
  test('should register and trigger typed event handlers', () => {
    const handler = jest.fn();
    
    typedEventBus.on('ui:theme:changed', handler);
    typedEventBus.emit('ui:theme:changed', 'dark');
    
    expect(handler).toHaveBeenCalledWith('dark');
  });
  
  test('should unregister typed event handlers', () => {
    const handler = jest.fn();
    
    typedEventBus.on('ui:theme:changed', handler);
    typedEventBus.off('ui:theme:changed', handler);
    typedEventBus.emit('ui:theme:changed', 'dark');
    
    expect(handler).not.toHaveBeenCalled();
  });
  
  test('should handle complex typed events', () => {
    const handler = jest.fn();
    const event: EventTypes['settings:updated'] = {
      previousSettings: { /* Minimal mock of settings */ } as any,
      currentSettings: { /* Minimal mock of settings */ } as any,
      changedKeys: ['theme', 'fontSize']
    };
    
    typedEventBus.on('settings:updated', handler);
    typedEventBus.emit('settings:updated', event);
    
    expect(handler).toHaveBeenCalledWith(event);
    expect(handler.mock.calls[0][0].changedKeys).toEqual(['theme', 'fontSize']);
  });
  
  test('should await async typed event handlers', async () => {
    const handler = jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    
    typedEventBus.on('plugin:loaded', handler);
    await typedEventBus.emitAsync('plugin:loaded', undefined);
    
    expect(handler).toHaveBeenCalled();
  });
  
  test('should get a list of events with listeners', () => {
    typedEventBus.on('plugin:loaded', () => {});
    typedEventBus.on('ui:theme:changed', () => {});
    
    const events = typedEventBus.getEvents();
    
    expect(events).toHaveLength(2);
    expect(events).toContain('plugin:loaded');
    expect(events).toContain('ui:theme:changed');
  });
  
  test('should check if an event has listeners', () => {
    typedEventBus.on('plugin:loaded', () => {});
    
    expect(typedEventBus.hasListeners('plugin:loaded')).toBe(true);
    expect(typedEventBus.hasListeners('plugin:unloaded')).toBe(false);
  });
  
  test('should get the number of listeners for an event', () => {
    typedEventBus.on('plugin:loaded', () => {});
    typedEventBus.on('plugin:loaded', () => {});
    
    expect(typedEventBus.listenerCount('plugin:loaded')).toBe(2);
    expect(typedEventBus.listenerCount('plugin:unloaded')).toBe(0);
  });
  
  test('should clear all event handlers', () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();
    
    typedEventBus.on('plugin:loaded', handler1);
    typedEventBus.on('ui:theme:changed', handler2);
    typedEventBus.clear();
    
    typedEventBus.emit('plugin:loaded', undefined);
    typedEventBus.emit('ui:theme:changed', 'dark');
    
    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });
});
