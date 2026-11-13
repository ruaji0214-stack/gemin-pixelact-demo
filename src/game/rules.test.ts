import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canChainNextAttack,
  canMoveCancelRecovery,
  computeAriaPose,
  computeAttackImpulseVx,
  computeDashJumpVelocity,
} from './kinematics';
import {
  MOVES,
  PIXEL_SCALE,
  PLAYER_DASH_SPEED,
  PLAYER_JUMP_VY,
  RENDER_HEIGHT,
  RENDER_WIDTH,
  SUBPIXEL_SCALE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  calculateStyleGain,
  canBreakSealBarrier,
  checkPerfectDodge,
  computeEffectiveDamage,
  computeStyleRank,
  resolveNextAttackMove,
  shouldShieldBlockHit,
  snapSubpixel,
  toRenderPx,
} from './rules';
import { EnemyKind, MoveId, PlayerEntity, RelicId, RoomId, StyleRank } from './types';
import { ALL_ROOM_IDS, ROOMS, resolveRoomMovement } from './world';

test('ground 4-hit katana combo and S+J SlideSlash chain cleanly', () => {
  const base = {
    button: 'light' as const,
    grounded: true,
    holdUp: false,
    holdDown: false,
    comboWindowOpen: true,
    airComboCount: 0,
    dashAfterAttackOpen: false,
    perfectDodgeWindowOpen: false,
    bladeEnergy: 0,
  };

  const m1 = resolveNextAttackMove({ ...base, currentMove: MoveId.None, comboWindowOpen: false });
  assert.equal(m1, MoveId.Slash1);

  const slide = resolveNextAttackMove({
    ...base,
    holdDown: true,
    currentMove: MoveId.None,
    comboWindowOpen: false,
  });
  assert.equal(slide, MoveId.SlideSlash);

  // SlideSlash chains directly into Slash2!
  const afterSlide = resolveNextAttackMove({ ...base, currentMove: MoveId.SlideSlash });
  assert.equal(afterSlide, MoveId.Slash2);

  const m3 = resolveNextAttackMove({ ...base, currentMove: MoveId.Slash2 });
  assert.equal(m3, MoveId.Slash3);

  const m4 = resolveNextAttackMove({ ...base, currentMove: MoveId.Slash3 });
  assert.equal(m4, MoveId.Slash4);
});

test('directional W+J launches RisingMoon, airborne J->J->S+J chains into HelmSplitter, and L triggers DimensionCut at 50 energy', () => {
  const launcher = resolveNextAttackMove({
    button: 'light',
    grounded: true,
    holdUp: true,
    holdDown: false,
    currentMove: MoveId.Slash1,
    comboWindowOpen: true,
    airComboCount: 0,
    dashAfterAttackOpen: false,
    perfectDodgeWindowOpen: false,
    bladeEnergy: 20,
  });
  assert.equal(launcher, MoveId.RisingMoon);

  const air1 = resolveNextAttackMove({
    button: 'light',
    grounded: false,
    holdUp: false,
    holdDown: false,
    currentMove: MoveId.RisingMoon,
    comboWindowOpen: true,
    airComboCount: 0,
    dashAfterAttackOpen: false,
    perfectDodgeWindowOpen: false,
    bladeEnergy: 30,
  });
  assert.equal(air1, MoveId.AirSlash1);

  const plunge = resolveNextAttackMove({
    button: 'light',
    grounded: false,
    holdUp: false,
    holdDown: true,
    currentMove: MoveId.AirSlash1,
    comboWindowOpen: true,
    airComboCount: 1,
    dashAfterAttackOpen: false,
    perfectDodgeWindowOpen: false,
    bladeEnergy: 35,
  });
  assert.equal(plunge, MoveId.HelmSplitter);

  const ultimate = resolveNextAttackMove({
    button: 'heavy',
    grounded: true,
    holdUp: false,
    holdDown: false,
    currentMove: MoveId.None,
    comboWindowOpen: false,
    airComboCount: 0,
    dashAfterAttackOpen: false,
    perfectDodgeWindowOpen: false,
    bladeEnergy: 50,
  });
  assert.equal(ultimate, MoveId.DimensionCut);
});

test('perfect dodge, shield break, relic seal-breaking, and critical damage work deterministically', () => {
  assert.equal(
    checkPerfectDodge(200, 226, [
      { x: 232, y: 226, reach: 54, remainingWindup: 0.18, isActiveStrike: false },
    ]),
    true
  );

  assert.equal(shouldShieldBlockHit(true, -1, 300, 260, MOVES[MoveId.Slash1]), true);
  assert.equal(shouldShieldBlockHit(true, -1, 300, 335, MOVES[MoveId.Slash1]), false);
  assert.equal(shouldShieldBlockHit(true, -1, 300, 260, MOVES[MoveId.RisingMoon]), false);

  const noRelics = new Set<RelicId>();
  const withBreaker = new Set<RelicId>([RelicId.AbyssalBreaker, RelicId.ZanshinTassel]);
  assert.equal(canBreakSealBarrier(MoveId.HeavyCrescent, noRelics), false);
  assert.equal(canBreakSealBarrier(MoveId.Slash1, withBreaker), false);
  assert.equal(canBreakSealBarrier(MoveId.HeavyCrescent, withBreaker), true);

  const critHit = computeEffectiveDamage(42, MoveId.Slash4, withBreaker, true);
  assert.equal(critHit.critical, true);
  assert.ok(critHit.damage > 55);

  const freshGain = calculateStyleGain(MoveId.Slash2, [MoveId.Slash1], 4);
  const staleGain = calculateStyleGain(MoveId.Slash2, [MoveId.Slash2, MoveId.Slash2], 4);
  assert.ok(freshGain > staleGain);
  assert.equal(computeStyleRank(540), StyleRank.SSS);
});

test('18-room Cave Story / Dead Cells connected-domain generator produces progression-safe, collision-free worlds across 12 seeds', async () => {
  const { isBossEnemyKind } = await import('./roguelike');
  const { PLAYER_HALF_W, PLAYER_HEIGHT, findTriggeredExit, generateWorld, getStartingSpawn } =
    await import('./world');

  assert.equal(ALL_ROOM_IDS.length, 18, 'World must contain 18 interconnected rooms');

  const seeds = [
    77491, 100001, 202605, 314159, 424242, 555777,
    680123, 739182, 818181, 909090, 954321, 999999,
  ];
  const dirDelta = {
    left: { dx: -1, dy: 0, opp: 'right' as const },
    right: { dx: 1, dy: 0, opp: 'left' as const },
    up: { dx: 0, dy: -1, opp: 'down' as const },
    down: { dx: 0, dy: 1, opp: 'up' as const },
  };

  const macroSignatures = new Set<string>();
  const courtyardTemplates = new Set<string>();

  for (const seed of seeds) {
    const world = generateWorld(seed);
    macroSignatures.add(
      ALL_ROOM_IDS.map((id) => `${id}:${world[id].gridX},${world[id].gridY}`).join('|')
    );
    if (world.courtyard.templateId) {
      courtyardTemplates.add(world.courtyard.templateId);
    }

    // 1. Verify starting spawn in `cloister` is grounded and hazard-free
    const start = getStartingSpawn(world);
    const startCheck = resolveRoomMovement({
      prevX: start.x,
      prevY: start.y - 2,
      nextX: start.x,
      nextY: start.y + 2,
      vx: 0,
      vy: 40,
      halfW: PLAYER_HALF_W,
      height: PLAYER_HEIGHT,
      dropThrough: false,
      platforms: world.cloister.platforms,
    });
    assert.equal(startCheck.grounded, true, `Seed ${seed}: cloister starting spawn must be grounded`);
    assert.equal(startCheck.touchedHazard, false, `Seed ${seed}: starting spawn must be hazard-free`);

    // 2. Full connected-domain BFS reachability from `cloister`
    const visited = new Set<RoomId>(['cloister']);
    const coordSet = new Set<string>();
    const queue: RoomId[] = ['cloister'];

    const enemyKinds = new Set<EnemyKind>();
    const bossKinds = new Set<EnemyKind>();
    let totalSpawns = 0;
    let totalAltars = 0;
    let totalVessels = 0;

    while (queue.length > 0) {
      const current = queue.shift()!;
      const room = world[current];
      assert.ok(room, `Seed ${seed}: Room ${current} must exist`);
      assert.ok(room.gridX >= 0 && room.gridY >= 0, `Seed ${seed}: ${current} normalized grid coords`);

      const coordKey = `${room.gridX},${room.gridY}`;
      assert.equal(
        coordSet.has(coordKey),
        false,
        `Seed ${seed}: Duplicate grid coordinate ${coordKey} on ${current}`
      );
      coordSet.add(coordKey);

      if (room.altar) totalAltars += 1;
      if (room.vessel) totalVessels += 1;

      // Verify every enemy & boss spawn stands on valid non-hazard ground
      for (const e of room.enemies) {
        totalSpawns += 1;
        enemyKinds.add(e.kind);
        if (isBossEnemyKind(e.kind)) {
          bossKinds.add(e.kind);
        }
        const eCheck = resolveRoomMovement({
          prevX: e.x,
          prevY: e.y - 2,
          nextX: e.x,
          nextY: e.y + 2,
          vx: 0,
          vy: 40,
          halfW: PLAYER_HALF_W,
          height: PLAYER_HEIGHT,
          dropThrough: false,
          platforms: room.platforms,
        });
        assert.equal(
          eCheck.grounded,
          true,
          `Seed ${seed}: enemy ${e.kind} at (${e.x},${e.y}) in ${current} must be grounded`
        );
        assert.equal(
          eCheck.touchedHazard,
          false,
          `Seed ${seed}: enemy ${e.kind} in ${current} must not spawn on spikes`
        );
      }

      // Verify every exit aligns orthogonally, has a reciprocal exit, and lands safely grounded
      for (const ex of room.exits) {
        const target = world[ex.targetRoom];
        assert.ok(target, `Seed ${seed}: Target room ${ex.targetRoom} must exist`);
        const d = dirDelta[ex.direction];
        assert.equal(
          target.gridX,
          room.gridX + d.dx,
          `Seed ${seed}: ${current}->${ex.targetRoom} (${ex.direction}) gridX mismatch`
        );
        assert.equal(
          target.gridY,
          room.gridY + d.dy,
          `Seed ${seed}: ${current}->${ex.targetRoom} (${ex.direction}) gridY mismatch`
        );
        assert.ok(
          target.exits.some((rev) => rev.targetRoom === current && rev.direction === d.opp),
          `Seed ${seed}: ${ex.targetRoom} must have reciprocal ${d.opp} exit back to ${current}`
        );

        const landCheck = resolveRoomMovement({
          prevX: ex.spawnX,
          prevY: ex.spawnY - 2,
          nextX: ex.spawnX,
          nextY: ex.spawnY + 2,
          vx: 0,
          vy: 40,
          halfW: PLAYER_HALF_W,
          height: PLAYER_HEIGHT,
          dropThrough: false,
          platforms: target.platforms,
        });
        assert.equal(
          landCheck.grounded,
          true,
          `Seed ${seed}: exit ${current}->${ex.targetRoom} (${ex.direction}) spawn (${ex.spawnX},${ex.spawnY}) must land grounded`
        );
        assert.equal(
          landCheck.touchedHazard,
          false,
          `Seed ${seed}: exit ${current}->${ex.targetRoom} spawn must be hazard-free`
        );
        assert.equal(
          findTriggeredExit(ex.spawnX, ex.spawnY, PLAYER_HEIGHT, target.exits),
          null,
          `Seed ${seed}: exit ${current}->${ex.targetRoom} spawn must not immediately re-trigger an exit`
        );

        if (!visited.has(ex.targetRoom)) {
          visited.add(ex.targetRoom);
          queue.push(ex.targetRoom);
        }
      }
    }

    assert.equal(visited.size, 18, `Seed ${seed}: All 18 rooms must form a single connected domain`);
    assert.equal(enemyKinds.size, 8, `Seed ${seed}: All 8 enemy & boss archetypes must spawn`);
    assert.equal(bossKinds.size, 3, `Seed ${seed}: All 3 Bosses must exist`);
    assert.ok(totalSpawns >= 60, `Seed ${seed}: Expected >= 60 enemy spawns, got ${totalSpawns}`);
    assert.ok(totalAltars >= 7, `Seed ${seed}: Expected >= 7 Scroll Altars, got ${totalAltars}`);
    assert.equal(totalVessels, 4, `Seed ${seed}: Expected 4 Vitality Vessels`);

    // 3. Verify pre-seal progression safety: `DoubleJump` & `AbyssalBreaker` MUST be reachable BEFORE entering `antechamber`!
    const preSealVisited = new Set<RoomId>(['cloister']);
    const preQueue: RoomId[] = ['cloister'];
    const preSealRelics = new Set<RelicId>();
    while (preQueue.length > 0) {
      const cid = preQueue.shift()!;
      const r = world[cid];
      if (r.relic) preSealRelics.add(r.relic.relicId);
      for (const ex of r.exits) {
        if (ex.targetRoom === 'antechamber') continue; // Blocked by unbroken `seal_courtyard_east`
        if (!preSealVisited.has(ex.targetRoom)) {
          preSealVisited.add(ex.targetRoom);
          preQueue.push(ex.targetRoom);
        }
      }
    }
    assert.equal(
      preSealRelics.has(RelicId.DoubleJump),
      true,
      `Seed ${seed}: DoubleJump must be reachable before breaking seal_courtyard_east`
    );
    assert.equal(
      preSealRelics.has(RelicId.AbyssalBreaker),
      true,
      `Seed ${seed}: AbyssalBreaker must be reachable before breaking seal_courtyard_east`
    );
  }

  assert.ok(
    macroSignatures.size >= 8,
    `Expected genuine connected-domain topology randomization across seeds, got ${macroSignatures.size}`
  );
  assert.ok(
    courtyardTemplates.size >= 2,
    `Expected procedural room template randomization across seeds, got ${courtyardTemplates.size}`
  );
});

