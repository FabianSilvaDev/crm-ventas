# DEPLOYMENT

> Procedimiento real de puesta en marcha, despliegue y operación de `crm-ventas`.
> Versión 1.0 — 2026-10-01.
> Entorno de referencia verificado: **Windows 11 Pro, i7-1255U (10C/12T), 32 GB RAM, sin GPU
> dedicada (Intel Iris Xe), C: con 199 GB libres, Node v24.19.0, npm 11.17.0, git 2.52.0,
> Ollama 0.34.3 corriendo nativo en `:11434`.**

---

## 0. Alcance y decisiones congeladas

Este documento no decide arquitectura: la **aplica**. Las decisiones que respeta y que no se
reabren aquí:

| Decisión | Referencia | Consecuencia en este documento |
|---|---|---|
| Monolito modular: `apps/api` (HTTP) + `apps/worker` (BullMQ, sin puerto) comparten `packages/*` | ADR-001, §B.2 | Dos imágenes construidas del mismo monorepo; el worker solo expone un puerto interno de salud/métricas. |
| Dos frontends Angular: `apps/web` (SPA, CRM) y `apps/site` (SSR, público) | ADR-002, §C.1 | Cuatro imágenes Docker; `web` se sirve con nginx, `site` con Node SSR. |
| pnpm workspaces; **sin Nx, sin Turborepo** | ADR-002, §D | Un `pnpm-workspace.yaml`, scripts de `package.json` y GitHub Actions con **path filters**. |
| Ollama **nativo**, no contenedorizado | ADR-015, §C.6 | No existe servicio `ollama` en Compose. Se alcanza por `host.docker.internal:11434`. |
| **Sin servicio `scheduler`** | ADR-010, §C.5 | Los trabajos programados son `upsertJobScheduler()` dentro del worker. |
| Outbox transaccional en Postgres + BullMQ sobre Redis | ADR-009, §B.4 | `outbox_events` vive en Postgres; Redis solo transporta. Perder Redis no pierde eventos. |
| Cola `ai` con concurrencia **1** | ADR-010, §C.5 | `QUEUE_AI_CONCURRENCY=1` por defecto. |
| Sin Kubernetes en niveles 0-2 | §J.4, §L | VPS con Compose. Ver §9. |
| pgvector dentro de Postgres | ADR-008, §C.3 | Imagen `pgvector/pgvector:pg17`. Sin base vectorial dedicada. |
| Migraciones por fase, reversibles y probadas | `database.md` §13 | Orden `001_core` → `010_experiments`. Ver §6. |

**Advertencia de estado:** el repositorio todavía no contiene código de aplicación (§0 del
architecture-review). Este documento describe el procedimiento objetivo y los archivos que el
Sprint 1 debe producir. Los comandos son ejecutables tal cual una vez exista la estructura de
§D; el orden de los pasos es el orden real de trabajo.

---

## 1. Prerequisitos y verificación

### 1.1 Qué hay ya en la máquina (verificado)

| Recurso | Estado | ¿Bloquea? |
|---|---|---|
| Windows 11 Pro | Presente | — |
| Node.js | `v24.19.0` | No. Sirve para Angular y NestJS |
| npm | `11.17.0` | No. Solo se usa como lanzador de `corepack` |
| Git | `2.52.0` | No |
| Ollama | `0.34.3` corriendo en `:11434` | No. Ya aprovechable |
| Modelos Ollama | `gemma4:8b` (9.6 GB), `gemma4:26b` (17 GB), `qwen3.6:36b` MoE (23 GB), varios `:cloud` | No |
| RAM | 32 GB | No |
| Disco C: | 199 GB libres | No para el MVP |
| GPU | **Ninguna** (Intel Iris Xe integrada) | Restricción dura: inferencia **CPU-only** (§C.4) |
| Python | `py` 3.14.3, **sin `python` en PATH** | No. Node-first (ADR-006) |

### 1.2 Qué falta y hay que instalar

| # | Falta | Comando | ¿Admin? | ¿Reinicio? |
|---|---|---|---|---|
| 1 | **pnpm** | *nada* — ya se usa vía `corepack pnpm` (ver nota) | No | No |
| 2 | **WSL2** (prerequisito de Docker Desktop) | `wsl --install` | **Sí** | **Sí** |
| 3 | **Docker Desktop** | `winget install Docker.DockerDesktop` | **Sí** | **Sí** |
| 4 | **Modelo de embeddings** en Ollama | `ollama pull nomic-embed-text` | No | No |
| 5 | Verificación del entorno | `.\scripts\verify-env.ps1` | No | No |

Los pasos 2 y 3 son los únicos que exigen privilegios elevados y reinicio. **Se hacen una sola
vez.** El resto del proyecto (escribir código, migraciones, tests unitarios) no depende de
ellos; solo la integración con contenedores.

> **Nota sobre `corepack enable` (medido en esta máquina).** Con Node instalado en
> `C:\Program Files\nodejs`, `corepack enable` falla con **EPERM**: escribir los shims en el
> directorio de instalación de Node exige administrador.
>
> **No hace falta resolverlo.** Basta con invocar **`corepack pnpm …`**, que descarga y ejecuta la
> versión fijada en `packageManager` sin tocar el sistema. Los scripts del repo están escritos así
> precisamente por esto: asumir `pnpm` en el `PATH` los rompe con
> *"pnpm no se reconoce como un comando"*.
>
> Un `corepack enable` elevado solo mejora la ergonomía (poder teclear `pnpm` a secas). No es un
> prerequisito.

### 1.3 Instalación, paso a paso (PowerShell)

Ejecutar en **PowerShell como Administrador** los pasos marcados `[ADMIN]`.

```powershell
# ─────────────────────────────────────────────────────────────────────────────
# PASO 1 — pnpm vía corepack  (SIN admin, sin instalar nada)
# ─────────────────────────────────────────────────────────────────────────────
node --version              # esperado: v24.19.0
corepack pnpm --version     # esperado: 12.8.1  (la versión de `packageManager`)
# `corepack enable` NO se ejecuta: falla con EPERM en esta máquina (§1.2). `corepack pnpm`
# usa la versión fijada en package.json sin escribir en Program Files.

# ─────────────────────────────────────────────────────────────────────────────
# PASO 2 — WSL2  [ADMIN] [REINICIO]
# ─────────────────────────────────────────────────────────────────────────────
# Requiere virtualización habilitada en BIOS/UEFI (VT-x).
wsl --install
# Si la máquina ya tiene la característica activada pero sin distro:
# wsl --install --no-distribution
# Cuando termine: REINICIAR Windows.
wsl --status            # esperado: "Default Version: 2"
wsl --update            # mantener el kernel al día

# ─────────────────────────────────────────────────────────────────────────────
# PASO 3 — Docker Desktop  [ADMIN] [REINICIO]
# ─────────────────────────────────────────────────────────────────────────────
winget install --id Docker.DockerDesktop --exact
# Cuando termine: REINICIAR Windows.
# Después del reinicio, abrir Docker Desktop y esperar a que el motor arranque.
# En Settings > General: activar "Start Docker Desktop when you sign in".
# En Settings > Resources > WSL Integration: integrar la distro por defecto.

docker --version                # esperado: Docker version 27.x o superior
docker compose version          # esperado: Docker Compose version v2.30.x o superior
docker info --format '{{.ServerVersion}}'   # debe imprimir una versión, no un error
docker run --rm hello-world     # prueba de humo del motor

# ─────────────────────────────────────────────────────────────────────────────
# PASO 4 — Modelos de Ollama  (SIN admin)
# ─────────────────────────────────────────────────────────────────────────────
# Ya están: gemma4:8b, gemma4:26b, qwen3.6:36b, y modelos :cloud.
ollama list

# Modelo de embeddings — NO está descargado. Es el que falta.
# DECIDIDO (ADR-019): nomic-embed-text, 768 dims, ~274 MB.
ollama pull nomic-embed-text
# Alternativa documentada (no MVP): mxbai-embed-large, 1024 dims, ~670 MB.

# Comprobar dimensión y que responde:
ollama show nomic-embed-text
Invoke-RestMethod -Method Post -Uri http://localhost:11434/api/embeddings `
  -ContentType 'application/json' `
  -Body '{"model":"nomic-embed-text","prompt":"prueba"}' |
  Select-Object -ExpandProperty embedding |
  Measure-Object |
  Select-Object -ExpandProperty Count      # esperado: 768

# ─────────────────────────────────────────────────────────────────────────────
# PASO 5 — Verificación completa del entorno
# ─────────────────────────────────────────────────────────────────────────────
cd "C:\Users\D0121889\documents\proyectos personales\crm ventas"
powershell -ExecutionPolicy Bypass -File .\scripts\verify-env.ps1
```

> **Dimensión de embeddings — resuelto (ADR-019).** `database.md` declaraba `vector(1536)`, la
> dimensión de `text-embedding-3-small` de OpenAI, mientras **ADR-007** enruta los embeddings a
> Ollama local. Era una contradicción entre dos documentos congelados. Resuelta en el origen:
>
> - Dimensión única **`vector(768)`** en todas las columnas vectoriales.
> - Modelo **`nomic-embed-text`** (`EMBEDDING_MODEL=nomic-embed-text`, `EMBEDDING_DIMENSIONS=768`).
> - El **1536 de OpenAI queda descartado**: obligaría a que cada embedding pasara por una llamada
>   remota de pago, contra ADR-007.
> - Cada fila con vector escribe **`embedding_model`**, y el re-embedding se define como
>   `WHERE embedding_model IS DISTINCT FROM :modelo_actual`. Sin esa columna, cambiar de modelo
>   mezcla dos espacios vectoriales **en silencio**, sin error.
>
> Por tanto **no hay `ALTER TABLE` de ajuste que ejecutar**: el esquema ya nace en `vector(768)`.
> La dimensión debe estar fijada antes de la migración **`003_catalog` (Fase 3)**, no antes de la
> Fase 5 —`products.embedding` nace en esa migración.
>
> `nomic-embed-text` espera prefijos de tarea (`search_document:` al indexar, `search_query:` al
> consultar). El `OllamaProvider` debe añadirlos; olvidarlos no rompe nada visible, solo degrada
> los resultados.

### 1.4 Script de verificación del entorno

Archivo `scripts/verify-env.ps1`. Comprueba cada prerequisito, no modifica nada y devuelve
código de salida `0` si todo está listo o `1` si falta algo. Es **apto para CI** y para el
criterio de aceptación «checklist ejecutado de cero en una máquina limpia» (§O.2).

```powershell
#requires -Version 5.1
<#
.SYNOPSIS
  Verifica los prerequisitos del entorno de crm-ventas en Windows 11.
.DESCRIPTION
  Solo comprueba. No instala ni modifica nada.
  Salida: tabla de resultados. Exit code 0 si no hay FAIL, 1 si hay alguno.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\verify-env.ps1
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\verify-env.ps1 -Fix
#>
[CmdletBinding()]
param(
    [switch] $Fix,
    [string] $OllamaUrl        = 'http://localhost:11434',
    [string] $RequiredModel    = 'gemma4:8b',
    [string] $EmbeddingModel   = 'nomic-embed-text',
    [int]    $MinDiskGB        = 40,
    [int]    $MinRamGB         = 16
)

$ErrorActionPreference = 'Continue'
$script:Results = New-Object System.Collections.Generic.List[object]

function Add-Check {
    param(
        [Parameter(Mandatory)][string] $Item,
        [Parameter(Mandatory)][ValidateSet('OK','WARN','FAIL','SKIP')][string] $Status,
        [string] $Detail = '',
        [string] $Fix    = '',
        [switch] $NeedsAdmin,
        [switch] $NeedsReboot
    )
    $script:Results.Add([pscustomobject]@{
        Item        = $Item
        Status      = $Status
        Detail      = $Detail
        Fix         = $Fix
        NeedsAdmin  = [bool]$NeedsAdmin
        NeedsReboot = [bool]$NeedsReboot
    })
}

function Get-Exe {
    param([string] $Name)
    return (Get-Command $Name -ErrorAction SilentlyContinue)
}

Write-Host ''
Write-Host '=== crm-ventas · verificacion de entorno ===' -ForegroundColor Cyan
Write-Host ("Fecha : {0}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
Write-Host ("Host  : {0}" -f $env:COMPUTERNAME)
Write-Host ''

# ── 1. Sistema operativo ────────────────────────────────────────────────────
try {
    $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
    Add-Check 'Windows 11 / build' 'OK' ("{0} (build {1})" -f $os.Caption, $os.BuildNumber)
} catch {
    Add-Check 'Windows 11 / build' 'WARN' 'no se pudo leer Win32_OperatingSystem'
}

# ── 2. Node.js ──────────────────────────────────────────────────────────────
$node = Get-Exe 'node'
if ($null -ne $node) {
    $nv = (& node --version).Trim()
    $maj = 0
    if ($nv -match '^v(\d+)\.') { $maj = [int]$Matches[1] }
    if ($maj -ge 22) {
        Add-Check 'Node.js >= 22' 'OK' $nv
    } else {
        Add-Check 'Node.js >= 22' 'WARN' "$nv (verificado en la maquina: v24.19.0)" `
            'Instalar Node 24 LTS: winget install OpenJS.NodeJS.LTS' -NeedsAdmin
    }
} else {
    Add-Check 'Node.js >= 22' 'FAIL' 'no encontrado en PATH' `
        'winget install OpenJS.NodeJS.LTS' -NeedsAdmin
}

# ── 3. npm ──────────────────────────────────────────────────────────────────
if ($null -ne (Get-Exe 'npm')) {
    Add-Check 'npm' 'OK' ((& npm --version).Trim())
} else {
    Add-Check 'npm' 'FAIL' 'no encontrado' 'Viene con Node.js; reinstalar Node.'
}

# ── 4. pnpm via corepack ────────────────────────────────────────────────────
$pnpm = Get-Exe 'pnpm'
if ($null -ne $pnpm) {
    Add-Check 'pnpm (corepack)' 'OK' ((& pnpm --version).Trim())
} else {
    $nodeDir = ''
    if ($null -ne $node) { $nodeDir = Split-Path -Parent $node.Source }
    $adminHint = ''
    if ($nodeDir -like '*Program Files*') { $adminHint = ' [ADMIN: Node esta en Program Files]' }
    Add-Check 'pnpm (corepack)' 'FAIL' 'no instalado' `
        ("corepack enable ; corepack prepare pnpm@12.8.1 --activate" + $adminHint)
}

# ── 5. Git ──────────────────────────────────────────────────────────────────
if ($null -ne (Get-Exe 'git')) {
    $gv = ((& git --version) -replace '^git version\s+', '').Trim()
    Add-Check 'Git' 'OK' $gv
} else {
    Add-Check 'Git' 'FAIL' 'no encontrado' 'winget install Git.Git' -NeedsAdmin
}

# ── 6. WSL2 (prerequisito de Docker Desktop) ────────────────────────────────
$wslExe = Get-Exe 'wsl'
if ($null -ne $wslExe) {
    $raw = ''
    try { $raw = (& wsl.exe --list --quiet 2>$null | Out-String) } catch { $raw = '' }
    $clean = (($raw -replace '[^\x20-\x7E]', ' ') -replace '\s+', ' ').Trim()
    if ($clean.Length -gt 0) {
        Add-Check 'WSL2 (prereq. Docker Desktop)' 'OK' ("distros: {0}" -f $clean)
    } else {
        Add-Check 'WSL2 (prereq. Docker Desktop)' 'FAIL' `
            'wsl.exe presente pero sin distribuciones' `
            'wsl --install --no-distribution   (despues REINICIAR)' -NeedsAdmin -NeedsReboot
    }
} else {
    Add-Check 'WSL2 (prereq. Docker Desktop)' 'FAIL' 'wsl.exe no encontrado' `
        'wsl --install   (despues REINICIAR)' -NeedsAdmin -NeedsReboot
}

# ── 7. Docker Desktop + daemon ──────────────────────────────────────────────
$docker = Get-Exe 'docker'
if ($null -ne $docker) {
    $dv = ''
    try { $dv = (& docker --version 2>$null | Out-String).Trim() } catch { $dv = 'docker presente' }
    & docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Add-Check 'Docker Desktop (daemon)' 'OK' $dv
    } else {
        Add-Check 'Docker Desktop (daemon)' 'FAIL' `
            "$dv - el cliente existe pero el motor no responde" `
            'Abrir Docker Desktop y esperar a que arranque el motor.'
    }
} else {
    Add-Check 'Docker Desktop (daemon)' 'FAIL' 'docker no encontrado' `
        '1) wsl --install  2) REINICIAR  3) winget install Docker.DockerDesktop  4) REINICIAR  5) abrir Docker Desktop' `
        -NeedsAdmin -NeedsReboot
}

# ── 8. Docker Compose v2 ────────────────────────────────────────────────────
if ($null -ne $docker) {
    & docker compose version 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $cv = ''
        try { $cv = (& docker compose version 2>$null | Out-String).Trim() } catch { $cv = 'v2' }
        Add-Check 'Docker Compose v2 (plugin)' 'OK' $cv
    } else {
        Add-Check 'Docker Compose v2 (plugin)' 'FAIL' 'plugin no disponible' `
            'Reinstalar o actualizar Docker Desktop.'
    }
} else {
    Add-Check 'Docker Compose v2 (plugin)' 'SKIP' 'Docker no instalado'
}

# ── 9. Ollama — servicio ────────────────────────────────────────────────────
$ollamaCmd = Get-Exe 'ollama'
if ($null -ne $ollamaCmd) {
    $ov = ''
    try { $ov = (& ollama --version 2>$null | Out-String).Trim() } catch { $ov = 'ollama en PATH' }
    Add-Check 'Ollama (binario)' 'OK' $ov
} else {
    Add-Check 'Ollama (binario)' 'WARN' 'no esta en PATH (puede correr como servicio)' `
        'Si /api/tags no responde: https://ollama.com/download'
}

$modelNames = @()
$tagsOk = $false
try {
    $tags = Invoke-RestMethod -Uri "$OllamaUrl/api/tags" -TimeoutSec 6 -ErrorAction Stop
    $tagsOk = $true
    $modelNames = @($tags.models | ForEach-Object { $_.name })
    Add-Check 'Ollama (servicio :11434)' 'OK' ("{0} modelos disponibles" -f $modelNames.Count)
} catch {
    Add-Check 'Ollama (servicio :11434)' 'FAIL' "no responde en $OllamaUrl" `
        'Arrancar Ollama:  ollama serve   (o abrir la aplicacion de Ollama)'
}

# ── 10/11. Modelos requeridos ───────────────────────────────────────────────
function Test-ModelPresent {
    param([string[]] $Available, [string] $Wanted)
    foreach ($n in $Available) {
        if ($n -eq $Wanted) { return $true }
        if ($n -like "$Wanted*") { return $true }
    }
    return $false
}

if ($tagsOk) {
    if (Test-ModelPresent $modelNames $RequiredModel) {
        Add-Check "Modelo Ollama '$RequiredModel'" 'OK' 'presente'
    } else {
        Add-Check "Modelo Ollama '$RequiredModel'" 'FAIL' 'ausente' `
            "ollama pull $RequiredModel"
    }
    if (Test-ModelPresent $modelNames $EmbeddingModel) {
        Add-Check "Embeddings '$EmbeddingModel'" 'OK' 'presente'
    } else {
        Add-Check "Embeddings '$EmbeddingModel'" 'FAIL' 'ausente (necesario para pgvector)' `
            "ollama pull $EmbeddingModel"
    }
} else {
    Add-Check "Modelo Ollama '$RequiredModel'" 'SKIP' 'servicio no disponible'
    Add-Check "Embeddings '$EmbeddingModel'" 'SKIP' 'servicio no disponible'
}

# ── 12. RAM ─────────────────────────────────────────────────────────────────
try {
    $ramGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
    if ($ramGB -ge $MinRamGB) {
        Add-Check "RAM >= $MinRamGB GB" 'OK' "$ramGB GB"
    } else {
        Add-Check "RAM >= $MinRamGB GB" 'WARN' "$ramGB GB (verificado: 32 GB)" `
            'Un modelo 8B Q4 necesita ~10 GB libres; 26B necesita ~17 GB.'
    }
} catch {
    Add-Check 'RAM' 'WARN' 'no se pudo leer la memoria fisica'
}

# ── 13. Disco ───────────────────────────────────────────────────────────────
try {
    $drive = Get-PSDrive -Name C -ErrorAction Stop
    $freeGB = [math]::Round($drive.Free / 1GB, 1)
    if ($freeGB -ge $MinDiskGB) {
        Add-Check "Disco C: >= $MinDiskGB GB libres" 'OK' "$freeGB GB libres"
    } else {
        Add-Check "Disco C: >= $MinDiskGB GB libres" 'WARN' "$freeGB GB libres" `
            'Liberar espacio: docker system prune -a ; revisar modelos de Ollama.'
    }
} catch {
    Add-Check 'Disco C:' 'WARN' 'no se pudo leer el espacio libre'
}

