import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon: React.ReactNode;
  iconStyle?: React.CSSProperties;
  iconClassName?: string;
  /** Use the compact dialog variant. */
  size?: 'sm';
  /** Dialog width in px (capped to the viewport). */
  width?: number;
  style?: React.CSSProperties;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  /** `.modal-body` / `.modal-footer` sections. */
  children: React.ReactNode;
}

/**
 * Shared modal shell: backdrop, accessible dialog semantics, header, Escape to close,
 * initial focus, and focus restoration to the previously focused element on close.
 */
export const Modal: React.FC<ModalProps> = ({
  onClose,
  title,
  subtitle,
  icon,
  iconStyle,
  iconClassName,
  size,
  width,
  style,
  onKeyDown,
  children,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    // Respect an autoFocus'd field inside the dialog; otherwise focus the dialog itself.
    if (dialog && !dialog.contains(document.activeElement)) dialog.focus();

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className={`modal-dialog${size ? ` modal-dialog--${size}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ ...(width ? { width: `${width}px`, maxWidth: '94vw' } : null), ...style }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <div className={`modal-icon-badge${iconClassName ? ` ${iconClassName}` : ''}`} style={iconStyle} aria-hidden="true">
              {icon}
            </div>
            <div>
              <div className="modal-title" id={titleId}>
                {title}
              </div>
              {subtitle && <div className="modal-subtitle">{subtitle}</div>}
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
