import { clamp01, computeAriaPose, easeInOutSine, easeOutCubic, easeWhipOut, lerp } from './kinematics';
import { MOVES, getMovePhase } from './rules';
import { EnemyAIState, EnemyEntity, EnemyKind, MoveId, PlayerEntity } from './types';

/**
 * Hierarchical 2D Skeletal Rigging & Analytical 2-Bone IK Solver
 * Powers crisp pixel-art sprite-part articulation for Heroine Aria (16-part rig)
 * and all 4 Metroidvania Enemy Archetypes (Stalker, Weaver, Halberdier, Sovereign).
 */

export interface BonePose {
  x: number;
  y: number;
  angle: number; // World-space radians (0 = +X right, PI/2 = +Y down)
}

export interface TwoBoneChain {
  upper: BonePose;
  lower: BonePose;
  endX: number;
  endY: number;
}

/**
 * Exact Law-of-Cosines 2-Bone Analytical IK Solver
 * Preserves rigid anatomical limb lengths (zero rubbery stretching!)
 * @param bendDir +1 or -1 controlling knee/elbow bend orientation
 */
export function solveTwoBoneIK(
  rootX: number,
  rootY: number,
  targetX: number,
  targetY: number,
  lenUpper: number,
  lenLower: number,
  bendDir: 1 | -1
): TwoBoneChain {
  const dx = targetX - rootX;
  const dy = targetY - rootY;
  const rawDist = Math.hypot(dx, dy);
  const minReach = Math.abs(lenUpper - lenLower) + 0.35;
  const maxReach = (lenUpper + lenLower) * 0.992;
  const dist = Math.max(minReach, Math.min(maxReach, rawDist));

  const baseAngle = Math.atan2(dy, dx);
  const cosUpper =
    (lenUpper * lenUpper + dist * dist - lenLower * lenLower) / (2 * lenUpper * dist);
  const clampedCos = Math.max(-1, Math.min(1, cosUpper));
  const bendOffset = Math.acos(clampedCos) * bendDir;

  const upperAngle = baseAngle - bendOffset;
  const jointX = rootX + Math.cos(upperAngle) * lenUpper;
  const jointY = rootY + Math.sin(upperAngle) * lenUpper;

  const clampedTargetX =
    rawDist > 0.001 ? rootX + (dx / rawDist) * dist : rootX + lenUpper;
  const clampedTargetY =
    rawDist > 0.001 ? rootY + (dy / rawDist) * dist : rootY;

  const lowerAngle = Math.atan2(clampedTargetY - jointY, clampedTargetX - jointX);
  const endX = jointX + Math.cos(lowerAngle) * lenLower;
  const endY = jointY + Math.sin(lowerAngle) * lenLower;

  return {
    upper: { x: rootX, y: rootY, angle: upperAngle },
    lower: { x: jointX, y: jointY, angle: lowerAngle },
    endX,
    endY,
  };
}

export interface AriaSkeletalRig {
  facing: 1 | -1;
  squashX: number;
  squashY: number;
  chestTwist: number;
  somersaultAngle: number | null;

  pelvis: BonePose;
  skirt: BonePose & { flare: number };
  torso: BonePose;
  head: BonePose;
  scabbard: BonePose;

  backLeg: TwoBoneChain;
  backFootAngle: number;
  frontLeg: TwoBoneChain;
  frontFootAngle: number;

  backArm: TwoBoneChain;
  frontArm: TwoBoneChain;

  katana: BonePose;
  prevBladeAngle: number;
  bladeLen: number;
  smearIntensity: number;
  smearColor: 'silver' | 'cyan' | 'violet' | 'crimson';
}

