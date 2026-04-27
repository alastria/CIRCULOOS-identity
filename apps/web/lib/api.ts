import axios, { type AxiosInstance, AxiosError } from "axios"
import { config } from "../config"
import { toast } from "@/components/ui/use-toast"

// Create Axios instances with centralized config
export const issuerApi = axios.create({
    baseURL: `${config.issuerApiUrl}/api/v1`,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
})

export const verifierApi = axios.create({
    baseURL: `${config.verifierApiUrl}/api/v1`,
    headers: {
        "Content-Type": "application/json",
    },
})

// Global Error Handler
const handleApiError = (error: any) => {
    const message = error.response?.data?.message || error.message || "An unexpected error occurred"
    const statusCode = error.response?.status

    // Customize user-facing messages based on status
    let title = "Error"
    let variant: "default" | "destructive" = "destructive"

    switch (statusCode) {
        case 401:
            title = "Sesión Expirada"
            break
        case 403:
            title = "Acceso Denegado"
            break
        case 404:
            title = "Recurso No Encontrado"
            break
        case 429:
            title = "Demasiadas Solicitudes"
            break
        case 500:
            title = "Error del Servidor"
            break
        default:
            if (!error.response) {
                title = "Error de Conexión"
            }
    }

    // Show Toast
    toast({
        title,
        description: message,
        variant,
    })

    return Promise.reject(error)
}

// Attach interceptors
issuerApi.interceptors.response.use((response) => response, handleApiError)
verifierApi.interceptors.response.use((response) => response, handleApiError)

export interface IssuePrepareResponse {
    id: string
    token: string
    otp: string
    expiresAt: number
    domain: any
    holderAddress: string
    draftVc: any
}

export interface IssueMintResponse {
    id: string
    token: string
    issuer: {
        verificationMethod: string
    }
    otp?: string
}

export interface IssueFinalizeResponse {
    vcId: string
    holder: {
        verificationMethod: string
    }
}

export interface TokenInfoResponse {
    valid: boolean
    id: string
    holderAddress: string
    status: string
    expiresAt: number
    domain: any
    credentialType: string
    issuer: string
}

