import { TrackItem } from '../types';

/**
 * Generates .m3u8 Extended Playlist content compatible with Rekordbox, Serato, and Traktor
 */
export function generateM3U8Playlist(tracks: TrackItem[], playlistName = 'TVR DJ Cleaned Playlist'): string {
  let content = '#EXTM3U\n';
  content += `#PLAYLIST:${playlistName}\n\n`;

  for (const track of tracks) {
    const duration = Math.round(track.duration || 0);
    const artist = track.cleanArtist || 'Unknown Artist';
    const title = track.cleanTitle || 'Untitled Track';
    const mix = track.mixVersion ? ` (${track.mixVersion})` : '';
    const displayTitle = `${artist} - ${title}${mix}`;

    // Extended M3U track entry: #EXTINF:seconds,Artist - Title
    content += `#EXTINF:${duration},${displayTitle}\n`;
    // Write new target file path or original file path
    const filePath = track.filePath || track.targetFileName || track.originalFileName;
    content += `${filePath}\n\n`;
  }

  return content;
}

/**
 * Generates Pioneer Rekordbox XML format v4.0.0
 */
export function generateRekordboxXml(tracks: TrackItem[]): string {
  const now = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<DJ_PLAYLISTS Version="1.0.0">\n`;
  xml += `  <PRODUCT Name="rekordbox" Version="7.0.0" Company="AlphaTheta" />\n`;
  xml += `  <COLLECTION Entries="${tracks.length}">\n`;

  tracks.forEach((track, index) => {
    const trackId = index + 1;
    const name = escapeXml(track.cleanTitle + (track.mixVersion ? ` (${track.mixVersion})` : ''));
    const artist = escapeXml(track.cleanArtist);
    const album = escapeXml(track.album || '');
    const genre = escapeXml(track.genre || '');
    const bpm = track.bpm ? track.bpm.toFixed(2) : '126.00';
    const key = escapeXml(track.camelotKey || '');
    const duration = Math.round(track.duration || 0);
    const bitrate = track.bitrate || 320;
    const sampleRate = track.sampleRate || 44100;
    const location = escapeXml(`file://localhost${track.filePath.startsWith('/') ? '' : '/'}${track.filePath}`);

    xml += `    <TRACK TrackID="${trackId}" Name="${name}" Artist="${artist}" Composer="${escapeXml(track.composer || '')}" Album="${album}" Grouping="" Genre="${genre}" Kind="${track.fileFormat.toUpperCase()} Audio File" Size="${track.fileSize || 0}" TotalTime="${duration}" DiscNumber="1" TrackNumber="${track.trackNumber || trackId}" Year="${track.year || ''}" AverageBpm="${bpm}" DateAdded="${now}" BitRate="${bitrate}" SampleRate="${sampleRate}" Comments="${escapeXml(track.comments || '')}" PlayCount="0" Rating="${(track.rating || 0) * 51}" Location="${location}" Tonality="${key}">\n`;
    xml += `    </TRACK>\n`;
  });

  xml += `  </COLLECTION>\n`;
  xml += `  <PLAYLISTS>\n`;
  xml += `    <NODE Type="0" Name="ROOT">\n`;
  xml += `      <NODE Name="TVR Library Cleaned" Type="1" KeyType="0" Entries="${tracks.length}">\n`;
  tracks.forEach((_, index) => {
    xml += `        <TRACK Key="${index + 1}"/>\n`;
  });
  xml += `      </NODE>\n`;
  xml += `    </NODE>\n`;
  xml += `  </PLAYLISTS>\n`;
  xml += `</DJ_PLAYLISTS>`;

  return xml;
}

/**
 * Generates CSV / TSV metadata
 */
export function generateDelimitedData(tracks: TrackItem[], delimiter: ',' | '\t' = ','): string {
  const headers = [
    'Track ID',
    'Producer',
    'Title',
    'Mix / Version',
    'BPM',
    'Camelot Key',
    'Standard Key',
    'Genre',
    'Year',
    'Album',
    'Rating',
    'Bitrate (kbps)',
    'Sample Rate (Hz)',
    'Duration (s)',
    'Target Filename',
    'Original Filename',
    'File Path',
  ];

  const escapeCell = (val: unknown) => {
    const s = String(val ?? '');
    if (delimiter === ',') {
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
    }
    return s.replace(/[\r\n]+/g, ' ');
  };

  let rows = [headers.map(escapeCell).join(delimiter)];

  for (const t of tracks) {
    const row = [
      t.id,
      t.cleanArtist,
      t.cleanTitle,
      t.mixVersion,
      t.bpm ?? '',
      t.camelotKey ?? '',
      t.standardKey ?? '',
      t.genre,
      t.year,
      t.album,
      t.rating,
      t.bitrate,
      t.sampleRate,
      t.duration,
      (t.targetFileName || t.originalFileName || '').replace(/\.[a-zA-Z0-9]+$/, '').trim(),
      t.originalFileName,
      t.filePath,
    ];
    rows.push(row.map(escapeCell).join(delimiter));
  }

  return rows.join('\n');
}

/**
 * Generates plain text tracklist (.txt)
 */
export function generateTextTracklist(tracks: TrackItem[]): string {
  let lines: string[] = [];
  lines.push('=== TVR LIBRARY ORGANIZER - TRACKLIST ===');
  lines.push(`Total Tracks: ${tracks.length}`);
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push('----------------------------------------------------');

  tracks.forEach((t, i) => {
    const num = String(i + 1).padStart(2, '0');
    const artist = t.cleanArtist;
    const title = t.cleanTitle;
    const mix = t.mixVersion ? ` (${t.mixVersion})` : '';
    const key = t.camelotKey ? `[${t.camelotKey}] ` : '';
    const bpm = t.bpm ? `${t.bpm} BPM` : '';
    const harmonic = key || bpm ? ` - ${key}${bpm}`.trim() : '';
    lines.push(`${num}. ${artist} - ${title}${mix}${harmonic}`);
  });

  return lines.join('\n');
}

/**
 * Triggers a browser download for exported file
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeXml(unsafe: string): string {
  return (unsafe || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
