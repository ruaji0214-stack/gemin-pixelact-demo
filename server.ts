import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { GoogleGenAI, Modality } from '@google/genai';

const execFileAsync = promisify(execFile);

const ROOT_DIR = process.cwd();
const GENERATED_AUDIO_DIR = path.join(ROOT_DIR, 'public', 'generated', 'audio');
const GENERATED_FRAMES_DIR = path.join(ROOT_DIR, 'public', 'generated', 'frames');
const ASSETS_IMAGES_DIR = path.join(ROOT_DIR, 'src', 'assets', 'images');

fs.mkdirSync(GENERATED_AUDIO_DIR, { recursive: true });
fs.mkdirSync(GENERATED_FRAMES_DIR, { recursive: true });

interface AudioAssetSpec {
  id: string;
  prompt: string;
  trimSec?: number;
}

const AUDIO_ASSET_SPECS: readonly AudioAssetSpec[] = [
  {
    id: 'bgm_title',
    prompt:
      'Generate a 24-second gothic cathedral harpsichord, pipe organ, and solo cello instrumental theme inspired by Bloodstained Ritual of the Night, melancholic D harmonic minor, no vocals.',
  },
  {
    id: 'bgm_explore',
    prompt:
      'Generate a 24-second dark fantasy metroidvania cavern exploration instrumental track with harpsichord arpeggios, driving bass ostinato, and ethereal choir pads, Cave Story meets Castlevania, no vocals.',
  },
  {
    id: 'bgm_boss',
    prompt:
      'Generate a 24-second intense symphonic gothic boss battle instrumental track with fast baroque strings, pipe organ chords, and heavy war drums, no vocals.',
  },
  {
    id: 'sfx_slash',
    prompt:
      'Generate a crisp metallic silver katana sword slash foley sound effect with sharp steel ring, clean studio foley, no music.',
    trimSec: 0.45,
  },
  {
    id: 'sfx_crimson',
    prompt:
      'Generate a heavy crimson battojutsu sword execution impact with deep time-stop sub bass drop and razor steel resonance, clean game sound effect.',
    trimSec: 1.15,
  },
  {
    id: 'sfx_astral',
    prompt:
      'Generate a crystalline starlight ranged sword wave projectile whoosh with shimmering astral chime resonance, clean game sound effect.',
    trimSec: 0.85,
  },
  {
    id: 'sfx_lunar',
    prompt:
      'Generate a mystical crescent moon heavy blade cleave sound effect with deep arcane resonance and silver bell overtone, clean game sound effect.',
    trimSec: 0.9,
  },
  {
    id: 'sfx_hit',
    prompt:
      'Generate a punchy armored sword hit impact sound effect with crisp metallic spark, clean game sound effect.',
    trimSec: 0.4,
  },
  {
    id: 'sfx_dash',
    prompt:
      'Generate a swift phantom wind dash whoosh sound effect with light feather flutter, clean game sound effect.',
    trimSec: 0.35,
  },
  {
    id: 'sfx_zanshin',
    prompt:
      'Generate a crisp Japanese katana iaido sheathe click chime sound effect with subtle metallic ring, clean game sound effect.',
    trimSec: 0.42,
  },
  {
    id: 'sfx_gate',
    prompt:
      'Generate a heavy medieval dungeon iron portcullis gate unlocking and rising with stone echo chime, clean game sound effect.',
    trimSec: 0.95,
  },
];

interface VideoStripSpec {
  clipId: string;
  sourceFile: string;
  prompt: string;
}

const VIDEO_STRIP_SPECS: readonly VideoStripSpec[] = [
  {
    clipId: 'astral_slash',
    sourceFile: 'aria_astral_slash_sheet_1794584924130.jpg',
    prompt:
      '2D pixel art game sprite animation on solid #00FF00 green screen: silver-haired swordswoman Aria draws her katana from its scabbard in a starlight flash and sweeps a wide ranged cyan-violet astral crescent slash wave forward, crisp pixel art, fixed camera, no camera pan.',
  },
  {
    clipId: 'heavy_crescent',
    sourceFile: 'aria_lunar_skill_sheet_1794584926340.jpg',
    prompt:
      '2D pixel art game sprite animation on solid #00FF00 green screen: silver-haired swordswoman Aria raises her glowing violet-silver katana high overhead and cleaves downward in a powerful crescent moon secret art slash, crisp pixel art, fixed camera, no camera pan.',
  },
  {
    clipId: 'moon_counter',
    sourceFile: 'aria_astral_slash_sheet_1794584924130.jpg',
    prompt:
      '2D pixel art game sprite animation on solid #00FF00 green screen: silver-haired swordswoman Aria coils low and unleashes a single devastating crimson battojutsu execution slash with a scarlet blade arc, crisp pixel art, fixed camera, no camera pan.',
  },
];

let syncInProgress = false;
let lastSyncError: string | null = null;

function listExistingManifest() {
  const audioFiles = fs.existsSync(GENERATED_AUDIO_DIR)
    ? fs
        .readdirSync(GENERATED_AUDIO_DIR)
        .filter((f) => f.endsWith('.wav'))
        .map((f) => f.replace(/\.wav$/, ''))
    : [];

  const frameStrips = fs.existsSync(GENERATED_FRAMES_DIR)
    ? fs
        .readdirSync(GENERATED_FRAMES_DIR)
        .filter((f) => f.endsWith('_strip.png'))
        .map((f) => f.replace(/_strip\.png$/, ''))
    : [];

  return {
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    syncInProgress,
    lastSyncError,
    audio: audioFiles,
    frameStrips,
  };
}

