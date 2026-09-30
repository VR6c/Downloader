import React from 'react';
import { X } from 'lucide-react';

export interface BadgeProps {
  children?: React.ReactNode;
  variant?:
    | 'primary'
    | 'accent'
    | 'success'
    | 'warning'
    | 'danger'
    | 'neutral'
    | 'subtle'
    | 'outline';
  size?: 'xs' | 'sm' | 'md';
  dot?: boolean;
  dotColor?: string;
  icon?: React.ReactNode;
  removable?: boolean;
  onRemove?: () => void;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  dot = false,
  dotColor,
  icon,
  removable = false,
  onRemove,
  className = '',
  style,
  title,
}) => {
  const classes = [
    'ui-badge',
    `ui-badge-${variant}`,
    `ui-badge-${size}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} style={style} title={title}>
      {dot && (
        <span
          className="ui-badge-dot"
          style={dotColor ? { backgroundColor: dotColor } : undefined}
          aria-hidden="true"
        />
      )}

      {icon && <span className="ui-badge-icon">{icon}</span>}

      {children && <span className="ui-badge-text">{children}</span>}

      {removable && (
        <button
          type="button"
          className="ui-badge-remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          aria-label="Remove badge"
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
};
