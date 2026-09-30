export type AudioContainer = 'mp3' | 'flac' | 'wav' | 'aiff' | string;

export type TrackStatus = 'idle' | 'analyzing' | 'cleaning' | 'saved' | 'error';

export interface TrackItem {
  id: string;
  filePath: string;
  originalFileName: string;
  cleanArtist: string; // Producer / Artist
  cleanTitle: string; // Title
  mixVersion: string;
  album: string;
  genre: string;
  year: string;
  albumArtist: string; // Album Artist / Producer
  trackNumber: string; // Track #
  tracksTotal: string; // Tracks Total
  comments: string; // Comment
  tagFormat: string; // Tag Format, e.g. "ID3v2.3.0"
  artworkUrl?: string; // Album Artwork image URL or base64
  composer: string;
  isrc: string;
  rating: number; // 0 - 5
  bpm: number | null;
  camelotKey: string | null;
  standardKey: string | null;
  bitrate: number; // in kbps
  sampleRate: number; // e.g. 44100
  bitDepth: number; // e.g. 16, 24
  duration: number; // in seconds
  fileSize: number; // in bytes
  fileFormat: AudioContainer;
  status: TrackStatus;
  errorMessage?: string;
  isQualityWarning?: boolean;
  qualityIssues?: string[];
  originalFile?: File;
  audioUrl?: string;
  selected?: boolean;
  // Computed target filename based on active template
  targetFileName?: string;
  customTargetFileName?: boolean;
}

export type ViewPreset = 'id3' | 'dj' | 'technical';

export interface CleanRuleConfig {
  replaceUnderscores: boolean;
  normalizeWhitespace: boolean;
  stripPromotionalNoise: boolean;
  standardizeMixEnclosures: boolean;
  smartCapitalization: boolean;
  setTitleToFileName?: boolean;
  customNoiseWords: string[];
  customSeparators: string[];
}

export interface FilenameTemplate {
  id: string;
  name: string;
  pattern: string; // e.g. "{Artist} - {Title} ({Mix})"
  description: string;
}

export interface BatchProcessRequest {
  tracks: Array<{
    id: string;
    filePath: string;
    newArtist: string;
    newTitle: string;
    newMix?: string;
    album?: string;
    genre?: string;
    year?: string;
    albumArtist?: string;
    trackNumber?: string;
    tracksTotal?: string;
    comments?: string;
    artworkUrl?: string;
    bpm?: number;
    camelotKey?: string;
    targetFileName?: string;
  }>;
}

export interface BatchProcessResult {
  successCount: number;
  errorCount: number;
  errors: Array<{ id: string; filePath: string; reason: string }>;
  results?: Array<{ id: string; newFilePath: string; status: 'saved' | 'error'; error?: string }>;
}

export interface CamelotKeyInfo {
  camelot: string; // e.g. "8A"
  musicalKey: string; // e.g. "A Minor"
  mode: 'minor' | 'major';
  number: number; // 1 - 12
  letter: 'A' | 'B';
  hexColor: string;
  compatibleKeys: {
    sameKey: string;
    relativeKey: string; // e.g. 8A <-> 8B
    energyDown: string; // -1 on wheel
    energyUp: string; // +1 on wheel
    energyBoost: string; // +2 or +7 on wheel
  };
}

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  duration?: number;
}
