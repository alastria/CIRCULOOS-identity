import { getState, setState } from '../utils/storage';

/**
 * Delete a stored VC by ID
 */
export async function deleteVC(params: { vcId: string }): Promise<{ success: boolean }> {
    const { vcId } = params;

    const state = await getState();
    const index = state.vcs.findIndex((v) => v.id === vcId);

    if (index === -1) {
        throw new Error(`VC not found: ${vcId}`);
    }

    // Ask for confirmation
    const confirmed = await snap.request({
        method: 'snap_dialog',
        params: {
            type: 'confirmation',
            content: {
                type: 'panel',
                children: [
                    {
                        type: 'heading',
                        value: 'Delete Credential?',
                    },
                    {
                        type: 'text',
                        value: `Are you sure you want to delete this credential? This action cannot be undone.`,
                    },
                    {
                        type: 'text',
                        value: `**ID:** ${vcId}`,
                    },
                ],
            },
        },
    });

    if (!confirmed) {
        return { success: false };
    }

    // Remove VC
    state.vcs.splice(index, 1);
    await setState(state);

    return { success: true };
}
