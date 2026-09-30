import { BatchProcessRequest, BatchProcessResult, TrackItem } from '../types';
import { cleanRawFilename } from '../engine/cleaner';
import { formatFileName } from '../engine/templateEngine';
import { analyzeAudioBuffer } from '../engine/dspEngine';

// Declare window.api type for TypeScript
declare global {
  interface Window {
    api?: {
      isElectron: boolean;
      platform: string;
      openFileDialog: () => Promise<string[]>;
      openDirectoryDialog: () => Promise<string[]>;
      readAudioMetadata: (filePath: string) => Promise<any>;
      saveAndRenameFile: (params: any) => Promise<{ success: boolean; newFilePath?: string; error?: string }>;
      batchProcessFiles: (batchRequest: BatchProcessRequest) => Promise<BatchProcessResult>;
      exportPlaylistFile: (params: { content: string; defaultName: string; extension: string }) => Promise<boolean>;
      getPathForFile?: (file: File) => string;
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;
    };
  }
}

export const isElectronEnv = (): boolean => {
  return typeof window !== 'undefined' && Boolean(window.api?.isElectron);
};

// ─── Shared helpers ─────────────────────────────────────────────────────────

/**
 * Resolve tag format string from file extension.
 */
function resolveTagFormat(ext: string): string {
  switch (ext) {
    case 'mp3':
    case 'aiff':
      return 'ID3v2.3.0';
    case 'flac':
      return 'FLAC Vorbis';
    default:
      return 'RIFF INFO';
  }
}

interface TrackItemBase {
  id: string;
  filePath: string;
  originalFileName: string;
  bitrate: number;
  sampleRate: number;
  bitDepth: number;
  duration: number;
  fileSize: number;
  fileFormat: string;
}

/**
 * Shared factory: construct a base TrackItem from common fields + cleaned metadata.
 * Both `loadTracksFromPaths` and `loadTracksFromWebFiles` delegate to this.
 */
function buildTrackItem(base: TrackItemBase): TrackItem {
  const { originalFileName, bitrate, sampleRate } = base;
  const ext = originalFileName.split('.').pop()?.toLowerCase() ?? 'mp3';

  const isQualityWarning = bitrate < 192 || sampleRate < 44100;
  const qualityIssues: string[] = [];
  if (bitrate < 192) qualityIssues.push(`Low Bitrate (${bitrate} kbps)`);
  if (sampleRate < 44100) qualityIssues.push(`Low Sample Rate (${sampleRate} Hz)`);

  const cleaned = cleanRawFilename(originalFileName);
  const baseNameWithoutExt = originalFileName.replace(/\.[a-zA-Z0-9]+$/, '').trim();

  return {
    ...base,
    cleanArtist: cleaned.artist !== 'Unknown Artist' ? cleaned.artist : '',
    cleanTitle: cleaned.title || baseNameWithoutExt,
    mixVersion: cleaned.mixVersion || '',
    album: '',
    genre: '',
    year: '',
    albumArtist: '',
    trackNumber: '',
    tracksTotal: '',
    comments: '',
    tagFormat: resolveTagFormat(ext),
    artworkUrl: undefined,
    composer: '',
    isrc: '',
    rating: 0,
    bpm: null,
    camelotKey: null,
    standardKey: null,
    status: 'idle',
    isQualityWarning,
    qualityIssues: qualityIssues.length ? qualityIssues : undefined,
    targetFileName: baseNameWithoutExt,
    customTargetFileName: true,
  };
}

// ─── Bounded concurrency pool ────────────────────────────────────────────────

/**
 * Run async tasks in parallel with a bounded concurrency pool.
 */
async function runConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      results[idx] = await fn(items[idx], idx);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

// ─── File dialog helpers ─────────────────────────────────────────────────────

/**
 * Helper to inspect audio duration in browser.
 */
function getWebAudioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    const timer = setTimeout(() => resolve(210), 1500);
    audio.onloadedmetadata = () => {
      clearTimeout(timer);
      const dur = Math.round(audio.duration);
      resolve(isFinite(dur) && dur > 0 ? dur : 210);
    };
    audio.onerror = () => {
      clearTimeout(timer);
      resolve(210);
    };
    audio.src = url;
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Open native or web file dialog and return loaded TrackItems.
 */
export async function openAudioFiles(): Promise<TrackItem[]> {
  if (isElectronEnv() && window.api) {
    const filePaths = await window.api.openFileDialog();
    if (!filePaths || !filePaths.length) return [];
    return loadTracksFromPaths(filePaths);
  }

  // Web File Picker fallback
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'audio/*,.mp3,.flac,.wav,.aiff,.aif';
    input.onchange = async () => {
      if (!input.files || input.files.length === 0) {
        resolve([]);
        return;
      }
      resolve(await loadTracksFromWebFiles(Array.from(input.files)));
    };
    input.click();
  });
}

/**
 * Open folder / directory dialog and return loaded TrackItems.
 */
export async function openAudioDirectory(): Promise<TrackItem[]> {
  if (isElectronEnv() && window.api) {
    const filePaths = await window.api.openDirectoryDialog();
    if (!filePaths || !filePaths.length) return [];
    return loadTracksFromPaths(filePaths);
  }

  // Web directory picker fallback
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    (input as any).webkitdirectory = true;
    input.onchange = async () => {
      if (!input.files || input.files.length === 0) {
        resolve([]);
        return;
      }
      const audioFiles = Array.from(input.files).filter((f) =>
        /\.(mp3|flac|wav|aiff|aif)$/i.test(f.name)
      );
      resolve(await loadTracksFromWebFiles(audioFiles));
    };
    input.click();
  });
}

