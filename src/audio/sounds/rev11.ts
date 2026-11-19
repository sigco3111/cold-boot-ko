/**
 * Stage 3d "간선" (technical level 6; plan docs/plans/stage-3d.md §8.12, §5.6, §5.7, §4.8.1, §11 W2b): the cable
 * tunnels, the head-end's handset, the vault's drum and beach joint, the moon pool's frame, the dock loader, water.
 *
 * Owners (§8.12, D25 — the owner is who PLAYS it; audio only renders):
 *   level vignettes / set pieces   tarp_flap phone_howler phone_dead_click line_hiss handset_drop ratchet_run drum_rumble
 *                                  drum_brake ping_close hull_ring dust_sift far_lock_flood lights_dip sea_groan
 *                                  castell_turn bj_doors fibre_strain fibre_rip crank_turn mode_clunk pin_draw pump_stroke
 *                                  gauge_tick shear_fire winch_brake tether_whip splash_big gate_squeal
 *                                  (+ existing: lamp_creak bulb_pop glass_tinkle lights_out_dock alarm_beacon sump_lift
 *                                  vent_grille)
 *   level machine ping6            ping_far ping_near
 *   enemies (the loader)           loader_hum (loop) loader_travel loader_track loader_jaws loader_brake loader_impact
 *                                  loader_squeal loader_hoist flood_pop ram_hit ram_burst cowl_open loader_death rope_whip
 *                                  armour_clank
 *   UI                             interlock_deny grip_tick
 *   audio itself                   wade_shallow wade (player:footstep surface water, by player.wading), wade_enemy
 *                                  (enemy:step in water ≥ 0.1 m), impact_water (bullet:impact surface water), drown_rescue
 *                                  (player:rescued), beds amb_tunnel amb_tunnel_dark amb_headend amb_vault amb_trench
 *                                  amb_shaft amb_pool amb_pool_dark amb_pool_quiet
 *
 * Built as rev10: a real transient, a physical body (modal steel, water), the mechanism's own detail, a short room
 * baked in (early reflections) under the engine's IR. Positional, mono; beds stereo.
 * Pre-render on level 6: the first rooms' beds + wading + water impacts + UI `idle`; set pieces / loader `late`;
 * loops `lazy` (loader_hum `idle`: it runs from Key B on). Loops: every periodic component has f × dur ∈ ℕ.
 */
import { SR, crackleData, type SoundDef, type Synth } from '../synth/core';
import { saturate } from '../synth/post';
import { clack, scrape } from './weapons';
import { clunk, crackle, hiss, servo } from './world';

const L6 = [6] as const;
/** Rendered span of a loop: the loop plus the crossfade tail (render.ts LOOP_XF ≤ 0.6). */
const LP = (d: number) => d + 0.7;

// ───────────────────────────────────────────── helpers (copied from rev10 — 3c files are not edited)

function drone(s: Synth, type: OscillatorType, f: number, dur: number, level: number, ...chain: AudioNode[]): OscillatorNode {
  const o = s.osc(type, f, 0, dur);
  s.chain(o, ...chain, s.gain(level), s.out);
  return o;
}
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
function plate(s: Synth, t: number, f0: number, level: number, ring: number, dst?: AudioNode): void {
  s.modal({
    start: t, level, dst,
    modes: s.modes(f0, [1, 1.62, 2.13, 2.87, 3.4, 4.31, 5.2, 6.6, 8.1], [ring, ring * 0.9, ring * 0.8, ring * 0.7, ring * 0.6, ring * 0.5, ring * 0.4, ring * 0.32, ring * 0.25], [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25], 0.05),
  });
}
function tube(s: Synth, t: number, f0: number, level: number, ring: number, dst?: AudioNode): void {
  s.modal({ start: t, level, dst, modes: s.modes(f0, [1, 2.76, 5.4, 8.93, 13.3], [ring, ring * 0.7, ring * 0.5, ring * 0.35, ring * 0.25], [1, 0.75, 0.5, 0.3, 0.2], 0.02) });
}
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
const ER_SMALL: Array<[number, number]> = [[0.0052, 0.45], [0.0093, 0.38], [0.0141, 0.3], [0.0213, 0.22], [0.0318, 0.14]];
const ER_ROOM: Array<[number, number]> = [[0.0094, 0.42], [0.0171, 0.34], [0.0262, 0.27], [0.0383, 0.2], [0.0551, 0.14], [0.0792, 0.09]];
const ER_HALL: Array<[number, number]> = [[0.021, 0.36], [0.039, 0.3], [0.061, 0.24], [0.088, 0.18], [0.124, 0.13], [0.171, 0.09], [0.233, 0.06]];
/** The moon-pool chamber: 48 m of steel walls — late, sparse, strong first reflections. */
const ER_CHAMBER: Array<[number, number]> = [[0.034, 0.4], [0.071, 0.33], [0.112, 0.27], [0.149, 0.22], [0.203, 0.17], [0.268, 0.12], [0.341, 0.08]];

type Hit = [number, number, number, number];
function impactData(dur: number, hits: Hit[], rnd: () => number): Float32Array<ArrayBuffer> {
  const len = Math.ceil(dur * SR), out = new Float32Array(len);
  for (const [t, f, tau, amp] of hits) {
    const i0 = Math.floor(t * SR);
    if (i0 < 0 || i0 >= len) continue;
    out[i0] += amp * 0.6 * (rnd() < 0.5 ? -1 : 1);
    const w = (2 * Math.PI * f) / SR, d = Math.exp(-1 / (tau * SR)), ph = rnd() * 6.283;
    const n = Math.min(len - i0, Math.floor(tau * SR * 7));
    let a = amp;
    for (let i = 0; i < n; i++) { out[i0 + i] += a * Math.sin(ph + w * i); a *= d; }
  }
  return out;
}
function creak(s: Synth, t: number, dur: number, f0: number, f1: number, fBody: number, level: number, dst?: AudioNode): void {
  const o = s.osc('sawtooth', f0, t, dur + 0.05);
  s.env(o.frequency, [[t, f0], [t + dur * 0.4, (f0 + f1) * 0.5 * s.r(0.9, 1.1)], [t + dur, f1]], 'exp');
  const g = s.gain(0);
  s.env(g.gain, [[t, 0], [t + dur * 0.15, level], [t + dur * 0.7, level * 0.8], [t + dur, 0]]);
  const am = s.gain(0.6);
  const n = s.noise('brown', t, dur + 0.05, 2);
  const ng = s.gain(4);
  n.connect(ng); ng.connect(am.gain);
  s.chain(o, s.bp(fBody, 2.2), s.pk(fBody * 2.4, 2, 5), am, g, dst ?? s.out);
}
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
/** A hard strike on a steel deck: transient, body thump, plate ring. */
function deckHit(s: Synth, t: number, level: number, f0 = 140, dst?: AudioNode): void {
  s.click(t, level * 0.9, 2500, 0.0012, dst);
  s.burst({ start: t, color: 'white', type: 'bandpass', f: 3800, Q: 0.6, a: 0.0002, tau: 0.008, level: level * 0.7, dst });
  s.burst({ start: t, color: 'pink', type: 'lowpass', f: 900, Q: 0.7, a: 0.0005, tau: 0.03, level: level * 0.8, dst });
  s.thump(t, f0 * 0.75, f0 * 0.32, 0.05, 0.06, level * 0.9, dst);
  plate(s, t, f0 * 1.3, level * 0.3, 0.22, dst);
}

// ───────────────────────────────────────────── water

/** Droplets: tiny rising chirps (a drop's cavity resonance rises as it closes). */
function drops(s: Synth, t: number, span: number, n: number, level: number, fLo = 900, fHi = 2800, dst?: AudioNode): void {
  for (let i = 0; i < n; i++) {
    const tt = t + span * Math.pow(s.rnd(), 1.4), f = s.r(fLo, fHi);
    s.tone({ start: tt, f, f1: f * s.r(1.5, 2.3), sweep: 0.014, a: 0.0008, tau: s.r(0.006, 0.014), level: level * s.r(0.3, 1), dst });
  }
}
/** Bubbles: rising sine blips (Minnaert resonance), denser and lower for bigger volumes of air. */
function bubbles(s: Synth, t: number, span: number, n: number, level: number, fLo: number, fHi: number, dst?: AudioNode): void {
  for (let i = 0; i < n; i++) {
    const tt = t + s.r(0, span), f = s.r(fLo, fHi);
    s.tone({ start: tt, f, f1: f * s.r(1.15, 1.5), sweep: 0.04, a: 0.002, tau: s.r(0.015, 0.04), level: level * s.r(0.3, 1), dst });
  }
}
/** A body of water moving: band-passed noise with a slow irregular swell (`rate` swells per second). */
function slosh(s: Synth, t: number, dur: number, level: number, f: number, rate: number, dst?: AudioNode): void {
  const g = s.gain(0);
  s.env(g.gain, [[t, 0], [t + Math.min(0.15, dur * 0.2), level], [t + dur * 0.6, level * 0.7], [t + dur, 0]]);
  const am = s.gain(0.5);
  const l = s.osc('sine', rate, t, dur + 0.05); const lg = s.gain(0.45); l.connect(lg); lg.connect(am.gain);
  const n2 = s.noise('pink', t, dur + 0.05, 0.3); const ng = s.gain(0.5); n2.connect(ng); ng.connect(am.gain);
  s.chain(s.noise('pink', t, dur + 0.05), s.bp(f, 0.8), s.lp(f * 3), am, g, dst ?? s.out);
}
/** A foot (or a body) breaking the surface: slap + cavity plunk + droplets. `k` 0 … 1 = how much water moves. */
function surfaceHit(s: Synth, t: number, level: number, k: number, dst?: AudioNode): void {
  s.burst({ start: t, color: 'white', type: 'bandpass', f: s.r(1300, 2100) * (1 - 0.3 * k), Q: 0.7, a: 0.002, tau: 0.03 + 0.04 * k, level, dst });
  s.burst({ start: t + 0.006, color: 'pink', type: 'lowpass', f: 900 - 300 * k, Q: 0.7, a: 0.004, tau: 0.05 + 0.1 * k, level: level * (0.5 + 0.6 * k), dst });
  const f = s.r(260, 420) * (1 - 0.4 * k);
  s.tone({ start: t + 0.02, f, f1: f * 1.8, sweep: 0.06, a: 0.004, tau: 0.03 + 0.03 * k, level: level * 0.35, dst }); // the plunk
  drops(s, t + 0.03, 0.18 + 0.3 * k, 5 + Math.floor(10 * k), level * 0.18, 900, 2800, dst);
}

// ───────────────────────────────────────────── loader helpers

