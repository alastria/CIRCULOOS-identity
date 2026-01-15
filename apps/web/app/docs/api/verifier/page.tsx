import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, ArrowRight, Shield, CheckCircle, AlertTriangle } from "lucide-react"

export default function VerifierAPIPage() {
  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/docs" className="hover:text-foreground">Docs</Link>
        <span>/</span>
        <Link href="/docs/api/verifier" className="hover:text-foreground">API Reference</Link>
        <span>/</span>
        <span className="text-foreground">Verifier API</span>
      </div>

      {/* Title */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400">
            REST API
          </Badge>
          <Badge variant="outline">Port 8002</Badge>
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Verifier API</h1>
        <p className="text-xl text-muted-foreground">
          API REST para verificación de Credenciales y Presentaciones Verificables. 
          Incluye verificación on-chain de firmas y estados de revocación.
        </p>
      </div>

      {/* Base URL */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="base-url">Base URL</h2>
        <Card className="overflow-hidden">
          <CardContent className="p-4 font-mono text-sm">
            <span className="text-muted-foreground">Development:</span> http://localhost:8002/api/v1
            <br />
            <span className="text-muted-foreground">Production:</span> https://verifier.alastria.io/api/v1
          </CardContent>
        </Card>
      </section>

      {/* Verification Overview */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="proceso">Proceso de Verificación</h2>
        
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center mb-2">
                <span className="text-green-600 dark:text-green-400 font-bold">1</span>
              </div>
              <CardTitle className="text-base">Verificar Firma</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Recuperar dirección del firmante de la firma EIP-712.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center mb-2">
                <span className="text-blue-600 dark:text-blue-400 font-bold">2</span>
              </div>
              <CardTitle className="text-base">Verificar Issuer</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Comprobar que el firmante es un Trusted Issuer on-chain.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center mb-2">
                <span className="text-purple-600 dark:text-purple-400 font-bold">3</span>
              </div>
              <CardTitle className="text-base">Verificar Estado</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Comprobar que la credencial no está revocada on-chain.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Credential Verification */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="credentials">Verificación de Credenciales</h2>

        {/* POST /verify/credential */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-green-500/10 py-3 flex flex-row items-center gap-3">
            <Badge className="bg-green-500 text-white">POST</Badge>
            <code className="text-sm">/verify/credential</code>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Verifica una Credencial Verificable completa con su firma EIP-712.
            </p>

            <Tabs defaultValue="request">
              <TabsList>
                <TabsTrigger value="request">Request</TabsTrigger>
                <TabsTrigger value="response-ok">✅ Valid</TabsTrigger>
                <TabsTrigger value="response-invalid">❌ Invalid</TabsTrigger>
              </TabsList>
              <TabsContent value="request" className="mt-4">
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <pre className="p-4 text-sm overflow-x-auto">
{`POST /api/v1/verify/credential
Content-Type: application/json

{
  "credential": {
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://alastria.io/credentials/v1"
    ],
    "type": ["VerifiableCredential", "UniversityDegree"],
    "issuer": "did:ethr:0x1234...abcd",
    "issuanceDate": "2024-01-15T10:30:00.000Z",
    "credentialSubject": {
      "id": "did:ethr:0x5678...efgh",
      "degreeName": "Ingeniería Informática",
      "university": "Universidad de Madrid"
    },
    "proof": {
      "type": "EIP712Signature2021",
      "proofValue": "0x...",
      "verificationMethod": "did:ethr:0x1234...abcd#keys-1"
    }
  }
}`}
                    </pre>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="response-ok" className="mt-4">
                <Card className="overflow-hidden border-green-500/30">
                  <CardContent className="p-0">
                    <pre className="p-4 text-sm overflow-x-auto">
{`{
  "valid": true,
  "checks": {
    "signature": {
      "valid": true,
      "signer": "0x1234...abcd"
    },
    "issuer": {
      "valid": true,
      "isTrustedIssuer": true,
      "name": "Universidad de Madrid"
    },
    "status": {
      "valid": true,
      "revoked": false
    },
    "expiration": {
      "valid": true,
      "expirationDate": null
    }
  },
  "credential": {...}
}`}
                    </pre>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="response-invalid" className="mt-4">
                <Card className="overflow-hidden border-red-500/30">
                  <CardContent className="p-0">
                    <pre className="p-4 text-sm overflow-x-auto">
{`{
  "valid": false,
  "checks": {
    "signature": {
      "valid": true,
      "signer": "0x1234...abcd"
    },
    "issuer": {
      "valid": false,
      "isTrustedIssuer": false,
      "error": "Issuer not in Trusted Issuer Registry"
    },
    "status": {
      "valid": false,
      "revoked": true,
      "revokedAt": "2024-02-01T15:00:00.000Z"
    }
  },
  "errors": [
    "Issuer is not a Trusted Issuer",
    "Credential has been revoked"
  ]
}`}
                    </pre>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </section>

      {/* Presentation Verification */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="presentations">Verificación de Presentaciones</h2>

        {/* POST /verify/presentation */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-green-500/10 py-3 flex flex-row items-center gap-3">
            <Badge className="bg-green-500 text-white">POST</Badge>
            <code className="text-sm">/verify/presentation</code>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Verifica una Verifiable Presentation (VP) que contiene una o más credenciales.
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
{`POST /api/v1/verify/presentation
Content-Type: application/json

{
  "presentation": {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    "type": ["VerifiablePresentation"],
    "holder": "did:ethr:0x5678...efgh",
    "verifiableCredential": [
      { ... } // Credencial(es) verificable(s)
    ],
    "proof": {
      "type": "EIP712Signature2021",
      "challenge": "abc123...",
      "domain": "verifier.alastria.io",
      "proofValue": "0x..."
    }
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
  "valid": true,
  "holder": "did:ethr:0x5678...efgh",
  "presentationChecks": {
    "signature": { "valid": true },
    "challenge": { "valid": true },
    "holder": { "valid": true }
  },
  "credentialResults": [
    {
      "index": 0,
      "type": ["VerifiableCredential", "UniversityDegree"],
      "valid": true,
      "checks": {...}
    }
  ]
}`}
                    </pre>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* POST /verify/challenge */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-green-500/10 py-3 flex flex-row items-center gap-3">
            <Badge className="bg-green-500 text-white">POST</Badge>
            <code className="text-sm">/verify/challenge</code>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Genera un challenge para solicitar una presentación. El holder debe incluir 
              este challenge en la firma de su VP para prevenir replay attacks.
            </p>

            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <pre className="p-4 text-sm overflow-x-auto">
{`POST /api/v1/verify/challenge
Content-Type: application/json

{
  "verifierDid": "did:ethr:0x9abc...1234",
  "purpose": "Identity verification for service access"
}

Response:
{
  "challenge": "ch_abc123xyz...",
  "expiresAt": "2024-01-15T11:00:00.000Z",
  "domain": "verifier.alastria.io"
}`}
                </pre>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </section>

      {/* Status Check */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="status">Consulta de Estado</h2>

        {/* GET /status/:credentialId */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-blue-500/10 py-3 flex flex-row items-center gap-3">
            <Badge className="bg-blue-500 text-white">GET</Badge>
            <code className="text-sm">/status/:credentialId</code>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Consulta el estado de revocación de una credencial por su ID.
            </p>

            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <pre className="p-4 text-sm overflow-x-auto">
{`GET /api/v1/status/urn:uuid:12345678-1234-1234-1234-123456789012

Response:
{
  "credentialId": "urn:uuid:...",
  "status": "active", // "active" | "revoked" | "suspended"
  "issuedAt": "2024-01-15T10:30:00.000Z",
  "revokedAt": null,
  "onChain": {
    "verified": true,
    "blockNumber": 1234567,
    "txHash": "0x..."
  }
}`}
                </pre>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </section>

      {/* Batch Verification */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="batch">Verificación por Lotes</h2>

        <Card className="overflow-hidden">
          <CardHeader className="bg-green-500/10 py-3 flex flex-row items-center gap-3">
            <Badge className="bg-green-500 text-white">POST</Badge>
            <code className="text-sm">/verify/batch</code>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Verifica múltiples credenciales en una sola llamada. Optimiza las consultas 
              on-chain agrupándolas.
            </p>

            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <pre className="p-4 text-sm overflow-x-auto">
{`POST /api/v1/verify/batch
Content-Type: application/json

{
  "credentials": [
    { ... },
    { ... },
    { ... }
  ]
}

Response:
{
  "results": [
    { "index": 0, "valid": true, "checks": {...} },
    { "index": 1, "valid": false, "errors": [...] },
    { "index": 2, "valid": true, "checks": {...} }
  ],
  "summary": {
    "total": 3,
    "valid": 2,
    "invalid": 1
  }
}`}
                </pre>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </section>

      {/* Response Codes */}
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
                <td className="py-2 px-4 text-muted-foreground">Bad Request - Formato de credencial inválido</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4"><Badge variant="secondary">404</Badge></td>
                <td className="py-2 px-4 text-muted-foreground">Not Found - Credencial no encontrada</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4"><Badge variant="secondary">422</Badge></td>
                <td className="py-2 px-4 text-muted-foreground">Unprocessable - Credencial inválida (verificación fallida)</td>
              </tr>
              <tr>
                <td className="py-2 px-4"><Badge variant="secondary">500</Badge></td>
                <td className="py-2 px-4 text-muted-foreground">Internal Error - Error del servidor o blockchain</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* SDK Example */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="sdk">Ejemplo con SDK</h2>
        
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <pre className="p-4 text-sm overflow-x-auto">
{`import { AlastriaVerifier } from '@alastria/verifier-sdk';

const verifier = new AlastriaVerifier({
  apiUrl: 'http://localhost:8002/api/v1',
});

// Verificar una credencial
const result = await verifier.verifyCredential(credential);

if (result.valid) {
  console.log('✅ Credential is valid');
  console.log('Issuer:', result.checks.issuer.name);
} else {
  console.log('❌ Credential is invalid');
  result.errors.forEach(err => console.log('  -', err));
}

// Solicitar una presentación con challenge
const challenge = await verifier.createChallenge({
  purpose: 'Access to protected resource',
});

// Verificar la presentación
const vpResult = await verifier.verifyPresentation(presentation, {
  expectedChallenge: challenge.challenge,
});`}
            </pre>
          </CardContent>
        </Card>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-8 border-t">
        <Link 
          href="/docs/api/issuer" 
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Issuer API
        </Link>
        <Link 
          href="/docs/smart-contracts/facets" 
          className="flex items-center gap-2 text-primary hover:underline"
        >
          Smart Contract Facets
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
