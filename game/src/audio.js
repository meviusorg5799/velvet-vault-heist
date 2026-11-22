// Sound: tiny WebAudio blips only — no audio files, nothing fetched.
// A soft click for a grab, a rising tone as suspicion grows, a low alarm pulse.
export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context) return context;
    try {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      context = Ctor ? new Ctor() : null;
    } catch {
      context = null;
    }
    return context;
  }

  /** One short tone: frequency, seconds, shape, volume. */
  function blip(freq, seconds, type, volume) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + seconds);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + seconds);
    } catch {
      // Audio is decoration: never let it break the game.
    }
  }

  return {
    grab() {
      blip(880, 0.12, 'sine', 0.12);
      setTimeout(() => blip(1318, 0.14, 'sine', 0.1), 70);
    },
    spotted() {
      blip(196, 0.25, 'square', 0.07);
    },
    lockdown() {
      blip(110, 0.5, 'sawtooth', 0.1);
      setTimeout(() => blip(110, 0.5, 'sawtooth', 0.1), 220);
    },
    smoke() {
      blip(320, 0.3, 'sine', 0.08);
    },
    emp() {
      blip(1200, 0.08, 'square', 0.06);
      setTimeout(() => blip(500, 0.2, 'square', 0.06), 80);
    },
    unlock() {
      blip(523, 0.1, 'triangle', 0.1);
      setTimeout(() => blip(784, 0.16, 'triangle', 0.1), 90);
    },
    wing() {
      blip(523, 0.12, 'triangle', 0.1);
      setTimeout(() => blip(659, 0.12, 'triangle', 0.1), 110);
      setTimeout(() => blip(784, 0.2, 'triangle', 0.1), 220);
    },
    win() {
      [523, 659, 784, 1046].forEach((freq, i) => setTimeout(() => blip(freq, 0.25, 'triangle', 0.11), i * 130));
    },
    busted() {
      blip(220, 0.4, 'sawtooth', 0.1);
      setTimeout(() => blip(165, 0.6, 'sawtooth', 0.1), 180);
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
  };
}
