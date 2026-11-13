import { PIXEL_SCALE, RENDER_HEIGHT, RENDER_WIDTH, WORLD_HEIGHT, WORLD_WIDTH } from '../game/rules';
import {
  BoltDescriptor,
  PFX_CELL,
  renderPfxBolt,
  renderPfxParticles,
  renderPfxRing,
  renderPfxSlash,
} from './proceduralVfx';

/**
 * High-Precision PixelFX Renderer & 120Hz Simulated Particle / Slash / Shockwave / Popup Engine
 * - Reference: `github.com/patch-gg/pixelfx` dual-buffer (color + additive light) procedural VFX
 * - ZERO sprite/bitmap textures used for any visual effect (`所有特效禁止使用贴图`)
 * - 6-stop stepped color ramps + 4x4 Bayer ordered dithering + integer Bresenham/grid rasterization
 * - Fixed 120Hz simulated spark, petal, smoke, shockwave, afterimage & HD bitmap numeral pools
 */

const BAYER_4X4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
];

// High-precision 7x11 pixel-art bitmap font for crisp 8x HD floating combat numerals
const HD_PIXEL_GLYPHS: Record<string, number[]> = {
  '0': [
    0b0111110,
    0b1100011,
    0b1100111,
    0b1101011,
    0b1101011,
    0b1110011,
    0b1100011,
    0b1100011,
    0b1100011,
    0b0111110,
    0b0000000,
  ],
  '1': [
    0b0001100,
    0b0011100,
    0b0111100,
    0b0001100,
    0b0001100,
    0b0001100,
    0b0001100,
    0b0001100,
    0b0001100,
    0b0111111,
    0b0000000,
  ],
  '2': [
    0b0111110,
    0b1100011,
    0b0000011,
    0b0000110,
    0b0001100,
    0b0011000,
    0b0110000,
    0b1100000,
    0b1100011,
    0b1111111,
    0b0000000,
  ],
  '3': [
    0b0111110,
    0b1100011,
    0b0000011,
    0b0000110,
    0b0011110,
    0b0000111,
    0b0000011,
    0b0000011,
    0b1100011,
    0b0111110,
    0b0000000,
  ],
  '4': [
    0b0000110,
    0b0001110,
    0b0011110,
    0b0110110,
    0b1100110,
    0b1100110,
    0b1111111,
    0b0000110,
    0b0000110,
    0b0001111,
    0b0000000,
  ],
  '5': [
    0b1111111,
    0b1100000,
    0b1100000,
    0b1111110,
    0b0000011,
    0b0000011,
    0b0000011,
    0b0000011,
    0b1100011,
    0b0111110,
    0b0000000,
  ],
  '6': [
    0b0011110,
    0b0110000,
    0b1100000,
    0b1111110,
    0b1100011,
    0b1100011,
    0b1100011,
    0b1100011,
    0b1100011,
    0b0111110,
    0b0000000,
  ],
  '7': [
    0b1111111,
    0b1100011,
    0b0000011,
    0b0000110,
    0b0001100,
    0b0001100,
    0b0011000,
    0b0011000,
    0b0011000,
    0b0011000,
    0b0000000,
  ],
  '8': [
    0b0111110,
    0b1100011,
    0b1100011,
    0b1100011,
    0b0111110,
    0b1100011,
    0b1100011,
    0b1100011,
    0b1100011,
    0b0111110,
    0b0000000,
  ],
  '9': [
    0b0111110,
    0b1100011,
    0b1100011,
    0b1100011,
    0b1100011,
    0b0111111,
    0b0000011,
    0b0000110,
    0b0001100,
    0b0111000,
    0b0000000,
  ],
  '!': [
    0b0011100,
    0b0011100,
    0b0011100,
    0b0011100,
    0b0001000,
    0b0001000,
    0b0001000,
    0b0000000,
    0b0011100,
    0b0011100,
    0b0000000,
  ],
  '+': [
    0b0000000,
    0b0001000,
    0b0001000,
    0b0001000,
    0b0111110,
    0b0111110,
    0b0001000,
    0b0001000,
    0b0001000,
    0b0000000,
    0b0000000,
  ],
};

