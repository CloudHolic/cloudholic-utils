import { Effect, Layer } from 'effect';
import type { EventListener, EventPayload, IEventService } from '../types/events';
import { EventServiceContext } from '../contexts/eventContext';

class EventService implements IEventService {
  private listeners: Map<string, Set<EventListener<any>>> = new Map();

  emit = <T>(eventType: string, data: T): Effect.Effect<void> => {
    return Effect.sync(() => {
      const eventListeners = this.listeners.get(eventType);
      if (eventListeners) {
        const payload: EventPayload<T> = { type: eventType, data };
        eventListeners.forEach(listener => listener(payload));
      }
    });
  };

  on = <T>(eventType: string, listener: EventListener<T>): Effect.Effect<void> => {
    return Effect.sync(() => {
      if (!this.listeners.has(eventType))
        this.listeners.set(eventType, new Set());

      this.listeners.get(eventType)!.add(listener as EventListener<any>);
    });
  };

  off = <T>(eventType: string, listener: EventListener<T>): Effect.Effect<void> => {
    return Effect.sync(() => {
      const eventListeners = this.listeners.get(eventType);
      if (eventListeners) {
        eventListeners.delete(listener as EventListener<any>);
        if (eventListeners.size === 0)
          this.listeners.delete(eventType);
      }
    });
  };
}

export const EventServiceLayer = Layer.succeed(
  EventServiceContext,
  new EventService()
);
