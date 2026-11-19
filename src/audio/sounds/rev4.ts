/**
 * Revision 4 (level 2 "2번 라인") one-shots and loops, plus the foreman's own sounds.
 * Nothing here is in the awaited load set: one-shots render 'late' (background), loops 'lazy'.
 * Ids that a caller might reasonably either play() or loop() (intercom_static) are one-shots — the
 * engine loops a one-shot's buffer when asked to.
 */
import type { SoundDef, Synth } from '../synth/core';
import { buildVoice, planText } from '../synth/formant';
import { clack, scrape } from './weapons';
import { clunk, crackle, hiss, servo } from './world';

const L = (_s: Synth, d: number) => d + 0.7;

function drone(s: Synth, type: OscillatorType, f: number, dur: number, level: number, ...chain: AudioNode[]): OscillatorNode {
  const o = s.osc(type, f, 0, dur);
  s.chain(o, ...chain, s.gain(level), s.out);
  return o;
}

function bed(s: Synth, color: 'white' | 'pink' | 'brown', dur: number, level: number, ...chain: AudioNode[]): void {
  s.chain(s.noise(color, 0, dur), ...chain, s.gain(level), s.out);
}

/** Struck metal: thump + modal ring. */
function metal(s: Synth, t: number, f0: number, level: number, ring: number, dst?: AudioNode): void {
  s.modal({ start: t, level, modes: s.modes(f0, [1, 2.13, 3.47, 5.1, 7.3], [ring, ring * 0.8, ring * 0.6, ring * 0.4, ring * 0.3], [1, 0.7, 0.5, 0.35, 0.25], 0.05), dst });
}

