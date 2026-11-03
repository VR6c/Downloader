import React, { Suspense, lazy, useState, useEffect, useCallback } from 'react';
import { Theme, AppMode } from './types';
import {
  openAudioFiles,
  openAudioDirectory,
  loadTracksFromWebFiles,
  loadTracksFromPaths,
} from './services/apiBridge';
import { fireConfetti } from './utils/confetti';
import { hasPendingDownloadWork } from './services/downloaderService';
import { useTrackLibrary } from './hooks/useTrackLibrary';
import { usePersistentState } from './hooks/usePersistentState';
import { useToasts } from './hooks/useToasts';
import { useDspAnalysis } from './hooks/useDspAnalysis';
import { useSaveTracks } from './hooks/useSaveTracks';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';

// Components
import { Header } from './components/Header';
import { Toolbar } from './components/Toolbar';
import { Dropzone } from './components/Dropzone';
import { TrackGrid } from './components/TrackGrid';
import { CamelotWheelModal } from './components/CamelotWheelModal';
import { CleanSettingsModal } from './components/CleanSettingsModal';
import { FindReplaceModal } from './components/FindReplaceModal';
import { BulkEditModal } from './components/BulkEditModal';
import { ExportModal } from './components/ExportModal';
import { Toast } from './components/Toast';

// Code-split: only loaded when the user opens the downloader or the CSV importer
const DownloaderView = lazy(() =>
  import('./components/downloader/DownloaderView').then((m) => ({ default: m.DownloaderView }))
);
const ImportCsvModal = lazy(() => import('./components/ImportCsvModal').then((m) => ({ default: m.ImportCsvModal })));

type ModalName = 'camelot' | 'settings' | 'findReplace' | 'bulkEdit' | 'export' | 'importCsv';

const isTheme = (v: string): v is Theme => v === 'light' || v === 'dark';
const isAppMode = (v: string): v is AppMode => v === 'organizer' || v === 'downloader';
const errorMessage = (err: unknown, fallback = 'Unknown error') => (err instanceof Error ? err.message : fallback);

