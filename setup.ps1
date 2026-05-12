# setup.ps1 — one-shot dev setup for Windows (PowerShell 5.1+)
# Run once after cloning: .\setup.ps1
# If blocked by execution policy: powershell -ExecutionPolicy Bypass -File setup.ps1

param(
    [string]$AnthropicApiKey = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Info  { param($msg) Write-Host "[setup] $msg" -ForegroundColor Cyan }
function Write-Ok    { param($msg) Write-Host "[ok]    $msg" -ForegroundColor Green }
function Write-Warn  { param($msg) Write-Host "[warn]  $msg" -ForegroundColor Yellow }
function Write-Fail  { param($msg) Write-Host "[error] $msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  S&P 500 Analytics - Dev Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Docker ─────────────────────────────────────────────────────────────────
Write-Info "Checking Docker..."
$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if ($dockerCmd) {
    $dockerVer = docker --version 2>&1
    Write-Ok "Docker found: $dockerVer"
} else {
    Write-Warn "Docker not found."
    Write-Host ""
    Write-Host "  Please install Docker Desktop for Windows:" -ForegroundColor Yellow
    Write-Host "  https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Requirements:" -ForegroundColor Yellow
    Write-Host "    - Windows 10/11 64-bit with WSL2 enabled" -ForegroundColor Yellow
    Write-Host "    - Virtualisation enabled in BIOS" -ForegroundColor Yellow
    Write-Host ""

    # Try winget auto-install
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
        $response = Read-Host "  Attempt to install Docker Desktop via winget? [y/N]"
        if ($response -match '^[Yy]') {
            Write-Info "Installing Docker Desktop via winget..."
            winget install Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
            Write-Ok "Docker Desktop installed."
            Write-Warn "Please open Docker Desktop, complete the setup wizard, then re-run this script."
            exit 0
        }
    }
    Write-Fail "Please install Docker Desktop manually and re-run this script."
}

# ── 2. Docker Compose ─────────────────────────────────────────────────────────
Write-Info "Checking Docker Compose..."
$composeOk = $false
try {
    $null = docker compose version 2>&1
    Write-Ok "Docker Compose plugin found."
    $composeOk = $true
} catch {}

if (-not $composeOk) {
    $dcCmd = Get-Command docker-compose -ErrorAction SilentlyContinue
    if ($dcCmd) {
        Write-Ok "docker-compose (standalone) found."
        $composeOk = $true
    }
}

if (-not $composeOk) {
    Write-Fail "Docker Compose not found. It is included with Docker Desktop - please reinstall Docker Desktop."
}

# ── 3. Docker daemon running? ─────────────────────────────────────────────────
Write-Info "Checking Docker daemon..."
try {
    $null = docker info 2>&1
    Write-Ok "Docker daemon is running."
} catch {
    Write-Host ""
    Write-Warn "Docker daemon is not running."
    Write-Host "  Open Docker Desktop from the Start menu and wait for it to fully start," -ForegroundColor Yellow
    Write-Host "  then re-run this script." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# ── 4. Data file ──────────────────────────────────────────────────────────────
Write-Info "Checking data file..."
$csvPath = Join-Path $RepoRoot "data\all_stocks_5yr.csv"
if (Test-Path $csvPath) {
    Write-Ok "Found data\all_stocks_5yr.csv"
} else {
    Write-Warn "data\all_stocks_5yr.csv not found - the database will be empty on first start."
    Write-Host "  Make sure you cloned the full repository (the CSV is tracked in git)." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path (Join-Path $RepoRoot "data") | Out-Null
}

# ── 5. .env file ──────────────────────────────────────────────────────────────
Write-Info "Checking .env..."
$envFile     = Join-Path $RepoRoot ".env"
$envExample  = Join-Path $RepoRoot ".env.example"

if (Test-Path $envFile) {
    Write-Ok ".env already exists - skipping."
} else {
    Copy-Item $envExample $envFile
    Write-Info ".env created from .env.example."

    Write-Host ""
    Write-Host "  +---------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host "  |  API key required                                       |" -ForegroundColor Cyan
    Write-Host "  |  Get your key: https://console.anthropic.com            |" -ForegroundColor Cyan
    Write-Host "  |  Or set LLM_PROVIDER=openai and add OPENAI_API_KEY      |" -ForegroundColor Cyan
    Write-Host "  +---------------------------------------------------------+" -ForegroundColor Cyan
    Write-Host ""

    if ($AnthropicApiKey -eq "") {
        $AnthropicApiKey = Read-Host "  Paste your ANTHROPIC_API_KEY (or press Enter to edit .env manually)"
    }

    if ($AnthropicApiKey -ne "") {
        $envContent = Get-Content $envFile -Raw
        $envContent = $envContent -replace 'ANTHROPIC_API_KEY=.*', "ANTHROPIC_API_KEY=$AnthropicApiKey"
        Set-Content -Path $envFile -Value $envContent -Encoding utf8
        Write-Ok "API key saved to .env"
    } else {
        Write-Warn "No key entered. Edit .env manually before starting."
    }
}

# ── 6. Build and start ────────────────────────────────────────────────────────
Write-Host ""
Write-Info "Building and starting backend + frontend (this may take a few minutes on first run)..."
Write-Host ""

Set-Location $RepoRoot
docker compose up --build -d

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  S&P 500 Analytics is starting up!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend:     http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Backend API:  http://localhost:5000" -ForegroundColor Cyan
Write-Host "  Health check: http://localhost:5000/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Note: The first start seeds the database (~619k rows)." -ForegroundColor Yellow
Write-Host "        The frontend will be ready in ~30-60 seconds." -ForegroundColor Yellow
Write-Host ""
Write-Host "  Useful commands:" -ForegroundColor White
Write-Host "    docker compose logs -f             # stream all logs"
Write-Host "    docker compose logs -f frontend    # frontend logs only"
Write-Host "    docker compose logs -f backend     # backend logs only"
Write-Host "    docker compose down                # stop everything"
Write-Host "    docker compose up -d               # start again (no rebuild)"
Write-Host "    docker compose up --build -d       # rebuild and start"
Write-Host ""
