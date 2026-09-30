import React, { useState, useEffect } from 'react';
import {
  Settings,
  FolderOpen,
  Server,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Globe,
} from 'lucide-react';
import {
  selectDownloadDirectory,
  getDefaultDownloadDir,
  getApiBaseUrl,
  setApiBaseUrl,
  testBackendConnection,
  DEFAULT_BACKEND_URL,
} from '../../services/downloaderService';
import { Button } from '../ui';

interface DownloaderSettingsTabProps {
  autoClipboard: boolean;
  onToggleAutoClipboard: (val: boolean) => void;
  addToast: (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => void;
}

export const DownloaderSettingsTab: React.FC<DownloaderSettingsTabProps> = ({
  autoClipboard,
  onToggleAutoClipboard,
  addToast,
}) => {
  const [defaultDir, setDefaultDir] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [connStatus, setConnStatus] = useState<{ checked: boolean; success: boolean; message: string }>({
    checked: false,
    success: false,
    message: '',
  });

  const isElectron = typeof window !== 'undefined' && Boolean((window as any).api?.isElectron);

  useEffect(() => {
    getDefaultDownloadDir().then((d) => setDefaultDir(d));
    setApiUrl(getApiBaseUrl());

    // Auto-check current connection
    testBackendConnection().then((res) => {
      setConnStatus({ checked: true, success: res.success, message: res.message });
    });
  }, []);

  const handleSelectFolder = async () => {
    const selected = await selectDownloadDirectory(defaultDir);
    if (selected) {
      setDefaultDir(selected);
      addToast('success', 'Folder Updated', selected);
    }
  };

  const handleSaveAndTestApi = async () => {
    setIsTesting(true);
    setApiBaseUrl(apiUrl);
    const res = await testBackendConnection(apiUrl);
    setIsTesting(false);
    setConnStatus({ checked: true, success: res.success, message: res.message });
    if (res.success) {
      addToast('success', 'Backend Connected', res.message);
    } else {
      addToast('error', 'Connection Failed', res.message);
    }
  };

  const handleResetApi = async () => {
    setApiUrl(DEFAULT_BACKEND_URL);
    setApiBaseUrl(DEFAULT_BACKEND_URL);
    setIsTesting(true);
    const res = await testBackendConnection(DEFAULT_BACKEND_URL);
    setIsTesting(false);
    setConnStatus({ checked: true, success: res.success, message: res.message });
    addToast('info', 'API Reset', 'Reset to default Railway backend');
  };

  return (
    <div className="dl-settings-tab">
      {/* 1. Preferences & Integration */}
      <div className="dl-card" style={{ marginBottom: 20 }}>
        <div className="dl-input-header">
          <div className="dl-input-label">
            <Settings size={18} style={{ color: 'var(--accent-primary)' }} />
            <span>Preferences & Integration</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 12 }}>
          {/* Default Folder */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Default Download Directory
            </label>
            <div className="dl-folder-row" style={{ marginBottom: 0 }}>
              <div className="dl-folder-display">{defaultDir || 'System Downloads'}</div>
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

      {/* 2. Backend API Configuration (Web & Cloud Mode) */}
      {!isElectron && (
        <div className="dl-card">
          <div className="dl-input-header">
            <div className="dl-input-label">
              <Server size={18} style={{ color: 'var(--accent-primary)' }} />
              <span>Python Backend API Server</span>
            </div>
            {connStatus.checked && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 12,
                  backgroundColor: connStatus.success ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  color: connStatus.success ? 'var(--color-success, #22c55e)' : 'var(--color-danger, #ef4444)',
                }}
              >
                {connStatus.success ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                {connStatus.success ? 'Connected' : 'Offline / Unreachable'}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              On Vercel, the web application runs client-side. To download media via <code>yt-dlp</code> and <code>ffmpeg</code>, connect this web app to a running TVR Studio Python backend (local tunnel, Railway, Render, or VPS).
            </p>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Backend API Server URL
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="url"
                  className="dl-url-input"
                  style={{ flex: 1, padding: '8px 12px', fontSize: 13 }}
                  placeholder="e.g. https://api.yourdomain.com, https://xxx.ngrok-free.app, or leave empty for local /api"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                />
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleSaveAndTestApi}
                  disabled={isTesting}
                  icon={<RefreshCw size={14} className={isTesting ? 'spinning' : ''} />}
                >
                  {isTesting ? 'Testing...' : 'Save & Connect'}
                </Button>
                {apiUrl && (
                  <Button variant="secondary" size="md" onClick={handleResetApi} disabled={isTesting}>
                    Reset
                  </Button>
                )}
              </div>
            </div>

            {connStatus.checked && (
              <div
                style={{
                  fontSize: 12,
                  color: connStatus.success ? 'var(--color-success, #22c55e)' : 'var(--text-secondary)',
                  marginTop: 2,
                }}
              >
                {connStatus.message}
              </div>
            )}

            <div
              style={{
                fontSize: 12,
                backgroundColor: 'var(--bg-secondary, rgba(255,255,255,0.04))',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                padding: 12,
                lineHeight: 1.5,
              }}
            >
              <strong>💡 Quick Local Web Testing:</strong>
              <div style={{ marginTop: 4 }}>
                If running on your Mac, simply open <code>http://localhost:5173</code> in your browser. Vite automatically proxies all API requests directly to <code>http://127.0.0.1:8000</code> without any setup required.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
