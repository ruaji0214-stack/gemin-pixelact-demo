export type BgmTrack = 'none' | 'title' | 'explore' | 'boss';

type AudioClipId =
  | 'bgm_title'
  | 'bgm_explore'
  | 'bgm_boss'
  | 'sfx_slash'
  | 'sfx_crimson'
  | 'sfx_astral'
  | 'sfx_lunar'
  | 'sfx_hit'
  | 'sfx_dash'
  | 'sfx_zanshin'
  | 'sfx_gate';

export interface AssetManifestSnapshot {
  hasApiKey: boolean;
  syncInProgress: boolean;
  lastSyncError: string | null;
  audio: string[];
  frameStrips: string[];
}

/**
 * Pure Model-Generated Audio Playback Engine (`音乐音效使用音乐生成模型 · 不要用代码构造逻辑以外的产物`).
 * - Zero Web Audio oscillator or procedural noise synthesis.
 * - Loads and plays WAV tracks generated via Lyria (`lyria-3-clip-preview`) under `/generated/audio/*.wav`.
 * - Gracefully no-ops when an audio asset has not yet been generated so gameplay never throws or logs 404 errors.
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private currentTrack: BgmTrack = 'none';
  private bgmDucked = false;
  private availableClips = new Set<string>();
  private decodedBuffers = new Map<string, AudioBuffer>();
  private loadingClips = new Set<string>();
  private manifestChecked = false;

  private activeBgmSource: AudioBufferSourceNode | null = null;
  private activeBgmGain: GainNode | null = null;
  private activeBgmClipId: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      void this.refreshManifest();
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public async refreshManifest(): Promise<AssetManifestSnapshot | null> {
    if (typeof window === 'undefined') return null;
    try {
      const res = await fetch('/api/assets/manifest', { cache: 'no-store' });
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return null;
      const data = (await res.json()) as AssetManifestSnapshot;
      this.manifestChecked = true;
      if (Array.isArray(data.audio)) {
        this.availableClips = new Set(data.audio);
        for (const id of data.audio) {
          void this.preloadClip(id);
        }
        if (!this.muted && this.currentTrack !== 'none') {
          this.syncBgmPlayback();
        }
      }
      return data;
    } catch {
      this.manifestChecked = true;
      return null;
    }
  }

  public async triggerServerAssetSync(): Promise<AssetManifestSnapshot | null> {
    if (typeof window === 'undefined') return null;
    try {
      const res = await fetch('/api/assets/sync', { method: 'POST' });
      if (!res.ok) return null;
      const payload = (await res.json()) as { manifest?: AssetManifestSnapshot };
      if (payload.manifest) {
        this.availableClips = new Set(payload.manifest.audio ?? []);
      }
      return payload.manifest ?? null;
    } catch {
      return null;
    }
  }

  private async preloadClip(id: string): Promise<void> {
    if (!this.availableClips.has(id)) return;
    if (this.decodedBuffers.has(id) || this.loadingClips.has(id)) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    this.loadingClips.add(id);
    try {
      const res = await fetch(`/generated/audio/${id}.wav`);
      if (!res.ok) return;
      const arr = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(arr);
      this.decodedBuffers.set(id, buf);
      if (id.startsWith('bgm_') && !this.muted && this.currentTrack !== 'none') {
        this.syncBgmPlayback();
      }
    } catch {
      // Ignore decode failure if file is still being written
    } finally {
      this.loadingClips.delete(id);
    }
  }

  private playClip(id: AudioClipId, gainValue = 0.55, playbackRate = 1.0): void {
    if (this.muted) return;
    if (!this.manifestChecked) {
      void this.refreshManifest();
      return;
    }
    if (!this.availableClips.has(id)) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const buffer = this.decodedBuffers.get(id);
    if (!buffer) {
      void this.preloadClip(id);
      return;
    }

    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buffer;
    src.playbackRate.value = Math.max(0.5, Math.min(1.6, playbackRate));
    gain.gain.value = gainValue;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(0);
  }

  private stopBgmPlayback(): void {
    if (this.activeBgmSource) {
      try {
        this.activeBgmSource.stop();
        this.activeBgmSource.disconnect();
      } catch {
        // Ignore already-stopped source
      }
      this.activeBgmSource = null;
    }
    this.activeBgmGain = null;
    this.activeBgmClipId = null;
  }

  private syncBgmPlayback(): void {
    if (this.muted || this.currentTrack === 'none') {
      this.stopBgmPlayback();
      return;
    }

    const targetId: AudioClipId =
      this.currentTrack === 'title'
        ? 'bgm_title'
        : this.currentTrack === 'boss'
          ? 'bgm_boss'
          : 'bgm_explore';

    if (!this.availableClips.has(targetId)) {
      this.stopBgmPlayback();
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    const buf = this.decodedBuffers.get(targetId);
    if (!buf) {
      void this.preloadClip(targetId);
      return;
    }

    const targetVolume = this.bgmDucked ? 0.14 : 0.34;
    if (this.activeBgmSource && this.activeBgmClipId === targetId && this.activeBgmGain) {
      this.activeBgmGain.gain.value = targetVolume;
      return;
    }

    this.stopBgmPlayback();
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buf;
    src.loop = true;
    gain.gain.value = targetVolume;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(0);

    this.activeBgmSource = src;
    this.activeBgmGain = gain;
    this.activeBgmClipId = targetId;
  }

  public setMuted(m: boolean): void {
    this.muted = m;
    if (m) {
      this.stopBgmPlayback();
    } else {
      this.syncBgmPlayback();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public setBgmTrack(track: BgmTrack, ducked = false): void {
    this.currentTrack = track;
    this.bgmDucked = ducked;
    this.syncBgmPlayback();
  }

  public playFootstep(): void {
    this.playClip('sfx_dash', 0.14, 1.32);
  }

  public playSlash(comboIndex = 0, heavy = false): void {
    this.playClip(
      heavy ? 'sfx_lunar' : 'sfx_slash',
      heavy ? 0.58 : 0.45,
      1 + comboIndex * 0.05 - (heavy ? 0.08 : 0)
    );
  }

  public playCrimsonSlash(): void {
    this.playClip('sfx_crimson', 0.72, 1.0);
  }

  public playAstralSlash(chainCount = 0): void {
    this.playClip('sfx_astral', 0.66, Math.min(1.38, 1 + chainCount * 0.06));
  }

  public playLunarSkill(isUltimate = false): void {
    this.playClip('sfx_lunar', isUltimate ? 0.72 : 0.6, isUltimate ? 0.92 : 1.04);
  }

  public playEmpoweredL(): void {
    this.playAstralSlash(0);
  }

  public playRoomUnlock(): void {
    this.playClip('sfx_gate', 0.64, 1.0);
  }

  public playEnemyAttack(isBoss = false, isRanged = false): void {
    this.playClip(
      isRanged ? 'sfx_astral' : 'sfx_slash',
      isBoss ? 0.48 : 0.34,
      isBoss ? 0.76 : 0.88
    );
  }

  public playBossEnrage(): void {
    this.playClip('sfx_crimson', 0.68, 0.82);
  }

  public playHit(heavy = false, shieldBlocked = false, critical = false): void {
    if (shieldBlocked) {
      this.playClip('sfx_zanshin', 0.48, 0.74);
      return;
    }
    this.playClip('sfx_hit', heavy || critical ? 0.62 : 0.45, critical ? 1.12 : 1.0);
  }

  public playDash(perfect = false): void {
    this.playClip(perfect ? 'sfx_zanshin' : 'sfx_dash', perfect ? 0.58 : 0.38, perfect ? 1.15 : 1.0);
  }

  public playDimensionCut(): void {
    this.playLunarSkill(true);
  }

  public playJump(): void {
    this.playClip('sfx_dash', 0.28, 1.18);
  }

  public playTelegraph(): void {
    this.playClip('sfx_zanshin', 0.34, 0.88);
  }

  public playHurt(): void {
    this.playClip('sfx_hit', 0.62, 0.76);
  }

  public playZanshin(): void {
    this.playClip('sfx_zanshin', 0.46, 1.0);
  }

  public playRelicChime(): void {
    this.playClip('sfx_astral', 0.52, 1.12);
  }

  public playSealShatter(): void {
    this.playClip('sfx_gate', 0.68, 0.86);
  }

  public playOutcome(victory: boolean): void {
    this.playClip(victory ? 'sfx_lunar' : 'sfx_crimson', 0.65, victory ? 1.08 : 0.78);
  }
}

export const sound = new SoundEngine();