/** The loader's drives: an inverter-fed motor (whine + its 2nd harmonic), gear mesh, wheels on the rail. */
function drive(s: Synth, t: number, dur: number, f: number, level: number, dst?: AudioNode): void {
  const env: Array<[number, number]> = [[t, 0], [t + 0.35, level], [t + dur - 0.4, level], [t + dur, 0]];
  const o = s.osc('sawtooth', f * 0.4, t, dur + 0.1);
  s.env(o.frequency, [[t, f * 0.4], [t + 0.5, f], [t + dur - 0.5, f], [t + dur, f * 0.45]], 'exp');
  const g = s.gain(0); s.env(g.gain, env);
  s.chain(o, s.bp(f * 2, 3), g, dst ?? s.out);
  const o2 = s.osc('square', f * 0.2, t, dur + 0.1);
  s.env(o2.frequency, [[t, f * 0.2], [t + 0.5, f * 0.5], [t + dur - 0.5, f * 0.5], [t + dur, f * 0.22]], 'exp');
  const g2 = s.gain(0); s.env(g2.gain, env.map(([a, b]) => [a, b * 0.25] as [number, number]));
  s.chain(o2, s.lp(900), g2, dst ?? s.out);
  // the wheels: brown rumble with rail-joint knocks
  const g3 = s.gain(0); s.env(g3.gain, env.map(([a, b]) => [a, b * 1.2] as [number, number]));
  s.chain(s.noise('brown', t, dur + 0.1), s.lp(220), g3, dst ?? s.out);
  for (let tt = t + s.r(0.3, 0.6); tt < t + dur - 0.3; tt += s.r(0.45, 0.8)) { s.thump(tt, 110, 55, 0.03, 0.05, level * 0.5, dst); metal(s, tt, s.r(420, 520), level * 0.08, 0.15, dst); }
}

// ───────────────────────────────────────────── the sounds

