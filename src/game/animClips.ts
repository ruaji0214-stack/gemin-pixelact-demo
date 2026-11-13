import { MOVES, PLAYER_DASH_DURATION, ZANSHIN_GLINT_WINDOW } from './rules';
import { EnemyAIState, EnemyEntity, GamePhase, MoveId, PlayerEntity } from './types';

/**
 * Pure Deterministic Animation Clip Resolver & Per-Action Hand-Socket Synchronizer
 * - Guarantees EVERY distinct player action (12 locomotion/air/stance/reaction states + 13 combat MoveIds = 25 clips)
 *   maps to its own independent sprite animation clip with smooth normalized [0..1] in-between progression.
 * - Synchronizes the 2D skeletal weapon rig's hand socket (handOffsetX, handOffsetY) smoothly across windup -> active -> recovery.
 */

export type AriaClipId =
  | 'idle'
  | 'run'
  | 'crouch'
  | 'skid'
  | 'jump_rise'
  | 'jump_apex'
  | 'jump_fall'
  | 'land'
  | 'dash'
  | 'wall_slide'
  | 'hurt'
  | 'zanshin'
  | 'slash_1'
  | 'slash_2'
  | 'slash_3'
  | 'slash_4'
  | 'slide_slash'
  | 'rising_moon'
  | 'dash_thrust'
  | 'moon_counter'
  | 'astral_slash'
  | 'air_slash_1'
  | 'air_slash_2'
  | 'helm_splitter'
  | 'heavy_crescent'
  | 'dimension_cut';

export type EnemyClipId = 'idle' | 'walk' | 'windup' | 'attack' | 'hitstun';

export interface AriaAnimSample {
  clipId: AriaClipId;
  progress01: number; // Continuous [0, 1) for loops or [0, 1] for one-shot clips
  loop: boolean;
  handOffsetX: number; // Local facing-space X offset from entity root for skeletal Katana grip
  handOffsetY: number; // World Y offset from entity root (negative = above ground)
  ikBlend: number; // Blend weight [0..1] toward dynamic 2-bone IK sword-arm trajectory
}

export interface EnemyAnimSample {
  clipId: EnemyClipId;
  progress01: number;
  loop: boolean;
}

interface MoveHandTrack {
  clipId: AriaClipId;
  windupHand: readonly [number, number];
  peakHand: readonly [number, number];
  recoveryHand: readonly [number, number];
  ikBlend: number;
}

