import React, { useState, useEffect, useCallback } from 'react';
import { ToastMessage, TrackItem } from './types';
import {
  openAudioFiles,
  openAudioDirectory,
  executeBatchProcess,
  analyzeTrackDsp,
  loadTracksFromWebFiles,
  loadTracksFromPaths,
} from './services/apiBridge';
import { fireConfetti } from './utils/confetti';
import { useTrackLibrary } from './hooks/useTrackLibrary';

// Components
import { Header } from './components/Header';
import { Toolbar } from './components/Toolbar';
import { Dropzone } from './components/Dropzone';
import { TrackGrid } from './components/TrackGrid';
import { DownloaderView } from './components/downloader/DownloaderView';
import { CamelotWheelModal } from './components/CamelotWheelModal';
import { CleanSettingsModal } from './components/CleanSettingsModal';
import { FindReplaceModal } from './components/FindReplaceModal';
import { BulkEditModal } from './components/BulkEditModal';
import { ExportModal } from './components/ExportModal';
import { ImportCsvModal } from './components/ImportCsvModal';
import { Toast } from './components/Toast';

export const App: React.FC = () => {
  // Theme state: light default per user specification
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('tvr_theme') as 'light' | 'dark') || 'light';
    } catch {
      return 'light';
    }
  });

  // 2-in-1 Mode: 'organizer' | 'downloader'
  const [activeMode, setActiveMode] = useState<'organizer' | 'downloader'>(() => {
    try {
      return (localStorage.getItem('tvr_active_mode') as 'organizer' | 'downloader') || 'organizer';
    } catch {
      return 'organizer';
    }
  });

  const handleSelectMode = useCallback((mode: 'organizer' | 'downloader') => {
    setActiveMode(mode);
    try {
      localStorage.setItem('tvr_active_mode', mode);
    } catch {}
  }, []);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      setToasts((prev) => [...prev, { id, type, title, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Library State Hook
  const {
    tracks,
    setTracks,
    selectedTrackIds,
    setSelectedTrackIds,
    activePreset,
    setActivePreset,
    searchQuery,
    setSearchQuery,
    filterMode,
    setFilterMode,
    cleanConfig,
    activeTemplate,
    filteredTracks,
    updateTrack,
    batchUpdateTracksByIds,
    batchUpdateTracks,
    appendTracks,
    autoCleanAll,
    cleanAllFields,
    syncNameAndTitle,
    updateTemplate,
    setDefaultTemplate,
    updateCleanConfig,
    pasteData,
    copySelected,
  } = useTrackLibrary(addToast);


  // DSP Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dspProgress, setDspProgress] = useState(0);

  // Modals state
  const [isCamelotModalOpen, setIsCamelotModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isFindReplaceModalOpen, setIsFindReplaceModalOpen] = useState(false);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportCsvModalOpen, setIsImportCsvModalOpen] = useState(false);
  const [pendingCsvFile, setPendingCsvFile] = useState<File | null>(null);

  // Stable modal openers
  const handleOpenExport = useCallback(() => setIsExportModalOpen(true), []);
  const handleOpenImportCsv = useCallback(() => {
    setPendingCsvFile(null);
    setIsImportCsvModalOpen(true);
  }, []);
  const handleOpenSettings = useCallback(() => setIsSettingsModalOpen(true), []);
  const handleOpenBulkEdit = useCallback(() => setIsBulkEditModalOpen(true), []);
  const handleOpenFindReplace = useCallback(() => setIsFindReplaceModalOpen(true), []);
  const handleOpenCamelotWheel = useCallback(() => setIsCamelotModalOpen(true), []);

  // Detect macOS platform for traffic lights inset
  useEffect(() => {
    const isMac =
      (window as any).api?.platform === 'darwin' ||
      navigator.platform?.toUpperCase().indexOf('MAC') >= 0 ||
      navigator.userAgent.includes('Mac');
    if (isMac) {
      document.documentElement.classList.add('is-mac');
      document.documentElement.setAttribute('data-platform', 'darwin');
    }
  }, []);

  // Apply Theme to document root and persist
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('tvr_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Toggle Theme
  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  // File Ingestion Handlers
  const handleOpenFiles = useCallback(async () => {
    try {
      const loaded = await openAudioFiles();
      if (loaded.length > 0) appendTracks(loaded);
    } catch (err: any) {
      addToast('error', 'File Open Error', err.message);
    }
  }, [appendTracks, addToast]);

  const handleOpenDirectory = useCallback(async () => {
    try {
      const loaded = await openAudioDirectory();
      if (loaded.length > 0) appendTracks(loaded);
    } catch (err: any) {
      addToast('error', 'Directory Open Error', err.message);
    }
  }, [appendTracks, addToast]);


  const handleFilesDropped = useCallback(
    async (files: File[]) => {
      const csvFile = files.find((f) => /\.(csv|tsv)$/i.test(f.name));
      const audioFiles = files.filter((f) => /\.(mp3|flac|wav|aiff|aif)$/i.test(f.name));

      if (csvFile) {
        setPendingCsvFile(csvFile);
        setIsImportCsvModalOpen(true);
      }
      if (audioFiles.length > 0) {
        const loaded = await loadTracksFromWebFiles(audioFiles);
        appendTracks(loaded);
      }
    },
    [appendTracks]
  );

  // 2-in-1 Bridge: Ingest downloaded files directly into the Tag Editor
  const handleSendToTagEditor = useCallback(
    async (filePaths: string[]) => {
      if (!filePaths || !filePaths.length) return;
      try {
        addToast('info', 'Loading into Tag Editor', `Ingesting ${filePaths.length} downloaded track(s)...`);
        const loadedTracks = await loadTracksFromPaths(filePaths);
        if (loadedTracks.length > 0) {
          appendTracks(loadedTracks);
          setSelectedTrackIds(loadedTracks.map((t) => t.id));
          handleSelectMode('organizer');
          fireConfetti();
          addToast(
            'success',
            'Tracks Ingested',
            `Loaded ${loadedTracks.length} track(s) into the Tag Editor spreadsheet!`
          );
        }
      } catch (err: any) {
        addToast('error', 'Import Failed', err.message || 'Could not load tracks into Tag Editor');
      }
    },
    [appendTracks, setSelectedTrackIds, handleSelectMode, addToast]
  );

  // Auto-clean Tags Trigger
  const handleAutoClean = useCallback(() => {
    const count = autoCleanAll();
    if (count > 0) {
      fireConfetti();
      addToast(
        'success',
        'Tags Cleaned Successfully',
        `Standardized titles & file names following template for ${count} tracks.`
      );
    }
  }, [autoCleanAll, addToast]);

  // Clean all fields trigger
  const handleCleanAllFields = useCallback(() => {
    const count = cleanAllFields();
    if (count > 0) {
      addToast(
        'success',
        'Fields Cleaned Up',
        `Cleaned all tag fields (kept FileName, Tag Format, Bit Rate, Duration, File Size, Codec, File Path) for ${count} ${count === 1 ? 'track' : 'tracks'}.`
      );
    }
  }, [cleanAllFields, addToast]);

  // Sync Name and Title trigger
  const handleSyncNameAndTitle = useCallback(() => {
    const count = syncNameAndTitle();
    if (count > 0) {
      addToast(
        'success',
        'Sync Complete',
        `Set FileName(Rename Template) to Title for ${count} ${count === 1 ? 'track' : 'tracks'}.`
      );
    }
  }, [syncNameAndTitle, addToast]);

  // DSP Audio Analysis Engine
  const handleRunBatchDsp = useCallback(async () => {
    if (tracks.length === 0 || isAnalyzing) return;

    setIsAnalyzing(true);
    setDspProgress(0);

    const pending = tracks.filter((t) => !t.bpm || !t.camelotKey);
    const targetTracks = pending.length > 0 ? pending : tracks;
    const total = targetTracks.length;
    let completed = 0;

    addToast(
      'info',
      'DSP Analysis Started',
      `Calculating rhythmic BPM & harmonic Camelot keys across ${total} tracks.`
    );

    const updatedMap = new Map<string, Partial<TrackItem>>();

    for (let i = 0; i < total; i++) {
      const trk = targetTracks[i];

      try {
        const dspResult = await analyzeTrackDsp(trk, (pct) => {
          setDspProgress(((completed + pct / 100) / total) * 100);
        });

        updatedMap.set(trk.id, {
          bpm: dspResult.bpm,
          camelotKey: dspResult.camelotKey,
          standardKey: dspResult.standardKey,
          duration: dspResult.duration,
          status: 'idle',
        });
      } catch (err: any) {
        console.error('DSP error on', trk.cleanTitle, err);
        updatedMap.set(trk.id, { status: 'error', errorMessage: 'DSP analysis failed' });
      }

      completed++;
      setDspProgress((completed / total) * 100);
    }

    setTracks((prev) =>
      prev.map((t) => {
        const update = updatedMap.get(t.id);
        return update ? { ...t, ...update } : t;
      })
    );

    setIsAnalyzing(false);
    setDspProgress(100);
    fireConfetti();
    addToast(
      'success',
      'DSP Analysis Complete',
      `Successfully extracted BPM and harmonic keys for ${total} tracks.`
    );
  }, [tracks, isAnalyzing, setTracks, addToast]);

  // Save and rename files
  const processAndSaveTracks = useCallback(
    async (targetTracks: TrackItem[], isSelectedOnly: boolean) => {
      if (targetTracks.length === 0) return;

      addToast(
        'info',
        'Serializing Tags & Renaming',
        isSelectedOnly
          ? `Writing Rekordbox ID3v2.3 tags and renaming ${targetTracks.length} selected ${targetTracks.length === 1 ? 'file' : 'files'} on disk in-place...`
          : `Writing Rekordbox ID3v2.3 tags and renaming files on disk in-place...`
      );

      const request = {
        tracks: targetTracks.map((t) => {
          const originalExt = t.filePath.includes('.') ? '.' + t.filePath.split('.').pop() : '';
          const cleanBase = (t.targetFileName || t.originalFileName || '')
            .trim()
            .replace(/\.[a-zA-Z0-9]+$/, '')
            .trim();
          const targetFileNameWithExt = originalExt ? `${cleanBase}${originalExt}` : cleanBase;

          return {
            id: t.id,
            filePath: t.filePath,
            newArtist: t.cleanArtist,
            newTitle: t.cleanTitle,
            newMix: t.mixVersion,
            album: t.album,
            genre: t.genre,
            year: t.year,
            albumArtist: t.albumArtist,
            trackNumber: t.trackNumber,
            tracksTotal: t.tracksTotal,
            comments: t.comments,
            artworkUrl: t.artworkUrl,
            bpm: t.bpm || undefined,
            camelotKey: t.camelotKey || undefined,
            targetFileName: targetFileNameWithExt,
          };
        }),
      };

      try {
        const result = await executeBatchProcess(request);
        const resultMap = new Map(result.results?.map((r) => [r.id, r]));

        setTracks((prev) =>
          prev.map((t) => {
            const res = resultMap.get(t.id);
            if (res) {
              const updatedOriginal = res.newFilePath.split(/[/\\]/).pop() || t.originalFileName;
              return {
                ...t,
                status: res.status,
                filePath: res.newFilePath,
                originalFileName: updatedOriginal,
                targetFileName: updatedOriginal.replace(/\.[a-zA-Z0-9]+$/, '').trim(),
                errorMessage: res.error,
              };
            }
            return t;
          })
        );

        if (result.errorCount > 0) {
          addToast(
            'error',
            isSelectedOnly ? 'Save Selected Completed with Errors' : 'Batch Rename Completed with Errors',
            `Successfully saved ${result.successCount} files. ${result.errorCount} files failed (highlighted in red).`
          );
        } else {
          fireConfetti();
          addToast(
            'success',
            isSelectedOnly ? 'Selected Files Saved & Renamed' : 'All Files Saved & Renamed',
            isSelectedOnly
              ? `Successfully wrote ID3v2.3 tags and renamed ${result.successCount} selected ${result.successCount === 1 ? 'file' : 'files'} in-place.`
              : `Successfully wrote ID3v2.3 tags and renamed ${result.successCount} files in-place.`
          );
        }
      } catch (err: any) {
        addToast('error', 'Execution Error', err.message);
      }
    },
    [setTracks, addToast]
  );

  const handleSaveAndRenameAll = useCallback(async () => {
    if (tracks.length === 0) return;
    await processAndSaveTracks(tracks, false);
  }, [tracks, processAndSaveTracks]);

  const handleSaveSelected = useCallback(async () => {
    if (tracks.length === 0) return;
    const targetTracks = tracks.filter((t) => selectedTrackIds.includes(t.id));
    if (targetTracks.length === 0) {
      addToast('warning', 'No Tracks Selected', 'Please select at least one track to save.');
      return;
    }
    await processAndSaveTracks(targetTracks, true);
  }, [tracks, selectedTrackIds, processAndSaveTracks, addToast]);

  // Global Save shortcut (Cmd+S / Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (selectedTrackIds.length > 0) {
          handleSaveSelected();
        } else if (tracks.length > 0) {
          handleSaveAndRenameAll();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tracks, selectedTrackIds, handleSaveSelected, handleSaveAndRenameAll]);

  // Clipboard TSV copy handler
  const handleCopySelectedTracks = useCallback(() => {
    copySelected().then((count) => {
      addToast('success', 'Copied to Clipboard', `Copied ${count} tracks as spreadsheet TSV data.`);
    });
  }, [copySelected, addToast]);

  // Clipboard TSV paste handler
  const handlePasteSpreadsheetData = useCallback(
    (text: string, targetRowIndex: number, targetColKey: string) => {
      pasteData(text, targetRowIndex, targetColKey);
      addToast('success', 'Spreadsheet Data Pasted', `Updated rows starting from row #${targetRowIndex + 1}.`);
    },
    [pasteData, addToast]
  );

  return (
    <div
      className="app-container"
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          e.preventDefault();
          handleFilesDropped(Array.from(e.dataTransfer.files));
        }
      }}
    >
      {/* Top Header */}
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        tracks={tracks}
        selectedCount={selectedTrackIds.length}
        isAnalyzing={isAnalyzing}
        dspProgress={dspProgress}
        activeMode={activeMode}
        onSelectMode={handleSelectMode}
        onRunBatchDsp={handleRunBatchDsp}
        onSaveAndRenameAll={handleSaveAndRenameAll}
        onSaveSelected={handleSaveSelected}
        onOpenExport={handleOpenExport}
        onOpenImportCsv={handleOpenImportCsv}
        onOpenSettings={handleOpenSettings}
      />

      {activeMode === 'downloader' ? (
        <main className="app-main-content" style={{ padding: 0 }}>
          <DownloaderView
            onSendToTagEditor={handleSendToTagEditor}
            addToast={addToast}
          />
        </main>
      ) : (
        <>
          {/* Main Toolbar */}
          <Toolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filterMode={filterMode}
            onFilterModeChange={setFilterMode}
            activePreset={activePreset}
            onPresetChange={setActivePreset}
            selectedCount={selectedTrackIds.length}
            onAutoClean={handleAutoClean}
            onSyncNameAndTitle={handleSyncNameAndTitle}
            onCleanAllFields={handleCleanAllFields}
            onSaveSelected={handleSaveSelected}
            onOpenBulkEdit={handleOpenBulkEdit}
            onOpenFindReplace={handleOpenFindReplace}
            onOpenCamelotWheel={handleOpenCamelotWheel}
            onAddFiles={handleOpenFiles}
            onAddDirectory={handleOpenDirectory}
          />

          {/* Main Content Area */}
          <main className="app-main-content">
            {tracks.length === 0 ? (
              <Dropzone
                onFilesDropped={handleFilesDropped}
                onOpenFiles={handleOpenFiles}
                onOpenDirectory={handleOpenDirectory}
              />
            ) : (
              <TrackGrid
                tracks={filteredTracks}
                preset={activePreset}
                onUpdateTrack={updateTrack}
                onBatchUpdateTracks={batchUpdateTracksByIds}
                onSelectionChange={setSelectedTrackIds}
                onPasteData={handlePasteSpreadsheetData}
                onCopySelected={handleCopySelectedTracks}
              />
            )}
          </main>
        </>
      )}

      {/* Modals & Dialogs */}
      <CamelotWheelModal
        isOpen={isCamelotModalOpen}
        onClose={() => setIsCamelotModalOpen(false)}
        onFilterByKey={(key) => setFilterMode(`key:${key}`)}
      />

      <CleanSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        config={cleanConfig}
        onSaveConfig={(newConfig) => {
          updateCleanConfig(newConfig);
          addToast('success', 'Rules Saved', 'Updated automated cleaning patterns.');
        }}
        activeTemplate={activeTemplate}
        onSaveTemplate={(tmpl) => {
          updateTemplate(tmpl);
          addToast('success', 'Template Applied', 'Updated Track Titles & File Names to follow template.');
        }}
        onSetDefaultTemplate={(tmpl) => {
          setDefaultTemplate(tmpl);
          addToast('success', 'Default Template Set', `"${tmpl}" is now set as the default template.`);
        }}
      />

      <FindReplaceModal
        isOpen={isFindReplaceModalOpen}
        onClose={() => setIsFindReplaceModalOpen(false)}
        tracks={tracks}
        onBatchUpdate={batchUpdateTracks}
        onShowToast={addToast}
      />

      <BulkEditModal
        isOpen={isBulkEditModalOpen}
        onClose={() => setIsBulkEditModalOpen(false)}
        selectedIds={selectedTrackIds}
        tracks={tracks}
        onSyncNameAndTitle={handleSyncNameAndTitle}
        onCleanAllFields={handleCleanAllFields}
        onApplyBulkEdit={(updates) => {
          batchUpdateTracksByIds(
            selectedTrackIds,
            updates,
            `Bulk updated ${selectedTrackIds.length} tracks.`
          );
        }}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        tracks={filteredTracks}
        onOpenImportCsv={() => {
          setIsExportModalOpen(false);
          setPendingCsvFile(null);
          setIsImportCsvModalOpen(true);
        }}
        onShowToast={addToast}
      />

      <ImportCsvModal
        isOpen={isImportCsvModalOpen}
        onClose={() => {
          setIsImportCsvModalOpen(false);
          setPendingCsvFile(null);
        }}
        libraryTracks={tracks}
        initialFile={pendingCsvFile}
        onApplyImport={(updatedList, summaryMessage) => {
          batchUpdateTracks(updatedList);
          addToast('success', 'CSV Metadata Imported', summaryMessage);
        }}
        onShowToast={addToast}
      />

      {/* Notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};
