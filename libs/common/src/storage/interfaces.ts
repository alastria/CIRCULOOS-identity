/**
 * Storage adapter interface for VCs, VPs, and issuances
 * Abstracts the underlying storage implementation (SQLite, Memory, etc.)
 */
export interface IStorageAdapter {
    // Verifiable Credentials
    saveVC(id: string, vc: any): Promise<void>
    loadVC(id: string): Promise<any | null>
    listVCsByHolder?(holderAddress: string): Promise<any[]>

    // Verifiable Presentations (verification history)
    saveVP(id: string, vp: any, metadata?: { issuer?: string, holder?: string }): Promise<void>
    loadVP(id: string): Promise<any | null>
    listVPs(filter?: { issuer?: string, holder?: string }): Promise<any[]>

    // Issuances (workflow state)
    saveIssuance(id: string, data: any): Promise<void>
    loadIssuance(id: string): Promise<any | null>
    listIssuances(filter?: { status?: string, holderAddress?: string, limit?: number, offset?: number }): Promise<{ issuances: any[], total: number }>

    // Utility
    close(): void
}
