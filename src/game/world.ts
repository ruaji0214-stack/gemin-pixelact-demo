import { ORDERED_ROOM_IDS, generateWorld, getStartingSpawn } from './mapGen';
import {
  MinimapRoomCell,
  PlatformRect,
  RelicId,
  RoomDef,
  RoomExit,
  RoomId,
} from './types';

export { generateWorld, getStartingSpawn } from './mapGen';

export const VIEWPORT_WIDTH = 480;
export const VIEWPORT_HEIGHT = 270;
export const PLAYER_HALF_W = 6;
export const PLAYER_HEIGHT = 32;

export const RELIC_METADATA: Record<
  RelicId,
  { nameZh: string; descZh: string; keyHint: string }
> = {
  [RelicId.DoubleJump]: {
    nameZh: '双月之羽',
    descZh: '解锁空中二段跳，提升 20 点生命上限，并触发赐福能力三选一。',
    keyHint: '空中再按 W',
  },
  [RelicId.AbyssalBreaker]: {
    nameZh: '裂空刻印',
    descZh: '重斩(L)/下劈(S+J)可击碎封印石壁，解锁二段空瞬，斩伤+15%，并触发赐福三选一。',
    keyHint: 'L / 空中 S+J 破封',
  },
  [RelicId.ZanshinTassel]: {
    nameZh: '残心剑穗',
    descZh: '收刀残心回能翻倍，终式与一闪迸发暴击剑气，并触发赐福三选一。',
    keyHint: '连段停顿自动收刀',
  },
};

export const BOSS_ROOM_IDS: ReadonlySet<RoomId> = new Set<RoomId>([
  'ossuary',
  'observatory',
  'throne',
]);

export const ALL_ROOM_IDS: RoomId[] = [...ORDERED_ROOM_IDS];

/**
 * Active 18-Room Cave Story / Dead Cells Connected-Domain Roguevania World.
 * Initialized with seed `77491` and regenerated per run via `applyGeneratedWorld(runSeed)`.
 */
export const ROOMS: Record<RoomId, RoomDef> = generateWorld(77491);

export function applyGeneratedWorld(seed: number): Record<RoomId, RoomDef> {
  const nextRooms = generateWorld(seed);
  for (const id of ALL_ROOM_IDS) {
    ROOMS[id] = nextRooms[id];
  }
  return ROOMS;
}

export function getActiveStartingSpawn(): { x: number; y: number } {
  return getStartingSpawn(ROOMS);
}

export interface ActorCollisionResult {
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  wallSlideSide: -1 | 0 | 1;
  touchedHazard: boolean;
}

/**
 * Pure AABB + One-Way Ledge + Seal Barrier + Wall-Slide Solver
 */
