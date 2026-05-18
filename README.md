# pycut

> 基于 AI 的视频自动剪辑工具，专为 Apple Silicon Mac 打造。

pycut 能够自动将长视频转录、分析，提取精华片段，并生成带有双语字幕的短视频——无需手动剪辑，一条命令搞定。

## 功能特性

- **🎙️ 本地语音识别**：基于 MLX 的 Parakeet 模型，在 Apple Silicon 上完全本地运行，无需联网
- **🤖 AI 精华提取**：通过 OpenAI 兼容 API 分析内容，自动识别最具价值的片段并生成标题（支持 OpenAI、Gemini、DeepSeek、Ollama 等）
- **🌐 多语言字幕**：支持翻译与双语字幕叠加，可配置显示位置
- **🔑 关键词高亮**：AI 自动识别每段字幕中的核心关键词并以高亮样式标注
- **📁 多种输出格式**：支持 SRT、ASS、FCPXML（Final Cut Pro/DaVinci Resolve）、MP4、TXT、JSON
- **↕️ 横竖屏支持**：自动适配横屏与竖屏布局（含黑边填充）
- **📦 内存高效**：按需加载/卸载模型，适合长视频批量处理
- **🔄 断点复用**：可使用已有转录 JSON 跳过 ASR，加速二次处理

## 系统要求

