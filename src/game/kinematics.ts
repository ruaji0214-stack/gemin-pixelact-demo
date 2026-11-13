import { MOVES, getMovePhase } from './rules';
import { MoveId, MoveSpec, PlayerEntity } from './types';

/**
 * Pure Procedural Action Kinematics, Cancel Windows & Swordplay Pose Solver
 * Eliminates rigid step-function stances by computing continuous, eased martial poses,
 * 2-joint leg/arm articulation, whip-curved blade sweeps, and responsive action cancels.
 */

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 2-Stage Dead Cells whip + continuous overswing: snaps >88% by u=0.38 AND keeps sweeping smoothly through u=1.00! */
export function easeWhipOut(t: number): number {
  const u = clamp01(t);
  return 0.87 * (1 - Math.pow(1 - u, 6.8)) + 0.13 * u;
}

export function easeOutCubic(t: number): number {
  const u = clamp01(t);
  const inv = 1 - u;
  return 1 - inv * inv * inv;
}

export function easeInOutSine(t: number): number {
  const u = clamp01(t);
  return -(Math.cos(Math.PI * u) - 1) * 0.5;
}

/**
 * Responsive Action-Cancel Evaluators:
 * 1. Hit-confirmed late-active combo cancel (eliminates dropped J inputs during fast mashing)
 * 2. Early movement/run cancel out of recovery (eliminates "feet glued in mud" after swinging)
 * 3. Dash-Jump momentum carry (K -> W wave-dash traversal & spacing)
 * 4. Aerial momentum preservation + midair directional drift during air combos
 */
export function canChainNextAttack(
  moveId: MoveId,
  elapsed: number,
  hitConfirmed: boolean
): boolean {
  if (moveId === MoveId.None) return true;
  const phase = getMovePhase(moveId, elapsed);
  if (phase === 'recovery' || phase === 'done') return true;
  if (phase === 'active' && hitConfirmed) {
    const spec = MOVES[moveId];
    const activeProgress = (elapsed - spec.windup) / Math.max(0.001, spec.active);
    return activeProgress >= 0.38;
  }
  return false;
}

export function canMoveCancelRecovery(moveId: MoveId, elapsed: number): boolean {
  if (moveId === MoveId.None) return true;
  const spec = MOVES[moveId];
  const phase = getMovePhase(moveId, elapsed);
  if (phase === 'done') return true;
  if (phase !== 'recovery') return false;
  const recProgress = (elapsed - spec.windup - spec.active) / Math.max(0.001, spec.recovery);
  // Allow crisp walk/run cancel after first 28% of follow-through!
  return recProgress >= 0.28;
}

export function computeDashJumpVelocity(
  facing: 1 | -1,
  moveDir: number,
  dashSpeed: number,
  baseJumpVy: number
): { vx: number; vy: number; launchDir: 1 | -1 } {
  const launchDir: 1 | -1 = moveDir > 0 ? 1 : moveDir < 0 ? -1 : facing;
  return {
    vx: launchDir * Math.round(dashSpeed * 0.68), // ~258 px/s momentum carry!
    vy: Math.round(baseJumpVy * 0.97),
    launchDir,
  };
}

export function computeAttackImpulseVx(
  grounded: boolean,
  currentVx: number,
  facing: 1 | -1,
  moveDir: number,
  spec: MoveSpec
): number {
  if (grounded) {
    // Grounded lunge: add slight extra reach if player is actively holding forward!
    const forwardBoost = moveDir === facing ? 22 : 0;
    return facing * (spec.selfVx + forwardBoost);
  }
  // Airborne attack: NEVER kill existing forward jump/dash-jump momentum!
  const forwardSpeed = currentVx * facing;
  const carried = Math.max(forwardSpeed * 0.92, spec.selfVx);
  const driftBias = moveDir * 24;
  return facing * carried + driftBias;
}

export interface LimbJoints {
  hipX: number;
  hipY: number;
  kneeX: number;
  kneeY: number;
  footX: number;
  footY: number;
}

