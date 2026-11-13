/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { StatusModal } from './components/StatusModal';
import { TitleOverlay } from './components/TitleOverlay';
import { UpgradeModal } from './components/UpgradeModal';
import { sound } from './game/audio';
import { RENDER_HEIGHT, RENDER_WIDTH } from './game/rules';
import { GameSimulation } from './game/simulation';
import { GamePhase, HudSnapshot, RunSummary, StyleRank } from './game/types';
import { buildMinimapSnapshot } from './game/world';

const INITIAL_HUD: HudSnapshot = {
  hp: 100,
  maxHp: 100,
  rallyHp: 100,
  stamina: 3,
  maxStamina: 3,
  bladeEnergy: 30,
  ultimateEnergyCost: 50,
  souls: 0,
  nextForgeCost: 45,
  killStreak: 0,
  lunarCount: 0,
  brutalityCount: 0,
  tacticsCount: 0,
  survivalCount: 0,
  onslaughtCount: 0,
  soulHeartCount: 0,
  totalUpgrades: 0,
  activeUpgradeSummary: [],
  upgradeDraft: null,
  attackIntervalSec: 0.5,
  attackCooldownRatio: 0,
  savedComboStage: 0,
  zanshinReady: false,
  astraChainCount: 0,
  nextSheatheSec: 1.0,
  roomLocked: false,
  remainingEnemies: 0,
  comboCount: 0,
  comboTimerRatio: 0,
  styleRank: StyleRank.D,
  stylePoints: 0,
  lastMoveName: '',
  perfectDodgeBannerTimer: 0,
  roomNameZh: '月光回廊',
  zoneNameZh: '外城圣域',
  toastBanner: null,
  interactPrompt: null,
  explorationPct: 6,
  relics: [],
  minimapCells: buildMinimapSnapshot('cloister', new Set(['cloister']), new Set(), new Set()),
  score: 0,
  bossName: null,
  bossHp: 0,
  bossMaxHp: 1,
  bossesDefeated: 0,
  runSeed: 77491,
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<GameSimulation | null>(null);

  const [phase, setPhase] = useState<GamePhase>(GamePhase.Title);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [muted, setMuted] = useState<boolean>(false);

  // Mount Canvas & Simulation ONCE (never torn down by HUD state updates)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sim = new GameSimulation(canvas, {
      onPhaseChange: (nextPhase) => setPhase(nextPhase),
      onHudUpdate: (snapshot) => setHud(snapshot),
      onRunEnd: (summary) => setRunSummary(summary),
    });
    simRef.current = sim;
    sim.startLoop();

    // Support ?autostart=1 to jump directly into active gameplay
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      sim.startNewRun();
    } else {
      document.body.dataset.state = GamePhase.Title;
    }

    const onMuteKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key.toLowerCase() === 'm') {
        const nextMuted = sound.toggleMute();
        setMuted(nextMuted);
      }
    };
    window.addEventListener('keydown', onMuteKey);

    return () => {
      window.removeEventListener('keydown', onMuteKey);
      sim.destroy();
      simRef.current = null;
    };
  }, []);

  const handleStart = useCallback(() => {
    simRef.current?.startNewRun();
  }, []);

  const handleResume = useCallback(() => {
    simRef.current?.resumeGame();
  }, []);

  const handlePause = useCallback(() => {
    simRef.current?.setPhase(GamePhase.Paused);
  }, []);

  const handleReturnTitle = useCallback(() => {
    simRef.current?.returnToTitle();
  }, []);

  const handleChooseUpgrade = useCallback((idx: 0 | 1 | 2) => {
    simRef.current?.chooseUpgrade(idx);
  }, []);

  const handleToggleMute = useCallback(() => {
    const next = sound.toggleMute();
    setMuted(next);
  }, []);

  const handleTouchInput = useCallback(
    (key: 'a' | 'd' | 'w' | 's' | 'j' | 'k' | 'l' | 'e', down: boolean) => {
      simRef.current?.injectControl(key, down);
    },
    []
  );

  return (
    <main className="relative w-screen h-screen bg-[#070912] flex items-center justify-center overflow-hidden">
      {/* Isolated Full-Viewport HD PixelFX Canvas Stage (1920x1080) */}
      <canvas
        ref={canvasRef}
        width={RENDER_WIDTH}
        height={RENDER_HEIGHT}
        tabIndex={0}
        data-testid="pixelfx-canvas"
        aria-label="银月残响类银河恶魔城像素动作游戏画布"
        className="w-full h-full object-cover hd-pixel-canvas outline-none"
      />

      {phase === GamePhase.Title && (
        <TitleOverlay muted={muted} onStart={handleStart} onToggleMute={handleToggleMute} />
      )}

      {phase === GamePhase.Playing && (
        <GameHud
          hud={hud}
          muted={muted}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
          onRestart={handleStart}
          onTouchInput={handleTouchInput}
        />
      )}

      {phase === GamePhase.Upgrade && hud.upgradeDraft && (
        <UpgradeModal
          draft={hud.upgradeDraft}
          lunarCount={hud.lunarCount}
          brutalityCount={hud.brutalityCount}
          tacticsCount={hud.tacticsCount}
          survivalCount={hud.survivalCount}
          onslaughtCount={hud.onslaughtCount}
          soulHeartCount={hud.soulHeartCount}
          souls={hud.souls}
          onChoose={handleChooseUpgrade}
        />
      )}

      {(phase === GamePhase.Paused || phase === GamePhase.GameOver) && (
        <StatusModal
          phase={phase}
          hud={hud}
          summary={runSummary}
          onResume={handleResume}
          onRestart={handleStart}
          onReturnTitle={handleReturnTitle}
        />
      )}
    </main>
  );
}
