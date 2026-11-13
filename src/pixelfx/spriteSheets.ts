import {
  AriaClipId,
  EnemyClipId,
  computeAriaPelvisSpineAnchorX,
  computeClipFrameIndex,
  computeClipFrameSubSample,
} from '../game/animClips';
import ariaLocoUrl from '../assets/images/aria_locomotion_sheet_1794493765047.webp';
import ariaLocoJpgUrl from '../assets/images/aria_locomotion_sheet_1794493765047.jpg';
import ariaRunAUrl from '../assets/images/aria_run_stride_a_v2_1794517335940.webp';
import ariaRunAJpgUrl from '../assets/images/aria_run_stride_a_v2_1794517335940.jpg';
import ariaRunBUrl from '../assets/images/aria_run_stride_b_v2_1794517337013.webp';
import ariaRunBJpgUrl from '../assets/images/aria_run_stride_b_v2_1794517337013.jpg';
import ariaRunMidUrl from '../assets/images/aria_run_inbetweens_v2_1794517953196.webp';
import ariaRunMidJpgUrl from '../assets/images/aria_run_inbetweens_v2_1794517953196.jpg';
import ariaCrouchUrl from '../assets/images/aria_crouch_sheet_1794497928705.webp';
import ariaCrouchJpgUrl from '../assets/images/aria_crouch_sheet_1794497928705.jpg';
import ariaStancesUrl from '../assets/images/aria_ground_stances_sheet_1794496115261.webp';
import ariaStancesJpgUrl from '../assets/images/aria_ground_stances_sheet_1794496115261.jpg';
import ariaAerialUrl from '../assets/images/aria_aerial_dash_sheet_1794496118374.webp';
import ariaAerialJpgUrl from '../assets/images/aria_aerial_dash_sheet_1794496118374.jpg';
import ariaComboUrl from '../assets/images/aria_combo_slashes_sheet_1794496122608.webp';
import ariaComboJpgUrl from '../assets/images/aria_combo_slashes_sheet_1794496122608.jpg';
import ariaSpecialUrl from '../assets/images/aria_special_skills_sheet_1794496128788.webp';
import ariaSpecialJpgUrl from '../assets/images/aria_special_skills_sheet_1794496128788.jpg';
import ariaHeavyUrl from '../assets/images/aria_heavy_air_iaido_sheet_1794496128234.webp';
import ariaHeavyJpgUrl from '../assets/images/aria_heavy_air_iaido_sheet_1794496128234.jpg';
import ariaSlash12Url from '../assets/images/aria_slash12_transitions_1794515080021.webp';
import ariaSlash12JpgUrl from '../assets/images/aria_slash12_transitions_1794515080021.jpg';
import ariaSpinCleaveUrl from '../assets/images/aria_spin_cleave_1794515085823.webp';
import ariaSpinCleaveJpgUrl from '../assets/images/aria_spin_cleave_1794515085823.jpg';
import ariaIaidoCounterUrl from '../assets/images/aria_iaido_counter_1794515086882.webp';
import ariaIaidoCounterJpgUrl from '../assets/images/aria_iaido_counter_1794515086882.jpg';
import ariaAerialPlungeUrl from '../assets/images/aria_aerial_plunge_1794515090794.webp';
import ariaAerialPlungeJpgUrl from '../assets/images/aria_aerial_plunge_1794515090794.jpg';
import ariaTransGuardUrl from '../assets/images/aria_transitions_guard_1794515092337.webp';
import ariaTransGuardJpgUrl from '../assets/images/aria_transitions_guard_1794515092337.jpg';
import ariaCrimsonAUrl from '../assets/images/aria_crimson_slash_a_1794540453834.webp';
import ariaCrimsonAJpgUrl from '../assets/images/aria_crimson_slash_a_1794540453834.jpg';
import ariaCrimsonBUrl from '../assets/images/aria_crimson_slash_b_1794540454009.webp';
import ariaCrimsonBJpgUrl from '../assets/images/aria_crimson_slash_b_1794540454009.jpg';
import ariaAstralAUrl from '../assets/images/aria_astral_slash_a_1794603844987.jpg';
import ariaAstralBUrl from '../assets/images/aria_astral_slash_b_1794603846660.jpg';
import ariaLunarHeavyUrl from '../assets/images/aria_lunar_heavy_v3_1794604970302.jpg';
import ariaLunarDimUrl from '../assets/images/aria_lunar_dimension_v3_1794604970573.jpg';
import stalkerWeaverUrl from '../assets/images/enemies_stalker_weaver_sheet_1794493769427.webp';
import stalkerWeaverJpgUrl from '../assets/images/enemies_stalker_weaver_sheet_1794493769427.jpg';
import halberdierUrl from '../assets/images/enemy_halberdier_sheet_1794493771681.webp';
import halberdierJpgUrl from '../assets/images/enemy_halberdier_sheet_1794493771681.jpg';
import sovereignUrl from '../assets/images/boss_sovereign_sheet_1794493772056.webp';
import sovereignJpgUrl from '../assets/images/boss_sovereign_sheet_1794493772056.jpg';
import roguelikeEnemiesUrl from '../assets/images/enemies_roguelike_expansion_sheet_1794505082670.webp';
import roguelikeEnemiesJpgUrl from '../assets/images/enemies_roguelike_expansion_sheet_1794505082670.jpg';
import bgMoonlitUrl from '../assets/images/bg_moonlit_cathedral_parallax_1794499964896.webp';
import bgMoonlitJpgUrl from '../assets/images/bg_moonlit_cathedral_parallax_1794499964896.jpg';
import bgCrimsonUrl from '../assets/images/bg_crimson_throne_sanctum_1794499967183.webp';
import bgCrimsonJpgUrl from '../assets/images/bg_crimson_throne_sanctum_1794499967183.jpg';
import bgCryptUrl from '../assets/images/bg_abyssal_crypt_cavern_1794499970608.webp';
import bgCryptJpgUrl from '../assets/images/bg_abyssal_crypt_cavern_1794499970608.jpg';
import envPropsUrl from '../assets/images/env_gothic_props_sheet_1794499970467.webp';
import envPropsJpgUrl from '../assets/images/env_gothic_props_sheet_1794499970467.jpg';

/**
 * Zero-Deformation Reference-Locked Pixel-Art Sprite Sheet Extractor,
 * Exact Per-Keyframe Hand-Grip Detector & HD Environment Art Bank
 *
 * - STRICT ZERO-DEFORMATION GUARANTEE:
 *   Every character & enemy frame uses ONE uniform `sheetScale` per sheet, 1:1 square texels,
 *   and zero scaling/rotation/shearing at render time.
 * - 100% FRAME-LOCKED WEAPON-TO-HAND ALIGNMENT:
 *   Every `ExtractedSpriteFrame` carries `gripTexX` & `gripTexY` measured directly from the
 *   keyframe's actual peach-skin hand / armored gauntlet pixel cluster (and propagated 1:1
 *   through `makeRigidEchoBreakdownFrame`), locking skeletal weapons onto the character's
 *   drawn hand on every single frame without lag or floating.
 */

const UNIT_TEXEL_WORLD = 0.25;
const WORKING_SHEET_MAX_H = 448;

export interface ExtractedSpriteFrame {
  canvas: HTMLCanvasElement;
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  anchorX: number; // Exact integer texel X corresponding to entity root X
  anchorY: number; // Exact integer texel Y corresponding to entity ground/feet Y
  texelWorldSize: number; // Unified 0.25 world units per texel (1 texel = 1 native 1920x1080 px)
  gripTexX: number; // Exact texel X of main weapon hand grip inside `canvas`
  gripTexY: number; // Exact texel Y of main weapon hand grip inside `canvas`
  restBladeAngle: number; // Natural right-facing local weapon angle (radians) matching this pose's arm
  offhandTexX: number; // Exact texel X of offhand weapon/shield socket inside `canvas`
  offhandTexY: number; // Exact texel Y of offhand weapon/shield socket inside `canvas`
}

export interface SpriteAnimClip {
  frames: ExtractedSpriteFrame[];
}

export type EnemyClipBank = Record<EnemyClipId, SpriteAnimClip>;

export interface CharacterSpriteBank {
  ready: boolean;
  ariaFullyLoaded: boolean;
  ariaClips: Record<AriaClipId, SpriteAnimClip>;
  stalkerClips?: EnemyClipBank;
  weaverClips?: EnemyClipBank;
  halberdierClips?: EnemyClipBank;
  reaperClips?: EnemyClipBank;
  arbalistClips?: EnemyClipBank;
  wardenClips?: EnemyClipBank;
  archonClips?: EnemyClipBank;
  sovereignClips?: EnemyClipBank;
}

export interface EnvironmentArtBank {
  ready: boolean;
  moonlitPanorama: HTMLCanvasElement;
  crimsonPanorama: HTMLCanvasElement;
  cryptPanorama: HTMLCanvasElement;
  stainedGlassPillar: ExtractedSpriteFrame;
  soulChandelier: ExtractedSpriteFrame;
  knightStatue: ExtractedSpriteFrame;
  gothicArchGate: ExtractedSpriteFrame;
}

interface HandGripHint {
  // Normalized [u0, u1, v0, v1] search window inside cropped body bounds [0..1]
  box: readonly [number, number, number, number];
  // Fallback normalized [u, v] hand center inside cropped body bounds
  seed: readonly [number, number];
  mode: 'ariaSkin' | 'opaque' | 'seed';
  restAngle: number;
  offSeed?: readonly [number, number];
}

let bankInstance: CharacterSpriteBank | null = null;
let loadStarted = false;

let envBankInstance: EnvironmentArtBank | null = null;
let envLoadStarted = false;

const flashCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
const cyanGhostCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
const violetGhostCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();

