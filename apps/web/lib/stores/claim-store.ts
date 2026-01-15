import { create } from "zustand"

export type ClaimStep =
  | "loading"
  | "invalid"
  | "expired"
  | "already_claimed"
  | "validate"
  | "connect"
  | "sign"
  | "claiming"
  | "success"

interface CredentialPreview {
  type: string
  issuer: string
  holderAddress: string
  attributes: Record<string, string | any> // Allow objects for domain
  issuedAt: string
  expiresAt?: string
}

interface ClaimedCredential {
  "@context": string[]
  type: string[]
  id: string // VC ID from backend
  issuer: string
  issuanceDate: string
  expirationDate?: string
  credentialSubject: Record<string, unknown>
  proof: {
    type: string
    created: string
    proofPurpose: string
    verificationMethod: string
    issuerSignature: string
    holderSignature: string
  }
}

interface ClaimState {
  step: ClaimStep
  token: string | null
  otp: string
  isOtpValid: boolean
  isLoading: boolean
  error: string | null
  credentialPreview: CredentialPreview | null
  claimedCredential: ClaimedCredential | null
  otpExpiresAt: Date | null
  otpAttempts: number
  maxOtpAttempts: number

  // Actions
  setStep: (step: ClaimStep) => void
  setToken: (token: string) => void
  setOtp: (otp: string) => void
  validateOtp: () => Promise<boolean>
  resendOtp: () => Promise<boolean>
  setCredentialPreview: (preview: CredentialPreview) => void
  setClaimedCredential: (credential: ClaimedCredential) => void
  setError: (error: string | null, incrementOtpAttempts?: boolean) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

const initialState = {
  step: "loading" as ClaimStep,
  token: null,
  otp: "",
  isOtpValid: false,
  isLoading: false,
  error: null,
  credentialPreview: null,
  claimedCredential: null,
  otpExpiresAt: null,
  otpAttempts: 0,
  maxOtpAttempts: 3,
}

export const useClaimStore = create<ClaimState>((set, get) => ({
  ...initialState,

  setStep: (step) => set({ step, error: null }),

  setToken: (token) => set({ token }),

  setOtp: (otp) => set({ otp, error: null }),

  validateOtp: async () => {
    const { otp, otpAttempts, maxOtpAttempts } = get()

    if (otpAttempts >= maxOtpAttempts) {
      set({ error: "claim.errors.maxAttemptsReached" })
      return false
    }

    // Since backend validates OTP during finalize, we only do basic validation here
    if (otp.length === 6) {
      // After OTP validation, go to sign step (wallet is already connected and authenticated)
      set({ isOtpValid: true, isLoading: false, step: "sign", error: null })
      return true
    } else {
      set({
        error: "claim.errors.invalidOTP",
        isLoading: false,
        otpAttempts: otpAttempts + 1,
      })
      return false
    }
  },

  resendOtp: async () => {
    set({ isLoading: true, error: null })
    // TODO: Implement resend endpoint in backend if needed
    // For now, we simulate success to allow UI flow
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      set({
        isLoading: false,
        otp: "",
        otpExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        otpAttempts: 0,
      })
      return true
    } catch {
      set({ isLoading: false, error: "claim.errors.resendFailed" })
      return false
    }
  },

  setCredentialPreview: (preview) => set({ credentialPreview: preview }),

  setClaimedCredential: (credential) => set({ claimedCredential: credential }),

  setError: (error, incrementOtpAttempts = false) => {
    // Ensure error is always a string, never an object
    const errorString = error && typeof error === 'object' 
      ? ((error as Error).message || JSON.stringify(error) || String(error))
      : (error || null)
    
    const state = get()
    const updates: any = { error: errorString }
    
    // Increment OTP attempts if requested and not exceeded
    if (incrementOtpAttempts && state.otpAttempts < state.maxOtpAttempts) {
      updates.otpAttempts = state.otpAttempts + 1
    }
    
    set(updates)
  },

  setLoading: (isLoading) => set({ isLoading }),

  reset: () => set(initialState),
}))
