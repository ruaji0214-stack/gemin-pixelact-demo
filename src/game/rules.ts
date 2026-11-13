import { UpgradeModifiers } from './roguelike';
import {
  EliteAffix,
  EnemyAIState,
  EnemyKind,
  MoveId,
  MoveSpec,
  PlatformRect,
  RelicId,
  RoomExit,
  StyleRank,
} from './types';

// Logical game simulation space (480x270 classic 16:9 action framing)
export const WORLD_WIDTH = 480;
export const WORLD_HEIGHT = 270;

// Full-HD 1920x1080 Hi-Bit Pixel Buffer (4x resolution per axis = 16x pixel density)
export const PIXEL_SCALE = 4;
export const RENDER_WIDTH = WORLD_WIDTH * PIXEL_SCALE;
export const RENDER_HEIGHT = WORLD_HEIGHT * PIXEL_SCALE;

// 8x Sub-Pixel Precision Quantization (1/8 world unit = 0.5px on 1920x1080 buffer)
export const SUBPIXEL_SCALE = 8;

export function snapSubpixel(value: number): number {
  return Math.round(value * SUBPIXEL_SCALE) / SUBPIXEL_SCALE;
}

export function toRenderPx(worldCoord: number, camCoord = 0): number {
  return Math.round((worldCoord - camCoord) * SUBPIXEL_SCALE) * (PIXEL_SCALE / SUBPIXEL_SCALE);
}

export const GRAVITY = 940;
export const PLAYER_RUN_SPEED = 176;
export const PLAYER_JUMP_VY = -335;
export const PLAYER_DOUBLE_JUMP_VY = -308;
export const PLAYER_DASH_SPEED = 380;
export const PLAYER_DASH_DURATION = 0.14;
export const WALL_SLIDE_MAX_VY = 72;
export const WALL_JUMP_VX = 205;
export const WALL_JUMP_VY = -315;

export const COYOTE_TIME_MAX = 0.11;
export const INPUT_BUFFER_MAX = 0.14;
export const COMBO_WINDOW_MAX = 0.52;

// Attack Speed Cadence: Base 0.5s per normal attack (`基础攻速改为0.5s一次`), reduced by `连袭` (`attackSpeedMult`)
export const BASE_ATTACK_INTERVAL = 0.5;

// Zanshin Sheathe Timing (`收到固定为攻击结束后1s收刀，时间窗口0.3s` + `激发后减半收刀时间，连续激发会连续减少`):
// Base 1.0s post-attack delay before sheathing, halved consecutively (`1.0s -> 0.5s -> 0.25s -> 0.125s...`) on each `星术` trigger!
export const ZANSHIN_SHEATHE_DELAY = 1.0;
export const ZANSHIN_GLINT_WINDOW = 0.3;

export function computeZanshinSheatheDelay(astraChainCount = 0): number {
  const chain = Math.max(0, Math.floor(astraChainCount));
  return Math.max(0.08, Number((ZANSHIN_SHEATHE_DELAY * Math.pow(0.5, chain)).toFixed(3)));
}

export function computeAttackInterval(attackSpeedMult = 1): number {
  const safeMult = Math.max(0.25, attackSpeedMult);
  return Math.max(0.14, Number((BASE_ATTACK_INTERVAL / safeMult).toFixed(3)));
}

// Dash Stamina Natural Recovery (`同时闪避次数恢复速度改为5s/次`):
// Base 5.0s per dash charge (`0.20` charge/sec), scaled by `staminaRegenMult` upgrades.
export const BASE_DASH_REGEN_SECONDS = 5.0;
export const BASE_DASH_REGEN_PER_SEC = 1 / BASE_DASH_REGEN_SECONDS;

export function computeDashRegenPerSec(staminaRegenMult = 1): number {
  return BASE_DASH_REGEN_PER_SEC * Math.max(0.1, staminaRegenMult);
}

/**
 * Time Dilation (`同时星术，月魄都要有和赤刃类似的时间减慢和独立动作动画`):
 * - While performing `赤刃` (`MoonCounter`), `星术` (`AstralSlash`), or `月魄` (`HeavyCrescent`, `DimensionCut`, or aerial `L`),
 *   Aria steps at `1.0x` real-time while the rest of the world slows to `0.2x`!
 */
