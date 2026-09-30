import { CleanRuleConfig } from '../types';

export const DEFAULT_PROMOTIONAL_NOISE: string[] = [
  'HBD To[^\\)\\]]*',
  'Happy Birthday[^\\)\\]]*',
  'RockTheBeat',
  'FamilyBoss',
  'SRBL Team',
  'This_is_[^\\s]+',
  'This is [^\\s]+',
  'Free Download',
  'Free DL',
  'Free Copy',
  'Download Link',
  '320\\s*kbps',
  '128\\s*kbps',
  '256\\s*kbps',
  'FLAC',
  'WAV',
  'MP3',
  'CD RIP',
  'WEB RIP',
  'RIP',
  'Official Audio',
  'Official Video',
  'Official Music Video',
  'Music Video',
  'Lyrics Video',
  'Audio',
  'Video',
  'Exclusive',
  'Out Now',
  'Promo Only',
  'DJ City',
  'BPM Supreme',
  'Beatport',
  'Traxsource',
  'Soundcloud',
  'www\\.[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
  'https?://[^\\s]+',
  '@[a-zA-Z0-9_.-]+',
  't\\.me/[^\\s]+',
  'vk\\.com/[^\\s]+',
  'fb\\.com/[^\\s]+',
];

export const COMMON_MIX_KEYWORDS: { pattern: RegExp; standardized: string }[] = [
  { pattern: /\b(extended\s+mix|extended\s+version|extended)\b/i, standardized: 'Extended Mix' },
  { pattern: /\b(vip\s+mix|vip\s+edit|vip\s+bootleg|vip)\b/i, standardized: 'VIP Mix' },
  { pattern: /\b(club\s+mix|club\s+edit)\b/i, standardized: 'Club Mix' },
  { pattern: /\b(radio\s+edit|radio\s+mix)\b/i, standardized: 'Radio Edit' },
  { pattern: /\b(original\s+mix)\b/i, standardized: 'Original Mix' },
  { pattern: /\b(dub\s+mix|dub)\b/i, standardized: 'Dub Mix' },
  { pattern: /\b(instrumental\s+mix|instrumental)\b/i, standardized: 'Instrumental' },
  { pattern: /\b(acapella|a\s+cappella)\b/i, standardized: 'Acapella' },
  { pattern: /\b(bootleg\s+mix|bootleg|mashup)\b/i, standardized: 'Bootleg' },
  { pattern: /\b(remix|rmx)\b/i, standardized: 'Remix' },
  { pattern: /\b(v2|version\s*2)\b/i, standardized: 'V2' },
  { pattern: /\b(intro\s*-\s*clean|clean\s*intro)\b/i, standardized: 'Intro - Clean' },
  { pattern: /\b(intro\s*-\s*dirty|dirty\s*intro)\b/i, standardized: 'Intro - Dirty' },
  { pattern: /\b(short\s+edit)\b/i, standardized: 'Short Edit' },
];

export const DEFAULT_CLEAN_CONFIG: CleanRuleConfig = {
  replaceUnderscores: true,
  normalizeWhitespace: true,
  stripPromotionalNoise: true,
  standardizeMixEnclosures: true,
  smartCapitalization: true,
  setTitleToFileName: false,
  customNoiseWords: [...DEFAULT_PROMOTIONAL_NOISE],
  customSeparators: [' - ', ' _ ', ' -- ', ' | ', ' ~ '],
};

const ALWAYS_UPPER = new Set(['DJ', 'MC', 'VIP', 'BPM', 'ID', 'EP', 'LP', 'US', 'UK', 'EDM', 'ACRAZE', 'SVDDEN', 'KSHMR', 'RL', 'R&B']);
const ALWAYS_LOWER = new Set(['feat.', 'ft.', 'vs.', 'pres.', 'and', 'with', 'in', 'on', 'at', 'to', 'for', 'of', 'the', 'a', 'an', 'by']);

const DEFAULT_PROMOTIONAL_REGEXES: RegExp[] = DEFAULT_PROMOTIONAL_NOISE.map(
  (pattern) => new RegExp(`(?:\\[|\\(|\\b|\\s)${pattern}(?:\\]|\\)|\\b|\\s|$)`, 'gi')
);
const customRegexCache = new Map<string, RegExp>();

/**
 * Capitalizes a string following DJ / musical standards
 */
