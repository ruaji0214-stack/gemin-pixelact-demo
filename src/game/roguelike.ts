import {
  EnemyKind,
  UpgradeChoiceView,
  UpgradeDraftSnapshot,
  UpgradeId,
  UpgradeSchool,
} from './types';

/**
 * Pure Roguelike Ability Draft, 6-Attribute School Scaling & 54-Upgrade Progression Engine
 *
 * Defines 6 distinct attribute styles (`月魄 · 赤刃 · 星术 · 坚毅 · 连袭 · 魂心`) with 54 total upgrades (9 per school):
 * - `月魄` (`UpgradeSchool.Lunar` — 月能与 L 键绝技相关, 9 种强化):
 *    Increases Moon Energy generation, lowers `L` skill energy cost, and empowers `L` heavy/ultimate skills & Lunar Sword Waves.
 * - `赤刃` (`UpgradeSchool.Brutality` — 完美闪避后按住 J 触发 1.5s 赤刃斩击相关, 9 种强化):
 *    Triggering Perfect Dodge and holding `J` unleashes the dedicated 1.5s 3-wave Crimson Blade Slash (`赤刃斩击·刹那血闪`) with 0.2x world time dilation, multi-hit blood echoes, scarlet sword waves, guaranteed crits, and bleed explosions.
 * - `星术` (`UpgradeSchool.Tactics` — 攻击结束后 1s 收刀亮光 0.3s 窗口内按 L 释放强化 L 键星术相关, 9 种强化):
 *    Pressing `L` during the 0.3s sheathe glint window (`残心亮光`) unleashes a spectacular Astral-Empowered `L` skill with homing star-blade barrages, sky-pillar chain lightning, meteor showers, and astral nova rings.
 * - `坚毅` (`UpgradeSchool.Survival` — 生存相关, 9 种强化):
 *    Damage reduction, Rally HP recovery, Zanshin/kill healing, thorns aura, and Aegis shockwaves.
 * - `连袭` (`UpgradeSchool.Onslaught` — 攻速与连击效果相关, 9 种强化):
 *    Increases Attack Speed (shortening the `1.2s` base attack interval) and adds multi-shadow echo follow-ups, hypersonic wind blades, & per-combo-stage damage scaling.
 * - `魂心` (`UpgradeSchool.SoulHeart` — 第六属性：机动性与通用基础数值强化, 9 种强化):
 *    Grants extra air jumps (`跳跃加多段`), max HP (`血量上限`), extra dash charges (`瞬步次数上限`), movement speed, soul gain, and universal base attack power.
 */

export interface UpgradeSpec {
  id: UpgradeId;
  school: UpgradeSchool;
  schoolLabelZh: string;
  nameZh: string;
  subtitleZh: string;
  maxLevel: number;
  accentHex: string;
  describeEffect: (nextLevel: number) => string;
  describeStatPreview: (currentLevel: number, nextLevel: number) => string;
}

export const SCHOOL_METADATA: Record<
  UpgradeSchool,
  {
    nameZh: string;
    shortZh: string;
    styleDescZh: string;
    accentHex: string;
  }
> = {
  [UpgradeSchool.Lunar]: {
    nameZh: '月魄 · 月能秘技',
    shortZh: '月魄',
    styleDescZh: 'L 键完全专属【月魄】秘技，释放展开 0.2x 凝时结界与独立秘技动作，提升月能循环与近身朔月重弧',
    accentHex: '#a5b4fc',
  },
  [UpgradeSchool.Brutality]: {
    nameZh: '赤刃 · 刹那血闪',
    shortZh: '赤刃',
    styleDescZh: '完美闪避后按住 J 触发 1.5s 凝时（全场 0.2x 流速）高爆【赤刃斩击】，附加单刀血闪与绯血爆裂',
    accentHex: '#ff5c8a',
  },
  [UpgradeSchool.Tactics]: {
    nameZh: '星术 · 星芒绝斩',
    shortZh: '星术',
    styleDescZh: '唯一远程流派：收刀微光按住 J 激发 0.2x 凝时远程【星术·星芒绝斩】，每次激发减半下次收刀时间',
    accentHex: '#5ce6ff',
  },
  [UpgradeSchool.Survival]: {
    nameZh: '坚毅 · 不屈金身',
    shortZh: '坚毅',
    styleDescZh: '提供高额减伤、虚血夺回、残心/击杀回血与完美闪避反震护甲',
    accentHex: '#ffd86b',
  },
  [UpgradeSchool.Onslaught]: {
    nameZh: '连袭 · 疾风连击',
    shortZh: '连袭',
    styleDescZh: '直接提升攻速（缩短 0.5s 基础攻击间隔），强化多重幻影追斩与四段连击增伤',
    accentHex: '#4ade80',
  },
  [UpgradeSchool.SoulHeart]: {
    nameZh: '魂心 · 圣魂机动',
    shortZh: '魂心',
    styleDescZh: '强化机动性与通用基础数值：额外空中跳跃段数、血量上限、瞬步次数上限与全伤加成',
    accentHex: '#f0abfc',
  },
};