export function computeWorldTimeScale(
  currentMove: MoveId,
  witchTimeActive: boolean,
  lunarLActive = false
): { playerScale: number; worldScale: number } {
  if (
    currentMove === MoveId.MoonCounter ||
    currentMove === MoveId.AstralSlash ||
    currentMove === MoveId.HeavyCrescent ||
    currentMove === MoveId.DimensionCut ||
    lunarLActive
  ) {
    return { playerScale: 1.0, worldScale: 0.2 };
  }
  if (witchTimeActive) {
    return { playerScale: 1.05, worldScale: 0.26 };
  }
  return { playerScale: 1.0, worldScale: 1.0 };
}

/**
 * Combat Room Lockdown (`未击杀当前房间所有敌人时关闭出口`):
 * Returns true whenever the room has not yet been cleared and still has active enemies.
 */
export function isRoomLockedByEnemies(roomCleared: boolean, activeEnemyCount: number): boolean {
  return !roomCleared && activeEnemyCount > 0;
}

/**
 * Builds physical solid iron portcullis barriers sealing every doorway/shaft exit while a room is in combat lockdown,
 * inset cleanly so incoming spawns never overlap the barrier while preventing exit triggers.
 */
export function buildLockedExitBarriers(
  exits: RoomExit[],
  roomWidth: number,
  roomHeight: number
): PlatformRect[] {
  return exits.map((ex) => {
    if (ex.direction === 'left') {
      return { x: 0, y: ex.y, w: Math.max(22, ex.w + 6), h: ex.h };
    }
    if (ex.direction === 'right') {
      const w = Math.max(22, ex.w + 6);
      return { x: roomWidth - w, y: ex.y, w, h: ex.h };
    }
    if (ex.direction === 'up') {
      return { x: ex.x, y: 0, w: ex.w, h: Math.max(24, ex.h + 4) };
    }
    return { x: ex.x, y: roomHeight - 32, w: ex.w, h: 32 };
  });
}

