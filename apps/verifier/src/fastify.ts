// runtime shim for the type declaration file `fastify.d.ts`.
// Some dev tooling may `require('../fastify')` at runtime; this module is a noop export
// so Node can load it without touching the `.d.ts` file.
export {}
