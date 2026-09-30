import { TrackItem } from '../types';
import { normalizeCamelotKey } from './camelot';

export interface EditableFieldInfo {
  key: keyof TrackItem;
  label: string;
  category: 'metadata' | 'dj' | 'filename';
  description: string;
}

export const EDITABLE_FIELDS: EditableFieldInfo[] = [
  { key: 'cleanArtist', label: 'Producer / Artist', category: 'metadata', description: 'Artist or music producer name' },
  { key: 'cleanTitle', label: 'Title', category: 'metadata', description: 'Track title' },
  { key: 'mixVersion', label: 'Mix / Version', category: 'metadata', description: 'Mix version (e.g. Club Mix, VIP, Radio Edit)' },
  { key: 'bpm', label: 'BPM', category: 'dj', description: 'Beats Per Minute tempo' },
  { key: 'camelotKey', label: 'Camelot Key', category: 'dj', description: 'Harmonic Camelot key (e.g. 8A, 11B)' },
  { key: 'standardKey', label: 'Standard Key', category: 'dj', description: 'Standard musical key (e.g. A Minor)' },
  { key: 'genre', label: 'Genre', category: 'metadata', description: 'Musical genre' },
  { key: 'year', label: 'Year', category: 'metadata', description: 'Release year' },
  { key: 'album', label: 'Album', category: 'metadata', description: 'Album or EP title' },
  { key: 'albumArtist', label: 'Album Artist', category: 'metadata', description: 'Album artist / curator' },
  { key: 'rating', label: 'Rating', category: 'dj', description: 'Track star rating (0 - 5)' },
  { key: 'trackNumber', label: 'Track #', category: 'metadata', description: 'Track number' },
  { key: 'tracksTotal', label: 'Tracks Total', category: 'metadata', description: 'Total track count' },
  { key: 'comments', label: 'Comment', category: 'metadata', description: 'ID3 comments / notes' },
  { key: 'composer', label: 'Composer', category: 'metadata', description: 'Song composer / writer' },
  { key: 'targetFileName', label: 'Target Filename', category: 'filename', description: 'Custom renamed filename on disk' },
];

export const EDITABLE_FIELD_KEYS = new Set<string>(EDITABLE_FIELDS.map((f) => f.key));

export const COLUMN_ALIAS_MAP: Record<string, keyof TrackItem> = {
  // Producer / Artist
  'producer': 'cleanArtist',
  'artist': 'cleanArtist',
  'cleanartist': 'cleanArtist',
  'clean artist': 'cleanArtist',
  'producer / artist': 'cleanArtist',
  'producer/artist': 'cleanArtist',
  'artist/producer': 'cleanArtist',
  'track artist': 'cleanArtist',

  // Title
  'title': 'cleanTitle',
  'cleantitle': 'cleanTitle',
  'clean title': 'cleanTitle',
  'song title': 'cleanTitle',
  'track title': 'cleanTitle',
  'song': 'cleanTitle',
  'track': 'cleanTitle',
  'name': 'cleanTitle',

  // Mix / Version
  'mix / version': 'mixVersion',
  'mix/version': 'mixVersion',
  'mix': 'mixVersion',
  'version': 'mixVersion',
  'mixversion': 'mixVersion',
  'remix': 'mixVersion',

  // BPM
  'bpm': 'bpm',
  'tempo': 'bpm',

  // Camelot Key
  'camelot key': 'camelotKey',
  'camelot': 'camelotKey',
  'camelotkey': 'camelotKey',
  'key': 'camelotKey',
  'tonality': 'camelotKey',

  // Standard Key
  'standard key': 'standardKey',
  'standardkey': 'standardKey',
  'musical key': 'standardKey',

  // Genre
  'genre': 'genre',

  // Year
  'year': 'year',
  'release year': 'year',
  'date': 'year',

  // Album
  'album': 'album',

  // Album Artist
  'album artist': 'albumArtist',
  'albumartist': 'albumArtist',

  // Rating
  'rating': 'rating',

  // Track Number
  'track #': 'trackNumber',
  'track number': 'trackNumber',
  'trackno': 'trackNumber',
  'track no': 'trackNumber',
  'track_number': 'trackNumber',

  // Tracks Total
  'tracks total': 'tracksTotal',
  'trackstotal': 'tracksTotal',
  'total tracks': 'tracksTotal',

  // Comments
  'comment': 'comments',
  'comments': 'comments',

  // Composer
  'composer': 'composer',

  // Target Filename
  'target filename': 'targetFileName',
  'target file name': 'targetFileName',
  'targetfilename': 'targetFileName',
  'new filename': 'targetFileName',
  'new file name': 'targetFileName',
};

