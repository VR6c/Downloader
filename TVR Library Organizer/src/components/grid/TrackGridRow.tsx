import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Star,
} from 'lucide-react';
import { TrackItem, ViewPreset } from '../../types';
import { CAMELOT_COLORS } from '../../engine/camelot';
import { EditableCell } from './EditableCell';

interface TrackGridRowProps {
  track: TrackItem;
  rowIndex: number;
  preset: ViewPreset;
  isSelected: boolean;
  focusedColKey: string | null;
  editingColKey: string | null;
  editValue: string;
  batchApply: boolean;
  selectedCount: number;
  onRowClick: (trackId: string, index: number, e: React.MouseEvent) => void;
  onSelectToggle: (trackId: string, selected: boolean) => void;
  onFocusCell: (rowIndex: number, colKey: string) => void;
  onStartEdit: (rowId: string, colKey: string, initialVal: any) => void;
  onCommitEdit: (forceSingle?: boolean) => void;
  onCancelEdit: () => void;
  onEditValueChange: (val: string) => void;
  onToggleBatchApply: () => void;
  onArtworkClick?: (trackId: string) => void;
  onUpdateTrack: (id: string, updates: Partial<TrackItem>) => void;
  editInputRef: React.RefObject<HTMLInputElement | null>;
}

const formatDuration = (sec: number) => {
  const mins = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${mins}:${s < 10 ? '0' : ''}${s}`;
};

const formatFileSize = (bytes: number) => {
  if (!bytes) return '0 MB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export const TrackGridRow: React.FC<TrackGridRowProps> = React.memo(
  ({
    track,
    rowIndex,
    preset,
    isSelected,
    focusedColKey,
    editingColKey,
    editValue,
    batchApply,
    selectedCount,
    onRowClick,
    onSelectToggle,
    onFocusCell,
    onStartEdit,
    onCommitEdit,
    onCancelEdit,
    onEditValueChange,
    onToggleBatchApply,
    onArtworkClick,
    onUpdateTrack,
    editInputRef,
  }) => {
    const hasError = track.status === 'error';
    const camelotNum = track.camelotKey
      ? parseInt(track.camelotKey.replace(/[^0-9]/g, ''), 10)
      : null;
    const camelotColor = camelotNum
      ? CAMELOT_COLORS[camelotNum] || 'var(--accent-primary)'
      : 'var(--text-muted)';

    const isMultiSelected = isSelected && selectedCount > 1;

    const handleCellFocus = React.useCallback(
      (key: string) => {
        onFocusCell(rowIndex, key);
      },
      [onFocusCell, rowIndex]
    );

    return (
      <tr
        className={`
          ${isSelected ? 'row-selected' : ''}
          ${hasError ? 'row-has-error' : ''}
        `}
        onClick={(e) => onRowClick(track.id, rowIndex, e)}
        title={hasError ? `Error: ${track.errorMessage || 'Failed to rename or save'}` : undefined}
      >
        {/* Select Checkbox */}
        <td className="col-select" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            title="Select track to save or edit"
            onChange={(e) => onSelectToggle(track.id, e.target.checked)}
          />
        </td>

        {/* Row Number */}
        <td className="col-num">{rowIndex + 1}</td>

        {/* DJ PERFORMANCE VIEW CELLS */}
        {preset === 'dj' && (
          <>
            {/* Title (Read-only: managed via Rename Template & Sync) */}
            <td
              onClick={() => handleCellFocus('cleanTitle')}
              className={focusedColKey === 'cleanTitle' ? 'cell-focused' : ''}
              title="Track Title (Managed via Rename Template & Sync)"
            >
              <span style={{ fontWeight: 600 }}>
                {track.cleanTitle || <span style={{ opacity: 0.35 }}>—</span>}
              </span>
            </td>

            {/* Producer / Artist */}
            <EditableCell
              trackId={track.id}
              colKey="cleanArtist"
              colLabel="Producer / Artist"
              value={track.cleanArtist}
              isEditing={editingColKey === 'cleanArtist'}
              isFocused={focusedColKey === 'cleanArtist'}
              editValue={editValue}
              onEditChange={onEditValueChange}
              onStartEdit={onStartEdit}
              onFocus={handleCellFocus}
              onCommit={onCommitEdit}
              onCancel={onCancelEdit}
              isBatch={isMultiSelected}
              batchCount={selectedCount}
              batchApply={batchApply}
              onToggleBatchApply={onToggleBatchApply}
              inputRef={editInputRef}
            />

            {/* Mix / Version */}
            <EditableCell
              trackId={track.id}
              colKey="mixVersion"
              colLabel="Mix / Version"
              value={track.mixVersion}
              isEditing={editingColKey === 'mixVersion'}
              isFocused={focusedColKey === 'mixVersion'}
              editValue={editValue}
              onEditChange={onEditValueChange}
              onStartEdit={onStartEdit}
              onFocus={handleCellFocus}
              onCommit={onCommitEdit}
              onCancel={onCancelEdit}
              isBatch={isMultiSelected}
              batchCount={selectedCount}
              batchApply={batchApply}
              onToggleBatchApply={onToggleBatchApply}
              inputRef={editInputRef}
            />

            {/* BPM */}
            <EditableCell
              trackId={track.id}
              colKey="bpm"
              colLabel="BPM"
              value={track.bpm}
              isEditing={editingColKey === 'bpm'}
              isFocused={focusedColKey === 'bpm'}
              editValue={editValue}
              onEditChange={onEditValueChange}
              onStartEdit={onStartEdit}
              onFocus={handleCellFocus}
              onCommit={onCommitEdit}
              onCancel={onCancelEdit}
              isBatch={isMultiSelected}
              batchCount={selectedCount}
              batchApply={batchApply}
              onToggleBatchApply={onToggleBatchApply}
              inputRef={editInputRef}
              fontMono
              renderDisplay={(bpmVal) =>
                bpmVal ? (
                  <span className="bpm-badge">{bpmVal}</span>
                ) : (
                  <span style={{ opacity: 0.35 }}>—</span>
                )
              }
            />

            {/* Camelot Key */}
            <EditableCell
              trackId={track.id}
              colKey="camelotKey"
              colLabel="Camelot Key"
              value={track.camelotKey}
              isEditing={editingColKey === 'camelotKey'}
              isFocused={focusedColKey === 'camelotKey'}
              editValue={editValue}
              onEditChange={onEditValueChange}
              onStartEdit={onStartEdit}
              onFocus={handleCellFocus}
              onCommit={onCommitEdit}
              onCancel={onCancelEdit}
              isBatch={isMultiSelected}
              batchCount={selectedCount}
              batchApply={batchApply}
              onToggleBatchApply={onToggleBatchApply}
              inputRef={editInputRef}
              renderDisplay={(cKey) =>
                cKey ? (
                  <span className="camelot-badge" style={{ backgroundColor: camelotColor }}>
                    {cKey}
                  </span>
                ) : (
                  <span style={{ opacity: 0.35 }}>—</span>
                )
              }
            />

            {/* Musical Key */}
            <EditableCell
              trackId={track.id}
              colKey="standardKey"
              colLabel="Musical Key"
              value={track.standardKey}
              isEditing={editingColKey === 'standardKey'}
              isFocused={focusedColKey === 'standardKey'}
              editValue={editValue}
              onEditChange={onEditValueChange}
              onStartEdit={onStartEdit}
              onFocus={handleCellFocus}
              onCommit={onCommitEdit}
              onCancel={onCancelEdit}
              isBatch={isMultiSelected}
              batchCount={selectedCount}
              batchApply={batchApply}
              onToggleBatchApply={onToggleBatchApply}
              inputRef={editInputRef}
            />

            {/* Genre */}
            <EditableCell
              trackId={track.id}
              colKey="genre"
              colLabel="Genre"
              value={track.genre}
              isEditing={editingColKey === 'genre'}
              isFocused={focusedColKey === 'genre'}
              editValue={editValue}
              onEditChange={onEditValueChange}
              onStartEdit={onStartEdit}
              onFocus={handleCellFocus}
              onCommit={onCommitEdit}
              onCancel={onCancelEdit}
              isBatch={isMultiSelected}
              batchCount={selectedCount}
              batchApply={batchApply}
              onToggleBatchApply={onToggleBatchApply}
              inputRef={editInputRef}
            />

            {/* Rating */}
            <EditableCell
              trackId={track.id}
              colKey="rating"
              colLabel="Star Rating"
              value={track.rating}
              isEditing={editingColKey === 'rating'}
              isFocused={focusedColKey === 'rating'}
              editValue={editValue}
              onEditChange={onEditValueChange}
              onStartEdit={onStartEdit}
              onFocus={handleCellFocus}
              onCommit={onCommitEdit}
              onCancel={onCancelEdit}
              isBatch={isMultiSelected}
              batchCount={selectedCount}
              batchApply={batchApply}
              onToggleBatchApply={onToggleBatchApply}
              inputRef={editInputRef}
              renderDisplay={(ratingVal) => (
                <div
                  className="rating-stars"
                  onClick={(e) => e.stopPropagation()}
                  title={`Star Rating: ${ratingVal || 0}/5`}
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className={`rating-star ${star <= (ratingVal || 0) ? 'filled' : ''}`}
                      onClick={() => onUpdateTrack(track.id, { rating: star === ratingVal ? 0 : star })}
                    >
                      <Star
                        size={12}
                        fill={star <= (ratingVal || 0) ? 'currentColor' : 'none'}
                        strokeWidth={star <= (ratingVal || 0) ? 0 : 1.5}
                      />
                    </span>
                  ))}
                </div>
              )}
            />
          </>
        )}

        {/* TECHNICAL AUDIO VIEW CELLS */}
        {preset === 'technical' && (
          <>
            <td
              onClick={() => handleCellFocus('cleanTitle')}
              className={focusedColKey === 'cleanTitle' ? 'cell-focused' : ''}
              title={track.cleanTitle}
            >
              <span style={{ fontWeight: 600 }}>
                {track.cleanTitle || <span style={{ opacity: 0.35 }}>—</span>}
              </span>
            </td>

            <td>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{track.bitrate} kbps</span>
            </td>

            <td>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{track.sampleRate} Hz</span>
            </td>

            <td>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{track.bitDepth}-bit</span>
            </td>

            <td>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{formatDuration(track.duration)}</span>
            </td>

            <td>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{formatFileSize(track.fileSize)}</span>
            </td>

            <td>
              <span className="format-pill">{track.fileFormat?.toUpperCase()}</span>
            </td>

            <td>
              {track.isQualityWarning ? (
                <span className="quality-badge-danger" title={track.qualityIssues?.join(', ') || 'Quality Warning'}>
                  <AlertTriangle size={11} />
                  <span>Low Quality</span>
                </span>
              ) : (
                <span className="quality-badge-ok">
                  <CheckCircle2 size={11} />
                  <span>Studio Grade</span>
                </span>
              )}
            </td>

            <td title={track.filePath}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', fontFamily: 'var(--font-mono)' }}>
                {track.filePath || 'Web Virtual Stream'}
              </span>
            </td>
          </>
        )}

        {/* ID3 TAG EDITOR VIEW CELLS */}
        {preset === 'id3' && (
          <>
            {/* Artwork thumbnail */}
            <td className="col-artwork" onClick={(e) => e.stopPropagation()}>
              <div
                className="artwork-cell-preview"
                onClick={() => onArtworkClick && onArtworkClick(track.id)}
                title={track.artworkUrl ? 'Click to replace album artwork' : 'Click to add album artwork (PNG/JPG)'}
              >
                {track.artworkUrl ? (
                  <img
                    src={track.artworkUrl}
                    alt="Album Art"
                    loading="lazy"
                    decoding="async"
                    className="artwork-thumb-img"
                  />
                ) : (
                  <div className="artwork-thumb-empty">
                    <ImageIcon size={14} />
                  </div>
                )}
              </div>
            </td>

            {/* Title (Read-only per specification: Title is synced with Rename Template) */}
            <td
              onClick={() => handleCellFocus('cleanTitle')}
              className={focusedColKey === 'cleanTitle' ? 'cell-focused' : ''}
              title="Track Title (Managed via Rename Template & Sync)"
            >
              <span style={{ fontWeight: 600 }}>
                {track.cleanTitle || <span style={{ opacity: 0.35 }}>—</span>}
              </span>
            </td>

            {/* Target File Name */}
            <EditableCell
              trackId={track.id}
              colKey="targetFileName"
              colLabel="File Name"
              value={track.targetFileName || track.originalFileName}
              isEditing={editingColKey === 'targetFileName'}
              isFocused={focusedColKey === 'targetFileName'}
              editValue={editValue}
              onEditChange={onEditValueChange}
              onStartEdit={onStartEdit}
              onFocus={handleCellFocus}
              onCommit={onCommitEdit}
              onCancel={onCancelEdit}
              isBatch={isMultiSelected}
              batchCount={selectedCount}
              batchApply={batchApply}
              onToggleBatchApply={onToggleBatchApply}
              inputRef={editInputRef}
              fontMono
              renderDisplay={(nameVal) => (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: track.customTargetFileName ? 'var(--accent-primary)' : 'var(--text-primary)',
                    fontWeight: track.customTargetFileName ? 600 : 400,
                  }}
                  title={track.customTargetFileName ? 'Custom manual file name' : 'Generated from template'}
                >
                  {String(nameVal || track.originalFileName || '').replace(/\.[a-zA-Z0-9]+$/, '')}
                </span>
              )}
            />

            {/* Producer / Artist */}
            <EditableCell
              trackId={track.id}
              colKey="cleanArtist"
              colLabel="Producer / Artist"
              value={track.cleanArtist}
              isEditing={editingColKey === 'cleanArtist'}
              isFocused={focusedColKey === 'cleanArtist'}
              editValue={editValue}
              onEditChange={onEditValueChange}
              onStartEdit={onStartEdit}
              onFocus={handleCellFocus}
              onCommit={onCommitEdit}
              onCancel={onCancelEdit}
              isBatch={isMultiSelected}
              batchCount={selectedCount}
              batchApply={batchApply}
              onToggleBatchApply={onToggleBatchApply}
              inputRef={editInputRef}
            />

            {/* Album */}
            <EditableCell
              trackId={track.id}
              colKey="album"
              colLabel="Album"
              value={track.album}
              isEditing={editingColKey === 'album'}
              isFocused={focusedColKey === 'album'}
              editValue={editValue}
              onEditChange={onEditValueChange}
              onStartEdit={onStartEdit}
              onFocus={handleCellFocus}
              onCommit={onCommitEdit}
              onCancel={onCancelEdit}
              isBatch={isMultiSelected}
              batchCount={selectedCount}
              batchApply={batchApply}
              onToggleBatchApply={onToggleBatchApply}
              inputRef={editInputRef}
              textMuted
            />

            {/* Genre */}
            <EditableCell
              trackId={track.id}
              colKey="genre"
              colLabel="Genre"
              value={track.genre}
              isEditing={editingColKey === 'genre'}
              isFocused={focusedColKey === 'genre'}
              editValue={editValue}
              onEditChange={onEditValueChange}
              onStartEdit={onStartEdit}
              onFocus={handleCellFocus}
              onCommit={onCommitEdit}
              onCancel={onCancelEdit}
              isBatch={isMultiSelected}
              batchCount={selectedCount}
              batchApply={batchApply}
              onToggleBatchApply={onToggleBatchApply}
              inputRef={editInputRef}
            />

            {/* Year */}
            <EditableCell
              trackId={track.id}
              colKey="year"
              colLabel="Year"
              value={track.year}
              isEditing={editingColKey === 'year'}
              isFocused={focusedColKey === 'year'}
              editValue={editValue}
              onEditChange={onEditValueChange}
              onStartEdit={onStartEdit}
              onFocus={handleCellFocus}
              onCommit={onCommitEdit}
              onCancel={onCancelEdit}
              isBatch={isMultiSelected}
              batchCount={selectedCount}
              batchApply={batchApply}
              onToggleBatchApply={onToggleBatchApply}
              inputRef={editInputRef}
              fontMono
            />

            {/* Album Artist */}
            <EditableCell
              trackId={track.id}
              colKey="albumArtist"
              colLabel="Album Artist"
              value={track.albumArtist}
              isEditing={editingColKey === 'albumArtist'}
              isFocused={focusedColKey === 'albumArtist'}
              editValue={editValue}
              onEditChange={onEditValueChange}
              onStartEdit={onStartEdit}
              onFocus={handleCellFocus}
              onCommit={onCommitEdit}
              onCancel={onCancelEdit}
              isBatch={isMultiSelected}
              batchCount={selectedCount}
              batchApply={batchApply}
              onToggleBatchApply={onToggleBatchApply}
              inputRef={editInputRef}
              textMuted
            />

            {/* Track # */}
            <EditableCell
              trackId={track.id}
              colKey="trackNumber"
              colLabel="Track #"
              value={track.trackNumber}
              isEditing={editingColKey === 'trackNumber'}
              isFocused={focusedColKey === 'trackNumber'}
              editValue={editValue}
              onEditChange={onEditValueChange}
              onStartEdit={onStartEdit}
              onFocus={handleCellFocus}
              onCommit={onCommitEdit}
              onCancel={onCancelEdit}
              isBatch={isMultiSelected}
              batchCount={selectedCount}
              batchApply={batchApply}
              onToggleBatchApply={onToggleBatchApply}
              inputRef={editInputRef}
              fontMono
            />

            {/* Tracks Total */}
            <EditableCell
              trackId={track.id}
              colKey="tracksTotal"
              colLabel="Tracks Total"
              value={track.tracksTotal}
              isEditing={editingColKey === 'tracksTotal'}
              isFocused={focusedColKey === 'tracksTotal'}
              editValue={editValue}
              onEditChange={onEditValueChange}
              onStartEdit={onStartEdit}
              onFocus={handleCellFocus}
              onCommit={onCommitEdit}
              onCancel={onCancelEdit}
              isBatch={isMultiSelected}
              batchCount={selectedCount}
              batchApply={batchApply}
              onToggleBatchApply={onToggleBatchApply}
              inputRef={editInputRef}
              fontMono
            />

            {/* Comment */}
            <EditableCell
              trackId={track.id}
              colKey="comments"
              colLabel="Comment"
              value={track.comments}
              isEditing={editingColKey === 'comments'}
              isFocused={focusedColKey === 'comments'}
              editValue={editValue}
              onEditChange={onEditValueChange}
              onStartEdit={onStartEdit}
              onFocus={handleCellFocus}
              onCommit={onCommitEdit}
              onCancel={onCancelEdit}
              isBatch={isMultiSelected}
              batchCount={selectedCount}
              batchApply={batchApply}
              onToggleBatchApply={onToggleBatchApply}
              inputRef={editInputRef}
              textMuted
            />

            {/* Tag Format */}
            <td>
              <span className="format-pill" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                {track.tagFormat || 'ID3v2.3.0'}
              </span>
            </td>
          </>
        )}
      </tr>
    );
  },
  (prev, next) => {
    if (prev.track !== next.track) return false;
    if (prev.rowIndex !== next.rowIndex) return false;
    if (prev.preset !== next.preset) return false;
    if (prev.isSelected !== next.isSelected) return false;
    if (prev.focusedColKey !== next.focusedColKey) return false;
    if (prev.editingColKey !== next.editingColKey) return false;

    // Only compare edit-specific props if this row was editing or is editing
    if (prev.editingColKey !== null || next.editingColKey !== null) {
      if (prev.editValue !== next.editValue) return false;
      if (prev.batchApply !== next.batchApply) return false;
      if (prev.selectedCount !== next.selectedCount) return false;
    }
    return true;
  }
);
