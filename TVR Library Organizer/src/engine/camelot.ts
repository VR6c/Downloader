import { CamelotKeyInfo } from '../types';

export const CAMELOT_COLORS: Record<number, string> = {
  1: '#00BAA5', // Teal
  2: '#00B0D8', // Cyan
  3: '#0093E9', // Sky Blue
  4: '#2D58E0', // Royal Blue
  5: '#7B3FE4', // Violet
  6: '#B828C5', // Purple-Magenta
  7: '#D82276', // Deep Pink
  8: '#E23D3D', // Crimson Red
  9: '#E96424', // Red-Orange
  10: '#ECA315', // Amber Orange
  11: '#DECD18', // Warm Yellow
  12: '#58C92C', // Vibrant Green
};

export const CAMELOT_MAP: Record<string, { musicalKey: string; mode: 'minor' | 'major'; number: number; letter: 'A' | 'B' }> = {
  // Minor (A)
  '1A': { musicalKey: 'Ab Minor', mode: 'minor', number: 1, letter: 'A' },
  '2A': { musicalKey: 'Eb Minor', mode: 'minor', number: 2, letter: 'A' },
  '3A': { musicalKey: 'Bb Minor', mode: 'minor', number: 3, letter: 'A' },
  '4A': { musicalKey: 'F Minor', mode: 'minor', number: 4, letter: 'A' },
  '5A': { musicalKey: 'C Minor', mode: 'minor', number: 5, letter: 'A' },
  '6A': { musicalKey: 'G Minor', mode: 'minor', number: 6, letter: 'A' },
  '7A': { musicalKey: 'D Minor', mode: 'minor', number: 7, letter: 'A' },
  '8A': { musicalKey: 'A Minor', mode: 'minor', number: 8, letter: 'A' },
  '9A': { musicalKey: 'E Minor', mode: 'minor', number: 9, letter: 'A' },
  '10A': { musicalKey: 'B Minor', mode: 'minor', number: 10, letter: 'A' },
  '11A': { musicalKey: 'F# Minor', mode: 'minor', number: 11, letter: 'A' },
  '12A': { musicalKey: 'C# Minor', mode: 'minor', number: 12, letter: 'A' },

  // Major (B)
  '1B': { musicalKey: 'B Major', mode: 'major', number: 1, letter: 'B' },
  '2B': { musicalKey: 'F# Major', mode: 'major', number: 2, letter: 'B' },
  '3B': { musicalKey: 'Db Major', mode: 'major', number: 3, letter: 'B' },
  '4B': { musicalKey: 'Ab Major', mode: 'major', number: 4, letter: 'B' },
  '5B': { musicalKey: 'Eb Major', mode: 'major', number: 5, letter: 'B' },
  '6B': { musicalKey: 'Bb Major', mode: 'major', number: 6, letter: 'B' },
  '7B': { musicalKey: 'F Major', mode: 'major', number: 7, letter: 'B' },
  '8B': { musicalKey: 'C Major', mode: 'major', number: 8, letter: 'B' },
  '9B': { musicalKey: 'G Major', mode: 'major', number: 9, letter: 'B' },
  '10B': { musicalKey: 'D Major', mode: 'major', number: 10, letter: 'B' },
  '11B': { musicalKey: 'A Major', mode: 'major', number: 11, letter: 'B' },
  '12B': { musicalKey: 'E Major', mode: 'major', number: 12, letter: 'B' },
};

// Aliases for musical keys mapping to Camelot
const KEY_NAME_TO_CAMELOT: Record<string, string> = {
  // Minor
  'abm': '1A', 'ab minor': '1A', 'g#m': '1A', 'g# minor': '1A',
  'ebm': '2A', 'eb minor': '2A', 'd#m': '2A', 'd# minor': '2A',
  'bbm': '3A', 'bb minor': '3A', 'a#m': '3A', 'a# minor': '3A',
  'fm': '4A', 'f minor': '4A',
  'cm': '5A', 'c minor': '5A',
  'gm': '6A', 'g minor': '6A',
  'dm': '7A', 'd minor': '7A',
  'am': '8A', 'a minor': '8A',
  'em': '9A', 'e minor': '9A',
  'bm': '10A', 'b minor': '10A',
  'f#m': '11A', 'f# minor': '11A', 'gbm': '11A', 'gb minor': '11A',
  'c#m': '12A', 'c# minor': '12A', 'dbm': '12A', 'db minor': '12A',

  // Major
  'b': '1B', 'b maj': '1B', 'b major': '1B',
  'f#': '2B', 'f# maj': '2B', 'f# major': '2B', 'gb': '2B', 'gb major': '2B',
  'db': '3B', 'db maj': '3B', 'db major': '3B', 'c#': '3B', 'c# major': '3B',
  'ab': '4B', 'ab maj': '4B', 'ab major': '4B', 'g#': '4B', 'g# major': '4B',
  'eb': '5B', 'eb maj': '5B', 'eb major': '5B', 'd#': '5B', 'd# major': '5B',
  'bb': '6B', 'bb maj': '6B', 'bb major': '6B', 'a#': '6B', 'a# major': '6B',
  'f': '7B', 'f maj': '7B', 'f major': '7B',
  'c': '8B', 'c maj': '8B', 'c major': '8B',
  'g': '9B', 'g maj': '9B', 'g major': '9B',
  'd': '10B', 'd maj': '10B', 'd major': '10B',
  'a': '11B', 'a maj': '11B', 'a major': '11B',
  'e': '12B', 'e maj': '12B', 'e major': '12B',
};

