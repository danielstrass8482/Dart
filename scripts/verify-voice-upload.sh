#!/usr/bin/env bash
# Compares MD5 of every local clip assets/voice/<voice>/*.mp3 with Storage dart_voice_pkg/<voice>/ (after upload-voice-assets.js). Run from repo root.
# usage: qa/.verify-upload.sh <voice>  → compares MD5 of every local clip with dart_voice_pkg/<voice>/
export LC_ALL=C
v=$1
gcloud storage objects list "gs://darttrainer-app-fed88.firebasestorage.app/dart_voice_pkg/$v/*.mp3" --format="value(name,md5_hash)" | sed 's|^dart_voice_pkg/[^/]*/||' | sort > /var/tmp/remote-$v.txt
(cd assets/voice/$v && for f in *.mp3; do printf "%s\t%s\n" "$f" "$(openssl md5 -binary "$f" | base64)"; done) | sort > /var/tmp/local-$v.txt
echo "$v: lokal $(wc -l < /var/tmp/local-$v.txt), remote $(wc -l < /var/tmp/remote-$v.txt), abweichend $(comm -3 /var/tmp/local-$v.txt /var/tmp/remote-$v.txt | wc -l)"
rm -f /var/tmp/remote-$v.txt /var/tmp/local-$v.txt
