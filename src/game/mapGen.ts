import {
  EnemyKind,
  EnemySpawnDef,
  PillarProp,
  PlatformRect,
  RelicId,
  RoomDef,
  RoomExit,
  RoomId,
  SealBarrier,
   TorchProp,
  WindowProp,
} from './types';

export const TILE_SIZE = 16;

const enum Tile {
  Air = 0,
  Solid = 1,
  OneWay = 2,
  Hazard = 3,
}

export type Direction = 'left' | 'right' | 'up' | 'down';

export type RoomTemplateId =
  | 'grotto_sanctuary'
  | 'terraced_cavern'
  | 'twin_deck_dungeon'
  | 'chimney_shaft'
  | 'sunken_arena'
  | 'chasm_bridges'
  | 'catacomb_warren'
  | 'boss_sanctum';

interface RoomBlueprint {
  id: RoomId;
  nameZh: string;
  zoneZh: string;
  theme: RoomDef['theme'];
  cluster: 'A' | 'B' | 'C' | 'D';
  isBoss?: boolean;
  bossKind?: EnemyKind;
  templates: RoomTemplateId[];
  shrine?: { id: string; nameZh: string };
  relic?: { relicId: RelicId; nameZh: string; subtitleZh: string };
  vessel?: { id: string; nameZh: string; bonusHp: number };
  altar?: { id: string; nameZh: string };
  enemyCount: [number, number];
  eliteChance: number;
  enemyPool: EnemyKind[];
}

const OPPOSITE_DIR: Record<Direction, Direction> = {
  left: 'right',
  right: 'left',
  up: 'down',
  down: 'up',
};

const DIR_OFFSET: Record<Direction, { dx: number; dy: number }> = {
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
};

const ROOM_BLUEPRINTS: Record<RoomId, RoomBlueprint> = {
  // Cluster A — Early Cavern Grotto (Cave Story Mimiga / First Cave feel)
  cloister: {
    id: 'cloister',
    nameZh: '月光石窟',
    zoneZh: '苍月岩窟',
    theme: 'moonlit',
    cluster: 'A',
    templates: ['grotto_sanctuary'],
    shrine: { id: 'shrine_cloister', nameZh: '银月祭坛 · 启程石窟' },
    altar: { id: 'altar_cloister', nameZh: '赐福卷轴台 · 启程之赐' },
    enemyCount: [3, 4],
    eliteChance: 0,
    enemyPool: [EnemyKind.Stalker, EnemyKind.Weaver, EnemyKind.Arbalist],
  },
  grotto_spring: {
    id: 'grotto_spring',
    nameZh: '荧光泉窟',
    zoneZh: '苍月岩窟',
    theme: 'moonlit',
    cluster: 'A',
    templates: ['terraced_cavern', 'sunken_arena'],
    altar: { id: 'altar_grotto_spring', nameZh: '赐福卷轴台 · 荧光泉眼' },
    enemyCount: [4, 5],
    eliteChance: 0.2,
    enemyPool: [EnemyKind.Stalker, EnemyKind.Weaver, EnemyKind.Arbalist],
  },
  west_rampart: {
    id: 'west_rampart',
    nameZh: '断壁岩窟',
    zoneZh: '苍月岩窟',
    theme: 'moonlit',
    cluster: 'A',
    templates: ['chasm_bridges', 'terraced_cavern'],
    vessel: { id: 'vessel_west_rampart', nameZh: '古月圣杯', bonusHp: 25 },
    altar: { id: 'altar_west_rampart', nameZh: '赐福卷轴台 · 断壁遗龛' },
    enemyCount: [4, 5],
    eliteChance: 0.25,
    enemyPool: [EnemyKind.Stalker, EnemyKind.Weaver, EnemyKind.Arbalist, EnemyKind.Reaper],
  },
  armory: {
    id: 'armory',
    nameZh: '沉没军械窟',
    zoneZh: '苍月岩窟',
    theme: 'moonlit',
    cluster: 'A',
    templates: ['twin_deck_dungeon', 'sunken_arena'],
    altar: { id: 'altar_armory', nameZh: '赐福卷轴台 · 军械秘匣' },
    enemyCount: [5, 5],
    eliteChance: 0.25,
    enemyPool: [EnemyKind.Halberdier, EnemyKind.Arbalist, EnemyKind.Stalker, EnemyKind.Reaper, EnemyKind.Weaver],
  },
  courtyard: {
    id: 'courtyard',
    nameZh: '断罪十字枢',
    zoneZh: '中枢岩堂',
    theme: 'moonlit',
    cluster: 'A',
    templates: ['twin_deck_dungeon', 'terraced_cavern', 'sunken_arena'],
    enemyCount: [5, 6],
    eliteChance: 0.28,
    enemyPool: [EnemyKind.Stalker, EnemyKind.Arbalist, EnemyKind.Reaper, EnemyKind.Halberdier, EnemyKind.Weaver],
  },

  // Cluster B — Pre-Seal Spire & Archive (Dead Cells Ramparts / Clock Tower feel)
  belltower: {
    id: 'belltower',
    nameZh: '残钟竖井',
    zoneZh: '星月尖塔',
    theme: 'tower',
    cluster: 'B',
    templates: ['chimney_shaft'],
    relic: {
      relicId: RelicId.DoubleJump,
      nameZh: '双月之羽',
      subtitleZh: '习得【二段跳】· 生命上限 +20 · 开启赐福三选一',
    },
    enemyCount: [4, 5],
    eliteChance: 0.28,
    enemyPool: [EnemyKind.Stalker, EnemyKind.Arbalist, EnemyKind.Weaver, EnemyKind.Reaper],
  },
  clockwork_loft: {
    id: 'clockwork_loft',
    nameZh: '机巧齿轮廊',
    zoneZh: '星月尖塔',
    theme: 'tower',
    cluster: 'B',
    templates: ['twin_deck_dungeon', 'chasm_bridges'],
    altar: { id: 'altar_clockwork_loft', nameZh: '赐福卷轴台 · 钟楼秘阁' },
    enemyCount: [4, 5],
    eliteChance: 0.3,
    enemyPool: [EnemyKind.Arbalist, EnemyKind.Stalker, EnemyKind.Weaver, EnemyKind.Reaper, EnemyKind.Halberdier],
  },
  sky_bridge: {
    id: 'sky_bridge',
    nameZh: '裂风悬桥',
    zoneZh: '星月尖塔',
    theme: 'tower',
    cluster: 'B',
    templates: ['chasm_bridges', 'chimney_shaft'],
    vessel: { id: 'vessel_sky_bridge', nameZh: '古月圣杯', bonusHp: 25 },
    enemyCount: [4, 5],
    eliteChance: 0.32,
    enemyPool: [EnemyKind.Arbalist, EnemyKind.Weaver, EnemyKind.Reaper, EnemyKind.Halberdier],
  },
  archive: {
    id: 'archive',
    nameZh: '星象秘库',
    zoneZh: '星月尖塔',
    theme: 'archive',
    cluster: 'B',
    templates: ['twin_deck_dungeon', 'sunken_arena'],
    shrine: { id: 'shrine_archive', nameZh: '银月祭坛 · 星象秘库' },
    relic: {
      relicId: RelicId.AbyssalBreaker,
      nameZh: '裂空刻印',
      subtitleZh: '重斩/下劈可击碎紫色封印石壁 · 解锁二段空瞬 · 开启赐福三选一',
    },
    enemyCount: [4, 5],
    eliteChance: 0.32,
    enemyPool: [EnemyKind.Halberdier, EnemyKind.Arbalist, EnemyKind.Weaver, EnemyKind.Reaper, EnemyKind.Stalker],
  },
  observatory: {
    id: 'observatory',
    nameZh: '星穹观星殿',
    zoneZh: '星月尖塔 · 首领圣殿',
    theme: 'archive',
    cluster: 'B',
    isBoss: true,
    bossKind: EnemyKind.Archon,
    templates: ['boss_sanctum'],
    enemyCount: [2, 2],
    eliteChance: 0,
    enemyPool: [EnemyKind.Weaver],
  },

  // Cluster C — Subterranean Waterway & Ossuary (Cave Story Labyrinth / Dead Cells Sewers & Ossuary)
  reliquary: {
    id: 'reliquary',
    nameZh: '地脉圣物窟',
    zoneZh: '幽邃地脉',
    theme: 'crypt',
    cluster: 'C',
    templates: ['catacomb_warren', 'sunken_arena', 'terraced_cavern'],
    vessel: { id: 'vessel_reliquary', nameZh: '古月圣杯', bonusHp: 25 },
    enemyCount: [4, 5],
    eliteChance: 0.28,
    enemyPool: [EnemyKind.Stalker, EnemyKind.Arbalist, EnemyKind.Weaver, EnemyKind.Halberdier],
  },
  catacombs: {
    id: 'catacombs',
    nameZh: '幽邃墓道',
    zoneZh: '幽邃地脉',
    theme: 'crypt',
    cluster: 'C',
    templates: ['catacomb_warren', 'twin_deck_dungeon'],
    relic: {
      relicId: RelicId.ZanshinTassel,
      nameZh: '残心剑穗',
      subtitleZh: '收刀残心双倍回能 · 终式附带暴击剑气 · 开启赐福三选一',
    },
    enemyCount: [4, 5],
    eliteChance: 0.34,
    enemyPool: [EnemyKind.Stalker, EnemyKind.Reaper, EnemyKind.Weaver, EnemyKind.Halberdier, EnemyKind.Arbalist],
  },
  prison_depths: {
    id: 'prison_depths',
    nameZh: '黑曜死牢',
    zoneZh: '幽邃地脉',
    theme: 'crypt',
    cluster: 'C',
    templates: ['twin_deck_dungeon', 'catacomb_warren'],
    shrine: { id: 'shrine_prison', nameZh: '银月祭坛 · 黑曜死牢' },
    altar: { id: 'altar_prison_depths', nameZh: '赐福卷轴台 · 死牢秘卷' },
    enemyCount: [4, 5],
    eliteChance: 0.35,
    enemyPool: [EnemyKind.Reaper, EnemyKind.Arbalist, EnemyKind.Halberdier, EnemyKind.Stalker, EnemyKind.Weaver],
  },
  fungal_pit: {
    id: 'fungal_pit',
    nameZh: '冥菌晶窟',
    zoneZh: '幽邃地脉',
    theme: 'crypt',
    cluster: 'C',
    templates: ['chasm_bridges', 'terraced_cavern', 'catacomb_warren'],
    vessel: { id: 'vessel_fungal_pit', nameZh: '古月圣杯', bonusHp: 25 },
    altar: { id: 'altar_fungal_pit', nameZh: '赐福卷轴台 · 冥菌祭台' },
    enemyCount: [4, 5],
    eliteChance: 0.38,
    enemyPool: [EnemyKind.Reaper, EnemyKind.Arbalist, EnemyKind.Weaver, EnemyKind.Halberdier, EnemyKind.Stalker],
  },
  ossuary: {
    id: 'ossuary',
    nameZh: '骸骨深渊殿',
    zoneZh: '幽邃地脉 · 首领圣殿',
    theme: 'crypt',
    cluster: 'C',
    isBoss: true,
    bossKind: EnemyKind.Warden,
    templates: ['boss_sanctum'],
    enemyCount: [2, 2],
    eliteChance: 0,
    enemyPool: [EnemyKind.Stalker],
  },

  // Cluster D — Sealed Crimson Sanctum (Bloodstained / Dead Cells High Peak Castle)
  antechamber: {
    id: 'antechamber',
    nameZh: '绯月封印厅',
    zoneZh: '绯月圣殿',
    theme: 'throne',
    cluster: 'D',
    templates: ['twin_deck_dungeon', 'sunken_arena'],
    shrine: { id: 'shrine_antechamber', nameZh: '银月祭坛 · 绯月封印厅' },
    enemyCount: [4, 5],
    eliteChance: 0.38,
    enemyPool: [EnemyKind.Stalker, EnemyKind.Arbalist, EnemyKind.Reaper, EnemyKind.Halberdier],
  },
  forbidden_wing: {
    id: 'forbidden_wing',
    nameZh: '血月禁卫廊',
    zoneZh: '绯月圣殿',
    theme: 'throne',
    cluster: 'D',
    templates: ['chasm_bridges', 'twin_deck_dungeon'],
    altar: { id: 'altar_forbidden_wing', nameZh: '赐福卷轴台 · 决战圣卷' },
    enemyCount: [5, 6],
    eliteChance: 0.45,
    enemyPool: [EnemyKind.Halberdier, EnemyKind.Reaper, EnemyKind.Arbalist, EnemyKind.Weaver, EnemyKind.Stalker],
  },
  throne: {
    id: 'throne',
    nameZh: '绯月王座',
    zoneZh: '绯月圣殿 · 终焉圣殿',
    theme: 'throne',
    cluster: 'D',
    isBoss: true,
    bossKind: EnemyKind.Sovereign,
    templates: ['boss_sanctum'],
    enemyCount: [1, 1],
    eliteChance: 0,
    enemyPool: [],
  },
};

