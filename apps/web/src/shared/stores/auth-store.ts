import { create } from "zustand"
import { persist } from "zustand/middleware"
import { STORAGE_KEYS } from "@/src/shared/config/constants"

/**
 * Auth Store - Estado de autenticación
 */
interface AuthState {
  // User
  isAuthenticated: boolean
  walletAddress: string | null
  token: string | null
  role: "admin" | "issuer" | "holder" | null

  // Actions
  login: (walletAddress: string, token: string, role?: "admin" | "issuer" | "holder") => void
  logout: () => void
  setRole: (role: "admin" | "issuer" | "holder") => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      walletAddress: null,
      token: null,
      role: null,

      login: (walletAddress, token, role = "holder") =>
        set({
          isAuthenticated: true,
          walletAddress,
          token,
          role,
        }),

      logout: () =>
        set({
          isAuthenticated: false,
          walletAddress: null,
          token: null,
          role: null,
        }),

      setRole: (role) => set({ role }),
    }),
    {
      name: STORAGE_KEYS.AUTH_TOKEN,
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        walletAddress: state.walletAddress,
        token: state.token,
        role: state.role,
      }),
    },
  ),
)
