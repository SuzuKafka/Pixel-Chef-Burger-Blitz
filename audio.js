// Tiny Web Audio engine for Pixel Chef: Burger Blitz
(() => {
  const engine = {
    ctx: null,
    master: null,
    gain: 0.6,
    maxGain: 1.0,
    muted: false,
    ensure() {
      if (!this.ctx) {
        try {
          this.ctx = new (window.AudioContext || window.webkitAudioContext)();
          this.master = this.ctx.createGain();
          this.master.gain.value = this.muted ? 0 : this.gain;
          this.master.connect(this.ctx.destination);
        } catch (e) { /* no-op */ }
      } else if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    },
    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.value = m ? 0 : this.gain;
      try { localStorage.setItem('pcbb_audio_muted', m ? '1' : '0'); } catch {}
    },
    setVolume(v) { // v: 0..1
      this.gain = Math.max(0, Math.min(1, v)) * this.maxGain;
      if (!this.muted && this.master) this.master.gain.value = this.gain;
      try { localStorage.setItem('pcbb_audio_volume', String(Math.max(0, Math.min(1, v)))); } catch {}
    },
    tone(freq, durMs, type='triangle', g) {
      if (!this.ctx) return;
      if (g == null) g = this.gain;
      const now = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const amp = this.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      amp.gain.setValueAtTime(0, now);
      amp.gain.linearRampToValueAtTime(g, now + 0.01);
      amp.gain.linearRampToValueAtTime(0.0001, now + durMs/1000);
      o.connect(amp).connect(this.master);
      o.start(now); o.stop(now + durMs/1000 + 0.02);
    },
    sweep(f0, f1, durMs, type='square', g) {
      if (!this.ctx) return;
      if (g == null) g = this.gain * 0.9;
      const now = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const amp = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, now);
      o.frequency.linearRampToValueAtTime(f1, now + durMs/1000);
      amp.gain.setValueAtTime(0, now);
      amp.gain.linearRampToValueAtTime(g, now + 0.01);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + durMs/1000);
      o.connect(amp).connect(this.master);
      o.start(now); o.stop(now + durMs/1000 + 0.02);
    },
    arp(freqs, noteMs=120, type='sine', g) {
      if (!this.ctx) return;
      if (g == null) g = this.gain * 0.8;
      const now = this.ctx.currentTime;
      freqs.forEach((f, i) => {
        const t = now + (i*noteMs)/1000;
        const o = this.ctx.createOscillator();
        const amp = this.ctx.createGain();
        o.type = type; o.frequency.value = f;
        amp.gain.setValueAtTime(0, t);
        amp.gain.linearRampToValueAtTime(g, t + 0.01);
        amp.gain.linearRampToValueAtTime(0.0001, t + noteMs/1000);
        o.connect(amp).connect(this.master);
        o.start(t); o.stop(t + noteMs/1000 + 0.02);
      });
    }
  };

  // Try to resume on first user interaction on stubborn browsers
  const resumeIfNeeded = () => { engine.ensure(); window.removeEventListener('pointerdown', resumeIfNeeded); window.removeEventListener('keydown', resumeIfNeeded); };
  window.addEventListener('pointerdown', resumeIfNeeded, { once: true });
  window.addEventListener('keydown', resumeIfNeeded, { once: true });

  // Load persisted settings
  try {
    const m = localStorage.getItem('pcbb_audio_muted');
    if (m === '1') engine.muted = true;
    const v = parseFloat(localStorage.getItem('pcbb_audio_volume'));
    if (!isNaN(v)) engine.gain = Math.max(0, Math.min(1, v)) * engine.maxGain;
  } catch {}

  window.audioEngine = engine;
})();
