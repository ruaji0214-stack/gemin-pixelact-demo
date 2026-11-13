import React from 'react';
import { UpgradeChoiceCard, UpgradeDraftState, UpgradeSchool } from '../game/types';

interface UpgradeModalProps {
  draft: UpgradeDraftState;
  lunarCount: number;
  brutalityCount: number;
  tacticsCount: number;
  survivalCount: number;
  onslaughtCount: number;
  soulHeartCount: number;
  souls: number;
  onChoose: (choiceIndex: 0 | 1 | 2) => void;
}

const SCHOOL_STYLES: Record<
  UpgradeSchool,
  {
    border: string;
    hoverBorder: string;
    hoverBg: string;
    accentText: string;
    keyText: string;
    crestFill: string;
    crestStroke: string;
  }
> = {
  [UpgradeSchool.Lunar]: {
    border: 'border-[#5a66b8]/60',
    hoverBorder: 'hover:border-[#a5b4fc]',
    hoverBg: 'hover:bg-[#11152c]',
    accentText: 'text-[#a5b4fc]',
    keyText: 'text-[#c7d2fe]',
    crestFill: '#6366f1',
    crestStroke: '#c7d2fe',
  },
  [UpgradeSchool.Brutality]: {
    border: 'border-[#a83858]/60',
    hoverBorder: 'hover:border-[#ff6b8e]',
    hoverBg: 'hover:bg-[#1c1020]',
    accentText: 'text-[#ff7d9c]',
    keyText: 'text-[#ffa3b8]',
    crestFill: '#e84870',
    crestStroke: '#ffb5c8',
  },
  [UpgradeSchool.Tactics]: {
    border: 'border-[#3d7eb8]/60',
    hoverBorder: 'hover:border-[#7fe8ff]',
    hoverBg: 'hover:bg-[#0f1c33]',
    accentText: 'text-[#82e8ff]',
    keyText: 'text-[#acefff]',
    crestFill: '#42b8e6',
    crestStroke: '#b8f4ff',
  },
  [UpgradeSchool.Survival]: {
    border: 'border-[#a8823c]/60',
    hoverBorder: 'hover:border-[#ffe07d]',
    hoverBg: 'hover:bg-[#1b1912]',
    accentText: 'text-[#ffe082]',
    keyText: 'text-[#ffecad]',
    crestFill: '#dba83b',
    crestStroke: '#fff0b3',
  },
  [UpgradeSchool.Onslaught]: {
    border: 'border-[#2f855a]/60',
    hoverBorder: 'hover:border-[#4ade80]',
    hoverBg: 'hover:bg-[#0f241c]',
    accentText: 'text-[#4ade80]',
    keyText: 'text-[#86efac]',
    crestFill: '#22c55e',
    crestStroke: '#bbf7d0',
  },
  [UpgradeSchool.SoulHeart]: {
    border: 'border-[#86429c]/60',
    hoverBorder: 'hover:border-[#f0abfc]',
    hoverBg: 'hover:bg-[#1f122b]',
    accentText: 'text-[#f0abfc]',
    keyText: 'text-[#f5d0fe]',
    crestFill: '#d946ef',
    crestStroke: '#f5d0fe',
  },
};