| 项目 | 要求 |
|------|------|
| 操作系统 | macOS（Apple Silicon，即 M 系列芯片）|
| Python | ≥ 3.12（推荐通过 [uv](https://github.com/astral-sh/uv) 或 [Homebrew](https://brew.sh) 安装）|
| FFmpeg | 需要安装并在 PATH 中可用（`brew install ffmpeg`）|
| Gemini API Key | **仅在使用 AI 精华提取或关键词高亮时需要**（支持任何 OpenAI 兼容 API）；纯字幕生成（`--no-clip`）无需该 Key |

> **注意**：pycut 目前仅支持 macOS + Apple Silicon（arm64），不支持 Intel Mac 或 Linux。

## 安装

### 1. 安装 FFmpeg

```bash
brew install ffmpeg
```

### 2. 安装 pycut

推荐使用 [uv](https://github.com/astral-sh/uv) 管理依赖（会自动安装所需 Python 版本）：

```bash
# 克隆仓库
git clone https://github.com/sysulq/pycut.git
cd pycut

# 安装依赖（开发模式，不提供 pycut 命令）
uv sync --prerelease=allow
```

也可以作为工具安装（提供 `pycut` 命令）：

```bash
uv tool install . --prerelease=allow
```

或者使用 pip：

```bash
pip install -e .
```

### 3. 配置 API Key（可选，用于 AI 精华提取）

```bash
export OPENAI_API_KEY="your_api_key_here"
```

或者在每次运行时通过 `--api-key` 参数传入。如需使用其他 OpenAI 兼容 API，可通过 `--base-url` 指定：

```bash
# 使用 Gemini
pycut my_video.mp4 --api-key YOUR_KEY --base-url https://generativelanguage.googleapis.com/v1beta/openai

# 使用 DeepSeek
pycut my_video.mp4 --api-key YOUR_KEY --base-url https://api.deepseek.com --model deepseek-chat
```

## 快速开始

### 提取精华片段（需要 API Key）

```bash
pycut my_video.mp4 --api-key YOUR_KEY --format video,srt
```

### 生成字幕文件（不剪辑）

```bash
pycut my_video.mp4 --no-clip --format srt
```

### 中英双语字幕

```bash
pycut my_video.mp4 \
  --translate \
  --source-lang en \
  --target-lang zh-CN \
  --format video,srt
```

### 导出 FCPXML 到 Final Cut Pro

```bash
pycut my_video.mp4 \
  --api-key YOUR_KEY \
  --format fcpxml \
  --fcpxml-frame-rate 30.0
```

## 详细使用说明

### 基本语法

```
pycut <视频文件/目录/通配符> [选项]
```

> **兼容说明**：也可继续使用 `python main.py ...`（效果相同）。

`video_inputs` 支持：
- 单个文件：`video.mp4`
- 目录：`./videos/`（自动扫描所有支持的视频/音频格式）
- 通配符：`./recordings/*.mp4`
- 多个路径：`a.mp4 b.mp4 c.mp4`

支持的格式：MP4、MOV、MKV、AVI、M4V、WebM、WAV、MP3、M4A、AAC、FLAC、OGG

### 全部参数

#### 输入 / 输出

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `video_inputs` | — | 视频文件、目录或通配符（必填）|
| `-o, --output-dir` | 输入文件同级的同名目录 | 输出目录；未传时默认在每个输入媒体文件旁创建一个与文件名同名的目录（去掉扩展名）并将所有产物放进去 |
| `--transcript JSON_FILE` | — | 使用已有转录 JSON，跳过 ASR |
| `--format` | `srt` | 输出格式，逗号分隔（`ass,srt,fcpxml,video,txt,json`）|

#### 语音识别（ASR）

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--asr-model` | 按 `source-lang` 自动选择 | ASR 模型路径；英文默认 `mlx-community/parakeet-tdt-0.6b-v3`，中文默认 `mlx-community/Qwen3-ASR-1.7B-bf16`，其他语言默认 `mlx-community/whisper-large-v3-turbo` |
| `--aligner-model` | `mlx-community/Qwen3-ForcedAligner-0.6B-8bit` | 对齐模型路径 |
| `--segment-duration` | `300` | 音频分段时长（秒），用于超长视频 |
| `--no-filter-fillers` | — | 禁用口语词过滤（如"嗯"、"啊"）|

#### AI 分析（需要 API Key）

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--api-key` | — | OpenAI 兼容 API Key（也可通过 `OPENAI_API_KEY` 环境变量设置）|
| `--base-url` | `https://api.openai.com/v1` | OpenAI 兼容 API 的 Base URL |
| `--model` | `gpt-4o-mini` | LLM 模型名称 |
| `--no-clip` | — | 禁用 AI 精华提取，输出完整视频字幕（**不需要 API Key**）|
| `--highlight` | — | 在 `--no-clip` 模式下启用关键词高亮（需要 API Key；必须与 `--no-clip` 一起使用）|

#### 字幕

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--max-duration` | `30.0` | 单段字幕最大时长（秒）|
| `--max-chars` | `30` | 单段字幕最大字符数 |
| `--translate` | — | 启用字幕翻译 |
| `--source-lang` | `en` | 源语言代码（如 `zh-CN`、`en`、`ja`）|
| `--target-lang` | `en` | 目标语言代码 |
| `--subtitle-position` | `translated-top` | 双语字幕布局：`translated-top`（译文在上）或 `original-top`（原文在上）|
| `--first-subtitle-delay` | `0.01` | 首帧字幕延迟（秒），用于封面帧效果 |
| `--max-title-chars` | `6` | 标题最大字符数 |
| `--max-subtitle-chars` | `10` | 副标题最大字符数 |
| `--no-filter-empty-segments` | — | 保留空内容的字幕段 |
| `--margin-left` | `-100` | 字幕段左边距调整（毫秒，负值表示提前）|
| `--margin-right` | `150` | 字幕段右边距调整（毫秒）|

#### 视频渲染

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--orientation` | `landscape` | 视频方向：`landscape`（横屏）或 `portrait`（竖屏）|

#### FCPXML 导出

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--fcpxml-frame-rate` | `25.0` | FCPXML 帧率 |
| `--fcpxml-speed` | `1.0` | 时间线速度倍数（如 `1.1` 表示 1.1 倍速）|

### 输出格式说明

| 格式 | 说明 |
|------|------|
| `srt` | 标准字幕文件，可用于大多数播放器 |
| `ass` | 高级字幕格式，含样式（颜色、字体、双语布局）|
| `fcpxml` | Final Cut Pro / DaVinci Resolve 时间线文件 |
| `video` | 渲染并烧录字幕的 MP4 视频文件 |
| `txt` | 纯文本转录稿 |
| `json` | 带时间戳的转录 JSON，可用于 `--transcript` 复用 |

## 使用示例

### 示例 1：批量处理目录中所有视频

```bash
pycut ./recordings/ \
  --api-key YOUR_KEY \
  --format video,srt,json \
  -o ./output
```

### 示例 2：竖屏短视频 + 中英双语字幕

```bash
pycut lecture.mp4 \
  --gemini-api-key YOUR_KEY \
  --orientation portrait \
  --translate \
  --source-lang en \
  --target-lang zh-CN \
  --subtitle-position translated-top \
  --format video,ass
```

### 示例 3：复用已有转录，不重新跑 ASR

```bash
# 首次处理，保存 JSON
pycut video.mp4 --format json -o ./output

# 再次处理，跳过 ASR
pycut video.mp4 \
  --transcript ./output/video.json \
  --gemini-api-key YOUR_KEY \
  --format video,srt
```

### 示例 4：不剪辑，仅生成带关键词高亮的字幕

```bash
pycut interview.mp4 \
  --no-clip \
  --highlight \
  --gemini-api-key YOUR_KEY \
  --format ass,srt
```

### 示例 5：导出 FCPXML 用于 Final Cut Pro 剪辑

```bash
pycut keynote.mp4 \
  --gemini-api-key YOUR_KEY \
  --format fcpxml \
  --fcpxml-frame-rate 29.97 \
  --fcpxml-speed 1.0 \
  -o ./fcp_project
```

### 示例 6：剪辑中文视频/音频，翻译为英文并导出 FCPXML

```bash
pycut --translate \
  --source-lang zh \
  --target-lang en \
  --max-chars 10 \
  --format fcpxml \
  ~/Movies/vad_example.wav \
  -o ~/Movies/youtube/ \
  --no-clip \
  --highlight
```

### 示例 7：剪辑英文视频目录，翻译为中文并导出竖屏视频

```bash
pycut --translate \
  --source-lang en \
  --target-lang zh \
  --max-chars 50 \
  --format video \
  --highlight \
  --orientation portrait \
  ~/Movies/youtube/
```

## 工作流程

```
视频文件
    │
    ▼
[音频提取]
    │
    ▼
[ASR 语音转录] ──────── mlx-community/parakeet-tdt-0.6b-v3
    │                   mlx-community/Qwen3-ForcedAligner-0.6B-8bit
    ▼
[内容分析] ──────────── Google Gemini API
    │   ├── AI 精华片段提取（--clip，默认）
    │   └── 关键词高亮（--highlight，用于 --no-clip 模式）
    ▼
[字幕生成] ──────────── 支持翻译、双语布局、关键词高亮
    │
    ▼
[输出]
    ├── SRT / ASS 字幕
    ├── FCPXML 时间线
    ├── 渲染视频（MP4）
    ├── 文本转录稿
    └── 转录 JSON
```

## License

MIT
