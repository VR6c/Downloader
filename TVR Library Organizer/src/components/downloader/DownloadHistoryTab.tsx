import React, { useState, useMemo } from 'react';
import {
  History,
  Play,
  FolderOpen,
  Trash2,
  ArrowRight,
  Layers,
  Music,
} from 'lucide-react';
import { DownloadHistoryItem } from '../../types/downloader';
import {
  openDownloadedFile,
  showInFolder,
} from '../../services/downloaderService';
import { SearchBar, Button, Badge } from '../ui';

interface DownloadHistoryTabProps {
  history: DownloadHistoryItem[];
  onRemoveHistoryItem: (id: string) => void;
  onClearHistory: () => void;
  onSendToTagEditor: (filePaths: string[]) => void;
}

export const DownloadHistoryTab: React.FC<DownloadHistoryTabProps> = ({
  history,
  onRemoveHistoryItem,
  onClearHistory,
  onSendToTagEditor,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredHistory = useMemo(() => {
    if (!searchTerm.trim()) return history;
    const term = searchTerm.toLowerCase();
    return history.filter(
      (item) =>
        item.title.toLowerCase().includes(term) ||
        item.author.toLowerCase().includes(term) ||
        item.fileName.toLowerCase().includes(term)
    );
  }, [history, searchTerm]);

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
            placeholder="Search history by title, artist, or file name..."
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
                <th>Track Title & Artist</th>
                <th style={{ width: 110 }}>Format</th>
                <th style={{ width: 100 }}>Size</th>
                <th style={{ width: 130 }}>Date</th>
                <th style={{ width: 180, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map((item) => (
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
                    <div style={{ fontWeight: 600 }}>{item.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {item.author} • {item.fileName}
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
                    {item.fileSizeStr || (item.fileSize ? `${Math.round(item.fileSize / 1024 / 1024)} MB` : '--')}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {new Date(item.timestamp).toLocaleDateString()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