export const MOVES: Record<MoveId, MoveSpec> = {
  [MoveId.None]: {
    id: MoveId.None,
    nameZh: '',
    windup: 0,
    active: 0,
    recovery: 0,
    damage: 0,
    reachX: 0,
    reachY: 0,
    offsetY: 0,
    knockbackX: 0,
    knockbackY: 0,
    selfVx: 0,
    selfVy: 0,
    hitstop: 0,
    heavyBreak: false,
    energyGain: 0,
    energyCost: 0,
    slashStyle: 'arc_down',
    slashColor: 'silver',
  },
  [MoveId.Slash1]: {
    id: MoveId.Slash1,
    nameZh: '一式 · 朔月拔刀',
    windup: 0.042,
    active: 0.088,
    recovery: 0.105,
    damage: 16,
    reachX: 54,
    reachY: 32,
    offsetY: -18,
    knockbackX: 85,
    knockbackY: -25,
    selfVx: 90,
    selfVy: 0,
    hitstop: 0.036,
    heavyBreak: false,
    energyGain: 9,
    energyCost: 0,
    slashStyle: 'arc_down',
    slashColor: 'silver',
  },
  [MoveId.Slash2]: {
    id: MoveId.Slash2,
    nameZh: '二式 · 银弧逆斩',
    windup: 0.04,
    active: 0.09,
    recovery: 0.11,
    damage: 20,
    reachX: 58,
    reachY: 36,
    offsetY: -20,
    knockbackX: 100,
    knockbackY: -35,
    selfVx: 105,
    selfVy: 0,
    hitstop: 0.04,
    heavyBreak: false,
    energyGain: 10,
    energyCost: 0,
    slashStyle: 'arc_up',
    slashColor: 'cyan',
  },
  [MoveId.Slash3]: {
    id: MoveId.Slash3,
    nameZh: '三式 · 残月旋斩',
    windup: 0.052,
    active: 0.105,
    recovery: 0.125,
    damage: 26,
    reachX: 64,
    reachY: 40,
    offsetY: -20,
    knockbackX: 130,
    knockbackY: -55,
    selfVx: 130,
    selfVy: 0,
    hitstop: 0.048,
    heavyBreak: false,
    energyGain: 12,
    energyCost: 0,
    slashStyle: 'spin',
    slashColor: 'cyan',
  },
  [MoveId.Slash4]: {
    id: MoveId.Slash4,
    nameZh: '终式 · 苍月断空',
    windup: 0.072,
    active: 0.125,
    recovery: 0.175,
    damage: 42,
    reachX: 78,
    reachY: 46,
    offsetY: -22,
    knockbackX: 235,
    knockbackY: -120,
    selfVx: 175,
    selfVy: 0,
    hitstop: 0.075,
    heavyBreak: true,
    energyGain: 18,
    energyCost: 0,
    slashStyle: 'wide_cleave',
    slashColor: 'violet',
  },
  [MoveId.SlideSlash]: {
    id: MoveId.SlideSlash,
    nameZh: '掠地 · 滑铲居合',
    windup: 0.036,
    active: 0.125,
    recovery: 0.115,
    damage: 24,
    reachX: 66,
    reachY: 24,
    offsetY: -10,
    knockbackX: 125,
    knockbackY: -145,
    selfVx: 275,
    selfVy: 0,
    hitstop: 0.048,
    heavyBreak: true,
    energyGain: 13,
    energyCost: 0,
    slashStyle: 'slide',
    slashColor: 'cyan',
  },
  [MoveId.RisingMoon]: {
    id: MoveId.RisingMoon,
    nameZh: '升月 · 挑空裂斩',
    windup: 0.048,
    active: 0.115,
    recovery: 0.13,
    damage: 27,
    reachX: 54,
    reachY: 56,
    offsetY: -28,
    knockbackX: 68,
    knockbackY: -295,
    selfVx: 55,
    selfVy: -290,
    hitstop: 0.056,
    heavyBreak: true,
    energyGain: 14,
    energyCost: 0,
    slashStyle: 'uppercut',
    slashColor: 'cyan',
  },
  [MoveId.DashThrust]: {
    id: MoveId.DashThrust,
    nameZh: '疾影 · 瞬步突刺',
    windup: 0.035,
    active: 0.105,
    recovery: 0.115,
    damage: 29,
    reachX: 76,
    reachY: 28,
    offsetY: -18,
    knockbackX: 195,
    knockbackY: -55,
    selfVx: 260,
    selfVy: 0,
    hitstop: 0.054,
    heavyBreak: true,
    energyGain: 15,
    energyCost: 0,
    slashStyle: 'thrust',
    slashColor: 'cyan',
  },
  [MoveId.AirSlash1]: {
    id: MoveId.AirSlash1,
    nameZh: '空式 · 飞燕斩',
    windup: 0.038,
    active: 0.088,
    recovery: 0.095,
    damage: 19,
    reachX: 56,
    reachY: 40,
    offsetY: -20,
    knockbackX: 78,
    knockbackY: -125,
    selfVx: 52,
    selfVy: -105,
    hitstop: 0.038,
    heavyBreak: false,
    energyGain: 10,
    energyCost: 0,
    slashStyle: 'arc_up',
    slashColor: 'silver',
  },
  [MoveId.AirSlash2]: {
    id: MoveId.AirSlash2,
    nameZh: '空二式 · 旋月轮',
    windup: 0.042,
    active: 0.1,
    recovery: 0.11,
    damage: 25,
    reachX: 62,
    reachY: 44,
    offsetY: -20,
    knockbackX: 105,
    knockbackY: -140,
    selfVx: 64,
    selfVy: -120,
    hitstop: 0.046,
    heavyBreak: false,
    energyGain: 12,
    energyCost: 0,
    slashStyle: 'spin',
    slashColor: 'cyan',
  },
  [MoveId.HelmSplitter]: {
    id: MoveId.HelmSplitter,
    nameZh: '坠星 · 裂地斩',
    windup: 0.052,
    active: 0.22,
    recovery: 0.16,
    damage: 38,
    reachX: 62,
    reachY: 54,
    offsetY: -10,
    knockbackX: 190,
    knockbackY: -165,
    selfVx: 75,
    selfVy: 410,
    hitstop: 0.072,
    heavyBreak: true,
    energyGain: 16,
    energyCost: 0,
    slashStyle: 'plunge',
    slashColor: 'violet',
  },
  [MoveId.HeavyCrescent]: {
    id: MoveId.HeavyCrescent,
    nameZh: '月魄 · 朔月重斩',
    windup: 0.22,
    active: 0.34,
    recovery: 0.36,
    damage: 56,
    reachX: 84,
    reachY: 50,
    offsetY: -21,
    knockbackX: 235,
    knockbackY: -120,
    selfVx: 155,
    selfVy: 0,
    hitstop: 0.075,
    heavyBreak: true,
    energyGain: 16,
    energyCost: 0,
    slashStyle: 'wide_cleave',
    slashColor: 'violet',
  },
  [MoveId.DimensionCut]: {
    id: MoveId.DimensionCut,
    nameZh: '月魄 · 次元绝斩',
    windup: 0.24,
    active: 0.38,
    recovery: 0.38,
    damage: 96,
    reachX: 144,
    reachY: 74,
    offsetY: -24,
    knockbackX: 275,
    knockbackY: -180,
    selfVx: 205,
    selfVy: 0,
    hitstop: 0.098,
    heavyBreak: true,
    energyGain: 0,
    energyCost: 50,
    slashStyle: 'dimension',
    slashColor: 'violet',
  },
  [MoveId.MoonCounter]: {
    id: MoveId.MoonCounter,
    nameZh: '赤刃 · 刹那血闪',
    windup: 0.36,
    active: 0.54,
    recovery: 0.60,
    damage: 118,
    reachX: 112,
    reachY: 56,
    offsetY: -20,
    knockbackX: 280,
    knockbackY: -165,
    selfVx: 290,
    selfVy: 0,
    hitstop: 0.11,
    heavyBreak: true,
    energyGain: 32,
    energyCost: 0,
    slashStyle: 'counter',
    slashColor: 'crimson',
  },
  [MoveId.AstralSlash]: {
    id: MoveId.AstralSlash,
    nameZh: '星术 · 星芒绝斩',
    windup: 0.22,
    active: 0.36,
    recovery: 0.38,
    damage: 62,
    reachX: 98,
    reachY: 48,
    offsetY: -20,
    knockbackX: 210,
    knockbackY: -135,
    selfVx: 48,
    selfVy: 0,
    hitstop: 0.082,
    heavyBreak: true,
    energyGain: 18,
    energyCost: 0,
    slashStyle: 'astral_wave',
    slashColor: 'cyan',
  },
};