function makeSilhouetteCanvasFromPixels(
  frame: ExtractedSpriteFrame,
  r: number,
  g: number,
  b: number
): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = frame.width;
  cv.height = frame.height;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(frame.width, frame.height);
  const src = frame.pixels;
  const dst = img.data;
  for (let i = 0; i < src.length; i += 4) {
    if (src[i + 3] > 24) {
      const lum = (src[i] * 0.3 + src[i + 1] * 0.5 + src[i + 2] * 0.2) / 255;
      const boost = 0.55 + lum * 0.65;
      dst[i] = Math.min(255, Math.round(r * boost));
      dst[i + 1] = Math.min(255, Math.round(g * boost));
      dst[i + 2] = Math.min(255, Math.round(b * boost));
      dst[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

function makePureFlashCanvasFromPixels(frame: ExtractedSpriteFrame): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = frame.width;
  cv.height = frame.height;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(frame.width, frame.height);
  const src = frame.pixels;
  const dst = img.data;
  for (let i = 0; i < src.length; i += 4) {
    if (src[i + 3] > 24) {
      dst[i] = 255;
      dst[i + 1] = 248;
      dst[i + 2] = 252;
      dst[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

export type SpriteVariant = 'normal' | 'flash' | 'cyanGhost' | 'violetGhost';

export function getVariantCanvas(
  frame: ExtractedSpriteFrame,
  variant: SpriteVariant
): HTMLCanvasElement {
  if (variant === 'normal') return frame.canvas;
  if (variant === 'flash') {
    let cv = flashCache.get(frame.canvas);
    if (!cv) {
      cv = makePureFlashCanvasFromPixels(frame);
      flashCache.set(frame.canvas, cv);
    }
    return cv;
  }
  if (variant === 'cyanGhost') {
    let cv = cyanGhostCache.get(frame.canvas);
    if (!cv) {
      cv = makeSilhouetteCanvasFromPixels(frame, 96, 224, 255);
      cyanGhostCache.set(frame.canvas, cv);
    }
    return cv;
  }
  let cv = violetGhostCache.get(frame.canvas);
  if (!cv) {
    cv = makeSilhouetteCanvasFromPixels(frame, 198, 124, 255);
    violetGhostCache.set(frame.canvas, cv);
  }
  return cv;
}

export interface SmoothFrameSample {
  frame: ExtractedSpriteFrame;
  nextFrame: ExtractedSpriteFrame;
  subT: number;
  nextKeyframe: ExtractedSpriteFrame;
  keyframeSubT: number;
}

export function sampleClipFrame(
  clip: SpriteAnimClip,
  progress01: number,
  loop: boolean
): ExtractedSpriteFrame {
  return clip.frames[computeClipFrameIndex(clip.frames.length, progress01, loop)];
}

export function sampleClipFrameSmooth(
  clip: SpriteAnimClip,
  progress01: number,
  loop: boolean
): SmoothFrameSample {
  const n = clip.frames.length;
  const sub = computeClipFrameSubSample(n, progress01, loop);
  const currFrame = clip.frames[sub.index];
  const immediateNext = clip.frames[sub.nextIndex];

  // Locate next distinct keyframe bitmap so continuous motion-blur cross-dissolve never stalls on 2-slot holds
  let nextKey = immediateNext;
  let keySubT = sub.subT;
  if (currFrame.canvas === immediateNext.canvas && n > 2) {
    // currFrame is the first slot of a 2-slot keyframe hold; look 1 slot further for the next keyframe
    const afterNextIdx = loop ? (sub.nextIndex + 1) % n : Math.min(n - 1, sub.nextIndex + 1);
    nextKey = clip.frames[afterNextIdx];
    keySubT = sub.subT * 0.5;
  } else if ( n > 2 ) {
    const prevIdx = loop ? (sub.index - 1 + n) % n : Math.max(0, sub.index - 1);
    if (clip.frames[prevIdx].canvas === currFrame.canvas) {
      keySubT = 0.5 + sub.subT * 0.5;
    }
  }

  return {
    frame: currFrame,
    nextFrame: immediateNext,
    subT: sub.subT,
    nextKeyframe: nextKey,
    keyframeSubT: keySubT,
  };
}

/**
 * Converts a frame's exact hand-grip texel coordinate into world space at `(wx, wy, facing)`.
 */
export function getFrameGripWorldPos(
  frame: ExtractedSpriteFrame,
  wx: number,
  wy: number,
  facing: 1 | -1
): { x: number; y: number; offX: number; offY: number } {
  const s = frame.texelWorldSize;
  return {
    x: wx + facing * (frame.gripTexX - frame.anchorX) * s,
    y: wy + (frame.gripTexY - frame.anchorY) * s,
    offX: wx + facing * (frame.offhandTexX - frame.anchorX) * s,
    offY: wy + (frame.offhandTexY - frame.anchorY) * s,
  };
}

/**
 * 60 FPS Spine-like Sub-Frame Hand-Grip Spline Interpolation:
 * Smoothly glides the skeletal katana grip between `frame` and `nextFrame` at 60 FPS using
 * cubic smoothstep while clamping within `±2.2` world units of `frame`'s drawn pixel hand
 * so weapon & fist NEVER separate!
 */
export function getInterpolatedGripWorldPos(
  frame: ExtractedSpriteFrame,
  nextFrame: ExtractedSpriteFrame,
  subT: number,
  wx: number,
  wy: number,
  facing: 1 | -1
): { x: number; y: number; offX: number; offY: number; restAngle: number } {
  const g0 = getFrameGripWorldPos(frame, wx, wy, facing);
  const g1 = getFrameGripWorldPos(nextFrame, wx, wy, facing);
  const s = subT * subT * (3 - 2 * subT);

  const dx = Math.max(-2.2, Math.min(2.2, (g1.x - g0.x) * s));
  const dy = Math.max(-2.2, Math.min(2.2, (g1.y - g0.y) * s));
  const doffX = Math.max(-2.2, Math.min(2.2, (g1.offX - g0.offX) * s));
  const doffY = Math.max(-2.2, Math.min(2.2, (g1.offY - g0.offY) * s));

  let angDiff = ((nextFrame.restBladeAngle - frame.restBladeAngle + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (angDiff < -Math.PI) angDiff += Math.PI * 2;

  return {
    x: g0.x + dx,
    y: g0.y + dy,
    offX: g0.offX + doffX,
    offY: g0.offY + doffY,
    restAngle: frame.restBladeAngle + angDiff * s,
  };
}

// --- 1. Fast Nearest-Neighbor #00FF00 Chroma-Keyer + Halo Peel + Despill ---

function chromaKeySheetToImageData(
  imgEl: HTMLImageElement,
  preserveCyanGlow = false,
  maxWorkingH = WORKING_SHEET_MAX_H
): ImageData {
  const rawW = Math.max(64, imgEl.naturalWidth);
  const rawH = Math.max(32, imgEl.naturalHeight);
  const downScale = rawH > maxWorkingH ? maxWorkingH / rawH : 1;
  const w = Math.max(64, Math.round(rawW * downScale));
  const h = Math.max(32, Math.round(rawH * downScale));

  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(imgEl, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const total = w * h;

  const sampleCorner = (cx: number, cy: number): [number, number, number] => {
    const o = (cy * w + cx) << 2;
    return [d[o], d[o + 1], d[o + 2]];
  };
  const c0 = sampleCorner(2, 2);
  const c1 = sampleCorner(w - 3, 2);
  const c2 = sampleCorner(2, h - 3);
  const c3 = sampleCorner(w - 3, h - 3);
  const keyR = (c0[0] + c1[0] + c2[0] + c3[0]) * 0.25;
  const keyG = Math.max(210, (c0[1] + c1[1] + c2[1] + c3[1]) * 0.25);
  const keyB = (c0[2] + c1[2] + c2[2] + c3[2]) * 0.25;

  const alpha = new Uint8Array(total);
  for (let p = 0; p < total; p++) {
    const i = p << 2;
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];

    // Preserve glowing cyan-blue soul-fire / stained glass on architectural props (`b >= 105`)
    if (preserveCyanGlow && b >= 105 && b > r + 28) {
      alpha[p] = 255;
      continue;
    }

    const maxRB = r > b ? r : b;
    const greenExcess = g - maxRB;

    const dr = r - keyR;
    const dg = g - keyG;
    const db = b - keyB;
    const distSq = dr * dr + dg * dg + db * db;

    if (
      distSq < 24500 ||
      (g > 58 && greenExcess > (preserveCyanGlow ? 34 : 20)) ||
      (g > 115 && g > r + 12 && g > b + (preserveCyanGlow ? 28 : 10)) ||
      (g > 165 && g > r + 8 && g > b + (preserveCyanGlow ? 24 : 6))
    ) {
      alpha[p] = 0;
    } else {
      alpha[p] = 255;
    }
  }

  // 1-pass boundary peel on greenish JPEG edge blends
  const nextAlpha = new Uint8Array(alpha);
  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    for (let x = 1; x < w - 1; x++) {
      const p = row + x;
      if (alpha[p] === 0) continue;

      const touchesBg =
        alpha[p - 1] === 0 ||
        alpha[p + 1] === 0 ||
        alpha[p - w] === 0 ||
        alpha[p + w] === 0 ||
        alpha[p - w - 1] === 0 ||
        alpha[p - w + 1] === 0 ||
        alpha[p + w - 1] === 0 ||
        alpha[p + w + 1] === 0;
      if (!touchesBg) continue;

      const i = p << 2;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      if (preserveCyanGlow && b >= 115) continue;
      if ((g > r + 5 && g > b + 3) || (g > 95 && g >= b && g > r - 3)) {
        nextAlpha[p] = 0;
      }
    }
  }
  alpha.set(nextAlpha);

  // Despeckle + global green spill clamp
  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    for (let x = 1; x < w - 1; x++) {
      const p = row + x;
      const i = p << 2;
      if (alpha[p] === 0) {
        d[i + 3] = 0;
        continue;
      }

      let cardNeighbors = 0;
      if (alpha[p - 1] > 0) cardNeighbors++;
      if (alpha[p + 1] > 0) cardNeighbors++;
      if (alpha[p - w] > 0) cardNeighbors++;
      if (alpha[p + w] > 0) cardNeighbors++;
      if (cardNeighbors <= 1) {
        alpha[p] = 0;
        d[i + 3] = 0;
        continue;
      }

      const r = d[i];
      let g = d[i + 1];
      const b = d[i + 2];
      const maxRB = r > b ? r : b;
      if (g > maxRB && !(preserveCyanGlow && b >= 110)) {
        g = Math.round(maxRB * 0.92 + Math.min(r, b) * 0.08);
        d[i + 1] = g;
      }
      d[i + 3] = 255;
    }
  }

  for (let x = 0; x < w; x++) {
    d[(x << 2) + 3] = 0;
    d[(((h - 1) * w + x) << 2) + 3] = 0;
  }
  for (let y = 0; y < h; y++) {
    d[(y * w) << 2 | 3] = 0;
    d[((y * w + (w - 1)) << 2) + 3] = 0;
  }

  return imgData;
}

// --- 2. DP Minimum-Opacity Seam Carving & 8-Connected Component Island Filter ---

function findOptimalSeamPath(
  d: Uint8ClampedArray,
  w: number,
  h: number,
  targetX: number,
  searchRadius: number
): Int32Array {
  const xMin = Math.max(3, Math.floor(targetX - searchRadius));
  const xMax = Math.min(w - 4, Math.ceil(targetX + searchRadius));
  const span = Math.max(1, xMax - xMin + 1);

  const dp = new Float32Array(h * span);
  const back = new Int16Array(h * span);

  for (let s = 0; s < span; s++) {
    const x = xMin + s;
    const opq = d[((2 * w + x) << 2) + 3] > 32 ? 10000 : 0;
    dp[2 * span + s] = opq + Math.abs(x - targetX) * 0.08;
  }

  for (let y = 3; y < h - 2; y++) {
    const prevRow = (y - 1) * span;
    const curRow = y * span;
    for (let s = 0; s < span; s++) {
      const x = xMin + s;
      let cellCost = d[((y * w + x) << 2) + 3] > 32 ? 10000 : 0;
      if (cellCost === 0) {
        if (d[((y * w + x - 1) << 2) + 3] > 32 || d[((y * w + x + 1) << 2) + 3] > 32) {
          cellCost += 6;
        }
      }
      cellCost += Math.abs(x - targetX) * 0.04;

      let bestPrevCost = Infinity;
      let bestPrevS = s;
      const pStart = Math.max(0, s - 3);
      const pEnd = Math.min(span - 1, s + 3);
      for (let ps = pStart; ps <= pEnd; ps++) {
        const stepPenalty = Math.abs(ps - s) * 0.45;
        const c = dp[prevRow + ps] + stepPenalty;
        if (c < bestPrevCost) {
          bestPrevCost = c;
          bestPrevS = ps;
        }
      }

      dp[curRow + s] = bestPrevCost + cellCost;
      back[curRow + s] = bestPrevS;
    }
  }

  const seam = new Int32Array(h);
  let bestEndS = 0;
  let bestEndCost = Infinity;
  const lastRow = (h - 3) * span;
  for (let s = 0; s < span; s++) {
    if (dp[lastRow + s] < bestEndCost) {
      bestEndCost = dp[lastRow + s];
      bestEndS = s;
    }
  }

  let curS = bestEndS;
  for (let y = h - 3; y >= 2; y--) {
    seam[y] = xMin + curS;
    if (y > 2) {
      curS = back[y * span + curS];
    }
  }
  seam[0] = seam[2];
  seam[1] = seam[2];
  seam[h - 2] = seam[h - 3];
  seam[h - 1] = seam[h - 3];
  return seam;
}

function filterMaskedConnectedComponents(
  mask: Uint8Array,
  cellW: number,
  h: number,
  keepWideSubComponents = false
): void {
  const total = cellW * h;
  const labels = new Int32Array(total);
  const queue = new Int32Array(total);
  const compSizes: number[] = [0];
  const compMinX: number[] = [0];
  const compMaxX: number[] = [0];
  const compMinY: number[] = [0];
  const compMaxY: number[] = [0];

  let nextLabel = 1;
  let largestLabel = 0;
  let largestSize = 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 0; x < cellW; x++) {
      const start = y * cellW + x;
      if (mask[start] === 0 || labels[start] !== 0) continue;

      const label = nextLabel++;
      labels[start] = label;
      let head = 0;
      let tail = 0;
      queue[tail++] = start;

      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;

      while (head < tail) {
        const cur = queue[head++];
        const cy = (cur / cellW) | 0;
        const cx = cur - cy * cellW;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        for (let dy = -1; dy <= 1; dy++) {
          const ny = cy + dy;
          if (ny < 1 || ny >= h - 1) continue;
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx;
            if (nx < 0 || nx >= cellW) continue;
            const np = ny * cellW + nx;
            if (mask[np] > 0 && labels[np] === 0) {
              labels[np] = label;
              queue[tail++] = np;
            }
          }
        }
      }

      compSizes[label] = tail;
      compMinX[label] = minX;
      compMaxX[label] = maxX;
      compMinY[label] = minY;
      compMaxY[label] = maxY;

      if (tail > largestSize) {
        largestSize = tail;
        largestLabel = label;
      }
    }
  }

  if (largestSize === 0) return;

  const mainMinX = compMinX[largestLabel];
  const mainMaxX = compMaxX[largestLabel];
  const mainMinY = compMinY[largestLabel];
  const mainMaxY = compMaxY[largestLabel];
  const padX = Math.max(8, Math.round(cellW * (keepWideSubComponents ? 0.18 : 0.08)));
  const padY = Math.max(8, Math.round(h * (keepWideSubComponents ? 0.18 : 0.06)));
  const minKeepPixels = Math.max(8, Math.round(largestSize * (keepWideSubComponents ? 0.003 : 0.008)));

  for (let i = 0; i < total; i++) {
    const lbl = labels[i];
    if (lbl === 0 || lbl === largestLabel) continue;
    const size = compSizes[lbl];
    const nearMain =
      compMaxX[lbl] >= mainMinX - padX &&
      compMinX[lbl] <= mainMaxX + padX &&
      compMaxY[lbl] >= mainMinY - padY &&
      compMinY[lbl] <= mainMaxY + padY;

    if (size < minKeepPixels || !nearMain) {
      mask[i] = 0;
    }
  }
}

// --- 3. Aria Outfit & Hair Palette Harmonizer + Crisp Dark 1px Outline ---

function harmonizeAriaTexel(r: number, g: number, b: number): [number, number, number] {
  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  const sat = maxC - minC;
  const lum = r * 0.299 + g * 0.587 + b * 0.114;

  // Warm peach skin tones -> preserve untouched
  if (r > g + 14 && g >= b - 4 && lum > 115) {
    return [r, g, b];
  }
  // Violet iris accents -> preserve vivid amethyst sparkle
  if (b > g + 22 && r > g + 14 && lum > 60 && lum < 210) {
    return [r, g, b];
  }
  // Ash-silver twin-tails & white lace/corset highlights -> cool moonlit silver-white
  if (sat <= 26 && lum >= 135) {
    const coolR = Math.max(0, Math.min(255, Math.round(lum * 0.96)));
    const coolG = Math.max(0, Math.min(255, Math.round(lum * 0.98)));
    const coolB = Math.max(0, Math.min(255, Math.round(Math.min(255, lum * 1.05 + 5))));
    return [coolR, coolG, coolB];
  }
  // Dark navy gothic puff-sleeve dress & collar ribbons -> unified deep midnight indigo
  if (b >= r + 8 && b >= g + 4 && lum >= 22 && lum < 135) {
    return [
      Math.round(r * 0.92),
      Math.round(g * 0.95),
      Math.min(255, Math.round(b * 1.04 + 2)),
    ];
  }
  return [r, g, b];
}

function applyCrispDarkOutline(imgData: ImageData): void {
  const w = imgData.width;
  const h = imgData.height;
  const d = imgData.data;
  const origAlpha = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    origAlpha[p] = d[(p << 2) + 3];
  }

  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    for (let x = 1; x < w - 1; x++) {
      const p = row + x;
      if (origAlpha[p] === 0) continue;
      const isEdge =
        origAlpha[p - 1] === 0 ||
        origAlpha[p + 1] === 0 ||
        origAlpha[p - w] === 0 ||
        origAlpha[p + w] === 0;
      if (isEdge) {
        const i = p << 2;
        if (d[i] + d[i + 1] + d[i + 2] > 140) {
          d[i] = Math.round(d[i] * 0.34 + 8);
          d[i + 1] = Math.round(d[i + 1] * 0.34 + 10);
          d[i + 2] = Math.round(d[i + 2] * 0.38 + 18);
        }
      }
    }
  }
}

/**
 * Scans the bounded anatomical window `[u0..u1, v0..v1]` of a keyframe's pixel buffer
 * to find the exact centroid `(gripTexX, gripTexY)` of Aria's peach-skin hand cluster
 * (or armored enemy gauntlet), eliminating all weapon-to-arm misalignment!
 */
function locateHandGripTexel(
  dd: Uint8ClampedArray,
  dstW: number,
  dstH: number,
  pad: number,
  dstBodyW: number,
  dstBodyH: number,
  hint: HandGripHint
): { gripTexX: number; gripTexY: number; offhandTexX: number; offhandTexY: number } {
  const fallbackX = Math.round(pad + hint.seed[0] * dstBodyW);
  const fallbackY = Math.round(pad + hint.seed[1] * dstBodyH);
  const offSeed = hint.offSeed ?? [0.35, 0.48];
  const offhandTexX = Math.round(pad + offSeed[0] * dstBodyW);
  const offhandTexY = Math.round(pad + offSeed[1] * dstBodyH);

  if (hint.mode === 'seed') {
    return { gripTexX: fallbackX, gripTexY: fallbackY, offhandTexX, offhandTexY };
  }

  const x0 = Math.max(1, Math.floor(pad + hint.box[0] * dstBodyW));
  const x1 = Math.min(dstW - 2, Math.ceil(pad + hint.box[1] * dstBodyW));
  const y0 = Math.max(1, Math.floor(pad + hint.box[2] * dstBodyH));
  const y1 = Math.min(dstH - 2, Math.ceil(pad + hint.box[3] * dstBodyH));

  let sumX = 0;
  let sumY = 0;
  let weightSum = 0;

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * dstW + x) << 2;
      if (dd[i + 3] < 180) continue;
      const r = dd[i];
      const g = dd[i + 1];
      const b = dd[i + 2];

      if (hint.mode === 'ariaSkin') {
        const lum = r * 0.299 + g * 0.587 + b * 0.114;
        // Aria's warm porcelain-peach hand pixels (excludes dark navy sleeve & cool silver hair/lace)
        if (r > g + 10 && g >= b - 6 && lum > 110) {
          const w = 1 + (r - g) * 0.08;
          sumX += x * w;
          sumY += y * w;
          weightSum += w;
        }
      } else {
        // Armored enemy gauntlet / claw inside isolated hand window
        sumX += x;
        sumY += y;
        weightSum += 1;
      }
    }
  }

  if (weightSum >= 4) {
    return {
      gripTexX: Math.round(sumX / weightSum),
      gripTexY: Math.round(sumY / weightSum),
      offhandTexX,
      offhandTexY,
    };
  }

  return { gripTexX: fallbackX, gripTexY: fallbackY, offhandTexX, offhandTexY };
}

