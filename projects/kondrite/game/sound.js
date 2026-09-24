"use strict";

/* KONDRITE — SOUND
   ─────────────────────────────────────────────────────────────────────────────
   The synthesised sound engine: how loud, which dial, the compressor and the
   limiter. sounds/listen.html lifts this file at load, so its section
   markers are load-bearing.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

function audioUnlock() {
  if (!soundEnabled) return null;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return null;
  if (!audioCtx) {
    audioCtx = new Audio();
    audioMaster = audioCtx.createGain();
    audioMaster.gain.value = MASTER_GAIN * audioVol.master;
    /* A war on screen can put a dozen sounds on one frame. The compressor is
       what keeps that loud rather than painful. */
    if (typeof audioCtx.createDynamicsCompressor === "function") {
      const squash = audioCtx.createDynamicsCompressor();
      squash.threshold.value = -18; squash.ratio.value = 6;
      audioMaster.connect(squash); squash.connect(audioCtx.destination);
    } else {
      audioMaster.connect(audioCtx.destination);
    }
    loadLasers();
  }
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
}

/* ── how loud, and which dial ─────────────────────────────────────────────
   Every sound belongs to one of four channels, each with its own volume in
   SETTINGS → AUDIO under a master. A sound with no place in the world is
   INTERFACE whatever it is — a "hit" that means you cannot afford it is a
   menu noise, not a collision. */
const AUDIO_STORE = "kondrite.audio.v1";
const AUDIO_CHANNELS = [
  { key: "weapons", name: "WEAPONS" },
  { key: "impacts", name: "IMPACTS" },
  { key: "ship",    name: "SHIP & GADGETS" },
  { key: "ui",      name: "INTERFACE" }
];
const SFX_CHANNEL = {
  laser: "weapons", beam: "weapons", scatter: "weapons", seeker: "weapons",
  lance: "weapons", shot: "weapons",
  hit: "impacts", rock: "impacts", boom: "impacts", tink: "impacts",
  fizz: "impacts", explode: "impacts",
  warp: "ship", thrust: "ship", pickup: "ship",
  start: "ui", win: "ui", lose: "ui"
};
const VOLUME_STEPS = [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1];
const audioVol = { master: 0.85, weapons: 0.85, impacts: 0.85, ship: 0.85, ui: 0.85 };
try {
  const saved = JSON.parse(localStorage.getItem(AUDIO_STORE) || "null");
  if (saved && typeof saved === "object") {
    for (const k of Object.keys(audioVol)) {
      if (typeof saved[k] === "number" && saved[k] >= 0 && saved[k] <= 1) audioVol[k] = saved[k];
    }
  }
} catch (_) {}
const MASTER_GAIN = 0.24;
function applyVolume() {
  if (audioMaster) audioMaster.gain.value = soundEnabled ? MASTER_GAIN * audioVol.master : 0;
}
function setVolume(key, v) {
  audioVol[key] = Math.max(0, Math.min(1, v));
  try { localStorage.setItem(AUDIO_STORE, JSON.stringify(audioVol)); } catch (_) {}
  applyVolume();
}

/* ── not annoying ─────────────────────────────────────────────────────────
   What makes game sound grating is rarely one sound. It is the same sound,
   identical, forty times a minute — and five of them landing on one frame.
   So, measured with test/sounds.js rather than asserted:

     · Nothing repeats exactly. Every in-world sound is nudged up to 5% in
       pitch and 15% in level, which is the difference between a machine gun
       and a stuck record. The jingles are left alone: they are tunes.
     · The same sound twice inside 35ms plays once. Six bots on one frame is
       one volley, not a spike six times as loud.
     · Noise is filtered. Raw white noise put over half of every impact's
       energy above 5 kHz, which is hiss, not a hit.
     · The variation has its own generator, so a sound never takes a number
       out of Math.random that the game was going to use. */
let sfxScale = 1, sfxPitch = 1;
let sfxSeed = 0x2f6b66;
const sfxRand = () => {
  sfxSeed = (sfxSeed * 1664525 + 1013904223) >>> 0;
  return sfxSeed / 4294967296;
};
const sfxLast = {};
const SFX_GAP = 0.035;
const SFX_STILL = { start: true, win: true, lose: true };

function soundOutput(pan, gain) {
  const g = audioCtx.createGain();
  g.gain.value = gain;
  if (typeof audioCtx.createStereoPanner === "function") {
    const p = audioCtx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan || 0));
    g.connect(p); p.connect(audioMaster);
  } else {
    g.connect(audioMaster);
  }
  return g;
}

