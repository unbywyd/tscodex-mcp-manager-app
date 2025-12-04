/**
 * EventBus - Internal pub/sub for component communication
 */

import { EventEmitter } from 'events';
import type { ServerEvent, AppEvent } from '../../shared/types';

type EventMap = {
  'server-event': ServerEvent;
  'app-event': AppEvent;
};

export class EventBus {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
  }

  /**
   * Subscribe to an event
   */
  on<K extends keyof EventMap>(event: K, listener: (data: EventMap[K]) => void): void {
    this.emitter.on(event, listener);
  }

  /**
   * Unsubscribe from an event
   */
  off<K extends keyof EventMap>(event: K, listener: (data: EventMap[K]) => void): void {
    this.emitter.off(event, listener);
  }

  /**
   * Emit a server event
   */
  emitServerEvent(event: Omit<ServerEvent, 'timestamp'>): void {
    const fullEvent: ServerEvent = {
      ...event,
      timestamp: Date.now(),
    };
    // Only log important events (not logs)
    if (fullEvent.type !== 'server-log') {
      console.log(`[EventBus] ${fullEvent.type}: ${fullEvent.serverId} (${fullEvent.workspaceId})`);
    }
    this.emitter.emit('server-event', fullEvent);
  }

  /**
   * Emit an app event
   */
  emitAppEvent(event: Omit<AppEvent, 'timestamp'>): void {
    const fullEvent: AppEvent = {
      ...event,
      timestamp: Date.now(),
    };
    this.emitter.emit('app-event', fullEvent);
  }
}
