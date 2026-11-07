import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AddToast } from '../../types';
import { Download, ListPlus, History, Settings } from 'lucide-react';
import {
  DownloadProgress,
  DownloadHistoryItem,
  BatchQueueItem,
  DownloadSnapshotEntry,
} from '../../types/downloader';
import { getStoredHistory, addHistoryItem, removeHistoryItem, clearAllHistory, subscribeDownloadProgress, subscribeDownloadStatus, subscribeDownloadComplete, subscribeDownloadError, subscribeDownloadAborted, startDownload, getDownloadSnapshot, ackDownload, normalizeProgress, getDefaultDownloadDir, selectDownloadDirectory, formatBytes } from '../../services/downloaderService';
import { SingleDownloadTab } from './SingleDownloadTab';
import { BatchQueueTab } from './BatchQueueTab';
import { DownloadHistoryTab } from './DownloadHistoryTab';
import { DownloaderSettingsTab } from './DownloaderSettingsTab';
import { isElectronEnv } from '../../services/apiBridge';

interface DownloaderViewProps {
  /** false while the app shows another mode; the view stays mounted so downloads keep running. */
  isVisible?: boolean;
  onSendToTagEditor: (filePaths: string[]) => void;
  addToast: AddToast;
}

// The web version has no Settings tab: its folder is the browser's and it updates itself
const isDesktop = isElectronEnv();

const BATCH_STORAGE_KEY = 'tvr_dl_batch_state';
const PROGRESS_RENDER_INTERVAL_MS = 80;

interface PersistedBatchState {
  queue: BatchQueueItem[];
  running: boolean;
  outputDir: string;
}

/** sessionStorage survives a window reload but not an app restart, so a stale queue never outlives its downloads. */
function loadBatchState(): PersistedBatchState {
  // Batch Queue is desktop only: the web version never restores (or resumes) a queue
  if (!isDesktop) return { queue: [], running: false, outputDir: '' };
  try {
    const raw = sessionStorage.getItem(BATCH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.queue)) {
        return { queue: parsed.queue, running: Boolean(parsed.running), outputDir: String(parsed.outputDir || '') };
      }
    }
  } catch {
    // corrupted or unavailable storage: start fresh
  }
  return { queue: [], running: false, outputDir: '' };
}

