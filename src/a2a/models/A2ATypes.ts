/**
 * A2A Protocol Type Definitions
 * 
 * This file contains the type definitions for the A2A protocol.
 */

/**
 * A2A Message Types
 */
export enum A2AMessageType {
  REQUEST = 'request',
  RESPONSE = 'response',
  CAPABILITY_DISCOVERY = 'capability_discovery',
  CAPABILITY_RESPONSE = 'capability_response',
  TASK_DELEGATION = 'task_delegation',
  TASK_PROGRESS = 'task_progress',
  TASK_COMPLETION = 'task_completion',
  ERROR = 'error'
}

/**
 * Task Status Types
 */
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DELEGATED = 'delegated'
}

/**
 * A2A Message
 * Represents a message in the A2A protocol
 */
export interface A2AMessage {
  /**
   * Unique message identifier
   */
  id: string;
  
  /**
   * Message type
   */
  type: A2AMessageType;
  
  /**
   * Sender information
   */
  sender: {
    id: string;
    name: string;
    capabilities?: string[];
  };
  
  /**
   * Recipient information (null for broadcast messages)
   */
  recipient: {
    id: string;
    name: string;
  } | null;
  
  /**
   * Message content
   */
  content: string;
  
  /**
   * Task information (if applicable)
   */
  task?: {
    id: string;
    description: string;
    status: TaskStatus;
    delegatedBy?: string;
  };
  
  /**
   * Capability requirements (if applicable)
   */
  capabilities?: {
    required: string[];
    optional?: string[];
  };
  
  /**
   * Message metadata
   */
  metadata: {
    timestamp: number;
    conversationId?: string;
    correlationId?: string;
    ttl?: number;
  };
  
  /**
   * Error information (if applicable)
   */
  error?: A2AError;
}

/**
 * A2A Task
 * Represents a task that can be delegated to another agent
 */
export interface A2ATask {
  /**
   * Unique task identifier
   */
  id: string;
  
  /**
   * Task description
   */
  description: string;
  
  /**
   * Required capabilities to perform the task
   */
  requiredCapabilities: string[];
  
  /**
   * Optional capabilities that enhance task performance
   */
  optionalCapabilities?: string[];
  
  /**
   * Task parameters
   */
  parameters: Record<string, any>;
  
  /**
   * Agent that delegated the task
   */
  delegatedBy: {
    id: string;
    name: string;
  };
  
  /**
   * Task priority (higher number = higher priority)
   */
  priority?: number;
  
  /**
   * Task deadline (timestamp)
   */
  deadline?: number;
  
  /**
   * Compensation strategy for task failure
   */
  compensation?: A2ACompensationStrategy;
}

/**
 * A2A Task Result
 * Represents the result of a completed task
 */
export interface A2ATaskResult {
  /**
   * Task identifier
   */
  taskId: string;
  
  /**
   * Task status
   */
  status: TaskStatus;
  
  /**
   * Task result (if successful)
   */
  result?: any;
  
  /**
   * Task error (if failed)
   */
  error?: A2AError;
  
  /**
   * Agent that completed the task
   */
  completedBy: {
    id: string;
    name: string;
  };
  
  /**
   * Timestamp when the task was completed
   */
  completedAt: number;
}

/**
 * A2A Task Update
 * Represents an update to a task's status
 */
export interface A2ATaskUpdate {
  /**
   * Task identifier
   */
  taskId: string;
  
  /**
   * Task status
   */
  status: TaskStatus;
  
  /**
   * Task progress (0-100)
   */
  progress?: number;
  
  /**
   * Status message
   */
  message?: string;
  
  /**
   * Timestamp when the update was created
   */
  updatedAt: number;
}

/**
 * A2A Error
 * Represents an error in the A2A protocol
 */
export interface A2AError {
  /**
   * Error code
   */
  code: string;
  
  /**
   * Error message
   */
  message: string;
  
  /**
   * Additional error details
   */
  details?: any;
}

/**
 * A2A Compensation Strategy
 * Defines how to compensate for task failure
 */
export interface A2ACompensationStrategy {
  /**
   * Compensation type
   */
  type: 'retry' | 'alternate' | 'rollback' | 'notify';
  
  /**
   * Maximum number of retries (for retry strategy)
   */
  maxRetries?: number;
  
  /**
   * Delay between retries in milliseconds (for retry strategy)
   */
  retryDelay?: number;
  
  /**
   * Alternate task to execute (for alternate strategy)
   */
  alternateTask?: Partial<A2ATask>;
  
  /**
   * Notification recipients (for notify strategy)
   */
  notifyAgents?: string[];
}

/**
 * Agent Registration
 * Represents an agent registered with the A2A system
 */
export interface AgentRegistration {
  /**
   * Agent identifier
   */
  id: string;
  
  /**
   * Agent name
   */
  name: string;
  
  /**
   * Agent capabilities
   */
  capabilities: AgentCapability[];
  
  /**
   * Agent endpoints
   */
  endpoints: {
    /**
     * Messaging endpoint
     */
    messaging: string;
    
    /**
     * Task delegation endpoint
     */
    taskDelegation: string;
    
    /**
     * Capability discovery endpoint
     */
    capabilityDiscovery: string;
  };
}

/**
 * Agent Card
 * Represents an agent's public information for discovery
 */
export interface AgentCard {
  /**
   * Agent identifier
   */
  id: string;
  
  /**
   * Agent name
   */
  name: string;
  
