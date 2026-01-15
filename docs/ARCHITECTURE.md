# Arquitectura Escalable EIP-712 por Tipo de Credencial

## Objetivo
Sistema modular donde **cada tipo de credencial** tiene su propio schema EIP-712 optimizado para UX.

---

## Diseño Propuesto

### 1. Registry de Credential Types
```typescript
// packages/common/src/eip712/registry.ts

export interface CredentialTypeMetadata {
  id: string                          // "circuloos-marketplace"
  displayName: string                 // "Circuloos Marketplace"
  description: string                 // "Credencial de acceso..."
  icon: string                        // ""
  version: string                     // "1.0.0"
  schema: EIP712CredentialSchema
}

export interface EIP712CredentialSchema {
  // Schema para EMISIÓN (issuer firma)
  issuance: {
    primaryType: string
    types: Record<string, Array<{ name: string; type: string }>>
    messageBuilder: (vc: any) => any
  }

  // Schema para CLAIM (holder reclama)
  claim: {
    primaryType: string
    types: Record<string, Array<{ name: string; type: string }>>
    messageBuilder: (token: string, holder: string) => any
  }

  // Schema para PRESENTATION (holder presenta)
  presentation: {
    primaryType: string
    types: Record<string, Array<{ name: string; type: string }>>
    messageBuilder: (vc: any, holder: string, verifier?: string) => any
  }
}

// Registry global
const CREDENTIAL_TYPES = new Map<string, CredentialTypeMetadata>()

export function registerCredentialType(metadata: CredentialTypeMetadata) {
  CREDENTIAL_TYPES.set(metadata.id, metadata)
}

export function getCredentialType(id: string): CredentialTypeMetadata | undefined {
  return CREDENTIAL_TYPES.get(id)
}

export function getAllCredentialTypes(): CredentialTypeMetadata[] {
  return Array.from(CREDENTIAL_TYPES.values())
}
```

---

### 2. Schema para Circuloos-Marketplace (Día 1)

