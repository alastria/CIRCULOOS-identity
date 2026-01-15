/// <reference types="vitest" />
import { verifyTypedDataWithFallback, buildEip712Domain } from '../src/eip712'
import { Wallet } from 'ethers'

describe('eip712 verifyTypedDataWithFallback', () => {
  console.log('[TEST] common eip712 tests')
  it('verifies typed data signed by a wallet', async () => {
    const wallet = Wallet.createRandom()
    const domain = buildEip712Domain('TestDomain', '1', 31337, '0x0000000000000000000000000000000000000000')
    const types = {
      Person: [
        { name: 'name', type: 'string' }
      ]
    }
    const value = { name: 'Alice' }
    const signature = await wallet._signTypedData(domain as any, types as any, value as any)
    const ok = await verifyTypedDataWithFallback(domain, types, value, signature, wallet.address)
    expect(ok).toBe(true)
  })
})
