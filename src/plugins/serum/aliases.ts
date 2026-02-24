/**
 * Serum 2 semantic alias map
 *
 * Maps human-friendly parameter names to actual FL Studio parameter names
 * discovered at runtime. This layer runs BEFORE Phase 4's three-tier
 * fuzzy matching (exact -> prefix -> contains) as a pre-lookup step.
 *
 * All `actual` values are EXACT parameter names from Serum 2 discovery
 * (FL Studio's plugins.getParamName() output, 685 parameters total).
 */

import type { SemanticAlias } from './types.js';

/**
 * Complete semantic alias table for Serum 2 parameters.
 *
 * Organized by parameter group. Each entry maps 2-4 human-friendly names
 * to the exact FL Studio parameter name. Coverage prioritizes the most
 * commonly tweaked parameters for sound design.
 */
export const SERUM_ALIASES: SemanticAlias[] = [
  // ═══════════════════════════════════════════════════════════════════
  // GLOBAL
  // ═══════════════════════════════════════════════════════════════════
  {
    semantic: ['master volume', 'main volume', 'master vol', 'volume'],
    actual: 'Main Vol',
    group: 'global',
    description: 'Master output volume',
  },
  {
    semantic: ['master tuning', 'global tuning', 'main tuning'],
    actual: 'Main Tuning',
    group: 'global',
    description: 'Global pitch tuning',
  },
  {
    semantic: ['amp', 'amplitude'],
    actual: 'Amp',
    group: 'global',
    description: 'Amplitude level',
  },
  {
    semantic: ['portamento', 'porta', 'glide', 'glide time'],
    actual: 'Porta Time',
    group: 'global',
    description: 'Portamento/glide time between notes',
  },
  {
    semantic: ['portamento curve', 'porta curve', 'glide curve'],
    actual: 'Porta Curve',
    group: 'global',
    description: 'Shape of portamento curve',
  },
  {
    semantic: ['pitch bend up', 'bend up'],
    actual: 'Bend Up',
    group: 'global',
    description: 'Pitch bend range upward',
  },
  {
    semantic: ['pitch bend down', 'bend down'],
    actual: 'Bend Down',
    group: 'global',
    description: 'Pitch bend range downward',
  },
  {
    semantic: ['mono', 'mono mode', 'monophonic'],
    actual: 'Mono Toggle',
    group: 'global',
    description: 'Toggle monophonic mode',
  },
  {
    semantic: ['legato', 'legato mode'],
    actual: 'Legato',
    group: 'global',
    description: 'Enable legato (no retrigger on overlapping notes)',
  },
  {
    semantic: ['transpose', 'global transpose'],
    actual: 'Transpose',
    group: 'global',
    description: 'Global transpose in semitones',
  },
  {
    semantic: ['bypass', 'plugin bypass'],
    actual: 'Bypass',
    group: 'global',
    description: 'Bypass the plugin',
  },
  {
    semantic: ['direct volume', 'direct out', 'direct vol'],
    actual: 'Direct Vol',
    group: 'global',
    description: 'Direct signal volume (bypasses FX buses)',
  },
  {
    semantic: ['bus 1 volume', 'bus 1 vol'],
    actual: 'Bus 1 Vol',
    group: 'global',
    description: 'FX Bus 1 send volume',
  },
  {
    semantic: ['bus 2 volume', 'bus 2 vol'],
    actual: 'Bus 2 Vol',
    group: 'global',
    description: 'FX Bus 2 send volume',
  },

  // ═══════════════════════════════════════════════════════════════════
  // OSCILLATOR A
  // ═══════════════════════════════════════════════════════════════════
  {
    semantic: ['osc a enable', 'oscillator a on', 'osc a on'],
    actual: 'A Enable',
    group: 'oscillator-a',
    description: 'Enable oscillator A',
  },
  {
    semantic: ['osc a level', 'osc a volume', 'osc a vol', 'oscillator a level'],
    actual: 'A Level',
    group: 'oscillator-a',
    description: 'Oscillator A output level',
  },
  {
    semantic: ['osc a pan', 'oscillator a pan'],
    actual: 'A Pan',
    group: 'oscillator-a',
    description: 'Oscillator A stereo panning',
  },
  {
    semantic: ['osc a octave', 'oscillator a octave'],
    actual: 'A Octave',
    group: 'oscillator-a',
    description: 'Oscillator A octave offset',
  },
  {
    semantic: ['osc a semi', 'osc a semitone', 'oscillator a semi'],
    actual: 'A Semi',
    group: 'oscillator-a',
    description: 'Oscillator A semitone offset',
  },
  {
    semantic: ['osc a fine', 'osc a fine tune', 'oscillator a fine'],
    actual: 'A Fine',
    group: 'oscillator-a',
    description: 'Oscillator A fine tuning',
  },
  {
    semantic: ['osc a wavetable', 'osc a wt pos', 'osc a wavetable position', 'wt pos a'],
    actual: 'A WT Pos',
    group: 'oscillator-a',
    description: 'Oscillator A wavetable frame position',
  },
  {
    semantic: ['osc a unison', 'osc a voices', 'unison a'],
    actual: 'A Unison',
    group: 'oscillator-a',
    description: 'Oscillator A unison voice count',
  },
  {
    semantic: ['osc a unison detune', 'osc a detune', 'unison detune a'],
    actual: 'A Uni Detune',
    group: 'oscillator-a',
    description: 'Oscillator A unison detune spread',
  },
  {
    semantic: ['osc a unison blend', 'unison blend a'],
    actual: 'A Uni Blend',
    group: 'oscillator-a',
    description: 'Oscillator A unison voice volume blend',
  },
  {
    semantic: ['osc a unison width', 'unison width a', 'osc a stereo width'],
    actual: 'A Uni Width',
    group: 'oscillator-a',
    description: 'Oscillator A unison stereo width',
  },
  {
    semantic: ['osc a unison stack', 'unison stack a'],
    actual: 'A Uni Stack',
    group: 'oscillator-a',
    description: 'Oscillator A unison stacking mode',
  },
  {
    semantic: ['osc a warp', 'warp a', 'osc a warp amount'],
    actual: 'A Warp',
    group: 'oscillator-a',
    description: 'Oscillator A warp effect amount',
  },
  {
    semantic: ['osc a warp mode', 'warp mode a'],
    actual: 'A Warp Mode',
    group: 'oscillator-a',
    description: 'Oscillator A warp algorithm/type',
  },
  {
    semantic: ['osc a phase', 'oscillator a phase'],
    actual: 'A Phase',
    group: 'oscillator-a',
    description: 'Oscillator A starting phase',
  },
  {
    semantic: ['osc a random phase', 'osc a rand phase'],
    actual: 'A Rand Phase',
    group: 'oscillator-a',
    description: 'Oscillator A phase randomization',
  },
  {
    semantic: ['osc a position', 'osc a sample position'],
    actual: 'A Position',
    group: 'oscillator-a',
    description: 'Oscillator A sample/wavetable start position',
  },
  {
    semantic: ['osc a scan rate', 'osc a morph rate'],
    actual: 'A Scan Rate',
    group: 'oscillator-a',
    description: 'Oscillator A wavetable scan rate',
  },

  // ═══════════════════════════════════════════════════════════════════
  // OSCILLATOR B
  // ═══════════════════════════════════════════════════════════════════
  {
    semantic: ['osc b enable', 'oscillator b on', 'osc b on'],
    actual: 'B Enable',
    group: 'oscillator-b',
    description: 'Enable oscillator B',
  },
  {
    semantic: ['osc b level', 'osc b volume', 'osc b vol', 'oscillator b level'],
    actual: 'B Level',
    group: 'oscillator-b',
    description: 'Oscillator B output level',
  },
  {
    semantic: ['osc b pan', 'oscillator b pan'],
    actual: 'B Pan',
    group: 'oscillator-b',
    description: 'Oscillator B stereo panning',
  },
  {
    semantic: ['osc b octave', 'oscillator b octave'],
    actual: 'B Octave',
    group: 'oscillator-b',
    description: 'Oscillator B octave offset',
  },
  {
    semantic: ['osc b semi', 'osc b semitone', 'oscillator b semi'],
    actual: 'B Semi',
    group: 'oscillator-b',
    description: 'Oscillator B semitone offset',
  },
  {
    semantic: ['osc b fine', 'osc b fine tune', 'oscillator b fine'],
    actual: 'B Fine',
    group: 'oscillator-b',
    description: 'Oscillator B fine tuning',
  },
  {
    semantic: ['osc b wavetable', 'osc b wt pos', 'osc b wavetable position', 'wt pos b'],
    actual: 'B WT Pos',
    group: 'oscillator-b',
    description: 'Oscillator B wavetable frame position',
  },
  {
    semantic: ['osc b unison', 'osc b voices', 'unison b'],
    actual: 'B Unison',
    group: 'oscillator-b',
    description: 'Oscillator B unison voice count',
  },
  {
    semantic: ['osc b unison detune', 'osc b detune', 'unison detune b'],
    actual: 'B Uni Detune',
    group: 'oscillator-b',
    description: 'Oscillator B unison detune spread',
  },
  {
    semantic: ['osc b unison blend', 'unison blend b'],
    actual: 'B Uni Blend',
    group: 'oscillator-b',
    description: 'Oscillator B unison voice volume blend',
  },
  {
    semantic: ['osc b unison width', 'unison width b', 'osc b stereo width'],
    actual: 'B Uni Width',
    group: 'oscillator-b',
    description: 'Oscillator B unison stereo width',
  },
  {
    semantic: ['osc b warp', 'warp b', 'osc b warp amount'],
    actual: 'B Warp',
    group: 'oscillator-b',
    description: 'Oscillator B warp effect amount',
  },
  {
    semantic: ['osc b warp mode', 'warp mode b'],
    actual: 'B Warp Mode',
    group: 'oscillator-b',
    description: 'Oscillator B warp algorithm/type',
  },
  {
    semantic: ['osc b phase', 'oscillator b phase'],
    actual: 'B Phase',
    group: 'oscillator-b',
    description: 'Oscillator B starting phase',
  },

  // ═══════════════════════════════════════════════════════════════════
  // OSCILLATOR C
  // ═══════════════════════════════════════════════════════════════════
  {
    semantic: ['osc c enable', 'oscillator c on', 'osc c on'],
    actual: 'C Enable',
    group: 'oscillator-c',
    description: 'Enable oscillator C',
  },
  {
    semantic: ['osc c level', 'osc c volume', 'osc c vol', 'oscillator c level'],
    actual: 'C Level',
    group: 'oscillator-c',
    description: 'Oscillator C output level',
  },
  {
    semantic: ['osc c pan', 'oscillator c pan'],
    actual: 'C Pan',
    group: 'oscillator-c',
    description: 'Oscillator C stereo panning',
  },
  {
    semantic: ['osc c octave', 'oscillator c octave'],
    actual: 'C Octave',
    group: 'oscillator-c',
    description: 'Oscillator C octave offset',
  },
  {
    semantic: ['osc c semi', 'osc c semitone', 'oscillator c semi'],
    actual: 'C Semi',
    group: 'oscillator-c',
    description: 'Oscillator C semitone offset',
  },
  {
    semantic: ['osc c fine', 'osc c fine tune', 'oscillator c fine'],
    actual: 'C Fine',
    group: 'oscillator-c',
    description: 'Oscillator C fine tuning',
  },
  {
    semantic: ['osc c wavetable', 'osc c wt pos', 'osc c wavetable position', 'wt pos c'],
    actual: 'C WT Pos',
    group: 'oscillator-c',
    description: 'Oscillator C wavetable frame position',
  },
  {
    semantic: ['osc c unison', 'osc c voices', 'unison c'],
    actual: 'C Unison',
    group: 'oscillator-c',
    description: 'Oscillator C unison voice count',
  },
  {
    semantic: ['osc c unison detune', 'osc c detune', 'unison detune c'],
    actual: 'C Uni Detune',
    group: 'oscillator-c',
    description: 'Oscillator C unison detune spread',
  },
  {
    semantic: ['osc c unison blend', 'unison blend c'],
    actual: 'C Uni Blend',
    group: 'oscillator-c',
    description: 'Oscillator C unison voice volume blend',
  },
  {
    semantic: ['osc c unison width', 'unison width c', 'osc c stereo width'],
    actual: 'C Uni Width',
    group: 'oscillator-c',
    description: 'Oscillator C unison stereo width',
  },
  {
    semantic: ['osc c warp', 'warp c', 'osc c warp amount'],
    actual: 'C Warp',
    group: 'oscillator-c',
    description: 'Oscillator C warp effect amount',
  },
  {
    semantic: ['osc c warp mode', 'warp mode c'],
    actual: 'C Warp Mode',
    group: 'oscillator-c',
    description: 'Oscillator C warp algorithm/type',
  },
  {
    semantic: ['osc c phase', 'oscillator c phase'],
    actual: 'C Phase',
    group: 'oscillator-c',
    description: 'Oscillator C starting phase',
  },

  // ═══════════════════════════════════════════════════════════════════
  // SUB OSCILLATOR
  // ═══════════════════════════════════════════════════════════════════
  {
    semantic: ['sub enable', 'sub on', 'sub oscillator on'],
    actual: 'Sub Enable',
    group: 'sub',
    description: 'Enable sub oscillator',
  },
  {
    semantic: ['sub level', 'sub volume', 'sub vol', 'sub oscillator level'],
    actual: 'Sub Level',
    group: 'sub',
    description: 'Sub oscillator output level',
  },
  {
    semantic: ['sub pan', 'sub oscillator pan'],
    actual: 'Sub Pan',
    group: 'sub',
    description: 'Sub oscillator stereo panning',
  },
  {
    semantic: ['sub octave', 'sub oscillator octave'],
    actual: 'Sub Octave',
    group: 'sub',
    description: 'Sub oscillator octave offset',
  },
  {
    semantic: ['sub shape', 'sub waveform', 'sub wave'],
    actual: 'Sub Shape',
    group: 'sub',
    description: 'Sub oscillator waveform shape',
  },
  {
    semantic: ['sub phase', 'sub oscillator phase'],
    actual: 'Sub Phase',
    group: 'sub',
    description: 'Sub oscillator starting phase',
  },

  // ═══════════════════════════════════════════════════════════════════
  // NOISE OSCILLATOR
  // ═══════════════════════════════════════════════════════════════════
  {
    semantic: ['noise enable', 'noise on', 'noise oscillator on'],
    actual: 'Noise Enable',
    group: 'noise',
    description: 'Enable noise oscillator',
  },
  {
    semantic: ['noise level', 'noise volume', 'noise vol', 'noise amount'],
    actual: 'Noise Level',
    group: 'noise',
    description: 'Noise oscillator output level',
  },
  {
    semantic: ['noise pan', 'noise oscillator pan'],
    actual: 'Noise Pan',
    group: 'noise',
    description: 'Noise oscillator stereo panning',
  },
  {
    semantic: ['noise pitch', 'noise frequency', 'noise freq'],
    actual: 'Noise Pitch',
    group: 'noise',
    description: 'Noise oscillator pitch/frequency',
  },
  {
    semantic: ['noise fine', 'noise fine tune'],
    actual: 'Noise Fine',
    group: 'noise',
    description: 'Noise oscillator fine tuning',
  },

  // ═══════════════════════════════════════════════════════════════════
  // FILTER 1
  // ═══════════════════════════════════════════════════════════════════
  {
    semantic: ['filter on', 'filter 1 on', 'filter 1 enable'],
    actual: 'Filter 1 On',
    group: 'filter-1',
    description: 'Enable filter 1',
  },
  {
    semantic: ['filter cutoff', 'cutoff', 'filter freq', 'filter 1 cutoff', 'filter 1 freq'],
    actual: 'Filter 1 Freq',
    group: 'filter-1',
    description: 'Filter 1 cutoff frequency',
  },
  {
    semantic: ['filter resonance', 'resonance', 'filter res', 'filter 1 resonance', 'filter 1 res'],
    actual: 'Filter 1 Res',
    group: 'filter-1',
    description: 'Filter 1 resonance',
  },
  {
    semantic: ['filter type', 'filter 1 type', 'filter mode'],
    actual: 'Filter 1 Type',
    group: 'filter-1',
    description: 'Filter 1 type (low-pass, high-pass, band-pass, etc.)',
  },
  {
    semantic: ['filter drive', 'filter 1 drive', 'filter distortion'],
    actual: 'Filter 1 Drive',
    group: 'filter-1',
    description: 'Filter 1 drive/saturation',
  },
  {
    semantic: ['filter wet', 'filter 1 wet', 'filter mix', 'filter 1 mix'],
    actual: 'Filter 1 Wet',
    group: 'filter-1',
    description: 'Filter 1 wet/dry mix',
  },
  {
    semantic: ['filter level', 'filter 1 level', 'filter 1 volume'],
    actual: 'Filter 1 Level',
    group: 'filter-1',
    description: 'Filter 1 output level',
  },
  {
    semantic: ['filter stereo', 'filter 1 stereo'],
    actual: 'Filter 1 Stereo',
    group: 'filter-1',
    description: 'Filter 1 stereo offset',
  },

  // ═══════════════════════════════════════════════════════════════════
  // FILTER 2
  // ═══════════════════════════════════════════════════════════════════
  {
    semantic: ['filter 2 on', 'filter 2 enable'],
    actual: 'Filter 2 On',
    group: 'filter-2',
    description: 'Enable filter 2',
  },
  {
    semantic: ['filter 2 cutoff', 'filter 2 freq', 'cutoff 2'],
    actual: 'Filter 2 Freq',
    group: 'filter-2',
    description: 'Filter 2 cutoff frequency',
  },
  {
    semantic: ['filter 2 resonance', 'filter 2 res', 'resonance 2'],
    actual: 'Filter 2 Res',
    group: 'filter-2',
    description: 'Filter 2 resonance',
  },
  {
    semantic: ['filter 2 type', 'filter 2 mode'],
    actual: 'Filter 2 Type',
    group: 'filter-2',
    description: 'Filter 2 type',
  },
  {
    semantic: ['filter 2 drive'],
    actual: 'Filter 2 Drive',
    group: 'filter-2',
    description: 'Filter 2 drive/saturation',
  },
  {
    semantic: ['filter 2 wet', 'filter 2 mix'],
    actual: 'Filter 2 Wet',
    group: 'filter-2',
    description: 'Filter 2 wet/dry mix',
  },

  // ═══════════════════════════════════════════════════════════════════
  // ENVELOPE 1 (Amp Envelope)
  // ═══════════════════════════════════════════════════════════════════
  {
    semantic: ['attack', 'amp attack', 'env 1 attack', 'envelope attack'],
    actual: 'Env 1 Attack',
    group: 'envelope-1',
    description: 'Amp envelope attack time',
  },
  {
    semantic: ['hold', 'amp hold', 'env 1 hold', 'envelope hold'],
    actual: 'Env 1 Hold',
    group: 'envelope-1',
    description: 'Amp envelope hold time',
  },
  {
    semantic: ['decay', 'amp decay', 'env 1 decay', 'envelope decay'],
    actual: 'Env 1 Decay',
    group: 'envelope-1',
    description: 'Amp envelope decay time',
  },
  {
    semantic: ['sustain', 'amp sustain', 'env 1 sustain', 'envelope sustain'],
    actual: 'Env 1 Sustain',
    group: 'envelope-1',
    description: 'Amp envelope sustain level',
  },
  {
    semantic: ['release', 'amp release', 'env 1 release', 'envelope release'],
    actual: 'Env 1 Release',
    group: 'envelope-1',
    description: 'Amp envelope release time',
  },
  {
    semantic: ['attack curve', 'env 1 attack curve'],
    actual: 'Env 1 Atk Curve',
    group: 'envelope-1',
    description: 'Amp envelope attack curve shape',
  },
  {
    semantic: ['decay curve', 'env 1 decay curve'],
    actual: 'Env 1 Dec Curve',
    group: 'envelope-1',
    description: 'Amp envelope decay curve shape',
  },
  {
    semantic: ['release curve', 'env 1 release curve'],
    actual: 'Env 1 Rel Curve',
    group: 'envelope-1',
    description: 'Amp envelope release curve shape',
  },

  // ═══════════════════════════════════════════════════════════════════
  // ENVELOPE 2 (Filter/Mod Envelope)
  // ═══════════════════════════════════════════════════════════════════
  {
    semantic: ['env 2 attack', 'filter attack', 'mod attack'],
    actual: 'Env 2 Attack',
    group: 'envelope-2',
    description: 'Envelope 2 attack time',
  },
  {
    semantic: ['env 2 hold', 'filter hold'],
    actual: 'Env 2 Hold',
    group: 'envelope-2',
    description: 'Envelope 2 hold time',
  },
  {
    semantic: ['env 2 decay', 'filter decay', 'mod decay'],
    actual: 'Env 2 Decay',
    group: 'envelope-2',
    description: 'Envelope 2 decay time',
  },
  {
    semantic: ['env 2 sustain', 'filter sustain', 'mod sustain'],
    actual: 'Env 2 Sustain',
    group: 'envelope-2',
    description: 'Envelope 2 sustain level',
  },
  {
    semantic: ['env 2 release', 'filter release', 'mod release'],
    actual: 'Env 2 Release',
    group: 'envelope-2',
    description: 'Envelope 2 release time',
  },

  // ═══════════════════════════════════════════════════════════════════
  // ENVELOPE 3
  // ═══════════════════════════════════════════════════════════════════
  {
    semantic: ['env 3 attack'],
    actual: 'Env 3 Attack',
    group: 'envelope-3',
    description: 'Envelope 3 attack time',
  },
  {
    semantic: ['env 3 decay'],
    actual: 'Env 3 Decay',
    group: 'envelope-3',
    description: 'Envelope 3 decay time',
  },
  {
    semantic: ['env 3 sustain'],
    actual: 'Env 3 Sustain',
    group: 'envelope-3',
    description: 'Envelope 3 sustain level',
  },
  {
    semantic: ['env 3 release'],
    actual: 'Env 3 Release',
    group: 'envelope-3',
    description: 'Envelope 3 release time',
  },

  // ═══════════════════════════════════════════════════════════════════
  // ENVELOPE 4
  // ═══════════════════════════════════════════════════════════════════
  {
    semantic: ['env 4 attack'],
    actual: 'Env 4 Attack',
    group: 'envelope-4',
    description: 'Envelope 4 attack time',
  },
  {
    semantic: ['env 4 decay'],
    actual: 'Env 4 Decay',
    group: 'envelope-4',
    description: 'Envelope 4 decay time',
  },
  {
    semantic: ['env 4 sustain'],
    actual: 'Env 4 Sustain',
    group: 'envelope-4',
    description: 'Envelope 4 sustain level',
  },
  {
    semantic: ['env 4 release'],
    actual: 'Env 4 Release',
    group: 'envelope-4',
    description: 'Envelope 4 release time',
  },

  // ═══════════════════════════════════════════════════════════════════
  // LFOs
  // ═══════════════════════════════════════════════════════════════════
  {
    semantic: ['lfo rate', 'lfo 1 rate', 'lfo speed', 'lfo 1 speed'],
    actual: 'LFO 1 Rate',
    group: 'lfo',
    description: 'LFO 1 rate/speed',
  },
  {
    semantic: ['lfo smooth', 'lfo 1 smooth'],
    actual: 'LFO 1 Smooth',
    group: 'lfo',
    description: 'LFO 1 smoothing amount',
  },
  {
    semantic: ['lfo rise', 'lfo 1 rise', 'lfo fade in'],
    actual: 'LFO 1 Rise',
    group: 'lfo',
    description: 'LFO 1 rise/fade-in time',
  },
  {
    semantic: ['lfo delay', 'lfo 1 delay'],
    actual: 'LFO 1 Delay',
    group: 'lfo',
    description: 'LFO 1 onset delay',
  },
  {
    semantic: ['lfo phase', 'lfo 1 phase'],
    actual: 'LFO 1 Phase',
    group: 'lfo',
    description: 'LFO 1 starting phase',
  },
  {
    semantic: ['lfo 2 rate', 'lfo 2 speed'],
    actual: 'LFO 2 Rate',
    group: 'lfo',
    description: 'LFO 2 rate/speed',
  },
  {
    semantic: ['lfo 2 smooth'],
    actual: 'LFO 2 Smooth',
    group: 'lfo',
    description: 'LFO 2 smoothing amount',
  },
  {
    semantic: ['lfo 2 rise', 'lfo 2 fade in'],
    actual: 'LFO 2 Rise',
    group: 'lfo',
    description: 'LFO 2 rise/fade-in time',
  },
  {
    semantic: ['lfo 2 delay'],
    actual: 'LFO 2 Delay',
    group: 'lfo',
    description: 'LFO 2 onset delay',
  },
  {
    semantic: ['lfo 2 phase'],
    actual: 'LFO 2 Phase',
    group: 'lfo',
    description: 'LFO 2 starting phase',
  },
  {
    semantic: ['lfo 3 rate', 'lfo 3 speed'],
    actual: 'LFO 3 Rate',
    group: 'lfo',
    description: 'LFO 3 rate/speed',
  },
  {
    semantic: ['lfo 3 phase'],
    actual: 'LFO 3 Phase',
    group: 'lfo',
    description: 'LFO 3 starting phase',
  },
  {
    semantic: ['lfo 4 rate', 'lfo 4 speed'],
    actual: 'LFO 4 Rate',
    group: 'lfo',
    description: 'LFO 4 rate/speed',
  },
  {
    semantic: ['lfo 4 phase'],
    actual: 'LFO 4 Phase',
    group: 'lfo',
    description: 'LFO 4 starting phase',
  },

  // ═══════════════════════════════════════════════════════════════════
  // MACROS
  // ═══════════════════════════════════════════════════════════════════
  {
    semantic: ['macro 1', 'macro one', 'macro a'],
    actual: 'Macro 1',
    group: 'macros',
    description: 'Macro control 1',
  },
  {
    semantic: ['macro 2', 'macro two', 'macro b'],
    actual: 'Macro 2',
    group: 'macros',
    description: 'Macro control 2',
  },
  {
    semantic: ['macro 3', 'macro three', 'macro c'],
    actual: 'Macro 3',
    group: 'macros',
    description: 'Macro control 3',
  },
  {
    semantic: ['macro 4', 'macro four', 'macro d'],
    actual: 'Macro 4',
    group: 'macros',
    description: 'Macro control 4',
  },
  {
    semantic: ['macro 5', 'macro five'],
    actual: 'Macro 5',
    group: 'macros',
    description: 'Macro control 5',
  },
  {
    semantic: ['macro 6', 'macro six'],
    actual: 'Macro 6',
    group: 'macros',
    description: 'Macro control 6',
  },
  {
    semantic: ['macro 7', 'macro seven'],
    actual: 'Macro 7',
    group: 'macros',
    description: 'Macro control 7',
  },
  {
    semantic: ['macro 8', 'macro eight'],
    actual: 'Macro 8',
    group: 'macros',
    description: 'Macro control 8',
  },

  // ═══════════════════════════════════════════════════════════════════
  // FX (Main Bus)
  // ═══════════════════════════════════════════════════════════════════
  {
    semantic: ['fx 1', 'effect 1', 'fx main 1'],
    actual: 'FX Main Param 1',
    group: 'fx',
    description: 'FX main bus parameter 1',
  },
  {
    semantic: ['fx 2', 'effect 2', 'fx main 2'],
    actual: 'FX Main Param 2',
    group: 'fx',
    description: 'FX main bus parameter 2',
  },
  {
    semantic: ['fx 3', 'effect 3', 'fx main 3'],
    actual: 'FX Main Param 3',
    group: 'fx',
    description: 'FX main bus parameter 3',
  },
  {
    semantic: ['fx 4', 'effect 4', 'fx main 4'],
    actual: 'FX Main Param 4',
    group: 'fx',
    description: 'FX main bus parameter 4',
  },
  {
    semantic: ['fx 5', 'effect 5', 'fx main 5'],
    actual: 'FX Main Param 5',
    group: 'fx',
    description: 'FX main bus parameter 5',
  },
  {
    semantic: ['fx 6', 'effect 6', 'fx main 6'],
    actual: 'FX Main Param 6',
    group: 'fx',
    description: 'FX main bus parameter 6',
  },
  {
    semantic: ['fx 7', 'effect 7', 'fx main 7'],
    actual: 'FX Main Param 7',
    group: 'fx',
    description: 'FX main bus parameter 7',
  },
  {
    semantic: ['fx 8', 'effect 8', 'fx main 8'],
    actual: 'FX Main Param 8',
    group: 'fx',
    description: 'FX main bus parameter 8',
  },

  // ═══════════════════════════════════════════════════════════════════
  // ROUTING
  // ═══════════════════════════════════════════════════════════════════
  {
    semantic: ['osc a filter balance', 'a filter balance', 'a to filter'],
    actual: 'A>Filter Balance',
    group: 'routing',
    description: 'Oscillator A filter routing balance (filter 1 vs filter 2)',
  },
  {
    semantic: ['osc a bus 1', 'a to bus 1'],
    actual: 'A>BUS1',
    group: 'routing',
    description: 'Oscillator A send to FX bus 1',
  },
  {
    semantic: ['osc a bus 2', 'a to bus 2'],
    actual: 'A>BUS2',
    group: 'routing',
    description: 'Oscillator A send to FX bus 2',
  },
  {
    semantic: ['osc b filter balance', 'b filter balance', 'b to filter'],
    actual: 'B>Filter Balance',
    group: 'routing',
    description: 'Oscillator B filter routing balance',
  },
  {
    semantic: ['osc b bus 1', 'b to bus 1'],
    actual: 'B>BUS1',
    group: 'routing',
    description: 'Oscillator B send to FX bus 1',
  },
  {
    semantic: ['osc b bus 2', 'b to bus 2'],
    actual: 'B>BUS2',
    group: 'routing',
    description: 'Oscillator B send to FX bus 2',
  },
  {
    semantic: ['noise filter balance', 'noise to filter'],
    actual: 'Noise>Filter Balance',
    group: 'routing',
    description: 'Noise oscillator filter routing balance',
  },
  {
    semantic: ['sub filter balance', 'sub to filter'],
    actual: 'Sub Osc>Filter Balance',
    group: 'routing',
    description: 'Sub oscillator filter routing balance',
  },
];

