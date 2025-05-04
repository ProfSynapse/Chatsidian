/**
 * Factory for creating different types of event buses.
 */

import { EventBus } from './EventBus';
import { LoggingEventBus } from './LoggingEventBus';
import { TypedEventBus } from './EventTypes';

/**
 * Factory class for creating event buses.
 */
export class EventBusFactory {
  /**
   * Create a basic EventBus.
   * @returns EventBus instance
   */
  public static createBasicEventBus(): EventBus {
    return new EventBus();
  }
  
  /**
   * Create a logging EventBus.
   * @param debugMode Whether to enable debug logging
   * @returns LoggingEventBus instance
   */
  public static createLoggingEventBus(debugMode: boolean = false): LoggingEventBus {
    return new LoggingEventBus(new EventBus(), debugMode);
  }
  
  /**
   * Create a typed EventBus.
   * @returns TypedEventBus instance
   */
  public static createTypedEventBus(): TypedEventBus {
    return new TypedEventBus(new EventBus());
  }
  
  /**
   * Create a typed and logging EventBus.
   * @param debugMode Whether to enable debug logging
   * @returns TypedEventBus instance with logging
   */
  public static createTypedLoggingEventBus(debugMode: boolean = false): TypedEventBus {
    return new TypedEventBus(new LoggingEventBus(new EventBus(), debugMode) as any);
  }
}
