# Hooks Reference
## Alastria Verifiable Credentials Frontend

---

## 1. Wallet Hooks

### useWallet (`hooks/use-wallet.ts`)
Hook nativo para interacción con MetaMask.

**Returns:**
\`\`\`typescript
interface UseWalletReturn {
  address: string | null
  isConnected: boolean
  isConnecting: boolean
  chainId: number | null
  connect: () => Promise<void>
  disconnect: () => void
  switchChain: (chainId: number) => Promise<void>
  signMessage: (message: string) => Promise<string>
  signTypedData: (data: EIP712TypedData) => Promise<string>
}
\`\`\`

**Usage:**
\`\`\`tsx
function WalletButton() {
  const { address, isConnected, connect, disconnect } = useWallet()
  
  if (isConnected) {
    return (
      <Button onClick={disconnect}>
        {address?.slice(0, 6)}...{address?.slice(-4)}
      </Button>
    )
  }
  
  return <Button onClick={connect}>Connect Wallet</Button>
}
\`\`\`

**Events Listened:**
- `accountsChanged`: Actualiza address
- `chainChanged`: Actualiza chainId
- `disconnect`: Reset estado

---

### useWalletAuth (`src/shared/hooks/use-wallet-auth.ts`)
Hook extendido con verificación de autorización.

**Returns:**
\`\`\`typescript
interface UseWalletAuthReturn extends UseWalletReturn {
  isAdmin: boolean
  isIssuer: boolean
  isAuthorized: (role: 'admin' | 'issuer') => boolean
}
\`\`\`

**Usage:**
\`\`\`tsx
function AdminPanel() {
  const { isConnected, isAdmin, connect } = useWalletAuth()
  
  if (!isConnected) return <ConnectPrompt onConnect={connect} />
  if (!isAdmin) return <Unauthorized />
  
  return <AdminDashboard />
}
\`\`\`

---

## 2. Snap Hooks

### useCirculoosSnap (`hooks/use-circuloos-snap.ts`)
Hook para interacción con el MetaMask Snap de Circuloos.

**Returns:**
\`\`\`typescript
interface UseSnapReturn {
  isInstalled: boolean
  isConnecting: boolean
  error: Error | null
  
  // Methods
  install: () => Promise<void>
  getCredentials: () => Promise<VerifiableCredential[]>
  saveCredential: (vc: VerifiableCredential) => Promise<void>
  deleteCredential: (id: string) => Promise<void>
  signPresentation: (vcIds: string[], challenge?: string) => Promise<VP>
}
\`\`\`

**Usage:**
\`\`\`tsx
function SnapManager() {
  const { isInstalled, install, getCredentials, saveCredential } = useCirculoosSnap()
  const [credentials, setCredentials] = useState([])
  
  useEffect(() => {
    if (isInstalled) {
      getCredentials().then(setCredentials)
    }
  }, [isInstalled])
  
  if (!isInstalled) {
    return <Button onClick={install}>Install Snap</Button>
  }
  
  return <CredentialList credentials={credentials} />
}
\`\`\`

**Snap Methods:**
\`\`\`typescript
// Internal RPC calls
await window.ethereum.request({
  method: 'wallet_invokeSnap',
  params: {
    snapId: 'npm:@aspect-vc/circuloos-snap',
    request: { method: 'circuloos_getCredentials' }
  }
})
\`\`\`

---

## 3. I18n Hooks

### useI18n (`lib/i18n/provider.tsx`)
Hook para internacionalización.

**Returns:**
\`\`\`typescript
interface UseI18nReturn {
  locale: 'es' | 'en'
  setLocale: (locale: 'es' | 'en') => void
  t: (key: string, params?: Record<string, string>) => string
}
\`\`\`

**Usage:**
\`\`\`tsx
function Greeting() {
  const { t, locale, setLocale } = useI18n()
  
  return (
    <div>
      <h1>{t('landing.hero.title')}</h1>
      <p>{t('landing.hero.subtitle')}</p>
      
      <select value={locale} onChange={(e) => setLocale(e.target.value)}>
        <option value="es">Español</option>
        <option value="en">English</option>
      </select>
    </div>
  )
}
\`\`\`

**Nested Keys:**
\`\`\`typescript
// Acceso a claves anidadas con dot notation
t('claim.steps.validate.title') // "Validar"
t('claim.errors.invalidOTP')    // "Código de verificación incorrecto"
\`\`\`

---

## 4. Theme Hooks

### useTheme (from next-themes)
Hook para tema dark/light.

**Returns:**
\`\`\`typescript
interface UseThemeReturn {
  theme: string | undefined
  setTheme: (theme: string) => void
  resolvedTheme: string | undefined
  themes: string[]
  systemTheme: string | undefined
}
\`\`\`

**Usage:**
\`\`\`tsx
function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  
  const isDark = resolvedTheme === 'dark'
  
  return (
    <Button 
      variant="ghost" 
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  )
}
\`\`\`

---

## 5. Data Fetching Hooks

### useCredentials (`src/features/credentials/hooks/use-credentials.ts`)
Hook para listar credenciales.

**Props:**
\`\`\`typescript
interface UseCredentialsOptions {
  status?: 'pending' | 'claimed' | 'revoked'
  issuerId?: string
  page?: number
  limit?: number
}
\`\`\`

**Returns:**
\`\`\`typescript
// TanStack Query result
{
  data: Credential[]
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
}
\`\`\`

**Usage:**
\`\`\`tsx
function CredentialList() {
  const { data: credentials, isLoading } = useCredentials({ status: 'claimed' })
  
  if (isLoading) return <Skeleton />
  
  return (
    <Table>
      {credentials.map(cred => (
        <TableRow key={cred.id}>
          <TableCell>{cred.holder}</TableCell>
          <TableCell>{cred.type}</TableCell>
        </TableRow>
      ))}
    </Table>
  )
}
\`\`\`

---

### useIssueCredential (`src/features/credentials/hooks/use-credentials.ts`)
Hook mutation para emitir credenciales.

**Returns:**
\`\`\`typescript
// TanStack Query mutation
{
  mutate: (data: IssueRequest) => void
  mutateAsync: (data: IssueRequest) => Promise<Credential>
  isPending: boolean
  isError: boolean
  error: Error | null
}
\`\`\`

**Usage:**
\`\`\`tsx
function IssueForm() {
  const { mutateAsync, isPending } = useIssueCredential()
  
  const handleSubmit = async (data: FormData) => {
    try {
      await mutateAsync({
        holderEmail: data.email,
        holderWallet: data.wallet,
        credentialType: data.type,
        attributes: data.attributes
      })
      toast.success('Credential issued!')
    } catch (error) {
      toast.error('Failed to issue credential')
    }
  }
  
  return <Form onSubmit={handleSubmit} disabled={isPending} />
}
\`\`\`

---

### useIssuers (`src/features/issuers/hooks/use-issuers.ts`)
Hook para gestión de issuers.

**Returns:**
\`\`\`typescript
{
  // Query
  data: Issuer[]
  isLoading: boolean
  
  // Mutations
  addIssuer: UseMutationResult<Issuer, Error, AddIssuerRequest>
  removeIssuer: UseMutationResult<void, Error, string>
  updateIssuer: UseMutationResult<Issuer, Error, UpdateIssuerRequest>
}
\`\`\`

---

## 6. UI Hooks

### useMobile (`hooks/use-mobile.ts`)
Hook para detección de viewport móvil.

**Returns:**
\`\`\`typescript
{
  isMobile: boolean // true if viewport < 768px
}
\`\`\`

**Usage:**
\`\`\`tsx
function ResponsiveNav() {
  const { isMobile } = useMobile()
  
  if (isMobile) {
    return <HamburgerMenu />
  }
  
  return <DesktopNav />
}
\`\`\`

---

### useToast (`hooks/use-toast.ts`)
Hook para notificaciones toast (shadcn).

**Returns:**
\`\`\`typescript
{
  toast: (props: ToastProps) => void
  toasts: Toast[]
  dismiss: (id: string) => void
}
\`\`\`

**Usage:**
\`\`\`tsx
function SaveButton() {
  const { toast } = useToast()
  
  const handleSave = async () => {
    try {
      await save()
      toast({
        title: 'Saved!',
        description: 'Your changes have been saved.',
      })
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save changes.',
        variant: 'destructive',
      })
    }
  }
  
  return <Button onClick={handleSave}>Save</Button>
}
\`\`\`

---

## 7. Store Hooks (Zustand)

### useClaimStore (`lib/stores/claim-store.ts`)
Store para el wizard de claim.

**State & Actions:**
\`\`\`typescript
interface ClaimStore {
  // State
  step: ClaimStep
  token: string | null
  otp: string
  otpAttempts: number
  credential: VC | null
  signature: string | null
  error: string | null
  
  // Actions
  setStep: (step: ClaimStep) => void
  setToken: (token: string) => void
  setOtp: (otp: string) => void
  incrementAttempts: () => void
  setCredential: (vc: VC) => void
  setSignature: (sig: string) => void
  setError: (error: string) => void
  reset: () => void
}
\`\`\`

---

### useAuthStore (`src/shared/stores/auth-store.ts`)
Store global de autenticación.

**State & Actions:**
\`\`\`typescript
interface AuthStore {
  address: string | null
  isConnected: boolean
  chainId: number | null
  
  setAddress: (address: string | null) => void
  setChainId: (chainId: number | null) => void
  reset: () => void
}
\`\`\`

---

### useUIStore (`src/shared/stores/ui-store.ts`)
Store de preferencias de UI.

**State & Actions:**
\`\`\`typescript
interface UIStore {
  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
}
\`\`\`
