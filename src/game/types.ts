export enum GamePhase {
  Title = 'title',
  Playing = 'playing',
  Upgrade = 'upgrade',
  UpgradeDraft = 'upgrade',
  Paused = 'paused',
  GameOver = 'gameover',
}

export enum StyleRank {
  D = 'D',
  C = 'C',
  B = 'B',
  A = 'A',
  S = 'S',
  SS = 'SS',
  SSS = 'SSS',
}

export enum MoveId {
  None = 'none',
  Slash1 = 'slash1',
  Slash2 = 'slash2',
  Slash3 = 'slash3',
  Slash4 = 'slash4',
  SlideSlash = 'slide_slash',
  RisingMoon = 'rising_moon',
  DashThrust = 'dash_thrust',
  AirSlash1 = 'air_slash1',
  AirSlash2 = 'air_slash2',
  HelmSplitter = 'helm_splitter',
  HeavyCrescent = 'heavy_crescent',
  DimensionCut = 'dimension_cut',
  MoonCounter = 'moon_counter',
  AstralSlash = 'astral_slash',
}

export enum EnemyKind {
  Stalker = 'stalker',
  Weaver = 'weaver',
  Halberdier = 'halberdier',
  Reaper = 'reaper',
  Arbalist = 'arbalist',
  Warden = 'warden',
  Archon = 'archon',
  Sovereign = 'sovereign',
}

export enum EnemyAIState {
  Spawn = 'spawn',
  Patrol = 'patrol',
  Approach = 'approach',
  Windup = 'windup',
  Attack = 'attack',
  Recovery = 'recovery',
  Hitstun = 'hitstun',
  KO = 'ko',
}

export type RoomId =
  | 'west_rampart'
  | 'cloister'
  | 'grotto_spring'
  | 'armory'
  | 'courtyard'
  | 'reliquary'
  | 'ossuary'
  | 'fungal_pit'
  | 'catacombs'
  | 'belltower'
  | 'clockwork_loft'
  | 'sky_bridge'
  | 'prison_depths'
  | 'antechamber'
  | 'archive'
  | 'forbidden_wing'
  | 'observatory'
  | 'throne';

export enum RelicId {
  DoubleJump = 'double_jump',
  AbyssalBreaker = 'abyssal_breaker',
  ZanshinTassel = 'zanshin_tassel',
}

export enum UpgradeSchool {
  Lunar = 'lunar', // 月魄：月能与 L 键绝技相关
  Brutality = 'brutality', // 赤刃：完美闪避后按住 J 触发赤刃斩击相关
  Tactics = 'tactics', // 星术：收刀亮光时按 L 释放强化 L 键星术相关
  Survival = 'survival', // 坚毅：生存、减伤、虚血与回血相关
  Onslaught = 'onslaught', // 连袭：攻速与连击效果相关（原连斩）
  SoulHeart = 'soul_heart', // 魂心：第六属性，机动性与通用基础数值强化（多段跳、血量上限、瞬步次数等）
}

export enum UpgradeId {
  // 1. 月魄 (Lunar — 9 upgrades: Moon Energy & L-key skills)
  LunarSurge = 'lunar_surge',
  MoonWave = 'moon_wave',
  VoidEclipse = 'void_eclipse',
  CrescentSiphon = 'crescent_siphon',
  FullMoonDomain = 'full_moon_domain',
  LunarTwinWave = 'lunar_twin_wave',
  EclipseCataclysm = 'eclipse_cataclysm',
  SilverOverflow = 'silver_overflow',
  LunarAfterglow = 'lunar_afterglow',

  // 2. 赤刃 (Brutality — 9 upgrades: Perfect Dodge + Hold J 1.5s Crimson Blade Slash)
  CrimsonDraw = 'crimson_draw',
  CrimsonRend = 'crimson_rend',
  ExecutionerEdge = 'executioner_edge',
  BloodTimeDilate = 'blood_time_dilate',
  ScarletWave = 'scarlet_wave',
  CarnageMomentum = 'carnage_momentum',
  HeartSeeker = 'heart_seeker',
  CrimsonVortex = 'crimson_vortex',
  BloodlustBrand = 'bloodlust_brand',

