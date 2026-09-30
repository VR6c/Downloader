import { TrackItem, ViewPreset } from '../../types';

export interface ColumnDefinition {
  key: string;
  label: string;
  width?: string;
  minWidth?: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
}

export interface TrackGridProps {
  tracks: TrackItem[];
  preset: ViewPreset;
  onUpdateTrack: (id: string, updates: Partial<TrackItem>) => void;
  onBatchUpdateTracks?: (ids: string[], updates: Partial<TrackItem>, toastMessage?: string) => void;
  onSelectionChange: (selectedIds: string[]) => void;
  onPasteData: (text: string, targetRowIndex: number, targetColKey: string) => void;
  onCopySelected: () => void;
}

export const COLUMN_LABELS: Record<string, string> = {
  cleanTitle: 'Title',
  cleanArtist: 'Producer / Artist',
  mixVersion: 'Mix / Version',
  bpm: 'BPM',
  camelotKey: 'Camelot Key',
  standardKey: 'Musical Key',
  genre: 'Genre',
  album: 'Album',
  year: 'Year',
  albumArtist: 'Album Artist',
  trackNumber: 'Track #',
  tracksTotal: 'Tracks Total',
  comments: 'Comment',
  targetFileName: 'File Name',
  rating: 'Star Rating',
  bitrate: 'Bitrate',
  sampleRate: 'Sample Rate',
  bitDepth: 'Bit Depth',
  duration: 'Duration',
  fileSize: 'File Size',
  fileFormat: 'Codec',
  filePath: 'File Path',
};

export const NON_EDITABLE_COLUMNS = new Set([
  'id',
  'status',
  'bitrate',
  'sampleRate',
  'bitDepth',
  'duration',
  'fileSize',
  'filePath',
  'fileFormat',
  // Title is intentionally read-only in the grid — it is computed by
  // the Rename Template engine. Use the Sync action or edit targetFileName
  // to update cleanTitle indirectly.
  'cleanTitle',
]);
