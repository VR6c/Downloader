import { TrackItem } from '../types';
import { cleanRawFilename } from '../engine/cleaner';
import { formatFileName } from '../engine/templateEngine';

export const RAW_SAMPLE_FILES: Array<{
  fileName: string;
  bitrate: number;
  sampleRate: number;
  bitDepth: number;
  duration: number;
  fileSize: number;
  fileFormat: string;
  genre: string;
  year: string;
  album: string;
  initialBpm?: number;
  initialKey?: string;
  qualityIssues?: string[];
}> = [
  {
    fileName: '128_Fisher_Losing It (VIP Bootleg)_SRBL Team_HBD Bro.mp3',
    bitrate: 320,
    sampleRate: 44100,
    bitDepth: 16,
    duration: 242,
    fileSize: 9680000,
    fileFormat: 'mp3',
    genre: 'Tech House',
    year: '2022',
    album: 'Club Weapon Vol. 1',
    initialBpm: 125,
    initialKey: '8A',
  },
  {
    fileName: 'Fred again.. - Clara (the night is dark) [Extended Mix] FamilyBoss.wav',
    bitrate: 1411,
    sampleRate: 44100,
    bitDepth: 16,
    duration: 278,
    fileSize: 49000000,
    fileFormat: 'wav',
    genre: 'Electronic / UK Garage',
    year: '2023',
    album: 'Actual Life 3',
    initialBpm: 130,
    initialKey: '11B',
  },
  {
    fileName: 'Skrillex_x_Fred_again_x_Flowdan_Rumble_(Dub_Mix)_Free_Dl.flac',
    bitrate: 980,
    sampleRate: 48000,
    bitDepth: 24,
    duration: 215,
    fileSize: 26000000,
    fileFormat: 'flac',
    genre: 'Bass / Dubstep',
    year: '2023',
    album: 'Quest For Fire',
    initialBpm: 140,
    initialKey: '4A',
  },
  {
    fileName: 'Peggy Gou - (It Goes Like) Nanana - Radio Edit_RockTheBeat.aiff',
    bitrate: 1411,
    sampleRate: 44100,
    bitDepth: 16,
    duration: 231,
    fileSize: 40500000,
    fileFormat: 'aiff',
    genre: 'Dance / Pop',
    year: '2023',
    album: 'I Hear You',
    initialBpm: 130,
    initialKey: '7B',
  },
  {
    fileName: '01. John Summit & Hayla - Where You Are [Extended Mix] 320kbps.mp3',
    bitrate: 320,
    sampleRate: 44100,
    bitDepth: 16,
    duration: 312,
    fileSize: 12480000,
    fileFormat: 'mp3',
    genre: 'Melodic House',
    year: '2023',
    album: 'Comfort In Chaos',
    initialBpm: 126,
    initialKey: '9A',
  },
  {
    fileName: 'Mau P - Drugs From Amsterdam (VIP Edit) This_is_EDM @djcity.mp3',
    bitrate: 320,
    sampleRate: 44100,
    bitDepth: 16,
    duration: 324,
    fileSize: 12960000,
    fileFormat: 'mp3',
    genre: 'Tech House',
    year: '2022',
    album: 'Repopulate Mars',
    initialBpm: 125,
    initialKey: '10A',
  },
  {
    fileName: 'Dom Dolla - Rhyme Dust feat. Clementine Douglas (Original Mix) [HQ Rip].wav',
    bitrate: 1411,
    sampleRate: 44100,
    bitDepth: 16,
    duration: 198,
    fileSize: 34900000,
    fileFormat: 'wav',
    genre: 'Tech House',
    year: '2023',
    album: 'Three Six Zero',
    initialBpm: 128,
    initialKey: '6A',
  },
  {
    fileName: '126 - Chris Lake & Aluna - Beggin (Club Mix) www.freebeats.com.mp3',
    bitrate: 320,
    sampleRate: 44100,
    bitDepth: 16,
    duration: 341,
    fileSize: 13640000,
    fileFormat: 'mp3',
    genre: 'House',
    year: '2023',
    album: 'Black Book Records',
    initialBpm: 126,
    initialKey: '2A',
  },
  {
    fileName: 'ACRAZE - Do It To It (Extended Mix) [VIP 125BPM].mp3',
    bitrate: 320,
    sampleRate: 44100,
    bitDepth: 16,
    duration: 218,
    fileSize: 8720000,
    fileFormat: 'mp3',
    genre: 'Bass House',
    year: '2021',
    album: 'Thrive Music',
    initialBpm: 125,
    initialKey: '5A',
  },
  {
    fileName: 'Disclosure - You & Me (Flume Remix) [Westend VIP Bootleg].flac',
    bitrate: 940,
    sampleRate: 44100,
    bitDepth: 16,
    duration: 285,
    fileSize: 33400000,
    fileFormat: 'flac',
    genre: 'Future Bass',
    year: '2014',
    album: 'Settle (Special Edition)',
    initialBpm: 128,
    initialKey: '8B',
  },
  {
    fileName: 'Tiësto - The Business (Extended Version) 128kbps Low Quality.mp3',
    bitrate: 128, // Quality anomaly trigger!
    sampleRate: 32000, // Non-standard sample rate!
    bitDepth: 16,
    duration: 226,
    fileSize: 3616000,
    fileFormat: 'mp3',
    genre: 'Slap House',
    year: '2020',
    album: 'Atlantic Records',
    initialBpm: 120,
    initialKey: '1A',
    qualityIssues: ['Low Bitrate (< 192 kbps)', 'Sub-standard Sample Rate (< 44.1 kHz)'],
  },
  {
    fileName: 'Bicep - Glue (Original Mix) - 44.1kHz.wav',
    bitrate: 1411,
    sampleRate: 44100,
    bitDepth: 16,
    duration: 269,
    fileSize: 47400000,
    fileFormat: 'wav',
    genre: 'Breakbeat / Ambient',
    year: '2017',
    album: 'Bicep',
    initialBpm: 130,
    initialKey: '3B',
  },
];