export interface AriaProceduralPose {
  facing: 1 | -1;
  squashX: number;
  squashY: number;
  torsoLeanX: number;
  torsoDropY: number;
  headNodY: number;
  chestTwist: number; // -1..1 (0 = side/3-quarter, -1 = back-turned spin, +1 = open chest cleave)
  somersaultAngle: number | null; // Non-null during tucked midair flip!

  // 2-Joint Articulated Front & Back Legs (relative to feet origin px, py)
  backLeg: LimbJoints;
  frontLeg: LimbJoints;

  // Articulated Sword Arm & Continuous Sweeping Katana
  shoulderX: number;
  shoulderY: number;
  elbowX: number;
  elbowY: number;
  handX: number;
  handY: number;
  bladeAngle: number;
  prevBladeAngle: number;
  bladeLen: number;
  smearIntensity: number; // 0..1 attached blade motion-blur fan!
  smearColor: 'silver' | 'cyan' | 'violet' | 'crimson';
  offhandX: number;
  offhandY: number;
}

interface SwingArcDef {
  coilAngle: number;
  startAngle: number;
  endAngle: number;
  coilLeanX: number;
  lungeLeanX: number;
  lungeDropY: number;
  stanceSpread: number;
  twistStart: number;
  twistEnd: number;
}

