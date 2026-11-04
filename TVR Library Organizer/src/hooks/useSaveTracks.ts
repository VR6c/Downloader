import { useCallback } from 'react';
import { TrackItem, AddToast, BatchProcessRequest } from '../types';
import { executeBatchProcess } from '../services/apiBridge';
import { fireConfetti } from '../utils/confetti';

type SetTracks = React.Dispatch<React.SetStateAction<TrackItem[]>>;

const stripExtension = (name: string) => name.replace(/\.[a-zA-Z0-9]+$/, '').trim();
const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

export function buildBatchRequest(tracks: TrackItem[]): BatchProcessRequest {
  return {
    tracks: tracks.map((t) => {
      const ext = t.filePath.includes('.') ? '.' + t.filePath.split('.').pop() : '';
      const base = stripExtension(t.targetFileName || t.originalFileName || '');
      return {
        id: t.id,
        filePath: t.filePath,
        newArtist: t.cleanArtist,
        newTitle: t.cleanTitle,
        newMix: t.mixVersion,
        album: t.album,
        genre: t.genre,
        year: t.year,
        albumArtist: t.albumArtist,
        trackNumber: t.trackNumber,
        tracksTotal: t.tracksTotal,
        comments: t.comments,
        // Untouched artwork is only a thumbnail in memory: the main process keeps the file's original image
        artworkUrl: t.artworkEdited ? t.artworkUrl : undefined,
        artworkMode: (t.artworkEdited ? (t.artworkUrl ? 'replace' : 'remove') : 'keep') as 'keep' | 'replace' | 'remove',
        bpm: t.bpm || undefined,
        camelotKey: t.camelotKey || undefined,
        targetFileName: ext ? `${base}${ext}` : base,
      };
    }),
  };
}

/** Writes ID3 tags and renames files on disk, then syncs the results back into library state. */
export function useSaveTracks(tracks: TrackItem[], selectedIds: string[], setTracks: SetTracks, addToast: AddToast) {
  const save = useCallback(
    async (targets: TrackItem[], selectedOnly: boolean) => {
      if (targets.length === 0) return;

      addToast(
        'info',
        'Serializing Tags & Renaming',
        selectedOnly
          ? `Writing Rekordbox ID3v2.3 tags and renaming ${plural(targets.length, 'selected file')} on disk in-place...`
          : 'Writing Rekordbox ID3v2.3 tags and renaming files on disk in-place...'
      );

      try {
        const result = await executeBatchProcess(buildBatchRequest(targets));
        const byId = new Map((result.results ?? []).map((r) => [r.id, r]));

        setTracks((prev) =>
          prev.map((t) => {
            const res = byId.get(t.id);
            if (!res) return t;
            const fileName = res.newFilePath.split(/[/\\]/).pop() || t.originalFileName;
            return {
              ...t,
              status: res.status,
              filePath: res.newFilePath,
              originalFileName: fileName,
              targetFileName: stripExtension(fileName),
              errorMessage: res.error,
              artworkEdited: res.status === 'saved' ? false : t.artworkEdited,
            };
          })
        );

        if (result.errorCount > 0) {
          addToast(
            'error',
            selectedOnly ? 'Save Selected Completed with Errors' : 'Batch Rename Completed with Errors',
            `Successfully saved ${result.successCount} files. ${result.errorCount} files failed (highlighted in red).`
          );
        } else {
          fireConfetti();
          addToast(
            'success',
            selectedOnly ? 'Selected Files Saved & Renamed' : 'All Files Saved & Renamed',
            `Successfully wrote ID3v2.3 tags and renamed ${
              selectedOnly ? plural(result.successCount, 'selected file') : `${result.successCount} files`
            } in-place.`
          );
        }
      } catch (err) {
        addToast('error', 'Execution Error', err instanceof Error ? err.message : String(err));
      }
    },
    [setTracks, addToast]
  );

  const saveAll = useCallback(() => save(tracks, false), [tracks, save]);

  const saveSelected = useCallback(async () => {
    if (tracks.length === 0) return;
    const targets = tracks.filter((t) => selectedIds.includes(t.id));
    if (targets.length === 0) {
      addToast('warning', 'No Tracks Selected', 'Please select at least one track to save.');
      return;
    }
    await save(targets, true);
  }, [tracks, selectedIds, save, addToast]);

  return { saveAll, saveSelected };
}
