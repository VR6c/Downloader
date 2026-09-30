import React, { useMemo } from 'react';
import {
  Disc,
  Sun,
  Moon,
  Save,
  Download,
  Activity,
  Sliders,
  AlertTriangle,
  Music,
  Upload,
  DownloadCloud,
  Layers,
} from 'lucide-react';
import { TrackItem } from '../types';
import { Button } from './ui';

interface HeaderProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  tracks: TrackItem[];
  selectedCount: number;
  isAnalyzing: boolean;
  dspProgress: number;
  activeMode: 'organizer' | 'downloader';
  onSelectMode: (mode: 'organizer' | 'downloader') => void;
  onRunBatchDsp: () => void;
  onSaveAndRenameAll: () => void;
  onSaveSelected?: () => void;
  onOpenExport: () => void;
  onOpenImportCsv?: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = React.memo(({
  theme,
  onToggleTheme,
  tracks,
  selectedCount,
  isAnalyzing,
  dspProgress,
  activeMode,
  onSelectMode,
  onRunBatchDsp,
  onSaveAndRenameAll,
  onSaveSelected,
  onOpenExport,
  onOpenImportCsv,
  onOpenSettings,
}) => {
  const { analyzedCount, qualityWarningsCount, errorCount } = useMemo(() => {
    let analyzed = 0;
    let warnings = 0;
    let errors = 0;
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      if (t.bpm && t.camelotKey) analyzed++;
      if (t.isQualityWarning) warnings++;
      if (t.status === 'error') errors++;
    }
    return { analyzedCount: analyzed, qualityWarningsCount: warnings, errorCount: errors };
  }, [tracks]);

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="brand-badge">
          <div className="brand-logo-icon">
            <Disc size={20} />
          </div>
          <div className="brand-title">
            <span className="brand-name">TVR Studio</span>
            <span className="brand-version">2-in-1</span>
          </div>
        </div>
      </div>

      <div className="header-center">
        {/* 2-in-1 Top-level Mode Switcher */}
        <div className="mode-switcher-pill">
          <button
            type="button"
            className={`mode-btn ${activeMode === 'downloader' ? 'active' : ''}`}
            onClick={() => onSelectMode('downloader')}
            title="Download YouTube & SoundCloud media streams to MP3 / MP4"
          >
            <DownloadCloud size={15} />
            <span className="mode-btn-text">Downloader</span>
          </button>
          <button
            type="button"
            className={`mode-btn ${activeMode === 'organizer' ? 'active' : ''}`}
            onClick={() => onSelectMode('organizer')}
            title="Clean tags, detect BPM/Camelot Key, and organize library"
          >
            <Layers size={15} />
            <span className="mode-btn-text mode-text-long">Tag Editor & Library</span>
            <span className="mode-btn-text mode-text-short">Tag Editor</span>
            {tracks.length > 0 && <span className="mode-badge">{tracks.length}</span>}
          </button>
        </div>

        {/* Stats Pill when in Tag Editor */}
        {activeMode === 'organizer' && tracks.length > 0 && (
          <div className="stats-pill" title={`Total: ${tracks.length} tracks | DSP Analyzed: ${analyzedCount}/${tracks.length}`}>
            <div className="stat-item" title="Total tracks loaded">
              <Music size={13} />
              <span className="stat-label">Tracks:</span>
              <strong>{tracks.length}</strong>
            </div>

            <div className="stat-divider" />

            <div className="stat-item" title="DSP Analyzed (BPM & Camelot Key)">
              <Activity size={13} style={{ color: 'var(--accent-primary)' }} />
              <span className="stat-label">Analyzed:</span>
              <strong>
                {analyzedCount}/{tracks.length}
              </strong>
            </div>

            {qualityWarningsCount > 0 && (
              <>
                <div className="stat-divider" />
                <div className="stat-item" title="Tracks with low bitrates or sample rates">
                  <AlertTriangle size={13} style={{ color: 'var(--warning)' }} />
                  <strong>{qualityWarningsCount}</strong>
                </div>
              </>
            )}

            {errorCount > 0 && (
              <>
                <div className="stat-divider" />
                <div className="stat-item" title="Filesystem write or rename errors">
                  <AlertTriangle size={13} style={{ color: 'var(--danger)' }} />
                  <strong>{errorCount}</strong>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="header-right">
        {activeMode === 'organizer' && tracks.length > 0 && (
          <>
            <Button
              variant="secondary"
              size="sm"
              icon={<Activity size={15} className={isAnalyzing ? 'spin' : ''} />}
              labelLong={isAnalyzing ? `${Math.round(dspProgress)}%` : 'Analyze'}
              onClick={onRunBatchDsp}
              disabled={isAnalyzing}
              title="Run asynchronous BPM and Camelot Key DSP audio analysis on all tracks"
            />

            {selectedCount > 0 && onSaveSelected ? (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Save size={15} />}
                  labelLong={`Save (${selectedCount})`}
                  onClick={onSaveSelected}
                  title={`Write ID3v2.3 tags and rename ${selectedCount} selected ${selectedCount === 1 ? 'file' : 'files'} on disk in-place`}
                />

                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Save size={15} />}
                  labelLong="Save All"
                  onClick={onSaveAndRenameAll}
                  title="Write ID3v2.3 tags and rename all files on disk in-place"
                />
              </>
            ) : (
              <Button
                variant="primary"
                size="sm"
                icon={<Save size={15} />}
                labelLong="Save All"
                onClick={onSaveAndRenameAll}
                title="Write ID3v2.3 tags and rename files on disk in-place"
              />
            )}

            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={15} />}
              labelLong="Export"
              onClick={onOpenExport}
              title="Export Playlists (M3U8 / Rekordbox XML) and CSV Metadata"
            />

            {onOpenImportCsv && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Upload size={15} />}
                labelLong="Import"
                onClick={onOpenImportCsv}
                title="Import edited CSV/TSV metadata into your library"
              />
            )}
          </>
        )}

        <Button
          variant="icon"
          size="sm"
          icon={<Sliders size={16} />}
          onClick={onOpenSettings}
          title="Cleaner Rules & Filename Templates"
        />

        <Button
          variant="icon"
          size="sm"
          icon={theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          onClick={onToggleTheme}
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode (Default)'}
        />
      </div>
    </header>
  );
});
