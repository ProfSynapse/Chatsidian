import { App } from 'obsidian';
import { EventBus } from '../core/EventBus';
import { IA2AProtocolHandler } from './interfaces';
import { 
  A2AMessage, 
  A2AMessageType, 
  TaskStatus, 
  ValidationResult, 
  ValidationError,
  A2AError
} from './models/A2ATypes';
import { v4 as uuidv4 } from 'uuid';

/**
 * A2A Protocol Handler
 * 
 * Implements the A2A protocol specifics for message formatting, validation, and protocol flows.
 * Handles message formatting, validation, and protocol-specific operations.
 */
export class A2AProtocolHandler implements IA2AProtocolHandler {
  private app: App;
  private eventBus: EventBus;
  
  /**
   * Create a new A2A protocol handler
   * @param app - Obsidian app instance
   * @param eventBus - Event bus
   */
  constructor(
    app: App,
    eventBus: EventBus
  ) {
    this.app = app;
    this.eventBus = eventBus;
  }
  
  /**
   * Format a message according to A2A protocol
   * @param message - The message parameters
   * @returns Formatted A2A message
   */
  public formatMessage(message: Partial<A2AMessage>): A2AMessage {
    // Ensure required fields
    if (!message.id) {
      message.id = uuidv4();
    }
    
    if (!message.type) {
      throw new Error('Message type is required');
    }
    
    if (!message.sender) {
      throw new Error('Message sender is required');
    }
    
    if (!message.metadata) {
      message.metadata = {
        timestamp: Date.now()
      };
    }
    
    if (!message.metadata.timestamp) {
      message.metadata.timestamp = Date.now();
    }
    
    if (!message.content) {
      message.content = '';
    }
    
    // Create formatted message
    const formattedMessage: A2AMessage = {
      id: message.id,
      type: message.type,
      sender: message.sender,
      recipient: message.recipient || null,
      content: message.content,
      metadata: message.metadata
    };
    
    // Add optional fields
    if (message.task) {
      formattedMessage.task = message.task;
    }
    
    if (message.capabilities) {
      formattedMessage.capabilities = message.capabilities;
    }
    
    if (message.error) {
      formattedMessage.error = message.error;
    }
    
    // Emit event
    this.eventBus.emit('a2a:message:formatted', {
      messageId: formattedMessage.id,
      message: formattedMessage
    });
    
    return formattedMessage;
  }
  
