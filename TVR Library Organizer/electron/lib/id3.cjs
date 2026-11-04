const path = require('path');
const fsp = require('fs').promises;
const NodeID3 = require('node-id3');

const TAGGABLE_EXTENSIONS = new Set(['.mp3', '.aiff', '.aif']);
const DATA_URL_RE = /^data:([A-Za-z-+/]+);base64,(.+)$/;

/** Sanitize a filename: strip OS-forbidden characters and control chars. */
function sanitizeFileName(name) {
  if (!name) return 'audio';
  const cleaned = name.replace(/[\x00-\x1f\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
  return cleaned || 'audio';
}

/** Never overwrite an existing file: append " (n)" until the target is free. */
async function resolveNonCollidingPath(dir, baseName, ext, originalFilePath) {
  const safeBase = sanitizeFileName(baseName);
  const initial = path.join(dir, ext ? `${safeBase}${ext}` : safeBase);
  if (initial === originalFilePath) return initial;

  let candidate = initial;
  for (let counter = 1; ; counter++) {
    try {
      await fsp.access(candidate);
    } catch {
      return candidate; // free
    }
    if (candidate === originalFilePath) return candidate;
    candidate = path.join(dir, `${safeBase} (${counter})${ext}`);
  }
}

function buildTags(item) {
  const fullTitle = item.newMix && item.newMix !== 'Original Mix' ? `${item.newTitle} (${item.newMix})` : item.newTitle;
  const trackNumber = item.trackNumber
    ? item.tracksTotal
      ? `${item.trackNumber}/${item.tracksTotal}`
      : String(item.trackNumber)
    : '';

  const tags = {
    title: fullTitle,
    artist: item.newArtist,
    album: item.album || '',
    genre: item.genre || '',
    year: item.year || '',
    performerInfo: item.albumArtist || '',
    trackNumber,
    comment: item.comments ? { language: 'eng', text: item.comments } : undefined,
    bpm: item.bpm ? String(Math.round(item.bpm * 100) / 100) : '',
    initialKey: item.camelotKey ? item.camelotKey.toUpperCase() : '',
  };

  // NodeID3.write replaces the whole tag, so omitting `image` removes existing artwork.
  const match = typeof item.artworkUrl === 'string' && item.artworkUrl.match(DATA_URL_RE);
  if (item.artworkMode === 'keep') {
    // The grid only holds a thumbnail, so carry the file's original full-size image over
    const existing = NodeID3.read(item.filePath).image;
    if (existing && existing.imageBuffer) tags.image = existing;
  } else if (match) {
    tags.image = {
      mime: match[1],
      type: { id: 3, name: 'front cover' },
      description: 'Cover Art',
      imageBuffer: Buffer.from(match[2], 'base64'),
    };
  }
  return tags;
}

/**
 * Write ID3 tags (MP3/AIFF only) and optionally rename the file in place.
 * Returns the final file path. Throws on failure.
 */
async function saveTagsAndRename(item) {
  const { filePath, targetFileName } = item;

  if (TAGGABLE_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
    const res = NodeID3.write(buildTags(item), filePath);
    if (res instanceof Error) throw res;
    if (res === false) throw new Error('Failed to write ID3 tags to file');
  }

  if (!targetFileName) return filePath;

  const ext = path.extname(filePath);
  const base = targetFileName.trim().replace(/\.[a-zA-Z0-9]+$/, '').trim();
  const nextPath = await resolveNonCollidingPath(path.dirname(filePath), base, ext, filePath);
  if (nextPath === filePath) return filePath;
  await fsp.rename(filePath, nextPath);
  return nextPath;
}

module.exports = { saveTagsAndRename };
