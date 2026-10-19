let enabled = false;
let context = null;
let master = null;
let active = false;
let generation = 0;
let starting = null;
let beatTimer = null;
let stopTimer = null;
const noteTimers = new Set();
const voices = new Map();
const notes = [220, 261.63, 293.66, 329.63, 261.63, 196, 293.66, 233.08];
let noteIndex = 0;

function setState(state) {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.dataset.musicState = state;
  }
}

function clearVoices() {
  for (const timer of noteTimers) clearTimeout(timer);
  noteTimers.clear();
  for (const [oscillator, gain] of voices) {
    try { oscillator.stop(); } catch {}
    try { oscillator.disconnect(); } catch {}
    try { gain.disconnect(); } catch {}
  }
  voices.clear();
}

function clearAudio() {
  if (beatTimer !== null) clearInterval(beatTimer);
  if (stopTimer !== null) clearTimeout(stopTimer);
  beatTimer = stopTimer = null;
  clearVoices();
  if (master) {
    try { master.disconnect(); } catch {}
    master = null;
  }
  active = false;
}

function playNote() {
  if (!active || !context || !master) return;
  const now = context.currentTime;
  const duration = noteIndex % 4 === 2 ? 0.62 : 0.38;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(notes[noteIndex++ % notes.length], now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.035);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(master);
  voices.set(oscillator, gain);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
  const timer = setTimeout(() => {
    noteTimers.delete(timer);
    voices.delete(oscillator);
    try { oscillator.disconnect(); } catch {}
    try { gain.disconnect(); } catch {}
  }, (duration + 0.08) * 1000);
  noteTimers.add(timer);
}

export function startMusic() {
  if (!enabled) {
    setState('stopped');
    return Promise.resolve();
  }
  if (active) return Promise.resolve();
  if (starting) return starting;

  const request = ++generation;
  starting = (async () => {
    try {
      if (!context) {
        const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioContextClass) throw new Error('Web Audio is unavailable');
        context = new AudioContextClass();
      }
      if (context.state !== 'running') await context.resume();
      if (request !== generation || !enabled) return;

      master = context.createGain();
      master.gain.setValueAtTime(0.03, context.currentTime);
      master.connect(context.destination);
      noteIndex = 0;
      active = true;
      setState('playing');
      playNote();
      beatTimer = setInterval(playNote, 720);
    } catch (error) {
      if (request === generation) {
        clearAudio();
        setState('stopped');
      }
      return;
    }
  })().finally(() => {
    if (request === generation) starting = null;
  });
  return starting;
}

export function stopMusic(immediate = false) {
  ++generation;
  starting = null;
  setState('stopped');
  if (beatTimer !== null) clearInterval(beatTimer);
  beatTimer = null;
  if (stopTimer !== null) clearTimeout(stopTimer);
  stopTimer = null;

  if (immediate || !master || !context || !active) {
    clearAudio();
    return;
  }

  const now = context.currentTime;
  const gain = master.gain;
  gain.cancelScheduledValues(now);
  gain.setValueAtTime(gain.value, now);
  gain.linearRampToValueAtTime(0, now + 0.2);
  stopTimer = setTimeout(clearAudio, 220);
}

export function setMusicEnabled(value) {
  enabled = Boolean(value);
  if (!enabled) stopMusic(true);
}
