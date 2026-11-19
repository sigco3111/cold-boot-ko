/**
 * Stage 3c "초소 4" (technical level 5; plan docs/plans/stage-3c.md §5.5, §8.11, §11 W2b): the navy post, its scares,
 * the taken soldiers' weapons, the sub bay, the keypad, the radio, the flashlight cell running flat (all levels).
 *
 * Owners (§8.11, D25 — the owner is who PLAYS it; audio only renders):
 *   level vignettes   turnstile_click counter_tick hull_groan_long locker_rattle helmet_roll radio_on_click radio_static_bed
 *                     pump_thump tray_crash cutlery_scatter fan_start fan_loop hook_creak water_hammer taps_run drain_gurgle
 *                     bulb_pop glass_tinkle sub_ballast_hiss sub_hatch_clang clamp_cycle sub_systems_hum hatch_unlatch
 *                     hatch_open lights_out_dock wheel_crank hydraulic_release keypad_power_on booth_door_shut
 *   door d5_gate      gate_open_heavy gate_close_heavy
 *   enemies           soldier_pistol_fire soldier_carbine_fire soldier_aim_click soldier_light_on soldier_reload
 *                     bullet_whiz bullet_crack soldier_hit_vest soldier_fall clasp_fail
 *                     (soldier_step: audio itself on `enemy:step`, surface by position; soldier_fire_tail: audio itself,
 *                     once per burst after a soldier_*_fire)
 *   UI                keypad_beep keypad_err keypad_ok keypad_dead
 *   story             radio_squawk
 *   audio itself      flashlight_die flashlight_dead (player:flashlight cause empty / refused, every level), step_wet,
 *                     beds amb_post amb_berth amb_crawl amb_bay amb_dark
 *
 * The scares (§5.5) are built to startle: a real transient (click + broadband burst within the first millisecond), a
 * physical body (thump, plate / tube / tray modes), the mechanism's own detail, and a short room baked in (early
 * reflections + a small feedback diffuser) under the engine's room IR. Positional, mono.
 *
 * Pre-render: arrival sounds `load` (level 5 only, engine.preload honours `levels`), combat / beds / first-room sounds
 * `idle`, the rest `late`, loops `lazy` — all `levels: [5]` except the flashlight sounds (every level, `load`).
 * Loops: every periodic component has a whole number of cycles in the loop (f × dur ∈ ℕ).
 */
import { SR, crackleData, type SoundDef, type Synth } from '../synth/core';
import { saturate } from '../synth/post';
import { clack, scrape } from './weapons';
import { clunk, crackle, hiss, servo } from './world';

const L5 = [5] as const;
/** Rendered span of a loop: the loop plus the crossfade tail (render.ts LOOP_XF ≤ 0.6). */
const LP = (d: number) => d + 0.7;

function drone(s: Synth, type: OscillatorType, f: number, dur: number, level: number, ...chain: AudioNode[]): OscillatorNode {
  const o = s.osc(type, f, 0, dur);
  s.chain(o, ...chain, s.gain(level), s.out);
  return o;
}

/** Noise bed; optional amplitude LFO at a FIXED rate (rate × loop length ∈ ℕ). */
function bed(s: Synth, color: 'white' | 'pink' | 'brown', dur: number, level: number, lfo: number, depth: number, ...chain: AudioNode[]): void {
  const n = s.noise(color, 0, dur);
  const g = s.gain(level);
  if (lfo > 0 && depth > 0) {
    const l = s.osc('sine', lfo, 0, dur);
    const lg = s.gain(level * depth);
    l.connect(lg); lg.connect(g.gain);
  }
  s.chain(n, ...chain, g, s.out);
}

function metal(s: Synth, t: number, f0: number, level: number, ring: number, dst?: AudioNode): void {
  s.modal({ start: t, level, modes: s.modes(f0, [1, 2.13, 3.47, 5.1, 7.3], [ring, ring * 0.8, ring * 0.6, ring * 0.4, ring * 0.3], [1, 0.7, 0.5, 0.35, 0.25], 0.05), dst });
}

/** Sheet / plate steel: dense inharmonic modes (locker doors, deck plates, hull panels). */
function plate(s: Synth, t: number, f0: number, level: number, ring: number, dst?: AudioNode): void {
  s.modal({
    start: t, level, dst,
    modes: s.modes(f0, [1, 1.62, 2.13, 2.87, 3.4, 4.31, 5.2, 6.6, 8.1], [ring, ring * 0.9, ring * 0.8, ring * 0.7, ring * 0.6, ring * 0.5, ring * 0.4, ring * 0.32, ring * 0.25], [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25], 0.05),
  });
}

/** Steel tube (turnstile arms, rails, pipes): near-harmonic bending modes, long ring. */
function tube(s: Synth, t: number, f0: number, level: number, ring: number, dst?: AudioNode): void {
  s.modal({ start: t, level, dst, modes: s.modes(f0, [1, 2.76, 5.4, 8.93, 13.3], [ring, ring * 0.7, ring * 0.5, ring * 0.35, ring * 0.25], [1, 0.75, 0.5, 0.3, 0.2], 0.02) });
}

/** Electronic panel beep (square through a small speaker). */
function beep(s: Synth, t: number, f: number, len: number, level: number, dst?: AudioNode, type: OscillatorType = 'square'): void {
  const g = s.gain(0);
  s.env(g.gain, [[t, 0], [t + 0.003, level], [t + len - 0.006, level], [t + len, 0]]);
  s.chain(s.osc(type, f, t, len + 0.02), s.lp(f * 3.2), s.hp(350), g, dst ?? s.out);
}

/**
 * The room baked into a scare: direct + early reflections (`taps` [s, gain], low-passed) + a small cross-feedback
 * diffuser (two delays, `fb` < 0.6) — what makes a crash sound like it happened in a steel room, before the engine's IR.
 * Returns the input to connect sources to.
 */
function room(s: Synth, taps: Array<[number, number]>, lp: number, diff = 0, size = 1, fb = 0.45, dst?: AudioNode): GainNode {
  const out = dst ?? s.out;
  const inp = s.gain(1);
  inp.connect(out);
  for (const [dt, g] of taps) s.chain(inp, s.delay(dt * size), s.lp(lp), s.gain(g), out);
  if (diff > 0) {
    const d1 = s.delay(0.0291 * size), d2 = s.delay(0.0437 * size);
    const g1 = s.gain(fb), g2 = s.gain(fb);
    const l1 = s.lp(lp * 0.7), l2 = s.lp(lp * 0.6);
    const send = s.gain(diff);
    inp.connect(send); send.connect(d1); send.connect(d2);
    s.chain(d1, l1, g1, d2); s.chain(d2, l2, g2, d1);
    const mix = s.gain(0.6);
    d1.connect(mix); d2.connect(mix); mix.connect(out);
  }
  return inp;
}
/** Early-reflection sets: a steel mess hall (14 × 12 × 3.2 m), a tiled washroom, a ready room of lockers, the sub bay. */
const ER_MESS: Array<[number, number]> = [[0.0094, 0.42], [0.0171, 0.34], [0.0262, 0.27], [0.0383, 0.2], [0.0551, 0.14], [0.0792, 0.09]];
const ER_SMALL: Array<[number, number]> = [[0.0052, 0.45], [0.0093, 0.38], [0.0141, 0.3], [0.0213, 0.22], [0.0318, 0.14]];
const ER_HALL: Array<[number, number]> = [[0.021, 0.36], [0.039, 0.3], [0.061, 0.24], [0.088, 0.18], [0.124, 0.13], [0.171, 0.09], [0.233, 0.06]];

/** [time s, freq Hz, tau s, amplitude]: one damped sine of an impact. */
type Hit = [number, number, number, number];
/** Many small impacts rendered in JS into one buffer (a click + damped sines each) — far cheaper than a node per hit. */
function impactData(dur: number, hits: Hit[], rnd: () => number): Float32Array<ArrayBuffer> {
  const len = Math.ceil(dur * SR), out = new Float32Array(len);
  for (const [t, f, tau, amp] of hits) {
    const i0 = Math.floor(t * SR);
    if (i0 < 0 || i0 >= len) continue;
    out[i0] += amp * 0.6 * (rnd() < 0.5 ? -1 : 1); // the contact click
    const w = (2 * Math.PI * f) / SR, d = Math.exp(-1 / (tau * SR)), ph = rnd() * 6.283;
    const n = Math.min(len - i0, Math.floor(tau * SR * 7));
    let a = amp;
    for (let i = 0; i < n; i++) { out[i0 + i] += a * Math.sin(ph + w * i); a *= d; }
  }
  return out;
}

/** A hard strike on a steel deck: transient, body thump, plate ring. */
function deckHit(s: Synth, t: number, level: number, f0 = 140, dst?: AudioNode): void {
  s.click(t, level * 0.9, 2500, 0.0012, dst);
  s.burst({ start: t, color: 'white', type: 'bandpass', f: 3800, Q: 0.6, a: 0.0002, tau: 0.008, level: level * 0.7, dst });
  s.burst({ start: t, color: 'pink', type: 'lowpass', f: 900, Q: 0.7, a: 0.0005, tau: 0.03, level: level * 0.8, dst });
  s.thump(t, f0 * 0.75, f0 * 0.32, 0.05, 0.06, level * 0.9, dst);
  plate(s, t, f0 * 1.3, level * 0.3, 0.22, dst);
}

/** One steel mess tray hitting the deck. `flat` = lands flat (air slap), otherwise on its edge (rings). */
function tray(s: Synth, t: number, level: number, f0: number, flat: boolean, dst?: AudioNode): void {
  s.click(t, level * 0.6, 3000, 0.0008, dst);
  s.modal({
    start: t, level: level * (flat ? 0.45 : 0.8), dst,
    modes: s.modes(f0, [1, 1.58, 2.31, 2.94, 3.72, 4.9, 6.25, 7.8], [0.28, 0.22, 0.18, 0.14, 0.11, 0.08, 0.06, 0.045], [1, 0.85, 0.75, 0.6, 0.5, 0.4, 0.3, 0.2], 0.05),
  });
  if (flat) s.burst({ start: t, color: 'pink', type: 'bandpass', f: s.r(1200, 2400), Q: 0.6, a: 0.0004, tau: 0.018, level: level * 0.9, dst });
  s.thump(t, s.r(110, 160), 60, 0.02, 0.025, level * 0.35, dst);
}

/** A disc / dome settling on its rim (Euler's disk): contacts accelerate, then it drops flat. Returns the end time. */
function wobble(s: Synth, t0: number, dur: number, f0: number, level: number, dst?: AudioNode, slap = true): number {
  let t = t0, gap = 0.13;
  while (t < t0 + dur) {
    const k = (t - t0) / dur;
    s.modal({ start: t, level: level * (0.35 + 0.65 * k) * s.r(0.8, 1), modes: s.modes(f0, [1, 1.58, 2.31, 2.94], [0.06, 0.05, 0.04, 0.03]), dst });
    s.click(t, level * 0.15 * (0.5 + k), 3500, 0.0006, dst);
    t += gap * s.r(0.92, 1.08);
    gap = Math.max(0.011, gap * 0.93);
  }
  if (slap) tray(s, t, level * 0.9, f0, true, dst);
  return t;
}

/** Stick-slip friction creak: a pulse train whose rate is the creak's pitch, through a body band. */
function creak(s: Synth, t: number, dur: number, f0: number, f1: number, fBody: number, level: number, dst?: AudioNode): void {
  const o = s.osc('sawtooth', f0, t, dur + 0.05);
  s.env(o.frequency, [[t, f0], [t + dur * 0.4, (f0 + f1) * 0.5 * s.r(0.9, 1.1)], [t + dur, f1]], 'exp');
  const g = s.gain(0);
  s.env(g.gain, [[t, 0], [t + dur * 0.15, level], [t + dur * 0.7, level * 0.8], [t + dur, 0]]);
  // roughness: noise AM (the slip is never even)
  const am = s.gain(0.6);
  const n = s.noise('brown', t, dur + 0.05, 2);
  const ng = s.gain(4);
  n.connect(ng); ng.connect(am.gain);
  s.chain(o, s.bp(fBody, 2.2), s.pk(fBody * 2.4, 2, 5), am, g, dst ?? s.out);
}

