/**
 * In-game HUD: vitals, weapon/ammo, crosshair + hit-marker, interaction prompt, objective tracker,
 * toast line, location stinger, pickup feed, damage direction. Polls the player every frame but only
 * touches the DOM when a value actually changes.
 */
import * as THREE from 'three';
import type { GameContext, PickupKind, WeaponId } from '../core/types';
import { h, setText, toggle, Scrambler, svg, ICONS } from './dom';
import { BossPips } from './boss';
import { LoaderPips } from './loader';
import { GripMeter } from './grip';
import { SkipRing } from './extra';
import { levelOf } from '../core/progress';

const SEGMENTS = 20;
/** Flashlight cell meter: segments, and the charge below which it reads as low (the player's TORCH.warn). */
const CELL_SEGMENTS = 10;
const CELL_LOW = 0.2;
/** Armour bar: an empty outline stays this long (s) after armour hits 0, then the bar hides (§8.2). */
const ARMOUR_EMPTY_HOLD = 3;
const WEAPON_NAMES: Record<WeaponId, string> = { pistol: 'HD-9 권총', shotgun: 'HD-12 브리처', carbine: '카빈' };
const PICKUP_TEXT: Record<PickupKind, [string, string]> = {
  pistol: ['HD-9 SIDEARM', 'weapon'],
  shotgun: ['HD-12 BREACHER', 'weapon'],
  ammo_pistol: ['9MM ROUNDS', ''],
  ammo_shotgun: ['12G SHELLS', ''],
  medkit: ['트라우마 젤', 'health'],
  carbine: ['카빈', 'weapon'],
  ammo_carbine: ['카빈 탄약', ''],
  vest: ['방탄 조끼', 'armour'],
  plate: ['방탄판', 'armour'],
  keycard: ['로크아웃 키', 'weapon'],
};

export class Hud {
  readonly root: HTMLDivElement;
  private vitals: HTMLDivElement;
  private armour: HTMLDivElement;
  private armNum: HTMLSpanElement;
  private armSegs: HTMLDivElement[] = [];
  private hpNum: HTMLDivElement;
  private wMode: HTMLSpanElement;
  private segs: HTMLDivElement[] = [];
  private torch: HTMLDivElement;
  private torchState: HTMLSpanElement;
  private torchHint: HTMLSpanElement;
  private cell: HTMLDivElement;
  private cellSegs: HTMLDivElement[] = [];
  private weapon: HTMLDivElement;
  private wName: HTMLSpanElement;
  private wIcon: HTMLSpanElement;
  private clip: HTMLDivElement;
  private reserve: HTMLDivElement;
  private pips: HTMLDivElement;
  private wStatus: HTMLDivElement;
  private loaderPips: LoaderPips;
  private grip: GripMeter;
  private xhair: HTMLDivElement;
  private ticks: HTMLDivElement;
  private tickEls: HTMLDivElement[] = [];
  private hitm: HTMLDivElement;
  private prompt: HTMLDivElement;
  private promptText: HTMLSpanElement;
  private objective: HTMLDivElement;
  private objText: HTMLDivElement;
  private objScr: Scrambler;
  private location: HTMLDivElement;
  private locName: HTMLSpanElement;
  private locSub: HTMLElement;
  private toastEl: HTMLDivElement;
  private cpEl: HTMLDivElement;
  private skipRing: SkipRing;
  private cpLeft = 0;
  private pickups: HTMLDivElement;
  private boss: BossPips;
  private dmgEls: { svg: SVGSVGElement; from: THREE.Vector3 | null; angle: number; life: number }[] = [];

