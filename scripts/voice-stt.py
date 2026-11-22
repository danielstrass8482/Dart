#!/usr/bin/env python3
"""
voice-stt.py — local speech-to-text worker for scripts/check-voice-clips.js.

Reads JSON lines {"id": ..., "path": ...} on stdin, writes JSON lines
{"id": ..., "text": ..., "duration": <seconds>} on stdout (one per input,
same order). Model loaded once per process.

Uses faster-whisper (OpenAI Whisper, CTranslate2 int8 on CPU). Chosen over
ElevenLabs Speech-to-Text because the project's ElevenLabs key lacks the
`speech_to_text` permission (HTTP 401 "missing the permission
speech_to_text", checked 2026-11-22) — and a local model costs nothing,
so every re-check after a regeneration is free.

Deliberately NO initial_prompt / expected text is passed to Whisper: biasing
the recognizer toward the target text would hide exactly the extra words we
are trying to detect.

Setup (outside /home, which is small):
  python3 -m venv /var/tmp/whisper-venv
  /var/tmp/whisper-venv/bin/pip install faster-whisper imageio-ffmpeg
  export HF_HOME=/var/tmp/hf        # model cache (~0.5 GB small.en, ~1.5 GB medium.en)
Usage: <venv>/bin/python -I scripts/voice-stt.py --model=small.en < jobs.jsonl
"""
import json
import subprocess
import sys

import numpy as np
import imageio_ffmpeg
from faster_whisper import WhisperModel

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


def load_pcm(path):
    # Own decode via ffmpeg (faster-whisper's PyAV path breaks with some av versions).
    raw = subprocess.run([FFMPEG, "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0


def main():
    model_name = "small.en"
    threads = 4
    for a in sys.argv[1:]:
        if a.startswith("--model="):
            model_name = a.split("=", 1)[1]
        elif a.startswith("--threads="):
            threads = int(a.split("=", 1)[1])
    model = WhisperModel(model_name, device="cpu", compute_type="int8", cpu_threads=threads)
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        job = json.loads(line)
        out = {"id": job["id"]}
        try:
            audio = load_pcm(job["path"])
            segs, _info = model.transcribe(audio, language="en", beam_size=5, temperature=0,
                                           condition_on_previous_text=False, without_timestamps=True,
                                           vad_filter=False)
            out["text"] = " ".join(s.text.strip() for s in segs).strip()
            out["duration"] = round(len(audio) / 16000.0, 3)
        except Exception as e:  # report, never abort the whole batch
            out["error"] = str(e)[:300]
        sys.stdout.write(json.dumps(out, ensure_ascii=False) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