export const ORDERED_ROOM_IDS: RoomId[] = Object.keys(ROOM_BLUEPRINTS) as RoomId[];

export function mulberry32(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function shuffle<T>(rng: () => number, arr: readonly T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export interface MacroRoomNode {
  id: RoomId;
  gridX: number;
  gridY: number;
  links: Partial<Record<Direction, RoomId>>;
  sealSide?: 'left' | 'right';
}

/**
 * Stage 1: Connected-Domain Orthogonal Graph Generator (Cave Story / Dead Cells Roguevania Topology)
 * Places all 18 rooms into a single connected orthogonal grid domain with:
 * - Progression-safe Relic reachability (`DoubleJump` & `AbyssalBreaker` always reachable before `seal_courtyard_east`)
 * - Dedicated 1-entrance horizontal Boss Sanctums (`observatory`, `ossuary`, `throne`)
 * - Dead Cells loop-back shortcut connections within the pre-seal cavern/spire/crypt network
 */
export function generateConnectedGraph(seed: number): Record<RoomId, MacroRoomNode> {
  for (let attempt = 0; attempt < 64; attempt++) {
    const rng = mulberry32((seed + Math.imul(attempt + 1, 2654435761)) >>> 0);
    const nodes: Partial<Record<RoomId, MacroRoomNode>> = {};
    const occupied = new Map<string, RoomId>();

    const place = (id: RoomId, gx: number, gy: number): MacroRoomNode => {
      const node: MacroRoomNode = { id, gridX: gx, gridY: gy, links: {} };
      nodes[id] = node;
      occupied.set(`${gx},${gy}`, id);
      return node;
    };

    const connect = (a: RoomId, dir: Direction, b: RoomId): void => {
      nodes[a]!.links[dir] = b;
      nodes[b]!.links[OPPOSITE_DIR[dir]] = a;
    };

    const tryAttach = (
      newId: RoomId,
      candidates: RoomId[],
      preferredDirs: Direction[]
    ): { from: RoomId; dir: Direction } | null => {
      const shuffledParents = shuffle(rng, candidates);
      for (const parentId of shuffledParents) {
        const p = nodes[parentId];
        if (!p) continue;
        // Weight preferred directions first, then remaining directions if needed
        const dirs = shuffle(rng, preferredDirs);
        for (const dir of dirs) {
          const nx = p.gridX + DIR_OFFSET[dir].dx;
          const ny = p.gridY + DIR_OFFSET[dir].dy;
          const key = `${nx},${ny}`;
          if (!occupied.has(key)) {
            place(newId, nx, ny);
            connect(parentId, dir, newId);
            return { from: parentId, dir };
          }
        }
      }
      return null;
    };

    // 1. Seed starting cavern grotto `cloister` at (0,0)
    place('cloister', 0, 0);

    // 2. Grow Cluster A (Early Cavern Grotto) around `cloister`
    const clusterAPlaced: RoomId[] = ['cloister'];
    const clusterAOrder = shuffle(rng, [
      'grotto_spring',
      'west_rampart',
      'armory',
      'courtyard',
    ] as RoomId[]);
    let failed = false;
    for (const rid of clusterAOrder) {
      const dirs: Direction[] =
        rid === 'armory'
          ? ['down', 'left', 'right']
          : rid === 'courtyard'
            ? ['right', 'left', 'up']
            : ['left', 'right', 'down', 'up'];
      if (!tryAttach(rid, clusterAPlaced, dirs)) {
        failed = true;
        break;
      }
      clusterAPlaced.push(rid);
    }
    if (failed) continue;

    // 3. Grow Cluster B (Spire & Archive — `DoubleJump` + `AbyssalBreaker` + Boss `Archon`)
    const spireAnchors: RoomId[] = ['courtyard', 'cloister', 'grotto_spring', 'west_rampart'];
    if (!tryAttach('belltower', spireAnchors, ['up', 'right', 'left'])) continue;
    const clusterBPlaced: RoomId[] = ['belltower'];
    for (const rid of shuffle(rng, ['clockwork_loft', 'sky_bridge', 'archive'] as RoomId[])) {
      if (!tryAttach(rid, clusterBPlaced, ['up', 'right', 'left'])) {
        failed = true;
        break;
      }
      clusterBPlaced.push(rid);
    }
    if (failed) continue;

    // Attach Boss 2 `observatory` strictly horizontally (1 entrance) from `archive` or `sky_bridge`
    if (!tryAttach('observatory', ['archive', 'sky_bridge', 'clockwork_loft'], ['right', 'left'])) {
      continue;
    }

    // 4. Grow Cluster C (Subterranean Crypt & Waterway — `ZanshinTassel` + Boss `Warden`)
    const cryptAnchors: RoomId[] = ['armory', 'courtyard', 'cloister', 'grotto_spring'];
    if (!tryAttach('reliquary', cryptAnchors, ['down', 'right', 'left'])) continue;
    const clusterCPlaced: RoomId[] = ['reliquary'];
    for (const rid of shuffle(rng, ['catacombs', 'prison_depths', 'fungal_pit'] as RoomId[])) {
      if (!tryAttach(rid, clusterCPlaced, ['down', 'right', 'left'])) {
        failed = true;
        break;
      }
      clusterCPlaced.push(rid);
    }
    if (failed) continue;

    // Attach Boss 1 `ossuary` strictly horizontally (1 entrance) from `prison_depths` or `catacombs`
    if (!tryAttach('ossuary', ['prison_depths', 'catacombs', 'fungal_pit'], ['right', 'left'])) {
      continue;
    }

    // 5. Attach Sealed Cluster D (`antechamber` -> `forbidden_wing` -> Boss 3 `throne`)
    // `antechamber` MUST attach horizontally (`left` or `right`) so `sealBarrier` stands across a side doorway!
    const sealFrontier: RoomId[] = [
      'courtyard',
      'archive',
      'catacombs',
      'fungal_pit',
      'sky_bridge',
      'grotto_spring',
    ];
    const sealLink = tryAttach('antechamber', sealFrontier, ['right', 'left']);
    if (!sealLink) continue;

    // Mark horizontal seal sides on both the frontier gate room and `antechamber`
    const gateDir = sealLink.dir as 'left' | 'right';
    nodes[sealLink.from]!.sealSide = gateDir;
    nodes['antechamber']!.sealSide = OPPOSITE_DIR[gateDir] as 'left' | 'right';

    if (!tryAttach('forbidden_wing', ['antechamber'], ['right', 'left', 'up', 'down'])) continue;
    if (!tryAttach('throne', ['forbidden_wing'], ['right', 'left'])) continue;

    // Verify compact grid span so Minimap stays crisp and readable (max 8x6)
    let minGX = Infinity;
    let maxGX = -Infinity;
    let minGY = Infinity;
    let maxGY = -Infinity;
    for (const id of ORDERED_ROOM_IDS) {
      const n = nodes[id];
      if (!n) {
        failed = true;
        break;
      }
      if (n.gridX < minGX) minGX = n.gridX;
      if (n.gridX > maxGX) maxGX = n.gridX;
      if (n.gridY < minGY) minGY = n.gridY;
      if (n.gridY > maxGY) maxGY = n.gridY;
    }
    if (failed || maxGX - minGX > 7 || maxGY - minGY > 5) continue;

    // 6. Carve 2..4 Dead Cells Loop-Back Shortcut Doors between adjacent pre-seal rooms (Clusters A/B/C, non-Boss)
    const preSealRooms = ORDERED_ROOM_IDS.filter((id) => {
      const bp = ROOM_BLUEPRINTS[id];
      return bp.cluster !== 'D' && !bp.isBoss;
    });
    const loopCandidates: Array<{ a: RoomId; dir: Direction; b: RoomId }> = [];
    for (const a of preSealRooms) {
      const na = nodes[a]!;
      for (const dir of ['right', 'down'] as Direction[]) {
        if (na.links[dir]) continue;
        const nbId = occupied.get(`${na.gridX + DIR_OFFSET[dir].dx},${na.gridY + DIR_OFFSET[dir].dy}`);
        if (!nbId) continue;
        const bpB = ROOM_BLUEPRINTS[nbId];
        if (bpB.cluster === 'D' || bpB.isBoss) continue;
        loopCandidates.push({ a, dir, b: nbId });
      }
    }
    const targetLoops = Math.min(loopCandidates.length, randInt(rng, 2, 4));
    const chosenLoops = shuffle(rng, loopCandidates).slice(0, targetLoops);
    for (const lp of chosenLoops) {
      connect(lp.a, lp.dir, lp.b);
    }

    // 7. Normalize grid coordinates to start cleanly at (0, 0)
    for (const id of ORDERED_ROOM_IDS) {
      const n = nodes[id]!;
      n.gridX -= minGX;
      n.gridY -= minGY;
    }

    return nodes as Record<RoomId, MacroRoomNode>;
  }

  // Deterministic fallback seed if all attempts exceeded compact bounds
  return generateConnectedGraph(77491);
}

interface BuiltRoomIntermediate {
  id: RoomId;
  blueprint: RoomBlueprint;
  node: MacroRoomNode;
  templateId: RoomTemplateId;
  cols: number;
  rows: number;
  grid: Tile[][];
  leftDoorFloorTy: number;
  rightDoorFloorTy: number;
  upShaftTx: number;
  downShaftTx: number;
  sealBarrier?: SealBarrier;
}

function createGrid(cols: number, rows: number, fill: Tile = Tile.Air): Tile[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => fill));
}