export function resolveRoomMovement(opts: {
  prevX: number;
  prevY: number;
  nextX: number;
  nextY: number;
  vx: number;
  vy: number;
  halfW: number;
  height: number;
  dropThrough: boolean;
  platforms: PlatformRect[];
  activeSeal?: { x: number; y: number; w: number; h: number } | null;
  lockedExitBarriers?: PlatformRect[];
}): ActorCollisionResult {
  let x = opts.nextX;
  let y = opts.nextY;
  let vx = opts.vx;
  let vy = opts.vy;
  let grounded = false;
  let wallSlideSide: -1 | 0 | 1 = 0;
  let touchedHazard = false;

  const solids: PlatformRect[] = [
    ...opts.platforms,
    ...(opts.activeSeal ? [{ ...opts.activeSeal }] : []),
    ...(opts.lockedExitBarriers ?? []),
  ];

  // 1. Horizontal Sweep against solid blocks (ignore oneWay ledges horizontally)
  for (const plat of solids) {
    if (plat.oneWay) continue;
    const actorTop = opts.prevY - opts.height + 2;
    const actorBot = opts.prevY - 2;
    if (actorBot <= plat.y || actorTop >= plat.y + plat.h) continue;

    if (x + opts.halfW > plat.x && x - opts.halfW < plat.x + plat.w) {
      if (plat.hazard) {
        touchedHazard = true;
      }
      if (opts.prevX <= plat.x) {
        x = plat.x - opts.halfW;
        if (vx > 0) vx = 0;
        if (plat.h >= 36) wallSlideSide = 1;
      } else if (opts.prevX >= plat.x + plat.w) {
        x = plat.x + plat.w + opts.halfW;
        if (vx < 0) vx = 0;
        if (plat.h >= 36) wallSlideSide = -1;
      }
    }
  }

  // 2. Vertical Sweep against solid blocks AND oneWay ledges (when falling & not dropping through)
  for (const plat of solids) {
    if (x + opts.halfW <= plat.x + 1 || x - opts.halfW >= plat.x + plat.w - 1) {
      continue;
    }

    if (plat.oneWay) {
      if (opts.dropThrough) continue;
      if (vy >= 0 && opts.prevY <= plat.y + 4 && y >= plat.y) {
        y = plat.y;
        vy = 0;
        grounded = true;
      }
      continue;
    }

    const actorTop = y - opts.height;
    const actorBot = y;
    if (actorBot > plat.y && actorTop < plat.y + plat.h) {
      if (plat.hazard) {
        touchedHazard = true;
      }
      if (vy >= 0 && opts.prevY <= plat.y + 6) {
        y = plat.y;
        vy = 0;
        grounded = true;
      } else if (vy < 0 && opts.prevY - opts.height >= plat.y + plat.h - 6) {
        y = plat.y + plat.h + opts.height;
        vy = 0;
      }
    }
  }

  if (grounded) {
    wallSlideSide = 0;
  }

  return { x, y, vx, vy, grounded, wallSlideSide, touchedHazard };
}

export function findTriggeredExit(
  x: number,
  y: number,
  height: number,
  exits: RoomExit[]
): RoomExit | null {
  const cy = y - height * 0.5;
  for (const ex of exits) {
    if (x >= ex.x && x <= ex.x + ex.w && cy >= ex.y && cy <= ex.y + ex.h) {
      return ex;
    }
  }
  return null;
}

export function buildMinimapSnapshot(
  currentRoomId: RoomId,
  visitedRooms: Set<RoomId>,
  collectedRelics: Set<RelicId>,
  brokenSeals: Set<string>,
  collectedAltars: Set<string> = new Set(),
  clearedRooms: Set<RoomId> = new Set(),
  currentRoomLocked = false
): MinimapRoomCell[] {
  return ALL_ROOM_IDS.map((id) => {
    const r = ROOMS[id];
    const isBoss = BOSS_ROOM_IDS.has(id);
    const sealSide: 'left' | 'right' | undefined = r.sealBarrier
      ? r.sealBarrier.x > r.width * 0.5
        ? 'right'
        : 'left'
      : undefined;
    return {
      id,
      nameZh: r.nameZh,
      zoneZh: r.zoneZh,
      theme: r.theme,
      gridX: r.gridX,
      gridY: r.gridY,
      widthCols: Math.round(r.width / 16),
      heightRows: Math.round(r.height / 16),
      roomLocked: id === currentRoomId ? currentRoomLocked : !clearedRooms.has(id) && r.enemies.length > 0,
      visited: visitedRooms.has(id),
      current: id === currentRoomId,
      hasShrine: Boolean(r.shrine),
      hasUncollectedRelic: Boolean(r.relic && !collectedRelics.has(r.relic.relicId)),
      hasUncollectedAltar: Boolean(r.altar && !collectedAltars.has(r.altar.id)),
      hasIntactSeal: Boolean(r.sealBarrier && !brokenSeals.has(r.sealBarrier.id)),
      sealSide,
      isBoss,
      bossCleared: isBoss && clearedRooms.has(id),
      connections: r.exits.map((e) => e.direction),
    };
  });
}
