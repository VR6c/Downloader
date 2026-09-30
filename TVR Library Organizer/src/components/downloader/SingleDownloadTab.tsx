import React, { useState, useEffect, useRef } from 'react';
import {
  Link2,
  Clipboard,
  X,
  Sparkles,
  Download,
  ListPlus,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Play,
  RotateCw,
  Clock,
  User,
  Eye,
  Calendar,
  Layers,
  Check,
  Music,
  Video,
  Film,
  Folder,
} from 'lucide-react';
import { MediaInfo, DownloadConfig, DownloadProgress } from '../../types/downloader';
import {
  fetchMediaInfo,
  startDownload,
  cancelDownload,
  selectDownloadDirectory,
  getDefaultDownloadDir,
  openDownloadedFile,
  showInFolder,
  openExternalUrl,
  getClipboardText,
} from '../../services/downloaderService';
import { Button, Badge } from '../ui';

interface SingleDownloadTabProps {
  onSendToTagEditor: (filePaths: string[]) => void;
  onAddToBatch: (item: { url: string; format: 'mp3' | 'mp4' | 'mov'; quality: string; title?: string; author?: string; thumbnail?: string; duration?: number }) => void;
  addToast: (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => void;
  activeDownload: DownloadProgress | null;
  activeDownloadInfo: { title: string; url: string; format: string } | null;
  lastCompletedFile: { filePath: string; filename: string; title: string } | null;
}

export const SingleDownloadTab: React.FC<SingleDownloadTabProps> = ({
  onSendToTagEditor,
  onAddToBatch,
  addToast,
  activeDownload,
  activeDownloadInfo,
  lastCompletedFile,
}) => {
  const [url, setUrl] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);
  const [format, setFormat] = useState<'mp3' | 'mp4' | 'mov'>('mp3');
  const [quality, setQuality] = useState('320');
  const [downloadDir, setDownloadDir] = useState('');
  const [embedThumb, setEmbedThumb] = useState(true);
  const [embedMeta, setEmbedMeta] = useState(true);
  const [includeId, setIncludeId] = useState(false);

  // Initialize default download directory
  useEffect(() => {
    getDefaultDownloadDir().then((dir) => {
      if (dir) setDownloadDir(dir);
    });
  }, []);

  // Format changes: auto-adjust quality
  const handleFormatChange = (newFormat: 'mp3' | 'mp4' | 'mov') => {
    setFormat(newFormat);
    if (newFormat === 'mp3') {
      setQuality('320');
    } else {
      setQuality('best');
    }
  };

  const handlePaste = async () => {
    const text = await getClipboardText();
    if (text) {
      setUrl(text.trim());
      handleFetch(text.trim());
    }
  };

  const handleClear = () => {
    setUrl('');
    setMediaInfo(null);
  };

  const handleBrowseFolder = async () => {
    const selected = await selectDownloadDirectory(downloadDir);
    if (selected) {
      setDownloadDir(selected);
    }
  };

  const handleFetch = async (targetUrl?: string) => {
    const fetchTarget = (targetUrl || url).trim();
    if (!fetchTarget) {
      addToast('warning', 'Missing URL', 'Please enter a valid YouTube or SoundCloud URL.');
      return;
    }

    setIsFetching(true);
    try {
      const res = await fetchMediaInfo(fetchTarget);
      if (res.success && res.data) {
        setMediaInfo(res.data);
        if (res.data.is_audio_only) {
          setFormat('mp3');
          setQuality('320');
        }
        addToast('success', 'Media Detected', `Ready: ${res.data.title}`);
      } else {
        addToast('error', 'Fetch Failed', res.message || 'Could not fetch media details.');
      }
    } catch (err: any) {
      addToast('error', 'Engine Error', err.message || 'Error communicating with engine');
    } finally {
      setIsFetching(false);
    }
  };

  const handleStartDownload = async () => {
    if (!url.trim()) return;

    const config: DownloadConfig = {
      id: `dl_${Date.now()}`,
      url: url.trim(),
      format,
      quality,
      output_dir: downloadDir,
      embed_thumbnail: embedThumb,
      embed_metadata: embedMeta,
      include_id: includeId,
    };

    try {
      const res = await startDownload(config);
      if (res.success) {
        addToast('info', 'Download Started', `Downloading in ${format.toUpperCase()} (${quality} kbps)...`);
      } else {
        addToast('error', 'Download Failed', res.message || 'Could not start download');
      }
    } catch (err: any) {
      addToast('error', 'Engine Error', err.message);
    }
  };

  const handleAbort = async () => {
    if (activeDownload?.id) {
      await cancelDownload(activeDownload.id);
      addToast('warning', 'Download Aborted', 'Process cancelled by user.');
    }
  };

  const handleAddToQueue = () => {
    if (!url.trim()) return;
    onAddToBatch({
      url: url.trim(),
      format,
      quality,
      title: mediaInfo?.title,
      author: mediaInfo?.author,
      thumbnail: mediaInfo?.thumbnail,
      duration: mediaInfo?.duration,
    });
    addToast('success', 'Added to Queue', mediaInfo?.title || url);
  };

