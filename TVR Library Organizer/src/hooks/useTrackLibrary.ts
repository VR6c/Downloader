import { useState, useCallback, useMemo, useDeferredValue, useRef } from 'react';
import { TrackItem, ViewPreset, CleanRuleConfig } from '../types';
import { DEFAULT_CLEAN_CONFIG, cleanRawFilename, cleanUpTrackFields } from '../engine/cleaner';
import {
  DEFAULT_TEMPLATE_PATTERN,
  formatFileName,
  formatTrackTitle,
  resolveBatchCollisions,
} from '../engine/templateEngine';

/**
 * Pure helper function to apply field updates to a single track,
 * keeping Title, Artist, and Filename in sync with template rules.
 */
export function applyTrackUpdates(
  track: TrackItem,
  updates: Partial<TrackItem>,
  activeTemplate: string
): TrackItem {
  const shouldResetCustom = updates.cleanArtist !== undefined || updates.mixVersion !== undefined;
  const isCustom = updates.targetFileName !== undefined
    ? true
    : shouldResetCustom
    ? false
    : track.customTargetFileName;

  const merged: TrackItem = { ...track, ...updates, customTargetFileName: isCustom };

  // 1. If File Name was updated directly, keep Title synced to File Name (strip extension)
  if (updates.targetFileName !== undefined) {
    const nameWithoutExt = updates.targetFileName.replace(/\.[a-zA-Z0-9]+$/, '').trim();
    merged.targetFileName = nameWithoutExt;
    if (updates.cleanTitle === undefined) {
      merged.cleanTitle = nameWithoutExt;
      if (nameWithoutExt.includes(' - ') && updates.cleanArtist === undefined) {
        const parsedProducer = nameWithoutExt.split(' - ')[0].trim();
        if (parsedProducer) {
          merged.cleanArtist = parsedProducer;
        }
      }
    }
  }
  // 2. If Producer or mixVersion was updated, re-format Title via Rename Template
  else if (shouldResetCustom && updates.cleanTitle === undefined) {
    merged.cleanTitle = formatTrackTitle(merged, activeTemplate);
  }

  return merged;
}

/**
 * Recompute target filenames for all tracks based on the active template and resolve batch collisions
 */
export function computeTargetFileNames(trackList: TrackItem[], template: string): TrackItem[] {
  // 1. Calculate raw target names
  const withTargets = trackList.map((t) => ({
    ...t,
    targetFileName: t.customTargetFileName && t.targetFileName
      ? t.targetFileName.replace(/\.[a-zA-Z0-9]+$/, '').trim()
      : formatFileName(t, template),
  }));

  // 2. Resolve batch collisions
  const resolvedMap = resolveBatchCollisions(
    withTargets.map((t) => ({
      id: t.id,
      targetFileName: t.targetFileName!,
      originalFileName: t.originalFileName,
    }))
  );

  return withTargets.map((t) => ({
    ...t,
    targetFileName: resolvedMap.get(t.id) || t.targetFileName,
  }));
}