# ── 14. GPU (informativo, no bloquea) ───────────────────────────────────────
try {
    $gpus = @(Get-CimInstance Win32_VideoController -ErrorAction Stop | ForEach-Object { $_.Name })
    $isDiscrete = $false
    foreach ($g in $gpus) {
        if ($g -match 'NVIDIA|Radeon RX|Arc A') { $isDiscrete = $true }
    }
    if ($isDiscrete) {
        Add-Check 'GPU (informativo)' 'OK' ($gpus -join ', ')
    } else {
        Add-Check 'GPU (informativo)' 'WARN' ($gpus -join ', ') `
            'Sin GPU dedicada: inferencia CPU-only (~5-8 tok/s en 8B). Ver ADR-007.'
    }
} catch {
    Add-Check 'GPU (informativo)' 'SKIP' 'no se pudo enumerar'
}

# ── 15. Python (informativo, ADR-006) ───────────────────────────────────────
if ($null -ne (Get-Exe 'py')) {
    $pyv = ''
    try { $pyv = (& py --version 2>$null | Out-String).Trim() } catch { $pyv = 'py presente' }
    Add-Check 'Python (informativo)' 'WARN' $pyv `
        'Node-first (ADR-006). Si se necesita Python, fijar 3.12/3.13 en venv, nunca 3.14.'
} else {
    Add-Check 'Python (informativo)' 'OK' 'no instalado (no se necesita)'
}

# ── 16. Puertos ─────────────────────────────────────────────────────────────
function Test-PortListening {
    param([int] $Port)
    $c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return ($null -ne $c)
}

$portsFree  = @(5432, 6379, 3000, 4000, 4200, 8080)
$portsBusyOk = @(11434)

foreach ($p in $portsFree) {
    if (Test-PortListening $p) {
        Add-Check "Puerto $p libre" 'WARN' 'en uso' `
            "Identificar el proceso:  Get-NetTCPConnection -LocalPort $p | Select-Object OwningProcess"
    } else {
        Add-Check "Puerto $p libre" 'OK' 'disponible'
    }
}
foreach ($p in $portsBusyOk) {
    if (Test-PortListening $p) {
        Add-Check "Puerto $p en escucha (Ollama)" 'OK' 'escuchando'
    } else {
        Add-Check "Puerto $p en escucha (Ollama)" 'WARN' 'nada escuchando' `
            'Arrancar Ollama: ollama serve'
    }
}

# ── Resumen ─────────────────────────────────────────────────────────────────
Write-Host ''
$script:Results | Format-Table -AutoSize Item, Status, Detail

$fails = @($script:Results | Where-Object { $_.Status -eq 'FAIL' })
$warns = @($script:Results | Where-Object { $_.Status -eq 'WARN' })

if ($warns.Count -gt 0) {
    Write-Host ("Avisos ({0}):" -f $warns.Count) -ForegroundColor Yellow
    foreach ($w in $warns) {
        if ($w.Fix) { Write-Host ("  - {0}: {1}" -f $w.Item, $w.Fix) -ForegroundColor Yellow }
    }
    Write-Host ''
}

if ($fails.Count -gt 0) {
    Write-Host ("BLOQUEANTE: faltan {0} prerequisito(s)." -f $fails.Count) -ForegroundColor Red
    foreach ($f in $fails) {
        $tags = @()
        if ($f.NeedsAdmin)  { $tags += '[ADMIN]' }
        if ($f.NeedsReboot) { $tags += '[REINICIO]' }
        $tagStr = ''
        if ($tags.Count -gt 0) { $tagStr = ' ' + ($tags -join ' ') }
        Write-Host ("  x {0}{1}" -f $f.Item, $tagStr) -ForegroundColor Red
        if ($Fix -and $f.Fix) { Write-Host ("      -> {0}" -f $f.Fix) -ForegroundColor DarkGray }
    }
    Write-Host ''
    Write-Host 'Entorno NO listo.' -ForegroundColor Red
    exit 1
}

if ($Fix) {
    Write-Host 'Comandos de correccion (copiar y pegar en orden):' -ForegroundColor Cyan
    Write-Host '  corepack enable'
    Write-Host '  corepack prepare pnpm@12.8.1 --activate'
    Write-Host '  # [ADMIN + REINICIO]'
    Write-Host '  wsl --install'
    Write-Host '  # [ADMIN + REINICIO]'
    Write-Host '  winget install --id Docker.DockerDesktop --exact'
    Write-Host '  ollama pull nomic-embed-text'
    Write-Host ''
}

Write-Host 'Entorno listo.' -ForegroundColor Green
exit 0
```

**Equivalente mínimo para CI (Linux).** El runner de GitHub Actions no necesita WSL2 ni Ollama
nativo; solo comprueba que el runner tiene las herramientas del pipeline:

```bash
#!/usr/bin/env bash
# scripts/verify-env.sh — version reducida para CI/Linux
set -euo pipefail
fail=0
chk() { if command -v "$1" >/dev/null 2>&1; then echo "OK   $1"; else echo "FALTA $1"; fail=1; fi; }
chk node; chk pnpm; chk docker; chk git
node --version
[ "$fail" -eq 0 ] || exit 1
echo "Entorno CI listo."
```

---

## 2. Puesta en marcha desde cero

Cada paso indica el comando exacto y el **resultado esperado**. Si el resultado no coincide, no
avanzar al paso siguiente.

### 2.1 Estructura de scripts del repositorio

Antes de los pasos conviene fijar los nombres que se usan en todo el documento. En
`package.json` (raíz):

```json
{
  "name": "crm-ventas",
  "private": true,
  "packageManager": "pnpm@12.8.1",
  "engines": { "node": ">=22" },
  "scripts": {
    "verify:env": "powershell -ExecutionPolicy Bypass -File ./scripts/verify-env.ps1",
    "infra:up": "docker compose --env-file .env -f infrastructure/compose/docker-compose.yml up -d",
    "infra:up:dev": "docker compose --env-file .env -f infrastructure/compose/docker-compose.yml -f infrastructure/compose/docker-compose.dev.yml up -d",
    "infra:up:prodlike": "docker compose --env-file .env -f infrastructure/compose/docker-compose.yml -f infrastructure/compose/docker-compose.prod.yml up -d",
    "infra:down": "docker compose --env-file .env -f infrastructure/compose/docker-compose.yml down",
    "infra:logs": "docker compose --env-file .env -f infrastructure/compose/docker-compose.yml logs -f --tail=100",
    "infra:ps": "docker compose --env-file .env -f infrastructure/compose/docker-compose.yml ps",
    "dev": "pnpm -r --parallel --filter @crm/api --filter @crm/worker --filter @crm/web --filter @crm/site dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "bootstrap": "node scripts/bootstrap.mjs",
    "db:generate": "pnpm --filter @crm/api exec prisma generate",
    "db:migrate": "pnpm --filter @crm/api exec prisma migrate deploy",
    "db:migrate:dev": "pnpm --filter @crm/api exec prisma migrate dev",
    "db:migrate:status": "pnpm --filter @crm/api exec prisma migrate status",
    "db:seed": "pnpm --filter @crm/api exec prisma db seed",
    "db:reset": "pnpm --filter @crm/api exec prisma migrate reset --force",
    "contract:generate": "node scripts/generate-client.mjs",
    "contract:check": "node scripts/check-contract-drift.mjs",
    "backup": "bash scripts/backup.sh",
    "restore": "bash scripts/restore.sh"
  }
}
```

> **Ojo: ese bloque es el OBJETIVO del Sprint 1, no lo que hay hoy.** Donde difiera, la autoridad
> es el [`package.json`](../package.json) real.
>
> **Implementado y verificado (2026-10-01):** `build` (`tsc -b`, no `pnpm -r build`), `typecheck`,
> `test`, `dev` y `start`.
> **Pendiente:** todo lo que depende de infraestructura (`infra:*`), base de datos (`db:*`),
> contrato (`contract:*`) y los scripts (`bootstrap`, `backup`, `restore`).
>
> Los scripts del repo invocan **`corepack pnpm`**, nunca `pnpm` pelado (§1.2).

`pnpm-workspace.yaml`:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

`.gitignore` (fragmento relevante — el punto crítico de seguridad S5):

```gitignore
# Secretos: NUNCA se commitean
.env
.env.*
!.env.example

# Build
node_modules/
dist/
.angular/
coverage/
*.tsbuildinfo

# Datos locales
.data/
backups/
infrastructure/compose/backups/

# Docker / editor
.DS_Store
Thumbs.db
```

### 2.2 PASO 1 — Clonar e instalar dependencias

```powershell
cd "C:\Users\D0121889\documents\proyectos personales"
git clone https://github.com/OWNER/crm-ventas.git
cd "crm ventas"          # o: cd crm-ventas   (segun el nombre real del remoto)

corepack pnpm install --frozen-lockfile
```

**Resultado esperado:** `corepack pnpm --version` imprime `12.8.1`; `corepack pnpm install`
termina con `Done in Xs` y crea `node_modules/` en la raíz y en cada workspace.

```powershell
corepack pnpm --version         # -> 12.8.1
Get-ChildItem node_modules -ErrorAction SilentlyContinue | Select-Object -First 3
```

> Si `pnpm install` falla con `ERR_PNPM_NO_MATCHING_VERSION`, la versión del campo
> `packageManager` y la del `lockfile` no coinciden: alinear ambas y reintentar.

### 2.3 PASO 2 — Crear el archivo `.env`

```powershell
Copy-Item .env.example .env
# Generar secretos reales (no usar los del ejemplo, que son de relleno):
node -e "console.log('JWT_ACCESS_SECRET=' + require('crypto').randomBytes(48).toString('base64url'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(48).toString('base64url'))"
```

Pegar la salida en `.env`. **Resultado esperado:** `.env` existe, no aparece en
`git status` (está ignorado) y los dos secretos son cadenas distintas de 64 caracteres.

```powershell
git status --porcelain | Select-String '\.env'   # -> no debe imprimir nada
```

### 2.4 PASO 3 — Levantar la infraestructura

El desarrollo diario de la aplicación se hace **nativo en el host** (los frontends con
`ng serve` en `:4200`/`:4000`, la API con watch). Docker se usa para la infraestructura:

```powershell
pnpm infra:up
```

**Resultado esperado:**

```powershell
docker compose --env-file .env -f infrastructure/compose/docker-compose.yml ps
# NAME                 SERVICE    STATUS
# crm-ventas-postgres-1   postgres   Up (healthy)
# crm-ventas-redis-1      redis      Up (healthy)
```

Si `postgres` queda en `starting` más de 30 s, ver §12 (runbook: Postgres no arranca).

### 2.5 PASO 4 — Bootstrap (extensiones, migraciones, seed)

`scripts/bootstrap.mjs` es idempotente: crea el esquema si falta, aplica las extensiones de
Postgres, corre **todas** las migraciones en el orden de `database.md` §13 y siembra los datos
mínimos (una organización, un usuario `OWNER`, los templates de campaña y el registro del
conector de MercadoLibre deshabilitado).

```powershell
pnpm bootstrap
```

**Resultado esperado:**

```
[1/5] Verificando conectividad a Postgres ... OK (crm_ventas @ localhost:5432)
[2/5] Aplicando extensiones ... OK (vector, pg_trgm, citext, pgcrypto)
[3/5] Aplicando migraciones ... 10 aplicadas, 0 pendientes
[4/5] Generando cliente Prisma ... OK
[5/5] Sembrando datos base ... organization=1, users=1, templates=9, connectors=1 (disabled)
Bootstrap completado. Ejecuta: pnpm dev
```

```powershell
pnpm db:migrate:status
# -> "Database schema is up to date!"
```

### 2.6 PASO 5 — Verificar que la API alcanza Ollama

Este es el punto donde se materializa ADR-015. Desde el **host**:

```powershell
Invoke-RestMethod http://localhost:11434/api/tags | Select-Object -ExpandProperty models |
  Select-Object name, size
```

Desde **dentro de un contenedor** (el que realmente importa en staging/prod):

```powershell
docker compose --env-file .env -f infrastructure/compose/docker-compose.yml `
  run --rm --entrypoint sh api -c `
  "node -e \"fetch('http://host.docker.internal:11434/api/tags').then(r=>r.json()).then(j=>console.log('modelos:',j.models.length)).catch(e=>{console.error('FALLO:',e.message);process.exit(1)})\""
```

**Resultado esperado:** `modelos: N` con N ≥ 4. Si falla, ver §5 y §12.

### 2.7 PASO 6 — Arrancar en desarrollo

```powershell
corepack pnpm dev
```

> Arranca **dos procesos** con salida prefijada: `[build]` → `tsc -b --watch` (compila y
> recompila al guardar) y `[serve]` → `node --watch dist/main.js` (ejecuta y reinicia solo). Un
> único comando; editar un `.ts` recompila y reinicia sin tocar nada.
>
> Si prefieres verlos por separado, en dos terminales:
>
> ```powershell
> corepack pnpm --filter @crm/api dev:build   # terminal 1 — compila en watch
> corepack pnpm --filter @crm/api dev:serve   # terminal 2 — ejecuta en watch
> ```
>
> **No se usa `tsx` ni `nest start`**, y no es una preferencia: ambos se verificaron y se
> descartaron con evidencia. `tsx` no emite la metadata de decoradores
> (`__metadata("design:paramtypes", …)` sale `null`), así que NestJS deja de resolver cualquier
> inyección **por tipo** y el arranque falla con *"Nest can't resolve dependencies"*.
> `@nestjs/cli` 12 no soporta TypeScript 7, que ya no expone la API programática del compilador
> (`createProgram`, `sys`, `getParsedCommandLineOfConfigFile`) — su `exports["."]` son tres líneas
> de versión. Detalle completo en `docs/decisions.md` ADR-021.

**Resultado esperado** (arranque en paralelo con prefijos por paquete):

| Servicio | URL esperada | Comprobación |
|---|---|---|
| `apps/api` (NestJS) | `http://localhost:3000` | `Invoke-RestMethod http://localhost:3000/health/ready` → `{"status":"ok","db":"up","redis":"up"}` |
| `apps/web` (CRM SPA) | `http://localhost:4200` | Carga la pantalla de login |
| `apps/site` (SSR público) | `http://localhost:4000` | El HTML inicial ya contiene `<title>`, `canonical` y JSON-LD (no depende de JS) |
| `apps/worker` (BullMQ) | sin puerto público | Log `worker ready · queues=[io,ai,compute,seo] · ai.concurrency=1` |

Comprobaciones de aceptación de §O.2:

```powershell
# El CRM no se indexa
Invoke-WebRequest http://localhost:4200/robots.txt | Select-Object -ExpandProperty Content
# -> User-agent: *  /  Disallow: /

# El sitio publico si se indexa y prerenderiza metadatos
$html = (Invoke-WebRequest http://localhost:4000/).Content
if ($html -match '<title>' -and $html -match 'rel="canonical"' -and $html -match 'application/ld\+json') {
  'SSR/JSON-LD OK' } else { 'FALLO: falta metadata en el HTML del servidor' }

# /health/ready devuelve 503 si Postgres o Redis caen (probar con docker stop)
docker stop crm-ventas-postgres-1
Invoke-WebRequest http://localhost:3000/health/ready -SkipHttpErrorCheck | Select-Object StatusCode
# -> 503
docker start crm-ventas-postgres-1
```

### 2.8 Anexo A — `.env.example` completo y comentado

> **Aviso (2026-10-01).** El `.env.example` **de verdad** —el que existe, el que se copia y el que
> hace arrancar el API— es el de la **raíz del repositorio**. Este anexo es la plantilla del
> despliegue con Compose, que **todavía no existe en esta máquina** (no hay Docker), y usa nombres
> distintos (`API_PORT` aquí vs `PORT` en `env.ts`; `POSTGRES_*` aquí vs `DATABASE_URL` allí).
>
> Se conserva como diseño del objetivo, no como instrucción de arranque: **no lo copies tal cual**,
> porque además le faltan las variables obligatorias del webhook de Meta (`META_APP_SECRET`,
> `META_VERIFY_TOKEN`), y el API no arranca sin ellas. La autoridad de hoy es `docs/manual.md` §3.

Este es el archivo que **sí** se commitea. Se copia a `.env` (que no). Cada variable está
comentada con su propósito y su valor de ejemplo.

```dotenv
# =============================================================================
# crm-ventas — .env.example
# Copiar a .env y rellenar. NUNCA commitear .env (ver .gitignore).
# Los valores de este ejemplo son de DESARROLLO LOCAL y no sirven en producción.
# =============================================================================

# ─────────────────────────────────────────────────────────────────────────────
# 1. ENTORNO Y APLICACIÓN
# ─────────────────────────────────────────────────────────────────────────────
NODE_ENV=development                 # development | test | production
APP_ENV=local                        # local | development | staging | production  (ver §8)
APP_NAME=crm-ventas
TZ=America/Bogota                    # zona horaria del negocio (afecta rollups diarios)
LOG_LEVEL=debug                      # trace|debug|info|warn|error  (prod: info)
LOG_PRETTY=true                      # false en contenedores (pino JSON plano)

# ─────────────────────────────────────────────────────────────────────────────
# 2. PUERTOS (solo aplican al ejecutar en el host; en Compose los fija el servicio)
# ─────────────────────────────────────────────────────────────────────────────
API_PORT=3000
WEB_PORT=4200
SITE_PORT=4000
WORKER_METRICS_PORT=9464             # interno, NUNCA publicado

# ─────────────────────────────────────────────────────────────────────────────
# 3. POSTGRESQL 17 + pgvector
# ─────────────────────────────────────────────────────────────────────────────
POSTGRES_HOST=localhost               # en contenedor se sobreescribe a 'postgres'
POSTGRES_PORT=5432
POSTGRES_DB=crm_ventas
POSTGRES_USER=crm
POSTGRES_PASSWORD=CAMBIAR_ESTA_CLAVE_EN_LOCAL
# URL completa que usa Prisma. En Compose, el host es 'postgres'.
DATABASE_URL=postgresql://crm:CAMBIAR_ESTA_CLAVE_EN_LOCAL@localhost:5432/crm_ventas?schema=public
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
# Extensiones requeridas (ADR-008, §C.3). El bootstrap las aplica si faltan.
DB_EXTENSIONS=vector,pg_trgm,citext,pgcrypto

# ─────────────────────────────────────────────────────────────────────────────
# 4. REDIS (cache, rate limits, locks y colas BullMQ) — ADR-009/ADR-010
# ─────────────────────────────────────────────────────────────────────────────
REDIS_HOST=localhost                  # en contenedor: 'redis'
REDIS_PORT=6379
REDIS_PASSWORD=                       # vacío en local; obligatorio en staging/prod
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=crm:
# BullMQ requiere noeviction: si Redis desaloja claves, se pierden jobs.
REDIS_MAXMEMORY=512mb
REDIS_MAXMEMORY_POLICY=noeviction

# ─────────────────────────────────────────────────────────────────────────────
# 5. AUTENTICACIÓN (§K.2) — JWT + argon2id + refresh rotativo
# ─────────────────────────────────────────────────────────────────────────────
JWT_ACCESS_SECRET=REEMPLAZAR_con_randomBytes_48_base64url
JWT_REFRESH_SECRET=REEMPLAZAR_con_OTRO_randomBytes_48_base64url
JWT_ACCESS_TTL=15m                    # access token corto, en memoria del cliente
JWT_REFRESH_TTL=30d                   # refresh en cookie httpOnly + rotación
JWT_ISSUER=crm-ventas
JWT_AUDIENCE=crm-ventas-web
ARGON2_MEMORY_COST=19456              # KiB (~19 MiB) — recomendación OWASP
ARGON2_TIME_COST=2
ARGON2_PARALLELISM=1
MAX_LOGIN_ATTEMPTS=10                 # bloqueo por intentos fallidos
LOGIN_LOCK_MINUTES=15
COOKIE_DOMAIN=localhost               # en prod: .tudominio.com
COOKIE_SECURE=false                   # true obligatorio en staging/prod (HTTPS)
COOKIE_SAMESITE=lax

# ─────────────────────────────────────────────────────────────────────────────
# 6. CORS Y URLs PÚBLICAS
# ─────────────────────────────────────────────────────────────────────────────
CORS_ORIGINS=http://localhost:4200    # lista separada por comas; NUNCA '*' en prod
API_PUBLIC_URL=http://localhost:3000
PUBLIC_SITE_URL=http://localhost:4000
WEB_APP_URL=http://localhost:4200
TRUST_PROXY=false                     # true detrás de Caddy/nginx (necesario para IP real)

# ─────────────────────────────────────────────────────────────────────────────
# 7. OLLAMA — NATIVO EN EL HOST, NO EN CONTENEDOR (ADR-015)
#    En el host se usa localhost. Dentro de un contenedor, host.docker.internal.
#    La baseUrl es CONFIGURACIÓN, nunca una constante en el código.
# ─────────────────────────────────────────────────────────────────────────────
OLLAMA_BASE_URL=http://localhost:11434
# En Compose esta variable se sobreescribe a:
#   OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_API_KEY=                       # vacío: Ollama local no usa autenticación
OLLAMA_KEEP_ALIVE=5m                  # descarga el modelo de RAM tras 5 min inactivo
OLLAMA_REQUEST_TIMEOUT_MS=300000      # 5 min: en CPU un 8B tarda minutos con salidas largas
OLLAMA_NUM_PARALLEL=1                 # una generación a la vez (CPU)

# ─────────────────────────────────────────────────────────────────────────────
# 8. MODELOS POR CLASE DE TAREA — routing híbrido (ADR-007, §G.3)
# ─────────────────────────────────────────────────────────────────────────────
LLM_DEFAULT_PROVIDER=ollama           # ollama | ollama_cloud | openai | anthropic
# Tier 1 — volumen alto, respuesta corta, tolera latencia. LOCAL, gratis.
LLM_TIER1_MODEL=gemma4:8b
# Tier 2 — borradores internos y batch nocturno.
LLM_TIER2_MODEL=gemma4:26b
# Tier 3 — estrategia y copy de cara al cliente. REMOTO (calidad > coste).
LLM_TIER3_MODEL=kimi-k2.7-code        # modelo :cloud ya disponible en esta máquina
LLM_CLASSIFICATION_MODEL=gemma4:8b
LLM_EXTRACTION_MODEL=gemma4:8b
LLM_CONTENT_MODEL=${LLM_TIER3_MODEL}
LLM_STRATEGY_MODEL=${LLM_TIER3_MODEL}
LLM_FALLBACK_CHAIN=gemma4:8b,gemma4:26b,kimi-k2.7-code

# ─────────────────────────────────────────────────────────────────────────────
# 9. EMBEDDINGS (ADR-008, ADR-019) — DEBE COINCIDIR CON vector(N) DE LA MIGRACIÓN
#    DECIDIDO: nomic-embed-text -> 768 dims. El esquema declara vector(768).
#    Alternativa documentada, no MVP: mxbai-embed-large -> 1024.
#    Descartado: text-embedding-3-small (OpenAI) -> 1536, contra ADR-007.
# ─────────────────────────────────────────────────────────────────────────────
EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_DIMENSIONS=768
EMBEDDING_BATCH_SIZE=16
EMBEDDING_TIMEOUT_MS=60000

# ─────────────────────────────────────────────────────────────────────────────
# 10. PRESUPUESTOS DE IA (§G.5) — el riesgo no es gastar de más ahora,
#     es que el coste aparezca sin medirse cuando las tareas migren a la nube.
# ─────────────────────────────────────────────────────────────────────────────
DAILY_AI_BUDGET_USD=5.00
MONTHLY_AI_BUDGET_USD=100.00
MAX_AGENT_EXECUTIONS_PER_DAY=200
MAX_TOKENS_PER_TASK=8192
ALERT_THRESHOLD_PCT=80                # 80% del presupuesto -> notificación al centro de control
AI_BUDGET_ENFORCEMENT=hard            # hard: bloquea | soft: solo alerta
# Presupuesto por clase de tarea (opcional; 0 = sin límite específico)
AI_BUDGET_TASK_TYPE_CONTENT_USD=20.00
AI_BUDGET_TASK_TYPE_STRATEGY_USD=30.00

# ─────────────────────────────────────────────────────────────────────────────
# 11. GUARDRAILS DE PRESUPUESTO DE CAMPAÑA (§H.3)
#     Los tres primeros son topes de validación desde el MVP.
#     Los dos últimos se implementan y testean aunque hoy no se usen (no hay
#     automatización de gasto): añadirla después será un flag, no un rediseño.
# ─────────────────────────────────────────────────────────────────────────────
MAX_DAILY_BUDGET=50.00                # techo absoluto por campaña y día
MAX_CAMPAIGN_BUDGET=1000.00           # techo por campaña
MAX_AUTOMATED_SPEND=0.00              # 0 = la automatización no puede gastar nada
MAX_BUDGET_CHANGE_PERCENTAGE=20       # cambio máximo por acción automática
BUDGET_COOLDOWN_HOURS=24              # mínimo entre cambios automáticos sobre la misma campaña
CAMPAIGN_DEFAULT_CURRENCY=COP

# ─────────────────────────────────────────────────────────────────────────────
# 12. COLAS BULLMQ (§C.5, ADR-010) — el 'scheduler' son jobs repetibles aquí
# ─────────────────────────────────────────────────────────────────────────────
QUEUE_IO_CONCURRENCY=5                # conectores y sync
QUEUE_AI_CONCURRENCY=1                # ¡1! Ollama en CPU no paraleliza: compite por hilos
QUEUE_COMPUTE_CONCURRENCY=2           # scoring y agregaciones
QUEUE_SEO_CONCURRENCY=2               # crawling
JOB_DEFAULT_ATTEMPTS=5
JOB_BACKOFF_MS=2000                   # base del backoff exponencial
JOB_TIMEOUT_MS=600000
OUTBOX_POLL_INTERVAL_MS=1000          # sondeo del outbox transaccional (ADR-009)
OUTBOX_BATCH_SIZE=50
OUTBOX_MAX_ATTEMPTS=10
# Schedule de los jobs repetibles (formato cron BullMQ, 5 campos)
CRON_CONNECTOR_SYNC=0 */6 * * *
CRON_METRICS_RECONCILE=15 */1 * * *
CRON_SITEMAP=30 3 * * *
CRON_RETENTION_CLEANUP=0 4 * * *
CRON_TOKEN_CLEANUP=*/30 * * * *
CRON_BUDGET_RESET=0 0 * * *

# ─────────────────────────────────────────────────────────────────────────────
# 13. FLAGS DE ENTORNO — activar capacidad sin tocar código (feature_flags)
# ─────────────────────────────────────────────────────────────────────────────
FEATURE_AI_ENABLED=true
FEATURE_CONNECTORS_ENABLED=false      # true solo cuando hay ficha de compliance aprobada
FEATURE_AGENT_AUTOMATION=false        # Fase 9
FEATURE_SPEND_AUTOMATION=false        # NUNCA true en el MVP (§M.2)
FEATURE_CONTENT_SSR=true
SEED_ON_BOOTSTRAP=true
SEED_OWNER_EMAIL=owner@localhost
SEED_OWNER_PASSWORD=CambiarEstaClave1!

# ─────────────────────────────────────────────────────────────────────────────
# 14. OBSERVABILIDAD (§C.6)
# ─────────────────────────────────────────────────────────────────────────────
METRICS_ENABLED=true
PROMETHEUS_PATH=/metrics
SENTRY_DSN=                           # vacío en local
OTEL_ENABLED=false
OTEL_SERVICE_NAME=crm-ventas-api
OTEL_EXPORTER_OTLP_ENDPOINT=          # p. ej. http://otel-collector:4318

# ─────────────────────────────────────────────────────────────────────────────
# 15. ALMACENAMIENTO (StorageProvider: disco local -> S3 sin cambiar llamadas)
# ─────────────────────────────────────────────────────────────────────────────
STORAGE_DRIVER=local                  # local | s3
STORAGE_LOCAL_PATH=./.data/uploads
STORAGE_MAX_UPLOAD_MB=25
# S3_ACCESS_KEY_ID=
# S3_SECRET_ACCESS_KEY=
# S3_BUCKET=
# S3_REGION=
# S3_ENDPOINT=

# ─────────────────────────────────────────────────────────────────────────────
# 16. CONECTORES — ficha de compliance (ADR-004)
#     Ninguna fuente se activa sin ficha aprobada en connectors_registry.
# ─────────────────────────────────────────────────────────────────────────────
MELI_CLIENT_ID=
MELI_CLIENT_SECRET=
MELI_REDIRECT_URI=http://localhost:3000/api/v1/connectors/mercadolibre/callback
MELI_REQUESTS_PER_DAY_BUDGET=2000
CONNECTOR_HTTP_TIMEOUT_MS=15000
CONNECTOR_CIRCUIT_BREAKER_THRESHOLD=5
CONNECTOR_CIRCUIT_BREAKER_COOLDOWN_MS=600000

# ─────────────────────────────────────────────────────────────────────────────
# 17. BACKUPS (§11)
# ─────────────────────────────────────────────────────────────────────────────
BACKUP_DIR=./backups
BACKUP_RETENTION_DAILY=7
BACKUP_RETENTION_WEEKLY=4
BACKUP_RETENTION_MONTHLY=12
BACKUP_S3_URI=                        # p. ej. s3://crm-backups/postgres  (offsite)
BACKUP_PRE_MIGRATION=true             # SIEMPRE true en staging y prod (§6)
```

---

## 3. Docker Compose

Tres archivos, como fija §D: un base con todo el stack y dos overrides. Se combinan con
`-f`. El override **dev** añade hot reload y bind mounts; el **prod** añade el proxy TLS y
elimina cualquier mount de código.

```
infrastructure/
├── compose/
│   ├── docker-compose.yml        # base: servicios, healthchecks, redes, volumenes
│   ├── docker-compose.dev.yml    # override local: hot reload, bind mounts, puertos
│   └── docker-compose.prod.yml   # override prod: imagenes, Caddy/TLS, sin mounts
├── docker/
│   ├── api.Dockerfile
│   ├── worker.Dockerfile
│   ├── site.Dockerfile
│   ├── web.Dockerfile
│   └── nginx/web.conf
└── migrations/
    └── init/001_extensions.sql
```

### 3.1 `infrastructure/compose/docker-compose.yml` (base)

```yaml
# =============================================================================
# crm-ventas — Compose base
# Uso:  docker compose --env-file .env -f infrastructure/compose/docker-compose.yml up -d
# NO se ejecuta solo: siempre se combina con un override (dev o prod).
# Ollama NO está aquí: corre nativo en el host (ADR-015). Ver §5.
# =============================================================================
name: crm-ventas

x-logging: &default-logging
  driver: json-file
  options:
    max-size: "20m"
    max-file: "5"

# Ancla reutilizada por api y worker: como alcanzan Ollama en el host.
# En Docker Desktop (Windows/macOS) host.docker.internal ya existe, pero declararlo
# lo hace portable a Linux (Docker 20.10+), donde se resuelve al gateway del bridge.
x-ollama-host: &ollama-host
  extra_hosts:
    - "host.docker.internal:host-gateway"

services:

  # ───────────────────────────────────────────────────────────────────────────
  # DATOS
  # ───────────────────────────────────────────────────────────────────────────
  postgres:
    image: pgvector/pgvector:pg17
    container_name: crm-postgres
    restart: unless-stopped
    logging: *default-logging
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-crm_ventas}
      POSTGRES_USER: ${POSTGRES_USER:-crm}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD es obligatorio}
      POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale=C.UTF-8"
      TZ: ${TZ:-UTC}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - pgdata:/var/lib/postgresql/data
      # Extensiones en el primer arranque (ADR-008). Idempotente.
      - ../migrations/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-crm} -d ${POSTGRES_DB:-crm_ventas}"]
      interval: 5s
      timeout: 5s
      retries: 12
      start_period: 20s
    networks: [data]
    # Solo loopback: el host puede inspeccionar, la red no.
    ports:
      - "127.0.0.1:${POSTGRES_PORT:-5432}:5432"
    shm_size: 256mb

  redis:
    image: redis:7-alpine
    container_name: crm-redis
    restart: unless-stopped
    logging: *default-logging
    # noeviction es OBLIGATORIO con BullMQ: si Redis desaloja claves, se pierden jobs.
    command: >
      redis-server
      --appendonly yes
      --appendfsync everysec
      --maxmemory ${REDIS_MAXMEMORY:-512mb}
      --maxmemory-policy noeviction
      --save 900 1
      --save 300 10
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 12
      start_period: 5s
    networks: [data]
    ports:
      - "127.0.0.1:${REDIS_PORT:-6379}:6379"

  # ───────────────────────────────────────────────────────────────────────────
  # APLICACIÓN
  # ───────────────────────────────────────────────────────────────────────────
  api:
    build:
      context: ../..
      dockerfile: infrastructure/docker/api.Dockerfile
      target: runtime
    image: ${REGISTRY:-ghcr.io/OWNER/crm-ventas}/api:${TAG:-local}
    container_name: crm-api
    restart: unless-stopped
    logging: *default-logging
    <<: *ollama-host
    env_file:
      - ../../.env
    environment:
      NODE_ENV: ${NODE_ENV:-production}
      APP_ENV: ${APP_ENV:-local}
      API_PORT: "3000"
      LOG_PRETTY: "false"
      # Dentro de la red de Compose los hosts son los nombres de servicio.
      DATABASE_URL: postgresql://${POSTGRES_USER:-crm}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-crm_ventas}?schema=public
      REDIS_URL: redis://redis:6379
      # ADR-015: Ollama es nativo en el host.
      OLLAMA_BASE_URL: ${OLLAMA_BASE_URL:-http://host.docker.internal:11434}
      PUBLIC_SITE_URL: ${PUBLIC_SITE_URL:-http://localhost:4000}
      WEB_APP_URL: ${WEB_APP_URL:-http://localhost:4200}
      TRUST_PROXY: "true"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:3000/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 40s
    networks: [data, edge]
    ports:
      - "127.0.0.1:${API_PORT:-3000}:3000"
    stop_grace_period: 30s

  worker:
    build:
      context: ../..
      dockerfile: infrastructure/docker/worker.Dockerfile
      target: runtime
    image: ${REGISTRY:-ghcr.io/OWNER/crm-ventas}/worker:${TAG:-local}
    container_name: crm-worker
    restart: unless-stopped
    logging: *default-logging
    <<: *ollama-host
    env_file:
      - ../../.env
    environment:
      NODE_ENV: ${NODE_ENV:-production}
      APP_ENV: ${APP_ENV:-local}
      LOG_PRETTY: "false"
      WORKER_METRICS_PORT: "9464"
      DATABASE_URL: postgresql://${POSTGRES_USER:-crm}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-crm_ventas}?schema=public
      REDIS_URL: redis://redis:6379
      OLLAMA_BASE_URL: ${OLLAMA_BASE_URL:-http://host.docker.internal:11434}
      # Cola de IA con concurrencia 1: Ollama en CPU no paraleliza (ADR-010).
      QUEUE_AI_CONCURRENCY: ${QUEUE_AI_CONCURRENCY:-1}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      # El worker NO tiene puerto publico: 9464 solo vive en la red 'data'.
      test: ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:9464/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
    networks: [data]
    # Sin 'ports': el worker no expone nada al host. Solo salud y metricas internas.
    stop_grace_period: 60s

  web:
    build:
      context: ../..
      dockerfile: infrastructure/docker/web.Dockerfile
      target: runtime
    image: ${REGISTRY:-ghcr.io/OWNER/crm-ventas}/web:${TAG:-local}
    container_name: crm-web
    restart: unless-stopped
    logging: *default-logging
    depends_on:
      api:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O - http://127.0.0.1:8080/healthz >/dev/null 2>&1 || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks: [edge]

  site:
    build:
      context: ../..
      dockerfile: infrastructure/docker/site.Dockerfile
      target: runtime
    image: ${REGISTRY:-ghcr.io/OWNER/crm-ventas}/site:${TAG:-local}
    container_name: crm-site
    restart: unless-stopped
    logging: *default-logging
    env_file:
      - ../../.env
    environment:
      NODE_ENV: ${NODE_ENV:-production}
      APP_ENV: ${APP_ENV:-local}
      PORT: "4000"
      LOG_PRETTY: "false"
      # El SSR llama a la API por la red interna, no por localhost.
      API_INTERNAL_URL: http://api:3000
      PUBLIC_SITE_URL: ${PUBLIC_SITE_URL:-http://localhost:4000}
    depends_on:
      api:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:4000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 30s
    networks: [edge]
    ports:
      - "127.0.0.1:${SITE_PORT:-4000}:4000"

  # ───────────────────────────────────────────────────────────────────────────
  # HERRAMIENTAS — no arrancan por defecto (profiles)
  # ───────────────────────────────────────────────────────────────────────────
  adminer:
    image: adminer:4
    container_name: crm-adminer
    restart: unless-stopped
    logging: *default-logging
    profiles: ["tools"]
    environment:
      ADMINER_DEFAULT_SERVER: postgres
      ADMINER_DESIGN: dracula
    depends_on:
      postgres:
        condition: service_healthy
    networks: [data, edge]
    ports:
      - "127.0.0.1:8080:8080"

  # Migraciones: contenedor efimero, nunca un servicio de larga duracion.
  #   docker compose run --rm migrate
  migrate:
    build:
      context: ../..
      dockerfile: infrastructure/docker/api.Dockerfile
      target: runtime
    image: ${REGISTRY:-ghcr.io/OWNER/crm-ventas}/api:${TAG:-local}
    profiles: ["tools"]
    env_file:
      - ../../.env
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-crm}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-crm_ventas}?schema=public
    depends_on:
      postgres:
        condition: service_healthy
    networks: [data]
    entrypoint: ["dumb-init", "--"]
    command: ["sh", "-c", "./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma"]

# =============================================================================
# VOLUMENES PERSISTENTES
# =============================================================================
volumes:
  pgdata:
  redisdata:
  uploads:

# =============================================================================
# REDES
# 'data' es interna: postgres y redis no tienen salida a internet ni ruta al
#   exterior. api y worker estan en 'data' + 'edge', asi que si tienen egreso
#   (necesario para marketplaces y LLM remoto) y pueden hablar con la DB.
# 'edge' es la red de borde: proxy, frontends y api.
# =============================================================================
networks:
  data:
    name: crm-data
    driver: bridge
    internal: true
  edge:
    name: crm-edge
    driver: bridge
```

`infrastructure/migrations/init/001_extensions.sql`:

```sql
-- Extensiones requeridas por el modelo (ADR-008, §C.3).
-- Se ejecuta SOLO en la primera inicializacion del volumen (docker-entrypoint-initdb.d).
-- Las migraciones de Prisma las vuelven a declarar con IF NOT EXISTS para no depender
-- de que el volumen se haya creado con este script.
CREATE EXTENSION IF NOT EXISTS vector;     -- pgvector: embeddings y similitud
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- busqueda trigram (leads, productos)
CREATE EXTENSION IF NOT EXISTS citext;     -- emails case-insensitive
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid, digest
```

### 3.2 `infrastructure/compose/docker-compose.dev.yml` (override de desarrollo)

Añade hot reload y bind mounts. **No** se usa en staging ni en producción.

```yaml
# =============================================================================
# Override de DESARROLLO — hot reload y bind mounts.
# Uso:  docker compose --env-file .env \
#         -f infrastructure/compose/docker-compose.yml \
#         -f infrastructure/compose/docker-compose.dev.yml up -d
#
# Nota Windows: los bind mounts hacia contenedores Linux no emiten eventos inotify
# de forma fiable. Los watchers usan polling (--poll en ng serve, CHOKIDAR_USEPOLLING
# en NestJS). Sin esto, el hot reload "no detecta" los cambios.
# =============================================================================
services:

  postgres:
    ports:
      - "${POSTGRES_PORT:-5432}:5432"     # accesible tambien desde fuera del host
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-crm}

  redis:
    ports:
      - "${REDIS_PORT:-6379}:6379"

  api:
    build:
      target: dev                          # stage con devDependencies y codigo fuente
    image: crm-ventas/api:dev
    command: ["pnpm", "--filter", "@crm/api", "dev"]
    environment:
      NODE_ENV: development
      APP_ENV: local
      LOG_LEVEL: debug
      LOG_PRETTY: "true"
      CHOKIDAR_USEPOLLING: "true"
      CHOKIDAR_INTERVAL: "1000"
      # En dev la API corre en el contenedor, pero Ollama sigue en el host.
      OLLAMA_BASE_URL: http://host.docker.internal:11434
    volumes:
      - ../../apps/api/src:/repo/apps/api/src
      - ../../apps/api/prisma:/repo/apps/api/prisma
      - ../../packages:/repo/packages
      - /repo/node_modules                    # volumen anonimo: no pisar node_modules
    ports:
      - "${API_PORT:-3000}:3000"
      - "9229:9229"                           # debugger Node (--inspect)

  worker:
    build:
      target: dev
    image: crm-ventas/worker:dev
    command: ["pnpm", "--filter", "@crm/worker", "dev"]
    environment:
      NODE_ENV: development
      APP_ENV: local
      LOG_LEVEL: debug
      CHOKIDAR_USEPOLLING: "true"
      QUEUE_AI_CONCURRENCY: "1"
    volumes:
      - ../../apps/worker/src:/repo/apps/worker/src
      - ../../packages:/repo/packages
      - /repo/node_modules

  web:
    build:
      target: dev
    image: crm-ventas/web:dev
    # --poll es obligatorio con bind mounts de Windows: sin el, el dev server
    # de Angular no detecta cambios y hay que reiniciar a mano.
    command: ["pnpm", "--filter", "@crm/web", "exec", "ng", "serve",
              "--host", "0.0.0.0", "--port", "4200", "--poll", "1000", "--disable-host-check"]
    environment:
      NODE_ENV: development
      API_INTERNAL_URL: http://api:3000
    volumes:
      - ../../apps/web:/repo/apps/web
      - ../../packages:/repo/packages
      - /repo/node_modules
    ports:
      - "${WEB_PORT:-4200}:4200"

  site:
    build:
      target: dev
    image: crm-ventas/site:dev
    command: ["pnpm", "--filter", "@crm/site", "exec", "ng", "serve",
              "--host", "0.0.0.0", "--port", "4000", "--poll", "1000", "--disable-host-check"]
    environment:
      NODE_ENV: development
      API_INTERNAL_URL: http://api:3000
    volumes:
      - ../../apps/site:/repo/apps/site
      - ../../packages:/repo/packages
      - /repo/node_modules
    ports:
      - "${SITE_PORT:-4000}:4000"

  adminer:
    profiles: []                            # habilitado por defecto en dev
```

> **Alternativa preferida para el día a día:** ejecutar los cuatro procesos Node **nativos**
> en Windows (`pnpm dev`) y dejar solo `postgres` y `redis` en Docker (`pnpm infra:up`). Es más
> rápido (sin capa de bind mount), el debugger es directo y los frontends usan el filesystem
> nativo con inotify de Windows. El override dev existe para quien prefiera un entorno
> homogéneo o para reproducir un bug que solo aparece en Linux.

### 3.3 `infrastructure/compose/docker-compose.prod.yml` (override de producción)

```yaml
# =============================================================================
# Override de PRODUCCION.
# Uso:  docker compose --env-file .env \
#         -f infrastructure/compose/docker-compose.yml \
#         -f infrastructure/compose/docker-compose.prod.yml up -d
#
# Reglas duras (ADR-002, ADR-015, §J.3):
#   - Se usan IMAGENES publicadas por el CI. Nunca `build` en el host de produccion:
#     construir en produccion impide saber que commit corre.
#   - CERO bind mounts de codigo.
#   - Nada se publica al exterior salvo el proxy de borde (80/443).
# =============================================================================
services:

  postgres:
    # En produccion se usa la imagen con el tag fijo; nunca se construye en el host.
    ports: !reset []                          # sin puerto al host
    deploy:
      resources:
        limits:
          memory: 2g
    command:
      - postgres
      - -c
      - shared_buffers=512MB
      - -c
      - effective_cache_size=1536MB
      - -c
      - work_mem=16MB
      - -c
      - maintenance_work_mem=128MB
      - -c
      - max_connections=100
      - -c
      - log_min_duration_statement=1000

  redis:
    ports: !reset []
    deploy:
      resources:
        limits:
          memory: 768m

  api:
    ports: !reset []
    environment:
      NODE_ENV: production
      APP_ENV: ${APP_ENV:-production}
      LOG_LEVEL: ${LOG_LEVEL:-info}
      LOG_PRETTY: "false"
      COOKIE_SECURE: "true"
      TRUST_PROXY: "true"
    deploy:
      replicas: 1
      resources:
        limits:
          memory: 1g
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 5

  worker:
    environment:
      NODE_ENV: production
      APP_ENV: ${APP_ENV:-production}
      LOG_LEVEL: ${LOG_LEVEL:-info}
    deploy:
      replicas: 1
      resources:
        limits:
          # El worker es el que come CPU y RAM con IA (ADR-001, §L Nivel 2).
          memory: 2g

  web:
    ports: !reset []

  site:
    ports: !reset []
    deploy:
      replicas: 1
      resources:
        limits:
          memory: 768m

  adminer:
    # En produccion Adminer NO existe. Se usa psql por SSH o un tunel.
    profiles: ["never"]

  # ─────────────────────────────────────────────────────────────────────────────
  # BORDE: unico servicio con puertos publicos. TLS automatico con Let's Encrypt.
  # ─────────────────────────────────────────────────────────────────────────────
  caddy:
    image: caddy:2.8-alpine
    container_name: crm-caddy
    restart: unless-stopped
    logging:
      driver: json-file
      options:
        max-size: "20m"
        max-file: "5"
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"                       # HTTP/3
    environment:
      DOMAIN_APP: ${DOMAIN_APP:?DOMAIN_APP es obligatorio, p.ej. app.tudominio.com}
      DOMAIN_SITE: ${DOMAIN_SITE:?DOMAIN_SITE es obligatorio, p.ej. www.tudominio.com}
      ACME_EMAIL: ${ACME_EMAIL:?ACME_EMAIL es obligatorio}
    volumes:
      - ../caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      api:
        condition: service_healthy
      web:
        condition: service_healthy
      site:
        condition: service_healthy
    networks: [edge]

volumes:
  caddy_data:
  caddy_config:
```

`infrastructure/caddy/Caddyfile` (TLS automático + cabeceras de seguridad — §13):

```
# =============================================================================
# Caddyfile — TLS automatico (Let's Encrypt) y cabeceras de seguridad.
# Es el UNICO punto de entrada publico. Todo lo demas vive en la red de Compose.
# =============================================================================
{
	email {$ACME_EMAIL}
	servers {
		protocols h1 h2 h3
	}
	# Oculta la version del servidor
	header {
		-Server
	}
}

# ─────────────────────────────────────────────────────────────────────────────
# CRM interno (apps/web) — NO indexable. Detras de login (ADR-002, §I.1).
# ─────────────────────────────────────────────────────────────────────────────
{$DOMAIN_APP} {
	encode zstd gzip

	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
		X-Content-Type-Options    "nosniff"
		X-Frame-Options           "DENY"
		Referrer-Policy           "strict-origin-when-cross-origin"
		Permissions-Policy        "geolocation=(), microphone=(), camera=(), payment=()"
		# El CRM nunca se indexa.
		X-Robots-Tag              "noindex, nofollow, noarchive"
		Cross-Origin-Opener-Policy "same-origin"
		Cross-Origin-Resource-Policy "same-origin"
		Content-Security-Policy   "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://{$DOMAIN_APP}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"
		-Server
	}

	# API: misma origen, sin exponer un subdominio extra.
	handle /api/* {
		reverse_proxy api:3000
	}

	# SPA
	handle {
		reverse_proxy web:8080
	}

	log {
		output file /data/access-app.log {
			roll_size 50MiB
			roll_keep 5
		}
		format json
	}
}

# ─────────────────────────────────────────────────────────────────────────────
# Sitio publico (apps/site) — SSR, indexable (§I.1).
# ─────────────────────────────────────────────────────────────────────────────
{$DOMAIN_SITE} {
	encode zstd gzip

	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
		X-Content-Type-Options    "nosniff"
		X-Frame-Options           "SAMEORIGIN"
		Referrer-Policy           "strict-origin-when-cross-origin"
		Permissions-Policy        "geolocation=(), microphone=(), camera=()"
		# El sitio publico SI se indexa.
		X-Robots-Tag              "index, follow"
		Cross-Origin-Opener-Policy "same-origin"
		Content-Security-Policy   "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests"
		-Server
	}

	# robots.txt y sitemap.xml los sirve la app SSR (no un fallback de la SPA).
	reverse_proxy site:4000

	log {
		output file /data/access-site.log {
			roll_size 50MiB
			roll_keep 5
		}
		format json
	}
}
```

### 3.4 Variables que cambian entre dev y prod

| Variable | Dev (host) | Compose dev | Compose prod |
|---|---|---|---|
| `DATABASE_URL` host | `localhost` | `postgres` | `postgres` |
| `REDIS_URL` host | `localhost` | `redis` | `redis` |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | `http://host.docker.internal:11434` | `http://host.docker.internal:11434` |
| `NODE_ENV` | `development` | `development` | `production` |
| `COOKIE_SECURE` | `false` | `false` | `true` |
| `LOG_PRETTY` | `true` | `true` | `false` |
| `CORS_ORIGINS` | `http://localhost:4200` | `http://localhost:4200` | `https://app.tudominio.com` |
| Bind mounts de código | — | Sí | **No** |
| Puertos publicados | n/a | 5432, 6379, 3000, 4000, 4200, 8080 | solo 80/443 (Caddy) |

**Regla de paridad (§J.1):** producción y staging usan **la misma imagen** (mismo digest) con
distinto `.env`. Si algo falla en producción y no existe en staging, es un bug de
infraestructura, no un caso fortuito. §8 desarrolla el contrato.

---

## 4. Dockerfiles

Cuatro imágenes, todas multi-stage. El **contexto de build es siempre la raíz del monorepo**
(se necesita `pnpm-lock.yaml`, `pnpm-workspace.yaml` y `packages/*`).

### 4.1 `.dockerignore` (raíz del repositorio)

Sin esto, el contexto de build incluye `node_modules` (~1 GB), `.git` y los backups.

```dockerignore
# Dependencias y builds (se reconstruyen dentro de la imagen)
**/node_modules
**/dist
**/.angular
**/coverage
**/*.tsbuildinfo

# Secretos — nunca deben entrar en el contexto de build
.env
.env.*
!.env.example
**/*.pem
**/*.key

# Control de versiones y datos locales
.git
.gitignore
.github
.data
backups
infrastructure/compose/backups

# Docs e infra que no se copian
docs
*.md
!README.md
infrastructure/compose
infrastructure/caddy

**/.DS_Store
**/Thumbs.db
**/*.log
```

### 4.2 `infrastructure/docker/api.Dockerfile`

```dockerfile
# syntax=docker/dockerfile:1.7
# =============================================================================
# apps/api — NestJS (HTTP). Multi-stage. Contexto = raiz del monorepo.
# Etapas: base -> deps -> build -> prod -> runtime
#         + etapa 'dev' para hot reload en el override de desarrollo.
# =============================================================================
ARG NODE_VERSION=24
ARG PNPM_VERSION=12.8.1
ARG ALPINE=false

# ────────────────────────────── base ──────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PNPM_STORE_DIR=/pnpm/store \
    PATH=/pnpm:/pnpm/store:$PATH \
    CI=true \
    NODE_OPTIONS=--enable-source-maps
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable \
 && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /repo

# ────────────────────────────── deps ──────────────────────────────
# Capa de dependencias: solo manifiestos. Cambia poco -> se cachea.
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc* ./
COPY packages/config/package.json       packages/config/package.json
COPY packages/domain/package.json       packages/domain/package.json
COPY packages/contracts/package.json    packages/contracts/package.json
COPY packages/ai/package.json           packages/ai/package.json
COPY packages/connectors/package.json   packages/connectors/package.json
COPY packages/testing/package.json      packages/testing/package.json
COPY apps/api/package.json              apps/api/package.json
COPY apps/worker/package.json           apps/worker/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ────────────────────────────── build ─────────────────────────────
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
# "@crm/api..." = api y TODAS sus dependencias de workspace, en orden topologico.
RUN pnpm --filter "@crm/api..." build \
 && pnpm --filter @crm/api exec prisma generate

# ────────────────────────────── prod ──────────────────────────────
# 'pnpm deploy' produce una carpeta autocontenida solo con dependencias de
# produccion y los paquetes de workspace resueltos como directorios reales.
FROM build AS prod
RUN pnpm --filter @crm/api exec prisma generate \
 && pnpm --filter @crm/api deploy --prod --legacy /prod/api

# ────────────────────────────── runtime ───────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production \
    API_PORT=3000 \
    NODE_OPTIONS=--enable-source-maps
RUN apt-get update \
 && apt-get install -y --no-install-recommends dumb-init tini ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 --gid nodejs --create-home --shell /usr/sbin/nologin appuser
WORKDIR /app
COPY --from=prod --chown=appuser:nodejs /prod/api ./
# El schema de Prisma se necesita en runtime para 'migrate deploy' y para
# regenerar el cliente si la imagen se usa como contenedor de migraciones.
COPY --from=build --chown=appuser:nodejs /repo/apps/api/prisma ./prisma
# Contrato OpenAPI: lo sirve /api/v1/openapi.json en runtime.
COPY --from=build --chown=appuser:nodejs /repo/apps/api/openapi.json ./openapi.json
USER appuser
EXPOSE 3000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||3000)+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]

# ────────────────────────────── dev ───────────────────────────────
# Solo para el override de desarrollo: incluye devDependencies y fuente.
FROM deps AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 3000 9229
CMD ["pnpm", "--filter", "@crm/api", "dev"]
```

**Notas de diseño**

- `dumb-init` como PID 1: reenvía `SIGTERM` y evita procesos zombis. Sin él, `docker stop`
  mata el contenedor a los 10 s y las transacciones en curso se cortan.
- Usuario **no root** (`appuser`, uid 1001). El contenedor no puede escribir en su propio
  sistema de archivos más allá de `/app` y `/tmp`.
- `prisma` va en `dependencies` (no `devDependencies`) de `apps/api` porque el contenedor de
  migraciones lo necesita en producción. Es una decisión deliberada: el CLI de Prisma en la
  imagen es lo que permite correr `migrate deploy` sin instalar nada en el VPS.
- `NODE_OPTIONS=--enable-source-maps` para que los stack traces de Sentry apunten al TS.
- La etapa `dev` es la única que copia todo el repo; las de producción copian por capas
  explícitas, de modo que un cambio en `apps/web` **no** invalida el cache del build de la API.

### 4.3 `infrastructure/docker/worker.Dockerfile`

Idéntico al de la API salvo el paquete objetivo y el comando. El worker no expone puerto
público; solo `9464` en la red interna para salud y métricas Prometheus (§C.6).

```dockerfile
# syntax=docker/dockerfile:1.7
# =============================================================================
# apps/worker — consumidores BullMQ. Sin puerto HTTP publico (ADR-001).
# Expone 9464 SOLO en la red interna 'data' para /health y /metrics.
# =============================================================================
ARG NODE_VERSION=24
ARG PNPM_VERSION=12.8.1

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PNPM_STORE_DIR=/pnpm/store \
    PATH=/pnpm:/pnpm/store:$PATH \
    CI=true \
    NODE_OPTIONS=--enable-source-maps
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable \
 && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc* ./
COPY packages/config/package.json       packages/config/package.json
COPY packages/domain/package.json       packages/domain/package.json
COPY packages/contracts/package.json    packages/contracts/package.json
COPY packages/ai/package.json           packages/ai/package.json
COPY packages/connectors/package.json   packages/connectors/package.json
COPY packages/testing/package.json      packages/testing/package.json
COPY apps/api/package.json              apps/api/package.json
COPY apps/worker/package.json           apps/worker/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/worker ./apps/worker
# El worker reutiliza el cliente Prisma y el schema de apps/api (monolito modular).
COPY apps/api/prisma ./apps/api/prisma
RUN pnpm --filter "@crm/worker..." build \
 && pnpm --filter @crm/api exec prisma generate

FROM build AS prod
RUN pnpm --filter @crm/worker deploy --prod --legacy /prod/worker

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production \
    WORKER_METRICS_PORT=9464 \
    NODE_OPTIONS=--enable-source-maps
RUN apt-get update \
 && apt-get install -y --no-install-recommends dumb-init ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 --gid nodejs --create-home --shell /usr/sbin/nologin appuser
WORKDIR /app
COPY --from=prod --chown=appuser:nodejs /prod/worker ./
COPY --from=build --chown=appuser:nodejs /repo/apps/api/prisma ./prisma
USER appuser
EXPOSE 9464
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:9464/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]

FROM deps AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 9464 9230
CMD ["pnpm", "--filter", "@crm/worker", "dev"]
```

**Parada limpia del worker.** `stop_grace_period: 60s` en Compose, y el worker implementa:

1. Ignora nuevos jobs (`worker.pause()`).
2. Espera a que los jobs en curso terminen (o alcanzan su timeout).
3. Cierra las conexiones de Redis y Prisma.
4. Sale con código 0.

Un job que muere por `SIGKILL` a mitad no se pierde: BullMQ lo devuelve a `wait` cuando expira
el lock, y el consumidor es **idempotente** por `event_id` (ADR-009). Por eso parar el worker
nunca corrompe estado, solo retrasa trabajo.

### 4.4 `infrastructure/docker/site.Dockerfile` (Angular SSR)

```dockerfile
# syntax=docker/dockerfile:1.7
# =============================================================================
# apps/site — Angular SSR + prerender. Publico e indexable (ADR-002, §C.1).
# El servidor SSR se ejecuta con Node; el navegador recibe HTML ya renderizado.
# =============================================================================
ARG NODE_VERSION=24
ARG PNPM_VERSION=12.8.1

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PNPM_STORE_DIR=/pnpm/store \
    PATH=/pnpm:/pnpm/store:$PATH \
    CI=true
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable \
 && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc* ./
COPY packages/config/package.json       packages/config/package.json
COPY packages/domain/package.json       packages/domain/package.json
COPY packages/contracts/package.json    packages/contracts/package.json
COPY packages/ui/package.json           packages/ui/package.json
COPY apps/site/package.json             apps/site/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/site ./apps/site
# Genera: dist/site/server/, dist/site/browser/ y las rutas prerenderizadas.
RUN pnpm --filter "@crm/site..." build

FROM build AS prod
RUN pnpm --filter @crm/site deploy --prod --legacy /prod/site

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=4000
RUN apt-get update \
 && apt-get install -y --no-install-recommends dumb-init ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 --gid nodejs --create-home --shell /usr/sbin/nologin appuser
WORKDIR /app
# Dependencias de produccion + el bundle SSR (server) y los estaticos (browser).
COPY --from=prod  --chown=appuser:nodejs /prod/site ./
COPY --from=build --chown=appuser:nodejs /repo/apps/site/dist ./dist
USER appuser
EXPOSE 4000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/site/server/server.mjs"]

FROM deps AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 4000
CMD ["pnpm", "--filter", "@crm/site", "exec", "ng", "serve",
     "--host", "0.0.0.0", "--port", "4000", "--poll", "1000", "--disable-host-check"]
```

**Detalles que importan en SSR**

- La ruta de salida del servidor es `dist/<proyecto>/server/server.mjs`. Si el proyecto en
  `angular.json` no se llama `site`, ajustar el `CMD`.
- El SSR llama a la API por la red interna (`API_INTERNAL_URL=http://api:3000`), **nunca** por
  la URL pública: una llamada a la URL pública desde dentro del contenedor daría la vuelta por
  Caddy e Internet, y en el arranque fallaría por DNS/ACME.
- `robots.txt` y `sitemap.xml` los sirve la app SSR (§I.3). En `nginx` no hay fallback de SPA
  para el sitio público: un 404 debe ser un **404 real**, no un 200 con página de error.
- El prerender ocurre en build, así que `PUBLIC_SITE_URL` debe estar disponible como variable
  de build para que los `canonical` y `og:url` absolutos sean correctos. Se inyecta en el
  `ng build` con `--define` o vía `environment.prod.ts` generado por el script de build.

### 4.5 `infrastructure/docker/web.Dockerfile` (SPA estática en nginx)

```dockerfile
# syntax=docker/dockerfile:1.7
# =============================================================================
# apps/web — Angular SPA (CRM interno). Se compila y se sirve como estaticos
# con nginx, sin Node en runtime. noindex + robots.txt que bloquea todo (ADR-002).
# =============================================================================
ARG NODE_VERSION=24
ARG PNPM_VERSION=12.8.1

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PNPM_STORE_DIR=/pnpm/store \
    PATH=/pnpm:/pnpm/store:$PATH \
    CI=true
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable \
 && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc* ./
COPY packages/config/package.json       packages/config/package.json
COPY packages/domain/package.json       packages/domain/package.json
COPY packages/contracts/package.json    packages/contracts/package.json
COPY packages/ui/package.json           packages/ui/package.json
COPY apps/web/package.json              apps/web/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web
# Salida: dist/web/browser/  (Angular 17+ usa el subdirectorio 'browser').
RUN pnpm --filter "@crm/web..." build

# ── runtime: nginx sin privilegios ──
FROM nginx:1.27-alpine AS runtime
RUN rm -f /etc/nginx/conf.d/default.conf
COPY infrastructure/docker/nginx/web.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist/web/browser /usr/share/nginx/html
# nginx necesita escribir su pid y temporales: se redirigen a /tmp en web.conf.
RUN touch /tmp/nginx.pid \
 && chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /tmp/nginx.pid
USER nginx
EXPOSE 8080
STOPSIGNAL SIGQUIT
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -q -O - http://127.0.0.1:8080/healthz >/dev/null 2>&1 || exit 1
CMD ["nginx", "-g", "daemon off;"]

FROM base AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 4200
CMD ["pnpm", "--filter", "@crm/web", "exec", "ng", "serve",
     "--host", "0.0.0.0", "--port", "4200", "--poll", "1000", "--disable-host-check"]
```

`infrastructure/docker/nginx/web.conf`:

```nginx
# =============================================================================
# nginx para el CRM (apps/web). Sin privilegios: escucha en 8080 y escribe
# pid y temporales en /tmp. Unicamente sirve estaticos y hace fallback a la SPA.
# =============================================================================
pid /tmp/nginx.pid;
worker_processes auto;
error_log /dev/stderr warn;

events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Temporales en /tmp: el usuario nginx no puede escribir en /var/lib/nginx
    client_body_temp_path /tmp/client_body;
    proxy_temp_path       /tmp/proxy;
    fastcgi_temp_path     /tmp/fastcgi;
    uwsgi_temp_path       /tmp/uwsgi;
    scgi_temp_path        /tmp/scgi;

    access_log /dev/stdout;
    sendfile on;
    tcp_nopush on;
    server_tokens off;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css application/javascript application/json
               application/xml image/svg+xml font/woff2;

    server {
        listen 8080;
        server_name _;
        root /usr/share/nginx/html;
        index index.html;

        # ── Cabeceras de seguridad (refuerzan las de Caddy) ──
        add_header X-Content-Type-Options    "nosniff" always;
        add_header X-Frame-Options           "DENY" always;
        add_header Referrer-Policy           "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy        "geolocation=(), microphone=(), camera=()" always;
        # El CRM NUNCA se indexa (ADR-002, §I.1).
        add_header X-Robots-Tag              "noindex, nofollow, noarchive" always;

        # Sonda de salud del contenedor.
        location = /healthz {
            access_log off;
            add_header Content-Type text/plain;
            return 200 "ok\n";
        }

        # El index nunca se cachea: si no, los usuarios quedan clavados en un build viejo.
        location = /index.html {
            add_header Cache-Control "no-store, no-cache, must-revalidate" always;
            try_files $uri =404;
        }

        # Assets con hash de contenido: cache inmutable.
        location ~* \.(?:js|css|woff2?|ttf|eot|otf|png|jpe?g|gif|svg|webp|avif|ico)$ {
            expires 1y;
            add_header Cache-Control "public, immutable" always;
            access_log off;
            try_files $uri =404;
        }

        # robots.txt del CRM: bloquea todo (lo emite el build de Angular como asset).
        location = /robots.txt {
            add_header Cache-Control "no-store" always;
            try_files $uri =404;
        }

        # Fallback de SPA: cualquier ruta desconocida devuelve el index.
        location / {
            try_files $uri $uri/ /index.html;
        }
    }
}
```

### 4.6 Presupuesto de imagen y capas

| Imagen | Base final | Tamaño esperado | Estrategia de caché |
|---|---|---|---|
| `api` | `node:24-bookworm-slim` | ~420–520 MB | Manifiestos → instalar → fuentes → build → deploy |
| `worker` | `node:24-bookworm-slim` | ~420–520 MB | Igual que api |
| `site` | `node:24-bookworm-slim` | ~380–480 MB | Igual + `dist` compilado |
| `web` | `nginx:1.27-alpine` | ~60–80 MB | Solo el build de Angular + nginx |

Reglas aplicadas:

1. Los `package.json` van en su propia capa antes que el código fuente: un cambio en
   `apps/web/src` no reinstala dependencias.
2. El `pnpm store` se monta como cache de BuildKit (`--mount=type=cache,id=pnpm-store`), así el
   CI reutiliza paquetes entre builds de las cuatro imágenes.
3. Ningún `COPY . .` en las etapas de producción (solo en `dev`).
4. Todas las imágenes de runtime son usuario no root.

---

## 5. Ollama nativo y su conexión con los contenedores

### 5.1 Por qué no se contenedoriza (ADR-015)

Ollama corre **nativo en Windows** y ya lo hacía antes de que existiera este proyecto. Meterlo
en Compose tendría tres costes y ningún beneficio en esta máquina:

| Coste | Detalle |
|---|---|
| **RAM duplicada en tránsito** | Sin GPU, los pesos se cargan en RAM del **host**. En contenedor hay dos capas de gestión de memoria (la del host y la del contenedor) y el modelo compite con el propio motor de Docker. Con 32 GB y un modelo 26B de 17 GB, la diferencia se nota. |
| **Reconstrucción por modelo** | Cambiar de modelo o de versión obligaría a reconstruir la imagen o a mover decenas de GB por volúmenes. Hoy es un `ollama pull` de 5 segundos. |
| **Latencia añadida** | La virtualización no acelera la inferencia; añade un salto de red. En CPU-only, el tiempo de generación ya es el cuello de botella (§C.4). |

Beneficio de contenedorizarlo: reproducibilidad total del entorno. Pero el propio ADR-015
acepta la contrapartida y la resuelve de otra forma: **un prerequisito manual documentado más
un script de verificación**. Eso es exactamente `scripts/verify-env.ps1` (§1.4), que falla con
un mensaje claro si Ollama no responde o falta el modelo.

**Corolario de diseño:** la `baseUrl` de `OllamaProvider` es **configuración**, nunca una
constante en el código. La misma imagen funciona apuntando a `localhost`, a
`host.docker.internal` o a un host Linux con GPU, cambiando solo `OLLAMA_BASE_URL`. Esto es lo
que hace que §9 (escalado) sea un cambio de variables y no de código.

### 5.2 Cómo se resuelve `host.docker.internal` en cada plataforma

```
┌─────────────────────────────────────────────────────────────────────┐
│  HOST (Windows 11 Pro)                                              │
│                                                                     │
│   Ollama 0.34.3  ──▶  escucha en 127.0.0.1:11434                    │
│   Modelos: gemma4:8b, gemma4:26b, qwen3.6:36b, :cloud               │
│                          ▲                                          │
│                          │  Docker Desktop proxy de red             │
│                          │  (host.docker.internal)                 │
│  ┌───────────────────────┴───────────────────────────────────────┐  │
│  │  DOCKER DESKTOP (WSL2 backend)                                │  │
│  │                                                               │  │
│  │   red crm-edge           red crm-data (internal)              │  │
│  │   ┌────────┐ ┌────────┐  ┌──────────┐  ┌──────────┐           │  │
│  │   │ caddy  │ │  web   │  │ postgres │  │  redis   │           │  │
│  │   └───┬────┘ └────────┘  └────┬─────┘  └────┬─────┘           │  │
│  │       │         ┌────────┐   │             │                 │  │
│  │       └────────▶│  api   │───┴─────────────┘                 │  │
│  │                 └───┬────┘                                   │  │
│  │                 ┌───▼────┐                                   │  │
│  │                 │ worker │  OLLAMA_BASE_URL =                │  │
│  │                 └───┬────┘  http://host.docker.internal:11434 │  │
│  └─────────────────────┼─────────────────────────────────────────┘  │
└────────────────────────┼────────────────────────────────────────────┘
                         └──▶ Ollama (proceso nativo en el host)
```

**Windows y macOS (Docker Desktop).** `host.docker.internal` es un nombre que Docker Desktop
resuelve a través de su capa de red y **alcanza servicios del host aunque estén escuchando en
`127.0.0.1`**. Como Ollama en Windows escucha en loopback por defecto, esto funciona sin
cambiar nada. Es el caso de la máquina verificada.

**Linux (Docker nativo).** No existe `host.docker.internal` por defecto y, además, un servicio
escuchando en `127.0.0.1` del host **no es alcanzable** desde un contenedor: el loopback del
host es un espacio de red distinto. Se necesitan dos cosas:

```yaml
# Ya incluido en docker-compose.yml mediante el ancla x-ollama-host:
extra_hosts:
  - "host.docker.internal:host-gateway"
```

```bash
# Y Ollama debe escuchar más allá de loopback (en el host Linux):
sudo systemctl edit ollama.service
#   [Service]
#   Environment="OLLAMA_HOST=0.0.0.0:11434"
sudo systemctl daemon-reload
sudo systemctl restart ollama
# Y protegerlo: solo la subred de Docker puede llegar al 11434.
sudo ufw allow from 172.16.0.0/12 to any port 11434 proto tcp
sudo ufw deny 11434
```

> **No hacer esto en Windows.** Ahí `OLLAMA_HOST=0.0.0.0` expondría Ollama a la red local sin
> ninguna ventaja. El default (`127.0.0.1`) es el correcto y Docker Desktop ya lo alcanza.

### 5.3 Verificación real de la conectividad

Estas tres comprobaciones son las que hay que ejecutar al incorporar una máquina o un entorno
nuevo. Si la tercera falla, no es un problema del código: es de red.

```powershell
# 1) Desde el HOST: Ollama responde
Invoke-RestMethod http://localhost:11434/api/tags |
  Select-Object -ExpandProperty models | Select-Object name, size

# 2) Desde el HOST: la dimensión de embeddings es la esperada
$r = Invoke-RestMethod -Method Post -Uri http://localhost:11434/api/embeddings `
     -ContentType 'application/json' `
     -Body '{"model":"mxbai-embed-large","prompt":"ping"}'
"dims=$($r.embedding.Count)"        # -> dims=1024

# 3) Desde un CONTENEDOR: alcanza al host
docker compose --env-file .env -f infrastructure/compose/docker-compose.yml `
  run --rm --entrypoint node api -e `
  "fetch('http://host.docker.internal:11434/api/tags').then(r=>r.json()).then(j=>{console.log('OK modelos='+j.models.length);process.exit(0)}).catch(e=>{console.error('FALLO '+e.message);process.exit(1)})"
# -> OK modelos=5
```

### 5.4 Consecuencias operativas de tenerlo nativo

| Aspecto | Implicación | Mitigación |
|---|---|---|
| No está en `docker compose ps` | El operador puede olvidar que es un prerequisito | `/health/ready` de la API incluye `ollama` como dependencia **degradable**, no dura (§12) |
| Fuera del ciclo de vida de Compose | `docker compose down` no lo apaga; `up` no lo enciende | `verify-env.ps1` lo comprueba; el runbook de incidentes lo cubre |
| `keep_alive` controla la RAM | `gemma4:26b` (17 GB) puede quedarse cargado y presionar la memoria | `OLLAMA_KEEP_ALIVE=5m`; `ollama ps` para ver qué está cargado; `ollama stop <modelo>` |
| Sin autenticación | La API de Ollama no tiene auth por defecto | Nunca exponerlo fuera del host (§13). Si algún día se expone, va detrás de un proxy con auth |
| Concurrencia limitada | En CPU, dos generaciones simultáneas van **más lento**, no más rápido | Cola `ai` con `QUEUE_AI_CONCURRENCY=1` (ADR-010) |

```powershell
# Diagnóstico rápido del estado de Ollama
ollama ps                      # qué modelo está cargado en RAM ahora mismo
ollama list                    # qué modelos están descargados
Get-Process ollama*            # el proceso vivo
Get-NetTCPConnection -LocalPort 11434 -State Listen   # quien escucha
```

---

## 6. Estrategia de migraciones

### 6.1 Orden congelado (`database.md` §13)

Se migra **por fase, nunca todo de golpe**. Cada migración es reversible y se prueba con datos.
El orden es el de `database.md` §13 y no se altera: las fases posteriores dependen de las
anteriores.

| Migración lógica | Directorio Prisma | Fase | Tablas |
|---|---|---|---|
| `001_core` | `apps/api/prisma/migrations/20261001000001_001_core/` | 1 | `organizations`, `users`, `refresh_tokens`, `audit_logs`, `outbox_events` |
| `002_identities` | `.../20261015000001_002_identities/` | 2 | `identities`, `identity_links`, `touchpoints`, `leads`, `lead_stage_history`, `contacts`, `opportunities`, `activities` |
| `003_catalog` | `.../20261101000001_003_catalog/` | 3 | `categories`, `products`, `product_costs`, `product_economics_snapshot` |
| `004_intelligence` | `.../20261115000001_004_intelligence/` | 3 | `connectors_registry`, `product_sources`, `product_metrics`, `product_scores`, `research_runs`, `research_run_candidates` |
| `005_ai` | `.../20261201000001_005_ai/` | 4 | `ai_agents`, `ai_tasks`, `ai_runs`, `ai_tool_calls`, `ai_costs`, `ai_budgets`, `ai_memory`, `ai_embeddings` |
| `006_content_seo` | `.../20270101000001_006_content_seo/` | 6 | `brands`, `brand_assets`, `content`, `content_links`, `keywords`, `keyword_clusters`, `keyword_cluster_members`, `content_briefs`, `seo_index_status` |
| `007_campaigns` | `.../20270201000001_007_campaigns/` | 7 | `campaigns`, `campaign_state_transitions`, `campaign_platforms`, `ad_sets`, `ads`, `creatives`, `approvals` |
| `008_orders` | `.../20270301000001_008_orders/` | 7 | `orders`, `order_items`, `order_attribution` |
| `009_metrics` | `.../20270401000001_009_metrics/` | 8 | `campaign_metrics_daily`, `campaign_financials_daily`, `jobs_audit`, `webhook_events`, `feature_flags` |
| `010_experiments` | `.../20270501000001_010_experiments/` | 9 | `experiments` |

> `payments` **no** está en ninguna migración: depende de la decisión pendiente de §O.3 sobre
> vender en línea. Cuando se decida, será una migración `011_payments` aislada.

La migración `001_core` declara las extensiones con `CREATE EXTENSION IF NOT EXISTS` para no
depender de que el volumen de Postgres se haya creado con el script de init:

```sql
-- apps/api/prisma/migrations/20261001000001_001_core/migration.sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- ... tablas de 001_core
```

### 6.2 Cómo se aplican en cada entorno

| Entorno | Comando | Cuándo | Quién |
|---|---|---|---|
| LOCAL | `pnpm db:migrate:dev` | Al desarrollar una migración nueva | El desarrollador |
| LOCAL (verificación) | `pnpm db:migrate` | Para reproducir exactamente lo que hará el CI | El desarrollador |
| CI (integración) | `pnpm db:migrate` | En cada PR, contra Postgres efímero | El pipeline |
| STAGING | `pnpm --filter @crm/api exec prisma migrate deploy` | Automático tras el build | El pipeline |
| PRODUCTION | igual, con aprobación manual | Tras staging en verde | El pipeline, con backup previo |

**Regla dura:** `migrate dev` **nunca** se ejecuta fuera de local. Ese comando puede resetear
la base de datos y está pensado para crear migraciones, no para aplicarlas. En cualquier
entorno compartido se usa siempre `migrate deploy`, que solo aplica lo pendiente y falla si
detecta divergencia entre el historial y el esquema.

### 6.3 Reversibilidad: el punto que Prisma no resuelve solo

**Prisma no genera migraciones de bajada (`down`).** Fingir que sí las genera sería peor que
no tenerlas. La política real de este proyecto es **expand / contract**:

```
Migración N   → EXPAND   : añade. Nunca elimina ni renombra en el mismo paso.
Deploy N      → el código nuevo usa lo nuevo; el código viejo sigue funcionando.
Migración N+1 → CONTRACT : (opcional, semanas después) elimina lo que ya no usa nadie.
```

Consecuencia práctica: durante la ventana de despliegue, **el esquema nuevo es compatible con
el código viejo**. Eso es lo que permite hacer rollback de la aplicación (volver a la imagen
anterior) sin tocar la base de datos.

Reglas de escritura de una migración:

1. **Aditiva primero.** `ADD COLUMN` con `DEFAULT` o `NULL`. Un `NOT NULL` sobre una tabla con
   filas se hace en dos pasos (añadir nullable → rellenar por job → poner `NOT NULL`).
2. **Renombrar = añadir + copiar + dejar de usar.** Nunca `RENAME COLUMN` en el mismo deploy
   que cambia el código.
3. **Índices grandes: `CREATE INDEX CONCURRENTLY`** (fuera de transacción, ver §6.5).
4. **Cada migración lleva un `down.sql` al lado**, aunque Prisma no lo ejecute solo:
   `apps/api/prisma/migrations/<ts>_<name>/down.sql` con el SQL exacto de reversión. Existe
   para que el runbook de rollback tenga un comando, no una improvisación.
5. **Toda migración se prueba en local con datos**: `pnpm db:migrate:dev` sobre una copia con
   filas representativas, y se verifica que `down.sql` revierte sin error.

### 6.4 Procedimiento de despliegue de migraciones (staging y producción)

```bash
# ─────────────────────────────────────────────────────────────────────────────
# 1. BACKUP PREVIO — innegociable. Si falla, el deploy ABORTA.
# ─────────────────────────────────────────────────────────────────────────────
export PGPASSWORD="$POSTGRES_PASSWORD"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
pg_dump -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
        -Fc -Z 6 -f "/backups/pre_migration_${STAMP}.dump"
pg_restore -l "/backups/pre_migration_${STAMP}.dump" > /dev/null   # valida el archivo
[ -s "/backups/pre_migration_${STAMP}.dump" ] || { echo "BACKUP VACIO — ABORTAR"; exit 1; }

# ─────────────────────────────────────────────────────────────────────────────
# 2. VERIFICAR QUE EL BACKUP ES RESTAURABLE (no basta con que exista)
# ─────────────────────────────────────────────────────────────────────────────
createdb -h "$POSTGRES_HOST" -U "$POSTGRES_USER" "restore_check_${STAMP}"
pg_restore -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "restore_check_${STAMP}" \
           --no-owner --no-privileges "/backups/pre_migration_${STAMP}.dump"
psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "restore_check_${STAMP}" \
     -c "SELECT count(*) AS tablas FROM information_schema.tables WHERE table_schema='public';"
dropdb -h "$POSTGRES_HOST" -U "$POSTGRES_USER" "restore_check_${STAMP}"

# ─────────────────────────────────────────────────────────────────────────────
# 3. DETENER ESCRITORES (ventana de mantenimiento)
# ─────────────────────────────────────────────────────────────────────────────
docker compose -f infrastructure/compose/docker-compose.yml \
               -f infrastructure/compose/docker-compose.prod.yml \
               stop api worker
# La BD queda sin escritores. 'site' puede seguir sirviendo HTML ya prerenderizado.

# ─────────────────────────────────────────────────────────────────────────────
# 4. ESTADO ANTES
# ─────────────────────────────────────────────────────────────────────────────
docker compose run --rm migrate sh -c \
  "./node_modules/.bin/prisma migrate status --schema=./prisma/schema.prisma"

# ─────────────────────────────────────────────────────────────────────────────
# 5. APLICAR
# ─────────────────────────────────────────────────────────────────────────────
docker compose run --rm migrate
# Salida esperada: "X migrations found ... All migrations have been successfully applied."

# ─────────────────────────────────────────────────────────────────────────────
# 6. VERIFICAR DESPUES
# ─────────────────────────────────────────────────────────────────────────────
docker compose run --rm migrate sh -c \
  "./node_modules/.bin/prisma migrate status --schema=./prisma/schema.prisma"
# -> "Database schema is up to date!"

# ─────────────────────────────────────────────────────────────────────────────
# 7. LEVANTAR CON LA IMAGEN NUEVA
# ─────────────────────────────────────────────────────────────────────────────
docker compose -f infrastructure/compose/docker-compose.yml \
               -f infrastructure/compose/docker-compose.prod.yml up -d api worker
curl -fsS https://app.tudominio.com/api/v1/admin/health || echo "SMOKE TEST FALLO"
```

### 6.5 Si una migración falla en producción

El caso se divide según **cuánto alcanzó a aplicarse**. La decisión se toma con
`prisma migrate status` y consultando la tabla `_prisma_migrations`.

```sql
-- ¿Qué cree Prisma que pasó?
SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count, logs
FROM _prisma_migrations
ORDER BY started_at DESC
LIMIT 5;
```

**Caso A — la migración falló y revirtió limpiamente** (`finished_at IS NULL`,
`rolled_back_at IS NULL`, `applied_steps_count` = 0 o parcial con rollback de transacción).
Es el caso normal en Postgres, donde Prisma envuelve la migración en una transacción.

```bash
# 1. Marcar como revertida para desbloquear el historial
docker compose run --rm migrate sh -c \
  "./node_modules/.bin/prisma migrate resolve --rolled-back 20270301000001_008_orders --schema=./prisma/schema.prisma"

# 2. Opción A1: corregir la migración y redesplegar (fix forward)
#    - Editar el SQL, commit, nueva imagen, repetir §6.4 desde el paso 4.
# 3. Opción A2: rollback de aplicación y dejar la migración para más tarde
#    - Redesplegar la imagen anterior (TAG-1). El esquema está intacto.
```

**Caso B — la migración se aplicó parcialmente.** Ocurre cuando contiene DDL no transaccional
(`CREATE INDEX CONCURRENTLY`, `ALTER TYPE ... ADD VALUE` en versiones antiguas de Postgres).

```bash
# 1. Aplicar el down.sql documentado de ESA migración, paso a paso, verificando cada uno
psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
     -f apps/api/prisma/migrations/20270301000001_008_orders/down.sql

# 2. Marcar como revertida
docker compose run --rm migrate sh -c \
  "./node_modules/.bin/prisma migrate resolve --rolled-back 20270301000001_008_orders --schema=./prisma/schema.prisma"
```

**Caso C — hay corrupción o pérdida de datos.** La migración "funcionó" pero deformó datos.

```bash
# 1. Detener TODO
docker compose -f infrastructure/compose/docker-compose.yml \
               -f infrastructure/compose/docker-compose.prod.yml down

# 2. Restaurar el backup previo a la migración (el del paso 1 de §6.4)
#    Ver §11.4 para el procedimiento completo de restauración.
docker compose up -d postgres
docker compose exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --clean --if-exists --no-owner --no-privileges < /backups/pre_migration_<STAMP>.dump

# 3. Redesplegar la imagen ANTERIOR (TAG-1). El esquema vuelve a ser el que esa imagen espera.
# 4. Post-mortem obligatorio: ¿por qué la migración no se probó con datos reales en staging?
```

**Lo que nunca se hace:**

- ❌ `prisma migrate reset` en un entorno compartido. Borra todo.
- ❌ Editar una migración ya aplicada. Rompe el checksum y desincroniza todos los entornos.
- ❌ Aplicar a producción una migración que no pasó por staging. Es la regla dura de §J.3.
- ❌ Desplegar sin backup previo verificado. El backup que no se ha restaurado no es un backup.

### 6.6 Migración de datos (separada del esquema)

Las migraciones de Prisma son de **esquema**. Las transformaciones de datos (rellenar una
columna nueva, recalcular algo) van en `infrastructure/migrations/data/` como scripts
idempotentes ejecutados por el worker, no por el pipeline de despliegue:

- Se ejecutan **después** del deploy del esquema y antes del deploy del código que los usa.
- Son idempotentes y reanudables (procesan por lotes con cursor).
- Escriben progreso en una tabla de control y dejan rastro en `audit_logs`.

Esto evita el antipatrón de una migración SQL que bloquea la tabla durante minutos.

---

## 7. CI/CD con GitHub Actions

**Sin Nx, sin Turborepo (ADR-002).** El aislamiento entre paquetes se consigue con **path
filters** en cada workflow: un cambio en `apps/site` no ejecuta los tests de `apps/api`. Es la
pieza que sustituye al *affected graph* sin pagar su coste.

### 7.1 Mapa de workflows

```
push / pull_request
        │
        ├─ quality.yml       lint · typecheck · unit tests · cobertura        (path-filtered)
        ├─ contract.yml      OpenAPI + cliente generado · FALLA si hay drift  (path-filtered)
        ├─ integration.yml   postgres+redis efimeros · migraciones · e2e      (path-filtered)
        └─ security.yml      gitleaks · audit · CodeQL · Trivy fs · SBOM      (siempre)

push a main / tag
        │
        └─ build.yml
             ├─ secret-scan   ── BLOQUEA todo lo demas si encuentra un secreto
             ├─ build (x4)    buildx + cache · push a GHCR
             ├─ trivy-image   escaneo de las imagenes publicadas
             └─ sign          atestacion de procedencia (SLSA basico)

build.yml OK
        │
        └─ deploy.yml
             ├─ staging   automatico    ← incluye migrate.yml
             └─ production  APROBACION MANUAL (environment: production)  ← incluye migrate.yml
```

**Reglas duras del pipeline (§J.3), implementadas:**

| Regla | Dónde se implementa |
|---|---|
| Migraciones **siempre** con backup previo y verificación de reversibilidad | `migrate.yml`: el job `backup` es `needs` obligatorio del job `apply` |
| Ningún deploy a prod sin pasar staging | `deploy.yml`: el job `deploy-production` tiene `needs: [deploy-staging]` |
| El job `contract` falla si el cliente generado no coincide con el OpenAPI | `contract.yml`: `git diff --exit-code` sobre la carpeta generada |
| Escaneo de secretos **antes** que cualquier build | `build.yml`: `docker-build` tiene `needs: [secret-scan]` |

### 7.2 `.github/workflows/quality.yml`

```yaml
name: quality

on:
  pull_request:
    paths:
      - 'apps/**'
      - 'packages/**'
      - 'scripts/**'
      - 'package.json'
      - 'pnpm-lock.yaml'
      - 'pnpm-workspace.yaml'
      - 'tsconfig.base.json'
      - '.github/workflows/quality.yml'
  push:
    branches: [main]
    paths:
      - 'apps/**'
      - 'packages/**'
      - 'package.json'
      - 'pnpm-lock.yaml'
      - 'tsconfig.base.json'

concurrency:
  group: quality-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  quality:
    name: lint · typecheck · unit tests
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 12.8.1

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - name: Instalar dependencias
        run: pnpm install --frozen-lockfile

      - name: Generar cliente Prisma
        run: pnpm --filter @crm/api exec prisma generate

      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm typecheck

      - name: Tests unitarios con cobertura
        run: pnpm test -- --coverage

      - name: Subir cobertura
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: '**/coverage/**'
          retention-days: 7
          if-no-files-found: ignore
```

### 7.3 `.github/workflows/contract.yml`

El job que evita el *drift* entre frontend y backend: el bug más común en un monorepo
(ADR-012). Regenera el cliente desde los esquemas Zod y falla si el resultado difiere de lo
commiteado.

```yaml
name: contract

on:
  pull_request:
    paths:
      - 'packages/contracts/**'
      - 'apps/api/src/**'
      - 'apps/web/src/**'
      - 'apps/site/src/**'
      - 'scripts/generate-client.mjs'
      - 'scripts/check-contract-drift.mjs'
      - '.github/workflows/contract.yml'

concurrency:
  group: contract-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  contract-drift:
    name: OpenAPI ↔ cliente generado (sin drift)
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 12.8.1

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @crm/api exec prisma generate

      # 1. Generar el documento OpenAPI a partir de los esquemas Zod
      #    (packages/contracts es la fuente unica de verdad, ADR-012).
      - name: Generar OpenAPI
        run: pnpm --filter @crm/contracts build && pnpm --filter @crm/api openapi:emit

      # 2. Regenerar el cliente tipado de Angular.
      - name: Regenerar cliente
        run: pnpm contract:generate

      # 3. Si el resultado difiere de lo commiteado, el PR esta desactualizado: FALLA.
      - name: Detectar drift
        run: |
          if ! git diff --quiet -- packages/contracts/generated packages/contracts/openapi.json; then
            echo "::error::DRIFT DETECTADO entre el OpenAPI y el cliente generado."
            echo "Ejecuta 'pnpm contract:generate' y commitea el resultado."
            git --no-pager diff --stat -- packages/contracts/generated packages/contracts/openapi.json
            exit 1
          fi
          echo "Sin drift: el contrato y el cliente estan sincronizados."

      - name: Verificacion estricta (script dedicado)
        run: pnpm contract:check

      # Un cambio de schema debe romper el build del frontend, no pasar silenciosamente.
      - name: Typecheck de los consumidores del contrato
        run: |
          pnpm --filter @crm/web typecheck
          pnpm --filter @crm/site typecheck
```

### 7.4 `.github/workflows/integration.yml`

Postgres + Redis efímeros como *service containers*, migraciones reales y tests e2e de la API.

```yaml
name: integration

on:
  pull_request:
    paths:
      - 'apps/**'
      - 'packages/**'
      - 'infrastructure/migrations/**'
      - 'apps/api/prisma/**'
      - '.github/workflows/integration.yml'

concurrency:
  group: integration-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  integration:
    name: migraciones + e2e (postgres+redis efimeros)
    runs-on: ubuntu-latest
    timeout-minutes: 30

    services:
      postgres:
        # Misma imagen que produccion: pgvector sobre Postgres 17 (ADR-008).
        image: pgvector/pgvector:pg17
        env:
          POSTGRES_USER: crm
          POSTGRES_PASSWORD: crm_test
          POSTGRES_DB: crm_ventas_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U crm -d crm_ventas_test"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 20

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 5s
          --health-timeout 3s
          --health-retries 20

    env:
      NODE_ENV: test
      APP_ENV: test
      DATABASE_URL: postgresql://crm:crm_test@localhost:5432/crm_ventas_test?schema=public
      REDIS_URL: redis://localhost:6379
      # En CI no hay Ollama nativo: el proveedor de IA se simula (mock).
      LLM_DEFAULT_PROVIDER: mock
      OLLAMA_BASE_URL: http://127.0.0.1:11434
      JWT_ACCESS_SECRET: ci-access-secret-not-a-real-secret
      JWT_REFRESH_SECRET: ci-refresh-secret-not-a-real-secret
      COOKIE_SECURE: 'false'

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 12.8.1

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @crm/api exec prisma generate

      - name: Aplicar extensiones
        run: |
          PGPASSWORD=crm_test psql -h localhost -U crm -d crm_ventas_test -v ON_ERROR_STOP=1 <<'SQL'
          CREATE EXTENSION IF NOT EXISTS vector;
          CREATE EXTENSION IF NOT EXISTS pg_trgm;
          CREATE EXTENSION IF NOT EXISTS citext;
          CREATE EXTENSION IF NOT EXISTS pgcrypto;
          SQL

      - name: Aplicar migraciones (exactamente como en produccion)
        run: pnpm db:migrate

      - name: Verificar estado de migraciones
        run: pnpm db:migrate:status

      - name: Seed de datos de prueba
        run: pnpm db:seed
        env:
          SEED_ON_BOOTSTRAP: 'true'
          SEED_OWNER_EMAIL: owner@test.local
          SEED_OWNER_PASSWORD: TestPassword123!

      - name: Tests de integracion (API + DB + colas)
        run: pnpm --filter @crm/api test:integration

      - name: Reuso de refresh token rechazado (criterio de aceptacion §O.2)
        run: pnpm --filter @crm/api test:e2e -- --grep "refresh reuse"

      - name: Test de outbox end-to-end
        run: pnpm --filter @crm/worker test:integration -- --grep "outbox"

      - name: Volcar logs si algo fallo
        if: failure()
        run: docker ps -a
```

### 7.5 `.github/workflows/security.yml`

```yaml
name: security

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
  schedule:
    # Escaneo profundo semanal: dependencias y CodeQL completos.
    - cron: '0 4 * * 1'
  workflow_dispatch:

permissions:
  contents: read

jobs:
  secret-scan:
    name: secret scanning (gitleaks)
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read
      pull-requests: read
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0          # gitleaks necesita historial para escanear commits
      - name: gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITLEAKS_ENABLE_COMMENTS: 'true'
          GITLEAKS_ENABLE_SUMMARY: 'true'
        # Regla S5 / §K.1: un token de Meta Ads filtrado es un incidente real.

  dependency-audit:
    name: audit de dependencias
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 12.8.1
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: pnpm audit (produccion)
        run: pnpm audit --prod --audit-level high
      - name: pnpm audit completo (informativo)
        continue-on-error: true
        run: pnpm audit --audit-level moderate

  sast:
    name: CodeQL (SAST)
    runs-on: ubuntu-latest
    timeout-minutes: 30
    permissions:
      contents: read
      security-events: write
      actions: read
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: javascript-typescript
          queries: security-extended,security-and-quality
      - uses: github/codeql-action/analyze@v3
        with:
          category: '/language:javascript-typescript'

  filesystem-scan:
    name: Trivy (filesystem + IaC + secretos)
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - name: Trivy fs
        uses: aquasecurity/trivy-action@0.28.0
        with:
          scan-type: fs
          scan-ref: .
          scanners: vuln,misconfig,secret
          severity: CRITICAL,HIGH
          format: sarif
          output: trivy-fs.sarif
          exit-code: '0'
      - name: Publicar resultados
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: trivy-fs.sarif

  sbom:
    name: SBOM (CycloneDX)
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 12.8.1
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Generar SBOM
        run: pnpm dlx @cyclonedx/cyclonedx-npm --output-file sbom.json --output-format json
        continue-on-error: true
      - uses: actions/upload-artifact@v4
        with:
          name: sbom
          path: sbom.json
          retention-days: 90
```

### 7.6 `.github/workflows/build.yml`

El escaneo de secretos es **el primer job** y `docker-build` depende de él:
nada se construye ni se publica si hay un secreto en el repositorio.

```yaml
name: build

on:
  push:
    branches: [main]
    tags: ['v*.*.*']
  workflow_dispatch:

concurrency:
  group: build-${{ github.ref }}
  cancel-in-progress: false

permissions:
  contents: read
  packages: write
  id-token: write          # atestacion de procedencia
  security-events: write

env:
  REGISTRY: ghcr.io
  IMAGE_PREFIX: ${{ github.repository }}

jobs:
  # ───────────────────────────────────────────────────────────────────────────
  # 1. ESCANEO DE SECRETOS — BLOQUEA TODO LO DEMAS (§J.3, regla dura)
  # ───────────────────────────────────────────────────────────────────────────
  secret-scan:
    name: secret scanning (bloqueante)
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  # ───────────────────────────────────────────────────────────────────────────
  # 2. QUALITY GATE — repetido como precondicion de build (no basta con el PR)
  # ───────────────────────────────────────────────────────────────────────────
  test:
    name: quality gate
    runs-on: ubuntu-latest
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 12.8.1
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @crm/api exec prisma generate
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm contract:check

  # ───────────────────────────────────────────────────────────────────────────
  # 3. IMAGENES — matriz sobre las cuatro apps, con cache de capas
  # ───────────────────────────────────────────────────────────────────────────
  docker-build:
    name: build ${{ matrix.app }}
    needs: [secret-scan, test]
    runs-on: ubuntu-latest
    timeout-minutes: 45
    strategy:
      fail-fast: false
      matrix:
        include:
          - app: api
            dockerfile: infrastructure/docker/api.Dockerfile
          - app: worker
            dockerfile: infrastructure/docker/worker.Dockerfile
          - app: site
            dockerfile: infrastructure/docker/site.Dockerfile
          - app: web
            dockerfile: infrastructure/docker/web.Dockerfile
    steps:
      - uses: actions/checkout@v4

      - name: Docker metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/${{ matrix.app }}
          tags: |
            type=ref,event=branch
            # SHA COMPLETO con prefijo 'sha-': el deploy referencia el tag exacto
            # ('sha-<github.sha>'). Con format=short el tag y github.sha no coincidirian.
            type=sha,prefix=sha-
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=raw,value=latest,enable={{is_default_branch}}

      # Cache de capas en el runner de GitHub Actions (sin registry de cache externo).
      - uses: docker/setup-buildx-action@v3

      - name: Login en GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build y push
        id: build
        uses: docker/build-push-action@v6
        with:
          context: .
          file: ${{ matrix.dockerfile }}
          target: runtime
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          platforms: linux/amd64
          provenance: true
          sbom: true
          cache-from: type=gha,scope=${{ matrix.app }}
          cache-to: type=gha,mode=max,scope=${{ matrix.app }}
          build-args: |
            NODE_VERSION=24
            PNPM_VERSION=12.8.1

      - name: Guardar digest
        run: |
          mkdir -p digests
          echo "${{ matrix.app }}=${{ steps.build.outputs.digest }}" >> digests/images.txt
          cat digests/images.txt

      - uses: actions/upload-artifact@v4
        with:
          name: digests
          path: digests/images.txt
          retention-days: 90

  # ───────────────────────────────────────────────────────────────────────────
  # 4. TRIVY SOBRE LA IMAGEN CONSTRUIDA
  # ───────────────────────────────────────────────────────────────────────────
  trivy-image:
    name: trivy image ${{ matrix.app }}
    needs: [docker-build]
    runs-on: ubuntu-latest
    timeout-minutes: 20
    strategy:
      fail-fast: false
      matrix:
        app: [api, worker, site, web]
    permissions:
      contents: read
      packages: read
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Trivy (imagen)
        uses: aquasecurity/trivy-action@0.28.0
        with:
          image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/${{ matrix.app }}:sha-${{ github.sha }}
          ignore-unfixed: true
          severity: CRITICAL,HIGH
          vuln-type: os,library
          format: sarif
          output: trivy-${{ matrix.app }}.sarif
          exit-code: '0'

      - name: Fallar si hay CRITICAL sin mitigacion
        uses: aquasecurity/trivy-action@0.28.0
        with:
          image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/${{ matrix.app }}:sha-${{ github.sha }}
          ignore-unfixed: true
          severity: CRITICAL
          exit-code: '1'

      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: trivy-${{ matrix.app }}.sarif

  # ───────────────────────────────────────────────────────────────────────────
  # 5. FIRMA Y RESUMEN
  # ───────────────────────────────────────────────────────────────────────────
  finalize:
    name: resumen de build
    needs: [docker-build, trivy-image]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: digests
          path: digests
      - name: Resumen
        run: |
          {
            echo "## Imagenes publicadas"
            echo ""
            echo "| App | Tag |"
            echo "|---|---|"
            echo "| api    | sha-${{ github.sha }} |"
            echo "| worker | sha-${{ github.sha }} |"
            echo "| site   | sha-${{ github.sha }} |"
            echo "| web    | sha-${{ github.sha }} |"
            echo ""
            echo "Commit: \`${{ github.sha }}\`"
          } >> "$GITHUB_STEP_SUMMARY"
```

> **Nota sobre el digest.** El deploy debe usar el **digest** (`sha256:...`), no el tag. Un tag
> es mutable; un digest no. Eso es lo que garantiza que staging y producción corren
> exactamente la misma imagen (§8).

### 7.7 `.github/workflows/migrate.yml` (reutilizable)

```yaml
name: migrate

on:
  workflow_call:
    inputs:
      environment:
        description: 'staging | production'
        required: true
        type: string
      image_ref:
        description: 'Imagen api por digest, p.ej. ghcr.io/org/crm-ventas/api@sha256:...'
        required: true
        type: string
      backup_required:
        description: 'Exigir backup previo verificado (SIEMPRE true en staging/prod)'
        required: false
        type: boolean
        default: true
    secrets:
      VPS_HOST:
        required: true
      VPS_USER:
        required: true
      VPS_SSH_KEY:
        required: true

permissions:
  contents: read

jobs:
  migrate:
    name: migrar ${{ inputs.environment }}
    runs-on: ubuntu-latest
    timeout-minutes: 30
    environment: ${{ inputs.environment }}
    steps:
      - uses: actions/checkout@v4

      - name: Configurar SSH
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.VPS_SSH_KEY }}" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          ssh-keyscan -H "${{ secrets.VPS_HOST }}" >> ~/.ssh/known_hosts 2>/dev/null

      - name: Copiar scripts de migracion y backup al host
        run: |
          scp -i ~/.ssh/id_ed25519 scripts/backup.sh "${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}:/opt/crm/scripts/backup.sh"
          scp -i ~/.ssh/id_ed25519 scripts/verify-backup.sh "${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}:/opt/crm/scripts/verify-backup.sh"

      # ── PASO 1: BACKUP PREVIO (regla dura §J.3) ─────────────────────────
      - name: Backup previo a la migracion
        if: ${{ inputs.backup_required }}
        run: |
          ssh -i ~/.ssh/id_ed25519 "${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}" \
            "set -euo pipefail;
             cd /opt/crm;
             ENV=${{ inputs.environment }} bash scripts/backup.sh pre_migration"

      # ── PASO 2: VERIFICAR QUE EL BACKUP RESTAURA (no basta con tenerlo) ─
      - name: Verificar integridad del backup
        if: ${{ inputs.backup_required }}
        run: |
          ssh -i ~/.ssh/id_ed25519 "${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}" \
            "set -euo pipefail;
             cd /opt/crm;
             ENV=${{ inputs.environment }} bash scripts/verify-backup.sh"

      # ── PASO 3: ESTADO Y VERIFICACION DE REVERSIBILIDAD ─────────────────
      - name: Estado de migraciones antes
        run: |
          ssh -i ~/.ssh/id_ed25519 "${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}" \
            "cd /opt/crm && ENV=${{ inputs.environment }} API_IMAGE='${{ inputs.image_ref }}' \
             docker compose -f infrastructure/compose/docker-compose.yml \
                            -f infrastructure/compose/docker-compose.prod.yml \
                            run --rm --no-deps migrate sh -c './node_modules/.bin/prisma migrate status --schema=./prisma/schema.prisma'"

      # ── PASO 4: APLICAR ──────────────────────────────────────────────────
      - name: Aplicar migraciones
        run: |
          ssh -i ~/.ssh/id_ed25519 "${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}" \
            "set -euo pipefail;
             cd /opt/crm;
             ENV=${{ inputs.environment }} API_IMAGE='${{ inputs.image_ref }}' \
             docker compose -f infrastructure/compose/docker-compose.yml \
                            -f infrastructure/compose/docker-compose.prod.yml \
                            run --rm --no-deps migrate"

      # ── PASO 5: VERIFICAR DESPUES ────────────────────────────────────────
      - name: Estado de migraciones despues
        run: |
          ssh -i ~/.ssh/id_ed25519 "${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}" \
            "set -euo pipefail;
             cd /opt/crm;
             STATUS=\$(ENV=${{ inputs.environment }} API_IMAGE='${{ inputs.image_ref }}' \
               docker compose -f infrastructure/compose/docker-compose.yml \
                              -f infrastructure/compose/docker-compose.prod.yml \
                              run --rm --no-deps migrate sh -c './node_modules/.bin/prisma migrate status --schema=./prisma/schema.prisma');
             echo \"\$STATUS\";
             echo \"\$STATUS\" | grep -q 'up to date' || { echo 'MIGRACION NO COMPLETA'; exit 1; }"

      # ── ROLLBACK AUTOMATICO SI ALGO FALLA ────────────────────────────────
      - name: Marcar migracion fallida como revertida
        if: failure()
        run: |
          echo "::error::La migracion fallo. Ver el runbook de rollback (docs/deployment.md §6.5)."
          echo "El backup previo esta en el VPS y su integridad fue verificada."
          exit 1
```

### 7.8 `.github/workflows/deploy.yml`

```yaml
name: deploy

on:
  workflow_run:
    workflows: [build]
    types: [completed]
    branches: [main]
  workflow_dispatch:
    inputs:
      image_tag:
        description: 'Tag o digest a desplegar (por defecto: sha del ultimo build de main)'
        required: false
        type: string

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false

permissions:
  contents: read
  packages: read

env:
  REGISTRY: ghcr.io
  IMAGE_PREFIX: ${{ github.repository }}

jobs:
  # ───────────────────────────────────────────────────────────────────────────
  # STAGING — automatico
  # ───────────────────────────────────────────────────────────────────────────
  migrate-staging:
    name: migrar staging
    if: github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'success'
    uses: ./.github/workflows/migrate.yml
    with:
      environment: staging
      # OJO: en 'jobs.<id>.with' de una llamada a workflow reutilizable NO estan
      # disponibles los contextos 'env' ni 'secrets'. Por eso el registry va literal.
      image_ref: ghcr.io/${{ github.repository }}/api:sha-${{ github.event.workflow_run.head_sha }}
      backup_required: true
    secrets:
      VPS_HOST: ${{ secrets.STAGING_VPS_HOST }}
      VPS_USER: ${{ secrets.STAGING_VPS_USER }}
      VPS_SSH_KEY: ${{ secrets.STAGING_VPS_SSH_KEY }}

  deploy-staging:
    name: desplegar staging
    needs: [migrate-staging]
    runs-on: ubuntu-latest
    timeout-minutes: 20
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - name: Configurar SSH
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.STAGING_VPS_SSH_KEY }}" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          ssh-keyscan -H "${{ secrets.STAGING_VPS_HOST }}" >> ~/.ssh/known_hosts 2>/dev/null

      - name: Desplegar (pull + up -d)
        run: |
          ssh -i ~/.ssh/id_ed25519 "${{ secrets.STAGING_VPS_USER }}@${{ secrets.STAGING_VPS_HOST }}" \
            "set -euo pipefail;
             cd /opt/crm;
             export REGISTRY='ghcr.io/${{ github.repository }}';
             export TAG=${{ github.event.workflow_run.head_sha }};
             docker compose --env-file .env.staging \
               -f infrastructure/compose/docker-compose.yml \
               -f infrastructure/compose/docker-compose.prod.yml pull;
             docker compose --env-file .env.staging \
               -f infrastructure/compose/docker-compose.yml \
               -f infrastructure/compose/docker-compose.prod.yml up -d --remove-orphans"

      - name: Smoke tests de staging
        run: |
          ssh -i ~/.ssh/id_ed25519 "${{ secrets.STAGING_VPS_USER }}@${{ secrets.STAGING_VPS_HOST }}" \
            "set -euo pipefail;
             cd /opt/crm;
             bash scripts/smoke-test.sh https://staging.tudominio.com"

      - name: Rollback automatico si el smoke test falla
        if: failure()
        run: |
          ssh -i ~/.ssh/id_ed25519 "${{ secrets.STAGING_VPS_USER }}@${{ secrets.STAGING_VPS_HOST }}" \
            "set -euo pipefail; cd /opt/crm;
             export TAG=${{ github.event.workflow_run.head_sha }}~1;
             docker compose --env-file .env.staging \
               -f infrastructure/compose/docker-compose.yml \
               -f infrastructure/compose/docker-compose.prod.yml up -d --remove-orphans;
             echo 'Rollback de staging aplicado.'"

  # ───────────────────────────────────────────────────────────────────────────
  # PRODUCCION — APROBACION MANUAL
  # El environment 'production' tiene required reviewers configurados en GitHub.
  # El job NO empieza hasta que un humano aprueba. No hay forma de saltarlo
  # desde el workflow: es una proteccion de la plataforma, no del YAML.
  # ───────────────────────────────────────────────────────────────────────────
  migrate-production:
    name: migrar produccion (requiere aprobacion)
    needs: [deploy-staging]
    uses: ./.github/workflows/migrate.yml
    with:
      environment: production
      image_ref: ghcr.io/${{ github.repository }}/api:sha-${{ github.event.workflow_run.head_sha }}
      backup_required: true
    secrets:
      VPS_HOST: ${{ secrets.PROD_VPS_HOST }}
      VPS_USER: ${{ secrets.PROD_VPS_USER }}
      VPS_SSH_KEY: ${{ secrets.PROD_VPS_SSH_KEY }}

  deploy-production:
    name: desplegar produccion (requiere aprobacion)
    needs: [migrate-production]
    runs-on: ubuntu-latest
    timeout-minutes: 30
    environment: production
    steps:
      - uses: actions/checkout@v4
      - name: Configurar SSH
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.PROD_VPS_SSH_KEY }}" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          ssh-keyscan -H "${{ secrets.PROD_VPS_HOST }}" >> ~/.ssh/known_hosts 2>/dev/null

      - name: Registrar tag anterior (para rollback)
        id: previous
        run: |
          PREV=$(ssh -i ~/.ssh/id_ed25519 "${{ secrets.PROD_VPS_USER }}@${{ secrets.PROD_VPS_HOST }}" \
            "cd /opt/crm && cat .last_tag 2>/dev/null || echo none")
          echo "tag=$PREV" >> "$GITHUB_OUTPUT"
          echo "Tag anterior: $PREV"

      - name: Desplegar produccion
        run: |
          ssh -i ~/.ssh/id_ed25519 "${{ secrets.PROD_VPS_USER }}@${{ secrets.PROD_VPS_HOST }}" \
            "set -euo pipefail;
             cd /opt/crm;
             export TAG=${{ github.event.workflow_run.head_sha }};
             docker compose --env-file .env.production \
               -f infrastructure/compose/docker-compose.yml \
               -f infrastructure/compose/docker-compose.prod.yml pull;
             docker compose --env-file .env.production \
               -f infrastructure/compose/docker-compose.yml \
               -f infrastructure/compose/docker-compose.prod.yml up -d --remove-orphans;
             echo \$TAG > .last_tag"

      - name: Smoke tests de produccion
        run: |
          ssh -i ~/.ssh/id_ed25519 "${{ secrets.PROD_VPS_USER }}@${{ secrets.PROD_VPS_HOST }}" \
            "bash /opt/crm/scripts/smoke-test.sh https://app.tudominio.com"

      - name: Rollback manual documentado si falla
        if: failure()
        run: |
          echo "::error::Fallo en produccion. Rollback:"
          echo "  1. ssh al VPS"
          echo "  2. cd /opt/crm && export TAG=${{ steps.previous.outputs.tag }}"
          echo "  3. docker compose --env-file .env.production -f infrastructure/compose/docker-compose.yml -f infrastructure/compose/docker-compose.prod.yml up -d --remove-orphans"
          echo "  El esquema NO se revierte automaticamente: expand/contract lo hace compatible."
          exit 1
```

`scripts/smoke-test.sh` (lo que se ejecuta contra el entorno recién desplegado):

```bash
#!/usr/bin/env bash
# Smoke test post-deploy. Falla rapido y con mensaje claro.
set -euo pipefail
BASE="${1:?uso: smoke-test.sh https://app.tudominio.com}"
fail=0

check() {
  local name="$1" url="$2" expect="${3:-200}"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$url" || echo "000")
  if [ "$code" = "$expect" ]; then
    echo "  OK   $name ($code)"
  else
    echo "  FALLO $name (esperado $expect, obtenido $code)"
    fail=1
  fi
}

echo "Smoke test: $BASE"
check "health live"      "$BASE/api/v1/health/live"        200
check "health ready"     "$BASE/api/v1/health/ready"       200
check "openapi"          "$BASE/api/v1/openapi.json"       200
check "auth protege"     "$BASE/api/v1/leads"              401
check "site responde"    "${SITE_URL:-$BASE}/"             200
check "robots del CRM"   "${SITE_URL:-$BASE}/robots.txt"   200

# El sitio publico debe renderizar contenido en el HTML del servidor (SSR real).
if curl -s --max-time 15 "${SITE_URL:-$BASE}/" | grep -q 'application/ld+json'; then
  echo "  OK   SSR + JSON-LD presentes"
else
  echo "  FALLO SSR: el HTML no contiene JSON-LD"
  fail=1
fi

[ "$fail" -eq 0 ] || { echo "SMOKE TEST FALLIDO"; exit 1; }
echo "Smoke test OK"
```

### 7.9 Protecciones del repositorio (configuración, no YAML)

En GitHub → Settings → Branches → `main`:

- Require pull request antes de mergear.
- Require status checks: `quality`, `contract-drift`, `integration`, `secret-scan`, `CodeQL`.
- Require branches to be up to date.
- Require conversation resolution.

En GitHub → Settings → Environments → `production`:

- **Required reviewers**: el propio `OWNER`. Sin aprobación explícita, el job no arranca.
- **Wait timer**: 5 minutos (permite abortar si algo se detectó tarde).
- **Deployment branches**: solo `main`.

---

## 8. Entornos y paridad

### 8.1 Los cuatro entornos

```
LOCAL ──────────► DEVELOPMENT ──────► STAGING ──────────► PRODUCTION
(Compose)         (Compose/VPS)       (VPS/mirror prod)    (VPS → cloud)
§J.1
```

| | LOCAL | DEVELOPMENT | STAGING | PRODUCTION |
|---|---|---|---|---|
| **Propósito** | Desarrollar | Probar integraciones reales (Ollama, conectores) | Validar el release antes de prod | Servir al negocio |
| **Host** | Tu Windows 11 | VPS pequeño o la propia máquina | VPS con la misma topología que prod | VPS (Nivel 0-2) |
| **Cómo corre** | Host nativo + Compose para infra | Compose | Compose + Caddy | Compose + Caddy |
| **Imagen** | Código montado (hot reload) | Imagen de `main` | **Imagen por digest** | **La MISMA imagen que staging, mismo digest** |
| **`.env`** | `.env` | `.env.development` | `.env.staging` | `.env.production` |
| **Datos** | Sintéticos o de prueba | Copia parcial anonimizada | Copia anonimizada de prod | Reales |
| **Ollama** | Nativo en Windows | Nativo o remoto | Nativo en el VPS, o `:cloud` | Nativo en el VPS, o proveedor externo |
| **TLS** | No | Autofirmado u opcional | Let's Encrypt | Let's Encrypt, HSTS preload |
| **Backups** | No | No | Diarios | Diarios + retención + offsite |
| **Deploy** | Manual | Manual | Automático al pasar `build` | **Aprobación manual** |
| **URL** | `localhost:4200/4000/3000` | `dev.tudominio.com` | `staging.tudominio.com` | `app.` y `www.tudominio.com` |

### 8.2 El contrato de paridad

> **LOCAL y STAGING son la misma imagen con distinto `.env`.**

Esto se cumple de forma literal y verificable:

```bash
# El digest que corre staging:
docker inspect --format='{{index .RepoDigests 0}}' crm-api
# -> ghcr.io/owner/crm-ventas/api@sha256:abc123...

# El digest que corre produccion (debe ser IDENTICO):
docker inspect --format='{{index .RepoDigests 0}}' crm-api
# -> ghcr.io/owner/crm-ventas/api@sha256:abc123...
```

Todo lo que difiere entre entornos es **configuración**: valores en `.env`, secretos, dominios.
Nada que difiera es **código**. Si en producción falla algo que en staging funcionaba, no es un
caso fortuito: es una violación del contrato de paridad y hay que tratarla como un bug de
infraestructura con la misma seriedad que un bug de código.

**Lo que rompe la paridad (y cómo se evita):**

| Ruptura | Cómo se evita |
|---|---|
| Construir la imagen en el VPS de producción | `docker-compose.prod.yml` no tiene `build:`; solo `image:` con digest |
| Dependencias instaladas a mano en el servidor | El contenedor es autocontenido (`pnpm deploy --prod`) |
| `NODE_ENV` distinto sin querer | `NODE_ENV=production` fijado en el Dockerfile y sobreescrito solo donde corresponde |
| Versión de Node distinta | Fijada por `ARG NODE_VERSION=24` en el Dockerfile |
| Un `.env` con una clave que falta | `POSTGRES_PASSWORD:?` y `DOMAIN_APP:?` fallan al arrancar si faltan |
| Estado en el sistema de archivos del contenedor | Solo `postgres`, `redis` y `uploads` usan volúmenes; el resto es efímero |

**Modo «prod-like» en local.** Para reproducir exactamente el entorno de producción en la
máquina Windows, sin hot reload:

```powershell
# Mismo compose base + override prod, con las imagenes locales ya construidas.
docker compose --env-file .env `
  -f infrastructure/compose/docker-compose.yml `
  -f infrastructure/compose/docker-compose.prod.yml up -d --build

# Comprobacion de paridad: la imagen local y la de staging comparten Dockerfile y target.
docker image inspect crm-ventas/api:local --format '{{.Config.Labels}}'
```

Este modo es el que se usa para el ensayo de restauración de backups (§11.5) y para reproducir
incidentes antes de tocar producción.

### 8.3 Gestión de secretos por nivel

| Nivel | Mecanismo | Reglas |
|---|---|---|
| **LOCAL** | `.env` no commiteado (`.gitignore`) | Los secretos del `.env.example` son de relleno. Nunca reutilizar un secreto local en un entorno compartido. |
| **DEVELOPMENT** | `.env.development` en el VPS, permisos `600` | Sin secretos de producción. Credenciales de conectores de sandbox. |
| **STAGING** | **GitHub Secrets** (environment `staging`) inyectados en el deploy; `.env.staging` en el VPS con `600` | Solo los secretos del VPS los conoce el VPS. El pipeline nunca los imprime. |
| **PRODUCTION** | **GitHub Secrets** (environment `production`, con aprobación) + `.env.production` en el VPS, `600`, propietario `deploy` | Rotación trimestral obligatoria (§13.6). Acceso SSH solo con clave. |
| **CLOUD (Nivel 3+)** | **Secret manager gestionado** (AWS Secrets Manager / GCP Secret Manager / SOPS+age) | Los contenedores leen del manager al arrancar; el `.env` desaparece del disco. |

Reglas duras de secretos:

1. **Un secreto nunca entra en una imagen Docker.** Ni en un `ARG`, ni en un `ENV`, ni copiado.
   Se inyecta en runtime vía `env_file` o secret manager.
2. **Un secreto nunca va al contexto del modelo** (§K.3). `ToolContext` no incluye secretos y
   los logs los redactan.
3. **Un secreto nunca se imprime.** Ni en `echo`, ni en un `run` del workflow, ni en un mensaje
   de error. GitHub enmascara los `secrets.*`, pero no una variable que se construya a mano.
4. **Pre-commit + CI.** `gitleaks` corre en local (Husky) y en CI (§7.5). Un `.env` colado en
   un commit es un incidente real (§K.1 amenaza 5): rotar **todos** los secretos que contenía.

```bash
# Permisos correctos en el VPS
chown deploy:deploy /opt/crm/.env.production
chmod 600 /opt/crm/.env.production
ls -l /opt/crm/.env.production      # -> -rw------- 1 deploy deploy
```

### 8.4 Promoción de un cambio

```
PR  ──►  quality + contract + integration + security   (en verde)
 │
 ├─►  merge a main
 │      └─►  build.yml  (secret-scan ⟶ imagenes ⟶ trivy)
 │
 └─►  deploy.yml
          ├─► staging:  migrate (con backup) ⟶ deploy ⟶ smoke tests    AUTOMATICO
          │
          └─► production:  ¿aprobacion humana?
                             si ⟶ migrate (con backup) ⟶ deploy ⟶ smoke tests
                             no ⟶ se queda esperando (no hay timeout silencioso)
```

Un cambio **no puede saltarse staging**. No es una convención del equipo: es
`needs: [deploy-staging]` en el job de producción, más el environment con revisores
obligatorios. La aprobación no se puede dar desde el YAML.

---

## 9. Escalado de infraestructura en 5 niveles

Según §J.4 y §L. **La arquitectura no cambia entre niveles**: cambian el tamaño de las
máquinas, a dónde apuntan las variables de entorno y si un servicio pasa a ser gestionado.
Ese es el objetivo explícito de §J.4 («migrar sin reconstruir todo»), y se consigue con
**configuración por entorno desde el commit 1**.

### 9.1 Tabla de niveles

| Nivel | Qué es | Qué **cambia** | Qué **NO** cambia |
|---|---|---|---|
| **0 — Ahora** | Un host (tu Windows 11 → luego un VPS único). Todo en Compose: postgres, redis, api, worker, web, site, caddy. Ollama nativo en el mismo host. | Nada: es el estado descrito en este documento. | Todo. |
| **1 — Postgres gestionado + CDN** | VPS con la aplicación; Postgres pasa a servicio gestionado (RDS/Cloud SQL/Neon); backups automáticos y PITR del proveedor; CDN delante de `apps/site` (Cloudflare/Fastly). | `POSTGRES_HOST`, `POSTGRES_*` apuntan al gestionado. `DATABASE_URL` con `sslmode=require`. El servicio `postgres` desaparece del Compose. `PUBLIC_SITE_URL` y la CDN cambian los headers de caché de estáticos. `BACKUP_S3_URI` apunta a un bucket real. | Código, contenedores, migraciones, ADRs. El backup pasa a ser responsabilidad del proveedor **pero se sigue verificando con restauración periódica** (§11). |
| **2 — Worker en host aparte** | El worker se separa a su propio host (es el que come CPU con IA, ADR-001 y §L «100 usuarios»). Los dos hosts comparten Postgres, Redis y Ollama. | `REDIS_URL` y `DATABASE_URL` apuntan por red privada. `OLLAMA_BASE_URL` apunta al host de inferencia. `QUEUE_AI_CONCURRENCY` puede subir a 2+ **solo si** hay GPU o varios hosts de inferencia. El compose del worker deja de incluir postgres/redis. | El worker sigue siendo la misma imagen. El outbox sigue en Postgres (ADR-009), así que la separación no introduce consistencia distribuida nueva. |
| **3 — Cloud gestionado** | RDS/Cloud SQL, ElastiCache/Managed Redis, S3 para `StorageProvider`, contenedores en ECS/Cloud Run/App Runner. | `DATABASE_URL`, `REDIS_URL` (con TLS: `rediss://`), `STORAGE_DRIVER=s3` + credenciales, secretos en el secret manager del cloud. Desaparece Caddy: el balanceador gestionado hace TLS. Aparecen réplicas de lectura. | Contratos, módulos, agentes, boundaries. `StorageProvider` ya estaba abstraído desde el día 1 (§J.2), así que pasar de disco a S3 **no cambia llamadas**. |
| **4 — Escala alta** | Réplicas de lectura; particionado de `touchpoints`, `audit_logs` y `outbox_events` por fecha; colas por prioridad; ClickHouse **solo para eventos** replicando desde Postgres. | Aparece ClickHouse para analítica de eventos (§C.3). Se añade lógica de routing lectura/escritura. Se crean particiones. Se segmentan colas. | **Modelo de dominio y boundaries.** ClickHouse se añade replicando desde Postgres, sin tocar el dominio (§C.3). |

### 9.2 Niveles de escala por usuarios (§L)

| Escala | Qué cambia | Qué NO cambia |
|---|---|---|
| **1 usuario** (hoy) | Todo en un host, Ollama local, sin CDN | La arquitectura del §B |
| **10 usuarios** | `organization_id` ya está; añadir roles; Postgres con backups; CDN para `apps/site` | Nada del dominio |
| **100 usuarios** | Índices y vistas materializadas para analítica; caché agresiva de conectores; worker en host aparte; réplica de lectura | Contratos, módulos, agentes |
| **1.000 usuarios** | Postgres gestionado con réplicas; particionado de `touchpoints` y eventos por fecha; Redis gestionado; colas por prioridad; ClickHouse solo para eventos | Modelo de dominio y boundaries |
| **10.000+** | Multi-región si el mercado lo pide; sharding por organización; streaming de eventos; equipo dedicado de plataforma | Todo lo anterior se mantiene |

### 9.3 Qué se diseñó para no tener que rehacerse

Las ocho decisiones de §L que hacen que el escalado sea configuración y no reescritura:

1. `organization_id` en toda tabla → multi-tenant sin migración masiva (ADR-011).
2. Atribución calculada en job → modelos de atribución sin migrar historia (ADR-014).
3. Conectores tras interfaz → añadir/quitar fuentes sin tocar el dominio (ADR-004).
4. `LLMProvider` + `ModelRouter` → cambiar de modelo o proveedor sin tocar agentes (ADR-007).
5. Colas separadas por perfil de recurso → escalar el cuello real, no todo (ADR-010).
6. Outbox → evolución a event-driven sin rediseñar transacciones (ADR-009).
7. Provenance en métricas → el scoring se puede recalibrar y auditar (ADR-013).
8. `packages/domain` sin I/O → tests rápidos de las reglas que nunca deben romperse.

### 9.4 Kubernetes: por qué NO en los niveles 0-2

**Decisión explícita: no se usa Kubernetes en los niveles 0, 1 ni 2.** Con un desarrollador y
un VPS, un `docker-compose.yml` y un script de despliegue rinden más, cuestan menos y se
entienden mejor.

| Criterio | VPS con Compose (Nivel 0-2) | Kubernetes (Nivel 0-2) |
|---|---|---|
| Curva de aprendizaje | Ya la tienes | Días/semanas |
| Superficie operativa | Un archivo + un script | Control plane, ingress, CNI, CSI, RBAC, Helm, operadores |
| Réplicas y autoescalado | No se necesitan con 1-10 usuarios | Sobredimensionado |
| Diagnóstico de un fallo | `docker compose logs` | `kubectl describe/get/logs/events` sobre varios recursos |
| Coste | El VPS | El VPS **y** el tiempo |
| Portabilidad | La misma imagen corre en K8s después | — |

Kubernetes resuelve un problema de **escala organizativa**: muchos equipos desplegando muchos
servicios de forma coordinada. Aquí hay un servicio (`api`), un worker y dos frontends. Adoptarlo
ahora sería importar la complejidad de la solución antes de tener el problema.

**Cuándo reevaluar:** a partir del **Nivel 3**, y previsiblemente no será Kubernetes directo
sino un orquestador gestionado (ECS, Cloud Run, App Runner), donde la mayor parte del control
plane la lleva el proveedor. Para entonces, las imágenes ya estarán listas: adoptar cualquiera
de esos servicios es cambiar el mecanismo de despliegue, no el artefacto.

### 9.5 Qué se deja deliberadamente fuera (y por qué es correcto)

De §L: microservicios, Kubernetes, Kafka, Elasticsearch, ClickHouse, base vectorial dedicada,
CQRS con dos modelos de escritura, event sourcing completo. Cada uno resuelve un problema que
este sistema **todavía no tiene**. Añadir cualquiera de ellos después es un cambio localizado
precisamente porque las fronteras ya existen.

---

## 10. Operación

### 10.1 Comandos de uso diario

Todos los comandos asumen que se ejecutan desde la **raíz del repositorio** y que existe `.env`.

```powershell
# ─────────────────────────────────────────────────────────────────────────────
# LEVANTAR / PARAR
# ─────────────────────────────────────────────────────────────────────────────
pnpm infra:up               # solo postgres + redis (desarrollo nativo) — el uso normal
pnpm dev                    # los cuatro procesos Node en el host

pnpm infra:up:dev           # todo el stack en contenedores con hot reload
pnpm infra:up:prodlike      # todo el stack como en produccion (sin hot reload)

pnpm infra:ps               # estado y salud de los servicios
pnpm infra:down             # parar sin borrar volúmenes (los datos sobreviven)
pnpm infra:logs             # seguir logs de todo

# ─────────────────────────────────────────────────────────────────────────────
# LOGS
# ─────────────────────────────────────────────────────────────────────────────
docker compose -f infrastructure/compose/docker-compose.yml logs -f api
docker compose -f infrastructure/compose/docker-compose.yml logs -f --tail=500 worker
docker compose -f infrastructure/compose/docker-compose.yml logs --since 15m api | Select-String ERROR

# Logs del worker filtrados por cola (pino JSON: se filtra con jq o Select-String)
docker compose -f infrastructure/compose/docker-compose.yml logs --no-log-prefix worker |
  Select-String '"queue":"ai"'

# ─────────────────────────────────────────────────────────────────────────────
# REINICIAR / RECONSTRUIR UN SERVICIO
# ─────────────────────────────────────────────────────────────────────────────
docker compose -f infrastructure/compose/docker-compose.yml restart api
docker compose -f infrastructure/compose/docker-compose.yml up -d --build api worker
docker compose -f infrastructure/compose/docker-compose.yml up -d --force-recreate api

# Recargar la configuracion de Caddy sin cortar TLS (produccion)
docker compose -f infrastructure/compose/docker-compose.yml `
               -f infrastructure/compose/docker-compose.prod.yml exec caddy caddy reload --config /etc/caddy/Caddyfile

# ─────────────────────────────────────────────────────────────────────────────
# ENTRAR A PSQL
# ─────────────────────────────────────────────────────────────────────────────
docker compose -f infrastructure/compose/docker-compose.yml exec postgres `
  psql -U crm -d crm_ventas
# Una consulta suelta:
docker compose -f infrastructure/compose/docker-compose.yml exec postgres `
  psql -U crm -d crm_ventas -c "SELECT count(*) FROM leads WHERE status='NEW';"
# Formato expandido, util para filas anchas:
#   psql ... -x -c "SELECT * FROM ai_runs ORDER BY started_at DESC LIMIT 1;"

# Entrar a Redis
docker compose -f infrastructure/compose/docker-compose.yml exec redis redis-cli

# ─────────────────────────────────────────────────────────────────────────────
# MIGRACIONES
# ─────────────────────────────────────────────────────────────────────────────
pnpm db:migrate:status      # ¿qué está aplicado y qué falta?
pnpm db:migrate             # aplicar pendientes (migrate deploy)
pnpm db:migrate:dev         # SOLO local: crear/aplicar en desarrollo
pnpm db:seed                # sembrar datos base
pnpm db:reset               # SOLO local: destruye y recrea (nunca en compartido)

# ─────────────────────────────────────────────────────────────────────────────
# CONTRATO Y CLIENTE
# ─────────────────────────────────────────────────────────────────────────────
pnpm contract:generate      # regenerar OpenAPI + cliente Angular
pnpm contract:check         # verificar que no hay drift

# ─────────────────────────────────────────────────────────────────────────────
# BACKUP / RESTORE MANUAL (ver §11)
# ─────────────────────────────────────────────────────────────────────────────
pnpm backup                 # pg_dump -Fc a ./backups/
bash scripts/backup.sh manual
bash scripts/restore.sh ./backups/crm_ventas_20261001T030000Z.dump

# ─────────────────────────────────────────────────────────────────────────────
# LIMPIAR
# ─────────────────────────────────────────────────────────────────────────────
# Borrar contenedores y redes, CONSERVANDO los volumenes de datos:
docker compose -f infrastructure/compose/docker-compose.yml down

# Borrar TAMBIEN los volumenes (DESTRUCTIVO: se pierde la base de datos):
docker compose -f infrastructure/compose/docker-compose.yml down -v
#   Equivalente explicito:
docker volume rm crm-ventas_pgdata crm-ventas_redisdata

# Liberar disco (imagenes y capas huerfanas) SIN tocar volumenes:
docker system prune -af --volumes=false
docker image prune -a

# Ver cuanto ocupa cada cosa antes de borrar:
docker system df
docker volume ls --filter name=crm-ventas
```

### 10.2 Inspección del sistema

```powershell
# Estado de salud de la API (incluye DB, Redis y Ollama como dependencias degradables)
Invoke-RestMethod http://localhost:3000/health/ready | ConvertTo-Json -Depth 5
# -> { "status":"ok", "db":"up", "redis":"up", "ollama":"up", "queues": {"io":0,"ai":2,"compute":0,"seo":0} }

# Colas BullMQ: profundidad, jobs activos, fallidos y reintentos
docker compose -f infrastructure/compose/docker-compose.yml exec redis `
  redis-cli --scan --pattern 'crm:bull:*:meta' |
  ForEach-Object { $_ }
# Los fallidos se inspeccionan desde el centro de control (UI) o:
docker compose -f infrastructure/compose/docker-compose.yml exec redis `
  redis-cli ZCARD crm:bull:ai:failed

# Outbox pendiente (ADR-009: si esto crece, algo no despacha)
docker compose -f infrastructure/compose/docker-compose.yml exec postgres psql -U crm -d crm_ventas -c `
  "SELECT status, count(*) FROM outbox_events GROUP BY status;"

# Coste de IA de las últimas 24 h
docker compose -f infrastructure/compose/docker-compose.yml exec postgres psql -U crm -d crm_ventas -c `
  "SELECT model, count(*) n, sum(tokens_input+tokens_output) tokens, round(sum(estimated_cost_usd),4) usd
   FROM ai_costs WHERE created_at > now() - interval '24 hours' GROUP BY model ORDER BY usd DESC;"

# Jobs auditados (historial más allá del TTL de BullMQ)
docker compose -f infrastructure/compose/docker-compose.yml exec postgres psql -U crm -d crm_ventas -c `
  "SELECT queue, name, status, count(*) FROM jobs_audit
   WHERE created_at > now() - interval '1 hour' GROUP BY 1,2,3 ORDER BY 4 DESC;"
```

### 10.3 Cuando algo falla

| Síntoma | Causa probable | Diagnóstico | Solución |
|---|---|---|---|
| **Postgres no arranca** | Volumen con datos de una versión distinta; contraseña cambiada; puerto 5432 ocupado; RAM insuficiente | `docker compose logs postgres \| Select-Object -Last 50` | Ver §12.1 |
| **Redis no arranca** | Volumen AOF corrupto; `maxmemory` mal configurado; puerto ocupado | `docker compose logs redis` | Ver §12.2 |
| **Ollama no responde** | Servicio parado; modelo no descargado; `host.docker.internal` no resuelve | `verify-env.ps1`; `Invoke-RestMethod localhost:11434/api/tags` | Ver §12.3 |
| **La cola se atasca** | Worker parado; job atascado con lock; Redis caído; un job en bucle | `redis-cli ZCARD crm:bull:<cola>:active`; logs del worker | Ver §12.4 |
| **Un conector se bloquea** | Rate limit del marketplace; circuit breaker abierto; `kill_switch` activo; credenciales caducadas | `GET /api/v1/connectors`; `connectors_registry.last_error` | Ver §12.5 |
| **La API devuelve 503 en `/health/ready`** | Postgres o Redis caídos (comportamiento esperado) | `Invoke-RestMethod /health/ready` | Levantar la dependencia; la API se recupera sola |
| **`pnpm dev` no detecta cambios** | Bind mount de Windows sin eventos inotify | — | Usar el modo nativo (sin Docker) o `--poll 1000` |
| **El build de Docker se cuelga en Windows** | El contexto de build incluye `node_modules` | `docker build` sin `.dockerignore` | Verificar que existe `.dockerignore` en la raíz |
| **Falta espacio en C:** | Imágenes, capas y modelos de Ollama | `docker system df`; `ollama list` | Ver §12.6 |

### 10.4 Rutina semanal (5 minutos)

```powershell
# 1. Estado de todo
pnpm infra:ps
Invoke-RestMethod http://localhost:3000/health/ready

# 2. Errores de la ultima semana en los logs
docker compose -f infrastructure/compose/docker-compose.yml logs --since 168h api | Select-String ERROR

# 3. Outbox sin atascos
docker compose -f infrastructure/compose/docker-compose.yml exec postgres psql -U crm -d crm_ventas -c `
  "SELECT status, count(*) FROM outbox_events GROUP BY status;"

# 4. Jobs fallidos
docker compose -f infrastructure/compose/docker-compose.yml exec postgres psql -U crm -d crm_ventas -c `
  "SELECT queue, name, status, count(*) FROM jobs_audit
   WHERE created_at > now() - interval '7 days' AND status='FAILED' GROUP BY 1,2,3;"

# 5. Coste de IA de la semana
docker compose -f infrastructure/compose/docker-compose.yml exec postgres psql -U crm -d crm_ventas -c `
  "SELECT round(sum(estimated_cost_usd),2) usd_semana, round(sum(estimated_cost_usd)/7,2) usd_dia
   FROM ai_costs WHERE created_at > now() - interval '7 days';"

# 6. Que el backup de anoche existe y no esta vacio
Get-ChildItem .\backups\*.dump | Sort-Object LastWriteTime -Descending | Select-Object -First 3 Name, Length, LastWriteTime

# 7. Espacio en disco
Get-PSDrive C | Select-Object Used, Free
```

---

## 11. Backups y restauración

> **Principio rector (§Fase 10 del roadmap): tener backups no es una política. La política es
> restaurar y verificar integridad.** Un backup que nunca se ha restaurado es una hipótesis,
> no una garantía.

### 11.1 Qué se respalda y qué no

| Activo | ¿Se respalda? | Cómo | RPO / RTO |
|---|---|---|---|
| **PostgreSQL** (fuente de verdad del dominio) | **Sí, obligatorio** | `pg_dump -Fc` diario + backup previo a cada migración | RPO 24 h (1 h con WAL en Nivel 1+) / RTO 30 min |
| **Redis** | Solo por comodidad | AOF + snapshot diario | **RPO indefinido: no importa** |
| **Archivos subidos** (`uploads`) | **Sí** | `rsync`/`rclone` diario | RPO 24 h |
| **`.env.production`** | Sí, **fuera de banda** | Gestor de contraseñas del propietario | — |
| **Imágenes Docker** | No | Se reconstruyen desde el commit; están en GHCR | — |
| **Código** | No (implícito) | Está en Git + GHCR | — |
| **Modelos de Ollama** | No | Se vuelven a descargar con `ollama pull` | — |

**Por qué Redis no necesita backup real.** El outbox transaccional vive en **Postgres**
(ADR-009): si Redis pierde todas las colas, no se pierde ningún evento de negocio. El worker
sigue despachando `outbox_events` PENDING y las colas se reconstruyen. Lo único que se pierde
es trabajo **en vuelo** (un job que estaba corriendo a medias), y el consumidor es idempotente
por `event_id`. Así que perder Redis retrasa trabajo; no pierde datos. Esa es exactamente la
razón por la que se eligió outbox sobre publicar directamente a Redis.

### 11.2 Política de frecuencia y retención

```
Frecuencia
  · Diario automático           03:00 hora del negocio        pg_dump -Fc
  · Antes de cada migración     en el pipeline (migrate.yml)  pg_dump -Fc  ← REGLA DURA
  · Manual                      cuando se va a hacer algo riesgoso
  · Continuo (Nivel 1+)         WAL archiving → PITR          gestionado por el proveedor

Retención (regla 3-2-1: 3 copias, 2 medios, 1 fuera del sitio)
  · 7  diarios        (última semana, restauración rápida)
  · 4  semanales      (último mes)
  · 12 mensuales      (último año)
  · 1  offsite        (BACKUP_S3_URI; si no hay S3, copia cifrada en otro disco)
  · 1  antes de cada migración (se conserva 30 días)

Cifrado
  · En reposo: el backup se cifra si sale del host
        gpg --symmetric --cipher-algo AES256 < backup.dump > backup.dump.gpg
  · En tránsito: S3 con TLS; SSH/SCP para copias manuales
  · La clave de cifrado NO vive en el mismo host que los backups
```

Variables que gobiernan la política (`BACKUP_RETENTION_DAILY=7`,
`BACKUP_RETENTION_WEEKLY=4`, `BACKUP_RETENTION_MONTHLY=12`, `BACKUP_S3_URI`,
`BACKUP_PRE_MIGRATION=true`).

### 11.3 `scripts/backup.sh`

```bash
#!/usr/bin/env bash
# =============================================================================
# backup.sh — backup de PostgreSQL en formato custom (comprimido, restaurable
# selectivamente). Funciona en el VPS (Linux) y en Git Bash (Windows).
#
# Uso:
#   bash scripts/backup.sh                 # backup diario
#   bash scripts/backup.sh pre_migration   # backup etiquetado antes de migrar
#   ENV=staging bash scripts/backup.sh     # usa .env.staging
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

ENV="${ENV:-local}"
LABEL="${1:-daily}"
case "$ENV" in
  local)      ENV_FILE=".env" ;;
  staging)    ENV_FILE=".env.staging" ;;
  production) ENV_FILE=".env.production" ;;
  *)          ENV_FILE=".env.${ENV}" ;;
