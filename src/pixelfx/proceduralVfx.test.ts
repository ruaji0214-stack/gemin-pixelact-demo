import assert from 'node:assert/strict';
import test from 'node:test';
import { EnemyKind, ProjectileEntity } from '../game/types';
import type { PixelFXBuffer } from './engine';
import {
  PFX_CELL,
  PFX_GRID_H,
  PFX_GRID_W,
  PFX_PALETTES,
  PixelFXStage,
  bayerThreshold01,
  getEnemySmearPalette,
  quantizeBayerStop,
  renderPfxAfterimages,
  renderPfxBossHalo,
  renderPfxEliteCrest,
  renderPfxEnemyKO,
  renderPfxEnemySpawn,
  renderPfxMagicCircle,
  renderPfxParticles,
  renderPfxProjectiles,
  renderPfxRing,
  renderPfxSlash,
  renderPfxTorchFlame,
  renderPfxWeaponSmear,
} from './proceduralVfx';

function createMockPfxHarness() {
  let drawImageCalls = 0;
  let styleSwitches = 0;
  let fillRectCalls = 0;
  let lightCalls = 0;
  let currentStyle = '#000';

  const mockCtx = {
    get fillStyle() {
      return currentStyle;
    },
    set fillStyle(val: string) {
      if (val !== currentStyle) {
        currentStyle = val;
        styleSwitches++;
      }
    },
    fillRect(x: number, y: number, w: number, h: number) {
      assert.equal(x % PFX_CELL, 0, 'X must snap to integer PixelFX grid');
      assert.equal(y % PFX_CELL, 0, 'Y must snap to integer PixelFX grid');
      assert.equal(w % PFX_CELL, 0, 'Span width must be multiple of PFX_CELL');
      assert.equal(h, PFX_CELL, 'Span height must equal PFX_CELL');
      fillRectCalls++;
    },
    drawImage() {
      drawImageCalls++;
    },
  } as unknown as CanvasRenderingContext2D;

  const mockPfx = {
    camX: 0,
    camY: 0,
    ctx: mockCtx,
    addRadialLight() {
      lightCalls++;
    },
  } as unknown as PixelFXBuffer;

  return {
    mockPfx,
    getStats: () => ({ drawImageCalls, styleSwitches, fillRectCalls, lightCalls }),
  };
}

test('patch-gg/pixelfx 6-stop palettes, 4x4 Bayer threshold dithering, and span-merging stage are deterministic', () => {
  assert.equal(PFX_GRID_W * PFX_CELL, 1920);
  assert.equal(PFX_GRID_H * PFX_CELL, 1080);

  for (const pal of Object.values(PFX_PALETTES)) {
    assert.equal(pal.css.length, 6);
    assert.equal(pal.rgb.length, 6);
  }

  // Bayer matrix repeats every 4x4 cells and spans (0, 1)
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const b = bayerThreshold01(x, y);
      assert.ok(b > 0 && b < 1);
      assert.equal(b, bayerThreshold01(x + 4, y + 8));
    }
  }

  assert.equal(quantizeBayerStop(0, 2, 2, 6), 0);
  assert.equal(quantizeBayerStop(1, 2, 2, 6), 6);

  // Contiguous horizontal pixels of identical stop merge into a single fillRect span
  const harness = createMockPfxHarness();
  const stage = new PixelFXStage();
  stage.begin();
  stage.plot(10, 20, 4);
  stage.plot(11, 20, 4);
  stage.plot(12, 20, 4);
  // Higher stop overwrites middle pixel cleanly into 3 spans across 2 stops
  stage.plot(11, 20, 6);
  stage.flush(harness.mockPfx.ctx, PFX_PALETTES.silver);

  const stats = harness.getStats();
  assert.equal(stats.drawImageCalls, 0);
  assert.equal(stats.styleSwitches, 2);
  assert.equal(stats.fillRectCalls, 3);

  // Sparse corner plots flush cleanly via O(1) per-row stamp bounds
  stage.begin();
  stage.plot(2, 3, 5);
  stage.plot(PFX_GRID_W - 5, PFX_GRID_H - 5, 5);
  stage.flush(harness.mockPfx.ctx, PFX_PALETTES.silver);
  assert.equal(harness.getStats().fillRectCalls, 5);
});