/** Hydraulic power-pack whine with pressure flutter. */
function hydraulic(s: Synth, t: number, dur: number, f: number, level: number, dst?: AudioNode): void {
  const o = s.osc('sawtooth', f * 0.7, t, dur + 0.1);
  s.env(o.frequency, [[t, f * 0.7], [t + 0.25, f], [t + dur - 0.2, f * 1.02], [t + dur, f * 0.6]], 'exp');
  const g = s.gain(0);
  s.env(g.gain, [[t, 0], [t + 0.15, level], [t + dur - 0.2, level], [t + dur, 0]]);
  s.chain(o, s.bp(f * 3, 1.5), g, dst ?? s.out);
  const n = s.noise('pink', t, dur + 0.1);
  const g2 = s.gain(0);
  s.env(g2.gain, [[t, 0], [t + 0.2, level * 0.5], [t + dur - 0.2, level * 0.5], [t + dur, 0]]);
  s.chain(n, s.bp(f * 5, 2), g2, dst ?? s.out);
}

/** Water running out of a tap into a steel basin. */
function stream(s: Synth, t: number, dur: number, level: number, f: number, dst?: AudioNode): void {
  const g = s.gain(0);
  s.env(g.gain, [[t, 0], [t + 0.06, level], [t + dur - 0.25, level * 0.9], [t + dur, 0]]);
  g.connect(dst ?? s.out);
  const am = s.gain(0.5);
  const n2 = s.noise('pink', t, dur + 0.05, 0.25);
  const ag = s.gain(0.6); n2.connect(ag); ag.connect(am.gain);
  s.chain(s.noise('white', t, dur + 0.05), s.hp(700), s.bp(f, 0.7), am, g);
  s.chain(s.noise('pink', t, dur + 0.05), s.bp(f * 0.3, 1.2), s.gain(0.6), g);
  // drops and splashes in the basin
  const d = crackleData(dur, 140, s.rnd, { burst: 0.3 });
  s.chain(s.data(d, t), s.bp(f * 0.6, 2), s.gain(0.25), g);
}

/** A gunshot heard from a third person: crack, driven body, a baked slap. `k` pitch, `w` body weight, `crack` level. */
function shot(s: Synth, k: number, w: number, crack: number, slap: number): void {
  const body = s.gain(1);
  s.chain(body, s.shaper('tanh', 3.0), s.out);
  s.click(0, 1.0, 2000, 0.0008);
  s.burst({ color: 'white', type: 'bandpass', f: 2900 * k, Q: 0.6, a: 0.0002, tau: 0.01, level: 1.4 * crack });
  s.burst({ color: 'white', type: 'highpass', f: 5200 * k, Q: 0.6, a: 0.0002, tau: 0.005, level: 0.6 * crack });
  s.burst({ color: 'white', type: 'bandpass', f: 1300 * k, Q: 0.8, a: 0.0003, tau: 0.024, level: 1.0, dst: body });
  s.burst({ color: 'pink', type: 'lowpass', f: 1500, Q: 0.8, a: 0.0005, tau: 0.05 * w, level: 1.2, dst: body });
  s.thump(0, 150 * k, 50, 0.05, 0.04 * w, 0.9, body);
  // the slap off the nearest walls: the shot's own room, before the engine's IR (and soldier_fire_tail after a burst)
  for (const [dt, lv] of [[0.011, 0.35], [0.023, 0.25], [0.041, 0.18], [0.067, 0.11]] as const) {
    s.burst({ start: dt * s.r(0.85, 1.15), color: 'pink', type: 'lowpass', f: 2200, Q: 0.6, a: 0.002, tau: 0.04, level: lv * slap });
  }
  s.burst({ start: 0.004, color: 'brown', type: 'lowpass', f: 600, f1: 180, sweep: 0.4, Q: 0.6, a: 0.01, tau: 0.12 * w, level: 0.35 * slap });
}

/** Boot on a surface: heavy heel, sole, gear. `kind` 0 deck, 1 grate, 2 wet. */
function boot(s: Synth, kind: number): void {
  const f = s.r(55, 68);
  s.thump(0, f * 1.7, f, 0.03, 0.026, 1.0);
  s.burst({ color: 'pink', type: 'lowpass', f: 650, Q: 0.7, a: 0.002, tau: 0.02, level: 0.8 });
  s.click(0.002, 0.18, 2200, 0.002);
  if (kind === 0) s.modal({ start: 0.002, level: 0.3, modes: s.modes(s.r(240, 320), [1, 2.9, 5.1, 8.3], [0.06, 0.05, 0.035, 0.02], [1, 0.8, 0.55, 0.35], 0.06) });
  if (kind === 1) {
    s.modal({ start: 0.002, level: 0.38, modes: s.modes(s.r(440, 540), [1, 2.62, 4.76, 7.8, 11.9], [0.2, 0.17, 0.12, 0.09, 0.06], [1, 0.9, 0.7, 0.5, 0.35], 0.05) });
    for (let i = 0; i < s.ri(3, 6); i++) s.modal({ start: s.r(0.006, 0.08), level: s.r(0.06, 0.13), modes: s.modes(s.r(1300, 3000), [1, 2.4], [0.02, 0.012]) });
  }
  if (kind === 2) {
    s.modal({ start: 0.002, level: 0.18, modes: s.modes(s.r(240, 320), [1, 2.9, 5.1], [0.04, 0.03, 0.02]) });
    splash(s, 0.004, 0.55);
  }
  // heel-to-toe roll
  const t2 = s.r(0.06, 0.09);
  s.thump(t2, f * 2, f * 1.2, 0.02, 0.018, 0.4);
  s.burst({ start: t2, color: 'pink', type: 'lowpass', f: 900, Q: 0.7, a: 0.002, tau: 0.015, level: 0.3 });
  if (kind === 2) splash(s, t2, 0.25);
  // webbing / magazines in their pouches
  for (let i = 0; i < 3; i++) s.modal({ start: s.r(0.01, 0.12), level: s.r(0.025, 0.05), modes: s.modes(s.r(1800, 3600), [1, 2.3], [0.015, 0.01]) });
}

/** A foot in a puddle on steel: the slap and the droplets. */
function splash(s: Synth, t: number, level: number): void {
  s.burst({ start: t, color: 'white', type: 'bandpass', f: s.r(1400, 2200), Q: 0.7, a: 0.002, tau: 0.035, level });
  s.burst({ start: t + 0.01, color: 'white', type: 'highpass', f: 3500, Q: 0.6, a: 0.004, tau: 0.03, level: level * 0.5 });
  for (let i = 0; i < s.ri(4, 8); i++) {
    const tt = t + s.r(0.02, 0.16), f = s.r(900, 2600);
    s.tone({ start: tt, f, f1: f * s.r(1.6, 2.4), sweep: 0.012, a: 0.001, tau: 0.008, level: level * s.r(0.08, 0.2) });
  }
}