test('Dead Cells-style 3-choice upgrade draft, 6 attribute schools (月魄·赤刃·星术·坚毅·连袭·魂心), 1.2s attack cadence, and persistent combo stage work deterministically', async () => {
  const {
    ALL_UPGRADE_IDS,
    SCHOOL_METADATA,
    UPGRADE_SPECS,
    computeUpgradeModifiers,
    createEmptyUpgradeMap,
    getSoulForgeCost,
    rollUpgradeDraft,
  } = await import('./roguelike');
  const { UpgradeId, UpgradeSchool } = await import('./types');
  const {
    BASE_ATTACK_INTERVAL,
    advanceComboStage,
    computeAttackInterval,
  } = await import('./rules');

  assert.equal(Object.keys(SCHOOL_METADATA).length, 6, 'Must define all 6 attribute schools');
  assert.equal(SCHOOL_METADATA[UpgradeSchool.Onslaught].shortZh, '连袭', '5th school must be renamed 连袭');
  assert.equal(SCHOOL_METADATA[UpgradeSchool.SoulHeart].shortZh, '魂心', '6th school must be 魂心');
  assert.equal(ALL_UPGRADE_IDS.length, 54, 'Must define 54 Roguelike upgrades across 6 schools (9 per school)');

  const levels = createEmptyUpgradeMap();
  for (let i = 0; i < 12; i++) {
    const draft = rollUpgradeDraft(levels, 98765, i, '赐福卷轴台', '选择其一');
    assert.equal(draft.choices.length, 3);
    const ids = new Set(draft.choices.map((c) => c.id));
    assert.equal(ids.size, 3, 'All 3 draft choices must be distinct');
  }

  // Max-level upgrades are excluded when other eligible upgrades remain
  const capped = createEmptyUpgradeMap();
  capped[UpgradeId.MoonWave] = UPGRADE_SPECS[UpgradeId.MoonWave].maxLevel;
  for (let i = 0; i < 10; i++) {
    const draft = rollUpgradeDraft(capped, 12345, i, '测试', '测试');
    assert.equal(
      draft.choices.some((c) => c.id === UpgradeId.MoonWave),
      false,
      'Capped upgrade must not appear while uncapped upgrades remain'
    );
  }

  // Verify initial attack interval is 0.5s before `连袭` upgrades
  const baseMods = computeUpgradeModifiers(levels);
  assert.equal(BASE_ATTACK_INTERVAL, 0.5);
  assert.equal(computeAttackInterval(baseMods.attackSpeedMult), 0.5);

  // Apply upgrades across all 6 schools (`月魄 · 赤刃 · 星术 · 坚毅 · 连袭 · 魂心`)
  levels[UpgradeId.LunarSurge] = 2; // 月魄
  levels[UpgradeId.CrimsonDraw] = 2; // 赤刃
  levels[UpgradeId.StarlightFocus] = 2; // 星术
  levels[UpgradeId.AegisCounter] = 1; // 坚毅
  levels[UpgradeId.GaleEdge] = 2; // 连袭
  levels[UpgradeId.ShatterMight] = 1; // 连袭
  levels[UpgradeId.TitanVessel] = 2; // 魂心
  levels[UpgradeId.SkyFeather] = 1; // 魂心
  levels[UpgradeId.FrostStep] = 2; // 魂心 (dash charges +2)

  const mods = computeUpgradeModifiers(levels);
  assert.equal(mods.lunarCount, 2);
  assert.equal(mods.brutalityCount, 2);
  assert.equal(mods.tacticsCount, 2);
  assert.equal(mods.survivalCount, 1);
  assert.equal(mods.onslaughtCount, 3);
  assert.equal(mods.soulHeartCount, 5);

  // 连袭 (`Onslaught`) shortens the 0.5s attack interval
  assert.ok(mods.attackSpeedMult > 1.8);
  assert.ok(computeAttackInterval(mods.attackSpeedMult) < 0.3);
  assert.equal(mods.pierceShields, true);

  // 月魄 (`Lunar`) reduces DimensionCut cost and boosts L-skill damage
  assert.ok(mods.dimensionCutCost <= 32);
  assert.ok(mods.lSkillDamageMult > 1.25);

  // 赤刃 (`Brutality`) boosts Perfect Dodge + Hold J (`MoonCounter`) and adds extra crimson slashes
  assert.ok(mods.crimsonSlashMult > 2.0);
  assert.ok(mods.crimsonFlashExtraHits >= 2);

  // 星术 (`Tactics`) boosts Zanshin sheathe glint + L (`zanshinLSkillMult`)
  assert.ok(mods.zanshinLSkillMult > 2.0);

  // 魂心 (`SoulHeart`) grants Max HP, extra air jumps, and extra dash stamina charges
  assert.ok(mods.bonusMaxHp >= 140);
  assert.equal(mods.extraAirJumps, 1);
  assert.equal(mods.bonusMaxStamina, 2);

  // ShatterMight pierces frontal shield even on Slash1
  assert.equal(shouldShieldBlockHit(true, -1, 300, 260, MOVES[MoveId.Slash1], false), true);
  assert.equal(shouldShieldBlockHit(true, -1, 300, 260, MOVES[MoveId.Slash1], mods.pierceShields), false);

  // Reduced DimensionCut cost allows L to trigger DimensionCut at 35 energy instead of 50
  const ultMove = resolveNextAttackMove({
    button: 'heavy',
    grounded: true,
    holdUp: false,
    holdDown: false,
    currentMove: MoveId.None,
    comboWindowOpen: false,
    airComboCount: 0,
    dashAfterAttackOpen: false,
    perfectDodgeWindowOpen: false,
    bladeEnergy: 36,
    dimensionCutCost: mods.dimensionCutCost,
  });
  assert.equal(ultMove, MoveId.DimensionCut);

  // Persistent Combo Stage Retention (`没有使用L或者被攻击则维持攻击段数`):
  // Even when `comboWindowOpen` is false (e.g. after 1.2s+ pause or dashing/jumping), `savedComboStage` maintains the combo sequence!
  let stage: 0 | 1 | 2 | 3 = 0;
  const seq: MoveId[] = [];
  for (let step = 0; step < 4; step++) {
    const move = resolveNextAttackMove({
      button: 'light',
      grounded: true,
      holdUp: false,
      holdDown: false,
      currentMove: MoveId.None,
      comboWindowOpen: false, // Even with expired comboWindow!
      airComboCount: 0,
      dashAfterAttackOpen: false,
      perfectDodgeWindowOpen: false,
      bladeEnergy: 20,
      savedComboStage: stage,
    })!;
    seq.push(move);
    stage = advanceComboStage(stage, move);
  }
  assert.deepEqual(seq, [MoveId.Slash1, MoveId.Slash2, MoveId.Slash3, MoveId.Slash4]);
  assert.equal(stage, 0, 'After Slash4 (终式), stage wraps cleanly back to 0');

  // Advance to stage 2 (after Slash1 -> Slash2), verify air slash or MoonCounter preserves stage 2
  stage = advanceComboStage(0, MoveId.Slash1);
  stage = advanceComboStage(stage, MoveId.Slash2);
  assert.equal(stage, 2);
  assert.equal(advanceComboStage(stage, MoveId.AirSlash1), 2, 'Air slash must preserve ground combo stage');
  assert.equal(advanceComboStage(stage, MoveId.MoonCounter), 2, 'Perfect Dodge MoonCounter must preserve ground combo stage');

  // Using an L-key skill OR taking damage resets combo stage to 0!
  assert.equal(advanceComboStage(stage, MoveId.HeavyCrescent, { usedLSkill: true }), 0, 'L skill must reset combo stage');
  assert.equal(advanceComboStage(stage, MoveId.None, { tookDamage: true }), 0, 'Taking damage must reset combo stage');

  // Empowered L (`星术`) and Crimson Flash (`赤刃`) boost effective combat damage
  const baseDmg = computeEffectiveDamage(38, MoveId.HeavyCrescent, new Set(), false, mods, 0.99);
  const empoweredLDmg = computeEffectiveDamage(38, MoveId.HeavyCrescent, new Set(), false, mods, 0.99, {
    empoweredLActive: true,
  });
  assert.ok(empoweredLDmg.damage > baseDmg.damage * 1.8, 'Empowered L must deal massive bonus damage');
  assert.ok(getSoulForgeCost(2) > getSoulForgeCost(0));
});

