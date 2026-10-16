#!/usr/bin/env bash
# =========================================================
# Calm Haven — tarayıcı testlerini çalıştırır.
#
# Yerel bir statik sunucu başlatır, tarayıcı testlerini çalıştırır ve
# sunucuyu kapatır. Üretim uygulaması bu betiğe ihtiyaç duymaz.
#
# Kullanım: bash tests/run-browser.sh
# =========================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${CALM_PORT:-12000}"
URL="http://localhost:${PORT}/"

# Puppeteer kurulu mu?
if [ ! -d "${ROOT}/node_modules/puppeteer-core" ]; then
  echo "puppeteer-core bulunamadi. Kuruluyor (yalnizca gelistirme bagimliligi)..."
  (cd "${ROOT}" && npm install --no-audit --no-fund)
fi

# Chromium yolunu bul
if [ -n "${CHROME_PATH:-}" ] && [ -x "${CHROME_PATH}" ]; then
  export CHROME_PATH
elif command -v chromium >/dev/null 2>&1; then
  export CHROME_PATH="$(command -v chromium)"
elif command -v chromium-browser >/dev/null 2>&1; then
  export CHROME_PATH="$(command -v chromium-browser)"
elif command -v google-chrome >/dev/null 2>&1; then
  export CHROME_PATH="$(command -v google-chrome)"
else
  echo "Chromium bulunamadi. CHROME_PATH degiskenini ayarlayin."
  exit 1
fi
echo "Chromium: ${CHROME_PATH}"

# Sunucuyu baslat
(cd "${ROOT}" && python3 -m http.server "${PORT}" > /tmp/calm-haven-test-server.log 2>&1) &
SERVER_PID=$!
trap 'kill "${SERVER_PID}" 2>/dev/null' EXIT

# Sunucunun hazir olmasini bekle
for _ in $(seq 1 30); do
  if curl -sf -o /dev/null "${URL}"; then break; fi
  sleep 0.3
done

if ! curl -sf -o /dev/null "${URL}"; then
  echo "Sunucu ${URL} adresinde baslatilamadi."
  exit 1
fi

export CALM_URL="${URL}"
cd "${ROOT}" && node tests/browser.js
EXIT_CODE=$?
exit ${EXIT_CODE}