export function solveAriaSkeleton(player: PlayerEntity, time: number): AriaSkeletalRig {
  const base = computeAriaPose(player, time);
  const f = base.facing;
  const px = player.x;
  const py = player.y;
  const sx = base.squashX;
  const sy = base.squashY;

  // 1. Pelvis & Spine/Torso Hierarchy (Tall poised anime stance at idle; deep coil on crouch/slash)
  const pelvisX = px + base.torsoLeanX * 0.46 * sx;
  const pelvisY = py + (-14.2 + base.torsoDropY * 0.88) * sy;
  const spineTilt = (base.torsoLeanX * 0.052) + (player.crouching ? f * 0.18 : 0);

  const torsoX = pelvisX + Math.sin(spineTilt) * 2.2;
  const torsoY = pelvisY - Math.cos(spineTilt) * 3.2 * sy;
  const torsoAngle = -Math.PI * 0.5 + spineTilt;

  // 2. Neck & Stabilized Anime Head Bone (counter-rotates slightly so gaze stays level & fierce!)
  const shoulderCenterX = torsoX + Math.cos(torsoAngle) * 7.8 * sy;
  const shoulderCenterY = torsoY + Math.sin(torsoAngle) * 7.8 * sy;
  const headTilt = spineTilt * 0.42 + (base.headNodY * 0.065 * f);
  const head: BonePose = {
    x: shoulderCenterX + f * 0.3,
    y: shoulderCenterY - 1.4 * sy,
    angle: f === 1 ? headTilt : Math.PI + headTilt,
  };

  // 3. Dynamic Skirt Flare & Scabbard Pivot
  const airFlare = !player.grounded ? clamp01(Math.abs(player.vy) / 240) * 0.28 : 0;
  const spinFlare =
    player.moveId === MoveId.Slash3 || player.moveId === MoveId.AirSlash2 ? 0.35 : 0;
  const skirt = {
    x: pelvisX,
    y: pelvisY - 0.8 * sy,
    angle: spineTilt * 0.65 - (player.vx * 0.0009),
    flare: 1 + airFlare + spinFlare + clamp01(Math.abs(player.vx) / 260) * 0.16,
  };

  const scabbardLag = Math.sin(time * 5.5) * 0.03 - player.vy * 0.0008 * f;
  const scabbardBaseAngle = f === 1 ? 2.82 + scabbardLag : Math.PI - (2.82 + scabbardLag);
  const scabbard: BonePose = {
    x: pelvisX - f * 1.8,
    y: pelvisY + 0.6,
    angle: scabbardBaseAngle - spineTilt * 0.4,
  };

  // 4. Analytical 2-Bone IK for Front & Back Legs (Rigid 6.7 thigh + 6.9 shin, forward anatomical knee bend!)
  const legUpperLen = 6.7 * sy;
  const legLowerLen = 6.9 * sy;
  // In +Y-down coordinates (baseAngle ~ +PI/2), +f decreases upperAngle toward 0 (+X) when f=1 -> knee bends FORWARD!
  const kneeBendDir: 1 | -1 = f === 1 ? 1 : -1;

  const backHipX = pelvisX - f * 1.3;
  const backHipY = pelvisY + 0.6;
  const backFootTargetX = px + base.backLeg.footX * sx;
  const backFootTargetY = py + base.backLeg.footY * sy - 1.1;
  const backLeg = solveTwoBoneIK(
    backHipX,
    backHipY,
    backFootTargetX,
    backFootTargetY,
    legUpperLen,
    legLowerLen,
    kneeBendDir
  );

  const frontHipX = pelvisX + f * 1.2;
  const frontHipY = pelvisY + 0.6;
  const frontFootTargetX = px + base.frontLeg.footX * sx;
  const frontFootTargetY = py + base.frontLeg.footY * sy - 1.1;
  const frontLeg = solveTwoBoneIK(
    frontHipX,
    frontHipY,
    frontFootTargetX,
    frontFootTargetY,
    legUpperLen,
    legLowerLen,
    kneeBendDir
  );

  // Ankle flexion: flat on stone when grounded, pointed toe in midair!
  const calcFootAngle = (grounded: boolean, shinAngle: number): number => {
    if (grounded) {
      return f === 1 ? 0 : Math.PI;
    }
    const baseToe = f === 1 ? 0.36 : Math.PI - 0.36;
    return lerp(baseToe, shinAngle, 0.25);
  };
  const backFootAngle = calcFootAngle(player.grounded && base.backLeg.footY >= -0.5, backLeg.lower.angle);
  const frontFootAngle = calcFootAngle(player.grounded && base.frontLeg.footY >= -0.5, frontLeg.lower.angle);

  // 5. Analytical 2-Bone IK for Both Arms (Natural downward/backward elbow hang!)
  const armUpperLen = 5.2;
  const armLowerLen = 5.4;
  const elbowBendDir: 1 | -1 = f === 1 ? -1 : 1;

  const frontShX = shoulderCenterX + f * 1.4;
  const frontShY = shoulderCenterY + 1.2;
  const handTargetX = px + base.handX * sx;
  const handTargetY = py + base.handY * sy;

  const frontArm = solveTwoBoneIK(
    frontShX,
    frontShY,
    handTargetX,
    handTargetY,
    armUpperLen,
    armLowerLen,
    elbowBendDir
  );

  // Offhand (Back Arm): Two-handed grip on heavy cleaves, counter-balance during light slashes, scabbard koiguchi in neutral!
  const backShX = shoulderCenterX - f * 1.8;
  const backShY = shoulderCenterY + 1.4;
  let offTargetX = scabbard.x + f * 0.6;
  let offTargetY = scabbard.y - 0.6;

  if (player.moveId !== MoveId.None) {
    const spec = MOVES[player.moveId];
    if (spec.heavyBreak || player.moveId === MoveId.Slash4 || player.moveId === MoveId.RisingMoon) {
      // Two-handed kendo/katana grip on tsuka hilt!
      offTargetX = frontArm.endX - Math.cos(base.bladeAngle) * 2.4;
      offTargetY = frontArm.endY - Math.sin(base.bladeAngle) * 2.4;
    } else {
      // Dynamic martial counter-balance arm sweep behind torso
      offTargetX = shoulderCenterX - f * 6.5;
      offTargetY = shoulderCenterY + 3.2;
    }
  } else if (Math.abs(player.vx) > 35 && player.grounded) {
    // Athletic sprint arm pump while keeping thumb near scabbard
    const swing = Math.sin(player.gaitPhase + Math.PI) * 2.2;
    offTargetX = scabbard.x + f * (1.2 + swing * 0.5);
    offTargetY = scabbard.y - 1.0 - Math.abs(swing) * 0.3;
  }

  const backArm = solveTwoBoneIK(
    backShX,
    backShY,
    offTargetX,
    offTargetY,
    armUpperLen * 0.95,
    armLowerLen * 0.95,
    elbowBendDir
  );

  return {
    facing: f,
    squashX: sx,
    squashY: sy,
    chestTwist: base.chestTwist,
    somersaultAngle: base.somersaultAngle,
    pelvis: { x: pelvisX, y: pelvisY, angle: spineTilt * 0.5 },
    skirt,
    torso: { x: torsoX, y: torsoY, angle: torsoAngle },
    head,
    scabbard,
    backLeg,
    backFootAngle,
    frontLeg,
    frontFootAngle,
    backArm,
    frontArm,
    katana: {
      x: frontArm.endX,
      y: frontArm.endY,
      angle: base.bladeAngle,
    },
    prevBladeAngle: base.prevBladeAngle,
    bladeLen: base.bladeLen,
    smearIntensity: base.smearIntensity,
    smearColor: base.smearColor,
  };
}

