import { MCPSchemaValidator, ValidationOptions } from '../../../src/mcp/validation/MCPSchemaValidator';

describe('MCPSchemaValidator', () => {
  let validator: MCPSchemaValidator;
  
  beforeEach(() => {
    validator = new MCPSchemaValidator();
  });
  
  describe('basic validation', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' }
      },
      required: ['name']
    };
    
    it('should validate valid data', () => {
      const data = { name: 'test', age: 30 };
      const result = validator.validate(schema, data);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
    
    it('should fail on invalid data', () => {
      const data = { age: '30' };
      const result = validator.validate(schema, data);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringMatching(/name/)]));
    });
  });
  
  describe('strict mode', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' }
      }
    };
    
    it('should allow additional properties by default', () => {
      const data = { name: 'test', extra: true };
      const result = validator.validate(schema, data);
      
      expect(result.valid).toBe(true);
    });
    
    it('should reject additional properties in strict mode', () => {
      const data = { name: 'test', extra: true };
      const options: ValidationOptions = { strict: true };
      const result = validator.validate(schema, data, options);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringMatching(/additional/)]));
    });
  });
  
  describe('custom formats', () => {
    const schema = {
      type: 'object',
      properties: {
        path: { type: 'string', format: 'path' },
        tag: { type: 'string', format: 'tag' }
      }
    };
    
    it('should validate built-in formats', () => {
      const data = {
        path: 'valid/path',
        tag: '#valid-tag'
      };
      
      const result = validator.validate(schema, data, {
        formats: MCPSchemaValidator.formats
      });
      
      expect(result.valid).toBe(true);
    });
    
    it('should reject invalid formats', () => {
      const data = {
        path: '../invalid/path',
        tag: 'invalid-tag'
      };
      
      const result = validator.validate(schema, data, {
        formats: MCPSchemaValidator.formats
      });
      
      expect(result.valid).toBe(false);
    });
    
    it('should support custom formats', () => {
      const customFormats = {
        email: (value: string) => /^[^@]+@[^@]+\.[^@]+$/.test(value),
        ...MCPSchemaValidator.formats
      };
      
      const emailSchema = {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' }
        }
      };
      
      const validData = { email: 'test@example.com' };
      const invalidData = { email: 'invalid-email' };
      
      expect(validator.validate(emailSchema, validData, { formats: customFormats }).valid).toBe(true);
      expect(validator.validate(emailSchema, invalidData, { formats: customFormats }).valid).toBe(false);
    });
  });
  
  describe('custom rules', () => {
    const schema = {
      type: 'object',
      properties: {
        dateRange: {
          type: 'object',
          properties: {
            startDate: { type: 'string' },
            endDate: { type: 'string' }
          }
        },
        numericRange: {
          type: 'object',
          properties: {
            min: { type: 'number' },
            max: { type: 'number' }
          }
        }
      }
    };
    
    const validateDateRange = (value: any) => {
      const { startDate, endDate } = value;
      if (!startDate || !endDate) return true;
      
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return 'Invalid date format';
      }
      
      if (end < start) {
        return 'End date must be after start date';
      }
      
      return true;
    };
    
    const validateNumericRange = (value: any) => {
      const { min, max } = value;
      if (min === undefined || max === undefined) return true;
      
      if (typeof min !== 'number' || typeof max !== 'number') {
        return 'Range values must be numbers';
      }
      
      if (max < min) {
        return 'Maximum must be greater than minimum';
      }
      
      return true;
    };
    
    it('should validate custom rules', () => {
      const data = {
        dateRange: {
          startDate: '2025-01-01',
          endDate: '2025-12-31'
        },
        numericRange: {
          min: 0,
          max: 100
        }
      };
      
      const customRules = {
        dateRange: validateDateRange,
        numericRange: validateNumericRange
      };
      
      const result = validator.validate(schema, data, { rules: customRules });
      expect(result.valid).toBe(true);
    });
    
    it('should reject invalid rule data', () => {
      const data = {
        dateRange: {
          startDate: '2025-12-31',
          endDate: '2025-01-01'
        }
      };
      
      const customRules = {
        dateRange: validateDateRange
      };
      
      const result = validator.validate(schema, data, { rules: customRules });
      expect(result.valid).toBe(false);
      expect(result.errors?.length).toBeGreaterThan(0);
      expect(result.errors?.[0]).toContain('End date must be after start date');
    });
  });
  
  describe('utility methods', () => {
    it('should create custom rule', () => {
      const rule = MCPSchemaValidator.createRule('test', (value: any) => value > 0);
      expect(typeof rule.test).toBe('function');
    });
    
    it('should create custom format', () => {
      const format = MCPSchemaValidator.createFormat('test', (value: any) => true);
      expect(typeof format.test).toBe('function');
    });
  });
});
