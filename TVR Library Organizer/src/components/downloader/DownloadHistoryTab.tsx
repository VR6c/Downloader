import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  Play,
  FolderOpen,
  Trash2,
  ArrowRight,
  Layers,
  Music,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import { DownloadHistoryItem } from '../../types/downloader';
import {
  openDownloadedFile,
  showInFolder,
  openExternalUrl,
  getFileSize,
  formatBytes,
  saveStoredHistory,
} from '../../services/downloaderService';
import { SearchBar, Button, Badge } from '../ui';

interface DownloadHistoryTabProps {
  history: DownloadHistoryItem[];
  onRemoveHistoryItem: (id: string) => void;
  onClearHistory: () => void;
  onSendToTagEditor: (filePaths: string[]) => void;
  onUpdateHistory?: (updatedHistory: DownloadHistoryItem[]) => void;
  addToast?: (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => void;
}

export const DownloadHistoryTab: React.FC<DownloadHistoryTabProps> = ({
  history,
  onRemoveHistoryItem,
  onClearHistory,
  onSendToTagEditor,
  onUpdateHistory,
  addToast,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Auto-backfill file sizes for existing history items missing sizes
  useEffect(() => {
    const missing = history.filter(
      (item) => (!item.fileSizeStr || item.fileSizeStr === '--' || !item.fileSize) && item.filePath
    );
    if (!missing.length) return;

    let active = true;
    Promise.all(
      missing.map(async (item) => {
        try {
          const bytes = await getFileSize(item.filePath);
          if (bytes && bytes > 0) {
            return { id: item.id, bytes, str: formatBytes(bytes) };
          }
        } catch (_) {}
        return null;
      })
    ).then((results) => {
      if (!active) return;
      const validResults = results.filter(Boolean);
      if (validResults.length > 0) {
        const sizeMap = new Map(validResults.map((r) => [r!.id, r!]));
        const updated = history.map((item) => {
          const found = sizeMap.get(item.id);
          if (found) {
            return { ...item, fileSize: found.bytes, fileSizeStr: found.str };
          }
          return item;
        });
        saveStoredHistory(updated);
        if (onUpdateHistory) {
          onUpdateHistory(updated);
        }
      }
    });

    return () => {
      active = false;
    };
  }, [history, onUpdateHistory]);

  const filteredHistory = useMemo(() => {
    if (!searchTerm.trim()) return history;
    const term = searchTerm.toLowerCase();
    return history.filter(
      (item) =>
        item.title.toLowerCase().includes(term) ||
        item.author.toLowerCase().includes(term) ||
        item.fileName.toLowerCase().includes(term) ||
        (item.url && item.url.toLowerCase().includes(term))
    );
  }, [history, searchTerm]);

  const handleCopyLink = async (url: string, id: string) => {
    if (!url) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      if (addToast) {
        addToast('success', 'Link Copied', 'Original media URL copied to clipboard.');
      }
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleSendAll = () => {
    const paths = filteredHistory.map((h) => h.filePath);
    if (paths.length) {
      onSendToTagEditor(paths);
    }
  };

  return (
    <div className="dl-history-tab">
      {/* 1. Filter & Controls Bar */}
      <div className="dl-card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search history by title, artist, file name, or URL..."
            size="md"
            style={{ flex: 1, minWidth: 260, maxWidth: '100%' }}
          />

          <Badge variant="neutral" size="sm">
            Showing <strong>{filteredHistory.length}</strong> of {history.length} items
          </Badge>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto', flexWrap: 'wrap' }}>
            {filteredHistory.length > 0 && (
              <Button
                variant="primary"
                size="md"
                icon={<Layers size={15} />}
                onClick={handleSendAll}
                title="Load all filtered downloaded files into the Tag Editor spreadsheet"
              >
                Load All ({filteredHistory.length}) to Tag Editor
              </Button>
            )}

            {history.length > 0 && (
              <Button
                variant="secondary"
                size="md"
                icon={<Trash2 size={15} />}
                onClick={onClearHistory}
                title="Clear all download history"
              >
                Clear History
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 2. History Table */}
      {filteredHistory.length === 0 ? (
        <div className="dl-card dl-empty-state">
          <div className="dl-empty-icon">
            <History size={28} />
          </div>
          <div className="dl-empty-title">No Download History Found</div>
          <div className="dl-empty-desc">
            {searchTerm
              ? 'No items matched your search filter.'
              : 'Completed downloads from YouTube and SoundCloud will appear here.'}
          </div>
        </div>
      ) : (
        <div className="dl-table-container">
          <table className="dl-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Cover</th>
                <th>Track Title & Source</th>
                <th style={{ width: 110 }}>Format</th>
                <th style={{ width: 100 }}>Size</th>
                <th style={{ width: 120 }}>Date</th>
                <th style={{ width: 200, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map((item) => {
                const isUrlTitle = item.title?.startsWith('http://') || item.title?.startsWith('https://');
                const displayTitle = isUrlTitle && item.fileName
                  ? item.fileName.replace(/\.[^/.]+$/, '')
                  : item.title;
                const sourceUrl = item.url || (isUrlTitle ? item.title : '');
                const displaySize = item.fileSizeStr && item.fileSizeStr !== '--'
                  ? item.fileSizeStr
                  : item.fileSize
                  ? formatBytes(item.fileSize)
                  : '--';

                return (
                  <tr key={item.id}>
                    <td>
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt="" className="dl-history-thumb" />
                      ) : (
                        <div
                          className="dl-history-thumb"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Music size={16} />
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                        {displayTitle}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {item.author && item.author !== 'TVR Downloader' ? `${item.author} • ` : ''}
                          {item.fileName}
                        </span>
                        {sourceUrl && (
                          <button
                            type="button"
                            className={`dl-copy-btn ${copiedId === item.id ? 'copied' : ''}`}
                            onClick={() => handleCopyLink(sourceUrl, item.id)}
                            title="Copy link to clipboard"
                          >
                            {copiedId === item.id ? (
                              <>
                                <Check size={11} />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={11} />
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{item.format.toUpperCase()}</span>{' '}
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        ({item.quality}
                        {item.format === 'mp3' ? 'k' : 'p'})
                      </span>
                    </td>
                    <td style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                      {displaySize}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(item.timestamp).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        {sourceUrl && (
                          <>
                            <Button
                              variant="icon"
                              size="sm"
                              onClick={() => handleCopyLink(sourceUrl, item.id)}
                              title={copiedId === item.id ? 'Copied!' : 'Copy original link'}
                              icon={copiedId === item.id ? <Check size={14} style={{ color: 'var(--color-success, #22c55e)' }} /> : <Copy size={14} />}
                            />
                            <Button
                              variant="icon"
                              size="sm"
                              onClick={() => openExternalUrl(sourceUrl)}
                              title="Open original link in browser"
                              icon={<ExternalLink size={14} />}
                            />
                          </>
                        )}
                        <Button
                          variant="icon"
                          size="sm"
                          onClick={() => openDownloadedFile(item.filePath)}
                          title="Play audio/video"
                          icon={<Play size={14} />}
                        />
                        <Button
                          variant="icon"
                          size="sm"
                          onClick={() => showInFolder(item.filePath)}
                          title="Reveal in Finder / Explorer"
                          icon={<FolderOpen size={14} />}
                        />
                        <Button
                          variant="icon"
                          size="sm"
                          style={{ color: 'var(--accent-primary)', fontWeight: 600 }}
                          onClick={() => onSendToTagEditor([item.filePath])}
                          title="Load into Tag Editor"
                          icon={<ArrowRight size={14} />}
                        />
                        <Button
                          variant="icon"
                          size="sm"
                          onClick={() => onRemoveHistoryItem(item.id)}
                          title="Remove from history"
                          icon={<Trash2 size={14} />}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