export const api = {
    issuer: {
        prepare: async (email: string, holderAddress: string, companyName?: string) => {
            const { data } = await issuerApi.post<IssuePrepareResponse>("/issue/prepare", {
                email,
                holderAddress,
                companyName,
            })
            return data
        },

        // SIWA (Sign-In with Alastria) authentication
        getAuthChallenge: async (address: string) => {
            const { data } = await issuerApi.get<{ nonce: string; issuedAt: string }>(`/auth/challenge/${address}`)
            return data
        },

        verifySIWA: async (address: string, signature: string, nonce: string) => {
            const { data } = await issuerApi.post<{ success: boolean; wallet: string; role: string }>("/auth/verify", {
                address,
                signature,
                nonce,
            })
            return data
        },

        logout: async () => {
            const { data } = await issuerApi.post<{ success: boolean }>("/auth/logout")
            return data
        },

        // Legacy nonce method (kept for backwards compatibility)
        getNonce: async (address: string) => {
            const { data } = await issuerApi.get<{ nonce: string }>(`/auth/challenge/${address}`)
            return data
        },

        getTokenInfo: async (token: string) => {
            // Token should already be decoded, but ensure it's properly encoded for URL
            // Use encodeURIComponent to safely encode the token for URL
            const encodedToken = encodeURIComponent(token)
            const { data } = await issuerApi.get<TokenInfoResponse>(`/issue/info/${encodedToken}`)
            return data
        },

        mint: async (id: string, signature: string, signer: string, domain?: any) => {
            const { data } = await issuerApi.post<IssueMintResponse>("/issue/mint", {
                id,
                signature,
                signer,
                domain,
            })
            return data
        },

        // Note: The backend 'finalize' endpoint handles the claim verification and signing
        finalize: async (id: string, token: string, otp: string, signature: string, signer: string, domain?: any, timestamp?: string, claimMessage?: any) => {
            const { data } = await issuerApi.post<IssueFinalizeResponse>("/issue/finalize", {
                id,
                token,
                otp,
                signature,
                signer,
                domain,
                timestamp, // Include timestamp for CredentialClaim signature verification
                claimMessage, // Include the claim message for signature verification
            })
            return data
        },

        // Generate and download PDF for a credential
        downloadPDF: async (id: string) => {
            const response = await issuerApi.get(`/credentials/${id}/pdf`, {
                responseType: 'blob',
            })
            return response.data
        },

        // Generate PDF from VC JSON (recover lost PDFs - identical to original)
        // SECURITY: Requires wallet address header to verify ownership
        downloadPDFFromVC: async (vc: any, walletAddress: string) => {
            if (!walletAddress) {
                throw new Error('Wallet address is required to generate PDF (security requirement)')
            }
            const response = await issuerApi.post(`/credentials/pdf/from-vc`,
                { vc },
                {
                    responseType: 'blob',
                    // Headers removed: Authentication is now handled via HttpOnly cookies (JWT)
                }
            )
            return response.data
        },

        // Helper to validate token/otp before signing (if backend supports it, otherwise we skip)
        // Currently backend doesn't have a dedicated "validate-otp" endpoint, it's all in finalize.
        // So we'll skip pre-validation or implement a check if needed.
    },

    verifier: {
        // Verify a Verifiable Presentation
        verifyVP: async (vp: any) => {
            // VP structure can be:
            // 1. { presentation: {...}, proof: {...} } - from frontend VP generation
            // 2. Direct W3C VP with proof inside
            // Normalize to what backend expects: { presentation: { ...vp, proof } }
            let presentation
            if (vp.presentation && vp.proof) {
                // Frontend generated VP - merge proof into presentation
                presentation = { ...vp.presentation, proof: vp.proof }
                // console.log('[API verifyVP] Merged VP with proof')
                // console.log('[API verifyVP] proof.eip712.message exists:', !!vp.proof?.eip712?.message)
            } else if (vp.proof) {
                // Already has proof inside
                presentation = vp
            } else {
                // Assume it's a complete VP structure
                presentation = vp
            }

            // console.log('[API verifyVP] Sending presentation with proof.eip712.message:', !!presentation?.proof?.eip712?.message)

            const { data } = await verifierApi.post<{ ok: boolean; valid: boolean; holder: any; credentials: any[]; error?: string }>("/verify/presentation", { presentation })
            // Normalize response for frontend
            return {
                ok: data.valid,
                holder: data.holder?.did || data.holder?.address,
                vcs: data.credentials,
                error: data.error
            }
        },
    },

    credentials: {
        // Get credentials owned by the authenticated holder
        getMyCredentials: async () => {
            const { data } = await issuerApi.get<{
                credentials: Array<{
                    id: string
                    type: string[]
                    issuer: string
                    issuanceDate: string
                    expirationDate: string
                    credentialSubject: any
                    hasProof: boolean
                }>
                total: number
                source: 'backend' | 'backend-issuances'
            }>('/credentials/my')
            return data
        },

        // Get credential by ID
        getCredential: async (id: string) => {
            const { data } = await issuerApi.get(`/credentials/${id}`)
            return data
        },

        // Get public credential with proof for verification flows
        getCredentialPublic: async (id: string) => {
            const { data } = await issuerApi.get(`/credentials/${encodeURIComponent(id)}/public`)
            return data
        },

        // Get full credential with personal data (requires SIWA, only holder can access)
        getCredentialFull: async (id: string) => {
            const { data } = await issuerApi.get(`/credentials/${encodeURIComponent(id)}/full`)
            return data
        },

        // Get credential status
        getStatus: async (id: string) => {
            const { data } = await issuerApi.get<{
                id: string
                status: 'active' | 'revoked' | 'expired'
                revoked: boolean
                revokedAt?: number
                reason?: string
                expiresAt?: number
            }>(`/credentials/${id}/status`)
            return data
        },
    },

    admin: {
        // Get synchronized blockchain statistics
        getBlockchainStats: async () => {
            const { data } = await issuerApi.get('/system/blockchain/stats')
            return data
        },

        // Get indexed credentials
        getBlockchainCredentials: async (params?: {
            limit?: number
            offset?: number
            issuer?: string
            subject?: string
            revoked?: boolean
        }) => {
            const { data } = await issuerApi.get('/system/blockchain/credentials', { params })
            return data
        },

        // Get trusted issuers
        getTrustedIssuers: async (active?: boolean) => {
            const { data } = await issuerApi.get('/system/blockchain/issuers', {
                params: { active }
            })
            return data
        },

        // Force synchronization
        syncBlockchain: async (fromBlock?: number, force = false) => {
            const { data } = await issuerApi.post('/system/blockchain/sync', {
                fromBlock,
                force
            })
            return data
        },

        // Get sync state
        getSyncState: async () => {
            const { data } = await issuerApi.get('/system/blockchain/sync/state')
            return data
        },

        // Prepare issuer registration - save metadata before blockchain TX
        prepareIssuer: async (issuer: {
            address: string
            name?: string
            email?: string
            requestedBy?: string
        }) => {
            const { data } = await issuerApi.post('/system/issuers/prepare', issuer)
            return data
        }
    }
}
