/**
 * Schema Builder Utility
 * 
 * This file provides a fluent interface for creating JSON Schema definitions
 * for tool parameters in Chatsidian.
 */

/**
 * Utility for building JSON Schema definitions
 */
export class SchemaBuilder {
  private schema: any = {
    type: 'object',
    properties: {},
    required: []
  };
  
  /**
   * Create a new SchemaBuilder with default settings
   * @returns A new SchemaBuilder instance
   */
  public static create(): SchemaBuilder {
    return new SchemaBuilder();
  }
  
  /**
   * Create a schema for a file operation
   * @param description - Schema description
   * @returns A new SchemaBuilder instance with file path field
   */
  public static createFileSchema(description: string = 'File operation'): SchemaBuilder {
    return new SchemaBuilder()
      .setDescription(description)
      .addString('path', 'Path to the file', true, {
        minLength: 1
      });
  }
  
  /**
   * Create a schema for a folder operation
   * @param description - Schema description
   * @returns A new SchemaBuilder instance with folder path field
   */
  public static createFolderSchema(description: string = 'Folder operation'): SchemaBuilder {
    return new SchemaBuilder()
      .setDescription(description)
      .addString('path', 'Path to the folder', true, {
        minLength: 1
      });
  }
  
  /**
   * Create a schema for a search operation
   * @param description - Schema description
   * @returns A new SchemaBuilder instance with search query field
   */
  public static createSearchSchema(description: string = 'Search operation'): SchemaBuilder {
    return new SchemaBuilder()
      .setDescription(description)
      .addString('query', 'Search query', true, {
        minLength: 1
      });
  }
  
  /**
   * Set the schema description
   * @param description - Schema description
   * @returns The builder instance for chaining
   */
  public setDescription(description: string): SchemaBuilder {
    this.schema.description = description;
    return this;
  }
  
  /**
   * Set schema title
   * @param title - Schema title
   * @returns The builder instance for chaining
   */
  public setTitle(title: string): SchemaBuilder {
    this.schema.title = title;
    return this;
  }
  
