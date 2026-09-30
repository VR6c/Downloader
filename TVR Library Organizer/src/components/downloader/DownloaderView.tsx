import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Download,
  ListPlus,
  History,
  Settings,
  AlertCircle,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import {
  DownloadProgress,
  DownloadHistoryItem,
  BatchQueueItem,
} from '../../types/downloader';
import {
  getStoredHistory,
  addHistoryItem,
  removeHistoryItem,
  clearAllHistory,
  subscribeDownloadProgress,
  subscribeDownloadStatus,
  subscribeDownloadComplete,
  subscribeDownloadError,
  subscribeDownloadAborted,
  startDownload,
  getClipboardText,
  getDefaultDownloadDir,
  selectDownloadDirectory,
} from '../../services/downloaderService';
import { SingleDownloadTab } from './SingleDownloadTab';
import { BatchQueueTab } from './BatchQueueTab';
import { DownloadHistoryTab } from './DownloadHistoryTab';
import { DownloaderSettingsTab } from './DownloaderSettingsTab';

interface DownloaderViewProps {
  onSendToTagEditor: (filePaths: string[]) => void;
  addToast: (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => void;
}

export const DownloaderView: React.FC<DownloaderViewProps> = ({
  onSendToTagEditor,
  addToast,
}) => {
  const [subTab, setSubTab] = useState<'single' | 'batch' | 'history' | 'settings'>('single');

  // History State
  const [history, setHistory] = useState<DownloadHistoryItem[]>(() => getStoredHistory());

  // Batch Queue State
  const [batchQueue, setBatchQueue] = useState<BatchQueueItem[]>([]);
  const [batchOutputDir, setBatchOutputDir] = useState('');

  // Initialize batch output directory from default
  useEffect(() => {
    getDefaultDownloadDir().then((dir) => {
      if (dir) setBatchOutputDir(dir);
    });
  }, []);
  const [isBatchRunning, setIsBatchRunning] = useState(false);

  // Active Download State
  const [activeDownload, setActiveDownload] = useState<DownloadProgress | null>(null);
  const [activeDownloadInfo, setActiveDownloadInfo] = useState<{ title: string; url: string; format: string } | null>(null);
  const [lastCompletedFile, setLastCompletedFile] = useState<{ filePath: string; filename: string; title: string } | null>(null);

  // Preferences & Diagnostics
  const [autoClipboard, setAutoClipboard] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tvr_dl_auto_clipboard') === 'true';
    } catch {
      return false;
    }
  });

  // Subscribe to real-time Electron IPC download events
  useEffect(() => {
    const unsubProgress = subscribeDownloadProgress((data) => {
      setActiveDownload(data);

      // If batch is running, update active item in queue
      setBatchQueue((prev) =>
        prev.map((item) =>
          item.id === data.id
            ? { ...item, status: 'downloading', progress: data.percent, phase: data.phase }
            : item
        )
      );
    });

    const unsubStatus = subscribeDownloadStatus((data) => {
      setActiveDownload((prev) => (prev ? { ...prev, phase: data.message || data.phase } : null));
    });

    const unsubComplete = subscribeDownloadComplete((data: any) => {
      setActiveDownload(null);
      const resolvedPath = data.file_path || data.output_path || data.filePath || '';
      const resolvedName = data.filename || (resolvedPath ? resolvedPath.split(/[/\\]/).pop() : 'downloaded_track.mp3');

      setLastCompletedFile({
        filePath: resolvedPath,
        filename: resolvedName,
        title: activeDownloadInfo?.title || resolvedName,
      });

      // Add to persistent history
      if (resolvedPath) {
        const historyItem: DownloadHistoryItem = {
          id: `hist_${Date.now()}`,
          title: activeDownloadInfo?.title || resolvedName,
          author: 'TVR Downloader',
          url: activeDownloadInfo?.url || '',
          format: activeDownloadInfo?.format || 'mp3',
          quality: '320',
          filePath: resolvedPath,
          fileName: resolvedName,
          timestamp: Date.now(),
        };
        setHistory(addHistoryItem(historyItem));
      }

      // Update batch queue item
      setBatchQueue((prev) =>
        prev.map((item) =>
          item.id === data.id
            ? { ...item, status: 'completed', progress: 100, resultFilePath: resolvedPath }
            : item
        )
      );

      addToast('success', 'Download Complete', `Saved: ${data.filename}`);
    });

    const unsubError = subscribeDownloadError((data) => {
      setActiveDownload(null);
      setBatchQueue((prev) =>
        prev.map((item) =>
          item.id === data.id
            ? { ...item, status: 'error', error: data.details || data.error_code }
            : item
        )
      );
      addToast('error', 'Download Failed', data.details || 'An error occurred during download.');
    });

    const unsubAborted = subscribeDownloadAborted((data) => {
      setActiveDownload(null);
      setBatchQueue((prev) =>
        prev.map((item) =>
          item.id === data.id ? { ...item, status: 'cancelled' } : item
        )
      );
      addToast('warning', 'Download Aborted', data.message || 'Cancelled by user');
    });

    return () => {
      unsubProgress();
      unsubStatus();
      unsubComplete();
      unsubError();
      unsubAborted();
    };
  }, [activeDownloadInfo, addToast]);

  // Batch Processor
  useEffect(() => {
    if (!isBatchRunning) return;

    const nextItem = batchQueue.find((q) => q.status === 'queued');
    if (!nextItem) {
      setIsBatchRunning(false);
      addToast('success', 'Batch Complete', 'All queued items have been processed.');
      return;
    }

    if (activeDownload) return; // Wait for current download to finish

    // Mark as downloading
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
    }).catch((err) => {
      setBatchQueue((prev) =>
        prev.map((q) => (q.id === nextItem.id ? { ...q, status: 'error', error: err.message } : q))
      );
    });
  }, [isBatchRunning, batchQueue, activeDownload, addToast]);

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
      {/* Sub Navigation Bar */}
      <div className="dl-subnav">
        <div className="dl-tab-pills">
          <button
            type="button"
            className={`dl-tab-btn ${subTab === 'single' ? 'active' : ''}`}
            onClick={() => setSubTab('single')}
          >
            <Download size={15} />
            <span>Downloader</span>
          </button>
          <button
            type="button"
            className={`dl-tab-btn ${subTab === 'batch' ? 'active' : ''}`}
            onClick={() => setSubTab('batch')}
          >
            <ListPlus size={15} />
            <span>Batch Queue</span>
            {queueCount > 0 && <span className="dl-badge-count">{queueCount}</span>}
          </button>
          <button
            type="button"
            className={`dl-tab-btn ${subTab === 'history' ? 'active' : ''}`}
            onClick={() => setSubTab('history')}
          >
            <History size={15} />
            <span>History</span>
            {history.length > 0 && <span className="dl-badge-count">{history.length}</span>}
          </button>
          <button
            type="button"
            className={`dl-tab-btn ${subTab === 'settings' ? 'active' : ''}`}
            onClick={() => setSubTab('settings')}
          >
            <Settings size={15} />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      {subTab === 'single' && (
        <SingleDownloadTab
          onSendToTagEditor={onSendToTagEditor}
          onAddToBatch={(item) => {
            setBatchQueue((prev) => [
              ...prev,
              {
                id: `queue_${Date.now()}`,
                url: item.url,
                format: item.format,
                quality: item.quality,
                title: item.title,
                author: item.author,
                thumbnail: item.thumbnail,
                duration: item.duration,
                status: 'queued',
              },
            ]);
          }}
          addToast={addToast}
          activeDownload={activeDownload}
          activeDownloadInfo={activeDownloadInfo}
          lastCompletedFile={lastCompletedFile}
        />
      )}

      {subTab === 'batch' && (
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
      )}

      {subTab === 'history' && (
        <DownloadHistoryTab
          history={history}
          onRemoveHistoryItem={handleRemoveHistoryItem}
          onClearHistory={handleClearHistory}
          onSendToTagEditor={onSendToTagEditor}
        />
      )}

      {subTab === 'settings' && (
        <DownloaderSettingsTab
          autoClipboard={autoClipboard}
          onToggleAutoClipboard={handleToggleAutoClipboard}
          addToast={addToast}
        />
      )}
    </div>
  );
};