async function generateLyriaClip(ai: GoogleGenAI, spec: AudioAssetSpec): Promise<void> {
  const outPath = path.join(GENERATED_AUDIO_DIR, `${spec.id}.wav`);
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 512) {
    return;
  }

  const stream = await ai.models.generateContentStream({
    model: 'lyria-3-clip-preview',
    contents: spec.prompt,
    config: {
      responseModalities: [Modality.AUDIO],
    },
  });

  let audioBase64 = '';
  for await (const chunk of stream) {
    const parts = chunk.candidates?.[0]?.content?.parts;
    if (!parts) continue;
    for (const part of parts) {
      if (part.inlineData?.data) {
        audioBase64 += part.inlineData.data;
      }
    }
  }

  if (!audioBase64) {
    throw new Error(`No audio data returned for ${spec.id}`);
  }

  const rawBuf = Buffer.from(audioBase64, 'base64');
  if (spec.trimSec && fs.existsSync('/usr/bin/ffmpeg')) {
    const tmpRaw = path.join(GENERATED_AUDIO_DIR, `${spec.id}.raw.wav`);
    fs.writeFileSync(tmpRaw, rawBuf);
    try {
      await execFileAsync('/usr/bin/ffmpeg', [
        '-y',
        '-i',
        tmpRaw,
        '-t',
        String(spec.trimSec),
        '-af',
        `afade=t=out:st=${Math.max(0.05, spec.trimSec - 0.12).toFixed(2)}:d=0.12`,
        outPath,
      ]);
    } finally {
      if (fs.existsSync(tmpRaw)) fs.unlinkSync(tmpRaw);
    }
  } else {
    fs.writeFileSync(outPath, rawBuf);
  }
}

async function generateOmniFrameStrip(ai: GoogleGenAI, spec: VideoStripSpec): Promise<void> {
  const outStrip = path.join(GENERATED_FRAMES_DIR, `${spec.clipId}_strip.png`);
  if (fs.existsSync(outStrip) && fs.statSync(outStrip).size > 1024) {
    return;
  }

  const srcImgPath = path.join(ASSETS_IMAGES_DIR, spec.sourceFile);
  if (!fs.existsSync(srcImgPath) || !fs.existsSync('/usr/bin/ffmpeg')) {
    return;
  }

  const croppedRef = path.join(GENERATED_FRAMES_DIR, `${spec.clipId}_seed.png`);
  await execFileAsync('/usr/bin/ffmpeg', [
    '-y',
    '-i',
    srcImgPath,
    '-vf',
    'crop=iw/4:ih/2:0:0',
    croppedRef,
  ]);

  const seedBase64 = fs.readFileSync(croppedRef).toString('base64');
  const interaction = await ai.interactions.create(
    {
      model: 'gemini-omni-1.2-flash',
      input: [
        {
          type: 'image',
          mime_type: 'image/png',
          data: seedBase64,
        },
        {
          type: 'text',
          text: spec.prompt,
        },
      ],
      background: false,
      store: false,
      stream: false,
      response_format: {
        type: 'video',
        aspect_ratio: '16:9',
        duration: '3s',
        resolution: '720p',
      },
    },
    { timeout: 300000 }
  );

  const videoData = (interaction as unknown as { output_video?: { data?: string } }).output_video
    ?.data;
  if (!videoData) {
    return;
  }

  const mp4Path = path.join(GENERATED_FRAMES_DIR, `${spec.clipId}.mp4`);
  fs.writeFileSync(mp4Path, Buffer.from(videoData, 'base64'));

  try {
    await execFileAsync('/usr/bin/ffmpeg', [
      '-y',
      '-i',
      mp4Path,
      '-vf',
      'fps=8/3,scale=240:240:force_original_aspect_ratio=decrease,pad=240:240:(ow-iw)/2:(oh-ih)/2:color=0x00FF00,tile=8x1',
      '-frames:v',
      '1',
      outStrip,
    ]);
  } finally {
    if (fs.existsSync(croppedRef)) fs.unlinkSync(croppedRef);
  }
}

async function runAssetSyncPipeline(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || syncInProgress) return;
  syncInProgress = true;
  lastSyncError = null;

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
      },
    });

    for (const audioSpec of AUDIO_ASSET_SPECS) {
      try {
        await generateLyriaClip(ai, audioSpec);
      } catch (err) {
        lastSyncError = err instanceof Error ? err.message : String(err);
      }
    }

    for (const stripSpec of VIDEO_STRIP_SPECS) {
      try {
        await generateOmniFrameStrip(ai, stripSpec);
      } catch (err) {
        lastSyncError = err instanceof Error ? err.message : String(err);
      }
    }
  } finally {
    syncInProgress = false;
  }
}

async function bootstrapServer(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.get('/api/assets/manifest', (_req, res) => {
    res.json(listExistingManifest());
  });

  app.post('/api/assets/sync', (_req, res) => {
    if (!process.env.GEMINI_API_KEY) {
      res.status(200).json({
        ok: false,
        reason: 'missing_api_key',
        manifest: listExistingManifest(),
      });
      return;
    }
    void runAssetSyncPipeline();
    res.json({
      ok: true,
      started: true,
      manifest: listExistingManifest(),
    });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(ROOT_DIR, 'dist');
    app.use(express.static(path.join(ROOT_DIR, 'public')));
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Silver Echo server listening on http://0.0.0.0:${port}`);
    if (process.env.GEMINI_API_KEY) {
      void runAssetSyncPipeline();
    }
  });
}

void bootstrapServer();