export function smartTitleCase(str: string): string {
  if (!str) return '';

  // Split into words, handling dashes and parentheses
  const words = str.split(/(\s+|[-/()[\]])/);

  return words
    .map((word, index) => {
      if (!word || /^\s+$/.test(word) || /^[-/()[\]]$/.test(word)) {
        return word;
      }

      const lower = word.toLowerCase();
      const upper = word.toUpperCase();

      if (ALWAYS_UPPER.has(upper)) {
        return upper;
      }

      // Feature tags should stay clean
      if (lower === 'feat' || lower === 'feat.') return 'feat.';
      if (lower === 'ft' || lower === 'ft.') return 'ft.';
      if (lower === 'vs' || lower === 'vs.') return 'vs.';

      if (ALWAYS_LOWER.has(lower) && index !== 0) {
        return lower;
      }

      // Capitalize first character, lowercase the rest
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join('');
}

export interface CleanedTrackResult {
  artist: string;
  title: string;
  mixVersion: string;
  bpmPrefix?: number;
}

/**
 * Main automated cleaner engine adhering to FR-2.1 - FR-2.4
 */
export function cleanRawFilename(
  rawFilename: string,
  config: CleanRuleConfig = DEFAULT_CLEAN_CONFIG
): CleanedTrackResult {
  // 1. Remove file extension
  let baseName = rawFilename.replace(/\.[a-zA-Z0-9]+$/, '').trim();

  // 2. Replace filesystem underscores with spaces
  if (config.replaceUnderscores) {
    baseName = baseName.replace(/_+/g, ' ');
  }

  // 3. Normalize non-standard hyphens (em-dash, en-dash, double dashes)
  baseName = baseName.replace(/[—–]/g, '-').replace(/--+/g, '-');

  // 4. Extract leading BPM prefix if present (e.g. "128 - Artist..." or "128_Artist" or "128BPM")
  let detectedBpm: number | undefined;
  const bpmPrefixMatch = baseName.match(/^(\d{2,3})\s*(?:bpm|\s*[-_])\s*/i);
  if (bpmPrefixMatch) {
    const num = parseInt(bpmPrefixMatch[1], 10);
    if (num >= 60 && num <= 200) {
      detectedBpm = num;
      baseName = baseName.substring(bpmPrefixMatch[0].length).trim();
    }
  }

  // 5. Extract leading track number (e.g. "01.", "01 -", "01 ")
  baseName = baseName.replace(/^\d{1,3}[\s.-]+/, '').trim();

  // 6. Strip promotional noise, crew markers, social media, dedications
  if (config.stripPromotionalNoise) {
    const isDefault = !config.customNoiseWords || config.customNoiseWords.length === 0 || config.customNoiseWords === DEFAULT_PROMOTIONAL_NOISE;
    if (isDefault) {
      for (let i = 0; i < DEFAULT_PROMOTIONAL_REGEXES.length; i++) {
        const regex = DEFAULT_PROMOTIONAL_REGEXES[i];
        regex.lastIndex = 0;
        baseName = baseName.replace(regex, ' ');
      }
    } else {
      for (const pattern of config.customNoiseWords) {
        try {
          let regex = customRegexCache.get(pattern);
          if (!regex) {
            regex = new RegExp(`(?:\\[|\\(|\\b|\\s)${pattern}(?:\\]|\\)|\\b|\\s|$)`, 'gi');
            customRegexCache.set(pattern, regex);
          }
          regex.lastIndex = 0;
          baseName = baseName.replace(regex, ' ');
        } catch {
          baseName = baseName.split(pattern).join(' ');
        }
      }
    }
  }

  // 7. Detect and extract Mix / Version keywords
  let detectedMix = '';
  if (config.standardizeMixEnclosures) {
    // Check brackets or parentheses first: [Extended Mix], (VIP Remix)
    const enclosedMixMatch = baseName.match(/[([{\[](.*?mix|.*?remix|.*?bootleg|.*?edit|.*?vip|.*?dub|.*?instrumental|.*?acapella|.*?v\d+)[\])}]/i);
    if (enclosedMixMatch) {
      const inside = enclosedMixMatch[1].trim();
      detectedMix = standardizeMixString(inside);
      // Remove the matched enclosure from baseName
      baseName = baseName.replace(enclosedMixMatch[0], ' ');
    } else {
      // Check trailing mix keywords without parentheses
      for (const item of COMMON_MIX_KEYWORDS) {
        if (item.pattern.test(baseName)) {
          detectedMix = item.standardized;
          baseName = baseName.replace(item.pattern, ' ');
          break;
        }
      }
    }
  }

  // 8. Clean leftover empty brackets/parentheses and stray punctuation
  baseName = baseName
    .replace(/\(\s*\)/g, ' ')
    .replace(/\[\s*\]/g, ' ')
    .replace(/\{\s*\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 9. Parse Artist and Title using boundary delimiters
  let artist = '';
  let title = '';

  if (config.setTitleToFileName) {
    title = baseName;
    artist = 'Unknown Artist';
  } else {
    // Look for standard boundary "Artist - Title"
    const dashIndex = baseName.indexOf(' - ');
    if (dashIndex !== -1) {
      artist = baseName.substring(0, dashIndex).trim();
      title = baseName.substring(dashIndex + 3).trim();
    } else if (baseName.includes(' -')) {
      const parts = baseName.split(' -');
      artist = parts[0].trim();
      title = parts.slice(1).join(' -').trim();
    } else if (baseName.includes('- ')) {
      const parts = baseName.split('- ');
      artist = parts[0].trim();
      title = parts.slice(1).join('- ').trim();
    } else {
      // Fallback: If no delimiter found, title is baseName
      artist = 'Unknown Artist';
      title = baseName;
    }
  }

  // Clean trailing dashes/dots from artist and title
  artist = artist.replace(/^[-–—\s]+|[-–—\s]+$/g, '');
  title = title.replace(/^[-–—\s]+|[-–—\s]+$/g, '');

  // 10. Clean up extra promotional brackets inside title
  title = title
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    .trim();

  // 11. Normalize casing
  if (config.smartCapitalization) {
    artist = smartTitleCase(artist);
    title = smartTitleCase(title);
    if (detectedMix) {
      detectedMix = smartTitleCase(detectedMix);
    }
  }

  // Default mix if empty
  if (!detectedMix) {
    detectedMix = 'Original Mix';
  }

  return {
    artist: artist || 'Unknown Artist',
    title: title || 'Untitled Track',
    mixVersion: detectedMix,
    bpmPrefix: detectedBpm,
  };
}

/**
 * Standardize mix string to clean casing and format
 */
function standardizeMixString(mixStr: string): string {
  const clean = mixStr.trim();
  for (const item of COMMON_MIX_KEYWORDS) {
    if (item.pattern.test(clean)) {
      // If there was a remixer name (e.g. "Skrillex Remix"), preserve the name
      const remixerMatch = clean.match(/^(.*?)\s+(remix|bootleg|vip|edit|dub)$/i);
      if (remixerMatch && remixerMatch[1] && !['extended', 'club', 'radio', 'original'].includes(remixerMatch[1].toLowerCase())) {
        return `${smartTitleCase(remixerMatch[1])} ${item.standardized}`;
      }
      return item.standardized;
    }
  }
  return smartTitleCase(clean);
}

/**
 * Cleans up all track metadata fields while strictly preserving technical & file attributes:
 * Exclude from cleanup: FileName, Tag Format, Bit Rate, Duration, File Size, Codec, File Path.
 */
export function cleanUpTrackFields<T extends {
  originalFileName: string;
  filePath: string;
  bitrate: number;
  duration: number;
  fileSize: number;
  fileFormat: any;
  tagFormat: string;
}>(track: T): T {
  // Synchronize base filename as Title so File Name and Title fields are matching
  const baseName = track.originalFileName
    ? track.originalFileName.replace(/\.[a-zA-Z0-9]+$/, '').trim()
    : '';

  const defaultClean = baseName ? cleanRawFilename(baseName) : null;

  return {
    ...track,
    cleanArtist: '',
    cleanTitle: defaultClean?.title || baseName || 'Untitled Track',
    mixVersion: '',
    album: '',
    genre: '',
    year: '',
    albumArtist: '',
    trackNumber: '',
    tracksTotal: '',
    comments: '',
    artworkUrl: undefined,
    composer: '',
    isrc: '',
    rating: 0,
    bpm: null,
    camelotKey: null,
    standardKey: null,
    targetFileName: baseName,
    customTargetFileName: true,
  };
}