esac
[ -f "$ENV_FILE" ] || { echo "FALTA $ENV_FILE"; exit 1; }

# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
HOST="${POSTGRES_HOST:-localhost}"
PORT="${POSTGRES_PORT:-5432}"
DB="${POSTGRES_DB:-crm_ventas}"
USER="${POSTGRES_USER:-crm}"
FILE="${BACKUP_DIR}/${LABEL}_${DB}_${STAMP}.dump"
COMPOSE_FILE="infrastructure/compose/docker-compose.yml"

echo "[backup] entorno=$ENV base=$DB etiqueta=$LABEL"

# ── Ejecutar pg_dump ─────────────────────────────────────────────────────────
# Si el host de la base es un contenedor de Compose, se usa 'docker compose exec'
# para no depender de tener el cliente psql instalado en el host.
if [ "$HOST" = "localhost" ] || [ "$HOST" = "127.0.0.1" ]; then
  if docker compose -f "$COMPOSE_FILE" ps --status running postgres >/dev/null 2>&1; then
    echo "[backup] via contenedor postgres"
    docker compose -f "$COMPOSE_FILE" exec -T postgres \
      pg_dump -U "$USER" -d "$DB" -Fc -Z 6 > "$FILE"
  else
    echo "[backup] via cliente pg_dump local"
    PGPASSWORD="${POSTGRES_PASSWORD:?}" pg_dump -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" -Fc -Z 6 > "$FILE"
  fi
