import { resolveAriaAnimSample, resolveEnemyAnimSample } from '../game/animClips';
import { computeAriaPose } from '../game/kinematics';
import { isBossEnemyKind } from '../game/roguelike';
import { MOVES, WORLD_HEIGHT, WORLD_WIDTH, getMovePhase } from '../game/rules';
import { solveAriaSkeleton, solveEnemySkeleton } from '../game/skeleton';
import {
  EnemyAIState,
  EnemyEntity,
  EnemyKind,
  GamePhase,
  HairNode,
  MoveId,
  PlatformRect,
  PlayerEntity,
  ProjectileEntity,
  RelicId,
  RoomDef,
} from '../game/types';
import { BOSS_ROOM_IDS } from '../game/world';
import { PixelFXBuffer, seededRand } from './engine';
import {
  getEnemySmearPalette,
  renderPfxAfterimages,
  renderPfxBossHalo,
  renderPfxEliteCrest,
  renderPfxEnemyKO,
  renderPfxEnemySpawn,
  renderPfxMagicCircle,
  renderPfxProjectiles,
  renderPfxTorchFlame,
  renderPfxWeaponSmear,
} from './proceduralVfx';
import {
  ExtractedSpriteFrame,
  SmoothFrameSample,
  getCharacterSpriteBank,
  getEnvironmentArtBank,
  getFrameGripWorldPos,
  getInterpolatedGripWorldPos,
  getVariantCanvas,
  sampleClipFrame,
  sampleClipFrameSmooth,
} from './spriteSheets';
import { getPixelAtlas } from './textures';

// Kick off prioritized character -> enemy -> environment pixel-art decoding on startup
if (typeof window !== 'undefined') {
  getCharacterSpriteBank();
}

const STARS = (() => {
  const rand = seededRand(42077);
  return Array.from({ length: 88 }, () => ({
    x: rand() * WORLD_WIDTH,
    y: rand() * 172,
    phase: rand() * Math.PI * 2,
    bright: rand() > 0.72,
    cross: rand() > 0.86,
  }));
})();

export interface RoomRenderState {
  hasRelicOnPedestal: boolean;
  hasVesselOnPedestal: boolean;
  hasAltarOnPedestal: boolean;
  sealIntact: boolean;
  shrineActive: boolean;
  roomLocked?: boolean;
  lockedExitBarriers?: PlatformRect[];
}

function mirrorLocalAngle(localRightAngle: number, facing: 1 | -1): number {
  return facing === 1 ? localRightAngle : Math.PI - localRightAngle;
}

