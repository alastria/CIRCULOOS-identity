import { FastifyInstance } from "fastify"
import { HybridCredentialService } from "../services/hybridCredentialService"

type HybridEnabledServer = FastifyInstance & {
  hybridCredentialService?: HybridCredentialService
}

export default async function hybridRoutes(server: FastifyInstance) {
  const hybridServer = server as HybridEnabledServer
  // Get hybrid credential service stats
  hybridServer.get('/stats', {
    schema: { tags: ["hybrid"], response: { 200: { type: "object", additionalProperties: true } } },
  }, async () => {
    if (!hybridServer.hybridCredentialService) {
      return { error: 'Hybrid credential service not available' }
    }

    return await hybridServer.hybridCredentialService.getStats()
  })

  // Get credential by hash from hybrid storage
  hybridServer.get('/credential/:vcHash', {
    schema: {
      tags: ["hybrid"],
      params: { type: "object", properties: { vcHash: { type: "string" } }, required: ["vcHash"] },
      response: { 200: { type: ["object", "null"] } },
    },
  }, async (request: any) => {
    if (!hybridServer.hybridCredentialService) {
      return { error: 'Hybrid credential service not available' }
    }

    const { vcHash } = request.params
    return await hybridServer.hybridCredentialService.getCredentialByHash(vcHash)
  })

  // Check if credential is revoked using hybrid data
  hybridServer.get('/credential/:vcHash/revoked', {
    schema: {
      tags: ["hybrid"],
      params: { type: "object", properties: { vcHash: { type: "string" } }, required: ["vcHash"] },
      response: { 200: { type: "object", properties: { revoked: { type: "boolean" }, revocation: { type: ["object", "null"] } } } },
    },
  }, async (request: any) => {
    if (!hybridServer.hybridCredentialService) {
      return { error: 'Hybrid credential service not available' }
    }

    const { vcHash } = request.params
    const revocation = await hybridServer.hybridCredentialService.getRevocationByHash(vcHash)
    
    return {
      revoked: !!revocation,
      revocation: revocation || null
    }
  })

  // Verify W3C compliance with hybrid approach
  hybridServer.post('/verify-w3c', {
    schema: {
      tags: ["hybrid"],
      body: { type: "object", required: ["signedCredential"], properties: { signedCredential: { type: "object" } } },
      response: { 200: { type: "object", additionalProperties: true } },
    },
  }, async (request: any) => {
    if (!hybridServer.hybridCredentialService) {
      return { error: 'Hybrid credential service not available' }
    }

    const { signedCredential } = request.body
    if (!signedCredential) {
      return { error: 'signedCredential is required' }
    }

    return await hybridServer.hybridCredentialService.verifyCredentialCompliance(signedCredential)
  })

  // Get credentials by subject address
  hybridServer.get('/subject/:address/credentials', {
    schema: {
      tags: ["hybrid"],
      params: { type: "object", properties: { address: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" } }, required: ["address"] },
      response: { 200: { type: "array", items: { type: "object" } } },
    },
  }, async (request: any) => {
    if (!hybridServer.hybridCredentialService) {
      return { error: 'Hybrid credential service not available' }
    }

    const { address } = request.params
    return await hybridServer.hybridCredentialService.getCredentialsBySubject(address)
  })

  // Get credentials by issuer address  
  hybridServer.get('/issuer/:address/credentials', {
    schema: {
      tags: ["hybrid"],
      params: { type: "object", properties: { address: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" } }, required: ["address"] },
      response: { 200: { type: "array", items: { type: "object" } } },
    },
  }, async (request: any) => {
    if (!hybridServer.hybridCredentialService) {
      return { error: 'Hybrid credential service not available' }
    }

    const { address } = request.params
    return await hybridServer.hybridCredentialService.getCredentialsByIssuer(address)
  })

  // Force resync from blockchain (admin endpoint)
  hybridServer.post('/admin/resync', {
    schema: {
      tags: ["hybrid"],
      response: { 200: { type: "object", properties: { message: { type: "string" }, stats: { type: "object" } } }, 500: { type: "object", properties: { error: { type: "string" }, details: { type: "string" } } } },
    },
  }, async (request: any) => {
    if (!hybridServer.hybridCredentialService) {
      return { error: 'Hybrid credential service not available' }
    }

    try {
      await hybridServer.hybridCredentialService.syncCredentialEvents(0) // Force from block 0
      await hybridServer.hybridCredentialService.syncRevocationEvents(0)
      
      return { 
        message: 'Resync completed successfully',
        stats: await hybridServer.hybridCredentialService.getStats()
      }
    } catch (err: any) {
      return { error: 'Resync failed', details: err.message }
    }
  })

  // Health check for hybrid system
  hybridServer.get('/health', {
    schema: { tags: ["hybrid"], response: { 200: { type: "object", additionalProperties: true } } },
  }, async () => {
    if (!hybridServer.hybridCredentialService) {
      return { 
        status: 'error', 
        message: 'Hybrid credential service not available' 
      }
    }

    const stats = await hybridServer.hybridCredentialService.getStats()
    
    return {
      status: 'ok',
      hybridSystemActive: true,
      w3cCompliant: true,
      indexingStatus: stats.indexingStatus,
      totalCredentials: stats.totalCredentials,
      totalRevocations: stats.totalRevocations
    }
  })
}
