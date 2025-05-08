/**
 * Parameter Validator
 * 
 * This file provides utilities for validating tool parameters
 * against JSON Schema definitions.
 */

import { ValidationResult } from '../interfaces';
import { deepClone } from '../utils/ExecutionUtils';
import Ajv from 'ajv';

/**
 * Parameter validator for tool parameters
 */
export class ParameterValidator {
  public validator: any; // Will be Ajv instance
  private schemas: Map<string, any> = new Map();
  
  /**
   * Create a new parameter validator
   */
  constructor() {
    // Initialize JSON schema validator
    this.validator = new Ajv({
      allErrors: true,
      coerceTypes: false, // Don't coerce types to avoid issues with array validation
      useDefaults: true,
      strict: false
    });
  }
  
  /**
   * Add a schema to the validator
   * @param key - Schema key
   * @param schema - JSON Schema
   */
  public addSchema(key: string, schema: any): void {
    try {
      // Store schema
      this.schemas.set(key, schema);
      
      // Compile schema to validate it
      this.validator.compile(schema);
      
      // Add to validator
      this.validator.addSchema(schema, key);
    } catch (error) {
      console.warn(`Invalid schema for ${key}:`, error);
      throw new Error(`Invalid schema: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Remove a schema from the validator
   * @param key - Schema key
   */
  public removeSchema(key: string): void {
    try {
      // Remove from validator
      this.validator.removeSchema(key);
      
      // Remove from storage
      this.schemas.delete(key);
    } catch (error) {
      console.warn(`Error removing schema for ${key}:`, error);
    }
  }
  
  /**
   * Get a schema by key
   * @param key - Schema key
   * @returns Schema or undefined
   */
  public getSchema(key: string): any {
    return this.schemas.get(key);
  }
  
  /**
   * Validate parameters against a schema
   * @param key - Schema key
   * @param params - Parameters to validate
   * @returns Validation result
   */
  public validate(key: string, params: any): ValidationResult {
    // Get schema
    const schema = this.schemas.get(key);
    
    // Skip validation if no schema
    if (!schema) {
      return { 
        valid: true,
        params
      };
    }
    
    // Get or compile validate function
    let validate = this.validator.getSchema(key);
    
    if (!validate) {
      try {
        validate = this.validator.compile(schema);
        
        // Cache the compiled schema
        this.validator.addSchema(schema, key);
      } catch (error) {
        return {
          valid: false,
          errors: [`Invalid schema: ${error instanceof Error ? error.message : String(error)}`]
        };
      }
    }
    
    // Create a deep copy of params to avoid modifying the original
    const paramsCopy = deepClone(params);
    
    // Validate parameters
    const valid = validate(paramsCopy);
    
    if (!valid) {
      const errors = validate.errors ? validate.errors.map((err: any) => 
        `${err.instancePath || ''} ${err.message || 'invalid'}`
      ) : ['Validation failed'];
      
      return {
        valid: false,
        errors
      };
    }
    
    // Return validated and potentially transformed params
    return { 
      valid: true,
      params: paramsCopy
    };
  }
  
  /**
   * Validate parameters against a schema directly
   * @param schema - JSON Schema
   * @param params - Parameters to validate
   * @returns Validation result
   */
  public validateWithSchema(schema: any, params: any): ValidationResult {
    // Skip validation if no schema
    if (!schema) {
      return { 
        valid: true,
        params
      };
    }
    
    try {
      // Compile schema
      const validate = this.validator.compile(schema);
      
      // Create a deep copy of params to avoid modifying the original
      const paramsCopy = deepClone(params);
      
      // Validate parameters
      const valid = validate(paramsCopy);
      
      if (!valid) {
        const errors = validate.errors ? validate.errors.map((err: any) => 
          `${err.instancePath || ''} ${err.message || 'invalid'}`
        ) : ['Validation failed'];
        
        return {
          valid: false,
          errors
        };
      }
      
      // Return validated and potentially transformed params
      return { 
        valid: true,
        params: paramsCopy
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Invalid schema: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }
  
  /**
   * Add a custom format to the validator
   * @param name - Format name
   * @param formatFunc - Format validation function
   */
  public addFormat(name: string, formatFunc: (value: any) => boolean): void {
    try {
      this.validator.addFormat(name, formatFunc);
    } catch (error: any) {
      console.warn(`Error adding format ${name}:`, error);
    }
  }
  
  /**
   * Remove a custom format from the validator
   * @param name - Format name
   */
  public removeFormat(name: string): void {
    // Ajv doesn't have a direct method to remove formats
    // We'll just ignore the format in future validations
    try {
      // Create a no-op format function that always returns true
      this.validator.addFormat(name, () => true);
    } catch (error: any) {
      console.warn(`Error handling format ${name}:`, error);
    }
  }
}

/**
 * Create a new parameter validator
 * @returns Parameter validator
 */
export function createParameterValidator(): ParameterValidator {
  return new ParameterValidator();
}
