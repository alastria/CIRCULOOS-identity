import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import issuersRoutes from '../src/routes/issuers'

const sampleIssuer = {
  address: '0x1111000000000000000000000000000000000000',
  ensName: 'issuer.example',
  addedAtBlock: 10,
  addedBy: '0x2222000000000000000000000000000000000000',
  addedTxHash: '0xabc',
}

describe('issuers routes', () => {
let server: any

beforeEach(() => {
  server = Fastify()
})

  it('returns 503 when service is not configured', async () => {
  await server.register(issuersRoutes, { prefix: '/issuers' })
  const res = await server.inject({ method: 'GET', url: '/issuers' })
    expect(res.statusCode).toBe(503)
  })

  it('returns issuers when service is available', async () => {
    const listIssuers = vi.fn().mockResolvedValue([sampleIssuer])
    const sync = vi.fn()
    server.decorate('trustedIssuerRegistry', { listIssuers, sync })
    await server.register(issuersRoutes, { prefix: '/issuers' })

    const res = await server.inject({ method: 'GET', url: '/issuers' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.ok).toBe(true)
    expect(body.issuers).toHaveLength(1)
    expect(listIssuers).toHaveBeenCalled()

    const refresh = await server.inject({ method: 'POST', url: '/issuers/refresh' })
    expect(refresh.statusCode).toBe(200)
    expect(sync).toHaveBeenCalled()
  })
})
