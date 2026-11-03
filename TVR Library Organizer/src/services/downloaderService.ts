import {
  MediaInfo,
  DownloadConfig,
  DownloadProgress,
  DownloadHistoryItem,
  EngineStatus,
  DownloadSnapshotEntry,
} from '../types/downloader';

// Global type declaration for window.tvr
declare global {
  interface Window {
    tvr?: {
      getAppInfo: () => Promise<any>;
      getEngineStatus: () => Promise<EngineStatus>;
      updateEngine: () => Promise<any>;
      selectDirectory: (defaultPath?: string) => Promise<string | null>;
      getDefaultDownloadDir: () => Promise<string>;
      fetchMediaInfo: (url: string) => Promise<{ success: boolean; data?: MediaInfo; error_code?: string; message?: string }>;
      startDownload: (config: DownloadConfig) => Promise<{ success: boolean; downloadId?: string; error_code?: string; message?: string }>;
      cancelDownload: (downloadId: string) => Promise<{ success: boolean; message?: string }>;
      getDownloadSnapshot: () => Promise<DownloadSnapshotEntry[]>;
      ackDownload: (downloadId: string) => Promise<void>;
      openFile: (filePath: string) => Promise<boolean>;
      showInFolder: (filePath: string) => Promise<boolean>;
      openExternal: (url: string) => Promise<boolean>;
      getClipboardText: () => Promise<string>;
      getFileSize: (filePath: string) => Promise<number>;
      getMediaUrl: (filePath: string) => string;
      onDownloadProgress: (callback: (data: DownloadProgress) => void) => () => void;
      onDownloadStatus: (callback: (data: { id: string; phase: string; message: string }) => void) => () => void;
      onDownloadComplete: (callback: (data: { id: string; file_path: string; filename: string; filesize?: number; filesize_str?: string; title?: string; author?: string }) => void) => () => void;
      onDownloadError: (callback: (data: { id: string; error_code: string; details: string }) => void) => () => void;
      onDownloadAborted: (callback: (data: { id: string; message: string }) => void) => () => void;
    };
  }
}

export const isDownloaderAvailable = (): boolean => {
  return typeof window !== 'undefined' && Boolean(window.tvr);
};

export async function fetchMediaInfo(url: string) {
  if (window.tvr?.fetchMediaInfo) {
    return window.tvr.fetchMediaInfo(url);
  }
  return {
    success: false,
    message: 'Desktop Python Engine not detected. Please run TVR Studio using the desktop app for macOS or Windows.',
  };
}

type MediaInfoResult = Awaited<ReturnType<typeof fetchMediaInfo>>;

const INFO_CACHE_TTL_MS = 10 * 60 * 1000;
const infoCache = new Map<string, { at: number; result: MediaInfoResult }>();
const infoInflight = new Map<string, Promise<MediaInfoResult>>();

const normalizeMediaUrl = (url: string) => url.trim();

/**
 * fetchMediaInfo with a short-lived cache for successful lookups and in-flight de-duplication,
 * so re-fetching the same link is instant and never spawns a second engine process.
 */
export function fetchMediaInfoCached(url: string): Promise<MediaInfoResult> {
  const key = normalizeMediaUrl(url);

  const cached = infoCache.get(key);
  if (cached && Date.now() - cached.at < INFO_CACHE_TTL_MS) return Promise.resolve(cached.result);

  const inflight = infoInflight.get(key);
  if (inflight) return inflight;

  const request = fetchMediaInfo(key)
    .then((result) => {
      if (result.success) infoCache.set(key, { at: Date.now(), result });
      return result;
    })
    .finally(() => infoInflight.delete(key));
  infoInflight.set(key, request);
  return request;
}

export async function startDownload(config: DownloadConfig) {
  if (window.tvr?.startDownload) {
    return window.tvr.startDownload(config);
  }
  return {
    success: false,
    message: 'Desktop Python Engine not detected. Please run TVR Studio using the desktop app for macOS or Windows.',
  };
}

export async function cancelDownload(id: string) {
  if (window.tvr?.cancelDownload) {
    return window.tvr.cancelDownload(id);
  }
  return { success: false, message: 'Desktop Engine unavailable.' };
}

export async function getEngineStatus(): Promise<EngineStatus> {
  if (window.tvr?.getEngineStatus) {
    return window.tvr.getEngineStatus();
  }
  return { ready: false, error: 'Desktop Engine not initialized' };
}

export async function updateEngine() {
  if (window.tvr?.updateEngine) {
    return window.tvr.updateEngine();
  }
  return { success: false, message: 'Desktop Engine unavailable.' };
}

export async function selectDownloadDirectory(defaultPath?: string): Promise<string | null> {
  if (window.tvr?.selectDirectory) {
    return window.tvr.selectDirectory(defaultPath);
  }
  return null;
}

export async function getDefaultDownloadDir(): Promise<string> {
  try {
    const saved = localStorage.getItem('tvr_dl_default_dir');
    if (saved) return saved;
  } catch {}
  if (window.tvr?.getDefaultDownloadDir) {
    return window.tvr.getDefaultDownloadDir();
  }
  return '';
}

export function setDefaultDownloadDir(dir: string): void {
  try {
    localStorage.setItem('tvr_dl_default_dir', dir);
  } catch {}
}

export async function openDownloadedFile(filePath: string): Promise<boolean> {
  if (window.tvr?.openFile) {
    return window.tvr.openFile(filePath);
  }
  return false;
}

