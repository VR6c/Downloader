import { useState, useCallback, useRef, useEffect } from 'react';
import { ToastMessage, AddToast } from '../types';

const TOAST_DURATION_MS = 4500;

export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast: AddToast = useCallback(
    (type, title, message) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, type, title, message }]);
      timers.current.set(id, setTimeout(() => dismissToast(id), TOAST_DURATION_MS));
    },
    [dismissToast]
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  return { toasts, addToast, dismissToast };
}
