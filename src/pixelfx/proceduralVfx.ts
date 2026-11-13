import { EliteAffix, EnemyKind, ProjectileEntity } from '../game/types';
import type { AfterimageGhost, PixelFXBuffer, RGB, SlashRenderStyle } from './engine';

/**
 * Pure Procedural PixelFX Visual Effects Engine (Reference: `github.com/patch-gg/pixelfx`)
 *
 * - ZERO bitmap/sprite textures (`禁止使用贴图`): 100% code-driven integer pixel-grid effects.
 * - Dual-buffer architecture: solid quantized 6-stop color ramp buffer + additive light buffer.
 * - 4x4 Bayer matrix ordered threshold dithering (`BAYER_4X4`) for crisp pixel-art palette
 *   transitions and stippled wake dissolution (zero blurry alpha gradients or smooth vector arcs).
 * - O(1) stamp-cleared `960x540` (`PFX_CELL = 2` on `1920x1080`) span-merging batch rasterizer:
 *   flushes an entire multi-band effect in <= 6 `ctx.fill()` calls for locked 60 FPS performance.
 */

export const PFX_CELL = 4; // 1 PixelFX cell = 4x4 native 1920x1080 px = 1 world pixel unit (matches PIXEL_SCALE = 4)
export const PFX_GRID_W = 480;
export const PFX_GRID_H = 270;
const WORLD_TO_GRID = 1; // PIXEL_SCALE (4) / PFX_CELL (4) = 1 cell per world unit

export const PFX_BAYER_4X4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
] as const;

export type PfxPaletteId =
  | 'silver'
  | 'cyan'
  | 'crimson'
  | 'violet'
  | 'void'
  | 'gold'
  | 'emerald'
  | 'smoke';

export interface PfxPalette {
  readonly id: PfxPaletteId;
  // 6-stop dark-to-bright color ramp (like patch-gg/pixelfx `["#102","#215","#43a","#8cf","#cff","#fff"]`)
  readonly css: readonly [string, string, string, string, string, string];
  readonly rgb: readonly [RGB, RGB, RGB, RGB, RGB, RGB];
  readonly light: RGB;
}

function makePalette(
  id: PfxPaletteId,
  stops: readonly [RGB, RGB, RGB, RGB, RGB, RGB],
  light: RGB
): PfxPalette {
  return {
    id,
    rgb: stops,
    css: [
      `rgb(${stops[0].r},${stops[0].g},${stops[0].b})`,
      `rgb(${stops[1].r},${stops[1].g},${stops[1].b})`,
      `rgb(${stops[2].r},${stops[2].g},${stops[2].b})`,
      `rgb(${stops[3].r},${stops[3].g},${stops[3].b})`,
      `rgb(${stops[4].r},${stops[4].g},${stops[4].b})`,
      `rgb(${stops[5].r},${stops[5].g},${stops[5].b})`,
    ],
    light,
  };
}

export const PFX_PALETTES: Record<PfxPaletteId, PfxPalette> = {
  silver: makePalette(
    'silver',
    [
      { r: 10, g: 19, b: 42 },
      { r: 24, g: 49, b: 96 },
      { r: 54, g: 114, b: 198 },
      { r: 118, g: 204, b: 255 },
      { r: 212, g: 246, b: 255 },
      { r: 255, g: 255, b: 255 },
    ],
    { r: 52, g: 92, b: 138 }
  ),
  cyan: makePalette(
    'cyan',
    [
      { r: 6, g: 26, b: 44 },
      { r: 13, g: 64, b: 98 },
      { r: 24, g: 138, b: 184 },
      { r: 72, g: 232, b: 255 },
      { r: 200, g: 255, b: 255 },
      { r: 255, g: 255, b: 255 },
    ],
    { r: 38, g: 112, b: 142 }
  ),
  crimson: makePalette(
    'crimson',
    [
      { r: 34, g: 6, b: 18 },
      { r: 92, g: 12, b: 40 },
      { r: 184, g: 28, b: 72 },
      { r: 255, g: 74, b: 122 },
      { r: 255, g: 208, b: 218 },
      { r: 255, g: 250, b: 245 },
    ],
    { r: 112, g: 28, b: 56 }
  ),
  violet: makePalette(
    'violet',
    [
      { r: 19, g: 8, b: 38 },
      { r: 48, g: 18, b: 92 },
      { r: 108, g: 44, b: 196 },
      { r: 188, g: 110, b: 255 },
      { r: 240, g: 214, b: 255 },
      { r: 255, g: 255, b: 255 },
    ],
    { r: 84, g: 40, b: 132 }
  ),
  // Dimension-Cut Void Ramp: stop 6 (highest priority core) is deep abyssal obsidian,
  // surrounded by electric violet-indigo spatial fracture edges (zero blinding white glare).
  void: makePalette(
    'void',
    [
      { r: 22, g: 13, b: 48 },
      { r: 48, g: 28, b: 98 },
      { r: 102, g: 64, b: 192 },
      { r: 168, g: 128, b: 255 },
      { r: 222, g: 206, b: 255 },
      { r: 8, g: 6, b: 20 },
    ],
    { r: 0, g: 0, b: 0 }
  ),
  gold: makePalette(
    'gold',
    [
      { r: 36, g: 19, b: 6 },
      { r: 92, g: 50, b: 14 },
      { r: 184, g: 110, b: 24 },
      { r: 255, g: 190, b: 66 },
      { r: 255, g: 240, b: 168 },
      { r: 255, g: 255, b: 255 },
    ],
    { r: 104, g: 72, b: 24 }
  ),
  emerald: makePalette(
    'emerald',
    [
      { r: 6, g: 30, b: 26 },
      { r: 14, g: 74, b: 60 },
      { r: 28, g: 150, b: 120 },
      { r: 72, g: 236, b: 184 },
      { r: 198, g: 255, b: 234 },
      { r: 255, g: 255, b: 255 },
    ],
    { r: 28, g: 98, b: 76 }
  ),
  smoke: makePalette(
    'smoke',
    [
      { r: 16, g: 20, b: 38 },
      { r: 30, g: 38, b: 68 },
      { r: 54, g: 68, b: 114 },
      { r: 88, g: 108, b: 168 },
      { r: 136, g: 160, b: 218 },
      { r: 196, g: 214, b: 255 },
    ],
    { r: 16, g: 20, b: 36 }
  ),
};

export function bayerThreshold01(gx: number, gy: number): number {
  return (PFX_BAYER_4X4[((gy & 3) << 2) + (gx & 3)] + 0.5) * 0.0625;
}

/**
 * Quantizes continuous `[0..1]` energy into a discrete `1..maxStop` palette stop
 * using 4x4 Bayer ordered dithering at every band boundary (`patch-gg/pixelfx` style).
 * Returns `0` when dither-culled (transparent).
 */
export function quantizeBayerStop(
  energy01: number,
  gx: number,
  gy: number,
  maxStop = 6
): number {
  if (energy01 <= 0.055) return 0;
  // 1x1-texel 4x4 Bayer ordered stipple dissolution on outer trailing wake
  if (energy01 < 0.26) {
    if (energy01 * 3.82 < bayerThreshold01(gx, gy)) {
      return 0;
    }
  }
  // Solid interior pixel bands + 2-texel-paired Bayer seam dithering for clean horizontal spans
  const bSeam = bayerThreshold01(gx >> 1, gy);
  const scaled = energy01 * maxStop + (bSeam - 0.5) * 0.22;
  const idx = Math.ceil(scaled);
  if (idx <= 0) return 0;
  return idx > maxStop ? maxStop : idx;
}

const MAX_SPANS_PER_STOP = 8192;

export interface PfxPlotSink {
  readonly width: number;
  readonly height: number;
  plot(gx: number, gy: number, stop1to6: number, overwrite?: boolean): void;
  plotEnergy(gx: number, gy: number, energy01: number, maxStop?: number): void;
  plotBresenhamLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    stop1to6: number,
    thicknessCells?: number,
    ditherCoverage?: number
  ): void;
  plotDisc(
    cx: number,
    cy: number,
    radiusCells: number,
    fade?: number,
    maxStop?: number,
    topHighlight?: boolean
  ): void;
}

function plotSinkBresenhamLine(
  sink: PfxPlotSink,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stop1to6: number,
  thicknessCells = 1,
  ditherCoverage = 1
): void {
  if (!Number.isFinite(x0 + y0 + x1 + y1)) return;
  let ix0 = Math.round(x0);
  let iy0 = Math.round(y0);
  const ix1 = Math.round(x1);
  const iy1 = Math.round(y1);

  const w = sink.width;
  const h = sink.height;
  const pad = thicknessCells + 2;
  if (
    (ix0 < -pad && ix1 < -pad) ||
    (ix0 >= w + pad && ix1 >= w + pad) ||
    (iy0 < -pad && iy1 < -pad) ||
    (iy0 >= h + pad && iy1 >= h + pad)
  ) {
    return;
  }

  const dx = Math.abs(ix1 - ix0);
  const dy = -Math.abs(iy1 - iy0);
  const sx = ix0 < ix1 ? 1 : -1;
  const sy = iy0 < iy1 ? 1 : -1;
  let err = dx + dy;
  const halfLow = -((thicknessCells - 1) >> 1);
  const halfHigh = thicknessCells >> 1;
  let maxSteps = Math.min(2048, dx - dy + 2);

  while (maxSteps-- > 0) {
    for (let oy = halfLow; oy <= halfHigh; oy++) {
      const py = iy0 + oy;
      for (let ox = halfLow; ox <= halfHigh; ox++) {
        const px = ix0 + ox;
        if (ditherCoverage >= 0.96 || bayerThreshold01(px, py) <= ditherCoverage) {
          sink.plot(px, py, stop1to6);
        }
      }
    }
    if (ix0 === ix1 && iy0 === iy1) break;
    const e2 = err << 1;
    if (e2 >= dy) {
      err += dy;
      ix0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      iy0 += sy;
    }
  }
}