export const UPGRADE_SPECS: Record<UpgradeId, UpgradeSpec> = {
  // ==================== 1. 月魄 (Lunar — 9 Upgrades: 月能与 L 键绝技相关) ====================
  [UpgradeId.LunarSurge]: {
    id: UpgradeId.LunarSurge,
    school: UpgradeSchool.Lunar,
    schoolLabelZh: '月魄 · 月能绝技',
    nameZh: '月华奔涌',
    subtitleZh: '月能沸腾 · L 键绝技减耗',
    maxLevel: 3,
    accentHex: '#a5b4fc',
    describeEffect: (lv) =>
      `月能获取效率提升 +${lv * 35}%，且 L 键【拔刀·次元绝斩】的月能消耗降低至 ${Math.max(18, 50 - lv * 6)} 点。`,
    describeStatPreview: (cur, next) =>
      `月能获取 +${cur * 35}% → +${next * 35}% · 次元斩耗能 ${Math.max(18, 50 - next * 6)}`,
  },
  [UpgradeId.MoonWave]: {
    id: UpgradeId.MoonWave,
    school: UpgradeSchool.Lunar,
    schoolLabelZh: '月魄 · 月能绝技',
    nameZh: '朔月重弧',
    subtitleZh: 'L 键绝技与终式绽放近身重弧',
    maxLevel: 3,
    accentHex: '#a5b4fc',
    describeEffect: (lv) =>
      `释放 L 键技能（朔月重斩 / 坠星裂地斩 / 次元绝斩）及四连终式时，在身前绽放扩域近战【朔月重弧】，造成 ${16 + lv * 15} 点月能伤害并回复 6 点月能。`,
    describeStatPreview: (cur, next) =>
      `重弧伤害 ${cur === 0 ? 0 : 16 + cur * 15} → ${16 + next * 15}（命中回能 +6）`,
  },
  [UpgradeId.VoidEclipse]: {
    id: UpgradeId.VoidEclipse,
    school: UpgradeSchool.Lunar,
    schoolLabelZh: '月魄 · 月能绝技',
    nameZh: '虚空月蚀',
    subtitleZh: 'L 键绝技增伤 · 破除正盾',
    maxLevel: 3,
    accentHex: '#a5b4fc',
    describeEffect: (lv) =>
      `所有 L 键技能伤害提升 +${lv * 30}%，无视重装铁卫正面护盾，并在释放 L 键技能时爆发月蚀新星额外造成 ${20 + lv * 16} 点范围伤害。`,
    describeStatPreview: (cur, next) =>
      `L键技能伤害 +${cur * 30}% → +${next * 30}% · 月蚀新星 ${20 + next * 16}`,
  },
  [UpgradeId.CrescentSiphon]: {
    id: UpgradeId.CrescentSiphon,
    school: UpgradeSchool.Lunar,
    schoolLabelZh: '月魄 · 月能绝技',
    nameZh: '弦月虹吸',
    subtitleZh: '重弧与 L 技命中虹吸回能',
    maxLevel: 3,
    accentHex: '#a5b4fc',
    describeEffect: (lv) =>
      `L 键技能与【朔月重弧】每次命中敌人额外抽取 +${4 + lv * 4} 点月能，并提升 L 键技能伤害 +${lv * 18}%。`,
    describeStatPreview: (cur, next) =>
      `命中额外回能 +${cur === 0 ? 0 : 4 + cur * 4} → +${4 + next * 4} · L技增伤 +${next * 18}%`,
  },
  [UpgradeId.FullMoonDomain]: {
    id: UpgradeId.FullMoonDomain,
    school: UpgradeSchool.Lunar,
    schoolLabelZh: '月魄 · 月能绝技',
    nameZh: '满月盈域',
    subtitleZh: '高月能状态全伤与绝技暴涨',
    maxLevel: 3,
    accentHex: '#a5b4fc',
    describeEffect: (lv) =>
      `月能高于 40 点时进入【满月盈域】，L 键绝技伤害提升 +${lv * 28}%，且每次挥刀额外充能 +${lv * 2} 点月能。`,
    describeStatPreview: (cur, next) =>
      `满月L技增伤 +${cur * 28}% → +${next * 28}% · 挥刀回能 +${next * 2}`,
  },
  [UpgradeId.LunarTwinWave]: {
    id: UpgradeId.LunarTwinWave,
    school: UpgradeSchool.Lunar,
    schoolLabelZh: '月魄 · 月能绝技',
    nameZh: '双月叠斩',
    subtitleZh: 'L 键技能追加逆月近战二连弧',
    maxLevel: 3,
    accentHex: '#a5b4fc',
    describeEffect: (lv) =>
      `释放 L 键技能时在身前追加第 2 道逆向交叠紫月近战刀弧，造成 ${18 + lv * 14} 点月能伤害，且 L 键刀光范围扩大 +${lv * 10}%。`,
    describeStatPreview: (cur, next) =>
      `双月叠斩伤害 ${cur === 0 ? 0 : 18 + cur * 14} → ${18 + next * 14} · 刀光范围 +${next * 10}%`,
  },
  [UpgradeId.EclipseCataclysm]: {
    id: UpgradeId.EclipseCataclysm,
    school: UpgradeSchool.Lunar,
    schoolLabelZh: '月魄 · 月能绝技',
    nameZh: '月蚀天陨',
    subtitleZh: '次元绝斩与重斩引发月蚀轰击',
    maxLevel: 3,
    accentHex: '#a5b4fc',
    describeEffect: (lv) =>
      `释放 L 键【次元绝斩】或【朔月重斩】时，在前方引发月蚀震裂，对大范围敌人额外造成 ${26 + lv * 18} 点虚空伤害。`,
    describeStatPreview: (cur, next) =>
      `月蚀震裂伤害 ${cur === 0 ? 0 : 26 + cur * 18} → ${26 + next * 18}`,
  },
  [UpgradeId.SilverOverflow]: {
    id: UpgradeId.SilverOverflow,
    school: UpgradeSchool.Lunar,
    schoolLabelZh: '月魄 · 月能绝技',
    nameZh: '银辉满溢',
    subtitleZh: '月能转化全伤 · 次元绝斩减耗',
    maxLevel: 3,
    accentHex: '#a5b4fc',
    describeEffect: (lv) =>
      `月能获取提升 +${lv * 22}%，L 键【次元绝斩】消耗再降低 ${lv * 3} 点，且所有攻击附带 ${lv * 10}% 的银辉月能增伤。`,
    describeStatPreview: (cur, next) =>
      `银辉增伤 +${cur * 10}% → +${next * 10}% · 次元斩减耗 -${next * 3}`,
  },
  [UpgradeId.LunarAfterglow]: {
    id: UpgradeId.LunarAfterglow,
    school: UpgradeSchool.Lunar,
    schoolLabelZh: '月魄 · 月能绝技',
    nameZh: '残月余晖',
    subtitleZh: 'L 技释放后返还月能与增伤',
    maxLevel: 3,
    accentHex: '#a5b4fc',
    describeEffect: (lv) =>
      `每次释放 L 键绝技后立即返还 ${6 + lv * 5} 点月能，并使所有 L 键绝技与月魄刀光伤害永久提升 +${lv * 16}%。`,
    describeStatPreview: (cur, next) =>
      `L技返还月能 ${cur === 0 ? 0 : 6 + cur * 5} → ${6 + next * 5} · L技增伤 +${next * 16}%`,
  },

  // ==================== 2. 赤刃 (Brutality — 9 Upgrades: 完美闪避后按住 J 触发 1.5s 赤刃斩击相关) ====================
  [UpgradeId.CrimsonDraw]: {
    id: UpgradeId.CrimsonDraw,
    school: UpgradeSchool.Brutality,
    schoolLabelZh: '赤刃 · 刹那血闪',
    nameZh: '赤刃拔刀',
    subtitleZh: '完美闪避按住 J · 1.5s 凝时一刀必杀',
    maxLevel: 3,
    accentHex: '#ff5c8a',
    describeEffect: (lv) =>
      `完美闪避后按住 J 触发 1.5s【赤刃斩击·刹那血闪】（期间全场流速降低至 0.2 倍），单发居合一闪倍率提升 +${lv * 45}%，并附加 +${lv * 36} 点巨额基础斩击威力。`,
    describeStatPreview: (cur, next) =>
      `赤刃一闪倍率 +${cur * 45}% → +${next * 45}% · 基础威力 +${next * 36}`,
  },
  [UpgradeId.CrimsonRend]: {
    id: UpgradeId.CrimsonRend,
    school: UpgradeSchool.Brutality,
    schoolLabelZh: '赤刃 · 刹那血闪',
    nameZh: '绯血撕裂',
    subtitleZh: '赤刃斩击双倍叠血 · 绯血爆裂',
    maxLevel: 3,
    accentHex: '#ff5c8a',
    describeEffect: (lv) =>
      `攻击叠加【绯血】印记（赤刃斩击每次挥砍直接叠加 2 层），满 3 层引发绯血新星爆裂，造成 ${24 + lv * 20} 点范围流血伤害。`,
    describeStatPreview: (cur, next) =>
      `绯血爆裂伤害 ${cur === 0 ? 0 : 24 + cur * 20} → ${24 + next * 20}（赤刃2层/击）`,
  },
  [UpgradeId.ExecutionerEdge]: {
    id: UpgradeId.ExecutionerEdge,
    school: UpgradeSchool.Brutality,
    schoolLabelZh: '赤刃 · 刹那血闪',
    nameZh: '处决之刃',
    subtitleZh: '赤刃斩击必暴 · 暴伤强化',
    maxLevel: 3,
    accentHex: '#ff5c8a',
    describeEffect: (lv) =>
      `【赤刃斩击】必定暴击且命中返还 0.8 格瞬步羽翼；全局暴击率 +${lv * 14}%，暴击与背刺伤害额外提升 +${lv * 32}%。`,
    describeStatPreview: (cur, next) =>
      `赤刃必暴 · 暴伤 +${cur * 32}% → +${next * 32}%`,
  },
  [UpgradeId.BloodTimeDilate]: {
    id: UpgradeId.BloodTimeDilate,
    school: UpgradeSchool.Brutality,
    schoolLabelZh: '赤刃 · 刹那血闪',
    nameZh: '血刹凝时',
    subtitleZh: '延长赤刃触发窗口 · 凝时处决增伤',
    maxLevel: 3,
    accentHex: '#ff5c8a',
    describeEffect: (lv) =>
      `完美闪避后按住 J 触发【赤刃斩击】的判定窗口延长 +${(lv * 0.35).toFixed(2)}s，且 0.2x 凝时斩击期间对敌人造成的伤害额外提升 +${lv * 30}%。`,
    describeStatPreview: (cur, next) =>
      `赤刃窗口 +${(next * 0.35).toFixed(2)}s · 凝时斩击伤害 +${cur * 30}% → +${next * 30}%`,
  },
  [UpgradeId.ScarletWave]: {
    id: UpgradeId.ScarletWave,
    school: UpgradeSchool.Brutality,
    schoolLabelZh: '赤刃 · 刹那血闪',
    nameZh: '绯月断空',
    subtitleZh: '1.5s 赤刃一闪扩域十字血斩',
    maxLevel: 3,
    accentHex: '#ff5c8a',
    describeEffect: (lv) =>
      `1.5s【赤刃斩击】挥出强力一刀时在身前撕裂巨型近战【绯月断空】十字血弧，造成 ${22 + lv * 16} 点高额绯血伤害并叠加流血。`,
    describeStatPreview: (cur, next) =>
      `绯月断空伤害 ${cur === 0 ? 0 : 22 + cur * 16} → ${22 + next * 16}`,
  },
  [UpgradeId.CarnageMomentum]: {
    id: UpgradeId.CarnageMomentum,
    school: UpgradeSchool.Brutality,
    schoolLabelZh: '赤刃 · 刹那血闪',
    nameZh: '戮血狂潮',
    subtitleZh: '赤刃与近战狂暴增伤',
    maxLevel: 3,
    accentHex: '#ff5c8a',
    describeEffect: (lv) =>
      `所有近战与【赤刃斩击】伤害提升 +${lv * 20}%，且每次释放赤刃斩击额外追加 +${lv} 道血影残响。`,
    describeStatPreview: (cur, next) =>
      `近战与赤刃 +${cur * 20}% → +${next * 20}% · 额外血影 +${next}`,
  },
  [UpgradeId.HeartSeeker]: {
    id: UpgradeId.HeartSeeker,
    school: UpgradeSchool.Brutality,
    schoolLabelZh: '赤刃 · 刹那血闪',
    nameZh: '穿心血刺',
    subtitleZh: '致命暴击率与暴伤大幅跃升',
    maxLevel: 3,
    accentHex: '#ff5c8a',
    describeEffect: (lv) =>
      `全局暴击率提升 +${lv * 12}%，暴击伤害提升 +${lv * 26}%，【赤刃斩击】最后一段下劈造成额外 ${28 + lv * 18} 点穿心爆发。`,
    describeStatPreview: (cur, next) =>
      `暴击率 +${next * 12}% · 暴伤 +${cur * 26}% → +${next * 26}%`,
  },
  [UpgradeId.CrimsonVortex]: {
    id: UpgradeId.CrimsonVortex,
    school: UpgradeSchool.Brutality,
    schoolLabelZh: '赤刃 · 刹那血闪',
    nameZh: '血影旋涡',
    subtitleZh: '赤刃斩击爆发大范围血月风暴',
    maxLevel: 3,
    accentHex: '#ff5c8a',
    describeEffect: (lv) =>
      `触发【赤刃斩击】时在周身卷起绯血剑刃旋涡，对周围所有敌人造成 ${26 + lv * 18} 点范围撕裂伤害并回复 ${2 + lv * 2} 点生命。`,
    describeStatPreview: (cur, next) =>
      `血影旋涡伤害 ${cur === 0 ? 0 : 26 + cur * 18} → ${26 + next * 18} · 吸血 +${2 + next * 2}`,
  },
  [UpgradeId.BloodlustBrand]: {
    id: UpgradeId.BloodlustBrand,
    school: UpgradeSchool.Brutality,
    schoolLabelZh: '赤刃 · 刹那血闪',
    nameZh: '血印共鸣',
    subtitleZh: '绯血爆裂增伤 · 完美闪避回能',
    maxLevel: 3,
    accentHex: '#ff5c8a',
    describeEffect: (lv) =>
      `【绯血】爆裂伤害额外提升 +${lv * 24} 点，且触发完美闪避或【赤刃斩击】时额外回复 ${10 + lv * 8} 点月能。`,
    describeStatPreview: (cur, next) =>
      `绯血爆裂 +${cur * 24} → +${next * 24} · 赤刃回能 +${10 + next * 8}`,
  },

  // ==================== 3. 星术 (Tactics — 9 Upgrades: 收刀微光按住 J 远程星芒绝斩 + 连续减半收刀时间) ====================
  [UpgradeId.AstralBlades]: {
    id: UpgradeId.AstralBlades,
    school: UpgradeSchool.Tactics,
    schoolLabelZh: '星术 · 星芒绝斩',
    nameZh: '星蚀飞刃',
    subtitleZh: '收刀按住 J · 远程剑波伴生追踪星刃',
    maxLevel: 3,
    accentHex: '#5ce6ff',
    describeEffect: (lv) =>
      `收刀微光（0.3s 窗口）按住 J 激发 0.2x 凝时远程【星芒绝斩】（激发后收刀时间减半），齐射 ${4 + lv * 3} 枚高敏追踪【星蚀飞刃】，每枚造成 ${18 + lv * 10} 点星能伤害。`,
    describeStatPreview: (cur, next) =>
      `星芒飞刃 ${cur === 0 ? 4 : 4 + cur * 3}枚 → ${4 + next * 3}枚 × ${18 + next * 10} 伤害`,
  },
  [UpgradeId.ChainBolt]: {
    id: UpgradeId.ChainBolt,
    school: UpgradeSchool.Tactics,
    schoolLabelZh: '星术 · 星芒绝斩',
    nameZh: '星雷连锁',
    subtitleZh: '星芒绝斩召唤天顶落雷与跃迁电弧',
    maxLevel: 3,
    accentHex: '#5ce6ff',
    describeEffect: (lv) =>
      `收刀按住 J 激发【星芒绝斩】或星术剑波/飞刃命中时，召唤天顶落雷并在最多 ${2 + lv * 2} 名敌人间跃迁【星雷连锁】，造成 ${22 + lv * 15} 点雷电伤害。`,
    describeStatPreview: (cur, next) =>
      `连锁弹射 ${cur === 0 ? 0 : 2 + cur * 2} → ${2 + next * 2} 目标 · ${22 + next * 15} 雷伤`,
  },
  [UpgradeId.StarlightFocus]: {
    id: UpgradeId.StarlightFocus,
    school: UpgradeSchool.Tactics,
    schoolLabelZh: '星术 · 星芒绝斩',
    nameZh: '星辉残心',
    subtitleZh: '连续减半收刀回能 · 远程星芒巨幅增伤',
    maxLevel: 3,
    accentHex: '#5ce6ff',
    describeEffect: (lv) =>
      `每次收刀微光额外回复 +${8 + lv * 10} 点月能；收刀按住 J 激发的远程【星芒绝斩】与剑波总伤害提升 +${lv * 50}%，配合连续减半收刀可高频连发！`,
    describeStatPreview: (cur, next) =>
      `星芒绝斩伤害 +${cur * 50}% → +${next * 50}% · 收刀回能 +${8 + next * 10}`,
  },
  [UpgradeId.MeteorShower]: {
    id: UpgradeId.MeteorShower,
    school: UpgradeSchool.Tactics,
    schoolLabelZh: '星术 · 星芒绝斩',
    nameZh: '群星陨落',
    subtitleZh: '星芒绝斩召唤漫天星陨光枪轰炸',
    maxLevel: 3,
    accentHex: '#5ce6ff',
    describeEffect: (lv) =>
      `收刀按住 J 激发【星芒绝斩】时，从天顶降下 ${4 + lv * 2} 道贯穿天地的【星陨光枪】，对全房敌人造成每道 ${24 + lv * 14} 点远程星陨伤害！`,
    describeStatPreview: (cur, next) =>
      `天顶星陨 ${cur === 0 ? 0 : 4 + cur * 2} → ${4 + next * 2} 道 × ${24 + next * 14} 伤害`,
  },
  [UpgradeId.AstralNova]: {
    id: UpgradeId.AstralNova,
    school: UpgradeSchool.Tactics,
    schoolLabelZh: '星术 · 星芒绝斩',
    nameZh: '星璇爆裂',
    subtitleZh: '星芒绝斩展开双层星璇崩灭法阵',
    maxLevel: 3,
    accentHex: '#5ce6ff',
    describeEffect: (lv) =>
      `收刀按住 J 释放【星芒绝斩】瞬间展开双层星璇法阵，对半径 145 内所有敌人造成 ${32 + lv * 22} 点星璇爆裂伤害并冰封减速 2.2s。`,
    describeStatPreview: (cur, next) =>
      `星璇法阵伤害 ${cur === 0 ? 0 : 32 + cur * 22} → ${32 + next * 22}（大范围减速）`,
  },
  [UpgradeId.GrandSeeker]: {
    id: UpgradeId.GrandSeeker,
    school: UpgradeSchool.Tactics,
    schoolLabelZh: '星术 · 星芒绝斩',
    nameZh: '天枢剑阵',
    subtitleZh: '远程星芒剑波与飞刃数量倍增',
    maxLevel: 3,
    accentHex: '#5ce6ff',
    describeEffect: (lv) =>
      `【星芒绝斩】额外多斩出 1 道穿透远程星弧，【星蚀飞刃】发射数量额外 +${lv * 2} 枚，每枚伤害额外 +${lv * 10} 点且可穿透目标。`,
    describeStatPreview: (cur, next) =>
      `飞刃数量 +${cur * 2} → +${next * 2} 枚 · 飞刃伤害 +${next * 10}`,
  },
  [UpgradeId.ThunderJudgment]: {
    id: UpgradeId.ThunderJudgment,
    school: UpgradeSchool.Tactics,
    schoolLabelZh: '星术 · 星芒绝斩',
    nameZh: '天雷神罚',
    subtitleZh: '星雷连锁伤害与弹射目标强化',
    maxLevel: 3,
    accentHex: '#5ce6ff',
    describeEffect: (lv) =>
      `【星雷连锁】伤害额外提升 +${lv * 16} 点，额外弹射 +${lv} 名目标，且远程星芒剑波每次命中都会引落天雷神罚。`,
    describeStatPreview: (cur, next) =>
      `天雷伤害 +${cur * 16} → +${next * 16} · 弹射目标 +${next}`,
  },
  [UpgradeId.TimeStasisPrism]: {
    id: UpgradeId.TimeStasisPrism,
    school: UpgradeSchool.Tactics,
    schoolLabelZh: '星术 · 星芒绝斩',
    nameZh: '星界棱镜',
    subtitleZh: '延长收刀微光窗口 · 连续星芒返还瞬步',
    maxLevel: 3,
    accentHex: '#5ce6ff',
    describeEffect: (lv) =>
      `收刀微光窗口额外延长 +${(lv * 0.08).toFixed(2)}s，激发【星芒绝斩】时立即回复 1 格瞬步羽翼并获得 0.6s 星界无敌护体。`,
    describeStatPreview: (cur, next) =>
      `收刀窗口 +${(next * 0.08).toFixed(2)}s · 星芒回体+无敌`,
  },
  [UpgradeId.ConstellationResonance]: {
    id: UpgradeId.ConstellationResonance,
    school: UpgradeSchool.Tactics,
    schoolLabelZh: '星术 · 星芒绝斩',
    nameZh: '星宿共鸣',
    subtitleZh: '连续减半收刀叠层共振强化所有星技',
    maxLevel: 3,
    accentHex: '#5ce6ff',
    describeEffect: (lv) =>
      `远程【星芒绝斩】总伤害再提升 +${lv * 35}%，且每拥有 1 级【星术】流派强化，所有技能与剑波伤害额外提升 +${lv * 4}%。`,
    describeStatPreview: (cur, next) =>
      `星芒绝斩 +${cur * 35}% → +${next * 35}% · 星宿共鸣 +${next * 4}%/级`,
  },

  // ==================== 4. 坚毅 (Survival — 9 Upgrades: 生存、减伤、虚血与反震相关) ====================
  [UpgradeId.AegisCounter]: {
    id: UpgradeId.AegisCounter,
    school: UpgradeSchool.Survival,
    schoolLabelZh: '坚毅 · 不屈金身',
    nameZh: '反震月甲',
    subtitleZh: '减伤护体 · 闪避与受击反震波',
    maxLevel: 3,
    accentHex: '#ffd86b',
    describeEffect: (lv) =>
      `受到的所有伤害降低 ${lv * 12}%；触发极限闪避或受到攻击时爆发【金月反震波】，对周围敌人造成 ${26 + lv * 20} 点震击伤害。`,
    describeStatPreview: (cur, next) =>
      `减伤 ${cur * 12}% → ${next * 12}% · 反震波 ${26 + next * 20} 伤害`,
  },
  [UpgradeId.BloodZanshin]: {
    id: UpgradeId.BloodZanshin,
    school: UpgradeSchool.Survival,
    schoolLabelZh: '坚毅 · 不屈金身',
    nameZh: '血月残心',
    subtitleZh: '1s 收刀亮光与斩杀双效回血',
    maxLevel: 3,
    accentHex: '#ffd86b',
    describeEffect: (lv) =>
      `每次触发 1s【残心】收刀亮光恢复 ${3 + lv * 4} 点生命，且每次击杀敌人额外恢复 ${4 + lv * 4} 点生命。`,
    describeStatPreview: (cur, next) =>
      `收刀回血 +${3 + next * 4} · 斩杀回血 +${4 + next * 4}`,
  },
  [UpgradeId.ImmortalBastion]: {
    id: UpgradeId.ImmortalBastion,
    school: UpgradeSchool.Survival,
    schoolLabelZh: '坚毅 · 不屈金身',
    nameZh: '不朽壁垒',
    subtitleZh: '虚血长驻 · 挥刀强效吸血',
    maxLevel: 3,
    accentHex: '#ffd86b',
    describeEffect: (lv) =>
      `受创后的【虚血（Rally）】消退速度减缓 ${lv * 28}%，且攻击命中夺回虚血的恢复量提升 +${lv * 45}%。`,
    describeStatPreview: (cur, next) =>
      `虚血夺回 +${cur * 45}% → +${next * 45}% · 衰减减缓 ${next * 28}%`,
  },
  [UpgradeId.GoldenBellShield]: {
    id: UpgradeId.GoldenBellShield,
    school: UpgradeSchool.Survival,
    schoolLabelZh: '坚毅 · 不屈金身',
    nameZh: '金钟月佑',
    subtitleZh: '高额常驻减伤与生命上限提升',
    maxLevel: 3,
    accentHex: '#ffd86b',
    describeEffect: (lv) =>
      `最大生命上限 +${lv * 20}，受到的所有伤害额外降低 ${lv * 8}%，受击后的无敌护体时间延长 +${(lv * 0.25).toFixed(2)}s。`,
    describeStatPreview: (cur, next) =>
      `生命 +${next * 20} · 额外减伤 ${cur * 8}% → ${next * 8}%`,
  },
  [UpgradeId.ThornsAura]: {
    id: UpgradeId.ThornsAura,
    school: UpgradeSchool.Survival,
    schoolLabelZh: '坚毅 · 不屈金身',
    nameZh: '荆棘圣铠',
    subtitleZh: '反震波伤害倍增并汲取生命',
    maxLevel: 3,
    accentHex: '#ffd86b',
    describeEffect: (lv) =>
      `【金月反震波】伤害额外提升 +${20 + lv * 18} 点，且触发反震波时立即为角色恢复 ${4 + lv * 3} 点生命值。`,
    describeStatPreview: (cur, next) =>
      `反震伤害 +${cur === 0 ? 0 : 20 + cur * 18} → +${20 + next * 18} · 反震回血 +${4 + next * 3}`,
  },
  [UpgradeId.UndyingWill]: {
    id: UpgradeId.UndyingWill,
    school: UpgradeSchool.Survival,
    schoolLabelZh: '坚毅 · 不屈金身',
    nameZh: '不屈战意',
    subtitleZh: '坚毅加持近战威力与斩杀回血',
    maxLevel: 3,
    accentHex: '#ffd86b',
    describeEffect: (lv) =>
      `近战与重斩伤害提升 +${lv * 16}%，击杀敌人额外回复 +${lv * 4} 点生命，且虚血夺回效率提升 +${lv * 25}%。`,
    describeStatPreview: (cur, next) =>
      `近战伤害 +${cur * 16}% → +${next * 16}% · 斩杀回血 +${next * 4}`,
  },
  [UpgradeId.VitalityFountain]: {
    id: UpgradeId.VitalityFountain,
    school: UpgradeSchool.Survival,
    schoolLabelZh: '坚毅 · 不屈金身',
    nameZh: '生机泉涌',
    subtitleZh: '残心收刀回血与最大生命激增',
    maxLevel: 3,
    accentHex: '#ffd86b',
    describeEffect: (lv) =>
      `最大生命上限永久 +${lv * 25}，每次 1s 收刀亮光额外恢复 +${lv * 3} 点生命并立即回复 20 点当前生命。`,
    describeStatPreview: (cur, next) =>
      `生命上限 +${cur * 25} → +${next * 25} · 收刀回血 +${next * 3}`,
  },
  [UpgradeId.HeavyArmorBreak]: {
    id: UpgradeId.HeavyArmorBreak,
    school: UpgradeSchool.Survival,
    schoolLabelZh: '坚毅 · 不屈金身',
    nameZh: '重岳镇压',
    subtitleZh: '破盾重击与减伤壁垒',
    maxLevel: 3,
    accentHex: '#ffd86b',
    describeEffect: (lv) =>
      `所有攻击无视正面护盾，受到的伤害降低 ${lv * 7}%，且所有攻击造成的伤害提升 +${lv * 12}%。`,
    describeStatPreview: (cur, next) =>
      `无视护盾 · 减伤 +${next * 7}% · 全伤 +${next * 12}%`,
  },
  [UpgradeId.SanctuaryGrace]: {
    id: UpgradeId.SanctuaryGrace,
    school: UpgradeSchool.Survival,
    schoolLabelZh: '坚毅 · 不屈金身',
    nameZh: '圣堂庇护',
    subtitleZh: '坚毅层数转化为生命上限与圣光伤害',
    maxLevel: 3,
    accentHex: '#ffd86b',
    describeEffect: (lv) =>
      `每拥有 1 级【坚毅】流派强化，最大生命上限额外 +${lv * 8}，且全局攻击伤害提升 +${lv * 14}%。`,
    describeStatPreview: (cur, next) =>
      `每级坚毅 +${next * 8} 生命 · 全伤 +${cur * 14}% → +${next * 14}%`,
  },

  // ==================== 5. 连袭 (Onslaught — 9 Upgrades: 攻速与连击效果相关) ====================
  [UpgradeId.GaleEdge]: {
    id: UpgradeId.GaleEdge,
    school: UpgradeSchool.Onslaught,
    schoolLabelZh: '连袭 · 疾风连击',
    nameZh: '疾风连袭',
    subtitleZh: '大幅提升攻速 · 缩短 0.5s 攻击间隔',
    maxLevel: 3,
    accentHex: '#4ade80',
    describeEffect: (lv) =>
      `直接提升攻击速度 +${lv * 32}%，大幅缩短 0.50s 初始普攻间隔，并加快挥刀动作速率。`,
    describeStatPreview: (cur, next) =>
      `攻速加成 +${cur * 32}% → +${next * 32}%（缩短攻击冷却间隔）`,
  },
  [UpgradeId.PhantomEcho]: {
    id: UpgradeId.PhantomEcho,
    school: UpgradeSchool.Onslaught,
    schoolLabelZh: '连袭 · 疾风连击',
    nameZh: '幻影连袭',
    subtitleZh: '刀光残影二次追斩 · 连击加倍',
    maxLevel: 3,
    accentHex: '#4ade80',
    describeEffect: (lv) =>
      `每次近战斩击命中后，召唤一道银月残影追加二次斩击，额外造成 ${18 + lv * 15}% 的连袭伤害并额外叠加 1 次连击数。`,
    describeStatPreview: (cur, next) =>
      `残影追伤 ${cur === 0 ? 0 : 18 + cur * 15}% → ${18 + next * 15}% · 连击数 +1`,
  },
  [UpgradeId.ShatterMight]: {
    id: UpgradeId.ShatterMight,
    school: UpgradeSchool.Onslaught,
    schoolLabelZh: '连袭 · 疾风连击',
    nameZh: '破军连袭',
    subtitleZh: '维持连击段数增伤 · 破盾斩击',
    maxLevel: 3,
    accentHex: '#4ade80',
    describeEffect: (lv) =>
      `所有攻击无视正面护盾；维持普攻段数（一式→二式→三式→终式）时，每阶连段额外增伤 +${lv * 15}%（终式最高 +${lv * 60}%）。`,
    describeStatPreview: (cur, next) =>
      `无视护盾 · 每段连击增伤 +${cur * 15}% → +${next * 15}%`,
  },
  [UpgradeId.StormFlurry]: {
    id: UpgradeId.StormFlurry,
    school: UpgradeSchool.Onslaught,
    schoolLabelZh: '连袭 · 疾风连击',
    nameZh: '狂飙疾斩',
    subtitleZh: '极速挥砍 · 攻速与近战威力双升',
    maxLevel: 3,
    accentHex: '#4ade80',
    describeEffect: (lv) =>
      `攻击速度额外提升 +${lv * 26}%，普攻与空中连斩伤害提升 +${lv * 16}%。`,
    describeStatPreview: (cur, next) =>
      `攻速 +${cur * 26}% → +${next * 26}% · 普攻伤害 +${next * 16}%`,
  },
  [UpgradeId.ShadowTriad]: {
    id: UpgradeId.ShadowTriad,
    school: UpgradeSchool.Onslaught,
    schoolLabelZh: '连袭 · 疾风连击',
    nameZh: '三重残响',
    subtitleZh: '多重幻影追斩 · 连击数狂飙',
    maxLevel: 3,
    accentHex: '#4ade80',
    describeEffect: (lv) =>
      `【幻影连袭】残影追击伤害提升 +${lv * 16}%，且四段终式与滑铲/突刺命中时额外多触发 ${lv} 次残影斩击。`,
    describeStatPreview: (cur, next) =>
      `残影伤害 +${cur * 16}% → +${next * 16}% · 额外残影 +${next} 次`,
  },
  [UpgradeId.ComboMastery]: {
    id: UpgradeId.ComboMastery,
    school: UpgradeSchool.Onslaught,
    schoolLabelZh: '连袭 · 疾风连击',
    nameZh: '连段极意',
    subtitleZh: '每段连击递进增伤与暴击强化',
    maxLevel: 3,
    accentHex: '#4ade80',
    describeEffect: (lv) =>
      `维持四段普攻时每阶连段增伤额外 +${lv * 12}%，且全局暴击率提升 +${lv * 8}%。`,
    describeStatPreview: (cur, next) =>
      `每段连击增伤 +${cur * 12}% → +${next * 12}% · 暴击率 +${next * 8}%`,
  },
  [UpgradeId.WhirlwindStep]: {
    id: UpgradeId.WhirlwindStep,
    school: UpgradeSchool.Onslaught,
    schoolLabelZh: '连袭 · 疾风连击',
    nameZh: '旋风连步',
    subtitleZh: '攻速提升与移速灵巧强化',
    maxLevel: 3,
    accentHex: '#4ade80',
    describeEffect: (lv) =>
      `攻击速度提升 +${lv * 22}%，移动速度提升 +${lv * 6}%，且每次普攻命中额外回复 +${lv * 2} 点月能。`,
    describeStatPreview: (cur, next) =>
      `攻速 +${cur * 22}% → +${next * 22}% · 移速 +${next * 6}%`,
  },
  [UpgradeId.RelentlessBlade]: {
    id: UpgradeId.RelentlessBlade,
    school: UpgradeSchool.Onslaught,
    schoolLabelZh: '连袭 · 疾风连击',
    nameZh: '无尽连刃',
    subtitleZh: '四段终式缩短冷却 · 近战增伤',
    maxLevel: 3,
    accentHex: '#4ade80',
    describeEffect: (lv) =>
      `近战伤害提升 +${lv * 18}%，攻击速度提升 +${lv * 18}%，使四段连袭衔接更加行云流水。`,
    describeStatPreview: (cur, next) =>
      `近战 +${cur * 18}% → +${next * 18}% · 攻速 +${next * 18}%`,
  },
  [UpgradeId.HyperSonicSlash]: {
    id: UpgradeId.HyperSonicSlash,
    school: UpgradeSchool.Onslaught,
    schoolLabelZh: '连袭 · 疾风连击',
    nameZh: '超音速斩',
    subtitleZh: '攻速转化为终式近身疾风裂斩',
    maxLevel: 3,
    accentHex: '#4ade80',
    describeEffect: (lv) =>
      `攻击速度提升 +${lv * 24}%，且普攻四段终式在身前卷起近战疾风裂斩，额外造成 ${18 + lv * 14} 点风刃伤害。`,
    describeStatPreview: (cur, next) =>
      `攻速 +${cur * 24}% → +${next * 24}% · 疾风裂斩 ${18 + next * 14}`,
  },

  // ==================== 6. 魂心 (SoulHeart — 9 Upgrades: 机动性与通用基础数值强化) ====================
  [UpgradeId.SkyFeather]: {
    id: UpgradeId.SkyFeather,
    school: UpgradeSchool.SoulHeart,
    schoolLabelZh: '魂心 · 圣魂机动',
    nameZh: '天羽多段跳',
    subtitleZh: '空中跳跃段数增加 · 灵巧滞空',
    maxLevel: 2,
    accentHex: '#f0abfc',
    describeEffect: (lv) =>
      `空中可额外进行 +${lv} 次多段踏月跳（可与双月之羽叠加至最高五段跳），且空中移动操控与移速提升 +${lv * 8}%。`,
    describeStatPreview: (cur, next) =>
      `额外空中跳跃 +${cur} → +${next} 段 · 移速 +${next * 8}%`,
  },
  [UpgradeId.FrostStep]: {
    id: UpgradeId.FrostStep,
    school: UpgradeSchool.SoulHeart,
    schoolLabelZh: '魂心 · 圣魂机动',
    nameZh: '幻影瞬步数',
    subtitleZh: '瞬步次数上限增加 · 凛冬残影',
    maxLevel: 3,
    accentHex: '#f0abfc',
    describeEffect: (lv) =>
      `瞬步羽翼上限 +${lv} 格（初始 3 格最高升至 8 格），空中瞬步次数 +${lv}，且瞬步在起点留下冰霜残影造成 ${16 + lv * 12} 点伤害并减速敌人。`,
    describeStatPreview: (cur, next) =>
      `瞬步次数上限 +${cur} → +${next} 格 · 空中瞬步 +${next}`,
  },
  [UpgradeId.TitanVessel]: {
    id: UpgradeId.TitanVessel,
    school: UpgradeSchool.SoulHeart,
    schoolLabelZh: '魂心 · 圣魂机动',
    nameZh: '圣魂命源',
    subtitleZh: '血量上限与通用基础攻击强化',
    maxLevel: 3,
    accentHex: '#f0abfc',
    describeEffect: (lv) =>
      `最大生命上限永久 +${lv * 35}，通用基础攻击力提升 +${lv * 14}%，并在选择时立即恢复 35 点生命。`,
    describeStatPreview: (cur, next) =>
      `生命上限 +${cur * 35} → +${next * 35} · 基础伤害 +${next * 14}%`,
  },
  [UpgradeId.WindWalker]: {
    id: UpgradeId.WindWalker,
    school: UpgradeSchool.SoulHeart,
    schoolLabelZh: '魂心 · 圣魂机动',
    nameZh: '御风神行',
    subtitleZh: '奔跑移速与瞬步上限提升',
    maxLevel: 3,
    accentHex: '#f0abfc',
    describeEffect: (lv) =>
      `移动速度提升 +${lv * 10}%，瞬步羽翼上限额外 +1 格，且瞬步冷却恢复速度提升 +${lv * 25}%。`,
    describeStatPreview: (cur, next) =>
      `移速 +${cur * 10}% → +${next * 10}% · 瞬步回气 +${next * 25}%`,
  },
  [UpgradeId.AbyssalHeart]: {
    id: UpgradeId.AbyssalHeart,
    school: UpgradeSchool.SoulHeart,
    schoolLabelZh: '魂心 · 圣魂机动',
    nameZh: '深渊魂核',
    subtitleZh: '全流派通用基础伤害大幅提升',
    maxLevel: 3,
    accentHex: '#f0abfc',
    describeEffect: (lv) =>
      `全流派通用基础攻击力提升 +${lv * 22}%，暴击伤害提升 +${lv * 18}%，并无视敌人正面护盾。`,
    describeStatPreview: (cur, next) =>
      `全流派基础伤害 +${cur * 22}% → +${next * 22}% · 暴伤 +${next * 18}%`,
  },
  [UpgradeId.FeatherStepRecovery]: {
    id: UpgradeId.FeatherStepRecovery,
    school: UpgradeSchool.SoulHeart,
    schoolLabelZh: '魂心 · 圣魂机动',
    nameZh: '灵羽回气',
    subtitleZh: '瞬步羽翼上限与急速充能',
    maxLevel: 3,
    accentHex: '#f0abfc',
    describeEffect: (lv) =>
      `瞬步羽翼上限 +${lv} 格，瞬步羽翼自然恢复速度提升 +${lv * 35}%，空中瞬步次数额外 +${lv}。`,
    describeStatPreview: (cur, next) =>
      `瞬步上限 +${next} 格 · 恢复速度 +${cur * 35}% → +${next * 35}%`,
  },
  [UpgradeId.SkyDragonDive]: {
    id: UpgradeId.SkyDragonDive,
    school: UpgradeSchool.SoulHeart,
    schoolLabelZh: '魂心 · 圣魂机动',
    nameZh: '天龙空舞',
    subtitleZh: '多段跳增加 · 空中与下劈威力强化',
    maxLevel: 2,
    accentHex: '#f0abfc',
    describeEffect: (lv) =>
      `额外获得 +${lv} 次空中踏月多段跳，且所有近战与空中斩击伤害提升 +${lv * 20}%。`,
    describeStatPreview: (cur, next) =>
      `额外空中跳跃 +${cur} → +${next} 段 · 斩击伤害 +${next * 20}%`,
  },
  [UpgradeId.SoulProsperity]: {
    id: UpgradeId.SoulProsperity,
    school: UpgradeSchool.SoulHeart,
    schoolLabelZh: '魂心 · 圣魂机动',
    nameZh: '魂匣丰饶',
    subtitleZh: '最大生命与月能充能双强化',
    maxLevel: 3,
    accentHex: '#f0abfc',
    describeEffect: (lv) =>
      `最大生命上限永久 +${lv * 28}，月能获取效率提升 +${lv * 20}%，全流派伤害提升 +${lv * 10}%。`,
    describeStatPreview: (cur, next) =>
      `生命上限 +${cur * 28} → +${next * 28} · 月能获取 +${next * 20}%`,
  },
  [UpgradeId.OmniPotential]: {
    id: UpgradeId.OmniPotential,
    school: UpgradeSchool.SoulHeart,
    schoolLabelZh: '魂心 · 圣魂机动',
    nameZh: '万象魂心',
    subtitleZh: '全属性基石 · 生命、攻速与全伤共振',
    maxLevel: 3,
    accentHex: '#f0abfc',
    describeEffect: (lv) =>
      `最大生命上限 +${lv * 24}，攻击速度提升 +${lv * 16}%，全流派伤害提升 +${lv * 16}%，瞬步恢复提升 +${lv * 20}%。`,
    describeStatPreview: (cur, next) =>
      `生命 +${next * 24} · 攻速 +${next * 16}% · 全伤 +${next * 16}%`,
  },
};