function lerpShortestAngle(a: number, b: number, t: number): number {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

function drawExtractedFrame(
  pfx: PixelFXBuffer,
  frame: ExtractedSpriteFrame,
  wx: number,
  wy: number,
  facing: 1 | -1,
  variant: 'normal' | 'flash' | 'cyanGhost' | 'violetGhost' = 'normal',
  alpha = 1
): void {
  const src = getVariantCanvas(frame, variant);

  // Strict 1:1 rigid pixel blitting: ZERO scaling, ZERO squash/stretch, ZERO rotation!
  pfx.drawSprite(
    src,
    wx,
    wy,
    0,
    frame.anchorX,
    frame.anchorY,
    false,
    facing,
    1,
    alpha,
    frame.texelWorldSize
  );
}

/**
 * 60 FPS Secondary Spine Physics Streamers (Verlet Gothic Hair Ribbons + Lunar Scabbard Tassel "剑穗"):
 * Physics-driven rope/chain nodes updated at 60 FPS and snapped to 0.25-world-unit texels.
 */
function renderAriaSecondarySpineStreamers(
  pfx: PixelFXBuffer,
  player: PlayerEntity,
  scabbardX: number,
  scabbardY: number,
  facing: 1 | -1,
  time: number
): void {
  const snapPx = (v: number) => Math.round(v * 4) * 0.25;

  if (player.capeNodes.length >= 3) {
    let prevX = snapPx(scabbardX - facing * 1.5);
    let prevY = snapPx(scabbardY - 2.0);
    for (let i = 1; i < player.capeNodes.length; i++) {
      const n = player.capeNodes[i];
      const flutter = Math.sin(time * 9.5 + i * 1.3) * (0.35 * i);
      const nx = snapPx(prevX + (n.x - player.capeNodes[i - 1].x) * 0.62 - facing * 0.7);
      const ny = snapPx(prevY + (n.y - player.capeNodes[i - 1].y) * 0.58 + flutter * 0.25);
      const isTip = i === player.capeNodes.length - 1;
      pfx.drawLine(
        prevX,
        prevY,
        nx,
        ny,
        isTip ? 236 : 168,
        isTip ? 244 : 52,
        isTip ? 255 : 98,
        0.92,
        isTip ? 2 : 3
      );
      prevX = nx;
      prevY = ny;
    }
  }

  const speed = Math.hypot(player.vx, player.vy);
  if (speed > 24 || player.moveId !== MoveId.None) {
    const drawRibbon = (nodes: HairNode[], offY: number) => {
      if (nodes.length < 4) return;
      for (let i = 1; i < 4; i++) {
        const a = nodes[i - 1];
        const b = nodes[i];
        pfx.drawLine(
          snapPx(a.x),
          snapPx(a.y + offY),
          snapPx(b.x),
          snapPx(b.y + offY),
          46,
          62,
          112,
          0.85,
          2
        );
      }
    };
    drawRibbon(player.hairLeft, 1.5);
    drawRibbon(player.hairRight, 2.2);
  }
}

// --- 1. Multi-Plane Gothic Castle / Cave Environment & Generated Props ---

function renderSeamlessPanoramaLayer(
  pfx: PixelFXBuffer,
  pano: HTMLCanvasElement,
  parallaxX: number,
  parallaxY: number,
  roomHeight: number
): void {
  const texelWorld = 0.5;
  const panoW = pano.width;
  const panoH = pano.height;
  if (panoW <= 0 || panoH <= 0) return;

  const panoWorldW = panoW * texelWorld;
  const panoWorldH = panoH * texelWorld;

  const scrollX = (((pfx.camX * parallaxX) % panoWorldW) + panoWorldW) % panoWorldW;
  const maxCamY = Math.max(1, roomHeight - WORLD_HEIGHT);
  const camRatioY = Math.max(0, Math.min(1, pfx.camY / maxCamY));
  const extraH = Math.max(0, panoWorldH - WORLD_HEIGHT);

  const viewTexW = Math.round(WORLD_WIDTH / texelWorld);
  const viewTexH = Math.min(panoH, Math.round(WORLD_HEIGHT / texelWorld));
  const srcX = Math.floor(scrollX / texelWorld) % panoW;
  const srcY = Math.max(
    0,
    Math.min(panoH - viewTexH, Math.floor((camRatioY * extraH * parallaxY) / texelWorld))
  );

  const ctx = pfx.ctx;
  ctx.imageSmoothingEnabled = false;
  const firstTexW = Math.min(viewTexW, panoW - srcX);
  const firstScreenW = Math.round((firstTexW / viewTexW) * pfx.width);
  ctx.drawImage(pano, srcX, srcY, firstTexW, viewTexH, 0, 0, firstScreenW, pfx.height);

  const remTexW = viewTexW - firstTexW;
  if (remTexW > 0) {
    ctx.drawImage(
      pano,
      0,
      srcY,
      remTexW,
      viewTexH,
      firstScreenW,
      0,
      pfx.width - firstScreenW,
      pfx.height
    );
  }
}

let cachedRoomArchCanvas: HTMLCanvasElement | null = null;
let cachedRoomArchKey = '';

function drawTiledRectOnContext(
  ctx: CanvasRenderingContext2D,
  tile: HTMLCanvasElement,
  x0: number,
  y0: number,
  w: number,
  h: number,
  originX: number,
  originY: number
): void {
  const tw = tile.width;
  const th = tile.height;
  if (tw <= 0 || th <= 0 || w <= 0 || h <= 0) return;
  const x1 = x0 + w;
  const y1 = y0 + h;
  for (let dy = y0; dy < y1; ) {
    const tsy = (((dy - originY) % th) + th) % th;
    const tsh = Math.min(th - tsy, y1 - dy);
    for (let dx = x0; dx < x1; ) {
      const tsx = (((dx - originX) % tw) + tw) % tw;
      const tsw = Math.min(tw - tsx, x1 - dx);
      ctx.drawImage(tile, tsx, tsy, tsw, tsh, dx, dy, tsw, tsh);
      dx += tsw;
    }
    dy += tsh;
  }
}

function drawBakedSprite(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  wx: number,
  wy: number,
  anchorXTex: number,
  anchorYTex: number,
  scaleX = 1,
  scaleY = 1,
  alpha = 1
): void {
  const px = Math.round(wx * 4);
  const py = Math.round(wy * 4);
  ctx.imageSmoothingEnabled = false;
  if (alpha < 0.99) ctx.globalAlpha = alpha;
  if (scaleX === 1 && scaleY === 1) {
    ctx.drawImage(sprite, Math.round(px - anchorXTex), Math.round(py - anchorYTex));
  } else {
    ctx.setTransform(scaleX, 0, 0, scaleY, px, py);
    ctx.drawImage(sprite, -anchorXTex, -anchorYTex);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  if (alpha < 0.99) ctx.globalAlpha = 1;
}

function ensureStaticRoomArchCanvas(
  room: RoomDef,
  atlas: ReturnType<typeof getPixelAtlas>,
  envBank: ReturnType<typeof getEnvironmentArtBank>,
  isCrimsonTheme: boolean,
  isCryptTheme: boolean
): HTMLCanvasElement {
  const p0 = room.platforms[0];
  const pLast = room.platforms[room.platforms.length - 1];
  const key = `${room.id}|${room.width}x${room.height}|${room.theme}|${room.platforms.length}|${p0 ? `${p0.x},${p0.y},${p0.w}` : ''}|${pLast ? `${pLast.x},${pLast.y},${pLast.w}` : ''}|${atlas.ready ? 1 : 0}|${envBank?.ready ? 1 : 0}`;
  if (cachedRoomArchCanvas && cachedRoomArchKey === key) {
    return cachedRoomArchCanvas;
  }

  const rwPx = Math.max(1, Math.round(room.width * 4));
  const rhPx = Math.max(1, Math.round(room.height * 4));
  if (!cachedRoomArchCanvas) {
    cachedRoomArchCanvas = document.createElement('canvas');
  }
  cachedRoomArchCanvas.width = rwPx;
  cachedRoomArchCanvas.height = rhPx;
  cachedRoomArchKey = key;

  const ctx = cachedRoomArchCanvas.getContext('2d')!;
  ctx.clearRect(0, 0, rwPx, rhPx);
  ctx.imageSmoothingEnabled = false;

  if (envBank?.ready) {
    const floorPlat = room.platforms.reduce(
      (best, p) => (!p.oneWay && !p.hazard && p.w > best.w && p.y >= room.height - 80 ? p : best),
      room.platforms[0]
    );
    const baseFloorY = floorPlat ? floorPlat.y : room.height - 44;

    if (room.shrine) {
      const sh = room.shrine;
      drawBakedSprite(ctx, envBank.knightStatue.canvas, sh.x - 42, sh.y, envBank.knightStatue.anchorX, envBank.knightStatue.anchorY, 1, 1, 0.95);
      drawBakedSprite(ctx, envBank.knightStatue.canvas, sh.x + 42, sh.y, envBank.knightStatue.anchorX, envBank.knightStatue.anchorY, -1, 1, 0.95);
    } else if (room.relic) {
      const rl = room.relic;
      drawBakedSprite(ctx, envBank.knightStatue.canvas, rl.x - 36, rl.y, envBank.knightStatue.anchorX, envBank.knightStatue.anchorY, 1, 1, 0.94);
      drawBakedSprite(ctx, envBank.knightStatue.canvas, rl.x + 36, rl.y, envBank.knightStatue.anchorX, envBank.knightStatue.anchorY, -1, 1, 0.94);
    } else if (room.theme === 'throne') {
      drawBakedSprite(ctx, envBank.knightStatue.canvas, 132, baseFloorY, envBank.knightStatue.anchorX, envBank.knightStatue.anchorY, 1, 1, 0.95);
      drawBakedSprite(ctx, envBank.knightStatue.canvas, room.width - 132, baseFloorY, envBank.knightStatue.anchorX, envBank.knightStatue.anchorY, -1, 1, 0.95);
    }

    for (const ex of room.exits) {
      if (ex.direction === 'left' || ex.direction === 'right') {
        const gateX = ex.direction === 'left' ? ex.x + ex.w + 10 : ex.x - 10;
        const gateFloorY = ex.y + ex.h;
        drawBakedSprite(
          ctx,
          envBank.gothicArchGate.canvas,
          gateX,
          gateFloorY,
          envBank.gothicArchGate.anchorX,
          envBank.gothicArchGate.anchorY,
          ex.direction === 'left' ? 1 : -1,
          1,
          0.92
        );
      }
    }
  }

  // Suspension Wrought-Iron Chains for Elevated One-Way Gothic Balconies
  for (const plat of room.platforms) {
    if (!plat.oneWay || plat.w < 36 || plat.y >= room.height - 40) continue;
    const leftChainX = plat.x + 7;
    const rightChainX = plat.x + plat.w - 10.5;
    const chainH = Math.max(0, plat.y + 1);
    if (chainH <= 0) continue;
    drawTiledRectOnContext(
      ctx,
      atlas.ironChainTile,
      Math.round(leftChainX * 4),
      0,
      14,
      Math.round(chainH * 4),
      Math.round(leftChainX * 4),
      0
    );
    drawTiledRectOnContext(
      ctx,
      atlas.ironChainTile,
      Math.round(rightChainX * 4),
      0,
      14,
      Math.round(chainH * 4),
      Math.round(rightChainX * 4),
      0
    );
  }

  // Soul Candelabra Wall/Floor Props
  if (room.torches) {
    for (let i = 0; i < room.torches.length; i++) {
      const tr = room.torches[i];
      drawBakedSprite(ctx, atlas.candelabraProp, tr.x, tr.y + 8, 26, 104, 0.55, 0.55, 0.96);
    }
  }

  const wallTile = isCryptTheme
    ? atlas.stoneWallCryptTile
    : isCrimsonTheme
      ? atlas.stoneWallCrimsonTile
      : atlas.stoneWallTile;
  const corniceTile = isCryptTheme
    ? atlas.stoneCorniceCryptTile
    : isCrimsonTheme
      ? atlas.stoneCorniceCrimsonTile
      : atlas.stoneCorniceTile;

  for (const plat of room.platforms) {
    if (plat.hazard) {
      ctx.fillStyle = 'rgb(18,10,26)';
      ctx.fillRect(
        Math.round(plat.x * 4),
        Math.round((plat.y + 8) * 4),
        Math.round(plat.w * 4),
        Math.max(1, Math.round((plat.h - 8) * 4))
      );
      for (let sx = plat.x + 3.5; sx < plat.x + plat.w - 3; sx += 6.8) {
        drawBakedSprite(ctx, atlas.crystalSpike, sx, plat.y + 11.5, 16, 46, 1, 1, 1);
      }
      continue;
    }

    if (plat.oneWay) {
      drawTiledRectOnContext(
        ctx,
        atlas.balconyTile,
        Math.round(plat.x * 4),
        Math.round(plat.y * 4),
        Math.round(plat.w * 4),
        28,
        Math.round(plat.x * 4),
        Math.round(plat.y * 4)
      );
      continue;
    }

    const px0 = Math.round(plat.x * 4);
    const py0 = Math.round(plat.y * 4);
    const pw = Math.round(plat.w * 4);
    const ph = Math.round(plat.h * 4);
    if (pw <= 0 || ph <= 0) continue;

    drawTiledRectOnContext(ctx, wallTile, px0, py0, pw, ph, 0, py0);

    if (plat.y > 20) {
      const capH = Math.round(Math.min(6.0, plat.h) * 4);
      drawTiledRectOnContext(ctx, corniceTile, px0, py0, pw, capH, px0, py0);
    }

    const botY = plat.y + plat.h;
    if (botY < room.height - 28 && plat.w >= 36) {
      for (let sx = plat.x + 12; sx < plat.x + plat.w - 12; sx += 28) {
        const hash = Math.abs(Math.imul(Math.round(sx), 374761393) ^ Math.imul(Math.round(botY), 668265263));
        if (hash % 3 === 0) continue;
        drawBakedSprite(
          ctx,
          atlas.stalactiteCluster,
          sx,
          botY - 1,
          32,
          4,
          ((hash & 1) === 1 ? -1 : 1) * 0.44,
          0.42,
          0.94
        );
      }
    }
  }

  return cachedRoomArchCanvas;
}

export function renderMetroidvaniaRoom(
  pfx: PixelFXBuffer,
  room: RoomDef,
  time: number,
  state: RoomRenderState
): void {
  const atlas = getPixelAtlas();
  const envBank = getEnvironmentArtBank();
  const vw = WORLD_WIDTH;

  const themePalette: Record<
    RoomDef['theme'],
    {
      top: [number, number, number];
      bot: [number, number, number];
    }
  > = {
    moonlit: { top: [7, 10, 22], bot: [20, 28, 54] },
    tower: { top: [9, 12, 28], bot: [26, 33, 66] },
    archive: { top: [14, 9, 28], bot: [36, 20, 56] },
    crypt: { top: [5, 11, 20], bot: [14, 29, 46] },
    throne: { top: [18, 7, 20], bot: [46, 15, 36] },
  };
  const pal = themePalette[room.theme];
  const isCrimsonTheme = room.theme === 'throne' || room.theme === 'archive';
  const isCryptTheme = room.theme === 'crypt';

  // 1. Far-Plane HD Pixel-Art Biome Panorama
  if (envBank?.ready) {
    const pano = isCryptTheme
      ? envBank.cryptPanorama
      : isCrimsonTheme
        ? envBank.crimsonPanorama
        : envBank.moonlitPanorama;
    renderSeamlessPanoramaLayer(pfx, pano, 0.18, 0.25, room.height);
  } else {
    pfx.fillScreenGradient(
      pal.top[0],
      pal.top[1],
      pal.top[2],
      pal.bot[0],
      pal.bot[1],
      pal.bot[2]
    );
    if (!isCryptTheme) {
      const isThrone = room.theme === 'throne';
      const moonCx = pfx.camX + 378 - pfx.camX * 0.08;
      const moonCy = pfx.camY + 62 - pfx.camY * 0.08;
      const moonScale = isThrone ? 2.1 : 1.85;
      pfx.addRadialLight(moonCx, moonCy, 82, isThrone ? 64 : 38, isThrone ? 22 : 50, isThrone ? 44 : 92);
      pfx.drawSprite(
        isThrone ? atlas.moonCrimson : atlas.moonSilver,
        moonCx,
        moonCy,
        0,
        72,
        72,
        false,
        moonScale,
        moonScale,
        1,
        0.25
      );
    }
  }

  // 2. Twinkling Ambient Motes / Bioluminescent Spores
  for (let i = 0; i < STARS.length; i++) {
    const st = STARS[i];
    const twinkle = 0.5 + 0.5 * Math.sin(time * 2.4 + st.phase);
    if (twinkle <= 0.36) continue;

    const sx = (((st.x - pfx.camX * 0.14) % vw) + vw) % vw;
    const sy = (((st.y - pfx.camY * 0.1 + (isCryptTheme ? Math.sin(time + i) * 4 : 0)) % 180) + 180) % 180;
    const wx = sx + pfx.camX;
    const wy = sy + pfx.camY;
    const c = st.bright ? 244 : 168;

    if (isCryptTheme) {
      pfx.setPixel(wx, wy, 92, 232, 240, st.bright ? 3 : 2);
      if (st.bright && twinkle > 0.82) {
        pfx.addRadialLight(wx, wy, 9, 8, 28, 34);
      }
    } else if (isCrimsonTheme) {
      pfx.setPixel(wx, wy, 255, 152, 188, st.bright ? 3 : 2);
    } else {
      pfx.setPixel(wx, wy, c, Math.min(255, c + 12), 255, st.bright ? 3 : 2);
    }
  }

  // 3. Mid-Ground Parallax Gothic Stained-Glass Lancet Pillars, Archive Bookshelves, Chandeliers & Statues
  if (envBank?.ready) {
    const floorPlat = room.platforms.reduce(
      (best, p) => (!p.oneWay && !p.hazard && p.w > best.w && p.y >= room.height - 80 ? p : best),
      room.platforms[0]
    );
    const baseFloorY = floorPlat ? floorPlat.y : room.height - 44;

    for (let bx = 92; bx < room.width - 48; bx += 176) {
      const px = Math.round((bx - pfx.camX * 0.42 + pfx.camX) * 4) * 0.25;
      drawExtractedFrame(pfx, envBank.stainedGlassPillar, px, baseFloorY + 4, 1, 'normal', 0.88);

      const glassY = baseFloorY - 52;
      pfx.addRadialLight(
        px,
        glassY,
        36,
        isCrimsonTheme ? 48 : isCryptTheme ? 16 : 24,
        isCrimsonTheme ? 16 : isCryptTheme ? 48 : 44,
        isCrimsonTheme ? 34 : isCryptTheme ? 56 : 82
      );

      // Generated Gothic Archive Bookshelf Sprite (`pixel_cave_decor_sheet`)
      if (room.theme === 'archive') {
        const shelfX = px + 56;
        pfx.drawSprite(
          atlas.gothicBookshelf,
          shelfX,
          baseFloorY + 2,
          0,
          44,
          122,
          false,
          1,
          1,
          0.92,
          0.25
        );
      }
    }

    // Ceiling-Hung Wrought-Iron Soul-Fire Chandeliers
    const ceilingPlat = room.platforms.find((p) => !p.oneWay && !p.hazard && p.y <= 16 && p.w >= 180);
    const ceilBottomY = ceilingPlat ? ceilingPlat.y + ceilingPlat.h : 16;
    for (let cx = 136; cx < room.width - 96; cx += 196) {
      const swayX = Math.round(Math.sin(time * 1.9 + cx * 0.02) * 2) * 0.25;
      pfx.fillPatternRect(
        atlas.ironChainTile,
        atlas.ironChainCache,
        cx - 1.75 + swayX,
        0,
        3.5,
        ceilBottomY + 2,
        cx + swayX,
        0
      );
      drawExtractedFrame(
        pfx,
        envBank.soulChandelier,
        cx + swayX,
        ceilBottomY - 1,
        1,
        'normal',
        0.96
      );
      const fl = Math.sin(time * 10.5 + cx) * 2.2;
      pfx.addRadialLight(
        cx + swayX,
        ceilBottomY + 28,
        46 + fl,
        isCrimsonTheme ? 58 : 26,
        isCrimsonTheme ? 22 : 68,
        isCrimsonTheme ? 42 : 98
      );
    }
  }

  // 4. Atmospheric Volumetric Moonlight / Blood-Moon Light Pools
  for (let beam = 0; beam < 4; beam++) {
    const bx = 128 + beam * 188;
    if (bx > room.width + 40) break;
    const topY = 8;
    const botY = room.height - 30;
    const topX = bx + (botY - topY) * 0.3;
    pfx.addRadialLight(
      (topX + bx) * 0.5,
      (topY + botY) * 0.56,
      52,
      isCrimsonTheme ? 20 : isCryptTheme ? 9 : 12,
      isCrimsonTheme ? 7 : isCryptTheme ? 22 : 18,
      isCrimsonTheme ? 14 : isCryptTheme ? 26 : 30
    );
  }

  const viewL = pfx.camX - 32;
  const viewR = pfx.camX + WORLD_WIDTH + 32;
  const viewT = pfx.camY - 32;
  const viewB = pfx.camY + WORLD_HEIGHT + 32;

  // 5 & 6. Single-Blit Pre-Baked Static Room Architecture (Statues, Archways, Chains, Candelabras, Walls, Cornices, Balconies, Spikes, Stalactites)
  const roomArch = ensureStaticRoomArchCanvas(room, atlas, envBank, isCrimsonTheme, isCryptTheme);
  const camPxX = Math.round(pfx.camX * 4);
  const camPxY = Math.round(pfx.camY * 4);
  const srcX = Math.max(0, camPxX);
  const srcY = Math.max(0, camPxY);
  const dstX = Math.max(0, -camPxX);
  const dstY = Math.max(0, -camPxY);
  const blitW = Math.min(pfx.width - dstX, roomArch.width - srcX);
  const blitH = Math.min(pfx.height - dstY, roomArch.height - srcY);
  if (blitW > 0 && blitH > 0) {
    pfx.ctx.imageSmoothingEnabled = false;
    pfx.ctx.drawImage(roomArch, srcX, srcY, blitW, blitH, dstX, dstY, blitW, blitH);
  }

  // Dynamic PixelFX soul-flames & flickering lights for visible torches & crystal spike hazards
  if (room.torches) {
    for (let i = 0; i < room.torches.length; i++) {
      const tr = room.torches[i];
      if (tr.x < viewL - 24 || tr.x > viewR + 24 || tr.y < viewT - 24 || tr.y > viewB + 24) continue;
      renderPfxTorchFlame(pfx, tr.x, tr.y - 6, time, i + 1, tr.color);
      const fl = Math.sin(time * 10.5 + i * 1.9) * 3;
      const light =
        tr.color === 'crimson'
          ? [64, 16, 34]
          : tr.color === 'cyan'
            ? [16, 52, 72]
            : tr.color === 'violet'
              ? [46, 22, 76]
              : [58, 36, 16];
      pfx.addRadialLight(tr.x, tr.y - 4, 42 + fl, light[0], light[1], light[2]);
    }
  }

  for (const plat of room.platforms) {
    if (!plat.hazard) continue;
    if (plat.x + plat.w < viewL || plat.x > viewR || plat.y + plat.h < viewT || plat.y > viewB) continue;
    pfx.addRadialLight(plat.x + plat.w * 0.5, plat.y + 8, Math.min(48, plat.w * 0.6), 42, 16, 58);
  }

  // 7. Destructible Runic Obsidian Seal Barrier (封印石壁)
  if (room.sealBarrier && state.sealIntact) {
    const sb = room.sealBarrier;
    const pulse = 0.5 + 0.5 * Math.sin(time * 6.5);
    pfx.fillPatternRect(
      atlas.sealWallTile,
      atlas.sealWallCache,
      sb.x,
      sb.y,
      sb.w,
      sb.h,
      sb.x,
      sb.y
    );
    pfx.addRadialLight(
      sb.x + sb.w * 0.5,
      sb.y + sb.h * 0.5,
      34,
      (58 + pulse * 30) | 0,
      22,
      (98 + pulse * 38) | 0
    );
  }

  // 8. Generated Pixel-Art Lunar Shrine Checkpoint (银月祭坛)
  if (room.shrine) {
    const sh = room.shrine;
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    pfx.drawSprite(
      state.shrineActive ? atlas.shrineAltar : atlas.shrineAltarDim,
      sh.x,
      sh.y,
      0,
      60,
      82,
      false,
      1,
      1,
      1,
      0.25
    );

    const glowY = sh.y - 18 + Math.sin(time * 3) * 1.5;
    pfx.addRadialLight(
      sh.x,
      glowY,
      38,
      state.shrineActive ? ((38 + pulse * 24) | 0) : 18,
      state.shrineActive ? ((84 + pulse * 38) | 0) : 38,
      state.shrineActive ? ((132 + pulse * 46) | 0) : 68
    );
  }

  // 9. Relic Pedestal (`atlas.relicEmblem` + Procedural PixelFX Magic Circle)
  if (room.relic) {
    const rl = room.relic;
    const isBreaker = rl.relicId === RelicId.AbyssalBreaker;
    const isTassel = rl.relicId === RelicId.ZanshinTassel;
    renderPfxMagicCircle(
      pfx,
      rl.x,
      rl.y - 2,
      16,
      5.5,
      time,
      isBreaker ? 'violet' : isTassel ? 'gold' : 'cyan',
      0.92
    );

    if (state.hasRelicOnPedestal) {
      const hoverY = rl.y - 18 + Math.sin(time * 4.5) * 2.4;
      const cr = isBreaker ? 215 : isTassel ? 255 : 115;
      const cg = isBreaker ? 122 : isTassel ? 215 : 238;
      const cb = isBreaker ? 255 : isTassel ? 115 : 255;

      pfx.drawSprite(atlas.relicEmblem, rl.x, hoverY, 0, 24, 32, false, 0.82, 0.82, 1, 0.25);
      pfx.addRadialLight(rl.x, hoverY, 34, (cr * 0.48) | 0, (cg * 0.48) | 0, (cb * 0.48) | 0);
    }
  }

  // 10. Vitality Vessel Pedestal (古月圣杯 +25 Max HP)
  if (room.vessel) {
    const vs = room.vessel;
    renderPfxMagicCircle(pfx, vs.x, vs.y - 2, 13, 4.5, time, 'emerald', 0.85);
    if (state.hasVesselOnPedestal) {
      const hy = vs.y - 15 + Math.sin(time * 4) * 2;
      pfx.drawSprite(atlas.relicEmblem, vs.x, hy, 0, 24, 32, false, 0.66, 0.66, 0.98, 0.25);
      pfx.addRadialLight(vs.x, hy, 28, 28, 98, 74);
    }
  }

  // 10b. Roguevania Blessing Scroll Altar (赐福卷轴台)
  if (room.altar) {
    const alt = room.altar;
    renderPfxMagicCircle(pfx, alt.x, alt.y - 2, 15, 5, time, 'violet', 0.88);

    if (state.hasAltarOnPedestal) {
      const floatY = Math.round(Math.sin(time * 3.8 + alt.x * 0.1) * 8) * 0.25;
      pfx.drawSprite(atlas.scrollAltar, alt.x, alt.y - 4 + floatY, 0, 22, 54, false, 1, 1, 1, 0.25);
      const orbPhase = time * 3.2;
      pfx.setPixel(alt.x - 6.5 + Math.cos(orbPhase) * 2.2, alt.y - 21 + floatY, 255, 86, 126, 2);
      pfx.setPixel(alt.x + Math.sin(orbPhase * 1.1) * 2.0, alt.y - 24 + floatY, 88, 236, 255, 2);
      pfx.setPixel(alt.x + 6.5 - Math.cos(orbPhase) * 2.2, alt.y - 21 + floatY, 255, 216, 112, 2);
      pfx.addRadialLight(alt.x, alt.y - 18 + floatY, 34, 62, 54, 96);
    }
  }

  // 11. Combat Room Exit Lockdown Gates (`未击杀当前房间所有敌人时关闭出口`)
  if (state.roomLocked && state.lockedExitBarriers && state.lockedExitBarriers.length > 0) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 6.8);
    for (const gate of state.lockedExitBarriers) {
      if (gate.x + gate.w < viewL || gate.x > viewR || gate.y + gate.h < viewT || gate.y > viewB) {
        continue;
      }
      pfx.fillPatternRect(
        atlas.portcullisGate,
        atlas.portcullisCache,
        gate.x,
        gate.y,
        gate.w,
        gate.h,
        gate.x,
        gate.y
      );
      const gcx = gate.x + gate.w * 0.5;
      const gcy = gate.y + gate.h * 0.5;
      const isHorizontalGate = gate.w > gate.h;
      renderPfxMagicCircle(
        pfx,
        gcx,
        gcy,
        isHorizontalGate ? 14 : 6.5,
        isHorizontalGate ? 6.5 : 14,
        time,
        'crimson',
        0.82 + pulse * 0.18
      );
      pfx.addRadialLight(
        gcx,
        gcy,
        34,
        (78 + pulse * 44) | 0,
        16,
        (36 + pulse * 20) | 0
      );
    }
    return;
  }

  // 12. Open Room Exit Indicators (Only rendered when room is unlocked!)
  for (const ex of room.exits) {
    const cx = ex.x + ex.w * 0.5;
    const cy = ex.y + ex.h * 0.5;
    const isBossDoor = BOSS_ROOM_IDS.has(ex.targetRoom);
    pfx.addRadialLight(
      cx,
      cy,
      28,
      isBossDoor ? 68 : 22,
      isBossDoor ? 18 : 48,
      isBossDoor ? 38 : 84
    );
    const bob = Math.sin(time * 5) * 2;
    const cr = isBossDoor ? 255 : 160;
    const cg = isBossDoor ? 115 : 230;
    const cb = isBossDoor ? 150 : 255;
    if (ex.direction === 'right') {
      const ax = ex.x - 6 + bob;
      pfx.drawLine(ax - 3.5, cy - 4, ax, cy, cr, cg, cb, 0.45, 3);
      pfx.drawLine(ax - 3.5, cy + 4, ax, cy, cr, cg, cb, 0.45, 3);
    } else if (ex.direction === 'left') {
      const ax = ex.x + ex.w + 6 - bob;
      pfx.drawLine(ax + 3.5, cy - 4, ax, cy, cr, cg, cb, 0.45, 3);
      pfx.drawLine(ax + 3.5, cy + 4, ax, cy, cr, cg, cb, 0.45, 3);
    } else if (ex.direction === 'up') {
      const ay = ex.y + ex.h + 8 - bob;
      pfx.drawLine(cx - 4, ay + 3.5, cx, ay, cr, cg, cb, 0.45, 3);
      pfx.drawLine(cx + 4, ay + 3.5, cx, ay, cr, cg, cb, 0.45, 3);
    } else {
      const ay = ex.y - 8 + bob;
      pfx.drawLine(cx - 4, ay - 3.5, cx, ay, cr, cg, cb, 0.45, 3);
      pfx.drawLine(cx + 4, ay - 3.5, cx, ay, cr, cg, cb, 0.45, 3);
    }
  }
}

