// Standardized audio features used by visualizers and dancer engine
export type AudioFeatures = {
  energy: number; // 0..1 overall energy
  bassLevel: number; // 0..1 low-frequency energy
  kick: boolean; // hard transient in bass
  drop: boolean; // large energy fall then rise
  bpm: number; // estimated beats per minute
  beatPulse: number; // 0..1 pulse synchronized to beats
};

/**
 * AudioFeatureDetector
 * - Pulls spectrum data from one (and optionally a bass-focused) analyser.
 * - Computes energy, bass level, kick/drop heuristics, BPM via autocorrelation,
 *   and a beat-synchronized pulse value for animating visuals.
 */
export class AudioFeatureDetector {
  private analyser: AnalyserNode | null = null;
  private bassAnalyser: AnalyserNode | null = null;
  private freqData = new Uint8Array(0);
  private bassData = new Uint8Array(0);
  private energyHistory: number[] = [];
  private bassHistory: number[] = [];
  // private lastBeatTime = 0; // reserved for future beat gating
  private bpmEstimate = 120;
  private time = 0;

  constructor(analyser: AnalyserNode | null, bassAnalyser?: AnalyserNode | null) {
    this.analyser = analyser ?? null;
    this.bassAnalyser = bassAnalyser ?? null;
    if (this.analyser) this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    if (this.bassAnalyser) this.bassData = new Uint8Array(this.bassAnalyser.frequencyBinCount);
  }

  setAnalysers(analyser: AnalyserNode | null, bassAnalyser?: AnalyserNode | null) {
    this.analyser = analyser ?? null;
    this.bassAnalyser = bassAnalyser ?? null;
    if (this.analyser) this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    if (this.bassAnalyser) this.bassData = new Uint8Array(this.bassAnalyser.frequencyBinCount);
  }

  /**
   * Advance the detector by `dt` seconds and return current features.
   */
  update(dt: number): AudioFeatures {
    this.time += dt;
    let energy = 0, bassLevel = 0;
    if (this.analyser) {
      this.analyser.getByteFrequencyData(this.freqData);
      // Overall energy as average of spectrum
      let sum = 0;
      for (let i = 0; i < this.freqData.length; i++) sum += this.freqData[i];
      energy = sum / (this.freqData.length * 255);
    }
    if (this.bassAnalyser) {
      this.bassAnalyser.getByteFrequencyData(this.bassData);
      const n = Math.max(8, Math.floor(this.bassData.length * 0.1)); // low bins
      let sum = 0;
      for (let i = 0; i < n; i++) sum += this.bassData[i];
      bassLevel = sum / (n * 255);
    } else {
      // fallback: use lowest 10% of the main analyser
      if (this.freqData.length) {
        const n = Math.max(8, Math.floor(this.freqData.length * 0.1));
        let sum = 0;
        for (let i = 0; i < n; i++) sum += this.freqData[i];
        bassLevel = sum / (n * 255);
      }
    }

    // Maintain short history windows
    this.energyHistory.push(energy);
    if (this.energyHistory.length > 1024) this.energyHistory.shift();
    this.bassHistory.push(bassLevel);
    if (this.bassHistory.length > 256) this.bassHistory.shift();

    // Kick detection: bass spike over moving avg + threshold
    const bassAvg = this.bassHistory.reduce((a, b) => a + b, 0) / Math.max(1, this.bassHistory.length);
    const bassVar = this.bassHistory.reduce((a, b) => a + (b - bassAvg) * (b - bassAvg), 0) / Math.max(1, this.bassHistory.length);
    const bassStd = Math.sqrt(bassVar);
    const kick = bassLevel > bassAvg + Math.max(0.06, 2.0 * bassStd);

    // Drop detection: energy fall then surge. Simple heuristic on last ~1s
    const recent = this.energyHistory.slice(-60);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / Math.max(1, recent.length);
    const last = recent[recent.length - 1] ?? energy;
    const prev = recent[recent.length - 10] ?? energy;
    const drop = prev > recentAvg + 0.06 && last < recentAvg - 0.06 && kick;

    // BPM estimation via autocorrelation on ~4s window
    const acWindow = this.energyHistory.slice(-240); // assuming ~60fps -> 4s
    let maxLag = 0, maxVal = 0;
    for (let lag = 15; lag < 120; lag++) { // 0.25s..2s
      let sum = 0;
      for (let i = 0; i < acWindow.length - lag; i++) {
        sum += acWindow[i] * acWindow[i + lag];
      }
      if (sum > maxVal) { maxVal = sum; maxLag = lag; }
    }
    if (maxLag > 0) {
      const secondsPerBeat = maxLag / 60; // if ~60fps
      const bpm = 60 / secondsPerBeat;
      if (bpm >= 60 && bpm <= 180) {
        // smooth estimate
        this.bpmEstimate = this.bpmEstimate * 0.9 + bpm * 0.1;
      }
    }

    // Beat pulse: triangle wave at current BPM (0..1), suitable for glow/pulse
    const beatPeriod = 60 / Math.max(60, Math.min(180, this.bpmEstimate));
    const phase = (this.time % beatPeriod) / beatPeriod;
    const beatPulse = 1 - Math.abs(phase * 2 - 1); // 0..1

    return { energy, bassLevel, kick, drop, bpm: this.bpmEstimate, beatPulse };
  }
}