  /**
   * Validate an A2A message
   * @param message - The message to validate
   * @returns Validation result
   */
  public validateMessage(message: any): ValidationResult {
    const errors: ValidationError[] = [];
    
    // Check required fields
    if (!message) {
      errors.push({
        field: 'message',
        message: 'Message is required',
        code: 'missing_field'
      });
      
      return { valid: false, errors };
    }
    
    if (!message.id) {
      errors.push({
        field: 'id',
        message: 'Message ID is required',
        code: 'missing_field'
      });
    }
    
    if (!message.type) {
      errors.push({
        field: 'type',
        message: 'Message type is required',
        code: 'missing_field'
      });
    } else if (!Object.values(A2AMessageType).includes(message.type)) {
      errors.push({
        field: 'type',
        message: `Invalid message type: ${message.type}`,
        code: 'invalid_value'
      });
    }
    
    if (!message.sender) {
      errors.push({
        field: 'sender',
        message: 'Message sender is required',
        code: 'missing_field'
      });
    } else {
      if (!message.sender.id) {
        errors.push({
          field: 'sender.id',
          message: 'Sender ID is required',
          code: 'missing_field'
        });
      }
      
      if (!message.sender.name) {
        errors.push({
          field: 'sender.name',
          message: 'Sender name is required',
          code: 'missing_field'
        });
      }
    }
    
    // For non-broadcast messages, recipient is required
    if (message.type !== A2AMessageType.CAPABILITY_DISCOVERY && message.recipient === undefined) {
      errors.push({
        field: 'recipient',
        message: 'Message recipient is required for non-broadcast messages',
        code: 'missing_field'
      });
    } else if (message.recipient && typeof message.recipient === 'object') {
      if (!message.recipient.id) {
        errors.push({
          field: 'recipient.id',
          message: 'Recipient ID is required',
          code: 'missing_field'
        });
      }
      
      if (!message.recipient.name) {
        errors.push({
          field: 'recipient.name',
          message: 'Recipient name is required',
          code: 'missing_field'
        });
      }
    }
    
    if (!message.metadata) {
      errors.push({
        field: 'metadata',
        message: 'Message metadata is required',
        code: 'missing_field'
      });
    } else if (!message.metadata.timestamp) {
      errors.push({
        field: 'metadata.timestamp',
        message: 'Metadata timestamp is required',
        code: 'missing_field'
      });
    }
    
    // Check task fields if present
    if (message.task) {
      if (!message.task.id) {
        errors.push({
          field: 'task.id',
          message: 'Task ID is required',
          code: 'missing_field'
        });
      }
      
      if (!message.task.description) {
        errors.push({
          field: 'task.description',
          message: 'Task description is required',
          code: 'missing_field'
        });
      }
      
      if (!message.task.status) {
        errors.push({
          field: 'task.status',
          message: 'Task status is required',
          code: 'missing_field'
        });
      } else if (!Object.values(TaskStatus).includes(message.task.status)) {
        errors.push({
          field: 'task.status',
          message: `Invalid task status: ${message.task.status}`,
          code: 'invalid_value'
        });
      }
    }
    
    // Check capabilities fields if present
    if (message.capabilities) {
      if (!message.capabilities.required || !Array.isArray(message.capabilities.required)) {
        errors.push({
          field: 'capabilities.required',
          message: 'Capabilities required array is required',
          code: 'missing_field'
        });
      }
      
      if (message.capabilities.optional && !Array.isArray(message.capabilities.optional)) {
        errors.push({
          field: 'capabilities.optional',
          message: 'Capabilities optional must be an array',
          code: 'invalid_type'
        });
      }
    }
    
    // Return validation result
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
  
  /**
   * Handle negotiation request
   * @param request - The negotiation request
   * @returns Promise resolving to negotiation response
   */
  public async handleNegotiation(request: any): Promise<any> {
    try {
      // Validate request
      const validationResult = this.validateMessage(request);
      if (!validationResult.valid) {
        throw new Error(`Invalid negotiation request: ${JSON.stringify(validationResult.errors)}`);
      }
      
      // TODO: Implement actual negotiation logic
      // For now, just accept all negotiations
      
      // Create response
      const response = this.formatMessage({
        type: A2AMessageType.RESPONSE,
        sender: {
          id: 'a2a_system',
          name: 'A2A System'
        },
        recipient: request.sender,
        content: JSON.stringify({ accepted: true }),
        metadata: {
          timestamp: Date.now(),
          correlationId: request.metadata.correlationId
        }
      });
      
      return response;
    } catch (error) {
      console.error('Error handling negotiation request:', error);
      
      // Create error response
      return this.formatMessage({
        type: A2AMessageType.ERROR,
        sender: {
          id: 'a2a_system',
          name: 'A2A System'
        },
        recipient: request.sender,
        content: '',
        metadata: {
          timestamp: Date.now(),
          correlationId: request.metadata?.correlationId || uuidv4()
        },
        error: {
          code: 'negotiation_error',
          message: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }
  
  /**
   * Handle task delegation
   * @param task - The task to delegate
   * @returns Promise resolving to task result
   */
  public async handleTaskDelegation(task: any): Promise<any> {
    try {
      // Validate task
      if (!task) {
        throw new Error('Task is required');
      }
      
      if (!task.id) {
        throw new Error('Task ID is required');
      }
      
      if (!task.description) {
        throw new Error('Task description is required');
      }
      
      if (!task.delegatedBy) {
        throw new Error('Task delegatedBy is required');
      }
      
      // TODO: Implement actual task delegation logic
      // For now, just simulate task execution
      
      // Create task result
      return {
        taskId: task.id,
        status: TaskStatus.COMPLETED,
        result: { success: true, message: 'Task completed successfully' },
        completedBy: {
          id: 'a2a_system',
          name: 'A2A System'
        },
        completedAt: Date.now()
      };
    } catch (error) {
      console.error('Error handling task delegation:', error);
      
      // Create error result
      return {
        taskId: task.id,
        status: TaskStatus.FAILED,
        error: {
          code: 'task_delegation_error',
          message: error instanceof Error ? error.message : String(error)
        },
        completedBy: {
          id: 'a2a_system',
          name: 'A2A System'
        },
        completedAt: Date.now()
      };
    }
  }
  
  /**
   * Handle capability discovery
   * @param request - The capability discovery request
   * @returns Capability discovery response
   */
  public handleCapabilityDiscovery(request: any): any {
    try {
      // Validate request
      const validationResult = this.validateMessage(request);
      if (!validationResult.valid) {
        throw new Error(`Invalid capability discovery request: ${JSON.stringify(validationResult.errors)}`);
      }
      
      // TODO: Implement actual capability discovery logic
      // For now, just return an empty response
      
      // Create response
      return this.formatMessage({
        type: A2AMessageType.CAPABILITY_RESPONSE,
        sender: {
          id: 'a2a_system',
          name: 'A2A System'
        },
        recipient: request.sender,
        content: JSON.stringify([]),
        metadata: {
          timestamp: Date.now(),
          correlationId: request.metadata.correlationId
        }
      });
    } catch (error) {
      console.error('Error handling capability discovery:', error);
      
      // Create error response
      return this.formatMessage({
        type: A2AMessageType.ERROR,
        sender: {
          id: 'a2a_system',
          name: 'A2A System'
        },
        recipient: request.sender,
        content: '',
        metadata: {
          timestamp: Date.now(),
          correlationId: request.metadata?.correlationId || uuidv4()
        },
        error: {
          code: 'capability_discovery_error',
          message: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }
  
  /**
   * Handle A2A error
   * @param error - The A2A error
   * @returns A2A error response
   */
  public handleError(error: A2AError): A2AMessage {
    // Create error message
    return this.formatMessage({
      type: A2AMessageType.ERROR,
      sender: {
        id: 'a2a_system',
        name: 'A2A System'
      },
      recipient: null,
      content: '',
      metadata: {
        timestamp: Date.now()
      },
      error: error
    });
  }
}