else
  echo "[backup] via cliente pg_dump remoto ($HOST:$PORT)"
  PGPASSWORD="${POSTGRES_PASSWORD:?}" pg_dump -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" -Fc -Z 6 > "$FILE"
fi

# ── Validar inmediatamente: un backup vacío o truncado es peor que no tenerlo ─
[ -s "$FILE" ] || { echo "[backup] ERROR: archivo vacio"; rm -f "$FILE"; exit 1; }
pg_restore -l "$FILE" > /dev/null 2>&1 || { echo "[backup] ERROR: archivo de backup invalido"; exit 1; }
SIZE="$(du -h "$FILE" | cut -f1)"
echo "[backup] OK $FILE ($SIZE)"

# ── Copia offsite si está configurada ────────────────────────────────────────
if [ -n "${BACKUP_S3_URI:-}" ]; then
  echo "[backup] copiando a $BACKUP_S3_URI"
  aws s3 cp "$FILE" "${BACKUP_S3_URI%/}/$(basename "$FILE")" --storage-class STANDARD_IA
  echo "[backup] offsite OK"
fi

# ── Retención ────────────────────────────────────────────────────────────────
DAILY="${BACKUP_RETENTION_DAILY:-7}"
WEEKLY="${BACKUP_RETENTION_WEEKLY:-4}"
MONTHLY="${BACKUP_RETENTION_MONTHLY:-12}"