export const rev11Sounds: SoundDef[] = [
  // ═════════ water (audio itself)
  {
    // player:footstep surface water, player.wading 0.1 … 0.35 (ankle / shin)
    id: 'wade_shallow', variants: 6, dur: 0.6, vol: 0.32, maxVoices: 3, priority: 0, minInterval: 0.06, ref: 1.5, send: 0.6, when: 'idle', levels: L6,
    render(s) {
      s.thump(0, s.r(95, 120), 60, 0.02, 0.02, 0.45); // the boot on the deck under the water
      surfaceHit(s, 0, 0.75, 0.25);
      slosh(s, 0.05, 0.35, 0.22, s.r(500, 800), 6);
      surfaceHit(s, s.r(0.12, 0.18), 0.3, 0.1); // the toe leaving
    },
  },
  {
    // player.wading ≥ 0.35 (knee / waist): the leg pushed through, a surge, the water closing behind
    id: 'wade', variants: 6, dur: 1.0, vol: 0.4, maxVoices: 3, priority: 0, minInterval: 0.08, ref: 1.8, send: 0.7, when: 'idle', levels: L6,
    render(s) {
      slosh(s, 0, 0.65, 0.7, s.r(320, 480), 4);
      s.burst({ color: 'pink', type: 'lowpass', f: 600, Q: 0.7, a: 0.08, tau: 0.12, level: 0.5 }); // the surge
      surfaceHit(s, s.r(0.18, 0.26), 0.55, 0.7);
      bubbles(s, 0.1, 0.5, 6, 0.08, 300, 700);
      slosh(s, 0.45, 0.45, 0.25, 900, 7); // closing behind
    },
  },
  {
    // an enemy stepping in water (enemy:step, depth by position): heavier than the player's, positional
    id: 'wade_enemy', variants: 6, dur: 0.9, vol: 0.45, maxVoices: 4, priority: 1, minInterval: 0.04, ref: 2.5, rolloff: 1.0, send: 0.8, when: 'late', levels: L6,
    render(s, v) {
      const k = v < 3 ? 0.3 : 0.8;
      s.thump(0, 90, 50, 0.03, 0.03, 0.5);
      surfaceHit(s, 0, 0.8, k);
      slosh(s, 0.04, 0.4 + 0.4 * k, 0.4, s.r(350, 650), 5);
    },
  },
  {
    // a round into water: the crack of the surface, a thin cavity tear, the spray falling back
    id: 'impact_water', variants: 4, dur: 0.7, vol: 0.5, maxVoices: 4, priority: 1, minInterval: 0.02, ref: 2.5, send: 0.7, when: 'idle', levels: L6,
    render(s) {
      s.click(0, 0.6, 2500, 0.0008);
      s.burst({ color: 'white', type: 'highpass', f: 2600, Q: 0.6, a: 0.0003, tau: 0.012, level: 0.8 });
      s.burst({ color: 'white', type: 'bandpass', f: s.r(1500, 2400), Q: 0.8, a: 0.001, tau: 0.035, level: 0.7 });
      const f = s.r(700, 1100);
      s.tone({ start: 0.008, f, f1: f * 2.6, sweep: 0.03, a: 0.001, tau: 0.02, level: 0.35 }); // the tear
      drops(s, 0.06, 0.35, 14, 0.25, 1200, 3600);
    },
  },
  {
    // player:rescued (the deep-water fail-safe): bubbles roaring past, the surface broken, water streaming off onto the
    // deck, a shudder of breath-like air (no voice), drips. 2-D.
    id: 'drown_rescue', variants: 1, dur: 2.6, vol: 0.6, maxVoices: 1, minInterval: 1, send: 0.4, when: 'late', levels: L6,
    render(s) {
      const under = s.gain(1);
      s.chain(under, s.lp(700), s.out);
      bubbles(s, 0, 0.45, 40, 0.5, 180, 600, under);
      s.burst({ color: 'brown', type: 'lowpass', f: 400, Q: 0.7, a: 0.05, tau: 0.15, level: 0.8, dst: under });
      // breaking out
      s.burst({ start: 0.5, color: 'white', type: 'bandpass', f: 1400, Q: 0.6, a: 0.003, tau: 0.09, level: 1.0 });
      s.burst({ start: 0.5, color: 'pink', type: 'lowpass', f: 900, Q: 0.7, a: 0.005, tau: 0.2, level: 0.8 });
      // water streaming off clothes and gear onto steel
      slosh(s, 0.6, 1.4, 0.45, 1800, 9);
      drops(s, 0.7, 1.8, 40, 0.22, 900, 3200);
      s.thump(0.75, 120, 60, 0.04, 0.05, 0.6); // the knee on the deck
      plate(s, 0.75, 180, 0.12, 0.2);
      // the gasp: band-limited air in and out (unvoiced)
      s.burst({ start: 0.62, color: 'pink', type: 'bandpass', f: 1300, Q: 1.4, a: 0.12, tau: 0.08, level: 0.35 });
      s.burst({ start: 1.15, color: 'pink', type: 'bandpass', f: 900, Q: 1.2, a: 0.08, tau: 0.18, level: 0.25 });
    },
  },

  // ═════════ UI (W2a plays these, 2-D)
  {
    // a palm machine refuses: the Castell barrel will not turn (a dead clunk) + a low panel buzzer
    id: 'interlock_deny', variants: 1, dur: 0.75, vol: 0.5, bus: 'ui', maxVoices: 1, minInterval: 0.3, pitchVar: 0, when: 'idle', levels: L6,
    render(s) {
      s.click(0, 0.5, 2200, 0.0015);
      s.thump(0, 160, 90, 0.02, 0.03, 0.7);
      clack(s, 0.002, 620, 0.4, 0.05);
      for (const t of [0.1, 0.36]) {
        const g = s.gain(0); s.env(g.gain, [[t, 0], [t + 0.005, 0.18], [t + 0.2, 0.18], [t + 0.21, 0]]);
        s.chain(s.osc('square', 140, t, 0.22), s.bp(700, 1.2), s.shaper('tanh', 2), g, s.out);
      }
    },
  },
  {
    // the grip meter's tick (W2a: 12 per full grip at volume 0.35): a small dry pawl click over a ratchet tooth
    id: 'grip_tick', variants: 3, dur: 0.09, vol: 0.75, bus: 'ui', maxVoices: 2, minInterval: 0.03, pitchVar: 0.03, when: 'idle', levels: L6,
    render(s) {
      s.click(0, 0.6, 3000, 0.0007);
      s.modal({ start: 0, level: 0.35, modes: s.modes(s.r(2300, 2700), [1, 1.71, 2.6], [0.012, 0.008, 0.005]) });
      s.thump(0, 900, 500, 0.005, 0.004, 0.2);
    },
  },

  // ═════════ the buoy ping (level machine ping6; positional at the hull transducer / the well)
  {
    // 20 s rate, heard through the hull from below: a soft 1.2 kHz tone, dull, its multipath echoes ringing out
    id: 'ping_far', variants: 2, dur: 4.5, vol: 0.38, ref: 6, rolloff: 0.6, send: 1.2, maxVoices: 1, minInterval: 1, priority: 3, pitchVar: 0.005, when: 'idle', levels: L6,
    render(s) {
      const sea = s.gain(1);
      const d1 = s.delay(0.19), d2 = s.delay(0.33), f1 = s.gain(0.38), f2 = s.gain(0.3);
      sea.connect(d1); sea.connect(d2); s.chain(d1, s.lp(1400), f1, d2); s.chain(d2, s.lp(1200), f2, d1);
      const mix = s.gain(0.6); d1.connect(mix); d2.connect(mix);
      const out = s.gain(1); sea.connect(out); mix.connect(out);
      s.chain(out, s.lp(2200), s.out);
      s.tone({ f: 1190, f1: 1180, sweep: 0.3, a: 0.012, tau: 0.32, hold: 0.06, level: 0.7, dst: sea });
      s.tone({ f: 2380, a: 0.012, tau: 0.12, level: 0.08, dst: sea });
      s.modal({ start: 0.01, level: 0.12, modes: s.modes(97, [1, 2.13, 3.47], [0.8, 0.6, 0.4]), dst: out }); // the hull answering
    },
  },
  {
    // 4 s rate (after the pull), in the chamber at the well: closer, brighter, the transducer's knock, the water ringing
    id: 'ping_near', variants: 2, dur: 4.5, vol: 0.55, ref: 8, rolloff: 0.5, send: 1.4, maxVoices: 1, minInterval: 1, priority: 4, pitchVar: 0.005, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_CHAMBER, 3000, 0.5, 1.0, 0.5);
      s.thump(0, 140, 70, 0.02, 0.03, 0.35, rm);
      s.tone({ f: 1190, f1: 1182, sweep: 0.4, a: 0.006, tau: 0.42, hold: 0.08, level: 0.8, dst: rm });
      s.tone({ f: 2380, a: 0.006, tau: 0.2, level: 0.15, dst: rm });
      s.tone({ f: 3570, a: 0.006, tau: 0.08, level: 0.05, dst: rm });
      const d = s.delay(0.27); const fb = s.gain(0.35);
      s.chain(rm, d, s.lp(1600), fb, d); d.connect(s.gain(0.5)).connect(s.out);
    },
  },

  // ═════════ scare 2 v6_tent (rep6): the draught lifts the tent flap and lets it fall back
  {
    id: 'tarp_flap', variants: 2, dur: 2.8, vol: 0.75, ref: 3.5, rolloff: 0.9, send: 1.0, maxVoices: 1, minInterval: 1, priority: 3, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_ROOM, 4500, 0.4, 0.9);
      // the draught through the bend
      const g = s.gain(0); s.env(g.gain, [[0, 0], [0.5, 0.35], [1.2, 0.3], [2.4, 0]]);
      s.chain(s.noise('pink', 0, 2.5), s.bp(380, 0.7), g, rm);
      // the canvas fluttering: noise chopped at 9 … 16 Hz through the sheet's band, rising then easing
      const fl = s.gain(0); s.env(fl.gain, [[0.25, 0], [0.55, 0.7], [1.1, 0.55], [1.6, 0]]);
      const am = s.gain(0.4);
      const lfo = s.osc('square', 11, 0.2, 1.5); s.env(lfo.frequency, [[0.2, 9], [0.9, 16], [1.6, 7]], 'exp');
      const lg = s.gain(0.5); lfo.connect(lg); lg.connect(am.gain);
      s.chain(s.noise('white', 0.2, 1.5), s.bp(s.r(900, 1300), 0.9), s.lp(3200), am, fl, rm);
      // the flap falls back: a soft slap of canvas on canvas, the frame ticking
      const t = s.r(1.65, 1.8);
      s.burst({ start: t, color: 'pink', type: 'bandpass', f: 700, Q: 0.6, a: 0.004, tau: 0.05, level: 0.9, dst: rm });
      s.burst({ start: t, color: 'white', type: 'bandpass', f: 2200, Q: 0.8, a: 0.002, tau: 0.02, level: 0.4, dst: rm });
      tube(s, t + 0.02, s.r(620, 760), 0.05, 0.12, rm);
      s.burst({ start: t + 0.18, color: 'pink', type: 'bandpass', f: 900, Q: 0.7, a: 0.004, tau: 0.03, level: 0.3, dst: rm });
    },
  },

  // ═════════ scare 3 v6_handset (he6): the sound-powered phone
  {
    // ONE call of the howler = the three buzzes (§4.5): buzz 0.0–0.9, 1.5–2.4, 3.0–3.9 s, ends 4.0 s. A sound-powered
    // howler: an electromagnetic buzzer hammering its steel bell cup, harsh and loud in a steel room.
    id: 'phone_howler', variants: 1, dur: 4.4, vol: 0.85, ref: 4, rolloff: 0.8, send: 1.1, maxVoices: 1, minInterval: 2, priority: 4, pitchVar: 0, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_ROOM, 5000, 0.5, 0.8);
      for (const t of [0, 1.5, 3.0]) {
        const g = s.gain(0); s.env(g.gain, [[t, 0], [t + 0.02, 0.6], [t + 0.85, 0.55], [t + 0.9, 0]]);
        const bus = s.gain(1);
        s.chain(bus, s.shaper('hard', 2.5), s.bp(1100, 0.8), s.pk(2600, 2, 6), g, rm);
        const o = s.osc('square', 120, t, 0.92); o.connect(bus); // the armature (120 Hz off 60 Hz mains)
        const o2 = s.osc('sawtooth', 241, t, 0.92); s.chain(o2, s.gain(0.4), bus);
        // the cup ringing under the hammer
        const hits: Hit[] = [];
        for (let k = 0; k < 108; k++) { const tt = t + k / 120; hits.push([tt, 1870, 0.04, 0.05], [tt, 3010, 0.02, 0.03]); }
        s.chain(s.data(impactData(0.98, hits.map(([a, b, c, d]) => [a - t, b, c, d] as Hit), s.rnd), t), s.gain(0.8), g);
        s.click(t, 0.3, 2000, 0.002, rm);
      }
    },
  },
  {
    // the line goes dead: the far end's carbon mic clicked off — a hard click and a DC thump in the earpiece
    id: 'phone_dead_click', variants: 2, dur: 0.5, vol: 0.55, ref: 1.2, rolloff: 1.1, send: 0.3, maxVoices: 1, minInterval: 0.3, priority: 3, when: 'late', levels: L6,
    render(s) {
      s.click(0, 0.9, 1500, 0.002);
      s.thump(0, 220, 80, 0.01, 0.025, 0.7);
      s.burst({ color: 'white', type: 'bandpass', f: 1600, Q: 1.2, a: 0.0005, tau: 0.03, level: 0.5 });
      s.click(s.r(0.09, 0.14), 0.25, 2500, 0.001); // the bounce of the hook switch
    },
  },
  {
    // the dead line's hiss after the click: no carrier, just the copper — a thin band of hiss and a faint hum, fading
    id: 'line_hiss', variants: 1, dur: 3.2, vol: 0.35, ref: 1.0, rolloff: 1.2, send: 0.2, maxVoices: 1, minInterval: 0.5, priority: 2, when: 'late', levels: L6,
    render(s) {
      const g = s.gain(0); s.env(g.gain, [[0, 0], [0.05, 0.25], [1.6, 0.18], [3.1, 0]]);
      s.chain(s.noise('white', 0, 3.2), s.hp(400), s.bp(1900, 0.8), s.lp(2600), g, s.out);
      const h = s.gain(0); s.env(h.gain, [[0, 0], [0.05, 0.04], [3.1, 0]]);
      s.chain(s.osc('sawtooth', 120, 0, 3.2), s.bp(360, 2), h, s.out);
      s.chain(s.data(crackleData(3.2, 6, s.rnd), 0), s.bp(2000, 1), s.gain(0.15), s.out);
    },
  },
  {
    // the handset swings back on its cord and knocks the steel station box, rattling on its hook
    id: 'handset_drop', variants: 2, dur: 1.4, vol: 0.8, ref: 2.5, send: 0.9, maxVoices: 1, minInterval: 0.4, priority: 3, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_SMALL, 6000, 0.35, 0.9);
      // bakelite on steel: a hard plastic knock, the box's plate ring
      let t = 0.05, lv = 1;
      for (let i = 0; i < 4; i++) {
        s.click(t, 0.5 * lv, 3000, 0.0008, rm);
        s.modal({ start: t, level: 0.4 * lv, modes: s.modes(s.r(900, 1200), [1, 1.9, 2.7, 4.1], [0.025, 0.018, 0.012, 0.008]), dst: rm });
        plate(s, t, s.r(330, 400), 0.22 * lv, 0.15, rm);
        t += s.r(0.16, 0.28) * Math.pow(0.7, i); lv *= 0.55;
      }
      // the coiled cord slapping
      s.burst({ start: 0.02, color: 'pink', type: 'bandpass', f: 600, Q: 0.7, a: 0.03, tau: 0.08, level: 0.3, dst: rm });
    },
  },

  // ═════════ scare 4 v6_drum (vault6): the 4 m cable drum turns by itself, pays out, brakes
  {
    // the pawl over the drum's ratchet, slow then faster and louder (4.5 s; play with drum_rumble)
    id: 'ratchet_run', variants: 1, dur: 4.8, vol: 0.85, ref: 6, rolloff: 0.75, send: 1.3, maxVoices: 1, minInterval: 2, priority: 4, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_HALL, 4500, 0.5, 0.8, 0.5);
      let t = 0.05, gap = 0.42;
      while (t < 4.5) {
        const k = t / 4.5;
        const lv = 0.25 + 0.75 * k;
        s.click(t, lv * 0.7, 2600, 0.001, rm);
        metal(s, t, s.r(1050, 1200), lv * 0.4, 0.06, rm);
        s.thump(t, 180, 100, 0.01, 0.015, lv * 0.35, rm);
        t += gap * s.r(0.92, 1.08);
        gap = Math.max(0.045, gap * 0.9);
      }
    },
  },
  {
    // the drum's own weight turning on its axle, the cable paying out in loops onto the trench floor (4.6 s)
    id: 'drum_rumble', variants: 1, dur: 5.0, vol: 0.9, ref: 7, rolloff: 0.7, send: 1.3, maxVoices: 1, minInterval: 2, priority: 4, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_HALL, 3000, 0.5, 0.8, 0.5);
      const g = s.gain(0); s.env(g.gain, [[0, 0], [1.0, 0.4], [3.6, 0.9], [4.5, 0.3], [4.6, 0]]);
      const lp = s.lp(120); s.env(lp.frequency, [[0, 70], [4.5, 260]], 'exp');
      s.chain(s.noise('brown', 0, 4.7), lp, g, rm);
      const o = s.osc('triangle', 9, 0, 4.7); s.env(o.frequency, [[0, 6], [4.5, 22]], 'exp'); // the flange's out-of-round
      s.chain(o, s.gain(0.3), g);
      // the cable: a heavy slither and the loops slapping the floor
      const c = s.gain(0); s.env(c.gain, [[0.6, 0], [1.6, 0.35], [4.4, 0.5], [4.6, 0]]);
      s.chain(s.noise('pink', 0.6, 4.1), s.bp(700, 0.9), c, rm);
      for (let t = s.r(1.2, 1.6); t < 4.4; t += s.r(0.35, 0.7)) { s.thump(t, 100, 55, 0.03, 0.04, 0.4, rm); s.burst({ start: t, color: 'pink', type: 'lowpass', f: 1100, Q: 0.6, a: 0.002, tau: 0.03, level: 0.3, dst: rm }); }
    },
  },
  {
    // the band brake bites: a bang, a short shriek, the drum rocking back and forth on it, still
    id: 'drum_brake', variants: 1, dur: 3.0, vol: 1.0, ref: 7, rolloff: 0.7, send: 1.5, maxVoices: 1, minInterval: 1, priority: 5, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_HALL, 4500, 0.6, 0.8, 0.5);
      deckHit(s, 0, 1.0, 110, rm);
      metal(s, 0, 210, 0.6, 0.7, rm);
      const o = s.osc('sawtooth', 1900, 0.01, 0.35); s.env(o.frequency, [[0.01, 2100], [0.35, 1500]], 'exp');
      s.chain(o, s.bp(2000, 4), s.ad(0.01, 0.01, 0.25, 0.1), rm);
      for (const [t, lv] of [[0.7, 0.5], [1.35, 0.3], [1.9, 0.16]] as const) creak(s, t, 0.4, s.r(40, 60), s.r(30, 45), 300, lv, rm);
    },
  },

  // ═════════ scare 5 v6_ring (vault6): the first fast ping, much closer; the vault rings; dust
  {
    id: 'ping_close', variants: 1, dur: 5.5, vol: 1.0, ref: 10, rolloff: 0.5, send: 1.5, maxVoices: 1, minInterval: 2, priority: 5, pitchVar: 0, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_HALL, 3500, 0.6, 1.0, 0.55);
      s.thump(0, 120, 55, 0.03, 0.06, 0.8, rm); // the transducer's knock through the bolts
      s.click(0, 0.4, 1800, 0.002, rm);
      s.tone({ f: 1190, f1: 1184, sweep: 0.5, a: 0.004, tau: 0.6, hold: 0.1, level: 0.9, dst: rm });
      s.tone({ f: 2380, a: 0.004, tau: 0.3, level: 0.25, dst: rm });
      s.tone({ f: 3570, a: 0.004, tau: 0.12, level: 0.08, dst: rm });
      // the fittings buzzing with it
      const g = s.gain(0); s.env(g.gain, [[0.02, 0], [0.08, 0.12], [0.9, 0]]);
      s.chain(s.osc('square', 1190 / 8, 0, 1), s.bp(2400, 3), g, rm);
    },
  },
  {
    // the vault rings like a bell: the structure's low modes, long, beating; layered under ping_close
    id: 'hull_ring', variants: 1, dur: 7.0, vol: 0.9, ref: 12, rolloff: 0.45, send: 1.2, maxVoices: 1, minInterval: 2, priority: 4, pitchVar: 0, when: 'late', levels: L6,
    render(s) {
      s.modal({ start: 0.02, level: 0.9, modes: [[74, 2.4, 1], [75.3, 2.2, 0.8], [158, 1.9, 0.7], [161, 1.7, 0.5], [243, 1.4, 0.45], [397, 1.1, 0.3], [596, 0.8, 0.22], [1190, 0.5, 0.25], [1203, 0.45, 0.15]], dur: 6.8 });
      const g = s.gain(0); s.env(g.gain, [[0, 0], [0.3, 0.2], [4, 0]]);
      s.chain(s.noise('brown', 0, 4.5), s.lp(100), g, s.out);
    },
  },
  {
    // dust and grit sifting off the cable trays above (one tray, a few metres): a fine falling hiss + grains
    id: 'dust_sift', variants: 2, dur: 3.6, vol: 0.55, ref: 3, rolloff: 0.9, send: 0.9, maxVoices: 2, minInterval: 0.5, priority: 2, when: 'late', levels: L6,
    render(s) {
      const g = s.gain(0); s.env(g.gain, [[0, 0], [0.3, 0.3], [1.5, 0.2], [3.4, 0]]);
      const am = s.gain(0.6); const n2 = s.noise('pink', 0, 3.5, 0.2); const ng = s.gain(0.5); n2.connect(ng); ng.connect(am.gain);
      s.chain(s.noise('white', 0, 3.5), s.hp(2500), s.lp(9000), am, g, s.out);
      const hits: Hit[] = [];
      for (let i = 0; i < 90; i++) { const t = Math.pow(s.rnd(), 1.6) * 3.2; hits.push([t, s.r(3000, 8000), s.r(0.002, 0.006), s.r(0.02, 0.1)]); }
      s.chain(s.data(impactData(3.5, hits, s.rnd), 0), s.gain(0.6), s.out);
      for (let i = 0; i < 4; i++) metal(s, s.r(0.2, 2.5), s.r(2500, 4000), 0.04, 0.05); // a chip on the tray below
    },
  },

  // ═════════ scare 6 v6_thud: Post 4's launch lock flooding, far, through the structure; the lights dip
  {
    id: 'far_lock_flood', variants: 1, dur: 11, vol: 1.0, ref: 15, rolloff: 0.4, send: 1.0, maxVoices: 1, minInterval: 5, priority: 5, pitchVar: 0, when: 'late', levels: L6,
    render(s) {
      const far = s.gain(1); s.chain(far, s.lp(900), s.out);
      // the thud: the outer door seating 400 m away, felt more than heard
      s.thump(0, 48, 24, 0.3, 0.5, 1.2, far);
      s.thump(0.02, 90, 40, 0.1, 0.15, 0.5, far);
      s.modal({ start: 0, level: 0.25, modes: [[37, 1.5, 1], [61, 1.1, 0.6], [97, 0.8, 0.4]], dst: far });
      // then the long hiss of water filling something: a roar band-passed by 400 m of steel, swelling over 7 s
      const g = s.gain(0); s.env(g.gain, [[1.2, 0], [3.0, 0.4], [7.5, 0.55], [10.5, 0]]);
      const bp = s.bp(500, 0.6); s.env(bp.frequency, [[1.2, 700], [10, 300]], 'exp');
      s.chain(s.noise('pink', 1.2, 9.5), bp, g, far);
      const g2 = s.gain(0); s.env(g2.gain, [[1.5, 0], [4, 0.3], [9, 0.35], [10.6, 0]]);
      s.chain(s.noise('brown', 1.5, 9.2), s.lp(120), g2, far);
      for (let i = 0; i < 5; i++) metal(s, s.r(2.5, 9.5), s.r(160, 320), 0.05, 0.5, far); // the structure ticking
    },
  },
  {
    // the lights dip once: contactors chatter, the ballasts sag and recover (2-D or at a lamp)
    id: 'lights_dip', variants: 1, dur: 2.0, vol: 0.7, ref: 6, rolloff: 0.7, send: 1.0, maxVoices: 1, minInterval: 2, priority: 4, pitchVar: 0, when: 'late', levels: L6,
    render(s) {
      const g = s.gain(0); s.env(g.gain, [[0, 0.25], [0.12, 0.25], [0.2, 0.03], [0.75, 0.05], [1.1, 0.3], [1.8, 0.22], [1.95, 0]]);
      for (const [f, a] of [[120, 1], [240, 0.5], [360, 0.3]] as const) { const o = s.osc('sawtooth', f, 0, 2); s.env(o.frequency, [[0, f], [0.2, f * 0.92], [0.8, f * 0.94], [1.1, f]], 'lin'); s.chain(o, s.lp(900), s.gain(a * 0.3), g); }
      g.connect(s.out);
      for (const t of [0.14, 0.19, 1.05]) { s.click(t, 0.35, 2500, 0.002); clack(s, t, 900, 0.2, 0.03); }
      crackle(s, 0.95, 0.25, 600, 0.12, 3000);
    },
  },

  // ═════════ scare 9 v6_window (pool6, after the quiet): something very large passing outside (sub-bass, far)
  {
    id: 'sea_groan', variants: 1, dur: 8.0, vol: 1.0, ref: 20, rolloff: 0.3, send: 0.8, maxVoices: 1, minInterval: 5, priority: 5, pitchVar: 0, when: 'late', levels: L6,
    render(s) {
      const g = s.gain(0); s.env(g.gain, [[0, 0], [2.0, 0.6], [4.5, 1], [6.5, 0.5], [7.8, 0]]);
      g.connect(s.out);
      const o = s.osc('sine', 28, 0, 8); s.env(o.frequency, [[0, 24], [4, 31], [7.8, 22]], 'exp');
      s.chain(o, s.gain(0.9), g);
      // a groan: a voiced low pulse train through two slow formants (not an animal call — the hull hearing it)
      const p = s.osc('sawtooth', 52, 0.8, 7); s.env(p.frequency, [[0.8, 46], [4, 58], [7.5, 41]], 'exp');
      const f1 = s.bp(110, 4); s.env(f1.frequency, [[0.8, 90], [4.5, 160], [7.5, 80]], 'exp');
      const f2 = s.bp(260, 5); s.env(f2.frequency, [[0.8, 220], [4.5, 330], [7.5, 200]], 'exp');
      const pg = s.gain(0); s.env(pg.gain, [[0.8, 0], [3, 0.4], [5.5, 0.5], [7.6, 0]]);
      p.connect(f1); p.connect(f2); s.chain(f1, pg); s.chain(f2, s.gain(0.4), pg); s.chain(pg, s.lp(400), g);
      s.chain(s.noise('brown', 0, 8), s.lp(60), s.gain(0.8), g); // displaced water
      s.modal({ start: 4.2, level: 0.08, modes: [[61, 1.6, 1], [97, 1.2, 0.6]] }); // the window frame answering
    },
  },

  // ═════════ set pieces (W7; fired by the story)
  {
    // Castell interlock: the key goes home, the barrel turns through its detents (0.6 s), the bolt shoots, trapped
    id: 'castell_turn', variants: 1, dur: 1.0, vol: 0.75, ref: 2.5, send: 0.9, maxVoices: 1, minInterval: 0.5, priority: 3, pitchVar: 0.01, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_SMALL, 6000, 0.3, 1);
      clack(s, 0, 1500, 0.5, 0.03, rm); // the key home
      scrape(s, 0.04, 0.55, 2600, 0.12, rm);
      for (let i = 0; i < 4; i++) clack(s, 0.1 + i * 0.14, 2100 + i * 40, 0.25, 0.02, rm); // detents
      clunk(s, 0.66, 220, 0.8, 0.25, rm); // the bolt shoots
      clack(s, 0.67, 950, 0.5, 0.05, rm);
    },
  },
  {
    // the beach joint's sliding doors part (1.2 s): the latch, rollers in the track, the stops
    id: 'bj_doors', variants: 1, dur: 1.9, vol: 0.85, ref: 4, send: 1.1, maxVoices: 1, minInterval: 1, priority: 3, pitchVar: 0.01, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_ROOM, 5000, 0.4, 0.9);
      clack(s, 0, 1300, 0.6, 0.04, rm);
      s.thump(0.02, 150, 80, 0.02, 0.03, 0.4, rm);
      const g = s.gain(0); s.env(g.gain, [[0.08, 0], [0.25, 0.5], [1.1, 0.45], [1.28, 0]]);
      const am = s.gain(0.6); const l = s.osc('square', 23, 0.08, 1.2); const lg = s.gain(0.3); l.connect(lg); lg.connect(am.gain);
      s.chain(s.noise('pink', 0.08, 1.25), s.bp(480, 1.2), am, g, rm); // rollers
      scrape(s, 0.1, 1.1, 1900, 0.06, rm);
      for (const t of [1.3, 1.32]) { s.thump(t, 140, 70, 0.02, 0.04, 0.55, rm); plate(s, t, 260, 0.2, 0.25, rm); } // both leaves hit their stops
    },
  },
  {
    // the loom strained (bj6_strain 0.3 / 0.7): the connector housing creaks, a fibre or two parts with a glassy tick
    id: 'fibre_strain', variants: 3, dur: 1.4, vol: 0.7, ref: 2.5, send: 0.8, maxVoices: 1, minInterval: 0.5, priority: 3, when: 'late', levels: L6,
    render(s, v) {
      const rm = room(s, ER_SMALL, 7000, 0.3, 0.9);
      creak(s, 0, 1.0, s.r(170, 230), s.r(260, 340), 1400, 0.4, rm); // the polymer housing
      const n = 1 + v * 2;
      const hits: Hit[] = [];
      for (let i = 0; i < n; i++) { const t = s.r(0.2, 1.1); hits.push([t, s.r(5000, 8000), 0.004, 0.5], [t, s.r(2500, 3500), 0.008, 0.3]); }
      s.chain(s.data(impactData(1.3, hits, s.rnd), 0), rm);
    },
  },
  {
    // the connector tears out: a cracking rip of many fibres, the housing snapping, the strain relief whipping, then
    // the tray's fibres going in a cascade (0.8 s of fine ticks)
    id: 'fibre_rip', variants: 1, dur: 2.4, vol: 1.0, ref: 4, rolloff: 0.85, send: 1.2, maxVoices: 1, minInterval: 1, priority: 5, pitchVar: 0, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_ROOM, 7000, 0.45, 0.9);
      const hits: Hit[] = [];
      for (let i = 0; i < 70; i++) { const t = 0.05 + Math.pow(s.rnd(), 0.8) * 0.3; hits.push([t, s.r(3000, 9000), 0.004, s.r(0.3, 0.8)], [t, s.r(1200, 2200), 0.01, 0.2]); }
      for (let i = 0; i < 60; i++) { const t = 0.55 + s.r(0, 0.8) * (i / 60 + 0.1); hits.push([t, s.r(4000, 9000), 0.003, s.r(0.05, 0.25) * (1 - i / 70)]); }
      s.chain(s.data(impactData(2.2, hits, s.rnd), 0), s.gain(0.8), rm);
      s.burst({ start: 0.05, color: 'white', type: 'bandpass', f: 2600, Q: 0.6, a: 0.02, tau: 0.08, level: 0.7, dst: rm }); // the tear
      s.click(0.32, 1.0, 1800, 0.002, rm); // the housing snaps
      s.thump(0.32, 260, 120, 0.02, 0.03, 0.6, rm);
      s.modal({ start: 0.32, level: 0.3, modes: s.modes(1150, [1, 2.3, 3.6], [0.03, 0.02, 0.012]), dst: rm });
      s.burst({ start: 0.36, color: 'pink', type: 'bandpass', f: 1400, f1: 400, sweep: 0.2, Q: 1, a: 0.005, tau: 0.08, level: 0.5, dst: rm }); // the whip
      clack(s, 0.6, 700, 0.4, 0.05, rm); // it hits the enclosure
    },
    post(ch) { saturate(ch, 1.3); },
  },
  {
    // ONE turn of the changeover crank (0.6 s per turn — the story / set piece plays one per turn): the handle's
    // worm drive, its ratchet clicks, the cabinet's spring tensioning
    id: 'crank_turn', variants: 3, dur: 0.75, vol: 0.6, ref: 2.5, send: 0.8, maxVoices: 2, minInterval: 0.25, priority: 2, pitchVar: 0.03, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_SMALL, 6000, 0.3, 1);
      servo(s, 0, 0.58, 85, 95, 0.15, rm);
      for (let i = 0; i < 6; i++) clack(s, 0.04 + i * 0.095, s.r(1900, 2200), 0.28, 0.015, rm);
      creak(s, 0.1, 0.45, 60, 80, 500, 0.12, rm);
      s.thump(0.58, 120, 70, 0.01, 0.02, 0.25, rm);
    },
  },
  {
    // the mode plate reaches MANUAL: the rotary switch's cam drops in, the protection contactors drop out, relays chatter
    id: 'mode_clunk', variants: 1, dur: 1.6, vol: 0.9, ref: 4, send: 1.2, maxVoices: 1, minInterval: 1, priority: 4, pitchVar: 0, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_ROOM, 5000, 0.5, 0.9);
      clunk(s, 0, 160, 1.0, 0.35, rm);
      plate(s, 0, 210, 0.3, 0.4, rm);
      for (const t of [0.18, 0.24, 0.31, 0.33]) { clack(s, t, s.r(800, 1100), 0.45, 0.03, rm); s.thump(t, 200, 110, 0.01, 0.015, 0.25, rm); }
      const g = s.gain(0); s.env(g.gain, [[0.3, 0.12], [1.2, 0]]); // a hum dying
      s.chain(s.osc('sawtooth', 120, 0.3, 1), s.lp(700), g, rm);
    },
  },
  {
    // the shear's locking pin (grip 1.2 s, twist-and-draw): the twist rasps, the pin slides out, frees with a clunk
    id: 'pin_draw', variants: 1, dur: 1.6, vol: 0.8, ref: 3, send: 1.1, maxVoices: 1, minInterval: 0.5, priority: 3, pitchVar: 0, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_ROOM, 6000, 0.35, 0.9);
      creak(s, 0, 0.35, 90, 130, 900, 0.35, rm); // the twist
      clack(s, 0.36, 1400, 0.4, 0.03, rm);
      scrape(s, 0.4, 0.75, 1700, 0.2, rm); // the draw
      tube(s, 0.4, 820, 0.05, 0.2, rm);
      clunk(s, 1.18, 260, 0.7, 0.3, rm); // free
      tube(s, 1.18, 690, 0.25, 0.6, rm);
      hiss(s, 1.2, 0.3, 0.15, 4500, rm);
    },
  },
  {
    // one stroke of the frame's hand pump (every 0.7 s): lever creak, piston squelch, the check valve's click
    id: 'pump_stroke', variants: 3, dur: 0.7, vol: 0.65, ref: 2.5, send: 0.8, maxVoices: 2, minInterval: 0.3, priority: 2, pitchVar: 0.03, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_SMALL, 5000, 0.3, 1);
      creak(s, 0, 0.3, s.r(55, 70), s.r(80, 100), 600, 0.2, rm);
      s.burst({ start: 0.08, color: 'pink', type: 'bandpass', f: 380, f1: 900, sweep: 0.25, Q: 2, a: 0.02, tau: 0.08, level: 0.35, dst: rm }); // oil through the port
      clack(s, 0.3, s.r(1500, 1800), 0.4, 0.02, rm); // check valve
      s.thump(0.31, 150, 90, 0.01, 0.02, 0.3, rm);
      creak(s, 0.38, 0.25, 90, 70, 700, 0.12, rm); // the return
    },
  },
  {
    // the pressure gauge's needle: a tiny bourdon-tube tick (the story plays it as the needle climbs)
    id: 'gauge_tick', variants: 3, dur: 0.15, vol: 0.4, ref: 1.5, send: 0.4, maxVoices: 2, minInterval: 0.05, priority: 1, pitchVar: 0.04, when: 'late', levels: L6,
    render(s) {
      s.click(0, 0.5, 4000, 0.0006);
      s.modal({ start: 0, level: 0.3, modes: s.modes(s.r(3200, 3800), [1, 1.6, 2.4], [0.02, 0.012, 0.008]) });
      s.modal({ start: 0, level: 0.1, modes: s.modes(1300, [1, 2.2], [0.03, 0.02]) }); // the bezel
    },
  },
  {
    // §4.8.1: the shear fires — the accumulator dumps (a hydraulic slam), the blade's shriek through the armour wires,
    // the wires snapping, the frame ringing. Loud; positional at the shear.
    id: 'shear_fire', variants: 1, dur: 3.6, vol: 1.0, ref: 12, rolloff: 0.5, send: 1.6, maxVoices: 1, minInterval: 2, priority: 6, pitchVar: 0, peak: 0.95, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_CHAMBER, 4000, 0.6, 1, 0.5);
      s.click(0, 1.0, 1500, 0.002, rm);
      s.burst({ color: 'white', type: 'bandpass', f: 1800, Q: 0.5, a: 0.0005, tau: 0.04, level: 1.0, dst: rm });
      s.thump(0, 90, 32, 0.12, 0.18, 1.3, rm); // the slam
      deckHit(s, 0.002, 1.0, 100, rm);
      metal(s, 0, 150, 0.7, 1.0, rm);
      // the blade through steel wires: a fast shriek and many snaps
      const o = s.osc('sawtooth', 2900, 0.04, 0.3); s.env(o.frequency, [[0.04, 3400], [0.3, 1800]], 'exp');
      s.chain(o, s.bp(3000, 3), s.shaper('tanh', 2), s.ad(0.04, 0.01, 0.45, 0.07), rm);
      const hits: Hit[] = [];
      for (let i = 0; i < 26; i++) { const t = 0.06 + s.r(0, 0.22); hits.push([t, s.r(1500, 4500), 0.05, s.r(0.3, 0.8)], [t, s.r(500, 900), 0.12, 0.3]); }
      s.chain(s.data(impactData(1.5, hits, s.rnd), 0), s.gain(0.7), rm);
      // the accumulator bleeding down
      hiss(s, 0.1, 1.6, 0.35, 3000, rm);
      hydraulic(s, 0.15, 0.9, 140, 0.25, rm);
    },
    post(ch) { saturate(ch, 1.5); },
  },
  {
    // §4.8.1 +0.25 s: the cut tether's winch side whips back along the steel trough 1.5 m, armour wires sparking, and
    // the drum, unloaded, spins free (the whir carries 1.15 s, to winch_brake at +1.4 s)
    id: 'tether_whip', variants: 1, dur: 2.2, vol: 1.0, ref: 9, rolloff: 0.6, send: 1.4, maxVoices: 1, minInterval: 1, priority: 5, pitchVar: 0, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_CHAMBER, 4500, 0.5, 1, 0.5);
      s.burst({ color: 'white', type: 'bandpass', f: 3000, f1: 700, sweep: 0.12, Q: 0.8, a: 0.002, tau: 0.05, level: 1.0, dst: rm }); // the whip
      for (const [t, lv] of [[0.12, 1.0], [0.3, 0.6], [0.46, 0.35]] as const) { deckHit(s, t, lv, 120, rm); scrape(s, t, 0.18, 1500, 0.3 * lv, rm); }
      crackle(s, 0.12, 0.5, 900, 0.3, 4000, rm); // sparks
      const o = s.osc('sawtooth', 30, 0.1, 1.2); s.env(o.frequency, [[0.1, 25], [1.2, 70]], 'exp');
      const g = s.gain(0); s.env(g.gain, [[0.1, 0], [0.4, 0.4], [1.15, 0.5], [1.25, 0]]);
      s.chain(o, s.lp(400), g, rm);
      const g2 = s.gain(0); s.env(g2.gain, [[0.1, 0], [0.5, 0.3], [1.2, 0.35], [1.25, 0]]);
      s.chain(s.noise('brown', 0.1, 1.2), s.lp(250), g2, rm);
    },
  },
  {
    // §4.8.1 +1.4 s: the winch's band brake catches the free drum — a bang, the brake's squeal, the drum rocking still
    id: 'winch_brake', variants: 1, dur: 2.6, vol: 0.95, ref: 9, rolloff: 0.6, send: 1.4, maxVoices: 1, minInterval: 1, priority: 5, pitchVar: 0, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_CHAMBER, 4500, 0.5, 1, 0.5);
      clunk(s, 0, 140, 1.0, 0.4, rm);
      const o = s.osc('sawtooth', 1500, 0.01, 0.5); s.env(o.frequency, [[0.01, 1700], [0.5, 1100]], 'exp');
      s.chain(o, s.bp(1600, 5), s.shaper('tanh', 2), s.ad(0.01, 0.02, 0.35, 0.15), rm);
      for (const [t, lv] of [[0.6, 0.4], [1.15, 0.22]] as const) creak(s, t, 0.35, 45, 35, 280, lv, rm);
    },
  },
  {
    // a big mass into water (B-14 meets the well, the tether's end, the grab plunging): the boom of the cavity, the
    // roar, spray falling, waves slapping the coaming
    id: 'splash_big', variants: 2, dur: 4.5, vol: 1.0, ref: 12, rolloff: 0.5, send: 1.6, maxVoices: 2, minInterval: 0.3, priority: 5, pitchVar: 0.04, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_CHAMBER, 3500, 0.5, 1, 0.5);
      s.thump(0, 70, 30, 0.15, 0.25, 1.1, rm);
      s.burst({ color: 'white', type: 'bandpass', f: 1200, Q: 0.5, a: 0.004, tau: 0.12, level: 1.0, dst: rm });
      s.burst({ color: 'pink', type: 'lowpass', f: 700, Q: 0.7, a: 0.01, tau: 0.35, level: 1.0, dst: rm });
      bubbles(s, 0.05, 1.0, 50, 0.25, 120, 450, rm);
      slosh(s, 0.1, 1.8, 0.6, 900, 3, rm); // the column falling back
      drops(s, 0.4, 2.0, 60, 0.18, 800, 3000, rm);
      for (const t of [1.6, 2.4, 3.1, 3.7]) slosh(s, t + s.r(-0.1, 0.1), 0.6, 0.35 * (1 - (t - 1.6) / 3), 500, 5, rm); // waves on the coaming
    },
  },
  {
    // a self-closing ladder gate at the well (opened by a climber): hinge squeal, the spring, the gate clanging shut
    id: 'gate_squeal', variants: 2, dur: 1.4, vol: 0.8, ref: 4, rolloff: 0.8, send: 1.2, maxVoices: 2, minInterval: 0.4, priority: 3, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_HALL, 5000, 0.5, 0.8, 0.5);
      const o = s.osc('sawtooth', s.r(700, 900), 0, 0.6); s.env(o.frequency, [[0, s.r(700, 900)], [0.3, s.r(1100, 1400)], [0.55, s.r(800, 1000)]], 'exp');
      const am = s.gain(0.6); const n = s.noise('brown', 0, 0.6, 3); const ng = s.gain(3); n.connect(ng); ng.connect(am.gain);
      s.chain(o, s.bp(1800, 3), am, s.ad(0, 0.08, 0.3, 0.2, 0.25), rm);
      s.burst({ start: 0.6, color: 'pink', type: 'bandpass', f: 3500, Q: 3, a: 0.05, tau: 0.1, level: 0.12, dst: rm }); // the spring
      tube(s, 0.82, s.r(380, 460), 0.6, 0.5, rm); // shut
      s.click(0.82, 0.6, 2000, 0.0015, rm);
      clack(s, 0.86, 1300, 0.3, 0.03, rm); // the latch
    },
  },

  // ═════════ the dock loader (enemies-owned, W3a / W3b)
  {
    // from its spawn at Key B on, positional at the trolley: the hydraulic power pack idling, the drives' inverters,
    // transformer hum, a slow pressure breathing
    id: 'loader_hum', loop: true, variants: 1, dur: 8, vol: 0.6, ref: 8, rolloff: 0.6, send: 1.0, when: 'idle', levels: L6,
    render(s) {
      const D = LP(8);
      const am = s.gain(0.5); const lf = s.osc('sine', 0.5, 0, D); const lg = s.gain(0.15); lf.connect(lg); lg.connect(am.gain);
      s.chain(s.osc('sawtooth', 30, 0, D), s.lp(260), am, s.gain(0.5), s.out); // the pump's piston rate
      drone(s, 'sine', 60, D, 0.15);
      drone(s, 'sine', 120, D, 0.08);
      drone(s, 'sine', 180, D, 0.03);
      drone(s, 'triangle', 1875, D, 0.008, s.bp(1875, 8)); // inverter carrier, far down in level
      bed(s, 'pink', D, 0.12, 1 / 4, 0.3, s.bp(650, 1.2)); // oil through the valves
      bed(s, 'brown', D, 0.5, 1 / 8, 0.2, s.lp(90));
    },
  },
  {
    // a bridge / trolley drive (≈ 2.6 s: start, run, coast) — play per move; overlap a second one for a long run
    id: 'loader_travel', variants: 3, dur: 3.0, vol: 0.85, ref: 10, rolloff: 0.55, send: 1.3, maxVoices: 2, minInterval: 0.4, priority: 4, pitchVar: 0.05, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_CHAMBER, 3500, 0.4, 1);
      clack(s, 0, 700, 0.4, 0.05, rm); // the brake lifting
      drive(s, 0.05, 2.6, s.r(95, 115), 0.6, rm);
      s.burst({ start: 2.55, color: 'pink', type: 'bandpass', f: 2200, Q: 2, a: 0.01, tau: 0.08, level: 0.15, dst: rm });
    },
  },
  {
    // SLAM tracking (1.4 / 1.1 / 0.9 s): the trolley's fine-positioning servos whining up, the grab's ring light ballast
    id: 'loader_track', variants: 2, dur: 1.6, vol: 0.7, ref: 8, rolloff: 0.6, send: 1.0, maxVoices: 1, minInterval: 0.3, priority: 4, when: 'late', levels: L6,
    render(s) {
      servo(s, 0, 1.45, 180, 420, 0.4);
      const o = s.osc('sine', 2400, 0, 1.5); s.env(o.frequency, [[0, 1800], [1.45, 3200]], 'exp');
      s.chain(o, s.ad(0, 0.3, 0.06, 0.3, 1.0), s.out);
      for (let t = 0.1; t < 1.4; t += 0.17) clack(s, t, 2400, 0.08, 0.01);
    },
  },
  {
    // the jaws open over him: a hydraulic hiss and the four jaws clanking out
    id: 'loader_jaws', variants: 2, dur: 1.3, vol: 0.9, ref: 9, rolloff: 0.6, send: 1.2, maxVoices: 1, minInterval: 0.3, priority: 5, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_CHAMBER, 4500, 0.4, 1);
      hiss(s, 0, 0.7, 0.7, 4200, rm);
      hydraulic(s, 0, 0.55, 180, 0.3, rm);
      for (const t of [0.42, 0.45, 0.49, 0.52]) { s.thump(t, 140, 70, 0.02, 0.03, 0.4, rm); metal(s, t, s.r(330, 420), 0.25, 0.3, rm); }
    },
  },
  {
    // the brakes set before the drop: a hard double clack and the air dump
    id: 'loader_brake', variants: 2, dur: 0.7, vol: 0.85, ref: 9, rolloff: 0.6, send: 1.1, maxVoices: 1, minInterval: 0.2, priority: 5, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_CHAMBER, 5000, 0.35, 1);
      for (const t of [0, 0.045]) { clack(s, t, 820, 0.8, 0.06, rm); s.thump(t, 180, 90, 0.01, 0.02, 0.4, rm); }
      s.burst({ start: 0.05, color: 'white', type: 'highpass', f: 2500, Q: 0.6, a: 0.003, tau: 0.12, level: 0.35, dst: rm });
    },
  },
  {
    // the grab hits the deck (SLAM / dead-weight drop): a huge steel crash, the deck booming, the shock rolling out
    id: 'loader_impact', variants: 2, dur: 3.2, vol: 1.0, ref: 12, rolloff: 0.5, send: 1.6, maxVoices: 2, minInterval: 0.3, priority: 6, pitchVar: 0.04, peak: 0.95, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_CHAMBER, 3500, 0.6, 1, 0.55);
      s.click(0, 1.0, 1200, 0.003, rm);
      s.burst({ color: 'white', type: 'bandpass', f: 1500, Q: 0.5, a: 0.0005, tau: 0.05, level: 1.0, dst: rm });
      s.thump(0, 75, 28, 0.15, 0.3, 1.4, rm);
      deckHit(s, 0.002, 1.0, 80, rm);
      plate(s, 0.003, 95, 0.6, 1.1, rm);
      metal(s, 0.01, 240, 0.4, 0.6, rm);
      for (let i = 0; i < 6; i++) clack(s, s.r(0.05, 0.6), s.r(900, 2400), s.r(0.1, 0.25), 0.04, rm); // debris, bolts
      s.chain(s.noise('brown', 0, 1.8), s.lp(90), s.ad(0, 0.01, 0.6, 0.4), rm);
    },
    post(ch) { saturate(ch, 1.6); },
  },
  {
    // SWING wind-up: the trolley winding back 1.2 s against its brake, a long squeal
    id: 'loader_squeal', variants: 2, dur: 1.6, vol: 0.85, ref: 10, rolloff: 0.55, send: 1.3, maxVoices: 1, minInterval: 0.3, priority: 5, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_CHAMBER, 4500, 0.4, 1);
      const f0 = s.r(1100, 1400);
      const o = s.osc('sawtooth', f0, 0, 1.35); s.env(o.frequency, [[0, f0], [0.6, f0 * 1.25], [1.25, f0 * 0.9]], 'exp');
      const am = s.gain(0.6); const n = s.noise('brown', 0, 1.35, 3); const ng = s.gain(3); n.connect(ng); ng.connect(am.gain);
      s.chain(o, s.bp(f0 * 1.5, 4), s.shaper('tanh', 2), am, s.ad(0, 0.1, 0.4, 0.15, 1.0), rm);
      drive(s, 0, 1.3, 80, 0.25, rm);
    },
  },
  {
    // the hoist: the drum winding the four ropes over the sheaves (a rise / lower of ≈ 1.5 s)
    id: 'loader_hoist', variants: 2, dur: 2.0, vol: 0.75, ref: 10, rolloff: 0.55, send: 1.2, maxVoices: 1, minInterval: 0.3, priority: 3, pitchVar: 0.06, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_CHAMBER, 3500, 0.4, 1);
      drive(s, 0, 1.7, s.r(140, 165), 0.45, rm);
      const g = s.gain(0); s.env(g.gain, [[0.1, 0], [0.4, 0.25], [1.5, 0.25], [1.75, 0]]);
      const am = s.gain(0.5); const l = s.osc('square', 31, 0, 1.8); const lg = s.gain(0.4); l.connect(lg); lg.connect(am.gain);
      s.chain(s.noise('pink', 0, 1.8), s.bp(900, 1.5), am, g, rm); // the ropes' strands over the sheaves
    },
  },
  {
    // a flood's lamp head shot out: the bang, the lens shattering, glass down onto the deck, the stub sparking
    id: 'flood_pop', variants: 2, dur: 1.8, vol: 1.0, ref: 9, rolloff: 0.6, send: 1.4, maxVoices: 2, minInterval: 0.2, priority: 5, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_CHAMBER, 6000, 0.5, 1);
      s.click(0, 1.0, 1500, 0.0015, rm);
      s.burst({ color: 'white', type: 'highpass', f: 1200, Q: 0.5, a: 0.0002, tau: 0.03, level: 1.0, dst: rm });
      s.thump(0, 200, 70, 0.02, 0.05, 0.9, rm);
      s.modal({ start: 0, level: 0.4, modes: s.modes(s.r(2400, 3200), [1, 1.43, 2.1, 2.96], [0.06, 0.04, 0.03, 0.02]), dst: rm });
      const hits: Hit[] = [];
      for (let i = 0; i < 30; i++) { const t = 0.5 + s.r(0, 0.5); hits.push([t, s.r(3000, 9000), s.r(0.01, 0.03), s.r(0.05, 0.25)]); } // glass on steel, far below
      s.chain(s.data(impactData(1.5, hits, s.rnd), 0), s.lp(6000), s.gain(0.6), rm);
      crackle(s, 0.02, 0.9, 500, 0.35, 3200, rm);
    },
    post(ch) { saturate(ch, 1.3); },
  },
  {
    // a hit on an extended ram (×1.0): a ringing hydraulic cylinder struck, a spurt of oil hiss
    id: 'ram_hit', variants: 3, dur: 0.6, vol: 0.7, ref: 6, rolloff: 0.7, send: 1.0, maxVoices: 3, minInterval: 0.05, priority: 4, when: 'late', levels: L6,
    render(s) {
      s.click(0, 0.8, 2500, 0.001);
      tube(s, 0, s.r(560, 680), 0.6, 0.25);
      s.burst({ start: 0.01, color: 'white', type: 'highpass', f: 3000, Q: 0.6, a: 0.002, tau: 0.07, level: 0.3 });
    },
  },
  {
    // a ram bursts: the cylinder splits, a high-pressure oil jet roaring, the jaws on that side dropping open
    id: 'ram_burst', variants: 1, dur: 3.0, vol: 1.0, ref: 10, rolloff: 0.55, send: 1.5, maxVoices: 2, minInterval: 0.5, priority: 6, pitchVar: 0.03, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_CHAMBER, 4500, 0.5, 1, 0.5);
      s.click(0, 1.0, 1500, 0.002, rm);
      s.thump(0, 130, 50, 0.06, 0.1, 1.0, rm);
      tube(s, 0, 420, 0.6, 0.6, rm);
      const g = s.gain(0); s.env(g.gain, [[0, 0], [0.02, 0.9], [0.8, 0.6], [2.6, 0]]);
      s.chain(s.noise('white', 0, 2.8), s.hp(1500), s.bp(3800, 0.5), g, rm); // the jet
      hydraulic(s, 0.05, 1.6, 120, 0.3, rm);
      for (const t of [0.55, 0.62]) { s.thump(t, 130, 70, 0.02, 0.04, 0.5, rm); metal(s, t, 360, 0.35, 0.4, rm); } // the jaws fall open
    },
    post(ch) { saturate(ch, 1.4); },
  },
  {
    // the pod's cowl: louvres snapping open one after another, steam venting, a low electrical glow-hum inside
    id: 'cowl_open', variants: 1, dur: 3.0, vol: 0.95, ref: 9, rolloff: 0.6, send: 1.4, maxVoices: 1, minInterval: 1, priority: 5, pitchVar: 0, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_CHAMBER, 5000, 0.45, 1);
      for (let i = 0; i < 6; i++) { const t = i * 0.055; clack(s, t, 900 + i * 60, 0.6, 0.05, rm); plate(s, t, 300 + i * 20, 0.12, 0.2, rm); }
      hiss(s, 0.25, 2.3, 0.8, 3000, rm);
      s.chain(s.noise('pink', 0.25, 2.4), s.bp(900, 0.7), s.ad(0.25, 0.1, 0.35, 0.8, 0.6), rm);
      const g = s.gain(0); s.env(g.gain, [[0.3, 0], [0.8, 0.1], [2.8, 0.08], [2.95, 0]]);
      s.chain(s.osc('sawtooth', 60, 0.3, 2.7), s.lp(400), g, rm);
    },
  },
  {
    // §5.6.8 the pod blows: the blast + the drive failing (2.0 s, the whine falling), the brakes letting go (+2.3 s),
    // the ropes running out (2.3 … 3.6 s), the bridge coasting into its end-stop buffers with a long screech (to 6.6 s).
    // The plunge's splash_big and the PA are separate.
    id: 'loader_death', variants: 1, dur: 7.2, vol: 1.0, ref: 14, rolloff: 0.45, send: 1.6, maxVoices: 1, minInterval: 5, priority: 7, pitchVar: 0, peak: 0.95, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_CHAMBER, 4000, 0.6, 1, 0.55);
      // the blast
      s.click(0, 1.0, 1000, 0.003, rm);
      s.burst({ color: 'white', type: 'lowpass', f: 3500, Q: 0.5, a: 0.001, tau: 0.15, level: 1.0, dst: rm });
      s.thump(0, 85, 30, 0.2, 0.3, 1.3, rm);
      crackle(s, 0.02, 1.2, 1100, 0.6, 2800, rm);
      metal(s, 0.01, 190, 0.4, 0.8, rm);
      // the failing drive
      const o = s.osc('sawtooth', 130, 0.2, 2.2); s.env(o.frequency, [[0.2, 130], [1.2, 115], [2.2, 30]], 'exp');
      const dg = s.gain(0); s.env(dg.gain, [[0.2, 0], [0.4, 0.4], [1.6, 0.35], [2.3, 0]]);
      const stut = s.gain(0.6); const sl = s.osc('square', 7, 0.2, 2.2); const sg = s.gain(0.4); sl.connect(sg); sg.connect(stut.gain);
      s.chain(o, s.bp(260, 2), stut, dg, rm);
      // the brakes let go
      clack(s, 2.3, 700, 0.7, 0.08, rm); s.thump(2.3, 150, 70, 0.02, 0.04, 0.5, rm);
      // the ropes running out
      const r = s.gain(0); s.env(r.gain, [[2.3, 0], [2.45, 0.5], [3.4, 0.4], [3.6, 0]]);
      const rbp = s.bp(1200, 1.3); s.env(rbp.frequency, [[2.3, 700], [3.5, 1800]], 'exp');
      s.chain(s.noise('pink', 2.3, 1.35), rbp, r, rm);
      // the bridge coasting into the buffers: a long wheel screech, then the thud of the stops
      const sq = s.osc('sawtooth', 900, 3.4, 3.0); s.env(sq.frequency, [[3.4, 900], [5.5, 1250], [6.4, 700]], 'exp');
      const am = s.gain(0.6); const nb = s.noise('brown', 3.4, 3.0, 3); const nbg = s.gain(3); nb.connect(nbg); nbg.connect(am.gain);
      s.chain(sq, s.bp(1300, 4), s.shaper('tanh', 2), am, s.ad(3.4, 0.4, 0.3, 0.3, 2.5), rm);
      s.chain(s.noise('brown', 3.4, 3.0), s.lp(200), s.ad(3.4, 0.5, 0.4, 0.5, 2.2), rm);
      s.thump(6.5, 70, 32, 0.12, 0.25, 1.0, rm); plate(s, 6.5, 90, 0.4, 0.9, rm);
    },
    post(ch) { saturate(ch, 1.3); },
  },
  {
    // §5.6.8: the ropes run out whipping and go slack into the water
    id: 'rope_whip', variants: 2, dur: 1.8, vol: 0.85, ref: 9, rolloff: 0.6, send: 1.3, maxVoices: 1, minInterval: 0.5, priority: 4, when: 'late', levels: L6,
    render(s) {
      const rm = room(s, ER_CHAMBER, 5000, 0.45, 1);
      for (let i = 0; i < 4; i++) {
        const t = i * s.r(0.18, 0.3);
        s.burst({ start: t, color: 'white', type: 'bandpass', f: s.r(2500, 3500), f1: 600, sweep: 0.1, Q: 0.9, a: 0.003, tau: 0.04, level: 0.8 - i * 0.15, dst: rm });
        tube(s, t + 0.05, s.r(500, 700), 0.15, 0.2, rm);
      }
      slosh(s, 0.9, 0.8, 0.35, 700, 6, rm); // slack into the water
    },
  },
  {
    // a round on a retracted ram or the shut pod (×0, §5.6.5 — R2's "different"): a dull, thick, dead clank of armour
    // (no ring, no hiss) and a spark's tick. Once per 0.3 s at most.
    id: 'armour_clank', variants: 3, dur: 0.45, vol: 0.75, ref: 6, rolloff: 0.7, send: 0.9, maxVoices: 2, minInterval: 0.3, priority: 4, when: 'late', levels: L6,
    render(s) {
      const dull = s.gain(1); s.chain(dull, s.lp(2200), s.out); // thick plate: no top end
      s.click(0, 0.9, 1500, 0.0015, dull);
      s.thump(0, 240, 110, 0.015, 0.03, 1.0, dull);
      s.burst({ color: 'pink', type: 'bandpass', f: 900, Q: 0.8, a: 0.0003, tau: 0.018, level: 0.9, dst: dull });
      s.modal({ start: 0, level: 0.3, modes: s.modes(s.r(420, 520), [1, 1.5, 2.2], [0.03, 0.02, 0.012]), dst: dull }); // heavily damped
      s.burst({ start: 0.003, color: 'white', type: 'highpass', f: 6000, Q: 0.6, a: 0.0002, tau: 0.008, level: 0.12 }); // the spark
    },
    post(ch) { saturate(ch, 1.5); },
  },

  // ═════════ ambience beds (stereo, bus ambience; mixed by the level-6 room presets, impulses.ts ROOMS_L6)
  {
    // the lit cable tunnel: air moving along 80 m of concrete, the 60 Hz fluorescents, the HV cables' faint hum, a fan
    // far up the run, the odd cable-tray tick
    id: 'amb_tunnel', loop: true, variants: 1, dur: 12, vol: 0.5, bus: 'ambience', channels: 2, when: 'idle', levels: L6,
    render(s) {
      const D = LP(12);
      bed(s, 'brown', D, 1.0, 1 / 12, 0.2, s.lp(80), s.pan(-0.35));
      bed(s, 'brown', D, 1.0, 1 / 6, 0.2, s.lp(85), s.pan(0.35));
      bed(s, 'pink', D, 0.05, 1 / 4, 0.3, s.bp(260, 1.2), s.pan(-0.6)); // air along the run
      bed(s, 'pink', D, 0.04, 1 / 3, 0.3, s.bp(300, 1.2), s.pan(0.6));
      bed(s, 'pink', D, 0.012, 1 / 6, 0.4, s.bp(1500, 1.5), s.pan(0.2)); // the far fan
      drone(s, 'sine', 120, D, 0.012, s.pan(-0.2));
      drone(s, 'sine', 240, D, 0.004, s.pan(0.2));
      drone(s, 'sine', 60, D, 0.025);
      drone(s, 'triangle', 51, D, 0.006, s.lp(300), s.pan(0.4)); // the far fan's blade pass
      for (let i = 0; i < 4; i++) { const p = s.pan(s.r(-0.9, 0.9)); p.connect(s.out); s.modal({ start: s.r(0.5, 11.5), level: s.r(0.012, 0.025), modes: s.modes(s.r(1500, 3200), [1, 1.53, 2.8], [0.06, 0.04, 0.02]), dst: p }); }
    },
  },
  {
    // tunnel B in the dark (no mains): still air, the sea pressing on the hull, the emergency strips' inverters,
    // water seeping somewhere far down the run
    id: 'amb_tunnel_dark', loop: true, variants: 1, dur: 12, vol: 0.55, bus: 'ambience', channels: 2, when: 'idle', levels: L6,
    render(s) {
      const D = LP(12);
      bed(s, 'brown', D, 1.2, 1 / 12, 0.4, s.lp(55), s.pan(-0.4));
      bed(s, 'brown', D, 1.2, 1 / 6, 0.4, s.lp(60), s.pan(0.4));
      drone(s, 'sine', 25, D, 0.05);
      drone(s, 'sine', 400, D, 0.0012, s.pan(0.5)); // the strips' inverters
      drone(s, 'sine', 1200, D, 0.0005, s.pan(-0.5));
      bed(s, 'pink', D, 0.012, 1 / 4, 0.5, s.bp(2600, 3), s.pan(-0.7)); // seeping water, far
      for (let i = 0; i < 3; i++) { const p = s.pan(s.r(-0.9, 0.9)); p.connect(s.out); s.modal({ start: s.r(0.5, 11.5), level: s.r(0.01, 0.02), modes: s.modes(s.r(800, 1800), [1, 1.53, 2.8], [0.2, 0.12, 0.06]), dst: p }); }
    },
  },
  {
    // the head-end: racks of laser-pump coolers — many small fans (broadband + blade-pass tones), power supplies'
    // whine, the trunk's feed transformer hum
    id: 'amb_headend', loop: true, variants: 1, dur: 12, vol: 0.5, bus: 'ambience', channels: 2, when: 'idle', levels: L6,
    render(s) {
      const D = LP(12);
      bed(s, 'pink', D, 0.12, 1 / 12, 0.08, s.bp(900, 0.5), s.pan(-0.5));
      bed(s, 'pink', D, 0.12, 1 / 6, 0.08, s.bp(1100, 0.5), s.pan(0.5));
      bed(s, 'white', D, 0.012, 0, 0, s.hp(4000), s.lp(9000), s.pan(0));
      for (const [f, p, l] of [[187, -0.6, 0.006], [211, 0.5, 0.005], [233, -0.2, 0.004], [262, 0.7, 0.003]] as const) drone(s, 'triangle', f, D, l, s.lp(900), s.pan(p)); // fan blade pass
      drone(s, 'sine', 60, D, 0.03); drone(s, 'sine', 120, D, 0.012); drone(s, 'sine', 180, D, 0.004);
      drone(s, 'sine', 7350, D, 0.0006, s.pan(0.3)); // a supply's coil whine
      bed(s, 'brown', D, 0.6, 1 / 12, 0.15, s.lp(80));
    },
  },
  {
    // the cable vault: dry and hushed — the dehumidifiers' even air, their compressors' low hum, the cables' 60 Hz
    id: 'amb_vault', loop: true, variants: 1, dur: 12, vol: 0.45, bus: 'ambience', channels: 2, when: 'idle', levels: L6,
    render(s) {
      const D = LP(12);
      bed(s, 'pink', D, 0.07, 1 / 12, 0.08, s.bp(700, 0.4), s.lp(3000), s.pan(-0.6)); // the hush
      bed(s, 'pink', D, 0.07, 1 / 6, 0.08, s.bp(800, 0.4), s.lp(3000), s.pan(0.6));
      drone(s, 'sine', 30, D, 0.04); drone(s, 'sine', 59, D, 0.012, s.pan(-0.3)); drone(s, 'sine', 60, D, 0.015, s.pan(0.3)); // compressors (beating)
      bed(s, 'brown', D, 0.8, 1 / 12, 0.2, s.lp(70));
      for (let i = 0; i < 3; i++) { const p = s.pan(s.r(-0.9, 0.9)); p.connect(s.out); s.modal({ start: s.r(0.5, 11.5), level: s.r(0.008, 0.016), modes: s.modes(s.r(1800, 3500), [1, 1.53, 2.8], [0.05, 0.03, 0.02]), dst: p }); }
    },
  },
  {
    // the cable trench under the floor: close, low; the vault's hush muffled through the grilles; cable hum near
    id: 'amb_trench', loop: true, variants: 1, dur: 12, vol: 0.5, bus: 'ambience', channels: 2, when: 'idle', levels: L6,
    render(s) {
      const D = LP(12);
      bed(s, 'brown', D, 1.1, 1 / 12, 0.2, s.lp(110), s.pan(-0.2));
      bed(s, 'brown', D, 1.1, 1 / 4, 0.15, s.lp(115), s.pan(0.2));
      bed(s, 'pink', D, 0.03, 1 / 6, 0.3, s.bp(500, 1.5), s.lp(900), s.pan(0)); // the vault above
      drone(s, 'sine', 60, D, 0.03, s.pan(-0.4)); drone(s, 'sine', 120, D, 0.008, s.pan(-0.4)); // the cables beside him
      drone(s, 'sine', 48, D, 0.015); // a channel mode
    },
  },
  {
    // the stair shaft: 15 m of steel round an open well — air drawn up the shaft (a soft hollow tone), the chamber
    // far below (water, a low hum), ticks of the stairs
    id: 'amb_shaft', loop: true, variants: 1, dur: 12, vol: 0.5, bus: 'ambience', channels: 2, when: 'idle', levels: L6,
    render(s) {
      const D = LP(12);
      bed(s, 'brown', D, 1.0, 1 / 12, 0.3, s.lp(70), s.pan(-0.3));
      bed(s, 'brown', D, 1.0, 1 / 6, 0.3, s.lp(75), s.pan(0.3));
      bed(s, 'pink', D, 0.05, 1 / 4, 0.5, s.bp(176, 8), s.pan(0)); // the shaft's pipe mode
      bed(s, 'pink', D, 0.02, 1 / 3, 0.4, s.bp(352, 8), s.pan(0.2));
      bed(s, 'pink', D, 0.02, 1 / 4, 0.6, s.bp(500, 1), s.lp(800), s.pan(-0.5)); // the water below
      drone(s, 'sine', 30, D, 0.03); drone(s, 'sine', 60, D, 0.008);
      for (let i = 0; i < 4; i++) { const p = s.pan(s.r(-0.9, 0.9)); p.connect(s.out); s.modal({ start: s.r(0.5, 11.5), level: s.r(0.01, 0.022), modes: s.modes(s.r(700, 1600), [1, 1.53, 2.8], [0.25, 0.15, 0.08]), dst: p }); }
    },
  },
  {
    // the moon pool lit: a vast steel volume — the well's water working against the coaming, ventilation high up, the
    // dock's power and the loader's pack idling far (the positional loader_hum is on top), slow swells of the room
    id: 'amb_pool', loop: true, variants: 1, dur: 12, vol: 0.6, bus: 'ambience', channels: 2, when: 'idle', levels: L6,
    render(s) {
      const D = LP(12);
      bed(s, 'brown', D, 1.3, 1 / 12, 0.35, s.lp(65), s.pan(-0.5));
      bed(s, 'brown', D, 1.3, 1 / 6, 0.35, s.lp(68), s.pan(0.5));
      for (const [f, p, r] of [[420, -0.4, 1 / 4], [560, 0.35, 1 / 3], [330, 0.1, 1 / 6]] as const) { // water against the coaming
        const n = s.noise('pink', 0, D); const bp = s.bp(f, 1.1);
        const lf = s.osc('sine', r, 0, D); const lg = s.gain(f * 0.3); lf.connect(lg); lg.connect(bp.frequency);
        const am = s.gain(0.03); const l2 = s.osc('sine', r * 2, 0, D); const l2g = s.gain(0.022); l2.connect(l2g); l2g.connect(am.gain);
        s.chain(n, bp, am, s.pan(p), s.out);
      }
      bed(s, 'pink', D, 0.05, 1 / 4, 0.3, s.bp(380, 0.8), s.pan(-0.8)); // high vents
      bed(s, 'pink', D, 0.05, 1 / 3, 0.3, s.bp(420, 0.8), s.pan(0.8));
      drone(s, 'sine', 30, D, 0.025); drone(s, 'sine', 60, D, 0.015, s.pan(-0.3)); drone(s, 'sine', 120, D, 0.006, s.pan(0.3));
      drone(s, 'sine', 24, D, 0.04); // the sea gate
      for (let i = 0; i < 8; i++) { const p = s.pan(s.r(-1, 1)); p.connect(s.out); s.modal({ start: s.r(0.4, 11.6), level: s.r(0.01, 0.025), modes: s.modes(s.r(700, 2400), [1, 1.53, 2.8], [0.4, 0.25, 0.12]), dst: p }); }
      for (let i = 0; i < 10; i++) { const p = s.pan(s.r(-0.8, 0.8)); p.connect(s.out); drops(s, s.r(0.3, 11.5), 0.01, 1, 0.02, 700, 1800, p); }
    },
  },
  {
    // after lights_out6: the mains gone — the vents and the hum stop; the water and the sea on the windows are louder,
    // the emergency inverters whine faintly
    id: 'amb_pool_dark', loop: true, variants: 1, dur: 12, vol: 0.6, bus: 'ambience', channels: 2, when: 'late', levels: L6,
    render(s) {
      const D = LP(12);
      bed(s, 'brown', D, 1.4, 1 / 12, 0.45, s.lp(55), s.pan(-0.5));
      bed(s, 'brown', D, 1.4, 1 / 6, 0.45, s.lp(58), s.pan(0.5));
      for (const [f, p, r] of [[400, -0.4, 1 / 4], [520, 0.35, 1 / 3], [300, 0.1, 1 / 6]] as const) {
        const n = s.noise('pink', 0, D); const bp = s.bp(f, 1.1);
        const lf = s.osc('sine', r, 0, D); const lg = s.gain(f * 0.3); lf.connect(lg); lg.connect(bp.frequency);
        const am = s.gain(0.04); const l2 = s.osc('sine', r * 2, 0, D); const l2g = s.gain(0.03); l2.connect(l2g); l2g.connect(am.gain);
        s.chain(n, bp, am, s.pan(p), s.out);
      }
      drone(s, 'sine', 24, D, 0.06); drone(s, 'sine', 37, D, 0.025);
      drone(s, 'sine', 400, D, 0.0015, s.pan(0.4)); drone(s, 'sine', 1200, D, 0.0006, s.pan(-0.4));
      for (let i = 0; i < 6; i++) { const p = s.pan(s.r(-1, 1)); p.connect(s.out); s.modal({ start: s.r(0.4, 11.6), level: s.r(0.012, 0.028), modes: s.modes(s.r(500, 1600), [1, 1.53, 2.8], [0.5, 0.3, 0.15]), dst: p }); }
      for (let i = 0; i < 12; i++) { const p = s.pan(s.r(-0.8, 0.8)); p.connect(s.out); drops(s, s.r(0.3, 11.5), 0.01, 1, 0.025, 700, 1800, p); }
    },
  },
  {
    // the quiet (after the cut and the loader): water and hull only, very low; a last faint hum of emergency power
    id: 'amb_pool_quiet', loop: true, variants: 1, dur: 12, vol: 0.5, bus: 'ambience', channels: 2, when: 'late', levels: L6,
    render(s) {
      const D = LP(12);
      bed(s, 'brown', D, 1.1, 1 / 12, 0.5, s.lp(50), s.pan(-0.5));
      bed(s, 'brown', D, 1.1, 1 / 6, 0.5, s.lp(52), s.pan(0.5));
      for (const [f, p, r] of [[360, -0.3, 1 / 6], [480, 0.3, 1 / 4]] as const) {
        const n = s.noise('pink', 0, D); const bp = s.bp(f, 1.2);
        const lf = s.osc('sine', r, 0, D); const lg = s.gain(f * 0.25); lf.connect(lg); lg.connect(bp.frequency);
        const am = s.gain(0.025); const l2 = s.osc('sine', r * 2, 0, D); const l2g = s.gain(0.02); l2.connect(l2g); l2g.connect(am.gain);
        s.chain(n, bp, am, s.pan(p), s.out);
      }
      drone(s, 'sine', 24, D, 0.05);
      drone(s, 'sine', 60, D, 0.004);
      for (let i = 0; i < 3; i++) { const p = s.pan(s.r(-1, 1)); p.connect(s.out); s.modal({ start: s.r(0.4, 11.6), level: s.r(0.01, 0.02), modes: s.modes(s.r(400, 1200), [1, 1.53, 2.8], [0.6, 0.35, 0.18]), dst: p }); }
      for (let i = 0; i < 5; i++) { const p = s.pan(s.r(-0.8, 0.8)); p.connect(s.out); drops(s, s.r(0.3, 11.5), 0.01, 1, 0.02, 700, 1600, p); }
    },
  },
];