export const ALL_UPGRADE_IDS: UpgradeId[] = Object.values(UpgradeId);

export interface UpgradeModifiers {
  // 6 Attribute School Counts (`月魄 · 赤刃 · 星术 · 坚毅 · 连袭 · 魂心`)
  lunarCount: number;
  brutalityCount: number;
  tacticsCount: number;
  survivalCount: number;
  onslaughtCount: number;
  soulHeartCount: number;
  totalUpgrades: number;

  // Combat & Attack Speed Cadence
  globalDamageMult: number;
  meleeDamageMult: number;
  lSkillDamageMult: number;
  attackSpeedMult: number; // Reduces 1.2s base attack interval (`1.2 / attackSpeedMult`)
  comboStageDamageBonus: number; // Bonus per retained combo stage (0..3)
  moveSpeedMult: number;
  pierceShields: boolean;
  bonusCritChance: number;
  bonusCritDamage: number;

  // 1. 月魄 (Lunar — Moon Energy & L-key skills)
  energyGainMult: number;
  dimensionCutCost: number;
  moonWaveDamage: number;
  twinWaveDamage: number;
  lunarSlashRadiusMult: number;
  voidEclipseNovaDamage: number;
  lSkillEnergyRefund: number;
  siphonEnergyOnHit: number;

