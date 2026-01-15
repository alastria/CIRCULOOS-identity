#!/bin/bash
# =============================================================================
# Circuloos Clean Start Script
# =============================================================================
# Este script limpia completamente el entorno Docker y reinicia desde cero.
#
# Uso:
#   ./scripts/docker/clean-start.sh           # Clean + rebuild + init
#   ./scripts/docker/clean-start.sh --test    # Con Mailpit para testing
#   ./scripts/docker/clean-start.sh --no-init # Solo clean, sin levantar
#   ./scripts/docker/clean-start.sh --volumes # También borrar volúmenes Docker
#
# =============================================================================

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
WITH_TEST=""
NO_INIT=""
WITH_VOLUMES=""

for arg in "$@"; do
    case $arg in
        --test)
            WITH_TEST="--test"
            ;;
        --no-init)
            NO_INIT="true"
            ;;
        --volumes|-v)
            WITH_VOLUMES="true"
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --test      Include Mailpit for email testing"
            echo "  --no-init   Only clean, don't rebuild and start"
            echo "  --volumes   Also remove Docker volumes (complete reset)"
            echo "  --help      Show this help message"
            exit 0
            ;;
    esac
done

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}           Circuloos Clean Start                            ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

echo -e "${YELLOW}Working directory: $PROJECT_ROOT${NC}"
echo ""

# Step 1: Stop all containers
echo -e "${YELLOW}Step 1: Stopping Docker containers...${NC}"
docker compose down --remove-orphans 2>/dev/null || true
echo -e "${GREEN}   Containers stopped${NC}"

# Step 2: Remove Docker volumes (optional)
if [ "$WITH_VOLUMES" = "true" ]; then
    echo -e "${YELLOW}Step 2: Removing Docker volumes...${NC}"
    docker compose down -v 2>/dev/null || true
    echo -e "${GREEN}   Volumes removed${NC}"
else
    echo -e "${YELLOW}Step 2: Skipping volume removal (use --volumes to include)${NC}"
fi

# Step 3: Clean local data directories
echo -e "${YELLOW}Step 3: Cleaning local data directories...${NC}"

# Helper function to clean directory (handles Docker root-owned files)
clean_dir() {
    local dir="$1"
    if [ -d "$dir" ] && [ "$(ls -A "$dir" 2>/dev/null)" ]; then
        # Try normal rm first, if fails try with sudo
        if ! rm -rf "$dir"/* 2>/dev/null; then
            echo -e "${YELLOW}   Need elevated permissions for $dir${NC}"
            sudo rm -rf "$dir"/*
        fi
        echo -e "${GREEN}   Cleaned $dir${NC}"
    fi
}

# Clean all data directories
clean_dir "data/issuer/data"
clean_dir "data/verifier/data"
clean_dir "data/issuer/tmp-filestore"
clean_dir "data/verifier/tmp-filestore"

# Checkpoint files
rm -f .checkpoint.*.json 2>/dev/null || true
echo -e "${GREEN}   Cleaned checkpoint files${NC}"

# Step 4: Clean generated .env files (they will be regenerated)
echo -e "${YELLOW}Step 4: Cleaning generated .env files...${NC}"
rm -f backend/issuer/.env 2>/dev/null || true
rm -f backend/verifier/.env 2>/dev/null || true
rm -f frontend/.env 2>/dev/null || true
rm -f smart-contracts/.env 2>/dev/null || true
echo -e "${GREEN}   Cleaned generated .env files${NC}"

# Step 5: Prune Docker build cache (optional, can be slow)
# Comment out if this takes too long
# echo -e "${YELLOW}Step 5: Pruning Docker build cache...${NC}"
# docker builder prune -f 2>/dev/null || true
# echo -e "${GREEN}   Build cache pruned${NC}"
echo -e "${YELLOW}Step 5: Skipping build cache prune (uncomment in script if needed)${NC}"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   Clean completed successfully!                            ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Step 6: Rebuild and start (unless --no-init)
if [ "$NO_INIT" != "true" ]; then
    echo -e "${BLUE}Step 6: Starting fresh environment...${NC}"
    echo ""
    
    if [ -n "$WITH_TEST" ]; then
        echo -e "${YELLOW}   Including Mailpit for email testing${NC}"
        pnpm dev:docker:init:test
    else
        pnpm dev:docker:init
    fi
else
    echo -e "${YELLOW}Step 6: Skipping rebuild (--no-init specified)${NC}"
    echo ""
    echo -e "${BLUE}To start the environment, run:${NC}"
    echo "  pnpm dev:docker:init"
    echo ""
    echo -e "${BLUE}Or with email testing:${NC}"
    echo "  pnpm dev:docker:init:test"
fi
