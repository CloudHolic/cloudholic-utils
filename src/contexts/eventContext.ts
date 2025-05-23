import { Context } from 'effect';
import type { IEventService } from '../types/events';

export class EventServiceContext extends Context.Tag("EventService")<EventServiceContext, IEventService>() {}