interface PairSheetConfig {
  secondStartIdx: 2;
  secondRefIdx: 2 | 3;
  secondRefWorldHeight: number;
}

const DEFAULT_GRIP_HINTS: [HandGripHint, HandGripHint, HandGripHint, HandGripHint] = [
  { box: [0.4, 0.6, 0.4, 0.6], seed: [0.5, 0.5], mode: 'seed', restAngle: 2.5 },
  { box: [0.4, 0.6, 0.4, 0.6], seed: [0.5, 0.5], mode: 'seed', restAngle: 2.5 },
  { box: [0.4, 0.6, 0.4, 0.6], seed: [0.5, 0.5], mode: 'seed', restAngle: 2.5 },
  { box: [0.4, 0.6, 0.4, 0.6], seed: [0.5, 0.5], mode: 'seed', restAngle: 2.5 },
];

/**
 * Extracts 4 frames from a horizontal sprite sheet using ONE UNIFORM SCALE (`sheetScale`)
 * calibrated from `refIdx` -> `refWorldHeight`, AND detects exact per-frame hand grip texels!
 */
function extractSheetFramesUniform(
  imgEl: HTMLImageElement,
  refIdx: 0 | 1 | 2 | 3,
  refWorldHeight: number,
  footOffsetWorldY: [number, number, number, number] = [0, 0, 0, 0],
  harmonizeAria = false,
  gripHints: [HandGripHint, HandGripHint, HandGripHint, HandGripHint] = DEFAULT_GRIP_HINTS,
  pairConfig?: PairSheetConfig,
  preserveCyanGlow = false,
  extraOpts?: {
    customSeams?: [number, number, number];
    cropBottomRatio?: number;
    perCellWorldHeights?: [number, number, number, number];
  }
): [ExtractedSpriteFrame, ExtractedSpriteFrame, ExtractedSpriteFrame, ExtractedSpriteFrame] {
  const keyed = chromaKeySheetToImageData(imgEl, preserveCyanGlow);
  const w = keyed.width;
  const h = keyed.height;
  const d = keyed.data;

  const searchR = Math.round(w * (extraOpts?.customSeams ? 0.065 : 0.11));
  const [s1Ratio, s2Ratio, s3Ratio] = extraOpts?.customSeams ?? [0.25, 0.5, 0.75];
  const seam1 = findOptimalSeamPath(d, w, h, w * s1Ratio, searchR);
  const seam2 = findOptimalSeamPath(d, w, h, w * s2Ratio, searchR);
  const seam3 = findOptimalSeamPath(d, w, h, w * s3Ratio, searchR);
  const maxMaskY = extraOpts?.cropBottomRatio ? Math.min(h - 2, Math.floor(h * extraOpts.cropBottomRatio)) : h - 2;

  interface CellCropInfo {
    rx0: number;
    cellW: number;
    cellMask: Uint8Array;
    minLX: number;
    minY: number;
    srcCropW: number;
    srcCropH: number;
  }

  const crops: CellCropInfo[] = [];

  for (let idx = 0; idx < 4; idx++) {
    let rx0 = w - 1;
    let rx1 = 0;
    for (let y = 2; y < maxMaskY; y++) {
      const left = idx === 0 ? 2 : idx === 1 ? seam1[y] + 1 : idx === 2 ? seam2[y] + 1 : seam3[y] + 1;
      const right = idx === 0 ? seam1[y] : idx === 1 ? seam2[y] : idx === 2 ? seam3[y] : w - 3;
      if (left < rx0) rx0 = left;
      if (right > rx1) rx1 = right;
    }
    rx0 = Math.max(1, rx0);
    rx1 = Math.min(w - 2, Math.max(rx0 + 4, rx1));
    const cellW = rx1 - rx0 + 1;

    const cellMask = new Uint8Array(cellW * h);
    for (let y = 2; y < maxMaskY; y++) {
      const left = idx === 0 ? 2 : idx === 1 ? seam1[y] + 1 : idx === 2 ? seam2[y] + 1 : seam3[y] + 1;
      const right = idx === 0 ? seam1[y] : idx === 1 ? seam2[y] : idx === 2 ? seam3[y] : w - 3;
      for (let x = left; x <= right; x++) {
        if (d[((y * w + x) << 2) + 3] > 32) {
          cellMask[y * cellW + (x - rx0)] = 1;
        }
      }
    }

    filterMaskedConnectedComponents(cellMask, cellW, h, preserveCyanGlow);

    let minLX = cellW - 1;
    let maxLX = 0;
    let minY = h - 3;
    let maxY = 2;

    for (let y = 2; y < h - 2; y++) {
      const row = y * cellW;
      for (let lx = 0; lx < cellW; lx++) {
        if (cellMask[row + lx]) {
          if (lx < minLX) minLX = lx;
          if (lx > maxLX) maxLX = lx;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxLX <= minLX || maxY <= minY) {
      minLX = 0;
      maxLX = cellW - 1;
      minY = 4;
      maxY = h - 4;
    }

    crops.push({
      rx0,
      cellW,
      cellMask,
      minLX,
      minY,
      srcCropW: maxLX - minLX + 1,
      srcCropH: maxY - minY + 1,
    });
  }

  const primaryRefTexH = Math.round(refWorldHeight / UNIT_TEXEL_WORLD);
  const primaryScale = primaryRefTexH / Math.max(16, crops[refIdx].srcCropH);

  const secondaryScale = pairConfig
    ? Math.round(pairConfig.secondRefWorldHeight / UNIT_TEXEL_WORLD) /
      Math.max(16, crops[pairConfig.secondRefIdx].srcCropH)
    : primaryScale;

  const out: ExtractedSpriteFrame[] = [];

  for (let idx = 0; idx < 4; idx++) {
    const c = crops[idx];
    const perCellScale = extraOpts?.perCellWorldHeights
      ? Math.round(extraOpts.perCellWorldHeights[idx] / UNIT_TEXEL_WORLD) / Math.max(16, c.srcCropH)
      : null;
    const sheetScale =
      perCellScale !== null
        ? perCellScale
        : pairConfig && idx >= pairConfig.secondStartIdx
          ? secondaryScale
          : primaryScale;

    const dstBodyW = Math.max(16, Math.round(c.srcCropW * sheetScale));
    const dstBodyH = Math.max(16, Math.round(c.srcCropH * sheetScale));
    const pad = 3;
    const dstW = dstBodyW + pad * 2;
    const dstH = dstBodyH + pad * 2;

    const frameCv = document.createElement('canvas');
    frameCv.width = dstW;
    frameCv.height = dstH;
    const fctx = frameCv.getContext('2d')!;
    const dstImg = fctx.createImageData(dstW, dstH);
    const dd = dstImg.data;

    for (let dy = 0; dy < dstBodyH; dy++) {
      const sy = c.minY + Math.min(c.srcCropH - 1, Math.floor(((dy + 0.5) / dstBodyH) * c.srcCropH));
      for (let dx = 0; dx < dstBodyW; dx++) {
        const slx = c.minLX + Math.min(c.srcCropW - 1, Math.floor(((dx + 0.5) / dstBodyW) * c.srcCropW));
        if (c.cellMask[sy * c.cellW + slx] === 0) continue;

        const sx = c.rx0 + slx;
        const si = (sy * w + sx) << 2;
        const di = ((dy + pad) * dstW + (dx + pad)) << 2;

        let r = d[si];
        let g = d[si + 1];
        let b = d[si + 2];
        if (harmonizeAria) {
          [r, g, b] = harmonizeAriaTexel(r, g, b);
        }
        dd[di] = r;
        dd[di + 1] = g;
        dd[di + 2] = b;
        dd[di + 3] = 255;
      }
    }

    // Detect exact hand grip centroid BEFORE dark edge outline darkens 1px border skin texels
    const gripInfo = locateHandGripTexel(dd, dstW, dstH, pad, dstBodyW, dstBodyH, gripHints[idx]);

    if (!preserveCyanGlow) {
      applyCrispDarkOutline(dstImg);
    }
    fctx.putImageData(dstImg, 0, 0);

    // Torso/pelvis band X centroid rounded to EXACT integer texel!
    let anchorX: number;
    if (harmonizeAria && !preserveCyanGlow) {
      anchorX = computeAriaPelvisSpineAnchorX(dd, dstW, dstH);
    } else if (preserveCyanGlow) {
      anchorX = Math.round(dstW * 0.5);
    } else {
      const bandY0 = Math.floor(dstH * 0.44);
      const bandY1 = Math.ceil(dstH * 0.72);
      let sumX = 0;
      let countX = 0;
      for (let cy = bandY0; cy < bandY1; cy++) {
        for (let cx = 0; cx < dstW; cx++) {
          if (dd[((cy * dstW + cx) << 2) + 3] > 64) {
            sumX += cx;
            countX++;
          }
        }
      }
      anchorX = Math.round(countX > 6 ? sumX / countX : dstW * 0.5);
    }
    const bootBottomTex = pad + dstBodyH - 1;
    const anchorY = Math.round(bootBottomTex + footOffsetWorldY[idx] / UNIT_TEXEL_WORLD);

    out.push({
      canvas: frameCv,
      pixels: new Uint8ClampedArray(dd),
      width: dstW,
      height: dstH,
      anchorX,
      anchorY,
      texelWorldSize: UNIT_TEXEL_WORLD,
      gripTexX: gripInfo.gripTexX,
      gripTexY: gripInfo.gripTexY,
      restBladeAngle: gripHints[idx].restAngle,
      offhandTexX: gripInfo.offhandTexX,
      offhandTexY: gripInfo.offhandTexY,
    });
  }

  return out as [
    ExtractedSpriteFrame,
    ExtractedSpriteFrame,
    ExtractedSpriteFrame,
    ExtractedSpriteFrame,
  ];
}

// --- 4. Pure Generated Keyframe Clip Sequencer (零代码合成涂抹/偏移帧，100%使用生图/图生视频截帧) ---

/**
 * Locks both `anchorX` and `anchorY` across all running poses to Aria's detected peach-skin
 * face centroid (`faceCenterX - headLeadTexels`, `faceCenterY + faceToGroundTexels + bobUpTexels`).
 *
 * Why this is critical:
 * - Previously, `anchorY` was set to `bootBottomTex` (the lowest boot pixel of each cropped cell).
 *   When Aria's knees bent or lifted into the air during Passing/Flight frames, `srcCropH` shrank
 *   by 14 texels (`28 screen px`), dragging her head and torso downward into the floor!
 * - By locking `anchorY` to `faceCenterY + faceToGroundTexels + bobUpTexels`, Aria's head and
 *   upper body glide on a smooth biomechanical 2-step sine wave (`±1 texel`) while her boots
 *   naturally lift off the ground during Flight/Passing phases and strike the ground on Contact!
 */
function alignAriaRunFrameAnchor(
  frame: ExtractedSpriteFrame,
  headLeadTexels = 5,
  bobUpTexels = 0,
  crownToGroundTexels = 136
): ExtractedSpriteFrame {
  const w = frame.width;
  const h = frame.height;
  const p = frame.pixels;
  const y0 = Math.max(1, Math.floor(h * 0.06));
  const y1 = Math.min(h - 2, Math.ceil(h * 0.28));
  const x0 = Math.floor(w * 0.35);

  let sumX = 0;
  let sumY = 0;
  let weight = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x < w - 1; x++) {
      const i = (y * w + x) << 2;
      if (p[i + 3] < 180) continue;
      const r = p[i];
      const g = p[i + 1];
      const b = p[i + 2];
      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      if (r > g + 10 && g >= b - 6 && lum > 115) {
        sumX += x;
        sumY += y;
        weight += 1;
      }
    }
  }

  const faceX = weight >= 8 ? sumX / weight : frame.anchorX + headLeadTexels;
  const faceY = weight >= 8 ? sumY / weight : Math.max(18, h * 0.2);

  // Locate exact silver-hair head crown directly above `faceX` (ignoring high flying twin-tail tips to the left)
  let crownY = 3;
  const scanX0 = Math.max(1, Math.floor(faceX - 11));
  const scanX1 = Math.min(w - 2, Math.ceil(faceX + 10));
  for (let y = 1; y < faceY; y++) {
    let rowOpaque = 0;
    for (let x = scanX0; x <= scanX1; x++) {
      if (p[((y * w + x) << 2) + 3] > 180) {
        rowOpaque++;
      }
    }
    if (rowOpaque >= 4) {
      crownY = y;
      break;
    }
  }

  const alignedAnchorX = Math.round(faceX) - Math.round(headLeadTexels);
  const alignedAnchorY =
    Math.round(crownY) + Math.round(crownToGroundTexels) + Math.round(bobUpTexels);

  return {
    ...frame,
    anchorX: alignedAnchorX,
    anchorY: alignedAnchorY,
  };
}

