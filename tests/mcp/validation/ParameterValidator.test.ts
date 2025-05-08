/**
 * Tests for the ParameterValidator
 */

import { ParameterValidator } from '../../../src/mcp/validation/ParameterValidator';

describe('ParameterValidator', () => {
  let validator: ParameterValidator;
  
  beforeEach(() => {
    // Create validator
    validator = new ParameterValidator();
  });
  
  test('should create a validator', () => {
    expect(validator).toBeDefined();
  });
  
  test('should add and validate schema', () => {
    // Add schema
    validator.addSchema('test.tool', {
      type: 'object',
      properties: {
        foo: { type: 'string' },
        bar: { type: 'number' }
      },
      required: ['foo']
    });
    
    // Validate valid parameters
    const validResult = validator.validate('test.tool', { foo: 'bar', bar: 42 });
    
    // Check valid result
    expect(validResult.valid).toBe(true);
    expect(validResult.params).toEqual({ foo: 'bar', bar: 42 });
    
    // Validate invalid parameters (missing required)
    const invalidResult = validator.validate('test.tool', { bar: 42 });
    
    // Check invalid result
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors).toBeDefined();
    expect(invalidResult.errors?.length).toBeGreaterThan(0);
  });
  
  test('should validate with default schema', () => {
    // Validate without schema
    const result = validator.validate('test.tool', { foo: 'bar' });
    
    // Check result
    expect(result.valid).toBe(true);
    expect(result.params).toEqual({ foo: 'bar' });
  });
  
  test('should remove schema', () => {
    // Add schema
    validator.addSchema('test.tool', {
      type: 'object',
      properties: {
        foo: { type: 'string' }
      },
      required: ['foo']
    });
    
    // Remove schema
    validator.removeSchema('test.tool');
    
    // Validate with removed schema
    const result = validator.validate('test.tool', { bar: 42 });
    
    // Check result (should pass with default schema)
    expect(result.valid).toBe(true);
  });
  
  test('should validate with additional properties', () => {
    // Add schema
    validator.addSchema('test.tool', {
      type: 'object',
      properties: {
        foo: { type: 'string' }
      },
      required: ['foo'],
      additionalProperties: false
    });
    
    // Validate with additional properties
    const result = validator.validate('test.tool', { foo: 'bar', baz: 'qux' });
    
    // Check result
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBeGreaterThan(0);
  });
  
  test('should validate with nested objects', () => {
    // Add schema
    validator.addSchema('test.tool', {
      type: 'object',
      properties: {
        foo: { 
          type: 'object',
          properties: {
            bar: { type: 'string' }
          },
          required: ['bar']
        }
      },
      required: ['foo']
    });
    
    // Validate valid parameters
    const validResult = validator.validate('test.tool', { foo: { bar: 'baz' } });
    
    // Check valid result
    expect(validResult.valid).toBe(true);
    
    // Validate invalid parameters (missing nested required)
    const invalidResult = validator.validate('test.tool', { foo: {} });
    
    // Check invalid result
    expect(invalidResult.valid).toBe(false);
  });
  
  test('should validate with arrays', () => {
    // Add schema
    validator.addSchema('test.tool', {
      type: 'object',
      properties: {
        foo: { 
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['foo']
    });
    
    // Validate valid parameters
    const validResult = validator.validate('test.tool', { foo: ['bar', 'baz'] });
    
    // Check valid result
    expect(validResult.valid).toBe(true);
    
    // Validate invalid parameters (wrong type in array)
    const invalidResult = validator.validate('test.tool', { foo: ['bar', 42] });
    
    // Check invalid result
    expect(invalidResult.valid).toBe(false);
  });
  
  test('should validate with enums', () => {
    // Add schema
    validator.addSchema('test.tool', {
      type: 'object',
      properties: {
        foo: { 
          type: 'string',
          enum: ['bar', 'baz', 'qux']
        }
      },
      required: ['foo']
    });
    
    // Validate valid parameters
    const validResult = validator.validate('test.tool', { foo: 'bar' });
    
    // Check valid result
    expect(validResult.valid).toBe(true);
    
    // Validate invalid parameters (not in enum)
    const invalidResult = validator.validate('test.tool', { foo: 'quux' });
    
    // Check invalid result
    expect(invalidResult.valid).toBe(false);
  });
  
  test('should validate with pattern', () => {
    // Add schema
    validator.addSchema('test.tool', {
      type: 'object',
      properties: {
        foo: { 
          type: 'string',
          pattern: '^[a-z]+$'
        }
      },
      required: ['foo']
    });
    
    // Validate valid parameters
    const validResult = validator.validate('test.tool', { foo: 'bar' });
    
    // Check valid result
    expect(validResult.valid).toBe(true);
    
    // Validate invalid parameters (doesn't match pattern)
    const invalidResult = validator.validate('test.tool', { foo: 'Bar1' });
    
    // Check invalid result
    expect(invalidResult.valid).toBe(false);
  });
});
