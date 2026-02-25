/**
 * Audio rendering types for WAV file detection and tracking.
 */

/** Metadata for a detected rendered WAV file. */
export interface RenderInfo {
  /** Absolute path to the WAV file. */
  path: string;
  /** Just the filename (basename). */
  filename: string;
  /** Date.now() when the file was detected. */
  timestamp: number;
  /** Source pattern name, if known. */
  patternName?: string;
  /** Source channel name, if known. */
  channelName?: string;
}

/** Configuration for the render file watcher. */
export interface WatcherConfig {
  /** Directory to watch for new WAV files. */
  directory: string;
  /** Milliseconds file must be stable before emitting (default 2000). */
  stabilityThreshold?: number;
  /** Milliseconds between file size polls (default 500). */
  pollInterval?: number;
  /** Milliseconds before watch times out (default 300000 = 5 min). */
  timeoutMs?: number;
}

/** Result of a SoX operation. */
export interface SoxResult {
  /** Absolute path to the output WAV file. */
  outputPath: string;
  /** The SoX command that was executed (for debugging/logging). */
  command: string;
}

/** Metadata about a WAV audio file, retrieved via SoX --i. */
export interface SampleInfo {
  /** Absolute path to the file. */
  path: string;
  /** Sample rate in Hz (e.g., 44100). */
  sampleRate: number;
  /** Number of audio channels (1=mono, 2=stereo). */
  channels: number;
  /** Duration in seconds. */
  duration: number;
  /** Total number of samples. */
  samples: number;
  /** Bit depth as string (e.g., "16-bit", "24-bit"). */
  precision: string;
}