/**
 * High-Density 16-Slot Multi-Stage Attack Clip Builder (synced 1:1 with `animClips.ts`):
 * Uses 100% pure extracted generated frames with zero code-constructed smear or offset synthesis.
 * - Windup [0..3]: `entry, entry, coil, coil`
 * - Active [4..9]: `midSwing, midSwing, peak, peak, overswing, overswing`
 * - Recovery [10..15]: `follow, follow, guardSettle, guardSettle, neutralEnd, neutralEnd`
 */
function buildMultiStageAttackClip(
  entry: ExtractedSpriteFrame,
  coil: ExtractedSpriteFrame,
  midSwing: ExtractedSpriteFrame,
  peak: ExtractedSpriteFrame,
  overswing: ExtractedSpriteFrame,
  follow: ExtractedSpriteFrame,
  guardSettle: ExtractedSpriteFrame,
  neutralEnd: ExtractedSpriteFrame
): SpriteAnimClip {
  return {
    frames: [
      entry,
      entry,
      coil,
      coil,
      midSwing,
      midSwing,
      peak,
      peak,
      overswing,
      overswing,
      follow,
      follow,
      guardSettle,
      guardSettle,
      neutralEnd,
      neutralEnd,
    ],
  };
}

function buildPureEnemyClips(
  idle: ExtractedSpriteFrame,
  walk: ExtractedSpriteFrame,
  windup: ExtractedSpriteFrame,
  attack: ExtractedSpriteFrame
): EnemyClipBank {
  return {
    idle: { frames: [idle, idle, walk, idle] },
    walk: { frames: [idle, walk, walk, idle] },
    windup: { frames: [idle, windup, windup, windup] },
    attack: { frames: [windup, attack, attack, attack, idle, idle] },
    hitstun: { frames: [windup, windup, idle, idle] },
  };
}


// --- 5. Resilient Concurrency-Limited Blob Image Loader & 3-Tier Progressive Hot-Swap Bank ---

const MAX_CONCURRENT_IMAGE_LOADS = 4;
let activeImageLoads = 0;
const imageLoadQueue: Array<() => void> = [];

function runWithLoadSlot<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const start = () => {
      activeImageLoads++;
      task()
        .then(resolve, reject)
        .finally(() => {
          activeImageLoads--;
          const next = imageLoadQueue.shift();
          if (next) next();
        });
    };
    if (activeImageLoads < MAX_CONCURRENT_IMAGE_LOADS) {
      start();
    } else {
      imageLoadQueue.push(start);
    }
  });
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadDirectImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve(img);
      } else {
        reject(new Error(`Decoded empty image: ${url}`));
      }
    };
    img.onerror = () => reject(new Error(`Image load error: ${url}`));
    img.src = url;
  });
}

async function fetchAndDecodeSafeBlobImage(url: string): Promise<HTMLImageElement> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 14000) : null;
  try {
    const res = await fetch(url, {
      credentials: 'same-origin',
      signal: controller?.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType && !contentType.startsWith('image/') && !contentType.includes('octet-stream')) {
      throw new Error(`Unexpected content-type "${contentType}" for ${url}`);
    }
    const blob = await res.blob();
    if (blob.size < 64) {
      throw new Error(`Truncated image blob (${blob.size}B) for ${url}`);
    }
    const objUrl = URL.createObjectURL(blob);
    try {
      const img = await loadDirectImageElement(objUrl);
      if (typeof img.decode === 'function') {
        await img.decode().catch(() => {
          // onload already verified naturalWidth > 0
        });
      }
      return img;
    } finally {
      URL.revokeObjectURL(objUrl);
    }
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
  }
}

const extractionQueue: Array<() => void> = [];
let extractionScheduled = false;

function scheduleExtractionDrain(): void {
  if (extractionScheduled || extractionQueue.length === 0) return;
  extractionScheduled = true;
  const runSlice = () => {
    extractionScheduled = false;
    const start = typeof performance !== 'undefined' ? performance.now() : 0;
    while (extractionQueue.length > 0) {
      const job = extractionQueue.shift()!;
      try {
        job();
      } catch (extractErr) {
        console.warn('Sprite extraction warning:', extractErr);
      }
      if (typeof performance !== 'undefined' && performance.now() - start > 4.5) {
        break;
      }
    }
    if (extractionQueue.length > 0) {
      scheduleExtractionDrain();
    }
  };
  if (typeof window !== 'undefined') {
    window.setTimeout(runSlice, 8);
  } else {
    runSlice();
  }
}