export const rev10Sounds: SoundDef[] = [
  // ═════════ the flashlight cell (stage 3c coordinator 5a — EVERY level; audio plays these on player:flashlight)
  {
    // cause 'empty' (the 0.5 s death flicker has just ended): the driver's last fizzle, the LED ticking out, a click
    id: 'flashlight_die', variants: 2, dur: 0.5, vol: 0.4, maxVoices: 1, minInterval: 0.2, send: 0.25, when: 'load',
    render(s) {
      crackle(s, 0, 0.16, 900, 0.5, 3600); // the fizzle
      const o = s.osc('sine', 4100, 0, 0.22); // the boost converter's whine falling away
      s.env(o.frequency, [[0, 4100], [0.2, 1600]], 'exp');
      s.chain(o, s.ad(0, 0.004, 0.06, 0.06), s.out);
      s.modal({ start: 0.12, level: 0.05, modes: s.modes(5200, [1, 1.9], [0.01, 0.006]) });
      clack(s, s.r(0.2, 0.24), 2300, 0.55, 0.012); // the tailcap: off, for good
      s.burst({ start: 0.21, color: 'pink', type: 'lowpass', f: 900, Q: 0.8, a: 0.001, tau: 0.01, level: 0.2 }); // the thumb
    },
  },
  {
    // cause 'refused' (below 15 % / still dying): a dry click on nothing — no light, no hum
    id: 'flashlight_dead', variants: 3, dur: 0.2, vol: 0.38, maxVoices: 2, minInterval: 0.06, send: 0.2, when: 'load',
    render(s) {
      clack(s, 0, s.r(2000, 2500), 0.6, 0.008);
      clack(s, s.r(0.035, 0.05), s.r(1700, 2100), 0.35, 0.008); // the switch springs back
      s.burst({ start: 0.002, color: 'pink', type: 'lowpass', f: 800, Q: 0.8, a: 0.001, tau: 0.008, level: 0.15 });
    },
  },

  // ═════════ arrival (§4.1): played in the first two seconds — rendered with the load set on level 5 only
  {
    // d5_gate (kind wide, vertical pressure leaf): latches, the hydraulic stroke 2.4 s, the leaf grinding in its guides,
    // the top stop. The door's own sound (S1o).
    id: 'gate_open_heavy', variants: 1, dur: 3.6, vol: 0.95, ref: 7, rolloff: 0.75, send: 1.4, maxVoices: 1, minInterval: 0.5, priority: 5, when: 'load', levels: L5,
    render(s) {
      const rm = room(s, ER_SMALL, 3000, 0.5, 1.4);
      clunk(s, 0, 70, 0.9, 0.4, rm); // seal breaks
      s.burst({ start: 0.01, color: 'white', type: 'bandpass', f: 2600, Q: 0.5, a: 0.01, tau: 0.25, level: 0.35, dst: rm }); // pressure equalises
      hydraulic(s, 0.08, 2.5, 95, 0.35, rm);
      s.burst({ start: 0.1, color: 'brown', type: 'lowpass', f: 220, Q: 0.7, a: 0.2, hold: 2.0, tau: 0.15, level: 0.7, dst: rm }); // the mass moving
      scrape(s, 0.2, 2.2, 700, 0.08, rm); // guides
      for (let t = 0.35; t < 2.4; t += s.r(0.22, 0.4)) metal(s, t, s.r(180, 260), s.r(0.06, 0.14), 0.25, rm); // the leaf knocking in its slots
      clunk(s, 2.55, 62, 1.0, 0.5, rm); // top stop
      plate(s, 2.55, 120, 0.35, 0.6, rm);
      hiss(s, 2.6, 0.6, 0.18, 2400, rm);
    },
  },
  {
    // the same leaf descending 2.4 s, then the slam onto the sill and the dogs throwing home
    id: 'gate_close_heavy', variants: 1, dur: 4.0, vol: 1.0, ref: 7, rolloff: 0.75, send: 1.5, maxVoices: 1, minInterval: 0.5, priority: 5, when: 'idle', levels: L5,
    render(s) {
      const rm = room(s, ER_SMALL, 3000, 0.5, 1.4);
      clack(s, 0, 900, 0.5, 0.04, rm);
      hydraulic(s, 0.05, 2.4, 82, 0.3, rm);
      s.burst({ start: 0.05, color: 'brown', type: 'lowpass', f: 200, Q: 0.7, a: 0.3, hold: 1.9, tau: 0.1, level: 0.6, dst: rm });
      scrape(s, 0.15, 2.2, 620, 0.08, rm);
      for (let t = 0.3; t < 2.3; t += s.r(0.25, 0.45)) metal(s, t, s.r(170, 240), s.r(0.05, 0.12), 0.25, rm);
      // the slam
      const t = 2.45;
      s.click(t, 1.0, 2000, 0.0015, rm);
      s.thump(t, 85, 30, 0.12, 0.16, 1.0, rm);
      s.burst({ start: t, color: 'pink', type: 'lowpass', f: 1200, Q: 0.7, a: 0.0005, tau: 0.06, level: 0.9, dst: rm });
      plate(s, t, 78, 0.6, 0.9, rm);
      for (let i = 0; i < 6; i++) { const td = t + 0.18 + i * 0.09; clack(s, td, s.r(380, 520), 0.4, 0.05, rm); s.thump(td, 110, 50, 0.03, 0.04, 0.35, rm); } // the dogs
      hiss(s, t + 0.8, 0.5, 0.12, 2000, rm);
    },
  },
  {
    // the booth's back door settling shut behind the glass (S6; no figure ever): a soft swing, the latch, the frame
    id: 'booth_door_shut', variants: 1, dur: 1.3, vol: 0.75, ref: 3, send: 1.0, maxVoices: 1, minInterval: 0.5, priority: 3, when: 'load', levels: L5,
    render(s) {
      const rm = room(s, ER_SMALL, 2600, 0.3, 0.8);
      s.burst({ start: 0, color: 'pink', type: 'bandpass', f: 400, f1: 250, sweep: 0.35, Q: 0.8, a: 0.15, tau: 0.08, level: 0.15, dst: rm }); // the swing
      creak(s, 0.02, 0.28, 220, 170, 900, 0.05, rm); // hinge
      const t = s.r(0.36, 0.4);
      clack(s, t, 1900, 0.6, 0.02, rm); // latch tongue on the strike
      s.thump(t + 0.012, 130, 60, 0.04, 0.05, 0.9, rm); // the leaf in the frame
      plate(s, t + 0.012, 160, 0.18, 0.15, rm);
      s.burst({ start: t + 0.012, color: 'pink', type: 'lowpass', f: 700, Q: 0.7, a: 0.001, tau: 0.03, level: 0.5, dst: rm });
      for (let i = 0; i < 4; i++) s.modal({ start: t + 0.03 + i * s.r(0.02, 0.04), level: 0.04 * (1 - i * 0.2), modes: s.modes(s.r(2300, 3400), [1, 1.7, 2.6], [0.02, 0.012, 0.008]), dst: rm }); // the booth glazing rattles
    },
  },
  // ═════════ scare 1 v5_turnstile (gate5): the tripod turnstile turns a quarter by itself; the ON POST board counts him in
  {
    id: 'turnstile_click', variants: 2, dur: 1.4, vol: 0.85, ref: 4, rolloff: 0.9, send: 1.2, maxVoices: 1, minInterval: 0.3, priority: 3, when: 'idle', levels: L5,
    render(s) {
      const rm = room(s, ER_SMALL, 3200, 0.4, 1.2);
      // solenoid releases the rotor: a sharp double clack and its plunger
      clack(s, 0, 2800, 0.9, 0.02, rm);
      s.thump(0, 260, 120, 0.02, 0.02, 0.5, rm);
      clack(s, 0.018, 1900, 0.5, 0.02, rm);
      // the arms swing a quarter turn: index pawl over three teeth, bearings, air
      s.burst({ start: 0.04, color: 'pink', type: 'bandpass', f: 1100, Q: 1, a: 0.08, hold: 0.12, tau: 0.06, level: 0.1, dst: rm });
      for (let i = 0; i < 3; i++) clack(s, 0.07 + i * 0.075, 3400 + i * 200, 0.32, 0.01, rm);
      scrape(s, 0.05, 0.28, 2100, 0.05, rm);
      // drops into the detent: the heavy clunk and the steel tube arms ringing
      const t = s.r(0.33, 0.36);
      s.click(t, 0.9, 2200, 0.0012, rm);
      s.thump(t, 170, 70, 0.04, 0.05, 0.9, rm);
      tube(s, t, s.r(610, 690), 0.55, 0.55, rm);
      tube(s, t + 0.002, s.r(820, 900), 0.3, 0.45, rm);
      metal(s, t, 290, 0.25, 0.12, rm); // the housing
      // the damper settles: two small knocks
      clack(s, t + 0.09, 1500, 0.2, 0.02, rm);
      clack(s, t + 0.16, 1400, 0.1, 0.02, rm);
    },
  },
  {
    // ON POST board 26 → 27: electromechanical flap counter — relay, two flaps flicking over, the drum settling
    id: 'counter_tick', variants: 2, dur: 0.6, vol: 0.6, ref: 3, send: 0.9, maxVoices: 2, minInterval: 0.08, priority: 2, when: 'idle', levels: L5,
    render(s) {
      clack(s, 0, 1300, 0.5, 0.015);
      s.thump(0, 220, 120, 0.015, 0.015, 0.4);
      for (let i = 0; i < 3; i++) {
        const t = 0.035 + i * s.r(0.03, 0.045);
        s.click(t, 0.4 - i * 0.08, 3200, 0.0008);
        s.modal({ start: t, level: 0.22 - i * 0.05, modes: s.modes(s.r(1050, 1250), [1, 2.1, 3.4], [0.012, 0.008, 0.005]) }); // plastic flap
      }
      clack(s, 0.15, 900, 0.2, 0.02);
    },
  },

  // ═════════ scare 2 v5_hull_groan (ready5): 2.1 km of sea on the pressure hull — groan, lockers rattle, one bangs open, a helmet
  {
    id: 'hull_groan_long', variants: 2, dur: 6.8, vol: 1.0, ref: 10, rolloff: 0.5, send: 1.6, maxVoices: 1, minInterval: 2, priority: 5, pitchVar: 0.05, when: 'late', levels: L5,
    render(s) {
      const D = 6.0;
      const hull = s.gain(1);
      s.chain(hull, s.lp(2600), s.out);
      const rm = room(s, ER_MESS, 1800, 0.6, 1.3, 0.5, hull);
      // the sea pressing: a sub swell under everything
      s.burst({ start: 0, color: 'brown', type: 'lowpass', f: 70, Q: 0.7, a: 1.8, hold: 2.6, tau: 0.6, level: 1.0, dst: hull });
      // the moan: two detuned saws through a resonant band that rises, falls, rises less
      for (const det of [1, 1.013]) {
        const f = s.r(30, 35) * det;
        const o = s.osc('sawtooth', f, 0.2, D);
        s.env(o.frequency, [[0.2, f], [2.4, f * 1.4], [4.2, f * 1.15], [5.9, f * 0.9]], 'exp');
        const bp = s.bp(100, 5);
        s.env(bp.frequency, [[0.2, 85], [2.4, 220], [4.2, 160], [5.9, 95]], 'exp');
        const g = s.gain(0);
        s.env(g.gain, [[0.2, 0], [1.2, 0.3], [3.0, 0.5], [4.6, 0.3], [6.0, 0]]);
        s.chain(o, bp, g, rm);
      }
      // stick-slip grains: plates sliding at a seam. Rate and pitch follow the load.
      // (one buffer of noise grains through one band that follows the load, plus the plates' own ring per grain)
      const grains = new Float32Array(Math.ceil(5.8 * SR));
      const rings: Hit[] = [];
      const band = s.bp(130, 3);
      const pts: Array<[number, number]> = [];
      for (let tt = 0.5; tt <= 5.6; tt += 0.25) pts.push([tt, 130 + 190 * Math.sin(Math.PI * Math.min(1, (tt - 0.5) / 5.1))]);
      s.env(band.frequency, pts, 'exp');
      let t = 0.5;
      while (t < 5.6) {
        const k = Math.sin(Math.PI * Math.min(1, (t - 0.5) / 5.1));
        const rate = 6 + 22 * Math.pow(k, 1.5);
        const f = 130 + 190 * k;
        const a = (0.12 + 0.45 * k) * s.r(0.6, 1);
        const i0 = Math.floor(t * SR), tau = s.r(0.007, 0.013) * SR;
        for (let i = 0; i < tau * 6 && i0 + i < grains.length; i++) grains[i0 + i] += a * 6 * (s.rnd() * 2 - 1) * Math.exp(-i / tau);
        rings.push([t, f * 1.9 * s.r(0.97, 1.03), 0.05, a * 0.12], [t, f * 4.1, 0.03, a * 0.06], [t, f * 6.5, 0.02, a * 0.04]);
        t += (1 / rate) * s.r(0.6, 1.4);
      }
      s.chain(s.data(grains, 0), band, rm);
      s.chain(s.data(impactData(5.8, rings, s.rnd), 0), rm);
      // a rib takes the load: one deep structural bong
      const tb = s.r(2.7, 3.2);
      s.click(tb, 0.4, 1200, 0.002, rm);
      metal(s, tb, s.r(58, 70), 0.75, 1.7, rm);
      plate(s, tb, s.r(110, 130), 0.3, 1.0, rm);
      s.thump(tb, 72, 30, 0.25, 0.35, 0.9, rm);
      // stress pings in the steel, here and far
      for (let i = 0; i < 8; i++) s.modal({ start: s.r(1.0, 5.6), level: s.r(0.04, 0.14), modes: s.modes(s.r(1700, 4300), [1, 1.53, 2.8], [0.18, 0.11, 0.06]), dst: rm });
      // the far end of the hull answers, low-passed
      const far = s.lp(400); far.connect(hull);
      s.thump(tb + 0.9, 60, 28, 0.3, 0.4, 0.35, far);
      metal(s, tb + 0.9, 55, 0.3, 1.2, far);
    },
    post(ch) { saturate(ch, 1.3); },
  },
  {
    // the locker rows rattle in their frames (+2.2 s into the groan): a dozen doors buzzing against their latches
    id: 'locker_rattle', variants: 2, dur: 2.2, vol: 0.9, ref: 5, rolloff: 0.8, send: 1.3, maxVoices: 1, minInterval: 0.5, priority: 4, when: 'late', levels: L5,
    render(s) {
      const rm = room(s, ER_MESS, 2600, 0.5, 0.9);
      // every door's micro-impacts against its latch, generated in one buffer (cheap: ~500 impacts)
      const hits: Hit[] = [];
      for (let d = 0; d < 12; d++) {
        const start = s.r(0, 0.35), peak = s.r(0.35, 0.7), end = s.r(1.2, 1.8);
        const hiF = s.r(1300, 3400);
        let tt = start;
        const gap = 1 / s.r(24, 42);
        while (tt < end) {
          const env = tt < peak ? (tt - start) / (peak - start) : Math.max(0, 1 - (tt - peak) / (end - peak));
          const lv = 0.22 * env * s.r(0.5, 1);
          if (lv > 0.01) hits.push([tt, hiF * s.r(0.97, 1.03), 0.012, lv], [tt, hiF * 1.7, 0.009, lv * 0.6], [tt, hiF * 2.6, 0.006, lv * 0.4]);
          tt += gap * s.r(0.6, 1.4);
        }
        plate(s, peak, s.r(95, 135), 0.06, 0.12, rm); // the door panel itself, at the door's loudest
      }
      s.chain(s.data(impactData(2.0, hits, s.rnd), 0), rm);
      // the rows' own boom as the frames flex
      s.burst({ start: 0.1, color: 'brown', type: 'lowpass', f: 160, Q: 0.7, a: 0.4, hold: 0.4, tau: 0.3, level: 0.5, dst: rm });
    },
  },
  {
    // a navy helmet drops ~1.2 m, bounces, rolls 2.5 m toward him on its brim, rocks on its dome, stops
    id: 'helmet_roll', variants: 2, dur: 3.8, vol: 0.95, ref: 4, rolloff: 0.85, send: 1.2, maxVoices: 1, minInterval: 0.5, priority: 4, when: 'late', levels: L5,
    render(s) {
      const rm = room(s, ER_MESS, 2800, 0.45, 0.9);
      const shell = (t: number, lv: number) => {
        s.click(t, lv * 0.7, 2400, 0.001, rm);
        // composite shell: a hollow knock, the cavity resonance
        s.modal({ start: t, level: lv * 0.6, modes: s.modes(s.r(420, 520), [1, 1.48, 2.06, 2.71, 3.6], [0.05, 0.035, 0.025, 0.018, 0.012], [1, 0.7, 0.5, 0.3, 0.2], 0.04), dst: rm });
        s.burst({ start: t, color: 'pink', type: 'bandpass', f: s.r(260, 320), Q: 5, a: 0.001, tau: 0.04, level: lv * 0.9, dst: rm });
        s.thump(t, 150, 70, 0.02, 0.03, lv * 0.6, rm);
        s.modal({ start: t + 0.004, level: lv * 0.12, modes: s.modes(s.r(2500, 3200), [1, 1.6], [0.02, 0.012]), dst: rm }); // the chinstrap buckle
      };
      shell(0, 1.0);
      shell(s.r(0.19, 0.23), 0.55);
      shell(s.r(0.33, 0.37), 0.3);
      // rolling on its brim: a rumble whose rotation knocks slow down
      const r0 = 0.42, r1 = 2.35;
      const g = s.gain(0);
      s.env(g.gain, [[r0, 0], [r0 + 0.1, 0.7], [r1 - 0.4, 0.45], [r1, 0.08]]);
      g.connect(rm);
      const bp = s.bp(380, 2.5);
      s.env(bp.frequency, [[r0, 420], [r1, 300]], 'exp');
      const am = s.gain(0.5);
      const lfo = s.osc('sine', 4, r0, r1 - r0);
      s.env(lfo.frequency, [[r0, 4.2], [r1, 1.6]], 'exp');
      const lg = s.gain(0.5); lfo.connect(lg); lg.connect(am.gain);
      s.chain(s.noise('pink', r0, r1 - r0 + 0.05), bp, am, g);
      let t = r0 + 0.08, rot = 1 / 4.2;
      // once per turn the brim's high point and the buckle touch down: small knocks, not drops
      while (t < r1) {
        const lv = 0.16 * (1 - (t - r0) / (r1 - r0)) + 0.05;
        s.modal({ start: t, level: lv, modes: s.modes(s.r(420, 520), [1, 1.48, 2.06], [0.03, 0.02, 0.015]), dst: rm });
        s.modal({ start: t + 0.01, level: lv * 0.4, modes: s.modes(s.r(2500, 3200), [1, 1.6], [0.015, 0.01]), dst: rm });
        t += rot; rot *= 1.12;
      }
      // rocking on its dome: contacts accelerate, then nothing
      let tt = r1 + 0.1, gap = 0.26, lv = 0.22;
      while (gap > 0.045) { shell(tt, lv); tt += gap; gap *= 0.78; lv *= 0.86; }
      shell(tt, 0.08);
    },
  },

  // ═════════ scare 3 v5_bunk_radio (berths5): a sailor's bunk radio clicks on — static, then CHOIR reading names (story line)
  {
    id: 'radio_on_click', variants: 2, dur: 0.6, vol: 0.7, ref: 2.5, send: 0.8, maxVoices: 1, minInterval: 0.2, priority: 3, when: 'late', levels: L5,
    render(s) {
      clack(s, 0, 1700, 0.7, 0.015); // rotary switch, a stiff detent
      clack(s, 0.012, 2600, 0.3, 0.01);
      const spk = s.bp(380, 1.5); spk.connect(s.out);
      s.thump(0.02, 120, 50, 0.02, 0.04, 0.8, spk); // the speaker cone pops as the amp comes up
      s.burst({ start: 0.03, color: 'white', type: 'bandpass', f: 2200, Q: 0.7, a: 0.08, tau: 0.08, level: 0.25 }); // static rushes in
      s.tone({ start: 0.03, f: 60, a: 0.05, hold: 0.25, tau: 0.08, level: 0.08 }); // hum
      s.tone({ start: 0.03, f: 120, a: 0.05, hold: 0.25, tau: 0.08, level: 0.05 });
    },
  },
  {
    // the bunk radio's static under CHOIR's voice (loop it from radio_on_click until it clicks off): AM hash, a slow fade,
    // a heterodyne whistle, mains hum through a small speaker. 6 s loop: 60 Hz, 1730 Hz, LFOs 1/6 and 1/2 Hz → whole cycles.
    id: 'radio_static_bed', loop: true, variants: 1, dur: 6, vol: 0.45, ref: 2.5, rolloff: 1.0, send: 0.7, when: 'lazy', levels: L5,
    render(s) {
      const D = LP(6);
      const spk = s.gain(1);
      s.chain(spk, s.hp(260), s.pk(1500, 1, 4), s.lp(3600), s.out);
      bed(s, 'white', D, 0.25, 1 / 6, 0.5, s.bp(2200, 0.6), spk);
      bed(s, 'pink', D, 0.18, 1 / 2, 0.3, s.bp(900, 0.8), spk);
      const d = crackleData(D, 60, s.rnd, { burst: 0.5 });
      s.chain(s.data(d, 0), s.bp(1800, 0.8), s.gain(0.5), spk);
      drone(s, 'sine', 1730, D, 0.012, spk);
      drone(s, 'square', 60, D, 0.02, s.lp(400), spk);
    },
  },

  // ═════════ scare 4 v5_trays (mess5): a pump thumps behind the galley wall, the deck shudders, thirty trays and the cutlery bin
  {
    // the dock pumps cycling behind the wall: a double whump through the structure, then the deck plates buzz
    id: 'pump_thump', variants: 2, dur: 2.0, vol: 1.0, ref: 8, rolloff: 0.6, send: 1.4, maxVoices: 1, minInterval: 0.5, priority: 4, when: 'late', levels: L5,
    render(s) {
      const wall = s.lp(320);
      const rm = room(s, ER_MESS, 1400, 0.6, 1.2, 0.5);
      s.chain(wall, rm);
      for (const [t, lv] of [[0, 1.0], [s.r(0.24, 0.3), 0.75]] as const) {
        s.thump(t, 60, 26, 0.12, 0.2, lv, wall);
        s.burst({ start: t, color: 'brown', type: 'lowpass', f: 140, Q: 0.7, a: 0.01, tau: 0.15, level: lv * 0.8, dst: wall });
        metal(s, t + 0.01, s.r(70, 90), lv * 0.4, 0.7, wall);
      }
      // the deck answers: plates and fittings buzzing for half a second
      let tt = 0.04;
      while (tt < 0.9) {
        const lv = 0.12 * Math.exp(-tt / 0.35) * s.r(0.5, 1);
        s.modal({ start: tt, level: lv, modes: s.modes(s.r(500, 1400), [1, 1.7, 2.6], [0.015, 0.01, 0.007]), dst: rm });
        tt += 1 / s.r(18, 30);
      }
    },
  },
  {
    // thirty steel trays slide off the counter and crash across the deck; one rolls on its rim and settles. The loudest
    // object in the level after the guns: a hard transient, a wall of tray modes, skids, the slow spin-down.
    id: 'tray_crash', variants: 2, dur: 3.9, vol: 1.0, ref: 6, rolloff: 0.75, send: 1.5, maxVoices: 1, minInterval: 1, priority: 5, pitchVar: 0.03, when: 'late', levels: L5,
    render(s) {
      const rm = room(s, ER_MESS, 3600, 0.7, 1.0, 0.5);
      // the stack shifts on the steel counter: stick-slip scrape
      const sl = s.gain(0);
      s.env(sl.gain, [[0, 0], [0.05, 0.12], [0.22, 0.25], [0.3, 0]]);
      const am = s.gain(0.5);
      const lfo = s.osc('square', s.r(22, 30), 0, 0.35);
      const lg = s.gain(0.5); lfo.connect(lg); lg.connect(am.gain);
      s.chain(s.noise('white', 0, 0.35), s.bp(1800, 2.5), am, sl, rm);
      clack(s, 0.02, 2400, 0.25, 0.04, rm);
      const tip = s.r(0.27, 0.31);
      // the stack lands as one: the big hit (boom + a wall of tray modes)
      deckHit(s, tip, 1.0, 120, rm);
      s.thump(tip, 75, 32, 0.12, 0.14, 0.8, rm);
      for (let i = 0; i < 6; i++) tray(s, tip + s.r(0, 0.012), 0.75, s.r(380, 900), i % 2 === 0, rm);
      // the stack bursts apart: 24 more trays in the first 0.45 s, stragglers to 1.3 s
      for (let i = 0; i < 24; i++) {
        const t = tip + 0.015 + 0.45 * Math.pow(s.rnd(), 2.0);
        tray(s, t, 0.85 * (1 - (t - tip) * 0.9) * s.r(0.45, 1), s.r(350, 950), s.chance(0.5), rm);
      }
      for (let i = 0; i < 8; i++) {
        const t = tip + s.r(0.45, 1.3);
        tray(s, t, s.r(0.15, 0.4), s.r(400, 900), s.chance(0.6), rm);
      }
      // skids across the deck
      for (let i = 0; i < 5; i++) scrape(s, tip + s.r(0.08, 0.6), s.r(0.2, 0.55), s.r(1500, 3000), s.r(0.05, 0.11), rm);
      // one tray rolls away on its rim and spins down — the last thing heard
      wobble(s, tip + s.r(0.95, 1.1), 1.6, s.r(520, 700), 0.5, rm);
    },
    post(ch) { saturate(ch, 1.6); },
  },
  {
    // the cutlery bin goes with them: a hollow bin knock, a hundred knives and spoons, bounces, a few spinning
    id: 'cutlery_scatter', variants: 2, dur: 2.4, vol: 0.85, ref: 4, rolloff: 0.85, send: 1.3, maxVoices: 1, minInterval: 1, priority: 4, when: 'late', levels: L5,
    render(s) {
      const rm = room(s, ER_MESS, 5000, 0.4, 1.0, 0.45);
      const tb = s.r(0.32, 0.38);
      s.thump(tb, 210, 90, 0.03, 0.05, 0.7, rm); // the bin
      s.modal({ start: tb, level: 0.4, modes: s.modes(s.r(330, 390), [1, 1.5, 2.2, 3.1], [0.06, 0.04, 0.03, 0.02]), dst: rm });
      s.click(tb, 0.6, 2500, 0.001, rm);
      const hits: Hit[] = [];
      for (let i = 0; i < 90; i++) {
        let t = tb + 0.4 * Math.pow(s.rnd(), 1.6) + s.r(0, 0.05);
        let lv = s.r(0.06, 0.2) * (1 - (t - tb) * 0.8);
        const f = s.r(2200, 6800), tau = s.r(0.02, 0.07);
        for (let b = 0; b < s.ri(1, 3) && lv > 0.01; b++) {
          hits.push([t, f, tau, lv], [t, f * 2.76, 0.02, lv * 0.5], [t, f * 5.4 > 20000 ? f * 1.5 : f * 5.4, 0.01, lv * 0.3]);
          t += s.r(0.05, 0.12) * Math.pow(0.6, b); lv *= 0.45;
        }
      }
      s.chain(s.data(impactData(2.0, hits, s.rnd), 0), rm);
      // a ladle and two knives spinning on the deck
      for (let k = 0; k < 3; k++) wobble(s, tb + s.r(0.4, 0.9), s.r(0.6, 1.0), s.r(1500, 2600), 0.12, rm, false);
    },
  },

  // ═════════ scare 5 v5_galley_shape (galley5): the cold-room fan starts behind the frosted window; a hook creaks
  {
    id: 'fan_start', variants: 1, dur: 3.4, vol: 0.85, ref: 4, rolloff: 0.9, send: 1.1, maxVoices: 1, minInterval: 1, priority: 3, when: 'late', levels: L5,
    render(s) {
      const rm = room(s, ER_SMALL, 3000, 0.4, 1.0);
      clunk(s, 0, 110, 0.6, 0.15, rm); // contactor
      clack(s, 0.005, 1600, 0.4, 0.02, rm);
      // motor and blades spin up: rotation 2 → 24 Hz, 5 blades
      const blade = s.osc('triangle', 10, 0.05, 3.4);
      s.env(blade.frequency, [[0.05, 10], [1.6, 95], [3.3, 120]], 'exp');
      const bg = s.gain(0);
      s.env(bg.gain, [[0.05, 0], [1.0, 0.35], [3.3, 0.4]]);
      s.chain(blade, s.lp(500), bg, rm);
      const mot = s.osc('sawtooth', 20, 0.05, 3.4);
      s.env(mot.frequency, [[0.05, 20], [1.6, 220], [3.3, 240]], 'exp');
      const mg = s.gain(0);
      s.env(mg.gain, [[0.05, 0], [1.2, 0.05], [3.3, 0.04]]);
      s.chain(mot, s.bp(700, 1.5), mg, rm);
      const air = s.gain(0);
      s.env(air.gain, [[0.1, 0], [2.0, 0.3], [3.3, 0.32]]);
      s.chain(s.noise('pink', 0.1, 3.3), s.bp(600, 0.8), air, rm);
      // the guard rattles as it passes resonance, then settles
      for (let t = 0.5; t < 1.6; t += s.r(0.03, 0.06)) s.modal({ start: t, level: 0.12 * Math.sin(Math.PI * (t - 0.5) / 1.1), modes: s.modes(s.r(800, 1500), [1, 1.8], [0.015, 0.01]), dst: rm });
    },
  },
  {
    // the cold-room fan running (8 s loop): blade pass 120 Hz (24 Hz × 5), its harmonics, the air, a loose guard ticking
    id: 'fan_loop', loop: true, variants: 1, dur: 8, vol: 0.5, ref: 3.5, rolloff: 1.0, send: 0.9, when: 'lazy', levels: L5,
    render(s) {
      const D = LP(8);
      drone(s, 'triangle', 120, D, 0.16, s.lp(500));
      drone(s, 'sine', 240, D, 0.04);
      drone(s, 'sawtooth', 24, D, 0.05, s.lp(200));
      bed(s, 'pink', D, 0.32, 0.5, 0.15, s.bp(600, 0.8));
      bed(s, 'white', D, 0.03, 0, 0, s.hp(3000));
      for (let t = 0.1; t < D - 0.1; t += 0.25) if (s.chance(0.55)) s.modal({ start: t + s.r(-0.01, 0.01), level: s.r(0.03, 0.07), modes: s.modes(s.r(1000, 1300), [1, 1.8], [0.012, 0.008]) });
    },
  },
  {
    // an oilskin swinging on a steel hook: there and back, two creaks
    id: 'hook_creak', variants: 3, dur: 1.6, vol: 0.7, ref: 2.5, send: 1.0, maxVoices: 1, minInterval: 0.4, priority: 2, when: 'late', levels: L5,
    render(s) {
      creak(s, 0, s.r(0.45, 0.6), s.r(170, 210), s.r(240, 290), s.r(800, 1100), 0.6);
      creak(s, s.r(0.75, 0.85), s.r(0.4, 0.55), s.r(230, 280), s.r(160, 190), s.r(800, 1100), 0.45);
      s.modal({ start: 0.02, level: 0.06, modes: s.modes(s.r(1900, 2300), [1, 2.7], [0.05, 0.03]) }); // the hook in its eye
    },
  },

  // ═════════ scare 6 v5_water (heads5): four taps open at once with a hammer-bang in the pipes; water; the drains gurgle
  {
    id: 'water_hammer', variants: 2, dur: 1.8, vol: 1.0, ref: 5, rolloff: 0.8, send: 1.4, maxVoices: 1, minInterval: 0.5, priority: 5, when: 'late', levels: L5,
    render(s) {
      const rm = room(s, ER_SMALL, 4000, 0.65, 1.0, 0.55);
      for (let i = 0; i < 4; i++) clack(s, i * s.r(0.006, 0.012), s.r(1300, 1700), 0.35, 0.02, rm); // the four valves
      // the hammer: water column slamming into a closed elbow — a hard bang that rings the pipe
      const t = s.r(0.03, 0.045);
      s.click(t, 1.0, 1800, 0.0015, rm);
      s.thump(t, 120, 45, 0.04, 0.06, 1.0, rm);
      tube(s, t, s.r(200, 230), 0.8, 0.6, rm);
      tube(s, t, s.r(470, 520), 0.4, 0.4, rm);
      s.burst({ start: t, color: 'pink', type: 'lowpass', f: 1400, Q: 0.7, a: 0.0005, tau: 0.04, level: 0.7, dst: rm });
      // a second, smaller one; then the run of pipe chattering in its brackets
      const t2 = t + s.r(0.17, 0.22);
      s.thump(t2, 110, 45, 0.04, 0.05, 0.6, rm);
      tube(s, t2, s.r(200, 230), 0.4, 0.5, rm);
      let tt = t2 + 0.03, lv = 0.3;
      while (lv > 0.02) { metal(s, tt, s.r(300, 420), lv, 0.08, rm); tt += 1 / s.r(14, 20); lv *= 0.8; }
      // air spits out of the taps before the water
      s.burst({ start: t + 0.05, color: 'white', type: 'highpass', f: 1800, Q: 0.6, a: 0.005, tau: 0.12, level: 0.35, dst: rm });
      const d = crackleData(0.3, 300, s.rnd, { burst: 0.5, env: (x) => Math.exp(-x / 0.12) });
      s.chain(s.data(d, t + 0.05), s.bp(2500, 1), s.gain(0.4), rm);
    },
  },
  {
    // water runs from four taps for 2.5 s into steel basins, then the valves shut
    id: 'taps_run', variants: 1, dur: 3.4, vol: 0.75, ref: 3.5, rolloff: 0.9, send: 1.1, maxVoices: 1, minInterval: 1, priority: 3, when: 'late', levels: L5,
    render(s) {
      const rm = room(s, ER_SMALL, 4500, 0.35, 1.0);
      for (let i = 0; i < 4; i++) stream(s, i * 0.01, 2.55, 0.35, 2600 + i * 450, rm);
      for (let i = 0; i < 4; i++) clack(s, 2.5 + i * s.r(0.01, 0.03), s.r(1300, 1600), 0.25, 0.02, rm);
      for (let i = 0; i < 6; i++) s.modal({ start: 2.65 + s.r(0, 0.7), level: s.r(0.04, 0.09), modes: s.modes(s.r(1100, 1700), [1, 2.1], [0.035, 0.02]), dst: rm }); // last drips
    },
  },
  {
    // the drains take it: glugs, bubbles, the trap sucking air
    id: 'drain_gurgle', variants: 2, dur: 2.6, vol: 0.8, ref: 3, rolloff: 0.9, send: 1.1, maxVoices: 1, minInterval: 0.5, priority: 3, when: 'late', levels: L5,
    render(s) {
      const rm = room(s, ER_SMALL, 3000, 0.35, 1.0);
      let t = 0.05;
      while (t < 2.1) {
        // a glug: a resonant pulse of the pipe's air column
        s.burst({ start: t, color: 'brown', type: 'bandpass', f: s.r(150, 230), Q: 6, a: 0.008, tau: 0.04, level: s.r(0.4, 0.9), dst: rm });
        for (let b = 0; b < s.ri(1, 4); b++) {
          const f = s.r(220, 650);
          s.tone({ start: t + s.r(0, 0.06), f, f1: f * s.r(1.4, 2.2), sweep: s.r(0.02, 0.05), a: 0.002, tau: s.r(0.015, 0.03), level: s.r(0.1, 0.25), dst: rm });
        }
        t += s.r(0.07, 0.22) * (t > 1.5 ? 1.6 : 1);
      }
      // the trap empties: a long suck
      s.burst({ start: 1.9, color: 'pink', type: 'bandpass', f: 500, f1: 1300, sweep: 0.4, Q: 2, a: 0.08, tau: 0.12, level: 0.35, dst: rm });
      s.tone({ start: 2.25, f: 300, f1: 700, sweep: 0.05, a: 0.003, tau: 0.03, level: 0.3, dst: rm });
    },
  },

  // ═════════ scare 9 v5_magazine: the caged lamp pops; glass falls (then the shape against the rack sits up)
  {
    id: 'bulb_pop', variants: 2, dur: 0.9, vol: 1.0, ref: 4, rolloff: 0.85, send: 1.4, maxVoices: 1, minInterval: 0.3, priority: 5, when: 'late', levels: L5,
    render(s) {
      const rm = room(s, ER_SMALL, 5000, 0.55, 0.9, 0.5);
      crackle(s, 0, 0.07, 1400, 0.35, 2800, rm); // the filament arcs
      const o = s.osc('sawtooth', 120, 0, 0.08); // ballast buzz rising into it
      s.chain(o, s.bp(1200, 2), s.ad(0, 0.06, 0.12, 0.005), rm);
      const t = s.r(0.07, 0.085);
      // the envelope gives: an implosion — hard click, broadband crack, a low thuk
      s.click(t, 1.0, 1500, 0.0015, rm);
      s.burst({ start: t, color: 'white', type: 'highpass', f: 1200, Q: 0.5, a: 0.0002, tau: 0.02, level: 1.0, dst: rm });
      s.burst({ start: t, color: 'pink', type: 'bandpass', f: 900, Q: 0.6, a: 0.0003, tau: 0.03, level: 0.8, dst: rm });
      s.thump(t, 190, 70, 0.02, 0.04, 0.9, rm);
      s.modal({ start: t, level: 0.35, modes: s.modes(s.r(3200, 4200), [1, 1.43, 2.1, 2.96], [0.05, 0.035, 0.025, 0.015]), dst: rm }); // the glass rings
      s.modal({ start: t + 0.003, level: 0.15, modes: s.modes(s.r(780, 900), [1, 2.4], [0.12, 0.06]), dst: rm }); // the cage
    },
    post(ch) { saturate(ch, 1.4); },
  },
  {
    // glass shards on a steel floor
    id: 'glass_tinkle', variants: 2, dur: 1.4, vol: 0.8, ref: 3, send: 1.2, maxVoices: 1, minInterval: 0.3, priority: 3, when: 'late', levels: L5,
    render(s) {
      const rm = room(s, ER_SMALL, 7000, 0.3, 0.9);
      const hits: Hit[] = [];
      for (let i = 0; i < 28; i++) {
        let t = s.r(0.02, 0.5) * Math.pow(s.rnd(), 0.6) + 0.02, lv = s.r(0.08, 0.3);
        const f = s.r(3000, 9000), tau = s.r(0.01, 0.04);
        for (let b = 0; b < s.ri(1, 3) && lv > 0.01; b++) {
          hits.push([t, f, tau, lv], [t, f * 1.41, 0.012, lv * 0.6], [t, Math.min(19000, f * 2.1), 0.006, lv * 0.4]);
          t += s.r(0.04, 0.1) * Math.pow(0.6, b); lv *= 0.4;
        }
      }
      s.chain(s.data(impactData(1.2, hits, s.rnd), 0), rm);
    },
  },

  // ═════════ scare 10 v5_sub_check (sub5): the boat's pre-launch check — ballast blow, sail hatch, cradle clamps, systems
  {
    id: 'sub_ballast_hiss', variants: 1, dur: 4.0, vol: 1.0, ref: 10, rolloff: 0.55, send: 1.6, maxVoices: 1, minInterval: 1, priority: 4, when: 'late', levels: L5,
    render(s) {
      const rm = room(s, ER_HALL, 3500, 0.6, 1.0, 0.5);
      // the blow valve cracks open
      s.click(0, 0.9, 1800, 0.0015, rm);
      s.thump(0, 95, 40, 0.06, 0.08, 0.9, rm);
      metal(s, 0, 140, 0.35, 0.6, rm);
      // high-pressure air through the vents: a roar and a hiss, swelling then bleeding off
      const g = s.gain(0);
      s.env(g.gain, [[0.01, 0], [0.12, 1.0], [1.4, 0.85], [2.9, 0.6], [3.5, 0]]);
      g.connect(rm);
      const am = s.gain(0.75);
      const n2 = s.noise('pink', 0, 3.6, 0.5);
      const ag = s.gain(0.35); n2.connect(ag); ag.connect(am.gain);
      s.chain(s.noise('white', 0, 3.6), s.hp(1500), s.bp(3200, 0.5), am, g);
      s.chain(s.noise('pink', 0, 3.6), s.bp(700, 0.7), s.gain(0.7), g);
      s.chain(s.noise('brown', 0, 3.6), s.lp(160), s.gain(1.0), g);
      // water spat from the vents
      const d = crackleData(1.2, 250, s.rnd, { burst: 0.6, env: (x) => Math.exp(-x / 0.4) });
      s.chain(s.data(d, 0.1), s.bp(1700, 1), s.gain(0.45), rm);
    },
  },
  {
    // the sail hatch swings open on its actuator and stops against the hinge stop: a deep clang through the whole boat
    id: 'sub_hatch_clang', variants: 2, dur: 3.6, vol: 1.0, ref: 9, rolloff: 0.6, send: 1.6, maxVoices: 1, minInterval: 0.6, priority: 4, when: 'late', levels: L5,
    render(s) {
      const rm = room(s, ER_HALL, 2800, 0.6, 1.0, 0.5);
      clack(s, 0, 800, 0.5, 0.05, rm); // the latch
      hydraulic(s, 0.03, 0.9, 120, 0.25, rm);
      creak(s, 0.1, 0.8, 70, 110, 500, 0.12, rm); // the hinge
      const t = s.r(0.95, 1.05);
      s.click(t, 1.0, 1500, 0.002, rm);
      s.thump(t, 70, 28, 0.15, 0.22, 1.0, rm);
      s.burst({ start: t, color: 'pink', type: 'lowpass', f: 1100, Q: 0.7, a: 0.0005, tau: 0.06, level: 0.8, dst: rm });
      s.modal({ start: t, level: 0.8, modes: s.modes(s.r(88, 100), [1, 1.6, 2.53, 4.09, 6.4, 8.8], [1.8, 1.4, 1.0, 0.7, 0.45, 0.3], [1, 0.8, 0.6, 0.45, 0.3, 0.2], 0.04), dst: rm });
      plate(s, t + 0.003, 210, 0.3, 0.8, rm);
    },
    post(ch) { saturate(ch, 1.25); },
  },
  {
    // the cradle's five clamp arms cycle along the hull, one after another, on one hydraulic pack; relief valve at the end
    id: 'clamp_cycle', variants: 1, dur: 4.4, vol: 0.9, ref: 9, rolloff: 0.6, send: 1.5, maxVoices: 1, minInterval: 1, priority: 4, when: 'late', levels: L5,
    render(s) {
      const rm = room(s, ER_HALL, 3000, 0.5, 1.0);
      hydraulic(s, 0, 3.4, 105, 0.22, rm);
      for (let i = 0; i < 5; i++) {
        const t = 0.25 + i * 0.55;
        const far = s.lp(5000 - i * 700); far.connect(rm);
        clack(s, t, s.r(600, 800), 0.6, 0.05, far); // unlatch
        servo(s, t + 0.03, 0.28, 90, 140, 0.15, far);
        clunk(s, t + 0.33, s.r(75, 95), 0.85, 0.35, far); // re-seats on the saddle
        metal(s, t + 0.33, s.r(150, 190), 0.3, 0.5, far);
      }
      hiss(s, 3.3, 0.9, 0.4, 2600, rm); // relief
      clack(s, 3.3, 1100, 0.4, 0.03, rm);
    },
  },
  {
    // the boat's systems awake (loop, positional at the boat): inverter 400 Hz family, cooling fans, a gyro, relays.
    // 8 s loop: 400, 800, 1200, 87.5 (×8 = 700), 1250 Hz, LFO 1/8 → whole cycles.
    id: 'sub_systems_hum', loop: true, variants: 1, dur: 8, vol: 0.5, ref: 7, rolloff: 0.7, send: 1.1, when: 'lazy', levels: L5,
    render(s) {
      const D = LP(8);
      drone(s, 'sine', 400, D, 0.03);
      drone(s, 'sine', 800, D, 0.012);
      drone(s, 'sine', 1200, D, 0.006);
      drone(s, 'triangle', 87.5, D, 0.05, s.lp(400));
      drone(s, 'sine', 1250, D, 0.004);
      bed(s, 'pink', D, 0.14, 1 / 8, 0.2, s.bp(900, 0.8));
      bed(s, 'brown', D, 0.5, 0, 0, s.lp(120));
      for (let i = 0; i < 6; i++) clack(s, s.r(0.2, D - 0.3), s.r(1500, 2500), s.r(0.05, 0.1), 0.01);
    },
  },

  // ═════════ hatches, the wheel, the tunnel door, the keypad's power (§4.5–§4.8 vignettes)
  {
    // floor hatch: the wheel spun, the dogs pulled, the seal unsticking
    id: 'hatch_unlatch', variants: 1, dur: 1.5, vol: 0.85, ref: 4, send: 1.2, maxVoices: 1, minInterval: 0.5, priority: 3, when: 'late', levels: L5,
    render(s) {
      for (let i = 0; i < 6; i++) clack(s, i * 0.07, 1400 + i * 50, 0.28, 0.02); // the wheel's ratchet
      scrape(s, 0, 0.45, 900, 0.12);
      for (const t of [0.5, 0.62]) { clunk(s, t, 95, 0.8, 0.2); metal(s, t, 230, 0.2, 0.25); } // the dogs
      s.burst({ start: 0.85, color: 'pink', type: 'bandpass', f: 600, f1: 300, sweep: 0.2, Q: 1.5, a: 0.005, tau: 0.04, level: 0.4 }); // the seal lets go
      s.thump(0.85, 160, 70, 0.02, 0.03, 0.4);
    },
  },
  {
    // the lid lifts on its hinge (gas struts), locks open with a heavy clank, air from below
    id: 'hatch_open', variants: 1, dur: 2.6, vol: 0.9, ref: 4, send: 1.2, maxVoices: 1, minInterval: 0.5, priority: 3, when: 'late', levels: L5,
    render(s) {
      creak(s, 0, 1.2, 90, 140, 650, 0.25);
      hiss(s, 0.05, 1.1, 0.12, 2800); // struts
      s.burst({ start: 0.1, color: 'brown', type: 'lowpass', f: 300, Q: 0.7, a: 0.4, hold: 0.5, tau: 0.2, level: 0.25 }); // air rising from the void
      clunk(s, 1.3, 75, 1.0, 0.35); // open stop
      plate(s, 1.3, 140, 0.35, 0.5);
      clack(s, 1.34, 1800, 0.4, 0.02); // the stay latch
    },
  },
  {
    // lights_out5 (§4.7 L): breakers dropping out in a chain from the sub bay toward the spine — far first (dull), each
    // nearer and harder, the last one right here; ballasts tick off; the hum dies. The travel is baked in.
    id: 'lights_out_dock', variants: 1, dur: 4.4, vol: 1.0, ref: 12, rolloff: 0.5, send: 1.6, maxVoices: 1, minInterval: 1, priority: 5, when: 'late', levels: L5,
    render(s) {
      const steps = [0, 0.33, 0.62, 0.88, 1.1, 1.28];
      steps.forEach((t, i) => {
        const near = i / (steps.length - 1);
        const lp = s.lp(500 + near * near * 9000); lp.connect(s.out);
        const lv = 0.3 + 0.7 * near;
        clunk(s, t, s.r(60, 80), lv, 0.3 + 0.3 * near, lp);
        if (near > 0.5) { s.click(t, lv * 0.8, 2000, 0.0015, lp); plate(s, t, 110, lv * 0.3, 0.6, lp); }
        crackle(s, t + 0.003, 0.05 + 0.06 * near, 900, 0.25 * lv, 2600, lp); // the contactor arcs
      });
      // the mains hum falling with the last breaker
      const hum = s.gain(0);
      s.env(hum.gain, [[0, 0.12], [1.28, 0.12], [2.4, 0]]);
      s.chain(hum, s.lp(1500), s.out);
      for (const [h, a] of [[1, 1], [2, 0.6], [3, 0.35], [5, 0.15]] as const) {
        const o = s.osc('sawtooth', 60 * h, 0, 2.5);
        s.env(o.frequency, [[1.28, 60 * h], [2.4, 26 * h]], 'exp');
        s.chain(o, s.gain(a * 0.3), hum);
      }
      for (let i = 0; i < 10; i++) s.modal({ start: 1.3 + s.r(0, 1.8), level: s.r(0.03, 0.08), modes: s.modes(s.r(3000, 5200), [1, 2.6], [0.03, 0.015]) }); // tubes cooling
      s.burst({ start: 1.28, color: 'brown', type: 'lowpass', f: 140, Q: 0.7, a: 0.02, tau: 0.6, level: 0.6 });
    },
  },
  {
    // the tunnel manifold's wheel turned by hand: 4.0 s — stem thread, the grip ratcheting each quarter, it seats
    id: 'wheel_crank', variants: 1, dur: 4.6, vol: 0.85, ref: 4, send: 1.2, maxVoices: 1, minInterval: 1, priority: 3, when: 'late', levels: L5,
    render(s) {
      const g = s.gain(0);
      s.env(g.gain, [[0, 0], [0.1, 0.35], [3.7, 0.42], [3.95, 0]]);
      g.connect(s.out);
      const am = s.gain(0.6);
      const lfo = s.osc('sine', 2, 0, 4); const lg = s.gain(0.4); lfo.connect(lg); lg.connect(am.gain);
      s.chain(s.noise('white', 0, 4), s.bp(650, 3), am, g); // thread friction
      creak(s, 0.2, 3.5, 260, 420, 1400, 0.14); // the stem squealing in its packing
      for (let t = 0.3; t < 3.9; t += s.r(0.45, 0.55)) { clack(s, t, s.r(900, 1200), 0.5, 0.03); s.thump(t, 120, 60, 0.02, 0.03, 0.4); } // hand over hand
      clunk(s, 3.95, 90, 0.75, 0.3); // seats
      metal(s, 3.95, 260, 0.3, 0.3);
    },
  },
  {
    // the tunnel door's hydraulics release: valve, pressure bleeding off, the piston lets go, the line knocks
    id: 'hydraulic_release', variants: 1, dur: 2.4, vol: 0.9, ref: 6, rolloff: 0.8, send: 1.3, maxVoices: 1, minInterval: 1, priority: 4, when: 'late', levels: L5,
    render(s) {
      clack(s, 0, 1000, 0.6, 0.04);
      hiss(s, 0.02, 1.3, 0.55, 3000);
      s.burst({ start: 0.02, color: 'pink', type: 'bandpass', f: 800, Q: 0.7, a: 0.03, tau: 0.4, level: 0.4 });
      clunk(s, 0.5, 70, 0.9, 0.35); // piston
      for (let i = 0; i < 4; i++) { const t = 0.7 + i * s.r(0.12, 0.2); metal(s, t, s.r(240, 320), 0.18 * (1 - i * 0.2), 0.12); }
    },
  },
  {
    // key5_power (Kessler's power cue): the panel's relay, a supply coming up, two ready tones
    id: 'keypad_power_on', variants: 1, dur: 1.0, vol: 0.6, ref: 3, send: 0.8, maxVoices: 1, minInterval: 0.5, priority: 3, when: 'idle', levels: L5,
    render(s) {
      clunk(s, 0, 140, 0.4, 0.1);
      const o = s.osc('sine', 1800, 0.03, 0.4);
      s.env(o.frequency, [[0.03, 1800], [0.35, 7400]], 'exp');
      s.chain(o, s.ad(0.03, 0.05, 0.03, 0.12), s.out);
      beep(s, 0.42, 1318, 0.08, 0.35);
      beep(s, 0.54, 1760, 0.12, 0.35);
    },
  },

  // ═════════ the taken soldiers (enemies own these: W3a/W3b call audio.play at the muzzle / the point)
  {
    // a carbine shot heard from where the player stands (the shooter 5–35 m off): crack, body, the walls. 3 variants
    id: 'soldier_carbine_fire', variants: 3, dur: 0.7, vol: 0.8, ref: 7, rolloff: 0.9, send: 1.3, maxVoices: 6, minInterval: 0.04, priority: 3, peak: 0.95, pitchVar: 0.03, when: 'idle', levels: L5,
    render(s, v) { shot(s, [1, 0.96, 1.04][v] * s.r(0.98, 1.02), 1.0, 1.0, [1, 1.2, 0.85][v]); },
    post(ch) { saturate(ch, 1.6); },
  },
  {
    // a service pistol: sharper, less body, a louder crack for its size
    id: 'soldier_pistol_fire', variants: 3, dur: 0.6, vol: 0.72, ref: 6, rolloff: 0.9, send: 1.2, maxVoices: 4, minInterval: 0.08, priority: 3, peak: 0.95, pitchVar: 0.03, when: 'idle', levels: L5,
    render(s, v) { shot(s, [1.25, 1.2, 1.32][v] * s.r(0.98, 1.02), 0.6, 0.85, [0.8, 1, 0.7][v]); },
    post(ch) { saturate(ch, 1.4); },
  },
  {
    // the burst's room tail (audio plays it itself, once per burst, at the shooter, by the listener's room size: 0/1/2)
    id: 'soldier_fire_tail', variants: 3, dur: 2.4, vol: 0.5, ref: 8, rolloff: 0.7, maxVoices: 3, minInterval: 0.05, priority: 2, send: 0.6, peak: 0.8, pitchVar: 0.04, when: 'idle', levels: L5,
    render(s, v) {
      const len = [0.4, 1.0, 2.0][v];
      s.burst({ color: 'brown', type: 'lowpass', f: 900, f1: 130, sweep: len, Q: 0.7, a: 0.015, tau: len * 0.35, level: 0.5 });
      s.burst({ color: 'pink', type: 'bandpass', f: 700, f1: 200, sweep: len * 0.8, Q: 0.5, a: 0.01, tau: len * 0.25, level: 0.35 });
      const slaps: Array<[number, number]> = [[0.06, 0.3]];
      if (v >= 1) slaps.push([0.14, 0.2], [0.23, 0.13]);
      if (v >= 2) slaps.push([0.35, 0.16], [0.55, 0.1], [0.82, 0.07]);
      for (const [dt, lv] of slaps) s.burst({ start: dt * s.r(0.9, 1.1), color: 'pink', type: 'lowpass', f: 1300 - v * 250, Q: 0.6, a: 0.005, tau: 0.06 + v * 0.02, level: lv });
    },
  },
  {
    // the telegraph (§8.2.5 aim start): selector to fire + the stock settling into the shoulder — small but sharp
    id: 'soldier_aim_click', variants: 3, dur: 0.35, vol: 0.55, ref: 4, rolloff: 1.0, send: 0.9, maxVoices: 3, minInterval: 0.05, priority: 3, when: 'idle', levels: L5,
    render(s) {
      clack(s, 0, s.r(2600, 3100), 0.9, 0.012); // selector detent
      clack(s, s.r(0.06, 0.08), s.r(1300, 1600), 0.45, 0.02); // stock / sling hardware
      s.thump(0.07, 180, 90, 0.02, 0.02, 0.25);
    },
  },
  {
    // the weapon light coming on (§8.2.5 rise): a tailcap click and the faint whine of its driver
    id: 'soldier_light_on', variants: 2, dur: 0.3, vol: 0.45, ref: 3.5, rolloff: 1.0, send: 0.8, maxVoices: 3, minInterval: 0.05, priority: 2, when: 'idle', levels: L5,
    render(s) {
      clack(s, 0, s.r(2100, 2500), 0.8, 0.01);
      s.tone({ start: 0.005, f: 6200, a: 0.01, hold: 0.06, tau: 0.03, level: 0.025 });
    },
  },
  {
    // a reload in cover, audible ≤ 20 m: mag out, pouch, mag in, the bolt (≈ 2.1 s)
    id: 'soldier_reload', variants: 2, dur: 2.3, vol: 0.6, ref: 5, rolloff: 0.9, send: 1.0, maxVoices: 2, minInterval: 0.5, priority: 2, when: 'idle', levels: L5,
    render(s) {
      clack(s, 0.1, 3200, 0.5, 0.012);
      scrape(s, 0.12, 0.1, 1600, 0.18);
      s.thump(0.32, 200, 100, 0.02, 0.03, 0.35); // the empty against the vest
      for (let i = 0; i < 3; i++) s.modal({ start: s.r(0.5, 0.9), level: s.r(0.04, 0.08), modes: s.modes(s.r(1800, 3200), [1, 2.3], [0.015, 0.01]) }); // pouch
      s.burst({ start: 0.6, color: 'pink', type: 'bandpass', f: 1400, Q: 0.8, a: 0.05, tau: 0.08, level: 0.12 });
      scrape(s, 1.1, 0.07, 1500, 0.2);
      clack(s, 1.18, 1350, 0.9, 0.03); // seats
      s.thump(1.18, 230, 100, 0.03, 0.025, 0.5);
      clack(s, 1.6, 2200, 0.4, 0.014); // charging handle
      scrape(s, 1.61, 0.08, 2800, 0.18);
      clack(s, s.r(1.76, 1.8), 1250, 1.0, 0.045); // bolt home
      s.thump(1.78, 210, 90, 0.035, 0.03, 0.5);
    },
  },
  {
    // a pistol round passing within 2.5 m of the head (subsonic): a short ripping whistle with a doppler drop
    id: 'bullet_whiz', variants: 4, dur: 0.35, vol: 0.7, ref: 1.5, rolloff: 1.2, send: 0.4, maxVoices: 3, minInterval: 0.03, priority: 3, pitchVar: 0.08, when: 'idle', levels: L5,
    render(s) {
      const f0 = s.r(3200, 4200);
      const o = s.osc('sawtooth', f0, 0, 0.2);
      s.env(o.frequency, [[0, f0], [0.09, f0 * 0.82], [0.2, f0 * 0.55]], 'exp');
      const g = s.gain(0);
      s.env(g.gain, [[0, 0], [0.06, 0.4], [0.09, 0.55], [0.2, 0]]);
      s.chain(o, s.bp(f0, 4), g, s.out);
      const n = s.noise('white', 0, 0.22);
      const bp = s.bp(f0 * 1.2, 1.5);
      s.env(bp.frequency, [[0, f0 * 1.3], [0.2, f0 * 0.6]], 'exp');
      const g2 = s.gain(0);
      s.env(g2.gain, [[0, 0], [0.07, 0.4], [0.1, 0.6], [0.22, 0]]);
      s.chain(n, bp, g2, s.out);
    },
  },
  {
    // a carbine round passing within 2.5 m (supersonic): the N-wave crack — a hard double snap, then a short tear of air
    id: 'bullet_crack', variants: 4, dur: 0.3, vol: 0.75, ref: 1.5, rolloff: 1.2, send: 0.5, maxVoices: 3, minInterval: 0.03, priority: 3, pitchVar: 0.05, when: 'idle', levels: L5,
    render(s) {
      s.click(0, 1.0, 3000, 0.0004);
      s.burst({ color: 'white', type: 'highpass', f: 4000, Q: 0.5, a: 0.0001, tau: 0.002, level: 1.0 });
      s.click(s.r(0.0005, 0.0009), 0.8, 3500, 0.0004); // the second edge of the N-wave
      s.burst({ start: 0.001, color: 'white', type: 'bandpass', f: 2400, Q: 0.8, a: 0.0005, tau: 0.006, level: 0.5 });
      s.burst({ start: 0.004, color: 'pink', type: 'bandpass', f: 3500, f1: 1500, sweep: 0.1, Q: 1, a: 0.01, tau: 0.04, level: 0.25 }); // the tear
    },
  },
  {
    // boots (audio plays this itself on enemy:step, the surface chosen by position): variants 0–2 deck, 3–5 grate, 6–8 wet
    id: 'soldier_step', variants: 9, dur: 0.4, vol: 0.3, ref: 2.5, rolloff: 1.0, maxVoices: 4, priority: 1, minInterval: 0.03, send: 0.7, when: 'idle', levels: L5,
    render(s, v) { boot(s, Math.floor(v / 3)); },
  },
  {
    // a round into his plate carrier: the dull body hit and, on two variants of four, the plate's ping
    id: 'soldier_hit_vest', variants: 4, dur: 0.45, vol: 0.55, ref: 3, maxVoices: 3, minInterval: 0.02, priority: 3, send: 0.6, when: 'idle', levels: L5,
    render(s, v) {
      s.thump(0, s.r(110, 140), 50, 0.03, 0.04, 0.9);
      s.burst({ color: 'pink', type: 'lowpass', f: 600, Q: 0.9, a: 0.0008, tau: 0.03, level: 0.7 }); // into fabric and him
      s.burst({ start: 0.002, color: 'white', type: 'bandpass', f: s.r(1800, 2400), Q: 1.2, a: 0.0005, tau: 0.012, level: 0.3 }); // nylon
      if (v % 2 === 0) {
        s.click(0.001, 0.6, 3000, 0.0008);
        s.modal({ start: 0.001, level: 0.3, modes: s.modes(s.r(1900, 2500), [1, 1.58, 2.3, 3.1], [0.05, 0.035, 0.025, 0.015]) }); // steel / ceramic plate
      }
    },
  },
  {
    // he goes down: knees, the body and its gear, the weapon clattering away on the deck
    id: 'soldier_fall', variants: 2, dur: 1.7, vol: 0.75, ref: 3.5, send: 1.0, maxVoices: 2, minInterval: 0.2, priority: 3, when: 'idle', levels: L5,
    render(s) {
      s.thump(0, 120, 55, 0.03, 0.04, 0.5); // knees
      s.burst({ color: 'pink', type: 'lowpass', f: 700, Q: 0.7, a: 0.002, tau: 0.03, level: 0.4 });
      const t = s.r(0.32, 0.4);
      s.thump(t, 95, 38, 0.05, 0.08, 1.0); // the body
      s.burst({ start: t, color: 'pink', type: 'lowpass', f: 900, Q: 0.7, a: 0.002, tau: 0.05, level: 0.8 });
      for (let i = 0; i < 6; i++) s.modal({ start: t + s.r(0, 0.12), level: s.r(0.06, 0.14), modes: s.modes(s.r(1500, 3200), [1, 2.3, 3.6], [0.02, 0.012, 0.008]) }); // gear
      plate(s, t, 180, 0.15, 0.15); // the deck
      // the weapon hits the deck and slides
      const tw = t + s.r(0.12, 0.2);
      metal(s, tw, s.r(700, 900), 0.4, 0.1);
      clack(s, tw, 1500, 0.5, 0.03);
      scrape(s, tw + 0.02, 0.35, 1800, 0.12);
      metal(s, tw + 0.38, s.r(650, 800), 0.15, 0.08);
      s.burst({ start: t + 0.3, color: 'pink', type: 'lowpass', f: 400, Q: 0.7, a: 0.2, tau: 0.2, level: 0.12 }); // settling
    },
  },
  {
    // the Clasp at his nape fails as he dies: three short descending beeps, quiet
    id: 'clasp_fail', variants: 1, dur: 0.75, vol: 0.32, ref: 2, rolloff: 1.1, send: 0.6, maxVoices: 2, minInterval: 0.3, priority: 2, pitchVar: 0, when: 'idle', levels: L5,
    render(s) {
      for (let i = 0; i < 3; i++) beep(s, i * 0.17, [2093, 1760, 1397][i], 0.075, 0.4, undefined, 'triangle');
    },
  },

  // ═════════ keypad (UI owns these: W2a calls audio.play) — 2-D, UI bus
  {
    id: 'keypad_beep', variants: 3, dur: 0.15, vol: 0.4, bus: 'ui', maxVoices: 3, minInterval: 0.03, pitchVar: 0.005, volVar: 0.05, when: 'idle', levels: L5,
    render(s, v) {
      clack(s, 0, 2400, 0.35, 0.008); // the rubber key bottoms on its contact
      beep(s, 0.004, [1336, 1477, 1209][v], 0.085, 0.3);
    },
  },
  {
    id: 'keypad_err', variants: 1, dur: 0.6, vol: 0.45, bus: 'ui', maxVoices: 1, minInterval: 0.2, pitchVar: 0, when: 'idle', levels: L5,
    render(s) { beep(s, 0, 220, 0.16, 0.35, undefined, 'sawtooth'); beep(s, 0.24, 196, 0.26, 0.35, undefined, 'sawtooth'); },
  },
  {
    id: 'keypad_ok', variants: 1, dur: 0.7, vol: 0.45, bus: 'ui', maxVoices: 1, minInterval: 0.2, pitchVar: 0, when: 'idle', levels: L5,
    render(s) {
      beep(s, 0, 1046, 0.09, 0.3); beep(s, 0.11, 1318, 0.09, 0.3); beep(s, 0.22, 1568, 0.16, 0.3);
      clunk(s, 0.34, 120, 0.35, 0.1); // the door's lock relay
    },
  },
  {
    // a key pressed on a dead panel (NO AUTHORITY): the rubber key and nothing else
    id: 'keypad_dead', variants: 3, dur: 0.12, vol: 0.4, bus: 'ui', maxVoices: 2, minInterval: 0.05, when: 'idle', levels: L5,
    render(s) {
      clack(s, 0, s.r(1800, 2300), 0.4, 0.006);
      s.burst({ start: 0.001, color: 'pink', type: 'lowpass', f: 700, Q: 0.8, a: 0.001, tau: 0.008, level: 0.15 });
    },
  },

  // ═════════ story: the body's radio squawks (static burst before l5_kes_squawk_*)
  {
    id: 'radio_squawk', variants: 3, dur: 0.7, vol: 0.6, ref: 5, rolloff: 1.0, // 3d coordinator: ref 2 → 5 (it guides the player to the body at 6–12 m)
    send: 0.6, maxVoices: 1, minInterval: 0.3, priority: 3, when: 'idle', levels: L5,
    render(s) {
      const spk = s.gain(1);
      s.chain(spk, s.hp(420), s.pk(1900, 1, 6), s.shaper('tanh', 3), s.lp(3000), s.out);
      s.click(0, 0.5, 2500, 0.001, spk); // key-up
      const g = s.gain(0);
      s.env(g.gain, [[0, 0], [0.01, 0.6], [0.3, 0.45], [0.45, 0]]);
      s.chain(s.noise('white', 0, 0.5), s.bp(2000, 0.6), g, spk);
      const d = crackleData(0.45, 200, s.rnd, { burst: 0.7 });
      s.chain(s.data(d, 0), s.gain(0.6), spk);
      // a broken fragment of a carrier (a voice that never arrives)
      s.tone({ start: s.r(0.1, 0.2), type: 'square', f: s.r(600, 900), a: 0.005, hold: 0.06, tau: 0.02, level: 0.06, dst: spk });
      s.click(0.46, 0.4, 2500, 0.001, spk);
    },
  },

  // ═════════ player footsteps in puddles (§2.9; audio picks it from `level.regions.wet`)
  {
    id: 'step_wet', variants: 6, dur: 0.45, vol: 0.22, maxVoices: 3, priority: 0, minInterval: 0.06, ref: 1.5, send: 0.6, when: 'idle', levels: L5,
    render(s) {
      const f = s.r(65, 80);
      s.thump(0, f * 1.6, f, 0.025, 0.018, 0.8);
      s.burst({ color: 'pink', type: 'lowpass', f: 700, Q: 0.7, a: 0.0015, tau: 0.014, level: 0.5 });
      s.modal({ start: 0.001, level: 0.14, modes: s.modes(s.r(300, 380), [1, 2.9, 5.1], [0.04, 0.03, 0.02]) });
      splash(s, 0.003, 0.6);
      const t2 = s.r(0.05, 0.075);
      s.thump(t2, 120, 85, 0.02, 0.015, 0.25);
      splash(s, t2, 0.3);
    },
  },

  // ═════════ ambience beds (stereo, bus ambience; mixed by the level-5 room presets, impulses.ts ROOMS_L5)
  {
    // Post 4 lit: navy ventilation, 4000 K fluorescents (100/200 Hz + a ballast whine), the hull, a distant machinery throb
    id: 'amb_post', loop: true, variants: 1, dur: 12, vol: 0.5, bus: 'ambience', channels: 2, when: 'idle', levels: L5,
    render(s) {
      const D = LP(12);
      bed(s, 'brown', D, 1.0, 1 / 12, 0.15, s.lp(85), s.pan(-0.3));
      bed(s, 'brown', D, 1.0, 1 / 6, 0.15, s.lp(90), s.pan(0.3));
      bed(s, 'pink', D, 0.06, 1 / 4, 0.25, s.bp(340, 1.6), s.pan(-0.45)); // supply duct
      bed(s, 'pink', D, 0.035, 1 / 3, 0.2, s.bp(1300, 0.8), s.pan(0.45));
      bed(s, 'white', D, 0.008, 0, 0, s.hp(4500), s.pan(0)); // diffuser hiss
      drone(s, 'sine', 120, D, 0.012, s.pan(-0.2)); // fluorescent tubes (navy 60 Hz mains)
      drone(s, 'sine', 240, D, 0.004, s.pan(0.2));
      drone(s, 'sine', 60, D, 0.02);
      drone(s, 'sine', 2250, D, 0.0009, s.pan(0.35)); // ballast whine
      const am = s.gain(0.035);
      const lf = s.osc('sine', 0.5, 0, D); const lg = s.gain(0.025); lf.connect(lg); lg.connect(am.gain);
      s.chain(s.osc('sine', 28, 0, D), am, s.out); // the dock pumps, far
      for (let i = 0; i < 4; i++) { const p = s.pan(s.r(-0.9, 0.9)); p.connect(s.out); s.modal({ start: s.r(0.5, 11.5), level: s.r(0.015, 0.03), modes: s.modes(s.r(1800, 3600), [1, 1.53, 2.8], [0.08, 0.05, 0.03]), dst: p }); } // hull ticks
    },
  },
  {
    // berthing at night: low air, a small fan in the passage, the red night lights' transformers, the hull very close
    id: 'amb_berth', loop: true, variants: 1, dur: 12, vol: 0.42, bus: 'ambience', channels: 2, when: 'idle', levels: L5,
    render(s) {
      const D = LP(12);
      bed(s, 'brown', D, 0.8, 1 / 12, 0.2, s.lp(100), s.pan(-0.25));
      bed(s, 'brown', D, 0.8, 1 / 6, 0.2, s.lp(105), s.pan(0.25));
      bed(s, 'pink', D, 0.03, 1 / 4, 0.3, s.bp(480, 1.2), s.pan(0.5)); // the passage fan
      drone(s, 'triangle', 75, D, 0.006, s.lp(300), s.pan(0.5)); // its blade pass
      drone(s, 'sine', 60, D, 0.01, s.pan(-0.3)); // night-light transformers
      drone(s, 'sine', 180, D, 0.002, s.pan(-0.3));
      for (let i = 0; i < 3; i++) { const p = s.pan(s.r(-0.8, 0.8)); p.connect(s.out); s.modal({ start: s.r(0.5, 11.5), level: s.r(0.012, 0.025), modes: s.modes(s.r(1500, 3000), [1, 1.53, 2.8], [0.1, 0.06, 0.03]), dst: p }); }
    },
  },
  {
    // the crawlway under the spine's grating: a steel channel 1.35 m high — close rumble, the spine's air coming through
    // the bars above (band-limited), a thin air leak, very little top end
    id: 'amb_crawl', loop: true, variants: 1, dur: 12, vol: 0.5, bus: 'ambience', channels: 2, when: 'idle', levels: L5,
    render(s) {
      const D = LP(12);
      bed(s, 'brown', D, 1.1, 1 / 12, 0.2, s.lp(110), s.pan(-0.2));
      bed(s, 'brown', D, 1.1, 1 / 4, 0.15, s.lp(115), s.pan(0.2));
      bed(s, 'pink', D, 0.03, 1 / 6, 0.4, s.bp(380, 2.5), s.lp(900), s.pan(0)); // the spine above, through the grating
      bed(s, 'white', D, 0.006, 1 / 3, 0.5, s.bp(5200, 4), s.pan(0.6)); // a thin leak
      drone(s, 'sine', 45, D, 0.02); // a channel mode
      drone(s, 'sine', 60, D, 0.004, s.lp(200));
    },
  },
  {
    // the sub bay: a 12 m dry dock — wide hall rumble with slow swells, the high ventilation, the flooded launch lock
    // pressing (28 Hz), the mains, the hull ticking far up
    id: 'amb_bay', loop: true, variants: 1, dur: 12, vol: 0.58, bus: 'ambience', channels: 2, when: 'idle', levels: L5,
    render(s) {
      const D = LP(12);
      bed(s, 'brown', D, 1.2, 1 / 12, 0.3, s.lp(75), s.pan(-0.5));
      bed(s, 'brown', D, 1.2, 1 / 6, 0.3, s.lp(78), s.pan(0.5));
      bed(s, 'pink', D, 0.07, 1 / 4, 0.35, s.bp(420, 0.8), s.pan(-0.7)); // high vents
      bed(s, 'pink', D, 0.07, 1 / 3, 0.35, s.bp(460, 0.8), s.pan(0.7));
      bed(s, 'pink', D, 0.025, 1 / 12, 0.5, s.bp(1700, 0.7), s.pan(0));
      drone(s, 'sine', 28, D, 0.05);
      drone(s, 'sine', 60, D, 0.012, s.pan(-0.2));
      drone(s, 'sine', 120, D, 0.006, s.pan(0.2));
      for (let i = 0; i < 7; i++) { const p = s.pan(s.r(-1, 1)); p.connect(s.out); s.modal({ start: s.r(0.4, 11.6), level: s.r(0.012, 0.03), modes: s.modes(s.r(900, 2600), [1, 1.53, 2.8], [0.3, 0.2, 0.1]), dst: p }); }
    },
  },
  {
    // after lights_out5 (spine5, sub5): the mains are gone — only the sea on the hull, water moving past outside, the
    // hard-wired emergency inverters' faint whine, and the bed breathing slowly
    id: 'amb_dark', loop: true, variants: 1, dur: 12, vol: 0.55, bus: 'ambience', channels: 2, when: 'idle', levels: L5,
    render(s) {
      const D = LP(12);
      bed(s, 'brown', D, 1.3, 1 / 12, 0.4, s.lp(55), s.pan(-0.4));
      bed(s, 'brown', D, 1.3, 1 / 6, 0.4, s.lp(58), s.pan(0.4));
      drone(s, 'sine', 24, D, 0.06);
      drone(s, 'sine', 37, D, 0.025);
      for (const [p, r] of [[-0.7, 1 / 12], [0.7, 1 / 6]] as const) {
        const n = s.noise('pink', 0, D);
        const f = s.bp(200, 2.5);
        const lf = s.osc('sine', r, 0, D); const lg = s.gain(80); lf.connect(lg); lg.connect(f.frequency);
        s.chain(n, f, s.gain(0.035), s.pan(p), s.out); // water past the hull
      }
      drone(s, 'sine', 400, D, 0.0015, s.pan(0.4)); // emergency inverters
      drone(s, 'sine', 1200, D, 0.0006, s.pan(-0.4));
    },
  },
];