const COMBO_STAGE_MOVES: readonly [MoveId, MoveId, MoveId, MoveId] = [
  MoveId.Slash1,
  MoveId.Slash2,
  MoveId.Slash3,
  MoveId.Slash4,
];

export function getMoveTotalDuration(moveId: MoveId): number {
  const m = MOVES[moveId];
  return m.windup + m.active + m.recovery;
}

export function getMovePhase(
  moveId: MoveId,
  elapsed: number
): 'none' | 'windup' | 'active' | 'recovery' | 'done' {
  if (moveId === MoveId.None) return 'none';
  const m = MOVES[moveId];
  if (elapsed < m.windup) return 'windup';
  if (elapsed < m.windup + m.active) return 'active';
  if (elapsed < m.windup + m.active + m.recovery) return 'recovery';
  return 'done';
}

export function isLKeySkillMove(moveId: MoveId, triggeredByHeavyButton = false): boolean {
  if (moveId === MoveId.HeavyCrescent || moveId === MoveId.DimensionCut) return true;
  if (moveId === MoveId.HelmSplitter && triggeredByHeavyButton) return true;
  return false;
}

/**
 * Persistent Combo Stage Retention (`没有使用L或者被攻击则维持攻击段数`):
 * - Ground combo stage advances `0 (一式) -> 1 (二式) -> 2 (三式) -> 3 (终式) -> 0` on normal ground slashes.
 * - Running, jumping, dashing, waiting (`1.2s` attack interval or longer), or using aerial/counter moves
 *   NEVER resets the combo stage!
 * - Resets to `0` ONLY when the player uses an `L`-key skill (`usedLSkill`) OR takes damage (`tookDamage`).
 */
