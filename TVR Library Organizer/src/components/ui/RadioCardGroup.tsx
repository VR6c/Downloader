import React, { useRef } from 'react';

export interface RadioCardOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface RadioCardGroupProps<T extends string> {
  options: RadioCardOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** id of the element that labels the group */
  labelledBy: string;
  columns?: number;
}

/** Card-style single choice control with radiogroup semantics and arrow-key navigation (roving tabindex). */
export function RadioCardGroup<T extends string>({
  options,
  value,
  onChange,
  labelledBy,
  columns = 2,
}: RadioCardGroupProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      className="radio-card-group"
      role="radiogroup"
      aria-labelledby={labelledBy}
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {options.map((opt, i) => {
        const checked = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className={`radio-card${checked ? ' is-checked' : ''}`}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
          >
            {opt.icon && <span className="radio-card-icon">{opt.icon}</span>}
            <span className="radio-card-text">
              <strong className="radio-card-title">{opt.label}</strong>
              {opt.description && <span className="radio-card-desc">{opt.description}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