  // 3. 星术 (Tactics — 9 upgrades: 1s Zanshin Sheathe + 0.3s Glint Window L Empowered Astral Skills)
  AstralBlades = 'astral_blades',
  ChainBolt = 'chain_bolt',
  StarlightFocus = 'starlight_focus',
  MeteorShower = 'meteor_shower',
  AstralNova = 'astral_nova',
  GrandSeeker = 'grand_seeker',
  ThunderJudgment = 'thunder_judgment',
  TimeStasisPrism = 'time_stasis_prism',
  ConstellationResonance = 'constellation_resonance',

  // 4. 坚毅 (Survival — 9 upgrades: Damage Reduction, Rally, Healing, Aegis & Poise)
  AegisCounter = 'aegis_counter',
  BloodZanshin = 'blood_zanshin',
  ImmortalBastion = 'immortal_bastion',
  GoldenBellShield = 'golden_bell_shield',
  ThornsAura = 'thorns_aura',
  UndyingWill = 'undying_will',
  VitalityFountain = 'vitality_fountain',
  HeavyArmorBreak = 'heavy_armor_break',
  SanctuaryGrace = 'sanctuary_grace',

  // 5. 连袭 (Onslaught — 9 upgrades: Attack Speed & Multi-Hit Combo Effects)
  GaleEdge = 'gale_edge',
  PhantomEcho = 'phantom_echo',
  ShatterMight = 'shatter_might',
  StormFlurry = 'storm_flurry',
  ShadowTriad = 'shadow_triad',
  ComboMastery = 'combo_mastery',
  WhirlwindStep = 'whirlwind_step',
  RelentlessBlade = 'relentless_blade',
  HyperSonicSlash = 'hypersonic_slash',

  // 6. 魂心 (SoulHeart — 9 upgrades: Mobility & Universal Base Stats: Multi-jump, Max HP, Dash Charges)
  SkyFeather = 'sky_feather',
  FrostStep = 'frost_step',
  TitanVessel = 'titan_vessel',
  WindWalker = 'wind_walker',
  AbyssalHeart = 'abyssal_heart',
  FeatherStepRecovery = 'feather_step_recovery',
  SkyDragonDive = 'sky_dragon_dive',
  SoulProsperity = 'soul_prosperity',
  OmniPotential = 'omni_potential',
}

export interface UpgradeChoiceView {
  id: UpgradeId;
  school: UpgradeSchool;
  schoolLabelZh: string;
  nameZh: string;
  subtitleZh: string;
  currentLevel: number;
  nextLevel: number;
  maxLevel: number;
  descZh: string;
  highlightStatZh: string;
  effectDescZh: string;
  statPreviewZh: string;
  accentHex: string;
}

export type UpgradeChoiceCard = UpgradeChoiceView;

export interface UpgradeDraftSnapshot {
  sourceTitleZh: string;
  sourceSubtitleZh: string;
  choices: [UpgradeChoiceView, UpgradeChoiceView, UpgradeChoiceView];
}

export type UpgradeDraftState = UpgradeDraftSnapshot;

export type EliteAffix = 'frenzy' | 'storm' | 'ward';

export interface MoveSpec {
  id: MoveId;
  nameZh: string;
  windup: number;
  active: number;
  recovery: number;
  damage: number;
  reachX: number;
  reachY: number;
  offsetY: number;
  knockbackX: number;
  knockbackY: number;
  selfVx: number;
  selfVy: number;
  hitstop: number;
  heavyBreak: boolean;
  energyGain: number;
  energyCost: number;
  slashStyle:
    | 'arc_down'
    | 'arc_up'
    | 'spin'
    | 'wide_cleave'
    | 'slide'
    | 'uppercut'
    | 'thrust'
    | 'plunge'
    | 'dimension'
    | 'counter'
    | 'astral_wave';
  slashColor: 'silver' | 'cyan' | 'violet' | 'crimson';
}