/**
 * Dead Cells-Inspired Foreground 1.24x Parallax Depth Layer:
 * Hanging wrought-iron chains extracted from `pixel_cave_decor_sheet`.
 */
export function renderRoomForegroundParallax(
  pfx: PixelFXBuffer,
  room: RoomDef,
  time: number
): void {
  const atlas = getPixelAtlas();
  const fgSpan = Math.max(WORLD_WIDTH * 1.4, room.width * 1.25);

  for (let baseX = 284; baseX < fgSpan; baseX += 310) {
    const screenRelX = baseX - pfx.camX * 1.24;
    if (screenRelX < -24 || screenRelX > WORLD_WIDTH + 24) continue;

    const sway = Math.sin(time * 1.35 + baseX * 0.04) * 1.5;
    const wx = pfx.camX + screenRelX + sway;
    const chainLen = 56 + ((baseX * 7) % 30);
    const topY = pfx.camY - 4;

    pfx.fillPatternRect(
      atlas.ironChainTile,
      atlas.ironChainCache,
      wx - 1.75,
      topY,
      3.5,
      chainLen,
      wx,
      topY
    );
    pfx.fillDitherRect(wx - 2.0, topY, 4.0, chainLen, 6, 8, 18, 0.56);
  }
}

// --- 2. Zero-Texture `patch-gg/pixelfx` Dash & Skill Phase-Shift Afterimages ---

