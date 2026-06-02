#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# OpenCited Worker Deployment Script
# =============================================================================
# Usage: ./scripts/deploy-worker.sh <command>
#
# Commands:
#   setup    - Install Docker, clone repo (if needed), build image, start services
#   deploy   - Build image and start services (assumes Docker is installed)
#   update   - Pull latest code, rebuild image, restart services
#   restart  - Restart services without rebuilding
#   stop     - Stop all services
#   status   - Show service status and resource usage
#   logs     - Show live logs (follow mode)
#   logs-f   - Show logs from last 100 lines
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.prod.yml"
ENV_FILE="$ROOT_DIR/.env.local"
COMPOSE_PROJECT_NAME="opencited-worker"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# =============================================================================
# Helper functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

install_docker() {
    log_info "Installing Docker..."

    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        local os_id="$ID"
    else
        log_error "Cannot detect OS. Install Docker manually: https://docs.docker.com/engine/install/"
        exit 1
    fi

    case "$os_id" in
        ubuntu|debian)
            log_info "Detected $PRETTY_NAME. Installing Docker via official convenience script..."
            curl -fsSL https://get.docker.com | sudo sh
            ;;
        *)
            log_error "Unsupported OS: $PRETTY_NAME"
            log_info "Install Docker manually: https://docs.docker.com/engine/install/"
            exit 1
            ;;
    esac

    if ! command -v docker &>/dev/null; then
        log_error "Docker installation failed."
        exit 1
    fi

    # Add current user to docker group
    log_info "Adding $(whoami) to the docker group..."
    sudo usermod -aG docker "$(whoami)"

    # Enable and start Docker
    if command -v systemctl &>/dev/null; then
        sudo systemctl enable --now docker 2>/dev/null || true
    fi

    log_success "Docker $(docker --version) installed"
    log_info "Run 'newgrp docker' then re-run: $0 ${1:-setup}"
    exit 0
}

check_docker() {
    if ! command -v docker &>/dev/null || ! command -v docker compose &>/dev/null; then
        log_warn "Docker is not installed."
        read -p "Would you like to install Docker now? (y/N) " -n 1 -r
        echo ""

        if [[ $REPLY =~ ^[Yy]$ ]]; then
            install_docker
        else
            log_error "Docker is required. Install manually: https://docs.docker.com/engine/install/"
            exit 1
        fi
    fi

    # Check if user can actually run docker (docker group permissions)
    if ! docker info &>/dev/null; then
        log_warn "Docker is installed but you don't have permission to use it."
        log_info "You need to be added to the 'docker' group."
        read -p "Would you like to fix this now? (y/N) " -n 1 -r
        echo ""

        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "Adding $(whoami) to the docker group..."
            sudo usermod -aG docker "$(whoami)"
            sudo systemctl restart docker

            log_info "Docker group updated. Run the following to apply immediately:"
            echo ""
            echo "  newgrp docker"
            echo ""
            log_info "Then re-run: $0 ${1:-setup}"
            exit 0
        else
            log_error "Docker permission required. Run: sudo usermod -aG docker \$USER"
            exit 1
        fi
    fi

    log_success "Docker $(docker --version) found"
}

check_docker_dns() {
    log_info "Checking Docker DNS resolution..."

    # Test DNS inside a container
    if docker run --rm alpine:latest nslookup deb.debian.org &>/dev/null; then
        log_success "Docker DNS resolution OK"
        return 0
    fi

    log_warn "Docker containers cannot resolve DNS. This is common on cloud VMs."
    log_info "Fixing by configuring Docker daemon to use public DNS servers..."

    local docker_dns_config="/etc/docker/daemon.json"

    # Create or update daemon.json
    if [[ -f "$docker_dns_config" ]]; then
        sudo cp "$docker_dns_config" "${docker_dns_config}.bak"
    fi

    sudo tee "$docker_dns_config" >/dev/null <<'EOF'
{
  "dns": ["8.8.8.8", "8.8.4.4", "1.1.1.1"]
}
EOF

    sudo systemctl restart docker

    # Wait for Docker to be ready
    sleep 2

    if docker run --rm alpine:latest nslookup deb.debian.org &>/dev/null; then
        log_success "Docker DNS resolution fixed"
    else
        log_error "DNS fix failed. Check your VM's network configuration."
        log_info "Manual fix: Add DNS servers to $docker_dns_config and restart Docker"
        exit 1
    fi
}

check_bun() {
    if command -v bun &>/dev/null; then
        log_success "Bun $(bun --version) found"
        return 0
    fi

    log_warn "Bun is not installed. Installing..."

    # Install unzip (required by bun installer)
    if ! command -v unzip &>/dev/null; then
        log_info "Installing unzip (required for bun)..."
        if [[ -f /etc/os-release ]]; then
            . /etc/os-release
            local os_id="$ID"
            case "$os_id" in
                ubuntu|debian)
                    sudo apt-get update -qq && sudo apt-get install -y -qq unzip >/dev/null 2>&1
                    ;;
                *)
                    log_error "Cannot auto-install unzip on $PRETTY_NAME. Install it manually and retry."
                    exit 1
                    ;;
            esac
        else
            log_error "Cannot detect OS. Install unzip manually and retry."
            exit 1
        fi
        log_success "unzip installed"
    fi

    if command -v curl &>/dev/null; then
        curl -fsSL https://bun.sh/install | bash
    elif command -v wget &>/dev/null; then
        wget -qO- https://bun.sh/install | bash
    else
        log_error "Neither curl nor wget is available. Install bun manually: https://bun.sh"
        exit 1
    fi

    # Add bun to PATH for current session
    export PATH="$HOME/.bun/bin:$PATH"

    if command -v bun &>/dev/null; then
        log_success "Bun $(bun --version) installed"
    else
        log_error "Bun installation failed. Please install manually: https://bun.sh"
        exit 1
    fi
}

