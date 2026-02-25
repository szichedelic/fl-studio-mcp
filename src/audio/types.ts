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
