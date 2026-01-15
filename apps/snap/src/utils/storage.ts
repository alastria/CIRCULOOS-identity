/**
 * Storage utilities for managing VC state
 */

export interface StoredVC {
    id: string;
    vc: any; // W3C VC format
    issuer: string;
    issuedAt: number;
    type: string[];
    // New fields for better organization
    category?: 'work' | 'education' | 'identity' | 'finance' | 'other';
    tags?: string[];
    favorite?: boolean;
    lastUsed?: number; // Timestamp of last use in VP
}

export interface SnapState {
    vcs: StoredVC[];
}

/**
 * Get current snap state
 */
export async function getState(): Promise<SnapState> {
    const state = await snap.request({
        method: 'snap_manageState',
        params: { operation: 'get' },
    });

    return (state as SnapState) || { vcs: [] };
}

/**
 * Update snap state
 */
export async function setState(state: SnapState): Promise<void> {
    await snap.request({
        method: 'snap_manageState',
        params: { operation: 'update', newState: state },
    });
}

/**
 * Clear all stored VCs
 */
export async function clearState(): Promise<void> {
    await snap.request({
        method: 'snap_manageState',
        params: { operation: 'clear' },
    });
}
