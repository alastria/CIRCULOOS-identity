import { panel, text, heading } from '@metamask/snaps-sdk';
import { getState, setState, StoredVC } from '../utils/storage';
import { isValidVC, getCredentialType, getIssuerDID } from '../utils/validation';

/**
 * Save a Verifiable Credential to the snap's encrypted state
 */
export async function saveVC(params: { vc: any }): Promise<{ success: boolean; vcId: string }> {
    const { vc } = params;

    // Validate VC structure
    const validation = isValidVC(vc);
    if (!validation.valid) {
        throw new Error(`Invalid VC: ${validation.errors.join(', ')}`);
    }

    // Extract metadata
    const vcId = vc.id || `vc-${Date.now()}`;
    const issuer = getIssuerDID(vc);
    const credType = getCredentialType(vc);
    const types = vc.type || ['VerifiableCredential'];

    // Suggest category based on credential type
    let suggestedCategory: StoredVC['category'] = 'other';
    const typeLower = credType.toLowerCase();
    if (typeLower.includes('employee') || typeLower.includes('work')) {
        suggestedCategory = 'work';
    } else if (typeLower.includes('degree') || typeLower.includes('education') || typeLower.includes('student')) {
        suggestedCategory = 'education';
    } else if (typeLower.includes('identity') || typeLower.includes('id') || typeLower.includes('passport')) {
        suggestedCategory = 'identity';
    } else if (typeLower.includes('bank') || typeLower.includes('finance') || typeLower.includes('payment')) {
        suggestedCategory = 'finance';
    }

    // Ask user for confirmation with enhanced details
    const confirmed = await snap.request({
        method: 'snap_dialog',
        params: {
            type: 'confirmation',
            content: panel([
                heading(' Save Credential?'),
                text(`**Type:** ${credType}`),
                text(`**Issuer:** ${issuer.substring(0, 40)}${issuer.length > 40 ? '...' : ''}`),
                text(`**ID:** ${vcId}`),
                text(`**Category:** ${suggestedCategory}`),
                text(''),
                text(' This credential has been validated as W3C compliant.'),
                text(''),
                text('Do you want to save this credential to your secure wallet?'),
            ]),
        },
    });

    if (!confirmed) {
        throw new Error('User rejected credential storage');
    }

    // Get current state
    const state = await getState();

    // Check if VC already exists
    const existingIndex = state.vcs.findIndex((v) => v.id === vcId);

    const storedVC: StoredVC = {
        id: vcId,
        vc,
        issuer,
        issuedAt: Date.now(),
        type: types,
        category: suggestedCategory,
        tags: [],
        favorite: false,
    };

    if (existingIndex >= 0) {
        // Update existing (preserve user metadata)
        state.vcs[existingIndex] = {
            ...storedVC,
            category: state.vcs[existingIndex].category || suggestedCategory,
            tags: state.vcs[existingIndex].tags || [],
            favorite: state.vcs[existingIndex].favorite || false,
        };
    } else {
        // Add new
        state.vcs.push(storedVC);
    }

    // Save state
    await setState(state);

    return { success: true, vcId };
}
