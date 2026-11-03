import React, { useState, useCallback } from 'react';
import { UploadCloud, FolderPlus, FilePlus } from 'lucide-react';

import { Button } from './ui';

interface DropzoneProps {
  onFilesDropped: (files: File[]) => void;
  onOpenFiles: () => void;
  onOpenDirectory: () => void;
}

const AUDIO_FILE_RE = /\.(mp3|flac|wav|aiff|aif|csv|tsv)$/i;

const FORMAT_TAGS = ['MP3', 'WAV', 'FLAC', 'AIFF', 'CSV / TSV'];
const HIGHLIGHT_TAGS = [
  'Rekordbox ID3v2.3',
  'DSP Harmonic Key & BPM',
  'Automated Noise Stripping',
  'In-Place Renaming',
];

export const Dropzone: React.FC<DropzoneProps> = React.memo(({
  onFilesDropped,
  onOpenFiles,
  onOpenDirectory,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files).filter((file) =>
        AUDIO_FILE_RE.test(file.name)
      );
      onFilesDropped(droppedFiles);
    }
  }, [onFilesDropped]);

  return (
    <div
      className="dropzone-empty-container"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={`dropzone-box ${isDragOver ? 'dragging-active' : ''}`}>
        <div className="dropzone-hero-icon">
          <UploadCloud size={38} />
        </div>

        <h2 className="dropzone-title">Drop your audio files here</h2>
        <p className="dropzone-subtitle">
          TVR Library Organizer automatically cleans promotional noise, standardizes mix
          versions, detects harmonic BPM &amp; Camelot keys, and writes Rekordbox ID3v2.3 tags.
        </p>

        {/* Format Tags Row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginBottom: '22px' }}>
          {FORMAT_TAGS.map((fmt) => (
            <span
              key={fmt}
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: '6px',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {fmt}
            </span>
          ))}
        </div>

        <div className="dropzone-actions">
          <Button
            variant="primary"
            size="md"
            icon={<FilePlus size={16} />}
            onClick={onOpenFiles}
            title="Open loose audio files (Cmd+O / Ctrl+O)"
          >
            Select Audio Files
          </Button>

          <Button
            variant="secondary"
            size="md"
            icon={<FolderPlus size={16} />}
            onClick={onOpenDirectory}
            title="Scan entire music folder or USB drive (Cmd+Shift+O)"
          >
            Select Folder / USB Drive
          </Button>
        </div>

        {/* Feature Badges Row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', marginTop: '24px', opacity: 0.85 }}>
          {HIGHLIGHT_TAGS.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: '0.74rem',
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent-primary)' }} />
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
});

Dropzone.displayName = 'Dropzone';
