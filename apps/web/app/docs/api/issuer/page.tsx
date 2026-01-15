import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, ArrowRight } from "lucide-react"

export default function IssuerAPIPage() {
  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/docs" className="hover:text-foreground">Docs</Link>
        <span>/</span>
        <Link href="/docs/api/issuer" className="hover:text-foreground">API Reference</Link>
        <span>/</span>
        <span className="text-foreground">Issuer API</span>
      </div>

      {/* Title */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge className="bg-green-500/10 text-green-600 dark:text-green-400">
            REST API
          </Badge>
          <Badge variant="outline">Port 8001</Badge>
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Issuer API</h1>
        <p className="text-xl text-muted-foreground">
          API REST para emisión de Credenciales Verificables. Incluye autenticación 
          SIWA (Sign-In with Alastria) y gestión del flujo de emisión.
        </p>
      </div>

      {/* Base URL */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="base-url">Base URL</h2>
        <Card className="overflow-hidden">
          <CardContent className="p-4 font-mono text-sm">
            <span className="text-muted-foreground">Development:</span> http://localhost:8001/api/v1
            <br />
            <span className="text-muted-foreground">Production:</span> https://issuer.alastria.io/api/v1
          </CardContent>
        </Card>
      </section>

      {/* Authentication */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="autenticacion">Autenticación</h2>
        
        <p className="text-muted-foreground">
          El Issuer usa SIWA (Sign-In with Alastria) basado en EIP-4361 para autenticar 
          usuarios. El flujo consiste en obtener un challenge, firmarlo con MetaMask, y 
          enviarlo para obtener una sesión.
        </p>

        {/* GET /auth/challenge */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-blue-500/10 py-3 flex flex-row items-center gap-3">
            <Badge className="bg-blue-500 text-white">GET</Badge>
            <code className="text-sm">/auth/challenge/:address</code>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Obtiene un challenge (nonce) para iniciar la autenticación SIWA.
            </p>

            <Tabs defaultValue="request">
              <TabsList>
                <TabsTrigger value="request">Request</TabsTrigger>
                <TabsTrigger value="response">Response</TabsTrigger>
              </TabsList>
              <TabsContent value="request" className="mt-4">
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <pre className="p-4 text-sm overflow-x-auto">
{`GET /api/v1/auth/challenge/0x1234...abcd

URL Parameters:
  address: string (ethereum address)`}
                    </pre>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="response" className="mt-4">
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <pre className="p-4 text-sm overflow-x-auto">
{`{
  "nonce": "abc123...",
  "message": "Sign this message to authenticate...\\n\\nNonce: abc123...",
  "issuedAt": "2024-01-15T10:30:00.000Z",
  "expiresAt": "2024-01-15T10:45:00.000Z"
}`}
                    </pre>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* POST /auth/verify */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-green-500/10 py-3 flex flex-row items-center gap-3">
            <Badge className="bg-green-500 text-white">POST</Badge>
            <code className="text-sm">/auth/verify</code>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Verifica la firma del challenge y crea una sesión autenticada.
            </p>

            <Tabs defaultValue="request">
              <TabsList>
                <TabsTrigger value="request">Request</TabsTrigger>
                <TabsTrigger value="response">Response</TabsTrigger>
              </TabsList>
              <TabsContent value="request" className="mt-4">
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <pre className="p-4 text-sm overflow-x-auto">
{`POST /api/v1/auth/verify
Content-Type: application/json

{
  "address": "0x1234...abcd",
  "signature": "0x...",
  "nonce": "abc123..."
}`}
                    </pre>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="response" className="mt-4">
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <pre className="p-4 text-sm overflow-x-auto">
{`{
  "success": true,
  "address": "0x1234...abcd",
  "isTrustedIssuer": true,
  "sessionId": "sess_..."
}

// Session cookie set: alastria_session=...`}
                    </pre>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </section>

      {/* Credential Issuance */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="emision">Emisión de Credenciales</h2>

        {/* POST /credentials/prepare */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-green-500/10 py-3 flex flex-row items-center gap-3">
            <Badge className="bg-green-500 text-white">POST</Badge>
            <code className="text-sm">/credentials/prepare</code>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Prepara una credencial para ser firmada. Genera el documento VC y los datos EIP-712.
            </p>
            <Badge variant="secondary">🔒 Requiere autenticación</Badge>

            <Tabs defaultValue="request">
              <TabsList>
                <TabsTrigger value="request">Request</TabsTrigger>
                <TabsTrigger value="response">Response</TabsTrigger>
              </TabsList>
              <TabsContent value="request" className="mt-4">
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <pre className="p-4 text-sm overflow-x-auto">
{`POST /api/v1/credentials/prepare
Content-Type: application/json
Cookie: alastria_session=...

{
  "type": "UniversityDegree",
  "subjectDid": "did:ethr:0x5678...efgh",
  "claims": {
    "degreeName": "Ingeniería Informática",
    "university": "Universidad de Madrid",
    "graduationDate": "2024-06-15"
  }
}`}
                    </pre>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="response" className="mt-4">
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <pre className="p-4 text-sm overflow-x-auto">
{`{
  "credentialId": "urn:uuid:...",
  "unsignedCredential": {
    "@context": [...],
    "type": ["VerifiableCredential", "UniversityDegree"],
    "issuer": "did:ethr:0x1234...abcd",
    "credentialSubject": {...}
  },
  "eip712": {
    "domain": {...},
    "types": {...},
    "primaryType": "VerifiableCredential",
    "message": {...}
  }
}`}
                    </pre>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* POST /credentials/finalize */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-green-500/10 py-3 flex flex-row items-center gap-3">
            <Badge className="bg-green-500 text-white">POST</Badge>
            <code className="text-sm">/credentials/finalize</code>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Finaliza la credencial añadiendo la firma EIP-712 del issuer.
            </p>
            <Badge variant="secondary">🔒 Requiere autenticación</Badge>

            <Tabs defaultValue="request">
              <TabsList>
                <TabsTrigger value="request">Request</TabsTrigger>
                <TabsTrigger value="response">Response</TabsTrigger>
              </TabsList>
              <TabsContent value="request" className="mt-4">
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <pre className="p-4 text-sm overflow-x-auto">
{`POST /api/v1/credentials/finalize
Content-Type: application/json
Cookie: alastria_session=...

{
  "credentialId": "urn:uuid:...",
  "signature": "0x..." // EIP-712 signature from MetaMask
}`}
                    </pre>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="response" className="mt-4">
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <pre className="p-4 text-sm overflow-x-auto">
{`{
  "success": true,
  "credential": {
    "@context": [...],
    "type": ["VerifiableCredential", "UniversityDegree"],
    "issuer": "did:ethr:0x1234...abcd",
    "issuanceDate": "2024-01-15T10:30:00.000Z",
    "credentialSubject": {...},
    "proof": {
      "type": "EIP712Signature2021",
      "proofValue": "0x...",
      "verificationMethod": "did:ethr:0x1234...abcd#keys-1"
    }
  },
  "deliveryToken": "tok_..." // Token para entregar al holder
}`}
                    </pre>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </section>

      {/* Credential Management */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="gestion">Gestión de Credenciales</h2>

        {/* GET /credentials */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-blue-500/10 py-3 flex flex-row items-center gap-3">
            <Badge className="bg-blue-500 text-white">GET</Badge>
            <code className="text-sm">/credentials</code>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Lista las credenciales emitidas por el issuer autenticado.
            </p>
            <Badge variant="secondary">🔒 Requiere autenticación</Badge>

            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <pre className="p-4 text-sm overflow-x-auto">
{`GET /api/v1/credentials?page=1&limit=10&status=active

Response:
{
  "credentials": [...],
  "total": 42,
  "page": 1,
  "limit": 10
}`}
                </pre>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        {/* POST /credentials/:id/revoke */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-red-500/10 py-3 flex flex-row items-center gap-3">
            <Badge className="bg-red-500 text-white">POST</Badge>
            <code className="text-sm">/credentials/:id/revoke</code>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Revoca una credencial. Actualiza el estado on-chain en CredentialStatusFacet.
            </p>
            <Badge variant="secondary">🔒 Requiere autenticación</Badge>

            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <pre className="p-4 text-sm overflow-x-auto">
{`POST /api/v1/credentials/urn:uuid:.../revoke
Content-Type: application/json

{
  "reason": "Credential superseded by new version"
}

Response:
{
  "success": true,
  "txHash": "0x...",
  "status": "revoked"
}`}
                </pre>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </section>

      {/* Error Responses */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="errores">Códigos de Error</h2>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-4 font-medium">Código</th>
                <th className="text-left py-2 px-4 font-medium">Significado</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2 px-4"><Badge variant="secondary">400</Badge></td>
                <td className="py-2 px-4 text-muted-foreground">Bad Request - Parámetros inválidos</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4"><Badge variant="secondary">401</Badge></td>
                <td className="py-2 px-4 text-muted-foreground">Unauthorized - No autenticado</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4"><Badge variant="secondary">403</Badge></td>
                <td className="py-2 px-4 text-muted-foreground">Forbidden - No es Trusted Issuer</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4"><Badge variant="secondary">404</Badge></td>
                <td className="py-2 px-4 text-muted-foreground">Not Found - Recurso no existe</td>
              </tr>
              <tr>
                <td className="py-2 px-4"><Badge variant="secondary">500</Badge></td>
                <td className="py-2 px-4 text-muted-foreground">Internal Error - Error del servidor</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-8 border-t">
        <Link 
          href="/docs/backend/blockchain-sync" 
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Blockchain Sync
        </Link>
        <Link 
          href="/docs/api/verifier" 
          className="flex items-center gap-2 text-primary hover:underline"
        >
          Verifier API
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
