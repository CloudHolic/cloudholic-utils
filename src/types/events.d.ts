import { Effect } from 'effect';

export type EventPayload<T = unknown> = {
  type: string;
  data: T;
};

export type EventListener<T = unknown> = (payload: EventPayload<T>) => void;

export type IEventService = {
  emit: <T>(eventType: string, data: T) => Effect.Effect<void, never, never>;
  on: <T>(eventType: string, listener: EventListener<T>) => Effect.Effect<void, never, never>;
  off: <T>(eventType: string, listener: EventListener<T>) => Effect.Effect<void, never, never>;
};
