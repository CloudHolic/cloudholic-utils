import { Effect } from 'effect';
import { EventServiceContext } from '../contexts/eventContext';
import type { EventPayload, EventListener } from '../types/events';
import { useEffect, useState } from 'react';
import { EventServiceLayer } from '../services/eventService';

/**
 * 이벤트를 발행하는 함수를 제공하는 커스텀 훅.<br/>
 * 해당 함수는 인자로 eventType(string)과 (data: T)를 요구한다.
 * @returns event 발행 함수
 * @example
 * type CounterState = {
 *   count: number;
 * };
 *
 * const emitEvent = useEventEmit();
 * emitEvent<CounterState>('counter', { count: 1 });
 */
export const useEventEmit = () => {
  return <T>(eventType: string, data: T) => {
    const emitEffect = Effect.gen(function*($) {
      const service = yield* $(EventServiceContext);
      yield* $(service.emit<T>(eventType, data));
    });
    Effect.runSync(Effect.provide(emitEffect, EventServiceLayer));
  };
};

/**
 * 특정 이벤트에 대응할 콜백함수를 등록하는 커스텀 훅.
 * @param eventType 등록할 이벤트 타입
 * @param callback 해당 이벤트를 처리할 콜백함수. T => void 타입의 함수를 제공해야 한다.
 * @example
 * type CounterState = {
 *   count: number;
 * };
 *
 * useEventOn<CounterState>('counter', (data) => {
 *   console.log(`Counter 변경: ${data}`);
 * });
 */
export const useEventOn = <T = unknown>(eventType: string, callback: (data: T) => void) => {
  useEffect(() => {
    const listener: EventListener<T> = (payload: EventPayload<T>) => {
      if (payload.type === eventType)
        callback(payload.data);
    };

    const subscribeEffect = Effect.gen(function*($) {
      const service = yield* $(EventServiceContext);
      yield* $(service.on<T>(eventType, listener));
    });
    Effect.runSync(Effect.provide(subscribeEffect, EventServiceLayer));

    // 언마운트시 event listener 제거
    return () => {
      const unSubscribeEffect = Effect.gen(function*($) {
        const service = yield* $(EventServiceContext);
        yield* $(service.off<T>(eventType, listener));
      });
      Effect.runSync(Effect.provide(unSubscribeEffect, EventServiceLayer));
    };
  }, [eventType, callback]);
};

/**
 * 특정 이벤트가 밠애할 때 자동으로 해당 이벤트의 상태를 업데이트 하는 커스텀 훅.<br/>
 * useEventOn + useState 형태이며, 이벤트를 통해 상태 관리만을 할 경우에 사용.
 * @param eventType 등록할 이벤트 타입
 * @param initialState 이 상태값의 초기값.
 * @returns 이벤트를 통해 업데이트 되는 T 타입의 값.
 * @example
 * type CounterState = {
 *   count: number;
 * };
 *
 * // 별도의 처리 없이 'counter' 이벤트가 발행될 때마다 그에 맞게 counter 값이 업데이트된다.
 * const counter = useEventState<CounterState>('counter', { count: 0 });
 * return (
 *   <div>
 *     <h2>Counter: {counter.count}</h2>
 *   </div>
 * );
 */
export const useEventState = <T>(eventType: string, initialState: T) => {
  const [state, setState] = useState<T>(initialState);

  useEventOn<T>(eventType, (data) => {
    setState(data);
  });

  return state;
};
