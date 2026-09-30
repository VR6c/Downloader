import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle, X, Check } from 'lucide-react';
import { TrackItem, ViewPreset } from '../types';
import { COLUMN_LABELS, NON_EDITABLE_COLUMNS, TrackGridProps } from './grid/types';
import { TrackGridHeader } from './grid/TrackGridHeader';
import { TrackGridRow } from './grid/TrackGridRow';
import { TrackGridFooter } from './grid/TrackGridFooter';
import { Button } from './ui';

const ROW_HEIGHT = 40;
const OVERSCAN = 12;

export const TrackGrid: React.FC<TrackGridProps> = ({
  tracks,
  preset,
  onUpdateTrack,
  onBatchUpdateTracks,
  onSelectionChange,
  onPasteData,
  onCopySelected,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  // Artwork file upload
  const artworkInputRef = useRef<HTMLInputElement>(null);
  const [artworkUploadTrackId, setArtworkUploadTrackId] = useState<string | null>(null);

  // Active focused cell for spreadsheet navigation
  const [focusedCell, setFocusedCell] = useState<{ row: number; colKey: string } | null>(null);

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ rowId: string; colKey: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [initialEditValue, setInitialEditValue] = useState<string>('');
  const [batchApply, setBatchApply] = useState<boolean>(true);
  const [pendingBatchConfirm, setPendingBatchConfirm] = useState<{
    ids: string[];
    updates: Partial<TrackItem>;
    colLabel: string;
    value: string;
    count: number;
  } | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Sorting
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const containerRef = useRef<HTMLDivElement>(null);

  // Virtual scrolling state
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  // Stable references for high-frequency callbacks
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const lastSelectedIndexRef = useRef(lastSelectedIndex);
  lastSelectedIndexRef.current = lastSelectedIndex;
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const editingCellRef = useRef(editingCell);
  editingCellRef.current = editingCell;
  const editValueRef = useRef(editValue);
  editValueRef.current = editValue;
  const initialEditValueRef = useRef(initialEditValue);
  initialEditValueRef.current = initialEditValue;
  const batchApplyRef = useRef(batchApply);
  batchApplyRef.current = batchApply;
  const artworkUploadTrackIdRef = useRef(artworkUploadTrackId);
  artworkUploadTrackIdRef.current = artworkUploadTrackId;
  const onUpdateTrackRef = useRef(onUpdateTrack);
  onUpdateTrackRef.current = onUpdateTrack;
  const onBatchUpdateTracksRef = useRef(onBatchUpdateTracks);
  onBatchUpdateTracksRef.current = onBatchUpdateTracks;

  // Sync selection to parent
  useEffect(() => {
    onSelectionChange(Array.from(selectedIds));
  }, [selectedIds, onSelectionChange]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // Virtual scroll listener and container height observation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setViewportHeight(container.clientHeight || 600);

    let rafId: number | null = null;
    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        if (containerRef.current) {
          setScrollTop(containerRef.current.scrollTop);
        }
        rafId = null;
      });
    };

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewportHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(container);
    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      container.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleArtworkClick = useCallback((trackId: string) => {
    setArtworkUploadTrackId(trackId);
    if (artworkInputRef.current) {
      artworkInputRef.current.value = '';
      artworkInputRef.current.click();
    }
  }, []);

  const handleArtworkFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const uploadId = artworkUploadTrackIdRef.current;
      const currentSelected = selectedIdsRef.current;
      if (e.target.files && e.target.files[0] && uploadId) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            const dataUrl = reader.result;
            if (currentSelected.has(uploadId) && currentSelected.size > 1) {
              if (onBatchUpdateTracksRef.current) {
                onBatchUpdateTracksRef.current(
                  Array.from(currentSelected),
                  { artworkUrl: dataUrl },
                  `Applied album artwork to ${currentSelected.size} selected tracks.`
                );
              } else {
                currentSelected.forEach((id) => onUpdateTrackRef.current(id, { artworkUrl: dataUrl }));
              }
            } else {
              onUpdateTrackRef.current(uploadId, { artworkUrl: dataUrl });
            }
          }
        };
        reader.readAsDataURL(file);
      }
    },
    []
  );

  // Fast-sorted tracks memo
  const sortedTracks = useMemo(() => {
    if (!sortCol) return tracks;
    const col = sortCol;
    const dir = sortDir;
    const isAsc = dir === 'asc';

    return [...tracks].sort((a, b) => {
      const valA = (a as any)[col];
      const valB = (b as any)[col];

      if (valA === valB) return 0;
      if (valA === null || valA === undefined || valA === '') return 1;
      if (valB === null || valB === undefined || valB === '') return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return isAsc ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      if (strA === strB) return 0;
      return isAsc ? (strA < strB ? -1 : 1) : (strA > strB ? -1 : 1);
    });
  }, [tracks, sortCol, sortDir]);

  const sortedTracksRef = useRef(sortedTracks);
  sortedTracksRef.current = sortedTracks;

  // Handle row selection (Click, Shift+Click, Cmd/Ctrl+Click) - stable reference
  const handleRowClick = useCallback(
    (trackId: string, index: number, e: React.MouseEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).closest('button')) {
        return;
      }

      const prevSelected = selectedIdsRef.current;
      const prevLastIndex = lastSelectedIndexRef.current;
      const currentTracks = sortedTracksRef.current;
      const nextSelected = new Set(prevSelected);

      if (e.shiftKey && prevLastIndex !== null) {
        const start = Math.min(prevLastIndex, index);
        const end = Math.max(prevLastIndex, index);
        for (let i = start; i <= end; i++) {
          if (currentTracks[i]) nextSelected.add(currentTracks[i].id);
        }
      } else if (e.metaKey || e.ctrlKey) {
        if (nextSelected.has(trackId)) {
          nextSelected.delete(trackId);
        } else {
          nextSelected.add(trackId);
        }
        setLastSelectedIndex(index);
      } else {
        if (prevSelected.has(trackId) && prevSelected.size > 1) {
          setLastSelectedIndex(index);
          return;
        }
        nextSelected.clear();
        nextSelected.add(trackId);
        setLastSelectedIndex(index);
      }

      setSelectedIds(nextSelected);
    },
    []
  );

  const handleSelectToggle = useCallback((trackId: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(trackId);
      else next.delete(trackId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
        setSelectedIds(new Set(tracksRef.current.map((t) => t.id)));
      } else {
        setSelectedIds(new Set());
      }
    },
    []
  );

  // Inline editing commit - stable reference
  const commitEdit = useCallback(
    (forceSingle: boolean = false) => {
      const editing = editingCellRef.current;
      if (!editing) return;
      const { rowId, colKey } = editing;
      const currentEditVal = editValueRef.current;
      const currentInitialVal = initialEditValueRef.current;
      const isBatchMode = batchApplyRef.current;
      const currentSelected = selectedIdsRef.current;

      const updateObj: Record<string, any> = {};

      if (colKey === 'bpm') {
        const num = parseFloat(currentEditVal);
        updateObj[colKey] = isNaN(num) ? null : Math.round(num);
      } else if (colKey === 'rating') {
        const num = parseInt(currentEditVal, 10);
        updateObj[colKey] = isNaN(num) ? 0 : Math.max(0, Math.min(5, num));
      } else if (colKey === 'targetFileName') {
        updateObj[colKey] = currentEditVal.replace(/\.[a-zA-Z0-9]+$/, '').trim();
      } else {
        updateObj[colKey] = currentEditVal;
      }

      const isMulti = !forceSingle && isBatchMode && currentSelected.has(rowId) && currentSelected.size > 1;
      const hasChanged = currentEditVal !== currentInitialVal;

      if (isMulti && hasChanged) {
        if (colKey === 'cleanTitle' || colKey === 'targetFileName') {
          setPendingBatchConfirm({
            ids: Array.from(currentSelected),
            updates: updateObj,
            colLabel: COLUMN_LABELS[colKey] || colKey,
            value: currentEditVal,
            count: currentSelected.size,
          });
          setEditingCell(null);
          return;
        }

        const targetIds = Array.from(currentSelected);
        const colLabel = COLUMN_LABELS[colKey] || colKey;
        const toastMsg = `Updated ${colLabel} to "${currentEditVal}" across ${targetIds.length} tracks.`;

        if (onBatchUpdateTracksRef.current) {
          onBatchUpdateTracksRef.current(targetIds, updateObj, toastMsg);
        } else {
          targetIds.forEach((id) => onUpdateTrackRef.current(id, updateObj));
        }
      } else if (hasChanged) {
        onUpdateTrackRef.current(rowId, updateObj);
      }

      setEditingCell(null);
    },
    []
  );

  const startEditing = useCallback(
    (rowId: string, colKey: string, initialVal: any) => {
      if (NON_EDITABLE_COLUMNS.has(colKey)) {
        return;
      }
      setEditingCell({ rowId, colKey });
      let valStr = initialVal != null ? String(initialVal) : '';
      if (colKey === 'targetFileName') {
        valStr = valStr.replace(/\.[a-zA-Z0-9]+$/, '').trim();
      }
      setEditValue(valStr);
      setInitialEditValue(valStr);
      const isMulti = selectedIdsRef.current.has(rowId) && selectedIdsRef.current.size > 1;
      setBatchApply(isMulti);
    },
    []
  );

  // Keyboard navigation & spreadsheet copy/paste
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editingCell) {
        if (e.key === 'Enter') {
          commitEdit();
        } else if (e.key === 'Escape') {
          setEditingCell(null);
        }
        return;
      }

      // Copy (Cmd/Ctrl + C)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        onCopySelected();
        return;
      }

      // Paste (Cmd/Ctrl + V)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') {
        navigator.clipboard.readText().then((clipboardText) => {
          if (clipboardText) {
            const rowIndex = focusedCell ? focusedCell.row : (lastSelectedIndexRef.current ?? 0);
            const colKey = focusedCell ? focusedCell.colKey : 'cleanTitle';
            onPasteData(clipboardText, rowIndex, colKey);
          }
        });
        return;
      }

      // Arrow keys for cell / row navigation
      if (focusedCell) {
        let nextRow = focusedCell.row;
        if (e.key === 'ArrowUp') nextRow = Math.max(0, nextRow - 1);
        if (e.key === 'ArrowDown') nextRow = Math.min(tracks.length - 1, nextRow + 1);

        if (nextRow !== focusedCell.row) {
          e.preventDefault();
          setFocusedCell({ ...focusedCell, row: nextRow });
          const targetId = sortedTracksRef.current[nextRow]?.id;
          if (targetId) {
            setSelectedIds(new Set([targetId]));
            setLastSelectedIndex(nextRow);
          }

          // Auto-scroll container so the row is fully visible in viewport
          if (containerRef.current) {
            const rowTop = nextRow * ROW_HEIGHT;
            const rowBottom = rowTop + ROW_HEIGHT;
            const currentScroll = containerRef.current.scrollTop;
            const viewHeight = containerRef.current.clientHeight;
            if (rowTop < currentScroll) {
              containerRef.current.scrollTop = rowTop;
            } else if (rowBottom > currentScroll + viewHeight) {
              containerRef.current.scrollTop = rowBottom - viewHeight;
            }
          }
        }

        if (e.key === 'Enter' || e.key === 'F2') {
          e.preventDefault();
          const trk = sortedTracksRef.current[focusedCell.row];
          if (trk) {
            startEditing(trk.id, focusedCell.colKey, (trk as any)[focusedCell.colKey]);
          }
        }
      }
    },
    [editingCell, commitEdit, focusedCell, tracks.length, onCopySelected, onPasteData, startEditing]
  );

  // Sort handler
  const handleSort = useCallback((colKey: string) => {
    setSortCol((prevCol) => {
      if (prevCol === colKey) {
        setSortDir((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'));
        return prevCol;
      }
      setSortDir('asc');
      return colKey;
    });
  }, []);

  // Aggregate metrics for footer
  const { totalDuration, totalSize } = useMemo(() => {
    let dur = 0;
    let size = 0;
    for (let i = 0; i < tracks.length; i++) {
      dur += tracks[i].duration || 0;
      size += tracks[i].fileSize || 0;
    }
    return { totalDuration: dur, totalSize: size };
  }, [tracks]);

  const handleFocusCell = useCallback((rowIndex: number, colKey: string) => {
    setFocusedCell({ row: rowIndex, colKey });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  const handleToggleBatchApply = useCallback(() => {
    setBatchApply((v) => !v);
  }, []);

  // Windowing virtual calculations
  const totalCount = sortedTracks.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(totalCount, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
  const topSpacerHeight = startIndex * ROW_HEIGHT;
  const bottomSpacerHeight = Math.max(0, (totalCount - endIndex) * ROW_HEIGHT);
  const visibleTracks = sortedTracks.slice(startIndex, endIndex);

  return (
    <div className="grid-wrapper" tabIndex={0} onKeyDown={handleKeyDown}>
      <div className="grid-table-container" ref={containerRef}>
        <table className="spreadsheet-table">
          <TrackGridHeader
            preset={preset}
            allSelected={tracks.length > 0 && selectedIds.size === tracks.length}
            onSelectAll={handleSelectAll}
            sortCol={sortCol}
            sortDir={sortDir}
            onSort={handleSort}
            tracksCount={tracks.length}
          />

          <tbody>
            {topSpacerHeight > 0 && (
              <tr className="virtual-spacer-row" style={{ height: `${topSpacerHeight}px` }} aria-hidden="true">
                <td colSpan={20} style={{ height: `${topSpacerHeight}px`, padding: 0, border: 'none' }} />
              </tr>
            )}

            {visibleTracks.map((track, i) => {
              const rowIndex = startIndex + i;
              const isSelected = selectedIds.has(track.id);
              const isFocusedRow = focusedCell?.row === rowIndex;
              const isEditingRow = editingCell?.rowId === track.id;

              return (
                <TrackGridRow
                  key={track.id}
                  track={track}
                  rowIndex={rowIndex}
                  preset={preset}
                  isSelected={isSelected}
                  focusedColKey={isFocusedRow ? focusedCell.colKey : null}
                  editingColKey={isEditingRow ? editingCell.colKey : null}
                  editValue={isEditingRow ? editValue : ''}
                  batchApply={isEditingRow ? batchApply : false}
                  selectedCount={isEditingRow ? selectedIds.size : 0}
                  onRowClick={handleRowClick}
                  onSelectToggle={handleSelectToggle}
                  onFocusCell={handleFocusCell}
                  onStartEdit={startEditing}
                  onCommitEdit={commitEdit}
                  onCancelEdit={handleCancelEdit}
                  onEditValueChange={setEditValue}
                  onToggleBatchApply={handleToggleBatchApply}
                  onArtworkClick={handleArtworkClick}
                  onUpdateTrack={onUpdateTrack}
                  editInputRef={editInputRef}
                />
              );
            })}

            {bottomSpacerHeight > 0 && (
              <tr className="virtual-spacer-row" style={{ height: `${bottomSpacerHeight}px` }} aria-hidden="true">
                <td colSpan={20} style={{ height: `${bottomSpacerHeight}px`, padding: 0, border: 'none' }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Grid Bottom Status Bar */}
      <TrackGridFooter
        tracksCount={tracks.length}
        selectedCount={selectedIds.size}
        totalDuration={totalDuration}
        totalSize={totalSize}
      />

      {/* Hidden file input for artwork upload */}
      <input
        ref={artworkInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/jpg"
        style={{ display: 'none' }}
        onChange={handleArtworkFileChange}
      />

      {/* Batch Title/Filename Overwrite Safety Modal */}
      {pendingBatchConfirm && (
        <div className="modal-backdrop" onClick={() => setPendingBatchConfirm(null)}>
          <div className="modal-dialog modal-dialog--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <div className="modal-icon-badge modal-icon-badge--warning">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <div className="modal-title">Batch {pendingBatchConfirm.colLabel} Update</div>
                  <div className="modal-subtitle">
                    Setting identical {pendingBatchConfirm.colLabel.toLowerCase()} across {pendingBatchConfirm.count} tracks
                  </div>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setPendingBatchConfirm(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p className="modal-body-text">
                You are setting the exact same <strong>{pendingBatchConfirm.colLabel}</strong> across{' '}
                <strong>{pendingBatchConfirm.count} selected tracks</strong>:
              </p>
              <div className="modal-value-preview">
                &ldquo;{pendingBatchConfirm.value}&rdquo;
              </div>
              <p className="modal-body-hint">
                Track titles and filenames are typically distinct. Do you want to apply this identical value across all{' '}
                {pendingBatchConfirm.count} tracks, or update only the active track?
              </p>
            </div>

            <div className="modal-footer modal-footer--end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPendingBatchConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (pendingBatchConfirm.ids[0]) {
                    onUpdateTrack(pendingBatchConfirm.ids[0], pendingBatchConfirm.updates);
                  }
                  setPendingBatchConfirm(null);
                }}
              >
                Only This Track
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Check size={14} />}
                onClick={() => {
                  const targetIds = pendingBatchConfirm.ids;
                  const toastMsg = `Updated ${pendingBatchConfirm.colLabel} to "${pendingBatchConfirm.value}" across ${targetIds.length} tracks.`;
                  if (onBatchUpdateTracks) {
                    onBatchUpdateTracks(targetIds, pendingBatchConfirm.updates, toastMsg);
                  } else {
                    targetIds.forEach((id) => onUpdateTrack(id, pendingBatchConfirm.updates));
                  }
                  setPendingBatchConfirm(null);
                }}
              >
                Apply to All {pendingBatchConfirm.count} Tracks
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