/**
 * Creates full TrackItem instances from the demo pool
 */
export function generateDemoTracks(): TrackItem[] {
  return RAW_SAMPLE_FILES.map((sample, idx) => {
    const cleaned = cleanRawFilename(sample.fileName);
    const id = `track-${Date.now()}-${idx + 1}`;
    const filePath = `/Users/DJs/Music/TVR Library/${sample.fileName}`;

    const track: TrackItem = {
      id,
      filePath,
      originalFileName: sample.fileName,
      cleanArtist: cleaned.artist,
      cleanTitle: cleaned.title,
      mixVersion: cleaned.mixVersion,
      album: sample.album,
      genre: sample.genre,
      year: sample.year,
      albumArtist: cleaned.artist,
      trackNumber: String(idx + 1).padStart(2, '0'),
      tracksTotal: '12',
      comments: 'Cleaned via TVR Library Organizer v2.0.0',
      tagFormat: sample.fileFormat === 'mp3' ? 'ID3v2.3.0' : sample.fileFormat === 'flac' ? 'FLAC Vorbis' : sample.fileFormat === 'wav' ? 'RIFF INFO' : 'ID3v2.3.0',
      artworkUrl: undefined,
      composer: cleaned.artist,
      isrc: `US-TVR-26-000${idx + 1}`,
      rating: 4,
      bpm: sample.initialBpm || cleaned.bpmPrefix || 126,
      camelotKey: sample.initialKey || '8A',
      standardKey: 'A Minor',
      bitrate: sample.bitrate,
      sampleRate: sample.sampleRate,
      bitDepth: sample.bitDepth,
      duration: sample.duration,
      fileSize: sample.fileSize,
      fileFormat: sample.fileFormat,
      status: 'idle',
      isQualityWarning: sample.bitrate < 192 || sample.sampleRate < 44100,
      qualityIssues: sample.qualityIssues || (sample.bitrate < 192 ? ['Low Bitrate (< 192 kbps)'] : undefined),
    };

    track.targetFileName = formatFileName(track);
    return track;
  });
}
