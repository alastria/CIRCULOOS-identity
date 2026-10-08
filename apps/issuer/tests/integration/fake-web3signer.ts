/**
 * A fake Web3Signer for tests: a real HTTP JSON-RPC server that implements
 * eth_signTransaction with keys it holds, like the real Web3Signer does with its keystores.
 */
import * as http from 'http'
import { AddressInfo } from 'net'
import { BigNumber, Wallet } from 'ethers'

export interface FakeWeb3Signer {
  url: string
  /** Every eth_signTransaction request received, in order. */
  requests: any[]
  stop(): Promise<void>
}

export async function startFakeWeb3Signer(keys: Wallet[]): Promise<FakeWeb3Signer> {
  const byAddress = new Map(keys.map((k) => [k.address.toLowerCase(), k]))
  const requests: any[] = []
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', async () => {
      const rpc = JSON.parse(body)
      const reply = (payload: any) => res.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, ...payload }))
      if (rpc.method !== 'eth_signTransaction') return reply({ error: { code: -32601, message: 'method not found' } })
      requests.push(rpc)
      const p = rpc.params[0]
      const key = byAddress.get(String(p.from).toLowerCase())
      if (!key) return reply({ error: { code: -32000, message: 'unknown account' } })
      reply({
        result: await key.signTransaction({
          to: p.to,
          data: p.data,
          value: p.value,
          gasLimit: p.gas,
          gasPrice: p.gasPrice,
          maxFeePerGas: p.maxFeePerGas,
          maxPriorityFeePerGas: p.maxPriorityFeePerGas,
          type: p.maxFeePerGas ? 2 : undefined,
          nonce: p.nonce !== undefined ? BigNumber.from(p.nonce).toNumber() : undefined,
          chainId: BigNumber.from(p.chainId).toNumber(),
        }),
      })
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    requests,
    stop: () => new Promise((r) => server.close(() => r())),
  }
}