  // cached values
  private c = {
    armor: -1, armOn: -1, hp: -1, segsOn: -1, low: false, weapon: undefined as WeaponId | null | undefined, clip: -1, clipSize: -1, reserve: -1,
    reloading: false, focus: null as string | null, torch: null as boolean | null, spread: -1, hit: -1, visible: false,
    cellKey: '', cellOn: -1, aimed: false,
  };
  private spread = 0;
  private toastQueue: { text: string; alert: boolean }[] = [];
  private toastLeft = 0;
  private freshLeft = 0;
  private hitLeft = 0;
  /** Armour has been above 0 at some point on this level (the bar stays hidden until then). */
  private armourEver = false;
  private armourEmptyLeft = 0;
  private armFlashLeft = 0;
  private locLeft = 0;
  private lastRoom: string | null = null;
  private pendingRoom: string | null = null;
  private roomPoll = 0;
  private torchEverToggled = false;
  /** Set by the story (ui.setTorchHint): show the [F] hint only where it is dark and it matters. */
  torchHintWanted = false;
  /** True while a note card is open: the interaction prompt would sit right on top of it. */
  promptSuppressed = false;
  private torchHintTime = 0;
  private tmp = new THREE.Vector3();

  constructor(private ctx: GameContext, parent: HTMLElement) {
    const root = this.root = h('div', 'layer hud off', parent);

    // vitals
    this.vitals = h('div', 'vitals', root);
    const vh = h('div', 'head', this.vitals);
    h('span', 'lbl hp', vh, '생체');
    h('span', 'rule', vh);
    // armour (stage 3b §8.2): directly above the health bar, same column grid; hidden until armour > 0
    this.armour = h('div', 'armour row off', this.vitals);
    const al = h('div', 'armour-lbl', this.armour);
    h('span', 'lbl', al, '방어');
    this.armNum = h('span', 'armour-num', al, '0');
    const abar = h('div', 'armour-bar', this.armour);
    for (let i = 0; i < SEGMENTS; i++) this.armSegs.push(h('div', 'arm-seg', abar));
    const row = h('div', 'row', this.vitals);
    this.hpNum = h('div', 'hp-num glow', row, '100');
    const bar = h('div', 'hp-bar', row);
    for (let i = 0; i < SEGMENTS; i++) this.segs.push(h('div', 'hp-seg', bar));
    this.torch = h('div', 'torch', this.vitals);
    h('i', '', this.torch);
    this.torchState = h('span', '', this.torch, '조명 꺼짐');
    // the cell (battery): shown while the lamp is on or recharging, hidden when full and off
    this.cell = h('div', 'cell hide', this.torch);
    for (let i = 0; i < CELL_SEGMENTS; i++) this.cellSegs.push(h('div', 'cell-seg', this.cell));
    this.torchHint = h('span', 'hint hidden', this.torch, '[F]');

    // weapon
    this.weapon = h('div', 'weapon off', root);
    const wh = h('div', 'head', this.weapon);
    this.wName = h('span', 'lbl', wh, '');
    this.wMode = h('span', 'mode hidden', wh, 'AUTO');
    this.wIcon = h('span', '', wh);
    const ammo = h('div', 'ammo', this.weapon);
    this.clip = h('div', 'clip glow', ammo, '0');
    this.reserve = h('div', 'reserve', ammo, '/ 0');
    this.pips = h('div', 'pips', this.weapon);
    this.wStatus = h('div', 'status', this.weapon, '');

    // crosshair
    this.xhair = h('div', 'xhair', root);
    h('div', 'dot', this.xhair);
    this.ticks = h('div', 'ticks', this.xhair);
    for (const c of ['t-u', 't-d', 't-l', 't-r']) this.tickEls.push(h('div', 'tick ' + c, this.ticks));
    this.hitm = h('div', 'hitm', this.xhair);
    for (let i = 0; i < 4; i++) h('b', '', this.hitm);

    // prompt
    this.prompt = h('div', 'prompt', root);
    h('span', 'bracket', this.prompt);
    h('span', 'key', this.prompt, 'E');
    this.promptText = h('span', 'ptext', this.prompt, '');
    h('span', 'bracket r', this.prompt);

    // objective
    this.objective = h('div', 'objective empty', root);
    const oh = h('div', 'head', this.objective);
    h('span', 'diamond', oh);
    h('span', 'lbl', oh, '목표');
    h('span', 'rule', oh);
    this.objText = h('div', 'text', this.objective, '');
    this.objScr = new Scrambler(this.objText);

    // location + toast + pickups
    this.location = h('div', 'location', root);
    this.locName = h('span', '', this.location, '');
    this.locSub = h('small', '', this.location, levelOf(ctx).place.toUpperCase());
    this.toastEl = h('div', 'toast', root, '');
    this.skipRing = new SkipRing(parent);
    this.pickups = h('div', 'pickups', root);
    // checkpoint indicator (top right): a small turning diamond + label
    this.cpEl = h('div', 'cp', root);
    h('span', 'lbl', this.cpEl, '체크포인트');
    h('i', '', this.cpEl);
    // foreman head pips (level 2 boss), under the checkpoint corner
    this.boss = new BossPips(ctx, root);
    this.loaderPips = new LoaderPips(ctx, root);
    this.grip = new GripMeter(ctx, root);

    // damage direction arcs
    const dmg = h('div', 'dmg', root);
    const defs = `<defs><linearGradient id="cbDmgGrad" x1="0" x2="1"><stop offset="0" stop-color="#ff2a1a" stop-opacity="0"/><stop offset=".5" stop-color="#ff3b2a" stop-opacity="1"/><stop offset="1" stop-color="#ff2a1a" stop-opacity="0"/></linearGradient></defs>`;
    for (let i = 0; i < 4; i++) {
      const r = 132, a = 0.36;
      const x0 = 170 + r * Math.sin(-a), y0 = 170 - r * Math.cos(-a), x1 = 170 + r * Math.sin(a), y1 = 170 - r * Math.cos(a);
      const s = svg('0 0 340 340', [`M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`]);
      if (i === 0) s.insertAdjacentHTML('afterbegin', defs);
      dmg.appendChild(s);
      this.dmgEls.push({ svg: s, from: null, angle: 0, life: 0 });
    }

    const ev = ctx.events;
    ev.on('story:objective', (e) => this.setObjective(e.text));
    ev.on('story:toast', (e) => this.toast(e.text));
    ev.on('pickup', (e) => this.addPickup(e.kind, e.amount));
    ev.on('weapon:fired', () => { this.spread = Math.min(1, this.spread + 0.55); });
    ev.on('player:damaged', (e) => this.damaged(e.from, e.absorbed ?? 0));
    ev.on('player:flashlight', () => { this.torchEverToggled = true; });
  }

