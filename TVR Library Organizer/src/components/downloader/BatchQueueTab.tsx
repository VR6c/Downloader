import React, { useState, useMemo } from 'react';
import {
  Layers,
  Play,
  Trash2,
  Plus,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  ArrowRight,
  Music,
  Video,
  Film,
  Folder,
  Copy,
  Check,
} from 'lucide-react';
import { BatchQueueItem } from '../../types/downloader';
import {
  openDownloadedFile,
  showInFolder,
} from '../../services/downloaderService';
import { SelectDropdown, SelectOption } from '../SelectDropdown';
import { Button, Badge } from '../ui';

interface BatchQueueTabProps {
  queue: BatchQueueItem[];
  onAddUrls: (urls: string[], format: 'mp3' | 'mp4' | 'mov', quality: string) => void;
  onStartAll: () => void;
  onClearQueue: () => void;
  onRemoveItem: (id: string) => void;
  onSendToTagEditor: (filePaths: string[]) => void;
  isProcessing: boolean;
  outputDir: string;
  onBrowseFolder: () => void;
}

export const BatchQueueTab: React.FC<BatchQueueTabProps> = ({
  queue,
  onAddUrls,
  onStartAll,
  onClearQueue,
  onRemoveItem,
  onSendToTagEditor,
  isProcessing,
  outputDir,
  onBrowseFolder,
}) => {
  const [rawUrls, setRawUrls] = useState('');
  const [format, setFormat] = useState<'mp3' | 'mp4' | 'mov'>('mp3');
  const [quality, setQuality] = useState('320');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyLink = async (url: string, id: string) => {
    if (!url) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (_) {}
  };

  const formatOptions: SelectOption<'mp3' | 'mp4' | 'mov'>[] = useMemo(
    () => [
      {
        value: 'mp3',
        label: 'MP3 (Audio)',
        icon: <Music size={14} style={{ color: 'var(--accent-primary)' }} />,
      },
      {
        value: 'mp4',
        label: 'MP4 (Video)',
        icon: <Video size={14} style={{ color: 'var(--accent-primary)' }} />,
      },
      {
        value: 'mov',
        label: 'MOV (QuickTime)',
        icon: <Film size={14} style={{ color: 'var(--accent-primary)' }} />,
      },
    ],
    []
  );

  const qualityOptions: SelectOption[] = useMemo(() => {
    if (format === 'mp3') {
      return [
        { value: '320', label: '320 kbps (Studio CBR)' },
        { value: '256', label: '256 kbps (High)' },
        { value: '192', label: '192 kbps (Standard)' },
        { value: '128', label: '128 kbps (Compact)' },
      ];
    }
    return [
      { value: 'best', label: 'Best Original' },
      { value: '1080', label: '1080p FHD' },
      { value: '720', label: '720p HD' },
    ];
  }, [format]);

  const handleAdd = () => {
    const lines = rawUrls
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (!lines.length) return;
    onAddUrls(lines, format, quality);
    setRawUrls('');
  };

  const completedFiles = queue
    .filter((q) => q.status === 'completed' && q.resultFilePath)
    .map((q) => q.resultFilePath as string);

  return (
    <div className="dl-batch-tab">
      {/* 1. Queue Ingestion Card */}
      <div className="dl-card">
        <div className="dl-input-header">
          <div className="dl-input-label">
            <Layers size={18} style={{ color: 'var(--accent-primary)' }} />
            <span>Batch URL Ingestion (Paste multiple links)</span>
          </div>
        </div>

        <textarea
          rows={4}
          className="dl-url-input"
          style={{
            width: '100%',
            background: 'var(--bg-primary)',
            border: '1.5px solid var(--border-subtle)',
            borderRadius: 12,
            padding: 12,
            boxSizing: 'border-box',
            marginBottom: 16,
            resize: 'vertical',
          }}
          placeholder="Paste multiple YouTube or SoundCloud links (one per line)..."
          value={rawUrls}
          onChange={(e) => setRawUrls(e.target.value)}
        />

        <div className="dl-batch-controls-row">
          <div className="dl-batch-inputs-group">
            <SelectDropdown<'mp3' | 'mp4' | 'mov'>
              value={format}
              onChange={(val) => {
                setFormat(val);
                if (val === 'mp3') {
                  setQuality('320');
                } else {
                  setQuality('best');
                }
              }}
              options={formatOptions}
              size="md"
              menuMinWidth={180}
              title="Output format"
              ariaLabel="Output format"
            />

            <SelectDropdown
              value={quality}
              onChange={(val) => setQuality(val)}
              options={qualityOptions}
              size="md"
              menuMinWidth={200}
              title="Quality / Bitrate"
              ariaLabel="Quality / Bitrate"
            />

            <Button
              variant="secondary"
              size="md"
              icon={<Plus size={15} />}
              onClick={handleAdd}
              disabled={!rawUrls.trim()}
            >
              Add URLs to Queue
            </Button>
          </div>

          {/* Destination Folder */}
          <div className="dl-folder-row" style={{ marginTop: 12 }}>
            <div className="dl-folder-display" title={outputDir}>
              <Folder size={14} className="dl-folder-icon" />
              <span>{outputDir || 'Default Downloads folder'}</span>
            </div>
            <Button
              variant="secondary"
              size="md"
              onClick={onBrowseFolder}
              icon={<FolderOpen size={14} />}
            >
              Browse...
            </Button>
          </div>

          <div className="dl-batch-actions-group">
            {completedFiles.length > 0 && (
              <Button
                variant="accent"
                size="md"
                icon={<Layers size={15} />}
                onClick={() => onSendToTagEditor(completedFiles)}
                title="Load all completed batch tracks into the Tag Editor"
              >
                Send {completedFiles.length} to Tag Editor
              </Button>
            )}

            <Button
              variant="primary"
              size="md"
              icon={isProcessing ? <RotateCw size={15} className="spin-animation" /> : <Play size={15} />}
              onClick={onStartAll}
              disabled={isProcessing || queue.filter((q) => q.status === 'queued').length === 0}
            >
              {isProcessing ? 'Processing Queue...' : 'Start Download All'}
            </Button>

            {queue.length > 0 && (
              <Button
                variant="secondary"
                size="md"
                icon={<Trash2 size={15} />}
                onClick={onClearQueue}
                disabled={isProcessing}
                title="Clear entire queue"
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Queue List Table */}
      {queue.length === 0 ? (
        <div className="dl-card dl-empty-state">
          <div className="dl-empty-icon">
            <Layers size={28} />
          </div>
          <div className="dl-empty-title">Queue is Empty</div>
          <div className="dl-empty-desc">
            Paste one or more YouTube or SoundCloud URLs above to queue multiple downloads for automated processing.
          </div>
        </div>
      ) : (
        <div className="dl-table-container">
          <table className="dl-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Item</th>
                <th>Title / URL</th>
                <th style={{ width: 120 }}>Format</th>
                <th style={{ width: 140 }}>Status</th>
                <th style={{ width: 160, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((item, idx) => (
                <tr key={item.id}>
                  <td>
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt="" className="dl-history-thumb" />
                    ) : (
                      <div
                        className="dl-history-thumb"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        #{idx + 1}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.title || item.url}</div>
                    {item.author && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {item.author}
                      </div>
                    )}
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{item.format.toUpperCase()}</span>{' '}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      ({item.quality}
                      {item.format === 'mp3' ? 'k' : 'p'})
                    </span>
                  </td>
                  <td>
                    <span
                      className={`dl-badge-status dl-badge-${item.status}`}
                    >
                      {item.status === 'downloading' && (
                        <RotateCw size={11} className="spin-animation" />
                      )}
                      {item.status === 'completed' && <CheckCircle2 size={11} />}
                      {item.status === 'error' && <AlertTriangle size={11} />}
                      <span>{item.phase || item.status}</span>
                      {item.progress !== undefined && item.status === 'downloading' && (
                        <span>({Math.round(item.progress)}%)</span>
                      )}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      {item.resultFilePath && (
                        <>
                          <Button
                            variant="icon"
                            size="sm"
                            onClick={() => openDownloadedFile(item.resultFilePath!)}
                            title="Play"
                            icon={<Play size={14} />}
                          />
                          <Button
                            variant="icon"
                            size="sm"
                            onClick={() => showInFolder(item.resultFilePath!)}
                            title="Show in Folder"
                            icon={<FolderOpen size={14} />}
                          />
                          <Button
                            variant="icon"
                            size="sm"
                            style={{ color: 'var(--accent-primary)' }}
                            onClick={() => onSendToTagEditor([item.resultFilePath!])}
                            title="Open in Tag Editor"
                            icon={<ArrowRight size={14} />}
                          />
                        </>
                      )}
                      <Button
                        variant="icon"
                        size="sm"
                        onClick={() => handleCopyLink(item.url, item.id)}
                        title={copiedId === item.id ? 'Copied URL!' : 'Copy source link'}
                        icon={copiedId === item.id ? <Check size={14} style={{ color: 'var(--color-success, #22c55e)' }} /> : <Copy size={14} />}
                      />
                      <Button
                        variant="icon"
                        size="sm"
                        onClick={() => onRemoveItem(item.id)}
                        disabled={item.status === 'downloading'}
                        title="Remove from queue"
                        icon={<Trash2 size={14} />}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
