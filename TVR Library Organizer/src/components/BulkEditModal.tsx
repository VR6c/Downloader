import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Edit3, Check, RefreshCw, Eraser, Star } from 'lucide-react';
import { TrackItem } from '../types';
import { SelectDropdown } from './SelectDropdown';

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  tracks: TrackItem[];
  onApplyBulkEdit: (updates: Partial<TrackItem>) => void;
  onSyncNameAndTitle?: () => void;
  onCleanAllFields?: () => void;
}

type TextFieldKey =
  | 'artist'
  | 'album'
  | 'genre'
  | 'year'
  | 'albumArtist'
  | 'trackNumber'
  | 'tracksTotal'
  | 'comments'
  | 'mixVersion';
type FieldKey = TextFieldKey | 'rating';

interface TextFieldDef {
  key: TextFieldKey;
  label: string;
  placeholder: string;
  /** TrackItem property this field writes to. */
  target: keyof TrackItem;
}

const FIELD_DEFS: Record<TextFieldKey, TextFieldDef> = {
  artist: { key: 'artist', label: 'Set Producer', placeholder: 'e.g. Various Producers', target: 'cleanArtist' },
  album: { key: 'album', label: 'Set Album', placeholder: 'e.g. DJ Weapons 2026', target: 'album' },
  genre: { key: 'genre', label: 'Set Genre', placeholder: 'e.g. Melodic Techno / House', target: 'genre' },
  year: { key: 'year', label: 'Set Year', placeholder: 'e.g. 2026', target: 'year' },
  albumArtist: {
    key: 'albumArtist',
    label: 'Set Album Artist',
    placeholder: 'e.g. Main Producer / Collective',
    target: 'albumArtist',
  },
  trackNumber: { key: 'trackNumber', label: 'Set Track #', placeholder: 'e.g. 01', target: 'trackNumber' },
  tracksTotal: { key: 'tracksTotal', label: 'Set Tracks Total', placeholder: 'e.g. 12', target: 'tracksTotal' },
  comments: { key: 'comments', label: 'Set Comment', placeholder: 'e.g. Rekordbox Clean Tagged', target: 'comments' },
  mixVersion: { key: 'mixVersion', label: 'Set Mix / Version', placeholder: 'e.g. Extended Mix', target: 'mixVersion' },
};

// Render order; nested arrays share a row.
const LAYOUT: (TextFieldKey | TextFieldKey[])[] = [
  'artist',
  'album',
  'genre',
  'year',
  'albumArtist',
  ['trackNumber', 'tracksTotal'],
  'comments',
  'mixVersion',
];

const RATING_OPTIONS = [
  { value: '5', label: '5 Stars - Prime Peak Time' },
  { value: '4', label: '4 Stars - High Energy' },
  { value: '3', label: '3 Stars - Warmup / Builder' },
  { value: '2', label: '2 Stars - Transition' },
  { value: '1', label: '1 Star - Intro / Ambient' },
].map((o) => ({ ...o, icon: <Star size={13} fill="#F59E0B" color="#F59E0B" /> }));

const ALL_KEYS: FieldKey[] = [...(Object.keys(FIELD_DEFS) as TextFieldKey[]), 'rating'];
const INITIAL_FIELDS = Object.fromEntries(ALL_KEYS.map((k) => [k, ''])) as Record<FieldKey, string>;
const INITIAL_ENABLED = Object.fromEntries(ALL_KEYS.map((k) => [k, false])) as Record<FieldKey, boolean>;

interface QuickActionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onRun: () => void;
}

const QuickAction: React.FC<QuickActionProps> = ({ title, description, icon, onRun }) => (
  <div className="bulk-action-card">
    <div>
      <div className="bulk-action-title">{title}</div>
      <div className="bulk-action-desc">{description}</div>
    </div>
    <button type="button" className="btn-secondary bulk-action-btn" onClick={onRun}>
      {icon}
      {title}
    </button>
  </div>
);

interface ToggleFieldProps {
  label: string;
  enabled: boolean;
  onToggle: () => void;
  children: (disabled: boolean) => React.ReactNode;
}

/** A form row whose input is only editable (and applied) once its checkbox is ticked. */
const ToggleField: React.FC<ToggleFieldProps> = ({ label, enabled, onToggle, children }) => (
  <div className="form-group">
    <label className="form-checkbox-row">
      <input type="checkbox" checked={enabled} onChange={onToggle} />
      <span className="form-label form-label--inline">{label}</span>
    </label>
    {children(!enabled)}
  </div>
);

