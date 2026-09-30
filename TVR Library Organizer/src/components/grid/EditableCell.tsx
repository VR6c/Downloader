import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Star, Zap } from 'lucide-react';

interface CellEditInputProps {
  value: string;
  type?: string;
  onChange: (val: string) => void;
  onCommit: (forceSingle?: boolean) => void;
  onCancel: () => void;
  isBatch: boolean;
  batchCount: number;
  batchApply: boolean;
  onToggleBatchApply: () => void;
  colLabel: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export const CellEditInput: React.FC<CellEditInputProps> = React.memo(({
  value,
  type = 'text',
  onChange,
  onCommit,
  onCancel,
  isBatch,
  batchCount,
  batchApply,
  onToggleBatchApply,
  colLabel,
  inputRef,
}) => {
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; flipAbove: boolean } | null>(null);

  useEffect(() => {
    if (!isBatch || !inputRef.current) return;
    const updatePos = () => {
      if (!inputRef.current) return;
      const rect = inputRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const flipAbove = spaceBelow < 130 && rect.top > 130;
      setPopoverPos({
        top: flipAbove ? rect.top - 8 : rect.bottom + 6,
        left: Math.max(10, Math.min(rect.left, window.innerWidth - 320)),
        flipAbove,
      });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [isBatch, inputRef]);

  return (
    <div className="cell-edit-container">
      <input
        ref={inputRef}
        type={type}
        className="cell-edit-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            onCommit(e.altKey);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }
        }}
        onBlur={() => onCommit(false)}
        autoFocus
      />
      {isBatch &&
        popoverPos &&
        createPortal(
          <div
            className="batch-edit-popover"
            style={{
              position: 'fixed',
              top: popoverPos.flipAbove ? undefined : `${popoverPos.top}px`,
              bottom: popoverPos.flipAbove ? `${window.innerHeight - popoverPos.top}px` : undefined,
              left: `${popoverPos.left}px`,
              zIndex: 99999,
            }}
            onMouseDown={(e) => {
              // Prevent input blur when clicking popover controls
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div className="batch-edit-popover-header">
              <span className="batch-badge">
                <Zap size={10} fill="currentColor" /> BATCH EDIT
              </span>
              <span className="batch-count-text">
                <strong>{batchCount}</strong> tracks selected
              </span>
            </div>
            <label className="batch-apply-toggle" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={batchApply}
                onChange={onToggleBatchApply}
              />
              <span>
                Apply <strong>{colLabel}</strong> to all {batchCount} tracks
              </span>
            </label>
            <div className="batch-shortcuts-hint">
              <span>
                <kbd>Enter</kbd> {batchApply ? 'Apply All' : 'Apply Single'}
              </span>
              <span>
                <kbd>Alt+Enter</kbd> Single Only
              </span>
              <span>
                <kbd>Esc</kbd> Cancel
              </span>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
});

export interface EditableCellProps {
  trackId: string;
  colKey: string;
  colLabel: string;
  value: any;
  isEditing: boolean;
  isFocused: boolean;
  editValue: string;
  onEditChange: (val: string) => void;
  onStartEdit: (rowId: string, colKey: string, initialVal: any) => void;
  onFocus: (colKey: string) => void;
  onCommit: (forceSingle?: boolean) => void;
  onCancel: () => void;
  isBatch: boolean;
  batchCount: number;
  batchApply: boolean;
  onToggleBatchApply: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  fontMono?: boolean;
  textMuted?: boolean;
  titleTooltip?: string;
  renderDisplay?: (val: any) => React.ReactNode;
}

export const EditableCell: React.FC<EditableCellProps> = React.memo(
  ({
    trackId,
    colKey,
    colLabel,
    value,
    isEditing,
    isFocused,
    editValue,
    onEditChange,
    onStartEdit,
    onFocus,
    onCommit,
    onCancel,
    isBatch,
    batchCount,
    batchApply,
    onToggleBatchApply,
    inputRef,
    fontMono = false,
    textMuted = false,
    titleTooltip,
    renderDisplay,
  }) => {
    const displayValue = value != null && value !== '' ? String(value) : '';

    return (
      <td
        onDoubleClick={() => onStartEdit(trackId, colKey, value)}
        onClick={() => onFocus(colKey)}
        className={isFocused ? 'cell-focused' : ''}
        title={titleTooltip}
      >
        {isEditing ? (
          <CellEditInput
            inputRef={inputRef}
            value={editValue}
            onChange={onEditChange}
            onCommit={onCommit}
            onCancel={onCancel}
            isBatch={isBatch}
            batchCount={batchCount}
            batchApply={batchApply}
            onToggleBatchApply={onToggleBatchApply}
            colLabel={colLabel}
          />
        ) : renderDisplay ? (
          renderDisplay(value)
        ) : (
          <span
            style={{
              fontFamily: fontMono ? 'var(--font-mono)' : undefined,
              color: textMuted ? 'var(--text-secondary)' : undefined,
            }}
          >
            {displayValue || <span style={{ opacity: 0.35 }}>—</span>}
          </span>
        )}
      </td>
    );
  },
  (prev, next) => {
    if (prev.value !== next.value) return false;
    if (prev.isEditing !== next.isEditing) return false;
    if (prev.isFocused !== next.isFocused) return false;
    if (prev.titleTooltip !== next.titleTooltip) return false;
    if (prev.trackId !== next.trackId) return false;
    if (prev.colKey !== next.colKey) return false;
    if (prev.fontMono !== next.fontMono) return false;
    if (prev.textMuted !== next.textMuted) return false;

    // Only compare edit-specific props if either prev or next is editing
    if (prev.isEditing || next.isEditing) {
      if (prev.editValue !== next.editValue) return false;
      if (prev.isBatch !== next.isBatch) return false;
      if (prev.batchCount !== next.batchCount) return false;
      if (prev.batchApply !== next.batchApply) return false;
    }
    return true;
  }
);
