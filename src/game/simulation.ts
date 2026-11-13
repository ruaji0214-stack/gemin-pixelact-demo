import { sound } from './audio';
import {
  canChainNextAttack,
  canMoveCancelRecovery,
  computeAriaPose,
  computeAttackImpulseVx,
  computeDashJumpVelocity,
} from './kinematics';
import {
  ALL_UPGRADE_IDS,
  UPGRADE_SPECS,
  UpgradeModifiers,
  computeUpgradeModifiers,
  createEmptyUpgradeMap,
  getEnemySoulReward,
  getSoulForgeCost,
  isBossEnemyKind,
  rollUpgradeDraft,
} from './roguelike';
import {
  COMBO_WINDOW_MAX,
  COYOTE_TIME_MAX,
  ENEMY_COMBAT_STATS,
  GRAVITY,
  INPUT_BUFFER_MAX,
  MOVES,
  PLAYER_DASH_DURATION,
  PLAYER_DASH_SPEED,
  PLAYER_DOUBLE_JUMP_VY,
  PLAYER_JUMP_VY,
  PLAYER_RUN_SPEED,
  WALL_JUMP_VX,
  WALL_JUMP_VY,
  WALL_SLIDE_MAX_VY,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  ZANSHIN_GLINT_WINDOW,
  advanceComboStage,
  buildLockedExitBarriers,
  calculateStyleGain,
  canBreakSealBarrier,
  canTriggerPixelPerfectDodge,
  computeAttackInterval,
  computeDashRegenPerSec,
  computeEffectiveDamage,
  computeStyleRank,
  computeWorldTimeScale,
  computeZanshinSheatheDelay,
  getMovePhase,
  getMoveTotalDuration,
  isLKeySkillMove,
  isRoomLockedByEnemies,
  rankOrderValue,
  resolveNextAttackMove,
  shouldEnemyResistHitstun,
  shouldShieldBlockHit,
} from './rules';
import { solveAriaSkeleton, solveEnemySkeleton } from './skeleton';
import {
  EliteAffix,
  EnemyAIState,
  EnemyEntity,
  EnemyKind,
  GamePhase,
  HudSnapshot,
  MinimapRoomCell,
  MoveId,
  PlayerEntity,
  ProjectileEntity,
  RelicId,
  RoomDef,
  RoomId,
  RunSummary,
  StyleRank,
  UpgradeDraftState,
  UpgradeId,
  UpgradeSchool,
} from './types';
import {
  ALL_ROOM_IDS,
  BOSS_ROOM_IDS,
  PLAYER_HALF_W,
  PLAYER_HEIGHT,
  RELIC_METADATA,
  ROOMS,
  applyGeneratedWorld,
  buildMinimapSnapshot,
  findTriggeredExit,
  getActiveStartingSpawn,
  resolveRoomMovement,
} from './world';
import { PixelFXBuffer, seededRand } from '../pixelfx/engine';
import {
  PfxWorldHitGrid,
  rasterizeBoltToSink,
  rasterizeProjectileToSink,
  rasterizeRingToSink,
  rasterizeSlashToSink,
  rasterizeWeaponSmearToSink,
} from '../pixelfx/proceduralVfx';
import {
  renderAfterimages,
  renderEnemy,
  renderMetroidvaniaRoom,
  renderPlayerAria,
  renderProjectiles,
  renderRoomForegroundParallax,
  updatePlayerClothAndHair,
} from '../pixelfx/sprites';
import { renderBloodstainedTitleStage } from '../pixelfx/titleStage';

export interface SimulationCallbacks {
  onPhaseChange: (phase: GamePhase) => void;
  onHudUpdate: (hud: HudSnapshot) => void;
  onRunEnd: (summary: RunSummary) => void;
}

function detectSoftwareRenderer(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl') || probe.getContext('experimental-webgl');
    if (!gl) return true;
    const glCtx = gl as WebGLRenderingContext;
    const dbg = glCtx.getExtension('WEBGL_debug_renderer_info');
    const renderer = dbg
      ? String(glCtx.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
      : String(glCtx.getParameter(glCtx.RENDERER));
    glCtx.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|Software|Basic Render Driver/i.test(renderer);
  } catch {
    return false;
  }
}

export class GameSimulation {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly pfx: PixelFXBuffer;
  private readonly isSoftwareRenderer: boolean;
  private callbacks: SimulationCallbacks;

  private phase: GamePhase = GamePhase.Title;
  private rafId = 0;
  private lastTimestamp = 0;
  private totalTime = 0;
  private runTimeSec = 0;

  private keysHeld = new Set<string>();
  private keysJustPressed = new Set<string>();

  // Roguevania Run & World State (16 Rooms + 3 Bosses + Seeded 3-Choice Drafts)
  private runSeed = 77491;
  private currentRoomId: RoomId = 'cloister';
  private visitedRooms = new Set<RoomId>(['cloister']);
  private collectedRelics = new Set<RelicId>();
  private collectedVessels = new Set<string>();
  private collectedAltars = new Set<string>();
  private shrinesBlessed = new Set<string>();
  private brokenSeals = new Set<string>();
  private clearedRooms = new Set<RoomId>();
  private defeatedBossRooms = new Set<RoomId>();
  private activeShrineId = 'shrine_cloister';

  private baseMaxHp = 100;
  private souls = 0;
  private forgesPurchased = 0;
  private killStreak = 0;
  private upgradeLevels: Record<UpgradeId, number> = createEmptyUpgradeMap();
  private upgradeDraft: UpgradeDraftState | null = null;
  private draftCounter = 0;
  private pendingBossDraft: { title: string; subtitle: string } | null = null;
  private pendingBossDraftTimer = 0;
  private prevStrideStep = 0;

  private camBaseX = 0;
  private camBaseY = 0;
  private toastBanner: string | null = null;
  private toastTimer = 0;
  private lockToastCooldown = 0;
  private interactPrompt: string | null = null;
  private downHoldTimer = 0;

  // Entities & Combat State
  private player: PlayerEntity;
  private enemies: EnemyEntity[] = [];
  private projectiles: ProjectileEntity[] = [];
  private nextEntityId = 1;
  private nextMoveInstanceId = 1;
  private readonly hitGridA = new PfxWorldHitGrid();
  private readonly hitGridB = new PfxWorldHitGrid();

  private defeatFreezeTimer = 0;
  private victoryFreezeTimer = 0;
  private hitstopTimer = 0;
  private witchTimeTimer = 0;
  private cameraTrauma = 0;

  // Scoring & Style
  private score = 0;
  private bestScore = 0;
  private comboCount = 0;
  private comboDecayTimer = 0;
  private maxCombo = 0;
  private stylePoints = 0;
  private peakRank: StyleRank = StyleRank.D;
  private recentMoves: MoveId[] = [];
  private lastMoveName = '';
  private perfectDodges = 0;
  private perfectDodgeBannerTimer = 0;

  private hudSyncAccum = 0;
  private ambientPetalAccum = 0;
  private titlePointerNormX = 0;
  private titlePointerNormY = 0;

  private cachedMods: UpgradeModifiers | null = null;
  private cachedUpgradeSummary: HudSnapshot['activeUpgradeSummary'] | null = null;
  private mapStateVersion = 0;
  private cachedMapKey = '';
  private cachedMinimapCells: MinimapRoomCell[] = [];
  private cachedRelicsKey = -1;
  private cachedRelicsArray: RelicId[] = [];
  private cachedLockedRoomId: RoomId | null = null;
  private cachedLockedSeed = -1;
  private cachedLockedBarriers: ReturnType<typeof buildLockedExitBarriers> = [];
  private lastHudSignature = '';

  constructor(canvas: HTMLCanvasElement, callbacks: SimulationCallbacks) {
    this.canvas = canvas;
    this.isSoftwareRenderer = detectSoftwareRenderer();
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('2D context unavailable');
    }
    this.ctx = context;
    this.ctx.imageSmoothingEnabled = false;
    this.pfx = new PixelFXBuffer(this.ctx, this.isSoftwareRenderer);
    this.callbacks = callbacks;

    try {
      const savedBest = localStorage.getItem('silver_echo_best_score');
      if (savedBest) this.bestScore = Number(savedBest) || 0;
    } catch {
      // Ignore storage errors
    }

