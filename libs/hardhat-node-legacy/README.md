# Hardhat Node - Smart Contracts

Este paquete contiene los smart contracts del proyecto, implementados usando el patrón **EIP-2535 Diamond**.

## Arquitectura

- **Storage**: Definiciones de datos (`contracts/storage/`)
- **Libraries**: Operaciones internas (`contracts/libraries/`)
- **Facets**: Lógica de negocio y eventos (`contracts/facets/`)

## Instalación

```bash
pnpm install
```

## Configuración

### Features de Entorno

El proyecto soporta 3 entornos diferentes:

#### 1. **Local** (Desarrollo local)
```bash
LOCAL_RPC_URL=http://127.0.0.1:8545
LOCAL_CHAIN_ID=31337
LOCAL_DEPLOYER_PRIVATE_KEY=0x...  # Clave privada del deployer (owner del Diamond)
```

#### 2. **Test** (Docker/CI)
```bash
TEST_RPC_URL=http://hardhat:9545
TEST_CHAIN_ID=31337
TEST_DEPLOYER_PRIVATE_KEY=0x...  # Clave privada del deployer (owner del Diamond)
```

#### 3. **Dev** (Producción/Desarrollo)
```bash
DEV_RPC_URL=https://rpc.example.com
DEV_CHAIN_ID=1
DEV_DEPLOYER_PRIVATE_KEY=0x...  # Clave privada del deployer (owner del Diamond)
# Variables legacy (compatibilidad):
RPC_URL=https://rpc.example.com
CHAIN_ID=1
ISSUER_PRIVATE_KEY=0x...  # Fallback si no existe DEV_DEPLOYER_PRIVATE_KEY
```

**Nota**: Las claves privadas (`*_DEPLOYER_PRIVATE_KEY`) son del **deployer**, que será el owner del Diamond y pagará el gas del despliegue. Se mantiene compatibilidad con variables legacy (`*_PRIVATE_KEY`).

### Archivos .env

- `.env` - Variables para entorno local
- `.env.test` - Variables para entorno de test
- `.env.production` - Variables para entorno de producción

**Nota**: Los scripts de despliegue guardarán automáticamente `DIAMOND_ADDRESS` en el archivo .env correspondiente.

## Scripts Disponibles

### Desarrollo
```bash
pnpm node          # Iniciar Hardhat node local
pnpm compile       # Compilar contratos
pnpm test          # Ejecutar tests
pnpm coverage      # Generar reporte de cobertura
```

### Despliegue

#### Local
```bash
pnpm deploy:local        # Desplegar sin inicialización
pnpm deploy:local:init   # Desplegar con inicialización
```

#### Test (Docker)
```bash
pnpm deploy:test         # Desplegar sin inicialización
pnpm deploy:test:init   # Desplegar con inicialización
```

#### Dev/Producción
```bash
pnpm deploy:dev          # Desplegar sin inicialización
pnpm deploy:dev:init     # Desplegar con inicialización
```

## Usageo

### Desplegar Diamond

El Diamond se despliega automáticamente con todas sus facets:

- `DiamondCutFacet` - Gestión de actualizaciones
- `DiamondLoupeFacet` - Inspección del Diamond
- `OwnershipFacet` - Gestión de propiedad
- `TrustedIssuerFacet` - Gestión de emisores confiables
- `CredentialStatusFacet` - Estado de credenciales
- `ProofFacet` - Almacenamiento de pruebas

### Inicialización

La opción `--init` ejecuta `DiamondInit.init()` después del despliegue, que inicializa el estado del Diamond.

**Primera vez**: Usa `deploy:*:init`  
**Actualizaciones**: Usa `deploy:*` (sin init)

## 🔍 Verificación y Checkpoints

Después del despliegue, la dirección del Diamond se guarda automáticamente en los `.env` de cada servicio según el entorno:

### Archivos .env actualizados automáticamente:
- `packages/hardhat-node/.env` (o `.env.test`, `.env.production`)
- `apps/issuer/.env` (o `.env.test`, `.env.production`)
- `apps/verifier/.env` (o `.env.test`, `.env.production`)

### Sistema de Checkpoints

El despliegue utiliza un sistema de checkpoints para rastrear el estado:

1. **`deployment_pending`**: El despliegue está en progreso, esperando feedback
2. **`ready`**: El despliegue está completo, `DIAMOND_ADDRESS` está rellenado y listo para comunicar

Los checkpoints se guardan en:
- `packages/hardhat-node/.checkpoint.local.json`
- `packages/hardhat-node/.checkpoint.test.json`
- `packages/hardhat-node/.checkpoint.dev.json`

**Estructura del checkpoint:**
```json
{
  "status": "ready",
  "diamondAddress": "0x...",
  "deployedAt": "2024-01-01T00:00:00.000Z",
  "network": "local",
  "chainId": 31337
}
```

## 📊 Cobertura de Tests

El proyecto mantiene **100% de cobertura** en todas las métricas:
- ✅ Statements: 100%
- ✅ Branches: 100%
- ✅ Functions: 100%
- ✅ Lines: 100%

## 🐳 Docker

```bash
pnpm docker:health  # Verificar salud del nodo RPC
```

## 📚 Más Información

- [EIP-2535 Diamond Standard](https://eips.ethereum.org/EIPS/eip-2535)
- [Hardhat Documentation](https://hardhat.org/docs)