  // 2. 赤刃 (Brutality — Perfect Dodge + Hold J 1.5s Crimson Blade Slash)
  crimsonSlashMult: number;
  crimsonFlashExtraHits: number;
  crimsonFlashHitDamage: number;
  perfectDodgeBonusWindow: number;
  crimsonRendDamage: number;
  scarletWaveDamage: number;
  crimsonVortexDamage: number;
  crimsonVortexHeal: number;

  // 3. 星术 (Tactics — 1s Zanshin Sheathe + 0.3s Glint Window L Empowered Astral Skill)
  zanshinLSkillMult: number;
  zanshinSpeedMult: number;
  zanshinBonusEnergy: number;
  zanshinWindowBonusSec: number;
  astralBladeCount: number;
  astralBladeDamage: number;
  chainBoltDamage: number;
  chainBoltTargets: number;
  meteorCount: number;
  meteorDamage: number;
  astralNovaDamage: number;
  empoweredLRefillsStamina: boolean;

  // 4. 坚毅 (Survival — Damage Reduction, Rally, Healing, Aegis)
  damageTakenMult: number;
  rallyDecayMult: number;
  rallyHealMult: number;
  zanshinHeal: number;
  killHeal: number;
  dodgeNovaDamage: number;
  thornsHeal: number;

