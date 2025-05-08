/**
 * A2A Protocol Implementation
 *
 * This file exports all components of the A2A protocol implementation.
 */

// Import components
import { A2AAgentConnector } from './A2AAgentConnector';
import { A2ARegistry } from './A2ARegistry';
import { A2AMessageRouter } from './A2AMessageRouter';
import { A2AProtocolHandler } from './A2AProtocolHandler';

// Export interfaces
export * from './interfaces';

// Export models
export * from './models/A2ATypes';

// Export components
export { A2AAgentConnector } from './A2AAgentConnector';
export { A2ARegistry } from './A2ARegistry';
export { A2AMessageRouter } from './A2AMessageRouter';
export { A2AProtocolHandler } from './A2AProtocolHandler';

// Export factory function
export function createA2AComponents(app: any, eventBus: any) {
  // Create components
  const registry = new A2ARegistry(app, eventBus);
  const protocolHandler = new A2AProtocolHandler(app, eventBus);
  const messageRouter = new A2AMessageRouter(app, eventBus, registry);
  const agentConnector = new A2AAgentConnector(app, eventBus, registry, messageRouter, protocolHandler);
  
  return {
    registry,
    protocolHandler,
    messageRouter,
    agentConnector
  };
}