function plotSinkDisc(
  sink: PfxPlotSink,
  cx: number,
  cy: number,
  radiusCells: number,
  fade = 1,
  maxStop = 5,
  topHighlight = false
): void {
  const r = Math.max(1, radiusCells);
  const icx = Math.round(cx);
  const icy = Math.round(cy);
  const ir = Math.ceil(r);
  const w = sink.width;
  const h = sink.height;
  if (icx + ir < 0 || icx - ir >= w || icy + ir < 0 || icy - ir >= h) return;

  const invR = 1 / r;
  const y0 = Math.max(0, icy - ir);
  const y1 = Math.min(h - 1, icy + ir);
  const x0 = Math.max(0, icx - ir);
  const x1 = Math.min(w - 1, icx + ir);

  for (let gy = y0; gy <= y1; gy++) {
    const dy = (gy - icy) * invR;
    const dy2 = dy * dy;
    for (let gx = x0; gx <= x1; gx++) {
      const dx = (gx - icx) * invR;
      const d2 = dx * dx + dy2;
      if (d2 > 1) continue;
      let energy = (1 - d2) * fade;
      if (topHighlight && dx < 0.25 && dy < -0.1) {
        energy = Math.min(1, energy + 0.22 * fade);
      }
      sink.plotEnergy(gx, gy, energy, maxStop);
    }
  }
}

/**
 * Pre-allocated O(1)-clear `480x270` integer pixel-grid stage with per-row sparse bounds
 * and horizontal span merging. Zero per-frame heap allocations; emits direct `ctx.fillRect`
 * scanlines grouped by 6-stop palette index (avoiding slow compound-path tessellation).
 */
export class PixelFXStage implements PfxPlotSink {
  public readonly width = PFX_GRID_W;
  public readonly height = PFX_GRID_H;
  private readonly stampBuf = new Uint32Array(PFX_GRID_W * PFX_GRID_H);
  private readonly colorBuf = new Uint8Array(PFX_GRID_W * PFX_GRID_H);
  private readonly rowStamp = new Int32Array(PFX_GRID_H);
  private readonly rowMinX = new Int16Array(PFX_GRID_H);
  private readonly rowMaxX = new Int16Array(PFX_GRID_H);
  private stampId = 1;

  private minX = PFX_GRID_W;
  private maxX = -1;
  private minY = PFX_GRID_H;
  private maxY = -1;

  private readonly spanX: Int16Array[];
  private readonly spanY: Int16Array[];
  private readonly spanW: Int16Array[];
  private readonly spanCounts = new Int32Array(6);

  constructor() {
    this.spanX = Array.from({ length: 6 }, () => new Int16Array(MAX_SPANS_PER_STOP));
    this.spanY = Array.from({ length: 6 }, () => new Int16Array(MAX_SPANS_PER_STOP));
    this.spanW = Array.from({ length: 6 }, () => new Int16Array(MAX_SPANS_PER_STOP));
  }

  public begin(): void {
    this.stampId = (this.stampId + 1) | 0;
    if (this.stampId >= 0x7ffffff0 || this.stampId <= 0) {
      this.stampBuf.fill(0);
      this.rowStamp.fill(0);
      this.stampId = 1;
    }
    this.minX = PFX_GRID_W;
    this.maxX = -1;
    this.minY = PFX_GRID_H;
    this.maxY = -1;
  }

  public plot(gx: number, gy: number, stop1to6: number, overwrite = false): void {
    const ix = gx | 0;
    const iy = gy | 0;
    if (ix < 0 || ix >= PFX_GRID_W || iy < 0 || iy >= PFX_GRID_H || stop1to6 <= 0) return;
    const idx = iy * PFX_GRID_W + ix;
    const st = stop1to6 > 6 ? 6 : stop1to6;
    if (this.stampBuf[idx] !== this.stampId) {
      this.stampBuf[idx] = this.stampId;
      this.colorBuf[idx] = st;
      if (this.rowStamp[iy] !== this.stampId) {
        this.rowStamp[iy] = this.stampId;
        this.rowMinX[iy] = ix;
        this.rowMaxX[iy] = ix;
      } else {
        if (ix < this.rowMinX[iy]) this.rowMinX[iy] = ix;
        if (ix > this.rowMaxX[iy]) this.rowMaxX[iy] = ix;
      }
      if (ix < this.minX) this.minX = ix;
      if (ix > this.maxX) this.maxX = ix;
      if (iy < this.minY) this.minY = iy;
      if (iy > this.maxY) this.maxY = iy;
    } else if (overwrite || st > this.colorBuf[idx]) {
      this.colorBuf[idx] = st;
    }
  }

  public plotEnergy(gx: number, gy: number, energy01: number, maxStop = 6): void {
    const ix = gx | 0;
    const iy = gy | 0;
    if (ix < 0 || ix >= PFX_GRID_W || iy < 0 || iy >= PFX_GRID_H) return;
    const st = quantizeBayerStop(energy01, ix, iy, maxStop);
    if (st > 0) {
      this.plot(ix, iy, st);
    }
  }

  public plotBresenhamLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    stop1to6: number,
    thicknessCells = 1,
    ditherCoverage = 1
  ): void {
    plotSinkBresenhamLine(this, x0, y0, x1, y1, stop1to6, thicknessCells, ditherCoverage);
  }

  public plotDisc(
    cx: number,
    cy: number,
    radiusCells: number,
    fade = 1,
    maxStop = 5,
    topHighlight = false
  ): void {
    plotSinkDisc(this, cx, cy, radiusCells, fade, maxStop, topHighlight);
  }

  public flush(ctx: CanvasRenderingContext2D, palette: PfxPalette): void {
    if (this.maxX < this.minX || this.maxY < this.minY) return;

    this.spanCounts.fill(0);
    const stamp = this.stampId;
    const sBuf = this.stampBuf;
    const cBuf = this.colorBuf;
    const rStamp = this.rowStamp;
    const rMin = this.rowMinX;
    const rMax = this.rowMaxX;

    for (let gy = this.minY; gy <= this.maxY; gy++) {
      if (rStamp[gy] !== stamp) continue;
      const rowBase = gy * PFX_GRID_W;
      let gx = rMin[gy];
      const maxRowX = rMax[gy];
      while (gx <= maxRowX) {
        const idx = rowBase + gx;
        if (sBuf[idx] !== stamp) {
          gx++;
          continue;
        }
        const c = cBuf[idx];
        let runEnd = gx + 1;
        while (runEnd <= maxRowX && sBuf[rowBase + runEnd] === stamp && cBuf[rowBase + runEnd] === c) {
          runEnd++;
        }
        const bucket = c - 1;
        const count = this.spanCounts[bucket];
        if (count < MAX_SPANS_PER_STOP) {
          this.spanX[bucket][count] = gx * PFX_CELL;
          this.spanY[bucket][count] = gy * PFX_CELL;
          this.spanW[bucket][count] = (runEnd - gx) * PFX_CELL;
          this.spanCounts[bucket] = count + 1;
        }
        gx = runEnd;
      }
    }

    for (let b = 0; b < 6; b++) {
      const count = this.spanCounts[b];
      if (count === 0) continue;
      const xs = this.spanX[b];
      const ys = this.spanY[b];
      const ws = this.spanW[b];
      ctx.fillStyle = palette.css[b];
      for (let i = 0; i < count; i++) {
        ctx.fillRect(xs[i], ys[i], ws[i], PFX_CELL);
      }
    }
  }
}

/**
 * O(1) Stamp-Cleared World-Aligned PixelFX Collision Grid (`伤害范围与特效像素对应` & `K键闪避穿过特效像素`):
 * - Uses `PAD = 320` (a multiple of 8), so `gx = Math.round(wx - (camX - 320)) = gx_screen + 320`
 *   preserves 100% bit-identical 4x4 Bayer dithering (`gx & 3`, `(gx >> 1) & 3`) and edge serration (`& 7`)
 *   relative to `PixelFXStage` while also covering +/-320 world units outside the camera viewport!
 * - Zero per-frame heap allocations (`stampId++` O(1) clear + sparse row min/max bounds).
 */
export class PfxWorldHitGrid implements PfxPlotSink {
  public static readonly PAD = 320;
  public readonly width = PFX_GRID_W + PfxWorldHitGrid.PAD * 2;
  public readonly height = PFX_GRID_H + PfxWorldHitGrid.PAD * 2;
  public originX = -PfxWorldHitGrid.PAD;
  public originY = -PfxWorldHitGrid.PAD;

  private readonly stampBuf: Uint32Array;
  private readonly rowStamp: Int32Array;
  private readonly rowMinX: Int16Array;
  private readonly rowMaxX: Int16Array;
  private stampId = 1;

  private minX: number;
  private maxX = -1;
  private minY: number;
  private maxY = -1;

  constructor() {
    this.stampBuf = new Uint32Array(this.width * this.height);
    this.rowStamp = new Int32Array(this.height);
    this.rowMinX = new Int16Array(this.height);
    this.rowMaxX = new Int16Array(this.height);
    this.minX = this.width;
    this.minY = this.height;
  }

  public begin(camX = 0, camY = 0): void {
    this.stampId = (this.stampId + 1) | 0;
    if (this.stampId >= 0x7ffffff0 || this.stampId <= 0) {
      this.stampBuf.fill(0);
      this.rowStamp.fill(0);
      this.stampId = 1;
    }
    this.originX = camX - PfxWorldHitGrid.PAD;
    this.originY = camY - PfxWorldHitGrid.PAD;
    this.minX = this.width;
    this.maxX = -1;
    this.minY = this.height;
    this.maxY = -1;
  }

  public isEmpty(): boolean {
    return this.maxX < this.minX || this.maxY < this.minY;
  }

