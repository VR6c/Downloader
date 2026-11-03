import { useState, useCallback, useRef, useEffect } from 'react';
import { ToastMessage, AddToast } from '../types';

const TOAST_DURATION_MS = 4500;
const TOAST_EXIT_MS = 180; // keep in sync with `toast-out` in motion.css

export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const leaving = useRef(new Set<string>());

  const dismissToast = useCallback((id: string) => {
    if (leaving.current.has(id)) return;
    leaving.current.add(id);

    const autoTimer = timers.current.get(id);
    if (autoTimer) clearTimeout(autoTimer);

    // Play the exit animation, then drop the toast
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        leaving.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, TOAST_EXIT_MS)
    );
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
