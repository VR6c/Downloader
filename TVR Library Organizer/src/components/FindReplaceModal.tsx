import React, { useState, useEffect } from 'react';
import { X, SearchCode, Replace } from 'lucide-react';
import { TrackItem } from '../types';
import { SelectDropdown } from './SelectDropdown';

interface FindReplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: TrackItem[];
  onBatchUpdate: (updatedTracks: TrackItem[]) => void;
  onShowToast: (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => void;
}

export const FindReplaceModal: React.FC<FindReplaceModalProps> = ({
  isOpen,
  onClose,
  tracks,
  onBatchUpdate,
  onShowToast,
}) => {
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [targetColumn, setTargetColumn] = useState('all');
  const [matchCase, setMatchCase] = useState(false);
  const [isRegex, setIsRegex] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setFindText('');
      setReplaceText('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExecuteReplaceAll = () => {
    if (!findText) {
      onShowToast('warning', 'Empty Search Query', 'Please enter text to find.');
      return;
    }

    const patternString = isRegex ? findText : findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const flags = matchCase ? 'g' : 'gi';

    try {
      new RegExp(patternString, flags);
    } catch (err: any) {
      onShowToast('error', 'Invalid Regular Expression', err.message);
      return;
    }

    let replacementCount = 0;
    const columnsToInspect =
      targetColumn === 'all'
        ? ['cleanTitle', 'cleanArtist', 'mixVersion', 'album', 'genre', 'albumArtist', 'comments', 'year', 'trackNumber', 'tracksTotal', 'targetFileName']
        : [targetColumn];

    const updated = tracks.map((track) => {
      let trackChanged = false;
      const copy: any = { ...track };

      for (const col of columnsToInspect) {
        const val = copy[col];
        if (typeof val === 'string') {
          // Create fresh regex per field to guarantee clean lastIndex state
          const fieldRegex = new RegExp(patternString, flags);
          const replaced = val.replace(fieldRegex, replaceText);
          if (replaced !== val) {
            const finalVal = col === 'targetFileName' ? replaced.replace(/\.[a-zA-Z0-9]+$/, '').trim() : replaced;
            copy[col] = finalVal;
            if (col === 'targetFileName') {
              copy.customTargetFileName = true;
            }
            trackChanged = true;
            replacementCount++;
          }
        }
      }

      return trackChanged ? copy : track;
    });

    if (replacementCount > 0) {
      onBatchUpdate(updated);
      onShowToast('success', 'Replacements Applied', `Successfully made ${replacementCount} replacements across library.`);
      onClose();
    } else {
      onShowToast('info', 'No Matches Found', `No instances of "${findText}" were found in target columns.`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleExecuteReplaceAll();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" style={{ width: '480px' }} onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <SearchCode size={18} />
            </div>
            <div>
              <div className="modal-title">Find &amp; Replace (FR-3.3)</div>
              <div className="modal-subtitle">Batch replace text or regex patterns across spreadsheet</div>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Find</label>
            <input
              type="text"
              className="form-input"
              placeholder="Text or regex to find..."
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Replace With</label>
            <input
              type="text"
              className="form-input"
              placeholder="Replacement text (can be empty to delete)..."
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Target Column Scope</label>
            <SelectDropdown
              value={targetColumn}
              onChange={setTargetColumn}
              options={[
                { value: 'all', label: 'All Text Columns' },
                { value: 'cleanTitle', label: 'Title' },
                { value: 'targetFileName', label: 'File Name' },
                { value: 'cleanArtist', label: 'Producer' },
                { value: 'album', label: 'Album' },
                { value: 'genre', label: 'Genre' },
                { value: 'year', label: 'Year' },
                { value: 'albumArtist', label: 'Album Artist' },
                { value: 'trackNumber', label: 'Track #' },
                { value: 'tracksTotal', label: 'Tracks Total' },
                { value: 'comments', label: 'Comment' },
                { value: 'mixVersion', label: 'Mix / Version' },
              ]}
              variant="form"
              size="md"
            />
          </div>

          <div style={{ display: 'flex', gap: '18px', marginTop: '12px' }}>
            <label className="form-checkbox-row">
              <input
                type="checkbox"
                checked={matchCase}
                onChange={(e) => setMatchCase(e.target.checked)}
              />
              <span style={{ fontSize: '0.8rem' }}>Match Case</span>
            </label>

            <label className="form-checkbox-row">
              <input
                type="checkbox"
                checked={isRegex}
                onChange={(e) => setIsRegex(e.target.checked)}
              />
              <span style={{ fontSize: '0.8rem' }}>Regular Expression</span>
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleExecuteReplaceAll}>
            <Replace size={15} />
            <span>Replace All</span>
          </button>
        </div>
      </div>
    </div>
  );
};
