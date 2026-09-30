import React, { useRef } from 'react';
import { Save, Check, AlertCircle } from 'lucide-react';
import { TrackItem } from '../types';
import {
  AVAILABLE_TOKENS,
  DEFAULT_TEMPLATES,
  formatFileName,
  formatTrackTitle,
  SAMPLE_PREVIEW_TRACK,
  validateTemplate,
} from '../engine/templateEngine';

interface RenameTemplateCardProps {
  value: string;
  onChange: (template: string) => void;
  sampleTrack?: Partial<TrackItem>;
}

export const RenameTemplateCard: React.FC<RenameTemplateCardProps> = ({
  value,
  onChange,
  sampleTrack = SAMPLE_PREVIEW_TRACK,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const validation = validateTemplate(value);

  // Handle clicking a token chip: insert at cursor position
  const handleInsertToken = (tokenTag: string) => {
    const input = inputRef.current;
    if (!input) {
      // Append if no input ref
      const separator = value.trim().length > 0 && !value.trim().endsWith('-') ? ' - ' : ' ';
      onChange(`${value.trim()}${separator}${tokenTag}`);
      return;
    }

    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? value.length;
    const before = value.substring(0, start);
    const after = value.substring(end);

    const nextValue = `${before}${tokenTag}${after}`;
    onChange(nextValue);

    // Re-focus and position cursor right after the inserted token
    requestAnimationFrame(() => {
      input.focus();
      const newPos = start + tokenTag.length;
      input.setSelectionRange(newPos, newPos);
    });
  };

  // Example outputs computed live
  const exampleTitle = validation.isValid
    ? formatTrackTitle(sampleTrack, value)
    : '—';
  const exampleFileName = validation.isValid
    ? formatFileName(sampleTrack, value, 'mp3')
    : '—';

  return (
    <div className="rename-template-container">
      {/* Header with Save Icon */}
      <div className="rename-template-header">
        <div className="rename-template-icon-badge">
          <Save size={18} />
        </div>
        <div className="rename-template-titles">
          <div className="rename-template-title">Rename template</div>
          <div className="rename-template-subtitle">
            Formats Track Title tags and File Names across your library (FR-5.3)
          </div>
        </div>
      </div>

      {/* Quick Preset Selector Pill Row */}
      <div className="rename-template-presets">
        <span className="preset-label">Presets:</span>
        {DEFAULT_TEMPLATES.map((tmpl) => (
          <button
            key={tmpl.id}
            type="button"
            className={`preset-chip ${value === tmpl.pattern ? 'active' : ''}`}
            onClick={() => onChange(tmpl.pattern)}
            title={tmpl.description}
          >
            <span>{tmpl.name.split(' (')[0]}</span>
            {tmpl.id === 'minimal' && (
              <span style={{ marginLeft: '4px', fontSize: '0.72rem', opacity: 0.75, fontWeight: 500 }}>
                (Default)
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Main Template Input Box */}
      <div className="rename-template-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="rename-template-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="{Producer} - {Title}"
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      {/* Clickable Token Badges */}
      <div className="rename-template-tokens">
        {AVAILABLE_TOKENS.map((token) => (
          <button
            key={token.tag}
            type="button"
            className="token-badge-btn"
            onClick={() => handleInsertToken(token.tag)}
            title={`Click to insert ${token.tag} (${token.description})`}
          >
            {token.tag}
          </button>
        ))}
      </div>

      {/* Live Validation Indicator */}
      <div className="rename-template-validation">
        {validation.isValid ? (
          <div className="validation-status valid">
            <Check size={15} />
            <span>{validation.message}</span>
          </div>
        ) : (
          <div className="validation-status invalid">
            <AlertCircle size={15} />
            <span>{validation.message}</span>
          </div>
        )}
      </div>

      {/* Example Output Box */}
      <div className="rename-template-example-box">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <div className="example-box-label">EXAMPLE TRACK TITLE</div>
            <div className="example-box-value" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              {exampleTitle}
            </div>
          </div>
          <div>
            <div className="example-box-label">EXAMPLE FILE NAME</div>
            <div className="example-box-value">
              {exampleFileName}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
