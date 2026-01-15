import { setState, getState } from '../utils/storage';

/**
 * Clear all VCs from storage
 * WARNING: This is destructive and cannot be undone
 */
export async function clearAll(): Promise<{ success: boolean; deletedCount: number }> {
    const state = await getState();
    const deletedCount = state.vcs.length;
    
    // Clear all VCs
    await setState({
        vcs: [],
    });
    
    return {
        success: true,
        deletedCount,
    };
}
