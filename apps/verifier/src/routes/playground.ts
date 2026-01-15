import { FastifyPluginAsync } from 'fastify'
import { verifySignedCredential, hashVC } from '@circuloos/common'

const playground: FastifyPluginAsync = async (server, opts) => {
  server.post('/verify', async (request, reply) => {
    const body: any = request.body as any
    const signed = body
    if (!signed || !signed.vc || !signed.issuerProof) return reply.status(400).send({ ok: false, error: 'missing issuer proof' })

    const result = verifySignedCredential(signed)
    let issuerResult = result.issuer
    const holderResult = result.holder
    const initialOk = issuerResult.ok && (holderResult ? holderResult.ok : true)
    if (!initialOk) return reply.status(400).send({ ok: initialOk, issuer: issuerResult, holder: holderResult })

    try {
      const onchain = (server as any).onchainService
      if (onchain) {
        const vcHash = hashVC(signed.vc)
        const issued = await onchain.isIssued(vcHash)
        const revoked = await onchain.isRevoked(vcHash)
        return reply.send({ ok: true, issuer: issuerResult, holder: holderResult, onchain: { issued, revoked, vcHash } })
      }
    } catch (err:any) {
      server.log.error(err)
      return reply.status(502).send({ ok: false, error: 'failed to query onchain service' })
    }

    return reply.send({ ok: true, issuer: issuerResult, holder: holderResult })
  })
}

export default playground
