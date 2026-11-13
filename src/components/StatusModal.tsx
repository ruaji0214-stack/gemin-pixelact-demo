import { GamePhase, HudSnapshot, RelicId, RunSummary, UpgradeSchool } from '../game/types';
import { RELIC_METADATA } from '../game/world';
import { AriaPortrait } from './AriaPortrait';
import { Minimap } from './Minimap';

interface StatusModalProps {
  phase: GamePhase.Paused | GamePhase.GameOver;
  hud: HudSnapshot;
  summary: RunSummary | null;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
}

const ALL_RELICS: RelicId[] = [
  RelicId.DoubleJump,
  RelicId.AbyssalBreaker,
  RelicId.ZanshinTassel,
];

const SCHOOL_TEXT_COLOR: Record<UpgradeSchool, string> = {
  [UpgradeSchool.Lunar]: 'text-[#a5b4fc]',
  [UpgradeSchool.Brutality]: 'text-[#ff85a2]',
  [UpgradeSchool.Tactics]: 'text-[#82e8ff]',
  [UpgradeSchool.Survival]: 'text-[#ffe082]',
  [UpgradeSchool.Onslaught]: 'text-[#4ade80]',
  [UpgradeSchool.SoulHeart]: 'text-[#f0abfc]',
};

export function StatusModal({
  phase,
  hud,
  summary,
  onResume,
  onRestart,
  onReturnTitle,
}: StatusModalProps) {
  if (phase === GamePhase.Paused) {
    const ownedSet = new Set(hud.relics);

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-modal-title"
        className="fixed inset-0 z-30 flex items-center justify-center bg-[#050711]/86 p-4 overflow-y-auto"
      >
        <div className="w-full max-w-4xl bg-[#0d1224] border border-[#7c93cc]/55 shadow-[0_20px_50px_rgba(2,4,10,0.95)] p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#232f54] pb-3.5 mb-4">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2
                id="pause-modal-title"
                className="text-lg sm:text-xl font-bold text-[#f2f6ff] tracking-wide"
              >
                古堡星盘与六系赐福构筑
              </h2>
              <span className="text-xs text-[#8ef0ff] font-mono tabular-nums">
                {hud.zoneNameZh} · {hud.roomNameZh} · 首领 {hud.bossesDefeated}/3 · 探索 {hud.explorationPct}% · 种子 #{hud.runSeed}
              </span>
            </div>
            <span className="text-xs font-mono text-[#94a7d6] tabular-nums">
              攻速 {(hud.attackIntervalSec || 0.5).toFixed(2)}s/刀 · 魄晶 {hud.souls} · TAB / ESC
            </span>
          </div>

          {/* Interactive 6x4 16-Room Castle Star-Map */}
          <div className="mb-4">
            <Minimap cells={hud.minimapCells} variant="detailed" />
          </div>

          {/* Relics & Roguelike Build Overview Two-Column Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            {/* Collected Relics */}
            <div className="bg-[#090d1b] border border-[#2d3d6b]/70 p-3.5 space-y-2">
              <div className="text-xs font-bold tracking-wider text-[#d9e5ff] border-b border-[#1e2a4a] pb-1.5">
                圣堂遗物 ({hud.relics.length} / {ALL_RELICS.length})
              </div>
              {ALL_RELICS.map((relicId) => {
                const meta = RELIC_METADATA[relicId];
                const unlocked = ownedSet.has(relicId);
                return (
                  <div key={relicId} className="text-xs leading-snug">
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={
                          unlocked ? 'font-bold text-[#ffe694]' : 'font-semibold text-[#5f729e]'
                        }
                      >
                        {unlocked ? `◆ ${meta.nameZh}` : `◇ ${meta.nameZh}（未寻获）`}
                      </span>
                      <span className="font-mono text-[10px] text-[#85b8ff]">
                        {unlocked ? meta.keyHint : '古堡深处'}
                      </span>
                    </div>
                    <p className={unlocked ? 'text-[#b5c6eb] mt-0.5' : 'text-[#4e5f87] mt-0.5'}>
                      {meta.descZh}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Active Roguelike Build + Action Moveset */}
            <div className="bg-[#090d1b] border border-[#2d3d6b]/70 p-3.5 space-y-2.5 text-xs text-[#bdcbe8]">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#1e2a4a] pb-1.5">
                <span className="font-bold tracking-wider text-[#d9e5ff]">
                  六系流派构筑 ({hud.totalUpgrades})
                </span>
                <span className="font-mono text-[11px] tabular-nums">
                  <span className="text-[#a5b4fc]">月{hud.lunarCount}</span> ·{' '}
                  <span className="text-[#ff85a2]">赤{hud.brutalityCount}</span> ·{' '}
                  <span className="text-[#82e8ff]">星{hud.tacticsCount}</span> ·{' '}
                  <span className="text-[#ffe082]">坚{hud.survivalCount}</span> ·{' '}
                  <span className="text-[#4ade80]">连{hud.onslaughtCount}</span> ·{' '}
                  <span className="text-[#f0abfc]">魂{hud.soulHeartCount}</span>
                </span>
              </div>

              {hud.activeUpgradeSummary.length > 0 ? (
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 font-mono text-[11px] tabular-nums">
                  {hud.activeUpgradeSummary.map((u, idx) => (
                    <span key={u.id} className={SCHOOL_TEXT_COLOR[u.school]}>
                      {u.nameZh} Lv.{u.level}
                      {idx < hud.activeUpgradeSummary.length - 1 ? ' ·' : ''}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[#6f82ad]">
                  尚未铭刻赐福卷轴。前往卷轴台、圣堂遗物或银月祭坛开启六系能力三选一。
                </p>
              )}

              <div className="border-t border-[#1e2a4a] pt-2 space-y-1 text-[11px]">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-[#88e5ff] whitespace-nowrap shrink-0">J / 收刀按住J</span>
                  <span className="text-right whitespace-nowrap">0.5s连斩 · 纳刀微光按住J发星术绝斩(连发减半收刀)</span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-[#88e5ff] whitespace-nowrap shrink-0">闪避按住J / 专属L</span>
                  <span className="text-right whitespace-nowrap">K穿特效像素触发血闪(5s/次) · L专属月魄(0.2x凝时)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onResume}
              className="flex-1 py-2.5 px-4 bg-[#e6eeff] hover:bg-white text-[#090d1c] font-bold text-sm cursor-pointer whitespace-nowrap transition-colors"
            >
              继续探索
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="py-2.5 px-4 bg-[#16203d] hover:bg-[#212f59] text-[#dce6ff] border border-[#6e84bd]/50 font-semibold text-sm cursor-pointer whitespace-nowrap transition-colors"
            >
              重新开始
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="py-2.5 px-4 bg-[#111830] hover:bg-[#1a2547] text-[#a9b9e0] border border-[#4a5b87]/45 font-semibold text-sm cursor-pointer whitespace-nowrap transition-colors"
            >
              返回标题
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isVictory = summary?.victory ?? false;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gameover-modal-title"
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#050711]/86 p-4"
    >
      <div className="w-full max-w-md bg-[#0d1224] border border-[#8299d4]/60 shadow-[0_24px_60px_rgba(2,4,10,0.95)] p-6 sm:p-7">
        <div className="flex items-center gap-4 border-b border-[#232f54] pb-4 mb-5">
          <AriaPortrait size="md" lowHp={!isVictory} />
          <div>
            <p className="text-xs font-semibold tracking-wider text-[#95aad8]">
              {isVictory ? 'THRONE PURIFIED · 绯月王座肃清' : 'FALLEN IN SHADOW · 残月陨落'}
            </p>
            <h2
              id="gameover-modal-title"
              className="text-2xl font-extrabold text-[#f4f7ff] tracking-wide mt-0.5"
            >
              {isVictory ? '银月凯旋' : '轮回重铸'}
            </h2>
          </div>
        </div>

        {summary && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="p-3 bg-[#121933] border border-[#314170]/60">
              <div className="text-[11px] text-[#94a8d6]">最终得分 · 最高纪录</div>
              <div className="font-mono text-lg font-bold text-white tabular-nums mt-0.5">
                {summary.score}{' '}
                <span className="text-xs font-normal text-[#8fa4d4]">/ {summary.bestScore}</span>
              </div>
            </div>

            <div className="p-3 bg-[#121933] border border-[#314170]/60">
              <div className="text-[11px] text-[#94a8d6]">首领讨伐 · 赐福强化</div>
              <div className="font-mono text-lg font-bold text-[#8eeaff] tabular-nums mt-0.5">
                {summary.bossesDefeated}/{summary.totalBosses} 首领 · {summary.upgradesCollected} 阶
              </div>
            </div>

            <div className="p-3 bg-[#121933] border border-[#314170]/60">
              <div className="text-[11px] text-[#94a8d6]">古堡探索率 · 圣堂遗物</div>
              <div className="font-mono text-lg font-bold text-[#ffe694] tabular-nums mt-0.5">
                {summary.explorationPct}% · {summary.relicsCollected}/{summary.totalRelics}
              </div>
            </div>

            <div className="p-3 bg-[#121933] border border-[#314170]/60">
              <div className="text-[11px] text-[#94a8d6]">
                {isVictory ? '通关用时 · 最高连击' : '陨落区域 · 最高连击'}
              </div>
              <div className="font-mono text-base font-bold text-white tabular-nums mt-0.5">
                {isVictory
                  ? `${summary.clearTimeSec}s · ${summary.maxCombo}连`
                  : `${summary.roomDefeatedIn} · ${summary.maxCombo}连`}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            data-start="true"
            onClick={onRestart}
            className="flex-1 py-3 px-5 bg-[#e6eeff] hover:bg-white text-[#090d1c] font-bold text-sm cursor-pointer whitespace-nowrap transition-colors"
          >
            {isVictory ? '开启新一轮古堡试炼' : '再度踏入轮回'}
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="py-3 px-5 bg-[#141d38] hover:bg-[#1e2b52] text-[#cbd8f7] border border-[#5d73aa]/50 font-semibold text-sm cursor-pointer whitespace-nowrap transition-colors"
          >
            返回标题
          </button>
        </div>
      </div>
    </div>
  );
}
