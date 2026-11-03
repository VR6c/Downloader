import React, { useState, useEffect } from 'react';
import { AddToast } from '../../types';
import {
  Settings,
  FolderOpen,
} from 'lucide-react';
import {
  selectDownloadDirectory,
  getDefaultDownloadDir,
  setDefaultDownloadDir,
} from '../../services/downloaderService';
import { Button } from '../ui';

interface DownloaderSettingsTabProps {
  autoClipboard: boolean;
  onToggleAutoClipboard: (val: boolean) => void;
  addToast: AddToast;
}

export const DownloaderSettingsTab: React.FC<DownloaderSettingsTabProps> = ({
  autoClipboard,
  onToggleAutoClipboard,
  addToast,
}) => {
  const [defaultDir, setDefaultDir] = useState('');

  useEffect(() => {
    getDefaultDownloadDir().then((d) => setDefaultDir(d));
  }, []);

  const handleSelectFolder = async () => {
    const selected = await selectDownloadDirectory(defaultDir);
    if (selected) {
      setDefaultDir(selected);
      setDefaultDownloadDir(selected);
      addToast('success', 'Folder Updated', selected);
    }
  };

  return (
    <div className="dl-settings-tab">
      {/* Preferences & Integration */}
      <div className="dl-card">
        <div className="dl-input-header">
          <div className="dl-input-label">
            <Settings size={18} style={{ color: 'var(--accent-primary)' }} />
            <span>Preferences & Integration</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 12 }}>
          {/* Default Folder */}
          <div>
            <div id="dl-default-dir-label" style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Default Download Directory
            </div>
            <div className="dl-folder-row" style={{ marginBottom: 0 }}>
              <div className="dl-folder-display" aria-labelledby="dl-default-dir-label">{defaultDir || 'System Downloads'}</div>
              <Button
                variant="secondary"
                size="md"
                onClick={handleSelectFolder}
                icon={<FolderOpen size={14} />}
              >
                Change Folder...
              </Button>
            </div>
          </div>

          {/* Auto Clipboard */}
          <div>
            <label className="dl-checkbox-label">
              <input
                type="checkbox"
                checked={autoClipboard}
                onChange={(e) => onToggleAutoClipboard(e.target.checked)}
              />
              <span>
                <strong>Auto-detect YouTube / SoundCloud links from clipboard</strong> (Automatically fills URL when copied)
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
