#!/usr/bin/env bash
# setup-voice-qa.sh — (re)creates the voice-QA toolchain OUTSIDE /home (small disk):
#   /var/tmp/whisper-venv  faster-whisper + imageio-ffmpeg (STT for check-voice-clips.js, ffmpeg for gen-voice-assets.js)
#   /var/tmp/hf            Whisper models (small.en, medium.en; downloaded on first use)
#   /var/tmp/nm-clips      playwright for tests/, linked as ./node_modules
# Cloud Shell wipes /var/tmp on restart → just run this again. Idempotent.
# Afterwards:  export HF_HOME=/var/tmp/hf FFMPEG="$(/var/tmp/whisper-venv/bin/python -c 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())')"
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -x /var/tmp/whisper-venv/bin/python ] || ! /var/tmp/whisper-venv/bin/python -c "import faster_whisper, imageio_ffmpeg" 2>/dev/null; then
  python3 -m venv /var/tmp/whisper-venv
  PIP_CACHE_DIR=/var/tmp/pip-cache /var/tmp/whisper-venv/bin/pip install -q faster-whisper imageio-ffmpeg
  rm -rf /var/tmp/pip-cache
fi
if [ ! -d /var/tmp/nm-clips/node_modules/playwright ]; then
  mkdir -p /var/tmp/nm-clips
  (cd /var/tmp/nm-clips && npm_config_cache=/var/tmp/npm-cache npm install --no-save --no-audit --no-fund playwright@1.65.1 >/dev/null)
  rm -rf /var/tmp/npm-cache
fi
[ -e node_modules ] && [ ! -L node_modules ] || ln -sfn /var/tmp/nm-clips/node_modules node_modules
echo "voice-QA toolchain ready: $(/var/tmp/whisper-venv/bin/python -c 'import faster_whisper;print("faster-whisper", faster_whisper.__version__)')"
