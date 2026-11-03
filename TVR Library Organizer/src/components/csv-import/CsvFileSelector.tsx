import React from 'react';
import { Upload, FileSpreadsheet, Download, HelpCircle } from 'lucide-react';

interface CsvFileSelectorProps {
  isDragOver: boolean;
  isReadingFile: boolean;
  hasLibraryTracks: boolean;
  onBrowse: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDownloadTemplate: () => void;
}

/** Empty state of the CSV importer: drop zone plus a short how-to. */
export const CsvFileSelector: React.FC<CsvFileSelectorProps> = ({
  isDragOver,
  isReadingFile,
  hasLibraryTracks,
  onBrowse,
  onDragOver,
  onDragLeave,
  onDrop,
  onDownloadTemplate,
}) => (
  <div className="csv-selector">
    <div
      className={`csv-dropzone${isDragOver ? ' is-drag-over' : ''}`}
      role="button"
      tabIndex={0}
      aria-label="Choose a CSV or spreadsheet file to import, or drag one here"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onBrowse}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onBrowse();
        }
      }}
    >
      <div className="csv-dropzone-icon" aria-hidden="true">
        <Upload size={28} />
      </div>
      <div>
        <div className="csv-dropzone-title">
          {isReadingFile ? 'Reading file...' : 'Choose or Drag & Drop your edited CSV file here'}
        </div>
        <div className="csv-dropzone-hint">
          Supports <strong>.CSV</strong> and <strong>.TSV</strong> files from Microsoft Excel, Apple Numbers, and Google
          Sheets
        </div>
      </div>
      <button
        type="button"
        className="btn-primary csv-dropzone-btn"
        onClick={(e) => {
          e.stopPropagation();
          onBrowse();
        }}
      >
        <FileSpreadsheet size={15} />
        <span>Browse CSV File</span>
      </button>
    </div>

    <div className="csv-tips">
      <HelpCircle size={20} className="csv-tips-icon" aria-hidden="true" />
      <div className="csv-tips-body">
        <strong>How the CSV round-trip edit works:</strong>
        <ol>
          <li>
            Export your library to CSV using the <strong>Export</strong> button in the top bar.
          </li>
          <li>Open the file in Excel or Google Sheets and edit columns like Title, Producer, BPM, Key, or Genre.</li>
          <li>Save the spreadsheet as CSV and import it right here.</li>
          <li>TVR Library matches your tracks automatically and applies your changes.</li>
        </ol>
        {hasLibraryTracks && (
          <button type="button" className="btn-secondary btn-compact csv-tips-btn" onClick={onDownloadTemplate}>
            <Download size={14} />
            <span>Export Current Library as CSV Template</span>
          </button>
        )}
      </div>
    </div>
  </div>
);
