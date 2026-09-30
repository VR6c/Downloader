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
      getMediaUrl: (filePath: string) => string;
      onDownloadProgress: (callback: (data: DownloadProgress) => void) => () => void;
      onDownloadStatus: (callback: (data: { id: string; phase: string; message: string }) => void) => () => void;
      onDownloadComplete: (callback: (data: { id: string; file_path: string; filename: string }) => void) => () => void;
      onDownloadError: (callback: (data: { id: string; error_code: string; details: string }) => void) => () => void;
      onDownloadAborted: (callback: (data: { id: string; message: string }) => void) => () => void;
    };
  }
}

// API Base URL config: checks localStorage first (user-configured in Settings), then VITE_API_BASE_URL, or defaults to relative '/api'
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('tvr_api_base_url');
    if (saved) return saved.replace(/\/$/, '');
  }
  return ((import.meta as any).env?.VITE_API_BASE_URL || '').replace(/\/$/, '');
}

export function setApiBaseUrl(url: string) {
  if (typeof window !== 'undefined') {
    if (url && url.trim()) {
      localStorage.setItem('tvr_api_base_url', url.trim().replace(/\/$/, ''));
    } else {
      localStorage.removeItem('tvr_api_base_url');
    }
  }
}

export async function testBackendConnection(customUrl?: string): Promise<{ success: boolean; message: string; version?: string }> {
  const base = (customUrl !== undefined ? customUrl : getApiBaseUrl()).replace(/\/$/, '');
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${base}/api/health`, { method: 'GET', signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      return { success: false, message: `Server responded with HTTP ${res.status}` };
    }
    const data = await res.json();
    return { success: true, message: `Connected to ${data.app || 'TVR Studio API'} (v${data.version || '2.0.0'})`, version: data.version };
  } catch (err: any) {
    return { success: false, message: `Connection failed: ${err.name === 'AbortError' ? 'Connection timed out' : err.message || 'Cannot reach server'}` };
  }
}

// Dynamic helper resolving current API Base URL
const getApiBase = () => getApiBaseUrl();

// In-memory web SSE event dispatchers
const webProgressListeners = new Set<(data: DownloadProgress) => void>();
const webStatusListeners = new Set<(data: { id: string; phase: string; message: string }) => void>();
const webCompleteListeners = new Set<(data: { id: string; file_path: string; filename: string }) => void>();
const webErrorListeners = new Set<(data: { id: string; error_code: string; details: string }) => void>();
const webAbortedListeners = new Set<(data: { id: string; message: string }) => void>();
const activeEventSources = new Map<string, EventSource>();

function triggerBrowserDownload(url: string, filename?: string) {
  try {
    const a = document.createElement('a');
    a.href = url;
    if (filename) a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    console.warn('Auto browser download trigger:', err);
  }
}

function connectWebDownloadSse(downloadId: string) {
  if (activeEventSources.has(downloadId)) return;

  const base = getApiBase();
  const eventSource = new EventSource(`${base}/api/download/events/${encodeURIComponent(downloadId)}`);
  activeEventSources.set(downloadId, eventSource);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'progress') {
        webProgressListeners.forEach((cb) => cb(data));
      } else if (data.type === 'status') {
        webStatusListeners.forEach((cb) => cb({ id: downloadId, phase: data.phase, message: data.message }));
      } else if (data.type === 'complete') {
        const filePath = `${base}/api/download/file/${encodeURIComponent(downloadId)}`;
        const filename = data.filename || 'downloaded_media';
        webCompleteListeners.forEach((cb) => cb({ id: downloadId, file_path: filePath, filename }));
        // Automatically download to user's local Downloads folder in web mode
        triggerBrowserDownload(filePath, filename);
        eventSource.close();
        activeEventSources.delete(downloadId);
      } else if (data.type === 'error') {
        webErrorListeners.forEach((cb) =>
          cb({ id: downloadId, error_code: data.error_code || 'ERR_DOWNLOAD', details: data.details || 'Download error' })
        );
        eventSource.close();
        activeEventSources.delete(downloadId);
      } else if (data.type === 'aborted') {
        webAbortedListeners.forEach((cb) => cb({ id: downloadId, message: data.reason || 'Download cancelled' }));
        eventSource.close();
        activeEventSources.delete(downloadId);
      }
    } catch {
      // Ignore heartbeat comments
    }
  };

  eventSource.onerror = () => {
    eventSource.close();
    activeEventSources.delete(downloadId);
  };
}

export const isDownloaderAvailable = (): boolean => {
  return true;
};

export async function fetchMediaInfo(url: string) {
  if (window.tvr?.fetchMediaInfo) {
    return window.tvr.fetchMediaInfo(url);
  }
  const base = getApiBase();
  try {
    const res = await fetch(`${base}/api/media/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      if (res.status === 404) {
        return {
          success: false,
          message: 'Backend server not responding (HTTP 404). On Vercel, the Downloader requires a connected Python API server. Run locally at http://localhost:5173 or configure your backend URL in Settings.'
        };
      }
      const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
      return { success: false, message: err.detail || err.message || `Server error (${res.status})` };
    }
    return res.json();
  } catch (err: any) {
    return {
      success: false,
      message: `Unable to connect to TVR Studio backend at ${base || 'localhost:8000'}. Ensure the backend is running.`,
    };
  }
}

