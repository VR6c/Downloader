import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  labelLong?: React.ReactNode;
  labelShort?: React.ReactNode;
  badge?: React.ReactNode;
  isLoading?: boolean;
  active?: boolean;
  children?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'sm',
      icon,
      rightIcon,
      labelLong,
      labelShort,
      badge,
      isLoading = false,
      active = false,
      disabled = false,
      children,
      className = '',
      type = 'button',
      ...rest
    },
    ref
  ) => {
    const isIconOnly = variant === 'icon' || size === 'icon';

    const classes = [
      'ui-btn',
      `ui-btn-${variant}`,
      `ui-btn-${size}`,
      active ? 'active' : '',
      isLoading ? 'is-loading' : '',
      disabled || isLoading ? 'disabled' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        disabled={disabled || isLoading}
        {...rest}
      >
        {isLoading ? (
          <Loader2 size={size === 'lg' ? 17 : 14} className="ui-btn-spin" />
        ) : (
          icon && <span className="ui-btn-icon-left">{icon}</span>
        )}

        {/* Dual responsive label support */}
        {labelLong && labelShort ? (
          <>
            <span className="btn-label-long">{labelLong}</span>
            <span className="btn-label-short">{labelShort}</span>
          </>
        ) : labelLong ? (
          <span className="btn-label-long">{labelLong}</span>
        ) : labelShort ? (
          <span className="btn-label-short">{labelShort}</span>
        ) : children ? (
          <span className="ui-btn-content">{children}</span>
        ) : null}

        {rightIcon && !isLoading && (
          <span className="ui-btn-icon-right">{rightIcon}</span>
        )}

        {badge !== undefined && badge !== null && (
          <span className="ui-btn-badge">{badge}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
