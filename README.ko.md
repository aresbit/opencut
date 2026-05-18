# pycut

> Apple Silicon Mac용 AI 비디오 클리핑 도구.

**언어:** [English](README.md) | [中文](README.zh-CN.md) | [Deutsch](README.de.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

`pycut`은 긴 영상이나 오디오를 전사하고, OpenAI 호환 LLM으로 하이라이트 구간을 추출한 뒤, 자막, 타임라인, 자막이 입혀진 비디오를 하나의 CLI로 내보냅니다.

## 주요 기능

- Apple Silicon에 최적화된 MLX 기반 로컬 ASR
- AI 하이라이트 추출 및 제목 생성
- 번역과 이중 언어 자막 레이아웃 지원
- 자막 키워드 하이라이트 지원
- `srt`, `ass`, `fcpxml`, `video`, `txt`, `json` 출력 지원
- 가로/세로 출력 지원
- 기존 transcript JSON 재사용으로 ASR 생략 가능

## 요구 사항

| 항목 | 요구 사항 |
| --- | --- |
| OS | Apple Silicon(`arm64` / `aarch64`) 기반 macOS |
| Python | 3.12+ |
| FFmpeg | 설치되어 있고 `PATH`에서 접근 가능해야 함 |
| API 키 | AI 클리핑, 키워드 하이라이트, 전사 보정 시에만 필요 |

## 설치

### 1. FFmpeg 설치

```bash
brew install ffmpeg
```

### 2. `pycut` 설치

일반적인 사용에는 다음 방법을 권장합니다:

```bash
uv tool install https://github.com/cliptate/pycut.git
```

설치 후에는 `pycut`을 바로 실행할 수 있습니다:

```bash
pycut --help
```

업데이트할 때도 `uv tool`로 다시 설치하거나 업그레이드하면 됩니다.

### 3. 로컬 개발용으로 저장소 클론

```bash
git clone https://github.com/cliptate/pycut.git
cd pycut
```

로컬 개발용 설치:

```bash
uv sync
```

그다음 저장소 디렉터리에서 다음처럼 실행합니다:

```bash
uv run pycut --help
```

## API 키 설정

```bash
export OPENAI_API_KEY="your_api_key_here"
```

Gemini, DeepSeek 같은 OpenAI 호환 API를 쓰려면 `--base-url`을 함께 지정하면 됩니다.

## 빠른 시작

하이라이트를 추출하고 비디오와 자막 출력:

```bash
pycut my_video.mp4 \
  --api-key YOUR_KEY \
  --format video,srt
```

자막만 생성:

```bash
pycut my_video.mp4 --no-clip --format srt
```

## 자주 쓰는 옵션

| 옵션 | 기본값 | 설명 |
| --- | --- | --- |
| `--transcript` | 없음 | 기존 transcript JSON 재사용 |
| `--format` | `srt` | 출력 형식: `ass,srt,fcpxml,video,txt,json` |
| `--api-key` | 환경 변수 또는 없음 | OpenAI 호환 API 키 |
| `--no-clip` | 꺼짐 | AI 하이라이트 추출 비활성화, 전체 타임라인 유지 |
| `--highlight` | 꺼짐 | `--no-clip` 모드에서 키워드 하이라이트 |
| `--correct-words` | 꺼짐 | LLM으로 ASR 오인식 보정 |
| `--translate` | 꺼짐 | 자막 번역 활성화 |
| `--source-lang` | `en` | 원본 언어, 기본은 영어 |
| `--target-lang` | `en` | 대상 언어 |
| `--orientation` | `landscape` | `landscape` 또는 `portrait` |

## 출력 형식

| 형식 | 설명 |
| --- | --- |
| `srt` | 표준 자막 파일 |
| `ass` | 스타일 및 하이라이트가 포함된 자막 |
| `fcpxml` | Final Cut Pro / DaVinci Resolve용 타임라인 |
| `video` | 자막이 입혀진 MP4 |
| `txt` | 일반 텍스트 전사 |
| `json` | `--transcript`로 재사용 가능한 타임스탬프 JSON |

## 예시

세로형 이중 언어 자막:

```bash
pycut lecture.mp4 \
  --api-key YOUR_KEY \
  --orientation portrait \
  --translate \
  --source-lang en \
  --target-lang zh-CN \
  --format video,ass
```

소스 저장소에서 실행하는 경우에는 `pycut` 대신 `uv run pycut`을 사용하면 됩니다.

## 파이프라인

```text
미디어 입력
  -> 오디오 추출
  -> ASR + 정렬
  -> 선택적으로 AI 하이라이트 / 키워드 / 보정
  -> 자막 생성
  -> SRT / ASS / FCPXML / MP4 / TXT / JSON 출력
```

## License

MIT
