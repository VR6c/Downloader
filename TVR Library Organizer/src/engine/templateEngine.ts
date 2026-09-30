import { FilenameTemplate, TrackItem } from '../types';
import { cleanRawFilename } from './cleaner';

export const DEFAULT_TEMPLATE_PATTERN = '{Producer} - {Title}';

export const DEFAULT_TEMPLATES: FilenameTemplate[] = [
  {
    id: 'minimal',
    name: 'Minimal (Default)',
    pattern: '{Producer} - {Title}',
    description: 'Clean standard format without mix enclosure: Producer - Title (Default)',
  },
  {
    id: 'rekordbox-standard',
    name: 'Rekordbox Standard',
    pattern: '{Producer} - {Title} ({Mix})',
    description: 'Clean, standard format for Pioneer DJ Rekordbox and CDJ hardware: Producer - Title (Mix)',
  },
  {
    id: 'harmonic-dj',
    name: 'Harmonic DJ Cue ([Key] BPM - Producer - Title)',
    pattern: '[{Camelot}] {BPM} - {Producer} - {Title} ({Mix})',
    description: 'Displays Camelot key and BPM directly in the file title for instant DJ browsing',
  },
  {
    id: 'camelot-bpm-producer',
    name: 'Camelot & Tempo Prefix',
    pattern: '{Camelot} - {BPM} - {Producer} - {Title}',
    description: 'Sorts files naturally by Camelot wheel position and tempo in any file manager',
  },
  {
    id: 'track-numbered',
    name: 'Track Numbered Playlist',
    pattern: '{Track}. {Producer} - {Title} ({Mix})',
    description: 'Preserves track sequence order with leading track number',
  },
  {
    id: 'title-only',
    name: 'Title Only ({Title})',
    pattern: '{Title}',
    description: 'Direct 1:1 match between filename and track title',
  },
];

/**
 * Core template string renderer substituting metadata tokens and cleaning separators
 */
