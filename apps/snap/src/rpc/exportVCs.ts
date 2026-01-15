import { getState } from '../utils/storage';

/**
 * Export all VCs as JSON (for backup)
 */
export async function exportVCs(): Promise<{ vcs: any[]; exportedAt: number }> {
    const state = await getState();

    return {
        vcs: state.vcs,
        exportedAt: Date.now(),
    };
}
