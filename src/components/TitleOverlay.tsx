import { useEffect, useState } from 'react';
import { sound } from '../game/audio';

interface TitleOverlayProps {
  muted: boolean;
  onStart: () => void;
  onToggleMute: () => void;
}

const GRIMOIRE_ENTRIES = [
  {
    keys: 'J · 0.50s 节拍',
    name: '残月四式 · 连段恒驻',
    school: '连袭 / 基础刀术',
    desc: '初始每 0.5s 挥出一刀；只要未按 L 键且未受击，奔跑、跳跃与瞬步均完整保留当前连击段数。',
  },
  {
    keys: '完美闪避 [K] + 按住 J',
    name: '赤刃一闪 · 刹那血断',
    school: '赤刃流核心',
    desc: '按 K 瞬步穿过敌方攻击特效像素触发完美闪避（闪避 5s/次恢复），按住 J 展开 0.2x 时缓结界并挥出单刀居合血闪。',
  },
  {
    keys: '收刀微光 + 按住 J',
    name: '星术绝斩 · 连续缩鞘',
    school: '星术流核心',
    desc: '纳刀微光（0.3s）期间按住 J 展开 0.2x 凝时并挥出远程穿透星芒剑波；每次激发使下次收刀等待减半（1.0s→0.5s→0.25s→0.125s）。',
  },
  {
    keys: '专属 [L] · 封锁圣堂',
    name: '月魄秘技 · 铁闸试炼',
    school: '月魄核心 / 多尺度洞窟',
    desc: 'L 键完全归属月魄，施展 0.2x 凝时满月重斩、裂空落斩与虚空次元斩；踏入不同尺度的战斗房间将落下封锁铁门，肃清敌影方可开启出口。',
  },
];

/**
 * Pixel-Art Scarlet Rose & Silver Katana Cursor (`───◆▸`) inspired by Bloodstained: Ritual of the Night
 */
function PixelRoseSwordCursor() {
  return (
    <svg
      width="34"
      height="16"
      viewBox="0 0 34 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className="shrink-0"
    >
      {/* Hilt & Crimson Rose Guard */}
      <rect x="0" y="7" width="6" height="2" fill="#a88754" />
      <rect x="6" y="4" width="6" height="8" fill="#9e1c47" />
      <rect x="7" y="5" width="4" height="6" fill="#e63971" />
      <rect x="8" y="6" width="2" height="4" fill="#ffd6e4" />
      <rect x="12" y="3" width="2" height="10" fill="#d9b87c" />
      {/* Pixel Silver Blade & Tip */}
      <rect x="14" y="6" width="14" height="4" fill="#8ea4d8" />
      <rect x="14" y="6" width="16" height="2" fill="#f4f7ff" />
      <rect x="28" y="7" width="4" height="2" fill="#ffffff" />
      <rect x="32" y="7" width="2" height="1" fill="#ffffff" />
    </svg>
  );
}

