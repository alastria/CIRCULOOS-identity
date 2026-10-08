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
                url: '/api/v1/issue/prepare', // routes moved under /api/v1
                payload: {
                    email: 'invalid-email', // Invalid email format
                    holderAddress: 'not-an-address' // Invalid address
                }
            })

            expect(res.statusCode).toBe(400)
            // Validation errors are formatted by the global error handler
            expect(JSON.parse(res.payload).code).toBe('VALIDATION_ERROR')
        })
    })
})
