import React from 'react';
import { HudSnapshot, StyleRank } from '../game/types';
import { RELIC_METADATA } from '../game/world';
import { AriaPortrait } from './AriaPortrait';
import { Minimap } from './Minimap';

interface GameHudProps {
  hud: HudSnapshot;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onRestart: () => void;
  onTouchInput: (key: 'a' | 'd' | 'w' | 's' | 'j' | 'k' | 'l' | 'e', down: boolean) => void;
}

const RANK_COLORS: Record<StyleRank, string> = {
  [StyleRank.D]: 'text-[#9aa8cc]',
  [StyleRank.C]: 'text-[#7fd4ff]',
  [StyleRank.B]: 'text-[#6ef2c5]',
  [StyleRank.A]: 'text-[#ffe066]',
  [StyleRank.S]: 'text-[#ff9e5e]',
  [StyleRank.SS]: 'text-[#ff6b9d]',
  [StyleRank.SSS]: 'text-[#e599ff]',
};

export const GameHud = React.memo(function GameHud({
  hud,
  muted,
  onToggleMute,
  onPause,
  onRestart,
  onTouchInput,
}: GameHudProps) {
  const hpPct = Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100));
  const rallyPct = Math.max(hpPct, Math.min(100, (hud.rallyHp / hud.maxHp) * 100));
  const energyPct = Math.max(0, Math.min(100, hud.bladeEnergy));
  const ultCost = hud.ultimateEnergyCost || 50;
  const ultimateReady = hud.bladeEnergy >= ultCost;
  const criticalHp = hud.hp > 0 && hud.hp <= Math.max(30, Math.round(hud.maxHp * 0.28));

  const COMBO_STAGE_LABELS = ['一式待发', '二式连段', '三式连段', '终式断空'] as const;
  const comboStageText = COMBO_STAGE_LABELS[hud.savedComboStage ?? 0] ?? '一式待发';
  const staminaPipCount = Math.max(3, Math.min(6, hud.maxStamina || 3));

  const handleUtilClick = (fn: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    fn();
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none">
      {/* Subtle Low-HP Peripheral Crimson Vignette (Gaze Routing) */}
      {criticalHp && (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none shadow-[inset_0_0_95px_rgba(235,45,88,0.42)]"
        />
      )}

      {/* Perimeter Cluster 1 (Top-Left): Portrait + HP Rally Bar + Dynamic Stamina Sockets + Moon Energy + 6 Attribute Schools + Attack Cadence */}
      <div className="absolute top-4 left-4 sm:top-5 sm:left-6 flex items-start gap-3">
        <AriaPortrait size="md" lowHp={criticalHp} />

        <div className="flex flex-col gap-1.5 min-w-56 sm:min-w-68">
          {/* HP Readout + Souls */}
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[11px] font-bold tracking-widest text-[#9cb0de] hud-stroke-sm">
              HP · 魄晶 {hud.souls}
            </span>
            <span className="font-mono text-sm font-bold text-[#f2f6ff] tabular-nums hud-stroke-sm">
              {Math.round(hud.hp)} / {Math.round(hud.maxHp)}
            </span>
          </div>

          <div className="relative h-3 w-full bg-[#0a0e1d]/92 border border-[#6e84bd]/55 shadow-[0_2px_8px_rgba(0,0,0,0.8)] overflow-hidden">
            {/* Delayed Damage Ghost / Rally Bar */}
            <div
              className="absolute inset-y-0 left-0 bg-[#f7d6e0] transition-none"
              style={{ width: `${rallyPct}%` }}
            />
            {/* Active Vitality Fill */}
            <div
              className={`absolute inset-y-0 left-0 ${
                criticalHp ? 'bg-[#f2446c]' : 'bg-[#d8e6ff]'
              }`}
              style={{ width: `${hpPct}%` }}
            />
          </div>

          {/* Dynamic Stamina Feather Pips (3..6 via 魂心) + Moon Energy */}
          <div className="flex items-center justify-between gap-3 pt-0.5">
            <div
              className="flex items-center gap-1"
              aria-label={`瞬步闪避充能 ${Math.floor(hud.stamina)} / ${hud.maxStamina}`}
            >
              <span className="text-[10px] font-bold tracking-wider text-[#9cb0de] hud-stroke-sm mr-0.5">
                瞬步 [K]
              </span>
              {Array.from({ length: staminaPipCount }, (_, idx) => {
                const fillAmt = Math.max(0, Math.min(1, hud.stamina - idx));
                const state: 'full' | 'partial' | 'empty' =
                  fillAmt >= 0.99 ? 'full' : fillAmt > 0.15 ? 'partial' : 'empty';
                return (
                  <svg
                    key={idx}
                    viewBox="0 0 24 24"
                    className="w-3.5 h-3.5"
                    aria-hidden="true"
                  >
                    <polygon
                      points="12,2 21,12 12,22 3,12"
                      fill="#090d1b"
                      stroke={state === 'full' ? '#95ecff' : '#4a5982'}
                      strokeWidth="2"
                    />
                    {state === 'full' && (
                      <>
                        <polygon points="12,5 18,12 12,19 6,12" fill="#7ce8ff" />
                        <polygon points="12,5 15,10 12,12 9,10" fill="#ffffff" />
                      </>
                    )}
                    {state === 'partial' && (
                      <polygon points="12,11 17,13 12,19 7,13" fill="#4884b8" />
                    )}
                  </svg>
                );
              })}
            </div>

            <span className="font-mono text-[11px] font-bold tabular-nums hud-stroke-sm text-[#a6c8ff]">
              月能 {Math.round(hud.bladeEnergy)}%
            </span>
          </div>

          {/* Moon Blade Gauge */}
          <div className="relative h-2 w-full bg-[#090d1b]/92 border border-[#566b9e]/50 overflow-hidden">
            <div
              className={`h-full ${ultimateReady ? 'bg-[#a38cff]' : 'bg-[#6e7cd9]'}`}
              style={{ width: `${energyPct}%` }}
            />
            <div
              className="absolute inset-y-0 w-0.5 bg-[#ffffff]/70"
              style={{ left: `${ultCost}%` }}
            />
          </div>

          {/* Attack Speed Cadence (`初始0.5s攻击一次`) & Retained Combo Stage (`维持攻击段数`) */}
          <div className="flex items-center justify-between gap-2 font-mono text-[11px] font-bold tabular-nums hud-stroke-sm">
            <span className="text-[#86efac]">
              攻速 {(hud.attackIntervalSec || 0.5).toFixed(2)}s/刀
            </span>
            <span
              className={
                (hud.savedComboStage ?? 0) > 0 ? 'text-[#fde047]' : 'text-[#9cb0de]'
              }
            >
              连段 · {comboStageText}
            </span>
          </div>

          {/* Attack Cooldown Micro-Bar */}
          <div className="relative h-1.5 w-full bg-[#090d1b]/88 border border-[#3d5285]/45 overflow-hidden">
            <div
              className="h-full bg-[#4ade80] transition-none"
              style={{ width: `${Math.round((1 - (hud.attackCooldownRatio ?? 0)) * 100)}%` }}
            />
          </div>

          {/* 6 Attribute Schools (`月魄 · 赤刃 · 星术 · 坚毅 · 连袭 · 魂心`) */}
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 pt-0.5 font-mono text-[11px] font-bold tabular-nums hud-stroke-sm">
            <span className="text-[#a5b4fc]">月魄 {hud.lunarCount}</span>
            <span aria-hidden="true" className="text-[#546896]">·</span>
            <span className="text-[#ff85a2]">赤刃 {hud.brutalityCount}</span>
            <span aria-hidden="true" className="text-[#546896]">·</span>
            <span className="text-[#82e8ff]">星术 {hud.tacticsCount}</span>
            <span aria-hidden="true" className="text-[#546896]">·</span>
            <span className="text-[#ffe082]">坚毅 {hud.survivalCount}</span>
            <span aria-hidden="true" className="text-[#546896]">·</span>
            <span className="text-[#4ade80]">连袭 {hud.onslaughtCount}</span>
            <span aria-hidden="true" className="text-[#546896]">·</span>
            <span className="text-[#f0abfc]">魂心 {hud.soulHeartCount}</span>
          </div>

          {hud.zanshinReady && (
            <div className="text-[11px] font-bold text-[#7fe8ff] hud-stroke-sm tracking-wide">
              [按住 J] 残心微光 · 释放星芒绝斩 (下次收刀 {(hud.nextSheatheSec ?? 0.5).toFixed(2)}s)
            </div>
          )}

          {!hud.zanshinReady && (hud.astraChainCount ?? 0) > 0 && (
            <div className="text-[11px] font-bold text-[#9beeff] hud-stroke-sm tracking-wide">
              星术连发 ×{hud.astraChainCount} · 收刀缩减 {(hud.nextSheatheSec ?? 0.5).toFixed(2)}s
            </div>
          )}

          {ultimateReady && (
            <div className="text-[11px] font-bold text-[#c2b0ff] hud-stroke-sm tracking-wide">
              [L] 月魄秘技 · 虚空次元斩就绪
            </div>
          )}

          {/* Clean Unboxed Relic Readout (Zero-Pill Discipline) */}
          {hud.relics.length > 0 && (
            <div className="text-[11px] font-semibold text-[#ffe694] hud-stroke-sm tracking-wide">
              遗物：{hud.relics.map((r) => RELIC_METADATA[r].nameZh).join(' · ')}
            </div>
          )}
        </div>
      </div>

      {/* Top-Center Transient Discovery / Relic / Area Toast */}
      {hud.toastBanner && (
        <div
          role="status"
          aria-live="polite"
          className="absolute top-14 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-[#090d1c]/92 border-y border-[#82a0e3]/55 text-xs sm:text-sm font-bold tracking-wider text-[#eef4ff] hud-stroke-sm whitespace-nowrap"
        >
          {hud.toastBanner}
        </div>
      )}

      {/* Perimeter Cluster 2 (Top-Right): Room · Bosses · Exploration · Score + Utility Controls + Minimap + Combo */}
      <div className="absolute top-4 right-4 sm:top-5 sm:right-6 flex flex-col items-end gap-2">
        <div className="flex items-center gap-3.5">
          {/* Clean Unboxed Room, Lockdown Status, Bosses, Exploration & Score Readout */}
          <div className="flex items-baseline gap-2 font-mono tabular-nums hud-stroke-sm">
            <span className="font-sans text-xs sm:text-sm font-bold text-[#eef4ff]">
              {hud.roomNameZh}
            </span>
            {hud.roomLocked && (
              <>
                <span aria-hidden="true" className="text-[#5e719e]">·</span>
                <span className="font-sans text-xs font-bold text-[#ff6b93]">
                  封锁中 · 剩余 {hud.remainingEnemies ?? 0} 敌
                </span>
              </>
            )}
            <span aria-hidden="true" className="text-[#5e719e]">·</span>
            <span className="text-xs text-[#9cb0de]">
              首领 <strong className="text-sm text-[#ffa3b8]">{hud.bossesDefeated}/3</strong>
            </span>
            <span aria-hidden="true" className="text-[#5e719e]">·</span>
            <span className="text-xs text-[#9cb0de]">
              探索 <strong className="text-sm text-[#8ef0ff]">{hud.explorationPct}%</strong>
            </span>
            <span aria-hidden="true" className="text-[#5e719e]">·</span>
            <span className="text-xs text-[#9cb0de]">
              SCORE <strong className="text-sm text-white">{hud.score}</strong>
            </span>
          </div>

          {/* Compact Square SVG Utility Buttons (Mute [M], Restart [R], Map/Pause [Tab/P]) */}
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              tabIndex={-1}
              aria-label={muted ? '开启音效 (M)' : '静音 (M)'}
              onClick={handleUtilClick(onToggleMute)}
              className="w-8 h-8 flex items-center justify-center bg-[#0d1326]/92 hover:bg-[#1a2547] border border-[#6e84bd]/50 text-[#dce6ff] cursor-pointer transition-colors"
            >
              {muted ? (
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              )}
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="重新开始 (R)"
              onClick={handleUtilClick(onRestart)}
              className="w-8 h-8 flex items-center justify-center bg-[#0d1326]/92 hover:bg-[#1a2547] border border-[#6e84bd]/50 text-[#dce6ff] cursor-pointer transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="古堡地图与暂停 (Tab / Esc)"
              onClick={handleUtilClick(onPause)}
              className="w-8 h-8 flex items-center justify-center bg-[#0d1326]/92 hover:bg-[#1a2547] border border-[#6e84bd]/50 text-[#dce6ff] cursor-pointer transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
            </button>
          </div>
        </div>

        {/* Live Interconnected 6x4 Castle Minimap */}
        <Minimap cells={hud.minimapCells} variant="compact" />

        {/* Stylish Combo & Rank Readout (Only visible when active in combat) */}
        {(hud.comboCount > 0 || hud.stylePoints > 15) && (
          <div className="flex flex-col items-end mt-0.5">
            <div className="flex items-baseline gap-2.5">
              {hud.comboCount > 0 && (
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-3xl font-extrabold text-white tabular-nums hud-stroke">
                    {hud.comboCount}
                  </span>
                  <span className="text-xs font-bold tracking-widest text-[#b6c8f2] hud-stroke-sm">
                    连击
                  </span>
                </div>
              )}
              <span
                className={`font-display text-4xl font-black italic tracking-tight hud-stroke ${
                  RANK_COLORS[hud.styleRank]
                }`}
              >
                {hud.styleRank}
              </span>
            </div>

            {hud.comboCount > 0 && (
              <div className="w-32 h-1 bg-[#0b1022] border border-[#5a6fa3]/40 mt-1 overflow-hidden">
                <div
                  className="h-full bg-[#92e6ff]"
                  style={{ width: `${Math.round(hud.comboTimerRatio * 100)}%` }}
                />
              </div>
            )}

            {hud.lastMoveName && (
              <span className="mt-1 text-xs font-semibold text-[#d4e4ff] hud-stroke-sm">
                {hud.lastMoveName}
              </span>
            )}
          </div>
        )}

        {hud.perfectDodgeBannerTimer > 0 && (
          <div className="text-xs font-bold text-[#85f2ff] hud-stroke-sm tracking-wider">
            月影刹那 · 按 [J] 发动一闪反击
          </div>
        )}
      </div>

      {/* Contextual Lunar Shrine / Soul Forge Interaction Prompt */}
      {hud.interactPrompt && !hud.bossName && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs sm:text-sm font-bold tracking-wider text-[#9cf0ff] hud-stroke whitespace-nowrap">
          {hud.interactPrompt}
        </div>
      )}

      {/* Bottom-Center Boss Vitality Bar (Active for Warden, Archon, and Sovereign) */}
      {hud.bossName && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-[min(480px,88vw)] flex flex-col gap-1">
          <div className="flex items-baseline justify-between px-0.5">
            <span className="text-xs font-bold tracking-wider text-[#ffd4df] hud-stroke-sm">
              {hud.bossName}
            </span>
            <span className="font-mono text-xs font-bold text-[#ffd4df] tabular-nums hud-stroke-sm">
              {Math.round(hud.bossHp)} / {Math.round(hud.bossMaxHp)}
            </span>
          </div>
          <div className="h-2.5 w-full bg-[#0c0a16]/92 border border-[#c95578]/65 overflow-hidden">
            <div
              className="h-full bg-[#ef4774]"
              style={{
                width: `${Math.max(0, Math.min(100, (hud.bossHp / hud.bossMaxHp) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Mobile / Touch Virtual Controls (Hidden on desktop viewports) */}
      <div className="md:hidden fixed bottom-4 inset-x-4 flex items-end justify-between pointer-events-auto">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="向左移动"
            onPointerDown={() => onTouchInput('a', true)}
            onPointerUp={() => onTouchInput('a', false)}
            onPointerCancel={() => onTouchInput('a', false)}
            className="w-11 h-11 bg-[#0d1326]/90 border border-[#7c93cc]/50 text-white font-bold text-base active:bg-[#23325e]"
          >
            ←
          </button>
          <button
            type="button"
            aria-label="下蹲或下跳"
            onPointerDown={() => onTouchInput('s', true)}
            onPointerUp={() => onTouchInput('s', false)}
            onPointerCancel={() => onTouchInput('s', false)}
            className="w-11 h-11 bg-[#0d1326]/90 border border-[#7c93cc]/50 text-white font-bold text-base active:bg-[#23325e]"
          >
            ↓
          </button>
          <button
            type="button"
            aria-label="跳跃"
            onPointerDown={() => onTouchInput('w', true)}
            onPointerUp={() => onTouchInput('w', false)}
            onPointerCancel={() => onTouchInput('w', false)}
            className="w-11 h-11 bg-[#0d1326]/90 border border-[#7c93cc]/50 text-white font-bold text-base active:bg-[#23325e]"
          >
            ↑
          </button>
          <button
            type="button"
            aria-label="向右移动"
            onPointerDown={() => onTouchInput('d', true)}
            onPointerUp={() => onTouchInput('d', false)}
            onPointerCancel={() => onTouchInput('d', false)}
            className="w-11 h-11 bg-[#0d1326]/90 border border-[#7c93cc]/50 text-white font-bold text-base active:bg-[#23325e]"
          >
            →
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {hud.interactPrompt && (
            <button
              type="button"
              aria-label="祭坛祈祷与锻炉 (E)"
              onPointerDown={() => onTouchInput('e', true)}
              onPointerUp={() => onTouchInput('e', false)}
              onPointerCancel={() => onTouchInput('e', false)}
              className="w-11 h-11 bg-[#12333b]/92 border border-[#7ef5dc]/70 text-[#a4ffec] font-bold text-xs active:bg-[#1e5361]"
            >
              祈 E
            </button>
          )}
          <button
            type="button"
            aria-label="斩击 (J)"
            onPointerDown={() => onTouchInput('j', true)}
            onPointerUp={() => onTouchInput('j', false)}
            onPointerCancel={() => onTouchInput('j', false)}
            className="w-12 h-12 bg-[#1b2952]/92 border border-[#95b4ff]/70 text-white font-bold text-xs active:bg-[#314887]"
          >
            斩 J
          </button>
          <button
            type="button"
            aria-label="瞬步闪避 (K)"
            onPointerDown={() => onTouchInput('k', true)}
            onPointerUp={() => onTouchInput('k', false)}
            onPointerCancel={() => onTouchInput('k', false)}
            className="w-11 h-11 bg-[#122a3d]/92 border border-[#7fe4ff]/70 text-[#9cf0ff] font-bold text-xs active:bg-[#1f4969]"
          >
            闪 K
          </button>
          <button
            type="button"
            aria-label="月魄重斩与次元斩 (L)"
            onPointerDown={() => onTouchInput('l', true)}
            onPointerUp={() => onTouchInput('l', false)}
            onPointerCancel={() => onTouchInput('l', false)}
            className="w-11 h-11 bg-[#2b1a42]/92 border border-[#c896ff]/70 text-[#ebd6ff] font-bold text-xs active:bg-[#462a6b]"
          >
            月 L
          </button>
        </div>
      </div>
    </div>
  );
});
