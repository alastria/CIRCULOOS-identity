# Product Design Review (PDR)
## Alastria Verifiable Credentials Frontend

**Version:** 1.0.0  
**Date:** 2024-01-15  
**Status:** Production Ready  
**Authors:** Consorcio Alastria - Comisión Técnica de Identidad  

---

## 1. Executive Summary

### 1.1 Product Vision
Sistema frontend para la emisión, reclamación y verificación de Credenciales Verificables (VCs) y Presentaciones Verificables (VPs) basado en los estándares W3C, integrado con la red blockchain de Alastria y compatible con el ecosistema europeo EBSI.

### 1.2 Key Objectives
- **Descentralización**: Eliminar dependencias de bases de datos centrales
- **Auto-custodia**: El usuario mantiene control total de sus credenciales
- **Interoperabilidad**: Compatibilidad con W3C VC Data Model 2.0 y EBSI
- **Usabilidad Enterprise**: Interfaz profesional para organizaciones del Consorcio

### 1.3 Target Users
| Rol | Descripción | Acceso |
|-----|-------------|--------|
| **Holder** | Usuario final que recibe y presenta credenciales | Público |
| **Issuer** | Organización autorizada para emitir credenciales | Wallet autorizada |
| **Verifier** | Cualquier entidad que verifica credenciales | Público |
| **Admin** | Administrador del sistema Alastria | Wallet admin |

---

## 2. Technical Architecture

