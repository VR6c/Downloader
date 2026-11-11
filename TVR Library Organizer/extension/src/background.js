import { Innertube, Platform } from 'youtubei.js';

const CHUNK_BYTES = 256 * 1024;
const SESSION_TTL_MS = 30 * 60 * 1000;

// YouTube checks the Origin and Referer of API and media requests. A service worker can't set them itself.
const HEADER_RULES = ['||youtube.com/youtubei/', '||googlevideo.com/'].map((urlFilter, i) => ({
  id: i + 1,
  priority: 1,
  action: {
    type: 'modifyHeaders',
    requestHeaders: [
      { header: 'Origin', operation: 'set', value: 'https://www.youtube.com' },
      { header: 'Referer', operation: 'set', value: 'https://www.youtube.com/' },
    ],
  },
  // tabId -1: only the extension's own requests, never the user's browsing
  condition: { urlFilter, resourceTypes: ['xmlhttprequest'], tabIds: [-1] },
}));

chrome.runtime.onInstalled.addListener(installHeaderRules);
chrome.runtime.onStartup.addListener(installHeaderRules);
function installHeaderRules() {
  return chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: HEADER_RULES.map((r) => r.id),
    addRules: HEADER_RULES,
  });
}

// Deciphering needs to run YouTube's player script, which MV3 forbids in a worker: hand it to the sandbox page
async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['IFRAME_SCRIPTING'],
    justification: 'Evaluate the YouTube player script in a sandboxed page to build download links',
  });
}
Platform.shim.eval = async (data) => {
  await ensureOffscreen();
  const response = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'eval', output: data.output });
  if (response?.error) throw new Error(response.error);
  return response?.result;
};

let session = null;
let sessionAt = 0;
async function getInnertube() {
  if (session && Date.now() - sessionAt < SESSION_TTL_MS) return session;
  await installHeaderRules();
  // The user's own cookies go along, so YouTube sees their normal (possibly signed-in) browser
  session = await Innertube.create({
    retrieve_player: true,
    fetch: (input, init) => fetch(input, { ...init, credentials: 'include' }),
  });
  sessionAt = Date.now();
  return session;
}

const VIDEO_ID = /(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/;
function videoIdOf(url) {
  const id = VIDEO_ID.exec(url)?.[1];
  if (!id) throw Object.assign(new Error('Not a YouTube video link.'), { code: 'ERR_INVALID_URL' });
  return id;
}

const formatDuration = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

async function getInfo(url) {
  const id = videoIdOf(url);
  const yt = await getInnertube();
  const info = await yt.getBasicInfo(id);
  const status = info.playability_status;
  if (status && status.status !== 'OK') {
    throw Object.assign(new Error(status.reason || 'This video cannot be played.'), { code: 'ERR_VIDEO_UNAVAILABLE' });
  }
  const b = info.basic_info;
  const duration = b.duration || 0;
  const thumbs = b.thumbnail || [];
  return {
    id,
    title: b.title || 'Unknown Title',
    channel: b.author || b.channel?.name || 'Unknown Channel',
    channel_url: b.channel?.url,
    duration,
    duration_formatted: formatDuration(duration),
    thumbnail: thumbs.length ? thumbs[thumbs.length - 1].url : `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    view_count: b.view_count,
    description: (b.short_description || '').slice(0, 250),
    webpage_url: `https://www.youtube.com/watch?v=${id}`,
    resolutions: [],
    has_subtitles: false,
    platform: 'youtube',
    is_audio_only: false,
  };
}

function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function streamAudio(url, port, isCancelled) {
  const id = videoIdOf(url);
  const yt = await getInnertube();
  // Plain web-client download: the same request the YouTube site itself makes for this user
  const stream = await yt.download(id, { type: 'audio', quality: 'best', format: 'mp4' });
  const reader = stream.getReader();
  let sent = 0;
  let pendingBytes = new Uint8Array(0);

  const flush = (final) => {
    while (pendingBytes.length >= CHUNK_BYTES || (final && pendingBytes.length)) {
      const part = pendingBytes.subarray(0, CHUNK_BYTES);
      pendingBytes = pendingBytes.subarray(part.length);
      sent += part.length;
      port.postMessage({ type: 'chunk', data: toBase64(part), received: sent });
    }
  };

  port.postMessage({ type: 'audio-start', mime: 'audio/mp4' });
  for (;;) {
    if (isCancelled()) {
      await reader.cancel();
      return;
    }
    const { value, done } = await reader.read();
    if (done) break;
    const merged = new Uint8Array(pendingBytes.length + value.length);
    merged.set(pendingBytes);
    merged.set(value, pendingBytes.length);
    pendingBytes = merged;
    flush(false);
  }
  flush(true);
  port.postMessage({ type: 'audio-end', size: sent });
}

chrome.runtime.onConnect.addListener((port) => {
  let cancelled = false;
  port.onDisconnect.addListener(() => {
    cancelled = true;
  });
  port.onMessage.addListener(async (msg) => {
    try {
      if (msg.type === 'info') port.postMessage({ type: 'info', data: await getInfo(msg.url) });
      else if (msg.type === 'audio') await streamAudio(msg.url, port, () => cancelled);
    } catch (e) {
      if (!cancelled) port.postMessage({ type: 'error', error_code: e.code || 'ERR_EXTENSION', details: String(e.message || e) });
    }
  });
});