export interface HairNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export type VerletNode = HairNode;

export interface PlayerEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  grounded: boolean;
  crouching: boolean;
  crouchTimer?: number;
  dropThroughTimer: number;
  wallSlideSide: -1 | 0 | 1;
  wallJumpLockTimer: number;

  coyoteTimer: number;
  jumpBufferTimer: number;
  attackBufferTimer: number;
  attackBufferType: 'light' | 'heavy' | null;
  dashBufferTimer: number;

  hp: number;
  maxHp: number;
  rallyHp: number;
  stamina: number;
  maxStamina: number;
  bladeEnergy: number;
  maxBladeEnergy: number;

  jumpsRemaining: number;
  airDashesUsed: number;

  moveId: MoveId;
  moveTimer: number;
  moveInstanceId?: number;
  moveHitIds: Set<number>;
  comboWindowTimer: number;
  airComboCount: number;

  // Attack Speed Cadence & Persistent Combo Stage Retention
  attackCooldownTimer?: number;
  savedComboStage?: 0 | 1 | 2 | 3;
  empoweredLActive?: boolean;
  crimsonFlashActive?: boolean;
  lunarLActive?: boolean;
  astraChainCount?: number;

  // Zanshin (收刀·残心) timing recovery
  zanshinPending: boolean;
  zanshinTimer: number;
  zanshinFlashTimer: number;

  isDashing: boolean;
  dashTimer: number;
  dashCooldown: number;
  dashAfterAttackWindow: number;
  dashPerfectTriggered?: boolean;

  invulnTimer: number;
  perfectDodgeWindow: number;
  hurtTimer: number;
  flashTimer: number;

  lastSafeX: number;
  lastSafeY: number;

  scaleX: number;
  scaleY: number;
  gaitPhase: number;
  skidTimer: number;
  spinFlipTimer: number;
  landRecoveryTimer: number;

  hairLeft: HairNode[];
  hairRight: HairNode[];
  capeNodes: HairNode[];
}

export interface EnemyEntity {
  id: number;
  kind: EnemyKind;
  nameZh: string;
  x: number;
  y: number;
  homeMinX: number;
  homeMaxX: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  grounded: boolean;
  hp: number;
  maxHp: number;
  rallyHp: number;
  shieldActive: boolean;
  eliteAffix?: EliteAffix | null;
  bleedStacks?: number;
  chillTimer?: number;
  aiState: EnemyAIState;
  stateTimer: number;
  attackCooldown: number;
  bossPatternIndex: number;
  bossEnraged: boolean;
  hasAttackToken: boolean;
  hitConfirmedThisSwing: boolean;
  flashTimer: number;
  scaleX: number;
  scaleY: number;
  gaitPhase: number;
  koTimer: number;
}

export interface ProjectileEntity {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  fromPlayer: boolean;
  color: 'violet' | 'cyan' | 'crimson';
  life: number;
  deflected: boolean;
  piercing?: boolean;
  homing?: boolean;
  isSwordWave?: boolean;
  hitIds?: Set<number>;
}

export interface PlatformRect {
  x: number;
  y: number;
  w: number;
  h: number;
  oneWay?: boolean;
  hazard?: boolean;
  isHazard?: boolean;
}

export interface RoomExit {
  id?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  targetRoom: RoomId;
  spawnX: number;
  spawnY: number;
  direction: 'left' | 'right' | 'up' | 'down';
  labelZh?: string;
}

export interface TorchProp {
  x: number;
  y: number;
  color: 'amber' | 'cyan' | 'violet' | 'crimson';
}

