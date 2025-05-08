/**
 * Tests for the SchemaBuilder
 * 
 * This file contains tests for the SchemaBuilder utility, which provides
 * a fluent interface for creating JSON Schema definitions for tool parameters.
 */

import { SchemaBuilder } from '../../src/mcp/SchemaBuilder';

describe('SchemaBuilder', () => {
  describe('Creation Methods', () => {
    it('should create a new SchemaBuilder with default settings', () => {
      // Create builder
      const builder = SchemaBuilder.create();
      
      // Build schema
      const schema = builder.build();
      
      // Verify schema
      expect(schema).toEqual({
        type: 'object',
        properties: {}
      });
    });
    
    it('should create a file schema', () => {
      // Create file schema
      const builder = SchemaBuilder.createFileSchema('File operation test');
      
      // Build schema
      const schema = builder.build();
      
      // Verify schema
      expect(schema.type).toBe('object');
      expect(schema.description).toBe('File operation test');
      expect(schema.properties).toHaveProperty('path');
      expect(schema.properties.path.type).toBe('string');
      expect(schema.properties.path.minLength).toBe(1);
      expect(schema.required).toContain('path');
    });
    
    it('should create a folder schema', () => {
      // Create folder schema
      const builder = SchemaBuilder.createFolderSchema('Folder operation test');
      
      // Build schema
      const schema = builder.build();
      
      // Verify schema
      expect(schema.type).toBe('object');
      expect(schema.description).toBe('Folder operation test');
      expect(schema.properties).toHaveProperty('path');
      expect(schema.properties.path.type).toBe('string');
      expect(schema.properties.path.minLength).toBe(1);
      expect(schema.required).toContain('path');
    });
    
    it('should create a search schema', () => {
      // Create search schema
      const builder = SchemaBuilder.createSearchSchema('Search operation test');
      
      // Build schema
      const schema = builder.build();
      
      // Verify schema
      expect(schema.type).toBe('object');
      expect(schema.description).toBe('Search operation test');
      expect(schema.properties).toHaveProperty('query');
      expect(schema.properties.query.type).toBe('string');
      expect(schema.properties.query.minLength).toBe(1);
      expect(schema.required).toContain('query');
    });
  });
  
  describe('Schema Properties', () => {
    it('should set description', () => {
      // Create builder
      const builder = SchemaBuilder.create();
      
      // Set description
      builder.setDescription('Test description');
      
      // Build schema
      const schema = builder.build();
      
      // Verify schema
      expect(schema.description).toBe('Test description');
    });
    
    it('should set title', () => {
      // Create builder
      const builder = SchemaBuilder.create();
      
      // Set title
      builder.setTitle('Test Title');
      
      // Build schema
      const schema = builder.build();
      
      // Verify schema
      expect(schema.title).toBe('Test Title');
    });
  });
  
  describe('Property Types', () => {
    it('should add string property', () => {
      // Create builder
      const builder = SchemaBuilder.create();
      
      // Add string property
      builder.addString('name', 'User name', true, {
        minLength: 3,
        maxLength: 50,
        pattern: '^[a-zA-Z0-9_]+$',
        default: 'user',
        examples: ['john_doe', 'jane_smith']
      });
      
      // Build schema
      const schema = builder.build();
      
      // Verify schema
      expect(schema.properties).toHaveProperty('name');
      expect(schema.properties.name.type).toBe('string');
      expect(schema.properties.name.description).toBe('User name');
      expect(schema.properties.name.minLength).toBe(3);
      expect(schema.properties.name.maxLength).toBe(50);
      expect(schema.properties.name.pattern).toBe('^[a-zA-Z0-9_]+$');
      expect(schema.properties.name.default).toBe('user');
      expect(schema.properties.name.examples).toEqual(['john_doe', 'jane_smith']);
      expect(schema.required).toContain('name');
    });
    
    it('should add number property', () => {
      // Create builder
      const builder = SchemaBuilder.create();
      
      // Add number property
      builder.addNumber('age', 'User age', true, {
        minimum: 18,
        maximum: 120,
        multipleOf: 1,
        default: 30,
        examples: [25, 40, 55]
      });
      
      // Build schema
      const schema = builder.build();
      
      // Verify schema
      expect(schema.properties).toHaveProperty('age');
      expect(schema.properties.age.type).toBe('number');
      expect(schema.properties.age.description).toBe('User age');
      expect(schema.properties.age.minimum).toBe(18);
      expect(schema.properties.age.maximum).toBe(120);
      expect(schema.properties.age.multipleOf).toBe(1);
      expect(schema.properties.age.default).toBe(30);
      expect(schema.properties.age.examples).toEqual([25, 40, 55]);
      expect(schema.required).toContain('age');
    });
    
    it('should add boolean property', () => {
      // Create builder
      const builder = SchemaBuilder.create();
      
      // Add boolean property
      builder.addBoolean('active', 'Is user active', true, true);
      
      // Build schema
      const schema = builder.build();
      
      // Verify schema
      expect(schema.properties).toHaveProperty('active');
      expect(schema.properties.active.type).toBe('boolean');
      expect(schema.properties.active.description).toBe('Is user active');
      expect(schema.properties.active.default).toBe(true);
      expect(schema.required).toContain('active');
    });
    
    it('should add array property', () => {
      // Create builder
      const builder = SchemaBuilder.create();
      
      // Add array property
      builder.addArray('tags', 'User tags', { type: 'string' }, true, {
        minItems: 1,
        maxItems: 10,
        uniqueItems: true,
        default: ['user'],
        examples: [['admin', 'moderator'], ['guest']]
      });
      
      // Build schema
      const schema = builder.build();
      
      // Verify schema
      expect(schema.properties).toHaveProperty('tags');
      expect(schema.properties.tags.type).toBe('array');
      expect(schema.properties.tags.description).toBe('User tags');
      expect(schema.properties.tags.items).toEqual({ type: 'string' });
      expect(schema.properties.tags.minItems).toBe(1);
      expect(schema.properties.tags.maxItems).toBe(10);
      expect(schema.properties.tags.uniqueItems).toBe(true);
      expect(schema.properties.tags.default).toEqual(['user']);
      expect(schema.properties.tags.examples).toEqual([['admin', 'moderator'], ['guest']]);
      expect(schema.required).toContain('tags');
    });
    
    it('should add object property', () => {
      // Create builder
      const builder = SchemaBuilder.create();
      
      // Add object property
      builder.addObject('address', 'User address', {
        street: { type: 'string' },
        city: { type: 'string' },
        zipCode: { type: 'string' }
      }, true, ['street', 'city']);
      
      // Build schema
      const schema = builder.build();
      
      // Verify schema
      expect(schema.properties).toHaveProperty('address');
      expect(schema.properties.address.type).toBe('object');
      expect(schema.properties.address.description).toBe('User address');
      expect(schema.properties.address.properties).toEqual({
        street: { type: 'string' },
        city: { type: 'string' },
        zipCode: { type: 'string' }
      });
      expect(schema.properties.address.required).toEqual(['street', 'city']);
      expect(schema.required).toContain('address');
    });
    
    it('should add enum property', () => {
      // Create builder
      const builder = SchemaBuilder.create();
      
      // Add enum property
      builder.addEnum('role', 'User role', ['admin', 'moderator', 'user'], true, 'user');
      
      // Build schema
      const schema = builder.build();
      
      // Verify schema
      expect(schema.properties).toHaveProperty('role');
      expect(schema.properties.role.enum).toEqual(['admin', 'moderator', 'user']);
      expect(schema.properties.role.description).toBe('User role');
      expect(schema.properties.role.default).toBe('user');
      expect(schema.required).toContain('role');
    });
  });
  
  describe('Builder Operations', () => {
    it('should chain methods', () => {
      // Create builder with chained methods
      const schema = SchemaBuilder.create()
        .setTitle('User Schema')
        .setDescription('Schema for user data')
        .addString('name', 'User name', true)
        .addNumber('age', 'User age', false)
        .build();
      
      // Verify schema
      expect(schema.title).toBe('User Schema');
      expect(schema.description).toBe('Schema for user data');
      expect(schema.properties).toHaveProperty('name');
      expect(schema.properties).toHaveProperty('age');
      expect(schema.required).toContain('name');
      expect(schema.required).not.toContain('age');
    });
    
    it('should reset builder', () => {
      // Create builder
      const builder = SchemaBuilder.create()
        .setTitle('User Schema')
        .addString('name', 'User name', true);
      
      // Reset builder
      builder.reset();
      
      // Build schema
      const schema = builder.build();
      
      // Verify schema
      expect(schema.title).toBeUndefined();
      expect(schema.properties).toEqual({});
      expect(schema.required).toBeUndefined();
    });
    
    it('should clone builder', () => {
      // Create builder
      const builder = SchemaBuilder.create()
        .setTitle('User Schema')
        .addString('name', 'User name', true);
      
      // Clone builder
      const clone = builder.clone();
      
      // Modify clone
      clone.addNumber('age', 'User age', true);
      
      // Build schemas
      const originalSchema = builder.build();
      const clonedSchema = clone.build();
      
      // Verify original schema
      expect(originalSchema.properties).toHaveProperty('name');
      expect(originalSchema.properties).not.toHaveProperty('age');
      
      // Verify cloned schema
      expect(clonedSchema.properties).toHaveProperty('name');
      expect(clonedSchema.properties).toHaveProperty('age');
    });
    
    it('should remove required array if empty', () => {
      // Create builder
      const builder = SchemaBuilder.create()
        .addString('name', 'User name', false)
        .addNumber('age', 'User age', false);
      
      // Build schema
      const schema = builder.build();
      
      // Verify schema
      expect(schema.required).toBeUndefined();
    });
  });
  
  describe('Complex Schemas', () => {
    it('should build a complex schema', () => {
      // Create builder
      const builder = SchemaBuilder.create()
        .setTitle('User Schema')
        .setDescription('Schema for user data')
        .addString('name', 'User name', true, { minLength: 3 })
        .addNumber('age', 'User age', true, { minimum: 18 })
        .addBoolean('active', 'Is user active', false, true)
        .addObject('address', 'User address', {
          street: { type: 'string' },
          city: { type: 'string' },
          zipCode: { type: 'string' }
        }, false, ['street', 'city'])
        .addArray('tags', 'User tags', { type: 'string' }, false, { uniqueItems: true })
        .addEnum('role', 'User role', ['admin', 'moderator', 'user'], true, 'user');
      
      // Build schema
      const schema = builder.build();
      
      // Verify schema structure
      expect(schema.title).toBe('User Schema');
      expect(schema.description).toBe('Schema for user data');
      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('name');
      expect(schema.properties).toHaveProperty('age');
      expect(schema.properties).toHaveProperty('active');
      expect(schema.properties).toHaveProperty('address');
      expect(schema.properties).toHaveProperty('tags');
      expect(schema.properties).toHaveProperty('role');
      expect(schema.required).toContain('name');
      expect(schema.required).toContain('age');
      expect(schema.required).toContain('role');
      expect(schema.required).not.toContain('active');
      expect(schema.required).not.toContain('address');
      expect(schema.required).not.toContain('tags');
    });
  });
});