/**
 * Stage 3b "생물 시스템" (technical level 4; plan docs/plans/stage-3b.md §4, §8.2, §8.3, §8.5, §11 W2b): the
 * carbine, armour, and the clean side / navy level / tube: decon, air shower, the containment hold, lights-out, the unit
 * bay, ceiling vents, the theatre's Clasp and gel bath, the tube plant (pumps, valve, sump, beacon), the Post 4 gate, the
 * tube under sea pressure, shots into the dead.
 *
 * Pre-render: carbine + armour `idle` on level 4 and later (they carry); level-4 one-shots `late`, loops `lazy`, beds and
 * the sounds a scene needs in its first seconds (`decon_hiss`, `body_hit`, `tube_groan`) `idle` — all `levels: [4]`
 * (they still render on demand anywhere).
 *
 * Ids (one-shots): carbine_fire carbine_tail carbine_mag_out carbine_mag_in carbine_bolt carbine_empty carbine_raise
 *   vest_on plate_in armor_hit armor_break decon_hiss shower_jets hold_beep cold_jam_beep lights_thunk bay_door
 *   vent_grille clasp_click gel_dip valve_pull sump_lift gate_dogs tube_groan body_hit
 * Loops: pump_loop alarm_beacon; ambience beds amb_clean amb_cold amb_navy amb_plant amb_tube.
 * (`arm_servo_loop` is the existing level-1 id in loops.ts, reused unchanged.)
 *
 * Loops: every periodic component has a whole number of cycles in the loop (f × dur ∈ ℕ, LFOs included), so the
 * render's crossfade fold is exact for tones and only noise is blended.
 */
import { crackleData, type SoundDef, type Synth } from '../synth/core';
import { saturate } from '../synth/post';
import { clack, scrape } from './weapons';
import { clunk, crackle, hiss, servo } from './world';

/** Level 4 and the levels after it (carried weapons and armour). */
const L4UP = [4, 5, 6, 7, 8] as const;
const L4 = [4] as const;
/** Rendered span of a loop: the loop plus the crossfade tail (render.ts LOOP_XF ≤ 0.6). */
const L = (d: number) => d + 0.7;

function drone(s: Synth, type: OscillatorType, f: number, dur: number, level: number, ...chain: AudioNode[]): OscillatorNode {
  const o = s.osc(type, f, 0, dur);
  s.chain(o, ...chain, s.gain(level), s.out);
  return o;
}

/** Noise bed; optional amplitude LFO at a FIXED rate (choose rate × loop length ∈ ℕ for seamless loops). */
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

/** Electronic panel beep (square through a small speaker). */
function beep(s: Synth, t: number, f: number, len: number, level: number, dst?: AudioNode): void {
  const g = s.gain(0);
  s.env(g.gain, [[t, 0], [t + 0.004, level], [t + len - 0.006, level], [t + len, 0]]);
  s.chain(s.osc('square', f, t, len + 0.02), s.lp(f * 3.2), s.hp(400), g, dst ?? s.out);
}

/** Hook-and-loop strap ripped open / pressed shut (dense crackle through a nylon band). */
function velcro(s: Synth, t: number, dur: number, level: number, dst?: AudioNode): void {
  const d = crackleData(dur, 5200, s.rnd, { burst: 0.15, env: (x) => Math.sin(Math.PI * Math.min(1, x / dur)) });
  s.chain(s.data(d, t), s.bp(s.r(2600, 3400), 0.7), s.gain(level), dst ?? s.out);
  s.burst({ start: t, color: 'pink', type: 'bandpass', f: 1400, Q: 0.8, a: dur * 0.3, hold: dur * 0.3, tau: dur * 0.15, level: level * 0.25, dst });
}

/** Nylon / tyvek rustle. */
function rustle(s: Synth, t: number, dur: number, level: number, f = 1500, dst?: AudioNode): void {
  const n = s.noise('pink', t, dur + 0.05);
  const g = s.gain(0);
  s.env(g.gain, [[t, 0], [t + dur * 0.3, level], [t + dur * 0.6, level * 0.5], [t + dur, 0]]);
  s.chain(n, s.bp(f, 0.7), g, dst ?? s.out);
}

/** Muzzle report shared by the carbine variants: crack, driven body, gas thump; `tail` = own short slap. */
function report(s: Synth, k: number, tail: number): void {
  const body = s.gain(1);
  s.chain(body, s.shaper('tanh', 2.8), s.out);
  s.click(0, 1.0, 2200, 0.0007);
  // supersonic crack: brighter and tighter than the pistol
  s.burst({ color: 'white', type: 'bandpass', f: 3300 * k, Q: 0.7, a: 0.0002, tau: 0.012, level: 1.5 });
  s.burst({ color: 'white', type: 'bandpass', f: 6800 * k, Q: 0.9, a: 0.0002, tau: 0.007, level: 0.55 });
  s.burst({ color: 'white', type: 'bandpass', f: 1500 * k, Q: 0.8, a: 0.0003, tau: 0.022, level: 1.0, dst: body });
  s.burst({ color: 'pink', type: 'lowpass', f: 1700, Q: 0.8, a: 0.0005, tau: 0.035, level: 1.1, dst: body });
  s.thump(0, 170 * k, 62, 0.04, 0.032, 0.85, body);
  s.thump(0.002, 90, 45, 0.06, 0.05, 0.3);
  // bolt carrier cycling (the rifle's own rhythm under the shot)
  clack(s, s.r(0.016, 0.022), 2700 * k, 0.16, 0.014);
  clack(s, s.r(0.042, 0.05), 1900 * k, 0.12, 0.018);
  // own slap (the room's tail comes from the reverb send and carbine_tail)
  s.burst({ start: 0.003, color: 'pink', type: 'lowpass', f: 2600, f1: 300, sweep: 0.3, Q: 0.6, a: 0.006, tau: 0.07 * tail, level: 0.22 });
  s.burst({ start: 0.03 * tail, color: 'pink', type: 'bandpass', f: 1100, Q: 0.6, a: 0.004, tau: 0.05, level: 0.12 });
}

