import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './ui/Modal';
import { FileSpreadsheet, Check, RefreshCw, CheckSquare, Square } from 'lucide-react';
import { TrackItem, AddToast } from '../types';
import { parseCsvContent, analyzeCsvForImport, applyCsvImport, CsvImportAnalysis, MatchStrategy, ParsedCsv } from '../engine/csvEngine';
import { generateDelimitedData, downloadFile } from '../engine/exportEngine';
import { SelectDropdown } from './SelectDropdown';
import { CsvFileSelector } from './csv-import/CsvFileSelector';
import { CsvPreviewTabs, CsvPreviewTab } from './csv-import/CsvPreviewTabs';

interface ImportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  libraryTracks: TrackItem[];
  initialFile?: File | null;
  onApplyImport: (updatedTracks: TrackItem[], summaryMessage: string) => void;
  onShowToast: AddToast;
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
  const [activeTab, setActiveTab] = useState<CsvPreviewTab>('changes');
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
    <Modal
      onClose={onClose}
      title={<>Import CSV / Spreadsheet Metadata</>}
      subtitle={<>Import edited tags, BPM, keys, and filenames from Excel, Numbers, or Google Sheets</>}
      icon={<FileSpreadsheet size={18} />}
      width={840}
      style={{ height: '88vh', display: 'flex', flexDirection: 'column' }}
    >

        {/* Modal Body */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          {/* File Selection Zone if no file loaded */}
          {!parsedCsv ? (
            <CsvFileSelector
              isDragOver={isDragOver}
              isReadingFile={isReadingFile}
              hasLibraryTracks={libraryTracks.length > 0}
              onBrowse={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDownloadTemplate={handleDownloadTemplate}
            />
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
                    <label className="form-label" htmlFor="csv-match-strategy" style={{ marginBottom: '4px', fontSize: '0.78rem' }}>
                      Track Matching Strategy
                    </label>
                    <SelectDropdown<MatchStrategy>
                      id="csv-match-strategy"
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

                <CsvPreviewTabs
                  analysis={analysis}
                  tracksWithActiveDiffs={tracksWithActiveDiffs}
                  selectedFields={selectedFields}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                />
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
    </Modal>
  );
};