const MOVE_HAND_TRACKS: Record<Exclude<MoveId, MoveId.None>, MoveHandTrack> = {
  [MoveId.Slash1]: {
    clipId: 'slash_1',
    windupHand: [-1.8, -32.4],
    peakHand: [10.4, -13.8],
    recoveryHand: [3.2, -16.8],
    ikBlend: 0,
  },
  [MoveId.Slash2]: {
    clipId: 'slash_2',
    windupHand: [-2.4, -15.2],
    peakHand: [9.6, -29.8],
    recoveryHand: [6.8, -22.4],
    ikBlend: 0,
  },
  [MoveId.Slash3]: {
    clipId: 'slash_3',
    windupHand: [3.6, -22.0],
    peakHand: [11.6, -24.8],
    recoveryHand: [7.4, -22.2],
    ikBlend: 0,
  },
  [MoveId.Slash4]: {
    clipId: 'slash_4',
    windupHand: [1.6, -34.6],
    peakHand: [13.0, -22.2],
    recoveryHand: [6.8, -20.8],
    ikBlend: 0,
  },
  [MoveId.SlideSlash]: {
    clipId: 'slide_slash',
    windupHand: [-0.8, -12.6],
    peakHand: [5.4, -13.8],
    recoveryHand: [4.8, -15.6],
    ikBlend: 0,
  },
  [MoveId.RisingMoon]: {
    clipId: 'rising_moon',
    windupHand: [-2.0, -15.0],
    peakHand: [-1.8, -38.8],
    recoveryHand: [2.4, -22.0],
    ikBlend: 0,
  },
  [MoveId.DashThrust]: {
    clipId: 'dash_thrust',
    windupHand: [2.4, -18.4],
    peakHand: [14.4, -17.8],
    recoveryHand: [5.6, -19.2],
    ikBlend: 0,
  },
  [MoveId.MoonCounter]: {
    clipId: 'moon_counter',
    windupHand: [5.8, -25.6],
    peakHand: [12.4, -23.6],
    recoveryHand: [6.8, -21.2],
    ikBlend: 0,
  },
  [MoveId.AstralSlash]: {
    clipId: 'astral_slash',
    windupHand: [-3.4, -22.8],
    peakHand: [13.8, -21.2],
    recoveryHand: [5.2, -19.4],
    ikBlend: 0,
  },
  [MoveId.AirSlash1]: {
    clipId: 'air_slash_1',
    windupHand: [-5.4, -27.2],
    peakHand: [10.2, -26.8],
    recoveryHand: [2.2, -21.4],
    ikBlend: 0,
  },
  [MoveId.AirSlash2]: {
    clipId: 'air_slash_2',
    windupHand: [6.4, -25.4],
    peakHand: [9.8, -19.6],
    recoveryHand: [1.8, -21.2],
    ikBlend: 0,
  },
  [MoveId.HelmSplitter]: {
    clipId: 'helm_splitter',
    windupHand: [-1.8, -36.8],
    peakHand: [7.6, -7.8],
    recoveryHand: [5.2, -14.8],
    ikBlend: 0,
  },
  [MoveId.HeavyCrescent]: {
    clipId: 'heavy_crescent',
    windupHand: [1.2, -35.4],
    peakHand: [10.8, -11.4],
    recoveryHand: [6.6, -19.6],
    ikBlend: 0,
  },
  [MoveId.DimensionCut]: {
    clipId: 'dimension_cut',
    windupHand: [-2.2, -14.8],
    peakHand: [12.6, -28.4],
    recoveryHand: [2.4, -18.6],
    ikBlend: 0,
  },
};

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function wrap01(v: number): number {
  const m = v % 1;
  return m < 0 ? m + 1 : m;
}

export interface ClipFrameSubSample {
  index: number;
  nextIndex: number;
  subT: number; // Continuous [0, 1] fractional progress between `index` and `nextIndex` for 60 FPS Spine continuity
}

export function computeClipFrameIndex(
  frameCount: number,
  progress01: number,
  loop: boolean
): number {
  if (frameCount <= 1) return 0;
  if (loop) {
    const wrapped = wrap01(progress01);
    return Math.min(frameCount - 1, Math.floor(wrapped * frameCount));
  }
  const clamped = clamp01(progress01);
  return Math.min(frameCount - 1, Math.floor(clamped * (frameCount - 0.0001)));
}

export function computeClipFrameSubSample(
  frameCount: number,
  progress01: number,
  loop: boolean
): ClipFrameSubSample {
  if (frameCount <= 1) {
    return { index: 0, nextIndex: 0, subT: 0 };
  }
  if (loop) {
    const scaled = wrap01(progress01) * frameCount;
    const index = Math.min(frameCount - 1, Math.floor(scaled));
    const nextIndex = (index + 1) % frameCount;
    return { index, nextIndex, subT: clamp01(scaled - index) };
  }
  const clamped = clamp01(progress01);
  const scaled = clamped * (frameCount - 1);
  const index = Math.min(frameCount - 1, Math.floor(scaled));
  const nextIndex = Math.min(frameCount - 1, index + 1);
  return { index, nextIndex, subT: clamp01(scaled - index) };
}

/**
 * Pure deterministic pelvis/skirt spine horizontal anchor calculator for canonical Aria frames:
 * - Anchors the waist-to-skirt scan band `[0.44, 0.68)` relative to Aria's standing body height
 *   from the bottom boot soles (`nominalBodyH = min(height, 148)`), so overhead-raised-arm poses
 *   (`HeavyCrescent` windup, `height > 148`) never shift the scan window upward onto her chest.
 * - Uses vertical column persistence (`nonSkinRows[x] >= 56% of band height`) so horizontally
 *   outstretched sleeves/arms (`AstralSlash`, `HeavyCrescent`, `DimensionCut`) never pass as torso columns.
 * - Selects the widest persistent column interval backed by Aria's dark-navy dress/skirt pixels
 *   and trims outer cool-silver twin-tail hair columns while preserving the enclosed white lace apron.
 */