async function loadImageResilient(
  primaryUrl: string,
  fallbackUrl: string
): Promise<HTMLImageElement> {
  const backoffSchedule = [0, 300, 850, 1800];
  let lastErr: unknown = null;

  for (let attempt = 0; attempt < backoffSchedule.length; attempt++) {
    if (backoffSchedule[attempt] > 0) {
      await delayMs(backoffSchedule[attempt]);
    }
    const candidateUrl = attempt >= 2 ? fallbackUrl : primaryUrl;
    try {
      return await runWithLoadSlot(async () => {
        try {
          const img = await loadDirectImageElement(candidateUrl);
          if (typeof img.decode === 'function') {
            await img.decode().catch(() => {});
          }
          return img;
        } catch {
          return await fetchAndDecodeSafeBlobImage(candidateUrl);
        }
      });
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr ?? new Error(`Failed loading sprite sheet: ${primaryUrl}`);
}

function loadSheetSelfHealing(
  primaryUrl: string,
  fallbackUrl: string,
  onLoaded: (img: HTMLImageElement) => void,
  immediate = false
): void {
  const attemptLoad = () => {
    loadImageResilient(primaryUrl, fallbackUrl)
      .then((img) => {
        if (immediate) {
          try {
            onLoaded(img);
          } catch (extractErr) {
            console.warn('Sprite extraction warning:', extractErr);
          }
        } else {
          extractionQueue.push(() => onLoaded(img));
          scheduleExtractionDrain();
        }
      })
      .catch((err) => {
        console.warn('Retrying sprite sheet in background:', primaryUrl, err);
        setTimeout(attemptLoad, 2600);
      });
  };
  attemptLoad();
}

type FrameQuad = [
  ExtractedSpriteFrame,
  ExtractedSpriteFrame,
  ExtractedSpriteFrame,
  ExtractedSpriteFrame,
];

interface ProgressiveAriaSheets {
  loco?: FrameQuad;
  runA?: FrameQuad;
  runB?: FrameQuad;
  runMid?: FrameQuad;
  crouch?: FrameQuad;
  stances?: FrameQuad;
  aerial?: FrameQuad;
  combo?: FrameQuad;
  special?: FrameQuad;
  heavy?: FrameQuad;
  slash12?: FrameQuad;
  spinCleave?: FrameQuad;
  iaidoCounter?: FrameQuad;
  aerialPlunge?: FrameQuad;
  transGuard?: FrameQuad;
  crimsonA?: FrameQuad;
  crimsonB?: FrameQuad;
  astralA?: FrameQuad;
  astralB?: FrameQuad;
  lunarHeavy?: FrameQuad;
  lunarDim?: FrameQuad;
}

const ariaExtracted: ProgressiveAriaSheets = {};
let rebuildTimerId: ReturnType<typeof setTimeout> | null = null;

function isAllAriaSheetsLoaded(): boolean {
  return Boolean(
    ariaExtracted.loco &&
      ariaExtracted.runA &&
      ariaExtracted.runB &&
      ariaExtracted.runMid &&
      ariaExtracted.crouch &&
      ariaExtracted.stances &&
      ariaExtracted.aerial &&
      ariaExtracted.combo &&
      ariaExtracted.special &&
      ariaExtracted.heavy &&
      ariaExtracted.slash12 &&
      ariaExtracted.spinCleave &&
      ariaExtracted.iaidoCounter &&
      ariaExtracted.aerialPlunge &&
      ariaExtracted.transGuard &&
      ariaExtracted.crimsonA &&
      ariaExtracted.crimsonB &&
      ariaExtracted.astralA &&
      ariaExtracted.astralB &&
      ariaExtracted.lunarHeavy &&
      ariaExtracted.lunarDim
  );
}

/**
 * Zero-allocation instant bootstrap clip table (`<0.1ms`) used for the first ~60ms after Tier 0 (`loco`)
 * decodes, avoiding redundant canvas passes while the other Aria sheets finish in parallel!
 */
function buildBootstrapAriaClips(loco: FrameQuad): Record<AriaClipId, SpriteAnimClip> {
  const idleClip = { frames: [loco[0], loco[0]] };
  const runClip = { frames: [loco[1], loco[2], loco[3], loco[2]] };
  const actClip = { frames: [loco[0], loco[2], loco[3], loco[1], loco[0]] };
  return {
    idle: idleClip,
    run: runClip,
    crouch: idleClip,
    skid: actClip,
    jump_rise: { frames: [loco[2]] },
    jump_apex: { frames: [loco[2]] },
    jump_fall: { frames: [loco[1]] },
    land: idleClip,
    dash: { frames: [loco[3]] },
    wall_slide: { frames: [loco[2]] },
    hurt: { frames: [loco[0]] },
    zanshin: idleClip,
    slash_1: actClip,
    slash_2: actClip,
    slash_3: actClip,
    slash_4: actClip,
    slide_slash: actClip,
    rising_moon: actClip,
    dash_thrust: actClip,
    moon_counter: actClip,
    astral_slash: actClip,
    air_slash_1: actClip,
    air_slash_2: actClip,
    helm_splitter: actClip,
    heavy_crescent: actClip,
    dimension_cut: actClip,
  };
}

function scheduleRebuildAriaClips(): void {
  const loco = ariaExtracted.loco;
  if (!loco) return;

  if (!bankInstance) {
    bankInstance = {
      ready: true,
      ariaFullyLoaded: false,
      ariaClips: buildBootstrapAriaClips(loco),
      ...pendingEnemyBanks,
    };
  }

  if (isAllAriaSheetsLoaded()) {
    if (rebuildTimerId !== null) {
      clearTimeout(rebuildTimerId);
      rebuildTimerId = null;
    }
    rebuildAriaClipsFromLoaded();
    return;
  }

  if (rebuildTimerId !== null) {
    clearTimeout(rebuildTimerId);
  }
  rebuildTimerId = setTimeout(() => {
    rebuildTimerId = null;
    rebuildAriaClipsFromLoaded();
  }, 55);
}

const pendingEnemyBanks: Partial<
  Pick<
    CharacterSpriteBank,
    | 'stalkerClips'
    | 'weaverClips'
    | 'halberdierClips'
    | 'reaperClips'
    | 'arbalistClips'
    | 'wardenClips'
    | 'archonClips'
    | 'sovereignClips'
  >
> = {};

function rebuildAriaClipsFromLoaded(): void {
  const loco = ariaExtracted.loco;
  if (!loco) return;

  const stances = ariaExtracted.stances ?? [loco[0], loco[1], loco[0], loco[1]];
  const crouchSheet = ariaExtracted.crouch ?? [loco[0], stances[0], loco[2], loco[2]];
  const aerial = ariaExtracted.aerial ?? [loco[2], crouchSheet[3], loco[1], loco[3]];
  const combo = ariaExtracted.combo ?? [loco[3], loco[2], loco[3], loco[1]];
  const special = ariaExtracted.special ?? [crouchSheet[1], aerial[0], loco[3], aerial[2]];
  const heavy = ariaExtracted.heavy ?? [stances[0], aerial[0], combo[1], aerial[2]];

  const slash12 = ariaExtracted.slash12 ?? [heavy[1], combo[0], stances[0], combo[1]];
  const spinCleave = ariaExtracted.spinCleave ?? [combo[2], combo[3], heavy[1], combo[3]];
  const iaidoCounter = ariaExtracted.iaidoCounter ?? [loco[0], heavy[2], stances[2], special[2]];
  const aerialPlunge = ariaExtracted.aerialPlunge ?? [aerial[0], heavy[3], aerial[1], special[3]];
  const transGuard = ariaExtracted.transGuard ?? [crouchSheet[0], stances[0], crouchSheet[1], stances[2]];

  const deepCrouch = crouchSheet[1];
  const airBrace = crouchSheet[3];
  const chudanGuard = transGuard[1];
  const halfCrouchRise = transGuard[2];
  const zanshinFlourish = transGuard[3];

  // Full 16-Frame Video-Referenced 2-Step Biomechanical Sprint Cycle using 100% pure extracted frames
  let runFrames: ExtractedSpriteFrame[];
  if (ariaExtracted.runA && ariaExtracted.runB) {
    const runA = ariaExtracted.runA;
    const runB = ariaExtracted.runB;
    const runMid = ariaExtracted.runMid;

    const f00 = alignAriaRunFrameAnchor(runA[0], 5, 0);
    const f02 = alignAriaRunFrameAnchor(runA[1], 5, -1);
    const f04 = alignAriaRunFrameAnchor(runA[2], 5, 0);
    const f06 = alignAriaRunFrameAnchor(runA[3], 5, 1);

    const f08 = alignAriaRunFrameAnchor(runB[0], 5, 0);
    const f10 = alignAriaRunFrameAnchor(runB[1], 5, -1);
    const f12 = alignAriaRunFrameAnchor(runB[2], 5, 0);
    const f14 = alignAriaRunFrameAnchor(runB[3], 5, 1);

    const m0 = runMid ? alignAriaRunFrameAnchor(runMid[0], 5, 0) : f00;
    const m1 = runMid ? alignAriaRunFrameAnchor(runMid[1], 5, -1) : f02;
    const m2 = runMid ? alignAriaRunFrameAnchor(runMid[2], 5, 0) : f04;
    const m3 = runMid ? alignAriaRunFrameAnchor(runMid[3], 5, 1) : f06;

    runFrames = [
      f00,
      m0,
      f02,
      m1,
      f04,
      m2,
      f06,
      m3,
      f08,
      f08,
      f10,
      f10,
      f12,
      f12,
      f14,
      f14,
    ];
  } else {
    const rk0 = alignAriaRunFrameAnchor(loco[1], 5, 0);
    const rk1 = alignAriaRunFrameAnchor(loco[2], 5, -1);
    const rk2 = alignAriaRunFrameAnchor(loco[3], 5, 0);
    const rk3 = alignAriaRunFrameAnchor(loco[2], 5, 1);
    runFrames = [rk0, rk0, rk1, rk1, rk2, rk2, rk3, rk3];
  }

  const astralA = ariaExtracted.astralA;
  const astralB = ariaExtracted.astralB;
  const lunarHeavy = ariaExtracted.lunarHeavy;
  const lunarDim = ariaExtracted.lunarDim;

  const ariaClips: Record<AriaClipId, SpriteAnimClip> = {
    idle: {
      frames: [loco[0], loco[0]],
    },
    run: { frames: runFrames },
    crouch: {
      frames: [
        loco[0],
        chudanGuard,
        halfCrouchRise,
        deepCrouch,
        deepCrouch,
        deepCrouch,
      ],
    },
    skid: {
      frames: [
        loco[1],
        stances[1],
        stances[1],
        halfCrouchRise,
        chudanGuard,
        loco[0],
      ],
    },
    jump_rise: {
      frames: [aerial[0], aerial[0], aerial[0], aerial[0]],
    },
    jump_apex: {
      frames: [aerial[0], aerial[0], aerial[2], aerial[2]],
    },
    jump_fall: {
      frames: [aerial[2], aerial[2], aerial[2], aerial[2]],
    },
    land: {
      frames: [
        aerial[2],
        halfCrouchRise,
        deepCrouch,
        halfCrouchRise,
        chudanGuard,
        loco[0],
      ],
    },
    dash: {
      frames: [
        halfCrouchRise,
        aerial[3],
        aerial[3],
        aerial[3],
        halfCrouchRise,
        chudanGuard,
        loco[0],
      ],
    },
    wall_slide: {
      frames: [airBrace, airBrace, aerial[0], airBrace],
    },
    hurt: {
      frames: [
        stances[3],
        stances[3],
        stances[3],
        halfCrouchRise,
        chudanGuard,
        loco[0],
      ],
    },
    zanshin: {
      frames: [
        zanshinFlourish,
        stances[2],
        stances[2],
        stances[2],
      ],
    },

    // --- 14 Distinct 16-Slot Multi-Stage Combat Clips (100% Pure Generated Keyframes) ---
    slash_1: buildMultiStageAttackClip(
      chudanGuard,
      slash12[0],
      combo[0],
      slash12[1],
      halfCrouchRise,
      slash12[2],
      chudanGuard,
      loco[0]
    ),
    slash_2: buildMultiStageAttackClip(
      slash12[1],
      slash12[2],
      heavy[2],
      combo[1],
      slash12[3],
      chudanGuard,
      stances[0],
      loco[0]
    ),
    slash_3: buildMultiStageAttackClip(
      slash12[3],
      stances[1],
      spinCleave[0],
      combo[2],
      iaidoCounter[3],
      chudanGuard,
      stances[0],
      loco[0]
    ),
    slash_4: buildMultiStageAttackClip(
      combo[2],
      heavy[1],
      spinCleave[1],
      combo[3],
      halfCrouchRise,
      chudanGuard,
      stances[0],
      loco[0]
    ),
    slide_slash: buildMultiStageAttackClip(
      halfCrouchRise,
      deepCrouch,
      halfCrouchRise,
      special[0],
      deepCrouch,
      slash12[2],
      halfCrouchRise,
      chudanGuard
    ),
    rising_moon: buildMultiStageAttackClip(
      slash12[2],
      deepCrouch,
      slash12[3],
      special[1],
      aerialPlunge[1],
      airBrace,
      aerial[0],
      aerial[2]
    ),
    dash_thrust: buildMultiStageAttackClip(
      aerial[3],
      slash12[2],
      spinCleave[1],
      special[2],
      combo[3],
      halfCrouchRise,
      chudanGuard,
      loco[0]
    ),
    moon_counter:
      ariaExtracted.crimsonA && ariaExtracted.crimsonB
        ? buildMultiStageAttackClip(
            ariaExtracted.crimsonA[0],
            ariaExtracted.crimsonA[0],
            ariaExtracted.crimsonA[1],
            ariaExtracted.crimsonA[2],
            ariaExtracted.crimsonA[3],
            ariaExtracted.crimsonB[2],
            ariaExtracted.crimsonB[3],
            loco[0]
          )
        : buildMultiStageAttackClip(
            stances[2],
            iaidoCounter[2],
            spinCleave[0],
            iaidoCounter[3],
            iaidoCounter[1],
            chudanGuard,
            stances[0],
            loco[0]
          ),
    astral_slash:
      astralA && astralB
        ? buildMultiStageAttackClip(
            astralA[0],
            astralA[1],
            astralA[2],
            astralA[2],
            astralA[3],
            astralB[0],
            astralB[1],
            astralB[2]
          )
        : astralA
          ? buildMultiStageAttackClip(
              astralA[0],
              astralA[1],
              astralA[2],
              astralA[2],
              astralA[3],
              stances[2],
              chudanGuard,
              loco[0]
            )
          : buildMultiStageAttackClip(
              stances[2],
              iaidoCounter[0],
              special[2],
              iaidoCounter[3],
              iaidoCounter[1],
              stances[2],
              chudanGuard,
              loco[0]
            ),
    air_slash_1: buildMultiStageAttackClip(
      aerial[0],
      aerialPlunge[0],
      heavy[3],
      aerialPlunge[1],
      airBrace,
      aerial[2],
      aerial[2],
      aerial[2]
    ),
    air_slash_2: buildMultiStageAttackClip(
      aerialPlunge[1],
      aerial[1],
      heavy[3],
      aerialPlunge[2],
      aerial[1],
      airBrace,
      aerial[2],
      aerial[2]
    ),
    helm_splitter: buildMultiStageAttackClip(
      aerial[0],
      lunarHeavy ? lunarHeavy[0] : special[1],
      special[3],
      special[3],
      lunarHeavy ? lunarHeavy[2] : spinCleave[3],
      deepCrouch,
      halfCrouchRise,
      chudanGuard
    ),
    heavy_crescent: lunarHeavy
      ? buildMultiStageAttackClip(
          lunarHeavy[0],
          lunarHeavy[0],
          lunarHeavy[1],
          lunarHeavy[2],
          lunarHeavy[2],
          lunarHeavy[3],
          chudanGuard,
          loco[0]
        )
      : buildMultiStageAttackClip(
          chudanGuard,
          spinCleave[2],
          spinCleave[1],
          spinCleave[3],
          spinCleave[3],
          halfCrouchRise,
          chudanGuard,
          stances[0]
        ),
    dimension_cut: lunarDim
      ? buildMultiStageAttackClip(
          lunarDim[0],
          lunarDim[0],
          lunarDim[1],
          lunarDim[2],
          lunarDim[2],
          lunarDim[3],
          stances[2],
          loco[0]
        )
      : buildMultiStageAttackClip(
          iaidoCounter[0],
          deepCrouch,
          slash12[2],
          iaidoCounter[1],
          heavy[2],
          halfCrouchRise,
          chudanGuard,
          loco[0]
        ),
  };

  const fullyLoaded = isAllAriaSheetsLoaded();

  if (!bankInstance) {
    bankInstance = {
      ready: true,
      ariaFullyLoaded: fullyLoaded,
      ariaClips,
      ...pendingEnemyBanks,
    };
  } else {
    bankInstance.ariaClips = ariaClips;
    bankInstance.ariaFullyLoaded = fullyLoaded;
    Object.assign(bankInstance, pendingEnemyBanks);
  }
}

function assignEnemyBanks(
  updates: Partial<
    Pick<
      CharacterSpriteBank,
      | 'stalkerClips'
      | 'weaverClips'
      | 'halberdierClips'
      | 'reaperClips'
      | 'arbalistClips'
      | 'wardenClips'
      | 'archonClips'
      | 'sovereignClips'
    >
  >
): void {
  Object.assign(pendingEnemyBanks, updates);
  if (bankInstance) {
    Object.assign(bankInstance, updates);
  }
}

/**
 * Builds a crisp nearest-neighbor pixel-art seamless horizontally-mirrored panorama canvas
 * (`2 * tileW` wide so horizontal camera parallax wraps seamlessly with zero hard seam!).
 */
let cachedIsSoftwareGl: boolean | null = null;
function isSoftwareGlEnv(): boolean {
  if (cachedIsSoftwareGl !== null) return cachedIsSoftwareGl;
  if (typeof document === 'undefined') return false;
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl') || probe.getContext('experimental-webgl');
    if (!gl) {
      cachedIsSoftwareGl = true;
      return true;
    }
    const glCtx = gl as WebGLRenderingContext;
    const dbg = glCtx.getExtension('WEBGL_debug_renderer_info');
    const renderer = dbg
      ? String(glCtx.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
      : String(glCtx.getParameter(glCtx.RENDERER));
    glCtx.getExtension('WEBGL_lose_context')?.loseContext();
    cachedIsSoftwareGl = /SwiftShader|llvmpipe|Software|Basic Render Driver/i.test(renderer);
    return cachedIsSoftwareGl;
  } catch {
    cachedIsSoftwareGl = false;
    return false;
  }
}

function buildSeamlessPixelPanorama(
  imgEl: HTMLImageElement,
  targetTexelH: number,
  darkenFactor: number
): HTMLCanvasElement {
  const aspect = imgEl.naturalWidth / Math.max(1, imgEl.naturalHeight);
  const singleW = Math.max(256, Math.round(targetTexelH * aspect));
  const cv = document.createElement('canvas');
  cv.width = singleW * 2;
  cv.height = targetTexelH;
  const ctx = cv.getContext('2d', { alpha: false })!;
  ctx.imageSmoothingEnabled = false;

  // Left half: original pixel panorama
  ctx.drawImage(imgEl, 0, 0, singleW, targetTexelH);
  // Right half: horizontally mirrored panorama so wrap edges match 1:1!
  ctx.save();
  ctx.translate(singleW * 2, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(imgEl, 0, 0, singleW, targetTexelH);
  ctx.restore();

  if (darkenFactor < 0.99) {
    const alpha = Math.max(0, Math.min(0.55, 1 - darkenFactor));
    ctx.fillStyle = `rgba(3, 6, 18, ${alpha.toFixed(3)})`;
    ctx.fillRect(0, 0, cv.width, cv.height);
  }

  return cv;
}

export function getEnvironmentArtBank(): EnvironmentArtBank | null {
  if (envBankInstance) return envBankInstance;
  if (!envLoadStarted && typeof window !== 'undefined') {
    envLoadStarted = true;

    let moonlitCanvas: HTMLCanvasElement | null = null;
    let crimsonCanvas: HTMLCanvasElement | null = null;
    let cryptCanvas: HTMLCanvasElement | null = null;
    let extractedProps: FrameQuad | null = null;

    const tryPublishEnvBank = () => {
      if (!moonlitCanvas || !extractedProps) return;
      const soulChandelier: ExtractedSpriteFrame = {
        ...extractedProps[1],
        anchorY: 3,
      };
      if (!envBankInstance) {
        envBankInstance = {
          ready: true,
          moonlitPanorama: moonlitCanvas,
          crimsonPanorama: crimsonCanvas ?? moonlitCanvas,
          cryptPanorama: cryptCanvas ?? moonlitCanvas,
          stainedGlassPillar: extractedProps[0],
          soulChandelier,
          knightStatue: extractedProps[2],
          gothicArchGate: extractedProps[3],
        };
      } else {
        if (crimsonCanvas) envBankInstance.crimsonPanorama = crimsonCanvas;
        if (cryptCanvas) envBankInstance.cryptPanorama = cryptCanvas;
      }
    };

    // Starting-biome Moonlit Cathedral Panorama + Gothic Props first (~179 KB total)
    loadSheetSelfHealing(
      bgMoonlitUrl,
      bgMoonlitJpgUrl,
      (moonlitImg) => {
        moonlitCanvas = buildSeamlessPixelPanorama(moonlitImg, 540, 0.78);
        tryPublishEnvBank();
      },
      true
    );

    loadSheetSelfHealing(
      envPropsUrl,
      envPropsJpgUrl,
      (propsImg) => {
        extractedProps = extractSheetFramesUniform(
          propsImg,
          0,
          96.0,
          [0, 0, 0, 0],
          false,
          DEFAULT_GRIP_HINTS,
          undefined,
          true
        );
        tryPublishEnvBank();
      },
      true
    );

    // Defer later-biome Crimson Throne & Abyssal Crypt Panoramas slightly so starting room boots at 60 FPS!
    setTimeout(() => {
      loadSheetSelfHealing(bgCrimsonUrl, bgCrimsonJpgUrl, (crimsonImg) => {
        crimsonCanvas = buildSeamlessPixelPanorama(crimsonImg, 540, 0.76);
        tryPublishEnvBank();
      });

      loadSheetSelfHealing(bgCryptUrl, bgCryptJpgUrl, (cryptImg) => {
        cryptCanvas = buildSeamlessPixelPanorama(cryptImg, 540, 0.78);
        tryPublishEnvBank();
      });
    }, 1200);
  }
  return envBankInstance;
}

export function getCharacterSpriteBank(): CharacterSpriteBank | null {
  if (bankInstance) return bankInstance;
  if (!loadStarted && typeof window !== 'undefined') {
    loadStarted = true;

    // --- TIER 0: Heroine Core Locomotion (`81 KB`) — Unlocks `bankInstance.ready = true` immediately! ---
    loadSheetSelfHealing(
      ariaLocoUrl,
      ariaLocoJpgUrl,
      (ariaLocoImg) => {
        ariaExtracted.loco = extractSheetFramesUniform(ariaLocoImg, 0, 36.0, [0, 0, 0, 0], true, [
          { box: [0.16, 0.36, 0.46, 0.60], seed: [0.25, 0.52], mode: 'ariaSkin', restAngle: 2.46 },
          { box: [0.38, 0.58, 0.40, 0.54], seed: [0.47, 0.47], mode: 'ariaSkin', restAngle: 2.74 },
          { box: [0.42, 0.62, 0.39, 0.53], seed: [0.52, 0.46], mode: 'ariaSkin', restAngle: 2.78 },
          { box: [0.40, 0.60, 0.40, 0.54], seed: [0.49, 0.47], mode: 'ariaSkin', restAngle: 2.74 },
        ]);
        scheduleRebuildAriaClips();
      },
      true
    );

    // --- TIER 1A: Video-Referenced 16-Frame 2-Step Sprint Cycle (`runA` + `runB` + `runMid`) + Multi-Stage Combat Sheets ---
    loadSheetSelfHealing(ariaRunAUrl, ariaRunAJpgUrl, (ariaRunAImg) => {
      ariaExtracted.runA = extractSheetFramesUniform(ariaRunAImg, 1, 35.6, [0, 0, 0, 0], true, [
        { box: [0.54, 0.72, 0.35, 0.47], seed: [0.62, 0.41], mode: 'ariaSkin', restAngle: 2.68 },
        { box: [0.56, 0.74, 0.35, 0.47], seed: [0.64, 0.41], mode: 'ariaSkin', restAngle: 2.74 },
        { box: [0.58, 0.76, 0.34, 0.46], seed: [0.67, 0.40], mode: 'ariaSkin', restAngle: 2.78 },
        { box: [0.52, 0.70, 0.36, 0.48], seed: [0.60, 0.42], mode: 'ariaSkin', restAngle: 2.70 },
      ]);
      scheduleRebuildAriaClips();
    });

    loadSheetSelfHealing(ariaRunBUrl, ariaRunBJpgUrl, (ariaRunBImg) => {
      ariaExtracted.runB = extractSheetFramesUniform(ariaRunBImg, 1, 35.6, [0, 0, 0, 0], true, [
        { box: [0.54, 0.72, 0.35, 0.47], seed: [0.62, 0.41], mode: 'ariaSkin', restAngle: 2.70 },
        { box: [0.56, 0.74, 0.35, 0.47], seed: [0.64, 0.41], mode: 'ariaSkin', restAngle: 2.74 },
        { box: [0.58, 0.76, 0.36, 0.48], seed: [0.68, 0.42], mode: 'ariaSkin', restAngle: 2.76 },
        { box: [0.54, 0.70, 0.35, 0.47], seed: [0.62, 0.41], mode: 'ariaSkin', restAngle: 2.68 },
      ]);
      scheduleRebuildAriaClips();
    });

    loadSheetSelfHealing(ariaRunMidUrl, ariaRunMidJpgUrl, (ariaRunMidImg) => {
      ariaExtracted.runMid = extractSheetFramesUniform(
        ariaRunMidImg,
        0,
        34.0,
        [0, 0, 0, 0],
        true,
        [
          { box: [0.52, 0.70, 0.36, 0.48], seed: [0.61, 0.42], mode: 'ariaSkin', restAngle: 2.72 },
          { box: [0.54, 0.72, 0.36, 0.48], seed: [0.63, 0.42], mode: 'ariaSkin', restAngle: 2.76 },
          { box: [0.54, 0.72, 0.35, 0.47], seed: [0.64, 0.41], mode: 'ariaSkin', restAngle: 2.74 },
          { box: [0.52, 0.68, 0.35, 0.47], seed: [0.60, 0.41], mode: 'ariaSkin', restAngle: 2.70 },
        ],
        undefined,
        false,
        { perCellWorldHeights: [34.25, 32.0, 34.25, 33.25] }
      );
      scheduleRebuildAriaClips();
    });

    loadSheetSelfHealing(ariaSlash12Url, ariaSlash12JpgUrl, (ariaSlash12Img) => {
      ariaExtracted.slash12 = extractSheetFramesUniform(ariaSlash12Img, 0, 38.2, [0, 0, 0, 0], true, [
        { box: [0.16, 0.42, 0.00, 0.14], seed: [0.28, 0.05], mode: 'ariaSkin', restAngle: -1.62 },
        { box: [0.80, 1.00, 0.50, 0.68], seed: [0.93, 0.60], mode: 'ariaSkin', restAngle: 0.78 },
        { box: [0.22, 0.48, 0.50, 0.66], seed: [0.34, 0.58], mode: 'ariaSkin', restAngle: 2.52 },
        { box: [0.82, 1.00, 0.08, 0.26], seed: [0.93, 0.16], mode: 'ariaSkin', restAngle: -0.68 },
      ]);
      scheduleRebuildAriaClips();
    });

    loadSheetSelfHealing(ariaSpinCleaveUrl, ariaSpinCleaveJpgUrl, (ariaSpinImg) => {
      ariaExtracted.spinCleave = extractSheetFramesUniform(ariaSpinImg, 0, 35.8, [0, 0, 0, 0], true, [
        { box: [0.80, 1.00, 0.24, 0.40], seed: [0.92, 0.31], mode: 'ariaSkin', restAngle: 0.04 },
        { box: [0.76, 1.00, 0.26, 0.44], seed: [0.89, 0.34], mode: 'ariaSkin', restAngle: -0.45 },
        { box: [0.16, 0.72, 0.00, 0.16], seed: [0.58, 0.06], mode: 'ariaSkin', restAngle: -2.42 },
        { box: [0.74, 0.98, 0.60, 0.78], seed: [0.87, 0.69], mode: 'ariaSkin', restAngle: 1.02 },
      ]);
      scheduleRebuildAriaClips();
    });

    loadSheetSelfHealing(ariaIaidoCounterUrl, ariaIaidoCounterJpgUrl, (ariaIaidoImg) => {
      ariaExtracted.iaidoCounter = extractSheetFramesUniform(ariaIaidoImg, 0, 36.0, [0, 0, 0, 0], true, [
        { box: [0.14, 0.36, 0.46, 0.60], seed: [0.24, 0.52], mode: 'ariaSkin', restAngle: 2.46 },
        { box: [0.82, 1.00, 0.10, 0.28], seed: [0.93, 0.18], mode: 'ariaSkin', restAngle: -0.56 },
        { box: [0.72, 0.96, 0.20, 0.38], seed: [0.85, 0.28], mode: 'ariaSkin', restAngle: -1.35 },
        { box: [0.82, 1.00, 0.22, 0.38], seed: [0.94, 0.30], mode: 'ariaSkin', restAngle: -0.06 },
      ]);
      scheduleRebuildAriaClips();
    });

    loadSheetSelfHealing(ariaCrimsonAUrl, ariaCrimsonAJpgUrl, (crimsonAImg) => {
      ariaExtracted.crimsonA = extractSheetFramesUniform(
        crimsonAImg,
        0,
        30.5,
        [0, 0, 0, 0],
        true,
        [
          { box: [0.28, 0.50, 0.38, 0.56], seed: [0.39, 0.47], mode: 'ariaSkin', restAngle: 2.52 },
          { box: [0.88, 1.00, 0.24, 0.36], seed: [0.93, 0.29], mode: 'ariaSkin', restAngle: 0.12 },
          { box: [0.86, 1.00, 0.20, 0.38], seed: [0.95, 0.29], mode: 'ariaSkin', restAngle: -0.14 },
          { box: [0.86, 1.00, 0.01, 0.16], seed: [0.95, 0.08], mode: 'ariaSkin', restAngle: -0.58 },
        ],
        undefined,
        false,
        {
          customSeams: [0.246, 0.482, 0.767],
          perCellWorldHeights: [30.5, 31.0, 32.0, 35.25],
        }
      );
      scheduleRebuildAriaClips();
    });

    loadSheetSelfHealing(ariaCrimsonBUrl, ariaCrimsonBJpgUrl, (crimsonBImg) => {
      ariaExtracted.crimsonB = extractSheetFramesUniform(
        crimsonBImg,
        3,
        36.0,
        [0, 0, 0, 0],
        true,
        [
          { box: [0.62, 0.84, 0.00, 0.10], seed: [0.73, 0.04], mode: 'ariaSkin', restAngle: -2.28 },
          { box: [0.84, 1.00, 0.56, 0.74], seed: [0.94, 0.65], mode: 'ariaSkin', restAngle: 0.94 },
          { box: [0.78, 1.00, 0.36, 0.54], seed: [0.89, 0.44], mode: 'ariaSkin', restAngle: 0.46 },
          { box: [0.18, 0.40, 0.44, 0.62], seed: [0.29, 0.54], mode: 'ariaSkin', restAngle: 2.52 },
        ],
        undefined,
        false,
        {
          customSeams: [0.255, 0.538, 0.783],
          perCellWorldHeights: [36.75, 31.75, 35.75, 36.0],
        }
      );
      scheduleRebuildAriaClips();
    });

    loadSheetSelfHealing(ariaAerialPlungeUrl, ariaAerialPlungeJpgUrl, (ariaAirPlungeImg) => {
      ariaExtracted.aerialPlunge = extractSheetFramesUniform(
        ariaAirPlungeImg,
        1,
        36.0,
        [1.2, 0.8, 2.0, 0],
        true,
        [
          { box: [0.04, 0.28, 0.10, 0.28], seed: [0.15, 0.18], mode: 'ariaSkin', restAngle: -2.45 },
          { box: [0.80, 1.00, 0.12, 0.30], seed: [0.92, 0.20], mode: 'ariaSkin', restAngle: -0.46 },
          { box: [0.78, 1.00, 0.36, 0.56], seed: [0.90, 0.45], mode: 'ariaSkin', restAngle: -0.28 },
          { box: [0.68, 0.92, 0.72, 0.90], seed: [0.80, 0.81], mode: 'ariaSkin', restAngle: 1.24 },
        ]
      );
      scheduleRebuildAriaClips();
    });

    loadSheetSelfHealing(ariaTransGuardUrl, ariaTransGuardJpgUrl, (ariaTransImg) => {
      ariaExtracted.transGuard = extractSheetFramesUniform(ariaTransImg, 0, 36.0, [0, 0, 0, 0], true, [
        { box: [0.16, 0.36, 0.46, 0.60], seed: [0.25, 0.52], mode: 'ariaSkin', restAngle: 2.48 },
        { box: [0.76, 0.98, 0.28, 0.46], seed: [0.88, 0.36], mode: 'ariaSkin', restAngle: -0.52 },
        { box: [0.74, 0.98, 0.52, 0.70], seed: [0.86, 0.60], mode: 'ariaSkin', restAngle: 0.72 },
        { box: [0.34, 0.60, 0.38, 0.54], seed: [0.46, 0.46], mode: 'ariaSkin', restAngle: 2.62 },
      ]);
      scheduleRebuildAriaClips();
    });

    loadSheetSelfHealing(ariaComboUrl, ariaComboJpgUrl, (ariaComboImg) => {
      ariaExtracted.combo = extractSheetFramesUniform(ariaComboImg, 0, 36.0, [0, 0, 0, 0], true, [
        { box: [0.78, 1.00, 0.42, 0.58], seed: [0.91, 0.50], mode: 'ariaSkin', restAngle: 0.76 },
        { box: [0.80, 1.00, 0.06, 0.24], seed: [0.92, 0.15], mode: 'ariaSkin', restAngle: -0.66 },
        { box: [0.82, 1.00, 0.23, 0.38], seed: [0.92, 0.30], mode: 'ariaSkin', restAngle: 0.06 },
        { box: [0.84, 1.00, 0.28, 0.46], seed: [0.94, 0.37], mode: 'ariaSkin', restAngle: 0.24 },
      ]);
      scheduleRebuildAriaClips();
    });

    // --- TIER 1B: Aria Aerial, Stances, Crouch, Heavy & Special Sheets ---
    loadSheetSelfHealing(ariaStancesUrl, ariaStancesJpgUrl, (ariaStancesImg) => {
      ariaExtracted.stances = extractSheetFramesUniform(ariaStancesImg, 2, 36.0, [0, 0, 0, 0], true, [
        { box: [0.50, 0.72, 0.34, 0.48], seed: [0.61, 0.41], mode: 'ariaSkin', restAngle: 2.52 },
        { box: [0.08, 0.28, 0.42, 0.58], seed: [0.18, 0.50], mode: 'ariaSkin', restAngle: 2.48 },
        { box: [0.24, 0.48, 0.38, 0.52], seed: [0.36, 0.45], mode: 'ariaSkin', restAngle: 2.58 },
        { box: [0.40, 0.62, 0.40, 0.54], seed: [0.51, 0.47], mode: 'ariaSkin', restAngle: 2.38 },
      ]);
      scheduleRebuildAriaClips();
    });

    loadSheetSelfHealing(ariaAerialUrl, ariaAerialJpgUrl, (ariaAerialImg) => {
      ariaExtracted.aerial = extractSheetFramesUniform(ariaAerialImg, 0, 35.8, [0.8, 1.5, 0.8, 0], true, [
        { box: [0.00, 0.22, 0.44, 0.60], seed: [0.09, 0.51], mode: 'ariaSkin', restAngle: 2.52 },
        { box: [0.68, 0.96, 0.34, 0.54], seed: [0.82, 0.44], mode: 'ariaSkin', restAngle: 2.75 },
        { box: [0.06, 0.28, 0.42, 0.56], seed: [0.16, 0.49], mode: 'ariaSkin', restAngle: 2.44 },
        { box: [0.48, 0.68, 0.42, 0.58], seed: [0.58, 0.50], mode: 'ariaSkin', restAngle: 2.92 },
      ]);
      scheduleRebuildAriaClips();
    });

    loadSheetSelfHealing(ariaCrouchUrl, ariaCrouchJpgUrl, (ariaCrouchImg) => {
      ariaExtracted.crouch = extractSheetFramesUniform(ariaCrouchImg, 0, 36.0, [0, 0, 0, 1.0], true, [
        { box: [0.16, 0.36, 0.46, 0.60], seed: [0.25, 0.52], mode: 'seed', restAngle: 2.46 },
        { box: [0.36, 0.58, 0.42, 0.60], seed: [0.47, 0.51], mode: 'ariaSkin', restAngle: 2.76 },
        { box: [0.40, 0.60, 0.40, 0.55], seed: [0.50, 0.48], mode: 'seed', restAngle: 2.60 },
        { box: [0.50, 0.72, 0.32, 0.48], seed: [0.61, 0.40], mode: 'ariaSkin', restAngle: 2.62 },
      ]);
      scheduleRebuildAriaClips();
    });

    loadSheetSelfHealing(ariaHeavyUrl, ariaHeavyJpgUrl, (ariaHeavyImg) => {
      ariaExtracted.heavy = extractSheetFramesUniform(ariaHeavyImg, 0, 36.0, [0, 0, 0, 1.0], true, [
        { box: [0.68, 0.92, 0.36, 0.50], seed: [0.80, 0.43], mode: 'ariaSkin', restAngle: 2.68 },
        { box: [0.42, 0.74, 0.00, 0.16], seed: [0.58, 0.07], mode: 'ariaSkin', restAngle: -2.38 },
        { box: [0.80, 1.00, 0.16, 0.34], seed: [0.91, 0.25], mode: 'ariaSkin', restAngle: -0.38 },
        { box: [0.82, 1.00, 0.18, 0.36], seed: [0.92, 0.27], mode: 'ariaSkin', restAngle: -0.34 },
      ]);
      scheduleRebuildAriaClips();
    });

    loadSheetSelfHealing(ariaSpecialUrl, ariaSpecialJpgUrl, (ariaSpecialImg) => {
      ariaExtracted.special = extractSheetFramesUniform(ariaSpecialImg, 1, 40.2, [0, 1.2, 0, 1.2], true, [
        { box: [0.60, 0.74, 0.50, 0.62], seed: [0.68, 0.56], mode: 'seed', restAngle: -0.06 },
        { box: [0.22, 0.52, 0.00, 0.14], seed: [0.38, 0.05], mode: 'ariaSkin', restAngle: -1.46 },
        { box: [0.86, 1.00, 0.30, 0.45], seed: [0.95, 0.38], mode: 'ariaSkin', restAngle: -0.02 },
        { box: [0.70, 0.94, 0.64, 0.82], seed: [0.82, 0.73], mode: 'ariaSkin', restAngle: 1.18 },
      ]);
      scheduleRebuildAriaClips();
    });

    // Reference-Locked Canonical Aria `星术 · 星芒绝斩` Part A & Part B Sprite Sheets
    loadSheetSelfHealing(ariaAstralAUrl, ariaAstralAUrl, (astralAImg) => {
      ariaExtracted.astralA = extractSheetFramesUniform(
        astralAImg,
        0,
        36.0,
        [0, 0, 0, 0],
        true,
        [
          { box: [0.76, 0.98, 0.34, 0.50], seed: [0.89, 0.42], mode: 'ariaSkin', restAngle: 2.52 },
          { box: [0.64, 0.90, 0.34, 0.52], seed: [0.78, 0.43], mode: 'ariaSkin', restAngle: -0.18 },
          { box: [0.84, 1.00, 0.22, 0.42], seed: [0.94, 0.31], mode: 'ariaSkin', restAngle: 0.02 },
          { box: [0.82, 1.00, 0.04, 0.24], seed: [0.94, 0.14], mode: 'ariaSkin', restAngle: -0.58 },
        ],
        undefined,
        false,
        {
          customSeams: [0.235, 0.495, 0.760],
        }
      );
      scheduleRebuildAriaClips();
    });

    loadSheetSelfHealing(ariaAstralBUrl, ariaAstralBUrl, (astralBImg) => {
      ariaExtracted.astralB = extractSheetFramesUniform(
        astralBImg,
        3,
        36.0,
        [0, 0, 0, 0],
        true,
        [
          { box: [0.76, 1.00, 0.16, 0.34], seed: [0.90, 0.25], mode: 'ariaSkin', restAngle: -0.06 },
          { box: [0.80, 1.00, 0.32, 0.50], seed: [0.92, 0.41], mode: 'ariaSkin', restAngle: 0.56 },
          { box: [0.42, 0.66, 0.36, 0.52], seed: [0.54, 0.44], mode: 'ariaSkin', restAngle: 2.54 },
          { box: [0.16, 0.38, 0.44, 0.60], seed: [0.26, 0.52], mode: 'ariaSkin', restAngle: 2.48 },
        ],
        undefined,
        false,
        {
          customSeams: [0.285, 0.538, 0.760],
        }
      );
      scheduleRebuildAriaClips();
    });

    // Reference-Locked Canonical Aria `月魄 · 朔月重斩` (`HeavyCrescent`) & `月魄 · 次元绝斩` (`DimensionCut`) Sheets
    loadSheetSelfHealing(ariaLunarHeavyUrl, ariaLunarHeavyUrl, (lunarHeavyImg) => {
      ariaExtracted.lunarHeavy = extractSheetFramesUniform(
        lunarHeavyImg,
        3,
        36.0,
        [0, 0, 0, 0],
        true,
        [
          { box: [0.46, 0.76, 0.00, 0.14], seed: [0.62, 0.05], mode: 'ariaSkin', restAngle: -2.42 },
          { box: [0.80, 1.00, 0.20, 0.38], seed: [0.93, 0.29], mode: 'ariaSkin', restAngle: 0.16 },
          { box: [0.80, 1.00, 0.36, 0.54], seed: [0.92, 0.45], mode: 'ariaSkin', restAngle: 0.78 },
          { box: [0.16, 0.38, 0.44, 0.60], seed: [0.26, 0.52], mode: 'ariaSkin', restAngle: 2.48 },
        ],
        undefined,
        false,
        {
          customSeams: [0.228, 0.534, 0.775],
        }
      );
      scheduleRebuildAriaClips();
    });

    loadSheetSelfHealing(ariaLunarDimUrl, ariaLunarDimUrl, (lunarDimImg) => {
      ariaExtracted.lunarDim = extractSheetFramesUniform(
        lunarDimImg,
        3,
        36.0,
        [0, 0, 0, 0],
        true,
        [
          { box: [0.76, 1.00, 0.32, 0.48], seed: [0.90, 0.40], mode: 'ariaSkin', restAngle: 2.52 },
          { box: [0.76, 1.00, 0.02, 0.22], seed: [0.89, 0.11], mode: 'ariaSkin', restAngle: -0.54 },
          { box: [0.82, 1.00, 0.02, 0.22], seed: [0.94, 0.11], mode: 'ariaSkin', restAngle: -0.58 },
          { box: [0.16, 0.38, 0.44, 0.60], seed: [0.26, 0.52], mode: 'ariaSkin', restAngle: 2.48 },
        ],
        undefined,
        false,
        {
          customSeams: [0.228, 0.516, 0.780],
        }
      );
      scheduleRebuildAriaClips();
    });

    // --- TIER 2: Independent Per-Archetype Enemy & Boss Sheets (`51–92 KB` each) ---
    loadSheetSelfHealing(stalkerWeaverUrl, stalkerWeaverJpgUrl, (stalkerWeaverImg) => {
      const sw = extractSheetFramesUniform(
        stalkerWeaverImg,
        0,
        29.5,
        [0, 0, 3.2, 3.2],
        false,
        [
          { box: [0.84, 1.00, 0.60, 0.82], seed: [0.92, 0.72], mode: 'opaque', restAngle: 0.65, offSeed: [0.22, 0.64] },
          { box: [0.84, 1.00, 0.36, 0.56], seed: [0.94, 0.46], mode: 'opaque', restAngle: 0.16, offSeed: [0.26, 0.52] },
          { box: [0.82, 1.00, 0.50, 0.68], seed: [0.96, 0.56], mode: 'seed', restAngle: 0.05 },
          { box: [0.82, 1.00, 0.16, 0.34], seed: [0.96, 0.24], mode: 'seed', restAngle: -0.18 },
        ],
        { secondStartIdx: 2, secondRefIdx: 2, secondRefWorldHeight: 37.5 }
      );
      assignEnemyBanks({
        stalkerClips: buildPureEnemyClips(sw[0], sw[1], sw[0], sw[1]),
        weaverClips: buildPureEnemyClips(sw[2], sw[2], sw[2], sw[3]),
      });
    });

    loadSheetSelfHealing(halberdierUrl, halberdierJpgUrl, (halberdierImg) => {
      const halb = extractSheetFramesUniform(halberdierImg, 0, 40.5, [0, 0, 0, 0], false, [
        { box: [0.36, 0.56, 0.32, 0.46], seed: [0.46, 0.39], mode: 'seed', restAngle: -0.95, offSeed: [0.88, 0.42] },
        { box: [0.08, 0.28, 0.46, 0.62], seed: [0.18, 0.54], mode: 'opaque', restAngle: -0.88, offSeed: [0.88, 0.50] },
        { box: [0.50, 0.78, 0.04, 0.20], seed: [0.64, 0.12], mode: 'opaque', restAngle: -2.05, offSeed: [0.84, 0.22] },
        { box: [0.86, 1.00, 0.30, 0.46], seed: [0.94, 0.38], mode: 'opaque', restAngle: 0.08, offSeed: [0.80, 0.46] },
      ]);
      assignEnemyBanks({
        halberdierClips: buildPureEnemyClips(halb[0], halb[1], halb[2], halb[3]),
      });
    });

    loadSheetSelfHealing(roguelikeEnemiesUrl, roguelikeEnemiesJpgUrl, (roguelikeEnemiesImg) => {
      const rogueExp = extractSheetFramesUniform(
        roguelikeEnemiesImg,
        0,
        35.5,
        [1.6, 0, 0, 2.2],
        false,
        [
          { box: [0.68, 0.98, 0.34, 0.62], seed: [0.84, 0.48], mode: 'opaque', restAngle: -0.45 },
          { box: [0.68, 0.98, 0.36, 0.62], seed: [0.84, 0.48], mode: 'opaque', restAngle: 0.04 },
          {
            box: [0.66, 0.98, 0.34, 0.64],
            seed: [0.82, 0.48],
            mode: 'opaque',
            restAngle: -0.82,
            offSeed: [0.24, 0.48],
          },
          { box: [0.66, 0.98, 0.24, 0.56], seed: [0.84, 0.40], mode: 'opaque', restAngle: -0.25 },
        ],
        undefined,
        true,
        {
          customSeams: [0.262, 0.486, 0.812],
          cropBottomRatio: 0.865,
          perCellWorldHeights: [35.5, 35.0, 50.5, 47.5],
        }
      );

      assignEnemyBanks({
        reaperClips: buildPureEnemyClips(rogueExp[0], rogueExp[0], rogueExp[0], rogueExp[0]),
        arbalistClips: buildPureEnemyClips(rogueExp[1], rogueExp[1], rogueExp[1], rogueExp[1]),
        wardenClips: buildPureEnemyClips(rogueExp[2], rogueExp[2], rogueExp[2], rogueExp[2]),
        archonClips: buildPureEnemyClips(rogueExp[3], rogueExp[3], rogueExp[3], rogueExp[3]),
      });
    });

    loadSheetSelfHealing(sovereignUrl, sovereignJpgUrl, (sovereignImg) => {
      const sov = extractSheetFramesUniform(sovereignImg, 0, 46.5, [0, 0, 0, 0], false, [
        { box: [0.42, 0.56, 0.46, 0.60], seed: [0.48, 0.53], mode: 'seed', restAngle: 2.38 },
        { box: [0.38, 0.52, 0.46, 0.60], seed: [0.45, 0.53], mode: 'seed', restAngle: 2.34 },
        { box: [0.48, 0.72, 0.08, 0.22], seed: [0.60, 0.15], mode: 'seed', restAngle: -2.18 },
        { box: [0.86, 1.00, 0.36, 0.50], seed: [0.94, 0.43], mode: 'opaque', restAngle: 0.14 },
      ]);
      assignEnemyBanks({
        sovereignClips: buildPureEnemyClips(sov[0], sov[1], sov[2], sov[3]),
      });
    });

    // --- TIER 3: Queue Environment Panoramas & Gothic Props right behind Character/Enemy sheets ---
    getEnvironmentArtBank();
  }
  return bankInstance;
}