// Local right-facing angles (0 = +X right, -PI/2 = up, +PI/2 = down, PI = back-left)
// Every single one of the 13 combat moves has its own unmistakable trajectory calibrated to its dedicated keyframes!
const SWING_ARCS: Partial<Record<MoveId, SwingArcDef>> = {
  [MoveId.Slash1]: {
    coilAngle: -1.72, // High right-shoulder raise (slash12[0])
    startAngle: -1.58,
    endAngle: 0.78, // Deep diagonal-downward slash (slash12[1])
    coilLeanX: -2.5,
    lungeLeanX: 5.5,
    lungeDropY: 3.5,
    stanceSpread: 7.0,
    twistStart: -0.35,
    twistEnd: 0.6,
  },
  [MoveId.Slash2]: {
    coilAngle: 2.35, // Low cross-body left-hip coil (slash12[2])
    startAngle: 1.72,
    endAngle: -0.68, // High rising reverse slash (combo[1] -> slash12[3])
    coilLeanX: -2.0,
    lungeLeanX: 5.5,
    lungeDropY: 2.2,
    stanceSpread: 7.2,
    twistStart: 0.65,
    twistEnd: -0.5,
  },
  [MoveId.Slash3]: {
    coilAngle: -2.92,
    startAngle: -2.78,
    endAngle: 0.05, // Full 360° pirouette cleave (spinCleave[0] -> combo[2])
    coilLeanX: -3.2,
    lungeLeanX: 6.2,
    lungeDropY: 3.5,
    stanceSpread: 7.8,
    twistStart: -0.95,
    twistEnd: 0.95,
  },
  [MoveId.Slash4]: {
    coilAngle: -2.36, // Overhead two-handed raise (heavy[1])
    startAngle: -2.18,
    endAngle: 0.18, // Explosive horizontal chest-level cleave lunge (spinCleave[1] -> combo[3])
    coilLeanX: -4.2,
    lungeLeanX: 7.8,
    lungeDropY: 5.2,
    stanceSpread: 9.2,
    twistStart: -0.6,
    twistEnd: 0.85,
  },
  [MoveId.SlideSlash]: {
    coilAngle: 2.68,
    startAngle: 0.42,
    endAngle: -0.06, // Ground-skimming low iaido sweep (special[0])
    coilLeanX: 3.2,
    lungeLeanX: 7.8,
    lungeDropY: 9.5,
    stanceSpread: 9.6,
    twistStart: 0.3,
    twistEnd: 0.75,
  },
  [MoveId.RisingMoon]: {
    coilAngle: 2.15,
    startAngle: 1.48,
    endAngle: -1.48, // Skyward vertical uppercut launcher (special[1])
    coilLeanX: -2.2,
    lungeLeanX: 3.6,
    lungeDropY: -2.2,
    stanceSpread: 5.5,
    twistStart: 0.45,
    twistEnd: -0.55,
  },
  [MoveId.DashThrust]: {
    coilAngle: 2.82, // Aerodynamic trailing dash blade
    startAngle: 0.32,
    endAngle: -0.01, // Pinpoint straight fencer thrust (special[2])
    coilLeanX: -3.0,
    lungeLeanX: 8.5,
    lungeDropY: 4.8,
    stanceSpread: 9.2,
    twistStart: -0.4,
    twistEnd: 0.82,
  },
  [MoveId.AirSlash1]: {
    coilAngle: -2.42, // Airborne high back-shoulder coil (aerialPlunge[0])
    startAngle: -2.12,
    endAngle: -0.44, // Wide airborne forward-upward arc (aerialPlunge[1])
    coilLeanX: -1.8,
    lungeLeanX: 4.2,
    lungeDropY: 0,
    stanceSpread: 5.2,
    twistStart: -0.45,
    twistEnd: 0.5,
  },
  [MoveId.AirSlash2]: {
    coilAngle: 2.45, // Inverted midair somersault windup
    startAngle: 2.15,
    endAngle: -0.28, // Acrobatic somersault flip-slash (aerialPlunge[2])
    coilLeanX: -2.2,
    lungeLeanX: 4.8,
    lungeDropY: 0.5,
    stanceSpread: 5.8,
    twistStart: 0.9,
    twistEnd: -0.9,
  },
  [MoveId.HelmSplitter]: {
    coilAngle: -1.56, // Raised overhead plunge (special[1])
    startAngle: -1.52,
    endAngle: 1.24, // Crushing vertical dive into kneeling ground slam (special[3] -> aerialPlunge[3])
    coilLeanX: -2.0,
    lungeLeanX: 5.8,
    lungeDropY: 4.5,
    stanceSpread: 6.8,
    twistStart: -0.5,
    twistEnd: 0.8,
  },
  [MoveId.HeavyCrescent]: {
    coilAngle: -2.48, // Extreme arched two-handed guillotine windup (spinCleave[2])
    startAngle: -2.40,
    endAngle: 0.96, // Crushing downward ground-splitting guillotine slam (spinCleave[3]) — distinct from Slash4!
    coilLeanX: -4.6,
    lungeLeanX: 7.4,
    lungeDropY: 6.4,
    stanceSpread: 8.8,
    twistStart: -0.65,
    twistEnd: 0.9,
  },
  [MoveId.DimensionCut]: {
    coilAngle: 2.54, // Deep crouched battojutsu hip draw (crouch[1] / iaido)
    startAngle: 2.28,
    endAngle: -0.56, // Wide sweeping cross-body battojutsu finish (iaidoCounter[1])
    coilLeanX: -4.8,
    lungeLeanX: 8.4,
    lungeDropY: 5.6,
    stanceSpread: 9.8,
    twistStart: -0.75,
    twistEnd: 0.92,
  },
  [MoveId.MoonCounter]: {
    coilAngle: -1.35, // Vertical face-guard parry block (iaidoCounter[2]) — distinct from DashThrust!
    startAngle: -1.24,
    endAngle: -0.14, // Whipping horizontal shoulder-height counter-riposte (iaidoCounter[3])
    coilLeanX: -3.6,
    lungeLeanX: 8.2,
    lungeDropY: 3.8,
    stanceSpread: 9.0,
    twistStart: -0.55,
    twistEnd: 0.88,
  },
  [MoveId.AstralSlash]: {
    coilAngle: 2.48, // Starlight iaido sheathe coil at hip
    startAngle: 2.18,
    endAngle: -0.34, // Wide ranged astral wave projection sweep
    coilLeanX: -3.8,
    lungeLeanX: 7.6,
    lungeDropY: 3.6,
    stanceSpread: 8.8,
    twistStart: -0.62,
    twistEnd: 0.9,
  },
};

function mirrorAngle(localRightAngle: number, facing: 1 | -1): number {
  if (facing === 1) return localRightAngle;
  return Math.PI - localRightAngle;
}