function SchoolCrestSvg({ school }: { school: UpgradeSchool }) {
  const s = SCHOOL_STYLES[school];
  if (school === UpgradeSchool.Lunar) {
    return (
      <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="9.5" fill="#0b0e22" stroke={s.crestStroke} strokeWidth="1.5" />
        <path
          d="M14.5 5.5 C10 6.5, 8 11.5, 10.5 15.5 C12.2 18.2, 15.8 18.8, 18 17 C14.5 17.2, 12 14.5, 12 11 C12 8, 13.2 6.2, 14.5 5.5 Z"
          fill={s.crestFill}
        />
      </svg>
    );
  }
  if (school === UpgradeSchool.Brutality) {
    return (
      <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" aria-hidden="true">
        <polygon
          points="12,2 21,9 18,21 6,21 3,9"
          fill="#0c0814"
          stroke={s.crestStroke}
          strokeWidth="1.5"
        />
        <path d="M7 17 L17 6 L18.5 7.5 L8.5 18.5 Z" fill={s.crestFill} />
        <line x1="6" y1="14" x2="11" y2="19" stroke="#ffffff" strokeWidth="1.5" />
      </svg>
    );
  }
  if (school === UpgradeSchool.Tactics) {
    return (
      <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" aria-hidden="true">
        <polygon
          points="12,2 22,12 12,22 2,12"
          fill="#081121"
          stroke={s.crestStroke}
          strokeWidth="1.5"
        />
        <polygon points="12,5 15,12 12,19 9,12" fill={s.crestFill} />
        <polygon points="5,12 12,9 19,12 12,15" fill="#d9fbff" />
      </svg>
    );
  }
  if (school === UpgradeSchool.Onslaught) {
    return (
      <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" aria-hidden="true">
        <polygon
          points="4,18 13,4 15,9 20,6 11,20 9,15"
          fill={s.crestFill}
          stroke={s.crestStroke}
          strokeWidth="1.2"
        />
      </svg>
    );
  }
  if (school === UpgradeSchool.SoulHeart) {
    return (
      <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" aria-hidden="true">
        <path
          d="M12 20 C12 20, 4 14.5, 4 9 C4 6.2, 6.2 4, 9 4 C10.7 4, 12 5, 12 6.5 C12 5, 13.3 4, 15 4 C17.8 4, 20 6.2, 20 9 C20 14.5, 12 20, 12 20 Z"
          fill={s.crestFill}
          stroke={s.crestStroke}
          strokeWidth="1.5"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0" aria-hidden="true">
      <path
        d="M12 2 L20 6 V13 C20 17.5 16.5 20.8 12 22 C7.5 20.8 4 17.5 4 13 V6 Z"
        fill="#12100a"
        stroke={s.crestStroke}
        strokeWidth="1.5"
      />
      <path
        d="M12 6 L16.5 8.5 V12.8 C16.5 15.6 14.6 17.8 12 18.8 C9.4 17.8 7.5 15.6 7.5 12.8 V8.5 Z"
        fill={s.crestFill}
      />
      <circle cx="12" cy="11.5" r="2" fill="#ffffff" />
    </svg>
  );
}

export function UpgradeModal({
  draft,
  lunarCount,
  brutalityCount,
  tacticsCount,
  survivalCount,
  onslaughtCount,
  soulHeartCount,
  souls,
  onChoose,
}: UpgradeModalProps) {
  const handlePick =
    (idx: 0 | 1 | 2) => (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.blur();
      onChoose(idx);
    };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#050711]/86 p-4 sm:p-6 select-none"
    >
      <div className="w-full max-w-4xl bg-[#0b1021] border border-[#728bc9]/60 shadow-[0_24px_64px_rgba(2,4,12,0.96)] p-5 sm:p-7">
        {/* Header Row: Source Title + Current 6-Attribute Scroll Build */}
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[#212d52] pb-4 mb-5">
          <div>
            <h2
              id="upgrade-modal-title"
              className="text-xl sm:text-2xl font-bold text-[#f2f6ff] tracking-wide"
            >
              {draft.sourceTitleZh}
            </h2>
            <p className="text-xs sm:text-sm text-[#9cb0de] mt-1">
              {draft.sourceSubtitleZh}
            </p>
          </div>

          <div className="flex flex-wrap items-baseline gap-2 font-mono text-xs tabular-nums">
            <span className="text-[#a5b4fc]">月魄 {lunarCount}</span>
            <span aria-hidden="true" className="text-[#4f6291]">·</span>
            <span className="text-[#ff85a2]">赤刃 {brutalityCount}</span>
            <span aria-hidden="true" className="text-[#4f6291]">·</span>
            <span className="text-[#82e8ff]">星术 {tacticsCount}</span>
            <span aria-hidden="true" className="text-[#4f6291]">·</span>
            <span className="text-[#ffe082]">坚毅 {survivalCount}</span>
            <span aria-hidden="true" className="text-[#4f6291]">·</span>
            <span className="text-[#4ade80]">连袭 {onslaughtCount}</span>
            <span aria-hidden="true" className="text-[#4f6291]">·</span>
            <span className="text-[#f0abfc]">魂心 {soulHeartCount}</span>
            <span aria-hidden="true" className="text-[#4f6291]">·</span>
            <span className="text-[#c8d8ff]">魄晶 {souls}</span>
          </div>
        </div>

        {/* 3-Choice Upgrade Draft Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {draft.choices.map((card: UpgradeChoiceCard, idx: number) => {
            const st = SCHOOL_STYLES[card.school];
            const keyNum = idx + 1;

            return (
              <button
                key={card.id}
                type="button"
                data-upgrade-slot={keyNum}
                onClick={handlePick(idx as 0 | 1 | 2)}
                className={`group text-left flex flex-col justify-between p-5 bg-[#0e152b] ${st.hoverBg} border ${st.border} ${st.hoverBorder} transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8ef0ff]`}
              >
                <div>
                  {/* School Kicker & Keyboard Shortcut */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <SchoolCrestSvg school={card.school} />
                      <span className={`text-xs font-semibold tracking-wider ${st.accentText}`}>
                        {card.schoolLabelZh}
                      </span>
                    </div>
                    <span className={`font-mono text-xs font-bold tabular-nums ${st.keyText}`}>
                      [{keyNum}]
                    </span>
                  </div>

                  {/* Upgrade Title & Level Progression */}
                  <div className="flex items-baseline justify-between gap-2 mb-2.5">
                    <h3 className="text-base sm:text-lg font-bold text-[#f4f7ff] group-hover:text-white">
                      {card.nameZh}
                    </h3>
                    <span className="font-mono text-xs font-bold text-[#b8caf2] tabular-nums whitespace-nowrap shrink-0">
                      {card.currentLevel === 0
                        ? '新习得 Lv.1'
                        : `Lv.${card.currentLevel} → Lv.${card.nextLevel}`}
                    </span>
                  </div>

                  {/* Mechanic Description */}
                  <p className="text-xs sm:text-[13px] text-[#b4c4e8] leading-relaxed mb-4">
                    {card.descZh}
                  </p>
                </div>

                {/* Bottom Quantitative Effect Readout + CTA Cue */}
                <div className="pt-3 border-t border-[#1e2a4d] flex items-baseline justify-between gap-2">
                  <span className={`font-mono text-xs font-bold tabular-nums ${st.accentText}`}>
                    {card.highlightStatZh}
                  </span>
                  <span className="text-xs font-semibold text-[#dbe6ff] group-hover:text-white whitespace-nowrap shrink-0">
                    铭刻 [{keyNum}] →
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-[#1b2545] flex flex-wrap items-center justify-between gap-2 text-xs text-[#91a5d4]">
          <span>六大流派：月魄(L键专属0.2x凝时秘技) · 赤刃(闪避按住J刹那血闪) · 星术(收刀微光按住J远程绝斩·连发减半收刀) · 坚毅(生存) · 连袭(攻速连击) · 魂心(多段跳/血量/瞬步)</span>
          <span>数字键 1 / 2 / 3 快速铭刻</span>
        </div>
      </div>
    </div>
  );
}
