import { useState, useCallback } from 'react';
import { TrackItem, AddToast } from '../types';
import { analyzeTrackDsp } from '../services/apiBridge';
import { fireConfetti } from '../utils/confetti';

type SetTracks = React.Dispatch<React.SetStateAction<TrackItem[]>>;

/** Batch BPM / Camelot-key analysis with a bounded worker pool; results are applied in a single state update. */
export function useDspAnalysis(tracks: TrackItem[], setTracks: SetTracks, addToast: AddToast) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);

  const runBatchDsp = useCallback(async () => {
    if (tracks.length === 0 || isAnalyzing) return;

    setIsAnalyzing(true);
    setProgress(0);

    const pending = tracks.filter((t) => !t.bpm || !t.camelotKey);
    const targets = pending.length > 0 ? pending : tracks;
    const total = targets.length;
    let completed = 0;
    let nextIndex = 0;

    addToast('info', 'DSP Analysis Started', `Calculating rhythmic BPM & harmonic Camelot keys across ${total} tracks.`);

    const updates = new Map<string, Partial<TrackItem>>();
    const concurrency = Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 4) - 1));

    const worker = async () => {
      while (nextIndex < total) {
        const track = targets[nextIndex++];
        try {
          const { bpm, camelotKey, standardKey, duration } = await analyzeTrackDsp(track);
          updates.set(track.id, { bpm, camelotKey, standardKey, duration, status: 'idle' });
        } catch (err) {
          console.error('DSP error on', track.cleanTitle, err);
          updates.set(track.id, { status: 'error', errorMessage: 'DSP analysis failed' });
        } finally {
          completed++;
          setProgress(Math.round((completed / total) * 100));
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));

    setTracks((prev) => prev.map((t) => (updates.has(t.id) ? { ...t, ...updates.get(t.id) } : t)));
    setIsAnalyzing(false);
    setProgress(100);
    fireConfetti();
    addToast('success', 'DSP Analysis Complete', `Successfully extracted BPM and harmonic keys for ${total} tracks.`);
  }, [tracks, isAnalyzing, setTracks, addToast]);

  return { isAnalyzing, progress, runBatchDsp };
}