/**
 * Normalizes input key to standardized Camelot format (e.g. "8A")
 */
export function normalizeCamelotKey(input: string | null | undefined): { camelot: string | null; standard: string | null } {
  if (!input) return { camelot: null, standard: null };
  const trimmed = input.trim();
  const upper = trimmed.toUpperCase();

  // Already Camelot notation? (e.g. 8A, 11B, 08A)
  const camelotMatch = upper.match(/^(0?([1-9]|1[0-2]))\s*([AB])$/);
  if (camelotMatch) {
    const num = parseInt(camelotMatch[2], 10);
    const letter = camelotMatch[3] as 'A' | 'B';
    const code = `${num}${letter}`;
    return {
      camelot: code,
      standard: CAMELOT_MAP[code]?.musicalKey || null,
    };
  }

  // Check lookup table for musical keys
  const cleaned = trimmed.toLowerCase()
    .replace(/[—_]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/maj$/, ' major')
    .replace(/min$/, ' minor');

  const lookedUp = KEY_NAME_TO_CAMELOT[cleaned];
  if (lookedUp) {
    return {
      camelot: lookedUp,
      standard: CAMELOT_MAP[lookedUp]?.musicalKey || null,
    };
  }

  return { camelot: null, standard: trimmed };
}

/**
 * Get detailed harmonic info for a Camelot code
 */
export function getCamelotKeyInfo(camelotCode: string): CamelotKeyInfo | null {
  const normalized = normalizeCamelotKey(camelotCode).camelot;
  if (!normalized || !CAMELOT_MAP[normalized]) return null;

  const data = CAMELOT_MAP[normalized];
  const num = data.number;
  const letter = data.letter;

  const wrapNum = (n: number) => {
    let res = n % 12;
    if (res <= 0) res += 12;
    return res;
  };

  const relativeLetter = letter === 'A' ? 'B' : 'A';
  const relativeKey = `${num}${relativeLetter}`;
  const energyDown = `${wrapNum(num - 1)}${letter}`;
  const energyUp = `${wrapNum(num + 1)}${letter}`;
  const energyBoost = `${wrapNum(num + 2)}${letter}`;

  return {
    camelot: normalized,
    musicalKey: data.musicalKey,
    mode: data.mode,
    number: num,
    letter: letter,
    hexColor: CAMELOT_COLORS[num] || '#3B82F6',
    compatibleKeys: {
      sameKey: normalized,
      relativeKey,
      energyDown,
      energyUp,
      energyBoost,
    },
  };
}

/**
 * Returns harmonic compatibility score between two Camelot keys (0-100)
 */
export function getHarmonicCompatibility(keyA: string | null, keyB: string | null): { score: number; relation: string } {
  if (!keyA || !keyB) return { score: 0, relation: 'Unknown' };
  const normA = normalizeCamelotKey(keyA).camelot;
  const normB = normalizeCamelotKey(keyB).camelot;
  if (!normA || !normB) return { score: 0, relation: 'Unknown' };

  if (normA === normB) return { score: 100, relation: 'Perfect Match (Same Key)' };

  const infoA = getCamelotKeyInfo(normA);
  if (!infoA) return { score: 0, relation: 'Unknown' };

  if (normB === infoA.compatibleKeys.relativeKey) return { score: 95, relation: 'Relative Major / Minor (Smooth)' };
  if (normB === infoA.compatibleKeys.energyUp) return { score: 90, relation: 'Energy Boost (+1 Step)' };
  if (normB === infoA.compatibleKeys.energyDown) return { score: 85, relation: 'Energy Drop (-1 Step)' };
  if (normB === infoA.compatibleKeys.energyBoost) return { score: 75, relation: 'Power Boost (+2 Energy Lift)' };

  return { score: 30, relation: 'Clashing / Non-Harmonic' };
}
