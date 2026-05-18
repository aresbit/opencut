# pycut

> Apple Silicon Mac 向けの AI 動画クリッピングツール。

**言語:** [English](README.md) | [中文](README.zh-CN.md) | [Deutsch](README.de.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

`pycut` は長尺の動画や音声を文字起こしし、OpenAI 互換 LLM で見どころを抽出し、字幕・タイムライン・焼き込み動画を CLI ひとつで出力します。

## 主な機能

- Apple Silicon 向け MLX ベースのローカル ASR
- AI によるハイライト抽出とタイトル生成
- 翻訳と二言語字幕レイアウト
- 字幕内キーワードのハイライト
- `srt`、`ass`、`fcpxml`、`video`、`txt`、`json` を出力
- 横向き・縦向きの両方に対応
- 既存の transcript JSON を再利用して ASR を省略可能

## 動作要件

| 項目 | 要件 |
| --- | --- |
| OS | Apple Silicon (`arm64` / `aarch64`) の macOS |
| Python | 3.12+ |
| FFmpeg | インストール済みで `PATH` にあること |
| API キー | AI クリップ抽出、キーワードハイライト、文字起こし補正時のみ必要 |

## インストール

### 1. FFmpeg をインストール

```bash
brew install ffmpeg
```

### 2. `pycut` をインストール

通常利用では次を推奨します:

```bash
uv tool install https://github.com/cliptate/pycut.git
```

インストール後は `pycut` をそのまま実行できます:

```bash
pycut --help
```

更新時も `uv tool` で再インストールまたはアップグレードできます。

### 3. ローカル開発用にリポジトリをクローン

```bash
git clone https://github.com/cliptate/pycut.git
cd pycut
```

ローカル開発では:

```bash
uv sync
```

その後、チェックアウトしたディレクトリで次を実行します:

```bash
uv run pycut --help
```

## API キー設定

```bash
export OPENAI_API_KEY="your_api_key_here"
```

Gemini や DeepSeek などの OpenAI 互換 API を使う場合は `--base-url` を指定します。

## クイックスタート

ハイライトを抽出して動画と字幕を出力:

```bash
pycut my_video.mp4 \
  --api-key YOUR_KEY \
  --format video,srt
```

字幕のみ生成:

```bash
pycut my_video.mp4 --no-clip --format srt
```

## よく使うオプション

| オプション | デフォルト | 説明 |
| --- | --- | --- |
| `--transcript` | なし | 既存の transcript JSON を再利用 |
| `--format` | `srt` | 出力形式: `ass,srt,fcpxml,video,txt,json` |
| `--api-key` | 環境変数またはなし | OpenAI 互換 API キー |
| `--no-clip` | off | AI ハイライト抽出を無効化し、全文タイムラインを保持 |
| `--highlight` | off | `--no-clip` モードでキーワードをハイライト |
| `--correct-words` | off | LLM で ASR の誤りを補正 |
| `--translate` | off | 字幕翻訳を有効化 |
| `--source-lang` | `en` | 入力言語。既定は英語 |
| `--target-lang` | `en` | 出力言語 |
| `--orientation` | `landscape` | `landscape` または `portrait` |

## 出力形式

| 形式 | 説明 |
| --- | --- |
| `srt` | 標準字幕ファイル |
| `ass` | スタイル付き字幕 |
| `fcpxml` | Final Cut Pro / DaVinci Resolve 向けタイムライン |
| `video` | 字幕焼き込み済み MP4 |
| `txt` | プレーンテキストの文字起こし |
| `json` | `--transcript` で再利用できる JSON |

## 例

縦動画 + 二言語字幕:

```bash
pycut lecture.mp4 \
  --api-key YOUR_KEY \
  --orientation portrait \
  --translate \
  --source-lang en \
  --target-lang zh-CN \
  --format video,ass
```

ソースコードのチェックアウトから実行する場合は、`pycut` を `uv run pycut` に置き換えてください。

## パイプライン

```text
メディア入力
  -> 音声抽出
  -> ASR + アラインメント
  -> 必要に応じて AI ハイライト / キーワード / 補正
  -> 字幕生成
  -> SRT / ASS / FCPXML / MP4 / TXT / JSON を出力
```

## License

MIT
