import React, { useState, useCallback } from 'react';
import { UploadCloud, FolderPlus, FilePlus } from 'lucide-react';

interface DropzoneProps {
  onFilesDropped: (files: File[]) => void;
  onOpenFiles: () => void;
  onOpenDirectory: () => void;
}

const AUDIO_FILE_RE = /\.(mp3|flac|wav|aiff|aif|csv|tsv)$/i;

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
          versions, and writes ID3v2 tags.
        </p>

        <div className="dropzone-actions">
          <button className="btn-primary" onClick={onOpenFiles}>
            <FilePlus size={16} />
            <span>Select Audio Files</span>
          </button>

          <button className="btn-secondary" onClick={onOpenDirectory}>
            <FolderPlus size={16} />
            <span>Select Folder / USB Drive</span>
          </button>
        </div>
      </div>
    </div>
  );
});

Dropzone.displayName = 'Dropzone';
