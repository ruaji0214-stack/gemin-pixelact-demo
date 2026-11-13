import dungeonTilesetUrl from '../assets/images/pixel_dungeon_tileset_sheet_1794584616590.jpg';
import celestialSealsUrl from '../assets/images/pixel_celestial_and_seals_sheet_1794584926176.jpg';
import caveDecorUrl from '../assets/images/pixel_cave_decor_sheet_1794584619597.jpg';
import weaponsSheetUrl from '../assets/images/pixel_weapons_sheet_1794585470258.jpg';

/**
 * Pure Model-Generated Pixel-Art Atlas Loader & Chroma-Key Extractor
 *
 * Extracts dungeon tiles, castle props, celestial bodies, lockdown portcullis gates,
 * relic emblems, and character/enemy weapons from generated pixel-art sprite sheets.
 * All visual effects (slashes, projectiles, particles, shockwaves, magic circles, flames)
 * are rendered procedurally via `proceduralVfx.ts` (`patch-gg/pixelfx` style) with zero textures.
 */

export type RGBA = readonly [number, number, number, number];

export interface EnemyPartSet {
  weapon: HTMLCanvasElement;
  offhand?: HTMLCanvasElement;
  flash: {
    weapon: HTMLCanvasElement;
    offhand?: HTMLCanvasElement;
  };
}

export interface PixelTextureAtlas {
  ready: boolean;

  stoneWallTile: HTMLCanvasElement;
  stoneWallCache: WeakMap<CanvasRenderingContext2D, CanvasPattern>;
  stoneWallCrimsonTile: HTMLCanvasElement;
  stoneWallCrimsonCache: WeakMap<CanvasRenderingContext2D, CanvasPattern>;
  stoneWallCryptTile: HTMLCanvasElement;
  stoneWallCryptCache: WeakMap<CanvasRenderingContext2D, CanvasPattern>;

  stoneCorniceTile: HTMLCanvasElement;
  stoneCorniceCache: WeakMap<CanvasRenderingContext2D, CanvasPattern>;
  stoneCorniceCrimsonTile: HTMLCanvasElement;
  stoneCorniceCrimsonCache: WeakMap<CanvasRenderingContext2D, CanvasPattern>;
  stoneCorniceCryptTile: HTMLCanvasElement;
  stoneCorniceCryptCache: WeakMap<CanvasRenderingContext2D, CanvasPattern>;

  balconyTile: HTMLCanvasElement;
  balconyCache: WeakMap<CanvasRenderingContext2D, CanvasPattern>;
  sealWallTile: HTMLCanvasElement;
  sealWallCache: WeakMap<CanvasRenderingContext2D, CanvasPattern>;
  ironChainTile: HTMLCanvasElement;
  ironChainCache: WeakMap<CanvasRenderingContext2D, CanvasPattern>;
  portcullisGate: HTMLCanvasElement;
  portcullisCache: WeakMap<CanvasRenderingContext2D, CanvasPattern>;

  moonSilver: HTMLCanvasElement;
  moonCrimson: HTMLCanvasElement;
  crystalSpike: HTMLCanvasElement;
  shrineAltar: HTMLCanvasElement;
  shrineAltarDim: HTMLCanvasElement;
  shrineSwordLit: HTMLCanvasElement;
  shrineSwordDim: HTMLCanvasElement;
  scrollAltar: HTMLCanvasElement;

  stalactiteCluster: HTMLCanvasElement;
  gothicBookshelf: HTMLCanvasElement;
  candelabraProp: HTMLCanvasElement;
  relicEmblem: HTMLCanvasElement;

  aria: {
    scabbard: HTMLCanvasElement;
    katana: HTMLCanvasElement;
    katanaFlash: HTMLCanvasElement;
  };

