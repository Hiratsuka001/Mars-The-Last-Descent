/**
 * Web Audio API synthesizer for MARS: THE LAST DESCENT
 * Zero external audio file dependencies - 100% CC0 procedural sound engine.
 * Supports:
 * - Surface-specific footsteps (regolith, sand, snow, grass, metal)
 * - Biome-specific procedural wind loops with smooth crossfading
 * - Sci-fi interaction blips, part collection fanfare, repair ratchets, launch rumbles
 * - Separate music/ambient & SFX volume controls with localStorage persistence
 * - First-input audio unlock (compliant with browser autoplay policies)
 * - Tab visibility pause / mute
 */

export type SurfaceType = 'regolith' | 'sand' | 'snow' | 'grass' | 'metal';

class SoundSystem {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private musicVolume: number = 0.5;
  private sfxVolume: number = 0.7;

  // Drone ambience
  private ambientGain: GainNode | null = null;
  private ambientOsc1: OscillatorNode | null = null;
  private ambientOsc2: OscillatorNode | null = null;

  // Procedural wind ambience
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windSource: AudioBufferSourceNode | null = null;
  private currentWindBiome: string | null = null;

  // Shared noise buffer cache
  private noiseBuffer: AudioBuffer | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const savedMute = localStorage.getItem('sound_muted');
      if (savedMute !== null) this.isMuted = savedMute === 'true';

      const savedMusicVol = localStorage.getItem('sound_music_vol');
      if (savedMusicVol !== null) this.musicVolume = Math.max(0, Math.min(1, parseFloat(savedMusicVol)));

      const savedSfxVol = localStorage.getItem('sound_sfx_vol');
      if (savedSfxVol !== null) this.sfxVolume = Math.max(0, Math.min(1, parseFloat(savedSfxVol)));

      // Auto-unlock WebAudio on first user interaction
      const unlockAudio = () => {
        this.initCtx();
        window.removeEventListener('pointerdown', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
      };
      window.addEventListener('pointerdown', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });
      window.addEventListener('touchstart', unlockAudio, { passive: true });

