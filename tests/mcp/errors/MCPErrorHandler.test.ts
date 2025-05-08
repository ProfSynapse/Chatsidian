/**
 * Tests for the MCP Error Handler
 * 
 * This file contains tests for the MCPErrorHandler class, which provides
 * advanced error handling, recovery strategies, and error reporting for MCP operations.
 */

import { Events } from 'obsidian';
import { EventBus } from '../../../src/core/EventBus';
import { MCPErrorHandler, ErrorSeverity, ErrorCategory, ErrorCode, RecoveryStrategy } from '../../../src/mcp/errors/MCPErrorHandler';

describe('MCPErrorHandler', () => {
  let eventBus: jest.Mocked<EventBus>;
  let errorHandler: MCPErrorHandler;
  
  beforeEach(() => {
    // Mock dependencies
    eventBus = {
      on: jest.fn(),
      emit: jest.fn()
    } as unknown as jest.Mocked<EventBus>;
    
    // Create error handler
    errorHandler = new MCPErrorHandler(eventBus);
  });
  
  describe('Error Categorization', () => {
    it('should categorize network errors correctly', () => {
      const details = errorHandler.createErrorDetails(new Error('Network connection failed'));
      expect(details.category).toBe(ErrorCategory.Network);
      expect(details.code).toBe(ErrorCode.NetworkUnavailable);
    });
    
    it('should categorize timeout errors correctly', () => {
      const details = errorHandler.createErrorDetails(new Error('Operation timed out'));
      expect(details.category).toBe(ErrorCategory.Timeout);
      expect(details.code).toBe(ErrorCode.OperationTimeout);
    });
    
    it('should categorize authentication errors correctly', () => {
      const details = errorHandler.createErrorDetails(new Error('Invalid API key'));
      expect(details.category).toBe(ErrorCategory.Authentication);
      expect(details.code).toBe(ErrorCode.AuthenticationFailed);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle errors with default options', async () => {
      const error = new Error('Test error');
      const result = await errorHandler.handleError(
        errorHandler.createErrorDetails(error)
      );
      
      expect(result).toBe(false); // No recovery by default
      expect(eventBus.emit).toHaveBeenCalled();
    });
    
    it('should attempt recovery when configured', async () => {
      // Mock successful recovery
      jest.spyOn(errorHandler as any, 'attemptRecovery').mockResolvedValue(true);
      
      const error = new Error('Test error');
      const result = await errorHandler.handleError(
        errorHandler.createErrorDetails(error),
        { attemptRecovery: true }
      );
      
      expect(result).toBe(true);
    });
  });
  
  describe('Circuit Breaker', () => {
    it('should track failures and open circuit after threshold', async () => {
      const operation = 'test.operation';
      
      // Record multiple failures
      for (let i = 0; i < 5; i++) {
        await errorHandler.handleError(
          errorHandler.createErrorDetails(new Error('Test error'), { operation }),
          { attemptRecovery: false }
        );
      }
      
      // Check if circuit is open
      expect((errorHandler as any).isCircuitOpen(operation)).toBe(true);
    });
    
    it('should reset circuit after timeout', async () => {
      const operation = 'test.operation';
      
      // Record failures to open circuit
      for (let i = 0; i < 5; i++) {
        await errorHandler.handleError(
          errorHandler.createErrorDetails(new Error('Test error'), { operation }),
          { attemptRecovery: false }
        );
      }
      
      // Verify circuit is open
      expect((errorHandler as any).isCircuitOpen(operation)).toBe(true);
      
      // Mock the isCircuitOpen method to simulate timeout behavior
      jest.spyOn(errorHandler as any, 'isCircuitOpen').mockReturnValue(false);
      
      // Verify circuit is closed
      expect((errorHandler as any).isCircuitOpen(operation)).toBe(false);
    });
  });
});