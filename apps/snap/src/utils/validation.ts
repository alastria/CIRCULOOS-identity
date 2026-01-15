/**
 * Validation utilities for Verifiable Credentials
 */

interface W3CCredential {
    '@context': string | string[];
    type: string | string[];
    issuer: string | { id: string };
    issuanceDate?: string;
    credentialSubject: any;
    proof?: any;
    expirationDate?: string;
}

/**
 * Validate if object is a valid W3C Verifiable Credential
 */
export function isValidVC(vc: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!vc) {
        errors.push('VC is null or undefined');
        return { valid: false, errors };
    }

    if (!vc['@context']) {
        errors.push('Missing required field: @context');
    }

    if (!vc.type) {
        errors.push('Missing required field: type');
    } else {
        const types = Array.isArray(vc.type) ? vc.type : [vc.type];
        if (!types.includes('VerifiableCredential')) {
            errors.push('type array must include "VerifiableCredential"');
        }
    }

    if (!vc.issuer) {
        errors.push('Missing required field: issuer');
    }

    if (!vc.credentialSubject) {
        errors.push('Missing required field: credentialSubject');
    }

    // Check context includes W3C VC context
    if (vc['@context']) {
        const contexts = Array.isArray(vc['@context']) ? vc['@context'] : [vc['@context']];
        if (!contexts.includes('https://www.w3.org/2018/credentials/v1')) {
            errors.push('@context must include "https://www.w3.org/2018/credentials/v1"');
        }
    }

    // Validate dates if present
    if (vc.issuanceDate && !isValidDate(vc.issuanceDate)) {
        errors.push('Invalid issuanceDate format (must be ISO 8601)');
    }

    if (vc.expirationDate && !isValidDate(vc.expirationDate)) {
        errors.push('Invalid expirationDate format (must be ISO 8601)');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Check if string is valid ISO 8601 date
 */
function isValidDate(dateString: string): boolean {
    try {
        const date = new Date(dateString);
        return !isNaN(date.getTime()) && dateString === date.toISOString();
    } catch {
        return false;
    }
}

/**
 * Extract credential type (excluding VerifiableCredential)
 */
export function getCredentialType(vc: W3CCredential): string {
    const types = Array.isArray(vc.type) ? vc.type : [vc.type];
    return types.find((t) => t !== 'VerifiableCredential') || 'Credential';
}

/**
 * Extract issuer DID
 */
export function getIssuerDID(vc: W3CCredential): string {
    return typeof vc.issuer === 'string' ? vc.issuer : vc.issuer?.id || 'Unknown';
}
