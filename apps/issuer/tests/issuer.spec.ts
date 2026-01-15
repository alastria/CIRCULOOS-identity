import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import server from '../src/index'

describe('issuer app', () => {
  console.log('[TEST] issuer app')
  beforeAll(async () => {
    // start server in test mode on random port
    await server.listen({ port: 0 })
  })

  afterAll(async () => {
    await server.close()
  })

  it('health', async () => {
    const res = await server.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload)).toEqual({ ok: true })
  })
})