  public plot(gx: number, gy: number, stop1to6: number): void {
    const ix = gx | 0;
    const iy = gy | 0;
    if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height || stop1to6 <= 0) return;
    const idx = iy * this.width + ix;
    if (this.stampBuf[idx] !== this.stampId) {
      this.stampBuf[idx] = this.stampId;
      if (this.rowStamp[iy] !== this.stampId) {
        this.rowStamp[iy] = this.stampId;
        this.rowMinX[iy] = ix;
        this.rowMaxX[iy] = ix;
      } else {
        if (ix < this.rowMinX[iy]) this.rowMinX[iy] = ix;
        if (ix > this.rowMaxX[iy]) this.rowMaxX[iy] = ix;
      }
      if (ix < this.minX) this.minX = ix;
      if (ix > this.maxX) this.maxX = ix;
      if (iy < this.minY) this.minY = iy;
      if (iy > this.maxY) this.maxY = iy;
    }
  }

  public plotEnergy(gx: number, gy: number, energy01: number, maxStop = 6): void {
    const ix = gx | 0;
    const iy = gy | 0;
    if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return;
    const st = quantizeBayerStop(energy01, ix, iy, maxStop);
    if (st > 0) {
      this.plot(ix, iy, st);
    }
  }

  public plotBresenhamLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    stop1to6: number,
    thicknessCells = 1,
    ditherCoverage = 1
  ): void {
    plotSinkBresenhamLine(this, x0, y0, x1, y1, stop1to6, thicknessCells, ditherCoverage);
  }

  public plotDisc(
    cx: number,
    cy: number,
    radiusCells: number,
    fade = 1,
    maxStop = 5,
    topHighlight = false
  ): void {
    plotSinkDisc(this, cx, cy, radiusCells, fade, maxStop, topHighlight);
  }

  public isWorldPointPlotted(wx: number, wy: number): boolean {
    if (this.maxX < this.minX || this.maxY < this.minY) return false;
    const gx = Math.round((wx - this.originX) * WORLD_TO_GRID);
    const gy = Math.round((wy - this.originY) * WORLD_TO_GRID);
    if (gx < this.minX || gx > this.maxX || gy < this.minY || gy > this.maxY) return false;
    if (this.rowStamp[gy] !== this.stampId) return false;
    return this.stampBuf[gy * this.width + gx] === this.stampId;
  }

  /**
   * Returns `true` if and only if >= 1 plotted PixelFX pixel overlaps `[minWX..maxWX] x [minWY..maxWY]`.
   */
  public overlapsWorldRect(minWX: number, minWY: number, maxWX: number, maxWY: number): boolean {
    if (this.maxX < this.minX || this.maxY < this.minY) return false;
    const loX = Math.min(minWX, maxWX);
    const hiX = Math.max(minWX, maxWX);
    const loY = Math.min(minWY, maxWY);
    const hiY = Math.max(minWY, maxWY);

    const x0 = Math.max(this.minX, Math.round((loX - this.originX) * WORLD_TO_GRID));
    const x1 = Math.min(this.maxX, Math.round((hiX - this.originX) * WORLD_TO_GRID));
    if (x1 < x0) return false;

    const y0 = Math.max(this.minY, Math.round((loY - this.originY) * WORLD_TO_GRID));
    const y1 = Math.min(this.maxY, Math.round((hiY - this.originY) * WORLD_TO_GRID));
    if (y1 < y0) return false;

    const stamp = this.stampId;
    const rStamp = this.rowStamp;
    const rMin = this.rowMinX;
    const rMax = this.rowMaxX;
    const sBuf = this.stampBuf;
    const w = this.width;

    for (let gy = y0; gy <= y1; gy++) {
      if (rStamp[gy] !== stamp) continue;
      const rx0 = x0 > rMin[gy] ? x0 : rMin[gy];
      const rx1 = x1 < rMax[gy] ? x1 : rMax[gy];
      if (rx1 < rx0) continue;
      const rowBase = gy * w;
      for (let gx = rx0; gx <= rx1; gx++) {
        if (sBuf[rowBase + gx] === stamp) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Exact pixel-to-pixel intersection against another `PfxWorldHitGrid` (e.g., player blade VFX pixels vs enemy projectile VFX pixels).
   */
  public overlapsOtherGrid(other: PfxWorldHitGrid): boolean {
    if (this.isEmpty() || other.isEmpty()) return false;
    const shiftX = Math.round((other.originX - this.originX) * WORLD_TO_GRID);
    const shiftY = Math.round((other.originY - this.originY) * WORLD_TO_GRID);

    const oy0 = Math.max(other.minY, this.minY - shiftY);
    const oy1 = Math.min(other.maxY, this.maxY - shiftY);
    if (oy1 < oy0) return false;

    const stampA = this.stampId;
    const stampB = other.stampId;
    const w = this.width;

    for (let ogy = oy0; ogy <= oy1; ogy++) {
      if (other.rowStamp[ogy] !== stampB) continue;
      const gy = ogy + shiftY;
      if (gy < this.minY || gy > this.maxY || this.rowStamp[gy] !== stampA) continue;

      const ox0 = Math.max(other.rowMinX[ogy], this.rowMinX[gy] - shiftX);
      const ox1 = Math.min(other.rowMaxX[ogy], this.rowMaxX[gy] - shiftX);
      if (ox1 < ox0) continue;

      const rowA = gy * w;
      const rowB = ogy * w;
      for (let ogx = ox0; ogx <= ox1; ogx++) {
        if (other.stampBuf[rowB + ogx] === stampB && this.stampBuf[rowA + ogx + shiftX] === stampA) {
          return true;
        }
      }
    }
    return false;
  }

  public countPlottedPixels(): number {
    if (this.isEmpty()) return 0;
    let total = 0;
    const stamp = this.stampId;
    const w = this.width;
    for (let gy = this.minY; gy <= this.maxY; gy++) {
      if (this.rowStamp[gy] !== stamp) continue;
      const rowBase = gy * w;
      const rx0 = this.rowMinX[gy];
      const rx1 = this.rowMaxX[gy];
      for (let gx = rx0; gx <= rx1; gx++) {
        if (this.stampBuf[rowBase + gx] === stamp) total++;
      }
    }
    return total;
  }
}

const sharedStage = new PixelFXStage();

function toSinkGX(originX: number, wx: number): number {
  return Math.round((wx - originX) * WORLD_TO_GRID);
}

function toSinkGY(originY: number, wy: number): number {
  return Math.round((wy - originY) * WORLD_TO_GRID);
}

function toGX(pfx: PixelFXBuffer, wx: number): number {
  return Math.round((wx - pfx.camX) * WORLD_TO_GRID);
}

function toGY(pfx: PixelFXBuffer, wy: number): number {
  return Math.round((wy - pfx.camY) * WORLD_TO_GRID);
}

function wrapAngleDiff(ang: number, center: number): number {
  if (!Number.isFinite(ang) || !Number.isFinite(center)) return 0;
  return Math.atan2(Math.sin(ang - center), Math.cos(ang - center));
}

// ============================================================================
// 1. PROCEDURAL PIXELFX MELEE SLASHES (`patch-gg/pixelfx` Crescent, Spin, Lance & Void)
// ============================================================================

export interface SlashDescriptor {
  x: number;
  y: number;
  facing: 1 | -1;
  style: SlashRenderStyle;
  palette: 'silver' | 'violet' | 'cyan' | 'crimson';
  elapsed: number;
  duration: number;
  radiusX: number;
  radiusY: number;
  seed: number;
}

function drawPixelStarGlint(
  stage: PfxPlotSink,
  gx: number,
  gy: number,
  armCells: number,
  fade: number
): void {
  const arm = Math.max(2, Math.round(armCells * fade));
  stage.plotBresenhamLine(gx - arm, gy, gx + arm, gy, 5, 1, fade);
  stage.plotBresenhamLine(gx, gy - arm, gx, gy + arm, 5, 1, fade);
  const dArm = Math.max(1, arm >> 1);
  stage.plotBresenhamLine(gx - dArm, gy - dArm, gx + dArm, gy + dArm, 4, 1, fade * 0.85);
  stage.plotBresenhamLine(gx - dArm, gy + dArm, gx + dArm, gy - dArm, 4, 1, fade * 0.85);
  stage.plot(gx, gy, 6);
}

function plotEccentricCrescentBand(
  stage: PfxPlotSink,
  cx: number,
  cy: number,
  rxCells: number,
  ryCells: number,
  facing: 1 | -1,
  tiltRad: number,
  flipLocalY: boolean,
  eccentricity: number,
  innerRadiusNorm: number,
  arcStart: number,
  arcEnd: number,
  fade: number,
  seed: number,
  isVoid: boolean
): void {
  const maxR = Math.max(rxCells, ryCells) + 3;
  const gridW = stage.width;
  const gridH = stage.height;
  if (cx + maxR < 0 || cx - maxR >= gridW || cy + maxR < 0 || cy - maxR >= gridH) {
    return;
  }

  const cosT = Math.cos(-tiltRad);
  const sinT = Math.sin(-tiltRad);
  const invRx = 1 / Math.max(3, rxCells);
  const invRy = 1 / Math.max(3, ryCells);
  const innerR2 = innerRadiusNorm * innerRadiusNorm;
  const arcMid = (arcStart + arcEnd) * 0.5;
  const halfSpan = Math.max(0.15, (arcEnd - arcStart) * 0.5);
  const midCos = Math.cos(arcMid);
  const midSin = Math.sin(arcMid);
  const cosHalfSpan = Math.cos(Math.min(Math.PI, halfSpan));
  const invSinHalfSpan = 1 / Math.max(0.15, Math.sin(Math.min(Math.PI * 0.5, halfSpan)));
  const flipSign = flipLocalY ? -1 : 1;

  const x0 = Math.max(0, Math.floor(cx - maxR));
  const x1 = Math.min(gridW - 1, Math.ceil(cx + maxR));
  const y0 = Math.max(0, Math.floor(cy - maxR));
  const y1 = Math.min(gridH - 1, Math.ceil(cy + maxR));

  for (let gy = y0; gy <= y1; gy++) {
    const dy = gy - cy;
    for (let gx = x0; gx <= x1; gx++) {
      const dx = (gx - cx) * facing;
      const rx = dx * cosT - dy * sinT;
      const ry = (dx * sinT + dy * cosT) * flipSign;

      const nx = rx * invRx;
      const ny = ry * invRy;
      const outerD2 = nx * nx + ny * ny;
      if (outerD2 > 1.0 || outerD2 < 0.0004) continue;

      const outerDist = Math.sqrt(outerD2);
      const invDist = 1 / outerDist;
      const ux = nx * invDist;
      const uy = ny * invDist;

      // Exact algebraic arc-span test (zero per-pixel atan2 / sin / cos)
      const dotMid = ux * midCos + uy * midSin;
      if (dotMid < cosHalfSpan) continue;

      const serration = (((gx * 7 + gy * 13 + seed) & 7) - 3.5) * 0.012;
      const ex = nx + eccentricity + serration * (1 - fade * 0.35);
      const ey = ny * 1.03;
      if (ex * ex + ey * ey < innerR2) continue;

      const innerBoundary = Math.max(0.05, innerRadiusNorm - eccentricity * ux);
      const bandWidth = Math.max(0.08, 1.0 - innerBoundary);
      const radialU = Math.max(0, Math.min(1, (outerDist - innerBoundary) / bandWidth));

      const crossMid = uy * midCos - ux * midSin;
      const headBias = Math.max(0, Math.min(1, 0.5 + 0.5 * crossMid * invSinHalfSpan));
      const tipTaper = Math.max(0.08, 4 * headBias * (1 - headBias));
      const wakeFade = (0.38 + 0.62 * headBias) * fade;

      if (isVoid) {
        if (radialU > 0.40 && radialU < 0.80 && headBias > 0.18 && fade > 0.22) {
          stage.plot(gx, gy, 6, true);
        } else {
          const rimEnergy = (1 - Math.abs(radialU - 0.6) * 2.1) * wakeFade * (0.55 + 0.45 * tipTaper);
          stage.plotEnergy(gx, gy, rimEnergy, 5);
        }
        continue;
      }

      if (radialU > 0.93 && fade > 0.32) {
        stage.plot(gx, gy, 1);
        continue;
      }

      const razorPeak = radialU >= 0.70 ? 1.0 - Math.abs(radialU - 0.83) * 3.0 : radialU * 0.92;
      const energy = Math.max(0, razorPeak) * wakeFade * (0.50 + 0.50 * tipTaper);
      stage.plotEnergy(gx, gy, energy, 6);
    }
  }
}

export function rasterizeSlashToSink(
  sink: PfxPlotSink,
  originX: number,
  originY: number,
  s: SlashDescriptor
): number {
  const rawT = Math.max(0, Math.min(0.999, s.elapsed / s.duration));
  const fade = Math.max(0, 1 - rawT * rawT);
  if (fade <= 0.04) return 0;

  const isVoid = s.style === 'dimension';
  const dir = s.facing;
  const whip = 1 - (1 - rawT) * (1 - rawT) * (1 - rawT);

  // 1. Linear Piercing Lance / Slide / Astral Ranged Slash
  if (s.style === 'thrust' || s.style === 'slide' || s.style === 'astral_wave') {
    const reachCells = Math.max(12, s.radiusX * WORLD_TO_GRID * (0.76 + whip * 0.48));
    const halfHCells = Math.max(3, s.radiusY * WORLD_TO_GRID * (0.52 - rawT * 0.22));
    const baseGX = toSinkGX(originX, s.x - dir * s.radiusX * 0.18);
    const baseGY = toSinkGY(originY, s.style === 'slide' ? s.y + 4 : s.y);
    const tipGX = Math.round(baseGX + dir * reachCells);
    const tipGY = Math.round(baseGY + (s.style === 'slide' ? -2 : 0));

    const steps = Math.max(6, Math.round(reachCells));
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const gx = Math.round(baseGX + (tipGX - baseGX) * u);
      const gy = Math.round(baseGY + (tipGY - baseGY) * u);
      const profile = Math.sin(Math.sqrt(u) * Math.PI);
      const halfThick = Math.max(1, Math.round(halfHCells * profile * (1 - u * 0.42)));
      const colFade = fade * (0.28 + 0.72 * u);

      for (let oy = -halfThick; oy <= halfThick; oy++) {
        const vNorm = 1 - Math.abs(oy) / (halfThick + 0.5);
        const energy = vNorm * colFade * (u > 0.72 ? 1.22 : 1.0);
        sink.plotEnergy(gx, gy + oy, energy, 6);
      }
    }

    for (let w = 0; w < 2; w++) {
      const wu = Math.min(0.95, 0.42 + w * 0.28 + whip * 0.22);
      const wx = Math.round(baseGX + (tipGX - baseGX) * wu);
      const wy = Math.round(baseGY + (tipGY - baseGY) * wu);
      const wingX = wx - dir * (5 + w * 3);
      const wingH = Math.round(halfHCells * (1.25 - w * 0.22));
      sink.plotBresenhamLine(wx, wy, wingX, wy - wingH, 5 - w, 1, fade * 0.9);
      sink.plotBresenhamLine(wx, wy, wingX, wy + wingH, 5 - w, 1, fade * 0.9);
    }

    if (rawT < 0.35) {
      drawPixelStarGlint(sink, tipGX, tipGY, 4, (1 - rawT / 0.35) * fade);
    }
    return fade;
  }

  // 2. 360-Degree Double-Bladed Vortex Spin (`spin`)
  if (s.style === 'spin') {
    const cx = toSinkGX(originX, s.x + dir * 4);
    const cy = toSinkGY(originY, s.y);
    const rxCells = Math.max(11, s.radiusX * WORLD_TO_GRID * (0.92 + whip * 0.18));
    const ryCells = Math.max(7, s.radiusY * WORLD_TO_GRID * (0.90 + whip * 0.16));
    const spinRot = rawT * 2.6 * dir;

    plotEccentricCrescentBand(
      sink,
      cx,
      cy,
      rxCells,
      ryCells,
      dir,
      spinRot,
      false,
      0.24,
      0.72,
      -1.35,
      1.35,
      fade,
      s.seed,
      false
    );
    plotEccentricCrescentBand(
      sink,
      cx,
      cy,
      rxCells * 0.9,
      ryCells * 0.9,
      (-dir) as 1 | -1,
      -spinRot,
      true,
      0.24,
      0.74,
      -1.25,
      1.25,
      fade * 0.88,
      s.seed + 31,
      false
    );
    return fade;
  }

  // 3. Sweeping Katana Crescent Slashes (`arc_down`, `arc_up`, `uppercut`, `plunge`, `wide_cleave`, `counter`, `dimension`)
  const scaleBoost = s.style === 'counter' ? 1.24 : s.style === 'wide_cleave' ? 1.12 : 1.0;
  const rxCells = Math.max(10, s.radiusX * WORLD_TO_GRID * scaleBoost * (0.90 + whip * 0.2));
  const ryCells = Math.max(8, s.radiusY * WORLD_TO_GRID * scaleBoost * (0.92 + whip * 0.16));
  const cx = toSinkGX(originX, s.x + dir * s.radiusX * 0.14);
  const cy = toSinkGY(originY, s.y);

  let tiltRad = 0;
  let flipLocalY = false;
  if (s.style === 'arc_down') {
    tiltRad = (-0.28 + whip * 0.56) * dir;
  } else if (s.style === 'arc_up') {
    tiltRad = (0.30 - whip * 0.58) * dir;
    flipLocalY = true;
  } else if (s.style === 'uppercut') {
    tiltRad = (-0.78 - whip * 0.35) * dir;
    flipLocalY = true;
  } else if (s.style === 'plunge') {
    tiltRad = (0.55 + whip * 0.42) * dir;
  } else if (s.style === 'counter') {
    tiltRad = (-0.08 + whip * 0.18) * dir;
  } else if (s.style === 'dimension') {
    tiltRad = (0.28 - whip * 0.56) * dir;
    flipLocalY = true;
  } else {
    tiltRad = (-0.18 + whip * 0.36) * dir;
  }

  const tailShrink = rawT * 0.95;
  const arcStart = -1.42 + tailShrink;
  const arcEnd = -0.35 + whip * 1.82;

  plotEccentricCrescentBand(
    sink,
    cx,
    cy,
    rxCells,
    ryCells,
    dir,
    tiltRad,
    flipLocalY,
    s.style === 'counter' || s.style === 'dimension' ? 0.31 : 0.27,
    s.style === 'counter' || s.style === 'dimension' ? 0.67 : 0.72,
    arcStart,
    arcEnd,
    fade,
    s.seed,
    isVoid
  );

  if (s.style === 'dimension') {
    plotEccentricCrescentBand(
      sink,
      cx - dir * 3,
      cy + 1,
      rxCells * 0.82,
      ryCells * 0.60,
      dir,
      -tiltRad * 1.15,
      !flipLocalY,
      0.26,
      0.75,
      -1.18 + tailShrink * 0.82,
      1.18,
      fade * 0.86,
      s.seed + 53,
      true
    );

    let rx = cx - dir * Math.round(rxCells * 0.48);
    let ry = cy + Math.round(ryCells * 0.24);
    for (let seg = 0; seg < 5; seg++) {
      const nx = rx + dir * Math.round(rxCells * 0.28);
      const ny = ry - Math.round(ryCells * 0.11) + (((s.seed + seg * 23) % 9) - 4);
      sink.plotBresenhamLine(rx, ry, nx, ny, seg % 2 === 0 ? 6 : 4, 1, fade);
      rx = nx;
      ry = ny;
    }
  } else if (s.style === 'counter') {
    plotEccentricCrescentBand(
      sink,
      cx - dir * 4,
      cy,
      rxCells * 0.78,
      ryCells * 0.62,
      dir,
      -tiltRad * 1.4,
      !flipLocalY,
      0.28,
      0.76,
      -1.15 + tailShrink * 0.8,
      1.15,
      fade * 0.82,
      s.seed + 77,
      false
    );

    let lx = cx - dir * Math.round(rxCells * 0.55);
    let ly = cy - 2;
    for (let seg = 0; seg < 6; seg++) {
      const nx = lx + dir * Math.round(rxCells * 0.26);
      const ny = cy + (((s.seed + seg * 19) % 13) - 6);
      sink.plotBresenhamLine(lx, ly, nx, ny, seg % 2 === 0 ? 6 : 4, 1, fade);
      lx = nx;
      ly = ny;
    }
  }

  if (!isVoid && rawT < 0.28) {
    const glintX = Math.round(cx + dir * rxCells * 0.92);
    const glintY = Math.round(cy + (flipLocalY ? -ryCells * 0.22 : ryCells * 0.22));
    drawPixelStarGlint(sink, glintX, glintY, s.style === 'counter' ? 5 : 4, fade);
  }

  return fade;
}

export function renderPfxSlash(pfx: PixelFXBuffer, s: SlashDescriptor): void {
  const isVoid = s.style === 'dimension';
  const pal: PfxPalette = isVoid
    ? PFX_PALETTES.void
    : s.style === 'counter' && s.palette === 'crimson'
      ? PFX_PALETTES.crimson
      : PFX_PALETTES[s.palette];

  sharedStage.begin();
  const fade = rasterizeSlashToSink(sharedStage, pfx.camX, pfx.camY, s);
  if (fade <= 0.04) return;
  sharedStage.flush(pfx.ctx, pal);

  if (!isVoid) {
    const dir = s.facing;
    const isSpin = s.style === 'spin';
    const isLinear = s.style === 'thrust' || s.style === 'slide' || s.style === 'astral_wave';
    pfx.addRadialLight(
      isSpin ? s.x : s.x + dir * s.radiusX * (isLinear ? 0.45 : 0.42),
      s.y,
      isSpin ? 30 : isLinear ? 28 : s.style === 'counter' ? 40 : 26,
      Math.round(pal.light.r * fade),
      Math.round(pal.light.g * fade),
      Math.round(pal.light.b * fade)
    );
  }
}

// ============================================================================
// 2. REAL-TIME SKELETAL WEAPON SWING SMEAR (`renderPfxWeaponSmear`)
// ============================================================================

export function rasterizeWeaponSmearToSink(
  sink: PfxPlotSink,
  originX: number,
  originY: number,
  gripWX: number,
  gripWY: number,
  prevAngle: number,
  currAngle: number,
  bladeLenWorld: number,
  intensity: number,
  isVoid: boolean
): boolean {
  const delta = wrapAngleDiff(currAngle, prevAngle);
  if (intensity <= 0.06 || Math.abs(delta) < 0.05) return false;

  const gx0 = toSinkGX(originX, gripWX);
  const gy0 = toSinkGY(originY, gripWY);
  const outerR = Math.max(6, bladeLenWorld * WORLD_TO_GRID * 1.04);
  const innerR = outerR * 0.30;
  const gridW = sink.width;
  const gridH = sink.height;

  if (gx0 + outerR < 0 || gx0 - outerR >= gridW || gy0 + outerR < 0 || gy0 - outerR >= gridH) {
    return false;
  }

  const span = Math.min(Math.PI * 0.92, Math.max(0.18, Math.abs(delta) * 1.35));
  const dirSign = delta >= 0 ? 1 : -1;
  const midAng = currAngle - dirSign * span * 0.5;
  const halfSpan = span * 0.5;
  const midCos = Math.cos(midAng);
  const midSin = Math.sin(midAng);
  const cosHalfSpan = Math.cos(halfSpan);
  const invSinHalfSpan = 1 / Math.max(0.15, Math.sin(Math.min(Math.PI * 0.5, halfSpan)));
  const innerR2 = innerR * innerR;
  const outerR2 = outerR * outerR;
  const invBandR = 1 / Math.max(1, outerR - innerR);
  const gain = Math.min(1, intensity * 1.1);

  const x0 = Math.max(0, Math.floor(gx0 - outerR));
  const x1 = Math.min(gridW - 1, Math.ceil(gx0 + outerR));
  const y0 = Math.max(0, Math.floor(gy0 - outerR));
  const y1 = Math.min(gridH - 1, Math.ceil(gy0 + outerR));

  for (let gy = y0; gy <= y1; gy++) {
    const dy = gy - gy0;
    for (let gx = x0; gx <= x1; gx++) {
      const dx = gx - gx0;
      const d2 = dx * dx + dy * dy;
      if (d2 < innerR2 || d2 > outerR2) continue;

      const r = Math.sqrt(d2);
      const invR = 1 / r;
      const ux = dx * invR;
      const uy = dy * invR;
      if (ux * midCos + uy * midSin < cosHalfSpan) continue;

      const rNorm = (r - innerR) * invBandR;
      const sinRel = (uy * midCos - ux * midSin) * dirSign;
      const uLead = Math.max(0, Math.min(1, 0.5 + 0.5 * sinRel * invSinHalfSpan));

      const tipBoost = rNorm > 0.68 ? 1.16 : 0.55 + rNorm * 0.65;
      const energy = uLead * Math.sqrt(uLead) * tipBoost * gain;
      sink.plotEnergy(gx, gy, energy, isVoid ? 5 : 6);
    }
  }
  return true;
}

export function renderPfxWeaponSmear(
  pfx: PixelFXBuffer,
  gripWX: number,
  gripWY: number,
  prevAngle: number,
  currAngle: number,
  bladeLenWorld: number,
  intensity: number,
  paletteId: PfxPaletteId
): void {
  const pal = PFX_PALETTES[paletteId];
  sharedStage.begin();
  const drawn = rasterizeWeaponSmearToSink(
    sharedStage,
    pfx.camX,
    pfx.camY,
    gripWX,
    gripWY,
    prevAngle,
    currAngle,
    bladeLenWorld,
    intensity,
    paletteId === 'void'
  );
  if (!drawn) return;
  sharedStage.flush(pfx.ctx, pal);
}

// ============================================================================
// 3. PROCEDURAL PIXELFX PROJECTILES & RANGED SWORD-WAVES (`renderPfxProjectiles`)
// ============================================================================

export function rasterizeProjectileToSink(
  sink: PfxPlotSink,
  originX: number,
  originY: number,
  p: ProjectileEntity,
  projIndex: number,
  time: number
): boolean {
  const angle = Math.atan2(p.vy, p.vx);
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const cx = toSinkGX(originX, p.x);
  const cy = toSinkGY(originY, p.y);
  const gridW = sink.width;
  const gridH = sink.height;

  if (p.isSwordWave) {
    const rx = Math.max(6, p.radius * WORLD_TO_GRID * 1.45);
    const ry = Math.max(10, p.radius * WORLD_TO_GRID * 2.45);
    const bound = Math.ceil(Math.max(rx, ry)) + 4;
    if (cx + bound < 0 || cx - bound >= gridW || cy + bound < 0 || cy - bound >= gridH) {
      return false;
    }

    const x0 = Math.max(0, cx - bound);
    const x1 = Math.min(gridW - 1, cx + bound);
    const y0 = Math.max(0, cy - bound);
    const y1 = Math.min(gridH - 1, cy + bound);
    const flickerBase = Math.sin(time * 24 + p.id) * 0.7;

    for (let gy = y0; gy <= y1; gy++) {
      const dy = gy - cy;
      for (let gx = x0; gx <= x1; gx++) {
        const dx = gx - cx;
        const lx = dx * cosA + dy * sinA;
        const ly = -dx * sinA + dy * cosA;

        const ny = ly / ry;
        const ny2 = ny * ny;
        if (ny2 > 1.0) continue;

        const frontEdge = (1 - ny2) * rx * 0.65;
        const thickness = (1 - ny2 * 0.82) * rx * 0.78;
        const backEdge = frontEdge - thickness + flickerBase;

        if (lx > frontEdge || lx < backEdge) continue;
        const u = (lx - backEdge) / Math.max(1, frontEdge - backEdge);
        const hornFade = 1 - ny2 * ny2 * 0.45;
        if (u > 0.90) {
          sink.plot(gx, gy, 1);
        } else {
          sink.plotEnergy(gx, gy, Math.sqrt(Math.max(0, u)) * hornFade * 1.12, 6);
        }
      }
    }

    for (let tIdx = -1; tIdx <= 1; tIdx++) {
      const offY = tIdx * ry * 0.52;
      const sx = Math.round(cx - cosA * 2 - sinA * offY);
      const sy = Math.round(cy - sinA * 2 + cosA * offY);
      const ex = Math.round(sx - cosA * (7 + ((projIndex + tIdx + 2) % 3) * 2));
      const ey = Math.round(sy - sinA * (7 + ((projIndex + tIdx + 2) % 3) * 2));
      sink.plotBresenhamLine(sx, sy, ex, ey, 3, 1, 0.65);
    }
    return true;
  }

  const radCells = Math.max(2, Math.round(p.radius * WORLD_TO_GRID * 0.95));
  const tailLen = radCells * 3.2;
  const bound = Math.ceil(tailLen + radCells + 4);
  if (cx + bound < 0 || cx - bound >= gridW || cy + bound < 0 || cy - bound >= gridH) {
    return false;
  }

  const tailX = cx - cosA * tailLen;
  const tailY = cy - sinA * tailLen;

  sink.plotBresenhamLine(cx, cy, tailX, tailY, 3, 1, 0.72);
  sink.plotBresenhamLine(
    cx,
    cy,
    cx - cosA * tailLen * 0.55,
    cy - sinA * tailLen * 0.55,
    4,
    1,
    0.92
  );

  if (p.fromPlayer) {
    const spin = time * 18 + p.id * 1.7;
    for (let b = 0; b < 4; b++) {
      const ba = spin + b * Math.PI * 0.5;
      const bx = cx + Math.cos(ba) * (radCells + 2);
      const by = cy + Math.sin(ba) * (radCells + 2);
      sink.plotBresenhamLine(cx, cy, bx, by, 5, 1, 1);
    }
    sink.plotDisc(cx, cy, Math.max(1.5, radCells * 0.75), 1, 6, false);
  } else {
    const tipX = cx + cosA * (radCells + 2);
    const tipY = cy + sinA * (radCells + 2);
    const wingLX = cx - cosA * radCells - sinA * (radCells * 0.8);
    const wingLY = cy - sinA * radCells + cosA * (radCells * 0.8);
    const wingRX = cx - cosA * radCells + sinA * (radCells * 0.8);
    const wingRY = cy - sinA * radCells - cosA * (radCells * 0.8);
    sink.plotDisc(cx, cy, Math.max(1.5, radCells * 0.82), 0.95, 5, false);
    sink.plotBresenhamLine(wingLX, wingLY, tipX, tipY, 5, 1, 1);
    sink.plotBresenhamLine(wingRX, wingRY, tipX, tipY, 5, 1, 1);
    sink.plot(Math.round(tipX), Math.round(tipY), 6);
  }
  return true;
}

export function renderPfxProjectiles(
  pfx: PixelFXBuffer,
  projectiles: ProjectileEntity[],
  time: number
): void {
  for (let i = 0; i < projectiles.length; i++) {
    const p = projectiles[i];
    const palId: PfxPaletteId =
      p.color === 'crimson' ? 'crimson' : p.color === 'cyan' ? 'cyan' : 'violet';
    const pal = PFX_PALETTES[palId];

    sharedStage.begin();
    if (!rasterizeProjectileToSink(sharedStage, pfx.camX, pfx.camY, p, i, time)) {
      continue;
    }
    sharedStage.flush(pfx.ctx, pal);
    pfx.addRadialLight(p.x, p.y, p.isSwordWave ? 22 : 15, pal.light.r, pal.light.g, pal.light.b);
  }
}

// ============================================================================
// 4. PROCEDURAL PIXELFX SHOCKWAVE RINGS, SPATIAL RIFTS & ASTRAL BOLTS
// ============================================================================

export interface RingDescriptor {
  x: number;
  y: number;
  maxRadius: number;
  elapsed: number;
  duration: number;
  r: number;
  g: number;
  b: number;
  isDimensionLines: boolean;
  seed: number;
}

export interface BoltDescriptor {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  palette: 'cyan' | 'violet' | 'crimson' | 'gold';
  elapsed: number;
  duration: number;
  thicknessCells: number;
  seed: number;
}

function pickPaletteByRGB(r: number, g: number, b: number): PfxPalette {
  if (r > 210 && g > 170 && b < 150) return PFX_PALETTES.gold;
  if (r > g + 55 && r > b + 25) return PFX_PALETTES.crimson;
  if (b > r + 40 && g > r + 25) return PFX_PALETTES.cyan;
  if (r > 150 && b > 190 && g < 150) return PFX_PALETTES.violet;
  return PFX_PALETTES.silver;
}

export function rasterizeRingToSink(
  sink: PfxPlotSink,
  originX: number,
  originY: number,
  ring: RingDescriptor,
  randFn: (seed: number) => () => number
): number {
  const t = Math.max(0, Math.min(0.999, ring.elapsed / ring.duration));

  if (ring.isDimensionLines) {
    const rand = randFn(ring.seed);
    const qt = Math.min(0.999, Math.floor(t * 8) / 8);
    const fade = 1 - qt;
    if (fade <= 0.04) return 0;

    for (let l = 0; l < 10; l++) {
      const cx = toSinkGX(originX, ring.x + (rand() - 0.5) * 188);
      const cy = toSinkGY(originY, ring.y - 24 + (rand() - 0.5) * 84);
      const ang = (rand() - 0.5) * Math.PI * 1.55;
      const lenCells = (50 + rand() * 72) * WORLD_TO_GRID * Math.min(1, (qt + 0.12) * 3.2);
      const dx = Math.cos(ang) * lenCells;
      const dy = Math.sin(ang) * lenCells;

      sink.plotBresenhamLine(
        cx - dx,
        cy - dy,
        cx + dx,
        cy + dy,
        fade > 0.45 ? 4 : 3,
        fade > 0.45 ? 2 : 1,
        fade
      );
      if (fade > 0.2) {
        sink.plotBresenhamLine(cx - dx * 0.88, cy - dy * 0.88, cx + dx * 0.88, cy + dy * 0.88, 6, 1, 1);
      }
    }
    return fade;
  }

  const ease = 1 - (1 - t) * (1 - t);
  const rx = Math.max(4, ring.maxRadius * ease * WORLD_TO_GRID);
  const ry = Math.max(3, rx * 0.52);
  const fade = 1 - t;
  if (fade <= 0.04) return 0;

  const cx = toSinkGX(originX, ring.x);
  const cy = toSinkGY(originY, ring.y);
  const gridW = sink.width;
  const gridH = sink.height;

  if (cx + rx + 6 < 0 || cx - rx - 6 >= gridW || cy + ry + 6 < 0 || cy - ry - 6 >= gridH) {
    return 0;
  }

  // Integer-pixel stepped shockwave ellipse + 8 outward pixel impact ticks
  const steps = Math.max(24, Math.min(96, Math.round(rx * 2.6)));
  const bandThick = fade > 0.55 ? 2 : 1;
  for (let s = 0; s < steps; s++) {
    const a = (s / steps) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const px = Math.round(cx + ca * rx);
    const py = Math.round(cy + sa * ry);
    sink.plotEnergy(px, py, fade * 1.15, 6);
    if (bandThick > 1) {
      sink.plotEnergy(Math.round(cx + ca * (rx - 1)), Math.round(cy + sa * (ry - 1)), fade * 0.78, 4);
    }
  }

  for (let k = 0; k < 8; k++) {
    const ka = (k / 8) * Math.PI * 2 + ring.seed * 0.1;
    const x0 = cx + Math.cos(ka) * (rx * 0.86);
    const y0 = cy + Math.sin(ka) * (ry * 0.86);
    const x1 = cx + Math.cos(ka) * (rx + 3 * fade);
    const y1 = cy + Math.sin(ka) * (ry + 2 * fade);
    sink.plotBresenhamLine(x0, y0, x1, y1, 5, 1, fade * 0.9);
  }
  return fade;
}

export function renderPfxRing(
  pfx: PixelFXBuffer,
  ring: RingDescriptor,
  randFn: (seed: number) => () => number
): void {
  sharedStage.begin();
  const fade = rasterizeRingToSink(sharedStage, pfx.camX, pfx.camY, ring, randFn);
  if (fade <= 0.04) return;

  if (ring.isDimensionLines) {
    sharedStage.flush(pfx.ctx, PFX_PALETTES.void);
    return;
  }

  const pal = pickPaletteByRGB(ring.r, ring.g, ring.b);
  sharedStage.flush(pfx.ctx, pal);
  const t = Math.max(0, Math.min(0.999, ring.elapsed / ring.duration));
  const ease = 1 - (1 - t) * (1 - t);
  pfx.addRadialLight(
    ring.x,
    ring.y,
    ring.maxRadius * ease * 0.72,
    Math.round(pal.light.r * fade * 0.85),
    Math.round(pal.light.g * fade * 0.85),
    Math.round(pal.light.b * fade * 0.85)
  );
}

export function rasterizeBoltToSink(
  sink: PfxPlotSink,
  originX: number,
  originY: number,
  bolt: BoltDescriptor
): number {
  const t = Math.max(0, Math.min(0.999, bolt.elapsed / bolt.duration));
  const fade = 1 - t * t;
  if (fade <= 0.05) return 0;

  const gx0 = toSinkGX(originX, bolt.x0);
  const gy0 = toSinkGY(originY, bolt.y0);
  const gx1 = toSinkGX(originX, bolt.x1);
  const gy1 = toSinkGY(originY, bolt.y1);

  const dx = gx1 - gx0;
  const dy = gy1 - gy0;
  const len = Math.hypot(dx, dy);
  if (len < 1) {
    sink.plot(gx0, gy0, 6);
    return fade;
  }

  const nx = -dy / len;
  const ny = dx / len;
  const segments = Math.max(3, Math.min(8, Math.round(len / 18)));
  const thick = Math.max(1, bolt.thicknessCells);
  let prevX = gx0;
  let prevY = gy0;

  for (let s = 1; s <= segments; s++) {
    const u = s / segments;
    let curX = gx0 + dx * u;
    let curY = gy0 + dy * u;
    if (s < segments) {
      const hash = (((bolt.seed + s * 37) * 1103515245) >>> 16) & 15;
      const jag = ((hash - 7.5) / 7.5) * Math.min(7, len * 0.09);
      curX += nx * jag;
      curY += ny * jag;
    }
    if (thick >= 2) {
      sink.plotBresenhamLine(prevX, prevY, curX, curY, 3, thick, fade * 0.85);
    }
    sink.plotBresenhamLine(prevX, prevY, curX, curY, fade > 0.45 ? 6 : 5, 1, fade);
    prevX = curX;
    prevY = curY;
  }

  if (fade > 0.35) {
    drawPixelStarGlint(sink, gx1, gy1, 3, fade);
  }
  return fade;
}

export function renderPfxBolt(pfx: PixelFXBuffer, bolt: BoltDescriptor): void {
  sharedStage.begin();
  const fade = rasterizeBoltToSink(sharedStage, pfx.camX, pfx.camY, bolt);
  if (fade <= 0.05) return;
  const pal = PFX_PALETTES[bolt.palette];
  sharedStage.flush(pfx.ctx, pal);
  const mx = (bolt.x0 + bolt.x1) * 0.5;
  const my = (bolt.y0 + bolt.y1) * 0.5;
  pfx.addRadialLight(
    mx,
    my,
    Math.min(48, Math.max(14, Math.hypot(bolt.x1 - bolt.x0, bolt.y1 - bolt.y0) * 0.35)),
    Math.round(pal.light.r * fade),
    Math.round(pal.light.g * fade),
    Math.round(pal.light.b * fade)
  );
}

// ============================================================================
// 5. PROCEDURAL PIXELFX 120HZ SIMULATED PARTICLES (`renderPfxParticles`)
// ============================================================================

export interface ParticleDescriptor {
  active: boolean;
  kind: 'spark' | 'smoke' | 'petal' | 'ember';
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  life: number;
  maxLife: number;
  size: number;
  r: number;
  g: number;
  b: number;
  lightR: number;
  lightG: number;
  lightB: number;
}

const PARTICLE_PALETTE_KEYS: readonly PfxPaletteId[] = [
  'silver',
  'cyan',
  'crimson',
  'violet',
  'gold',
  'smoke',
];

const MAX_BUCKETED_PARTICLES = 1024;
const PARTICLE_BUCKETS = Array.from({ length: 6 }, () => new Int16Array(MAX_BUCKETED_PARTICLES));
const PARTICLE_BUCKET_COUNTS = new Int32Array(6);

function classifyParticlePaletteIndex(p: ParticleDescriptor): number {
  if (p.kind === 'smoke') {
    if (p.r > p.b + 45) return 2; // crimson
    if (p.b > p.r + 35 && p.g > 180) return 1; // cyan
    if (p.r > 150 && p.b > 190 && p.g < 150) return 3; // violet
    return 5; // smoke
  }
  if (p.r > 215 && p.g > 175 && p.b < 155) return 4; // gold
  if (p.r > p.g + 50 && p.r > p.b + 20) return 2; // crimson
  if (p.b > p.r + 30 && p.g > 195) return 1; // cyan
  if (p.r > 165 && p.b > 205 && p.g < 165) return 3; // violet
  return 0; // silver
}

export function renderPfxParticles(
  pfx: PixelFXBuffer,
  particles: readonly ParticleDescriptor[],
  canAddLight: (index: number) => boolean
): void {
  PARTICLE_BUCKET_COUNTS.fill(0);

  // Single O(N) pass to cull offscreen/inactive particles, bucket by palette, and emit lights
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (!p.active) continue;
    const fade = 1 - p.life / p.maxLife;
    if (fade <= 0.04) continue;

    const gx = toGX(pfx, p.x);
    const gy = toGY(pfx, p.y);
    if (gx < -16 || gx >= PFX_GRID_W + 16 || gy < -16 || gy >= PFX_GRID_H + 16) continue;

    const bIdx = classifyParticlePaletteIndex(p);
    const cnt = PARTICLE_BUCKET_COUNTS[bIdx];
    if (cnt < MAX_BUCKETED_PARTICLES) {
      PARTICLE_BUCKETS[bIdx][cnt] = i;
      PARTICLE_BUCKET_COUNTS[bIdx] = cnt + 1;
    }

    if (p.kind !== 'smoke' && canAddLight(i)) {
      pfx.addRadialLight(
        p.x,
        p.y,
        5.4,
        (p.lightR * fade * 1.2) | 0,
        (p.lightG * fade * 1.2) | 0,
        (p.lightB * fade * 1.2) | 0
      );
    }
  }

  for (let pass = 0; pass < 6; pass++) {
    const count = PARTICLE_BUCKET_COUNTS[pass];
    if (count === 0) continue;

    const bucket = PARTICLE_BUCKETS[pass];
    sharedStage.begin();

    for (let k = 0; k < count; k++) {
      const p = particles[bucket[k]];
      const t = p.life / p.maxLife;
      const fade = 1 - t;
      const gx = toGX(pfx, p.x);
      const gy = toGY(pfx, p.y);

      if (p.kind === 'spark') {
        const tailGX = toGX(pfx, p.x - (p.x - p.prevX) * 2.5);
        const tailGY = toGY(pfx, p.y - (p.y - p.prevY) * 2.5);
        sharedStage.plotBresenhamLine(tailGX, tailGY, gx, gy, fade > 0.45 ? 4 : 3, 1, fade);
        if (fade > 0.22) {
          sharedStage.plot(gx, gy, 6);
          if (p.size > 1) {
            sharedStage.plot(gx + 1, gy, 5);
            sharedStage.plot(gx, gy + 1, 5);
          }
        }
      } else if (p.kind === 'smoke') {
        const radCells = Math.max(2, (p.size + t * 2.2) * WORLD_TO_GRID * 0.72);
        sharedStage.plotDisc(gx, gy, radCells, fade * 0.78, 4, true);
      } else if (p.kind === 'petal') {
        const flutter = Math.round(Math.sin(p.life * 10 + p.x * 0.25));
        sharedStage.plotEnergy(gx, gy, fade * 1.15, 5);
        sharedStage.plotEnergy(gx + 1, gy + flutter, fade * 0.95, 4);
        sharedStage.plotEnergy(gx - 1, gy - flutter, fade * 0.85, 3);
        if (fade > 0.4) {
          sharedStage.plot(gx, gy, 6);
        }
      } else {
        // Pixel ember
        sharedStage.plotEnergy(gx, gy, Math.min(1, fade * 1.35), 6);
        if (p.size >= 2) {
          sharedStage.plotEnergy(gx + 1, gy, fade * 0.9, 4);
          sharedStage.plotEnergy(gx, gy + 1, fade * 0.9, 4);
        }
      }
    }

    sharedStage.flush(pfx.ctx, PFX_PALETTES[PARTICLE_PALETTE_KEYS[pass]]);
  }
}

