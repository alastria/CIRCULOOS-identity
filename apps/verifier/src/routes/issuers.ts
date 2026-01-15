import { FastifyPluginAsync } from "fastify"

const issuersRoutes: FastifyPluginAsync = async (server) => {
  server.get('/db-status', {
    schema: { tags: ["issuers"], response: { 200: { type: "object", additionalProperties: true }, 503: { type: "object", properties: { ok: { type: "boolean" }, error: { type: "string" } } } } },
  }, async (request, reply) => {
    const svc = (server as any).trustedIssuerRegistry
    if (!svc) return reply.status(503).send({ ok: false, error: 'trusted registry service not configured' })
    try {
      // if sqlStore available, return file path and row count
      if (svc.sqlStore && typeof svc.sqlStore.list === 'function') {
        const rows = svc.sqlStore.list(true)
        return { ok: true, db: true, path: svc.sqlStore?.db?.name || null, rows: rows.length }
      }
    } catch (err) {
      // ignore
    }
    return { ok: true, db: false }
  })
  server.get('/', {
    schema: { tags: ["issuers"], response: { 200: { type: "object", properties: { ok: { type: "boolean" }, issuers: { type: "array", items: { type: "object", additionalProperties: true } } } }, 503: { type: "object", properties: { ok: { type: "boolean" }, error: { type: "string" } } } } },
  }, async (request, reply) => {
    const svc = (server as any).trustedIssuerRegistry
    if (!svc) {
      return reply.status(503).send({ ok: false, error: 'trusted registry service not configured' })
    }
    const issuers = await (svc as any).listIssuers({ includeRemoved: false })
    return { ok: true, issuers }
  })

  server.post('/refresh', {
    schema: {
      tags: ["issuers"],
      querystring: {
        type: "object",
        properties: { fromBlock: { type: "number" }, force: { type: "string" } },
      },
      response: { 200: { type: "object", properties: { ok: { type: "boolean" }, issuers: { type: "array", items: { type: "object", additionalProperties: true } } } }, 503: { type: "object", properties: { ok: { type: "boolean" }, error: { type: "string" } } } },
    },
  }, async (request, reply) => {
    const svc = (server as any).trustedIssuerRegistry
    if (!svc) {
      return reply.status(503).send({ ok: false, error: 'trusted registry service not configured' })
    }
    // allow callers to force a full resync or specify a fromBlock
    const qb: any = request.query
    const fromBlock = qb.fromBlock ? Number(qb.fromBlock) : undefined
    const force = qb.force === '1' || qb.force === 'true'
    await (svc as any).sync(force ? 0 : fromBlock)
    const issuers = await (svc as any).listIssuers({ includeRemoved: false })
    return { ok: true, issuers }
  })
}

export default issuersRoutes
