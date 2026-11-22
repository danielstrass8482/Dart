#!/usr/bin/env bash
# Prüft, ob die Firebase-Auth-Anbieter aktiv sind, auf die die App angewiesen ist
# (Gast-Flow = anonyme Anmeldung, js/firebase.js signInAsGuest()).
# Hintergrund: Im Projekt darttrainer-app-fed88 war die anonyme Anmeldung seit
# Anlage der Auth-Config (2026-06-27) nie aktiviert — Gast-Login schlug mit
# auth/admin-restricted-operation fehl, bis sie am 2026-11-22 aktiviert wurde.
#
#   bash scripts/check-auth-providers.sh          # nur prüfen (Exit 1 bei Fehler)
#   bash scripts/check-auth-providers.sh --fix    # fehlende anonyme Anmeldung aktivieren
set -euo pipefail
PROJECT="${PROJECT:-darttrainer-app-fed88}"
API="https://identitytoolkit.googleapis.com/admin/v2/projects/$PROJECT/config"
TOKEN="$(gcloud auth print-access-token)"
H=(-H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: $PROJECT")

cfg="$(curl -sf "${H[@]}" "$API")"
anon="$(printf '%s' "$cfg" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("signIn",{}).get("anonymous",{}).get("enabled",False))')"
email="$(printf '%s' "$cfg" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("signIn",{}).get("email",{}).get("enabled",False))')"
echo "[$PROJECT] anonymous=$anon email=$email"

if [[ "$anon" != "True" ]]; then
  if [[ "${1:-}" == "--fix" ]]; then
    curl -sf -X PATCH "${H[@]}" -H "Content-Type: application/json" \
      "$API?updateMask=signIn.anonymous.enabled" -d '{"signIn":{"anonymous":{"enabled":true}}}' >/dev/null
    echo "anonyme Anmeldung aktiviert"
  else
    echo "FEHLER: anonyme Anmeldung deaktiviert — Gast-Login kaputt (mit --fix aktivieren)" >&2
    exit 1
  fi
fi
[[ "$email" == "True" ]] || { echo "FEHLER: E-Mail/Passwort-Anmeldung deaktiviert" >&2; exit 1; }