test('Metroidvania physics solver handles one-way platform landing, drop-through, wall-slide, and intact seal barrier', () => {
  const platforms = [
    { x: 0, y: 250, w: 500, h: 40 },
    { x: 100, y: 180, w: 120, h: 8, oneWay: true },
    { x: 300, y: 50, w: 24, h: 160 }, // Tall wall
  ];

  // Land on one-way platform
  const land = resolveRoomMovement({
    prevX: 150,
    prevY: 178,
    nextX: 150,
    nextY: 184,
    vx: 0,
    vy: 120,
    halfW: 6,
    height: 32,
    dropThrough: false,
    platforms,
  });
  assert.equal(land.grounded, true);
  assert.equal(land.y, 180);

  // Drop through one-way platform when holding S+Jump
  const drop = resolveRoomMovement({
    prevX: 150,
    prevY: 178,
    nextX: 150,
    nextY: 184,
    vx: 0,
    vy: 120,
    halfW: 6,
    height: 32,
    dropThrough: true,
    platforms,
  });
  assert.equal(drop.grounded, false);
  assert.equal(drop.y, 184);

  // Wall-slide against tall right wall
  const slide = resolveRoomMovement({
    prevX: 294,
    prevY: 140,
    nextX: 298,
    nextY: 144,
    vx: 100,
    vy: 80,
    halfW: 6,
    height: 32,
    dropThrough: false,
    platforms,
  });
  assert.equal(slide.wallSlideSide, 1);
  assert.equal(slide.x, 294);
});

test('kinematics & responsive cancels support Dash-Jump momentum, hit-confirmed early chain, recovery move-cancel, and continuous blade sweep', () => {
  const s1 = MOVES[MoveId.Slash1];

  // Unconfirmed mid-active cannot chain yet; hit-confirmed late-active CAN chain immediately
  assert.equal(canChainNextAttack(MoveId.Slash1, s1.windup + s1.active * 0.2, false), false);
  assert.equal(canChainNextAttack(MoveId.Slash1, s1.windup + s1.active * 0.6, true), true);

  // Early recovery blocks move-cancel during initial follow-through, then opens after 32%
  assert.equal(canMoveCancelRecovery(MoveId.Slash1, s1.windup + s1.active + s1.recovery * 0.15), false);
  assert.equal(canMoveCancelRecovery(MoveId.Slash1, s1.windup + s1.active + s1.recovery * 0.45), true);

  // Dash-Jump carries > 240 px/s horizontal speed
  const dj = computeDashJumpVelocity(1, 1, PLAYER_DASH_SPEED, PLAYER_JUMP_VY);
  assert.ok(dj.vx > 240);
  assert.ok(dj.vy < -300);

  // Airborne attack preserves existing jump momentum instead of braking to 28 px/s
  const airVx = computeAttackImpulseVx(false, 220, 1, 1, MOVES[MoveId.AirSlash1]);
  assert.ok(airVx > 200);

  // Procedural pose continuously sweeps katana angle and leans body from coil -> lunge
  const dummyPlayer: PlayerEntity = {
    x: 100,
    y: 226,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: true,
    crouching: false,
    dropThroughTimer: 0,
    wallSlideSide: 0,
    wallJumpLockTimer: 0,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    attackBufferTimer: 0,
    attackBufferType: null,
    dashBufferTimer: 0,
    hp: 100,
    maxHp: 100,
    rallyHp: 100,
    stamina: 3,
    maxStamina: 3,
    bladeEnergy: 30,
    maxBladeEnergy: 100,
    jumpsRemaining: 0,
    airDashesUsed: 0,
    moveId: MoveId.Slash1,
    moveTimer: s1.windup * 0.8,
    moveHitIds: new Set(),
    comboWindowTimer: 0,
    airComboCount: 0,
    zanshinPending: false,
    zanshinTimer: 0,
    zanshinFlashTimer: 0,
    isDashing: false,
    dashTimer: 0,
    dashCooldown: 0,
    dashAfterAttackWindow: 0,
    invulnTimer: 0,
    perfectDodgeWindow: 0,
    hurtTimer: 0,
    flashTimer: 0,
    lastSafeX: 100,
    lastSafeY: 226,
    scaleX: 1,
    scaleY: 1,
    gaitPhase: 0,
    skidTimer: 0,
    spinFlipTimer: 0,
    landRecoveryTimer: 0,
    hairLeft: [],
    hairRight: [],
    capeNodes: [],
  };

  const coilPose = computeAriaPose(dummyPlayer, 1.0);
  assert.ok(coilPose.torsoLeanX < 0, 'Windup must coil backward');

  dummyPlayer.moveTimer = s1.windup + s1.active * 0.25;
  const earlyActivePose = computeAriaPose(dummyPlayer, 1.04);
  dummyPlayer.moveTimer = s1.windup + s1.active * 0.85;
  const lateActivePose = computeAriaPose(dummyPlayer, 1.09);

  assert.ok(lateActivePose.torsoLeanX > 3, 'Active slash must lunge forward');
  assert.notEqual(
    earlyActivePose.bladeAngle,
    lateActivePose.bladeAngle,
    'Blade must continuously sweep across active frames instead of freezing at a static angle'
  );
  assert.ok(earlyActivePose.smearIntensity > 0.5, 'Active slash must emit attached katana smear fan');
});

test('8x sub-pixel precision & Full-HD 1920x1080 buffer provide 16x pixel density over 480x270', () => {
  assert.equal(SUBPIXEL_SCALE, 8);
  assert.equal(PIXEL_SCALE, 4);
  assert.equal(RENDER_WIDTH, 1920);
  assert.equal(RENDER_HEIGHT, 1080);
  assert.equal((RENDER_WIDTH * RENDER_HEIGHT) / (WORLD_WIDTH * WORLD_HEIGHT), 16);

  // 1/8 world unit = 0.125 exact sub-pixel step
  assert.equal(snapSubpixel(10.13), 10.125);
  assert.equal(snapSubpixel(10.24), 10.25);
  assert.equal(toRenderPx(128.125, 28.0), 400.5);
});

test('2D skeletal IK rig preserves exact bone lengths and drives weapon bones across Aria and all 4 enemy archetypes', async () => {
  const { solveTwoBoneIK, solveAriaSkeleton, solveEnemySkeleton } = await import('./skeleton');
  const { EnemyAIState } = await import('./types');

  const chain = solveTwoBoneIK(100, 100, 106, 111, 7.0, 7.2, 1);
  const dUpper = Math.hypot(chain.lower.x - chain.upper.x, chain.lower.y - chain.upper.y);
  const dLower = Math.hypot(chain.endX - chain.lower.x, chain.endY - chain.lower.y);
  assert.ok(Math.abs(dUpper - 7.0) < 1e-4, 'Upper bone must preserve exact anatomical length');
  assert.ok(Math.abs(dLower - 7.2) < 1e-4, 'Lower bone must preserve exact anatomical length');

  const s1 = MOVES[MoveId.Slash1];
  const ariaPlayer: PlayerEntity = {
    x: 160,
    y: 226,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: true,
    crouching: false,
    dropThroughTimer: 0,
    wallSlideSide: 0,
    wallJumpLockTimer: 0,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    attackBufferTimer: 0,
    attackBufferType: null,
    dashBufferTimer: 0,
    hp: 100,
    maxHp: 100,
    rallyHp: 100,
    stamina: 3,
    maxStamina: 3,
    bladeEnergy: 60,
    maxBladeEnergy: 100,
    jumpsRemaining: 0,
    airDashesUsed: 0,
    moveId: MoveId.Slash1,
    moveTimer: s1.windup * 0.5,
    moveHitIds: new Set(),
    comboWindowTimer: 0,
    airComboCount: 0,
    zanshinPending: false,
    zanshinTimer: 0,
    zanshinFlashTimer: 0,
    isDashing: false,
    dashTimer: 0,
    dashCooldown: 0,
    dashAfterAttackWindow: 0,
    invulnTimer: 0,
    perfectDodgeWindow: 0,
    hurtTimer: 0,
    flashTimer: 0,
    lastSafeX: 160,
    lastSafeY: 226,
    scaleX: 1,
    scaleY: 1,
    gaitPhase: 0,
    skidTimer: 0,
    spinFlipTimer: 0,
    landRecoveryTimer: 0,
    hairLeft: [],
    hairRight: [],
    capeNodes: [],
  };

  const windupRig = solveAriaSkeleton(ariaPlayer, 2.0);
  ariaPlayer.moveTimer = s1.windup + s1.active * 0.7;
  const activeRig = solveAriaSkeleton(ariaPlayer, 2.05);
  assert.notEqual(windupRig.katana.angle, activeRig.katana.angle, 'Skeletal katana must sweep from windup to active');
  assert.ok(Number.isFinite(activeRig.scabbard.angle), 'Scabbard bone angle must be finite');

  for (const kind of [
    EnemyKind.Stalker,
    EnemyKind.Weaver,
    EnemyKind.Halberdier,
    EnemyKind.Reaper,
    EnemyKind.Arbalist,
    EnemyKind.Warden,
    EnemyKind.Archon,
    EnemyKind.Sovereign,
  ]) {
    const baseEnemy = {
      id: 1,
      kind,
      nameZh: '测试敌影',
      x: 260,
      y: 226,
      homeMinX: 200,
      homeMaxX: 320,
      vx: 0,
      vy: 0,
      facing: -1 as const,
      grounded: true,
      hp: 100,
      maxHp: 100,
      rallyHp: 100,
      shieldActive: kind === EnemyKind.Halberdier,
      aiState: EnemyAIState.Patrol,
      stateTimer: 0.2,
      attackCooldown: 0.5,
      bossPatternIndex: 0,
      bossEnraged: false,
      hasAttackToken: false,
      hitConfirmedThisSwing: false,
      flashTimer: 0,
      scaleX: 1,
      scaleY: 1,
      gaitPhase: 0.4,
      koTimer: 0,
    };
    const idleEnemyRig = solveEnemySkeleton(baseEnemy, 2.0);
    const atkEnemyRig = solveEnemySkeleton(
      {
        ...baseEnemy,
        aiState: EnemyAIState.Attack,
        stateTimer: 0.1,
        hasAttackToken: true,
      },
      2.1
    );
    assert.ok(Number.isFinite(idleEnemyRig.weapon.angle) && Number.isFinite(atkEnemyRig.weapon.angle));
    assert.notEqual(idleEnemyRig.weapon.x, atkEnemyRig.weapon.x, `${kind} weapon bone must articulate on attack`);
  }
});

