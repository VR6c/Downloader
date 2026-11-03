import { useEffect, useRef } from 'react';

export interface Shortcut {
  /** Lower-case key, matched with Cmd (macOS) or Ctrl. */
  key: string;
  /** true = Shift required, false = Shift must be up, undefined = ignored. */
  shift?: boolean;
  /** Fire while typing in an input / textarea / contenteditable. Default: false. */
  allowInInput?: boolean;
  /** Skip (and don't preventDefault) when this returns false. */
  when?: () => boolean;
  run: () => void;
}

/**
 * Registers one stable keydown listener. The latest shortcut list is read through a ref,
 * so handlers can close over fresh state without re-binding the listener on every change.
 */
export function useGlobalShortcuts(shortcuts: Shortcut[]) {
  const latest = useRef(shortcuts);
  latest.current = shortcuts;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      const key = e.key.toLowerCase();

      const match = latest.current.find(
        (s) =>
          s.key === key &&
          (s.shift === undefined || s.shift === e.shiftKey) &&
          (s.allowInInput || !typing) &&
          (s.when?.() ?? true)
      );
      if (!match) return;
      e.preventDefault();
      match.run();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
