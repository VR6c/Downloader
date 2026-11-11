/**
 * Client for the TVR YouTube Helper browser extension (extension/). YouTube blocks the download server's IP,
 * so on the web the extension reads YouTube from the user's own connection and hands the audio to this page,
 * which converts it to MP3 with ffmpeg.wasm.
 */

const PING_TIMEOUT_MS = 400;
const FFMPEG_CORE_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';

let counter = 0;
const nextId = () => `ext_${Date.now()}_${counter++}`;

const YOUTUBE_URL = /^https?:\/\/((www|m|music)\.)?(youtube\.com|youtu\.be)\//i;
export const isYouTubeUrl = (url: string): boolean => YOUTUBE_URL.test(url.trim());

type ExtensionMessage = { type: string; [key: string]: any };

function post(id: string, message: Record<string, unknown>) {
  window.postMessage({ source: 'tvr-page', id, ...message }, window.location.origin);
}

/** Calls `onMessage` for everything the extension sends back for this request; returns an unsubscribe. */
function listen(id: string, onMessage: (msg: ExtensionMessage) => void): () => void {
  const handler = (event: MessageEvent) => {
    const msg = event.data;
    if (event.source !== window || !msg || msg.source !== 'tvr-extension' || msg.id !== id) return;
    onMessage(msg);
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}

let available: boolean | null = null;

/** True when the extension's content script is present on this page. A positive answer is remembered. */
export async function isExtensionAvailable(): Promise<boolean> {
  if (available) return true;
  const id = nextId();
  available = await new Promise<boolean>((resolve) => {
    const stop = listen(id, (msg) => {
      if (msg.type !== 'pong') return;
      clearTimeout(timer);
      stop();
      resolve(true);
    });
    const timer = setTimeout(() => {
      stop();
      resolve(false);
    }, PING_TIMEOUT_MS);
    post(id, { type: 'ping' });
  });
  return available;
}

export async function fetchYouTubeInfo(url: string) {
  const id = nextId();
  return new Promise<{ success: boolean; data?: any; error_code?: string; message?: string }>((resolve) => {
    const stop = listen(id, (msg) => {
      if (msg.type === 'info') resolve({ success: true, data: msg.data });
      else if (msg.type === 'error') resolve({ success: false, error_code: msg.error_code, message: msg.details });
      else return;
      stop();
    });
    post(id, { type: 'info', url });
  });
}

const decodeBase64 = (data: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

/** Streams the best audio track as it arrives. Rejects with an Error carrying `code` on failure. */
export function fetchYouTubeAudio(
  url: string,
  signal: AbortSignal,
  onProgress: (receivedBytes: number) => void,
): Promise<{ bytes: Uint8Array<ArrayBuffer>; mime: string }> {
  const id = nextId();
  return new Promise((resolve, reject) => {
    const parts: Uint8Array<ArrayBuffer>[] = [];
    let mime = 'audio/mp4';

    const finish = () => {
      stop();
      signal.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      post(id, { type: 'cancel' });
      finish();
      reject(new DOMException('Cancelled', 'AbortError'));
    };
    const stop = listen(id, (msg) => {
      if (msg.type === 'audio-start') mime = msg.mime || mime;
      else if (msg.type === 'chunk') {
        parts.push(decodeBase64(msg.data));
        onProgress(msg.received);
      } else if (msg.type === 'audio-end') {
        finish();
        const bytes = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
        let offset = 0;
        for (const p of parts) {
          bytes.set(p, offset);
          offset += p.length;
        }
        resolve({ bytes, mime });
      } else if (msg.type === 'error') {
        finish();
        reject(Object.assign(new Error(msg.details), { code: msg.error_code }));
      }
    });
    if (signal.aborted) return onAbort();
    signal.addEventListener('abort', onAbort);
    post(id, { type: 'audio', url });
  });
}

let ffmpegReady: Promise<import('@ffmpeg/ffmpeg').FFmpeg> | null = null;

async function loadFfmpeg() {
  const [{ FFmpeg }, { toBlobURL }] = await Promise.all([import('@ffmpeg/ffmpeg'), import('@ffmpeg/util')]);
  const ffmpeg = new FFmpeg();
  await ffmpeg.load({
    coreURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  return ffmpeg;
}

/** Converts downloaded audio to MP3 in the browser. The ffmpeg core (~30 MB) is fetched on first use. */
export async function convertToMp3(
  input: Uint8Array<ArrayBuffer>,
  options: { bitrate: string; title?: string; artist?: string },
  onProgress: (ratio: number) => void,
): Promise<Uint8Array<ArrayBuffer>> {
  ffmpegReady ??= loadFfmpeg().catch((err) => {
    ffmpegReady = null; // allow a retry after a network failure
    throw err;
  });
  const ffmpeg = await ffmpegReady;

  const handler = ({ progress }: { progress: number }) => onProgress(Math.min(1, Math.max(0, progress)));
  ffmpeg.on('progress', handler);
  try {
    await ffmpeg.writeFile('in', input);
    const args = ['-i', 'in', '-vn', '-codec:a', 'libmp3lame', '-b:a', `${options.bitrate}k`];
    if (options.title) args.push('-metadata', `title=${options.title}`);
    if (options.artist) args.push('-metadata', `artist=${options.artist}`);
    args.push('out.mp3');
    const code = await ffmpeg.exec(args);
    if (code !== 0) throw new Error('MP3 conversion failed.');
    const out = await ffmpeg.readFile('out.mp3');
    return out as Uint8Array<ArrayBuffer>;
  } finally {
    ffmpeg.off('progress', handler);
    await ffmpeg.deleteFile('in').catch(() => {});
    await ffmpeg.deleteFile('out.mp3').catch(() => {});
  }
}