function soundTone(freq, endFreq, duration, gain, type, pan, delay) {
  if (!audioUnlock()) return;
  gain *= sfxScale;
  if (gain <= 0) return;
  freq *= sfxPitch; endFreq = (endFreq || freq / sfxPitch) * sfxPitch;
  const now = audioCtx.currentTime + (delay || 0);
  const osc = audioCtx.createOscillator();
  const out = soundOutput(pan, gain);
  osc.type = type || "square";
  osc.frequency.setValueAtTime(Math.max(20, freq), now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
  out.gain.setValueAtTime(gain, now);
  out.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(out); osc.start(now); osc.stop(now + duration + 0.02);
}

// `cutoff` is where the hiss stops: a low one is a thud, a high one a crackle.
function soundNoise(duration, gain, pan, cutoff) {
  if (!audioUnlock()) return;
  gain *= sfxScale;
  if (gain <= 0) return;
  if (!audioNoise) {
    audioNoise = audioCtx.createBuffer(1, Math.ceil(audioCtx.sampleRate * 0.45),
                                       audioCtx.sampleRate);
    const data = audioNoise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const now = audioCtx.currentTime;
  const src = audioCtx.createBufferSource();
  const out = soundOutput(pan, gain);
  src.buffer = audioNoise;
  src.playbackRate.value = sfxPitch;
  out.gain.setValueAtTime(gain, now);
  out.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  if (cutoff && typeof audioCtx.createBiquadFilter === "function") {
    const lp = audioCtx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = cutoff * sfxPitch;
    lp.Q.value = 0.7;
    src.connect(lp); lp.connect(out);
  } else {
    src.connect(out);
  }
  src.start(now); src.stop(now + duration);
}

/* The guns are recorded sounds rather than oscillators: five .wav files made
   by `sounds/make-lasers.py` (standard library only — run it again to change
   them). One file per kind of gun, so you can hear what just fired at you.

   They are fetched, and a page opened straight off disk cannot fetch — so each
   gun keeps a synthesised voice underneath (`fallback`), and until a file has
   decoded, or if it never does, that is what plays. The game is never silent
   for want of a file. `gain` is matched to the level of the synth voices
   around it, not tuned by listening — change it freely: the cannon fires
   constantly and stays small, the lance fires every few seconds and gets to
   be the loudest thing on screen. */
const LASERS = {
  laser:   { file: "sounds/laser-cannon.wav",  gain: 0.075, fallback: "shot" },
  beam:    { file: "sounds/laser-beam.wav",    gain: 0.07,  fallback: "shot" },
  scatter: { file: "sounds/laser-scatter.wav", gain: 0.085, fallback: "shot" },
  seeker:  { file: "sounds/laser-seeker.wav",  gain: 0.1,   fallback: "shot" },
  lance:   { file: "sounds/laser-lance.wav",   gain: 0.16,  fallback: "hit" }
};
const laserBuffers = {};
let lasersAsked = false;
function loadLasers() {
  if (lasersAsked || typeof fetch !== "function") return;
  lasersAsked = true;
  // Off disk a fetch cannot work and says so in red, once per file. Don't ask.
  if (location.protocol === "file:") return;
  for (const [kind, l] of Object.entries(LASERS)) {
    fetch(l.file)
      .then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status))
      // The callback form: Safari before 14.1 has no promise from this.
      .then(bytes => new Promise((ok, no) => audioCtx.decodeAudioData(bytes, ok, no)))
      .then(buf => { laserBuffers[kind] = buf; })
      .catch(() => {});
  }
}

function soundSample(buf, gain, pan) {
  gain *= sfxScale;
  if (gain <= 0) return;
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = sfxPitch;
  src.connect(soundOutput(pan, gain));
  src.start();
}

/* `where` is false for a sound with no place in the world, which files it
   under INTERFACE whatever kind it is. */
function playSfx(kind, pan, where) {
  if (!soundEnabled || !audioUnlock()) return;
  const now = audioCtx.currentTime;
  if (sfxLast[kind] != null && now - sfxLast[kind] < SFX_GAP && now >= sfxLast[kind]) return;
  sfxLast[kind] = now;
  const channel = where === false ? "ui" : (SFX_CHANNEL[kind] || "impacts");
  sfxScale = audioVol[channel] == null ? 1 : audioVol[channel];
  if (sfxScale <= 0) return;
  if (SFX_STILL[kind]) sfxPitch = 1;
  else { sfxPitch = 0.95 + sfxRand() * 0.1; sfxScale *= 0.85 + sfxRand() * 0.15; }
  try { sfxVoice(kind, pan); } finally { sfxScale = 1; sfxPitch = 1; }
}