function fillTiles(
  grid: Tile[][],
  tx0: number,
  ty0: number,
  w: number,
  h: number,
  tile: Tile
): void {
  const rows = grid.length;
  const cols = grid[0].length;
  const xEnd = Math.min(cols, tx0 + w);
  const yEnd = Math.min(rows, ty0 + h);
  for (let ty = Math.max(0, ty0); ty < yEnd; ty++) {
    for (let tx = Math.max(0, tx0); tx < xEnd; tx++) {
      grid[ty][tx] = tile;
    }
  }
}

/**
 * Carves Cave Story / Dead Cells natural cavern ceiling stalactites & stepped stone ribs
 * along `ty = 2..3` without blocking `up` shafts.
 */
function decorateCavernCeiling(
  grid: Tile[][],
  rng: () => number,
  cols: number,
  intensity: 'light' | 'medium' | 'heavy'
): void {
  const step = intensity === 'heavy' ? 6 : intensity === 'medium' ? 8 : 11;
  for (let tx = 5; tx < cols - 7; tx += step + randInt(rng, 0, 3)) {
    const w = randInt(rng, 2, 4);
    fillTiles(grid, tx, 2, w, 1, Tile.Solid);
    if (intensity !== 'light' && rng() < 0.65 && w >= 3) {
      fillTiles(grid, tx + 1, 3, w - 2, 1, Tile.Solid);
    }
  }
}