test('all procedural VFX modules render quantized pixel spans with ZERO texture drawImage calls', () => {
  const harness = createMockPfxHarness();
  const { mockPfx } = harness;

  for (const style of [
    'arc_down',
    'arc_up',
    'spin',
    'wide_cleave',
    'slide',
    'uppercut',
    'thrust',
    'plunge',
    'dimension',
    'counter',
    'astral_wave',
  ] as const) {
    renderPfxSlash(mockPfx, {
      x: 200,
      y: 140,
      facing: 1,
      style,
      palette: style === 'counter' ? 'crimson' : style === 'astral_wave' ? 'cyan' : 'silver',
      elapsed: 0.05,
      duration: 0.22,
      radiusX: 52,
      radiusY: 30,
      seed: 42,
    });
  }

  renderPfxWeaponSmear(mockPfx, 180, 140, -0.8, 0.7, 30, 0.9, 'crimson');

  const projs: ProjectileEntity[] = [
    {
      id: 1,
      x: 220,
      y: 130,
      vx: 260,
      vy: 0,
      radius: 8,
      damage: 32,
      fromPlayer: true,
      color: 'cyan',
      life: 1.2,
      deflected: false,
      isSwordWave: true,
    },
    {
      id: 2,
      x: 260,
      y: 135,
      vx: -210,
      vy: 20,
      radius: 5,
      damage: 18,
      fromPlayer: false,
      color: 'crimson',
      life: 1.5,
      deflected: false,
    },
  ];
  renderPfxProjectiles(mockPfx, projs, 1.25);

  renderPfxRing(
    mockPfx,
    {
      x: 200,
      y: 150,
      maxRadius: 64,
      elapsed: 0.08,
      duration: 0.3,
      r: 255,
      g: 80,
      b: 120,
      isDimensionLines: false,
      seed: 7,
    },
    () => () => 0.42
  );
  renderPfxRing(
    mockPfx,
    {
      x: 200,
      y: 150,
      maxRadius: 80,
      elapsed: 0.08,
      duration: 0.3,
      r: 120,
      g: 80,
      b: 220,
      isDimensionLines: true,
      seed: 9,
    },
    () => () => 0.35
  );

  renderPfxParticles(
    mockPfx,
    [
      {
        active: true,
        kind: 'spark',
        x: 190,
        y: 140,
        prevX: 184,
        prevY: 144,
        life: 0.05,
        maxLife: 0.3,
        size: 2,
        r: 255,
        g: 90,
        b: 120,
        lightR: 120,
        lightG: 30,
        lightB: 50,
      },
      {
        active: true,
        kind: 'smoke',
        x: 195,
        y: 145,
        prevX: 194,
        prevY: 146,
        life: 0.08,
        maxLife: 0.3,
        size: 3,
        r: 150,
        g: 170,
        b: 210,
        lightR: 20,
        lightG: 20,
        lightB: 35,
      },
    ],
    () => true
  );

  renderPfxMagicCircle(mockPfx, 210, 180, 16, 6, 2.0, 'violet', 0.9);
  renderPfxBossHalo(mockPfx, 240, 120, 14, 2.0, 'crimson', true);
  renderPfxEnemyKO(mockPfx, 220, 150, 0.75, 3);
  renderPfxEnemySpawn(mockPfx, 220, 168, 0.65, 1.5);
  renderPfxTorchFlame(mockPfx, 140, 120, 1.8, 2, 'amber');
  renderPfxEliteCrest(mockPfx, 220, 110, 'storm', 1.2);
  renderPfxAfterimages(mockPfx, [
    {
      active: true,
      x: 160,
      y: 180,
      facing: 1,
      pose: 'dash',
      leanX: 4,
      dropY: 2,
      bladeAngle: 2.8,
      elapsed: 0.04,
      duration: 0.22,
      r: 110,
      g: 210,
      b: 255,
    },
  ]);

  assert.equal(getEnemySmearPalette(EnemyKind.Reaper, 'crimson'), 'cyan');

  const finalStats = harness.getStats();
  assert.equal(finalStats.drawImageCalls, 0, 'VFX modules must NEVER call drawImage (zero textures)');
  assert.ok(finalStats.fillRectCalls > 150, 'VFX modules must plot crisp quantized pixel spans');
  assert.ok(
    finalStats.fillRectCalls < 6000,
    `Span coalescing across all 23 VFX modules must stay under 6000 fillRects (got ${finalStats.fillRectCalls})`
  );
  assert.ok(finalStats.lightCalls > 8, 'Luminous VFX modules must populate additive light buffer');
});

