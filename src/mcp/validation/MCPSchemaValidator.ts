import { ValidationResult } from '../interfaces';
import { ParameterValidator } from './ParameterValidator';

/**
 * Enhanced schema validation options
 */
export interface ValidationOptions {
  /**
   * Whether to allow additional properties not in schema
   */
  strict?: boolean;
  
  /**
   * Custom formats to validate
   */
  formats?: Record<string, (value: any) => boolean>;
  
  /**
   * Additional validation rules
   */
  rules?: Record<string, (value: any) => boolean | string>;
  
  /**
   * Context data for validation
   */
  context?: Record<string, any>;
}

/**
 * Enhanced schema validator for MCP
 */
export class MCPSchemaValidator {
  private validator: ParameterValidator;
  
  constructor() {
    this.validator = new ParameterValidator();
  }
  
  /**
   * Validate data against schema with enhanced options
   * @param schema - JSON schema
   * @param data - Data to validate
   * @param options - Validation options
   * @returns Validation result
   */
  public validate(
    schema: any,
    data: any,
    options: ValidationOptions = {}
  ): ValidationResult {
    // Apply schema enhancements based on options
    const enhancedSchema = this.enhanceSchema(schema, options);
    
    // Apply custom formats if provided
    if (options.formats) {
      // Temporarily add formats to the validator
      for (const [formatName, formatFunc] of Object.entries(options.formats)) {
        this.validator.addFormat(formatName, formatFunc);
      }
    }
    
    // Run base validation
    const result = this.validator.validateWithSchema(enhancedSchema, data);
    
    // Remove temporary formats to avoid affecting future validations
    if (options.formats) {
      for (const formatName of Object.keys(options.formats)) {
        this.validator.removeFormat(formatName);
      }
    }
    
    // Run additional validations if base validation passed
    if (result.valid && options.rules) {
      const ruleErrors = this.validateRules(data, options.rules, options.context);
      if (ruleErrors.length > 0) {
        return {
          valid: false,
          errors: ruleErrors
        };
      }
    }
    
    return result;
  }
  
  /**
   * Enhance schema based on options
   * @param schema - Original schema
   * @param options - Validation options
   * @returns Enhanced schema
   */
  private enhanceSchema(schema: any, options: ValidationOptions): any {
    const enhanced = { ...schema };
    
    // Apply strict mode if specified
    if (options.strict) {
      enhanced.additionalProperties = false;
    }
    
    return enhanced;
  }
  
  /**
   * Validate data against custom rules
   * @param data - Data to validate
   * @param rules - Validation rules
   * @param context - Validation context
   * @returns Array of error messages
   */
  private validateRules(
    data: any,
    rules: Record<string, (value: any) => boolean | string>,
    context?: Record<string, any>
  ): string[] {
    const errors: string[] = [];
    
    // Apply each rule
    for (const [ruleName, ruleFunc] of Object.entries(rules)) {
      try {
        // Extract the property value from data if it exists
        const propertyValue = data[ruleName];
        
        // Skip validation if property doesn't exist
        if (propertyValue === undefined) {
          continue;
        }
        
        // Apply rule to the property value
        const result = ruleFunc.call(null, propertyValue, context);
        
        if (typeof result === 'string') {
          errors.push(result);
        } else if (result === false) {
          errors.push(`Failed validation rule: ${ruleName}`);
        }
      } catch (error) {
        errors.push(`Error in validation rule ${ruleName}: ${error.message}`);
      }
    }
    
    return errors;
  }
  
  /**
   * Create validation rule
   * @param name - Rule name
   * @param validator - Validation function
   * @returns Validation rule
   */
  public static createRule(
    name: string,
    validator: (value: any, context?: any) => boolean | string
  ): Record<string, (value: any) => boolean | string> {
    return {
      [name]: validator
    };
  }
  
  /**
   * Create custom format
   * @param name - Format name
   * @param validator - Format validation function
   * @returns Format validator
   */
  public static createFormat(
    name: string,
    validator: (value: any) => boolean
  ): Record<string, (value: any) => boolean> {
    return {
      [name]: validator
    };
  }
  
  /**
   * Common validation rules
   */
  public static rules = {
    /**
     * Validate date range
     */
    dateRange: (value: any, context: any) => {
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
    },
    
    /**
     * Validate numeric range
     */
    numericRange: (value: any, context: any) => {
      const { min, max } = value;
      if (min === undefined || max === undefined) return true;
      
      if (typeof min !== 'number' || typeof max !== 'number') {
        return 'Range values must be numbers';
      }
      
      if (max < min) {
        return 'Maximum must be greater than minimum';
      }
      
      return true;
    }
  };
  
  /**
   * Common formats
   */
  public static formats = {
    /**
     * Validate path format
     */
    path: (value: string) => {
      if (typeof value !== 'string') return false;
      return !value.includes('..') && !value.includes('\\');
    },
    
    /**
     * Validate tag format
     */
    tag: (value: string) => {
      if (typeof value !== 'string') return false;
      return /^#[a-zA-Z0-9_/-]+$/.test(value);
    },
    
    /**
     * Validate frontmatter format
     */
    frontmatter: (value: any) => {
      if (typeof value !== 'object' || value === null) return false;
      return Object.keys(value).every(key => 
        typeof key === 'string' && 
        !key.includes(':') &&
        value[key] !== undefined
      );
    }
  };
}