/**
 * Convert Electron native file paths to TrackItems.
 */
export async function loadTracksFromPaths(rawPaths: string[]): Promise<TrackItem[]> {
  const paths = (rawPaths || []).filter((p): p is string => typeof p === 'string' && p.trim().length > 0);
  if (!paths.length) return [];

  return runConcurrent(paths, 16, async (p, i) => {
    const originalFileName = p.split(/[/\\]/).pop() || 'audio.mp3';
    const ext = originalFileName.split('.').pop()?.toLowerCase() || 'mp3';

    let meta: any = {};
    if (window.api?.readAudioMetadata) {
      try {
        meta = await window.api.readAudioMetadata(p);
      } catch (err) {
        console.warn('Metadata read error on', p, err);
      }
    }

    const bitrate = meta.bitrate || 320;
    const sampleRate = meta.sampleRate || 44100;

    return buildTrackItem({
      id: `native-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
      filePath: p,
      originalFileName,
      bitrate,
      sampleRate,
      bitDepth: meta.bitDepth || 16,
      duration: meta.duration || 180,
      fileSize: meta.fileSize || 5000000,
      fileFormat: ext,
    });
  });
}

/**
 * Convert browser File objects to TrackItems.
 */
export async function loadTracksFromWebFiles(files: File[]): Promise<TrackItem[]> {
  return runConcurrent(files, 8, async (file, i) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'mp3';
    const approxBitrate = ext === 'wav' || ext === 'aiff' ? 1411 : 320;
    const audioUrl = URL.createObjectURL(file);

    let duration = 210;
    try {
      duration = await getWebAudioDuration(audioUrl);
    } catch {
      // fallback to default
    }

    const filePath =
      (window.api?.getPathForFile ? window.api.getPathForFile(file) : '') ||
      (file as any).path ||
      (file as any).webkitRelativePath ||
      file.name;

    const track = buildTrackItem({
      id: `web-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
      filePath,
      originalFileName: file.name,
      bitrate: approxBitrate,
      sampleRate: 44100,
      bitDepth: ext === 'wav' ? 24 : 16,
      duration,
      fileSize: file.size,
      fileFormat: ext,
    });

    return {
      ...track,
      originalFile: file,
      audioUrl,
    };
  });
}

/**
 * Execute batch ID3 tag writing and file renaming.
 */
export async function executeBatchProcess(request: BatchProcessRequest): Promise<BatchProcessResult> {
  if (isElectronEnv() && window.api) {
    return window.api.batchProcessFiles(request);
  }

  // Web Browser Simulation: simulates atomic renaming with realistic latency
  await new Promise((r) => setTimeout(r, 400));

  const results = request.tracks.map((t) => {
    // Check for simulated permission locks
    if (t.filePath.includes('[LOCKED]') || t.filePath.includes('AccessDenied')) {
      return {
        id: t.id,
        newFilePath: t.filePath,
        status: 'error' as const,
        error: 'EACCES: permission denied, read-only filesystem lock',
      };
    }
    const originalExt = t.filePath.includes('.') ? '.' + t.filePath.split('.').pop() : '';
    const cleanBase = (t.targetFileName || t.filePath).trim().replace(/\.[a-zA-Z0-9]+$/, '').trim();
    return {
      id: t.id,
      newFilePath: originalExt ? `${cleanBase}${originalExt}` : cleanBase,
      status: 'saved' as const,
    };
  });

  const errors = results
    .filter((r) => r.status === 'error')
    .map((r) => ({ id: r.id, filePath: r.newFilePath, reason: r.error || 'Write error' }));

  return {
    successCount: results.filter((r) => r.status === 'saved').length,
    errorCount: errors.length,
    errors,
    results,
  };
}

/**
 * Performs DSP analysis on a TrackItem.
 * Falls back to a deterministic hash-based estimate when audio decoding is unavailable.
 */
export async function analyzeTrackDsp(
  track: TrackItem,
  onProgress?: (pct: number) => void
): Promise<{ bpm: number; camelotKey: string; standardKey: string; duration: number }> {
  try {
    if (track.originalFile) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      try {
        const arrayBuffer = await track.originalFile.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const dspResult = await analyzeAudioBuffer(audioBuffer, onProgress);
        return {
          bpm: dspResult.bpm,
          camelotKey: dspResult.camelotKey,
          standardKey: dspResult.standardKey,
          duration: dspResult.duration,
        };
      } finally {
        audioCtx.close().catch(() => {});
      }
    }
  } catch (err) {
    console.warn('Audio decoding fallback for track:', track.cleanTitle, err);
  }

  // Deterministic fallback when audio decoding is unavailable
  const hash = (track.cleanArtist + track.cleanTitle)
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const bpm = track.bpm || (120 + (hash % 15));
  const camelotKeys = ['1A', '2A', '3A', '4A', '5A', '6A', '7A', '8A', '9A', '10A', '11A', '12A', '8B', '9B', '11B'];
  const key = track.camelotKey || camelotKeys[hash % camelotKeys.length];

  return {
    bpm,
    camelotKey: key,
    standardKey: track.standardKey || 'A Minor',
    duration: track.duration || 210,
  };
}
