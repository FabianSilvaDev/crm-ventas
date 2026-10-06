@echo off
setlocal

REM Levanta API + frontend usando Node.js portable (para CMD/PowerShell).
REM No requiere permisos de administrador.

set NODE_VERSION=v22.23.3
set NODE_ZIP=node-%NODE_VERSION%-win-x64.zip
set NODE_DIR=%TEMP%\node-%NODE_VERSION%-win-x64
set NODE_URL=https://nodejs.org/dist/%NODE_VERSION%/%NODE_ZIP%

if not exist "%NODE_DIR%" (
  echo Descargando Node.js %NODE_VERSION% portable...
  curl -L %NODE_URL% -o "%TEMP%\%NODE_ZIP%"
  echo Extrayendo...
  tar -xf "%TEMP%\%NODE_ZIP%" -C "%TEMP%"
  del "%TEMP%\%NODE_ZIP%"
)

set "PATH=%NODE_DIR%;%PATH%"

echo Node.js:
node -v
echo pnpm:
pnpm -v

echo Instalando dependencias...
pnpm install --frozen-lockfile

echo Levantando API (http://localhost:3000) y frontend (http://localhost:4200)...
pnpm --filter @crm/api exec concurrently -n API,WEB -c cyan,magenta "pnpm --filter @crm/api dev" "pnpm --filter @crm/web dev"