export function useTrackLibrary(onShowToast?: (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => void) {
  // Library tracks state
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [activePreset, setActivePreset] = useState<ViewPreset>('id3');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all');

  // Cleaner configuration & Filename template
  const [cleanConfig, setCleanConfig] = useState<CleanRuleConfig>(() => {
    try {
      const saved = localStorage.getItem('tvr_clean_config');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_CLEAN_CONFIG;
  });

  const [activeTemplate, setActiveTemplate] = useState<string>(() => {
    try {
      return (
        localStorage.getItem('tvr_default_template') ||
        localStorage.getItem('tvr_active_template') ||
        DEFAULT_TEMPLATE_PATTERN
      );
    } catch {
      return DEFAULT_TEMPLATE_PATTERN;
    }
  });


  // Stable references for callbacks to avoid unnecessary re-creation
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const selectedTrackIdsRef = useRef(selectedTrackIds);
  selectedTrackIdsRef.current = selectedTrackIds;

  // Optimized single track update: updates only the affected track in place
  // Preserves object references (t === t) for all other tracks so React.memo skips re-rendering them
  const updateTrack = useCallback(
    (id: string, updates: Partial<TrackItem>) => {
      setTracks((prev) => {
        const index = prev.findIndex((t) => t.id === id);
        if (index === -1) return prev;
        const current = prev[index];
        const updated = applyTrackUpdates(current, updates, activeTemplate);
        if (!updated.customTargetFileName) {
          updated.targetFileName = formatFileName(updated, activeTemplate);
        }

        // Fast collision resolution against existing tracks
        const candidateBase = (updated.targetFileName || updated.originalFileName || '')
          .replace(/\.[a-zA-Z0-9]+$/, '')
          .trim();
        const candidateLower = candidateBase.toLowerCase();
        let collisionCount = 0;
        for (let i = 0; i < prev.length; i++) {
          if (i !== index) {
            const otherBase = (prev[i].targetFileName || prev[i].originalFileName || '')
              .replace(/\.[a-zA-Z0-9]+$/, '')
              .trim()
              .toLowerCase();
            if (otherBase === candidateLower) {
              collisionCount++;
            }
          }
        }
        if (collisionCount > 0) {
          updated.targetFileName = `${candidateBase} (${collisionCount + 1})`;
        }

        const next = [...prev];
        next[index] = updated;
        return next;
      });
    },
    [activeTemplate]
  );

  // Batch update multiple tracks by IDs
  const batchUpdateTracksByIds = useCallback(
    (ids: string[], updates: Partial<TrackItem>, toastMessage?: string) => {
      const idSet = new Set(ids);
      setTracks((prev) => {
        let changed = false;
        const next = prev.map((t) => {
          if (idSet.has(t.id)) {
            changed = true;
            return applyTrackUpdates(t, updates, activeTemplate);
          }
          return t;
        });
        if (!changed) return prev;
        return computeTargetFileNames(next, activeTemplate);
      });
      if (toastMessage && onShowToast) {
        onShowToast('success', 'Batch Edit Applied', toastMessage);
      }
    },
    [activeTemplate, onShowToast]
  );

  // Batch update full list
  const batchUpdateTracks = useCallback(
    (updatedList: TrackItem[]) => {
      setTracks(computeTargetFileNames(updatedList, activeTemplate));
    },
    [activeTemplate]
  );

  // Ingest new tracks
  const appendTracks = useCallback(
    (newTracks: TrackItem[]) => {
      if (!newTracks.length) return;
      const cleanedNewTracks = newTracks.map(cleanUpTrackFields);
      setTracks((prev) => {
        const merged = [...prev, ...cleanedNewTracks];
        return computeTargetFileNames(merged, activeTemplate);
      });
      if (onShowToast) {
        onShowToast('success', 'Tracks Ingested', `Loaded ${newTracks.length} audio files with clean fields.`);
      }
    },
    [activeTemplate, onShowToast]
  );

  // Set library directly
  const loadLibraryTracks = useCallback(
    (newTracks: TrackItem[]) => {
      setTracks(computeTargetFileNames(newTracks, activeTemplate));
    },
    [activeTemplate]
  );

  // Automated Cleaner Engine (FR-2) - functional update without tracks dependency
  const autoCleanAll = useCallback(() => {
    let cleanedCount = 0;
    setTracks((prev) => {
      if (prev.length === 0) return prev;
      const cleanedTracks = prev.map((track) => {
        const result = cleanRawFilename(track.originalFileName, cleanConfig);
        cleanedCount++;
        const rawCleaned: TrackItem = {
          ...track,
          cleanArtist: result.artist,
          cleanTitle: result.title,
          mixVersion: result.mixVersion,
          bpm: track.bpm || result.bpmPrefix || null,
          customTargetFileName: false,
        };
        const templatedTitle = formatTrackTitle(rawCleaned, activeTemplate);
        return {
          ...rawCleaned,
          cleanTitle: templatedTitle,
        };
      });
      return computeTargetFileNames(cleanedTracks, activeTemplate);
    });
    return cleanedCount;
  }, [cleanConfig, activeTemplate]);

  // Clean all fields except technical metadata - functional update without tracks dependency
  const cleanAllFields = useCallback(() => {
    let count = 0;
    const selected = selectedTrackIdsRef.current;
    setTracks((prev) => {
      if (prev.length === 0) return prev;
      const targetIds = selected.length > 0 ? new Set(selected) : new Set(prev.map((t) => t.id));
      const updated = prev.map((track) => {
        if (!targetIds.has(track.id)) return track;
        count++;
        return cleanUpTrackFields(track);
      });
      return computeTargetFileNames(updated, activeTemplate);
    });
    return count;
  }, [activeTemplate]);

  // Sync: Set FileName(Rename Template) To Title - functional update without tracks dependency
  const syncNameAndTitle = useCallback(() => {
    let count = 0;
    const selected = selectedTrackIdsRef.current;
    setTracks((prev) => {
      if (prev.length === 0) return prev;
      const targetIds = selected.length > 0 ? new Set(selected) : new Set(prev.map((t) => t.id));
      const updated = prev.map((track) => {
        if (!targetIds.has(track.id)) return track;
        count++;

        const originalBaseName = (track.originalFileName || '').replace(/\.[a-zA-Z0-9]+$/, '').trim();
        let producer = track.cleanArtist?.trim() || '';
        if (!producer && originalBaseName.includes(' - ')) {
          producer = originalBaseName.split(' - ')[0].trim();
        }

        let songTitle = track.cleanTitle?.trim() || '';
        if (!songTitle) {
          if (originalBaseName.includes(' - ')) {
            songTitle = originalBaseName.split(' - ').slice(1).join(' - ').trim();
          } else {
            songTitle = originalBaseName || 'Untitled Track';
          }
        }

        if (producer && songTitle.toLowerCase().startsWith(producer.toLowerCase())) {
          const stripped = songTitle.slice(producer.length).replace(/^[\s–—-]+/, '').trim();
          if (stripped) {
            songTitle = stripped;
          }
        }

        const trackForTemplate: Partial<TrackItem> = {
          ...track,
          cleanArtist: producer,
          cleanTitle: songTitle,
        };

        const generatedFileName = formatFileName(trackForTemplate, activeTemplate);
        const templateTitle = generatedFileName.replace(/\.[a-zA-Z0-9]+$/, '').trim();

        return {
          ...track,
          cleanArtist: producer || track.cleanArtist,
          cleanTitle: templateTitle,
          targetFileName: templateTitle,
          customTargetFileName: true,
        };
      });

      return computeTargetFileNames(updated, activeTemplate);
    });
    return count;
  }, [activeTemplate]);

  // Update Template across library
  const updateTemplate = useCallback(
    (tmpl: string) => {
      setActiveTemplate(tmpl);
      try {
        localStorage.setItem('tvr_active_template', tmpl);
      } catch {
        // ignore
      }
      setTracks((prev) => {
        const updated = prev.map((t) => ({
          ...t,
          cleanTitle: formatTrackTitle(t, tmpl),
          customTargetFileName: false,
        }));
        return computeTargetFileNames(updated, tmpl);
      });
    },
    []
  );

  // Set Default Template
  const setDefaultTemplate = useCallback(
    (tmpl: string) => {
      try {
        localStorage.setItem('tvr_default_template', tmpl);
        localStorage.setItem('tvr_active_template', tmpl);
      } catch {
        // ignore
      }
      updateTemplate(tmpl);
    },
    [updateTemplate]
  );

  // Save clean config
  const updateCleanConfig = useCallback((newConfig: CleanRuleConfig) => {
    setCleanConfig(newConfig);
    try {
      localStorage.setItem('tvr_clean_config', JSON.stringify(newConfig));
    } catch {
      // ignore
    }
  }, []);

  // Clipboard Paste Data
  const pasteData = useCallback(
    (clipboardText: string, targetRowIndex: number, targetColKey: string) => {
      const lines = clipboardText.trim().split(/\r?\n/);
      if (!lines.length) return;

      setTracks((prev) => {
        const next = [...prev];
        lines.forEach((line, lineOffset) => {
          const rowIndex = targetRowIndex + lineOffset;
          if (rowIndex < next.length) {
            const cells = line.split('\t');
            const currentTrack = { ...next[rowIndex] };

            if (cells.length === 1) {
              const trimmedVal = cells[0].trim();
              (currentTrack as any)[targetColKey] = trimmedVal;
              if (targetColKey === 'targetFileName') {
                const nameWithoutExt = trimmedVal.replace(/\.[a-zA-Z0-9]+$/, '').trim();
                currentTrack.targetFileName = nameWithoutExt;
                currentTrack.cleanTitle = nameWithoutExt;
                currentTrack.customTargetFileName = true;
                if (nameWithoutExt.includes(' - ')) {
                  const parsedProducer = nameWithoutExt.split(' - ')[0].trim();
                  if (parsedProducer) {
                    currentTrack.cleanArtist = parsedProducer;
                  }
                }
              }
            } else {
              if (cells[0] !== undefined) currentTrack.cleanTitle = cells[0].trim();
              if (cells[1] !== undefined) currentTrack.cleanArtist = cells[1].trim();
              if (cells[2] !== undefined) currentTrack.mixVersion = cells[2].trim();
              if (cells[3] !== undefined) {
                const bpmNum = parseFloat(cells[3]);
                if (!isNaN(bpmNum)) currentTrack.bpm = Math.round(bpmNum);
              }
              if (cells[4] !== undefined) currentTrack.camelotKey = cells[4].trim();
              if (cells[5] !== undefined) currentTrack.genre = cells[5].trim();
            }

            next[rowIndex] = currentTrack;
          }
        });

        return computeTargetFileNames(next, activeTemplate);
      });
    },
    [activeTemplate]
  );

  // Copy selected to clipboard TSV - stable reference
  const copySelected = useCallback(() => {
    const currentTracks = tracksRef.current;
    const selectedIds = selectedTrackIdsRef.current;
    const selected = currentTracks.filter((t: TrackItem) => selectedIds.includes(t.id));
    const targetTracks = selected.length > 0 ? selected : currentTracks;

    const tsvRows = targetTracks.map((t: TrackItem) =>
      [t.cleanTitle, t.cleanArtist, t.mixVersion, t.bpm ?? '', t.camelotKey ?? '', t.genre, t.rating].join('\t')
    );

    const header = ['Title', 'Producer', 'Mix', 'BPM', 'Camelot Key', 'Genre', 'Rating'].join('\t');
    const fullTsv = [header, ...tsvRows].join('\n');

    return navigator.clipboard.writeText(fullTsv).then(() => targetTracks.length);
  }, []);

  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Memoized Filter & Search with fast-path short-circuits
  const filteredTracks = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    const hasSearch = q.length > 0;
    const isAll = filterMode === 'all';

    // Fast-path: if viewing all tracks and no search query, return tracks directly without allocating array
    if (isAll && !hasSearch) {
      return tracks;
    }

    const isNeedsAnalysis = filterMode === 'needs-analysis';
    const isAnalyzed = filterMode === 'analyzed';
    const isQualityWarnings = filterMode === 'quality-warnings';
    const isErrors = filterMode === 'errors';
    const isKeyFilter = filterMode.startsWith('key:');
    const targetKey = isKeyFilter ? filterMode.replace('key:', '') : '';

    return tracks.filter((track) => {
      // 1. Cheap filter mode checks first
      if (isNeedsAnalysis && (track.bpm && track.camelotKey)) return false;
      if (isAnalyzed && (!track.bpm || !track.camelotKey)) return false;
      if (isQualityWarnings && !track.isQualityWarning) return false;
      if (isErrors && track.status !== 'error') return false;
      if (isKeyFilter && track.camelotKey !== targetKey) return false;

      // 2. Search query check with early return on first match
      if (hasSearch) {
        if (track.cleanTitle && track.cleanTitle.toLowerCase().includes(q)) return true;
        if (track.cleanArtist && track.cleanArtist.toLowerCase().includes(q)) return true;
        if (track.originalFileName && track.originalFileName.toLowerCase().includes(q)) return true;
        if (track.genre && track.genre.toLowerCase().includes(q)) return true;
        if (track.camelotKey && track.camelotKey.toLowerCase().includes(q)) return true;
        if (track.bpm && String(track.bpm).includes(q)) return true;
        return false;
      }

      return true;
    });
  }, [tracks, deferredSearchQuery, filterMode]);

  return {
    tracks,
    setTracks,
    selectedTrackIds,
    setSelectedTrackIds,
    activePreset,
    setActivePreset,
    searchQuery,
    setSearchQuery,
    filterMode,
    setFilterMode,
    cleanConfig,
    activeTemplate,
    filteredTracks,
    updateTrack,
    batchUpdateTracksByIds,
    batchUpdateTracks,
    appendTracks,
    loadLibraryTracks,
    autoCleanAll,
    cleanAllFields,
    syncNameAndTitle,
    updateTemplate,
    setDefaultTemplate,
    updateCleanConfig,
    pasteData,
    copySelected,
  };
}