/**
 * Stage 2A: Build 16px Tile-Grid Interior from Room Archetype Template + Seeded Sub-Chunk Variations
 */
function buildRoomTileGrid(
  bp: RoomBlueprint,
  node: MacroRoomNode,
  rng: () => number
): BuiltRoomIntermediate {
  const templateId = pick(rng, bp.templates);
  const hasLeft = Boolean(node.links.left);
  const hasRight = Boolean(node.links.right);
  const hasUp = Boolean(node.links.up);
  const hasDown = Boolean(node.links.down);

  let cols = 46;
  let rows = 19;

  switch (templateId) {
    case 'grotto_sanctuary':
      // Compact Sanctuary Grotto (`544x288` .. `608x288`)
      cols = randInt(rng, 34, 38);
      rows = 18;
      break;
    case 'terraced_cavern':
      // Expansive Underground Cavern Gallery (`864x304` .. `1024x352`)
      cols = randInt(rng, 54, 64);
      rows = randInt(rng, 19, 22);
      break;
    case 'twin_deck_dungeon':
      // Multi-Scale Two-Story Dungeon (`704x336` .. `1056x384`)
      cols = rng() < 0.5 ? randInt(rng, 44, 50) : randInt(rng, 58, 66);
      rows = randInt(rng, 21, 24);
      break;
    case 'chimney_shaft':
      // Tall Vertical Tower Shaft (`576x448` .. `672x544`)
      cols = randInt(rng, 36, 42);
      rows = randInt(rng, 28, 34);
      break;
    case 'sunken_arena':
      // Compact Alcove Basin OR Standard Sunken Arena
      if (rng() < 0.45) {
        cols = randInt(rng, 36, 40);
        rows = 18;
      } else {
        cols = randInt(rng, 46, 52);
        rows = randInt(rng, 20, 22);
      }
      break;
    case 'chasm_bridges':
      // Grand Wide Chasm Promenade (`928x304` .. `1088x368`)
      cols = randInt(rng, 58, 68);
      rows = randInt(rng, 19, 23);
      break;
    case 'catacomb_warren':
      // Standard Subterranean Catacomb Warren (`704x320` .. `832x368`)
      cols = randInt(rng, 44, 52);
      rows = randInt(rng, 20, 23);
      break;
    case 'boss_sanctum':
      // Monumental Vaulted Boss Sanctum (`864x320` .. `992x352`)
      cols = bp.id === 'throne' ? 62 : randInt(rng, 54, 60);
      rows = randInt(rng, 20, 22);
      break;
  }

  const grid = createGrid(cols, rows, Tile.Air);
  const baseFloorTy = rows - 2;

  // 1. Solid Enclosed Cavern / Castle Shell (`2` tiles = `32px` thick)
  fillTiles(grid, 0, 0, cols, 2, Tile.Solid); // Ceiling
  fillTiles(grid, 0, baseFloorTy, cols, 2, Tile.Solid); // Bedrock floor
  fillTiles(grid, 0, 0, 2, rows, Tile.Solid); // Left outer wall
  fillTiles(grid, cols - 2, 0, 2, rows, Tile.Solid); // Right outer wall

  let leftDoorFloorTy = baseFloorTy;
  let rightDoorFloorTy = baseFloorTy;

  // 2. Apply Archetype Template + Seeded Sub-Chunk Terrain Variations
  if (templateId === 'grotto_sanctuary') {
    // Compact Starting Grotto: gentle stepped stone ledges, upper sanctuary balcony, calm ceiling outcrops
    decorateCavernCeiling(grid, rng, cols, 'light');
    const stepStart = randInt(rng, Math.floor(cols * 0.52), Math.floor(cols * 0.6));
    fillTiles(grid, stepStart, baseFloorTy - 1, Math.max(4, cols - 8 - stepStart), 1, Tile.Solid);
    // Upper one-way grotto ledges (`32px` vertical steps — 100% single-jumpable)
    fillTiles(grid, 8, baseFloorTy - 3, 6, 1, Tile.OneWay);
    fillTiles(grid, Math.floor(cols * 0.44), baseFloorTy - 5, 7, 1, Tile.OneWay);
    fillTiles(grid, cols - 13, baseFloorTy - 3, 6, 1, Tile.OneWay);
  } else if (templateId === 'terraced_cavern') {
    // Cave Story Stepped Underground Cavern: 3 procedural stone terraces + stalactites + optional spike trench
    decorateCavernCeiling(grid, rng, cols, 'heavy');
    const segW = Math.floor((cols - 16) / 3);
    const heights = shuffle(rng, [0, 1, 2]);
    for (let s = 0; s < 3; s++) {
      const sx = 8 + s * segW;
      const h = heights[s];
      if (h > 0) {
        fillTiles(grid, sx, baseFloorTy - h, segW - 1, h, Tile.Solid);
      }
      // Mid-air catwalk above each cavern sub-chunk
      const ledgeTy = baseFloorTy - h - randInt(rng, 3, 4);
      if (ledgeTy >= 6) {
        fillTiles(grid, sx + 1, ledgeTy, Math.max(5, segW - 4), 1, Tile.OneWay);
      }
    }
    // Optional crystal-spike pocket bridged by a OneWay grate in middle chunk
    if (rng() < 0.55 && cols >= 44) {
      const hx = randInt(rng, 17, cols - 23);
      fillTiles(grid, hx, baseFloorTy - 2, 5, 3, Tile.Air);
      fillTiles(grid, hx, baseFloorTy + 1, 5, 1, Tile.Hazard);
      fillTiles(grid, hx - 1, baseFloorTy - 3, 7, 1, Tile.OneWay);
    }
  } else if (templateId === 'twin_deck_dungeon') {
    // Dead Cells Signature Two-Story Dungeon Deck:
    decorateCavernCeiling(grid, rng, cols, 'medium');
    const deckTy = baseFloorTy - 6; // 6 tiles (96px) above lower floor -> 64px clear headroom in lower corridor!
    fillTiles(grid, 6, deckTy, cols - 12, 2, Tile.Solid);

    // Carve 2..3 wide vertical hatch wells through the solid deck so player can ascend/descend anywhere
    const hatch1Tx = randInt(rng, 10, 15);
    const hatch2Tx = randInt(rng, cols - 20, cols - 15);
    const hatches = cols >= 58 ? [hatch1Tx, Math.floor(cols * 0.5) - 3, hatch2Tx] : [hatch1Tx, hatch2Tx];
    for (const htx of hatches) {
      fillTiles(grid, htx, deckTy, 6, 2, Tile.Air);
      fillTiles(grid, htx, deckTy, 6, 1, Tile.OneWay);
      fillTiles(grid, htx, deckTy + 2, 6, 1, Tile.OneWay);
      fillTiles(grid, htx, deckTy + 4, 6, 1, Tile.OneWay);
    }

    if (rng() < 0.65 && cols < 58) {
      const midTx = Math.floor(cols * 0.5);
      fillTiles(grid, midTx - 1, deckTy - 4, 2, 4, Tile.Solid);
      fillTiles(grid, midTx - 5, deckTy - 3, 4, 1, Tile.OneWay);
      fillTiles(grid, midTx + 1, deckTy - 3, 4, 1, Tile.OneWay);
    } else {
      fillTiles(grid, Math.floor(cols * 0.5) - 5, deckTy - 3, 10, 1, Tile.OneWay);
    }

    if (hasRight && node.sealSide !== 'right' && rng() < 0.45) {
      rightDoorFloorTy = deckTy;
      fillTiles(grid, cols - 8, deckTy, 8, 2, Tile.Solid);
    }
  } else if (templateId === 'chimney_shaft') {
    // Tall Vertical Tower Shaft (`rows = 28..34`, `cols = 36..42`):
    decorateCavernCeiling(grid, rng, cols, 'medium');
    const highTy = 8;
    fillTiles(grid, 2, highTy, 9, 2, Tile.Solid);
    fillTiles(grid, cols - 11, highTy + 2, 9, 2, Tile.Solid);

    // Central gothic masonry buttress column spanning the tall tower height
    const colTx = Math.floor(cols * 0.5) - 1;
    fillTiles(grid, colTx, 9, 2, Math.max(7, rows - 16), Tile.Solid);

    // Guaranteed 2-tile (`32px`) vertical step-ladder of alternating OneWay balconies all the way up!
    for (let ty = baseFloorTy - 2, stepIdx = 0; ty >= highTy; ty -= 2, stepIdx++) {
      const leftSide = stepIdx % 2 === 0;
      const lx = leftSide ? 8 : colTx + 3;
      const rx = leftSide ? Math.max(7, colTx - 7) : cols - 14;
      fillTiles(grid, lx, ty, 6, 1, Tile.OneWay);
      fillTiles(grid, rx, ty, 6, 1, Tile.OneWay);
    }
  } else if (templateId === 'sunken_arena') {
    // Sunken Cavern Basin (`cols = 36..40` compact OR `46..52` standard)
    decorateCavernCeiling(grid, rng, cols, 'medium');
    if (node.sealSide !== 'left') {
      leftDoorFloorTy = baseFloorTy - 2;
      fillTiles(grid, 2, baseFloorTy - 2, 9, 2, Tile.Solid);
      fillTiles(grid, 11, baseFloorTy - 1, 3, 1, Tile.Solid);
    }
    if (node.sealSide !== 'right') {
      rightDoorFloorTy = baseFloorTy - 2;
      fillTiles(grid, cols - 11, baseFloorTy - 2, 9, 2, Tile.Solid);
      fillTiles(grid, cols - 14, baseFloorTy - 1, 3, 1, Tile.Solid);
    }
    const mid = Math.floor(cols * 0.5);
    const wingW = cols <= 40 ? 7 : 8;
    fillTiles(grid, mid - wingW - 3, baseFloorTy - 3, wingW, 1, Tile.OneWay);
    fillTiles(grid, mid + 3, baseFloorTy - 3, wingW, 1, Tile.OneWay);
    fillTiles(grid, mid - 4, baseFloorTy - 6, 8, 1, Tile.OneWay);
  } else if (templateId === 'chasm_bridges') {
    // Wide Chasm Bridges (`cols = 58..68`): 3 recessed crystal-spike trenches spanned by suspension grates
    decorateCavernCeiling(grid, rng, cols, 'heavy');
    const pitPositions =
      cols >= 60
        ? [randInt(rng, 12, 16), Math.floor(cols * 0.5) - 3, randInt(rng, cols - 21, cols - 17)]
        : [randInt(rng, 12, 16), randInt(rng, cols - 22, cols - 18)];
    for (const px of pitPositions) {
      fillTiles(grid, px, baseFloorTy, 6, 1, Tile.Air);
      fillTiles(grid, px, baseFloorTy + 1, 6, 1, Tile.Hazard);
      fillTiles(grid, px - 1, baseFloorTy - 2, 8, 1, Tile.OneWay);
      fillTiles(grid, px, baseFloorTy - 5, 6, 1, Tile.OneWay);
    }
    const pier1Tx = Math.floor(cols * 0.34) - 3;
    const pier2Tx = Math.floor(cols * 0.66) - 3;
    for (const ptx of cols >= 60 ? [pier1Tx, pier2Tx] : [Math.floor(cols * 0.5) - 4]) {
      fillTiles(grid, ptx, baseFloorTy - 2, 7, 2, Tile.Solid);
      fillTiles(grid, ptx + 1, baseFloorTy - 5, 5, 1, Tile.OneWay);
    }
  } else if (templateId === 'catacomb_warren') {
    // Subterranean Catacomb Tunnels
    decorateCavernCeiling(grid, rng, cols, 'heavy');
    const ribTy = baseFloorTy - 5;
    fillTiles(grid, 7, ribTy, 11, 2, Tile.Solid);
    fillTiles(grid, cols - 18, ribTy, 11, 2, Tile.Solid);

    const centerTx = Math.floor(cols * 0.5) - 4;
    fillTiles(grid, centerTx, baseFloorTy - 2, 8, 1, Tile.OneWay);
    fillTiles(grid, centerTx, baseFloorTy - 4, 8, 1, Tile.OneWay);
    fillTiles(grid, centerTx + 1, ribTy - 2, 6, 1, Tile.OneWay);
  } else {
    // `boss_sanctum`: Monumental Vaulted Cathedral Arena (`cols = 54..62`)
    decorateCavernCeiling(grid, rng, cols, 'light');
    fillTiles(grid, 9, baseFloorTy - 4, 8, 1, Tile.OneWay);
    fillTiles(grid, Math.floor(cols * 0.36) - 4, baseFloorTy - 6, 8, 1, Tile.OneWay);
    fillTiles(grid, Math.floor(cols * 0.64) - 4, baseFloorTy - 6, 8, 1, Tile.OneWay);
    fillTiles(grid, cols - 17, baseFloorTy - 4, 8, 1, Tile.OneWay);
  }

  // 3. Choose Safe Non-Overlapping Column Anchors for `up` and `down` Vertical Shafts (safe for `cols >= 34`)
  let upShaftTx = Math.floor(cols * 0.34);
  let downShaftTx = Math.floor(cols * 0.6);
  const singleMinTx = Math.min(12, Math.max(8, Math.floor(cols * 0.26)));
  const singleMaxTx = Math.max(singleMinTx + 2, cols - 16);
  if (hasUp && !hasDown) {
    upShaftTx = randInt(rng, singleMinTx, singleMaxTx);
  } else if (!hasUp && hasDown) {
    downShaftTx = randInt(rng, singleMinTx, singleMaxTx);
  } else if (hasUp && hasDown) {
    const leftTx = randInt(rng, 8, Math.max(9, Math.min(14, Math.floor(cols * 0.3))));
    const rightMin = Math.max(leftTx + 8, cols - 18);
    const rightMax = Math.max(rightMin, cols - 12);
    const rightTx = randInt(rng, rightMin, rightMax);
    if (rng() < 0.5) {
      upShaftTx = leftTx;
      downShaftTx = rightTx;
    } else {
      downShaftTx = leftTx;
      upShaftTx = rightTx;
    }
  }

  // 4. Carve Boundary Doorways & Guarantee Climbable Access
  if (hasLeft) {
    // Solid landing apron + 5-tile (`80px`) tall doorway opening on left boundary
    fillTiles(grid, 0, leftDoorFloorTy, 8, rows - leftDoorFloorTy, Tile.Solid);
    fillTiles(grid, 0, leftDoorFloorTy - 5, 8, 5, Tile.Air);
    if (leftDoorFloorTy < baseFloorTy) {
      fillTiles(grid, 8, baseFloorTy - 1, 3, 1, Tile.Solid);
    }
  }

  if (hasRight) {
    fillTiles(grid, cols - 8, rightDoorFloorTy, 8, rows - rightDoorFloorTy, Tile.Solid);
    fillTiles(grid, cols - 8, rightDoorFloorTy - 5, 8, 5, Tile.Air);
    if (rightDoorFloorTy < baseFloorTy) {
      fillTiles(grid, cols - 11, baseFloorTy - 1, 3, 1, Tile.Solid);
    }
  }

  if (hasDown) {
    // Ensure solid shoulders flank the shaft, carve `6`-tile (`96px`) shaft through bottom bedrock,
    // and span `baseFloorTy` with a drop-through `OneWay` grate!
    fillTiles(grid, downShaftTx - 2, baseFloorTy, 2, 2, Tile.Solid);
    fillTiles(grid, downShaftTx + 6, baseFloorTy, 2, 2, Tile.Solid);
    fillTiles(grid, downShaftTx, baseFloorTy - 3, 6, rows - (baseFloorTy - 3), Tile.Air);
    fillTiles(grid, downShaftTx, baseFloorTy, 6, 1, Tile.OneWay);
  }

  if (hasUp) {
    // Carve `6`-tile (`96px`) chimney through top ceiling and build guaranteed `32px`-step OneWay rungs!
    fillTiles(grid, upShaftTx - 1, 0, 1, 3, Tile.Solid);
    fillTiles(grid, upShaftTx + 6, 0, 1, 3, Tile.Solid);
    fillTiles(grid, upShaftTx, 0, 6, baseFloorTy, Tile.Air);
    fillTiles(grid, upShaftTx, baseFloorTy, 6, 2, Tile.Solid);
    for (let ty = 4; ty <= baseFloorTy - 2; ty += 2) {
      fillTiles(grid, upShaftTx, ty, 6, 1, Tile.OneWay);
    }
  }

  // 5. Place Runic Seal Barrier (`seal_courtyard_east`) if this room borders the sealed Cluster D gate!
  let sealBarrier: SealBarrier | undefined;
  if (node.sealSide === 'right') {
    // Carve an enclosed `5`-tile tall stone gate tunnel at `tx = cols - 6 .. cols - 4` so player cannot jump over the seal!
    const gateFloorTy = rightDoorFloorTy;
    fillTiles(grid, cols - 6, 0, 4, gateFloorTy - 5, Tile.Solid);
    fillTiles(grid, cols - 8, gateFloorTy - 5, 8, 5, Tile.Air);
    fillTiles(grid, cols - 8, gateFloorTy, 8, rows - gateFloorTy, Tile.Solid);
    sealBarrier = {
      id: 'seal_courtyard_east',
      x: (cols - 5) * TILE_SIZE,
      y: (gateFloorTy - 5) * TILE_SIZE,
      w: 18,
      h: 5 * TILE_SIZE,
      requiredRelic: RelicId.AbyssalBreaker,
    };
  } else if (node.sealSide === 'left') {
    const gateFloorTy = leftDoorFloorTy;
    fillTiles(grid, 2, 0, 4, gateFloorTy - 5, Tile.Solid);
    fillTiles(grid, 0, gateFloorTy - 5, 8, 5, Tile.Air);
    fillTiles(grid, 0, gateFloorTy, 8, rows - gateFloorTy, Tile.Solid);
    sealBarrier = {
      id: 'seal_courtyard_east',
      x: 4 * TILE_SIZE - 2,
      y: (gateFloorTy - 5) * TILE_SIZE,
      w: 18,
      h: 5 * TILE_SIZE,
      requiredRelic: RelicId.AbyssalBreaker,
    };
  }

  return {
    id: bp.id,
    blueprint: bp,
    node,
    templateId,
    cols,
    rows,
    grid,
    leftDoorFloorTy,
    rightDoorFloorTy,
    upShaftTx,
    downShaftTx,
    sealBarrier,
  };
}