test('all 25 distinct Aria actions and all 5 Enemy AI states resolve to independent clips with monotonic in-between progression', async () => {
  const { resolveAriaAnimSample, resolveEnemyAnimSample } = await import('./animClips');
  const { EnemyAIState, GamePhase } = await import('./types');

  const makePlayer = (): PlayerEntity => ({
    x: 160,
    y: 226,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: true,
    crouching: false,
    dropThroughTimer: 0,
    wallSlideSide: 0,
    wallJumpLockTimer: 0,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    attackBufferTimer: 0,
    attackBufferType: null,
    dashBufferTimer: 0,
    hp: 100,
    maxHp: 100,
    rallyHp: 100,
    stamina: 3,
    maxStamina: 3,
    bladeEnergy: 60,
    maxBladeEnergy: 100,
    jumpsRemaining: 0,
    airDashesUsed: 0,
    moveId: MoveId.None,
    moveTimer: 0,
    moveHitIds: new Set(),
    comboWindowTimer: 0,
    airComboCount: 0,
    zanshinPending: false,
    zanshinTimer: 0,
    zanshinFlashTimer: 0,
    isDashing: false,
    dashTimer: 0,
    dashCooldown: 0,
    dashAfterAttackWindow: 0,
    invulnTimer: 0,
    perfectDodgeWindow: 0,
    hurtTimer: 0,
    flashTimer: 0,
    lastSafeX: 160,
    lastSafeY: 226,
    scaleX: 1,
    scaleY: 1,
    gaitPhase: 0,
    skidTimer: 0,
    spinFlipTimer: 0,
    landRecoveryTimer: 0,
    hairLeft: [],
    hairRight: [],
    capeNodes: [],
  });

  const allCombatMoves: Array<Exclude<MoveId, MoveId.None>> = [
    MoveId.Slash1,
    MoveId.Slash2,
    MoveId.Slash3,
    MoveId.Slash4,
    MoveId.SlideSlash,
    MoveId.RisingMoon,
    MoveId.DashThrust,
    MoveId.MoonCounter,
    MoveId.AstralSlash,
    MoveId.AirSlash1,
    MoveId.AirSlash2,
    MoveId.HelmSplitter,
    MoveId.HeavyCrescent,
    MoveId.DimensionCut,
  ];

  const seenClips = new Set<string>();

  for (const move of allCombatMoves) {
    const spec = MOVES[move];
    const p = makePlayer();
    p.moveId = move;

    p.moveTimer = spec.windup * 0.4;
    const sWindup = resolveAriaAnimSample(p, GamePhase.Playing, 1.0);

    p.moveTimer = spec.windup + spec.active * 0.5;
    const sActive = resolveAriaAnimSample(p, GamePhase.Playing, 1.05);

    p.moveTimer = spec.windup + spec.active + spec.recovery * 0.7;
    const sRecovery = resolveAriaAnimSample(p, GamePhase.Playing, 1.12);

    assert.equal(sWindup.clipId, sActive.clipId);
    assert.equal(sActive.clipId, sRecovery.clipId);
    assert.ok(
      0 <= sWindup.progress01 &&
        sWindup.progress01 < sActive.progress01 &&
        sActive.progress01 < sRecovery.progress01 &&
        sRecovery.progress01 <= 1,
      `${move} must progress monotonically across windup -> active -> recovery`
    );
    assert.ok(Number.isFinite(sActive.handOffsetX) && Number.isFinite(sActive.handOffsetY));
    seenClips.add(sActive.clipId);
  }
  assert.equal(seenClips.size, 14, 'All 14 combat moves must map to 14 independent clip IDs');

  // Verify all 12 non-combat states map to 12 additional unique clip IDs (total = 26)
  seenClips.add(resolveAriaAnimSample(makePlayer(), GamePhase.Playing, 1.0).clipId); // idle

  const pRun = makePlayer();
  pRun.vx = 140;
  pRun.gaitPhase = 1.2;
  seenClips.add(resolveAriaAnimSample(pRun, GamePhase.Playing, 1.0).clipId); // run

  const pCrouch = makePlayer();
  pCrouch.crouching = true;
  pCrouch.crouchTimer = 0.03;
  const crouchEntry = resolveAriaAnimSample(pCrouch, GamePhase.Playing, 1.0);
  pCrouch.crouchTimer = 0.5;
  const crouchHoldA = resolveAriaAnimSample(pCrouch, GamePhase.Playing, 1.5);
  pCrouch.crouchTimer = 2.5;
  const crouchHoldB = resolveAriaAnimSample(pCrouch, GamePhase.Playing, 3.5);
  assert.equal(crouchEntry.loop, false, 'Crouch must be one-shot descent, never looping');
  assert.ok(crouchEntry.progress01 < crouchHoldA.progress01);
  assert.equal(crouchHoldA.progress01, 1, 'Held crouch must lock steadily at progress01 = 1');
  assert.equal(crouchHoldB.progress01, 1, 'Held crouch must remain rock-steady without oscillation');
  seenClips.add(crouchHoldA.clipId); // crouch

  const pSkid = makePlayer();
  pSkid.skidTimer = 0.08;
  seenClips.add(resolveAriaAnimSample(pSkid, GamePhase.Playing, 1.0).clipId); // skid

  const pRise = makePlayer();
  pRise.grounded = false;
  pRise.vy = -240;
  seenClips.add(resolveAriaAnimSample(pRise, GamePhase.Playing, 1.0).clipId); // jump_rise

  const pApex = makePlayer();
  pApex.grounded = false;
  pApex.vy = -12;
  seenClips.add(resolveAriaAnimSample(pApex, GamePhase.Playing, 1.0).clipId); // jump_apex

  const pFall = makePlayer();
  pFall.grounded = false;
  pFall.vy = 180;
  seenClips.add(resolveAriaAnimSample(pFall, GamePhase.Playing, 1.0).clipId); // jump_fall

  const pLand = makePlayer();
  pLand.landRecoveryTimer = 0.06;
  seenClips.add(resolveAriaAnimSample(pLand, GamePhase.Playing, 1.0).clipId); // land

  const pDash = makePlayer();
  pDash.isDashing = true;
  pDash.dashTimer = 0.08;
  seenClips.add(resolveAriaAnimSample(pDash, GamePhase.Playing, 1.0).clipId); // dash

  const pWall = makePlayer();
  pWall.grounded = false;
  pWall.wallSlideSide = 1;
  pWall.vy = 65;
  seenClips.add(resolveAriaAnimSample(pWall, GamePhase.Playing, 1.0).clipId); // wall_slide

  const pHurt = makePlayer();
  pHurt.hurtTimer = 0.25;
  seenClips.add(resolveAriaAnimSample(pHurt, GamePhase.Playing, 1.0).clipId); // hurt

  const pZanshinPending = makePlayer();
  pZanshinPending.zanshinPending = true;
  pZanshinPending.zanshinTimer = 0.65;
  assert.equal(
    resolveAriaAnimSample(pZanshinPending, GamePhase.Playing, 1.0).clipId,
    'idle',
    'Before 1.0s sheathe countdown finishes, character must not play premature zanshin frames'
  );

  const pZanshin = makePlayer();
  pZanshin.zanshinFlashTimer = 0.15;
  const zSample = resolveAriaAnimSample(pZanshin, GamePhase.Playing, 1.0);
  assert.equal(zSample.clipId, 'zanshin');
  assert.equal(Number(zSample.progress01.toFixed(2)), 0.5);
  seenClips.add(zSample.clipId); // zanshin

  assert.equal(seenClips.size, 26, 'Every single one of the 26 Aria actions must have its own unique clip');

  const baseEnemy = {
    id: 2,
    kind: EnemyKind.Halberdier,
    nameZh: '重装铁卫',
    x: 240,
    y: 226,
    homeMinX: 180,
    homeMaxX: 300,
    vx: 0,
    vy: 0,
    facing: -1 as const,
    grounded: true,
    hp: 120,
    maxHp: 120,
    rallyHp: 120,
    shieldActive: true,
    aiState: EnemyAIState.Patrol,
    stateTimer: 0.2,
    attackCooldown: 0.5,
    bossPatternIndex: 0,
    bossEnraged: false,
    hasAttackToken: false,
    hitConfirmedThisSwing: false,
    flashTimer: 0,
    scaleX: 1,
    scaleY: 1,
    gaitPhase: 0.8,
    koTimer: 0,
  };

  const enemyClips = new Set<string>([
    resolveEnemyAnimSample(baseEnemy, 1.0).clipId,
    resolveEnemyAnimSample({ ...baseEnemy, vx: 60 }, 1.0).clipId,
    resolveEnemyAnimSample({ ...baseEnemy, aiState: EnemyAIState.Windup, stateTimer: 0.2 }, 1.0).clipId,
    resolveEnemyAnimSample({ ...baseEnemy, aiState: EnemyAIState.Attack, stateTimer: 0.1 }, 1.0).clipId,
    resolveEnemyAnimSample({ ...baseEnemy, aiState: EnemyAIState.Hitstun, stateTimer: 0.1 }, 1.0).clipId,
  ]);
  assert.equal(enemyClips.size, 5, 'Enemy AI states must resolve to all 5 distinct enemy clips');
});