export const BulkEditModal: React.FC<BulkEditModalProps> = ({
  isOpen,
  onClose,
  selectedIds,
  onApplyBulkEdit,
  onSyncNameAndTitle,
  onCleanAllFields,
}) => {
  const [fields, setFields] = useState(INITIAL_FIELDS);
  const [enabled, setEnabled] = useState(INITIAL_ENABLED);

  // Reset when opened so stale edits from a previous session never linger
  useEffect(() => {
    if (isOpen) {
      setFields(INITIAL_FIELDS);
      setEnabled(INITIAL_ENABLED);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggle = (key: FieldKey) => setEnabled((prev) => ({ ...prev, [key]: !prev[key] }));
  const setField = (key: FieldKey, value: string) => setFields((prev) => ({ ...prev, [key]: value }));
  const hasAnyFieldEnabled = ALL_KEYS.some((k) => enabled[k]);

  const handleApply = () => {
    const updates: Record<string, unknown> = {};
    (Object.keys(FIELD_DEFS) as TextFieldKey[]).forEach((key) => {
      if (enabled[key]) updates[FIELD_DEFS[key].target] = fields[key];
    });
    if (enabled.rating) updates.rating = fields.rating ? parseInt(fields.rating, 10) : 0;

    onApplyBulkEdit(updates as Partial<TrackItem>);
    onClose();
  };

  const runAndClose = (action: () => void) => () => {
    action();
    onClose();
  };

  const renderTextField = (key: TextFieldKey) => {
    const def = FIELD_DEFS[key];
    return (
      <ToggleField key={key} label={def.label} enabled={enabled[key]} onToggle={() => toggle(key)}>
        {(disabled) => (
          <input
            type="text"
            className="form-input bulk-input"
            aria-label={def.label}
            placeholder={def.placeholder}
            value={fields[key]}
            onChange={(e) => setField(key, e.target.value)}
            disabled={disabled}
          />
        )}
      </ToggleField>
    );
  };

  return (
    <Modal
      onClose={onClose}
      title={`Bulk Edit Tags (${selectedIds.length} Selected)`}
      subtitle="Update metadata tags simultaneously across all selected rows"
      icon={<Edit3 size={18} />}
      width={560}
    >
      <div className="modal-body modal-body--scroll">
        {(onSyncNameAndTitle || onCleanAllFields) && (
          <div className="bulk-action-grid">
            {onSyncNameAndTitle && (
              <QuickAction
                title="Sync"
                description="Set FileName(Rename Template) to Title"
                icon={<RefreshCw size={14} />}
                onRun={runAndClose(onSyncNameAndTitle)}
              />
            )}
            {onCleanAllFields && (
              <QuickAction
                title="Clean All Fields"
                description="Wipes tags; keeps Name, Format, Bitrate, Duration, Size, Codec, Path"
                icon={<Eraser size={14} />}
                onRun={runAndClose(onCleanAllFields)}
              />
            )}
          </div>
        )}

        {/* Title is managed by the Rename Template & Sync, so it is intentionally not editable here */}
        <div className="form-group is-disabled">
          <label className="form-checkbox-row">
            <input type="checkbox" checked={false} disabled />
            <span className="form-label form-label--inline form-label--muted">
              Track Title (Disabled — Managed by Rename Template &amp; Sync)
            </span>
          </label>
          <input
            type="text"
            className="form-input bulk-input"
            aria-label="Track title (managed by rename template and sync)"
            placeholder="Title is set by Sync = FileName(Rename Template) To Title"
            disabled
          />
        </div>

        {LAYOUT.map((item) =>
          Array.isArray(item) ? (
            <div key={item.join('-')} className="form-row-2">
              {item.map(renderTextField)}
            </div>
          ) : (
            renderTextField(item)
          )
        )}

        <ToggleField label="Set Star Rating" enabled={enabled.rating} onToggle={() => toggle('rating')}>
          {(disabled) => (
            <SelectDropdown
              ariaLabel="Star rating"
              value={fields.rating}
              onChange={(val) => setField('rating', val)}
              options={RATING_OPTIONS}
              disabled={disabled}
              variant="form"
              size="md"
            />
          )}
        </ToggleField>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn-primary" onClick={handleApply} disabled={!hasAnyFieldEnabled}>
          <Check size={15} />
          <span>Apply to {selectedIds.length} Tracks</span>
        </button>
      </div>
    </Modal>
  );
};
