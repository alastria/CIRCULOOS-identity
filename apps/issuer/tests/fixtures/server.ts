import Fastify from "fastify"
import cors from "@fastify/cors"
import swagger from "@fastify/swagger"
import swaggerUI from "@fastify/swagger-ui"
import { SqlJsStorageAdapter, EmailMock } from '@circuloos/common'
import issueRoutes from '../../src/routes/issue'
import playgroundRoutes from '../../src/routes/playground'
import { IssueController } from '../../src/controllers/issueController'
import { IssuanceService } from '../../src/services/issuanceService'
import { IssuanceRepository } from '../../src/repositories/issuanceRepository'
import { authService } from '../../src/services/authService'
import { PDFService } from '../../src/services/pdf.service'

export function createTestServer() {
    try {
        const server = Fastify({ logger: false }) // Disable logging in tests

        // enable CORS
        server.register(cors, { origin: true })

        // Swagger
        const swaggerEnabled = process.env.SWAGGER_ENABLED !== "false"
        if (swaggerEnabled) {
            server.register(swagger, {
                openapi: {
                    info: {
                        title: "Circuloos Issuer API",
                        description: "Credential issuance endpoints",
                        version: "0.0.0",
                    },
                    tags: [
                        { name: "health" },
                        { name: "issue" },
                        { name: "storage" },
                        { name: "playground" },
                    ],
                },
            })
            server.register(swaggerUI, {
                routePrefix: "/docs",
            })
        }

        // Use in-memory SQLite for tests
        const storage = new SqlJsStorageAdapter(':memory:')

        // Initialize stack
        const issuanceRepository = new IssuanceRepository(storage)
        const issuanceService = new IssuanceService({
            storage,
            emailSender: EmailMock,
            hmacSecret: 'test-secret',
            otpExpirySeconds: 3600
        })
        const pdfService = new PDFService()

        const issueController = new IssueController(
            issuanceService,
            authService,
            pdfService,
            issuanceRepository,
            storage
        )

        // Storage routes (legacy helpers adapted for tests)
        server.get('/tmp-filestore/vcs/:id', async (request, reply) => {
            const rawId = (request.params as any).id as string
            const id = rawId.replace('.json', '')
            try {
                const vc = await storage.loadVC(id)
                if (!vc) {
                    return reply.code(404).send({ error: 'VC not found' })
                }
                return reply.code(200).send(vc)
            } catch (err: any) {
                return reply.code(500).send({ error: 'internal' })
            }
        })

        server.get('/tmp-filestore/issuances/:id', async (request, reply) => {
            const rawId = (request.params as any).id as string
            const id = rawId.replace('.json', '')
            try {
                const rec = await storage.loadIssuance(id)
                if (!rec) {
                    return reply.code(404).send({ error: 'not found' })
                }
                return reply.code(200).send(rec)
            } catch (err: any) {
                return reply.code(500).send({ error: 'internal' })
            }
        })

        server.get('/health', async () => ({ ok: true }))

        // Decorations
        server.decorate('storage', storage) // Changed from 'store' to 'storage' to match app
        server.decorate('store', storage)   // Keep 'store' for backward compatibility in tests if needed
        server.decorate('emailSender', EmailMock)

        server.register(issueRoutes, { prefix: '/issue', issueController } as any)
        server.register(playgroundRoutes, { prefix: '/playground' })

        return server
    } catch (err) {
        console.error('Failed to create test server:', err)
        throw err
    }
}
