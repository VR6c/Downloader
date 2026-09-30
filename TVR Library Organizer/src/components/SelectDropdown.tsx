import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption<T = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  description?: string;
  disabled?: boolean;
}

export interface SelectDropdownProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'toolbar' | 'form';
  icon?: React.ReactNode;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  align?: 'left' | 'right';
  menuMinWidth?: number | string;
  title?: string;
  id?: string;
  ariaLabel?: string;
  showCheckmark?: boolean;
  emptyMessage?: string;
}

export function SelectDropdown<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  disabled = false,
  size = 'sm',
  variant = 'default',
  icon: customIcon,
  className = '',
  triggerClassName = '',
  menuClassName = '',
  align = 'left',
  menuMinWidth,
  title,
  id,
  ariaLabel,
  showCheckmark = true,
  emptyMessage = 'No options available',
}: SelectDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const generatedId = useId();
  const selectId = id || generatedId;

  // Find currently selected option
  const selectedOption = options.find((opt) => opt.value === value);

  // Compute displayed label: support Camelot key filter ("key:8A") or fallback to value
  const displayLabel = selectedOption
    ? selectedOption.label
    : value?.startsWith('key:')
    ? `Camelot: ${value.replace('key:', '')}`
    : value || placeholder;

  // Active icon: prefer customIcon if passed, otherwise option's icon
  const activeIcon = customIcon || selectedOption?.icon;

  // Calculate & update menu position in portal
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const margin = 5;
    const minWidth =
      typeof menuMinWidth === 'number'
        ? menuMinWidth
        : menuMinWidth
        ? parseInt(menuMinWidth as string, 10)
        : Math.max(triggerRect.width, 175);

    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const estimatedHeight = Math.min(options.length * 36 + 16, 280);
    const flipAbove = spaceBelow < estimatedHeight + 10 && triggerRect.top > estimatedHeight + 10;

    let left = align === 'right' ? triggerRect.right - minWidth : triggerRect.left;

    // Boundary checks
    if (left + minWidth > window.innerWidth - 10) {
      left = window.innerWidth - minWidth - 10;
    }
    if (left < 10) {
      left = 10;
    }

    const top = flipAbove
      ? Math.max(10, triggerRect.top - margin - (menuRef.current?.offsetHeight || estimatedHeight))
      : triggerRect.bottom + margin;

    setMenuStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      minWidth: `${minWidth}px`,
      maxWidth: 'calc(100vw - 20px)',
      maxHeight: flipAbove
        ? `${Math.min(triggerRect.top - 20, 320)}px`
        : `${Math.min(spaceBelow - 16, 320)}px`,
      zIndex: 99999,
    });
  }, [align, menuMinWidth, options.length]);

  // Handle open/close and outside clicks
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    let rafId: number | null = null;
    const handleScrollOrResize = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        updatePosition();
        rafId = null;
      });
    };

    const handlePointerDownOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    document.addEventListener('mousedown', handlePointerDownOutside);
    document.addEventListener('touchstart', handlePointerDownOutside);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      document.removeEventListener('mousedown', handlePointerDownOutside);
      document.removeEventListener('touchstart', handlePointerDownOutside);
    };
  }, [isOpen, updatePosition]);

  // Set initial highlight index when opening
  useEffect(() => {
    if (isOpen) {
      const currentIndex = options.findIndex((opt) => opt.value === value);
      setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
    }
  }, [isOpen, options, value]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;

      case 'Tab':
        setIsOpen(false);
        break;

      case 'ArrowDown': {
        e.preventDefault();
        let nextIndex = highlightedIndex + 1;
        while (nextIndex < options.length && options[nextIndex].disabled) {
          nextIndex++;
        }
        if (nextIndex < options.length) {
          setHighlightedIndex(nextIndex);
          scrollOptionIntoView(nextIndex);
        }
        break;
      }

      case 'ArrowUp': {
        e.preventDefault();
        let prevIndex = highlightedIndex - 1;
        while (prevIndex >= 0 && options[prevIndex].disabled) {
          prevIndex--;
        }
        if (prevIndex >= 0) {
          setHighlightedIndex(prevIndex);
          scrollOptionIntoView(prevIndex);
        }
        break;
      }

      case 'Enter':
      case ' ': {
        e.preventDefault();
        if (
          highlightedIndex >= 0 &&
          highlightedIndex < options.length &&
          !options[highlightedIndex].disabled
        ) {
          onChange(options[highlightedIndex].value);
          setIsOpen(false);
          triggerRef.current?.focus();
        }
        break;
      }
    }
  };

  const scrollOptionIntoView = useCallback((index: number) => {
    if (!menuRef.current) return;
    const items = menuRef.current.querySelectorAll('.select-dropdown-item');
    if (items[index]) {
      (items[index] as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }, []);

  const handleSelectOption = useCallback((option: SelectOption<T>) => {
    if (option.disabled) return;
    onChange(option.value);
    setIsOpen(false);
    triggerRef.current?.focus();
  }, [onChange]);

  const toggleDropdown = useCallback(() => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
  }, [disabled]);

  // Portal menu content
  const menuPortal =
    isOpen &&
    createPortal(
      <div
        ref={menuRef}
        className={`select-dropdown-menu select-dropdown-menu-${size} ${menuClassName}`}
        style={menuStyle}
        role="listbox"
        id={`${selectId}-menu`}
        aria-labelledby={selectId}
      >
        {options.length === 0 ? (
          <div className="select-dropdown-empty">{emptyMessage}</div>
        ) : (
          options.map((option, index) => {
            const isSelected = option.value === value;
            const isHighlighted = index === highlightedIndex;

            return (
              <div
                key={String(option.value)}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled}
                className={`select-dropdown-item ${isSelected ? 'selected' : ''} ${
                  isHighlighted ? 'highlighted' : ''
                } ${option.disabled ? 'disabled' : ''}`}
                onClick={() => handleSelectOption(option)}
                onMouseEnter={() => {
                  if (!option.disabled) setHighlightedIndex(index);
                }}
              >
                <div className="select-dropdown-item-content">
                  {option.icon && (
                    <span className="select-dropdown-item-icon">{option.icon}</span>
                  )}
                  <span className="select-dropdown-item-label">{option.label}</span>
                  {option.badge && (
                    <span className="select-dropdown-item-badge">{option.badge}</span>
                  )}
                </div>

                {option.description && (
                  <div className="select-dropdown-item-desc">{option.description}</div>
                )}

                {showCheckmark && isSelected && (
                  <span className="select-dropdown-item-check">
                    <Check size={14} strokeWidth={2.5} />
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>,
      document.body
    );

  return (
    <div
      className={`select-dropdown-wrapper select-dropdown-${variant} select-dropdown-${size} ${
        disabled ? 'disabled' : ''
      } ${isOpen ? 'is-open' : ''} ${className}`}
    >
      <button
        ref={triggerRef}
        type="button"
        id={selectId}
        className={`select-dropdown-trigger ${triggerClassName}`}
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${selectId}-menu`}
        aria-label={ariaLabel || title}
        title={title}
      >
        <div className="select-dropdown-trigger-content">
          {activeIcon && <span className="select-dropdown-trigger-icon">{activeIcon}</span>}
          <span className="select-dropdown-trigger-label">{displayLabel}</span>
        </div>

        <span className={`select-dropdown-chevron ${isOpen ? 'open' : ''}`}>
          <ChevronDown size={14} />
        </span>
      </button>

      {menuPortal}
    </div>
  );
}

export default SelectDropdown;