export async function showInFolder(filePath: string): Promise<boolean> {
  if (window.tvr?.showInFolder) {
    return window.tvr.showInFolder(filePath);
  }
  return false;
}

export async function openExternalUrl(url: string): Promise<boolean> {
  if (window.tvr?.openExternal) {
    return window.tvr.openExternal(url);
  }
  window.open(url, '_blank');
  return true;
}

export async function getClipboardText(): Promise<string> {
  if (window.tvr?.getClipboardText) {
    return window.tvr.getClipboardText();
  }
  if (navigator?.clipboard?.readText) {
    try {
      return await navigator.clipboard.readText();
    } catch {
      return '';
    }
  }
  return '';
}

export function getMediaUrl(filePath: string): string {
  if (window.tvr?.getMediaUrl) {
    return window.tvr.getMediaUrl(filePath);
  }
  return filePath;
}

export async function getFileSize(filePath: string): Promise<number> {
  if (window.tvr?.getFileSize) {
    return window.tvr.getFileSize(filePath);
  }
  if ((window as any).api?.getFileSize) {
    return (window as any).api.getFileSize(filePath);
  }
  return 0;
}

export function formatBytes(bytes?: number): string {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '--';
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${mb.toFixed(1)} MB`;
}

/** Maps a raw engine progress message to the UI shape. Shared by live events and post-reload restore. */
export function normalizeProgress(raw: any): DownloadProgress {
  const rawPercent = raw.percent ?? raw.percentage;
  const percentVal = typeof rawPercent === 'number' ? rawPercent : parseFloat(String(rawPercent || '0')) || 0;
  return {
    id: raw.id || '',
    percent: isNaN(percentVal) ? 0 : Math.min(100, Math.max(0, percentVal)),
    speed: raw.speed_str || (raw.speed != null ? `${raw.speed}` : undefined),
    eta: raw.eta_str || (raw.eta != null ? `${raw.eta}` : undefined),
    downloaded: raw.downloaded_str || (raw.downloaded != null ? `${raw.downloaded}` : undefined),
    total: raw.total_str || (raw.total != null ? `${raw.total}` : undefined),
    phase: raw.phase || 'downloading',
  };
}

/** Downloads known to the main process (running, or finished but not yet acknowledged). */
export async function getDownloadSnapshot(): Promise<DownloadSnapshotEntry[]> {
  try {
    return (await window.tvr?.getDownloadSnapshot?.()) ?? [];
  } catch {
    return [];
  }
}

/**
 * True when a reload interrupted unfinished download work: the engine has downloads we haven't handled,
 * or the persisted batch queue still has items to process. The app uses it to mount the downloader
 * (hidden) at startup so those downloads resume even if the user is in another mode.
 */
export async function hasPendingDownloadWork(): Promise<boolean> {
  try {
    const raw = sessionStorage.getItem('tvr_dl_batch_state');
    if (raw) {
      const { queue, running } = JSON.parse(raw);
      if (running || (Array.isArray(queue) && queue.some((q: any) => q.status === 'queued' || q.status === 'downloading'))) {
        return true;
      }
    }
  } catch {
    // ignore unreadable storage
  }
  return (await getDownloadSnapshot()).length > 0;
}

export function ackDownload(id: string): void {
  window.tvr?.ackDownload?.(id)?.catch?.(() => {});
}

// Event subscribers
export function subscribeDownloadProgress(callback: (data: DownloadProgress) => void): () => void {
  if (window.tvr?.onDownloadProgress) {
    return window.tvr.onDownloadProgress((raw: any) => {
      if (raw) callback(normalizeProgress(raw));
    });
  }
  return () => {};
}

export function subscribeDownloadStatus(callback: (data: { id: string; phase: string; message: string }) => void): () => void {
  if (window.tvr?.onDownloadStatus) {
    return window.tvr.onDownloadStatus(callback);
  }
  return () => {};
}

export function subscribeDownloadComplete(callback: (data: { id: string; file_path: string; filename: string }) => void): () => void {
  if (window.tvr?.onDownloadComplete) {
    return window.tvr.onDownloadComplete(callback);
  }
  return () => {};
}

export function subscribeDownloadError(callback: (data: { id: string; error_code: string; details: string }) => void): () => void {
  if (window.tvr?.onDownloadError) {
    return window.tvr.onDownloadError(callback);
  }
  return () => {};
}

export function subscribeDownloadAborted(callback: (data: { id: string; message: string }) => void): () => void {
  if (window.tvr?.onDownloadAborted) {
    return window.tvr.onDownloadAborted(callback);
  }
  return () => {};
}

// Local Storage for History
const HISTORY_STORAGE_KEY = 'tvr_download_history_v2';

export function getStoredHistory(): DownloadHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredHistory(items: DownloadHistoryItem[]): void {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items.slice(0, 200)));
  } catch (err) {
    console.warn('Failed to save download history:', err);
  }
}

export function addHistoryItem(item: DownloadHistoryItem): DownloadHistoryItem[] {
  const current = getStoredHistory();
  const updated = [item, ...current.filter((x) => x.id !== item.id)];
  saveStoredHistory(updated);
  return updated;
}

export function removeHistoryItem(id: string): DownloadHistoryItem[] {
  const current = getStoredHistory();
  const updated = current.filter((x) => x.id !== id);
  saveStoredHistory(updated);
  return updated;
}

export function clearAllHistory(): void {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch {}
}
