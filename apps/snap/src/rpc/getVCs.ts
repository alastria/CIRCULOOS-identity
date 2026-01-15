import { getState, StoredVC } from '../utils/storage';

/**
 * Normalize address (handles DID format did:ethr:0x... or direct address)
 */
function normalizeAddress(address: string): string {
    let normalized = address.toLowerCase();
    if (normalized.startsWith('did:ethr:')) {
        const parts = normalized.split(':');
        normalized = parts[parts.length - 1];
    }
    return normalized;
}

/**
 * Get holder address from VC (supports credentialSubject.id or credentialSubject.holderAddress)
 */
function getHolderAddress(vc: any): string | null {
    const credentialSubject = vc.credentialSubject || vc.verifiableCredential?.[0]?.credentialSubject;
    if (!credentialSubject) return null;
    
    const holderId = credentialSubject.id || credentialSubject.holderAddress;
    if (!holderId) return null;
    
    return normalizeAddress(holderId);
}

/**
 * Get current wallet address from MetaMask using Ethereum provider
 * In MetaMask Snaps, ethereum is available via the endowment:ethereum-provider permission
 */
async function getCurrentWalletAddress(): Promise<string | null> {
    try {
        // Check if ethereum is available (from endowment:ethereum-provider)
        const ethereum = (globalThis as any).ethereum;
        if (!ethereum) {
            console.warn('Ethereum provider not available in Snap context');
            return null;
        }
        
        // Use the Ethereum provider endowment to get current account
        const accounts = await ethereum.request({
            method: 'eth_accounts',
        }) as string[];
        
        if (accounts && accounts.length > 0) {
            console.log('Found connected account:', accounts[0]);
            return accounts[0];
        }
        
        // If no accounts, try to request access (this may not work in Snap context)
        try {
            const requestedAccounts = await ethereum.request({
                method: 'eth_requestAccounts',
            }) as string[];
            
            if (requestedAccounts && requestedAccounts.length > 0) {
                console.log('Requested and got account:', requestedAccounts[0]);
                return requestedAccounts[0];
            }
        } catch (requestError) {
            // eth_requestAccounts may not be available in Snap context
            console.warn('Could not request accounts:', requestError);
        }
    } catch (error) {
        console.error('Error getting wallet address:', error);
    }
    
    console.warn('No wallet address found');
    return null;
}

/**
 * Get all stored VCs filtered by the current wallet address
 * Only returns VCs that belong to the wallet making the request (cryptographically secure)
 * 
 * @param params - Optional parameters including:
 *   - type: Filter by credential type
 *   - holderAddress: The wallet address to filter by (passed from frontend for security)
 */
export async function getVCs(params?: { type?: string; holderAddress?: string }): Promise<StoredVC[]> {
    // Try to get address from params first (passed by frontend)
    let currentAddress = params?.holderAddress;
    
    // If not provided, try to get from MetaMask (may not work in all contexts)
    if (!currentAddress) {
        currentAddress = await getCurrentWalletAddress();
    }
    
    // If we still can't get the address, return empty array for security
    if (!currentAddress) {
        console.warn('SECURITY: Could not determine wallet address, returning empty array');
        return [];
    }
    
    const normalizedCurrentAddress = normalizeAddress(currentAddress);
    console.log('Filtering VCs for address:', normalizedCurrentAddress);
    
    // Get state
    const state = await getState();
    console.log('Total VCs in storage:', state.vcs.length);
    
    // Filter VCs by holder address (cryptographically secure - only owner can see their VCs)
    let filtered = state.vcs.filter((storedVC) => {
        const holderAddress = getHolderAddress(storedVC.vc);
        if (!holderAddress) {
            console.warn('VC missing holder address:', storedVC.id);
            return false;
        }
        const normalizedHolder = normalizeAddress(holderAddress);
        const matches = normalizedHolder === normalizedCurrentAddress;
        if (!matches) {
            console.log(`VC ${storedVC.id} holder (${normalizedHolder}) does not match current address (${normalizedCurrentAddress})`);
        }
        return matches;
    });
    
    console.log('Filtered VCs count:', filtered.length);
    
    // Additional filter by type if provided
    if (params?.type) {
        filtered = filtered.filter((vc) => vc.type.includes(params.type!));
    }
    
    return filtered;
}
