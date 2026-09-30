import { normalizeCamelotKey } from './camelot';

export interface DspAnalysisResult {
  bpm: number;
  camelotKey: string;
  standardKey: string;
  duration: number;
  sampleRate: number;
  confidence: number;
}

// 12 Pitch Classes
const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Krumhansl-Schmuckler key profiles for Major and Minor
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/**
 * Calculates Pearson correlation coefficient between two arrays
 */
function correlate(a: number[], b: number[]): number {
  const n = a.length;
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
  }
  const meanA = sumA / n;
  const meanB = sumB / n;

  let numerator = 0;
  let denomA = 0;
  let denomB = 0;
  for (let i = 0; i < n; i++) {
    const diffA = a[i] - meanA;
    const diffB = b[i] - meanB;
    numerator += diffA * diffB;
    denomA += diffA * diffA;
    denomB += diffB * diffB;
  }

  const denom = Math.sqrt(denomA * denomB);
  return denom === 0 ? 0 : numerator / denom;
}

/**
 * Fast Web Audio DSP worker analyzing BPM and Key from an AudioBuffer
 */
export async function analyzeAudioBuffer(
  audioBuffer: AudioBuffer,
  onProgress?: (percent: number) => void
): Promise<DspAnalysisResult> {
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration;

  // 1. Downmix to mono channel
  const channelData = audioBuffer.getChannelData(0);
  const length = channelData.length;

  onProgress?.(15);

  // 2. Sample a representative 30-60 second section (avoiding long silent intros/outros)
  const sampleDuration = Math.min(45, duration);
  const startOffset = duration > 60 ? Math.floor(sampleRate * 20) : 0;
  const sampleLength = Math.min(Math.floor(sampleRate * sampleDuration), length - startOffset);

  // 3. Tempo (BPM) Detection via Energy Envelope & Autocorrelation
  const bpm = await estimateBpm(channelData, startOffset, sampleLength, sampleRate);
  onProgress?.(55);

  // 4. Harmonic Key Detection via Chromagram and Krumhansl-Schmuckler profiles
  const keyInfo = await estimateKey(channelData, startOffset, sampleLength, sampleRate);
  onProgress?.(95);

  return {
    bpm: Math.round(bpm),
    camelotKey: keyInfo.camelotKey,
    standardKey: keyInfo.standardKey,
    duration: Math.round(duration),
    sampleRate: sampleRate,
    confidence: keyInfo.confidence,
  };
}

/**
 * Onset energy envelope and peak autocorrelation BPM estimator
 */
async function estimateBpm(
  data: Float32Array,
  start: number,
  len: number,
  sampleRate: number
): Promise<number> {
  // Subsample to ~2000 Hz for fast envelope calculation
  const downsampleRatio = Math.max(1, Math.floor(sampleRate / 2000));
  const subLen = Math.floor(len / downsampleRatio);
  const envelope = new Float32Array(subLen);

  for (let i = 0; i < subLen; i++) {
    const rawIdx = start + i * downsampleRatio;
    const val = data[rawIdx] || 0;
    envelope[i] = Math.abs(val);
  }

  // Smooth envelope with low-pass moving average
  const smoothed = new Float32Array(subLen);
  const windowSize = 25;
  let runningSum = 0;
  for (let i = 0; i < subLen; i++) {
    runningSum += envelope[i];
    if (i >= windowSize) {
      runningSum -= envelope[i - windowSize];
      smoothed[i] = runningSum / windowSize;
    } else {
      smoothed[i] = runningSum / (i + 1);
    }
  }

  // Find intervals corresponding to 65 - 175 BPM
  const effectiveSampleRate = sampleRate / downsampleRatio;
  const minInterval = Math.floor((60 / 175) * effectiveSampleRate);
  const maxInterval = Math.floor((60 / 65) * effectiveSampleRate);

  let bestLag = minInterval;
  let maxCorr = -1;

  // Coarse autocorrelation pass
  for (let lag = minInterval; lag <= maxInterval; lag += 2) {
    let corr = 0;
    const count = Math.min(subLen - lag, 3000);
    for (let i = 0; i < count; i += 4) {
      corr += smoothed[i] * smoothed[i + lag];
    }
    if (corr > maxCorr) {
      maxCorr = corr;
      bestLag = lag;
    }
  }

  // Refine around best lag
  const searchMin = Math.max(minInterval, bestLag - 4);
  const searchMax = Math.min(maxInterval, bestLag + 4);
  for (let lag = searchMin; lag <= searchMax; lag++) {
    let corr = 0;
    const count = Math.min(subLen - lag, 3000);
    for (let i = 0; i < count; i += 2) {
      corr += smoothed[i] * smoothed[i + lag];
    }
    if (corr > maxCorr) {
      maxCorr = corr;
      bestLag = lag;
    }
  }

  let calculatedBpm = (60 * effectiveSampleRate) / bestLag;

  // Harmonize half/double tempo into standard DJ tempo range (115 - 175)
  if (calculatedBpm < 90) calculatedBpm *= 2;
  if (calculatedBpm > 180) calculatedBpm /= 2;

  // Default fallback if calculation is erratic
  if (isNaN(calculatedBpm) || calculatedBpm < 60 || calculatedBpm > 200) {
    calculatedBpm = 126;
  }

  return calculatedBpm;
}

