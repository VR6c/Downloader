import type { DownloadConfig, EngineStatus } from '../types/downloader';
import { APP_VERSION } from './updateService';
import { convertToMp3, fetchYouTubeAudio, fetchYouTubeInfo, isExtensionAvailable, isYouTubeUrl } from './extensionBridge';

/**
 * Browser stand-in for the desktop downloader bridge (window.tvr), so the downloader UI runs unchanged in
 * the PWA. Links go to the download server (api/index.py); finished files are saved through the browser's
 * own downloads instead of a chosen folder.
 */

type Listener = (data: any) => void;
type EventKind = 'progress' | 'status' | 'complete' | 'error' | 'aborted';

/** Empty means same origin (the Vercel deployment). Set VITE_TVR_API_BASE to use a server elsewhere. */
const API_BASE = (import.meta.env.VITE_TVR_API_BASE || '').replace(/\/$/, '');
const MAX_KEPT_FILES = 20;
const PROGRESS_INTERVAL_MS = 100;

const listeners: Record<EventKind, Set<Listener>> = {
  progress: new Set(),
  status: new Set(),
  complete: new Set(),
  error: new Set(),
  aborted: new Set(),
};
const controllers = new Map<string, AbortController>();
// Object URLs of files downloaded this session, by file name, so "Play" can open them
const fileUrls = new Map<string, string>();

const emit = (kind: EventKind, data: any) => listeners[kind].forEach((cb) => cb(data));
const subscribe = (kind: EventKind) => (cb: Listener) => {
  listeners[kind].add(cb);
  return () => {
    listeners[kind].delete(cb);
  };
};

async function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Turns a failed HTTP response into a readable message (Vercel's own errors are plain text, not JSON). */
async function describeHttpError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body?.message) return body.message;
  } catch {
    // not JSON
  }
  if (res.status === 504) return 'The download server timed out. Long videos may take more than the 5 minutes the server allows.';
  return `The download server returned an error (HTTP ${res.status}).`;
}

function decodeBase64(data: string): Uint8Array<ArrayBuffer> {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function keepFileUrl(filename: string, url: string) {
  const previous = fileUrls.get(filename);
  if (previous) URL.revokeObjectURL(previous);
  fileUrls.delete(filename);
  fileUrls.set(filename, url);
  // Each URL keeps its whole file in memory: release the oldest once there are too many
  while (fileUrls.size > MAX_KEPT_FILES) {
    const [oldest, oldUrl] = fileUrls.entries().next().value!;
    URL.revokeObjectURL(oldUrl);
    fileUrls.delete(oldest);
  }
}

function saveToBrowserDownloads(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** YouTube blocks the server, so when the helper extension is installed it fetches YouTube from the user's browser. */
const viaExtension = async (url: string): Promise<boolean> => isYouTubeUrl(url) && (await isExtensionAvailable());

const safeFileName = (name: string) => name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim().slice(0, 150) || 'download';

async function runExtensionDownload(id: string, config: DownloadConfig, signal: AbortSignal) {
  try {
    emit('status', { id, phase: 'starting', message: 'Reading the video through the browser extension...' });
    const { bytes } = await fetchYouTubeAudio(config.url, signal, (received) =>
      emit('progress', { id, percent: 0, downloaded_str: `${(received / 1048576).toFixed(1)} MiB`, phase: 'Downloading audio...' }),
    );

    emit('status', { id, phase: 'converting', message: 'Converting to MP3 in your browser (first run loads the converter)...' });
    const mp3 = await convertToMp3(
      bytes,
      { bitrate: config.quality || '320', title: config.title, artist: config.author },
      (ratio) => emit('progress', { id, percent: Math.round(ratio * 1000) / 10, phase: 'Converting to MP3...' }),
    );
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');

    const filename = `${safeFileName(config.filename || config.title || id)}.mp3`;
    const url = URL.createObjectURL(new Blob([mp3], { type: 'audio/mpeg' }));
    keepFileUrl(filename, url);
    saveToBrowserDownloads(url, filename);
    emit('complete', { id, file_path: filename, filename, filesize: mp3.length });
  } catch (err) {
    if (signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      emit('aborted', { id, message: 'Cancelled by user' });
    } else {
      emit('error', { id, error_code: (err as any)?.code || 'ERR_EXTENSION', details: err instanceof Error ? err.message : 'Extension download failed' });
    }
  }
}

async function runDownload(id: string, config: DownloadConfig, signal: AbortSignal) {
  if (await viaExtension(config.url)) return runExtensionDownload(id, config, signal);
  emit('status', { id, phase: 'starting', message: 'Sending link to the download server...' });

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...config, id }),
      signal,
    });
  } catch (err) {
    if (signal.aborted) emit('aborted', { id, message: 'Cancelled by user' });
    else emit('error', { id, error_code: 'ERR_NETWORK', details: err instanceof Error ? err.message : 'Network error' });
    return;
  }
  if (!res.ok || !res.body) {
    emit('error', { id, error_code: `ERR_HTTP_${res.status}`, details: await describeHttpError(res) });
    return;
  }

  const parts: Uint8Array<ArrayBuffer>[] = [];
  let file: { filename: string; filesize: number; mime: string } | null = null;
  let received = 0;
  let lastProgressAt = 0;
  let terminal = false;

  const handle = (msg: any) => {
    switch (msg.type) {
      case 'progress':
        emit('progress', { id, ...msg });
        break;
      case 'status':
        emit('status', { id, ...msg });
        break;
      case 'error':
        terminal = true;
        emit('error', { id, ...msg });
        break;
      case 'aborted':
        terminal = true;
        emit('aborted', { id, message: msg.reason || 'Download aborted' });
        break;
      case 'file':
        file = msg;
        emit('status', { id, phase: 'saving', message: 'Sending the file to your browser...' });
        break;
      case 'chunk': {
        const bytes = decodeBase64(msg.data);
        parts.push(bytes);
        received += bytes.length;
        const now = Date.now();
        if (file && now - lastProgressAt > PROGRESS_INTERVAL_MS) {
          lastProgressAt = now;
          emit('progress', {
            id,
            percent: file.filesize ? Math.round((received / file.filesize) * 1000) / 10 : 0,
            downloaded_str: `${(received / 1048576).toFixed(1)} MiB`,
            total_str: `${(file.filesize / 1048576).toFixed(1)} MiB`,
            phase: 'Saving to your device...',
          });
        }
        break;
      }
      case 'complete': {
        if (!file) break;
        terminal = true;
        const { filename, mime } = file;
        const url = URL.createObjectURL(new Blob(parts, { type: mime }));
        keepFileUrl(filename, url);
        saveToBrowserDownloads(url, filename);
        emit('complete', { id, ...msg, file_path: filename, filename });
        break;
      }
      // 'ping' keeps the connection alive while yt-dlp works
    }
  };

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const text = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (text) handle(JSON.parse(text));
      }
    }
  } catch (err) {
    if (signal.aborted) {
      emit('aborted', { id, message: 'Cancelled by user' });
      return;
    }
    emit('error', { id, error_code: 'ERR_NETWORK', details: err instanceof Error ? err.message : 'Connection lost' });
    return;
  }
  if (!terminal) {
    emit('error', {
      id,
      error_code: 'ERR_CONNECTION',
      details: 'The download server stopped before finishing. It allows at most 5 minutes per download.',
    });
  }
}

