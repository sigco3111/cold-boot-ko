/**
 * Stage 3d D12 / D13 / §8.3: wading data and the depth at the feet (`Player.wading`), from `level.water`.
 * Every number of the player's water behaviour is here (check-water reads it through `player.debug.wadeConst()`).
 */
import type * as THREE from 'three';
import type { WaterVolume } from '../core/types';
import type { WadeCaps } from './controller';

export const WADE = {
  /** Below this the feet are dry (no caps, normal footsteps). */
  wet: 0.1,
  /** 0.1 … 0.35: shin-deep. */
  shin: 0.35,
  /** 0.35 … 0.7: knee-deep. ≥ 0.7: waist-deep (to the volume's `stand`), then deep. */
  waist: 0.7,
  /** Depth bands → caps (walk / sprint multipliers on the dry speeds; jump HEIGHT multiplier; crouch allowed). */
  shinCaps: { walk: 0.85, sprint: 0.8, jump: 1, crouch: true } as WadeCaps,
  kneeCaps: { walk: 0.6, sprint: 0, jump: 0.5, crouch: true } as WadeCaps,
  waistCaps: { walk: 0.4, sprint: 0, jump: 0, crouch: false } as WadeCaps,
  /** Wake rings every this many seconds while moving in water ≥ `wet`. */
  wakeEvery: 0.35,
  /** Slow view sway in waist water: amplitude (deg, pitch; yaw gets 0.6 of it) and period (s). */
  swayDeg: 0.6,
  swayPeriod: 3.2,
  /** Deep water (deeper than the volume's `stand`): the sink is held to this (m/s), the rescue comes after `holdFor`. */
  sink: 0.5,
  holdFor: 1.0,
  /** The rescue: black for this long, then placed at the nearest exit marker with this much health lost (never below 1). */
  black: 0.5,
  cost: 15,
  /** How dark the view goes while held under (post fade 0 … 1) and the audio muffle. */
  underFade: 0.45,
  muffle: 0.9,
  /** Where a rescue may put him (the nearest that exists); none → the level's spawn. Level data (§8.11 markers). */
  exits: ['mk6_lw_exit', 'mk6_le_exit', 'mk6_boss_safe'] as readonly string[],
  toastCrouch: '웅크리기에는 너무 깊습니다',
  toastRescue: '스스로 빠져나왔습니다',
} as const;

export interface DepthInfo { d: number; vol: WaterVolume | null; deep: boolean }

/**
 * Depth of water at the feet: the deepest volume whose plan box contains the feet (x / z) with the feet between the
 * box's floor (−0.05) and the surface. `deep` = deeper than that volume's `stand`.
 */
export function depthAt(water: readonly WaterVolume[] | undefined, p: THREE.Vector3, out: DepthInfo): DepthInfo {
  out.d = 0; out.vol = null; out.deep = false;
  if (!water) return out;
  for (let i = 0; i < water.length; i++) {
    const w = water[i], b = w.box;
    if (p.x < b.min.x || p.x > b.max.x || p.z < b.min.z || p.z > b.max.z) continue;
    if (p.y >= w.surface || p.y < b.min.y - 0.05) continue;
    const d = w.surface - p.y;
    if (d > out.d) { out.d = d; out.vol = w; out.deep = d > w.stand; }
  }
  return out;
}

/** The caps of a depth (undefined = dry). */
export function wadeCaps(d: number): WadeCaps | undefined {
  if (d < WADE.wet) return undefined;
  if (d < WADE.shin) return WADE.shinCaps;
  if (d < WADE.waist) return WADE.kneeCaps;
  return WADE.waistCaps;
}
