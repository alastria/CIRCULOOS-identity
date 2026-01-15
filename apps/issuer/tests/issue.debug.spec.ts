import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import server from '../src/index'

describe('Issue Prepare Error Coverage', () => {
    let origEnv: any

    beforeEach(() => {
        origEnv = { ...process.env }
    })

    afterEach(async () => {
        process.env = origEnv
    })

    describe('/issue/prepare error handling', () => {
        it('handles validation errors gracefully', async () => {
            const res = await server.inject({
                method: 'POST',
                url: '/issue/prepare',
                payload: {
                    email: 'invalid-email', // Invalid email format
                    holderAddress: 'not-an-address' // Invalid address
                }
            })

            expect(res.statusCode).toBe(400)
            expect(JSON.parse(res.payload)).toHaveProperty('error')
        })
    })
})