export function advanceComboStage(
  currentStage: 0 | 1 | 2 | 3,
  executedMove: MoveId,
  options?: { tookDamage?: boolean; usedLSkill?: boolean }
): 0 | 1 | 2 | 3 {
  if (options?.tookDamage || options?.usedLSkill) {
    return 0;
  }
  if (executedMove === MoveId.HeavyCrescent || executedMove === MoveId.DimensionCut) {
    return 0;
  }
  if (executedMove === MoveId.Slash1 || executedMove === MoveId.SlideSlash) {
    return 1;
  }
  if (executedMove === MoveId.Slash2) {
    return 2;
  }
  if (executedMove === MoveId.Slash3) {
    return 3;
  }
  if (executedMove === MoveId.Slash4) {
    return 0;
  }
  return currentStage;
}

export interface AttackInputContext {
  button: 'light' | 'heavy';
  grounded: boolean;
  holdUp: boolean;
  holdDown: boolean;
  currentMove: MoveId;
  comboWindowOpen: boolean;
  airComboCount: number;
  dashAfterAttackOpen: boolean;
  perfectDodgeWindowOpen: boolean;
  zanshinGlintOpen?: boolean;
  bladeEnergy: number;
  dimensionCutCost?: number;
  savedComboStage?: 0 | 1 | 2 | 3;
  holdingAttack?: boolean;
}

export function resolveNextAttackMove(input: AttackInputContext): MoveId | null {
  const ultCost = input.dimensionCutCost ?? MOVES[MoveId.DimensionCut].energyCost;

  // Heavy / Ultimate Button (L) — 100% Exclusive to `月魄` (`L键完全属于月魄的`)
  if (input.button === 'heavy') {
    if (input.bladeEnergy >= ultCost) {
      return MoveId.DimensionCut;
    }
    if (!input.grounded) {
      return MoveId.HelmSplitter;
    }
    return MoveId.HeavyCrescent;
  }

  // 赤刃 (`Brutality`): Perfect Dodge + Hold/Press J -> Immediate Crimson Blade Slash (`赤刃 · 刹那血闪`)
  if (input.perfectDodgeWindowOpen) {
    return MoveId.MoonCounter;
  }

  // 星术 (`Tactics`): Sheathe Glint Window + Hold J -> Ranged Astral Slash (`星术 · 星芒绝斩`)
  if (input.zanshinGlintOpen && input.holdingAttack) {
    return MoveId.AstralSlash;
  }

  // Dash + J -> Dash Thrust (`疾影·瞬步突刺`)
  if (input.dashAfterAttackOpen && input.grounded && !input.holdDown && !input.holdUp) {
    return MoveId.DashThrust;
  }

  // Airborne J / S+J
  if (!input.grounded) {
    if (input.holdDown) {
      return MoveId.HelmSplitter;
    }
    if (input.currentMove === MoveId.AirSlash1 && input.comboWindowOpen) {
      return MoveId.AirSlash2;
    }
    if (input.airComboCount === 0) {
      return MoveId.AirSlash1;
    }
    if (input.airComboCount === 1) {
      return MoveId.AirSlash2;
    }
    return MoveId.HelmSplitter;
  }

  // Grounded W + J -> Rising Moon Uppercut Launcher
  if (input.holdUp) {
    return MoveId.RisingMoon;
  }

  // Grounded S + J -> Low Slide Iaido Slash (chains into Slash2)
  if (input.holdDown && input.currentMove === MoveId.None) {
    return MoveId.SlideSlash;
  }

  // Persistent Combo Stage Retention (`没有使用L或者被攻击则维持攻击段数`):
  // When `savedComboStage` is provided, the player continues from their retained combo stage
  // even after the 1.2s attack cadence interval, movement, jumping, or dashing!
  if (input.savedComboStage !== undefined) {
    if (input.currentMove === MoveId.SlideSlash) {
      return MoveId.Slash2;
    }
    const stageIdx = ((input.savedComboStage % 4) + 4) % 4;
    return COMBO_STAGE_MOVES[stageIdx];
  }

  // Legacy fallback when `savedComboStage` is omitted in older unit tests
  if (input.comboWindowOpen) {
    if (input.currentMove === MoveId.Slash1 || input.currentMove === MoveId.SlideSlash) {
      return MoveId.Slash2;
    }
    if (input.currentMove === MoveId.Slash2) {
      return MoveId.Slash3;
    }
    if (input.currentMove === MoveId.Slash3) {
      return MoveId.Slash4;
    }
  }

  return MoveId.Slash1;
}