  /** Hold-to-skip ring (bottom right; lives outside the HUD layer so it shows during cutscenes). null hides it. */
  showSkip(progress: number | null): void { this.skipRing.set(progress); }

  setVisible(v: boolean): void {
    if (this.c.visible === v) return;
    this.c.visible = v;
    toggle(this.root, 'off', !v);
  }

  setObjective(text: string): void {
    const empty = !text;
    toggle(this.objective, 'empty', empty);
    if (empty) return;
    this.objScr.start(text, Math.min(1.1, 0.25 + text.length * 0.018));
    this.objective.classList.remove('fresh');
    void this.objective.offsetWidth; // restart the rule animation
    this.objective.classList.add('fresh');
    this.freshLeft = 5;
    try { this.ctx.audio.play('terminal_beep', { volume: 0.18 }); } catch { /* ignore */ }
  }

  toast(text: string): void {
    const alert = /LOCK|HOLD|NO POWER|DENIED|OVERRIDE/i.test(text);
    // Don't stack the same line twice.
    if (this.toastQueue.some((t) => t.text === text) || (this.toastLeft > 0 && this.toastEl.textContent === text)) return;
    this.toastQueue.push({ text, alert });
  }

  /** A checkpoint was just saved: show the indicator for ~2 s. */
  checkpoint(): void {
    this.cpEl.classList.remove('show');
    void this.cpEl.offsetWidth; // restart the glyph animation
    this.cpEl.classList.add('show');
    this.cpLeft = 2.2;
  }

