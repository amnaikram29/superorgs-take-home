#!/usr/bin/env bash
# setup.sh — one-shot dev setup for Mac and Linux
# Run once after cloning: bash setup.sh
set -euo pipefail

# ── colours ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[setup]${NC} $*"; }
ok()      { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[warn]${NC}  $*"; }
error()   { echo -e "${RED}[error]${NC} $*"; exit 1; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

echo ""
echo "========================================"
echo "  S&P 500 Analytics — Dev Setup"
echo "========================================"
echo ""

# ── 1. Docker ────────────────────────────────────────────────────────────────
info "Checking Docker..."
if command -v docker &>/dev/null; then
    DOCKER_VERSION=$(docker --version 2>&1)
    ok "Docker found: $DOCKER_VERSION"
else
    warn "Docker not found. Attempting to install..."
    OS="$(uname -s)"
    if [[ "$OS" == "Linux" ]]; then
        if command -v apt-get &>/dev/null; then
            info "Installing Docker via apt..."
            sudo apt-get update -qq
            sudo apt-get install -y ca-certificates curl gnupg lsb-release
            sudo mkdir -p /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
                | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
            sudo apt-get update -qq
            sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
            sudo systemctl enable --now docker
            sudo usermod -aG docker "$USER"
            ok "Docker installed. You may need to log out and back in for group changes to take effect."
        elif command -v yum &>/dev/null; then
            info "Installing Docker via yum..."
            sudo yum install -y yum-utils
            sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
            sudo systemctl enable --now docker
            sudo usermod -aG docker "$USER"
            ok "Docker installed."
        else
            error "Cannot auto-install Docker on this Linux distribution.\nPlease install Docker manually: https://docs.docker.com/engine/install/\nThen re-run this script."
        fi
    elif [[ "$OS" == "Darwin" ]]; then
        if command -v brew &>/dev/null; then
            info "Installing Docker Desktop via Homebrew..."
            brew install --cask docker
            ok "Docker Desktop installed. Please open Docker from Applications and start it, then re-run this script."
            exit 0
        else
            error "Docker not found.\nInstall Docker Desktop from https://www.docker.com/products/docker-desktop/\nor install Homebrew first: https://brew.sh\nThen re-run this script."
        fi
    else
        error "Unsupported OS: $OS. Please install Docker manually: https://docs.docker.com/engine/install/"
    fi
fi

# ── 2. Docker Compose ────────────────────────────────────────────────────────
info "Checking Docker Compose..."
if docker compose version &>/dev/null 2>&1; then
    ok "Docker Compose (plugin) found: $(docker compose version --short 2>/dev/null || echo 'ok')"
elif command -v docker-compose &>/dev/null; then
    ok "docker-compose (standalone) found: $(docker-compose --version)"
else
    error "Docker Compose not found.\nIf you installed Docker Desktop it should be included.\nOtherwise: https://docs.docker.com/compose/install/"
fi

# ── 3. Docker daemon running? ─────────────────────────────────────────────────
info "Checking Docker daemon..."
if ! docker info &>/dev/null; then
    error "Docker daemon is not running.\nOn Linux: sudo systemctl start docker\nOn Mac:   open Docker Desktop and wait for it to start."
fi
ok "Docker daemon is running."

# ── 4. Data file ─────────────────────────────────────────────────────────────
info "Checking data file..."
CSV_PATH="$REPO_ROOT/data/all_stocks_5yr.csv"
if [[ -f "$CSV_PATH" ]]; then
    ok "Found data/all_stocks_5yr.csv"
else
    warn "data/all_stocks_5yr.csv not found — the database will be empty on first start."
    warn "Make sure you cloned the full repository (the CSV is tracked in git)."
    mkdir -p "$REPO_ROOT/data"
fi

# ── 5. .env file ─────────────────────────────────────────────────────────────
info "Checking .env..."
if [[ -f "$REPO_ROOT/.env" ]]; then
    ok ".env already exists — skipping."
else
    cp "$REPO_ROOT/.env.example" "$REPO_ROOT/.env"
    info ".env created from .env.example."

    echo ""
    echo "  ┌─────────────────────────────────────────────────────┐"
    echo "  │  API key required                                   │"
    echo "  │                                                     │"
    echo "  │  Get your Anthropic key: https://console.anthropic.com │"
    echo "  │  Or set LLM_PROVIDER=openai and add OPENAI_API_KEY  │"
    echo "  └─────────────────────────────────────────────────────┘"
    echo ""
    read -rp "  Paste your ANTHROPIC_API_KEY (or press Enter to edit .env manually): " API_KEY
    if [[ -n "$API_KEY" ]]; then
        if [[ "$(uname)" == "Darwin" ]]; then
            sed -i '' "s|ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$API_KEY|" "$REPO_ROOT/.env"
        else
            sed -i "s|ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$API_KEY|" "$REPO_ROOT/.env"
        fi
        ok "API key saved to .env"
    else
        warn "No key entered. Edit .env manually before starting."
    fi
fi

# ── 6. Build and start ───────────────────────────────────────────────────────
echo ""
info "Building and starting backend..."
echo ""
docker compose up --build -d

echo ""
ok "=============================="
ok "  Backend is starting up!"
ok "=============================="
echo ""
echo "  Backend API:  http://localhost:5000"
echo "  Health check: http://localhost:5000/health"
echo ""
echo "  Useful commands:"
echo "    docker compose logs -f backend   # stream logs"
echo "    docker compose down              # stop everything"
echo "    docker compose up -d             # start again (no rebuild)"
echo ""
echo "  To start the frontend (once built):"
echo "    docker compose --profile frontend up -d"
echo ""
