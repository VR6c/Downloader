import React, { useState } from 'react';
import { X, Download, FileText, Music, Database, FileSpreadsheet, Check, Upload } from 'lucide-react';
import { TrackItem } from '../types';
import {
  generateM3U8Playlist,
  generateRekordboxXml,
  generateDelimitedData,
  generateTextTracklist,
  downloadFile,
} from '../engine/exportEngine';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: TrackItem[];
  onOpenImportCsv?: () => void;
  onShowToast: (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  tracks,
  onOpenImportCsv,
  onShowToast,
}) => {
  const [exportFormat, setExportFormat] = useState<'m3u8' | 'xml' | 'csv' | 'txt' | 'json'>('m3u8');
  const [playlistTitle, setPlaylistTitle] = useState('TVR Cleaned DJ Set');

  if (!isOpen) return null;

  const handleExecuteExport = () => {
    if (tracks.length === 0) {
      onShowToast('warning', 'No Tracks', 'Load tracks before exporting.');
      return;
    }

    const safeName = playlistTitle.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'TVR_DJ_Library';

    if (exportFormat === 'm3u8') {
      const content = generateM3U8Playlist(tracks, playlistTitle);
      downloadFile(content, `${safeName}.m3u8`, 'audio/x-mpegurl');
      onShowToast('success', 'M3U8 Playlist Exported', `${tracks.length} tracks exported for Rekordbox & Serato.`);
    } else if (exportFormat === 'xml') {
      const content = generateRekordboxXml(tracks);
      downloadFile(content, `rekordbox_${safeName}.xml`, 'application/xml');
      onShowToast('success', 'Rekordbox XML Exported', 'Ready to import in Pioneer DJ Rekordbox (File > Import > XML).');
    } else if (exportFormat === 'csv') {
      const content = generateDelimitedData(tracks, ',');
      downloadFile(content, `${safeName}_metadata.csv`, 'text/csv');
      onShowToast('success', 'CSV Catalog Exported', 'Full metadata exported for Excel & Google Sheets.');
    } else if (exportFormat === 'txt') {
      const content = generateTextTracklist(tracks);
      downloadFile(content, `${safeName}_tracklist.txt`, 'text/plain');
      onShowToast('success', 'Text Tracklist Exported', 'Tracklist with Camelot keys and BPM saved.');
    } else if (exportFormat === 'json') {
      const content = JSON.stringify(tracks, null, 2);
      downloadFile(content, `${safeName}_database.json`, 'application/json');
      onShowToast('success', 'JSON Database Exported', 'Complete JSON schema exported.');
    }

    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" style={{ width: '560px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <Download size={18} />
            </div>
            <div>
              <div className="modal-title">Export Playlists &amp; Metadata (FR-7)</div>
              <div className="modal-subtitle">Generate Rekordbox-ready playlists and catalog exports</div>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Playlist Name / Export Label</label>
            <input
              type="text"
              className="form-input"
              value={playlistTitle}
              onChange={(e) => setPlaylistTitle(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Select Export Format</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '6px' }}>
              {/* M3U8 */}
              <div
                onClick={() => setExportFormat('m3u8')}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: `2px solid ${exportFormat === 'm3u8' ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                  background: exportFormat === 'm3u8' ? 'var(--accent-light)' : 'var(--bg-tertiary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <Music size={20} style={{ color: 'var(--accent-primary)', marginTop: '2px' }} />
                <div>
                  <strong style={{ fontSize: '0.84rem' }}>.M3U8 Extended Playlist</strong>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Instant drag-and-drop into Rekordbox, Serato DJ, Traktor, Engine DJ.
                  </p>
                </div>
              </div>

              {/* Rekordbox XML */}
              <div
                onClick={() => setExportFormat('xml')}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: `2px solid ${exportFormat === 'xml' ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                  background: exportFormat === 'xml' ? 'var(--accent-light)' : 'var(--bg-tertiary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <Database size={20} style={{ color: 'var(--accent-primary)', marginTop: '2px' }} />
                <div>
                  <strong style={{ fontSize: '0.84rem' }}>Rekordbox XML (v4.0)</strong>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Full collection import XML with BPM, Camelot keys, and cue data.
                  </p>
                </div>
              </div>

              {/* CSV */}
              <div
                onClick={() => setExportFormat('csv')}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: `2px solid ${exportFormat === 'csv' ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                  background: exportFormat === 'csv' ? 'var(--accent-light)' : 'var(--bg-tertiary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <FileSpreadsheet size={20} style={{ color: 'var(--accent-primary)', marginTop: '2px' }} />
                <div>
                  <strong style={{ fontSize: '0.84rem' }}>CSV Spreadsheet</strong>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Compatible with Excel, Google Sheets, Numbers for library logging.
                  </p>
                </div>
              </div>

              {/* TXT Tracklist */}
              <div
                onClick={() => setExportFormat('txt')}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: `2px solid ${exportFormat === 'txt' ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                  background: exportFormat === 'txt' ? 'var(--accent-light)' : 'var(--bg-tertiary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <FileText size={20} style={{ color: 'var(--accent-primary)', marginTop: '2px' }} />
                <div>
                  <strong style={{ fontSize: '0.84rem' }}>Plain Text (.txt) Tracklist</strong>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Formatted setlist for YouTube, 1001Tracklists, Mixcloud tracklists.
                  </p>
                </div>
              </div>
            </div>

            {exportFormat === 'csv' && onOpenImportCsv && (
              <div
                style={{
                  marginTop: '14px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div>
                  <strong style={{ fontSize: '0.82rem', display: 'block' }}>Already edited your CSV spreadsheet?</strong>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                    Re-import your modified CSV file to update tracks and filenames in your library.
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: '0.76rem', height: '30px', padding: '0 12px', flexShrink: 0 }}
                  onClick={() => {
                    onClose();
                    onOpenImportCsv();
                  }}
                >
                  <Upload size={13} />
                  <span>Import CSV</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleExecuteExport}>
            <Download size={15} />
            <span>Download {exportFormat.toUpperCase()}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