test('Dead Cells whip-snap curve & SWING_ARCS align Katana angles anatomically with every keyframe arm extension', () => {
  const makeP = (moveId: MoveId, moveTimer: number, facing: 1 | -1 = 1): PlayerEntity => ({
    x: 200,
    y: 226,
    vx: 0,
    vy: 0,
    facing,
    grounded: moveId !== MoveId.AirSlash1 && moveId !== MoveId.AirSlash2 && moveId !== MoveId.HelmSplitter,
    crouching: false,
    dropThroughTimer: 0,
    wallSlideSide: 0,
    wallJumpLockTimer: 0,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    attackBufferTimer: 0,
    attackBufferType: null,
    dashBufferTimer: 0,
    hp: 100,
    maxHp: 100,
    rallyHp: 100,
    stamina: 3,
    maxStamina: 3,
    bladeEnergy: 60,
    maxBladeEnergy: 100,
    jumpsRemaining: 0,
    airDashesUsed: 0,
    moveId,
    moveTimer,
    moveHitIds: new Set(),
    comboWindowTimer: 0,
    airComboCount: 0,
    zanshinPending: false,
    zanshinTimer: 0,
    zanshinFlashTimer: 0,
    isDashing: false,
    dashTimer: 0,
    dashCooldown: 0,
    dashAfterAttackWindow: 0,
    invulnTimer: 0,
    perfectDodgeWindow: 0,
    hurtTimer: 0,
    flashTimer: 0,
    lastSafeX: 200,
    lastSafeY: 226,
    scaleX: 1,
    scaleY: 1,
    gaitPhase: 0,
    skidTimer: 0,
    spinFlipTimer: 0,
    landRecoveryTimer: 0,
    hairLeft: [],
    hairRight: [],
    capeNodes: [],
  });

  // 1. Slash3 spin cut MUST finish pointing forward (`cos > 0.95`) along combo[2]'s horizontal arm, NEVER backward!
  const s3 = MOVES[MoveId.Slash3];
  const s3Peak = computeAriaPose(makeP(MoveId.Slash3, s3.windup + s3.active * 0.85, 1), 1.0);
  assert.ok(Math.cos(s3Peak.bladeAngle) > 0.95, `Slash3 blade must extend forward with arm, got ${s3Peak.bladeAngle}`);
  const s3Left = computeAriaPose(makeP(MoveId.Slash3, s3.windup + s3.active * 0.85, -1), 1.0);
  assert.ok(Math.cos(s3Left.bladeAngle) < -0.95, 'Left-facing Slash3 blade must mirror cleanly');

  // 2. RisingMoon uppercut MUST extend skyward (`sin < -0.94`) out of special[1]'s overhead fist!
  const rm = MOVES[MoveId.RisingMoon];
  const rmPeak = computeAriaPose(makeP(MoveId.RisingMoon, rm.windup + rm.active * 0.85, 1), 1.0);
  assert.ok(Math.sin(rmPeak.bladeAngle) < -0.94, `RisingMoon blade must thrust skyward, got ${rmPeak.bladeAngle}`);

  // 3. DashThrust & SlideSlash MUST extend forward horizontally (`cos > 0.97`)!
  const dt = MOVES[MoveId.DashThrust];
  const dtPeak = computeAriaPose(makeP(MoveId.DashThrust, dt.windup + dt.active * 0.8, 1), 1.0);
  assert.ok(Math.cos(dtPeak.bladeAngle) > 0.98, 'DashThrust blade must pierce straight forward');

  const sl = MOVES[MoveId.SlideSlash];
  const slPeak = computeAriaPose(makeP(MoveId.SlideSlash, sl.windup + sl.active * 0.8, 1), 1.0);
  assert.ok(Math.cos(slPeak.bladeAngle) > 0.97, 'SlideSlash blade must extend low and forward');

  // 4. HelmSplitter plunge MUST cleave downward-forward (`sin > 0.85 && cos > 0.25`) out of special[3]'s clasped hands!
  const hs = MOVES[MoveId.HelmSplitter];
  const hsPeak = computeAriaPose(makeP(MoveId.HelmSplitter, hs.windup + hs.active * 0.85, 1), 1.0);
  assert.ok(Math.sin(hsPeak.bladeAngle) > 0.85 && Math.cos(hsPeak.bladeAngle) > 0.25);

  // 5. Dead Cells whip-snap timing: >85% of swing arc completes within the first 38% of active window!
  const s1 = MOVES[MoveId.Slash1];
  const pStart = computeAriaPose(makeP(MoveId.Slash1, s1.windup + s1.active * 0.01, 1), 1.0).bladeAngle;
  const pSnap = computeAriaPose(makeP(MoveId.Slash1, s1.windup + s1.active * 0.38, 1), 1.0).bladeAngle;
  const pEnd = computeAriaPose(makeP(MoveId.Slash1, s1.windup + s1.active * 0.99, 1), 1.0).bladeAngle;
  const snapFraction = Math.abs(pSnap - pStart) / Math.abs(pEnd - pStart);
  assert.ok(snapFraction > 0.85, `Expected Dead Cells whip-snap >85% by u=0.38, got ${snapFraction}`);
});

test('16-frame 2-step run cycle resolves all 16 distinct frame slots monotonically across a 2π gait cycle', async () => {
  const { computeClipFrameIndex, resolveAriaAnimSample } = await import('./animClips');
  const { GamePhase } = await import('./types');

  const runner: PlayerEntity = {
    x: 200,
    y: 226,
    vx: 176,
    vy: 0,
    facing: 1,
    grounded: true,
    crouching: false,
    dropThroughTimer: 0,
    wallSlideSide: 0,
    wallJumpLockTimer: 0,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    attackBufferTimer: 0,
    attackBufferType: null,
    dashBufferTimer: 0,
    hp: 100,
    maxHp: 100,
    rallyHp: 100,
    stamina: 3,
    maxStamina: 3,
    bladeEnergy: 60,
    maxBladeEnergy: 100,
    jumpsRemaining: 0,
    airDashesUsed: 0,
    moveId: MoveId.None,
    moveTimer: 0,
    moveHitIds: new Set(),
    comboWindowTimer: 0,
    airComboCount: 0,
    zanshinPending: false,
    zanshinTimer: 0,
    zanshinFlashTimer: 0,
    isDashing: false,
    dashTimer: 0,
    dashCooldown: 0,
    dashAfterAttackWindow: 0,
    invulnTimer: 0,
    perfectDodgeWindow: 0,
    hurtTimer: 0,
    flashTimer: 0,
    lastSafeX: 200,
    lastSafeY: 226,
    scaleX: 1,
    scaleY: 1,
    gaitPhase: 0,
    skidTimer: 0,
    spinFlipTimer: 0,
    landRecoveryTimer: 0,
    hairLeft: [],
    hairRight: [],
    capeNodes: [],
  };

  const visitedSlots: number[] = [];
  for (let slot = 0; slot < 16; slot++) {
    runner.gaitPhase = ((slot + 0.5) / 16) * Math.PI * 2;
    const sample = resolveAriaAnimSample(runner, GamePhase.Playing, 1.0);
    assert.equal(sample.clipId, 'run');
    assert.equal(sample.loop, true);
    visitedSlots.push(computeClipFrameIndex(16, sample.progress01, sample.loop));
  }

  assert.deepEqual(
    visitedSlots,
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    'Run cycle must step monotonically through all 16 in-between & keyframe slots without ping-ponging'
  );
});

test('16-slot multi-stage combat clips, 60 FPS sub-frame interpolation, and distinct move trajectories eliminate duplicate move animations and mid-swing freeze', async () => {
  const { computeClipFrameSubSample, resolveAriaAnimSample } = await import('./animClips');
  const { GamePhase } = await import('./types');

  const makeCombatPlayer = (moveId: MoveId, moveTimer: number): PlayerEntity => ({
    x: 200,
    y: 226,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: moveId !== MoveId.AirSlash1 && moveId !== MoveId.AirSlash2 && moveId !== MoveId.HelmSplitter,
    crouching: false,
    dropThroughTimer: 0,
    wallSlideSide: 0,
    wallJumpLockTimer: 0,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    attackBufferTimer: 0,
    attackBufferType: null,
    dashBufferTimer: 0,
    hp: 100,
    maxHp: 100,
    rallyHp: 100,
    stamina: 3,
    maxStamina: 3,
    bladeEnergy: 60,
    maxBladeEnergy: 100,
    jumpsRemaining: 0,
    airDashesUsed: 0,
    moveId,
    moveTimer,
    moveHitIds: new Set(),
    comboWindowTimer: 0,
    airComboCount: 0,
    zanshinPending: false,
    zanshinTimer: 0,
    zanshinFlashTimer: 0,
    isDashing: false,
    dashTimer: 0,
    dashCooldown: 0,
    dashAfterAttackWindow: 0,
    invulnTimer: 0,
    perfectDodgeWindow: 0,
    hurtTimer: 0,
    flashTimer: 0,
    lastSafeX: 200,
    lastSafeY: 226,
    scaleX: 1,
    scaleY: 1,
    gaitPhase: 0,
    skidTimer: 0,
    spinFlipTimer: 0,
    landRecoveryTimer: 0,
    hairLeft: [],
    hairRight: [],
    capeNodes: [],
  });

  // 1. Verify all 16 slots of an attack clip are traversed monotonically with continuous subT in [0, 1]
  const s1 = MOVES[MoveId.Slash1];
  const totalS1 = s1.windup + s1.active + s1.recovery;
  let prevIdx = 0;
  const hitSlots = new Set<number>();
  for (let step = 0; step <= 48; step++) {
    const t = (step / 48) * totalS1;
    const sample = resolveAriaAnimSample(makeCombatPlayer(MoveId.Slash1, t), GamePhase.Playing, 1.0);
    const sub = computeClipFrameSubSample(16, sample.progress01, false);
    assert.ok(sub.index >= prevIdx, `16-slot index must advance monotonically: ${sub.index} >= ${prevIdx}`);
    assert.ok(sub.subT >= 0 && sub.subT <= 1, 'subT must remain within [0, 1]');
    prevIdx = sub.index;
    hitSlots.add(sub.index);
  }
  assert.ok(hitSlots.size >= 14, `Expected 60Hz sampling to traverse >= 14 of 16 slots, got ${hitSlots.size}`);

  // 2. Verify zero mid-swing freeze in the second half of active window (u = 0.55 vs u = 0.95)
  const midActive = computeAriaPose(makeCombatPlayer(MoveId.Slash1, s1.windup + s1.active * 0.55), 1.0);
  const endActive = computeAriaPose(makeCombatPlayer(MoveId.Slash1, s1.windup + s1.active * 0.95), 1.0);
  assert.ok(
    Math.abs(endActive.bladeAngle - midActive.bladeAngle) > 0.08,
    'Katana must continue sweeping smoothly through late active overswing without freezing'
  );

  // 3. Verify formerly similar moves now have unmistakable, distinct trajectories & hand tracks!
  const s4Spec = MOVES[MoveId.Slash4];
  const hcSpec = MOVES[MoveId.HeavyCrescent];
  const s4Peak = computeAriaPose(makeCombatPlayer(MoveId.Slash4, s4Spec.windup + s4Spec.active * 0.9), 1.0);
  const hcPeak = computeAriaPose(makeCombatPlayer(MoveId.HeavyCrescent, hcSpec.windup + hcSpec.active * 0.9), 1.0);
  assert.ok(
    Math.abs(hcPeak.bladeAngle - s4Peak.bladeAngle) > 0.55,
    'HeavyCrescent guillotine slam must have a sharply lower blade angle than Slash4 horizontal lunge'
  );

  const dtSpec = MOVES[MoveId.DashThrust];
  const mcSpec = MOVES[MoveId.MoonCounter];
  const dtCoil = computeAriaPose(makeCombatPlayer(MoveId.DashThrust, dtSpec.windup * 0.9), 1.0);
  const mcCoil = computeAriaPose(makeCombatPlayer(MoveId.MoonCounter, mcSpec.windup * 0.9), 1.0);
  assert.ok(
    Math.abs(dtCoil.bladeAngle - mcCoil.bladeAngle) > 1.5,
    'MoonCounter vertical face-parry coil must be completely distinct from DashThrust trailing hip coil'
  );

  const a1Spec = MOVES[MoveId.AirSlash1];
  const a2Spec = MOVES[MoveId.AirSlash2];
  const a1Coil = computeAriaPose(makeCombatPlayer(MoveId.AirSlash1, a1Spec.windup * 0.9), 1.0);
  const a2Coil = computeAriaPose(makeCombatPlayer(MoveId.AirSlash2, a2Spec.windup * 0.9), 1.0);
  assert.ok(
    Math.abs(a1Coil.bladeAngle - a2Coil.bladeAngle) > 1.5,
    'AirSlash1 and AirSlash2 must wind up from opposite directions'
  );
});