export function installWebDownloaderBridge() {
  window.tvr = {
    getAppInfo: async () => ({ version: APP_VERSION, platform: 'web' }),
    getEngineStatus: async (): Promise<EngineStatus> => {
      try {
        const res = await fetch(`${API_BASE}/api/status`);
        return res.ok ? await res.json() : { ready: false, error: await describeHttpError(res) };
      } catch (err) {
        return { ready: false, error: err instanceof Error ? err.message : 'Download server unreachable' };
      }
    },
    updateEngine: async () => ({ success: false, message: 'The server picks up the latest yt-dlp on each deploy.' }),

    // The browser decides where files go
    selectDirectory: async () => null,
    getDefaultDownloadDir: async () => '',

    fetchMediaInfo: async (url) => {
      if (await viaExtension(url)) return fetchYouTubeInfo(url);
      try {
        const res = await postJson('/api/info', { url });
        if (!res.ok) return { success: false, error_code: `ERR_HTTP_${res.status}`, message: await describeHttpError(res) };
        return await res.json();
      } catch (err) {
        return { success: false, error_code: 'ERR_NETWORK', message: err instanceof Error ? err.message : 'Network error' };
      }
    },
    startDownload: async (config) => {
      const id = config.id || `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const controller = new AbortController();
      controllers.set(id, controller);
      runDownload(id, config, controller.signal).finally(() => controllers.delete(id));
      return { success: true, downloadId: id };
    },
    cancelDownload: async (id) => {
      const controller = controllers.get(id);
      if (!controller) return { success: false, message: 'Download not found or already finished.' };
      controller.abort();
      return { success: true };
    },
    // Downloads don't survive a page reload in the browser
    getDownloadSnapshot: async () => [],
    ackDownload: async () => {},

    openFile: async (filePath) => {
      const url = fileUrls.get(filePath);
      if (!url) return false;
      window.open(url, '_blank');
      return true;
    },
    showInFolder: async () => false,
    openExternal: async (url) => {
      window.open(url, '_blank', 'noopener');
      return true;
    },
    getClipboardText: async () => {
      try {
        return await navigator.clipboard.readText();
      } catch {
        return '';
      }
    },
    getFileSize: async () => 0,
    getMediaUrl: (filePath) => fileUrls.get(filePath) || '',

    onDownloadProgress: subscribe('progress'),
    onDownloadStatus: subscribe('status'),
    onDownloadComplete: subscribe('complete'),
    onDownloadError: subscribe('error'),
    onDownloadAborted: subscribe('aborted'),
  };
}

/** True when this session still holds the file, so "Play" can open it. */
export const hasSessionFile = (filePath: string): boolean => fileUrls.has(filePath);