export interface ThreatWindow {
  x: number;
  y: number;
  reach: number;
  remainingWindup: number;
  isActiveStrike: boolean;
}

export function checkPerfectDodge(
  playerX: number,
  playerY: number,
  threats: ThreatWindow[]
): boolean {
  for (const t of threats) {
    const dx = Math.abs(playerX - t.x);
    const dy = Math.abs(playerY - t.y);
    const inThreatZone = dx <= t.reach + 28 && dy <= 44;
    const timingValid = t.isActiveStrike || (t.remainingWindup > 0 && t.remainingWindup <= 0.34);
    if (inThreatZone && timingValid) {
      return true;
    }
  }
  return false;
}

/**
 * Pixel-Exact K-Dash Perfect Dodge (`K键闪避也必须穿过特效像素才能视为完美闪避`):
 * Triggers Perfect Dodge (`月影刹那`) if and only if Aria is actively dashing, has not yet
 * triggered Perfect Dodge during this dash, and her swept dash hurtbox overlaps >= 1 plotted
 * hostile VFX pixel.
 */
export function canTriggerPixelPerfectDodge(
  isDashing: boolean,
  dashPerfectAlreadyTriggered: boolean,
  overlapsHostileVfxPixels: boolean
): boolean {
  return isDashing && !dashPerfectAlreadyTriggered && overlapsHostileVfxPixels;
}

export function shouldShieldBlockHit(
  enemyShieldActive: boolean,
  enemyFacing: 1 | -1,
  enemyX: number,
  playerX: number,
  move: MoveSpec,
  pierceShields = false
): boolean {
  if (!enemyShieldActive) return false;
  if (move.heavyBreak || pierceShields) return false;
  const attackingFromFront =
    (enemyFacing === 1 && playerX >= enemyX - 4) ||
    (enemyFacing === -1 && playerX <= enemyX + 4);
  return attackingFromFront;
}

export function canBreakSealBarrier(moveId: MoveId, ownedRelics: ReadonlySet<RelicId>): boolean {
  if (!ownedRelics.has(RelicId.AbyssalBreaker)) return false;
  return (
    moveId === MoveId.HeavyCrescent ||
    moveId === MoveId.DimensionCut ||
    moveId === MoveId.HelmSplitter ||
    moveId === MoveId.AstralSlash ||
    moveId === MoveId.MoonCounter
  );
}