  /**
   * Agent description
   */
  description?: string;
  
  /**
   * Agent capabilities
   */
  capabilities: AgentCapability[];
  
  /**
   * Agent version
   */
  version: string;
  
  /**
   * Agent endpoints
   */
  endpoints: {
    [key: string]: string;
  };
  
  /**
   * Authentication information
   */
  authentication?: {
    /**
     * Authentication type
     */
    type: string;
    
    /**
     * Additional authentication parameters
     */
    [key: string]: any;
  };
}

/**
 * Agent Capability
 * Represents a capability that an agent can provide
 */
export interface AgentCapability {
  /**
   * Capability identifier
   */
  id: string;
  
  /**
   * Capability name
   */
  name: string;
  
  /**
   * Capability description
   */
  description?: string;
  
  /**
   * Capability version
   */
  version: string;
  
  /**
   * Capability parameters
   */
  parameters?: CapabilityParameter[];
  
  /**
   * Capability return value
   */
  returns?: CapabilityReturn;
  
  /**
   * Capability examples
   */
  examples?: CapabilityExample[];
  
  /**
   * Capability category
   */
  category?: string;
  
  /**
   * Capability tags
   */
  tags?: string[];
}

/**
 * Capability Parameter
 * Represents a parameter for a capability
 */
export interface CapabilityParameter {
  /**
   * Parameter name
   */
  name: string;
  
  /**
   * Parameter type
   */
  type: string;
  
  /**
   * Parameter description
   */
  description?: string;
  
  /**
   * Whether the parameter is required
   */
  required: boolean;
  
  /**
   * Parameter schema
   */
  schema?: any;
}

/**
 * Capability Return
 * Represents the return value of a capability
 */
export interface CapabilityReturn {
  /**
   * Return type
   */
  type: string;
  
  /**
   * Return description
   */
  description?: string;
  
  /**
   * Return schema
   */
  schema?: any;
}

/**
 * Capability Example
 * Represents an example of a capability
 */
export interface CapabilityExample {
  /**
   * Example description
   */
  description?: string;
  
  /**
   * Example parameters
   */
  parameters: any;
  
  /**
   * Example return value
   */
  returns: any;
}

/**
 * Capability Filter
 * Used to filter capabilities during discovery
 */
export interface CapabilityFilter {
  /**
   * Filter by category
   */
  category?: string;
  
  /**
   * Filter by tags
   */
  tags?: string[];
  
  /**
   * Filter by query string
   */
  query?: string;
}

/**
 * A2A Message Filter
 * Used to filter messages for subscription
 */
export interface A2AMessageFilter {
  /**
   * Filter by sender
   */
  sender?: string;
  
  /**
   * Filter by recipient
   */
  recipient?: string;
  
  /**
   * Filter by message type
   */
  type?: A2AMessageType | A2AMessageType[];
}

/**
 * A2A Subscription
 * Represents a subscription to messages or task updates
 */
export interface Subscription {
  /**
   * Unsubscribe from the subscription
   */
  unsubscribe(): void;
}

/**
 * A2A Configuration
 * Configuration for the A2A system
 */
export interface A2AConfiguration {
  /**
   * Whether A2A is enabled
   */
  enabled: boolean;
  
  /**
   * Agent identifier
   */
  agentId: string;
  
  /**
   * Agent name
   */
  agentName: string;
  
  /**
   * Capability configuration
   */
  capabilities: {
    /**
     * Enabled capabilities
     */
    enabled: string[];
    
    /**
     * Disabled capabilities
     */
    disabled: string[];
  };
  
  /**
   * Security configuration
   */
  security: {
    /**
     * Authentication type
     */
    authenticationType: string;
    
    /**
     * OAuth configuration
     */
    oauth?: {
      /**
       * OAuth client ID
       */
      clientId: string;
      
      /**
       * OAuth client secret
       */
      clientSecret: string;
      
      /**
       * OAuth token endpoint
       */
      tokenEndpoint: string;
    };
    
    /**
     * MTLS configuration
     */
    mtls?: {
      /**
       * Certificate path
       */
      certPath: string;
      
      /**
       * Key path
       */
      keyPath: string;
    };
  };
  
  /**
   * Endpoint configuration
   */
  endpoints: {
    /**
     * Base URL
     */
    baseUrl?: string;
    
    /**
     * Messaging endpoint
     */
    messaging: string;
    
    /**
     * Task delegation endpoint
     */
    taskDelegation: string;
    
    /**
     * Capability discovery endpoint
     */
    capabilityDiscovery: string;
  };
}

/**
 * A2A Credentials
 * Represents credentials for A2A communication
 */
export interface A2ACredentials {
  /**
   * Credential identifier
   */
  id: string;
  
  /**
   * Authentication token
   */
  token?: string;
  
  /**
   * Certificate for MTLS
   */
  certificate?: string;
  
  /**
   * Expiration timestamp
   */
  expiresAt?: number;
}

/**
 * Validation Result
 * Represents the result of validating a message or capability request
 */
export interface ValidationResult {
  /**
   * Whether the validation was successful
   */
  valid: boolean;
  
  /**
   * Validation errors (if any)
   */
  errors?: ValidationError[];
}

/**
 * Validation Error
 * Represents an error during validation
 */
export interface ValidationError {
  /**
   * Field that failed validation
   */
  field: string;
  
  /**
   * Error message
   */
  message: string;
  
  /**
   * Error code
   */
  code: string;
}