    this.player = this.createFreshPlayer(346, 215);
    this.player.facing = -1;
  }

  private getMods(): UpgradeModifiers {
    if (!this.cachedMods) {
      this.cachedMods = computeUpgradeModifiers(this.upgradeLevels);
    }
    return this.cachedMods;
  }

  private syncPlayerMaxHp(healDelta = false): void {
    const mods = this.getMods();
    const prevMax = this.player.maxHp;
    const targetMax = this.baseMaxHp + mods.bonusMaxHp;
    this.player.maxHp = targetMax;
    if (healDelta && targetMax > prevMax) {
      const diff = targetMax - prevMax;
      this.player.hp = Math.min(targetMax, this.player.hp + diff);
      this.player.rallyHp = Math.max(this.player.rallyHp, this.player.hp);
    } else {
      this.player.hp = Math.min(targetMax, this.player.hp);
      this.player.rallyHp = Math.min(targetMax, this.player.rallyHp);
    }

    // Sync maxStamina (`瞬步次数上限`) from `魂心` (`SoulHeart` / `FrostStep`)
    const prevMaxStamina = this.player.maxStamina;
    const targetMaxStamina = 3 + mods.bonusMaxStamina;
    this.player.maxStamina = targetMaxStamina;
    if (targetMaxStamina > prevMaxStamina) {
      this.player.stamina = Math.min(
        targetMaxStamina,
        this.player.stamina + (targetMaxStamina - prevMaxStamina)
      );
    } else {
      this.player.stamina = Math.min(targetMaxStamina, this.player.stamina);
    }
  }

  private createFreshPlayer(startX: number, startY: number): PlayerEntity {
    const makeChain = (len: number) =>
      Array.from({ length: len }, (_, i) => ({
        x: startX - i * 3,
        y: startY - 26 + i * 3,
        vx: 0,
        vy: 0,
      }));

    return {
      x: startX,
      y: startY,
      vx: 0,
      vy: 0,
      facing: 1,
      grounded: true,
      crouching: false,
      crouchTimer: 0,
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

      moveId: MoveId.None,
      moveTimer: 0,
      moveHitIds: new Set<number>(),
      comboWindowTimer: 0,
      airComboCount: 0,
      attackCooldownTimer: 0,
      savedComboStage: 0,
      empoweredLActive: false,
      crimsonFlashActive: false,
      lunarLActive: false,
      astraChainCount: 0,
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

      lastSafeX: startX,
      lastSafeY: startY,

      scaleX: 1,
      scaleY: 1,
      gaitPhase: 0,
      skidTimer: 0,
      spinFlipTimer: 0,
      landRecoveryTimer: 0,

      hairLeft: makeChain(6),
      hairRight: makeChain(6),
      capeNodes: makeChain(5),
    };
  }

  private isDestroyed = false;
  private yieldTimerId: number | null = null;

  public startLoop(): void {
    this.isDestroyed = false;
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('blur', this.handleFocusLoss);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    this.lastTimestamp = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  public destroy(): void {
    this.isDestroyed = true;
    cancelAnimationFrame(this.rafId);
    if (this.yieldTimerId !== null) {
      window.clearTimeout(this.yieldTimerId);
      this.yieldTimerId = null;
    }
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('blur', this.handleFocusLoss);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private handlePointerMove = (e: PointerEvent): void => {
    if (this.phase !== GamePhase.Title) return;
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.titlePointerNormX = (e.clientX / w - 0.5) * 2;
    this.titlePointerNormY = (e.clientY / h - 0.5) * 2;
  };

  private handleFocusLoss = (): void => {
    this.keysHeld.clear();
    this.keysJustPressed.clear();
  };

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.handleFocusLoss();
    }
  };

  private normalizeKey(e: KeyboardEvent): string {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        return 'w';
      case 'KeyA':
      case 'ArrowLeft':
        return 'a';
      case 'KeyS':
      case 'ArrowDown':
        return 's';
      case 'KeyD':
      case 'ArrowRight':
        return 'd';
      case 'KeyJ':
        return 'j';
      case 'KeyK':
        return 'k';
      case 'KeyL':
      case 'KeyI':
        return 'l';
      case 'KeyE':
        return 'e';
      case 'KeyR':
        return 'r';
      case 'KeyP':
        return 'p';
      case 'Digit1':
      case 'Numpad1':
        return '1';
      case 'Digit2':
      case 'Numpad2':
        return '2';
      case 'Digit3':
      case 'Numpad3':
        return '3';
      case 'Space':
        return 'space';
      case 'Enter':
        return 'enter';
      case 'Escape':
        return 'escape';
      case 'Tab':
        return 'tab';
    }
    const k = e.key.toLowerCase();
    if (k === ' ') return 'space';
    if (k === 'arrowleft') return 'a';
    if (k === 'arrowright') return 'd';
    if (k === 'arrowup') return 'w';
    if (k === 'arrowdown') return 's';
    if (k === 'i') return 'l';
    return k;
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    const key = this.normalizeKey(e);

    if (this.phase === GamePhase.Upgrade) {
      if (key === '1') {
        e.preventDefault();
        this.chooseUpgrade(0);
      } else if (key === '2') {
        e.preventDefault();
        this.chooseUpgrade(1);
      } else if (key === '3') {
        e.preventDefault();
        this.chooseUpgrade(2);
      }
      return;
    }

    if (['w', 'a', 's', 'd', 'j', 'k', 'l', 'e', 'space', 'tab'].includes(key)) {
      if (this.phase === GamePhase.Playing || key === 'tab') {
        e.preventDefault();
      }
    }

    if (this.phase === GamePhase.Title) {
      return;
    }

    if (key === 'escape' || key === 'p' || key === 'tab') {
      if (this.phase === GamePhase.Playing) {
        e.preventDefault();
        this.setPhase(GamePhase.Paused);
        return;
      } else if (this.phase === GamePhase.Paused) {
        e.preventDefault();
        this.resumeGame();
        return;
      }
    }

    if (key === 'r' && this.phase === GamePhase.Playing) {
      this.startNewRun();
      return;
    }

    if (!this.keysHeld.has(key)) {
      this.keysJustPressed.add(key);
    }
    this.keysHeld.add(key);
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    const key = this.normalizeKey(e);
    this.keysHeld.delete(key);

    if ((key === 'w' || key === 'space') && this.phase === GamePhase.Playing) {
      if (!this.player.grounded && this.player.vy < -90 && this.player.moveId !== MoveId.RisingMoon) {
        this.player.vy *= 0.45;
      }
    }
  };

  public injectControl(key: 'a' | 'd' | 'w' | 's' | 'j' | 'k' | 'l' | 'e', pressed: boolean): void {
    if (pressed) {
      if (!this.keysHeld.has(key)) {
        this.keysJustPressed.add(key);
      }
      this.keysHeld.add(key);
    } else {
      this.keysHeld.delete(key);
      if (key === 'w' && !this.player.grounded && this.player.vy < -90) {
        this.player.vy *= 0.45;
      }
    }
  }

  private staticFrameRendered = false;

  public setPhase(next: GamePhase): void {
    this.phase = next;
    this.staticFrameRendered = false;
    document.body.dataset.state = next;
    if (next !== GamePhase.Playing) {
      this.keysHeld.clear();
      this.keysJustPressed.clear();
    }
    const isBossRoomActive =
      BOSS_ROOM_IDS.has(this.currentRoomId) && !this.defeatedBossRooms.has(this.currentRoomId);
    if (next === GamePhase.Title) {
      sound.setBgmTrack('title', false);
    } else if (next === GamePhase.Playing) {
      sound.setBgmTrack(isBossRoomActive ? 'boss' : 'explore', false);
    } else if (next === GamePhase.Paused || next === GamePhase.Upgrade) {
      sound.setBgmTrack(isBossRoomActive ? 'boss' : 'explore', true);
      this.emitHudSnapshot(true);
    } else if (next === GamePhase.GameOver) {
      sound.setBgmTrack('none', false);
    }
    this.callbacks.onPhaseChange(next);
  }

  private openUpgradeDraft(sourceTitleZh: string, sourceSubtitleZh: string): void {
    this.draftCounter++;
    this.upgradeDraft = rollUpgradeDraft(
      this.upgradeLevels,
      this.runSeed,
      this.draftCounter,
      sourceTitleZh,
      sourceSubtitleZh
    );
    sound.playRelicChime();
    this.setPhase(GamePhase.Upgrade);
  }

  public chooseUpgrade(choiceIndex: 0 | 1 | 2): void {
    if (this.phase !== GamePhase.Upgrade || !this.upgradeDraft) return;
    const card = this.upgradeDraft.choices[choiceIndex];
    if (!card) return;

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    this.upgradeLevels[card.id] = (this.upgradeLevels[card.id] ?? 0) + 1;
    this.cachedMods = null;
    this.cachedUpgradeSummary = null;
    this.upgradeDraft = null;
    this.score += 180;

    const p = this.player;
    this.syncPlayerMaxHp(true);
    if (card.id === UpgradeId.TitanVessel) {
      p.hp = Math.min(p.maxHp, p.hp + 35);
      p.rallyHp = Math.max(p.rallyHp, p.hp);
      this.pfx.spawnPopup('+35', p.x, p.y - 40, 120, 255, 195);
    }
    if (card.id === UpgradeId.SkyFeather) {
      const mods = this.getMods();
      p.jumpsRemaining = (this.collectedRelics.has(RelicId.DoubleJump) ? 1 : 0) + mods.extraAirJumps;
    }

    const ringCol =
      card.school === UpgradeSchool.Brutality
        ? [255, 86, 126]
        : card.school === UpgradeSchool.Tactics
          ? [88, 236, 255]
          : card.school === UpgradeSchool.Lunar
            ? [165, 180, 252]
            : card.school === UpgradeSchool.Onslaught
              ? [74, 222, 128]
              : card.school === UpgradeSchool.SoulHeart
                ? [240, 171, 252]
                : [255, 214, 108];
    this.pfx.spawnRing(p.x, p.y - 18, 56, 0.34, ringCol[0], ringCol[1], ringCol[2], false);
    this.pfx.spawnHitSparks(
      p.x,
      p.y - 18,
      0,
      card.school === UpgradeSchool.Brutality
        ? 'crimson'
        : card.school === UpgradeSchool.Lunar || card.school === UpgradeSchool.SoulHeart
          ? 'violet'
          : card.school === UpgradeSchool.Tactics || card.school === UpgradeSchool.Onslaught
            ? 'cyan'
            : 'silver',
      false,
      p.y
    );
    sound.playRelicChime();
    this.showToast(`赐福铭刻【${card.nameZh} Lv.${card.nextLevel}】 · ${card.highlightStatZh}`, 3.4);

    this.setPhase(GamePhase.Playing);
    this.canvas.focus();
    this.emitHudSnapshot(true);
  }

  public startNewRun(): void {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.keysHeld.clear();
    this.keysJustPressed.clear();
    this.pfx.resetPools();

    const urlSeed =
      typeof window !== 'undefined'
        ? Number(new URLSearchParams(window.location.search).get('seed'))
        : 0;
    this.runSeed =
      Number.isFinite(urlSeed) && urlSeed > 0
        ? Math.floor(urlSeed)
        : ((Date.now() ^ Math.imul(Math.floor(Math.random() * 1000000), 0x5f3759df)) >>> 0) %
            900000 +
          100000;

    // Regenerate 18-room Cave Story / Dead Cells connected-domain world + procedural room templates
    applyGeneratedWorld(this.runSeed);

    this.currentRoomId = 'cloister';
    this.visitedRooms = new Set<RoomId>(['cloister']);
    this.collectedRelics.clear();
    this.collectedVessels.clear();
    this.collectedAltars.clear();
    this.shrinesBlessed.clear();
    this.brokenSeals.clear();
    this.clearedRooms.clear();
    this.defeatedBossRooms.clear();
    this.activeShrineId = 'shrine_cloister';

    this.baseMaxHp = 100;
    this.souls = 0;
    this.forgesPurchased = 0;
    this.killStreak = 0;
    this.upgradeLevels = createEmptyUpgradeMap();
    this.cachedMods = null;
    this.cachedUpgradeSummary = null;
    this.mapStateVersion++;
    this.cachedLockedRoomId = null;
    this.cachedRelicsKey = -1;
    this.lastHudSignature = '';
    this.upgradeDraft = null;
    this.draftCounter = 0;
    this.pendingBossDraft = null;
    this.pendingBossDraftTimer = 0;
    this.prevStrideStep = 0;
    this.lockToastCooldown = 0;

    const spawn = getActiveStartingSpawn();
    this.player = this.createFreshPlayer(spawn.x, spawn.y);
    this.player.facing = 1;
    this.enterRoom('cloister', spawn.x, spawn.y, true);

    this.defeatFreezeTimer = 0;
    this.victoryFreezeTimer = 0;
    this.hitstopTimer = 0;
    this.witchTimeTimer = 0;
    this.cameraTrauma = 0;

    this.score = 0;
    this.comboCount = 0;
    this.comboDecayTimer = 0;
    this.maxCombo = 0;
    this.stylePoints = 0;
    this.peakRank = StyleRank.D;
    this.recentMoves = [];
    this.lastMoveName = '';
    this.perfectDodges = 0;
    this.perfectDodgeBannerTimer = 0;
    this.runTimeSec = 0;

    this.showToast(
      `踏入【月光石窟】 · 连通洞窟已重塑 (#${this.runSeed}) · 寻获三大遗物讨伐古堡首领`,
      3.8
    );
    this.pfx.spawnHitSparks(this.player.x + 10, this.player.y - 16, 1, 'cyan', false, spawn.y);
    sound.playSlash(1, false);

    this.setPhase(GamePhase.Playing);
    this.canvas.focus();
    this.emitHudSnapshot(true);
  }

  public resumeGame(): void {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.setPhase(GamePhase.Playing);
    this.canvas.focus();
  }

  public returnToTitle(): void {
    this.pfx.resetPools();
    this.currentRoomId = 'cloister';
    this.upgradeDraft = null;
    this.player = this.createFreshPlayer(346, 215);
    this.player.facing = -1;
    this.enemies = [];
    this.projectiles = [];
    this.camBaseX = 0;
    this.camBaseY = 0;
    this.setPhase(GamePhase.Title);
  }

  private getCurrentRoom(): RoomDef {
    return ROOMS[this.currentRoomId];
  }

  private isCurrentRoomLocked(): boolean {
    return isRoomLockedByEnemies(
      this.clearedRooms.has(this.currentRoomId),
      this.enemies.length
    );
  }

  private static readonly EMPTY_BARRIERS: ReturnType<typeof buildLockedExitBarriers> = [];

  private getLockedExitBarriers(room: RoomDef): ReturnType<typeof buildLockedExitBarriers> {
    if (!this.isCurrentRoomLocked()) return GameSimulation.EMPTY_BARRIERS;
    if (this.cachedLockedRoomId !== room.id || this.cachedLockedSeed !== this.runSeed) {
      this.cachedLockedRoomId = room.id;
      this.cachedLockedSeed = this.runSeed;
      this.cachedLockedBarriers = buildLockedExitBarriers(room.exits, room.width, room.height);
    }
    return this.cachedLockedBarriers;
  }

  private showToast(msg: string, duration = 3.0): void {
    this.toastBanner = msg;
    this.toastTimer = duration;
  }

  private enterRoom(targetId: RoomId, spawnX: number, spawnY: number, isInitial = false): void {
    const room = ROOMS[targetId];
    const isNewVisit = !this.visitedRooms.has(targetId);
    this.currentRoomId = targetId;
    this.visitedRooms.add(targetId);

    const p = this.player;
    p.x = spawnX;
    p.y = spawnY;
    p.lastSafeX = spawnX;
    p.lastSafeY = spawnY;
    p.isDashing = false;
    p.wallSlideSide = 0;

    for (let i = 0; i < p.hairLeft.length; i++) {
      p.hairLeft[i].x = spawnX - p.facing * i * 3;
      p.hairLeft[i].y = spawnY - 26 + i * 3;
    }
    for (let i = 0; i < p.hairRight.length; i++) {
      p.hairRight[i].x = spawnX - p.facing * i * 3;
      p.hairRight[i].y = spawnY - 25 + i * 3;
    }
    for (let i = 0; i < p.capeNodes.length; i++) {
      p.capeNodes[i].x = spawnX - p.facing * i * 3;
      p.capeNodes[i].y = spawnY - 22 + i * 3;
    }

    this.projectiles = [];
    this.pfx.resetPools();

    this.camBaseX = Math.max(0, Math.min(room.width - WORLD_WIDTH, spawnX - WORLD_WIDTH * 0.5));
    this.camBaseY = Math.max(0, Math.min(room.height - WORLD_HEIGHT, spawnY - WORLD_HEIGHT * 0.6));

    if (!isInitial) {
      this.pfx.screenFlash = 0.16;
      this.pfx.screenFlashColor = { r: 105, g: 148, b: 215 };
      if (isNewVisit) {
        this.score += 120;
        const bossHint = BOSS_ROOM_IDS.has(targetId) ? ' · 首领领域！' : '';
        this.showToast(`进入新区域 · 【${room.nameZh}】${bossHint}`, 2.5);
      }
    }

    if (this.clearedRooms.has(targetId) || this.defeatedBossRooms.has(targetId)) {
      this.enemies = [];
    } else {
      this.enemies = room.enemies.map((sp, idx) =>
        this.createEnemy(sp.kind, sp.x, sp.y, sp.minX, sp.maxX, isInitial, sp.eliteChance ?? 0, idx)
      );
    }

    if (this.phase === GamePhase.Playing || isInitial) {
      const isBossActive = BOSS_ROOM_IDS.has(targetId) && !this.defeatedBossRooms.has(targetId);
      sound.setBgmTrack(isBossActive ? 'boss' : 'explore', false);
    }

    this.emitHudSnapshot(true);
  }

  private createEnemy(
    kind: EnemyKind,
    x: number,
    y: number,
    minX: number,
    maxX: number,
    openingGrace: boolean,
    eliteChance = 0,
    spawnIdx = 0
  ): EnemyEntity {
    const id = this.nextEntityId++;
    const grace = openingGrace ? 1.05 : 0.38;
    const combatProfile = ENEMY_COMBAT_STATS[kind];
    const names: Record<EnemyKind, string> = {
      [EnemyKind.Stalker]: '影刃魔偶',
      [EnemyKind.Weaver]: '星蚀术士',
      [EnemyKind.Halberdier]: '重装铁卫',
      [EnemyKind.Reaper]: '冥火镰卫',
      [EnemyKind.Arbalist]: '绯焰弩手',
      [EnemyKind.Warden]: '深渊典狱官 · 戈尔贡',
      [EnemyKind.Archon]: '星穹大主教 · 奥菲斯',
      [EnemyKind.Sovereign]: '绯月女武神 · 瑟琳',
    };

    let eliteAffix: EliteAffix | null = null;
    if (!isBossEnemyKind(kind) && eliteChance > 0) {
      // Deterministic per-run seeded Elite roll (boosted elite presence for higher challenge)
      const hash =
        ((this.runSeed ^ Math.imul(spawnIdx + 11, 374761393) ^ Math.imul(Math.round(x), 668265263)) >>>
          0) /
        4294967296;
      if (hash < Math.min(0.85, eliteChance * 1.25)) {
        const affixes: EliteAffix[] = ['frenzy', 'storm', 'ward'];
        eliteAffix = affixes[(this.runSeed + spawnIdx) % 3];
      }
    }

    const hpMult = eliteAffix === 'ward' ? 1.75 : eliteAffix ? 1.55 : 1.0;
    const finalHp = Math.round(combatProfile.hp * hpMult);
    const affixPrefix =
      eliteAffix === 'frenzy'
        ? '狂暴·'
        : eliteAffix === 'storm'
          ? '星雷·'
          : eliteAffix === 'ward'
            ? '坚盾·'
            : '';

    return {
      id,
      kind,
      nameZh: `${affixPrefix}${names[kind]}`,
      x,
      y,
      homeMinX: minX,
      homeMaxX: maxX,
      vx: 0,
      vy: 0,
      facing: x > this.player.x ? -1 : 1,
      grounded: true,
      hp: finalHp,
      maxHp: finalHp,
      rallyHp: finalHp,
      shieldActive: combatProfile.shield || eliteAffix === 'ward',
      eliteAffix,
      bleedStacks: 0,
      chillTimer: 0,
      aiState: EnemyAIState.Spawn,
      stateTimer: 0.36,
      attackCooldown: combatProfile.baseCooldownSec + (isBossEnemyKind(kind) ? 0.25 : grace),
      bossPatternIndex: 0,
      bossEnraged: false,
      hasAttackToken: false,
      hitConfirmedThisSwing: false,
      flashTimer: 0,
      scaleX: 1,
      scaleY: 1,
      gaitPhase: 0,
      koTimer: 0.38,
    };
  }

  private tick = (timestamp: number): void => {
    if (this.isDestroyed) return;
    const frameStart = performance.now();
    const rawDt = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
    this.totalTime += dt;

    if (this.phase === GamePhase.Title) {
      this.stepAmbientScene(dt);
      updatePlayerClothAndHair(this.player, dt, this.totalTime);
      this.pfx.step(dt);
      this.renderFrame();
    } else if (this.phase === GamePhase.Playing) {
      this.stepPlaying(dt);
      this.renderFrame();
    } else if (!this.staticFrameRendered) {
      this.renderFrame();
      this.staticFrameRendered = true;
    }

    this.keysJustPressed.clear();
    const drawMs = performance.now() - frameStart;
    const isFrozenModal =
      this.phase !== GamePhase.Playing && this.phase !== GamePhase.Title;
    if (isFrozenModal) {
      this.yieldTimerId = window.setTimeout(() => {
        this.yieldTimerId = null;
        if (!this.isDestroyed) {
          this.rafId = requestAnimationFrame(this.tick);
        }
      }, 64);
    } else if (
      typeof navigator !== 'undefined' &&
      navigator.webdriver &&
      this.isSoftwareRenderer
    ) {
      this.yieldTimerId = window.setTimeout(() => {
        this.yieldTimerId = null;
        if (!this.isDestroyed) {
          this.rafId = requestAnimationFrame(this.tick);
        }
      }, 4);
    } else {
      this.rafId = requestAnimationFrame(this.tick);
    }
  };

  private stepAmbientScene(dt: number): void {
    this.ambientPetalAccum += dt;
    if (this.ambientPetalAccum >= 0.14) {
      this.ambientPetalAccum = 0;
      if (this.phase === GamePhase.Title) {
        const scarlet = Math.random() < 0.62;
        this.pfx.spawnParticle({
          kind: 'petal',
          x: 215 + Math.random() * (WORLD_WIDTH - 205),
          y: -4,
          vx: -18 - Math.random() * 16,
          vy: 15 + Math.random() * 16,
          gravity: 3.5,
          drag: 0.996,
          bounce: 0,
          maxLife: 6.2,
          size: Math.random() > 0.45 ? 2 : 1,
          r: scarlet ? 242 : 212,
          g: scarlet ? 68 : 226,
          b: scarlet ? 116 : 255,
          lightR: scarlet ? 38 : 18,
          lightG: 12,
          lightB: 32,
        });
        return;
      }
      const room = this.getCurrentRoom();
      const isThrone = room.theme === 'throne';
      this.pfx.spawnParticle({
        kind: 'petal',
        x: this.camBaseX + Math.random() * WORLD_WIDTH,
        y: this.camBaseY - 4,
        vx: -16 - Math.random() * 18,
        vy: 18 + Math.random() * 18,
        gravity: 4,
        drag: 0.995,
        bounce: 0,
        maxLife: 5.5,
        size: Math.random() > 0.5 ? 2 : 1,
        r: isThrone ? 255 : 185,
        g: isThrone ? 115 : 205,
        b: isThrone ? 155 : 248,
        lightR: isThrone ? 35 : 18,
        lightG: 16,
        lightB: 42,
      });
    }
  }

  private stepPlaying(dt: number): void {
    this.stepAmbientScene(dt);
    this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 2.6);
    this.perfectDodgeBannerTimer = Math.max(0, this.perfectDodgeBannerTimer - dt);
    this.lockToastCooldown = Math.max(0, this.lockToastCooldown - dt);
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.toastBanner = null;
      }
    }

    if (this.defeatFreezeTimer > 0) {
      this.defeatFreezeTimer -= dt;
      this.pfx.step(dt * 0.4);
      if (this.defeatFreezeTimer <= 0) {
        this.finishRun(false);
      }
      return;
    }

    if (this.victoryFreezeTimer > 0) {
      this.victoryFreezeTimer -= dt;
      this.pfx.step(dt * 0.6);
      if (this.victoryFreezeTimer <= 0) {
        this.finishRun(true);
      }
      return;
    }

    if (this.pendingBossDraft && this.pendingBossDraftTimer > 0) {
      this.pendingBossDraftTimer -= dt;
      if (this.pendingBossDraftTimer <= 0) {
        const draftInfo = this.pendingBossDraft;
        this.pendingBossDraft = null;
        this.openUpgradeDraft(draftInfo.title, draftInfo.subtitle);
        return;
      }
    }

    this.runTimeSec += dt;

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      this.player.flashTimer = Math.max(0, this.player.flashTimer - dt);
      for (const e of this.enemies) {
        e.flashTimer = Math.max(0, e.flashTimer - dt);
      }
      this.pfx.step(dt * 0.25);
      return;
    }

    const timeScale = computeWorldTimeScale(
      this.player.moveId,
      this.witchTimeTimer > 0,
      Boolean(this.player.lunarLActive)
    );
    const playerDt = dt * timeScale.playerScale;
    const worldEnemyDt = dt * timeScale.worldScale;

    const inSkillTimeSlow =
      this.player.moveId === MoveId.MoonCounter ||
      this.player.moveId === MoveId.AstralSlash ||
      this.player.moveId === MoveId.HeavyCrescent ||
      this.player.moveId === MoveId.DimensionCut ||
      Boolean(this.player.lunarLActive);

    if (inSkillTimeSlow) {
      this.pfx.witchTimeTint = Math.max(this.pfx.witchTimeTint, 0.72);
    } else if (this.witchTimeTimer > 0) {
      this.witchTimeTimer = Math.max(0, this.witchTimeTimer - dt);
      this.pfx.witchTimeTint = Math.min(1, this.witchTimeTimer * 2.2);
    } else {
      this.pfx.witchTimeTint = Math.max(0, this.pfx.witchTimeTint - dt * 3.5);
    }

    this.stepPlayer(playerDt);
    this.stepRoomInteractionsAndTransitions();
    if (this.phase !== GamePhase.Playing) return;

    this.stepEnemies(worldEnemyDt);
    this.stepProjectiles(worldEnemyDt);
    this.stepPixelVfxCombat(this.getMods());
    this.stepComboAndCamera(dt);

    updatePlayerClothAndHair(this.player, playerDt, this.totalTime);
    this.pfx.step(worldEnemyDt);

    this.hudSyncAccum += dt;
    if (this.hudSyncAccum >= 0.08) {
      this.hudSyncAccum = 0;
      this.emitHudSnapshot(false);
    }
  }

  private getActiveSealRect(room: RoomDef): { x: number; y: number; w: number; h: number } | null {
    if (!room.sealBarrier) return null;
    if (this.brokenSeals.has(room.sealBarrier.id)) return null;
    return room.sealBarrier;
  }

  private stepPlayer(dt: number): void {
    const p = this.player;
    const room = this.getCurrentRoom();
    const mods = this.getMods();

    if (p.rallyHp > p.hp) {
      p.rallyHp = Math.max(p.hp, p.rallyHp - dt * 28 * mods.rallyDecayMult);
    }
    // 5.0s per dash charge base recovery (`同时闪避次数恢复速度改为5s/次`), scaled by staminaRegenMult
    p.stamina = Math.min(
      p.maxStamina,
      p.stamina + dt * computeDashRegenPerSec(mods.staminaRegenMult)
    );

    // Timers
    p.coyoteTimer = p.grounded ? COYOTE_TIME_MAX : Math.max(0, p.coyoteTimer - dt);
    p.jumpBufferTimer = Math.max(0, p.jumpBufferTimer - dt);
    p.attackBufferTimer = Math.max(0, p.attackBufferTimer - dt);
    p.attackCooldownTimer = Math.max(0, (p.attackCooldownTimer ?? 0) - dt);
    p.dashBufferTimer = Math.max(0, p.dashBufferTimer - dt);
    p.dropThroughTimer = Math.max(0, p.dropThroughTimer - dt);
    p.wallJumpLockTimer = Math.max(0, p.wallJumpLockTimer - dt);
    p.comboWindowTimer = Math.max(0, p.comboWindowTimer - dt);
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    p.dashAfterAttackWindow = Math.max(0, p.dashAfterAttackWindow - dt);
    p.invulnTimer = Math.max(0, p.invulnTimer - dt);
    p.perfectDodgeWindow = Math.max(0, p.perfectDodgeWindow - dt);
    p.hurtTimer = Math.max(0, p.hurtTimer - dt);
    p.flashTimer = Math.max(0, p.flashTimer - dt);
    const prevZanshinFlash = p.zanshinFlashTimer;
    p.zanshinFlashTimer = Math.max(0, p.zanshinFlashTimer - dt);
    if (prevZanshinFlash > 0 && p.zanshinFlashTimer <= 0 && p.moveId === MoveId.None) {
      // Glint window expired without triggering `星术` (`AstralSlash`) -> reset consecutive sheathe halving chain
      p.astraChainCount = 0;
    }
    p.skidTimer = Math.max(0, p.skidTimer - dt);
    p.spinFlipTimer = Math.max(0, p.spinFlipTimer - dt);
    p.landRecoveryTimer = Math.max(0, p.landRecoveryTimer - dt);

    p.scaleX += (1 - p.scaleX) * Math.min(1, dt * 16);
    p.scaleY += (1 - p.scaleY) * Math.min(1, dt * 16);

    // Zanshin (`收到固定为攻击结束后1s收刀，时间窗口0.3s` + `星术激发后减半收刀时间，连续激发连续减少`):
    if (p.zanshinPending && p.moveId === MoveId.None && !p.isDashing) {
      p.zanshinTimer -= dt;
      if (p.zanshinTimer <= 0) {
        p.zanshinPending = false;
        p.zanshinFlashTimer = ZANSHIN_GLINT_WINDOW + mods.zanshinWindowBonusSec;
        const baseGain = this.collectedRelics.has(RelicId.ZanshinTassel) ? 16 : 10;
        const gain = Math.round(baseGain * mods.energyGainMult) + mods.zanshinBonusEnergy;
        p.bladeEnergy = Math.min(p.maxBladeEnergy, p.bladeEnergy + gain);
        if (mods.zanshinHeal > 0) {
          p.hp = Math.min(p.maxHp, p.hp + mods.zanshinHeal);
          p.rallyHp = Math.max(p.rallyHp, p.hp);
          this.pfx.spawnPopup(`+${mods.zanshinHeal}`, p.x - 10, p.y - 44, 120, 225, 185);
        }
        // Subdued low-brightness sheathe ring (`闪光亮度降低`)
        this.pfx.spawnRing(p.x, p.y - 18, 20, 0.18, 68, 124, 158, false);
        const chainTag = (p.astraChainCount ?? 0) > 0 ? `·星连x${p.astraChainCount}` : '';
        this.pfx.spawnPopup(`收刀+${gain}${chainTag}`, p.x, p.y - 36, 118, 188, 220);
        sound.playZanshin();
      }
    }

    // Crouch & One-way platform drop-through
    const holdingDown = this.keysHeld.has('s');
    p.crouching = p.grounded && holdingDown && p.moveId === MoveId.None && !p.isDashing;
    if (p.crouching) {
      p.crouchTimer = (p.crouchTimer ?? 0) + dt;
    } else {
      p.crouchTimer = 0;
    }

    const onOneWayPlatform =
      p.grounded &&
      room.platforms.some(
        (plat) =>
          Boolean(plat.oneWay) &&
          p.x + PLAYER_HALF_W > plat.x + 1 &&
          p.x - PLAYER_HALF_W < plat.x + plat.w - 1 &&
          Math.abs(p.y - plat.y) <= 2.5
      );

    if (p.crouching && onOneWayPlatform && !this.keysHeld.has('j') && !this.keysHeld.has('l')) {
      this.downHoldTimer += dt;
      if (this.downHoldTimer >= 0.28 || this.keysJustPressed.has('space')) {
        p.dropThroughTimer = 0.22;
        p.grounded = false;
        p.crouching = false;
        p.crouchTimer = 0;
        this.downHoldTimer = 0;
      }
    } else {
      this.downHoldTimer = 0;
    }

    if (this.keysJustPressed.has('w') || (this.keysJustPressed.has('space') && !holdingDown)) {
      p.jumpBufferTimer = INPUT_BUFFER_MAX;
    }
    if (this.keysJustPressed.has('k')) {
      p.dashBufferTimer = INPUT_BUFFER_MAX;
    }
    // When holding J while waiting for a halved Astral sheathe (or near-imminent sheathe), don't prematurely fire normal Slash1..4 unless J was freshly tapped
    const suppressHeldNormalJ =
      !this.keysJustPressed.has('j') &&
      p.perfectDodgeWindow <= 0 &&
      p.zanshinFlashTimer <= 0 &&
      p.zanshinPending &&
      ((p.astraChainCount ?? 0) > 0 || p.zanshinTimer <= 0.55);

    if (this.keysJustPressed.has('l')) {
      p.attackBufferTimer = INPUT_BUFFER_MAX;
      p.attackBufferType = 'heavy';
    } else if (
      this.keysJustPressed.has('j') ||
      (this.keysHeld.has('j') && p.attackBufferTimer <= 0 && !suppressHeldNormalJ)
    ) {
      p.attackBufferTimer = this.keysJustPressed.has('j') ? INPUT_BUFFER_MAX : 0.06;
      p.attackBufferType = 'light';
    }

    const moveDir = (this.keysHeld.has('d') ? 1 : 0) - (this.keysHeld.has('a') ? 1 : 0);
    const maxAirDashes =
      (this.collectedRelics.has(RelicId.AbyssalBreaker) ? 2 : 1) + mods.extraAirDashes;

    // 1. Phantom Dash (K) — Instant cancel out of any stance + FrostStep & AegisCounter synergies!
    const canDash =
      p.dashBufferTimer > 0 &&
      !p.isDashing &&
      p.dashCooldown <= 0 &&
      p.stamina >= 1.0 &&
      (p.grounded || p.airDashesUsed < maxAirDashes);

    if (canDash) {
      const dashOriginX = p.x;
      const dashOriginY = p.y;
      p.dashBufferTimer = 0;
      p.stamina = Math.max(0, p.stamina - 1.0);
      if (!p.grounded) p.airDashesUsed++;

      if (moveDir !== 0) {
        p.facing = moveDir > 0 ? 1 : -1;
      } else if (p.wallSlideSide !== 0) {
        p.facing = p.wallSlideSide === 1 ? -1 : 1;
      }

      p.moveId = MoveId.None;
      p.moveTimer = 0;
      p.lunarLActive = false;
      p.zanshinPending = false;

      p.isDashing = true;
      p.dashPerfectTriggered = false;
      p.dashTimer = PLAYER_DASH_DURATION;
      p.dashCooldown = 0.19;
      p.dashAfterAttackWindow = 0.34;
      p.invulnTimer = Math.max(p.invulnTimer, 0.22);
      p.vx = p.facing * PLAYER_DASH_SPEED;
      p.vy = 0;

      // FrostStep (`凛冬残影`): frost nova ring at dash origin damages & chills strictly via plotted ring pixels!
      if (mods.frostStepDamage > 0) {
        this.pfx.spawnRing(dashOriginX, dashOriginY - 16, 48, 0.28, 92, 238, 255, false, {
          owner: 'player',
          damage: mods.frostStepDamage,
          damageColor: 'cyan',
          chillSec: mods.frostStepSlowSec,
          dirX: p.facing,
        });
      }

      // Note: Perfect Dodge (`月影刹那`) no longer triggers at dash start via abstract proximity;
      // Aria's swept dash hurtbox must physically cross >= 1 plotted hostile VFX pixel (`checkDashCrossingHostilePixels`).
      sound.playDash(false);

      this.pfx.spawnDustBurst(p.x, p.y, p.facing, 8);
      this.pfx.spawnAfterimage(p.x, p.y, p.facing, 'dash', 110, 195, 255);
    }

    if (p.isDashing) {
      if (p.jumpBufferTimer > 0 && (p.grounded || p.coyoteTimer > 0)) {
        const dj = computeDashJumpVelocity(p.facing, moveDir, PLAYER_DASH_SPEED, PLAYER_JUMP_VY);
        p.isDashing = false;
        p.dashTimer = 0;
        p.jumpBufferTimer = 0;
        p.coyoteTimer = 0;
        p.grounded = false;
        p.facing = dj.launchDir;
        p.vx = dj.vx;
        p.vy = dj.vy;
        p.scaleX = 1.18;
        p.scaleY = 0.84;
        this.pfx.spawnDustBurst(p.x, p.y, p.facing, 9);
        this.pfx.spawnRing(p.x, p.y - 4, 28, 0.2, 120, 235, 255, false);
        this.pfx.spawnAfterimage(p.x, p.y, p.facing, 'dash', 115, 225, 255, p.facing * 7, 3);
        sound.playJump();
      } else {
        p.dashTimer -= dt;
        p.vx = p.facing * PLAYER_DASH_SPEED;
        p.vy = 0;
        if (Math.floor(p.dashTimer * 60) % 2 === 0) {
          this.pfx.spawnAfterimage(
            p.x,
            p.y,
            p.facing,
            'dash',
            this.witchTimeTimer > 0 ? 110 : 145,
            this.witchTimeTimer > 0 ? 235 : 175,
            255,
            p.facing * 6,
            3
          );
        }
        if (p.dashTimer <= 0) {
          p.isDashing = false;
          if (moveDir === p.facing && p.grounded) {
            p.vx = p.facing * (PLAYER_RUN_SPEED * 1.08);
          } else {
            p.vx *= 0.56;
          }
        }
      }
    }

    // 2. Jump Cancel (JC) & Early Walk/Run Recovery Cancel!
    const curPhase = getMovePhase(p.moveId, p.moveTimer);
    const canJumpCancelMove =
      p.moveId !== MoveId.None &&
      (curPhase === 'recovery' || (curPhase === 'active' && p.moveHitIds.size > 0));

    if (p.jumpBufferTimer > 0 && canJumpCancelMove && !p.isDashing) {
      p.comboWindowTimer = COMBO_WINDOW_MAX;
      p.moveId = MoveId.None;
      p.moveTimer = 0;
    }

    if (
      !p.isDashing &&
      p.moveId !== MoveId.None &&
      p.attackBufferTimer <= 0 &&
      moveDir !== 0 &&
      !holdingDown &&
      canMoveCancelRecovery(p.moveId, p.moveTimer)
    ) {
      p.comboWindowTimer = COMBO_WINDOW_MAX;
      p.moveId = MoveId.None;
      p.moveTimer = 0;
      p.lunarLActive = false;
      p.zanshinPending = true;
      p.zanshinTimer = computeZanshinSheatheDelay(p.astraChainCount ?? 0);
      p.zanshinFlashTimer = 0;
    }

    // 3. Attack & Combo Execution (J / L)
    // - `赤刃` (`Brutality`): Perfect Dodge + Hold/Press J -> `MoonCounter` (1.5s, 0.2x world time-slow)
    // - `星术` (`Tactics`): Zanshin Sheathe Glint + Hold J -> `AstralSlash` (0.96s ranged slash, 0.2x world time-slow, halves next sheathe time consecutively!)
    // - `月魄` (`Lunar`): L Key Exclusive -> `HeavyCrescent` / `HelmSplitter` / `DimensionCut` (0.2x world time-slow + dedicated animations)
    const isPerfectDodgeHoldJ =
      p.perfectDodgeWindow > 0 &&
      (this.keysHeld.has('j') || (p.attackBufferTimer > 0 && p.attackBufferType === 'light'));
    const isAstralHoldJ = p.zanshinFlashTimer > 0 && this.keysHeld.has('j');

    if (isPerfectDodgeHoldJ && p.isDashing && p.dashTimer <= PLAYER_DASH_DURATION * 0.65) {
      p.isDashing = false;
      p.dashTimer = 0;
    }

    const canChainAttack =
      !p.isDashing &&
      p.hurtTimer <= 0.05 &&
      canChainNextAttack(p.moveId, p.moveTimer, p.moveHitIds.size > 0);

    const effectiveButton: 'light' | 'heavy' | null =
      p.attackBufferTimer > 0 && p.attackBufferType
        ? p.attackBufferType
        : isPerfectDodgeHoldJ || isAstralHoldJ
          ? 'light'
          : null;

    const attackCadenceReady =
      effectiveButton === 'heavy' ||
      isPerfectDodgeHoldJ ||
      isAstralHoldJ ||
      (p.attackCooldownTimer ?? 0) <= 0;

    if (effectiveButton && canChainAttack && attackCadenceReady) {
      if (moveDir !== 0) {
        p.facing = moveDir > 0 ? 1 : -1;
      }

      const refreshedPhase = getMovePhase(p.moveId, p.moveTimer);
      const nextMove = resolveNextAttackMove({
        button: effectiveButton,
        grounded: p.grounded,
        holdUp: this.keysHeld.has('w'),
        holdDown: holdingDown,
        currentMove: p.moveId,
        comboWindowOpen:
          p.comboWindowTimer > 0 ||
          refreshedPhase === 'recovery' ||
          (refreshedPhase === 'active' && p.moveHitIds.size > 0),
        airComboCount: p.airComboCount,
        dashAfterAttackOpen: p.dashAfterAttackWindow > 0,
        perfectDodgeWindowOpen: p.perfectDodgeWindow > 0,
        zanshinGlintOpen: p.zanshinFlashTimer > 0,
        bladeEnergy: p.bladeEnergy,
        dimensionCutCost: mods.dimensionCutCost,
        savedComboStage: p.savedComboStage ?? 0,
        holdingAttack: this.keysHeld.has('j'),
      });

      if (nextMove) {
        p.attackBufferTimer = 0;
        p.attackBufferType = null;
        this.beginPlayerMove(nextMove, mods, effectiveButton);
      }
    }

    // Step active combat move (`赤刃`, `星术`, `月魄` step at exact 1.0x real-time while world slows to 0.2x!)
    if (p.moveId !== MoveId.None) {
      const prevPhase = getMovePhase(p.moveId, p.moveTimer);
      const isTimeSlowMove =
        p.moveId === MoveId.MoonCounter ||
        p.moveId === MoveId.AstralSlash ||
        p.moveId === MoveId.HeavyCrescent ||
        p.moveId === MoveId.DimensionCut ||
        Boolean(p.lunarLActive);
      const moveStepRate = isTimeSlowMove ? 1.0 : 1 + (mods.attackSpeedMult - 1) * 0.65;
      p.moveTimer += dt * moveStepRate;
      const nowPhase = getMovePhase(p.moveId, p.moveTimer);
      const spec = MOVES[p.moveId];

      if (prevPhase === 'windup' && nowPhase === 'active') {
        p.vx = computeAttackImpulseVx(p.grounded, p.vx, p.facing, moveDir, spec);
        if (spec.selfVy !== 0) {
          p.vy = spec.selfVy;
          if (spec.selfVy < 0) p.grounded = false;
        }
        p.scaleX = spec.slashStyle === 'uppercut' ? 0.88 : 1.14;
        p.scaleY = spec.slashStyle === 'uppercut' ? 1.15 : 0.89;

        if (p.moveId === MoveId.DimensionCut) {
          // 月魄终极秘技 (`DimensionCut` — L-key exclusive)
          const dimRadMult = mods.lunarSlashRadiusMult;
          this.pfx.spawnRing(
            p.x + p.facing * 52,
            p.y - 24,
            Math.round(96 * dimRadMult),
            0.34,
            118,
            88,
            200,
            true
          );
          this.pfx.spawnSlash({
            x: p.x + p.facing * 20,
            y: p.y + spec.offsetY,
            facing: p.facing,
            style: 'dimension',
            palette: 'violet',
            duration: 0.32,
            radiusX: Math.min(114, Math.round(spec.reachX * dimRadMult)),
            radiusY: Math.round(spec.reachY * 0.88 * dimRadMult),
            owner: 'player',
            sourceId: p.moveInstanceId,
            anchorEntityId: 0,
            offsetX: p.facing * 20,
            offsetY: spec.offsetY,
            trackUntilElapsed: spec.active,
          });
          this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.44);
          sound.playDimensionCut();
        } else if (p.moveId === MoveId.AstralSlash) {
          // ★ 星术 (`Tactics` — 唯一远程手段 `收到后按住J触发，表现为远程斩击`):
          // Fires long-range piercing Astral Crescent Sword Waves + Homing Star-Blades + PixelFX Sky-Bolts / Nova!
          const cx = p.x + p.facing * 24;
          const cy = p.y - 20;
          sound.playAstralSlash(p.astraChainCount ?? 1);
          this.pfx.spawnRing(cx, cy, 68, 0.3, 78, 242, 255, false);
          this.pfx.spawnRing(cx, cy, 106, 0.4, 192, 124, 255, false);
          this.pfx.spawnSlash({
            x: cx,
            y: p.y + spec.offsetY,
            facing: p.facing,
            style: 'astral_wave',
            palette: 'cyan',
            duration: 0.28,
            radiusX: 98,
            radiusY: 46,
            owner: 'player',
            sourceId: p.moveInstanceId,
            anchorEntityId: 0,
            offsetX: p.facing * 24,
            offsetY: spec.offsetY,
            trackUntilElapsed: spec.active,
          });
          this.pfx.spawnSlash({
            x: cx + p.facing * 10,
            y: p.y + spec.offsetY - 2,
            facing: p.facing,
            style: 'arc_up',
            palette: 'violet',
            duration: 0.24,
            radiusX: 84,
            radiusY: 36,
            owner: 'player',
            sourceId: p.moveInstanceId,
            anchorEntityId: 0,
            offsetX: p.facing * 34,
            offsetY: spec.offsetY - 2,
            trackUntilElapsed: spec.active,
          });
          this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.42);

          // Primary Ranged Astral Crescent Sword Waves (2 waves base, +1 with `GrandSeeker`)
          const hasGrandSeeker = (this.upgradeLevels[UpgradeId.GrandSeeker] ?? 0) > 0;
          const astralWaveCount = 2 + (hasGrandSeeker ? 1 : 0);
          const baseWaveDamage = Math.round(
            (32 + mods.tacticsCount * 6) * mods.globalDamageMult * mods.zanshinLSkillMult
          );
          for (let w = 0; w < astralWaveCount; w++) {
            const spreadVy = w === 0 ? 0 : w === 1 ? -14 : 14;
            this.projectiles.push({
              id: this.nextEntityId++,
              x: p.x + p.facing * (18 + w * 14),
              y: p.y - 20 - (w === 1 ? 5 : w === 2 ? -4 : 0),
              vx: p.facing * (355 + w * 30),
              vy: spreadVy,
              radius: 9.2,
              damage: baseWaveDamage,
              fromPlayer: true,
              color: w % 2 === 0 ? 'cyan' : 'violet',
              life: 1.25,
              deflected: false,
              piercing: true,
              isSwordWave: true,
              hitIds: new Set<number>(),
            });
          }

          // Homing Star-Blades (`星蚀飞刃`) — exclusive to `星术`!
          const astralBladeTotal = Math.max(4, mods.astralBladeCount > 0 ? mods.astralBladeCount + 3 : 4);
          const baseBladeDmg = Math.max(16, mods.astralBladeDamage || 18);
          for (let b = 0; b < astralBladeTotal; b++) {
            const spread = (b - (astralBladeTotal - 1) * 0.5) * 0.2;
            const ang = (p.facing === 1 ? -0.2 : Math.PI + 0.2) + spread;
            this.projectiles.push({
              id: this.nextEntityId++,
              x: p.x + p.facing * 16,
              y: p.y - 22 - (b % 3) * 3,
              vx: Math.cos(ang) * 280,
              vy: Math.sin(ang) * 280,
              radius: 4.4,
              damage: Math.round(baseBladeDmg * mods.globalDamageMult * mods.zanshinLSkillMult),
              fromPlayer: true,
              color: b % 2 === 0 ? 'cyan' : 'violet',
              life: 2.4,
              deflected: false,
              homing: true,
              piercing: hasGrandSeeker,
              hitIds: hasGrandSeeker ? new Set<number>() : undefined,
            });
          }

          // Astral Nova (`星璇爆裂`) — pixel-exact expanding ring!
          if (mods.astralNovaDamage > 0) {
            this.pfx.spawnRing(cx, cy, 136, 0.44, 96, 236, 255, false, {
              owner: 'player',
              damage: Math.round(
                mods.astralNovaDamage * mods.globalDamageMult * mods.zanshinLSkillMult
              ),
              damageColor: 'cyan',
              chillSec: 2.2,
              dirX: p.facing,
            });
          }

          // Sky-Lightning / Meteor Spears (`星雷连锁` / `群星陨落`) — pooled SimBolt pixel-exact strikes!
          if (mods.chainBoltDamage > 0 || mods.meteorCount > 0) {
            const skyTargets = this.enemies
              .filter(
                (e) =>
                  e.aiState !== EnemyAIState.KO &&
                  e.aiState !== EnemyAIState.Spawn &&
                  e.hp > 0 &&
                  Math.abs(e.x - p.x) <= 270
              )
              .slice(0, Math.max(2, mods.chainBoltTargets + mods.meteorCount));
            const skyDmg = Math.round(
              (18 + mods.chainBoltDamage + (mods.meteorCount > 0 ? mods.meteorDamage : 0)) *
                mods.globalDamageMult *
                mods.zanshinLSkillMult
            );
            for (const target of skyTargets) {
              const tx = target.x;
              const ty = target.y - 18;
              this.pfx.spawnBolt({
                x0: tx + (Math.random() - 0.5) * 16,
                y0: Math.max(8, ty - 148),
                x1: tx,
                y1: target.y - 4,
                palette: 'cyan',
                duration: 0.24,
                thickness: 3,
                owner: 'player',
                damage: skyDmg,
                damageColor: 'cyan',
                chillSec: 2.0,
              });
              this.pfx.spawnRing(tx, ty, 38, 0.26, 92, 242, 255, false);
            }
          }
        } else {
          const comboStep =
            p.moveId === MoveId.Slash2
              ? 1
              : p.moveId === MoveId.Slash3
                ? 2
                : p.moveId === MoveId.Slash4 || p.moveId === MoveId.MoonCounter
                  ? 3
                  : 0;
          if (p.moveId === MoveId.MoonCounter) {
            sound.playCrimsonSlash();
          } else if (p.lunarLActive || p.moveId === MoveId.HeavyCrescent) {
            sound.playLunarSkill(false);
          } else {
            sound.playSlash(comboStep, spec.heavyBreak);
          }

          const slashPalette =
            p.moveId === MoveId.MoonCounter
              ? 'crimson'
              : p.lunarLActive || p.moveId === MoveId.HeavyCrescent
                ? 'violet'
                : spec.slashColor;

          const lunarScale =
            p.lunarLActive || p.moveId === MoveId.HeavyCrescent ? mods.lunarSlashRadiusMult : 1;
          const offX1 = p.facing * (p.moveId === MoveId.MoonCounter ? 24 : 16);
          this.pfx.spawnSlash({
            x: p.x + offX1,
            y: p.y + spec.offsetY,
            facing: p.facing,
            style: p.moveId === MoveId.MoonCounter ? 'counter' : spec.slashStyle,
            palette: slashPalette,
            duration: Math.max(0.18, spec.active + 0.09),
            radiusX: Math.min(120, spec.reachX * (p.lunarLActive ? 1.15 * lunarScale : 1)),
            radiusY: spec.reachY * (p.lunarLActive ? 1.05 * lunarScale : 0.92),
            owner: 'player',
            sourceId: p.moveInstanceId,
            anchorEntityId: 0,
            offsetX: offX1,
            offsetY: spec.offsetY,
            trackUntilElapsed: spec.active,
          });

          if (spec.heavyBreak || p.moveId === MoveId.Slash3 || p.lunarLActive) {
            const offX2 = p.facing * 18;
            this.pfx.spawnSlash({
              x: p.x + offX2,
              y: p.y + spec.offsetY - 2,
              facing: p.facing,
              style: spec.slashStyle === 'wide_cleave' ? 'arc_up' : 'arc_down',
              palette: p.lunarLActive ? 'cyan' : slashPalette,
              duration: 0.24,
              radiusX: Math.min(108, spec.reachX * 0.94 * lunarScale),
              radiusY: spec.reachY * 0.72 * lunarScale,
              owner: 'player',
              sourceId: p.moveInstanceId,
              anchorEntityId: 0,
              offsetX: offX2,
              offsetY: spec.offsetY - 2,
              trackUntilElapsed: spec.active,
            });
          }

          if (p.lunarLActive || p.moveId === MoveId.HeavyCrescent) {
            this.pfx.spawnRing(p.x + p.facing * 22, p.y - 20, 72, 0.32, 165, 180, 255, false);
            this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.34);
          }

          if (p.moveId === MoveId.MoonCounter) {
            // 赤刃 (`Brutality`): Single Devastating Crimson Execution Slash (`一刀强力斩击`) — pure melee!
            this.pfx.spawnRing(p.x + p.facing * 28, p.y - 20, 88, 0.36, 255, 64, 114, false);
            this.pfx.spawnRing(p.x + p.facing * 28, p.y - 20, 116, 0.44, 196, 28, 76, false);
            this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.48);

            // `绯月断空` (`ScarletWave`): oversized close-range melee crimson cross-slash (zero projectiles!)
            if (mods.scarletWaveDamage > 0) {
              this.pfx.spawnSlash({
                x: p.x + p.facing * 28,
                y: p.y + spec.offsetY - 2,
                facing: p.facing,
                style: 'wide_cleave',
                palette: 'crimson',
                duration: 0.28,
                radiusX: 98,
                radiusY: 46,
                owner: 'player',
                anchorEntityId: 0,
                offsetX: p.facing * 28,
                offsetY: spec.offsetY - 2,
                trackUntilElapsed: spec.active,
                auxDamage: Math.round(
                  mods.scarletWaveDamage * mods.globalDamageMult * mods.crimsonSlashMult
                ),
                auxColor: 'crimson',
                applyBleed: 1,
              });
            }
            // `血影旋涡` (`CrimsonVortex`): pixel-exact crimson shockwave ring!
            if (mods.crimsonVortexDamage > 0) {
              this.pfx.spawnRing(p.x + p.facing * 30, p.y - 18, 98, 0.36, 255, 48, 96, false, {
                owner: 'player',
                damage: Math.round(
                  mods.crimsonVortexDamage * mods.globalDamageMult * mods.crimsonSlashMult
                ),
                damageColor: 'crimson',
                dirX: p.facing,
              });
            }
          }

          for (let b = 0; b < (spec.heavyBreak ? 7 : 3); b++) {
            this.pfx.spawnParticle({
              kind: 'spark',
              x: p.x + p.facing * (18 + Math.random() * 26),
              y: p.y + spec.offsetY + (Math.random() - 0.5) * 18,
              floorY: p.y + 4,
              vx: p.facing * (70 + Math.random() * 110),
              vy: (Math.random() - 0.5) * 90,
              gravity: 160,
              drag: 0.96,
              bounce: 0.4,
              maxLife: 0.2 + Math.random() * 0.12,
              size: 1,
              r: p.moveId === MoveId.MoonCounter ? 255 : 220,
              g: p.moveId === MoveId.MoonCounter ? 110 : 242,
              b: p.moveId === MoveId.MoonCounter ? 150 : 255,
              lightR: 42,
              lightG: 72,
              lightB: 115,
            });
          }
        }

        // 月魄 (`Lunar` — `VoidEclipse` `虚空月蚀`): pixel-exact Lunar Eclipse Nova ring on L-key skills!
        if (
          mods.voidEclipseNovaDamage > 0 &&
          (p.lunarLActive ||
            p.moveId === MoveId.HeavyCrescent ||
            p.moveId === MoveId.DimensionCut)
        ) {
          this.pfx.spawnRing(p.x + p.facing * 22, p.y - 20, 78, 0.32, 165, 145, 255, false, {
            owner: 'player',
            damage: Math.round(
              mods.voidEclipseNovaDamage * mods.globalDamageMult * mods.lSkillDamageMult
            ),
            damageColor: 'violet',
            dirX: p.facing,
          });
        }

        // 月魄 (`Lunar` — `朔月重弧` & `双月叠斩`): close-range melee concentric slash arcs (zero projectiles!)
        if (
          mods.moonWaveDamage > 0 &&
          (p.lunarLActive ||
            p.moveId === MoveId.HeavyCrescent ||
            p.moveId === MoveId.DimensionCut ||
            p.moveId === MoveId.Slash4)
        ) {
          this.pfx.spawnSlash({
            x: p.x + p.facing * 24,
            y: p.y + spec.offsetY,
            facing: p.facing,
            style: 'arc_down',
            palette: 'cyan',
            duration: 0.25,
            radiusX: Math.round(86 * mods.lunarSlashRadiusMult),
            radiusY: Math.round(42 * mods.lunarSlashRadiusMult),
            owner: 'player',
            anchorEntityId: 0,
            offsetX: p.facing * 24,
            offsetY: spec.offsetY,
            trackUntilElapsed: spec.active,
            auxDamage: Math.round(
              mods.moonWaveDamage * mods.globalDamageMult * mods.lSkillDamageMult
            ),
            auxColor: 'cyan',
            energyOnHit: 6 + mods.siphonEnergyOnHit,
          });
        }

        if (
          mods.twinWaveDamage > 0 &&
          (p.lunarLActive ||
            p.moveId === MoveId.HeavyCrescent ||
            p.moveId === MoveId.DimensionCut)
        ) {
          this.pfx.spawnSlash({
            x: p.x + p.facing * 28,
            y: p.y + spec.offsetY - 3,
            facing: p.facing,
            style: 'arc_up',
            palette: 'violet',
            duration: 0.26,
            radiusX: Math.round(92 * mods.lunarSlashRadiusMult),
            radiusY: Math.round(44 * mods.lunarSlashRadiusMult),
            owner: 'player',
            anchorEntityId: 0,
            offsetX: p.facing * 28,
            offsetY: spec.offsetY - 3,
            trackUntilElapsed: spec.active,
            auxDamage: Math.round(
              mods.twinWaveDamage * mods.globalDamageMult * mods.lSkillDamageMult
            ),
            auxColor: 'violet',
            energyOnHit: 4,
          });
        }

        // 连袭 (`Onslaught` — `超音速斩` `HyperSonicSlash`): close-range melee gale slash on Slash4 (zero projectiles!)
        if (mods.hypersonicSlashDamage > 0 && p.moveId === MoveId.Slash4) {
          this.pfx.spawnSlash({
            x: p.x + p.facing * 22,
            y: p.y + spec.offsetY,
            facing: p.facing,
            style: 'spin',
            palette: 'cyan',
            duration: 0.24,
            radiusX: 82,
            radiusY: 40,
            owner: 'player',
            anchorEntityId: 0,
            offsetX: p.facing * 22,
            offsetY: spec.offsetY,
            trackUntilElapsed: spec.active,
            auxDamage: Math.round(
              mods.hypersonicSlashDamage * mods.globalDamageMult * mods.meleeDamageMult
            ),
            auxColor: 'cyan',
          });
        }

        if (
          p.moveId === MoveId.SlideSlash ||
          p.moveId === MoveId.DashThrust ||
          p.moveId === MoveId.MoonCounter ||
          p.moveId === MoveId.AstralSlash ||
          p.moveId === MoveId.HeavyCrescent ||
          p.moveId === MoveId.RisingMoon ||
          p.moveId === MoveId.Slash3 ||
          p.moveId === MoveId.Slash4 ||
          p.moveId === MoveId.DimensionCut ||
          p.lunarLActive
        ) {
          const snapPose = computeAriaPose(p, this.totalTime);
          this.pfx.spawnAfterimage(
            p.x,
            p.y,
            p.facing,
            p.moveId === MoveId.SlideSlash ? 'slide' : 'slash',
            p.moveId === MoveId.MoonCounter
              ? 255
              : p.moveId === MoveId.DimensionCut || p.lunarLActive
                ? 135
                : 96,
            p.moveId === MoveId.MoonCounter
              ? 85
              : p.moveId === MoveId.DimensionCut || p.lunarLActive
                ? 148
                : 235,
            p.moveId === MoveId.MoonCounter ? 135 : 255,
            snapPose.torsoLeanX,
            snapPose.torsoDropY,
            snapPose.bladeAngle
          );
          if (p.moveId === MoveId.SlideSlash) {
            this.pfx.spawnDustBurst(p.x, p.y, p.facing, 7);
          }
        }
      }

      if (nowPhase === 'active') {
        this.evaluatePlayerHitbox(spec, room, mods);
      }

      if (p.moveId === MoveId.HelmSplitter && p.grounded && p.moveTimer > spec.windup + 0.02) {
        if (!p.moveHitIds.has(-999)) {
          p.moveHitIds.add(-999);
          p.scaleX = 1.28;
          p.scaleY = 0.74;
          p.landRecoveryTimer = 0.15;
          this.pfx.spawnRing(p.x + p.facing * 14, p.y - 2, 46, 0.24, 205, 125, 255, false, {
            owner: 'player',
            damage: Math.round(22 * mods.globalDamageMult * mods.lSkillDamageMult),
            damageColor: 'violet',
            dirX: p.facing,
          });
          this.pfx.spawnDustBurst(p.x, p.y, 1, 10);
          this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.35);
          sound.playHit(true, false);
        }
      }

      if (nowPhase === 'done') {
        p.comboWindowTimer = COMBO_WINDOW_MAX;
        p.moveId = MoveId.None;
        p.moveTimer = 0;
        p.empoweredLActive = false;
        p.crimsonFlashActive = false;
        p.lunarLActive = false;
        // Sheathe delay: base 1.0s, halved consecutively (`0.5s -> 0.25s -> 0.125s -> 0.08s`) on each `星术` trigger!
        p.zanshinPending = true;
        p.zanshinTimer = computeZanshinSheatheDelay(p.astraChainCount ?? 0);
        p.zanshinFlashTimer = 0;
      }
    }

    // 4. Locomotion, Snappy Turn-Skid, Jump, Wall-Jump & Multi-Jump!
    const effectiveRunSpeed = PLAYER_RUN_SPEED * mods.moveSpeedMult;
    if (!p.isDashing && p.moveId === MoveId.None && p.hurtTimer <= 0.08) {
      if (p.wallJumpLockTimer <= 0) {
        if (moveDir !== 0 && !p.crouching) {
          if (p.grounded && Math.abs(p.vx) > 95 && moveDir * p.vx < 0 && p.skidTimer <= 0) {
            p.skidTimer = 0.11;
            p.vx *= 0.25;
            this.pfx.spawnDustBurst(p.x, p.y, moveDir, 5);
          }
          p.facing = moveDir > 0 ? 1 : -1;
          const targetSpeed =
            !p.grounded && Math.abs(p.vx) > effectiveRunSpeed && moveDir * p.vx > 0
              ? Math.abs(p.vx)
              : effectiveRunSpeed;
          const accel = p.grounded ? (p.skidTimer > 0 ? 2600 : 2050) : 1450;
          p.vx += (moveDir * targetSpeed - p.vx) * Math.min(1, dt * (accel / effectiveRunSpeed));
        } else {
          const decel = p.grounded ? 18 : 3.2;
          p.vx *= Math.max(0, 1 - dt * decel);
        }
      }

      if (p.jumpBufferTimer > 0) {
        if (p.coyoteTimer > 0) {
          p.jumpBufferTimer = 0;
          p.coyoteTimer = 0;
          p.grounded = false;
          p.vy = PLAYER_JUMP_VY;
          p.scaleX = 0.84;
          p.scaleY = 1.2;
          this.pfx.spawnDustBurst(p.x, p.y, p.facing, 6);
          sound.playJump();
        } else if (!p.grounded && p.wallSlideSide !== 0) {
          p.jumpBufferTimer = 0;
          const kickDir: 1 | -1 = p.wallSlideSide === 1 ? -1 : 1;
          p.facing = kickDir;
          p.vx = kickDir * WALL_JUMP_VX;
          p.vy = WALL_JUMP_VY;
          p.wallSlideSide = 0;
          p.wallJumpLockTimer = 0.12;
          p.spinFlipTimer = 0.25;
          p.airComboCount = 0;
          p.scaleX = 0.84;
          p.scaleY = 1.2;
          this.pfx.spawnDustBurst(p.x - kickDir * 5, p.y - 12, kickDir, 7);
          this.pfx.spawnAfterimage(p.x, p.y, kickDir, 'flip', 130, 215, 255);
          sound.playJump();
        } else if (!p.grounded && p.jumpsRemaining > 0) {
          p.jumpBufferTimer = 0;
          p.jumpsRemaining--;
          p.vy = PLAYER_DOUBLE_JUMP_VY;
          if (moveDir !== 0) {
            p.facing = moveDir > 0 ? 1 : -1;
            p.vx = moveDir * Math.max(PLAYER_RUN_SPEED, Math.abs(p.vx));
          }
          p.spinFlipTimer = 0.28;
          p.airComboCount = 0;
          p.scaleX = 0.86;
          p.scaleY = 1.18;
          this.pfx.spawnRing(p.x, p.y - 2, 26, 0.22, 130, 235, 255, false);
          this.pfx.spawnAfterimage(p.x, p.y, p.facing, 'flip', 150, 235, 255);
          sound.playJump();
        }
      }
    } else if (!p.isDashing && p.moveId !== MoveId.None) {
      if (!p.grounded) {
        if (moveDir !== 0) {
          p.vx += moveDir * 440 * dt;
          p.vx = Math.max(-235, Math.min(235, p.vx));
        } else {
          p.vx *= Math.max(0, 1 - dt * 1.4);
        }
      } else {
        const slideFriction = p.moveId === MoveId.SlideSlash ? 3.8 : 7.8;
        p.vx *= Math.max(0, 1 - dt * slideFriction);
      }
    }

    if (!p.isDashing) {
      const airHangScale =
        !p.grounded &&
        (p.moveId === MoveId.AirSlash1 ||
          p.moveId === MoveId.AirSlash2 ||
          p.moveId === MoveId.AstralSlash)
          ? p.moveId === MoveId.AstralSlash
            ? 0.18
            : 0.26
          : 1.0;
      p.vy += GRAVITY * airHangScale * dt;
    }

    const prevX = p.x;
    const prevY = p.y;
    const preSolveVy = p.vy;
    const wasGrounded = p.grounded;
    const activeHeight = p.moveId === MoveId.SlideSlash ? 18 : PLAYER_HEIGHT;

    const solved = resolveRoomMovement({
      prevX,
      prevY,
      nextX: p.x + p.vx * dt,
      nextY: p.y + p.vy * dt,
      vx: p.vx,
      vy: p.vy,
      halfW: PLAYER_HALF_W,
      height: activeHeight,
      dropThrough: p.dropThroughTimer > 0,
      platforms: room.platforms,
      activeSeal: this.getActiveSealRect(room),
      lockedExitBarriers: this.getLockedExitBarriers(room),
    });

    p.x = solved.x;
    p.y = solved.y;
    p.vx = solved.vx;
    p.vy = solved.vy;
    p.grounded = solved.grounded;
    p.wallSlideSide = solved.wallSlideSide;

    // Pixel-exact K-Dash Perfect Dodge (`K键闪避也必须穿过特效像素才能视为完美闪避`):
    // Check whether Aria's swept dash trajectory `[prevX, prevY] -> [p.x, p.y]` crossed >= 1 hostile VFX pixel!
    if (p.isDashing && !p.dashPerfectTriggered) {
      this.checkDashCrossingHostilePixels(prevX, prevY, p.x, p.y, mods);
    }

    if (!p.grounded && p.wallSlideSide !== 0 && p.vy > WALL_SLIDE_MAX_VY && p.moveId === MoveId.None) {
      p.vy = WALL_SLIDE_MAX_VY;
      if (Math.random() < 0.35) {
        this.pfx.spawnParticle({
          kind: 'smoke',
          x: p.x + p.wallSlideSide * 6,
          y: p.y - 6,
          vx: -p.wallSlideSide * 18,
          vy: -12,
          gravity: -10,
          drag: 0.94,
          bounce: 0,
          maxLife: 0.2,
          size: 2,
          r: 165,
          g: 185,
          b: 225,
          lightR: 12,
          lightG: 14,
          lightB: 24,
        });
      }
    }

    // 16-Frame 2-Step Sprint Cadence (~4.36 steps/sec, ~35 anim fps) + Heel-Strike Dust & Footstep SFX on Contact Frames!
    if (p.grounded && Math.abs(p.vx) > 8) {
      p.gaitPhase += Math.abs(p.vx) * dt * 0.078;
      const curStep = Math.floor(p.gaitPhase / Math.PI);
      if (curStep !== this.prevStrideStep && Math.abs(p.vx) > 105 && !p.crouching) {
        this.prevStrideStep = curStep;
        this.pfx.spawnDustBurst(p.x - p.facing * 4, p.y, p.facing, 2);
        sound.playFootstep();
      }
    } else if (p.grounded && Math.abs(p.vx) <= 4 && p.moveId === MoveId.None) {
      // Prime stationary phase at scissor step-out (`runK2 -> runK3`, `0.34 * 2π`) so starting a run from idle steps out naturally!
      p.gaitPhase = Math.PI * 0.68;
      this.prevStrideStep = 0;
    }

    if (p.grounded) {
      if (!wasGrounded && preSolveVy > 35) {
        const impactRatio = Math.min(1, preSolveVy / 360);
        p.scaleX = 1 + 0.24 * impactRatio;
        p.scaleY = 1 - 0.22 * impactRatio;
        p.landRecoveryTimer = 0.13 * impactRatio;
        p.spinFlipTimer = 0;
        this.pfx.spawnDustBurst(p.x, p.y, 0, Math.max(4, Math.round(8 * impactRatio)));
      }
      p.airComboCount = 0;
      p.airDashesUsed = 0;
      p.jumpsRemaining =
        (this.collectedRelics.has(RelicId.DoubleJump) ? 1 : 0) + mods.extraAirJumps;

      if (!solved.touchedHazard) {
        p.lastSafeX = p.x;
        p.lastSafeY = p.y;
      }
    }

    if (solved.touchedHazard && p.invulnTimer <= 0) {
      this.damagePlayer(18, -p.facing as 1 | -1);
      if (p.hp > 0) {
        p.x = p.lastSafeX;
        p.y = p.lastSafeY;
        p.vx = 0;
        p.vy = 0;
      }
    }
  }

  private stepRoomInteractionsAndTransitions(): void {
    const p = this.player;
    const room = this.getCurrentRoom();
    this.interactPrompt = null;

    // 1. Existing Reward Point: Relic Pickup -> Grants Relic + Opens 3-Choice Ability Draft!
    if (room.relic && !this.collectedRelics.has(room.relic.relicId)) {
      const rl = room.relic;
      if (Math.abs(p.x - rl.x) <= 22 && Math.abs(p.y - rl.y) <= 28) {
        this.collectedRelics.add(rl.relicId);
        this.score += 500;
        if (rl.relicId === RelicId.DoubleJump) {
          this.baseMaxHp += 20;
          this.syncPlayerMaxHp(true);
          p.jumpsRemaining = 1 + this.getMods().extraAirJumps;
        }
        p.hp = p.maxHp;
        p.rallyHp = p.maxHp;
        this.pfx.screenFlash = 0.3;
        this.pfx.screenFlashColor = { r: 165, g: 225, b: 255 };
        this.pfx.spawnRing(rl.x, rl.y - 16, 64, 0.4, 130, 235, 255, false);
        this.pfx.spawnHitSparks(rl.x, rl.y - 16, 0, 'cyan', true, rl.y);
        this.showToast(`习得古月遗物【${rl.nameZh}】 · 觉醒赐福三选一！`, 4.0);
        this.openUpgradeDraft(`古月遗物共鸣 · ${rl.nameZh}`, rl.subtitleZh);
        return;
      }
    }

    // 2. Existing Reward Point: Vitality Vessel Pickup -> +Max HP + Full Heal + Opens 3-Choice Draft!
    if (room.vessel && !this.collectedVessels.has(room.vessel.id)) {
      const vs = room.vessel;
      if (Math.abs(p.x - vs.x) <= 22 && Math.abs(p.y - vs.y) <= 28) {
        this.collectedVessels.add(vs.id);
        this.score += 350;
        this.baseMaxHp += vs.bonusHp;
        this.syncPlayerMaxHp(true);
        p.hp = p.maxHp;
        p.rallyHp = p.maxHp;
        this.pfx.screenFlash = 0.26;
        this.pfx.screenFlashColor = { r: 120, g: 245, b: 195 };
        this.pfx.spawnRing(vs.x, vs.y - 14, 54, 0.36, 110, 245, 195, false);
        this.pfx.spawnPopup(`+${vs.bonusHp}`, p.x, p.y - 40, 120, 255, 195);
        this.showToast(`获得【${vs.nameZh}】 · 生命上限 +${vs.bonusHp} 并开启能力三选一！`, 3.6);
        this.openUpgradeDraft(
          `圣杯赐福 · ${vs.nameZh}`,
          `生命上限永久 +${vs.bonusHp}，请再择一门流派秘技`
        );
        return;
      }
    }

    // 3. Blessing Scroll Altar (`赐福卷轴台`) -> Auto-claim on touch or `[E]` for Dead Cells 3-Choice Draft!
    if (room.altar && !this.collectedAltars.has(room.altar.id)) {
      const alt = room.altar;
      if (Math.abs(p.x - alt.x) <= 20 && Math.abs(p.y - alt.y) <= 28) {
        this.collectedAltars.add(alt.id);
        this.score += 250;
        this.pfx.spawnRing(alt.x, alt.y - 16, 52, 0.34, 255, 214, 118, false);
        const scrollTitle = alt.nameZh.startsWith('赐福卷轴')
          ? alt.nameZh
          : `赐福卷轴 · ${alt.nameZh}`;
        this.openUpgradeDraft(scrollTitle, '自赤刃、星术、坚毅三系秘卷中择一铭刻');
        return;
      }
    }

    // 4. Existing Reward Point: Lunar Shrine Checkpoint & Soul Forge (`[E]`)
    if (room.shrine) {
      const sh = room.shrine;
      if (Math.abs(p.x - sh.x) <= 30 && Math.abs(p.y - sh.y) <= 28) {
        const firstBlessing = !this.shrinesBlessed.has(sh.id);
        const forgeCost = getSoulForgeCost(this.forgesPurchased);
        if (firstBlessing) {
          this.interactPrompt = `按 [E] 共鸣【${sh.nameZh}】 · 全回复并免费开启能力三选一`;
        } else if (this.souls >= forgeCost) {
          this.interactPrompt = `按 [E] 献祭 ${forgeCost} 月魄锻造升级 · 全回复并开启能力三选一`;
        } else {
          this.interactPrompt = `按 [E] 于【${sh.nameZh}】休整 · 全回复 (月魄锻造需 ${forgeCost} 月魄)`;
        }

        if (this.keysJustPressed.has('e')) {
          this.activeShrineId = sh.id;
          const healAmt = p.maxHp - p.hp;
          p.hp = p.maxHp;
          p.rallyHp = p.maxHp;
          p.stamina = p.maxStamina;
          p.bladeEnergy = Math.max(p.bladeEnergy, 50);
          // Regular rooms refresh on Shrine rest; defeated Boss rooms remain permanently cleared!
          this.clearedRooms.clear();
          for (const bossRoom of this.defeatedBossRooms) {
            this.clearedRooms.add(bossRoom);
          }
          this.mapStateVersion++;

          this.pfx.spawnRing(sh.x, sh.y - 18, 52, 0.35, 145, 235, 255, false);
          if (healAmt > 0) {
            this.pfx.spawnPopup(`+${Math.round(healAmt)}`, p.x, p.y - 38, 130, 255, 210);
          }

          if (firstBlessing) {
            this.shrinesBlessed.add(sh.id);
            this.openUpgradeDraft(
              `祭坛初祷 · ${sh.nameZh}`,
              '银月祭坛首次共鸣赐福 · 生命已回满，请选择一项能力强化'
            );
            return;
          } else if (this.souls >= forgeCost) {
            this.souls -= forgeCost;
            this.forgesPurchased++;
            this.openUpgradeDraft(
              `月魄锻炉 · ${sh.nameZh}`,
              `已凝练 ${forgeCost} 枚月魄 · 请选择一项能力强化`
            );
            return;
          } else {
            sound.playRelicChime();
            this.showToast(`已共鸣【${sh.nameZh}】 · 攒够 ${forgeCost} 月魄可在此锻造升级`, 2.8);
            this.emitHudSnapshot(true);
          }
        }
      }
    }

    // 5. Room Transitions (Blocked while room has active undefeated enemies: `未击杀当前房间所有敌人时关闭出口`)
    const lockedBarriers = this.getLockedExitBarriers(room);
    if (lockedBarriers.length > 0) {
      if (this.lockToastCooldown <= 0) {
        const nearGate = lockedBarriers.some(
          (b) =>
            p.x + PLAYER_HALF_W + 18 >= b.x &&
            p.x - PLAYER_HALF_W - 18 <= b.x + b.w &&
            p.y >= b.y - 12 &&
            p.y - PLAYER_HEIGHT <= b.y + b.h + 12
        );
        if (nearGate) {
          this.lockToastCooldown = 2.2;
          this.showToast(`房间封锁中 · 击败剩余 ${this.enemies.length} 名敌人开启出口`, 2.0);
        }
      }
      return;
    }

    const exit = findTriggeredExit(p.x, p.y, PLAYER_HEIGHT, room.exits);
    if (exit) {
      this.enterRoom(exit.targetRoom, exit.spawnX, exit.spawnY, false);
    }
  }

  private beginPlayerMove(
    moveId: MoveId,
    mods: UpgradeModifiers,
    buttonUsed: 'light' | 'heavy' = 'light'
  ): void {
    const p = this.player;
    const spec = MOVES[moveId];
    const isLSkill = isLKeySkillMove(moveId, buttonUsed === 'heavy');

    // 1. 星术 (`Tactics` — `收到后按住J触发，激发后减半收刀时间，连续激发连续减少`)
    if (moveId === MoveId.AstralSlash) {
      const nextChain = (p.astraChainCount ?? 0) + 1;
      p.astraChainCount = nextChain;
      p.empoweredLActive = false;
      p.lunarLActive = false;
      p.zanshinPending = false;
      p.zanshinFlashTimer = 0;
      p.invulnTimer = Math.max(p.invulnTimer, mods.empoweredLRefillsStamina ? 0.85 : 0.54);
      if (mods.empoweredLRefillsStamina) {
        p.stamina = Math.min(p.maxStamina, p.stamina + 1.0);
      }
      const nextDelay = computeZanshinSheatheDelay(nextChain);
      this.pfx.spawnRing(p.x, p.y - 20, 72, 0.32, 78, 242, 255, false);
      this.pfx.spawnRing(p.x, p.y - 20, 104, 0.42, 198, 128, 255, false);
      this.pfx.spawnPopup(`星芒绝斩·连闪x${nextChain} (${nextDelay}s收刀)`, p.x, p.y - 46, 108, 246, 255);
    } else if (isLSkill) {
      // 2. 月魄 (`Lunar` — `L键完全属于月魄的` + 0.2x world time-slow)
      p.lunarLActive = true;
      p.empoweredLActive = false;
      p.astraChainCount = 0;
      p.zanshinPending = false;
      p.zanshinFlashTimer = 0;
      const cost = moveId === MoveId.DimensionCut ? mods.dimensionCutCost : spec.energyCost;
      if (cost > 0) {
        p.bladeEnergy = Math.max(0, p.bladeEnergy - cost);
      }
      if (mods.lSkillEnergyRefund > 0) {
        p.bladeEnergy = Math.min(p.maxBladeEnergy, p.bladeEnergy + mods.lSkillEnergyRefund);
      }
      p.invulnTimer = Math.max(p.invulnTimer, moveId === MoveId.DimensionCut ? 0.85 : 0.45);
      this.pfx.spawnPopup(
        moveId === MoveId.DimensionCut ? '月魄·次元绝斩' : '月魄·朔月秘技',
        p.x,
        p.y - 46,
        175,
        190,
        255
      );
    } else {
      p.empoweredLActive = false;
      p.lunarLActive = false;
      p.astraChainCount = 0;
      if (spec.energyCost > 0) {
        p.bladeEnergy = Math.max(0, p.bladeEnergy - spec.energyCost);
      }
    }

    // 3. 赤刃 (`Brutality`): Perfect Dodge + Hold/Press J -> 1.5s Crimson Blade Slash (`赤刃 · 刹那血闪`)
    if (moveId === MoveId.MoonCounter) {
      p.crimsonFlashActive = true;
      p.perfectDodgeWindow = 0;
      p.invulnTimer = Math.max(p.invulnTimer, 1.52);
      this.pfx.spawnPopup('赤刃·刹那血闪', p.x, p.y - 46, 255, 86, 128);
    } else {
      p.crimsonFlashActive = false;
    }

    if (!p.grounded && (moveId === MoveId.AirSlash1 || moveId === MoveId.AirSlash2)) {
      p.airComboCount++;
    }

    // Persistent Combo Stage Retention (`没有使用L或者被攻击则维持攻击段数`):
    p.savedComboStage = advanceComboStage(p.savedComboStage ?? 0, moveId, {
      usedLSkill: isLSkill,
    });

    // Attack Speed Cadence (`基础攻速0.5s一次`): L skills, MoonCounter, and AstralSlash bypass normal cadence cooldown
    if (!isLSkill && moveId !== MoveId.MoonCounter && moveId !== MoveId.AstralSlash) {
      p.attackCooldownTimer = computeAttackInterval(mods.attackSpeedMult);
    }

    p.moveId = moveId;
    p.moveInstanceId = this.nextMoveInstanceId++;
    p.moveTimer = 0;
    p.moveHitIds.clear();
    p.dashAfterAttackWindow = 0;
    p.zanshinPending = false;
    this.lastMoveName =
      moveId === MoveId.AstralSlash
        ? `${spec.nameZh} · 连闪x${p.astraChainCount}`
        : p.crimsonFlashActive && mods.brutalityCount > 0
          ? '赤刃斩击 · 刹那血闪'
          : spec.nameZh;
    p.comboWindowTimer = getMoveTotalDuration(moveId) + COMBO_WINDOW_MAX;
  }

  private applyAuxiliaryDamage(
    e: EnemyEntity,
    dmg: number,
    color: 'cyan' | 'crimson' | 'violet' | 'silver'
  ): void {
    if (e.aiState === EnemyAIState.KO || e.hp <= 0) return;
    const finalDmg = Math.max(1, Math.round(dmg));
    e.hp = Math.max(0, e.hp - finalDmg);
    e.flashTimer = 0.055;
    const rgb =
      color === 'crimson'
        ? [255, 96, 136]
        : color === 'violet'
          ? [214, 142, 255]
          : [118, 242, 255];
    this.pfx.spawnPopup(`${finalDmg}`, e.x + 8, e.y - 42, rgb[0], rgb[1], rgb[2]);
    if (e.hp <= 0) {
      this.handleEnemyKilled(e, this.player.facing, 130, -110);
    }
  }

  private triggerChainLightning(originEnemy: EnemyEntity, mods: UpgradeModifiers): void {
    if (mods.chainBoltDamage <= 0 || mods.chainBoltTargets <= 0) return;
    const candidates = this.enemies
      .filter(
        (other) =>
          other.id !== originEnemy.id &&
          other.aiState !== EnemyAIState.KO &&
          other.aiState !== EnemyAIState.Spawn &&
          other.hp > 0 &&
          Math.hypot(other.x - originEnemy.x, other.y - originEnemy.y) <= 165
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - originEnemy.x, a.y - originEnemy.y) -
          Math.hypot(b.x - originEnemy.x, b.y - originEnemy.y)
      )
      .slice(0, mods.chainBoltTargets);

    let prevX = originEnemy.x;
    let prevY = originEnemy.y - 20;
    const boltDmg = Math.max(1, Math.round(mods.chainBoltDamage * mods.globalDamageMult));
    for (const target of candidates) {
      const tx = target.x;
      const ty = target.y - 20;
      this.pfx.spawnBolt({
        x0: prevX,
        y0: prevY,
        x1: tx,
        y1: ty,
        palette: 'cyan',
        duration: 0.2,
        thickness: 2,
        owner: 'player',
        damage: boltDmg,
        damageColor: 'cyan',
        chillSec: 0.9,
      });
      this.pfx.spawnHitSparks(tx, ty, 1, 'cyan', false, target.y);
      prevX = tx;
      prevY = ty;
    }
  }

  private handleEnemyKilled(
    e: EnemyEntity,
    dirX: 1 | -1,
    knockVx: number,
    knockVy: number
  ): void {
    if (e.aiState === EnemyAIState.KO) return;
    const p = this.player;
    const mods = this.getMods();

    const healOnKill = 4 + mods.killHeal;
    p.hp = Math.min(p.maxHp, p.hp + healOnKill);
    p.rallyHp = Math.max(p.rallyHp, p.hp);

    const soulGain = getEnemySoulReward(e.kind, Boolean(e.eliteAffix));
    this.souls += soulGain;
    this.killStreak++;

    e.aiState = EnemyAIState.KO;
    e.koTimer = 0.38;
    e.hasAttackToken = false;
    e.vx = dirX * Math.max(140, knockVx);
    e.vy = Math.min(-120, knockVy);
    e.grounded = false;

    const isBoss = isBossEnemyKind(e.kind);
    this.score += isBoss ? 2200 : e.eliteAffix ? 440 : 260;
    this.hitstopTimer = Math.max(this.hitstopTimer, isBoss ? 0.085 : 0.064);
    this.cameraTrauma = Math.min(1, this.cameraTrauma + (isBoss ? 0.55 : 0.4));
    this.pfx.spawnHitSparks(e.x, e.y - 18, dirX, 'crimson', true, e.y);
    this.pfx.spawnPopup(`+${soulGain}魄`, e.x, e.y - 46, 178, 226, 255);
    sound.playHit(true, false);

    if (e.kind === EnemyKind.Sovereign) {
      this.defeatedBossRooms.add('throne');
      this.clearedRooms.add('throne');
      this.victoryFreezeTimer = 0.78;
    } else if (e.kind === EnemyKind.Warden || e.kind === EnemyKind.Archon) {
      this.defeatedBossRooms.add(this.currentRoomId);
      this.clearedRooms.add(this.currentRoomId);
      this.pfx.spawnRing(e.x, e.y - 24, 88, 0.42, 255, 214, 112, false);
      this.showToast(`讨伐成功【${e.nameZh}】 · 获得首领赐福三选一！`, 4.0);
      this.pendingBossDraft = {
        title: `首领讨伐赐福 · ${e.nameZh}`,
        subtitle: `夺取 +${soulGain} 月魄 · 请选择一项高阶能力强化`,
      };
      this.pendingBossDraftTimer = 0.55;
    }
  }

  private evaluatePlayerHitbox(
    spec: (typeof MOVES)[MoveId],
    room: RoomDef,
    mods: UpgradeModifiers
  ): void {
    const p = this.player;
    this.syncAnchoredSlashes();

    // Rasterize ONLY the plotted PixelFX pixels of Aria's active move slashes + katana swing smear!
    this.hitGridA.begin(this.camBaseX, this.camBaseY);
    const slashes = this.pfx.getSlashes();
    for (let i = 0; i < slashes.length; i++) {
      const s = slashes[i];
      if (
        !s.active ||
        s.owner !== 'player' ||
        s.sourceId !== p.moveInstanceId ||
        (s.auxDamage ?? 0) > 0
      ) {
        continue;
      }
      rasterizeSlashToSink(this.hitGridA, this.hitGridA.originX, this.hitGridA.originY, s);
    }

    const rig = solveAriaSkeleton(p, this.totalTime);
    if (rig.smearIntensity > 0.08 && p.moveId !== MoveId.None) {
      rasterizeWeaponSmearToSink(
        this.hitGridA,
        this.hitGridA.originX,
        this.hitGridA.originY,
        rig.katana.x,
        rig.katana.y,
        rig.prevBladeAngle,
        rig.katana.angle,
        rig.bladeLen,
        rig.smearIntensity,
        p.moveId === MoveId.DimensionCut
      );
    }

    // 1. Destructible Seal Barrier — hit strictly when plotted slash/smear pixels touch the barrier!
    if (room.sealBarrier && !this.brokenSeals.has(room.sealBarrier.id) && !p.moveHitIds.has(-777)) {
      const sb = room.sealBarrier;
      if (this.hitGridA.overlapsWorldRect(sb.x, sb.y, sb.x + sb.w, sb.y + sb.h)) {
        p.moveHitIds.add(-777);
        if (canBreakSealBarrier(p.moveId, this.collectedRelics)) {
          this.brokenSeals.add(sb.id);
          this.score += 300;
          this.hitstopTimer = Math.max(this.hitstopTimer, 0.08);
          this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.55);
          this.pfx.screenFlash = 0.28;
          this.pfx.screenFlashColor = { r: 215, g: 135, b: 255 };
          this.pfx.spawnRing(sb.x + sb.w * 0.5, sb.y + sb.h * 0.5, 62, 0.35, 215, 130, 255, false);
          this.pfx.spawnHitSparks(sb.x + sb.w * 0.5, sb.y + sb.h * 0.5, p.facing, 'violet', true, sb.y + sb.h);
          sound.playSealShatter();
          this.showToast('封印石壁已粉碎 · 圣堂捷径与深渊王座通道贯通！', 3.4);
          this.emitHudSnapshot(true);
        } else {
          p.vx = -p.facing * 75;
          this.hitstopTimer = Math.max(this.hitstopTimer, 0.04);
          this.pfx.spawnHitSparks(sb.x + sb.w * 0.5, sb.y + sb.h * 0.5, -p.facing, 'violet', false, sb.y + sb.h);
          sound.playHit(false, true);
          if (!this.collectedRelics.has(RelicId.AbyssalBreaker)) {
            this.showToast('封印石壁纹丝不动 · 需寻获【星象书库】的裂空刻印并以重斩(L)破除', 3.2);
          } else {
            this.showToast('请使用重斩 [L] 或坠星下劈 [空中 S+J] 击碎封印石壁！', 2.4);
          }
        }
      }
    }

    // 2. Slice Enemy Projectiles on Pixel-on-Pixel Contact (`斩碎 · 破魔断弹` — destroys bullet cleanly with ZERO player-reflected projectiles!)
    for (let j = this.projectiles.length - 1; j >= 0; j--) {
      const proj = this.projectiles[j];
      if (proj.fromPlayer) continue;
      this.hitGridB.begin(this.camBaseX, this.camBaseY);
      rasterizeProjectileToSink(
        this.hitGridB,
        this.hitGridB.originX,
        this.hitGridB.originY,
        proj,
        j,
        this.totalTime
      );
      if (this.hitGridA.overlapsOtherGrid(this.hitGridB)) {
        const px = proj.x;
        const py = proj.y;
        this.projectiles.splice(j, 1);
        this.hitstopTimer = Math.max(this.hitstopTimer, 0.032);
        p.bladeEnergy = Math.min(
          p.maxBladeEnergy,
          p.bladeEnergy + Math.round(12 * mods.energyGainMult)
        );
        this.addStylePoints(30, p.moveId);
        this.lastMoveName = '斩碎 · 破魔断弹';
        this.pfx.spawnHitSparks(px, py, p.facing, 'cyan', false, py);
        sound.playHit(false, true);
      }
    }

    // 3. Strike Enemies strictly when plotted slash/smear pixels overlap the enemy hurtbox!
    for (const e of this.enemies) {
      if (e.aiState === EnemyAIState.KO || e.aiState === EnemyAIState.Spawn) continue;
      if (p.moveHitIds.has(e.id)) continue;

      const enemyTop = e.y - (isBossEnemyKind(e.kind) ? 46 : 34);
      const enemyBottom = e.y;
      const halfHitW = e.kind === EnemyKind.Warden ? 15 : 12;
      if (!this.hitGridA.overlapsWorldRect(e.x - halfHitW, enemyTop, e.x + halfHitW, enemyBottom)) {
        continue;
      }
      p.moveHitIds.add(e.id);

      if (shouldShieldBlockHit(e.shieldActive, e.facing, e.x, p.x, spec, mods.pierceShields)) {
        e.vx = p.facing * 55;
        p.vx = -p.facing * 65;
        this.hitstopTimer = Math.max(this.hitstopTimer, 0.04);
        this.pfx.spawnHitSparks(e.x + e.facing * 8, e.y - 18, -p.facing, 'cyan', false, e.y);
        this.pfx.spawnPopup('0', e.x, e.y - 34, 150, 200, 255);
        sound.playHit(false, true);
        continue;
      }

      if (e.shieldActive && (spec.heavyBreak || mods.pierceShields)) {
        e.shieldActive = false;
        this.pfx.spawnRing(e.x, e.y - 18, 34, 0.22, 110, 225, 255, false);
      }

      const isBackstab =
        (e.facing === 1 && p.x < e.x - 4) || (e.facing === -1 && p.x > e.x + 4);
      const singleStrikeBaseDamage =
        p.moveId === MoveId.MoonCounter
          ? spec.damage + mods.crimsonFlashExtraHits * mods.crimsonFlashHitDamage
          : spec.damage;
      const { damage, critical } = computeEffectiveDamage(
        singleStrikeBaseDamage,
        p.moveId,
        this.collectedRelics,
        isBackstab,
        mods,
        Math.random(),
        {
          empoweredLActive: p.empoweredLActive,
          crimsonFlashActive: p.crimsonFlashActive,
        }
      );

      e.hp = Math.max(0, e.hp - damage);
      e.flashTimer = 0.068;
      e.scaleX = p.moveId === MoveId.HelmSplitter ? 1.28 : 0.8;
      e.scaleY = p.moveId === MoveId.HelmSplitter ? 0.74 : 1.22;
      const hitEnergy =
        Math.round(spec.energyGain * mods.energyGainMult) + mods.siphonEnergyOnHit;
      p.bladeEnergy = Math.min(p.maxBladeEnergy, p.bladeEnergy + hitEnergy);

      const popOffX = ((this.comboCount % 3) - 1) * 11;
      const popOffY = -(this.comboCount % 2) * 8;
      this.pfx.spawnPopup(
        critical ? `${damage}!` : `${damage}`,
        e.x + popOffX,
        e.y - 34 + popOffY,
        p.moveId === MoveId.MoonCounter ? 255 : critical ? 255 : 245,
        p.moveId === MoveId.MoonCounter ? 105 : critical ? 225 : 248,
        p.moveId === MoveId.MoonCounter ? 145 : critical ? 105 : 255
      );

      if (p.moveId === MoveId.MoonCounter) {
        if ((this.upgradeLevels[UpgradeId.ExecutionerEdge] ?? 0) > 0) {
          p.stamina = Math.min(p.maxStamina, p.stamina + 0.8);
        }
        if (mods.crimsonVortexHeal > 0) {
          p.hp = Math.min(p.maxHp, p.hp + mods.crimsonVortexHeal);
          p.rallyHp = Math.max(p.rallyHp, p.hp);
          this.pfx.spawnPopup(`+${mods.crimsonVortexHeal}`, p.x - 8, p.y - 44, 120, 255, 195);
        }
      }

      // 连袭 (`Onslaught` — `PhantomEcho` `幻影连袭`): close-range shadow echo follow-up!
      if (mods.phantomEchoRatio > 0 && e.hp > 0) {
        const echoTriggers =
          1 +
          (p.moveId === MoveId.Slash4 ||
          p.moveId === MoveId.SlideSlash ||
          p.moveId === MoveId.DashThrust
            ? mods.extraEchoCount
            : 0);
        for (let ec = 0; ec < echoTriggers && e.hp > 0; ec++) {
          const echoDmg = Math.max(2, Math.round(damage * mods.phantomEchoRatio));
          this.pfx.spawnAfterimage(
            e.x - p.facing * (12 + ec * 6),
            e.y,
            p.facing,
            'slash',
            120,
            242,
            185
          );
          this.applyAuxiliaryDamage(e, echoDmg, 'cyan');
          this.comboCount++;
        }
      }

      // 赤刃 (`Brutality` — `CrimsonRend` `绯血撕裂`): detonate via pixel-exact crimson ring!
      if (mods.crimsonRendDamage > 0 && e.hp > 0) {
        const bleedAdd = p.moveId === MoveId.MoonCounter ? 2 : 1;
        e.bleedStacks = (e.bleedStacks ?? 0) + bleedAdd;
        if (e.bleedStacks >= 3) {
          e.bleedStacks = 0;
          this.pfx.spawnRing(e.x, e.y - 20, 48, 0.26, 255, 64, 112, false, {
            owner: 'player',
            damage: Math.round(mods.crimsonRendDamage * mods.globalDamageMult),
            damageColor: 'crimson',
            dirX: p.facing,
          });
          this.pfx.spawnHitSparks(e.x, e.y - 20, p.facing, 'crimson', true, e.y);
        }
      }

      // 星术 (`Tactics` — `ChainBolt` `星雷连锁`): strictly exclusive to `星术` (`MoveId.AstralSlash`)!
      if (mods.chainBoltDamage > 0 && p.moveId === MoveId.AstralSlash) {
        this.triggerChainLightning(e, mods);
      }

      // Boss Phase 2 Enrage check (55% HP for all 3 Bosses!)
      if (isBossEnemyKind(e.kind) && !e.bossEnraged && e.hp > 0 && e.hp <= e.maxHp * 0.55) {
        e.bossEnraged = true;
        e.attackCooldown = Math.min(e.attackCooldown, 0.35);
        this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.65);
        this.pfx.spawnRing(e.x, e.y - 22, 92, 0.38, 255, 64, 118, false);
        this.pfx.spawnRing(e.x, e.y - 22, 128, 0.48, 204, 88, 255, false);
        sound.playBossEnrage();
        const phaseMsg =
          e.kind === EnemyKind.Warden
            ? '深渊典狱官进入狂暴二阶段【碎狱震击】！'
            : e.kind === EnemyKind.Archon
              ? '星穹大主教展开二阶段【群星天罚】！'
              : '绯月女武神觉醒二阶段【血月审判】！';
        this.showToast(phaseMsg, 3.2);
      }

      this.comboCount++;
      this.maxCombo = Math.max(this.maxCombo, this.comboCount);
      this.comboDecayTimer = 3.4;
      const styleGain = calculateStyleGain(p.moveId, this.recentMoves, this.comboCount);
      this.addStylePoints(styleGain, p.moveId);
      this.score += damage * (1 + Math.floor(this.comboCount * 0.2));

      const resistsStun =
        e.hp > 0 &&
        shouldEnemyResistHitstun(
          e.kind,
          e.aiState,
          e.stateTimer,
          e.eliteAffix,
          Boolean(spec.heavyBreak || p.empoweredLActive)
        );
      if (!resistsStun && e.hp > 0) {
        e.vx = p.facing * spec.knockbackX;
        e.vy = spec.knockbackY;
        if (spec.knockbackY < -80) {
          e.grounded = false;
        }
        e.aiState = EnemyAIState.Hitstun;
        e.stateTimer = spec.heavyBreak ? 0.32 : 0.2;
        e.hasAttackToken = false;
      } else if (resistsStun && e.hp > 0) {
        this.pfx.spawnRing(e.x, e.y - 20, 24, 0.16, 255, 206, 96, false);
      }

      if (p.hp < p.rallyHp) {
        const rallyGain = Math.round((spec.heavyBreak ? 6 : 3) * mods.rallyHealMult);
        p.hp = Math.min(p.rallyHp, p.hp + rallyGain);
      }

      if (e.hp <= 0) {
        this.handleEnemyKilled(e, p.facing, spec.knockbackX, spec.knockbackY);
      } else {
        this.hitstopTimer = Math.max(this.hitstopTimer, spec.hitstop);
        this.cameraTrauma = Math.min(1, this.cameraTrauma + (spec.heavyBreak ? 0.3 : 0.12));
        if (p.moveId !== MoveId.DimensionCut) {
          this.pfx.spawnHitSparks(e.x, e.y - 18, p.facing, spec.slashColor, spec.heavyBreak, e.y);
        }
        sound.playHit(spec.heavyBreak, false, critical);
      }
    }
  }

  private addStylePoints(pts: number, moveId: MoveId): void {
    this.stylePoints = Math.min(680, this.stylePoints + pts);
    this.recentMoves.push(moveId);
    if (this.recentMoves.length > 5) {
      this.recentMoves.shift();
    }
    const rank = computeStyleRank(this.stylePoints);
    if (rankOrderValue(rank) > rankOrderValue(this.peakRank)) {
      this.peakRank = rank;
    }
  }

  /**
   * Keeps active lunging slash crescents glued to their attacker's moving body during active frames
   * so visual VFX pixels and pixel-exact hitboxes match 100%.
   */
  private syncAnchoredSlashes(): void {
    const slashes = this.pfx.getSlashes();
    for (let i = 0; i < slashes.length; i++) {
      const s = slashes[i];
      if (!s.active || s.anchorEntityId === undefined) continue;
      if (s.trackUntilElapsed !== undefined && s.elapsed > s.trackUntilElapsed) continue;
      if (s.anchorEntityId === 0) {
        s.x = this.player.x + (s.offsetX ?? 0);
        s.y = this.player.y + (s.offsetY ?? 0);
      } else {
        for (let k = 0; k < this.enemies.length; k++) {
          const e = this.enemies[k];
          if (e.id === s.anchorEntityId && e.aiState !== EnemyAIState.KO) {
            s.x = e.x + (s.offsetX ?? 0);
            s.y = e.y + (s.offsetY ?? 0);
            break;
          }
        }
      }
    }
  }

  private getEnemyWeaponSmearLen(kind: EnemyKind): number {
    if (kind === EnemyKind.Stalker) return 18;
    if (kind === EnemyKind.Halberdier) return 26;
    if (kind === EnemyKind.Reaper) return 25;
    if (kind === EnemyKind.Warden) return 32;
    if (kind === EnemyKind.Archon) return 28;
    if (kind === EnemyKind.Sovereign) return 34;
    return 0;
  }

  private rasterizeEnemyWeaponSmearToGrid(e: EnemyEntity, grid: PfxWorldHitGrid): void {
    if (e.kind === EnemyKind.Weaver || e.kind === EnemyKind.Arbalist) return;
    if (e.aiState !== EnemyAIState.Attack) return;
    const weaponLen = this.getEnemyWeaponSmearLen(e.kind);
    if (weaponLen <= 0) return;
    const rig = solveEnemySkeleton(e, this.totalTime);
    if (rig.weaponSmearIntensity <= 0.08) return;
    rasterizeWeaponSmearToSink(
      grid,
      grid.originX,
      grid.originY,
      rig.weapon.x,
      rig.weapon.y,
      rig.prevWeaponAngle,
      rig.weapon.angle,
      weaponLen,
      rig.weaponSmearIntensity,
      false
    );
  }

  private rasterizeAllHostileVfxToGrid(grid: PfxWorldHitGrid): void {
    this.syncAnchoredSlashes();
    grid.begin(this.camBaseX, this.camBaseY);

    const slashes = this.pfx.getSlashes();
    for (let i = 0; i < slashes.length; i++) {
      const s = slashes[i];
      if (!s.active || s.owner !== 'enemy') continue;
      rasterizeSlashToSink(grid, grid.originX, grid.originY, s);
    }

    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.aiState === EnemyAIState.Attack) {
        this.rasterizeEnemyWeaponSmearToGrid(e, grid);
      }
    }

    const rings = this.pfx.getRings();
    for (let i = 0; i < rings.length; i++) {
      const ring = rings[i];
      if (!ring.active || ring.owner !== 'enemy' || (ring.damage ?? 0) <= 0) continue;
      rasterizeRingToSink(grid, grid.originX, grid.originY, ring, seededRand);
    }

    for (let i = 0; i < this.projectiles.length; i++) {
      const proj = this.projectiles[i];
      if (proj.fromPlayer) continue;
      rasterizeProjectileToSink(grid, grid.originX, grid.originY, proj, i, this.totalTime);
    }
  }

  private triggerPerfectDodgeSuccess(mods: UpgradeModifiers): void {
    const p = this.player;
    p.dashPerfectTriggered = true;
    this.perfectDodges++;
    this.witchTimeTimer = 1.28;
    p.perfectDodgeWindow = 0.95 + mods.perfectDodgeBonusWindow;
    p.invulnTimer = Math.max(p.invulnTimer, 0.48);
    p.stamina = Math.min(p.maxStamina, p.stamina + 1.0);
    const brandEnergy =
      (this.upgradeLevels[UpgradeId.BloodlustBrand] ?? 0) > 0
        ? 10 + (this.upgradeLevels[UpgradeId.BloodlustBrand] ?? 0) * 8
        : 0;
    p.bladeEnergy = Math.min(
      p.maxBladeEnergy,
      p.bladeEnergy + Math.round(35 * mods.energyGainMult) + brandEnergy
    );
    this.addStylePoints(55, MoveId.MoonCounter);
    this.perfectDodgeBannerTimer = 1.15;
    this.lastMoveName = '月影刹那 · 按住J触发赤刃斩击';
    this.pfx.screenFlash = 0.24;
    this.pfx.screenFlashColor = { r: 255, g: 110, b: 155 };
    this.pfx.spawnRing(p.x, p.y - 18, 68, 0.36, 255, 95, 145, false);

    // AegisCounter (`反震月甲`) + ThornsAura (`荆棘圣铠`): pixel-exact lunar shockwave ring!
    if (mods.dodgeNovaDamage > 0) {
      this.pfx.spawnRing(p.x, p.y - 18, 86, 0.34, 255, 218, 118, false, {
        owner: 'player',
        damage: mods.dodgeNovaDamage,
        damageColor: 'silver',
        dirX: p.facing,
      });
      if (mods.thornsHeal > 0) {
        p.hp = Math.min(p.maxHp, p.hp + mods.thornsHeal);
        p.rallyHp = Math.max(p.rallyHp, p.hp);
        this.pfx.spawnPopup(`+${mods.thornsHeal}`, p.x - 10, p.y - 44, 120, 255, 195);
      }
    }
    sound.playDash(true);
  }

  private checkDashCrossingHostilePixels(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    mods: UpgradeModifiers
  ): void {
    const p = this.player;
    if (!p.isDashing || p.dashPerfectTriggered) return;
    this.rasterizeAllHostileVfxToGrid(this.hitGridA);
    const minX = Math.min(x0, x1) - 6;
    const maxX = Math.max(x0, x1) + 6;
    const minY = Math.min(y0, y1) - 29;
    const maxY = Math.max(y0, y1) - 2;
    const overlapsHostilePixels = this.hitGridA.overlapsWorldRect(minX, minY, maxX, maxY);
    if (canTriggerPixelPerfectDodge(p.isDashing, Boolean(p.dashPerfectTriggered), overlapsHostilePixels)) {
      this.triggerPerfectDodgeSuccess(mods);
    }
  }

  /**
   * Evaluates pixel-exact collisions for auxiliary player melee slashes (`朔月重弧`, `双月叠斩`, `绯月断空`, `超音速斩`),
   * expanding shockwave rings (`凛冬残影`, `虚空月蚀`, `血影旋涡`, `反震月甲`, `星璇爆裂`), and `星术` lightning bolts.
   */
  private stepPixelVfxCombat(mods: UpgradeModifiers): void {
    const p = this.player;
    this.syncAnchoredSlashes();

    // 1. Auxiliary Player Melee Slashes
    const slashes = this.pfx.getSlashes();
    for (let i = 0; i < slashes.length; i++) {
      const s = slashes[i];
      if (!s.active || s.owner !== 'player' || !s.auxDamage || s.auxDamage <= 0) continue;
      this.hitGridA.begin(this.camBaseX, this.camBaseY);
      rasterizeSlashToSink(this.hitGridA, this.hitGridA.originX, this.hitGridA.originY, s);

      for (const e of this.enemies) {
        if (e.aiState === EnemyAIState.KO || e.aiState === EnemyAIState.Spawn || e.hp <= 0) continue;
        if (s.hitIds.has(e.id)) continue;
        const enemyTop = e.y - (isBossEnemyKind(e.kind) ? 46 : 34);
        const halfHitW = e.kind === EnemyKind.Warden ? 15 : 12;
        if (!this.hitGridA.overlapsWorldRect(e.x - halfHitW, enemyTop, e.x + halfHitW, e.y)) continue;
        s.hitIds.add(e.id);

        if (s.energyOnHit && s.energyOnHit > 0) {
          p.bladeEnergy = Math.min(p.maxBladeEnergy, p.bladeEnergy + s.energyOnHit);
        }
        if (s.applyBleed && s.applyBleed > 0 && mods.crimsonRendDamage > 0) {
          e.bleedStacks = (e.bleedStacks ?? 0) + s.applyBleed;
        }
        this.pfx.spawnHitSparks(e.x, e.y - 18, s.facing, s.auxColor ?? 'cyan', false, e.y);
        this.applyAuxiliaryDamage(e, s.auxDamage, s.auxColor ?? 'cyan');
      }
    }

    // 2. Damaging Shockwave Rings (only plotted ring rim pixels hit — hollow interior is safe!)
    const rings = this.pfx.getRings();
    const playerTopOffset = p.moveId === MoveId.SlideSlash ? 14 : p.crouching ? 22 : 31;
    for (let i = 0; i < rings.length; i++) {
      const ring = rings[i];
      if (!ring.active || !ring.damage || ring.damage <= 0 || !ring.owner) continue;
      this.hitGridA.begin(this.camBaseX, this.camBaseY);
      rasterizeRingToSink(
        this.hitGridA,
        this.hitGridA.originX,
        this.hitGridA.originY,
        ring,
        seededRand
      );

      if (ring.owner === 'player') {
        for (const e of this.enemies) {
          if (e.aiState === EnemyAIState.KO || e.aiState === EnemyAIState.Spawn || e.hp <= 0) continue;
          if (ring.hitIds.has(e.id)) continue;
          const enemyTop = e.y - (isBossEnemyKind(e.kind) ? 46 : 34);
          const halfHitW = e.kind === EnemyKind.Warden ? 15 : 12;
          if (!this.hitGridA.overlapsWorldRect(e.x - halfHitW, enemyTop, e.x + halfHitW, e.y)) continue;
          ring.hitIds.add(e.id);
          if (ring.chillSec && ring.chillSec > 0) {
            e.chillTimer = Math.max(e.chillTimer ?? 0, ring.chillSec);
          }
          this.applyAuxiliaryDamage(e, ring.damage, ring.damageColor ?? 'cyan');
        }
      } else if (ring.owner === 'enemy' && !ring.hitIds.has(0) && p.invulnTimer <= 0) {
        if (this.hitGridA.overlapsWorldRect(p.x - 6, p.y - playerTopOffset, p.x + 6, p.y - 2)) {
          ring.hitIds.add(0);
          this.damagePlayer(ring.damage, ring.dirX ?? (p.x >= ring.x ? 1 : -1));
        }
      }
    }

    // 3. `星术` Pooled Lightning & Sky-Pillar Spears (`SimBolt`) — pixel-exact bolt collision!
    const bolts = this.pfx.getBolts();
    for (let i = 0; i < bolts.length; i++) {
      const bolt = bolts[i];
      if (!bolt.active || bolt.damage <= 0) continue;
      this.hitGridA.begin(this.camBaseX, this.camBaseY);
      rasterizeBoltToSink(this.hitGridA, this.hitGridA.originX, this.hitGridA.originY, bolt);

      if (bolt.owner === 'player') {
        for (const e of this.enemies) {
          if (e.aiState === EnemyAIState.KO || e.aiState === EnemyAIState.Spawn || e.hp <= 0) continue;
          if (bolt.hitIds.has(e.id)) continue;
          const enemyTop = e.y - (isBossEnemyKind(e.kind) ? 46 : 34);
          const halfHitW = e.kind === EnemyKind.Warden ? 15 : 12;
          if (!this.hitGridA.overlapsWorldRect(e.x - halfHitW, enemyTop, e.x + halfHitW, e.y)) continue;
          bolt.hitIds.add(e.id);
          if (bolt.chillSec > 0) {
            e.chillTimer = Math.max(e.chillTimer ?? 0, bolt.chillSec);
          }
          this.pfx.spawnHitSparks(e.x, e.y - 18, p.facing, bolt.damageColor, false, e.y);
          this.applyAuxiliaryDamage(e, bolt.damage, bolt.damageColor);
        }
      }
    }
  }

  private countActiveAttackTokens(): number {
    let n = 0;
    for (const e of this.enemies) {
      if (e.hasAttackToken && e.aiState !== EnemyAIState.KO) n++;
    }
    return n;
  }

  private stepEnemies(dt: number): void {
    const p = this.player;
    const room = this.getCurrentRoom();

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.flashTimer = Math.max(0, e.flashTimer - dt);
      e.chillTimer = Math.max(0, (e.chillTimer ?? 0) - dt);
      const speedScale =
        ((e.chillTimer ?? 0) > 0 ? 0.58 : 1.0) *
        (e.eliteAffix === 'frenzy' ? 1.35 : 1.0) *
        (e.bossEnraged ? 1.24 : 1.0);
      const effDt = dt * speedScale;

      e.scaleX += (1 - e.scaleX) * Math.min(1, dt * 15);
      e.scaleY += (1 - e.scaleY) * Math.min(1, dt * 15);
      if (e.rallyHp > e.hp) {
        e.rallyHp = Math.max(e.hp, e.rallyHp - dt * 36);
      }

      if (e.aiState === EnemyAIState.KO) {
        e.koTimer -= dt;
        e.vy += GRAVITY * dt;
        const solvedKo = resolveRoomMovement({
          prevX: e.x,
          prevY: e.y,
          nextX: e.x + e.vx * dt,
          nextY: e.y + e.vy * dt,
          vx: e.vx,
          vy: e.vy,
          halfW: 7,
          height: 28,
          dropThrough: false,
          platforms: room.platforms,
          activeSeal: this.getActiveSealRect(room),
          lockedExitBarriers: this.getLockedExitBarriers(room),
        });
        e.x = solvedKo.x;
        e.y = solvedKo.y;
        e.vx *= Math.max(0, 1 - dt * 4);
        if (e.koTimer <= 0) {
          this.enemies.splice(i, 1);
          if (this.enemies.length === 0) {
            const wasAlreadyCleared = this.clearedRooms.has(this.currentRoomId);
            this.clearedRooms.add(this.currentRoomId);
            sound.playRoomUnlock();
            if (!wasAlreadyCleared && !BOSS_ROOM_IDS.has(this.currentRoomId)) {
              this.showToast('房间肃清 · 封锁铁门已开启！', 2.8);
            }
            this.emitHudSnapshot(true);
          }
        }
        continue;
      }

      if (e.aiState === EnemyAIState.Spawn) {
        e.stateTimer -= dt;
        if (e.stateTimer <= 0) {
          e.aiState = EnemyAIState.Approach;
        }
        continue;
      }

      e.attackCooldown = Math.max(0, e.attackCooldown - effDt);

      if (e.aiState === EnemyAIState.Hitstun) {
        e.stateTimer -= dt;
        e.vx *= Math.max(0, 1 - dt * 6);
        if (e.stateTimer <= 0 && e.grounded) {
          e.aiState = EnemyAIState.Approach;
        }
      } else if (e.aiState === EnemyAIState.Windup) {
        e.stateTimer -= effDt;
        // Enemies track player facing during early windup so players can't trivially walk behind them early!
        if (e.stateTimer > 0.14) {
          e.facing = p.x >= e.x ? 1 : -1;
        }
        e.vx *= Math.max(0, 1 - dt * 10);
        if (e.stateTimer <= 0) {
          this.executeEnemyAttack(e);
        }
      } else if (e.aiState === EnemyAIState.Attack) {
        const prevTimer = e.stateTimer;
        e.stateTimer -= effDt;
        this.stepEnemyActiveAttack(e, prevTimer);
        if (e.stateTimer <= 0) {
          e.aiState = EnemyAIState.Recovery;
          e.stateTimer = ENEMY_COMBAT_STATS[e.kind].recoverySec * (e.bossEnraged ? 0.75 : 1.0);
          e.hasAttackToken = false;
          // Halberdier & Ward elites re-raise their Aegis Shield after completing a combo recovery!
          if (e.kind === EnemyKind.Halberdier && !e.shieldActive && e.hp > e.maxHp * 0.35) {
            e.shieldActive = true;
            this.pfx.spawnRing(e.x + e.facing * 8, e.y - 18, 22, 0.2, 96, 210, 255, false);
          }
        }
      } else if (e.aiState === EnemyAIState.Recovery) {
        e.stateTimer -= effDt;
        e.vx *= Math.max(0, 1 - dt * 9);
        if (e.stateTimer <= 0) {
          e.aiState = EnemyAIState.Approach;
        }
      } else {
        this.stepEnemyDecisionPolicy(e, effDt, p);
      }

      e.vy += GRAVITY * dt;
      let nextX = e.x + e.vx * effDt;
      if (e.grounded && e.aiState !== EnemyAIState.Hitstun) {
        nextX = Math.max(e.homeMinX, Math.min(e.homeMaxX, nextX));
      }

      const solved = resolveRoomMovement({
        prevX: e.x,
        prevY: e.y,
        nextX,
        nextY: e.y + e.vy * dt,
        vx: e.vx,
        vy: e.vy,
        halfW: 7,
        height: 28,
        dropThrough: false,
        platforms: room.platforms,
        activeSeal: this.getActiveSealRect(room),
        lockedExitBarriers: this.getLockedExitBarriers(room),
      });

      e.x = solved.x;
      e.y = solved.y;
      e.vx = solved.vx;
      e.vy = solved.vy;
      e.grounded = solved.grounded;

      if (e.grounded && Math.abs(e.vx) > 6) {
        e.gaitPhase += Math.abs(e.vx) * effDt * 0.14;
      }
    }
  }

  private stepEnemyDecisionPolicy(e: EnemyEntity, dt: number, p: PlayerEntity): void {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const isBoss = isBossEnemyKind(e.kind);
    const profile = ENEMY_COMBAT_STATS[e.kind];

    if (!isBoss && (absDx > 350 || absDy > 165)) {
      const center = (e.homeMinX + e.homeMaxX) * 0.5;
      const patrolTarget =
        center +
        Math.sin(this.totalTime * 1.3 + e.id) * Math.min(65, (e.homeMaxX - e.homeMinX) * 0.4);
      const dir = patrolTarget >= e.x ? 1 : -1;
      e.facing = dir;
      e.vx += (dir * (profile.moveSpeed * 0.45) - e.vx) * Math.min(1, dt * 5);
      return;
    }

    e.facing = dx >= 0 ? 1 : -1;
    const canAcquireToken = e.attackCooldown <= 0 && this.countActiveAttackTokens() < 4;

    if (e.kind === EnemyKind.Stalker) {
      // Clockwork Assassin: shadow-step burst when at mid-range (`52..120px`), then twin-slash!
      if (absDx > 42) {
        const burstMult = absDx < 118 && e.attackCooldown <= 0.25 ? 1.45 : 1.0;
        e.vx += (e.facing * profile.moveSpeed * burstMult - e.vx) * Math.min(1, dt * 9.5);
      } else {
        e.vx *= Math.max(0, 1 - dt * 10);
      }
      if (canAcquireToken && absDx <= 56 && absDy <= 46) {
        e.hasAttackToken = true;
        e.aiState = EnemyAIState.Windup;
        e.stateTimer = profile.windupSec;
        sound.playTelegraph();
      }
    } else if (e.kind === EnemyKind.Weaver) {
      // Astral Bishop: blinks away if player rushes too close (`< 72px`) and casts 3-way fan!
      if (absDx < 72 && e.attackCooldown <= 0.4) {
        const blinkTarget =
          p.x > (e.homeMinX + e.homeMaxX) * 0.5
            ? Math.max(e.homeMinX + 18, e.x - 95)
            : Math.min(e.homeMaxX - 18, e.x + 95);
        if (Math.abs(blinkTarget - e.x) > 28) {
          this.pfx.spawnRing(e.x, e.y - 20, 32, 0.22, 198, 118, 255, false);
          e.x = blinkTarget;
          e.facing = p.x >= e.x ? 1 : -1;
          this.pfx.spawnRing(e.x, e.y - 20, 36, 0.24, 118, 232, 255, false);
        }
      }
      if (absDx < 105) {
        e.vx += (-e.facing * profile.moveSpeed - e.vx) * Math.min(1, dt * 7.5);
      } else if (absDx > 255) {
        e.vx += (e.facing * profile.moveSpeed - e.vx) * Math.min(1, dt * 6.5);
      } else {
        e.vx *= Math.max(0, 1 - dt * 8);
      }
      if (canAcquireToken && absDx <= 270 && absDy <= 95) {
        e.hasAttackToken = true;
        e.aiState = EnemyAIState.Windup;
        e.stateTimer = profile.windupSec;
        sound.playTelegraph();
      }
    } else if (e.kind === EnemyKind.Halberdier) {
      if (absDx > 56) {
        e.vx += (e.facing * profile.moveSpeed - e.vx) * Math.min(1, dt * 7);
      } else {
        e.vx *= Math.max(0, 1 - dt * 10);
      }
      if (canAcquireToken && absDx <= 68 && absDy <= 48) {
        e.hasAttackToken = true;
        e.aiState = EnemyAIState.Windup;
        e.stateTimer = profile.windupSec;
        sound.playTelegraph();
      }
    } else if (e.kind === EnemyKind.Reaper) {
      // Spectral Wraith: relentless high-speed pursuit + sweeping double harvest + soul wave!
      if (absDx > 60) {
        e.vx += (e.facing * profile.moveSpeed - e.vx) * Math.min(1, dt * 9.5);
      } else {
        e.vx *= Math.max(0, 1 - dt * 9);
      }
      if (canAcquireToken && absDx <= 78 && absDy <= 52) {
        e.hasAttackToken = true;
        e.aiState = EnemyAIState.Windup;
        e.stateTimer = profile.windupSec;
        sound.playTelegraph();
      }
    } else if (e.kind === EnemyKind.Arbalist) {
      // Crimson Marksman: evasive backstep hop when rushed + triple quarrel volley!
      if (absDx < 88) {
        e.vx += (-e.facing * (profile.moveSpeed * 1.15) - e.vx) * Math.min(1, dt * 8);
      } else if (absDx > 245) {
        e.vx += (e.facing * profile.moveSpeed - e.vx) * Math.min(1, dt * 6.5);
      } else {
        e.vx *= Math.max(0, 1 - dt * 9);
      }
      if (canAcquireToken && absDx <= 265 && absDy <= 68) {
        e.hasAttackToken = true;
        e.aiState = EnemyAIState.Windup;
        e.stateTimer = profile.windupSec;
        sound.playTelegraph();
      }
    } else if (e.kind === EnemyKind.Warden) {
      // BOSS 1: Abyssal Warden Gorgon (4-pattern rotation!)
      const pat = e.bossPatternIndex % 4;
      if (absDx > 78 && pat !== 1 && pat !== 3) {
        e.vx +=
          (e.facing * (e.bossEnraged ? profile.moveSpeed * 1.25 : profile.moveSpeed) - e.vx) *
          Math.min(1, dt * 8);
      } else {
        e.vx *= Math.max(0, 1 - dt * 8);
      }
      if (canAcquireToken && (absDx <= 115 || pat === 1 || pat === 2 || pat === 3 || e.attackCooldown <= 0)) {
        e.hasAttackToken = true;
        e.aiState = EnemyAIState.Windup;
        e.stateTimer = profile.windupSec * (e.bossEnraged ? 0.82 : 1.0);
        sound.playTelegraph();
      }
    } else if (e.kind === EnemyKind.Archon) {
      // BOSS 2: Astral Archon Orpheus (4-pattern rotation!)
      if (absDx < 110) {
        e.vx += (-e.facing * profile.moveSpeed - e.vx) * Math.min(1, dt * 7);
      } else if (absDx > 215) {
        e.vx += (e.facing * profile.moveSpeed - e.vx) * Math.min(1, dt * 7);
      } else {
        e.vx *= Math.max(0, 1 - dt * 7);
      }
      if (canAcquireToken) {
        e.hasAttackToken = true;
        e.aiState = EnemyAIState.Windup;
        e.stateTimer = profile.windupSec * (e.bossEnraged ? 0.8 : 1.0);
        sound.playTelegraph();
      }
    } else {
      // BOSS 3: Crimson Moon Valkyrie Selene (4-pattern rotation!)
      const pat = e.bossPatternIndex % 4;
      if (absDx > 82 && pat !== 2 && pat !== 3) {
        e.vx +=
          (e.facing * (e.bossEnraged ? profile.moveSpeed * 1.26 : profile.moveSpeed) - e.vx) *
          Math.min(1, dt * 9);
      } else {
        e.vx *= Math.max(0, 1 - dt * 8);
      }
      if (canAcquireToken && (absDx <= 112 || pat >= 1 || e.attackCooldown <= 0)) {
        e.hasAttackToken = true;
        e.aiState = EnemyAIState.Windup;
        e.stateTimer = profile.windupSec * (e.bossEnraged ? 0.78 : 1.0);
        sound.playTelegraph();
      }
    }
  }

  private executeEnemyAttack(e: EnemyEntity): void {
    e.aiState = EnemyAIState.Attack;
    e.hitConfirmedThisSwing = false;
    const profile = ENEMY_COMBAT_STATS[e.kind];
    const isBoss = isBossEnemyKind(e.kind);
    const isRanged =
      e.kind === EnemyKind.Weaver || e.kind === EnemyKind.Arbalist || e.kind === EnemyKind.Archon;
    sound.playEnemyAttack(isBoss, isRanged);

    // Storm Elite affix fires an extra twin cyan spark burst toward the player!
    if (e.eliteAffix === 'storm') {
      const dx = this.player.x - e.x;
      const dy = this.player.y - 18 - (e.y - 20);
      const baseAng = Math.atan2(dy, dx);
      for (const off of [-0.12, 0.12]) {
        this.projectiles.push({
          id: this.nextEntityId++,
          x: e.x,
          y: e.y - 22,
          vx: Math.cos(baseAng + off) * 195,
          vy: Math.sin(baseAng + off) * 195,
          radius: 4.0,
          damage: 15,
          fromPlayer: false,
          color: 'cyan',
          life: 2.6,
          deflected: false,
        });
      }
    }

    if (e.kind === EnemyKind.Stalker) {
      // Twin Kukri Cross-Combo: rapid first slash + second cross-slash at mid-attack!
      e.stateTimer = profile.activeSec;
      e.attackCooldown = profile.baseCooldownSec * (e.eliteAffix === 'frenzy' ? 0.75 : 1.0);
      e.vx = e.facing * 245;
      this.pfx.spawnSlash({
        x: e.x + e.facing * 12,
        y: e.y - 16,
        facing: e.facing,
        style: 'arc_down',
        palette: 'crimson',
        duration: 0.18,
        radiusX: 42,
        radiusY: 24,
        owner: 'enemy',
        sourceId: e.id,
        anchorEntityId: e.id,
        offsetX: e.facing * 12,
        offsetY: -16,
        trackUntilElapsed: profile.activeSec,
      });
    } else if (e.kind === EnemyKind.Weaver) {
      // 3-Orb (or 5-Orb Elite) Astral Eclipse Fan Barrage!
      e.stateTimer = profile.activeSec;
      e.attackCooldown = profile.baseCooldownSec;
      const dx = this.player.x - e.x;
      const dy = this.player.y - 20 - (e.y - 20);
      const centerAng = Math.atan2(dy, dx);
      const spreads = e.eliteAffix ? [-0.28, -0.14, 0, 0.14, 0.28] : [-0.18, 0, 0.18];
      const spd = 204;
      for (const sp of spreads) {
        this.projectiles.push({
          id: this.nextEntityId++,
          x: e.x + e.facing * 10,
          y: e.y - 20,
          vx: Math.cos(centerAng + sp) * spd,
          vy: Math.sin(centerAng + sp) * spd,
          radius: 4.2,
          damage: profile.projectileDamage,
          fromPlayer: false,
          color: 'violet',
          life: 3.2,
          deflected: false,
        });
      }
    } else if (e.kind === EnemyKind.Halberdier) {
      // Heavy Poleaxe Cleave + Floor Shockwave Crescent Wave!
      e.stateTimer = profile.activeSec;
      e.attackCooldown = profile.baseCooldownSec;
      e.vx = e.facing * 175;
      this.pfx.spawnSlash({
        x: e.x + e.facing * 16,
        y: e.y - 20,
        facing: e.facing,
        style: 'wide_cleave',
        palette: 'crimson',
        duration: 0.24,
        radiusX: 56,
        radiusY: 32,
        owner: 'enemy',
        sourceId: e.id,
        anchorEntityId: e.id,
        offsetX: e.facing * 16,
        offsetY: -20,
        trackUntilElapsed: profile.activeSec,
      });
      this.projectiles.push({
        id: this.nextEntityId++,
        x: e.x + e.facing * 18,
        y: e.y - 12,
        vx: e.facing * 205,
        vy: 0,
        radius: 5.2,
        damage: profile.projectileDamage,
        fromPlayer: false,
        color: 'crimson',
        life: 1.4,
        deflected: false,
        isSwordWave: true,
      });
    } else if (e.kind === EnemyKind.Reaper) {
      // Abyssal Scythe Harvest + Piercing Cyan Soul-Wave!
      e.stateTimer = profile.activeSec;
      e.attackCooldown = profile.baseCooldownSec;
      e.vx = e.facing * 255;
      this.pfx.spawnSlash({
        x: e.x + e.facing * 18,
        y: e.y - 20,
        facing: e.facing,
        style: 'wide_cleave',
        palette: 'cyan',
        duration: 0.24,
        radiusX: 60,
        radiusY: 34,
        owner: 'enemy',
        sourceId: e.id,
        anchorEntityId: e.id,
        offsetX: e.facing * 18,
        offsetY: -20,
        trackUntilElapsed: profile.activeSec,
      });
      this.projectiles.push({
        id: this.nextEntityId++,
        x: e.x + e.facing * 20,
        y: e.y - 18,
        vx: e.facing * 235,
        vy: 0,
        radius: 5.8,
        damage: profile.projectileDamage,
        fromPlayer: false,
        color: 'cyan',
        life: 1.8,
        deflected: false,
        isSwordWave: true,
      });
    } else if (e.kind === EnemyKind.Arbalist) {
      // 3-Bolt (or 5-Bolt Elite) High-Velocity Repeating Crossbow Volley!
      e.stateTimer = profile.activeSec;
      e.attackCooldown = profile.baseCooldownSec;
      e.vx = -e.facing * 65;
      const spreads = e.eliteAffix ? [-0.16, -0.08, 0, 0.08, 0.16] : [-0.09, 0, 0.09];
      for (const sp of spreads) {
        const ang = (e.facing === 1 ? 0 : Math.PI) + sp;
        this.projectiles.push({
          id: this.nextEntityId++,
          x: e.x + e.facing * 14,
          y: e.y - 18,
          vx: Math.cos(ang) * 268,
          vy: Math.sin(ang) * 268,
          radius: 3.8,
          damage: profile.projectileDamage,
          fromPlayer: false,
          color: 'crimson',
          life: 2.6,
          deflected: false,
        });
      }
    } else if (e.kind === EnemyKind.Warden) {
      // BOSS 1: Abyssal Warden Gorgon — 4-Pattern Moveset!
      const pat = e.bossPatternIndex % 4;
      e.bossPatternIndex++;
      e.attackCooldown = profile.baseCooldownSec * (e.bossEnraged ? 0.72 : 1.0);

      if (pat === 0) {
        // Pattern 0: Executioner Double Bull-Rush Cleave!
        e.stateTimer = 0.30;
        e.vx = e.facing * (e.bossEnraged ? 320 : 285);
        this.pfx.spawnSlash({
          x: e.x + e.facing * 20,
          y: e.y - 22,
          facing: e.facing,
          style: 'wide_cleave',
          palette: 'crimson',
          duration: 0.25,
          radiusX: 72,
          radiusY: 40,
          owner: 'enemy',
          sourceId: e.id,
          anchorEntityId: e.id,
          offsetX: e.facing * 20,
          offsetY: -22,
          trackUntilElapsed: 0.30,
        });
      } else if (pat === 1) {
        // Pattern 1: Seismic Ground Quake Twin Crescent Waves + Upward Shatter Sparks!
        e.stateTimer = 0.22;
        this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.42);
        this.pfx.spawnRing(e.x, e.y - 4, 78, 0.3, 255, 86, 122, false);
        const waveCount = e.bossEnraged ? 2 : 1;
        for (const dir of [-1, 1] as const) {
          for (let w = 0; w < waveCount; w++) {
            this.projectiles.push({
              id: this.nextEntityId++,
              x: e.x + dir * (14 + w * 14),
              y: e.y - 12 - w * 12,
              vx: dir * (225 + w * 35),
              vy: 0,
              radius: 6.2,
              damage: profile.projectileDamage,
              fromPlayer: false,
              color: 'crimson',
              life: 2.8,
              deflected: false,
              isSwordWave: true,
            });
          }
        }
      } else if (pat === 2) {
        // Pattern 2: Sky-Crusher Leaping Executioner Slam + Landing Shockwaves!
        e.stateTimer = 0.28;
        e.vx = e.facing * 245;
        e.vy = -240;
        e.grounded = false;
        this.pfx.spawnSlash({
          x: e.x + e.facing * 18,
          y: e.y - 24,
          facing: e.facing,
          style: 'plunge',
          palette: 'crimson',
          duration: 0.26,
          radiusX: 66,
          radiusY: 42,
          owner: 'enemy',
          sourceId: e.id,
          anchorEntityId: e.id,
          offsetX: e.facing * 18,
          offsetY: -24,
          trackUntilElapsed: 0.28,
        });
        for (const dir of [-1, 1] as const) {
          this.projectiles.push({
            id: this.nextEntityId++,
            x: e.x + dir * 16,
            y: e.y - 10,
            vx: dir * 195,
            vy: 0,
            radius: 5.5,
            damage: profile.projectileDamage - 2,
            fromPlayer: false,
            color: 'crimson',
            life: 2.2,
            deflected: false,
            isSwordWave: true,
          });
        }
      } else {
        // Pattern 3: Abyssal Chain Shockwave Nova + 6-Way Blood Shards!
        e.stateTimer = 0.24;
        this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.38);
        this.pfx.spawnRing(e.x, e.y - 22, 92, 0.34, 255, 64, 112, false);
        const shardCount = e.bossEnraged ? 8 : 6;
        for (let k = 0; k < shardCount; k++) {
          const ang = (k / shardCount) * Math.PI * 2;
          this.projectiles.push({
            id: this.nextEntityId++,
            x: e.x,
            y: e.y - 24,
            vx: Math.cos(ang) * 205,
            vy: Math.sin(ang) * 205,
            radius: 4.4,
            damage: profile.projectileDamage - 2,
            fromPlayer: false,
            color: 'crimson',
            life: 2.5,
            deflected: false,
          });
        }
      }
    } else if (e.kind === EnemyKind.Archon) {
      // BOSS 2: Star-Vault Archon Orpheus — 4-Pattern Moveset!
      const pat = e.bossPatternIndex % 4;
      e.bossPatternIndex++;
      e.attackCooldown = profile.baseCooldownSec * (e.bossEnraged ? 0.72 : 1.0);

      if (pat === 0) {
        // Pattern 0: 5/7-Way Starlight Fan Barrage!
        e.stateTimer = 0.18;
        const angles = e.bossEnraged
          ? [-0.42, -0.28, -0.14, 0, 0.14, 0.28, 0.42]
          : [-0.30, -0.15, 0, 0.15, 0.30];
        for (const a of angles) {
          const base = e.facing === 1 ? a : Math.PI - a;
          this.projectiles.push({
            id: this.nextEntityId++,
            x: e.x + e.facing * 14,
            y: e.y - 24,
            vx: Math.cos(base) * 225,
            vy: Math.sin(base) * 225,
            radius: 4.4,
            damage: profile.projectileDamage,
            fromPlayer: false,
            color: 'violet',
            life: 3.0,
            deflected: false,
          });
        }
      } else if (pat === 1) {
        // Pattern 1: Twin Astral Crescent Sword Waves (Low + Mid) + Scepter Sweep!
        e.stateTimer = 0.22;
        e.vx = e.facing * 185;
        this.pfx.spawnSlash({
          x: e.x + e.facing * 18,
          y: e.y - 24,
          facing: e.facing,
          style: 'arc_down',
          palette: 'violet',
          duration: 0.24,
          radiusX: 62,
          radiusY: 34,
          owner: 'enemy',
          sourceId: e.id,
          anchorEntityId: e.id,
          offsetX: e.facing * 18,
          offsetY: -24,
          trackUntilElapsed: 0.22,
        });
        for (let w = 0; w < 2; w++) {
          this.projectiles.push({
            id: this.nextEntityId++,
            x: e.x + e.facing * (18 + w * 12),
            y: e.y - 14 - w * 14,
            vx: e.facing * (238 + w * 28),
            vy: 0,
            radius: 5.8,
            damage: profile.projectileDamage + 2,
            fromPlayer: false,
            color: w === 0 ? 'violet' : 'cyan',
            life: 2.6,
            deflected: false,
            isSwordWave: true,
          });
        }
      } else if (pat === 2) {
        // Pattern 2: 10-Orb Radial Supernova Ring + Astral Teleport!
        e.stateTimer = 0.20;
        this.pfx.spawnRing(e.x, e.y - 24, 82, 0.32, 198, 118, 255, false);
        const count = e.bossEnraged ? 12 : 8;
        for (let k = 0; k < count; k++) {
          const ang = (k / count) * Math.PI * 2;
          this.projectiles.push({
            id: this.nextEntityId++,
            x: e.x,
            y: e.y - 24,
            vx: Math.cos(ang) * 195,
            vy: Math.sin(ang) * 195,
            radius: 4.2,
            damage: profile.projectileDamage,
            fromPlayer: false,
            color: k % 2 === 0 ? 'cyan' : 'violet',
            life: 2.5,
            deflected: false,
          });
        }
      } else {
        // Pattern 3: Celestial Starfall Spears descending from above around the player!
        e.stateTimer = 0.22;
        this.pfx.spawnRing(e.x, e.y - 28, 72, 0.3, 92, 238, 255, false);
        const spearCount = e.bossEnraged ? 6 : 4;
        for (let s = 0; s < spearCount; s++) {
          const offsetX = (s - (spearCount - 1) * 0.5) * 44;
          const spawnX = Math.max(e.homeMinX + 12, Math.min(e.homeMaxX - 12, this.player.x + offsetX));
          const spawnY = Math.max(24, this.player.y - 135 - (s % 2) * 18);
          this.pfx.spawnRing(spawnX, spawnY, 18, 0.22, 118, 240, 255, false);
          this.projectiles.push({
            id: this.nextEntityId++,
            x: spawnX,
            y: spawnY,
            vx: (this.player.x - spawnX) * 0.35,
            vy: 235,
            radius: 4.5,
            damage: profile.projectileDamage + 2,
            fromPlayer: false,
            color: 'cyan',
            life: 2.2,
            deflected: false,
          });
        }
      }
    } else {
      // BOSS 3: Crimson Moon Valkyrie Selene — 4-Pattern Moveset!
      const pat = e.bossPatternIndex % 4;
      e.bossPatternIndex++;
      e.attackCooldown = profile.baseCooldownSec * (e.bossEnraged ? 0.68 : 1.0);

      if (pat === 0) {
        // Pattern 0: Blood-Moon Valkyrie Triple Lunge Cleave!
        e.stateTimer = 0.28;
        e.vx = e.facing * (e.bossEnraged ? 345 : 310);
        this.pfx.spawnSlash({
          x: e.x + e.facing * 20,
          y: e.y - 22,
          facing: e.facing,
          style: 'wide_cleave',
          palette: 'crimson',
          duration: 0.25,
          radiusX: 74,
          radiusY: 38,
          owner: 'enemy',
          sourceId: e.id,
          anchorEntityId: e.id,
          offsetX: e.facing * 20,
          offsetY: -22,
          trackUntilElapsed: 0.28,
        });
        this.pfx.spawnSlash({
          x: e.x + e.facing * 24,
          y: e.y - 24,
          facing: e.facing,
          style: 'arc_up',
          palette: 'violet',
          duration: 0.25,
          radiusX: 66,
          radiusY: 32,
          owner: 'enemy',
          sourceId: e.id,
          anchorEntityId: e.id,
          offsetX: e.facing * 24,
          offsetY: -24,
          trackUntilElapsed: 0.28,
        });
      } else if (pat === 1) {
        // Pattern 1: Bidirectional Blood-Moon Crescent Waves + Valkyrie Sky Leap!
        e.stateTimer = 0.24;
        e.vy = -195;
        e.vx = e.facing * 180;
        e.grounded = false;
        this.pfx.spawnRing(e.x, e.y - 6, 72, 0.3, 255, 78, 120, false);
        const layers = e.bossEnraged ? 2 : 1;
        for (const dir of [-1, 1] as const) {
          for (let l = 0; l < layers; l++) {
            this.projectiles.push({
              id: this.nextEntityId++,
              x: e.x + dir * (14 + l * 14),
              y: e.y - 12 - l * 14,
              vx: dir * (245 + l * 35),
              vy: 0,
              radius: 6.2,
              damage: profile.projectileDamage,
              fromPlayer: false,
              color: l === 0 ? 'crimson' : 'violet',
              life: 2.6,
              deflected: false,
              isSwordWave: true,
            });
          }
        }
      } else if (pat === 2) {
        // Pattern 2: Scarlet Feather Storm Barrage!
        e.stateTimer = 0.18;
        const angles = e.bossEnraged
          ? [-0.38, -0.24, -0.11, 0, 0.11, 0.24, 0.38]
          : [-0.28, -0.14, 0, 0.14, 0.28];
        for (const a of angles) {
          const base = e.facing === 1 ? a : Math.PI - a;
          this.projectiles.push({
            id: this.nextEntityId++,
            x: e.x + e.facing * 14,
            y: e.y - 24,
            vx: Math.cos(base) * 238,
            vy: Math.sin(base) * 238,
            radius: 4.4,
            damage: profile.projectileDamage - 2,
            fromPlayer: false,
            color: 'crimson',
            life: 2.8,
            deflected: false,
          });
        }
      } else {
        // Pattern 3: Crimson Eclipse Judgement (`血月审判` — Horizon Cross-Slash + 8-Way Blood Spiral)!
        e.stateTimer = 0.26;
        this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.5);
        this.pfx.spawnRing(e.x, e.y - 24, 104, 0.36, 255, 58, 108, false);
        this.pfx.spawnSlash({
          x: e.x + e.facing * 18,
          y: e.y - 22,
          facing: e.facing,
          style: 'counter',
          palette: 'crimson',
          duration: 0.28,
          radiusX: 86,
          radiusY: 42,
          owner: 'enemy',
          sourceId: e.id,
          anchorEntityId: e.id,
          offsetX: e.facing * 18,
          offsetY: -22,
          trackUntilElapsed: 0.26,
        });
        const orbCount = e.bossEnraged ? 10 : 8;
        for (let k = 0; k < orbCount; k++) {
          const ang = (k / orbCount) * Math.PI * 2;
          this.projectiles.push({
            id: this.nextEntityId++,
            x: e.x,
            y: e.y - 24,
            vx: Math.cos(ang) * 215,
            vy: Math.sin(ang) * 215,
            radius: 4.5,
            damage: profile.projectileDamage,
            fromPlayer: false,
            color: k % 2 === 0 ? 'crimson' : 'violet',
            life: 2.6,
            deflected: false,
          });
        }
      }
    }
  }

  private stepEnemyActiveAttack(e: EnemyEntity, prevTimer = e.stateTimer): void {
    if (e.kind === EnemyKind.Weaver || e.kind === EnemyKind.Arbalist) {
      return;
    }

    // Multi-hit second combo swing for Stalker, Reaper, Warden, and Sovereign!
    const halfTime = ENEMY_COMBAT_STATS[e.kind].activeSec * 0.48;
    if (
      prevTimer > halfTime &&
      e.stateTimer <= halfTime &&
      (e.kind === EnemyKind.Stalker ||
        e.kind === EnemyKind.Reaper ||
        e.kind === EnemyKind.Warden ||
        e.kind === EnemyKind.Sovereign)
    ) {
      e.hitConfirmedThisSwing = false;
      e.vx = e.facing * (isBossEnemyKind(e.kind) ? 235 : 185);
      this.pfx.spawnSlash({
        x: e.x + e.facing * 16,
        y: e.y - 18,
        facing: e.facing,
        style: 'arc_up',
        palette: e.kind === EnemyKind.Reaper ? 'cyan' : 'crimson',
        duration: 0.16,
        radiusX: isBossEnemyKind(e.kind) ? 62 : 42,
        radiusY: isBossEnemyKind(e.kind) ? 32 : 24,
        owner: 'enemy',
        sourceId: e.id,
        anchorEntityId: e.id,
        offsetX: e.facing * 16,
        offsetY: -18,
        trackUntilElapsed: 0.16,
      });
    }

    if (e.hitConfirmedThisSwing) {
      return;
    }
    const p = this.player;
    this.syncAnchoredSlashes();

    // Rasterize ONLY this enemy's plotted slash pixels + weapon smear pixels!
    this.hitGridA.begin(this.camBaseX, this.camBaseY);
    const slashes = this.pfx.getSlashes();
    for (let i = 0; i < slashes.length; i++) {
      const s = slashes[i];
      if (!s.active || s.owner !== 'enemy' || s.sourceId !== e.id) continue;
      rasterizeSlashToSink(this.hitGridA, this.hitGridA.originX, this.hitGridA.originY, s);
    }
    this.rasterizeEnemyWeaponSmearToGrid(e, this.hitGridA);

    const playerTopOffset = p.moveId === MoveId.SlideSlash ? 14 : p.crouching ? 22 : 31;
    if (this.hitGridA.overlapsWorldRect(p.x - 6, p.y - playerTopOffset, p.x + 6, p.y - 2)) {
      if (p.isDashing && !p.dashPerfectTriggered) {
        this.triggerPerfectDodgeSuccess(this.getMods());
        return;
      }
      if (p.invulnTimer <= 0) {
        e.hitConfirmedThisSwing = true;
        const profile = ENEMY_COMBAT_STATS[e.kind];
        const eliteMult = e.eliteAffix === 'frenzy' ? 1.25 : e.eliteAffix ? 1.15 : 1.0;
        const enrageMult = e.bossEnraged ? 1.2 : 1.0;
        const dmg = Math.round(profile.meleeDamage * eliteMult * enrageMult);
        this.damagePlayer(dmg, e.facing);
      }
    }
  }

  private stepProjectiles(dt: number): void {
    const p = this.player;
    const room = this.getCurrentRoom();
    const mods = this.getMods();
    const playerTopOffset = p.moveId === MoveId.SlideSlash ? 14 : p.crouching ? 22 : 31;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.life -= dt;

      // Homing steering for `AstralBlades` (`星蚀飞刃` — exclusive to `星术`)
      if (proj.fromPlayer && proj.homing && this.enemies.length > 0) {
        let nearest: EnemyEntity | null = null;
        let bestDist = 260;
        for (const e of this.enemies) {
          if (e.aiState === EnemyAIState.KO || e.aiState === EnemyAIState.Spawn) continue;
          if (proj.hitIds?.has(e.id)) continue;
          const d = Math.hypot(e.x - proj.x, e.y - 20 - proj.y);
          if (d < bestDist) {
            bestDist = d;
            nearest = e;
          }
        }
        if (nearest) {
          const tx = nearest.x - proj.x;
          const ty = nearest.y - 20 - proj.y;
          const len = Math.hypot(tx, ty) || 1;
          const spd = Math.hypot(proj.vx, proj.vy) || 235;
          proj.vx += ((tx / len) * spd - proj.vx) * Math.min(1, dt * 9);
          proj.vy += ((ty / len) * spd - proj.vy) * Math.min(1, dt * 9);
        }
      }

      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;

      if (
        proj.life <= 0 ||
        proj.x < -20 ||
        proj.x > room.width + 20 ||
        proj.y > room.height + 20 ||
        proj.y < -20
      ) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // Rasterize the exact plotted PixelFX pixels of this projectile!
      this.hitGridA.begin(this.camBaseX, this.camBaseY);
      rasterizeProjectileToSink(
        this.hitGridA,
        this.hitGridA.originX,
        this.hitGridA.originY,
        proj,
        i,
        this.totalTime
      );

      if (proj.fromPlayer) {
        let hitConsumed = false;
        for (const e of this.enemies) {
          if (e.aiState === EnemyAIState.KO || e.aiState === EnemyAIState.Spawn || e.hp <= 0) continue;
          if (proj.hitIds?.has(e.id)) continue;

          const enemyTop = e.y - (isBossEnemyKind(e.kind) ? 46 : 34);
          const halfHitW = e.kind === EnemyKind.Warden ? 15 : 12;
          if (!this.hitGridA.overlapsWorldRect(e.x - halfHitW, enemyTop, e.x + halfHitW, e.y)) {
            continue;
          }

          if (proj.piercing) {
            if (!proj.hitIds) proj.hitIds = new Set<number>();
            proj.hitIds.add(e.id);
          }

          e.hp = Math.max(0, e.hp - proj.damage);
          e.flashTimer = 0.06;
          this.score += 95;
          this.pfx.spawnPopup(`${proj.damage}`, e.x, e.y - 34, 125, 240, 255);
          this.pfx.spawnHitSparks(proj.x, proj.y, proj.vx >= 0 ? 1 : -1, proj.color, false, e.y);
          sound.playHit(false, false);

          // `星雷连锁` / `天雷神罚` proc on `星术` projectile hit!
          if (
            mods.chainBoltDamage > 0 &&
            ((this.upgradeLevels[UpgradeId.ChainBolt] ?? 0) > 0 ||
              (this.upgradeLevels[UpgradeId.ThunderJudgment] ?? 0) > 0) &&
            e.hp > 0
          ) {
            this.triggerChainLightning(e, mods);
          }

          if (e.hp <= 0) {
            this.handleEnemyKilled(e, proj.vx >= 0 ? 1 : -1, 145, -115);
          }
          if (proj.isSwordWave) {
            p.bladeEnergy = Math.min(p.maxBladeEnergy, p.bladeEnergy + 6);
          }
          if (!proj.piercing) {
            hitConsumed = true;
            break;
          } else {
            proj.damage = Math.max(6, Math.round(proj.damage * 0.82));
          }
        }
        if (hitConsumed) {
          this.projectiles.splice(i, 1);
        }
      } else {
        if (this.hitGridA.overlapsWorldRect(p.x - 6, p.y - playerTopOffset, p.x + 6, p.y - 2)) {
          if (p.isDashing && !p.dashPerfectTriggered) {
            this.triggerPerfectDodgeSuccess(mods);
          } else if (p.invulnTimer <= 0) {
            this.damagePlayer(proj.damage, proj.vx >= 0 ? 1 : -1);
            this.projectiles.splice(i, 1);
          }
        }
      }
    }

    if (p.isDashing && !p.dashPerfectTriggered) {
      this.checkDashCrossingHostilePixels(p.x, p.y, p.x, p.y, mods);
    }
  }

  private damagePlayer(amount: number, dirX: 1 | -1): void {
    const p = this.player;
    if (p.invulnTimer > 0 || this.defeatFreezeTimer > 0) return;

    const mods = this.getMods();
    const reducedAmount = Math.max(1, Math.round(amount * mods.damageTakenMult));

    p.hp = Math.max(0, p.hp - reducedAmount);
    p.invulnTimer = 1.05;
    p.hurtTimer = 0.2;
    p.flashTimer = 0.1;
    p.isDashing = false;
    p.moveId = MoveId.None;
    p.empoweredLActive = false;
    p.crimsonFlashActive = false;
    p.lunarLActive = false;
    p.astraChainCount = 0;
    p.zanshinPending = false;
    // Reset retained combo stage to 0 ONLY when taking damage (`被攻击则重置连击段数`)!
    p.savedComboStage = advanceComboStage(p.savedComboStage ?? 0, MoveId.None, {
      tookDamage: true,
    });
    p.vx = dirX * 140;
    p.vy = -120;
    p.grounded = false;

    // 坚毅 (`Survival` — `AegisCounter` `反震月甲`): pixel-exact shockwave ring when hit!
    if (mods.dodgeNovaDamage > 0 && p.hp > 0) {
      this.pfx.spawnRing(p.x, p.y - 18, 76, 0.3, 255, 214, 112, false, {
        owner: 'player',
        damage: mods.dodgeNovaDamage,
        damageColor: 'silver',
        dirX: p.facing,
      });
      if (mods.thornsHeal > 0) {
        p.hp = Math.min(p.maxHp, p.hp + mods.thornsHeal);
        p.rallyHp = Math.max(p.rallyHp, p.hp);
      }
    }

    this.killStreak = 0;
    this.comboCount = 0;
    this.stylePoints = Math.max(0, this.stylePoints - 85);
    this.hitstopTimer = 0.055;
    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.52);
    this.pfx.screenFlash = 0.26;
    this.pfx.screenFlashColor = { r: 255, g: 55, b: 95 };
    this.pfx.spawnHitSparks(p.x, p.y - 18, dirX, 'crimson', true, p.y);
    sound.playHurt();

    this.emitHudSnapshot(true);

    if (p.hp <= 0) {
      this.defeatFreezeTimer = 0.55;
    }
  }

  private stepComboAndCamera(dt: number): void {
    if (this.comboCount > 0) {
      this.comboDecayTimer -= dt;
      if (this.comboDecayTimer <= 0) {
        this.comboCount = 0;
      }
    }
    if (this.stylePoints > 0) {
      const decayRate = this.comboCount > 0 ? 13 : 28;
      this.stylePoints = Math.max(0, this.stylePoints - decayRate * dt);
    }

    const room = this.getCurrentRoom();
    const targetCamX = Math.max(
      0,
      Math.min(room.width - WORLD_WIDTH, this.player.x + this.player.facing * 26 - WORLD_WIDTH * 0.5)
    );
    const targetCamY = Math.max(
      0,
      Math.min(room.height - WORLD_HEIGHT, this.player.y - 24 - WORLD_HEIGHT * 0.56)
    );

    const damp = Math.min(1, dt * 8.5);
    this.camBaseX += (targetCamX - this.camBaseX) * damp;
    this.camBaseY += (targetCamY - this.camBaseY) * damp;
  }

  private finishRun(victory: boolean): void {
    const mods = this.getMods();
    if (victory) {
      this.score +=
        2400 +
        this.collectedRelics.size * 500 +
        this.defeatedBossRooms.size * 900 +
        mods.totalUpgrades * 150 +
        Math.round(this.player.hp * 8);
    }
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      try {
        localStorage.setItem('silver_echo_best_score', String(this.bestScore));
      } catch {
        // Ignore storage error
      }
    }

    const explorationPct = Math.round((this.visitedRooms.size / ALL_ROOM_IDS.length) * 100);
    const summary: RunSummary = {
      victory,
      score: Math.round(this.score),
      bestScore: Math.round(this.bestScore),
      maxCombo: this.maxCombo,
      peakRank: this.peakRank,
      perfectDodges: this.perfectDodges,
      explorationPct,
      relicsCollected: this.collectedRelics.size,
      totalRelics: Object.keys(RELIC_METADATA).length,
      upgradesCollected: mods.totalUpgrades,
      bossesDefeated: this.defeatedBossRooms.size,
      totalBosses: 3,
      roomDefeatedIn: this.getCurrentRoom().nameZh,
      clearTimeSec: Math.round(this.runTimeSec),
    };

    sound.playOutcome(victory);
    this.setPhase(GamePhase.GameOver);
    this.callbacks.onRunEnd(summary);
  }

  private emitHudSnapshot(force = false): void {
    const room = this.getCurrentRoom();
    const mods = this.getMods();
    const boss = this.enemies.find((e) => isBossEnemyKind(e.kind) && e.aiState !== EnemyAIState.KO);
    const explorationPct = Math.round((this.visitedRooms.size / ALL_ROOM_IDS.length) * 100);

    const attackIntervalSec = computeAttackInterval(mods.attackSpeedMult);
    const cdRem = this.player.attackCooldownTimer ?? 0;
    const attackCooldownRatio =
      attackIntervalSec > 0 ? Math.max(0, Math.min(1, cdRem / attackIntervalSec)) : 0;

    const roomLocked = this.isCurrentRoomLocked();
    const astraChainCount = this.player.astraChainCount ?? 0;
    const hpInt = Math.round(this.player.hp);
    const rallyInt = Math.round(this.player.rallyHp);
    const staminaQ = Math.round(this.player.stamina * 20);
    const energyInt = Math.round(this.player.bladeEnergy);
    const cdQ = Math.round(attackCooldownRatio * 20);
    const comboRatio = Math.max(0, Math.min(1, this.comboDecayTimer / 3.4));
    const comboQ = this.comboCount > 0 ? Math.round(comboRatio * 25) : 0;
    const styleInt = Math.round(this.stylePoints);
    const scoreInt = Math.round(this.score);
    const bossHpInt = boss ? Math.round(boss.hp) : 0;
    const zanshinReady = this.player.zanshinFlashTimer > 0;
    const dodgeActive = this.perfectDodgeBannerTimer > 0 ? 1 : 0;

    const mapKey = `${this.runSeed}|${this.mapStateVersion}|${this.currentRoomId}|${this.visitedRooms.size}|${this.collectedRelics.size}|${this.brokenSeals.size}|${this.collectedAltars.size}|${this.clearedRooms.size}|${roomLocked ? 1 : 0}`;
    const hudSig = `${mapKey}|${hpInt}|${this.player.maxHp}|${rallyInt}|${staminaQ}|${this.player.maxStamina}|${energyInt}|${this.souls}|${this.forgesPurchased}|${this.killStreak}|${mods.totalUpgrades}|${cdQ}|${this.player.savedComboStage ?? 0}|${zanshinReady ? 1 : 0}|${astraChainCount}|${this.enemies.length}|${this.comboCount}|${comboQ}|${styleInt}|${this.lastMoveName}|${dodgeActive}|${this.toastBanner ?? ''}|${this.interactPrompt ?? ''}|${scoreInt}|${boss ? boss.id : 0}|${bossHpInt}|${this.defeatedBossRooms.size}|${this.upgradeDraft ? this.draftCounter : 0}`;

    if (!force && hudSig === this.lastHudSignature) {
      return;
    }
    this.lastHudSignature = hudSig;

    if (!this.cachedUpgradeSummary) {
      this.cachedUpgradeSummary = ALL_UPGRADE_IDS.filter((id) => (this.upgradeLevels[id] ?? 0) > 0).map(
        (id) => ({
          id,
          nameZh: UPGRADE_SPECS[id].nameZh,
          level: this.upgradeLevels[id],
          school: UPGRADE_SPECS[id].school,
        })
      );
    }

    if (mapKey !== this.cachedMapKey) {
      this.cachedMapKey = mapKey;
      this.cachedMinimapCells = buildMinimapSnapshot(
        this.currentRoomId,
        this.visitedRooms,
        this.collectedRelics,
        this.brokenSeals,
        this.collectedAltars,
        this.clearedRooms,
        roomLocked
      );
    }

    if (this.collectedRelics.size !== this.cachedRelicsKey) {
      this.cachedRelicsKey = this.collectedRelics.size;
      this.cachedRelicsArray = Array.from(this.collectedRelics);
    }

    this.callbacks.onHudUpdate({
      hp: hpInt,
      maxHp: this.player.maxHp,
      rallyHp: rallyInt,
      stamina: this.player.stamina,
      maxStamina: this.player.maxStamina,
      bladeEnergy: energyInt,
      ultimateEnergyCost: mods.dimensionCutCost,
      souls: this.souls,
      nextForgeCost: getSoulForgeCost(this.forgesPurchased),
      killStreak: this.killStreak,
      lunarCount: mods.lunarCount,
      brutalityCount: mods.brutalityCount,
      tacticsCount: mods.tacticsCount,
      survivalCount: mods.survivalCount,
      onslaughtCount: mods.onslaughtCount,
      soulHeartCount: mods.soulHeartCount,
      totalUpgrades: mods.totalUpgrades,
      activeUpgradeSummary: this.cachedUpgradeSummary,
      upgradeDraft: this.upgradeDraft,
      attackIntervalSec,
      attackCooldownRatio,
      savedComboStage: this.player.savedComboStage ?? 0,
      zanshinReady,
      astraChainCount,
      nextSheatheSec: computeZanshinSheatheDelay(astraChainCount),
      roomLocked,
      remainingEnemies: this.enemies.length,
      comboCount: this.comboCount,
      comboTimerRatio: comboRatio,
      styleRank: computeStyleRank(this.stylePoints),
      stylePoints: styleInt,
      lastMoveName: this.lastMoveName,
      perfectDodgeBannerTimer: this.perfectDodgeBannerTimer,
      roomNameZh: room.nameZh,
      zoneNameZh: room.zoneZh,
      toastBanner: this.toastBanner,
      interactPrompt: this.interactPrompt,
      explorationPct,
      relics: this.cachedRelicsArray,
      minimapCells: this.cachedMinimapCells,
      score: scoreInt,
      bossName: boss ? boss.nameZh : null,
      bossHp: bossHpInt,
      bossMaxHp: boss ? boss.maxHp : 1,
      bossesDefeated: this.defeatedBossRooms.size,
      runSeed: this.runSeed,
    });
  }

  private renderFrame(): void {
    this.pfx.clearBuffers();

    if (this.phase === GamePhase.Title) {
      renderBloodstainedTitleStage(
        this.pfx,
        this.player,
        this.totalTime,
        this.titlePointerNormX,
        this.titlePointerNormY
      );
      this.pfx.renderEffects();
      this.pfx.present(this.ctx);
      return;
    }

    const shakeMag = this.cameraTrauma * this.cameraTrauma * 6.5;
    this.pfx.camX = this.camBaseX + (shakeMag > 0.1 ? (Math.random() * 2 - 1) * shakeMag : 0);
    this.pfx.camY = this.camBaseY + (shakeMag > 0.1 ? (Math.random() * 2 - 1) * shakeMag : 0);

    const room = this.getCurrentRoom();
    const lockedExitBarriers = this.getLockedExitBarriers(room);
    renderMetroidvaniaRoom(this.pfx, room, this.totalTime, {
      hasRelicOnPedestal: Boolean(room.relic && !this.collectedRelics.has(room.relic.relicId)),
      hasVesselOnPedestal: Boolean(room.vessel && !this.collectedVessels.has(room.vessel.id)),
      hasAltarOnPedestal: Boolean(room.altar && !this.collectedAltars.has(room.altar.id)),
      sealIntact: Boolean(room.sealBarrier && !this.brokenSeals.has(room.sealBarrier.id)),
      shrineActive: Boolean(room.shrine && room.shrine.id === this.activeShrineId),
      roomLocked: lockedExitBarriers.length > 0,
      lockedExitBarriers,
    });

    this.syncAnchoredSlashes();
    renderAfterimages(this.pfx);

    for (const e of this.enemies) {
      renderEnemy(this.pfx, e, this.totalTime);
    }

    renderPlayerAria(this.pfx, this.player, this.totalTime, this.phase);
    renderProjectiles(this.pfx, this.projectiles, this.totalTime);
    this.pfx.renderEffects();
    renderRoomForegroundParallax(this.pfx, room, this.totalTime);
    this.pfx.present(this.ctx);
  }
}