export function renderAfterimages(pfx: PixelFXBuffer): void {
  renderPfxAfterimages(pfx, pfx.ghosts);
}

// --- 3. Spring-Inertia Secondary Motion ---

export function updatePlayerClothAndHair(player: PlayerEntity, dt: number, time: number): void {
  const pose = computeAriaPose(player, time);
  const f = pose.facing;
  const clampedLeanX = Math.max(-3.0, Math.min(3.0, pose.torsoLeanX * 0.38));
  const anchorX = player.x + clampedLeanX;
  const anchorY = player.y + (-29 + pose.torsoDropY) * pose.squashY;

  const isSpinMove =
    player.moveId === MoveId.Slash3 ||
    player.moveId === MoveId.AirSlash2 ||
    player.spinFlipTimer > 0;
  const spinWhipX = isSpinMove ? Math.cos(time * 28) * 65 : 0;
  const spinWhipY = isSpinMove ? Math.sin(time * 28) * 32 - 18 : 0;
  const windX = -f * 20 - player.vx * 0.24 + Math.sin(time * 6.2) * 9 + spinWhipX;

  const stepDynamicChain = (
    nodes: HairNode[],
    startX: number,
    startY: number,
    segLen: number,
    gravityY: number,
    spreadX: number
  ) => {
    if (nodes.length === 0) return;
    nodes[0].x = startX;
    nodes[0].y = startY;
    nodes[0].vx = 0;
    nodes[0].vy = 0;

    const damping = Math.pow(0.08, dt);
    for (let i = 1; i < nodes.length; i++) {
      const prev = nodes[i - 1];
      const cur = nodes[i];
      const vx = (cur.vx ?? 0) * damping + (windX + spreadX) * dt * 6.5;
      const vy = (cur.vy ?? 0) * damping + (gravityY - player.vy * 0.14 + spinWhipY) * dt * 6.5;

      let nx = cur.x + vx * dt * 9.5;
      let ny = cur.y + vy * dt * 9.5;

      const dx = nx - prev.x;
      const dy = ny - prev.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      if (dist > segLen) {
        nx = prev.x + (dx / dist) * segLen;
        ny = prev.y + (dy / dist) * segLen;
      }

      cur.vx = (nx - cur.x) / Math.max(0.004, dt * 9.5);
      cur.vy = (ny - cur.y) / Math.max(0.004, dt * 9.5);
      cur.x = nx;
      cur.y = ny;
    }
  };

  stepDynamicChain(player.hairLeft, anchorX - f * 4.2, anchorY, 3.6, 24, -f * 7);
  stepDynamicChain(player.hairRight, anchorX - f * 1.4, anchorY + 0.8, 3.5, 26, -f * 2.5);
  stepDynamicChain(
    player.capeNodes,
    player.x + clampedLeanX * 0.75 - f * 2.8,
    player.y + (-23 + pose.torsoDropY) * pose.squashY,
    4.3,
    28,
    -f * 9
  );
}

