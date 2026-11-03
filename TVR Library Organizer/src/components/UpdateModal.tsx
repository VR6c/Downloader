import React from 'react';
import { ArrowRight, CheckCircle2, AlertCircle, Download, RefreshCw, ExternalLink, ArrowUpCircle } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui';
import { UpdateCheckResult, platformLabel } from '../services/updateService';

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
            {window.api?.platform === 'darwin' && (
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
      width={520}
    >
      <div className="modal-body update-body">{body}</div>
      <div className="modal-footer">
        {isAvailable ? (
          <>
            <button type="button" className="btn-secondary update-skip" onClick={() => onSkipVersion(result!.latestVersion!)}>
              Skip this version
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Later
            </button>
            <Button
              variant="primary"
              size="md"
              icon={result?.downloadUrl ? <Download size={15} /> : <ExternalLink size={15} />}
              disabled={!target}
              onClick={() => target && onDownload(target)}
            >
              {result?.downloadUrl ? 'Download' : 'View release'}
            </Button>
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