  // 5. 连袭 (Onslaught — Attack Speed & Combo Effects)
  phantomEchoRatio: number;
  extraEchoCount: number;
  hypersonicSlashDamage: number;

  // 6. 魂心 (SoulHeart — Mobility & Universal Base Stats)
  bonusMaxHp: number;
  bonusMaxStamina: number;
  staminaRegenMult: number;
  extraAirJumps: number;
  extraAirDashes: number;
  frostStepDamage: number;
  frostStepSlowSec: number;
}

export function createEmptyUpgradeMap(): Record<UpgradeId, number> {
  const rec = {} as Record<UpgradeId, number>;
  for (const id of ALL_UPGRADE_IDS) {
    rec[id] = 0;
  }
  return rec;
}

export function computeUpgradeModifiers(levels: Record<UpgradeId, number>): UpgradeModifiers {
  let lunarCount = 0;
  let brutalityCount = 0;
  let tacticsCount = 0;
  let survivalCount = 0;
  let onslaughtCount = 0;
  let soulHeartCount = 0;

  for (const id of ALL_UPGRADE_IDS) {
    const lv = levels[id] ?? 0;
    if (lv <= 0) continue;
    const school = UPGRADE_SPECS[id].school;
    if (school === UpgradeSchool.Lunar) lunarCount += lv;
    else if (school === UpgradeSchool.Brutality) brutalityCount += lv;
    else if (school === UpgradeSchool.Tactics) tacticsCount += lv;
    else if (school === UpgradeSchool.Survival) survivalCount += lv;
    else if (school === UpgradeSchool.Onslaught) onslaughtCount += lv;
    else if (school === UpgradeSchool.SoulHeart) soulHeartCount += lv;
  }

  const totalUpgrades =
    lunarCount + brutalityCount + tacticsCount + survivalCount + onslaughtCount + soulHeartCount;

  const lv = (id: UpgradeId) => levels[id] ?? 0;

  // 1. Lunar levels
  const lunarSurgeLv = lv(UpgradeId.LunarSurge);
  const moonWaveLv = lv(UpgradeId.MoonWave);
  const voidEclipseLv = lv(UpgradeId.VoidEclipse);
  const siphonLv = lv(UpgradeId.CrescentSiphon);
  const fullMoonLv = lv(UpgradeId.FullMoonDomain);
  const twinWaveLv = lv(UpgradeId.LunarTwinWave);
  const cataclysmLv = lv(UpgradeId.EclipseCataclysm);
  const silverOverLv = lv(UpgradeId.SilverOverflow);
  const afterglowLv = lv(UpgradeId.LunarAfterglow);

  // 2. Brutality levels
  const crimsonDrawLv = lv(UpgradeId.CrimsonDraw);
  const crimsonRendLv = lv(UpgradeId.CrimsonRend);
  const execLv = lv(UpgradeId.ExecutionerEdge);
  const dilateLv = lv(UpgradeId.BloodTimeDilate);
  const scarletWaveLv = lv(UpgradeId.ScarletWave);
  const carnageLv = lv(UpgradeId.CarnageMomentum);
  const heartSeekerLv = lv(UpgradeId.HeartSeeker);
  const vortexLv = lv(UpgradeId.CrimsonVortex);
  const brandLv = lv(UpgradeId.BloodlustBrand);

  // 3. Tactics levels
  const astralLv = lv(UpgradeId.AstralBlades);
  const chainLv = lv(UpgradeId.ChainBolt);
  const starlightLv = lv(UpgradeId.StarlightFocus);
  const meteorLv = lv(UpgradeId.MeteorShower);
  const astralNovaLv = lv(UpgradeId.AstralNova);
  const seekerLv = lv(UpgradeId.GrandSeeker);
  const thunderLv = lv(UpgradeId.ThunderJudgment);
  const prismLv = lv(UpgradeId.TimeStasisPrism);
  const constelLv = lv(UpgradeId.ConstellationResonance);

  // 4. Survival levels
  const aegisLv = lv(UpgradeId.AegisCounter);
  const bloodZanshinLv = lv(UpgradeId.BloodZanshin);
  const bastionLv = lv(UpgradeId.ImmortalBastion);
  const bellLv = lv(UpgradeId.GoldenBellShield);
  const thornsLv = lv(UpgradeId.ThornsAura);
  const undyingLv = lv(UpgradeId.UndyingWill);
  const fountainLv = lv(UpgradeId.VitalityFountain);
  const heavyArmorLv = lv(UpgradeId.HeavyArmorBreak);
  const sanctuaryLv = lv(UpgradeId.SanctuaryGrace);

  // 5. Onslaught levels
  const galeLv = lv(UpgradeId.GaleEdge);
  const echoLv = lv(UpgradeId.PhantomEcho);
  const shatterLv = lv(UpgradeId.ShatterMight);
  const flurryLv = lv(UpgradeId.StormFlurry);
  const triadLv = lv(UpgradeId.ShadowTriad);
  const masteryLv = lv(UpgradeId.ComboMastery);
  const whirlwindLv = lv(UpgradeId.WhirlwindStep);
  const relentlessLv = lv(UpgradeId.RelentlessBlade);
  const hypersonicLv = lv(UpgradeId.HyperSonicSlash);

  // 6. SoulHeart levels
  const featherLv = lv(UpgradeId.SkyFeather);
  const frostLv = lv(UpgradeId.FrostStep);
  const titanLv = lv(UpgradeId.TitanVessel);
  const windWalkerLv = lv(UpgradeId.WindWalker);
  const abyssalHeartLv = lv(UpgradeId.AbyssalHeart);
  const featherRecLv = lv(UpgradeId.FeatherStepRecovery);
  const dragonDiveLv = lv(UpgradeId.SkyDragonDive);
  const prosperityLv = lv(UpgradeId.SoulProsperity);
  const omniLv = lv(UpgradeId.OmniPotential);

  // Universal base damage & school scaling
  const globalDamageMult =
    1 +
    soulHeartCount * 0.08 +
    titanLv * 0.14 +
    abyssalHeartLv * 0.22 +
    prosperityLv * 0.10 +
    omniLv * 0.16 +
    silverOverLv * 0.10 +
    heavyArmorLv * 0.12 +
    sanctuaryLv * 0.14 +
    constelLv * tacticsCount * 0.04 +
    brutalityCount * 0.06 +
    tacticsCount * 0.05;

  const meleeDamageMult =
    1 +
    brutalityCount * 0.08 +
    onslaughtCount * 0.06 +
    shatterLv * 0.15 +
    carnageLv * 0.20 +
    undyingLv * 0.16 +
    flurryLv * 0.16 +
    relentlessLv * 0.18 +
    dragonDiveLv * 0.20;

  // L-key skills belong 100% exclusively to `月魄` (`Lunar`)
  const lSkillDamageMult =
    1 +
    lunarCount * 0.16 +
    voidEclipseLv * 0.30 +
    siphonLv * 0.18 +
    fullMoonLv * 0.28 +
    afterglowLv * 0.16;

  // Attack Speed (`连袭` passive +18%/lv + active Onslaught upgrades + OmniPotential)
  const attackSpeedMult =
    1 +
    onslaughtCount * 0.18 +
    galeLv * 0.32 +
    flurryLv * 0.26 +
    whirlwindLv * 0.22 +
    relentlessLv * 0.18 +
    hypersonicLv * 0.24 +
    omniLv * 0.16;

  const comboStageDamageBonus =
    onslaughtCount * 0.05 + shatterLv * 0.15 + masteryLv * 0.12;

  const moveSpeedMult =
    1 +
    soulHeartCount * 0.04 +
    featherLv * 0.08 +
    windWalkerLv * 0.10 +
    whirlwindLv * 0.06;

  // 1. 月魄 (Lunar)
  const energyGainMult =
    1 +
    lunarCount * 0.12 +
    lunarSurgeLv * 0.35 +
    silverOverLv * 0.22 +
    prosperityLv * 0.20 +
    tacticsCount * 0.06;
  const dimensionCutCost = Math.max(
    15,
    50 - lunarCount * 3 - lunarSurgeLv * 6 - silverOverLv * 3
  );
  const moonWaveDamage =
    moonWaveLv > 0
      ? 16 + moonWaveLv * 15
      : lunarCount >= 2
        ? 14 + lunarCount * 4
        : 0;
  const twinWaveDamage = twinWaveLv > 0 ? 18 + twinWaveLv * 14 : 0;
  const lunarSlashRadiusMult = 1 + twinWaveLv * 0.1;
  const voidEclipseNovaDamage =
    voidEclipseLv > 0 || cataclysmLv > 0
      ? 20 + voidEclipseLv * 16 + cataclysmLv * 18
      : 0;
  const lSkillEnergyRefund = afterglowLv > 0 ? 6 + afterglowLv * 5 : 0;
  const siphonEnergyOnHit =
    (siphonLv > 0 ? 4 + siphonLv * 4 : 0) + fullMoonLv * 2 + whirlwindLv * 2;

  // 2. 赤刃 (Brutality — Perfect Dodge + Hold J 1.5s Crimson Blade Slash)
  const crimsonSlashMult =
    1 +
    brutalityCount * 0.24 +
    crimsonDrawLv * 0.45 +
    dilateLv * 0.30 +
    carnageLv * 0.20 +
    heartSeekerLv * 0.22;
  const crimsonFlashExtraHits =
    crimsonDrawLv + carnageLv + (brutalityCount >= 2 ? 1 : 0);
  const crimsonFlashHitDamage =
    22 + crimsonDrawLv * 12 + brutalityCount * 5 + heartSeekerLv * 8;
  const perfectDodgeBonusWindow =
    brutalityCount * 0.16 + crimsonDrawLv * 0.18 + dilateLv * 0.35;
  const crimsonRendDamage =
    crimsonRendLv > 0 || brandLv > 0
      ? 24 + crimsonRendLv * 20 + brandLv * 24
      : brutalityCount >= 2
        ? 22
        : 0;
  const scarletWaveDamage =
    scarletWaveLv > 0 ? 22 + scarletWaveLv * 16 : brutalityCount >= 2 ? 20 : 0;
  const crimsonVortexDamage = vortexLv > 0 ? 26 + vortexLv * 18 : 0;
  const crimsonVortexHeal = vortexLv > 0 ? 2 + vortexLv * 2 : 0;

  // 3. 星术 (Tactics — 1s Zanshin Sheathe + 0.3s Glint Window L Empowered Astral Skill)
  const zanshinLSkillMult =
    1.65 +
    tacticsCount * 0.24 +
    starlightLv * 0.50 +
    constelLv * 0.35;
  const zanshinSpeedMult = 1 + tacticsCount * 0.12 + (starlightLv > 0 ? 0.35 : 0);
  const zanshinBonusEnergy =
    (starlightLv > 0 ? 8 + starlightLv * 10 : tacticsCount * 4) +
    (brandLv > 0 ? 6 + brandLv * 4 : 0);
  const zanshinWindowBonusSec = prismLv * 0.08;
  const astralBladeCount =
    (astralLv > 0 ? 2 + astralLv * 2 : tacticsCount >= 1 ? 3 : 0) + seekerLv * 2;
  const astralBladeDamage = 18 + astralLv * 10 + seekerLv * 10 + tacticsCount * 3;
  const chainBoltDamage =
    chainLv > 0 || thunderLv > 0
      ? 22 + chainLv * 15 + thunderLv * 16
      : tacticsCount >= 1
        ? 24
        : 0;
  const chainBoltTargets =
    (chainLv > 0 ? 2 + chainLv * 2 : tacticsCount >= 1 ? 3 : 0) + thunderLv;
  const meteorCount =
    meteorLv > 0 ? 4 + meteorLv * 2 : tacticsCount >= 2 ? 3 + tacticsCount : 0;
  const meteorDamage = 24 + meteorLv * 14 + tacticsCount * 4;
  const astralNovaDamage =
    astralNovaLv > 0 ? 32 + astralNovaLv * 22 : tacticsCount >= 1 ? 26 + tacticsCount * 6 : 0;
  const empoweredLRefillsStamina = prismLv > 0 || tacticsCount >= 2;

  // 4. 坚毅 (Survival)
  const damageTakenMult = Math.max(
    0.28,
    1 - survivalCount * 0.05 - aegisLv * 0.12 - bellLv * 0.08 - heavyArmorLv * 0.07
  );
  const rallyDecayMult = Math.max(0.15, 1 - bastionLv * 0.28 - survivalCount * 0.05);
  const rallyHealMult =
    1 + survivalCount * 0.12 + bastionLv * 0.45 + undyingLv * 0.25;
  const zanshinHeal =
    (bloodZanshinLv > 0 ? 3 + bloodZanshinLv * 4 : survivalCount >= 2 ? 4 : 0) +
    fountainLv * 3;
  const killHeal =
    (bloodZanshinLv > 0 ? 4 + bloodZanshinLv * 4 : 0) +
    undyingLv * 4 +
    survivalCount * 2;
  const dodgeNovaDamage =
    aegisLv > 0 || thornsLv > 0
      ? 26 + aegisLv * 20 + thornsLv * 18
      : 0;
  const thornsHeal = thornsLv > 0 ? 4 + thornsLv * 3 : 0;

  // 5. 连袭 (Onslaught)
  const phantomEchoRatio =
    echoLv > 0 || triadLv > 0
      ? 0.18 + echoLv * 0.15 + triadLv * 0.16
      : onslaughtCount >= 2
        ? 0.22
        : 0;
  const extraEchoCount = triadLv;
  const hypersonicSlashDamage = hypersonicLv > 0 ? 18 + hypersonicLv * 14 : 0;

  // 6. 魂心 (SoulHeart — Mobility & Universal Base Stats)
  const bonusMaxHp =
    soulHeartCount * 16 +
    titanLv * 35 +
    prosperityLv * 28 +
    omniLv * 24 +
    bellLv * 20 +
    fountainLv * 25 +
    sanctuaryLv * survivalCount * 8 +
    survivalCount * 10;
  const bonusMaxStamina =
    frostLv +
    featherRecLv +
    (windWalkerLv > 0 ? 1 : 0) +
    (soulHeartCount >= 3 && frostLv === 0 ? 1 : 0);
  const staminaRegenMult =
    1 +
    soulHeartCount * 0.08 +
    frostLv * 0.22 +
    windWalkerLv * 0.25 +
    featherRecLv * 0.35 +
    omniLv * 0.20;
  const extraAirJumps = featherLv + dragonDiveLv;
  const extraAirDashes = frostLv + featherRecLv;
  const frostStepDamage = frostLv > 0 ? 16 + frostLv * 12 : 0;
  const frostStepSlowSec = frostLv > 0 ? 1.6 + frostLv * 0.5 : 0;

  return {
    lunarCount,
    brutalityCount,
    tacticsCount,
    survivalCount,
    onslaughtCount,
    soulHeartCount,
    totalUpgrades,
    globalDamageMult,
    meleeDamageMult,
    lSkillDamageMult,
    attackSpeedMult,
    comboStageDamageBonus,
    moveSpeedMult,
    pierceShields:
      shatterLv > 0 ||
      voidEclipseLv > 0 ||
      heavyArmorLv > 0 ||
      abyssalHeartLv > 0,
    bonusCritChance:
      execLv * 0.14 +
      heartSeekerLv * 0.12 +
      masteryLv * 0.08 +
      brutalityCount * 0.04,
    bonusCritDamage:
      execLv * 0.32 +
      heartSeekerLv * 0.26 +
      abyssalHeartLv * 0.18 +
      brutalityCount * 0.08,
    energyGainMult,
    dimensionCutCost,
    moonWaveDamage,
    twinWaveDamage,
    lunarSlashRadiusMult,
    voidEclipseNovaDamage,
    lSkillEnergyRefund,
    siphonEnergyOnHit,
    crimsonSlashMult,
    crimsonFlashExtraHits,
    crimsonFlashHitDamage,
    perfectDodgeBonusWindow,
    crimsonRendDamage,
    scarletWaveDamage,
    crimsonVortexDamage,
    crimsonVortexHeal,
    zanshinLSkillMult,
    zanshinSpeedMult,
    zanshinBonusEnergy,
    zanshinWindowBonusSec,
    astralBladeCount,
    astralBladeDamage,
    chainBoltDamage,
    chainBoltTargets,
    meteorCount,
    meteorDamage,
    astralNovaDamage,
    empoweredLRefillsStamina,
    damageTakenMult,
    rallyDecayMult,
    rallyHealMult,
    zanshinHeal,
    killHeal,
    dodgeNovaDamage,
    thornsHeal,
    phantomEchoRatio,
    extraEchoCount,
    hypersonicSlashDamage,
    bonusMaxHp,
    bonusMaxStamina,
    staminaRegenMult,
    extraAirJumps,
    extraAirDashes,
    frostStepDamage,
    frostStepSlowSec,
  };
}

