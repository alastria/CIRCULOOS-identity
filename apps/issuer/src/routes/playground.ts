import { FastifyPluginAsync } from "fastify"
import { IssuanceService } from "../services/issuanceService"
import { hashVC, getSentEmails, clearSent } from "@circuloos/common"
import { ethers } from "ethers"
import CredentialRegistryAbi from "../../abi/CredentialRegistry.json"
import { config } from '../config'

type PlaygroundOpts = {
  storage?: any
}

const playgroundRoutes: FastifyPluginAsync = async (server, opts: PlaygroundOpts) => {
  const storage = (opts as any).storage || (server as any).storage
  const svc = new IssuanceService({ storage, hmacSecret: config.issuer.hmacSecret })

  // return a prepared VC and the calldata to call recordIssuance(vcHash) without sending tx
  server.post('/issue-preview', {
    schema: {
      tags: ["playground"],
      summary: "Prepare draft VC and calldata (no tx)",
      body: {
        type: "object",
        required: ["holderAddress"],
        properties: {
          email: { type: "string", format: "email" },
          holderAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
          companyName: { type: "string" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            vc: { type: "object" },
            vcHash: { type: "string" },
            calldata: { type: ["object", "null"] },
          },
        },
      },
    },
  }, async (request, reply) => {
    const body: any = request.body as any
    const to = body?.email || 'playground@example.test'
    const holderAddress = body?.holderAddress
    const companyName = body?.companyName

    const prepared = await svc.prepare(to, holderAddress, companyName)
    const id = prepared?.id
    if (!id) return reply.status(500).send({ error: 'failed to prepare issuance' })
    // load stored draft
    const rec = await storage.loadIssuance(id)
    const vc = rec?.draft
    if (!vc) return reply.status(500).send({ error: 'failed to load draft' })

    const vcHash = hashVC(vc)

    // prepare calldata for CredentialRegistry.recordIssuance(bytes32 vcHash, address subject)
    const credentialRegistryAddress = config.diamond?.address
    let calldata = null
    if (credentialRegistryAddress) {
      try {
        const provider = new ethers.providers.JsonRpcProvider(config.blockchain.rpcUrl)
        const contract = new ethers.Contract(credentialRegistryAddress, CredentialRegistryAbi, provider)
        const subjectAddr = vc.credentialSubject?.holderAddress || ethers.constants.AddressZero
        calldata = await contract.populateTransaction.recordIssuance(vcHash, subjectAddr)
      } catch (err) {
        server.log.warn({ err }, 'failed to populate issuance tx')
      }
    }

    return { ok: true, vc, vcHash, calldata }
  })

  // optional: server-anchor (development only) - send tx from server signer if configured
  server.post('/issue-anchor', {
    schema: {
      tags: ["playground"],
      summary: "Record issuance on-chain (dev-only)",
      body: { type: "object", properties: { vc: { type: "object" } } },
      response: { 200: { type: "object", properties: { ok: { type: "boolean" }, vcHash: { type: "string" }, txHash: { type: "string" } } } },
    },
  }, async (request, reply) => {
    if (config.nodeEnv !== 'development') return reply.status(403).send({ error: 'forbidden' })
    const body: any = request.body as any
    const vc = body?.vc
    if (!vc) return reply.status(400).send({ error: 'missing vc' })
    const vcHash = hashVC(vc)
    const credentialRegistryAddress = config.diamond?.address
    const rpcUrl = config.blockchain.rpcUrl
    const signerKey = config.issuer.privateKey
    if (!credentialRegistryAddress || !rpcUrl || !signerKey) return reply.status(500).send({ error: 'credential registry or signer not configured' })
    try {
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
      const signer = new ethers.Wallet(signerKey, provider)
      const contract = new ethers.Contract(credentialRegistryAddress, CredentialRegistryAbi, signer)
      const subjectAddr = vc.credentialSubject?.holderAddress || ethers.constants.AddressZero
      const tx = await contract.recordIssuance(vcHash, subjectAddr)
      const receipt = await tx.wait()
      return { ok: true, vcHash, txHash: receipt.transactionHash }
    } catch (err: any) { server.log.error(err); return reply.status(500).send({ error: String(err) }) }
  })

  // Email testing endpoints (development/testing only - route is not registered in production)
  // Double-check for safety, but this should never be called in production
  server.get('/emails', {
    schema: {
      tags: ["playground"],
      summary: "Get all sent emails (EmailMock - dev only)",
      description: "Returns all emails sent via EmailMock. Only available in development/testing mode.",
      response: {
        200: {
          type: "object",
          properties: {
            emails: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  to: { type: "string" },
                  subject: { type: "string" },
                  body: { type: "string" },
                },
              },
            },
            count: { type: "number" },
          },
        },
        403: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    // Safety check (should never happen since route is not registered in production)
    if (config.nodeEnv === 'production') {
      return reply.status(403).send({ error: 'This endpoint is not available in production' })
    }
    const emails = getSentEmails()
    return { emails, count: emails.length }
  })

  server.delete('/emails', {
    schema: {
      tags: ["playground"],
      summary: "Clear all sent emails (EmailMock - dev only)",
      description: "Clears the EmailMock inbox. Only available in development/testing mode.",
      response: {
        200: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            message: { type: "string" },
          },
        },
        403: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  }, async (request, reply) => {
    // Safety check (should never happen since route is not registered in production)
    if (config.nodeEnv === 'production') {
      return reply.status(403).send({ error: 'This endpoint is not available in production' })
    }
    clearSent()
    return { ok: true, message: 'Email inbox cleared' }
  })
}

export default playgroundRoutes
