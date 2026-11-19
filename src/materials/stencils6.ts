/**
 * Stage 3d container stencil atlas (docs/plans/stage-3d.md §8.8): one 1024² canvas with the cargo marks the moon-pool
 * containers carry — `B-01` … `B-14`, `할시온 바이오 시스템즈 사업부`, the owner code, `MAX GROSS` / `TARE` — in worn
 * white stencil paint, so every container label in the chamber is ONE material (instanced label quads with per-
 * instance UV offsets, or merged quads). Not a contract member: the kit / dressing import it directly.
 *
 *   const a = stencilAtlas6();                     // cached; the same material every call
 *   a.material                                    // alpha-tested, polygon-offset (sits on the container face)
 *   a.rect('B-14')                                // [u0, v0, u1, v1] of the cell (texture v up)
 *   a.aspect('B-14')                              // width / height of the cell's quad (letters undistorted)
 *   a.apply(planeGeometry, 'B-14')                // remaps a PlaneGeometry's UVs onto the cell (returns it)
 *
 * Cells: rows of 128 px. Rows 0–3: the 14 batch marks + 2 spares (`B-15`, `B-16`) at 256 × 128 (aspect 2); row 4
 * the division name at 1024 × 128 (aspect 8); row 5 the owner code `HBSU 140 031 [4]` at 1024 × 128; row 6
 * `최대 총중량 30,480 KG` and `공차중량 2,250 KG` at 512 × 128 (aspect 4); row 7 `클라스프 조립체(경추용)` and
 * `이쪽이 위` at 512 × 128.
 */
import * as THREE from 'three';

export interface StencilAtlas6 {
  material: THREE.MeshStandardMaterial;
  texture: THREE.CanvasTexture;
  labels: readonly string[];
  rect(label: string): [number, number, number, number];
  aspect(label: string): number;
  apply(geo: THREE.BufferGeometry, label: string): THREE.BufferGeometry;
}

const N = 1024, ROW = 128;
const FONT = '"DIN Condensed", "Arial Narrow", "Roboto Condensed", "Helvetica Neue", Arial, sans-serif';

interface Cell { label: string; x: number; y: number; w: number; h: number }
function layout(): Cell[] {
  const cells: Cell[] = [];
  for (let i = 0; i < 16; i++) cells.push({ label: `B-${String(i + 1).padStart(2, '0')}`, x: (i % 4) * 256, y: Math.floor(i / 4) * ROW, w: 256, h: ROW });
  cells.push({ label: '할시온 바이오 시스템즈 사업부', x: 0, y: 4 * ROW, w: N, h: ROW });
  cells.push({ label: 'HBSU 140 031 [4]', x: 0, y: 5 * ROW, w: N, h: ROW });
  cells.push({ label: '최대 총중량 30,480 KG', x: 0, y: 6 * ROW, w: 512, h: ROW });
  cells.push({ label: '공차중량 2,250 KG', x: 512, y: 6 * ROW, w: 512, h: ROW });
  cells.push({ label: '클라스프 조립체(경추용)', x: 0, y: 7 * ROW, w: 512, h: ROW });
  cells.push({ label: '이쪽이 위', x: 512, y: 7 * ROW, w: 512, h: ROW });
  return cells;
}

/** xorshift for the paint wear (deterministic). */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

let cached: StencilAtlas6 | null = null;

export function stencilAtlas6(): StencilAtlas6 {
  if (cached) return cached;
  const cells = layout();
  const cv = document.createElement('canvas'); cv.width = N; cv.height = N;
  const g = cv.getContext('2d')!;
  g.clearRect(0, 0, N, N);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const c of cells) {
    const big = c.label.startsWith('B-');
    let sz = c.h * (big ? 0.78 : 0.62);
    const maxW = c.w * 0.92;
    g.font = `700 ${Math.round(sz)}px ${FONT}`;
    while (g.measureText(c.label).width > maxW && sz > 8) { sz -= 2; g.font = `700 ${Math.round(sz)}px ${FONT}`; }
    g.fillStyle = '#f2f0ea';
    g.fillText(c.label, c.x + c.w / 2, c.y + c.h / 2 + sz * 0.04);
    // stencil bridges: thin vertical gaps through the letters at their mid-height bowls
    g.save();
    g.globalCompositeOperation = 'destination-out';
    const tw = g.measureText(c.label).width, x0 = c.x + c.w / 2 - tw / 2;
    const r = rng(c.x * 7 + c.y * 13 + 1);
    const step = sz * 0.56;
    for (let x = x0 + step * 0.5; x < x0 + tw; x += step) {
      if (r() < 0.45) continue;
      g.fillRect(x, c.y + c.h / 2 - sz * (0.1 + r() * 0.25), Math.max(2, sz * 0.05), sz * 0.08);
    }
    g.restore();
  }
  // wear: the paint flaked off in speckles and scrapes (alpha punched out), heavier towards the cells' lower edges
  g.save();
  g.globalCompositeOperation = 'destination-out';
  const r = rng(9137);
  for (let i = 0; i < 26000; i++) {
    const x = r() * N, y = r() * N;
    const low = ((y % ROW) / ROW);
    if (r() > 0.35 + 0.5 * low) continue;
    const s = 0.8 + r() * r() * 5;
    g.globalAlpha = 0.4 + r() * 0.6;
    g.fillRect(x, y, s, s * (0.5 + r()));
  }
  for (let i = 0; i < 90; i++) {
    const x = r() * N, y = r() * N, L = 30 + r() * 140;
    g.globalAlpha = 0.6 + r() * 0.4;
    g.fillRect(x, y, L, 1 + r() * 2.5);
  }
  g.restore();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const material = new THREE.MeshStandardMaterial({
    name: 'stencil_atlas6', map: tex, transparent: false, alphaTest: 0.5, roughness: 0.72, metalness: 0,
    color: 0xd8d6d0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
  });
  const byLabel = new Map(cells.map((c) => [c.label, c]));
  const cell = (label: string) => {
    const c = byLabel.get(label);
    if (!c) { console.warn(`[materials] stencilAtlas6: no cell "${label}"`); return cells[0]; }
    return c;
  };
  cached = {
    material, texture: tex, labels: cells.map((c) => c.label),
    rect(label) { const c = cell(label); return [c.x / N, 1 - (c.y + c.h) / N, (c.x + c.w) / N, 1 - c.y / N]; },
    aspect(label) { const c = cell(label); return c.w / c.h; },
    apply(geo, label) {
      const [u0, v0, u1, v1] = this.rect(label);
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
      uv.needsUpdate = true;
      return geo;
    },
  };
  return cached;
}