export function computeEffectiveDamage(
  baseDamage: number,
  moveId: MoveId,
  ownedRelics: ReadonlySet<RelicId>,
  isBackstab: boolean,
  mods?: UpgradeModifiers,
  critRoll = 0.99,
  options?: {
    empoweredLActive?: boolean;
    crimsonFlashActive?: boolean;
  }
): { damage: number; critical: boolean } {
  let mult = 1.0;
  let critical = false;

  if (ownedRelics.has(RelicId.AbyssalBreaker)) {
    mult *= 1.15;
  }
  if (ownedRelics.has(RelicId.ZanshinTassel)) {
    mult *= 1.1;
  }

  // Combo stage index (1..4) for `连袭` (`comboStageDamageBonus`)
  const stageIndex =
    moveId === MoveId.Slash1
      ? 1
      : moveId === MoveId.Slash2
        ? 2
        : moveId === MoveId.Slash3
          ? 3
          : moveId === MoveId.Slash4
            ? 4
            : 0;

  const isLMove =
    moveId === MoveId.HeavyCrescent ||
    moveId === MoveId.DimensionCut ||
    moveId === MoveId.HelmSplitter;
  const isAstralMove = moveId === MoveId.AstralSlash || Boolean(options?.empoweredLActive);

  if (mods) {
    mult *= mods.globalDamageMult * mods.meleeDamageMult;
    if (isLMove) {
      mult *= mods.lSkillDamageMult;
    }
    if (stageIndex > 0 && mods.comboStageDamageBonus > 0) {
      mult *= 1 + stageIndex * mods.comboStageDamageBonus;
    }
    if (isAstralMove) {
      mult *= mods.zanshinLSkillMult;
    }
    if (moveId === MoveId.MoonCounter || options?.crimsonFlashActive) {
      mult *= mods.crimsonSlashMult;
    }
  }

  if (
    isBackstab ||
    moveId === MoveId.MoonCounter ||
    moveId === MoveId.AstralSlash ||
    moveId === MoveId.DimensionCut ||
    moveId === MoveId.Slash4 ||
    options?.empoweredLActive ||
    options?.crimsonFlashActive
  ) {
    mult *= 1.35 + (mods ? mods.bonusCritDamage : 0);
    critical = true;
  } else if (mods && mods.bonusCritChance > 0 && critRoll < mods.bonusCritChance) {
    mult *= 1.35 + mods.bonusCritDamage;
    critical = true;
  }

  return {
    damage: Math.round(baseDamage * mult),
    critical,
  };
}

export function calculateStyleGain(
  moveId: MoveId,
  recentMoves: MoveId[],
  comboCount: number
): number {
  const spec = MOVES[moveId];
  const base = Math.max(12, Math.round(spec.damage * 0.9));
  const repeatCount = recentMoves.filter((m) => m === moveId).length;
  const freshnessMultiplier =
    repeatCount === 0 ? 1.45 : repeatCount === 1 ? 1.0 : repeatCount === 2 ? 0.65 : 0.35;
  const comboBonus = 1 + Math.min(comboCount, 25) * 0.04;
  return Math.round(base * freshnessMultiplier * comboBonus);
}

export function computeStyleRank(stylePoints: number): StyleRank {
  if (stylePoints >= 520) return StyleRank.SSS;
  if (stylePoints >= 400) return StyleRank.SS;
  if (stylePoints >= 290) return StyleRank.S;
  if (stylePoints >= 195) return StyleRank.A;
  if (stylePoints >= 115) return StyleRank.B;
  if (stylePoints >= 50) return StyleRank.C;
  return StyleRank.D;
}

const RANK_ORDER: Record<StyleRank, number> = {
  [StyleRank.D]: 0,
  [StyleRank.C]: 1,
  [StyleRank.B]: 2,
  [StyleRank.A]: 3,
  [StyleRank.S]: 4,
  [StyleRank.SS]: 5,
  [StyleRank.SSS]: 6,
};

export function rankOrderValue(r: StyleRank): number {
  return RANK_ORDER[r] ?? 0;
}

export interface EnemyCombatProfile {
  nameZh: string;
  hp: number;
  shield: boolean;
  baseCooldownSec: number;
  moveSpeed: number;
  meleeDamage: number;
  projectileDamage: number;
  windupSec: number;
  activeSec: number;
  recoverySec: number;
  reachX: number;
}

/**
 * Strengthened Enemy & Boss Combat Profiles (`加强小怪和boss的动作，ai，和数值。目前难度太低`):
 * - Substantially higher vitality, faster pursuit speed, tighter attack cadence, and higher damage.
 */