/**
 * Greedy 2D Tile-to-PlatformRect Mesher:
 * Merges `Solid`, `OneWay`, and `Hazard` tiles into clean, seamless `PlatformRect` blocks.
 */
function meshTileGridToPlatforms(grid: Tile[][]): PlatformRect[] {
  const rows = grid.length;
  const cols = grid[0].length;
  const platforms: PlatformRect[] = [];

  // 1. Greedy 2D merge for Solid tiles
  const visitedSolid = Array.from({ length: rows }, () => new Uint8Array(cols));
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      if (grid[ty][tx] !== Tile.Solid || visitedSolid[ty][tx]) continue;
      let w = 1;
      while (tx + w < cols && grid[ty][tx + w] === Tile.Solid && !visitedSolid[ty][tx + w]) {
        w++;
      }
      let h = 1;
      outer: while (ty + h < rows) {
        for (let k = 0; k < w; k++) {
          if (grid[ty + h][tx + k] !== Tile.Solid || visitedSolid[ty + h][tx + k]) {
            break outer;
          }
        }
        h++;
      }
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          visitedSolid[ty + dy][tx + dx] = 1;
        }
      }
      platforms.push({
        x: tx * TILE_SIZE,
        y: ty * TILE_SIZE,
        w: w * TILE_SIZE,
        h: h * TILE_SIZE,
      });
    }
  }

  // 2. Horizontal row runs for OneWay grates & Crystal Hazard beds
  for (let ty = 0; ty < rows; ty++) {
    let tx = 0;
    while (tx < cols) {
      const t = grid[ty][tx];
      if (t !== Tile.OneWay && t !== Tile.Hazard) {
        tx++;
        continue;
      }
      let w = 1;
      while (tx + w < cols && grid[ty][tx + w] === t) {
        w++;
      }
      if (t === Tile.OneWay) {
        platforms.push({
          x: tx * TILE_SIZE,
          y: ty * TILE_SIZE,
          w: w * TILE_SIZE,
          h: 8,
          oneWay: true,
        });
      } else {
        platforms.push({
          x: tx * TILE_SIZE,
          y: ty * TILE_SIZE,
          w: w * TILE_SIZE,
          h: TILE_SIZE,
          hazard: true,
        });
      }
      tx += w;
    }
  }

  return platforms;
}

