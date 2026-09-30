import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { ToastMessage } from '../types';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const TOAST_ICONS: Record<ToastMessage['type'], React.ReactNode> = {
  success: <CheckCircle2 size={18} className="toast-icon toast-icon-success" />,
  warning: <AlertTriangle size={18} className="toast-icon toast-icon-warning" />,
  error: <AlertCircle size={18} className="toast-icon toast-icon-error" />,
  info: <Info size={18} className="toast-icon toast-icon-info" />,
};

export const Toast: React.FC<ToastProps> = React.memo(({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-item ${toast.type}`}>
          <div className="toast-icon-wrapper" aria-hidden="true">
            {TOAST_ICONS[toast.type]}
          </div>
          <div className="toast-content">
            <div className="toast-title">{toast.title}</div>
            <div className="toast-message">{toast.message}</div>
          </div>
          <button
            type="button"
            className="toast-dismiss-btn"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
});

Toast.displayName = 'Toast';