export const App: React.FC = () => {
  const [theme, setTheme] = usePersistentState<Theme>('tvr_theme', 'light', isTheme);
  const [activeMode, setActiveMode] = usePersistentState<AppMode>('tvr_active_mode', 'organizer', isAppMode);
  const { toasts, addToast, dismissToast } = useToasts();

  // The downloader owns live download/queue state, so once opened it stays mounted (hidden) while the
  // user works in the Tag Editor; unmounting would drop the queue and the engine's progress events.
  const [hasOpenedDownloader, setHasOpenedDownloader] = useState(activeMode === 'downloader');
  useEffect(() => {
    if (activeMode === 'downloader') setHasOpenedDownloader(true);
  }, [activeMode]);

  // After a window reload, resume downloads that were in flight even if the user is in the Tag Editor
  useEffect(() => {
    hasPendingDownloadWork().then((pending) => pending && setHasOpenedDownloader(true));
  }, []);

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

  const { isAnalyzing, progress: dspProgress, runBatchDsp } = useDspAnalysis(tracks, setTracks, addToast);
  const { saveAll: handleSaveAndRenameAll, saveSelected: handleSaveSelected } = useSaveTracks(
    tracks,
    selectedTrackIds,
    setTracks,
    addToast
  );

  // Only one modal is open at a time
  const [openModal, setOpenModal] = useState<ModalName | null>(null);
  const [pendingCsvFile, setPendingCsvFile] = useState<File | null>(null);
  const closeModal = useCallback(() => setOpenModal(null), []);
  const openCsvImport = useCallback((file: File | null = null) => {
    setPendingCsvFile(file);
    setOpenModal('importCsv');
  }, []);
  const handleOpenImportCsv = useCallback(() => openCsvImport(), [openCsvImport]);
  const handleOpenExport = useCallback(() => setOpenModal('export'), []);
  const handleOpenSettings = useCallback(() => setOpenModal('settings'), []);
  const handleOpenBulkEdit = useCallback(() => setOpenModal('bulkEdit'), []);
  const handleOpenFindReplace = useCallback(() => setOpenModal('findReplace'), []);
  const handleOpenCamelotWheel = useCallback(() => setOpenModal('camelot'), []);

  const handleSelectMode = setActiveMode;
  const toggleTheme = useCallback(() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light')), [setTheme]);

  // macOS: reserve space for the traffic-light controls
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

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // File Ingestion Handlers
  const handleOpenFiles = useCallback(async () => {
    try {
      const loaded = await openAudioFiles();
      if (loaded.length > 0) appendTracks(loaded);
    } catch (err) {
      addToast('error', 'File Open Error', errorMessage(err));
    }
  }, [appendTracks, addToast]);

  const handleOpenDirectory = useCallback(async () => {
    try {
      const loaded = await openAudioDirectory();
      if (loaded.length > 0) appendTracks(loaded);
    } catch (err) {
      addToast('error', 'Directory Open Error', errorMessage(err));
    }
  }, [appendTracks, addToast]);


  const handleFilesDropped = useCallback(
    async (files: File[]) => {
      const csvFile = files.find((f) => /\.(csv|tsv)$/i.test(f.name));
      const audioFiles = files.filter((f) => /\.(mp3|flac|wav|aiff|aif)$/i.test(f.name));

      if (csvFile) openCsvImport(csvFile);
      if (audioFiles.length > 0) {
        // If running in Electron and native file paths are available, load via loadTracksFromPaths
        const nativePaths = audioFiles.map((f: any) => f.path).filter(Boolean);
        if (nativePaths.length === audioFiles.length && (window as any).api?.isElectron) {
          try {
            const loaded = await loadTracksFromPaths(nativePaths);
            if (loaded.length > 0) {
              appendTracks(loaded);
              addToast('success', 'Files Added', `Loaded ${loaded.length} track(s) with tags & artwork.`);
              return;
            }
          } catch (err) {
            console.warn('Native path load failed, falling back to web file blobs:', err);
          }
        }

        const loaded = await loadTracksFromWebFiles(audioFiles);
        appendTracks(loaded);
      }
    },
    [appendTracks, addToast, openCsvImport]
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
      } catch (err) {
        addToast('error', 'Import Failed', errorMessage(err, 'Could not load tracks into Tag Editor'));
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

  useGlobalShortcuts([
    {
      key: 's',
      allowInInput: true,
      run: () => (selectedTrackIds.length > 0 ? handleSaveSelected() : tracks.length > 0 && handleSaveAndRenameAll()),
    },
    { key: 'o', shift: true, allowInInput: true, run: handleOpenDirectory },
    { key: 'o', shift: false, allowInInput: true, run: handleOpenFiles },
    { key: 'h', run: handleOpenFindReplace },
    { key: 'b', when: () => selectedTrackIds.length > 0, run: handleOpenBulkEdit },
    { key: 'e', run: handleOpenExport },
    { key: 'k', run: handleOpenCamelotWheel },
  ]);

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
        onRunBatchDsp={runBatchDsp}
        onSaveAndRenameAll={handleSaveAndRenameAll}
        onSaveSelected={handleSaveSelected}
        onOpenExport={handleOpenExport}
        onOpenImportCsv={handleOpenImportCsv}
        onOpenSettings={handleOpenSettings}
      />

      {hasOpenedDownloader && (
        <main
          className={`app-main-content${activeMode === 'downloader' ? '' : ' is-hidden'}`}
          style={{ padding: 0 }}
        >
          <Suspense fallback={null}>
            <DownloaderView
              isVisible={activeMode === 'downloader'}
              onSendToTagEditor={handleSendToTagEditor}
              addToast={addToast}
            />
          </Suspense>
        </main>
      )}

      {activeMode === 'organizer' && (
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
                selectedIds={selectedTrackIds}
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
        isOpen={openModal === 'camelot'}
        onClose={closeModal}
        onFilterByKey={(key) => setFilterMode(`key:${key}`)}
      />

      <CleanSettingsModal
        isOpen={openModal === 'settings'}
        onClose={closeModal}
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
        isOpen={openModal === 'findReplace'}
        onClose={closeModal}
        tracks={tracks}
        onBatchUpdate={batchUpdateTracks}
        onShowToast={addToast}
      />

      <BulkEditModal
        isOpen={openModal === 'bulkEdit'}
        onClose={closeModal}
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
        isOpen={openModal === 'export'}
        onClose={closeModal}
        tracks={filteredTracks}
        onOpenImportCsv={handleOpenImportCsv}
        onShowToast={addToast}
      />

      {openModal === 'importCsv' && (
        <Suspense fallback={null}>
          <ImportCsvModal
            isOpen
            onClose={() => {
              closeModal();
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
        </Suspense>
      )}

      {/* Notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};
