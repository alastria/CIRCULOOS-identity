# Architecture Overview
## Alastria Verifiable Credentials Frontend

---

## 1. Project Structure

\`\`\`
alastria-vc-frontend/
│
├── app/                          # Next.js 15 App Router
│   ├── layout.tsx                # Root layout with providers
│   ├── page.tsx                  # Landing page
│   ├── globals.css               # Global styles + Tailwind v4 config
│   │
│   ├── admin/                    # Admin dashboard module
│   │   ├── layout.tsx            # Admin layout with auth gate
│   │   ├── page.tsx              # Dashboard home
│   │   ├── config/page.tsx       # System configuration
│   │   ├── issuers/page.tsx      # Issuer management
│   │   └── revoke/page.tsx       # Credential revocation
│   │
│   ├── api/                      # API Route Handlers
│   │   ├── applications/         # Application management
│   │   ├── claim/                # Claim process endpoints
│   │   └── verify/               # Verification endpoint
│   │
│   ├── apply/page.tsx            # Public application form
│   ├── claim/                    # Claim wizard
│   │   ├── page.tsx              # Manual claim entry
│   │   └── [token]/page.tsx      # Magic link claim
│   │
│   ├── docs/page.tsx             # Documentation placeholder
│   ├── api-issuer/page.tsx       # Issuer API docs placeholder
│   ├── api-verifier/page.tsx     # Verifier API docs placeholder
│   │
│   ├── issuer/                   # Issuer portal
│   │   ├── layout.tsx            # Issuer auth gate
│   │   ├── page.tsx              # Issue credentials
│   │   └── history/page.tsx      # Issuance history
│   │
│   ├── vc/info/page.tsx          # VC Inspector tool
│   └── verify/page.tsx           # Public verification
│
├── components/                   # React Components
│   ├── ui/                       # shadcn/ui primitives (50+ components)
│   ├── vc-info/                  # VC inspection components
│   │   ├── vc-input-methods.tsx  # 6 input methods
│   │   ├── vc-status-hero.tsx    # Status display
│   │   ├── vc-issuer-section.tsx # Issuer details
│   │   ├── vc-holder-section.tsx # Holder claims
│   │   ├── vc-security-score.tsx # Security analysis
│   │   ├── vc-timeline.tsx       # Event timeline
│   │   ├── vc-proofs-section.tsx # Cryptographic proofs
│   │   └── vc-raw-json.tsx       # Raw JSON viewer
│   │
│   ├── admin-auth-gate.tsx       # Admin wallet protection
│   ├── issuer-auth-gate.tsx      # Issuer wallet protection
│   ├── alastria-features.tsx     # Features spotlight grid
│   ├── credential-workflow.tsx   # How it works diagram
│   ├── floating-elements.tsx     # Background aurora orbs
│   ├── navbar.tsx                # Main navigation
│   ├── footer.tsx                # Site footer
│   └── theme-provider.tsx        # Dark/light mode
│
├── hooks/                        # Custom React Hooks
│   ├── use-wallet.ts             # Native MetaMask integration
│   ├── use-circuloos-snap.ts     # Snap communication
│   ├── use-mobile.ts             # Responsive detection
│   └── use-toast.ts              # Toast notifications
│
├── lib/                          # Utilities & Configuration
│   ├── i18n/                     # Internationalization
│   │   ├── provider.tsx          # I18n context provider
│   │   ├── es.json               # Spanish translations
│   │   └── en.json               # English translations
│   │
│   ├── stores/                   # Zustand State Stores
│   │   ├── claim-store.ts        # Claim wizard state
│   │   └── application-store.ts  # Application form state
│   │
│   ├── types/                    # TypeScript Definitions
│   │   ├── application.ts        # Application types
│   │   └── vc.ts                 # Verifiable Credential types
│   │
│   ├── utils/                    # Utility Functions
│   │   └── vc-parser.ts          # VC parsing utilities
│   │
│   ├── providers.tsx             # Root providers wrapper
│   ├── wagmi.ts                  # Wagmi config (legacy)
│   └── utils.ts                  # General utilities (cn)
│
├── src/                          # Backend-for-Frontend Layer
│   ├── features/                 # Feature Modules
│   │   ├── credentials/          # Credentials feature
│   │   │   ├── types/index.ts
│   │   │   ├── services/credentials-service.ts
│   │   │   └── hooks/use-credentials.ts
│   │   │
│   │   └── issuers/              # Issuers feature
│   │       ├── types/index.ts
│   │       ├── services/issuers-service.ts
│   │       └── hooks/use-issuers.ts
│   │
│   └── shared/                   # Shared Utilities
│       ├── api/api-client.ts     # HTTP client wrapper
│       ├── config/               # Configuration
│       │   ├── env.ts            # Environment validation
│       │   ├── constants.ts      # App constants
│       │   └── wagmi.ts          # Wagmi configuration
│       │
│       ├── hooks/use-wallet-auth.ts
│       ├── providers/root-provider.tsx
│       └── stores/               # Global stores
│           ├── auth-store.ts
│           └── ui-store.ts
│
├── public/                       # Static Assets
│   └── images/
│       ├── favicon_alastria.png
│       └── hero-image.png
│
├── docs/                         # Documentation
│   ├── PDR.md                    # Product Design Review
│   ├── ARCHITECTURE.md           # This file
│   ├── COMPONENTS.md             # Component reference
│   ├── API.md                    # API documentation
│   ├── HOOKS.md                  # Hooks documentation
│   └── DEPLOYMENT.md             # Deployment guide
│
├── .env                          # Base environment
├── .env.local                    # Local development
├── .env.docker                   # Docker environment
└── README.md                     # Project readme
\`\`\`

---

## 2. Data Flow

### 2.1 Credential Issuance Flow
\`\`\`
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Issuer  │───>│ Frontend │───>│ Issuer   │───>│Blockchain│
│  Portal  │    │ /issuer  │    │ API      │    │ Diamond  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
     │                                                │
     │ 1. Fill form (email, wallet, type)            │
     │                                                │
     ▼                                                │
┌──────────┐                                          │
│  Email   │ 2. Send magic link                       │
│  Service │                                          │
└──────────┘                                          │
     │                                                │
     ▼                                                ▼
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Holder  │───>│  Claim   │───>│  Sign    │───>│ Register │
│  Email   │    │  Wizard  │    │  VC      │    │ Hash     │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
\`\`\`

### 2.2 Credential Verification Flow
\`\`\`
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Verifier │───>│  Upload  │───>│ Parse VC │───>│ Verify   │
│          │    │  PDF/JSON│    │          │    │ API      │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                      │
                                     ┌────────────────┼────────────────┐
                                     ▼                ▼                ▼
                               ┌──────────┐    ┌──────────┐    ┌──────────┐
                               │ Check    │    │ Verify   │    │ Check    │
                               │ Issuer   │    │ Signature│    │ Revoked  │
                               └──────────┘    └──────────┘    └──────────┘
                                     │                │                │
                                     └────────────────┼────────────────┘
                                                      ▼
                                               ┌──────────┐
                                               │  Result  │
                                               │ Valid/   │
                                               │ Invalid  │
                                               └──────────┘
\`\`\`

---

## 3. State Management

### 3.1 Global Stores (Zustand)

#### AuthStore (`src/shared/stores/auth-store.ts`)
\`\`\`typescript
interface AuthState {
  address: string | null
  isConnected: boolean
  isAdmin: boolean
  isIssuer: boolean
  chainId: number | null
  connect: () => Promise<void>
  disconnect: () => void
}
\`\`\`

#### UIStore (`src/shared/stores/ui-store.ts`)
\`\`\`typescript
interface UIState {
  theme: 'light' | 'dark' | 'system'
  language: 'es' | 'en'
  sidebarOpen: boolean
  setTheme: (theme: Theme) => void
  setLanguage: (lang: Language) => void
  toggleSidebar: () => void
}
\`\`\`

### 3.2 Feature Stores

#### ClaimStore (`lib/stores/claim-store.ts`)
\`\`\`typescript
interface ClaimState {
  step: 'otp' | 'connect' | 'preview' | 'signing' | 'success' | 'error'
  token: string | null
  otp: string
  otpAttempts: number
  credential: VerifiableCredential | null
  signature: string | null
}
\`\`\`

---

## 4. Authentication & Authorization

### 4.1 Wallet-Based Auth
El sistema usa autenticación basada en wallet de MetaMask:

\`\`\`typescript
// hooks/use-wallet.ts
export function useWallet() {
  const [address, setAddress] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  
  const connect = async () => {
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts'
    })
    setAddress(accounts[0])
    setIsConnected(true)
  }
  
  return { address, isConnected, connect, disconnect }
}
\`\`\`

### 4.2 Authorization Gates
\`\`\`typescript
// Authorized wallets defined in lib/wagmi.ts
export const AUTHORIZED_ADMINS = [
  '0x1234...', // Admin wallet 1
  '0x5678...', // Admin wallet 2
]

export const AUTHORIZED_ISSUERS = [
  '0xabcd...', // Issuer wallet 1
  '0xefgh...', // Issuer wallet 2
]
\`\`\`

### 4.3 Auth Gate Components
\`\`\`tsx
// components/admin-auth-gate.tsx
export function AdminAuthGate({ children }) {
  const { address, isConnected } = useWallet()
  
  if (!isConnected) return <ConnectPrompt />
  if (!AUTHORIZED_ADMINS.includes(address)) return <Unauthorized />
  
  return children
}
\`\`\`

---

## 5. API Layer

### 5.1 API Client
\`\`\`typescript
// src/shared/api/api-client.ts
class ApiClient {
  private baseUrl: string
  private token: string | null
  
  async get<T>(path: string): Promise<T>
  async post<T>(path: string, body: unknown): Promise<T>
  async patch<T>(path: string, body: unknown): Promise<T>
  async delete(path: string): Promise<void>
}

export const issuerApi = new ApiClient(env.ISSUER_API_URL)
export const verifierApi = new ApiClient(env.VERIFIER_API_URL)
\`\`\`

### 5.2 Services
\`\`\`typescript
// src/features/credentials/services/credentials-service.ts
export const credentialsService = {
  async issue(data: IssueRequest): Promise<Credential>
  async revoke(id: string): Promise<void>
  async getById(id: string): Promise<Credential>
  async list(filters?: Filters): Promise<Credential[]>
}
\`\`\`

### 5.3 React Query Hooks
\`\`\`typescript
// src/features/credentials/hooks/use-credentials.ts
export function useCredentials(filters?: Filters) {
  return useQuery({
    queryKey: ['credentials', filters],
    queryFn: () => credentialsService.list(filters)
  })
}

export function useIssueCredential() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: credentialsService.issue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] })
    }
  })
}
\`\`\`

---

## 6. Styling System

### 6.1 Design Tokens
\`\`\`css
/* app/globals.css */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --primary: 222.2 47.4% 11.2%;
  --secondary: 210 40% 96.1%;
  --muted: 210 40% 96.1%;
  --accent: 210 40% 96.1%;
  --destructive: 0 84.2% 60.2%;
  --border: 214.3 31.8% 91.4%;
  --radius: 0.5rem;
  
  /* Alastria brand */
  --alastria-blue: 235 71% 22%;
  --alastria-red: 12 89% 52%;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... dark mode tokens */
}
\`\`\`

### 6.2 Component Variants
\`\`\`typescript
// Using class-variance-authority
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "border border-input bg-background",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
      },
    },
  }
)
\`\`\`

---

## 7. Internationalization

### 7.1 I18n Provider
\`\`\`typescript
// lib/i18n/provider.tsx
export function I18nProvider({ children }) {
  const [locale, setLocale] = useState<'es' | 'en'>('es')
  const messages = locale === 'es' ? esMessages : enMessages
  
  const t = (key: string) => {
    return key.split('.').reduce((obj, k) => obj?.[k], messages) || key
  }
  
  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}
\`\`\`

### 7.2 Translation Structure
\`\`\`json
{
  "common": { "loading": "...", "error": "..." },
  "nav": { "home": "...", "verify": "..." },
  "landing": {
    "hero": { "title": "...", "subtitle": "..." },
    "features": { ... }
  },
  "verify": { ... },
  "claim": { ... },
  "issuer": { ... },
  "admin": { ... }
}
\`\`\`

---

## 8. Error Handling

### 8.1 API Errors
\`\`\`typescript
class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message)
  }
}

// Usage in services
try {
  await credentialsService.issue(data)
} catch (error) {
  if (error instanceof ApiError) {
    toast.error(t(`errors.${error.code}`))
  }
}
\`\`\`

### 8.2 React Error Boundaries
\`\`\`tsx
// app/error.tsx
export default function Error({ error, reset }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2>Something went wrong!</h2>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
\`\`\`

---

## 9. Performance Optimizations

### 9.1 Code Splitting
- Dynamic imports para rutas pesadas
- Lazy loading de componentes de visualización
- Preloading de rutas críticas

### 9.2 Caching Strategy
\`\`\`typescript
// React Query defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000,   // 30 minutes
      retry: 1,
    },
  },
})
\`\`\`

### 9.3 Image Optimization
- Next.js Image component con lazy loading
- WebP format con fallbacks
- Responsive srcset para diferentes viewports
