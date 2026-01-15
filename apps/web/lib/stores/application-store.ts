import { create } from "zustand"
import type { Application, ApplicationStatus } from "@/lib/types/application"

interface ApplicationState {
  applications: Application[]
  isLoading: boolean
  error: string | null
  filters: {
    status: ApplicationStatus | "ALL"
    search: string
    dateRange: { from: string; to: string } | null
  }

  // Actions
  setApplications: (apps: Application[]) => void
  addApplication: (app: Application) => void
  updateApplication: (id: string, updates: Partial<Application>) => void
  setFilters: (filters: Partial<ApplicationState["filters"]>) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

// Mock data for demo
const mockApplications: Application[] = [
  {
    id: "app_001",
    email: "maria.garcia@empresa.com",
    fullName: "María García López",
    organization: "Empresa SA",
    walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38",
    reason: "Necesito credencial para acceder a servicios corporativos",
    status: "PENDING",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "app_002",
    email: "carlos.ruiz@universidad.edu",
    fullName: "Carlos Ruiz Martín",
    organization: "Universidad Politécnica",
    walletAddress: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
    reason: "Verificación de título universitario",
    status: "PENDING",
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "app_003",
    email: "ana.martinez@alastria.io",
    fullName: "Ana Martínez Sanz",
    organization: "Consorcio de Alastria",
    walletAddress: "0xdD2FD4581271e230360230F9337D5c0430Bf44C0",
    status: "AUTO_APPROVED",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    reviewedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    issuanceId: "iss_003",
  },
  {
    id: "app_004",
    email: "pedro.sanchez@gmail.com",
    fullName: "Pedro Sánchez Díaz",
    walletAddress: "0x1234567890123456789012345678901234567890",
    reason: "Solicitud de credencial personal",
    status: "REJECTED",
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    reviewedAt: new Date(Date.now() - 47 * 60 * 60 * 1000).toISOString(),
    rejectionReason: "Documentación incompleta",
  },
]

export const useApplicationStore = create<ApplicationState>((set) => ({
  applications: mockApplications,
  isLoading: false,
  error: null,
  filters: {
    status: "ALL",
    search: "",
    dateRange: null,
  },

  setApplications: (applications) => set({ applications }),

  addApplication: (app) =>
    set((state) => ({
      applications: [app, ...state.applications],
    })),

  updateApplication: (id, updates) =>
    set((state) => ({
      applications: state.applications.map((app) => (app.id === id ? { ...app, ...updates } : app)),
    })),

  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),
}))
