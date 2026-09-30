import React from 'react';
import { Zap } from 'lucide-react';

interface TrackGridFooterProps {
  tracksCount: number;
  selectedCount: number;
  totalDuration: number;
  totalSize: number;
}

const formatTotalTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;
};

const formatTotalSize = (bytes: number): string => {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
};

export const TrackGridFooter: React.FC<TrackGridFooterProps> = React.memo(({
  tracksCount,
  selectedCount,
  totalDuration,
  totalSize,
}) => {
  return (
    <div className="grid-footer-bar">
      <div className="footer-left">
        <span>
          Total Tracks: <strong>{tracksCount}</strong>
        </span>
        {tracksCount > 0 && (
          <>
            <span className="footer-dot">•</span>
            <span>
              Runtime: <strong>{formatTotalTime(totalDuration)}</strong>
            </span>
            <span className="footer-dot">•</span>
            <span>
              Size: <strong>{formatTotalSize(totalSize)}</strong>
            </span>
          </>
        )}
        <span className="footer-dot">•</span>
        <span>
          Selected: <strong>{selectedCount}</strong>
        </span>
      </div>

      <div className="footer-right">
        {selectedCount > 1 && (
          <span className="footer-batch-hint">
            <span className="footer-hotkey-badge footer-hotkey-badge--accent">
              <Zap size={11} fill="currentColor" /> Batch Edit
            </span>
            Double-click cell to update all {selectedCount} tracks
          </span>
        )}
        <span>
          <span className="footer-hotkey-badge">Double Click</span> Edit Cell
        </span>
        <span>
          <span className="footer-hotkey-badge">Ctrl/Cmd+C</span> Copy TSV
        </span>
        <span>
          <span className="footer-hotkey-badge">Ctrl/Cmd+V</span> Paste TSV
        </span>
        <span>
          <span className="footer-hotkey-badge">Up/Down</span> Navigate Rows
        </span>
      </div>
    </div>
  );
});

TrackGridFooter.displayName = 'TrackGridFooter';