interface WalkableSpan {
  ty: number;
  y: number;
  x0: number;
  x1: number;
  width: number;
  allSolid: boolean;
}

/**
 * Extracts verified walkable spans (`>= 48px` clear air headroom above, zero hazard tiles,
 * away from boundary exit triggers and seal barriers).
 */
function extractWalkableSpans(built: BuiltRoomIntermediate): WalkableSpan[] {
  const { grid, cols, rows, node, sealBarrier, downShaftTx } = built;
  const spans: WalkableSpan[] = [];
  const hasDown = Boolean(node.links.down);

  const isTileWalkable = (tx: number, ty: number): boolean => {
    if (tx < 3 || tx > cols - 4 || ty < 4 || ty > rows - 2) return false;
    const ground = grid[ty][tx];
    if (ground !== Tile.Solid && ground !== Tile.OneWay) return false;
    // Require 3 full tiles (`48px`) of clear Air directly above the floor surface
    if (
      grid[ty - 1][tx] !== Tile.Air ||
      grid[ty - 2][tx] !== Tile.Air ||
      grid[ty - 3][tx] !== Tile.Air
    ) {
      return false;
    }
    // Keep doorway aprons clear (`tx < 6` if left exit, `tx > cols - 7` if right exit)
    if (node.links.left && tx < 6) return false;
    if (node.links.right && tx > cols - 7) return false;
    // Keep seal barrier tunnel clear so nothing spawns behind or inside an unbroken seal in the gate room
    if (sealBarrier) {
      const wx = (tx + 0.5) * TILE_SIZE;
      if (node.sealSide === 'right' && wx >= sealBarrier.x - 24) return false;
      if (node.sealSide === 'left' && wx <= sealBarrier.x + sealBarrier.w + 24) return false;
    }
    return true;
  };

  for (let ty = 4; ty <= rows - 2; ty++) {
    let tx = 3;
    while (tx <= cols - 4) {
      if (!isTileWalkable(tx, ty)) {
        tx++;
        continue;
      }
      const startTx = tx;
      let allSolid = true;
      while (tx <= cols - 4 && isTileWalkable(tx, ty)) {
        // Don't treat a `down` shaft drop-through grate as solid prop ground
        if (
          grid[ty][tx] !== Tile.Solid ||
          (hasDown && ty === rows - 2 && tx >= downShaftTx && tx < downShaftTx + 6)
        ) {
          allSolid = false;
        }
        tx++;
      }
      const endTx = tx;
      const x0 = startTx * TILE_SIZE;
      const x1 = endTx * TILE_SIZE;
      if (x1 - x0 >= 64) {
        spans.push({
          ty,
          y: ty * TILE_SIZE,
          x0,
          x1,
          width: x1 - x0,
          allSolid,
        });
      }
    }
  }

  return spans;
}

