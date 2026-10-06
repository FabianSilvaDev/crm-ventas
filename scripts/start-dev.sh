#!/usr/bin/env bash
# Levanta API + frontend usando Node.js portable (para Windows/Git Bash).
# No requiere permisos de administrador.

set -e

NODE_VERSION="v22.23.3"
NODE_ZIP="node-${NODE_VERSION}-win-x64.zip"
NODE_DIR="${TEMP}/node-${NODE_VERSION}-win-x64"
NODE_URL="https://nodejs.org/dist/${NODE_VERSION}/${NODE_ZIP}"

if [ ! -d "$NODE_DIR" ]; then
  echo "⬇️  Descargando Node.js ${NODE_VERSION} portable..."
  curl -L "$NODE_URL" -o "${TEMP}/${NODE_ZIP}"
  echo "📦 Extrayendo..."
  unzip -q "${TEMP}/${NODE_ZIP}" -d "$TEMP"
  rm "${TEMP}/${NODE_ZIP}"
fi

export PATH="${NODE_DIR}:${PATH}"

echo "🟢 Node.js: $(node -v)"
echo "🟢 pnpm:    $(pnpm.cmd -v)"

echo "📦 Instalando dependencias..."
pnpm.cmd install --frozen-lockfile

echo "🚀 Levantando API (http://localhost:3000) y frontend (http://localhost:4200)..."
# Se usa `pnpm run` directamente en cada paquete. `pnpm exec` dentro de un filtro cambia el cwd
# y rompe el `concurrently` anidado de la API, haciendo que `dev:build` y `dev:serve` salgan con
# código 1 sin mostrar el error real.
# `concurrently` está declarado en apps/api; usamos su binario directamente para no duplicar la
# dependencia en la raíz.
"${PWD}/apps/api/node_modules/.bin/concurrently" \
  -n API,WEB \
  -c cyan,magenta \
  "pnpm --filter @crm/api dev" \
  "pnpm --filter @crm/web dev"
