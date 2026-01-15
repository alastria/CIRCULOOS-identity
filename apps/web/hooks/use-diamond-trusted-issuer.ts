// Hook to manage Trusted Issuers in the Diamond Contract
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useState, useCallback } from 'react'

// Minimal ABI for TrustedIssuerFacet
const TRUSTED_ISSUER_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'issuer', type: 'address' }],
    name: 'addTrustedIssuer',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'issuer', type: 'address' }],
    name: 'removeTrustedIssuer',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'issuer', type: 'address' }],
    name: 'isTrustedIssuer',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'offset', type: 'uint256' },
      { internalType: 'uint256', name: 'limit', type: 'uint256' },
    ],
    name: 'getTrustedIssuers',
    outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getTrustedIssuersCount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'issuer', type: 'address' },
      { indexed: true, internalType: 'address', name: 'addedBy', type: 'address' },
    ],
    name: 'IssuerAdded',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'issuer', type: 'address' },
      { indexed: true, internalType: 'address', name: 'removedBy', type: 'address' },
    ],
    name: 'IssuerRemoved',
    type: 'event',
  },
] as const

export function useDiamondTrustedIssuer() {
  const diamondAddress = (process.env.NEXT_PUBLIC_DIAMOND_ADDRESS ||
    process.env.NEXT_PUBLIC_EIP712_VERIFYING_CONTRACT) as `0x${string}` | undefined

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  // Add a new issuer
  const addTrustedIssuer = useCallback(
    async (issuerAddress: `0x${string}`) => {
      if (!diamondAddress) {
        throw new Error('Diamond address not configured')
      }

      return writeContract({
        address: diamondAddress,
        abi: TRUSTED_ISSUER_ABI,
        functionName: 'addTrustedIssuer',
        args: [issuerAddress],
      })
    },
    [diamondAddress, writeContract]
  )

  // Remove an issuer
  const removeTrustedIssuer = useCallback(
    async (issuerAddress: `0x${string}`) => {
      if (!diamondAddress) {
        throw new Error('Diamond address not configured')
      }

      return writeContract({
        address: diamondAddress,
        abi: TRUSTED_ISSUER_ABI,
        functionName: 'removeTrustedIssuer',
        args: [issuerAddress],
      })
    },
    [diamondAddress, writeContract]
  )

  return {
    addTrustedIssuer,
    removeTrustedIssuer,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
    reset,
    diamondAddress,
  }
}

// Hook to verify if an address is a trusted issuer
export function useIsTrustedIssuer(issuerAddress: string | undefined) {
  const diamondAddress = (process.env.NEXT_PUBLIC_DIAMOND_ADDRESS ||
    process.env.NEXT_PUBLIC_EIP712_VERIFYING_CONTRACT) as `0x${string}` | undefined

  const { data, isLoading, isError, refetch } = useReadContract({
    address: diamondAddress,
    abi: TRUSTED_ISSUER_ABI,
    functionName: 'isTrustedIssuer',
    args: issuerAddress ? [issuerAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!diamondAddress && !!issuerAddress,
    },
  })

  return {
    isTrusted: data as boolean | undefined,
    isLoading,
    isError,
    refetch,
  }
}

// Hook to get the total number of issuers
export function useTrustedIssuersCount() {
  const diamondAddress = (process.env.NEXT_PUBLIC_DIAMOND_ADDRESS ||
    process.env.NEXT_PUBLIC_EIP712_VERIFYING_CONTRACT) as `0x${string}` | undefined

  const { data, isLoading, isError, refetch } = useReadContract({
    address: diamondAddress,
    abi: TRUSTED_ISSUER_ABI,
    functionName: 'getTrustedIssuersCount',
    query: {
      enabled: !!diamondAddress,
    },
  })

  return {
    count: data ? Number(data) : undefined,
    isLoading,
    isError,
    refetch,
  }
}

// Hook to get paginated list of issuers from the contract
export function useTrustedIssuers(offset: number = 0, limit: number = 100) {
  const diamondAddress = (process.env.NEXT_PUBLIC_DIAMOND_ADDRESS ||
    process.env.NEXT_PUBLIC_EIP712_VERIFYING_CONTRACT) as `0x${string}` | undefined

  const { data, isLoading, isError, refetch } = useReadContract({
    address: diamondAddress,
    abi: TRUSTED_ISSUER_ABI,
    functionName: 'getTrustedIssuers',
    args: [BigInt(offset), BigInt(limit)],
    query: {
      enabled: !!diamondAddress,
    },
  })

  return {
    issuers: data as readonly `0x${string}`[] | undefined,
    isLoading,
    isError,
    refetch,
  }
}
