/**
 * Level 6 — the ending (stage 3d §4.9, §8.9; D15, D16, D17; ST-b): the first-person cutscene at the dock console, E1
 * (the manifest) and E2 (the empty cradle on the live feed of `feed6`), then CHOIR's last line, black, `l6_end`.
 *
 * Started by the player only: `console6` ("콘솔 사용", feet in `t6_console`) once the tether is cut, the loader is
 * dead, the quiet reached and nothing is awake anywhere (the console is enabled only then — boss.ts). Every time is a
 * cue on the scene clock computed from the RECORDED line durations (`lineDuration`); each line starts on its cue's
 * frame (`now`, lines decoded first — `linesReady`, preloaded at `l6_quiet`); E1 ≤ 25 s (cap 24.0 s: the gaps after K1
 * and SU2 shrink first, to 0.3), E2 ≤ 25 s. The camera moves ≤ 0.4 m (a quarter of cam0 → cam1, then a 0.1 m push —
 * see FRAMING in `runEnding`). Skippable only
 * once seen; a skip applies the same end state and lands on the card. The feed is created at the quiet (warm-up),
 * active only during E2; without it the console draws the `cctv` fallback of the same shot.
 */
import * as THREE from 'three';
import type { FeedHandle, FeedOpts, LightHandle } from '../../core/types';
import type { CamCue, CamShot } from '../cutscene';
import { lineDuration } from '../voice';
import { FEED6 } from '../../level/l6/setpieces6';
import { Boss6 } from './boss';
import { hhmm6 } from './text';