### 2.1 Stack Overview
\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js 15)                   │
├─────────────────────────────────────────────────────────────┤
│  App Router │ React 19 │ TypeScript │ Tailwind CSS v4       │
├─────────────────────────────────────────────────────────────┤
│         Wallet: MetaMask + Circuloos Snap                    │
├─────────────────────────────────────────────────────────────┤
│                    Backend APIs (External)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Issuer API  │  │ Verifier API│  │ Blockchain (Diamond)│  │
│  │ :4000       │  │ :5000       │  │ Alastria Red-T/B    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
\`\`\`

### 2.2 Directory Structure
\`\`\`
alastria-vc-frontend/
├── app/                    # Next.js App Router pages
│   ├── admin/              # Admin dashboard (wallet-protected)
│   ├── api/                # API route handlers
│   ├── apply/              # Credential application form
│   ├── claim/              # Claim wizard flow
│   ├── docs/               # Documentation placeholder
│   ├── issuer/             # Issuer portal (wallet-protected)
│   ├── vc/info/            # VC inspector tool
│   └── verify/             # Public verification portal
├── components/             # React components
│   ├── ui/                 # shadcn/ui primitives
│   ├── vc-info/            # VC inspection components
│   └── [feature].tsx       # Feature-specific components
├── docs/                   # Technical documentation
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities and configurations
│   ├── i18n/               # Internationalization (ES/EN)
│   ├── stores/             # Zustand state stores
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Utility functions
├── public/                 # Static assets
└── src/                    # Backend-for-Frontend layer
    ├── features/           # Feature modules
    └── shared/             # Shared utilities
\`\`\`

### 2.3 State Management
| Store | Purpose | Persistence |
|-------|---------|-------------|
| `useAuthStore` | Wallet connection state | Session |
| `useUIStore` | UI preferences (theme, sidebar) | LocalStorage |
| `useClaimStore` | Claim wizard state | Memory |
| `useApplicationStore` | Application form state | Memory |

### 2.4 Authentication Flow
\`\`\`
┌──────────┐     ┌───────────┐     ┌─────────────┐
│  User    │────>│ MetaMask  │────>│ Auth Gate   │
└──────────┘     └───────────┘     └─────────────┘
                      │                   │
                      │ eth_requestAccounts
                      ▼                   │
                ┌───────────┐             │
                │ Wallet    │             │
                │ Address   │<────────────┘
                └───────────┘       Check AUTHORIZED_WALLETS
                      │
                      ▼
                ┌───────────────┐
                │ Access Granted│
                │ or Denied     │
                └───────────────┘
\`\`\`

---

## 3. Feature Modules

### 3.1 Landing Page (`/`)
- Hero section con imagen glassmorphism de credencial
- Workflow diagram con bifurcación (Snap vs PDF)
- Features grid con spotlight cards
- MetaMask Snap integration CTA

### 3.2 Verification Portal (`/verify`)
- Drag-and-drop de archivos PDF/JSON
- Análisis de firma criptográfica
- Verificación on-chain contra Alastria
- Visualización de estado (valid/invalid/revoked)

### 3.3 Claim Wizard (`/claim/[token]`)
**Steps:**
1. **OTP Validation**: Código 6 dígitos por email
2. **Wallet Connection**: Verificación de wallet esperada
3. **Credential Preview**: Vista previa antes de firmar
4. **EIP-712 Signature**: Firma tipada de la credencial
5. **Success**: Descarga JSON/PDF + Save to Snap

### 3.4 Issuer Portal (`/issuer`)
- Formulario de emisión de nuevas credenciales
- Selector de tipo de credencial (extensible)
- Campo empresa obligatorio
- Historial de emisiones con acciones

### 3.5 Admin Dashboard (`/admin`)
- Dashboard minimalista con métricas
- Gestión de emisores autorizados
- Herramienta de revocación de credenciales
- Configuración del sistema

### 3.6 VC Inspector (`/vc/info`)
- 6 métodos de entrada (upload, paste, URL, IPFS, Snap, deep link)
- Análisis completo del documento VC
- Security score con checks detallados
- Timeline de eventos de la credencial
- Visualización de proofs criptográficas

---

## 4. Integration Points

### 4.1 Backend APIs
| Endpoint | Method | Description |
|----------|--------|-------------|
| `ISSUER_API/credentials` | POST | Issue new credential |
| `ISSUER_API/credentials/:id/revoke` | POST | Revoke credential |
| `VERIFIER_API/verify` | POST | Verify credential |
| `VERIFIER_API/status/:hash` | GET | Check revocation status |

### 4.2 Blockchain Integration
| Contract | Address | Purpose |
|----------|---------|---------|
| Diamond Proxy | Configurable | Main entry point (EIP-2535) |
| CredentialRegistry | Facet | VC hash registration |
| IssuerRegistry | Facet | Trusted issuer management |
| RevocationRegistry | Facet | Revocation status |

### 4.3 MetaMask Snap
- **Package**: `@aspect-vc/circuloos-snap`
- **Methods**: 
  - `circuloos_getCredentials`: List stored VCs
  - `circuloos_saveCredential`: Store new VC
  - `circuloos_deleteCredential`: Remove VC
  - `circuloos_signPresentation`: Generate VP

---

## 5. Security Considerations

### 5.1 Access Control
| Resource | Protection |
|----------|------------|
| `/admin/*` | `AUTHORIZED_ADMINS` wallet list |
| `/issuer/*` | `AUTHORIZED_ISSUERS` wallet list |
| `/verify` | Public access |
| `/claim/*` | Token + OTP validation |

### 5.2 Cryptographic Operations
- **Signatures**: EIP-712 typed data signing
- **Hashing**: SHA-256 for credential hashes
- **Verification**: On-chain signature recovery

### 5.3 Data Privacy
- No PII stored in frontend
- Credentials stored client-side only (wallet/PDF)
- OTP codes expire after 5 minutes
- Maximum 3 OTP attempts per session

---

## 6. Deployment

### 6.1 Environment Variables
\`\`\`env
# API Endpoints
NEXT_PUBLIC_ISSUER_API_URL=http://localhost:4000
NEXT_PUBLIC_VERIFIER_API_URL=http://localhost:5000

# Blockchain
NEXT_PUBLIC_CHAIN_ID=83584648538
NEXT_PUBLIC_RPC_URL=https://red-t.alastria.io/v0/9461d9f4292b41230002cc5d
NEXT_PUBLIC_DIAMOND_ADDRESS=0x...

# MetaMask Snap
NEXT_PUBLIC_SNAP_ID=npm:@aspect-vc/circuloos-snap
NEXT_PUBLIC_SNAP_VERSION=^1.0.0
\`\`\`

### 6.2 Docker Compose
\`\`\`yaml
services:
  frontend:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    depends_on:
      - issuer-api
      - verifier-api
\`\`\`

### 6.3 Vercel Deployment
- Connect GitHub repository
- Configure environment variables
- Enable Edge Functions for API routes
- Set up custom domain

---

## 7. Testing Strategy

### 7.1 Unit Tests
- Component rendering tests (Vitest + Testing Library)
- Hook behavior tests
- Utility function tests

### 7.2 Integration Tests
- API route handlers
- Wallet connection flow
- Claim wizard complete flow

### 7.3 E2E Tests
- Playwright for critical paths
- Credential issuance flow
- Verification flow
- Revocation flow

---

## 8. Roadmap

### Phase 1: MVP (Current)
- [x] Landing page with branding
- [x] Verification portal
- [x] Claim wizard
- [x] Issuer portal
- [x] Admin dashboard
- [x] i18n (ES/EN)
- [x] Dark/Light mode

### Phase 2: Enhanced Features
- [ ] Selective disclosure UI
- [ ] Batch issuance
- [ ] Credential templates
- [ ] Advanced analytics
- [ ] Audit log viewer

### Phase 3: Ecosystem Integration
- [ ] EBSI wallet connect
- [ ] DID resolution UI
- [ ] Schema registry browser
- [ ] Multi-network support

---

## 9. Appendices

### A. Glossary
| Term | Definition |
|------|------------|
| **VC** | Verifiable Credential - W3C standard digital credential |
| **VP** | Verifiable Presentation - Signed presentation of VCs |
| **DID** | Decentralized Identifier - Self-sovereign identity |
| **EIP-712** | Ethereum typed structured data signing standard |
| **Snap** | MetaMask extension for additional functionality |

### B. References
- [W3C VC Data Model 2.0](https://www.w3.org/TR/vc-data-model-2.0/)
- [EBSI Documentation](https://ec.europa.eu/digital-building-blocks/wikis/display/EBSI/)
- [Alastria Identity](https://github.com/alastria/alastria-identity)
- [EIP-712 Specification](https://eips.ethereum.org/EIPS/eip-712)
- [MetaMask Snaps](https://docs.metamask.io/snaps/)
