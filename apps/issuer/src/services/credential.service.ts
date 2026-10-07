import {
    buildVC,
    buildIssuanceDraft,
    buildEmailBinding,
    buildCredentialProof,
    VC,
    CredentialProof,
    IStorageAdapter,
    CredentialType,
    buildEmployeeVC,
    EMPLOYEE_SCHEMA_ID,
    Organization
} from '@circuloos/common'

/** Reference from an access credential to the employee credential it is based on. */
export interface EmployeeCredentialRef {
    id: string
    credentialHash: string
}

/** Subject fields the issuer controls; custom claims can never overwrite them. */
const PROTECTED_SUBJECT_FIELDS = ['id', 'holderAddress', 'worksFor', 'employeeCredential']

function withoutProtectedFields(claims?: Record<string, any>): Record<string, any> {
    const rest = { ...(claims || {}) }
    for (const key of PROTECTED_SUBJECT_FIELDS) delete rest[key]
    return rest
}
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

    /**
     * The issued credential stored under `id`, whether it is still the bare VC (after mint)
     * or wrapped in the presentation finalize() stores after the claim — which has no `id`
     * of its own, so loadVC() cannot return it.
     */
    async loadIssuedCredential(id: string): Promise<VC | null> {
        const stored: any = await this.store.loadVC(id)
        const vc = stored?.verifiableCredential?.[0] ?? stored
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
        credentialType: string = 'circuloos-marketplace', // EIP-712 schema ID
        organization?: Partial<Organization>,
        employeeCredential?: EmployeeCredentialRef
    ) {
        const id = `issuance_${Date.now()}_${randomBytes(6).toString('hex')}`
        const emailBinding = buildEmailBinding(email, hmacSecret)

        if (credentialType === EMPLOYEE_SCHEMA_ID) {
            // Organisation is validated/normalised (throws OrganizationValidationError) and
            // signed by the issuer; id and worksFor are set last so no claim can replace them.
            const draftVc = buildEmployeeVC({
                holderAddress,
                organization: organization || {},
                issuer: issuerDid,
                extraClaims: {
                    ...withoutProtectedFields(customClaims),
                    email,
                    emailBinding,
                    issuanceId: id,
                    preparedAt: new Date().toISOString(),
                },
            })
            return { id, draftVc }
        }

        // Map schema ID to W3C credential type
        const vcType = this.schemaIdToVCType(credentialType)

        // W3C v2.0 Data Cleaning & Mapping
        // 1. Flatten "Issuance" (don't nest JSON string)
        // 2. Map "Company" -> "worksFor" (Schema.org)
        // 3. Map "email" -> "email" (Schema.org)

        const subject: Record<string, any> = {
            // Custom claims first: they cannot overwrite the holder, the organisation or the employee reference
            ...withoutProtectedFields(customClaims),
            id: holderAddress, // Will be converted to DID by buildVC
            email,
            emailBinding,
            // Map company to worksFor
            ...(companyName ? { worksFor: { '@type': 'Organization', name: companyName } } : {}),
            ...(employeeCredential ? { employeeCredential } : {}),
            // Flatten issuance metadata (hide technical details or expose cleanly)
            issuanceId: id,
            preparedAt: new Date().toISOString(),
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
            'circuloos-employee': CredentialType.CirculoosEmployeeCredential,
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