/**
 * Deterministic Mulberry32 PRNG for reproducible per-run 3-choice upgrade drafts
 */
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function toUpgradeChoiceView(
  id: UpgradeId,
  levels: Record<UpgradeId, number>
): UpgradeChoiceView {
  const spec = UPGRADE_SPECS[id];
  const currentLevel = levels[id] ?? 0;
  const nextLevel = Math.min(spec.maxLevel, currentLevel + 1);
  const descZh = spec.describeEffect(nextLevel);
  const highlightStatZh = spec.describeStatPreview(currentLevel, nextLevel);
  return {
    id: spec.id,
    school: spec.school,
    schoolLabelZh: spec.schoolLabelZh,
    nameZh: spec.nameZh,
    subtitleZh: spec.subtitleZh,
    currentLevel,
    nextLevel,
    maxLevel: spec.maxLevel,
    descZh,
    highlightStatZh,
    effectDescZh: descZh,
    statPreviewZh: highlightStatZh,
    accentHex: spec.accentHex,
  };
}

/**
 * Rolls 3 distinct upgrade choices from the 54-upgrade pool across the 6 attribute schools.
 */
export function rollUpgradeDraft(
  levels: Record<UpgradeId, number>,
  runSeed: number,
  draftIndex: number,
  sourceTitleZh: string,
  sourceSubtitleZh: string
): UpgradeDraftSnapshot {
  const rng = createSeededRng(runSeed + draftIndex * 7919 + 104729);
  const eligible = ALL_UPGRADE_IDS.filter((id) => (levels[id] ?? 0) < UPGRADE_SPECS[id].maxLevel);
  const pool = eligible.length >= 3 ? [...eligible] : [...ALL_UPGRADE_IDS];

  // Fisher-Yates shuffle with seeded RNG
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }

  // Prefer picking 3 distinct schools so the player sees diverse attribute styles each draft
  const selected: UpgradeId[] = [];
  const usedSchools = new Set<UpgradeSchool>();

  for (const id of pool) {
    const school = UPGRADE_SPECS[id].school;
    if (!usedSchools.has(school)) {
      selected.push(id);
      usedSchools.add(school);
      if (selected.length === 3) break;
    }
  }

  for (const id of pool) {
    if (selected.length >= 3) break;
    if (!selected.includes(id)) {
      selected.push(id);
    }
  }

  const views = selected
    .slice(0, 3)
    .map((id) => toUpgradeChoiceView(id, levels)) as [
    UpgradeChoiceView,
    UpgradeChoiceView,
    UpgradeChoiceView,
  ];

  return {
    sourceTitleZh,
    sourceSubtitleZh,
    choices: views,
  };
}

export function getSoulForgeCost(forgesPurchased: number): number {
  return 45 + forgesPurchased * 30;
}

export function isBossEnemyKind(kind: EnemyKind): boolean {
  return (
    kind === EnemyKind.Warden ||
    kind === EnemyKind.Archon ||
    kind === EnemyKind.Sovereign
  );
}

export function getEnemySoulReward(kind: EnemyKind, isElite: boolean): number {
  const base =
    kind === EnemyKind.Sovereign
      ? 160
      : kind === EnemyKind.Warden || kind === EnemyKind.Archon
        ? 95
        : kind === EnemyKind.Halberdier || kind === EnemyKind.Reaper
          ? 18
          : 13;
  return isElite ? Math.round(base * 1.8) : base;
}