  private addPickup(kind: PickupKind, amount: number): void {
    let [name, cls] = PICKUP_TEXT[kind] ?? [String(kind).toUpperCase(), ''];
    if (kind === 'keycard') name = levelOf(this.ctx).keycardName ?? name;
    const row = h('div', 'pk ' + cls, null);
    const showAmt = cls !== 'weapon' && amount > 0;
    h('b', '', row, showAmt ? `+${amount}` : '+');
    h('span', '', row, name);
    this.pickups.prepend(row);
    while (this.pickups.children.length > 5) this.pickups.lastElementChild?.remove();
    setTimeout(() => { row.classList.add('out'); setTimeout(() => row.remove(), 700); }, 3200);
  }

  private damaged(from: THREE.Vector3 | null, absorbed = 0): void {
    if (absorbed > 0) {
      toggle(this.armour, 'flash', false);
      void this.armour.offsetWidth;
      this.armour.classList.add('flash');
      this.armFlashLeft = 0.45;
    }
    toggle(this.vitals, 'hit', false);
    void this.vitals.offsetWidth;
    this.vitals.classList.add('hit');
    this.hitLeft = 0.4;
    if (!from) return;
    // Reuse the oldest arc.
    let slot = this.dmgEls[0];
    for (const d of this.dmgEls) if (d.life < slot.life) slot = d;
    slot.from = from.clone();
    slot.life = 1;
  }

  /** Relative angle (radians, 0 = straight ahead, + = right) from the player to a world point. */
  private relAngle(p: THREE.Vector3): number {
    const pl = this.ctx.player;
    const d = this.tmp.copy(p).sub(pl.position);
    const fx = pl.forward.x, fz = pl.forward.z;
    const fl = Math.hypot(fx, fz) || 1;
    const nfx = fx / fl, nfz = fz / fl;
    // right = forward × up = (-fz, 0, fx)
    const x = d.x * -nfz + d.z * nfx;
    const f = d.x * nfx + d.z * nfz;
    return Math.atan2(x, f);
  }