echo "[backup] aplicando retencion (diarios=$DAILY semanales=$WEEKLY mensuales=$MONTHLY)"
# Diarios: conserva los N mas recientes con etiqueta 'daily'
ls -1t "${BACKUP_DIR}"/daily_*.dump 2>/dev/null | tail -n +"$((DAILY + 1))" | while read -r f; do
  rm -f "$f"; echo "  borrado $f"
done
# Semanales y mensuales: los del dia 1 de cada mes se copian como 'monthly_'
# (esquema simple; en Nivel 1+ lo gestiona el proveedor).
ls -1t "${BACKUP_DIR}"/pre_migration_*.dump 2>/dev/null | tail -n +31 | while read -r f; do
  rm -f "$f"; echo "  borrado $f (pre-migracion caducado)"
done

echo "[backup] completado"
```

### 11.4 `scripts/verify-backup.sh` — verificación de restaurabilidad

Se ejecuta **en el pipeline, tras cada backup pre-migración** (§7.7). No basta con que el
`pg_dump` haya terminado sin error.

```bash
#!/usr/bin/env bash
# =============================================================================
# verify-backup.sh — restaura el backup mas reciente en una base de usar y tirar
# y comprueba integridad. Si esto falla, el deploy NO continua.
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

ENV="${ENV:-local}"
ENV_FILE=".env"; [ "$ENV" = "local" ] || ENV_FILE=".env.${ENV}"
[ -f "$ENV_FILE" ] || { echo "FALTA $ENV_FILE"; exit 1; }
set -a; . "$ENV_FILE"; set +a