// ============================================================================
// 6. ARCANE MAGIC CIRCLES, LOCKDOWN SEALS, TORCH FLAMES, HALOS & AFTERIMAGES
// ============================================================================

/**
 * `patch-gg/pixelfx` `arcane/magic-circle`:
 * Concentric pixel rune rings, rotating inscribed hexagram/diamond geometry, and pulsing glyph nodes.
 */
export function renderPfxMagicCircle(
  pfx: PixelFXBuffer,
  wx: number,
  wy: number,
  rxWorld: number,
  ryWorld: number,
  time: number,
  paletteId: PfxPaletteId,
  intensity = 0.9
): void {
  const cx = toGX(pfx, wx);
  const cy = toGY(pfx, wy);
  const rx = Math.max(4, rxWorld * WORLD_TO_GRID);
  const ry = Math.max(2, ryWorld * WORLD_TO_GRID);
  const pad = Math.ceil(Math.max(rx, ry)) + 3;
  if (cx + pad < 0 || cx - pad >= PFX_GRID_W || cy + pad < 0 || cy - pad >= PFX_GRID_H) return;

  const pal = PFX_PALETTES[paletteId];
  const pulse = 0.78 + 0.22 * Math.sin(time * 5.2 + wx * 0.05);
  const fade = Math.min(1, intensity * pulse);

  sharedStage.begin();

  const steps = Math.max(20, Math.round(Math.max(rx, ry) * 2.8));
  for (let s = 0; s < steps; s++) {
    const a = (s / steps) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    sharedStage.plotEnergy(Math.round(cx + ca * rx), Math.round(cy + sa * ry), fade * 0.95, 5);
    if (s % 2 === 0) {
      sharedStage.plotEnergy(
        Math.round(cx + ca * rx * 0.68),
        Math.round(cy + sa * ry * 0.68),
        fade * 0.78,
        4
      );
    }
  }

  const rot = time * 1.45;
  for (let tri = 0; tri < 2; tri++) {
    const base = rot + tri * (Math.PI / 3);
    for (let v = 0; v < 3; v++) {
      const a0 = base + v * ((Math.PI * 2) / 3);
      const a1 = base + ((v + 1) % 3) * ((Math.PI * 2) / 3);
      const x0 = cx + Math.cos(a0) * rx * 0.92;
      const y0 = cy + Math.sin(a0) * ry * 0.92;
      const x1 = cx + Math.cos(a1) * rx * 0.92;
      const y1 = cy + Math.sin(a1) * ry * 0.92;
      sharedStage.plotBresenhamLine(x0, y0, x1, y1, 3, 1, fade * 0.72);
      sharedStage.plot(Math.round(x0), Math.round(y0), 6);
    }
  }

  sharedStage.flush(pfx.ctx, pal);
}