function buildAtmosphereProps(
  built: BuiltRoomIntermediate,
  spans: WalkableSpan[],
  rng: () => number
): { torches: TorchProp[]; pillars: PillarProp[]; windows: WindowProp[] } {
  const { blueprint, cols, rows, grid } = built;
  const torches: TorchProp[] = [];
  const pillars: PillarProp[] = [];
  const windows: WindowProp[] = [];

  const torchColor: TorchProp['color'] =
    blueprint.theme === 'throne'
      ? 'crimson'
      : blueprint.theme === 'archive'
        ? 'violet'
        : blueprint.theme === 'crypt'
          ? 'cyan'
          : 'amber';

  // Place 4..6 flickering cavern/dungeon wall sconces above walkable spans
  const candidateSpans = shuffle(rng, spans);
  for (const sp of candidateSpans) {
    if (torches.length >= 6) break;
    const countInSpan = sp.width >= 220 ? 2 : 1;
    for (let k = 0; k < countInSpan && torches.length < 6; k++) {
      const tx = Math.round((sp.x0 + ((k + 1) / (countInSpan + 1)) * sp.width) / TILE_SIZE);
      const wx = tx * TILE_SIZE + 8;
      const wy = sp.y - 26;
      if (torches.every((t) => Math.hypot(t.x - wx, t.y - wy) >= 88)) {
        torches.push({ x: wx, y: wy, color: torchColor });
      }
    }
  }

  // Place background structural pillars & lancet windows for non-crypt themes
  const roomW = cols * TILE_SIZE;
  const floorY = (rows - 2) * TILE_SIZE;
  for (let px = 112; px < roomW - 96; px += 156) {
    const tx = Math.floor(px / TILE_SIZE);
    if (grid[rows - 2]?.[tx] === Tile.Solid) {
      pillars.push({ x: px, y: 24, h: floorY - 24 });
    }
    if (blueprint.theme !== 'crypt' && px + 76 < roomW - 96) {
      windows.push({ x: px + 68, y: Math.max(46, floorY - 168), w: 34, h: 86 });
    }
  }

  return { torches, pillars, windows };
}

/**
 * Generates the complete 18-room Cave Story / Dead Cells interconnected world for a given `seed`.
 */
