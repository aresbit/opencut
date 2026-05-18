# pycut

> KI-gestütztes Video-Clipping für Apple-Silicon-Macs.

**Sprachen:** [English](README.md) | [中文](README.zh-CN.md) | [Deutsch](README.de.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

`pycut` transkribiert lange Video- oder Audiodateien, extrahiert mit einem OpenAI-kompatiblen LLM interessante Highlights und exportiert Untertitel, Timelines oder eingebrannte Videos über eine einzige CLI.

## Funktionen

- Lokale ASR auf Apple Silicon mit MLX-Modellen
- KI-gestützte Highlight-Erkennung und automatische Titel
- Ubersetzung und zweisprachige Untertitel
- Hervorhebung wichtiger Schlüsselwörter in Untertiteln
- Export nach `srt`, `ass`, `fcpxml`, `video`, `txt`, `json`
- Unterstützung für Querformat und Hochformat
- Wiederverwendung von Transkript-JSON, um ASR zu überspringen

## Voraussetzungen

| Punkt | Anforderung |
| --- | --- |
| Betriebssystem | macOS auf Apple Silicon (`arm64` / `aarch64`) |
| Python | 3.12+ |
| FFmpeg | Muss installiert und in `PATH` verfügbar sein |
| API-Key | Nur für KI-Clipping, Keyword-Highlighting oder Transkriptkorrektur erforderlich |

## Installation

### 1. FFmpeg installieren

```bash
brew install ffmpeg
```

### 2. `pycut` installieren

Für die normale Nutzung empfohlen:

```bash
uv tool install https://github.com/cliptate/pycut.git
```

Danach kannst du `pycut` direkt ausführen:

```bash
pycut --help
```

Für spätere Updates kannst du das Tool mit `uv tool` erneut installieren oder aktualisieren.

### 3. Repository für lokale Entwicklung klonen

```bash
git clone https://github.com/cliptate/pycut.git
cd pycut
```

Für lokale Entwicklung:

```bash
uv sync
```

Danach die CLI im Checkout starten mit:

```bash
uv run pycut --help
```

## API-Key konfigurieren

```bash
export OPENAI_API_KEY="your_api_key_here"
```

Mit `--base-url` lassen sich auch Gemini, DeepSeek oder andere OpenAI-kompatible Anbieter nutzen.

## Schnellstart

Highlights extrahieren und Video plus Untertitel exportieren:

```bash
pycut my_video.mp4 \
  --api-key YOUR_KEY \
  --format video,srt
```

Nur Untertitel erzeugen:

```bash
pycut my_video.mp4 --no-clip --format srt
```

## Wichtige Optionen

| Option | Standard | Beschreibung |
| --- | --- | --- |
| `--transcript` | keiner | Vorhandenes Transkript-JSON wiederverwenden |
| `--format` | `srt` | Ausgabeformate: `ass,srt,fcpxml,video,txt,json` |
| `--api-key` | Umgebungsvariable oder keiner | OpenAI-kompatibler API-Key |
| `--no-clip` | aus | Keine KI-Highlight-Auswahl, komplette Timeline behalten |
| `--highlight` | aus | Schlüsselwörter im `--no-clip`-Modus markieren |
| `--correct-words` | aus | ASR-Fehler per LLM korrigieren |
| `--translate` | aus | Untertitel übersetzen |
| `--source-lang` | `en` | Quellsprache, Englisch ist Standard |
| `--target-lang` | `en` | Zielsprache |
| `--orientation` | `landscape` | `landscape` oder `portrait` |

## Ausgabeformate

| Format | Beschreibung |
| --- | --- |
| `srt` | Standard-Untertitel |
| `ass` | Formatierte Untertitel mit Highlighting |
| `fcpxml` | Timeline für Final Cut Pro / DaVinci Resolve |
| `video` | MP4 mit eingebrannten Untertiteln |
| `txt` | Reines Transkript |
| `json` | Zeitgestempeltes Transkript für `--transcript` |

## Beispiel

Hochformat mit zweisprachigen Untertiteln:

```bash
pycut lecture.mp4 \
  --api-key YOUR_KEY \
  --orientation portrait \
  --translate \
  --source-lang en \
  --target-lang zh-CN \
  --format video,ass
```

Wenn du aus dem Quellcode-Checkout arbeitest, ersetze `pycut` durch `uv run pycut`.

## Pipeline

```text
Medien
  -> Audio-Extraktion
  -> ASR + Alignment
  -> optional KI-Highlights / Keywords / Korrekturen
  -> Untertitel-Generierung
  -> Export als SRT / ASS / FCPXML / MP4 / TXT / JSON
```

## License

MIT