  /**
   * Add a string property
   * @param name - Property name
   * @param description - Property description
   * @param required - Whether the property is required
   * @param options - Additional options
   * @returns The builder instance for chaining
   */
  public addString(
    name: string, 
    description: string, 
    required: boolean = false,
    options: {
      minLength?: number;
      maxLength?: number;
      pattern?: string;
      enum?: string[];
      format?: string;
      default?: string;
      examples?: string[];
    } = {}
  ): SchemaBuilder {
    // Add property
    this.schema.properties[name] = {
      type: 'string',
      description
    };
    
    // Add options using Object.assign for cleaner code
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        this.schema.properties[name][key] = value;
      }
    });
    
    // Add to required if needed
    if (required) {
      this.schema.required = this.schema.required || [];
      this.schema.required.push(name);
    }
    
    return this;
  }
  
  /**
   * Add a number property
   * @param name - Property name
   * @param description - Property description
   * @param required - Whether the property is required
   * @param options - Additional options
   * @returns The builder instance for chaining
   */
  public addNumber(
    name: string, 
    description: string, 
    required: boolean = false,
    options: {
      minimum?: number;
      maximum?: number;
      multipleOf?: number;
      exclusiveMinimum?: number;
      exclusiveMaximum?: number;
      default?: number;
      examples?: number[];
    } = {}
  ): SchemaBuilder {
    // Add property
    this.schema.properties[name] = {
      type: 'number',
      description
    };
    
    // Add options using Object.assign for cleaner code
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        this.schema.properties[name][key] = value;
      }
    });
    
    // Add to required if needed
    if (required) {
      this.schema.required = this.schema.required || [];
      this.schema.required.push(name);
    }
    
    return this;
  }
  
  /**
   * Add a boolean property
   * @param name - Property name
   * @param description - Property description
   * @param required - Whether the property is required
   * @param defaultValue - Default value if not specified
   * @returns The builder instance for chaining
   */
  public addBoolean(
    name: string, 
    description: string, 
    required: boolean = false,
    defaultValue?: boolean
  ): SchemaBuilder {
    // Add property
    this.schema.properties[name] = {
      type: 'boolean',
      description
    };
    
    // Add default value if specified
    if (defaultValue !== undefined) {
      this.schema.properties[name].default = defaultValue;
    }
    
    // Add to required if needed
    if (required) {
      this.schema.required = this.schema.required || [];
      this.schema.required.push(name);
    }
    
    return this;
  }
  
  /**
   * Add an array property
   * @param name - Property name
   * @param description - Property description
   * @param itemType - Type of items in the array
   * @param required - Whether the property is required
   * @param options - Additional options
   * @returns The builder instance for chaining
   */
  public addArray(
    name: string, 
    description: string, 
    itemType: any,
    required: boolean = false,
    options: {
      minItems?: number;
      maxItems?: number;
      uniqueItems?: boolean;
      default?: any[];
      examples?: any[][];
    } = {}
  ): SchemaBuilder {
    // Add property
    this.schema.properties[name] = {
      type: 'array',
      description,
      items: itemType
    };
    
    // Add options using Object.assign for cleaner code
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        this.schema.properties[name][key] = value;
      }
    });
    
    // Add to required if needed
    if (required) {
      this.schema.required = this.schema.required || [];
      this.schema.required.push(name);
    }
    
    return this;
  }
  
  /**
   * Add an object property
   * @param name - Property name
   * @param description - Property description
   * @param properties - Object properties
   * @param required - Whether the property is required
   * @param requiredProperties - Array of required property names
   * @returns The builder instance for chaining
   */
  public addObject(
    name: string, 
    description: string, 
    properties: any,
    required: boolean = false,
    requiredProperties: string[] = []
  ): SchemaBuilder {
    // Add property
    this.schema.properties[name] = {
      type: 'object',
      description,
      properties
    };
    
    // Add required properties if specified
    if (requiredProperties.length > 0) {
      this.schema.properties[name].required = requiredProperties;
    }
    
    // Add to required if needed
    if (required) {
      this.schema.required = this.schema.required || [];
      this.schema.required.push(name);
    }
    
    return this;
  }
  
  /**
   * Add an enum property
   * @param name - Property name
   * @param description - Property description
   * @param values - Enum values
   * @param required - Whether the property is required
   * @param defaultValue - Default value if not specified
   * @returns The builder instance for chaining
   */
  public addEnum<T>(
    name: string,
    description: string,
    values: T[],
    required: boolean = false,
    defaultValue?: T
  ): SchemaBuilder {
    // Add property
    this.schema.properties[name] = {
      enum: values,
      description
    };
    
    // Add default value if specified
    if (defaultValue !== undefined) {
      this.schema.properties[name].default = defaultValue;
    }
    
    // Add to required if needed
    if (required) {
      this.schema.required = this.schema.required || [];
      this.schema.required.push(name);
    }
    
    return this;
  }
  
  /**
   * Build the schema
   * @returns The complete JSON Schema
   */
  public build(): any {
    // Deep clone to avoid modifying the internal schema
    const result = JSON.parse(JSON.stringify(this.schema));
    
    // If no required properties, remove the required array
    if (!result.required || result.required.length === 0) {
      delete result.required;
    }
    
    return result;
  }
  
  /**
   * Reset the builder
   * @returns The builder instance for chaining
   */
  public reset(): SchemaBuilder {
    this.schema = {
      type: 'object',
      properties: {},
      required: []
    };
    
    return this;
  }
  
  /**
   * Create a copy of the current builder
   * @returns A new SchemaBuilder with the same schema
   */
  public clone(): SchemaBuilder {
    const clone = new SchemaBuilder();
    clone.schema = JSON.parse(JSON.stringify(this.schema));
    return clone;
  }
}
