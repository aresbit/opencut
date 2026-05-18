# Copilot Instructions for `pycut` (TypeScript)

## Commands

- Install dependencies for local development with `bun install`.
- Run the CLI during development with `bun run dev <args>` or `bun run src/cli.ts <args>`.
- Type-check with `bun run typecheck` (tsc --noEmit).
- Lint/format with `bun run lint` and `bun run format` (biome).
- Run the full test suite with `bun test`.
- Build the spawn-friendly executable with `bun run build`. The output is a
  single `dist/cli.js` with a Node-target shebang that Claude Code can spawn
  directly.

## High-level architecture

- `src/cli.ts` parses CLI flags via `commander`, expands inputs through
  `src/io/inputs.ts`, builds the ASR/analysis/translation backends, and hands
  each resolved media file to `processVideo` in `src/clipper/process.ts`.
- `src/clipper/process.ts` is the orchestrator. It owns the end-to-end pipeline:
  audio extraction → ASR (via `AsrHelper`) → optional LLM correction → subtitle
  segment cleanup → highlight extraction → subtitle/FCPXML/video generation.
- `src/asr/helper.ts` wraps a pluggable `AsrBackend` and optional `VadBackend`.
  Backends live in `src/asr/backends/`: `whisper.ts` lazy-imports
  `smart-whisper`, `silero-vad.ts` lazy-imports `@ricky0123/vad-node`. Neither
  package is a hard dependency — the user must install whichever they want.
- `src/analysis/` holds the OpenAI-compatible LLM integration. `client.ts`
  builds `AnalysisClient`, `prompts.ts` carries the Chinese prompt templates
  preserved verbatim from the Python version, and `sanitize.ts` narrows raw
  model output into typed shapes before downstream stages consume it.
- `src/subtitle/`, `src/fcpxml/`, and `src/renderer/` are the output stages.
  They consume `Segment` / `Highlight` data and emit SRT/ASS, FCPXML, or
  ffmpeg-rendered MP4 output. Renderer pad math, fcpxml time conversions, and
  ASS keyword highlighting all have dedicated tests.
- Transcript reuse is a first-class flow: `--transcript` loads prior JSON
  through `src/io/transcript.ts` so ASR is skipped on reruns.

## Key conventions

- Treat `src/clipper/process.ts` as the source of truth for workflow changes.
  If behavior spans ASR, LLM analysis, translation, and output generation, it
  is coordinated there rather than spread across entrypoints.
- Cross-platform by design — there is no Apple-Silicon-only guard. ffmpeg and
  ffprobe must still be on `PATH`; the renderer prefers `ffmpeg-full` over the
  default Homebrew bottle when available (see `src/renderer/select.ts`).
- ASR is backend-pluggable. The default `--asr-model` path points at a
  whisper.cpp GGML model. Users who want Silero VAD must install
  `@ricky0123/vad-node` themselves and wire it up via `createSileroVadBackend`.
- Output formats are validated centrally in `src/io/formats.ts`. Reuse
  `parseOutputFormats` / `normalizeOutputFormats`, and update
  `SUPPORTED_OUTPUT_FORMATS` / `DEFAULT_OUTPUT_FORMATS` there when adding new
  formats.
- Transcript JSON accepts both the legacy list form and the current object
  form (`{ title, subtitle, segments, highlights }`).
- Keyword highlighting flows through shared `Highlight.segment_keywords`
  metadata. `analysis/sanitize.ts` and `analysis/keywords.ts` produce
  `{ segment_id, keywords }` entries; `subtitle/ass.ts` and `fcpxml/title.ts`
  consume them using the original segment IDs to highlight only specific
  words rather than whole subtitle lines.
- Segment cleanup happens before exports. `filterSubtitleSegments` removes
  empty segments by default, and `resolveOverlaps` applies margin shifts plus
  midpoint overlap splitting. CLI margins are in milliseconds, converted to
  seconds inside `cli.ts` before being passed to `processVideo`.
- Tests live alongside the implementation as `*.test.ts` and run with
  `bun test`. Sanitizer, time-formatting, and XML-escape tests are the
  load-bearing ones — touch them whenever the corresponding output contract
  changes.