      // Handle tab visibility change
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (this.ctx && this.ctx.state === 'running') {
            this.ctx.suspend().catch(() => {});
          }
        } else {
          if (this.ctx && this.ctx.state === 'suspended' && !this.isMuted) {
            this.ctx.resume().catch(() => {});
          }
        }
      });
    }
  }

  private initCtx() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private getNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    if (!this.noiseBuffer) {
      const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of pink/white noise
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        data[i] = (b0 + b1 + b2 + white * 0.5362) * 0.11;
      }
    }
    return this.noiseBuffer;
  }

  // Volume & Mute Controls
  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    localStorage.setItem('sound_muted', String(this.isMuted));
    if (this.isMuted) {
      this.stopAmbience();
      this.stopBiomeWind();
    }
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    localStorage.setItem('sound_muted', String(this.isMuted));
    if (this.isMuted) {
      this.stopAmbience();
      this.stopBiomeWind();
    }
  }

  public getMusicVolume(): number {
    return this.musicVolume;
  }

  public setMusicVolume(vol: number) {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    localStorage.setItem('sound_music_vol', String(this.musicVolume));
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setValueAtTime(0.04 * this.musicVolume, this.ctx.currentTime);
    }
    if (this.windGain && this.ctx) {
      this.windGain.gain.setValueAtTime(0.06 * this.musicVolume, this.ctx.currentTime);
    }
  }

  public getSfxVolume(): number {
    return this.sfxVolume;
  }

  public setSfxVolume(vol: number) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    localStorage.setItem('sound_sfx_vol', String(this.sfxVolume));
  }

  // ==========================================================================
  // SURFACE FOOTSTEPS
  // ==========================================================================

  public playFootstep(surface: SurfaceType = 'regolith') {
    if (this.isMuted || this.sfxVolume <= 0) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const nBuffer = this.getNoiseBuffer();
      if (!nBuffer) return;

      const source = this.ctx.createBufferSource();
      source.buffer = nBuffer;

      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      switch (surface) {
        case 'sand': {
          // Soft sandy scuff
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(650 + Math.random() * 100, now);
          gain.gain.setValueAtTime(0.04 * this.sfxVolume, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
          break;
        }
        case 'snow': {
          // Cold high-pitched squeak / crust crunch
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(1900 + Math.random() * 300, now);
          filter.Q.setValueAtTime(3, now);
          gain.gain.setValueAtTime(0.06 * this.sfxVolume, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          break;
        }
        case 'grass': {
          // Light terraformed turf rustle
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(1100 + Math.random() * 200, now);
          gain.gain.setValueAtTime(0.04 * this.sfxVolume, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
          break;
        }
        case 'metal': {
          // Sharp metallic ring / step on lander pad
          filter.type = 'highpass';
          filter.frequency.setValueAtTime(1200, now);
          gain.gain.setValueAtTime(0.08 * this.sfxVolume, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

          // Add a subtle metallic resonance harmonic
          const osc = this.ctx.createOscillator();
          const oscGain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(840 + (Math.random() > 0.5 ? 40 : -40), now);
          oscGain.gain.setValueAtTime(0.03 * this.sfxVolume, now);
          oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
          osc.connect(oscGain);
          oscGain.connect(this.ctx.destination);
          osc.start(now);
          osc.stop(now + 0.07);
          break;
        }
        case 'regolith':
        default: {
          // Crispy Mars soil crunch
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(750 + Math.random() * 150, now);
          filter.Q.setValueAtTime(1.5, now);
          gain.gain.setValueAtTime(0.07 * this.sfxVolume, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
          break;
        }
      }

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      source.start(now, Math.random() * 1.5, 0.1);
    } catch {
      // Audio fallback
    }
  }

  // ==========================================================================
  // PROCEDURAL BIOME WIND AMBIENCE (CROSSFADED)
  // ==========================================================================

  public startBiomeWind(biome: string) {
    if (this.isMuted || this.musicVolume <= 0) return;
    if (this.currentWindBiome === biome && this.windSource) return;

    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const nBuffer = this.getNoiseBuffer();
      if (!nBuffer) return;

      // Smoothly crossfade if already running
      if (this.windFilter) {
        let targetFreq = 400;
        let targetQ = 1;
        if (biome === 'desert') {
          targetFreq = 700; // Whistling sand dunes
          targetQ = 2.5;
        } else if (biome === 'snow') {
          targetFreq = 1200; // Icy blizzard draft
          targetQ = 3.0;
        } else if (biome === 'grassland') {
          targetFreq = 300; // Gentle meadow rustle
          targetQ = 0.8;
        }
        this.windFilter.frequency.exponentialRampToValueAtTime(targetFreq, now + 1.2);
        this.windFilter.Q.exponentialRampToValueAtTime(targetQ, now + 1.2);
        this.currentWindBiome = biome;
        return;
      }

      // Initial wind start
      this.windGain = this.ctx.createGain();
      this.windGain.gain.setValueAtTime(0.001, now);
      this.windGain.gain.linearRampToValueAtTime(0.05 * this.musicVolume, now + 2.0);

      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'lowpass';
      this.windFilter.frequency.setValueAtTime(450, now);

      this.windSource = this.ctx.createBufferSource();
      this.windSource.buffer = nBuffer;
      this.windSource.loop = true;

      this.windSource.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.ctx.destination);

      this.windSource.start(now);
      this.currentWindBiome = biome;
    } catch {
      // Audio fallback
    }
  }

  public stopBiomeWind() {
    try {
      if (this.windGain && this.ctx) {
        this.windGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);
      }
      setTimeout(() => {
        if (this.windSource) {
          try { this.windSource.stop(); } catch {}
          this.windSource.disconnect();
          this.windSource = null;
        }
        this.windFilter = null;
        this.windGain = null;
        this.currentWindBiome = null;
      }, 900);
    } catch {}
  }

  // ==========================================================================
  // GAMEPLAY SOUND EFFECTS
  // ==========================================================================

  public playClick() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1400, this.ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.08 * this.sfxVolume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch {}
  }

  public playHover() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.03 * this.sfxVolume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.03);
    } catch {}
  }

  public playInteract() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(960, now + 0.08);
      gain.gain.setValueAtTime(0.12 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch {}
  }

  public playNovaChirp() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.exponentialRampToValueAtTime(1250, now + 0.12);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.24);

      gain.gain.setValueAtTime(0.12 * this.sfxVolume, now);
      gain.gain.linearRampToValueAtTime(0.18 * this.sfxVolume, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1860, now);
      gain2.gain.setValueAtTime(0.04 * this.sfxVolume, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      osc2.connect(gain2);
      gain.connect(this.ctx.destination);
      gain2.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
      osc2.start(now);
      osc2.stop(now + 0.25);
    } catch {}
  }

  public playScanner() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.linearRampToValueAtTime(1100, now + 0.35);

      gain.gain.setValueAtTime(0.08 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    } catch {}
  }

  public playSonarPing() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Resonant fundamental ping
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.5);

      gain.gain.setValueAtTime(0.18 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.7);

      // High harmonic ripple echo
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1760, now + 0.04);
      osc2.frequency.linearRampToValueAtTime(2640, now + 0.25);
      gain2.gain.setValueAtTime(0.07 * this.sfxVolume, now + 0.04);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(now + 0.04);
      osc2.stop(now + 0.5);
    } catch {}
  }

  public playJetpackBoost() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const nBuffer = this.getNoiseBuffer();
      if (!nBuffer) return;

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = nBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(450, now);
      filter.frequency.linearRampToValueAtTime(950, now + 0.12);
      filter.Q.setValueAtTime(1.8, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.09 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      noiseSource.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noiseSource.start(now);
      noiseSource.stop(now + 0.25);

      // Low plasma thrum
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.linearRampToValueAtTime(160, now + 0.1);
      oscGain.gain.setValueAtTime(0.06 * this.sfxVolume, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch {}
  }

  public playNovaPurr() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Frequency-modulated purr vibration
      const carrier = this.ctx.createOscillator();
      const modulator = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();
      const masterGain = this.ctx.createGain();

      carrier.type = 'sine';
      carrier.frequency.setValueAtTime(130, now);
      carrier.frequency.linearRampToValueAtTime(175, now + 0.35);

      modulator.type = 'sine';
      modulator.frequency.setValueAtTime(24, now); // 24Hz purr rumble
      modGain.gain.setValueAtTime(40, now);

      modulator.connect(carrier.frequency);

      masterGain.gain.setValueAtTime(0.12 * this.sfxVolume, now);
      masterGain.gain.linearRampToValueAtTime(0.16 * this.sfxVolume, now + 0.2);
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      carrier.connect(masterGain);
      masterGain.connect(this.ctx.destination);

      modulator.start(now);
      carrier.start(now);
      modulator.stop(now + 0.6);
      carrier.stop(now + 0.6);

      // High sweet chirp at end
      const chirp = this.ctx.createOscillator();
      const chirpGain = this.ctx.createGain();
      chirp.type = 'sine';
      chirp.frequency.setValueAtTime(980, now + 0.25);
      chirp.frequency.exponentialRampToValueAtTime(1420, now + 0.45);
      chirpGain.gain.setValueAtTime(0.05 * this.sfxVolume, now + 0.25);
      chirpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      chirp.connect(chirpGain);
      chirpGain.connect(this.ctx.destination);
      chirp.start(now + 0.25);
      chirp.stop(now + 0.52);
    } catch {}
  }

  public playCollectSample() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // 3 sparkling crystal chimes: E6 (1318.5), G#6 (1661.2), B6 (1975.5)
      const notes = [1318.51, 1661.22, 1975.53];
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.12 * this.sfxVolume, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.45);
      });
    } catch {}
  }

  public playLandmarkDiscovery() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // 4-note resonant Martian discovery chord: C5 (523.25), E5 (659.25), G5 (783.99), B5 (987.77)
      const notes = [523.25, 659.25, 783.99, 987.77];
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        gain.gain.setValueAtTime(0.12 * this.sfxVolume, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.5);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.55);
      });
    } catch {}
  }

  public playPartCollected() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // 4-note ascending fanfare: F#5 (739.99), A5 (880), C#6 (1108.73), E6 (1318.51)
      const notes = [739.99, 880.00, 1108.73, 1318.51];
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.12 * this.sfxVolume, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.45);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.5);
      });
    } catch {}
  }

  public playRepairRatchet() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // 3 rapid ratcheting clicks
      [0, 0.05, 0.1].forEach((delay) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(950, now + delay);
        osc.frequency.exponentialRampToValueAtTime(320, now + delay + 0.03);
        gain.gain.setValueAtTime(0.08 * this.sfxVolume, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.035);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.04);
      });
    } catch {}
  }

  public playCountdownBeep(high = false) {
    if (this.isMuted || this.sfxVolume <= 0) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(high ? 1760 : 880, now);
      gain.gain.setValueAtTime(0.12 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    } catch {}
  }

  public playDiscovery() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);
        gain.gain.setValueAtTime(0.12 * this.sfxVolume, now + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.6);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.65);
      });
    } catch {}
  }

  public playSuccess() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const chords = [523.25, 659.25, 783.99, 1046.50];
      chords.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.1 * this.sfxVolume, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.5);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.55);
      });
    } catch {}
  }

  public playMistake() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(120, now + 0.2);
      gain.gain.setValueAtTime(0.08 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
    } catch {}
  }

  public playRumble() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(90, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.8);
      gain.gain.setValueAtTime(0.2 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 1.3);
    } catch {}
  }

  public playLaunchIgnition() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(60, now);
      osc1.frequency.exponentialRampToValueAtTime(320, now + 2.5);
      osc2.frequency.setValueAtTime(120, now);
      osc2.frequency.exponentialRampToValueAtTime(640, now + 2.5);

      gain.gain.setValueAtTime(0.05 * this.sfxVolume, now);
      gain.gain.linearRampToValueAtTime(0.25 * this.sfxVolume, now + 1.5);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 3.2);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc1.stop(now + 3.5);
      osc2.start(now);
      osc2.stop(now + 3.5);
    } catch {}
  }

  // ==========================================================================
  // DRONE AMBIENCE
  // ==========================================================================

  public startAmbience(type: 'space' | 'moon' | 'mars') {
    if (this.isMuted || this.musicVolume <= 0) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ambientOsc1) return;

      const now = this.ctx.currentTime;
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.001, now);
      this.ambientGain.gain.linearRampToValueAtTime(0.04 * this.musicVolume, now + 2.0);

      this.ambientOsc1 = this.ctx.createOscillator();
      this.ambientOsc2 = this.ctx.createOscillator();

      if (type === 'space') {
        this.ambientOsc1.frequency.setValueAtTime(110, now);
        this.ambientOsc2.frequency.setValueAtTime(164.81, now);
      } else if (type === 'moon') {
        this.ambientOsc1.frequency.setValueAtTime(98, now);
        this.ambientOsc2.frequency.setValueAtTime(146.83, now);
      } else {
        this.ambientOsc1.frequency.setValueAtTime(73.42, now);
        this.ambientOsc2.frequency.setValueAtTime(110, now);
      }

      this.ambientOsc1.type = 'sine';
      this.ambientOsc2.type = 'triangle';

      this.ambientOsc1.connect(this.ambientGain);
      this.ambientOsc2.connect(this.ambientGain);
      this.ambientGain.connect(this.ctx.destination);

      this.ambientOsc1.start();
      this.ambientOsc2.start();
    } catch {}
  }

  public stopAmbience() {
    try {
      if (this.ambientGain && this.ctx) {
        this.ambientGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
      }
      setTimeout(() => {
        if (this.ambientOsc1) {
          try { this.ambientOsc1.stop(); } catch {}
          this.ambientOsc1.disconnect();
          this.ambientOsc1 = null;
        }
        if (this.ambientOsc2) {
          try { this.ambientOsc2.stop(); } catch {}
          this.ambientOsc2.disconnect();
          this.ambientOsc2 = null;
        }
        this.ambientGain = null;
      }, 600);
    } catch {}
  }
}

export const sound = new SoundSystem();