test('PfxWorldHitGrid enforces pixel-exact crescent, hollow shockwave ring, projectile, and bolt hitboxes with O(1) stamp clear', async () => {
  const {
    PfxWorldHitGrid,
    rasterizeBoltToSink,
    rasterizeProjectileToSink,
    rasterizeRingToSink,
    rasterizeSlashToSink,
    renderPfxBolt,
  } = await import('./proceduralVfx');

  const gridA = new PfxWorldHitGrid();
  const gridB = new PfxWorldHitGrid();
  assert.equal(PfxWorldHitGrid.PAD % 8, 0, 'PAD must be a multiple of 8 for bit-identical Bayer parity');

  // 1. Crescent slash (`arc_down`): outer razor arc plots pixels, while hollow interior pocket & behind-origin remain empty
  gridA.begin(0, 0);
  rasterizeSlashToSink(gridA, gridA.originX, gridA.originY, {
    x: 200,
    y: 150,
    facing: 1,
    style: 'arc_down',
    palette: 'silver',
    elapsed: 0.04,
    duration: 0.22,
    radiusX: 60,
    radiusY: 36,
    seed: 42,
  });
  assert.equal(gridA.isEmpty(), false);
  assert.equal(
    gridA.overlapsWorldRect(242, 142, 262, 160),
    true,
    'Forward razor crescent band must overlap target hurtbox'
  );
  assert.equal(
    gridA.overlapsWorldRect(200, 148, 208, 152),
    false,
    'Hollow interior pocket inside eccentric crescent must NOT deal damage'
  );
  assert.equal(
    gridA.overlapsWorldRect(160, 140, 185, 160),
    false,
    'Empty space behind forward crescent must NOT deal damage'
  );

  // 2. Expanding shockwave ring (`rasterizeRingToSink`): outer expanding rim hits, hollow center misses
  gridA.begin(0, 0);
  rasterizeRingToSink(
    gridA,
    gridA.originX,
    gridA.originY,
    {
      x: 200,
      y: 150,
      maxRadius: 80,
      elapsed: 0.22,
      duration: 0.3,
      r: 255,
      g: 76,
      b: 122,
      isDimensionLines: false,
      seed: 11,
    },
    () => () => 0.42
  );
  assert.equal(
    gridA.overlapsWorldRect(195, 145, 205, 155),
    false,
    'Hollow center of expanded shockwave ring must NOT deal damage'
  );
  assert.equal(
    gridA.overlapsWorldRect(268, 146, 280, 154),
    true,
    'Plotted outer rim of expanded shockwave ring must overlap target hurtbox'
  );

  // 3. Pixel-on-pixel blade vs hostile projectile intersection (`overlapsOtherGrid`)
  gridA.begin(0, 0);
  rasterizeSlashToSink(gridA, gridA.originX, gridA.originY, {
    x: 200,
    y: 150,
    facing: 1,
    style: 'arc_down',
    palette: 'silver',
    elapsed: 0.04,
    duration: 0.22,
    radiusX: 60,
    radiusY: 36,
    seed: 42,
  });

  gridB.begin(0, 0);
  rasterizeProjectileToSink(
    gridB,
    gridB.originX,
    gridB.originY,
    {
      id: 9,
      x: 252,
      y: 150,
      vx: -210,
      vy: 0,
      radius: 5,
      damage: 18,
      fromPlayer: false,
      color: 'crimson',
      life: 1.2,
      deflected: false,
    },
    0,
    0.5
  );
  assert.equal(gridA.overlapsOtherGrid(gridB), true, 'Projectile overlapping slash crescent pixels must intersect');

  gridB.begin(0, 0);
  rasterizeProjectileToSink(
    gridB,
    gridB.originX,
    gridB.originY,
    {
      id: 10,
      x: 204,
      y: 150,
      vx: -210,
      vy: 0,
      radius: 2,
      damage: 18,
      fromPlayer: false,
      color: 'crimson',
      life: 1.2,
      deflected: false,
    },
    0,
    0.5
  );
  assert.equal(
    gridA.overlapsOtherGrid(gridB),
    false,
    'Small projectile inside hollow pocket of crescent slash must NOT intersect'
  );

  // 4. Astral lightning/meteor bolt (`rasterizeBoltToSink` & `renderPfxBolt`) plots crisp jagged pixels with 0 textures
  const harness = createMockPfxHarness();
  const boltDesc = {
    x0: 180,
    y0: 90,
    x1: 240,
    y1: 180,
    palette: 'cyan' as const,
    elapsed: 0.03,
    duration: 0.2,
    thicknessCells: 2,
    seed: 77,
  };
  renderPfxBolt(harness.mockPfx, boltDesc);
  assert.equal(harness.getStats().drawImageCalls, 0);
  assert.ok(harness.getStats().fillRectCalls > 8);

  gridA.begin(0, 0);
  rasterizeBoltToSink(gridA, gridA.originX, gridA.originY, boltDesc);
  assert.equal(gridA.overlapsWorldRect(177, 87, 183, 93), true);
  assert.equal(gridA.overlapsWorldRect(237, 177, 243, 183), true);
  assert.equal(gridA.overlapsWorldRect(110, 140, 130, 160), false);

  // 5. Non-zero camera offset (`camX = 420, camY = 180`) aligns 1:1 with world-space hurtboxes
  gridA.begin(420, 180);
  rasterizeSlashToSink(gridA, gridA.originX, gridA.originY, {
    x: 620,
    y: 330,
    facing: 1,
    style: 'arc_down',
    palette: 'silver',
    elapsed: 0.04,
    duration: 0.22,
    radiusX: 60,
    radiusY: 36,
    seed: 42,
  });
  assert.equal(gridA.overlapsWorldRect(662, 322, 682, 340), true);
  assert.equal(gridA.overlapsWorldRect(620, 328, 628, 332), false);
});