test('Zanshin 1.0s fixed sheathe + 0.3s glint window, 1.5s MoonCounter with 0.2x world time dilation, and 54 roguelike upgrades across 6 schools', async () => {
  const {
    ZANSHIN_SHEATHE_DELAY,
    ZANSHIN_GLINT_WINDOW,
    computeWorldTimeScale,
    getMoveTotalDuration,
  } = await import('./rules');
  const { ALL_UPGRADE_IDS, UPGRADE_SPECS, computeUpgradeModifiers, createEmptyUpgradeMap } =
    await import('./roguelike');
  const { UpgradeSchool } = await import('./types');

  // 1. Zanshin fixed 1.0s post-attack sheathe delay & 0.3s glint window
  assert.equal(ZANSHIN_SHEATHE_DELAY, 1.0, 'Zanshin sheathe must trigger fixed 1.0s after attack ends');
  assert.equal(ZANSHIN_GLINT_WINDOW, 0.3, 'Zanshin glint window must be 0.3s');

  // 2. Crimson Blade Slash (`MoonCounter`) dedicated 1.5s duration & 0.2x world time dilation
  const moonCounterTotal = Number(getMoveTotalDuration(MoveId.MoonCounter).toFixed(2));
  assert.equal(moonCounterTotal, 1.5, 'MoonCounter Crimson Blade Slash must have a 1.5s total duration');

  const dilation = computeWorldTimeScale(MoveId.MoonCounter, false);
  assert.equal(dilation.playerScale, 1.0, 'Player character must remain at 1.0x speed during MoonCounter');
  assert.equal(
    dilation.worldScale,
    0.2,
    'Everything except the player must slow to 0.2x during MoonCounter'
  );

  // 3. 54 selectable roguelike upgrades (>= 50 required), 9 per school across all 6 schools
  assert.ok(
    ALL_UPGRADE_IDS.length >= 50,
    `Expected >= 50 selectable upgrades, got ${ALL_UPGRADE_IDS.length}`
  );
  assert.equal(ALL_UPGRADE_IDS.length, 54, 'Expected 54 distinct upgrades (9 per school x 6 schools)');

  const countsBySchool: Record<string, number> = {};
  const maxedLevels = createEmptyUpgradeMap();
  for (const id of ALL_UPGRADE_IDS) {
    const spec = UPGRADE_SPECS[id];
    assert.ok(spec && spec.nameZh.length > 0, `Upgrade ${id} must have a valid spec`);
    countsBySchool[spec.school] = (countsBySchool[spec.school] ?? 0) + 1;
    maxedLevels[id] = 1;
  }

  assert.equal(countsBySchool[UpgradeSchool.Lunar], 9);
  assert.equal(countsBySchool[UpgradeSchool.Brutality], 9);
  assert.equal(countsBySchool[UpgradeSchool.Tactics], 9);
  assert.equal(countsBySchool[UpgradeSchool.Survival], 9);
  assert.equal(countsBySchool[UpgradeSchool.Onslaught], 9);
  assert.equal(countsBySchool[UpgradeSchool.SoulHeart], 9);

  const mods = computeUpgradeModifiers(maxedLevels);
  assert.equal(mods.totalUpgrades, 54);
  assert.ok(mods.crimsonSlashMult > 1.5);
  assert.ok(mods.zanshinLSkillMult > 1.6);
  assert.ok(mods.attackSpeedMult > 1.3);
  assert.ok(mods.bonusMaxHp >= 100);
});

test('strengthened enemy & boss stats, poise/super-armor (霸体) rules, and continuous enemy weapon smear articulation work deterministically', async () => {
  const { ENEMY_COMBAT_STATS, shouldEnemyResistHitstun } = await import('./rules');
  const { solveEnemySkeleton } = await import('./skeleton');
  const { EnemyAIState } = await import('./types');

  // 1. Strengthened HP, speed, and damage across all 8 enemy & boss archetypes
  assert.ok(ENEMY_COMBAT_STATS[EnemyKind.Stalker].hp >= 110);
  assert.ok(ENEMY_COMBAT_STATS[EnemyKind.Halberdier].hp >= 200);
  assert.ok(ENEMY_COMBAT_STATS[EnemyKind.Reaper].hp >= 160);
  assert.ok(ENEMY_COMBAT_STATS[EnemyKind.Warden].hp >= 850);
  assert.ok(ENEMY_COMBAT_STATS[EnemyKind.Archon].hp >= 950);
  assert.ok(ENEMY_COMBAT_STATS[EnemyKind.Sovereign].hp >= 1200);
  assert.ok(ENEMY_COMBAT_STATS[EnemyKind.Sovereign].meleeDamage >= 26);

  // 2. Poise / Super-Armor (`shouldEnemyResistHitstun`)
  assert.equal(
    shouldEnemyResistHitstun(EnemyKind.Sovereign, EnemyAIState.Approach, 0.2, null, false),
    true,
    'Bosses must resist light hitstun'
  );
  assert.equal(
    shouldEnemyResistHitstun(EnemyKind.Sovereign, EnemyAIState.Windup, 0.2, null, true),
    false,
    'Heavy break moves can stagger bosses during windup'
  );
  assert.equal(
    shouldEnemyResistHitstun(EnemyKind.Sovereign, EnemyAIState.Attack, 0.15, null, true),
    true,
    'Bosses in active strike have full super-armor even against heavy attacks'
  );
  assert.equal(
    shouldEnemyResistHitstun(EnemyKind.Halberdier, EnemyAIState.Windup, 0.2, null, false),
    true,
    'Armored Halberdier resists light hitstun'
  );
  assert.equal(
    shouldEnemyResistHitstun(EnemyKind.Stalker, EnemyAIState.Windup, 0.12, null, false),
    true,
    'Regular enemy in late windup (<0.22s) has hyper-armor against light pokes'
  );
  assert.equal(
    shouldEnemyResistHitstun(EnemyKind.Stalker, EnemyAIState.Approach, 0.2, null, false),
    false,
    'Regular unarmored enemy in approach is stunned by normal attacks'
  );

  // 3. Continuous enemy weapon sweep & smear intensity during active attack
  const dummySovereign = {
    id: 99,
    kind: EnemyKind.Sovereign,
    nameZh: '绯月女武神 · 瑟琳',
    x: 300,
    y: 226,
    homeMinX: 100,
    homeMaxX: 500,
    vx: 0,
    vy: 0,
    facing: -1 as const,
    grounded: true,
    hp: 1280,
    maxHp: 1280,
    rallyHp: 1280,
    shieldActive: false,
    aiState: EnemyAIState.Attack,
    stateTimer: 0.18,
    attackCooldown: 0.8,
    bossPatternIndex: 0,
    bossEnraged: true,
    hasAttackToken: true,
    hitConfirmedThisSwing: false,
    flashTimer: 0,
    scaleX: 1,
    scaleY: 1,
    gaitPhase: 0,
    koTimer: 0,
  };
  const rigEarly = solveEnemySkeleton(dummySovereign, 1.0);
  const rigLate = solveEnemySkeleton({ ...dummySovereign, stateTimer: 0.04 }, 1.05);
  assert.ok(rigEarly.weaponSmearIntensity >= 0.9, 'Active boss swing must emit weapon smear');
  assert.notEqual(
    rigEarly.weapon.angle,
    rigLate.weapon.angle,
    'Enemy weapon bone must sweep continuously across active attack frames'
  );
});