export function computeAriaPelvisSpineAnchorX(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number
): number {
  if (width <= 2 || height <= 2) {
    return Math.round(width * 0.5);
  }

  const isWarmSkin = (r: number, g: number, b: number): boolean => {
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    return r > g + 10 && g >= b - 6 && lum > 110;
  };

  const isSilverHairMidTone = (r: number, g: number, b: number): boolean => {
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    // Mid-tone neutral silver twin-tails (122..209), while preserving dark-navy dress (<122) AND bright white lace apron (>=210)!
    return lum >= 122 && lum < 210 && maxC - minC <= 36;
  };

  const nominalBodyH = Math.min(height, 148);
  const topExtra = height - nominalBodyH;
  const y0 = Math.max(1, topExtra + Math.floor(nominalBodyH * 0.44));
  const y1 = Math.min(height - 1, topExtra + Math.ceil(nominalBodyH * 0.68));
  const bandH = Math.max(1, y1 - y0);

  const nonSkinRows = new Uint16Array(width);
  const dressOrApronRows = new Uint16Array(width);

  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) << 2;
      if (pixels[i + 3] <= 64) continue;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      if (isWarmSkin(r, g, b)) continue;
      nonSkinRows[x]++;
      if (!isSilverHairMidTone(r, g, b)) {
        dressOrApronRows[x]++;
      }
    }
  }

  const minPersist = Math.max(3, Math.ceil(bandH * 0.56));
  const minDressEdge = Math.max(2, Math.ceil(bandH * 0.22));

  let bestL = -1;
  let bestR = -1;
  let bestScore = -1;
  let curL = -1;

  for (let x = 0; x <= width; x++) {
    const active = x < width && nonSkinRows[x] >= minPersist;
    if (active) {
      if (curL < 0) curL = x;
    } else if (curL >= 0) {
      let trimL = curL;
      let trimR = x - 1;
      while (trimL <= trimR && dressOrApronRows[trimL] < minDressEdge) trimL++;
      while (trimR >= trimL && dressOrApronRows[trimR] < minDressEdge) trimR--;

      if (trimR - trimL >= 4) {
        let dressSum = 0;
        for (let k = trimL; k <= trimR; k++) dressSum += dressOrApronRows[k];
        if (dressSum > bestScore) {
          bestScore = dressSum;
          bestL = trimL;
          bestR = trimR;
        }
      }
      curL = -1;
    }
  }

  if (bestL >= 0 && bestR >= bestL) {
    return Math.round((bestL + bestR) * 0.5);
  }

  // Fallback: overall dress/apron weighted X centroid in band
  let weightedSum = 0;
  let weightTotal = 0;
  for (let x = 0; x < width; x++) {
    const w = dressOrApronRows[x] * 3 + nonSkinRows[x];
    if (w > 0) {
      weightedSum += x * w;
      weightTotal += w;
    }
  }
  return Math.round(weightTotal > 4 ? weightedSum / weightTotal : width * 0.5);
}