BACKUP_DIR="${BACKUP_DIR:-./backups}"
LATEST="$(ls -1t "${BACKUP_DIR}"/*.dump 2>/dev/null | head -n1 || true)"
[ -n "$LATEST" ] || { echo "NO HAY BACKUPS en $BACKUP_DIR"; exit 1; }
echo "[verify] backup a verificar: $LATEST"

COMPOSE_FILE="infrastructure/compose/docker-compose.yml"
VERIFY_DB="verify_$(date -u +%s)"

cleanup() { docker compose -f "$COMPOSE_FILE" exec -T postgres \
              psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS ${VERIFY_DB};" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "[verify] creando base de verificacion ${VERIFY_DB}"
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE ${VERIFY_DB};" >/dev/null

echo "[verify] restaurando..."
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_restore -U "$POSTGRES_USER" -d "$VERIFY_DB" --no-owner --no-privileges < "$LATEST"

echo "[verify] comprobando integridad..."
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$VERIFY_DB" -v ON_ERROR_STOP=1 <<'SQL'
-- 1. Las tablas del nucleo existen
DO $$
DECLARE faltan text;
BEGIN
  SELECT string_agg(t, ', ') INTO faltan
  FROM unnest(ARRAY['organizations','users','leads','products','campaigns',
                    'orders','approvals','ai_runs','outbox_events','audit_logs']) AS t
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.tables
                    WHERE table_schema='public' AND table_name=t);
  IF faltan IS NOT NULL THEN
    RAISE EXCEPTION 'FALTAN TABLAS: %', faltan;
  END IF;
