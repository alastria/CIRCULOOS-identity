import {
    buildVC,
    buildIssuanceDraft,
    buildEmailBinding,
    buildCredentialProof,
    VC,
    CredentialProof,
    IStorageAdapter,
    CredentialType
} from '@circuloos/common'
import { randomBytes } from 'crypto'

export class CredentialService {
    private store: IStorageAdapter

    constructor(store: IStorageAdapter) {
        this.store = store
    }

    async loadIssuance(id: string): Promise<any> {
        const rec = await this.store.loadIssuance(id)
        if (!rec || !rec.id) return null
        return rec
    }

    async saveIssuance(id: string, data: any): Promise<void> {
        await this.store.saveIssuance(id, data)
    }

    async loadVC(id: string): Promise<VC | null> {
        const vc = await this.store.loadVC(id)
        if (!vc || !vc.id) return null
        return vc
    }

    async saveVC(id: string, vc: VC | any): Promise<void> {
        await this.store.saveVC(id, vc)
    }

    createDraftVC(
        holderAddress: string,
        email: string,
        issuerDid: string,
        hmacSecret: string,
        companyName?: string,
        customClaims?: Record<string, any>,
        credentialType: string = 'circuloos-marketplace' // EIP-712 schema ID
    ) {
        const id = `issuance_${Date.now()}_${randomBytes(6).toString('hex')}`
        const emailBinding = buildEmailBinding(email, hmacSecret)

        // Map schema ID to W3C credential type
        const vcType = this.schemaIdToVCType(credentialType)

        // W3C v2.0 Data Cleaning & Mapping
        // 1. Flatten "Issuance" (don't nest JSON string)
        // 2. Map "Company" -> "worksFor" (Schema.org)
        // 3. Map "email" -> "email" (Schema.org)

        const subject: Record<string, any> = {
            id: holderAddress, // Will be converted to DID by buildVC
            email,
            emailBinding,
            // Map company to worksFor
            ...(companyName ? { worksFor: { '@type': 'Organization', name: companyName } } : {}),
            // Flatten issuance metadata (hide technical details or expose cleanly)
            issuanceId: id,
            preparedAt: new Date().toISOString(),
            ...(customClaims || {}),
        }

        // Remove legacy fields that might pollute
        delete subject.holderAddress
        delete subject.company

        // Build VC with the correct type for schema detection
        const draftVc = buildVC(subject, issuerDid, vcType)
        return { id, draftVc }
    }

    /**
     * Map EIP-712 schema ID to W3C VC type
     */
    private schemaIdToVCType(schemaId: string): string {
        const mapping: Record<string, string> = {
            'circuloos-marketplace': CredentialType.CirculoosMarketplaceCredential,
            'employee-badge': CredentialType.EmployeeCredential,
            'student-credential': CredentialType.StudentCredential,
        }
        return mapping[schemaId] || CredentialType.CirculoosMarketplaceCredential
    }

    buildProof(signature: string, signer: string, domain: any, purpose: 'assertionMethod' | 'authentication'): CredentialProof {
        return buildCredentialProof({
            signature,
            signer,
            domain,
            proofPurpose: purpose,
        })
    }

    /**
     * Embed proof in VC to create W3C-compliant credential
     */
    embedProof(vc: Omit<VC, 'proof'>, proof: CredentialProof): VC {
        return { ...vc, proof } as VC
    }
}
