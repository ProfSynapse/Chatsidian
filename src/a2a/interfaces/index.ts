/**
 * A2A Protocol Interfaces
 * 
 * This file contains the interfaces for the A2A protocol components.
 */

/**
 * Interface for A2A Agent Connector
 * Serves as the bridge between agents and the A2A protocol system
 */
export interface IA2AAgentConnector {
  /**
   * Register an agent with the A2A system
   * @param agent The agent to register
   * @returns Promise resolving when registration is complete
   */
  registerAgent(agent: any): Promise<void>;
  
  /**
   * Send an A2A message to another agent
   * @param fromAgent The sending agent
   * @param message The A2A message to send
   * @returns Promise resolving to the response message
   */
  sendMessage(fromAgent: any, message: any): Promise<any>;
  
  /**
   * Discover capabilities of other agents
   * @param fromAgent The agent requesting capabilities
   * @param filter Optional capability filter
   * @returns Promise resolving to available capabilities
   */
  discoverCapabilities(fromAgent: any, filter?: string[]): Promise<any[]>;
  
  /**
   * Delegate a task to another agent
   * @param fromAgent The delegating agent
   * @param toAgentId The recipient agent ID
   * @param task The task to delegate
   * @returns Promise resolving to the task result
   */
  delegateTask(fromAgent: any, toAgentId: string, task: any): Promise<any>;

  /**
   * Subscribe to task updates
   * @param taskId The task ID to subscribe to
   * @param callback The callback to invoke when updates are received
   * @returns Subscription object for managing the subscription
   */
  subscribeToTaskUpdates(taskId: string, callback: (update: any) => void): any;
}

/**
 * Interface for A2A Registry
 * Maintains a registry of available agents, their capabilities, and endpoints
 */
export interface IA2ARegistry {
  /**
   * Register an agent with the registry
   * @param agentId The agent ID
   * @param capabilities The agent's capabilities
   */
  registerAgent(agentId: string, capabilities: any[]): void;
  
  /**
   * Unregister an agent from the registry
   * @param agentId The agent ID
   */
  unregisterAgent(agentId: string): void;
  
  /**
   * Get an agent registration by ID
   * @param agentId The agent ID
   * @returns The agent registration or null if not found
   */
  getAgent(agentId: string): any | null;
  
  /**
   * Find agents by capability
   * @param capability The capability to search for
   * @returns Array of agent registrations with the capability
   */
  findAgentsByCapability(capability: string): any[];
  
  /**
   * Get all registered agents
   * @returns Array of all agent registrations
   */
  getAllAgents(): any[];
  
  /**
   * Export an agent card for discovery
   * @param agentId The agent ID
   * @returns The agent card
   */
  exportAgentCard(agentId: string): any;
  
  /**
   * Import an agent card from discovery
   * @param agentCard The agent card
   */
  importAgentCard(agentCard: any): void;
}

/**
 * Interface for A2A Protocol Handler
 * Implements the A2A protocol specifics for message formatting, validation, and protocol flows
 */
export interface IA2AProtocolHandler {
  /**
   * Format a message according to A2A protocol
   * @param message The message parameters
   * @returns Formatted A2A message
   */
  formatMessage(message: any): any;
  
  /**
   * Validate an A2A message
   * @param message The message to validate
   * @returns Validation result
   */
  validateMessage(message: any): any;
  
  /**
   * Handle negotiation request
   * @param request The negotiation request
   * @returns Promise resolving to negotiation response
   */
  handleNegotiation(request: any): Promise<any>;
  
  /**
   * Handle task delegation
   * @param task The task to delegate
   * @returns Promise resolving to task result
   */
  handleTaskDelegation(task: any): Promise<any>;
  
  /**
   * Handle capability discovery
   * @param request The capability discovery request
   * @returns Capability discovery response
   */
  handleCapabilityDiscovery(request: any): any;
  