export const rev4Sounds: SoundDef[] = [
  // ───────────────────────────── the line
  {
    id: 'belt_loop', loop: true, variants: 1, dur: 4, vol: 0.55, ref: 5, rolloff: 0.8, send: 1.0, when: 'lazy',
    render(s) {
      const D = L(s, 4);
      bed(s, 'brown', D, 1.0, s.lp(170));
      drone(s, 'sawtooth', 50, D, 0.05, s.lp(260));
      drone(s, 'sine', 100, D, 0.03);
      // rollers: a soft knock as each slat passes a roller (period 0.25 s, two rows slightly apart)
      for (let t = 0.05; t < D; t += 0.25) {
        s.thump(t, 140, 70, 0.02, 0.025, 0.18);
        clack(s, t + 0.11, s.r(700, 900), 0.05, 0.015);
      }
      // chain links over the sprocket
      for (let t = 0.02; t < D; t += 0.0625) s.click(t, 0.02, 3000, 0.0008);
    },
  },
  {
    id: 'belt_start', variants: 1, dur: 3.4, vol: 0.8, ref: 6, rolloff: 0.7, send: 1.3, priority: 3, when: 'late',
    render(s) {
      clunk(s, 0, 90, 0.7, 0.2); // contactor
      s.click(0.01, 0.3, 2500, 0.002);
      // motor winds up
      const o = s.osc('sawtooth', 18, 0.05, 3.3);
      s.env(o.frequency, [[0.05, 18], [1.4, 50], [3.3, 50]], 'exp');
      const g = s.gain(0);
      s.env(g.gain, [[0.05, 0], [0.6, 0.18], [3.0, 0.16], [3.35, 0]]);
      s.chain(o, s.lp(420), g, s.out);
      servo(s, 0.1, 1.6, 120, 520, 0.12);
      // slack chain snaps tight: a jerk + rattling clunks, a short belt slip squeal
      clunk(s, 0.45, 70, 0.9, 0.3);
      for (let i = 0; i < 7; i++) clack(s, 0.5 + i * s.r(0.05, 0.09), s.r(600, 1300), 0.25 - i * 0.02, 0.03);
      const sq = s.osc('square', 1900, 0.55, 0.5);
      s.env(sq.frequency, [[0.55, 1900], [1.0, 1250]], 'exp');
      const sg = s.gain(0);
      s.env(sg.gain, [[0.55, 0], [0.6, 0.05], [0.95, 0.03], [1.05, 0]]);
      s.chain(sq, s.bp(2000, 4), sg, s.out);
      for (let t = 1.2; t < 3.3; t += 0.25) s.thump(t, 140, 70, 0.02, 0.025, 0.12 * Math.min(1, (t - 1) / 0.8));
    },
  },
  {
    id: 'press_slam', variants: 3, dur: 2.0, vol: 0.95, ref: 5, rolloff: 0.8, send: 1.4, maxVoices: 2, minInterval: 0.25, priority: 3, when: 'late',
    render(s) {
      hiss(s, 0, 0.16, 0.25, 4200); // valve
      const t = s.r(0.15, 0.2);
      s.thump(t, 85, 30, 0.08, 0.16, 1.0);
      s.thump(t, 160, 60, 0.03, 0.04, 0.6);
      s.burst({ start: t, color: 'pink', type: 'lowpass', f: 900, Q: 0.6, a: 0.001, tau: 0.08, level: 0.9 });
      metal(s, t, s.r(70, 95), 0.55, 0.5);
      metal(s, t + 0.002, s.r(380, 520), 0.25, 0.18);
      s.click(t, 0.5, 2000, 0.003);
      // exhaust + release
      hiss(s, t + 0.35, 0.7, 0.3, 2800);
      clunk(s, t + 1.1, 110, 0.35, 0.12);
    },
  },
  {
    id: 'arm_reach', variants: 3, dur: 1.5, vol: 0.7, ref: 3, send: 1.0, maxVoices: 3, minInterval: 0.08, when: 'late',
    render(s) {
      const d = s.r(0.35, 0.5);
      servo(s, 0, d, s.r(380, 460), s.r(1100, 1400), 0.32);
      servo(s, 0.02, d * 0.9, s.r(190, 230), s.r(560, 700), 0.15);
      hiss(s, 0.05, d * 0.8, 0.08, 5000);
      clunk(s, d + 0.02, s.r(150, 200), 0.55, 0.12); // hydraulic stop
      clack(s, d + 0.05, s.r(1500, 2200), 0.3, 0.02);
      servo(s, d + 0.15, 0.5, s.r(700, 800), s.r(300, 380), 0.08); // settles back
    },
  },
  {
    // level 2's small hidden arms (intake.ts `intake_shoe` and the gallery vignette call `L.sfx('servo', …)`; the id was
    // never defined — "unknown sound id" in every level-2 run until 3d IA): a short light servo whir out and back
    id: 'servo', variants: 2, dur: 1.6, vol: 0.55, ref: 3, send: 0.9, maxVoices: 2, minInterval: 0.1, when: 'late', levels: [2],
    render(s) {
      const d = s.r(0.7, 0.9);
      servo(s, 0, d, s.r(260, 320), s.r(520, 640), 0.16);
      clack(s, d + 0.02, s.r(1800, 2400), 0.18, 0.015);
      servo(s, d + 0.12, 0.45, s.r(560, 640), s.r(280, 340), 0.07);
    },
  },
  {
    id: 'treadmill_loop', loop: true, variants: 1, dur: 4, vol: 0.4, ref: 3.5, send: 0.8, when: 'lazy',
    render(s) {
      const D = L(s, 4);
      drone(s, 'sawtooth', 180, D, 0.022, s.bp(720, 3));
      drone(s, 'sine', 90, D, 0.03);
      bed(s, 'pink', D, 0.05, s.bp(380, 1.2));
      // deck slats under rubber + two feet in a human rhythm (≈ 1.8 steps / s)
      for (let t = 0.03; t < D; t += 0.125) s.click(t, 0.025, 1800, 0.001);
      for (let t = 0.1, k = 0; t < D; t += 0.56, k++) {
        s.thump(t, k % 2 ? 105 : 95, 50, 0.04, 0.045, 0.32);
        s.burst({ start: t, color: 'pink', type: 'lowpass', f: 700, Q: 0.7, a: 0.002, tau: 0.03, level: 0.2 });
      }
    },
  },
  {
    id: 'polisher_loop', loop: true, variants: 1, dur: 3, vol: 0.45, ref: 3, send: 0.8, when: 'lazy',
    render(s) {
      const D = L(s, 3);
      const m = drone(s, 'sawtooth', 148, D, 0.03, s.lp(1200));
      s.env(m.frequency, [[0, 146], [D * 0.5, 151], [D, 146]]);
      drone(s, 'sine', 74, D, 0.05);
      // rotating brush: broadband swish amplitude-modulated at the pad's rotation (~8 Hz)
      const n = s.noise('pink', 0, D);
      const am = s.gain(0.5);
      const lfo = s.osc('sine', 8.2, 0, D);
      const lg = s.gain(0.45);
      lfo.connect(lg); lg.connect(am.gain);
      s.chain(n, s.bp(2300, 0.7), am, s.gain(0.22), s.out);
      bed(s, 'brown', D, 0.35, s.lp(220));
    },
  },
  // ───────────────────────────── booth
  {
    id: 'intercom_click', variants: 3, dur: 0.45, vol: 0.45, ref: 2, send: 0.6, maxVoices: 2, minInterval: 0.05, when: 'late',
    render(s) {
      clack(s, 0, s.r(1800, 2400), 0.4, 0.012); // button
      s.click(0.012, 0.35, 900, 0.004); // speaker cone pop
      s.thump(0.012, 180, 90, 0.01, 0.02, 0.25);
      s.burst({ start: 0.02, color: 'white', type: 'bandpass', f: 2200, Q: 0.7, a: 0.002, tau: s.r(0.03, 0.08), level: 0.12 });
    },
  },
  {
    id: 'intercom_static', variants: 3, dur: 1.6, vol: 0.35, ref: 2.5, send: 0.6, maxVoices: 2, minInterval: 0.1, when: 'late',
    render(s) {
      const n = s.noise('white', 0, 1.6);
      const g = s.gain(0);
      s.env(g.gain, [[0, 0], [0.03, 0.22], [1.2, 0.18], [1.55, 0]]);
      s.chain(n, s.hp(500), s.bp(2400, 0.6), s.shaper('hard', 3), g, s.out);
      crackle(s, 0, 1.5, 70, 0.35, 2600);
      // a faint heterodyne whistle wandering
      const o = s.osc('sine', s.r(900, 1400), 0, 1.6);
      s.env(o.frequency, [[0, s.r(900, 1300)], [1.6, s.r(1100, 1700)]], 'exp');
      const og = s.gain(0);
      s.env(og.gain, [[0, 0], [0.2, 0.02], [1.3, 0.015], [1.6, 0]]);
      s.chain(o, og, s.out);
    },
  },
  {
    id: 'glass_bang', variants: 4, dur: 1.2, vol: 0.85, ref: 3, send: 1.1, maxVoices: 2, minInterval: 0.12, when: 'late',
    render(s, v) {
      const hits = v === 3 ? [0, 0.17] : [0];
      for (const t of hits) {
        s.thump(t, s.r(95, 120), 50, 0.03, 0.05, 0.9); // fist (soft)
        s.burst({ start: t, color: 'pink', type: 'lowpass', f: 600, Q: 0.7, a: 0.002, tau: 0.025, level: 0.6 });
        // thick laminated pane: low boomy panel mode + damped glassy partials
        s.modal({ start: t, level: 0.35, modes: s.modes(s.r(140, 170), [1, 1.62, 2.4], [0.18, 0.12, 0.08], [1, 0.5, 0.3]) });
        s.modal({ start: t + 0.001, level: 0.08, modes: s.modes(s.r(1300, 1700), [1, 1.48, 2.1, 2.9], [0.05, 0.04, 0.03, 0.02]) });
        clack(s, t + 0.003, s.r(2500, 3200), 0.06, 0.02); // frame rattle
      }
    },
  },
  {
    id: 'marker_squeak', variants: 4, dur: 0.9, vol: 0.35, ref: 2, send: 0.5, maxVoices: 2, minInterval: 0.05, when: 'late',
    render(s) {
      // felt tip on glass: stick-slip chirps (narrow, fast-wobbling band) + a dry scratch underneath
      const strokes = s.ri(1, 3);
      let t = 0;
      for (let k = 0; k < strokes; k++) {
        const d = s.r(0.12, 0.28);
        const o = s.osc('sawtooth', s.r(1700, 2600), t, d);
        s.env(o.frequency, [[t, s.r(1600, 2400)], [t + d * 0.5, s.r(2600, 3600)], [t + d, s.r(1800, 2800)]], 'exp');
        const am = s.gain(0.5);
        const lfo = s.osc('square', s.r(45, 90), t, d);
        const lg = s.gain(0.5); lfo.connect(lg); lg.connect(am.gain);
        const g = s.gain(0);
        s.env(g.gain, [[t, 0], [t + 0.01, 0.12], [t + d * 0.8, 0.09], [t + d, 0]]);
        s.chain(o, s.bp(2800, 3), am, g, s.out);
        scrape(s, t, d, s.r(3500, 5000), 0.06);
        t += d + s.r(0.04, 0.12);
      }
    },
  },
  // ───────────────────────────── power / doors
  {
    id: 'bulkhead_grind', variants: 2, dur: 4.6, vol: 0.85, ref: 6, rolloff: 0.7, send: 1.4, priority: 3, maxVoices: 2, when: 'late',
    render(s) {
      clunk(s, 0, 70, 0.8, 0.3); // dogs release
      hiss(s, 0.05, 0.3, 0.2, 3000);
      // heavy grind: rumble + scraping, with a stuttering stick-slip
      const D = 3.6;
      const n = s.noise('brown', 0.25, D);
      const g = s.gain(0);
      s.env(g.gain, [[0.25, 0], [0.6, 0.9], [3.3, 0.8], [3.85, 0]]);
      s.chain(n, s.lp(260), g, s.out);
      const sc = s.noise('pink', 0.25, D);
      const f = s.bp(700, 3);
      s.env(f.frequency, [[0.25, 500], [2, 900], [3.8, 620]], 'exp');
      const am = s.gain(0.4);
      const lfo = s.osc('square', s.r(11, 17), 0.25, D);
      const lg = s.gain(0.4); lfo.connect(lg); lg.connect(am.gain);
      const sg = s.gain(0);
      s.env(sg.gain, [[0.25, 0], [0.6, 0.3], [3.3, 0.25], [3.85, 0]]);
      s.chain(sc, f, am, sg, s.out);
      servo(s, 0.3, 3.3, 60, 75, 0.12);
      for (let i = 0; i < 5; i++) metal(s, s.r(0.6, 3.4), s.r(120, 260), s.r(0.08, 0.16), 0.3);
      clunk(s, 3.9, 60, 1.0, 0.35); // seats home
    },
  },
  {
    id: 'contactor_arc', variants: 2, dur: 2.2, vol: 0.95, ref: 5, send: 1.3, priority: 3, when: 'late',
    render(s) {
      clunk(s, 0, 130, 0.9, 0.2);
      metal(s, 0.002, 340, 0.3, 0.25);
      // the arc: hard buzzing 100 Hz series + crackle + a hissing white burst, decaying
      const o = s.osc('sawtooth', 100, 0.005, 0.7);
      const og = s.gain(0);
      s.env(og.gain, [[0.005, 0.5], [0.12, 0.25], [0.7, 0]]);
      s.chain(o, s.shaper('hard', 4), s.hp(200), og, s.out);
      crackle(s, 0, 0.6, 3500, 0.9, 3000);
      s.burst({ start: 0, color: 'white', type: 'highpass', f: 2500, Q: 0.6, a: 0.001, tau: 0.06, level: 0.7 });
      // then the bus energises: rising transformer hum
      const h = s.osc('sawtooth', 50, 0.4, 1.8);
      const hg = s.gain(0);
      s.env(hg.gain, [[0.4, 0], [1.2, 0.07], [2.2, 0.05]]);
      s.chain(h, s.lp(700), hg, s.out);
    },
  },
  {
    id: 'siren_loop', loop: true, variants: 1, dur: 4, vol: 0.5, ref: 10, rolloff: 0.5, send: 1.5, when: 'lazy', channels: 1,
    render(s) {
      const D = L(s, 4);
      // motor siren: rises over 2 s, falls over 2 s (the loop crossfade keeps it smooth)
      for (const [type, mul, lv] of [['sawtooth', 1, 0.06], ['square', 2.01, 0.02]] as const) {
        const o = s.osc(type, 480 * mul, 0, D);
        s.env(o.frequency, [[0, 480 * mul], [2, 920 * mul], [4, 480 * mul], [D, 600 * mul]], 'exp');
        s.chain(o, s.lp(2600), s.gain(lv), s.out);
      }
      bed(s, 'pink', D, 0.02, s.bp(1500, 2));
    },
  },
  {
    id: 'cell_pull', variants: 3, dur: 3.2, vol: 0.9, ref: 5, send: 1.4, priority: 3, maxVoices: 3, minInterval: 0.3, when: 'late',
    render(s) {
      // a heavy breaker handle: ratchet clicks as it comes down, a big latch clunk, then the cell winds down
      for (let i = 0; i < 6; i++) clack(s, i * 0.07, s.r(900, 1300), 0.18, 0.02);
      clunk(s, 0.48, 85, 1.0, 0.35);
      s.burst({ start: 0.48, color: 'white', type: 'highpass', f: 3000, Q: 0.5, a: 0.001, tau: 0.03, level: 0.35 });
      crackle(s, 0.48, 0.25, 1200, 0.4);
      const o = s.osc('sine', 220, 0.5, 2.6);
      s.env(o.frequency, [[0.5, 220], [3.0, 38]], 'exp');
      const g = s.gain(0);
      s.env(g.gain, [[0.5, 0.22], [3.0, 0]]);
      s.chain(o, g, s.out);
      const o2 = s.osc('sawtooth', 440, 0.5, 2.0);
      s.env(o2.frequency, [[0.5, 440], [2.4, 70]], 'exp');
      const g2 = s.gain(0);
      s.env(g2.gain, [[0.5, 0.05], [2.4, 0]]);
      s.chain(o2, s.lp(1500), g2, s.out);
    },
  },
  {
    id: 'core_hum', loop: true, variants: 1, dur: 8, vol: 0.45, ref: 8, rolloff: 0.5, send: 1.2, when: 'lazy', channels: 2,
    render(s) {
      const D = L(s, 8);
      // clean, deep, slightly alive: 40 Hz + harmonics, and a faint high cluster that breathes
      drone(s, 'sine', 40, D, 0.16);
      drone(s, 'sine', 80, D, 0.06);
      drone(s, 'sine', 120.4, D, 0.025);
      for (const [f, p] of [[1046.5, -0.5], [1318.5, 0.5], [1568, 0.1], [2093, -0.2]] as const) {
        const o = s.osc('sine', f, 0, D);
        const g = s.gain(0);
        s.env(g.gain, [[0, 0.003], [D * 0.3, 0.008], [D * 0.6, 0.004], [D, 0.006]]);
        s.chain(o, g, s.pan(p), s.out);
      }
      bed(s, 'pink', D, 0.015, s.bp(3000, 0.8));
    },
  },
  {
    id: 'lift_loop', loop: true, variants: 1, dur: 6, vol: 0.55, bus: 'sfx', channels: 2, when: 'lazy',
    render(s) {
      const D = L(s, 6);
      bed(s, 'brown', D, 0.7, s.lp(200));
      drone(s, 'sawtooth', 75, D, 0.03, s.lp(400));
      drone(s, 'sine', 150, D, 0.02);
      // cable over the sheave + guide shoes ticking past rail joints
      for (let t = 0.4; t < D; t += 1.5) { clack(s, t, s.r(500, 700), 0.12, 0.04); clack(s, t + 0.05, s.r(500, 700), 0.08, 0.04); }
      for (let i = 0; i < 25; i++) s.modal({ start: s.r(0, D - 0.1), level: s.r(0.01, 0.04), modes: s.modes(s.r(800, 2500), [1, 2.4], [0.02, 0.01]) });
    },
  },
  {
    id: 'shoe_slide', variants: 4, dur: 0.7, vol: 0.45, ref: 2, send: 0.6, maxVoices: 2, minInterval: 0.08, when: 'late',
    render(s) {
      const d = s.r(0.18, 0.32);
      scrape(s, 0, d, s.r(1100, 1700), 0.4);
      s.burst({ start: 0, color: 'pink', type: 'bandpass', f: s.r(500, 800), Q: 1, a: 0.01, hold: d * 0.6, tau: 0.04, level: 0.25 });
      s.thump(d, 160, 90, 0.01, 0.02, 0.2); // squared up against its neighbour
      clack(s, d + 0.005, s.r(1400, 1900), 0.08, 0.015);
    },
  },
  // ───────────────────────────── foreman
  {
    id: 'foreman_step', variants: 5, dur: 1.0, vol: 0.75, ref: 4, rolloff: 0.9, send: 1.2, maxVoices: 3, minInterval: 0.08, priority: 2, when: 'late',
    render(s) {
      s.thump(0, 70, 28, 0.07, 0.1, 1.0);
      s.burst({ start: 0, color: 'pink', type: 'lowpass', f: 450, Q: 0.7, a: 0.002, tau: 0.05, level: 0.8 });
      metal(s, 0.002, s.r(160, 220), 0.3, 0.2);
      hiss(s, s.r(0.08, 0.15), s.r(0.15, 0.3), 0.08, 3500); // hydraulic bleed
      servo(s, 0.05, s.r(0.25, 0.4), s.r(160, 200), s.r(240, 300), 0.08);
      for (let i = 0; i < 3; i++) clack(s, s.r(0.01, 0.2), s.r(600, 1200), 0.12, 0.03); // track links / loose arms
    },
  },
  {
    id: 'foreman_slam', variants: 3, dur: 2.2, vol: 1.0, ref: 5, rolloff: 0.8, send: 1.5, maxVoices: 2, minInterval: 0.3, priority: 4, when: 'late',
    render(s) {
      // wind-up whoosh of a heavy arm, then the impact
      const w = s.noise('pink', 0, 0.55);
      const f = s.bp(300, 1.5);
      s.env(f.frequency, [[0, 250], [0.5, 1400]], 'exp');
      const g = s.gain(0);
      s.env(g.gain, [[0, 0], [0.4, 0.5], [0.52, 0]]);
      s.chain(w, f, g, s.out);
      servo(s, 0, 0.45, 220, 520, 0.18);
      const t = 0.5;
      s.thump(t, 75, 25, 0.1, 0.2, 1.0);
      s.thump(t, 150, 50, 0.04, 0.05, 0.7);
      s.burst({ start: t, color: 'brown', type: 'lowpass', f: 700, Q: 0.6, a: 0.001, tau: 0.12, level: 1.0 });
      metal(s, t, s.r(90, 120), 0.5, 0.4);
      crackle(s, t, 0.5, 900, 0.4, 1800); // debris
      for (let i = 0; i < 4; i++) clack(s, t + s.r(0.05, 0.5), s.r(500, 1500), 0.15, 0.04);
    },
  },
  {
    id: 'foreman_loop', loop: true, variants: 1, dur: 6, vol: 0.5, ref: 3.5, send: 0.9, when: 'lazy', channels: 1,
    render(s) {
      const D = L(s, 6);
      drone(s, 'sawtooth', 55, D, 0.05, s.lp(300));
      drone(s, 'sine', 110, D, 0.04);
      for (let i = 0; i < 4; i++) {
        const t = s.r(0.2, D - 0.8);
        servo(s, t, s.r(0.2, 0.5), s.r(180, 260), s.r(300, 420), 0.1);
        if (s.chance(0.5)) hiss(s, t + 0.2, 0.3, 0.05, 3000);
      }
      // three courteous vocalisers murmuring the same phrase, out of sync
      const phrase = ['back to your station please', 'mind the step', 'thank you for waiting'][s.ri(0, 2)];
      for (const [f0, dl, fs] of [[150, 0.3, 1.15], [105, 0.48, 0.95], [190, 0.62, 1.3]] as const) {
        const plan = planText(phrase, 0, s.rnd);
        const dst = s.gain(1);
        s.chain(dst, s.hp(300), s.pk(2100, 1.2, 6), s.shaper('hard', 3), s.lp(4200), s.gain(0.08), s.out);
        buildVoice(s, plan, { f0, fscale: fs, level: 1, delay: dl, jitter: 0.008, contour: 3, style: 'cheerful', vibrato: 0.004, breath: 0.08, dst, saw: true, pitchJumps: 3 });
      }
    },
  },
];
