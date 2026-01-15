import { getState, setState, StoredVC } from '../utils/storage';

/**
 * Update VC metadata (category, tags, favorite)
 */
export async function updateVC(params: {
    vcId: string;
    category?: StoredVC['category'];
    tags?: string[];
    favorite?: boolean;
}): Promise<{ success: boolean }> {
    const { vcId, category, tags, favorite } = params;

    const state = await getState();
    const index = state.vcs.findIndex((v) => v.id === vcId);

    if (index === -1) {
        throw new Error(`VC not found: ${vcId}`);
    }

    // Update metadata
    if (category !== undefined) {
        state.vcs[index].category = category;
    }
    if (tags !== undefined) {
        state.vcs[index].tags = tags;
    }
    if (favorite !== undefined) {
        state.vcs[index].favorite = favorite;
    }

    await setState(state);

    return { success: true };
}