/**
 * Chromagram and Harmonic Key profile matcher
 */
async function estimateKey(
  data: Float32Array,
  start: number,
  len: number,
  sampleRate: number
): Promise<{ standardKey: string; camelotKey: string; confidence: number }> {
  // Pitch Class Profile accumulator (12 semitones: C to B)
  const chroma = new Float64Array(12);

  // Fundamental frequencies for notes from A1 (55Hz) to C7 (~2093Hz)
  const noteFrequencies: { noteIndex: number; freq: number }[] = [];
  const A4 = 440.0;
  for (let midi = 33; midi <= 84; midi++) {
    const freq = A4 * Math.pow(2, (midi - 69) / 12);
    const noteIdx = (midi - 12) % 12; // 0 = C, 1 = C#, ..., 9 = A, etc.
    noteFrequencies.push({ noteIndex: noteIdx, freq });
  }

  // Goertzel algorithm / spectral energy accumulation across sample slices
  const numSlices = 20;
  const sliceSize = Math.floor(len / numSlices);

  for (let s = 0; s < numSlices; s++) {
    const sliceStart = start + s * sliceSize;
    for (const { noteIndex, freq } of noteFrequencies) {
      const k = Math.round((sliceSize * freq) / sampleRate);
      const omega = (2 * Math.PI * k) / sliceSize;
      const coeff = 2 * Math.cos(omega);

      let q1 = 0;
      let q2 = 0;
      const step = Math.max(1, Math.floor(sliceSize / 512));
      for (let i = 0; i < 512; i++) {
        const sample = data[sliceStart + i * step] || 0;
        const q0 = sample + coeff * q1 - q2;
        q2 = q1;
        q1 = q0;
      }
      const power = q1 * q1 + q2 * q2 - coeff * q1 * q2;
      chroma[noteIndex] += Math.max(0, power);
    }
  }

  // Normalize chroma
  let maxChroma = 0;
  for (let i = 0; i < 12; i++) {
    if (chroma[i] > maxChroma) maxChroma = chroma[i];
  }
  const normalizedChroma: number[] = [];
  for (let i = 0; i < 12; i++) {
    normalizedChroma.push(maxChroma > 0 ? chroma[i] / maxChroma : 0);
  }

  // Correlate normalized chroma against all 12 Major and 12 Minor keys
  let bestCorrelation = -2;
  let bestKeyName = 'A Minor';
  let bestCamelot = '8A';

  for (let root = 0; root < 12; root++) {
    // Shift profile to root note
    const shiftedMajor = new Array(12);
    const shiftedMinor = new Array(12);
    for (let i = 0; i < 12; i++) {
      shiftedMajor[(i + root) % 12] = MAJOR_PROFILE[i];
      shiftedMinor[(i + root) % 12] = MINOR_PROFILE[i];
    }

    const corrMajor = correlate(normalizedChroma, shiftedMajor);
    const corrMinor = correlate(normalizedChroma, shiftedMinor);

    if (corrMajor > bestCorrelation) {
      bestCorrelation = corrMajor;
      const rootName = PITCH_NAMES[root];
      bestKeyName = `${rootName} Major`;
      const norm = normalizeCamelotKey(bestKeyName);
      bestCamelot = norm.camelot || '8B';
    }

    if (corrMinor > bestCorrelation) {
      bestCorrelation = corrMinor;
      const rootName = PITCH_NAMES[root];
      bestKeyName = `${rootName} Minor`;
      const norm = normalizeCamelotKey(bestKeyName);
      bestCamelot = norm.camelot || '8A';
    }
  }

  return {
    standardKey: bestKeyName,
    camelotKey: bestCamelot,
    confidence: Math.max(0.5, Math.min(0.99, (bestCorrelation + 1) / 2)),
  };
}
