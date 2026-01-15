import { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'

export function globalErrorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) {
    const reqId = request.id

    // 1. Validation Errors (Fastify Schema Validation)
    if ((error as FastifyError).validation) {
        return reply.status(400).send({
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: (error as FastifyError).validation,
            reqId
        })
    }

    // 2. Zod Validation Errors (Manual validation)
    if (error instanceof ZodError) {
        return reply.status(400).send({
            code: 'VALIDATION_ERROR',
            message: 'Invalid data format',
            details: (error as any).errors.map((e: any) => ({
                path: e.path.join('.'),
                message: e.message
            })),
            reqId
        })
    }

    // 3. JWT / Auth Errors
    const errCode = (error as any).code
    if (errCode === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER' ||
        errCode === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED' ||
        errCode === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID') {
        return reply.status(401).send({
            code: 'UNAUTHORIZED',
            message: 'Authentication failed or token expired',
            reqId
        })
    }

    // 4. Rate Limit Errors
    if ((error as any).statusCode === 429) {
        return reply.status(429).send({
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later',
            retryAfter: (error as any).headers?.['retry-after'],
            reqId
        })
    }

    // 5. Not Found (if thrown manually)
    if ((error as any).statusCode === 404) {
        return reply.status(404).send({
            code: 'NOT_FOUND',
            message: error.message || 'Resource not found',
            reqId
        })
    }

    // 6. Unexpected Errors
    // Log the full error with stack trace for debugging
    request.log.error({ err: error, reqId }, ' Unexpected error occurred')

    // Return generic error to client to avoid leaking sensitive info
    return reply.status(500).send({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An internal server error occurred',
        reqId
    })
}