export function renderTemplatePattern(
  track: Partial<TrackItem>,
  templatePattern: string = DEFAULT_TEMPLATE_PATTERN
): string {
  const rawBaseName = track.originalFileName ? track.originalFileName.replace(/\.[a-zA-Z0-9]+$/, '').trim() : '';
  let defaultCleanCached: ReturnType<typeof cleanRawFilename> | null | undefined = undefined;
  const getDefaultClean = () => {
    if (defaultCleanCached === undefined) {
      defaultCleanCached = rawBaseName ? cleanRawFilename(rawBaseName) : null;
    }
    return defaultCleanCached;
  };

  if (!templatePattern || !templatePattern.trim()) {
    return track.cleanTitle?.trim() || getDefaultClean()?.title || rawBaseName || 'Untitled Track';
  }

  const producer = track.cleanArtist?.trim() || (getDefaultClean()?.artist !== 'Unknown Artist' ? getDefaultClean()?.artist : '') || '';
  let title = track.cleanTitle?.trim() || getDefaultClean()?.title || 'Untitled Track';
  let mix = track.mixVersion?.trim() || getDefaultClean()?.mixVersion || '';

  // 1. If title starts with producer/artist, extract core title to avoid duplication
  if (producer && title.toLowerCase().startsWith(producer.toLowerCase())) {
    const stripped = title.slice(producer.length).replace(/^[\s–—-]+/, '').trim();
    if (stripped) {
      title = stripped;
    }
  }

  // 1b. If title starts with original/detected artist from filename, extract core title to avoid duplication
  const defClean = getDefaultClean();
  if (defClean && defClean.artist && defClean.artist !== 'Unknown Artist' && title.toLowerCase().startsWith(defClean.artist.toLowerCase())) {
    const stripped = title.slice(defClean.artist.length).replace(/^[\s–—-]+/, '').trim();
    if (stripped) {
      title = stripped;
    }
  }

  // 2. Extract core title by stripping mix enclosure from title
  const trailingMixMatch = title.match(/\s*[([{\[](.*?mix|.*?remix|.*?bootleg|.*?edit|.*?vip|.*?dub|.*?instrumental|.*?acapella|.*?v\d+)[\])}]\s*$/i);
  if (trailingMixMatch) {
    if (!mix) {
      mix = trailingMixMatch[1].trim();
    }
    title = title.slice(0, trailingMixMatch.index).trim();
  } else if (mix) {
    const mixRegex = new RegExp(`[\\(\\[\\{]${mix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\)\\]\\}]\\s*$`, 'i');
    title = title.replace(mixRegex, '').trim();
  }

  const bpm = track.bpm ? `${track.bpm}` : '';
  const camelot = track.camelotKey || '';
  const key = track.standardKey || '';
  const album = track.album?.trim() || '';
  const year = track.year ? `${track.year}` : '';
  const genre = track.genre?.trim() || '';
  const trackNum = track.trackNumber ? String(track.trackNumber).padStart(2, '0') : '';
  const rating = track.rating ? `${track.rating}★` : '';

  let result = templatePattern;

  // Replace tokens (supports both {Producer} and legacy {Artist})
  result = result.replace(/{(?:Producer|Artist)}/gi, producer);
  result = result.replace(/{Title}/gi, title);
  result = result.replace(/{Mix}/gi, mix);
  result = result.replace(/{BPM}/gi, bpm);
  result = result.replace(/{Camelot}/gi, camelot);
  result = result.replace(/{Key}/gi, key);
  result = result.replace(/{Album}/gi, album);
  result = result.replace(/{Year}/gi, year);
  result = result.replace(/{Genre}/gi, genre);
  result = result.replace(/{(?:TrackNo|Track)}/gi, trackNum);
  result = result.replace(/{Rating}/gi, rating);

  // Clean empty parentheses, brackets, leading/trailing hyphens caused by missing optional tokens
  result = result
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    .replace(/^\s*[-–—]\s*/, '')
    .replace(/\s*[-–—]\s*$/, '')
    .replace(/\s*-\s*-\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!result || /^[-–—\s]+$/.test(result)) {
    result = rawBaseName || title || 'Untitled Track';
  }

  return result;
}

/**
 * Renders a filename from a template and track item
 */
export function formatFileName(
  track: Partial<TrackItem>,
  templatePattern: string = DEFAULT_TEMPLATE_PATTERN,
  extension?: string,
  includeExtension: boolean = false
): string {
  const ext = extension || (track.originalFileName ? track.originalFileName.split('.').pop() || 'mp3' : 'mp3');
  let result = renderTemplatePattern(track, templatePattern);

  // Sanitize illegal filesystem characters for both Windows & macOS
  result = result.replace(/[<>:"/\\|?*]/g, '_');

  if (includeExtension && ext) {
    return `${result}.${ext}`;
  }
  return result;
}

/**
 * Formats a Track Title tag following the template pattern (without file extension)
 */
export function formatTrackTitle(
  track: Partial<TrackItem>,
  templatePattern: string = DEFAULT_TEMPLATE_PATTERN
): string {
  return renderTemplatePattern(track, templatePattern);
}

export interface TemplateValidation {
  isValid: boolean;
  message: string;
}

export function validateTemplate(pattern: string): TemplateValidation {
  if (!pattern || !pattern.trim()) {
    return { isValid: false, message: 'Template pattern cannot be empty' };
  }

  // Check for balanced curly braces
  const openCount = (pattern.match(/\{/g) || []).length;
  const closeCount = (pattern.match(/\}/g) || []).length;
  if (openCount !== closeCount) {
    return { isValid: false, message: 'Unclosed bracket in template' };
  }

  // Check if at least one token exists
  const hasToken = /\{(?:Artist|Producer|Title|Mix|BPM|Key|Camelot|Album|Year|TrackNo|Track|Rating|Genre)\}/i.test(pattern);
  if (!hasToken) {
    return { isValid: false, message: 'Template must contain at least one token (e.g. {Title})' };
  }

  return { isValid: true, message: 'Template is valid' };
}

export const AVAILABLE_TOKENS = [
  { tag: '{Artist}', label: 'Artist / Producer', description: 'Track artist or producer' },
  { tag: '{Title}', label: 'Track Title', description: 'Clean track title' },
  { tag: '{Mix}', label: 'Mix / Version', description: 'Mix, VIP, or Remix enclosure' },
  { tag: '{BPM}', label: 'BPM', description: 'Beats per minute tempo' },
  { tag: '{Key}', label: 'Key', description: 'Musical standard key (e.g. F Minor)' },
  { tag: '{Camelot}', label: 'Camelot', description: 'Camelot key code (e.g. 4A, 8A)' },
  { tag: '{Album}', label: 'Album', description: 'Album or EP title' },
  { tag: '{Year}', label: 'Year', description: 'Release year' },
  { tag: '{TrackNo}', label: 'Track #', description: 'Track number with leading zero' },
  { tag: '{Rating}', label: 'Rating', description: 'DJ star rating' },
];

export const SAMPLE_PREVIEW_TRACK: Partial<TrackItem> = {
  cleanArtist: 'Aisha Bello',
  cleanTitle: 'Lagos Nights',
  mixVersion: 'Original Mix',
  bpm: 124,
  camelotKey: '4A',
  standardKey: 'F Minor',
  album: 'Afrobeats Vol. 1',
  year: '2024',
  trackNumber: '01',
  rating: 5,
  originalFileName: 'demo.mp3',
};

/**
 * Resolves potential collisions in a batch of generated filenames
 */
export function resolveBatchCollisions(
  tracks: Array<{ id: string; targetFileName: string; originalFileName: string }>
): Map<string, string> {
  const assigned = new Map<string, string>();
  const counts = new Map<string, number>();

  for (const track of tracks) {
    let candidate = (track.targetFileName || track.originalFileName || '').replace(/\.[a-zA-Z0-9]+$/, '').trim();
    const baseWithoutExt = candidate;

    const lowerCandidate = candidate.toLowerCase();
    const count = counts.get(lowerCandidate) || 0;

    if (count > 0) {
      candidate = `${baseWithoutExt} (${count + 1})`;
      counts.set(lowerCandidate, count + 1);
    } else {
      counts.set(lowerCandidate, 1);
    }

    assigned.set(track.id, candidate);
  }

  return assigned;
}