export function computeAriaPose(player: PlayerEntity, time: number): AriaProceduralPose {
  const isWallSliding = !player.grounded && player.wallSlideSide !== 0 && player.vy > 0;
  const f: 1 | -1 = isWallSliding ? (player.wallSlideSide === 1 ? -1 : 1) : player.facing;

  let squashX = player.scaleX;
  let squashY = player.scaleY;
  let torsoLeanX = 0;
  let torsoDropY = 0;
  let headNodY = 0;
  let chestTwist = 0.25;
  let somersaultAngle: number | null = null;

  // Default neutral guard sword orientation (iaido low-back guard)
  let localBladeAngle = 2.56;
  let localPrevBladeAngle = 2.56;
  let bladeLen = 25;
  let smearIntensity = 0;
  let smearColor: AriaProceduralPose['smearColor'] = 'silver';
  let armReachX = 2.5;
  let armReachY = -18;

  const speed = Math.abs(player.vx);
  const speedRatio = clamp01(speed / 176);

  // Leg defaults (relative to player.x, player.y)
  let backLeg: LimbJoints = { hipX: -2 * f, hipY: -12, kneeX: -3 * f, kneeY: -6, footX: -3.5 * f, footY: 0 };
  let frontLeg: LimbJoints = { hipX: 1.5 * f, hipY: -12, kneeX: 2.5 * f, kneeY: -6, footX: 2.5 * f, footY: 0 };

  if (player.moveId !== MoveId.None) {
    const spec = MOVES[player.moveId];
    const arc = SWING_ARCS[player.moveId] ?? SWING_ARCS[MoveId.Slash1]!;
    const phase = getMovePhase(player.moveId, player.moveTimer);
    bladeLen = player.moveId === MoveId.DimensionCut ? 34 : spec.heavyBreak ? 29 : 27;
    smearColor = spec.slashColor;

    if (phase === 'windup') {
      const u = easeOutCubic(player.moveTimer / Math.max(0.001, spec.windup));
      torsoLeanX = lerp(0, arc.coilLeanX, u) * f;
      torsoDropY = lerp(0, 2.6, u);
      headNodY = 1;
      chestTwist = lerp(0.2, arc.twistStart, u);
      squashX *= lerp(1, 1.08, u);
      squashY *= lerp(1, 0.93, u);

      localBladeAngle = lerp(2.5, arc.coilAngle, u);
      localPrevBladeAngle = localBladeAngle;
      armReachX = lerp(2, -3.5, u);
      armReachY = lerp(-18, -21, u);

      // Coiled back-weighted stance
      backLeg = { hipX: -2.5 * f, hipY: -11, kneeX: -5 * f, kneeY: -6, footX: -5.5 * f, footY: 0 };
      frontLeg = { hipX: 1.5 * f, hipY: -11, kneeX: 3.5 * f, kneeY: -7, footX: 3 * f, footY: -1 };
    } else if (phase === 'active') {
      const rawT = (player.moveTimer - spec.windup) / Math.max(0.001, spec.active);
      const u = easeWhipOut(rawT);
      const uTrail = clamp01(easeWhipOut(Math.max(0, rawT - 0.22)) * 0.9);

      torsoLeanX = lerp(arc.coilLeanX, arc.lungeLeanX, u) * f;
      torsoDropY = lerp(2.0, arc.lungeDropY, u);
      headNodY = spec.slashStyle === 'uppercut' ? -1.5 : 1.5;

      if (player.moveId === MoveId.Slash3 || player.moveId === MoveId.AirSlash2) {
        // Genuine 360° pirouette body twist!
        chestTwist = Math.cos(rawT * Math.PI * 2);
      } else {
        chestTwist = lerp(arc.twistStart, arc.twistEnd, u);
      }

      squashX *= spec.slashStyle === 'uppercut' ? 0.92 : 1.1;
      squashY *= spec.slashStyle === 'uppercut' ? 1.1 : 0.92;

      localBladeAngle = lerp(arc.startAngle, arc.endAngle, u);
      localPrevBladeAngle = lerp(arc.startAngle, arc.endAngle, uTrail);
      smearIntensity =
        player.moveId === MoveId.MoonCounter ||
        player.moveId === MoveId.AstralSlash ||
        player.moveId === MoveId.HeavyCrescent ||
        player.moveId === MoveId.DimensionCut
          ? 1.0
          : clamp01(1.18 - rawT * 0.58);

      const isThrust =
        spec.slashStyle === 'thrust' || spec.slashStyle === 'counter' || spec.slashStyle === 'slide';
      armReachX = isThrust ? lerp(2, 8.5, u) : lerp(-1, 6.0, u);
      armReachY =
        spec.slashStyle === 'slide'
          ? -10
          : spec.slashStyle === 'uppercut'
            ? lerp(-15, -25, u)
            : lerp(-20, -16, u);

      if (player.moveId === MoveId.SlideSlash) {
        // Low ground-hugging baseball/iaido slide!
        backLeg = { hipX: -2 * f, hipY: -6, kneeX: -6 * f, kneeY: -3, footX: -9 * f, footY: -1 };
        frontLeg = { hipX: 3 * f, hipY: -5, kneeX: 8 * f, kneeY: -3, footX: 12 * f, footY: -1 };
      } else if (!player.grounded) {
        // Dynamic airborne slash tuck!
        backLeg = { hipX: -2 * f, hipY: -13, kneeX: -5.5 * f, kneeY: -8, footX: -4 * f, footY: -3 };
        frontLeg = { hipX: 2 * f, hipY: -13, kneeX: 5.5 * f, kneeY: -10, footX: 4 * f, footY: -4 };
      } else {
        // Wide deep martial lunge!
        const sp = arc.stanceSpread;
        backLeg = {
          hipX: -2 * f,
          hipY: -11 + torsoDropY * 0.4,
          kneeX: (-sp * 0.6) * f,
          kneeY: -5,
          footX: -sp * f,
          footY: 0,
        };
        frontLeg = {
          hipX: 2.5 * f,
          hipY: -11 + torsoDropY * 0.4,
          kneeX: (sp * 0.92) * f,
          kneeY: -6,
          footX: (sp * 0.85) * f,
          footY: 0,
        };
      }
    } else {
      // Smooth Eased Follow-Through -> Guard Settle (eliminates 1-frame snap!)
      const rawR =
        (player.moveTimer - spec.windup - spec.active) / Math.max(0.001, spec.recovery);
      const u = easeInOutSine(rawR);
      const endWrapped = ((arc.endAngle + Math.PI) % (Math.PI * 2)) - Math.PI;

      torsoLeanX = lerp(arc.lungeLeanX, 0.5, u) * f;
      torsoDropY = lerp(arc.lungeDropY, 0, u);
      chestTwist = lerp(arc.twistEnd, 0.25, u);

      localBladeAngle = lerp(endWrapped, 2.56, u);
      localPrevBladeAngle = localBladeAngle;
      smearIntensity = rawR < 0.25 ? (0.25 - rawR) * 1.4 : 0;
      armReachX = lerp(5.5, 2.5, u);
      armReachY = lerp(-16, -18, u);

      const sp = lerp(arc.stanceSpread, 3.0, u);
      backLeg = { hipX: -2 * f, hipY: -12, kneeX: (-sp * 0.55) * f, kneeY: -6, footX: -sp * f, footY: 0 };
      frontLeg = { hipX: 2 * f, hipY: -12, kneeX: (sp * 0.8) * f, kneeY: -6, footX: (sp * 0.75) * f, footY: 0 };
    }
  } else if (player.isDashing) {
    // Phantom Dash: aerodynamic horizontal sprint-glide!
    torsoLeanX = 6.5 * f;
    torsoDropY = 3.5;
    headNodY = 1.5;
    squashX *= 1.14;
    squashY *= 0.88;
    localBladeAngle = 2.96;
    localPrevBladeAngle = 2.96;
    armReachX = -2;
    armReachY = -16;
    backLeg = { hipX: -2 * f, hipY: -10, kneeX: -7 * f, kneeY: -6, footX: -11 * f, footY: -3 };
    frontLeg = { hipX: 2 * f, hipY: -10, kneeX: 6.5 * f, kneeY: -7, footX: 4 * f, footY: -2 };
  } else if (isWallSliding) {
    // Wall-Slide: braced knee against stone wall, hand trailing sparks, looking outward!
    const wallDir = player.wallSlideSide; // +1 wall on right, -1 wall on left
    torsoLeanX = wallDir * 1.5;
    torsoDropY = 1;
    localBladeAngle = 2.35;
    localPrevBladeAngle = 2.35;
    backLeg = { hipX: wallDir * 2, hipY: -13, kneeX: wallDir * 5, kneeY: -9, footX: wallDir * 5, footY: -4 };
    frontLeg = { hipX: -wallDir * 1, hipY: -12, kneeX: wallDir * 2, kneeY: -5, footX: wallDir * 4, footY: 1 };
  } else if (!player.grounded) {
    // Airborne Jump Rise / Somersault Flip / Apex / Fast Fall!
    if (player.spinFlipTimer > 0) {
      const progress = 1 - clamp01(player.spinFlipTimer / 0.28);
      somersaultAngle = progress * Math.PI * 2 * f;
    }
    const vyNorm = Math.max(-1, Math.min(1, player.vy / 280));
    torsoLeanX = clamp01(speed / 220) * 3.5 * (player.vx >= 0 ? 1 : -1) - vyNorm * f * 1.2;
    torsoDropY = vyNorm < 0 ? -1.5 : 1.0;

    if (player.vy < -70) {
      // Rising athletic tuck
      squashX *= 0.91;
      squashY *= 1.1;
      localBladeAngle = 2.75;
      backLeg = { hipX: -2 * f, hipY: -12, kneeX: -4 * f, kneeY: -6, footX: -5 * f, footY: 1 };
      frontLeg = { hipX: 2 * f, hipY: -13, kneeX: 5.5 * f, kneeY: -10, footX: 3 * f, footY: -4 };
    } else if (player.vy > 85) {
      // Falling poised landing prep, hair & cape streaming high
      squashX *= 0.94;
      squashY *= 1.06;
      localBladeAngle = 2.35;
      backLeg = { hipX: -2 * f, hipY: -12, kneeX: -3.5 * f, kneeY: -7, footX: -4.5 * f, footY: -1 };
      frontLeg = { hipX: 2 * f, hipY: -12, kneeX: 3.5 * f, kneeY: -5, footX: 4 * f, footY: 2 };
    } else {
      // Weightless apex hang!
      torsoDropY = -1;
      localBladeAngle = 2.55;
      backLeg = { hipX: -2 * f, hipY: -12, kneeX: -4 * f, kneeY: -8, footX: -3 * f, footY: -3 };
      frontLeg = { hipX: 2 * f, hipY: -12, kneeX: 4.5 * f, kneeY: -8, footX: 3.5 * f, footY: -3 };
    }
  } else if (player.skidTimer > 0) {
    // Ground Turnaround Brake-Skid! Lean back digging front heel into stone!
    torsoLeanX = -3.8 * f;
    torsoDropY = 3.0;
    squashX *= 1.08;
    squashY *= 0.92;
    localBladeAngle = 2.25;
    backLeg = { hipX: -2.5 * f, hipY: -10, kneeX: -5 * f, kneeY: -5, footX: -4 * f, footY: 0 };
    frontLeg = { hipX: 2 * f, hipY: -10, kneeX: 5.5 * f, kneeY: -5, footX: 8.5 * f, footY: 0 };
  } else if (player.crouching) {
    torsoLeanX = 2.0 * f;
    torsoDropY = 5.5;
    squashX *= 1.1;
    squashY *= 0.86;
    localBladeAngle = 2.72;
    backLeg = { hipX: -2 * f, hipY: -8, kneeX: -5 * f, kneeY: -4, footX: -4 * f, footY: 0 };
    frontLeg = { hipX: 2 * f, hipY: -8, kneeX: 5.5 * f, kneeY: -4, footX: 5 * f, footY: 0 };
  } else if (speed > 14) {
    // 2-Joint Articulated Anime Sprint Cycle!
    const phase = player.gaitPhase;
    const bounce = Math.abs(Math.sin(phase)) * 2.2 * speedRatio;
    torsoLeanX = (3.8 * speedRatio) * f;
    torsoDropY = 1.6 * speedRatio - bounce + (player.landRecoveryTimer > 0 ? 2.5 : 0);
    headNodY = Math.sin(phase * 2) * 0.6;
    chestTwist = Math.sin(phase) * 0.35 * speedRatio;
    localBladeAngle = 2.84 + Math.sin(phase) * 0.1;

    const computeStrideLeg = (p: number, hipOffsetX: number): LimbJoints => {
      const s = Math.sin(p); // -1 rear -> +1 front
      const lift = Math.max(0, Math.cos(p)); // >0 during forward swing phase!
      const strideAmp = 6.8 * speedRatio;
      const footLocalX = s * strideAmp;
      const footLocalY = -lift * 4.2 * speedRatio;
      // Knee always bends FORWARD (in facing direction) during swing!
      const kneeLocalX = footLocalX * 0.55 + (1.8 + lift * 2.6) * speedRatio;
      const kneeLocalY = -6.2 - lift * 2.4 * speedRatio;
      return {
        hipX: hipOffsetX * f,
        hipY: -12 + torsoDropY * 0.45,
        kneeX: kneeLocalX * f,
        kneeY: kneeLocalY,
        footX: footLocalX * f,
        footY: footLocalY,
      };
    };

    backLeg = computeStrideLeg(phase + Math.PI, -1.5);
    frontLeg = computeStrideLeg(phase, 1.5);
  } else {
    // Poised Breathing Idle + Landing Knee-Flex Recovery
    const breath = Math.sin(time * 3.1);
    const landDip = player.landRecoveryTimer > 0 ? (player.landRecoveryTimer / 0.14) * 3.8 : 0;
    torsoDropY = breath * 0.7 + landDip;
    localBladeAngle = 2.56 + breath * 0.03;
    backLeg = {
      hipX: -2 * f,
      hipY: -12 + landDip * 0.5,
      kneeX: (-2.8 - landDip * 0.3) * f,
      kneeY: -6 + landDip * 0.3,
      footX: -3.5 * f,
      footY: 0,
    };
    frontLeg = {
      hipX: 2 * f,
      hipY: -12 + landDip * 0.5,
      kneeX: (3.2 + landDip * 0.4) * f,
      kneeY: -6 + landDip * 0.3,
      footX: 3.0 * f,
      footY: 0,
    };
  }

  localPrevBladeAngle = player.moveId === MoveId.None ? localBladeAngle : localPrevBladeAngle;

  const bladeAngle = mirrorAngle(localBladeAngle, f);
  const prevBladeAngle = mirrorAngle(localPrevBladeAngle, f);

  const shoulderX = torsoLeanX + f * 1.5;
  const shoulderY = -22 + torsoDropY;
  const handX = torsoLeanX + f * armReachX;
  const handY = armReachY + torsoDropY;
  // Natural slight elbow bend between shoulder and sword grip
  const elbowX = (shoulderX + handX) * 0.5 - f * 1.5;
  const elbowY = (shoulderY + handY) * 0.5 + 1.8;

  // Offhand rests on scabbard throat at left hip (iaido poise!)
  const offhandX = torsoLeanX * 0.5 - f * 2.5;
  const offhandY = -14 + torsoDropY;

  return {
    facing: f,
    squashX,
    squashY,
    torsoLeanX,
    torsoDropY,
    headNodY,
    chestTwist,
    somersaultAngle,
    backLeg,
    frontLeg,
    shoulderX,
    shoulderY,
    elbowX,
    elbowY,
    handX,
    handY,
    bladeAngle,
    prevBladeAngle,
    bladeLen,
    smearIntensity,
    smearColor,
    offhandX,
    offhandY,
  };
}
