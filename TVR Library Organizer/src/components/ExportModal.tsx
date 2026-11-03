import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { RadioCardGroup, RadioCardOption } from './ui/RadioCardGroup';
import { Download, FileText, Music, Database, FileSpreadsheet, Upload } from 'lucide-react';
import { TrackItem, AddToast } from '../types';
import {
  generateM3U8Playlist,
  generateRekordboxXml,
  generateDelimitedData,
  generateTextTracklist,
  downloadFile,
} from '../engine/exportEngine';

type ExportFormat = 'm3u8' | 'xml' | 'csv' | 'txt' | 'json';

interface ExportDefinition {
  option: RadioCardOption<ExportFormat>;
  fileName: (safeName: string) => string;
  mime: string;
  build: (tracks: TrackItem[], playlistTitle: string) => string;
  toast: (count: number) => [title: string, message: string];
}

const EXPORTS: Record<ExportFormat, ExportDefinition> = {
  m3u8: {
    option: {
      value: 'm3u8',
      label: '.M3U8 Extended Playlist',
      description: 'Instant drag-and-drop into Rekordbox, Serato DJ, Traktor, Engine DJ.',
      icon: <Music size={20} />,
    },
    fileName: (n) => `${n}.m3u8`,
    mime: 'audio/x-mpegurl',
    build: generateM3U8Playlist,
    toast: (count) => ['M3U8 Playlist Exported', `${count} tracks exported for Rekordbox & Serato.`],
  },
  xml: {
    option: {
      value: 'xml',
      label: 'Rekordbox XML (v4.0)',
      description: 'Full collection import XML with BPM, Camelot keys, and cue data.',
      icon: <Database size={20} />,
    },
    fileName: (n) => `rekordbox_${n}.xml`,
    mime: 'application/xml',
    build: (tracks) => generateRekordboxXml(tracks),
    toast: () => ['Rekordbox XML Exported', 'Ready to import in Pioneer DJ Rekordbox (File > Import > XML).'],
  },
  csv: {
    option: {
      value: 'csv',
      label: 'CSV Spreadsheet',
      description: 'Compatible with Excel, Google Sheets, Numbers for library logging.',
      icon: <FileSpreadsheet size={20} />,
    },
    fileName: (n) => `${n}_metadata.csv`,
    mime: 'text/csv',
    build: (tracks) => generateDelimitedData(tracks, ','),
    toast: () => ['CSV Catalog Exported', 'Full metadata exported for Excel & Google Sheets.'],
  },
  txt: {
    option: {
      value: 'txt',
      label: 'Plain Text (.txt) Tracklist',
      description: 'Formatted setlist for YouTube, 1001Tracklists, Mixcloud tracklists.',
      icon: <FileText size={20} />,
    },
    fileName: (n) => `${n}_tracklist.txt`,
    mime: 'text/plain',
    build: (tracks) => generateTextTracklist(tracks),
    toast: () => ['Text Tracklist Exported', 'Tracklist with Camelot keys and BPM saved.'],
  },
  json: {
    option: { value: 'json', label: 'JSON Database' },
    fileName: (n) => `${n}_database.json`,
    mime: 'application/json',
    build: (tracks) => JSON.stringify(tracks, null, 2),
    toast: () => ['JSON Database Exported', 'Complete JSON schema exported.'],
  },
};

// JSON stays supported by the exporter table but, as before, isn't offered as a card.
const FORMAT_OPTIONS = (['m3u8', 'xml', 'csv', 'txt'] as const).map((f) => EXPORTS[f].option);

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: TrackItem[];
  onOpenImportCsv?: () => void;
  onShowToast: AddToast;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, tracks, onOpenImportCsv, onShowToast }) => {
  const [exportFormat, setExportFormat] = useState<ExportFormat>('m3u8');
  const [playlistTitle, setPlaylistTitle] = useState('TVR Cleaned DJ Set');

  if (!isOpen) return null;

  const handleExecuteExport = () => {
    if (tracks.length === 0) {
      onShowToast('warning', 'No Tracks', 'Load tracks before exporting.');
      return;
    }

    const def = EXPORTS[exportFormat];
    const safeName = playlistTitle.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'TVR_DJ_Library';
    downloadFile(def.build(tracks, playlistTitle), def.fileName(safeName), def.mime);
    onShowToast('success', ...def.toast(tracks.length));
    onClose();
  };

  return (
    <Modal
      onClose={onClose}
      title="Export Playlists & Metadata (FR-7)"
      subtitle="Generate Rekordbox-ready playlists and catalog exports"
      icon={<Download size={18} />}
      width={560}
    >
      <div className="modal-body">
        <div className="form-group">
          <label className="form-label" htmlFor="export-playlist-name">
            Playlist Name / Export Label
          </label>
          <input
            id="export-playlist-name"
            type="text"
            className="form-input"
            value={playlistTitle}
            onChange={(e) => setPlaylistTitle(e.target.value)}
          />
        </div>

        <div className="form-group">
          <div className="form-label" id="export-format-label">
            Select Export Format
          </div>
          <RadioCardGroup
            options={FORMAT_OPTIONS}
            value={exportFormat}
            onChange={setExportFormat}
            labelledBy="export-format-label"
          />

          {exportFormat === 'csv' && onOpenImportCsv && (
            <div className="callout-row">
              <div>
                <strong className="callout-title">Already edited your CSV spreadsheet?</strong>
                <span className="callout-text">
                  Re-import your modified CSV file to update tracks and filenames in your library.
                </span>
              </div>
              <button
                type="button"
                className="btn-secondary btn-compact"
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
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn-primary" onClick={handleExecuteExport}>
          <Download size={15} />
          <span>Download {exportFormat.toUpperCase()}</span>
        </button>
      </div>
    </Modal>
  );
};