/** Ceramic / composite plate knock (armour). */
function plateKnock(s: Synth, t: number, f0: number, level: number, dst?: AudioNode): void {
  s.modal({ start: t, level: level * 0.6, modes: s.modes(f0, [1, 1.58, 2.27, 3.1], [0.03, 0.022, 0.015, 0.01], [1, 0.6, 0.4, 0.25], 0.04), dst });
  s.thump(t, f0 * 0.32, f0 * 0.15, 0.03, 0.03, level * 0.7, dst);
  s.burst({ start: t, color: 'pink', type: 'bandpass', f: f0 * 1.4, Q: 0.9, a: 0.0005, tau: 0.012, level: level * 0.5, dst });
}

/** Pump set: motor (whole-number harmonics of f), vane pass, flow. `f` × loop length must be whole. */
function pumpSet(s: Synth, D: number, f: number, level: number, pan: number): void {
  const p = s.pan(pan); p.connect(s.out);
  const sh = s.shaper('tanh', 2.2);
  s.chain(sh, s.lp(1400), s.gain(level * 0.5), p);
  for (const [h, a] of [[1, 1], [2, 0.7], [3, 0.35], [4, 0.3], [6, 0.18]] as const) s.chain(s.osc('sine', f * h, 0, D), s.gain(a * 0.4), sh);
  // impeller vane pass (7 vanes) with a little roughness
  const vp = s.osc('triangle', f * 7, 0, D);
  s.chain(vp, s.bp(f * 7, 3), s.gain(level * 0.12), p);
  // water through the volute
  const n = s.noise('pink', 0, D);
  s.chain(n, s.bp(380, 0.9), s.gain(level * 0.55), p);
  const n2 = s.noise('white', 0, D);
  s.chain(n2, s.bp(2100, 1.2), s.gain(level * 0.07), p);
  const n3 = s.noise('brown', 0, D);
  s.chain(n3, s.lp(140), s.gain(level * 0.9), p);
}