/**
 * `patch-gg/pixelfx` Boss Eclipse Crown / Mandala Halo (replaces static moon textures behind bosses).
 */
export function renderPfxBossHalo(
  pfx: PixelFXBuffer,
  wx: number,
  wy: number,
  radiusWorld: number,
  time: number,
  paletteId: PfxPaletteId,
  enraged: boolean
): void {
  const cx = toGX(pfx, wx);
  const cy = toGY(pfx, wy);
  const r = Math.max(8, radiusWorld * WORLD_TO_GRID * (enraged ? 1.15 : 1.0));
  if (cx + r + 5 < 0 || cx - r - 5 >= PFX_GRID_W || cy + r + 5 < 0 || cy - r - 5 >= PFX_GRID_H) return;

  sharedStage.begin();

  plotEccentricCrescentBand(
    sharedStage,
    cx,
    cy,
    r,
    r,
    1,
    Math.PI * 0.5 + Math.sin(time * 1.6) * 0.14,
    false,
    0.22,
    0.76,
    -2.35,
    2.35,
    enraged ? 0.92 : 0.72,
    13,
    false
  );

  const spikeCount = enraged ? 8 : 6;
  for (let k = 0; k < spikeCount; k++) {
    const a = time * 0.9 + (k / spikeCount) * Math.PI * 2;
    const x0 = cx + Math.cos(a) * (r * 0.95);
    const y0 = cy + Math.sin(a) * (r * 0.95);
    const x1 = cx + Math.cos(a) * (r + (k % 2 === 0 ? 3 : 2));
    const y1 = cy + Math.sin(a) * (r + (k % 2 === 0 ? 3 : 2));
    sharedStage.plotBresenhamLine(x0, y0, x1, y1, k % 2 === 0 ? 5 : 3, 1, 0.78);
  }

  sharedStage.flush(pfx.ctx, PFX_PALETTES[paletteId]);
}