// --- 4. Heroine Aria Renderer: 26 Generated Action Clips + Generated Katana & Slash-Wave Sprites ---

export function renderPlayerAria(
  pfx: PixelFXBuffer,
  player: PlayerEntity,
  time: number,
  gamePhase: GamePhase
): void {
  if (player.hurtTimer > 0 && player.hurtTimer <= 0.08 && Math.floor(time * 28) % 2 === 0) {
    return;
  }

  const atlas = getPixelAtlas();
  const bank = getCharacterSpriteBank();
  if (!bank?.ready) return;

  const rig = solveAriaSkeleton(player, time);
  const sample = resolveAriaAnimSample(player, gamePhase, time);
  const f = rig.facing;
  const px = player.x;
  const py = player.y;
  const hitFlash = player.flashTimer > 0;

  // 1. Lunar Blade Aura & Ground Contact Shadow
  if (player.bladeEnergy >= 50 && gamePhase === GamePhase.Playing) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 8);
    pfx.addRadialLight(
      px,
      py - 19,
      26,
      (24 + pulse * 20) | 0,
      (52 + pulse * 32) | 0,
      (94 + pulse * 42) | 0
    );
  } else {
    pfx.addRadialLight(px, py - 19, 18, 16, 24, 46);
  }

  if (player.grounded) {
    const shadowW = sample.clipId === 'crouch' || sample.clipId === 'slide_slash' ? 19.0 : 16.5;
    pfx.fillDitherRect(px - shadowW * 0.5, py - 0.25, shadowW, 1.75, 5, 7, 16, 0.74);
  }

  // 2. 60 FPS Secondary Spine Streamers + Generated Lacquered Scabbard ("鞘")
  const scabbardLeanDelta = rig.scabbard.x - (px - f * 1.8);
  const clampedScabbardX =
    px - f * 2.6 + Math.max(-2.4, Math.min(2.4, scabbardLeanDelta * 0.35));
  renderAriaSecondarySpineStreamers(
    pfx,
    player,
    clampedScabbardX,
    rig.scabbard.y - 4.2,
    f,
    time
  );
  pfx.drawSprite(
    atlas.aria.scabbard,
    clampedScabbardX,
    rig.scabbard.y - 4.2,
    rig.scabbard.angle,
    8,
    8,
    f === -1,
    0.92,
    0.92,
    1,
    0.25
  );

  // 3. Dedicated Per-Action Sprite Clip (26 pure model-generated clips)
  const activeClip = bank.ariaClips[sample.clipId];
  const smoothSample: SmoothFrameSample = sampleClipFrameSmooth(
    activeClip,
    sample.progress01,
    sample.loop
  );
  const activeFrame: ExtractedSpriteFrame = smoothSample.frame;

  drawExtractedFrame(
    pfx,
    activeFrame,
    px,
    py,
    f,
    hitFlash ? 'flash' : 'normal'
  );

  // 4. Title Screen Ceremonial Guard Katana "月咏 (Tsukuyomi)"
  if (gamePhase === GamePhase.Title) {
    const grip = getInterpolatedGripWorldPos(
      smoothSample.frame,
      smoothSample.nextFrame,
      smoothSample.subT,
      px,
      py,
      f
    );
    const kx = grip.x;
    const ky = grip.y;
    const guardAngle = mirrorLocalAngle(grip.restAngle, f) + Math.sin(time * 2.4) * 0.025 * f;
    pfx.drawSprite(
      atlas.aria.katana,
      kx,
      ky,
      guardAngle,
      14,
      14,
      f === -1,
      0.84,
      0.88,
      1,
      0.25
    );
    const glintDist = 3 + ((time * 16) % 21);
    const gx = kx + Math.cos(guardAngle) * glintDist;
    const gy = ky + Math.sin(guardAngle) * glintDist;
    pfx.setPixel(gx, gy, 255, 255, 255, 4);
    pfx.addRadialLight(gx, gy, 16, 28, 52, 94);
    return;
  }

  // 5. Subdued Low-Brightness Zanshin Iaido Sheathe Glint (`收刀·残心`)
  if (player.zanshinFlashTimer > 0) {
    const gx = clampedScabbardX;
    const gy = rig.scabbard.y - 4.2;
    pfx.drawLine(gx - 5.5, gy, gx + 5.5, gy, 138, 186, 214, 0.36, 1);
    pfx.drawLine(gx, gy - 5.5, gx, gy + 5.5, 92, 158, 196, 0.36, 1);
    pfx.addRadialLight(gx, gy, 10, 14, 28, 44);
  }

  // 6. 60 FPS Sub-Frame Interpolated Hand-Grip Spline + Katana Angle
  const gripPos = getInterpolatedGripWorldPos(
    smoothSample.frame,
    smoothSample.nextFrame,
    smoothSample.subT,
    px,
    py,
    f
  );
  const handX = gripPos.x;
  const handY = gripPos.y;
  let bladeAngle = rig.katana.angle;
  let prevBladeAngle = rig.prevBladeAngle;

  const frameCarryAngle = mirrorLocalAngle(gripPos.restAngle, f);
  if (player.moveId === MoveId.None) {
    const microBob = Math.sin(time * 3.8 + player.gaitPhase * 0.35) * 0.028 * f;
    bladeAngle = frameCarryAngle + microBob;
    prevBladeAngle = bladeAngle;
  } else {
    const spec = MOVES[player.moveId];
    const phase = getMovePhase(player.moveId, player.moveTimer);
    if (phase === 'recovery') {
      const recU = Math.max(
        0,
        Math.min(1, (player.moveTimer - spec.windup - spec.active) / Math.max(0.001, spec.recovery))
      );
      const smoothRec = recU * recU * (3 - 2 * recU);
      bladeAngle = lerpShortestAngle(rig.katana.angle, frameCarryAngle, Math.min(1, smoothRec * 1.25));
    } else {
      bladeAngle = rig.katana.angle;
    }
  }

  // 7. Zero-Texture `patch-gg/pixelfx` Procedural Katana Swing Smear
  const arcDelta = bladeAngle - prevBladeAngle;
  const isDimensionMove = player.moveId === MoveId.DimensionCut;
  if (rig.smearIntensity > 0.08 && Math.abs(arcDelta) > 0.04) {
    const smearPal = isDimensionMove
      ? 'void'
      : rig.smearColor === 'crimson'
        ? 'crimson'
        : rig.smearColor === 'cyan'
          ? 'cyan'
          : rig.smearColor === 'violet'
            ? 'violet'
            : 'silver';
    renderPfxWeaponSmear(
      pfx,
      handX,
      handY,
      prevBladeAngle,
      bladeAngle,
      rig.bladeLen,
      rig.smearIntensity,
      smearPal
    );
  }

  // 8. Anticipation Tsuba Glint during Windup
  if (
    player.moveId !== MoveId.None &&
    !isDimensionMove &&
    getMovePhase(player.moveId, player.moveTimer) === 'windup'
  ) {
    pfx.drawLine(handX - 5.5, handY, handX + 5.5, handY, 255, 255, 255, 0.9, 3);
    pfx.drawLine(handX, handY - 5.5, handX, handY + 5.5, 132, 238, 255, 0.9, 3);
    pfx.addRadialLight(handX, handY, 15, 68, 118, 185);
  }

  // 9. Blit Generated Katana Weapon Sprite ("月咏")
  const bladeScale = rig.bladeLen / 31.0;
  pfx.drawSprite(
    hitFlash ? atlas.aria.katanaFlash : atlas.aria.katana,
    handX,
    handY,
    bladeAngle,
    14,
    14,
    f === -1,
    bladeScale,
    0.92,
    1,
    0.25
  );
}

