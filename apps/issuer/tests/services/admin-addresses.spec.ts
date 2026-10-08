/**
 * Plan A4 (D2): the Diamond owner key lives in Web3Signer and cannot log in with MetaMask,
 * so admins of the issuer web are an explicit list of human wallets (ADMIN_ADDRESSES).
 * The legacy rule (address derived from the configured private key) is kept for development.
 */
import { describe, it, expect } from 'vitest'
import { Wallet } from 'ethers'
import { adminAddresses } from '../../src/services/admin'

describe('adminAddresses', () => {
  it('includes the configured ADMIN_ADDRESSES, normalised', () => {
    const a = '0x' + 'AB'.repeat(20)
    const b = '0x' + 'cd'.repeat(20)
    expect(adminAddresses({ adminAddresses: [a, ` ${b} `] })).toEqual([a.toLowerCase(), b])
  })

  it('keeps the address derived from a configured private key (development)', () => {
    const key = new Wallet('0x' + '0f'.repeat(32))
    expect(adminAddresses({ privateKey: key.privateKey })).toEqual([key.address.toLowerCase()])
  })

  it('ignores invalid entries instead of granting admin to them', () => {
    expect(adminAddresses({ adminAddresses: ['not-an-address', ''], privateKey: 'garbage' })).toEqual([])
  })
})
