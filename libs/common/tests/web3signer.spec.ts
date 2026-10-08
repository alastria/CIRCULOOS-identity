/**
 * Web3SignerSigner (plan A4, gap G2): on-chain writes signed by a Web3Signer instance
 * (eth_signTransaction over JSON-RPC) instead of a raw private key in the environment.
 * Exercised against a fake Web3Signer: a real HTTP JSON-RPC server holding a test key.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as http from 'http'
import { AddressInfo } from 'net'
import { Wallet, utils, BigNumber } from 'ethers'
import { Web3SignerSigner } from '../src/web3signer'

const key = new Wallet('0x' + 'e5'.repeat(32))

describe('Web3SignerSigner', () => {
  let server: http.Server
  let url: string
  const requests: any[] = []

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', async () => {
        const rpc = JSON.parse(body)
        requests.push(rpc)
        const reply = (payload: any) => res.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, ...payload }))
        if (rpc.method !== 'eth_signTransaction') return reply({ error: { code: -32601, message: 'method not found' } })
        const p = rpc.params[0]
        if (p.from.toLowerCase() !== key.address.toLowerCase()) return reply({ error: { code: -32000, message: 'unknown account' } })
        const raw = await key.signTransaction({
          to: p.to,
          data: p.data,
          value: p.value,
          gasLimit: p.gas,
          gasPrice: p.gasPrice,
          nonce: p.nonce !== undefined ? BigNumber.from(p.nonce).toNumber() : undefined,
          chainId: BigNumber.from(p.chainId).toNumber(),
        })
        reply({ result: raw })
      })
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await new Promise((r) => server.close(r))
  })

  it('getAddress returns the configured address without contacting Web3Signer', async () => {
    const before = requests.length
    expect(await new Web3SignerSigner(url, key.address).getAddress()).toBe(key.address)
    expect(requests.length).toBe(before)
  })

  it('signTransaction sends eth_signTransaction with the transaction fields and returns a tx signed by that key', async () => {
    const signer = new Web3SignerSigner(url, key.address)
    const tx = { to: '0x' + '12'.repeat(20), data: '0xabcdef', gasLimit: 210_000, gasPrice: 0, nonce: 7, chainId: 2020 }

    const raw = await signer.signTransaction(tx)

    const parsed = utils.parseTransaction(raw)
    expect(parsed.from).toBe(key.address)
    expect(parsed.chainId).toBe(2020)
    expect(parsed.nonce).toBe(7)
    expect(parsed.gasLimit.toNumber()).toBe(210_000)
    const sent = requests.at(-1).params[0]
    expect(sent).toMatchObject({ from: key.address, to: tx.to, data: '0xabcdef', gas: '0x33450', gasPrice: '0x0', nonce: '0x7', chainId: '0x7e4' })
  })

  it('propagates a Web3Signer error instead of returning nothing', async () => {
    const stranger = new Wallet('0x' + 'f6'.repeat(32))
    await expect(new Web3SignerSigner(url, stranger.address).signTransaction({ to: key.address, gasLimit: 21000, gasPrice: 0, nonce: 0, chainId: 2020 })).rejects.toThrow(
      /unknown account/,
    )
  })

  it('refuses to sign messages or typed data (only transactions are delegated to Web3Signer)', async () => {
    const signer = new Web3SignerSigner(url, key.address)
    await expect(signer.signMessage('hi')).rejects.toThrow(/not implemented/)
    await expect(signer._signTypedData({}, {}, {})).rejects.toThrow(/not implemented/)
  })

  it('rejects an invalid address at construction', () => {
    expect(() => new Web3SignerSigner(url, 'not-an-address')).toThrow(/address/)
  })
})