export function resolveAriaAnimSample(
  player: PlayerEntity,
  gamePhase: GamePhase,
  time: number
): AriaAnimSample {
  if (gamePhase === GamePhase.Title) {
    return {
      clipId: 'idle',
      progress01: wrap01(time * 0.45),
      loop: true,
      handOffsetX: -4.2,
      handOffsetY: -16.4,
      ikBlend: 0,
    };
  }

  // 1. All 13 Distinct Combat Moves — High-Density 16-Slot Multi-Stage Choreography:
  //    [0.000..0.249] Slots [0..3]: entry -> entryCoilSub -> coil -> deepCoil
  //    [0.250..0.624] Slots [4..9]: coilToMidSmear -> midSwing -> midToPeakSmear -> lungedPeak -> peak -> overswing
  //    [0.625..1.000] Slots [10..15]: overToFollowSub -> follow -> followHoldSub -> guardSettle -> guardToNeutralSub -> neutralEnd
  if (player.moveId !== MoveId.None) {
    const spec = MOVES[player.moveId];
    const track = MOVE_HAND_TRACKS[player.moveId];
    const t = Math.max(0, player.moveTimer);
    const wEnd = Math.max(0.001, spec.windup);
    const aEnd = wEnd + Math.max(0.001, spec.active);
    const total = aEnd + Math.max(0.001, spec.recovery);

    let progress01 = 0;
    let hx = track.windupHand[0];
    let hy = track.windupHand[1];

    if (t < wEnd) {
      const u = clamp01(t / wEnd);
      // Slots [0..3]: 4-stage coiled anticipation
      progress01 = u * 0.249;
      hx = lerp(-2.4, track.windupHand[0], u);
      hy = lerp(-17.2, track.windupHand[1], u);
    } else if (t < aEnd) {
      const u = clamp01((t - wEnd) / Math.max(0.001, spec.active));
      // Slots [4..9]: mid-swing breakdown -> midSwing pose -> peak impact -> overswing extension!
      progress01 = 0.25 + u * 0.374;
      const snap = 0.87 * (1 - Math.pow(1 - u, 6.2)) + 0.13 * u;
      hx = lerp(track.windupHand[0], track.peakHand[0], snap);
      hy = lerp(track.windupHand[1], track.peakHand[1], snap);
    } else {
      const u = clamp01((t - aEnd) / Math.max(0.001, total - aEnd));
      // Slots [10..15]: overswing -> follow-through -> martial guard -> neutral poise!
      progress01 = 0.625 + u * 0.375;
      const settle = u * u * (3 - 2 * u);
      hx = lerp(track.peakHand[0], track.recoveryHand[0], settle);
      hy = lerp(track.peakHand[1], track.recoveryHand[1], settle);
    }

    return {
      clipId: track.clipId,
      progress01: clamp01(progress01),
      loop: false,
      handOffsetX: hx,
      handOffsetY: hy,
      ikBlend: track.ikBlend,
    };
  }

  // 2. Hitstun / Damage Recoil (dedicated wincing recoil stance + recovery in-betweens)
  if (player.hurtTimer > 0.08) {
    const progress01 = clamp01(1 - player.hurtTimer / 0.42);
    return {
      clipId: 'hurt',
      progress01,
      loop: false,
      handOffsetX: 0.8,
      handOffsetY: -19.8,
      ikBlend: 0,
    };
  }

  // 3. Zanshin Iaido Sheathe Stance (残心收刀 — triggers only during the 0.3s sheathe window after the 1.0s delay!)
  if (player.zanshinFlashTimer > 0 && Math.abs(player.vx) < 28 && player.grounded) {
    const progress01 = clamp01(1 - player.zanshinFlashTimer / ZANSHIN_GLINT_WINDOW);
    return {
      clipId: 'zanshin',
      progress01,
      loop: false,
      handOffsetX: 1.0,
      handOffsetY: -18.8,
      ikBlend: 0,
    };
  }

  // 4. Phantom Dash (瞬步闪影)
  if (player.isDashing) {
    const progress01 = clamp01(1 - player.dashTimer / Math.max(0.01, PLAYER_DASH_DURATION));
    return {
      clipId: 'dash',
      progress01,
      loop: false,
      handOffsetX: -3.4,
      handOffsetY: -15.0,
      ikBlend: 0,
    };
  }

  // 5. Wall Slide & Airborne Jump Phases (Rise -> Apex/Flip -> Fall)
  if (!player.grounded) {
    if (player.wallSlideSide !== 0 && player.vy > 0) {
      return {
        clipId: 'wall_slide',
        progress01: wrap01(time * 2.4),
        loop: true,
        handOffsetX: -2.4,
        handOffsetY: -19.0,
        ikBlend: 0,
      };
    }

    if (player.spinFlipTimer > 0 || Math.abs(player.vy) <= 88) {
      const progress01 =
        player.spinFlipTimer > 0
          ? clamp01(1 - player.spinFlipTimer / 0.28)
          : clamp01((player.vy + 88) / 176);
      return {
        clipId: 'jump_apex',
        progress01,
        loop: false,
        handOffsetX: -1.4,
        handOffsetY: -18.4,
        ikBlend: 0,
      };
    }

    if (player.vy < -88) {
      const progress01 = clamp01(1 - Math.min(1, Math.abs(player.vy + 88) / 255));
      return {
        clipId: 'jump_rise',
        progress01,
        loop: false,
        handOffsetX: -2.6,
        handOffsetY: -17.6,
        ikBlend: 0,
      };
    }

    const progress01 = clamp01((player.vy - 88) / 280);
    return {
      clipId: 'jump_fall',
      progress01,
      loop: false,
      handOffsetX: -3.0,
      handOffsetY: -18.2,
      ikBlend: 0,
    };
  }

  // 6. Crouch / Low Guard (One-shot entry transition -> rock-steady deep crouch hold, zero looping bounce!)
  if (player.crouching) {
    const cElapsed = player.crouchTimer ?? 0.2;
    const progress01 = clamp01(cElapsed / 0.10);
    return {
      clipId: 'crouch',
      progress01,
      loop: false,
      handOffsetX: lerp(1.6, 2.8, progress01),
      handOffsetY: lerp(-16.8, -12.2, progress01),
      ikBlend: 0,
    };
  }

  // 7. Sprint Skid / Turn-Brake
  if (player.skidTimer > 0.01) {
    const progress01 = clamp01(1 - player.skidTimer / 0.14);
    return {
      clipId: 'skid',
      progress01,
      loop: false,
      handOffsetX: -2.2,
      handOffsetY: -17.8,
      ikBlend: 0,
    };
  }

  // 8. Ground Landing Cushion Absorb
  if (player.landRecoveryTimer > 0.01 && Math.abs(player.vx) < 28) {
    const progress01 = clamp01(1 - player.landRecoveryTimer / 0.12);
    return {
      clipId: 'land',
      progress01,
      loop: false,
      handOffsetX: 1.8,
      handOffsetY: -15.8,
      ikBlend: 0,
    };
  }

  // 9. 16-Frame 2-Step Sprint Cycle (8 Hand-Drawn Keyframes + 8 Rigid Breakdown In-Betweens) synced to gaitPhase!
  if (Math.abs(player.vx) > 16) {
    const cycle01 = wrap01(player.gaitPhase / (Math.PI * 2));
    const strideWave = Math.sin(player.gaitPhase - 0.35);
    const doubleStep = Math.cos(player.gaitPhase * 2);
    return {
      clipId: 'run',
      progress01: cycle01,
      loop: true,
      handOffsetX: -0.4 + strideWave * 1.6,
      handOffsetY: -17.4 + doubleStep * 0.65,
      ikBlend: 0,
    };
  }

  // 10. Idle Breathing & Gentle Twin-Tail Settle
  return {
    clipId: 'idle',
    progress01: wrap01(time * 0.52),
    loop: true,
    handOffsetX: 1.2,
    handOffsetY: -17.2,
    ikBlend: 0,
  };
}

