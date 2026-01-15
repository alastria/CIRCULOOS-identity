# Component Reference
## Alastria Verifiable Credentials Frontend

---

## 1. Layout Components

### Navbar (`components/navbar.tsx`)
Barra de navegación principal con glassmorphism.

**Props:** None (uses i18n context)

**Features:**
- Logo Alastria con link a home
- Links: Sign Credential, Verify Credential
- Language dropdown (ES/EN)
- Theme toggle (Light/Dark)
- Wallet connect button
- Mobile responsive hamburger menu

**Usage:**
\`\`\`tsx
// app/layout.tsx
<Navbar />
\`\`\`

---

### Footer (`components/footer.tsx`)
Footer minimalista con links.

**Props:** None

**Features:**
- Copyright Consorcio Alastria 2026
- Links: API Issuer, API Verifier, Docs

**Usage:**
\`\`\`tsx
// app/layout.tsx
<Footer />
\`\`\`

---

### FloatingElements (`components/floating-elements.tsx`)
Orbes flotantes con gradientes aurora para fondos.

**Props:** None

**Features:**
- 5 orbes animados con diferentes delays
- Gradientes Alastria (azul/rojo)
- Animación float con CSS keyframes
- Pointer-events: none para no interferir

**Usage:**
\`\`\`tsx
// app/page.tsx
<FloatingElements />
\`\`\`

---

## 2. Authentication Components

### AdminAuthGate (`components/admin-auth-gate.tsx`)
Gate de protección para rutas de admin.

**Props:**
\`\`\`typescript
interface AdminAuthGateProps {
  children: React.ReactNode
}
\`\`\`

**States:**
1. **Loading**: Skeleton mientras verifica wallet
2. **Not Connected**: Botón para conectar MetaMask
3. **Unauthorized**: Mensaje de wallet no autorizada
4. **Authorized**: Renderiza children

**Usage:**
\`\`\`tsx
// app/admin/layout.tsx
<AdminAuthGate>
  <AdminDashboard />
</AdminAuthGate>
\`\`\`

---

### IssuerAuthGate (`components/issuer-auth-gate.tsx`)
Gate de protección para rutas de issuer.

**Props:**
\`\`\`typescript
interface IssuerAuthGateProps {
  children: React.ReactNode
}
\`\`\`

**Behavior:** Idéntico a AdminAuthGate pero verifica `AUTHORIZED_ISSUERS`

---

## 3. Landing Page Components

### AlastriaFeatures (`components/alastria-features.tsx`)
Grid de features con spotlight cards.

**Props:** None (uses i18n)

**Features:**
- 4 cards en grid 2x2
- Spotlight effect que sigue el cursor
- Iconos: ShieldCheck, Fingerprint, Globe2, Wallet
- Animación stagger con Framer Motion

**Subcomponents:**
\`\`\`typescript
interface SpotlightCardProps {
  icon: LucideIcon
  title: string
  description: string
  index: number
}
\`\`\`

---

### CredentialWorkflow (`components/credential-workflow.tsx`)
Diagrama "How does it work?" con bifurcación.

**Props:** None (uses i18n)

**Structure:**
1. Step 1: Secure Invitation
2. Step 2: Cryptographic Binding
3. Step 3: Smart PDF Generation
4. Bifurcation indicator
5. Route A: Instant Import (Snap) - Recommended
6. Route B: Cold Storage (PDF)
7. Step 4: Universal Verification (merge point)

**Subcomponents:**
\`\`\`typescript
interface StepCardProps {
  number?: number
  title: string
  description: string
  icon: LucideIcon
  variant?: 'default' | 'orange' | 'blue' | 'green'
  badge?: string
}
\`\`\`

---

## 4. VC Inspector Components

### VCInputMethods (`components/vc-info/vc-input-methods.tsx`)
6 métodos de entrada para cargar una VC.

**Props:**
\`\`\`typescript
interface VCInputMethodsProps {
  onVCLoaded: (vc: VerifiableCredential) => void
}
\`\`\`

**Methods:**
1. **Upload File**: Drag & drop PDF/JSON
2. **Paste JSON**: Textarea para pegar JSON
3. **Load from URL**: Input para URL remota
4. **Load from IPFS**: Input para CID de IPFS
5. **Import from Snap**: Selector de credenciales del Snap
6. **Deep Link**: VC embebida en base64 vía URL

---

### VCStatusHero (`components/vc-info/vc-status-hero.tsx`)
Hero con estado y acciones de la credencial.

**Props:**
\`\`\`typescript
interface VCStatusHeroProps {
  credential: VerifiableCredential
  status: 'active' | 'expiring' | 'expired' | 'revoked' | 'draft'
  securityScore: number
}
\`\`\`

**Features:**
- Badge de estado con colores
- Fechas de emisión y expiración
- Barra de security score
- Acciones: Download, Verify, Share

---

### VCIssuerSection (`components/vc-info/vc-issuer-section.tsx`)
Información del emisor de la credencial.

**Props:**
\`\`\`typescript
interface VCIssuerSectionProps {
  issuer: {
    did: string
    address?: string
    name?: string
    trustLevel?: 'trusted' | 'verified' | 'unknown'
  }
  signatureValid: boolean
}
\`\`\`

---

### VCHolderSection (`components/vc-info/vc-holder-section.tsx`)
Claims del titular con tipos detectados.

**Props:**
\`\`\`typescript
interface VCHolderSectionProps {
  credentialSubject: Record<string, any>
  privacyLevel: 'full' | 'selective' | 'minimal'
}
\`\`\`

---

### VCSecurityScore (`components/vc-info/vc-security-score.tsx`)
Análisis de seguridad con checks detallados.

**Props:**
\`\`\`typescript
interface VCSecurityScoreProps {
  score: number // 0-100
  checks: SecurityCheck[]
}

interface SecurityCheck {
  name: string
  status: 'pass' | 'fail' | 'warning'
  description: string
}
\`\`\`

---

### VCTimeline (`components/vc-info/vc-timeline.tsx`)
Timeline de eventos de la credencial.

**Props:**
\`\`\`typescript
interface VCTimelineProps {
  events: TimelineEvent[]
}

interface TimelineEvent {
  date: Date
  type: 'issued' | 'claimed' | 'presented' | 'verified' | 'revoked'
  actor?: string
  details?: string
}
\`\`\`

---

### VCProofsSection (`components/vc-info/vc-proofs-section.tsx`)
Detalles de las pruebas criptográficas.

**Props:**
\`\`\`typescript
interface VCProofsSectionProps {
  proofs: Proof[]
}

interface Proof {
  type: string // "EthereumEip712Signature2021"
  created: string
  proofPurpose: string
  verificationMethod: string
  proofValue: string
  eip712?: EIP712TypedData
}
\`\`\`

---

### VCRawJSON (`components/vc-info/vc-raw-json.tsx`)
Visualizador del JSON raw de la credencial.

**Props:**
\`\`\`typescript
interface VCRawJSONProps {
  credential: VerifiableCredential
}
\`\`\`

**Features:**
- Syntax highlighting
- Copy to clipboard
- Download JSON button
- Collapsible sections

---

## 5. Admin Components

### AdminAuthGate
Ver sección Authentication Components.

### Admin Dashboard (`app/admin/page.tsx`)
Dashboard principal de administración.

**Sections:**
- 3 stat cards (Credentials, Issuers, System Status)
- Recent activity list
- Quick actions

---

### Issuers Management (`app/admin/issuers/page.tsx`)
Gestión de emisores autorizados.

**Features:**
- Tabla de issuers con estado
- Modal para añadir nuevo issuer
- Acción de desactivar issuer

---

### Revoke Credential (`app/admin/revoke/page.tsx`)
Herramienta de revocación.

**Flow:**
1. Input de hash de credencial
2. Búsqueda y preview de credencial
3. Confirmación de revocación
4. Transacción blockchain

---

### System Config (`app/admin/config/page.tsx`)
Configuración del sistema.

**Settings:**
- Maintenance mode toggle
- Diamond contract address (read-only)
- Network info

---

## 6. Issuer Components

### Issuer Portal (`app/issuer/page.tsx`)
Formulario de emisión de credenciales.

**Form Fields:**
- Email del titular (required)
- Wallet address (required)
- Credential type selector
- Company name (required)

---

### Issuance History (`app/issuer/history/page.tsx`)
Historial de emisiones.

**Features:**
- Stats: Total, Pending, Claimed, Revoked
- Tabla filtrable por estado
- Acciones: Ver, Revocar
- Export CSV

---

## 7. Claim Components

### Claim Wizard (`app/claim/[token]/page.tsx`)
Wizard de reclamación de credenciales.

**Steps:**
1. **OTP**: Input de 6 dígitos, contador de expiración
2. **Connect**: Botón MetaMask, verificación de wallet
3. **Preview**: Vista previa de credencial
4. **Sign**: Firma EIP-712
5. **Success**: Downloads y save to Snap

---

### Manual Claim (`app/claim/page.tsx`)
Entrada manual sin magic link.

**Form:**
- Issuance ID input
- Claim Token input
- Submit button

---

## 8. Verification Components

### Verify Portal (`app/verify/page.tsx`)
Portal público de verificación.

**Features:**
- Dropzone para PDF/JSON
- QR scanner (placeholder)
- Loading state con animación
- Result display (valid/invalid/revoked)
- Credential details accordion

---

## 9. Application Components

### Apply Form (`app/apply/page.tsx`)
Formulario público de solicitud.

**Form Fields:**
- Full name (required)
- Email (required)
- Wallet address (required)
- Organization (optional)
- Reason (optional)
- Terms checkbox (required)

---

## 10. Utility Components

### ThemeProvider (`components/theme-provider.tsx`)
Provider de tema dark/light.

**Props:**
\`\`\`typescript
interface ThemeProviderProps {
  children: React.ReactNode
  attribute?: string
  defaultTheme?: 'light' | 'dark' | 'system'
  enableSystem?: boolean
}
\`\`\`

---

## 11. UI Primitives (shadcn/ui)

Todos los componentes de `components/ui/` siguen el patrón shadcn/ui:

| Component | Description |
|-----------|-------------|
| `Button` | Botones con variantes |
| `Card` | Contenedores con header/content/footer |
| `Dialog` | Modales |
| `DropdownMenu` | Menús desplegables |
| `Input` | Inputs de texto |
| `Select` | Selectores |
| `Table` | Tablas de datos |
| `Tabs` | Navegación por tabs |
| `Toast` | Notificaciones |
| `Badge` | Etiquetas de estado |
| `Skeleton` | Loading placeholders |
| `Switch` | Toggle switches |
| ... | +40 más componentes |

**Pattern:**
\`\`\`tsx
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    <Button variant="default">Click me</Button>
  </CardContent>
</Card>
\`\`\`