/**
 * `patch-gg/pixelfx` Enemy KO Soul Burst & Dissolve Ring (replaces `atlas.arcaneSigil` on KO).
 */
export function renderPfxEnemyKO(
  pfx: PixelFXBuffer,
  wx: number,
  wy: number,
  cov01: number,
  seed: number
): void {
  if (cov01 <= 0.04) return;
  const cx = toGX(pfx, wx);
  const cy = toGY(pfx, wy);
  const progress = 1 - cov01;
  const rad = (8 + progress * 22) * WORLD_TO_GRID;
  if (cx + rad + 6 < 0 || cx - rad - 6 >= PFX_GRID_W || cy + rad + 6 < 0 || cy - rad - 6 >= PFX_GRID_H) {
    return;
  }

  sharedStage.begin();
  sharedStage.plotDisc(cx, cy, Math.max(2, (1 - progress) * 7), cov01, 6, false);

  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + seed * 0.37 + progress * 1.4;
    const r0 = rad * 0.45;
    const r1 = rad * (0.78 + ((k * 7) % 3) * 0.14);
    sharedStage.plotBresenhamLine(
      cx + Math.cos(a) * r0,
      cy + Math.sin(a) * r0 - progress * 4,
      cx + Math.cos(a) * r1,
      cy + Math.sin(a) * r1 - progress * 7,
      k % 2 === 0 ? 5 : 4,
      1,
      cov01
    );
  }

  sharedStage.flush(pfx.ctx, PFX_PALETTES.crimson);
  pfx.addRadialLight(wx, wy, 24, (92 * cov01) | 0, (28 * cov01) | 0, (62 * cov01) | 0);
}

