const path = require('path');
const fsp = require('fs').promises;
const { ipcMain, dialog, nativeImage } = require('electron');
const { saveTagsAndRename } = require('../lib/id3.cjs');

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.aiff', '.aif']);
const METADATA_CONCURRENCY = 8;
const ARTWORK_THUMB_SIZE = 96;

async function scanDirectory(dirPath, fileList = []) {
  try {
    const entries = await fsp.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await scanDirectory(fullPath, fileList);
      } else if (entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        fileList.push(fullPath);
      }
    }
  } catch (err) {
    console.error('Error scanning directory:', dirPath, err);
  }
  return fileList;
}

let musicMetadata = null;
const getMusicMetadata = async () => (musicMetadata ??= await import('music-metadata'));

/** Normalizes tag ratings (0-1 or 0-5 scales) to 0-5 stars. */
function parseRating(rating) {
  const raw = rating?.[0]?.rating;
  if (typeof raw !== 'number') return 0;
  const stars = raw > 1 ? raw : raw * 5;
  return Math.min(5, Math.max(0, Math.round(stars)));
}

/**
 * The grid shows artwork at ~32px, so a small JPEG thumbnail is enough. Keeping every track's full-size cover as base64
 * (several MB each) used up the app's memory on large libraries.
 */
function artworkThumbnail(picture) {
  if (!picture || !picture.data) return undefined;
  try {
    const image = nativeImage.createFromBuffer(Buffer.from(picture.data));
    if (image.isEmpty()) return undefined;
    const { width, height } = image.getSize();
    const scale = ARTWORK_THUMB_SIZE / Math.max(width, height);
    const small = scale < 1 ? image.resize({ width: Math.round(width * scale), height: Math.round(height * scale), quality: 'good' }) : image;
    return `data:image/jpeg;base64,${small.toJPEG(75).toString('base64')}`;
  } catch {
    return undefined;
  }
}

async function readSingleMetadata(filePath, mm) {
  const ext = path.extname(filePath).replace('.', '').toLowerCase();
  try {
    const [metadata, stats] = await Promise.all([mm.parseFile(filePath, { duration: true }), fsp.stat(filePath)]);
    const { common, format } = metadata;

    const pic = common.picture?.[0];
    const comment = common.comment?.[0];

    return {
      filePath,
      fileName: path.basename(filePath),
      fileSize: stats.size,
      duration: format.duration || 0,
      bitrate: Math.round((format.bitrate || 0) / 1000),
      sampleRate: format.sampleRate || 44100,
      bitDepth: format.bitsPerSample || 16,
      format: ext,
      title: common.title || '',
      artist: common.artist || '',
      album: common.album || '',
      genre: common.genre?.[0] || '',
      year: common.year ? String(common.year) : '',
      albumArtist: common.albumartist || '',
      trackNumber: common.track?.no ? String(common.track.no) : '',
      tracksTotal: common.track?.of ? String(common.track.of) : '',
      bpm: common.bpm || null,
      key: common.key || null,
      composer: common.composer?.[0] || '',
      comment: comment ? comment.text || (typeof comment === 'string' ? comment : '') : '',
      rating: parseRating(common.rating),
      artworkUrl: artworkThumbnail(pic),
    };
  } catch (err) {
    console.error('Metadata read error on', filePath, err);
    const stats = await fsp.stat(filePath).catch(() => null);
    return {
      filePath,
      fileName: path.basename(filePath),
      fileSize: stats?.size || 0,
      format: ext,
      title: '',
      artist: '',
      error: err.message,
    };
  }
}

function registerTagEditorHandlers(getWindow) {
  ipcMain.handle('dialog:openFiles', async () => {
    const win = getWindow();
    if (!win) return [];
    const result = await dialog.showOpenDialog(win, {
      title: 'Select Audio Files for TVR Organizer',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'flac', 'wav', 'aiff', 'aif'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    return result.canceled ? [] : result.filePaths || [];
  });

  ipcMain.handle('dialog:openDirectory', async () => {
    const win = getWindow();
    if (!win) return [];
    const result = await dialog.showOpenDialog(win, {
      title: 'Select Music Library Folder',
      properties: ['openDirectory'],
    });
    if (result.canceled || !result.filePaths.length) return [];
    return scanDirectory(result.filePaths[0]);
  });

  ipcMain.handle('file:readMetadata', async (_, filePath) => readSingleMetadata(filePath, await getMusicMetadata()));

  // Bounded concurrent pool: keeps disk I/O saturated without exhausting file handles.
  ipcMain.handle('file:readMetadataBatch', async (_, filePaths) => {
    if (!Array.isArray(filePaths) || !filePaths.length) return [];
    const mm = await getMusicMetadata();
    const results = new Array(filePaths.length);
    let next = 0;
    const worker = async () => {
      while (next < filePaths.length) {
        const i = next++;
        results[i] = await readSingleMetadata(filePaths[i], mm);
      }
    };
    await Promise.all(Array.from({ length: Math.min(METADATA_CONCURRENCY, filePaths.length) }, worker));
    return results;
  });

  ipcMain.handle('file:getFileSize', async (_, filePath) => {
    if (!filePath || typeof filePath !== 'string') return 0;
    try {
      return (await fsp.stat(filePath)).size || 0;
    } catch {
      return 0;
    }
  });

  ipcMain.handle('file:saveMetadataAndRename', async (_, params) => {
    try {
      return { success: true, newFilePath: await saveTagsAndRename(params) };
    } catch (err) {
      console.error('Error saving/renaming file:', params.filePath, err);
      return { success: false, error: err.message, filePath: params.filePath };
    }
  });

  ipcMain.handle('file:batchProcess', async (_, batchRequest) => {
    const errors = [];
    const results = [];
    for (const item of batchRequest.tracks) {
      try {
        const newFilePath = await saveTagsAndRename(item);
        results.push({ id: item.id, newFilePath, status: 'saved' });
      } catch (err) {
        errors.push({ id: item.id, filePath: item.filePath, reason: err.message });
        results.push({ id: item.id, newFilePath: item.filePath, status: 'error', error: err.message });
      }
    }
    return { successCount: results.length - errors.length, errorCount: errors.length, errors, results };
  });

  ipcMain.handle('file:exportPlaylist', async (_, { content, defaultName, extension }) => {
    const win = getWindow();
    if (!win) return false;
    const saveResult = await dialog.showSaveDialog(win, {
      title: 'Export Playlist File',
      defaultPath: defaultName,
      filters: [{ name: 'Playlist', extensions: [extension] }],
    });
    if (saveResult.canceled || !saveResult.filePath) return false;
    await fsp.writeFile(saveResult.filePath, content, 'utf-8');
    return true;
  });
}

module.exports = { registerTagEditorHandlers };