export function generateWorld(seed: number): Record<RoomId, RoomDef> {
  const graph = generateConnectedGraph(seed);
  const builtMap = {} as Record<RoomId, BuiltRoomIntermediate>;

  // 1. Build tile grids for all 18 rooms deterministically
  for (let i = 0; i < ORDERED_ROOM_IDS.length; i++) {
    const id = ORDERED_ROOM_IDS[i];
    const roomRng = mulberry32((seed ^ Math.imul(i + 17, 2246822519)) >>> 0);
    builtMap[id] = buildRoomTileGrid(ROOM_BLUEPRINTS[id], graph[id], roomRng);
  }

  const rooms = {} as Record<RoomId, RoomDef>;

  // 2. Link Reciprocal Doorways, Mesh Platforms, and Populate Props & Enemies
  for (let i = 0; i < ORDERED_ROOM_IDS.length; i++) {
    const id = ORDERED_ROOM_IDS[i];
    const built = builtMap[id];
    const bp = built.blueprint;
    const rng = mulberry32((seed ^ Math.imul(i + 101, 3266489917)) >>> 0);
    const width = built.cols * TILE_SIZE;
    const height = built.rows * TILE_SIZE;

    // Build exact reciprocal exits using neighbor's carved doorway coordinates!
    const exits: RoomExit[] = [];
    for (const dir of ['left', 'right', 'up', 'down'] as Direction[]) {
      const targetId = built.node.links[dir];
      if (!targetId) continue;
      const target = builtMap[targetId];
      const targetW = target.cols * TILE_SIZE;

      if (dir === 'left') {
        const doorFloorY = built.leftDoorFloorTy * TILE_SIZE;
        exits.push({
          id: `${id}_to_${targetId}`,
          x: 0,
          y: doorFloorY - 5 * TILE_SIZE,
          w: 16,
          h: 5 * TILE_SIZE,
          targetRoom: targetId,
          spawnX: targetW - 44,
          spawnY: target.rightDoorFloorTy * TILE_SIZE,
          direction: 'left',
        });
      } else if (dir === 'right') {
        const doorFloorY = built.rightDoorFloorTy * TILE_SIZE;
        exits.push({
          id: `${id}_to_${targetId}`,
          x: width - 16,
          y: doorFloorY - 5 * TILE_SIZE,
          w: 16,
          h: 5 * TILE_SIZE,
          targetRoom: targetId,
          spawnX: 44,
          spawnY: target.leftDoorFloorTy * TILE_SIZE,
          direction: 'right',
        });
      } else if (dir === 'up') {
        exits.push({
          id: `${id}_to_${targetId}`,
          x: built.upShaftTx * TILE_SIZE,
          y: 0,
          w: 6 * TILE_SIZE,
          h: 20,
          targetRoom: targetId,
          spawnX: (target.downShaftTx + 3) * TILE_SIZE,
          spawnY: (target.rows - 2) * TILE_SIZE,
          direction: 'up',
        });
      } else {
        exits.push({
          id: `${id}_to_${targetId}`,
          x: built.downShaftTx * TILE_SIZE,
          y: height - 16,
          w: 6 * TILE_SIZE,
          h: 16,
          targetRoom: targetId,
          spawnX: (target.upShaftTx + 3) * TILE_SIZE,
          spawnY: 4 * TILE_SIZE,
          direction: 'down',
        });
      }
    }

    const platforms = meshTileGridToPlatforms(built.grid);
    const spans = extractWalkableSpans(built);
    const solidSpans = spans.filter((s) => s.allSolid && s.width >= 80);
    const propPool = solidSpans.length > 0 ? solidSpans : spans;

    const usedPropPoints: Array<{ x: number; y: number }> = [];
    const pickPropSpot = (preferHigh: boolean): { x: number; y: number } => {
      const sorted = propPool
        .slice()
        .sort((a, b) => (preferHigh ? a.y - b.y : b.y - a.y));
      for (const sp of sorted) {
        const candidates = [
          Math.round((sp.x0 + sp.width * 0.35) / 4) * 4,
          Math.round((sp.x0 + sp.width * 0.65) / 4) * 4,
          Math.round((sp.x0 + sp.width * 0.5) / 4) * 4,
        ];
        for (const cx of candidates) {
          if (cx < sp.x0 + 24 || cx > sp.x1 - 24) continue;
          if (usedPropPoints.every((p) => Math.hypot(p.x - cx, p.y - sp.y) >= 68)) {
            const pt = { x: cx, y: sp.y };
            usedPropPoints.push(pt);
            return pt;
          }
        }
      }
      const fallback = propPool[0] ?? { x0: 96, x1: 256, y: (built.rows - 2) * TILE_SIZE };
      const pt = { x: Math.round((fallback.x0 + fallback.x1) * 0.5), y: fallback.y };
      usedPropPoints.push(pt);
      return pt;
    };

    let shrine: RoomDef['shrine'];
    if (bp.shrine) {
      const spot =
        id === 'cloister'
          ? (() => {
              // Place starting shrine near left-center of `cloister` so Aria wakes beside it
              const lowSpans = propPool
                .slice()
                .sort((a, b) => b.y - a.y || a.x0 - b.x0);
              const s0 = lowSpans[0];
              const pt = {
                x: Math.min(s0.x1 - 32, Math.max(s0.x0 + 36, 112)),
                y: s0.y,
              };
              usedPropPoints.push(pt);
              return pt;
            })()
          : pickPropSpot(false);
      shrine = { id: bp.shrine.id, nameZh: bp.shrine.nameZh, x: spot.x, y: spot.y };
    }

    let relic: RoomDef['relic'];
    if (bp.relic) {
      const spot = pickPropSpot(true);
      relic = {
        relicId: bp.relic.relicId,
        nameZh: bp.relic.nameZh,
        subtitleZh: bp.relic.subtitleZh,
        x: spot.x,
        y: spot.y,
      };
    }

    let vessel: RoomDef['vessel'];
    if (bp.vessel) {
      const spot = pickPropSpot(true);
      vessel = {
        id: bp.vessel.id,
        nameZh: bp.vessel.nameZh,
        bonusHp: bp.vessel.bonusHp,
        x: spot.x,
        y: spot.y,
      };
    }

    let altar: RoomDef['altar'];
    if (bp.altar) {
      const spot = pickPropSpot(id !== 'cloister');
      altar = {
        id: bp.altar.id,
        nameZh: bp.altar.nameZh,
        x: spot.x,
        y: spot.y,
      };
    }

    // Populate Enemies on verified walkable spans (kept safely clear of entry doorways & starting shrine)
    const enemies: EnemySpawnDef[] = [];
    if (bp.isBoss && bp.bossKind) {
      const bossFloorY = (built.rows - 2) * TILE_SIZE;
      const enterFromRight = Boolean(built.node.links.right && !built.node.links.left);
      const bossX = enterFromRight ? Math.round(width * 0.28) : Math.round(width * 0.72);
      enemies.push({
        kind: bp.bossKind,
        x: bossX,
        y: bossFloorY,
        minX: 56,
        maxX: width - 56,
      });
      if (bp.enemyPool.length > 0) {
        const upperSpans = spans.filter((s) => s.y < bossFloorY && s.width >= 96);
        const addSpan = upperSpans[0] ?? spans.find((s) => s.width >= 120);
        if (addSpan) {
          enemies.push({
            kind: bp.enemyPool[0],
            x: Math.round((addSpan.x0 + addSpan.x1) * 0.5),
            y: addSpan.y,
            minX: addSpan.x0 + 14,
            maxX: addSpan.x1 - 14,
          });
        }
      }
    } else {
      const targetCount = randInt(rng, bp.enemyCount[0], bp.enemyCount[1]);
      const combatSpans = shuffle(
        rng,
        spans.filter((s) => s.width >= 92)
      );
      let poolIdx = Math.floor(rng() * bp.enemyPool.length);

      for (let eIdx = 0; eIdx < targetCount && combatSpans.length > 0; eIdx++) {
        const sp = combatSpans[eIdx % combatSpans.length];
        const minX = sp.x0 + 14;
        const maxX = sp.x1 - 14;
        if (maxX - minX < 36) continue;

        const frac = 0.25 + ((eIdx * 0.37 + rng() * 0.25) % 0.55);
        let sx = Math.round(minX + (maxX - minX) * frac);

        // Give starting shrine in `cloister` a peaceful 112px sanctuary radius on spawn (fits compact 34-col grottoes)
        if (id === 'cloister' && shrine && Math.abs(sx - shrine.x) < 112 && Math.abs(sp.y - shrine.y) < 40) {
          if (maxX > shrine.x + 124) {
            sx = Math.round((shrine.x + 124 + maxX) * 0.5);
          } else {
            continue;
          }
        }

        const kind = bp.enemyPool[poolIdx % bp.enemyPool.length];
        poolIdx++;

        enemies.push({
          kind,
          x: Math.max(minX + 6, Math.min(maxX - 6, sx)),
          y: sp.y,
          minX: id === 'cloister' && shrine && sp.y === shrine.y ? Math.max(minX, shrine.x + 96) : minX,
          maxX,
          eliteChance: bp.eliteChance > 0 ? bp.eliteChance : undefined,
        });
      }
    }

    const { torches, pillars, windows } = buildAtmosphereProps(built, spans, rng);

    rooms[id] = {
      id,
      nameZh: bp.nameZh,
      zoneZh: bp.zoneZh,
      gridX: built.node.gridX,
      gridY: built.node.gridY,
      width,
      height,
      theme: bp.theme,
      templateId: built.templateId,
      platforms,
      exits,
      torches,
      pillars,
      windows,
      enemies,
      shrine,
      relic,
      vessel,
      altar,
      sealBarrier: built.sealBarrier,
    };
  }

  return rooms;
}

export function getStartingSpawn(rooms: Record<RoomId, RoomDef>): { x: number; y: number } {
  const cloister = rooms.cloister;
  if (cloister.shrine) {
    return {
      x: cloister.shrine.x + 22,
      y: cloister.shrine.y,
    };
  }
  return { x: 112, y: cloister.height - 32 };
}
