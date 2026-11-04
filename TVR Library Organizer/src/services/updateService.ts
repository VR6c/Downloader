export type UpdateStatus = 'available' | 'up-to-date' | 'no-releases' | 'error' | 'unsupported';

export interface UpdateCheckResult {
  status: UpdateStatus;
  currentVersion: string;
  latestVersion?: string;
  /** The release page on GitHub. */
  releaseUrl?: string;
  /** Direct link to the installer for this OS / chip, when the release has one. */
  downloadUrl?: string;
  notes?: string;
  publishedAt?: string;
  message?: string;
}

/** package.json "version", baked in at build time. Available in the web build too. */
export const APP_VERSION: string = __APP_VERSION__;

/** Update checks need the desktop shell (main-process network access); the web build can't do them. */
export const canCheckForUpdates = (): boolean => typeof window !== 'undefined' && Boolean(window.tvr?.checkForUpdates);

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  if (!canCheckForUpdates()) {
    return { status: 'unsupported', currentVersion: APP_VERSION, message: 'Update checks are available in the desktop app.' };
  }
  try {
    return await window.tvr!.checkForUpdates();
  } catch (err) {
    return {
      status: 'error',
      currentVersion: APP_VERSION,
      message: err instanceof Error ? err.message : 'The update check failed.',
    };
  }
}

export const platformLabel = (): string => {
  const platform = window.api?.platform;
  return platform === 'darwin' ? 'macOS' : platform === 'win32' ? 'Windows' : platform === 'linux' ? 'Linux' : 'Web';
};

export const canInstallUpdates = (): boolean => typeof window !== 'undefined' && Boolean(window.tvr?.installUpdate);

/** Downloads the installer and hands it to the OS. Reports download progress as a 0-1 fraction. */
export async function installUpdate(
  url: string,
  onProgress: (fraction: number) => void
): Promise<{ success: boolean; action?: 'installing' | 'opened' | 'revealed'; message?: string }> {
  if (!canInstallUpdates()) return { success: false, message: 'Automatic updates need the desktop app.' };
  const stop = window.tvr!.onUpdateProgress(({ received, total }) => onProgress(total > 0 ? received / total : 0));
  try {
    return await window.tvr!.installUpdate(url);
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'The update failed.' };
  } finally {
    stop();
  }
}
