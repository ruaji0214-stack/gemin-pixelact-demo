import titleBackdropUrl from '../assets/images/title_bloodstained_castle_1794584613555.jpg';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../game/rules';
import { GamePhase, PlayerEntity } from '../game/types';
import { PixelFXBuffer } from './engine';
import { renderPlayerAria } from './sprites';

/**
 * Pure Model-Generated Pixel-Art Bloodstained Title Stage (`titleStage.ts`)
 *
 * Renders the generated 16:9 Gothic Cathedral & Demon Castle pixel-art key art
 * (`title_bloodstained_castle_1794584613555.jpg`), subtle pointer parallax, atmospheric
 * additive lightmap glow on the stained-glass rose window / candelabras / crescent moon,
 * and heroine Aria poised on the moonlit stone balcony.
 */

let titleBackdropCanvas: HTMLCanvasElement | null = null;
let titleBackdropLoading = false;

function ensureTitleBackdrop(): HTMLCanvasElement | null {
  if (titleBackdropCanvas) return titleBackdropCanvas;
  if (!titleBackdropLoading && typeof window !== 'undefined') {
    titleBackdropLoading = true;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        // Bake at exact 1920x1080 (`texelWorld = 0.25` -> 480x270 world units) with slight oversize margin for parallax
        const targetW = 1968;
        const targetH = 1107;
        const cv = document.createElement('canvas');
        cv.width = targetW;
        cv.height = targetH;
        const ctx = cv.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, targetW, targetH);
        titleBackdropCanvas = cv;
      }
    };
    img.src = titleBackdropUrl;
  }
  return titleBackdropCanvas;
}

function snap(v: number): number {
  return Math.round(v * 4) * 0.25;
}

export function renderBloodstainedTitleStage(
  pfx: PixelFXBuffer,
  player: PlayerEntity,
  time: number,
  pointerNormX = 0,
  pointerNormY = 0
): void {
  pfx.camX = 0;
  pfx.camY = 0;

  const backdrop = ensureTitleBackdrop();
  const parX = snap(pointerNormX * 4.5);
  const parY = snap(pointerNormY * 3.0);

  if (backdrop) {
    // Blit generated pixel-art cathedral backdrop across full 480x270 world stage (`492x276.75` world units)
    pfx.drawSprite(
      backdrop,
      snap(-6 - parX),
      snap(-3.25 - parY),
      0,
      0,
      0,
      false,
      1,
      1,
      1,
      0.25
    );
  } else {
    pfx.fillScreenGradient(6, 8, 18, 18, 12, 30);
  }

  // Dynamic additive lighting aligned to the generated stained-glass rose window, crescent moon & candelabras
  const rosePulse = 0.85 + 0.15 * Math.sin(time * 1.6);
  const candleFlickerA = 0.84 + 0.16 * Math.sin(time * 9.2);
  const candleFlickerB = 0.84 + 0.16 * Math.cos(time * 10.6 + 1.4);

  // Pale crescent moon glow
  pfx.addRadialLight(snap(292 - parX), snap(52 - parY), 58, 30, 38, 64);

  // Grand ruby/amethyst stained-glass rose window glow
  pfx.addRadialLight(
    snap(408 - parX),
    snap(86 - parY),
    86,
    Math.round(54 * rosePulse),
    Math.round(18 * rosePulse),
    Math.round(46 * rosePulse)
  );

  // Warm gothic candelabras flickering on the balcony
  pfx.addRadialLight(
    snap(358 - parX),
    snap(166 - parY),
    38,
    Math.round(58 * candleFlickerA),
    Math.round(36 * candleFlickerA),
    Math.round(16 * candleFlickerA)
  );
  pfx.addRadialLight(
    snap(448 - parX),
    snap(166 - parY),
    38,
    Math.round(56 * candleFlickerB),
    Math.round(34 * candleFlickerB),
    Math.round(16 * candleFlickerB)
  );
  pfx.addRadialLight(
    snap(466 - parX),
    snap(204 - parY),
    36,
    Math.round(62 * candleFlickerA),
    Math.round(38 * candleFlickerA),
    Math.round(18 * candleFlickerA)
  );

  // Heroine Aria poised on the moonlit cathedral stone balcony centered before the rose window
  const stageAria: PlayerEntity = {
    ...player,
    x: snap(398 - parX),
    y: snap(222 - parY),
    facing: -1,
  };
  renderPlayerAria(pfx, stageAria, time, GamePhase.Title);
  pfx.addRadialLight(stageAria.x, stageAria.y - 18, 42, 34, 42, 76);

  // Subtle dark bottom vignette band for crisp bottom control hint contrast
  pfx.fillDitherRect(0, WORLD_HEIGHT - 22, WORLD_WIDTH, 22, 5, 7, 16, 0.55);
}
