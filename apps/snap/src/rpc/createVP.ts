import { panel, text, heading } from '@metamask/snaps-sdk';
import { getState } from '../utils/storage';

interface CreateVPParams {
    vcIds: string[];
    holderAddress: string;
    expiresInMinutes?: number;
}

/**
 * Create a Verifiable Presentation (unsigned)
 * Returns the selected VCs - signing happens outside the Snap with MetaMask
 */
export async function createVP(params: CreateVPParams): Promise<{
    vcs: any[];
    holder: string;
    issuanceDate: string;
    expirationDate: string;
}> {
    const { vcIds, holderAddress, expiresInMinutes = 5 } = params;

    // Get state
    const state = await getState();

    // Find requested VCs
    const vcs = vcIds.map((id) => {
        const found = state.vcs.find((vc) => vc.id === id);
        if (!found) {
            throw new Error(`VC not found: ${id}`);
        }
        return found.vc;
    });

    if (vcs.length === 0) {
        throw new Error('No credentials selected');
    }

    // Ask user for confirmation
    const confirmed = await snap.request({
        method: 'snap_dialog',
        params: {
            type: 'confirmation',
            content: panel([
                heading('Create Presentation?'),
                text(`**Credentials:** ${vcs.length}`),
                text(`**Holder:** ${holderAddress.substring(0, 10)}...`),
                text(''),
                text('The selected credentials will be included in a VP. You will sign it with MetaMask afterwards.'),
            ]),
        },
    });

    if (!confirmed) {
        throw new Error('User rejected presentation creation');
    }

    // Create VP metadata
    const now = new Date();
    const expirationDate = new Date(now.getTime() + expiresInMinutes * 60 * 1000);

    return {
        vcs,
        holder: holderAddress,
        issuanceDate: now.toISOString(),
        expirationDate: expirationDate.toISOString(),
    };
}
