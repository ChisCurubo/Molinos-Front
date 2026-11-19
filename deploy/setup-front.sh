#!/usr/bin/env bash
# Despliega el front (Caddy + build de React). Lo llaman cloud-init y /opt/molinos/update.sh.
# MODO se detecta solo; se puede forzar: MODO=local bash deploy/setup-front.sh
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -z "${MODO:-}" ]; then
  if hostname -I 2>/dev/null | grep -qw '10.0.1.20'; then MODO=oracle; else MODO=local; fi
fi
export MODO

if [ "$MODO" = oracle ]; then
  ENVFILE=/opt/molinos/front.compose.env
  # shellcheck disable=SC1091
  . /opt/molinos/front.env   # define BACK_IP
  PUBLIC_IP="$(curl -s --max-time 10 https://api.ipify.org)"
  [ -n "$PUBLIC_IP" ] || { echo "[molinos] no pude obtener la IP pública"; exit 1; }
  SITE="${SITE:-${PUBLIC_IP//./-}.sslip.io}"
  cat > "$ENVFILE" <<EOF
MODO=oracle
SITE=$SITE
PUBLIC_IP=$PUBLIC_IP
BACK_UPSTREAM=${BACK_IP}:3005
HTTP_PORT=80
EOF
  URL="https://$SITE"
else
  ENVFILE="$DIR/.env.compose.local"   # ignorado por git (*.local)
  cat > "$ENVFILE" <<EOF
MODO=local
SITE=:80
PUBLIC_IP=
BACK_UPSTREAM=host.docker.internal:3005
HTTP_PORT=8080
EOF
  URL="http://localhost:8080"
fi

docker compose -p molinos-front --env-file "$ENVFILE" -f "$DIR/docker-compose.yml" up -d --build
docker image prune -f >/dev/null

# Backend nuevo: /api/v1/health responde 200 sin token. Backend viejo: da 404 y se prueba
# /api/v1/info/health, donde 200 o 401 (sin token) también significan "vivo y con proxy bien".
vivo() {
  local c
  c="$(curl -sk --max-time 5 -o /dev/null -w '%{http_code}' "$URL/api/v1/health" || true)"
  [ "$c" = 200 ] && { code=$c; return 0; }
  c="$(curl -sk --max-time 5 -o /dev/null -w '%{http_code}' "$URL/api/v1/info/health" || true)"
  code=$c
  [ "$c" = 200 ] || [ "$c" = 401 ]
}
code=000
echo "[molinos] esperando $URL/api/v1/health ..."
for _ in $(seq 1 24); do
  if vivo; then
    echo "[molinos] frontend listo en $URL (API respondió $code)"
    exit 0
  fi
  sleep 5
done

echo "[molinos] no respondió en 2 min (último código: $code). Logs de Caddy:"
docker compose -p molinos-front --env-file "$ENVFILE" -f "$DIR/docker-compose.yml" logs --tail 40 web
if [ "$MODO" = oracle ]; then
  echo "[molinos] Plan B (nip.io): SITE=${PUBLIC_IP//./-}.nip.io sudo -E bash $DIR/setup-front.sh"
fi
exit 1