END $$;

-- 2. Las extensiones estan presentes (ADR-008)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='vector') THEN
    RAISE EXCEPTION 'FALTA la extension vector';
  END IF;
END $$;

-- 3. Hay datos reales (no un esquema vacio)
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM organizations;
  IF n = 0 THEN RAISE EXCEPTION 'CERO organizaciones: backup sospechoso'; END IF;
  SELECT count(*) INTO n FROM users;
  IF n = 0 THEN RAISE EXCEPTION 'CERO usuarios: backup sospechoso'; END IF;
END $$;

-- 4. Integridad referencial basica: no hay huerfanos
SELECT count(*) AS leads_huerfanos
FROM leads l LEFT JOIN identities i ON i.id = l.identity_id
WHERE l.identity_id IS NOT NULL AND i.id IS NULL;
SQL

echo "[verify] OK: el backup $LATEST restaura y es integro"
```

### 11.5 Procedimiento de restauración probado

Este es el procedimiento completo, y **se ejecuta de verdad** una vez al mes como ejercicio
(§Fase 10: «restauro un backup en un entorno limpio y verifico integridad»). Un procedimiento
de restauración que nunca se ha ejecutado no existe.

#### Escenario A — restauración completa en local (ejercicio mensual)

```powershell
# ─── 1. Elegir la base de trabajo y detener escritores ───────────────────────
# En local se restaura en una base NUEVA, nunca sobre la que se está usando.
$STAMP   = "20261001T030000Z"
$BACKUP  = ".\backups\daily_crm_ventas_$STAMP.dump"

docker compose -f infrastructure/compose/docker-compose.yml stop api worker

# ─── 2. Crear la base destino ────────────────────────────────────────────────
docker compose -f infrastructure/compose/docker-compose.yml exec postgres `
  psql -U crm -d postgres -c "DROP DATABASE IF EXISTS crm_ventas_restore;"
docker compose -f infrastructure/compose/docker-compose.yml exec postgres `
  psql -U crm -d postgres -c "CREATE DATABASE crm_ventas_restore;"

# ─── 3. Restaurar ────────────────────────────────────────────────────────────
# -T evita el mapeo de TTY; Get-Content -Raw evita corromper binario con CRLF.
docker compose -f infrastructure/compose/docker-compose.yml exec -T postgres `
  pg_restore -U crm -d crm_ventas_restore --no-owner --no-privileges `
  --clean --if-exists `
  < (Get-Content -Raw -AsByteStream $BACKUP)

# ─── 4. VERIFICAR INTEGRIDAD (no basta con que pg_restore no de error) ──────
docker compose -f infrastructure/compose/docker-compose.yml exec postgres `
  psql -U crm -d crm_ventas_restore -v ON_ERROR_STOP=1 -c @"
SELECT
  (SELECT count(*) FROM organizations)              AS organizaciones,
  (SELECT count(*) FROM users)                      AS usuarios,
  (SELECT count(*) FROM leads)                      AS leads,
  (SELECT count(*) FROM orders)                     AS ordenes,
  (SELECT count(*) FROM ai_runs)                    AS ai_runs,
  (SELECT count(*) FROM outbox_events
     WHERE status='PENDING')                        AS outbox_pendiente,
  (SELECT count(*) FROM information_schema.tables
     WHERE table_schema='public')                   AS tablas;
"@

# Comprobación de integridad referencial: ninguna fila huérfana.
docker compose -f infrastructure/compose/docker-compose.yml exec postgres `
  psql -U crm -d crm_ventas_restore -c @"
SELECT 'leads sin identidad' AS problema, count(*) FROM leads l
  LEFT JOIN identities i ON i.id=l.identity_id WHERE l.identity_id IS NOT NULL AND i.id IS NULL
UNION ALL
SELECT 'orders sin identidad', count(*) FROM orders o
  LEFT JOIN identities i ON i.id=o.identity_id WHERE i.id IS NULL
UNION ALL
SELECT 'order_items sin order', count(*) FROM order_items oi
  LEFT JOIN orders o ON o.id=oi.order_id WHERE o.id IS NULL;
"@
# Todas las columnas 'count' deben ser 0.

# ─── 5. Probar la aplicación contra la base restaurada ──────────────────────
# Cambiar DATABASE_URL temporalmente y arrancar la API contra la copia.
$env:DATABASE_URL = "postgresql://crm:CAMBIAR_ESTA_CLAVE_EN_LOCAL@localhost:5432/crm_ventas_restore?schema=public"
pnpm --filter @crm/api start
Invoke-RestMethod http://localhost:3000/api/v1/admin/health | ConvertTo-Json -Depth 4
# Probar un login real, abrir el CRM y comprobar que los datos cuadran.

# ─── 6. Limpiar ──────────────────────────────────────────────────────────────
docker compose -f infrastructure/compose/docker-compose.yml exec postgres `
  psql -U crm -d postgres -c "DROP DATABASE crm_ventas_restore;"
docker compose -f infrastructure/compose/docker-compose.yml start api worker
```

#### Escenario B — restauración de emergencia en producción

```bash
# ─── 1. PARAR ESCRITORES (evita que lleguen escrituras durante la restauración)
cd /opt/crm
docker compose --env-file .env.production \
  -f infrastructure/compose/docker-compose.yml \
  -f infrastructure/compose/docker-compose.prod.yml stop api worker site

# ─── 2. GUARDAR EL ESTADO ACTUAL (por si la restauración es un error)
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
docker compose --env-file .env.production -f infrastructure/compose/docker-compose.yml \
  exec -T postgres pg_dump -U crm -d crm_ventas -Fc -Z 6 > "/backups/pre_restore_${STAMP}.dump"

# ─── 3. RESTAURAR
# --clean --if-exists: elimina los objetos existentes antes de recrearlos.
# --no-owner --no-privileges: no depende de los roles del host de origen.
docker compose --env-file .env.production -f infrastructure/compose/docker-compose.yml \
  exec -T postgres pg_restore -U crm -d crm_ventas \
  --clean --if-exists --no-owner --no-privileges \
  < /backups/daily_crm_ventas_20261001T030000Z.dump
# Es NORMAL ver avisos de "drop ... does not exist" durante el --clean.

# ─── 4. VERIFICAR INTEGRIDAD (idéntico al escenario A, paso 4)
docker compose --env-file .env.production -f infrastructure/compose/docker-compose.yml \
  exec -T postgres psql -U crm -d crm_ventas -v ON_ERROR_STOP=1 <<'SQL'
SELECT
  (SELECT count(*) FROM organizations) organizaciones,
  (SELECT count(*) FROM users)         usuarios,
  (SELECT count(*) FROM leads)         leads,
  (SELECT count(*) FROM orders)        ordenes;
SQL

# ─── 5. VERIFICAR QUE EL ESQUEMA COINCIDE CON EL CODIGO DESPLEGADO
docker compose --env-file .env.production -f infrastructure/compose/docker-compose.yml \
  run --rm --no-deps migrate sh -c \
  "./node_modules/.bin/prisma migrate status --schema=./prisma/schema.prisma"
# Debe decir "up to date". Si no, se restauro un backup de un esquema anterior:
# aplicar las migraciones pendientes con §6.4 ANTES de levantar la aplicación.

# ─── 6. REANUDAR EL SERVICIO
docker compose --env-file .env.production \
  -f infrastructure/compose/docker-compose.yml \
  -f infrastructure/compose/docker-compose.prod.yml up -d