check_env() {
    if [[ ! -f "$ENV_FILE" ]]; then
        log_error ".env.local not found at $ENV_FILE"
        log_info "Create .env.local with required variables:"
        echo ""
        echo "  Required:"
        echo "    DATABASE_URL=postgresql://..."
        echo "    LLM_MODEL=gpt-4o-mini"
        echo "    LLM_PROVIDER=openai"
        echo "    OPENAI_API_KEY=sk-..."
        echo ""
        exit 1
    fi

    # Validate required variables
    local missing=()

    if ! grep -q "^DATABASE_URL=" "$ENV_FILE" 2>/dev/null; then
        missing+=("DATABASE_URL")
    fi

    if ! grep -q "^LLM_MODEL=" "$ENV_FILE" 2>/dev/null; then
        missing+=("LLM_MODEL")
    fi

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "Missing required variables in .env.local: ${missing[*]}"
        exit 1
    fi

    log_success ".env.local validated"
}

check_compose_file() {
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        log_error "docker-compose.prod.yml not found at $COMPOSE_FILE"
        exit 1
    fi
}

compose() {
    docker compose --project-name "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" "$@"
}

# =============================================================================
# Commands
# =============================================================================

cmd_setup() {
    log_info "Setting up OpenCited Worker..."
    echo ""

    check_docker
    check_docker_dns
    check_bun
    check_compose_file
    check_env

    log_info "Building Docker image..."
    compose build --pull

    log_info "Starting services..."
    compose up -d

    echo ""
    log_success "Worker setup complete!"
    echo ""
    log_info "Services:"
    echo "  - Worker:  http://localhost:3001"
    echo "  - Redis:   localhost:6379"
    echo ""
    log_info "Useful commands:"
    echo "  ./scripts/deploy-worker.sh status   - Check service status"
    echo "  ./scripts/deploy-worker.sh logs     - View live logs"
    echo "  ./scripts/deploy-worker.sh update   - Update to latest code"
}

cmd_deploy() {
    log_info "Deploying OpenCited Worker..."
    echo ""

    check_docker
    check_docker_dns
    check_bun
    check_compose_file
    check_env

    log_info "Building Docker image..."
    compose build

    log_info "Starting services..."
    compose up -d

    echo ""
    log_success "Deployment complete!"
    echo ""
    log_info "Worker dashboard: http://localhost:3001/admin/queues"
    log_info "Health check:     http://localhost:3001/health"
}

cmd_update() {
    log_info "Updating OpenCited Worker..."
    echo ""

    check_docker
    check_docker_dns
    check_bun
    check_compose_file
    check_env

    log_info "Pulling latest code..."
    if command -v git &>/dev/null && git rev-parse --is-inside-work-tree &>/dev/null; then
        git pull
        log_success "Code updated"
    else
        log_warn "Not a git repository, skipping code pull"
    fi

    log_info "Rebuilding Docker image..."
    compose build --pull

    log_info "Restarting services..."
    compose up -d

    echo ""
    log_success "Update complete!"
}

cmd_restart() {
    log_info "Restarting OpenCited Worker..."
    echo ""

    check_docker
    check_compose_file

    compose restart

    log_success "Services restarted"
}

cmd_stop() {
    log_info "Stopping OpenCited Worker..."
    echo ""

    check_docker
    check_compose_file

    compose down

    log_success "Services stopped"
}

cmd_status() {
    check_docker
    check_compose_file

    echo ""
    log_info "Service Status:"
    echo ""
    compose ps
    echo ""

    log_info "Resource Usage:"
    echo ""
    compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
    echo ""

    # Show Docker stats (snapshot, not streaming)
    log_info "Container Stats (CPU/MEM):"
    echo ""
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" \
        $(docker ps --filter "name=$COMPOSE_PROJECT_NAME" -q) 2>/dev/null || log_warn "No running containers"
    echo ""

    # Health check
    if curl -sf http://localhost:3001/health &>/dev/null; then
        log_success "Worker health check: OK"
    else
        log_warn "Worker health check: FAILED (service may still be starting)"
    fi
}

cmd_logs() {
    check_docker
    check_compose_file

    log_info "Showing live logs (Ctrl+C to exit)..."
    echo ""
    compose logs -f
}

cmd_logs_follow() {
    check_docker
    check_compose_file

    log_info "Showing last 100 lines of logs..."
    echo ""
    compose logs --tail=100
}

# =============================================================================
# Main
# =============================================================================

usage() {
    echo "OpenCited Worker Deployment Script"
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  setup    Install dependencies, build image, start services"
    echo "  deploy   Build image and start services"
    echo "  update   Pull latest code, rebuild, restart"
    echo "  restart  Restart services without rebuilding"
    echo "  stop     Stop all services"
    echo "  status   Show service status and resource usage"
    echo "  logs     Show live logs (follow mode)"
    echo "  logs-f   Show last 100 lines of logs"
    echo ""
}

case "${1:-}" in
    setup)
        cmd_setup
        ;;
    deploy)
        cmd_deploy
        ;;
    update)
        cmd_update
        ;;
    restart)
        cmd_restart
        ;;
    stop)
        cmd_stop
        ;;
    status)
        cmd_status
        ;;
    logs)
        cmd_logs
        ;;
    logs-f)
        cmd_logs_follow
        ;;
    *)
        usage
        exit 1
        ;;
esac
