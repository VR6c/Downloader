import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, AlertCircle, Download, RefreshCw, ExternalLink, ArrowUpCircle } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui';
import { UpdateCheckResult, platformLabel, canInstallUpdates, installUpdate } from '../services/updateService';

interface UpdateModalProps {
  currentVersion: string;
  result: UpdateCheckResult | null;
  isChecking: boolean;
  onClose: () => void;
  onCheckAgain: () => void;
  onSkipVersion: (version: string) => void;
  onDownload: (url: string) => void;
}

const formatDate = (iso?: string) => {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

export const UpdateModal: React.FC<UpdateModalProps> = ({
  currentVersion,
  result,
  isChecking,
  onClose,
  onCheckAgain,
  onSkipVersion,
  onDownload,
}) => {
  const status = isChecking ? 'checking' : result?.status ?? 'checking';
  const isAvailable = status === 'available' && result?.latestVersion;
  const target = result?.downloadUrl || result?.releaseUrl;

  const [install, setInstall] = useState<{ phase: 'idle' | 'downloading' | 'done' | 'error'; progress: number; message?: string }>({
    phase: 'idle',
    progress: 0,
  });
  const canAutoInstall = Boolean(result?.downloadUrl) && canInstallUpdates();
  const busy = install.phase === 'downloading';

  const handleInstall = async () => {
    if (!result?.downloadUrl) return;
    setInstall({ phase: 'downloading', progress: 0 });
    const outcome = await installUpdate(result.downloadUrl, (progress) => setInstall({ phase: 'downloading', progress }));
    if (!outcome.success) {
      setInstall({ phase: 'error', progress: 0, message: outcome.message });
    } else {
      // On Windows the app quits right after the installer starts; elsewhere the user finishes the install by hand
      setInstall({ phase: 'done', progress: 1, message: outcome.action });
    }
  };

  const body = (() => {
    switch (status) {
      case 'checking':
        return (
          <div className="update-state" role="status">
            <RefreshCw size={26} className="spin-animation update-state-icon" />
            <div className="update-state-title">Checking for updates…</div>
          </div>
        );
      case 'available':
        return (
          <>
            <div className="update-versions" aria-label="Version change">
              <span className="update-version-chip">v{currentVersion}</span>
              <ArrowRight size={16} aria-hidden="true" />
              <span className="update-version-chip is-new">v{result?.latestVersion}</span>
              {result?.publishedAt && <span className="update-date">Released {formatDate(result.publishedAt)}</span>}
            </div>
            {result?.notes && (
              <>
                <div className="update-notes-label">What's new</div>
                <pre className="update-notes" tabIndex={0}>
                  {result.notes}
                </pre>
              </>
            )}
            {install.phase === 'downloading' && (
              <div className="update-progress" role="status" aria-live="polite">
                <div className="update-progress-header">
                  <span className="update-notes-label" style={{ margin: 0 }}>Downloading…</span>
                  <span className="update-progress-pct">{Math.round(install.progress * 100)}%</span>
                </div>
                <div className="update-progress-track" aria-hidden="true">
                  <div className="update-progress-fill" style={{ width: `${Math.round(install.progress * 100)}%` }} />
                </div>
              </div>
            )}
            {install.phase === 'done' && (
              <p className="update-hint">
                {install.message === 'installing'
                  ? 'The installer is starting. TVR Studio will close so it can update.'
                  : install.message === 'opened'
                    ? 'Downloaded. Drag TVR Studio into Applications to finish updating.'
                    : 'Downloaded to your Downloads folder.'}
              </p>
            )}
            {install.phase === 'error' && (
              <p className="update-hint" role="alert">
                {install.message || 'The update could not be downloaded.'} You can still download it from the release page.
              </p>
            )}
            {window.api?.platform === 'darwin' && install.phase === 'idle' && (
              <p className="update-hint">
                After downloading, drag TVR Studio into Applications. macOS may ask you to approve it in System Settings →
                Privacy &amp; Security.
              </p>
            )}
          </>
        );
      case 'up-to-date':
        return (
          <div className="update-state" role="status">
            <CheckCircle2 size={30} className="update-state-icon is-ok" />
            <div className="update-state-title">You're up to date</div>
            <p>TVR Studio v{currentVersion} is the latest version.</p>
          </div>
        );
      case 'no-releases':
        return (
          <div className="update-state" role="status">
            <CheckCircle2 size={30} className="update-state-icon is-ok" />
            <div className="update-state-title">No newer version</div>
            <p>No published releases were found yet. You're running v{currentVersion}.</p>
          </div>
        );
      case 'unsupported':
        return (
          <div className="update-state" role="status">
            <ArrowUpCircle size={30} className="update-state-icon" />
            <div className="update-state-title">Updates are managed by the desktop app</div>
            <p>{result?.message || 'Update checks are available in the desktop app.'}</p>
          </div>
        );
      default:
        return (
          <div className="update-state" role="alert">
            <AlertCircle size={30} className="update-state-icon is-error" />
            <div className="update-state-title">Couldn't check for updates</div>
            <p>{result?.message || 'Something went wrong. Please try again.'}</p>
          </div>
        );
    }
  })();

  return (
    <Modal
      onClose={onClose}
      title="Software Update"
      subtitle={`TVR Studio v${currentVersion} · ${platformLabel()}`}
      icon={<ArrowUpCircle size={18} />}
      width={560}
    >
      <div className="modal-body update-body">{body}</div>
      <div className={`modal-footer${isAvailable && canAutoInstall ? ' modal-footer--update' : ''}`}>
        {isAvailable ? (
          <>
            {canAutoInstall && (
              <div className="update-footer-primary">
                <Button
                  variant="primary"
                  size="md"
                  icon={<Download size={15} />}
                  disabled={busy || install.phase === 'done'}
                  onClick={handleInstall}
                >
                  {busy ? 'Downloading…' : install.phase === 'error' ? 'Try again' : 'Update now'}
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  icon={<ExternalLink size={15} />}
                  disabled={!target || busy}
                  onClick={() => target && onDownload(target)}
                >
                  Download in browser
                </Button>
              </div>
            )}
            {!canAutoInstall && (
              <Button
                variant="primary"
                size="md"
                icon={result?.downloadUrl ? <Download size={15} /> : <ExternalLink size={15} />}
                disabled={!target || busy}
                onClick={() => target && onDownload(target)}
              >
                {result?.downloadUrl ? 'Download in browser' : 'View release'}
              </Button>
            )}
            <div className="update-footer-secondary">
              <button type="button" className="btn-secondary" disabled={busy} onClick={onClose}>
                Later
              </button>
              <button type="button" className="btn-link update-skip" disabled={busy} onClick={() => onSkipVersion(result!.latestVersion!)}>
                Skip this version
              </button>
            </div>
          </>
        ) : (
          <>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Close
            </button>
            {status !== 'checking' && status !== 'unsupported' && (
              <Button variant="primary" size="md" icon={<RefreshCw size={15} />} onClick={onCheckAgain}>
                Check again
              </Button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};