export const DownloaderView: React.FC<DownloaderViewProps> = ({
  isVisible = true,
  onSendToTagEditor,
  addToast,
}) => {
  // Restored after a window reload so the user lands back on the tab they were using
  const [subTab, setSubTab] = useState<'single' | 'batch' | 'history' | 'settings'>(() => {
    try {
      const stored = sessionStorage.getItem('tvr_dl_subtab');
      if (stored === 'single' || stored === 'history' || ((stored === 'batch' || stored === 'settings') && isDesktop)) return stored;
    } catch {
      // storage unavailable
    }
    return 'single';
  });
  useEffect(() => {
    try {
      sessionStorage.setItem('tvr_dl_subtab', subTab);
    } catch {
      // storage unavailable
    }
  }, [subTab]);

  // History State
  const [history, setHistory] = useState<DownloadHistoryItem[]>(() => getStoredHistory());

  // Batch Queue State
  const [initialBatch] = useState(loadBatchState);
  const [batchQueue, setBatchQueue] = useState<BatchQueueItem[]>(initialBatch.queue);
  const [batchOutputDir, setBatchOutputDir] = useState(initialBatch.outputDir);
  const [isBatchRunning, setIsBatchRunning] = useState(initialBatch.running);

  // Initialize batch output directory from default (unless restored from before a reload)
  useEffect(() => {
    getDefaultDownloadDir().then((dir) => {
      if (dir) setBatchOutputDir((current) => current || dir);
    });
  }, []);

  // Keep the queue across window reloads (debounced: progress updates it ~60x/s)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const state: PersistedBatchState = { queue: batchQueue, running: isBatchRunning, outputDir: batchOutputDir };
        sessionStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(state));
      } catch {
        // storage unavailable
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [batchQueue, isBatchRunning, batchOutputDir]);

  // Active Download State
  const [activeDownload, setActiveDownload] = useState<DownloadProgress | null>(null);
  const [activeDownloadInfo, setActiveDownloadInfo] = useState<{ title: string; url: string; format: string; author?: string } | null>(null);
  const [lastCompletedFile, setLastCompletedFile] = useState<{ filePath: string; filename: string; title: string } | null>(null);

  // A download has been requested but the engine hasn't reported progress yet.
  // Together with activeDownload this is the single source of truth for "a download is in flight".
  const [isStartPending, setIsStartPending] = useState(false);
  // True until the main process has told us what is already running (after a reload). The batch runner
  // waits for it, otherwise it could launch a second download next to one that survived the refresh.
  const [isRestoring, setIsRestoring] = useState(true);
  const isDownloadBusy = isStartPending || activeDownload !== null;

  // Read by the long-lived IPC subscriptions below without forcing them to re-subscribe
  const activeInfoRef = useRef(activeDownloadInfo);
  activeInfoRef.current = activeDownloadInfo;
  const latestProgressRef = useRef<DownloadProgress | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishedIdsRef = useRef(new Set<string>());
  // Downloads we have already heard from live; the post-reload snapshot must never overwrite newer data
  const liveSeenIdsRef = useRef(new Set<string>());

  // Never leave the UI locked if the engine dies before emitting a single event
  useEffect(() => {
    if (!isStartPending) return;
    const timer = setTimeout(() => setIsStartPending(false), 45000);
    return () => clearTimeout(timer);
  }, [isStartPending]);

  // Preferences & Diagnostics
  const [autoClipboard, setAutoClipboard] = useState<boolean>(() => {
    try {
      // Only the desktop Settings tab can switch it off again
      return isDesktop && localStorage.getItem('tvr_dl_auto_clipboard') === 'true';
    } catch {
      return false;
    }
  });

  // Subscribe to real-time Electron IPC download events (once; handlers read refs for fresh values)
  useEffect(() => {
    const cancelPendingProgress = () => {
      if (progressTimerRef.current !== null) clearTimeout(progressTimerRef.current);
      progressTimerRef.current = null;
      latestProgressRef.current = null;
    };

    // Terminal events: drop any queued progress frame so a late tick can't resurrect the finished download
    const finish = (id: string) => {
      finishedIdsRef.current.add(id);
      cancelPendingProgress();
      setIsStartPending(false);
      setActiveDownload(null);
    };

    const updateQueueItem = (id: string, patch: Partial<BatchQueueItem>) =>
      setBatchQueue((prev) => (prev.some((q) => q.id === id) ? prev.map((q) => (q.id === id ? { ...q, ...patch } : q)) : prev));

    // Coalesce progress bursts: render at most ~12x/s, latest wins. A timer (not requestAnimationFrame)
    // so updates still apply while the window is minimized or covered.
    const flushProgress = () => {
      progressTimerRef.current = null;
      const data = latestProgressRef.current;
      latestProgressRef.current = null;
      if (!data || finishedIdsRef.current.has(data.id)) return;
      liveSeenIdsRef.current.add(data.id);
      setIsStartPending(false);
      setActiveDownload(data);
      updateQueueItem(data.id, { status: 'downloading', progress: data.percent, phase: data.phase });
    };

    const unsubProgress = subscribeDownloadProgress((data) => {
      latestProgressRef.current = data;
      if (progressTimerRef.current === null) progressTimerRef.current = setTimeout(flushProgress, PROGRESS_RENDER_INTERVAL_MS);
    });

    const unsubStatus = subscribeDownloadStatus((data) => {
      if (finishedIdsRef.current.has(data.id)) return;
      liveSeenIdsRef.current.add(data.id);
      const phase = data.message || data.phase;
      // Status events precede the first progress tick: surface the card (and the busy state) immediately
      setActiveDownload((prev) => (prev ? { ...prev, phase } : { id: data.id, percent: 0, phase }));
    });

    const onComplete = (data: any) => {
      finish(data.id);
      const info = activeInfoRef.current;
      const resolvedPath = data.file_path || data.output_path || data.filePath || '';
      const resolvedName = data.filename || (resolvedPath ? resolvedPath.split(/[/\\]/).pop() : 'downloaded_track.mp3');

      // Resolve human-readable title (never raw URL)
      const isUrl = (t?: string) => !t || t.startsWith('http://') || t.startsWith('https://');
      let resolvedTitle = data.title;
      if (isUrl(resolvedTitle)) {
        resolvedTitle = info?.title && !isUrl(info.title) ? info.title : resolvedName.replace(/\.[^/.]+$/, '');
      }

      setLastCompletedFile({ filePath: resolvedPath, filename: resolvedName, title: resolvedTitle });

      const resolvedSize = data.filesize || data.file_size || data.fileSize || 0;
      const resolvedSizeStr = data.filesize_str || data.file_size_str || (resolvedSize ? formatBytes(resolvedSize) : undefined);

      // Add to persistent history
      // A result replayed after a reload must never create a second history entry for the same file
      const alreadyRecorded = getStoredHistory().some((h) => h.filePath === resolvedPath && Date.now() - h.timestamp < 60000);
      if (resolvedPath && !alreadyRecorded) {
        const historyItem: DownloadHistoryItem = {
          id: `hist_${Date.now()}`,
          title: resolvedTitle,
          author: data.author || info?.author || (info?.title && info.title !== resolvedTitle ? info.title : 'TVR Downloader'),
          url: info?.url || data.url || '',
          format: (info?.format as any) || 'mp3',
          quality: '320',
          filePath: resolvedPath,
          fileName: resolvedName,
          fileSize: resolvedSize,
          fileSizeStr: resolvedSizeStr,
          timestamp: Date.now(),
        };
        setHistory(addHistoryItem(historyItem));
      }

      updateQueueItem(data.id, { status: 'completed', progress: 100, resultFilePath: resolvedPath });
      addToast('success', 'Download Complete', `Saved: ${resolvedName}`);
      ackDownload(data.id);
    };
    const unsubComplete = subscribeDownloadComplete(onComplete);

    const onError = (data: { id: string; error_code?: string; details?: string }) => {
      finish(data.id);
      updateQueueItem(data.id, { status: 'error', error: data.details || data.error_code });
      addToast('error', 'Download Failed', data.details || 'An error occurred during download.');
      ackDownload(data.id);
    };
    const unsubError = subscribeDownloadError(onError);

    const onAborted = (data: { id: string; message?: string }) => {
      finish(data.id);
      updateQueueItem(data.id, { status: 'cancelled' });
      addToast('warning', 'Download Aborted', data.message || 'Cancelled by user');
      ackDownload(data.id);
    };
    const unsubAborted = subscribeDownloadAborted(onAborted);

    // After a window reload this component starts empty while the main process kept downloading:
    // rebuild from its snapshot (running downloads + results that landed while we were away).
    let disposed = false;
    const restore = async () => {
      const entries: DownloadSnapshotEntry[] = await getDownloadSnapshot();
      if (disposed) return;

      const knownIds = new Set(entries.map((e) => e.id));
      for (const entry of entries) {
        if (entry.status === 'running') {
          activeInfoRef.current = entry.info.url
            ? { title: entry.info.title || entry.info.url, url: entry.info.url, format: entry.info.format || 'mp3', author: entry.info.author }
            : activeInfoRef.current;
          setActiveDownloadInfo(activeInfoRef.current);
          if (!liveSeenIdsRef.current.has(entry.id) && !finishedIdsRef.current.has(entry.id)) {
            setActiveDownload(
              entry.progress
                ? { ...normalizeProgress(entry.progress), id: entry.id, phase: entry.phase || 'downloading' }
                : { id: entry.id, percent: 0, phase: entry.phase || 'Resuming…' }
            );
            updateQueueItem(entry.id, { status: 'downloading', progress: (entry.progress as any)?.percent ?? 0 });
          }
        } else if (entry.result) {
          // Replay a terminal result that arrived while the page was reloading
          activeInfoRef.current = entry.info.url
            ? { title: entry.info.title || entry.info.url, url: entry.info.url, format: entry.info.format || 'mp3', author: entry.info.author }
            : activeInfoRef.current;
          if (entry.status === 'completed') onComplete(entry.result);
          else if (entry.status === 'aborted') onAborted(entry.result as any);
          else onError(entry.result as any);
        }
      }

      // Queue items that claim to be downloading but that the engine knows nothing about were interrupted
      setBatchQueue((prev) =>
        prev.some((q) => q.status === 'downloading' && !knownIds.has(q.id))
          ? prev.map((q) =>
              q.status === 'downloading' && !knownIds.has(q.id)
                ? { ...q, status: 'error', error: 'Interrupted (the app was restarted)' }
                : q
            )
          : prev
      );
      setIsRestoring(false);
    };
    restore();

    return () => {
      disposed = true;
      cancelPendingProgress();
      unsubProgress();
      unsubStatus();
      unsubComplete();
      unsubError();
      unsubAborted();
    };
  }, [addToast]);

  // Batch Processor: strictly one download at a time
  useEffect(() => {
    if (!isBatchRunning || isDownloadBusy || isRestoring) return; // wait for the in-flight download to finish

    const nextItem = batchQueue.find((q) => q.status === 'queued');
    if (!nextItem) {
      setIsBatchRunning(false);
      addToast('success', 'Batch Complete', 'All queued items have been processed.');
      return;
    }

    const failItem = (message: string) => {
      setIsStartPending(false);
      setBatchQueue((prev) => prev.map((q) => (q.id === nextItem.id ? { ...q, status: 'error', error: message } : q)));
    };

    // Lock before awaiting the engine so this effect can't start a second item in parallel
    finishedIdsRef.current.delete(nextItem.id);
    setIsStartPending(true);
    setBatchQueue((prev) =>
      prev.map((q) => (q.id === nextItem.id ? { ...q, status: 'downloading', progress: 0 } : q))
    );
    setActiveDownloadInfo({
      title: nextItem.title || nextItem.url,
      url: nextItem.url,
      format: nextItem.format,
    });

    startDownload({
      id: nextItem.id,
      url: nextItem.url,
      format: nextItem.format,
      quality: nextItem.quality,
      output_dir: batchOutputDir || undefined,
      embed_thumbnail: true,
      embed_metadata: true,
      title: nextItem.title,
      author: nextItem.author,
    })
      .then((res) => {
        if (!res.success) failItem(res.message || 'Could not start download');
      })
      .catch((err) => failItem(err.message));
  }, [isBatchRunning, batchQueue, isDownloadBusy, isRestoring, batchOutputDir, addToast]);

  // Batch Handlers
  const handleBrowseBatchFolder = async () => {
    const selected = await selectDownloadDirectory(batchOutputDir);
    if (selected) setBatchOutputDir(selected);
  };

  const handleAddBatchUrls = (
    urls: string[],
    format: 'mp3' | 'mp4' | 'mov',
    quality: string
  ) => {
    const newItems: BatchQueueItem[] = urls.map((u, i) => ({
      id: `queue_${Date.now()}_${i}`,
      url: u,
      format,
      quality,
      status: 'queued',
    }));
    setBatchQueue((prev) => [...prev, ...newItems]);
    addToast('success', 'Added to Queue', `Added ${newItems.length} track(s).`);
  };

  const handleAddToBatch = useCallback(
    (item: { url: string; format: 'mp3' | 'mp4' | 'mov'; quality: string; title?: string; author?: string; thumbnail?: string; duration?: number }) => {
      setBatchQueue((prev) => [...prev, { id: `queue_${Date.now()}`, ...item, status: 'queued' }]);
    },
    []
  );

  const handleDownloadStarted = useCallback((info: { title: string; url: string; format: string; author?: string }) => {
    setActiveDownloadInfo(info);
    setIsStartPending(true);
  }, []);

  const handleDownloadStartFailed = useCallback(() => setIsStartPending(false), []);

  const handleStartBatchAll = () => {
    setIsBatchRunning(true);
    addToast('info', 'Batch Started', 'Processing queue items sequentially.');
  };

  const handleClearBatch = () => {
    setBatchQueue([]);
    setIsBatchRunning(false);
  };

  const handleRemoveQueueItem = (id: string) => {
    setBatchQueue((prev) => prev.filter((q) => q.id !== id));
  };

  // History Handlers
  const handleRemoveHistoryItem = (id: string) => {
    setHistory(removeHistoryItem(id));
  };

  const handleClearHistory = () => {
    clearAllHistory();
    setHistory([]);
    addToast('info', 'History Cleared', 'All download records removed.');
  };

  // Preference Handlers
  const handleToggleAutoClipboard = (val: boolean) => {
    setAutoClipboard(val);
    try {
      localStorage.setItem('tvr_dl_auto_clipboard', val ? 'true' : 'false');
    } catch {}
  };

  const queueCount = batchQueue.filter((q) => q.status === 'queued' || q.status === 'downloading').length;

  return (
    <div className="downloader-root">
      {/* Sub Navigation Bar (a bottom tab bar on phones) */}
      <nav className="dl-subnav" aria-label="Downloader sections">
        <div className="dl-tab-pills">
          <button
            type="button"
            className={`dl-tab-btn ${subTab === 'single' ? 'active' : ''}`}
            onClick={() => setSubTab('single')}
          >
            <Download size={15} />
            <span>Downloader</span>
          </button>
          {isDesktop && (
            <button
              type="button"
              className={`dl-tab-btn ${subTab === 'batch' ? 'active' : ''}`}
              onClick={() => setSubTab('batch')}
            >
              <ListPlus size={15} />
              <span>Batch Queue</span>
              {queueCount > 0 && <span className="dl-badge-count">{queueCount}</span>}
            </button>
          )}
          <button
            type="button"
            className={`dl-tab-btn ${subTab === 'history' ? 'active' : ''}`}
            onClick={() => setSubTab('history')}
          >
            <History size={15} />
            <span>History</span>
            {history.length > 0 && <span className="dl-badge-count">{history.length}</span>}
          </button>
          {isDesktop && (
            <button
              type="button"
              className={`dl-tab-btn ${subTab === 'settings' ? 'active' : ''}`}
              onClick={() => setSubTab('settings')}
            >
              <Settings size={15} />
              <span>Settings</span>
            </button>
          )}
        </div>
      </nav>

      {/* Tab Panels */}
      {/* Single + Batch stay mounted (hidden) so typed links, fetched info and the queue survive tab switches */}
      <div className={subTab === 'single' ? 'dl-tab-panel' : 'is-hidden'}>
        <SingleDownloadTab
          isActive={isVisible && subTab === 'single'}
          onSendToTagEditor={onSendToTagEditor}
          onAddToBatch={handleAddToBatch}
          addToast={addToast}
          activeDownload={activeDownload}
          activeDownloadInfo={activeDownloadInfo}
          lastCompletedFile={lastCompletedFile}
          autoClipboard={autoClipboard}
          isBusy={isDownloadBusy || isBatchRunning}
          onDownloadStarted={handleDownloadStarted}
          onDownloadStartFailed={handleDownloadStartFailed}
        />
      </div>

      {isDesktop && (
        <div className={subTab === 'batch' ? 'dl-tab-panel' : 'is-hidden'}>
          <BatchQueueTab
            queue={batchQueue}
            onAddUrls={handleAddBatchUrls}
            onStartAll={handleStartBatchAll}
            onClearQueue={handleClearBatch}
            onRemoveItem={handleRemoveQueueItem}
            onSendToTagEditor={onSendToTagEditor}
            isProcessing={isBatchRunning}
            outputDir={batchOutputDir}
            onBrowseFolder={handleBrowseBatchFolder}
          />
        </div>
      )}

      {subTab === 'history' && (
        <DownloadHistoryTab
          history={history}
          onRemoveHistoryItem={handleRemoveHistoryItem}
          onClearHistory={handleClearHistory}
          onSendToTagEditor={onSendToTagEditor}
          onUpdateHistory={(newHist) => setHistory(newHist)}
          addToast={addToast}
        />
      )}

      {isDesktop && subTab === 'settings' && (
        <DownloaderSettingsTab
          autoClipboard={autoClipboard}
          onToggleAutoClipboard={handleToggleAutoClipboard}
          addToast={addToast}
        />
      )}
    </div>
  );
};