function sfxVoice(kind, pan) {
  const laser = LASERS[kind];
  if (laser) {
    if (laserBuffers[kind]) { soundSample(laserBuffers[kind], laser.gain, pan); return; }
    kind = laser.fallback;
  }
  if (kind === "shot") soundTone(210, 75, 0.07, 0.05, "square", pan);
  else if (kind === "hit") {
    soundNoise(0.09, 0.05, pan, 3400); soundTone(180, 90, 0.11, 0.045, "triangle", pan);
  } else if (kind === "rock") {
    // Mining: the commonest sound in Survey. A dull crunch, not a hiss.
    soundNoise(0.12, 0.055, pan, 2600); soundTone(150, 72, 0.13, 0.04, "triangle", pan);
  } else if (kind === "boom") {
    // A burst charge or a ship going up: lower and shorter than your own death.
    soundNoise(0.28, 0.11, pan, 2000); soundTone(90, 38, 0.3, 0.07, "triangle", pan);
  } else if (kind === "tink") {
    // A round stopping against something that is not a ship. Plays for most
    // misses, so it is the smallest sound in the game.
    soundTone(900, 520, 0.04, 0.016, "triangle", pan);
  } else if (kind === "fizz") {
    // Something small running out: a mine, a decoy, a drone's time.
    soundNoise(0.08, 0.03, pan, 3400); soundTone(520, 180, 0.09, 0.022, "triangle", pan);
  } else if (kind === "warp") {
    soundNoise(0.4, 0.055, pan, 2800);
    soundTone(90, 700, 0.35, 0.04, "sawtooth", pan);
    soundTone(900, 300, 0.3, 0.03, "triangle", pan, 0.25);
  } else if (kind === "thrust") {
    soundNoise(0.16, 0.055, pan, 1500); soundTone(70, 140, 0.16, 0.03, "triangle", pan);
  } else if (kind === "pickup") {
    // Ore into the hold. One soft note off a pentatonic, so a run of them is
    // a little tune rather than the same blip.
    const PENTA = [523, 587, 659, 784, 880];
    const f = PENTA[Math.floor(sfxRand() * PENTA.length)];
    soundTone(f, f, 0.07, 0.022, "sine", pan);
  } else if (kind === "explode") {
    soundNoise(0.34, 0.14, pan, 2200); soundTone(105, 32, 0.38, 0.085, "triangle", pan);
  } else if (kind === "start") {
    soundTone(220, 220, 0.11, 0.045, "triangle", 0, 0);
    soundTone(330, 330, 0.11, 0.045, "triangle", 0, 0.1);
    soundTone(440, 440, 0.16, 0.055, "triangle", 0, 0.2);
  } else if (kind === "win") {
    soundTone(330, 440, 0.18, 0.06, "triangle", 0, 0);
    soundTone(440, 660, 0.24, 0.07, "triangle", 0, 0.16);
  } else if (kind === "lose") {
    soundTone(220, 110, 0.28, 0.06, "triangle", 0, 0);
    soundTone(140, 55, 0.34, 0.055, "triangle", 0, 0.2);
  }
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  try { localStorage.setItem(SOUND_STORE, soundEnabled ? "on" : "off"); } catch (_) {}
  applyVolume();
  if (soundEnabled) { audioUnlock(); playSfx("start", 0, false); }
}

const fullscreenElement = () =>
  document.fullscreenElement || document.webkitFullscreenElement || null;
const fullscreenSupported = () => !!(
  document.fullscreenEnabled || document.documentElement.requestFullscreen ||
  document.documentElement.webkitRequestFullscreen
);
const fullscreenLabel = () => fullscreenElement() ? "EXIT FULLSCREEN" : "FULLSCREEN";

/* Set when the player leaves fullscreen using the button. Asking again after
   that is nagging, and a game that keeps grabbing the whole screen back is a
   game people close. Leaving by the system gesture or the Escape key does not
   set it, because that is as often a mis-swipe as a decision. */
let fullscreenOptOut = false;

function toggleFullscreen() {
  const leaving = fullscreenElement();
  if (leaving) fullscreenOptOut = true;
  const action = leaving
    ? (document.exitFullscreen || document.webkitExitFullscreen)
    : (document.documentElement.requestFullscreen ||
       document.documentElement.webkitRequestFullscreen);
  if (!action) return;
  try {
    const result = action.call(leaving ? document : document.documentElement);
    if (result && typeof result.catch === "function") result.catch(() => {});
  } catch (_) {}
}

/* Going fullscreen for a match, on a phone, without being asked.

   A browser only grants this inside a user gesture, and the tap that starts a
   match is one — so this has to be called straight out of `startGame` and not
   from anything deferred, or the request is refused and nothing says why.

   On an iPhone there is no Fullscreen API at all (Safari only ever offered it
   for video), so this quietly does nothing there and the layout does the work
   instead: `100dvh`, `viewport-fit=cover` and the safe-area insets are what
   make the game reach the edges of the glass on iOS. Everywhere else — Android
   Chrome, Firefox, an iPad — this is the real thing. */
function enterPlayFullscreen() {
  if (fullscreenOptOut || fullscreenElement()) return;
  if (!document.body.classList.contains("touch")) return;
  const req = document.documentElement.requestFullscreen ||
              document.documentElement.webkitRequestFullscreen;
  if (!req) return;
  try {
    const result = req.call(document.documentElement, { navigationUI: "hide" });
    if (result && typeof result.catch === "function") result.catch(() => {});
  } catch (_) { /* refused outside a gesture, or not allowed here */ }
}

addEventListener("pointerdown", audioUnlock, { passive: true });