export async function startDownload(config: DownloadConfig) {
  if (window.tvr?.startDownload) {
    return window.tvr.startDownload(config);
  }
  const base = getApiBase();
  try {
    const res = await fetch(`${base}/api/download/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      if (res.status === 404) {
        return {
          success: false,
          message: 'Backend API Not Found (404). Please ensure your Python server is running or configured in Settings.'
        };
      }
      const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
      return { success: false, message: err.detail || err.message || `Server error (${res.status})` };
    }
    const data = await res.json();
    if (data.success && data.downloadId) {
      connectWebDownloadSse(data.downloadId);
    }
    return data;
  } catch (err: any) {
    return {
      success: false,
      message: `Unable to start download. Cannot reach backend server at ${base || 'localhost:8000'}.`,
    };
  }
}

export async function cancelDownload(id: string) {
  if (window.tvr?.cancelDownload) {
    return window.tvr.cancelDownload(id);
  }
  const es = activeEventSources.get(id);
  if (es) {
    es.close();
    activeEventSources.delete(id);
  }
  const base = getApiBase();
  try {
    const res = await fetch(`${base}/api/download/cancel/${encodeURIComponent(id)}`, {
      method: 'POST',
    });
    return res.json();
  } catch (err: any) {
    return { success: false, message: 'Could not connect to cancel download' };
  }
}

export async function getEngineStatus(): Promise<EngineStatus> {
  if (window.tvr?.getEngineStatus) {
    return window.tvr.getEngineStatus();
  }
  const base = getApiBase();
  try {
    const res = await fetch(`${base}/api/engine/status`);
    if (!res.ok) {
      return { ready: false, error: `Backend returned error code ${res.status}` };
    }
    const data = await res.json();
    return {
      ready: Boolean(data.ready),
      ytdlp_version: data.ytdlp_version,
      error: data.ready ? undefined : 'yt-dlp is not available on server',
    };
  } catch (err: any) {
    return { ready: false, error: `Cannot reach TVR Studio API backend (${base || 'http://127.0.0.1:8000'})` };
  }
}

export async function updateEngine() {
  if (window.tvr?.updateEngine) {
    return window.tvr.updateEngine();
  }
  const base = getApiBase();
  try {
    const res = await fetch(`${base}/api/engine/update`, { method: 'POST' });
    return res.json();
  } catch (err: any) {
    return { success: false, message: 'Cannot reach backend to trigger engine update' };
  }
}

export async function selectDownloadDirectory(defaultPath?: string): Promise<string | null> {
  if (window.tvr?.selectDirectory) {
    return window.tvr.selectDirectory(defaultPath);
  }
  return defaultPath || 'Browser Downloads';
}

export async function getDefaultDownloadDir(): Promise<string> {
  if (window.tvr?.getDefaultDownloadDir) {
    return window.tvr.getDefaultDownloadDir();
  }
  const base = getApiBase();
  try {
    const res = await fetch(`${base}/api/engine/status`);
    const data = await res.json();
    return data.default_download_dir || 'Browser Downloads';
  } catch {
    return 'Browser Downloads';
  }
}

export async function openDownloadedFile(filePath: string): Promise<boolean> {
  if (window.tvr?.openFile) {
    return window.tvr.openFile(filePath);
  }
  window.open(filePath, '_blank');
  return true;
}

export async function showInFolder(filePath: string): Promise<boolean> {
  if (window.tvr?.showInFolder) {
    return window.tvr.showInFolder(filePath);
  }
  window.open(filePath, '_blank');
  return true;
}

export async function openExternalUrl(url: string): Promise<boolean> {
  if (!window.tvr?.openExternal) {
    window.open(url, '_blank');
    return true;
  }
  return window.tvr.openExternal(url);
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

// Event subscribers
export function subscribeDownloadProgress(callback: (data: DownloadProgress) => void): () => void {
  if (window.tvr?.onDownloadProgress) {
    return window.tvr.onDownloadProgress(callback);
  }
  webProgressListeners.add(callback);
  return () => {
    webProgressListeners.delete(callback);
  };
}

export function subscribeDownloadStatus(callback: (data: { id: string; phase: string; message: string }) => void): () => void {
  if (window.tvr?.onDownloadStatus) {
    return window.tvr.onDownloadStatus(callback);
  }
  webStatusListeners.add(callback);
  return () => {
    webStatusListeners.delete(callback);
  };
}

export function subscribeDownloadComplete(callback: (data: { id: string; file_path: string; filename: string }) => void): () => void {
  if (window.tvr?.onDownloadComplete) {
    return window.tvr.onDownloadComplete(callback);
  }
  webCompleteListeners.add(callback);
  return () => {
    webCompleteListeners.delete(callback);
  };
}

export function subscribeDownloadError(callback: (data: { id: string; error_code: string; details: string }) => void): () => void {
  if (window.tvr?.onDownloadError) {
    return window.tvr.onDownloadError(callback);
  }
  webErrorListeners.add(callback);
  return () => {
    webErrorListeners.delete(callback);
  };
}

export function subscribeDownloadAborted(callback: (data: { id: string; message: string }) => void): () => void {
  if (window.tvr?.onDownloadAborted) {
    return window.tvr.onDownloadAborted(callback);
  }
  webAbortedListeners.add(callback);
  return () => {
    webAbortedListeners.delete(callback);
  };
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
