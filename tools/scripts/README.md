# Scripts Directory

This directory contains all utility scripts organized by domain.

## Structure

```
scripts/
├── core/           # Essential system scripts
├── contracts/      # Smart contract management
├── docker/         # Docker-related scripts
├── env/            # Environment configuration
└── utils/          # General utilities
```

## Core Scripts (`core/`)

Essential scripts used by the system:

- **`check-pnpm.js`** - Validates pnpm version (used in preinstall hooks)
- **`dev-runner.mjs`** - Main development environment orchestrator
- **`init-filestore.mjs`** - Initializes filestore directory structure

## Contract Scripts (`contracts/`)

Smart contract management and inspection:

- **`inspect-diamond.mjs`** - Inspect Diamond proxy contract structure
- **`add-dev-issuer.mjs`** - Add issuer to registry (development)
- **`remove-dev-issuer.mjs`** - Remove issuer from registry (development)
- **`verify-contracts.*`** - Verify deployed contracts on block explorers

## Docker Scripts (`docker/`)

Docker-related utilities:

- **`docker-prepare-env.mjs`** - Prepare environment files for Docker
- **`docker-deploy-contracts.mjs`** - Deploy contracts in Docker environment
- **`docker-propagate-public-env.mjs`** - Propagate public env vars to services
- **`dev.sh`** - Development helper script
- **`healthcheck-http.sh`** - HTTP healthcheck for containers
- **`wait-for-it.sh`** - Wait for services to be ready

## Environment Scripts (`env/`)

Environment configuration management:

- **`run-with-env.mjs`** - Run commands with specific environment files

## Utility Scripts (`utils/`)

General purpose utilities:

- **`show-docker-urls.mjs`** - Display service URLs after Docker start
- **`rpc-proxy.js`** - RPC proxy server

## Usage

Most scripts are called automatically through npm/pnpm scripts defined in `package.json`. For manual usage:

```bash
# Core scripts
node scripts/core/dev-runner.mjs --default
node scripts/core/init-filestore.mjs

# Contract scripts
node scripts/contracts/inspect-diamond.mjs <ADDRESS>
node scripts/contracts/add-dev-issuer.mjs <REGISTRY> <ISSUER>

# Docker scripts
node scripts/docker/docker-prepare-env.mjs

# Utils
node scripts/utils/show-docker-urls.mjs
```

## Notes

- Scripts in `core/` are essential and should not be removed
- Scripts in other directories can be added/removed as needed
- All scripts use ES modules (`.mjs` extension or `"type": "module"`)