export function seededRand(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

interface SimParticle {
  active: boolean;
  kind: 'spark' | 'smoke' | 'petal' | 'ember';
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  floorY: number;
  gravity: number;
  drag: number;
  bounce: number;
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

export type SlashRenderStyle =
  | 'arc_down'
  | 'arc_up'
  | 'spin'
  | 'wide_cleave'
  | 'slide'
  | 'uppercut'
  | 'thrust'
  | 'plunge'
  | 'dimension'
  | 'counter'
  | 'astral_wave';

export interface SimSlash {
  active: boolean;
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
  owner?: 'player' | 'enemy';
  sourceId?: number;
  anchorEntityId?: number;
  offsetX?: number;
  offsetY?: number;
  trackUntilElapsed?: number;
  auxDamage?: number;
  auxColor?: 'cyan' | 'crimson' | 'violet' | 'silver';
  energyOnHit?: number;
  applyBleed?: number;
  hitIds: Set<number>;
}

export interface SimRing {
  active: boolean;
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
  owner?: 'player' | 'enemy';
  damage?: number;
  damageColor?: 'cyan' | 'crimson' | 'violet' | 'silver';
  chillSec?: number;
  dirX?: 1 | -1;
  hitIds: Set<number>;
}

export interface SimBolt extends BoltDescriptor {
  active: boolean;
  owner: 'player' | 'enemy';
  damage: number;
  damageColor: 'cyan' | 'crimson' | 'violet' | 'silver';
  chillSec: number;
  hitIds: Set<number>;
}

interface SimPopup {
  active: boolean;
  text: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  elapsed: number;
  duration: number;
  r: number;
  g: number;
  b: number;
}

export interface AfterimageGhost {
  active: boolean;
  x: number;
  y: number;
  facing: 1 | -1;
  pose: 'dash' | 'air' | 'slash' | 'slide' | 'flip';
  leanX: number;
  dropY: number;
  bladeAngle: number;
  elapsed: number;
  duration: number;
  r: number;
  g: number;
  b: number;
}

interface QueuedLight {
  lx: number;
  ly: number;
  radWorld: number;
  r: number;
  g: number;
  b: number;
}

const MAX_PARTICLES = 680;
const MAX_SLASHES = 36;
const MAX_RINGS = 24;
const MAX_BOLTS = 28;
const MAX_GHOSTS = 24;
const MAX_POPUPS = 24;
const MAX_LIGHTS = 180;
const FIXED_STEP = 1 / 120;
const LIGHTMAP_SCALE = 1 / 3;
const LIGHTMAP_WIDTH = Math.ceil(WORLD_WIDTH * LIGHTMAP_SCALE);
const LIGHTMAP_HEIGHT = Math.ceil(WORLD_HEIGHT * LIGHTMAP_SCALE);

export class PixelFXBuffer {
  public readonly scale = PIXEL_SCALE;
  public readonly worldWidth = WORLD_WIDTH;
  public readonly worldHeight = WORLD_HEIGHT;
  public readonly width = RENDER_WIDTH;
  public readonly height = RENDER_HEIGHT;
  public readonly ctx: CanvasRenderingContext2D;

  private readonly lightCanvas: HTMLCanvasElement;
  private readonly lightCtx: CanvasRenderingContext2D;
  private readonly skyGradCache = new Map<string, CanvasGradient>();

  private simAccumulator = 0;
  private particleCursor = 0;
  private slashCursor = 0;
  private ringCursor = 0;
  private boltCursor = 0;
  private ghostCursor = 0;
  private popupCursor = 0;
  private lightCount = 0;

  private readonly particles: SimParticle[];
  private readonly slashes: SimSlash[];
  private readonly rings: SimRing[];
  private readonly bolts: SimBolt[];
  private readonly popups: SimPopup[];
  private readonly lights: QueuedLight[];
  public readonly ghosts: AfterimageGhost[];

  private readonly lightStampCache = new Map<number, HTMLCanvasElement>();

  public camX = 0;
  public camY = 0;
  public screenFlash = 0;
  public screenFlashColor: RGB = { r: 210, g: 230, b: 255 };
  public witchTimeTint = 0;

  constructor(ctx: CanvasRenderingContext2D, _cpuBacked = false) {
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;

    this.lightCanvas = document.createElement('canvas');
    this.lightCanvas.width = LIGHTMAP_WIDTH;
    this.lightCanvas.height = LIGHTMAP_HEIGHT;
    this.lightCtx = this.lightCanvas.getContext('2d', { alpha: false })!;

    this.particles = Array.from({ length: MAX_PARTICLES }, () => ({
      active: false,
      kind: 'spark',
      x: 0,
      y: 0,
      prevX: 0,
      prevY: 0,
      vx: 0,
      vy: 0,
      floorY: 9999,
      gravity: 0,
      drag: 1,
      bounce: 0,
      life: 0,
      maxLife: 1,
      size: 1,
      r: 255,
      g: 255,
      b: 255,
      lightR: 0,
      lightG: 0,
      lightB: 0,
    }));

    this.slashes = Array.from({ length: MAX_SLASHES }, () => ({
      active: false,
      x: 0,
      y: 0,
      facing: 1,
      style: 'arc_down',
      palette: 'silver',
      elapsed: 0,
      duration: 0.2,
      radiusX: 44,
      radiusY: 28,
      seed: 1,
      hitIds: new Set<number>(),
    }));

    this.rings = Array.from({ length: MAX_RINGS }, () => ({
      active: false,
      x: 0,
      y: 0,
      maxRadius: 48,
      elapsed: 0,
      duration: 0.3,
      r: 180,
      g: 220,
      b: 255,
      isDimensionLines: false,
      seed: 1,
      hitIds: new Set<number>(),
    }));

    this.bolts = Array.from({ length: MAX_BOLTS }, () => ({
      active: false,
      x0: 0,
      y0: 0,
      x1: 0,
      y1: 0,
      palette: 'cyan',
      elapsed: 0,
      duration: 0.18,
      seed: 1,
      thicknessCells: 2,
      owner: 'player',
      damage: 0,
      damageColor: 'cyan',
      chillSec: 0,
      hitIds: new Set<number>(),
    }));

    this.popups = Array.from({ length: MAX_POPUPS }, () => ({
      active: false,
      text: '',
      x: 0,
      y: 0,
      vx: 0,
      vy: -36,
      elapsed: 0,
      duration: 0.55,
      r: 255,
      g: 255,
      b: 255,
    }));

    this.ghosts = Array.from({ length: MAX_GHOSTS }, () => ({
      active: false,
      x: 0,
      y: 0,
      facing: 1,
      pose: 'dash',
      leanX: 0,
      dropY: 0,
      bladeAngle: 2.8,
      elapsed: 0,
      duration: 0.22,
      r: 130,
      g: 175,
      b: 255,
    }));

    this.lights = Array.from({ length: MAX_LIGHTS }, () => ({
      lx: 0,
      ly: 0,
      radWorld: 16,
      r: 0,
      g: 0,
      b: 0,
    }));
  }

  public getSlashes(): readonly SimSlash[] {
    return this.slashes;
  }

  public getRings(): readonly SimRing[] {
    return this.rings;
  }

  public getBolts(): readonly SimBolt[] {
    return this.bolts;
  }

  public resetPools(): void {
    for (const p of this.particles) p.active = false;
    for (const s of this.slashes) {
      s.active = false;
      s.hitIds.clear();
    }
    for (const r of this.rings) {
      r.active = false;
      r.hitIds.clear();
    }
    for (const b of this.bolts) {
      b.active = false;
      b.hitIds.clear();
    }
    for (const g of this.ghosts) g.active = false;
    for (const pop of this.popups) pop.active = false;
    this.lightCount = 0;
    this.screenFlash = 0;
    this.witchTimeTint = 0;
  }

  public clearBuffers(): void {
    this.lightCount = 0;
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.globalAlpha = 1;
    this.ctx.imageSmoothingEnabled = false;
  }

  // --- Exact 8x Integer Pixel Coordinate Helpers ---

  public sx(wx: number): number {
    return Math.round((wx - this.camX) * PIXEL_SCALE);
  }

  public sy(wy: number): number {
    return Math.round((wy - this.camY) * PIXEL_SCALE);
  }

  public sp(worldLen: number): number {
    return Math.max(1, Math.round(worldLen * PIXEL_SCALE));
  }

  // --- Pre-Baked PixelFX Stepped Radial Glow Stamp Cache ---

  private getRadialLightStamp(r: number, g: number, b: number): HTMLCanvasElement {
    const maxCh = Math.max(1, r, g, b);
    const nr = Math.min(31, Math.round((r / maxCh) * 31));
    const ng = Math.min(31, Math.round((g / maxCh) * 31));
    const nb = Math.min(31, Math.round((b / maxCh) * 31));
    const key = (nr << 10) | (ng << 5) | nb;
    const existing = this.lightStampCache.get(key);
    if (existing) return existing;

    if (this.lightStampCache.size > 96) {
      this.lightStampCache.clear();
    }

    const size = 48;
    const half = size >> 1;
    const stamp = document.createElement('canvas');
    stamp.width = size;
    stamp.height = size;
    const sctx = stamp.getContext('2d')!;
    const img = sctx.createImageData(size, size);
    const data = img.data;
    const cr = (nr / 31) * 255;
    const cg = (ng / 31) * 255;
    const cb = (nb / 31) * 255;

    for (let y = 0; y < size; y++) {
      const dy = (y + 0.5 - half) / half;
      const bayerRow = (y & 3) << 2;
      for (let x = 0; x < size; x++) {
        const dx = (x + 0.5 - half) / half;
        const d2 = dx * dx + dy * dy;
        if (d2 >= 1) continue;
        const falloff = 1 - d2;
        const stepped = Math.floor(falloff * falloff * 12) / 12;
        const bayerVal = (BAYER_4X4[bayerRow + (x & 3)] + 0.5) / 16;
        const energy = falloff > 0.5 ? falloff * falloff : stepped + (falloff * falloff > bayerVal * 0.5 ? 0.08 : 0);
        const idx = (y * size + x) << 2;
        data[idx] = Math.min(255, cr * energy) | 0;
        data[idx + 1] = Math.min(255, cg * energy) | 0;
        data[idx + 2] = Math.min(255, cb * energy) | 0;
        data[idx + 3] = 255;
      }
    }

    sctx.putImageData(img, 0, 0);
    this.lightStampCache.set(key, stamp);
    return stamp;
  }

  // --- Fast 8x Sub-Pixel Precision Drawing Primitives ---

  private qx(wx: number): number {
    return Math.round((wx - this.camX) * 8) * (PIXEL_SCALE / 8);
  }

  private qy(wy: number): number {
    return Math.round((wy - this.camY) * 8) * (PIXEL_SCALE / 8);
  }

  public fillScreenGradient(
    topR: number,
    topG: number,
    topB: number,
    botR: number,
    botG: number,
    botB: number
  ): void {
    const key = `${topR},${topG},${topB}-${botR},${botG},${botB}`;
    let grad = this.skyGradCache.get(key);
    if (!grad) {
      grad = this.ctx.createLinearGradient(0, 0, 0, this.height);
      grad.addColorStop(0, `rgb(${topR | 0},${topG | 0},${topB | 0})`);
      grad.addColorStop(1, `rgb(${botR | 0},${botG | 0},${botB | 0})`);
      this.skyGradCache.set(key, grad);
    }
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Blit a pre-baked pixel-art sprite part onto a 2D skeletal bone with exact sub-pixel pivot & nearest-neighbor crispness.
   * Default 1 texel = 0.25 world units = 1.0 native pixel on the 1920x1080 buffer.
   */
  public drawSprite(
    sprite: HTMLCanvasElement,
    wx: number,
    wy: number,
    angleRad = 0,
    anchorXTex = sprite.width * 0.5,
    anchorYTex = sprite.height * 0.5,
    flipY = false,
    scaleX = 1,
    scaleY = 1,
    alpha = 1,
    texelWorldSize = 0.25
  ): void {
    if (alpha <= 0.02) return;
    const px = this.qx(wx);
    const py = this.qy(wy);
    const baseScale = texelWorldSize * PIXEL_SCALE;
    const maxDim = Math.max(sprite.width, sprite.height) * baseScale * Math.max(Math.abs(scaleX), Math.abs(scaleY));
    if (
      px + maxDim < 0 ||
      px - maxDim >= this.width ||
      py + maxDim < 0 ||
      py - maxDim >= this.height
    ) {
      return;
    }

    const ctx = this.ctx;
    const sx = scaleX * baseScale;
    const sy = (flipY ? -scaleY : scaleY) * baseScale;

    // Exact 1:1 rigid integer-pixel fast path (guarantees ZERO texel stretching, doubling, or sub-pixel distortion!)
    if (angleRad === 0 && sy === 1 && (sx === 1 || sx === -1)) {
      const ax = Math.round(anchorXTex);
      const ay = Math.round(anchorYTex);
      const drawY = Math.round(py - ay);
      ctx.imageSmoothingEnabled = false;
      if (sx === 1) {
        const drawX = Math.round(px - ax);
        if (alpha < 0.99) {
          ctx.globalAlpha = alpha;
          ctx.drawImage(sprite, drawX, drawY);
          ctx.globalAlpha = 1;
        } else {
          ctx.drawImage(sprite, drawX, drawY);
        }
        return;
      }
      const drawX = Math.round(px + ax);
      if (alpha < 0.99) {
        ctx.globalAlpha = alpha;
      }
      ctx.setTransform(-1, 0, 0, 1, drawX, drawY);
      ctx.drawImage(sprite, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (alpha < 0.99) {
        ctx.globalAlpha = 1;
      }
      return;
    }

    ctx.imageSmoothingEnabled = false;
    if (alpha < 0.99) {
      ctx.globalAlpha = alpha;
    }
    if (angleRad === 0) {
      ctx.setTransform(sx, 0, 0, sy, px, py);
    } else {
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);
      ctx.setTransform(cos * sx, sin * sx, -sin * sy, cos * sy, px, py);
    }
    ctx.drawImage(sprite, -anchorXTex, -anchorYTex);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (alpha < 0.99) {
      ctx.globalAlpha = 1;
    }
  }

  /**
   * Fill a world-space rectangle using a seamless pixel-art tile CanvasPattern locked to world coordinates
   * so stone masonry, cornices, and wrought-iron balconies never slide when the camera pans.
   */
  public fillPatternRect(
    tileCanvas: HTMLCanvasElement,
    _patternCache: WeakMap<CanvasRenderingContext2D, CanvasPattern>,
    wx: number,
    wy: number,
    w: number,
    h: number,
    offsetWorldX = 0,
    offsetWorldY = 0
  ): void {
    const x0 = Math.round(this.qx(wx));
    const y0 = Math.round(this.qy(wy));
    const x1 = Math.round(this.qx(wx + w));
    const y1 = Math.round(this.qy(wy + h));
    const cx0 = Math.max(0, x0);
    const cy0 = Math.max(0, y0);
    const cx1 = Math.min(this.width, x1);
    const cy1 = Math.min(this.height, y1);
    if (cx1 <= cx0 || cy1 <= cy0) return;

    const tw = tileCanvas.width;
    const th = tileCanvas.height;
    if (tw <= 0 || th <= 0) return;

    const originX = Math.round((offsetWorldX - this.camX) * PIXEL_SCALE);
    const originY = Math.round((offsetWorldY - this.camY) * PIXEL_SCALE);
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;

    for (let dy = cy0; dy < cy1; ) {
      const tsy = (((dy - originY) % th) + th) % th;
      const tsh = Math.min(th - tsy, cy1 - dy);
      for (let dx = cx0; dx < cx1; ) {
        const tsx = (((dx - originX) % tw) + tw) % tw;
        const tsw = Math.min(tw - tsx, cx1 - dx);
        ctx.drawImage(tileCanvas, tsx, tsy, tsw, tsh, dx, dy, tsw, tsh);
        dx += tsw;
      }
      dy += tsh;
    }
  }

  public setPixel(wx: number, wy: number, r: number, g: number, b: number, hdSize = 2): void {
    const pxSize = Math.max(1, Math.round((hdSize * PIXEL_SCALE) / 8));
    const x = Math.round(this.qx(wx));
    const y = Math.round(this.qy(wy));
    if (x < -pxSize || x >= this.width || y < -pxSize || y >= this.height) return;
    this.ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
    this.ctx.fillRect(x, y, pxSize, pxSize);
  }

  public setDitherPixel(
    wx: number,
    wy: number,
    r: number,
    g: number,
    b: number,
    coverage: number,
    hdSize = 2
  ): void {
    if (coverage <= 0.04) return;
    const pxSize = Math.max(1, Math.round((hdSize * PIXEL_SCALE) / 8));
    const x = Math.round(this.qx(wx));
    const y = Math.round(this.qy(wy));
    if (x < -pxSize || x >= this.width || y < -pxSize || y >= this.height) return;
    if (coverage < 0.96) {
      const threshold = (BAYER_4X4[((y & 3) << 2) + (x & 3)] + 0.5) / 16;
      if (coverage < threshold) return;
    }
    this.ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
    this.ctx.fillRect(x, y, pxSize, pxSize);
  }

  public fillRect(
    wx: number,
    wy: number,
    w: number,
    h: number,
    r: number,
    g: number,
    b: number
  ): void {
    const x0 = this.qx(wx);
    const y0 = this.qy(wy);
    const x1 = this.qx(wx + w);
    const y1 = this.qy(wy + h);
    const rw = x1 - x0;
    const rh = y1 - y0;
    if (rw <= 0 || rh <= 0 || x1 < 0 || y1 < 0 || x0 >= this.width || y0 >= this.height) return;
    this.ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
    this.ctx.fillRect(x0, y0, rw, rh);
  }

  public fillDitherRect(
    wx: number,
    wy: number,
    w: number,
    h: number,
    r: number,
    g: number,
    b: number,
    coverage: number
  ): void {
    if (coverage <= 0.04) return;
    if (coverage >= 0.96) {
      this.fillRect(wx, wy, w, h, r, g, b);
      return;
    }
    const x0 = Math.round(this.qx(wx));
    const y0 = Math.round(this.qy(wy));
    const x1 = Math.round(this.qx(wx + w));
    const y1 = Math.round(this.qy(wy + h));
    const rw = x1 - x0;
    const rh = y1 - y0;
    if (rw <= 0 || rh <= 0 || x1 < 0 || y1 < 0 || x0 >= this.width || y0 >= this.height) return;

    this.ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${coverage.toFixed(3)})`;
    this.ctx.fillRect(x0, y0, rw, rh);
  }

  public fillPoly(
    pts: ReadonlyArray<readonly [number, number]>,
    r: number,
    g: number,
    b: number,
    coverage = 1
  ): void {
    if (pts.length < 3 || coverage <= 0.03) return;
    if (coverage >= 0.96) {
      this.ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
    } else {
      this.ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${coverage.toFixed(3)})`;
    }
    this.ctx.beginPath();
    this.ctx.moveTo(this.qx(pts[0][0]), this.qy(pts[0][1]));
    for (let i = 1; i < pts.length; i++) {
      this.ctx.lineTo(this.qx(pts[i][0]), this.qy(pts[i][1]));
    }
    this.ctx.closePath();
    this.ctx.fill();
  }

  public fillCircle(
    wx: number,
    wy: number,
    radiusWorld: number,
    r: number,
    g: number,
    b: number,
    coverage = 1
  ): void {
    if (coverage <= 0.03 || radiusWorld <= 0.05) return;
    const cx = this.qx(wx);
    const cy = this.qy(wy);
    const rad = Math.max(0.75, radiusWorld * PIXEL_SCALE);
    if (cx + rad < 0 || cx - rad >= this.width || cy + rad < 0 || cy - rad >= this.height) return;

    if (coverage >= 0.96) {
      this.ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
    } else {
      this.ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${coverage.toFixed(3)})`;
    }
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /**
   * Integer-grid Bresenham pixel line plotter (zero anti-aliased vector strokes).
   */
  public drawLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    r: number,
    g: number,
    b: number,
    lightIntensity = 0,
    hdWidth = 3
  ): void {
    if (!Number.isFinite(x0 + y0 + x1 + y1)) return;
    const cell = PFX_CELL;
    let gx0 = Math.round(this.qx(x0) / cell);
    let gy0 = Math.round(this.qy(y0) / cell);
    const gx1 = Math.round(this.qx(x1) / cell);
    const gy1 = Math.round(this.qy(y1) / cell);
    const maxCellsX = this.width / cell;
    const maxCellsY = this.height / cell;

    if (
      (gx0 < -4 && gx1 < -4) ||
      (gx0 >= maxCellsX + 4 && gx1 >= maxCellsX + 4) ||
      (gy0 < -4 && gy1 < -4) ||
      (gy0 >= maxCellsY + 4 && gy1 >= maxCellsY + 4)
    ) {
      return;
    }

    const pxSize = Math.max(cell, Math.round((hdWidth * PIXEL_SCALE) / 8 / cell) * cell);
    const dx = Math.abs(gx1 - gx0);
    const dy = -Math.abs(gy1 - gy0);
    const sx = gx0 < gx1 ? 1 : -1;
    const sy = gy0 < gy1 ? 1 : -1;
    let err = dx + dy;
    let guard = Math.min(2048, dx - dy + 2);

    this.ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
    let runMinX = gx0;
    let runMaxX = gx0;
    let runY = gy0;

    while (guard-- > 0) {
      if (gy0 !== runY) {
        this.ctx.fillRect(
          runMinX * cell,
          runY * cell,
          (runMaxX - runMinX) * cell + pxSize,
          pxSize
        );
        runMinX = gx0;
        runMaxX = gx0;
        runY = gy0;
      } else {
        if (gx0 < runMinX) runMinX = gx0;
        if (gx0 > runMaxX) runMaxX = gx0;
      }
      if (gx0 === gx1 && gy0 === gy1) break;
      const e2 = err << 1;
      if (e2 >= dy) {
        err += dy;
        gx0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        gy0 += sy;
      }
    }
    this.ctx.fillRect(
      runMinX * cell,
      runY * cell,
      (runMaxX - runMinX) * cell + pxSize,
      pxSize
    );

    if (lightIntensity > 0.05) {
      const mx = (x0 + x1) * 0.5;
      const my = (y0 + y1) * 0.5;
      const worldLen = Math.hypot(x1 - x0, y1 - y0);
      this.addRadialLight(
        mx,
        my,
        Math.max(5, worldLen * 0.65),
        (r * 0.34 * lightIntensity) | 0,
        (g * 0.34 * lightIntensity) | 0,
        (b * 0.38 * lightIntensity) | 0
      );
    }
  }

  public addLight(wx: number, wy: number, r: number, g: number, b: number): void {
    this.addRadialLight(wx, wy, 2.2, r, g, b);
  }

  public addRadialLight(
    wx: number,
    wy: number,
    radius: number,
    r: number,
    g: number,
    b: number
  ): void {
    if (this.lightCount >= MAX_LIGHTS || (r <= 1 && g <= 1 && b <= 1) || radius <= 0.2) return;
    const lx = wx - this.camX;
    const ly = wy - this.camY;
    if (
      lx + radius < 0 ||
      lx - radius >= WORLD_WIDTH ||
      ly + radius < 0 ||
      ly - radius >= WORLD_HEIGHT
    ) {
      return;
    }
    const slot = this.lights[this.lightCount++];
    slot.lx = lx;
    slot.ly = ly;
    slot.radWorld = radius;
    slot.r = r;
    slot.g = g;
    slot.b = b;
  }

  // --- Spawn Pooled Effects ---

  public spawnPopup(text: string, x: number, y: number, r = 245, g = 250, b = 255): void {
    const pop = this.popups[this.popupCursor];
    this.popupCursor = (this.popupCursor + 1) % MAX_POPUPS;
    pop.active = true;
    pop.text = text;
    pop.x = x;
    pop.y = y;
    pop.vx = (Math.random() - 0.5) * 24;
    pop.vy = -52;
    pop.elapsed = 0;
    pop.duration = 0.55;
    pop.r = r;
    pop.g = g;
    pop.b = b;
  }

  public spawnParticle(opts: Partial<SimParticle> & { x: number; y: number }): void {
    const p = this.particles[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % MAX_PARTICLES;

    p.active = true;
    p.kind = opts.kind ?? 'spark';
    p.x = opts.x;
    p.y = opts.y;
    p.prevX = opts.x;
    p.prevY = opts.y;
    p.vx = opts.vx ?? 0;
    p.vy = opts.vy ?? 0;
    p.floorY = opts.floorY ?? opts.y + 24;
    p.gravity = opts.gravity ?? 420;
    p.drag = opts.drag ?? 0.985;
    p.bounce = opts.bounce ?? 0.45;
    p.life = 0;
    p.maxLife = opts.maxLife ?? 0.45;
    p.size = opts.size ?? 1;
    p.r = opts.r ?? 255;
    p.g = opts.g ?? 255;
    p.b = opts.b ?? 255;
    p.lightR = opts.lightR ?? 80;
    p.lightG = opts.lightG ?? 100;
    p.lightB = opts.lightB ?? 140;
  }

  public spawnHitSparks(
    x: number,
    y: number,
    dirX: number,
    palette: 'silver' | 'violet' | 'cyan' | 'crimson',
    heavy: boolean,
    floorY?: number
  ): void {
    const count = heavy ? 28 : 16;
    const colors: Record<typeof palette, [RGB, RGB]> = {
      silver: [{ r: 248, g: 252, b: 255 }, { r: 145, g: 192, b: 255 }],
      cyan: [{ r: 235, g: 255, b: 255 }, { r: 80, g: 230, b: 255 }],
      violet: [{ r: 252, g: 238, b: 255 }, { r: 198, g: 118, b: 255 }],
      crimson: [{ r: 255, g: 238, b: 224 }, { r: 255, g: 78, b: 118 }],
    };
    const [core, glow] = colors[palette];

    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * (heavy ? 2.2 : 1.5);
      const baseAngle = dirX >= 0 ? -0.25 : Math.PI + 0.25;
      const angle = baseAngle + spread;
      const speed = (heavy ? 135 : 92) + Math.random() * (heavy ? 225 : 150);
      const isHot = i % 3 === 0;
      const c = isHot ? core : glow;

      this.spawnParticle({
        kind: 'spark',
        x,
        y,
        floorY: floorY ?? y + 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 35,
        gravity: 480,
        drag: 0.978,
        bounce: 0.52,
        maxLife: 0.24 + Math.random() * 0.28,
        size: heavy && isHot ? 2 : 1,
        r: c.r,
        g: c.g,
        b: c.b,
        lightR: (glow.r * 0.65) | 0,
        lightG: (glow.g * 0.65) | 0,
        lightB: (glow.b * 0.65) | 0,
      });
    }

    for (let i = 0; i < (heavy ? 7 : 3); i++) {
      this.spawnParticle({
        kind: 'smoke',
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: dirX * (20 + Math.random() * 45),
        vy: -15 - Math.random() * 35,
        gravity: -28,
        drag: 0.95,
        bounce: 0,
        maxLife: 0.28 + Math.random() * 0.18,
        size: heavy ? 4.5 : 2.8,
        r: glow.r,
        g: glow.g,
        b: glow.b,
        lightR: 25,
        lightG: 25,
        lightB: 45,
      });
    }

    if (heavy) {
      this.spawnRing(x, y, 36, 0.22, glow.r, glow.g, glow.b, false);
    }
  }

  public spawnDustBurst(x: number, y: number, dirX: number, count = 7): void {
    for (let i = 0; i < count; i++) {
      this.spawnParticle({
        kind: 'smoke',
        x: x + (Math.random() - 0.5) * 8,
        y: y - 1,
        vx: -dirX * (25 + Math.random() * 55) + (Math.random() - 0.5) * 30,
        vy: -12 - Math.random() * 28,
        gravity: -15,
        drag: 0.94,
        bounce: 0,
        maxLife: 0.24 + Math.random() * 0.14,
        size: 2.6 + Math.random() * 1.8,
        r: 152,
        g: 170,
        b: 214,
        lightR: 14,
        lightG: 18,
        lightB: 32,
      });
    }
  }

  public spawnSlash(opts: {
    x: number;
    y: number;
    facing: 1 | -1;
    style: SlashRenderStyle;
    palette: SimSlash['palette'];
    duration?: number;
    radiusX?: number;
    radiusY?: number;
    owner?: 'player' | 'enemy';
    sourceId?: number;
    anchorEntityId?: number;
    offsetX?: number;
    offsetY?: number;
    trackUntilElapsed?: number;
    auxDamage?: number;
    auxColor?: 'cyan' | 'crimson' | 'violet' | 'silver';
    energyOnHit?: number;
    applyBleed?: number;
  }): void {
    const s = this.slashes[this.slashCursor];
    this.slashCursor = (this.slashCursor + 1) % MAX_SLASHES;
    s.active = true;
    s.x = opts.x;
    s.y = opts.y;
    s.facing = opts.facing;
    s.style = opts.style;
    s.palette = opts.palette;
    s.elapsed = 0;
    s.duration = opts.duration ?? 0.2;
    s.radiusX = opts.radiusX ?? 46;
    s.radiusY = opts.radiusY ?? 28;
    s.seed = ((Math.random() * 100000) | 0) + 1;
    s.owner = opts.owner;
    s.sourceId = opts.sourceId;
    s.anchorEntityId = opts.anchorEntityId;
    s.offsetX = opts.offsetX;
    s.offsetY = opts.offsetY;
    s.trackUntilElapsed = opts.trackUntilElapsed;
    s.auxDamage = opts.auxDamage;
    s.auxColor = opts.auxColor;
    s.energyOnHit = opts.energyOnHit;
    s.applyBleed = opts.applyBleed;
    s.hitIds.clear();

    // PixelFX-style dispersing quantized square pixel embers shed along the slash arc
    // (DimensionCut stays sleek dark-void with zero bright additive glare!)
    if (opts.style === 'dimension') {
      for (let i = 0; i < 4; i++) {
        const ang = (Math.random() - 0.5) * 2.2;
        const rx = (opts.radiusX ?? 46) * (0.55 + Math.random() * 0.45);
        const ry = (opts.radiusY ?? 28) * (0.55 + Math.random() * 0.45);
        this.spawnParticle({
          kind: 'smoke',
          x: opts.x + Math.cos(ang) * rx * opts.facing,
          y: opts.y + Math.sin(ang) * ry,
          vx: opts.facing * (18 + Math.random() * 34),
          vy: (Math.random() - 0.5) * 32,
          gravity: 0,
          drag: 0.94,
          bounce: 0,
          maxLife: 0.18 + Math.random() * 0.1,
          size: 2.2,
          r: 86,
          g: 62,
          b: 156,
          lightR: 0,
          lightG: 0,
          lightB: 0,
        });
      }
      return;
    }

    const emberPal: Record<SimSlash['palette'], { hi: RGB; mid: RGB }> = {
      silver: { hi: { r: 248, g: 252, b: 255 }, mid: { r: 132, g: 196, b: 255 } },
      cyan: { hi: { r: 238, g: 255, b: 255 }, mid: { r: 68, g: 226, b: 255 } },
      violet: { hi: { r: 248, g: 232, b: 255 }, mid: { r: 192, g: 108, b: 255 } },
      crimson: { hi: { r: 255, g: 238, b: 224 }, mid: { r: 255, g: 82, b: 122 } },
    };
    const ep = emberPal[opts.palette];
    const rx = opts.radiusX ?? 46;
    const ry = opts.radiusY ?? 28;
    const sparkCount =
      opts.style === 'counter'
        ? 14
        : opts.style === 'wide_cleave' || opts.style === 'spin'
          ? 10
          : 7;
    for (let i = 0; i < sparkCount; i++) {
      const u = (i + 0.35) / sparkCount;
      const ang = -1.25 + u * 2.5;
      const c = i % 2 === 0 ? ep.hi : ep.mid;
      this.spawnParticle({
        kind: i % 3 === 0 ? 'spark' : 'ember',
        x: opts.x + Math.cos(ang) * rx * 0.92 * opts.facing,
        y: opts.y + Math.sin(ang) * ry * 0.92,
        vx: opts.facing * (68 + Math.random() * 115),
        vy: Math.sin(ang) * 72 - 18,
        gravity: 55,
        drag: 0.94,
        bounce: 0,
        maxLife: 0.16 + Math.random() * 0.15,
        size: i >= sparkCount - 2 ? 2.5 : 1.8,
        r: c.r,
        g: c.g,
        b: c.b,
        lightR: (ep.mid.r * 0.38) | 0,
        lightG: (ep.mid.g * 0.38) | 0,
        lightB: (ep.mid.b * 0.42) | 0,
      });
    }
  }

  public spawnRing(
    x: number,
    y: number,
    maxRadius: number,
    duration: number,
    r: number,
    g: number,
    b: number,
    isDimensionLines = false,
    combatOpts?: {
      owner?: 'player' | 'enemy';
      damage?: number;
      damageColor?: 'cyan' | 'crimson' | 'violet' | 'silver';
      chillSec?: number;
      dirX?: 1 | -1;
    }
  ): void {
    const ring = this.rings[this.ringCursor];
    this.ringCursor = (this.ringCursor + 1) % MAX_RINGS;
    ring.active = true;
    ring.x = x;
    ring.y = y;
    ring.maxRadius = maxRadius;
    ring.elapsed = 0;
    ring.duration = duration;
    ring.r = r;
    ring.g = g;
    ring.b = b;
    ring.isDimensionLines = isDimensionLines;
    ring.seed = ((Math.random() * 99999) | 0) + 1;
    ring.owner = combatOpts?.owner;
    ring.damage = combatOpts?.damage;
    ring.damageColor = combatOpts?.damageColor;
    ring.chillSec = combatOpts?.chillSec;
    ring.dirX = combatOpts?.dirX;
    ring.hitIds.clear();
  }

  public spawnBolt(opts: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    palette?: BoltDescriptor['palette'];
    duration?: number;
    thickness?: number;
    owner?: 'player' | 'enemy';
    damage?: number;
    damageColor?: 'cyan' | 'crimson' | 'violet' | 'silver';
    chillSec?: number;
  }): void {
    const b = this.bolts[this.boltCursor];
    this.boltCursor = (this.boltCursor + 1) % MAX_BOLTS;
    b.active = true;
    b.x0 = opts.x0;
    b.y0 = opts.y0;
    b.x1 = opts.x1;
    b.y1 = opts.y1;
    b.palette = opts.palette ?? 'cyan';
    b.elapsed = 0;
    b.duration = opts.duration ?? 0.2;
    b.seed = ((Math.random() * 99999) | 0) + 1;
    b.thicknessCells = opts.thickness ?? 2;
    b.owner = opts.owner ?? 'player';
    b.damage = opts.damage ?? 0;
    b.damageColor = opts.damageColor ?? 'cyan';
    b.chillSec = opts.chillSec ?? 0;
    b.hitIds.clear();
  }

  public spawnAfterimage(
    x: number,
    y: number,
    facing: 1 | -1,
    pose: AfterimageGhost['pose'],
    r = 120,
    g = 185,
    b = 255,
    leanX = facing * 5,
    dropY = 2,
    bladeAngle = facing === 1 ? 2.9 : Math.PI - 2.9
  ): void {
    const ghost = this.ghosts[this.ghostCursor];
    this.ghostCursor = (this.ghostCursor + 1) % MAX_GHOSTS;
    ghost.active = true;
    ghost.x = x;
    ghost.y = y;
    ghost.facing = facing;
    ghost.pose = pose;
    ghost.leanX = leanX;
    ghost.dropY = dropY;
    ghost.bladeAngle = bladeAngle;
    ghost.elapsed = 0;
    ghost.duration = 0.23;
    ghost.r = r;
    ghost.g = g;
    ghost.b = b;
  }

  // --- 120Hz Simulation Step ---

  public step(dt: number): void {
    this.screenFlash = Math.max(0, this.screenFlash - dt * 4.5);

    this.simAccumulator = Math.min(0.1, this.simAccumulator + dt);
    while (this.simAccumulator >= FIXED_STEP) {
      this.simAccumulator -= FIXED_STEP;
      this.stepFixed120(FIXED_STEP);
    }
  }

  private stepFixed120(h: number): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life += h;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }
      p.prevX = p.x;
      p.prevY = p.y;
      p.vy += p.gravity * h;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx * h;
      p.y += p.vy * h;

      if (p.bounce > 0 && p.y >= p.floorY) {
        p.y = p.floorY;
        p.vy = -Math.abs(p.vy) * p.bounce;
        p.vx *= 0.78;
      }
    }

    for (let i = 0; i < MAX_SLASHES; i++) {
      const s = this.slashes[i];
      if (!s.active) continue;
      s.elapsed += h;
      if (s.elapsed >= s.duration) s.active = false;
    }

    for (let i = 0; i < MAX_RINGS; i++) {
      const r = this.rings[i];
      if (!r.active) continue;
      r.elapsed += h;
      if (r.elapsed >= r.duration) r.active = false;
    }

    for (let i = 0; i < MAX_BOLTS; i++) {
      const b = this.bolts[i];
      if (!b.active) continue;
      b.elapsed += h;
      if (b.elapsed >= b.duration) b.active = false;
    }

    for (let i = 0; i < MAX_GHOSTS; i++) {
      const g = this.ghosts[i];
      if (!g.active) continue;
      g.elapsed += h;
      if (g.elapsed >= g.duration) g.active = false;
    }

    for (let i = 0; i < MAX_POPUPS; i++) {
      const pop = this.popups[i];
      if (!pop.active) continue;
      pop.elapsed += h;
      if (pop.elapsed >= pop.duration) {
        pop.active = false;
        continue;
      }
      pop.x += pop.vx * h;
      pop.y += pop.vy * h;
      pop.vy += 85 * h;
    }
  }

  // --- Render Zero-Texture `patch-gg/pixelfx` Procedural Pixel Effects ---

  public renderEffects(): void {
    // 1. Procedural PixelFX Shockwave Rings & Dimension-Cut Spatial Rifts
    for (let i = 0; i < MAX_RINGS; i++) {
      const ring = this.rings[i];
      if (!ring.active) continue;
      renderPfxRing(this, ring, seededRand);
    }

    // 2. Procedural PixelFX Multi-Band Katana Crescent, Spin, Lance & Void Slashes
    for (let i = 0; i < MAX_SLASHES; i++) {
      const s = this.slashes[i];
      if (!s.active) continue;
      renderPfxSlash(this, s);
    }

    // 3. Procedural PixelFX Jagged Astral Lightning & Sky-Pillar Spears (`星术`)
    for (let i = 0; i < MAX_BOLTS; i++) {
      const b = this.bolts[i];
      if (!b.active) continue;
      renderPfxBolt(this, b);
    }

    // 4. Simulated 120Hz Procedural PixelFX Particles (Bresenham Sparks, Bayer Smoke, Pixel Petals)
    renderPfxParticles(this, this.particles, (idx) => idx % 3 === 0 && this.lightCount < 72);

    // 4. Crisp 8x HD Floating Pixel Damage & Heal Numerals
    for (let i = 0; i < MAX_POPUPS; i++) {
      const pop = this.popups[i];
      if (!pop.active) continue;
      const fade = 1 - pop.elapsed / pop.duration;
      if (fade <= 0.08) continue;
      this.drawPixelString(pop.text, pop.x, pop.y, pop.r, pop.g, pop.b);
    }
  }

  private drawPixelString(text: string, wx: number, wy: number, r: number, g: number, b: number): void {
    const texelPx = 2;
    const charAdv = 8 * texelPx;
    const totalW = text.length * charAdv - texelPx;
    let cursorX = this.sx(wx) - (totalW >> 1);
    const baseY = this.sy(wy);

    for (let i = 0; i < text.length; i++) {
      const glyph = HD_PIXEL_GLYPHS[text[i]];
      if (glyph) {
        this.ctx.fillStyle = 'rgb(7,9,20)';
        for (let row = 0; row < 10; row++) {
          const bits = glyph[row];
          if (!bits) continue;
          const py = baseY + row * texelPx;
          for (let col = 0; col < 7; col++) {
            if ((bits >> (6 - col)) & 1) {
              const px = cursorX + col * texelPx;
              this.ctx.fillRect(px - 1, py - 1, texelPx + 2, texelPx + 2);
            }
          }
        }
        for (let row = 0; row < 10; row++) {
          const bits = glyph[row];
          if (!bits) continue;
          const py = baseY + row * texelPx;
          this.ctx.fillStyle =
            row < 3
              ? `rgb(${Math.min(255, r + 40)},${Math.min(255, g + 40)},${Math.min(255, b + 40)})`
              : `rgb(${r | 0},${g | 0},${b | 0})`;
          for (let col = 0; col < 7; col++) {
            if ((bits >> (6 - col)) & 1) {
              const px = cursorX + col * texelPx;
              this.ctx.fillRect(px, py, texelPx, texelPx);
            }
          }
        }
      }
      cursorX += charAdv;
    }
  }


  public present(ctx: CanvasRenderingContext2D): void {
    const hasTint = this.witchTimeTint > 0.01;
    const hasFlash = this.screenFlash > 0.01;
    if (this.lightCount === 0 && !hasTint && !hasFlash) return;

    let sx = 0;
    let sy = 0;
    let sw = LIGHTMAP_WIDTH;
    let sh = LIGHTMAP_HEIGHT;

    if (!hasTint && !hasFlash) {
      let minX = LIGHTMAP_WIDTH;
      let minY = LIGHTMAP_HEIGHT;
      let maxX = 0;
      let maxY = 0;

      for (let i = 0; i < this.lightCount; i++) {
        const l = this.lights[i];
        const lMinX = (l.lx - l.radWorld) * LIGHTMAP_SCALE;
        const lMinY = (l.ly - l.radWorld) * LIGHTMAP_SCALE;
        const lMaxX = (l.lx + l.radWorld) * LIGHTMAP_SCALE;
        const lMaxY = (l.ly + l.radWorld) * LIGHTMAP_SCALE;
        if (lMinX < minX) minX = lMinX;
        if (lMinY < minY) minY = lMinY;
        if (lMaxX > maxX) maxX = lMaxX;
        if (lMaxY > maxY) maxY = lMaxY;
      }

      sx = Math.max(0, Math.floor(minX));
      sy = Math.max(0, Math.floor(minY));
      sw = Math.min(LIGHTMAP_WIDTH - sx, Math.ceil(maxX) - sx);
      sh = Math.min(LIGHTMAP_HEIGHT - sy, Math.ceil(maxY) - sy);
      if (sw <= 0 || sh <= 0) return;
    }

    const lctx = this.lightCtx;
    lctx.globalCompositeOperation = 'source-over';
    lctx.globalAlpha = 1;

    if (hasTint || hasFlash) {
      let baseR = 0;
      let baseG = 0;
      let baseB = 0;
      if (hasTint) {
        const ta = this.witchTimeTint * 0.28;
        baseR += 38 * ta;
        baseG += 76 * ta;
        baseB += 142 * ta;
      }
      if (hasFlash) {
        const fa = Math.min(0.85, this.screenFlash);
        baseR += this.screenFlashColor.r * fa;
        baseG += this.screenFlashColor.g * fa;
        baseB += this.screenFlashColor.b * fa;
      }
      lctx.fillStyle = `rgb(${Math.min(255, Math.round(baseR))},${Math.min(255, Math.round(baseG))},${Math.min(255, Math.round(baseB))})`;
    } else {
      lctx.fillStyle = '#000000';
    }
    lctx.fillRect(sx, sy, sw, sh);

    if (this.lightCount > 0) {
      lctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < this.lightCount; i++) {
        const l = this.lights[i];
        const maxCh = Math.max(l.r, l.g, l.b);
        if (maxCh <= 1) continue;
        const stamp = this.getRadialLightStamp(l.r, l.g, l.b);
        lctx.globalAlpha = Math.min(1, maxCh / 255);
        const radLm = l.radWorld * LIGHTMAP_SCALE;
        lctx.drawImage(
          stamp,
          l.lx * LIGHTMAP_SCALE - radLm,
          l.ly * LIGHTMAP_SCALE - radLm,
          radLm * 2,
          radLm * 2
        );
      }
      lctx.globalAlpha = 1;
    }

    const upscale = PIXEL_SCALE / LIGHTMAP_SCALE;
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.lightCanvas,
      sx,
      sy,
      sw,
      sh,
      Math.round(sx * upscale),
      Math.round(sy * upscale),
      Math.round(sw * upscale),
      Math.round(sh * upscale)
    );
    ctx.globalCompositeOperation = 'source-over';
  }
}