```typescript
// packages/common/src/eip712/types/circuloos-marketplace.ts

import { registerCredentialType } from '../registry'

registerCredentialType({
  id: 'circuloos-marketplace',
  displayName: 'Circuloos Marketplace',
  description: 'Credencial de acceso al marketplace de Circuloos',
  icon: '',
  version: '1.0.0',

  schema: {
    // =========================================
    // ISSUANCE - Cuando el issuer emite
    // =========================================
    issuance: {
      primaryType: 'CirculoosMarketplaceCredential',
      types: {
        CirculoosMarketplaceCredential: [
          // Metadata de la credencial
          { name: 'action', type: 'string' },           // "Emitir credencial"
          { name: 'credentialType', type: 'string' },   // "Circuloos Marketplace"
          { name: 'credentialId', type: 'string' },     // "urn:uuid:..."

          // Datos del titular (EXPANDIDOS, NO JSON!)
          { name: 'holderAddress', type: 'address' },   // "0x..."
          { name: 'holderName', type: 'string' },       // "Juan Pérez"
          { name: 'holderEmail', type: 'string' },      // "juan@email.com"
          { name: 'companyName', type: 'string' },      // "Circuloos SL"

          // Datos del emisor
          { name: 'issuerDID', type: 'string' },        // "did:alastria:..."
          { name: 'issuerName', type: 'string' },       // "Circuloos"

          // Validez
          { name: 'issuedAt', type: 'string' },         // "30 de enero de 2025"
          { name: 'expiresAt', type: 'string' },        // "30 de enero de 2026"
        ],
      },

      messageBuilder: (vc: any) => ({
        action: 'Emitir credencial de acceso',
        credentialType: 'Circuloos Marketplace',
        credentialId: vc.id,

        // Expandir credentialSubject
        holderAddress: vc.credentialSubject.holderAddress,
        holderName: vc.credentialSubject.name || '',
        holderEmail: vc.credentialSubject.email || '',
        companyName: vc.credentialSubject.companyName || '',

        issuerDID: typeof vc.issuer === 'string' ? vc.issuer : vc.issuer?.id,
        issuerName: 'Circuloos',

        issuedAt: formatDate(vc.validFrom || vc.issuanceDate),
        expiresAt: formatDate(vc.validUntil || vc.expirationDate),
      })
    },

    // =========================================
    // CLAIM - Cuando el holder reclama
    // =========================================
    claim: {
      primaryType: 'CirculoosMarketplaceClaim',
      types: {
        CirculoosMarketplaceClaim: [
          { name: 'action', type: 'string' },           // "Reclamar credencial"
          { name: 'credentialType', type: 'string' },   // "Circuloos Marketplace"
          { name: 'issuerName', type: 'string' },       // "Circuloos SL"
          { name: 'holderAddress', type: 'address' },   // "0x..."
          { name: 'issuedAt', type: 'string' },         // Fecha legible
          { name: 'claimToken', type: 'string' },       // Token (al final)
          { name: 'timestamp', type: 'uint256' },
        ],
      },

      messageBuilder: (credentialPreview: any, holder: string) => ({
        action: 'Reclamar mi credencial de acceso',
        credentialType: 'Circuloos Marketplace',
        issuerName: credentialPreview.issuerName || 'Circuloos',
        holderAddress: holder,
        issuedAt: formatDate(credentialPreview.issuedAt),
        claimToken: credentialPreview.token,
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
      })
    },

    // =========================================
    // PRESENTATION - Cuando el holder presenta
    // =========================================
    presentation: {
      primaryType: 'CirculoosMarketplacePresentation',
      types: {
        CirculoosMarketplacePresentation: [
          { name: 'action', type: 'string' },           // "Presentar credencial"
          { name: 'credentialType', type: 'string' },   // "Circuloos Marketplace"
          { name: 'holderName', type: 'string' },       // "Juan Pérez"
          { name: 'holderAddress', type: 'address' },   // "0x..."
          { name: 'issuerName', type: 'string' },       // "Circuloos"
          { name: 'issuedDate', type: 'string' },       // Fecha legible
          { name: 'verifierAddress', type: 'address' }, // Quien verifica
          { name: 'timestamp', type: 'uint256' },
        ],
      },

      messageBuilder: (vc: any, holder: string, verifier?: string) => ({
        action: 'Presentar mi credencial para verificación',
        credentialType: 'Circuloos Marketplace',
        holderName: vc.credentialSubject.name || 'Usuario',
        holderAddress: holder,
        issuerName: 'Circuloos',
        issuedDate: formatDate(vc.validFrom || vc.issuanceDate),
        verifierAddress: verifier || '0x0000000000000000000000000000000000000000',
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
      })
    }
  }
})

// Helper
function formatDate(isoDate: string): string {
  if (!isoDate) return ''
  return new Date(isoDate).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}
```

---

### 3. Schema Base (Legacy/Genérico)

```typescript
// packages/common/src/eip712/types/generic.ts

// Para credenciales sin tipo específico o backward compatibility
registerCredentialType({
  id: 'generic',
  displayName: 'Credencial Genérica',
  description: 'Credencial verificable estándar',
  icon: '',
  version: '1.0.0',

  schema: {
    issuance: {
      primaryType: 'Credential',
      types: {
        Credential: [
          { name: 'id', type: 'string' },
          { name: 'issuer', type: 'string' },
          { name: 'issuanceDate', type: 'string' },
          { name: 'expirationDate', type: 'string' },
          { name: 'credentialSubject', type: 'string' }, // JSON string (legacy)
        ],
      },
      messageBuilder: (vc: any) => ({
        id: vc.id,
        issuer: typeof vc.issuer === 'string' ? vc.issuer : vc.issuer?.id,
        issuanceDate: vc.validFrom || vc.issuanceDate || '',
        expirationDate: vc.validUntil || vc.expirationDate || '',
        credentialSubject: JSON.stringify(vc.credentialSubject || {}),
      })
    },
    // claim y presentation similares...
  }
})
```

---

### 4. API Helper Functions