/**
 * `patch-gg/pixelfx` Enemy Warp-In Pillar (`EnemyAIState.Spawn`).
 */
export function renderPfxEnemySpawn(
  pfx: PixelFXBuffer,
  wx: number,
  wy: number,
  cov01: number,
  time: number
): void {
  const cx = toGX(pfx, wx);
  const baseY = toGY(pfx, wy);
  const hCells = Math.round(38 * WORLD_TO_GRID);
  const halfW = Math.max(2, Math.round((1 - cov01 * 0.45) * 10 * WORLD_TO_GRID * 0.5));
  if (cx + 14 < 0 || cx - 14 >= PFX_GRID_W || baseY < 0 || baseY - hCells >= PFX_GRID_H) return;

  sharedStage.begin();
  for (let dy = 0; dy < hCells; dy++) {
    const gy = baseY - dy;
    const vNorm = 1 - dy / hCells;
    for (let ox = -halfW; ox <= halfW; ox++) {
      const hNorm = 1 - Math.abs(ox) / (halfW + 0.5);
      const wave = 0.8 + 0.2 * Math.sin(time * 22 - dy * 0.4);
      sharedStage.plotEnergy(cx + ox, gy, hNorm * (0.45 + 0.55 * vNorm) * cov01 * wave, 6);
    }
  }
  sharedStage.flush(pfx.ctx, PFX_PALETTES.violet);
  pfx.addRadialLight(wx, wy - 18, 22, 58, 26, 98);
}

