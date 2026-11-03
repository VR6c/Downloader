import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { APP_VERSION, UpdateCheckResult, canCheckForUpdates, checkForUpdates } from '../services/updateService';
import { openExternalUrl } from '../services/downloaderService';
import { UpdateModal } from '../components/UpdateModal';

const LAST_CHECK_KEY = 'tvr_update_last_check';
const LAST_RESULT_KEY = 'tvr_update_last_result';
const SKIPPED_KEY = 'tvr_update_skipped_version';
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // GitHub allows 60 anonymous requests/hour; once per 6h is plenty
const STARTUP_DELAY_MS = 4000; // never compete with the app's own startup work

const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // storage unavailable: the check simply runs again next launch
    }
  },
};

/** The last "update available" answer, so the header pill shows immediately without re-checking. */
function loadSavedResult(): UpdateCheckResult | null {
  try {
    const saved = JSON.parse(storage.get(LAST_RESULT_KEY) || 'null') as UpdateCheckResult | null;
    // Discard it once the user has updated: it was computed against an older running version
    return saved && saved.status === 'available' && saved.currentVersion === APP_VERSION ? saved : null;
  } catch {
    return null;
  }
}

interface AppUpdatesValue {
  currentVersion: string;
  result: UpdateCheckResult | null;
  isChecking: boolean;
  /** An update exists and the user hasn't chosen to skip that version. */
  hasUpdate: boolean;
  latestVersion?: string;
  /** Opens the dialog, optionally running a fresh check first (used by "Check for updates"). */
  openUpdateDialog: (options?: { check?: boolean }) => void;
}

const AppUpdatesContext = createContext<AppUpdatesValue | null>(null);

export const useAppUpdates = (): AppUpdatesValue => {
  const value = useContext(AppUpdatesContext);
  if (!value) throw new Error('useAppUpdates must be used inside <AppUpdatesProvider>');
  return value;
};

export const AppUpdatesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [result, setResult] = useState<UpdateCheckResult | null>(loadSavedResult);
  const [isChecking, setIsChecking] = useState(false);
  const [skippedVersion, setSkippedVersion] = useState(() => storage.get(SKIPPED_KEY) || '');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const checkNow = useCallback(async () => {
    setIsChecking(true);
    const next = await checkForUpdates();
    setResult(next);
    setIsChecking(false);
    // Failures are not remembered, so a flaky connection gets retried on the next launch
    if (next.status !== 'error' && next.status !== 'unsupported') {
      storage.set(LAST_CHECK_KEY, String(Date.now()));
      storage.set(LAST_RESULT_KEY, JSON.stringify(next));
    }
  }, []);

  // Quiet background check shortly after launch, at most every few hours
  useEffect(() => {
    if (!canCheckForUpdates()) return;
    if (Date.now() - (Number(storage.get(LAST_CHECK_KEY)) || 0) < CHECK_INTERVAL_MS) return;
    const timer = setTimeout(checkNow, STARTUP_DELAY_MS);
    return () => clearTimeout(timer);
  }, [checkNow]);

  const openUpdateDialog = useCallback(
    ({ check = false }: { check?: boolean } = {}) => {
      setIsDialogOpen(true);
      if (check) checkNow();
    },
    [checkNow]
  );

  const skipVersion = useCallback((version: string) => {
    storage.set(SKIPPED_KEY, version);
    setSkippedVersion(version);
    setIsDialogOpen(false);
  }, []);

  const latestVersion = result?.status === 'available' ? result.latestVersion : undefined;

  const value = useMemo<AppUpdatesValue>(
    () => ({
      currentVersion: result?.currentVersion || APP_VERSION,
      result,
      isChecking,
      hasUpdate: Boolean(latestVersion) && latestVersion !== skippedVersion,
      latestVersion,
      openUpdateDialog,
    }),
    [result, isChecking, latestVersion, skippedVersion, openUpdateDialog]
  );

  return (
    <AppUpdatesContext.Provider value={value}>
      {children}
      {isDialogOpen && (
        <UpdateModal
          currentVersion={value.currentVersion}
          result={result}
          isChecking={isChecking}
          onClose={() => setIsDialogOpen(false)}
          onCheckAgain={checkNow}
          onSkipVersion={skipVersion}
          onDownload={(url) => {
            openExternalUrl(url);
            setIsDialogOpen(false);
          }}
        />
      )}
    </AppUpdatesContext.Provider>
  );
};
