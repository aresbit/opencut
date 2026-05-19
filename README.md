# opencut

> AI-powered video clipping CLI, written in TypeScript and runnable as a single spawn-friendly `dist/cli.js`.

`opencut` transcribes long-form video or audio, extracts highlight-worthy moments via an OpenAI-compatible LLM, and exports subtitles, timelines, or burned-in videos from a single CLI.

## Features

- Cross-platform ASR via [whisper.cpp](https://github.com/ggerganov/whisper.cpp) (through `smart-whisper`)
- AI highlight extraction and auto-generated titles via any OpenAI-compatible API
- Translation and bilingual subtitle layouts via `@vitalets/google-translate-api`
- Keyword highlighting for important words inside subtitles
- Multiple export targets: `srt`, `ass`, `fcpxml`, `video`, `txt`, `json`
- Landscape and portrait output
- Transcript JSON reuse to skip ASR on reruns
- Pluggable backends — bring your own ASR, VAD, or translation provider

## Requirements

| Item | Requirement |
| --- | --- |
| Runtime | Node 20+ or Bun 1.2+ (development uses Bun) |
| FFmpeg | `ffmpeg` and `ffprobe` on `PATH` |
| Whisper model | A whisper.cpp GGML model (e.g. `ggml-large-v3-turbo.bin`) |
| API key | Required only for AI highlight extraction, keyword highlighting, or transcript correction |

## Install

```bash
bun install
bun run build
```

Optional native backends — install only the ones you actually use:

```bash
# Whisper.cpp in-process ASR (provides word timestamps)
bun add smart-whisper

# Silero VAD (if you want per-utterance chunking before ASR)
bun add @ricky0123/vad-node onnxruntime-node
```

Download a whisper.cpp model file from the [ggerganov/whisper.cpp releases](https://huggingface.co/ggerganov/whisper.cpp/tree/main) and either pass `--asr-model /path/to/ggml-…bin` or export `PYCUT_WHISPER_MODEL=/path/to/ggml-…bin` (the `PYCUT_` env-var prefix is kept for backwards compatibility).

## Configure an API key

```bash
export OPENAI_API_KEY="your_api_key_here"
```

Or pass `--api-key` per invocation. To use a compatible provider such as Gemini or DeepSeek, add `--base-url` and optionally `--model`:

```bash
# Gemini
./dist/cli.js input.mp4 \
  --api-key YOUR_KEY \
  --base-url https://generativelanguage.googleapis.com/v1beta/openai

# DeepSeek
./dist/cli.js input.mp4 \
  --api-key YOUR_KEY \
  --base-url https://api.deepseek.com \
  --model deepseek-v4-flash
```

## Quick start

Extract AI-selected highlights and export a rendered video plus subtitles:

```bash
./dist/cli.js my_video.mp4 \
  --asr-model /models/ggml-large-v3-turbo.bin \
  --api-key YOUR_KEY \
  --format video,srt
```

Generate subtitles only, without highlight clipping:

```bash
./dist/cli.js my_video.mp4 \
  --asr-model /models/ggml-large-v3-turbo.bin \
  --no-clip --format srt
```

Create bilingual subtitles:

```bash
./dist/cli.js my_video.mp4 \
  --asr-model /models/ggml-large-v3-turbo.bin \
  --translate \
  --source-lang en \
  --target-lang zh-CN \
  --format video,srt
```

Export an FCPXML timeline:

```bash
./dist/cli.js my_video.mp4 \
  --asr-model /models/ggml-large-v3-turbo.bin \
  --api-key YOUR_KEY \
  --format fcpxml \
  --fcpxml-frame-rate 30
```

## Dev workflow

```bash
bun run dev <args>      # run TS directly, no build
bun test                # run vitest-style bun:test suite
bun run typecheck       # tsc --noEmit
bun run lint            # biome check
bun run build           # bundle to dist/cli.js (Node target, shebang)
```

## Spawn from another tool

`dist/cli.js` has a `#!/usr/bin/env node` shebang. Any process can spawn it:

```ts
import { spawn } from "node:child_process";

const child = spawn("node", ["./dist/cli.js", "video.mp4", "--format", "srt"]);
```

## CLI usage

```text
./dist/cli.js <video-file|directory|glob> [options]
```

Input expansion supports:

- A single file: `video.mp4`
- A directory: `./videos/`
- A glob: `./recordings/*.mp4`
- Multiple inputs: `a.mp4 b.mp4 c.mp4`

Supported media extensions:

- Video: `mp4`, `mov`, `mkv`, `avi`, `m4v`, `webm`
- Audio: `wav`, `mp3`, `m4a`, `aac`, `flac`, `ogg`

Run `./dist/cli.js --help` for the full flag list.

## Output formats

| Format | Description |
| --- | --- |
| `srt` | Standard subtitle file |
| `ass` | Styled subtitle file with bilingual layout and highlighting |
| `fcpxml` | Timeline export for Final Cut Pro / DaVinci Resolve |
| `video` | Burned-in MP4 output |
| `txt` | Plain transcript |
| `json` | Timestamped transcript JSON reusable with `--transcript` |

## Pipeline

```text
media
  -> audio extraction (ffmpeg)
  -> ASR + word timestamps (whisper.cpp via smart-whisper)
  -> optional LLM highlight extraction / keyword detection / transcript correction
  -> subtitle generation
  -> SRT / ASS / FCPXML / MP4 / TXT / JSON outputs
```

## License

MIT
