// sound.js - Web Audio API Sound Synthesizer (No external audio files needed)
class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.hurryUpAudio = null;
    this.isHurryUpMyTurn = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.hurryUpAudio) {
      this.hurryUpAudio.volume = this.muted ? 0 : (this.isHurryUpMyTurn ? 0.75 : 0.18);
    }
    return this.muted;
  }

  // Card slide / draw sound
  playDraw() {
    if (this.muted) return;
    if (this.lastDrawTime && Date.now() - this.lastDrawTime < 60) return;
    this.lastDrawTime = Date.now();
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.12);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.12);
    } catch {
      // AudioContext error handling
    }
  }

  // Card play / snap sound
  playCard() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(440, t);
      osc1.frequency.exponentialRampToValueAtTime(220, t + 0.08);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(180, t);
      osc2.frequency.exponentialRampToValueAtTime(60, t + 0.08);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.09);
      osc2.stop(t + 0.09);
    } catch {
      // AudioContext error handling
    }
  }

  // Action card sound (Skip, Reverse, +2)
  playAction() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, t); // C5
      osc.frequency.setValueAtTime(659.25, t + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, t + 0.16); // G5

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.3);
    } catch {
      // AudioContext error handling
    }
  }

  // Distinct "WHOOSH-BUZZ / DENIED" Skip sound
  playSkip() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(520, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.28);

      gain.gain.setValueAtTime(0.26, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.28);
    } catch {
      // AudioContext error handling
    }
  }

  // Wild Card change color chime
  playWild() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + idx * 0.06);

        gain.gain.setValueAtTime(0.18, t + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.06 + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t + idx * 0.06);
        osc.stop(t + idx * 0.06 + 0.25);
      });
    } catch {
      // AudioContext error handling
    }
  }

  // Dramatic "UNO!" alert
  playUno() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      [440, 554.37, 659.25, 880].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t + idx * 0.05);

        gain.gain.setValueAtTime(0.22, t + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.05 + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t + idx * 0.05);
        osc.stop(t + idx * 0.05 + 0.35);
      });
    } catch {
      // AudioContext error handling
    }
  }

  // Penalty / Caught sound
  playPenalty() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.setValueAtTime(120, t + 0.15);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.4);
    } catch {
      // AudioContext error handling
    }
  }

  // Player turn notification
  playTurn() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(1174.66, t + 0.1);

      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.18);
    } catch {
      // AudioContext error handling
    }
  }

  // Victory fanfare
  playVictory() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const notes = [523.25, 523.25, 523.25, 659.25, 783.99, 1046.5];
      const times = [0, 0.12, 0.24, 0.36, 0.48, 0.65];
      const durs = [0.1, 0.1, 0.1, 0.1, 0.15, 0.6];

      const t = this.ctx.currentTime;
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + times[i]);

        gain.gain.setValueAtTime(0.25, t + times[i]);
        gain.gain.exponentialRampToValueAtTime(0.001, t + times[i] + durs[i]);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t + times[i]);
        osc.stop(t + times[i] + durs[i]);
      });
    } catch {
      // AudioContext error handling
    }
  }

  // Fast dealing card sound with pitch stepping
  playDeal(step = 0) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const baseFreq = 260 + (step % 7) * 35;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, t);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, t + 0.08);

      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.08);
    } catch {
      // AudioContext error handling
    }
  }

  // Card shuffle / fanning flutter sound
  playShuffle() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      for (let i = 0; i < 6; i++) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        const delay = i * 0.045;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(380 + i * 40, t + delay);
        osc.frequency.exponentialRampToValueAtTime(160, t + delay + 0.07);

        gain.gain.setValueAtTime(0.12, t + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.07);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t + delay);
        osc.stop(t + delay + 0.07);
      }
    } catch {
      // AudioContext error handling
    }
  }

  // Subtle countdown tick sound
  playTick() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(400, t + 0.04);

      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.04);
    } catch {
      // AudioContext error handling
    }
  }

  // Rabbids Hurry Up: Toothless Dancing Meme BGM with Dynamic Proximity Volume
  playHurryUpBgm(isMyTurn = false) {
    this.isHurryUpMyTurn = isMyTurn;
    const targetVolume = this.muted ? 0 : (isMyTurn ? 0.75 : 0.18);

    if (this.hurryUpAudio) {
      this.hurryUpAudio.volume = targetVolume;
      if (this.hurryUpAudio.paused && !this.muted) {
        this.hurryUpAudio.play().catch(() => {
          const retryOnInteraction = () => {
            if (this.hurryUpAudio && this.hurryUpAudio.paused && !this.muted) {
              this.hurryUpAudio.play().catch(() => {});
            }
            window.removeEventListener('click', retryOnInteraction);
            window.removeEventListener('keydown', retryOnInteraction);
          };
          window.addEventListener('click', retryOnInteraction, { once: true });
          window.addEventListener('keydown', retryOnInteraction, { once: true });
        });
      }
      return;
    }

    try {
      const audio = new Audio('/cards_rabbids/effects/hurry_up/toothless-dancing.mp3');
      audio.loop = true;
      audio.volume = targetVolume;
      audio.onerror = () => {
        audio.src = '/cards_rabbids/effects/hurry_up/' + encodeURIComponent('Toothless Dancing Meme [NEW VARIATIONS] - Cas van de Pol.mp3');
        audio.play().catch(() => {});
      };

      this.hurryUpAudio = audio;
      audio.play().catch(() => {
        const retryOnInteraction = () => {
          if (this.hurryUpAudio && this.hurryUpAudio.paused && !this.muted) {
            this.hurryUpAudio.play().catch(() => {});
          }
          window.removeEventListener('click', retryOnInteraction);
          window.removeEventListener('keydown', retryOnInteraction);
        };
        window.addEventListener('click', retryOnInteraction, { once: true });
        window.addEventListener('keydown', retryOnInteraction, { once: true });
      });
    } catch {
      // Audio error handling
    }
  }

  setHurryUpTurn(isMyTurn = false) {
    this.isHurryUpMyTurn = isMyTurn;
    if (this.hurryUpAudio) {
      this.hurryUpAudio.volume = this.muted ? 0 : (isMyTurn ? 0.75 : 0.18);
    }
  }

  stopHurryUpBgm() {
    if (this.hurryUpAudio) {
      try {
        this.hurryUpAudio.pause();
        this.hurryUpAudio.currentTime = 0;
      } catch {}
      this.hurryUpAudio = null;
    }
  }
}

export const soundManager = new SoundManager();
