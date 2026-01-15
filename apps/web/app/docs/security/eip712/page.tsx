import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ArrowRight, Shield, Lock, Key, AlertTriangle, CheckCircle } from "lucide-react"

export default function EIP712SecurityPage() {
  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/docs" className="hover:text-foreground">Docs</Link>
        <span>/</span>
        <Link href="/docs/security/eip712" className="hover:text-foreground">Security</Link>
        <span>/</span>
        <span className="text-foreground">EIP-712</span>
      </div>

      {/* Title */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge className="bg-red-500/10 text-red-600 dark:text-red-400">
            Security
          </Badge>
          <Badge variant="outline">EIP-712</Badge>
        </div>
        <h1 className="text-4xl font-bold tracking-tight">EIP-712 Typed Signatures</h1>
        <p className="text-xl text-muted-foreground">
          Sistema de firmas estructuradas para credenciales verificables. EIP-712 proporciona 
          firmas legibles, seguras y verificables on-chain.
        </p>
      </div>

      {/* Why EIP-712 */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="why">¿Por qué EIP-712?</h2>
        
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-green-500/30">
            <CardHeader className="pb-2">
              <CheckCircle className="h-5 w-5 text-green-500 mb-2" />
              <CardTitle className="text-base">Firmas Legibles</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                MetaMask muestra exactamente qué está firmando el usuario en un formato 
                estructurado y comprensible.
              </p>
            </CardContent>
          </Card>

          <Card className="border-green-500/30">
            <CardHeader className="pb-2">
              <Shield className="h-5 w-5 text-green-500 mb-2" />
              <CardTitle className="text-base">Verificable On-chain</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Las firmas pueden verificarse directamente en smart contracts sin 
                depender de servicios externos.
              </p>
            </CardContent>
          </Card>

          <Card className="border-green-500/30">
            <CardHeader className="pb-2">
              <Lock className="h-5 w-5 text-green-500 mb-2" />
              <CardTitle className="text-base">Domain Binding</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Las firmas están vinculadas a un dominio específico, previniendo 
                ataques de replay cross-chain.
              </p>
            </CardContent>
          </Card>

          <Card className="border-green-500/30">
            <CardHeader className="pb-2">
              <Key className="h-5 w-5 text-green-500 mb-2" />
              <CardTitle className="text-base">Schema Validation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Los tipos estructurados garantizan que los datos firmados tengan 
                el formato esperado.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Domain Separator */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="domain">Domain Separator</h2>
        
        <p className="text-muted-foreground">
          El Domain Separator vincula las firmas a un contexto específico, previniendo 
          que una firma válida en un contexto se use en otro.
        </p>

        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-lg font-mono">EIP712Domain</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="p-4 text-sm overflow-x-auto">
{`// Definición del dominio EIP-712
const domain = {
  name: "Alastria Verifiable Credentials",
  version: "1",
  chainId: 2020,  // Alastria T-Network
  verifyingContract: "0x..." // Dirección del Diamond
};

// El hash del domain se calcula como:
// keccak256(
//   "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
//   || keccak256(name)
//   || keccak256(version)
//   || chainId
//   || verifyingContract
// )`}
            </pre>
          </CardContent>
        </Card>

        <Card className="bg-yellow-500/5 border-yellow-500/20">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-semibold mb-1">Seguridad del Domain</h4>
                <p className="text-sm text-muted-foreground">
                  Cada componente del domain es crítico:
                </p>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                  <li><strong>chainId:</strong> Previene replay attacks entre redes</li>
                  <li><strong>verifyingContract:</strong> Vincula al contrato específico</li>
                  <li><strong>version:</strong> Permite migrar a nuevas versiones del schema</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Type Definitions */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="types">Definición de Tipos</h2>
        
        <p className="text-muted-foreground">
          Los tipos EIP-712 definen la estructura exacta de los datos a firmar. 
          Alastria usa tipos específicos para Verifiable Credentials.
        </p>

        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-lg font-mono">VerifiableCredential Types</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="p-4 text-sm overflow-x-auto">
{`const types = {
  // Tipo principal: Verifiable Credential
  VerifiableCredential: [
    { name: "id", type: "string" },
    { name: "type", type: "string[]" },
    { name: "issuer", type: "address" },
    { name: "issuanceDate", type: "uint256" },
    { name: "expirationDate", type: "uint256" },
    { name: "credentialSubject", type: "CredentialSubject" }
  ],
  
  // Tipo anidado: Subject de la credencial
  CredentialSubject: [
    { name: "id", type: "string" },
    { name: "claims", type: "Claim[]" }
  ],
  
  // Tipo para claims individuales
  Claim: [
    { name: "key", type: "string" },
    { name: "value", type: "string" },
    { name: "dataType", type: "string" }
  ]
};

// Tipo para Verifiable Presentations
const vpTypes = {
  VerifiablePresentation: [
    { name: "holder", type: "address" },
    { name: "verifiableCredential", type: "bytes32[]" }, // Hashes de VCs
    { name: "challenge", type: "string" },
    { name: "domain", type: "string" }
  ]
};`}
            </pre>
          </CardContent>
        </Card>
      </section>

      {/* Signing Process */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="signing">Proceso de Firma</h2>
        
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">1</div>
                <CardTitle className="text-base">Preparar los datos</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="text-sm overflow-x-auto bg-muted/30 p-3 rounded">
{`const message = {
  id: "urn:uuid:12345678-1234-1234-1234-123456789012",
  type: ["VerifiableCredential", "UniversityDegree"],
  issuer: issuerAddress,
  issuanceDate: Math.floor(Date.now() / 1000),
  expirationDate: 0, // Sin expiración
  credentialSubject: {
    id: "did:ethr:" + holderAddress,
    claims: [
      { key: "degree", value: "Computer Science", dataType: "string" },
      { key: "university", value: "MIT", dataType: "string" }
    ]
  }
};`}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">2</div>
                <CardTitle className="text-base">Solicitar firma vía MetaMask</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="text-sm overflow-x-auto bg-muted/30 p-3 rounded">
{`// Usando ethers.js
const signature = await signer.signTypedData(domain, types, message);

// O directamente con provider
const signature = await window.ethereum.request({
  method: "eth_signTypedData_v4",
  params: [
    signerAddress,
    JSON.stringify({
      types: { EIP712Domain: domainType, ...types },
      primaryType: "VerifiableCredential",
      domain,
      message
    })
  ]
});`}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">3</div>
                <CardTitle className="text-base">Verificar la firma</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="text-sm overflow-x-auto bg-muted/30 p-3 rounded">
{`import { ethers } from 'ethers';

// Verificación off-chain
const recoveredAddress = ethers.verifyTypedData(
  domain,
  types,
  message,
  signature
);

console.log(recoveredAddress === issuerAddress); // true

// Verificación on-chain (en el smart contract)
const isValid = await diamond.verifyCredentialSignature(
  credentialHash,
  signature
);`}
              </pre>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Security Considerations */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="security">Consideraciones de Seguridad</h2>
        
        <div className="space-y-4">
          <Card className="border-red-500/30">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <CardTitle className="text-base">Replay Attacks</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Una firma válida podría reutilizarse maliciosamente.
              </p>
              <p className="text-sm font-medium">Mitigaciones:</p>
              <ul className="text-sm text-muted-foreground mt-1 space-y-1 list-disc list-inside">
                <li>ChainId en el domain previene cross-chain replay</li>
                <li>Nonce único por credencial</li>
                <li>Challenge en presentaciones para frescura</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-red-500/30">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <CardTitle className="text-base">Front-running</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Un atacante podría ver la transacción en mempool y adelantarse.
              </p>
              <p className="text-sm font-medium">Mitigaciones:</p>
              <ul className="text-sm text-muted-foreground mt-1 space-y-1 list-disc list-inside">
                <li>Las operaciones son idempotentes</li>
                <li>Verificaciones vinculadas al emisor original</li>
                <li>Private mempools en Alastria T-Network</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-red-500/30">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <CardTitle className="text-base">Signature Malleability</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Las firmas ECDSA pueden modificarse manteniendo validez.
              </p>
              <p className="text-sm font-medium">Mitigaciones:</p>
              <ul className="text-sm text-muted-foreground mt-1 space-y-1 list-disc list-inside">
                <li>OpenZeppelin ECDSA normaliza s-value</li>
                <li>Verificación del rango de v (27/28)</li>
                <li>Hash incluido en el registro on-chain</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Best Practices */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="best-practices">Mejores Prácticas</h2>
        
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="bg-green-500/5 border-green-500/30">
            <CardContent className="pt-4">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Hacer ✓
              </h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>✓ Validar el domain antes de firmar</li>
                <li>✓ Incluir timestamps con margen razonable</li>
                <li>✓ Verificar on-chain cuando sea posible</li>
                <li>✓ Usar challenges únicos en presentaciones</li>
                <li>✓ Almacenar el hash de la firma, no la firma</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-red-500/5 border-red-500/30">
            <CardContent className="pt-4">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Evitar ✗
              </h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>✗ Firmar datos sin verificar el domain</li>
                <li>✗ Reutilizar nonces o challenges</li>
                <li>✗ Confiar solo en verificación off-chain</li>
                <li>✗ Exponer claves privadas en logs</li>
                <li>✗ Ignorar errores de verificación</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Code Example */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold" id="example">Ejemplo Completo</h2>
        
        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-lg font-mono">sign-and-verify.ts</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="p-4 text-sm overflow-x-auto">
{`import { ethers } from 'ethers';
import { DIAMOND_ADDRESS, DIAMOND_ABI } from '@alastria/contracts';

// 1. Configuración
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

const domain = {
  name: "Alastria Verifiable Credentials",
  version: "1",
  chainId: (await provider.getNetwork()).chainId,
  verifyingContract: DIAMOND_ADDRESS
};

const types = {
  VerifiableCredential: [
    { name: "id", type: "string" },
    { name: "type", type: "string[]" },
    { name: "issuer", type: "address" },
    { name: "issuanceDate", type: "uint256" },
    { name: "credentialSubject", type: "CredentialSubject" }
  ],
  CredentialSubject: [
    { name: "id", type: "string" },
    { name: "claims", type: "bytes32" }
  ]
};

// 2. Crear credencial
const credential = {
  id: \`urn:uuid:\${crypto.randomUUID()}\`,
  type: ["VerifiableCredential", "UniversityDegree"],
  issuer: await signer.getAddress(),
  issuanceDate: Math.floor(Date.now() / 1000),
  credentialSubject: {
    id: "did:ethr:0xHolder...",
    claims: ethers.keccak256(ethers.toUtf8Bytes(
      JSON.stringify({ degree: "Computer Science" })
    ))
  }
};

// 3. Firmar
const signature = await signer.signTypedData(domain, types, credential);
console.log("Signature:", signature);

// 4. Verificar off-chain
const recoveredSigner = ethers.verifyTypedData(
  domain, types, credential, signature
);
console.log("Recovered signer:", recoveredSigner);

// 5. Verificar on-chain
const diamond = new ethers.Contract(DIAMOND_ADDRESS, DIAMOND_ABI, provider);
const credentialHash = ethers.TypedDataEncoder.hash(domain, types, credential);

const [signer712, isValid] = await diamond.verifyCredentialSignature(
  credentialHash,
  signature
);
console.log("On-chain verification:", isValid);

// 6. Verificar que es Trusted Issuer
const isTrustedAndValid = await diamond.verifyCredentialProof(
  credentialHash,
  signature
);
console.log("Trusted issuer + valid signature:", isTrustedAndValid);`}
            </pre>
          </CardContent>
        </Card>
      </section>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-8 border-t">
        <Link 
          href="/docs/smart-contracts/facets" 
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Smart Contract Facets
        </Link>
        <Link 
          href="/docs/security/siwa" 
          className="flex items-center gap-2 text-primary hover:underline"
        >
          SIWA Authentication
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
