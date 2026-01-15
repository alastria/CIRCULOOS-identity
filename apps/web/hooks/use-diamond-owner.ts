// Hook to verify if an address is the owner of the Diamond
import { useReadContract } from 'wagmi'
import { useState, useEffect } from 'react'

// Minimal ABI for OwnershipFacet - we only need the owner() function
const OWNERSHIP_ABI = [
    {
        inputs: [],
        name: 'owner',
        outputs: [{ internalType: 'address', name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const

export function useDiamondOwner() {
    const diamondAddress = (process.env.NEXT_PUBLIC_DIAMOND_ADDRESS ||
        process.env.NEXT_PUBLIC_EIP712_VERIFYING_CONTRACT) as `0x${string}` | undefined

    const { data: owner, isError, isLoading } = useReadContract({
        address: diamondAddress,
        abi: OWNERSHIP_ABI,
        functionName: 'owner',
        query: {
            enabled: !!diamondAddress,
            staleTime: 60_000, // Cache for 1 minute
        },
    })

    return {
        owner: owner as string | undefined,
        isLoading,
        isError,
        diamondAddress,
    }
}

export function useIsDiamondOwner(address: string | undefined): boolean {
    const { owner } = useDiamondOwner()

    if (!address || !owner) return false

    return address.toLowerCase() === owner.toLowerCase()
}