  /**
   * Handle A2A error
   * @param error The A2A error
   * @returns A2A error response
   */
  handleError(error: any): any;
}

/**
 * Interface for A2A Message Router
 * Routes messages between agents based on addressing information
 */
export interface IA2AMessageRouter {
  /**
   * Route a message to its recipient
   * @param message The message to route
   * @returns Promise resolving when routing is complete
   */
  routeMessage(message: any): Promise<any>;
  
  /**
   * Register a message handler for an agent
   * @param agentId The agent ID
   * @param handler The message handler function
   */
  registerHandler(agentId: string, handler: (message: any) => Promise<any>): void;
  
  /**
   * Unregister a message handler for an agent
   * @param agentId The agent ID
   */
  unregisterHandler(agentId: string): void;
  
  /**
   * Broadcast a message to multiple agents
   * @param message The broadcast message
   * @returns Promise resolving when broadcast is complete
   */
  broadcastMessage(message: any): Promise<void>;
  
  /**
   * Subscribe to messages based on a filter
   * @param filter The message filter
   * @param callback The callback to invoke when messages are received
   * @returns Subscription object for managing the subscription
   */
  subscribeToMessages(filter: any, callback: (message: any) => void): any;
}

/**
 * Interface for Agent Capability Registry
 * Manages capabilities exposed by agents and provides a discovery mechanism
 */
export interface IAgentCapabilityRegistry {
  /**
   * Register a capability
   * @param capability The capability to register
   */
  registerCapability(capability: any): void;
  
  /**
   * Unregister a capability
   * @param capabilityId The capability ID
   */
  unregisterCapability(capabilityId: string): void;
  
  /**
   * Get a capability by ID
   * @param capabilityId The capability ID
   * @returns The capability or null if not found
   */
  getCapability(capabilityId: string): any | null;
  
  /**
   * Find capabilities based on a filter
   * @param filter Optional capability filter
   * @returns Array of matching capabilities
   */
  findCapabilities(filter?: any): any[];
  
  /**
   * Validate a capability request against a capability
   * @param request The capability request
   * @param capability The capability to validate against
   * @returns Validation result
   */
  validateCapabilityRequest(request: any, capability: any): any;
}

/**
 * Interface for A2A Security Manager
 * Handles authentication and authorization for A2A communication
 */
export interface IA2ASecurityManager {
  /**
   * Authenticate an outgoing request
   * @param request The request to authenticate
   * @returns Promise resolving to authenticated request
   */
  authenticateOutgoingRequest(request: any): Promise<any>;
  
  /**
   * Verify an incoming request
   * @param request The request to verify
   * @returns Promise resolving to verification result
   */
  verifyIncomingRequest(request: any): Promise<boolean>;
  
  /**
   * Generate credentials for A2A communication
   * @returns A2A credentials
   */
  generateCredentials(): any;
  
  /**
   * Revoke credentials
   * @param credentialId The credential ID to revoke
   */
  revokeCredentials(credentialId: string): void;
  
  /**
   * Authorize capability access
   * @param agent The agent requesting access
   * @param capability The capability to access
   * @returns Whether access is authorized
   */
  authorizeCapabilityAccess(agent: any, capability: string): boolean;
}

/**
 * Interface for A2A Rate Limiter
 * Handles rate limiting for A2A communication
 */
export interface IA2ARateLimiter {
  /**
   * Check if an operation is within rate limits
   * @param agentId The agent ID
   * @param operation The operation to check
   * @returns Whether the operation is allowed
   */
  checkLimit(agentId: string, operation: string): boolean;
  
  /**
   * Record an operation for rate limiting
   * @param agentId The agent ID
   * @param operation The operation to record
   */
  recordOperation(agentId: string, operation: string): void;
  
  /**
   * Get remaining operations allowed
   * @param agentId The agent ID
   * @param operation The operation to check
   * @returns Number of remaining operations allowed
   */
  getRemainingOperations(agentId: string, operation: string): number;
}