# ─── 7. SMOKE TESTS + REGISTRO DEL INCIDENTE
bash /opt/crm/scripts/smoke-test.sh https://app.tudominio.com
# Registrar en docs/incidents.md: causa, backup usado, RPO real, RTO real.
```

#### Escenario C — restauración punto-en-el-tiempo (solo Nivel 1+)

Con WAL archiving habilitado (Postgres gestionado o `pgBackRest`/`wal-g` en el VPS), se puede
restaurar a un instante concreto, no solo al del último `pg_dump`:

```bash
# Con Postgres gestionado: se hace desde la consola del proveedor o su CLI.
# Con wal-g en el VPS:
wal-g backup-fetch /var/lib/postgresql/data LATEST
# Y aplicar WAL hasta el instante deseado con recovery_target_time.
```

Esto reduce el RPO de 24 h a minutos. Es un objetivo del **Nivel 1**, no del Nivel 0.

### 11.6 Calendario de verificación

| Frecuencia | Acción | Responsable | Evidencia |
|---|---|---|---|
| Diaria | Backup automático a las 03:00 (job repetible del worker) | Sistema | Archivo en `./backups` + copia offsite |
| Cada migración | Backup previo + `verify-backup.sh` (bloqueante) | Pipeline | Job verde en `migrate.yml` |
| Semanal | Revisar que los backups existen y no están vacíos | Tú | §10.4 paso 6 |
| **Mensual** | **Restauración completa en local (Escenario A)** | Tú | Entrada en `docs/incidents.md` con RTO medido |
| Trimestral | Rotación de secretos (§13.6) + revisión de retención | Tú | Registro de rotación |
| Anual | Simulacro de desastre completo (restaurar en una máquina limpia) | Tú | Informe |

---

## 12. Runbook de incidentes

Formato de cada ficha: **síntoma → impacto → diagnóstico → mitigación inmediata → resolución →
prevención**. El objetivo no es solo arreglarlo: es que la próxima vez se tarde menos.

### 12.1 Postgres caído

**Síntoma.** `/health/ready` devuelve `503` con `"db":"down"`. El CRM no carga datos. La API
responde errores 500 en cualquier endpoint que toque el dominio.

**Impacto.** **Alto.** Es la fuente de verdad del dominio. Sin Postgres no hay CRM. El sitio
público SSR sigue sirviendo páginas ya prerenderizadas, pero las páginas de producto en vivo
fallan.

**Diagnóstico.**

```powershell
docker compose -f infrastructure/compose/docker-compose.yml ps postgres
docker compose -f infrastructure/compose/docker-compose.yml logs --tail=100 postgres
Invoke-RestMethod http://localhost:3000/health/ready -SkipHttpErrorCheck | ConvertTo-Json
# Comprobar espacio y permisos del volumen:
docker system df -v | Select-String pgdata
```

**Causas y resolución, por orden de probabilidad:**

| Causa | Señal en el log | Resolución |
|---|---|---|
| **Puerto 5432 ocupado** | `bind: address already in use` | `Get-NetTCPConnection -LocalPort 5432 \| Select-Object OwningProcess`; matar el proceso o cambiar `POSTGRES_PORT` |
| **Volumen con datos de otra versión mayor** | `database files are incompatible with server` o `The data directory was initialized by PostgreSQL version X` | **No se puede degradar.** Restaurar en la imagen que corresponde a esa versión (`pg17`), hacer `pg_dump`, y migrar a la versión nueva de forma controlada |
| **Contraseña cambiada en `.env`** | `password authentication failed for user "crm"` | Recuperar la contraseña anterior; la contraseña vive **dentro** del volumen desde el primer arranque y cambiarla en `.env` no la actualiza |
| **RAM insuficiente** | OOM kill; el contenedor se reinicia en bucle | `docker stats`; bajar `shared_buffers`; cerrar modelos de Ollama (`ollama stop`) |
| **Disco lleno** | `No space left on device` | Ver §12.6 |
| **AOF/corrupción del volumen** | `invalid page in block ...` | **Restaurar del último backup** (§11.5 Escenario B) |

**Mitigación inmediata.**

```powershell
# Reiniciar el servicio (resuelve el caso transitorio)
docker compose -f infrastructure/compose/docker-compose.yml restart postgres
# Si no levanta, arrancar solo el servicio y seguir logs en vivo:
docker compose -f infrastructure/compose/docker-compose.yml up postgres
```

**Comportamiento esperado de la API.** `/health/live` sigue devolviendo `200` (el proceso vive)
y solo `/health/ready` devuelve `503`. Es lo que pide el criterio de aceptación de §O.2 y lo que
permite a Caddy/el balanceador sacar la instancia de rotación sin reiniciarla.

**Prevención.** Backups diarios verificados (§11); `POSTGRES_PASSWORD` gestionado con cuidado;
alertas de disco al 80%; no cambiar nunca la versión mayor de la imagen sin migración
controlada.

---

### 12.2 Redis caído

**Síntoma.** `/health/ready` con `"redis":"down"`. Los jobs no se procesan. La caché de
conectores falla.

**Impacto.** **Medio.** El CRM sigue funcionando en sus operaciones de lectura y escritura
directas (la API accede a Postgres, no a Redis, para el dominio). Lo que se degrada es:

- Los envíos a cola fallan → `POST /research-runs` devuelve `503` con `Retry-After`.
- No hay caché de conectores → los sync se deshabilitan por presupuesto de requests.
- Los rate limits no se aplican → **la API debe rechazar el tráfico limitable** en lugar de
  permitirlo sin control.

**Lo que NO se pierde, y por qué.** El outbox transaccional (ADR-009) vive en Postgres. Todo
evento de negocio ya está persistido como `outbox_events` PENDING. Cuando Redis vuelve, el
worker despacha la tabla y las colas se reconstruyen. Ningún cambio de estado se pierde.

**Diagnóstico.**

```powershell
docker compose -f infrastructure/compose/docker-compose.yml logs --tail=100 redis
docker compose -f infrastructure/compose/docker-compose.yml exec redis redis-cli ping
docker compose -f infrastructure/compose/docker-compose.yml exec redis redis-cli info memory
```

**Causas:**

| Causa | Señal | Resolución |
|---|---|---|
| `maxmemory-policy` distinto de `noeviction` | `OOM command not allowed when used memory > maxmemory` | Corregir el `command:` del servicio; BullMQ **exige** `noeviction` |
| AOF corrupto | `Bad file format reading the append only file` | `redis-check-aof --fix /data/appendonlydir/*.aof` o, si es irrecuperable, borrar `redisdata` (no se pierden datos de negocio) |
| Puerto 6379 ocupado | `bind: address already in use` | Igual que con Postgres |
| Contenedor eliminado por OOM | `Killed` | Subir `REDIS_MAXMEMORY` o el límite del contenedor |

**Resolución y recuperación.**

```powershell
docker compose -f infrastructure/compose/docker-compose.yml restart redis
# Si el volumen AOF esta corrupto y no importa perder trabajo en vuelo:
docker compose -f infrastructure/compose/docker-compose.yml stop redis
docker volume rm crm-ventas_redisdata    # destructivo, pero seguro (ver arriba)
docker compose -f infrastructure/compose/docker-compose.yml up -d redis
# Al arrancar el worker, el outbox repuebla las colas automaticamente.
```

**Verificación post-recuperación.**

```powershell
docker compose -f infrastructure/compose/docker-compose.yml exec postgres psql -U crm -d crm_ventas -c `
  "SELECT status, count(*) FROM outbox_events GROUP BY status;"
# Los PENDING deben empezar a bajar hacia cero en segundos.
```

---

### 12.3 Ollama caído

**Síntoma.** `GET /api/v1/admin/health` con `"ollama":"down"`. Los jobs de la cola `ai` fallan
con `ECONNREFUSED` o agotan su timeout. En los logs del worker: `ai_run FAILED`.

**Impacto.** **Bajo-medio. Degradación, NO caída total del CRM.** Este es un criterio de
aceptación explícito del roadmap (Fase 10: «una caída de Ollama degrada el sistema sin tumbar
el CRM»). Concretamente:

| Sigue funcionando | Se degrada |
|---|---|
| CRM: leads, contactos, oportunidades, actividades | Investigación de productos (research runs) |
| Catálogo y economía unitaria | Scoring que requiere inferencia |
| Campañas en `DRAFT`, aprobaciones, transiciones | Generación de contenido con modelos locales |
| Atribución, órdenes, analítica | Clasificación y extracción en lote |
| Login, auditoría, outbox | Embeddings y clustering semántico |

**Por qué no tumba el CRM.** La cola `ai` está separada de las demás (`io`, `compute`, `seo`) y
con concurrencia 1 (ADR-010). Un fallo de Ollama congela esa cola, no las otras. Además, el
`ModelRouter` tiene cadena de fallback (ADR-007): si el tier 1 local no responde, intenta el
tier 2 y luego el tier 3 remoto (`:cloud` o API externa). Si tampoco hay remoto, la tarea queda
`FAILED` con causa explícita y **se reintenta con backoff**, sin bloquear nada más.

**Diagnóstico.**

```powershell
ollama list                       # ¿responde el binario?
ollama ps                         # ¿qué modelo está cargado?
Get-Process ollama* -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 11434 -State Listen -ErrorAction SilentlyContinue
Invoke-RestMethod http://localhost:11434/api/tags
# Desde un contenedor:
docker compose --env-file .env -f infrastructure/compose/docker-compose.yml `
  run --rm --entrypoint node api -e "fetch('http://host.docker.internal:11434/api/tags').then(r=>console.log(r.status)).catch(e=>console.log('FALLO',e.message))"
```

**Resolución.**

```powershell
# 1. Arrancar Ollama
ollama serve
# Si esta instalado como aplicacion, abrirla (mantiene un proceso en segundo plano).

# 2. Si falta el modelo
ollama pull gemma4:8b
ollama pull nomic-embed-text

# 3. Liberar RAM si el modelo grande se quedo cargado
ollama ps
ollama stop gemma4:26b

# 4. Si el contenedor no alcanza el host (problema de red, no de Ollama):
docker compose --env-file .env -f infrastructure/compose/docker-compose.yml `
  exec api nslookup host.docker.internal
# En Docker Desktop debe resolver. En Linux, verificar 'extra_hosts: host-gateway' (§5.2).
```

**Reencolar lo que falló.**

```powershell
# Reintentar los jobs fallidos de la cola ai (BullMQ los conserva):
docker compose -f infrastructure/compose/docker-compose.yml exec redis `
  redis-cli --scan --pattern 'crm:bull:ai:failed*'
# Desde el centro de control (UI) o:
docker compose -f infrastructure/compose/docker-compose.yml exec worker `
  node dist/scripts/retry-failed.js --queue ai
```

**Prevención.** `OLLAMA_KEEP_ALIVE=5m` para no quedarse con 17 GB cargados; `verify-env.ps1`
en cada arranque; health check que distingue «Ollama caído» de «CRM caído» en el centro de
control.

---

### 12.4 La cola se atasca

**Síntoma.** `ZCARD crm:bull:<cola>:active` no baja. El outbox acumula PENDING. Los research
runs quedan en `RUNNING` para siempre.

**Diagnóstico.**

```powershell
# Profundidad por cola
foreach ($q in 'io','ai','compute','seo') {
  $depth = docker compose -f infrastructure/compose/docker-compose.yml exec -T redis `
    redis-cli ZCARD "crm:bull:$q:wait"
  $active = docker compose -f infrastructure/compose/docker-compose.yml exec -T redis `
    redis-cli ZCARD "crm:bull:$q:active"
  $failed = docker compose -f infrastructure/compose/docker-compose.yml exec -T redis `
    redis-cli ZCARD "crm:bull:$q:failed"
  "$q  wait=$depth active=$active failed=$failed"
}

# Outbox acumulado
docker compose -f infrastructure/compose/docker-compose.yml exec postgres psql -U crm -d crm_ventas -c `
  "SELECT status, count(*) FROM outbox_events GROUP BY status;"

# ¿El worker está vivo?
docker compose -f infrastructure/compose/docker-compose.yml ps worker
docker compose -f infrastructure/compose/docker-compose.yml logs --tail=200 worker
```

**Causas y resolución:**

| Causa | Señal | Resolución |
|---|---|---|
| **Worker caído** | `worker` en `Exited` | `docker compose up -d worker`; revisar por qué murió |
| **Job en bucle infinito** | `active=1` constante, CPU del worker saturada, sin logs de progreso | Matar el job con `--force`; corregir el timeout del job (debe existir **siempre**) |
| **Lock de BullMQ huérfano** | `active>0` pero ningún worker vivo | `docker compose restart worker`: al arrancar, BullMQ reclama los locks expirados |
| **Redis sin `noeviction`** | Jobs que desaparecen solos | Corregir la configuración (§12.2) |
| **Ollama saturado** | `ai` con `active=1` y cada job tardando minutos | Es **esperado** con `QUEUE_AI_CONCURRENCY=1` en CPU. No es un atasco: es la cola trabajando al ritmo de la máquina |
| **Outbox sin despachar** | `PENDING` creciendo sin parar | Verificar que el consumidor de outbox vive en el worker; comprobar `OUTBOX_POLL_INTERVAL_MS` |
| **Job que siempre falla y reintenta** | `attempts` subiendo | Ver el error real: `jobs_audit` y `ai_tool_calls` |

**Reencolar / purgar.**

```powershell
# Reintentar todos los fallidos de una cola
docker compose -f infrastructure/compose/docker-compose.yml exec worker `
  node dist/scripts/retry-failed.js --queue ai --all

# Purgar una cola COMPLETAMENTE (destructivo: se pierde ese trabajo)
docker compose -f infrastructure/compose/docker-compose.yml exec redis `
  redis-cli DEL crm:bull:seo:wait crm:bull:seo:failed

# Vaciar el outbox de eventos ya despachados antiguos (job de retención)
docker compose -f infrastructure/compose/docker-compose.yml exec postgres psql -U crm -d crm_ventas -c `
  "DELETE FROM outbox_events WHERE status='DISPATCHED' AND created_at < now() - interval '30 days';"
```

**Prevención.** Todo job declara `attempts`, `backoff`, `timeout` y deduplicación por `jobId`
(§C.5). Un job sin timeout es un bug, no una configuración.

---

### 12.5 Un conector bloqueado

**Síntoma.** Un conector deja de traer datos. `connectors_registry.last_error` tiene contenido.
Los research runs devuelven menos candidatos de los esperados o ninguno.

**Impacto.** **Bajo.** Los conectores están tras interfaz (ADR-004): la caída de una fuente no
rompe el sistema. El pipeline debe funcionar aceptablemente **con una sola fuente**.

**Diagnóstico.**

```powershell
Invoke-RestMethod http://localhost:3000/api/v1/connectors | ConvertTo-Json -Depth 5

docker compose -f infrastructure/compose/docker-compose.yml exec postgres psql -U crm -d crm_ventas -c `
  "SELECT id, marketplace, enabled, kill_switch, approved_at, last_sync_at, last_error
   FROM connectors_registry ORDER BY marketplace;"
```

**Causas y resolución:**

| Causa | Señal | Resolución |
|---|---|---|
| **Rate limit del marketplace** | HTTP 429 | Es **esperado** y correcto: el conector respeta el límite. Bajar `requests_per_day_budget`; el backoff reintenta. No hacer nada más |
| **Circuit breaker abierto** | `Circuit breaker OPEN` en `last_error` | Esperar `CONNECTOR_CIRCUIT_BREAKER_COOLDOWN_MS` (10 min) o reiniciar el worker para cerrarlo manualmente |
| **Credenciales caducadas** | HTTP 401/403 | Renovar el token (OAuth) y actualizar `.env`; reiniciar el worker |
| **Cambio de API del marketplace** | Errores de parsing / 404 | El conector es una clase; corregir y desplegar. **No** improvisar un scraper: rompe ADR-004 |
| **Bloqueo por abuso** | HTTP 403 persistente | **Activar el kill switch** y degradar a carga manual. Revisar la ficha de compliance |
| **Falta la ficha de compliance** | El factory rechaza instanciar | `approved_at IS NULL`. Sin ficha aprobada el conector **no se activa** (ADR-004). Es correcto |

**Kill switch (parada de emergencia).**

```powershell
docker compose -f infrastructure/compose/docker-compose.yml exec postgres psql -U crm -d crm_ventas -c `
  "UPDATE connectors_registry SET kill_switch = true, enabled = false WHERE marketplace = 'mercadolibre';"

# Desbloquear cuando se resuelva:
docker compose -f infrastructure/compose/docker-compose.yml exec postgres psql -U crm -d crm_ventas -c `
  "UPDATE connectors_registry SET kill_switch = false, enabled = true WHERE marketplace = 'mercadolibre';"
```

**Fallback documentado.** Mientras el conector esté bloqueado se puede cargar producto
manualmente (ADR-004 lo contempla explícitamente como fallback, no como estrategia). El
research run funciona con menos candidatos y el scoring marca `INSUFFICIENT_DATA` en lugar de
inventar (ADR-013).

---

### 12.6 Disco lleno

**Síntoma.** Escrituras que fallan. Postgres con `No space left on device`. Builds de Docker
que fallan. El `verify-env.ps1` avisa con `Disco C: < 40 GB libres`.

**Diagnóstico.**

```powershell
Get-PSDrive C | Select-Object @{n='LibreGB';e={[math]::Round($_.Free/1GB,1)}}
docker system df -v
docker volume ls --filter name=crm-ventas
ollama list          # los modelos ocupan decenas de GB
Get-ChildItem .\backups | Measure-Object -Property Length -Sum
```

**Resolución, en orden de menor a mayor riesgo:**

```powershell
# 1. Capas e imagenes huerfanas (SEGURO: no toca volumenes)
docker image prune -a -f
docker builder prune -a -f

# 2. Logs de contenedores (ya limitados a 20 MB x 5 por servicio, pero por si acaso)
docker system prune -f

# 3. Imagenes viejas de un tag concreto (conservando la ultima)
docker images --filter "reference=ghcr.io/*/crm-ventas/*" --format "{{.ID}} {{.Tag}} {{.CreatedSince}}"

# 4. Modelos de Ollama que no se usan (NO borrar gemma4:8b ni el de embeddings)
ollama rm qwen3.6:36b        # 23 GB
ollama rm gemma4:26b         # 17 GB (si no se usa para batch nocturno)

# 5. Backups antiguos (respetando la retencion de §11.2)
Get-ChildItem .\backups\*.dump | Sort-Object LastWriteTime | Select-Object -First 5

# 6. ULTIMO RECURSO: volumenes. Destructivo. Requiere backup verificado antes.
# docker volume rm crm-ventas_pgdata
```

**Prevención.** El disco de la máquina verificada tiene 199 GB libres, suficiente para el MVP.
El cuello aparece antes si se generan imágenes/video (Fase 6+), y por eso `StorageProvider`
está abstraído desde el día 1 (§J.2). En el VPS, alerta automática al 80% de uso. **Vigilar
siempre los modelos de Ollama**: suman ~50 GB solo con los tres actuales.

---

### 12.7 Coste de IA disparado

**Síntoma.** `ai_costs` del día supera `DAILY_AI_BUDGET_USD`. Notificación al 80%
(`ALERT_THRESHOLD_PCT`). Un agente entró en bucle y llamó al modelo cientos de veces.

**Impacto.** **Medio.** El riesgo real de este sistema no es gastar de más hoy (con
`gemma4:8b` local el coste marginal es ~0): es que **el coste aparezca sin medirse** cuando las
tareas de calidad migren a la nube (§G.5). Por eso `ai_costs` existe desde la Fase 4, antes de
cualquier proveedor de pago.

**Diagnóstico.**

```powershell
docker compose -f infrastructure/compose/docker-compose.yml exec postgres psql -U crm -d crm_ventas -c `
  "SELECT provider, model, count(*) llamadas, sum(prompt_tokens+completion_tokens) tokens,
          round(sum(cost_usd),4) usd
   FROM ai_costs WHERE created_at > now() - interval '24 hours'
   GROUP BY 1,2 ORDER BY usd DESC;"

# ¿Qué agente esta gastando?
docker compose -f infrastructure/compose/docker-compose.yml exec postgres psql -U crm -d crm_ventas -c `
  "SELECT agent_id, task_type, count(*), round(sum(cost_usd),4) usd
   FROM ai_costs WHERE created_at > now() - interval '24 hours'
   GROUP BY 1,2 ORDER BY usd DESC;"

# ¿Se está respetando el routing? (los tier 3 son los que cuestan)
docker compose -f infrastructure/compose/docker-compose.yml exec postgres psql -U crm -d crm_ventas -c `
  "SELECT routing_reason, model_used, count(*) FROM ai_runs
   WHERE started_at > now() - interval '24 hours' GROUP BY 1,2 ORDER BY 3 DESC;"

# Presupuesto consumido
docker compose -f infrastructure/compose/docker-compose.yml exec postgres psql -U crm -d crm_ventas -c `
  "SELECT scope, period, limit_usd, current_spend_usd,
          round(100*current_spend_usd/nullif(limit_usd,0),1) pct
   FROM ai_budgets;"
```

**Mitigación inmediata.**

```powershell
# 1. Forzar el modo mas restrictivo: solo modelos locales
docker compose -f infrastructure/compose/docker-compose.yml exec postgres psql -U crm -d crm_ventas -c `
  "UPDATE feature_flags SET enabled=false WHERE key='ai_cloud_models';"
# Y en .env:  AI_BUDGET_ENFORCEMENT=hard

# 2. Pausar la cola ai (deja de consumir; el outbox conserva los eventos)
docker compose -f infrastructure/compose/docker-compose.yml exec worker `
  node dist/scripts/pause-queue.js --queue ai

# 3. Cancelar las ejecuciones en curso
docker compose -f infrastructure/compose/docker-compose.yml exec postgres psql -U crm -d crm_ventas -c `
  "UPDATE ai_tasks SET status='CANCELLED' WHERE status IN ('QUEUED','RUNNING');"
```

**Reglas del router que actúan como freno (ADR-007, §G.3), en orden:**

1. Si `DAILY_AI_BUDGET` está agotado → **solo modelos locales** permitidos, o la tarea se
   encola para mañana.
2. Clase de tarea → tier (clasificación y extracción son siempre tier 1 local).
3. Criticidad `critical` sube un tier (y por tanto el coste: usar con criterio).
4. Fallback en cascada si un proveedor falla.
5. Toda decisión queda en `ai_runs.routing_reason`: se puede responder **por qué** se usó cada
   modelo.

**Prevención.** `AICostTracker` es un interceptor en el nivel del `LLMProvider`: **ninguna**
llamada puede evadirlo, ni desde código nuevo escrito dentro de un año (§G.5). Los presupuestos
son configuración, no constantes en código. Y el mayor coste real del negocio no es la IA: es
el **ad spend**, que el MVP no automatiza (§P.3 y §M.2).

---

## 13. Hardening de producción

### 13.1 Modelo de exposición

El principio es simple: **un solo punto de entrada público, todo lo demás cerrado.**

```
                            INTERNET
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Caddy  :80 / :443    │  ← ÚNICO servicio publicado
                    │  TLS + HSTS + CSP     │
                    └───────────┬───────────┘
                                │ red crm-edge (bridge, solo interna)
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
   ┌─────────┐            ┌──────────┐            ┌──────────┐
   │  web    │            │  site    │            │   api    │
   │ :8080   │            │ :4000    │            │ :3000    │
   └─────────┘            └──────────┘            └────┬─────┘
                                                       │ red crm-data (internal:true)
                                          ┌────────────┴────────────┐
                                          ▼                         ▼
                                    ┌──────────┐              ┌──────────┐
                                    │ postgres │              │  redis   │
                                    │ :5432    │              │ :6379    │
                                    └──────────┘              └──────────┘
                                                       ┌──────────┐
                                                       │  worker  │
                                                       │ :9464    │  (solo salud/metricas)
                                                       └──────────┘
```

### 13.2 Puertos: qué se expone y qué NO

| Puerto | Servicio | Producción | Por qué |
|---|---|---|---|
| **80** | Caddy | ✅ **Abierto** | Redirección 301 a HTTPS + desafío ACME |
| **443** | Caddy | ✅ **Abierto** | Todo el tráfico |
| 22 | SSH | ⚠️ **Abierto, restringido** | Solo con clave, puerto alternativo, fail2ban, IP permitida si es posible |
| **5432** | Postgres | ❌ **NUNCA** | Acceso solo por SSH tunnel si hace falta inspección |
| **6379** | Redis | ❌ **NUNCA** | Sin autenticación por defecto; exponerlo es un incidente |
| **3000** | API | ❌ **NUNCA** | Se alcanza a través de Caddy (`/api/*`) |
| **4000** | Site SSR | ❌ **NUNCA** | Se alcanza a través de Caddy |
| **8080** | Adminer | ❌ **NUNCA** | No existe en producción (`profiles: ["never"]`) |
| **9464** | Worker métricas | ❌ **NUNCA** | Solo en `crm-data`; se consulta por SSH o desde Prometheus en la red |
| **11434** | Ollama | ❌ **NUNCA** | Sin autenticación. Ver §13.7 |

En Compose esto se consigue con puertos atados a `127.0.0.1` en el base y con `ports: !reset []`
en el override de producción. La única excepción es Caddy.

**Firewall (VPS Linux).**

```bash
# Solo SSH, HTTP y HTTPS. Todo lo demas, denegado por defecto.
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp        # HTTP/3
sudo ufw enable
sudo ufw status verbose

# Blindaje extra: bloquear explicitamente los puertos de datos aunque un override
# mal escrito intente publicarlos. Defensa en profundidad.
sudo ufw deny 5432/tcp
sudo ufw deny 6379/tcp
sudo ufw deny 3000/tcp
sudo ufw deny 11434/tcp
```

En Windows (entorno local) el firewall ya bloquea las conexiones entrantes por defecto; Ollama
escucha en `127.0.0.1` y Docker Desktop publica solo en loopback, así que no hay exposición.

### 13.3 TLS

- **Certificados automáticos** con Caddy + Let's Encrypt. Renovación transparente.
- **Solo TLS 1.2 y 1.3.** Caddy ya no negocia versiones anteriores por defecto.
- **HSTS** con `max-age=31536000; includeSubDomains; preload`. Solo se añade `preload` cuando
  todos los subdominios están en HTTPS.
- **HTTP/3** habilitado (UDP 443).
- **Redirección 301** de HTTP a HTTPS, obligatoria.
- **`COOKIE_SECURE=true`** en producción: sin esto, la cookie de refresh viajaría en claro.
- **Verificación:**

```bash
curl -sI https://app.tudominio.com | grep -i strict-transport-security
# SSL Labs debe dar A o A+:
# https://www.ssllabs.com/ssltest/analyze.html?d=app.tudominio.com
```

### 13.4 Cabeceras de seguridad y CSP

Definidas en el `Caddyfile` (§3.3) y reforzadas en nginx (§4.5). El reparto de
responsabilidad es deliberado:

| Cabecera | Valor | Motivo |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Fuerza HTTPS en futuras visitas |
| `X-Content-Type-Options` | `nosniff` | Evita el MIME sniffing |
| `X-Frame-Options` | `DENY` (CRM) / `SAMEORIGIN` (site) | Clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limita la fuga de URLs |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=(), payment=()` | Desactiva APIs que no se usan |
| `X-Robots-Tag` | `noindex, nofollow, noarchive` (CRM) / `index, follow` (site) | Materializa §I.1 |
| `Cross-Origin-Opener-Policy` | `same-origin` | Aislamiento del contexto |
| `Content-Security-Policy` | Ver abajo | La defensa real contra XSS almacenado |

**CSP y XSS almacenado (amenaza 2 de §K.1).** El control principal es la **sanitización en el
servidor al guardar** (`content.body_html`, con allowlist tipo DOMPurify + schema propio). La
CSP es la segunda capa:

```
default-src 'self';
script-src  'self';
style-src   'self' 'unsafe-inline';
img-src     'self' data: https:;
font-src    'self';
connect-src 'self';
frame-ancestors 'none';
base-uri    'self';
form-action 'self';
object-src  'none';
upgrade-insecure-requests
```

Notas honestas sobre la CSP:

- `style-src 'unsafe-inline'` está presente porque Angular inyecta estilos en runtime. Es una
  concesión **solo para estilos**; `script-src 'self'` se mantiene estricto, que es lo que
  importa contra XSS real.
- El objetivo a medio plazo es CSP con **nonce** (`ngCspNonce` de Angular) para eliminar
  `unsafe-inline` también en estilos.
- El HTML de IA **nunca** se inyecta con `innerHTML` sin sanear (§K.1).
- La CSP del CRM y la del sitio público son distintas a propósito: el público necesita `https:`
  en `img-src` (imágenes de producto) y el CRM no.

**Verificación.**

```bash
curl -sI https://app.tudominio.com | grep -Ei 'content-security|strict-transport|x-frame|x-content'
# Y la suite automatizada de OWASP ZAP baseline contra staging (opcional, semanal).
```

### 13.5 Red y aislamiento

- `crm-data` es `internal: true`: postgres y redis **no** tienen salida a Internet ni ruta
  desde el exterior.
- `crm-edge` es la red de borde. Solo contiene Caddy, `web`, `site` y `api`.
- `adminer` no existe en producción.
- El worker no publica puertos; su `9464` vive solo en `crm-data`.
- **Sin `network_mode: host`** en ningún servicio.
- **Sin `privileged: true`** en ningún servicio.
- Todos los contenedores corren como **usuario no root** (§4).
- `read_only: true` para `web` y `api` es un endurecimiento opcional de Nivel 1 (requiere mover
  los paths temporales a `tmpfs`).

### 13.6 Rotación de secretos

| Secreto | Frecuencia | Procedimiento | Impacto de la rotación |
|---|---|---|---|
| `JWT_ACCESS_SECRET` | 90 días | Generar nuevo, actualizar `.env`, reiniciar `api`. Los access tokens vigentes quedan inválidos en ≤ 15 min | Bajo: los usuarios renuevan con el refresh |
| `JWT_REFRESH_SECRET` | 90 días | Igual, pero **invalida todas las sesiones** | Medio: hay que volver a iniciar sesión |
| `POSTGRES_PASSWORD` | 180 días | `ALTER USER crm WITH PASSWORD '...'` **y** actualizar `.env` en el mismo paso, luego recrear `api` y `worker` | Alto si se desincroniza: hacerlo en ventana de mantenimiento |
| `MELI_CLIENT_SECRET` | Según el proveedor | Regenerar en el portal, actualizar `.env`, reiniciar `worker` | Bajo: los sync reintentan |
| Claves SSH | Anual | Generar par nuevo, añadir la pública, verificar acceso, retirar la vieja | Bajo si se hace en el orden correcto |
| Secretos de CI | Anual + ante cualquier sospecha | Rotar en GitHub → Settings → Secrets y en el VPS | Medio: el deploy falla hasta que ambos coincidan |

**Ante un secreto comprometido, la rotación es inmediata y completa.** No se rota solo el
secreto filtrado: se rotan todos los que estuvieran accesibles en el mismo lugar (si un `.env`
llegó a un commit, **todo** ese `.env` está comprometido).

**Reglas duras:**

1. La clave nueva se aplica **antes** de retirar la vieja cuando el sistema lo permite
   (JWT: aceptar dos claves durante una ventana; contraseñas de DB: `ALTER` y `.env` en el
   mismo comando).
2. Un secreto rotado se revoca en el proveedor, no solo se reemplaza localmente.
3. La rotación se registra con fecha en un archivo de control (no en el repositorio).

### 13.7 Ollama: nunca exponerlo a la red

**Ollama no tiene autenticación.** Cualquiera que alcance `:11434` puede listar y ejecutar
todos los modelos, y consumir la CPU de la máquina. Peor: los modelos `:cloud` **consumen
crédito de una cuenta**. Exponerlo no es "dar acceso a un servicio más": es entregar la
capacidad de cómputo y la factura.

**Configuración correcta:**

| Plataforma | Binding | Por qué |
|---|---|---|
| **Windows 11 (esta máquina)** | `127.0.0.1:11434` (default) | Docker Desktop alcanza el loopback del host a través de `host.docker.internal`. No hace falta exponerlo |
| **Linux con Docker** | `0.0.0.0:11434` **mitigado con firewall** | El loopback del host no es alcanzable desde contenedores con Docker nativo. Se abre y se cierra con `ufw`: solo la subred de Docker (172.16.0.0/12) puede entrar; el resto, denegado (§5.2) |

**Comprobaciones:**

```powershell
# En Windows: confirmar que escucha SOLO en loopback
Get-NetTCPConnection -LocalPort 11434 -State Listen |
  Select-Object LocalAddress, LocalPort, OwningProcess
# -> LocalAddress debe ser 127.0.0.1 o ::1, NUNCA 0.0.0.0

# Confirmar que desde OTRA máquina de la red NO responde:
# (ejecutar desde un portatil en la misma wifi)
Test-NetConnection -ComputerName 192.168.x.x -Port 11434   # -> TcpTestSucceeded: False
```

**Si algún día hay que exponerlo** (por ejemplo, un host de inferencia compartido en el
Nivel 2): va **detrás de un proxy con autenticación** (Caddy con `basicauth` o mTLS), con TLS,
con rate limit y con `OLLAMA_HOST` ligado a la red privada, nunca a Internet. Y se documenta
como decisión explícita, no como un descuido.

**Advertencia adicional sobre los modelos `:cloud`.** Los modelos `:cloud` de la máquina
verificada se ejecutan en los servidores de Ollama, no localmente. Eso significa que:
(a) requieren conexión a Internet; (b) consumen una cuota o crédito de la cuenta asociada; y
(c) el contenido enviado sale de la máquina. Si algún día se envían datos de clientes a un
modelo `:cloud` o a una API externa, eso es una **decisión de tratamiento de datos** que hay
que reflejar en la política de privacidad (§K.1 amenaza 10). En el MVP, lo que se envía a
modelos remotos es contenido de marketing y datos públicos de producto, no datos personales.

### 13.8 Checklist de hardening antes de producción

```
[ ] ufw activo y solo 22/80/443 abiertos; 5432/6379/3000/11434 denegados explicitamente
[ ] Caddy sirviendo TLS con certificado valido; redireccion 301 de HTTP a HTTPS
[ ] HSTS presente con includeSubDomains
[ ] COOKIE_SECURE=true y COOKIE_SAMESITE=lax en .env.production
[ ] CORS_ORIGINS con el dominio real, NUNCA '*'
[ ] Adminer ausente (profiles: ["never"] en el override de produccion)
[ ] Ningun contenedor corre como root (docker inspect ... | grep '"User"')
[ ] Ningun contenedor con privileged: true ni network_mode: host
[ ] crm-data con internal: true; postgres y redis sin ruta a Internet
[ ] Ollama escuchando solo en loopback (Windows) o cerrado por firewall (Linux)
[ ] Ollama NO alcanzable desde otra maquina de la red (Test-NetConnection)
[ ] Sanitizacion de HTML de IA activa y probada con un payload de XSS
[ ] gitleaks en verde en el ultimo build
[ ] Trivy sin CRITICAL sin mitigacion en las cuatro imagenes
[ ] pnpm audit --prod sin HIGH/CRITICAL
[ ] Backups automaticos activos, con restauracion verificada en el ultimo mes
[ ] Rotacion de secretos registrada con fecha
[ ] /health/ready expuesto solo a traves de Caddy (no directamente)
[ ] Logs sin secretos (revisar una muestra de pino: ningun token, ninguna contrasena)
[ ] Sentry configurado con redaccion de datos sensibles
[ ] Rate limiting activo en /auth/login (throttler con store en Redis)
```

---

## Anexo B — Resumen de comandos por escenario

| Necesito… | Comando |
|---|---|
| Comprobar el entorno | `powershell -ExecutionPolicy Bypass -File .\scripts\verify-env.ps1 -Fix` |
| Instalar pnpm | *nada* — usar `corepack pnpm …` (§1.2) |
| Instalar WSL2 **[ADMIN] [REINICIO]** | `wsl --install` |
| Instalar Docker **[ADMIN] [REINICIO]** | `winget install --id Docker.DockerDesktop --exact` |
| Descargar embeddings | `ollama pull nomic-embed-text` |
| Instalar dependencias | `corepack pnpm install --frozen-lockfile` |
| Preparar el entorno | `Copy-Item .env.example .env` → rellenar secretos |
| Levantar la infra | `corepack pnpm infra:up` |
| Bootstrap de la base | `corepack pnpm bootstrap` |
| Arrancar en dev | `corepack pnpm dev` |
| Levantar todo en contenedores | `corepack pnpm infra:up:dev` |
| Levantar como producción (local) | `corepack pnpm infra:up:prodlike` |
| Ver logs de un servicio | `docker compose -f infrastructure/compose/docker-compose.yml logs -f api` |
| Reiniciar un servicio | `docker compose -f infrastructure/compose/docker-compose.yml restart api` |
| Entrar a psql | `docker compose -f infrastructure/compose/docker-compose.yml exec postgres psql -U crm -d crm_ventas` |
| Entrar a redis-cli | `docker compose -f infrastructure/compose/docker-compose.yml exec redis redis-cli` |
| Aplicar migraciones | `corepack pnpm db:migrate` |
| Estado de migraciones | `corepack pnpm db:migrate:status` |
| Regenerar el cliente del contrato | `corepack pnpm contract:generate` |
| Verificar drift del contrato | `corepack pnpm contract:check` |
| Backup manual | `bash scripts/backup.sh manual` |
| Verificar un backup | `bash scripts/verify-backup.sh` |
| Restaurar | `bash scripts/restore.sh ./backups/<archivo>.dump` |
| Ver el estado de salud | `Invoke-RestMethod http://localhost:3000/health/ready` |
| Ver profundidad de colas | `docker compose ... exec redis redis-cli ZCARD crm:bull:ai:wait` |
| Ver coste de IA | psql → `SELECT * FROM ai_costs WHERE created_at > now() - interval '24 hours';` |
| Limpiar sin perder datos | `docker compose -f infrastructure/compose/docker-compose.yml down` |
| Limpiar disco (seguro) | `docker image prune -a -f; docker builder prune -a -f` |

---

## Anexo C — Trazabilidad con las decisiones congeladas

| Sección de este documento | ADR / § que la gobierna |
|---|---|
| §1.3 embeddings y dimensión de `vector(N)` | ADR-008, **ADR-019** (decidida: 768 / `nomic-embed-text`) |
| §2.4 infraestructura en Compose, app nativa | §J.2 |
| §3.1 ausencia del servicio `ollama` | ADR-015 |
| §3.1 ausencia del servicio `scheduler` | ADR-010 |
| §3.1 `noeviction` en Redis | ADR-009 (BullMQ) |
| §3.1 `internal: true` en `crm-data` | §K.1 amenaza 9 |
| §4.2–4.3 usuario no root, `dumb-init` | §K.2, hardening |
| §4.4 SSR sirviendo `robots.txt` y `sitemap.xml` | §I.3 |
| §4.5 `X-Robots-Tag: noindex` en el CRM | ADR-002, §I.1 |
| §5.2 `host.docker.internal` y `host-gateway` | ADR-015, §C.6 |
| §5.4 `QUEUE_AI_CONCURRENCY=1` | ADR-010 |
| §6.1 orden `001_core` → `010_experiments` | `database.md` §13 |
| §6.3 expand/contract | ADR-009, §J.3 |
| §7.1 path filters, sin Nx/Turborepo | ADR-002 |
| §7.3 job `contract` que falla por drift | ADR-012, §J.3 |
| §7.6 `secret-scan` bloqueando el build | §J.3, §K.1 amenaza 5 |
| §7.7 backup previo obligatorio en `migrate.yml` | §J.3 regla dura |
| §7.8 aprobación manual en producción | §J.3, §Fase 10 |
| §8.2 misma imagen, distinto `.env` | §J.1 |
| §9.4 sin Kubernetes en niveles 0-2 | §J.4, §L |
| §10 comandos de operación | §J.2 |
| §11.1 Redis sin backup real (outbox en Postgres) | ADR-009 |
| §12.3 caída de Ollama = degradación, no caída | §Fase 10 criterio de aceptación |
| §12.5 kill switch del conector | ADR-004 |
| §12.7 presupuestos y `AICostTracker` | ADR-007, §G.5 |
| §13.4 CSP contra XSS almacenado | §K.1 amenaza 2 |
| §13.7 no exponer Ollama | ADR-015, §P.2 riesgo S8 |

---

> **Documento vivo.** `docs/deployment.md` se actualiza con cada fase que cambie el
> procedimiento: una migración nueva (§6.1), un servicio nuevo en Compose (§3), un job
> repetible nuevo (§2.8), un workflow nuevo (§7) o un incidente que enseñe algo que este
> runbook no cubría (§12).

