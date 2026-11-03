import { useState, useEffect } from 'react';

/** useState mirrored to localStorage. Storage failures (private mode, quota) degrade to in-memory state. */
export function usePersistentState<T extends string>(
  key: string,
  fallback: T,
  isValid: (value: string) => value is T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null && isValid(stored) ? stored : fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // storage unavailable
    }
  }, [key, value]);

  return [value, setValue];
}
