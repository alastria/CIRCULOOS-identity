# Alastria VC/VP Frontend

Frontend para la gestión de Credenciales Verificables (VC) y Presentaciones Verificables (VP) en la red Alastria.

## Arquitectura

\`\`\`
src/
├── shared/
│   ├── config/          # Configuración (env, wagmi, constants)
│   ├── api/             # API Client wrapper
│   ├── stores/          # Zustand stores (auth, ui)
│   ├── hooks/           # Hooks compartidos
│   └── providers/       # Root providers (Wagmi, RainbowKit, TanStack Query)
│
├── features/
│   ├── credentials/     # Módulo de credenciales
│   │   ├── types/       # Interfaces TypeScript
│   │   ├── services/    # Llamadas a API
│   │   └── hooks/       # React Query hooks
│   │
│   └── issuers/         # Módulo de emisores
│       ├── types/
│       ├── services/
│       └── hooks/
│
app/                     # Next.js App Router
├── (public)/            # Rutas públicas
│   ├── verify/          # Portal de verificación
│   └── claim/           # Reclamación de credenciales
│
├── issuer/              # Portal de emisores (protegido)
├── admin/               # Panel de administración (protegido)
└── vc/                  # Información de credenciales
    └── info/
\`\`\`

## Configuración

### 1. Variables de Entorno

Copia el archivo de entorno correspondiente:

\`\`\`bash
# Desarrollo local con Hardhat
cp .env.local .env

# Docker Compose
cp .env.docker .env
\`\`\`

### 2. WalletConnect Project ID

Obtén un Project ID gratuito en [Reown Cloud](https://cloud.reown.com/) y añádelo a tu `.env`:

\`\`\`env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=tu_project_id
\`\`\`

### 3. Instalación

\`\`\`bash
# Instalar dependencias
npm install

# Desarrollo
npm run dev

# Build producción
npm run build
npm start
\`\`\`

## Integración con Backend

El frontend se conecta a tu API backend a través de `NEXT_PUBLIC_API_URL`. 

### Endpoints Esperados

\`\`\`
POST /api/v1/auth/nonce          # Obtener nonce para SIWE
POST /api/v1/auth/login          # Login con firma
POST /api/v1/auth/logout         # Logout

GET  /api/v1/credentials         # Listar credenciales
POST /api/v1/credentials/issue   # Emitir credencial
POST /api/v1/credentials/verify  # Verificar credencial
POST /api/v1/credentials/revoke  # Revocar credencial

GET  /api/v1/issuers             # Listar emisores
POST /api/v1/issuers/register    # Registrar emisor
\`\`\`

### Flujo de Autenticación (SIWE)

1. Frontend solicita nonce: `GET /auth/nonce?address=0x...`
2. Usuario firma mensaje con MetaMask
3. Frontend envía firma: `POST /auth/login { address, message, signature }`
4. Backend valida y devuelve JWT token
5. Frontend incluye token en headers: `Authorization: Bearer <token>`

## Redes Soportadas

- **Alastria Red-T** (Testnet) - Chain ID: 2020
- **Alastria Red-B** (Mainnet) - Chain ID: 2021  
- **Hardhat Local** - Chain ID: 31337

## Scripts

\`\`\`bash
npm run dev          # Desarrollo
npm run build        # Build producción
npm run start        # Iniciar producción
npm run lint         # Linter
npm run type-check   # Verificar tipos
\`\`\`

## Licencia

MIT - Consorcio Alastria 2026
