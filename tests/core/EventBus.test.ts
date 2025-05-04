import { EventBus } from '../../src/core/EventBus';

describe('EventBus', () => {
  let eventBus: EventBus;
  
  beforeEach(() => {
    eventBus = new EventBus();
  });
  
  test('should register and trigger event handlers', () => {
    const handler = jest.fn();
    
    eventBus.on('test', handler);
    eventBus.emit('test', { data: 'test' });
    
    expect(handler).toHaveBeenCalledWith({ data: 'test' });
  });
  
  test('should unregister event handlers', () => {
    const handler = jest.fn();
    
    eventBus.on('test', handler);
    eventBus.off('test', handler);
    eventBus.emit('test', { data: 'test' });
    
    expect(handler).not.toHaveBeenCalled();
  });
  
  test('should handle multiple handlers for the same event', () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();
    
    eventBus.on('test', handler1);
    eventBus.on('test', handler2);
    eventBus.emit('test', { data: 'test' });
    
    expect(handler1).toHaveBeenCalledWith({ data: 'test' });
    expect(handler2).toHaveBeenCalledWith({ data: 'test' });
  });
  
  test('should handle errors in event handlers', () => {
    const errorHandler = jest.fn().mockImplementation(() => {
      throw new Error('Test error');
    });
    const handler = jest.fn();
    
    // Mock console.error to track calls
    const originalConsoleError = console.error;
    const mockConsoleError = jest.fn();
    console.error = mockConsoleError;
    
    try {
      eventBus.on('test', errorHandler);
      eventBus.on('test', handler);
      eventBus.emit('test', { data: 'test' });
      
      // First handler threw an error but second was still called
      expect(errorHandler).toHaveBeenCalledWith({ data: 'test' });
      expect(handler).toHaveBeenCalledWith({ data: 'test' });
      expect(mockConsoleError).toHaveBeenCalled();
    } finally {
      // Restore console.error
      console.error = originalConsoleError;
    }
  });
  
  test('should handle async event handlers', async () => {
    const asyncHandler = jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return 'done';
    });
    
    eventBus.on('test', asyncHandler);
    eventBus.emit('test', { data: 'test' });
    
    // Handler was called but we didn't wait for it
    expect(asyncHandler).toHaveBeenCalledWith({ data: 'test' });
  });
  
  test('should wait for async event handlers with emitAsync', async () => {
    const results: string[] = [];
    
    const asyncHandler1 = jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      results.push('handler1');
    });
    
    const asyncHandler2 = jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
      results.push('handler2');
    });
    
    eventBus.on('test', asyncHandler1);
    eventBus.on('test', asyncHandler2);
    
    await eventBus.emitAsync('test', { data: 'test' });
    
    // Both handlers were called and completed
    expect(asyncHandler1).toHaveBeenCalledWith({ data: 'test' });
    expect(asyncHandler2).toHaveBeenCalledWith({ data: 'test' });
    expect(results).toContain('handler1');
    expect(results).toContain('handler2');
  });
  
  test('should handle errors in async event handlers', async () => {
    const asyncErrorHandler = jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
      throw new Error('Async test error');
    });
    
    const asyncHandler = jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
      return 'done';
    });
    
    // Mock console.error to track calls
    const originalConsoleError = console.error;
    const mockConsoleError = jest.fn();
    console.error = mockConsoleError;
    
    try {
      eventBus.on('test', asyncErrorHandler);
      eventBus.on('test', asyncHandler);
      
      await eventBus.emitAsync('test', { data: 'test' });
      
      // Both handlers were called
      expect(asyncErrorHandler).toHaveBeenCalledWith({ data: 'test' });
      expect(asyncHandler).toHaveBeenCalledWith({ data: 'test' });
      expect(mockConsoleError).toHaveBeenCalled();
    } finally {
      // Restore console.error
      console.error = originalConsoleError;
    }
  });
  
  test('should clear all event handlers', () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();
    
    eventBus.on('test1', handler1);
    eventBus.on('test2', handler2);
    eventBus.clear();
    
    eventBus.emit('test1');
    eventBus.emit('test2');
    
    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });
  
  test('should get a list of events with listeners', () => {
    eventBus.on('test1', () => {});
    eventBus.on('test2', () => {});
    
    const events = eventBus.getEvents();
    
    expect(events).toHaveLength(2);
    expect(events).toContain('test1');
    expect(events).toContain('test2');
  });
  
  test('should check if an event has listeners', () => {
    eventBus.on('test', () => {});
    
    expect(eventBus.hasListeners('test')).toBe(true);
    expect(eventBus.hasListeners('other')).toBe(false);
  });
  
  test('should get the number of listeners for an event', () => {
    eventBus.on('test', () => {});
    eventBus.on('test', () => {});
    
    expect(eventBus.listenerCount('test')).toBe(2);
    expect(eventBus.listenerCount('other')).toBe(0);
  });
});
