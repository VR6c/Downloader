import {
  MediaInfo,
  DownloadConfig,
  DownloadProgress,
  DownloadHistoryItem,
  EngineStatus,
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
  if (window.tvr?.getDefaultDownloadDir) {
    return window.tvr.getDefaultDownloadDir();
  }
  return '';
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

// Event subscribers
export function subscribeDownloadProgress(callback: (data: DownloadProgress) => void): () => void {
  if (window.tvr?.onDownloadProgress) {
    return window.tvr.onDownloadProgress(callback);
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