export type EndingCue6 = 'S1' | 'S2' | 'K1' | 'SU1' | 'SU2' | 'R1' | 'K2' | 'E2' | 'K3' | 'O1' | 'K4' | 'C1' | 'B' | 'END';
export const ENDING_ID6 = 'l6_end';
/** §4.9: the E1 cap (E2's cue) and the longest any beat may run. */
export const E1_CAP6 = 24.0;
export const BEAT_MAX6 = 25.0;
/** The E1 manifest scroll (§6.4; S10a). B-14's row carries the reveal's time. */
const BATCHES6: [string, string, number][] = [
  ['B-01', '4월 14일', 120], ['B-02', '5월 12일', 120], ['B-03', '6월 8일', 240], ['B-04', '7월 5일', 240], ['B-05', '8월 1일', 240],
  ['B-06', '8월 28일', 240], ['B-07', '9월 24일', 240], ['B-08', '10월 21일', 240], ['B-09', '11월 17일', 240], ['B-10', '12월 14일', 240],
  ['B-11', '1월 10일', 240], ['B-12', '2월 6일', 240], ['B-13', '3월 2일', 240],
];
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export abstract class Scenes6 extends Boss6 {
  protected endingTimes: Record<string, number> | null = null;
  protected endingResult: 'played' | 'skipped' | null = null;
  private feed: FeedHandle | null = null;
  private feedTried = false;
  private endingRunning = false;

  /** Every line the ending may say (both variants). */
  protected sceneLines(): string[] {
    return [
      'l6_kes_end_1', 'l6_kes_end_1b', 'l6_sunde_end_1', 'l6_sunde_end_2', 'l6_reyes_end', 'l6_kes_end_2', 'l6_kes_end_3',
      'l6_kes_end_4', 'l6_kes_end_4b', 'l6_choir_last_stop', 'l6_choir_last_command',
    ];
  }

  // ───────────────────────────────────────────────────────────── warm-up (l6_quiet)

  protected override prepareEnding(): void {
    void this.linesReady(this.sceneLines(), 6);
    this.makeFeed();
  }
  /** §8.9: `render.feed` of `feed6` (cam / target / fov from the set piece; its lights pinned; exposure 1.8). */
  private makeFeed(): FeedHandle | null {
    if (this.feed || this.feedTried) return this.feed;
    this.feedTried = true;
    const r = this.ctx.render as unknown as { feed?: (o: FeedOpts & Record<string, unknown>) => FeedHandle };
    if (typeof r.feed !== 'function') return null;
    const u = this.api('feed6') ?? {};
    const cam = u.cam instanceof THREE.Vector3 ? u.cam.clone() : V(...FEED6.cam);
    const target = u.target instanceof THREE.Vector3 ? u.target.clone() : V(...FEED6.target);
    const fov = typeof u.fov === 'number' ? u.fov : FEED6.fov;
    const lights = Array.isArray(u.lights) ? (u.lights as LightHandle[]).filter(Boolean) : [];
    try {
      this.feed = r.feed({
        name: 'cam_tern', width: 640, height: 360, hz: 15, rooms: ['feed6'], position: cam, target, fov,
        active: false, label: '', exposure: FEED6.exposure, ...(lights.length ? { pinLights: lights } : {}),
      });
    } catch (e) { console.warn('[story] feed cam_tern failed — the console draws the cctv fallback', e); this.feed = null; }
    return this.feed;
  }
  private dropFeed(): void {
    if (this.feed) { try { this.feed.active = false; } catch { /* ignore */ } }
  }

  // ───────────────────────────────────────────────────────────── the console

  protected override consoleUse(): void {
    const f = this.f;
    if (!f.quiet || f.ending || this.endingRunning) return;
    // (D17: nothing awake anywhere, none hunting — the console is offered only then; a press that slipped in waits)
    if (this.awakeHostiles().length > 0) return;
    this.S('ending', () => this.runEnding());
  }

  protected override bossFacts() {
    const b = super.bossFacts();
    b.inEnding = this.inEndingNow;
    return b;
  }
  protected override bossDebug() {
    const d = super.bossDebug();
    d.ending.times = this.endingTimes;
    d.ending.result = this.endingResult;
    d.ending.started = this.f.ending;
    return d;
  }

  /**
   * §4.9 schedule from the recorded durations (the variants as they will be said). Cap: when E2 would start after 24.0 s,
   * the gaps after K1 and after SU2 shrink first (to 0.3).
   */
  protected endingSchedule(): Record<EndingCue6, number> & { k1: string; k4: string; c1: string } {
    const d = lineDuration;
    const manifest = this.facts.manifestRead;
    const k1 = manifest ? 'l6_kes_end_1b' : 'l6_kes_end_1';
    const k4 = this.talk.heard.has('l6_aas_2') ? 'l6_kes_end_4' : 'l6_kes_end_4b';
    const c1 = this.choiceId('l6_choir_last');
    const build = (gK1: number, gSU2: number) => {
      const T = { S1: 0, S2: 0.9, K1: 2.4 } as Record<EndingCue6, number>;
      T.SU1 = T.K1 + d(k1) + gK1;
      T.SU2 = T.SU1 + d('l6_sunde_end_1') + 0.5;
      T.R1 = T.SU2 + d('l6_sunde_end_2') + gSU2;
      T.K2 = T.R1 + d('l6_reyes_end') + 1.0;
      T.E2 = T.K2 + d('l6_kes_end_2') + 1.2;
      T.K3 = T.E2 + 1.6;
      T.O1 = T.K3 + d('l6_kes_end_3') + 0.4;
      T.K4 = T.O1 + 2.4;
      T.C1 = T.K4 + d(k4) + 1.0;
      T.B = T.C1 + d(c1) + 1.5;
      // (B: CHOIR's waveform 0.6 s, then everything to black over 0.8 s)
      T.END = T.B + 0.6 + 0.8;
      return T;
    };
    let T = build(0.6, 0.8);
    if (T.E2 > E1_CAP6) T = build(0.3, 0.8);
    if (T.E2 > E1_CAP6) T = build(0.3, 0.3);
    if (T.E2 > BEAT_MAX6 || T.END - T.E2 > BEAT_MAX6) console.error(`[story] the level-6 ending runs E1 ${T.E2.toFixed(2)} s / E2 ${(T.END - T.E2).toFixed(2)} s (> ${BEAT_MAX6})`);
    return Object.assign(T, { k1, k4, c1 });
  }

  /** The console's E1 pages (manifest kind, W5 directives): the header, then the scroll at 0.35 s a line. */
  private manifestText(stage: 'head' | 'scroll' | 'totals' | 'consignee'): string {
    const head = ['@title HEAD-END REPEATER — DOCK', '@rows 13', '트렁크: 신호 손실 · 부이: 신호 손실', '마지막 발송 (버퍼됨): 1건'];
    if (stage === 'head') return head.join('\n');
    const reveal = (this.prog.flags as unknown as Record<string, unknown>).revealT;
    const hm = typeof reveal === 'number' ? hhmm6(this.hourAt(reveal)) : '--:--';
    const body = [
      '적하목록 0031-H — 문풀 경유 발송 — 해저 셔틀',
      ...BATCHES6.map(([b, day, n], i) => (i === 0 ? `${b}  ${day}  CLASP ASSY (CERVICAL) × ${n}` : `${b}  ${day}  × ${n}`)),
      `B-14  WED ${hm}  × 240  — IN WELL`,
      '합계: 클라스프 조립체(경추) — 발송 2,880 · 이송 중 240',
      '수령인: —',
    ];
    const dir = ['@rate 0.35'];
    if (stage === 'totals' || stage === 'consignee') dir.push('@hl 발송 2,880');
    if (stage === 'consignee') dir.push('@cursor 수령인');
    return [...head, ...dir, ...body].join('\n');
  }
  /** `hh:mm:ss` of the test clock now. */
  private clockHms(): string {
    const h = this.clockHour();
    const total = Math.floor(((8 * 60 + 40) * 60 + h * 3600)) % 86400;
    const hh = Math.floor(total / 3600), mm = Math.floor((total % 3600) / 60), ss = total % 60;
    return [hh, mm, ss].map((x) => String(x).padStart(2, '0')).join(':');
  }
  private osd(full: boolean): string {
    const lt = (this as unknown as { launchT?: () => number | null }).launchT?.() ?? this.prog.launchAt;
    const launch = typeof lt === 'number' ? hhmm6(this.hourAt(lt)) : '--:--';
    // (IA-6, the E2 OSD "overdraw": on one line the running seconds landed on the feed's red-lit FLOODED sign at the
    //  top right and read as garbled digits; the clock now runs on its own line under the camera title, on the dark wall)
    const lines = ['초소 4 — 서브베이 — CAM 2', this.clockHms()];
    if (full) lines.push(`SDV 턴 — 발사 ${launch}`, '발사 권한: AAS, L. (중위) — 손바닥 — 활성');
    return lines.join('\n');
  }
  private page(id: string, o: { text?: string; texture?: THREE.Texture } = {}): void {
    if (!this.call('console6', 'page', id, o)) {
      // (no set piece: the screen itself)
      if (id === 'manifest' || id === 'idle') this.screen('console6', 'manifest', o.text ?? '');
    }
  }
  private feedPage(full: boolean): void {
    const h = this.feed;
    if (h) { try { h.active = true; } catch { /* ignore */ } this.page('feed', { texture: h.texture, text: this.osd(full) }); }
    else this.page('cctv', { text: this.osd(full) });
  }

  // ───────────────────────────────────────────────────────────── the scene

  /** E1 + E2 → `l6_end`. */
  protected async runEnding(): Promise<void> {
    const f = this.f;
    if (f.ending || this.endingRunning) return;
    this.endingRunning = true;
    this.inEndingNow = true;
    f.ending = true;
    this.stamp('ending');
    this.w.setInteractable('console6', false);
    // (the HUD's radio strip is off for the scene: the route stops updating it while `inEndingNow`)
    try { this.ctx.ui.radio(null); } catch { /* ignore */ }
    const cut = this.cut;
    let ok = false;
    try {
      // lines decoded before the camera is taken (≤ 1.5 s; preloaded since the quiet)
      let ready = false;
      const pr = this.linesReady(this.sceneLines(), 1.5).then(() => { ready = true; });
      await this.hold(0.02);
      if (!ready) { try { this.ctx.player.cinematic(true, { viewmodel: 'hidden' }); } catch { /* ignore */ } await pr; }
      this.makeFeed();
      // the flashlight off for the scene (it glares on the screen's glass at 1.4 m; 3a C2's rule) — the level ends after it
      try {
        const pl = this.ctx.player as unknown as { flashlightOn: boolean; applyLoadout?: (s: { flashlight: boolean }) => void };
        if (pl.flashlightOn) pl.applyLoadout?.({ flashlight: false });
      } catch { /* ignore */ }
      if (!cut) { console.error('[story] level 6: no cutscene rig — the ending goes straight to the end'); this.endingResult = 'skipped'; return; }
      const T = this.endingSchedule();
      this.endingTimes = Object.fromEntries(Object.entries(T).filter(([, v]) => typeof v === 'number').map(([k, v]) => [k, +(v as number).toFixed(3)]));
      const cam0 = this.mk('mk6_end_cam0'), cam1 = this.mk('mk6_end_cam1'), scr = this.mk('mk6_end_screen');
      const stand = this.obj('mk6_end_stand') ? this.mk('mk6_end_stand') : cam0.clone().setY(cam0.y - 1.65);
      const endYaw = Math.atan2(-(scr.x - stand.x), -(scr.z - stand.z));
      // FRAMING (decision, ST-b): the plan's fov 55 → 48 from cam0 (1.5 m) / cam1 (1.1 m) shows about half of W7's 3.2 m
      // screen — the manifest's line starts and the OSD were cut off. The eye dollies a quarter of cam0 → cam1 (0.1 m) at
      // fov 72 → 68, so the whole screen stays in frame on 16:9, and E2's push is 0.1 m (screen ≈ 100 % of the width).
      const near = cam0.clone().lerp(cam1, 0.25);
      const push = near.clone().add(scr.clone().sub(near).setY(0).normalize().multiplyScalar(0.1));
      const say = (id: string) => { void this.say(id, { pri: 'scene', now: true, gap: 0.02, cue: this.now }); };
      const mark = (n: string) => this.stamp(`end_${n}`);
      // (S1 flushes EVERY line, a scene line too: Kessler's console ask still playing at the press, or a queued CHOIR
      //  line, would otherwise hold the channel past K1 and push the scene's lines off their cues — IA-6)
      const cues: CamCue[] = [
        { t: 0, run: () => { this.talk.flush(false); mark('S1'); this.page('manifest', { text: this.manifestText('head') }); } },
        { t: T.S2, run: () => { mark('S2'); this.page('manifest', { text: this.manifestText('scroll') }); } },
        { t: T.K1, run: () => { mark('K1'); say('l6_kes_end_1'); } },
        { t: T.SU1, run: () => { mark('SU1'); this.page('manifest', { text: this.manifestText('totals') }); say('l6_sunde_end_1'); } },
        { t: T.SU2, run: () => { mark('SU2'); say('l6_sunde_end_2'); } },
        { t: T.R1, run: () => { mark('R1'); say('l6_reyes_end'); } },
        { t: T.K2, run: () => { mark('K2'); this.page('manifest', { text: this.manifestText('consignee') }); say('l6_kes_end_2'); } },
        // E2: the screen changes by itself — static 0.3 s, then the live feed of the empty cradle
        { t: T.E2, run: () => { mark('E2'); this.call('feed6', 'beacons', true); this.call('feed6', 'lamp', true); this.page('static'); } },
        { t: T.E2 + 0.3, run: () => this.feedPage(false) },
        { t: T.K3, run: () => { mark('K3'); say('l6_kes_end_3'); } },
        { t: T.O1, run: () => { mark('O1'); this.feedPage(true); } },
        { t: T.K4, run: () => { mark('K4'); say('l6_kes_end_4'); } },
        { t: T.C1, run: () => { mark('C1'); say(T.c1); } },
        { t: T.B, run: () => { mark('B'); this.page('choir'); } },
        { t: T.B + 0.6, run: () => { this.page('black'); this.dropFeed(); } },
      ];
      // camera: S1 blend onto cam0 (0.9 s, fov 72 → 55); S2 the dolly cam0 → cam1 over the whole of E1 (fov 55 → 48 over
      // its first 12 s); E2 hold at cam1 (fov 48); K3 the 0.15 m push over 3 s; hold; the last 0.8 s to black
      const e1 = T.E2 - T.S2;
      const fovT = Math.min(12, e1);
      const mid = cam0.clone().lerp(near, fovT / e1);
      const shots: CamShot[] = [
        { dur: T.S2, eye: cam0, look: scr, fov: [72, 70], enter: 'blend', blend: 0.6, body: stand, bodyYaw: endYaw, sway: 0.5 },
        { dur: fovT, eye: [cam0, mid], look: scr, fov: [70, 68], ease: 'linear', sway: 0.4 },
        ...(e1 - fovT > 1e-3 ? [{ dur: e1 - fovT, eye: [mid, near], look: scr, fov: 68, ease: 'linear', sway: 0.4 } as CamShot] : []),
        { dur: T.K3 - T.E2, eye: near, look: scr, fov: 68, sway: 0.3 },
        { dur: 3.0, eye: [near, push], look: scr, fov: 68, ease: 'inOut', sway: 0.25 },
        { dur: Math.max(0.9, T.END - (T.K3 + 3.0)), eye: push, look: scr, fov: 68, sway: 0.2, fadeOut: 0.8 },
      ];
      this.stamp('ending_start');
      const r = await cut.play(ENDING_ID6, shots, {
        place: { pos: stand.clone(), yaw: endYaw, pitch: 0 }, viewmodel: 'hidden', then: 'hold', cues, safe: true,
        end: (how) => {
          if (how === 'skipped') this.talk.flush();
          this.endingResult = how === 'skipped' ? 'skipped' : 'played';
          this.dropFeed();
        },
      });
      ok = r !== 'refused';
    } catch (e) {
      console.error('[story] level-6 ending failed — straight to the end', e);
      this.endingResult = this.endingResult ?? 'skipped';
    } finally {
      this.inEndingNow = false;
      this.endingRunning = false;
      this.dropFeed();
      if (!ok && this.cut && this.endingResult === null && !this.ctx.player.alive) {
        // refused (he died at the console — a bug-class rescue): the console is offered again after the load
        f.ending = false;
      } else if (!this.ended) {
        // (whatever happened above, the chapter ends: never a hang on a failed scene or a dropped line)
        this.beat('l6_end');
        await this.hooks.end();
      }
    }
  }
}