export const IDENTIFIER_COLUMN_MAP: Record<string, 'id' | 'filePath' | 'originalFileName'> = {
  'track id': 'id',
  'id': 'id',
  'trackid': 'id',
  '#': 'id',

  'file path': 'filePath',
  'filepath': 'filePath',
  'path': 'filePath',
  'location': 'filePath',

  'original filename': 'originalFileName',
  'original file name': 'originalFileName',
  'originalfilename': 'originalFileName',
  'filename': 'originalFileName',
  'file name': 'originalFileName',
  'source filename': 'originalFileName',
};

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  delimiter: string;
}

/**
 * Robust RFC 4180 CSV / TSV parser handling quotes, line breaks, and auto delimiter detection
 */
export function parseCsvContent(text: string, forcedDelimiter?: string): ParsedCsv {
  const clean = text.replace(/^\uFEFF/, '');
  if (!clean.trim()) return { headers: [], rows: [], delimiter: ',' };

  // Detect delimiter if not forced
  let delimiter = forcedDelimiter;
  if (!delimiter) {
    const firstLine = clean.split(/\r\n|\n|\r/)[0] || '';
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    if (tabCount > commaCount && tabCount > semicolonCount) delimiter = '\t';
    else if (semicolonCount > commaCount) delimiter = ';';
    else delimiter = ',';
  }

  const records: string[][] = [];
  let currentRecord: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  let i = 0;

  while (i < clean.length) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentCell += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentCell += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === delimiter) {
        currentRecord.push(currentCell.trim());
        currentCell = '';
        i++;
        continue;
      } else if (char === '\r') {
        if (nextChar === '\n') i++;
        currentRecord.push(currentCell.trim());
        currentCell = '';
        records.push(currentRecord);
        currentRecord = [];
        i++;
        continue;
      } else if (char === '\n') {
        currentRecord.push(currentCell.trim());
        currentCell = '';
        records.push(currentRecord);
        currentRecord = [];
        i++;
        continue;
      } else {
        currentCell += char;
        i++;
        continue;
      }
    }
  }

  if (currentCell.length > 0 || currentRecord.length > 0) {
    currentRecord.push(currentCell.trim());
    records.push(currentRecord);
  }

  const nonEmptyRecords = records.filter((r) => r.some((cell) => cell.length > 0));
  if (nonEmptyRecords.length === 0) return { headers: [], rows: [], delimiter };

  const rawHeaders = nonEmptyRecords[0].map((h) => h.replace(/^["']|["']$/g, '').trim());
  const dataRows = nonEmptyRecords.slice(1);

  const rows: Record<string, string>[] = [];
  for (const dataRow of dataRows) {
    const rowObj: Record<string, string> = {};
    rawHeaders.forEach((header, colIndex) => {
      rowObj[header] = (dataRow[colIndex] ?? '').trim();
    });
    rows.push(rowObj);
  }

  return { headers: rawHeaders, rows, delimiter };
}

export type MatchStrategy = 'auto' | 'id' | 'path' | 'filename' | 'row_order';

export interface CsvFieldDiff {
  field: keyof TrackItem;
  fieldLabel: string;
  oldValue: any;
  newValue: any;
  hasChanged: boolean;
}

export interface CsvTrackMatch {
  track: TrackItem;
  csvRowIndex: number;
  matchedBy: 'id' | 'path' | 'filename' | 'title_artist' | 'row_order';
  diffs: CsvFieldDiff[];
  hasAnyChange: boolean;
  rawRow: Record<string, string>;
}

export interface CsvImportAnalysis {
  fileName: string;
  totalCsvRows: number;
  matchedTracks: CsvTrackMatch[];
  unmatchedRows: Array<{ rowIndex: number; rawRow: Record<string, string>; reason: string }>;
  detectedFields: Array<{ field: keyof TrackItem; label: string; countPresent: number; countChanged: number }>;
  totalChangedValues: number;
  unmatchedLibraryTracks: TrackItem[];
}

/**
 * Normalizes an incoming cell string value into the appropriate TrackItem field type
 */
export function normalizeFieldValue(field: keyof TrackItem, rawValue: string): any {
  const trimmed = rawValue.trim();

  if (field === 'bpm') {
    if (!trimmed) return null;
    const n = parseFloat(trimmed.replace(/[^0-9.]/g, ''));
    return isNaN(n) ? null : Math.round(n * 100) / 100;
  }

  if (field === 'camelotKey') {
    if (!trimmed) return null;
    const { camelot } = normalizeCamelotKey(trimmed);
    return camelot || trimmed.toUpperCase();
  }

  if (field === 'standardKey') {
    return trimmed || null;
  }

  if (field === 'rating') {
    if (!trimmed) return 0;
    const r = parseInt(trimmed.replace(/[^0-9]/g, ''), 10);
    return isNaN(r) ? 0 : Math.max(0, Math.min(5, r));
  }

  if (field === 'targetFileName') {
    return trimmed.replace(/\.[a-zA-Z0-9]+$/, '').trim();
  }

  return trimmed;
}

/**
 * Maps CSV column headers to TrackItem fields and identifier fields
 */
export function mapCsvHeaders(headers: string[]): {
  fieldMap: Map<string, keyof TrackItem>;
  idCol: string | null;
  pathCol: string | null;
  filenameCol: string | null;
} {
  const fieldMap = new Map<string, keyof TrackItem>();
  let idCol: string | null = null;
  let pathCol: string | null = null;
  let filenameCol: string | null = null;

  for (const header of headers) {
    const normalized = header.toLowerCase().trim();

    // Check identifiers first
    const idType = IDENTIFIER_COLUMN_MAP[normalized];
    if (idType === 'id') idCol = header;
    else if (idType === 'filePath') pathCol = header;
    else if (idType === 'originalFileName') filenameCol = header;

    // Check editable fields
    const mappedField = COLUMN_ALIAS_MAP[normalized];
    if (mappedField) {
      fieldMap.set(header, mappedField);
    }
  }

  return { fieldMap, idCol, pathCol, filenameCol };
}

/**
 * Analyzes CSV contents against current tracks in the library, computing matches and diffs
 */
export function analyzeCsvForImport(
  csv: ParsedCsv,
  libraryTracks: TrackItem[],
  strategy: MatchStrategy = 'auto',
  fileName = 'imported_data.csv'
): CsvImportAnalysis {
  const { fieldMap, idCol, pathCol, filenameCol } = mapCsvHeaders(csv.headers);

  // Quick lookup indices
  const trackById = new Map<string, TrackItem>();
  const trackByPath = new Map<string, TrackItem>();
  const trackByFilename = new Map<string, TrackItem>();
  const trackByFilenameWithoutExt = new Map<string, TrackItem>();

  for (const track of libraryTracks) {
    if (track.id) trackById.set(track.id, track);
    if (track.filePath) {
      trackByPath.set(track.filePath.toLowerCase().trim(), track);
    }
    if (track.originalFileName) {
      const fn = track.originalFileName.toLowerCase().trim();
      trackByFilename.set(fn, track);
      const withoutExt = fn.replace(/\.[a-zA-Z0-9]+$/, '').trim();
      trackByFilenameWithoutExt.set(withoutExt, track);
    }
  }

  const matchedTracks: CsvTrackMatch[] = [];
  const unmatchedRows: Array<{ rowIndex: number; rawRow: Record<string, string>; reason: string }> = [];
  const matchedTrackIds = new Set<string>();

  csv.rows.forEach((row, rowIndex) => {
    let matchedTrack: TrackItem | null = null;
    let matchedBy: 'id' | 'path' | 'filename' | 'title_artist' | 'row_order' = 'auto' as any;

    const rowId = idCol ? (row[idCol] || '').trim() : '';
    const rowPath = pathCol ? (row[pathCol] || '').trim().toLowerCase() : '';
    const rowFilename = filenameCol ? (row[filenameCol] || '').trim() : '';

    if (strategy === 'id' || strategy === 'auto') {
      if (rowId && trackById.has(rowId)) {
        matchedTrack = trackById.get(rowId)!;
        matchedBy = 'id';
      }
    }

    if (!matchedTrack && (strategy === 'path' || strategy === 'auto')) {
      if (rowPath && trackByPath.has(rowPath)) {
        matchedTrack = trackByPath.get(rowPath)!;
        matchedBy = 'path';
      }
    }

    if (!matchedTrack && (strategy === 'filename' || strategy === 'auto')) {
      if (rowFilename) {
        const fn = rowFilename.toLowerCase().trim();
        const withoutExt = fn.replace(/\.[a-zA-Z0-9]+$/, '').trim();
        if (trackByFilename.has(fn)) {
          matchedTrack = trackByFilename.get(fn)!;
          matchedBy = 'filename';
        } else if (trackByFilenameWithoutExt.has(withoutExt)) {
          matchedTrack = trackByFilenameWithoutExt.get(withoutExt)!;
          matchedBy = 'filename';
        }
      }
    }

    // Match by Row Order fallback
    if (!matchedTrack && (strategy === 'row_order' || (strategy === 'auto' && !rowId && !rowPath && !rowFilename))) {
      if (rowIndex < libraryTracks.length) {
        matchedTrack = libraryTracks[rowIndex];
        matchedBy = 'row_order';
      }
    }

    if (!matchedTrack) {
      unmatchedRows.push({
        rowIndex,
        rawRow: row,
        reason: 'No matching track found by ID, File Path, or Filename',
      });
      return;
    }

    matchedTrackIds.add(matchedTrack.id);

    // Compute field diffs
    const diffs: CsvFieldDiff[] = [];
    let trackHasChanges = false;

    for (const [colName, fieldKey] of fieldMap.entries()) {
      const rawVal = row[colName];
      if (rawVal === undefined) continue;

      const normalizedNew = normalizeFieldValue(fieldKey, rawVal);
      const currentVal = (matchedTrack as any)[fieldKey];

      // Formatted check for comparison
      const formattedCurrent = currentVal === null || currentVal === undefined ? '' : String(currentVal).trim();
      const formattedNew = normalizedNew === null || normalizedNew === undefined ? '' : String(normalizedNew).trim();

      const hasChanged = formattedCurrent !== formattedNew;
      if (hasChanged) trackHasChanges = true;

      const fieldInfo = EDITABLE_FIELDS.find((f) => f.key === fieldKey);

      diffs.push({
        field: fieldKey,
        fieldLabel: fieldInfo ? fieldInfo.label : String(fieldKey),
        oldValue: currentVal,
        newValue: normalizedNew,
        hasChanged,
      });
    }

    matchedTracks.push({
      track: matchedTrack,
      csvRowIndex: rowIndex,
      matchedBy,
      diffs,
      hasAnyChange: trackHasChanges,
      rawRow: row,
    });
  });

  // Calculate field statistics
  const fieldCounts = new Map<keyof TrackItem, { countPresent: number; countChanged: number }>();
  let totalChangedValues = 0;

  for (const m of matchedTracks) {
    for (const d of m.diffs) {
      const existing = fieldCounts.get(d.field) || { countPresent: 0, countChanged: 0 };
      existing.countPresent++;
      if (d.hasChanged) {
        existing.countChanged++;
        totalChangedValues++;
      }
      fieldCounts.set(d.field, existing);
    }
  }

  const detectedFields = EDITABLE_FIELDS.filter((f) => fieldCounts.has(f.key)).map((f) => {
    const stats = fieldCounts.get(f.key)!;
    return {
      field: f.key,
      label: f.label,
      countPresent: stats.countPresent,
      countChanged: stats.countChanged,
    };
  });

  const unmatchedLibraryTracks = libraryTracks.filter((t) => !matchedTrackIds.has(t.id));

  return {
    fileName,
    totalCsvRows: csv.rows.length,
    matchedTracks,
    unmatchedRows,
    detectedFields,
    totalChangedValues,
    unmatchedLibraryTracks,
  };
}

/**
 * Applies approved CSV changes to tracks in the library
 */
export function applyCsvImport(
  currentTracks: TrackItem[],
  analysis: CsvImportAnalysis,
  selectedFields: Set<keyof TrackItem>
): TrackItem[] {
  const matchMap = new Map<string, CsvTrackMatch>();
  for (const m of analysis.matchedTracks) {
    matchMap.set(m.track.id, m);
  }

  return currentTracks.map((track) => {
    const match = matchMap.get(track.id);
    if (!match) return track;

    const updated = { ...track };
    let hasTargetFileNameUpdate = false;

    for (const diff of match.diffs) {
      if (!selectedFields.has(diff.field)) continue;

      (updated as any)[diff.field] = diff.newValue;

      if (diff.field === 'targetFileName' && diff.hasChanged) {
        hasTargetFileNameUpdate = true;
      }

      // If camelotKey changed and standardKey is not specifically set, update standardKey
      if (diff.field === 'camelotKey' && diff.newValue && !selectedFields.has('standardKey')) {
        const { standard } = normalizeCamelotKey(diff.newValue);
        if (standard) updated.standardKey = standard;
      }
    }

    if (hasTargetFileNameUpdate) {
      updated.customTargetFileName = true;
    }

    return updated;
  });
}