// --- Multi-Bone Skeletal Solver for All 4 Metroidvania Enemy Archetypes ---

export interface EnemySkeletalRig {
  facing: 1 | -1;
  pelvis: BonePose;
  torso: BonePose;
  head: BonePose;
  backLeg: TwoBoneChain;
  frontLeg: TwoBoneChain;
  backArm: TwoBoneChain;
  frontArm: TwoBoneChain;
  weapon: BonePose;
  prevWeaponAngle: number;
  weaponSmearIntensity: number;
  offhandProp: BonePose;
}

export function solveEnemySkeleton(e: EnemyEntity, time: number): EnemySkeletalRig {
  const f = e.facing;
  const ex = e.x;
  const ey = e.y;
  const isWindup = e.aiState === EnemyAIState.Windup;
  const isAttack = e.aiState === EnemyAIState.Attack;
  const isHit = e.aiState === EnemyAIState.Hitstun;
  const moving = Math.abs(e.vx) > 8;

  const isWarden = e.kind === EnemyKind.Warden;
  const isArchon = e.kind === EnemyKind.Archon;
  const isSovereign = e.kind === EnemyKind.Sovereign;
  const isBoss = isWarden || isArchon || isSovereign;
  const isKnight = e.kind === EnemyKind.Halberdier || isWarden;
  const isMage = e.kind === EnemyKind.Weaver || isArchon;

  const hipHeight = isWarden
    ? 18.5
    : isSovereign
      ? 16.5
      : isArchon
        ? 18.5
        : isKnight
          ? 14.5
          : isMage
            ? 17.5
            : 13.5;
  const torsoLen = isWarden ? 12.8 : isBoss ? 11.5 : isKnight ? 10.5 : isMage ? 9.5 : 8.8;
  const legLen1 = isWarden ? 8.8 : isBoss ? 8.2 : isKnight ? 7.4 : 6.6;
  const legLen2 = isWarden ? 9.0 : isBoss ? 8.6 : isKnight ? 7.6 : 6.8;
  const armLen1 = isWarden ? 7.6 : isBoss ? 6.8 : isKnight ? 6.2 : 5.4;
  const armLen2 = isWarden ? 7.8 : isBoss ? 7.0 : isKnight ? 6.2 : 5.6;

  // Dynamic windup tension & whip-snap active progression
  const windupT = isWindup ? easeOutCubic(clamp01(1 - e.stateTimer / 0.44)) : 0;
  const attackT = isAttack ? easeWhipOut(clamp01(1 - e.stateTimer / 0.28)) : 0;
  const prevAttackT = isAttack ? easeWhipOut(clamp01(1 - (e.stateTimer + 0.036) / 0.28)) : 0;

  // Dynamic stance lean & recoil
  let leanX = 0;
  let dropY = (1 - e.scaleY) * 8;
  if (isHit) {
    leanX = -f * 5.6;
    dropY += 2.2;
  } else if (isWindup) {
    leanX = -f * (2.6 + windupT * 2.8);
    dropY += 1.6 + windupT * 1.8;
  } else if (isAttack) {
    leanX = f * (4.0 + attackT * 5.2);
    dropY += 2.2 + attackT * 1.8;
  } else if (e.kind === EnemyKind.Stalker || e.kind === EnemyKind.Reaper) {
    leanX = f * 2.8;
    dropY += 1.4;
  }

  const hoverY = isArchon
    ? Math.sin(time * 3.6 + e.id) * 3.8 - 5.2
    : e.kind === EnemyKind.Weaver
      ? Math.sin(time * 4.2 + e.id) * 3.4 - 4.5
      : isSovereign
        ? Math.sin(time * 3.2) * 1.1
        : 0;
  const breath = Math.sin(time * 3.6 + e.id) * 0.5;

  const pelvisX = ex + leanX * 0.55;
  const pelvisY = ey - hipHeight + dropY + hoverY + breath * 0.4;
  const spineAngle = -Math.PI * 0.5 + leanX * 0.048;

  const shoulderX = pelvisX + Math.cos(spineAngle) * torsoLen;
  const shoulderY = pelvisY + Math.sin(spineAngle) * torsoLen;
  const headAngle = f === 1 ? leanX * 0.025 : Math.PI + leanX * 0.025;

  // Gait & Lunge Foot Targets
  const strideAmp = moving ? (isKnight ? 4.4 : 6.2) : 0;
  const s = Math.sin(e.gaitPhase);
  const liftBack = moving ? Math.max(0, Math.cos(e.gaitPhase + Math.PI)) * 3.2 : 0;
  const liftFront = moving ? Math.max(0, Math.cos(e.gaitPhase)) * 3.2 : 0;
  const stanceSpread = isAttack ? 8.4 : isWindup ? 6.2 : isKnight ? 5.0 : 3.6;

  const kneeBend: 1 | -1 = f === 1 ? 1 : -1;
  const backFootX = ex - f * stanceSpread - s * strideAmp * f;
  const backFootY = isMage ? pelvisY + 12.5 : ey - 1.0 - liftBack;
  const frontFootX = ex + f * stanceSpread + s * strideAmp * f;
  const frontFootY = isMage ? pelvisY + 13.0 : ey - 1.0 - liftFront;

  const backLeg = solveTwoBoneIK(
    pelvisX - f * 1.6,
    pelvisY + 0.8,
    backFootX,
    backFootY,
    legLen1,
    legLen2,
    kneeBend
  );
  const frontLeg = solveTwoBoneIK(
    pelvisX + f * 1.6,
    pelvisY + 0.8,
    frontFootX,
    frontFootY,
    legLen1,
    legLen2,
    kneeBend
  );

  // Articulated Weapon & Offhand Arms (Natural downward/backward elbow hang)
  const elbowBend: 1 | -1 = f === 1 ? -1 : 1;
  let handX = shoulderX + f * 6.5;
  let handY = shoulderY + 4.5;
  let localWepAngle = 0.45;
  let prevLocalWepAngle = 0.45;
  let weaponSmearIntensity = 0;

  let offX = shoulderX - f * 3.5;
  let offY = shoulderY + 5.0;
  let localOffAngle = 2.4;

  if (e.kind === EnemyKind.Stalker) {
    const coilAng = -2.25;
    const slashEndAng = 0.48;
    if (isWindup) {
      handX = shoulderX - f * (2.5 + windupT * 2.8);
      handY = shoulderY - (3.0 + windupT * 3.4);
      localWepAngle = lerp(0.65, coilAng, windupT);
      prevLocalWepAngle = localWepAngle;
      offX = shoulderX + f * 4.0;
      offY = shoulderY + 2.0;
      localOffAngle = 0.6;
    } else if (isAttack) {
      handX = shoulderX + f * lerp(-4.5, 11.5, attackT);
      handY = shoulderY + lerp(-5.5, 3.0, attackT);
      localWepAngle = lerp(coilAng, slashEndAng, attackT);
      prevLocalWepAngle = lerp(coilAng, slashEndAng, prevAttackT);
      weaponSmearIntensity = 0.92;
      offX = shoulderX - f * 6.5;
      offY = shoulderY + 3.5;
      localOffAngle = 2.7;
    } else {
      handX = shoulderX + f * 5.8;
      handY = shoulderY + 3.8 + breath;
      localWepAngle = 0.65;
      prevLocalWepAngle = 0.65;
      offX = shoulderX - f * 4.2;
      offY = shoulderY + 4.5;
      localOffAngle = 2.55;
    }
  } else if (e.kind === EnemyKind.Reaper) {
    // Abyssal Crescent Scythe: wide overhead harvest coil -> sweeping crescent cleave!
    const coilAng = -2.42;
    const cleaveAng = 0.62;
    if (isWindup) {
      handX = shoulderX - f * (3.2 + windupT * 2.8);
      handY = shoulderY - (5.0 + windupT * 3.8);
      localWepAngle = lerp(-0.82, coilAng, windupT);
      prevLocalWepAngle = localWepAngle;
      offX = handX + f * 2.0;
      offY = handY + 2.0;
      localOffAngle = -1.8;
    } else if (isAttack) {
      handX = shoulderX + f * lerp(-5.5, 12.6, attackT);
      handY = shoulderY + lerp(-8.2, 2.8, attackT);
      localWepAngle = lerp(coilAng, cleaveAng, attackT);
      prevLocalWepAngle = lerp(coilAng, cleaveAng, prevAttackT);
      weaponSmearIntensity = 0.96;
      offX = shoulderX + f * 7.5;
      offY = shoulderY + 3.2;
      localOffAngle = 0.4;
    } else {
      handX = shoulderX + f * 4.6;
      handY = shoulderY + 2.4 + breath;
      localWepAngle = -0.82;
      prevLocalWepAngle = -0.82;
      offX = shoulderX - f * 2.5;
      offY = shoulderY + 4.2;
      localOffAngle = 2.2;
    }
  } else if (e.kind === EnemyKind.Arbalist) {
    // Repeating Crimson Crossbow: steady forward shoulder-level aim with kickback on fire!
    if (isWindup) {
      handX = shoulderX + f * 9.8;
      handY = shoulderY - 0.8;
      localWepAngle = -0.04;
      prevLocalWepAngle = -0.04;
      offX = shoulderX + f * 5.5;
      offY = shoulderY + 0.6;
      localOffAngle = 0;
    } else if (isAttack) {
      handX = shoulderX + f * 7.4; // Crisp crossbow recoil kick!
      handY = shoulderY - 2.0;
      localWepAngle = -0.18;
      prevLocalWepAngle = -0.04;
      offX = shoulderX + f * 4.2;
      offY = shoulderY + 0.2;
      localOffAngle = 0;
    } else {
      handX = shoulderX + f * 8.2;
      handY = shoulderY + 1.4 + breath * 0.5;
      localWepAngle = 0.16;
      prevLocalWepAngle = 0.16;
      offX = shoulderX + f * 4.0;
      offY = shoulderY + 2.5;
      localOffAngle = 0.2;
    }
  } else if (e.kind === EnemyKind.Weaver) {
    const castBob = Math.cos(time * 5.5 + e.id) * 1.6;
    handX = shoulderX + f * (isAttack ? 9.8 : 6.8);
    handY = shoulderY + (isWindup ? -5.0 : 1.5) + castBob;
    localWepAngle = isWindup ? -0.88 : 0.08;
    prevLocalWepAngle = localWepAngle;
    offX = shoulderX + f * (isWindup ? 4.5 : 9.8);
    offY = shoulderY + (isWindup ? -7.5 : -2.5) - castBob * 0.6;
    localOffAngle = 0;
  } else if (e.kind === EnemyKind.Halberdier) {
    const coilAng = -2.12;
    const cleaveAng = 0.34;
    if (isWindup) {
      handX = shoulderX - f * (2.0 + windupT * 2.2);
      handY = shoulderY - (5.2 + windupT * 3.8);
      localWepAngle = lerp(-1.25, coilAng, windupT);
      prevLocalWepAngle = localWepAngle;
    } else if (isAttack) {
      handX = shoulderX + f * lerp(-3.5, 11.8, attackT);
      handY = shoulderY + lerp(-8.5, 2.6, attackT);
      localWepAngle = lerp(coilAng, cleaveAng, attackT);
      prevLocalWepAngle = lerp(coilAng, cleaveAng, prevAttackT);
      weaponSmearIntensity = 0.94;
    } else {
      handX = shoulderX - f * 2.2;
      handY = shoulderY + 3.5;
      localWepAngle = -1.25;
      prevLocalWepAngle = -1.25;
    }
    offX = e.shieldActive ? shoulderX + f * 7.6 : shoulderX - f * 5.0;
    offY = shoulderY + (isHit ? 1.5 : 4.2);
    localOffAngle = 0;
  } else if (e.kind === EnemyKind.Warden) {
    // Boss 1: Warden Gorgon — Colossal Executioner Great-Axe overhead quake slam!
    const coilAng = -2.36;
    const slamAng = 0.72;
    if (isWindup) {
      handX = shoulderX - f * (3.2 + windupT * 2.6);
      handY = shoulderY - (6.8 + windupT * 5.0);
      localWepAngle = lerp(-0.58, coilAng, windupT);
      prevLocalWepAngle = localWepAngle;
      offX = handX + f * 2.2;
      offY = handY + 2.0;
      localOffAngle = -2.0;
    } else if (isAttack) {
      handX = shoulderX + f * lerp(-5.2, 14.4, attackT);
      handY = shoulderY + lerp(-11.2, 5.8, attackT);
      localWepAngle = lerp(coilAng, slamAng, attackT);
      prevLocalWepAngle = lerp(coilAng, slamAng, prevAttackT);
      weaponSmearIntensity = 1.0;
      offX = shoulderX + f * 9.2;
      offY = shoulderY + 4.4;
      localOffAngle = 0.5;
    } else {
      handX = shoulderX + f * 6.8;
      handY = shoulderY + 3.8 + breath;
      localWepAngle = -0.58;
      prevLocalWepAngle = -0.58;
      offX = shoulderX - f * 4.0;
      offY = shoulderY + 4.8;
      localOffAngle = 2.1;
    }
  } else if (e.kind === EnemyKind.Archon) {
    // Boss 2: Star-Vault Archon Orpheus — Levitating Astral Eclipse Scepter!
    const scepterWave = Math.sin(time * 4.4 + e.id) * 1.8;
    const coilAng = -1.78;
    const castAng = 0.24;
    if (isWindup) {
      handX = shoulderX + f * (3.2 + windupT * 2.0);
      handY = shoulderY - (5.6 + windupT * 3.8) + scepterWave * 0.4;
      localWepAngle = lerp(-0.92, coilAng, windupT);
      prevLocalWepAngle = localWepAngle;
      offX = shoulderX + f * 9.5;
      offY = shoulderY - 5.5;
      localOffAngle = -0.6;
    } else if (isAttack) {
      handX = shoulderX + f * lerp(4.8, 12.8, attackT);
      handY = shoulderY + lerp(-8.8, -0.8, attackT);
      localWepAngle = lerp(coilAng, castAng, attackT);
      prevLocalWepAngle = lerp(coilAng, castAng, prevAttackT);
      weaponSmearIntensity = 0.90;
      offX = shoulderX - f * 5.5;
      offY = shoulderY - 2.0;
      localOffAngle = 2.6;
    } else {
      handX = shoulderX + f * 8.4;
      handY = shoulderY + 1.2 + scepterWave;
      localWepAngle = -0.92;
      prevLocalWepAngle = -0.92;
      offX = shoulderX - f * 4.5;
      offY = shoulderY + 2.8;
      localOffAngle = 2.4;
    }
  } else {
    // Boss 3: Sovereign Selene (绯月女武神 · 瑟琳): Regal Blood-Moon Greatsword choreography!
    const coilAng = -2.32;
    const cleaveAng = 0.48;
    if (isWindup) {
      handX = shoulderX - f * (3.2 + windupT * 2.8);
      handY = shoulderY - (5.5 + windupT * 4.6);
      localWepAngle = lerp(-1.2, coilAng, windupT);
      prevLocalWepAngle = localWepAngle;
      offX = handX + f * 1.5;
      offY = handY + 1.5;
      localOffAngle = -2.0;
    } else if (isAttack) {
      handX = shoulderX + f * lerp(-5.5, 13.4, attackT);
      handY = shoulderY + lerp(-9.5, 3.4, attackT);
      localWepAngle = lerp(coilAng, cleaveAng, attackT);
      prevLocalWepAngle = lerp(coilAng, cleaveAng, prevAttackT);
      weaponSmearIntensity = 1.0;
      offX = shoulderX - f * 6.0;
      offY = shoulderY + 1.5;
      localOffAngle = 2.5;
    } else {
      handX = shoulderX - f * 3.2;
      handY = shoulderY + 5.8 + breath;
      localWepAngle = 2.42;
      prevLocalWepAngle = 2.42;
      offX = shoulderX + f * 4.5;
      offY = shoulderY + 3.8;
      localOffAngle = 0.4;
    }
  }

  const frontArm = solveTwoBoneIK(
    shoulderX + f * 1.2,
    shoulderY + 1.4,
    handX,
    handY,
    armLen1,
    armLen2,
    elbowBend
  );
  const backArm = solveTwoBoneIK(
    shoulderX - f * 1.4,
    shoulderY + 1.5,
    offX,
    offY,
    armLen1 * 0.95,
    armLen2 * 0.95,
    elbowBend
  );

  const worldWepAngle = f === 1 ? localWepAngle : Math.PI - localWepAngle;
  const prevWorldWepAngle = f === 1 ? prevLocalWepAngle : Math.PI - prevLocalWepAngle;
  const worldOffAngle = f === 1 ? localOffAngle : Math.PI - localOffAngle;

  void easeInOutSine;

  return {
    facing: f,
    pelvis: { x: pelvisX, y: pelvisY, angle: spineAngle + Math.PI * 0.5 },
    torso: { x: pelvisX, y: pelvisY, angle: spineAngle },
    head: { x: shoulderX, y: shoulderY - 1.2, angle: headAngle },
    backLeg,
    frontLeg,
    backArm,
    frontArm,
    weapon: { x: frontArm.endX, y: frontArm.endY, angle: worldWepAngle },
    prevWeaponAngle: prevWorldWepAngle,
    weaponSmearIntensity,
    offhandProp: { x: backArm.endX, y: backArm.endY, angle: worldOffAngle },
  };
}