  const formatDuration = (sec?: number) => {
    if (!sec) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="dl-single-tab">
      {/* 1. URL Hero Input Card */}
      <div className="dl-card">
        <div className="dl-input-header">
          <div className="dl-input-label">
            <Link2 size={18} style={{ color: 'var(--accent-primary)' }} />
            <span>Enter YouTube Video, Short, or SoundCloud Link</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={<Clipboard size={14} />}
            onClick={handlePaste}
            title="Paste from clipboard"
          >
            Paste Clipboard
          </Button>
        </div>

        <div className="dl-input-row">
          <input
            type="text"
            className="dl-url-input"
            placeholder="https://www.youtube.com/watch?v=... or https://soundcloud.com/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleFetch();
            }}
          />
          {url && (
            <button type="button" className="dl-icon-btn" onClick={handleClear} title="Clear">
              <X size={16} />
            </button>
          )}
          <Button
            variant="primary"
            size="md"
            className="dl-btn-fetch"
            onClick={() => handleFetch()}
            disabled={isFetching || !url.trim()}
            isLoading={isFetching}
            icon={<Sparkles size={14} />}
          >
            {isFetching ? 'Fetching...' : 'Fetch Details'}
          </Button>
        </div>
      </div>

      {/* 2. Download Success Banner with 2-in-1 Bridge */}
      {lastCompletedFile && (
        <div className="dl-success-card">
          <div className="dl-success-left">
            <div className="dl-success-icon">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <div className="dl-success-title">Download Complete!</div>
              <div className="dl-success-path" title={lastCompletedFile.filePath}>
                {lastCompletedFile.filename}
              </div>
            </div>
          </div>
          <div className="dl-success-actions">
            <Button
              variant="secondary"
              size="sm"
              icon={<Play size={14} />}
              onClick={() => openDownloadedFile(lastCompletedFile.filePath)}
              title="Play media file"
            >
              Play
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<FolderOpen size={14} />}
              onClick={() => showInFolder(lastCompletedFile.filePath)}
              title="Show in Finder / Explorer"
            >
              Folder
            </Button>
            {/* 2-in-1 MARQUEE FEATURE: Open in Tag Editor */}
            <Button
              variant="accent"
              size="sm"
              className="dl-btn-editor-bridge"
              icon={<Layers size={15} />}
              onClick={() => onSendToTagEditor([lastCompletedFile.filePath])}
              title="Send to Tag Editor & Analyze BPM/Key"
            >
              Edit in Tag Editor &amp; DSP
            </Button>
          </div>
        </div>
      )}

      {/* 3. Active Download Progress Card */}
      {activeDownload && (
        <div className="dl-card dl-progress-card">
          <div className="dl-progress-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="dl-phase-badge">
                <RotateCw size={13} className="spin-animation" />
                <span>{activeDownload.phase || 'Downloading...'}</span>
              </div>
              <strong style={{ fontSize: 14 }}>
                {activeDownloadInfo?.title || 'Active Download'}
              </strong>
            </div>
            <button
              type="button"
              className="dl-btn-secondary"
              onClick={handleAbort}
              style={{ color: 'var(--danger)', borderColor: 'var(--danger-bg)' }}
            >
              <X size={14} />
              <span>Cancel</span>
            </button>
          </div>

          <div className="dl-progress-track">
            <div
              className="dl-progress-fill"
              style={{ width: `${Math.min(100, Math.max(0, activeDownload.percent || 0))}%` }}
            />
          </div>

          <div className="dl-metrics-grid">
            <div className="dl-metric-item">
              <span className="dl-metric-label">Progress</span>
              <span className="dl-metric-value">{Math.round(activeDownload.percent || 0)}%</span>
            </div>
            <div className="dl-metric-item">
              <span className="dl-metric-label">Speed</span>
              <span className="dl-metric-value">{activeDownload.speed || '-- KiB/s'}</span>
            </div>
            <div className="dl-metric-item">
              <span className="dl-metric-label">ETA</span>
              <span className="dl-metric-value">{activeDownload.eta || '--:--'}</span>
            </div>
            <div className="dl-metric-item">
              <span className="dl-metric-label">Size</span>
              <span className="dl-metric-value">{activeDownload.downloaded || '0 MiB'}</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Media Metadata & Configuration Card */}
      {mediaInfo && (
        <div className="dl-card dl-media-card">
          {/* Left: Thumbnail & Duration */}
          <div>
            <div className="dl-media-thumb-box">
              <img
                src={mediaInfo.thumbnail}
                alt={mediaInfo.title}
                className="dl-media-thumb"
              />
              <span className="dl-duration-pill">{formatDuration(mediaInfo.duration)}</span>
              <span
                className={`dl-platform-badge ${
                  mediaInfo.platform === 'soundcloud' ? 'dl-platform-soundcloud' : 'dl-platform-youtube'
                }`}
              >
                {mediaInfo.platform}
              </span>
            </div>
          </div>

          {/* Right: Controls & Actions */}
          <div className="dl-media-info">
            <h3 className="dl-media-title">{mediaInfo.title}</h3>
            <div className="dl-media-meta-row">
              <span className="dl-meta-item">
                <User size={14} />
                <strong>{mediaInfo.author || mediaInfo.channel}</strong>
              </span>
              {mediaInfo.views && (
                <span className="dl-meta-item">
                  <Eye size={14} />
                  <span>{mediaInfo.views.toLocaleString()} views</span>
                </span>
              )}
              {mediaInfo.date && (
                <span className="dl-meta-item">
                  <Calendar size={14} />
                  <span>{mediaInfo.date}</span>
                </span>
              )}
            </div>

            {/* Format Selection */}
            <div className="dl-section-label">
              <span>Output Format</span>
            </div>
            <div className="dl-format-group">
              <button
                type="button"
                className={`dl-format-btn ${format === 'mp3' ? 'active' : ''}`}
                onClick={() => handleFormatChange('mp3')}
              >
                <div className="dl-format-title-row">
                  <Music size={16} className="dl-format-icon" />
                  <span>MP3 (Audio)</span>
                </div>
                <span className="subtext">ID3v2.3 tags & album art</span>
              </button>
              <button
                type="button"
                className={`dl-format-btn ${format === 'mp4' ? 'active' : ''}`}
                onClick={() => handleFormatChange('mp4')}
                disabled={mediaInfo.is_audio_only}
              >
                <div className="dl-format-title-row">
                  <Video size={16} className="dl-format-icon" />
                  <span>MP4 (Video)</span>
                </div>
                <span className="subtext">HD video with muxed audio</span>
              </button>
              <button
                type="button"
                className={`dl-format-btn ${format === 'mov' ? 'active' : ''}`}
                onClick={() => handleFormatChange('mov')}
                disabled={mediaInfo.is_audio_only}
              >
                <div className="dl-format-title-row">
                  <Film size={16} className="dl-format-icon" />
                  <span>MOV (QuickTime)</span>
                </div>
                <span className="subtext">Apple ProRes / QuickTime</span>
              </button>
            </div>

            {/* Quality Selection */}
            <div className="dl-section-label">
              <span>{format === 'mp3' ? 'Audio Bitrate' : 'Video Resolution'}</span>
            </div>
            <div className="dl-quality-chips">
              {format === 'mp3' ? (
                <>
                  {[
                    { id: '320', label: '320 kbps (Studio CBR)' },
                    { id: '256', label: '256 kbps (High)' },
                    { id: '192', label: '192 kbps (Standard)' },
                    { id: '128', label: '128 kbps (Compact)' },
                  ].map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      className={`dl-quality-chip ${quality === q.id ? 'active' : ''}`}
                      onClick={() => setQuality(q.id)}
                    >
                      {q.label}
                    </button>
                  ))}
                </>
              ) : (
                <>
                  {[
                    { id: 'best', label: 'Auto (Best Quality)' },
                    { id: '2160', label: '4K (2160p)' },
                    { id: '1440', label: '2K (1440p)' },
                    { id: '1080', label: '1080p FHD' },
                    { id: '720', label: '720p HD' },
                    { id: '480', label: '480p SD' },
                  ].map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      className={`dl-quality-chip ${quality === q.id ? 'active' : ''}`}
                      onClick={() => setQuality(q.id)}
                    >
                      {q.label}
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Destination Folder */}
            <div className="dl-folder-row">
              <div className="dl-folder-display" title={downloadDir}>
                <Folder size={14} className="dl-folder-icon" />
                <span>{downloadDir || 'Default Downloads folder'}</span>
              </div>
              <Button
                variant="secondary"
                size="md"
                onClick={handleBrowseFolder}
                icon={<FolderOpen size={14} />}
              >
                Browse...
              </Button>
            </div>

            {/* Options Checkboxes */}
            <div className="dl-options-row">
              <label className="dl-checkbox-label">
                <input
                  type="checkbox"
                  checked={embedThumb}
                  onChange={(e) => setEmbedThumb(e.target.checked)}
                />
                <span>Embed Album Artwork</span>
              </label>
              <label className="dl-checkbox-label">
                <input
                  type="checkbox"
                  checked={embedMeta}
                  onChange={(e) => setEmbedMeta(e.target.checked)}
                />
                <span>Embed ID3 Metadata</span>
              </label>
              <label className="dl-checkbox-label">
                <input
                  type="checkbox"
                  checked={includeId}
                  onChange={(e) => setIncludeId(e.target.checked)}
                />
                <span>Include Video ID in Filename</span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="dl-action-row">
              <Button
                variant="primary"
                size="md"
                onClick={handleStartDownload}
                disabled={Boolean(activeDownload)}
                icon={<Download size={16} />}
              >
                Download {format.toUpperCase()} ({quality}{format === 'mp3' ? ' kbps' : ''})
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={handleAddToQueue}
                icon={<ListPlus size={16} />}
              >
                Add to Batch
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
