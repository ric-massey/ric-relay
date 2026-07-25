/* ══════════════════════════════════════════════════════════════════════
   audio.js — the same pattern farlight already uses in this repo:
   a lazily created AudioContext on first gesture, a hum, and an `m` mute
   toggle. (projects/farlight/index.html — reused rather than reinvented.)

   The one change worth making is what the hum tracks. Not throttle
   position — γ. Pitch rises with the logarithm of the Lorentz factor, so
   you can hear time dilation climb even when the throttle has not moved,
   and it keeps rising through five orders of magnitude without ever
   running out of octaves.

   Layered under it: interstellar medium hiss, whose loudness follows the
   real proton flux. Inside the Local Bubble at 0.05 atoms/cm³ it is close
   to silence. Outside, at 1/cm³, it is a roar — because that is a twenty
   times denser beam of hydrogen hitting the hull.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";
  const SF = (window.SF ||= {});

  let AC = null;
  let hum = null, humGain = null, humFilter = null;
  let hiss = null, hissGain = null, hissFilter = null;
  let started = false;

  function makeNoiseBuffer(ctx) {
    const seconds = 2;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  const Audio = SF.audio = {
    enabled: false,

    init() {
      if (AC) return true;
      try {
        AC = new (window.AudioContext || window.webkitAudioContext)();

        hum = AC.createOscillator();
        hum.type = "sawtooth";
        hum.frequency.value = 58;
        humFilter = AC.createBiquadFilter();
        humFilter.type = "lowpass";
        humFilter.frequency.value = 380;
        humGain = AC.createGain();
        humGain.gain.value = 0;
        hum.connect(humFilter); humFilter.connect(humGain); humGain.connect(AC.destination);
        hum.start();

        hiss = AC.createBufferSource();
        hiss.buffer = makeNoiseBuffer(AC);
        hiss.loop = true;
        hissFilter = AC.createBiquadFilter();
        hissFilter.type = "bandpass";
        hissFilter.frequency.value = 2400;
        hissFilter.Q.value = 0.6;
        hissGain = AC.createGain();
        hissGain.gain.value = 0;
        hiss.connect(hissFilter); hissFilter.connect(hissGain); hissGain.connect(AC.destination);
        hiss.start();

        started = true;
        return true;
      } catch (error) {
        AC = null;
        return false;
      }
    },

    toggle() {
      if (!AC && !Audio.init()) return false;
      Audio.enabled = !Audio.enabled;
      if (AC.state === "suspended") AC.resume();
      if (!Audio.enabled && humGain) {
        humGain.gain.setTargetAtTime(0, AC.currentTime, 0.05);
        hissGain.gain.setTargetAtTime(0, AC.currentTime, 0.05);
      }
      return Audio.enabled;
    },

    resume() {
      if (AC && AC.state === "suspended") AC.resume();
    },

    /**
     * @param gamma   Lorentz factor — sets pitch.
     * @param throttle 0..1 — sets the engine's loudness.
     * @param ismLoad  proton power on the hull, normalised: sets the hiss.
     */
    update(gamma, throttle, ismLoad) {
      if (!started || !Audio.enabled || !AC) return;
      const t = AC.currentTime;
      // Two octaves per decade of γ: γ = 1 → 55 Hz, γ = 10⁶ → about 3.5 kHz,
      // which is a long, continuous climb rather than a wall.
      const pitch = 55 * Math.pow(2, Math.log10(Math.max(1, gamma)) * 2);
      hum.frequency.setTargetAtTime(Math.min(4200, pitch), t, 0.08);
      humFilter.frequency.setTargetAtTime(Math.min(6000, 320 + pitch * 2.4), t, 0.1);
      humGain.gain.setTargetAtTime(0.018 + throttle * 0.05, t, 0.12);

      const load = Math.max(0, Math.min(1, ismLoad));
      hissGain.gain.setTargetAtTime(load * 0.12, t, 0.18);
      hissFilter.frequency.setTargetAtTime(900 + load * 5200, t, 0.2);
    },

    /** One-shot tone: milestones, near-misses, the crash. */
    blip(freq, duration, type = "sine", volume = 0.1) {
      if (!AC || !Audio.enabled) return;
      try {
        const osc = AC.createOscillator();
        const gain = AC.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.value = 0;
        osc.connect(gain); gain.connect(AC.destination);
        const t = AC.currentTime;
        gain.gain.linearRampToValueAtTime(volume, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        osc.start(t);
        osc.stop(t + duration + 0.02);
      } catch (error) { /* audio is decoration; never let it break the game */ }
    },

    /** The near-miss whoosh: a filtered noise burst that sweeps past. */
    whoosh(intensity = 1) {
      if (!AC || !Audio.enabled) return;
      try {
        const source = AC.createBufferSource();
        source.buffer = makeNoiseBuffer(AC);
        const filter = AC.createBiquadFilter();
        filter.type = "bandpass";
        filter.Q.value = 1.4;
        const gain = AC.createGain();
        source.connect(filter); filter.connect(gain); gain.connect(AC.destination);
        const t = AC.currentTime;
        filter.frequency.setValueAtTime(340, t);
        filter.frequency.exponentialRampToValueAtTime(2600, t + 0.28);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.13 * intensity, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
        source.start(t);
        source.stop(t + 0.5);
      } catch (error) { /* ignore */ }
    },

    stop() {
      if (!AC) return;
      humGain?.gain.setTargetAtTime(0, AC.currentTime, 0.05);
      hissGain?.gain.setTargetAtTime(0, AC.currentTime, 0.05);
    },
  };
})();
