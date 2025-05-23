import { Duration, Effect } from 'effect';
import React, { useEffect, useRef, useState } from 'react';

const memoryStore = new Map<string, any>();

/**
 * 캐싱 효과를 제공하는 커스텀 훅
 * Promise 버전은 Error 정보를 리턴하지 않음에 주의
 *
 * @param key 캐시 키
 * @param factory 캐싱할 Promise 생성 함수
 * @param deps 의존성 배열
 * @returns [data, isLoading, error, refresh]
 * @example
 * const userId = userData?.id;
 * const [userPosts, isLoadingPosts, refreshPosts] = usePromiseCache(
 *   'user-posts',
 *   () => fetch(`/api/users/${userId}/posts`).then(res => res.json()),
 *   [userId]
 * );
 */
export function usePromiseCache<T>(
  key: string,
  factory: () => Promise<T>,
  deps: React.DependencyList = []): [T | undefined, boolean, () => void] {
  const [data, isLoading, _error, refresh] =  useTimedEffectCache<T, never>(key, () => Effect.promise(() => factory()), deps, 0);
  return [data, isLoading, refresh];
}

/**
 * 캐싱 효과를 제공하는 커스텀 훅
 * Promise 버전은 Error 정보를 리턴하지 않음에 주의
 *
 * @param key 캐시 키
 * @param factory 캐싱할 Promise 생성 함수
 * @param deps 의존성 배열
 * @param timeToLive 유지될 시간 (단위: min)
 * @returns [data, isLoading, error, refresh]
 * @example
 * const userId = userData?.id;
 * const [userPosts, isLoadingPosts, refreshPosts] = useTimedPromiseCache(
 *   'user-posts',
 *   () => fetch(`/api/users/${userId}/posts`).then(res => res.json()),
 *   [userId], 10
 * );
 */
export function useTimedPromiseCache<T>(
  key: string,
  factory: () => Promise<T>,
  deps: React.DependencyList = [],
  timeToLive: number = 5): [T | undefined, boolean, () => void] {
  const [data, isLoading, _error, refresh] =  useTimedEffectCache<T, never>(key, () => Effect.promise(() => factory()), deps, timeToLive);
  return [data, isLoading, refresh];
}

/**
 * 캐싱 효과를 제공하는 커스텀 훅
 * 제한 시간 없이 영구 유지
 *
 * @param key 캐시 키
 * @param factory 캐싱할 Effect 생성 함수
 * @param deps 의존성 배열
 * @returns [data, isLoading, error, refresh]
 * @example
 * const userId = userData?.id;
 * const [userPosts, isLoadingPosts, postsError, refreshPosts] = useEffectCache(
 *   'user-posts',
 *   () => Effect.promise(() => fetch(`/api/users/${userId}/posts`).then(res => res.json())),
 *   [userId]
 * );
 */
export function useEffectCache<A, E>(
  key: string,
  factory: () => Effect.Effect<A, E>,
  deps: React.DependencyList = []): [A | undefined, boolean, E | null, () => void] {
  return useTimedEffectCache<A, E>(key, factory, deps, 0);
}

/**
 * 캐싱 효과를 제공하는 커스텀 훅
 *
 * @param key 캐시 키
 * @param factory 캐싱할 Effect 생성 함수
 * @param deps 의존성 배열
 * @param timeToLive 유지될 시간 (단위: min)
 * @returns [data, isLoading, error, refresh]
 * @example
 * const userId = userData?.id;
 * const [userPosts, isLoadingPosts, postsError, refreshPosts] = useEffectTimedCache(
 *   'user-posts',
 *   () => Effect.promise(() => fetch(`/api/users/${userId}/posts`).then(res => res.json())),
 *   [userId], 10
 * );
 */
export function useTimedEffectCache<A, E>(
  key: string,
  factory: () => Effect.Effect<A, E>,
  deps: React.DependencyList = [],
  timeToLive: number = 5): [A | undefined, boolean, E | null, () => void] {
  const [data, setData] = useState<A | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<E | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const cacheKey = `${key}:${JSON.stringify(deps)}`;
  const cachedEffectRef = useRef<Effect.Effect<Effect.Effect<A, E>>>(null);

  const refresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const cachedValue = memoryStore.get(cacheKey) as A | undefined;
    if (cachedValue !== undefined) {
      setData(cachedValue);
      setIsLoading(false);
      return;
    }

    const effect = factory();

    let cache: Effect.Effect<A, E>;

    if (timeToLive > 0) {
      const cachedEffect = Effect.cachedWithTTL(effect, Duration.minutes(timeToLive));
      cachedEffectRef.current = cachedEffect;
      cache = Effect.runSync(cachedEffect);
    } else {
      const cachedEffect = Effect.cached(effect);
      cachedEffectRef.current = cachedEffect;
      cache = Effect.runSync(cachedEffect);
    }

    Effect.runPromise(
      Effect.tap(
        cache,
        (result) => Effect.sync(() => {
          memoryStore.set(cacheKey, result);
        })
      )
    ).then(result => {
      setData(result);
      setIsLoading(false);
    }).catch(e => {
      setError(e as E);
      setIsLoading(false);
    });

    return () => {};
  }, [...deps, refreshKey]);

  return [data, isLoading, error, refresh];
}
