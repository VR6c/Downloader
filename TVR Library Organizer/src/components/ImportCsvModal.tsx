import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Check,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Download,
  Filter,
  CheckSquare,
  Square,
  FileText,
  HelpCircle,
} from 'lucide-react';
import { TrackItem } from '../types';
import {
  parseCsvContent,
  analyzeCsvForImport,
  applyCsvImport,
  CsvImportAnalysis,
  MatchStrategy,
  ParsedCsv,
  EDITABLE_FIELDS,
} from '../engine/csvEngine';
import { generateDelimitedData, downloadFile } from '../engine/exportEngine';
import { SelectDropdown, SelectOption } from './SelectDropdown';

interface ImportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  libraryTracks: TrackItem[];
  initialFile?: File | null;
  onApplyImport: (updatedTracks: TrackItem[], summaryMessage: string) => void;
  onShowToast: (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => void;
}

export const ImportCsvModal: React.FC<ImportCsvModalProps> = ({
  isOpen,
  onClose,
  libraryTracks,
  initialFile,
  onApplyImport,
  onShowToast,
}) => {
  const [parsedCsv, setParsedCsv] = useState<ParsedCsv | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string>('');
  const [matchStrategy, setMatchStrategy] = useState<MatchStrategy>('auto');
  const [analysis, setAnalysis] = useState<CsvImportAnalysis | null>(null);
  const [selectedFields, setSelectedFields] = useState<Set<keyof TrackItem>>(new Set());
  const [activeTab, setActiveTab] = useState<'changes' | 'all' | 'unmatched'>('changes');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle incoming initial file or reset when opening/closing
  useEffect(() => {
    if (!isOpen) {
      setParsedCsv(null);
      setCurrentFileName('');
      setAnalysis(null);
      setSelectedFields(new Set());
      setActiveTab('changes');
      return;
    }

    if (initialFile) {
      processCsvFile(initialFile);
    }
  }, [isOpen, initialFile]);

  // Recalculate analysis when parsedCsv, matchStrategy, or libraryTracks change
  useEffect(() => {
    if (!parsedCsv) {
      setAnalysis(null);
      return;
    }

    const result = analyzeCsvForImport(parsedCsv, libraryTracks, matchStrategy, currentFileName);
    setAnalysis(result);

    // Default select all fields that have changes or are present
    const fieldsToSelect = new Set<keyof TrackItem>();
    result.detectedFields.forEach((f) => {
      // Prioritize fields that have actual detected changes
      fieldsToSelect.add(f.field);
    });
    setSelectedFields(fieldsToSelect);

    if (result.totalChangedValues > 0) {
      setActiveTab('changes');
    } else if (result.matchedTracks.length > 0) {
      setActiveTab('all');
    } else {
      setActiveTab('unmatched');
    }
  }, [parsedCsv, matchStrategy, libraryTracks, currentFileName]);

  if (!isOpen) return null;

  // Process File input
  const processCsvFile = (file: File) => {
    if (!file) return;
    setIsReadingFile(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      setIsReadingFile(false);
      const text = (e.target?.result as string) || '';
      try {
        const parsed = parseCsvContent(text);
        if (parsed.headers.length === 0 || parsed.rows.length === 0) {
          onShowToast('error', 'Invalid CSV File', 'The selected file is empty or could not be parsed.');
          return;
        }
        setCurrentFileName(file.name);
        setParsedCsv(parsed);
      } catch (err: any) {
        onShowToast('error', 'CSV Parse Error', err.message || 'Could not parse CSV.');
      }
    };

    reader.onerror = () => {
      setIsReadingFile(false);
      onShowToast('error', 'File Read Error', 'Failed to read the selected file.');
    };

    reader.readAsText(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processCsvFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processCsvFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  // Toggle field selection
  const handleToggleField = (fieldKey: keyof TrackItem) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldKey)) {
        next.delete(fieldKey);
      } else {
        next.add(fieldKey);
      }
      return next;
    });
  };

  const handleSelectAllFields = () => {
    if (!analysis) return;
    const all = new Set<keyof TrackItem>(analysis.detectedFields.map((f) => f.field));
    setSelectedFields(all);
  };

  const handleSelectOnlyChangedFields = () => {
    if (!analysis) return;
    const changed = new Set<keyof TrackItem>(
      analysis.detectedFields.filter((f) => f.countChanged > 0).map((f) => f.field)
    );
    setSelectedFields(changed);
  };

  const handleDeselectAllFields = () => {
    setSelectedFields(new Set());
  };

  // Quick template download
  const handleDownloadTemplate = () => {
    if (libraryTracks.length === 0) {
      onShowToast('warning', 'No Tracks', 'Load audio files into TVR Library first to generate a template.');
      return;
    }
    const csvContent = generateDelimitedData(libraryTracks, ',');
    downloadFile(csvContent, 'tvr_library_export.csv', 'text/csv');
    onShowToast('success', 'Template Exported', 'Exported current library as CSV. Open in Excel to edit!');
  };

  // Execute Import
  const handleExecuteApply = () => {
    if (!analysis) return;

    if (analysis.matchedTracks.length === 0) {
      onShowToast('error', 'Cannot Apply', 'No matching tracks found to update.');
      return;
    }

    if (selectedFields.size === 0) {
      onShowToast('warning', 'No Fields Selected', 'Please select at least one field to import.');
      return;
    }

    const updatedTracks = applyCsvImport(libraryTracks, analysis, selectedFields);
    const affectedTrackCount = analysis.matchedTracks.filter((m) =>
      m.diffs.some((d) => d.hasChanged && selectedFields.has(d.field))
    ).length;

    const message = `Successfully updated ${affectedTrackCount} tracks from ${currentFileName || 'CSV'}.`;
    onApplyImport(updatedTracks, message);
    onClose();
  };

  // Tracks with active diffs matching user selected fields
  const tracksWithActiveDiffs = (analysis?.matchedTracks || []).filter((m) =>
    m.diffs.some((d) => d.hasChanged && selectedFields.has(d.field))
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog"
        style={{ width: '840px', maxWidth: '96vw', height: '88vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <div className="modal-title">Import CSV / Spreadsheet Metadata</div>
              <div className="modal-subtitle">
                Import edited tags, BPM, keys, and filenames from Excel, Numbers, or Google Sheets
              </div>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          {/* File Selection Zone if no file loaded */}
          {!parsedCsv ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragOver ? 'var(--accent-primary)' : 'var(--border-medium)'}`,
                  borderRadius: '12px',
                  background: isDragOver ? 'var(--accent-light)' : 'var(--bg-tertiary)',
                  padding: '40px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '14px',
                    background: 'var(--bg-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-primary)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  }}
                >
                  <Upload size={28} />
                </div>
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>
                    {isReadingFile ? 'Reading file...' : 'Choose or Drag & Drop your edited CSV file here'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Supports <strong>.CSV</strong> and <strong>.TSV</strong> files from Microsoft Excel, Apple Numbers, and Google Sheets
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ marginTop: '8px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  <FileSpreadsheet size={15} />
                  <span>Browse CSV File</span>
                </button>
              </div>

              {/* Helpful Tips Card */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-secondary)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}
              >
                <HelpCircle size={20} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1, fontSize: '0.82rem', lineHeight: 1.5 }}>
                  <strong>How the CSV round-trip edit works:</strong>
                  <ol style={{ paddingLeft: '18px', marginTop: '6px', color: 'var(--text-secondary)' }}>
                    <li>
                      Export your library to CSV using the <strong>Export</strong> button in the top bar.
                    </li>
                    <li>Open the file in Excel or Google Sheets and edit columns like Title, Producer, BPM, Key, or Genre.</li>
                    <li>Save the spreadsheet as CSV and import it right here.</li>
                    <li>TVR Library matches your tracks automatically and applies your changes.</li>
                  </ol>
                  {libraryTracks.length > 0 && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleDownloadTemplate}
                      style={{ marginTop: '10px', fontSize: '0.78rem', height: '30px' }}
                    >
                      <Download size={14} />
                      <span>Export Current Library as CSV Template</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* File Loaded & Analyzed View */
            analysis && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                {/* Top Summary Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="modal-icon-badge" style={{ width: '28px', height: '28px' }}>
                      <FileSpreadsheet size={15} />
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.88rem' }}>{currentFileName}</strong>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                        {analysis.totalCsvRows} rows in CSV • Delimiter: <code>{parsedCsv.delimiter === '\t' ? 'Tab (TSV)' : parsedCsv.delimiter}</code>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: analysis.matchedTracks.length > 0 ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        color: analysis.matchedTracks.length > 0 ? '#16A34A' : '#EF4444',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <Check size={12} />
                      {analysis.matchedTracks.length} / {libraryTracks.length} Tracks Matched
                    </span>

                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: analysis.totalChangedValues > 0 ? 'var(--accent-light)' : 'var(--bg-secondary)',
                        color: analysis.totalChangedValues > 0 ? 'var(--accent-primary)' : 'var(--text-muted)',
                      }}
                    >
                      {analysis.totalChangedValues} Changes Detected
                    </span>

                    <button
                      className="btn-secondary"
                      style={{ height: '30px', fontSize: '0.76rem', padding: '0 10px' }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <RefreshCw size={12} />
                      <span>Change File</span>
                    </button>
                  </div>
                </div>

                {/* Match Strategy & Settings */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(200px, 280px) 1fr',
                    gap: '14px',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {/* Match Strategy Dropdown */}
                  <div>
                    <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.78rem' }}>
                      Track Matching Strategy
                    </label>
                    <SelectDropdown<MatchStrategy>
                      value={matchStrategy}
                      onChange={(val) => setMatchStrategy(val)}
                      options={[
                        { value: 'auto', label: 'Auto (ID → Path → Filename)' },
                        { value: 'id', label: 'Strict Match by Track ID' },
                        { value: 'path', label: 'Match by File Path' },
                        { value: 'filename', label: 'Match by Original Filename' },
                        { value: 'row_order', label: 'Match by Row Order (1-to-1)' },
                      ]}
                      size="sm"
                      variant="form"
                      menuMinWidth={240}
                      title="Track matching strategy"
                      ariaLabel="Track matching strategy"
                    />
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Matches each CSV row to your loaded library tracks.
                    </div>
                  </div>

                  {/* Fields to Update Selection */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label className="form-label" style={{ fontSize: '0.78rem', margin: 0 }}>
                        Fields to Update ({selectedFields.size} selected)
                      </label>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '0.72rem' }}>
                        {analysis.totalChangedValues > 0 && (
                          <button
                            type="button"
                            onClick={handleSelectOnlyChangedFields}
                            style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 600 }}
                          >
                            Select Changed
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleSelectAllFields}
                          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={handleDeselectAllFields}
                          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                        >
                          None
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '72px', overflowY: 'auto' }}>
                      {analysis.detectedFields.map((f) => {
                        const isSelected = selectedFields.has(f.field);
                        const hasChanges = f.countChanged > 0;
                        return (
                          <div
                            key={f.field}
                            onClick={() => handleToggleField(f.field)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.74rem',
                              cursor: 'pointer',
                              border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                              background: isSelected ? 'var(--accent-light)' : 'var(--bg-tertiary)',
                              color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                              fontWeight: isSelected ? 600 : 400,
                              userSelect: 'none',
                            }}
                          >
                            {isSelected ? <CheckSquare size={12} /> : <Square size={12} />}
                            <span>{f.label}</span>
                            {hasChanges && (
                              <span
                                style={{
                                  background: isSelected ? 'var(--accent-primary)' : 'var(--border-medium)',
                                  color: isSelected ? '#fff' : 'var(--text-primary)',
                                  borderRadius: '10px',
                                  padding: '1px 5px',
                                  fontSize: '0.66rem',
                                  fontWeight: 700,
                                }}
                              >
                                {f.countChanged}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Tabs for Preview */}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      borderBottom: '1px solid var(--border-subtle)',
                      marginBottom: '8px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveTab('changes')}
                      style={{
                        padding: '8px 14px',
                        border: 'none',
                        background: 'none',
                        borderBottom: `2px solid ${activeTab === 'changes' ? 'var(--accent-primary)' : 'transparent'}`,
                        color: activeTab === 'changes' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        fontWeight: activeTab === 'changes' ? 600 : 400,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                      }}
                    >
                      Changes Preview ({tracksWithActiveDiffs.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('all')}
                      style={{
                        padding: '8px 14px',
                        border: 'none',
                        background: 'none',
                        borderBottom: `2px solid ${activeTab === 'all' ? 'var(--accent-primary)' : 'transparent'}`,
                        color: activeTab === 'all' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        fontWeight: activeTab === 'all' ? 600 : 400,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                      }}
                    >
                      All Matched Tracks ({analysis.matchedTracks.length})
                    </button>

                    {analysis.unmatchedRows.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('unmatched')}
                        style={{
                          padding: '8px 14px',
                          border: 'none',
                          background: 'none',
                          borderBottom: `2px solid ${activeTab === 'unmatched' ? '#EF4444' : 'transparent'}`,
                          color: activeTab === 'unmatched' ? '#EF4444' : 'var(--text-secondary)',
                          fontWeight: activeTab === 'unmatched' ? 600 : 400,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                        }}
                      >
                        Unmatched Rows ({analysis.unmatchedRows.length})
                      </button>
                    )}
                  </div>

                  {/* Tab 1: Changes Preview */}
                  {activeTab === 'changes' && (
                    <div
                      style={{
                        flex: 1,
                        overflowY: 'auto',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        background: 'var(--bg-tertiary)',
                      }}
                    >
                      {tracksWithActiveDiffs.length === 0 ? (
                        <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          {analysis.totalChangedValues === 0 ? (
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                                All track values are already identical!
                              </div>
                              <p style={{ fontSize: '0.78rem', marginTop: '4px' }}>
                                The CSV data matches the tracks in your library with no differences.
                              </p>
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                                No changes in currently selected fields.
                              </div>
                              <p style={{ fontSize: '0.78rem', marginTop: '4px' }}>
                                Check the fields with change badges above to preview and apply changes.
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                          <thead
                            style={{
                              position: 'sticky',
                              top: 0,
                              background: 'var(--bg-secondary)',
                              borderBottom: '1px solid var(--border-subtle)',
                              textAlign: 'left',
                            }}
                          >
                            <tr>
                              <th style={{ padding: '8px 12px', width: '22%' }}>Track / File</th>
                              <th style={{ padding: '8px 12px', width: '18%' }}>Field</th>
                              <th style={{ padding: '8px 12px', width: '28%' }}>Current Library Value</th>
                              <th style={{ padding: '8px 12px', width: '32%' }}>New Value From CSV</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tracksWithActiveDiffs.map((match) => {
                              const activeDiffs = match.diffs.filter((d) => d.hasChanged && selectedFields.has(d.field));
                              return activeDiffs.map((diff, idx) => (
                                <tr
                                  key={`${match.track.id}-${diff.field}`}
                                  style={{
                                    borderBottom: '1px solid var(--border-subtle)',
                                    background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
                                  }}
                                >
                                  {idx === 0 ? (
                                    <td
                                      rowSpan={activeDiffs.length}
                                      style={{
                                        padding: '8px 12px',
                                        verticalAlign: 'top',
                                        borderRight: '1px solid var(--border-subtle)',
                                      }}
                                    >
                                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                        {match.track.cleanTitle || match.track.originalFileName}
                                      </div>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        {match.track.cleanArtist || 'Unknown'} • Row #{match.csvRowIndex + 1} ({match.matchedBy})
                                      </div>
                                    </td>
                                  ) : null}

                                  <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {diff.fieldLabel}
                                  </td>

                                  <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                                    <span
                                      style={{
                                        textDecoration: 'line-through',
                                        background: 'rgba(239, 68, 68, 0.08)',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        color: '#DC2626',
                                      }}
                                    >
                                      {diff.oldValue !== null && diff.oldValue !== undefined && String(diff.oldValue).trim() !== ''
                                        ? String(diff.oldValue)
                                        : '— (empty)'}
                                    </span>
                                  </td>

                                  <td style={{ padding: '8px 12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <ArrowRight size={12} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                                      <span
                                        style={{
                                          background: 'rgba(34, 197, 94, 0.12)',
                                          padding: '2px 8px',
                                          borderRadius: '4px',
                                          fontWeight: 600,
                                          color: '#15803D',
                                        }}
                                      >
                                        {diff.newValue !== null && diff.newValue !== undefined && String(diff.newValue).trim() !== ''
                                          ? String(diff.newValue)
                                          : '— (cleared)'}
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              ));
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* Tab 2: All Matched Tracks */}
                  {activeTab === 'all' && (
                    <div
                      style={{
                        flex: 1,
                        overflowY: 'auto',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        background: 'var(--bg-tertiary)',
                      }}
                    >
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                        <thead
                          style={{
                            position: 'sticky',
                            top: 0,
                            background: 'var(--bg-secondary)',
                            borderBottom: '1px solid var(--border-subtle)',
                            textAlign: 'left',
                          }}
                        >
                          <tr>
                            <th style={{ padding: '8px 12px' }}>#</th>
                            <th style={{ padding: '8px 12px' }}>Track Title</th>
                            <th style={{ padding: '8px 12px' }}>Producer</th>
                            <th style={{ padding: '8px 12px' }}>Matched Via</th>
                            <th style={{ padding: '8px 12px' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysis.matchedTracks.map((m, idx) => {
                            const changedCount = m.diffs.filter((d) => d.hasChanged && selectedFields.has(d.field)).length;
                            return (
                              <tr key={m.track.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{m.track.cleanTitle}</td>
                                <td style={{ padding: '8px 12px' }}>{m.track.cleanArtist}</td>
                                <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                                  <span style={{ textTransform: 'capitalize' }}>{m.matchedBy.replace('_', ' ')}</span>
                                </td>
                                <td style={{ padding: '8px 12px' }}>
                                  {changedCount > 0 ? (
                                    <span
                                      style={{
                                        background: 'var(--accent-light)',
                                        color: 'var(--accent-primary)',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontWeight: 600,
                                        fontSize: '0.72rem',
                                      }}
                                    >
                                      {changedCount} fields to update
                                    </span>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>No changes</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Tab 3: Unmatched Rows */}
                  {activeTab === 'unmatched' && (
                    <div
                      style={{
                        flex: 1,
                        overflowY: 'auto',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        background: 'var(--bg-tertiary)',
                        padding: '12px',
                      }}
                    >
                      <div
                        style={{
                          marginBottom: '10px',
                          fontSize: '0.78rem',
                          color: '#EF4444',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <AlertCircle size={16} />
                        <span>The following {analysis.unmatchedRows.length} rows in the CSV did not match any loaded track:</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {analysis.unmatchedRows.map((u) => (
                          <div
                            key={u.rowIndex}
                            style={{
                              padding: '8px 12px',
                              borderRadius: '6px',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-subtle)',
                              fontSize: '0.75rem',
                            }}
                          >
                            <strong>CSV Row #{u.rowIndex + 1}:</strong>{' '}
                            <span style={{ color: 'var(--text-secondary)' }}>
                              {u.rawRow['Title'] || u.rawRow['Clean Title'] || u.rawRow['Track ID'] || JSON.stringify(u.rawRow)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          )}
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />

        {/* Modal Footer */}
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div>
            {analysis && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Ready to update <strong>{tracksWithActiveDiffs.length} tracks</strong> (
                <strong>
                  {analysis.matchedTracks.reduce(
                    (acc, m) => acc + m.diffs.filter((d) => d.hasChanged && selectedFields.has(d.field)).length,
                    0
                  )}{' '}
                  field values
                </strong>
                )
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            {parsedCsv && (
              <button
                className="btn-primary"
                onClick={handleExecuteApply}
                disabled={!analysis || analysis.matchedTracks.length === 0 || selectedFields.size === 0}
              >
                <Check size={16} />
                <span>Apply CSV Updates</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
