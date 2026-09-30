export interface MediaInfo {
  id: string;
  title: string;
  author: string;
  channel?: string;
  duration: number;
  duration_str?: string;
  thumbnail: string;
  views?: number;
  views_str?: string;
  date?: string;
  platform: 'youtube' | 'soundcloud' | 'unknown';
  is_audio_only?: boolean;
  webpage_url: string;
  formats?: any[];
}

export interface DownloadConfig {
  id?: string;
  url: string;
  format: 'mp3' | 'mp4' | 'mov';
  quality: string;
  output_dir?: string;
  embed_thumbnail?: boolean;
  embed_metadata?: boolean;
  include_id?: boolean;
}

export interface DownloadProgress {
  id: string;
  percent: number;
  speed?: string;
  eta?: string;
  downloaded?: string;
  total?: string;
  phase?: string;
}

export interface DownloadHistoryItem {
  id: string;
  title: string;
  author: string;
  url: string;
  format: string;
  quality: string;
  filePath: string;
  fileName: string;
  fileSize?: number;
  fileSizeStr?: string;
  timestamp: number;
  thumbnail?: string;
  duration?: number;
  platform?: string;
}

export interface BatchQueueItem {
  id: string;
  url: string;
  format: 'mp3' | 'mp4' | 'mov';
  quality: string;
  title?: string;
  author?: string;
  thumbnail?: string;
  duration?: number;
  status: 'queued' | 'fetching' | 'downloading' | 'completed' | 'error' | 'cancelled';
  progress?: number;
  phase?: string;
  error?: string;
  resultFilePath?: string;
}

export interface EngineStatus {
  ready: boolean;
  ytdlp_version?: string;
  python_version?: string;
  ffmpeg_available?: boolean;
  ffmpeg_path?: string;
  engine_path?: string;
  error?: string;
}