  stalker: EnemyPartSet;
  weaver: EnemyPartSet;
  halberdier: EnemyPartSet;
  reaper: EnemyPartSet;
  arbalist: EnemyPartSet;
  warden: EnemyPartSet;
  archon: EnemyPartSet;
  sovereign: EnemyPartSet;
}

function createCanvas(w: number, h: number): HTMLCanvasElement {
  if (typeof document === 'undefined') {
    return { width: w, height: h } as HTMLCanvasElement;
  }
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return cv;
}

/**
 * Chroma-keys pure `#00FF00` green-screen pixels and neutralizes green spill on anti-aliased edges
 * while preserving cyan/teal magic flames (`b >= g * 0.62`).
 */
function decodeChromaKeySheet(img: HTMLImageElement, preserveCyan = true): HTMLCanvasElement {
  const maxWorkingH = 448;
  const scale = img.naturalHeight > maxWorkingH ? maxWorkingH / img.naturalHeight : 1;
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const cv = createCanvas(w, h);
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];

    if (preserveCyan && b >= 110 && b >= g * 0.68) {
      continue;
    }

    const maxRB = r > b ? r : b;
    const greenExcess = g - maxRB;

    if (
      (g > 110 && greenExcess > 34 && r < 150 && b < 150) ||
      (g > 44 && greenExcess > 20 && r < 95 && b < 95) ||
      greenExcess > 40
    ) {
      d[i + 3] = 0;
      continue;
    }

    if (greenExcess > 5) {
      d[i + 1] = Math.round(r * 0.45 + b * 0.55);
    }
  }

  // 1-pass 4-neighbor boundary peel for dark green JPEG block edges around wrought iron
  const origAlpha = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    origAlpha[p] = d[(p << 2) + 3];
  }
  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    for (let x = 1; x < w - 1; x++) {
      const p = row + x;
      if (origAlpha[p] === 0) continue;
      if (
        origAlpha[p - 1] === 0 ||
        origAlpha[p + 1] === 0 ||
        origAlpha[p - w] === 0 ||
        origAlpha[p + w] === 0
      ) {
        const i = p << 2;
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        if (preserveCyan && b >= 115) continue;
        if (g >= Math.max(r, b) && r < 55 && b < 55) {
          d[i + 3] = 0;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return cv;
}

interface NormBox {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

/**
 * Tightly crops the non-transparent bounding box inside `[u0..u1, v0..v1]` of a chroma-keyed sheet.
 */
function extractTrimmedRegion(
  keyedSheet: HTMLCanvasElement,
  box: NormBox
): HTMLCanvasElement {
  const sw = keyedSheet.width;
  const sh = keyedSheet.height;
  const x0 = Math.max(0, Math.floor(box.u0 * sw));
  const y0 = Math.max(0, Math.floor(box.v0 * sh));
  const rw = Math.max(1, Math.ceil((box.u1 - box.u0) * sw));
  const rh = Math.max(1, Math.ceil((box.v1 - box.v0) * sh));

  const sctx = keyedSheet.getContext('2d', { willReadFrequently: true })!;
  const sub = sctx.getImageData(x0, y0, Math.min(rw, sw - x0), Math.min(rh, sh - y0));
  const sd = sub.data;
  const w = sub.width;
  const h = sub.height;

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (sd[((y * w + x) << 2) + 3] > 32) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return createCanvas(4, 4);
  }

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const out = createCanvas(cw, ch);
  const octx = out.getContext('2d', { willReadFrequently: true })!;
  octx.imageSmoothingEnabled = false;
  octx.drawImage(keyedSheet, x0 + minX, y0 + minY, cw, ch, 0, 0, cw, ch);
  return out;
}

/**
 * Rotates a trimmed region by `angleRad`, re-trims transparent padding, and stamps it cleanly
 * into `targetCanvas` with optional horizontal flip or fit-to-box scaling.
 */
function bakeRotatedIntoTarget(
  targetCanvas: HTMLCanvasElement,
  trimmedSrc: HTMLCanvasElement,
  angleRad = 0,
  opts?: {
    flipX?: boolean;
    padLeft?: number;
    fillMode?: 'contain' | 'stretch' | 'leftAlignedWeapon';
  }
): void {
  const diag = Math.ceil(Math.hypot(trimmedSrc.width, trimmedSrc.height)) + 8;
  const rotCv = createCanvas(diag, diag);
  const rctx = rotCv.getContext('2d', { willReadFrequently: true })!;
  rctx.imageSmoothingEnabled = false;
  rctx.save();
  rctx.translate(diag * 0.5, diag * 0.5);
  if (opts?.flipX) {
    rctx.scale(-1, 1);
  }
  if (Math.abs(angleRad) > 1e-4) {
    rctx.rotate(angleRad);
  }
  rctx.drawImage(trimmedSrc, -trimmedSrc.width * 0.5, -trimmedSrc.height * 0.5);
  rctx.restore();

  const finalTrim = extractTrimmedRegion(rotCv, { u0: 0, v0: 0, u1: 1, v1: 1 });
  const dstW = targetCanvas.width;
  const dstH = targetCanvas.height;
  const dctx = targetCanvas.getContext('2d')!;
  dctx.clearRect(0, 0, dstW, dstH);
  dctx.imageSmoothingEnabled = false;

  const mode = opts?.fillMode ?? 'contain';
  if (mode === 'stretch') {
    dctx.drawImage(finalTrim, 0, 0, dstW, dstH);
    return;
  }

  if (mode === 'leftAlignedWeapon') {
    const padL = opts?.padLeft ?? 2;
    const availW = Math.max(8, dstW - padL - 2);
    const availH = Math.max(6, dstH - 2);
    const scale = Math.min(availW / finalTrim.width, availH / finalTrim.height);
    const drawW = Math.max(1, Math.round(finalTrim.width * scale));
    const drawH = Math.max(1, Math.round(finalTrim.height * scale));
    const dy = Math.round((dstH - drawH) * 0.5);
    dctx.drawImage(finalTrim, 0, 0, finalTrim.width, finalTrim.height, padL, dy, drawW, drawH);
    return;
  }

  const scale = Math.min((dstW - 2) / finalTrim.width, (dstH - 2) / finalTrim.height);
  const drawW = Math.max(1, Math.round(finalTrim.width * scale));
  const drawH = Math.max(1, Math.round(finalTrim.height * scale));
  const dx = Math.round((dstW - drawW) * 0.5);
  const dy = Math.round((dstH - drawH) * 0.5);
  dctx.drawImage(finalTrim, 0, 0, finalTrim.width, finalTrim.height, dx, dy, drawW, drawH);
}

function writeFlashVariantInPlace(
  src: HTMLCanvasElement,
  dst: HTMLCanvasElement,
  tint: RGBA = [255, 255, 255, 255]
): void {
  if (typeof document === 'undefined') return;
  dst.width = src.width;
  dst.height = src.height;
  const dctx = dst.getContext('2d')!;
  dctx.imageSmoothingEnabled = false;
  dctx.clearRect(0, 0, dst.width, dst.height);
  dctx.drawImage(src, 0, 0);
  dctx.globalCompositeOperation = 'source-in';
  dctx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${(tint[3] / 255).toFixed(3)})`;
  dctx.fillRect(0, 0, dst.width, dst.height);
  dctx.globalCompositeOperation = 'source-over';
}

function copyTintedTile(
  src: HTMLCanvasElement,
  dst: HTMLCanvasElement,
  rMul: number,
  gMul: number,
  bMul: number,
  rAdd = 0,
  gAdd = 0,
  bAdd = 0
): void {
  if (typeof document === 'undefined') return;
  const scratch = createCanvas(src.width, src.height);
  const sctx = scratch.getContext('2d', { willReadFrequently: true })!;
  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(src, 0, 0);
  const img = sctx.getImageData(0, 0, src.width, src.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    d[i] = Math.max(0, Math.min(255, Math.round(d[i] * rMul + rAdd)));
    d[i + 1] = Math.max(0, Math.min(255, Math.round(d[i + 1] * gMul + gAdd)));
    d[i + 2] = Math.max(0, Math.min(255, Math.round(d[i + 2] * bMul + bAdd)));
  }
  const dctx = dst.getContext('2d')!;
  dctx.putImageData(img, 0, 0);
}

const atlasDecodeQueue: Array<() => void> = [];
let atlasDecodeScheduled = false;

function scheduleAtlasDecode(): void {
  if (atlasDecodeScheduled || atlasDecodeQueue.length === 0) return;
  atlasDecodeScheduled = true;
  setTimeout(() => {
    atlasDecodeScheduled = false;
    const job = atlasDecodeQueue.shift();
    if (job) job();
    if (atlasDecodeQueue.length > 0) {
      scheduleAtlasDecode();
    }
  }, 6);
}

function loadSheetAsync(
  url: string,
  onDecode: (img: HTMLImageElement) => void,
  immediate = false
): void {
  if (typeof Image === 'undefined') return;
  const attempt = (retry: number) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        if (immediate) {
          onDecode(img);
        } else {
          atlasDecodeQueue.push(() => onDecode(img));
          scheduleAtlasDecode();
        }
      }
    };
    img.onerror = () => {
      if (retry < 3) {
        setTimeout(() => attempt(retry + 1), 600 * (retry + 1));
      }
    };
    img.src = url;
  };
  attempt(0);
}

function makeEmptyEnemySet(w: number, h: number, offW?: number, offH?: number): EnemyPartSet {
  const weapon = createCanvas(w, h);
  const weaponFlash = createCanvas(w, h);
  if (offW && offH) {
    const offhand = createCanvas(offW, offH);
    const offhandFlash = createCanvas(offW, offH);
    return {
      weapon,
      offhand,
      flash: { weapon: weaponFlash, offhand: offhandFlash },
    };
  }
  return {
    weapon,
    flash: { weapon: weaponFlash },
  };
}

let cachedAtlas: PixelTextureAtlas | null = null;

export function getPixelAtlas(): PixelTextureAtlas {
  if (cachedAtlas) return cachedAtlas;

  const atlas: PixelTextureAtlas = {
    ready: false,

    stoneWallTile: createCanvas(128, 128),
    stoneWallCache: new WeakMap(),
    stoneWallCrimsonTile: createCanvas(128, 128),
    stoneWallCrimsonCache: new WeakMap(),
    stoneWallCryptTile: createCanvas(128, 128),
    stoneWallCryptCache: new WeakMap(),

    stoneCorniceTile: createCanvas(128, 24),
    stoneCorniceCache: new WeakMap(),
    stoneCorniceCrimsonTile: createCanvas(128, 24),
    stoneCorniceCrimsonCache: new WeakMap(),
    stoneCorniceCryptTile: createCanvas(128, 24),
    stoneCorniceCryptCache: new WeakMap(),

    balconyTile: createCanvas(64, 28),
    balconyCache: new WeakMap(),
    sealWallTile: createCanvas(32, 64),
    sealWallCache: new WeakMap(),
    ironChainTile: createCanvas(14, 64),
    ironChainCache: new WeakMap(),
    portcullisGate: createCanvas(64, 160),
    portcullisCache: new WeakMap(),

    moonSilver: createCanvas(144, 144),
    moonCrimson: createCanvas(144, 144),
    crystalSpike: createCanvas(32, 48),
    shrineAltar: createCanvas(120, 84),
    shrineAltarDim: createCanvas(120, 84),
    shrineSwordLit: createCanvas(88, 24),
    shrineSwordDim: createCanvas(88, 24),
    scrollAltar: createCanvas(44, 56),

    stalactiteCluster: createCanvas(64, 96),
    gothicBookshelf: createCanvas(88, 124),
    candelabraProp: createCanvas(52, 108),
    relicEmblem: createCanvas(48, 64),

    aria: {
      scabbard: createCanvas(108, 28),
      katana: createCanvas(148, 28),
      katanaFlash: createCanvas(148, 28),
    },

    stalker: makeEmptyEnemySet(84, 24),
    weaver: makeEmptyEnemySet(40, 44),
    halberdier: makeEmptyEnemySet(132, 36, 36, 88),
    reaper: makeEmptyEnemySet(128, 42),
    arbalist: makeEmptyEnemySet(92, 36),
    warden: makeEmptyEnemySet(140, 48, 38, 88),
    archon: makeEmptyEnemySet(128, 40),
    sovereign: makeEmptyEnemySet(148, 40),
  };

  cachedAtlas = atlas;

  if (typeof window !== 'undefined') {
    let loadedSheets = 0;
    const markSheetLoaded = () => {
      loadedSheets += 1;
      if (loadedSheets >= 4) {
        atlas.ready = true;
      }
    };

    // 1. Dungeon Tileset, Portcullis Lockdown Gate, Shrine Altar, Scroll Altar & Crystal Spikes
    loadSheetAsync(
      dungeonTilesetUrl,
      (img) => {
        const keyed = decodeChromaKeySheet(img, true);

        // Extract ashlar masonry blocks from Col 1B and mosaic into seamless 128x128 wall tile
        const brickA = extractTrimmedRegion(keyed, { u0: 0.132, v0: 0.412, u1: 0.226, v1: 0.592 });
        const brickB = extractTrimmedRegion(keyed, { u0: 0.132, v0: 0.788, u1: 0.226, v1: 0.962 });
        const carvedC = extractTrimmedRegion(keyed, { u0: 0.028, v0: 0.412, u1: 0.125, v1: 0.592 });
        const wctx = atlas.stoneWallTile.getContext('2d')!;
        wctx.imageSmoothingEnabled = false;
        // Paint solid dark mortar backdrop behind generated blocks so zero transparent seam ever occurs
        wctx.fillStyle = '#14192d';
        wctx.fillRect(0, 0, 128, 128);
        wctx.drawImage(brickA, 2, 2, Math.max(1, brickA.width - 4), Math.max(1, brickA.height - 4), 0, 0, 64, 64);
        wctx.drawImage(brickB, 2, 2, Math.max(1, brickB.width - 4), Math.max(1, brickB.height - 4), 64, 0, 64, 64);
        wctx.drawImage(brickB, 2, 2, Math.max(1, brickB.width - 4), Math.max(1, brickB.height - 4), 0, 64, 64, 64);
        wctx.drawImage(carvedC, 2, 2, Math.max(1, carvedC.width - 4), Math.max(1, carvedC.height - 4), 64, 64, 64, 64);

        copyTintedTile(atlas.stoneWallTile, atlas.stoneWallCrimsonTile, 1.32, 0.78, 0.96, 14, -2, 6);
        copyTintedTile(atlas.stoneWallTile, atlas.stoneWallCryptTile, 0.76, 1.16, 1.12, -2, 8, 8);
        atlas.stoneWallCache = new WeakMap();
        atlas.stoneWallCrimsonCache = new WeakMap();
        atlas.stoneWallCryptCache = new WeakMap();

        // Top flagstone cornice slab from upper ashlar course
        const cctx = atlas.stoneCorniceTile.getContext('2d')!;
        cctx.imageSmoothingEnabled = false;
        cctx.fillStyle = '#1b223d';
        cctx.fillRect(0, 0, 128, 24);
      cctx.drawImage(
        brickA,
        2,
        0,
        Math.max(1, brickA.width - 4),
        Math.max(1, Math.floor(brickA.height * 0.42)),
        0,
        0,
        64,
        24
      );
      cctx.drawImage(
        brickA,
        2,
        0,
        Math.max(1, brickA.width - 4),
        Math.max(1, Math.floor(brickA.height * 0.42)),
        64,
        0,
        64,
        24
      );
      copyTintedTile(atlas.stoneCorniceTile, atlas.stoneCorniceCrimsonTile, 1.35, 0.82, 0.98, 16, 0, 6);
      copyTintedTile(atlas.stoneCorniceTile, atlas.stoneCorniceCryptTile, 0.80, 1.20, 1.16, 0, 10, 10);
      atlas.stoneCorniceCache = new WeakMap();
      atlas.stoneCorniceCrimsonCache = new WeakMap();
      atlas.stoneCorniceCryptCache = new WeakMap();

      // Wrought-iron gothic one-way balcony platform
      const balcony = extractTrimmedRegion(keyed, { u0: 0.256, v0: 0.042, u1: 0.496, v1: 0.282 });
      bakeRotatedIntoTarget(atlas.balconyTile, balcony, 0, { fillMode: 'stretch' });
      atlas.balconyCache = new WeakMap();

      // Spiked Iron Portcullis Lockdown Gate with glowing crimson seal runes
      const gate = extractTrimmedRegion(keyed, { u0: 0.258, v0: 0.312, u1: 0.492, v1: 0.972 });
      bakeRotatedIntoTarget(atlas.portcullisGate, gate, 0, { fillMode: 'stretch' });
      atlas.portcullisCache = new WeakMap();

      // Also populate knight/warden offhand shields from carved iron gate lattice crest
      const shieldCrest = extractTrimmedRegion(keyed, { u0: 0.262, v0: 0.318, u1: 0.488, v1: 0.525 });
      if (atlas.halberdier.offhand && atlas.halberdier.flash.offhand) {
        bakeRotatedIntoTarget(atlas.halberdier.offhand, shieldCrest, 0, { fillMode: 'contain' });
        writeFlashVariantInPlace(atlas.halberdier.offhand, atlas.halberdier.flash.offhand);
      }
      if (atlas.warden.offhand && atlas.warden.flash.offhand) {
        bakeRotatedIntoTarget(atlas.warden.offhand, shieldCrest, 0, { fillMode: 'contain' });
        writeFlashVariantInPlace(atlas.warden.offhand, atlas.warden.flash.offhand);
      }

      // Katana Shrine Altar (Lit & Dim variants) + Floating Katana
      const shrineLit = extractTrimmedRegion(keyed, { u0: 0.512, v0: 0.082, u1: 0.796, v1: 0.372 });
      const shrineDim = extractTrimmedRegion(keyed, { u0: 0.520, v0: 0.462, u1: 0.792, v1: 0.742 });
      const swordLit = extractTrimmedRegion(keyed, { u0: 0.556, v0: 0.095, u1: 0.752, v1: 0.168 });
      const swordDim = extractTrimmedRegion(keyed, { u0: 0.556, v0: 0.468, u1: 0.752, v1: 0.535 });
      bakeRotatedIntoTarget(atlas.shrineAltar, shrineLit, 0, { fillMode: 'contain' });
      bakeRotatedIntoTarget(atlas.shrineAltarDim, shrineDim, 0, { fillMode: 'contain' });
      bakeRotatedIntoTarget(atlas.shrineSwordLit, swordLit, 0, { fillMode: 'contain' });
      bakeRotatedIntoTarget(atlas.shrineSwordDim, swordDim, 0, { fillMode: 'contain' });

      // Blessing Scroll Altar & Crimson Crystal Hazard Spikes
      const scroll = extractTrimmedRegion(keyed, { u0: 0.822, v0: 0.052, u1: 0.970, v1: 0.432 });
      const spikes = extractTrimmedRegion(keyed, { u0: 0.818, v0: 0.598, u1: 0.976, v1: 0.972 });
      bakeRotatedIntoTarget(atlas.scrollAltar, scroll, 0, { fillMode: 'contain' });
      bakeRotatedIntoTarget(atlas.crystalSpike, spikes, 0, { fillMode: 'contain' });

        markSheetLoaded();
      },
      true
    );

    // 2. Celestial Moons, Runic Obsidian Seal Wall & Relic Crystal
    loadSheetAsync(celestialSealsUrl, (img) => {
      const keyed = decodeChromaKeySheet(img, true);

      const silverMoon = extractTrimmedRegion(keyed, { u0: 0.010, v0: 0.030, u1: 0.252, v1: 0.475 });
      const crimsonMoon = extractTrimmedRegion(keyed, { u0: 0.268, v0: 0.030, u1: 0.512, v1: 0.475 });
      const sealPillar = extractTrimmedRegion(keyed, { u0: 0.565, v0: 0.032, u1: 0.684, v1: 0.968 });
      const relicCrystal = extractTrimmedRegion(keyed, { u0: 0.808, v0: 0.095, u1: 0.902, v1: 0.378 });

      bakeRotatedIntoTarget(atlas.moonSilver, silverMoon, 0, { fillMode: 'contain' });
      bakeRotatedIntoTarget(atlas.moonCrimson, crimsonMoon, 0, { fillMode: 'contain' });
      bakeRotatedIntoTarget(atlas.sealWallTile, sealPillar, 0, { fillMode: 'stretch' });
      atlas.sealWallCache = new WeakMap();

      bakeRotatedIntoTarget(atlas.relicEmblem, relicCrystal, 0, { fillMode: 'contain' });

      markSheetLoaded();
    });

    // 3. Cave Stalactites, Gothic Archive Bookshelf, Soul Candelabra & Hanging Iron Chains
    loadSheetAsync(caveDecorUrl, (img) => {
      const keyed = decodeChromaKeySheet(img, true);

      const stalactites = extractTrimmedRegion(keyed, { u0: 0.008, v0: 0.042, u1: 0.294, v1: 0.880 });
      const bookshelf = extractTrimmedRegion(keyed, { u0: 0.298, v0: 0.042, u1: 0.652, v1: 0.972 });
      const candelabra = extractTrimmedRegion(keyed, { u0: 0.662, v0: 0.062, u1: 0.848, v1: 0.972 });
      const chain = extractTrimmedRegion(keyed, { u0: 0.870, v0: 0.048, u1: 0.916, v1: 0.580 });

      bakeRotatedIntoTarget(atlas.stalactiteCluster, stalactites, 0, { fillMode: 'contain' });
      bakeRotatedIntoTarget(atlas.gothicBookshelf, bookshelf, 0, { fillMode: 'contain' });
      bakeRotatedIntoTarget(atlas.candelabraProp, candelabra, 0, { fillMode: 'contain' });
      bakeRotatedIntoTarget(atlas.ironChainTile, chain, 0, { fillMode: 'stretch' });
      atlas.ironChainCache = new WeakMap();

      markSheetLoaded();
    });

    // 4. Generated Pixel Weapons Sheet (Aria Katana, Scabbard, and All Enemy/Boss Weapons)
    loadSheetAsync(weaponsSheetUrl, (img) => {
      const keyed = decodeChromaKeySheet(img, true);

      const katanaSrc = extractTrimmedRegion(keyed, { u0: 0.010, v0: 0.022, u1: 0.242, v1: 0.475 });
      bakeRotatedIntoTarget(atlas.aria.katana, katanaSrc, Math.PI * 0.25, {
        fillMode: 'leftAlignedWeapon',
        padLeft: 2,
      });
      writeFlashVariantInPlace(atlas.aria.katana, atlas.aria.katanaFlash);

      const scabbardSrc = extractTrimmedRegion(keyed, { u0: 0.252, v0: 0.035, u1: 0.478, v1: 0.460 });
      bakeRotatedIntoTarget(atlas.aria.scabbard, scabbardSrc, -Math.PI * 0.75, {
        fillMode: 'leftAlignedWeapon',
        padLeft: 2,
      });

      const kukriSrc = extractTrimmedRegion(keyed, { u0: 0.518, v0: 0.032, u1: 0.618, v1: 0.460 });
      bakeRotatedIntoTarget(atlas.stalker.weapon, kukriSrc, 1.24, {
        fillMode: 'leftAlignedWeapon',
        padLeft: 2,
      });
      writeFlashVariantInPlace(atlas.stalker.weapon, atlas.stalker.flash.weapon);

      const tomeSrc = extractTrimmedRegion(keyed, { u0: 0.622, v0: 0.132, u1: 0.716, v1: 0.372 });
      bakeRotatedIntoTarget(atlas.weaver.weapon, tomeSrc, 0, { fillMode: 'contain' });
      writeFlashVariantInPlace(atlas.weaver.weapon, atlas.weaver.flash.weapon);

      const halberdSrc = extractTrimmedRegion(keyed, { u0: 0.745, v0: 0.025, u1: 0.988, v1: 0.470 });
      bakeRotatedIntoTarget(atlas.halberdier.weapon, halberdSrc, Math.PI * 0.25, {
        fillMode: 'leftAlignedWeapon',
        padLeft: 4,
      });
      writeFlashVariantInPlace(atlas.halberdier.weapon, atlas.halberdier.flash.weapon);

      const scytheSrc = extractTrimmedRegion(keyed, { u0: 0.010, v0: 0.520, u1: 0.244, v1: 0.972 });
      bakeRotatedIntoTarget(atlas.reaper.weapon, scytheSrc, Math.PI * 0.25, {
        fillMode: 'leftAlignedWeapon',
        padLeft: 4,
      });
      writeFlashVariantInPlace(atlas.reaper.weapon, atlas.reaper.flash.weapon);

      const crossbowSrc = extractTrimmedRegion(keyed, { u0: 0.260, v0: 0.595, u1: 0.494, v1: 0.885 });
      bakeRotatedIntoTarget(atlas.arbalist.weapon, crossbowSrc, 0.31, {
        fillMode: 'leftAlignedWeapon',
        padLeft: 3,
      });
      writeFlashVariantInPlace(atlas.arbalist.weapon, atlas.arbalist.flash.weapon);

      const greataxeSrc = extractTrimmedRegion(keyed, { u0: 0.506, v0: 0.520, u1: 0.740, v1: 0.955 });
      bakeRotatedIntoTarget(atlas.warden.weapon, greataxeSrc, Math.PI * 0.25, {
        fillMode: 'leftAlignedWeapon',
        padLeft: 4,
      });
      writeFlashVariantInPlace(atlas.warden.weapon, atlas.warden.flash.weapon);

      const greatswordSrc = extractTrimmedRegion(keyed, { u0: 0.756, v0: 0.530, u1: 0.988, v1: 0.960 });
      bakeRotatedIntoTarget(atlas.sovereign.weapon, greatswordSrc, Math.PI * 0.25, {
        fillMode: 'leftAlignedWeapon',
        padLeft: 3,
      });
      writeFlashVariantInPlace(atlas.sovereign.weapon, atlas.sovereign.flash.weapon);

      // Archon scepter uses the ornate gilded polearm from the generated weapons sheet
      bakeRotatedIntoTarget(atlas.archon.weapon, halberdSrc, Math.PI * 0.25, {
        fillMode: 'leftAlignedWeapon',
        padLeft: 4,
      });
      copyTintedTile(atlas.archon.weapon, atlas.archon.weapon, 1.18, 0.96, 1.32, 18, 4, 28);
      writeFlashVariantInPlace(atlas.archon.weapon, atlas.archon.flash.weapon);

      markSheetLoaded();
    });
  }

  return atlas;
}
