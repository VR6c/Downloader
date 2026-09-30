import React, { forwardRef, useState } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  clearable?: boolean;
  onClear?: () => void;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      size = 'sm',
      clearable = false,
      onClear,
      wrapperClassName = '',
      className = '',
      type = 'text',
      id,
      value,
      onChange,
      disabled,
      ...rest
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const computedType = isPassword ? (showPassword ? 'text' : 'password') : type;
    const hasValue = value !== undefined && value !== null && String(value).length > 0;

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onClear) {
        onClear();
      } else if (onChange) {
        const syntheticEvent = {
          target: { value: '' },
          currentTarget: { value: '' },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }
    };

    return (
      <div className={`ui-input-group ${error ? 'has-error' : ''} ${disabled ? 'is-disabled' : ''} ${wrapperClassName}`}>
        {label && (
          <label htmlFor={id} className="ui-input-label">
            {label}
          </label>
        )}

        <div className={`ui-input-wrapper ui-input-${size} ${error ? 'error' : ''} ${disabled ? 'disabled' : ''}`}>
          {leftIcon && <div className="ui-input-left-icon">{leftIcon}</div>}

          <input
            ref={ref}
            id={id}
            type={computedType}
            value={value}
            onChange={onChange}
            disabled={disabled}
            className={`ui-input-field ${className}`}
            {...rest}
          />

          {clearable && hasValue && !disabled && (
            <button
              type="button"
              className="ui-input-action-btn"
              onClick={handleClear}
              title="Clear input"
              aria-label="Clear input"
            >
              <X size={13} />
            </button>
          )}

          {isPassword && (
            <button
              type="button"
              className="ui-input-action-btn"
              onClick={() => setShowPassword((prev) => !prev)}
              title={showPassword ? 'Hide password' : 'Show password'}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          )}

          {rightIcon && !isPassword && <div className="ui-input-right-icon">{rightIcon}</div>}
        </div>

        {error ? (
          <div className="ui-input-error-msg">{error}</div>
        ) : hint ? (
          <div className="ui-input-hint">{hint}</div>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