// --- 5. Enemy & Boss Renderer: Generated Sprite Clips + Procedural PixelFX Weapon Smears & Auras ---

function renderEnemyWeaponSmear(
  pfx: PixelFXBuffer,
  gripX: number,
  gripY: number,
  kind: EnemyKind,
  rig: ReturnType<typeof solveEnemySkeleton>,
  weaponLen: number,
  palette: 'crimson' | 'cyan' | 'violet'
): void {
  renderPfxWeaponSmear(
    pfx,
    gripX,
    gripY,
    rig.prevWeaponAngle,
    rig.weapon.angle,
    weaponLen,
    rig.weaponSmearIntensity,
    getEnemySmearPalette(kind, palette)
  );
}

export function renderEnemy(pfx: PixelFXBuffer, e: EnemyEntity, time: number): void {
  const ex = e.x;
  const ey = e.y;
  const f = e.facing;
  const isFlash = e.flashTimer > 0;
  const atlas = getPixelAtlas();
  const bank = getCharacterSpriteBank();

  if (e.aiState === EnemyAIState.KO) {
    const cov = Math.max(0, e.koTimer / 0.38);
    renderPfxEnemyKO(pfx, ex, ey - 18, cov, e.id);
    return;
  }

  if (e.aiState === EnemyAIState.Spawn) {
    const cov = 1 - e.stateTimer / 0.45;
    renderPfxEnemySpawn(pfx, ex, ey, cov, time);
    return;
  }

  pfx.fillDitherRect(ex - 9, ey - 0.25, 18, 1.75, 5, 6, 14, 0.68);

  const rig = solveEnemySkeleton(e, time);
  const sample = resolveEnemyAnimSample(e, time);
  const isWindup = e.aiState === EnemyAIState.Windup;
  const isAttack = e.aiState === EnemyAIState.Attack;

  // Phase-2 Boss Enrage PixelFX Magic Circle & Aura
  if (isBossEnemyKind(e.kind) && e.bossEnraged) {
    const enragePulse = 0.5 + 0.5 * Math.sin(time * 14);
    renderPfxMagicCircle(pfx, ex, ey - 2, 22 + enragePulse * 3, 6.5, time * 1.4, 'crimson', 0.92);
    pfx.addRadialLight(ex, ey - 20, 34, 96, 24, 68);
  }

  // Crimson danger star telegraph during Windup (triggers Perfect-Dodge cue!)
  if (isWindup) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 32);
    const wy =
      ey -
      (e.kind === EnemyKind.Warden
        ? 54
        : e.kind === EnemyKind.Archon || e.kind === EnemyKind.Sovereign
          ? 51
          : e.kind === EnemyKind.Halberdier
            ? 44
            : 38);
    pfx.drawLine(ex - 8, wy, ex + 8, wy, 255, 68, 108, 0.94, 3);
    pfx.drawLine(ex, wy - 8, ex, wy + 8, 255, 232, 242, 0.94, 3);
    pfx.addRadialLight(ex, wy, 24, (135 + pulse * 85) | 0, 25, 58);
  }

  // Roguevania Elite Affix PixelFX Crown Crest
  if (e.eliteAffix) {
    const ec =
      e.eliteAffix === 'frenzy'
        ? [255, 72, 114]
        : e.eliteAffix === 'storm'
          ? [78, 234, 255]
          : [255, 212, 92];
    const crownY = ey - (e.kind === EnemyKind.Halberdier ? 50 : 45);
    renderPfxEliteCrest(pfx, ex, crownY, e.eliteAffix, time);
    pfx.addRadialLight(ex, ey - 18, 22, (ec[0] * 0.24) | 0, (ec[1] * 0.24) | 0, (ec[2] * 0.24) | 0);
  }

  const recoilTilt = e.aiState === EnemyAIState.Hitstun ? -f * 0.1 : 0;

  if (e.kind === EnemyKind.Stalker) {
    const wepSprite = isFlash ? atlas.stalker.flash.weapon : atlas.stalker.weapon;
    let frame: ExtractedSpriteFrame | null = null;
    let grip = { x: ex + f * 6.0, y: ey - 14.0, offX: ex - f * 3.5, offY: ey - 15.0 };

    if (bank?.stalkerClips) {
      frame = sampleClipFrame(bank.stalkerClips[sample.clipId], sample.progress01, sample.loop);
      grip = getFrameGripWorldPos(frame, ex, ey, f);
    }

    pfx.drawSprite(
      wepSprite,
      grip.offX,
      grip.offY,
      rig.offhandProp.angle,
      10,
      11,
      f === -1,
      0.72,
      0.72
    );

    if (frame) {
      drawExtractedFrame(pfx, frame, ex, ey, f, isFlash ? 'flash' : 'normal');
    }

    renderEnemyWeaponSmear(pfx, grip.x, grip.y, e.kind, rig, 18, 'crimson');
    const kukriAngle =
      isWindup || isAttack
        ? rig.weapon.angle
        : frame
          ? mirrorLocalAngle(frame.restBladeAngle, f)
          : rig.weapon.angle;
    pfx.drawSprite(wepSprite, grip.x, grip.y, kukriAngle, 10, 11, f === -1, 0.86, 0.86);
  } else if (e.kind === EnemyKind.Weaver) {
    const hoverY = Math.round(Math.sin(time * 4.2 + e.id) * 2.5);
    let grip = { x: ex + f * 7.5, y: ey - 22.0 + hoverY, offX: ex, offY: ey - 20 };

    if (bank?.weaverClips) {
      const frame = sampleClipFrame(bank.weaverClips[sample.clipId], sample.progress01, sample.loop);
      drawExtractedFrame(pfx, frame, ex, ey + hoverY, f, isFlash ? 'flash' : 'normal');
      grip = getFrameGripWorldPos(frame, ex, ey + hoverY, f);
    }

    const tomeSprite = isFlash ? atlas.weaver.flash.weapon : atlas.weaver.weapon;
    const tomeX = grip.x + f * 3.2;
    const tomeY = grip.y - 1.8 + Math.cos(time * 5.2 + e.id) * 1.1;
    pfx.drawSprite(tomeSprite, tomeX, tomeY, Math.sin(time * 4.5 + e.id) * 0.12, 20, 22, false, f * 0.88, 0.88);
    pfx.addRadialLight(tomeX, tomeY - 2, isWindup ? 28 : 18, 86, 38, 132);
  } else if (e.kind === EnemyKind.Halberdier) {
    let frame: ExtractedSpriteFrame | null = null;
    let grip = { x: ex - f * 1.2, y: ey - 21.0, offX: ex + f * 7.6, offY: ey - 19.2 };

    if (bank?.halberdierClips) {
      frame = sampleClipFrame(bank.halberdierClips[sample.clipId], sample.progress01, sample.loop);
      drawExtractedFrame(pfx, frame, ex, ey, f, isFlash ? 'flash' : 'normal');
      grip = getFrameGripWorldPos(frame, ex, ey, f);
    }

    renderEnemyWeaponSmear(pfx, grip.x, grip.y, e.kind, rig, 26, 'crimson');
    const halbSprite = isFlash ? atlas.halberdier.flash.weapon : atlas.halberdier.weapon;
    const halbAng =
      isWindup || isAttack
        ? rig.weapon.angle
        : frame
          ? mirrorLocalAngle(frame.restBladeAngle, f) + Math.sin(time * 2.8 + e.id) * 0.03 * f
          : rig.weapon.angle;
    pfx.drawSprite(halbSprite, grip.x, grip.y, halbAng, 20, 18, f === -1, 0.92, 0.92);

    if (e.shieldActive && atlas.halberdier.offhand) {
      const shSprite = isFlash ? atlas.halberdier.flash.offhand! : atlas.halberdier.offhand;
      pfx.drawSprite(shSprite, grip.offX, grip.offY, recoilTilt * 0.5, 18, 44, false, f * 0.82, 0.82);
      pfx.addRadialLight(grip.offX, grip.offY, 15, 26, 58, 98);
    }
  } else if (e.kind === EnemyKind.Reaper) {
    const hoverY = Math.round(Math.sin(time * 4.8 + e.id) * 2.0);
    let frame: ExtractedSpriteFrame | null = null;
    let grip = { x: ex + f * 5.2, y: ey - 19.0 + hoverY, offX: ex, offY: ey - 18 + hoverY };

    if (bank?.reaperClips) {
      frame = sampleClipFrame(bank.reaperClips[sample.clipId], sample.progress01, sample.loop);
      drawExtractedFrame(pfx, frame, ex, ey + hoverY, f, isFlash ? 'flash' : 'normal');
      grip = getFrameGripWorldPos(frame, ex, ey + hoverY, f);
    }

    renderEnemyWeaponSmear(pfx, grip.x, grip.y, e.kind, rig, 25, 'cyan');
    const scytheSprite = isFlash ? atlas.reaper.flash.weapon : atlas.reaper.weapon;
    const scytheAng =
      isWindup || isAttack
        ? rig.weapon.angle
        : frame
          ? mirrorLocalAngle(frame.restBladeAngle, f) + Math.sin(time * 3.4 + e.id) * 0.04 * f
          : rig.weapon.angle;
    pfx.drawSprite(scytheSprite, grip.x, grip.y, scytheAng, 20, 21, f === -1, 0.88, 0.88);
    pfx.addRadialLight(grip.x + f * 10, grip.y, 16, 18, 64, 86);
  } else if (e.kind === EnemyKind.Arbalist) {
    let frame: ExtractedSpriteFrame | null = null;
    let grip = { x: ex + f * 5.6, y: ey - 18.0, offX: ex, offY: ey - 18 };

    if (bank?.arbalistClips) {
      frame = sampleClipFrame(bank.arbalistClips[sample.clipId], sample.progress01, sample.loop);
      drawExtractedFrame(pfx, frame, ex, ey, f, isFlash ? 'flash' : 'normal');
      grip = getFrameGripWorldPos(frame, ex, ey, f);
    }

    if (isWindup) {
      pfx.drawLine(grip.x + f * 8, grip.y, grip.x + f * 155, grip.y, 255, 68, 108, 0.45, 2);
      pfx.drawLine(grip.x + f * 8, grip.y - 4, grip.x + f * 145, grip.y - 16, 255, 68, 108, 0.25, 1);
      pfx.drawLine(grip.x + f * 8, grip.y + 4, grip.x + f * 145, grip.y + 16, 255, 68, 108, 0.25, 1);
    }

    const xbowSprite = isFlash ? atlas.arbalist.flash.weapon : atlas.arbalist.weapon;
    const xbowAng =
      isWindup || isAttack
        ? rig.weapon.angle
        : frame
          ? mirrorLocalAngle(frame.restBladeAngle, f)
          : rig.weapon.angle;
    pfx.drawSprite(xbowSprite, grip.x, grip.y, xbowAng, 16, 18, f === -1, 0.86, 0.86);
  } else if (e.kind === EnemyKind.Warden) {
    let frame: ExtractedSpriteFrame | null = null;
    let grip = { x: ex + f * 6.5, y: ey - 25.0, offX: ex - f * 6.5, offY: ey - 24.0 };

    if (bank?.wardenClips) {
      frame = sampleClipFrame(bank.wardenClips[sample.clipId], sample.progress01, sample.loop);
      drawExtractedFrame(pfx, frame, ex, ey, f, isFlash ? 'flash' : 'normal');
      grip = getFrameGripWorldPos(frame, ex, ey, f);
    }

    if (atlas.warden.offhand) {
      const shSprite = isFlash ? atlas.warden.flash.offhand! : atlas.warden.offhand;
      pfx.drawSprite(shSprite, grip.offX, grip.offY, recoilTilt * 0.4, 19, 44, false, f * 0.84, 0.84);
    }

    renderEnemyWeaponSmear(pfx, grip.x, grip.y, e.kind, rig, 32, 'crimson');
    const axeSprite = isFlash ? atlas.warden.flash.weapon : atlas.warden.weapon;
    const axeAng =
      isWindup || isAttack
        ? rig.weapon.angle
        : frame
          ? mirrorLocalAngle(frame.restBladeAngle, f) + Math.sin(time * 2.2) * 0.03 * f
          : rig.weapon.angle;
    pfx.drawSprite(axeSprite, grip.x, grip.y, axeAng, 22, 24, f === -1, 0.96, 0.96);
    pfx.addRadialLight(ex, ey - 26, e.bossEnraged ? 38 : 26, e.bossEnraged ? 108 : 64, 24, 38);
  } else if (e.kind === EnemyKind.Archon) {
    const bobY = Math.round(Math.sin(time * 3.4) * 2.2);
    renderPfxBossHalo(pfx, ex, ey - 37 + bobY, 13, time, 'violet', Boolean(e.bossEnraged));

    let frame: ExtractedSpriteFrame | null = null;
    let grip = { x: ex + f * 7.5, y: ey - 25.0 + bobY, offX: ex, offY: ey - 24 + bobY };

    if (bank?.archonClips) {
      frame = sampleClipFrame(bank.archonClips[sample.clipId], sample.progress01, sample.loop);
      drawExtractedFrame(pfx, frame, ex, ey + bobY, f, isFlash ? 'flash' : 'normal');
      grip = getFrameGripWorldPos(frame, ex, ey + bobY, f);
    }

    renderEnemyWeaponSmear(pfx, grip.x, grip.y, e.kind, rig, 28, 'violet');
    const scepterSprite = isFlash ? atlas.archon.flash.weapon : atlas.archon.weapon;
    const scepterAng =
      isWindup || isAttack
        ? rig.weapon.angle
        : frame
          ? mirrorLocalAngle(frame.restBladeAngle, f) + Math.sin(time * 3.0) * 0.04 * f
          : rig.weapon.angle;
    pfx.drawSprite(scepterSprite, grip.x, grip.y, scepterAng, 20, 20, f === -1, 0.94, 0.94);
    pfx.addRadialLight(ex, ey - 28 + bobY, e.bossEnraged ? 40 : 28, 64, 42, e.bossEnraged ? 128 : 88);
  } else {
    const bobY = Math.round(Math.sin(time * 3.2) * 1.2);
    renderPfxBossHalo(pfx, ex, ey - 36 + bobY, 13.5, time, 'crimson', Boolean(e.bossEnraged));

    let frame: ExtractedSpriteFrame | null = null;
    let grip = { x: ex - f * 2.0, y: ey - 24.0 + bobY, offX: ex, offY: ey - 24 + bobY };

    if (bank?.sovereignClips) {
      frame = sampleClipFrame(bank.sovereignClips[sample.clipId], sample.progress01, sample.loop);
      drawExtractedFrame(pfx, frame, ex, ey + bobY, f, isFlash ? 'flash' : 'normal');
      grip = getFrameGripWorldPos(frame, ex, ey + bobY, f);
    }

    renderEnemyWeaponSmear(pfx, grip.x, grip.y, e.kind, rig, 34, 'crimson');
    const gsSprite = isFlash ? atlas.sovereign.flash.weapon : atlas.sovereign.weapon;
    const gsAng =
      isWindup || isAttack
        ? rig.weapon.angle
        : frame
          ? mirrorLocalAngle(frame.restBladeAngle, f) + Math.sin(time * 2.4) * 0.03 * f
          : rig.weapon.angle;
    pfx.drawSprite(gsSprite, grip.x, grip.y, gsAng, 18, 20, f === -1, 0.96, 0.96);
    pfx.addRadialLight(
      ex,
      ey - 27 + bobY,
      e.bossEnraged ? 42 : 28,
      e.bossEnraged ? 105 : 65,
      18,
      44
    );
  }

  // Crisp Enemy Vitality & Rally Bar (Non-Boss)
  if (!isBossEnemyKind(e.kind) && e.hp < e.maxHp && e.hp > 0) {
    const barW = e.eliteAffix ? 22 : 18;
    const barX = ex - barW * 0.5;
    const barY = ey - (e.kind === EnemyKind.Halberdier ? 46 : 41);
    pfx.fillRect(barX - 0.6, barY - 0.6, barW + 1.2, 3.2, 7, 9, 20);
    const rallyW = (e.rallyHp / e.maxHp) * barW;
    const hpW = (e.hp / e.maxHp) * barW;
    if (rallyW > hpW) {
      pfx.fillRect(barX, barY, rallyW, 2.0, 248, 236, 242);
    }
    pfx.fillRect(
      barX,
      barY,
      hpW,
      2.0,
      e.eliteAffix ? 255 : 245,
      e.eliteAffix ? 176 : 72,
      e.eliteAffix ? 72 : 112
    );
    pfx.fillRect(barX, barY, hpW, 0.5, 255, 198, 212);
  }
}

// --- 6. Zero-Texture `patch-gg/pixelfx` Crescent Sword-Waves & Astral Starblade Projectiles ---

export function renderProjectiles(
  pfx: PixelFXBuffer,
  projectiles: ProjectileEntity[],
  time = 0
): void {
  renderPfxProjectiles(pfx, projectiles, time);
}