export function TitleOverlay({ muted, onStart, onToggleMute }: TitleOverlayProps) {
  const [selectedIdx, setSelectedIdx] = useState<0 | 1 | 2>(0);
  const [showGrimoire, setShowGrimoire] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'escape' && showGrimoire) {
        e.preventDefault();
        setShowGrimoire(false);
        return;
      }
      if (k === 'w' || k === 'arrowup') {
        e.preventDefault();
        sound.playFootstep();
        setSelectedIdx((prev) => ((prev + 2) % 3) as 0 | 1 | 2);
      } else if (k === 's' || k === 'arrowdown') {
        e.preventDefault();
        sound.playFootstep();
        setSelectedIdx((prev) => ((prev + 1) % 3) as 0 | 1 | 2);
      } else if (k === 'enter' || k === ' ') {
        e.preventDefault();
        if (selectedIdx === 0) {
          onStart();
        } else if (selectedIdx === 1) {
          sound.playRelicChime();
          setShowGrimoire((v) => !v);
        } else {
          onToggleMute();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onStart, onToggleMute, selectedIdx, showGrimoire]);

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between px-7 py-6 sm:px-12 sm:py-10 md:px-16 md:py-12 pointer-events-none">
      {/* Subtle Top-Left Gothic Filigree Corner Frame */}
      <div className="flex items-start justify-between gap-8">
        {/* Left-Third Asymmetric Title Crest & Aristocratic Menu sitting over calm nocturne negative space */}
        <div className="max-w-md pt-1 sm:pt-3 pointer-events-auto">
          {/* Bespoke Pixel-Stepped Gothic Stained-Glass Rose & Katana Emblem Lockup */}
          <div className="mb-7">
            <svg
              viewBox="0 0 392 146"
              className="w-80 sm:w-96 h-auto overflow-visible"
              role="img"
              aria-label="银月残响 Silver Echo: Ritual of the Pale Moon"
            >
              {/* Pixel-Art Stained-Glass Rose & Lunar Crest (`shapeRendering="crispEdges"`) */}
              <g shapeRendering="crispEdges">
                {/* Gilded Upper Filigree Crown */}
                <rect x="34" y="10" width="4" height="4" fill="#d8b574" />
                <rect x="32" y="14" width="8" height="2" fill="#a88448" />
                <rect x="20" y="20" width="32" height="2" fill="#5c4734" />
                <rect x="26" y="18" width="20" height="2" fill="#d8b574" />

                {/* Stained-Glass Diamond Medallion */}
                <rect x="22" y="26" width="28" height="28" fill="#141126" />
                <rect x="20" y="28" width="32" height="24" fill="#2c1d3d" />
                <rect x="24" y="24" width="24" height="32" fill="#2c1d3d" />
                {/* Ruby & Amethyst Stained Glass Facets */}
                <rect x="24" y="28" width="11" height="11" fill="#b82052" />
                <rect x="37" y="28" width="11" height="11" fill="#6d2da8" />
                <rect x="24" y="41" width="11" height="11" fill="#2858a8" />
                <rect x="37" y="41" width="11" height="11" fill="#b82052" />
                {/* Gilded Leadwork Cross & Scarlet Rose Core */}
                <rect x="35" y="24" width="2" height="32" fill="#d8b574" />
                <rect x="20" y="39" width="32" height="2" fill="#d8b574" />
                <rect x="31" y="35" width="10" height="10" fill="#e6376d" />
                <rect x="33" y="37" width="6" height="6" fill="#ffd9e6" />

                {/* Diagonal Pixel Silver Katana Piercing Behind Crest */}
                <rect x="8" y="62" width="10" height="2" fill="#9fb6e8" />
                <rect x="16" y="58" width="10" height="2" fill="#dce7ff" />
                <rect x="24" y="54" width="10" height="2" fill="#ffffff" />
                <rect x="44" y="22" width="12" height="2" fill="#ffffff" />
                <rect x="54" y="18" width="12" height="2" fill="#dce7ff" />
                <rect x="64" y="14" width="8" height="2" fill="#8ee8ff" />

                {/* Lower Pendant Drop */}
                <rect x="32" y="58" width="8" height="2" fill="#a88448" />
                <rect x="34" y="60" width="4" height="6" fill="#d8b574" />
                <rect x="35" y="66" width="2" height="6" fill="#e6376d" />

                {/* Ornate Horizontal Gothic Filigree Rule under Main Title */}
                <rect x="84" y="80" width="276" height="2" fill="#3a2942" />
                <rect x="84" y="80" width="188" height="2" fill="#b9935a" />
                <rect x="84" y="80" width="64" height="2" fill="#f3dfb9" />
                <rect x="78" y="78" width="6" height="6" fill="#e6376d" />
                <rect x="80" y="80" width="2" height="2" fill="#fff0f5" />
                <rect x="272" y="79" width="4" height="4" fill="#d8b574" />
                <rect x="360" y="79" width="4" height="4" fill="#7a5e42" />
              </g>

              {/* Engraved Aristocratic Serif Title: 银月残响 */}
              <text
                x="84"
                y="64"
                fill="#241023"
                fontFamily="Noto Serif SC, Cinzel, serif"
                fontWeight="900"
                fontSize="48"
                letterSpacing="7"
              >
                银月残响
              </text>
              <text
                x="82"
                y="61"
                fill="#f5efe6"
                stroke="#080712"
                strokeWidth="5.5"
                paintOrder="stroke fill"
                fontFamily="Noto Serif SC, Cinzel, serif"
                fontWeight="900"
                fontSize="48"
                letterSpacing="7"
              >
                银月残响
              </text>
              {/* Subtle Gilded Top Rim Highlight */}
              <text
                x="82"
                y="60.2"
                fill="#fffaf2"
                fontFamily="Noto Serif SC, Cinzel, serif"
                fontWeight="900"
                fontSize="48"
                letterSpacing="7"
                opacity="0.88"
              >
                银月残响
              </text>

              {/* Bloodstained-Inspired Classical Roman Subtitle */}
              <text
                x="84"
                y="104"
                fill="#e2c391"
                stroke="#070610"
                strokeWidth="3.5"
                paintOrder="stroke fill"
                fontFamily="Cinzel, Noto Serif SC, serif"
                fontWeight="700"
                fontSize="14.5"
                letterSpacing="4.6"
              >
                SILVER ECHO
              </text>
              <text
                x="232"
                y="104"
                fill="#d46b8e"
                stroke="#070610"
                strokeWidth="3"
                paintOrder="stroke fill"
                fontFamily="Noto Serif SC, serif"
                fontWeight="700"
                fontSize="12"
                letterSpacing="2.5"
              >
                · 夜之月咏
              </text>

              <text
                x="84"
                y="126"
                fill="#9aa9cf"
                stroke="#070610"
                strokeWidth="3"
                paintOrder="stroke fill"
                fontFamily="Cinzel, serif"
                fontWeight="600"
                fontSize="9.5"
                letterSpacing="3.2"
              >
                RITUAL OF THE PALE MOON
              </text>
            </svg>
          </div>

          {/* Classical Bloodstained Vertical Gothic Menu (<= 3 Controls, Zero SaaS Boxes) */}
          <nav aria-label="主菜单" className="flex flex-col items-start gap-2.5 pl-1">
            {/* 1. Primary CTA: Start Ritual (`data-start="true"`) */}
            <button
              type="button"
              data-start="true"
              onMouseEnter={() => setSelectedIdx(0)}
              onFocus={() => setSelectedIdx(0)}
              onClick={onStart}
              className="group relative flex items-center gap-3.5 py-2 pr-6 text-left cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e2c391]"
            >
              <span className="w-9 flex items-center justify-end">
                {selectedIdx === 0 ? (
                  <PixelRoseSwordCursor />
                ) : (
                  <span className="w-2 h-2 bg-[#6f5a46] rotate-45 inline-block opacity-65 group-hover:opacity-100" />
                )}
              </span>
              <span className="flex items-baseline gap-3">
                <span
                  className={`font-gothic text-xl sm:text-2xl font-bold tracking-[0.22em] transition-colors duration-150 hud-stroke ${
                    selectedIdx === 0 ? 'text-[#fff7eb]' : 'text-[#b8bfd9] group-hover:text-[#f2e8d8]'
                  }`}
                >
                  踏入古堡
                </span>
                <span
                  className={`font-gothic text-[11px] tracking-[0.24em] hud-stroke-sm ${
                    selectedIdx === 0 ? 'text-[#e66c91]' : 'text-[#7782a6]'
                  }`}
                >
                  START
                </span>
              </span>
              {selectedIdx === 0 && (
                <span
                  aria-hidden="true"
                  className="absolute left-12 right-0 bottom-0.5 h-[2px] bg-[#c8a064]"
                />
              )}
            </button>

            {/* 2. Secondary Action: Blade & School Grimoire */}
            <button
              type="button"
              aria-expanded={showGrimoire}
              onMouseEnter={() => setSelectedIdx(1)}
              onFocus={() => setSelectedIdx(1)}
              onClick={() => {
                sound.playRelicChime();
                setShowGrimoire((v) => !v);
              }}
              className="group relative flex items-center gap-3.5 py-2 pr-6 text-left cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e2c391]"
            >
              <span className="w-9 flex items-center justify-end">
                {selectedIdx === 1 ? (
                  <PixelRoseSwordCursor />
                ) : (
                  <span className="w-2 h-2 bg-[#6f5a46] rotate-45 inline-block opacity-65 group-hover:opacity-100" />
                )}
              </span>
              <span className="flex items-baseline gap-3">
                <span
                  className={`font-gothic text-lg sm:text-xl font-bold tracking-[0.2em] transition-colors duration-150 hud-stroke ${
                    selectedIdx === 1 || showGrimoire
                      ? 'text-[#fff7eb]'
                      : 'text-[#aeb7d4] group-hover:text-[#f2e8d8]'
                  }`}
                >
                  {showGrimoire ? '合上秘典' : '武技秘典'}
                </span>
                <span
                  className={`font-gothic text-[11px] tracking-[0.22em] hud-stroke-sm ${
                    selectedIdx === 1 || showGrimoire ? 'text-[#e2c391]' : 'text-[#7782a6]'
                  }`}
                >
                  GRIMOIRE
                </span>
              </span>
              {selectedIdx === 1 && (
                <span
                  aria-hidden="true"
                  className="absolute left-12 right-0 bottom-0.5 h-[2px] bg-[#c8a064]"
                />
              )}
            </button>

            {/* 3. Tertiary Action: Sound Resonance Toggle */}
            <button
              type="button"
              aria-pressed={!muted}
              onMouseEnter={() => setSelectedIdx(2)}
              onFocus={() => setSelectedIdx(2)}
              onClick={onToggleMute}
              className="group relative flex items-center gap-3.5 py-2 pr-6 text-left cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e2c391]"
            >
              <span className="w-9 flex items-center justify-end">
                {selectedIdx === 2 ? (
                  <PixelRoseSwordCursor />
                ) : (
                  <span className="w-2 h-2 bg-[#6f5a46] rotate-45 inline-block opacity-65 group-hover:opacity-100" />
                )}
              </span>
              <span className="flex items-baseline gap-3">
                <span
                  className={`font-gothic text-lg sm:text-xl font-bold tracking-[0.2em] transition-colors duration-150 hud-stroke ${
                    selectedIdx === 2 ? 'text-[#fff7eb]' : 'text-[#aeb7d4] group-hover:text-[#f2e8d8]'
                  }`}
                >
                  声律共鸣：{muted ? '静默' : '奏鸣'}
                </span>
                <span
                  className={`font-mono text-[11px] tracking-widest hud-stroke-sm ${
                    muted ? 'text-[#8892b5]' : 'text-[#8ce8ff]'
                  }`}
                >
                  [M]
                </span>
              </span>
              {selectedIdx === 2 && (
                <span
                  aria-hidden="true"
                  className="absolute left-12 right-0 bottom-0.5 h-[2px] bg-[#c8a064]"
                />
              )}
            </button>
          </nav>
        </div>

        {/* Ornate Pixel-Stepped Gothic Grimoire Tome (opens cleanly when toggled) */}
        {showGrimoire && (
          <div
            role="region"
            aria-label="武技与秘境秘典"
            className="max-w-md w-full pixel-gothic-frame p-5 pointer-events-auto mt-2"
          >
            <div className="flex items-baseline justify-between gap-4 border-b border-[#5e4736] pb-2.5 mb-3.5">
              <h2 className="font-gothic text-base font-bold tracking-[0.18em] text-[#f5ead6]">
                夜之月咏 · 秘剑录
              </h2>
              <button
                type="button"
                onClick={() => setShowGrimoire(false)}
                className="font-mono text-xs text-[#d8b574] hover:text-white cursor-pointer whitespace-nowrap"
              >
                关闭 [ESC]
              </button>
            </div>

            <div className="space-y-3">
              {GRIMOIRE_ENTRIES.map((item) => (
                <div
                  key={item.name}
                  className="border-b border-[#292138] pb-2.5 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-bold text-[#f6efe4] tracking-wide whitespace-nowrap">
                      {item.name}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-[#e87a9f] whitespace-nowrap">
                      {item.keys}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#d8b574] mt-0.5">{item.school}</div>
                  <p className="text-xs text-[#b8c2df] leading-relaxed mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Flat Borderless Control Hint Line in Safe Margin */}
      <div className="w-full flex flex-wrap items-center justify-between gap-2 text-xs text-[#c7d0eb] tracking-wider hud-stroke-sm">
        <span>
          WASD 移动攀跃 · J 拔刀连斩 / 收刀按住J 星术绝斩 · K 幻影瞬步 · L 月魄秘技 · E 祭坛共鸣 · Tab 星盘地图
        </span>
        <span className="font-gothic text-[11px] tracking-[0.2em] text-[#d8b574]">
          PRESS ENTER OR SPACE TO BEGIN
        </span>
      </div>
    </div>
  );
}
