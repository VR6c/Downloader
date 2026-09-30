import React, { forwardRef, useRef, useImperativeHandle } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
  onSubmit?: (value: string) => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'filled' | 'minimal';
  shortcut?: string;
  isLoading?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  id?: string;
  ariaLabel?: string;
  style?: React.CSSProperties;
}

export interface SearchBarRef {
  focus: () => void;
  blur: () => void;
  clear: () => void;
  element: HTMLInputElement | null;
}

export const SearchBar = forwardRef<SearchBarRef, SearchBarProps>(
  (
    {
      value,
      onChange,
      placeholder = 'Search...',
      onClear,
      onSubmit,
      size = 'sm',
      variant = 'default',
      shortcut,
      isLoading = false,
      disabled = false,
      autoFocus = false,
      className = '',
      id,
      ariaLabel = 'Search',
      style,
    },
    ref
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      blur: () => inputRef.current?.blur(),
      clear: () => {
        onChange('');
        onClear?.();
        inputRef.current?.focus();
      },
      element: inputRef.current,
    }));

    const handleClear = () => {
      onChange('');
      onClear?.();
      inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        if (value) {
          e.preventDefault();
          handleClear();
        } else {
          inputRef.current?.blur();
        }
      } else if (e.key === 'Enter') {
        onSubmit?.(value);
      }
    };

    const wrapperClasses = [
      'ui-searchbar-wrapper',
      `ui-searchbar-${size}`,
      `ui-searchbar-${variant}`,
      disabled ? 'disabled' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={wrapperClasses} style={style}>
        <div className="ui-searchbar-icon" aria-hidden="true">
          {isLoading ? (
            <Loader2 size={size === 'lg' ? 17 : size === 'md' ? 15 : 14} className="ui-searchbar-spinner" />
          ) : (
            <Search size={size === 'lg' ? 17 : size === 'md' ? 15 : 14} />
          )}
        </div>

        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className="ui-searchbar-input"
          aria-label={ariaLabel}
          autoComplete="off"
          spellCheck="false"
        />

        {value && !disabled && (
          <button
            type="button"
            className="ui-searchbar-clear"
            onClick={handleClear}
            title="Clear search (Esc)"
            aria-label="Clear search"
          >
            <X size={size === 'lg' ? 15 : 13} />
          </button>
        )}

        {shortcut && !value && (
          <kbd className="ui-searchbar-kbd" title={`Keyboard shortcut: ${shortcut}`}>
            {shortcut}
          </kbd>
        )}
      </div>
    );
  }
);

SearchBar.displayName = 'SearchBar';