export interface WindowProp {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PillarProp {
  x: number;
  y: number;
  h: number;
}

export interface RelicPedestal {
  relicId: RelicId;
  x: number;
  y: number;
  nameZh: string;
  subtitleZh: string;
  descriptionZh?: string;
}

export interface VitalityVessel {
  id: string;
  x: number;
  y: number;
  bonusHp: number;
  nameZh: string;
}

export interface ShrineProp {
  id: string;
  x: number;
  y: number;
  nameZh: string;
}

export interface SealBarrier {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  requiredRelic?: RelicId;
}

export interface ScrollAltarProp {
  id: string;
  x: number;
  y: number;
  nameZh: string;
}

export interface EnemySpawnDef {
  kind: EnemyKind;
  x: number;
  y: number;
  minX: number;
  maxX: number;
  eliteChance?: number;
}

export interface RoomDef {
  id: RoomId;
  nameZh: string;
  zoneZh: string;
  gridX: number;
  gridY: number;
  width: number;
  height: number;
  theme: 'moonlit' | 'tower' | 'archive' | 'crypt' | 'throne';
  templateId?: string;
  platforms: PlatformRect[];
  exits: RoomExit[];
  torches?: TorchProp[];
  windows?: WindowProp[];
  pillars?: PillarProp[];
  enemies: EnemySpawnDef[];
  relic?: RelicPedestal;
  vessel?: VitalityVessel;
  shrine?: ShrineProp;
  sealBarrier?: SealBarrier;
  altar?: ScrollAltarProp;
}

export interface MinimapRoomCell {
  id: RoomId;
  nameZh: string;
  zoneZh?: string;
  theme?: RoomDef['theme'];
  gridX: number;
  gridY: number;
  widthCols?: number;
  heightRows?: number;
  roomLocked?: boolean;
  visited: boolean;
  current: boolean;
  hasShrine: boolean;
  hasUncollectedRelic: boolean;
  hasUncollectedAltar: boolean;
  hasIntactSeal: boolean;
  sealSide?: 'left' | 'right';
  isBoss: boolean;
  bossCleared: boolean;
  connections: Array<'left' | 'right' | 'up' | 'down'>;
}

export type MinimapCell = MinimapRoomCell;

export interface ActiveUpgradeChip {
  id: UpgradeId;
  nameZh: string;
  level: number;
  school: UpgradeSchool;
}

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  rallyHp: number;
  stamina: number;
  maxStamina: number;
  bladeEnergy: number;
  ultimateEnergyCost: number;

  // Roguelike Progression & 6 Attribute Schools (`月魄 · 赤刃 · 星术 · 坚毅 · 连袭 · 魂心`)
  souls: number;
  nextForgeCost: number;
  killStreak: number;
  lunarCount: number;
  brutalityCount: number;
  tacticsCount: number;
  survivalCount: number;
  onslaughtCount: number;
  soulHeartCount: number;
  totalUpgrades: number;
  activeUpgradeSummary: ActiveUpgradeChip[];
  upgradeDraft: UpgradeDraftSnapshot | null;

  // Attack Speed Cadence & Persistent Combo Stage Retention
  attackIntervalSec: number;
  attackCooldownRatio: number; // 0 = ready, 0..1 = cooling down
  savedComboStage: 0 | 1 | 2 | 3;
  zanshinReady: boolean;
  astraChainCount?: number;
  nextSheatheSec?: number;
  roomLocked?: boolean;
  remainingEnemies?: number;

  comboCount: number;
  comboTimerRatio: number;
  styleRank: StyleRank;
  stylePoints: number;
  lastMoveName: string;
  perfectDodgeBannerTimer: number;
  roomNameZh: string;
  zoneNameZh: string;
  toastBanner: string | null;
  interactPrompt: string | null;
  explorationPct: number;
  relics: RelicId[];
  minimapCells: MinimapCell[];
  score: number;
  bossName: string | null;
  bossHp: number;
  bossMaxHp: number;
  bossesDefeated: number;
  runSeed: number;
}

export interface RunSummary {
  victory: boolean;
  score: number;
  bestScore: number;
  maxCombo: number;
  peakRank: StyleRank;
  perfectDodges: number;
  explorationPct: number;
  relicsCollected: number;
  totalRelics: number;
  upgradesCollected: number;
  bossesDefeated: number;
  totalBosses: number;
  roomDefeatedIn: string;
  clearTimeSec: number;
}
