import React, { useState, useEffect } from 'react';
import { X, Edit3, Check, RefreshCw, Eraser, Star } from 'lucide-react';
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

const INITIAL_FIELDS = {
  title: '',
  artist: '',
  album: '',
  genre: '',
  year: '',
  albumArtist: '',
  trackNumber: '',
  tracksTotal: '',
  comments: '',
  mixVersion: '',
  rating: '',
};

const INITIAL_ENABLED = {
  title: false,
  artist: false,
  album: false,
  genre: false,
  year: false,
  albumArtist: false,
  trackNumber: false,
  tracksTotal: false,
  comments: false,
  mixVersion: false,
  rating: false,
};

export const BulkEditModal: React.FC<BulkEditModalProps> = ({
  isOpen,
  onClose,
  selectedIds,
  tracks,
  onApplyBulkEdit,
  onSyncNameAndTitle,
  onCleanAllFields,
}) => {
  const [fields, setFields] = useState(INITIAL_FIELDS);
  const [enabledFields, setEnabledFields] = useState<Record<string, boolean>>(INITIAL_ENABLED);

  // Reset fields when opened to prevent stale edits lingering from previous sessions
  useEffect(() => {
    if (isOpen) {
      setFields(INITIAL_FIELDS);
      setEnabledFields(INITIAL_ENABLED);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggle = (field: string) => {
    setEnabledFields((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleApply = () => {
    const updates: Partial<TrackItem> = {};
    if (enabledFields.artist && fields.artist) updates.cleanArtist = fields.artist;
    if (enabledFields.album && fields.album) updates.album = fields.album;
    if (enabledFields.genre && fields.genre) updates.genre = fields.genre;
    if (enabledFields.year && fields.year) updates.year = fields.year;
    if (enabledFields.albumArtist && fields.albumArtist) updates.albumArtist = fields.albumArtist;
    if (enabledFields.trackNumber && fields.trackNumber) updates.trackNumber = fields.trackNumber;
    if (enabledFields.tracksTotal && fields.tracksTotal) updates.tracksTotal = fields.tracksTotal;
    if (enabledFields.comments && fields.comments) updates.comments = fields.comments;
    if (enabledFields.mixVersion && fields.mixVersion) updates.mixVersion = fields.mixVersion;
    if (enabledFields.rating && fields.rating) updates.rating = parseInt(fields.rating, 10);

    onApplyBulkEdit(updates);
    onClose();
  };

  const hasAnyFieldEnabled = Object.values(enabledFields).some(Boolean);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" style={{ width: '560px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <Edit3 size={18} />
            </div>
            <div>
              <div className="modal-title">Bulk Edit Tags ({selectedIds.length} Selected)</div>
              <div className="modal-subtitle">Update metadata tags simultaneously across all selected rows</div>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          {/* Quick Actions: Sync and Clean All Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '18px' }}>
            {onSyncNameAndTitle && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  gap: '10px',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Sync
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Set FileName(Rename Template) to Title
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    onSyncNameAndTitle();
                    onClose();
                  }}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: 'var(--accent-primary)',
                    borderColor: 'var(--accent-primary)',
                    width: '100%',
                    justifyContent: 'center',
                  }}
                >
                  <RefreshCw size={14} style={{ marginRight: '6px' }} />
                  Sync
                </button>
              </div>
            )}

            {onCleanAllFields && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  gap: '10px',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Clean All Fields
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Wipes tags; keeps Name, Format, Bitrate, Duration, Size, Codec, Path
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    onCleanAllFields();
                    onClose();
                  }}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: 'var(--accent-primary)',
                    borderColor: 'var(--accent-primary)',
                    width: '100%',
                    justifyContent: 'center',
                  }}
                >
                  <Eraser size={14} style={{ marginRight: '6px' }} />
                  Clean All Fields
                </button>
              </div>
            )}
          </div>

          {/* Title Field (Disabled per specification: Title is managed by Rename Template & Sync) */}
          <div className="form-group" style={{ opacity: 0.65 }}>
            <label className="form-checkbox-row" style={{ cursor: 'not-allowed' }}>
              <input
                type="checkbox"
                checked={false}
                disabled={true}
              />
              <span className="form-label" style={{ margin: 0, color: 'var(--text-muted)' }}>
                Track Title (Disabled — Managed by Rename Template &amp; Sync)
              </span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="Title is set by Sync = FileName(Rename Template) To Title"
              disabled={true}
              style={{ opacity: 0.45, cursor: 'not-allowed' }}
            />
          </div>

          {/* Producer / Artist Field */}
          <div className="form-group">
            <label className="form-checkbox-row">
              <input
                type="checkbox"
                checked={enabledFields.artist}
                onChange={() => handleToggle('artist')}
              />
              <span className="form-label" style={{ margin: 0 }}>Set Producer</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Various Producers"
              value={fields.artist}
              onChange={(e) => setFields({ ...fields, artist: e.target.value })}
              disabled={!enabledFields.artist}
              style={{ opacity: enabledFields.artist ? 1 : 0.5 }}
            />
          </div>

          {/* Album Field */}
          <div className="form-group">
            <label className="form-checkbox-row">
              <input
                type="checkbox"
                checked={enabledFields.album}
                onChange={() => handleToggle('album')}
              />
              <span className="form-label" style={{ margin: 0 }}>Set Album</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. DJ Weapons 2026"
              value={fields.album}
              onChange={(e) => setFields({ ...fields, album: e.target.value })}
              disabled={!enabledFields.album}
              style={{ opacity: enabledFields.album ? 1 : 0.5 }}
            />
          </div>

          {/* Genre Field */}
          <div className="form-group">
            <label className="form-checkbox-row">
              <input
                type="checkbox"
                checked={enabledFields.genre}
                onChange={() => handleToggle('genre')}
              />
              <span className="form-label" style={{ margin: 0 }}>Set Genre</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Melodic Techno / House"
              value={fields.genre}
              onChange={(e) => setFields({ ...fields, genre: e.target.value })}
              disabled={!enabledFields.genre}
              style={{ opacity: enabledFields.genre ? 1 : 0.5 }}
            />
          </div>

          {/* Year Field */}
          <div className="form-group">
            <label className="form-checkbox-row">
              <input
                type="checkbox"
                checked={enabledFields.year}
                onChange={() => handleToggle('year')}
              />
              <span className="form-label" style={{ margin: 0 }}>Set Year</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. 2026"
              value={fields.year}
              onChange={(e) => setFields({ ...fields, year: e.target.value })}
              disabled={!enabledFields.year}
              style={{ opacity: enabledFields.year ? 1 : 0.5 }}
            />
          </div>

          {/* Album Artist Field */}
          <div className="form-group">
            <label className="form-checkbox-row">
              <input
                type="checkbox"
                checked={enabledFields.albumArtist}
                onChange={() => handleToggle('albumArtist')}
              />
              <span className="form-label" style={{ margin: 0 }}>Set Album Artist</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Main Producer / Collective"
              value={fields.albumArtist}
              onChange={(e) => setFields({ ...fields, albumArtist: e.target.value })}
              disabled={!enabledFields.albumArtist}
              style={{ opacity: enabledFields.albumArtist ? 1 : 0.5 }}
            />
          </div>

          {/* Track # & Tracks Total Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-checkbox-row">
                <input
                  type="checkbox"
                  checked={enabledFields.trackNumber}
                  onChange={() => handleToggle('trackNumber')}
                />
                <span className="form-label" style={{ margin: 0 }}>Set Track #</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 01"
                value={fields.trackNumber}
                onChange={(e) => setFields({ ...fields, trackNumber: e.target.value })}
                disabled={!enabledFields.trackNumber}
                style={{ opacity: enabledFields.trackNumber ? 1 : 0.5 }}
              />
            </div>

            <div className="form-group">
              <label className="form-checkbox-row">
                <input
                  type="checkbox"
                  checked={enabledFields.tracksTotal}
                  onChange={() => handleToggle('tracksTotal')}
                />
                <span className="form-label" style={{ margin: 0 }}>Set Tracks Total</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 12"
                value={fields.tracksTotal}
                onChange={(e) => setFields({ ...fields, tracksTotal: e.target.value })}
                disabled={!enabledFields.tracksTotal}
                style={{ opacity: enabledFields.tracksTotal ? 1 : 0.5 }}
              />
            </div>
          </div>

          {/* Comment Field */}
          <div className="form-group">
            <label className="form-checkbox-row">
              <input
                type="checkbox"
                checked={enabledFields.comments}
                onChange={() => handleToggle('comments')}
              />
              <span className="form-label" style={{ margin: 0 }}>Set Comment</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Rekordbox Clean Tagged"
              value={fields.comments}
              onChange={(e) => setFields({ ...fields, comments: e.target.value })}
              disabled={!enabledFields.comments}
              style={{ opacity: enabledFields.comments ? 1 : 0.5 }}
            />
          </div>

          {/* Mix / Version Field */}
          <div className="form-group">
            <label className="form-checkbox-row">
              <input
                type="checkbox"
                checked={enabledFields.mixVersion}
                onChange={() => handleToggle('mixVersion')}
              />
              <span className="form-label" style={{ margin: 0 }}>Set Mix / Version</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Extended Mix"
              value={fields.mixVersion}
              onChange={(e) => setFields({ ...fields, mixVersion: e.target.value })}
              disabled={!enabledFields.mixVersion}
              style={{ opacity: enabledFields.mixVersion ? 1 : 0.5 }}
            />
          </div>

          {/* Rating Field */}
          <div className="form-group">
            <label className="form-checkbox-row">
              <input
                type="checkbox"
                checked={enabledFields.rating}
                onChange={() => handleToggle('rating')}
              />
              <span className="form-label" style={{ margin: 0 }}>Set Star Rating</span>
            </label>
            <SelectDropdown
              value={fields.rating}
              onChange={(val) => setFields({ ...fields, rating: val })}
              options={[
                { value: '5', label: '5 Stars - Prime Peak Time', icon: <Star size={13} fill="#F59E0B" color="#F59E0B" /> },
                { value: '4', label: '4 Stars - High Energy', icon: <Star size={13} fill="#F59E0B" color="#F59E0B" /> },
                { value: '3', label: '3 Stars - Warmup / Builder', icon: <Star size={13} fill="#F59E0B" color="#F59E0B" /> },
                { value: '2', label: '2 Stars - Transition', icon: <Star size={13} fill="#F59E0B" color="#F59E0B" /> },
                { value: '1', label: '1 Star - Intro / Ambient', icon: <Star size={13} fill="#F59E0B" color="#F59E0B" /> },
              ]}
              disabled={!enabledFields.rating}
              variant="form"
              size="md"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleApply}
            disabled={!hasAnyFieldEnabled}
            style={{ opacity: hasAnyFieldEnabled ? 1 : 0.6 }}
          >
            <Check size={15} />
            <span>Apply to {selectedIds.length} Tracks</span>
          </button>
        </div>
      </div>
    </div>
  );
};
