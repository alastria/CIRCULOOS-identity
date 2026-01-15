declare module '@circuloos/issuer-server' {
  // Minimal ambient declaration used during build to avoid resolving the issuer's runtime
  // module. The actual runtime module is provided by the built `apps/issuer` package.
  const issuerServer: any
  export default issuerServer
}