/**
 * `patch-gg/pixelfx` Procedural Torch / Candelabra Soul-Flame (`fire/torch-flame`).
 */
export function renderPfxTorchFlame(
  pfx: PixelFXBuffer,
  wx: number,
  wy: number,
  time: number,
  seed: number,
  color: 'amber' | 'crimson' | 'cyan' | 'violet'
): void {
  const cx = toGX(pfx, wx);
  const cy = toGY(pfx, wy);
  if (cx < -6 || cx >= PFX_GRID_W + 6 || cy < -10 || cy >= PFX_GRID_H + 6) return;

  const pal: PfxPalette =
    color === 'crimson'
      ? PFX_PALETTES.crimson
      : color === 'cyan'
        ? PFX_PALETTES.cyan
        : color === 'violet'
          ? PFX_PALETTES.violet
          : PFX_PALETTES.gold;

  sharedStage.begin();

  const hCells = 6;
  for (let row = 0; row < hCells; row++) {
    const u = row / (hCells - 1);
    const sway = Math.round(Math.sin(time * 13 + seed * 1.9 - u * 3.4) * (u * 1.1));
    const halfW = Math.max(0, Math.round((1 - u * 0.85) * 1.8));
    const gy = cy - row;
    for (let ox = -halfW; ox <= halfW; ox++) {
      const core = 1 - Math.abs(ox) / (halfW + 0.8);
      const flicker = 0.88 + 0.12 * Math.cos(time * 19 + row * 1.3 + seed);
      sharedStage.plotEnergy(cx + sway + ox, gy, core * (1.12 - u * 0.68) * flicker, 6);
    }
  }

  const sparkLift = ((time * 12 + seed * 5) % 5) | 0;
  const sparkX = cx + Math.round(Math.sin(time * 9 + seed));
  sharedStage.plotEnergy(sparkX, cy - hCells - sparkLift, 1 - sparkLift / 5, 5);

  sharedStage.flush(pfx.ctx, pal);
}

/**
 * `patch-gg/pixelfx` Elite Enemy Crown Crest (pure pixel-art crown/diamond above elite enemies).
 */
export function renderPfxEliteCrest(
  pfx: PixelFXBuffer,
  wx: number,
  wy: number,
  affix: EliteAffix,
  time: number
): void {
  const cx = toGX(pfx, wx);
  const cy = toGY(pfx, wy + Math.sin(time * 5.5) * 1.0);
  if (cx < -6 || cx >= PFX_GRID_W + 6 || cy < -6 || cy >= PFX_GRID_H + 6) return;

  const pal =
    affix === 'frenzy'
      ? PFX_PALETTES.crimson
      : affix === 'storm'
        ? PFX_PALETTES.cyan
        : PFX_PALETTES.gold;

  sharedStage.begin();
  sharedStage.plotBresenhamLine(cx - 2, cy + 1, cx + 2, cy + 1, 4, 1, 1);
  sharedStage.plotBresenhamLine(cx - 2, cy + 1, cx - 3, cy - 1, 5, 1, 1);
  sharedStage.plotBresenhamLine(cx + 2, cy + 1, cx + 3, cy - 1, 5, 1, 1);
  sharedStage.plotBresenhamLine(cx, cy + 1, cx, cy - 2, 6, 1, 1);
  sharedStage.plot(cx - 3, cy - 2, 6);
  sharedStage.plot(cx + 3, cy - 2, 6);
  sharedStage.plot(cx, cy - 3, 6);
  sharedStage.flush(pfx.ctx, pal);
}

/**
 * `patch-gg/pixelfx` Dash & Skill Phase-Shift Afterimage Streaks (`renderPfxAfterimages`):
 * 100% texture-free Bayer-dithered pixel phantom cloak scanlines + glowing ghost-katana streak.
 */
export function renderPfxAfterimages(pfx: PixelFXBuffer, ghosts: readonly AfterimageGhost[]): void {
  for (let pass = 0; pass < 2; pass++) {
    const wantViolet = pass === 1;
    let any = false;
    sharedStage.begin();

    for (let i = 0; i < ghosts.length; i++) {
      const g = ghosts[i];
      if (!g.active) continue;
      const isViolet = g.r > g.g + 25;
      if (isViolet !== wantViolet) continue;

      const fade = 1 - g.elapsed / g.duration;
      if (fade <= 0.06) continue;

      const gx = toGX(pfx, g.x);
      const gy = toGY(pfx, g.y);
      if (gx < -20 || gx >= PFX_GRID_W + 20 || gy < -10 || gy >= PFX_GRID_H + 30) continue;
      any = true;

      const dir = g.facing;
      const hCells = g.pose === 'slide' ? 17 : 29;
      const leanCells = g.leanX * WORLD_TO_GRID * 0.55;

      for (let row = 1; row < hCells; row += 2) {
        const u = row / hCells;
        const bodyProfile =
          u > 0.78 ? 3 : u > 0.42 ? 5 : u > 0.18 ? 6 - u * 3 : 4;
        const shiftX = Math.round(leanCells * u - dir * (1 - fade) * 4);
        const trailLen = Math.round(bodyProfile + (1 - u * 0.35) * 5 * fade);
        const py = gy - row + Math.round(g.dropY * WORLD_TO_GRID * 0.5);
        const frontX = gx + shiftX + dir * Math.round(bodyProfile * 0.45);
        const backX = frontX - dir * trailLen;

        const minX = Math.min(frontX, backX);
        const maxX = Math.max(frontX, backX);
        const span = Math.max(1, maxX - minX);
        for (let px = minX; px <= maxX; px++) {
          const lead = dir === 1 ? (px - minX) / span : (maxX - px) / span;
          sharedStage.plotEnergy(px, py, lead * fade * 0.88, 5);
        }
      }

      const handX = gx + dir * 4;
      const handY = gy - (g.pose === 'slide' ? 9 : 17);
      const tipX = handX + Math.cos(g.bladeAngle) * 23;
      const tipY = handY + Math.sin(g.bladeAngle) * 23;
      sharedStage.plotBresenhamLine(handX, handY, tipX, tipY, fade > 0.5 ? 5 : 4, 1, fade * 0.85);
    }

    if (any) {
      sharedStage.flush(pfx.ctx, wantViolet ? PFX_PALETTES.violet : PFX_PALETTES.cyan);
    }
  }
}

export function getEnemySmearPalette(kind: EnemyKind, fallback: 'crimson' | 'cyan' | 'violet'): PfxPaletteId {
  if (kind === EnemyKind.Reaper) return 'cyan';
  if (kind === EnemyKind.Archon) return 'violet';
  return fallback;
}