test('hold-J AstralSlash consecutive sheathe halving, exclusive L Lunar skills with 0.2x time-slow, combat room exit lockdown, and multi-scale rooms work deterministically', async () => {
  const {
    advanceComboStage,
    buildLockedExitBarriers,
    computeWorldTimeScale,
    computeZanshinSheatheDelay,
    getMoveTotalDuration,
    isRoomLockedByEnemies,
  } = await import('./rules');
  const { PLAYER_HALF_W, PLAYER_HEIGHT, findTriggeredExit, generateWorld } = await import('./world');

  // 1. Consecutive AstralSlash sheathe-time halving: 1.0 -> 0.5 -> 0.25 -> 0.125 -> 0.08
  assert.equal(computeZanshinSheatheDelay(0), 1.0);
  assert.equal(computeZanshinSheatheDelay(1), 0.5);
  assert.equal(computeZanshinSheatheDelay(2), 0.25);
  assert.equal(computeZanshinSheatheDelay(3), 0.125);
  assert.equal(computeZanshinSheatheDelay(4), 0.08);
  assert.equal(computeZanshinSheatheDelay(8), 0.08);

  // 2. Zanshin glint + holding J triggers MoveId.AstralSlash (ranged slash) and preserves combo stage
  const astral = resolveNextAttackMove({
    button: 'light',
    grounded: true,
    holdUp: false,
    holdDown: false,
    currentMove: MoveId.None,
    comboWindowOpen: false,
    airComboCount: 0,
    dashAfterAttackOpen: false,
    perfectDodgeWindowOpen: false,
    zanshinGlintOpen: true,
    holdingAttack: true,
    bladeEnergy: 20,
    savedComboStage: 2,
  });
  assert.equal(astral, MoveId.AstralSlash);
  assert.equal(Number(getMoveTotalDuration(MoveId.AstralSlash).toFixed(2)), 0.96);
  assert.equal(
    advanceComboStage(2, MoveId.AstralSlash),
    2,
    'AstralSlash must preserve saved ground combo stage'
  );

  // 3. L key (`button: 'heavy'`) belongs 100% exclusively to Lunar (`月魄`) even during Zanshin glint!
  const lunarGround = resolveNextAttackMove({
    button: 'heavy',
    grounded: true,
    holdUp: false,
    holdDown: false,
    currentMove: MoveId.None,
    comboWindowOpen: false,
    airComboCount: 0,
    dashAfterAttackOpen: false,
    perfectDodgeWindowOpen: false,
    zanshinGlintOpen: true,
    holdingAttack: true,
    bladeEnergy: 20,
  });
  assert.equal(lunarGround, MoveId.HeavyCrescent);

  const lunarAir = resolveNextAttackMove({
    button: 'heavy',
    grounded: false,
    holdUp: false,
    holdDown: false,
    currentMove: MoveId.None,
    comboWindowOpen: false,
    airComboCount: 0,
    dashAfterAttackOpen: false,
    perfectDodgeWindowOpen: false,
    zanshinGlintOpen: true,
    bladeEnergy: 20,
  });
  assert.equal(lunarAir, MoveId.HelmSplitter);

  const lunarUlt = resolveNextAttackMove({
    button: 'heavy',
    grounded: true,
    holdUp: false,
    holdDown: false,
    currentMove: MoveId.None,
    comboWindowOpen: false,
    airComboCount: 0,
    dashAfterAttackOpen: false,
    perfectDodgeWindowOpen: false,
    zanshinGlintOpen: true,
    bladeEnergy: 50,
  });
  assert.equal(lunarUlt, MoveId.DimensionCut);

  // 4. All three signature schools (赤刃 MoonCounter, 星术 AstralSlash, 月魄 HeavyCrescent/DimensionCut/Lunar L) slow world to 0.2x
  for (const sigMove of [
    MoveId.MoonCounter,
    MoveId.AstralSlash,
    MoveId.HeavyCrescent,
    MoveId.DimensionCut,
  ]) {
    const ts = computeWorldTimeScale(sigMove, false);
    assert.equal(ts.playerScale, 1.0, `${sigMove} must keep player at 1.0x`);
    assert.equal(ts.worldScale, 0.2, `${sigMove} must slow world to 0.2x`);
  }
  const aerialLunarSlow = computeWorldTimeScale(MoveId.HelmSplitter, false, true);
  assert.equal(aerialLunarSlow.worldScale, 0.2, 'Aerial L HelmSplitter must also slow world to 0.2x');
  const normalPlunge = computeWorldTimeScale(MoveId.HelmSplitter, false, false);
  assert.equal(normalPlunge.worldScale, 1.0, 'S+J plunge without L must remain 1.0x');

  // 5. Combat Room Exit Lockdown physically seals exits until all enemies are defeated
  assert.equal(isRoomLockedByEnemies(false, 3), true);
  assert.equal(isRoomLockedByEnemies(false, 0), false);
  assert.equal(isRoomLockedByEnemies(true, 2), false);

  const world = generateWorld(77491);
  const combatRoom = ALL_ROOM_IDS.map((id) => world[id]).find(
    (r) => r.enemies.length > 0 && r.exits.some((e) => e.direction === 'right' || e.direction === 'left')
  )!;
  assert.ok(combatRoom && combatRoom.enemies.length > 0 && combatRoom.exits.length > 0);
  const rightOrLeftExit = combatRoom.exits.find(
    (e) => e.direction === 'right' || e.direction === 'left'
  )!;
  assert.ok(rightOrLeftExit, 'Combat room must have a horizontal exit');

  const lockedPlatforms = [
    ...combatRoom.platforms,
    ...buildLockedExitBarriers(combatRoom.exits, combatRoom.width, combatRoom.height),
  ];
  const dirSign = rightOrLeftExit.direction === 'right' ? 1 : -1;
  const startX =
    rightOrLeftExit.direction === 'right'
      ? rightOrLeftExit.x - 16
      : rightOrLeftExit.x + rightOrLeftExit.w + 16;
  const floorY = rightOrLeftExit.y + rightOrLeftExit.h;

  const blockedStep = resolveRoomMovement({
    prevX: startX,
    prevY: floorY,
    nextX: startX + dirSign * 28,
    nextY: floorY,
    vx: dirSign * 180,
    vy: 0,
    halfW: PLAYER_HALF_W,
    height: PLAYER_HEIGHT,
    dropThrough: false,
    platforms: lockedPlatforms,
  });
  assert.equal(
    findTriggeredExit(blockedStep.x, blockedStep.y, PLAYER_HEIGHT, combatRoom.exits),
    null,
    'Locked portcullis barrier must physically prevent player from reaching exit trigger'
  );

  const openStep = resolveRoomMovement({
    prevX: startX,
    prevY: floorY,
    nextX: startX + dirSign * 28,
    nextY: floorY,
    vx: dirSign * 180,
    vy: 0,
    halfW: PLAYER_HALF_W,
    height: PLAYER_HEIGHT,
    dropThrough: false,
    platforms: combatRoom.platforms,
  });
  assert.ok(
    findTriggeredExit(openStep.x, openStep.y, PLAYER_HEIGHT, combatRoom.exits) !== null,
    'Once unlocked, walking into the doorway triggers room transition'
  );

  // 6. Multi-Scale Room Dimensions across generated rooms
  const widths = new Set<number>();
  const heights = new Set<number>();
  let minW = Infinity;
  let maxW = 0;
  let minH = Infinity;
  let maxH = 0;
  for (const id of ALL_ROOM_IDS) {
    const r = world[id];
    widths.add(r.width);
    heights.add(r.height);
    if (r.width < minW) minW = r.width;
    if (r.width > maxW) maxW = r.width;
    if (r.height < minH) minH = r.height;
    if (r.height > maxH) maxH = r.height;
  }
  assert.ok(widths.size >= 4, `Expected >= 4 distinct room widths, got ${widths.size}`);
  assert.ok(heights.size >= 3, `Expected >= 3 distinct room heights, got ${heights.size}`);
  assert.ok(maxW - minW >= 320, `Expected wide room scale spread (>=320 world units), got ${minW}..${maxW}`);
  assert.ok(maxH - minH >= 140, `Expected tall shaft vs compact room height spread (>=140), got ${minH}..${maxH}`);
});