export function resolveEnemyAnimSample(e: EnemyEntity, time: number): EnemyAnimSample {
  if (e.aiState === EnemyAIState.Hitstun) {
    return {
      clipId: 'hitstun',
      progress01: clamp01(1 - e.stateTimer / 0.24),
      loop: false,
    };
  }
  if (e.aiState === EnemyAIState.Windup) {
    // stateTimer counts down during Windup in simulation
    return {
      clipId: 'windup',
      progress01: clamp01(1 - e.stateTimer / 0.46),
      loop: false,
    };
  }
  if (e.aiState === EnemyAIState.Attack) {
    return {
      clipId: 'attack',
      progress01: clamp01(1 - e.stateTimer / 0.28) * 0.68,
      loop: false,
    };
  }
  if (e.aiState === EnemyAIState.Recovery) {
    // Seamless follow-through & recovery tail of the attack clip [0.68 .. 1.00]!
    return {
      clipId: 'attack',
      progress01: 0.68 + clamp01(1 - e.stateTimer / 0.35) * 0.32,
      loop: false,
    };
  }
  if (Math.abs(e.vx) > 10) {
    return {
      clipId: 'walk',
      progress01: wrap01(e.gaitPhase / (Math.PI * 2)),
      loop: true,
    };
  }
  return {
    clipId: 'idle',
    progress01: wrap01(time * 0.55 + e.id * 0.17),
    loop: true,
  };
}