```typescript
// packages/common/src/eip712/helpers.ts

export async function signCredentialIssuance(
  privateKey: string,
  domain: EIP712Domain,
  vc: any,
  credentialType: string = 'generic'
): Promise<string> {
  const metadata = getCredentialType(credentialType)
  if (!metadata) {
    throw new Error(`Unknown credential type: ${credentialType}`)
  }

  const { primaryType, types, messageBuilder } = metadata.schema.issuance
  const message = messageBuilder(vc)

  const wallet = new Wallet(privateKey)
  return await wallet._signTypedData(domain, types, message)
}

export async function signCredentialClaim(
  credentialPreview: any,
  holderAddress: string,
  domain: EIP712Domain,
  signTypedDataAsync: any,
  credentialType: string = 'circuloos-marketplace'
): Promise<string> {
  const metadata = getCredentialType(credentialType)
  if (!metadata) {
    throw new Error(`Unknown credential type: ${credentialType}`)
  }

  const { primaryType, types, messageBuilder } = metadata.schema.claim
  const message = messageBuilder(credentialPreview, holderAddress)

  return await signTypedDataAsync({
    domain,
    types,
    primaryType,
    message
  })
}

// Similar para presentation...
```

---

### 5. Frontend Usage (Ejemplo)

```typescript
// frontend/app/issuer/page.tsx

import { getCredentialType, signCredentialIssuance } from '@circuloos/common'

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()

  // 1. Get schema for this credential type
  const schema = getCredentialType('circuloos-marketplace')!

  // 2. Build message using schema's builder
  const { primaryType, types, messageBuilder } = schema.schema.issuance
  const message = messageBuilder(draftVc)

  // 3. Sign with beautiful UX
  const signature = await signTypedDataAsync({
    domain,
    types,
    primaryType,
    message
  })

  // Usuario ve en MetaMask:
  // CirculoosMarketplaceCredential
  //   Acción: Emitir credencial de acceso
  //   Tipo: Circuloos Marketplace
  //   Nombre: Juan Pérez
  //   Email: juan@email.com
  //   Empresa: Circuloos SL
  //   ...
}
```

---

## Migration Path

### Step 1: Mantener backward compatibility
```typescript
// Si no hay credentialType, usar 'generic'
const credentialType = vc.type?.includes('CirculoosMarketplace')
  ? 'circuloos-marketplace'
  : 'generic'
```

### Step 2: Nuevas credenciales usan schemas nuevos
```typescript
// Al emitir nueva credencial
vc.type = ['VerifiableCredential', 'CirculoosMarketplaceCredential']
vc.credentialSubject.credentialType = 'circuloos-marketplace'
```

### Step 3: Gradual deprecation
```typescript
if (credentialType === 'generic') {
  console.warn('Using legacy generic schema. Consider migrating to typed schema.')
}
```

---

## UX Preview

### MetaMask mostraría (Issuance):
```
Circuloos Marketplace

Emitir credencial de acceso

Datos del titular:
  Juan Pérez
  juan@circuloos.io
  Circuloos SL
  0x1234...5678

Emitida por:
  Circuloos
  did:alastria:quorum:redt:...

Validez:
  Desde: 30 de enero de 2025
  Hasta: 30 de enero de 2026

ID: urn:uuid:abc-123-def
```

### MetaMask mostraría (Claim):
```
Reclamar credencial

Circuloos Marketplace
  Emitida por: Circuloos SL
  Para: 0x1234...5678
  Fecha: 30 de enero de 2025

Token: eyJhbGciOiJIUzI1NiIs...
Timestamp: 1706608800
```

---

## Estructura de Archivos Final

```
packages/common/src/eip712/
├── index.ts                           # Exports
├── domain.ts                          # buildEip712Domain()
├── registry.ts                        # Registry + interfaces
├── helpers.ts                         # signCredentialIssuance(), etc
├── utils.ts                           # formatDate(), etc
└── types/
    ├── index.ts                       # Registra todos los tipos
    ├── generic.ts                     # Legacy/fallback
    ├── circuloos-marketplace.ts       # Día 1
    ├── employee-badge.ts              # Futuro
    └── medical-record.ts              # Futuro
```

---

## Benefits

1. Single source of truth - todo en `common`
2. Escalable - añadir tipos = crear 1 archivo
3. Type-safe - TypeScript valida schemas
4. UX perfecta - usuario ve campos legibles
5. Backward compatible - schema 'generic' para legacy
6. Versionable - schemas pueden evolucionar
7. Testable - cada schema se testea independientemente

---

## Next Steps

1. Implementar `registry.ts` + interfaces
2. Migrar `circuloos-marketplace.ts`
3. Actualizar frontend para usar helpers
4. Tests de schemas
5. Deprecation warnings para 'generic'