test('computeAriaPelvisSpineAnchorX keeps Aria spine centered across standing, twin-tail whip, and AstralSlash outstretched-arm poses', async () => {
  const { computeAriaPelvisSpineAnchorX, resolveAriaAnimSample } = await import('./animClips');

  const W = 120;
  const H = 148;

  const paintRect = (
    buf: Uint8ClampedArray,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    r: number,
    g: number,
    b: number
  ) => {
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
        const i = (y * W + x) << 2;
        buf[i] = r;
        buf[i + 1] = g;
        buf[i + 2] = b;
        buf[i + 3] = 255;
      }
    }
  };

  // Canonical Aria skirt at x=[34..58] (center = 46), with dark-navy borders + white lace front apron inside
  const makeBaseSkirt = (): Uint8ClampedArray => {
    const buf = new Uint8ClampedArray(W * H * 4);
    paintRect(buf, 34, 66, 58, 102, 22, 30, 58); // Dark navy pleated skirt
    paintRect(buf, 41, 68, 51, 98, 228, 232, 242); // Enclosed white lace apron
    return buf;
  };

  // 1. Upright standing pose -> anchorX === 46
  const standing = makeBaseSkirt();
  const anchorStanding = computeAriaPelvisSpineAnchorX(standing, W, H);
  assert.equal(anchorStanding, 46);

  // 2. AstralSlash lunge with wide outstretched right arm/fist + detached twin-tail strand on left
  const astralLunge = makeBaseSkirt();
  paintRect(astralLunge, 8, 70, 20, 92, 186, 192, 208); // Detached silver twin-tail on left
  paintRect(astralLunge, 66, 72, 98, 84, 24, 32, 62); // Detached outstretched sleeve/forearm on right
  paintRect(astralLunge, 99, 73, 108, 83, 238, 198, 178); // Outstretched warm-skin fist
  const anchorAstral = computeAriaPelvisSpineAnchorX(astralLunge, W, H);
  assert.ok(
    Math.abs(anchorAstral - anchorStanding) <= 1,
    `Expected AstralSlash lunge spine anchor within 1px of ${anchorStanding}, got ${anchorAstral}`
  );

  // 3. Recovery pose with silver twin-tail touching left skirt edge + warm skin hand touching right skirt edge
  const touchingEdges = makeBaseSkirt();
  paintRect(touchingEdges, 24, 68, 33, 96, 182, 188, 202); // Silver hair touching left edge of skirt
  paintRect(touchingEdges, 59, 74, 66, 86, 236, 194, 174); // Warm skin hand touching right edge of skirt
  const anchorTouching = computeAriaPelvisSpineAnchorX(touchingEdges, W, H);
  assert.ok(
    Math.abs(anchorTouching - anchorStanding) <= 1,
    `Expected touching hair/hand spine anchor within 1px of ${anchorStanding}, got ${anchorTouching}`
  );

  // 4. Overhead sword-raise pose (`HeavyCrescent` windup, H=172 due to raised arms above head)
  //    Skirt remains at identical distance from bottom boots (`y = 24 + 66 .. 24 + 102`), while chest/arms sit higher
  const H_TALL = 172;
  const overheadBuf = new Uint8ClampedArray(W * H_TALL * 4);
  const paintTall = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    r: number,
    g: number,
    b: number
  ) => {
    for (let y = Math.max(0, y0); y <= Math.min(H_TALL - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
        const i = (y * W + x) << 2;
        overheadBuf[i] = r;
        overheadBuf[i + 1] = g;
        overheadBuf[i + 2] = b;
        overheadBuf[i + 3] = 255;
      }
    }
  };
  paintTall(20, 6, 72, 34, 24, 32, 62); // Wide asymmetrically raised sleeves above head
  paintTall(34, 90, 58, 126, 22, 30, 58); // Dark navy pleated skirt anchored 46..82px above boot soles
  paintTall(41, 92, 51, 122, 228, 232, 242); // Enclosed white lace apron
  paintTall(6, 72, 26, 98, 186, 192, 208); // Sweeping twin-tail at upper chest height (outside bottom-locked skirt band!)
  const anchorOverhead = computeAriaPelvisSpineAnchorX(overheadBuf, W, H_TALL);
  assert.ok(
    Math.abs(anchorOverhead - anchorStanding) <= 1,
    `Expected HeavyCrescent overhead-arm spine anchor within 1px of ${anchorStanding}, got ${anchorOverhead}`
  );

  // 4b. A-line flared Gothic skirt where outer right skirt flare only spans 10..12 rows next to white lace apron
  const flaredA = new Uint8ClampedArray(W * H * 4);
  const flaredB = new Uint8ClampedArray(W * H * 4);
  for (const [buf, rimTopY] of [
    [flaredA, 89],
    [flaredB, 91],
  ] as const) {
    paintRect(buf, 34, 66, 44, 102, 22, 30, 58); // Left dark-navy skirt pleat
    paintRect(buf, 45, 66, 55, 102, 228, 232, 242); // Bright white front lace apron
    paintRect(buf, 56, rimTopY, 58, 102, 22, 30, 58); // Diagonal outer skirt flare (11..13 rows)
  }
  const anchorFlaredA = computeAriaPelvisSpineAnchorX(flaredA, W, H);
  const anchorFlaredB = computeAriaPelvisSpineAnchorX(flaredB, W, H);
  assert.equal(
    anchorFlaredA,
    anchorFlaredB,
    `Expected identical spine anchor across minor A-line skirt flare height differences (${anchorFlaredA} vs ${anchorFlaredB})`
  );
  assert.ok(
    Math.abs(anchorFlaredA - anchorStanding) <= 1,
    `Expected flared skirt + white apron anchor within 1px of ${anchorStanding}, got ${anchorFlaredA}`
  );

  // 5. Verify MoveId.AstralSlash, HeavyCrescent, and DimensionCut progressions map monotonically [0..1]
  const dummyPlayer = {
    x: 100,
    y: 200,
    vx: 0,
    vy: 0,
    facing: 1 as const,
    grounded: true,
    crouching: false,
    isDashing: false,
    dashTimer: 0,
    hurtTimer: 0,
    zanshinFlashTimer: 0,
    wallSlideSide: 0 as const,
    spinFlipTimer: 0,
    skidTimer: 0,
    landRecoveryTimer: 0,
    gaitPhase: 0,
    scaleX: 1,
    scaleY: 1,
    moveId: MoveId.AstralSlash,
    moveTimer: 0.1,
  } as unknown as PlayerEntity;

  const sWindup = resolveAriaAnimSample(dummyPlayer, 1 as never, 0);
  dummyPlayer.moveTimer = 0.35;
  const sActive = resolveAriaAnimSample(dummyPlayer, 1 as never, 0);
  dummyPlayer.moveTimer = 0.78;
  const sRecovery = resolveAriaAnimSample(dummyPlayer, 1 as never, 0);

  assert.equal(sWindup.clipId, 'astral_slash');
  assert.equal(sActive.clipId, 'astral_slash');
  assert.equal(sRecovery.clipId, 'astral_slash');
  assert.ok(sWindup.progress01 < 0.25);
  assert.ok(sActive.progress01 >= 0.25 && sActive.progress01 < 0.625);
  assert.ok(sRecovery.progress01 >= 0.625 && sRecovery.progress01 <= 1);

  dummyPlayer.moveId = MoveId.HeavyCrescent;
  dummyPlayer.moveTimer = 0.08;
  const hcWindup = resolveAriaAnimSample(dummyPlayer, 1 as never, 0);
  dummyPlayer.moveTimer = 0.32;
  const hcActive = resolveAriaAnimSample(dummyPlayer, 1 as never, 0);
  assert.equal(hcWindup.clipId, 'heavy_crescent');
  assert.equal(hcActive.clipId, 'heavy_crescent');
  assert.ok(hcWindup.progress01 < 0.25 && hcActive.progress01 >= 0.25 && hcActive.progress01 < 0.625);

  dummyPlayer.moveId = MoveId.DimensionCut;
  dummyPlayer.moveTimer = 0.08;
  const dcWindup = resolveAriaAnimSample(dummyPlayer, 1 as never, 0);
  dummyPlayer.moveTimer = 0.34;
  const dcActive = resolveAriaAnimSample(dummyPlayer, 1 as never, 0);
  assert.equal(dcWindup.clipId, 'dimension_cut');
  assert.equal(dcActive.clipId, 'dimension_cut');
  assert.ok(dcWindup.progress01 < 0.25 && dcActive.progress01 >= 0.25 && dcActive.progress01 < 0.625);
});

test('5s/charge dash stamina recovery, pixel-exact K-dash Perfect Dodge gating, and Astral-only ranged exclusivity hold across all 54 upgrades', async () => {
  const {
    BASE_DASH_REGEN_PER_SEC,
    BASE_DASH_REGEN_SECONDS,
    canTriggerPixelPerfectDodge,
    computeDashRegenPerSec,
  } = await import('./rules');
  const { ALL_UPGRADE_IDS, UPGRADE_SPECS, computeUpgradeModifiers, createEmptyUpgradeMap } =
    await import('./roguelike');
  const { UpgradeId, UpgradeSchool } = await import('./types');

  // 1. Dash charge recovery speed = 5.0s per charge (0.20 charge / second)
  assert.equal(BASE_DASH_REGEN_SECONDS, 5.0);
  assert.equal(BASE_DASH_REGEN_PER_SEC, 0.2);
  assert.equal(Number((computeDashRegenPerSec(1) * 5.0).toFixed(6)), 1.0);
  assert.equal(Number(computeDashRegenPerSec(1.5).toFixed(6)), 0.3);

  // 2. K-dash Perfect Dodge triggers strictly while dashing, once per dash, and only when crossing hostile VFX pixels
  assert.equal(canTriggerPixelPerfectDodge(false, false, true), false, 'Must not trigger when not dashing');
  assert.equal(canTriggerPixelPerfectDodge(true, false, false), false, 'Must not trigger in empty space without hostile VFX pixels');
  assert.equal(canTriggerPixelPerfectDodge(true, true, true), false, 'Must not trigger twice during the same dash');
  assert.equal(canTriggerPixelPerfectDodge(true, false, true), true, 'Must trigger when dash hurtbox crosses hostile VFX pixels');

  // 3. Zero non-`星术` (`UpgradeSchool.Tactics`) upgrades grant ranged projectiles/sword-waves
  for (const id of ALL_UPGRADE_IDS) {
    const spec = UPGRADE_SPECS[id];
    if (spec.school !== UpgradeSchool.Tactics) {
      const fullCopy = `${spec.nameZh} | ${spec.subtitleZh} | ${spec.describeEffect(1)} | ${spec.describeStatPreview(0, 1)}`;
      assert.equal(
        /剑波|血波|刀波|飞刃|弹丸|远程/.test(fullCopy),
        false,
        `Non-Astral upgrade ${id} must not grant ranged projectiles: ${fullCopy}`
      );
    }
  }

  // 4. Reworked melee slash modifiers compute cleanly
  const lv = createEmptyUpgradeMap();
  lv[UpgradeId.MoonWave] = 2;
  lv[UpgradeId.LunarTwinWave] = 2;
  lv[UpgradeId.ScarletWave] = 2;
  lv[UpgradeId.HyperSonicSlash] = 2;
  const mods = computeUpgradeModifiers(lv);
  assert.ok(mods.moonWaveDamage > 0, 'MoonWave must grant close-range melee Lunar heavy arc damage');
  assert.ok(mods.lunarSlashRadiusMult > 1.15, 'LunarTwinWave must expand melee Lunar slash arc radius');
  assert.ok(mods.twinWaveDamage > 0, 'LunarTwinWave must enable melee double-layered Lunar arc damage');
  assert.ok(mods.scarletWaveDamage > 0, 'ScarletWave must grant close-range crimson melee follow-up arc damage');
  assert.ok(mods.hypersonicSlashDamage > 0, 'HyperSonicSlash must grant close-range vacuum melee slash damage');
});

test('MoonCounter (赤刃 · 刹那血闪) maps windup/active/recovery monotonically across moon_counter slots and anchors crouched wide lunges cleanly', async () => {
  const { computeAriaPelvisSpineAnchorX, computeClipFrameSubSample, resolveAriaAnimSample } =
    await import('./animClips');
  const { MOVES } = await import('./rules');

  const spec = MOVES[MoveId.MoonCounter];
  const dummyPlayer: any = {
    x: 200,
    y: 260,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: true,
    isCrouching: false,
    isDashing: false,
    dashTimer: 0,
    wallSlideSide: 0,
    hurtTimer: 0,
    zanshinFlashTimer: 0,
    spinFlipTimer: 0,
    gaitPhase: 0,
    moveId: MoveId.MoonCounter,
    moveTimer: 0,
    scaleX: 1,
    scaleY: 1,
  };

  let prevSlot = -1;
  for (const t of [0.0, 0.18, 0.35, 0.37, 0.55, 0.72, 0.89, 0.92, 1.15, 1.35, 1.49]) {
    dummyPlayer.moveTimer = t;
    const sample = resolveAriaAnimSample(dummyPlayer, 1 as never, t);
    assert.equal(sample.clipId, 'moon_counter');
    assert.equal(sample.loop, false);
    const sub = computeClipFrameSubSample(16, sample.progress01, false);
    assert.ok(sub.index >= prevSlot, `Slot index must advance monotonically: ${sub.index} < ${prevSlot}`);
    prevSlot = sub.index;
  }
  assert.equal(Number((spec.windup + spec.active + spec.recovery).toFixed(2)), 1.5);

  // Verify pelvis spine anchor remains centered on the torso/skirt (with white apron) even on crouched 131x130 wide-lunge frames
  const w = 131;
  const h = 130;
  const buf = new Uint8ClampedArray(w * h * 4);
  const putRect = (x0: number, x1: number, y0: number, y1: number, r: number, g: number, b: number) => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = (y * w + x) * 4;
        buf[i] = r;
        buf[i + 1] = g;
        buf[i + 2] = b;
        buf[i + 3] = 255;
      }
    }
  };
  // Outstretched rear twintails on left + outstretched arm on right (should NOT pull pelvis anchor!)
  putRect(8, 38, 42, 66, 172, 176, 184);
  putRect(84, 124, 34, 44, 34, 40, 62);
  // Central crouched navy skirt + bright white lace apron centered around x=66
  putRect(48, 84, 52, 92, 32, 38, 58);
  putRect(62, 76, 56, 90, 232, 236, 242);

  const anchorX = computeAriaPelvisSpineAnchorX(buf, w, h);
  assert.ok(
    anchorX >= 63 && anchorX <= 69,
    `Expected crouched wide-lunge pelvis anchor near torso center 66, got ${anchorX}`
  );
});