// ═══════════════════════════════════════════════════════════════════════
// Lookup index: built once at module load for O(1) semantic resolution
// ═══════════════════════════════════════════════════════════════════════

/** Maps lowercase semantic name -> actual FL Studio parameter name */
const semanticIndex = new Map<string, string>();

for (const alias of SERUM_ALIASES) {
  for (const name of alias.semantic) {
    semanticIndex.set(name.toLowerCase().trim(), alias.actual);
  }
}

/**
 * Resolve a semantic/human-friendly parameter name to its actual
 * FL Studio parameter name for Serum 2.
 *
 * This is a PRE-LOOKUP step that runs BEFORE Phase 4's three-tier
 * fuzzy matching. If a semantic match is found, the actual FL Studio
 * name is returned. If not, the input is returned unchanged so
 * Phase 4's param-cache can attempt fuzzy resolution.
 *
 * @param input - Human-friendly parameter name (e.g., "filter cutoff")
 * @returns Actual FL Studio parameter name (e.g., "Filter 1 Freq") or input unchanged
 */
export function resolveSemanticAlias(input: string): string {
  const normalized = input.toLowerCase().trim();
  return semanticIndex.get(normalized) ?? input;
}

/**
 * Get list of unique alias group names for browsing/discovery.
 *
 * @returns Sorted array of unique group names (e.g., 'oscillator-a', 'filter-1', etc.)
 */
export function getAliasGroups(): string[] {
  const groups = new Set<string>();
  for (const alias of SERUM_ALIASES) {
    groups.add(alias.group);
  }
  return [...groups].sort();
}