export const ENEMY_COMBAT_STATS: Record<EnemyKind, EnemyCombatProfile> = {
  [EnemyKind.Stalker]: {
    nameZh: '影刃魔偶',
    hp: 118,
    shield: false,
    baseCooldownSec: 0.92,
    moveSpeed: 152,
    meleeDamage: 16,
    projectileDamage: 14,
    windupSec: 0.34,
    activeSec: 0.22,
    recoverySec: 0.3,
    reachX: 42,
  },
  [EnemyKind.Weaver]: {
    nameZh: '星蚀术士',
    hp: 96,
    shield: false,
    baseCooldownSec: 1.18,
    moveSpeed: 98,
    meleeDamage: 14,
    projectileDamage: 18,
    windupSec: 0.42,
    activeSec: 0.16,
    recoverySec: 0.32,
    reachX: 38,
  },
  [EnemyKind.Halberdier]: {
    nameZh: '重装铁卫',
    hp: 210,
    shield: true,
    baseCooldownSec: 1.15,
    moveSpeed: 92,
    meleeDamage: 24,
    projectileDamage: 18,
    windupSec: 0.48,
    activeSec: 0.24,
    recoverySec: 0.34,
    reachX: 54,
  },
  [EnemyKind.Reaper]: {
    nameZh: '冥火镰卫',
    hp: 168,
    shield: false,
    baseCooldownSec: 1.02,
    moveSpeed: 158,
    meleeDamage: 22,
    projectileDamage: 18,
    windupSec: 0.38,
    activeSec: 0.24,
    recoverySec: 0.3,
    reachX: 58,
  },
  [EnemyKind.Arbalist]: {
    nameZh: '绯焰弩手',
    hp: 108,
    shield: false,
    baseCooldownSec: 1.12,
    moveSpeed: 104,
    meleeDamage: 14,
    projectileDamage: 17,
    windupSec: 0.4,
    activeSec: 0.18,
    recoverySec: 0.28,
    reachX: 38,
  },
  [EnemyKind.Warden]: {
    nameZh: '深渊典狱官 · 戈尔贡',
    hp: 880,
    shield: false,
    baseCooldownSec: 0.88,
    moveSpeed: 136,
    meleeDamage: 28,
    projectileDamage: 22,
    windupSec: 0.44,
    activeSec: 0.28,
    recoverySec: 0.26,
    reachX: 68,
  },
  [EnemyKind.Archon]: {
    nameZh: '星穹大主教 · 奥菲斯',
    hp: 980,
    shield: false,
    baseCooldownSec: 0.84,
    moveSpeed: 128,
    meleeDamage: 25,
    projectileDamage: 20,
    windupSec: 0.4,
    activeSec: 0.22,
    recoverySec: 0.24,
    reachX: 58,
  },
  [EnemyKind.Sovereign]: {
    nameZh: '绯月女武神 · 瑟琳',
    hp: 1280,
    shield: false,
    baseCooldownSec: 0.76,
    moveSpeed: 164,
    meleeDamage: 32,
    projectileDamage: 24,
    windupSec: 0.38,
    activeSec: 0.26,
    recoverySec: 0.22,
    reachX: 68,
  },
};

/**
 * Poise / Super-Armor Rule (`霸体抗打断机制`):
 * - Bosses resist all non-heavyBreak stagger, and while in `Attack` or final release `Windup` (`<= 0.14s`) they cannot be interrupted even by heavyBreak!
 * - Elites (`eliteAffix !== null`), `Halberdier`, and `Reaper` resist non-heavyBreak stagger while in `Windup` or `Attack`.
 * - Any regular enemy that is already in `Attack` or late `Windup` (`stateTimer <= 0.22s`) resists light hitstun so players cannot brainlessly mash `J` to stunlock crowds!
 */
export function shouldEnemyResistHitstun(
  kind: EnemyKind,
  aiState: EnemyAIState,
  stateTimer: number,
  eliteAffix: EliteAffix | null | undefined,
  heavyBreakMove: boolean
): boolean {
  const isBoss =
    kind === EnemyKind.Warden || kind === EnemyKind.Archon || kind === EnemyKind.Sovereign;
  if (isBoss) {
    if (!heavyBreakMove) return true;
    if (aiState === EnemyAIState.Attack || (aiState === EnemyAIState.Windup && stateTimer <= 0.14)) {
      return true;
    }
    return false;
  }

  if (heavyBreakMove) {
    return false;
  }

  // Non-heavyBreak light slashes:
  if (eliteAffix || kind === EnemyKind.Halberdier || kind === EnemyKind.Reaper) {
    if (aiState === EnemyAIState.Windup || aiState === EnemyAIState.Attack) {
      return true;
    }
  }

  if (aiState === EnemyAIState.Attack || (aiState === EnemyAIState.Windup && stateTimer <= 0.22)) {
    return true;
  }

  return false;
}