  update(dt: number): void {
    const ctx = this.ctx;
    const p = ctx.player;
    if (!p) return;
    const c = this.c;

    // ── vitals
    const hp = Math.max(0, Math.ceil(p.health));
    if (hp !== c.hp) {
      c.hp = hp;
      setText(this.hpNum, String(hp));
      const on = Math.ceil((hp / (p.maxHealth || 100)) * SEGMENTS);
      if (on !== c.segsOn) {
        c.segsOn = on;
        this.segs.forEach((s, i) => toggle(s, 'off', i >= on));
      }
      const low = hp <= (p.maxHealth || 100) * 0.3;
      if (low !== c.low) { c.low = low; toggle(this.vitals, 'low', low); }
    }
    if (this.hitLeft > 0 && (this.hitLeft -= dt) <= 0) this.vitals.classList.remove('hit');
    if (this.armFlashLeft > 0 && (this.armFlashLeft -= dt) <= 0) this.armour.classList.remove('flash');

    // ── armour: hidden until > 0 this level; at 0 afterwards an empty outline for 3 s, then hidden
    const maxA = p.maxArmor || 100;
    const armor = Math.max(0, Math.min(maxA, Math.ceil(p.armor ?? 0)));
    if (armor > 0) { this.armourEver = true; this.armourEmptyLeft = 0; }
    else if (c.armor > 0) this.armourEmptyLeft = ARMOUR_EMPTY_HOLD;
    else if (this.armourEmptyLeft > 0) this.armourEmptyLeft = Math.max(0, this.armourEmptyLeft - dt);
    if (armor !== c.armor) {
      c.armor = armor;
      setText(this.armNum, String(armor));
      const on = Math.ceil((armor / maxA) * SEGMENTS);
      if (on !== c.armOn) {
        c.armOn = on;
        this.armSegs.forEach((s, i) => toggle(s, 'off', i >= on));
      }
      toggle(this.armour, 'empty', armor === 0);
    }
    toggle(this.armour, 'off', !(armor > 0 || (this.armourEver && this.armourEmptyLeft > 0)));

    const torch = !!p.flashlightOn;
    const charge = typeof p.flashlightCharge === 'number' ? Math.max(0, Math.min(1, p.flashlightCharge)) : 1;
    const flat = !torch && p.flashlightReady === false;
    if (torch !== c.torch) { c.torch = torch; toggle(this.torch, 'on', torch); }
    const state = torch ? '조명 켜짐' : flat ? '배터리 방전' : '조명 꺼짐';
    if (state !== this.torchState.textContent) setText(this.torchState, state);
    // cell meter: lit segments = charge; amber + pulsing when low and on; dim and filling while it recharges
    const cellOn = Math.ceil(charge * CELL_SEGMENTS - 1e-6);
    const show = torch || charge < 0.999;
    const key = `${show ? 1 : 0}${torch ? 1 : 0}${torch && charge < CELL_LOW ? 1 : 0}${flat ? 1 : 0}`;
    if (key !== c.cellKey) {
      c.cellKey = key;
      toggle(this.cell, 'hide', !show);
      toggle(this.cell, 'charging', !torch);
      toggle(this.cell, 'low', torch && charge < CELL_LOW);
      toggle(this.torch, 'flat', flat);
    }
    if (cellOn !== c.cellOn) {
      c.cellOn = cellOn;
      this.cellSegs.forEach((sg, i) => { toggle(sg, 'off', i >= cellOn); toggle(sg, 'edge', i === cellOn - 1); });
    }
    // Flashlight hint: pulse "[F]" only when the story asks for it, until the player has used it once.
    if (this.torchHintWanted && !this.torchEverToggled && !torch && ctx.state === 'playing') {
      this.torchHintTime += dt;
      toggle(this.torchHint, 'hidden', this.torchHintTime < 0.5);
    } else if (!this.torchHint.classList.contains('hidden')) this.torchHint.classList.add('hidden');

    // ── weapon
    const wid = p.currentWeapon;
    if (wid !== c.weapon) {
      c.weapon = wid;
      toggle(this.weapon, 'off', !wid);
      if (wid) {
        setText(this.wName, WEAPON_NAMES[wid] ?? wid.toUpperCase());
        toggle(this.wMode, 'hidden', wid !== 'carbine'); // full-auto fire (§8.3)
        this.wIcon.innerHTML = '';
        const ic = ICONS[wid];
        if (ic) {
          const s = svg(ic.vb, ic.d, this.wIcon);
          if (wid === 'shotgun') s.style.transform = 'scaleX(-1)';
        }
        c.clip = c.clipSize = c.reserve = -1;
      }
    }
    if (wid) {
      const w = p.weapons[wid];
      if (w) {
        if (w.clipSize !== c.clipSize) {
          c.clipSize = w.clipSize;
          this.pips.innerHTML = '';
          for (let i = 0; i < w.clipSize; i++) h('div', 'pip' + (wid === 'shotgun' ? ' shell' : wid === 'carbine' ? ' slim' : ''), this.pips);
          c.clip = -1;
        }
        if (w.clip !== c.clip) {
          c.clip = w.clip;
          setText(this.clip, String(w.clip));
          const pips = this.pips.children;
          for (let i = 0; i < pips.length; i++) toggle(pips[i], 'spent', i >= w.clip);
          toggle(this.weapon, 'empty', w.clip === 0);
        }
        if (w.reserve !== c.reserve) { c.reserve = w.reserve; setText(this.reserve, `/ ${w.reserve}`); }
        const status = w.reloading ? '재장전 중' : w.clip === 0 ? (w.reserve > 0 ? '재장전  [R]' : '탄약 없음') : '';
        if (status !== this.wStatus.textContent) {
          setText(this.wStatus, status);
          toggle(this.wStatus, 'blink', status !== '');
        }
      }
    }

    // ── prompt + crosshair
    const focus = p.focus && p.focus.enabled && !this.promptSuppressed ? p.focus : null;
    const safe = !!p.safe; // weapon lowered and locked (stage 3a §8.3): no crosshair
    // aiming down the carbine's sights: the iron sight is the crosshair
    const aimed = (p.aiming ?? 0) > 0.35;
    const fkey = (focus ? focus.id + '|' + focus.prompt : '') + (safe ? '|safe' : '') + (aimed ? '|aim' : '');
    if (fkey !== c.focus) {
      c.focus = fkey;
      if (focus) setText(this.promptText, focus.prompt);
      toggle(this.prompt, 'show', !!focus);
      toggle(this.xhair, 'off', !!focus || safe || aimed);
    }
    this.spread = Math.max(0, this.spread - dt * 3.2);
    const sp = Math.round(this.spread * 40) / 40;
    if (sp !== c.spread) {
      c.spread = sp;
      const off = 5 + sp * 9;
      this.ticks.style.opacity = String(Math.min(1, sp * 2.2));
      this.tickEls[0].style.transform = `translateY(${-off - 6}px)`;
      this.tickEls[1].style.transform = `translateY(${off}px)`;
      this.tickEls[2].style.transform = `translateX(${-off - 6}px)`;
      this.tickEls[3].style.transform = `translateX(${off}px)`;
    }
    const hit = Math.round((p.hitMarker ?? 0) * 30) / 30;
    if (hit !== c.hit) {
      c.hit = hit;
      this.hitm.style.opacity = String(hit);
      this.hitm.style.transform = `scale(${1 + (1 - hit) * 0.35})`;
    }

    if (this.cpLeft > 0 && (this.cpLeft -= dt) <= 0) this.cpEl.classList.remove('show');
    this.boss.update(dt);
    this.loaderPips.update(dt);
    this.grip.update(dt);

    // ── objective freshness
    this.objScr.update(dt);
    if (this.freshLeft > 0 && (this.freshLeft -= dt) <= 0) this.objective.classList.remove('fresh');

    // ── toast queue
    if (this.toastLeft > 0) {
      this.toastLeft -= dt;
      if (this.toastLeft <= 0.5 && this.toastEl.classList.contains('show')) this.toastEl.classList.remove('show');
    } else if (this.toastQueue.length && (ctx.state === 'playing' || ctx.state === 'cutscene')) {
      const t = this.toastQueue.shift()!;
      setText(this.toastEl, t.text);
      toggle(this.toastEl, 'alert', t.alert);
      this.toastEl.classList.add('show');
      this.toastLeft = 3.6 + t.text.length * 0.025;
    }

    // ── location stinger (polled at 4 Hz)
    if ((this.roomPoll -= dt) <= 0) {
      this.roomPoll = 0.25;
      let room = null as { id: string; name: string } | null;
      try { room = ctx.level?.roomAt(p.position) ?? null; } catch { /* ignore */ }
      const id = room?.id ?? null;
      if (id !== this.lastRoom) {
        this.lastRoom = id;
        this.pendingRoom = room && room.id !== 'stub' ? room.name : null;
      }
      // Shown once we're actually in play (e.g. MEDICAL 3-A right after the wake-up).
      if (this.pendingRoom && ctx.state === 'playing') {
        setText(this.locName, this.pendingRoom);
        toggle(this.locSub, 'hidden', this.pendingRoom.trim().toUpperCase() === (this.locSub.textContent ?? '').trim().toUpperCase());
        this.pendingRoom = null;
        this.location.classList.remove('show');
        void this.location.offsetWidth;
        this.location.classList.add('show');
        this.locLeft = 3.6;
      }
    }
    if (this.locLeft > 0 && (this.locLeft -= dt) <= 0) this.location.classList.remove('show');

    // ── damage arcs
    for (const d of this.dmgEls) {
      if (d.life <= 0) continue;
      d.life = Math.max(0, d.life - dt * 0.9);
      const a = d.from ? this.relAngle(d.from) : 0;
      d.svg.style.opacity = String(Math.min(1, d.life * 1.6));
      d.svg.style.transform = `rotate(${(a * 180 / Math.PI).toFixed(1)}deg)`;
      if (d.life <= 0) d.svg.style.opacity = '0';
    }
  }

  /** Current room display name (for the pause screen). */
  get roomName(): string { return this.locName.textContent || ''; }
}