export const rev9Sounds: SoundDef[] = [
  // ═════════ carbine (§8.3): 600 rpm, so the shot itself is short; the burst's room tail is carbine_tail
  {
    id: 'carbine_fire', variants: 3, dur: 0.55, vol: 0.72, maxVoices: 4, minInterval: 0.05, priority: 3, send: 1.2, ref: 6, peak: 0.95, pitchVar: 0.03,
    when: 'idle', levels: L4UP,
    render(s, v) { report(s, s.r(0.95, 1.05) * [1, 0.97, 1.03][v], [1, 1.4, 0.8][v]); },
    post(ch) { saturate(ch, 1.5); },
  },
  {
    // played once when a burst ends (index.ts: 0.11 s after the last round). Variant by room size: 0 small, 1 medium, 2 large
    id: 'carbine_tail', variants: 3, dur: 2.4, vol: 0.5, maxVoices: 2, priority: 2, send: 0.6, pitchVar: 0.03, peak: 0.8, when: 'idle', levels: L4UP,
    render(s, v) {
      const len = [0.35, 0.9, 1.9][v];
      s.burst({ color: 'brown', type: 'lowpass', f: 1100, f1: 140, sweep: len, Q: 0.7, a: 0.01, tau: len * 0.32, level: 0.5 });
      s.burst({ color: 'pink', type: 'bandpass', f: 800, f1: 220, sweep: len * 0.8, Q: 0.5, a: 0.008, tau: len * 0.22, level: 0.35 });
      s.thump(0, 80, 38, 0.15, 0.08 + 0.05 * v, 0.35);
      const slaps = [[0.045, 0.3]] as Array<[number, number]>;
      if (v >= 1) slaps.push([0.11, 0.2], [0.19, 0.12]);
      if (v >= 2) slaps.push([0.27, 0.16], [0.46, 0.1], [0.7, 0.06]);
      for (const [dt, lv] of slaps) s.burst({ start: dt * s.r(0.9, 1.1), color: 'pink', type: 'lowpass', f: 1500 - v * 300, Q: 0.6, a: 0.004, tau: 0.05 + v * 0.02, level: lv });
    },
  },
  {
    id: 'carbine_mag_out', variants: 2, dur: 0.5, vol: 0.42, send: 0.4, when: 'idle', levels: L4UP,
    render(s) {
      clack(s, 0, 3400, 0.4, 0.01); // release paddle
      scrape(s, 0.015, 0.09, 1700, 0.18); // polymer mag sliding out of the well
      s.burst({ start: 0.02, color: 'pink', type: 'bandpass', f: 900, Q: 1, a: 0.01, tau: 0.03, level: 0.15 });
      clack(s, 0.12, 1100, 0.3, 0.025); // in the hand
      s.thump(0.12, 200, 110, 0.03, 0.02, 0.25);
    },
  },
  {
    id: 'carbine_mag_in', variants: 2, dur: 0.45, vol: 0.48, send: 0.4, when: 'idle', levels: L4UP,
    render(s) {
      scrape(s, 0, 0.07, 1600, 0.22);
      clack(s, 0.075, 1350 * s.r(0.95, 1.05), 0.8, 0.03); // seats
      s.thump(0.075, 230, 100, 0.03, 0.025, 0.5);
      clack(s, 0.09, 2600, 0.35, 0.01); // catch
      s.burst({ start: 0.14, color: 'pink', type: 'lowpass', f: 600, Q: 0.8, a: 0.001, tau: 0.02, level: 0.3 }); // palm slap
    },
  },
  {
    id: 'carbine_bolt', variants: 2, dur: 0.6, vol: 0.52, send: 0.5, when: 'idle', levels: L4UP,
    render(s) {
      clack(s, 0, 2200, 0.35, 0.014); // charging handle unlatches
      scrape(s, 0.01, 0.08, 2900, 0.2);
      s.modal({ start: 0.02, level: 0.06, modes: [[s.r(700, 820), 0.08, 1], [s.r(1900, 2100), 0.04, 0.5]] }); // buffer spring
      const t2 = s.r(0.16, 0.2);
      clack(s, t2, 1250 * s.r(0.95, 1.05), 1.0, 0.045); // bolt slams home
      s.thump(t2, 210, 90, 0.035, 0.03, 0.5);
      clack(s, t2 + 0.025, 3000, 0.25, 0.008); // handle back in
    },
  },
  {
    id: 'carbine_empty', variants: 2, dur: 0.3, vol: 0.45, send: 0.4, minInterval: 0.08, when: 'idle', levels: L4UP,
    render(s) {
      clack(s, 0, 2500 * s.r(0.95, 1.05), 0.7, 0.01); // hammer on nothing
      clack(s, 0.012, 1500, 0.25, 0.02); // the locked-back bolt rings dully
      s.thump(0, 360, 180, 0.015, 0.012, 0.2);
    },
  },
  {
    id: 'carbine_raise', variants: 2, dur: 0.6, vol: 0.38, maxVoices: 2, send: 0.3, when: 'idle', levels: L4UP,
    render(s) {
      rustle(s, 0, 0.3, 0.32, s.r(1200, 1700));
      for (let i = 0; i < 4; i++) s.modal({ start: s.r(0.02, 0.18), level: s.r(0.04, 0.09), modes: s.modes(s.r(2400, 4200), [1, 2.4], [0.012, 0.007]) }); // sling hardware
      clack(s, 0.16, 1900, 0.45, 0.02); // stock locks open
      clack(s, 0.3, 1200, 0.6, 0.03); // shouldered
      s.thump(0.3, 170, 90, 0.03, 0.03, 0.3);
    },
  },

  // ═════════ armour (§8.2)
  {
    // the 0.8 s strap: nylon, two hook-and-loop straps, the side buckle, a pat on the plate
    id: 'vest_on', variants: 2, dur: 1.0, vol: 0.5, maxVoices: 1, minInterval: 0.3, send: 0.4, when: 'idle', levels: L4UP,
    render(s) {
      rustle(s, 0, 0.35, 0.35, 1300);
      velcro(s, s.r(0.2, 0.24), 0.16, 0.6);
      velcro(s, s.r(0.44, 0.5), 0.13, 0.5);
      clack(s, 0.66, 1700, 0.5, 0.02); // buckle
      plateKnock(s, 0.8, 620, 0.6); // pat
    },
  },
  {
    id: 'plate_in', variants: 2, dur: 0.6, vol: 0.5, maxVoices: 2, minInterval: 0.15, send: 0.4, when: 'idle', levels: L4UP,
    render(s) {
      rustle(s, 0, 0.18, 0.3, 1800);
      scrape(s, 0.04, 0.12, 900, 0.12); // into the pouch
      plateKnock(s, 0.17, s.r(700, 800), 0.9);
      velcro(s, 0.3, 0.09, 0.35); // flap shut
    },
  },
  {
    // hit taken mostly by the plate (absorbed ≥ 60 %): a hard dull knock with a short composite ring — not flesh
    id: 'armor_hit', variants: 4, dur: 0.4, vol: 0.5, maxVoices: 2, priority: 2, minInterval: 0.04, when: 'idle', levels: L4UP,
    render(s) {
      const d = s.gain(1);
      s.chain(d, s.shaper('tanh', 2), s.out);
      plateKnock(s, 0, s.r(820, 1050), 1.0, d);
      s.thump(0, 120, 50, 0.04, 0.04, 0.5, d);
      s.burst({ color: 'white', type: 'bandpass', f: s.r(2200, 2800), Q: 1.1, a: 0.0003, tau: 0.01, level: 0.4 });
    },
  },
  {
    // armour reaches 0: the plate cracks through
    id: 'armor_break', variants: 2, dur: 0.9, vol: 0.6, maxVoices: 1, priority: 3, minInterval: 0.3, when: 'idle', levels: L4UP,
    render(s) {
      plateKnock(s, 0, 700, 1.0);
      crackle(s, 0.004, 0.14, 2600, 0.7, 2800); // fracture
      const d = crackleData(0.25, 600, s.rnd, { burst: 0.6, env: (x) => Math.exp(-x / 0.07) });
      s.chain(s.data(d, 0.01), s.lp(2200), s.gain(0.6), s.out); // fragments grinding
      s.thump(0.01, 95, 32, 0.25, 0.12, 0.7);
      for (let i = 0; i < 3; i++) s.modal({ start: s.r(0.06, 0.3), level: s.r(0.05, 0.12), modes: s.modes(s.r(1800, 3600), [1, 1.9, 3.1], [0.02, 0.012, 0.008]) });
    },
  },

  // ═════════ entry: decon, air shower (§4.1, §4.2)
  {
    // the 8.0 s decon count: valve, eight seconds of mist from the ceiling nozzles, valve, extraction
    id: 'decon_hiss', variants: 1, dur: 9.0, vol: 0.55, ref: 4, rolloff: 0.8, send: 0.9, maxVoices: 1, priority: 3, when: 'idle', levels: L4,
    render(s) {
      clack(s, 0, 1500, 0.5, 0.03); // solenoid
      s.thump(0, 140, 60, 0.05, 0.05, 0.4);
      s.burst({ start: 0.02, color: 'brown', type: 'lowpass', f: 400, Q: 0.7, a: 0.03, tau: 0.25, level: 0.5 }); // the line pressurises
      const mist = s.gain(0);
      s.env(mist.gain, [[0, 0], [0.18, 0.6], [1.0, 0.5], [7.9, 0.5], [8.02, 0]]);
      mist.connect(s.out);
      const n = s.noise('white', 0, 8.1);
      s.chain(n, s.hp(1800), s.bp(5200, 0.5), mist);
      const n2 = s.noise('pink', 0, 8.1);
      s.chain(n2, s.bp(2200, 0.8), s.gain(0.5), mist);
      // nozzle sputter: a slow 6 Hz flutter on part of the mist
      const sp = s.gain(0.35);
      const lfo = s.osc('sine', 6, 0, 8.1);
      const lg = s.gain(0.25);
      lfo.connect(lg); lg.connect(sp.gain);
      s.chain(s.noise('white', 0, 8.1), s.bp(3600, 2), sp, mist);
      clack(s, 8.0, 1300, 0.55, 0.03); // valve shut
      s.thump(8.0, 120, 55, 0.04, 0.05, 0.35);
      hiss(s, 8.05, 0.5, 0.18, 2500); // line bleeds
      for (let i = 0; i < 4; i++) s.modal({ start: 8.15 + s.r(0, 0.6), level: s.r(0.04, 0.08), modes: s.modes(s.r(1100, 1600), [1, 2.2], [0.03, 0.02]) }); // drips
    },
  },
  {
    // air shower: blowers spin up, both walls' jets roar for 6.0 s (stereo: one jet wall per side), spin down
    id: 'shower_jets', variants: 1, dur: 7.6, vol: 0.65, channels: 2, ref: 4, rolloff: 0.8, send: 0.8, maxVoices: 1, priority: 3, when: 'late', levels: L4,
    render(s) {
      for (const side of [-1, 1]) {
        const p = s.pan(side * 0.85); p.connect(s.out);
        const roar = s.gain(0);
        s.env(roar.gain, [[0, 0], [0.5, 0.75], [6.0, 0.75], [6.9, 0.05], [7.5, 0]]);
        roar.connect(p);
        s.chain(s.noise('pink', 0, 7.6), s.bp(1400 * (side < 0 ? 1 : 1.07), 0.6), roar);
        s.chain(s.noise('white', 0, 7.6), s.hp(3000), s.lp(9000), s.gain(0.12), roar);
        s.chain(s.noise('pink', 0, 7.6), s.bp(500, 0.8), s.gain(0.6), roar); // the blower's own push
        // blower whine
        const o = s.osc('sawtooth', 70, 0, 7.6);
        s.env(o.frequency, [[0, 70], [0.6, side < 0 ? 410 : 418], [6.0, side < 0 ? 410 : 418], [7.5, 90]], 'exp');
        const wg = s.gain(0);
        s.env(wg.gain, [[0, 0], [0.4, 0.05], [6.0, 0.05], [7.5, 0]]);
        s.chain(o, s.lp(1200), wg, p);
      }
      clunk(s, 0, 110, 0.4, 0.15); // contactor
    },
  },
  // ═════════ clean side panels (§4.3)
  {
    // containment hold panel: two low-priority tones (repeat it every 2–4 s while held)
    id: 'hold_beep', variants: 1, dur: 0.6, vol: 0.22, ref: 3, send: 0.7, maxVoices: 2, minInterval: 0.3, pitchVar: 0, volVar: 0.03, when: 'late', levels: L4,
    render(s) { beep(s, 0, 698, 0.16, 0.5); beep(s, 0.26, 523, 0.2, 0.5); },
  },
  {
    // Cold Store 2's door, held open 62 h: the actuator twitches against Holm's hand, then the obstruction chirp
    id: 'cold_jam_beep', variants: 2, dur: 1.0, vol: 0.4, ref: 3, send: 0.7, maxVoices: 1, minInterval: 0.4, pitchVar: 0.01, when: 'late', levels: L4,
    render(s) {
      servo(s, 0, 0.18, 120, 160, 0.25);
      clunk(s, 0.18, 120, 0.3, 0.1);
      for (let i = 0; i < 3; i++) beep(s, 0.32 + i * 0.13, 2350, 0.07, 0.35);
    },
  },
  {
    // lights-out (§4.3 L): the Deck-2 lighting contactors drop out in a wave, ballasts tick off, the room's tone falls
    id: 'lights_thunk', variants: 1, dur: 2.6, vol: 0.85, ref: 8, rolloff: 0.7, send: 1.4, maxVoices: 1, priority: 4, when: 'late', levels: L4,
    render(s) {
      clunk(s, 0, 70, 1.0, 0.35);
      clack(s, 0, 900, 0.5, 0.05);
      crackle(s, 0.005, 0.12, 900, 0.35);
      for (const t of [0.22, 0.41, 0.63, 0.88, 1.15, 1.45]) {
        const far = (t - 0.2) / 1.3;
        const lp = s.lp(3000 - far * 2200);
        lp.connect(s.out);
        clunk(s, t * s.r(0.95, 1.05), s.r(100, 150), 0.45 * (1 - far * 0.6), 0.12, lp);
      }
      for (let i = 0; i < 6; i++) s.modal({ start: s.r(0.05, 1.4), level: s.r(0.03, 0.06), modes: s.modes(s.r(3000, 5000), [1, 2.6], [0.03, 0.015]) }); // ballast tubes ticking as they cool
      s.burst({ start: 0.02, color: 'brown', type: 'lowpass', f: 160, Q: 0.7, a: 0.02, tau: 0.5, level: 0.5 });
    },
  },
  {
    // the unit bay's script-only door: bolts, a fast hard 0.85 s travel, the stop
    id: 'bay_door', variants: 1, dur: 1.7, vol: 0.8, ref: 6, rolloff: 0.8, send: 1.3, maxVoices: 1, priority: 4, when: 'late', levels: L4,
    render(s) {
      clack(s, 0, 900, 0.6, 0.04);
      clack(s, 0.04, 1100, 0.5, 0.04);
      hiss(s, 0.02, 0.35, 0.35, 3200);
      servo(s, 0.05, 0.85, 90, 180, 0.4);
      s.burst({ start: 0.05, color: 'brown', type: 'lowpass', f: 260, Q: 0.7, a: 0.1, hold: 0.6, tau: 0.08, level: 0.8 });
      scrape(s, 0.1, 0.7, 1500, 0.08);
      clunk(s, 0.9, 80, 0.9, 0.3);
      metal(s, 0.9, 210, 0.25, 0.4);
    },
  },
  {
    // a ceiling vent's grille shoved out: screws give, it drops ~3 m and clatters on the floor (spawn follows at +0.4 s)
    id: 'vent_grille', variants: 2, dur: 2.0, vol: 0.75, ref: 5, rolloff: 0.8, send: 1.3, maxVoices: 2, minInterval: 0.3, priority: 3, when: 'late', levels: L4,
    render(s) {
      s.thump(0, 180, 80, 0.03, 0.04, 0.5); // the push from inside the duct
      metal(s, 0, 520, 0.25, 0.2);
      clack(s, 0.03, 3600, 0.35, 0.02); // screw head pops
      clack(s, 0.09, 3200, 0.3, 0.02);
      scrape(s, 0.05, 0.12, 2400, 0.12);
      s.burst({ start: 0.15, color: 'pink', type: 'bandpass', f: 700, f1: 1400, sweep: 0.6, Q: 0.6, a: 0.3, tau: 0.08, level: 0.08 }); // falling flutter
      const t = s.r(0.74, 0.8);
      metal(s, t, 380, 1.0, 0.3); // lands on one edge
      s.thump(t, 150, 60, 0.04, 0.05, 0.6);
      metal(s, t + 0.07, 420, 0.6, 0.25); // and flat
      let tt = t + 0.16, lv = 0.35;
      for (let i = 0; i < 3; i++) { metal(s, tt, 400 * s.r(0.95, 1.05), lv, 0.12); tt += 0.06 * Math.pow(0.7, i); lv *= 0.55; } // rattles still
    },
  },
  // ═════════ theatre (§4.4; heard from the gallery through glass)
  {
    id: 'clasp_click', variants: 3, dur: 0.5, vol: 0.5, ref: 3, send: 0.9, maxVoices: 2, minInterval: 0.1, when: 'late', levels: L4,
    render(s) {
      // (heard from the gallery through the glass, i.e. occluded: low-passed at 750 Hz — so it has a body down there)
      servo(s, 0, 0.12, 300, 520, 0.18); // the gripper's fine servo
      s.burst({ start: 0.12, color: 'pink', type: 'lowpass', f: 500, Q: 1, a: 0.002, tau: 0.025, level: 0.5 }); // collar meets skin
      plateKnock(s, 0.14, 640, 0.8); // the collar closes
      clack(s, 0.14, 2900, 0.5, 0.012); // latch
      clack(s, 0.175, 1800, 0.45, 0.012); // prongs seat
      s.tone({ start: 0.22, type: 'sine', f: 2000, a: 0.002, hold: 0.03, tau: 0.01, level: 0.06 }); // the collar's own tick
    },
  },
  {
    // the same Clasp dipped in the gel bath: slow viscous gloop, a bubble, the pull-out
    id: 'gel_dip', variants: 2, dur: 2.0, vol: 0.45, ref: 3, send: 0.9, maxVoices: 1, minInterval: 0.5, when: 'late', levels: L4,
    render(s) {
      const g = s.gain(0);
      s.env(g.gain, [[0, 0], [0.12, 0.5], [0.5, 0.25], [0.9, 0]]);
      g.connect(s.out);
      const o = s.osc('sine', 150, 0, 1);
      s.env(o.frequency, [[0, 150], [0.6, 70]], 'exp');
      o.connect(g);
      s.chain(s.noise('brown', 0, 1), s.bp(260, 2), s.gain(0.8), g);
      for (const [t, f] of [[0.35, 320], [0.62, 260], [0.75, 410]] as const) s.tone({ start: t, f, f1: f * 1.8, sweep: 0.06, a: 0.004, tau: 0.03, level: 0.25 }); // bubbles
      // pull-out: suction then a strand breaking
      s.burst({ start: 1.1, color: 'pink', type: 'bandpass', f: 600, f1: 1400, sweep: 0.3, Q: 1.5, a: 0.15, tau: 0.08, level: 0.3 });
      s.tone({ start: 1.42, f: 520, f1: 900, sweep: 0.04, a: 0.002, tau: 0.02, level: 0.2 });
      s.modal({ start: 1.7, level: 0.07, modes: s.modes(1300, [1, 2.3], [0.03, 0.02]) }); // drip
    },
  },

  // ═════════ tube plant (§4.5 D28)
  {
    // two pump sets running hard (positional at the plant room, heard across the checkpoint). Stop with stop(3) = wind-down
    id: 'pump_loop', loop: true, variants: 1, dur: 6, vol: 0.85, ref: 8, rolloff: 0.6, send: 1.3, channels: 2, when: 'lazy', levels: L4,
    render(s) {
      const D = L(6);
      pumpSet(s, D, 49.5, 0.9, -0.4);
      pumpSet(s, D, 50, 0.8, 0.4); // 0.5 Hz beat between the two motors (3 beats per loop)
      // pipe trunk vibrating: a rattle on every other motor beat
      for (let t = 0.3; t < D - 0.2; t += 1.0) metal(s, t + s.r(-0.02, 0.02), s.r(600, 700), 0.05, 0.08);
      bed(s, 'brown', D, 0.6, 0.5, 0.3, s.lp(90));
    },
  },
  {
    // the equalising valve lever: ratchet, a heavy throw, then water starts to move in the trunk
    id: 'valve_pull', variants: 1, dur: 3.2, vol: 0.85, ref: 5, send: 1.3, maxVoices: 1, priority: 3, when: 'late', levels: L4,
    render(s) {
      for (let i = 0; i < 6; i++) clack(s, i * 0.06, 1500 + i * 60, 0.3, 0.02); // ratchet pawl
      scrape(s, 0, 0.36, 800, 0.1);
      clunk(s, 0.42, 85, 1.0, 0.35); // lever home
      metal(s, 0.42, 160, 0.35, 0.5);
      const g = s.gain(0);
      s.env(g.gain, [[0.5, 0], [1.4, 0.5], [2.4, 0.6], [3.1, 0]]);
      g.connect(s.out);
      const f = s.bp(200, 0.8);
      s.env(f.frequency, [[0.5, 200], [2.4, 750]], 'exp');
      s.chain(s.noise('pink', 0.5, 2.7), f, g);
      s.chain(s.noise('brown', 0.5, 2.7), s.lp(180), s.gain(0.8), g);
      s.thump(1.0, 110, 45, 0.08, 0.1, 0.5); // water hammer
      metal(s, 1.0, 230, 0.2, 0.4);
    },
  },
  {
    // the floor sump grille shoved up from below and dropped aside (spawn follows)
    id: 'sump_lift', variants: 2, dur: 2.4, vol: 0.8, ref: 5, send: 1.4, maxVoices: 1, minInterval: 0.5, priority: 3, when: 'late', levels: L4,
    render(s) {
      const under = s.lp(500); under.connect(s.out);
      s.thump(0, 120, 55, 0.04, 0.06, 0.8, under); // a blow from underneath
      metal(s, 0, 300, 0.4, 0.3, under);
      s.thump(0.35, 120, 55, 0.04, 0.06, 0.9, under);
      metal(s, 0.35, 300, 0.5, 0.35);
      scrape(s, 0.45, 0.3, 900, 0.14); // grille lifts on its edge
      metal(s, 0.85, 260, 1.0, 0.45); // falls flat on the deck
      s.thump(0.85, 110, 45, 0.05, 0.07, 0.7);
      metal(s, 0.95, 290, 0.4, 0.3);
      s.burst({ start: 0.5, color: 'pink', type: 'bandpass', f: 1200, Q: 0.8, a: 0.05, tau: 0.25, level: 0.2 }); // water off it
      for (let i = 0; i < 5; i++) s.modal({ start: 1.0 + s.r(0, 1.1), level: s.r(0.04, 0.09), modes: s.modes(s.r(900, 1500), [1, 2.1], [0.035, 0.02]) }); // drips
    },
  },
  {
    // the plant beacon: rotating lamp motor + a two-tone sounder (800 / 600 Hz, 0.5 s each). Loop it for the 25 s
    id: 'alarm_beacon', loop: true, variants: 1, dur: 2, vol: 0.2, ref: 6, rolloff: 0.8, send: 1.2, when: 'lazy', levels: L4,
    render(s) {
      const D = L(2);
      const g = s.gain(0);
      const pts: Array<[number, number]> = [];
      for (let t = 0; t < D; t += 0.5) pts.push([t, 0], [t + 0.01, 1], [t + 0.48, 1], [t + 0.5, 0]);
      s.env(g.gain, pts);
      s.chain(g, s.lp(2600), s.gain(0.3), s.out);
      const hi = s.gain(0), lo = s.gain(0);
      const hp: Array<[number, number]> = [], lpts: Array<[number, number]> = [];
      for (let t = 0; t < D; t += 1) { hp.push([t, 1], [t + 0.499, 1], [t + 0.5, 0], [t + 0.999, 0]); lpts.push([t, 0], [t + 0.499, 0], [t + 0.5, 1], [t + 0.999, 1]); }
      s.env(hi.gain, hp); s.env(lo.gain, lpts);
      s.chain(s.osc('square', 800, 0, D), hi, g);
      s.chain(s.osc('square', 600, 0, D), lo, g);
      // beacon motor (120 Hz, 2 rotations per second as a soft wobble)
      const m = s.gain(0.04);
      const lf = s.osc('sine', 2, 0, D); const lg = s.gain(0.02); lf.connect(lg); lg.connect(m.gain);
      s.chain(s.osc('sawtooth', 120, 0, D), s.lp(700), m, s.out);
    },
  },

  // ═════════ Post 4 gate (§4.6): the dogs withdraw; the gate stays a static prop
  {
    id: 'gate_dogs', variants: 1, dur: 2.8, vol: 0.95, ref: 8, rolloff: 0.8, send: 1.5, maxVoices: 1, priority: 5, when: 'late', levels: L4,
    render(s) {
      servo(s, 0, 1.8, 110, 170, 0.3); // hydraulic pack
      hiss(s, 0.02, 0.6, 0.35, 3000);
      for (let i = 0; i < 8; i++) {
        const t = 0.25 + i * 0.17 + s.r(-0.01, 0.01);
        clack(s, t, s.r(420, 620), 0.45, 0.06);
        s.thump(t, 110, 48, 0.04, 0.05, 0.5);
      }
      clunk(s, 1.85, 62, 1.0, 0.45); // last dog, the seat lets go
      metal(s, 1.85, 140, 0.35, 0.7);
      hiss(s, 1.95, 0.7, 0.25, 2200);
    },
  },
  // ═════════ the tube under the sea (also a room-local event, impulses.ts ROOMS_L4.tube)
  {
    id: 'tube_groan', variants: 4, dur: 4.6, vol: 0.5, ref: 8, rolloff: 0.7, send: 1.5, maxVoices: 2, minInterval: 1, pitchVar: 0.1, when: 'idle', levels: L4,
    render(s) {
      const t0 = s.r(0, 0.3), len = s.r(2.2, 3.4);
      const o = s.osc('sawtooth', s.r(38, 52), t0, len + 0.3);
      s.env(o.frequency, [[t0, s.r(38, 52)], [t0 + len * 0.6, s.r(55, 75)], [t0 + len, s.r(40, 50)]], 'exp');
      const f = s.bp(s.r(90, 140), 3);
      s.env(f.frequency, [[t0, 90], [t0 + len, s.r(160, 220)]], 'exp');
      const g = s.gain(0);
      s.env(g.gain, [[t0, 0], [t0 + len * 0.3, 0.6], [t0 + len * 0.7, 0.45], [t0 + len, 0]]);
      s.chain(o, f, g, s.out);
      s.burst({ start: t0, color: 'brown', type: 'lowpass', f: 110, Q: 0.7, a: len * 0.4, hold: len * 0.2, tau: len * 0.2, level: 0.6 }); // water pressing
      for (let i = 0; i < s.ri(2, 5); i++) s.modal({ start: t0 + s.r(0.2, len), level: s.r(0.04, 0.1), modes: s.modes(s.r(2800, 5200), [1, 1.53, 2.8], [0.06, 0.04, 0.02]) }); // glass stress ticks
      if (s.chance(0.5)) metal(s, t0 + len * s.r(0.4, 0.8), s.r(140, 200), 0.18, 0.8); // a rib takes the load
    },
  },
  // ═════════ shots into the dead (bodies' surface `flesh` on level 4; index.ts swaps impact_flesh → body_hit)
  {
    id: 'body_hit', variants: 4, dur: 0.4, vol: 0.42, ref: 2, maxVoices: 3, minInterval: 0.02, when: 'idle', levels: L4,
    render(s) {
      s.thump(0, s.r(100, 130), 45, 0.04, 0.035, 0.8); // dead weight: no give
      s.burst({ color: 'pink', type: 'lowpass', f: 500, Q: 1, a: 0.001, tau: 0.035, level: 0.6 });
      s.burst({ start: 0.002, color: 'white', type: 'bandpass', f: s.r(2300, 3000), Q: 1.4, a: 0.001, tau: 0.03, level: 0.22 }); // tyvek crackle
      s.burst({ start: 0.01, color: 'pink', type: 'bandpass', f: 800, Q: 2.5, a: 0.003, tau: 0.04, level: 0.18 }); // wet
    },
  },

  // ═════════ ambience beds (stereo, bus ambience; mixed by the level-4 room presets)
  {
    // clean side: laminar HEPA air, an air handler far off, luminaire hum. White, cold, exact.
    id: 'amb_clean', loop: true, variants: 1, dur: 12, vol: 0.45, bus: 'ambience', channels: 2, when: 'idle', levels: L4,
    render(s) {
      const D = L(12);
      bed(s, 'brown', D, 0.7, 1 / 6, 0.1, s.lp(120), s.pan(-0.25));
      bed(s, 'brown', D, 0.7, 1 / 4, 0.1, s.lp(130), s.pan(0.25));
      bed(s, 'pink', D, 0.045, 0, 0, s.hp(900), s.lp(7000), s.pan(-0.5)); // laminar flow through the ceiling filters
      bed(s, 'pink', D, 0.045, 0, 0, s.hp(950), s.lp(7200), s.pan(0.5));
      bed(s, 'pink', D, 0.02, 1 / 12, 0.3, s.bp(260, 3), s.pan(0.1)); // supply fan, far
      drone(s, 'sine', 100, D, 0.006, s.pan(-0.2));
      drone(s, 'sine', 200, D, 0.003, s.pan(0.2));
      drone(s, 'sine', 1170, D, 0.0012); // faint luminaire driver whine (1170 Hz)
    },
  },
  {
    // Cold Store 2: compressor, evaporator fans, frost ticking
    id: 'amb_cold', loop: true, variants: 1, dur: 12, vol: 0.45, bus: 'ambience', channels: 2, when: 'idle', levels: L4,
    render(s) {
      const D = L(12);
      bed(s, 'brown', D, 0.6, 0, 0, s.lp(110), s.pan(-0.2));
      bed(s, 'brown', D, 0.6, 0, 0, s.lp(115), s.pan(0.2));
      const sh = s.shaper('tanh', 2.0);
      s.chain(sh, s.lp(900), s.gain(0.08), s.pan(-0.4), s.out);
      for (const [h, a] of [[1, 1], [2, 0.6], [3, 0.3], [4, 0.15]] as const) s.chain(s.osc('sine', 49 * h, 0, D), s.gain(a * 0.35), sh);
      // evaporator fans: blade pass + air
      bed(s, 'pink', D, 0.07, 0.25, 0.15, s.bp(650, 0.8), s.pan(0.45));
      drone(s, 'triangle', 212, D, 0.004, s.lp(800), s.pan(0.45));
      bed(s, 'white', D, 0.012, 0, 0, s.hp(5000), s.pan(0.0)); // dry cold hiss
      for (let i = 0; i < 6; i++) {
        const p = s.pan(s.r(-0.9, 0.9)); p.connect(s.out);
        s.modal({ start: s.r(0.3, 11.8), level: s.r(0.02, 0.04), modes: s.modes(s.r(2400, 4400), [1, 2.4], [0.025, 0.015]), dst: p });
      }
    },
  },
  {
    // navy service level: ship-like rumble, duct air, a 60 Hz navy-side hum, a slow distant machinery throb
    id: 'amb_navy', loop: true, variants: 1, dur: 12, vol: 0.5, bus: 'ambience', channels: 2, when: 'idle', levels: L4,
    render(s) {
      const D = L(12);
      bed(s, 'brown', D, 1.0, 1 / 12, 0.15, s.lp(90), s.pan(-0.3));
      bed(s, 'brown', D, 1.0, 1 / 6, 0.15, s.lp(95), s.pan(0.3));
      bed(s, 'pink', D, 0.05, 1 / 4, 0.3, s.bp(320, 2), s.pan(-0.4)); // ducting
      bed(s, 'pink', D, 0.02, 0, 0, s.bp(1600, 0.8), s.pan(0.4));
      drone(s, 'sine', 60, D, 0.025);
      drone(s, 'sine', 120, D, 0.01, s.pan(0.3));
      drone(s, 'sine', 180, D, 0.004, s.pan(-0.3));
      // distant machinery: 25 Hz throb at 0.5 Hz
      const am = s.gain(0.04);
      const lf = s.osc('sine', 0.5, 0, D); const lg = s.gain(0.03); lf.connect(lg); lg.connect(am.gain);
      s.chain(s.osc('sine', 25, 0, D), am, s.out);
    },
  },
  {
    // tube plant at rest: standing pipe resonances, a trickle in the trunk, the hull (pump_loop is the running pumps)
    id: 'amb_plant', loop: true, variants: 1, dur: 12, vol: 0.5, bus: 'ambience', channels: 2, when: 'idle', levels: L4,
    render(s) {
      const D = L(12);
      bed(s, 'brown', D, 0.9, 1 / 12, 0.2, s.lp(100), s.pan(-0.2));
      bed(s, 'brown', D, 0.9, 1 / 6, 0.2, s.lp(105), s.pan(0.2));
      for (const [f, a, p, r] of [[73, 0.012, -0.5, 1 / 4], [146, 0.006, 0.4, 1 / 3], [219, 0.004, -0.2, 1 / 6], [412, 0.002, 0.6, 1 / 12]] as const) {
        const g = s.gain(a);
        const lf = s.osc('sine', r, 0, D); const lg = s.gain(a * 0.6); lf.connect(lg); lg.connect(g.gain);
        s.chain(s.osc('sine', f, 0, D), g, s.pan(p), s.out);
      }
      bed(s, 'pink', D, 0.03, 1 / 3, 0.5, s.bp(1800, 1.5), s.pan(0.5)); // trickle
      const d = crackleData(D, 9, s.rnd, { burst: 0.2 });
      s.chain(s.data(d, 0), s.bp(2400, 1.2), s.gain(0.03), s.pan(0.5), s.out);
    },
  },
  {
    // the transfer tube: the sea pressing on 40 m of glass — sub-bass, water moving outside, the glass's own faint ring
    id: 'amb_tube', loop: true, variants: 1, dur: 12, vol: 0.55, bus: 'ambience', channels: 2, when: 'idle', levels: L4,
    render(s) {
      const D = L(12);
      bed(s, 'brown', D, 1.1, 1 / 12, 0.25, s.lp(60), s.pan(-0.4));
      bed(s, 'brown', D, 1.1, 1 / 6, 0.25, s.lp(62), s.pan(0.4));
      drone(s, 'sine', 31, D, 0.05);
      drone(s, 'sine', 47, D, 0.025);
      for (const [p, r] of [[-0.7, 1 / 12], [0.7, 1 / 6]] as const) {
        const n = s.noise('pink', 0, D);
        const f = s.bp(240, 2.5);
        const lf = s.osc('sine', r, 0, D); const lg = s.gain(90); lf.connect(lg); lg.connect(f.frequency);
        s.chain(n, f, s.gain(0.05), s.pan(p), s.out); // water swirling past
      }
      drone(s, 'sine', 421, D, 0.0015, s.pan(-0.3)); // glass ring
      drone(s, 'sine', 833, D, 0.0008, s.pan(0.3));
    },
  },
];
